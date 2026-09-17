"""
VERDIX Validity Evaluation Module.

Evaluates dataset validity locally within the organization's enclave.
Checks data conformance against inferred data types and configurable rules
without exporting any raw data or cell values.
"""

from verdix_agent.validity.engine import (
    ValidityEngine,
    ValidityThresholds,
    ColumnValidityRule,
    ColumnValidityDiagnostic,
    ValidityLocalResult,
    ValidityExportResult,
)

__all__ = [
    "ValidityEngine",
    "ValidityThresholds",
    "ColumnValidityRule",
    "ColumnValidityDiagnostic",
    "ValidityLocalResult",
    "ValidityExportResult",
]
