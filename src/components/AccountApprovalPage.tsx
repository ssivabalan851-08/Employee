import React, { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { BrandLogo } from "./BrandLogo.tsx";
import { supabaseAuth } from "../lib/supabase.ts";
import type { AccountApprovalResult } from "../lib/supabase.ts";

type ApprovalDecision = "approve" | "reject";

function readApprovalRequest() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token") || "";
  const rawDecision = params.get("decision");
  const decision: ApprovalDecision | null = rawDecision === "approve" || rawDecision === "reject" ? rawDecision : null;
  return { token, decision, valid: /^[0-9a-f-]{36}$/i.test(token) && Boolean(decision) };
}

export const AccountApprovalPage: React.FC = () => {
  const request = useMemo(readApprovalRequest, []);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<AccountApprovalResult | null>(null);

  const approving = request.decision === "approve";

  const submitDecision = async () => {
    if (!request.valid || !request.decision || submitting) return;
    setSubmitting(true);
    try {
      setResult(await supabaseAuth.decideAccountApproval(request.token, request.decision));
    } catch (error) {
      setResult({
        ok: false,
        title: "Decision could not be completed",
        message: error instanceof Error ? error.message : "Please reopen the approval email and try again.",
        kind: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const invalidResult: AccountApprovalResult = {
    ok: false,
    title: "Invalid approval link",
    message: "This approval link is incomplete or invalid. Open the latest LeaveWise approval email and try again.",
    kind: "error",
  };

  const displayedResult = request.valid ? result : invalidResult;
  const ResultIcon = displayedResult?.kind === "success" ? CheckCircle2 : displayedResult?.kind === "warning" ? AlertTriangle : XCircle;
  const accent = displayedResult?.kind === "success" ? "text-emerald-700 bg-emerald-50 border-emerald-200" : displayedResult?.kind === "warning" ? "text-amber-700 bg-amber-50 border-amber-200" : "text-rose-700 bg-rose-50 border-rose-200";

  return (
    <main className="min-h-screen bg-[#edf7f5] px-4 py-10 sm:py-16 flex items-center justify-center font-sans">
      <section className="w-full max-w-xl overflow-hidden rounded-3xl border border-[#cfe4e1] bg-white shadow-[0_24px_70px_rgba(6,59,57,0.14)]">
        <header className="bg-[#063b39] px-6 py-8 text-center">
          <BrandLogo className="mx-auto" />
          <p className="mt-4 text-xs font-bold tracking-[0.2em] text-[#a9f4ef]">SECURE ACCOUNT APPROVAL</p>
        </header>

        <div className="px-6 py-8 sm:px-10 sm:py-10">
          {displayedResult ? (
            <div className="text-center">
              <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border ${accent}`}>
                <ResultIcon className="h-8 w-8" />
              </div>
              <h1 className="mt-6 text-2xl font-extrabold tracking-tight text-slate-900">{displayedResult.title}</h1>
              <p className="mt-3 text-sm leading-7 text-slate-600">{displayedResult.message}</p>
              <a href="/" className="mt-7 inline-flex min-h-12 items-center justify-center rounded-xl bg-[#063b39] px-6 text-sm font-bold text-white shadow-sm transition hover:bg-[#0a514e]">
                Open LeaveWise
              </a>
            </div>
          ) : (
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-[#087d78]">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <p className="mt-6 text-xs font-bold uppercase tracking-[0.16em] text-[#087d78]">Administrator decision</p>
              <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900">
                {approving ? "Approve this account?" : "Reject this account?"}
              </h1>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                {approving
                  ? "Approval activates the requested LeaveWise access and sends one SMS to the applicant's registered mobile number."
                  : "Rejection keeps the account inactive. The applicant will not receive an approval email."}
              </p>
              <div className="mt-7 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-xs leading-6 text-slate-600">
                No change is made until you press the confirmation button below.
              </div>
              <button
                type="button"
                onClick={submitDecision}
                disabled={submitting}
                className={`mt-7 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${approving ? "bg-[#087d78] hover:bg-[#066864]" : "bg-rose-700 hover:bg-rose-800"}`}
              >
                {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : approving ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                {submitting ? "Processing decision..." : approving ? "Confirm account approval" : "Confirm account rejection"}
              </button>
            </div>
          )}
        </div>
      </section>
    </main>
  );
};
