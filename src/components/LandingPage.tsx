import React from "react";
import {
  ArrowRight,
  BarChart3,
  BellRing,
  CalendarCheck2,
  CalendarDays,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileClock,
  LayoutDashboard,
  LockKeyhole,
  Send,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { BrandLogo } from "./BrandLogo.tsx";
import { ThemeToggle } from "./ThemeToggle.tsx";
import "./LandingPage.css";

const features = [
  {
    icon: Send,
    title: "Employee self-service",
    copy: "Request leave, review balances, and follow every decision from one clear workspace.",
  },
  {
    icon: ClipboardCheck,
    title: "Smart approvals",
    copy: "Give HR a focused approval queue with the context needed to make faster decisions.",
  },
  {
    icon: BarChart3,
    title: "Live leave balances",
    copy: "Keep entitlements and remaining days visible so employees can plan with confidence.",
  },
  {
    icon: CalendarDays,
    title: "Team calendar",
    copy: "See planned time away across the team and spot availability gaps before they become blockers.",
  },
  {
    icon: FileClock,
    title: "Complete leave history",
    copy: "Maintain a dependable record of requests, dates, decisions, and balances in one place.",
  },
  {
    icon: LockKeyhole,
    title: "Secure role access",
    copy: "Keep employee and HR workspaces separate with the right access for every account.",
  },
];

const steps = [
  {
    number: "01",
    icon: Send,
    title: "Request leave",
    copy: "Employees submit dates and details in seconds from their personal portal.",
  },
  {
    number: "02",
    icon: CalendarCheck2,
    title: "Review availability",
    copy: "HR checks team coverage, balances, and request history before deciding.",
  },
  {
    number: "03",
    icon: BellRing,
    title: "Approve and notify",
    copy: "The request is recorded and the applicant receives a clear decision update.",
  },
];

const employeeBenefits = [
  "Submit requests in a few clicks",
  "See balances and request status",
  "Plan around the shared team calendar",
];

const hrBenefits = [
  "Review every request in one queue",
  "Spot team availability conflicts early",
  "Keep records and decisions organized",
];

const PortalLink: React.FC<{
  role: "employee" | "manager";
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "light" | "outline";
}> = ({ role, children, variant = "primary" }) => (
  <a
    href={`/login?role=${role}`}
    className={`leavewise-landing__button leavewise-landing__button--${variant}`}
  >
    <span>{children}</span>
    <ArrowRight aria-hidden="true" />
  </a>
);

export const LandingPage: React.FC = () => (
  <div className="leavewise-landing" id="top">
    <a className="leavewise-landing__skip-link" href="#landing-main">
      Skip to main content
    </a>
    <header className="leavewise-landing__header">
      <div className="leavewise-landing__nav-shell">
        <a className="leavewise-landing__brand" href="#top" aria-label="LeaveWise home">
          <BrandLogo compact />
          <span>
            <strong>LeaveWise</strong>
            <small>Workplace leave management</small>
          </span>
        </a>

        <nav className="leavewise-landing__nav" aria-label="Landing page navigation">
          <a href="#features">Features</a>
          <a href="#how-it-works">How it works</a>
          <a href="#benefits">Benefits</a>
        </nav>

        <div className="leavewise-landing__nav-actions">
          <ThemeToggle />
          <a className="leavewise-landing__portal-link" href="/login">
            Open portal <ArrowRight aria-hidden="true" />
          </a>
        </div>
      </div>
    </header>

    <main id="landing-main">
      <section className="leavewise-landing__hero" aria-labelledby="landing-title">
        <div className="leavewise-landing__hero-copy">
          <h1 id="landing-title">
            Leave management,
            <span> made beautifully simple.</span>
          </h1>
          <p>
            Give employees a faster way to request time off and give HR complete
            visibility from one secure workspace.
          </p>
          <div className="leavewise-landing__hero-actions">
            <PortalLink role="employee">Open Employee Portal</PortalLink>
            <PortalLink role="manager" variant="secondary">Open HR Portal</PortalLink>
          </div>
          <div className="leavewise-landing__hero-points" aria-label="LeaveWise highlights">
            <span><CheckCircle2 aria-hidden="true" /> Clear for every employee</span>
            <span><ShieldCheck aria-hidden="true" /> Built for secure decisions</span>
            <span><Clock3 aria-hidden="true" /> Less admin, more focus</span>
          </div>
        </div>

        <div className="leavewise-landing__product" aria-label="LeaveWise dashboard preview">
          <div className="leavewise-landing__product-glow" />
          <div className="leavewise-landing__window">
            <div className="leavewise-landing__window-bar">
              <span /><span /><span />
              <strong>LeaveWise workspace</strong>
            </div>
            <div className="leavewise-landing__dashboard">
              <aside>
                <div className="leavewise-landing__mini-brand"><Sparkles /> LW</div>
                <span className="is-active"><LayoutDashboard /> Overview</span>
                <span><CalendarDays /> My leave</span>
                <span><Users /> Team</span>
                <span><ClipboardCheck /> Approvals</span>
              </aside>
              <div className="leavewise-landing__dashboard-main">
                <div className="leavewise-landing__dashboard-heading">
                  <div><small>Tuesday, 16 April</small><h2>Good morning, Jamie.</h2></div>
                  <span className="leavewise-landing__avatar">JD</span>
                </div>
                <div className="leavewise-landing__metrics">
                  <article><span>My leave balance</span><strong>12 days</strong><i><b /></i></article>
                  <article><span>Team available</span><strong>18 / 24</strong><div className="leavewise-landing__faces"><b>AP</b><b>PS</b><b>DW</b></div></article>
                  <article><span>Pending approvals</span><strong>3</strong><small>Ready to review</small></article>
                </div>
                <div className="leavewise-landing__schedule">
                  <div className="leavewise-landing__schedule-title"><strong>Team availability</strong><span>This week</span></div>
                  <div className="leavewise-landing__week"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span></div>
                  {[
                    ["Priya", "one", "three"],
                    ["Daniel", "two", "four"],
                    ["Sophie", "one", "four"],
                  ].map(([name, start, end]) => (
                    <div className="leavewise-landing__schedule-row" key={name}>
                      <strong>{name}</strong><i className={`from-${start} to-${end}`} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="leavewise-landing__approval-float">
            <CheckCircle2 aria-hidden="true" />
            <span><strong>Leave approved</strong><small>Annual leave · 18–20 Apr</small></span>
          </div>
        </div>
      </section>

      <section className="leavewise-landing__positioning" aria-label="LeaveWise purpose">
        <p>A calmer, clearer way for employees and HR to plan time away together.</p>
        <div>
          <span><Users /> Employee self-service</span>
          <span><ClipboardCheck /> HR decision workspace</span>
          <span><ShieldCheck /> Secure cloud records</span>
        </div>
      </section>

      <section className="leavewise-landing__section leavewise-landing__features" id="features">
        <div className="leavewise-landing__section-heading">
          <p>Features</p>
          <h2>Everything your team needs to manage leave</h2>
          <span>One connected experience for requests, approvals, planning, and records.</span>
        </div>
        <div className="leavewise-landing__feature-grid">
          {features.map(({ icon: Icon, title, copy }) => (
            <article key={title}>
              <div><Icon aria-hidden="true" /></div>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="leavewise-landing__workflow" id="how-it-works">
        <div className="leavewise-landing__section-heading">
          <p>How it works</p>
          <h2>From request to decision in three clear steps</h2>
          <span>A straightforward process that keeps everyone informed.</span>
        </div>
        <div className="leavewise-landing__steps">
          {steps.map(({ number, icon: Icon, title, copy }, index) => (
            <article key={title}>
              <span className="leavewise-landing__step-number">{number}</span>
              <div className="leavewise-landing__step-icon"><Icon aria-hidden="true" /></div>
              <h3>{title}</h3>
              <p>{copy}</p>
              {index < steps.length - 1 && <ArrowRight className="leavewise-landing__step-arrow" aria-hidden="true" />}
            </article>
          ))}
        </div>
      </section>

      <section className="leavewise-landing__section leavewise-landing__benefits" id="benefits">
        <div className="leavewise-landing__section-heading">
          <p>Benefits</p>
          <h2>Better planning for people and HR</h2>
          <span>Freedom for employees, structure for HR, and one shared view for the whole team.</span>
        </div>
        <div className="leavewise-landing__benefit-layout">
          <article className="leavewise-landing__benefit-card">
            <div className="leavewise-landing__benefit-label"><Users /> For employees</div>
            <h3>Time off, made easy</h3>
            <ul>{employeeBenefits.map(item => <li key={item}><Check />{item}</li>)}</ul>
            <PortalLink role="employee" variant="outline">Employee Portal</PortalLink>
          </article>

          <div className="leavewise-landing__calendar-card" aria-label="Team leave calendar preview">
            <div className="leavewise-landing__calendar-head"><strong>April 2026</strong><span>Month</span></div>
            <div className="leavewise-landing__calendar-days">
              {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}
            </div>
            <div className="leavewise-landing__calendar-grid">
              {Array.from({ length: 28 }, (_, index) => <span key={index} className={index === 16 ? "is-today" : ""}>{index + 1}</span>)}
              <i className="leavewise-landing__leave-block leavewise-landing__leave-block--one">Annual leave</i>
              <i className="leavewise-landing__leave-block leavewise-landing__leave-block--two">Sick leave</i>
            </div>
            <div className="leavewise-landing__calendar-notice"><CheckCircle2 /><span><strong>Leave approved</strong><small>The request has been recorded.</small></span></div>
          </div>

          <article className="leavewise-landing__benefit-card">
            <div className="leavewise-landing__benefit-label"><ShieldCheck /> For HR</div>
            <h3>The visibility to stay ahead</h3>
            <ul>{hrBenefits.map(item => <li key={item}><Check />{item}</li>)}</ul>
            <PortalLink role="manager" variant="outline">HR Portal</PortalLink>
          </article>
        </div>
      </section>

      <section className="leavewise-landing__trust">
        <div><ShieldCheck aria-hidden="true" /></div>
        <p>Designed around clear roles, fresh sign-ins, protected records, and deliberate account approval.</p>
      </section>

      <section className="leavewise-landing__cta">
        <h2>Ready to make leave management effortless?</h2>
        <p>Open the right workspace and bring every leave request into one clear process.</p>
        <div>
          <PortalLink role="employee" variant="light">Open Employee Portal</PortalLink>
          <PortalLink role="manager" variant="secondary">Open HR Portal</PortalLink>
        </div>
      </section>
    </main>

    <footer className="leavewise-landing__footer">
      <div className="leavewise-landing__footer-brand">
        <BrandLogo compact />
        <span><strong>LeaveWise</strong><small>People time, planned clearly.</small></span>
      </div>
      <nav aria-label="Footer navigation">
        <a href="#features">Features</a>
        <a href="#benefits">Benefits</a>
        <a href="/login">Sign in</a>
      </nav>
      <p>© {new Date().getFullYear()} LeaveWise.</p>
    </footer>
  </div>
);
