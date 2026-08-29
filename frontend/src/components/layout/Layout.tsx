import { Outlet, Navigate } from "react-router-dom";
import { Navbar } from "./Navbar";
import { useStore } from "@/store/useStore";

export function Layout() {
  const isAuthenticated = useStore(state => state.isAuthenticated);
  const currentUser = useStore(state => state.currentUser);

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  // Client-side redirect for UX — the API itself enforces this on every
  // request via requirePasswordSet regardless of whether this fires, so a
  // stale/bypassed flag here can't grant real access to anything.
  if (currentUser?.mustResetPassword) return <Navigate to="/reset-password" replace />;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <Navbar />
      <main className="container mx-auto p-4 sm:p-8">
        <Outlet />
      </main>
    </div>
  );
}
