#!/usr/bin/env python3
"""Simple sanity checks for deployed platform endpoints."""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request


def fetch_json(url: str, timeout: int) -> tuple[int, dict[str, object] | str]:
    request = urllib.request.Request(url, headers={"User-Agent": "sanity-check/1.0"})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        body = response.read().decode("utf-8")
        content_type = response.headers.get("Content-Type", "")
        if "application/json" in content_type:
            return response.status, json.loads(body)
        return response.status, body


def main() -> int:
    parser = argparse.ArgumentParser(description="Run sanity checks against deployed services.")
    parser.add_argument(
        "--frontend-url",
        required=True,
        help="Base URL for the frontend application.",
    )
    parser.add_argument(
        "--backend-url",
        required=True,
        help="Base URL for the backend API.",
    )
    parser.add_argument("--timeout", type=int, default=10, help="Per-request timeout in seconds.")
    args = parser.parse_args()

    checks = [
        ("frontend-home", args.frontend_url.rstrip("/") + "/"),
        ("backend-health", args.backend_url.rstrip("/") + "/health"),
        ("backend-clients", args.backend_url.rstrip("/") + "/api/v1/clients/"),
        ("backend-bookings", args.backend_url.rstrip("/") + "/api/v1/bookings/"),
        ("backend-reports", args.backend_url.rstrip("/") + "/api/v1/reports/summary"),
    ]

    failures = 0
    for name, url in checks:
        try:
            status, payload = fetch_json(url, args.timeout)
            print(f"[PASS] {name}: {status} {url}")
            print(json.dumps(payload, indent=2) if isinstance(payload, dict) else str(payload)[:200])
        except urllib.error.HTTPError as exc:
            failures += 1
            print(f"[FAIL] {name}: HTTP {exc.code} {url}")
        except urllib.error.URLError as exc:
            failures += 1
            print(f"[FAIL] {name}: {exc.reason} {url}")

    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
