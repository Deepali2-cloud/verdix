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

    PROHIBITED_RAW_KEYS = {
        "rows", "records", "rawdata", "csv", "personalrecords", "cell_values"
    }

    @classmethod
    def validate_aggregate_output(cls, output: Dict[str, Any]) -> bool:
        """
        Confirms that the output payload contains only statistical aggregates.
        """
        if not isinstance(output, dict):
            raise PrivacyPolicyViolation("Violation: output payload must be a dictionary.")

        # Invariant 1: rawDataIncluded must be explicitly false
        if output.get("rawDataIncluded") is not False:
            raise PrivacyPolicyViolation(
                "Violation: rawDataIncluded flag must be explicitly False."
            )

        # Invariant 2: raw_records_transferred must be strictly 0
        if output.get("raw_records_transferred", 0) != 0:
            raise PrivacyPolicyViolation(
                "Violation: raw_records_transferred must be strictly 0."
            )

        # Invariant 3: Check for prohibited raw keys at root
        for key in output.keys():
            if key.lower() in cls.PROHIBITED_RAW_KEYS:
                raise PrivacyPolicyViolation(
                    f"Violation: Prohibited raw data key '{key}' found in payload root."
                )

        # Invariant 4: If summaryMetrics exists, it must be a list
        metrics = output.get("summaryMetrics")
        if metrics is not None:
            if not isinstance(metrics, list):
                raise PrivacyPolicyViolation(
                    "Violation: summaryMetrics must be a list of aggregate metric records."
                )

            # Inspect metric values to ensure no raw table or row collections exist
            for item in metrics:
                val = item.get("value")
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
        allowed_keys = {
            "metric", "column", "value", "sampleSize", "privacyNoiseAdded", "score", "status"
        }
        sanitized = []
        for m in metrics:
            cleaned = {k: v for k, v in m.items() if k in allowed_keys}
            sanitized.append(cleaned)
        return sanitized
