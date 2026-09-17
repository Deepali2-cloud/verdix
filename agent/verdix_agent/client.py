from __future__ import annotations

from typing import Any, Optional

import requests

from .config import AgentConfig


class CloudClient:
    """
    HTTP client for communicating with Verdix Cloud.

    Privacy invariant:
    The Agent may send protected aggregate results only.
    Raw dataset records must never be transmitted.
    """

    def __init__(self, config: AgentConfig):
        self.config = config

    def _headers(self) -> dict[str, str]:
        """Build authenticated request headers."""
        headers = {
            "Content-Type": "application/json",
        }

        if self.config.agent_token:
            headers["Authorization"] = (
                f"Bearer {self.config.agent_token}"
            )

        return headers

    def get_jobs(self) -> list[dict[str, Any]]:
        """
        Fetch pending evaluation instructions from Verdix Cloud.

        The cloud returns metadata/instructions only.

        No:
        - CSV files
        - dataset rows
        - raw records
        - PII
        """

        url = (
            f"{self.config.cloud_url.rstrip('/')}"
            "/api/v1/agent/jobs"
        )

        response = requests.get(
            url,
            headers=self._headers(),
            timeout=30,
        )

        response.raise_for_status()

        payload = response.json()

        jobs = payload.get("data", [])

        if not isinstance(jobs, list):
            raise ValueError(
                "Invalid Agent jobs response: data must be a list"
            )

        # Defensive privacy validation.
        for job in jobs:
            if not isinstance(job, dict):
                raise ValueError(
                    "Invalid Agent job: expected object"
                )

            if job.get("rawDataIncluded") is True:
                raise ValueError(
                    "PRIVACY VIOLATION: Cloud attempted to send raw data"
                )

            if job.get("rawRecordsTransferred", 0) != 0:
                raise ValueError(
                    "PRIVACY VIOLATION: Job contains transferred raw records"
                )

        return jobs

    def send_heartbeat(self) -> dict[str, Any]:
        """Send an authenticated Agent heartbeat to Verdix Cloud."""

        url = (
            f"{self.config.cloud_url.rstrip('/')}"
            "/api/v1/agent/heartbeat"
        )

        response = requests.post(
            url,
            headers=self._headers(),
            json={
                "agentId": self.config.agent_id,
                "agentName": self.config.agent_name,
                "environment": self.config.environment,
            },
            timeout=30,
        )

        response.raise_for_status()

        return response.json()

    def submit_aggregate_result(
        self,
        evaluation_id: str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Submit a privacy-preserving evaluation result.

        The payload must contain no raw records.
        """

        if payload.get("rawDataIncluded") is True:
            raise ValueError(
                "PRIVACY VIOLATION: rawDataIncluded=True"
            )

        if payload.get("raw_records_transferred", 0) != 0:
            raise ValueError(
                "PRIVACY VIOLATION: raw records detected"
            )

        url = (
            f"{self.config.cloud_url.rstrip('/')}"
            f"/api/v1/evaluations/{evaluation_id}/results"
        )

        response = requests.post(
            url,
            headers=self._headers(),
            json=payload,
            timeout=30,
        )

        response.raise_for_status()

        return response.json()