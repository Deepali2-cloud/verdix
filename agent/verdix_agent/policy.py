"""
Privacy Guardrail Policy Engine.
Ensures that all evaluation artifacts conform to the strict invariant:
RAW DATASET RECORDS NEVER LEAVE THE ENCLAVE.
"""
from typing import Any, Dict, List

class PrivacyPolicyViolation(Exception):
    """Raised when an evaluation result or payload violates privacy guardrails."""
    pass

class PrivacyGuardrail:
    """
    Validates evaluation results before they are dispatched to the cloud.
    """

    @staticmethod
    def validate_aggregate_output(output: Dict[str, Any]) -> bool:
        """
        Confirms that the output payload contains only statistical aggregates.
        """
        # Invariant 1: rawDataIncluded must be explicitly false
        if output.get("rawDataIncluded") is not False:
            raise PrivacyPolicyViolation(
                "Violation: rawDataIncluded flag must be explicitly False."
            )

        # Invariant 2: summaryMetrics must exist and be a list
        metrics = output.get("summaryMetrics")
        if not isinstance(metrics, list):
            raise PrivacyPolicyViolation(
                "Violation: summaryMetrics must be a list of aggregate metric records."
            )

        # Invariant 3: inspect metric values to ensure no raw table or row collections exist
        for item in metrics:
            val = item.get("value")
            # If value is a list of dictionaries, it resembles raw tabular records
            if isinstance(val, list) and len(val) > 0:
                first = val[0]
                if isinstance(first, dict):
                    raise PrivacyPolicyViolation(
                        f"Violation: metric '{item.get('metric')}' contains raw dictionary records. "
                        "Only numeric aggregates, distributions, or matrices are permitted."
                    )

        return True

    @staticmethod
    def sanitize_summary_metrics(metrics: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Guarantees that metrics only carry permitted keys.
        """
        allowed_keys = {"metric", "column", "value", "sampleSize", "privacyNoiseAdded"}
        sanitized = []
        for m in metrics:
            cleaned = {k: v for k, v in m.items() if k in allowed_keys}
            sanitized.append(cleaned)
        return sanitized
