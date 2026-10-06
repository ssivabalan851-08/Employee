import React from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowRight,
  BarChart3,
  BellRing,
  CalendarCheck2,
  CalendarDays,
  Check,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  Menu,
  Plane,
  RefreshCcw,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { ThemeToggle } from "./ThemeToggle.tsx";
import "./LandingPage.css";

const workflows = {
  employee: {
    eyebrow: "For employees",
    title: "Take time off with confidence.",
    copy: "See your balance, choose the right dates, and submit a complete request from one calm workspace.",
    note: "Your balance and request status stay up to date",
    steps: [
      { icon: BarChart3, title: "Check balance", copy: "See available days before making plans." },
      { icon: CalendarDays, title: "Choose dates", copy: "Select the leave type, dates, and reason." },
      { icon: Send, title: "Send request", copy: "Submit in minutes and follow the decision." },
    ],
  },
  manager: {
    eyebrow: "For HR & managers",
    title: "Decide with the full picture.",
    copy: "Review team coverage, leave history, and policy context before approving every request.",
    note: "Applicants receive a clear decision update",
    steps: [
      { icon: Users, title: "Review impact", copy: "See who is away and check team coverage." },
      { icon: ClipboardCheck, title: "Approve or reject", copy: "Make a recorded decision in one click." },
      { icon: BellRing, title: "Notify clearly", copy: "Keep the employee and HR records aligned." },
    ],
  },
} as const;

const policyItems = [
  { icon: FileCheck2, title: "Leave entitlements", copy: "Configured for each leave type" },
  { icon: SlidersHorizontal, title: "Approval rules", copy: "Aligned with your company process" },
  { icon: RefreshCcw, title: "Automatic balance updates", copy: "Applied after every decision" },
];

const calendarRows = [
  { initials: "AK", name: "Aisha Khan", label: "Annual leave · Pending", start: 4, span: 4, tone: "coral" },
  { initials: "RK", name: "Ravi Kumar", label: "Sick leave", start: 2, span: 2, tone: "blue" },
  { initials: "MN", name: "Meera Nair", label: "Personal leave · Approved", start: 6, span: 3, tone: "mint" },
  { initials: "JL", name: "Jonas Lee", label: "Away", start: 5, span: 3, tone: "blue" },
] as const;

const PortalLink: React.FC<{
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "light";
}> = ({ href, children, variant = "primary" }) => (
  <a href={href} className={`leavewise-landing__button leavewise-landing__button--${variant}`}>
    <span>{children}</span>
    <ArrowRight aria-hidden="true" />
  </a>
);

export const LandingPage: React.FC = () => {
  const landingRef = React.useRef<HTMLDivElement>(null);
  const [productRole, setProductRole] = React.useState<"employee" | "manager">("employee");
  const [workflowRole, setWorkflowRole] = React.useState<keyof typeof workflows>("employee");
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [showDemo, setShowDemo] = React.useState(false);
  const prefersReducedMotion = useReducedMotion();
  const workflow = workflows[workflowRole];

  React.useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMobileMenuOpen(false);
      setShowDemo(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  React.useEffect(() => {
    const root = landingRef.current;
    if (!root) return;

    const sections = Array.from(
      root.querySelectorAll("main > section:not(.leavewise-landing__hero)"),
    ) as HTMLElement[];
    if (prefersReducedMotion || !("IntersectionObserver" in window)) {
      sections.forEach(section => section.classList.add("is-revealed"));
      return;
    }

    root.classList.add("is-motion-ready");
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-revealed");
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -12%", threshold: 0.08 },
    );

    sections.forEach(section => observer.observe(section));
    return () => observer.disconnect();
  }, [prefersReducedMotion]);

  const handleProductDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: { offset: { x: number } }) => {
    if (info.offset.x <= -55) setProductRole("manager");
    if (info.offset.x >= 55) setProductRole("employee");
  };

  return (
    <div className="leavewise-landing" id="top" ref={landingRef}>
      <a className="leavewise-landing__skip-link" href="#landing-main">
        Skip to main content
      </a>

      <header className="leavewise-landing__header">
        <nav className="leavewise-landing__nav-shell" aria-label="Main navigation">
          <a className="leavewise-landing__brand" href="#top" aria-label="LeaveWise home">
            <img className="leavewise-landing__brand-mark" src="/leavewise-mark.png" alt="" aria-hidden="true" />
            <span className="leavewise-landing__wordmark">Leave<span>Wise</span></span>
          </a>

          <div className={`leavewise-landing__nav-links ${mobileMenuOpen ? "is-open" : ""}`} id="landing-navigation">
            <a href="#product" onClick={() => setMobileMenuOpen(false)}>Product</a>
            <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)}>How it works</a>
            <a href="#for-hr" onClick={() => setMobileMenuOpen(false)}>For HR</a>
            <a href="#policies" onClick={() => setMobileMenuOpen(false)}>Policies</a>
          </div>

          <div className="leavewise-landing__nav-actions">
            <button
              type="button"
              className="leavewise-landing__menu-button"
              aria-controls="landing-navigation"
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? "Close navigation" : "Open navigation"}
              onClick={() => setMobileMenuOpen(open => !open)}
            >
              {mobileMenuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
            </button>
            <ThemeToggle />
            <a className="leavewise-landing__sign-in" href="/login">Sign in</a>
            <a className="leavewise-landing__get-started" href="/login?mode=signup">
              Get started <ArrowRight aria-hidden="true" />
            </a>
          </div>
        </nav>
      </header>

      <main id="landing-main">
        <section className="leavewise-landing__hero" id="product" aria-labelledby="landing-title">
          <div className="leavewise-landing__hero-grid">
            <div className="leavewise-landing__hero-copy">
              <div className="leavewise-landing__eyebrow">
                <span><Check aria-hidden="true" /></span>
                Workplace leave management
              </div>
              <h1 id="landing-title">Leave management that works for everyone.</h1>
              <p>
                Employees request time off in minutes. HR approves with the context
                to keep every team moving.
              </p>
              <div className="leavewise-landing__hero-actions">
                <PortalLink href="/login?mode=signup">Start with LeaveWise</PortalLink>
                <PortalLink href="#how-it-works" variant="secondary">See how it works</PortalLink>
              </div>
              <button type="button" className="leavewise-landing__demo-text" onClick={() => setShowDemo(true)}>
                Request a guided demo <ArrowRight aria-hidden="true" />
              </button>
              <div className="leavewise-landing__hero-proof" aria-label="Product highlights">
                <span><CheckCircle2 aria-hidden="true" /> Clear balances</span>
                <span><ShieldCheck aria-hidden="true" /> Role-based access</span>
                <span><BellRing aria-hidden="true" /> Approval updates</span>
              </div>
            </div>

            <div className="leavewise-landing__product-shell" aria-label="LeaveWise product preview">
              <div className="leavewise-landing__product-window">
                <div className="leavewise-landing__product-bar">
                  <div className="leavewise-landing__window-dots" aria-hidden="true"><i /><i /><i /></div>
                  <div className="leavewise-landing__mini-wordmark">Leave<span>Wise</span></div>
                  <div className="leavewise-landing__role-switch" aria-label="Preview a portal">
                    <button
                      type="button"
                      className={productRole === "employee" ? "is-active" : ""}
                      aria-pressed={productRole === "employee"}
                      onClick={() => setProductRole("employee")}
                    >
                      <UserRound aria-hidden="true" /> Employee
                    </button>
                    <button
                      type="button"
                      className={productRole === "manager" ? "is-active" : ""}
                      aria-pressed={productRole === "manager"}
                      onClick={() => setProductRole("manager")}
                    >
                      <Users aria-hidden="true" /> HR
                    </button>
                  </div>
                </div>

                <motion.div
                  className={`leavewise-landing__product-body is-${productRole}`}
                  drag={prefersReducedMotion ? false : "x"}
                  dragConstraints={{ left: 0, right: 0 }}
                  dragDirectionLock
                  dragElastic={0.16}
                  dragSnapToOrigin
                  onDragEnd={handleProductDragEnd}
                  whileDrag={prefersReducedMotion ? undefined : { scale: 0.992, cursor: "grabbing" }}
                  transition={{ type: "spring", stiffness: 360, damping: 32 }}
                  title="Drag left for the HR preview or right for the employee preview"
                >
                  <div className="leavewise-landing__employee-preview">
                    <article className="leavewise-landing__ui-card leavewise-landing__balance-card">
                      <div className="leavewise-landing__ui-heading">
                        <div><small>Employee workspace</small><h2>My leave balance</h2></div>
                        <span>2026</span>
                      </div>
                      <div className="leavewise-landing__balance-grid">
                        <div><strong>18</strong><span>Days available</span></div>
                        <div><strong>6</strong><span>Days used</span></div>
                        <div><strong>2</strong><span>Days pending</span></div>
                      </div>
                    </article>

                    <article className="leavewise-landing__ui-card leavewise-landing__request-card">
                      <div className="leavewise-landing__ui-heading"><h2>Request leave</h2><CalendarCheck2 aria-hidden="true" /></div>
                      <label>Leave type <span>Annual leave</span></label>
                      <div className="leavewise-landing__date-fields">
                        <label>From <span>12 Oct 2026</span></label>
                        <label>To <span>16 Oct 2026</span></label>
                      </div>
                      <label>Reason <span>Family holiday</span></label>
                      <button type="button" tabIndex={-1}>Send request</button>
                    </article>
                  </div>

                  <div className="leavewise-landing__hr-preview">
                    <article className="leavewise-landing__ui-card leavewise-landing__queue-card">
                      <div className="leavewise-landing__ui-heading"><h2>Pending requests <b>8</b></h2><a href="/login?role=manager">View all</a></div>
                      {[
                        ["AK", "Aisha Khan", "Annual leave", "12–16 Oct"],
                        ["RK", "Ravi Kumar", "Sick leave", "22 Oct"],
                        ["MN", "Meera Nair", "Personal leave", "28 Oct"],
                      ].map(([initials, name, type, date], index) => (
                        <div className={`leavewise-landing__request-row ${index === 0 ? "is-selected" : ""}`} key={name}>
                          <span>{initials}</span>
                          <div><strong>{name}</strong><small>{type}</small></div>
                          <time>{date}</time>
                        </div>
                      ))}
                    </article>

                    <article className="leavewise-landing__ui-card leavewise-landing__decision-card">
                      <div className="leavewise-landing__person"><span>AK</span><div><strong>Aisha Khan</strong><small>Annual leave</small></div></div>
                      <dl>
                        <div><dt>Dates</dt><dd>12–16 Oct</dd></div>
                        <div><dt>Balance after approval</dt><dd>14 days</dd></div>
                        <div><dt>Team coverage</dt><dd className="is-covered">Covered</dd></div>
                      </dl>
                      <div className="leavewise-landing__decision-actions"><button type="button" tabIndex={-1}>Reject</button><button type="button" tabIndex={-1}>Approve request</button></div>
                    </article>
                  </div>
                </motion.div>
              </div>
            </div>
          </div>

          <div className="leavewise-landing__date-ribbon" aria-hidden="true">
            <span>OCT</span>
            {[10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21].map(day => <i className={day >= 12 && day <= 16 ? "is-away" : ""} key={day}>{day}</i>)}
            <Plane />
          </div>
        </section>

        <section className="leavewise-landing__proof">
          <h2>One place for every leave decision.</h2>
          <p>From checking balances to approving requests, LeaveWise brings employees and HR together with the right context.</p>
        </section>

        <section className="leavewise-landing__workflow" id="how-it-works" aria-labelledby="workflow-title">
          <div className="leavewise-landing__section-shell">
            <div className="leavewise-landing__section-intro leavewise-landing__workflow-intro">
              <div>
                <span>One connected process</span>
                <h2 id="workflow-title">Two experiences. One simple workflow.</h2>
                <p>Different responsibilities, one transparent way to plan time away.</p>
              </div>
              <div className="leavewise-landing__workflow-tabs" role="tablist" aria-label="Choose a workflow">
                <button type="button" role="tab" aria-selected={workflowRole === "employee"} className={workflowRole === "employee" ? "is-active" : ""} onClick={() => setWorkflowRole("employee")}><UserRound /> Employee</button>
                <button type="button" role="tab" aria-selected={workflowRole === "manager"} className={workflowRole === "manager" ? "is-active" : ""} onClick={() => setWorkflowRole("manager")}><Users /> HR & manager</button>
              </div>
            </div>

            <div className="leavewise-landing__workflow-panel" role="tabpanel">
              <div className="leavewise-landing__workflow-copy">
                <span>{workflow.eyebrow}</span>
                <h3>{workflow.title}</h3>
                <p>{workflow.copy}</p>
                <div><i /><span>{workflow.note}</span></div>
              </div>
              <div className="leavewise-landing__workflow-steps">
                {workflow.steps.map(({ icon: Icon, title, copy }, index) => (
                  <article key={title}>
                    <b>{index + 1}</b>
                    <div><Icon aria-hidden="true" /></div>
                    <h4>{title}</h4>
                    <p>{copy}</p>
                    {index < workflow.steps.length - 1 && <ArrowRight aria-hidden="true" className="leavewise-landing__step-arrow" />}
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="leavewise-landing__calendar-section" id="for-hr" aria-labelledby="calendar-title">
          <div className="leavewise-landing__section-shell">
            <div className="leavewise-landing__section-intro leavewise-landing__section-intro--center">
              <span>Team visibility</span>
              <h2 id="calendar-title">See the whole team before you decide.</h2>
              <p>Understand who is away, what is coming up, and how each request affects coverage.</p>
            </div>

            <div className="leavewise-landing__team-calendar">
              <div className="leavewise-landing__calendar-bar">
                <h3>Team calendar</h3>
                <div>‹ <strong>October 2026</strong> ›</div>
                <div className="leavewise-landing__legend"><span><i className="is-mint" />Approved</span><span><i className="is-coral" />Pending</span><span><i className="is-blue" />Away</span></div>
              </div>
              <div className="leavewise-landing__calendar-table">
                <div className="leavewise-landing__calendar-dates">
                  <span>Team member</span>
                  {["10 Sat", "11 Sun", "12 Mon", "13 Tue", "14 Wed", "15 Thu", "16 Fri", "17 Sat"].map(day => <span key={day}>{day}</span>)}
                </div>
                {calendarRows.map(row => (
                  <div className="leavewise-landing__calendar-row" key={row.name}>
                    <div className="leavewise-landing__calendar-person"><span>{row.initials}</span><strong>{row.name}</strong></div>
                    <i
                      className={`leavewise-landing__calendar-event is-${row.tone}`}
                      style={{ "--start": String(row.start), "--span": String(row.span) } as React.CSSProperties}
                    >
                      {row.label}
                    </i>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="leavewise-landing__policy-section" id="policies" aria-labelledby="policy-title">
          <div className="leavewise-landing__section-shell leavewise-landing__policy-grid">
            <div className="leavewise-landing__policy-copy">
              <span>Consistent by design</span>
              <h2 id="policy-title">Policies stay consistent. People stay informed.</h2>
              <p>Keep each decision fair and accurate with policy context and dependable records in the same workspace.</p>
              <div className="leavewise-landing__policy-list">
                {policyItems.map(({ icon: Icon, title, copy }) => (
                  <div key={title}>
                    <span><Icon aria-hidden="true" /></span>
                    <div><strong>{title}</strong><small>{copy}</small></div>
                    <ArrowRight aria-hidden="true" />
                  </div>
                ))}
              </div>
            </div>

            <div className="leavewise-landing__policy-art" aria-hidden="true">
              <div className="leavewise-landing__policy-orbit leavewise-landing__policy-orbit--one" />
              <div className="leavewise-landing__policy-orbit leavewise-landing__policy-orbit--two" />
              <div className="leavewise-landing__document-card">
                <span />
                <span />
                <span />
                <span />
              </div>
              <div className="leavewise-landing__shield-card"><ShieldCheck /></div>
              <div className="leavewise-landing__approval-chip"><CheckCircle2 /><span><strong>Policy matched</strong><small>Ready for approval</small></span></div>
            </div>
          </div>
        </section>

        <section className="leavewise-landing__closing">
          <div className="leavewise-landing__closing-panel">
            <div>
              <span>Ready when your team is</span>
              <h2>Make time off easier for everyone.</h2>
              <p>Bring requests, approvals, balances, and team visibility into one professional workspace.</p>
              <div className="leavewise-landing__closing-actions">
                <PortalLink href="/login?mode=signup" variant="light">Create an account</PortalLink>
                <button type="button" className="leavewise-landing__button leavewise-landing__button--secondary" onClick={() => setShowDemo(true)}>
                  <span>Contact sales</span><ArrowRight aria-hidden="true" />
                </button>
              </div>
            </div>
            <div className="leavewise-landing__closing-visual" aria-hidden="true">
              <div className="leavewise-landing__closing-calendar"><CalendarDays /><div><span /><span /><span /><span /><span /><span /><span /><span /><span /></div><Check /></div>
              <i /><i /><i />
            </div>
          </div>
        </section>
      </main>

      <footer className="leavewise-landing__footer">
        <div className="leavewise-landing__footer-main">
          <div>
            <a className="leavewise-landing__brand" href="#top"><img className="leavewise-landing__brand-mark" src="/leavewise-mark.png" alt="" aria-hidden="true" /><span className="leavewise-landing__wordmark">Leave<span>Wise</span></span></a>
            <p>Making workplace time off simpler for everyone.</p>
          </div>
          <nav aria-label="Footer navigation">
            <a href="#product">Product</a>
            <a href="#how-it-works">How it works</a>
            <a href="#policies">Policies</a>
            <a href="/login?role=employee">Employee sign in</a>
            <a href="/login?role=manager">HR sign in</a>
          </nav>
        </div>
        <div className="leavewise-landing__footer-meta">
          <span>© {new Date().getFullYear()} LeaveWise.</span>
          <span><ShieldCheck aria-hidden="true" /> Secure account approval and role-based access</span>
        </div>
      </footer>

      {showDemo && (
        <div className="leavewise-landing__modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setShowDemo(false);
        }}>
          <section className="leavewise-landing__modal" role="dialog" aria-modal="true" aria-labelledby="demo-dialog-title">
            <button type="button" className="leavewise-landing__modal-close" aria-label="Close demo request" onClick={() => setShowDemo(false)}>
              <X aria-hidden="true" />
            </button>
            <div className="leavewise-landing__modal-icon"><Send aria-hidden="true" /></div>
            <span>Guided product tour</span>
            <h2 id="demo-dialog-title">Request a LeaveWise demo</h2>
            <p>Share your work email and team size to prepare a focused walkthrough of the employee and HR workflows.</p>
            <form onSubmit={(event) => {
              event.preventDefault();
              window.alert("Demo requested successfully!");
              setShowDemo(false);
            }}>
              <label>
                Work email
                <input required type="email" name="email" autoComplete="email" placeholder="you@company.com" />
              </label>
              <label>
                Company size
                <select name="company-size" defaultValue="1-50">
                  <option value="1-50">1–50 employees</option>
                  <option value="51-200">51–200 employees</option>
                  <option value="201-1000">201–1,000 employees</option>
                  <option value="1000+">1,000+ employees</option>
                </select>
              </label>
              <button type="submit">Submit request <ArrowRight aria-hidden="true" /></button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
};
