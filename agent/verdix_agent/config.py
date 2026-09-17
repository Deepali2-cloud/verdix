"""
Agent configuration handling environment variables and local privacy defaults.
"""
import os
from dataclasses import dataclass

from dotenv import load_dotenv


# Load the Agent's local environment configuration.
_AGENT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(_AGENT_ROOT, ".env"))


@dataclass(frozen=True)
class AgentConfig:
    agent_id: str
    agent_name: str
    cloud_url: str
    environment: str
    local_data_dir: str
    max_export_rows: int = 0
    agent_token: str = ""

    @classmethod
    def from_env(cls) -> "AgentConfig":
        return cls(
            agent_id=os.environ.get("VERDIX_AGENT_ID", "agent-local-default"),
            agent_name=os.environ.get(
                "VERDIX_AGENT_NAME",
                "Local Evaluation Enclave",
            ),
            cloud_url=os.environ.get(
                "VERDIX_CLOUD_URL",
                "http://localhost:4000",
            ),
            environment=os.environ.get(
                "VERDIX_ENVIRONMENT",
                "development",
            ),
            local_data_dir=os.environ.get(
                "VERDIX_LOCAL_DATA_DIR",
                "./agent/data",
            ),
            max_export_rows=0,
            agent_token=os.environ.get("VERDIX_AGENT_TOKEN", ""),
        )