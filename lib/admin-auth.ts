import { cookies } from 'next/headers';
import crypto from 'crypto';

const ADMIN_PASSWORD = process.env.ADMIN_PANEL_PASSWORD;
const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET;

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function signSessionToken(token: string) {
  if (!ADMIN_SESSION_SECRET) return null;
  return crypto.createHmac('sha256', ADMIN_SESSION_SECRET).update(token).digest('hex');
}

function isValidSession(value: string | undefined): value is string {
  if (!value) return false;
  const [token, signature] = value.split('.');
  if (!token || !/^[a-f0-9]{64}$/.test(token) || !/^[a-f0-9]{64}$/.test(signature || '')) return false;
  const signatureValue = signSessionToken(token);
  if (!signatureValue) return false;
  const expected = Buffer.from(signatureValue, 'hex');
  const actual = Buffer.from(signature, 'hex');
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

export async function verifyAdminPassword(password: string): Promise<boolean> {
  return Boolean(ADMIN_PASSWORD && ADMIN_SESSION_SECRET && password === ADMIN_PASSWORD);
}

export async function createAdminSession(): Promise<string> {
  if (!ADMIN_PASSWORD || !ADMIN_SESSION_SECRET) {
    throw new Error('Admin authentication unavailable.');
  }
  const token = generateSessionToken();
  const cookieStore = await cookies();
  
  cookieStore.set('admin_session', `${token}.${signSessionToken(token)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60, // 7 days
  });

  return token;
}

export async function getAdminSession(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get('admin_session')?.value || null;
}

export async function destroyAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set('admin_session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const session = await getAdminSession();
  return isValidSession(session || undefined);
}
