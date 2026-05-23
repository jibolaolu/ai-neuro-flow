"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { MockRoleKey } from "../lib/mock-auth";

const ADMIN_IDLE_WARNING_MS = 10 * 60 * 1000;
const ADMIN_IDLE_LOGOUT_MS = 12 * 60 * 1000;
const USER_IDLE_WARNING_MS = 20 * 60 * 1000;
const USER_IDLE_LOGOUT_MS = 25 * 60 * 1000;
const SESSION_MAX_MS = 8 * 60 * 60 * 1000;
const SESSION_START_KEY = "neuroflow:session_start";

type Props = {
  role: MockRoleKey;
  sessionStartedAt?: number;
};

function isAdminRole(role: MockRoleKey) {
  return role === "clinic-admin" || role === "super-admin";
}

export function InactivityGuard({ role, sessionStartedAt }: Props) {
  const warningTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const showWarningRef = useRef(false);
  const logoutTriggeredRef = useRef(false);
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const idlePolicy = useMemo(
    () =>
      isAdminRole(role)
        ? { warningMs: ADMIN_IDLE_WARNING_MS, logoutMs: ADMIN_IDLE_LOGOUT_MS }
        : { warningMs: USER_IDLE_WARNING_MS, logoutMs: USER_IDLE_LOGOUT_MS },
    [role],
  );

  useEffect(() => {
    showWarningRef.current = showWarning;
  }, [showWarning]);

  const clearAllTimers = useCallback(() => {
    if (warningTimer.current) clearTimeout(warningTimer.current);
    if (logoutTimer.current) clearTimeout(logoutTimer.current);
    if (countdownInterval.current) clearInterval(countdownInterval.current);
    warningTimer.current = null;
    logoutTimer.current = null;
    countdownInterval.current = null;
  }, []);

  const logout = useCallback(
    (reason: string) => {
      if (logoutTriggeredRef.current) return;
      logoutTriggeredRef.current = true;
      clearAllTimers();
      setShowWarning(false);
      setSecondsLeft(0);

      try {
        window.localStorage.removeItem("access_token");
        window.sessionStorage.removeItem(SESSION_START_KEY);
      } catch {}

      if (process.env.NODE_ENV !== "production") {
        console.warn("[Neuro Flow auth] logging out:", reason);
      }

      window.location.href = "/api/auth/logout";
    },
    [clearAllTimers],
  );

  const startWarningCountdown = useCallback(() => {
    const countdownSeconds = Math.max(
      0,
      Math.floor((idlePolicy.logoutMs - idlePolicy.warningMs) / 1000),
    );

    setSecondsLeft(countdownSeconds);
    setShowWarning(true);

    if (countdownInterval.current) clearInterval(countdownInterval.current);
    countdownInterval.current = setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          if (countdownInterval.current) clearInterval(countdownInterval.current);
          countdownInterval.current = null;
          return 0;
        }
        return current - 1;
      });
    }, 1000);
  }, [idlePolicy]);

  const resetTimer = useCallback(() => {
    clearAllTimers();
    setShowWarning(false);
    setSecondsLeft(0);
    logoutTriggeredRef.current = false;
    warningTimer.current = setTimeout(startWarningCountdown, idlePolicy.warningMs);
    logoutTimer.current = setTimeout(() => logout("idle timeout"), idlePolicy.logoutMs);
  }, [clearAllTimers, idlePolicy, logout, startWarningCountdown]);

  useEffect(() => {
    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"] as const;
    const handler = () => {
      if (!showWarningRef.current) resetTimer();
    };

    events.forEach((eventName) => window.addEventListener(eventName, handler, { passive: true }));
    resetTimer();

    return () => {
      events.forEach((eventName) => window.removeEventListener(eventName, handler));
      clearAllTimers();
    };
  }, [clearAllTimers, resetTimer]);

  useEffect(() => {
    const getSessionStart = () => {
      if (typeof sessionStartedAt === "number" && Number.isFinite(sessionStartedAt)) {
        return sessionStartedAt;
      }

      const stored = window.sessionStorage.getItem(SESSION_START_KEY);
      const parsed = stored ? Number(stored) : NaN;
      if (Number.isFinite(parsed)) return parsed;

      const now = Date.now();
      window.sessionStorage.setItem(SESSION_START_KEY, String(now));
      return now;
    };

    const checkAbsoluteExpiry = () => {
      if (logoutTriggeredRef.current) return;
      if (Date.now() - getSessionStart() >= SESSION_MAX_MS) {
        logout("absolute session max exceeded");
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") checkAbsoluteExpiry();
    };

    checkAbsoluteExpiry();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", checkAbsoluteExpiry);
    const interval = window.setInterval(checkAbsoluteExpiry, 60_000);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", checkAbsoluteExpiry);
      window.clearInterval(interval);
    };
  }, [logout, sessionStartedAt]);

  if (!showWarning) return null;

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const countdown = `${minutes}:${String(seconds).padStart(2, "0")}`;

  return (
    <div className="inactivity-overlay">
      <div className="inactivity-modal">
        <div className="inactivity-modal-icon" aria-hidden>
          !
        </div>
        <h2>Session expiring soon</h2>
        <p>
          You have been inactive for a while. For security, this{" "}
          {isAdminRole(role) ? "admin" : "user"} session will end in{" "}
          <strong>{countdown}</strong> unless you continue.
        </p>
        <div className="button-strip">
          <button
            className="ghost-chip button-reset"
            onClick={() => logout("manual idle warning")}
            type="button"
          >
            Log out now
          </button>
          <button
            className="primary-action button-reset"
            onClick={resetTimer}
            type="button"
          >
            Stay signed in
          </button>
        </div>
      </div>
    </div>
  );
}
