import jwt from 'jsonwebtoken';
import { UnauthorizedError } from '../error/UnauthorizedError';
import { ForbiddenError } from '../error/ForBidenError';
import { NextFunction, Request, Response } from 'express';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    username: string;
    role?: string; // Make sure role is included if you check it later
  };
  file?: Express.Multer.File; // Correct type for multer files
}

export const authenticateToken = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const token = req.header('Authorization')?.replace('Bearer ', '').trim();

  if (!token) {
    return next(new UnauthorizedError('No token provided'));
  }

  try {
    const secret = process.env.JWT_SECRET_KEY;
    if (!secret) {
      throw new Error('JWT secret is not defined');
    }

    const decoded = jwt.verify(token, secret) as AuthenticatedRequest['user'];
    req.user = decoded;

    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      return next(new UnauthorizedError('Token expired'));
    }
    next(new UnauthorizedError('Invalid token'));
  }
};

export const authorize = (...roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role ?? '')) {
      return next(new ForbiddenError('You do not have permission to perform this action'));
    }
    next();
  };
};
