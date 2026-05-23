"""
Clinical scoring functions for Neuro Flow assessment instruments.

All functions accept raw rating arrays (0-indexed integers) and return
structured score dicts that are stored as JSON in client_profiles.scores.
"""
from __future__ import annotations


# ── ASRS-v1.1 ─────────────────────────────────────────────────────────────────
# 18 items, 5-point scale: 0=Never, 1=Rarely, 2=Sometimes, 3=Often, 4=Very Often
# Part A = items 0-5 (max 24), Part B = items 6-17 (max 48), Total max 72
#
# Positive screen (Part A): ≥4 items in shaded zone:
#   Items 0,1,2 (inattention): threshold ≥ 2 (Sometimes)
#   Items 3,4,5 (HI): threshold ≥ 3 (Often)

_ASRS_PART_A_THRESHOLDS = [2, 2, 2, 3, 3, 3]  # indices 0-5

# Inattention items (0-indexed): 0,1,2,3,6,7,8,9,10
_ASRS_INATTENTION_IDX = [0, 1, 2, 3, 6, 7, 8, 9, 10]
# Hyperactivity-Impulsivity items: 4,5,11,12,13,14,15,16,17
_ASRS_HI_IDX = [4, 5, 11, 12, 13, 14, 15, 16, 17]


def score_asrs(ratings: list[int]) -> dict:
    """
    Args:
        ratings: list of 18 integers (0–4)
    Returns:
        {part_a, part_a_max, part_b, part_b_max, total, total_max,
         screen_positive, screen_count,
         inattention_score, hi_score, presentation}
    """
    if len(ratings) < 18:
        ratings = list(ratings) + [0] * (18 - len(ratings))

    part_a = sum(ratings[:6])
    part_b = sum(ratings[6:18])
    total = part_a + part_b

    # Screen: count Part A items meeting threshold
    screen_count = sum(
        1 for i, thresh in enumerate(_ASRS_PART_A_THRESHOLDS)
        if ratings[i] >= thresh
    )
    screen_positive = screen_count >= 4

    inattention = sum(ratings[i] for i in _ASRS_INATTENTION_IDX)
    hi = sum(ratings[i] for i in _ASRS_HI_IDX)

    # Max scores for each subscale
    inn_max = len(_ASRS_INATTENTION_IDX) * 4  # 36
    hi_max = len(_ASRS_HI_IDX) * 4             # 36

    # Presentation type (rough heuristic - clinician confirms in full assessment)
    inn_pct = inattention / inn_max if inn_max else 0
    hi_pct = hi / hi_max if hi_max else 0
    if inn_pct >= 0.6 and hi_pct >= 0.6:
        presentation = "Combined Type"
    elif inn_pct >= 0.6:
        presentation = "Predominantly Inattentive"
    elif hi_pct >= 0.6:
        presentation = "Predominantly Hyperactive-Impulsive"
    else:
        presentation = "Sub-threshold / Unclear"

    # Likelihood label
    if total >= 54:
        likelihood = "VERY HIGH"
    elif total >= 40:
        likelihood = "HIGH"
    elif total >= 27:
        likelihood = "MODERATE"
    else:
        likelihood = "LOW"

    return {
        "part_a": part_a,
        "part_a_max": 24,
        "part_b": part_b,
        "part_b_max": 48,
        "total": total,
        "total_max": 72,
        "screen_positive": screen_positive,
        "screen_count": screen_count,
        "result": "POSITIVE" if screen_positive else "NEGATIVE",
        "inattention_score": inattention,
        "inattention_max": inn_max,
        "hi_score": hi,
        "hi_max": hi_max,
        "presentation": presentation,
        "likelihood": likelihood,
    }


# ── PHQ-9 ─────────────────────────────────────────────────────────────────────
# 9 items, 0-3 scale. Total max 27.

def score_phq9(ratings: list[int]) -> dict:
    if len(ratings) < 9:
        ratings = list(ratings) + [0] * (9 - len(ratings))
    total = sum(ratings[:9])
    if total <= 4:
        severity = "Minimal"
    elif total <= 9:
        severity = "Mild"
    elif total <= 14:
        severity = "Moderate"
    elif total <= 19:
        severity = "Moderately Severe"
    else:
        severity = "Severe"
    suicidal_flag = ratings[8] > 0  # item 9: thoughts of self-harm
    return {
        "total": total,
        "total_max": 27,
        "severity": severity,
        "suicidal_ideation_flag": suicidal_flag,
    }


# ── GAD-7 ─────────────────────────────────────────────────────────────────────
# 7 items, 0-3 scale. Total max 21.

def score_gad7(ratings: list[int]) -> dict:
    if len(ratings) < 7:
        ratings = list(ratings) + [0] * (7 - len(ratings))
    total = sum(ratings[:7])
    if total <= 4:
        severity = "Minimal"
    elif total <= 9:
        severity = "Mild"
    elif total <= 14:
        severity = "Moderate"
    else:
        severity = "Severe"
    return {
        "total": total,
        "total_max": 21,
        "severity": severity,
    }


# ── WFIRS-S ───────────────────────────────────────────────────────────────────
# 69 items across 7 domains. Scale: 0=Never, 1=Sometimes, 2=Often, 3=Very Often, -1=N/A
#
# Domain structure: (label, item_count)
_WFIRS_DOMAINS = [
    ("Family",       8),
    ("Work",        11),
    ("School",      10),
    ("Life Skills", 12),
    ("Self-Concept", 5),
    ("Social",       9),
    ("Risk",        14),
]
_WFIRS_TOTAL = sum(n for _, n in _WFIRS_DOMAINS)  # 69


def score_wfirs(ratings: list[int]) -> dict:
    """
    ratings: flat list of 69 integers; -1 = N/A (excluded from mean).
    Returns per-domain counts/means and overall mean.
    """
    if len(ratings) < _WFIRS_TOTAL:
        ratings = list(ratings) + [-1] * (_WFIRS_TOTAL - len(ratings))

    domains: list[dict] = []
    cursor = 0
    total_sum = 0
    total_count = 0
    total_elevated = 0

    for label, n in _WFIRS_DOMAINS:
        chunk = ratings[cursor: cursor + n]
        cursor += n
        scored = [v for v in chunk if v >= 0]
        elevated = sum(1 for v in scored if v >= 2)  # "Often" or "Very Often"
        d_sum = sum(scored)
        d_count = len(scored)
        d_mean = round(d_sum / d_count, 2) if d_count else 0.0
        domains.append({
            "domain": label,
            "total": d_sum,
            "items_answered": d_count,
            "items_total": n,
            "mean": d_mean,
            "elevated_count": elevated,
        })
        total_sum += d_sum
        total_count += d_count
        total_elevated += elevated

    overall_mean = round(total_sum / total_count, 2) if total_count else 0.0

    if overall_mean >= 2.0:
        impairment = "Severe"
    elif overall_mean >= 1.0:
        impairment = "Moderate"
    elif overall_mean >= 0.5:
        impairment = "Mild"
    else:
        impairment = "Minimal"

    return {
        "domains": domains,
        "overall_mean": overall_mean,
        "elevated_items": total_elevated,
        "total_items_answered": total_count,
        "impairment_level": impairment,
    }


# ── SDQ (Strengths and Difficulties Questionnaire) ────────────────────────────
# 25 items, 0-2 scale: 0=Not True, 1=Somewhat True, 2=Certainly True
#
# Subscale item indices (0-based):
#   Emotional symptoms:        2, 7, 12, 15, 23
#   Conduct problems:          4, 6(R), 11, 17, 21
#   Hyperactivity/inattention: 1, 9, 14, 20(R), 24(R)
#   Peer relationship probs:   5, 10(R), 13(R), 18, 22
#   Prosocial behaviour:       0, 3, 8, 16, 19
# Reversed items (R): score = 2 - raw_score

_SDQ_EMOTIONAL_IDX   = [2, 7, 12, 15, 23]
_SDQ_CONDUCT_IDX     = [4, 6, 11, 17, 21]
_SDQ_HYPERACT_IDX    = [1, 9, 14, 20, 24]
_SDQ_PEER_IDX        = [5, 10, 13, 18, 22]
_SDQ_PROSOCIAL_IDX   = [0, 3, 8, 16, 19]
_SDQ_REVERSED_IDX    = {6, 10, 13, 20, 24}


def _sdq_item(ratings: list[int], idx: int) -> int:
    v = ratings[idx]
    return (2 - v) if idx in _SDQ_REVERSED_IDX else v


def _sdq_subscale(ratings: list[int], indices: list[int]) -> int:
    return sum(_sdq_item(ratings, i) for i in indices)


def _sdq_band(score: int, normal_max: int, borderline_max: int) -> str:
    if score <= normal_max:
        return "Normal"
    if score <= borderline_max:
        return "Borderline"
    return "Elevated"


def _sdq_prosocial_band(score: int) -> str:
    if score >= 6:
        return "Normal"
    if score == 5:
        return "Borderline"
    return "Low"


def score_sdq(ratings: list[int], version: str = "parent") -> dict:
    """
    Args:
        ratings: list of 25 integers (0–2)
        version: "parent" or "self" (affects label only; scoring is identical)
    Returns subscale scores, total difficulties, and band classifications.
    """
    if len(ratings) < 25:
        ratings = list(ratings) + [1] * (25 - len(ratings))  # pad with middle value

    emotional  = _sdq_subscale(ratings, _SDQ_EMOTIONAL_IDX)
    conduct    = _sdq_subscale(ratings, _SDQ_CONDUCT_IDX)
    hyperact   = _sdq_subscale(ratings, _SDQ_HYPERACT_IDX)
    peer       = _sdq_subscale(ratings, _SDQ_PEER_IDX)
    prosocial  = _sdq_subscale(ratings, _SDQ_PROSOCIAL_IDX)
    total      = emotional + conduct + hyperact + peer

    return {
        "version": version,
        "emotional_symptoms":        emotional,
        "conduct_problems":          conduct,
        "hyperactivity_inattention": hyperact,
        "peer_problems":             peer,
        "prosocial":                 prosocial,
        "total_difficulties":        total,
        "total_max":                 40,
        # Band classifications (UK community norms)
        "emotional_band":   _sdq_band(emotional, 4, 5),
        "conduct_band":     _sdq_band(conduct,   2, 3),
        "hyperact_band":    _sdq_band(hyperact,  5, 6),
        "peer_band":        _sdq_band(peer,      2, 3),
        "prosocial_band":   _sdq_prosocial_band(prosocial),
        "total_band":       _sdq_band(total, 13, 16),
    }


# ── Conners Parent Rating Scale – Revised (S)  CPRS-R(S)  27 items ────────────
# Scale: 0=Not True At All, 1=Just A Little True, 2=Pretty Much True, 3=Very Much True
#
# Approximate subscale groupings (Conners 1997 factor structure):
#   CogProblems/Inattention (13 items): indices 0,2,4,7,9,11,12,14,16,18,20,24,26
#   Hyperactivity (8 items):            indices 3,6,8,13,17,21,22,25
#   Oppositional (6 items):             indices 1,5,10,15,19,23

_CPRS_COGNITIVE_IDX     = [0, 2, 4, 7, 9, 11, 12, 14, 16, 18, 20, 24, 26]
_CPRS_HYPERACT_IDX      = [3, 6, 8, 13, 17, 21, 22, 25]
_CPRS_OPPOSITIONAL_IDX  = [1, 5, 10, 15, 19, 23]
_CPRS_TOTAL_ITEMS       = 27


def _conners_severity(total: int, total_max: int) -> str:
    pct = total / total_max if total_max else 0
    if pct >= 0.67:
        return "Clinically Significant"
    if pct >= 0.50:
        return "Elevated"
    if pct >= 0.33:
        return "Mild"
    return "Subclinical"


def score_cprs(ratings: list[int]) -> dict:
    """
    Args:
        ratings: list of 27 integers (0–3)
    Returns approximate subscale scores and total.
    """
    if len(ratings) < _CPRS_TOTAL_ITEMS:
        ratings = list(ratings) + [0] * (_CPRS_TOTAL_ITEMS - len(ratings))

    cognitive   = sum(ratings[i] for i in _CPRS_COGNITIVE_IDX)
    hyperact    = sum(ratings[i] for i in _CPRS_HYPERACT_IDX)
    opposition  = sum(ratings[i] for i in _CPRS_OPPOSITIONAL_IDX)
    total       = sum(ratings[:_CPRS_TOTAL_ITEMS])
    total_max   = _CPRS_TOTAL_ITEMS * 3

    return {
        "cognitive_inattention":         cognitive,
        "cognitive_inattention_max":     len(_CPRS_COGNITIVE_IDX) * 3,
        "hyperactivity":                 hyperact,
        "hyperactivity_max":             len(_CPRS_HYPERACT_IDX) * 3,
        "oppositional":                  opposition,
        "oppositional_max":              len(_CPRS_OPPOSITIONAL_IDX) * 3,
        "total":                         total,
        "total_max":                     total_max,
        "severity":                      _conners_severity(total, total_max),
    }


# ── Conners Teacher Rating Scale – Revised (S)  CTRS-R(S)  28 items ──────────
# Scale: 0=Not True At All, 1=Just A Little True, 2=Pretty Much True, 3=Very Much True
#
# Approximate subscale groupings:
#   CogProblems/Inattention (12 items): indices 0,3,7,12,13,15,16,17,18,21,24,25
#   Hyperactivity (10 items):           indices 2,6,8,10,11,20,22,23,26,27
#   Oppositional (5 items):             indices 1,5,9,14,19
#   (remaining item 4 = academic; item 28 = restlessness - included in hyperactivity above)

_CTRS_COGNITIVE_IDX     = [0, 3, 7, 12, 13, 15, 16, 17, 18, 21, 24, 25]
_CTRS_HYPERACT_IDX      = [2, 6, 8, 10, 11, 20, 22, 23, 26, 27]
_CTRS_OPPOSITIONAL_IDX  = [1, 5, 9, 14, 19]
_CTRS_TOTAL_ITEMS       = 28


def score_ctrs(ratings: list[int]) -> dict:
    """
    Args:
        ratings: list of 28 integers (0–3)
    Returns approximate subscale scores and total.
    """
    if len(ratings) < _CTRS_TOTAL_ITEMS:
        ratings = list(ratings) + [0] * (_CTRS_TOTAL_ITEMS - len(ratings))

    cognitive   = sum(ratings[i] for i in _CTRS_COGNITIVE_IDX)
    hyperact    = sum(ratings[i] for i in _CTRS_HYPERACT_IDX)
    opposition  = sum(ratings[i] for i in _CTRS_OPPOSITIONAL_IDX)
    total       = sum(ratings[:_CTRS_TOTAL_ITEMS])
    total_max   = _CTRS_TOTAL_ITEMS * 3

    return {
        "cognitive_inattention":         cognitive,
        "cognitive_inattention_max":     len(_CTRS_COGNITIVE_IDX) * 3,
        "hyperactivity":                 hyperact,
        "hyperactivity_max":             len(_CTRS_HYPERACT_IDX) * 3,
        "oppositional":                  opposition,
        "oppositional_max":              len(_CTRS_OPPOSITIONAL_IDX) * 3,
        "total":                         total,
        "total_max":                     total_max,
        "severity":                      _conners_severity(total, total_max),
    }


# ── Master scorer ─────────────────────────────────────────────────────────────

def calculate_adult_scores(responses: dict) -> dict:
    """
    Given the responses dict from an adult_self form submission,
    calculate all instrument scores and return a combined dict.
    """
    asrs = responses.get("asrs_ratings", [])
    phq9 = responses.get("phq9_ratings", [])
    gad7 = responses.get("gad7_ratings", [])
    wfirs_flat = responses.get("wfirs_ratings", [])

    result: dict = {}
    if asrs and len(asrs) >= 6:
        result["asrs"] = score_asrs(asrs)
    if phq9 and len(phq9) >= 9:
        result["phq9"] = score_phq9(phq9)
    if gad7 and len(gad7) >= 7:
        result["gad7"] = score_gad7(gad7)
    if wfirs_flat:
        result["wfirs"] = score_wfirs(wfirs_flat)

    return result


def calculate_child_scores(responses: dict) -> dict:
    """
    Given the responses dict from a child_parent form submission,
    calculate SDQ (parent version) and CPRS scores.
    """
    sdq_ratings  = responses.get("sdq_parent_ratings", [])
    cprs_ratings = responses.get("cprs_ratings", [])

    result: dict = {}
    if sdq_ratings and len(sdq_ratings) >= 25:
        result["sdq"] = score_sdq(sdq_ratings, version="parent")
    if cprs_ratings and len(cprs_ratings) >= 27:
        result["cprs"] = score_cprs(cprs_ratings)
    return result


def calculate_adolescent_scores(responses: dict) -> dict:
    """
    Given the responses dict from an adolescent_self form submission,
    calculate SDQ (self-report version) and CPRS (parent) scores.
    """
    sdq_ratings  = responses.get("sdq_self_ratings", [])
    cprs_ratings = responses.get("cprs_ratings", [])

    result: dict = {}
    if sdq_ratings and len(sdq_ratings) >= 25:
        result["sdq"] = score_sdq(sdq_ratings, version="self")
    if cprs_ratings and len(cprs_ratings) >= 27:
        result["cprs"] = score_cprs(cprs_ratings)
    return result


def calculate_teacher_scores(responses: dict) -> dict:
    """
    Given the responses dict from a child_teacher or adolescent_teacher form submission,
    calculate CTRS scores.
    The frontend sends ratings under the key "conners_ratings".
    """
    # Accept either key for forward/backward compatibility
    ctrs_ratings = responses.get("conners_ratings") or responses.get("ctrs_ratings", [])
    result: dict = {}
    if ctrs_ratings and len(ctrs_ratings) >= 28:
        result["ctrs"] = score_ctrs(ctrs_ratings)
    return result
