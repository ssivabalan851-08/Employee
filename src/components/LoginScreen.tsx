import React, { useState } from "react";
import { useAuth } from "../lib/auth-context.tsx";
import { 
  LogIn, 
  UserPlus,
  User, 
  ShieldCheck, 
  Lock, 
  Mail,
  Briefcase,
  Building2,
  Users,
  ShieldAlert,
  Eye,
  EyeOff,
  CheckCircle2
} from "lucide-react";

export const LoginScreen: React.FC = () => {
  const { 
    signInWithGoogle, 
    signInWithEmail, 
    signUpWithEmail, 
    authError, 
    clearAuthError 
  } = useAuth();
  
  // Categorized Portal Gateway: "employee" | "manager"
  const [activeRole, setActiveRole] = useState<"employee" | "manager">("employee");

  // Mode: "signin" | "signup"
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");

  // Sign In Form States
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [showSignInPassword, setShowSignInPassword] = useState(false);

  // Create Account Form States
  const [signUpName, setSignUpName] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [signUpDepartment, setSignUpDepartment] = useState(activeRole === "manager" ? "Human Resources" : "Engineering");
  const [signUpTitle, setSignUpTitle] = useState(activeRole === "manager" ? "HR Manager" : "Software Engineer");

  // Loading state
  const [submitting, setSubmitting] = useState(false);

  const handleRoleChange = (newRole: "employee" | "manager") => {
    clearAuthError();
    setActiveRole(newRole);
    if (newRole === "manager") {
      setSignUpDepartment("Human Resources");
      setSignUpTitle("HR Manager");
    } else {
      setSignUpDepartment("Engineering");
      setSignUpTitle("Software Engineer");
    }
  };

  const handleAuthModeChange = (mode: "signin" | "signup") => {
    clearAuthError();
    setAuthMode(mode);
  };

  // Handle Sign In Submit
  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await signInWithEmail(signInEmail, signInPassword, activeRole);
    } catch (err) {
      // Error handled by AuthContext
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Create Account Submit
  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await signUpWithEmail({
        email: signUpEmail,
        password: signUpPassword,
        name: signUpName,
        department: signUpDepartment,
        title: signUpTitle
      });
    } catch (err) {
      // Error handled by AuthContext
    } finally {
      setSubmitting(false);
    }
  };

  const departmentsList = [
    "Engineering",
    "Human Resources",
    "Product Management",
    "Marketing",
    "Operations",
    "Finance",
    "Sales",
    "Customer Support",
    "Legal"
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      
      {/* Decorative corporate ambient background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-slate-200/50 via-slate-100/20 to-transparent pointer-events-none blur-3xl -z-10" />
      
      {/* Header / Brand Banner */}
      <div className="sm:mx-auto sm:w-full sm:max-w-xl text-center mb-6">
        <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-slate-900 text-white shadow-lg mb-3 shadow-slate-900/10 hover:scale-105 transition-transform duration-300">
          <Building2 className="h-7 w-7 text-slate-100" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Enterprise Leave Portal
        </h1>
        <p className="text-xs text-slate-500 font-semibold uppercase tracking-widest mt-1">
          Human Resources & Time-Off Management System
        </p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="bg-white/95 backdrop-blur-md border border-slate-200/80 shadow-[0_20px_50px_rgba(15,23,42,0.08)] rounded-2xl overflow-hidden transition-all duration-300">
          
          {/* CATEGORIZED PORTAL GATEWAY SELECTOR */}
          <div className="p-3 bg-slate-100/80 border-b border-slate-200/80">
            <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-2 px-1 text-center">
              Select Corporate Gateway
            </div>
            <div className="grid grid-cols-2 gap-2">
              
              {/* Employee Gateway Option */}
              <button
                type="button"
                onClick={() => handleRoleChange("employee")}
                className={`flex items-center space-x-3 p-3 rounded-xl border text-left transition-all duration-200 ${
                  activeRole === "employee"
                    ? "bg-white border-indigo-500 shadow-sm ring-1 ring-indigo-500/20"
                    : "bg-white/60 border-slate-200 hover:bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                <div className={`p-2 rounded-lg flex-shrink-0 transition-colors ${
                  activeRole === "employee" 
                    ? "bg-indigo-50 text-indigo-600" 
                    : "bg-slate-100 text-slate-500"
                }`}>
                  <Users className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-xs font-bold text-slate-900 block truncate">Employee Portal</span>
                    {activeRole === "employee" && (
                      <span className="h-1.5 w-1.5 rounded-full bg-indigo-600"></span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium block truncate mt-0.5">
                    Staff & Leave Requests
                  </span>
                </div>
              </button>

              {/* HR / Operations Admin Option */}
              <button
                type="button"
                onClick={() => handleRoleChange("manager")}
                className={`flex items-center space-x-3 p-3 rounded-xl border text-left transition-all duration-200 ${
                  activeRole === "manager"
                    ? "bg-white border-slate-900 shadow-sm ring-1 ring-slate-900/20"
                    : "bg-white/60 border-slate-200 hover:bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                <div className={`p-2 rounded-lg flex-shrink-0 transition-colors ${
                  activeRole === "manager" 
                    ? "bg-slate-900 text-white" 
                    : "bg-slate-100 text-slate-500"
                }`}>
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-xs font-bold text-slate-900 block truncate">HR & Admin Portal</span>
                    {activeRole === "manager" && (
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium block truncate mt-0.5">
                    Approvals & Staff Ledger
                  </span>
                </div>
              </button>

            </div>
          </div>

          <div className="p-6 sm:p-8">
            
            {/* Global Error Banner */}
            {authError && (
              <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200/80 flex items-start space-x-3 animate-in fade-in duration-200">
                <ShieldAlert className="h-5 w-5 text-rose-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="text-xs font-bold text-rose-900">Authentication Error</h4>
                  <p className="text-xs text-rose-700 mt-0.5 font-medium leading-relaxed">{authError}</p>
                </div>
              </div>
            )}

            {/* AUTH MODE TOGGLE: Sign In vs Create Account */}
            <div className="flex items-center p-1 bg-slate-100 rounded-xl mb-6">
              <button
                type="button"
                onClick={() => handleAuthModeChange("signin")}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-200 flex items-center justify-center space-x-1.5 ${
                  authMode === "signin"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>Sign In</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  handleRoleChange("employee");
                  handleAuthModeChange("signup");
                }}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-200 flex items-center justify-center space-x-1.5 ${
                  authMode === "signup"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>Create New Account</span>
              </button>
            </div>

            {/* Context Headline */}
            <div className="mb-6">
              <h2 className="text-lg font-bold text-slate-900">
                {authMode === "signin" ? (
                  activeRole === "manager" ? "Sign in to HR Administration" : "Sign in to Employee Portal"
                ) : (
                  "Create New Employee Account"
                )}
              </h2>
              <p className="text-xs text-slate-500 mt-1 font-medium">
                {authMode === "signin"
                  ? `Enter your corporate credentials to access the ${activeRole === "manager" ? "HR manager" : "employee"} workspace.`
                  : "New accounts receive employee access. An administrator must grant manager access."}
              </p>
            </div>

            {/* MODE 1: SIGN IN FORM */}
            {authMode === "signin" ? (
              <form onSubmit={handleSignInSubmit} className="space-y-4">
                
                {/* Email Address */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                    Corporate Email
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Mail className="h-4 w-4" />
                    </div>
                    <input
                      type="email"
                      required
                      value={signInEmail}
                      onChange={(e) => setSignInEmail(e.target.value)}
                      placeholder={activeRole === "manager" ? "diana@enterprise.com" : "alice@enterprise.com"}
                      className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      Password
                    </label>
                    <span className="text-[10px] text-slate-400 font-semibold cursor-pointer hover:text-slate-700">
                      Forgot Password?
                    </span>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Lock className="h-4 w-4" />
                    </div>
                    <input
                      type={showSignInPassword ? "text" : "password"}
                      required
                      value={signInPassword}
                      onChange={(e) => setSignInPassword(e.target.value)}
                      placeholder="Enter your corporate password"
                      className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSignInPassword(!showSignInPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-700 focus:outline-none"
                    >
                      {showSignInPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Submit Sign In Button */}
                <button
                  type="submit"
                  disabled={submitting}
                  className={`w-full py-3 px-4 rounded-xl text-xs font-bold text-white shadow-sm flex items-center justify-center space-x-2 transition-all duration-150 ${
                    activeRole === "manager"
                      ? "bg-slate-900 hover:bg-slate-800 hover:shadow-md"
                      : "bg-indigo-600 hover:bg-indigo-700 hover:shadow-md"
                  } disabled:opacity-50`}
                >
                  <LogIn className="h-4 w-4" />
                  <span>
                    {submitting 
                      ? "Authenticating..." 
                      : `Sign In to ${activeRole === "manager" ? "HR Portal" : "Employee Portal"}`}
                  </span>
                </button>

              </form>
            ) : (
              /* MODE 2: CREATE ACCOUNT (SIGN UP) FORM */
              <form onSubmit={handleSignUpSubmit} className="space-y-3.5">
                
                {/* Full Name */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Full Name
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <User className="h-4 w-4" />
                    </div>
                    <input
                      type="text"
                      required
                      value={signUpName}
                      onChange={(e) => setSignUpName(e.target.value)}
                      placeholder="e.g. Marcus Vance"
                      className="w-full pl-10 pr-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all"
                    />
                  </div>
                </div>

                {/* Work Email */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Corporate Work Email
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Mail className="h-4 w-4" />
                    </div>
                    <input
                      type="email"
                      required
                      value={signUpEmail}
                      onChange={(e) => setSignUpEmail(e.target.value)}
                      placeholder="e.g. marcus@enterprise.com"
                      className="w-full pl-10 pr-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Password (Min. 6 characters)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Lock className="h-4 w-4" />
                    </div>
                    <input
                      type={showSignUpPassword ? "text" : "password"}
                      required
                      minLength={6}
                      value={signUpPassword}
                      onChange={(e) => setSignUpPassword(e.target.value)}
                      placeholder="Create a secure password"
                      className="w-full pl-10 pr-10 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSignUpPassword(!showSignUpPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-700 focus:outline-none"
                    >
                      {showSignUpPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Department & Job Title (2 Columns) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                      Department
                    </label>
                    <select
                      value={signUpDepartment}
                      onChange={(e) => setSignUpDepartment(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all"
                    >
                      {departmentsList.map((dept) => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                      Job Title
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Briefcase className="h-3.5 w-3.5" />
                      </div>
                      <input
                        type="text"
                        required
                        value={signUpTitle}
                        onChange={(e) => setSignUpTitle(e.target.value)}
                        placeholder="e.g. HR Partner"
                        className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* Quota Guarantee Notice */}
                <div className="p-3 bg-slate-50 border border-slate-200/60 rounded-xl text-[11px] text-slate-600 flex items-start space-x-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-slate-900">Standard Balance Grant: </span>
                    New accounts are automatically initialized with 20 Annual, 10 Sick, 7 Casual, and 30 Parental leave days.
                  </div>
                </div>

                {/* Submit Sign Up Button */}
                <button
                  type="submit"
                  disabled={submitting}
                  className={`w-full py-3 px-4 rounded-xl text-xs font-bold text-white shadow-sm flex items-center justify-center space-x-2 transition-all duration-150 ${
                    activeRole === "manager"
                      ? "bg-slate-900 hover:bg-slate-800 hover:shadow-md"
                      : "bg-indigo-600 hover:bg-indigo-700 hover:shadow-md"
                  } disabled:opacity-50`}
                >
                  <UserPlus className="h-4 w-4" />
                  <span>
                    {submitting 
                      ? "Creating Account..." 
                      : `Register as ${activeRole === "manager" ? "HR Administrator" : "Corporate Employee"}`}
                  </span>
                </button>

              </form>
            )}

            {/* OR DIVIDER */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200/80"></div>
              </div>
              <div className="relative flex justify-center text-[10px] uppercase tracking-wider font-bold text-slate-400">
                <span className="px-3 bg-white">
                  or authenticate with
                </span>
              </div>
            </div>

            {/* Google OAuth Option */}
            <button
              type="button"
              onClick={() => signInWithGoogle(activeRole)}
              className="w-full flex items-center justify-center px-4 py-2.5 border border-slate-200 hover:border-slate-300 rounded-xl bg-white hover:bg-slate-50/80 text-slate-700 text-xs font-bold shadow-sm transition-all duration-150"
            >
              <svg className="h-4 w-4 mr-2.5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              Sign in with Corporate Google Account
            </button>

          </div>

          {/* Footer note */}
          <div className="py-3 px-6 bg-slate-50 border-t border-slate-100 text-center text-[10px] font-semibold text-slate-400">
            Firebase Authentication • Role-Based Access • Secure Session Reset
          </div>

        </div>
      </div>

    </div>
  );
};

