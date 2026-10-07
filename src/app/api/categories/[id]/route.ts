import { eq } from "drizzle-orm";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { getCurrentUser, jsonError } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sign in required.", 401);
  if (user.role !== "teacher") return jsonError("Teachers only.", 403);
  const { id } = await context.params;

  const body = (await request.json()) as {
    name?: string;
    description?: string;
    icon?: string;
    color?: string;
    isActive?: boolean;
  };
  const name = body.name?.trim();
  const description = body.description?.trim();
  if (!name || !description) return jsonError("Name and description are required.");

  await db
    .update(categories)
    .set({
      name,
      description,
      icon: body.icon?.trim() || "phone",
      color: body.color?.trim() || "#14b8a6",
      isActive: body.isActive ?? true,
      updatedAt: new Date(),
    })
    .where(eq(categories.id, id));

  const [category] = await db.select().from(categories).where(eq(categories.id, id));
  return Response.json({ category });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sign in required.", 401);
  if (user.role !== "teacher") return jsonError("Teachers only.", 403);
  const { id } = await context.params;
  await db.delete(categories).where(eq(categories.id, id));
  return Response.json({ ok: true });
}
