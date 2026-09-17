import sys
import os
import argparse
import json

# Ensure agent directory is on sys.path for direct script execution
_agent_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if _agent_dir not in sys.path:
    sys.path.insert(0, _agent_dir)

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

from verdix_agent.config import AgentConfig
from verdix_agent.engine import EvaluationEngine, HAS_PANDAS
from verdix_agent.policy import PrivacyGuardrail, PrivacyPolicyViolation
from verdix_agent.client import CloudClient
from verdix_agent.profiler.csv_profiler import CsvProfiler

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
        "raw_records_transferred": 0,
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
    print(json.dumps(aggregates, indent=2))
    return 0

def run_profile(csv_path: str) -> int:
    try:
        profiler = CsvProfiler(csv_path)
        _, exportable = profiler.profile()
    except FileNotFoundError as err:
        print(f"Error: {err}", file=sys.stderr)
        return 1
    except ValueError as err:
        print(f"Error: {err}", file=sys.stderr)
        return 1
    except Exception as err:
        print(f"Error profiling dataset: {err}", file=sys.stderr)
        return 1

    print("VERDIX LOCAL DATA PROFILE")
    try:
        print("─────────────────────────")
    except UnicodeEncodeError:
        print("-------------------------")
    print(f"Rows:              {exportable.row_count}")
    print(f"Columns:           {exportable.column_count}")
    print(f"Missing rate:      {exportable.missing_rate:.2f}%")
    print(f"Duplicate rate:    {exportable.duplicate_rate:.2f}%")
    print(f"Completeness:      {exportable.completeness_score:.2f}%")
    print(f"Raw records sent:  {exportable.raw_records_transferred}")
    print()
    print("Column types:")
    print(f"  Numeric: {exportable.numeric_column_count}")
    print(f"  Categorical: {exportable.categorical_column_count}")
    print(f"  Boolean: {exportable.boolean_column_count}")
    return 0

def run_completeness(csv_path: str) -> int:
    try:
        from verdix_agent.completeness.engine import CompletenessEngine
        engine = CompletenessEngine()
        local_res, export_res = engine.evaluate(csv_path)
    except FileNotFoundError as err:
        print(f"Error: {err}", file=sys.stderr)
        return 1
    except ValueError as err:
        print(f"Error: {err}", file=sys.stderr)
        return 1
    except Exception as err:
        print(f"Error evaluating completeness: {err}", file=sys.stderr)
        return 1

    print("VERDIX COMPLETENESS EVALUATION")
    try:
        print("──────────────────────────────")
    except UnicodeEncodeError:
        print("------------------------------")
    print(f"Rows:                  {local_res.row_count}")
    print(f"Total cells:           {export_res.total_cells}")
    print(f"Missing cells:         {export_res.missing_cells}")
    print(f"Missing rate:          {export_res.missing_rate:.2f}%")
    print(f"Completeness score:    {export_res.completeness_score:.2f}%")
    print(f"Status:                {export_res.status}")
    print(f"Raw records sent:      {export_res.raw_records_transferred}")
    return 0

def run_validity(csv_path: str) -> int:
    try:
        from verdix_agent.validity.engine import ValidityEngine
        engine = ValidityEngine()
        local_res, export_res = engine.evaluate(csv_path)
    except FileNotFoundError as err:
        print(f"Error: {err}", file=sys.stderr)
        return 1
    except ValueError as err:
        print(f"Error: {err}", file=sys.stderr)
        return 1
    except Exception as err:
        print(f"Error evaluating validity: {err}", file=sys.stderr)
        return 1

    print("VERDIX VALIDITY EVALUATION")
    try:
        print("──────────────────────────")
    except UnicodeEncodeError:
        print("--------------------------")
    print(f"Rows:                  {local_res.row_count}")
    print(f"Values checked:        {export_res.total_values_checked}")
    print(f"Invalid values:        {export_res.invalid_value_count}")
    print(f"Invalid rate:          {export_res.invalid_rate:.2f}%")
    print(f"Validity score:        {export_res.validity_score:.2f}%")
    print(f"Status:                {export_res.status}")
    print(f"Raw records sent:      {export_res.raw_records_transferred}")
    return 0

def run_duplicates(csv_path: str) -> int:
    try:
        from verdix_agent.duplicates.engine import DuplicateEngine
        engine = DuplicateEngine()
        local_res, export_res = engine.evaluate(csv_path)
    except FileNotFoundError as err:
        print(f"Error: {err}", file=sys.stderr)
        return 1
    except ValueError as err:
        print(f"Error: {err}", file=sys.stderr)
        return 1
    except Exception as err:
        print(f"Error evaluating duplicates: {err}", file=sys.stderr)
        return 1

    print("VERDIX DUPLICATE EVALUATION")
    try:
        print("───────────────────────────")
    except UnicodeEncodeError:
        print("---------------------------")
    print(f"Rows:                  {local_res.row_count}")
    print(f"Unique rows:           {export_res.unique_row_count}")
    print(f"Duplicate rows:        {export_res.duplicate_row_count}")
    print(f"Duplicate rate:        {export_res.duplicate_rate:.2f}%")
    print(f"Duplicate groups:      {export_res.duplicate_group_count}")
    print(f"Status:                {export_res.status}")
    print(f"Raw records sent:      {export_res.raw_records_transferred}")
    return 0

def run_consistency(csv_path: str) -> int:
    try:
        from verdix_agent.consistency.engine import ConsistencyEngine
        engine = ConsistencyEngine()
        local_res, export_res = engine.evaluate(csv_path)
    except FileNotFoundError as err:
        print(f"Error: {err}", file=sys.stderr)
        return 1
    except ValueError as err:
        print(f"Error: {err}", file=sys.stderr)
        return 1
    except Exception as err:
        print(f"Error evaluating consistency: {err}", file=sys.stderr)
        return 1

    print("VERDIX CONSISTENCY EVALUATION")
    try:
        print("─────────────────────────────")
    except UnicodeEncodeError:
        print("-----------------------------")
    print(f"Rows:                  {local_res.row_count}")
    print(f"Values checked:        {export_res.values_checked}")
    print(f"Inconsistent values:   {export_res.inconsistent_count}")
    print(f"Inconsistency rate:    {export_res.inconsistency_rate:.2f}%")
    print(f"Consistency score:     {export_res.consistency_score:.2f}%")
    print(f"Affected rules:        {export_res.affected_rule_count}")
    print(f"Status:                {export_res.status}")
    print(f"Raw records sent:      {export_res.raw_records_transferred}")
    return 0

def run_outliers(csv_path: str) -> int:
    try:
        from verdix_agent.outliers.engine import OutlierEngine
        engine = OutlierEngine()
        local_res, export_res = engine.evaluate(csv_path)
    except Exception as err:
        print(f"Error evaluating outliers: {err}", file=sys.stderr)
        return 1

    print("VERDIX OUTLIER EVALUATION")
    try:
        print("─────────────────────────")
    except UnicodeEncodeError:
        print("-------------------------")
    print(f"Rows:                  {local_res.row_count}")
    print(f"Outlier count:         {export_res.outlier_count}")
    print(f"Outlier rate:          {export_res.outlier_rate:.2f}%")
    print(f"Affected columns:      {export_res.affected_column_count}")
    print(f"Status:                {export_res.status}")
    print(f"Raw records sent:      {export_res.raw_records_transferred}")
    return 0

def run_anomalies(csv_path: str) -> int:
    try:
        from verdix_agent.anomalies.engine import AnomalyEngine
        engine = AnomalyEngine()
        local_res, export_res = engine.evaluate(csv_path)
    except Exception as err:
        print(f"Error evaluating anomalies: {err}", file=sys.stderr)
        return 1

    print("VERDIX ANOMALY EVALUATION")
    try:
        print("─────────────────────────")
    except UnicodeEncodeError:
        print("-------------------------")
    print(f"Rows:                  {local_res.row_count}")
    print(f"Anomaly count:         {export_res.anomaly_count}")
    print(f"Anomaly rate:          {export_res.anomaly_rate:.2f}%")
    print(f"Status:                {export_res.status}")
    print(f"Raw records sent:      {export_res.raw_records_transferred}")
    return 0

def run_bias(csv_path: str) -> int:
    try:
        from verdix_agent.bias.engine import BiasEngine
        engine = BiasEngine()
        local_res, export_res = engine.evaluate(csv_path)
    except Exception as err:
        print(f"Error evaluating bias: {err}", file=sys.stderr)
        return 1

    print("VERDIX BIAS & FAIRNESS EVALUATION")
    try:
        print("─────────────────────────────────")
    except UnicodeEncodeError:
        print("---------------------------------")
    print(f"Rows:                  {local_res.row_count}")
    print(f"Groups evaluated:      {export_res.groups_evaluated}")
    print(f"Max disparity:         {export_res.max_disparity:.4f}")
    print(f"Fairness score:        {export_res.fairness_score:.2f}%")
    print(f"Status:                {export_res.status}")
    print(f"Raw records sent:      {export_res.raw_records_transferred}")
    return 0

def run_evaluate(csv_path: str, json_output: bool = False) -> int:
    try:
        engine = EvaluationEngine()
        result = engine.run_full_evaluation(csv_path)
    except FileNotFoundError as err:
        print(f"Error: {err}", file=sys.stderr)
        return 1
    except Exception as err:
        print(f"Error during evaluation: {err}", file=sys.stderr)
        return 1

    if json_output:
        print(json.dumps(result, indent=2))
        return 0

    print("=" * 60)
    print("VERDIX FULL PRIVACY-PRESERVING DATA EVALUATION")
    print("=" * 60)
    print(f"Dataset Alias:             {result['datasetAlias']}")
    print(f"Evaluation ID:             {result['evaluationId']}")
    print(f"Rows Evaluated:            {result['row_count']}")
    print(f"Execution Time:            {result['executionTimeMs']} ms")
    print("-" * 60)
    print("OVERALL HEALTH & PRIVACY STATUS:")
    print(f"  healthScore:             {result['healthScore']}%")
    print(f"  privacy_status:          {result['privacy_status']}")
    print(f"  raw_records_transferred: {result['raw_records_transferred']}")
    print("-" * 60)
    print("DETAILED ENGINE METRICS:")
    print(f"  Completeness Score:      {result['completeness']['completeness_score']:.2f}% ({result['completeness']['status']})")
    print(f"  Validity Score:          {result['validity']['validity_score']:.2f}% ({result['validity']['status']})")
    print(f"  Duplicate Rate:          {result['duplicates']['duplicate_rate']:.2f}% ({result['duplicates']['status']})")
    print(f"  Consistency Score:       {result['consistency']['consistency_score']:.2f}% ({result['consistency']['status']})")
    print(f"  Outlier Rate:            {result['outliers']['outlier_rate']:.2f}% ({result['outliers']['status']})")
    print(f"  Anomaly Rate:            {result['anomalies']['anomaly_rate']:.2f}% ({result['anomalies']['status']})")
    print(f"  Fairness Score:          {result['bias_fairness']['fairness_score']:.2f}% ({result['bias_fairness']['status']})")
    print("=" * 60)
    print("Summary JSON Result:")
    print(json.dumps({
        "healthScore": result["healthScore"],
        "raw_records_transferred": result["raw_records_transferred"],
        "privacy_status": result["privacy_status"],
        "rawDataIncluded": result["rawDataIncluded"],
        "summaryMetrics": result["summaryMetrics"],
    }, indent=2))
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

    subparsers = parser.add_subparsers(dest="command", help="Available subcommands")

    profile_parser = subparsers.add_parser("profile", help="Profile a local CSV file")
    profile_parser.add_argument("csv_path", help="Path to local CSV dataset file")

    completeness_parser = subparsers.add_parser(
        "completeness", help="Evaluate completeness of a local CSV file"
    )
    completeness_parser.add_argument("csv_path", help="Path to local CSV dataset file")

    validity_parser = subparsers.add_parser(
        "validity", help="Evaluate validity of a local CSV file"
    )
    validity_parser.add_argument("csv_path", help="Path to local CSV dataset file")

    duplicates_parser = subparsers.add_parser(
        "duplicates", help="Evaluate duplicate rows in a local CSV file"
    )
    duplicates_parser.add_argument("csv_path", help="Path to local CSV dataset file")

    consistency_parser = subparsers.add_parser(
        "consistency", help="Evaluate logical consistency in a local CSV file"
    )
    consistency_parser.add_argument("csv_path", help="Path to local CSV dataset file")

    outliers_parser = subparsers.add_parser(
        "outliers", help="Evaluate outliers in a local CSV file"
    )
    outliers_parser.add_argument("csv_path", help="Path to local CSV dataset file")

    anomalies_parser = subparsers.add_parser(
        "anomalies", help="Evaluate anomalies in a local CSV file"
    )
    anomalies_parser.add_argument("csv_path", help="Path to local CSV dataset file")

    bias_parser = subparsers.add_parser(
        "bias", help="Evaluate demographic disparity and bias in a local CSV file"
    )
    bias_parser.add_argument("csv_path", help="Path to local CSV dataset file")

    evaluate_parser = subparsers.add_parser(
        "evaluate", help="Execute full privacy-preserving evaluation on a local CSV file"
    )
    evaluate_parser.add_argument("csv_path", help="Path to local CSV dataset file")
    evaluate_parser.add_argument(
        "--json", action="store_true", help="Output only raw JSON results"
    )

    args = parser.parse_args()
    config = AgentConfig.from_env()

    if args.command == "profile":
        return run_profile(args.csv_path)
    elif args.command == "completeness":
        return run_completeness(args.csv_path)
    elif args.command == "validity":
        return run_validity(args.csv_path)
    elif args.command == "duplicates":
        return run_duplicates(args.csv_path)
    elif args.command == "consistency":
        return run_consistency(args.csv_path)
    elif args.command == "outliers":
        return run_outliers(args.csv_path)
    elif args.command == "anomalies":
        return run_anomalies(args.csv_path)
    elif args.command == "bias":
        return run_bias(args.csv_path)
    elif args.command == "evaluate":
        return run_evaluate(args.csv_path, getattr(args, "json", False))
    elif args.health_check:
        return check_health(config)
    elif args.test_eval:
        return run_test_eval(config)
    else:
        # Default action: run health check
        return check_health(config)

if __name__ == "__main__":
    sys.exit(main())
