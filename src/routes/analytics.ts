import express from "express";
import { query } from "express-validator";
import { authenticateToken } from "../middleware/auth";
import { Roles } from "../types/enums";
import { authorize } from "../middleware/authorization";
import { getAnalytics } from "../controllers/analytics";

const router = express.Router();

// Apply authentication middleware to all analytics routes
router.use(authenticateToken);

// Validation middleware for analytics query parameters
const validateGetAnalytics = [
  query("limit")
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage("Limit must be between 1 and 50")
    .toInt(),

  query("subject")
    .optional()
    .isIn(["Math", "Science", "English", "History"])
    .withMessage("Subject must be one of: Math, Science, English, History"),
];

/**
 * Get analytics data
 * @route GET /api/analytics
 * @access Private - requires authentication and admin/teacher role
 */
router.get(
  "/",
  authorize([Roles.ADMIN, Roles.TEACHER]),
  validateGetAnalytics,
  getAnalytics
);

export default router;
