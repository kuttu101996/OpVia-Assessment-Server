import sqlite3 from 'sqlite3';
import path from 'path';

const DB_PATH = path.join(__dirname, '../../database.sqlite');

export class Database {
  private db: sqlite3.Database;

  constructor() {
    this.db = new sqlite3.Database(DB_PATH);
  }

  public run(sql: string, params: any[] = []): Promise<sqlite3.RunResult> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve(this);
      });
    });
  }

  public get(sql: string, params: any[] = []): Promise<any> {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  public all(sql: string, params: any[] = []): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  public close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

let dbInstance: Database;

export const getDatabase = (): Database => {
  if (!dbInstance) {
    dbInstance = new Database();
  }
  return dbInstance;
};

export const initializeDatabase = async (): Promise<void> => {
  const db = getDatabase();
  
  // Create students table
  const createStudentsTable = `
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL CHECK(length(name) >= 2),
      email TEXT NOT NULL UNIQUE,
      subject TEXT NOT NULL,
      grade INTEGER NOT NULL CHECK(grade >= 0 AND grade <= 100),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `;

  try {
    await db.run(createStudentsTable);
    console.log('Students table created successfully');
    
    // Insert sample data if table is empty
    const count = await db.get('SELECT COUNT(*) as count FROM students');
    if (count.count === 0) {
      await insertSampleData(db);
    }
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
};

const insertSampleData = async (db: Database): Promise<void> => {
  const sampleStudents = [
    { name: 'John Doe', email: 'john.doe@example.com', subject: 'Math', grade: 85 },
    { name: 'Jane Smith', email: 'jane.smith@example.com', subject: 'Science', grade: 92 },
    { name: 'Bob Johnson', email: 'bob.johnson@example.com', subject: 'English', grade: 78 },
    { name: 'Alice Brown', email: 'alice.brown@example.com', subject: 'History', grade: 88 },
    { name: 'Charlie Wilson', email: 'charlie.wilson@example.com', subject: 'Math', grade: 95 },
    { name: 'Diana Davis', email: 'diana.davis@example.com', subject: 'Science', grade: 89 }
  ];

  const insertQuery = `
    INSERT INTO students (name, email, subject, grade)
    VALUES (?, ?, ?, ?)
  `;

  for (const student of sampleStudents) {
    await db.run(insertQuery, [student.name, student.email, student.subject, student.grade]);
  }
  
  console.log('Sample data inserted successfully');
};
