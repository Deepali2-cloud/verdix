"""
VERDIX Outliers Evaluation Module.

Detects statistical outliers in numeric columns using IQR (Interquartile Range)
locally inside the organization's enclave without transmitting raw data.
"""

from verdix_agent.outliers.engine import (
    OutlierEngine,
    OutlierThresholds,
    OutlierLocalResult,
    OutlierExportResult,
)

__all__ = [
    "OutlierEngine",
    "OutlierThresholds",
    "OutlierLocalResult",
    "OutlierExportResult",
]
