// ─── VoxKage Web — Dynamic Greeting System ───────────────────────────────────
// Premium editorial tone. Builder energy. 40% with name / 60% without.
// Time-aware + day-of-week + VoxKage identity specials.
// ──────────────────────────────────────────────────────────────────────────────

/** Extract a display name from an email address. */
export function extractNameFromEmail(email: string): string {
  if (!email) return "there";
  const local = email.split("@")[0];
  // Strip trailing digits and capitalize
  const cleaned = local.replace(/[0-9]+$/, "");
  if (!cleaned) return "there";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

// ─── WITH NAME — 40% of pool ─────────────────────────────────────────────────

const withName: Record<string, string[]> = {
  morning: [
    "Morning, {name}. Ready to build.",
    "Good morning, {name}. Let's begin.",
    "{name}, the day is yours.",
    "Rise and build, {name}.",
    "{name}, another morning to create.",
  ],
  afternoon: [
    "Afternoon, {name}. Keep building.",
    "{name}, you're in the zone.",
    "Good afternoon, {name}. Let's focus.",
    "{name}, momentum is on your side.",
  ],
  evening: [
    "Evening, {name}. One more thing?",
    "{name}, still at it tonight?",
    "Good evening, {name}. Let's think.",
    "{name}, the quiet hours are yours.",
  ],
  night: [
    "Night owl, {name}. Let's build.",
    "{name}, late nights build great things.",
    "Still going, {name}. I respect it.",
    "{name}, the best ideas come late.",
  ],
  monday: [
    "Monday morning, {name}. Let's move.",
  ],
  friday: [
    "Friday energy, {name}. Finish strong.",
  ],
  weekend: [
    "{name}, weekend mode is on.",
  ],
  sunday: [
    "Sunday calm with you, {name}.",
  ],
  builder: [
    "What are we building today, {name}?",
    "{name}, tell me what's next.",
    "Ready for something new, {name}?",
    "{name}, your workspace is ready.",
    "What's the plan today, {name}?",
    "{name}, let's solve something interesting.",
    "Pick your direction today, {name}.",
    "{name}, let's make it count.",
    "What's the big idea, {name}?",
    "{name}, another day to create.",
  ],
  returning: [
    "Welcome back, {name}. Let's begin.",
    "Good to see you, {name}.",
    "{name}, back at it again.",
    "Hey {name}, what's on your mind?",
    "{name}, picking up where we left.",
    "So {name}, what's the direction?",
    "{name}, I'm ready when you are.",
    "Tell me what you need, {name}.",
    "Alright {name}, let's make something.",
  ],
};

// ─── WITHOUT NAME — 60% of pool ──────────────────────────────────────────────

const withoutName: Record<string, string[]> = {
  morning: [
    "Morning light. Let's make something.",
    "A new day to build.",
    "Fresh start. Let's get to it.",
    "Clear morning for clear thinking.",
  ],
  afternoon: [
    "Afternoon focus. Let's build.",
    "Deep work hours are calling.",
    "Halfway through. Keep the pace.",
    "Afternoon light. Good for thinking.",
  ],
  evening: [
    "Evening calm. Room to think.",
    "One more thing before the night.",
    "Sunset and a fresh idea.",
    "Quiet evening. Let's work.",
  ],
  night: [
    "Late hours. Best ideas surface now.",
    "The night is for building.",
    "Quiet hours. No distractions. Just work.",
    "Under the radar. Let's build.",
  ],
  monday: [
    "New week. New things to build.",
    "Monday momentum. Let's ride it.",
  ],
  friday: [
    "Friday focus. Close it strong.",
    "End the week building something.",
  ],
  weekend: [
    "Weekend mode. Your pace entirely.",
    "No schedule. Just creating.",
  ],
  builder: [
    "Let's build something worth your time.",
    "What needs to be built today?",
    "Ready to make something interesting.",
    "Your workspace. Your ideas. Let's go.",
    "Another project waiting to happen.",
    "Let's shape an idea together.",
    "Pick a direction. Let's move.",
    "Building mode is now active.",
    "Bring your ideas. I'll bring mine.",
    "Let's turn thoughts into something real.",
    "The workspace is ready for you.",
    "Start with a thought. End with something.",
  ],
  voxkage: [
    "Built for the craft of building.",
    "Tools ready. Mind sharp. Let's work.",
    "This is where things take shape.",
    "Precision and intention. Let's build.",
    "Not just answers. Built things.",
    "Craft over quantity. Let's begin.",
    "Thoughtful making starts right here.",
    "Your space for building better.",
  ],
  quiet: [
    "Take a breath. Then let's build.",
    "No rush. Good work takes time.",
    "Start wherever feels right today.",
    "Let the ideas surface naturally.",
    "Room to think. Space to build.",
    "Whenever you're ready. I'm here.",
    "Good things start with a single thought.",
    "No pressure. Just progress.",
  ],
  warm: [
    "Glad you're here. Let's make something.",
    "You bring the vision. I'll help build.",
    "Let's see what we can create.",
    "Something good is about to start.",
    "You think it. We'll build it.",
    "Together, let's build something solid.",
    "Another day. Another chance to create.",
    "Let's make this one count.",
    "Ideas welcome. Building begins now.",
    "A blank page. Let's fill it.",
  ],
};

// ─── HELPER: pick a random item from an array ────────────────────────────────

function pick(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── HELPER: determine time bucket ───────────────────────────────────────────

type TimeBucket = "morning" | "afternoon" | "evening" | "night";

function getTimeBucket(hour: number): TimeBucket {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

// ─── HELPER: determine day bucket ────────────────────────────────────────────

type DayBucket = "weekday" | "monday" | "friday" | "saturday" | "sunday" | "weekend";

function getDayBucket(day: number): DayBucket {
  if (day === 1) return "monday";
  if (day === 5) return "friday";
  if (day === 6) return "saturday";
  if (day === 0) return "sunday";
  return "weekday";
}

// ─── MAIN: pick a greeting ───────────────────────────────────────────────────

/**
 * Return a dynamic greeting string.
 *
 * @param name  – display name to inject (or empty string)
 * @param hour  – current hour (0-23)
 * @param day   – current day (0=Sun, 1=Mon … 6=Sat)
 * @param returning – whether the user is returning mid-session
 */
export function getGreeting(
  name: string,
  hour: number,
  day: number,
  returning = false,
): string {
  const timeBucket = getTimeBucket(hour);
  const dayBucket = getDayBucket(day);
  const showName = name.length > 0 && Math.random() < 0.4;
  const pool = showName ? withName : withoutName;

  let greeting: string;

  // ── Selection: time-of-day primary, day/returning as spice ──────────

  // Helper: pick from a sub-pool if it exists and passes a probability gate
  const maybe = (key: string, prob: number): string | null => {
    // Guard against day-specific keys if they don't match the current day
    if (key === "monday" && day !== 1) return null;
    if (key === "friday" && day !== 5) return null;
    if (key === "weekend" && day !== 0 && day !== 6) return null;
    if (key === "sunday" && day !== 0) return null;

    return (pool as any)[key]?.length && Math.random() < prob
      ? pick((pool as any)[key])
      : null;
  };

  if (showName) {
    // 1) Day-specific (~35% chance on matching day)
    greeting =
      maybe("monday", 0.35) ??
      maybe("friday", 0.35) ??
      maybe("weekend", 0.35) ??
      maybe("sunday", 0.35) ??
      // 2) Returning user (~30% chance)
      (returning ? maybe("returning", 0.3) : null) ??
      // 3) Time bucket (~60% chance)
      maybe(timeBucket, 0.6) ??
      // 4) Builder (always available)
      pick(pool.builder);
  } else {
    // 1) Day-specific (~35% chance on matching day)
    greeting =
      maybe("monday", 0.35) ??
      maybe("friday", 0.35) ??
      maybe("weekend", 0.35) ??
      // 2) Time bucket (~45% chance)
      maybe(timeBucket, 0.45) ??
      // 3) VoxKage identity specials (~25% chance)
      maybe("voxkage", 0.25) ??
      // 4) Quiet / invitational (~20% chance)
      maybe("quiet", 0.2) ??
      // 5) Warm / confident (~30% chance)
      maybe("warm", 0.3) ??
      // 6) Builder (always available)
      pick(pool.builder);
  }


  // Inject the name if needed
  if (showName && name) {
    greeting = greeting.replace(/\{name\}/g, name);
  }

  return greeting;
}

export function getRelativeTime(dateString: string): string {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return "Past week";
    if (diffDays < 30) return "Past month";
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  } catch (e) {
    return "";
  }
}
