
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";

import axios from "axios";
import { useSearchParams } from "react-router-dom";
import WorkspaceResultNotice from "../components/layout/WorkspaceResultNotice";

import {
  Users,
  UserRound,
  RefreshCw,
  Search,
  Plus,
  ShieldCheck,
  Pencil,
  UserX,
  X,
  LoaderCircle,
  Eye,
  EyeOff,
} from "lucide-react";

import api from "../services/api";
import { useAuth } from "../context/AuthContext";

// ==========================================
// TYPES
// ==========================================

interface User {
  userId: number;
  fullName?: string;
  name?: string;
  email?: string;
  roleId?: number;
  isActive?: boolean;
  mustChangePassword?: boolean;
}

type FormMode = "create" | "edit";

// ==========================================
// HELPERS
// ==========================================

function getErrorMessage(
  error: unknown,
  fallback: string
): string {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;

    if (typeof message === "string") {
      return message;
    }

    return fallback;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

function getUserName(user: User): string {
  return (
    user.fullName ??
    user.name ??
    user.email ??
    `User #${user.userId}`
  );
}

function getRoleName(roleId?: number): string {
  if (roleId === 1) return "ADMIN";
  if (roleId === 2) return "TEAM_MEMBER";

  return "Unknown";
}

// ==========================================
// USER MANAGEMENT PAGE
// ==========================================

export default function UsersPage() {
  const [searchParams] = useSearchParams();
  const selectedUserId = searchParams.get("workspaceUser");
  const { user: currentUser } = useAuth();

  const isAdmin = currentUser?.role === "ADMIN";

  // ==========================================
  // USER LIST STATE
  // ==========================================

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");

  // ==========================================
  // MODAL STATE
  // ==========================================

  const [showModal, setShowModal] = useState(false);
  const [formMode, setFormMode] =
    useState<FormMode>("create");

  const [selectedUser, setSelectedUser] =
    useState<User | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState("2");

  const [temporaryPassword, setTemporaryPassword] =
    useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [deactivatingId, setDeactivatingId] =
    useState<number | null>(null);

  // ==========================================
  // LOAD USERS
  // ==========================================

  const fetchUsers = useCallback(() => {
    // Preserve the admin guard while applying API results asynchronously.
    const request = isAdmin ? api.get("/users")
      : Promise.reject(new Error("Administrator access required."));
    return request.then((response) => {
      const payload = response.data?.data;
      if (!Array.isArray(payload)) throw new Error("Unexpected user API response.");
      setUsers(payload as User[]);
    }).catch((err: unknown) => {
      setError(getErrorMessage(err, "Unable to load users."));
    }).finally(() => { setLoading(false); });
  }, [isAdmin]);

  // Initial state already shows loading; explicit reloads retain the existing feedback.
  const loadUsers = useCallback(() => {
    setLoading(true);
    setError("");
    return fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  // ==========================================
  // FILTER USERS
  // ==========================================

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return users.filter((account) => {
      if (selectedUserId && account.userId !== Number(selectedUserId)) return false;
      return (
        getUserName(account)
          .toLowerCase()
          .includes(query) ||
        (account.email ?? "")
          .toLowerCase()
          .includes(query) ||
        String(account.userId).includes(query)
      );
    });
  }, [users, search, selectedUserId]);

  // ==========================================
  // USER STATISTICS
  // ==========================================

  const activeUsers = users.filter(
    (account) => account.isActive === true
  ).length;

  const inactiveUsers = users.filter(
    (account) => account.isActive === false
  ).length;

  // ==========================================
  // RESET FORM
  // ==========================================

  const resetForm = () => {
    setSelectedUser(null);
    setFullName("");
    setEmail("");
    setRoleId("2");
    setTemporaryPassword("");
    setShowPassword(false);
    setFormError("");
  };

  // ==========================================
  // OPEN CREATE FORM
  // ==========================================

  const openCreateForm = () => {
    if (!isAdmin) return;

    resetForm();
    setFormMode("create");
    setSuccess("");
    setShowModal(true);
  };

  // ==========================================
  // OPEN EDIT FORM
  // ==========================================

  const openEditForm = (account: User) => {
    if (!isAdmin || account.isActive === false) {
      return;
    }

    resetForm();

    setSelectedUser(account);
    setFormMode("edit");

    setFullName(
      account.fullName ?? account.name ?? ""
    );

    setEmail(account.email ?? "");

    setShowModal(true);
    setSuccess("");
  };

  // ==========================================
  // CLOSE FORM
  // ==========================================

  const closeForm = () => {
    if (saving) return;

    setShowModal(false);
    resetForm();
  };

  // ==========================================
  // CREATE / UPDATE USER
  // ==========================================

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    setFormError("");
    setSuccess("");

    if (!isAdmin) {
      setFormError(
        "Administrator access required."
      );
      return;
    }

    const nameValue = fullName.trim();
    const emailValue = email.trim().toLowerCase();

    if (!nameValue) {
      setFormError("Full name is required.");
      return;
    }

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        emailValue
      )
    ) {
      setFormError("Enter a valid email address.");
      return;
    }

    if (
      formMode === "create" &&
      temporaryPassword.length < 12
    ) {
      setFormError(
        "Temporary password must have at least 12 characters."
      );
      return;
    }

    if (
      formMode === "edit" &&
      selectedUser === null
    ) {
      setFormError("Please select a user.");
      return;
    }

    setSaving(true);

    try {
      if (formMode === "create") {
        await api.post("/users", {
          fullName: nameValue,
          email: emailValue,
          roleId: Number(roleId),
          temporaryPassword,
        });

        setSuccess(
          "User created successfully."
        );
      } else if (selectedUser) {
        await api.put(
          `/users/${selectedUser.userId}`,
          {
            fullName: nameValue,
            email: emailValue,
          }
        );

        setSuccess(
          "User updated successfully."
        );
      }

      setShowModal(false);
      resetForm();

      await loadUsers();
    } catch (err: unknown) {
      setFormError(
        getErrorMessage(
          err,
          "Unable to save user."
        )
      );
    } finally {
      setSaving(false);
    }
  };

  // ==========================================
  // DEACTIVATE USER
  // ==========================================

  const handleDeactivate = async (
    account: User
  ) => {
    if (
      !isAdmin ||
      account.isActive !== true ||
      deactivatingId !== null
    ) {
      return;
    }

    // Prevent accidental self-deactivation
    // from the interface.
    if (account.userId === currentUser?.userId) {
      setError(
        "You cannot deactivate your own account from this page."
      );
      return;
    }

    const confirmed = window.confirm(
      `Deactivate "${getUserName(account)}"?\n\n` +
      "This user will no longer be able to access the system."
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");
    setDeactivatingId(account.userId);

    try {
      await api.patch(
        `/users/${account.userId}/deactivate`
      );

      setSuccess(
        "User deactivated successfully."
      );

      await loadUsers();
    } catch (err: unknown) {
      setError(
        getErrorMessage(
          err,
          "Unable to deactivate user."
        )
      );
    } finally {
      setDeactivatingId(null);
    }
  };

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <WorkspaceResultNotice field="workspaceUser" />
      {/* PAGE HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            User Management
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Create, update and manage user accounts.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => void loadUsers()}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={17} />
            Refresh
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={openCreateForm}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <Plus size={17} />
              New User
            </button>
          )}
        </div>
      </div>

      {/* SUCCESS MESSAGE */}
      {success && (
        <div
          role="status"
          className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700"
        >
          {success}
        </div>
      )}

      {/* ERROR MESSAGE */}
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {/* USER STATISTICS */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          {
            label: "Total Users",
            count: users.length,
          },
          {
            label: "Active Users",
            count: activeUsers,
          },
          {
            label: "Inactive Users",
            count: inactiveUsers,
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <p className="text-sm text-slate-500">
              {stat.label}
            </p>

            <p className="mt-2 text-3xl font-bold text-slate-900">
              {loading ? "—" : stat.count}
            </p>
          </div>
        ))}
      </div>

      {/* SEARCH */}
      <div className="relative rounded-xl border border-slate-200 bg-white p-4">
        <Search
          size={18}
          className="absolute left-7 top-7 text-slate-400"
        />

        <input
          type="search"
          value={search}
          onChange={(event) =>
            setSearch(event.target.value)
          }
          placeholder="Search by name, email or user ID"
          className="w-full rounded-lg border border-slate-200 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-blue-500"
        />
      </div>

      {/* USER LIST */}
      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-500">
          Loading users...
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <Users
            size={36}
            className="mx-auto text-slate-400"
          />

          <h2 className="mt-4 font-semibold text-slate-800">
            No users found
          </h2>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[800px] text-left">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                {[
                  "User",
                  "Role",
                  "Status",
                  "User ID",
                  "Actions",
                ].map((heading) => (
                  <th
                    key={heading}
                    className="px-6 py-4 text-xs font-semibold uppercase text-slate-500"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {filteredUsers.map((account) => (
                <tr
                  key={account.userId}
                  className="border-b border-slate-100 last:border-0"
                >
                  {/* USER INFORMATION */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="rounded-full bg-blue-50 p-2.5 text-blue-600">
                        <UserRound size={19} />
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {getUserName(account)}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          {account.email ?? "No email"}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* ROLE */}
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1.5 text-sm text-slate-600">
                      <ShieldCheck size={16} />
                      {getRoleName(account.roleId)}
                    </span>
                  </td>

                  {/* STATUS */}
                  <td className="px-6 py-4">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        account.isActive === true
                          ? "bg-green-50 text-green-700"
                          : account.isActive === false
                            ? "bg-red-50 text-red-700"
                            : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {account.isActive === true
                        ? "Active"
                        : account.isActive === false
                          ? "Inactive"
                          : "Unknown"}
                    </span>
                  </td>

                  {/* USER ID */}
                  <td className="px-6 py-4 text-sm text-slate-500">
                    #{account.userId}
                  </td>

                  {/* ACTIONS */}
                  <td className="px-6 py-4">
                    {account.isActive === true ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            openEditForm(account)
                          }
                          className="inline-flex items-center gap-1 rounded-lg border border-blue-200 px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-50"
                        >
                          <Pencil size={14} />
                          Edit
                        </button>

                        {account.userId !==
                          currentUser?.userId && (
                          <button
                            type="button"
                            disabled={
                              deactivatingId !== null
                            }
                            onClick={() =>
                              void handleDeactivate(account)
                            }
                            className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                          >
                            {deactivatingId ===
                            account.userId ? (
                              <LoaderCircle
                                size={14}
                                className="animate-spin"
                              />
                            ) : (
                              <UserX size={14} />
                            )}
                            Deactivate
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">
                        No actions available
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* CREATE / EDIT USER MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-6">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="user-form-title"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl"
          >
            {/* MODAL HEADER */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h2
                  id="user-form-title"
                  className="text-xl font-bold text-slate-900"
                >
                  {formMode === "create"
                    ? "Create New User"
                    : "Edit User"}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {formMode === "create"
                    ? "Add a user to your workspace."
                    : `Update User #${selectedUser?.userId}`}
                </p>
              </div>

              <button
                type="button"
                disabled={saving}
                onClick={closeForm}
                aria-label="Close user form"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            {/* USER FORM */}
            <form
              onSubmit={(event) =>
                void handleSubmit(event)
              }
              className="space-y-5 p-6"
            >
              {formError && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                >
                  {formError}
                </div>
              )}

              {/* FULL NAME */}
              <div>
                <label
                  htmlFor="user-full-name"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Full Name *
                </label>

                <input
                  id="user-full-name"
                  type="text"
                  required
                  value={fullName}
                  onChange={(event) =>
                    setFullName(event.target.value)
                  }
                  placeholder="Enter full name"
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                />
              </div>

              {/* EMAIL */}
              <div>
                <label
                  htmlFor="user-email"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Email Address *
                </label>

                <input
                  id="user-email"
                  type="email"
                  required
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  placeholder="Enter email address"
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                />
              </div>

              {/* CREATE ONLY FIELDS */}
              {formMode === "create" && (
                <>
                  {/* ROLE */}
                  <div>
                    <label
                      htmlFor="user-role"
                      className="mb-2 block text-sm font-medium text-slate-700"
                    >
                      User Role *
                    </label>

                    <select
                      id="user-role"
                      value={roleId}
                      onChange={(event) =>
                        setRoleId(event.target.value)
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm"
                    >
                      <option value="2">
                        TEAM_MEMBER
                      </option>

                      <option value="1">
                        ADMIN
                      </option>
                    </select>
                  </div>

                  {/* TEMPORARY PASSWORD */}
                  <div>
                    <label
                      htmlFor="user-password"
                      className="mb-2 block text-sm font-medium text-slate-700"
                    >
                      Temporary Password *
                    </label>

                    <div className="relative">
                      <input
                        id="user-password"
                        type={
                          showPassword
                            ? "text"
                            : "password"
                        }
                        required
                        minLength={12}
                        autoComplete="new-password"
                        value={temporaryPassword}
                        onChange={(event) =>
                          setTemporaryPassword(
                            event.target.value
                          )
                        }
                        placeholder="At least 12 characters"
                        className="w-full rounded-lg border border-slate-300 px-4 py-3 pr-12 text-sm outline-none focus:border-blue-500"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setShowPassword(
                            (previous) => !previous
                          )
                        }
                        aria-label={
                          showPassword
                            ? "Hide password"
                            : "Show password"
                        }
                        className="absolute right-3 top-3 text-slate-500"
                      >
                        {showPassword ? (
                          <EyeOff size={19} />
                        ) : (
                          <Eye size={19} />
                        )}
                      </button>
                    </div>

                    <p className="mt-2 text-xs text-slate-500">
                      The new user may be required to change
                      this password at first login.
                    </p>
                  </div>
                </>
              )}

              {/* ACTION BUTTONS */}
              <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
                <button
                  type="button"
                  disabled={saving}
                  onClick={closeForm}
                  className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <LoaderCircle
                        size={17}
                        className="animate-spin"
                      />
                      Saving...
                    </>
                  ) : formMode === "create" ? (
                    <>
                      <Plus size={17} />
                      Create User
                    </>
                  ) : (
                    <>
                      <Pencil size={17} />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
