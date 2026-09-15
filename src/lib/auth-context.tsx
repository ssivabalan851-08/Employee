import React, { createContext, useContext, useState, useEffect } from "react";
import { 
  signInWithPopup, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  inMemoryPersistence,
  setPersistence,
  signOut, 
} from "firebase/auth";
import { auth, googleAuthProvider } from "./firebase.ts";
import { UserProfile, LeaveBalance } from "../types.ts";
import { DbService } from "./db-service.ts";

export interface SignUpDetails {
  email: string;
  password: string;
  name: string;
  department: string;
  title: string;
}

interface AuthContextType {
  user: UserProfile | null;
  balances: LeaveBalance | null;
  token: string | null;
  loading: boolean;
  authError: string | null;
  clearAuthError: () => void;
  signInWithGoogle: (chosenRole: "employee" | "manager") => Promise<void>;
  signInWithEmail: (email: string, password: string, chosenRole: "employee" | "manager") => Promise<void>;
  signUpWithEmail: (details: SignUpDetails) => Promise<void>;
  logout: () => Promise<void>;
  updateRoleAndProfile: (updates: { name?: string; department?: string; title?: string }) => Promise<void>;
  refreshProfile: (activeToken?: string, chosenRole?: "employee" | "manager") => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [balances, setBalances] = useState<LeaveBalance | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const clearAuthError = () => {
    setAuthError(null);
  };

  // Re-fetch current user profile and balances from our client-side DB service
  const refreshProfile = async (activeToken?: string, chosenRole?: "employee" | "manager") => {
    const bearerToken = activeToken || token;
    if (!bearerToken) return;

    try {
      const activeUser = auth.currentUser;
      const emailFromAuth = activeUser?.email || undefined;
      const nameFromAuth = activeUser?.displayName || undefined;
      const requestedRole = chosenRole || (localStorage.getItem("portal_role") as "employee" | "manager") || undefined;
      let effectiveRole = requestedRole;

      if (activeUser && !IS_DEMO_SESSION(bearerToken)) {
        const tokenResult = await activeUser.getIdTokenResult();
        const authorizedRole = tokenResult.claims.manager === true ? "manager" : "employee";
        if (requestedRole && requestedRole !== authorizedRole) {
          throw new Error(
            authorizedRole === "manager"
              ? "This account has manager access. Use the HR & Admin Portal."
              : "This account has employee access. Manager access must be granted by an administrator."
          );
        }
        effectiveRole = authorizedRole;
      }
      
      const fetchPromise = DbService.getProfileAndBalances(bearerToken, emailFromAuth, nameFromAuth, effectiveRole);
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error("Database connection timeout. Please check your network or try logging in again.")), 5000)
      );

      const data = await Promise.race([fetchPromise, timeoutPromise]);
      setUser(data.user);
      setBalances(data.balances);
      setAuthError(null);
    } catch (err: any) {
      console.error("Failed to load user profile details from DbService", err);
      let displayError = err.message || "Failed to load corporate profile.";
      try {
        if (displayError.startsWith("{") && displayError.endsWith("}")) {
          const parsed = JSON.parse(displayError);
          if (parsed.error) {
            displayError = parsed.error;
          }
        }
      } catch (e) {
        // ignore
      }
      setAuthError(displayError);
      // Auto logout on authorization mismatch or timeout
      await logoutSilently();
      throw err;
    }
  };

  const logoutSilently = async () => {
    localStorage.removeItem("demo_user_uid");
    setToken(null);
    setUser(null);
    setBalances(null);
    try {
      await signOut(auth);
    } catch (e) {
      // ignore
    }
  };

  // Sign in via Google popup
  const signInWithGoogle = async (chosenRole: "employee" | "manager") => {
    try {
      setLoading(true);
      setAuthError(null);
      localStorage.setItem("portal_role", chosenRole);
      await setPersistence(auth, inMemoryPersistence);
      
      const result = await signInWithPopup(auth, googleAuthProvider);
      const userToken = result.user.uid;
      
      // Remove any local mock session
      localStorage.removeItem("demo_user_uid");
      setToken(userToken);
    } catch (error: any) {
      console.error("Google sign in error", error);
      setAuthError(error.message || "Sign-in process cancelled or failed.");
      setLoading(false);
    }
  };

  // Sign in with Email and Password. Passwords are handled only by Firebase Auth.
  const signInWithEmail = async (email: string, password: string, chosenRole: "employee" | "manager") => {
    try {
      setLoading(true);
      setAuthError(null);

      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail || !password) {
        throw new Error("Please enter both your email address and password.");
      }

      await setPersistence(auth, inMemoryPersistence);
      try {
        const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);
        const userToken = userCredential.user.uid;
        localStorage.setItem("portal_role", chosenRole);
        localStorage.removeItem("demo_user_uid");
        setToken(userToken);
        await refreshProfile(userToken, chosenRole);
      } catch (fbErr: any) {
        console.warn("Firebase sign in attempt failed:", fbErr.code, fbErr.message);
        if (fbErr.code === "auth/invalid-credential" || fbErr.code === "auth/user-not-found" || fbErr.code === "auth/wrong-password") {
          throw new Error("Invalid email or password. Please check your credentials or create a new account.");
        }
        if (fbErr.code === "auth/operation-not-allowed") {
          throw new Error("Email/password sign-in is disabled in Firebase. Ask an administrator to enable it or use Google sign-in.");
        }
        throw new Error(fbErr.message || "Sign in failed. Please verify your credentials.");
      }
    } catch (err: any) {
      console.error("Sign in error:", err);
      setAuthError(err.message || "Failed to sign in.");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Sign up with Email and Password
  const signUpWithEmail = async (details: SignUpDetails) => {
    try {
      setLoading(true);
      setAuthError(null);

      const cleanEmail = details.email.trim().toLowerCase();
      const cleanName = details.name.trim();

      if (!cleanName) throw new Error("Full name is required.");
      if (!cleanEmail) throw new Error("Corporate work email is required.");
      if (!details.password || details.password.length < 6) {
        throw new Error("Password must be at least 6 characters long.");
      }
      if (!details.department) throw new Error("Please select your department.");
      if (!details.title) throw new Error("Please provide your job title.");

      await setPersistence(auth, inMemoryPersistence);
      const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, details.password);
      const uid = userCredential.user.uid;

      const newProfile: UserProfile = {
        uid,
        email: cleanEmail,
        name: cleanName,
        role: "employee",
        department: details.department,
        title: details.title,
        joinedDate: new Date().toISOString().split("T")[0],
        createdAt: new Date().toISOString()
      };

      // Register profile and leave balances in DbService
      await DbService.registerUserProfile(newProfile);

      localStorage.removeItem("local_registered_users");
      localStorage.setItem("portal_role", "employee");
      localStorage.removeItem("demo_user_uid");
      setToken(uid);
      await refreshProfile(uid, "employee");
    } catch (err: any) {
      console.error("Sign up error:", err);
      setAuthError(err.message || "Failed to create account.");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Sign out
  const logout = async () => {
    try {
      setLoading(true);
      setAuthError(null);
      localStorage.removeItem("demo_user_uid");
      localStorage.removeItem("portal_role");
      setToken(null);
      setUser(null);
      setBalances(null);
      await signOut(auth);
    } catch (error) {
      console.error("Sign out error", error);
    } finally {
      setLoading(false);
    }
  };

  // Update editable profile details. Roles are administrator-managed.
  const updateRoleAndProfile = async (updates: { name?: string; department?: string; title?: string }) => {
    const activeToken = token;
    if (!activeToken) return;

    try {
      await DbService.updateProfile(activeToken, updates);
      await refreshProfile(activeToken);
    } catch (error) {
      console.error("Error updating profile role via DbService", error);
    }
  };

  // Always start at sign-in and remove data left by previous demo builds.
  useEffect(() => {
    for (const key of Object.keys(localStorage)) {
      if (
        key === "portal_role" ||
        key === "demo_user_uid" ||
        key === "local_registered_users" ||
        key.startsWith("demo_")
      ) {
        localStorage.removeItem(key);
      }
    }
    setPersistence(auth, inMemoryPersistence)
      .then(() => signOut(auth))
      .catch((error) => console.error("Failed to clear the previous session", error))
      .finally(() => {
        setToken(null);
        setUser(null);
        setBalances(null);
        setLoading(false);
      });
  }, []);

  // Set up auto-refresh profile if token changes
  useEffect(() => {
    if (token) {
      setLoading(true);
      const currentPortalRole = localStorage.getItem("portal_role") as "employee" | "manager" || undefined;
      refreshProfile(token, currentPortalRole)
        .catch((err) => {
          console.error("Profile refresh failed in effect:", err);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [token]);

  return (
    <AuthContext.Provider
      value={{
        user,
        balances,
        token,
        loading,
        authError,
        clearAuthError,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        logout,
        updateRoleAndProfile,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

const IS_DEMO_SESSION = (value: string) =>
  value.startsWith("demo-") || value.startsWith("local-");

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};


