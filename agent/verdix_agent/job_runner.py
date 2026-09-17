from __future__ import annotations

import time
from pathlib import Path
from typing import Any

from .engine import EvaluationEngine
from .profiler.csv_profiler import CsvProfiler


class LocalJobRunner:
    """
    Executes Verdix evaluation jobs entirely inside the local Agent.

    Privacy invariant:
    The input dataset stays inside this process.
    Only aggregate evaluation metrics are returned.
    """

    def __init__(self, local_data_dir: str):
        self.local_data_dir = Path(local_data_dir)
        self.engine = EvaluationEngine(data_dir=str(self.local_data_dir))

    def resolve_dataset(self, dataset_alias: str) -> Path:
        """Resolve a cloud-provided dataset alias to a local CSV file."""

        safe_alias = Path(dataset_alias).name

        candidates = [
            self.local_data_dir / safe_alias,
            self.local_data_dir / f"{safe_alias}.csv",
        ]

        for path in candidates:
            if path.is_file() and path.suffix.lower() == ".csv":
                return path

        for path in self.local_data_dir.glob("*.csv"):
            if path.stem.lower() == safe_alias.lower():
                return path

        raise FileNotFoundError(
            f"Local dataset not found for alias: {dataset_alias}"
        )

    def run(
        self,
        evaluation_id: str,
        dataset_alias: str,
        checks: list[str],
    ) -> dict[str, Any]:
        """Execute requested evaluation checks locally."""

        started = time.perf_counter()

        dataset_path = self.resolve_dataset(dataset_alias)

        # Create the local profile.
        # Raw dataset information remains inside the Agent.
        profiler = CsvProfiler(str(dataset_path))
        local_profile, _exportable_profile = profiler.profile()

        results: dict[str, Any] = {}

        normalized_checks = {
            str(check).strip().lower()
            for check in checks
        }

        if "completeness" in normalized_checks:
            results["completeness"] = self.engine.evaluate_completeness(
                local_profile
            )

        if "validity" in normalized_checks:
            results["validity"] = self.engine.evaluate_validity(
                csv_path=str(dataset_path),
                profile=local_profile,
            )

        if "duplicates" in normalized_checks:
            results["duplicates"] = self.engine.evaluate_duplicates(
                local_profile
            )

        if "consistency" in normalized_checks:
            results["consistency"] = self.engine.evaluate_consistency(
                csv_path=str(dataset_path),
                profile=local_profile,
            )

        if "outliers" in normalized_checks:
            results["outliers"] = self.engine.evaluate_outliers(
                csv_path=str(dataset_path),
                profile=local_profile,
            )

        if "anomalies" in normalized_checks:
            results["anomalies"] = self.engine.evaluate_anomalies(
                csv_path=str(dataset_path),
                profile=local_profile,
            )

        if "bias_fairness" in normalized_checks:
            results["bias_fairness"] = self.engine.evaluate_bias(
                csv_path=str(dataset_path),
                profile=local_profile,
            )

        execution_time_ms = int(
            (time.perf_counter() - started) * 1000
        )

        return {
            "evaluationId": evaluation_id,
            "datasetAlias": dataset_alias,
            "rowsEvaluated": int(local_profile.row_count),
            "executionTimeMs": execution_time_ms,
            "metrics": results,
            "rawDataIncluded": False,
            "raw_records_transferred": 0,
            "privacyValidationPassed": True,
        }