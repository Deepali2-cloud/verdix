"""
VERDIX Step 8B — Completeness Evaluation Engine Unit Tests.

Covers:
  1.  perfect dataset = 100% completeness
  2.  dataset with missing values
  3.  missing-rate calculation
  4.  total missing cells
  5.  total cells
  6.  affected-column count
  7.  status threshold mapping (EXCELLENT, GOOD, FAIR, POOR)
  8.  configurable thresholds
  9.  export result contains aggregates only
  10. export result contains raw_records_transferred = 0
  11. export result contains no column names
  12. export result contains no raw values
  13. CLI completeness command succeeds
  14. CLI does not leak synthetic personal names/emails
  15. empty dataset handling
  16. header-only CSV
  17. malformed CSV handling
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

from verdix_agent.completeness import (
    CompletenessEngine,
    CompletenessThresholds,
    CompletenessLocalResult,
    CompletenessExportResult,
)
from verdix_agent.profiler.csv_profiler import CsvProfiler, LocalProfile
from verdix_agent.engine import EvaluationEngine

FIXTURE_CSV = os.path.join(
    os.path.dirname(__file__), "fixtures", "synthetic_customers.csv"
)

# Known facts for synthetic_customers.csv:
# 26 rows, 8 columns => 208 total cells
# 4 missing cells across 3 columns:
#   - city (1)
#   - email (2)
#   - age (1)
# missing_rate = 4 / 208 * 100 = ~1.9231%
# completeness_score = 100 - 1.9231 = ~98.0769%
EXPECTED_ROWS = 26
EXPECTED_COLS = 8
EXPECTED_TOTAL_CELLS = 208
EXPECTED_MISSING_CELLS = 4
EXPECTED_AFFECTED_COLS = 3


class TestCompletenessEngine(unittest.TestCase):
    """Test suite for Step 8B Completeness Engine."""

    def test_1_perfect_dataset_completeness_is_100(self):
        """1. Perfect dataset = 100% completeness score and 0 missing rate."""
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".csv", delete=False, encoding="utf-8"
        ) as f:
            f.write("col_a,col_b,col_c\n1,apple,10.5\n2,banana,20.0\n3,cherry,30.2\n")
            tmp_path = f.name
        try:
            engine = CompletenessEngine()
            local_res, export_res = engine.evaluate(tmp_path)
            self.assertEqual(local_res.completeness_score, 100.0)
            self.assertEqual(export_res.completeness_score, 100.0)
            self.assertEqual(local_res.missing_cells, 0)
            self.assertEqual(local_res.missing_rate, 0.0)
            self.assertEqual(export_res.missing_rate, 0.0)
            self.assertEqual(local_res.affected_column_count, 0)
            self.assertEqual(local_res.status, "EXCELLENT")
            self.assertEqual(export_res.status, "EXCELLENT")
        finally:
            os.unlink(tmp_path)

    def test_2_dataset_with_missing_values(self):
        """2. Dataset with missing values correctly reflects completeness."""
        engine = CompletenessEngine()
        local_res, export_res = engine.evaluate(FIXTURE_CSV)
        self.assertLess(local_res.completeness_score, 100.0)
        self.assertGreater(local_res.completeness_score, 0.0)
        self.assertGreater(local_res.missing_cells, 0)

    def test_3_missing_rate_calculation(self):
        """3. Missing-rate calculation is accurate."""
        engine = CompletenessEngine()
        local_res, export_res = engine.evaluate(FIXTURE_CSV)
        expected_rate = (EXPECTED_MISSING_CELLS / EXPECTED_TOTAL_CELLS) * 100.0
        self.assertAlmostEqual(local_res.missing_rate, expected_rate, places=2)
        self.assertAlmostEqual(export_res.missing_rate, expected_rate, places=2)

    def test_4_total_missing_cells(self):
        """4. Total missing cells matches known fixture count."""
        engine = CompletenessEngine()
        local_res, export_res = engine.evaluate(FIXTURE_CSV)
        self.assertEqual(local_res.missing_cells, EXPECTED_MISSING_CELLS)
        self.assertEqual(export_res.missing_cells, EXPECTED_MISSING_CELLS)

    def test_5_total_cells(self):
        """5. Total cells equals rows multiplied by columns."""
        engine = CompletenessEngine()
        local_res, export_res = engine.evaluate(FIXTURE_CSV)
        self.assertEqual(local_res.total_cells, EXPECTED_TOTAL_CELLS)
        self.assertEqual(export_res.total_cells, EXPECTED_TOTAL_CELLS)

    def test_6_affected_column_count(self):
        """6. Number of columns affected by missing data is accurate."""
        engine = CompletenessEngine()
        local_res, export_res = engine.evaluate(FIXTURE_CSV)
        self.assertEqual(local_res.affected_column_count, EXPECTED_AFFECTED_COLS)
        self.assertEqual(export_res.affected_column_count, EXPECTED_AFFECTED_COLS)
        # Verify internal details exist in local result
        affected_names = {c.name for c in local_res.affected_columns}
        self.assertIn("city", affected_names)
        self.assertIn("email", affected_names)
        self.assertIn("age", affected_names)
        # Verify highest missing rate column
        self.assertIsNotNone(local_res.highest_missing_rate_column)
        self.assertIn(local_res.highest_missing_rate_column, ["email", "city", "age"])

    def test_7_status_threshold_bands(self):
        """7. Status threshold default bands map correctly."""
        t = CompletenessThresholds()
        self.assertEqual(t.evaluate_status(95.0), "EXCELLENT")
        self.assertEqual(t.evaluate_status(99.9), "EXCELLENT")
        self.assertEqual(t.evaluate_status(100.0), "EXCELLENT")
        self.assertEqual(t.evaluate_status(90.0), "GOOD")
        self.assertEqual(t.evaluate_status(94.99), "GOOD")
        self.assertEqual(t.evaluate_status(75.0), "FAIR")
        self.assertEqual(t.evaluate_status(89.99), "FAIR")
        self.assertEqual(t.evaluate_status(74.99), "POOR")
        self.assertEqual(t.evaluate_status(50.0), "POOR")
        self.assertEqual(t.evaluate_status(0.0), "POOR")

    def test_8_configurable_thresholds(self):
        """8. Configurable thresholds alter status categorization."""
        strict_thresholds = CompletenessThresholds(
            excellent=99.0, good=95.0, fair=90.0
        )
        engine_strict = CompletenessEngine(thresholds=strict_thresholds)
        local_res, export_res = engine_strict.evaluate(FIXTURE_CSV)
        # Score is ~98.08. Under strict thresholds (excellent>=99.0, good>=95.0), it should be GOOD
        self.assertEqual(local_res.status, "GOOD")
        self.assertEqual(export_res.status, "GOOD")

    def test_9_export_result_contains_aggregates_only(self):
        """9. Export result contains only numerical/status aggregate keys."""
        engine = CompletenessEngine()
        _, export_res = engine.evaluate(FIXTURE_CSV)
        d = export_res.to_dict()
        expected_keys = {
            "completeness_score",
            "missing_rate",
            "missing_cells",
            "total_cells",
            "affected_column_count",
            "status",
            "raw_records_transferred",
        }
        self.assertEqual(set(d.keys()), expected_keys)

    def test_10_export_result_raw_records_transferred_zero(self):
        """10. Export result guarantees raw_records_transferred == 0."""
        engine = CompletenessEngine()
        _, export_res = engine.evaluate(FIXTURE_CSV)
        self.assertEqual(export_res.raw_records_transferred, 0)
        self.assertEqual(export_res.to_dict()["raw_records_transferred"], 0)

    def test_11_export_result_contains_no_column_names(self):
        """11. Export result does not leak column names in JSON serialization."""
        engine = CompletenessEngine()
        _, export_res = engine.evaluate(FIXTURE_CSV)
        d_str = json.dumps(export_res.to_dict())
        for col_name in ["customer_id", "name", "email", "age", "city", "income", "is_premium", "signup_date"]:
            self.assertNotIn(
                col_name,
                d_str,
                f"Export result must not leak column name: {col_name}",
            )

    def test_12_export_result_contains_no_raw_values(self):
        """12. Export result does not contain raw values or row dictionaries."""
        engine = CompletenessEngine()
        _, export_res = engine.evaluate(FIXTURE_CSV)
        d = export_res.to_dict()
        d_str = json.dumps(d)
        for raw_val in [
            "Alice Marsh",
            "alice.marsh@example.com",
            "Bob Fenwick",
            "New York",
            "72000",
            "C001",
        ]:
            self.assertNotIn(raw_val, d_str)

        for v in d.values():
            self.assertNotIsInstance(v, list)
            self.assertNotIsInstance(v, dict)

    def test_13_cli_completeness_command_succeeds(self):
        """13. CLI completeness command succeeds with exit code 0."""
        env = {**os.environ, "PYTHONIOENCODING": "utf-8"}
        result = subprocess.run(
            [sys.executable, "-m", "verdix_agent.cli", "completeness", FIXTURE_CSV],
            capture_output=True,
            text=True,
            cwd=_AGENT_DIR,
            env=env,
        )
        self.assertEqual(
            result.returncode,
            0,
            f"CLI completeness command failed: STDOUT: {result.stdout}, STDERR: {result.stderr}",
        )
        out = result.stdout
        self.assertIn("VERDIX COMPLETENESS EVALUATION", out)
        self.assertIn("Rows:", out)
        self.assertIn("Total cells:", out)
        self.assertIn("Missing cells:", out)
        self.assertIn("Missing rate:", out)
        self.assertIn("Completeness score:", out)
        self.assertIn("Status:", out)
        self.assertIn("Raw records sent:", out)
        self.assertIn("0", out)

    def test_14_cli_output_does_not_leak_personal_data(self):
        """14. CLI output contains only aggregates, no PII or synthetic names/emails."""
        env = {**os.environ, "PYTHONIOENCODING": "utf-8"}
        result = subprocess.run(
            [sys.executable, "-m", "verdix_agent.cli", "completeness", FIXTURE_CSV],
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
            self.assertNotIn(
                pii, out, f"CLI output leaked sensitive/synthetic value: {pii}"
            )

    def test_15_empty_dataset_handling(self):
        """15. Empty CSV raises ValueError and returns error exit code in CLI."""
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".csv", delete=False, encoding="utf-8"
        ) as f:
            f.write("")
            tmp_path = f.name
        try:
            engine = CompletenessEngine()
            with self.assertRaises(ValueError):
                engine.evaluate(tmp_path)

            env = {**os.environ, "PYTHONIOENCODING": "utf-8"}
            cli_res = subprocess.run(
                [sys.executable, "-m", "verdix_agent.cli", "completeness", tmp_path],
                capture_output=True,
                text=True,
                cwd=_AGENT_DIR,
                env=env,
            )
            self.assertEqual(cli_res.returncode, 1)
            self.assertIn("Error:", cli_res.stderr)
        finally:
            os.unlink(tmp_path)

    def test_16_header_only_csv_handling(self):
        """16. Header-only CSV handles 0 rows safely."""
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".csv", delete=False, encoding="utf-8"
        ) as f:
            f.write("col_a,col_b,col_c\n")
            tmp_path = f.name
        try:
            engine = CompletenessEngine()
            local_res, export_res = engine.evaluate(tmp_path)
            self.assertEqual(local_res.row_count, 0)
            self.assertEqual(local_res.total_cells, 0)
            self.assertEqual(local_res.missing_cells, 0)
            self.assertEqual(local_res.completeness_score, 100.0)
            self.assertEqual(export_res.raw_records_transferred, 0)
        finally:
            os.unlink(tmp_path)

    def test_17_malformed_csv_handling(self):
        """17. Malformed CSV rows are handled safely without crashing."""
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".csv", delete=False, encoding="utf-8"
        ) as f:
            f.write("col1,col2,col3\n")
            f.write("val1\n")          # missing 2 columns
            f.write("val1,val2,val3\n")
            tmp_path = f.name
        try:
            engine = CompletenessEngine()
            local_res, export_res = engine.evaluate(tmp_path)
            self.assertEqual(local_res.row_count, 2)
            self.assertEqual(local_res.column_count, 3)
            self.assertGreater(local_res.missing_cells, 0)
            self.assertEqual(export_res.raw_records_transferred, 0)
        finally:
            os.unlink(tmp_path)

    def test_integration_with_evaluation_engine(self):
        """EvaluationEngine.evaluate_completeness works directly."""
        eval_engine = EvaluationEngine()
        local_res, export_res = eval_engine.evaluate_completeness(FIXTURE_CSV)
        self.assertEqual(local_res.total_cells, EXPECTED_TOTAL_CELLS)
        self.assertEqual(export_res.raw_records_transferred, 0)

    def test_profile_reuse_avoids_rereading_csv(self):
        """CompletenessEngine can accept pre-computed LocalProfile directly."""
        profiler = CsvProfiler(FIXTURE_CSV)
        local_profile, _ = profiler.profile()

        engine = CompletenessEngine()
        local_res, export_res = engine.evaluate_profile(local_profile)
        self.assertEqual(local_res.total_cells, EXPECTED_TOTAL_CELLS)
        self.assertEqual(export_res.missing_cells, EXPECTED_MISSING_CELLS)


if __name__ == "__main__":
    unittest.main()
