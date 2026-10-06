import React, { useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Info,
  LoaderCircle,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserRoundCheck,
  UsersRound,
  XCircle,
} from "lucide-react";

export interface LeavePolicyCheck {
  key?: string;
  code?: string;
  name?: string;
  label?: string;
  title?: string;
  outcome?: string;
  status?: string;
  message?: string;
  explanation?: string;
  detail?: string;
}

export interface CoverageDailyFact {
  date?: string;
  activeEmployees?: number;
  approvedAway?: number;
  pendingRequests?: number;
  projectedAvailable?: number;
  projectedPercent?: number;
  availableEmployees?: number;
  availableCount?: number;
  totalEmployees?: number;
  totalCount?: number;
  absentCount?: number;
  coveragePercent?: number;
  score?: number;
  level?: string;
}

export interface RecommendedLeaveDates {
  startDate?: string;
  endDate?: string;
  start?: string;
  end?: string;
  score?: number;
  level?: string;
}

export interface LeaveIntelligencePreview {
  previewId: string;
  expiresAt?: string;
  workingDays: number;
  policy: {
    outcome?: string;
    checks?: LeavePolicyCheck[];
    version?: string | number;
  };
  coverage: {
    score?: number;
    level?: string;
    reasons?: string[];
    dailyFacts?: CoverageDailyFact[];
    recommendedDates?: Array<RecommendedLeaveDates | string>;
    handoverRequired?: boolean;
  };
}

export interface HandoverCandidate {
  uid: string;
  name: string;
  title?: string;
  department?: string;
}

export interface HandoverItemDraft {
  title: string;
  details: string;
  dueDate: string;
  resourceUrl: string;
}

export interface HandoverDraft {
  backupUserId: string;
  summary: string;
  items: HandoverItemDraft[];
}

export interface AssignedHandover {
  planId: string;
  leaveRequestId: string;
  ownerName: string;
  startDate: string;
  endDate: string;
  summary: string;
  items?: Array<{ title: string; details?: string; dueDate?: string; resourceUrl?: string }>;
  status: string;
}

interface LeaveIntelligencePanelsProps {
  preview: LeaveIntelligencePreview | null;
  previewLoading: boolean;
  previewError: string | null;
  previewUnavailable: boolean;
  onRetryPreview: () => void;
  onSelectRecommendedDates: (startDate: string, endDate: string) => void;
  handoverRequired: boolean;
  handover: HandoverDraft;
  onHandoverChange: (next: HandoverDraft) => void;
  candidates: HandoverCandidate[];
  candidatesLoading: boolean;
  candidatesError: string | null;
}

const normalizeOutcome = (value?: string) => String(value || "review").trim().toLowerCase();

const outcomeTone = (value?: string) => {
  const normalized = normalizeOutcome(value);
  if (["pass", "passed", "eligible", "allow", "allowed", "approved", "low"].includes(normalized)) {
    return { icon: CheckCircle2, chip: "bg-emerald-50 border-emerald-200/70 text-emerald-800", iconClass: "text-emerald-600", label: normalized === "low" ? "Low risk" : "Passed" };
  }
  if (["fail", "failed", "blocked", "deny", "denied", "high"].includes(normalized)) {
    return { icon: XCircle, chip: "bg-rose-50 border-rose-200/70 text-rose-800", iconClass: "text-rose-600", label: normalized === "high" ? "High risk" : "Action needed" };
  }
  return { icon: AlertTriangle, chip: "bg-amber-50 border-amber-200/70 text-amber-900", iconClass: "text-amber-600", label: normalized === "medium" || normalized === "moderate" ? "Moderate risk" : "Review" };
};

const formatDate = (value?: string) => {
  if (!value) return "";
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

const safeResourceUrl = (value?: string) => {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
};

const checkTitle = (check: LeavePolicyCheck, index: number) => check.label || check.name || check.title || check.code || check.key || `Policy check ${index + 1}`;
const checkDetail = (check: LeavePolicyCheck) => check.explanation || check.message || check.detail || "Rule evaluated against this request.";

const recommendedRange = (item: RecommendedLeaveDates | string) => {
  if (typeof item === "string") {
    const [start, end] = item.includes("/") ? item.split("/") : [item, item];
    return { startDate: start?.trim(), endDate: (end || start)?.trim(), score: undefined };
  }
  return { startDate: item.startDate || item.start || "", endDate: item.endDate || item.end || item.startDate || item.start || "", score: item.score };
};

const coverageFactLabel = (fact: CoverageDailyFact) => {
  const available = fact.availableEmployees ?? fact.availableCount ?? fact.projectedAvailable;
  const total = fact.totalEmployees ?? fact.totalCount ?? fact.activeEmployees;
  if (typeof available === "number" && typeof total === "number") return `${available} of ${total} available`;
  if (typeof fact.absentCount === "number") return `${fact.absentCount} unavailable`;
  const percent = fact.coveragePercent ?? fact.projectedPercent ?? fact.score;
  if (typeof percent === "number") return `${Math.round(percent)}% coverage`;
  return "Coverage evaluated";
};

export const LeaveIntelligencePanels: React.FC<LeaveIntelligencePanelsProps> = ({
  preview,
  previewLoading,
  previewError,
  previewUnavailable,
  onRetryPreview,
  onSelectRecommendedDates,
  handoverRequired,
  handover,
  onHandoverChange,
  candidates,
  candidatesLoading,
  candidatesError,
}) => {
  if (previewLoading) {
    return (
      <div className="rounded-lg border border-sky-200/70 bg-sky-50/70 p-3.5 text-xs text-sky-900" aria-live="polite">
        <div className="flex items-center gap-2 font-bold"><LoaderCircle className="h-4 w-4 animate-spin text-sky-600" />Checking policies and team coverage…</div>
        <p className="mt-1 pl-6 text-[11px] font-medium text-sky-700">LeaveWise is preparing an explainable preview before submission.</p>
      </div>
    );
  }

  if (previewError || previewUnavailable) {
    return (
      <div className={`rounded-lg border p-3.5 text-xs ${previewUnavailable ? "border-amber-200/70 bg-amber-50/70 text-amber-900" : "border-rose-200/70 bg-rose-50/70 text-rose-900"}`} role={previewError ? "alert" : "status"}>
        <div className="flex items-start gap-2.5">
          {previewUnavailable ? <Info className="mt-0.5 h-4 w-4 flex-shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />}
          <div className="min-w-0 flex-1">
            <p className="font-bold">{previewUnavailable ? "Intelligence preview is not available" : "Preview could not be completed"}</p>
            <p className="mt-1 text-[11px] font-medium leading-relaxed">{previewError || "The standard request form remains available. HR will perform the policy and coverage review manually."}</p>
          </div>
          {!previewUnavailable && (
            <button type="button" onClick={onRetryPreview} className="inline-flex items-center gap-1 rounded-md border border-current px-2 py-1 text-[10px] font-bold"><RefreshCw className="h-3 w-3" />Retry</button>
          )}
        </div>
      </div>
    );
  }

  if (!preview) return null;
  const policyTone = outcomeTone(preview.policy?.outcome);
  const coverageTone = outcomeTone(preview.coverage?.level);
  const PolicyIcon = policyTone.icon;
  const CoverageIcon = coverageTone.icon;
  const score = typeof preview.coverage?.score === "number" ? Math.max(0, Math.min(100, Math.round(preview.coverage.score))) : null;
  const checks = Array.isArray(preview.policy?.checks) ? preview.policy.checks : [];
  const dailyFacts = Array.isArray(preview.coverage?.dailyFacts) ? preview.coverage.dailyFacts : [];
  const alternatives = Array.isArray(preview.coverage?.recommendedDates) ? preview.coverage.recommendedDates : [];

  return (
    <div className="space-y-3" aria-live="polite">
      <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/50 px-3.5 py-3">
          <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-sky-700" /><div><h4 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-900">Policy explanation</h4><p className="text-[10px] font-semibold text-slate-500">Rule set {preview.policy?.version || "current"}</p></div></div>
          <span className={`inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-bold ${policyTone.chip}`}><PolicyIcon className={`mr-1 h-3 w-3 ${policyTone.iconClass}`} />{policyTone.label}</span>
        </div>
        <div className="divide-y divide-slate-100 px-3.5">
          {checks.length ? checks.map((check, index) => {
            const tone = outcomeTone(check.outcome || check.status);
            const Icon = tone.icon;
            return (
              <div key={check.key || check.code || `${checkTitle(check, index)}-${index}`} className="flex items-start gap-2.5 py-2.5">
                <Icon className={`mt-0.5 h-3.5 w-3.5 flex-shrink-0 ${tone.iconClass}`} />
                <div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><p className="text-[11px] font-bold text-slate-800">{checkTitle(check, index)}</p><span className="flex-shrink-0 text-[9px] font-extrabold uppercase tracking-wide text-slate-400">{tone.label}</span></div><p className="mt-0.5 text-[10px] font-medium leading-relaxed text-slate-500">{checkDetail(check)}</p></div>
              </div>
            );
          }) : <div className="flex items-center gap-2 py-3 text-[11px] font-medium text-slate-500"><Check className="h-3.5 w-3.5 text-emerald-600" />Policy evaluation completed for this date range.</div>}
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-slate-50/50 px-3.5 py-3">
          <div className="flex items-start gap-2"><UsersRound className="mt-0.5 h-4 w-4 text-sky-700" /><div><h4 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-900">Team coverage</h4><p className="text-[10px] font-semibold text-slate-500">Staffing totals only; coworkers' leave reasons remain private.</p></div></div>
          <div className="flex flex-shrink-0 items-center gap-1.5">{score !== null && <span className="text-lg font-black text-slate-900">{score}<span className="text-[9px] text-slate-400">/100</span></span>}<span className={`inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-bold ${coverageTone.chip}`}><CoverageIcon className={`mr-1 h-3 w-3 ${coverageTone.iconClass}`} />{coverageTone.label}</span></div>
        </div>
        <div className="space-y-3 p-3.5">
          {preview.coverage?.reasons?.length ? <ul className="space-y-1.5">{preview.coverage.reasons.map((entry, index) => <li key={`${entry}-${index}`} className="flex items-start gap-2 text-[10px] font-medium leading-relaxed text-slate-600"><ChevronRight className="mt-0.5 h-3 w-3 flex-shrink-0 text-sky-600" />{entry}</li>)}</ul> : null}
          {dailyFacts.length ? <div><p className="mb-1.5 text-[9px] font-extrabold uppercase tracking-widest text-slate-400">Daily availability</p><div className="grid gap-1.5 sm:grid-cols-2">{dailyFacts.slice(0, 8).map((fact, index) => <div key={`${fact.date || "day"}-${index}`} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/60 px-2.5 py-2"><span className="text-[10px] font-bold text-slate-700">{formatDate(fact.date)}</span><span className={`text-[9px] font-bold ${outcomeTone(fact.level).iconClass}`}>{coverageFactLabel(fact)}</span></div>)}</div></div> : null}
          {alternatives.length ? (
            <div className="rounded-lg border border-sky-200/70 bg-sky-50/60 p-2.5"><div className="mb-2 flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5 text-sky-700" /><p className="text-[10px] font-bold text-sky-900">Safer dates with stronger coverage</p></div><div className="flex flex-wrap gap-1.5">{alternatives.slice(0, 4).map((item, index) => {
              const range = recommendedRange(item);
              if (!range.startDate || !range.endDate) return null;
              return <button key={`${range.startDate}-${range.endDate}-${index}`} type="button" onClick={() => onSelectRecommendedDates(range.startDate, range.endDate)} className="rounded-md border border-sky-200 bg-white px-2.5 py-1.5 text-left text-[10px] font-bold text-sky-900 shadow-xs transition hover:border-sky-400 hover:bg-sky-100">{formatDate(range.startDate)} – {formatDate(range.endDate)}{typeof range.score === "number" && <span className="ml-1 text-sky-600">({Math.round(range.score)}/100)</span>}</button>;
            })}</div></div>
          ) : null}
        </div>
      </section>

      {handoverRequired && (
        <section className="overflow-hidden rounded-xl border border-sky-200/80 bg-white shadow-sm">
          <div className="border-b border-sky-100 bg-sky-50/60 px-3.5 py-3"><div className="flex items-start gap-2"><ClipboardCheck className="mt-0.5 h-4 w-4 text-sky-700" /><div><h4 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-900">Handover readiness</h4><p className="mt-0.5 text-[10px] font-semibold leading-relaxed text-slate-500">Required for three or more working days or high coverage risk.</p></div></div></div>
          <div className="space-y-3 p-3.5">
            <div><label className="mb-1.5 block text-[9px] font-bold uppercase tracking-widest text-slate-400">Backup employee</label>
              {candidatesLoading ? <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-[10px] font-semibold text-slate-500"><LoaderCircle className="h-3.5 w-3.5 animate-spin" />Loading eligible coworkers…</div>
                : candidatesError ? <div className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-[10px] font-semibold leading-relaxed text-rose-800">{candidatesError}</div>
                : candidates.length === 0 ? <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[10px] font-semibold leading-relaxed text-amber-900">No eligible backup employee is available in your department. Contact HR before submitting.</div>
                : <select required value={handover.backupUserId} onChange={(event) => onHandoverChange({ ...handover, backupUserId: event.target.value })} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"><option value="">Select an eligible backup employee</option>{candidates.map((candidate) => <option key={candidate.uid} value={candidate.uid}>{candidate.name}{candidate.title ? ` — ${candidate.title}` : ""}</option>)}</select>}
            </div>
            <div><label className="mb-1.5 block text-[9px] font-bold uppercase tracking-widest text-slate-400">Handover summary</label><textarea required rows={2} value={handover.summary} onChange={(event) => onHandoverChange({ ...handover, summary: event.target.value })} placeholder="Describe what the backup employee needs to manage." className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10" /></div>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2"><label className="block text-[9px] font-bold uppercase tracking-widest text-slate-400">Handover checklist</label><button type="button" onClick={() => onHandoverChange({ ...handover, items: [...handover.items, { title: "", details: "", dueDate: "", resourceUrl: "" }] })} className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[9px] font-bold text-slate-600 hover:bg-slate-50"><Plus className="h-3 w-3" />Add item</button></div>
              {handover.items.map((item, index) => <div key={index} className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/60 p-2.5">
                <div className="flex items-center justify-between gap-2"><span className="text-[9px] font-extrabold uppercase tracking-wide text-slate-400">Responsibility {index + 1}</span>{handover.items.length > 1 && <button type="button" title="Remove responsibility" onClick={() => onHandoverChange({ ...handover, items: handover.items.filter((_, itemIndex) => itemIndex !== index) })} className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-3.5 w-3.5" /></button>}</div>
                <input required value={item.title} onChange={(event) => onHandoverChange({ ...handover, items: handover.items.map((entry, itemIndex) => itemIndex === index ? { ...entry, title: event.target.value } : entry) })} placeholder="Task or responsibility" className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-[11px] font-semibold text-slate-800 focus:border-slate-900 focus:outline-none" />
                <textarea rows={2} value={item.details} onChange={(event) => onHandoverChange({ ...handover, items: handover.items.map((entry, itemIndex) => itemIndex === index ? { ...entry, details: event.target.value } : entry) })} placeholder="Instructions or context (optional)" className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-[11px] font-semibold text-slate-800 focus:border-slate-900 focus:outline-none" />
                <div className="grid gap-2 sm:grid-cols-2"><input type="date" value={item.dueDate} onChange={(event) => onHandoverChange({ ...handover, items: handover.items.map((entry, itemIndex) => itemIndex === index ? { ...entry, dueDate: event.target.value } : entry) })} aria-label={`Due date for responsibility ${index + 1}`} className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-[11px] font-semibold text-slate-800 focus:border-slate-900 focus:outline-none" /><input type="url" value={item.resourceUrl} onChange={(event) => onHandoverChange({ ...handover, items: handover.items.map((entry, itemIndex) => itemIndex === index ? { ...entry, resourceUrl: event.target.value } : entry) })} placeholder="Resource link (optional)" aria-label={`Resource link for responsibility ${index + 1}`} className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-[11px] font-semibold text-slate-800 focus:border-slate-900 focus:outline-none" /></div>
              </div>)}
            </div>
            <div className="flex items-start gap-2 rounded-lg border border-sky-100 bg-sky-50/60 p-2.5 text-[10px] font-medium leading-relaxed text-sky-900"><UserRoundCheck className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />The selected employee must accept this handover. HR will see the acknowledgment status.</div>
          </div>
        </section>
      )}
    </div>
  );
};

interface IncomingHandoversPanelProps {
  handovers: AssignedHandover[];
  loading: boolean;
  error: string | null;
  processingPlanId: string | null;
  onAccept: (planId: string) => void;
  onDecline: (planId: string, reason: string) => void;
}

export const IncomingHandoversPanel: React.FC<IncomingHandoversPanelProps> = ({ handovers, loading, error, processingPlanId, onAccept, onDecline }) => {
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);
  const [decliningPlanId, setDecliningPlanId] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  if (!loading && !error && handovers.length === 0) return null;

  return (
    <section className="rounded-xl border border-slate-200/60 bg-white p-6 shadow-sm" aria-labelledby="incoming-handovers-title">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-50 text-sky-700"><UserRoundCheck className="h-5 w-5" /></div><div><h3 id="incoming-handovers-title" className="text-sm font-bold text-slate-900">Incoming handovers</h3><p className="mt-0.5 text-[10px] font-semibold text-slate-500">Confirm whether you can cover these responsibilities.</p></div></div>
        {handovers.length > 0 && <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[10px] font-extrabold text-sky-700">{handovers.length} assigned</span>}
      </div>
      {loading ? <div className="flex items-center gap-2 py-4 text-xs font-semibold text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" />Loading handovers…</div>
        : error ? <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800" role="alert">{error}</div>
        : <div className="space-y-2.5">{handovers.map((plan) => {
          const waiting = plan.status === "awaiting_acknowledgment";
          const expanded = expandedPlanId === plan.planId;
          return <article key={plan.planId} className="overflow-hidden rounded-lg border border-slate-200">
            <button type="button" onClick={() => setExpandedPlanId(expanded ? null : plan.planId)} aria-expanded={expanded} className="flex w-full items-center justify-between gap-3 bg-slate-50/60 px-3.5 py-3 text-left">
              <div className="min-w-0"><p className="truncate text-xs font-bold text-slate-900">Coverage for {plan.ownerName}</p><p className="mt-0.5 text-[10px] font-semibold text-slate-500">{formatDate(plan.startDate)} – {formatDate(plan.endDate)}</p></div>
              <div className="flex items-center gap-2"><span className={`rounded-full px-2 py-1 text-[9px] font-extrabold uppercase ${waiting ? "bg-amber-50 text-amber-800" : plan.status === "accepted" || plan.status === "ready" ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>{waiting ? "Response needed" : plan.status.replaceAll("_", " ")}</span><ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`} /></div>
            </button>
            {expanded && <div className="space-y-3 border-t border-slate-100 p-3.5"><div><p className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400">Summary</p><p className="mt-1 text-[11px] font-medium leading-relaxed text-slate-700">{plan.summary}</p></div>
              {plan.items?.length ? <div><p className="mb-1.5 text-[9px] font-extrabold uppercase tracking-widest text-slate-400">Responsibilities</p><ul className="space-y-1.5">{plan.items.map((item, index) => {
                const resourceUrl = safeResourceUrl(item.resourceUrl);
                return <li key={`${item.title}-${index}`} className="rounded-md bg-slate-50 p-2.5"><p className="text-[11px] font-bold text-slate-800">{item.title}</p>{item.details && <p className="mt-0.5 text-[10px] font-medium text-slate-500">{item.details}</p>}{item.dueDate && <p className="mt-1 text-[9px] font-bold text-slate-400">Due {formatDate(item.dueDate)}</p>}{resourceUrl && <a href={resourceUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[10px] font-bold text-sky-700 underline">Open resource</a>}</li>;
              })}</ul></div> : null}
              {waiting && decliningPlanId !== plan.planId && <div className="flex flex-wrap justify-end gap-2"><button type="button" disabled={processingPlanId === plan.planId} onClick={() => { setDecliningPlanId(plan.planId); setDeclineReason(""); }} className="rounded-lg border border-rose-200 px-3 py-2 text-[10px] font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50">Decline</button><button type="button" disabled={processingPlanId === plan.planId} onClick={() => onAccept(plan.planId)} className="rounded-lg bg-slate-900 px-3 py-2 text-[10px] font-bold text-white hover:bg-slate-800 disabled:opacity-50">{processingPlanId === plan.planId ? "Saving…" : "Accept handover"}</button></div>}
              {waiting && decliningPlanId === plan.planId && <div className="rounded-lg border border-rose-200 bg-rose-50/60 p-3"><label className="mb-1.5 block text-[9px] font-extrabold uppercase tracking-widest text-rose-700">Reason for declining</label><textarea autoFocus rows={2} value={declineReason} onChange={(event) => setDeclineReason(event.target.value)} placeholder="Explain why you cannot provide coverage." className="w-full rounded-md border border-rose-200 bg-white px-2.5 py-2 text-[11px] font-semibold text-slate-800 focus:outline-none" /><div className="mt-2 flex justify-end gap-2"><button type="button" onClick={() => setDecliningPlanId(null)} className="rounded-md px-2.5 py-1.5 text-[10px] font-bold text-slate-600">Cancel</button><button type="button" disabled={!declineReason.trim() || processingPlanId === plan.planId} onClick={() => onDecline(plan.planId, declineReason.trim())} className="rounded-md bg-rose-700 px-2.5 py-1.5 text-[10px] font-bold text-white disabled:opacity-50">{processingPlanId === plan.planId ? "Saving…" : "Confirm decline"}</button></div></div>}
            </div>}
          </article>;
        })}</div>}
    </section>
  );
};

