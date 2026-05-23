from dataclasses import dataclass


@dataclass
class NoteProcessor:
    worker_name: str = "note-processor"

    def run(self, payload: dict[str, object]) -> dict[str, object]:
        return {"worker": self.worker_name, "received": payload, "status": "processed"}


if __name__ == "__main__":
    print(NoteProcessor().run({"task": "sample note"}))
