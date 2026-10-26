import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { Eye, EyeOff, LoaderCircle, ArrowRight } from "lucide-react";
import api from "../services/api";
import AuthShell from "../components/auth/AuthShell";

// The shared auth shell changes presentation only; privileges remain assigned by the backend.
export default function RegisterPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;
    setError("");
    if (!fullName.trim() || !email.trim() || !password.trim()) {
      setError("Full name, email and password are required.");
      return;
    }
    if (password.length < 12) {
      setError("Password must contain at least 12 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      // Never send role IDs, administrative flags or confirmation passwords to signup.
      await api.post("/auth/register", { fullName: fullName.trim(), email: email.trim().toLowerCase(), password });
      setPassword("");
      setConfirmPassword("");
      navigate("/login", { replace: true, state: { message: "Registration successful. Please sign in with your new account." } });
    } catch (err: unknown) {
      setError(axios.isAxiosError(err)
        ? err.response?.data?.message || "Unable to register. Please try again."
        : "Unable to register. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell mode="register" title="Create your account." description="Join your team and bring a little more clarity to your work.">
          {error && <div role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          <form onSubmit={event => void handleSubmit(event)} className="space-y-5">
            <div>
              <label htmlFor="register-name" className="mb-2 block text-sm font-medium text-slate-700">Full Name</label>
              <input id="register-name" required maxLength={150} autoComplete="name" value={fullName} onChange={event => setFullName(event.target.value)} disabled={loading} className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
            </div>
            <div>
              <label htmlFor="register-email" className="mb-2 block text-sm font-medium text-slate-700">Email Address</label>
              <input id="register-email" type="email" required maxLength={255} autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} disabled={loading} className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
            </div>
            <div>
              <label htmlFor="register-password" className="mb-2 block text-sm font-medium text-slate-700">Password</label>
              <div className="relative">
                <input id="register-password" type={showPassword ? "text" : "password"} required minLength={12} autoComplete="new-password" aria-describedby="register-password-help" value={password} onChange={event => setPassword(event.target.value)} disabled={loading} className="w-full rounded-lg border border-slate-300 py-3 pl-4 pr-12 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(current => !current)} className="absolute right-3 top-3 text-slate-500 hover:text-slate-700">{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button>
              </div>
              <p id="register-password-help" className="mt-2 text-xs text-slate-500">Use at least 12 characters.</p>
            </div>
            <div>
              <label htmlFor="register-confirm-password" className="mb-2 block text-sm font-medium text-slate-700">Confirm Password</label>
              <input id="register-confirm-password" type={showPassword ? "text" : "password"} required minLength={12} autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} disabled={loading} className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
            </div>
            <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
              {loading ? <><LoaderCircle size={18} className="animate-spin" />Registering...</> : <>Register<ArrowRight size={18} /></>}
            </button>
          </form>
          <div className="mt-6 border-t border-slate-100 pt-5 text-center"><p className="auth-account-switch text-sm text-slate-500">Already have an account? <Link to="/login" className="font-medium text-blue-600 hover:text-blue-700">Sign In</Link></p></div>
    </AuthShell>
  );
}
