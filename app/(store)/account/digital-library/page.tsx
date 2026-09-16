'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { DigitalLibrary } from '@/components/store/digital-library';
import { useLocale } from '@/lib/locale-context';

export default function AccountDigitalLibraryPage() {
  const { locale } = useLocale();
  return <main dir={locale === 'ar' ? 'rtl' : 'ltr'} className="mx-auto max-w-[900px] px-5 py-10 sm:px-8 sm:py-14"><Link href="/account" className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" />{locale === 'ar' ? 'العودة إلى الحساب' : 'Retour au compte'}</Link><div className="mt-8"><DigitalLibrary /></div></main>;
}
