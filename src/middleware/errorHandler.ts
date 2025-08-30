import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../types';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
): void => {
  console.error('Error:', err.message);
  console.error('Stack:', err.stack);

  // Default error response
  let statusCode = 500;
  let message = 'Internal server error';

  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = err.message;
  } else if (err.message.includes('UNIQUE constraint failed')) {
    statusCode = 409;
    message = 'Email already exists';
  } else if (err.message.includes('CHECK constraint failed')) {
    statusCode = 400;
    message = 'Invalid data provided';
  }

  res.status(statusCode).json({
    success: false,
    error: message
  });
};
