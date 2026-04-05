"use client"

import { Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
/* eslint-disable @next/next/no-img-element */
import { useActionState } from "react"
import { motion } from "framer-motion"
import { Mail, Lock, User, Phone, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { useLocale } from "@/lib/locale-context"
import { registerCustomer, type CustomerAuthState } from "../auth-actions"

const initialState: CustomerAuthState = {}

function RegisterForm() {
  const { t } = useLocale()
  const searchParams = useSearchParams()
  const nextPath = searchParams.get("next") || "/account"
  const [state, formAction, isPending] = useActionState(registerCustomer, initialState)

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
          <div className="mb-8 text-center">
            <Link href="/" className="mb-4 inline-flex items-center gap-2">
              <img
                src="/brand/logo.jpg"
                alt="Nutrition Store"
                width={160}
                height={50}
                className="h-10 w-auto object-contain dark:hidden"
              />
              <img
                src="/brand/logo.jpg"
                alt="Nutrition Store"
                width={160}
                height={50}
                className="hidden h-10 w-auto object-contain dark:block"
              />
            </Link>
            <h1 className="font-heading text-2xl font-bold text-foreground">{t.nav.register}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Creez votre compte Nutrition Store
            </p>
          </div>

          <form action={formAction} className="flex flex-col gap-4">
            <input type="hidden" name="next" value={nextPath} />

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="firstName">{t.checkout.firstName}</Label>
                <div className="relative mt-1.5">
                  <User className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="firstName" name="firstName" placeholder="Mohamed" className="ps-10" required />
                </div>
              </div>
              <div>
                <Label htmlFor="lastName">{t.checkout.lastName}</Label>
                <Input id="lastName" name="lastName" className="mt-1.5" placeholder="Benali" required />
              </div>
            </div>

            <div>
              <Label htmlFor="email">{t.checkout.email}</Label>
              <div className="relative mt-1.5">
                <Mail className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="email" name="email" type="email" placeholder="email@example.com" className="ps-10" required />
              </div>
            </div>

            <div>
              <Label htmlFor="phone">{t.checkout.phone}</Label>
              <div className="relative mt-1.5">
                <Phone className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="phone" name="phone" type="tel" placeholder="0550 000 000" className="ps-10" required />
              </div>
            </div>

            <div>
              <Label htmlFor="password">Mot de passe</Label>
              <div className="relative mt-1.5">
                <Lock className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="password" name="password" type="password" placeholder="********" className="ps-10" required />
              </div>
            </div>

            <div>
              <Label htmlFor="confirmPassword">Confirmer mot de passe</Label>
              <Input id="confirmPassword" name="confirmPassword" type="password" placeholder="********" className="mt-1.5" required />
            </div>

            {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

            <Button className="w-full gap-2" size="lg" type="submit" disabled={isPending}>
              {isPending ? "Creation..." : t.nav.register}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          <Separator className="my-6" />

          <p className="text-center text-sm text-muted-foreground">
            Deja un compte ?{" "}
            <Link href={`/login?next=${encodeURIComponent(nextPath)}`} className="font-medium text-primary hover:underline">
              {t.nav.login}
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}

function RegisterSkeleton() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
          <div className="mb-8 text-center">
            <Skeleton className="mx-auto h-10 w-10 rounded-md mb-4" />
            <Skeleton className="h-8 w-32 mx-auto mb-2" />
            <Skeleton className="h-4 w-48 mx-auto" />
          </div>
          <div className="flex flex-col gap-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<RegisterSkeleton />}>
      <RegisterForm />
    </Suspense>
  )
}


