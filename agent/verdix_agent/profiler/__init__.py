"""
VERDIX Dataset Profiler Package.

Provides local-only CSV profiling with strict LOCAL / EXPORTABLE separation.
Raw records, individual cell values, and PII fields never leave this package
without explicit policy approval.
"""

from verdix_agent.profiler.csv_profiler import CsvProfiler, LocalProfile, ExportableProfile

__all__ = ["CsvProfiler", "LocalProfile", "ExportableProfile"]
