# VERDIX — Privacy-Preserving Data Evaluation Infrastructure

> *"Don't share your data. Share the insight."*

VERDIX allows organizations to evaluate sensitive datasets without requiring the raw dataset to ever leave the organization's controlled environment.

---

## 🔒 Critical Architectural Rule

```
┌────────────────────────────────────────────────────────┐
│                   VERDIX CLOUD                         │
│  - Evaluation specifications                           │
│  - Aggregate summary metrics                           │
│  - Web dashboard, reports, audit history               │
└────────────────────────▲───────────────────────────────┘
                         │
                 Approved Aggregates Only
          (NO RAW ROWS / DATASETS EVER TRANSMITTED)
                         │
┌────────────────────────┴───────────────────────────────┐
│               LOCAL ORGANIZATIONAL ENCLAVE             │
│  VERDIX AGENT (Python / Pandas Evaluation Engine)       │
│  - Local Raw Datasets (CSV, Parquet, DBs)              │
│  - Local Policy & Differential Privacy Guardrails      │
└────────────────────────────────────────────────────────┘
```

The raw organizational dataset must **NEVER** be uploaded to, ingested by, or stored by the Verdix Cloud application. All computations run locally inside the organization's environment via the **Verdix Agent**.

---

## 📁 Repository Structure

```
verdix/
├── apps/
│   ├── web/                  # Next.js web application (Tailwind CSS, shadcn-ready UI)
│   └── api/                  # Express + TypeScript Cloud API
├── agent/                    # Python local evaluation agent
│   ├── verdix_agent/         # Core agent package (policy guard, engine, client, CLI)
│   └── tests/                # Unit tests verifying policy and health checks
├── packages/
│   ├── shared/               # Shared constants, protocol values, logger
│   ├── types/                # Domain models, evaluation specifications, aggregate result contracts
│   └── evaluation-engine/    # Metric definitions & zero-raw-data contracts
├── docs/                     # Architectural documentation & developer guides
├── scripts/                  # Development & unified health-check scripts
├── .env.example              # Environment configuration template
├── .gitignore                # Workspace git ignore
├── package.json              # Monorepo configuration (npm workspaces)
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18.0.0 or later (v22+ recommended)
- **npm**: v9.0.0 or later
- **Python**: 3.10 or later

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
```

### 3. Run the Cloud API
```bash
npm run dev:api
```
The cloud API will run at `http://localhost:4000`. Test the health endpoint:
```bash
curl http://localhost:4000/health
```

### 4. Run the Cloud Web Dashboard
```bash
npm run dev:web
```
The web dashboard will be available at `http://localhost:3000`.

### 5. Run the Local Python Agent
```bash
# Verify agent health check
python agent/verdix_agent/cli.py --health-check

# Run agent unit tests
python -m unittest discover -s agent/tests
```

### 6. Unified Health Check
Run the diagnostic script to verify all monorepo components simultaneously:
```bash
npm run health
```
