# VERDIX Agent — Local Privacy-Preserving Enclave

The Verdix Agent runs directly inside the organization's private environment (on-premise, private cloud, or confidential VM).

## Core Principles
1. **Zero Raw-Data Transmission**: The raw dataset NEVER leaves the host.
2. **Local Execution**: Calculations run locally via Pandas/NumPy.
3. **Outbound Aggregates Only**: Only approved, sanitized aggregate summaries (e.g. counts, distributions, correlations, confusion matrices) are returned to Verdix Cloud.

## Running the Agent

### Health Check
```bash
python verdix_agent/cli.py --health-check
```

### Run a Mock Evaluation
```bash
python verdix_agent/cli.py --test-eval
```

### Run Tests
```bash
python -m unittest discover -s tests
```
