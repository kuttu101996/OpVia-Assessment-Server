import { NextFunction, Response } from "express";
import { AuthenticatedRequest } from "./auth";
import { Roles } from "../types/enums";

export const authorize = (roles: Roles[]) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }
      
      if (!roles.includes(req.user.role)) {
        console.log('Authorization failed', {
          userId: req.user.id,
          userRole: req.user.role,
          requiredRoles: roles
        });
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }
      
      next();
    };
  };