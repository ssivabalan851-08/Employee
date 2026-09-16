import React, { createContext, useContext, useEffect, useState } from "react";
import { LeaveBalance, UserProfile } from "../types.ts";
import { DbService } from "./db-service.ts";
import { supabaseAuth, SupabaseAuthUser } from "./supabase.ts";
import { accountEmailHelp, isAllowedAccountEmail } from "./email-validation.ts";

export interface SignUpDetails { email: string; password: string; name: string; department: string; title: string; requestedRole: "employee" | "manager"; }

interface AuthContextType {
  user: UserProfile | null; balances: LeaveBalance | null; token: string | null; loading: boolean; authError: string | null; authNotice: string | null;
  clearAuthStatus: () => void;
  signInWithGoogle: (role: "employee" | "manager") => Promise<void>;
  signInWithEmail: (email: string, password: string, role: "employee" | "manager") => Promise<void>;
  signUpWithEmail: (details: SignUpDetails) => Promise<void>;
  resendConfirmation: (email: string) => Promise<void>;
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
    setLoading(true); setAuthError(null); setAuthNotice(null);
    try {
      const cleanEmail = email.trim().toLowerCase();
      if (!isAllowedAccountEmail(cleanEmail)) throw new Error(accountEmailHelp);
      const authUser = await supabaseAuth.signInWithPassword(cleanEmail, password);
      await beginSession(authUser, role);
    } catch (error: any) {
      await supabaseAuth.signOut().catch(() => undefined);
      setToken(null); setUser(null); setBalances(null);
      const message = /email not confirmed/i.test(error.message)
        ? "Your account exists, but the email address is not confirmed. Open the Supabase confirmation email, confirm the account, then sign in again."
        : /invalid login credentials/i.test(error.message)
          ? "Invalid email or password. Please check your credentials or create a new account."
          : error.message || "Sign in failed.";
      setAuthError(message); throw new Error(message);
    } finally { setLoading(false); }
  };

  const signUpWithEmail = async (details: SignUpDetails) => {
    setLoading(true); setAuthError(null); setAuthNotice(null);
    try {
      const email = details.email.trim().toLowerCase();
      const name = details.name.trim();
      if (!name || !email || details.password.length < 6) throw new Error("Enter your name, work email, and a password of at least 6 characters.");
      if (!isAllowedAccountEmail(email)) throw new Error(accountEmailHelp);
      const result = await supabaseAuth.signUp(email, details.password, {
        full_name: name,
        department: details.department,
        title: details.title,
        requested_role: details.requestedRole,
      });
      await supabaseAuth.requestAccountApproval(result.user.id);
      if (result.hasSession) await supabaseAuth.signOut();
      setAuthNotice(`Your ${details.requestedRole === "manager" ? "HR" : "employee"} account request was submitted. Confirm your email and wait for the approval decision email before signing in.`);
    } catch (error: any) {
      const message = /already (been )?registered|already exists|email.*in use/i.test(error.message)
        ? "An account already exists for this email. Choose Sign In or use another email."
        : error.message || "Account creation failed.";
      setAuthError(message); throw new Error(message);
    }
    finally { setLoading(false); }
  };

  const resendConfirmation = async (email: string) => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      const message = "Enter your email address first, then request a new confirmation email.";
      setAuthError(message);
      throw new Error(message);
    }
    setLoading(true); setAuthError(null); setAuthNotice(null);
    try {
      await supabaseAuth.resendSignUpConfirmation(cleanEmail);
      setAuthNotice("A fresh confirmation email was requested. Open it and confirm your account before signing in.");
    } catch (error: any) {
      const message = error.message || "The confirmation email could not be resent. Please try again shortly.";
      setAuthError(message); throw new Error(message);
    } finally { setLoading(false); }
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

  return <AuthContext.Provider value={{ user, balances, token, loading, authError, authNotice, clearAuthStatus, signInWithGoogle, signInWithEmail, signUpWithEmail, resendConfirmation, logout, updateRoleAndProfile, refreshProfile }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
