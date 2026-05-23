"use client";

/**
 * FormResponseModal
 * Full Q&A popup for a submitted form.
 * Fetches /api/v1/forms/{formId}/full-responses (admin/senior-clinician only)
 * and renders every question with the client's answer.
 */

import { useEffect, useRef, useState } from "react";
import { browserApiUrl } from "../lib/get-api-base";

// ── Question label maps ──────────────────────────────────────────────────────

const ASRS_SCALE = ["Never", "Rarely", "Sometimes", "Often", "Very Often"];
const PHQ_GAD_SCALE = ["Not at all", "Several days", "More than half the days", "Nearly every day"];
const WFIRS_SCALE = ["Never / Not at all", "Sometimes", "Often", "Very Often / Frequently"];
const SDQ_SCALE = ["Not True", "Somewhat True", "Certainly True"];
const CONNERS_SCALE = ["Not at all true", "Just a little true", "Pretty much true", "Very much true"];

const ASRS_QUESTIONS: string[] = [
  // Part A - screener (items 1-6)
  "How often do you have trouble wrapping up the final details of a project once the challenging parts have been done?",
  "How often do you have difficulty getting things in order when you have to do a task that requires organisation?",
  "How often do you have problems remembering appointments or obligations?",
  "When you have a task that requires a lot of thought, how often do you avoid or delay getting started?",
  "How often do you fidget or squirm with your hands or feet when you have to sit down for a long time?",
  "How often do you feel overly active and compelled to do things, as if driven by a motor?",
  // Part B - supporting (items 7-18)
  "How often do you make careless mistakes when you have to work on a boring or difficult project?",
  "How often do you have difficulty keeping your attention when you are doing boring or repetitive work?",
  "How often do you have difficulty concentrating on what people say to you, even when they are speaking to you directly?",
  "How often do you misplace or have difficulty finding things at home or at work?",
  "How often are you distracted by activity or noise around you?",
  "How often do you leave your seat in meetings or other situations in which you are expected to remain seated?",
  "How often do you feel restless or fidgety?",
  "How often do you have difficulty unwinding and relaxing when you have time to yourself?",
  "How often do you find yourself talking too much when you are in social situations?",
  "When in a conversation, how often do you find yourself finishing the sentences of the people you are talking to before they can finish them themselves?",
  "How often do you have difficulty waiting your turn in situations when turn-taking is required?",
  "How often do you interrupt others when they are busy?",
];

const PHQ9_QUESTIONS: string[] = [
  "Little interest or pleasure in doing things",
  "Feeling down, depressed, or hopeless",
  "Trouble falling or staying asleep, or sleeping too much",
  "Feeling tired or having little energy",
  "Poor appetite or overeating",
  "Feeling bad about yourself, or that you are a failure or have let yourself or your family down",
  "Trouble concentrating on things, such as reading or watching television",
  "Moving or speaking so slowly that other people could have noticed; or the opposite, being so fidgety or restless that you have been moving around a lot more than usual",
  "Thoughts that you would be better off dead, or of hurting yourself in some way",
];

const GAD7_QUESTIONS: string[] = [
  "Feeling nervous, anxious, or on edge",
  "Not being able to stop or control worrying",
  "Worrying too much about different things",
  "Trouble relaxing",
  "Being so restless that it is hard to sit still",
  "Becoming easily annoyed or irritable",
  "Feeling afraid, as if something awful might happen",
];

// WFIRS-S domains and items
const WFIRS_ITEMS: { domain: string; questions: string[] }[] = [
  {
    domain: "Home",
    questions: [
      "Completing household chores (e.g. cleaning, laundry, repairs)",
      "Managing day-to-day responsibilities at home",
      "Dealing with paperwork (e.g. bills, mail, forms)",
      "Getting along with people you live with",
      "Being a burden to others at home",
    ],
  },
  {
    domain: "Work",
    questions: [
      "Managing your workload",
      "Completing work on time or meeting deadlines",
      "Your performance rating / evaluation at work",
      "Getting along with supervisors",
      "Getting along with co-workers",
      "Keeping a job",
    ],
  },
  {
    domain: "School",
    questions: [
      "Completing assignments",
      "Turning in work on time",
      "Your grades / academic performance",
      "Getting along with teachers / instructors",
      "Getting along with other students",
      "Being disciplined at school",
    ],
  },
  {
    domain: "Life Skills",
    questions: [
      "Managing money (e.g. paying bills, avoiding debt)",
      "Maintaining personal hygiene",
      "Sleeping properly",
      "Getting proper nutrition (eating regular meals)",
      "Exercising",
    ],
  },
  {
    domain: "Self-Concept",
    questions: [
      "Feeling confident in yourself",
      "Feeling satisfied with your life",
      "Feeling like you are doing the best you can",
    ],
  },
  {
    domain: "Social",
    questions: [
      "Getting along with your family",
      "Getting along with friends",
      "Participating in leisure activities",
      "Getting along with your significant other / spouse / partner",
    ],
  },
  {
    domain: "Risk",
    questions: [
      "Risky sexual behaviour",
      "Driving a car recklessly or too fast",
      "Getting into trouble with the law",
      "Smoking cigarettes or using tobacco products",
      "Drinking alcohol",
      "Taking illegal drugs or misusing medication",
    ],
  },
];

const SDQ_QUESTIONS: string[] = [
  "Considerate of other people's feelings",
  "Restless, overactive, cannot stay still for long",
  "Often complains of headaches, stomach-aches, or sickness",
  "Shares readily with other children (e.g. books, toys, pencils)",
  "Often has temper tantrums or hot tempers",
  "Rather solitary, tends to play alone",
  "Generally obedient, usually does what adults request",
  "Many worries, often seems worried",
  "Helpful if someone is hurt, upset, or feeling ill",
  "Constantly fidgeting or squirming",
  "Has at least one good friend",
  "Often fights with other children or bullies them",
  "Often unhappy, downhearted, or tearful",
  "Generally liked by other children",
  "Easily distracted, concentration wanders",
  "Nervous or clingy in new situations, easily loses confidence",
  "Kind to younger children",
  "Often lies or cheats",
  "Picked on or bullied by other children",
  "Often volunteers to help others (parents, teachers, other children)",
  "Thinks things out before acting",
  "Steals from home, school, or elsewhere",
  "Gets on better with adults than with other children",
  "Many fears, easily scared",
  "Good attention span, sees work through to the end",
];

const CONNERS_SHORT_QUESTIONS: string[] = [
  "Inattentive, easily distracted",
  "Difficulty completing tasks",
  "Fails to finish things they start",
  "Avoids or dislikes tasks requiring sustained mental effort",
  "Loses things necessary for tasks or activities",
  "Easily distracted by extraneous stimuli",
  "Forgetful in daily activities",
  "Fidgets with hands or feet or squirms in seat",
  "Leaves seat in classroom or in other situations",
  "Runs about or climbs excessively in inappropriate situations",
  "Difficulty playing or engaging in leisure activities quietly",
  "Talks excessively",
  "Blurts out answers before questions are completed",
  "Difficulty waiting turn",
  "Interrupts or intrudes on others",
  "Argues with adults",
  "Loses temper",
  "Actively defies or refuses to comply with adults' requests or rules",
  "Deliberately annoys people",
  "Blames others for own mistakes or misbehaviour",
  "Touchy or easily annoyed",
  "Angry and resentful",
  "Spiteful or vindictive",
];

// ── Types ────────────────────────────────────────────────────────────────────

type FullFormDetail = {
  id: string;
  form_type: string;
  form_label: string;
  status: string;
  recipient_email: string | null;
  recipient_name: string | null;
  sent_at: string | null;
  submitted_at: string | null;
  responses: Record<string, unknown> | null;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return "not set";
  try {
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

function ratingLabel(value: unknown, scale: string[]): string {
  if (typeof value !== "number" || value < 0) return "No answer";
  return scale[value] ?? `${value}`;
}

// ── Rating section ───────────────────────────────────────────────────────────

function RatingSection({
  title,
  ratings,
  questions,
  scale,
}: {
  title: string;
  ratings: unknown[];
  questions: string[];
  scale: string[];
}) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{
        fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em",
        color: "var(--brand, #1d4ed8)", borderBottom: "2px solid var(--brand-100, #bfdbfe)",
        paddingBottom: 6, marginBottom: 12,
      }}>
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {questions.map((q, i) => {
          const val = ratings[i];
          const answered = typeof val === "number" && val >= 0;
          return (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: 12,
                padding: "8px 10px",
                background: i % 2 === 0 ? "var(--surface-50, #fafafa)" : "transparent",
                borderRadius: 6,
                alignItems: "start",
              }}
            >
              <div style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.5 }}>
                <span style={{ color: "var(--muted)", fontSize: 11, marginRight: 6 }}>Q{i + 1}</span>
                {q}
              </div>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  padding: "2px 10px",
                  borderRadius: 12,
                  whiteSpace: "nowrap",
                  background: answered ? "var(--brand-50, #eff6ff)" : "var(--muted-50, #f4f4f4)",
                  color: answered ? "var(--brand, #1d4ed8)" : "var(--muted)",
                  border: `1px solid ${answered ? "var(--brand-100, #bfdbfe)" : "var(--muted-100)"}`,
                  flexShrink: 0,
                }}
              >
                {ratingLabel(val, scale)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── WFIRS domain sections ─────────────────────────────────────────────────────

function WfirsSection({ ratings }: { ratings: unknown[] }) {
  let idx = 0;
  return (
    <>
      {WFIRS_ITEMS.map((domain) => {
        const domainRatings = ratings.slice(idx, idx + domain.questions.length);
        idx += domain.questions.length;
        return (
          <RatingSection
            key={domain.domain}
            title={`WFIRS-S: ${domain.domain}`}
            ratings={domainRatings}
            questions={domain.questions}
            scale={WFIRS_SCALE}
          />
        );
      })}
    </>
  );
}

// ── Text response section ─────────────────────────────────────────────────────

function TextSection({ title, data }: { title: string; data: Record<string, unknown> }) {
  const entries = Object.entries(data).filter(([, v]) => v !== null && v !== undefined && v !== "");
  if (entries.length === 0) return null;
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{
        fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em",
        color: "var(--brand, #1d4ed8)", borderBottom: "2px solid var(--brand-100, #bfdbfe)",
        paddingBottom: 6, marginBottom: 12,
      }}>
        {title}
      </div>
      {entries.map(([k, v]) => {
        const strVal = typeof v === "boolean" ? (v ? "Yes" : "No") : String(v);
        const label = k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
        return (
          <div key={k} style={{
            display: "grid", gridTemplateColumns: "200px 1fr", gap: 12,
            padding: "7px 10px", borderBottom: "1px solid var(--muted-100)",
            fontSize: 13,
          }}>
            <span style={{ color: "var(--muted)", fontWeight: 600 }}>{label}</span>
            <span style={{ color: "var(--ink)", wordBreak: "break-word" }}>{strVal}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Main responses renderer ───────────────────────────────────────────────────

function FullResponsesRenderer({ detail }: { detail: FullFormDetail }) {
  const resp = detail.responses;
  if (!resp) return <p style={{ color: "var(--muted)", fontSize: 14 }}>No response data available.</p>;

  const asrsRatings = resp.asrs_ratings as unknown[] | undefined;
  const phq9Ratings = resp.phq9_ratings as unknown[] | undefined;
  const gad7Ratings = resp.gad7_ratings as unknown[] | undefined;
  const wfirsRatings = resp.wfirs_ratings as unknown[] | undefined;
  const sdqParentRatings = resp.sdq_parent_ratings as unknown[] | undefined;
  const sdqSelfRatings = resp.sdq_self_ratings as unknown[] | undefined;
  const cprsRatings = resp.cprs_ratings as unknown[] | undefined;
  const ctrsRatings = resp.ctrs_ratings as unknown[] | undefined;
  const conners = resp.conners_ratings as unknown[] | undefined;

  const consent = resp.consent && typeof resp.consent === "object" && !Array.isArray(resp.consent)
    ? resp.consent as Record<string, unknown>
    : null;

  // Collect text sections (objects that are not rating arrays)
  const RATING_KEYS = new Set([
    "asrs_ratings", "phq9_ratings", "gad7_ratings", "wfirs_ratings",
    "sdq_parent_ratings", "sdq_self_ratings", "cprs_ratings", "ctrs_ratings", "conners_ratings",
    "_rating_summary", "consent",
  ]);
  const textSections = Object.entries(resp).filter(([k, v]) =>
    !RATING_KEYS.has(k) && typeof v === "object" && v !== null && !Array.isArray(v)
  ) as [string, Record<string, unknown>][];

  const topLevelText = Object.fromEntries(
    Object.entries(resp).filter(([k, v]) =>
      !RATING_KEYS.has(k) && (typeof v === "string" || typeof v === "boolean")
    )
  );

  return (
    <div>
      {/* Consent */}
      {consent && (
        <div style={{ padding: "12px 14px", background: "var(--brand-50, #eff6ff)", borderRadius: 8, marginBottom: 20, border: "1px solid var(--brand-100, #bfdbfe)" }}>
          <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--brand, #1d4ed8)", marginBottom: 8 }}>Consent</div>
          <div style={{ fontSize: 13, color: "var(--ink)" }}>
            Assessment consent: <strong>{consent.assessment ? "Given" : "Not given"}</strong>
          </div>
          <div style={{ fontSize: 13, color: "var(--ink)", marginTop: 4 }}>
            Communications consent: <strong>{consent.communications ? "Given" : "Not given"}</strong>
          </div>
        </div>
      )}

      {/* Text sections */}
      {textSections.map(([key, val]) => (
        <TextSection key={key} title={key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())} data={val} />
      ))}
      {Object.keys(topLevelText).length > 0 && (
        <TextSection title="Additional Details" data={topLevelText} />
      )}

      {/* Questionnaire ratings */}
      {asrsRatings && asrsRatings.length > 0 && (
        <>
          <RatingSection
            title="ASRS-v1.1 Part A - ADHD Screener (Items 1-6)"
            ratings={asrsRatings.slice(0, 6)}
            questions={ASRS_QUESTIONS.slice(0, 6)}
            scale={ASRS_SCALE}
          />
          <RatingSection
            title="ASRS-v1.1 Part B - Supporting Items (Items 7-18)"
            ratings={asrsRatings.slice(6)}
            questions={ASRS_QUESTIONS.slice(6)}
            scale={ASRS_SCALE}
          />
        </>
      )}
      {phq9Ratings && phq9Ratings.length > 0 && (
        <RatingSection title="PHQ-9 - Depression Screening" ratings={phq9Ratings} questions={PHQ9_QUESTIONS} scale={PHQ_GAD_SCALE} />
      )}
      {gad7Ratings && gad7Ratings.length > 0 && (
        <RatingSection title="GAD-7 - Anxiety Screening" ratings={gad7Ratings} questions={GAD7_QUESTIONS} scale={PHQ_GAD_SCALE} />
      )}
      {wfirsRatings && wfirsRatings.length > 0 && (
        <WfirsSection ratings={wfirsRatings} />
      )}
      {sdqParentRatings && sdqParentRatings.length > 0 && (
        <RatingSection title="SDQ Parent-Report" ratings={sdqParentRatings} questions={SDQ_QUESTIONS} scale={SDQ_SCALE} />
      )}
      {sdqSelfRatings && sdqSelfRatings.length > 0 && (
        <RatingSection title="SDQ Self-Report" ratings={sdqSelfRatings} questions={SDQ_QUESTIONS} scale={SDQ_SCALE} />
      )}
      {(cprsRatings && cprsRatings.length > 0) && (
        <RatingSection title="Conners Parent Rating Scale (CPRS)" ratings={cprsRatings} questions={CONNERS_SHORT_QUESTIONS.slice(0, cprsRatings.length)} scale={CONNERS_SCALE} />
      )}
      {(ctrsRatings && ctrsRatings.length > 0) && (
        <RatingSection title="Conners Teacher Rating Scale (CTRS)" ratings={ctrsRatings} questions={CONNERS_SHORT_QUESTIONS.slice(0, ctrsRatings.length)} scale={CONNERS_SCALE} />
      )}
      {(conners && conners.length > 0) && (
        <RatingSection title="Conners Rating Scale" ratings={conners} questions={CONNERS_SHORT_QUESTIONS.slice(0, conners.length)} scale={CONNERS_SCALE} />
      )}
    </div>
  );
}

// ── Public modal component ───────────────────────────────────────────────────

export function FormResponseModal({
  formId,
  formLabel,
  onClose,
}: {
  formId: string;
  formLabel: string;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<FullFormDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch(browserApiUrl(`/api/v1/forms/${formId}/full-responses`), {
          credentials: "include",
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error((body as { detail?: string }).detail ?? `HTTP ${res.status}`);
        }
        const data = (await res.json()) as FullFormDetail;
        if (!cancelled) setDetail(data);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Could not load responses");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [formId]);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      ref={backdropRef}
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        zIndex: 2000,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "40px 16px",
        overflowY: "auto",
      }}
    >
      <div
        style={{
          background: "var(--card-bg, #fff)",
          borderRadius: 14,
          width: "100%",
          maxWidth: 760,
          boxShadow: "0 16px 48px rgba(0,0,0,0.22)",
          display: "flex",
          flexDirection: "column",
          maxHeight: "calc(100vh - 80px)",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "18px 24px",
          borderBottom: "1px solid var(--card-border)",
          flexShrink: 0,
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.02em" }}>
              {formLabel}
            </h2>
            {detail && (
              <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                Submitted by {detail.recipient_name ?? detail.recipient_email ?? "recipient"}
                {detail.submitted_at ? ` on ${fmtDate(detail.submitted_at)}` : ""}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 20,
              color: "var(--muted)",
              padding: "4px 8px",
              borderRadius: 6,
              lineHeight: 1,
              flexShrink: 0,
            }}
            aria-label="Close"
          >
            x
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "24px", overflowY: "auto", flex: 1 }}>
          {loading && (
            <p style={{ color: "var(--muted)", fontSize: 14, textAlign: "center", padding: "40px 0" }}>
              Loading responses...
            </p>
          )}
          {!loading && err && (
            <p style={{ color: "var(--danger)", fontSize: 14 }}>Could not load: {err}</p>
          )}
          {!loading && !err && detail && (
            <FullResponsesRenderer detail={detail} />
          )}
        </div>
      </div>
    </div>
  );
}
