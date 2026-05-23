from dataclasses import dataclass


@dataclass
class FormAnalyzer:
    worker_name: str = "form-analyzer"

    def run(self, payload: dict[str, object]) -> dict[str, object]:
        return {"worker": self.worker_name, "received": payload, "status": "processed"}


if __name__ == "__main__":
    print(FormAnalyzer().run({"task": "sample form"}))
