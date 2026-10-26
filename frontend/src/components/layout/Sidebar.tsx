
import {
  LayoutDashboard,
  FolderKanban,
  ListTodo,
  Users,
  ShieldCheck,
  LogOut,
  ClipboardCheck,
} from "lucide-react";

import {
  NavLink,
  useNavigate,
} from "react-router-dom";

import { useAuth } from "../../context/AuthContext";

type SidebarProps = {
  role: "ADMIN" | "TEAM_MEMBER";
};

export default function Sidebar({
  role,
}: SidebarProps) {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const navigation = [
    {
      name: "Dashboard",
      path: "/dashboard",
      icon: LayoutDashboard,
      roles: ["ADMIN", "TEAM_MEMBER"],
    },
    {
      name: "Projects",
      path: "/projects",
      icon: FolderKanban,
      roles: ["ADMIN", "TEAM_MEMBER"],
    },
    {
      name: "Tasks",
      path: "/tasks",
      icon: ListTodo,
      roles: ["ADMIN"],
    },
    {
      name: "My Tasks",
      path: "/my-tasks",
      icon: ClipboardCheck,
      roles: ["TEAM_MEMBER"],
    },
    {
      name: "Users",
      path: "/users",
      icon: Users,
      roles: ["ADMIN"],
    },
    {
      name: "Roles",
      path: "/roles",
      icon: ShieldCheck,
      roles: ["ADMIN"],
    },
  ];

  const handleLogout = () => {
    // Remove authentication state and stored JWT.
    logout();

    // Redirect user to login page.
    navigate("/login", {
      replace: true,
    });
  };

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
      {/* BRAND */}
      <div className="border-b border-slate-200 px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white">
            <ClipboardCheck size={23} />
          </div>

          <div>
            <h1 className="text-base font-bold text-slate-900">
              SmartTask
            </h1>

            <p className="text-xs text-slate-500">
              Project Management
            </p>
          </div>
        </div>
      </div>

      {/* NAVIGATION HEADING */}
      <div className="px-4 pt-6">
        <p className="px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Workspace
        </p>
      </div>

      {/* ROLE BASED NAVIGATION */}
      <nav className="mt-3 flex-1 space-y-1 px-4">
        {navigation
          .filter((item) =>
            item.roles.includes(role)
          )
          .map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  [
                    "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-blue-50 text-blue-700"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                  ].join(" ")
                }
              >
                <Icon size={19} />
                <span>{item.name}</span>
              </NavLink>
            );
          })}
      </nav>

      {/* USER INFORMATION AND LOGOUT */}
      <div className="border-t border-slate-200 p-4">
        <div className="mb-4 rounded-xl bg-slate-50 p-3">
          <p className="text-xs text-slate-500">
            Signed in as
          </p>

          <p className="mt-1 text-sm font-semibold text-slate-800">
            {role === "ADMIN"
              ? "Administrator"
              : "Team Member"}
          </p>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-red-600 transition hover:bg-red-50"
        >
          <LogOut size={19} />
          Logout
        </button>
      </div>
    </aside>
  );
}
