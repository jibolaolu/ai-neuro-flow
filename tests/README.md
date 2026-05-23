# Test Scripts

These scripts provide quick validation against a running environment without requiring extra test tools.

## Sanity check

```bash
python tests/sanity_check.py --frontend-url http://localhost:3004 --backend-url http://localhost:8004
```

This checks:

- frontend homepage
- backend health endpoint
- sample backend API routes

## Load test

```bash
python tests/load_test.py --url http://localhost:8004/health --requests 100 --concurrency 20
```

This performs a lightweight concurrent request burst and prints success rate plus latency statistics.
