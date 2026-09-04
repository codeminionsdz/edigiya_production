import { redirect } from 'next/navigation';
import { isAdminAuthenticated } from '@/lib/admin-auth';

export async function withAdminAuth<T extends (...args: any[]) => any>(
  fn: T,
  ...args: Parameters<T>
): Promise<ReturnType<T>> {
  if (!(await isAdminAuthenticated())) {
    redirect('/admin/login');
  }

  return fn(...args);
}

export async function checkAdminAuth(): Promise<boolean> {
  return isAdminAuthenticated();
}
