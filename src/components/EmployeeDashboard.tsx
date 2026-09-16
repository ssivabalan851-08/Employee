import React, { useState, useEffect } from "react";
import { useAuth } from "../lib/auth-context.tsx";
import { 
  CalendarDays, 
  AlertTriangle, 
  Send, 
  History, 
  CheckCircle, 
  CheckCircle2,
  Clock, 
  XCircle, 
  ChevronRight, 
  FileText, 
  Ban, 
  FileSpreadsheet,
  FileCheck2,
  Printer,
  X,
  ShieldCheck,
  Sparkles
} from "lucide-react";
import { LeaveType, LeaveRequest, LeaveStatus } from "../types.ts";
import { DbService } from "../lib/db-service.ts";
import { BrandLogo } from "./BrandLogo.tsx";

export const EmployeeDashboard: React.FC = () => {
  const { user, balances, token, refreshProfile } = useAuth();
  
  // State for leave application form
  const [leaveType, setLeaveType] = useState<LeaveType>("annual");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [formLoading, setFormLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Leave requests list
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [historyLoading, setHistoryLoading] = useState<boolean>(true);

  // Dynamic calculation of business days (skipping weekends)
  const calculateBusinessDays = (startStr: string, endStr: string): number => {
    if (!startStr || !endStr) return 0;
    const start = new Date(startStr);
    const end = new Date(endStr);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
    if (start > end) return 0;

    let count = 0;
    const cur = new Date(start);
    while (cur <= end) {
      const dayOfWeek = cur.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Skip Sat and Sun
        count++;
      }
      cur.setDate(cur.getDate() + 1);
    }
    return count;
  };

  const businessDays = calculateBusinessDays(startDate, endDate);

  // Check if balance is insufficient
  const getRemainingBalance = (type: LeaveType): number => {
    if (!balances) return 0;
    const cat = balances[type];
    return cat ? cat.total - cat.used : 0;
  };

  const remainingBalance = getRemainingBalance(leaveType);
  const isInsufficient = businessDays > remainingBalance;

  // Load history & audit trail
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState<boolean>(true);

  // Cancellation Modal state
  const [cancellingRequest, setCancellingRequest] = useState<LeaveRequest | null>(null);
  const [cancelReason, setCancelReason] = useState<string>("");
  const [cancelLoading, setCancelLoading] = useState<boolean>(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  // Report Generation Modal state
  const [selectedReportRequest, setSelectedReportRequest] = useState<LeaveRequest | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [reportNotice, setReportNotice] = useState<string | null>(null);

  // Filter approved leave applications
  const approvedRequests = requests.filter((r) => r.status === "approved");

  // Open official report for a specific approved leave request
  const handleOpenReport = (req: LeaveRequest) => {
    setSelectedReportRequest(req);
    setIsReportModalOpen(true);
    setReportNotice(null);
  };

  // Generate latest approved report from the top overview button
  const handleGenerateLatestApprovedReport = () => {
    if (approvedRequests.length === 0) {
      setReportNotice(
        "Official leave reports are generated after HR approves your leave application. You currently have no approved leave requests."
      );
      setTimeout(() => setReportNotice(null), 6000);
      return;
    }

    // Sort by approval date or start date to get latest approved
    const sortedApproved = [...approvedRequests].sort((a, b) => {
      const dateA = new Date(a.approvedAt || a.updatedAt || a.startDate).getTime();
      const dateB = new Date(b.approvedAt || b.updatedAt || b.startDate).getTime();
      return dateB - dateA;
    });

    handleOpenReport(sortedApproved[0]);
  };

  const loadRequestsHistory = async () => {
    if (!token || !user) return;
    try {
      setHistoryLoading(true);
      setLogsLoading(true);
      const data = await DbService.getLeaveRequests(token, user.role);
      setRequests(data);

      const logs = await DbService.getAuditLogs(token);
      const filteredLogs = logs.filter((l: any) => l.employeeId === token);
      setAuditLogs(filteredLogs);
    } catch (err) {
      console.error("Failed to load requests history or audit logs", err);
    } finally {
      setHistoryLoading(false);
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    loadRequestsHistory();
  }, [token, user]);

  // Submit Leave Request
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!startDate || !endDate) {
      setMessage({ type: "error", text: "Please enter start and end dates." });
      return;
    }
    if (businessDays <= 0) {
      setMessage({ type: "error", text: "Your requested leave must include at least 1 working day (Saturdays and Sundays are excluded)." });
      return;
    }

    try {
      setFormLoading(true);
      setMessage(null);

      const result = await DbService.submitLeaveRequest(
        token,
        { leaveType, startDate, endDate, reason },
        user?.name || "Employee",
        user?.email || ""
      );

      setMessage({
        type: "success",
        text: result.warning 
          ? `Leave request submitted successfully! ${result.warning}` 
          : "Your leave request has been submitted successfully for manager review.",
      });
      // Clear form
      setStartDate("");
      setEndDate("");
      setReason("");
      
      // Refresh balances and history
      await refreshProfile();
      await loadRequestsHistory();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to submit leave request." });
    } finally {
      setFormLoading(false);
    }
  };

  // Withdraw/Cancel leave request via Modal
  const openCancelModal = (req: LeaveRequest) => {
    const todayStr = new Date().toISOString().split("T")[0];
    if (req.startDate <= todayStr) {
      alert("You cannot cancel a leave request that has already started or whose start date has passed.");
      return;
    }
    setCancellingRequest(req);
    setCancelReason("");
    setCancelError(null);
  };

  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !cancellingRequest) return;
    
    const trimmed = cancelReason.trim();
    if (!trimmed) {
      setCancelError("A cancellation reason is required.");
      return;
    }

    try {
      setCancelLoading(true);
      setCancelError(null);
      await DbService.cancelLeaveRequest(token, cancellingRequest.id, trimmed);
      
      // Reset state & refresh
      setCancellingRequest(null);
      await refreshProfile();
      await loadRequestsHistory();
      setMessage({
        type: "success",
        text: cancellingRequest.status === "approved" 
          ? "Cancellation request successfully submitted to HR."
          : "Leave request successfully cancelled."
      });
    } catch (err: any) {
      setCancelError(err.message || "Failed to cancel request.");
    } finally {
      setCancelLoading(false);
    }
  };

  // Human readable title mapping
  const typeMap: { [key in LeaveType]: { name: string; color: string; bg: string; text: string; barColor: string } } = {
    annual: { name: "Annual Leave", color: "from-slate-700 to-slate-800", bg: "bg-[#f8fafc] border-slate-200/80", text: "text-slate-800", barColor: "bg-slate-900" },
    sick: { name: "Sick Leave", color: "from-rose-700 to-rose-800", bg: "bg-rose-50/20 border-rose-200/40", text: "text-rose-800", barColor: "bg-rose-600" },
    casual: { name: "Casual Leave", color: "from-amber-700 to-amber-800", bg: "bg-amber-50/20 border-amber-200/40", text: "text-amber-800", barColor: "bg-amber-600" },
    parental: { name: "Parental Leave", color: "from-teal-700 to-teal-800", bg: "bg-teal-50/20 border-teal-200/40", text: "text-teal-800", barColor: "bg-teal-600" },
  };

  const statusBadges: { [key in LeaveStatus]: { text: string; bg: string; color: string; icon: React.ReactNode } } = {
    approved: { text: "Approved", bg: "bg-emerald-50 border border-emerald-200/55", color: "text-emerald-700", icon: <CheckCircle className="h-3 w-3 mr-1" /> },
    pending: { text: "Pending Review", bg: "bg-amber-50 border border-amber-200/55", color: "text-amber-700", icon: <Clock className="h-3 w-3 mr-1" /> },
    rejected: { text: "Declined", bg: "bg-rose-50 border border-rose-200/55", color: "text-rose-700", icon: <XCircle className="h-3 w-3 mr-1" /> },
    withdrawn: { text: "Withdrawn", bg: "bg-slate-50 border border-slate-200/55", color: "text-slate-500", icon: <Ban className="h-3 w-3 mr-1 text-slate-400" /> },
    cancelled: { text: "Cancelled", bg: "bg-gray-100 border border-gray-200/55", color: "text-gray-600", icon: <Ban className="h-3 w-3 mr-1 text-gray-500" /> },
    cancellation_pending: { text: "Cancel Pending", bg: "bg-sky-50 border border-sky-200/55", color: "text-sky-700", icon: <Clock className="h-3 w-3 mr-1" /> },
  };

  return (
    <div className="space-y-8">
      {/* Overview Section */}
      <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Welcome Back, {user?.name}</h2>
          <p className="text-xs text-slate-500 font-semibold mt-1">
            {user?.title} • {user?.department} • Joined {user?.joinedDate}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleGenerateLatestApprovedReport}
            className="inline-flex items-center px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition shadow-sm"
            title="Generate official approved leave statement with updated available balances"
          >
            <FileCheck2 className="h-4 w-4 mr-2 text-emerald-400" />
            Generate Leave Report
          </button>
        </div>
      </div>

      {/* Guidance alert when no approved leave exists yet */}
      {reportNotice && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200/80 flex items-start space-x-3 text-left animate-in fade-in duration-200 shadow-sm">
          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-xs font-bold text-amber-900">Leave Report Notice</h4>
            <p className="text-xs text-amber-800 mt-0.5 font-medium leading-relaxed">{reportNotice}</p>
          </div>
          <button 
            onClick={() => setReportNotice(null)}
            className="text-amber-500 hover:text-amber-700 p-1 rounded-md transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Leave Balances Grid */}
      <div>
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3.5">Available Leave Balances</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {(["annual", "sick", "casual", "parental"] as LeaveType[]).map((type) => {
            const cat = balances ? balances[type] : { total: 0, used: 0 };
            const rem = cat.total - cat.used;
            const percent = cat.total > 0 ? Math.min(100, Math.max(0, (cat.used / cat.total) * 100)) : 0;
            const style = typeMap[type];

            return (
              <div key={type} className={`rounded-xl border p-5 flex flex-col justify-between bg-white ${style.bg} shadow-sm transition-all hover:shadow-md hover:translate-y-[-1px] duration-250`}>
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className={`text-[10px] uppercase tracking-wider font-bold px-2.5 py-1 rounded-md ${style.text} bg-white border border-slate-200/60`}>
                      {style.name}
                    </span>
                    <span className="text-xl font-bold text-slate-900">{rem} <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block sm:inline ml-0.5">days left</span></span>
                  </div>
                  
                  {/* Progress Line */}
                  <div className="w-full bg-slate-100 rounded-full h-1.5 mb-2 overflow-hidden">
                    <div className={`h-1.5 rounded-full ${style.barColor}`} style={{ width: `${percent}%` }}></div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-2">
                  <span>{cat.used} used</span>
                  <span>{cat.total} total allowance</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Leave Request Form */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm p-6 sticky top-6">
            <div className="flex items-center space-x-2.5 mb-6">
              <div className="h-10 w-10 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center">
                <CalendarDays className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Apply for Leave</h3>
            </div>

            {message && (
              <div className={`p-4 mb-5 rounded-lg border text-xs leading-relaxed font-semibold ${
                message.type === "success" 
                  ? "bg-emerald-50 border-emerald-200/60 text-emerald-800" 
                  : "bg-rose-50 border-rose-200/60 text-rose-800"
              }`}>
                {message.text}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Leave Category</label>
                <select
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value as LeaveType)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-slate-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all"
                >
                  <option value="annual">Annual Leave (Vacation/Holiday)</option>
                  <option value="sick">Sick Leave (Medical/Health)</option>
                  <option value="casual">Casual Leave (Short Personal Urgency)</option>
                  <option value="parental">Parental Leave (Maternity/Paternity)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Start Date</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">End Date</label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all"
                  />
                </div>
              </div>

              {businessDays > 0 && (
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/60 flex justify-between items-center text-xs text-slate-800">
                  <span className="font-semibold text-slate-500">Calculated Business Days:</span>
                  <span className="font-bold text-slate-950">{businessDays} working days</span>
                </div>
              )}

              {/* Overdraft Warning Banner */}
              {businessDays > 0 && isInsufficient && (
                <div className="p-3.5 bg-amber-50/50 rounded-lg border border-amber-200/50 flex items-start space-x-3 text-xs text-amber-900 leading-relaxed">
                  <AlertTriangle className="h-4.5 w-4.5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block mb-0.5 text-amber-900">Overdraft Alert</span>
                    Requested <span className="font-bold">{businessDays} days</span> exceeds your remaining {leaveType} balance of <span className="font-bold">{remainingBalance} days</span>. This request will be flagged for review.
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Reason for Absence</label>
                <textarea
                  required
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Provide details for your manager to review..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-slate-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all"
                ></textarea>
              </div>

              <button
                type="submit"
                disabled={formLoading}
                className="w-full flex items-center justify-center px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg shadow-sm transition-all duration-150 disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5 mr-2" />
                {formLoading ? "Submitting Request..." : "Submit Leave Request"}
              </button>
            </form>
          </div>
        </div>

        {/* Request History */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-2.5">
                <div className="h-10 w-10 rounded-lg bg-slate-50 text-slate-600 flex items-center justify-center">
                  <History className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">My Leave Applications</h3>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleGenerateLatestApprovedReport}
                  className="inline-flex items-center text-xs text-slate-700 hover:text-slate-900 font-bold border border-slate-200/80 px-2.5 py-1 rounded-md bg-white hover:bg-slate-50 transition-colors shadow-xs"
                  title="Generate official approved leave statement with updated available balances"
                >
                  <FileCheck2 className="h-3.5 w-3.5 mr-1.5 text-emerald-600" />
                  Generate Report
                </button>
                <button 
                  onClick={loadRequestsHistory}
                  className="text-xs text-slate-500 hover:text-slate-900 font-bold border border-slate-200/80 px-2.5 py-1 rounded-md bg-white hover:bg-slate-50 transition-colors"
                >
                  Refresh
                </button>
              </div>
            </div>

            {historyLoading ? (
              <div className="py-12 text-center text-xs font-semibold text-slate-400">Loading requests history...</div>
            ) : requests.length === 0 ? (
              <div className="py-12 text-center text-xs font-semibold text-slate-400">No leave requests logged yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 text-[10px] uppercase tracking-wider font-bold">
                      <th className="pb-3 font-semibold">Type</th>
                      <th className="pb-3 font-semibold">Dates & Duration</th>
                      <th className="pb-3 font-semibold">Reason & Cancellation Info</th>
                      <th className="pb-3 font-semibold text-center">Status</th>
                      <th className="pb-3 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-xs font-semibold">
                    {requests.map((req) => {
                      const style = typeMap[req.leaveType];
                      const badge = statusBadges[req.status];
                      const formattedDates = `${new Date(req.startDate).toLocaleDateString(undefined, {month: "short", day: "numeric"})} - ${new Date(req.endDate).toLocaleDateString(undefined, {month: "short", day: "numeric", year: "numeric"})}`;
                      const canCancel = (req.status === "pending" || req.status === "approved");
                      const todayStr = new Date().toISOString().split("T")[0];
                      const isPast = req.startDate <= todayStr;

                      return (
                        <tr key={req.id} className="hover:bg-slate-50/40 group transition-colors">
                          <td className="py-4 align-top">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[9px] uppercase tracking-wider font-bold ${style.text} ${style.bg} border border-slate-200/50`}>
                              {style.name}
                            </span>
                          </td>
                          <td className="py-4 text-slate-900 font-medium align-top">
                            <div>{formattedDates}</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">Duration: <span className="font-bold text-slate-900">{req.duration ?? req.totalDays} business days</span></div>
                          </td>
                          <td className="py-4 max-w-xs align-top">
                            <div className="text-slate-700 font-medium">{req.reason}</div>
                            
                            {/* Cancellation & Processing info details */}
                            {req.status === "cancelled" && (
                              <div className="text-[10px] text-rose-600 mt-1 font-semibold space-y-0.5 bg-rose-50/40 border border-rose-100/50 p-1.5 rounded-md">
                                <div>• Cancelled on: {req.cancelledAt ? new Date(req.cancelledAt).toLocaleString() : "Recently"}</div>
                                {req.cancellationReason && <div>• Reason: "{req.cancellationReason}"</div>}
                              </div>
                            )}

                            {req.status === "cancellation_pending" && (
                              <div className="text-[10px] text-sky-700 mt-1 font-semibold space-y-0.5 bg-sky-50/40 border border-sky-100/50 p-1.5 rounded-md">
                                <div>• Requested cancellation: {req.cancellationRequestedAt ? new Date(req.cancellationRequestedAt).toLocaleString() : "Recently"}</div>
                                {req.cancellationReason && <div>• Reason: "{req.cancellationReason}"</div>}
                              </div>
                            )}

                            {req.managerComment && (
                              <div className="text-[10px] text-slate-400 italic mt-1 font-medium bg-slate-50 border border-slate-100/80 p-1.5 rounded-md">
                                Mgr: {req.managerComment}
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
                            <div className="flex items-center justify-end space-x-2">
                              {req.status === "approved" && (
                                <button
                                  onClick={() => handleOpenReport(req)}
                                  className="inline-flex items-center text-[11px] font-bold px-2.5 py-1 rounded-lg text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 transition-all shadow-xs"
                                  title="Generate and view official approval report with updated leave balances"
                                >
                                  <FileCheck2 className="h-3.5 w-3.5 mr-1 text-emerald-600" />
                                  Generate Report
                                </button>
                              )}
                              {canCancel ? (
                                <button
                                  onClick={() => openCancelModal(req)}
                                  disabled={isPast}
                                  className={`inline-flex items-center text-[11px] font-bold p-1.5 rounded-lg transition-colors ${
                                    isPast 
                                      ? "text-slate-300 cursor-not-allowed" 
                                      : "text-rose-600 hover:text-rose-800 hover:bg-rose-50"
                                  }`}
                                  title={isPast ? "Cannot cancel once leave has started" : "Cancel request"}
                                >
                                  <Ban className="h-3 w-3 mr-1" />
                                  Cancel
                                </button>
                              ) : (
                                req.status !== "approved" && <span className="text-xs text-slate-300">-</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Cancellation History & Audit Trail */}
          <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm p-6">
            <div className="flex items-center space-x-2.5 mb-6">
              <div className="h-10 w-10 rounded-lg bg-slate-50 text-slate-600 flex items-center justify-center">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Activity Logs & Audit Trail</h3>
                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Zero-trust cryptographic trace of all leave events</p>
              </div>
            </div>

            {logsLoading ? (
              <div className="py-8 text-center text-xs font-semibold text-slate-400">Loading activity trail...</div>
            ) : auditLogs.length === 0 ? (
              <div className="py-8 text-center text-xs font-semibold text-slate-400">No activity logged yet.</div>
            ) : (
              <div className="flow-root">
                <ul className="-mb-8">
                  {auditLogs.map((log, idx) => (
                    <li key={log.id}>
                      <div className="relative pb-8">
                        {idx !== auditLogs.length - 1 ? (
                          <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-slate-100" aria-hidden="true" />
                        ) : null}
                        <div className="relative flex space-x-3">
                          <div>
                            <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${
                              log.action === "leave_submitted" 
                                ? "bg-amber-50 text-amber-700" 
                                : log.action === "leave_cancelled" 
                                  ? "bg-rose-50 text-rose-700"
                                  : log.action === "leave_cancellation_requested"
                                    ? "bg-sky-50 text-sky-700"
                                    : "bg-emerald-50 text-emerald-700"
                            }`}>
                              {log.action === "leave_submitted" ? (
                                <Send className="h-3 w-3" />
                              ) : log.action === "leave_approved" ? (
                                <CheckCircle className="h-3 w-3" />
                              ) : (
                                <Ban className="h-3 w-3" />
                              )}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0 pt-1.5 flex justify-between space-x-4">
                            <div>
                              <p className="text-xs text-slate-800 font-semibold">
                                <span className="font-bold text-slate-950">{log.actorName}</span> (Role: {log.actorRole}){" "}
                                <span className="font-medium text-slate-500">performed</span>{" "}
                                <span className="font-bold text-slate-900">
                                  {log.action === "leave_submitted" && "Leave Submission"}
                                  {log.action === "leave_approved" && "Leave Approval"}
                                  {log.action === "leave_rejected" && "Leave Decline"}
                                  {log.action === "leave_cancelled" && "Leave Cancellation"}
                                  {log.action === "leave_cancellation_requested" && "Cancellation Requested"}
                                </span>
                              </p>
                              {log.reason && (
                                <p className="text-[10px] text-slate-500 italic mt-0.5 font-medium">Reason: "{log.reason}"</p>
                              )}
                              <p className="text-[10px] text-slate-400 mt-1 flex items-center font-bold uppercase tracking-wider">
                                {log.previousStatus} <ChevronRight className="h-2.5 w-2.5 mx-1" /> {log.newStatus}
                              </p>
                            </div>
                            <div className="text-right text-[10px] whitespace-nowrap text-slate-400 font-semibold align-top">
                              {new Date(log.timestamp).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cancellation Modal */}
      {cancellingRequest && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="relative bg-white rounded-xl shadow-xl border border-slate-100 max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-sm font-bold text-slate-900 mb-2">
              {cancellingRequest.status === "approved" 
                ? "Request Leave Cancellation" 
                : "Cancel Pending Leave"}
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed mb-4">
              {cancellingRequest.status === "approved"
                ? "Since this leave is already approved, your cancellation request will be routed to HR. Once processed, your leave balances will be fully refunded."
                : "This pending leave request will be cancelled immediately. It does not require HR approval."}
            </p>

            <div className="bg-slate-50 border border-slate-200/60 p-3 rounded-lg text-xs font-semibold mb-4 text-slate-800 space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">Category:</span>
                <span className="text-slate-900 capitalize font-bold">{cancellingRequest.leaveType} Leave</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Dates:</span>
                <span className="text-slate-900 font-bold">
                  {new Date(cancellingRequest.startDate).toLocaleDateString()} - {new Date(cancellingRequest.endDate).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Duration:</span>
                <span className="text-slate-900 font-bold">{cancellingRequest.duration ?? cancellingRequest.totalDays} business days</span>
              </div>
            </div>

            {cancelError && (
              <div className="p-3 mb-4 rounded-lg bg-rose-50 border border-rose-200/60 text-xs text-rose-800 font-semibold">
                {cancelError}
              </div>
            )}

            <form onSubmit={handleCancelSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Reason for Cancellation</label>
                <textarea
                  required
                  rows={3}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Explain why you are cancelling this leave application..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-slate-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all"
                ></textarea>
              </div>

              <div className="flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setCancellingRequest(null)}
                  className="px-3.5 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg transition-colors"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={cancelLoading}
                  className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-sm transition-colors"
                >
                  {cancelLoading ? "Processing..." : "Confirm Cancellation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* OFFICIAL APPROVED LEAVE STATEMENT & UPDATED BALANCE REPORT MODAL */}
      {isReportModalOpen && selectedReportRequest && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full p-6 sm:p-8 animate-in zoom-in-95 duration-200 overflow-hidden">
            
            {/* Header / Document Bar */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-5 mb-6">
              <div className="flex items-center space-x-3">
                <BrandLogo className="h-11 w-11 drop-shadow-md" />
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                      Official HR Approved Document
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono font-semibold">
                      REF-{selectedReportRequest.id.substring(0, 8).toUpperCase()}
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight mt-1">
                    Employee Leave Approval & Balance Statement
                  </h3>
                  <p className="text-[11px] text-slate-400 font-semibold">
                    Generated on {new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })} at {new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
                  title="Print this statement"
                >
                  <Printer className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsReportModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                  title="Close report"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="space-y-6 text-left">
              {/* HR Approval Stamp Banner */}
              <div className="p-4 rounded-xl bg-emerald-50/90 border border-emerald-200/90 flex items-start space-x-3.5 shadow-xs">
                <div className="p-2 bg-emerald-500 text-white rounded-lg flex-shrink-0 mt-0.5">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                      Leave Approved by Human Resources
                    </h4>
                    <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                      Verified & Deducted
                    </span>
                  </div>
                  <p className="text-xs text-emerald-800 mt-1 font-medium leading-relaxed">
                    This leave request has been officially approved by HR operations. Required business days have been deducted from the employee's entitled leave allowance.
                  </p>
                  {selectedReportRequest.managerComment && (
                    <div className="mt-2 text-[11px] text-emerald-900 bg-white/70 border border-emerald-200/60 p-2 rounded-lg font-medium">
                      <span className="font-bold">HR/Manager Remark:</span> "{selectedReportRequest.managerComment}"
                    </div>
                  )}
                  <div className="mt-2 text-[10px] text-emerald-700 font-semibold">
                    Approved Timestamp: {new Date(selectedReportRequest.approvedAt || selectedReportRequest.updatedAt).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Employee Identification Card */}
              <div className="bg-slate-50 border border-slate-200/70 rounded-xl p-4">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">
                  Employee Corporate Profile
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">Employee Name</span>
                    <span className="font-bold text-slate-900 block truncate">{user?.name}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">Employee ID / UID</span>
                    <span className="font-bold text-slate-900 block truncate font-mono">{user?.uid}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">Department</span>
                    <span className="font-bold text-slate-900 block truncate">{user?.department}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">Designation</span>
                    <span className="font-bold text-slate-900 block truncate">{user?.title}</span>
                  </div>
                </div>
              </div>

              {/* Approved Leave Application Specification */}
              <div className="border border-slate-200/80 rounded-xl p-4">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
                  Approved Leave Specifications
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                  <div className="p-2.5 bg-slate-50/80 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 block font-semibold">Leave Type</span>
                    <span className="text-xs font-bold text-slate-900 capitalize flex items-center mt-0.5">
                      <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${typeMap[selectedReportRequest.leaveType as LeaveType]?.barColor || 'bg-slate-700'}`}></span>
                      {typeMap[selectedReportRequest.leaveType as LeaveType]?.name || selectedReportRequest.leaveType}
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-50/80 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 block font-semibold">Approved Duration</span>
                    <span className="text-xs font-extrabold text-slate-900 block mt-0.5">
                      {selectedReportRequest.duration ?? selectedReportRequest.totalDays} Business Days
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-50/80 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 block font-semibold">Effective Dates</span>
                    <span className="text-xs font-bold text-slate-900 block mt-0.5">
                      {new Date(selectedReportRequest.startDate).toLocaleDateString()} – {new Date(selectedReportRequest.endDate).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="text-xs text-slate-600 bg-slate-50/50 p-2.5 rounded-lg border border-slate-100">
                  <span className="font-bold text-slate-700 text-[11px]">Reason for absence: </span>
                  <span className="italic">{selectedReportRequest.reason}</span>
                </div>
              </div>

              {/* UPDATED LEAVE AVAILABLE FOR THE EMPLOYEE */}
              <div className="border-2 border-emerald-200/80 bg-gradient-to-b from-emerald-50/30 to-white rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center">
                      <Sparkles className="h-3.5 w-3.5 mr-1.5 text-emerald-600" />
                      Updated Leave Available for Employee
                    </h4>
                    <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
                      Real-time available quota after deducting the approved leave
                    </p>
                  </div>
                  <span className="px-2.5 py-1 text-[10px] font-extrabold bg-emerald-600 text-white rounded-md shadow-xs">
                    Current Balance Status
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-emerald-100 text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                        <th className="pb-2 font-bold">Category</th>
                        <th className="pb-2 font-bold text-center">Annual Quota</th>
                        <th className="pb-2 font-bold text-center">Days Used</th>
                        <th className="pb-2 font-bold text-right">Available Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs font-medium">
                      {(["annual", "sick", "casual", "parental"] as LeaveType[]).map((type) => {
                        const cat = balances ? balances[type] : { total: 0, used: 0 };
                        const available = cat.total - cat.used;
                        const isDeductedCategory = selectedReportRequest.leaveType === type;
                        const typeInfo = typeMap[type];

                        return (
                          <tr 
                            key={type} 
                            className={isDeductedCategory ? "bg-emerald-50/50 font-bold" : "hover:bg-slate-50/50"}
                          >
                            <td className="py-2.5">
                              <div className="flex items-center space-x-1.5">
                                <span className={`w-2 h-2 rounded-full ${typeInfo.barColor}`}></span>
                                <span className="text-slate-900">{typeInfo.name}</span>
                                {isDeductedCategory && (
                                  <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold ml-1">
                                    Deducted ✓
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 text-center text-slate-600">
                              {cat.total} days
                            </td>
                            <td className="py-2.5 text-center text-slate-600">
                              {cat.used} days
                            </td>
                            <td className="py-2.5 text-right">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-black ${
                                isDeductedCategory 
                                  ? "bg-emerald-600 text-white shadow-xs" 
                                  : "bg-slate-100 text-slate-800"
                              }`}>
                                {available} Days Available
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="mt-3.5 pt-3 border-t border-emerald-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11px] text-emerald-900 font-semibold">
                  <span>
                    ✓ Deducted <strong>{selectedReportRequest.duration ?? selectedReportRequest.totalDays} business days</strong> from {typeMap[selectedReportRequest.leaveType as LeaveType]?.name || selectedReportRequest.leaveType}.
                  </span>
                  <span className="text-emerald-700 font-bold">
                    Zero-Trust Audit Verified
                  </span>
                </div>
              </div>

              {/* Footer / Digital Verification */}
              <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-slate-400 text-[10px] font-semibold">
                <div className="flex items-center space-x-1.5">
                  <ShieldCheck className="h-4 w-4 text-slate-400" />
                  <span>Enterprise Leave Management System • System Certified Audit Record</span>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg font-bold transition flex items-center space-x-1"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    <span>Print Statement</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsReportModalOpen(false)}
                    className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold transition"
                  >
                    Close
                  </button>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}
    </div>
  );
};
