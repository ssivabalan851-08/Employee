import React, { useState, useEffect } from "react";
import { useAuth } from "../lib/auth-context.tsx";
import { 
  Users, CheckCircle, Clock, XCircle, 
  Search, ShieldCheck, Filter, ChevronRight, Edit2, 
  Save, AlertTriangle, CalendarRange, TrendingUp, RefreshCw, Ban,
  Gauge, ClipboardCheck, UserCheck, Info
} from "lucide-react";
import { LeaveRequest, LeaveStatistics, LeaveType, LeaveStatus, UserProfile } from "../types.ts";
import { DbService } from "../lib/db-service.ts";
import { DraggableStatCard } from "./DraggableStatCard.tsx";
import { HrApprovedLeaveChart } from "./LeaveAnalyticsCharts.tsx";
import { HolidayCalendarBar } from "./HolidayCalendarBar.tsx";

type IntelligentLeaveRequest = LeaveRequest & {
  policyEvaluation?: {
    id?: string;
    outcome: "pass" | "warning" | "fail";
    version: string | number;
    checks: unknown[];
    evaluatedAt?: string;
  };
  coverageImpact?: {
    id?: string;
    score: number;
    level: "low" | "moderate" | "high";
    reasons: string[];
    dailyFacts: unknown[];
    recommendedDates: unknown[];
    handoverRequired: boolean;
    evaluatedAt?: string;
  };
  handover?: {
    id?: string;
    required: boolean;
    status: "not_required" | "draft" | "awaiting_acknowledgment" | "ready" | "declined";
    backupUserId?: string;
    backupName?: string;
    summary?: string;
    items: unknown[];
    acknowledgedAt?: string;
    declinedReason?: string;
  };
};

type DecisionService = typeof DbService & {
  processLeaveRequestV2?: (
    requestId: string,
    action: "approve" | "reject",
    comment: string,
    overrideReason?: string,
  ) => Promise<unknown>;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const firstDisplayValue = (record: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
};

const humanizeValue = (value: unknown) => {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value.replace(/_/g, " ");
  return "";
};

const normalizeIndicator = (value: unknown): "pass" | "warning" | "fail" | "info" => {
  const label = String(value ?? "").toLowerCase();
  if (label === "low") return "pass";
  if (label === "moderate") return "warning";
  if (label === "high") return "fail";
  if (["pass", "passed", "ready", "complete", "completed", "ok", "allowed"].some((word) => label.includes(word))) return "pass";
  if (["fail", "failed", "block", "blocked", "declined", "rejected"].some((word) => label.includes(word))) return "fail";
  if (["warn", "moderate", "pending", "awaiting", "draft"].some((word) => label.includes(word))) return "warning";
  return "info";
};

const indicatorClasses = {
  pass: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  fail: "border-rose-200 bg-rose-50 text-rose-800",
  info: "border-slate-200 bg-slate-50 text-slate-700",
};

const hasIntelligenceData = (request: LeaveRequest | null): request is IntelligentLeaveRequest => {
  if (!request) return false;
  const intelligentRequest = request as IntelligentLeaveRequest;
  return Boolean(intelligentRequest.policyEvaluation || intelligentRequest.coverageImpact || intelligentRequest.handover);
};

const listItemView = (item: unknown, fallbackLabel: string) => {
  if (typeof item === "string") {
    return { label: item, detail: "", status: "info" as const };
  }

  const record = asRecord(item);
  if (!record) return { label: fallbackLabel, detail: "", status: "info" as const };

  const label = firstDisplayValue(record, ["label", "name", "title", "rule", "code", "date"]) || fallbackLabel;
  const detail = firstDisplayValue(record, ["message", "detail", "description", "reason", "value"]);
  const rawStatus = record.status ?? record.outcome ?? record.result ?? record.state ?? record.completed;

  return { label, detail, status: normalizeIndicator(rawStatus) };
};

const dailyFactView = (fact: unknown, index: number) => {
  if (typeof fact === "string") return { title: `Day ${index + 1}`, detail: fact };
  const record = asRecord(fact);
  if (!record) return { title: `Day ${index + 1}`, detail: "Coverage details unavailable" };

  const title = firstDisplayValue(record, ["date", "label", "day"]) || `Day ${index + 1}`;
  const preferredKeys = [
    "projectedAvailable",
    "activeEmployees",
    "approvedAway",
    "pendingRequests",
    "projectedPercent",
    "requiredCount",
    "requiredPercent",
    "available",
    "availableCount",
    "availableStaff",
    "total",
    "totalStaff",
    "absent",
    "unavailable",
    "coveragePercentage",
    "coveragePercent",
    "risk",
  ];
  const detailParts = preferredKeys.flatMap((key) => {
    const value = humanizeValue(record[key]);
    if (!value) return [];
    const label = key.replace(/([A-Z])/g, " $1").replace(/^./, (character) => character.toUpperCase());
    return [`${label}: ${value}${key.toLowerCase().includes("percent") ? "%" : ""}`];
  });
  const explicitDetail = firstDisplayValue(record, ["message", "detail", "description", "reason"]);

  return { title, detail: explicitDetail || detailParts.join(" • ") || "Coverage calculated" };
};

const recommendedDateLabel = (recommendation: unknown, index: number) => {
  if (typeof recommendation === "string") return recommendation;
  const record = asRecord(recommendation);
  if (!record) return `Alternative ${index + 1}`;
  const start = firstDisplayValue(record, ["startDate", "start_date", "start"]);
  const end = firstDisplayValue(record, ["endDate", "end_date", "end"]);
  const label = firstDisplayValue(record, ["label", "title", "date"]);
  const reason = firstDisplayValue(record, ["reason", "message", "detail"]);
  const range = start ? `${start}${end && end !== start ? ` to ${end}` : ""}` : label || `Alternative ${index + 1}`;
  return reason ? `${range} — ${reason}` : range;
};

export const ManagerDashboard: React.FC = () => {
  const { user, token, refreshProfile } = useAuth();

  // Stats and history states
  const [stats, setStats] = useState<LeaveStatistics | null>(null);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // Loading states
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Filter/Search states
  const [requestFilter, setRequestFilter] = useState<string>("all");
  const [employeeSearch, setEmployeeSearch] = useState<string>("");
  const [selectedDept, setSelectedDept] = useState<string>("all");

  // Advanced HR filters
  const [hrSearchQuery, setHrSearchQuery] = useState<string>("");
  const [hrStartDate, setHrStartDate] = useState<string>("");
  const [hrEndDate, setHrEndDate] = useState<string>("");
  const [hrLeaveType, setHrLeaveType] = useState<string>("all");
  const [hrStatus, setHrStatus] = useState<string>("all");

  // HR sorting
  const [hrSortBy, setHrSortBy] = useState<"name" | "date" | "duration" | "status">("date");
  const [hrSortOrder, setHrSortOrder] = useState<"asc" | "desc">("desc");

  // Review states
  const [reviewRequest, setReviewRequest] = useState<LeaveRequest | null>(null);
  const [reviewComment, setReviewComment] = useState<string>("");
  const [coverageOverrideReason, setCoverageOverrideReason] = useState<string>("");
  const [reviewLoading, setReviewLoading] = useState<boolean>(false);

  // Edit Balance states
  const [editingEmployee, setEditingEmployee] = useState<any | null>(null);
  const [editAnnual, setEditAnnual] = useState<number>(20);
  const [editSick, setEditSick] = useState<number>(10);
  const [editCasual, setEditCasual] = useState<number>(7);
  const [editParental, setEditParental] = useState<number>(30);
  const [balanceLoading, setBalanceLoading] = useState<boolean>(false);

  // Load all manager panel data
  const loadManagerData = async () => {
    if (!token) return;
    try {
      setError(null);
      const [reqData, empData, statsData] = await Promise.all([
        DbService.getLeaveRequests(token, "manager"),
        DbService.getEmployees(token),
        DbService.getStats(token),
      ]);

      setRequests(reqData || []);
      setEmployees(empData || []);
      setStats(statsData || null);
    } catch (err: any) {
      console.error("Failed to load manager data dashboard", err);
      setError(err.message || "Failed to load corporate records.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadManagerData();
  }, [token]);

  useEffect(() => {
    if (!reviewRequest) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !reviewLoading) {
        setReviewRequest(null);
        setReviewComment("");
        setCoverageOverrideReason("");
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [reviewRequest, reviewLoading]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadManagerData();
  };

  // Approve leave
  const handleApprove = async (id: string) => {
    if (!token) return;
    const intelligentRequest = hasIntelligenceData(reviewRequest) ? reviewRequest : null;
    if (intelligentRequest?.policyEvaluation?.outcome === "warning" && !reviewComment.trim()) {
      alert("Add a manager comment explaining how the policy warning was considered.");
      return;
    }
    if (intelligentRequest?.coverageImpact?.level === "high" && coverageOverrideReason.trim().length < 20) {
      alert("Enter an override reason of at least 20 characters for this high-risk request.");
      return;
    }
    const handoverRequired = Boolean(intelligentRequest?.handover?.required || intelligentRequest?.coverageImpact?.handoverRequired);
    if (handoverRequired && intelligentRequest?.handover?.status !== "ready") {
      alert("This request cannot be approved until its required handover is ready.");
      return;
    }
    try {
      setReviewLoading(true);
      const decisionService = DbService as DecisionService;
      if (intelligentRequest && decisionService.processLeaveRequestV2) {
        await decisionService.processLeaveRequestV2(id, "approve", reviewComment.trim(), coverageOverrideReason.trim());
      } else {
        await DbService.approveLeaveRequest(token, id, reviewComment);
      }
      setReviewRequest(null);
      setReviewComment("");
      setCoverageOverrideReason("");
      await loadManagerData();
      await refreshProfile(); // Refresh current user context in header too
    } catch (err: any) {
      console.error("Error approving request:", err);
      alert(err.message || "Failed to approve request.");
    } finally {
      setReviewLoading(false);
    }
  };

  // Reject leave
  const handleReject = async (id: string) => {
    if (!token) return;
    const intelligentRequest = hasIntelligenceData(reviewRequest) ? reviewRequest : null;
    if (intelligentRequest?.policyEvaluation?.outcome === "warning" && !reviewComment.trim()) {
      alert("Add a manager comment explaining how the policy warning affected this decision.");
      return;
    }
    try {
      setReviewLoading(true);
      const decisionService = DbService as DecisionService;
      if (intelligentRequest && decisionService.processLeaveRequestV2) {
        await decisionService.processLeaveRequestV2(id, "reject", reviewComment.trim(), "");
      } else {
        await DbService.rejectLeaveRequest(token, id, reviewComment);
      }
      setReviewRequest(null);
      setReviewComment("");
      setCoverageOverrideReason("");
      await loadManagerData();
      await refreshProfile();
    } catch (err: any) {
      console.error("Error declining request:", err);
      alert(err.message || "Failed to decline request.");
    } finally {
      setReviewLoading(false);
    }
  };

  // Approve leave cancellation
  const handleApproveCancellation = async (id: string) => {
    if (!token) return;
    try {
      setReviewLoading(true);
      await DbService.approveLeaveCancellation(token, id);
      setReviewRequest(null);
      setReviewComment("");
      setCoverageOverrideReason("");
      await loadManagerData();
      await refreshProfile();
    } catch (err: any) {
      console.error("Error approving cancellation:", err);
      alert(err.message || "Failed to approve cancellation.");
    } finally {
      setReviewLoading(false);
    }
  };

  // Reject leave cancellation
  const handleRejectCancellation = async (id: string) => {
    if (!token) return;
    try {
      setReviewLoading(true);
      await DbService.rejectLeaveCancellation(token, id, reviewComment);
      setReviewRequest(null);
      setReviewComment("");
      setCoverageOverrideReason("");
      await loadManagerData();
      await refreshProfile();
    } catch (err: any) {
      console.error("Error rejecting cancellation:", err);
      alert(err.message || "Failed to reject cancellation.");
    } finally {
      setReviewLoading(false);
    }
  };

  // Update employee leave balance ledger
  const handleUpdateBalances = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !editingEmployee) return;

    try {
      setBalanceLoading(true);
      await DbService.updateEmployeeBalance(token, editingEmployee.uid, {
        annual: { total: editAnnual, used: editingEmployee.balances.annual.used },
        sick: { total: editSick, used: editingEmployee.balances.sick.used },
        casual: { total: editCasual, used: editingEmployee.balances.casual.used },
        parental: { total: editParental, used: editingEmployee.balances.parental.used },
      });
      setEditingEmployee(null);
      await loadManagerData();
    } catch (err) {
      console.error("Error updating balances:", err);
      alert("Failed to update balances.");
    } finally {
      setBalanceLoading(false);
    }
  };

  // Open Edit Balance Form
  const startEditBalance = (emp: any) => {
    setEditingEmployee(emp);
    setEditAnnual(emp.balances.annual.total);
    setEditSick(emp.balances.sick.total);
    setEditCasual(emp.balances.casual.total);
    setEditParental(emp.balances.parental.total);
  };

  // Type visual theme maps
  const typeMap: { [key in LeaveType]: { name: string; color: string; bg: string; text: string } } = {
    annual: { name: "Annual Leave", color: "bg-slate-900", bg: "bg-[#f8fafc] text-slate-800 border border-slate-200/60", text: "text-slate-800" },
    sick: { name: "Sick Leave", color: "bg-rose-600", bg: "bg-rose-50 text-rose-700 border border-rose-200/40", text: "text-rose-800" },
    casual: { name: "Casual Leave", color: "bg-amber-600", bg: "bg-amber-50 text-amber-700 border border-amber-200/40", text: "text-amber-800" },
    parental: { name: "Parental Leave", color: "bg-teal-600", bg: "bg-teal-50 text-teal-700 border border-teal-200/40", text: "text-teal-800" },
  };

  const statusBadges: { [key in LeaveStatus]: { text: string; bg: string; color: string; icon: React.ReactNode } } = {
    approved: { text: "Approved", bg: "bg-emerald-50 border border-emerald-200/55", color: "text-emerald-700", icon: <CheckCircle className="h-3 w-3 mr-1" /> },
    pending: { text: "Pending Review", bg: "bg-amber-50 border border-amber-200/55", color: "text-amber-700", icon: <Clock className="h-3 w-3 mr-1" /> },
    rejected: { text: "Declined", bg: "bg-rose-50 border border-rose-200/55", color: "text-rose-700", icon: <XCircle className="h-3 w-3 mr-1" /> },
    withdrawn: { text: "Withdrawn", bg: "bg-slate-50 border border-slate-200/55", color: "text-slate-500", icon: <Ban className="h-3 w-3 mr-1 text-slate-400" /> },
    cancelled: { text: "Cancelled", bg: "bg-gray-100 border border-gray-200/55", color: "text-gray-600", icon: <Ban className="h-3 w-3 mr-1 text-gray-500" /> },
    cancellation_pending: { text: "Cancel Pending", bg: "bg-sky-50 border border-sky-200/55", color: "text-sky-700", icon: <Clock className="h-3 w-3 mr-1" /> },
  };

  // Filter requests using advanced HR filters
  const filteredRequests = requests.filter((req) => {
    // 1. Employee query matches name, email, department or ID
    const matchQuery = hrSearchQuery.trim().toLowerCase();
    const empProfile = employees.find(e => e.uid === req.uid);
    const dept = (req.department || empProfile?.department || "").toLowerCase();
    const matchesSearch = 
      matchQuery === "" ||
      req.employeeName.toLowerCase().includes(matchQuery) ||
      (req.employeeEmail || "").toLowerCase().includes(matchQuery) ||
      req.uid.toLowerCase().includes(matchQuery) ||
      dept.includes(matchQuery);

    // 2. Date Range boundaries
    let matchesDates = true;
    if (hrStartDate) {
      matchesDates = matchesDates && req.startDate >= hrStartDate;
    }
    if (hrEndDate) {
      matchesDates = matchesDates && req.endDate <= hrEndDate;
    }

    // 3. Leave Type
    const matchesType = hrLeaveType === "all" || req.leaveType === hrLeaveType;

    // 4. Status
    const matchesStatus = hrStatus === "all" || req.status === hrStatus;

    return matchesSearch && matchesDates && matchesType && matchesStatus;
  });

  // Sort requests using advanced HR sorting
  const sortedRequests = [...filteredRequests].sort((a, b) => {
    let comp = 0;
    if (hrSortBy === "name") {
      comp = a.employeeName.localeCompare(b.employeeName);
    } else if (hrSortBy === "date") {
      comp = a.startDate.localeCompare(b.startDate);
    } else if (hrSortBy === "duration") {
      const durA = a.duration ?? a.totalDays;
      const durB = b.duration ?? b.totalDays;
      comp = durA - durB;
    } else if (hrSortBy === "status") {
      comp = a.status.localeCompare(b.status);
    }
    return hrSortOrder === "asc" ? comp : -comp;
  });

  // Filter employees
  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch = 
      emp.name.toLowerCase().includes(employeeSearch.toLowerCase()) ||
      emp.email.toLowerCase().includes(employeeSearch.toLowerCase()) ||
      emp.department.toLowerCase().includes(employeeSearch.toLowerCase());
    
    const matchesDept = selectedDept === "all" || emp.department === selectedDept;

    return matchesSearch && matchesDept;
  });

  // Extract unique departments for filtering
  const departments = Array.from(new Set(employees.map(e => e.department).filter(Boolean)));

  // Highlight max leave utilization type
  const maxUsedType = stats ? Object.entries(stats.byType).reduce((a, b) => a[1] > b[1] ? a : b) : ["annual", 0];

  const intelligentReviewRequest = hasIntelligenceData(reviewRequest) ? reviewRequest : null;
  const isLeaveDecision = reviewRequest?.status === "pending";
  const policyWarningNeedsComment = Boolean(
    isLeaveDecision && intelligentReviewRequest?.policyEvaluation?.outcome === "warning" && !reviewComment.trim(),
  );
  const highCoverageNeedsOverride = Boolean(
    isLeaveDecision && intelligentReviewRequest?.coverageImpact?.level === "high" && coverageOverrideReason.trim().length < 20,
  );
  const reviewHandoverRequired = Boolean(
    isLeaveDecision && (intelligentReviewRequest?.handover?.required || intelligentReviewRequest?.coverageImpact?.handoverRequired),
  );
  const requiredHandoverNotReady = Boolean(
    reviewHandoverRequired && intelligentReviewRequest?.handover?.status !== "ready",
  );
  const approveDisabled = reviewLoading || policyWarningNeedsComment || highCoverageNeedsOverride || requiredHandoverNotReady;
  const rejectDisabled = reviewLoading || policyWarningNeedsComment;

  const closeReview = () => {
    if (reviewLoading) return;
    setReviewRequest(null);
    setReviewComment("");
    setCoverageOverrideReason("");
  };

  return (
    <div className="space-y-8 leavewise-dashboard leavewise-manager-dashboard">
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-100/80 flex items-start space-x-3 text-left animate-fade-in shadow-sm">
          <AlertTriangle className="h-5 w-5 text-rose-600 flex-shrink-0 mt-0.5 animate-pulse" />
          <div className="flex-1">
            <h4 className="text-xs font-bold text-rose-800">Database Connection Error</h4>
            <p className="text-xs text-rose-700 mt-1 font-medium leading-relaxed">{error}</p>
          </div>
        </div>
      )}

      {/* Overview Analytics Headers */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0 leavewise-page-heading">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">HR Operations Dashboard</h2>
          <p className="text-xs text-slate-500 font-semibold mt-1">Review requests, monitor leave activity, and maintain employee balances</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleRefresh}
            className="inline-flex items-center px-3 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg transition shadow-sm"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Sync Database
          </button>
        </div>
      </div>

      <HolidayCalendarBar />

      {loading ? (
        <div className="py-24 text-center text-xs font-bold text-slate-400">Loading corporate leave databases...</div>
      ) : (
        <>
          {/* Key Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <DraggableStatCard className="bg-white rounded-xl border border-slate-200/60 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pending Action</span>
                <div className="h-8 w-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Clock className="h-4 w-4" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 tracking-tight">{stats?.pendingCount}</h3>
              <p className="text-[10px] text-slate-400 mt-1.5 font-semibold">Leave requests awaiting decision</p>
            </DraggableStatCard>

            <DraggableStatCard className="bg-white rounded-xl border border-slate-200/60 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Approved</span>
                <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <CheckCircle className="h-4 w-4" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 tracking-tight">{stats?.approvedCount}</h3>
              <p className="text-[10px] text-slate-400 mt-1.5 font-semibold">Approved absences currently recorded</p>
            </DraggableStatCard>

            <DraggableStatCard className="bg-white rounded-xl border border-slate-200/60 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Employee Staff roster</span>
                <div className="h-8 w-8 rounded-lg bg-slate-50 text-slate-600 flex items-center justify-center">
                  <Users className="h-4 w-4" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 tracking-tight">{employees.length}</h3>
              <p className="text-[10px] text-slate-400 mt-1.5 font-semibold">Registered corporate users</p>
            </DraggableStatCard>

            <DraggableStatCard className="bg-white rounded-xl border border-slate-200/60 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Top Absence Type</span>
                <div className="h-8 w-8 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center">
                  <TrendingUp className="h-4 w-4" />
                </div>
              </div>
              <h3 className="text-sm font-bold text-slate-900 capitalize tracking-tight mt-1">{maxUsedType[0]} Leave</h3>
              <p className="text-[10px] text-slate-400 mt-1 font-semibold">({maxUsedType[1]} approved days taken)</p>
            </DraggableStatCard>
          </div>

          <HrApprovedLeaveChart requests={requests} employees={employees} />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Pending & Leave requests lists */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm p-6">
                <div className="flex flex-col mb-6 space-y-4">
                  <div className="flex items-center space-x-2.5">
                    <div className="h-10 w-10 rounded-lg bg-slate-50 text-slate-600 flex items-center justify-center">
                      <CalendarRange className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Leave Applications Register</h3>
                      <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Corporate database of all absences, approvals, and cancellations</p>
                    </div>
                  </div>

                  {/* Comprehensive HR Advanced Filter Controls */}
                  <div className="bg-slate-50/50 border border-slate-200/60 p-4 rounded-xl space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Search Staff / ID / Dept</label>
                        <div className="relative">
                          <input
                            type="text"
                            value={hrSearchQuery}
                            onChange={(e) => setHrSearchQuery(e.target.value)}
                            placeholder="Type employee name, email or ID..."
                            className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-800 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
                          />
                          <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Start Date</label>
                        <input
                          type="date"
                          value={hrStartDate}
                          onChange={(e) => setHrStartDate(e.target.value)}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-800 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
                        />
                      </div>

                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">End Date</label>
                        <input
                          type="date"
                          value={hrEndDate}
                          onChange={(e) => setHrEndDate(e.target.value)}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-800 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-1">
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Leave Category</label>
                        <select
                          value={hrLeaveType}
                          onChange={(e) => setHrLeaveType(e.target.value)}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-800 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
                        >
                          <option value="all">All Leave Types</option>
                          <option value="annual">Annual Leave</option>
                          <option value="sick">Sick Leave</option>
                          <option value="casual">Casual Leave</option>
                          <option value="parental">Parental Leave</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Status</label>
                        <select
                          value={hrStatus}
                          onChange={(e) => setHrStatus(e.target.value)}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-800 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
                        >
                          <option value="all">All Statuses</option>
                          <option value="pending">Pending Review</option>
                          <option value="approved">Approved</option>
                          <option value="rejected">Declined</option>
                          <option value="withdrawn">Withdrawn</option>
                          <option value="cancelled">Cancelled</option>
                          <option value="cancellation_pending">Cancellation Pending</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Sort By</label>
                        <select
                          value={hrSortBy}
                          onChange={(e) => setHrSortBy(e.target.value as any)}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-800 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
                        >
                          <option value="date">Leave Date</option>
                          <option value="name">Employee Name</option>
                          <option value="duration">Absence Duration</option>
                          <option value="status">Absence Status</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Sort Direction</label>
                        <select
                          value={hrSortOrder}
                          onChange={(e) => setHrSortOrder(e.target.value as any)}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-800 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
                        >
                          <option value="desc">Descending</option>
                          <option value="asc">Ascending</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {sortedRequests.length === 0 ? (
                  <div className="py-12 px-4 text-center max-w-md mx-auto">
                    <p className="text-xs font-semibold text-slate-400">No matching leave requests found.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-400 text-[10px] uppercase tracking-wider font-bold">
                          <th className="pb-3 font-semibold">Employee Details & ID</th>
                          <th className="pb-3 font-semibold">Type</th>
                          <th className="pb-3 font-semibold">Dates & Duration</th>
                          <th className="pb-3 font-semibold">Reason & Cancellation</th>
                          <th className="pb-3 font-semibold text-center">Status</th>
                          <th className="pb-3 font-semibold text-right">Review</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 text-xs font-semibold">
                        {sortedRequests.map((req) => {
                          const style = typeMap[req.leaveType];
                          const badge = statusBadges[req.status];
                          const formattedDates = `${new Date(req.startDate).toLocaleDateString(undefined, {month: "short", day: "numeric"})} - ${new Date(req.endDate).toLocaleDateString(undefined, {month: "short", day: "numeric", year: "numeric"})}`;
                          const empProfile = employees.find(e => e.uid === req.uid);
                          const dept = req.department || empProfile?.department || "General";
                          const isActionable = req.status === "pending" || req.status === "cancellation_pending";

                          return (
                            <tr key={req.id} className="hover:bg-slate-50/40 transition-colors">
                              <td className="py-4 align-top">
                                <div className="font-bold text-slate-900">{req.employeeName}</div>
                                <div className="text-[10px] text-slate-400 font-semibold">ID: {req.uid}</div>
                                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">{dept}</div>
                              </td>
                              <td className="py-4 align-top">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[9px] uppercase tracking-wider font-bold ${style.text} ${style.bg} border border-slate-200/50`}>
                                  {style.name}
                                </span>
                              </td>
                              <td className="py-4 text-slate-700 font-medium align-top">
                                <div>{formattedDates}</div>
                                <div className="text-[10px] text-slate-400 mt-0.5">Duration: <span className="font-bold text-slate-950">{req.duration ?? req.totalDays} business days</span></div>
                              </td>
                              <td className="py-4 max-w-xs align-top">
                                <div className="text-slate-800 font-medium">{req.reason}</div>
                                
                                {req.cancellationReason && (
                                  <div className="text-[10px] text-rose-600 font-semibold italic mt-1 bg-rose-50 border border-rose-100 p-1 rounded">
                                    Cancel Reason: "{req.cancellationReason}"
                                  </div>
                                )}
                              </td>
                              <td className="py-4 align-top">
                                <div className="flex justify-center">
                                  <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold ${badge.bg} ${badge.color}`}>
                                    {badge.icon}
                                    {badge.text}
                                  </span>
                                </div>
                              </td>
                              <td className="py-4 text-right align-top">
                                {isActionable ? (
                                  <button
                                    onClick={() => {
                                      setReviewRequest(req);
                                      setReviewComment("");
                                      setCoverageOverrideReason("");
                                    }}
                                    className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-bold uppercase tracking-wider rounded-md transition"
                                  >
                                    Review
                                  </button>
                                ) : (
                                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Processed</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Inline Review Drawer / Modal */}
            {reviewRequest && (
              <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 backdrop-blur-sm flex items-start sm:items-center justify-center p-3 sm:p-4">
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="leave-review-title"
                  aria-describedby="leave-review-description"
                  className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-4xl w-full max-h-[calc(100vh-1.5rem)] overflow-y-auto p-4 sm:p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150"
                >
                  <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
                    <div>
                      <h3 id="leave-review-title" className="text-sm font-bold text-slate-900">Review Leave Request</h3>
                      <p id="leave-review-description" className="text-[11px] text-slate-500 font-medium mt-1">
                        Review the employee, policy, coverage and handover evidence before recording a decision.
                      </p>
                    </div>
                    <button 
                      type="button"
                      onClick={closeReview}
                      disabled={reviewLoading}
                      aria-label="Close leave request review"
                      className="text-slate-400 hover:text-slate-600 disabled:opacity-50 font-bold text-xs whitespace-nowrap"
                    >
                      ✕ Close
                    </button>
                  </div>

                  {/* Applicant Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 border border-slate-200/50 rounded-lg space-y-2 text-xs font-semibold">
                      <div className="flex justify-between gap-4">
                        <span className="text-slate-400 font-bold text-[10px] uppercase tracking-wider">Applicant:</span>
                        <span className="font-bold text-slate-800 text-right">{reviewRequest.employeeName}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-slate-400 font-bold text-[10px] uppercase tracking-wider">Leave type:</span>
                        <span className="font-bold text-slate-800 capitalize text-right">{reviewRequest.leaveType}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-slate-400 font-bold text-[10px] uppercase tracking-wider">Duration:</span>
                        <span className="font-bold text-slate-800 text-right">{reviewRequest.startDate} to {reviewRequest.endDate}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-slate-400 font-bold text-[10px] uppercase tracking-wider">Total days:</span>
                        <span className="font-bold text-slate-900 text-right">{reviewRequest.totalDays} business days</span>
                      </div>
                      <div className="border-t border-slate-200/60 pt-2 mt-2">
                        <span className="text-slate-400 font-bold text-[10px] uppercase tracking-wider">Applicant's reason:</span>
                        <p className="text-slate-700 mt-1 font-medium leading-relaxed break-words">{reviewRequest.reason}</p>
                      </div>
                    </div>

                    {/* Balances Context Alert */}
                    {(() => {
                      const applicant = employees.find((e) => e.uid === reviewRequest.uid);
                      if (!applicant?.balances) return null;
                      const cat = applicant.balances[reviewRequest.leaveType as LeaveType] || { total: 0, used: 0 };
                      const remaining = cat.total - cat.used;
                      const isOverdraft = reviewRequest.totalDays > remaining;

                      return (
                        <div className="space-y-3">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Employee Balance Context</span>
                          <div className="grid grid-cols-2 gap-4 bg-slate-50 border border-slate-200/60 p-3 rounded-lg text-xs font-semibold">
                            <div>
                              <span className="text-slate-400 font-bold text-[9px] uppercase tracking-wider block">Allowance total:</span>
                              <span className="font-bold text-slate-900">{cat.total} days</span>
                            </div>
                            <div>
                              <span className="text-slate-400 font-bold text-[9px] uppercase tracking-wider block">Remaining balance:</span>
                              <span className={`font-bold ${isOverdraft ? "text-rose-600" : "text-slate-900"}`}>
                                {remaining} days
                              </span>
                            </div>
                          </div>

                          {isOverdraft && (
                            <div className="p-3 bg-amber-50 border border-amber-200/50 text-amber-900 rounded-lg flex items-start space-x-2.5 text-xs font-semibold leading-relaxed">
                              <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                              <div>
                                <span className="font-bold block text-amber-950">Overdraft warning</span>
                                This request exceeds the remaining balance by <span className="font-bold">{reviewRequest.totalDays - remaining} days</span>.
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {intelligentReviewRequest ? (
                    <div className="space-y-4" aria-label="Leave decision intelligence">
                      {/* Explainable Policy Engine */}
                      {intelligentReviewRequest.policyEvaluation && (
                        <section className="rounded-xl border border-slate-200 bg-white overflow-hidden" aria-labelledby="policy-evaluation-title">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3 bg-slate-50 border-b border-slate-200">
                            <div className="flex items-center gap-2.5">
                              <span className="h-8 w-8 rounded-lg bg-white border border-slate-200 text-slate-700 flex items-center justify-center">
                                <ClipboardCheck className="h-4 w-4" />
                              </span>
                              <div>
                                <h4 id="policy-evaluation-title" className="text-xs font-bold text-slate-900">Explainable Policy Evaluation</h4>
                                <p className="text-[10px] text-slate-500 font-semibold">Policy version {intelligentReviewRequest.policyEvaluation.version}</p>
                              </div>
                            </div>
                            <span className={`self-start sm:self-auto inline-flex items-center px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider ${indicatorClasses[normalizeIndicator(intelligentReviewRequest.policyEvaluation.outcome)]}`}>
                              {intelligentReviewRequest.policyEvaluation.outcome}
                            </span>
                          </div>
                          <div className="p-4">
                            {intelligentReviewRequest.policyEvaluation.checks.length > 0 ? (
                              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2" aria-label="Policy checks">
                                {intelligentReviewRequest.policyEvaluation.checks.map((check, index) => {
                                  const view = listItemView(check, `Policy check ${index + 1}`);
                                  const Icon = view.status === "pass" ? CheckCircle : view.status === "fail" ? XCircle : view.status === "warning" ? AlertTriangle : Info;
                                  return (
                                    <li key={`${view.label}-${index}`} className={`rounded-lg border p-3 text-xs ${indicatorClasses[view.status]}`}>
                                      <div className="flex items-start gap-2">
                                        <Icon className="h-4 w-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
                                        <div className="min-w-0">
                                          <p className="font-bold capitalize break-words">{view.label}</p>
                                          {view.detail && <p className="text-[11px] font-medium leading-relaxed mt-0.5 break-words opacity-90">{view.detail}</p>}
                                        </div>
                                      </div>
                                    </li>
                                  );
                                })}
                              </ul>
                            ) : (
                              <p className="text-xs text-slate-500 font-medium">The stored result has no individual policy checks.</p>
                            )}
                          </div>
                        </section>
                      )}

                      {/* Coverage Intelligence */}
                      {intelligentReviewRequest.coverageImpact && (
                        <section className="rounded-xl border border-slate-200 bg-white overflow-hidden" aria-labelledby="coverage-impact-title">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 bg-slate-50 border-b border-slate-200">
                            <div className="flex items-center gap-2.5">
                              <span className="h-8 w-8 rounded-lg bg-white border border-slate-200 text-slate-700 flex items-center justify-center">
                                <Gauge className="h-4 w-4" />
                              </span>
                              <div>
                                <h4 id="coverage-impact-title" className="text-xs font-bold text-slate-900">Team Coverage Intelligence</h4>
                                <p className="text-[10px] text-slate-500 font-semibold">Stored at submission for a consistent HR review</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 self-start sm:self-auto">
                              <span className="text-lg font-bold text-slate-900" aria-label={`Coverage score ${intelligentReviewRequest.coverageImpact.score}`}>
                                {intelligentReviewRequest.coverageImpact.score}
                                <span className="text-[10px] text-slate-400 ml-0.5">/100</span>
                              </span>
                              <span className={`inline-flex px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider ${indicatorClasses[normalizeIndicator(intelligentReviewRequest.coverageImpact.level)]}`}>
                                {intelligentReviewRequest.coverageImpact.level} risk
                              </span>
                            </div>
                          </div>
                          <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <div>
                              <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Why this score</h5>
                              {intelligentReviewRequest.coverageImpact.reasons.length > 0 ? (
                                <ul className="space-y-2 text-xs text-slate-700 font-medium">
                                  {intelligentReviewRequest.coverageImpact.reasons.map((reason, index) => (
                                    <li key={`${reason}-${index}`} className="flex items-start gap-2">
                                      <ChevronRight className="h-3.5 w-3.5 text-slate-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
                                      <span className="break-words">{reason}</span>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="text-xs text-slate-500">No additional risk reasons were recorded.</p>
                              )}

                              {intelligentReviewRequest.coverageImpact.recommendedDates.length > 0 && (
                                <div className="mt-4">
                                  <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Safer alternatives</h5>
                                  <ul className="space-y-1.5 text-[11px] text-slate-700 font-semibold">
                                    {intelligentReviewRequest.coverageImpact.recommendedDates.map((recommendation, index) => (
                                      <li key={index} className="rounded-md bg-emerald-50 border border-emerald-100 px-2.5 py-2 break-words">
                                        {recommendedDateLabel(recommendation, index)}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                            <div>
                              <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Daily staffing facts</h5>
                              {intelligentReviewRequest.coverageImpact.dailyFacts.length > 0 ? (
                                <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                                  {intelligentReviewRequest.coverageImpact.dailyFacts.map((fact, index) => {
                                    const view = dailyFactView(fact, index);
                                    return (
                                      <div key={`${view.title}-${index}`} className="rounded-lg bg-slate-50 border border-slate-200 p-2.5">
                                        <p className="text-[11px] text-slate-900 font-bold">{view.title}</p>
                                        <p className="text-[10px] text-slate-600 font-medium leading-relaxed mt-0.5 break-words">{view.detail}</p>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <p className="text-xs text-slate-500">No daily staffing facts were recorded.</p>
                              )}
                            </div>
                          </div>
                        </section>
                      )}

                      {/* Handover Readiness */}
                      {intelligentReviewRequest.handover && (
                        <section className="rounded-xl border border-slate-200 bg-white overflow-hidden" aria-labelledby="handover-readiness-title">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3 bg-slate-50 border-b border-slate-200">
                            <div className="flex items-center gap-2.5">
                              <span className="h-8 w-8 rounded-lg bg-white border border-slate-200 text-slate-700 flex items-center justify-center">
                                <UserCheck className="h-4 w-4" />
                              </span>
                              <div>
                                <h4 id="handover-readiness-title" className="text-xs font-bold text-slate-900">Handover Readiness</h4>
                                <p className="text-[10px] text-slate-500 font-semibold">
                                  {intelligentReviewRequest.handover.required ? "Required for this request" : "Optional for this request"}
                                </p>
                              </div>
                            </div>
                            <span className={`self-start sm:self-auto inline-flex px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider ${indicatorClasses[normalizeIndicator(intelligentReviewRequest.handover.status)]}`}>
                              {intelligentReviewRequest.handover.status.replace(/_/g, " ")}
                            </span>
                          </div>
                          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                            <div className="space-y-3">
                              <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Backup employee</span>
                                <span className="font-bold text-slate-800">{intelligentReviewRequest.handover.backupName || "Not assigned"}</span>
                              </div>
                              <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Handover summary</span>
                                <p className="text-slate-700 font-medium mt-1 whitespace-pre-wrap break-words">
                                  {intelligentReviewRequest.handover.summary || "No handover summary provided."}
                                </p>
                              </div>
                              {intelligentReviewRequest.handover.acknowledgedAt && (
                                <p className="text-[10px] font-semibold text-emerald-700">
                                  Acknowledged {new Date(intelligentReviewRequest.handover.acknowledgedAt).toLocaleString()}
                                </p>
                              )}
                              {intelligentReviewRequest.handover.declinedReason && (
                                <div className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-rose-800 font-medium">
                                  <span className="font-bold block">Decline reason</span>
                                  {intelligentReviewRequest.handover.declinedReason}
                                </div>
                              )}
                            </div>
                            <div>
                              <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Handover checklist</h5>
                              {intelligentReviewRequest.handover.items.length > 0 ? (
                                <ul className="space-y-2">
                                  {intelligentReviewRequest.handover.items.map((item, index) => {
                                    const view = listItemView(item, `Handover item ${index + 1}`);
                                    const itemRecord = asRecord(item);
                                    const completed = itemRecord?.completed === true || view.status === "pass";
                                    return (
                                      <li key={`${view.label}-${index}`} className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                                        {completed ? (
                                          <CheckCircle className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
                                        ) : (
                                          <Clock className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
                                        )}
                                        <div className="min-w-0">
                                          <p className="font-bold text-slate-800 break-words">{view.label}</p>
                                          {view.detail && <p className="text-[10px] text-slate-600 mt-0.5 break-words">{view.detail}</p>}
                                        </div>
                                      </li>
                                    );
                                  })}
                                </ul>
                              ) : (
                                <p className="text-xs text-slate-500">No checklist items were provided.</p>
                              )}
                            </div>
                          </div>
                        </section>
                      )}
                    </div>
                  ) : reviewRequest.status === "pending" ? (
                    <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 flex items-start gap-2.5 text-xs text-sky-900">
                      <Info className="h-4 w-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
                      <div>
                        <span className="font-bold block">Legacy leave request</span>
                        <span className="font-medium">This request was submitted before decision intelligence was enabled. It will continue through the original approval workflow.</span>
                      </div>
                    </div>
                  ) : null}

                  {/* Manager Comment */}
                  <div>
                    <label htmlFor="manager-review-comment" className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                      Manager comments {intelligentReviewRequest?.policyEvaluation?.outcome === "warning" && reviewRequest.status === "pending" ? <span className="text-rose-600">(required)</span> : null}
                    </label>
                    <textarea
                      id="manager-review-comment"
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      placeholder="Provide reasoning, instructions, or guidelines..."
                      rows={3}
                      aria-required={intelligentReviewRequest?.policyEvaluation?.outcome === "warning" && reviewRequest.status === "pending"}
                      aria-invalid={policyWarningNeedsComment}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-slate-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all"
                    ></textarea>
                    {policyWarningNeedsComment && (
                      <p className="mt-1.5 text-[10px] text-amber-700 font-semibold">Explain how the policy warning was considered before recording a decision.</p>
                    )}
                  </div>

                  {intelligentReviewRequest?.coverageImpact?.level === "high" && reviewRequest.status === "pending" && (
                    <div className="rounded-lg border border-rose-200 bg-rose-50/60 p-3">
                      <label htmlFor="coverage-override-reason" className="block text-[10px] font-bold text-rose-800 uppercase tracking-widest mb-1.5">
                        High-risk approval override reason <span aria-hidden="true">*</span>
                      </label>
                      <textarea
                        id="coverage-override-reason"
                        value={coverageOverrideReason}
                        onChange={(event) => setCoverageOverrideReason(event.target.value)}
                        placeholder="Explain why approving this high-risk period is operationally acceptable..."
                        rows={3}
                        minLength={20}
                        aria-required="true"
                        aria-invalid={highCoverageNeedsOverride}
                        aria-describedby="coverage-override-help"
                        className="w-full px-3 py-2 border border-rose-200 rounded-lg bg-white text-slate-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500/15 focus:border-rose-400 transition-all"
                      />
                      <div id="coverage-override-help" className="flex items-center justify-between gap-3 mt-1.5 text-[10px] font-semibold">
                        <span className={highCoverageNeedsOverride ? "text-rose-700" : "text-emerald-700"}>At least 20 characters are required to approve.</span>
                        <span className="text-slate-500 tabular-nums">{coverageOverrideReason.trim().length}/20</span>
                      </div>
                    </div>
                  )}

                  {requiredHandoverNotReady && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex items-start gap-2.5 text-xs text-amber-900" role="alert">
                      <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
                      <div>
                        <span className="font-bold block">Approval is waiting for handover readiness</span>
                        <span className="font-medium">The backup employee must acknowledge the required handover before HR can approve this absence.</span>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    {reviewRequest.status === "cancellation_pending" ? (
                      <>
                        <button
                          onClick={() => handleRejectCancellation(reviewRequest.id)}
                          disabled={reviewLoading}
                          className="w-full py-2 border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-rose-700 text-xs font-bold rounded-lg transition"
                        >
                          {reviewLoading ? "Processing..." : "Reject Cancellation"}
                        </button>
                        <button
                          onClick={() => handleApproveCancellation(reviewRequest.id)}
                          disabled={reviewLoading}
                          className="w-full py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg transition shadow-sm"
                        >
                          {reviewLoading ? "Processing..." : "Approve Cancellation"}
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleReject(reviewRequest.id)}
                          disabled={rejectDisabled}
                          className="w-full py-2 border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-rose-700 text-xs font-bold rounded-lg transition"
                        >
                          {reviewLoading ? "Processing..." : "Decline Request"}
                        </button>
                        <button
                          onClick={() => handleApprove(reviewRequest.id)}
                          disabled={approveDisabled}
                          className="w-full py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg transition shadow-sm"
                        >
                          {reviewLoading ? "Processing..." : requiredHandoverNotReady ? "Handover Not Ready" : "Approve Absence"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Employee Balance Ledger Column */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm p-6 sticky top-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2.5">
                    <div className="h-10 w-10 rounded-lg bg-slate-50 text-slate-600 flex items-center justify-center">
                      <Users className="h-5 w-5" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-900">Corporate Staff Ledger</h3>
                  </div>
                </div>

                <div className="relative mb-4">
                  <input
                    type="text"
                    value={employeeSearch}
                    onChange={(e) => setEmployeeSearch(e.target.value)}
                    placeholder="Search staff, dept, email..."
                    className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg bg-white text-slate-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all"
                  />
                  <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-3" />
                </div>

                <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                  {filteredEmployees.map((emp) => (
                    <div key={emp.uid} className="p-3 border border-slate-100 hover:border-slate-200 rounded-lg bg-slate-50/30 flex items-center justify-between text-xs font-semibold">
                      <div>
                        <div className="font-bold text-slate-950">{emp.name}</div>
                        <div className="text-slate-400 font-semibold text-[10px] mt-0.5">{emp.department} • {emp.title}</div>
                        <div className="text-[10px] text-slate-500 font-bold mt-1.5 flex items-center space-x-2">
                          <span>An: {emp.balances.annual.total - emp.balances.annual.used}d</span>
                          <span>Sk: {emp.balances.sick.total - emp.balances.sick.used}d</span>
                          <span>Ca: {emp.balances.casual.total - emp.balances.casual.used}d</span>
                        </div>
                      </div>
                      <button
                        onClick={() => startEditBalance(emp)}
                        className="p-1.5 bg-white text-slate-400 hover:text-slate-900 border border-slate-200 hover:border-slate-300 rounded-md shadow-sm transition"
                        title="Edit limits"
                      >
                        <Edit2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>

          {/* Edit balance modal */}
          {editingEmployee && (
            <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Configure Leave Limits</h3>
                    <p className="text-[11px] text-slate-400 font-semibold mt-0.5">Editing ledger for {editingEmployee.name}</p>
                  </div>
                  <button 
                    onClick={() => setEditingEmployee(null)}
                    className="text-slate-400 hover:text-slate-600 font-bold text-xs"
                  >
                    ✕ Close
                  </button>
                </div>

                <form onSubmit={handleUpdateBalances} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Annual Allowance</label>
                      <input
                        type="number"
                        min="0"
                        value={editAnnual}
                        onChange={(e) => setEditAnnual(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all"
                      />
                      <span className="text-[10px] text-slate-400 font-semibold mt-1 block">Used: {editingEmployee.balances.annual.used} days</span>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Sick Allowance</label>
                      <input
                        type="number"
                        min="0"
                        value={editSick}
                        onChange={(e) => setEditSick(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all"
                      />
                      <span className="text-[10px] text-slate-400 font-semibold mt-1 block">Used: {editingEmployee.balances.sick.used} days</span>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Casual Allowance</label>
                      <input
                        type="number"
                        min="0"
                        value={editCasual}
                        onChange={(e) => setEditCasual(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all"
                      />
                      <span className="text-[10px] text-slate-400 font-semibold mt-1 block">Used: {editingEmployee.balances.casual.used} days</span>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Parental Allowance</label>
                      <input
                        type="number"
                        min="0"
                        value={editParental}
                        onChange={(e) => setEditParental(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all"
                      />
                      <span className="text-[10px] text-slate-400 font-semibold mt-1 block">Used: {editingEmployee.balances.parental.used} days</span>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={balanceLoading}
                    className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg shadow-sm transition mt-2"
                  >
                    {balanceLoading ? "Updating Ledger..." : "Save Ledger Settings"}
                  </button>
                </form>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
