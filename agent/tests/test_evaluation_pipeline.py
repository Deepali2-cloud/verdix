"""
Tests for Verdix BiasEngine, Full Evaluation Pipeline, CLI, and Privacy Guardrail.
"""

import os
import sys
import unittest

# Ensure agent directory is in path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from verdix_agent.bias.engine import BiasEngine, BiasThresholds
from verdix_agent.engine import EvaluationEngine
from verdix_agent.policy import PrivacyGuardrail, PrivacyPolicyViolation
from verdix_agent.cli import run_evaluate

FIXTURE_CSV = os.path.abspath(os.path.join(os.path.dirname(__file__), "fixtures", "synthetic_customers.csv"))


class TestEvaluationPipeline(unittest.TestCase):

    def test_bias_engine_on_synthetic_customers(self):
        engine = BiasEngine()
        local_res, export_res = engine.evaluate(FIXTURE_CSV)

        self.assertGreater(local_res.row_count, 0)
        self.assertEqual(export_res.raw_records_transferred, 0)
        self.assertIn(export_res.status, ["EXCELLENT", "GOOD", "FAIR", "POOR", "INSUFFICIENT_DATA"])
        self.assertGreaterEqual(export_res.fairness_score, 0.0)
        self.assertLessEqual(export_res.fairness_score, 100.0)

        # Check export dictionary does not leak individual rows
        export_dict = export_res.to_dict()
        self.assertNotIn("rows", export_dict)
        self.assertNotIn("records", export_dict)
        self.assertEqual(export_dict["raw_records_transferred"], 0)

    def test_run_full_evaluation_pipeline(self):
        engine = EvaluationEngine()
        result = engine.run_full_evaluation(FIXTURE_CSV)

        # Verify privacy invariants
        self.assertEqual(result["raw_records_transferred"], 0)
        self.assertFalse(result["rawDataIncluded"])
        self.assertEqual(result["privacy_status"], "ENFORCED")
        self.assertTrue(result["privacyValidationPassed"])

        # Verify presence of health score and all 7 engine exports
        self.assertIn("healthScore", result)
        self.assertGreater(result["healthScore"], 0.0)
        self.assertLessEqual(result["healthScore"], 100.0)

        self.assertIn("completeness", result)
        self.assertIn("validity", result)
        self.assertIn("duplicates", result)
        self.assertIn("consistency", result)
        self.assertIn("outliers", result)
        self.assertIn("anomalies", result)
        self.assertIn("bias_fairness", result)
        self.assertIn("summaryMetrics", result)

        # Verify each engine respects zero raw records transferred
        self.assertEqual(result["completeness"]["raw_records_transferred"], 0)
        self.assertEqual(result["validity"]["raw_records_transferred"], 0)
        self.assertEqual(result["duplicates"]["raw_records_transferred"], 0)
        self.assertEqual(result["consistency"]["raw_records_transferred"], 0)
        self.assertEqual(result["outliers"]["raw_records_transferred"], 0)
        self.assertEqual(result["anomalies"]["raw_records_transferred"], 0)
        self.assertEqual(result["bias_fairness"]["raw_records_transferred"], 0)

    def test_privacy_guardrail_blocks_raw_data(self):
        # Raw records transferred > 0 violation
        payload_leak = {
            "jobId": "test-leak",
            "rawDataIncluded": False,
            "raw_records_transferred": 5,
            "summaryMetrics": [],
        }
        with self.assertRaises(PrivacyPolicyViolation):
            PrivacyGuardrail.validate_aggregate_output(payload_leak)

        # Prohibited raw key violation
        payload_raw_key = {
            "jobId": "test-key",
            "rawDataIncluded": False,
            "raw_records_transferred": 0,
            "rows": [["val1", "val2"]],
            "summaryMetrics": [],
        }
        with self.assertRaises(PrivacyPolicyViolation):
            PrivacyGuardrail.validate_aggregate_output(payload_raw_key)

    def test_cli_run_evaluate_function(self):
        exit_code = run_evaluate(FIXTURE_CSV, json_output=False)
        self.assertEqual(exit_code, 0)


if __name__ == "__main__":
    unittest.main()
