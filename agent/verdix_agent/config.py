"""
Agent configuration handling environment variables and local privacy defaults.
"""
import os
from dataclasses import dataclass

@dataclass(frozen=True)
class AgentConfig:
    agent_id: str
    agent_name: str
    cloud_url: str
    environment: str
    local_data_dir: str
    max_export_rows: int = 0  # 0 indicates raw row export is completely prohibited

    @classmethod
    def from_env(cls) -> "AgentConfig":
        return cls(
            agent_id=os.environ.get("VERDIX_AGENT_ID", "agent-local-default"),
            agent_name=os.environ.get("VERDIX_AGENT_NAME", "Local Evaluation Enclave"),
            cloud_url=os.environ.get("VERDIX_CLOUD_URL", "http://localhost:4000"),
            environment=os.environ.get("VERDIX_ENVIRONMENT", "development"),
            local_data_dir=os.environ.get("VERDIX_LOCAL_DATA_DIR", "./agent/data"),
            max_export_rows=0,  # Enforced invariant: raw row export is strictly 0
        )
