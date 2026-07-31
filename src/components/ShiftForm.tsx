import { useState, useEffect, useMemo } from 'react';
import ui from '../data/shift-ui';
import {
  delay,
  demoShiftsForMonth,
  saveDemoShift,
  type DemoShift,
} from '../lib/demoMock';

interface StaffItem {
  id: string;
  name: string;
}

interface Props {
  staffList: StaffItem[];
  staffImages: Record<string, string>;
  workBlocks: string[];
  closedDays: number[];
}

function todayLocal(): string {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
}

function t(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ''));
}

export default function ShiftForm({ staffList, staffImages, workBlocks, closedDays }: Props) {
  const now = new Date();
  const [staff, setStaff] = useState(staffList[0]?.id ?? '');
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [monthShifts, setMonthShifts] = useState<DemoShift[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const loadMonth = async () => {
    setLoading(true);
    await delay(80);
    setMonthShifts(demoShiftsForMonth(viewYear, viewMonth, staff));
    setLoading(false);
  };

  useEffect(() => {
    loadMonth();
    setSelectedDate('');
    setSelectedSlots([]);
    setMessage('');
  }, [viewYear, viewMonth, staff]);

  const shiftMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const s of monthShifts) map.set(s.date, s.slots);
    return map;
  }, [monthShifts]);

  const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
  const firstDow = new Date(viewYear, viewMonth - 1, 1).getDay();
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const selectDate = (day: number) => {
    const date = `${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dow = new Date(viewYear, viewMonth - 1, day).getDay();
    if (closedDays.includes(dow) || date < todayLocal()) return;

    setSelectedDate(date);
    setSelectedSlots(shiftMap.get(date) ?? []);
    setMessage('');
  };

  const toggleSlot = (slot: string) => {
    setSelectedSlots((prev) =>
      prev.includes(slot) ? prev.filter((s) => s !== slot) : [...prev, slot],
    );
  };

  const selectAllSlots = () => setSelectedSlots([...workBlocks]);
  const clearSlots = () => setSelectedSlots([]);

  const save = async () => {
    if (!selectedDate) return;
    setSaving(true);
    setMessage('');
    try {
      await delay(120);
      saveDemoShift({ staff, date: selectedDate, slots: selectedSlots });
      setMessage(selectedSlots.length === 0 ? ui.savedOff : ui.saved);
      await loadMonth();
    } catch {
      setMessage(ui.network);
    } finally {
      setSaving(false);
    }
  };

  const goPrev = () => {
    if (viewMonth === 1) {
      setViewYear((y) => y - 1);
      setViewMonth(12);
    } else setViewMonth((m) => m - 1);
  };

  const goNext = () => {
    if (viewMonth === 12) {
      setViewYear((y) => y + 1);
      setViewMonth(1);
    } else setViewMonth((m) => m + 1);
  };

  return (
    <div className="space-y-8">
      <p className="text-center text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
        {ui.demoBanner}
      </p>
      <div>
        <label className="block text-sm font-medium mb-2">{ui.staffLabel}</label>
        <div className="flex flex-wrap gap-3">
          {staffList.map((s) => {
            const imgSrc = staffImages[s.id];
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setStaff(s.id)}
                className={`px-4 py-2 rounded border text-sm transition-colors flex items-center gap-2 ${
                  staff === s.id
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-gray-200 hover:border-primary/50'
                }`}
              >
                {imgSrc ? (
                  <img src={imgSrc} alt="" className="w-8 h-8 rounded-full object-cover" />
                ) : null}
                {s.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div>
          <div className="flex items-center justify-between mb-4">
            <button type="button" onClick={goPrev} className="w-9 h-9 rounded-full border border-gray-200 text-sm hover:bg-gray-50">
              &lsaquo;
            </button>
            <p className="font-display text-lg">{t(ui.yearMonth, { y: viewYear, m: viewMonth })}</p>
            <button type="button" onClick={goNext} className="w-9 h-9 rounded-full border border-gray-200 text-sm hover:bg-gray-50">
              &rsaquo;
            </button>
          </div>

          <div className="grid grid-cols-7 mb-1">
            {ui.weekdays.map((w, i) => (
              <div
                key={w}
                className={`text-center text-xs py-2 ${closedDays.includes(i) ? 'text-red-400' : 'text-gray-400'}`}
              >
                {w}
              </div>
            ))}
          </div>

          {loading ? (
            <p className="text-sm text-gray-400 py-10 text-center">{ui.loading}</p>
          ) : (
            <div className="grid grid-cols-7 gap-y-1">
              {cells.map((day, i) => {
                if (!day) return <div key={`e-${i}`} className="aspect-square" />;
                const date = `${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const dow = new Date(viewYear, viewMonth - 1, day).getDay();
                const isClosed = closedDays.includes(dow);
                const isPast = date < todayLocal();
                const slots = shiftMap.get(date);
                const hasShift = !!slots && slots.length > 0;
                const selected = selectedDate === date;
                const disabled = isClosed || isPast;

                return (
                  <button
                    key={date}
                    type="button"
                    disabled={disabled}
                    onClick={() => selectDate(day)}
                    className={`aspect-square flex flex-col items-center justify-center rounded-lg text-sm transition-colors ${
                      selected
                        ? 'bg-primary text-white'
                        : disabled
                          ? 'opacity-40 cursor-not-allowed'
                          : hasShift
                            ? 'bg-primary/10 hover:bg-primary/20'
                            : 'hover:bg-gray-50'
                    }`}
                  >
                    <span>{day}</span>
                    <span
                      className={`text-[10px] ${selected ? 'text-white/80' : hasShift ? 'text-primary' : 'text-gray-300'}`}
                    >
                      {isClosed ? '-' : hasShift ? `${slots!.length}` : ui.off}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          <p className="text-xs text-gray-400 mt-3 text-center">{ui.legend}</p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            {selectedDate ? t(ui.dateSlots, { date: selectedDate }) : ui.pickDate}
          </label>
          <p className="text-xs text-gray-400 mb-3">{ui.hoursNote}</p>

          {selectedDate ? (
            <div className="space-y-4">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={selectAllSlots}
                  className="text-xs border border-gray-200 px-3 py-1.5 rounded hover:bg-gray-50"
                >
                  {ui.selectAll}
                </button>
                <button
                  type="button"
                  onClick={clearSlots}
                  className="text-xs border border-gray-200 px-3 py-1.5 rounded hover:bg-gray-50"
                >
                  {ui.clear}
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 max-h-80 overflow-y-auto pr-1">
                {workBlocks.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => toggleSlot(slot)}
                    className={`border rounded-lg py-2 text-sm transition-colors ${
                      selectedSlots.includes(slot)
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-gray-200 hover:border-primary/50'
                    }`}
                  >
                    {slot}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="w-full bg-primary text-white py-3 rounded hover:bg-primary-dark transition-colors disabled:opacity-40"
              >
                {saving ? ui.saving : ui.save}
              </button>

              {message && <p className="text-sm text-center text-text-light">{message}</p>}
            </div>
          ) : (
            <p className="text-sm text-gray-400 py-8 text-center">{ui.hint}</p>
          )}
        </div>
      </div>
    </div>
  );
}
