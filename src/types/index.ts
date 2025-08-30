export interface Student {
  id: number;
  name: string;
  email: string;
  subject: 'Math' | 'Science' | 'English' | 'History';
  grade: number;
  created_at?: string;
}

export interface AuthRequest {
  username: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: {
    username: string;
  };
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface Analytics {
  totalStudents: number;
  averageGradeBySubject: {
    [subject: string]: number;
  };
  recentAdditions: Student[];
}
