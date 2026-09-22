import React, { useState, useEffect } from "react";
import { useAuth } from "../lib/auth-context.tsx";
import { 
  Users, CheckCircle, Clock, XCircle, 
  Search, ShieldCheck, Filter, ChevronRight, Edit2, 
  Save, AlertTriangle, CalendarRange, TrendingUp, RefreshCw, Ban
} from "lucide-react";
import { LeaveRequest, LeaveStatistics, LeaveType, LeaveStatus, UserProfile } from "../types.ts";
import { DbService } from "../lib/db-service.ts";
import { DraggableStatCard } from "./DraggableStatCard.tsx";

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

  const handleRefresh = () => {
    setRefreshing(true);
    loadManagerData();
  };

  // Approve leave
  const handleApprove = async (id: string) => {
    if (!token) return;
    try {
      setReviewLoading(true);
      await DbService.approveLeaveRequest(token, id, reviewComment);
      setReviewRequest(null);
      setReviewComment("");
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
    try {
      setReviewLoading(true);
      await DbService.rejectLeaveRequest(token, id, reviewComment);
      setReviewRequest(null);
      setReviewComment("");
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
      req.employeeEmail.toLowerCase().includes(matchQuery) ||
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
              <p className="text-[10px] text-slate-400 mt-1.5 font-semibold">Approved absences logged this year</p>
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

          {/* Visual Analytics & Statistics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Chart: Absence Type utilization */}
            <div className="bg-white rounded-xl border border-slate-200/60 p-6 shadow-sm">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-5">Leave Category Utilization (Approved Days)</h3>
              <div className="space-y-4">
                {stats && Object.entries(stats.byType).map(([type, val]) => {
                  const value = val as number;
                  const label = typeMap[type as LeaveType];
                  const maxVal = Math.max(...(Object.values(stats.byType) as number[]), 1);
                  const percent = (value / maxVal) * 100;

                  return (
                    <div key={type} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-700 capitalize">{label.name}</span>
                        <span className="font-bold text-slate-900">{value} approved days</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${label.color} transition-all duration-500`}
                          style={{ width: `${percent}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Department-wise absences */}
            <div className="bg-white rounded-xl border border-slate-200/60 p-6 shadow-sm">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-5">Department Utilization Matrix</h3>
              <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                {stats && Object.keys(stats.byDepartment).length === 0 ? (
                  <div className="text-center text-xs text-slate-400 py-12">No department records active.</div>
                ) : (
                  stats && Object.entries(stats.byDepartment).map(([dept, deptData]) => {
                    const data = deptData as { approved: number; pending: number };
                    return (
                      <div key={dept} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200/40 text-xs">
                        <div className="font-bold text-slate-800">{dept}</div>
                        <div className="flex items-center space-x-3 text-slate-500 font-semibold">
                          <span className="inline-flex items-center text-emerald-700 font-bold">
                            {data.approved}d Approved
                          </span>
                          <span className="text-slate-200">|</span>
                          <span className="inline-flex items-center text-amber-700 font-bold">
                            {data.pending}d Pending
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>

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
              <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 className="text-sm font-bold text-slate-900">Review Leave Request</h3>
                    <button 
                      onClick={() => setReviewRequest(null)}
                      className="text-slate-400 hover:text-slate-600 font-bold text-xs"
                    >
                      ✕ Close
                    </button>
                  </div>

                  {/* Applicant Details */}
                  <div className="p-4 bg-slate-50 border border-slate-200/50 rounded-lg space-y-2 text-xs font-semibold">
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-bold text-[10px] uppercase tracking-wider">APPLICANT:</span>
                      <span className="font-bold text-slate-800">{reviewRequest.employeeName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-bold text-[10px] uppercase tracking-wider">LEAVE TYPE:</span>
                      <span className="font-bold text-slate-800 capitalize">{reviewRequest.leaveType}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-bold text-[10px] uppercase tracking-wider">DURATION:</span>
                      <span className="font-bold text-slate-800">{reviewRequest.startDate} to {reviewRequest.endDate}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-bold text-[10px] uppercase tracking-wider">TOTAL DAYS:</span>
                      <span className="font-bold text-slate-900">{reviewRequest.totalDays} business days</span>
                    </div>
                    <div className="border-t border-slate-200/60 pt-2 mt-2">
                      <span className="text-slate-400 font-bold text-[10px] uppercase tracking-wider">APPLICANT'S REASON:</span>
                      <p className="text-slate-700 mt-1 font-medium leading-relaxed">{reviewRequest.reason}</p>
                    </div>
                  </div>

                  {/* Balances Context Alert */}
                  {(() => {
                    const applicant = employees.find((e) => e.uid === reviewRequest.uid);
                    if (!applicant) return null;
                    const cat = applicant.balances[reviewRequest.leaveType as LeaveType] || { total: 0, used: 0 };
                    const remaining = cat.total - cat.used;
                    const isOverdraft = reviewRequest.totalDays > remaining;

                    return (
                      <div className="space-y-3">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Employee Balances Context</span>
                        <div className="grid grid-cols-2 gap-4 bg-slate-50 border border-slate-200/60 p-3 rounded-lg text-xs font-semibold">
                          <div>
                            <span className="text-slate-400 font-bold text-[9px] uppercase tracking-wider block">Allowance Total:</span>
                            <span className="font-bold text-slate-900">{cat.total} days</span>
                          </div>
                          <div>
                            <span className="text-slate-400 font-bold text-[9px] uppercase tracking-wider block">Remaining Balance:</span>
                            <span className={`font-bold ${isOverdraft ? "text-rose-600" : "text-slate-900"}`}>
                              {remaining} days
                            </span>
                          </div>
                        </div>

                        {isOverdraft && (
                          <div className="p-3 bg-amber-50 border border-amber-200/50 text-amber-900 rounded-lg flex items-start space-x-2.5 text-xs font-semibold leading-relaxed">
                            <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold block text-amber-950">Overdraft Warning!</span>
                              This request exceeds their remaining balance by <span className="font-bold">{reviewRequest.totalDays - remaining} days</span>.
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Manager Comment */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Manager Comments</label>
                    <textarea
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      placeholder="Provide reasoning, instructions, or guidelines..."
                      rows={3}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-slate-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all"
                    ></textarea>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    {reviewRequest.status === "cancellation_pending" ? (
                      <>
                        <button
                          onClick={() => handleRejectCancellation(reviewRequest.id)}
                          disabled={reviewLoading}
                          className="w-full py-2 border border-slate-200 hover:bg-slate-50 text-rose-700 text-xs font-bold rounded-lg transition"
                        >
                          Reject Cancellation
                        </button>
                        <button
                          onClick={() => handleApproveCancellation(reviewRequest.id)}
                          disabled={reviewLoading}
                          className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition shadow-sm"
                        >
                          Approve Cancellation
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleReject(reviewRequest.id)}
                          disabled={reviewLoading}
                          className="w-full py-2 border border-slate-200 hover:bg-slate-50 text-rose-700 text-xs font-bold rounded-lg transition"
                        >
                          Decline Request
                        </button>
                        <button
                          onClick={() => handleApprove(reviewRequest.id)}
                          disabled={reviewLoading}
                          className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition shadow-sm"
                        >
                          Approve Absence
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
