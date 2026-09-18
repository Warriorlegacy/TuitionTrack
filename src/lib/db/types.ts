export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

// MVP-1 AI loop: flexible row shape for new tables (migration 20260914).
// Keeps typed .from() table names without hand-maintaining 24 full schemas.
export type Flex = { id?: string } & Record<string, unknown>;

export type AppRole = "teacher" | "parent" | "student";
export type OrgRole = "owner" | "tutor" | "parent" | "student";
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
          org_id: string | null;
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
          org_id?: string | null;
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
      syllabus_nodes: { Row: Flex; Insert: Flex; Update: Flex; Relationships: [] };
      orgs: {
        Row: { id: string; name: string; created_by: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; name: string; created_by?: string | null; created_at?: string; updated_at?: string };
        Update: Partial<Database["public"]["Tables"]["orgs"]["Insert"]>;
        Relationships: [];
      };
      org_members: {
        Row: { org_id: string; user_id: string; role: OrgRole; created_at: string };
        Insert: { org_id: string; user_id: string; role: OrgRole; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["org_members"]["Insert"]>;
        Relationships: [];
      };
      batches: {
        Row: { id: string; org_id: string; name: string; teacher_id: string | null; created_at: string };
        Insert: { id?: string; org_id: string; name: string; teacher_id?: string | null; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["batches"]["Insert"]>;
        Relationships: [];
      };
      batch_enrollments: {
        Row: { batch_id: string; student_id: string; created_at: string };
        Insert: { batch_id: string; student_id: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["batch_enrollments"]["Insert"]>;
        Relationships: [];
      };
      guardian_links: {
        Row: {
          id: string; student_id: string; guardian_user_id: string | null;
          guardian_email: string | null; relationship: string;
          verified_consent_at: string | null; created_at: string;
        };
        Insert: {
          id?: string; student_id: string; guardian_user_id?: string | null;
          guardian_email?: string | null; relationship?: string;
          verified_consent_at?: string | null; created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["guardian_links"]["Insert"]>;
        Relationships: [];
      };
      ai_budgets: {
        Row: { student_id: string; monthly_cap_usd: number; kill_switch: boolean; updated_at: string };
        Insert: { student_id: string; monthly_cap_usd?: number; kill_switch?: boolean; updated_at?: string };
        Update: Partial<Database["public"]["Tables"]["ai_budgets"]["Insert"]>;
        Relationships: [];
      };
      user_ai_keys: {
        Row: {
          id: string; user_id: string; provider: string; label: string;
          encrypted_key: string; key_fingerprint: string; status: string;
          last_used_at: string | null; last_error: string | null;
          metadata: Record<string, unknown>; created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; user_id: string; provider: string; label?: string;
          encrypted_key: string; key_fingerprint: string; status?: string;
          last_used_at?: string | null; last_error?: string | null;
          metadata?: Record<string, unknown>; created_at?: string; updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_ai_keys"]["Insert"]>;
        Relationships: [];
      };
      user_ai_preferences: {
        Row: {
          user_id: string; default_provider: string; default_model: string;
          tier_a_model: string | null; tier_b_model: string | null; tier_c_model: string | null;
          allow_free_fallbacks: boolean; prefer_free_tiers: boolean;
          metadata: Record<string, unknown>; created_at: string; updated_at: string;
        };
        Insert: {
          user_id: string; default_provider?: string; default_model?: string;
          tier_a_model?: string | null; tier_b_model?: string | null; tier_c_model?: string | null;
          allow_free_fallbacks?: boolean; prefer_free_tiers?: boolean;
          metadata?: Record<string, unknown>; created_at?: string; updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_ai_preferences"]["Insert"]>;
        Relationships: [];
      };
      documents: { Row: Flex; Insert: Flex; Update: Flex; Relationships: [] };
      document_chunks: { Row: Flex; Insert: Flex; Update: Flex; Relationships: [] };
      questions: { Row: Flex; Insert: Flex; Update: Flex; Relationships: [] };
      question_options: { Row: Flex; Insert: Flex; Update: Flex; Relationships: [] };
      question_solutions: { Row: Flex; Insert: Flex; Update: Flex; Relationships: [] };
      assessments: { Row: Flex; Insert: Flex; Update: Flex; Relationships: [] };
      assessment_items: { Row: Flex; Insert: Flex; Update: Flex; Relationships: [] };
      attempts: { Row: Flex; Insert: Flex; Update: Flex; Relationships: [] };
      attempt_responses: { Row: Flex; Insert: Flex; Update: Flex; Relationships: [] };
      learning_events: { Row: Flex; Insert: Flex; Update: Flex; Relationships: [] };
      concept_mastery: { Row: Flex; Insert: Flex; Update: Flex; Relationships: [] };
      mistakes: { Row: Flex; Insert: Flex; Update: Flex; Relationships: [] };
      spaced_items: { Row: Flex; Insert: Flex; Update: Flex; Relationships: [] };
      review_events: { Row: Flex; Insert: Flex; Update: Flex; Relationships: [] };
      study_plans: { Row: Flex; Insert: Flex; Update: Flex; Relationships: [] };
      plan_tasks: { Row: Flex; Insert: Flex; Update: Flex; Relationships: [] };
      conversations: { Row: Flex; Insert: Flex; Update: Flex; Relationships: [] };
      messages: { Row: Flex; Insert: Flex; Update: Flex; Relationships: [] };
      tool_calls: { Row: Flex; Insert: Flex; Update: Flex; Relationships: [] };
      model_usage: { Row: Flex; Insert: Flex; Update: Flex; Relationships: [] };
      ai_evaluations: { Row: Flex; Insert: Flex; Update: Flex; Relationships: [] };
      audit_logs: { Row: Flex; Insert: Flex; Update: Flex; Relationships: [] };
      consent_records: { Row: Flex; Insert: Flex; Update: Flex; Relationships: [] };
      agent_runs: { Row: Flex; Insert: Flex; Update: Flex; Relationships: [] };
      automation_rules: { Row: Flex; Insert: Flex; Update: Flex; Relationships: [] };
      approvals: { Row: Flex; Insert: Flex; Update: Flex; Relationships: [] };
      tasks: { Row: Flex; Insert: Flex; Update: Flex; Relationships: [] };
      message_templates: { Row: Flex; Insert: Flex; Update: Flex; Relationships: [] };
      message_outbox: { Row: Flex; Insert: Flex; Update: Flex; Relationships: [] };
      inbound_messages: { Row: Flex; Insert: Flex; Update: Flex; Relationships: [] };
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
  ai_provider: "openai" | "anthropic" | "google" | "groq" | "together" | "openrouter" | "huggingface" | "custom";
  ai_key_status: "active" | "revoked" | "expired";
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
