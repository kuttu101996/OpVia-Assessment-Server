import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ApiResponse } from '../types';
import { Roles } from '../types/enums';

const JWT_SECRET = 'teacher-dashboard-secret-key-2024';

export interface AuthenticatedRequest extends Request {
  user?: {
    username: string;
    role: Roles;
    id: number;
  };
}

export const authenticateToken = (
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): void => {
  // Try to get token from Authorization header first (Bearer token)
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.split(' ')[1];
  
  // If no Bearer token, try to get from httpOnly cookie
  if (!token) {
    token = req.cookies?.auth_token;
  }

  if (!token) {
    res.status(401).json({
      success: false,
      error: 'Access token required'
    });
    return;
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      res.status(403).json({
        success: false,
        error: 'Invalid or expired token'
      });
      return;
    }

    req.user = decoded as { username: string; role: Roles; id: number };
    next();
  });
};

export const generateToken = (user: { username: string; role: Roles; id: number }): string => {
  return jwt.sign({ username: user.username, role: user.role, id: user.id }, JWT_SECRET, { expiresIn: '24h' });
};
