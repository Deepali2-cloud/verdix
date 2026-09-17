"""
VERDIX Consistency Evaluation Engine.

ARCHITECTURAL INVARIANT
-----------------------
All consistency evaluation is performed locally within the organization's enclave.
Raw records, row contents, cell values, and PII NEVER leave this module.

Semantic Rule:
Consistency evaluates logical relationships between fields (e.g. cross-field equality,
numeric and date ordering, conditional dependencies, and valid category mappings).
Missing values in relationship checks do not trigger inconsistency unless the rule
explicitly enforces presence.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, date
from typing import Any, Dict, List, Optional, Set, Tuple, Union

from verdix_agent.profiler.csv_profiler import CsvProfiler, LocalProfile

_MISSING_SENTINELS = frozenset({"", "null", "none", "na", "n/a", "nan", "#n/a", "missing"})

VALID_RULE_TYPES = {
    "field_equality",
    "conditional_required",
    "numeric_order",
    "date_order",
    "relationship_mapping",
}


def _is_missing(val: str) -> bool:
    return val.strip().lower() in _MISSING_SENTINELS or val.strip() == ""


def _try_float(val: str) -> Optional[float]:
    try:
        return float(val.replace(",", "").strip())
    except (ValueError, AttributeError):
        return None


def _parse_date(val: str) -> Optional[date]:
    val_clean = val.strip()
    if not val_clean or _is_missing(val_clean):
        return None
    for fmt in (
        "%Y-%m-%d",
        "%Y/%m/%d",
        "%d-%m-%Y",
        "%d/%m/%Y",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M:%SZ",
    ):
        try:
            return datetime.strptime(val_clean, fmt).date()
        except (ValueError, TypeError):
            continue
    return None


@dataclass
class ConsistencyThresholds:
    """
    Configurable status rating thresholds for inconsistency rate.

    Default bands:
      0.00% –  5.00% -> EXCELLENT
      > 5.00% – 10.00% -> GOOD
      > 10.00% – 25.00% -> FAIR
      > 25.00%         -> POOR
    """
    excellent: float = 5.0
    good: float = 10.0
    fair: float = 25.0

    def evaluate_status(self, inconsistency_rate: float) -> str:
        """Map inconsistency rate to a qualitative status."""
        if inconsistency_rate <= self.excellent:
            return "EXCELLENT"
        elif inconsistency_rate <= self.good:
            return "GOOD"
        elif inconsistency_rate <= self.fair:
            return "FAIR"
        else:
            return "POOR"


@dataclass
class ConsistencyRule:
    """
    Configurable consistency rule definition.

    Supported rule_types:
      - 'field_equality': fields=[col_a, col_b] with optional mapping
      - 'conditional_required': fields=[cond_col, target_col], condition_value="active"
      - 'numeric_order': fields=[min_col, max_col]
      - 'date_order': fields=[start_date_col, end_date_col]
      - 'relationship_mapping': fields=[parent_col, child_col], mapping={parent: [valid_children]}
    """
    name: str
    rule_type: str
    fields: List[str]
    mapping: Optional[Dict[str, Any]] = None
    condition_value: Optional[str] = None
    operator: str = "<="
    require_present: bool = False

    def validate(self) -> None:
        """Validate rule syntax and configuration parameters."""
        if not self.name or not isinstance(self.name, str):
            raise ValueError("ConsistencyRule 'name' must be a non-empty string.")

        if self.rule_type not in VALID_RULE_TYPES:
            raise ValueError(
                f"Invalid rule_type '{self.rule_type}'. Must be one of: {sorted(VALID_RULE_TYPES)}"
            )

        if not self.fields or not isinstance(self.fields, list) or len(self.fields) < 2:
            raise ValueError(
                f"Rule '{self.name}' must specify at least 2 target fields."
            )

        if self.rule_type == "conditional_required":
            if self.condition_value is None:
                raise ValueError(
                    f"Rule '{self.name}' of type 'conditional_required' requires 'condition_value'."
                )

        if self.rule_type == "relationship_mapping":
            if not self.mapping or not isinstance(self.mapping, dict):
                raise ValueError(
                    f"Rule '{self.name}' of type 'relationship_mapping' requires a dictionary 'mapping'."
                )


@dataclass
class RuleDiagnostic:
    """
    Internal diagnostic detail for a single consistency rule.
    Retained strictly inside the enclave; row indices never enter export payload.
    """
    rule_name: str
    rule_type: str
    checks_performed: int = 0
    violation_count: int = 0
    violation_row_indices: List[int] = field(default_factory=list)
    skipped: bool = False
    skip_reason: Optional[str] = None

    def to_safe_dict(self) -> Dict[str, Any]:
        return {
            "rule_name": self.rule_name,
            "rule_type": self.rule_type,
            "checks_performed": self.checks_performed,
            "violation_count": self.violation_count,
            "violation_row_indices": self.violation_row_indices,
            "skipped": self.skipped,
            "skip_reason": self.skip_reason,
        }


@dataclass
class ConsistencyLocalResult:
    """
    Complete internal consistency evaluation result.
    Remains strictly within the local enclave.
    """
    row_count: int
    values_checked: int
    inconsistent_count: int
    inconsistency_rate: float
    consistency_score: float
    affected_rule_count: int
    status: str
    rule_diagnostics: List[RuleDiagnostic] = field(default_factory=list)

    def to_safe_dict(self) -> Dict[str, Any]:
        return {
            "row_count": self.row_count,
            "values_checked": self.values_checked,
            "inconsistent_count": self.inconsistent_count,
            "inconsistency_rate": round(self.inconsistency_rate, 4),
            "consistency_score": round(self.consistency_score, 4),
            "affected_rule_count": self.affected_rule_count,
            "status": self.status,
            "rule_diagnostics": [d.to_safe_dict() for d in self.rule_diagnostics],
        }


@dataclass
class ConsistencyExportResult:
    """
    Safe aggregate-only export result for cloud transmission.

    Invariants enforced:
      - raw_records_transferred is strictly 0
      - No column names
      - No field names
      - No raw values
      - No raw rows
      - No row indices
      - No relationship mapping keys or details
    """
    row_count: int
    values_checked: int
    inconsistent_count: int
    inconsistency_rate: float
    consistency_score: float
    affected_rule_count: int
    status: str
    raw_records_transferred: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "row_count": self.row_count,
            "values_checked": self.values_checked,
            "inconsistent_count": self.inconsistent_count,
            "inconsistency_rate": round(self.inconsistency_rate, 2),
            "consistency_score": round(self.consistency_score, 2),
            "affected_rule_count": self.affected_rule_count,
            "status": self.status,
            "raw_records_transferred": self.raw_records_transferred,
        }


class ConsistencyEngine:
    """
    Local Consistency Evaluation Engine.

    Evaluates cross-field equality, conditional requirements, numeric and date ordering,
    and relationship mappings locally.
    """

    def __init__(
        self,
        thresholds: Optional[ConsistencyThresholds] = None,
        rules: Optional[List[ConsistencyRule]] = None,
    ) -> None:
        self.thresholds = thresholds or ConsistencyThresholds()
        self.rules: List[ConsistencyRule] = rules or []

        for r in self.rules:
            r.validate()

    def evaluate(
        self,
        csv_path: str,
        profile: Optional[LocalProfile] = None,
    ) -> Tuple[ConsistencyLocalResult, ConsistencyExportResult]:
        """
        Evaluate consistency of a local CSV file.
        """
        profiler = CsvProfiler(csv_path)
        raw_rows, headers, _ = profiler._read_csv_safely()

        if not headers:
            raise ValueError(
                f"VERDIX Consistency Engine: CSV file is empty or has no header row: '{csv_path}'"
            )

        row_count = len(raw_rows)
        header_map = {h: idx for idx, h in enumerate(headers)}

        # If no custom rules were provided, discover candidate heuristic rules from headers
        active_rules = self.rules
        if not active_rules:
            active_rules = self._discover_default_rules(headers)

        rule_diagnostics: List[RuleDiagnostic] = []
        total_checks = 0
        total_violations = 0
        affected_rules = 0

        for rule in active_rules:
            # Check if referenced fields exist in headers
            missing_fields = [f for f in rule.fields if f not in header_map]
            if missing_fields:
                rule_diagnostics.append(
                    RuleDiagnostic(
                        rule_name=rule.name,
                        rule_type=rule.rule_type,
                        skipped=True,
                        skip_reason=f"Referenced fields missing from dataset: {missing_fields}",
                    )
                )
                continue

            diag = self._evaluate_rule_on_rows(rule, raw_rows, header_map)
            rule_diagnostics.append(diag)
            total_checks += diag.checks_performed
            total_violations += diag.violation_count
            if diag.violation_count > 0:
                affected_rules += 1

        if total_checks > 0:
            inconsistency_rate = (total_violations / total_checks) * 100.0
            consistency_score = max(0.0, 100.0 - inconsistency_rate)
        else:
            inconsistency_rate = 0.0
            consistency_score = 100.0

        status = self.thresholds.evaluate_status(inconsistency_rate)

        local_result = ConsistencyLocalResult(
            row_count=row_count,
            values_checked=total_checks,
            inconsistent_count=total_violations,
            inconsistency_rate=inconsistency_rate,
            consistency_score=consistency_score,
            affected_rule_count=affected_rules,
            status=status,
            rule_diagnostics=rule_diagnostics,
        )

        export_result = ConsistencyExportResult(
            row_count=row_count,
            values_checked=total_checks,
            inconsistent_count=total_violations,
            inconsistency_rate=inconsistency_rate,
            consistency_score=consistency_score,
            affected_rule_count=affected_rules,
            status=status,
            raw_records_transferred=0,  # Invariant: ALWAYS 0
        )

        return local_result, export_result

    def _evaluate_rule_on_rows(
        self,
        rule: ConsistencyRule,
        raw_rows: List[List[str]],
        header_map: Dict[str, int],
    ) -> RuleDiagnostic:
        """Evaluate a single rule across all data rows."""
        diag = RuleDiagnostic(rule_name=rule.name, rule_type=rule.rule_type)

        idx_0 = header_map[rule.fields[0]]
        idx_1 = header_map[rule.fields[1]]

        for row_idx, row in enumerate(raw_rows):
            val_0 = row[idx_0] if idx_0 < len(row) else ""
            val_1 = row[idx_1] if idx_1 < len(row) else ""

            # Check rule presence requirements
            if rule.require_present and (_is_missing(val_0) or _is_missing(val_1)):
                diag.checks_performed += 1
                diag.violation_count += 1
                diag.violation_row_indices.append(row_idx)
                continue

            # Evaluate specific rule type
            if rule.rule_type == "field_equality":
                self._check_field_equality(val_0, val_1, rule, row_idx, diag)
            elif rule.rule_type == "conditional_required":
                self._check_conditional_required(val_0, val_1, rule, row_idx, diag)
            elif rule.rule_type == "numeric_order":
                self._check_numeric_order(val_0, val_1, rule, row_idx, diag)
            elif rule.rule_type == "date_order":
                self._check_date_order(val_0, val_1, rule, row_idx, diag)
            elif rule.rule_type == "relationship_mapping":
                self._check_relationship_mapping(val_0, val_1, rule, row_idx, diag)

        return diag

    def _check_field_equality(
        self, val_0: str, val_1: str, rule: ConsistencyRule, row_idx: int, diag: RuleDiagnostic
    ) -> None:
        if _is_missing(val_0) or _is_missing(val_1):
            return

        diag.checks_performed += 1
        val_0_clean = val_0.strip()
        val_1_clean = val_1.strip()

        if rule.mapping:
            # Map val_0 to expected val_1
            expected = rule.mapping.get(val_0_clean)
            if expected is None:
                # Try case-insensitive lookup
                for k, v in rule.mapping.items():
                    if k.lower() == val_0_clean.lower():
                        expected = v
                        break
            if expected is not None:
                if str(expected).strip().lower() != val_1_clean.lower():
                    diag.violation_count += 1
                    diag.violation_row_indices.append(row_idx)
            else:
                # Key not in mapping when mapping is explicit
                diag.violation_count += 1
                diag.violation_row_indices.append(row_idx)
        else:
            if val_0_clean.lower() != val_1_clean.lower():
                diag.violation_count += 1
                diag.violation_row_indices.append(row_idx)

    def _check_conditional_required(
        self, val_0: str, val_1: str, rule: ConsistencyRule, row_idx: int, diag: RuleDiagnostic
    ) -> None:
        # val_0 is condition_field, val_1 is target_field
        if _is_missing(val_0):
            return

        if rule.condition_value is not None:
            if val_0.strip().lower() == rule.condition_value.strip().lower():
                diag.checks_performed += 1
                if _is_missing(val_1):
                    diag.violation_count += 1
                    diag.violation_row_indices.append(row_idx)

    def _check_numeric_order(
        self, val_0: str, val_1: str, rule: ConsistencyRule, row_idx: int, diag: RuleDiagnostic
    ) -> None:
        if _is_missing(val_0) or _is_missing(val_1):
            return

        f0 = _try_float(val_0)
        f1 = _try_float(val_1)
        if f0 is not None and f1 is not None:
            diag.checks_performed += 1
            if rule.operator == "<":
                if not (f0 < f1):
                    diag.violation_count += 1
                    diag.violation_row_indices.append(row_idx)
            else:  # default "<="
                if not (f0 <= f1):
                    diag.violation_count += 1
                    diag.violation_row_indices.append(row_idx)

    def _check_date_order(
        self, val_0: str, val_1: str, rule: ConsistencyRule, row_idx: int, diag: RuleDiagnostic
    ) -> None:
        if _is_missing(val_0) or _is_missing(val_1):
            return

        d0 = _parse_date(val_0)
        d1 = _parse_date(val_1)
        if d0 is not None and d1 is not None:
            diag.checks_performed += 1
            if rule.operator == "<":
                if not (d0 < d1):
                    diag.violation_count += 1
                    diag.violation_row_indices.append(row_idx)
            else:  # default "<="
                if not (d0 <= d1):
                    diag.violation_count += 1
                    diag.violation_row_indices.append(row_idx)

    def _check_relationship_mapping(
        self, val_0: str, val_1: str, rule: ConsistencyRule, row_idx: int, diag: RuleDiagnostic
    ) -> None:
        if _is_missing(val_0) or _is_missing(val_1):
            return

        diag.checks_performed += 1
        val_0_clean = val_0.strip()
        val_1_clean = val_1.strip()

        allowed: Optional[Union[List[Any], Set[Any]]] = None
        if rule.mapping:
            allowed = rule.mapping.get(val_0_clean)
            if allowed is None:
                for k, v in rule.mapping.items():
                    if k.lower() == val_0_clean.lower():
                        allowed = v
                        break

        if allowed is not None:
            allowed_set = {str(item).strip().lower() for item in allowed}
            if val_1_clean.lower() not in allowed_set:
                diag.violation_count += 1
                diag.violation_row_indices.append(row_idx)
        else:
            # Parent not recognized in mapping
            diag.violation_count += 1
            diag.violation_row_indices.append(row_idx)

    def _discover_default_rules(self, headers: List[str]) -> List[ConsistencyRule]:
        """Auto-discover common relationship rules if standard naming conventions exist."""
        rules: List[ConsistencyRule] = []
        header_set = set(headers)

        if "start_date" in header_set and "end_date" in header_set:
            rules.append(
                ConsistencyRule(
                    name="default_date_order",
                    rule_type="date_order",
                    fields=["start_date", "end_date"],
                )
            )

        if "min_value" in header_set and "max_value" in header_set:
            rules.append(
                ConsistencyRule(
                    name="default_min_max_order",
                    rule_type="numeric_order",
                    fields=["min_value", "max_value"],
                )
            )

        return rules
