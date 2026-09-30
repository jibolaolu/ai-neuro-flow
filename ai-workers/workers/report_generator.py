import logging
import os
import time
from dataclasses import dataclass

import requests

logger = logging.getLogger(__name__)


@dataclass
class ReportGenerator:
    worker_name: str = "report-generator"

    def run(self, payload: dict[str, object]) -> dict[str, object]:
        api_base_url = os.getenv("API_BASE_URL", "http://localhost:8004")
        health_response = requests.get(f"{api_base_url}/health", timeout=5)

        return {
            "worker": self.worker_name,
            "received": payload,
            "backend_status": health_response.json(),
            "status": "processed",
        }


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    logger.info("AI workers service starting")
    while True:
        try:
            result = ReportGenerator().run({"task": "health-check"})
            logger.info("Backend reachable: %s", result.get("backend_status"))
        except Exception as exc:
            logger.warning("Backend health check failed (will retry in 60s): %s", exc)
        time.sleep(60)
