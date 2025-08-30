import express from "express";
import { body, query } from "express-validator";
import { authenticateToken } from "../middleware/auth";
import { Roles } from "../types/enums";
import { authorize } from "../middleware/authorization";
import {
  createNewStudent,
  deleteStudent,
  getStudents,
  updateStudent,
} from "../controllers/student";

const router = express.Router();

// Apply authentication middleware to all student routes
router.use(authenticateToken);

// Validation middleware
const validateGetStudents = [
  query("subject")
    .optional()
    .isIn(["Math", "Science", "English", "History"])
    .withMessage("Subject must be one of: Math, Science, English, History"),

  query("page")
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage("Page must be a positive integer between 1 and 1000")
    .toInt(),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100")
    .toInt(),

  query("sortBy")
    .optional()
    .isIn(["created_at", "name", "subject", "grade"])
    .withMessage("Sort field must be one of: created_at, name, subject, grade"),

  query("sortOrder")
    .optional()
    .isIn(["asc", "desc"])
    .withMessage("Sort order must be asc or desc"),

  query("search")
    .optional()
    .isLength({ min: 1, max: 100 })
    .trim()
    .escape()
    .withMessage("Search term must be 1-100 characters"),
];

/**
 * Get students with filtering, pagination, and search
 * @route GET /api/students
 * @access Private - requires authentication and appropriate permissions
 */
router.get(
  "/",
  authorize([Roles.ADMIN, Roles.TEACHER, Roles.STUDENT]),
  validateGetStudents,
  getStudents
);

// Enhanced validation middleware
const validateCreateStudent = [
  body("name")
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Name must be between 2 and 100 characters")
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage(
      "Name can only contain letters, spaces, hyphens, and apostrophes"
    )
    .escape(), // Prevent XSS

  body("email")
    .trim()
    .isEmail()
    .withMessage("Valid email is required")
    .isLength({ max: 255 })
    .withMessage("Email must not exceed 255 characters")
    .normalizeEmail()
    .custom(async (email) => {
      // Additional email validation can be added here
      const disposableEmailDomains = ["tempmail.org", "10minutemail.com"];
      const domain = email.split("@")[1];
      if (disposableEmailDomains.includes(domain)) {
        throw new Error("Disposable email addresses are not allowed");
      }
      return true;
    }),

  body("subject")
    .trim()
    .isIn(["Math", "Science", "English", "History"])
    .withMessage("Subject must be one of: Math, Science, English, History"),

  body("grade")
    .isFloat({ min: 0, max: 100 })
    .withMessage("Grade must be between 0 and 100")
    .toFloat(),
];

/**
 * Create a new student
 * @route POST /api/students
 * @access Private - requires authentication and admin/teacher role
 */
router.post(
  "/",
  authorize([Roles.ADMIN, Roles.TEACHER]),
  validateCreateStudent,

  createNewStudent
);

/**
 * PUT /students/:id
 * Update an existing student
 */
router.put(
  "/:id",
  authorize([Roles.ADMIN, Roles.TEACHER]),
  [
    body("name")
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage("Name must be between 2 and 100 characters")
      .matches(/^[a-zA-Z\s'-]+$/)
      .withMessage("Name can only contain letters, spaces, hyphens, and apostrophes")
      .escape(),
    body("email")
      .optional()
      .trim()
      .isEmail()
      .withMessage("Valid email is required")
      .isLength({ max: 255 })
      .withMessage("Email must not exceed 255 characters")
      .normalizeEmail(),
    body("subject")
      .optional()
      .isIn(["Math", "Science", "English", "History"])
      .withMessage("Subject must be one of: Math, Science, English, History"),
    body("grade")
      .optional()
      .isFloat({ min: 0, max: 100 })
      .withMessage("Grade must be between 0 and 100")
      .toFloat(),
  ],

  updateStudent
);

/**
 * DELETE /students/:id
 * Delete a student
 */
router.delete("/:id", authorize([Roles.ADMIN, Roles.TEACHER]), deleteStudent);

export default router;
