export type LangCode = "en" | "fr" | "it" | "es" | "ar" | "de";

export const LANGUAGES: Record<
  LangCode,
  { name: string; native: string; flag: string; speech: string; rtl?: boolean }
> = {
  en: { name: "English", native: "English", flag: "🇬🇧", speech: "en-US" },
  fr: { name: "French", native: "Français", flag: "🇫🇷", speech: "fr-FR" },
  it: { name: "Italian", native: "Italiano", flag: "🇮🇹", speech: "it-IT" },
  es: { name: "Spanish", native: "Español", flag: "🇪🇸", speech: "es-ES" },
  ar: { name: "Arabic", native: "العربية", flag: "🇸🇦", speech: "ar-SA", rtl: true },
  de: { name: "German", native: "Deutsch", flag: "🇩🇪", speech: "de-DE" },
};

export const LEVELS = ["Beginner", "Intermediate", "Advanced"] as const;
export type Level = (typeof LEVELS)[number];

export const SCENARIOS = [
  { id: "free", label: "💬 Free conversation", prompt: "a friendly free conversation about the learner's life, hobbies and interests" },
  { id: "cafe", label: "☕ At the café", prompt: "a role-play where you are a waiter in a café and the learner orders" },
  { id: "travel", label: "✈️ Travel & directions", prompt: "a role-play where the learner is a tourist asking for directions, hotel check-in and transport" },
  { id: "shopping", label: "🛍️ Shopping", prompt: "a role-play in a clothing shop where you are the shop assistant" },
  { id: "doctor", label: "🩺 At the doctor", prompt: "a role-play where you are a doctor and the learner describes symptoms" },
  { id: "job", label: "💼 Job interview", prompt: "a role-play where you are a recruiter interviewing the learner for a job" },
] as const;
export type ScenarioId = (typeof SCENARIOS)[number]["id"];

/** Separator the tutor uses between its spoken reply and the feedback. */
export const FEEDBACK_MARK = "💡";
