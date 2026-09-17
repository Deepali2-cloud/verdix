"""
VERDIX Completeness Evaluation Engine.

ARCHITECTURAL INVARIANT
-----------------------
All completeness evaluation is computed locally inside the organization's enclave.
Raw dataset records, raw cell values, individual row contents, and PII NEVER leave
this enclave.

Two result structures are generated:
  - CompletenessLocalResult:
      Retained internally. Contains per-column details (column names, missing counts).
  - CompletenessExportResult:
      Safe aggregate-only result for transmission to privacy engines and cloud.
      Strips all column names and enforces raw_records_transferred == 0.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Union

from verdix_agent.profiler.csv_profiler import CsvProfiler, LocalProfile


@dataclass
class CompletenessThresholds:
    """
    Configurable status rating thresholds for dataset completeness.

    Default bands:
      95.00 – 100.00% -> EXCELLENT
      90.00 –  94.99% -> GOOD
      75.00 –  89.99% -> FAIR
      Below    75.00% -> POOR
    """
    excellent: float = 95.0
    good: float = 90.0
    fair: float = 75.0

    def evaluate_status(self, score: float) -> str:
        """Map a completeness score (0-100) to a qualitative status."""
        if score >= self.excellent:
            return "EXCELLENT"
        elif score >= self.good:
            return "GOOD"
        elif score >= self.fair:
            return "FAIR"
        else:
            return "POOR"


@dataclass
class ColumnMissingDetail:
    """
    Internal record of missing data for a single column.
    Remains strictly inside the enclave; never included in ExportResult.
    """
    name: str
    missing_count: int
    missing_rate: float
    total_count: int


@dataclass
class CompletenessLocalResult:
    """
    Complete internal completeness evaluation result.
    Remains inside the local enclave.
    """
    completeness_score: float
    missing_rate: float
    missing_cells: int
    total_cells: int
    affected_column_count: int
    status: str
    affected_columns: List[ColumnMissingDetail] = field(default_factory=list)
    highest_missing_rate_column: Optional[str] = None
    highest_missing_rate: float = 0.0
    row_count: int = 0
    column_count: int = 0

    def to_safe_dict(self) -> Dict[str, Any]:
        """Human-readable dictionary for local inspection."""
        return {
            "row_count": self.row_count,
            "column_count": self.column_count,
            "completeness_score": round(self.completeness_score, 4),
            "missing_rate": round(self.missing_rate, 4),
            "missing_cells": self.missing_cells,
            "total_cells": self.total_cells,
            "affected_column_count": self.affected_column_count,
            "status": self.status,
            "highest_missing_rate_column": self.highest_missing_rate_column,
            "highest_missing_rate": round(self.highest_missing_rate, 4),
            "affected_columns": [
                {
                    "name": col.name,
                    "missing_count": col.missing_count,
                    "missing_rate": round(col.missing_rate, 4),
                    "total_count": col.total_count,
                }
                for col in self.affected_columns
            ],
        }


@dataclass
class CompletenessExportResult:
    """
    Aggregate-only result safe for transmission to the cloud.

    Invariants enforced:
      - raw_records_transferred is ALWAYS 0
      - No column names
      - No raw records, cell values, or sample rows
    """
    completeness_score: float
    missing_rate: float
    missing_cells: int
    total_cells: int
    affected_column_count: int
    status: str
    raw_records_transferred: int = 0

    def to_dict(self) -> Dict[str, Any]:
        """Safe dictionary representation with only numerical/aggregate values."""
        return {
            "completeness_score": round(self.completeness_score, 2),
            "missing_rate": round(self.missing_rate, 2),
            "missing_cells": self.missing_cells,
            "total_cells": self.total_cells,
            "affected_column_count": self.affected_column_count,
            "status": self.status,
            "raw_records_transferred": self.raw_records_transferred,
        }


class CompletenessEngine:
    """
    Local Completeness Evaluation Engine.

    Consumes either a pre-computed Step 8A LocalProfile or a raw CSV path,
    calculates completeness metrics and status ratings, and produces both
    enclave-internal and export-safe results.
    """

    def __init__(self, thresholds: Optional[CompletenessThresholds] = None) -> None:
        self.thresholds = thresholds or CompletenessThresholds()

    def evaluate_profile(
        self, profile: LocalProfile
    ) -> Tuple[CompletenessLocalResult, CompletenessExportResult]:
        """
        Evaluate completeness from an existing Step 8A LocalProfile.
        Avoids redundant disk I/O and parsing.
        """
        row_count = profile.row_count
        column_count = profile.column_count
        total_cells = row_count * column_count
        missing_cells = profile.overall_missing_count

        missing_rate = (missing_cells / total_cells * 100.0) if total_cells > 0 else 0.0
        completeness_score = max(0.0, 100.0 - missing_rate)

        # Inspect affected columns (internal only)
        affected_columns: List[ColumnMissingDetail] = []
        for col in profile.columns:
            if col.missing_count > 0:
                affected_columns.append(
                    ColumnMissingDetail(
                        name=col.name,
                        missing_count=col.missing_count,
                        missing_rate=col.missing_pct,
                        total_count=col.total_count,
                    )
                )

        affected_column_count = len(affected_columns)

        highest_col_name: Optional[str] = None
        highest_col_rate: float = 0.0
        if affected_columns:
            highest = max(affected_columns, key=lambda c: (c.missing_rate, c.missing_count))
            highest_col_name = highest.name
            highest_col_rate = highest.missing_rate

        status = self.thresholds.evaluate_status(completeness_score)

        local_result = CompletenessLocalResult(
            completeness_score=completeness_score,
            missing_rate=missing_rate,
            missing_cells=missing_cells,
            total_cells=total_cells,
            affected_column_count=affected_column_count,
            status=status,
            affected_columns=affected_columns,
            highest_missing_rate_column=highest_col_name,
            highest_missing_rate=highest_col_rate,
            row_count=row_count,
            column_count=column_count,
        )

        export_result = CompletenessExportResult(
            completeness_score=completeness_score,
            missing_rate=missing_rate,
            missing_cells=missing_cells,
            total_cells=total_cells,
            affected_column_count=affected_column_count,
            status=status,
            raw_records_transferred=0,  # Invariant: ALWAYS 0
        )

        return local_result, export_result

    def evaluate_csv(
        self, csv_path: str
    ) -> Tuple[CompletenessLocalResult, CompletenessExportResult]:
        """Profile a CSV file and evaluate its completeness."""
        profiler = CsvProfiler(csv_path)
        local_profile, _ = profiler.profile()
        return self.evaluate_profile(local_profile)

    def evaluate(
        self, target: Union[str, LocalProfile]
    ) -> Tuple[CompletenessLocalResult, CompletenessExportResult]:
        """Unified entry point accepting either a CSV path or a LocalProfile."""
        if isinstance(target, str):
            return self.evaluate_csv(target)
        return self.evaluate_profile(target)
