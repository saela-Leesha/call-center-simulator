import { desc } from "drizzle-orm";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { getCurrentUser, jsonError } from "@/lib/auth";
import { newId } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sign in required.", 401);
  const rows = await db.select().from(categories).orderBy(desc(categories.createdAt));
  return Response.json({ categories: rows });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sign in required.", 401);
  if (user.role !== "teacher") return jsonError("Teachers only.", 403);

  const body = (await request.json()) as {
    name?: string;
    description?: string;
    icon?: string;
    color?: string;
  };
  const name = body.name?.trim();
  const description = body.description?.trim();
  if (!name || !description) return jsonError("Name and description are required.");

  const row = {
    id: newId(),
    name,
    description,
    icon: body.icon?.trim() || "phone",
    color: body.color?.trim() || "#14b8a6",
    isActive: true,
    createdBy: user.id,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  await db.insert(categories).values(row);
  return Response.json({ category: row });
}
