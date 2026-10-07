import { eq } from "drizzle-orm";
import { db } from "@/db";
import { calls } from "@/db/schema";
import { getCurrentUser, jsonError } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Serve the archived voice recording for playback in call history / review. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sign in required.", 401);
  const { id } = await context.params;

  const [call] = await db
    .select({ audioData: calls.audioData, audioMime: calls.audioMime, studentId: calls.studentId })
    .from(calls)
    .where(eq(calls.id, id))
    .limit(1);
  if (!call || !call.audioData) return jsonError("Recording not available.", 404);
  if (user.role === "student" && call.studentId !== user.id) {
    return jsonError("Forbidden.", 403);
  }

  const base64 = call.audioData.includes(",") ? call.audioData.split(",")[1] : call.audioData;
  const buffer = Buffer.from(base64, "base64");
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": call.audioMime || "audio/webm",
      "Content-Length": String(buffer.length),
      "Cache-Control": "private, max-age=3600",
    },
  });
}
