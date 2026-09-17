"""
VERDIX CSV Profiler — Local Dataset Profiling Engine.

ARCHITECTURAL INVARIANT
-----------------------
This module performs ALL computation locally inside the organization's environment.
Raw records, raw cell values, and individual PII field contents NEVER leave this module.

Two profile types are produced:
  - LocalProfile  : Full internal view. Stays inside the enclave.
  - ExportableProfile : Aggregate-only view. Safe to pass to the future privacy engine.
"""

from __future__ import annotations

import csv
import io
import math
import os
from dataclasses import dataclass, field, asdict
from typing import Any, Dict, List, Optional, Tuple


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass
class ColumnProfile:
    """
    Per-column local profile.
    Remains internal — never included in ExportableProfile.
    """
    name: str
    inferred_dtype: str                 # "numeric" | "boolean" | "categorical" | "empty"
    total_count: int
    missing_count: int
    missing_pct: float
    unique_count: int
    empty_string_count: int

    # Numeric-only (None for non-numeric)
    numeric_min: Optional[float] = None
    numeric_max: Optional[float] = None
    numeric_mean: Optional[float] = None
    numeric_std: Optional[float] = None

    # Categorical-only
    top_frequency: Optional[int] = None   # Count of the most frequent value

    def to_safe_dict(self) -> Dict[str, Any]:
        """
        Returns a safe dict with NO raw values — safe for aggregate reporting only.
        Column name IS included here; the privacy engine downstream decides
        whether column names are exported.
        """
        d: Dict[str, Any] = {
            "name": self.name,
            "dtype": self.inferred_dtype,
            "missing_count": self.missing_count,
            "missing_pct": round(self.missing_pct, 4),
            "unique_count": self.unique_count,
            "empty_string_count": self.empty_string_count,
        }
        if self.inferred_dtype == "numeric":
            d["numeric_min"] = self.numeric_min
            d["numeric_max"] = self.numeric_max
            d["numeric_mean"] = round(self.numeric_mean, 6) if self.numeric_mean is not None else None
            d["numeric_std"] = round(self.numeric_std, 6) if self.numeric_std is not None else None
        if self.inferred_dtype == "categorical":
            d["top_frequency"] = self.top_frequency
        return d


@dataclass
class LocalProfile:
    """
    Complete local-only dataset profile.
    Contains column-level details that may include column names.
    This object MUST NOT be exported to the cloud without policy approval.
    """
    csv_path: str
    row_count: int
    column_count: int
    duplicate_row_count: int
    duplicate_row_pct: float
    overall_missing_count: int
    overall_missing_pct: float
    completeness_score: float           # 0–100; 100 = no missing values
    columns: List[ColumnProfile] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)

    def numeric_column_count(self) -> int:
        return sum(1 for c in self.columns if c.inferred_dtype == "numeric")

    def categorical_column_count(self) -> int:
        return sum(1 for c in self.columns if c.inferred_dtype == "categorical")

    def boolean_column_count(self) -> int:
        return sum(1 for c in self.columns if c.inferred_dtype == "boolean")

    def to_safe_dict(self) -> Dict[str, Any]:
        """
        A human-readable dictionary.  Column names are present here because
        the LOCAL profile is enclave-internal only.  The ExportableProfile
        strips column names.
        """
        return {
            "csv_path": self.csv_path,
            "row_count": self.row_count,
            "column_count": self.column_count,
            "duplicate_row_count": self.duplicate_row_count,
            "duplicate_row_pct": round(self.duplicate_row_pct, 4),
            "overall_missing_count": self.overall_missing_count,
            "overall_missing_pct": round(self.overall_missing_pct, 4),
            "completeness_score": round(self.completeness_score, 4),
            "columns": [c.to_safe_dict() for c in self.columns],
            "errors": self.errors,
        }


@dataclass
class ExportableProfile:
    """
    Aggregate-only profile safe for transmission to the VERDIX cloud.

    Invariants enforced:
      - raw_records_transferred is always 0
      - No column names are included
      - No raw cell values are included
      - No unique-value lists are included
    """
    row_count: int
    column_count: int
    missing_rate: float                 # Percentage 0–100
    duplicate_rate: float               # Percentage 0–100
    completeness_score: float           # Percentage 0–100
    numeric_column_count: int
    categorical_column_count: int
    boolean_column_count: int
    raw_records_transferred: int = 0    # Invariant: ALWAYS 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "row_count": self.row_count,
            "column_count": self.column_count,
            "missing_rate": round(self.missing_rate, 4),
            "duplicate_rate": round(self.duplicate_rate, 4),
            "completeness_score": round(self.completeness_score, 4),
            "numeric_column_count": self.numeric_column_count,
            "categorical_column_count": self.categorical_column_count,
            "boolean_column_count": self.boolean_column_count,
            "raw_records_transferred": self.raw_records_transferred,
        }


# ---------------------------------------------------------------------------
# Type inference helpers
# ---------------------------------------------------------------------------

_BOOLEAN_VALUES = frozenset({"true", "false", "yes", "no", "1", "0", "t", "f", "y", "n"})
_MISSING_SENTINELS = frozenset({"", "null", "none", "na", "n/a", "nan", "#n/a", "missing"})


def _try_float(value: str) -> Optional[float]:
    """Try to parse a string as a float; return None on failure."""
    try:
        return float(value.replace(",", "").strip())
    except (ValueError, AttributeError):
        return None


def _infer_column_type(non_missing_values: List[str]) -> str:
    """
    Infer column type from a sample of non-missing string values.
    Returns one of: "numeric", "boolean", "categorical", "empty".
    """
    if not non_missing_values:
        return "empty"

    # Check boolean
    sample = [v.strip().lower() for v in non_missing_values[:200]]
    if all(v in _BOOLEAN_VALUES for v in sample):
        return "boolean"

    # Check numeric
    numeric_count = sum(1 for v in non_missing_values[:200] if _try_float(v) is not None)
    if len(non_missing_values[:200]) > 0 and numeric_count / len(non_missing_values[:200]) >= 0.9:
        return "numeric"

    return "categorical"


# ---------------------------------------------------------------------------
# Welford online statistics (avoids storing all values for large datasets)
# ---------------------------------------------------------------------------

class _WelfordStats:
    """Online mean / variance using Welford's algorithm (single pass, O(1) memory)."""

    def __init__(self) -> None:
        self.count = 0
        self.mean = 0.0
        self._M2 = 0.0
        self.min_val = math.inf
        self.max_val = -math.inf

    def update(self, x: float) -> None:
        self.count += 1
        delta = x - self.mean
        self.mean += delta / self.count
        delta2 = x - self.mean
        self._M2 += delta * delta2
        if x < self.min_val:
            self.min_val = x
        if x > self.max_val:
            self.max_val = x

    @property
    def std(self) -> float:
        if self.count < 2:
            return 0.0
        return math.sqrt(self._M2 / (self.count - 1))


# ---------------------------------------------------------------------------
# Main profiler
# ---------------------------------------------------------------------------

class CsvProfiler:
    """
    Reads a local CSV file and produces a LocalProfile and ExportableProfile.

    Usage:
        profiler = CsvProfiler("/path/to/data.csv")
        local, exportable = profiler.profile()

    The ExportableProfile contains only aggregate statistics and enforces
    raw_records_transferred == 0.

    Errors:
        FileNotFoundError    – file does not exist
        ValueError           – file is not a valid CSV / is empty
        UnicodeDecodeError   – encoding problem (falls back to latin-1)
    """

    _MISSING_SENTINELS = frozenset({"", "null", "none", "na", "n/a", "nan", "#n/a", "missing"})

    def __init__(self, csv_path: str, max_unique_track: int = 50_000) -> None:
        """
        Args:
            csv_path: Absolute or relative path to the CSV file.
            max_unique_track: Maximum number of unique values tracked per column
                              before switching to approximate counting.
                              Lower values reduce memory usage for large datasets.
        """
        self.csv_path = csv_path
        self.max_unique_track = max_unique_track

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def profile(self) -> Tuple[LocalProfile, ExportableProfile]:
        """
        Profile the CSV file.

        Returns:
            (LocalProfile, ExportableProfile) tuple.

        Raises:
            FileNotFoundError if the file does not exist.
            ValueError if the file is empty or cannot be parsed as CSV.
        """
        if not os.path.exists(self.csv_path):
            raise FileNotFoundError(
                f"VERDIX Profiler: Dataset file not found: '{self.csv_path}'"
            )

        raw_rows, headers, errors = self._read_csv_safely()

        if not headers:
            raise ValueError(
                f"VERDIX Profiler: CSV file is empty or has no header row: '{self.csv_path}'"
            )

        row_count = len(raw_rows)
        column_count = len(headers)

        # --- Duplicate detection (row-level) ---
        row_hashes: Dict[Tuple[str, ...], int] = {}
        for row in raw_rows:
            key = tuple(row)
            row_hashes[key] = row_hashes.get(key, 0) + 1
        duplicate_row_count = sum(count - 1 for count in row_hashes.values() if count > 1)
        duplicate_row_pct = (duplicate_row_count / row_count * 100.0) if row_count > 0 else 0.0

        # --- Per-column analysis ---
        column_profiles: List[ColumnProfile] = []
        total_cells = row_count * column_count
        total_missing = 0

        for col_idx, col_name in enumerate(headers):
            col_profile = self._profile_column(col_name, col_idx, raw_rows)
            column_profiles.append(col_profile)
            total_missing += col_profile.missing_count

        overall_missing_pct = (total_missing / total_cells * 100.0) if total_cells > 0 else 0.0
        completeness_score = max(0.0, 100.0 - overall_missing_pct)

        local = LocalProfile(
            csv_path=self.csv_path,
            row_count=row_count,
            column_count=column_count,
            duplicate_row_count=duplicate_row_count,
            duplicate_row_pct=round(duplicate_row_pct, 4),
            overall_missing_count=total_missing,
            overall_missing_pct=round(overall_missing_pct, 4),
            completeness_score=round(completeness_score, 4),
            columns=column_profiles,
            errors=errors,
        )

        exportable = ExportableProfile(
            row_count=row_count,
            column_count=column_count,
            missing_rate=round(overall_missing_pct, 4),
            duplicate_rate=round(duplicate_row_pct, 4),
            completeness_score=round(completeness_score, 4),
            numeric_column_count=local.numeric_column_count(),
            categorical_column_count=local.categorical_column_count(),
            boolean_column_count=local.boolean_column_count(),
            raw_records_transferred=0,          # Invariant: ALWAYS 0
        )

        return local, exportable

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _read_csv_safely(self) -> Tuple[List[List[str]], List[str], List[str]]:
        """
        Read CSV with encoding fallback (UTF-8 → latin-1).
        Returns (rows_as_lists, headers, errors).
        Rows do NOT include the header row.
        """
        errors: List[str] = []

        def _parse(text: str) -> Tuple[List[List[str]], List[str]]:
            reader = csv.reader(io.StringIO(text))
            all_rows = list(reader)
            if not all_rows:
                return [], []
            headers = [h.strip() for h in all_rows[0]]
            data_rows = []
            for row in all_rows[1:]:
                # Pad / trim to header length for malformed rows
                if len(row) < len(headers):
                    row = row + [""] * (len(headers) - len(row))
                data_rows.append([cell.strip() for cell in row[: len(headers)]])
            return data_rows, headers

        # Try UTF-8 first
        try:
            with open(self.csv_path, "r", encoding="utf-8", newline="") as fh:
                text = fh.read()
            rows, headers = _parse(text)
            return rows, headers, errors
        except UnicodeDecodeError:
            errors.append("UTF-8 decode failed; retrying with latin-1 encoding.")

        # Fallback: latin-1
        try:
            with open(self.csv_path, "r", encoding="latin-1", newline="") as fh:
                text = fh.read()
            rows, headers = _parse(text)
            return rows, headers, errors
        except Exception as exc:
            errors.append(f"Failed to read CSV: {exc}")
            return [], [], errors

    def _profile_column(
        self,
        col_name: str,
        col_idx: int,
        raw_rows: List[List[str]],
    ) -> ColumnProfile:
        """Compute per-column statistics without retaining raw values."""
        total_count = len(raw_rows)
        missing_count = 0
        empty_string_count = 0
        unique_tracker: Dict[str, int] = {}  # value → occurrence count (bounded)
        unique_overflow = False
        non_missing_values: List[str] = []
        stats = _WelfordStats()

        for row in raw_rows:
            raw_val = row[col_idx] if col_idx < len(row) else ""
            lower_val = raw_val.lower()

            if lower_val in self._MISSING_SENTINELS:
                missing_count += 1
                continue

            if raw_val == "":
                empty_string_count += 1
                missing_count += 1
                continue

            non_missing_values.append(raw_val)

            # Track unique values (bounded)
            if not unique_overflow:
                if raw_val not in unique_tracker:
                    if len(unique_tracker) >= self.max_unique_track:
                        unique_overflow = True
                    else:
                        unique_tracker[raw_val] = 0
                unique_tracker[raw_val] = unique_tracker.get(raw_val, 0) + 1

            # Try numeric parse (for Welford stats)
            fval = _try_float(raw_val)
            if fval is not None:
                stats.update(fval)

        missing_pct = (missing_count / total_count * 100.0) if total_count > 0 else 0.0
        inferred_dtype = _infer_column_type(non_missing_values)
        unique_count = (
            len(unique_tracker) if not unique_overflow else self.max_unique_track
        )

        profile = ColumnProfile(
            name=col_name,
            inferred_dtype=inferred_dtype,
            total_count=total_count,
            missing_count=missing_count,
            missing_pct=round(missing_pct, 4),
            unique_count=unique_count,
            empty_string_count=empty_string_count,
        )

        if inferred_dtype == "numeric" and stats.count > 0:
            profile.numeric_min = round(stats.min_val, 6)
            profile.numeric_max = round(stats.max_val, 6)
            profile.numeric_mean = round(stats.mean, 6)
            profile.numeric_std = round(stats.std, 6)

        if inferred_dtype == "categorical" and unique_tracker:
            profile.top_frequency = max(unique_tracker.values())

        return profile
