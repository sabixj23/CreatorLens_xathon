"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ApiError, sendChat } from "@/lib/api";
import { isUnlocked, unlock } from "@/lib/storage";
import { FREE_CHAT_MESSAGES, type ChatRequest } from "@/lib/types";
import { useReport } from "./report-provider";
import { ConnectLink, Icon } from "./ui";

const STARTERS = ["Why did my growth slow down?", "Which format should I make more of?", "Give me 3 ideas based on my Content DNA"];
const MAX_HISTORY = 6; // matches MAX_HISTORY_TURNS in lib/chat.ts

type Message = ChatRequest["history"][number];

// Floating strategist chat: FREE_CHAT_MESSAGES free replies, then the Pro (demo) unlock.
// The server owns the count (httpOnly cookie); this only mirrors what it reports.
export function ChatPanel() {
  const { state } = useReport();
  const demo = state.status === "ready" && state.report.source === "demo";
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  // Unknown until the server answers; assume a fresh allowance.
  const [freeRemaining, setFreeRemaining] = useState(FREE_CHAT_MESSAGES);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setUnlocked(isUnlocked()); }, [open]);
  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight }); }, [messages, pending]);
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const locked = !unlocked && freeRemaining <= 0;

  async function ask(text: string) {
    const message = text.trim();
    if (!message || pending || locked || demo) return;
    const history = messages.slice(-MAX_HISTORY);
    setMessages(m => [...m, { role: "user", content: message }]);
    setInput("");
    setError("");
    setPending(true);
    try {
      const res = await sendChat({ message, history });
      setMessages(m => [...m, { role: "assistant", content: res.reply }]);
      if (res.freeRemaining !== null) setFreeRemaining(res.freeRemaining);
    } catch (err) {
      setMessages(m => m.slice(0, -1));
      setInput(message);
      if (err instanceof ApiError && err.status === 402) setFreeRemaining(0);
      else setError(err instanceof ApiError && err.status === 401 ? "Your session expired. Reconnect your channel to keep chatting." : "The strategist couldn’t answer just now. Try again.");
    } finally {
      setPending(false);
    }
  }

  function onSubmit(e: FormEvent) { e.preventDefault(); void ask(input); }
  function unlockPro() { if (unlock()) setUnlocked(true); }

  if (state.status !== "ready") return null;
  if (!open) return <button type="button" className="button button-primary chat-fab" onClick={() => setOpen(true)}>Ask your strategist</button>;

  return <div className="chat-drawer" role="dialog" aria-label="Strategist chat">
    <div className="chat-head">
      <div><h2>Strategist chat</h2><p>{demo ? "Connect your channel to chat" : unlocked ? "Pro · unlimited questions" : `${freeRemaining} of ${FREE_CHAT_MESSAGES} free questions left`}</p></div>
      <button type="button" className="chat-close" onClick={() => setOpen(false)} aria-label="Close chat">×</button>
    </div>
    <div className="chat-log" ref={logRef} aria-live="polite">
      {messages.length === 0 && <div className="chat-starters"><p className="fine-print">Answers use only your channel report.</p>{STARTERS.map(s => <button key={s} type="button" onClick={() => void ask(s)} disabled={demo || locked || pending}>{s}</button>)}</div>}
      {messages.map((m, i) => <div key={i} className={`chat-msg ${m.role}`}>{m.content}</div>)}
      {pending && <div className="chat-msg assistant"><span className="loading-dot" /></div>}
      {error && <p role="alert" className="chat-error">{error}</p>}
    </div>
    {demo ? <div className="chat-locked"><p>Chat answers from your real channel data.</p><ConnectLink /></div>
      : locked ? <div className="chat-locked"><p>You’ve used your {FREE_CHAT_MESSAGES} free questions. Pro keeps the conversation going.</p><button type="button" className="button button-primary" onClick={unlockPro}>Unlock Pro (demo)<Icon name="lock" size={16} /></button><p className="fine-print">Demo unlock — no payment is taken.</p></div>
      : <form className="chat-form" onSubmit={onSubmit}>
        <label className="sr-only" htmlFor="chat-input">Ask about your channel</label>
        <input id="chat-input" ref={inputRef} value={input} onChange={e => setInput(e.target.value)} placeholder="Ask about your channel…" maxLength={1000} autoComplete="off" />
        <button type="submit" className="button button-primary" disabled={pending || !input.trim()} aria-label="Send"><Icon name="arrow" size={17} /></button>
      </form>}
  </div>;
}
