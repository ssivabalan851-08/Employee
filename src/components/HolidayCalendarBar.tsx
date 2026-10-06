import React from "react";
import {
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Landmark,
} from "lucide-react";
import { CalendarEvent } from "../types";
import { DbService } from "../lib/db-service";

// Government dates follow the Government of India 2026 gazetted holiday calendar.
// Company dates are stored separately so HR can replace them with the organisation's policy dates.
const fallbackHolidayEvents = ([
  { date: "2026-01-26", title: "Republic Day", kind: "government", note: "Government holiday" },
  { date: "2026-03-04", title: "Holi", kind: "government", note: "Government holiday" },
  { date: "2026-03-21", title: "Id-ul-Fitr", kind: "government", note: "Government holiday" },
  { date: "2026-03-26", title: "Ram Navami", kind: "government", note: "Government holiday" },
  { date: "2026-03-31", title: "Mahavir Jayanti", kind: "government", note: "Government holiday" },
  { date: "2026-04-03", title: "Good Friday", kind: "government", note: "Government holiday" },
  { date: "2026-05-01", title: "Buddha Purnima", kind: "government", note: "Government holiday" },
  { date: "2026-05-27", title: "Id-ul-Zuha (Bakrid)", kind: "government", note: "Government holiday" },
  { date: "2026-06-26", title: "Muharram", kind: "government", note: "Government holiday" },
  { date: "2026-08-15", title: "Independence Day", kind: "government", note: "Government holiday" },
  { date: "2026-08-26", title: "Milad-un-Nabi", kind: "government", note: "Government holiday" },
  { date: "2026-09-04", title: "Janmashtami", kind: "government", note: "Government holiday" },
  { date: "2026-10-02", title: "Gandhi Jayanti", kind: "government", note: "Government holiday" },
  { date: "2026-10-19", title: "Company Festival Break", kind: "company", note: "Company-wide common leave" },
  { date: "2026-10-20", title: "Dussehra", kind: "government", note: "Government holiday" },
  { date: "2026-11-08", title: "Diwali (Deepavali)", kind: "government", note: "Government holiday" },
  { date: "2026-11-24", title: "Guru Nanak's Birthday", kind: "government", note: "Government holiday" },
  { date: "2026-12-24", title: "Christmas Eve Break", kind: "company", note: "Company-wide common leave" },
  { date: "2026-12-25", title: "Christmas Day", kind: "government", note: "Government holiday" },
  { date: "2026-12-31", title: "Year-end Common Leave", kind: "company", note: "Company-wide common leave" },
] satisfies CalendarEvent[]).sort((a, b) => a.date.localeCompare(b.date));

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const formatDateKey = (date: Date) => [
  date.getFullYear(),
  String(date.getMonth() + 1).padStart(2, "0"),
  String(date.getDate()).padStart(2, "0"),
].join("-");

const createCalendarDays = (month: Date) => {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const gridStart = new Date(month.getFullYear(), month.getMonth(), 1 - firstDay.getDay());
  return Array.from({ length: 42 }, (_, index) => (
    new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index)
  ));
};

export const HolidayCalendarBar: React.FC = () => {
  const titleId = React.useId();
  const today = React.useMemo(() => new Date(), []);
  const todayKey = formatDateKey(today);
  const [events, setEvents] = React.useState<CalendarEvent[]>(fallbackHolidayEvents);
  const [visibleMonth, setVisibleMonth] = React.useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

  React.useEffect(() => {
    let isCurrent = true;
    DbService.getCalendarEvents()
      .then(databaseEvents => {
        if (!isCurrent || databaseEvents.length === 0) return;
        setEvents([...databaseEvents].sort((a, b) => a.date.localeCompare(b.date)));
      })
      .catch(() => {
        // The verified built-in schedule keeps the calendar useful during brief outages.
      });
    return () => { isCurrent = false; };
  }, []);

  const eventsByDate = React.useMemo(() => {
    const result = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const dateEvents = result.get(event.date) ?? [];
      dateEvents.push(event);
      result.set(event.date, dateEvents);
    }
    return result;
  }, [events]);

  const calendarDays = React.useMemo(() => createCalendarDays(visibleMonth), [visibleMonth]);
  const visibleMonthPrefix = `${visibleMonth.getFullYear()}-${String(visibleMonth.getMonth() + 1).padStart(2, "0")}`;
  const monthEvents = events.filter(event => event.date.startsWith(visibleMonthPrefix));
  const monthLabel = visibleMonth.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  const moveMonth = (change: number) => {
    setVisibleMonth(current => new Date(current.getFullYear(), current.getMonth() + change, 1));
  };

  const showCurrentMonth = () => {
    setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1));
  };

  return (
    <section className="leavewise-month-calendar" aria-labelledby={titleId}>
      <header className="leavewise-month-calendar__header">
        <div className="leavewise-month-calendar__heading">
          <span className="leavewise-month-calendar__icon"><CalendarDays aria-hidden="true" /></span>
          <div>
            <h2 id={titleId}>Holiday & Common Leave Calendar</h2>
            <p>View the complete month and plan around government holidays and company-wide leave.</p>
          </div>
        </div>

        <div className="leavewise-month-calendar__navigation">
          <button type="button" onClick={() => moveMonth(-1)} aria-label="Show previous month">
            <ChevronLeft aria-hidden="true" />
          </button>
          <strong aria-live="polite">{monthLabel}</strong>
          <button type="button" onClick={() => moveMonth(1)} aria-label="Show next month">
            <ChevronRight aria-hidden="true" />
          </button>
          <button type="button" className="leavewise-month-calendar__today" onClick={showCurrentMonth}>Today</button>
        </div>
      </header>

      <div className="leavewise-month-calendar__meta">
        <div className="leavewise-month-calendar__legend" aria-label="Calendar categories">
          <span><i className="is-government" />Government holiday</span>
          <span><i className="is-company" />Company common leave</span>
          <span><i className="is-today" />Today</span>
        </div>
        <span className="leavewise-month-calendar__summary">
          <Landmark aria-hidden="true" />
          {monthEvents.length} {monthEvents.length === 1 ? "holiday" : "holidays"} this month
        </span>
      </div>

      <div className="leavewise-month-calendar__scroll">
        <div className="leavewise-month-calendar__grid" role="grid" aria-label={`${monthLabel} holiday calendar`}>
          {WEEKDAYS.map(day => (
            <div className="leavewise-month-calendar__weekday" role="columnheader" key={day}>
              <span>{day.slice(0, 3)}</span>
              <strong>{day}</strong>
            </div>
          ))}

          {calendarDays.map(date => {
            const dateKey = formatDateKey(date);
            const dateEvents = eventsByDate.get(dateKey) ?? [];
            const isCurrentMonth = date.getMonth() === visibleMonth.getMonth();
            const isToday = dateKey === todayKey;
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
            const accessibleDate = date.toLocaleDateString("en-IN", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            });
            const eventNames = dateEvents.map(event => event.title).join(", ");

            return (
              <div
                className={`leavewise-month-calendar__day${isCurrentMonth ? "" : " is-outside"}${isToday ? " is-today" : ""}${isWeekend ? " is-weekend" : ""}${dateEvents.length ? " has-events" : ""}`}
                role="gridcell"
                aria-label={`${accessibleDate}${eventNames ? `. ${eventNames}` : ""}`}
                key={dateKey}
              >
                <div className="leavewise-month-calendar__day-number">
                  <time dateTime={dateKey}>{date.getDate()}</time>
                  {isToday && <span>Today</span>}
                </div>
                <div className="leavewise-month-calendar__events">
                  {dateEvents.map(event => {
                    const EventIcon = event.kind === "government" ? Landmark : Building2;
                    return (
                      <div
                        className={`leavewise-month-calendar__event is-${event.kind}`}
                        title={`${event.title} — ${event.note}`}
                        key={event.id ?? `${event.date}-${event.title}`}
                      >
                        <EventIcon aria-hidden="true" />
                        <span>{event.title}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
