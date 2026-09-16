import { AuditLog, LeaveBalance, LeaveRequest, LeaveStatistics, LeaveStatus, LeaveType, Notification, UserProfile } from "../types.ts";
import { callRpc, supabaseRequest } from "./supabase.ts";

const jsonHeaders = { "Content-Type": "application/json" };
const encode = encodeURIComponent;

export function canTransitionLeaveStatus(current: LeaveStatus, next: LeaveStatus) {
  if (current === next) return true;
  if (current === "pending") return ["approved", "rejected", "cancelled", "withdrawn"].includes(next);
  if (current === "approved") return ["cancellation_pending", "withdrawn"].includes(next);
  if (current === "cancellation_pending") return ["cancelled", "approved"].includes(next);
  return false;
}

export function calculateBusinessDays(startDateStr: string, endDateStr: string) {
  const start = new Date(`${startDateStr}T00:00:00`);
  const end = new Date(`${endDateStr}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  let count = 0;
  for (const day = new Date(start); day <= end; day.setDate(day.getDate() + 1)) {
    if (day.getDay() !== 0 && day.getDay() !== 6) count += 1;
  }
  return count;
}

const profileFromRow = (r: any): UserProfile => ({
  uid: r.id,
  email: r.email,
  name: r.name,
  role: r.role,
  department: r.department,
  title: r.title,
  joinedDate: r.joined_date,
  createdAt: r.created_at,
  requestedRole: r.requested_role,
  approvalStatus: r.approval_status,
});
const balanceFromRow = (r: any): LeaveBalance => ({
  uid: r.user_id,
  annual: { total: r.annual_total, used: r.annual_used },
  sick: { total: r.sick_total, used: r.sick_used },
  casual: { total: r.casual_total, used: r.casual_used },
  parental: { total: r.parental_total, used: r.parental_used },
});
const requestFromRow = (r: any): LeaveRequest => ({
  id: r.id, uid: r.user_id, employeeId: r.user_id, employeeName: r.employee_name, employeeEmail: r.employee_email,
  department: r.department, leaveType: r.leave_type, startDate: r.start_date, endDate: r.end_date,
  duration: r.total_days, totalDays: r.total_days, reason: r.reason, status: r.status,
  applicationDate: r.created_at, createdAt: r.created_at, updatedAt: r.updated_at,
  cancellationRequestedAt: r.cancellation_requested_at || undefined, cancellationReason: r.cancellation_reason || undefined,
  cancelledAt: r.cancelled_at || undefined, approvedAt: r.approved_at || undefined, rejectedAt: r.rejected_at || undefined,
  managerComment: r.manager_comment || undefined, processedAt: r.processed_at || undefined, processedBy: r.processed_by || undefined,
});
const notificationFromRow = (r: any): Notification => ({ id: r.id, uid: r.user_id, title: r.title, message: r.message, status: r.status, createdAt: r.created_at });
const auditFromRow = (r: any): AuditLog => ({
  id: String(r.id), leaveId: r.leave_id, employeeId: r.employee_id, actorId: r.actor_id, actorName: r.actor_name,
  actorRole: r.actor_role, action: r.action, previousStatus: r.previous_status, newStatus: r.new_status, reason: r.reason, timestamp: r.created_at,
});

async function getOne<T>(path: string) {
  const rows = await supabaseRequest<T[]>(path);
  return rows[0] || null;
}

function csvCell(value: unknown) { return `"${String(value ?? "").replace(/"/g, '""').replace(/\r?\n/g, " ")}"`; }

export const DbService = {
  async registerUserProfile(profile: UserProfile, initial?: LeaveBalance) {
    await supabaseRequest("profiles?on_conflict=id", { method: "POST", headers: jsonHeaders, prefer: "resolution=merge-duplicates", body: JSON.stringify({
      id: profile.uid, email: profile.email, name: profile.name, role: "employee", department: profile.department, title: profile.title,
      joined_date: profile.joinedDate, created_at: profile.createdAt,
    }) });
    const b = initial || { uid: profile.uid, annual: { total: 20, used: 0 }, sick: { total: 10, used: 0 }, casual: { total: 7, used: 0 }, parental: { total: 30, used: 0 } };
    await supabaseRequest("leave_balances?on_conflict=user_id", { method: "POST", headers: jsonHeaders, prefer: "resolution=merge-duplicates", body: JSON.stringify({
      user_id: profile.uid, annual_total: b.annual.total, annual_used: b.annual.used, sick_total: b.sick.total, sick_used: b.sick.used,
      casual_total: b.casual.total, casual_used: b.casual.used, parental_total: b.parental.total, parental_used: b.parental.used,
    }) });
    return { user: profile, balances: b };
  },

  async getProfileAndBalances(uid: string, email = "", name = "Employee", chosenRole?: "employee" | "manager") {
    let profileRow = await getOne<any>(`profiles?id=eq.${encode(uid)}&select=*`);
    if (!profileRow) {
      const rows = await supabaseRequest<any[]>("profiles", { method: "POST", prefer: "return=representation", body: JSON.stringify({ id: uid, email, name, role: "employee", department: "Engineering", title: "Team Member" }) });
      profileRow = rows[0];
    }
    let balanceRow = await getOne<any>(`leave_balances?user_id=eq.${encode(uid)}&select=*`);
    if (!balanceRow) {
      const rows = await supabaseRequest<any[]>("leave_balances", { method: "POST", prefer: "return=representation", body: JSON.stringify({ user_id: uid }) });
      balanceRow = rows[0];
    }
    const user = profileFromRow(profileRow);
    if (user.approvalStatus === "pending") {
      throw new Error("Your account request is waiting for administrator approval. We will email you as soon as a decision is made.");
    }
    if (user.approvalStatus === "rejected") {
      throw new Error("This account request was not approved. Contact LeaveWise support if you need clarification.");
    }
    if (chosenRole && user.role !== chosenRole) {
      throw new Error(user.role === "manager" ? "This account has manager access. Use the HR & Admin Portal." : "This account has employee access. Manager access must be granted by an administrator.");
    }
    return { user, balances: balanceFromRow(balanceRow) };
  },

  async updateProfile(uid: string, updates: { name?: string; department?: string; title?: string }) {
    await supabaseRequest(`profiles?id=eq.${encode(uid)}`, { method: "PATCH", body: JSON.stringify(updates) });
  },

  async getLeaveRequests(uid: string, role: string) {
    const filter = role === "manager" ? "" : `&user_id=eq.${encode(uid)}`;
    const rows = await supabaseRequest<any[]>(`leave_requests?select=*&order=created_at.desc${filter}`);
    return rows.map(requestFromRow);
  },

  async getAuditLogs(_uid: string) {
    const rows = await supabaseRequest<any[]>("audit_logs?select=*&order=created_at.desc");
    return rows.map(auditFromRow);
  },

  async getLeaveAuditLogs(uid: string, leaveId: string) {
    const all = await this.getAuditLogs(uid);
    return all.filter((item) => item.leaveId === leaveId);
  },

  async submitLeaveRequest(uid: string, request: { leaveType: LeaveType; startDate: string; endDate: string; reason: string }, employeeName: string, employeeEmail: string) {
    const totalDays = calculateBusinessDays(request.startDate, request.endDate);
    if (totalDays <= 0) throw new Error("Leave dates must include at least one working day.");
    const { user, balances } = await this.getProfileAndBalances(uid);
    const remaining = balances[request.leaveType].total - balances[request.leaveType].used;
    const isInsufficient = totalDays > remaining;
    const rows = await callRpc<any[]>("submit_leave_request", {
      p_leave_type: request.leaveType, p_start_date: request.startDate, p_end_date: request.endDate, p_reason: request.reason,
    });
    const created = requestFromRow(rows[0]);
    return { request: created, warning: isInsufficient ? `Your remaining ${request.leaveType} balance (${remaining} days) is below this request (${totalDays} days).` : null, isInsufficient };
  },

  async approveLeaveRequest(_uid: string, requestId: string, comment: string) { await callRpc("process_leave_request", { p_request_id: requestId, p_action: "approve", p_comment: comment }); },
  async rejectLeaveRequest(_uid: string, requestId: string, comment: string) { await callRpc("process_leave_request", { p_request_id: requestId, p_action: "reject", p_comment: comment }); },
  async withdrawLeaveRequest(_uid: string, requestId: string) { await callRpc("withdraw_leave_request", { p_request_id: requestId }); },
  async cancelLeaveRequest(_uid: string, requestId: string, reason: string) {
    if (!reason.trim()) throw new Error("Cancellation reason is required.");
    await callRpc("request_leave_cancellation", { p_request_id: requestId, p_reason: reason.trim() });
  },
  async approveLeaveCancellation(_uid: string, requestId: string) { await callRpc("process_leave_cancellation", { p_request_id: requestId, p_approve: true, p_comment: "Cancellation approved by HR" }); },
  async rejectLeaveCancellation(_uid: string, requestId: string, comment: string) { await callRpc("process_leave_cancellation", { p_request_id: requestId, p_approve: false, p_comment: comment }); },

  async getEmployees(_uid: string) {
    const [profiles, balances] = await Promise.all([
      supabaseRequest<any[]>("profiles?select=*&order=name.asc"), supabaseRequest<any[]>("leave_balances?select=*"),
    ]);
    const byUid = new Map(balances.map((b) => [b.user_id, balanceFromRow(b)]));
    return profiles.map((p) => ({ ...profileFromRow(p), balances: byUid.get(p.id) }));
  },

  async updateEmployeeBalance(_uid: string, targetUid: string, updates: any) {
    await callRpc("update_employee_balance", { p_user_id: targetUid, p_balances: updates });
  },

  async getStats(uid: string): Promise<LeaveStatistics> {
    const [requests, employees] = await Promise.all([this.getLeaveRequests(uid, "manager"), this.getEmployees(uid)]);
    const employeeMap = new Map<string, UserProfile & { balances?: LeaveBalance }>(employees.map((e: any) => [e.uid, e]));
    const stats: LeaveStatistics = { pendingCount: 0, approvedCount: 0, rejectedCount: 0, byType: { annual: 0, sick: 0, casual: 0, parental: 0 }, byDepartment: {}, upcomingLeaves: [] };
    const today = new Date().toISOString().slice(0, 10);
    for (const r of requests) {
      if (r.status === "pending") stats.pendingCount++; if (r.status === "approved") stats.approvedCount++; if (r.status === "rejected") stats.rejectedCount++;
      if (r.status === "approved" && r.leaveType in stats.byType) stats.byType[r.leaveType as LeaveType] += r.totalDays;
      const dept = employeeMap.get(r.uid)?.department || r.department || "General";
      stats.byDepartment[dept] ||= { approved: 0, pending: 0 };
      if (r.status === "approved") stats.byDepartment[dept].approved += r.totalDays;
      if (r.status === "pending") stats.byDepartment[dept].pending += r.totalDays;
      if (r.status === "approved" && r.startDate >= today) stats.upcomingLeaves.push({ employeeName: r.employeeName, leaveType: r.leaveType as LeaveType, startDate: r.startDate, endDate: r.endDate, totalDays: r.totalDays });
    }
    stats.upcomingLeaves.sort((a, b) => a.startDate.localeCompare(b.startDate));
    stats.upcomingLeaves = stats.upcomingLeaves.slice(0, 5);
    return stats;
  },

  async getNotifications(uid: string) {
    const rows = await supabaseRequest<any[]>(`notifications?user_id=eq.${encode(uid)}&select=*&order=created_at.desc`);
    return rows.map(notificationFromRow);
  },
  async markNotificationAsRead(uid: string, id: string) { await supabaseRequest(`notifications?id=eq.${encode(id)}&user_id=eq.${encode(uid)}`, { method: "PATCH", body: JSON.stringify({ status: "read" }) }); },

  async getReportCSVData(uid: string) {
    const requests = await this.getLeaveRequests(uid, "manager");
    const header = "Request ID,Employee Name,Employee Email,Leave Type,Start Date,End Date,Total Working Days,Status,Reason,Manager Comment,Submitted At";
    return [header, ...requests.map((r) => [r.id, r.employeeName, r.employeeEmail, r.leaveType, r.startDate, r.endDate, r.totalDays, r.status, r.reason, r.managerComment, r.createdAt].map(csvCell).join(","))].join("\n");
  },

  async getEmployeeReportCSVData(uid: string, employeeUid: string, employeeName?: string) {
    const requests = (await this.getLeaveRequests(uid, uid === employeeUid ? "employee" : "manager")).filter((r) => r.uid === employeeUid);
    const balanceRow = await getOne<any>(`leave_balances?user_id=eq.${encode(employeeUid)}&select=*`);
    const balances = balanceRow ? balanceFromRow(balanceRow) : null;
    const lines = ["EMPLOYEE LEAVE REPORT", `Employee Name:,${csvCell(employeeName || employeeUid)}`, `Employee ID:,${csvCell(employeeUid)}`, `Generated On:,${csvCell(new Date().toLocaleString())}`, "", "LEAVE ALLOWANCE & BALANCE SUMMARY", "Leave Type,Total Entitled Days,Used Days,Remaining Days"];
    for (const type of ["annual", "sick", "casual", "parental"] as LeaveType[]) { const item = balances?.[type] || { total: 0, used: 0 }; lines.push(`${type},${item.total},${item.used},${item.total - item.used}`); }
    lines.push("", "LEAVE APPLICATION HISTORY", "Application ID,Leave Category,Start Date,End Date,Working Days,Current Status,Reason,Manager Comment,Submitted At");
    for (const r of requests) lines.push([r.id, r.leaveType, r.startDate, r.endDate, r.totalDays, r.status, r.reason, r.managerComment, r.createdAt].map(csvCell).join(","));
    return lines.join("\n");
  },

  async seedSampleCloudRequests() { throw new Error("Sample data is disabled. All records in this portal are real Supabase records."); },
};
