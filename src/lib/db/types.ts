export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type AppRole = "teacher" | "parent" | "student";
export type HomeworkStatus = "pending" | "completed";
export type FeeStatus = "paid" | "unpaid" | "overdue";

export interface Database {
  public: {
    Tables: {
      announcements: {
        Row: {
          id: string;
          title: string;
          message: string;
          teacher_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          message: string;
          teacher_id: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["announcements"]["Insert"]>;
        Relationships: [];
      };
      attendance: {
        Row: {
          id: string;
          student_id: string;
          date: string;
          present: boolean;
          teacher_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          date: string;
          present: boolean;
          teacher_id: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["attendance"]["Insert"]>;
        Relationships: [];
      };
      fees: {
        Row: {
          id: string;
          student_id: string;
          amount: number;
          status: FeeStatus;
          due_date: string;
          teacher_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          amount: number;
          status?: FeeStatus;
          due_date: string;
          teacher_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["fees"]["Insert"]>;
        Relationships: [];
      };
      homework: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          due_date: string;
          student_id: string;
          teacher_id: string;
          status: HomeworkStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          due_date: string;
          student_id: string;
          teacher_id: string;
          status?: HomeworkStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["homework"]["Insert"]>;
        Relationships: [];
      };
      students: {
        Row: {
          id: string;
          name: string;
          class: string;
          parent_name: string;
          parent_phone: string;
          parent_email: string | null;
          student_email: string | null;
          teacher_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          class: string;
          parent_name: string;
          parent_phone: string;
          parent_email?: string | null;
          student_email?: string | null;
          teacher_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["students"]["Insert"]>;
        Relationships: [];
      };
      tests: {
        Row: {
          id: string;
          student_id: string;
          subject: string;
          marks: number;
          total: number;
          date: string;
          teacher_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          subject: string;
          marks: number;
          total: number;
          date: string;
          teacher_id: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["tests"]["Insert"]>;
        Relationships: [];
      };
      users: {
        Row: {
          id: string;
          name: string | null;
          email: string;
          role: AppRole;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          name?: string | null;
          email: string;
          role?: AppRole;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["users"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      fee_status: FeeStatus;
      homework_status: HomeworkStatus;
      user_role: AppRole;
    };
    CompositeTypes: Record<string, never>;
  };
}

export type UserRow = Database["public"]["Tables"]["users"]["Row"];
export type StudentRow = Database["public"]["Tables"]["students"]["Row"];
export type HomeworkRow = Database["public"]["Tables"]["homework"]["Row"];
export type AttendanceRow = Database["public"]["Tables"]["attendance"]["Row"];
export type FeeRow = Database["public"]["Tables"]["fees"]["Row"];
export type TestRow = Database["public"]["Tables"]["tests"]["Row"];
export type AnnouncementRow = Database["public"]["Tables"]["announcements"]["Row"];
