
import express, {
  Request,
  Response,
  NextFunction,
} from "express";

import { createRoleRoutes } from "./presentation/routes/roleRoutes";
import { createAuthRoutes } from "./presentation/routes/authRoutes";
import { createUserRoutes } from "./presentation/routes/userRoutes";
import { createProjectRoutes } from "./presentation/routes/projectRoutes";
import { createTaskRoutes } from "./presentation/routes/taskRoutes";
import { createDiscussionRoutes } from "./presentation/routes/discussionRoutes";
import { createNotificationRoutes } from "./presentation/routes/notificationRoutes";

import { container } from "./config/container";

const app = express();

// ==========================================
// JSON Body Middleware
// ==========================================
app.use(express.json());

// ==========================================
// Health Check Endpoint
// ==========================================
app.get("/api/health", (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "Smart Task Management API is running",
  });
});

// ==========================================
// Role API Routes
// ==========================================
app.use(
  "/api/roles",
  createRoleRoutes(
    container.roleController,
    container.tokenService,
    container.userRepository
  )
);

// ==========================================
// Authentication API Routes
// ==========================================
app.use(
  "/api/auth",
  createAuthRoutes(
    container.authController,
    container.tokenService,
    container.userRepository
  )
);

// ==========================================
// User API Routes
// ==========================================
app.use(
  "/api/users",
  createUserRoutes(
    container.userController,
    container.tokenService,
    container.userRepository
  )
);

// ==========================================
// Project API Routes
// ==========================================
app.use(
  "/api/projects",
  createProjectRoutes(
    container.projectController,
    container.tokenService,
    container.userRepository
  )
);

// ==========================================
// Task API Routes
// ==========================================
app.use(
  "/api/tasks",
  createTaskRoutes(
    container.taskController,
    container.tokenService,
    container.userRepository
  )
);

// Discussion endpoints have their own authentication and per-project authorization.
app.use("/api/projects", createDiscussionRoutes(container.discussionController, container.tokenService, container.userRepository));
app.use("/api/notifications", createNotificationRoutes(container.notificationRepository, container.tokenService, container.userRepository));

// ==========================================
// 404 - Route Not Found
// ==========================================
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: "API endpoint not found",
  });
});

// ==========================================
// Global Error Handler
// ==========================================
app.use((
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {

  // ========================================
  // MALFORMED JSON BODY
  // ========================================
  // Express JSON parser generates a
  // SyntaxError with type "entity.parse.failed"
  // when incoming JSON is invalid.

  const bodyParserError = err as Error & {
    status?: number;
    type?: string;
  };

  if (
    err instanceof SyntaxError &&
    bodyParserError.status === 400 &&
    bodyParserError.type === "entity.parse.failed"
  ) {
    res.status(400).json({
      success: false,
      message: "Invalid JSON request body",
    });

    return;
  }

  // ========================================
  // OTHER UNEXPECTED ERRORS
  // ========================================
  console.error("Unhandled error:", err);

  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

export default app;
