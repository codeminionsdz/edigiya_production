'use server';

import { pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import * as repo from '@/lib/repositories';

const AUTH_COOKIE_NAME = 'customer_auth';
const PASSWORD_MIN_LENGTH = 6;
const HASH_ITERATIONS = 120000;
const HASH_KEY_LENGTH = 64;
const HASH_DIGEST = 'sha512';

export type CustomerAuthState = {
  error?: string;
};

function normalizeRedirectPath(value: FormDataEntryValue | null): string {
  const rawPath = typeof value === 'string' ? value.trim() : '';
  if (!rawPath || !rawPath.startsWith('/') || rawPath.startsWith('//')) {
    return '/account';
  }

  if (rawPath.startsWith('/login') || rawPath.startsWith('/register')) {
    return '/account';
  }

  return rawPath;
}

function normalizeEmail(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function hashPassword(password: string, salt?: string) {
  const safeSalt = salt ?? randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(password, safeSalt, HASH_ITERATIONS, HASH_KEY_LENGTH, HASH_DIGEST).toString('hex');
  return { hash, salt: safeSalt };
}

function verifyPassword(password: string, hash: string, salt: string): boolean {
  const expectedHash = Buffer.from(hash, 'hex');
  const computedHash = Buffer.from(hashPassword(password, salt).hash, 'hex');

  if (expectedHash.length !== computedHash.length) {
    return false;
  }

  return timingSafeEqual(expectedHash, computedHash);
}

async function setCustomerAuth(sessionId: string) {
  const cookieStore = await cookies();
  cookieStore.set('session_id', sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  cookieStore.set(AUTH_COOKIE_NAME, '1', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function loginCustomer(
  _previousState: CustomerAuthState,
  formData: FormData
): Promise<CustomerAuthState> {
  const email = normalizeEmail(formData.get('email'));
  const password = typeof formData.get('password') === 'string' ? (formData.get('password') as string) : '';
  const nextPath = normalizeRedirectPath(formData.get('next'));

  if (!isValidEmail(email)) {
    return { error: 'Email invalide' };
  }

  if (!password) {
    return { error: 'Mot de passe requis' };
  }

  const profile = await repo.getCustomerProfileByEmail(email);
  if (!profile || !profile.password_hash || !profile.password_salt) {
    return { error: 'Compte introuvable. Creez un compte d abord.' };
  }

  if (!verifyPassword(password, profile.password_hash, profile.password_salt)) {
    return { error: 'Email ou mot de passe incorrect' };
  }

  await setCustomerAuth(profile.session_id);
  redirect(nextPath);
}

export async function registerCustomer(
  _previousState: CustomerAuthState,
  formData: FormData
): Promise<CustomerAuthState> {
  const firstName = typeof formData.get('firstName') === 'string' ? (formData.get('firstName') as string).trim() : '';
  const lastName = typeof formData.get('lastName') === 'string' ? (formData.get('lastName') as string).trim() : '';
  const email = normalizeEmail(formData.get('email'));
  const phone = typeof formData.get('phone') === 'string' ? (formData.get('phone') as string).trim() : '';
  const password = typeof formData.get('password') === 'string' ? (formData.get('password') as string) : '';
  const confirmPassword =
    typeof formData.get('confirmPassword') === 'string' ? (formData.get('confirmPassword') as string) : '';
  const nextPath = normalizeRedirectPath(formData.get('next'));

  if (!firstName || !lastName) {
    return { error: 'Nom et prenom sont obligatoires' };
  }

  if (!isValidEmail(email)) {
    return { error: 'Email invalide' };
  }

  if (!phone) {
    return { error: 'Telephone obligatoire' };
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    return { error: 'Mot de passe trop court (minimum 6 caracteres)' };
  }

  if (password !== confirmPassword) {
    return { error: 'Les mots de passe ne correspondent pas' };
  }

  const cookieStore = await cookies();
  const sessionId = cookieStore.get('session_id')?.value;
  if (!sessionId) {
    return { error: 'Session invalide. Rechargez la page puis reessayez.' };
  }

  const existingProfile = await repo.getCustomerProfileByEmail(email);
  let targetSessionId = sessionId;
  if (existingProfile && existingProfile.session_id !== sessionId) {
    if (existingProfile.password_hash && existingProfile.password_salt) {
      return { error: 'Cet email est deja utilise. Connectez-vous.' };
    }
    targetSessionId = existingProfile.session_id;
  }

  const { hash, salt } = hashPassword(password);

  await repo.upsertCustomerProfile({
    session_id: targetSessionId,
    first_name: firstName,
    last_name: lastName,
    email,
    phone,
    password_hash: hash,
    password_salt: salt,
  });

  await setCustomerAuth(targetSessionId);
  redirect(nextPath);
}

export async function logoutCustomer() {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE_NAME);
  redirect('/login');
}
