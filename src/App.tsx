import React, { Suspense, lazy } from "react";
import { AuthProvider, useAuth } from "./lib/auth-context.tsx";
import { NotificationCenter } from "./components/NotificationCenter.tsx";
import { CalendarDays, LogOut } from "lucide-react";
import { BrandLogo } from "./components/BrandLogo.tsx";

const LoginScreen = lazy(() => import("./components/LoginScreen.tsx").then(module => ({ default: module.LoginScreen })));
const EmployeeDashboard = lazy(() => import("./components/EmployeeDashboard.tsx").then(module => ({ default: module.EmployeeDashboard })));
const ManagerDashboard = lazy(() => import("./components/ManagerDashboard.tsx").then(module => ({ default: module.ManagerDashboard })));
const AccountApprovalPage = lazy(() => import("./components/AccountApprovalPage.tsx").then(module => ({ default: module.AccountApprovalPage })));

const LoadingScreen = () => (
  <div className="min-h-screen leavewise-loading flex items-center justify-center">
    <div className="text-center space-y-4">
      <div className="animate-pulse h-12 w-12 bg-slate-900 rounded-xl flex items-center justify-center text-white mx-auto">
        <CalendarDays className="h-5 w-5 animate-spin text-slate-200" />
      </div>
      <p className="text-xs font-semibold text-slate-500 tracking-wide">Loading secure workspace...</p>
    </div>
  </div>
);

const MainLayout: React.FC = () => {
  const { user, token, loading, logout } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!token || !user) {
    return <LoginScreen />;
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans leavewise-app-shell">
      
      {/* Corporate Header */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 shadow-sm leavewise-topbar">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            
            {/* Logo */}
            <div className="flex items-center space-x-3 leavewise-header-brand">
              <BrandLogo compact />
              <div>
                <span className="text-sm font-bold text-slate-900 tracking-tight block">LeaveWise</span>
                <span className="block text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-0.5">Workplace Leave Management</span>
              </div>
            </div>

            {/* Profile & Notifications */}
            <div className="flex items-center space-x-4">
              
              <div className="hidden md:inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border shadow-sm bg-emerald-50/60 text-emerald-800 border-emerald-100">
                <span className="h-1.5 w-1.5 rounded-full mr-1.5 bg-emerald-500" />
                System Online
              </div>

              {/* In-app Notification center */}
              <NotificationCenter token={token} />

              <div className="h-6 w-[1px] bg-slate-200" />

              {/* User Dropdown */}
              <div className="flex items-center space-x-3">
                <div className="text-right hidden sm:block">
                  <span className="block text-xs font-bold text-slate-900 leading-none">{user.name}</span>
                  <span className="text-[10px] text-slate-400 font-bold leading-normal mt-0.5 block capitalize">
                    {user.title} ({user.role})
                  </span>
                </div>
                
                <div className="h-9 w-9 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs shadow-sm">
                  {user.name.charAt(0)}
                </div>

                <button
                  onClick={logout}
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50/50 rounded-lg transition"
                  title="Sign Out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>

            </div>

          </div>
        </div>
      </header>

      {/* Main Workspace Stage */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 leavewise-workspace">
        {user.role === "manager" ? <ManagerDashboard /> : <EmployeeDashboard />}
      </main>

      {/* Enterprise Footer */}
      <footer className="bg-white border-t border-slate-200/60 py-6 text-center text-xs text-slate-500 leavewise-footer">
        <p className="font-medium">© {new Date().getFullYear()} LeaveWise. Secure leave management for modern workplaces.</p>
      </footer>

    </div>
  );
};

export default function App() {
  if (window.location.pathname.replace(/\/+$/, "") === "/account-approval") {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <AccountApprovalPage />
      </Suspense>
    );
  }

  return (
    <AuthProvider>
      <Suspense fallback={<LoadingScreen />}>
        <MainLayout />
      </Suspense>
    </AuthProvider>
  );
}

