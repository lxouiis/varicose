import { Outlet, Navigate } from "react-router-dom";
import { Navbar } from "./Navbar";
import { useStore } from "@/store/useStore";

export function Layout() {
  const isAuthenticated = useStore(state => state.isAuthenticated);

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <Navbar />
      <main className="container mx-auto p-4 sm:p-8">
        <Outlet />
      </main>
    </div>
  );
}
