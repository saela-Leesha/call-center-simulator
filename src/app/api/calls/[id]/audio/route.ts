import { eq } from "drizzle-orm";
import { db } from "@/db";
import { calls } from "@/db/schema";
import { getCurrentUser, jsonError } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Store the automatic voice recording captured during the call. */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sign in required.", 401);
  if (user.role !== "student") return jsonError("Students only.", 403);
  const { id } = await context.params;

  const [call] = await db.select().from(calls).where(eq(calls.id, id)).limit(1);
  if (!call) return jsonError("Call not found.", 404);
  if (call.studentId !== user.id) return jsonError("Forbidden.", 403);

  const body = (await request.json()) as {
    audioData?: string;
    audioMime?: string;
    audioDurationSeconds?: number;
    transferred?: boolean;
    transferTarget?: string;
    callState?: string;
  };

  if (!body.audioData) return jsonError("audioData is required.");
  if (body.audioData.length > 9_000_000) {
    return jsonError("Recording is too large to archive (limit ~6MB).");
  }

  await db
    .update(calls)
    .set({
      audioData: body.audioData,
      audioMime: body.audioMime || "audio/webm",
      audioDurationSeconds: Math.max(0, Math.round(body.audioDurationSeconds ?? 0)),
      transferred: body.transferred ?? call.transferred,
      transferTarget: body.transferTarget ?? call.transferTarget,
      callState: body.callState ?? call.callState,
    })
    .where(eq(calls.id, id));

  return Response.json({ ok: true, hasAudio: true });
}
