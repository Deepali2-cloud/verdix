"""
VERDIX Anomaly Engine.

ARCHITECTURAL INVARIANT
-----------------------
All anomaly computations run locally inside the organization's enclave.
No raw anomaly values, row indexes, or column names leave this module.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

from verdix_agent.profiler.csv_profiler import CsvProfiler, LocalProfile, _try_float, _MISSING_SENTINELS


@dataclass
class AnomalyThresholds:
    """
    Configurable status threshold bands for anomaly rate.

    Default bands:
      0.00%                -> EXCELLENT
      > 0.00% and <= 1.00% -> GOOD
      > 1.00% and <= 3.00% -> FAIR
      > 3.00%              -> POOR
    """
    excellent: float = 0.0
    good: float = 1.0
    fair: float = 3.0

    def evaluate_status(self, anomaly_rate: float) -> str:
        if anomaly_rate <= self.excellent:
            return "EXCELLENT"
        elif anomaly_rate <= self.good:
            return "GOOD"
        elif anomaly_rate <= self.fair:
            return "FAIR"
        else:
            return "POOR"


@dataclass
class AnomalyLocalResult:
    row_count: int
    values_checked: int
    anomaly_count: int
    anomaly_rate: float
    status: str

    def to_safe_dict(self) -> Dict[str, Any]:
        return {
            "row_count": self.row_count,
            "values_checked": self.values_checked,
            "anomaly_count": self.anomaly_count,
            "anomaly_rate": round(self.anomaly_rate, 4),
            "status": self.status,
        }


@dataclass
class AnomalyExportResult:
    row_count: int
    values_checked: int
    anomaly_count: int
    anomaly_rate: float
    status: str
    raw_records_transferred: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "row_count": self.row_count,
            "values_checked": self.values_checked,
            "anomaly_count": self.anomaly_count,
            "anomaly_rate": round(self.anomaly_rate, 2),
            "status": self.status,
            "raw_records_transferred": self.raw_records_transferred,
        }


class AnomalyEngine:
    """
    Z-score-based Local Anomaly Detection Engine.
    """

    def __init__(
        self,
        thresholds: Optional[AnomalyThresholds] = None,
        z_threshold: float = 3.0,
    ) -> None:
        self.thresholds = thresholds or AnomalyThresholds()
        self.z_threshold = z_threshold

    def evaluate(
        self,
        csv_path: str,
        profile: Optional[LocalProfile] = None,
    ) -> Tuple[AnomalyLocalResult, AnomalyExportResult]:
        profiler = CsvProfiler(csv_path)
        if profile is None:
            profile, _ = profiler.profile()

        raw_rows, headers, _ = profiler._read_csv_safely()
        row_count = len(raw_rows)

        if not headers:
            raise ValueError(f"VERDIX Anomaly Engine: Empty CSV file: '{csv_path}'")

        numeric_col_names = [c.name for c in profile.columns if c.inferred_dtype == "numeric"]
        header_map = {h: idx for idx, h in enumerate(headers)}

        values_checked = 0
        total_anomalies = 0

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

            n = len(col_vals)
            if n < 4:
                values_checked += n
                continue

            values_checked += n
            mean_val = sum(col_vals) / n
            variance = sum((x - mean_val) ** 2 for x in col_vals) / (n - 1)
            std_dev = math.sqrt(variance)

            if std_dev > 1e-9:
                anomalies_in_col = sum(
                    1 for x in col_vals if abs(x - mean_val) / std_dev >= self.z_threshold
                )
                total_anomalies += anomalies_in_col

        if values_checked > 0:
            anomaly_rate = (total_anomalies / values_checked) * 100.0
        else:
            anomaly_rate = 0.0

        status = self.thresholds.evaluate_status(anomaly_rate)

        local_res = AnomalyLocalResult(
            row_count=row_count,
            values_checked=values_checked,
            anomaly_count=total_anomalies,
            anomaly_rate=anomaly_rate,
            status=status,
        )

        export_res = AnomalyExportResult(
            row_count=row_count,
            values_checked=values_checked,
            anomaly_count=total_anomalies,
            anomaly_rate=anomaly_rate,
            status=status,
            raw_records_transferred=0,
        )

        return local_res, export_res
