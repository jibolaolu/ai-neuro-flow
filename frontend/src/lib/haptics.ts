/** Haptic feedback via Vibration API (Android Chrome) — silent on unsupported */

type Pattern = "tap" | "success" | "warning" | "error" | "selection";

const PATTERNS: Record<Pattern, number | number[]> = {
  tap:       10,
  selection: [10, 30, 10],
  success:   [15, 60, 15],
  warning:   [30, 60, 30],
  error:     [50, 30, 50, 30, 50],
};

export function haptic(pattern: Pattern = "tap"): void {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate(PATTERNS[pattern]);
  }
}
