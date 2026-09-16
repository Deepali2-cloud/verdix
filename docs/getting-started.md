# Getting Started with VERDIX

## Quick Start Guide

### 1. Prerequisites
- Node.js 18+ (Node 22 recommended)
- npm 9+
- Python 3.10+

### 2. Monorepo Setup
From the repository root:
```bash
# 1. Install npm dependencies across workspaces
npm install

# 2. Build the shared packages
npm run build

# 3. Verify all components with the unified health check
npm run health
```

### 3. Running the Cloud Backend (API)
```bash
npm run dev:api
```
- Listens on `http://localhost:4000`
- Check health: `curl http://localhost:4000/health`

### 4. Running the Cloud Frontend (Web)
```bash
npm run dev:web
```
- Listens on `http://localhost:3000`
- Web health check: `http://localhost:3000/api/health`

### 5. Running the Local Agent
```bash
# Verify agent health and privacy guardrails
python agent/verdix_agent/cli.py --health-check

# Run agent unit tests
python -m unittest discover -s agent/tests
```
