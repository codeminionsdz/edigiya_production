import { NextResponse } from 'next/server';
import { redeemGuestDigitalDelivery } from '@/app/(store)/actions';

function responseFor(result: { success: boolean; secret?: string; error?: string }) {
  return NextResponse.json(result, {
    status: result.success ? 200 : 403,
    headers: {
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
    },
  });
}

export async function GET() {
  return NextResponse.json(
    { success: false, error: 'Digital delivery requires a POST token exchange' },
    { status: 405, headers: { Allow: 'POST', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } },
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    return responseFor(await redeemGuestDigitalDelivery(body?.token));
  } catch {
    return responseFor({ success: false, error: 'Digital delivery is not authorized' });
  }
}
