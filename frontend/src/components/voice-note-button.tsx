"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface VoiceNoteButtonProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

export function VoiceNoteButton({ onTranscript, disabled }: VoiceNoteButtonProps) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening]   = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const recogRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    setSupported(!!SR);
  }, []);

  const stop = useCallback(() => {
    recogRef.current?.stop();
    recogRef.current = null;
    setListening(false);
  }, []);

  const start = useCallback(() => {
    setError(null);
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) { setError("Voice not supported in this browser."); return; }

    const recognition = new SR();
    recognition.lang = "en-GB";
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .slice(event.resultIndex)
        .map((r) => r[0].transcript)
        .join(" ")
        .trim();
      if (transcript) onTranscript(transcript);
    };

    recognition.onerror = (event) => {
      const msg = event.error === "no-speech" ? "No speech detected." : `Voice error: ${event.error}`;
      setError(msg);
      stop();
    };

    recognition.onend = () => {
      setListening(false);
      recogRef.current = null;
    };

    recogRef.current = recognition;
    recognition.start();
    setListening(true);
  }, [onTranscript, stop]);

  useEffect(() => () => { recogRef.current?.stop(); }, []);

  if (!supported) return null;

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
      <button
        type="button"
        onClick={listening ? stop : start}
        disabled={disabled}
        className={`vnb-btn${listening ? " vnb-btn--active" : ""}`}
        title={listening ? "Stop recording" : "Start voice dictation"}
        aria-label={listening ? "Stop voice recording" : "Dictate note"}
      >
        <svg
          width={14} height={14} viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
        >
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
          <line x1="12" y1="19" x2="12" y2="23"/>
          <line x1="8" y1="23" x2="16" y2="23"/>
        </svg>
        {listening ? "Stop" : "Dictate"}
      </button>
      {listening && <span className="vnb-pulse" aria-hidden="true" />}
      {error && <span className="vnb-error">{error}</span>}
    </span>
  );
}
