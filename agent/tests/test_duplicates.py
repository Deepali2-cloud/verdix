"""
VERDIX Step 8D — Duplicate Evaluation Engine Unit Tests.

Covers:
  1.  dataset with no duplicates (100% unique, 0% duplicate rate)
  2.  dataset with exact duplicate rows
  3.  multiple duplicate rows (e.g. 3 copies of one record)
  4.  multiple duplicate groups (e.g. group A and group B duplicated)
  5.  duplicate row count calculation
  6.  unique row count calculation
  7.  duplicate rate calculation
  8.  duplicate group count calculation
  9.  status thresholds (EXCELLENT, GOOD, FAIR, POOR)
  10. configurable thresholds
  11. export contains aggregates only
  12. export guarantees raw_records_transferred = 0
  13. export contains no column names
  14. export contains no raw values
  15. export contains no raw records
  16. CLI duplicates command succeeds
  17. CLI does not leak synthetic names/emails
  18. empty dataset handling
  19. header-only CSV handling
  20. malformed input handling
  21. integration with EvaluationEngine.evaluate_duplicates
  22. semantic rule: partial field repeats (same name/email) do NOT count as duplicate rows
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

from verdix_agent.duplicates import (
    DuplicateEngine,
    DuplicateThresholds,
    DuplicateLocalResult,
    DuplicateExportResult,
)
from verdix_agent.engine import EvaluationEngine

FIXTURE_CSV = os.path.join(
    os.path.dirname(__file__), "fixtures", "synthetic_customers.csv"
)

# Known facts for synthetic_customers.csv:
# 26 total rows
# Exactly 1 duplicate row: C001 (Alice Marsh) appears at row 2 and row 22.
# 25 unique row patterns
# 1 duplicate group
# duplicate_rate = (1 / 26) * 100 = ~3.846% -> 3.85% (Status: FAIR under default thresholds)
EXPECTED_ROWS = 26
EXPECTED_UNIQUE = 25
EXPECTED_DUP_ROWS = 1
EXPECTED_DUP_GROUPS = 1


class TestDuplicateEngine(unittest.TestCase):
    """Test suite for Step 8D Duplicate Evaluation Engine."""

    def test_1_no_duplicates(self):
        """1. Dataset with no duplicates: 0 duplicates, 100% unique, EXCELLENT status."""
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".csv", delete=False, encoding="utf-8"
        ) as f:
            f.write("id,name,role\n1,Alice,Engineer\n2,Bob,Analyst\n3,Carol,Manager\n")
            tmp_path = f.name
        try:
            engine = DuplicateEngine()
            local_res, export_res = engine.evaluate(tmp_path)
            self.assertEqual(local_res.row_count, 3)
            self.assertEqual(local_res.unique_row_count, 3)
            self.assertEqual(local_res.duplicate_row_count, 0)
            self.assertEqual(local_res.duplicate_rate, 0.0)
            self.assertEqual(local_res.duplicate_group_count, 0)
            self.assertEqual(local_res.status, "EXCELLENT")
            self.assertEqual(export_res.status, "EXCELLENT")
        finally:
            os.unlink(tmp_path)

    def test_2_exact_duplicate_rows(self):
        """2. Dataset with exact duplicate rows is accurately identified."""
        engine = DuplicateEngine()
        local_res, export_res = engine.evaluate(FIXTURE_CSV)
        self.assertEqual(local_res.duplicate_row_count, EXPECTED_DUP_ROWS)
        self.assertEqual(export_res.duplicate_row_count, EXPECTED_DUP_ROWS)
        self.assertEqual(local_res.unique_row_count, EXPECTED_UNIQUE)
        self.assertEqual(export_res.unique_row_count, EXPECTED_UNIQUE)

    def test_3_multiple_duplicate_rows(self):
        """3. Multiple copies of a single row: 3 copies -> 2 duplicates."""
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".csv", delete=False, encoding="utf-8"
        ) as f:
            f.write("a,b\n1,x\n1,x\n1,x\n2,y\n")
            tmp_path = f.name
        try:
            engine = DuplicateEngine()
            local_res, export_res = engine.evaluate(tmp_path)
            self.assertEqual(local_res.row_count, 4)
            self.assertEqual(local_res.duplicate_row_count, 2)
            self.assertEqual(local_res.unique_row_count, 2)
            self.assertEqual(local_res.duplicate_group_count, 1)
        finally:
            os.unlink(tmp_path)

    def test_4_multiple_duplicate_groups(self):
        """4. Multiple distinct row patterns duplicated -> multiple groups."""
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".csv", delete=False, encoding="utf-8"
        ) as f:
            f.write("a,b\n1,x\n1,x\n2,y\n2,y\n3,z\n")
            tmp_path = f.name
        try:
            engine = DuplicateEngine()
            local_res, export_res = engine.evaluate(tmp_path)
            self.assertEqual(local_res.row_count, 5)
            self.assertEqual(local_res.duplicate_group_count, 2)
            self.assertEqual(local_res.duplicate_row_count, 2)
            self.assertEqual(local_res.unique_row_count, 3)
        finally:
            os.unlink(tmp_path)

    def test_5_duplicate_row_count(self):
        """5. Duplicate row count correctly counts surplus duplicate records."""
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".csv", delete=False, encoding="utf-8"
        ) as f:
            f.write("val\nA\nA\nB\nB\nB\nC\n")
            tmp_path = f.name
        try:
            engine = DuplicateEngine()
            local_res, export_res = engine.evaluate(tmp_path)
            # A has 1 surplus, B has 2 surplus -> 3 duplicates
            self.assertEqual(local_res.duplicate_row_count, 3)
            self.assertEqual(export_res.duplicate_row_count, 3)
        finally:
            os.unlink(tmp_path)

    def test_6_unique_row_count(self):
        """6. Unique row count equals distinct pattern count."""
        engine = DuplicateEngine()
        local_res, export_res = engine.evaluate(FIXTURE_CSV)
        self.assertEqual(local_res.unique_row_count, EXPECTED_UNIQUE)
        self.assertEqual(local_res.unique_row_count + local_res.duplicate_row_count, local_res.row_count)

    def test_7_duplicate_rate(self):
        """7. Duplicate rate = (duplicate_row_count / row_count) * 100."""
        engine = DuplicateEngine()
        local_res, export_res = engine.evaluate(FIXTURE_CSV)
        expected_rate = (1 / 26) * 100.0
        self.assertAlmostEqual(local_res.duplicate_rate, expected_rate, places=2)
        self.assertAlmostEqual(export_res.duplicate_rate, round(expected_rate, 2), places=2)

    def test_8_duplicate_group_count(self):
        """8. Duplicate group count matches number of distinct duplicated rows."""
        engine = DuplicateEngine()
        local_res, export_res = engine.evaluate(FIXTURE_CSV)
        self.assertEqual(local_res.duplicate_group_count, EXPECTED_DUP_GROUPS)
        self.assertEqual(export_res.duplicate_group_count, EXPECTED_DUP_GROUPS)

    def test_9_status_thresholds(self):
        """9. Status thresholds map correctly to EXCELLENT, GOOD, FAIR, POOR."""
        t = DuplicateThresholds()
        self.assertEqual(t.evaluate_status(0.0), "EXCELLENT")
        self.assertEqual(t.evaluate_status(1.5), "GOOD")
        self.assertEqual(t.evaluate_status(2.0), "GOOD")
        self.assertEqual(t.evaluate_status(3.85), "FAIR")
        self.assertEqual(t.evaluate_status(5.0), "FAIR")
        self.assertEqual(t.evaluate_status(5.01), "POOR")
        self.assertEqual(t.evaluate_status(10.0), "POOR")

    def test_10_configurable_thresholds(self):
        """10. Custom thresholds alter status categorization."""
        strict = DuplicateThresholds(excellent=0.0, good=1.0, fair=2.0)
        engine_strict = DuplicateEngine(thresholds=strict)
        local_res, export_res = engine_strict.evaluate(FIXTURE_CSV)
        # Duplicate rate is ~3.85%, which is > fair(2.0) under strict -> POOR
        self.assertEqual(local_res.status, "POOR")
        self.assertEqual(export_res.status, "POOR")

    def test_11_export_contains_aggregates_only(self):
        """11. Export result contains only expected aggregate fields."""
        engine = DuplicateEngine()
        _, export_res = engine.evaluate(FIXTURE_CSV)
        d = export_res.to_dict()
        expected_keys = {
            "row_count",
            "unique_row_count",
            "duplicate_row_count",
            "duplicate_rate",
            "duplicate_group_count",
            "status",
            "raw_records_transferred",
        }
        self.assertEqual(set(d.keys()), expected_keys)

    def test_12_export_guarantees_raw_records_transferred_zero(self):
        """12. Export result strictly enforces raw_records_transferred == 0."""
        engine = DuplicateEngine()
        _, export_res = engine.evaluate(FIXTURE_CSV)
        self.assertEqual(export_res.raw_records_transferred, 0)
        self.assertEqual(export_res.to_dict()["raw_records_transferred"], 0)

    def test_13_export_contains_no_column_names(self):
        """13. Export result does not leak column names in JSON."""
        engine = DuplicateEngine()
        _, export_res = engine.evaluate(FIXTURE_CSV)
        d_str = json.dumps(export_res.to_dict())
        for col in ["customer_id", "name", "email", "age", "city", "income", "is_premium", "signup_date"]:
            self.assertNotIn(col, d_str)

    def test_14_export_contains_no_raw_values(self):
        """14. Export result contains no raw values."""
        engine = DuplicateEngine()
        _, export_res = engine.evaluate(FIXTURE_CSV)
        d_str = json.dumps(export_res.to_dict())
        for raw in ["Alice Marsh", "alice.marsh@example.com", "Bob Fenwick", "72000", "C001"]:
            self.assertNotIn(raw, d_str)

    def test_15_export_contains_no_raw_records(self):
        """15. Export result contains no lists or dicts representing records."""
        engine = DuplicateEngine()
        _, export_res = engine.evaluate(FIXTURE_CSV)
        for v in export_res.to_dict().values():
            self.assertNotIsInstance(v, list)
            self.assertNotIsInstance(v, dict)

    def test_16_cli_duplicates_command_succeeds(self):
        """16. CLI duplicates command succeeds with return code 0."""
        env = {**os.environ, "PYTHONIOENCODING": "utf-8"}
        result = subprocess.run(
            [sys.executable, "-m", "verdix_agent.cli", "duplicates", FIXTURE_CSV],
            capture_output=True,
            text=True,
            cwd=_AGENT_DIR,
            env=env,
        )
        self.assertEqual(
            result.returncode,
            0,
            f"CLI duplicates command failed: STDOUT: {result.stdout}, STDERR: {result.stderr}",
        )
        out = result.stdout
        self.assertIn("VERDIX DUPLICATE EVALUATION", out)
        self.assertIn("Rows:", out)
        self.assertIn("Unique rows:", out)
        self.assertIn("Duplicate rows:", out)
        self.assertIn("Duplicate rate:", out)
        self.assertIn("Duplicate groups:", out)
        self.assertIn("Status:", out)
        self.assertIn("Raw records sent:", out)
        self.assertIn("0", out)

    def test_17_cli_does_not_leak_personal_data(self):
        """17. CLI output contains only aggregate numbers, no PII."""
        env = {**os.environ, "PYTHONIOENCODING": "utf-8"}
        result = subprocess.run(
            [sys.executable, "-m", "verdix_agent.cli", "duplicates", FIXTURE_CSV],
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

    def test_18_empty_dataset_handling(self):
        """18. Empty CSV raises ValueError and CLI returns exit code 1."""
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".csv", delete=False, encoding="utf-8"
        ) as f:
            f.write("")
            tmp_path = f.name
        try:
            engine = DuplicateEngine()
            with self.assertRaises(ValueError):
                engine.evaluate(tmp_path)

            env = {**os.environ, "PYTHONIOENCODING": "utf-8"}
            cli_res = subprocess.run(
                [sys.executable, "-m", "verdix_agent.cli", "duplicates", tmp_path],
                capture_output=True,
                text=True,
                cwd=_AGENT_DIR,
                env=env,
            )
            self.assertEqual(cli_res.returncode, 1)
        finally:
            os.unlink(tmp_path)

    def test_19_header_only_csv_handling(self):
        """19. Header-only CSV reports 0 rows, 0 duplicates, EXCELLENT status."""
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".csv", delete=False, encoding="utf-8"
        ) as f:
            f.write("col1,col2,col3\n")
            tmp_path = f.name
        try:
            engine = DuplicateEngine()
            local_res, export_res = engine.evaluate(tmp_path)
            self.assertEqual(local_res.row_count, 0)
            self.assertEqual(local_res.unique_row_count, 0)
            self.assertEqual(local_res.duplicate_row_count, 0)
            self.assertEqual(local_res.duplicate_rate, 0.0)
            self.assertEqual(local_res.status, "EXCELLENT")
            self.assertEqual(export_res.raw_records_transferred, 0)
        finally:
            os.unlink(tmp_path)

    def test_20_malformed_input_handling(self):
        """20. Malformed rows with uneven column counts are padded and checked."""
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".csv", delete=False, encoding="utf-8"
        ) as f:
            f.write("a,b,c\n1,2\n1,2\n")  # both short rows padded identically
            tmp_path = f.name
        try:
            engine = DuplicateEngine()
            local_res, export_res = engine.evaluate(tmp_path)
            self.assertEqual(local_res.row_count, 2)
            self.assertEqual(local_res.duplicate_row_count, 1)
            self.assertEqual(export_res.raw_records_transferred, 0)
        finally:
            os.unlink(tmp_path)

    def test_21_integration_with_evaluation_engine(self):
        """21. EvaluationEngine.evaluate_duplicates works directly."""
        eval_engine = EvaluationEngine()
        local_res, export_res = eval_engine.evaluate_duplicates(FIXTURE_CSV)
        self.assertIsInstance(local_res, DuplicateLocalResult)
        self.assertIsInstance(export_res, DuplicateExportResult)
        self.assertEqual(local_res.duplicate_row_count, EXPECTED_DUP_ROWS)
        self.assertEqual(export_res.raw_records_transferred, 0)

    def test_22_semantic_rule_partial_repeats_not_duplicates(self):
        """22. Repeated names/emails alone do NOT count as duplicate rows if other columns differ."""
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".csv", delete=False, encoding="utf-8"
        ) as f:
            # Same name and email, but different IDs and different scores
            f.write("id,name,email,score\n1,Alice,alice@example.com,90\n2,Alice,alice@example.com,95\n")
            tmp_path = f.name
        try:
            engine = DuplicateEngine()
            local_res, export_res = engine.evaluate(tmp_path)
            self.assertEqual(local_res.row_count, 2)
            self.assertEqual(local_res.unique_row_count, 2)
            self.assertEqual(local_res.duplicate_row_count, 0)
            self.assertEqual(local_res.duplicate_rate, 0.0)
            self.assertEqual(local_res.status, "EXCELLENT")
        finally:
            os.unlink(tmp_path)


if __name__ == "__main__":
    unittest.main()
