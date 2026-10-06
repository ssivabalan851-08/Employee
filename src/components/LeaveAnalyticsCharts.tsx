import React, { useMemo } from "react";
import { BarChart3, Building2, CalendarCheck2 } from "lucide-react";
import { LeaveBalance, LeaveRequest, LeaveType } from "../types.ts";

const leaveTypes: LeaveType[] = ["annual", "sick", "casual", "parental"];

const leaveLabels: Record<LeaveType, string> = {
  annual: "Annual",
  sick: "Sick",
  casual: "Casual",
  parental: "Parental",
};

const safeNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
};

export const EmployeeLeaveUsageChart: React.FC<{ balances: LeaveBalance | null }> = ({ balances }) => {
  const data = useMemo(() => leaveTypes.map((type) => {
    const total = safeNumber(balances?.[type]?.total);
    const used = Math.min(total || Number.POSITIVE_INFINITY, safeNumber(balances?.[type]?.used));
    return { type, total, used, remaining: Math.max(0, total - used) };
  }), [balances]);

  const maxUsed = Math.max(...data.map((item) => item.used), 1);
  const totalUsed = data.reduce((sum, item) => sum + item.used, 0);
  const highest = data.reduce((current, item) => item.used > current.used ? item : current, data[0]);
  const chartSummary = data.map((item) => `${leaveLabels[item.type]} ${item.used} days`).join(", ");

  return (
    <section className="leavewise-analytics leavewise-analytics--employee" aria-labelledby="employee-leave-chart-title">
      <header className="leavewise-analytics__header">
        <div className="leavewise-analytics__heading">
          <span className="leavewise-analytics__icon"><BarChart3 aria-hidden="true" /></span>
          <div>
            <h3 id="employee-leave-chart-title">Leave Taken by Type</h3>
            <p>Approved leave days deducted from your current allowance</p>
          </div>
        </div>
        <div className="leavewise-analytics__summary">
          <strong>{totalUsed}</strong>
          <span>total days used</span>
        </div>
      </header>

      <div className="leavewise-employee-chart" role="img" aria-label={`Approved leave taken: ${chartSummary}`}>
        <div className="leavewise-employee-chart__scale" aria-hidden="true">
          <span>{maxUsed}d</span>
          <span>{Math.round(maxUsed / 2)}d</span>
          <span>0</span>
        </div>
        <div className="leavewise-employee-chart__plot">
          <span className="leavewise-employee-chart__grid leavewise-employee-chart__grid--top" />
          <span className="leavewise-employee-chart__grid leavewise-employee-chart__grid--middle" />
          <span className="leavewise-employee-chart__grid leavewise-employee-chart__grid--bottom" />
          {data.map((item) => (
            <div className="leavewise-employee-chart__column" key={item.type}>
              <div className="leavewise-employee-chart__bar-area">
                <div
                  className={`leavewise-employee-chart__bar leavewise-chart-color--${item.type}`}
                  style={{ height: item.used > 0 ? `${Math.max(8, (item.used / maxUsed) * 100)}%` : "2px" }}
                  title={`${leaveLabels[item.type]}: ${item.used} approved days used out of ${item.total}`}
                >
                  <span>{item.used}</span>
                </div>
              </div>
              <strong>{leaveLabels[item.type]}</strong>
              <small>{item.remaining}d available</small>
            </div>
          ))}
        </div>
      </div>

      <footer className="leavewise-analytics__note">
        <CalendarCheck2 aria-hidden="true" />
        {totalUsed > 0
          ? `${leaveLabels[highest.type]} leave currently has the highest usage at ${highest.used} day${highest.used === 1 ? "" : "s"}.`
          : "Approved leave will appear here after HR processes your first request."}
      </footer>
    </section>
  );
};

interface DirectoryEmployee {
  uid: string;
  department?: string;
}

export const HrApprovedLeaveChart: React.FC<{
  requests: LeaveRequest[];
  employees: DirectoryEmployee[];
}> = ({ requests, employees }) => {
  const analytics = useMemo(() => {
    const employeeDepartments = new Map(employees.map((employee) => [employee.uid, employee.department || "General"]));
    const byType: Record<LeaveType, number> = { annual: 0, sick: 0, casual: 0, parental: 0 };
    const byDepartment = new Map<string, Record<LeaveType, number>>();
    const departmentLabels = new Map<string, string>();

    requests.forEach((request) => {
      if (request.status !== "approved" || !leaveTypes.includes(request.leaveType as LeaveType)) return;
      const type = request.leaveType as LeaveType;
      const department = (request.department || employeeDepartments.get(request.uid) || "General").trim() || "General";
      const departmentKey = department.toLocaleLowerCase();
      departmentLabels.set(departmentKey, departmentLabels.get(departmentKey) || department);
      byType[type] += 1;
      if (!byDepartment.has(departmentKey)) {
        byDepartment.set(departmentKey, { annual: 0, sick: 0, casual: 0, parental: 0 });
      }
      byDepartment.get(departmentKey)![type] += 1;
    });

    const departments = [...byDepartment.entries()]
      .map(([departmentKey, counts]) => ({
        department: departmentLabels.get(departmentKey) || "General",
        counts,
        total: leaveTypes.reduce((sum, type) => sum + counts[type], 0),
      }))
      .sort((a, b) => b.total - a.total || a.department.localeCompare(b.department));

    return {
      byType,
      departments,
      total: leaveTypes.reduce((sum, type) => sum + byType[type], 0),
      maxType: Math.max(...leaveTypes.map((type) => byType[type]), 1),
      maxDepartment: Math.max(...departments.map((item) => item.total), 1),
    };
  }, [employees, requests]);

  return (
    <section className="leavewise-analytics leavewise-analytics--hr" aria-labelledby="hr-approved-chart-title">
      <header className="leavewise-analytics__header">
        <div className="leavewise-analytics__heading">
          <span className="leavewise-analytics__icon"><Building2 aria-hidden="true" /></span>
          <div>
            <h3 id="hr-approved-chart-title">Approved Leave Classification</h3>
            <p>Approved application counts grouped by leave type and employee department</p>
          </div>
        </div>
        <div className="leavewise-analytics__summary">
          <strong>{analytics.total}</strong>
          <span>approved requests</span>
        </div>
      </header>

      {analytics.total === 0 ? (
        <div className="leavewise-analytics__empty">
          <CalendarCheck2 aria-hidden="true" />
          <strong>No approved leave records yet</strong>
          <span>This graph will update automatically after HR approves an application.</span>
        </div>
      ) : (
        <div className="leavewise-hr-charts">
          <div className="leavewise-hr-chart-panel">
            <div className="leavewise-hr-chart-panel__title">
              <strong>By leave type</strong>
              <span>Number of approved requests</span>
            </div>
            <div className="leavewise-type-bars">
              {leaveTypes.map((type) => (
                <div className="leavewise-type-bars__row" key={type}>
                  <span className={`leavewise-chart-dot leavewise-chart-color--${type}`} />
                  <span className="leavewise-type-bars__label">{leaveLabels[type]}</span>
                  <span className="leavewise-type-bars__track">
                    <span
                      className={`leavewise-type-bars__fill leavewise-chart-color--${type}`}
                      style={{ width: `${(analytics.byType[type] / analytics.maxType) * 100}%` }}
                    />
                  </span>
                  <strong>{analytics.byType[type]}</strong>
                </div>
              ))}
            </div>
          </div>

          <div className="leavewise-hr-chart-panel">
            <div className="leavewise-hr-chart-panel__title">
              <strong>By department and type</strong>
              <span>Each segment represents an approved request</span>
            </div>
            <div className="leavewise-department-bars">
              {analytics.departments.map((item) => {
                const description = leaveTypes
                  .filter((type) => item.counts[type] > 0)
                  .map((type) => `${item.counts[type]} ${leaveLabels[type].toLowerCase()}`)
                  .join(", ");
                return (
                  <div
                    className="leavewise-department-bars__row"
                    key={item.department}
                    role="img"
                    aria-label={`${item.department}: ${item.total} approved requests; ${description}`}
                  >
                    <span className="leavewise-department-bars__label" title={item.department}>{item.department}</span>
                    <span className="leavewise-department-bars__track">
                      {leaveTypes.map((type) => item.counts[type] > 0 && (
                        <span
                          key={type}
                          className={`leavewise-department-bars__segment leavewise-chart-color--${type}`}
                          style={{ width: `${(item.counts[type] / analytics.maxDepartment) * 100}%` }}
                          title={`${leaveLabels[type]}: ${item.counts[type]}`}
                        />
                      ))}
                    </span>
                    <strong>{item.total}</strong>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <footer className="leavewise-chart-legend" aria-label="Leave type chart legend">
        {leaveTypes.map((type) => (
          <span key={type}><i className={`leavewise-chart-color--${type}`} />{leaveLabels[type]}</span>
        ))}
      </footer>
    </section>
  );
};
