import { eq } from "drizzle-orm";
import { db } from "@/db";
import { calls, categories, scenarios, type TranscriptLine } from "@/db/schema";
import { getCurrentUser, jsonError } from "@/lib/auth";
import { formatDuration } from "@/lib/utils";

export const dynamic = "force-dynamic";

function norm(value: string) {
  return value.trim().toLowerCase();
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sign in required.", 401);
  if (user.role !== "student") return jsonError("Students only.", 403);

  const { id } = await context.params;
  const [row] = await db
    .select({ call: calls, scenario: scenarios, category: categories })
    .from(calls)
    .innerJoin(scenarios, eq(calls.scenarioId, scenarios.id))
    .innerJoin(categories, eq(scenarios.categoryId, categories.id))
    .where(eq(calls.id, id))
    .limit(1);
  if (!row) return jsonError("Call not found.", 404);
  if (row.call.studentId !== user.id) return jsonError("Forbidden.", 403);
  if (row.call.authSuccess) {
    return Response.json({
      success: true,
      already: true,
      passwordLocked: row.call.passwordLocked,
      call: row.call,
    });
  }

  const body = (await request.json()) as {
    firstName?: string;
    lastName?: string;
    accountNumber?: string;
    password?: string;
    securityAnswer?: string;
    method?: "password" | "security";
    durationSeconds?: number;
  };

  const identityOk =
    norm(body.firstName || "") === norm(row.scenario.customerFirstName) &&
    norm(body.lastName || "") === norm(row.scenario.customerLastName) &&
    norm(body.accountNumber || "") === norm(row.scenario.accountNumber);

  const transcript = [...(row.call.transcript ?? [])] as TranscriptLine[];
  const stamp = formatDuration(body.durationSeconds || 0);

  if (!identityOk) {
    transcript.push({
      at: stamp,
      speaker: "system",
      text: "Verification failed — name or account number does not match the account on file.",
    });
    await db.update(calls).set({ transcript }).where(eq(calls.id, id));
    return Response.json({
      success: false,
      error: "Name or account number does not match. Re-confirm the details with the customer.",
      passwordLocked: row.call.passwordLocked,
      passwordAttempts: row.call.passwordAttempts,
      securityAttempts: row.call.securityAttempts,
    });
  }

  const method = body.method || "password";

  if (method === "password") {
    if (row.call.passwordLocked) {
      return Response.json({
        success: false,
        error: "Password field is locked after 3 failed attempts. Use the security question.",
        passwordLocked: true,
        passwordAttempts: row.call.passwordAttempts,
        securityAttempts: row.call.securityAttempts,
      });
    }

    const ok = (body.password || "") === row.scenario.accountPassword;
    if (ok) {
      transcript.push({
        at: stamp,
        speaker: "system",
        text: "Customer authenticated via password.",
      });
      await db
        .update(calls)
        .set({
          authSuccess: true,
          authMethod: "password",
          passwordAttempts: row.call.passwordAttempts + 1,
          transcript,
        })
        .where(eq(calls.id, id));
      const [call] = await db.select().from(calls).where(eq(calls.id, id));
      return Response.json({ success: true, passwordLocked: false, call });
    }

    const attempts = row.call.passwordAttempts + 1;
    const locked = attempts >= 3;
    transcript.push({
      at: stamp,
      speaker: "system",
      text: locked
        ? "Password locked after 3 failed attempts. Switch to security question verification."
        : `Password failed · attempt ${attempts} of 3`,
    });
    await db
      .update(calls)
      .set({
        passwordAttempts: attempts,
        passwordLocked: locked,
        transcript,
      })
      .where(eq(calls.id, id));
    return Response.json({
      success: false,
      error: locked
        ? "Password locked after 3 failed attempts. Ask the security question."
        : `Incorrect password. ${3 - attempts} attempt(s) remaining.`,
      passwordLocked: locked,
      passwordAttempts: attempts,
      securityAttempts: row.call.securityAttempts,
    });
  }

  const answerOk = norm(body.securityAnswer || "") === norm(row.scenario.securityAnswer);
  if (answerOk) {
    transcript.push({
      at: stamp,
      speaker: "system",
      text: "Customer authenticated via security question.",
    });
    await db
      .update(calls)
      .set({
        authSuccess: true,
        authMethod: "security",
        securityAttempts: row.call.securityAttempts + 1,
        transcript,
      })
      .where(eq(calls.id, id));
    const [call] = await db.select().from(calls).where(eq(calls.id, id));
    return Response.json({ success: true, passwordLocked: true, call });
  }

  const securityAttempts = row.call.securityAttempts + 1;
  transcript.push({
    at: stamp,
    speaker: "system",
    text: `Security answer failed · attempt ${securityAttempts} of 3`,
  });
  await db
    .update(calls)
    .set({ securityAttempts, transcript })
    .where(eq(calls.id, id));
  return Response.json({
    success: false,
    error:
      securityAttempts >= 3
        ? "Security verification failed. End the call and escalate to the fraud desk."
        : `Incorrect security answer. ${3 - securityAttempts} attempt(s) remaining.`,
    passwordLocked: true,
    passwordAttempts: row.call.passwordAttempts,
    securityAttempts,
    lockedOut: securityAttempts >= 3,
  });
}
