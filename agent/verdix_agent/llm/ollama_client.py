"""
VERDIX Local LLM Client

Connects VERDIX to a locally running Ollama instance.

Design principle:
- Raw organizational datasets must never be sent to the LLM.
- Deterministic evaluation engines produce the factual evidence.
- The LLM interprets sanitized evaluation results and produces explanations.
"""

import json
import urllib.request
import urllib.error
from typing import Any, Dict, Optional


class OllamaError(Exception):
    """Raised when the local Ollama service cannot be reached or used."""
    pass


class OllamaClient:
    """
    Lightweight client for the local Ollama HTTP API.

    Default model:
        qwen3:8b

    Default endpoint:
        http://localhost:11434
    """

    def __init__(
        self,
        base_url: str = "http://localhost:11434",
        model: str = "qwen3:8b",
        timeout: int = 180,
    ):
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout = timeout

    def health_check(self) -> Dict[str, Any]:
        """Check whether Ollama is running and return available models."""

        url = f"{self.base_url}/api/tags"

        try:
            with urllib.request.urlopen(url, timeout=10) as response:
                data = json.loads(response.read().decode("utf-8"))

            models = [
                model.get("name")
                for model in data.get("models", [])
            ]

            return {
                "success": True,
                "availableModels": models,
                "selectedModel": self.model,
                "modelAvailable": self.model in models,
            }

        except Exception as exc:
            return {
                "success": False,
                "availableModels": [],
                "selectedModel": self.model,
                "modelAvailable": False,
                "error": str(exc),
            }

    def generate(
        self,
        prompt: str,
        system: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Generate a response from the local LLM.

        IMPORTANT:
        Callers should provide sanitized/derived evaluation data,
        not raw organizational records.
        """

        payload: Dict[str, Any] = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
        }

        if system:
            payload["system"] = system

        body = json.dumps(payload).encode("utf-8")

        request = urllib.request.Request(
            f"{self.base_url}/api/generate",
            data=body,
            headers={
                "Content-Type": "application/json",
            },
            method="POST",
        )

        try:
            with urllib.request.urlopen(
                request,
                timeout=self.timeout,
            ) as response:

                result = json.loads(
                    response.read().decode("utf-8")
                )

            return {
                "success": True,
                "model": result.get("model", self.model),
                "response": result.get("response", ""),
                "done": result.get("done", False),
                "doneReason": result.get("done_reason"),
                "totalDuration": result.get("total_duration"),
                "promptEvalCount": result.get("prompt_eval_count"),
                "evalCount": result.get("eval_count"),
            }

        except urllib.error.URLError as exc:
            raise OllamaError(
                f"Unable to connect to Ollama at {self.base_url}: {exc}"
            ) from exc

        except Exception as exc:
            raise OllamaError(
                f"Ollama generation failed: {exc}"
            ) from exc

    def explain_evaluation(
        self,
        evaluation_result: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Ask Qwen3 to explain deterministic VERDIX evaluation results.

        The LLM receives only the evaluation evidence supplied here.
        """

        system_prompt = """
You are the VERDIX AI reasoning layer.

Your job is to interpret deterministic data-quality
evaluation results produced by VERDIX.

Rules:
1. Never invent facts.
2. Never change a metric or numerical result.
3. Never claim that a check passed unless the evidence supports it.
4. Clearly distinguish facts from interpretation.
5. Identify important problems and explain their impact.
6. Suggest practical remediation steps.
7. Raw organizational records are never available to you.
8. Return concise, structured, evidence-based reasoning.
"""

        evaluation_json = json.dumps(
            evaluation_result,
            indent=2,
            ensure_ascii=False,
        )

        prompt = f"""
Analyze the following VERDIX evaluation result.

EVALUATION RESULT:
{evaluation_json}

Provide:

1. Overall assessment
2. Key findings
3. Data-quality risks
4. Evidence from the supplied metrics
5. Recommended remediation actions

Do not invent information that is not present in the evaluation result.
"""

        return self.generate(
            prompt=prompt,
            system=system_prompt,
        )