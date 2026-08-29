import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useStore } from "@/store/useStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

// Mirrors backend MIN_PASSWORD_LENGTH (backend/src/utils/tempPassword.ts) —
// kept in sync manually since frontend and backend are separate builds.
// The server re-validates this regardless; this is just fast client-side
// feedback.
const MIN_PASSWORD_LENGTH = 8;

export function ResetPassword() {
  const isAuthenticated = useStore(state => state.isAuthenticated);
  const currentUser = useStore(state => state.currentUser);
  const changePassword = useStore(state => state.changePassword);
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  // Nothing to do here if the flag is already clear (e.g. user reached this
  // screen once, reset successfully, then hit the back button).
  if (currentUser && !currentUser.mustResetPassword) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`New password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation don't match");
      return;
    }
    if (newPassword === currentPassword) {
      setError("New password must be different from your current/temporary password");
      return;
    }

    setLoading(true);
    try {
      const result = await changePassword(currentPassword, newPassword);
      if (result.success) {
        navigate("/");
      } else {
        setError(result.error || "Failed to change password");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4 font-sans">
      <Card className="w-full max-w-[450px] shadow-sm border border-gray-200 bg-white pt-10 pb-6 px-4">
        <div className="flex flex-col items-center text-center space-y-3 mb-8">
          <img
            src={`${import.meta.env.BASE_URL}kle-logo.png`}
            alt="KLE Tech"
            style={{ height: '80px', width: 'auto', maxWidth: '380px', objectFit: 'contain' }}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
          <p className="text-lg font-semibold text-slate-900">Set a New Password</p>
          <p className="text-sm text-gray-600 max-w-sm">
            {currentUser?.mustResetPassword
              ? "Your account is using a temporary password. Set a new one before continuing."
              : "Set a new password for your account."}
          </p>
        </div>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 text-red-600 text-sm font-medium p-3 rounded-md text-center">
                {error}
              </div>
            )}

            <div className="space-y-1">
              <Label htmlFor="currentPassword">Current / temporary password</Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                required
                autoFocus
                className="h-12 text-base px-4 bg-transparent border-gray-300 focus-visible:ring-1 focus-visible:ring-[#1a6b5c] focus-visible:border-[#1a6b5c]"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="newPassword">New password</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required
                minLength={MIN_PASSWORD_LENGTH}
                className="h-12 text-base px-4 bg-transparent border-gray-300 focus-visible:ring-1 focus-visible:ring-[#1a6b5c] focus-visible:border-[#1a6b5c]"
              />
              <p className="text-xs text-slate-500 pt-1">At least {MIN_PASSWORD_LENGTH} characters.</p>
            </div>

            <div className="space-y-1">
              <Label htmlFor="confirmPassword">Confirm new password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                className="h-12 text-base px-4 bg-transparent border-gray-300 focus-visible:ring-1 focus-visible:ring-[#1a6b5c] focus-visible:border-[#1a6b5c]"
              />
            </div>

            <div className="flex items-center justify-end pt-4">
              <Button
                type="submit"
                disabled={loading}
                className="bg-[#1a6b5c] hover:bg-[#134d42] text-white px-8 h-10 rounded-md font-medium transition-colors disabled:opacity-50"
                size="lg"
              >
                {loading ? "Saving..." : "Set Password & Continue"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
