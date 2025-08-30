import express, {Response} from 'express';
import { body, validationResult } from 'express-validator';
import { generateToken } from '../middleware/auth';
import { Roles } from '../types/enums';

const router = express.Router();

// Hardcoded credentials as per requirements
const VALID_CREDENTIALS = {
  username: 'teacher',
  password: 'password123'
};

/**
 * POST /auth/login
 * Authenticate user with hardcoded credentials and return JWT token
 */
router.post('/login', [
  body('username').notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required')
], (req: express.Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        data: errors.array()
      });
      return;
    }

    const { username, password } = req.body;

    // Check credentials against hardcoded values
    if (username !== VALID_CREDENTIALS.username || password !== VALID_CREDENTIALS.password) {
      res.status(401).json({
        success: false,
        error: 'Invalid username or password'
      });
      return;
    }

    // Generate JWT token
    const token = generateToken({username, role: Roles.TEACHER, id: 1});

    res.json({
      success: true,
      data: {
        token,
        user: { username, role: Roles.TEACHER }
      },
      message: 'Login successful'
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed'
    });
  }
});

export default router;
