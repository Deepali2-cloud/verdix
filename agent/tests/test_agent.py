import unittest
import os
import sys

# Ensure agent directory is in path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from verdix_agent.config import AgentConfig
from verdix_agent.policy import PrivacyGuardrail, PrivacyPolicyViolation
from verdix_agent.engine import EvaluationEngine

class TestVerdixAgent(unittest.TestCase):
    def test_config_invariants(self):
        config = AgentConfig.from_env()
        self.assertEqual(config.max_export_rows, 0, "max_export_rows must strictly be 0")

    def test_privacy_guardrail_blocks_raw_data(self):
        violation_payload = {
            "jobId": "test-job",
            "rawDataIncluded": True,
            "summaryMetrics": [],
        }
        with self.assertRaises(PrivacyPolicyViolation):
            PrivacyGuardrail.validate_aggregate_output(violation_payload)

    def test_privacy_guardrail_blocks_record_lists(self):
        violation_payload = {
            "jobId": "test-job",
            "rawDataIncluded": False,
            "summaryMetrics": [
                {
                    "metric": "raw_rows",
                    "value": [{"id": 1, "ssn": "000-00-0000", "salary": 100000}],  # Leak!
                }
            ],
        }
        with self.assertRaises(PrivacyPolicyViolation):
            PrivacyGuardrail.validate_aggregate_output(violation_payload)

    def test_engine_computes_valid_aggregates(self):
        engine = EvaluationEngine()
        result = engine.compute_local_aggregates(
            job_id="test-1",
            agent_id="test-agent",
            dataset_alias="financial_records",
            target_columns=["amount", "score"],
        )
        self.assertFalse(result["rawDataIncluded"])
        self.assertTrue(result["privacyValidationPassed"])
        self.assertGreater(len(result["summaryMetrics"]), 0)

if __name__ == "__main__":
    unittest.main()
