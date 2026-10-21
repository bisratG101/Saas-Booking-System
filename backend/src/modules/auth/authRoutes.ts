import { Router } from "express";
import { handleRegister, handleLogin, handleGetMe } from "./authController";
import { authenticate } from "../../middleware/authenticate";

const router = Router();

// Public routes
router.post("/register", handleRegister);
router.post("/login", handleLogin);

// Protected routes
router.get("/me", authenticate, handleGetMe);

export { router as authRoutes };
