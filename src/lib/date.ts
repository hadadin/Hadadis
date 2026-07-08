import { addDays, startOfWeek, format } from "date-fns";

/** The household runs a Sunday-first week (Israel convention). */
export function currentWeekStart(date: Date = new Date()): Date {
  return startOfWeek(date, { weekStartsOn: 0 });
}

export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function dayInWeek(weekStart: Date, dayIndex: number): Date {
  return addDays(weekStart, dayIndex);
}

export function isoDate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function todayDayIndex(date: Date = new Date()): number {
  return date.getDay(); // 0 = Sunday, matches day_index convention throughout the schema
}

export function friendlyDate(date: Date): string {
  return format(date, "EEE, MMM d");
}
