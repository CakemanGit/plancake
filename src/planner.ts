import { DateTime } from 'luxon';
import {
  ensureUser,
  isTaskCompleted,
  listHolidays,
  listTasks,
  listVacations,
  type Holiday,
  type Task,
  type Vacation,
} from './db.js';

export type PlanPeriod = 'today' | 'tomorrow' | 'date' | 'week' | 'weekdays' | 'weekend' | 'holiday' | 'vacation';

export interface PlannedTask extends Task {
  completed: boolean;
}

export interface DayPlan {
  date: string;
  tasks: PlannedTask[];
  holidayNames: string[];
  vacationNames: string[];
}

export function isValidDateKey(value: string, timezone: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = DateTime.fromISO(value, { zone: timezone });
  return date.isValid && date.toISODate() === value;
}

export function isValidTime(value: string, timezone: string): boolean {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return false;
  return DateTime.fromFormat(value, 'HH:mm', { zone: timezone, setZone: true }).isValid;
}

export function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function getLocalNow(userId: string): DateTime {
  return DateTime.now().setZone(ensureUser(userId).timezone);
}

function dateKey(date: DateTime): string {
  const key = date.toISODate();
  if (!key) throw new Error('Не удалось вычислить дату в указанном часовом поясе.');
  return key;
}

function isTaskActiveOnDate(task: Task, date: string, timezone: string, holidays: Holiday[], vacations: Vacation[]): boolean {
  const day = DateTime.fromISO(date, { zone: timezone });
  if (!day.isValid) return false;

  switch (task.pattern) {
    case 'once':
      return task.scheduled_date === date;
    case 'daily':
      return true;
    case 'weekdays':
      return day.weekday >= 1 && day.weekday <= 5;
    case 'weekend':
      return day.weekday === 6 || day.weekday === 7;
    case 'holiday':
      return holidays.some(holiday => holiday.date === date);
    case 'vacation':
      return vacations.some(vacation => vacation.start_date <= date && vacation.end_date >= date);
  }
}

export function taskMatchesDate(task: Task, userId: string, date: string): boolean {
  const settings = ensureUser(userId);
  return isTaskActiveOnDate(task, date, settings.timezone, listHolidays(userId), listVacations(userId));
}

export function getPlanDates(userId: string, period: PlanPeriod, customDate?: string): string[] {
  const timezone = ensureUser(userId).timezone;
  const today = DateTime.now().setZone(timezone).startOf('day');

  if (period === 'date') {
    if (!customDate || !isValidDateKey(customDate, timezone)) return [];
    return [customDate];
  }
  if (period === 'today') return [dateKey(today)];
  if (period === 'tomorrow') return [dateKey(today.plus({ days: 1 }))];
  if (period === 'week') return Array.from({ length: 7 }, (_, index) => dateKey(today.plus({ days: index })));

  if (period === 'weekdays') {
    const result: string[] = [];
    for (let offset = 0; result.length < 5 && offset < 14; offset += 1) {
      const day = today.plus({ days: offset });
      if (day.weekday >= 1 && day.weekday <= 5) result.push(dateKey(day));
    }
    return result;
  }

  if (period === 'weekend') {
    const daysUntilSaturday = (6 - today.weekday + 7) % 7;
    const saturday = today.plus({ days: daysUntilSaturday });
    // Если сейчас воскресенье, ближайшие выходные считаются текущими.
    const start = today.weekday === 7 ? today.minus({ days: 1 }) : saturday;
    return [dateKey(start), dateKey(start.plus({ days: 1 }))];
  }

  if (period === 'holiday') {
    return listHolidays(userId)
      .map(item => item.date)
      .filter(date => date >= dateKey(today))
      .filter((date, index, all) => all.indexOf(date) === index)
      .slice(0, 12);
  }

  const vacations = listVacations(userId);
  const days = new Set<string>();
  for (const vacation of vacations) {
    const startKey = vacation.start_date > dateKey(today) ? vacation.start_date : dateKey(today);
    const endKey = vacation.end_date;
    if (startKey > endKey) continue;
    let cursor = DateTime.fromISO(startKey, { zone: timezone });
    const end = DateTime.fromISO(endKey, { zone: timezone });
    while (cursor.toMillis() <= end.toMillis() && days.size < 14) {
      days.add(dateKey(cursor));
      cursor = cursor.plus({ days: 1 });
    }
    if (days.size >= 14) break;
  }
  return [...days].sort();
}

export function buildDayPlans(userId: string, dates: string[]): DayPlan[] {
  const settings = ensureUser(userId);
  const tasks = listTasks(userId);
  const holidays = listHolidays(userId);
  const vacations = listVacations(userId);

  return dates.map(date => ({
    date,
    tasks: tasks
      .filter(task => isTaskActiveOnDate(task, date, settings.timezone, holidays, vacations))
      .map(task => ({ ...task, completed: isTaskCompleted(task.id, date) })),
    holidayNames: holidays.filter(item => item.date === date).map(item => item.name),
    vacationNames: vacations
      .filter(item => item.start_date <= date && item.end_date >= date)
      .map(item => item.name),
  }));
}

export function getPeriodTitle(period: PlanPeriod): string {
  const titles: Record<PlanPeriod, string> = {
    today: 'План на сегодня',
    tomorrow: 'План на завтра',
    date: 'План на выбранную дату',
    week: 'План на следующие 7 дней',
    weekdays: 'План на будни',
    weekend: 'План на ближайшие выходные',
    holiday: 'Планы на праздники',
    vacation: 'Планы на каникулы',
  };
  return titles[period];
}

export function patternLabel(pattern: Task['pattern']): string {
  const labels: Record<Task['pattern'], string> = {
    once: 'ОДИН РАЗ',
    daily: 'КАЖДЫЙ ДЕНЬ',
    weekdays: 'БУДНИ',
    weekend: 'ВЫХОДНЫЕ',
    holiday: 'ПРАЗДНИКИ',
    vacation: 'КАНИКУЛЫ',
  };
  return labels[pattern];
}

export function getTaskTimestamp(task: Task, date: string, timezone: string): number | undefined {
  if (!task.time) return undefined;
  const dateTime = DateTime.fromISO(`${date}T${task.time}`, { zone: timezone });
  return dateTime.isValid ? Math.floor(dateTime.toSeconds()) : undefined;
}

export function formatDateTag(date: string, timezone: string): string {
  const atNoon = DateTime.fromISO(date, { zone: timezone }).set({ hour: 12, minute: 0, second: 0, millisecond: 0 });
  return atNoon.isValid ? `<t:${Math.floor(atNoon.toSeconds())}:D>` : date;
}

export function getHolidayNameForDate(userId: string, date: string): string | undefined {
  return listHolidays(userId).find(item => item.date === date)?.name;
}

export function getVacationNameForDate(userId: string, date: string): string | undefined {
  return listVacations(userId).find(item => item.start_date <= date && item.end_date >= date)?.name;
}

export function countDatesInVacation(vacation: Vacation): number {
  const start = DateTime.fromISO(vacation.start_date);
  const end = DateTime.fromISO(vacation.end_date);
  return start.isValid && end.isValid ? Math.floor(end.diff(start, 'days').days) + 1 : 0;
}
