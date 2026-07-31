import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  CLOSED_DAYS,
  MAX_ADVANCE_MONTHS,
  NO_PREFERENCE,
  STAFF_IDS,
  TIME_SLOTS,
  calcService,
  endTimeOf,
  timeToMinutes,
} from './salon';
import { isOnShiftForDuration } from './shifts';

const DATA_DIR = path.resolve('data');
const RESERVATIONS_FILE = path.join(DATA_DIR, 'reservations.json');

export interface Reservation {
  id: string;
  menu: string;
  options: string[];
  durationMin: number;
  /** 実際に枠を占有するスタッフID */
  staff: string;
  /** お客様の希望: 'any'（指名なし）またはスタッフID */
  preference: string;
  date: string;
  time: string;
  endTime: string;
  /** お客様情報 */
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  createdAt: string;
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(RESERVATIONS_FILE)) {
    fs.writeFileSync(RESERVATIONS_FILE, '[]', 'utf-8');
  }
}

function readAll(): Reservation[] {
  ensureDataDir();
  const raw = fs.readFileSync(RESERVATIONS_FILE, 'utf-8');
  return JSON.parse(raw);
}

function writeAll(reservations: Reservation[]) {
  ensureDataDir();
  fs.writeFileSync(RESERVATIONS_FILE, JSON.stringify(reservations, null, 2), 'utf-8');
}

function parseLocalDate(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function todayLocal(): string {
  const now = new Date();
  return formatDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function maxBookableDate(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + MAX_ADVANCE_MONTHS);
  return formatDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

function isWithinBookableRange(date: string): boolean {
  return date >= todayLocal() && date <= maxBookableDate();
}

function isClosed(date: string): boolean {
  return CLOSED_DAYS.includes(parseLocalDate(date).getDay());
}

function rangesOverlap(aStart: string, aDur: number, bStart: string, bDur: number): boolean {
  const a0 = timeToMinutes(aStart);
  const a1 = a0 + aDur;
  const b0 = timeToMinutes(bStart);
  const b1 = b0 + bDur;
  return a0 < b1 && b0 < a1;
}

/** スタッフがその開始時刻・所要時間で予約可能か */
function isStaffFree(
  date: string,
  startTime: string,
  durationMin: number,
  staffId: string,
  reservations: Reservation[],
): boolean {
  if (!isOnShiftForDuration(date, staffId, startTime, durationMin)) return false;

  return !reservations.some(
    (r) =>
      r.staff === staffId &&
      rangesOverlap(startTime, durationMin, r.time, r.durationMin || 60),
  );
}

export interface SlotQuery {
  date: string;
  staffId?: string;
  menuId?: string;
  optionIds?: string[];
}

/** メニュー所要時間を考慮した空き開始時刻一覧 */
export function getAvailableSlots(query: SlotQuery): string[] {
  const { date, staffId, menuId, optionIds = [] } = query;
  if (!isWithinBookableRange(date) || isClosed(date)) return [];

  // メニュー未指定時は最短（30分）で判定（カレンダー用）
  const service = menuId ? calcService(menuId, optionIds) : null;
  const durationMin = service?.durationMin ?? 30;

  const reservations = readAll().filter((r) => r.date === date);
  const wantsAny = !staffId || staffId === NO_PREFERENCE;
  const targetStaff = wantsAny ? [...STAFF_IDS] : [staffId];

  return TIME_SLOTS.filter((slot) =>
    targetStaff.some((sid) => isStaffFree(date, slot, durationMin, sid, reservations)),
  );
}

export type DayStatus = 'open' | 'few' | 'full' | 'closed' | 'past' | 'beyond';

export interface DayAvailability {
  date: string;
  status: DayStatus;
  mark: '○' | '△' | '×' | '-';
  availableCount: number;
}

const FEW_THRESHOLD = 2;

function statusForDay(
  date: string,
  staffId?: string,
  menuId?: string,
  optionIds?: string[],
): DayAvailability {
  if (date < todayLocal()) {
    return { date, status: 'past', mark: '×', availableCount: 0 };
  }
  if (date > maxBookableDate()) {
    return { date, status: 'beyond', mark: '×', availableCount: 0 };
  }
  if (isClosed(date)) {
    return { date, status: 'closed', mark: '-', availableCount: 0 };
  }

  const slots = getAvailableSlots({ date, staffId, menuId, optionIds });
  const count = slots.length;

  if (count === 0) {
    return { date, status: 'full', mark: '×', availableCount: 0 };
  }
  if (count <= FEW_THRESHOLD) {
    return { date, status: 'few', mark: '△', availableCount: count };
  }
  return { date, status: 'open', mark: '○', availableCount: count };
}

export function getMonthAvailability(
  year: number,
  month: number,
  staffId?: string,
  menuId?: string,
  optionIds?: string[],
): DayAvailability[] {
  const daysInMonth = new Date(year, month, 0).getDate();
  const result: DayAvailability[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    result.push(statusForDay(formatDate(year, month, day), staffId, menuId, optionIds));
  }

  return result;
}

function findAvailableStaff(
  date: string,
  time: string,
  durationMin: number,
  preference?: string,
): string | null {
  const reservations = readAll().filter((r) => r.date === date);

  if (preference && preference !== NO_PREFERENCE) {
    return isStaffFree(date, time, durationMin, preference, reservations)
      ? preference
      : null;
  }

  return (
    STAFF_IDS.find((sid) => isStaffFree(date, time, durationMin, sid, reservations)) ?? null
  );
}

export interface BookResult {
  success: boolean;
  reservation?: Reservation;
  error?: string;
}

export interface CustomerInfo {
  name: string;
  phone: string;
  email: string;
}

export function book(
  menu: string,
  date: string,
  time: string,
  preference: string = NO_PREFERENCE,
  optionIds: string[] = [],
  customer: CustomerInfo = { name: '', phone: '', email: '' },
): BookResult {
  if (!(TIME_SLOTS as readonly string[]).includes(time)) {
    return { success: false, error: '無効な時間帯です' };
  }

  const service = calcService(menu, optionIds);
  if (!service) {
    return { success: false, error: '無効なメニューです' };
  }

  const name = customer.name.trim();
  const phone = customer.phone.trim();
  const email = customer.email.trim();

  if (!name || !phone || !email) {
    return { success: false, error: 'お名前・電話番号・メールアドレスは必須です' };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false, error: 'メールアドレスの形式が正しくありません' };
  }

  if (!/^[0-9\-+\s()]{8,20}$/.test(phone)) {
    return { success: false, error: '電話番号の形式が正しくありません' };
  }

  if (date < todayLocal()) {
    return { success: false, error: '過去の日付は予約できません' };
  }

  if (date > maxBookableDate()) {
    return { success: false, error: `ご予約は${MAX_ADVANCE_MONTHS}ヶ月先までとなります` };
  }

  if (isClosed(date)) {
    return { success: false, error: '定休日です（火曜）' };
  }

  const pref = preference || NO_PREFERENCE;
  if (pref !== NO_PREFERENCE && !(STAFF_IDS as readonly string[]).includes(pref)) {
    return { success: false, error: '無効なスタッフです' };
  }

  const { durationMin } = service;
  const assignedStaff = findAvailableStaff(date, time, durationMin, pref);
  if (!assignedStaff) {
    return { success: false, error: 'ご指定の日時は満席、またはシフトと合いません' };
  }

  const reservation: Reservation = {
    id: randomUUID(),
    menu,
    options: service.options.map((o) => o.id),
    durationMin,
    staff: assignedStaff,
    preference: pref,
    date,
    time,
    endTime: endTimeOf(time, durationMin),
    customerName: name,
    customerPhone: phone,
    customerEmail: email,
    createdAt: new Date().toISOString(),
  };

  const all = readAll();
  all.push(reservation);
  writeAll(all);

  return { success: true, reservation };
}
