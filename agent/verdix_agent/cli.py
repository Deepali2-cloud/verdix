import sys
import os
import argparse

# Ensure agent directory is on sys.path for direct script execution
_agent_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if _agent_dir not in sys.path:
    sys.path.insert(0, _agent_dir)

from verdix_agent.config import AgentConfig
from verdix_agent.engine import EvaluationEngine, HAS_PANDAS
from verdix_agent.policy import PrivacyGuardrail, PrivacyPolicyViolation
from verdix_agent.client import CloudClient

def check_health(config: AgentConfig) -> int:
    print("=" * 60)
    print("VERDIX AGENT — LOCAL ENCLAVE HEALTH CHECK")
    print("=" * 60)
    print(f"Agent ID:           {config.agent_id}")
    print(f"Agent Name:         {config.agent_name}")
    print(f"Target Cloud URL:   {config.cloud_url}")
    print(f"Environment:        {config.environment}")
    print(f"Local Data Path:    {config.local_data_dir}")
    print(f"Max Export Rows:    {config.max_export_rows} (Invariant: strictly 0)")
    print(f"Pandas Engine:      {'Available' if HAS_PANDAS else 'Ready for installation (fallback active)'}")
    print("-" * 60)

    # Test policy guardrail invariant
    print("Testing Privacy Guardrail Invariant...")
    test_valid = {
        "jobId": "test-check",
        "agentId": config.agent_id,
        "datasetAlias": "test_dataset",
        "rawDataIncluded": False,
        "summaryMetrics": [
            {"metric": "count", "value": 100, "sampleSize": 100}
        ],
    }
    try:
        PrivacyGuardrail.validate_aggregate_output(test_valid)
        print("  [PASS] Aggregate result validation passed")
    except Exception as e:
        print(f"  [FAIL] Aggregate result validation failed: {e}")
        return 1

    # Verify that raw data inclusion is actively rejected
    test_invalid = {
        "jobId": "test-invalid",
        "rawDataIncluded": True,  # Violation!
        "summaryMetrics": []
    }
    try:
        PrivacyGuardrail.validate_aggregate_output(test_invalid)
        print("  [FAIL] Guardrail failed to reject rawDataIncluded=True")
        return 1
    except PrivacyPolicyViolation:
        print("  [PASS] Guardrail successfully blocked rawDataIncluded payload")

    # Test engine local computation scaffold
    print("Testing Local Evaluation Engine computation...")
    engine = EvaluationEngine(data_dir=config.local_data_dir)
    res = engine.compute_local_aggregates(
        job_id="health-eval-01",
        agent_id=config.agent_id,
        dataset_alias="local_test",
        target_columns=["metric_col_a", "metric_col_b"]
    )
    print(f"  [PASS] Successfully generated aggregate metrics (count: {len(res['summaryMetrics'])})")
    print("=" * 60)
    print("Result: VERDIX AGENT IS HEALTHY AND READY")
    print("=" * 60)
    return 0

def run_test_eval(config: AgentConfig) -> int:
    print(f"Executing test aggregate evaluation for agent {config.agent_id}...")
    engine = EvaluationEngine(data_dir=config.local_data_dir)
    aggregates = engine.compute_local_aggregates(
        job_id="manual-eval-run",
        agent_id=config.agent_id,
        dataset_alias="sample_evaluation",
        target_columns=["feature_1", "feature_2"],
    )
    print("Evaluation completed successfully.")
    print("Generated Payload (Note: Zero raw data included):")
    import json
    print(json.dumps(aggregates, indent=2))
    return 0

def main() -> int:
    parser = argparse.ArgumentParser(
        description="VERDIX Agent — Local Privacy-Preserving Evaluation Enclave"
    )
    parser.add_argument(
        "--health-check",
        action="store_true",
        help="Run diagnostic check on local agent environment, policy guardrails, and engine",
    )
    parser.add_argument(
        "--test-eval",
        action="store_true",
        help="Run a local test evaluation and display sanitized aggregate outputs",
    )
    parser.add_argument(
        "--version",
        action="version",
        version="Verdix Agent 0.1.0",
    )

    args = parser.parse_args()
    config = AgentConfig.from_env()

    if args.health_check:
        return check_health(config)
    elif args.test_eval:
        return run_test_eval(config)
    else:
        # Default action: run health check
        return check_health(config)

if __name__ == "__main__":
    sys.exit(main())
