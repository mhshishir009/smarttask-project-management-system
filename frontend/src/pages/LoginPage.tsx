
import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import axios from "axios";

import {
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ArrowRight,
  LoaderCircle,
  LifeBuoy,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import AuthShell from "../components/auth/AuthShell";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  // Show the success message after signup (or the existing password-change redirect).
  const notice = typeof location.state?.message === "string" ? location.state.message : "";
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(email.trim(), password);
      setPassword("");
      navigate("/dashboard", { replace: true });
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(
          err.response?.data?.message ||
          "Login failed. Check your email and password."
        );
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell mode="login" title="Welcome back." description="A clear view of your work is one sign in away.">
          {notice && (
            <div role="status" className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {notice}
            </div>
          )}
          {error && (
            <div
              role="alert"
              className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="space-y-5"
          >
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Email Address
              </label>
              <div className="relative">
                <Mail
                  size={18}
                  className="absolute left-3 top-3.5 text-slate-400"
                />
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  placeholder="Enter your email"
                  className="w-full rounded-lg border border-slate-300 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Password
              </label>
              <div className="relative">
                <LockKeyhole
                  size={18}
                  className="absolute left-3 top-3.5 text-slate-400"
                />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  placeholder="Enter your password"
                  className="w-full rounded-lg border border-slate-300 py-3 pl-10 pr-12 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
                <button
                  type="button"
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                  onClick={() =>
                    setShowPassword((current) => !current)
                  }
                  className="absolute right-3 top-3 text-slate-500 hover:text-slate-700"
                >
                  {showPassword ? (
                    <EyeOff size={19} />
                  ) : (
                    <Eye size={19} />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <LoaderCircle
                    size={18}
                    className="animate-spin"
                  />
                  Signing in...
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <div className="auth-help"><LifeBuoy size={14} aria-hidden="true" /><p><strong>Forgot your password?</strong>Contact your workspace administrator for help with account access.</p></div>

          <div className="mt-6 border-t border-slate-100 pt-5 text-center">
            <p className="auth-account-switch mb-3 text-sm text-slate-500">
              Need an account? <Link to="/register" className="font-medium text-blue-600 hover:text-blue-700">Register</Link>
            </p>
            <p className="text-xs text-slate-500">
              Access is available to authorized team members only.
            </p>
          </div>
        <div className="auth-secondary">
          <Link
            to="/dashboard"
            className="text-sm text-slate-500 hover:text-blue-600"
          >
            Preview Dashboard
          </Link>
        </div>
    </AuthShell>
  );
}
