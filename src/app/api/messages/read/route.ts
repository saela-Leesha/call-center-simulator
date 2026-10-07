import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { messages } from "@/db/schema";
import { getCurrentUser, jsonError } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sign in required.", 401);
  const body = (await request.json()) as { fromUserId?: string };
  if (!body.fromUserId) return jsonError("fromUserId is required.");

  await db
    .update(messages)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(messages.toUserId, user.id),
        eq(messages.fromUserId, body.fromUserId),
        isNull(messages.readAt),
      ),
    );
  return Response.json({ ok: true });
}
