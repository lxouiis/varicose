import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useStore } from "@/store/useStore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Copy, Check, KeyRound } from "lucide-react";

export function Admin() {
  const currentUser = useStore(state => state.currentUser);
  const doctors = useStore(state => state.doctors);
  const fetchDoctors = useStore(state => state.fetchDoctors);
  const resetDoctorPassword = useStore(state => state.resetDoctorPassword);

  const [loading, setLoading] = useState(true);
  const [resettingId, setResettingId] = useState<number | null>(null);
  // Held only in memory, for exactly one on-screen display — never written
  // to localStorage, never logged. Cleared on dismiss or on navigating away
  // (this whole component unmounting).
  const [revealed, setRevealed] = useState<{ doctorName: string; tempPassword: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchDoctors().finally(() => setLoading(false));
  }, [fetchDoctors]);

  // Route-level guard, in addition to the server's own requireAdmin check on
  // every /api/admin/* call — this just avoids showing the page shell to a
  // non-admin before their first API call 403s.
  if (currentUser && currentUser.role !== 'Admin') {
    return <Navigate to="/" replace />;
  }

  const handleReset = async (doctorId: number, doctorName: string) => {
    if (!window.confirm(`Reset the password for ${doctorName}? They will need the new temporary password to log in, and will be forced to set a new one immediately.`)) {
      return;
    }
    setError("");
    setResettingId(doctorId);
    setCopied(false);
    try {
      const result = await resetDoctorPassword(doctorId);
      if ('tempPassword' in result) {
        setRevealed({ doctorName, tempPassword: result.tempPassword });
      } else {
        setError(result.error);
      }
    } finally {
      setResettingId(null);
    }
  };

  const handleCopy = async () => {
    if (!revealed) return;
    try {
      await navigator.clipboard.writeText(revealed.tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can fail (permissions, non-HTTPS context); the
      // password is still visible on screen to copy manually.
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Admin — Doctor Accounts</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Reset a doctor's password when they've forgotten it. This app has no email/SMS on the
          hospital intranet, so the new temporary password is shown here once — relay it to them directly.
        </p>
      </div>

      {revealed && (
        <div className="p-4 bg-[#eefaf6] border-2 border-[#1a6b5c] rounded-lg space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#134d42] flex items-center gap-2">
              <KeyRound className="h-4 w-4" /> New temporary password for {revealed.doctorName}
            </h3>
            <Button variant="ghost" size="sm" onClick={() => setRevealed(null)}>Dismiss</Button>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-white border border-[#1a6b5c]/30 rounded px-3 py-2 text-lg font-mono tracking-wider text-slate-900">
              {revealed.tempPassword}
            </code>
            <Button variant="outline" size="sm" onClick={handleCopy}>
              {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-[#134d42]">
            Shown once — it will not be shown again after you leave or dismiss this. The account will be
            required to set its own password on next login.
          </p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-600 text-sm font-medium p-3 rounded-md">{error}</div>
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading doctor accounts...</div>
          ) : doctors.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No doctor accounts found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b text-left">
                    <th className="px-4 py-3 font-semibold text-slate-600">Name</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Email</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Role</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Password Status</th>
                    <th className="px-4 py-3 font-semibold text-slate-600 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {doctors.map(doctor => (
                    <tr key={doctor.id} className="border-b last:border-b-0 hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{doctor.name}</td>
                      <td className="px-4 py-3 text-slate-600">{doctor.email}</td>
                      <td className="px-4 py-3 text-slate-600">{doctor.role}</td>
                      <td className="px-4 py-3">
                        {doctor.mustResetPassword ? (
                          <Badge variant="destructive">Reset required</Badge>
                        ) : (
                          <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50">OK</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={resettingId === doctor.id}
                          onClick={() => handleReset(doctor.id, doctor.name)}
                        >
                          {resettingId === doctor.id ? "Resetting..." : "Reset Password"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
