"use client";

import { useState, useRef, useEffect } from "react";
import { clientChat } from "../lib/ai-api";

interface Message {
  role: "user" | "assistant";
  text: string;
}

interface ClientAIChatProps {
  /** Form token — used to identify the client without a login */
  formToken: string;
  assessmentType?: string;
}

const SUGGESTED_QUESTIONS = [
  "What happens at my assessment?",
  "How long will my results take?",
  "What should I bring on the day?",
  "Will I get a written report?",
];

export function ClientAIChat({ formToken, assessmentType = "Assessment" }: ClientAIChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      text: `Hi! I'm here to help you with questions about your ${assessmentType}. What would you like to know?`,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    if (!text.trim() || loading) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text }]);
    setLoading(true);
    const data = await clientChat(formToken, text);
    setLoading(false);
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        text: data?.reply ?? "Sorry, I couldn't get a response. Please try again.",
      },
    ]);
  }

  return (
    <div className="cac-shell">
      <div className="cac-header">
        <span className="cac-avatar">AI</span>
        <div>
          <p className="cac-title">Assessment Assistant</p>
          <p className="cac-subtitle">Ask me anything about your appointment</p>
        </div>
      </div>

      <div className="cac-messages">
        {messages.map((m, i) => (
          <div key={i} className={`cac-msg cac-msg--${m.role}`}>
            <p className="cac-msg-text">{m.text}</p>
          </div>
        ))}
        {loading && (
          <div className="cac-msg cac-msg--assistant">
            <p className="cac-msg-text cac-typing">Thinking…</p>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {messages.length === 1 && (
        <div className="cac-suggestions">
          {SUGGESTED_QUESTIONS.map((q) => (
            <button key={q} className="cac-suggestion-btn" onClick={() => void send(q)}>
              {q}
            </button>
          ))}
        </div>
      )}

      <div className="cac-input-row">
        <input
          className="cac-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void send(input)}
          placeholder="Type your question…"
          disabled={loading}
        />
        <button
          className="cac-send-btn"
          onClick={() => void send(input)}
          disabled={!input.trim() || loading}
        >
          Send
        </button>
      </div>

      <p className="cac-disclaimer">
        This assistant cannot provide diagnoses or medical advice.
      </p>
    </div>
  );
}
