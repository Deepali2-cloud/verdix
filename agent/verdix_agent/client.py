"""
Verdix Cloud Client.
Responsible for outbound-only communication with the Verdix Cloud API.
Only sends agent heartbeats and verified aggregate results.
"""
import json
import urllib.request
import urllib.error
from typing import Any, Dict
from verdix_agent.config import AgentConfig
from verdix_agent.policy import PrivacyGuardrail

class CloudClient:
    def __init__(self, config: AgentConfig):
        self.config = config

    def send_heartbeat(self) -> Dict[str, Any]:
        """
        Sends an enclave presence heartbeat to the Verdix Cloud API.
        """
        payload = {
            "agentId": self.config.agent_id,
            "agentName": self.config.agent_name,
            "version": "0.1.0",
            "status": "idle",
            "supportedMetrics": ["count", "summary_statistics", "quantile"],
            "timestamp": "",
            "enclaveEnvironment": self.config.environment,
        }
        return self._post_json(f"{self.config.cloud_url}/api/v1/agent/heartbeat", payload)

    def submit_aggregate_result(self, result: Dict[str, Any]) -> Dict[str, Any]:
        """
        Submits verified aggregate results to Verdix Cloud.
        """
        # Strictly assert no raw data is included
        PrivacyGuardrail.validate_aggregate_output(result)
        return self._post_json(f"{self.config.cloud_url}/api/v1/evaluations/results", result)

    def _post_json(self, url: str, data: Dict[str, Any]) -> Dict[str, Any]:
        body = json.dumps(data).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=body,
            headers={
                "Content-Type": "application/json",
                "x-verdix-agent-id": self.config.agent_id,
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=5) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.URLError as e:
            return {"error": str(e), "success": False}
