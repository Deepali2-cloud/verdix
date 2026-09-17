"""
VERDIX Outliers Engine.

ARCHITECTURAL INVARIANT
-----------------------
All outlier computations execute locally inside the enclave.
Raw numeric values, cell values, and column names are NEVER exported.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple, Union

from verdix_agent.profiler.csv_profiler import CsvProfiler, LocalProfile, _try_float, _MISSING_SENTINELS


@dataclass
class OutlierThresholds:
    """
    Configurable status threshold bands for outlier rate.

    Default bands:
      0.00%                -> EXCELLENT
      > 0.00% and <= 2.00% -> GOOD
      > 2.00% and <= 5.00% -> FAIR
      > 5.00%              -> POOR
    """
    excellent: float = 0.0
    good: float = 2.0
    fair: float = 5.0

    def evaluate_status(self, outlier_rate: float) -> str:
        if outlier_rate <= self.excellent:
            return "EXCELLENT"
        elif outlier_rate <= self.good:
            return "GOOD"
        elif outlier_rate <= self.fair:
            return "FAIR"
        else:
            return "POOR"


@dataclass
class OutlierLocalResult:
    row_count: int
    numeric_values_checked: int
    outlier_count: int
    outlier_rate: float
    affected_column_count: int
    status: str

    def to_safe_dict(self) -> Dict[str, Any]:
        return {
            "row_count": self.row_count,
            "numeric_values_checked": self.numeric_values_checked,
            "outlier_count": self.outlier_count,
            "outlier_rate": round(self.outlier_rate, 4),
            "affected_column_count": self.affected_column_count,
            "status": self.status,
        }


@dataclass
class OutlierExportResult:
    row_count: int
    numeric_values_checked: int
    outlier_count: int
    outlier_rate: float
    affected_column_count: int
    status: str
    raw_records_transferred: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "row_count": self.row_count,
            "numeric_values_checked": self.numeric_values_checked,
            "outlier_count": self.outlier_count,
            "outlier_rate": round(self.outlier_rate, 2),
            "affected_column_count": self.affected_column_count,
            "status": self.status,
            "raw_records_transferred": self.raw_records_transferred,
        }


def _percentile(values: List[float], p: float) -> float:
    """Calculate percentile p (0-100) using linear interpolation."""
    if not values:
        return 0.0
    sorted_vals = sorted(values)
    n = len(sorted_vals)
    if n == 1:
        return sorted_vals[0]
    idx = (n - 1) * (p / 100.0)
    lower = math.floor(idx)
    upper = math.ceil(idx)
    weight = idx - lower
    return sorted_vals[lower] * (1.0 - weight) + sorted_vals[upper] * weight


class OutlierEngine:
    """
    IQR-based Local Outlier Detection Engine.
    """

    def __init__(self, thresholds: Optional[OutlierThresholds] = None) -> None:
        self.thresholds = thresholds or OutlierThresholds()

    def evaluate(
        self,
        csv_path: str,
        profile: Optional[LocalProfile] = None,
    ) -> Tuple[OutlierLocalResult, OutlierExportResult]:
        profiler = CsvProfiler(csv_path)
        if profile is None:
            profile, _ = profiler.profile()

        raw_rows, headers, _ = profiler._read_csv_safely()
        row_count = len(raw_rows)

        if not headers:
            raise ValueError(f"VERDIX Outlier Engine: Empty CSV file: '{csv_path}'")

        # Find numeric columns from profile
        numeric_col_names = [c.name for c in profile.columns if c.inferred_dtype == "numeric"]
        header_map = {h: idx for idx, h in enumerate(headers)}

        numeric_values_checked = 0
        total_outlier_count = 0
        affected_column_count = 0

        for col_name in numeric_col_names:
            if col_name not in header_map:
                continue
            idx = header_map[col_name]
            col_vals: List[float] = []

            for row in raw_rows:
                val_str = row[idx] if idx < len(row) else ""
                val_clean = val_str.strip()
                if val_clean and val_clean.lower() not in _MISSING_SENTINELS:
                    fval = _try_float(val_clean)
                    if fval is not None:
                        col_vals.append(fval)

            if len(col_vals) < 4:
                # Need at least 4 observations for meaningful IQR
                numeric_values_checked += len(col_vals)
                continue

            numeric_values_checked += len(col_vals)
            q1 = _percentile(col_vals, 25.0)
            q3 = _percentile(col_vals, 75.0)
            iqr = q3 - q1

            lower_bound = q1 - 1.5 * iqr
            upper_bound = q3 + 1.5 * iqr

            col_outliers = sum(1 for v in col_vals if v < lower_bound or v > upper_bound)
            if col_outliers > 0:
                affected_column_count += 1
                total_outlier_count += col_outliers

        if numeric_values_checked > 0:
            outlier_rate = (total_outlier_count / numeric_values_checked) * 100.0
        else:
            outlier_rate = 0.0

        status = self.thresholds.evaluate_status(outlier_rate)

        local_res = OutlierLocalResult(
            row_count=row_count,
            numeric_values_checked=numeric_values_checked,
            outlier_count=total_outlier_count,
            outlier_rate=outlier_rate,
            affected_column_count=affected_column_count,
            status=status,
        )

        export_res = OutlierExportResult(
            row_count=row_count,
            numeric_values_checked=numeric_values_checked,
            outlier_count=total_outlier_count,
            outlier_rate=outlier_rate,
            affected_column_count=affected_column_count,
            status=status,
            raw_records_transferred=0,
        )

        return local_res, export_res
