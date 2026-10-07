import type {
  AiCoaching,
  AiScores,
  CallNotes,
  PaymentRecord,
  SoldProduct,
} from "@/db/schema";
import { clampScore } from "@/lib/utils";

const emptyNotes: CallNotes = {
  concern: "",
  troubleshooting: "",
  resolution: "",
  followUp: "",
  escalation: "",
};

function filled(value?: string | null) {
  return Boolean(value && value.trim().length >= 12);
}

export function evaluateCall(input: {
  authSuccess: boolean;
  authMethod: string | null;
  passwordAttempts: number;
  securityAttempts: number;
  notes?: CallNotes | null;
  products?: SoldProduct[] | null;
  payment?: PaymentRecord | null;
  termsAgreed: boolean;
  durationSeconds: number;
  categoryName: string;
  concern: string;
  voiceTurns?: number;
  recorded?: boolean;
  transferred?: boolean;
}): { scores: AiScores; coaching: AiCoaching } {
  const notes = input.notes ?? emptyNotes;
  const products = input.products ?? [];
  const sold = products.filter((p) => p.action === "sold");
  const offered = products.filter((p) => p.action === "offered");

  let authentication = 0;
  if (input.authSuccess) {
    if (input.authMethod === "password") {
      authentication =
        input.passwordAttempts <= 1 ? 100 : input.passwordAttempts === 2 ? 86 : 72;
    } else if (input.authMethod === "security") {
      authentication = input.securityAttempts <= 1 ? 78 : 64;
    } else {
      authentication = 70;
    }
  } else {
    authentication = Math.max(0, 28 - input.passwordAttempts * 6);
  }

  const noteFields = [
    notes.concern,
    notes.troubleshooting,
    notes.resolution,
    notes.followUp,
    notes.escalation,
  ];
  const filledCount = noteFields.filter((n) => filled(n)).length;
  const documentation = clampScore(
    filledCount * 18 + (notes.resolution.trim().length > 40 ? 10 : 0),
  );

  const turns = input.voiceTurns ?? 0;
  let communication = 40;
  if (turns >= 4) communication += 12;
  if (turns >= 8) communication += 8;
  if (turns >= 14) communication += 6;
  if (turns <= 2) communication -= 14;
  if (filled(notes.concern)) communication += 8;
  if (filled(notes.troubleshooting)) communication += 6;
  if (filled(notes.resolution)) communication += 10;
  if (input.durationSeconds >= 90) communication += 8;
  if (input.durationSeconds < 45) communication -= 16;
  if (input.durationSeconds > 900) communication -= 6;
  if (!input.authSuccess) communication -= 20;
  if (input.recorded === false) communication -= 10;
  if (input.transferred) communication += 4;
  communication = clampScore(communication);

  const isSales =
    /upsell|upgrade|install|product/i.test(input.categoryName) ||
    /upsell|upgrade|install/i.test(input.concern);
  const isBilling = /bill|payment/i.test(input.categoryName);

  let sales = 58;
  if (offered.length) sales += 12;
  if (sold.length) sales += 18 + Math.min(12, sold.length * 4);
  if (isSales && sold.length === 0) sales -= 22;
  if (isBilling && input.payment) sales += 10;
  if (!isSales && sold.length === 0) sales = Math.max(sales, 70);
  sales = clampScore(sales);

  let compliance = 40;
  if (input.authSuccess) compliance += 30;
  if (input.termsAgreed) compliance += 18;
  if (input.payment && input.termsAgreed) compliance += 8;
  if (input.payment && !input.termsAgreed) compliance -= 16;
  if (filled(notes.resolution)) compliance += 8;
  if (!input.authSuccess) compliance = Math.min(compliance, 42);
  compliance = clampScore(compliance);

  const overall = clampScore(
    authentication * 0.24 +
      communication * 0.22 +
      documentation * 0.2 +
      sales * 0.16 +
      compliance * 0.18,
  );

  const scores: AiScores = {
    communication,
    authentication,
    documentation,
    sales,
    compliance,
    overall,
  };

  const improvements: string[] = [];
  const recommendations: string[] = [];
  const strengths: string[] = [];
  const bestPractices = [
    "Open with a branded greeting, your name, and a permission-to-proceed statement.",
    "Complete full customer authentication before discussing account-specific details.",
    "Use a structured troubleshooting flow and recap the resolution before closing.",
    "Document concern, actions, resolution, and next steps in the CRM during the call.",
    "Offer relevant products only after the original concern is fully addressed.",
    "Read mandatory disclosures and capture Terms & Conditions agreement before billing changes.",
  ];

  if (scores.authentication >= 85) {
    strengths.push("Authentication was handled promptly using the correct verification protocol.");
  } else {
    improvements.push(
      "Reduce password retries. Confirm first name, last name, and account number before requesting the password.",
    );
    recommendations.push(
      "If the password fails twice, calmly explain the lockout policy and pivot to the security question without repeating the password prompt.",
    );
  }

  if (scores.documentation >= 80) {
    strengths.push("CRM notes cover the concern, troubleshooting path, and resolution.");
  } else {
    improvements.push(
      "Complete all five note fields. QA teams score missing follow-up and escalation notes as incomplete documentation.",
    );
    recommendations.push(
      "Write the customer concern in the customer's words, then add the diagnostic steps you performed.",
    );
  }

  if (scores.communication >= 80) {
    strengths.push("Call control and customer-care documentation indicate a complete conversation arc.");
  } else {
    improvements.push(
      "Extend active listening: probe for impact, set expectations, and close with a recap plus a courtesy check.",
    );
  }

  if (scores.sales < 75) {
    improvements.push(
      "Look for a natural value-add after resolution — mesh Wi-Fi for dropouts, a speed upgrade for buffering, or autopay for billing friction.",
    );
    recommendations.push(
      "Use a permission-based offer: “While I have you, would you like me to review a plan that could lower your monthly rate?”",
    );
  } else if (sold.length) {
    strengths.push("Relevant products were positioned and captured in the order cart.");
  }

  if (scores.compliance < 80) {
    improvements.push(
      "Always authenticate first, then capture Terms & Conditions agreement before processing any payment or plan change.",
    );
  } else {
    strengths.push("Compliance checkpoints (identity, disclosures, and agreement) were observed.");
  }

  if (!input.payment && isBilling) {
    recommendations.push(
      "For billing and collections scenarios, offer cash, online, and bank-transfer options and confirm the amount before posting payment.",
    );
  }

  if (input.durationSeconds < 60) {
    improvements.push(
      "Avoid rushing. A complete telecom contact typically includes greeting, verification, diagnosis, resolution, offer, and close.",
    );
  }

  if (!strengths.length) {
    strengths.push("You completed the simulation and created a record that can be coached against BPO standards.");
  }

  const summary = `Overall AI rating ${scores.overall}/100. Authentication ${scores.authentication}, communication ${scores.communication}, documentation ${scores.documentation}, sales ${scores.sales}, and compliance ${scores.compliance}. ${
    scores.overall >= 85
      ? "This contact meets NexusLink floor standards for an independent agent."
      : scores.overall >= 70
        ? "This contact is acceptable with targeted coaching before live-queue promotion."
        : "This contact is below floor standard and should be retrained on verification and documentation."
  }`;

  const comments = input.authSuccess
    ? `Voice contact handled with ${turns} spoken turn(s). ${input.authMethod === "password" ? "Verified using password credentials" : "Recovered access through security-question verification"} after ${input.passwordAttempts} password attempt(s). ${filled(notes.resolution) ? "Resolution was documented." : "Resolution notes were thin."} ${sold.length ? `${sold.length} product(s) were sold.` : "No products were closed."} ${input.termsAgreed ? "Disclosures were acknowledged." : "Terms and conditions were not confirmed."}`
    : "The contact did not complete customer authentication, which is a critical compliance failure in a regulated telecommunications contact center.";

  return {
    scores,
    coaching: {
      recommendations,
      improvements,
      bestPractices,
      summary,
      strengths,
      comments,
    },
  };
}

export function grantAchievements(input: {
  completedCount: number;
  scores: AiScores;
  authMethod: string | null;
  soldCount: number;
  termsAgreed: boolean;
}) {
  const earned: { code: string; title: string; description: string }[] = [];
  if (input.completedCount >= 1) {
    earned.push({
      code: "first-call",
      title: "First Contact Complete",
      description: "Successfully completed your first simulated customer call.",
    });
  }
  if (input.authMethod === "password" && input.scores.authentication >= 95) {
    earned.push({
      code: "perfect-auth",
      title: "Perfect Authentication",
      description: "Verified the customer on the first password attempt.",
    });
  }
  if (input.scores.documentation >= 90) {
    earned.push({
      code: "doc-pro",
      title: "Documentation Pro",
      description: "Captured complete CRM notes across all required fields.",
    });
  }
  if (input.soldCount > 0 && input.scores.sales >= 80) {
    earned.push({
      code: "sales-champion",
      title: "Sales Champion",
      description: "Closed a relevant product or upgrade during the contact.",
    });
  }
  if (input.termsAgreed && input.scores.compliance >= 88) {
    earned.push({
      code: "compliance-star",
      title: "Compliance Star",
      description: "Met authentication and disclosure standards on the call.",
    });
  }
  if (input.completedCount >= 5) {
    earned.push({
      code: "queue-veteran",
      title: "Queue Veteran",
      description: "Handled five or more training simulations.",
    });
  }
  if (input.scores.overall >= 90) {
    earned.push({
      code: "floor-ready",
      title: "Floor Ready",
      description: "Posted an overall AI score of 90 or higher.",
    });
  }
  return earned;
}
