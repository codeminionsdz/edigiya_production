import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/admin-auth';
import * as repo from '@/lib/repositories';

export async function GET() {
  try {
    const settings = await repo.getStoreSettings();
    return NextResponse.json(settings);
  } catch (error) {
    console.error('Failed to load store settings:', error);
    return NextResponse.json({ error: 'Unable to load store settings' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const data = await request.json();
    const settings = await repo.upsertStoreSettings(data);
    return NextResponse.json(settings);
  } catch (error) {
    console.error('Failed to save store settings:', error);
    return NextResponse.json({ error: 'Unable to save store settings' }, { status: 500 });
  }
}
