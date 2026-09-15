import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  runTransaction,
  writeBatch
} from "firebase/firestore";
import { db, auth } from "./firebase.ts";
import { 
  UserProfile, 
  LeaveBalance, 
  LeaveRequest, 
  Notification, 
  LeaveType, 
  LeaveStatus, 
  LeaveStatistics,
  AuditLog
} from "../types.ts";

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const IS_DEMO_TOKEN = (token: string) => token.startsWith("demo-") || token.startsWith("local-") || token.startsWith("usr-");

// NEW: Centralized Leave Status State Machine Transition Logic
export function canTransitionLeaveStatus(currentStatus: LeaveStatus, nextStatus: LeaveStatus): boolean {
  if (currentStatus === nextStatus) return true;

  // Applied/pending can transition to Approved, Rejected, or Cancelled (or Withdrawn)
  if (currentStatus === "pending") {
    return nextStatus === "approved" || nextStatus === "rejected" || nextStatus === "cancelled" || nextStatus === "withdrawn";
  }

  // Approved can transition to Cancellation Pending or directly Withdrawn
  if (currentStatus === "approved") {
    return nextStatus === "cancellation_pending" || nextStatus === "withdrawn";
  }

  // Cancellation Pending can transition to Cancelled or back to Approved (if cancellation is rejected)
  if (currentStatus === "cancellation_pending") {
    return nextStatus === "cancelled" || nextStatus === "approved";
  }

  // Terminal states (cancelled, rejected, withdrawn) cannot transition further
  return false;
}

// NEW: Normalize old leave requests dynamically for backward compatibility
export function normalizeLeaveRequest(req: any): LeaveRequest {
  const nowStr = new Date().toISOString();
  
  const id = req.id || "req_" + Math.random().toString(36).substring(2, 9);
  const uid = req.uid || req.employeeId || "";
  const employeeId = req.employeeId || uid;
  const employeeName = req.employeeName || "Unknown Employee";
  const employeeEmail = req.employeeEmail || "";
  const department = req.department || "Engineering";
  const leaveType = req.leaveType || "annual";
  const startDate = req.startDate || nowStr.split("T")[0];
  const endDate = req.endDate || nowStr.split("T")[0];
  
  const totalDays = typeof req.totalDays === "number" ? req.totalDays : (typeof req.duration === "number" ? req.duration : 1);
  const duration = typeof req.duration === "number" ? req.duration : totalDays;
  
  const reason = req.reason || "";
  const status = req.status || "pending";
  const createdAt = req.createdAt || req.applicationDate || nowStr;
  const applicationDate = req.applicationDate || createdAt;
  const updatedAt = req.updatedAt || nowStr;
  
  return {
    ...req,
    id,
    uid,
    employeeId,
    employeeName,
    employeeEmail,
    department,
    leaveType,
    startDate,
    endDate,
    totalDays,
    duration,
    reason,
    status,
    createdAt,
    applicationDate,
    updatedAt
  };
}

// ---------------------------------------------------------
// Seed data for Demo Sandbox
// ---------------------------------------------------------
const INITIAL_DEMO_USERS: UserProfile[] = [
  {
    uid: "demo-alice",
    email: "alice@enterprise.com",
    name: "Alice Johnson",
    role: "employee",
    department: "Engineering",
    title: "Software Engineer",
    joinedDate: "2024-03-15",
    createdAt: new Date("2024-03-15T09:00:00Z").toISOString(),
  },
  {
    uid: "demo-bob",
    email: "bob@enterprise.com",
    name: "Bob Smith",
    role: "employee",
    department: "Marketing",
    title: "SEO Specialist",
    joinedDate: "2025-01-10",
    createdAt: new Date("2025-01-10T09:00:00Z").toISOString(),
  },
  {
    uid: "demo-charlie",
    email: "charlie@enterprise.com",
    name: "Charlie Brown",
    role: "employee",
    department: "Product Management",
    title: "Product Manager",
    joinedDate: "2023-08-01",
    createdAt: new Date("2023-08-01T09:00:00Z").toISOString(),
  },
  {
    uid: "demo-diana",
    email: "diana@enterprise.com",
    name: "Diana Prince",
    role: "manager",
    department: "Human Resources",
    title: "HR Director",
    joinedDate: "2022-05-20",
    createdAt: new Date("2022-05-20T09:00:00Z").toISOString(),
  }
];

const INITIAL_DEMO_BALANCES: LeaveBalance[] = [
  {
    uid: "demo-alice",
    annual: { total: 20, used: 4 },
    sick: { total: 10, used: 2 },
    casual: { total: 7, used: 1 },
    parental: { total: 30, used: 0 }
  },
  {
    uid: "demo-bob",
    annual: { total: 20, used: 10 },
    sick: { total: 10, used: 4 },
    casual: { total: 7, used: 3 },
    parental: { total: 30, used: 0 }
  },
  {
    uid: "demo-charlie",
    annual: { total: 20, used: 0 },
    sick: { total: 10, used: 0 },
    casual: { total: 7, used: 0 },
    parental: { total: 30, used: 0 }
  },
  {
    uid: "demo-diana",
    annual: { total: 20, used: 0 },
    sick: { total: 10, used: 0 },
    casual: { total: 7, used: 0 },
    parental: { total: 30, used: 0 }
  }
];

const INITIAL_DEMO_REQUESTS: LeaveRequest[] = [
  {
    id: "req-1",
    uid: "demo-alice",
    employeeName: "Alice Johnson",
    employeeEmail: "alice@enterprise.com",
    leaveType: "annual",
    startDate: "2026-06-10",
    endDate: "2026-06-14",
    totalDays: 3,
    status: "approved",
    reason: "Family summer trip to Hawaii",
    managerComment: "Approved. Enjoy your vacation, Alice!",
    createdAt: new Date("2026-05-01T10:00:00Z").toISOString(),
    processedAt: new Date("2026-05-02T14:30:00Z").toISOString(),
    processedBy: "demo-diana"
  },
  {
    id: "req-2",
    uid: "demo-bob",
    employeeName: "Bob Smith",
    employeeEmail: "bob@enterprise.com",
    leaveType: "sick",
    startDate: "2026-07-02",
    endDate: "2026-07-03",
    totalDays: 2,
    status: "approved",
    reason: "Dental surgery recovery",
    managerComment: "Get well soon, Bob. Thanks for submitting early.",
    createdAt: new Date("2026-07-01T08:15:00Z").toISOString(),
    processedAt: new Date("2026-07-01T11:00:00Z").toISOString(),
    processedBy: "demo-diana"
  },
  {
    id: "req-3",
    uid: "demo-bob",
    employeeName: "Bob Smith",
    employeeEmail: "bob@enterprise.com",
    leaveType: "annual",
    startDate: "2026-09-10",
    endDate: "2026-09-18",
    totalDays: 7,
    status: "pending",
    reason: "Family reunion event",
    createdAt: new Date("2026-09-01T09:00:00Z").toISOString()
  },
  {
    id: "req-4",
    uid: "demo-alice",
    employeeName: "Alice Johnson",
    employeeEmail: "alice@enterprise.com",
    leaveType: "casual",
    startDate: "2026-09-22",
    endDate: "2026-09-22",
    totalDays: 1,
    status: "pending",
    reason: "Urgent personal bank appointment",
    createdAt: new Date("2026-09-02T11:20:00Z").toISOString()
  },
  {
    id: "req-5",
    uid: "demo-charlie",
    employeeName: "Charlie Brown",
    employeeEmail: "charlie@enterprise.com",
    leaveType: "casual",
    startDate: "2026-08-14",
    endDate: "2026-08-14",
    totalDays: 1,
    status: "rejected",
    reason: "Attending a local rock festival",
    managerComment: "Hi Charlie, Engineering/Product team has a major release on Aug 14th. Please reschedule casual leaves around that date.",
    createdAt: new Date("2026-08-10T15:00:00Z").toISOString(),
    processedAt: new Date("2026-08-11T09:00:00Z").toISOString(),
    processedBy: "demo-diana"
  }
] as any[];

const INITIAL_DEMO_NOTIFICATIONS: Notification[] = [
  {
    id: "notif-1",
    uid: "demo-alice",
    title: "Leave Approved 🎉",
    message: "Your annual leave request for Jun 10 - Jun 14 (3 days) has been approved by HR.",
    status: "read",
    createdAt: new Date("2026-05-02T14:30:00Z").toISOString()
  },
  {
    id: "notif-2",
    uid: "demo-bob",
    title: "Leave Approved ✅",
    message: "Your sick leave request for Jul 02 - Jul 03 (2 days) has been approved.",
    status: "unread",
    createdAt: new Date("2026-07-01T11:00:00Z").toISOString()
  },
  {
    id: "notif-3",
    uid: "demo-charlie",
    title: "Leave Request Update ⚠️",
    message: "Your casual leave request for Aug 14 has been declined due to release conflict.",
    status: "unread",
    createdAt: new Date("2026-08-11T09:00:00Z").toISOString()
  }
];

// Local Storage Helper utilities
function getLocal<T>(key: string, initial: T): T {
  const raw = localStorage.getItem(key);
  if (!raw) {
    localStorage.setItem(key, JSON.stringify(initial));
    return initial;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return initial;
  }
}

function setLocal<T>(key: string, val: T) {
  localStorage.setItem(key, JSON.stringify(val));
}

export function calculateBusinessDays(startDateStr: string, endDateStr: string): number {
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
  
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const dayOfWeek = cur.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // 0 = Sunday, 6 = Saturday
      count++;
    }
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

// ---------------------------------------------------------
// Unified Database and Synchronization API
// ---------------------------------------------------------
export const DbService = {
  
  // Register custom user profile (used by registration flow)
  async registerUserProfile(profile: UserProfile, initialBalances?: LeaveBalance) {
    if (IS_DEMO_TOKEN(profile.uid)) {
      const users = getLocal("demo_users", INITIAL_DEMO_USERS);
      const balances = getLocal("demo_balances", INITIAL_DEMO_BALANCES);

      const existingIndex = users.findIndex(u => u.uid === profile.uid || u.email.toLowerCase() === profile.email.toLowerCase());
      if (existingIndex >= 0) {
        users[existingIndex] = profile;
      } else {
        users.push(profile);
      }
      setLocal("demo_users", users);

      const defaultBalance: LeaveBalance = initialBalances || {
        uid: profile.uid,
        annual: { total: 20, used: 0 },
        sick: { total: 10, used: 0 },
        casual: { total: 7, used: 0 },
        parental: { total: 30, used: 0 }
      };
      const bIndex = balances.findIndex(b => b.uid === profile.uid);
      if (bIndex >= 0) {
        balances[bIndex] = defaultBalance;
      } else {
        balances.push(defaultBalance);
      }
      setLocal("demo_balances", balances);

      return { user: profile, balances: defaultBalance };
    } else {
      try {
        const userDocRef = doc(db, "users", profile.uid);
        const balanceDocRef = doc(db, "leave_balances", profile.uid);
        await setDoc(userDocRef, profile);

        const defaultBalance: LeaveBalance = initialBalances || {
          uid: profile.uid,
          annual: { total: 20, used: 0 },
          sick: { total: 10, used: 0 },
          casual: { total: 7, used: 0 },
          parental: { total: 30, used: 0 }
        };
        await setDoc(balanceDocRef, defaultBalance);
        return { user: profile, balances: defaultBalance };
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `users/${profile.uid}`);
      }
    }
  },

  // 1. Get user profile and balance
  async getProfileAndBalances(token: string, emailFromAuth?: string, nameFromAuth?: string, chosenRole?: "employee" | "manager") {
    if (IS_DEMO_TOKEN(token)) {
      const users = getLocal("demo_users", INITIAL_DEMO_USERS);
      const balances = getLocal("demo_balances", INITIAL_DEMO_BALANCES);
      
      let user = users.find(u => u.uid === token);
      
      if (user && chosenRole && user.role !== chosenRole) {
        throw new Error(
          `This account is registered as ${user.role === "manager" ? "HR" : "an Employee"}. You cannot sign in under the ${chosenRole === "manager" ? "HR" : "Employee"} portal.`
        );
      }

      if (!user) {
        // Create demo on the fly
        user = {
          uid: token,
          email: `${token.substring(5)}@enterprise.com`,
          name: token.substring(5).charAt(0).toUpperCase() + token.substring(6),
          role: chosenRole || "employee",
          department: chosenRole === "manager" ? "Human Resources" : "Engineering",
          title: chosenRole === "manager" ? "HR Specialist" : "Team Member",
          joinedDate: new Date().toISOString().split("T")[0],
          createdAt: new Date().toISOString()
        };
        users.push(user);
        setLocal("demo_users", users);
      }
      
      let balance = balances.find(b => b.uid === token);
      if (!balance) {
        balance = {
          uid: token,
          annual: { total: 20, used: 0 },
          sick: { total: 10, used: 0 },
          casual: { total: 7, used: 0 },
          parental: { total: 30, used: 0 }
        };
        balances.push(balance);
        setLocal("demo_balances", balances);
      }
      
      return { user, balances: balance };
    } else {
      // Real authenticated Firebase path
      try {
        const userDocRef = doc(db, "users", token);
        const balanceDocRef = doc(db, "leave_balances", token);
        
        const userDoc = await getDoc(userDocRef);
        const balanceDoc = await getDoc(balanceDocRef);
        
        let user = userDoc.exists() ? (userDoc.data() as UserProfile) : null;
        let balance = balanceDoc.exists() ? (balanceDoc.data() as LeaveBalance) : null;
        
        if (user && chosenRole && user.role !== chosenRole) {
          throw new Error(
            `This account is registered as ${user.role === "manager" ? "HR" : "an Employee"}. You cannot sign in under the ${chosenRole === "manager" ? "HR" : "Employee"} portal.`
          );
        }

        if (!user) {
          const email = emailFromAuth || "unspecified@enterprise.com";
          const name = nameFromAuth || email.split("@")[0] || "New Employee";
          user = {
            uid: token,
            email,
            name,
            role: "employee",
            department: "Engineering",
            title: "Team Member",
            joinedDate: new Date().toISOString().split("T")[0],
            createdAt: new Date().toISOString()
          };
          await setDoc(userDocRef, user);
        }
        
        if (!balance) {
          balance = {
            uid: token,
            annual: { total: 20, used: 0 },
            sick: { total: 10, used: 0 },
            casual: { total: 7, used: 0 },
            parental: { total: 30, used: 0 }
          };
          await setDoc(balanceDocRef, balance);
        }
        
        return { user, balances: balance };
      } catch (err: any) {
        if (err.message && err.message.includes("registered as")) {
          throw err;
        }
        handleFirestoreError(err, OperationType.GET, `users_and_balances/${token}`);
      }
    }
  },

  // 2. Update editable profile fields. Roles are administrator-managed.
  async updateProfile(token: string, updates: { name?: string; department?: string; title?: string }) {
    if (IS_DEMO_TOKEN(token)) {
      const users = getLocal("demo_users", INITIAL_DEMO_USERS);
      const idx = users.findIndex(u => u.uid === token);
      if (idx !== -1) {
        users[idx] = { ...users[idx], ...updates };
        setLocal("demo_users", users);
      }
    } else {
      try {
        const userDocRef = doc(db, "users", token);
        await updateDoc(userDocRef, updates);
      } catch (err: any) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${token}`);
      }
    }
  },

  // 3. Get all leave requests
  async getLeaveRequests(token: string, userRole: string) {
    if (IS_DEMO_TOKEN(token)) {
      const reqs = getLocal("demo_requests", INITIAL_DEMO_REQUESTS);
      const normalized = reqs.map(normalizeLeaveRequest);
      if (userRole === "manager") {
        return normalized.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      }
      return normalized
        .filter(r => r.uid === token)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } else {
      try {
        const colRef = collection(db, "leave_requests");
        let q;
        if (userRole === "manager") {
          q = query(colRef);
        } else {
          q = query(colRef, where("uid", "==", token));
        }
        const snapshot = await getDocs(q);
        const results: LeaveRequest[] = [];
        snapshot.forEach(doc => {
          results.push(normalizeLeaveRequest({ id: doc.id, ...(doc.data() as any) }));
        });
        return results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      } catch (err: any) {
        handleFirestoreError(err, OperationType.LIST, "leave_requests");
      }
    }
  },

  // Audit Logs API
  async createAuditLog(log: Omit<AuditLog, "id" | "timestamp">) {
    const id = "audit_" + Date.now().toString() + "_" + Math.random().toString(36).substring(2, 6);
    const timestamp = new Date().toISOString();
    const newLog: AuditLog = { ...log, id, timestamp };

    const token = log.actorId || "unknown";
    if (IS_DEMO_TOKEN(token)) {
      const logs = getLocal("demo_audit_logs", []);
      logs.push(newLog);
      setLocal("demo_audit_logs", logs);
    } else {
      try {
        await setDoc(doc(db, "audit_logs", id), newLog);
      } catch (err) {
        console.error("Failed to write audit log in Firestore:", err);
      }
    }
    return newLog;
  },

  async getAuditLogs(token: string) {
    if (IS_DEMO_TOKEN(token)) {
      return getLocal("demo_audit_logs", []);
    } else {
      try {
        const snap = await getDocs(
          query(collection(db, "audit_logs"), where("employeeId", "==", token))
        );
        const results: AuditLog[] = [];
        snap.forEach(doc => {
          results.push(doc.data() as AuditLog);
        });
        return results.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      } catch (err) {
        console.error("Failed to retrieve audit logs from Firestore:", err);
        return [];
      }
    }
  },

  async getLeaveAuditLogs(token: string, leaveId: string) {
    const all = await this.getAuditLogs(token);
    return all.filter(l => l.leaveId === leaveId);
  },

  // 4. Submit leave request
  async submitLeaveRequest(
    token: string, 
    request: { leaveType: LeaveType; startDate: string; endDate: string; reason: string },
    employeeName: string,
    employeeEmail: string
  ) {
    const totalDays = calculateBusinessDays(request.startDate, request.endDate);
    if (totalDays <= 0) {
      throw new Error("Leave dates must result in at least 1 working day");
    }

    const { user, balances } = await this.getProfileAndBalances(token);
    const category = balances[request.leaveType];
    const remaining = category.total - category.used;
    let warning = null;
    let isInsufficient = false;

    if (totalDays > remaining) {
      isInsufficient = true;
      warning = `Warning: Your remaining ${request.leaveType} leave balance (${remaining} days) is insufficient for this request of ${totalDays} days.`;
    }

    const requestId = "req_" + Date.now().toString();
    const appDate = new Date().toISOString();
    const newRequest: LeaveRequest = {
      id: requestId,
      uid: token, // original
      employeeId: token, // new synced field
      employeeName,
      employeeEmail,
      department: user?.department || "Engineering",
      leaveType: request.leaveType,
      startDate: request.startDate,
      endDate: request.endDate,
      duration: totalDays, // new synced field
      totalDays, // original
      reason: request.reason,
      status: "pending",
      applicationDate: appDate, // new synced field
      createdAt: appDate, // original
      updatedAt: appDate // new field
    };

    if (IS_DEMO_TOKEN(token)) {
      const reqs = getLocal("demo_requests", INITIAL_DEMO_REQUESTS);
      reqs.push(newRequest);
      setLocal("demo_requests", reqs);

      if (isInsufficient) {
        const notifId = "notif_" + Date.now().toString();
        const notifs = getLocal("demo_notifications", INITIAL_DEMO_NOTIFICATIONS);
        notifs.push({
          id: notifId,
          uid: token,
          title: "Insufficient Leave Balance Warning ⚠️",
          message: `Your requested ${request.leaveType} leave from ${request.startDate} to ${request.endDate} is ${totalDays} days, which exceeds your remaining balance of ${remaining} days. A manager will review this overdraft request.`,
          status: "unread",
          createdAt: new Date().toISOString()
        });
        setLocal("demo_notifications", notifs);
      }
    } else {
      await setDoc(doc(db, "leave_requests", requestId), newRequest);

      if (isInsufficient) {
        const notifId = "notif_" + Date.now().toString();
        await setDoc(doc(db, "notifications", notifId), {
          id: notifId,
          uid: token,
          title: "Insufficient Leave Balance Warning ⚠️",
          message: `Your requested ${request.leaveType} leave from ${request.startDate} to ${request.endDate} is ${totalDays} days, which exceeds your remaining balance of ${remaining} days. A manager will review this overdraft request.`,
          status: "unread",
          createdAt: new Date().toISOString()
        });
      }
    }

    // Write audit trail log for submission
    await this.createAuditLog({
      leaveId: requestId,
      employeeId: token,
      actorId: token,
      actorName: employeeName,
      actorRole: "employee",
      action: "leave_submitted",
      previousStatus: "None",
      newStatus: "pending",
      reason: request.reason
    });

    return { request: newRequest, warning, isInsufficient };
  },

  // 5. Approve leave request
  async approveLeaveRequest(token: string, requestId: string, comment: string, managerUid?: string) {
    const effectiveManagerUid = (managerUid && managerUid !== "manager") ? managerUid : token;
    let managerName = "HR Manager";

    if (IS_DEMO_TOKEN(token)) {
      const users = getLocal("demo_users", INITIAL_DEMO_USERS);
      const managerUser = users.find(u => u.uid === effectiveManagerUid);
      if (managerUser?.name) {
        managerName = managerUser.name;
      }

      const reqs = getLocal("demo_requests", INITIAL_DEMO_REQUESTS);
      const reqIdx = reqs.findIndex(r => r.id === requestId);
      if (reqIdx === -1) throw new Error("Leave request not found");

      const leaveReq = normalizeLeaveRequest(reqs[reqIdx]);
      if (!canTransitionLeaveStatus(leaveReq.status, "approved")) {
        throw new Error(`Invalid status transition: cannot approve leave currently in ${leaveReq.status} state.`);
      }

      const employeeUid = leaveReq.uid;
      const typeKey = leaveReq.leaveType as LeaveType;
      const days = leaveReq.totalDays;

      // Update balance
      const balances = getLocal("demo_balances", INITIAL_DEMO_BALANCES);
      const balIdx = balances.findIndex(b => b.uid === employeeUid);
      if (balIdx !== -1) {
        if (!balances[balIdx][typeKey]) {
          balances[balIdx][typeKey] = { total: 20, used: 0 };
        }
        balances[balIdx][typeKey].used += days;
        setLocal("demo_balances", balances);
      }

      // Update request status
      const nowStr = new Date().toISOString();
      const prevStatus = leaveReq.status;
      reqs[reqIdx] = {
        ...leaveReq,
        status: "approved",
        managerComment: comment,
        approvedAt: nowStr,
        processedAt: nowStr,
        processedBy: effectiveManagerUid,
        updatedAt: nowStr
      };
      setLocal("demo_requests", reqs);

      // Create Notification for Employee
      const notifs = getLocal("demo_notifications", INITIAL_DEMO_NOTIFICATIONS);
      notifs.push({
        id: "notif_" + Date.now().toString(),
        uid: employeeUid,
        title: "Leave Approved 🎉",
        message: `Your ${typeKey} leave request for ${leaveReq.startDate} to ${leaveReq.endDate} (${days} days) has been APPROVED.`,
        status: "unread",
        createdAt: nowStr
      });
      setLocal("demo_notifications", notifs);

      // Audit Log
      await this.createAuditLog({
        leaveId: requestId,
        employeeId: employeeUid,
        actorId: effectiveManagerUid,
        actorName: managerName,
        actorRole: "hr",
        action: "leave_approved",
        previousStatus: prevStatus,
        newStatus: "approved",
        reason: comment
      });
    } else {
      try {
        const managerDocRef = doc(db, "users", effectiveManagerUid);
        const managerDoc = await getDoc(managerDocRef);
        if (managerDoc.exists()) {
          managerName = (managerDoc.data() as UserProfile).name || managerName;
        }
      } catch (e) {
        // Safe fallback
      }

      const reqDocRef = doc(db, "leave_requests", requestId);
      const reqDoc = await getDoc(reqDocRef);
      if (!reqDoc.exists()) throw new Error("Leave request not found");
      
      const leaveReq = normalizeLeaveRequest({ id: reqDoc.id, ...reqDoc.data() });
      if (!canTransitionLeaveStatus(leaveReq.status, "approved")) {
        throw new Error(`Invalid status transition: cannot approve leave currently in ${leaveReq.status} state.`);
      }

      const employeeUid = leaveReq.uid;
      const typeKey = leaveReq.leaveType as LeaveType;
      const days = leaveReq.totalDays;
      const nowStr = new Date().toISOString();
      const prevStatus = leaveReq.status;

      await runTransaction(db, async (transaction) => {
        const balDocRef = doc(db, "leave_balances", employeeUid);
        const balDoc = await transaction.get(balDocRef);
        if (!balDoc.exists()) {
          const initBal: LeaveBalance = {
            uid: employeeUid,
            annual: { total: 20, used: typeKey === "annual" ? days : 0 },
            sick: { total: 10, used: typeKey === "sick" ? days : 0 },
            casual: { total: 7, used: typeKey === "casual" ? days : 0 },
            parental: { total: 30, used: typeKey === "parental" ? days : 0 }
          };
          transaction.set(balDocRef, initBal);
        } else {
          const balData = balDoc.data() as LeaveBalance;
          const category = balData[typeKey] || { total: 20, used: 0 };
          const updatedUsed = (category.used || 0) + days;

          transaction.update(balDocRef, {
            [`${typeKey}.used`]: updatedUsed
          });
        }

        transaction.update(reqDocRef, {
          status: "approved",
          managerComment: comment,
          approvedAt: nowStr,
          processedAt: nowStr,
          processedBy: effectiveManagerUid,
          updatedAt: nowStr
        });
      });

      // Notification
      try {
        const notifId = "notif_" + Date.now().toString();
        await setDoc(doc(db, "notifications", notifId), {
          id: notifId,
          uid: employeeUid,
          title: "Leave Approved 🎉",
          message: `Your ${typeKey} leave request for ${leaveReq.startDate} to ${leaveReq.endDate} (${days} days) has been APPROVED.`,
          status: "unread",
          createdAt: nowStr
        });
      } catch (e) {
        console.warn("Failed to create notification document:", e);
      }

      // Audit Log
      try {
        await this.createAuditLog({
          leaveId: requestId,
          employeeId: employeeUid,
          actorId: effectiveManagerUid,
          actorName: managerName,
          actorRole: "hr",
          action: "leave_approved",
          previousStatus: prevStatus,
          newStatus: "approved",
          reason: comment
        });
      } catch (e) {
        console.warn("Failed to write audit log:", e);
      }
    }
  },

  // 6. Reject leave request
  async rejectLeaveRequest(token: string, requestId: string, comment: string, managerUid?: string) {
    const effectiveManagerUid = (managerUid && managerUid !== "manager") ? managerUid : token;
    let managerName = "HR Manager";

    if (IS_DEMO_TOKEN(token)) {
      const users = getLocal("demo_users", INITIAL_DEMO_USERS);
      const managerUser = users.find(u => u.uid === effectiveManagerUid);
      if (managerUser?.name) {
        managerName = managerUser.name;
      }

      const reqs = getLocal("demo_requests", INITIAL_DEMO_REQUESTS);
      const reqIdx = reqs.findIndex(r => r.id === requestId);
      if (reqIdx === -1) throw new Error("Leave request not found");

      const leaveReq = normalizeLeaveRequest(reqs[reqIdx]);
      if (!canTransitionLeaveStatus(leaveReq.status, "rejected")) {
        throw new Error(`Invalid status transition: cannot reject leave currently in ${leaveReq.status} state.`);
      }

      const nowStr = new Date().toISOString();
      const prevStatus = leaveReq.status;
      reqs[reqIdx] = {
        ...leaveReq,
        status: "rejected",
        managerComment: comment,
        rejectedAt: nowStr,
        processedAt: nowStr,
        processedBy: effectiveManagerUid,
        updatedAt: nowStr
      };
      setLocal("demo_requests", reqs);

      // Create Notification for Employee
      const notifs = getLocal("demo_notifications", INITIAL_DEMO_NOTIFICATIONS);
      notifs.push({
        id: "notif_" + Date.now().toString(),
        uid: leaveReq.uid,
        title: "Leave Request Update ⚠️",
        message: `Your ${leaveReq.leaveType} leave request for ${leaveReq.startDate} to ${leaveReq.endDate} has been DECLINED. Comment: ${comment || "None"}`,
        status: "unread",
        createdAt: nowStr
      });
      setLocal("demo_notifications", notifs);

      // Audit Log
      await this.createAuditLog({
        leaveId: requestId,
        employeeId: leaveReq.uid,
        actorId: effectiveManagerUid,
        actorName: managerName,
        actorRole: "hr",
        action: "leave_rejected",
        previousStatus: prevStatus,
        newStatus: "rejected",
        reason: comment
      });
    } else {
      try {
        const managerDocRef = doc(db, "users", effectiveManagerUid);
        const managerDoc = await getDoc(managerDocRef);
        if (managerDoc.exists()) {
          managerName = (managerDoc.data() as UserProfile).name || managerName;
        }
      } catch (e) {}

      const reqDocRef = doc(db, "leave_requests", requestId);
      const reqDoc = await getDoc(reqDocRef);
      if (!reqDoc.exists()) throw new Error("Leave request not found");

      const leaveReq = normalizeLeaveRequest({ id: reqDoc.id, ...reqDoc.data() });
      if (!canTransitionLeaveStatus(leaveReq.status, "rejected")) {
        throw new Error(`Invalid status transition: cannot reject leave currently in ${leaveReq.status} state.`);
      }

      const nowStr = new Date().toISOString();
      const prevStatus = leaveReq.status;

      await updateDoc(reqDocRef, {
        status: "rejected",
        managerComment: comment,
        rejectedAt: nowStr,
        processedAt: nowStr,
        processedBy: effectiveManagerUid,
        updatedAt: nowStr
      });

      try {
        const notifId = "notif_" + Date.now().toString();
        await setDoc(doc(db, "notifications", notifId), {
          id: notifId,
          uid: leaveReq.uid,
          title: "Leave Request Update ⚠️",
          message: `Your ${leaveReq.leaveType} leave request for ${leaveReq.startDate} to ${leaveReq.endDate} has been DECLINED. Comment: ${comment || "None"}`,
          status: "unread",
          createdAt: nowStr
        });
      } catch (e) {}

      try {
        await this.createAuditLog({
          leaveId: requestId,
          employeeId: leaveReq.uid,
          actorId: effectiveManagerUid,
          actorName: managerName,
          actorRole: "hr",
          action: "leave_rejected",
          previousStatus: prevStatus,
          newStatus: "rejected",
          reason: comment
        });
      } catch (e) {}
    }
  },

  // 6b. Withdraw leave request (by employee)
  async withdrawLeaveRequest(token: string, requestId: string) {
    if (IS_DEMO_TOKEN(token)) {
      const reqs = getLocal("demo_requests", INITIAL_DEMO_REQUESTS);
      const reqIdx = reqs.findIndex(r => r.id === requestId);
      if (reqIdx === -1) throw new Error("Leave request not found");

      const leaveReq = reqs[reqIdx];
      if (leaveReq.status === "rejected" || leaveReq.status === "withdrawn") {
        throw new Error(`Request cannot be withdrawn: status is ${leaveReq.status}`);
      }

      const wasApproved = leaveReq.status === "approved";

      if (wasApproved) {
        // Refund balance
        const employeeUid = leaveReq.uid;
        const typeKey = leaveReq.leaveType;
        const days = leaveReq.totalDays;

        const balances = getLocal("demo_balances", INITIAL_DEMO_BALANCES);
        const balIdx = balances.findIndex(b => b.uid === employeeUid);
        if (balIdx !== -1) {
          balances[balIdx][typeKey].used = Math.max(0, balances[balIdx][typeKey].used - days);
          setLocal("demo_balances", balances);
        }
      }

      // Update status
      reqs[reqIdx] = {
        ...leaveReq,
        status: "withdrawn",
        processedAt: new Date().toISOString()
      };
      setLocal("demo_requests", reqs);

      // Create Notification for employee
      const notifs = getLocal("demo_notifications", INITIAL_DEMO_NOTIFICATIONS);
      notifs.push({
        id: "notif_" + Date.now().toString(),
        uid: leaveReq.uid,
        title: "Leave Withdrawn ↩️",
        message: `Your ${leaveReq.leaveType} leave request for ${leaveReq.startDate} to ${leaveReq.endDate} has been withdrawn successfully.`,
        status: "unread",
        createdAt: new Date().toISOString()
      });
      setLocal("demo_notifications", notifs);
    } else {
      const reqDocRef = doc(db, "leave_requests", requestId);
      const reqDoc = await getDoc(reqDocRef);
      if (!reqDoc.exists()) throw new Error("Leave request not found");

      const leaveReq = reqDoc.data() as LeaveRequest;
      if (leaveReq.status === "rejected" || leaveReq.status === "withdrawn") {
        throw new Error(`Request cannot be withdrawn: status is ${leaveReq.status}`);
      }

      const wasApproved = leaveReq.status === "approved";
      const employeeUid = leaveReq.uid;
      const typeKey = leaveReq.leaveType;
      const days = leaveReq.totalDays;

      if (wasApproved) {
        // Run a transaction to refund balances and set status to withdrawn
        await runTransaction(db, async (transaction) => {
          const balDocRef = doc(db, "leave_balances", employeeUid);
          const balDoc = await transaction.get(balDocRef);
          if (!balDoc.exists()) throw new Error("Employee leave balances do not exist");

          const balData = balDoc.data() as LeaveBalance;
          const category = balData[typeKey];
          const updatedUsed = Math.max(0, category.used - days);

          transaction.update(balDocRef, {
            [`${typeKey}.used`]: updatedUsed
          });

          transaction.update(reqDocRef, {
            status: "withdrawn",
            processedAt: new Date().toISOString()
          });
        });
      } else {
        // Just update status
        await updateDoc(reqDocRef, {
          status: "withdrawn",
          processedAt: new Date().toISOString()
        });
      }

      const notifId = "notif_" + Date.now().toString();
      await setDoc(doc(db, "notifications", notifId), {
        id: notifId,
        uid: leaveReq.uid,
        title: "Leave Withdrawn ↩️",
        message: `Your ${leaveReq.leaveType} leave request for ${leaveReq.startDate} to ${leaveReq.endDate} has been withdrawn successfully.`,
        status: "unread",
        createdAt: new Date().toISOString()
      });
    }
  },

  // NEW: Cancel leave request (by employee)
  async cancelLeaveRequest(token: string, requestId: string, reason: string) {
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      throw new Error("Cancellation reason is required and cannot be empty.");
    }

    const { user: empUser } = await this.getProfileAndBalances(token);
    const employeeName = empUser?.name || "Employee";

    let leaveReq: LeaveRequest;
    
    if (IS_DEMO_TOKEN(token)) {
      const reqs = getLocal("demo_requests", INITIAL_DEMO_REQUESTS);
      const reqIdx = reqs.findIndex(r => r.id === requestId);
      if (reqIdx === -1) throw new Error("Leave request not found");
      leaveReq = normalizeLeaveRequest(reqs[reqIdx]);
    } else {
      const reqDocRef = doc(db, "leave_requests", requestId);
      const reqDoc = await getDoc(reqDocRef);
      if (!reqDoc.exists()) throw new Error("Leave request not found");
      leaveReq = normalizeLeaveRequest({ id: reqDoc.id, ...reqDoc.data() });
    }

    // Validation: Start date check (using local date string comparison)
    const todayStr = new Date().toISOString().split("T")[0];
    if (leaveReq.startDate <= todayStr) {
      throw new Error("You cannot cancel a leave request that has already started or whose start date has passed.");
    }

    const nowStr = new Date().toISOString();
    const prevStatus = leaveReq.status;

    if (prevStatus === "pending") {
      // Direct transition: pending -> cancelled
      if (!canTransitionLeaveStatus(prevStatus, "cancelled")) {
        throw new Error("Cannot cancel request in current status.");
      }

      if (IS_DEMO_TOKEN(token)) {
        const reqs = getLocal("demo_requests", INITIAL_DEMO_REQUESTS);
        const reqIdx = reqs.findIndex(r => r.id === requestId);
        reqs[reqIdx] = {
          ...reqs[reqIdx],
          status: "cancelled",
          cancelledAt: nowStr,
          cancellationReason: trimmedReason,
          updatedAt: nowStr
        };
        setLocal("demo_requests", reqs);
      } else {
        const reqDocRef = doc(db, "leave_requests", requestId);
        await updateDoc(reqDocRef, {
          status: "cancelled",
          cancelledAt: nowStr,
          cancellationReason: trimmedReason,
          updatedAt: nowStr
        });
      }

      // Audit Log
      await this.createAuditLog({
        leaveId: requestId,
        employeeId: leaveReq.uid,
        actorId: token,
        actorName: employeeName,
        actorRole: "employee",
        action: "leave_cancelled",
        previousStatus: prevStatus,
        newStatus: "cancelled",
        reason: trimmedReason
      });

    } else if (prevStatus === "approved") {
      // Requested transition: approved -> cancellation_pending
      if (!canTransitionLeaveStatus(prevStatus, "cancellation_pending")) {
        throw new Error("Cannot request cancellation in current status.");
      }

      if (IS_DEMO_TOKEN(token)) {
        const reqs = getLocal("demo_requests", INITIAL_DEMO_REQUESTS);
        const reqIdx = reqs.findIndex(r => r.id === requestId);
        reqs[reqIdx] = {
          ...reqs[reqIdx],
          status: "cancellation_pending",
          cancellationRequestedAt: nowStr,
          cancellationReason: trimmedReason,
          updatedAt: nowStr
        };
        setLocal("demo_requests", reqs);
      } else {
        const reqDocRef = doc(db, "leave_requests", requestId);
        await updateDoc(reqDocRef, {
          status: "cancellation_pending",
          cancellationRequestedAt: nowStr,
          cancellationReason: trimmedReason,
          updatedAt: nowStr
        });
      }

      // Audit Log
      await this.createAuditLog({
        leaveId: requestId,
        employeeId: leaveReq.uid,
        actorId: token,
        actorName: employeeName,
        actorRole: "employee",
        action: "leave_cancellation_requested",
        previousStatus: prevStatus,
        newStatus: "cancellation_pending",
        reason: trimmedReason
      });

    } else {
      throw new Error(`Invalid request status for cancellation: ${prevStatus}`);
    }
  },

  // NEW: Approve leave cancellation (by HR/Manager)
  async approveLeaveCancellation(token: string, requestId: string, managerUid?: string) {
    const effectiveManagerUid = (managerUid && managerUid !== "manager") ? managerUid : token;
    let managerName = "HR Manager";

    let leaveReq: LeaveRequest;

    if (IS_DEMO_TOKEN(token)) {
      const users = getLocal("demo_users", INITIAL_DEMO_USERS);
      const managerUser = users.find(u => u.uid === effectiveManagerUid);
      if (managerUser?.name) {
        managerName = managerUser.name;
      }

      const reqs = getLocal("demo_requests", INITIAL_DEMO_REQUESTS);
      const reqIdx = reqs.findIndex(r => r.id === requestId);
      if (reqIdx === -1) throw new Error("Leave request not found");
      leaveReq = normalizeLeaveRequest(reqs[reqIdx]);

      if (leaveReq.status !== "cancellation_pending") {
        throw new Error("Only cancellation-pending requests can be processed for cancellation approval.");
      }

      const prevStatus = leaveReq.status;
      const employeeUid = leaveReq.uid;
      const typeKey = leaveReq.leaveType as LeaveType;
      const days = leaveReq.totalDays;

      // Refund balance!
      const balances = getLocal("demo_balances", INITIAL_DEMO_BALANCES);
      const balIdx = balances.findIndex(b => b.uid === employeeUid);
      if (balIdx !== -1) {
        balances[balIdx][typeKey].used = Math.max(0, balances[balIdx][typeKey].used - days);
        setLocal("demo_balances", balances);
      }

      // Update request
      const nowStr = new Date().toISOString();
      reqs[reqIdx] = {
        ...reqs[reqIdx],
        status: "cancelled",
        cancelledAt: nowStr,
        processedAt: nowStr,
        processedBy: effectiveManagerUid,
        updatedAt: nowStr
      };
      setLocal("demo_requests", reqs);

      // Notify
      const notifs = getLocal("demo_notifications", INITIAL_DEMO_NOTIFICATIONS);
      notifs.push({
        id: "notif_" + Date.now().toString(),
        uid: employeeUid,
        title: "Leave Cancellation Approved ↩️",
        message: `Your requested cancellation for ${typeKey} leave from ${leaveReq.startDate} to ${leaveReq.endDate} has been APPROVED. Your balances have been refunded.`,
        status: "unread",
        createdAt: nowStr
      });
      setLocal("demo_notifications", notifs);

      // Audit Log
      await this.createAuditLog({
        leaveId: requestId,
        employeeId: employeeUid,
        actorId: effectiveManagerUid,
        actorName: managerName,
        actorRole: "hr",
        action: "leave_cancelled",
        previousStatus: prevStatus,
        newStatus: "cancelled",
        reason: "Cancellation approved by HR"
      });
    } else {
      try {
        const managerDocRef = doc(db, "users", effectiveManagerUid);
        const managerDoc = await getDoc(managerDocRef);
        if (managerDoc.exists()) {
          managerName = (managerDoc.data() as UserProfile).name || managerName;
        }
      } catch (e) {}

      const reqDocRef = doc(db, "leave_requests", requestId);
      const reqDoc = await getDoc(reqDocRef);
      if (!reqDoc.exists()) throw new Error("Leave request not found");
      leaveReq = normalizeLeaveRequest({ id: reqDoc.id, ...reqDoc.data() });

      if (leaveReq.status !== "cancellation_pending") {
        throw new Error("Only cancellation-pending requests can be processed for cancellation approval.");
      }

      const prevStatus = leaveReq.status;
      const employeeUid = leaveReq.uid;
      const typeKey = leaveReq.leaveType as LeaveType;
      const days = leaveReq.totalDays;
      const nowStr = new Date().toISOString();

      await runTransaction(db, async (transaction) => {
        const balDocRef = doc(db, "leave_balances", employeeUid);
        const balDoc = await transaction.get(balDocRef);
        if (balDoc.exists()) {
          const balData = balDoc.data() as LeaveBalance;
          const category = balData[typeKey] || { total: 20, used: 0 };
          const updatedUsed = Math.max(0, (category.used || 0) - days);

          transaction.update(balDocRef, {
            [`${typeKey}.used`]: updatedUsed
          });
        }

        transaction.update(reqDocRef, {
          status: "cancelled",
          cancelledAt: nowStr,
          processedAt: nowStr,
          processedBy: effectiveManagerUid,
          updatedAt: nowStr
        });
      });

      // Notify
      try {
        const notifId = "notif_" + Date.now().toString();
        await setDoc(doc(db, "notifications", notifId), {
          id: notifId,
          uid: employeeUid,
          title: "Leave Cancellation Approved ↩️",
          message: `Your requested cancellation for ${typeKey} leave from ${leaveReq.startDate} to ${leaveReq.endDate} has been APPROVED. Your balances have been refunded.`,
          status: "unread",
          createdAt: nowStr
        });
      } catch (e) {}

      // Audit Log
      try {
        await this.createAuditLog({
          leaveId: requestId,
          employeeId: employeeUid,
          actorId: effectiveManagerUid,
          actorName: managerName,
          actorRole: "hr",
          action: "leave_cancelled",
          previousStatus: prevStatus,
          newStatus: "cancelled",
          reason: "Cancellation approved by HR"
        });
      } catch (e) {}
    }
  },

  // NEW: Reject leave cancellation (restores status to approved)
  async rejectLeaveCancellation(token: string, requestId: string, comment: string, managerUid?: string) {
    const effectiveManagerUid = (managerUid && managerUid !== "manager") ? managerUid : token;
    let managerName = "HR Manager";

    let leaveReq: LeaveRequest;

    if (IS_DEMO_TOKEN(token)) {
      const users = getLocal("demo_users", INITIAL_DEMO_USERS);
      const managerUser = users.find(u => u.uid === effectiveManagerUid);
      if (managerUser?.name) {
        managerName = managerUser.name;
      }

      const reqs = getLocal("demo_requests", INITIAL_DEMO_REQUESTS);
      const reqIdx = reqs.findIndex(r => r.id === requestId);
      if (reqIdx === -1) throw new Error("Leave request not found");
      leaveReq = normalizeLeaveRequest(reqs[reqIdx]);

      if (leaveReq.status !== "cancellation_pending") {
        throw new Error("Only cancellation-pending requests can be processed.");
      }

      const prevStatus = leaveReq.status;
      const employeeUid = leaveReq.uid;
      const typeKey = leaveReq.leaveType as LeaveType;

      const nowStr = new Date().toISOString();
      reqs[reqIdx] = {
        ...reqs[reqIdx],
        status: "approved",
        managerComment: comment || "Cancellation request declined by HR",
        processedAt: nowStr,
        processedBy: effectiveManagerUid,
        updatedAt: nowStr
      };
      setLocal("demo_requests", reqs);

      // Notify
      const notifs = getLocal("demo_notifications", INITIAL_DEMO_NOTIFICATIONS);
      notifs.push({
        id: "notif_" + Date.now().toString(),
        uid: employeeUid,
        title: "Leave Cancellation Declined ⚠️",
        message: `Your request to cancel ${typeKey} leave from ${leaveReq.startDate} to ${leaveReq.endDate} was declined by HR. Your leave remains approved. Reason: ${comment || "None"}`,
        status: "unread",
        createdAt: nowStr
      });
      setLocal("demo_notifications", notifs);

      // Audit Log
      await this.createAuditLog({
        leaveId: requestId,
        employeeId: employeeUid,
        actorId: effectiveManagerUid,
        actorName: managerName,
        actorRole: "hr",
        action: "leave_approved",
        previousStatus: prevStatus,
        newStatus: "approved",
        reason: comment || "Cancellation declined by HR"
      });
    } else {
      try {
        const managerDocRef = doc(db, "users", effectiveManagerUid);
        const managerDoc = await getDoc(managerDocRef);
        if (managerDoc.exists()) {
          managerName = (managerDoc.data() as UserProfile).name || managerName;
        }
      } catch (e) {}

      const reqDocRef = doc(db, "leave_requests", requestId);
      const reqDoc = await getDoc(reqDocRef);
      if (!reqDoc.exists()) throw new Error("Leave request not found");
      leaveReq = normalizeLeaveRequest({ id: reqDoc.id, ...reqDoc.data() });

      if (leaveReq.status !== "cancellation_pending") {
        throw new Error("Only cancellation-pending requests can be processed.");
      }

      const prevStatus = leaveReq.status;
      const employeeUid = leaveReq.uid;
      const typeKey = leaveReq.leaveType as LeaveType;
      const nowStr = new Date().toISOString();

      await updateDoc(reqDocRef, {
        status: "approved",
        managerComment: comment || "Cancellation request declined by HR",
        processedAt: nowStr,
        processedBy: effectiveManagerUid,
        updatedAt: nowStr
      });

      try {
        const notifId = "notif_" + Date.now().toString();
        await setDoc(doc(db, "notifications", notifId), {
          id: notifId,
          uid: employeeUid,
          title: "Leave Cancellation Declined ⚠️",
          message: `Your request to cancel ${typeKey} leave from ${leaveReq.startDate} to ${leaveReq.endDate} was declined by HR. Your leave remains approved. Reason: ${comment || "None"}`,
          status: "unread",
          createdAt: nowStr
        });
      } catch (e) {}

      try {
        await this.createAuditLog({
          leaveId: requestId,
          employeeId: employeeUid,
          actorId: effectiveManagerUid,
          actorName: managerName,
          actorRole: "hr",
          action: "leave_approved",
          previousStatus: prevStatus,
          newStatus: "approved",
          reason: comment || "Cancellation declined by HR"
        });
      } catch (e) {}
    }
  },

  // 7. Get list of all employees and balances
  async getEmployees(token: string) {
    if (IS_DEMO_TOKEN(token)) {
      const users = getLocal("demo_users", INITIAL_DEMO_USERS);
      const balances = getLocal("demo_balances", INITIAL_DEMO_BALANCES);
      const balancesMap: { [uid: string]: LeaveBalance } = {};
      balances.forEach(b => { balancesMap[b.uid] = b; });

      return users.map(u => ({
        ...u,
        balances: balancesMap[u.uid] || {
          uid: u.uid,
          annual: { total: 20, used: 0 },
          sick: { total: 10, used: 0 },
          casual: { total: 7, used: 0 },
          parental: { total: 30, used: 0 }
        }
      }));
    } else {
      const usersSnapshot = await getDocs(collection(db, "users"));
      const balancesSnapshot = await getDocs(collection(db, "leave_balances"));

      const balancesMap: { [uid: string]: LeaveBalance } = {};
      balancesSnapshot.forEach(doc => {
        balancesMap[doc.id] = doc.data() as LeaveBalance;
      });

      const employees: any[] = [];
      usersSnapshot.forEach(doc => {
        const u = doc.data() as UserProfile;
        employees.push({
          ...u,
          balances: balancesMap[u.uid] || {
            uid: u.uid,
            annual: { total: 20, used: 0 },
            sick: { total: 10, used: 0 },
            casual: { total: 7, used: 0 },
            parental: { total: 30, used: 0 }
          }
        });
      });
      return employees;
    }
  },

  // 8. Update specific employee balance
  async updateEmployeeBalance(token: string, targetUid: string, balanceUpdates: any) {
    if (IS_DEMO_TOKEN(token)) {
      const balances = getLocal("demo_balances", INITIAL_DEMO_BALANCES);
      const idx = balances.findIndex(b => b.uid === targetUid);
      
      const current = idx !== -1 ? balances[idx] : {
        uid: targetUid,
        annual: { total: 20, used: 0 },
        sick: { total: 10, used: 0 },
        casual: { total: 7, used: 0 },
        parental: { total: 30, used: 0 }
      };

      const updated: LeaveBalance = {
        uid: targetUid,
        annual: {
          total: balanceUpdates.annual?.total !== undefined ? Number(balanceUpdates.annual.total) : current.annual.total,
          used: balanceUpdates.annual?.used !== undefined ? Number(balanceUpdates.annual.used) : current.annual.used
        },
        sick: {
          total: balanceUpdates.sick?.total !== undefined ? Number(balanceUpdates.sick.total) : current.sick.total,
          used: balanceUpdates.sick?.used !== undefined ? Number(balanceUpdates.sick.used) : current.sick.used
        },
        casual: {
          total: balanceUpdates.casual?.total !== undefined ? Number(balanceUpdates.casual.total) : current.casual.total,
          used: balanceUpdates.casual?.used !== undefined ? Number(balanceUpdates.casual.used) : current.casual.used
        },
        parental: {
          total: balanceUpdates.parental?.total !== undefined ? Number(balanceUpdates.parental.total) : current.parental.total,
          used: balanceUpdates.parental?.used !== undefined ? Number(balanceUpdates.parental.used) : current.parental.used
        }
      };

      if (idx !== -1) {
        balances[idx] = updated;
      } else {
        balances.push(updated);
      }
      setLocal("demo_balances", balances);

      // Notify
      const notifs = getLocal("demo_notifications", INITIAL_DEMO_NOTIFICATIONS);
      notifs.push({
        id: "notif_" + Date.now().toString(),
        uid: targetUid,
        title: "Leave Balances Updated 📋",
        message: `Your corporate leave balances have been modified by HR/Manager. Please check your active balance dashboard.`,
        status: "unread",
        createdAt: new Date().toISOString()
      });
      setLocal("demo_notifications", notifs);
    } else {
      const balDocRef = doc(db, "leave_balances", targetUid);
      const balDoc = await getDoc(balDocRef);
      const current = balDoc.exists() ? (balDoc.data() as LeaveBalance) : {
        uid: targetUid,
        annual: { total: 20, used: 0 },
        sick: { total: 10, used: 0 },
        casual: { total: 7, used: 0 },
        parental: { total: 30, used: 0 }
      };

      const updated = {
        uid: targetUid,
        annual: {
          total: balanceUpdates.annual?.total !== undefined ? Number(balanceUpdates.annual.total) : current.annual.total,
          used: balanceUpdates.annual?.used !== undefined ? Number(balanceUpdates.annual.used) : current.annual.used
        },
        sick: {
          total: balanceUpdates.sick?.total !== undefined ? Number(balanceUpdates.sick.total) : current.sick.total,
          used: balanceUpdates.sick?.used !== undefined ? Number(balanceUpdates.sick.used) : current.sick.used
        },
        casual: {
          total: balanceUpdates.casual?.total !== undefined ? Number(balanceUpdates.casual.total) : current.casual.total,
          used: balanceUpdates.casual?.used !== undefined ? Number(balanceUpdates.casual.used) : current.casual.used
        },
        parental: {
          total: balanceUpdates.parental?.total !== undefined ? Number(balanceUpdates.parental.total) : current.parental.total,
          used: balanceUpdates.parental?.used !== undefined ? Number(balanceUpdates.parental.used) : current.parental.used
        }
      };

      await setDoc(balDocRef, updated, { merge: true });

      // Notify
      const notifId = "notif_" + Date.now().toString();
      await setDoc(doc(db, "notifications", notifId), {
        id: notifId,
        uid: targetUid,
        title: "Leave Balances Updated 📋",
        message: `Your corporate leave balances have been modified by HR/Manager. Please check your active balance dashboard.`,
        status: "unread",
        createdAt: new Date().toISOString()
      });
    }
  },

  // 9. Get analytics & reporting statistics
  async getStats(token: string) {
    let requests: LeaveRequest[] = [];
    let users: UserProfile[] = [];

    if (IS_DEMO_TOKEN(token)) {
      requests = getLocal("demo_requests", INITIAL_DEMO_REQUESTS);
      users = getLocal("demo_users", INITIAL_DEMO_USERS);
    } else {
      const reqsSnap = await getDocs(collection(db, "leave_requests"));
      reqsSnap.forEach(doc => {
        requests.push({ id: doc.id, ...(doc.data() as any) } as LeaveRequest);
      });

      const usersSnap = await getDocs(collection(db, "users"));
      usersSnap.forEach(doc => {
        users.push({ uid: doc.id, ...(doc.data() as any) } as UserProfile);
      });
    }

    const usersMap: { [uid: string]: UserProfile } = {};
    users.forEach(u => { usersMap[u.uid] = u; });

    let pendingCount = 0;
    let approvedCount = 0;
    let rejectedCount = 0;
    const byType = { annual: 0, sick: 0, casual: 0, parental: 0 };
    const byDepartment: { [dept: string]: { approved: number; pending: number } } = {};
    const upcomingLeaves: any[] = [];

    requests.forEach(r => {
      if (r.status === "pending") pendingCount++;
      else if (r.status === "approved") approvedCount++;
      else if (r.status === "rejected") rejectedCount++;

      if (r.status === "approved" && byType[r.leaveType] !== undefined) {
        byType[r.leaveType] += r.totalDays;
      }

      const userProfile = usersMap[r.uid];
      const dept = userProfile?.department || "General";
      if (!byDepartment[dept]) {
        byDepartment[dept] = { approved: 0, pending: 0 };
      }
      if (r.status === "approved") {
        byDepartment[dept].approved += r.totalDays;
      } else if (r.status === "pending") {
        byDepartment[dept].pending += r.totalDays;
      }

      const todayStr = new Date().toISOString().split("T")[0];
      if (r.status === "approved" && r.startDate >= todayStr) {
        upcomingLeaves.push({
          employeeName: r.employeeName,
          leaveType: r.leaveType,
          startDate: r.startDate,
          endDate: r.endDate,
          totalDays: r.totalDays
        });
      }
    });

    upcomingLeaves.sort((a, b) => a.startDate.localeCompare(b.startDate));

    return {
      pendingCount,
      approvedCount,
      rejectedCount,
      byType,
      byDepartment,
      upcomingLeaves: upcomingLeaves.slice(0, 5)
    };
  },

  // 10. Get notifications
  async getNotifications(token: string) {
    if (IS_DEMO_TOKEN(token)) {
      const notifs = getLocal("demo_notifications", INITIAL_DEMO_NOTIFICATIONS);
      return notifs
        .filter(n => n.uid === token)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } else {
      const colRef = collection(db, "notifications");
      const q = query(colRef, where("uid", "==", token));
      const snapshot = await getDocs(q);
      const results: Notification[] = [];
      snapshot.forEach(doc => {
        results.push({ id: doc.id, ...(doc.data() as any) } as Notification);
      });
      return results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
  },

  // 11. Mark notification as read
  async markNotificationAsRead(token: string, notificationId: string) {
    if (IS_DEMO_TOKEN(token)) {
      const notifs = getLocal("demo_notifications", INITIAL_DEMO_NOTIFICATIONS);
      const idx = notifs.findIndex(n => n.id === notificationId);
      if (idx !== -1) {
        if (notifs[idx].uid !== token) throw new Error("Forbidden");
        notifs[idx].status = "read";
        setLocal("demo_notifications", notifs);
      }
    } else {
      const docRef = doc(db, "notifications", notificationId);
      const d = await getDoc(docRef);
      if (!d.exists()) throw new Error("Notification not found");
      const data = d.data() as Notification;
      if (data.uid !== token) throw new Error("Forbidden");

      await updateDoc(docRef, { status: "read" });
    }
  },

  // 12. Create self-contained CSV download string
  async getReportCSVData(token: string) {
    let requests: LeaveRequest[] = [];
    if (IS_DEMO_TOKEN(token)) {
      requests = getLocal("demo_requests", INITIAL_DEMO_REQUESTS);
    } else {
      const q = query(collection(db, "leave_requests"));
      const snapshot = await getDocs(q);
      snapshot.forEach(doc => {
        requests.push({ id: doc.id, ...(doc.data() as any) } as LeaveRequest);
      });
      requests.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }

    let csv = "Request ID,Employee Name,Employee Email,Leave Type,Start Date,End Date,Total Working Days,Status,Reason,Manager Comment,Submitted At\n";
    requests.forEach(r => {
      const name = r.employeeName.replace(/,/g, " ");
      const email = r.employeeEmail.replace(/,/g, " ");
      const type = r.leaveType;
      const start = r.startDate;
      const end = r.endDate;
      const days = r.totalDays;
      const status = r.status;
      const reason = (r.reason || "").replace(/,|\n/g, " ");
      const comment = (r.managerComment || "").replace(/,|\n/g, " ");
      const created = r.createdAt;

      csv += `${r.id},${name},${email},${type},${start},${end},${days},${status},${reason},${comment},${created}\n`;
    });

    return csv;
  },

  // 12b. Employee personal leave report CSV download
  async getEmployeeReportCSVData(token: string, employeeUid: string, employeeName?: string) {
    let requests: LeaveRequest[] = [];
    if (IS_DEMO_TOKEN(token)) {
      const allReqs = getLocal("demo_requests", INITIAL_DEMO_REQUESTS);
      requests = allReqs.filter(r => r.uid === employeeUid);
    } else {
      const q = query(collection(db, "leave_requests"), where("uid", "==", employeeUid));
      const snapshot = await getDocs(q);
      snapshot.forEach(doc => {
        requests.push({ id: doc.id, ...(doc.data() as any) } as LeaveRequest);
      });
    }
    requests = requests.map(normalizeLeaveRequest);
    requests.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    // Current balance lookup
    let balances: LeaveBalance | null = null;
    try {
      const data = await this.getProfileAndBalances(employeeUid);
      balances = data.balances;
    } catch (e) {
      // Balance lookup failed or demo fallback
      if (IS_DEMO_TOKEN(token)) {
        const demoBals = getLocal("demo_balances", INITIAL_DEMO_BALANCES);
        balances = demoBals.find(b => b.uid === employeeUid) || null;
      }
    }

    let csv = `EMPLOYEE LEAVE REPORT\n`;
    csv += `Employee Name:,"${(employeeName || employeeUid).replace(/"/g, '""')}"\n`;
    csv += `Employee ID:,"${employeeUid}"\n`;
    csv += `Generated On:,"${new Date().toLocaleString()}"\n\n`;

    csv += `LEAVE ALLOWANCE & BALANCE SUMMARY\n`;
    csv += `Leave Type,Total Entitled Days,Used Days,Remaining Days\n`;
    if (balances) {
      const leaveCategories: { key: LeaveType; label: string }[] = [
        { key: "annual", label: "Annual Leave" },
        { key: "sick", label: "Sick Leave" },
        { key: "casual", label: "Casual Leave" },
        { key: "parental", label: "Parental Leave" }
      ];
      leaveCategories.forEach(cat => {
        const item = balances ? balances[cat.key] : { total: 0, used: 0 };
        const total = item?.total ?? 0;
        const used = item?.used ?? 0;
        const remaining = total - used;
        csv += `"${cat.label}",${total},${used},${remaining}\n`;
      });
    } else {
      csv += `Annual Leave,20,0,20\nSick Leave,10,0,10\nCasual Leave,7,0,7\nParental Leave,30,0,30\n`;
    }
    csv += `\n`;

    csv += `LEAVE APPLICATION HISTORY\n`;
    csv += "Application ID,Leave Category,Start Date,End Date,Working Days,Current Status,Reason,Manager/HR Comment,Submitted At\n";
    requests.forEach(r => {
      const id = r.id;
      const type = r.leaveType.toUpperCase();
      const start = r.startDate;
      const end = r.endDate;
      const days = r.duration ?? r.totalDays;
      const status = r.status.toUpperCase();
      const reason = `"${(r.reason || "").replace(/"/g, '""').replace(/\n/g, ' ')}"`;
      const comment = `"${(r.managerComment || "").replace(/"/g, '""').replace(/\n/g, ' ')}"`;
      const created = r.createdAt ? r.createdAt.split("T")[0] : "";

      csv += `${id},${type},${start},${end},${days},${status},${reason},${comment},${created}\n`;
    });

    return csv;
  },

  // 13. Seed sample pending cloud requests for testing
  async seedSampleCloudRequests(token: string) {
    if (IS_DEMO_TOKEN(token)) return;

    const colRef = collection(db, "leave_requests");
    const samples = [
      {
        id: "req_seed_1",
        uid: "emp_seed_jane",
        employeeName: "Jane Doe (Cloud Test)",
        employeeEmail: "jane.doe@enterprise.com",
        leaveType: "annual" as LeaveType,
        startDate: new Date(Date.now() + 86400000 * 5).toISOString().split("T")[0], // 5 days from now
        endDate: new Date(Date.now() + 86400000 * 9).toISOString().split("T")[0],
        totalDays: 5,
        reason: "Annual family vacation to Hawaii.",
        status: "pending" as const,
        createdAt: new Date(Date.now() - 3600000 * 2).toISOString() // 2 hours ago
      },
      {
        id: "req_seed_2",
        uid: "emp_seed_mark",
        employeeName: "Mark Miller (Cloud Test)",
        employeeEmail: "mark.miller@enterprise.com",
        leaveType: "sick" as LeaveType,
        startDate: new Date(Date.now() + 86400000 * 1).toISOString().split("T")[0], // tomorrow
        endDate: new Date(Date.now() + 86400000 * 2).toISOString().split("T")[0],
        totalDays: 2,
        reason: "Dental surgery appointment and recovery.",
        status: "pending" as const,
        createdAt: new Date(Date.now() - 3600000 * 24).toISOString() // 24 hours ago
      }
    ];

    for (const sample of samples) {
      await setDoc(doc(colRef, sample.id), sample);
    }
  }
};

