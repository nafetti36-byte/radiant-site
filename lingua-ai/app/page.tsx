"use client";

import { useEffect, useRef, useState } from "react";
import { FEEDBACK_MARK, LANGUAGES, LEVELS, SCENARIOS, type LangCode, type Level, type ScenarioId } from "@/lib/languages";

type Msg = { role: "user" | "assistant"; content: string };

/* Minimal typing for the browser Speech Recognition API */
type SR = {
  lang: string; interimResults: boolean; continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null;
  start(): void; stop(): void;
};
function getSR(): (new () => SR) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function split(text: string) {
  const i = text.indexOf(FEEDBACK_MARK);
  return i === -1 ? { reply: text.trim(), feedback: "" } : { reply: text.slice(0, i).trim(), feedback: text.slice(i + FEEDBACK_MARK.length).trim() };
}

export default function Home() {
  const [target, setTarget] = useState<LangCode>("en");
  const [native, setNative] = useState<LangCode>("fr");
  const [level, setLevel] = useState<Level>("Beginner");
  const [scenario, setScenario] = useState<ScenarioId>("free");
  const [started, setStarted] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [speechOk, setSpeechOk] = useState(true);
  const recRef = useRef<SR | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => setSpeechOk(!!getSR()), []);
  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [messages]);

  function speak(text: string) {
    if (typeof window === "undefined" || !window.speechSynthesis || !text) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = LANGUAGES[target].speech;
    const voice = window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith(target));
    if (voice) u.voice = voice;
    u.rate = level === "Beginner" ? 0.85 : 1;
    window.speechSynthesis.speak(u);
  }

  async function send(history: Msg[]) {
    setLoading(true);
    // "START" is a hidden first user turn that makes the tutor open the conversation
    const apiMessages: Msg[] = [{ role: "user", content: "START" }, ...history];
    setMessages([...history, { role: "assistant", content: "" }]);
    let full = "";
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target, native, level, scenario, messages: apiMessages }),
      });
      if (!res.ok || !res.body) throw new Error(await res.text());
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        full += dec.decode(value, { stream: true });
        setMessages([...history, { role: "assistant", content: full }]);
      }
    } catch {
      full = FEEDBACK_MARK + " ⚠️ Connection error. Please try again.";
      setMessages([...history, { role: "assistant", content: full }]);
    } finally {
      setLoading(false);
    }
    if (autoSpeak) speak(split(full).reply);
  }

  function start() {
    setStarted(true);
    setMessages([]);
    send([]);
  }

  function submit(text: string) {
    const t = text.trim();
    if (!t || loading) return;
    setInput("");
    // The first assistant message is the greeting answering the hidden "START"
    send([...messages, { role: "user", content: t }]);
  }

  function toggleMic() {
    if (listening) { recRef.current?.stop(); return; }
    const SRClass = getSR();
    if (!SRClass) return;
    window.speechSynthesis?.cancel();
    const rec = new SRClass();
    rec.lang = LANGUAGES[target].speech;
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = "";
    rec.onresult = (e) => {
      let interim = "";
      finalText = "";
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript; else interim += r[0].transcript;
      }
      setInput(finalText + interim);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => { setListening(false); if (finalText.trim()) submit(finalText); };
    recRef.current = rec;
    setListening(true);
    rec.start();
  }

  const rtl = LANGUAGES[target].rtl;

  if (!started) {
    return (
      <main className="setup">
        <h1>🗣️ Lingua AI</h1>
        <p className="sub">Practise speaking a new language with your personal AI partner.</p>

        <label>I want to practise</label>
        <div className="grid">
          {(Object.keys(LANGUAGES) as LangCode[]).map((c) => (
            <button key={c} className={`chip ${target === c ? "on" : ""}`} onClick={() => setTarget(c)}>
              <span className="flag">{LANGUAGES[c].flag}</span>{LANGUAGES[c].native}
            </button>
          ))}
        </div>

        <label>My language (for corrections & translations)</label>
        <select value={native} onChange={(e) => setNative(e.target.value as LangCode)}>
          {(Object.keys(LANGUAGES) as LangCode[]).map((c) => (
            <option key={c} value={c}>{LANGUAGES[c].flag} {LANGUAGES[c].native}</option>
          ))}
        </select>

        <label>Level</label>
        <div className="row">
          {LEVELS.map((l) => (
            <button key={l} className={`chip ${level === l ? "on" : ""}`} onClick={() => setLevel(l)}>{l}</button>
          ))}
        </div>

        <label>Situation</label>
        <div className="grid">
          {SCENARIOS.map((s) => (
            <button key={s.id} className={`chip ${scenario === s.id ? "on" : ""}`} onClick={() => setScenario(s.id)}>{s.label}</button>
          ))}
        </div>

        <button className="primary" onClick={start}>Start speaking {LANGUAGES[target].flag}</button>
        {!speechOk && <p className="warn">Voice input isn't supported in this browser — use Chrome, Edge or Safari, or type instead.</p>}
      </main>
    );
  }

  return (
    <main className="chat">
      <header>
        <button className="ghost" onClick={() => { window.speechSynthesis?.cancel(); setStarted(false); }}>←</button>
        <div className="title">
          {LANGUAGES[target].flag} {LANGUAGES[target].native} · {level}
          <small>{SCENARIOS.find((s) => s.id === scenario)?.label}</small>
        </div>
        <button className="ghost" title="Read replies aloud" onClick={() => setAutoSpeak(!autoSpeak)}>{autoSpeak ? "🔊" : "🔇"}</button>
      </header>

      <section className="messages">
        {messages.map((m, i) => {
          if (m.role === "user") return <div key={i} className="bubble user" dir={rtl ? "rtl" : "ltr"}>{m.content}</div>;
          const { reply, feedback } = split(m.content);
          return (
            <div key={i} className="bubble ai">
              <div dir={rtl ? "rtl" : "ltr"}>{reply || (loading && i === messages.length - 1 ? <span className="dots">●●●</span> : null)}</div>
              {reply && <button className="mini" onClick={() => speak(reply)}>🔊 Listen</button>}
              {feedback && <div className="feedback">💡 {feedback}</div>}
            </div>
          );
        })}
        <div ref={endRef} />
      </section>

      <form className="composer" onSubmit={(e) => { e.preventDefault(); submit(input); }}>
        {speechOk && (
          <button type="button" className={`mic ${listening ? "live" : ""}`} onClick={toggleMic} disabled={loading} aria-label="Speak">
            {listening ? "■" : "🎤"}
          </button>
        )}
        <input
          dir={rtl ? "rtl" : "ltr"}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={listening ? "Listening…" : `Speak or type in ${LANGUAGES[target].native}…`}
        />
        <button type="submit" className="send" disabled={loading || !input.trim()}>➤</button>
      </form>
    </main>
  );
}
