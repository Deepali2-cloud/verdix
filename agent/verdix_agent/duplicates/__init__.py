"""
VERDIX Duplicate Evaluation Module.

Evaluates dataset duplicates locally within the organization's enclave.
Calculates exact full-row duplicate metrics without sending any raw data
to the cloud.
"""

from verdix_agent.duplicates.engine import (
    DuplicateEngine,
    DuplicateThresholds,
    DuplicateGroupDetail,
    DuplicateLocalResult,
    DuplicateExportResult,
)

__all__ = [
    "DuplicateEngine",
    "DuplicateThresholds",
    "DuplicateGroupDetail",
    "DuplicateLocalResult",
    "DuplicateExportResult",
]
