// @ts-nocheck -- Runs in the Supabase Deno Edge Function runtime.
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SECRET_KEY") || "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY") || "";
const ADMIN_EMAIL = Deno.env.get("ADMIN_APPROVAL_EMAIL") || "ssivabalan851@gmail.com";
const CONTACT_EMAIL = Deno.env.get("APPROVAL_CONTACT_EMAIL") || ADMIN_EMAIL;
const CONTACT_PHONE = Deno.env.get("APPROVAL_CONTACT_PHONE") || "";
const FROM_EMAIL = Deno.env.get("APPROVAL_FROM_EMAIL") || "LeaveWise Accounts <onboarding@resend.dev>";
const BREVO_SENDER_EMAIL = Deno.env.get("BREVO_SENDER_EMAIL") || CONTACT_EMAIL;
const BREVO_SENDER_NAME = Deno.env.get("BREVO_SENDER_NAME") || "LeaveWise Accounts";
const BREVO_SMS_SENDER = (Deno.env.get("BREVO_SMS_SENDER") || "LeaveWise").replace(/[^A-Za-z0-9]/g, "").slice(0, 11);
const SITE_URL = (Deno.env.get("SITE_URL") || "https://employee-leave-portal.ssivabalan851.chatgpt.site").replace(/\/$/, "");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const serviceHeaders = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};

const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
}[character] || character));

async function sha256(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function json(response: Response) {
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.message || data?.error || `Supabase request failed (${response.status})`);
  return data;
}

function shell(content: string) {
  const phone = CONTACT_PHONE ? `<div style="margin-top:4px">Phone: <strong>${escapeHtml(CONTACT_PHONE)}</strong></div>` : "";
  return `<div style="margin:0;background:#eef7f6;padding:28px 12px;font-family:Arial,sans-serif;color:#0f2f2d">
    <div style="max-width:640px;margin:auto;background:#fff;border:1px solid #cfe4e1;border-radius:18px;overflow:hidden;box-shadow:0 14px 40px rgba(6,59,57,.10)">
      <div style="background:#063b39;padding:24px 28px;text-align:center"><img src="${SITE_URL}/leavewise-logo.png" alt="LeaveWise" width="180" style="max-width:180px;height:auto"><div style="color:#a9f4ef;font-size:12px;letter-spacing:1.6px;font-weight:700;margin-top:10px">EMPLOYEE LEAVE MANAGEMENT</div></div>
      <div style="padding:30px 28px">${content}</div>
      <div style="background:#f5fbfa;border-top:1px solid #d8ebe8;padding:20px 28px;color:#476764;font-size:12px;line-height:1.6">Need clarification?<div style="margin-top:4px">Email: <a href="mailto:${escapeHtml(CONTACT_EMAIL)}" style="color:#087d78;font-weight:700">${escapeHtml(CONTACT_EMAIL)}</a></div>${phone}<div style="margin-top:12px">Sent securely by LeaveWise on behalf of your company.</div></div>
    </div>
  </div>`;
}

async function sendEmail(to: string, subject: string, html: string) {
  if (BREVO_API_KEY) {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": BREVO_API_KEY, accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: { name: BREVO_SENDER_NAME, email: BREVO_SENDER_EMAIL },
        to: [{ email: to }],
        replyTo: { name: "LeaveWise Support", email: CONTACT_EMAIL },
        subject,
        htmlContent: html,
      }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) throw new Error(result?.message || "Email could not be delivered through Brevo.");
    return result;
  }

  if (!RESEND_API_KEY) throw new Error("Approval email delivery is not configured. Add a Brevo or Resend API key.");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.message || "Email could not be delivered.");
  return result;
}

async function sendApprovalSms(phoneNumber: string) {
  if (!BREVO_API_KEY) throw new Error("Brevo SMS delivery is not configured.");
  if (!/^\+[1-9][0-9]{7,14}$/.test(phoneNumber)) throw new Error("The applicant does not have a valid mobile number.");
  const response = await fetch("https://api.brevo.com/v3/transactionalSMS/send", {
    method: "POST",
    headers: { "api-key": BREVO_API_KEY, accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      sender: BREVO_SMS_SENDER,
      recipient: phoneNumber,
      content: "LeaveWise: Your account has been approved. You can now sign in with your registered email.",
      type: "transactional",
      tag: "account-approved",
    }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.message || "The approval SMS could not be delivered through Brevo.");
  return String(result?.messageId || "");
}

async function requireMatchingUser(request: Request, userId: string) {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.toLowerCase().startsWith("bearer ")) throw new Error("Sign in is required to request account approval.");
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: authorization, apikey: ANON_KEY || SERVICE_KEY },
  });
  const user = await json(response);
  if (user?.id !== userId) throw new Error("The account request does not match the signed-in user.");
}

function resultPage(title: string, message: string, kind: "success" | "warning" | "error" = "success") {
  const color = kind === "success" ? "#087d78" : kind === "warning" ? "#b45309" : "#be123c";
  return new Response(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(title)}</title></head><body style="margin:0;background:#eef7f6;padding:48px 16px;font-family:Arial,sans-serif;color:#0f2f2d"><main style="max-width:580px;margin:auto;background:#fff;border:1px solid #cfe4e1;border-radius:20px;overflow:hidden;box-shadow:0 18px 50px rgba(6,59,57,.12)"><div style="background:#063b39;padding:24px;text-align:center"><img src="${SITE_URL}/leavewise-logo.png" alt="LeaveWise" width="180"></div><div style="padding:34px"><div style="width:48px;height:48px;border-radius:50%;background:${color};color:white;font-size:28px;line-height:48px;text-align:center">${kind === "success" ? "✓" : "!"}</div><h1 style="margin:20px 0 10px">${escapeHtml(title)}</h1><p style="line-height:1.7;color:#476764">${escapeHtml(message)}</p><a href="${SITE_URL}" style="display:inline-block;margin-top:16px;background:#063b39;color:white;padding:12px 18px;border-radius:9px;text-decoration:none;font-weight:700">Open LeaveWise</a></div></main></body></html>`, { status: kind === "error" ? 400 : 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

function confirmationPage(token: string, decision: string) {
  const approving = decision === "approve";
  const label = approving ? "Approve account" : "Reject account";
  const color = approving ? "#087d78" : "#be123c";
  return new Response(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${label}</title></head><body style="margin:0;background:#eef7f6;padding:48px 16px;font-family:Arial,sans-serif;color:#0f2f2d"><main style="max-width:580px;margin:auto;background:#fff;border:1px solid #cfe4e1;border-radius:20px;overflow:hidden;box-shadow:0 18px 50px rgba(6,59,57,.12)"><div style="background:#063b39;padding:24px;text-align:center"><img src="${SITE_URL}/leavewise-logo.png" alt="LeaveWise" width="180"></div><div style="padding:34px"><h1>Confirm your decision</h1><p style="line-height:1.7;color:#476764">Select the button below to ${approving ? "approve this account and grant the requested access. LeaveWise will send one SMS to the applicant's registered mobile number" : "reject this account request. No applicant email will be sent"}.</p><form method="post"><input type="hidden" name="token" value="${escapeHtml(token)}"><input type="hidden" name="decision" value="${escapeHtml(decision)}"><button type="submit" style="border:0;background:${color};color:white;padding:13px 20px;border-radius:9px;font-size:15px;font-weight:700;cursor:pointer">${label}</button></form></div></main></body></html>`, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

async function handleDecision(token: string, decision: string) {
  if (!/^[0-9a-f-]{36}$/i.test(token) || !["approve", "reject"].includes(decision)) return resultPage("Invalid approval link", "This approval link is incomplete or invalid.", "error");
  const tokenHash = await sha256(token);
  const rows = await json(await fetch(`${SUPABASE_URL}/rest/v1/account_approval_requests?approval_token_hash=eq.${tokenHash}&select=user_id,decision,approval_sms_sent_at,profiles!inner(email,name,phone_number,requested_role,approval_status)`, { headers: serviceHeaders }));
  const request = rows?.[0];
  if (!request) return resultPage("Approval link not found", "This link is invalid or no longer available.", "error");
  const approved = decision === "approve";
  const finalDecision = approved ? "approved" : "rejected";
  if (request.decision && request.decision !== finalDecision) return resultPage("Request already processed", `This account request was already ${request.decision}.`, "warning");

  const profile = request.profiles;
  const requestedRole = profile.requested_role === "manager" ? "manager" : "employee";
  if (!request.decision) {
    await json(await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${request.user_id}`, {
      method: "PATCH", headers: { ...serviceHeaders, Prefer: "return=representation" },
      body: JSON.stringify({ approval_status: finalDecision, role: approved ? requestedRole : "employee", approved_at: approved ? new Date().toISOString() : null }),
    }));
    await json(await fetch(`${SUPABASE_URL}/rest/v1/account_approval_requests?user_id=eq.${request.user_id}`, {
      method: "PATCH", headers: { ...serviceHeaders, Prefer: "return=representation" },
      body: JSON.stringify({ decision: finalDecision, decided_at: new Date().toISOString() }),
    }));
  }

  if (approved && !request.approval_sms_sent_at) {
    const attemptedAt = new Date().toISOString();
    try {
      const messageId = await sendApprovalSms(profile.phone_number || "");
      await json(await fetch(`${SUPABASE_URL}/rest/v1/account_approval_requests?user_id=eq.${request.user_id}`, {
        method: "PATCH", headers: { ...serviceHeaders, Prefer: "return=representation" },
        body: JSON.stringify({ approval_sms_attempted_at: attemptedAt, approval_sms_sent_at: new Date().toISOString(), approval_sms_message_id: messageId, approval_sms_error: null }),
      }));
    } catch (error) {
      const smsError = error instanceof Error ? error.message : "Approval SMS delivery failed.";
      await json(await fetch(`${SUPABASE_URL}/rest/v1/account_approval_requests?user_id=eq.${request.user_id}`, {
        method: "PATCH", headers: { ...serviceHeaders, Prefer: "return=representation" },
        body: JSON.stringify({ approval_sms_attempted_at: attemptedAt, approval_sms_error: smsError }),
      }));
      return resultPage("Account approved", `Access was granted, but the SMS could not be delivered: ${smsError} Reopen the approval link after correcting the SMS setup to retry.`, "warning");
    }
  }
  return resultPage(approved ? "Account approved" : "Account rejected", approved
    ? `The ${requestedRole === "manager" ? "HR" : "employee"} account is active and an SMS was sent to the registered mobile number.`
    : `The ${requestedRole === "manager" ? "HR" : "employee"} account request was rejected. No applicant email was sent.`);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!SUPABASE_URL || !SERVICE_KEY) return Response.json({ error: "Function database credentials are unavailable." }, { status: 500, headers: corsHeaders });
  try {
    const url = new URL(request.url);
    if (request.method === "GET") {
      const token = url.searchParams.get("token") || "";
      const decision = url.searchParams.get("decision") || "";
      if (!/^[0-9a-f-]{36}$/i.test(token) || !["approve", "reject"].includes(decision)) return resultPage("Invalid approval link", "This approval link is incomplete or invalid.", "error");
      return confirmationPage(token, decision);
    }
    if (request.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });

    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      return await handleDecision(String(form.get("token") || ""), String(form.get("decision") || ""));
    }

    const body = await request.json();
    if (body?.action !== "request") return Response.json({ error: "Invalid action" }, { status: 400, headers: corsHeaders });
    const userId = String(body?.user_id || "");
    if (!/^[0-9a-f-]{36}$/i.test(userId)) return Response.json({ error: "Invalid account request." }, { status: 400, headers: corsHeaders });
    await requireMatchingUser(request, userId);

    const rows = await json(await fetch(`${SUPABASE_URL}/rest/v1/account_approval_requests?user_id=eq.${userId}&select=email_sent_at,decision,profiles!inner(email,name,phone_number,requested_role,department,title,approval_status)`, { headers: serviceHeaders }));
    const approval = rows?.[0];
    if (!approval || approval.profiles?.approval_status !== "pending") return Response.json({ error: "Pending account request not found." }, { status: 404, headers: corsHeaders });
    if (approval.decision) return Response.json({ ok: true }, { headers: corsHeaders });
    const sentAt = approval.email_sent_at ? new Date(approval.email_sent_at).getTime() : 0;
    if (Date.now() - sentAt < 300_000) return Response.json({ ok: true, rate_limited: true }, { headers: corsHeaders });

    const token = crypto.randomUUID();
    const tokenHash = await sha256(token);
    await json(await fetch(`${SUPABASE_URL}/rest/v1/account_approval_requests?user_id=eq.${userId}`, {
      method: "PATCH", headers: { ...serviceHeaders, Prefer: "return=representation" }, body: JSON.stringify({ approval_token_hash: tokenHash }),
    }));
    const functionUrl = `${SUPABASE_URL}/functions/v1/account-approval`;
    const profile = approval.profiles;
    const requestedLabel = profile.requested_role === "manager" ? "HR / Manager" : "Employee";
    const adminContent = `<h1 style="margin:0 0 14px;color:#063b39">New account approval request</h1><p style="line-height:1.7;color:#365b58">A new <strong>${escapeHtml(requestedLabel)}</strong> account is waiting for your decision.</p><table style="border-collapse:collapse;width:100%;margin:22px 0"><tr><td style="padding:10px;border-bottom:1px solid #d8ebe8;color:#67827f">Name</td><td style="padding:10px;border-bottom:1px solid #d8ebe8;font-weight:700">${escapeHtml(profile.name)}</td></tr><tr><td style="padding:10px;border-bottom:1px solid #d8ebe8;color:#67827f">Email</td><td style="padding:10px;border-bottom:1px solid #d8ebe8;font-weight:700">${escapeHtml(profile.email)}</td></tr><tr><td style="padding:10px;border-bottom:1px solid #d8ebe8;color:#67827f">Mobile</td><td style="padding:10px;border-bottom:1px solid #d8ebe8;font-weight:700">${escapeHtml(profile.phone_number || "Not provided")}</td></tr><tr><td style="padding:10px;border-bottom:1px solid #d8ebe8;color:#67827f">Access</td><td style="padding:10px;border-bottom:1px solid #d8ebe8;font-weight:700">${escapeHtml(requestedLabel)}</td></tr><tr><td style="padding:10px;border-bottom:1px solid #d8ebe8;color:#67827f">Department</td><td style="padding:10px;border-bottom:1px solid #d8ebe8;font-weight:700">${escapeHtml(profile.department)}</td></tr><tr><td style="padding:10px;border-bottom:1px solid #d8ebe8;color:#67827f">Job title</td><td style="padding:10px;border-bottom:1px solid #d8ebe8;font-weight:700">${escapeHtml(profile.title)}</td></tr></table><p><a href="${functionUrl}?token=${token}&decision=approve" style="display:inline-block;background:#087d78;color:#fff;padding:13px 20px;border-radius:9px;text-decoration:none;font-weight:700;margin-right:8px">Review & approve</a><a href="${functionUrl}?token=${token}&decision=reject" style="display:inline-block;background:#be123c;color:#fff;padding:13px 20px;border-radius:9px;text-decoration:none;font-weight:700">Review & reject</a></p><p style="color:#67827f;font-size:12px;line-height:1.6">Each link opens a confirmation page. No decision is made until you confirm it. Approval sends one SMS to the registered mobile number; no applicant email is sent.</p>`;
    await sendEmail(ADMIN_EMAIL, `LeaveWise approval required: ${profile.name} (${requestedLabel})`, shell(adminContent));
    await json(await fetch(`${SUPABASE_URL}/rest/v1/account_approval_requests?user_id=eq.${userId}`, {
      method: "PATCH", headers: { ...serviceHeaders, Prefer: "return=representation" }, body: JSON.stringify({ email_sent_at: new Date().toISOString() }),
    }));
    return Response.json({ ok: true }, { headers: corsHeaders });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Approval request failed." }, { status: 500, headers: corsHeaders });
  }
});
