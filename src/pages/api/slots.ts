import type { APIRoute } from 'astro';
import { getAvailableSlots } from '../../lib/reservation';

export const GET: APIRoute = async ({ url }) => {
  const date = url.searchParams.get('date');
  const staff = url.searchParams.get('staff') || undefined;
  const menu = url.searchParams.get('menu') || undefined;
  const optionsParam = url.searchParams.get('options') || '';
  const optionIds = optionsParam ? optionsParam.split(',').filter(Boolean) : [];

  if (!date) {
    return new Response(
      JSON.stringify({ error: 'date パラメータが必要です' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const slots = getAvailableSlots({ date, staffId: staff, menuId: menu, optionIds });

  return new Response(
    JSON.stringify({ date, staff: staff ?? null, menu: menu ?? null, options: optionIds, slots }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
};
