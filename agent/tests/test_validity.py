"""
VERDIX Step 8C — Validity Evaluation Engine Unit Tests.

Covers:
  1.  fully valid dataset
  2.  invalid numeric values
  3.  invalid boolean values
  4.  missing/empty values handled correctly (semantic rule: missing != invalid by default)
  5.  allowed categorical values
  6.  numeric range validation
  7.  pattern validation (regex)
  8.  validity score calculation
  9.  invalid count
  10. invalid rate
  11. affected-column count
  12. configurable rules
  13. export contains aggregates only
  14. export guarantees raw_records_transferred = 0
  15. export contains no column names
  16. export contains no raw values
  17. CLI succeeds
  18. CLI does not leak synthetic names/emails
  19. empty dataset handling
  20. malformed input handling
  21. integration with EvaluationEngine
  22. explicit allow_missing=False rule handling
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

from verdix_agent.validity import (
    ValidityEngine,
    ValidityThresholds,
    ColumnValidityRule,
    ValidityLocalResult,
    ValidityExportResult,
)
from verdix_agent.engine import EvaluationEngine

FIXTURE_CSV = os.path.join(
    os.path.dirname(__file__), "fixtures", "synthetic_customers.csv"
)


class TestValidityEngine(unittest.TestCase):
    """Test suite for Step 8C Validity Engine."""

    def test_1_fully_valid_dataset(self):
        """1. Fully valid dataset achieves 100% validity score."""
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".csv", delete=False, encoding="utf-8"
        ) as f:
            f.write("num,flag,category\n10,true,Alpha\n20,false,Beta\n30,true,Gamma\n")
            tmp_path = f.name
        try:
            engine = ValidityEngine()
            local_res, export_res = engine.evaluate(tmp_path)
            self.assertEqual(local_res.validity_score, 100.0)
            self.assertEqual(export_res.validity_score, 100.0)
            self.assertEqual(local_res.invalid_value_count, 0)
            self.assertEqual(export_res.invalid_value_count, 0)
            self.assertEqual(local_res.affected_column_count, 0)
            self.assertEqual(export_res.affected_column_count, 0)
            self.assertEqual(local_res.status, "EXCELLENT")
            self.assertEqual(export_res.status, "EXCELLENT")
        finally:
            os.unlink(tmp_path)

    def test_2_invalid_numeric_values(self):
        """2. Non-numeric values in numeric columns are detected as invalid."""
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".csv", delete=False, encoding="utf-8"
        ) as f:
            # 2 valid numbers, 1 invalid string in a numeric column
            f.write("age,score\n25,100\nnot_an_age,95\n30,90\n")
            tmp_path = f.name
        try:
            rules = [ColumnValidityRule("age", expected_type="numeric")]
            engine = ValidityEngine(rules=rules)
            local_res, export_res = engine.evaluate(tmp_path)
            self.assertGreater(local_res.invalid_value_count, 0)
            self.assertEqual(local_res.affected_column_count, 1)
            age_diag = next(d for d in local_res.column_diagnostics if d.column_name == "age")
            self.assertEqual(age_diag.failure_reasons["type_mismatch"], 1)
        finally:
            os.unlink(tmp_path)

    def test_3_invalid_boolean_values(self):
        """3. Invalid boolean representations are detected as invalid."""
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".csv", delete=False, encoding="utf-8"
        ) as f:
            f.write("active,enabled\ntrue,1\nmaybe,false\nno,0\n")
            tmp_path = f.name
        try:
            rules = [ColumnValidityRule("active", expected_type="boolean")]
            engine = ValidityEngine(rules=rules)
            local_res, export_res = engine.evaluate(tmp_path)
            self.assertEqual(local_res.invalid_value_count, 1)
            act_diag = next(d for d in local_res.column_diagnostics if d.column_name == "active")
            self.assertEqual(act_diag.failure_reasons["type_mismatch"], 1)
        finally:
            os.unlink(tmp_path)

    def test_4_missing_values_not_invalid_by_default(self):
        """4. Semantic rule: Missing values are NOT classified as invalid by default."""
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".csv", delete=False, encoding="utf-8"
        ) as f:
            f.write("age,salary\n25,50000\n,60000\n30,null\n")
            tmp_path = f.name
        try:
            # Default behavior (allow_missing=True)
            engine = ValidityEngine()
            local_res, export_res = engine.evaluate(tmp_path)
            self.assertEqual(local_res.invalid_value_count, 0)
            self.assertEqual(local_res.validity_score, 100.0)
            self.assertEqual(local_res.affected_column_count, 0)
        finally:
            os.unlink(tmp_path)

    def test_5_allowed_categorical_values(self):
        """5. Categorical column against an allowed values set."""
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".csv", delete=False, encoding="utf-8"
        ) as f:
            f.write("dept\nSales\nEngineering\nMarketing\nInvalidDept\n")
            tmp_path = f.name
        try:
            rules = [
                ColumnValidityRule(
                    "dept",
                    allowed_values={"Sales", "Engineering", "Marketing"},
                )
            ]
            engine = ValidityEngine(rules=rules)
            local_res, export_res = engine.evaluate(tmp_path)
            self.assertEqual(local_res.invalid_value_count, 1)
            dept_diag = next(d for d in local_res.column_diagnostics if d.column_name == "dept")
            self.assertEqual(dept_diag.failure_reasons["disallowed_value"], 1)
        finally:
            os.unlink(tmp_path)

    def test_6_numeric_range_validation(self):
        """6. Numeric values outside min/max bounds are marked invalid."""
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".csv", delete=False, encoding="utf-8"
        ) as f:
            f.write("percentage\n50\n105\n-5\n75\n")
            tmp_path = f.name
        try:
            rules = [
                ColumnValidityRule("percentage", expected_type="numeric", min_value=0.0, max_value=100.0)
            ]
            engine = ValidityEngine(rules=rules)
            local_res, export_res = engine.evaluate(tmp_path)
            self.assertEqual(local_res.invalid_value_count, 2)  # 105 and -5
            p_diag = next(d for d in local_res.column_diagnostics if d.column_name == "percentage")
            self.assertEqual(p_diag.failure_reasons["range_violation"], 2)
        finally:
            os.unlink(tmp_path)

    def test_7_pattern_validation(self):
        """7. Regex pattern validation correctly identifies mismatches."""
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".csv", delete=False, encoding="utf-8"
        ) as f:
            f.write("code\nABC-123\nXYZ-999\nINVALID\nDEF-456\n")
            tmp_path = f.name
        try:
            rules = [ColumnValidityRule("code", pattern=r"^[A-Z]{3}-\d{3}$")]
            engine = ValidityEngine(rules=rules)
            local_res, export_res = engine.evaluate(tmp_path)
            self.assertEqual(local_res.invalid_value_count, 1)  # INVALID
            c_diag = next(d for d in local_res.column_diagnostics if d.column_name == "code")
            self.assertEqual(c_diag.failure_reasons["pattern_mismatch"], 1)
        finally:
            os.unlink(tmp_path)

    def test_8_validity_score_calculation(self):
        """8. Validity score = 100 - (invalid_count / values_checked * 100)."""
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".csv", delete=False, encoding="utf-8"
        ) as f:
            # 10 cells, 2 invalid
            f.write("col\n1\n2\n3\n4\n5\n6\n7\n8\ninvalid1\ninvalid2\n")
            tmp_path = f.name
        try:
            rules = [ColumnValidityRule("col", expected_type="numeric")]
            engine = ValidityEngine(rules=rules)
            local_res, export_res = engine.evaluate(tmp_path)
            self.assertEqual(local_res.total_values_checked, 10)
            self.assertEqual(local_res.invalid_value_count, 2)
            self.assertAlmostEqual(local_res.validity_score, 80.0)
            self.assertAlmostEqual(export_res.validity_score, 80.0)
        finally:
            os.unlink(tmp_path)

    def test_9_invalid_count(self):
        """9. Exact count of invalid values across all columns."""
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".csv", delete=False, encoding="utf-8"
        ) as f:
            f.write("a,b\n1,yes\nbad1,no\n3,bad2\n")
            tmp_path = f.name
        try:
            rules = [
                ColumnValidityRule("a", expected_type="numeric"),
                ColumnValidityRule("b", expected_type="boolean"),
            ]
            engine = ValidityEngine(rules=rules)
            local_res, export_res = engine.evaluate(tmp_path)
            self.assertEqual(local_res.invalid_value_count, 2)
            self.assertEqual(export_res.invalid_value_count, 2)
        finally:
            os.unlink(tmp_path)

    def test_10_invalid_rate(self):
        """10. Invalid rate percentage calculation."""
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".csv", delete=False, encoding="utf-8"
        ) as f:
            f.write("num\n1\n2\n3\n4\nbad\n")
            tmp_path = f.name
        try:
            rules = [ColumnValidityRule("num", expected_type="numeric")]
            engine = ValidityEngine(rules=rules)
            local_res, export_res = engine.evaluate(tmp_path)
            # 1 bad out of 5 checked = 20%
            self.assertAlmostEqual(local_res.invalid_rate, 20.0)
            self.assertAlmostEqual(export_res.invalid_rate, 20.0)
        finally:
            os.unlink(tmp_path)

    def test_11_affected_column_count(self):
        """11. Count of columns containing at least one invalid value."""
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".csv", delete=False, encoding="utf-8"
        ) as f:
            f.write("a,b,c\nbad_num,true,ok\n10,bad_bool,ok\n")
            tmp_path = f.name
        try:
            rules = [
                ColumnValidityRule("a", expected_type="numeric"),
                ColumnValidityRule("b", expected_type="boolean"),
            ]
            engine = ValidityEngine(rules=rules)
            local_res, export_res = engine.evaluate(tmp_path)
            self.assertEqual(local_res.affected_column_count, 2)
            self.assertEqual(export_res.affected_column_count, 2)
        finally:
            os.unlink(tmp_path)

    def test_12_configurable_rules(self):
        """12. Configurable rules customize type, range, pattern, and allowed values."""
        rules = [
            ColumnValidityRule("age", min_value=18, max_value=65),
            ColumnValidityRule("email", pattern=r"^[\w\.-]+@[\w\.-]+\.\w+$"),
            ColumnValidityRule("city", allowed_values={"New York", "Chicago", "Houston"}),
        ]
        engine = ValidityEngine(rules=rules)
        local_res, export_res = engine.evaluate(FIXTURE_CSV)
        self.assertIsInstance(local_res, ValidityLocalResult)
        self.assertIsInstance(export_res, ValidityExportResult)

    def test_13_export_contains_aggregates_only(self):
        """13. Export result contains only numerical and status aggregate keys."""
        engine = ValidityEngine()
        _, export_res = engine.evaluate(FIXTURE_CSV)
        d = export_res.to_dict()
        expected_keys = {
            "validity_score",
            "invalid_value_count",
            "total_values_checked",
            "invalid_rate",
            "affected_column_count",
            "status",
            "raw_records_transferred",
        }
        self.assertEqual(set(d.keys()), expected_keys)

    def test_14_export_guarantees_raw_records_transferred_zero(self):
        """14. Export result strictly enforces raw_records_transferred == 0."""
        engine = ValidityEngine()
        _, export_res = engine.evaluate(FIXTURE_CSV)
        self.assertEqual(export_res.raw_records_transferred, 0)
        self.assertEqual(export_res.to_dict()["raw_records_transferred"], 0)

    def test_15_export_contains_no_column_names(self):
        """15. Export result does not leak column names in JSON serialization."""
        engine = ValidityEngine()
        _, export_res = engine.evaluate(FIXTURE_CSV)
        d_str = json.dumps(export_res.to_dict())
        for col in ["customer_id", "name", "email", "age", "city", "income", "is_premium", "signup_date"]:
            self.assertNotIn(col, d_str)

    def test_16_export_contains_no_raw_values(self):
        """16. Export result contains no raw values or record dictionaries."""
        engine = ValidityEngine()
        _, export_res = engine.evaluate(FIXTURE_CSV)
        d = export_res.to_dict()
        d_str = json.dumps(d)
        for raw in ["Alice Marsh", "alice.marsh@example.com", "Bob Fenwick", "72000", "C001"]:
            self.assertNotIn(raw, d_str)

        for v in d.values():
            self.assertNotIsInstance(v, list)
            self.assertNotIsInstance(v, dict)

    def test_17_cli_validity_command_succeeds(self):
        """17. CLI validity command succeeds with exit code 0."""
        env = {**os.environ, "PYTHONIOENCODING": "utf-8"}
        result = subprocess.run(
            [sys.executable, "-m", "verdix_agent.cli", "validity", FIXTURE_CSV],
            capture_output=True,
            text=True,
            cwd=_AGENT_DIR,
            env=env,
        )
        self.assertEqual(
            result.returncode,
            0,
            f"CLI validity command failed: STDOUT: {result.stdout}, STDERR: {result.stderr}",
        )
        out = result.stdout
        self.assertIn("VERDIX VALIDITY EVALUATION", out)
        self.assertIn("Rows:", out)
        self.assertIn("Values checked:", out)
        self.assertIn("Invalid values:", out)
        self.assertIn("Invalid rate:", out)
        self.assertIn("Validity score:", out)
        self.assertIn("Status:", out)
        self.assertIn("Raw records sent:", out)
        self.assertIn("0", out)

    def test_18_cli_output_does_not_leak_personal_data(self):
        """18. CLI output does not contain synthetic personal names/emails."""
        env = {**os.environ, "PYTHONIOENCODING": "utf-8"}
        result = subprocess.run(
            [sys.executable, "-m", "verdix_agent.cli", "validity", FIXTURE_CSV],
            capture_output=True,
            text=True,
            cwd=_AGENT_DIR,
            env=env,
        )
        out = result.stdout
        for pii in [
            "Alice Marsh",
            "alice.marsh@example.com",
            "bob.fenwick@example.com",
            "Bob Fenwick",
            "Carol Baines",
            "72000",
            "C001",
        ]:
            self.assertNotIn(pii, out)

    def test_19_empty_dataset_handling(self):
        """19. Empty CSV raises ValueError and CLI returns exit code 1."""
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".csv", delete=False, encoding="utf-8"
        ) as f:
            f.write("")
            tmp_path = f.name
        try:
            engine = ValidityEngine()
            with self.assertRaises(ValueError):
                engine.evaluate(tmp_path)

            env = {**os.environ, "PYTHONIOENCODING": "utf-8"}
            cli_res = subprocess.run(
                [sys.executable, "-m", "verdix_agent.cli", "validity", tmp_path],
                capture_output=True,
                text=True,
                cwd=_AGENT_DIR,
                env=env,
            )
            self.assertEqual(cli_res.returncode, 1)
        finally:
            os.unlink(tmp_path)

    def test_20_malformed_csv_handling(self):
        """20. Malformed CSV rows are padded without crashing."""
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".csv", delete=False, encoding="utf-8"
        ) as f:
            f.write("a,b,c\n1,true\n2,false,hello\n")
            tmp_path = f.name
        try:
            engine = ValidityEngine()
            local_res, export_res = engine.evaluate(tmp_path)
            self.assertEqual(local_res.row_count, 2)
            self.assertEqual(export_res.raw_records_transferred, 0)
        finally:
            os.unlink(tmp_path)

    def test_21_integration_with_evaluation_engine(self):
        """21. EvaluationEngine.evaluate_validity works directly."""
        eval_engine = EvaluationEngine()
        local_res, export_res = eval_engine.evaluate_validity(FIXTURE_CSV)
        self.assertIsInstance(local_res, ValidityLocalResult)
        self.assertIsInstance(export_res, ValidityExportResult)
        self.assertEqual(export_res.raw_records_transferred, 0)

    def test_22_allow_missing_false_marks_missing_invalid(self):
        """22. Explicit allow_missing=False rule marks missing cells invalid."""
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".csv", delete=False, encoding="utf-8"
        ) as f:
            f.write("required_id\n101\n\n103\n")
            tmp_path = f.name
        try:
            rule = ColumnValidityRule("required_id", allow_missing=False)
            engine = ValidityEngine(rules=[rule])
            local_res, export_res = engine.evaluate(tmp_path)
            self.assertEqual(local_res.invalid_value_count, 1)
            diag = local_res.column_diagnostics[0]
            self.assertEqual(diag.failure_reasons["missing_not_allowed"], 1)
        finally:
            os.unlink(tmp_path)


if __name__ == "__main__":
    unittest.main()
