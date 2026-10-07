import { eq } from "drizzle-orm";
import { db } from "@/db";
import { calls, scenarios, type TranscriptLine } from "@/db/schema";
import { getCurrentUser, jsonError } from "@/lib/auth";
import {
  emptyMemory,
  openingLine,
  respond,
  type CustomerMemory,
  type ScenarioFacts,
} from "@/lib/customer-brain";
import { formatDuration } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** Spoken turn endpoint: agent audio -> text, customer brain -> spoken reply. */
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

  const body = (await request.json()) as {
    agentText?: string;
    durationSeconds?: number;
    memory?: CustomerMemory;
  };
  const agentText = (body.agentText ?? "").trim();

  const facts: ScenarioFacts = {
    category: row.call.callType,
    firstName: row.scenario.customerFirstName,
    lastName: row.scenario.customerLastName,
    accountNumber: row.scenario.accountNumber,
    password: row.scenario.accountPassword,
    securityQuestion: row.scenario.securityQuestion,
    securityAnswer: row.scenario.securityAnswer,
    address: row.scenario.address,
    currentPlan: row.scenario.currentPlan,
    internetSpeed: row.scenario.internetSpeed,
    monthlyFee: row.scenario.monthlyFee,
    outstandingBalance: row.scenario.outstandingBalance,
    dueDate: row.scenario.dueDate,
    concern: row.scenario.concern,
    openingStatement: row.scenario.openingStatement,
  };

  const memory: CustomerMemory = body.memory ?? emptyMemory();
  const offered = (row.call.productsSold ?? []).length;

  let turn;
  if (!agentText) {
    turn = {
      text: openingLine(facts),
      emotion: "frustrated" as const,
      intent: "opening",
      stage: "discover" as const,
      disclosure: {
        firstName: row.scenario.customerFirstName,
        lastName: row.scenario.customerLastName,
      },
    };
  } else {
    turn = respond({
      facts,
      agentText,
      memory,
      passwordLocked: row.call.passwordLocked,
      authSuccess: row.call.authSuccess,
      offeredCount: offered,
    });
  }

  const stamp = formatDuration(body.durationSeconds ?? 0);
  const transcript = [...(row.call.transcript ?? [])] as TranscriptLine[];
  if (agentText) {
    transcript.push({ at: stamp, speaker: "agent", text: agentText });
  }
  transcript.push({ at: stamp, speaker: "customer", text: turn.text });

  await db.update(calls).set({ transcript }).where(eq(calls.id, id));

  return Response.json({
    turn,
    transcript,
    memoryUpdate: {
      greeted: memory.greeted || turn.intent === "greeting",
      nameGiven: memory.nameGiven || Boolean(turn.disclosure?.firstName),
      accountGiven: memory.accountGiven || Boolean(turn.disclosure?.accountNumber),
      passwordGiven: memory.passwordGiven + (turn.disclosure?.password ? 1 : 0),
      securityGiven: memory.securityGiven || Boolean(turn.disclosure?.securityAnswer),
      concernTold: memory.concernTold + (turn.intent === "opening" || turn.intent === "ask_concern" ? 1 : 0),
      repeats: agentText ? memory.repeats + 1 : memory.repeats,
      offered: memory.offered + (turn.intent === "offer" ? 1 : 0),
      paymentDone: memory.paymentDone,
      termsDone: memory.termsDone,
    },
  });
}
