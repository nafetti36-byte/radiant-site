import Anthropic from "@anthropic-ai/sdk";
import { FEEDBACK_MARK, LANGUAGES, LEVELS, SCENARIOS, type LangCode, type Level, type ScenarioId } from "@/lib/languages";

export const runtime = "nodejs";
export const maxDuration = 60;

const client = new Anthropic();

type ChatTurn = { role: "user" | "assistant"; content: string };

function systemPrompt(target: LangCode, native: LangCode, level: Level, scenario: ScenarioId) {
  const t = LANGUAGES[target].name;
  const n = LANGUAGES[native].name;
  const sc = SCENARIOS.find((s) => s.id === scenario) ?? SCENARIOS[0];
  return `You are "Lingua", a warm, patient speaking-practice partner helping a learner practise ${t}. The learner's own language is ${n}. Their level is ${level}.

Practice setting: ${sc.prompt}. Stay in this setting and keep the conversation moving.

How to answer every turn:
1. First, reply ONLY in ${t}, as a natural spoken conversation partner. Keep it short (1-3 sentences; for Beginner use very simple words and short sentences) and usually end with a question so the learner keeps speaking. This part is read aloud, so no lists, markdown or emojis in it.
2. Then a new line starting with "${FEEDBACK_MARK}" followed by brief feedback written in ${n}:
   - If the learner's last message had mistakes, show the corrected sentence in ${t} and explain the main fix in a few words.
   - If it was correct, say so briefly and suggest one more natural way to say it.
   - Add a short translation of your ${t} reply into ${n}${level === "Advanced" ? " only if it contains difficult expressions" : ""}.
Keep the feedback to 2-4 short lines. The learner may type or speak (speech-to-text can produce small transcription errors; ignore missing punctuation).
If the learner writes in ${n} or asks for help, help them in ${n} inside the feedback, but keep your reply part in ${t}.
On the very first turn (when the learner says "START"), greet them and open the scenario; the feedback line then contains only the translation.`;
}

export async function POST(req: Request) {
  let body: { target: LangCode; native: LangCode; level: Level; scenario: ScenarioId; messages: ChatTurn[] };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  const { target, native, level, scenario, messages } = body;
  if (!LANGUAGES[target] || !LANGUAGES[native] || !LEVELS.includes(level) || !Array.isArray(messages)) {
    return new Response("Invalid request", { status: 400 });
  }
  const history = messages
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-30)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
  if (history.length === 0 || history[0].role !== "user") {
    return new Response("Conversation must start with a user message", { status: 400 });
  }

  const stream = client.beta.messages.stream({
    model: "claude-opus-5-5",
    max_tokens: 2000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low" },
    system: [{ type: "text", text: systemPrompt(target, native, level, scenario), cache_control: { type: "ephemeral" } }],
    messages: history,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        const final = await stream.finalMessage();
        if (final.stop_reason === "refusal") {
          controller.enqueue(encoder.encode("\n" + FEEDBACK_MARK + " Sorry, I can't continue with that. Let's talk about something else!"));
        }
      } catch (err) {
        console.error(err);
        const msg =
          err instanceof Anthropic.AuthenticationError || !process.env.ANTHROPIC_API_KEY
            ? "The server's ANTHROPIC_API_KEY is missing or invalid."
            : err instanceof Anthropic.RateLimitError
              ? "Too many requests right now, please try again in a moment."
              : "Something went wrong talking to the AI tutor.";
        controller.enqueue(encoder.encode("\n" + FEEDBACK_MARK + " ⚠️ " + msg));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
