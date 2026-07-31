import type { APIRoute } from 'astro';
import { book } from '../../lib/reservation';
import { NO_PREFERENCE } from '../../lib/salon';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { menu, staff, date, time, options, customerName, customerPhone, customerEmail } =
      await request.json();

    if (!menu || !date || !time) {
      return new Response(
        JSON.stringify({ success: false, error: '必須項目が不足しています' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const preference = staff || NO_PREFERENCE;
    const optionIds = Array.isArray(options) ? options : [];
    const result = book(menu, date, time, preference, optionIds, {
      name: customerName ?? '',
      phone: customerPhone ?? '',
      email: customerEmail ?? '',
    });

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 409,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(
      JSON.stringify({ success: false, error: 'サーバーエラーが発生しました' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
};
