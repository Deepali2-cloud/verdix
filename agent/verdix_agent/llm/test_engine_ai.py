import os
import sys

# Ensure the agent directory is on sys.path,
# matching the existing VERDIX CLI architecture.
AGENT_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..")
)

if AGENT_DIR not in sys.path:
    sys.path.insert(0, AGENT_DIR)

from verdix_agent.engine import EvaluationEngine


def main():
    print("=" * 70)
    print("VERDIX EVALUATION ENGINE + QWEN3")
    print("=" * 70)

    engine = EvaluationEngine()

    evaluation_result = {
        "jobId": "test-ai-001",
        "agentId": "agent-local-default",
        "datasetAlias": "student_records",
        "executionTimeMs": 125,
        "timestamp": "2026-09-17T00:00:00Z",
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
        "rawDataIncluded": False,
        "privacyValidationPassed": True,
    }

    print("\n1. Deterministic evaluation result created.")
    print("2. Privacy validation will run.")
    print("3. Sanitized metrics will be sent to Qwen3.")
    print("\nGenerating AI report...")
    print("(Qwen3 may take some time on your CPU.)")
    print()

    result = engine.generate_ai_report(evaluation_result)

    if result.get("success"):
        print("=" * 70)
        print("AI REPORT")
        print("=" * 70)
        print(result["response"])
        print("=" * 70)
        print("\nVERDIX AI integration: SUCCESS")
    else:
        print("\nVERDIX AI integration: FAILED")
        print(result)


if __name__ == "__main__":
    main()