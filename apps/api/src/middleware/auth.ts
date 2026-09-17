import { Request, Response, NextFunction } from "express";
import { verifyToken, AuthTokenPayload } from "../lib/auth";
import { UserRole } from "@prisma/client";
import { logger } from "@verdix/shared";

// Extend Express Request interface to include authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: AuthTokenPayload;
    }
  }
}

/**
 * Authentication Middleware: Validates JWT Bearer token
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Authentication token required. Provide 'Authorization: Bearer <token>'",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch (err: unknown) {
    const error = err as Error;
    logger.warn(`Authentication failed: ${error.message}`);
    return res.status(401).json({
      error: "Unauthorized",
      message: "Invalid or expired authentication token",
    });
  }
}

/**
 * Role-Based Access Control Middleware
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Authentication required",
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn(
        `Forbidden: User ${req.user.userId} with role ${req.user.role} attempted action requiring [${allowedRoles.join(", ")}]`
      );
      return res.status(403).json({
        error: "Forbidden",
        message: `Insufficient permissions. Role '${req.user.role}' is not authorized for this action.`,
      });
    }

    next();
  };
}
