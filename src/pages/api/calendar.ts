import type { APIRoute } from 'astro';
import { getMonthAvailability } from '../../lib/reservation';

export const GET: APIRoute = async ({ url }) => {
  const year = Number(url.searchParams.get('year'));
  const month = Number(url.searchParams.get('month'));
  const staff = url.searchParams.get('staff') || undefined;
  const menu = url.searchParams.get('menu') || undefined;
  const optionsParam = url.searchParams.get('options') || '';
  const optionIds = optionsParam ? optionsParam.split(',').filter(Boolean) : [];

  if (!year || !month || month < 1 || month > 12) {
    return new Response(
      JSON.stringify({ error: 'year と month（1-12）が必要です' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const days = getMonthAvailability(year, month, staff, menu, optionIds);

  return new Response(
    JSON.stringify({ year, month, staff: staff ?? null, menu: menu ?? null, options: optionIds, days }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
};
