import type { CallNotes, TranscriptLine } from "@/db/schema";
import type { SupervisorReport } from "@/db/schema";
import { clampScore } from "@/lib/utils";

type AgentUtterance = { at: string; text: string };

const AUTH_PROBES: { label: string; re: RegExp; advisory?: boolean }[] = [
  { label: "Ask the customer's first and last name", re: /\b(your name|first and last|may i have your name|name on the account|who am i speaking)\b/i },
  { label: "Ask for the account number", re: /\b(account (number|no)?|member id|customer number)\b/i },
  { label: "Request the account password", re: /\bpassword\b/i },
  { label: "Use the security question when the password locks", re: /\b(security question|maiden|born|first pet|mascot|grew up|sibling|favorite teacher)\b/i },
  { label: "Confirm the service address", re: /\b(address|service address)\b/i, advisory: true },
];

const DOC_REQUIREMENTS: { key: keyof CallNotes; label: string; re: RegExp }[] = [
  { key: "concern", label: "Customer concern captured in the CRM", re: /./ },
  { key: "troubleshooting", label: "Troubleshooting steps documented", re: /./ },
  { key: "resolution", label: "Resolution recorded", re: /./ },
  { key: "followUp", label: "Follow-up expectations noted", re: /./ },
  { key: "escalation", label: "Escalation disposition noted", re: /./ },
];

const COMPLIANCE_CHECKS: { label: string; re: RegExp }[] = [
  { label: "Read terms and conditions / disclosures", re: /\b(terms|conditions|disclosur|authoriz|authoris|consent|agree)\b/i },
  { label: "Offered all payment channels", re: /\b(cash|online|bank transfer|autopay)\b/i },
  { label: "Confirmed amounts before posting", re: /\b(confirm|verify the amount|does that sound|is that correct)\b/i },
  { label: "Provided a verbal recap before closing", re: /\b(to summarize|to recap|so what i'?ll do|just to confirm)\b/i },
  { label: "Closed with a courtesy check and brand thank-you", re: /\b(anything else|thank you for choosing|have a great day|thanks for calling)\b/i },
];

const PROFESSIONALISM_CHECKS: { label: string; re: RegExp }[] = [
  { label: "Branded greeting with agent name", re: /\b(thank you for calling|thank you for choosing|you'?ve reached|this is \w+)\b/i },
  { label: "Empathy or acknowledgement statement", re: /\b(sorry|apolog|understand|frustrat|inconvenien|i hear you)\b/i },
  { label: "Ownership statement", re: /\b(i (can|will|'ll) (help|take care|fix|handle)|let me (help|check|pull))\b/i },
  { label: "Permission-based hold or probe", re: /\b(may i (ask|place you on)|would you mind|do you mind if)\b/i },
];

function splitAgent(lines: TranscriptLine[] | null | undefined): AgentUtterance[] {
  return (lines ?? [])
    .filter((l) => l.speaker === "agent")
    .map((l) => ({ at: l.at, text: l.text }));
}

/**
 * AI Supervisor — automated post-call review.
 * Replays the transcript, checks the authentication path, documentation,
 * compliance language and communication quality against BPO QA standards.
 */
export function runSupervisor(input: {
  transcript: TranscriptLine[] | null;
  notes?: CallNotes | null;
  authSuccess: boolean;
  authMethod: string | null;
  passwordAttempts: number;
  securityAttempts: number;
  termsAgreed: boolean;
  paymentPosted: boolean;
  productsOffered: number;
  productsSold: number;
  durationSeconds: number;
  recorded: boolean;
  transferred: boolean;
  strictness?: "lenient" | "balanced" | "strict";
}): SupervisorReport {
  const agent = splitAgent(input.transcript);
  const spoken = agent.map((a) => a.text).join(" \n ");
  const notes = input.notes;
  const strict = input.strictness === "strict";
  const lenient = input.strictness === "lenient";

  const missedAuthSteps: string[] = [];
  const advisoryAuth: string[] = [];
  for (const probe of AUTH_PROBES) {
    const spokenOk = probe.re.test(spoken);
    // A completed CRM verification is itself evidence the identity probes happened,
    // so short transcripts are not punished for a flow the system already validated.
    const verifiedBySystem =
      input.authSuccess && /^(Ask the customer's|Ask for the account)/.test(probe.label);
    const covered =
      spokenOk ||
      verifiedBySystem ||
      (probe.label.includes("password") && input.passwordAttempts > 0) ||
      (probe.label.includes("security question") && input.securityAttempts > 0);
    if (!covered) {
      if (probe.advisory) advisoryAuth.push(probe.label);
      else missedAuthSteps.push(probe.label);
    }
  }
  if (!input.authSuccess) {
    missedAuthSteps.unshift("Account was never fully authenticated — a critical failure");
  }

  const missedDocumentation: string[] = [];
  if (notes) {
    for (const req of DOC_REQUIREMENTS) {
      const value = (notes[req.key] ?? "").trim();
      if (value.length < 12) missedDocumentation.push(req.label);
    }
  } else {
    missedDocumentation.push("No CRM notes were saved for this contact");
  }

  const complianceFindings: string[] = [];
  for (const check of COMPLIANCE_CHECKS) {
    if (!check.re.test(spoken)) complianceFindings.push(`Not detected in the call: ${check.label}`);
  }
  if (input.paymentPosted && !input.termsAgreed) {
    complianceFindings.unshift("A payment was posted without recorded terms and conditions agreement");
  }
  if (strict && input.recorded === false) {
    complianceFindings.unshift("No call recording was archived, which breaks QA retention policy");
  }

  const communicationNotes: string[] = [];
  const turns = agent.length;
  if (turns < 4) communicationNotes.push(`Only ${turns} agent turn(s) detected — talk time is below a complete voice contact.`);
  if (!PROFESSIONALISM_CHECKS[0].re.test(spoken)) communicationNotes.push("Missing a branded greeting with the agent's first name.");
  if (!PROFESSIONALISM_CHECKS[1].re.test(spoken)) communicationNotes.push("No empathy or acknowledgement statement detected.");
  if (PROFESSIONALISM_CHECKS[2].re.test(spoken)) communicationNotes.push("Good ownership language on the call.");
  if (PROFESSIONALISM_CHECKS[3].re.test(spoken)) communicationNotes.push("Used permission-based phrasing before probing or holding.");
  if (input.durationSeconds < 60) communicationNotes.push("Handle time under one minute — the flow was likely rushed.");
  if (input.durationSeconds > 900) communicationNotes.push("Handle time exceeded 15 minutes — check for avoidable loops.");
  if (input.transferred) communicationNotes.push("Contact was transferred; confirm the receiving queue had complete notes.");
  for (const a of advisoryAuth) {
    communicationNotes.push(`Advisory: ${a.toLowerCase()} to strengthen verification confidence.`);
  }

  // Score the contact 0-100.
  let score = 100;
  const authWeight = 26;
  const docWeight = 22;
  const complianceWeight = 22;
  const commWeight = 20;
  const salesWeight = 10;

  const authPenalty = Math.min(authWeight, missedAuthSteps.length * (strict ? 9 : 6) + (input.authSuccess ? 0 : authWeight * 0.7));
  const docPenalty = Math.min(docWeight, missedDocumentation.length * (strict ? 7 : 4.5));
  const compliancePenalty = Math.min(complianceWeight, complianceFindings.length * (strict ? 7 : 4.5));
  const commPenalty = Math.min(commWeight, communicationNotes.length * 3);
  const salesPenalty = input.productsOffered === 0 ? salesWeight * 0.6 : input.productsSold === 0 ? salesWeight * 0.25 : 0;

  score = clampScore(
    score - authPenalty - docPenalty - compliancePenalty - commPenalty - salesPenalty + (lenient ? 6 : 0),
  );

  const verdict =
    score >= 90
      ? "Exceeds floor standard"
      : score >= 80
        ? "Meets floor standard"
        : score >= 70
          ? "Conditional — targeted coaching required"
          : "Below standard — retrain before live queue";

  const recommendations: string[] = [];
  if (missedAuthSteps.length) {
    recommendations.push(
      `Close the authentication gap: ${missedAuthSteps.slice(0, 2).join("; ")}. Verify identity before any account detail is discussed.`,
    );
  }
  if (missedDocumentation.length) {
    recommendations.push(
      `Complete the CRM while on the call — missing: ${missedDocumentation.slice(0, 3).join(", ")}.`,
    );
  }
  if (complianceFindings.length) {
    recommendations.push(
      `Tighten compliance language: ${complianceFindings.slice(0, 2).join("; ")}.`,
    );
  }
  if (input.productsOffered === 0) {
    recommendations.push("Position at least one relevant product or add-on after the concern is resolved.");
  }
  if (!recommendations.length) {
    recommendations.push("Strong contact. Move to a Complex or Sensitive scenario to keep progressing.");
  }

  const improvementPlan: string[] = [];
  if (!input.authSuccess || missedAuthSteps.length > 2) {
    improvementPlan.push("Day 1–2: Re-run the verification module and role-play the password lockout pivot twice.");
  }
  if (missedDocumentation.length >= 2) {
    improvementPlan.push("Day 3: Documentation lab — take three live simulations and complete every CRM field before dispositioning.");
  }
  if (complianceFindings.length >= 2) {
    improvementPlan.push("Day 4: Compliance huddle — read the disclosure script verbatim and capture agreement verbally.");
  }
  if (input.productsSold === 0) {
    improvementPlan.push("Day 5: Sales coaching — practise one permission-based offer per call using the value-benefit-close frame.");
  }
  if (!improvementPlan.length) {
    improvementPlan.push("Maintain current standard and mentor a peer on the next nesting wave.");
  }

  return {
    rating: score,
    verdict,
    missedAuthSteps,
    missedDocumentation,
    complianceFindings,
    communicationNotes,
    recommendations,
    improvementPlan,
    transcriptReviewed: (input.transcript ?? []).length > 0,
  };
}
