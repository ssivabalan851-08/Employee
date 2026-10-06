import {
  AuditLog,
  CalendarEvent,
  CoverageDailyFact,
  CoverageImpact,
  HandoverCandidate,
  HandoverItem,
  HandoverPlan,
  IncomingHandoverAssignment,
  LeaveBalance,
  LeaveRequest,
  LeaveRequestHandoverInput,
  LeaveRequestPreview,
  LeaveStatistics,
  LeaveStatus,
  LeaveType,
  Notification,
  PolicyCheck,
  PolicyEvaluation,
  RecommendedDateRange,
  UserProfile,
} from "../types.ts";
import { callRpc, supabaseRequest } from "./supabase.ts";

const jsonHeaders = { "Content-Type": "application/json" };
const encode = encodeURIComponent;

function firstValue<T = any>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === "string") {
    try { return JSON.parse(value) as T; }
    catch { return fallback; }
  }
  return value as T;
}

function normalizePolicyCheck(check: any): PolicyCheck {
  const rawStatus = check?.status || check?.result;
  return {
    code: String(check?.code || "POLICY"),
    label: String(check?.label || check?.name || check?.code || "Policy check"),
    status: rawStatus === "fail" || rawStatus === "warning" ? rawStatus : "pass",
    message: String(check?.message || check?.explanation || check?.detail || "Policy requirement satisfied."),
  };
}

function policyFromValue(value: any): PolicyEvaluation | undefined {
  const row = firstValue(value);
  if (!row) return undefined;
  const checks = parseJson<any[]>(row.checks ?? row.result?.checks ?? row.policy_checks, []).map(normalizePolicyCheck);
  const rawOutcome = row.outcome ?? row.result?.outcome ?? row.status ?? row.overall_status ?? "pass";
  const rawVersion = row.version
    ?? row.version_number
    ?? row.policy_version?.version_number
    ?? row.policy_version
    ?? row.result?.version
    ?? row.versionId
    ?? row.version_id
    ?? 1;
  return {
    id: row.id || row.evaluation_id || undefined,
    outcome: rawOutcome === "fail" || rawOutcome === "warning" ? rawOutcome : "pass",
    version: typeof rawVersion === "number" ? rawVersion : String(rawVersion),
    checks,
    evaluatedAt: row.evaluated_at || row.evaluatedAt || row.created_at || undefined,
  };
}

function dailyFactFromValue(value: any): CoverageDailyFact {
  return {
    date: String(value?.date ?? value?.day ?? ""),
    activeEmployees: Number(value?.activeEmployees ?? value?.active_employees ?? value?.departmentHeadcount ?? value?.department_headcount ?? value?.team_size ?? 0),
    approvedAway: Number(value?.approvedAway ?? value?.approved_away ?? value?.approvedAbsent ?? value?.approved_absent ?? 0),
    pendingRequests: Number(value?.pendingRequests ?? value?.pending_requests ?? value?.pending_away ?? 0),
    projectedAvailable: Number(value?.projectedAvailable ?? value?.projected_available ?? value?.available_after_request ?? 0),
    projectedPercent: Number(value?.projectedPercent ?? value?.projected_percent ?? value?.coveragePercent ?? value?.coverage_percent ?? value?.availability_percent ?? 0),
    requiredCount: Number(value?.requiredCount ?? value?.required_count ?? value?.minimum_available_count ?? 0),
    requiredPercent: Number(value?.requiredPercent ?? value?.required_percent ?? value?.minimum_available_percent ?? 0),
    criticalRoleGaps: parseJson<string[]>(value?.criticalRoleGaps ?? value?.critical_role_gaps, Number(value?.criticalRoleRulesAtRisk ?? value?.critical_role_rules_at_risk ?? 0) > 0 ? ["Critical-role coverage is below its minimum."] : []),
  };
}

function recommendedDateFromValue(value: any): RecommendedDateRange {
  const rawLevel = value?.level ?? value?.riskLevel ?? value?.risk_level;
  const level = rawLevel === "high" ? "high" : rawLevel === "medium" || rawLevel === "moderate" ? "moderate" : "low";
  return {
    startDate: String(value?.startDate ?? value?.start_date ?? ""),
    endDate: String(value?.endDate ?? value?.end_date ?? ""),
    score: Number(value?.score ?? value?.riskScore ?? value?.risk_score ?? 0),
    level,
  };
}

function coverageReasons(row: any, dailyFacts: CoverageDailyFact[], level: CoverageImpact["level"], score: number) {
  const supplied = parseJson<string[]>(row.reasons ?? row.risk_reasons, []);
  if (supplied.length) return supplied;

  const reasons = [`Team coverage risk is ${level} (${score}/100).`];
  const worstDay = [...dailyFacts].sort((left, right) => left.projectedPercent - right.projectedPercent)[0];
  if (worstDay?.date) {
    reasons.push(`${worstDay.projectedAvailable} of ${worstDay.activeEmployees} employees are projected available on ${worstDay.date} (${Math.round(worstDay.projectedPercent)}%).`);
  }
  const handoverReasons = parseJson<string[]>(row.handoverReasons ?? row.handover_reasons, []);
  const labels: Record<string, string> = {
    three_or_more_business_days: "The request spans at least three working days.",
    critical_role: "The employee holds a role with a minimum coverage requirement.",
    high_coverage_risk: "The requested dates have high team coverage risk.",
  };
  handoverReasons.forEach((reason) => reasons.push(labels[reason] || reason.replaceAll("_", " ")));
  return reasons;
}

function coverageFromValue(value: any): CoverageImpact | undefined {
  const row = firstValue(value);
  if (!row) return undefined;
  const rawLevel = row.level ?? row.riskLevel ?? row.risk_level;
  const level = rawLevel === "high"
    ? "high"
    : rawLevel === "moderate" || rawLevel === "medium"
      ? "moderate"
      : "low";
  const score = Number(row.score ?? row.total_score ?? row.riskScore ?? row.risk_score ?? 0);
  const dailyFacts = parseJson<any[]>(
    row.dailyFacts ?? row.daily_facts ?? row.daily_breakdown ?? row.leave_coverage_snapshot_days,
    [],
  ).map(dailyFactFromValue);
  const recommendedDates = parseJson<any[]>(
    row.recommendedDates ?? row.recommended_dates ?? row.alternative_dates ?? row.leave_coverage_alternatives,
    [],
  ).map(recommendedDateFromValue);
  return {
    id: row.id || row.snapshot_id || row.coverage_snapshot_id || undefined,
    score,
    level,
    reasons: coverageReasons(row, dailyFacts, level, score),
    dailyFacts,
    recommendedDates,
    handoverRequired: Boolean(row.handoverRequired ?? row.handover_required),
    evaluatedAt: row.evaluated_at || row.evaluatedAt || row.created_at || undefined,
  };
}

function handoverItemFromValue(value: any): HandoverItem {
  return {
    id: value?.id || undefined,
    title: String(value?.title || "Handover item"),
    details: value?.details || undefined,
    dueDate: value?.due_date || value?.dueDate || undefined,
    resourceUrl: value?.resource_url || value?.resourceUrl || undefined,
    completedAt: value?.completed_at || value?.completedAt || undefined,
  };
}

function handoverFromValue(value: any): HandoverPlan | undefined {
  const row = firstValue(value);
  if (!row) return undefined;
  const rawStatus = row.status || (row.required || row.handover_required ? "draft" : "not_required");
  const allowed = ["not_required", "draft", "awaiting_acknowledgment", "ready", "declined"];
  const normalizedStatus = rawStatus === "accepted"
    ? "ready"
    : rawStatus === "pending"
      ? "awaiting_acknowledgment"
      : allowed.includes(rawStatus)
        ? rawStatus
        : "draft";
  return {
    id: row.id || row.plan_id || undefined,
    required: Boolean(row.required ?? row.handover_required ?? true),
    status: normalizedStatus,
    backupUserId: row.backup_user_id || row.backupUserId || undefined,
    backupName: row.backup_name || row.backupName || row.backup_profile?.name || undefined,
    summary: row.summary || undefined,
    items: parseJson<any[]>(row.handover_items ?? row.items, []).map(handoverItemFromValue),
    acknowledgedAt: row.acknowledged_at || row.acknowledgedAt || row.responded_at || row.respondedAt || undefined,
    declinedReason: normalizedStatus === "declined"
      ? row.declined_reason || row.declinedReason || row.response_comment || row.responseComment || undefined
      : undefined,
  };
}

function previewFromValue(value: any): LeaveRequestPreview {
  const row = firstValue(value) as any;
  if (!row) throw new Error("LeaveWise did not receive a request preview.");
  const policy = policyFromValue(row.policy ?? row.policy_evaluation ?? row);
  const coverage = coverageFromValue(row.coverage ?? row.coverageImpact ?? row.coverage_impact ?? row);
  if (!policy || !coverage) throw new Error("The request preview is incomplete. Refresh and try again.");
  coverage.handoverRequired = Boolean(row.handoverRequired ?? row.handover_required ?? coverage.handoverRequired);
  coverage.reasons = coverageReasons(
    { ...row.coverageImpact, handoverReasons: row.handoverReasons ?? row.handover_reasons },
    coverage.dailyFacts,
    coverage.level,
    coverage.score,
  );
  return {
    previewId: String(row.previewId ?? row.preview_id ?? row.coverageSnapshotId ?? row.coverage_snapshot_id ?? coverage.id ?? row.id),
    expiresAt: String(row.expiresAt ?? row.expires_at ?? ""),
    workingDays: Number(row.workingDays ?? row.working_days ?? row.policy?.businessDays ?? row.policy?.business_days ?? 0),
    policy,
    coverage,
  };
}

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
  phoneNumber: r.phone_number || undefined,
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
  policyEvaluation: policyFromValue(r.policy_evaluations ?? r.policy_evaluation ?? r.policy_snapshot),
  coverageImpact: coverageFromValue(r.coverage_impact_snapshots ?? r.coverage_impact ?? r.coverage_snapshot),
  currentCoverageImpact: coverageFromValue(r.current_coverage_impact),
  handover: handoverFromValue(r.handover_plans ?? r.handover_plan ?? r.handover),
});
const notificationFromRow = (r: any): Notification => ({ id: r.id, uid: r.user_id, title: r.title, message: r.message, status: r.status, createdAt: r.created_at });
const auditFromRow = (r: any): AuditLog => ({
  id: String(r.id), leaveId: r.leave_id, employeeId: r.employee_id, actorId: r.actor_id, actorName: r.actor_name,
  actorRole: r.actor_role, action: r.action, previousStatus: r.previous_status, newStatus: r.new_status, reason: r.reason, timestamp: r.created_at,
});
const calendarEventFromRow = (r: any): CalendarEvent => ({
  id: r.id,
  date: r.event_date,
  title: r.title,
  kind: r.event_type,
  note: r.note,
});

async function getOne<T>(path: string) {
  const rows = await supabaseRequest<T[]>(path);
  return rows[0] || null;
}

function csvCell(value: unknown) { return `"${String(value ?? "").replace(/"/g, '""').replace(/\r?\n/g, " ")}"`; }

export const DbService = {
  async getCalendarEvents() {
    const rows = await supabaseRequest<any[]>("company_calendar_events?select=id,event_date,title,event_type,note&is_active=eq.true&order=event_date.asc");
    return rows.map(calendarEventFromRow);
  },

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
      throw new Error("This account is missing its employee profile. Contact the LeaveWise administrator to repair the account before signing in.");
    }
    let balanceRow = await getOne<any>(`leave_balances?user_id=eq.${encode(uid)}&select=*`);
    if (!balanceRow) {
      const rows = await supabaseRequest<any[]>("leave_balances", { method: "POST", prefer: "return=representation", body: JSON.stringify({ user_id: uid }) });
      balanceRow = rows[0];
    }
    const user = profileFromRow(profileRow);
    if (!user.approvalStatus || user.approvalStatus === "pending") {
      throw new Error("Your account request is waiting for administrator approval. LeaveWise will send an SMS to your registered mobile number after approval.");
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
    let rows: any[];
    try {
      const intelligenceSelect = [
        "*",
        "policy_evaluations:leave_policy_evaluations(*,policy_version:leave_policy_versions(version_number))",
        "coverage_impact_snapshots:leave_coverage_snapshots(*,leave_coverage_snapshot_days(*),leave_coverage_alternatives(*))",
        "handover_plans:leave_handover_plans(*,handover_items:leave_handover_items(*),backup_profile:profiles!leave_handover_plans_backup_user_id_fkey(name))",
      ].join(",");
      rows = await supabaseRequest<any[]>(`leave_requests?select=${intelligenceSelect}&order=created_at.desc${filter}`);
    } catch (error) {
      if (!/relationship|schema cache|does not exist|column/i.test(String((error as Error)?.message || error))) throw error;
      rows = await supabaseRequest<any[]>(`leave_requests?select=*&order=created_at.desc${filter}`);
    }
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

  async previewLeaveRequest(leaveType: LeaveType, startDate: string, endDate: string, reason = "") {
    const result = await callRpc<any>("preview_leave_request", {
      p_leave_type: leaveType,
      p_start_date: startDate,
      p_end_date: endDate,
      p_reason: reason.trim(),
    });
    return previewFromValue(result);
  },

  async getHandoverCandidates(): Promise<HandoverCandidate[]> {
    const result = await callRpc<any>("get_handover_candidates");
    const rows = Array.isArray(result) ? result : (result?.candidates || []);
    return rows.map((row: any) => ({
      uid: String(row.uid ?? row.id),
      name: String(row.name || "Employee"),
      title: String(row.title || "Team member"),
      department: String(row.department || "General"),
    }));
  },

  async getAssignedHandovers(): Promise<IncomingHandoverAssignment[]> {
    const result = await callRpc<any>("get_assigned_handovers");
    const rows = Array.isArray(result) ? result : (result?.assignments || result?.handovers || []);
    return rows.map((row: any) => ({
      planId: String(row.planId ?? row.plan_id ?? row.id),
      leaveRequestId: String(row.leaveRequestId ?? row.leave_request_id),
      ownerName: String(row.ownerName ?? row.owner_name ?? row.employee_name ?? "Employee"),
      startDate: String(row.startDate ?? row.start_date ?? ""),
      endDate: String(row.endDate ?? row.end_date ?? ""),
      summary: String(row.summary || ""),
      items: parseJson<any[]>(row.items ?? row.handover_items, []).map(handoverItemFromValue),
      status: handoverFromValue(row)?.status || "awaiting_acknowledgment",
    }));
  },

  async submitLeaveRequestV2(input: {
    previewId: string;
    leaveType: LeaveType;
    startDate: string;
    endDate: string;
    reason: string;
    handover?: LeaveRequestHandoverInput;
  }) {
    const rows = await callRpc<any[]>("submit_leave_request_v2", {
      p_leave_type: input.leaveType,
      p_start_date: input.startDate,
      p_end_date: input.endDate,
      p_reason: input.reason,
      p_coverage_snapshot_id: input.previewId,
      p_handover: input.handover || null,
    });
    const row = firstValue(rows);
    if (!row) throw new Error("LeaveWise could not create the leave request.");
    return { request: requestFromRow(row) };
  },

  async respondToHandover(planId: string, accepted: boolean, reason = "") {
    await callRpc("respond_to_handover", {
      p_plan_id: planId,
      p_response: accepted ? "accept" : "decline",
      p_comment: reason.trim(),
    });
  },

  async processLeaveRequestV2(requestId: string, action: "approve" | "reject", comment: string, overrideReason = "") {
    await callRpc("process_leave_request_v2", {
      p_request_id: requestId,
      p_action: action,
      p_comment: comment,
      p_override_reason: overrideReason.trim(),
    });
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
