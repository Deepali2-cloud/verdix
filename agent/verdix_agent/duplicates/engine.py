"""
VERDIX Duplicate Evaluation Engine.

ARCHITECTURAL INVARIANT
-----------------------
All duplicate detection runs locally inside the organization's enclave.
Raw records, row contents, cell values, and PII NEVER leave this module.

Semantic Rule:
A row is considered a duplicate only when the COMPLETE ROW matches another
row across all columns exactly. Individual repeated field values (names,
emails, IDs) do not constitute duplicate rows unless the entire record is identical.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple, Union

from verdix_agent.profiler.csv_profiler import CsvProfiler, LocalProfile


@dataclass
class DuplicateThresholds:
    """
    Configurable status rating thresholds for duplicate row percentage.

    Default bands:
      0.00%                -> EXCELLENT (no duplicates)
      > 0.00% and <= 2.00% -> GOOD
      > 2.00% and <= 5.00% -> FAIR
      > 5.00%              -> POOR
    """
    excellent: float = 0.0
    good: float = 2.0
    fair: float = 5.0

    def evaluate_status(self, duplicate_rate: float) -> str:
        """Map a duplicate rate percentage to a qualitative status."""
        if duplicate_rate <= self.excellent:
            return "EXCELLENT"
        elif duplicate_rate <= self.good:
            return "GOOD"
        elif duplicate_rate <= self.fair:
            return "FAIR"
        else:
            return "POOR"


@dataclass
class DuplicateGroupDetail:
    """
    Internal diagnostic details of a duplicate group.
    Contains group identifier, occurrence count, and row indices.
    Never contains raw row contents or cell values.
    """
    group_id: int
    occurrence_count: int
    row_indices: List[int] = field(default_factory=list)


@dataclass
class DuplicateLocalResult:
    """
    Complete internal duplicate evaluation result.
    Remains strictly within the local enclave.
    """
    row_count: int
    unique_row_count: int
    duplicate_row_count: int
    duplicate_rate: float
    duplicate_group_count: int
    status: str
    duplicate_groups: List[DuplicateGroupDetail] = field(default_factory=list)
    duplicate_row_indices: List[int] = field(default_factory=list)

    def to_safe_dict(self) -> Dict[str, Any]:
        """Human-readable dictionary for internal enclave inspection."""
        return {
            "row_count": self.row_count,
            "unique_row_count": self.unique_row_count,
            "duplicate_row_count": self.duplicate_row_count,
            "duplicate_rate": round(self.duplicate_rate, 4),
            "duplicate_group_count": self.duplicate_group_count,
            "status": self.status,
            "duplicate_groups": [
                {
                    "group_id": g.group_id,
                    "occurrence_count": g.occurrence_count,
                    "row_indices": g.row_indices,
                }
                for g in self.duplicate_groups
            ],
            "duplicate_row_indices": self.duplicate_row_indices,
        }


@dataclass
class DuplicateExportResult:
    """
    Safe aggregate-only export result for cloud transmission.

    Invariants enforced:
      - raw_records_transferred is strictly 0
      - No column names
      - No raw records, cell values, or sample rows
      - No individual row contents exposed
    """
    row_count: int
    unique_row_count: int
    duplicate_row_count: int
    duplicate_rate: float
    duplicate_group_count: int
    status: str
    raw_records_transferred: int = 0

    def to_dict(self) -> Dict[str, Any]:
        """Safe dictionary representation with only numerical/aggregate values."""
        return {
            "row_count": self.row_count,
            "unique_row_count": self.unique_row_count,
            "duplicate_row_count": self.duplicate_row_count,
            "duplicate_rate": round(self.duplicate_rate, 2),
            "duplicate_group_count": self.duplicate_group_count,
            "status": self.status,
            "raw_records_transferred": self.raw_records_transferred,
        }


class DuplicateEngine:
    """
    Local Duplicate Evaluation Engine.

    Detects exact full-row duplicates, counts unique rows and duplicate groups,
    and produces local diagnostics and export-safe aggregates.
    """

    def __init__(self, thresholds: Optional[DuplicateThresholds] = None) -> None:
        self.thresholds = thresholds or DuplicateThresholds()

    def evaluate_csv(
        self, csv_path: str
    ) -> Tuple[DuplicateLocalResult, DuplicateExportResult]:
        """
        Evaluate duplicates for a local CSV file.
        Uses CsvProfiler to safely read and normalize CSV rows locally.
        """
        profiler = CsvProfiler(csv_path)
        raw_rows, headers, _ = profiler._read_csv_safely()

        if not headers:
            raise ValueError(
                f"VERDIX Duplicate Engine: CSV file is empty or has no header row: '{csv_path}'"
            )

        row_count = len(raw_rows)

        # Track row patterns and their 0-indexed row occurrences
        row_occurrences: Dict[Tuple[str, ...], List[int]] = {}
        for row_idx, row in enumerate(raw_rows):
            key = tuple(cell.strip() for cell in row)
            if key not in row_occurrences:
                row_occurrences[key] = []
            row_occurrences[key].append(row_idx)

        unique_row_count = len(row_occurrences)
        duplicate_groups: List[DuplicateGroupDetail] = []
        duplicate_row_indices: List[int] = []
        duplicate_row_count = 0

        group_id = 1
        for occurrences in row_occurrences.values():
            count = len(occurrences)
            if count > 1:
                duplicate_row_count += (count - 1)
                # The first occurrence is considered original; subsequent are duplicates
                duplicate_row_indices.extend(occurrences[1:])
                duplicate_groups.append(
                    DuplicateGroupDetail(
                        group_id=group_id,
                        occurrence_count=count,
                        row_indices=occurrences,
                    )
                )
                group_id += 1

        duplicate_row_indices.sort()
        duplicate_group_count = len(duplicate_groups)

        duplicate_rate = (
            (duplicate_row_count / row_count * 100.0) if row_count > 0 else 0.0
        )
        status = self.thresholds.evaluate_status(duplicate_rate)

        local_result = DuplicateLocalResult(
            row_count=row_count,
            unique_row_count=unique_row_count,
            duplicate_row_count=duplicate_row_count,
            duplicate_rate=duplicate_rate,
            duplicate_group_count=duplicate_group_count,
            status=status,
            duplicate_groups=duplicate_groups,
            duplicate_row_indices=duplicate_row_indices,
        )

        export_result = DuplicateExportResult(
            row_count=row_count,
            unique_row_count=unique_row_count,
            duplicate_row_count=duplicate_row_count,
            duplicate_rate=duplicate_rate,
            duplicate_group_count=duplicate_group_count,
            status=status,
            raw_records_transferred=0,  # Invariant: ALWAYS 0
        )

        return local_result, export_result

    def evaluate_profile(
        self, profile: LocalProfile
    ) -> Tuple[DuplicateLocalResult, DuplicateExportResult]:
        """
        Evaluate duplicates given an existing LocalProfile.
        If the source CSV is available on disk, reads row occurrences for detailed grouping;
        otherwise relies on precomputed profile duplicate metrics.
        """
        if profile.csv_path:
            try:
                return self.evaluate_csv(profile.csv_path)
            except Exception:
                pass

        # Fallback to precomputed profile counts
        row_count = profile.row_count
        duplicate_row_count = profile.duplicate_row_count
        unique_row_count = max(0, row_count - duplicate_row_count)
        duplicate_rate = profile.duplicate_row_pct
        status = self.thresholds.evaluate_status(duplicate_rate)
        duplicate_group_count = 1 if duplicate_row_count > 0 else 0

        local_result = DuplicateLocalResult(
            row_count=row_count,
            unique_row_count=unique_row_count,
            duplicate_row_count=duplicate_row_count,
            duplicate_rate=duplicate_rate,
            duplicate_group_count=duplicate_group_count,
            status=status,
        )

        export_result = DuplicateExportResult(
            row_count=row_count,
            unique_row_count=unique_row_count,
            duplicate_row_count=duplicate_row_count,
            duplicate_rate=duplicate_rate,
            duplicate_group_count=duplicate_group_count,
            status=status,
            raw_records_transferred=0,
        )

        return local_result, export_result

    def evaluate(
        self, target: Union[str, LocalProfile]
    ) -> Tuple[DuplicateLocalResult, DuplicateExportResult]:
        """Unified entry point accepting either a CSV path or a LocalProfile."""
        if isinstance(target, str):
            return self.evaluate_csv(target)
        return self.evaluate_profile(target)
