
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  LockKeyhole,
  Eye,
  EyeOff,
  LoaderCircle,
  ShieldCheck,
  LogOut,
} from "lucide-react";

import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import AuthShell from "../components/auth/AuthShell";

export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [currentPassword, setCurrentPassword] =
    useState("");

  const [newPassword, setNewPassword] =
    useState("");

  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [showCurrent, setShowCurrent] =
    useState(false);

  const [showNew, setShowNew] =
    useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    setError("");

    if (!currentPassword || !newPassword) {
      setError("All password fields are required.");
      return;
    }

    if (newPassword.length < 12) {
      setError(
        "New password must contain at least 12 characters."
      );
      return;
    }

    if (currentPassword === newPassword) {
      setError(
        "New password must be different from current password."
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      await api.post("/auth/change-password", {
        currentPassword,
        newPassword,
      });

      // Backend requires a fresh login after
      // the password has been changed.
      logout();

      navigate("/login", {
        replace: true,
        state: {
          message:
            "Password changed successfully. Please login with your new password.",
        },
      });
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(
          err.response?.data?.message ??
            "Unable to change password."
        );
      } else {
        setError(
          "Something went wrong. Please try again."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell mode="security" title="Change your password." description="Update your password to keep your SmartTask account protected.">
        <div className="mt-6 flex items-center gap-2 rounded-lg bg-blue-50 p-3 text-sm text-blue-700">
          <ShieldCheck size={19} />
          Your new password must contain at least
          12 characters.
        </div>

        {error && (
          <div
            role="alert"
            className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        <form
          onSubmit={(event) => void handleSubmit(event)}
          className="mt-6 space-y-5"
        >
          <div>
            <label
              htmlFor="current-password"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Current Password
            </label>

            <div className="relative">
              <input
                id="current-password"
                type={showCurrent ? "text" : "password"}
                required
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) =>
                  setCurrentPassword(event.target.value)
                }
                placeholder="Enter current password"
                className="w-full rounded-lg border border-slate-300 px-4 py-3 pr-12 text-sm outline-none focus:border-blue-500"
              />

              <button
                type="button"
                onClick={() =>
                  setShowCurrent((value) => !value)
                }
                aria-label={
                  showCurrent
                    ? "Hide current password"
                    : "Show current password"
                }
                className="absolute right-3 top-3 text-slate-500"
              >
                {showCurrent ? (
                  <EyeOff size={19} />
                ) : (
                  <Eye size={19} />
                )}
              </button>
            </div>
          </div>

          <div>
            <label
              htmlFor="new-password"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              New Password
            </label>

            <div className="relative">
              <input
                id="new-password"
                type={showNew ? "text" : "password"}
                required
                minLength={12}
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) =>
                  setNewPassword(event.target.value)
                }
                placeholder="Minimum 12 characters"
                className="w-full rounded-lg border border-slate-300 px-4 py-3 pr-12 text-sm outline-none focus:border-blue-500"
              />

              <button
                type="button"
                onClick={() =>
                  setShowNew((value) => !value)
                }
                aria-label={
                  showNew
                    ? "Hide new password"
                    : "Show new password"
                }
                className="absolute right-3 top-3 text-slate-500"
              >
                {showNew ? (
                  <EyeOff size={19} />
                ) : (
                  <Eye size={19} />
                )}
              </button>
            </div>
          </div>

          <div>
            <label
              htmlFor="confirm-password"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Confirm New Password
            </label>

            <input
              id="confirm-password"
              type="password"
              required
              minLength={12}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) =>
                setConfirmPassword(event.target.value)
              }
              placeholder="Re-enter new password"
              className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? (
              <>
                <LoaderCircle
                  size={18}
                  className="animate-spin"
                />
                Updating Password...
              </>
            ) : (
              <>
                <LockKeyhole size={18} />
                Change Password
              </>
            )}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            logout();
            navigate("/login", { replace: true });
          }}
          className="mt-5 flex w-full items-center justify-center gap-2 py-2 text-sm font-medium text-slate-500 hover:text-red-600"
        >
          <LogOut size={17} />
          Logout
        </button>
    </AuthShell>
  );
}
