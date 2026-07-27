import { useState } from "react";
import { Plus, User, LogOut } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useStore } from "@/store/useStore";
import { Button } from "@/components/ui/button";

export function Navbar() {
  const navigate = useNavigate();
  const [imgError, setImgError] = useState(false);
  const logout = useStore(state => state.logout);
  const currentUser = useStore(state => state.currentUser);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <nav className="sticky top-0 z-40 w-full border-b bg-white">
      <div className="container mx-auto flex h-16 items-center px-4 sm:px-8">
        <Link to="/" className="flex items-center hover:opacity-90 transition-opacity">
          {imgError ? (
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-600 text-white font-bold text-[10px] text-center leading-tight shadow-md border-b-2 border-red-800">
                KLE<br/>TECH
              </div>
              <div className="flex flex-col justify-center border-l-2 border-red-600 pl-3">
                <span className="font-bold text-slate-900 leading-tight text-sm tracking-tight">KLE Technological University</span>
                <span className="text-[10px] text-slate-500 leading-tight font-medium uppercase tracking-wider">Creating Value, Leveraging Knowledge</span>
              </div>
            </div>
          ) : (
            <img 
              src={`${import.meta.env.BASE_URL}kle-logo.png`}
              alt="KLE Tech" 
              className="h-10" 
              onError={() => setImgError(true)} 
            />
          )}
        </Link>
        <div className="flex flex-1 items-center justify-end space-x-4">
          <Button onClick={() => navigate("/patients/new")} className="shadow-sm">
            <Plus className="mr-2 h-4 w-4" />
            New Patient
          </Button>
          <Button variant="ghost" className="flex items-center gap-2 text-sm text-slate-700 hover:text-slate-900 border-l pl-4 ml-2 rounded-none h-8" onClick={handleLogout}>
            <User className="h-4 w-4" />
            <span className="font-medium">{currentUser?.name ?? 'User'}</span>
            <LogOut className="h-4 w-4 ml-2 text-muted-foreground" />
          </Button>
        </div>
      </div>
    </nav>
  );
}
