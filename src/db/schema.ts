import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export type CallNotes = {
  concern: string;
  troubleshooting: string;
  resolution: string;
  followUp: string;
  escalation: string;
};

export type SoldProduct = {
  id: string;
  name: string;
  monthlyFee: number;
  action: "offered" | "sold";
};

export type PaymentRecord = {
  method: "cash" | "online" | "bank";
  amount: number;
  reference: string;
  processedAt: string;
};

export type TranscriptLine = {
  at: string;
  speaker: "agent" | "customer" | "system";
  text: string;
};

export type AiScores = {
  communication: number;
  authentication: number;
  documentation: number;
  sales: number;
  compliance: number;
  overall: number;
};

export type AiCoaching = {
  recommendations: string[];
  improvements: string[];
  bestPractices: string[];
  summary: string;
  strengths: string[];
  comments: string;
};

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  role: text("role").notNull(),
  agentStatus: text("agent_status").default("offline").notNull(),
  phone: text("phone"),
  bio: text("bio"),
  agentId: text("agent_id"),
  department: text("department"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const categories = pgTable("categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull(),
  color: text("color").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdBy: text("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export const products = pgTable("products", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  monthlyFee: integer("monthly_fee").notNull(),
  speed: text("speed"),
  kind: text("kind").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
});

export const scenarios = pgTable("scenarios", {
  id: text("id").primaryKey(),
  categoryId: text("category_id")
    .notNull()
    .references(() => categories.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  difficulty: text("difficulty").notNull(),
  customerFirstName: text("customer_first_name").notNull(),
  customerLastName: text("customer_last_name").notNull(),
  accountNumber: text("account_number").notNull(),
  accountPassword: text("account_password").notNull(),
  securityQuestion: text("security_question").notNull(),
  securityAnswer: text("security_answer").notNull(),
  address: text("address").notNull(),
  email: text("email").notNull(),
  mobile: text("mobile").notNull(),
  currentPlan: text("current_plan").notNull(),
  monthlyFee: integer("monthly_fee").notNull(),
  internetSpeed: text("internet_speed").notNull(),
  contractDuration: text("contract_duration").notNull(),
  serviceStatus: text("service_status").notNull(),
  billingStatus: text("billing_status").default("Current").notNull(),
  currentBalance: integer("current_balance").notNull(),
  outstandingBalance: integer("outstanding_balance").notNull(),
  dueDate: text("due_date").notNull(),
  previousPayment: integer("previous_payment").notNull(),
  concern: text("concern").notNull(),
  openingStatement: text("opening_statement").notNull(),
  transferEnabled: boolean("transfer_enabled").default(true).notNull(),
  assignedStudentId: text("assigned_student_id").references(() => users.id),
  createdBy: text("created_by").references(() => users.id),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const calls = pgTable("calls", {
  id: text("id").primaryKey(),
  studentId: text("student_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  scenarioId: text("scenario_id")
    .notNull()
    .references(() => scenarios.id, { onDelete: "cascade" }),
  status: text("status").notNull(),
  callState: text("call_state").default("connected").notNull(),
  audioMime: text("audio_mime"),
  audioData: text("audio_data"),
  audioDurationSeconds: integer("audio_duration_seconds").default(0).notNull(),
  transferred: boolean("transferred").default(false).notNull(),
  transferTarget: text("transfer_target"),
  startedAt: timestamp("started_at", { mode: "date" }).defaultNow().notNull(),
  endedAt: timestamp("ended_at", { mode: "date" }),
  durationSeconds: integer("duration_seconds").default(0).notNull(),
  callType: text("call_type").notNull(),
  passwordAttempts: integer("password_attempts").default(0).notNull(),
  securityAttempts: integer("security_attempts").default(0).notNull(),
  authMethod: text("auth_method"),
  authSuccess: boolean("auth_success").default(false).notNull(),
  passwordLocked: boolean("password_locked").default(false).notNull(),
  notes: jsonb("notes").$type<CallNotes>(),
  productsSold: jsonb("products_sold").$type<SoldProduct[]>(),
  payment: jsonb("payment").$type<PaymentRecord | null>(),
  termsAgreed: boolean("terms_agreed").default(false).notNull(),
  transcript: jsonb("transcript").$type<TranscriptLine[]>(),
  aiScores: jsonb("ai_scores").$type<AiScores | null>(),
  aiCoaching: jsonb("ai_coaching").$type<AiCoaching | null>(),
  supervisor: jsonb("supervisor").$type<SupervisorReport | null>(),
  teacherRating: integer("teacher_rating"),
  teacherComments: text("teacher_comments"),
  overallRating: integer("overall_rating"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export type SupervisorReport = {
  rating: number;
  verdict: string;
  missedAuthSteps: string[];
  missedDocumentation: string[];
  complianceFindings: string[];
  communicationNotes: string[];
  recommendations: string[];
  improvementPlan: string[];
  transcriptReviewed: boolean;
};

export type EvaluationScores = {
  authentication: number;
  communication: number;
  resolution: number;
  documentation: number;
  professionalism: number;
  productKnowledge: number;
  compliance: number;
};

export const evaluations = pgTable("evaluations", {
  id: text("id").primaryKey(),
  callId: text("call_id")
    .notNull()
    .references(() => calls.id, { onDelete: "cascade" }),
  studentId: text("student_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  teacherId: text("teacher_id").references(() => users.id),
  scores: jsonb("scores").$type<EvaluationScores>().notNull(),
  overall: integer("overall").notNull(),
  feedback: text("feedback").notNull().default(""),
  coachingNotes: text("coaching_notes").notNull().default(""),
  improvementPlan: text("improvement_plan").notNull().default(""),
  recognition: text("recognition").notNull().default(""),
  released: boolean("released").default(true).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export const announcements = pgTable("announcements", {
  id: text("id").primaryKey(),
  authorId: text("author_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  body: text("body").notNull(),
  kind: text("kind").default("announcement").notNull(),
  attachmentName: text("attachment_name"),
  attachmentMime: text("attachment_mime"),
  attachmentData: text("attachment_data"),
  pinned: boolean("pinned").default(false).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const announcementReads = pgTable("announcement_reads", {
  id: text("id").primaryKey(),
  announcementId: text("announcement_id")
    .notNull()
    .references(() => announcements.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  readAt: timestamp("read_at", { mode: "date" }).defaultNow().notNull(),
});

export const settings = pgTable("settings", {
  id: text("id").primaryKey(),
  ownerRole: text("owner_role").default("teacher").notNull(),
  cohortName: text("cohort_name").notNull().default("Nesting Wave 14"),
  passingScore: integer("passing_score").default(75).notNull(),
  floorTarget: integer("floor_target").default(85).notNull(),
  maxPasswordAttempts: integer("max_password_attempts").default(3).notNull(),
  allowTransfer: boolean("allow_transfer").default(true).notNull(),
  autoReleaseCertificates: boolean("auto_release_certificates").default(false).notNull(),
  aiStrictness: text("ai_strictness").default("balanced").notNull(),
  requireRecording: boolean("require_recording").default(true).notNull(),
  ringTimeoutSeconds: integer("ring_timeout_seconds").default(30).notNull(),
  queueAutoDispatch: boolean("queue_auto_dispatch").default(true).notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export const messages = pgTable("messages", {
  id: text("id").primaryKey(),
  fromUserId: text("from_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  toUserId: text("to_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  attachmentName: text("attachment_name"),
  attachmentMime: text("attachment_mime"),
  attachmentData: text("attachment_data"),
  readAt: timestamp("read_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const certificates = pgTable("certificates", {
  id: text("id").primaryKey(),
  studentId: text("student_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  issuedBy: text("issued_by").references(() => users.id),
  title: text("title").notNull(),
  type: text("type").notNull(),
  description: text("description").notNull(),
  fileName: text("file_name"),
  fileMime: text("file_mime"),
  fileData: text("file_data"),
  issuedAt: timestamp("issued_at", { mode: "date" }).defaultNow().notNull(),
});

export const notifications = pgTable("notifications", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  body: text("body").notNull(),
  type: text("type").notNull(),
  link: text("link"),
  read: boolean("read").default(false).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const achievements = pgTable("achievements", {
  id: text("id").primaryKey(),
  studentId: text("student_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  earnedAt: timestamp("earned_at", { mode: "date" }).defaultNow().notNull(),
});
