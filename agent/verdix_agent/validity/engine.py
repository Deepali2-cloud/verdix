"""
VERDIX Validity Evaluation Engine.

ARCHITECTURAL INVARIANT
-----------------------
All validity checks run locally inside the organization's environment.
No raw records, cell values, PII, or column contents leave this module.

Semantic Rule:
Missing values are NOT automatically classified as invalid unless
a configured rule explicitly disallows missing values.
Missingness belongs to Completeness; Validity focuses on structural/type integrity.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set, Tuple

from verdix_agent.profiler.csv_profiler import CsvProfiler, LocalProfile

_MISSING_SENTINELS = frozenset({"", "null", "none", "na", "n/a", "nan", "#n/a", "missing"})
_BOOLEAN_VALUES = frozenset({"true", "false", "yes", "no", "1", "0", "t", "f", "y", "n"})


def _try_float(val: str) -> Optional[float]:
    """Attempt to parse string as float, stripping thousands commas."""
    try:
        return float(val.replace(",", "").strip())
    except (ValueError, AttributeError):
        return None


@dataclass
class ValidityThresholds:
    """
    Configurable status rating thresholds for validity score.

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
        if score >= self.excellent:
            return "EXCELLENT"
        elif score >= self.good:
            return "GOOD"
        elif score >= self.fair:
            return "FAIR"
        else:
            return "POOR"


@dataclass
class ColumnValidityRule:
    """
    Optional user-specified validation rule for a specific column.

    Attributes:
        column_name: Target column name.
        expected_type: Optional expected type: "numeric", "boolean", "categorical", "string".
        min_value: Optional minimum value for numeric checks.
        max_value: Optional maximum value for numeric checks.
        allowed_values: Optional set of permitted string values.
        pattern: Optional regex pattern string to match.
        allow_missing: If True (default), missing cells are skipped.
                       If False, missing cells are counted as invalid.
    """
    column_name: str
    expected_type: Optional[str] = None
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    allowed_values: Optional[Set[str]] = None
    pattern: Optional[str] = None
    allow_missing: bool = True


@dataclass
class ColumnValidityDiagnostic:
    """
    Internal column-level validity diagnostics.
    Retained strictly inside the enclave; never exported to cloud.
    Stores only numerical counts of violation categories, never raw cell values.
    """
    column_name: str
    inferred_dtype: str
    values_checked: int = 0
    invalid_count: int = 0
    invalid_rate: float = 0.0
    failure_reasons: Dict[str, int] = field(default_factory=lambda: {
        "type_mismatch": 0,
        "range_violation": 0,
        "disallowed_value": 0,
        "pattern_mismatch": 0,
        "missing_not_allowed": 0,
    })

    def record_failure(self, reason: str) -> None:
        self.invalid_count += 1
        self.failure_reasons[reason] = self.failure_reasons.get(reason, 0) + 1

    def finalize(self) -> None:
        if self.values_checked > 0:
            self.invalid_rate = round((self.invalid_count / self.values_checked) * 100.0, 4)
        else:
            self.invalid_rate = 0.0

    def to_safe_dict(self) -> Dict[str, Any]:
        return {
            "column_name": self.column_name,
            "inferred_dtype": self.inferred_dtype,
            "values_checked": self.values_checked,
            "invalid_count": self.invalid_count,
            "invalid_rate": self.invalid_rate,
            "failure_reasons": dict(self.failure_reasons),
        }


@dataclass
class ValidityLocalResult:
    """
    Internal validity evaluation result.
    Remains inside the local enclave.
    """
    validity_score: float
    invalid_value_count: int
    total_values_checked: int
    invalid_rate: float
    affected_column_count: int
    status: str
    row_count: int
    column_count: int
    column_diagnostics: List[ColumnValidityDiagnostic] = field(default_factory=list)

    def to_safe_dict(self) -> Dict[str, Any]:
        return {
            "row_count": self.row_count,
            "column_count": self.column_count,
            "validity_score": round(self.validity_score, 4),
            "invalid_value_count": self.invalid_value_count,
            "total_values_checked": self.total_values_checked,
            "invalid_rate": round(self.invalid_rate, 4),
            "affected_column_count": self.affected_column_count,
            "status": self.status,
            "column_diagnostics": [d.to_safe_dict() for d in self.column_diagnostics],
        }


@dataclass
class ValidityExportResult:
    """
    Safe aggregate-only export result for cloud transmission.

    Invariants enforced:
      - raw_records_transferred is strictly 0
      - No column names
      - No raw records, cell values, or sample rows
    """
    validity_score: float
    invalid_value_count: int
    total_values_checked: int
    invalid_rate: float
    affected_column_count: int
    status: str
    raw_records_transferred: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "validity_score": round(self.validity_score, 2),
            "invalid_value_count": self.invalid_value_count,
            "total_values_checked": self.total_values_checked,
            "invalid_rate": round(self.invalid_rate, 2),
            "affected_column_count": self.affected_column_count,
            "status": self.status,
            "raw_records_transferred": self.raw_records_transferred,
        }


class ValidityEngine:
    """
    Local Validity Evaluation Engine.

    Validates CSV values against inferred column types and optional rules.
    Runs entirely within the enclave.
    """

    def __init__(
        self,
        thresholds: Optional[ValidityThresholds] = None,
        rules: Optional[List[ColumnValidityRule]] = None,
    ) -> None:
        self.thresholds = thresholds or ValidityThresholds()
        self.rules: Dict[str, ColumnValidityRule] = {r.column_name: r for r in (rules or [])}

    def evaluate(
        self,
        csv_path: str,
        profile: Optional[LocalProfile] = None,
    ) -> Tuple[ValidityLocalResult, ValidityExportResult]:
        """
        Evaluate validity of a local CSV dataset.

        Args:
            csv_path: Path to the local CSV file.
            profile: Optional pre-computed Step 8A LocalProfile. If omitted,
                     it will be computed automatically.
        """
        profiler = CsvProfiler(csv_path)

        if profile is None:
            profile, _ = profiler.profile()

        raw_rows, headers, _ = profiler._read_csv_safely()

        row_count = len(raw_rows)
        column_count = len(headers)

        # Build column inferred dtype mapping from profile
        profile_col_types = {c.name: c.inferred_dtype for c in profile.columns}

        diagnostics: List[ColumnValidityDiagnostic] = []
        rule_patterns: Dict[str, Optional[re.Pattern]] = {}

        for col_name in headers:
            inferred_type = profile_col_types.get(col_name, "categorical")
            diagnostics.append(
                ColumnValidityDiagnostic(
                    column_name=col_name,
                    inferred_dtype=inferred_type,
                )
            )
            rule = self.rules.get(col_name)
            if rule and rule.pattern:
                rule_patterns[col_name] = re.compile(rule.pattern)

        # Stream and validate row values locally
        for row in raw_rows:
            for col_idx, col_name in enumerate(headers):
                diag = diagnostics[col_idx]
                rule = self.rules.get(col_name)
                val = row[col_idx] if col_idx < len(row) else ""
                val_trimmed = val.strip()
                val_lower = val_trimmed.lower()
                is_missing = val_lower in _MISSING_SENTINELS or val_trimmed == ""

                # Handle missing values
                if is_missing:
                    if rule and not rule.allow_missing:
                        diag.values_checked += 1
                        diag.record_failure("missing_not_allowed")
                    # By default (allow_missing=True), missing cells are not marked invalid
                    continue

                diag.values_checked += 1
                is_valid = True

                # Determine effective target type
                target_type = rule.expected_type if (rule and rule.expected_type) else diag.inferred_dtype

                # 1. Type validation
                if target_type == "numeric":
                    fval = _try_float(val_trimmed)
                    if fval is None:
                        diag.record_failure("type_mismatch")
                        is_valid = False
                    else:
                        # Range validation
                        if rule:
                            if rule.min_value is not None and fval < rule.min_value:
                                diag.record_failure("range_violation")
                                is_valid = False
                            elif rule.max_value is not None and fval > rule.max_value:
                                diag.record_failure("range_violation")
                                is_valid = False

                elif target_type == "boolean":
                    if val_lower not in _BOOLEAN_VALUES:
                        diag.record_failure("type_mismatch")
                        is_valid = False

                # 2. Allowed categorical values validation
                if is_valid and rule and rule.allowed_values is not None:
                    if (val_trimmed not in rule.allowed_values and
                            val_lower not in {v.lower() for v in rule.allowed_values}):
                        diag.record_failure("disallowed_value")
                        is_valid = False

                # 3. Regex / format pattern validation
                if is_valid and col_name in rule_patterns and rule_patterns[col_name]:
                    if not rule_patterns[col_name].search(val_trimmed):
                        diag.record_failure("pattern_mismatch")
                        is_valid = False

        # Finalize diagnostics
        total_values_checked = 0
        total_invalid_count = 0
        affected_column_count = 0

        for diag in diagnostics:
            diag.finalize()
            total_values_checked += diag.values_checked
            total_invalid_count += diag.invalid_count
            if diag.invalid_count > 0:
                affected_column_count += 1

        if total_values_checked > 0:
            invalid_rate = (total_invalid_count / total_values_checked) * 100.0
            validity_score = max(0.0, 100.0 - invalid_rate)
        else:
            invalid_rate = 0.0
            validity_score = 100.0

        status = self.thresholds.evaluate_status(validity_score)

        local_result = ValidityLocalResult(
            validity_score=validity_score,
            invalid_value_count=total_invalid_count,
            total_values_checked=total_values_checked,
            invalid_rate=invalid_rate,
            affected_column_count=affected_column_count,
            status=status,
            row_count=row_count,
            column_count=column_count,
            column_diagnostics=diagnostics,
        )

        export_result = ValidityExportResult(
            validity_score=validity_score,
            invalid_value_count=total_invalid_count,
            total_values_checked=total_values_checked,
            invalid_rate=invalid_rate,
            affected_column_count=affected_column_count,
            status=status,
            raw_records_transferred=0,  # Invariant: ALWAYS 0
        )

        return local_result, export_result
