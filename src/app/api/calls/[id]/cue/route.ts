import { eq } from "drizzle-orm";
import { db } from "@/db";
import { calls, scenarios, type TranscriptLine } from "@/db/schema";
import { getCurrentUser, jsonError } from "@/lib/auth";
import { formatDuration } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sign in required.", 401);
  const { id } = await context.params;
  const [row] = await db
    .select({ call: calls, scenario: scenarios })
    .from(calls)
    .innerJoin(scenarios, eq(calls.scenarioId, scenarios.id))
    .where(eq(calls.id, id))
    .limit(1);
  if (!row) return jsonError("Call not found.", 404);
  if (user.role === "student" && row.call.studentId !== user.id) {
    return jsonError("Forbidden.", 403);
  }

  const body = (await request.json()) as { cue?: string; durationSeconds?: number };
  const s = row.scenario;
  const map: Record<string, { agent: string; customer: string }> = {
    name: {
      agent: "May I have your first and last name as it appears on the account?",
      customer: `Yes — ${s.customerFirstName} ${s.customerLastName}.`,
    },
    account: {
      agent: "Thank you. May I have the account number on your bill or gateway?",
      customer: `It's ${s.accountNumber}.`,
    },
    password: {
      agent: "For security, may I have the account password?",
      customer: `The password should be ${s.accountPassword}.`,
    },
    security: {
      agent: `I need to ask your security question: ${s.securityQuestion}`,
      customer: `That's ${s.securityAnswer}.`,
    },
    address: {
      agent: "Can you confirm the service address on the account?",
      customer: `We are at ${s.address}.`,
    },
    concern: {
      agent: "I have the account pulled up. Please tell me what happened, in your own words.",
      customer: s.openingStatement,
    },
  };

  const pair = map[body.cue || ""];
  if (!pair) return jsonError("Unknown cue.");

  const stamp = formatDuration(body.durationSeconds || 0);
  const transcript = [...(row.call.transcript ?? [])] as TranscriptLine[];
  transcript.push({ at: stamp, speaker: "agent", text: pair.agent });
  transcript.push({ at: stamp, speaker: "customer", text: pair.customer });
  await db.update(calls).set({ transcript }).where(eq(calls.id, id));

  return Response.json({ agent: pair.agent, customer: pair.customer, transcript });
}
