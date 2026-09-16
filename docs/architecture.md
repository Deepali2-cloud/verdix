# VERDIX Architectural Specification & Invariants

> **Tagline**: *"Don't share your data. Share the insight."*

## 1. Architectural Philosophy
Traditional data evaluation systems require customers or partners to send their datasets to a centralized cloud service or data lake for analysis. For healthcare, defense, financial, and privacy-sensitive industries, this model creates unacceptable legal, compliance, and cybersecurity risks.

**VERDIX** reverses the paradigm:
- **Bring the question to the data**, rather than bringing the data to the question.
- Perform all computation locally within the organization's firewall.
- Enforce strict statistical aggregation and differential privacy guardrails before any metric leaves the local enclave.

---

## 2. Component Boundaries

### 2.1 Verdix Cloud (`apps/web`, `apps/api`)
The Cloud layer is purely an orchestration, reporting, and management control plane:
- **Web Dashboard**: Next.js interface for viewing evaluation requests, statistical reports, and audit logs.
- **Cloud API**: Dispatches evaluation queries/specs and ingests strictly validated aggregate metrics.
- **NEVER INGESTS RAW DATA**: The API rejects any payload containing raw records, row identifiers, or unaggregated tables.

### 2.2 Verdix Agent (`agent/`)
The Agent is deployed as a sovereign service in the customer's enclave:
- Runs within the organization's network with access to local sensitive data stores (CSVs, Parquet files, SQL warehouses).
- Computes aggregations, quantiles, confusion matrices, and fairness metrics locally using Pandas and statistical engines.
- Applies privacy policies and asserts that raw records are stripped before transmission.

---

## 3. Communication Protocol
All communications are initiated **outbound** from the Agent to the Cloud:
1. **Heartbeat**: Agent registers its presence, version, and active status (`POST /api/v1/agent/heartbeat`).
2. **Job Fetching**: Agent fetches evaluation requests pending for its authorized dataset aliases (`GET /api/v1/jobs`).
3. **Local Computation**: Agent executes the evaluation locally.
4. **Guardrail Verification**: Agent checks that `rawDataIncluded === false` and that output is solely aggregate statistics.
5. **Result Submission**: Agent posts `AggregateResult` to `POST /api/v1/evaluations/results`.

---

## 4. Invariant Checklist
- [x] Cloud API has no dataset upload or raw ingestion endpoints.
- [x] Cloud types require `rawDataIncluded: false`.
- [x] Agent policy guardrails raise exceptions if raw dictionaries or record rows are found in outputs.
- [x] Cloud API validates payload structure and rejects row-level arrays.
