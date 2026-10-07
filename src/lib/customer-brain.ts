/**
 * AI Customer Voice Engine
 *
 * Deterministic, rule-based conversational customer used for voice simulations.
 * The agent speaks (microphone -> speech-to-text); this engine interprets the
 * agent utterance and returns the customer's next spoken line, which the browser
 * then renders with text-to-speech. No chat input is used anywhere.
 */

export type CustomerEmotion = "calm" | "neutral" | "frustrated" | "angry" | "pleased";

export type VoiceStage =
  | "greeting"
  | "identity"
  | "password"
  | "security"
  | "discover"
  | "troubleshoot"
  | "resolve"
  | "offer"
  | "payment"
  | "terms"
  | "closing";

export type CustomerTurn = {
  text: string;
  emotion: CustomerEmotion;
  intent: string;
  stage: VoiceStage;
  /** Values the customer spoke out loud, used to auto-fill CRM verification fields. */
  disclosure?: {
    firstName?: string;
    lastName?: string;
    accountNumber?: string;
    password?: string;
    securityAnswer?: string;
  };
  /** Coaching hint surfaced to the trainer HUD (not a chat message). */
  hint?: string;
};

export type CustomerMemory = {
  greeted: boolean;
  nameGiven: boolean;
  accountGiven: boolean;
  passwordGiven: number;
  securityGiven: boolean;
  concernTold: number;
  repeats: number;
  offered: number;
  paymentDone: boolean;
  termsDone: boolean;
};

export function emptyMemory(): CustomerMemory {
  return {
    greeted: false,
    nameGiven: false,
    accountGiven: false,
    passwordGiven: 0,
    securityGiven: false,
    concernTold: 0,
    repeats: 0,
    offered: 0,
    paymentDone: false,
    termsDone: false,
  };
}

export type ScenarioFacts = {
  category: string;
  firstName: string;
  lastName: string;
  accountNumber: string;
  password: string;
  securityQuestion: string;
  securityAnswer: string;
  address: string;
  currentPlan: string;
  internetSpeed: string;
  monthlyFee: number;
  outstandingBalance: number;
  dueDate: string;
  concern: string;
  openingStatement: string;
};

type Intent =
  | "greeting"
  | "ask_name"
  | "ask_account"
  | "ask_password"
  | "ask_security"
  | "ask_address"
  | "ask_concern"
  | "troubleshoot"
  | "empathy"
  | "offer"
  | "price"
  | "payment"
  | "terms"
  | "recap"
  | "escalate"
  | "hold"
  | "transfer"
  | "silence"
  | "other";

function has(text: string, re: RegExp) {
  return re.test(text);
}

export function detectIntent(raw: string): Intent {
  const t = raw.toLowerCase();
  if (!t.trim()) return "silence";
  if (has(t, /\b(transfer|route (me|this)|send (me|this) to)\b/)) return "transfer";
  if (has(t, /\b(supervisor|manager|escalat|tier ?2|team lead)\b/)) return "escalate";
  if (has(t, /\b(hold|one moment|bear with|please wait|stay on the line)\b/)) return "hold";
  if (has(t, /\b(thank you for calling|good (morning|afternoon|evening)|this is \w+ (from|with)|how may i (help|assist)|how can i (help|assist)|you'?ve reached)\b/))
    return "greeting";
  if (has(t, /\b(your (first and last )?name|may i ask who|who am i speaking|name on the account|name please|your name)\b/))
    return "ask_name";
  if (has(t, /\b(password|passcode|pin|secret code)\b/)) return "ask_password";
  if (
    has(t, /\b(security question|mother'?s maiden|maiden name|born|birth|first pet|mascot|grew up|sibling|father'?s first|favorite teacher)\b/)
  )
    return "ask_security";
  if (has(t, /\b(account (number|id)|account please|your account|member id|customer number)\b/))
    return "ask_account";
  if (has(t, /\b(address|service address|installation address)\b/)) return "ask_address";
  if (has(t, /\b(terms|conditions|consent|authorize|authorise|agreement|do you agree|confirm that)\b/))
    return "terms";
  if (has(t, /\b(payment|pay (now|today|this)|cash|online payment|bank transfer|card|arrangement|autopay|installment)\b/))
    return "payment";
  if (has(t, /\b(how much|price|pricing|cost|monthly fee|per month|rate|discount|promo)\b/)) return "price";
  if (has(t, /\b(upgrade|mesh|bundle|landline|premium|fiber plus|fiber basic|add-?on|recommend|offer you|better plan)\b/))
    return "offer";
  if (has(t, /\b(reboot|restart|power cycle|unplug|modem|router|lights?|speed test|ethernet|try (that|this)|check(ing)? the)\b/))
    return "troubleshoot";
  if (has(t, /\b(sorry|apologize|apologise|i understand|frustrat|inconvenien|thank you for your patience)\b/))
    return "empathy";
  if (has(t, /\b(to summarize|to recap|anything else|anything i can help|before i let you go|have a great day|thank you for choosing)\b/))
    return "recap";
  if (has(t, /\b(what (can|seems to be)|tell me (more|what)|describe|walk me through|how can i help you with|what happened|what'?s going on|explain)\b/))
    return "ask_concern";
  return "other";
}

function cat(f: ScenarioFacts) {
  const c = f.category.toLowerCase();
  if (c.includes("billing")) return "billing" as const;
  if (c.includes("connect")) return "internet" as const;
  if (c.includes("upgrade")) return "upgrade" as const;
  if (c.includes("payment")) return "payment" as const;
  if (c.includes("authentication")) return "auth" as const;
  if (c.includes("installation")) return "install" as const;
  return "upsell" as const;
}

const money = (cents: number) =>
  `$${(cents / 100).toFixed(2)}`;

const DISCOVER: Record<string, (f: ScenarioFacts) => string[]> = {
  billing: (f) => [
    `Right. I pay ${money(f.monthlyFee)} a month and this bill came out to ${money(f.monthlyFee + 2948)}. Nothing on the bill explains it.`,
    `It's the ${f.currentPlan}. I have been on it for over a year and I have never seen a jump like this.`,
    `What I want is simple — explain the charge, and if it is a mistake, take it off.`,
  ],
  internet: (f) => [
    `It is the whole house. Video calls freeze, and the ${f.internetSpeed} plan should not be doing that.`,
    `Every evening from about six to nine. During the day it is fine.`,
    `I already rebooted it once. The lights are solid, not red. That is why this is so annoying.`,
  ],
  upgrade: (f) => [
    `I work from home now and my upload is terrible on the ${f.currentPlan}.`,
    `I need something faster, but I do not want to sign a long contract without knowing the real price.`,
    `What would you recommend for a two-person household that streams and takes calls all day?`,
  ],
  payment: (f) => [
    `My balance is ${money(f.outstandingBalance)} and it is due ${f.dueDate}. I can pay part of it today.`,
    `I do not want a late fee or a suspension notice. That is what scares me.`,
    `If I pay part now, can you hold the rest until Friday?`,
  ],
  auth: (f) => [
    `Your app locked me out after three tries, and I never changed anything.`,
    `I am worried someone tried to get into my account. That is why I called.`,
    `I need the portal back so I can see my bill.`,
  ],
  install: (f) => [
    `I move in Thursday morning and I need internet the same day if possible.`,
    `It is a second-floor condo. There is already a coax plate in the living room.`,
    `What do I need to prepare, and how long does the technician usually take?`,
  ],
  upsell: (f) => [
    `The back bedroom is basically a dead zone. Guests complain about it.`,
    `My partner wants live sports without stacking four streaming apps.`,
    `Tell me what you can add and what it costs.`,
  ],
};

const TROUBLE: Record<string, (f: ScenarioFacts) => string[]> = {
  billing: () => [
    `I have the email in front of me. Line item says promotional discount expired.`,
    `Nobody emailed me that the promo was ending. That is the part that bothers me.`,
    `Fine. If you can credit it, I will stay.`,
  ],
  internet: () => [
    `I did a speed test, I got forty down when I pay for more.`,
    `The gateway is in the hallway. The router is about six years old, came with the install.`,
    `Okay, I will power cycle it now. Give me a minute.`,
  ],
  upgrade: () => [
    `The router is in the office. Wi-Fi dies past the kitchen.`,
    `I can do a technician visit next week if needed.`,
    `So what is the total monthly if I switch?`,
  ],
  payment: () => [
    `Yes, I understand the account is past due. I am not avoiding it.`,
    `I can do forty dollars today from my checking account.`,
    `Please note the account so nobody cuts my service.`,
  ],
  auth: () => [
    `I tried the password twice on the app and then it locked.`,
    `I have my bill here with the account number if you need it.`,
    `Please secure the account and unlock the portal.`,
  ],
  install: () => [
    `Thursday after 2 p.m. works best for me.`,
    `The building manager said no exterior drilling without notice.`,
    `Okay, so I will get an email with the window.`,
  ],
  upsell: () => [
    `The gateway sits downstairs near the TV.`,
    `I would rather buy the mesh than run cables everywhere.`,
    `What about the TV option? Is it a contract?`,
  ],
};

const OFFER_OBJECTION: Record<string, (f: ScenarioFacts) => string[]> = {
  billing: (f) => [
    `I am not paying more after a billing error, but if you can credit it I will listen.`,
    `How much is the mesh on top of my ${money(f.monthlyFee)}?`,
  ],
  internet: (f) => [
    `If it actually fixes the evenings, I would consider it. I am on ${f.currentPlan} now.`,
    `What is the difference in price per month?`,
  ],
  upgrade: () => [
    `That sounds close to what I need. Does the price change after a year?`,
    `Okay, let us do it, but confirm the rate in writing.`,
  ],
  payment: () => [
    `I cannot add anything today. I need to clear the past-due amount first.`,
    `Maybe next month. Let us fix the balance first.`,
  ],
  auth: () => [
    `Let us secure the account first. I am not adding services while there is a security concern.`,
    `If the account is safe, then we can talk.`,
  ],
  install: () => [
    `Add it to the install, but tell me the total before the technician arrives.`,
    `Yes, if it is on the same visit I will take it.`,
  ],
  upsell: () => [
    `That is more than I wanted to spend, but the sports bundle is interesting.`,
    `Go ahead with the mesh. Skip the landline.`,
  ],
};

function pick<T>(list: T[], seed: number) {
  return list[Math.abs(seed) % list.length];
}

export function respond(input: {
  facts: ScenarioFacts;
  agentText: string;
  memory: CustomerMemory;
  passwordLocked: boolean;
  authSuccess: boolean;
  offeredCount: number;
}): CustomerTurn {
  const { facts: f, memory: m } = input;
  const intent = detectIntent(input.agentText);
  const seed = input.agentText.length + m.repeats + m.concernTold;
  const flavor = cat(f);
  const turn: CustomerTurn = { text: "", emotion: "neutral", intent, stage: "greeting" };

  // The customer always insists on verification before account details.
  if (!m.greeted && intent !== "greeting" && intent !== "hold") {
    return {
      text: "Hello? Hello, can you hear me? Who is this?",
      emotion: "neutral",
      intent: "verify_first",
      stage: "greeting",
      hint: "Open with the branded greeting and your name before asking for anything.",
    };
  }

  switch (intent) {
    case "greeting": {
      turn.stage = "greeting";
      turn.emotion = "neutral";
      turn.text = `Hi, yes — this is ${f.firstName} ${f.lastName}. ${f.openingStatement}`;
      turn.disclosure = { firstName: f.firstName, lastName: f.lastName };
      turn.hint = "Capture the name, then ask for the account number.";
      break;
    }
    case "ask_name": {
      turn.stage = "identity";
      turn.emotion = m.nameGiven ? "frustrated" : "neutral";
      turn.text = m.nameGiven
        ? `I already told you — ${f.firstName} ${f.lastName}.`
        : `${f.firstName} ${f.lastName}.`;
      if (!m.nameGiven) {
        turn.disclosure = { firstName: f.firstName, lastName: f.lastName };
      }
      break;
    }
    case "ask_account": {
      turn.stage = "identity";
      turn.text = `It is ${f.accountNumber}.`;
      turn.disclosure = { accountNumber: f.accountNumber };
      turn.emotion = "calm";
      break;
    }
    case "ask_password": {
      turn.stage = "password";
      if (input.passwordLocked || m.passwordGiven >= 1) {
        turn.emotion = "angry";
        turn.text =
          "I am not repeating my password again. You said it is locked — just verify me another way.";
        turn.hint = "Password repetition is prohibited. Move to the security question.";
      } else {
        turn.emotion = "calm";
        turn.text = `Sure, the password is ${f.password}.`;
        turn.disclosure = { password: f.password };
      }
      break;
    }
    case "ask_security": {
      turn.stage = "security";
      turn.emotion = "calm";
      turn.text = `Let me think... that would be ${f.securityAnswer}.`;
      turn.disclosure = { securityAnswer: f.securityAnswer };
      break;
    }
    case "ask_address": {
      turn.stage = "identity";
      turn.text = `We are at ${f.address}.`;
      turn.emotion = "calm";
      break;
    }
    case "ask_concern": {
      turn.stage = "discover";
      turn.emotion = m.concernTold > 0 ? "frustrated" : "neutral";
      turn.text = m.concernTold
        ? pick(DISCOVER[flavor](f), seed + 1)
        : `${f.concern} ${pick(DISCOVER[flavor](f), seed)}`;
      break;
    }
    case "troubleshoot": {
      turn.stage = "troubleshoot";
      turn.emotion = "neutral";
      turn.text = pick(TROUBLE[flavor](f), seed);
      break;
    }
    case "empathy": {
      turn.stage = m.concernTold ? "troubleshoot" : "discover";
      turn.emotion = "calm";
      turn.text = pick(
        [
          "Thank you, I appreciate you saying that.",
          "Okay. That helps. Thank you for listening.",
          "I just want this handled properly, that is all.",
        ],
        seed,
      );
      break;
    }
    case "price": {
      turn.stage = "offer";
      turn.emotion = "neutral";
      turn.text = `So break it down for me — what is the total per month, and does it lock in?`;
      break;
    }
    case "offer": {
      turn.stage = "offer";
      turn.emotion = m.offered > 1 ? "frustrated" : "neutral";
      turn.text = pick(OFFER_OBJECTION[flavor](f), seed + m.offered);
      break;
    }
    case "payment": {
      turn.stage = "payment";
      turn.emotion = "neutral";
      turn.text = m.paymentDone
        ? "Yes, I already confirmed the payment. Did it go through?"
        : flavor === "payment"
          ? `Let us do an online payment for ${money(Math.round(f.outstandingBalance / 2))} today and the rest on Friday.`
          : `Go ahead and post it. I will use online payment for the amount you mentioned.`;
      break;
    }
    case "terms": {
      turn.stage = "terms";
      turn.emotion = "neutral";
      turn.text = m.termsDone
        ? "Yes, I already agreed to that."
        : "Yes, I heard the disclosures. I agree to the terms and conditions, go ahead.";
      break;
    }
    case "escalate": {
      turn.stage = "resolve";
      turn.emotion = "frustrated";
      turn.text = pick(
        [
          "I would rather you just fix it than pass me around, but if you must, go ahead.",
          "Honestly? If a supervisor is what it takes, transfer me.",
        ],
        seed,
      );
      break;
    }
    case "transfer": {
      turn.stage = "resolve";
      turn.emotion = "neutral";
      turn.text = "Okay, transfer me. Please give them the notes so I do not repeat everything.";
      break;
    }
    case "hold": {
      turn.stage = "troubleshoot";
      turn.emotion = "calm";
      turn.text = "Sure, I will hold. How long will this take?";
      break;
    }
    case "recap": {
      turn.stage = "closing";
      turn.emotion = "pleased";
      turn.text = pick(
        [
          "No, that is everything. You were helpful, thank you.",
          "That is all. Thanks for sorting it out today.",
          "Nothing else. Have a good one.",
        ],
        seed,
      );
      break;
    }
    default: {
      turn.stage = "discover";
      turn.emotion = "neutral";
      turn.text = m.concernTold
        ? pick(
            [
              "Sorry, I did not catch that. Can you say it another way?",
              `Are you asking about the ${f.currentPlan}?`,
              "I am not sure I follow. What do you need from me?",
            ],
            seed,
          )
        : f.concern;
    }
  }

  if (m.repeats >= 3 && turn.emotion === "neutral") {
    turn.emotion = "frustrated";
  }

  return turn;
}

export function openingLine(f: ScenarioFacts) {
  return f.openingStatement;
}

export function emotionVoice(emotion: CustomerEmotion) {
  switch (emotion) {
    case "angry":
      return { rate: 1.12, pitch: 1.05 };
    case "frustrated":
      return { rate: 1.05, pitch: 1.0 };
    case "pleased":
      return { rate: 1.0, pitch: 1.12 };
    case "calm":
      return { rate: 0.95, pitch: 1.02 };
    default:
      return { rate: 1.0, pitch: 1.05 };
  }
}
