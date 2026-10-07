import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getCurrentUser, hashPassword, jsonError } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sign in required.", 401);

  const body = (await request.json()) as {
    firstName?: string;
    lastName?: string;
    phone?: string;
    bio?: string;
    department?: string;
    password?: string;
  };

  const firstName = body.firstName?.trim();
  const lastName = body.lastName?.trim();
  if (!firstName || !lastName) {
    return jsonError("First and last name are required.");
  }

  const patch: Partial<typeof users.$inferInsert> = {
    firstName,
    lastName,
    phone: body.phone?.trim() || null,
    bio: body.bio?.trim() || null,
    department: body.department?.trim() || user.department,
  };
  if (body.password && body.password.length >= 6) {
    patch.passwordHash = await hashPassword(body.password);
  }

  await db.update(users).set(patch).where(eq(users.id, user.id));
  return Response.json({ ok: true });
}
