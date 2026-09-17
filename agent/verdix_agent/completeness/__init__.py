"""
VERDIX Completeness Evaluation Module.

Evaluates dataset completeness locally within the organization's enclave.
Transforms Step 8A profiling data into structured CompletenessLocalResult
and privacy-safe CompletenessExportResult.
"""

from verdix_agent.completeness.engine import (
    CompletenessEngine,
    CompletenessThresholds,
    CompletenessLocalResult,
    CompletenessExportResult,
    ColumnMissingDetail,
)

__all__ = [
    "CompletenessEngine",
    "CompletenessThresholds",
    "CompletenessLocalResult",
    "CompletenessExportResult",
    "ColumnMissingDetail",
]
