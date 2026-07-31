import type { APIRoute } from 'astro';
import { getShiftsForMonth, upsertShift, readShifts } from '../../lib/shifts';

export const GET: APIRoute = async ({ url }) => {
  const year = Number(url.searchParams.get('year'));
  const month = Number(url.searchParams.get('month'));
  const staff = url.searchParams.get('staff') || undefined;
  const date = url.searchParams.get('date') || undefined;

  if (date) {
    const shifts = readShifts().filter((s) => {
      if (s.date !== date) return false;
      if (staff && s.staff !== staff) return false;
      return true;
    });
    return new Response(JSON.stringify({ date, staff: staff ?? null, shifts }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!year || !month || month < 1 || month > 12) {
    return new Response(
      JSON.stringify({ error: 'year と month（1-12）、または date が必要です' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const shifts = getShiftsForMonth(year, month, staff);
  return new Response(JSON.stringify({ year, month, staff: staff ?? null, shifts }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const { staff, date, slots } = await request.json();

    if (!staff || !date || !Array.isArray(slots)) {
      return new Response(
        JSON.stringify({ success: false, error: 'staff, date, slots が必要です' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const result = upsertShift({ staff, date, slots });
    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 400,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(
      JSON.stringify({ success: false, error: 'サーバーエラーが発生しました' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
};
