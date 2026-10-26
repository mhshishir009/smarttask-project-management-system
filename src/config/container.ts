
import { RoleRepository } from "../infrastructure/repositories/RoleRepository";
import { UserRepository } from "../infrastructure/repositories/UserRepository";
import { ProjectRepository } from "../infrastructure/repositories/ProjectRepository";
import { TaskRepository } from "../infrastructure/repositories/TaskRepository";

import { RoleService } from "../application/services/RoleService";
import { UserService } from "../application/services/UserService";
import { AuthService } from "../application/services/AuthService";
import { ProjectService } from "../application/services/ProjectService";
import { TaskService } from "../application/services/TaskService";

import { Argon2PasswordHasher } from "../infrastructure/security/Argon2PasswordHasher";
import { JwtTokenService } from "../infrastructure/security/JwtTokenService";

import { RoleController } from "../presentation/controllers/RoleController";
import { UserController } from "../presentation/controllers/UserController";
import { AuthController } from "../presentation/controllers/AuthController";
import { ProjectController } from "../presentation/controllers/ProjectController";
import { TaskController } from "../presentation/controllers/TaskController";
import { DiscussionRepository } from "../infrastructure/repositories/DiscussionRepository";
import { DiscussionService } from "../application/services/DiscussionService";
import { DiscussionController } from "../presentation/controllers/DiscussionController";
import { NotificationWriter } from "../infrastructure/repositories/NotificationWriter";
import { NotificationRepository } from "../infrastructure/repositories/NotificationRepository";

// ==========================================
// 1. REPOSITORY LAYER
// ==========================================

const roleRepository = new RoleRepository();

const userRepository = new UserRepository();

const notificationWriter = new NotificationWriter();
const projectRepository = new ProjectRepository(notificationWriter);

const taskRepository = new TaskRepository(notificationWriter);

// ==========================================
// 2. SECURITY LAYER
// ==========================================

const passwordHasher = new Argon2PasswordHasher();

const tokenService = new JwtTokenService();

// ==========================================
// 3. APPLICATION SERVICE LAYER
// ==========================================

const roleService = new RoleService(
  roleRepository
);

const userService = new UserService(
  userRepository,
  roleRepository,
  passwordHasher
);

const authService = new AuthService(
  userRepository,
  passwordHasher,
  tokenService,
  // Resolve the public signup role by code rather than accepting a client role ID.
  roleRepository
);

// ProjectService requires three repositories:
// 1. ProjectRepository
// 2. UserRepository
// 3. TaskRepository
const projectService = new ProjectService(
  projectRepository,
  userRepository,
  taskRepository
);

const taskService = new TaskService(
  taskRepository,
  projectRepository,
  userRepository
);

// ==========================================
// 4. PRESENTATION CONTROLLER LAYER
// ==========================================

const roleController = new RoleController(
  roleService
);

const userController = new UserController(
  userService
);

const authController = new AuthController(
  authService
);

const projectController = new ProjectController(
  projectService
);

const taskController = new TaskController(
  taskService
);

// ==========================================
// 5. EXPORT DEPENDENCIES
// ==========================================

export const container = {
  // Controllers
  roleController,
  userController,
  authController,
  projectController,
  taskController,
  discussionController: new DiscussionController(new DiscussionService(new DiscussionRepository(notificationWriter))),
  notificationRepository: new NotificationRepository(),

  // Authentication Dependencies
  tokenService,
  userRepository,
};
