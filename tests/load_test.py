#!/usr/bin/env python3
"""Lightweight concurrent load test using Python stdlib only."""

from __future__ import annotations

import argparse
import concurrent.futures
import statistics
import sys
import time
import urllib.error
import urllib.request


def hit_endpoint(url: str, timeout: int) -> tuple[bool, float, int | None]:
    start = time.perf_counter()
    request = urllib.request.Request(url, headers={"User-Agent": "load-test/1.0"})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            elapsed = time.perf_counter() - start
            return 200 <= response.status < 400, elapsed, response.status
    except (urllib.error.HTTPError, urllib.error.URLError):
        elapsed = time.perf_counter() - start
        return False, elapsed, None


def main() -> int:
    parser = argparse.ArgumentParser(description="Run a lightweight load test.")
    parser.add_argument("--url", required=True, help="Endpoint URL to test.")
    parser.add_argument("--requests", type=int, default=50, help="Total number of requests.")
    parser.add_argument("--concurrency", type=int, default=10, help="Concurrent workers.")
    parser.add_argument("--timeout", type=int, default=10, help="Per-request timeout in seconds.")
    args = parser.parse_args()

    durations: list[float] = []
    successes = 0

    started = time.perf_counter()
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.concurrency) as executor:
        futures = [
            executor.submit(hit_endpoint, args.url, args.timeout)
            for _ in range(args.requests)
        ]
        for future in concurrent.futures.as_completed(futures):
            ok, duration, _status = future.result()
            durations.append(duration)
            if ok:
                successes += 1
    total_elapsed = time.perf_counter() - started

    failures = args.requests - successes
    p95_index = max(int(len(durations) * 0.95) - 1, 0)
    sorted_durations = sorted(durations)

    print(f"URL: {args.url}")
    print(f"Requests: {args.requests}")
    print(f"Concurrency: {args.concurrency}")
    print(f"Successes: {successes}")
    print(f"Failures: {failures}")
    print(f"Total time: {total_elapsed:.2f}s")
    print(f"Requests/sec: {args.requests / total_elapsed:.2f}")
    print(f"Avg latency: {statistics.mean(durations):.3f}s")
    print(f"P95 latency: {sorted_durations[p95_index]:.3f}s")
    print(f"Max latency: {max(sorted_durations):.3f}s")

    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
