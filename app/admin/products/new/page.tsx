"use client"

import { Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { ProductEditor } from "../product-editor"

function LoadingSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-96 w-full" />
    </div>
  )
}

export default function NewProductPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <ProductEditor mode="create" />
    </Suspense>
  )
}
