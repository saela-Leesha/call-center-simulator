import type {
  AiCoaching,
  AiScores,
  CallNotes,
  PaymentRecord,
  SoldProduct,
  SupervisorReport,
  TranscriptLine,
} from "@/db/schema";

export type CategoryRow = {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  isActive: boolean;
};

export type ScenarioRow = {
  id: string;
  categoryId: string;
  title: string;
  difficulty: string;
  customerFirstName: string;
  customerLastName: string;
  accountNumber: string;
  accountPassword?: string;
  securityQuestion: string;
  securityAnswer?: string;
  address: string;
  email: string;
  mobile: string;
  currentPlan: string;
  monthlyFee: number;
  internetSpeed: string;
  contractDuration: string;
  serviceStatus: string;
  billingStatus?: string;
  currentBalance: number;
  outstandingBalance: number;
  dueDate: string;
  previousPayment: number;
  concern: string;
  openingStatement: string;
  transferEnabled?: boolean;
  assignedStudentId: string | null;
  assignedStudentName?: string;
  categoryName?: string;
  categoryColor?: string;
  isActive: boolean;
};

export type CallRow = {
  id: string;
  studentId: string;
  scenarioId: string;
  status: string;
  callState?: string;
  hasAudio?: boolean;
  transferred?: boolean;
  transferTarget?: string | null;
  transferEnabled?: boolean;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number;
  callType: string;
  passwordAttempts: number;
  securityAttempts: number;
  authMethod: string | null;
  authSuccess: boolean;
  passwordLocked: boolean;
  notes: CallNotes | null;
  productsSold: SoldProduct[] | null;
  payment: PaymentRecord | null;
  termsAgreed: boolean;
  transcript: TranscriptLine[] | null;
  aiScores: AiScores | null;
  aiCoaching: AiCoaching | null;
  supervisor: SupervisorReport | null;
  teacherRating: number | null;
  teacherComments: string | null;
  overallRating: number | null;
  customerName?: string;
  studentName?: string;
  scenarioTitle?: string;
  categoryName?: string;
  accountNumber?: string;
  customerEmail?: string;
  customerMobile?: string;
  customerAddress?: string;
};

export type ProductRow = {
  id: string;
  name: string;
  description: string;
  monthlyFee: number;
  speed: string | null;
  kind: string;
};

export type AchievementRow = {
  id: string;
  code: string;
  title: string;
  description: string;
  earnedAt: string;
};

export type CertificateRow = {
  id: string;
  studentId: string;
  title: string;
  type: string;
  description: string;
  issuedAt: string;
  hasFile?: boolean;
  studentName?: string;
  studentAgentId?: string;
  issuerName?: string;
  fileName?: string | null;
  fileMime?: string | null;
  fileData?: string | null;
};

export type MessageRow = {
  id: string;
  fromUserId: string;
  toUserId: string;
  body: string;
  attachmentName: string | null;
  hasAttachment?: boolean;
  createdAt: string;
  readAt: string | null;
};

export type DirectoryUser = {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  agentId: string | null;
  email: string;
};
