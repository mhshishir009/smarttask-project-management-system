
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import axios from "axios";

import {
  ShieldCheck,
  Shield,
  Users,
  RefreshCw,
  Search,
  X,
  LoaderCircle,
  Eye,
} from "lucide-react";

import api from "../services/api";

// ==========================================
// ROLE TYPE
// ==========================================

interface Role {
  roleId: number;
  roleCode?: string;
  code?: string;
  roleName?: string;
  name?: string;
  description?: string | null;
}

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
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

function getRoleCode(role: Role): string {
  return (
    role.roleCode ??
    role.code ??
    role.roleName ??
    role.name ??
    `Role #${role.roleId}`
  );
}

function getRoleDescription(role: Role): string {
  if (role.description) {
    return role.description;
  }

  const code = getRoleCode(role);

  if (code === "ADMIN") {
    return "Administrator with management permissions for users, projects and tasks.";
  }

  if (code === "TEAM_MEMBER") {
    return "Team member with access to assigned tasks and permitted project information.";
  }

  return "System role.";
}

// ==========================================
// ROLES PAGE
// ==========================================

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const [selectedRole, setSelectedRole] =
    useState<Role | null>(null);

  const [detailsLoading, setDetailsLoading] =
    useState(false);

  const [detailsError, setDetailsError] =
    useState("");

  // ==========================================
  // LOAD ALL ROLES
  // ==========================================

  const fetchRoles = useCallback(() => {
    // Apply loading results only after the API request completes.
    return api.get("/roles").then((response) => {
      const payload = response.data?.data;
      if (!Array.isArray(payload)) throw new Error("Unexpected role API response.");
      setRoles(payload as Role[]);
    }).catch((err: unknown) => {
      setError(getErrorMessage(err, "Unable to load roles."));
    }).finally(() => { setLoading(false); });
  }, []);

  // Keep refresh feedback in the user action, outside the initial loading effect.
  const loadRoles = useCallback(() => {
    setLoading(true);
    setError("");
    return fetchRoles();
  }, [fetchRoles]);

  useEffect(() => {
    void fetchRoles();
  }, [fetchRoles]);

  // ==========================================
  // FILTER ROLES
  // ==========================================

  const filteredRoles = useMemo(() => {
    const query = search.trim().toLowerCase();

    return roles.filter((role) => {
      return (
        getRoleCode(role)
          .toLowerCase()
          .includes(query) ||
        String(role.roleId).includes(query)
      );
    });
  }, [roles, search]);

  // ==========================================
  // GET ROLE DETAILS
  // ==========================================

  const handleViewDetails = async (role: Role) => {
    setSelectedRole(role);
    setDetailsLoading(true);
    setDetailsError("");

    try {
      const response = await api.get(
        `/roles/${role.roleId}`
      );

      const payload = response.data?.data;

      if (
        !payload ||
        typeof payload !== "object"
      ) {
        throw new Error(
          "Unexpected role details response."
        );
      }

      setSelectedRole(payload as Role);
    } catch (err: unknown) {
      setDetailsError(
        getErrorMessage(
          err,
          "Unable to load role details."
        )
      );
    } finally {
      setDetailsLoading(false);
    }
  };

  const closeDetails = () => {
    if (detailsLoading) return;

    setSelectedRole(null);
    setDetailsError("");
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* PAGE HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Role Management
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            View system roles and access levels.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadRoles()}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw size={17} />
          Refresh
        </button>
      </div>

      {/* STATISTICS */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">
              Total Roles
            </p>
            <ShieldCheck
              size={22}
              className="text-blue-600"
            />
          </div>

          <p className="mt-3 text-3xl font-bold text-slate-900">
            {loading ? "—" : roles.length}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">
              Administrator Roles
            </p>
            <Shield
              size={22}
              className="text-violet-600"
            />
          </div>

          <p className="mt-3 text-3xl font-bold text-slate-900">
            {loading
              ? "—"
              : roles.filter(
                  (role) =>
                    getRoleCode(role) === "ADMIN"
                ).length}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">
              Team Member Roles
            </p>
            <Users
              size={22}
              className="text-emerald-600"
            />
          </div>

          <p className="mt-3 text-3xl font-bold text-slate-900">
            {loading
              ? "—"
              : roles.filter(
                  (role) =>
                    getRoleCode(role) ===
                    "TEAM_MEMBER"
                ).length}
          </p>
        </div>
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
          placeholder="Search roles by code or ID"
          className="w-full rounded-lg border border-slate-200 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-blue-500"
        />
      </div>

      {/* ERROR */}
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {/* ROLE CARDS */}
      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-500">
          Loading roles...
        </div>
      ) : filteredRoles.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <ShieldCheck
            size={36}
            className="mx-auto text-slate-400"
          />

          <h2 className="mt-4 font-semibold text-slate-800">
            No roles found
          </h2>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {filteredRoles.map((role) => {
            const roleCode = getRoleCode(role);

            const isAdmin = roleCode === "ADMIN";

            return (
              <article
                key={role.roleId}
                className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div
                    className={`rounded-xl p-3 ${
                      isAdmin
                        ? "bg-violet-50 text-violet-600"
                        : "bg-blue-50 text-blue-600"
                    }`}
                  >
                    {isAdmin ? (
                      <Shield size={24} />
                    ) : (
                      <Users size={24} />
                    )}
                  </div>

                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                    Role #{role.roleId}
                  </span>
                </div>

                <h2 className="mt-5 text-lg font-bold text-slate-900">
                  {roleCode}
                </h2>

                <p className="mt-2 min-h-12 text-sm leading-relaxed text-slate-500">
                  {getRoleDescription(role)}
                </p>

                <div className="mt-5 border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    onClick={() =>
                      void handleViewDetails(role)
                    }
                    className="flex items-center gap-2 rounded-lg border border-blue-200 px-4 py-2.5 text-sm font-medium text-blue-700 hover:bg-blue-50"
                  >
                    <Eye size={17} />
                    View Details
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* ROLE DETAILS MODAL */}
      {selectedRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-8">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="role-details-title"
            className="w-full max-w-lg rounded-2xl bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <h2
                id="role-details-title"
                className="text-xl font-bold text-slate-900"
              >
                Role Details
              </h2>

              <button
                type="button"
                disabled={detailsLoading}
                onClick={closeDetails}
                aria-label="Close role details"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-5 p-6">
              {detailsLoading ? (
                <div className="flex items-center justify-center gap-2 py-8 text-slate-500">
                  <LoaderCircle
                    size={20}
                    className="animate-spin"
                  />
                  Loading role details...
                </div>
              ) : (
                <>
                  {detailsError && (
                    <div
                      role="alert"
                      className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                    >
                      {detailsError}
                    </div>
                  )}

                  <div>
                    <p className="text-xs text-slate-500">
                      Role ID
                    </p>

                    <p className="mt-1 font-semibold text-slate-900">
                      #{selectedRole.roleId}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500">
                      Role Code
                    </p>

                    <p className="mt-1 font-semibold text-slate-900">
                      {getRoleCode(selectedRole)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500">
                      Description
                    </p>

                    <p className="mt-1 text-sm text-slate-700">
                      {getRoleDescription(selectedRole)}
                    </p>
                  </div>

                  <div className="border-t border-slate-100 pt-4">
                    <p className="text-xs text-slate-500">
                      Management Access
                    </p>

                    <p className="mt-1 text-sm text-slate-700">
                      Role assignments are managed through
                      user creation and backend authorization.
                    </p>
                  </div>
                </>
              )}

              <button
                type="button"
                onClick={closeDetails}
                disabled={detailsLoading}
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
