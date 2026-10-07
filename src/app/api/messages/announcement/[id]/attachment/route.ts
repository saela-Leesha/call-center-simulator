import { eq } from "drizzle-orm";
import { db } from "@/db";
import { announcements } from "@/db/schema";
import { getCurrentUser, jsonError } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sign in required.", 401);
  const { id } = await context.params;
  const [row] = await db.select().from(announcements).where(eq(announcements.id, id)).limit(1);
  if (!row || !row.attachmentData) return jsonError("Attachment not found.", 404);
  return Response.json({
    name: row.attachmentName,
    mime: row.attachmentMime,
    data: row.attachmentData,
  });
}
