
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
} from "react-router-dom";

import { useAuth } from "./context/AuthContext";
import { AuthProvider } from "./context/AuthProvider";

import MainLayout from "./components/layout/MainLayout";

import DashboardPage from "./pages/DashboardPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ProjectsPage from "./pages/ProjectsPage";
import TasksPage from "./pages/TasksPage";
import MyTasksPage from "./pages/MyTasksPage";
import UsersPage from "./pages/UsersPage";
import RolesPage from "./pages/RolesPage";
import ChangePasswordPage from "./pages/ChangePasswordPage";

// ==========================================
// 1. PROTECTED ROUTE
// ==========================================

function ProtectedRoute() {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.mustChangePassword) {
    return (
      <Navigate
        to="/change-password"
        replace
      />
    );
  }

  return <Outlet />;
}

// ==========================================
// 2. ADMIN ONLY ROUTE
// ==========================================

function AdminRoute() {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role !== "ADMIN") {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}

// ==========================================
// 3. LOGIN ROUTE
// ==========================================

function LoginRoute({ register = false }: { register?: boolean }) {
  const { isAuthenticated, user } = useAuth();

  if (isAuthenticated) {
    return (
      <Navigate
        to={
          user?.mustChangePassword
            ? "/change-password"
            : "/dashboard"
        }
        replace
      />
    );
  }

  return register ? <RegisterPage /> : <LoginPage />;
}

// ==========================================
// 4. CHANGE PASSWORD ROUTE
// ==========================================

function ChangePasswordRoute() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <ChangePasswordPage />;
}

// ==========================================
// 5. APPLICATION ROUTER
// ==========================================

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* PUBLIC LOGIN */}
          <Route
            path="/login"
            element={<LoginRoute />}
          />

          {/* Signup shares the login guard so existing sessions keep their normal redirect. */}
          <Route path="/register" element={<LoginRoute register />} />

          {/* CHANGE PASSWORD */}
          <Route
            path="/change-password"
            element={<ChangePasswordRoute />}
          />

          {/* AUTHENTICATED ROUTES */}
          <Route element={<ProtectedRoute />}>
            <Route
              path="/"
              element={
                <Navigate
                  to="/dashboard"
                  replace
                />
              }
            />

            {/* MAIN APPLICATION LAYOUT */}
            <Route element={<MainLayout />}>
              {/* SHARED PAGES */}
              <Route
                path="/dashboard"
                element={<DashboardPage />}
              />

              <Route
                path="/projects"
                element={<ProjectsPage />}
              />

              {/* ADMIN ONLY */}
              <Route element={<AdminRoute />}>
                <Route
                  path="/tasks"
                  element={<TasksPage />}
                />

                <Route
                  path="/users"
                  element={<UsersPage />}
                />

                <Route
                  path="/roles"
                  element={<RolesPage />}
                />
              </Route>

              {/* TEAM MEMBER TASKS */}
              <Route
                path="/my-tasks"
                element={<MyTasksPage />}
              />
            </Route>
          </Route>

          {/* FALLBACK */}
          <Route
            path="*"
            element={<Navigate to="/" replace />}
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
