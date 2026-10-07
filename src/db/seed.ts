import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  achievements,
  announcements as announcementsTable,
  calls,
  categories,
  certificates,
  evaluations as evaluationsTable,
  messages,
  notifications,
  products,
  scenarios,
  settings as settingsTable,
  users,
  type CallNotes,
  type TranscriptLine,
} from "@/db/schema";
import { evaluateCall } from "@/lib/ai-coach";
import { runSupervisor } from "@/lib/ai-supervisor";
import { hashPassword } from "@/lib/password";

let seedPromise: Promise<void> | null = null;
let demoAudioCache: string | null = null;

/** Archive a sample voice recording so demo call history is playable out of the box. */
async function demoRecording() {
  if (demoAudioCache !== null) return demoAudioCache;
  try {
    const { readFile } = await import("node:fs/promises");
    const path = await import("node:path");
    const file = await readFile(path.join(process.cwd(), "public", "audio", "call-recording.wav"));
    demoAudioCache = `data:audio/wav;base64,${file.toString("base64")}`;
  } catch {
    demoAudioCache = "";
  }
  return demoAudioCache;
}

export function ensureSeeded() {
  if (!seedPromise) {
    seedPromise = seedInternal().catch((error) => {
      seedPromise = null;
      throw error;
    });
  }
  return seedPromise;
}

async function seedInternal() {
  const existing = await db.select({ id: users.id }).from(users).limit(1);
  if (existing.length > 0) return;

  const teacherHash = await hashPassword("Teacher123!");
  const studentHash = await hashPassword("Student123!");

  const teacherId = "teacher-maya";
  const studentId = "student-jordan";
  const student2Id = "student-aisha";

  await db.insert(users).values([
    {
      id: teacherId,
      email: "teacher@aetherlink.com",
      passwordHash: teacherHash,
      firstName: "Maya",
      lastName: "Reyes",
      role: "teacher",
      agentStatus: "available",
      phone: "+1-415-555-0142",
      bio: "Workforce coach for AetherLink Fiber. 11 years in telecom BPO quality and nesting.",
      agentId: "TL-204",
      department: "Quality & Training",
    },
    {
      id: studentId,
      email: "student@aetherlink.com",
      passwordHash: studentHash,
      firstName: "Jordan",
      lastName: "Ellis",
      role: "student",
      agentStatus: "available",
      phone: "+1-628-555-0190",
      bio: "New-hire agent in Nesting Wave 14. Targeting independent queue in week 4.",
      agentId: "AG-1187",
      department: "Residential Care",
    },
    {
      id: student2Id,
      email: "aisha@aetherlink.com",
      passwordHash: studentHash,
      firstName: "Aisha",
      lastName: "Rahman",
      role: "student",
      agentStatus: "offline",
      phone: "+1-510-555-0177",
      bio: "Cross-skilled agent covering billing and tech support queues.",
      agentId: "AG-1204",
      department: "Residential Care",
    },
  ]);

  await db.insert(categories).values([
    {
      id: "cat-billing",
      name: "Billing Concern",
      description: "Invoice disputes, proration, promotional rates, and unexplained charges.",
      icon: "receipt",
      color: "#0ea5e9",
      createdBy: teacherId,
    },
    {
      id: "cat-internet",
      name: "Internet Connectivity Issue",
      description: "Slow speed, intermittent drops, modem lights, and outage handling.",
      icon: "wifi",
      color: "#14b8a6",
      createdBy: teacherId,
    },
    {
      id: "cat-upgrade",
      name: "Upgrade Request",
      description: "Plan changes, speed upgrades, and contract refresh conversations.",
      icon: "trending",
      color: "#8b5cf6",
      createdBy: teacherId,
    },
    {
      id: "cat-payment",
      name: "Payment Assistance",
      description: "Collections, payment arrangements, and method updates.",
      icon: "card",
      color: "#f59e0b",
      createdBy: teacherId,
    },
    {
      id: "cat-auth",
      name: "Account Authentication Concern",
      description: "Locked accounts, forgotten credentials, and high-risk verification.",
      icon: "shield",
      color: "#ef4444",
      createdBy: teacherId,
    },
    {
      id: "cat-install",
      name: "New Installation Inquiry",
      description: "Serviceability, install windows, and first-bill expectations.",
      icon: "home",
      color: "#22c55e",
      createdBy: teacherId,
    },
    {
      id: "cat-upsell",
      name: "Product Upselling Opportunity",
      description: "Mesh Wi-Fi, bundles, landline, and premium fiber offers.",
      icon: "spark",
      color: "#e11d48",
      createdBy: teacherId,
    },
    {
      id: "cat-product",
      name: "Product Inquiry",
      description: "Plan features, add-on pricing, and compatibility questions.",
      icon: "package",
      color: "#0ea5a5",
      createdBy: teacherId,
    },
    {
      id: "cat-cancellation",
      name: "Cancellation Request",
      description: "Retention conversation, contract exit costs, and win-back offers.",
      icon: "logOut",
      color: "#7c3aed",
      createdBy: teacherId,
    },
    {
      id: "cat-escalation",
      name: "Escalation Scenario",
      description: "Repeat contact requiring supervisor judgment and warm transfer.",
      icon: "alert",
      color: "#b91c1c",
      createdBy: teacherId,
    },
  ]);

  await db.insert(products).values([
    {
      id: "prod-basic",
      name: "Fiber Basic Plan",
      description: "Essential fiber for browsing, homework, and HD streaming on 1–2 devices.",
      monthlyFee: 3999,
      speed: "100 Mbps",
      kind: "plan",
    },
    {
      id: "prod-plus",
      name: "Fiber Plus Plan",
      description: "Work-from-home ready with 300 Mbps and priority care hours.",
      monthlyFee: 5999,
      speed: "300 Mbps",
      kind: "plan",
    },
    {
      id: "prod-premium",
      name: "Fiber Premium Plan",
      description: "Gigabit fiber with a 24-month rate lock and advanced Wi-Fi 6 gateway.",
      monthlyFee: 8999,
      speed: "1 Gbps",
      kind: "plan",
    },
    {
      id: "prod-mesh",
      name: "Wi-Fi Mesh",
      description: "Whole-home mesh nodes that eliminate dead zones on all floors.",
      monthlyFee: 1299,
      speed: null,
      kind: "addon",
    },
    {
      id: "prod-cable",
      name: "Cable Bundle",
      description: "Live TV bundle with local channels and on-demand entertainment.",
      monthlyFee: 2499,
      speed: null,
      kind: "addon",
    },
    {
      id: "prod-landline",
      name: "Landline Add-on",
      description: "Unlimited North America calling with voicemail-to-email.",
      monthlyFee: 999,
      speed: null,
      kind: "addon",
    },
  ]);

  const scenarioRows: (typeof scenarios.$inferInsert)[] = [
    {
      id: "scn-elena",
      categoryId: "cat-billing",
      title: "Promotional rate expired unexpectedly",
      difficulty: "Standard",
      customerFirstName: "Elena",
      customerLastName: "Vasquez",
      accountNumber: "AL-88291044",
      accountPassword: "Sunrise#19",
      securityQuestion: "What is your mother's maiden name?",
      securityAnswer: "Delgado",
      address: "1847 Valencia Street, San Francisco, CA 94110",
      email: "elena.vasquez@gmail.com",
      mobile: "+1-415-555-0133",
      currentPlan: "Fiber Plus Plan",
      monthlyFee: 5999,
      internetSpeed: "300 Mbps",
      contractDuration: "12 months remaining",
      serviceStatus: "Active",
      currentBalance: 8947,
      billingStatus: "Past due",
      outstandingBalance: 2948,
      dueDate: "2026-04-18",
      previousPayment: 5999,
      concern:
        "Customer was billed $89.47 after a $39 promotional credit dropped without notice.",
      openingStatement:
        "Hi, I opened my bill this morning and you charged me almost ninety dollars. Nobody told me the promo ended.",
      assignedStudentId: studentId,
      createdBy: teacherId,
    },
    {
      id: "scn-marcus",
      categoryId: "cat-internet",
      title: "Evening speed drops and buffering",
      difficulty: "Complex",
      customerFirstName: "Marcus",
      customerLastName: "Nguyen",
      accountNumber: "AL-44120817",
      accountPassword: "Harbor!22",
      securityQuestion: "What city were you born in?",
      securityAnswer: "Da Nang",
      address: "902 Oak Park Blvd, Sacramento, CA 95815",
      email: "marcus.nguyen@gmail.com",
      mobile: "+1-916-555-0108",
      currentPlan: "Fiber Basic Plan",
      monthlyFee: 3999,
      internetSpeed: "100 Mbps",
      contractDuration: "4 months remaining",
      serviceStatus: "Active — degraded",
      currentBalance: 3999,
      billingStatus: "Current",
      outstandingBalance: 0,
      dueDate: "2026-04-22",
      previousPayment: 3999,
      concern: "Video calls freeze every evening between 6 and 9 p.m. Modem lights stay online.",
      openingStatement:
        "My internet is basically unusable after work. Zoom freezes and the kids cannot stream anything.",
      assignedStudentId: null,
      createdBy: teacherId,
    },
    {
      id: "scn-priya",
      categoryId: "cat-upgrade",
      title: "Request to move from Basic to Plus",
      difficulty: "Standard",
      customerFirstName: "Priya",
      customerLastName: "Raman",
      accountNumber: "AL-77361002",
      accountPassword: "Lotus$07",
      securityQuestion: "What was the name of your first pet?",
      securityAnswer: "Mango",
      address: "55 Clement Street Apt 4B, San Francisco, CA 94118",
      email: "priya.raman@gmail.com",
      mobile: "+1-415-555-0194",
      currentPlan: "Fiber Basic Plan",
      monthlyFee: 3999,
      internetSpeed: "100 Mbps",
      contractDuration: "Month-to-month",
      serviceStatus: "Active",
      currentBalance: 3999,
      outstandingBalance: 0,
      dueDate: "2026-04-09",
      previousPayment: 3999,
      concern: "Working from home and wants a faster plan without extending the contract blindly.",
      openingStatement:
        "I need something faster for video calls. Can you tell me what I would pay if I upgrade today?",
      assignedStudentId: studentId,
      createdBy: teacherId,
    },
    {
      id: "scn-david",
      categoryId: "cat-payment",
      title: "Needs a payment arrangement this week",
      difficulty: "Sensitive",
      customerFirstName: "David",
      customerLastName: "Okonkwo",
      accountNumber: "AL-19004428",
      accountPassword: "Cedar&31",
      securityQuestion: "What is your oldest sibling's middle name?",
      securityAnswer: "Chinedu",
      address: "4100 Telegraph Avenue, Oakland, CA 94609",
      email: "david.okonkwo@gmail.com",
      mobile: "+1-510-555-0166",
      currentPlan: "Fiber Plus Plan",
      monthlyFee: 5999,
      internetSpeed: "300 Mbps",
      contractDuration: "8 months remaining",
      serviceStatus: "Active — past due",
      currentBalance: 11998,
      billingStatus: "In collections",
      outstandingBalance: 5999,
      dueDate: "2026-03-29",
      previousPayment: 3000,
      concern: "Customer can pay $40 today and the remainder on payday Friday.",
      openingStatement:
        "I do not want to lose service. I can pay part today if you can hold the rest until Friday.",
      assignedStudentId: studentId,
      createdBy: teacherId,
    },
    {
      id: "scn-hannah",
      categoryId: "cat-auth",
      title: "Account locked after failed app logins",
      difficulty: "Complex",
      customerFirstName: "Hannah",
      customerLastName: "Brooks",
      accountNumber: "AL-55019863",
      accountPassword: "Pinecone!4",
      securityQuestion: "What is the name of the street you grew up on?",
      securityAnswer: "Maplewood",
      address: "77 Marina Boulevard, San Rafael, CA 94901",
      email: "hannah.brooks@gmail.com",
      mobile: "+1-415-555-0188",
      currentPlan: "Fiber Premium Plan",
      monthlyFee: 8999,
      internetSpeed: "1 Gbps",
      contractDuration: "18 months remaining",
      serviceStatus: "Active — portal locked",
      currentBalance: 8999,
      outstandingBalance: 0,
      dueDate: "2026-04-12",
      previousPayment: 8999,
      concern: "Cannot access the billing portal after three failed password attempts on the app.",
      openingStatement:
        "Your app locked me out and now I cannot even see my bill. I think someone tried to log in.",
      assignedStudentId: null,
      createdBy: teacherId,
    },
    {
      id: "scn-luis",
      categoryId: "cat-install",
      title: "New fiber install for a condo",
      difficulty: "Standard",
      customerFirstName: "Luis",
      customerLastName: "Ferreira",
      accountNumber: "AL-33087165",
      accountPassword: "Bayside#8",
      securityQuestion: "What was your high school mascot?",
      securityAnswer: "Falcons",
      address: "2100 Folsom Street Unit 12, San Francisco, CA 94110",
      email: "luis.ferreira@gmail.com",
      mobile: "+1-628-555-0121",
      currentPlan: "None — pending install",
      monthlyFee: 0,
      internetSpeed: "Not provisioned",
      contractDuration: "Not started",
      serviceStatus: "Lead — serviceable",
      currentBalance: 0,
      outstandingBalance: 0,
      dueDate: "N/A",
      previousPayment: 0,
      concern: "Moving in next Thursday and wants the earliest indoor install window.",
      openingStatement:
        "I just got the keys to my condo. How soon can a technician come, and what do I need to prep?",
      assignedStudentId: student2Id,
      createdBy: teacherId,
    },
    {
      id: "scn-sofia",
      categoryId: "cat-upsell",
      title: "Whole-home coverage and TV bundle",
      difficulty: "Standard",
      customerFirstName: "Sofia",
      customerLastName: "Bergstrom",
      accountNumber: "AL-66420915",
      accountPassword: "Fjord%12",
      securityQuestion: "What is your favorite teacher's last name?",
      securityAnswer: "Lindqvist",
      address: "18 Sea Cliff Avenue, San Francisco, CA 94121",
      email: "sofia.bergstrom@gmail.com",
      mobile: "+1-415-555-0117",
      currentPlan: "Fiber Plus Plan",
      monthlyFee: 5999,
      internetSpeed: "300 Mbps",
      contractDuration: "6 months remaining",
      serviceStatus: "Active",
      currentBalance: 5999,
      outstandingBalance: 0,
      dueDate: "2026-04-05",
      previousPayment: 5999,
      concern: "Guest room has no Wi-Fi and family wants live sports without a separate streaming stack.",
      openingStatement:
        "The back bedroom is a dead zone and my partner wants live sports. What can you add on?",
      assignedStudentId: studentId,
      createdBy: teacherId,
    },
    {
      id: "scn-kenji",
      categoryId: "cat-billing",
      title: "Equipment rental billed after return",
      difficulty: "Complex",
      customerFirstName: "Kenji",
      customerLastName: "Tanaka",
      accountNumber: "AL-21880043",
      accountPassword: "Sakura^5",
      securityQuestion: "What is your father's first name?",
      securityAnswer: "Hiroshi",
      address: "3900 Geary Boulevard, San Francisco, CA 94118",
      email: "kenji.tanaka@gmail.com",
      mobile: "+1-415-555-0129",
      currentPlan: "Fiber Basic Plan",
      monthlyFee: 3999,
      internetSpeed: "100 Mbps",
      contractDuration: "2 months remaining",
      serviceStatus: "Active",
      currentBalance: 5298,
      billingStatus: "Partial payment",
      outstandingBalance: 1299,
      dueDate: "2026-04-02",
      previousPayment: 3999,
      concern: "Mesh rental still billing after customer returned the node at a retail store.",
      openingStatement:
        "I dropped the mesh node at your store last month and you are still charging me thirteen dollars.",
      assignedStudentId: null,
      createdBy: teacherId,
    },
  ];

  await db.insert(scenarios).values(scenarioRows);

  const billingNotes: CallNotes = {
    concern:
      "Customer disputed an $89.47 bill after a promotional credit expired without outbound notice.",
    troubleshooting:
      "Pulled 6-month bill history, confirmed promo AL-PROMO-39 ended on 2026-03-01, verified no courtesy credit in the last 12 months.",
    resolution:
      "Issued a one-time $29.48 goodwill credit, explained the current Fiber Plus rate, and enrolled the account in bill-ready email alerts.",
    followUp:
      "Credit posts in 1–2 billing cycles. Customer will review next e-bill. No dispatch required.",
    escalation: "None. Retained on Fiber Plus without supervisor.",
  };

  const internetNotes: CallNotes = {
    concern:
      "Evening congestion on Fiber Basic; Zoom freezes between 6–9 p.m. despite online modem lights.",
    troubleshooting:
      "Ran line quality, confirmed SNR within spec, reviewed neighborhood utilization, and compared plan speed to household device count.",
    resolution:
      "Rebooted gateway remotely, scheduled a Wi-Fi mesh add-on, and offered Fiber Plus for after-hours bandwidth.",
    followUp: "Mesh shipment 2-day. Speed-test callback in 72 hours if evening drops continue.",
    escalation: "Tier-2 ticket NET-44120 opened for evening utilization watch.",
  };

  const elenaEval = evaluateCall({
    authSuccess: true,
    authMethod: "password",
    passwordAttempts: 1,
    securityAttempts: 0,
    notes: billingNotes,
    products: [],
    payment: {
      method: "online",
      amount: 5999,
      reference: "PAY-204881",
      processedAt: new Date("2026-03-21T16:42:00Z").toISOString(),
    },
    termsAgreed: true,
    durationSeconds: 412,
    categoryName: "Billing Concern",
    concern: "Promotional rate expired",
  });

  const marcusEval = evaluateCall({
    authSuccess: true,
    authMethod: "security",
    passwordAttempts: 3,
    securityAttempts: 1,
    notes: internetNotes,
    products: [
      {
        id: "prod-mesh",
        name: "Wi-Fi Mesh",
        monthlyFee: 1299,
        action: "sold",
      },
      {
        id: "prod-plus",
        name: "Fiber Plus Plan",
        monthlyFee: 5999,
        action: "offered",
      },
    ],
    payment: {
      method: "bank",
      amount: 1299,
      reference: "ACH-998210",
      processedAt: new Date("2026-03-18T22:10:00Z").toISOString(),
    },
    termsAgreed: true,
    durationSeconds: 538,
    categoryName: "Internet Connectivity Issue",
    concern: "Evening speed drops",
  });

  const elenaTranscript: TranscriptLine[] = [
    {
      at: "00:00",
      speaker: "system",
      text: "Inbound call connected · Queue: Billing · Skill: Residential Care",
    },
    {
      at: "00:04",
      speaker: "agent",
      text: "Thank you for calling AetherLink Fiber, this is Jordan. May I have your name please?",
    },
    {
      at: "00:11",
      speaker: "customer",
      text: "Elena Vasquez. You charged me almost ninety dollars and nobody warned me.",
    },
    {
      at: "00:18",
      speaker: "agent",
      text: "I am sorry about the surprise on the bill, Elena. For your protection I need to verify the account. May I have your account number and password?",
    },
    {
      at: "00:27",
      speaker: "customer",
      text: "Account AL-88291044. Password is Sunrise#19.",
    },
    {
      at: "00:36",
      speaker: "system",
      text: "Customer authenticated via password on attempt 1.",
    },
    {
      at: "01:02",
      speaker: "agent",
      text: "I see the $39 promotional credit ended on March 1, which moved the bill to the standard Fiber Plus rate plus tax.",
    },
    {
      at: "01:14",
      speaker: "customer",
      text: "That still feels unfair. I would have called if I knew.",
    },
    {
      at: "01:22",
      speaker: "agent",
      text: "I can apply a one-time courtesy credit of $29.48 and turn on bill-ready alerts so this does not happen again. Would you like me to do that?",
    },
    {
      at: "01:33",
      speaker: "customer",
      text: "Yes, please. And I will pay the rest online now.",
    },
    {
      at: "05:40",
      speaker: "agent",
      text: "Credit is posted, payment PAY-204881 is confirmed, and alerts are on. Is there anything else I can help with today?",
    },
    {
      at: "05:48",
      speaker: "customer",
      text: "That is all. Thanks for fixing it.",
    },
    { at: "05:52", speaker: "system", text: "Call ended · Disposition: Resolved with courtesy credit" },
  ];

  const marcusTranscript: TranscriptLine[] = [
    {
      at: "00:00",
      speaker: "system",
      text: "Inbound call connected · Queue: Tech Support · Skill: Connectivity",
    },
    {
      at: "00:05",
      speaker: "agent",
      text: "AetherLink Fiber, Jordan speaking. I can help with the connection issue. May I verify the account?",
    },
    {
      at: "00:14",
      speaker: "customer",
      text: "Marcus Nguyen, account AL-44120817.",
    },
    {
      at: "00:22",
      speaker: "system",
      text: "Password failed · attempt 1 of 3",
    },
    {
      at: "00:40",
      speaker: "system",
      text: "Password locked after 3 failed attempts. Security question verification required.",
    },
    {
      at: "00:48",
      speaker: "agent",
      text: "For security I need your birth city to continue.",
    },
    { at: "00:54", speaker: "customer", text: "Da Nang." },
    {
      at: "00:58",
      speaker: "system",
      text: "Customer authenticated via security question.",
    },
    {
      at: "02:10",
      speaker: "agent",
      text: "Your modem is online but evening utilization on Fiber Basic is high for a household with video calls.",
    },
    {
      at: "06:20",
      speaker: "agent",
      text: "I added Wi-Fi Mesh and offered Fiber Plus. Mesh will ship in two days.",
    },
    { at: "08:50", speaker: "system", text: "Call ended · Disposition: Mesh sold · Tier-2 watch" },
  ];

  const elenaSupervisor = runSupervisor({
    transcript: elenaTranscript,
    notes: billingNotes,
    authSuccess: true,
    authMethod: "password",
    passwordAttempts: 1,
    securityAttempts: 0,
    termsAgreed: true,
    paymentPosted: true,
    productsOffered: 0,
    productsSold: 0,
    durationSeconds: 412,
    recorded: true,
    transferred: false,
    strictness: "balanced",
  });

  const marcusSupervisor = runSupervisor({
    transcript: marcusTranscript,
    notes: internetNotes,
    authSuccess: true,
    authMethod: "security",
    passwordAttempts: 3,
    securityAttempts: 1,
    termsAgreed: true,
    paymentPosted: true,
    productsOffered: 2,
    productsSold: 1,
    durationSeconds: 538,
    recorded: true,
    transferred: true,
    strictness: "balanced",
  });

  const elenaOverall = Math.round(elenaEval.scores.overall * 0.45 + 92 * 0.55);
  const marcusOverall = Math.round(marcusEval.scores.overall * 0.45 + 80 * 0.55);

  await db.insert(calls).values([
    {
      id: "call-elena",
      studentId,
      scenarioId: "scn-elena",
      status: "completed",
      startedAt: new Date("2026-03-21T16:35:00Z"),
      endedAt: new Date("2026-03-21T16:41:52Z"),
      durationSeconds: 412,
      callType: "Billing Concern",
      passwordAttempts: 1,
      securityAttempts: 0,
      authMethod: "password",
      authSuccess: true,
      passwordLocked: false,
      notes: billingNotes,
      productsSold: [],
      payment: {
        method: "online",
        amount: 5999,
        reference: "PAY-204881",
        processedAt: new Date("2026-03-21T16:42:00Z").toISOString(),
      },
      termsAgreed: true,
      transcript: elenaTranscript,
      aiScores: elenaEval.scores,
      aiCoaching: elenaEval.coaching,
      supervisor: elenaSupervisor,
      audioMime: "audio/wav",
      audioData: await demoRecording(),
      audioDurationSeconds: 412,
      callState: "ended",
      teacherRating: 92,
      teacherComments:
        "Excellent empathy and a clean courtesy-credit close. Next time preview the next bill amount before taking payment.",
      overallRating: elenaOverall,
    },
    {
      id: "call-marcus",
      studentId,
      scenarioId: "scn-marcus",
      status: "completed",
      startedAt: new Date("2026-03-18T22:01:00Z"),
      endedAt: new Date("2026-03-18T22:09:58Z"),
      durationSeconds: 538,
      callType: "Internet Connectivity Issue",
      passwordAttempts: 3,
      securityAttempts: 1,
      authMethod: "security",
      authSuccess: true,
      passwordLocked: true,
      notes: internetNotes,
      productsSold: [
        { id: "prod-mesh", name: "Wi-Fi Mesh", monthlyFee: 1299, action: "sold" },
        { id: "prod-plus", name: "Fiber Plus Plan", monthlyFee: 5999, action: "offered" },
      ],
      payment: {
        method: "bank",
        amount: 1299,
        reference: "ACH-998210",
        processedAt: new Date("2026-03-18T22:10:00Z").toISOString(),
      },
      termsAgreed: true,
      transcript: marcusTranscript,
      aiScores: marcusEval.scores,
      aiCoaching: marcusEval.coaching,
      supervisor: marcusSupervisor,
      audioMime: "audio/wav",
      audioData: await demoRecording(),
      audioDurationSeconds: 538,
      callState: "transferred",
      transferred: true,
      transferTarget: "Tier 2 · Fiber Support",
      teacherRating: 80,
      teacherComments:
        "Good diagnosis and a relevant mesh offer. Password lockout was avoidable — slow down on verification and confirm caps-lock with the customer.",
      overallRating: marcusOverall,
    },
  ]);

  await db.insert(calls).values({
    id: "call-hannah-missed",
    studentId: studentId,
    scenarioId: "scn-hannah",
    status: "missed",
    callState: "missed",
    startedAt: new Date("2026-03-25T09:12:00Z"),
    endedAt: new Date("2026-03-25T09:12:30Z"),
    durationSeconds: 30,
    callType: "Account Authentication Concern",
    passwordAttempts: 0,
    securityAttempts: 0,
    authMethod: null,
    authSuccess: false,
    passwordLocked: false,
    notes: {
      concern: "Customer called about a locked portal; the agent never answered the ring.",
      troubleshooting: "",
      resolution: "",
      followUp: "Customer asked for a callback once the account was reviewed.",
      escalation: "Missed-call callback ticket MC-3381 created.",
    },
    productsSold: [],
    payment: null,
    termsAgreed: false,
    transcript: [
      {
        at: "00:00",
        speaker: "system",
        text: "Inbound call presented to the agent queue · Account Authentication Concern",
      },
      {
        at: "00:30",
        speaker: "system",
        text: "Ring timeout after 30s — customer abandoned the queue. Logged as a missed call.",
      },
    ],
    aiScores: null,
    aiCoaching: null,
    audioMime: null,
    audioData: null,
    audioDurationSeconds: 0,
    transferred: false,
    transferTarget: null,
    teacherRating: null,
    teacherComments: null,
    overallRating: null,
    createdAt: new Date("2026-03-25T09:12:00Z"),
  });

  await db.insert(achievements).values([
    {
      id: "ach-1",
      studentId,
      code: "first-call",
      title: "First Contact Complete",
      description: "Successfully completed your first simulated customer call.",
      earnedAt: new Date("2026-03-18T22:10:00Z"),
    },
    {
      id: "ach-2",
      studentId,
      code: "sales-champion",
      title: "Sales Champion",
      description: "Closed a relevant product or upgrade during the contact.",
      earnedAt: new Date("2026-03-18T22:10:00Z"),
    },
    {
      id: "ach-3",
      studentId,
      code: "compliance-star",
      title: "Compliance Star",
      description: "Met authentication and disclosure standards on the call.",
      earnedAt: new Date("2026-03-21T16:42:00Z"),
    },
  ]);

  await db.insert(certificates).values([
    {
      id: "cert-nesting",
      studentId,
      issuedBy: teacherId,
      title: "Nesting Week 2 — Voice Foundations",
      type: "training",
      description:
        "Completed AetherLink authentication, empathy, and CRM documentation modules with a passing floor score.",
      issuedAt: new Date("2026-03-14T17:00:00Z"),
    },
    {
      id: "cert-billing",
      studentId,
      issuedBy: teacherId,
      title: "Billing Queue Readiness",
      type: "completion",
      description:
        "Demonstrated bill explanation, courtesy credit policy, and compliant payment capture on graded simulations.",
      issuedAt: new Date("2026-03-22T18:30:00Z"),
    },
    {
      id: "cert-star",
      studentId,
      issuedBy: teacherId,
      title: "Quality Spotlight — Empathy",
      type: "achievement",
      description:
        "Recognized for a 92 teacher score on a sensitive billing contact with full disclosure compliance.",
      issuedAt: new Date("2026-03-22T18:32:00Z"),
    },
  ]);

  await db.insert(messages).values([
    {
      id: "msg-1",
      fromUserId: teacherId,
      toUserId: studentId,
      body: "Jordan — please complete the Hannah Brooks authentication scenario before Friday’s nesting calibration. Focus on slow verification and lockout language.",
      createdAt: new Date("2026-03-24T15:10:00Z"),
    },
    {
      id: "msg-2",
      fromUserId: studentId,
      toUserId: teacherId,
      body: "Noted, Coach Reyes. I reviewed the lockout policy. Can we huddle 10 minutes tomorrow on how to phrase the security-question pivot?",
      createdAt: new Date("2026-03-24T15:26:00Z"),
      readAt: new Date("2026-03-24T15:40:00Z"),
    },
    {
      id: "msg-3",
      fromUserId: teacherId,
      toUserId: studentId,
      body: "Yes. Bring the Marcus Nguyen recording. We will rewrite the password retry statements together. Also, great job on Elena’s courtesy credit close.",
      createdAt: new Date("2026-03-24T15:44:00Z"),
    },
    {
      id: "msg-4",
      fromUserId: teacherId,
      toUserId: student2Id,
      body: "Aisha, your install scenario is in the queue. Remember to set first-bill expectations and confirm building access for the technician.",
      createdAt: new Date("2026-03-23T19:02:00Z"),
    },
  ]);

  await db.insert(notifications).values([
    {
      id: "ntf-1",
      userId: studentId,
      title: "Coaching reminder",
      body: "Complete the Hannah Brooks authentication scenario before Friday calibration.",
      type: "message",
      link: "/student/messages",
      read: false,
      createdAt: new Date("2026-03-24T15:10:00Z"),
    },
    {
      id: "ntf-2",
      userId: studentId,
      title: "Certificate issued",
      body: "Billing Queue Readiness has been added to your transcript.",
      type: "certificate",
      link: "/student/certificates",
      read: false,
      createdAt: new Date("2026-03-22T18:30:00Z"),
    },
    {
      id: "ntf-3",
      userId: teacherId,
      title: "Student reply",
      body: "Jordan Ellis asked to huddle on the security-question pivot.",
      type: "message",
      link: "/teacher/messages",
      read: true,
      createdAt: new Date("2026-03-24T15:26:00Z"),
    },
  ]);
}

export async function getTeacherId() {
  await ensureSeeded();
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "teacher"))
    .limit(1);
  return row?.id ?? null;
}

/** Appends teacher-management demo data: settings, evaluations, announcements. */
export async function ensureTeacherSeed() {
  await ensureSeeded();
  const existingCfg = await db.select().from(settingsTable).limit(1);
  if (existingCfg.length === 0) {
    await db.insert(settingsTable).values({
      id: "global",
      ownerRole: "teacher",
      cohortName: "Nesting Wave 14",
      passingScore: 75,
      floorTarget: 85,
      maxPasswordAttempts: 3,
      allowTransfer: true,
      autoReleaseCertificates: false,
      aiStrictness: "balanced",
      requireRecording: true,
      ringTimeoutSeconds: 30,
      queueAutoDispatch: true,
      updatedAt: new Date(),
    });
  }

  const existingEval = await db.select().from(evaluationsTable).limit(1);
  if (existingEval.length === 0) {
    await db.insert(evaluationsTable).values([
      {
        id: "eval-elena",
        callId: "call-elena",
        studentId: "student-jordan",
        teacherId: "teacher-maya",
        scores: {
          authentication: 5,
          communication: 5,
          resolution: 5,
          documentation: 4,
          professionalism: 5,
          productKnowledge: 4,
          compliance: 5,
        },
        overall: 94,
        feedback:
          "Excellent courtesy-credit close and a clean disclosure read. The customer left satisfied.",
        coachingNotes:
          "Preview the next bill amount verbally before taking payment so the customer is never surprised again.",
        improvementPlan:
          "• Run the promotional-rate module twice this week\n• Practise quoting post-promo pricing with tax",
        recognition:
          "Nominated for the weekly quality spotlight on empathy and ownership.",
        released: true,
        createdAt: new Date("2026-03-22T18:00:00Z"),
        updatedAt: new Date("2026-03-22T18:00:00Z"),
      },
      {
        id: "eval-marcus",
        callId: "call-marcus",
        studentId: "student-jordan",
        teacherId: "teacher-maya",
        scores: {
          authentication: 3,
          communication: 4,
          resolution: 4,
          documentation: 5,
          professionalism: 4,
          productKnowledge: 5,
          compliance: 4,
        },
        overall: 83,
        feedback:
          "Good diagnosis and a genuinely relevant mesh offer. The password lockout was avoidable.",
        coachingNotes:
          "Slow down on verification. Confirm caps-lock with the customer before the second attempt.",
        improvementPlan:
          "• Re-run the verification module\n• Role-play the security-question pivot with a coach",
        recognition: "",
        released: true,
        createdAt: new Date("2026-03-19T20:00:00Z"),
        updatedAt: new Date("2026-03-19T20:00:00Z"),
      },
    ]);
  }

  const existingAnn = await db.select().from(announcementsTable).limit(1);
  if (existingAnn.length === 0) {
    await db.insert(announcementsTable).values([
      {
        id: "ann-calibration",
        authorId: "teacher-maya",
        title: "Nesting calibration — Friday 10:00",
        body:
          "Bring one recorded contact you are proud of and one you want coaching on. We will calibrate the seven QA categories together so scoring is consistent across the floor.\n\nDial in with a headset. This is a voice session.",
        kind: "reminder",
        pinned: true,
        createdAt: new Date("2026-03-25T14:00:00Z"),
      },
      {
        id: "ann-auth",
        authorId: "teacher-maya",
        title: "Coaching focus: the password pivot",
        body:
          "When a password fails three times, do not ask for it a fourth time. Acknowledge the lock, explain the policy in one sentence, then move straight to the security question. Repeating the request costs compliance points and frustrates the customer.",
        kind: "coaching",
        pinned: false,
        createdAt: new Date("2026-03-24T16:30:00Z"),
      },
    ]);
  }
}
