import { Request, Response, NextFunction } from "express";
import { registerSchema, loginSchema } from "./schemas";
import {
  registerCustomer,
  login,
  EmailAlreadyExistsError,
  InvalidCredentialsError,
} from "./authService";

/**
 * Handle POST /api/v1/auth/register
 */
export async function handleRegister(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const validatedInput = registerSchema.parse(req.body);
    const user = await registerCustomer(validatedInput);

    res.status(201).json({
      user,
    });
  } catch (err) {
    if (err instanceof EmailAlreadyExistsError) {
      res.status(409).json({
        error: {
          code: "EMAIL_ALREADY_EXISTS",
          message: err.message,
        },
      });
      return;
    }
    next(err);
  }
}

/**
 * Handle POST /api/v1/auth/login
 */
export async function handleLogin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const validatedInput = loginSchema.parse(req.body);
    const result = await login(validatedInput);

    res.status(200).json(result);
  } catch (err) {
    if (err instanceof InvalidCredentialsError) {
      res.status(401).json({
        error: {
          code: "INVALID_CREDENTIALS",
          message: err.message,
        },
      });
      return;
    }
    next(err);
  }
}

/**
 * Handle GET /api/v1/auth/me
 * Returns the authenticated user's current identity from the verified JWT.
 */
export async function handleGetMe(
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> {
  res.status(200).json({
    user: req.user,
  });
}
