import { validationResult } from "express-validator";
import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { getDatabase } from "../database/init";
import { Analytics, ApiResponse } from "../types";

interface AnalyticsQuery {
  limit?: number;
  subject?: string;
}

interface AnalyticsResponse extends ApiResponse<Analytics> {
  timestamp: string;
  errors?: any[];
}

export const getAnalytics = async (
  req: AuthenticatedRequest,
  res: Response<AnalyticsResponse>
) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        timestamp: new Date().toISOString(),
        errors: errors.array(),
      });
    }

    const { limit = 10, subject }: AnalyticsQuery = req.query;
    const db = getDatabase();

    // Build dynamic queries based on filters
    let studentCountQuery = "SELECT COUNT(*) as count FROM students";
    let averageQuery = "SELECT subject, AVG(grade) as average FROM students";
    let recentQuery = "SELECT id, name, email, subject, grade, created_at FROM students";
    const params: any[] = [];

    // Apply subject filter if provided
    if (subject) {
      const whereClause = " WHERE subject = ?";
      studentCountQuery += whereClause;
      averageQuery += whereClause + " GROUP BY subject";
      recentQuery += whereClause;
      params.push(subject);
    } else {
      averageQuery += " GROUP BY subject";
    }

    recentQuery += " ORDER BY created_at DESC LIMIT ?";
    const recentParams = subject ? [subject, limit] : [limit];

    // Execute queries in parallel for better performance
    const [totalResult, averageBySubject, recentAdditions] = await Promise.all([
      db.get(studentCountQuery, subject ? [subject] : []),
      db.all(averageQuery, subject ? [subject] : []),
      db.all(recentQuery, recentParams),
    ]);

    const totalStudents = totalResult?.count || 0;

    const averageGradeBySubject: { [subject: string]: number } = {};
    averageBySubject.forEach((row) => {
      averageGradeBySubject[row.subject] = Math.round(row.average * 100) / 100;
    });

    const analytics: Analytics = {
      totalStudents,
      averageGradeBySubject,
      recentAdditions,
    };

    res.json({
      success: true,
      data: analytics,
      message: `Analytics retrieved successfully${subject ? ` for ${subject}` : ""}`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "An unexpected error occurred while retrieving analytics",
      timestamp: new Date().toISOString(),
    });
  }
};
