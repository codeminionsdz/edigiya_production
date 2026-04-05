"use client"

import { Suspense, useMemo } from "react"
import { useParams } from "next/navigation"
import { Skeleton } from "@/components/ui/skeleton"
import { ProductEditor } from "../../product-editor"

function LoadingSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-96 w-full" />
    </div>
  )
}

export default function EditProductPage() {
  const params = useParams<{ id: string }>()
  const productId = useMemo(() => String(params?.id || ""), [params])

  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <ProductEditor mode="edit" productId={productId} />
    </Suspense>
  )
}
