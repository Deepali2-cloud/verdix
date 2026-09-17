"""
VERDIX Consistency Evaluation Module.

Evaluates data consistency and logical relationships across fields locally
within the organization's enclave without transmitting raw data to the cloud.
"""

from verdix_agent.consistency.engine import (
    ConsistencyEngine,
    ConsistencyThresholds,
    ConsistencyRule,
    RuleDiagnostic,
    ConsistencyLocalResult,
    ConsistencyExportResult,
)

__all__ = [
    "ConsistencyEngine",
    "ConsistencyThresholds",
    "ConsistencyRule",
    "RuleDiagnostic",
    "ConsistencyLocalResult",
    "ConsistencyExportResult",
]
