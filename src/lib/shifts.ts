import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { STAFF_IDS, WORK_BLOCKS, timeToMinutes, minutesToTime, CLOSE_TIME } from './salon';

const DATA_DIR = path.resolve('data');
const SHIFTS_FILE = path.join(DATA_DIR, 'shifts.json');

export interface Shift {
  id: string;
  staff: string;
  date: string;
  /**
   * 出勤している30分ブロック（例: 09:00〜18:30）
   * 予約の所要時間ぶん連続して含まれている必要がある
   */
  slots: string[];
  updatedAt: string;
}

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(SHIFTS_FILE)) {
    fs.writeFileSync(SHIFTS_FILE, '[]', 'utf-8');
  }
}

export function readShifts(): Shift[] {
  ensureFile();
  return JSON.parse(fs.readFileSync(SHIFTS_FILE, 'utf-8'));
}

function writeShifts(shifts: Shift[]) {
  ensureFile();
  fs.writeFileSync(SHIFTS_FILE, JSON.stringify(shifts, null, 2), 'utf-8');
}

/** 指定日・スタッフの勤務ブロック */
export function getStaffShiftSlots(date: string, staffId: string): string[] {
  const shift = readShifts().find((s) => s.date === date && s.staff === staffId);
  return shift?.slots ?? [];
}

/** 指定ブロックに出勤しているスタッフ */
export function getStaffOnShift(date: string, block: string): string[] {
  return readShifts()
    .filter((s) => s.date === date && s.slots.includes(block))
    .map((s) => s.staff)
    .filter((id) => (STAFF_IDS as readonly string[]).includes(id));
}

/** 指定の所要時間ぶん、連続してシフトがあるか */
export function isOnShiftForDuration(
  date: string,
  staffId: string,
  startTime: string,
  durationMin: number,
): boolean {
  const shiftSlots = new Set(getStaffShiftSlots(date, staffId));
  if (shiftSlots.size === 0) return false;

  const start = timeToMinutes(startTime);
  const end = start + durationMin;
  // 閉店を超える予約は不可
  if (end > timeToMinutes(CLOSE_TIME)) return false;

  for (let t = start; t < end; t += 30) {
    if (!shiftSlots.has(minutesToTime(t))) return false;
  }
  return true;
}

export interface UpsertShiftInput {
  staff: string;
  date: string;
  slots: string[];
}

export interface UpsertShiftResult {
  success: boolean;
  shift?: Shift;
  error?: string;
}

/** シフト提出・更新（同日同スタッフは上書き。slots空＝休み） */
export function upsertShift(input: UpsertShiftInput): UpsertShiftResult {
  const { staff, date, slots } = input;

  if (!(STAFF_IDS as readonly string[]).includes(staff)) {
    return { success: false, error: '無効なスタッフです' };
  }

  const validSlots = slots.filter((t) => (WORK_BLOCKS as readonly string[]).includes(t));
  const uniqueSlots = [...new Set(validSlots)].sort(
    (a, b) => timeToMinutes(a) - timeToMinutes(b),
  );

  const all = readShifts();
  const idx = all.findIndex((s) => s.staff === staff && s.date === date);
  const now = new Date().toISOString();

  if (uniqueSlots.length === 0) {
    if (idx >= 0) {
      all.splice(idx, 1);
      writeShifts(all);
    }
    return {
      success: true,
      shift: { id: '', staff, date, slots: [], updatedAt: now },
    };
  }

  if (idx >= 0) {
    all[idx] = { ...all[idx], slots: uniqueSlots, updatedAt: now };
    writeShifts(all);
    return { success: true, shift: all[idx] };
  }

  const shift: Shift = {
    id: randomUUID(),
    staff,
    date,
    slots: uniqueSlots,
    updatedAt: now,
  };
  all.push(shift);
  writeShifts(all);
  return { success: true, shift };
}

/** 指定月のシフト一覧 */
export function getShiftsForMonth(year: number, month: number, staffId?: string): Shift[] {
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  return readShifts().filter((s) => {
    if (!s.date.startsWith(prefix)) return false;
    if (staffId && s.staff !== staffId) return false;
    return true;
  });
}
