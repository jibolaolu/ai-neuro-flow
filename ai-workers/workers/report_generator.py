import os
from dataclasses import dataclass

import requests


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
    print(ReportGenerator().run({"task": "sample report"}))
