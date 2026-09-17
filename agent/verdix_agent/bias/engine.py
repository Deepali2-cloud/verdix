"""
VERDIX Bias & Fairness Evaluation Engine.

ARCHITECTURAL INVARIANT
-----------------------
All bias and disparity computations execute strictly locally inside the enclave.
Raw demographic categories, sensitive attributes, individual records, cell values,
and PII are NEVER exported.
Only aggregate statistical disparity and fairness scores leave this module.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple, Union

from verdix_agent.profiler.csv_profiler import (
    CsvProfiler,
    LocalProfile,
    _try_float,
    _MISSING_SENTINELS,
)


@dataclass
class BiasThresholds:
    """
    Configurable threshold bands for demographic disparity rate.

    Default bands:
      <= 5.00% disparity   -> EXCELLENT
      <= 10.00% disparity  -> GOOD
      <= 20.00% disparity  -> FAIR
      > 20.00% disparity   -> POOR
    """
    excellent: float = 5.0
    good: float = 10.0
    fair: float = 20.0

    def evaluate_status(self, max_disparity_pct: float) -> str:
        if max_disparity_pct <= self.excellent:
            return "EXCELLENT"
        elif max_disparity_pct <= self.good:
            return "GOOD"
        elif max_disparity_pct <= self.fair:
            return "FAIR"
        else:
            return "POOR"


@dataclass
class BiasLocalResult:
    row_count: int
    groups_evaluated: int
    max_disparity: float
    fairness_score: float
    status: str

    def to_safe_dict(self) -> Dict[str, Any]:
        return {
            "row_count": self.row_count,
            "groups_evaluated": self.groups_evaluated,
            "max_disparity": round(self.max_disparity, 4),
            "fairness_score": round(self.fairness_score, 2),
            "status": self.status,
        }


@dataclass
class BiasExportResult:
    row_count: int
    groups_evaluated: int
    max_disparity: float
    fairness_score: float
    status: str
    raw_records_transferred: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "row_count": self.row_count,
            "groups_evaluated": self.groups_evaluated,
            "max_disparity": round(self.max_disparity, 4),
            "fairness_score": round(self.fairness_score, 2),
            "status": self.status,
            "raw_records_transferred": self.raw_records_transferred,
        }


class BiasEngine:
    """
    Demographic-parity style Local Bias and Fairness Evaluation Engine.
    Executes in-enclave without exposing sensitive individual attributes.
    """

    def __init__(
        self,
        thresholds: Optional[BiasThresholds] = None,
        min_group_size: int = 3,
    ) -> None:
        self.thresholds = thresholds or BiasThresholds()
        self.min_group_size = min_group_size

    def evaluate(
        self,
        csv_path: str,
        profile: Optional[LocalProfile] = None,
        sensitive_col: Optional[str] = None,
        target_col: Optional[str] = None,
    ) -> Tuple[BiasLocalResult, BiasExportResult]:
        profiler = CsvProfiler(csv_path)
        if profile is None:
            profile, _ = profiler.profile()

        raw_rows, headers, _ = profiler._read_csv_safely()
        row_count = len(raw_rows)

        if not headers:
            raise ValueError(f"VERDIX Bias Engine: Empty CSV file: '{csv_path}'")

        header_map = {h.lower(): idx for idx, h in enumerate(headers)}
        canonical_headers = {idx: h for idx, h in enumerate(headers)}

        # Auto-detect sensitive/demographic grouping column if not explicitly supplied
        if sensitive_col is None:
            demographic_candidates = [
                "gender", "sex", "race", "ethnicity", "age_group", "city", "region",
                "department", "group", "category"
            ]
            for candidate in demographic_candidates:
                if candidate in header_map:
                    sensitive_col = canonical_headers[header_map[candidate]]
                    break

            if sensitive_col is None:
                # Look for categorical column with 2-10 unique values
                for col in profile.columns:
                    if col.inferred_dtype in ("categorical", "boolean") and 2 <= col.unique_count <= 10:
                        sensitive_col = col.name
                        break

        # Auto-detect outcome / target column if not explicitly supplied
        if target_col is None:
            outcome_candidates = [
                "approved", "is_premium", "hired", "promoted", "target",
                "outcome", "passed", "admitted", "label"
            ]
            for candidate in outcome_candidates:
                if candidate in header_map:
                    target_col = canonical_headers[header_map[candidate]]
                    break

            if target_col is None:
                # Look for boolean column or binary indicator
                for col in profile.columns:
                    if col.inferred_dtype == "boolean" and col.name != sensitive_col:
                        target_col = col.name
                        break

        # If we cannot identify both grouping and outcome columns, return INSUFFICIENT_DATA
        if sensitive_col is None or target_col is None:
            return self._build_result(row_count, 0, 0.0, 100.0, "INSUFFICIENT_DATA")

        sens_idx = None
        target_idx = None
        for idx, h in enumerate(headers):
            if h == sensitive_col:
                sens_idx = idx
            if h == target_col:
                target_idx = idx

        if sens_idx is None or target_idx is None:
            return self._build_result(row_count, 0, 0.0, 100.0, "INSUFFICIENT_DATA")

        # Group data safely locally without storing identifiers
        # Map group_val -> { "total": int, "positive": int }
        group_counts: Dict[str, Dict[str, int]] = {}

        for row in raw_rows:
            if sens_idx >= len(row) or target_idx >= len(row):
                continue
            s_val = row[sens_idx].strip()
            t_val = row[target_idx].strip().lower()

            if not s_val or s_val.lower() in _MISSING_SENTINELS:
                continue
            if not t_val or t_val in _MISSING_SENTINELS:
                continue

            if s_val not in group_counts:
                group_counts[s_val] = {"total": 0, "positive": 0}

            group_counts[s_val]["total"] += 1
            # Positive outcome detection: 'true', '1', 'yes', 'approved', 'pass'
            if t_val in ("true", "1", "yes", "approved", "pass", "t", "y"):
                group_counts[s_val]["positive"] += 1

        # Check minimum group size protection
        valid_groups = [
            g for g, counts in group_counts.items()
            if counts["total"] >= self.min_group_size
        ]

        if len(valid_groups) < 2:
            return self._build_result(row_count, len(valid_groups), 0.0, 100.0, "INSUFFICIENT_DATA")

        rates = [
            group_counts[g]["positive"] / group_counts[g]["total"]
            for g in valid_groups
        ]

        max_rate = max(rates)
        min_rate = min(rates)
        max_disparity = max_rate - min_rate
        disparity_pct = max_disparity * 100.0
        fairness_score = max(0.0, min(100.0, 100.0 - disparity_pct))
        status = self.thresholds.evaluate_status(disparity_pct)

        return self._build_result(
            row_count=row_count,
            groups_evaluated=len(valid_groups),
            max_disparity=max_disparity,
            fairness_score=fairness_score,
            status=status,
        )

    def _build_result(
        self,
        row_count: int,
        groups_evaluated: int,
        max_disparity: float,
        fairness_score: float,
        status: str,
    ) -> Tuple[BiasLocalResult, BiasExportResult]:
        local_res = BiasLocalResult(
            row_count=row_count,
            groups_evaluated=groups_evaluated,
            max_disparity=max_disparity,
            fairness_score=fairness_score,
            status=status,
        )
        export_res = BiasExportResult(
            row_count=row_count,
            groups_evaluated=groups_evaluated,
            max_disparity=max_disparity,
            fairness_score=fairness_score,
            status=status,
            raw_records_transferred=0,
        )
        return local_res, export_res
