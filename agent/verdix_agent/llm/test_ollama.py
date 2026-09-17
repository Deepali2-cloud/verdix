import os
import sys

# Add VERDIX project root to Python path
PROJECT_ROOT = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..")
)

if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from agent.verdix_agent.llm.ollama_client import OllamaClient


def main():
    client = OllamaClient()

    print("=" * 60)
    print("VERDIX + OLLAMA AI REASONING TEST")
    print("=" * 60)

    health = client.health_check()

    print("\nOllama Status:")
    print(health)

    if not health["success"]:
        print("\nERROR: Ollama is not reachable.")
        return

    if not health["modelAvailable"]:
        print("\nERROR: qwen3:8b is not available.")
        return

    evaluation_result = {
        "rawDataIncluded": False,
        "datasetAlias": "student_records",
        "summaryMetrics": [
            {
                "metric": "count",
                "value": 1000,
                "sampleSize": 1000,
                "privacyNoiseAdded": False,
            },
            {
                "metric": "completeness",
                "column": "email",
                "value": 92.5,
                "sampleSize": 1000,
                "privacyNoiseAdded": False,
            },
            {
                "metric": "duplicate_rate",
                "value": 8.4,
                "sampleSize": 1000,
                "privacyNoiseAdded": False,
            },
        ],
    }

    print("\nSending sanitized evaluation results to Qwen3...")
    print("(This may take some time on CPU.)")
    print()

    result = client.explain_evaluation(evaluation_result)

    if result["success"]:
        print("=" * 60)
        print("AI-GENERATED VERDIX REPORT")
        print("=" * 60)
        print(result["response"])
        print("=" * 60)
    else:
        print("\nERROR:")
        print(result)


if __name__ == "__main__":
    main()