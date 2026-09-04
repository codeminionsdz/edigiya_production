"use client"

import { Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
/* eslint-disable @next/next/no-img-element */
import { useActionState } from "react"
import { motion } from "framer-motion"
import { Mail, Lock, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { useLocale } from "@/lib/locale-context"
import { loginCustomer, type CustomerAuthState } from "../auth-actions"

const initialState: CustomerAuthState = {}

function LoginForm() {
  const { t } = useLocale()
  const searchParams = useSearchParams()
  const nextPath = searchParams.get("next") || "/account"
  const [state, formAction, isPending] = useActionState(loginCustomer, initialState)

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
                src="/brand/edigiya-logo-light.svg"
                alt="Edigiya Store DZ"
                width={160}
                height={50}
                className="h-10 w-auto object-contain dark:hidden"
              />
              <img
                src="/brand/edigiya-logo-light.svg"
                alt="Edigiya Store DZ"
                width={160}
                height={50}
                className="hidden h-10 w-auto object-contain dark:block"
              />
            </Link>
            <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">Bienvenue chez Edigiya.</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Retrouvez vos commandes et vos informations.
            </p>
          </div>

          <form action={formAction} className="flex flex-col gap-4">
            <input type="hidden" name="next" value={nextPath} />

            <div>
              <Label htmlFor="email">{t.checkout.email}</Label>
              <div className="relative mt-1.5">
                <Mail className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="email" name="email" type="email" placeholder="email@example.com" className="ps-10" required />
              </div>
            </div>

            <div>
              <Label htmlFor="password">Mot de passe</Label>
              <div className="relative mt-1.5">
                <Lock className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="password" name="password" type="password" placeholder="********" className="ps-10" required />
              </div>
            </div>

            {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

            <Button className="w-full gap-2" size="lg" type="submit" disabled={isPending}>
              {isPending ? "Connexion..." : t.nav.login}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          <Separator className="my-6" />

          <p className="text-center text-sm text-muted-foreground">
            Pas encore de compte ?{" "}
            <Link href={`/register?next=${encodeURIComponent(nextPath)}`} className="font-medium text-primary hover:underline">
              {t.nav.register}
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}

function LoginSkeleton() {
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
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginSkeleton />}>
      <LoginForm />
    </Suspense>
  )
}

