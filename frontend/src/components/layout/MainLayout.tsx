


import {
  Outlet,
  useLocation,
  useNavigate,
  Link,
} from "react-router-dom";

import {
  Menu,
  UserCircle,
  ChevronDown,
  LockKeyhole,
  LogOut,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import Sidebar from "./Sidebar";
import WorkspaceSearch from "./WorkspaceSearch";
import NotificationBell from "./NotificationBell";
import { useAuth } from "../../context/AuthContext";

export default function MainLayout() {
  const [sidebarOpen, setSidebarOpen] =
    useState(false);

  const [profileOpen, setProfileOpen] =
    useState(false);

  const [accountOpen, setAccountOpen] =
    useState(false);

  const location = useLocation();
  const navigate = useNavigate();

  const { user, logout } = useAuth();

  const profileRef = useRef<HTMLDivElement>(null);

  const role = user?.role ?? "TEAM_MEMBER";

  const roleLabel =
    role === "ADMIN"
      ? "Administrator"
      : "Team Member";

  // ==========================================
  // PAGE TITLES
  // ==========================================

  const pageTitles: Record<string, string> = {
    "/dashboard": "Dashboard",
    "/projects": "Projects",
    "/tasks": "Task Management",
    "/my-tasks": "My Tasks",
    "/users": "User Management",
    "/roles": "Role Management",
  };

  const pageTitle =
    pageTitles[location.pathname] ?? "Workspace";

  // ==========================================
  // CLOSE PROFILE MENU ON OUTSIDE CLICK
  // ==========================================

  useEffect(() => {
    const handleOutsideClick = (
      event: MouseEvent
    ) => {
      if (
        profileRef.current &&
        !profileRef.current.contains(
          event.target as Node
        )
      ) {
        setProfileOpen(false);
      }
    };

    document.addEventListener(
      "mousedown",
      handleOutsideClick
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick
      );
    };
  }, []);

  // ==========================================
  // CLOSE MENUS ON ROUTE CHANGE
  // ==========================================

  // Reset only menu state when the route changes.
  const [menuPathname, setMenuPathname] =
    useState(location.pathname);

  if (menuPathname !== location.pathname) {
    setMenuPathname(location.pathname);
    setProfileOpen(false);
    setSidebarOpen(false);
    setAccountOpen(false);
  }

  // ==========================================
  // LOGOUT
  // ==========================================

  const handleLogout = () => {
    setProfileOpen(false);
    setAccountOpen(false);

    logout();

    navigate("/login", {
      replace: true,
    });
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* DESKTOP SIDEBAR */}
      <div className="hidden lg:block">
        <Sidebar role={role} />
      </div>

      {/* MOBILE SIDEBAR */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close sidebar"
            onClick={() =>
              setSidebarOpen(false)
            }
            className="absolute inset-0 bg-slate-900/50"
          />

          <div className="relative h-full w-64">
            <Sidebar role={role} />
          </div>
        </div>
      )}

      {/* MAIN AREA */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* HEADER */}
        <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-slate-200 bg-white px-5 lg:px-8">
          {/* LEFT SIDE */}
          <div className="flex min-w-0 items-center gap-4">
            <button
              type="button"
              aria-label="Open sidebar"
              onClick={() =>
                setSidebarOpen(true)
              }
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            >
              <Menu size={23} />
            </button>

            <div className="min-w-0">
              <h2 className="truncate text-xl font-bold text-slate-900">
                {pageTitle}
              </h2>

              <p className="hidden text-xs text-slate-500 sm:block">
                Smart Task & Project Management System
              </p>
            </div>
          </div>

          {/* RIGHT SIDE */}
          <div className="flex shrink-0 items-center gap-3 sm:gap-4">
            {/* Workspace search */}
            <WorkspaceSearch
              key={location.pathname + location.search}
            />

            {/* NOTIFICATION ICON */}
            <NotificationBell key={user?.userId} />

            {/* PROFILE MENU */}
            <div
              ref={profileRef}
              className="relative border-l border-slate-200 pl-3 sm:pl-4"
            >
              <button
                type="button"
                aria-label="Open account menu"
                aria-expanded={profileOpen}
                aria-haspopup="menu"
                onClick={() =>
                  setProfileOpen(
                    (previous) => !previous
                  )
                }
                className="flex items-center gap-2 rounded-lg p-1.5 text-left transition hover:bg-slate-100"
              >
                <UserCircle
                  size={31}
                  className="text-blue-600"
                />

                <div className="hidden sm:block">
                  <p className="text-sm font-semibold text-slate-800">
                    {roleLabel}
                  </p>

                  {/* Display the signed-in email instead of the user ID. */}
                  <p
                    className="text-xs text-slate-500"
                    title={user?.email}
                  >
                    {user?.email ?? "—"}
                  </p>
                </div>

                <ChevronDown
                  size={16}
                  className={`hidden text-slate-500 transition-transform sm:block ${
                    profileOpen
                      ? "rotate-180"
                      : ""
                  }`}
                />
              </button>

              {/* PROFILE DROPDOWN */}
              {profileOpen && (
                <div
                  role="menu"
                  aria-label="Account options"
                  className="absolute right-0 top-full z-50 mt-3 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
                >
                  {/* ACCOUNT SUMMARY */}
                  <div className="border-b border-slate-100 bg-slate-50 px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="rounded-full bg-blue-100 p-2 text-blue-700">
                        <UserRound size={21} />
                      </div>

                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">
                          {roleLabel}
                        </p>

                        {/* Show email instead of the account number. */}
                        <p className="break-all text-xs text-slate-500">
                          {user?.email ?? "—"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* MENU ITEMS */}
                  <div className="p-2">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setProfileOpen(false);
                        setAccountOpen(true);
                      }}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm text-slate-700 hover:bg-slate-100"
                    >
                      <UserRound size={18} />
                      My Account
                    </button>

                    <Link
                      role="menuitem"
                      to="/change-password"
                      onClick={() =>
                        setProfileOpen(false)
                      }
                      className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                    >
                      <LockKeyhole size={18} />
                      Change Password
                    </Link>
                  </div>

                  <div className="border-t border-slate-100 p-2">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium text-red-600 hover:bg-red-50"
                    >
                      <LogOut size={18} />
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* PAGE CONTENT */}
        <main className="flex-1 p-5 lg:p-8">
          {/* Reset page-local state when a search result changes the URL. */}
          <Outlet
            key={location.pathname + location.search}
          />
        </main>
      </div>

      {/* MY ACCOUNT MODAL */}
      {accountOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/50 px-4 py-8">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-title"
            className="w-full max-w-md rounded-2xl bg-white shadow-xl"
          >
            {/* MODAL HEADER */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <h2
                id="account-title"
                className="text-xl font-bold text-slate-900"
              >
                My Account
              </h2>

              <button
                type="button"
                onClick={() =>
                  setAccountOpen(false)
                }
                aria-label="Close account details"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            {/* ACCOUNT INFORMATION */}
            <div className="space-y-5 p-6">
              <div className="flex items-center gap-4">
                <div className="rounded-full bg-blue-50 p-4 text-blue-600">
                  <UserCircle size={35} />
                </div>

                <div>
                  <p className="font-semibold text-slate-900">
                    {roleLabel}
                  </p>

                  <p className="text-sm text-slate-500">
                    SmartTask Account
                  </p>
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                {/* Display email in account details instead of the internal user ID. */}
                <div className="mb-4">
                  <p className="text-xs text-slate-500">
                    Email Address
                  </p>

                  <p className="mt-1 break-all font-semibold text-slate-900">
                    {user?.email ?? "—"}
                  </p>
                </div>

                <div className="mb-4">
                  <p className="text-xs text-slate-500">
                    Role
                  </p>

                  <div className="mt-1 flex items-center gap-2">
                    <ShieldCheck
                      size={17}
                      className="text-blue-600"
                    />

                    <p className="font-semibold text-slate-900">
                      {role}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-slate-500">
                    Account Status
                  </p>

                  <p className="mt-1 text-sm font-semibold text-emerald-700">
                    Authenticated Session
                  </p>
                </div>
              </div>

              <Link
                to="/change-password"
                onClick={() =>
                  setAccountOpen(false)
                }
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700"
              >
                <LockKeyhole size={17} />
                Change Password
              </Link>

              <button
                type="button"
                onClick={() =>
                  setAccountOpen(false)
                }
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
