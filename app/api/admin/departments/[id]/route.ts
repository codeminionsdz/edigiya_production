import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/admin-auth"
import * as repo from "@/lib/repositories"

function slugify(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await context.params
  const departmentId = String(id || "").trim()
  if (!departmentId) {
    return NextResponse.json({ error: "Missing department id" }, { status: 400 })
  }

  try {
    const body = await request.json()

    const name_fr = String(body?.name_fr ?? "").trim()
    const name_ar = String(body?.name_ar ?? "").trim()
    const slug = slugify(String(body?.slug ?? ""))

    if (!name_fr || !name_ar || !slug) {
      return NextResponse.json(
        { error: "name_fr, name_ar and slug are required" },
        { status: 400 }
      )
    }

    const image_url_raw = body?.image_url
    const image_url =
      image_url_raw === null
        ? null
        : String(image_url_raw ?? "").trim() || null

    const is_active = Boolean(body?.is_active)

    const updated = await repo.updateDepartment(departmentId, {
      name_fr,
      name_ar,
      slug,
      image_url,
      is_active,
    })

    return NextResponse.json(updated)
  } catch (error: any) {
    const message = String(error?.message || "Unable to update department")
    const code = String(error?.code || "")
    // Postgres unique violation on slug, etc.
    const status = code === "23505" ? 409 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await context.params
  const departmentId = String(id || "").trim()
  if (!departmentId) {
    return NextResponse.json({ error: "Missing department id" }, { status: 400 })
  }

  try {
    await repo.deleteDepartment(departmentId)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    const message = String(error?.message || "Unable to delete department")
    const code = String(error?.code || "")
    // 23503 foreign_key_violation (e.g. products referenced by order_items)
    const status = code === "23503" ? 409 : 500
    return NextResponse.json(
      {
        error:
          code === "23503"
            ? "Impossible de supprimer ce departement car des produits sont lies a des commandes. Desactivez-le plutot."
            : message,
      },
      { status }
    )
  }
}
