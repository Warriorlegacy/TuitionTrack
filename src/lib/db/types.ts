export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type AppRole = "teacher" | "parent" | "student";
export type HomeworkStatus = "pending" | "completed";
export type FeeStatus = "paid" | "unpaid" | "overdue";
export type SubscriptionPlan = 'free' | 'solo' | 'pro' | 'center' | 'white_label';
export type SubscriptionStatus = 'active' | 'cancelled' | 'past_due';
export type ReportStatus = 'draft' | 'approved' | 'sent' | 'failed';
export type RiskLevel = 'low' | 'medium' | 'high';

export interface Database {
  __InternalSupabase: { PostgrestVersion: '12' };
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
          plan: SubscriptionPlan;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          name?: string | null;
          email: string;
          role?: AppRole;
          plan?: SubscriptionPlan;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["users"]["Insert"]>;
        Relationships: [];
      };
      performance_records: {
        Row: {
          id: string;
          student_id: string;
          period_label: string;
          attendance_pct: number;
          score_1: number;
          score_2: number;
          score_3: number;
          homework_pct: number;
          tutor_notes: string | null;
          risk_score: number;
          risk_level: RiskLevel;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          period_label?: string;
          attendance_pct?: number;
          score_1?: number | null;
          score_2?: number | null;
          score_3?: number | null;
          homework_pct?: number;
          tutor_notes?: string | null;
          risk_score?: number;
          risk_level?: RiskLevel;
          created_at?: string;
          updated_at?: string;
          teacher_id?: string;
        };
        Update: Partial<Database["public"]["Tables"]["performance_records"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "performance_records_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          }
        ];
      };
      reports: {
        Row: {
          id: string;
          performance_record_id: string | null;
          student_id: string;
          content: string;
          subject: string;
          language: string;
          status: ReportStatus;
          sent_at: string | null;
          sent_to: string[] | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          performance_record_id?: string | null;
          student_id: string;
          content: string;
          subject: string;
          language?: string;
          status?: ReportStatus;
          sent_at?: string | null;
          sent_to?: string[] | null;
          created_at?: string;
          updated_at?: string;
          teacher_id?: string;
        };
        Update: Partial<Database["public"]["Tables"]["reports"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "reports_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          }
        ];
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          razorpay_subscription_id: string | null;
          razorpay_customer_id: string | null;
          plan: SubscriptionPlan;
          status: SubscriptionStatus;
          current_period_start: string | null;
          current_period_end: string | null;
          cancelled_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          razorpay_subscription_id?: string | null;
          razorpay_customer_id?: string | null;
          plan: SubscriptionPlan;
          status?: SubscriptionStatus;
          current_period_start?: string | null;
          current_period_end?: string | null;
          cancelled_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["subscriptions"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: Record<string, {
      Row: Record<string, unknown>;
      Insert: Record<string, unknown>;
      Update: Record<string, unknown>;
      Relationships: [];
    }>;
    Functions: Record<string, {
      Args: Record<string, unknown>;
      Returns: unknown;
    }>;
    Enums: {
      fee_status: FeeStatus;
      homework_status: HomeworkStatus;
      report_status: ReportStatus;
      risk_level: RiskLevel;
      subscription_plan: SubscriptionPlan;
      subscription_status: SubscriptionStatus;
      user_role: AppRole;
    };
  };
}

export type DbEnums = {
  fee_status: FeeStatus;
  homework_status: HomeworkStatus;
  report_status: ReportStatus;
  risk_level: RiskLevel;
  subscription_plan: SubscriptionPlan;
  subscription_status: SubscriptionStatus;
  user_role: AppRole;
};

export type UserRow = Database["public"]["Tables"]["users"]["Row"];
export type StudentRow = Database["public"]["Tables"]["students"]["Row"];
export type HomeworkRow = Database["public"]["Tables"]["homework"]["Row"];
export type AttendanceRow = Database["public"]["Tables"]["attendance"]["Row"];
export type FeeRow = Database["public"]["Tables"]["fees"]["Row"];
export type TestRow = Database["public"]["Tables"]["tests"]["Row"];
export type AnnouncementRow = Database["public"]["Tables"]["announcements"]["Row"];
export type PerformanceRecordRow = Database["public"]["Tables"]["performance_records"]["Row"];
export type ReportRow = Database["public"]["Tables"]["reports"]["Row"];
export type SubscriptionRow = Database["public"]["Tables"]["subscriptions"]["Row"];
