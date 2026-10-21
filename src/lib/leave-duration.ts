import type { LeaveDayPortion } from "../types.ts";

export const isHalfDayPortion = (portion: LeaveDayPortion) => portion !== "full_day";

export function calculateBusinessDays(startDateStr: string, endDateStr: string) {
  if (!startDateStr || !endDateStr) return 0;
  const start = new Date(`${startDateStr}T00:00:00`);
  const end = new Date(`${endDateStr}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return 0;

  let count = 0;
  for (const day = new Date(start); day <= end; day.setDate(day.getDate() + 1)) {
    if (day.getDay() !== 0 && day.getDay() !== 6) count += 1;
  }
  return count;
}

export function calculateRequestedLeaveDays(
  startDate: string,
  endDate: string,
  portion: LeaveDayPortion,
) {
  const businessDays = calculateBusinessDays(startDate, endDate);
  if (!isHalfDayPortion(portion)) return businessDays;
  return startDate === endDate && businessDays === 1 ? 0.5 : 0;
}

export function formatLeaveDays(days: number) {
  const value = Number.isInteger(days) ? String(days) : days.toFixed(1);
  return `${value} ${days === 1 ? "day" : "days"}`;
}

export function formatDayPortion(portion: LeaveDayPortion) {
  if (portion === "morning") return "Morning half day";
  if (portion === "afternoon") return "Afternoon half day";
  return "Full day";
}
