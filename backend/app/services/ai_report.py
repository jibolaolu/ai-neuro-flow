"""
AI Clinical Report generation using Anthropic Claude.

Generates a structured pre-assessment overview for clinician review.
Stored as JSON in client_profiles.ai_clinical_report.
Never shown directly to the client - admin and senior clinician only.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = (
    "You are a specialist clinical assistant for Neuro Flow, a UK-based "
    "ADHD and Autism assessment service. You produce structured pre-assessment "
    "overviews for senior clinicians. Always respond with valid JSON only - "
    "no markdown, no code fences, no extra text."
)


def _build_prompt(client_name: str, age: int | None, scores: dict, pathway: str = "adult") -> str:
    asrs  = scores.get("asrs", {})
    phq9  = scores.get("phq9", {})
    gad7  = scores.get("gad7", {})
    wfirs = scores.get("wfirs", {})
    sdq   = scores.get("sdq", {})
    cprs  = scores.get("cprs", {})
    ctrs  = scores.get("ctrs", {})

    lines: list[str] = [
        f"Patient: {client_name}",
        f"Age: {age or 'unknown'}",
        f"Assessment pathway: {pathway}",
        "",
        "INSTRUMENT SCORES:",
    ]

    # ── Adult instruments ────────────────────────────────────────────────────
    if asrs:
        lines += [
            f"ASRS-v1.1 Part A: {asrs.get('part_a')}/{asrs.get('part_a_max')}",
            f"ASRS-v1.1 Part B: {asrs.get('part_b')}/{asrs.get('part_b_max')}",
            f"ASRS-v1.1 Total: {asrs.get('total')}/{asrs.get('total_max')}",
            f"ASRS Screen Result: {asrs.get('result')} ({asrs.get('screen_count')}/6 Part A items in clinical range)",
            f"Inattention subscale: {asrs.get('inattention_score')}/{asrs.get('inattention_max')}",
            f"Hyperactivity-Impulsivity subscale: {asrs.get('hi_score')}/{asrs.get('hi_max')}",
            f"Suggested presentation: {asrs.get('presentation')}",
        ]

    if phq9:
        lines += [
            f"PHQ-9 (Depression): {phq9.get('total')}/27 - {phq9.get('severity')}",
            f"Suicidal ideation item: {'FLAGGED' if phq9.get('suicidal_ideation_flag') else 'not flagged'}",
        ]

    if gad7:
        lines.append(f"GAD-7 (Anxiety): {gad7.get('total')}/21 - {gad7.get('severity')}")

    if wfirs:
        lines.append(
            f"WFIRS-S Overall mean: {wfirs.get('overall_mean')}/3.0 - {wfirs.get('impairment_level')} functional impairment"
        )
        for d in (wfirs.get("domains") or []):
            lines.append(f"  WFIRS {d['domain']}: mean {d['mean']}, elevated items {d['elevated_count']}/{d['items_total']}")

    # ── Child / adolescent instruments ───────────────────────────────────────
    if sdq:
        version_label = "SDQ Self-Report" if sdq.get("version") == "self" else "SDQ Parent-Report"
        lines += [
            f"{version_label} Total Difficulties: {sdq.get('total_difficulties')}/40 - {sdq.get('total_band')}",
            f"  Emotional symptoms:        {sdq.get('emotional_symptoms')}/10 ({sdq.get('emotional_band')})",
            f"  Conduct problems:          {sdq.get('conduct_problems')}/10 ({sdq.get('conduct_band')})",
            f"  Hyperactivity/inattention: {sdq.get('hyperactivity_inattention')}/10 ({sdq.get('hyperact_band')})",
            f"  Peer problems:             {sdq.get('peer_problems')}/10 ({sdq.get('peer_band')})",
            f"  Prosocial behaviour:       {sdq.get('prosocial')}/10 ({sdq.get('prosocial_band')})",
        ]

    if cprs:
        lines += [
            f"CPRS-R(S) (Conners Parent Scale) Total: {cprs.get('total')}/{cprs.get('total_max')} - {cprs.get('severity')}",
            f"  Cognitive/Inattention: {cprs.get('cognitive_inattention')}/{cprs.get('cognitive_inattention_max')}",
            f"  Hyperactivity:         {cprs.get('hyperactivity')}/{cprs.get('hyperactivity_max')}",
            f"  Oppositional:          {cprs.get('oppositional')}/{cprs.get('oppositional_max')}",
        ]

    if ctrs:
        lines += [
            f"CTRS-R(S) (Conners Teacher Scale) Total: {ctrs.get('total')}/{ctrs.get('total_max')} - {ctrs.get('severity')}",
            f"  Cognitive/Inattention: {ctrs.get('cognitive_inattention')}/{ctrs.get('cognitive_inattention_max')}",
            f"  Hyperactivity:         {ctrs.get('hyperactivity')}/{ctrs.get('hyperactivity_max')}",
            f"  Oppositional:          {ctrs.get('oppositional')}/{ctrs.get('oppositional_max')}",
        ]

    lines += [
        "",
        "TASK:",
        "You are a specialist ADHD/Autism clinical assistant producing a pre-assessment overview for a "
        "senior clinician at Neuro Flow. Based solely on the scores above, produce:",
        "",
        "1. diagnostic_impression: An object with:",
        "   - likelihood: one of LOW / MODERATE / HIGH / VERY HIGH",
        "   - presentation: ADHD/neurodevelopmental presentation type (e.g. Combined Type, "
        "Predominantly Inattentive, Predominantly Hyperactive-Impulsive, Autism indicators present, "
        "Unclear/Sub-threshold)",
        "   - reasoning: 2-4 sentences clinical reasoning",
        "",
        "2. clinical_summary: 2-3 sentences describing the overall clinical picture",
        "",
        "3. recommendations: A list of 4-7 specific recommendations for the assessing clinician "
        "(what to explore, screen for, or consider)",
        "",
        "4. flags: List any urgent flags (e.g. suicidal ideation, severe conduct problems, "
        "safeguarding, LAC status). Empty list if none.",
        "",
        "Respond with valid JSON only, exactly this structure:",
        '{"diagnostic_impression": {"likelihood": "...", "presentation": "...", "reasoning": "..."},'
        ' "clinical_summary": "...", "recommendations": ["...", "..."], "flags": []}',
        "",
        "Important: This is a screening aid only. Do not make a diagnosis. The clinician will verify everything.",
    ]
    return "\n".join(lines)


def _strip_json_fences(text: str) -> str:
    """Remove markdown code fences if the model wraps the JSON anyway."""
    text = text.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        # drop first line (```json or ```) and last line (```)
        inner = lines[1:-1] if lines[-1].strip() == "```" else lines[1:]
        text = "\n".join(inner).strip()
    return text


def generate_ai_report(
    *,
    client_name: str,
    age: int | None,
    scores: dict,
    pathway: str = "adult",
) -> dict:
    """
    Call Anthropic Claude to generate a structured AI clinical overview.
    Returns the parsed JSON dict (or an error stub on failure).
    """
    try:
        import anthropic  # type: ignore
        from app.core.config import settings

        api_key = settings.anthropic_api_key or None  # None → SDK reads ANTHROPIC_API_KEY env var
        claude = anthropic.Anthropic(api_key=api_key) if api_key else anthropic.Anthropic()

        prompt = _build_prompt(client_name, age, scores, pathway=pathway)
        model = settings.anthropic_model

        message = claude.messages.create(
            model=model,
            max_tokens=1200,
            system=_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}],
        )

        raw = message.content[0].text if message.content else "{}"
        raw = _strip_json_fences(raw)

        result = json.loads(raw)
        result["generated_at"] = datetime.now(timezone.utc).isoformat()
        result["model"] = model
        result["scores_snapshot"] = scores
        return result

    except Exception as exc:  # noqa: BLE001
        logger.error("AI report generation failed: %s", exc)
        return {
            "error": str(exc),
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "diagnostic_impression": None,
            "clinical_summary": None,
            "recommendations": [],
            "flags": [],
            "scores_snapshot": scores,
        }
