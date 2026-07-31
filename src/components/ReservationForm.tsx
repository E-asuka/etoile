import { useState, useEffect, useMemo, useRef } from 'react';
import ui from '../data/reservation-ui';

export interface MenuItem {
  id: string;
  label: string;
  price: number;
  durationMin: number;
}

export interface OptionItem {
  id: string;
  label: string;
  price: number;
  durationMin: number;
}

export interface StaffOption {
  id: string;
  label: string;
}

interface Props {
  menus: MenuItem[];
  options: OptionItem[];
  staffOptions: StaffOption[];
  staffImages: Record<string, string>;
  noPreference: string;
  maxAdvanceMonths: number;
}

type DayStatus = 'open' | 'few' | 'full' | 'closed' | 'past' | 'beyond';

interface DayAvailability {
  date: string;
  status: DayStatus;
  mark: string;
  availableCount: number;
}

type Step = 1 | 2 | 3 | 4 | 5;

function todayLocal(): string {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
}

function maxBookableDate(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

function calcTotals(menus: MenuItem[], options: OptionItem[], menuId: string, optionIds: string[]) {
  const menu = menus.find((m) => m.id === menuId);
  if (!menu) return { price: 0, durationMin: 0, optionLabels: [] as string[] };
  const opts = options.filter((o) => optionIds.includes(o.id));
  return {
    price: menu.price + opts.reduce((s, o) => s + o.price, 0),
    durationMin: menu.durationMin + opts.reduce((s, o) => s + o.durationMin, 0),
    optionLabels: opts.map((o) => o.label),
  };
}

function endTime(start: string, durationMin: number): string {
  const [h, m] = start.split(':').map(Number);
  const total = h * 60 + m + durationMin;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

/** 読み込み中もグリッド高さを保つための仮セル */
function placeholderDays(year: number, month: number): DayAvailability[] {
  const count = new Date(year, month, 0).getDate();
  const key = monthKey(year, month);
  return Array.from({ length: count }, (_, i) => ({
    date: `${key}-${String(i + 1).padStart(2, '0')}`,
    status: 'closed' as DayStatus,
    mark: '',
    availableCount: 0,
  }));
}

function t(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ''));
}

export default function ReservationForm({
  menus,
  options,
  staffOptions,
  staffImages,
  noPreference,
  maxAdvanceMonths,
}: Props) {
  const now = new Date();
  const [step, setStep] = useState<Step>(1);
  const [menu, setMenu] = useState('');
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [staff, setStaff] = useState(noPreference);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [confirmedId, setConfirmedId] = useState('');

  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1);
  const [monthDays, setMonthDays] = useState<DayAvailability[]>([]);
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const calendarFetchId = useRef(0);

  const totals = useMemo(
    () => calcTotals(menus, options, menu, selectedOptions),
    [menus, options, menu, selectedOptions],
  );
  const optionsKey = selectedOptions.slice().sort().join(',');

  const toggleOption = (id: string) => {
    setSelectedOptions((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  useEffect(() => {
    if (step !== 2 || !menu) return;
    const fetchId = ++calendarFetchId.current;
    const ac = new AbortController();
    setLoadingCalendar(true);
    const params = new URLSearchParams({
      year: String(viewYear),
      month: String(viewMonth),
      staff,
      menu,
    });
    if (optionsKey) params.set('options', optionsKey);
    fetch(`/api/calendar?${params}`, { signal: ac.signal })
      .then((r) => r.json())
      .then((data) => {
        if (fetchId !== calendarFetchId.current) return;
        setMonthDays(data.days ?? []);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (fetchId !== calendarFetchId.current) return;
        setMonthDays([]);
      })
      .finally(() => {
        if (fetchId === calendarFetchId.current) setLoadingCalendar(false);
      });
    return () => ac.abort();
  }, [step, viewYear, viewMonth, staff, menu, optionsKey]);

  useEffect(() => {
    if (!date || !menu) return;
    setLoadingSlots(true);
    setTime('');
    const params = new URLSearchParams({ date, staff, menu });
    if (optionsKey) params.set('options', optionsKey);
    fetch(`/api/slots?${params}`)
      .then((r) => r.json())
      .then((data) => setAvailableSlots(data.slots ?? []))
      .catch(() => setAvailableSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [date, staff, menu, optionsKey]);

  const displayMonthDays = useMemo(() => {
    const key = monthKey(viewYear, viewMonth);
    if (monthDays[0]?.date.startsWith(key)) return monthDays;
    return placeholderDays(viewYear, viewMonth);
  }, [viewYear, viewMonth, monthDays]);

  const calendarCells = useMemo(() => {
    const firstDow = new Date(viewYear, viewMonth - 1, 1).getDay();
    const cells: (DayAvailability | null)[] = Array(firstDow).fill(null);
    for (const day of displayMonthDays) cells.push(day);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [viewYear, viewMonth, displayMonthDays]);

  const canGoPrev = useMemo(() => {
    const [ty, tm] = todayLocal().split('-').map(Number);
    return viewYear > ty || (viewYear === ty && viewMonth > tm);
  }, [viewYear, viewMonth]);

  const canGoNext = useMemo(() => {
    const [my, mm] = maxBookableDate(maxAdvanceMonths).split('-').map(Number);
    return viewYear < my || (viewYear === my && viewMonth < mm);
  }, [viewYear, viewMonth, maxAdvanceMonths]);

  const goPrevMonth = () => {
    if (!canGoPrev) return;
    if (viewMonth === 1) {
      setViewYear((y) => y - 1);
      setViewMonth(12);
    } else setViewMonth((m) => m - 1);
  };

  const goNextMonth = () => {
    if (!canGoNext) return;
    if (viewMonth === 12) {
      setViewYear((y) => y + 1);
      setViewMonth(1);
    } else setViewMonth((m) => m + 1);
  };

  const customerValid =
    customerName.trim() !== '' &&
    customerPhone.trim() !== '' &&
    customerEmail.trim() !== '' &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.trim());

  const handleSubmit = async () => {
    if (!customerValid) {
      setError(ui.errCustomer);
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/reservation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          menu,
          staff,
          date,
          time,
          options: selectedOptions,
          customerName,
          customerPhone,
          customerEmail,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setConfirmedId(data.reservation.id);
        setStep(5);
      } else {
        setError(data.error || ui.errReserve);
      }
    } catch {
      setError(ui.errNetwork);
    } finally {
      setSubmitting(false);
    }
  };

  const staffLabel =
    staffOptions.find((s) => s.id === staff)?.label ?? ui.noPreference;
  const menuLabel = menus.find((m) => m.id === menu)?.label ?? '';

  const markClass = (mark: string, selected: boolean) => {
    if (selected) return 'text-white/90';
    if (mark === '\u00d7' || mark === 'x') return 'text-gray-400';
    if (mark === '-') return 'text-gray-300';
    if (mark === '\u25b3') return 'text-amber-500';
    return 'text-primary';
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-8">
      {step <= 4 && (
        <div className="flex items-center justify-center gap-4 mb-10">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step >= s ? 'bg-primary text-white' : 'bg-gray-200 text-gray-400'
                }`}
              >
                {s}
              </div>
              <span className="text-xs text-gray-500 hidden md:inline">{ui.steps[s - 1]}</span>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {step === 1 && (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">{ui.selectMenu}</label>
            <div className="space-y-2">
              {menus.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMenu(m.id)}
                  className={`w-full text-left border rounded-lg px-4 py-3 text-sm transition-colors ${
                    menu === m.id
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-gray-200 hover:border-primary/50'
                  }`}
                >
                  <div className="flex justify-between gap-4">
                    <span className="font-medium">{m.label}</span>
                    <span>&yen;{m.price.toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {t(ui.durationApprox, { n: m.durationMin })}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">{ui.selectOption}</label>
            <div className="grid sm:grid-cols-2 gap-2">
              {options.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => toggleOption(o.id)}
                  className={`text-left border rounded-lg px-4 py-3 text-sm transition-colors ${
                    selectedOptions.includes(o.id)
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-gray-200 hover:border-primary/50'
                  }`}
                >
                  <div className="flex justify-between gap-2">
                    <span>{o.label}</span>
                    <span>+&yen;{o.price.toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">+{o.durationMin}min</p>
                </button>
              ))}
            </div>
          </div>

          {menu && (
            <p className="text-sm text-center text-text-light bg-gray-50 rounded-lg py-3">
              {t(ui.totalLine, {
                n: totals.durationMin,
                price: totals.price.toLocaleString(),
              })}
            </p>
          )}

          <div>
            <label className="block text-sm font-medium mb-2">{ui.selectStaff}</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {staffOptions.map((s) => {
                const imgSrc = s.id === noPreference ? undefined : staffImages[s.id];
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setStaff(s.id)}
                    className={`border rounded-lg py-3 px-2 text-sm transition-colors flex flex-col items-center gap-2 ${
                      staff === s.id
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-gray-200 hover:border-primary/50'
                    }`}
                  >
                    {imgSrc ? (
                      <img src={imgSrc} alt="" className="w-12 h-12 rounded-full object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-xs text-gray-400">
                        -
                      </div>
                    )}
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={() => menu && setStep(2)}
            disabled={!menu}
            className="w-full bg-primary text-white py-3 rounded hover:bg-primary-dark transition-colors disabled:opacity-40"
          >
            {ui.next}
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <label className="block text-sm font-medium">{ui.selectDate}</label>
          <p className="text-xs text-center text-gray-400">
            {t(ui.dateHint, { n: totals.durationMin })}
          </p>

          <div className="max-w-md mx-auto">
            <div className="flex items-center justify-between mb-4">
              <button
                type="button"
                onClick={goPrevMonth}
                disabled={!canGoPrev}
                className="w-9 h-9 rounded-full border border-gray-200 text-sm disabled:opacity-30 hover:bg-gray-50"
                aria-label={ui.prevMonth}
              >
                &lsaquo;
              </button>
              <p className="font-display text-lg tracking-wide">
                {t(ui.yearMonth, { y: viewYear, m: viewMonth })}
              </p>
              <button
                type="button"
                onClick={goNextMonth}
                disabled={!canGoNext}
                className="w-9 h-9 rounded-full border border-gray-200 text-sm disabled:opacity-30 hover:bg-gray-50"
                aria-label={ui.nextMonth}
              >
                &rsaquo;
              </button>
            </div>

            <div className="grid grid-cols-7 mb-1">
              {ui.weekdays.map((w, i) => (
                <div
                  key={w}
                  className={`text-center text-xs py-2 ${
                    i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'
                  }`}
                >
                  {w}
                </div>
              ))}
            </div>

            <div
              className={`grid grid-cols-7 gap-y-1 transition-opacity duration-150 ${
                loadingCalendar ? 'opacity-40 pointer-events-none' : 'opacity-100'
              }`}
              aria-busy={loadingCalendar}
            >
              {calendarCells.map((day, i) => {
                if (!day) return <div key={`empty-${i}`} className="aspect-square" />;
                const dayNum = Number(day.date.split('-')[2]);
                const selectable =
                  !loadingCalendar && (day.status === 'open' || day.status === 'few');
                const selected = date === day.date;
                const dow = i % 7;
                return (
                  <button
                    key={day.date}
                    type="button"
                    disabled={!selectable}
                    onClick={() =>
                      (day.status === 'open' || day.status === 'few') && setDate(day.date)
                    }
                    className={`aspect-square flex flex-col items-center justify-center rounded-full text-sm transition-colors ${
                      selected
                        ? 'bg-primary text-white'
                        : selectable
                          ? 'hover:bg-primary/10'
                          : 'opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <span
                      className={
                        selected
                          ? ''
                          : dow === 0
                            ? 'text-red-500'
                            : dow === 6
                              ? 'text-blue-500'
                              : ''
                      }
                    >
                      {dayNum}
                    </span>
                    <span
                      className={`text-[10px] leading-none mt-0.5 min-h-[10px] ${markClass(day.mark, selected)}`}
                    >
                      {day.mark || '\u00a0'}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex justify-center gap-4 mt-4 text-xs text-gray-500">
              <span>{ui.legendOpen}</span>
              <span>{ui.legendFew}</span>
              <span>{ui.legendFull}</span>
              <span>{ui.legendClosed}</span>
            </div>
            <p className="text-center text-xs text-gray-400 mt-2">
              {t(ui.hoursNote, { n: maxAdvanceMonths })}
            </p>
          </div>

          {date && (
            <p className="text-center text-sm text-text-light">
              {ui.selectedDate} <span className="text-text font-medium">{date}</span>
            </p>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex-1 border border-gray-300 py-3 rounded text-sm"
            >
              {ui.back}
            </button>
            <button
              type="button"
              onClick={() => date && setStep(3)}
              disabled={!date}
              className="flex-1 bg-primary text-white py-3 rounded hover:bg-primary-dark transition-colors disabled:opacity-40"
            >
              {ui.next}
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">{ui.selectTime}</label>
            <p className="text-xs text-gray-400 mb-3">
              {t(ui.timeHint, { n: totals.durationMin })}
            </p>
            {loadingSlots ? (
              <p className="text-sm text-gray-400 py-4 text-center">{ui.loading}</p>
            ) : availableSlots.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">{ui.noSlots}</p>
            ) : (
              <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                {availableSlots.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setTime(slot)}
                    className={`border rounded-lg py-3 text-sm transition-colors ${
                      time === slot
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-gray-200 hover:border-primary/50'
                    }`}
                  >
                    <span className="block">{slot}</span>
                    <span className="block text-[10px] text-gray-400 mt-0.5">
                      ~{endTime(slot, totals.durationMin)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="flex-1 border border-gray-300 py-3 rounded text-sm"
            >
              {ui.back}
            </button>
            <button
              type="button"
              onClick={() => time && setStep(4)}
              disabled={!time}
              className="flex-1 bg-primary text-white py-3 rounded hover:bg-primary-dark transition-colors disabled:opacity-40"
            >
              {ui.next}
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-6">
          <h3 className="text-lg font-medium">{ui.confirmTitle}</h3>
          <div className="bg-gray-50 rounded-lg p-6 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">{ui.labelMenu}</span>
              <span>{menuLabel}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">{ui.labelOption}</span>
              <span className="text-right">
                {totals.optionLabels.length ? totals.optionLabels.join(' / ') : ui.labelNone}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">{ui.labelDuration}</span>
              <span>{t(ui.minutesApprox, { n: totals.durationMin })}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">{ui.labelStaff}</span>
              <span>{staffLabel}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">{ui.labelDatetime}</span>
              <span>
                {date} {time}~{endTime(time, totals.durationMin)}
              </span>
            </div>
            <div className="flex justify-between border-t pt-3">
              <span className="text-gray-500">{ui.labelPrice}</span>
              <span className="font-medium">&yen;{totals.price.toLocaleString()}</span>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium">{ui.customerTitle}</h3>
            <div>
              <label className="block text-sm font-medium mb-1">
                {ui.name} <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder={ui.namePh}
                autoComplete="name"
                className="w-full border border-gray-300 rounded px-4 py-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                {ui.phone} <span className="text-red-400">*</span>
              </label>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="090-1234-5678"
                autoComplete="tel"
                className="w-full border border-gray-300 rounded px-4 py-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                {ui.email} <span className="text-red-400">*</span>
              </label>
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="example@email.com"
                autoComplete="email"
                className="w-full border border-gray-300 rounded px-4 py-3 text-sm"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep(3)}
              className="flex-1 border border-gray-300 py-3 rounded text-sm"
            >
              {ui.back}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !customerValid}
              className="flex-1 bg-primary text-white py-3 rounded hover:bg-primary-dark transition-colors disabled:opacity-40"
            >
              {submitting ? ui.submitting : ui.submit}
            </button>
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="text-center py-8 space-y-4">
          <div className="text-4xl">OK</div>
          <h3 className="text-xl font-medium">{ui.thanks}</h3>
          <p className="text-sm text-text font-medium tracking-wide">
            {ui.reservationId} {confirmedId}
          </p>
          <p className="text-sm text-primary">{ui.idNote}</p>
          <p className="text-sm text-gray-500">{ui.emailSent}</p>
          <p className="text-sm text-gray-500">
            {date} {time}~{endTime(time, totals.durationMin)} / {menuLabel}
            {totals.optionLabels.length ? ` (${totals.optionLabels.join(' / ')})` : ''} /{' '}
            {staffLabel}
          </p>
          <button
            type="button"
            onClick={() => {
              setStep(1);
              setMenu('');
              setSelectedOptions([]);
              setStaff(noPreference);
              setDate('');
              setTime('');
              setCustomerName('');
              setCustomerPhone('');
              setCustomerEmail('');
              setConfirmedId('');
            }}
            className="mt-4 text-sm text-primary hover:underline"
          >
            {ui.another}
          </button>
        </div>
      )}
    </div>
  );
}
