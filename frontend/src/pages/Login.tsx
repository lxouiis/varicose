import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "@/store/useStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const login = useStore(state => state.login);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const success = await login(email, password);
      if (success) {
        navigate("/");
      } else {
        setError("Invalid email or password");
      }
    } catch (err) {
      setError("Server error. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4 font-sans">
      <Card className="w-full max-w-[450px] shadow-sm border border-gray-200 bg-white pt-10 pb-6 px-4">
        <div className="flex flex-col items-center text-center space-y-4 mb-8">
          <img
            src={`${import.meta.env.BASE_URL}kle-logo.png`}
            alt="KLE Tech"
            className="h-14 object-contain"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
          <p className="text-base text-gray-600">
            Sign in
          </p>
        </div>

        <CardContent>
          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="bg-red-50 text-red-600 text-sm font-medium p-3 rounded-md text-center">
                {error}
              </div>
            )}

            <div className="space-y-1">
              <Label htmlFor="email" className="sr-only">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Email or phone"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="h-12 text-base px-4 bg-transparent border-gray-300 focus-visible:ring-1 focus-visible:ring-[#1a6b5c] focus-visible:border-[#1a6b5c]"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="password" className="sr-only">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="h-12 text-base px-4 bg-transparent border-gray-300 focus-visible:ring-1 focus-visible:ring-[#1a6b5c] focus-visible:border-[#1a6b5c]"
              />
            </div>

            <div className="flex items-center justify-end pt-4">
              <Button
                type="submit"
                disabled={loading}
                className="bg-[#1a6b5c] hover:bg-[#134d42] text-white px-8 h-10 rounded-md font-medium px-6 py-2 transition-colors disabled:opacity-50"
                size="lg"
              >
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
