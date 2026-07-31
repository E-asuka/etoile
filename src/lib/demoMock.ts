// Client-safe mock for portfolio demo (no server / no fs).

export type DayStatus = 'open' | 'few' | 'full' | 'closed' | 'past' | 'beyond';

export interface DayAvailability {
  date: string;
  status: DayStatus;
  mark: string;
  availableCount: number;
}

const CLOSED_DAYS = [2]; // Tue
const OPEN_MIN = 9 * 60;
const CLOSE_MIN = 19 * 60;
const LAST_ACCEPT_MIN = 18 * 60;
const INTERVAL = 30;

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function formatDate(y: number, m: number, d: number) {
  return `${y}-${pad(m)}-${pad(d)}`;
}

export function todayLocal() {
  const now = new Date();
  return formatDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function maxBookableDate(months: number) {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return formatDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

export function startSlots(): string[] {
  const slots: string[] = [];
  for (let t = OPEN_MIN; t <= LAST_ACCEPT_MIN; t += INTERVAL) {
    slots.push(`${pad(Math.floor(t / 60))}:${pad(t % 60)}`);
  }
  return slots;
}

function timeToMin(time: string) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function dayOfWeek(date: string) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

/** Deterministic faux occupancy so the calendar looks alive */
function fauxBusyScore(date: string) {
  let h = 0;
  for (let i = 0; i < date.length; i++) h = (h * 31 + date.charCodeAt(i)) >>> 0;
  return h % 10;
}

export function mockAvailableSlots(date: string, durationMin: number): string[] {
  const today = todayLocal();
  if (date < today) return [];
  if (CLOSED_DAYS.includes(dayOfWeek(date))) return [];

  const all = startSlots().filter((slot) => timeToMin(slot) + durationMin <= CLOSE_MIN);
  const score = fauxBusyScore(date);

  if (score >= 8) {
    // nearly full
    return all.filter((_, i) => i % 5 === 0).slice(0, 2);
  }
  if (score >= 5) {
    // few
    return all.filter((_, i) => i % 3 !== 0);
  }
  // open — drop a couple of lunch slots for realism
  return all.filter((slot) => slot !== '12:00' && slot !== '12:30');
}

export function mockMonthAvailability(
  year: number,
  month: number,
  durationMin: number,
  maxAdvanceMonths: number,
): DayAvailability[] {
  const today = todayLocal();
  const maxDate = maxBookableDate(maxAdvanceMonths);
  const daysInMonth = new Date(year, month, 0).getDate();
  const days: DayAvailability[] = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const date = formatDate(year, month, d);
    if (date < today) {
      days.push({ date, status: 'past', mark: '\u00d7', availableCount: 0 });
      continue;
    }
    if (date > maxDate) {
      days.push({ date, status: 'beyond', mark: '\u00d7', availableCount: 0 });
      continue;
    }
    if (CLOSED_DAYS.includes(dayOfWeek(date))) {
      days.push({ date, status: 'closed', mark: '-', availableCount: 0 });
      continue;
    }
    const slots = mockAvailableSlots(date, durationMin);
    const count = slots.length;
    if (count === 0) {
      days.push({ date, status: 'full', mark: '\u00d7', availableCount: 0 });
    } else if (count <= 4) {
      days.push({ date, status: 'few', mark: '\u25b3', availableCount: count });
    } else {
      days.push({ date, status: 'open', mark: '\u25cb', availableCount: count });
    }
  }
  return days;
}

export function mockReservationId() {
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : String(Date.now()).slice(-8);
  return `demo-${id}`;
}

export type DemoShift = {
  id: string;
  staff: string;
  date: string;
  slots: string[];
};

const SHIFT_KEY = 'etoile-demo-shifts-v1';

export function loadDemoShifts(): DemoShift[] {
  try {
    const raw = localStorage.getItem(SHIFT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveDemoShift(input: {
  staff: string;
  date: string;
  slots: string[];
}): DemoShift {
  const all = loadDemoShifts().filter(
    (s) => !(s.staff === input.staff && s.date === input.date),
  );
  if (input.slots.length > 0) {
    all.push({
      id: mockReservationId(),
      staff: input.staff,
      date: input.date,
      slots: [...input.slots].sort(),
    });
  }
  localStorage.setItem(SHIFT_KEY, JSON.stringify(all));
  return all.find((s) => s.staff === input.staff && s.date === input.date) ?? {
    id: '',
    staff: input.staff,
    date: input.date,
    slots: [],
  };
}

export function demoShiftsForMonth(year: number, month: number, staff: string): DemoShift[] {
  const prefix = `${year}-${pad(month)}-`;
  return loadDemoShifts().filter((s) => s.staff === staff && s.date.startsWith(prefix));
}

export function delay(ms = 120) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}
