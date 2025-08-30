import { validationResult } from "express-validator";
import { AuthenticatedRequest } from "../middleware/auth";
import { Response } from "express";
import { getDatabase } from "../database/init";
import { Roles } from "../types/enums";
import { Student } from "../types";

interface GetStudentsQuery {
  subject?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  search?: string;
}

interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  message: string;
  timestamp: string;
  errors?: any[];
}

export const getStudents = async (
  req: AuthenticatedRequest,
  res: Response<PaginatedResponse<Student>>
) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        data: [],
        pagination: {
          currentPage: 0,
          totalPages: 0,
          totalItems: 0,
          itemsPerPage: 0,
          hasNext: false,
          hasPrev: false,
        },
        message: "Validation failed",
        timestamp: new Date().toISOString(),
        errors: errors.array(),
      });
    }

    const db = getDatabase();
    const {
      subject,
      page = 1,
      limit = 20,
      sortBy = "created_at",
      sortOrder = "desc",
      search,
    }: GetStudentsQuery = req.query;

    // Build dynamic query with security considerations
    let baseQuery = "SELECT id, name, subject, grade, created_at FROM students";
    let countQuery = "SELECT COUNT(*) as total FROM students";
    const params: any[] = [];
    const conditions: string[] = [];

    if (req.user?.role === Roles.STUDENT) {
      conditions.push("id = ?");
      params.push(req.user.id);
    }
    // Students can only view their own records if we had user_id field
    // For now, students can view all records as per current schema

    if (subject) {
      conditions.push("subject = ?");
      params.push(subject);
    }

    if (search) {
      conditions.push("(name LIKE ? OR subject LIKE ?)");
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
    }

    if (conditions.length > 0) {
      const whereClause = ` WHERE ${conditions.join(" AND ")}`;
      baseQuery += whereClause;
      countQuery += whereClause;
    }

    // Whitelist sortBy to prevent SQL injection
    const allowedSortFields = ["created_at", "name", "subject", "grade"];
    const safeSortBy = allowedSortFields.includes(sortBy)
      ? sortBy
      : "created_at";
    const safeSortOrder = sortOrder === "asc" ? "ASC" : "DESC";

    // Add sorting and pagination
    const offset = (page - 1) * limit;
    baseQuery += ` ORDER BY ${safeSortBy} ${safeSortOrder} LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const [students, countResult] = await Promise.all([
      db.all(baseQuery, params),
      db.get(countQuery, params.slice(0, -2)), // Remove limit and offset for count
    ]);

    const totalItems = countResult?.total || 0;
    const totalPages = Math.ceil(totalItems / limit);

    res.json({
      success: true,
      data: students,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        itemsPerPage: limit,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
      message: `Retrieved ${students.length} of ${totalItems} students`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      data: [],
      pagination: {
        currentPage: 0,
        totalPages: 0,
        totalItems: 0,
        itemsPerPage: 0,
        hasNext: false,
        hasPrev: false,
      },
      message: "Internal server error occurred while retrieving students",
      timestamp: new Date().toISOString(),
    });
  }
};

interface CreateStudentRequest {
  name: string;
  email: string;
  subject: "Math" | "Science" | "English" | "History";
  grade: number;
}

interface CreateStudentResponse {
  success: boolean;
  data?: Student;
  message: string;
  timestamp: string;
  errors?: any[];
}

interface DatabaseError extends Error {
  code?: string;
  errno?: number;
}

export const createNewStudent = async (
  req: AuthenticatedRequest,
  res: Response<CreateStudentResponse>
) => {
  try {
    // Validation check
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        timestamp: new Date().toISOString(),
        errors: errors.array(),
      });

    const { name, email, subject, grade }: CreateStudentRequest = req.body;
    const db = getDatabase();

    // Check for duplicate email (case-insensitive)
    const existingStudent = await db.get(
      "SELECT id FROM students WHERE LOWER(email) = LOWER(?)",
      [email]
    );

    if (existingStudent)
      return res.status(409).json({
        success: false,
        message: "A student with this email already exists",
        timestamp: new Date().toISOString(),
      });

    // Begin transaction for atomicity
    await db.run("BEGIN TRANSACTION");

    try {
      const now = new Date().toISOString();

      // Insert new student with parameterized query (prevents SQL injection)
      const result = await db.run(
        `INSERT INTO students (name, email, subject, grade, created_at) 
           VALUES (?, ?, ?, ?, ?)`,
        [name, email.toLowerCase(), subject, grade, now]
      );

      if (!result.lastID)
        throw new Error("Failed to create student - no ID returned");

      // Retrieve the created student
      const newStudent = await db.get(
        "SELECT id, name, email, subject, grade, created_at FROM students WHERE id = ?",
        [result.lastID]
      );

      await db.run("COMMIT");

      res.status(201).json({
        success: true,
        data: newStudent,
        message: "Student created successfully",
        timestamp: new Date().toISOString(),
      });
    } catch (transactionError) {
      await db.run("ROLLBACK");
      throw transactionError;
    }
  } catch (error: unknown) {
    const dbError = error as DatabaseError;

    // Handle specific database constraint errors
    if (
      dbError.code === "SQLITE_CONSTRAINT_UNIQUE" ||
      dbError.message?.includes("UNIQUE constraint failed: students.email")
    ) {
      return res.status(409).json({
        success: false,
        message: "A student with this email already exists",
        timestamp: new Date().toISOString(),
      });
    }

    if (dbError.code === "SQLITE_CONSTRAINT_CHECK") {
      return res.status(400).json({
        success: false,
        message: "Invalid data provided - please check grade value",
        timestamp: new Date().toISOString(),
      });
    }

    // Generic server error
    res.status(500).json({
      success: false,
      message: "An unexpected error occurred while creating the student",
      timestamp: new Date().toISOString(),
    });
  }
};

// Request/Response Types
interface UpdateStudentRequest {
  name?: string;
  email?: string;
  subject?: "Math" | "Science" | "English" | "History";
  grade?: number;
}

interface UpdateStudentResponse {
  success: boolean;
  data?: Student;
  message: string;
  timestamp: string;
  errors?: any[];
}

// Enhanced handler
export const updateStudent = async (
  req: AuthenticatedRequest,
  res: Response<UpdateStudentResponse>
) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        timestamp: new Date().toISOString(),
        errors: errors.array(),
      });

    const { id } = req.params;
    const updates: UpdateStudentRequest = req.body;

    // Validate ID parameter
    if (!id || isNaN(Number(id)))
      return res.status(400).json({
        success: false,
        message: "Invalid student ID",
        timestamp: new Date().toISOString(),
      });

    const db = getDatabase();

    const existingStudent = await db.get(
      "SELECT id, name, email, subject, grade FROM students WHERE id = ?",
      [id]
    );

    if (!existingStudent)
      return res.status(404).json({
        success: false,
        message: "Student not found",
        timestamp: new Date().toISOString(),
      });

    // Check if there are fields to update
    const allowedFields = ["name", "email", "subject", "grade"];
    const updateFields = Object.keys(updates).filter(
      (field) =>
        allowedFields.includes(field) &&
        updates[field as keyof UpdateStudentRequest] !== undefined
    );

    if (updateFields.length === 0)
      return res.status(400).json({
        success: false,
        message: "No valid fields to update",
        timestamp: new Date().toISOString(),
      });

    // Check for duplicate email if email is being updated
    if (
      updates.email &&
      updates.email.toLowerCase() !== existingStudent.email.toLowerCase()
    ) {
      const duplicateEmail = await db.get(
        "SELECT id FROM students WHERE LOWER(email) = LOWER(?) AND id != ?",
        [updates.email, id]
      );

      if (duplicateEmail)
        return res.status(409).json({
          success: false,
          message: "A student with this email already exists",
          timestamp: new Date().toISOString(),
        });
    }

    // Begin transaction
    await db.run("BEGIN TRANSACTION");

    try {
      // Build secure dynamic query with whitelisted fields
      const setClause = updateFields.map((field) => `${field} = ?`).join(", ");
      const values = updateFields.map((field) => {
        const value = updates[field as keyof UpdateStudentRequest];
        // Normalize email if being updated
        return field === "email" && typeof value === "string"
          ? value.toLowerCase()
          : value;
      });

      const finalQuery = `UPDATE students SET ${setClause} WHERE id = ?`;
      values.push(id);

      const updateResult = await db.run(finalQuery, values);

      if (updateResult.changes === 0) throw new Error("No rows were updated");

      // Retrieve updated student
      const updatedStudent = await db.get(
        "SELECT id, name, email, subject, grade, created_at FROM students WHERE id = ?",
        [id]
      );

      await db.run("COMMIT");

      res.json({
        success: true,
        data: updatedStudent,
        message: "Student updated successfully",
        timestamp: new Date().toISOString(),
      });
    } catch (transactionError) {
      await db.run("ROLLBACK");
      throw transactionError;
    }
  } catch (error: unknown) {
    const dbError = error as DatabaseError;

    // Handle specific database constraint errors
    if (
      dbError.code === "SQLITE_CONSTRAINT_UNIQUE" ||
      dbError.message?.includes("UNIQUE constraint failed")
    )
      return res.status(409).json({
        success: false,
        message: "A student with this email already exists",
        timestamp: new Date().toISOString(),
      });

    if (dbError.code === "SQLITE_CONSTRAINT_CHECK")
      return res.status(400).json({
        success: false,
        message: "Invalid data provided - please check field values",
        timestamp: new Date().toISOString(),
      });

    // Generic server error
    res.status(500).json({
      success: false,
      message: "An unexpected error occurred while updating the student",
      timestamp: new Date().toISOString(),
    });
  }
};

interface DeleteStudentResponse {
  success: boolean;
  data?: {
    deletedId: number;
    deletedStudent: {
      name: string;
      email: string;
      subject: string;
    };
  };
  message: string;
  timestamp: string;
  errors?: any[];
}

// Enhanced handler
export const deleteStudent = async (
  req: AuthenticatedRequest,
  res: Response<DeleteStudentResponse>
) => {
  try {
    const { id } = req.params;

    // Validate ID parameter
    if (!id || isNaN(Number(id)) || Number(id) <= 0)
      return res.status(400).json({
        success: false,
        message: "Invalid student ID provided",
        timestamp: new Date().toISOString(),
      });

    const db = getDatabase();
    const studentId = Number(id);

    // Check if student exists and get data for audit log
    const existingStudent = await db.get(
      "SELECT id, name, email, subject, grade FROM students WHERE id = ?",
      [studentId]
    );

    if (!existingStudent)
      return res.status(404).json({
        success: false,
        message: "Student not found",
        timestamp: new Date().toISOString(),
      });

    // Authorization is handled by middleware

    // Begin transaction
    await db.run("BEGIN TRANSACTION");

    try {
      // Note: No related records check needed as student_assignments table doesn't exist

      // Perform the deletion
      const deleteResult = await db.run("DELETE FROM students WHERE id = ?", [
        studentId,
      ]);

      if (deleteResult.changes === 0)
        throw new Error(
          "No rows were deleted - student may have been deleted by another process"
        );

      await db.run("COMMIT");

      res.json({
        success: true,
        data: {
          deletedId: studentId,
          deletedStudent: {
            name: existingStudent.name,
            email: existingStudent.email,
            subject: existingStudent.subject,
          },
        },
        message: "Student deleted successfully",
        timestamp: new Date().toISOString(),
      });
    } catch (transactionError) {
      await db.run("ROLLBACK");
      throw transactionError;
    }
  } catch (error: unknown) {
    const dbError = error as DatabaseError;

    // Note: Foreign key constraint handling removed as no related tables exist

    if (dbError.message?.includes("database is locked")) {
      return res.status(503).json({
        success: false,
        message: "Database temporarily unavailable, please try again",
        timestamp: new Date().toISOString(),
      });
    }

    // Generic server error
    res.status(500).json({
      success: false,
      message: "An unexpected error occurred while deleting the student",
      timestamp: new Date().toISOString(),
    });
  }
};
