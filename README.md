# ShieldClaw

**AI Agent Security Framework with Sui Blockchain Integration**

Built for the **Calling All Agents Hackathon** — Track 1: Safety & Security

---

## Overview

ShieldClaw is a defense-in-depth security framework for autonomous AI agents. It protects agents at every layer — from prompt injection attacks at the input, through behavior anomalies during execution, to immutable audit logging on the Sui blockchain.

- **Prompt Injection Defense** — Pattern-based + heuristic + LLM detection of injection attacks
- **Skill Verification** — SHA-256 hashing, permission enforcement, and security pattern scanning
- **Behavior Monitor** — CPU, memory, network tracking with anomaly detection
- **Sui Blockchain Logging** — Detected threats are automatically logged on-chain with explorer links
- **Container Executor** — Sandboxed Docker execution with seccomp syscall filtering and resource limits
- **OpenClaw Integration** — Agent gateway registration, pre/post execution hooks, and output leak scanning
- **Live Dashboard** — React frontend with real-time event stream and interactive demos

## How It Connects to OpenClaw & AI Agents

AI agents execute **skills** — arbitrary code or actions on behalf of a user. ShieldClaw wraps every step of that execution:

```
User prompt --> Prompt Injection Check (pattern + heuristic + LLM)
            --> Pre-execution Hook (verify skill, check permissions)
            --> Agent executes skill (ShieldClaw monitors behavior)
            --> Post-execution Hook (scan output for leaked secrets)
            --> Any threat detected --> logged to Sui blockchain
```

The `src/openclaw/` module provides an **OpenClawClient** that registers ShieldClaw as a security agent in the gateway, **ExecutionHooks** that can deny suspicious executions and scan output for leaked credentials, and **SecurityHooks** with built-in presets for resource limit enforcement.

## Security Modules

| Module | What It Does | Location |
|--------|-------------|----------|
| **Prompt Injection Defense** | Detects instruction overrides, jailbreaks, role-play manipulation, data exfiltration, and code injection using regex patterns, heuristic analysis (repetition, encoding, case distribution), and optional OpenAI GPT-4o-mini classification. | `src/defense/` |
| **Skill Verifier** | Scans agent skill code for dangerous patterns (`eval`, `child_process`, `fs.readFile`), enforces file/network/exec permissions, and generates SHA-256 integrity hashes. | `src/verify/` |
| **Behavior Monitor** | Tracks CPU, memory, network I/O, and disk usage in real time. Establishes a baseline and fires alerts when metrics deviate beyond configurable thresholds. | `src/monitor/` |
| **Sui Blockchain Client** | Logs security events, creates skill attestations, and queries on-chain records via the `@mysten/sui` SDK. 4 Move contracts deployed to devnet (events, reputation, verification, governance). | `src/blockchain/` |
| **Container Executor** | Wraps Docker (via `dockerode`) to run agent skills in isolated containers with CPU/memory limits and seccomp syscall filtering profiles (`default`, `strict`, `network-only`). | `src/container/`, `src/executor/` |
| **OpenClaw Integration** | Registers ShieldClaw as a security agent in the OpenClaw gateway. Pre-execution hooks can block suspicious skills. Post-execution hooks scan output for leaked passwords, API keys, and tokens. | `src/openclaw/` |

## Architecture

Single monolith — one `npm start`, one port, one URL.

```
http://localhost:3991
    +--- Static Files (React frontend built by Vite)
    +--- /api/* (Express API routes)
            +---> Prompt Injection Defense
            +---> Skill Verifier
            +---> Behavior Monitor
            +---> OpenClaw Integration
            +---> Sui Blockchain Client (@mysten/sui SDK)
                        |
                        v
                Sui Devnet (4 Move Contracts)
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 7, Tailwind CSS 4 |
| Backend | Express.js, Node.js 18+ |
| Blockchain | Sui Move, `@mysten/sui` SDK |
| LLM Analysis | OpenAI GPT-4o-mini (optional) |
| Monitoring | `pidusage` + `systeminformation`, SSE |

## Deployed Contracts (Sui Devnet)

| Contract | Object ID |
|----------|-----------|
| Package | [`0x5921...4dcf`](https://suiscan.xyz/devnet/object/0x5921b2d8e7a8da8d84dda83682fadf130cf7195691109020bcad5e9983f94dcf) |
| EventLog | 0xbf6f837b72b36c6250914093f0616b8eba2d42c460b67a394b43c1960c3b387f |
| ReputationRegistry | 0xc87ce7701b4bfd106f1850cc261cad58c7d6538b4ac38c58aee9e7a68e103f3a |
| CertificateRegistry | 0x8b55f589419cce1ab516d13aa42ec2caf0ab2423b18ac7a2e9045e7717af0b60 |

---

## Getting Started

**Prerequisites:** Node.js >= 18

### 1. Install

```bash
git clone <repository-url>
cd ShieldClaw
npm install
cd frontend && npm install && cd ..
```

### 2. Configure environment

Create a `.env` in the project root:

```env
# Sui Blockchain (required for on-chain logging)
SUI_NETWORK=devnet
SUI_PACKAGE_ID=<your-deployed-package-id>
SUI_REGISTRY_ID=<your-registry-object-id>
SUI_EVENT_LOG_ID=<your-event-log-object-id>
SUI_CERT_REGISTRY_ID=<your-cert-registry-object-id>
SUI_PRIVATE_KEY=<your-sui-private-key>

# OpenAI (optional — enables LLM-based prompt injection analysis)
OPENAI_API_KEY=<your-openai-api-key>
```

> Already-deployed contracts? The `.env` is pre-configured.

### 3. Run

```bash
npm start
```

Opens on **http://localhost:3991** — frontend + API on a single port.

### 4. Deploy to Vercel

```bash
npm i -g vercel && vercel
```

Add your `SUI_*` and `OPENAI_API_KEY` env vars in the Vercel dashboard. One URL, everything works.

> **Behavior Monitor note:** behavior monitoring is limited on serverless deployments like Vercel. For full CPU, memory, and network monitoring, run ShieldClaw locally.

---

## Testing

```bash
npm test    # 42/42 tests passing (32 unit + 10 integration)
```

## License

MIT
