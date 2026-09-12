export type UserRole = 'employee' | 'manager';

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  department: string;
  title: string;
  joinedDate: string;
  createdAt: string;
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

export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancellation_pending' | 'cancelled' | 'withdrawn';

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
