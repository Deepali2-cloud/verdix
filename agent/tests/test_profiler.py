"""
VERDIX Step 8A — CSV Profiler Unit Tests.

Tests 14 required invariants covering:
  1.  CSV loads successfully
  2.  Correct row count
  3.  Correct column count
  4.  Missing values detected
  5.  Duplicate rows detected
  6.  Numeric columns identified
  7.  Categorical columns identified
  8.  Completeness score calculated
  9.  Exportable profile contains aggregates only
  10. Exportable profile contains raw_records_transferred = 0
  11. Exportable profile does not contain raw records
  12. Exportable profile does not contain raw cell values
  13. CLI profile command succeeds
  14. CLI output does not contain synthetic personal names/emails

Synthetic data is loaded from: tests/fixtures/synthetic_customers.csv
All tests run without network access (fully local).
"""

import os
import sys
import io
import json
import csv
import tempfile
import unittest
import subprocess

# Ensure agent root is on path
_AGENT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if _AGENT_DIR not in sys.path:
    sys.path.insert(0, _AGENT_DIR)

from verdix_agent.profiler.csv_profiler import CsvProfiler, LocalProfile, ExportableProfile

# ------------------------------------------------------------------
# Path to synthetic fixture
# ------------------------------------------------------------------
FIXTURE_CSV = os.path.join(
    os.path.dirname(__file__), "fixtures", "synthetic_customers.csv"
)

# Known facts about synthetic_customers.csv (used in assertions)
# Rows: 26 data rows (incl. 1 duplicate of row C001)
# Columns: 8
# Missing values: city(row9), email(row11), email(row15), age(row19) => 4 missing cells
# Duplicate rows: 1 (C001 repeated)
# Numeric columns: age, income
# Categorical columns: customer_id, name, email, city, signup_date
# Boolean columns: is_premium
EXPECTED_ROW_COUNT = 26
EXPECTED_COL_COUNT = 8
EXPECTED_MISSING_CELLS = 4   # city, email×2, age each missing once
EXPECTED_DUPLICATE_ROWS = 1
EXPECTED_NUMERIC_COLS = 2    # age, income
EXPECTED_CATEGORICAL_COLS = 5  # customer_id, name, email, city, signup_date
EXPECTED_BOOLEAN_COLS = 1    # is_premium


class TestCsvLoading(unittest.TestCase):
    """Test 1: CSV loads successfully."""

    def test_csv_loads_successfully(self):
        profiler = CsvProfiler(FIXTURE_CSV)
        local, exportable = profiler.profile()
        self.assertIsInstance(local, LocalProfile)
        self.assertIsInstance(exportable, ExportableProfile)
        self.assertEqual(local.errors, [], "Profile should have no errors on clean CSV")


class TestRowCount(unittest.TestCase):
    """Test 2: Correct row count."""

    def test_correct_row_count(self):
        profiler = CsvProfiler(FIXTURE_CSV)
        local, exportable = profiler.profile()
        self.assertEqual(local.row_count, EXPECTED_ROW_COUNT)
        self.assertEqual(exportable.row_count, EXPECTED_ROW_COUNT)


class TestColumnCount(unittest.TestCase):
    """Test 3: Correct column count."""

    def test_correct_column_count(self):
        profiler = CsvProfiler(FIXTURE_CSV)
        local, exportable = profiler.profile()
        self.assertEqual(local.column_count, EXPECTED_COL_COUNT)
        self.assertEqual(exportable.column_count, EXPECTED_COL_COUNT)


class TestMissingValues(unittest.TestCase):
    """Test 4: Missing values detected."""

    def test_missing_values_detected(self):
        profiler = CsvProfiler(FIXTURE_CSV)
        local, _ = profiler.profile()
        self.assertGreaterEqual(
            local.overall_missing_count, EXPECTED_MISSING_CELLS,
            f"Expected at least {EXPECTED_MISSING_CELLS} missing cells"
        )
        self.assertGreater(local.overall_missing_pct, 0.0)
        # Spot check: 'city' column should have 1 missing
        city_col = next(c for c in local.columns if c.name == "city")
        self.assertGreaterEqual(city_col.missing_count, 1)


class TestDuplicateRows(unittest.TestCase):
    """Test 5: Duplicate rows detected."""

    def test_duplicate_rows_detected(self):
        profiler = CsvProfiler(FIXTURE_CSV)
        local, exportable = profiler.profile()
        self.assertEqual(local.duplicate_row_count, EXPECTED_DUPLICATE_ROWS)
        self.assertGreater(local.duplicate_row_pct, 0.0)
        self.assertGreater(exportable.duplicate_rate, 0.0)


class TestNumericColumns(unittest.TestCase):
    """Test 6: Numeric columns identified."""

    def test_numeric_columns_identified(self):
        profiler = CsvProfiler(FIXTURE_CSV)
        local, exportable = profiler.profile()
        numeric_cols = [c for c in local.columns if c.inferred_dtype == "numeric"]
        numeric_names = {c.name for c in numeric_cols}
        self.assertIn("age", numeric_names, "age should be detected as numeric")
        self.assertIn("income", numeric_names, "income should be detected as numeric")
        self.assertEqual(exportable.numeric_column_count, EXPECTED_NUMERIC_COLS)
        # Numeric columns should have stats
        for col in numeric_cols:
            if col.missing_count < col.total_count:
                self.assertIsNotNone(col.numeric_mean)
                self.assertIsNotNone(col.numeric_min)
                self.assertIsNotNone(col.numeric_max)


class TestCategoricalColumns(unittest.TestCase):
    """Test 7: Categorical columns identified."""

    def test_categorical_columns_identified(self):
        profiler = CsvProfiler(FIXTURE_CSV)
        local, exportable = profiler.profile()
        categorical_cols = [c for c in local.columns if c.inferred_dtype == "categorical"]
        categorical_names = {c.name for c in categorical_cols}
        self.assertIn("name", categorical_names)
        self.assertIn("city", categorical_names)
        self.assertEqual(exportable.categorical_column_count, EXPECTED_CATEGORICAL_COLS)


class TestCompletenessScore(unittest.TestCase):
    """Test 8: Completeness score calculated."""

    def test_completeness_score_calculated(self):
        profiler = CsvProfiler(FIXTURE_CSV)
        local, exportable = profiler.profile()
        # Completeness must be a number between 0 and 100
        self.assertGreaterEqual(local.completeness_score, 0.0)
        self.assertLessEqual(local.completeness_score, 100.0)
        # The synthetic CSV has a small missing rate — completeness should be high
        self.assertGreater(local.completeness_score, 90.0)
        # Completeness + missing_rate ≈ 100
        self.assertAlmostEqual(
            local.completeness_score + local.overall_missing_pct,
            100.0,
            places=2,
        )
        # ExportableProfile carries the same score
        self.assertAlmostEqual(
            exportable.completeness_score, local.completeness_score, places=2
        )


class TestExportableProfileIsAggregateOnly(unittest.TestCase):
    """Test 9: Exportable profile contains aggregates only."""

    def _get_exportable_dict(self) -> dict:
        profiler = CsvProfiler(FIXTURE_CSV)
        _, exportable = profiler.profile()
        return exportable.to_dict()

    def test_exportable_profile_contains_aggregates(self):
        d = self._get_exportable_dict()
        # Must have these aggregate keys
        for key in ("row_count", "column_count", "missing_rate",
                    "duplicate_rate", "completeness_score",
                    "numeric_column_count", "categorical_column_count",
                    "boolean_column_count", "raw_records_transferred"):
            self.assertIn(key, d, f"ExportableProfile.to_dict() must contain '{key}'")

    def test_exportable_profile_no_column_names(self):
        """Column names must not appear in the exportable profile."""
        d = self._get_exportable_dict()
        d_str = json.dumps(d)
        # Column names from the fixture
        pii_like_keys = ["customer_id", "name", "email", "age", "city",
                         "income", "is_premium", "signup_date"]
        for key in pii_like_keys:
            self.assertNotIn(
                key, d_str,
                f"ExportableProfile must not contain column name '{key}'"
            )

    def test_exportable_profile_no_lists_of_records(self):
        """ExportableProfile must not embed any list of records."""
        d = self._get_exportable_dict()
        for v in d.values():
            if isinstance(v, list):
                self.fail(f"ExportableProfile must not contain any lists; found: {v}")


class TestRawRecordsTransferredIsZero(unittest.TestCase):
    """Test 10: Exportable profile contains raw_records_transferred = 0."""

    def test_raw_records_transferred_zero(self):
        profiler = CsvProfiler(FIXTURE_CSV)
        _, exportable = profiler.profile()
        self.assertEqual(exportable.raw_records_transferred, 0)
        self.assertEqual(exportable.to_dict()["raw_records_transferred"], 0)


class TestNoRawRecordsInExportable(unittest.TestCase):
    """Test 11: Exportable profile does not contain raw records."""

    def test_no_raw_records(self):
        profiler = CsvProfiler(FIXTURE_CSV)
        _, exportable = profiler.profile()
        d = exportable.to_dict()
        # No value in the exportable dict should be a list of dicts (raw rows)
        for key, val in d.items():
            if isinstance(val, list):
                for item in val:
                    self.assertNotIsInstance(
                        item, dict,
                        f"Key '{key}' contains dict records which resemble raw rows"
                    )


class TestNoRawCellValuesInExportable(unittest.TestCase):
    """Test 12: Exportable profile does not contain raw cell values."""

    def test_no_raw_cell_values(self):
        profiler = CsvProfiler(FIXTURE_CSV)
        _, exportable = profiler.profile()
        d_str = json.dumps(exportable.to_dict())
        # Sample real cell values from the synthetic CSV that must NOT appear
        raw_values = [
            "alice.marsh@example.com",
            "bob.fenwick@example.com",
            "Alice Marsh",
            "Bob Fenwick",
            "C001",
        ]
        for val in raw_values:
            self.assertNotIn(
                val, d_str,
                f"Raw cell value '{val}' must not appear in ExportableProfile"
            )


class TestCliProfileCommand(unittest.TestCase):
    """Test 13: CLI profile command succeeds."""

    def test_cli_profile_command_exits_zero(self):
        env = {**os.environ, "PYTHONIOENCODING": "utf-8"}
        result = subprocess.run(
            [sys.executable, "-m", "verdix_agent.cli", "profile", FIXTURE_CSV],
            capture_output=True,
            text=True,
            cwd=_AGENT_DIR,
            env=env,
        )
        self.assertEqual(
            result.returncode, 0,
            f"CLI profile command failed.\nSTDOUT: {result.stdout}\nSTDERR: {result.stderr}"
        )
        self.assertIn("VERDIX LOCAL DATA PROFILE", result.stdout)

    def test_cli_profile_output_contains_expected_fields(self):
        env = {**os.environ, "PYTHONIOENCODING": "utf-8"}
        result = subprocess.run(
            [sys.executable, "-m", "verdix_agent.cli", "profile", FIXTURE_CSV],
            capture_output=True,
            text=True,
            cwd=_AGENT_DIR,
            env=env,
        )
        out = result.stdout
        self.assertIn("Rows:", out)
        self.assertIn("Columns:", out)
        self.assertIn("Missing rate:", out)
        self.assertIn("Duplicate rate:", out)
        self.assertIn("Completeness:", out)
        self.assertIn("Raw records sent:", out)
        self.assertIn("0", out)  # raw_records_transferred must show 0


class TestCliOutputHasNoPersonalData(unittest.TestCase):
    """Test 14: CLI output does not contain synthetic personal names/emails."""

    def test_cli_output_no_personal_data(self):
        env = {**os.environ, "PYTHONIOENCODING": "utf-8"}
        result = subprocess.run(
            [sys.executable, "-m", "verdix_agent.cli", "profile", FIXTURE_CSV],
            capture_output=True,
            text=True,
            cwd=_AGENT_DIR,
            env=env,
        )
        out = result.stdout
        # Real names from the synthetic CSV
        personal_data = [
            "alice.marsh@example.com",
            "bob.fenwick@example.com",
            "Alice Marsh",
            "Bob Fenwick",
            "Carol Baines",
            "72000",     # raw income value
        ]
        for item in personal_data:
            self.assertNotIn(
                item, out,
                f"CLI output must not contain personal/raw value: '{item}'"
            )


# ------------------------------------------------------------------
# Bonus: Edge-case handling tests
# ------------------------------------------------------------------

class TestEdgeCases(unittest.TestCase):
    """Edge-case handling: missing file, empty CSV, malformed rows."""

    def test_missing_file_raises_file_not_found(self):
        profiler = CsvProfiler("/nonexistent/path/that/does_not_exist.csv")
        with self.assertRaises(FileNotFoundError):
            profiler.profile()

    def test_empty_csv_raises_value_error(self):
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".csv", delete=False, encoding="utf-8"
        ) as f:
            f.write("")  # totally empty
            tmp_path = f.name
        try:
            profiler = CsvProfiler(tmp_path)
            with self.assertRaises(ValueError):
                profiler.profile()
        finally:
            os.unlink(tmp_path)

    def test_header_only_csv_returns_zero_rows(self):
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".csv", delete=False, encoding="utf-8"
        ) as f:
            f.write("id,name,value\n")  # header only, no data rows
            tmp_path = f.name
        try:
            profiler = CsvProfiler(tmp_path)
            local, exportable = profiler.profile()
            self.assertEqual(local.row_count, 0)
            self.assertEqual(exportable.raw_records_transferred, 0)
        finally:
            os.unlink(tmp_path)

    def test_malformed_rows_are_padded(self):
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".csv", delete=False, encoding="utf-8"
        ) as f:
            f.write("a,b,c\n")
            f.write("1,2\n")       # short row — missing column c
            f.write("4,5,6\n")
            tmp_path = f.name
        try:
            profiler = CsvProfiler(tmp_path)
            local, _ = profiler.profile()
            self.assertEqual(local.row_count, 2)
            self.assertEqual(local.column_count, 3)
        finally:
            os.unlink(tmp_path)

    def test_all_numeric_column(self):
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".csv", delete=False, encoding="utf-8"
        ) as f:
            f.write("score\n10\n20\n30\n")
            tmp_path = f.name
        try:
            profiler = CsvProfiler(tmp_path)
            local, _ = profiler.profile()
            score_col = local.columns[0]
            self.assertEqual(score_col.inferred_dtype, "numeric")
            self.assertAlmostEqual(score_col.numeric_mean, 20.0)
        finally:
            os.unlink(tmp_path)


if __name__ == "__main__":
    unittest.main()
