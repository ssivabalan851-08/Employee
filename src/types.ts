export type UserRole = 'employee' | 'manager';

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  department: string;
  title: string;
  phoneNumber?: string;
  joinedDate: string;
  createdAt: string;
  requestedRole?: UserRole;
  approvalStatus?: 'pending' | 'approved' | 'rejected';
}

export interface LeaveCategory {
  total: number;
  used: number;
}

export interface LeaveBalance {
  uid: string;
  annual: LeaveCategory;
  sick: LeaveCategory;
  casual: LeaveCategory;
  parental: LeaveCategory;
}

export type LeaveType = 'annual' | 'sick' | 'casual' | 'parental';

export type CalendarEventKind = 'government' | 'company';

export interface CalendarEvent {
  id?: string;
  date: string;
  title: string;
  kind: CalendarEventKind;
  note: string;
}

export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancellation_pending' | 'cancelled' | 'withdrawn';

export type PolicyCheckStatus = 'pass' | 'warning' | 'fail';

export interface PolicyCheck {
  code: string;
  label: string;
  status: PolicyCheckStatus;
  message: string;
}

export interface PolicyEvaluation {
  id?: string;
  outcome: PolicyCheckStatus;
  version: number | string;
  checks: PolicyCheck[];
  evaluatedAt?: string;
}

export type CoverageRiskLevel = 'low' | 'moderate' | 'high';

export interface CoverageDailyFact {
  date: string;
  activeEmployees: number;
  approvedAway: number;
  pendingRequests: number;
  projectedAvailable: number;
  projectedPercent: number;
  requiredCount: number;
  requiredPercent: number;
  criticalRoleGaps?: string[];
}

export interface RecommendedDateRange {
  startDate: string;
  endDate: string;
  score: number;
  level: CoverageRiskLevel;
}

export interface CoverageImpact {
  id?: string;
  score: number;
  level: CoverageRiskLevel;
  reasons: string[];
  dailyFacts: CoverageDailyFact[];
  recommendedDates: RecommendedDateRange[];
  handoverRequired: boolean;
  evaluatedAt?: string;
}

export type HandoverStatus = 'not_required' | 'draft' | 'awaiting_acknowledgment' | 'ready' | 'declined';

export interface HandoverItem {
  id?: string;
  title: string;
  details?: string;
  dueDate?: string;
  resourceUrl?: string;
  completedAt?: string;
}

export interface HandoverPlan {
  id?: string;
  required: boolean;
  status: HandoverStatus;
  backupUserId?: string;
  backupName?: string;
  summary?: string;
  items: HandoverItem[];
  acknowledgedAt?: string;
  declinedReason?: string;
}

export interface LeaveRequestPreview {
  previewId: string;
  expiresAt: string;
  workingDays: number;
  policy: PolicyEvaluation;
  coverage: CoverageImpact;
}

export interface HandoverCandidate {
  uid: string;
  name: string;
  title: string;
  department: string;
}

export interface IncomingHandoverAssignment {
  planId: string;
  leaveRequestId: string;
  ownerName: string;
  startDate: string;
  endDate: string;
  summary: string;
  items: HandoverItem[];
  status: HandoverStatus;
}

export interface LeaveRequestHandoverInput {
  backupUserId: string;
  summary: string;
  items: HandoverItem[];
}

export interface LeaveRequest {
  id: string;

  // Primary fields matching BOTH original and master prompt
  uid: string; // original field
  employeeId: string; // new field (synced with uid)
  employeeName: string;
  employeeEmail?: string;
  department?: string;

  leaveType: string;

  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  
  duration: number; // new field (synced with totalDays)
  totalDays: number; // original field

  reason: string;
  status: LeaveStatus;

  applicationDate: string; // new field (synced with createdAt)
  createdAt: string; // original field (ISO String)
  updatedAt: string; // ISO String

  // Cancellation requested fields
  cancellationRequestedAt?: string;
  cancellationReason?: string;
  cancelledAt?: string;

  // HR review audit fields
  approvedAt?: string;
  rejectedAt?: string;
  managerComment?: string;
  processedAt?: string;
  processedBy?: string; // UID of manager/actor

  policyEvaluation?: PolicyEvaluation;
  coverageImpact?: CoverageImpact;
  currentCoverageImpact?: CoverageImpact;
  handover?: HandoverPlan;
}

export interface AuditLog {
  id: string;
  leaveId: string;
  employeeId?: string;
  actorId?: string;
  actorName?: string;
  actorRole: "employee" | "hr";
  action:
    | "leave_submitted"
    | "leave_approved"
    | "leave_rejected"
    | "leave_cancellation_requested"
    | "leave_cancelled";
  previousStatus?: string;
  newStatus?: string;
  reason?: string;
  timestamp: string;
}

export interface Notification {
  id: string;
  uid: string;
  title: string;
  message: string;
  status: 'unread' | 'read';
  createdAt: string; // ISO String
}

export interface LeaveStatistics {
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  byType: {
    annual: number;
    sick: number;
    casual: number;
    parental: number;
  };
  byDepartment: {
    [dept: string]: {
      approved: number;
      pending: number;
    };
  };
  upcomingLeaves: {
    employeeName: string;
    leaveType: LeaveType;
    startDate: string;
    endDate: string;
    totalDays: number;
  }[];
}
