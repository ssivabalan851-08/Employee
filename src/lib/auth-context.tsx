import React, { createContext, useContext, useEffect, useState } from "react";
import { LeaveBalance, UserProfile } from "../types.ts";
import { DbService } from "./db-service.ts";
import { supabaseAuth, SupabaseAuthUser } from "./supabase.ts";
import { accountEmailHelp, isAllowedAccountEmail } from "./email-validation.ts";
import { normalizeApplicantPhone } from "./phone-validation.ts";

export interface SignUpDetails { email: string; password: string; name: string; phoneNumber: string; department: string; title: string; requestedRole: "employee" | "manager"; }

interface AuthContextType {
  user: UserProfile | null; balances: LeaveBalance | null; token: string | null; loading: boolean; authError: string | null; authNotice: string | null;
  clearAuthStatus: () => void;
  signInWithGoogle: (role: "employee" | "manager") => Promise<void>;
  signInWithEmail: (email: string, password: string, role: "employee" | "manager") => Promise<void>;
  signUpWithEmail: (details: SignUpDetails) => Promise<void>;
  logout: () => Promise<void>;
  updateRoleAndProfile: (updates: { name?: string; department?: string; title?: string }) => Promise<void>;
  refreshProfile: (uid?: string, role?: "employee" | "manager") => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const getName = (u: SupabaseAuthUser) => String(u.user_metadata?.full_name || u.user_metadata?.name || u.email?.split("@")[0] || "Employee");

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [balances, setBalances] = useState<LeaveBalance | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);

  const refreshProfile = async (uid = token || undefined, role?: "employee" | "manager") => {
    if (!uid) return;
    const authUser = await supabaseAuth.getUser();
    if (!authUser) throw new Error("Your session has ended. Please sign in again.");
    const requestedRole = role || (sessionStorage.getItem("portal_role") as "employee" | "manager" | null) || undefined;
    const data = await DbService.getProfileAndBalances(uid, authUser.email, getName(authUser), requestedRole);
    setUser(data.user); setBalances(data.balances); setAuthError(null);
  };

  const beginSession = async (authUser: SupabaseAuthUser, role: "employee" | "manager") => {
    sessionStorage.setItem("portal_role", role);
    setToken(authUser.id);
    await refreshProfile(authUser.id, role);
  };

  const signInWithGoogle = async (role: "employee" | "manager") => {
    setAuthError(null); setAuthNotice(null);
    sessionStorage.setItem("portal_role", role);
    try { supabaseAuth.signInWithGoogle(); }
    catch (error: any) { setAuthError(error.message || "Google sign-in could not start."); throw error; }
  };

  const signInWithEmail = async (email: string, password: string, role: "employee" | "manager") => {
    setAuthError(null); setAuthNotice(null);
    let signedInUser: SupabaseAuthUser | null = null;
    try {
      const cleanEmail = email.trim().toLowerCase();
      if (!isAllowedAccountEmail(cleanEmail)) throw new Error(accountEmailHelp);
      signedInUser = await supabaseAuth.signInWithPassword(cleanEmail, password);
      await beginSession(signedInUser, role);
    } catch (error: any) {
      if (signedInUser && /waiting for administrator approval/i.test(error.message || "")) {
        await supabaseAuth.requestAccountApproval(signedInUser.id).catch(() => undefined);
      }
      await supabaseAuth.signOut().catch(() => undefined);
      setToken(null); setUser(null); setBalances(null);
      const message = /email not confirmed/i.test(error.message)
        ? "This account is not ready for access. Submit a new account request or contact the LeaveWise administrator."
        : /invalid login credentials/i.test(error.message)
          ? "Invalid email or password. Please check your credentials or create a new account."
          : error.message || "Sign in failed.";
      setAuthError(message); throw new Error(message);
    }
  };

  const signUpWithEmail = async (details: SignUpDetails) => {
    setAuthError(null); setAuthNotice(null);
    try {
      const email = details.email.trim().toLowerCase();
      const name = details.name.trim();
      const phoneNumber = normalizeApplicantPhone(details.phoneNumber);
      if (!name || !email || details.password.length < 6) throw new Error("Enter your name, work email, and a password of at least 6 characters.");
      if (!isAllowedAccountEmail(email)) throw new Error(accountEmailHelp);
      const result = await supabaseAuth.signUp(email, details.password, {
        full_name: name,
        phone_number: phoneNumber,
        department: details.department,
        title: details.title,
        requested_role: details.requestedRole,
      });
      try {
        await supabaseAuth.requestAccountApproval(result.user.id);
        setAuthNotice(`Your ${details.requestedRole === "manager" ? "HR" : "employee"} account request was submitted. The administrator has been emailed. After approval, LeaveWise will send an SMS to ${phoneNumber}.`);
      } catch {
        setAuthNotice("Your account was created and is waiting for approval, but the administrator notification was delayed. Choose Sign In with the same credentials to retry the notification.");
      } finally {
        if (result.hasSession) await supabaseAuth.signOut();
      }
    } catch (error: any) {
      const message = /already (been )?registered|already exists|email.*in use/i.test(error.message)
        ? "An account already exists for this email. Choose Sign In or use another email."
        : error.message || "Account creation failed.";
      setAuthError(message); throw new Error(message);
    }
  };

  const logout = async () => {
    setLoading(true);
    try { await supabaseAuth.signOut(); sessionStorage.removeItem("portal_role"); setToken(null); setUser(null); setBalances(null); setAuthError(null); setAuthNotice(null); }
    finally { setLoading(false); }
  };

  const updateRoleAndProfile = async (updates: { name?: string; department?: string; title?: string }) => {
    if (!token) return;
    await DbService.updateProfile(token, updates);
    await refreshProfile(token);
  };

  useEffect(() => {
    localStorage.clear();
    supabaseAuth.consumeOAuthRedirect()
      .then(async (authUser) => { if (authUser) await beginSession(authUser, (sessionStorage.getItem("portal_role") as "employee" | "manager" | null) || "employee"); })
      .catch((error) => setAuthError(error.message || "Sign-in could not be completed."))
      .finally(() => setLoading(false));
  }, []);

  const clearAuthStatus = () => { setAuthError(null); setAuthNotice(null); };

  return <AuthContext.Provider value={{ user, balances, token, loading, authError, authNotice, clearAuthStatus, signInWithGoogle, signInWithEmail, signUpWithEmail, logout, updateRoleAndProfile, refreshProfile }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
