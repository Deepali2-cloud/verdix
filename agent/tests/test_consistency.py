"""
VERDIX Step 8E — Consistency Evaluation Engine Unit Tests.

Covers:
  1.  Consistent dataset (no violations, 100% consistency score)
  2.  Cross-field equality success
  3.  Cross-field equality mismatch
  4.  Conditional required success (condition met and target present)
  5.  Conditional required violation (condition met and target missing)
  6.  Numeric order success (min <= max)
  7.  Numeric order violation (min > max)
  8.  Date order success (start_date <= end_date)
  9.  Date order violation (start_date > end_date)
  10. Relationship mapping success (child in allowed set for parent)
  11. Relationship mapping violation (child not in allowed set)
  12. Multiple rule execution on a single dataset
  13. Inconsistency count calculation
  14. Inconsistency rate calculation
  15. Consistency score calculation
  16. Status threshold mapping (EXCELLENT, GOOD, FAIR, POOR)
  17. Configurable thresholds
  18. Invalid rule definition raises ValueError
  19. Missing referenced fields in dataset handled gracefully
  20. Empty dataset raises ValueError
  21. Export contains aggregates only
  22. Export guarantees raw_records_transferred = 0
  23. Export contains no column names
  24. Export contains no raw values
  25. Export contains no row indexes
  26. CLI consistency command succeeds
  27. CLI output does not leak synthetic personal fields
  28. Integration with EvaluationEngine.evaluate_consistency
"""

import json
import os
import subprocess
import sys
import tempfile
import unittest

# Ensure agent directory is on sys.path
_AGENT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if _AGENT_DIR not in sys.path:
    sys.path.insert(0, _AGENT_DIR)

from verdix_agent.consistency import (
    ConsistencyEngine,
    ConsistencyThresholds,
    ConsistencyRule,
    ConsistencyLocalResult,
    ConsistencyExportResult,
)
from verdix_agent.engine import EvaluationEngine

FIXTURE_CSV = os.path.join(
    os.path.dirname(__file__), "fixtures", "synthetic_consistency.csv"
)


class TestConsistencyEngine(unittest.TestCase):
    """Test suite for Step 8E Consistency Engine."""

    def test_1_consistent_dataset(self):
        """1. Fully consistent dataset achieves 100% consistency score and 0 violations."""
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".csv", delete=False, encoding="utf-8"
        ) as f:
            f.write(
                "code,name,min_val,max_val\n"
                "IN,India,10,20\n"
                "US,United States,30,40\n"
            )
            tmp_path = f.name
        try:
            rules = [
                ConsistencyRule(
                    name="country_map",
                    rule_type="field_equality",
                    fields=["code", "name"],
                    mapping={"IN": "India", "US": "United States"},
                ),
                ConsistencyRule(
                    name="val_order",
                    rule_type="numeric_order",
                    fields=["min_val", "max_val"],
                ),
            ]
            engine = ConsistencyEngine(rules=rules)
            local_res, export_res = engine.evaluate(tmp_path)
            self.assertEqual(local_res.inconsistent_count, 0)
            self.assertEqual(local_res.consistency_score, 100.0)
            self.assertEqual(local_res.affected_rule_count, 0)
            self.assertEqual(local_res.status, "EXCELLENT")
            self.assertEqual(export_res.status, "EXCELLENT")
        finally:
            os.unlink(tmp_path)

    def test_2_cross_field_equality_success(self):
        """2. Cross-field equality succeeds when values match mapping."""
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".csv", delete=False, encoding="utf-8"
        ) as f:
            f.write("code,country\nIN,India\nUS,United States\n")
            tmp_path = f.name
        try:
            rule = ConsistencyRule(
                name="geo_equality",
                rule_type="field_equality",
                fields=["code", "country"],
                mapping={"IN": "India", "US": "United States"},
            )
            engine = ConsistencyEngine(rules=[rule])
            local_res, _ = engine.evaluate(tmp_path)
            self.assertEqual(local_res.inconsistent_count, 0)
            self.assertEqual(local_res.values_checked, 2)
        finally:
            os.unlink(tmp_path)

    def test_3_cross_field_equality_mismatch(self):
        """3. Cross-field equality detects mismatches."""
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".csv", delete=False, encoding="utf-8"
        ) as f:
            # Row 2 mismatch: IN -> United States
            f.write("code,country\nIN,India\nIN,United States\n")
            tmp_path = f.name
        try:
            rule = ConsistencyRule(
                name="geo_equality",
                rule_type="field_equality",
                fields=["code", "country"],
                mapping={"IN": "India"},
            )
            engine = ConsistencyEngine(rules=[rule])
            local_res, _ = engine.evaluate(tmp_path)
            self.assertEqual(local_res.inconsistent_count, 1)
            self.assertEqual(local_res.affected_rule_count, 1)
            self.assertEqual(local_res.rule_diagnostics[0].violation_row_indices, [1])
        finally:
            os.unlink(tmp_path)

    def test_4_conditional_required_success(self):
        """4. Conditional required passes when dependent field exists."""
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".csv", delete=False, encoding="utf-8"
        ) as f:
            f.write(
                "status,activated_date\n"
                "active,2022-01-01\n"
                "inactive,\n"
            )
            tmp_path = f.name
        try:
            rule = ConsistencyRule(
                name="active_date_required",
                rule_type="conditional_required",
                fields=["status", "activated_date"],
                condition_value="active",
            )
            engine = ConsistencyEngine(rules=[rule])
            local_res, _ = engine.evaluate(tmp_path)
            self.assertEqual(local_res.inconsistent_count, 0)
            self.assertEqual(local_res.values_checked, 1)  # Only active row was checked
        finally:
            os.unlink(tmp_path)

    def test_5_conditional_required_violation(self):
        """5. Conditional required flags missing target when condition is met."""
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".csv", delete=False, encoding="utf-8"
        ) as f:
            # Active without activated_date
            f.write("status,activated_date\nactive,\ninactive,\n")
            tmp_path = f.name
        try:
            rule = ConsistencyRule(
                name="active_date_required",
                rule_type="conditional_required",
                fields=["status", "activated_date"],
                condition_value="active",
            )
            engine = ConsistencyEngine(rules=[rule])
            local_res, _ = engine.evaluate(tmp_path)
            self.assertEqual(local_res.inconsistent_count, 1)
            self.assertEqual(local_res.rule_diagnostics[0].violation_row_indices, [0])
        finally:
            os.unlink(tmp_path)

    def test_6_numeric_order_success(self):
        """6. Numeric order succeeds when min <= max."""
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".csv", delete=False, encoding="utf-8"
        ) as f:
            f.write("low,high\n10,20\n50,50\n100,200\n")
            tmp_path = f.name
        try:
            rule = ConsistencyRule(
                name="range_check",
                rule_type="numeric_order",
                fields=["low", "high"],
            )
            engine = ConsistencyEngine(rules=[rule])
            local_res, _ = engine.evaluate(tmp_path)
            self.assertEqual(local_res.inconsistent_count, 0)
            self.assertEqual(local_res.values_checked, 3)
        finally:
            os.unlink(tmp_path)

    def test_7_numeric_order_violation(self):
        """7. Numeric order detects violation when min > max."""
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".csv", delete=False, encoding="utf-8"
        ) as f:
            f.write("low,high\n10,20\n500,50\n100,200\n")
            tmp_path = f.name
        try:
            rule = ConsistencyRule(
                name="range_check",
                rule_type="numeric_order",
                fields=["low", "high"],
            )
            engine = ConsistencyEngine(rules=[rule])
            local_res, _ = engine.evaluate(tmp_path)
            self.assertEqual(local_res.inconsistent_count, 1)
            self.assertEqual(local_res.rule_diagnostics[0].violation_row_indices, [1])
        finally:
            os.unlink(tmp_path)

    def test_8_date_order_success(self):
        """8. Date order succeeds when start_date <= end_date."""
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".csv", delete=False, encoding="utf-8"
        ) as f:
            f.write(
                "start,end\n"
                "2022-01-01,2022-12-31\n"
                "2023-05-15,2023-05-15\n"
            )
            tmp_path = f.name
        try:
            rule = ConsistencyRule(
                name="dates_valid",
                rule_type="date_order",
                fields=["start", "end"],
            )
            engine = ConsistencyEngine(rules=[rule])
            local_res, _ = engine.evaluate(tmp_path)
            self.assertEqual(local_res.inconsistent_count, 0)
            self.assertEqual(local_res.values_checked, 2)
        finally:
            os.unlink(tmp_path)

    def test_9_date_order_violation(self):
        """9. Date order detects violation when start_date > end_date."""
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".csv", delete=False, encoding="utf-8"
        ) as f:
            f.write("start,end\n2023-12-31,2023-01-01\n")
            tmp_path = f.name
        try:
            rule = ConsistencyRule(
                name="dates_valid",
                rule_type="date_order",
                fields=["start", "end"],
            )
            engine = ConsistencyEngine(rules=[rule])
            local_res, _ = engine.evaluate(tmp_path)
            self.assertEqual(local_res.inconsistent_count, 1)
            self.assertEqual(local_res.rule_diagnostics[0].violation_row_indices, [0])
        finally:
            os.unlink(tmp_path)

    def test_10_relationship_mapping_success(self):
        """10. Relationship mapping succeeds when child role matches parent department."""
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".csv", delete=False, encoding="utf-8"
        ) as f:
            f.write(
                "dept,title\n"
                "Engineering,Software Engineer\n"
                "Finance,Analyst\n"
            )
            tmp_path = f.name
        try:
            rule = ConsistencyRule(
                name="dept_role_map",
                rule_type="relationship_mapping",
                fields=["dept", "title"],
                mapping={
                    "Engineering": ["Software Engineer", "Data Engineer"],
                    "Finance": ["Accountant", "Analyst"],
                },
            )
            engine = ConsistencyEngine(rules=[rule])
            local_res, _ = engine.evaluate(tmp_path)
            self.assertEqual(local_res.inconsistent_count, 0)
            self.assertEqual(local_res.values_checked, 2)
        finally:
            os.unlink(tmp_path)

    def test_11_relationship_mapping_violation(self):
        """11. Relationship mapping detects illegal child role for parent department."""
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".csv", delete=False, encoding="utf-8"
        ) as f:
            f.write("dept,title\nEngineering,Accountant\n")
            tmp_path = f.name
        try:
            rule = ConsistencyRule(
                name="dept_role_map",
                rule_type="relationship_mapping",
                fields=["dept", "title"],
                mapping={"Engineering": ["Software Engineer"]},
            )
            engine = ConsistencyEngine(rules=[rule])
            local_res, _ = engine.evaluate(tmp_path)
            self.assertEqual(local_res.inconsistent_count, 1)
            self.assertEqual(local_res.rule_diagnostics[0].violation_row_indices, [0])
        finally:
            os.unlink(tmp_path)

    def test_12_multiple_rule_execution(self):
        """12. Multiple rules execute concurrently on the synthetic fixture."""
        rules = [
            ConsistencyRule(
                name="country_equality",
                rule_type="field_equality",
                fields=["country_code", "country"],
                mapping={"IN": "India", "US": "United States", "UK": "United Kingdom", "DE": "Germany", "FR": "France"},
            ),
            ConsistencyRule(
                name="active_requires_date",
                rule_type="conditional_required",
                fields=["account_status", "activated_date"],
                condition_value="active",
            ),
            ConsistencyRule(
                name="credit_bounds",
                rule_type="numeric_order",
                fields=["min_credit", "max_credit"],
            ),
            ConsistencyRule(
                name="date_order_check",
                rule_type="date_order",
                fields=["start_date", "end_date"],
            ),
            ConsistencyRule(
                name="dept_roles",
                rule_type="relationship_mapping",
                fields=["department", "role"],
                mapping={
                    "Engineering": ["Software Engineer", "Data Engineer"],
                    "Finance": ["Accountant", "Analyst"],
                },
            ),
        ]
        engine = ConsistencyEngine(rules=rules)
        local_res, export_res = engine.evaluate(FIXTURE_CSV)
        self.assertGreater(local_res.values_checked, 0)
        self.assertGreater(local_res.inconsistent_count, 0)
        self.assertGreater(local_res.affected_rule_count, 0)
        self.assertEqual(len(local_res.rule_diagnostics), 5)

    def test_13_inconsistency_count_calculation(self):
        """13. Total inconsistency count is the sum of all rule violations."""
        rules = [
            ConsistencyRule(
                name="country_code_match",
                rule_type="field_equality",
                fields=["country_code", "country"],
                mapping={"IN": "India", "US": "United States", "UK": "United Kingdom", "DE": "Germany", "FR": "France"},
            )
        ]
        engine = ConsistencyEngine(rules=rules)
        local_res, export_res = engine.evaluate(FIXTURE_CSV)
        # In fixture: row 5 and row 10 have IN -> United States (2 violations)
        self.assertEqual(local_res.inconsistent_count, 2)
        self.assertEqual(export_res.inconsistent_count, 2)

    def test_14_inconsistency_rate_calculation(self):
        """14. Inconsistency rate = (inconsistent_count / values_checked) * 100."""
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".csv", delete=False, encoding="utf-8"
        ) as f:
            # 4 rows, 1 violation -> 25%
            f.write("a,b\n1,10\n2,20\n3,30\n40,4\n")
            tmp_path = f.name
        try:
            rule = ConsistencyRule("order", "numeric_order", ["a", "b"])
            engine = ConsistencyEngine(rules=[rule])
            local_res, export_res = engine.evaluate(tmp_path)
            self.assertAlmostEqual(local_res.inconsistency_rate, 25.0)
            self.assertAlmostEqual(export_res.inconsistency_rate, 25.0)
        finally:
            os.unlink(tmp_path)

    def test_15_consistency_score_calculation(self):
        """15. Consistency score = 100 - inconsistency_rate."""
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".csv", delete=False, encoding="utf-8"
        ) as f:
            f.write("a,b\n1,10\n2,20\n3,30\n40,4\n")
            tmp_path = f.name
        try:
            rule = ConsistencyRule("order", "numeric_order", ["a", "b"])
            engine = ConsistencyEngine(rules=[rule])
            local_res, export_res = engine.evaluate(tmp_path)
            self.assertAlmostEqual(local_res.consistency_score, 75.0)
            self.assertAlmostEqual(export_res.consistency_score, 75.0)
        finally:
            os.unlink(tmp_path)

    def test_16_status_threshold_mapping(self):
        """16. Status threshold mapping: <=5% EXCELLENT, <=10% GOOD, <=25% FAIR, >25% POOR."""
        t = ConsistencyThresholds()
        self.assertEqual(t.evaluate_status(0.0), "EXCELLENT")
        self.assertEqual(t.evaluate_status(4.99), "EXCELLENT")
        self.assertEqual(t.evaluate_status(5.0), "EXCELLENT")
        self.assertEqual(t.evaluate_status(5.01), "GOOD")
        self.assertEqual(t.evaluate_status(10.0), "GOOD")
        self.assertEqual(t.evaluate_status(15.0), "FAIR")
        self.assertEqual(t.evaluate_status(25.0), "FAIR")
        self.assertEqual(t.evaluate_status(25.01), "POOR")
        self.assertEqual(t.evaluate_status(50.0), "POOR")

    def test_17_configurable_thresholds(self):
        """17. Configurable thresholds modify qualitative status categorization."""
        strict = ConsistencyThresholds(excellent=1.0, good=3.0, fair=5.0)
        self.assertEqual(strict.evaluate_status(2.0), "GOOD")
        self.assertEqual(strict.evaluate_status(4.0), "FAIR")
        self.assertEqual(strict.evaluate_status(6.0), "POOR")

    def test_18_invalid_rule_definition(self):
        """18. Invalid rule definition raises clear ValueError."""
        # Missing rule name
        with self.assertRaises(ValueError):
            ConsistencyRule(name="", rule_type="numeric_order", fields=["a", "b"]).validate()

        # Unknown rule type
        with self.assertRaises(ValueError):
            ConsistencyRule(name="r", rule_type="unknown_type", fields=["a", "b"]).validate()

        # Less than 2 fields
        with self.assertRaises(ValueError):
            ConsistencyRule(name="r", rule_type="numeric_order", fields=["only_one"]).validate()

        # conditional_required without condition_value
        with self.assertRaises(ValueError):
            ConsistencyRule(name="r", rule_type="conditional_required", fields=["a", "b"]).validate()

        # relationship_mapping without mapping
        with self.assertRaises(ValueError):
            ConsistencyRule(name="r", rule_type="relationship_mapping", fields=["a", "b"]).validate()

    def test_19_missing_referenced_fields_handled_gracefully(self):
        """19. Referenced fields missing from dataset are recorded as skipped without error."""
        rule = ConsistencyRule("nonexistent", "numeric_order", ["missing_col_x", "missing_col_y"])
        engine = ConsistencyEngine(rules=[rule])
        local_res, export_res = engine.evaluate(FIXTURE_CSV)
        self.assertEqual(local_res.rule_diagnostics[0].skipped, True)
        self.assertIn("missing", local_res.rule_diagnostics[0].skip_reason.lower())
        self.assertEqual(export_res.inconsistent_count, 0)

    def test_20_empty_dataset_handling(self):
        """20. Empty CSV raises ValueError."""
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".csv", delete=False, encoding="utf-8"
        ) as f:
            f.write("")
            tmp_path = f.name
        try:
            engine = ConsistencyEngine()
            with self.assertRaises(ValueError):
                engine.evaluate(tmp_path)
        finally:
            os.unlink(tmp_path)

    def test_21_export_contains_aggregates_only(self):
        """21. Export result contains only expected aggregate fields."""
        rule = ConsistencyRule("order", "numeric_order", ["min_credit", "max_credit"])
        engine = ConsistencyEngine(rules=[rule])
        _, export_res = engine.evaluate(FIXTURE_CSV)
        d = export_res.to_dict()
        expected_keys = {
            "row_count",
            "values_checked",
            "inconsistent_count",
            "inconsistency_rate",
            "consistency_score",
            "affected_rule_count",
            "status",
            "raw_records_transferred",
        }
        self.assertEqual(set(d.keys()), expected_keys)

    def test_22_export_guarantees_raw_records_transferred_zero(self):
        """22. Export result strictly enforces raw_records_transferred == 0."""
        engine = ConsistencyEngine()
        _, export_res = engine.evaluate(FIXTURE_CSV)
        self.assertEqual(export_res.raw_records_transferred, 0)
        self.assertEqual(export_res.to_dict()["raw_records_transferred"], 0)

    def test_23_export_contains_no_column_names(self):
        """23. Export result does not leak column names in JSON."""
        rule = ConsistencyRule("test_rule", "numeric_order", ["min_credit", "max_credit"])
        engine = ConsistencyEngine(rules=[rule])
        _, export_res = engine.evaluate(FIXTURE_CSV)
        d_str = json.dumps(export_res.to_dict())
        for col in ["country_code", "country", "account_status", "activated_date", "min_credit", "max_credit", "department", "role"]:
            self.assertNotIn(col, d_str)

    def test_24_export_contains_no_raw_values(self):
        """24. Export result contains no raw values or records."""
        rule = ConsistencyRule("dept", "relationship_mapping", ["department", "role"], mapping={"Engineering": ["Software Engineer"]})
        engine = ConsistencyEngine(rules=[rule])
        _, export_res = engine.evaluate(FIXTURE_CSV)
        d_str = json.dumps(export_res.to_dict())
        for val in ["Engineering", "Accountant", "Software Engineer", "India", "United States"]:
            self.assertNotIn(val, d_str)

    def test_25_export_contains_no_row_indexes(self):
        """25. Export result contains no row indexes or violation lists."""
        rule = ConsistencyRule("order", "numeric_order", ["min_credit", "max_credit"])
        engine = ConsistencyEngine(rules=[rule])
        local_res, export_res = engine.evaluate(FIXTURE_CSV)
        # Local result may track row indices internally
        self.assertTrue(hasattr(local_res.rule_diagnostics[0], "violation_row_indices"))
        # Export result MUST NOT
        self.assertNotIn("violation_row_indices", export_res.to_dict())
        self.assertNotIn("row_indices", export_res.to_dict())

    def test_26_cli_consistency_command_succeeds(self):
        """26. CLI consistency command succeeds with return code 0."""
        env = {**os.environ, "PYTHONIOENCODING": "utf-8"}
        result = subprocess.run(
            [sys.executable, "-m", "verdix_agent.cli", "consistency", FIXTURE_CSV],
            capture_output=True,
            text=True,
            cwd=_AGENT_DIR,
            env=env,
        )
        self.assertEqual(
            result.returncode,
            0,
            f"CLI consistency command failed: STDOUT: {result.stdout}, STDERR: {result.stderr}",
        )
        out = result.stdout
        self.assertIn("VERDIX CONSISTENCY EVALUATION", out)
        self.assertIn("Rows:", out)
        self.assertIn("Values checked:", out)
        self.assertIn("Inconsistent values:", out)
        self.assertIn("Inconsistency rate:", out)
        self.assertIn("Consistency score:", out)
        self.assertIn("Affected rules:", out)
        self.assertIn("Status:", out)
        self.assertIn("Raw records sent:", out)
        self.assertIn("0", out)

    def test_27_cli_does_not_leak_synthetic_personal_fields(self):
        """27. CLI output contains only aggregate statistics, no personal/fixture data."""
        env = {**os.environ, "PYTHONIOENCODING": "utf-8"}
        result = subprocess.run(
            [sys.executable, "-m", "verdix_agent.cli", "consistency", FIXTURE_CSV],
            capture_output=True,
            text=True,
            cwd=_AGENT_DIR,
            env=env,
        )
        out = result.stdout
        for pii in ["India", "United States", "Software Engineer", "Accountant", "Finance"]:
            self.assertNotIn(pii, out)

    def test_28_integration_with_evaluation_engine(self):
        """28. EvaluationEngine.evaluate_consistency works directly."""
        eval_engine = EvaluationEngine()
        rule = ConsistencyRule("test_range", "numeric_order", ["min_credit", "max_credit"])
        local_res, export_res = eval_engine.evaluate_consistency(
            FIXTURE_CSV,
            rules=[rule],
        )
        self.assertIsInstance(local_res, ConsistencyLocalResult)
        self.assertIsInstance(export_res, ConsistencyExportResult)
        self.assertEqual(export_res.raw_records_transferred, 0)


if __name__ == "__main__":
    unittest.main()
