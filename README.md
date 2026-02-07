# ShieldClaw - AI Agent Security Framework

A comprehensive security framework for autonomous AI agents that provides runtime monitoring, skill verification, isolated execution, and prompt injection defense.

## 🎯 Mission

Secure autonomous AI agents by implementing defense-in-depth security across multiple layers:
- **Runtime behavior monitoring** - Detect anomalous agent behavior
- **Skill verification system** - Verify code integrity and permissions
- **Isolated executor environment** - Sandboxed execution with eBPF monitoring
- **Prompt injection defense** - Detect and mitigate prompt injection attacks
- **Sui blockchain integration** - Immutable security event logging and reputation system
- **OpenClaw integration** - Seamless monitoring and control hooks

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      AGENT CONTAINER                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  PROMPT INJECTION DEFENSE LAYER                         │   │
│  │  • Input sanitization                                    │   │
│  │  • Pattern detection                                     │   │
│  │  • LLM-based analysis                                    │   │
│  └───────────────────────┬─────────────────────────────────┘   │
│                          │                                     │
│  ┌───────────────────────▼─────────────────────────────────┐   │
│  │  RUNTIME BEHAVIOR MONITOR                              │   │
│  │  • System call monitoring (eBPF)                       │   │
│  │  • Resource usage tracking                              │   │
│  │  • Behavioral pattern analysis                          │   │
│  │  • Anomaly detection                                    │   │
│  └───────────────────────┬─────────────────────────────────┘   │
│                          │                                     │
│  ┌───────────────────────▼─────────────────────────────────┐   │
│  │  SKILL VERIFICATION SYSTEM                              │   │
│  │  • Code integrity verification                           │   │
│  │  • Permission checks                                     │   │
│  │  • Signature validation                                 │   │
│  │  • Reputation scoring                                    │   │
│  └───────────────────────┬─────────────────────────────────┘   │
│                          │                                     │
│  ┌───────────────────────▼─────────────────────────────────┐   │
│  │  ISOLATED EXECUTOR ENVIRONMENT                         │   │
│  │  • Container sandbox (Docker/Podman)                    │   │
│  │  • Network isolation                                    │   │
│  │  • File system restrictions                             │   │
│  │  • Resource limits                                      │   │
│  └─────────────────────────────────────────────────────────┘   │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      OPENCLAW API HOOKS                         │
│  • Pre-execution security checks                                │
│  • Real-time monitoring streams                                 │
│  • Emergency shutdown capabilities                             │
│  • Event logging integration                                    │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                       SUI BLOCKCHAIN                           │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Skill Reputation Registry                               │   │
│  │  • Skill reputation scores                              │   │
│  │  • Developer trust levels                               │   │
│  │  • Verification records                                  │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Security Event Log                                      │   │
│  │  • Immutable event records                               │   │
│  │  • Tamper-evident audit trail                            │   │
│  │  • Cryptographic verification                            │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Governance Module                                        │   │
│  │  • Policy management                                      │   │
│  │  • Voting mechanisms                                     │   │
│  │  • Permission updates                                    │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## 📦 Components

### 1. Runtime Behavior Monitor (`src/monitor/`)
- eBPF-based system call monitoring
- Resource usage tracking (CPU, memory, network, disk I/O)
- Behavioral pattern analysis
- Anomaly detection with ML models
- Real-time alerting

### 2. Skill Verification System (`src/verify/`)
- Code integrity verification (hash comparison)
- Signature validation
- Permission checking against policy
- Reputation scoring integration
- Pre-execution security checks

### 3. Isolated Executor Environment (`src/executor/`)
- Container sandbox management (Docker/Podman)
- Network isolation configuration
- File system restrictions (read-only paths, temporary directories)
- Resource limits (CPU, memory, disk)
- Seccomp profiles for syscall filtering

### 4. Prompt Injection Defense (`src/defense/`)
- Input sanitization and validation
- Pattern-based detection (known injection vectors)
- LLM-based analysis (analyze intent and detect manipulation)
- Output filtering
- Context isolation

### 5. OpenClaw API Integration (`src/openclaw/`)
- Pre-execution hooks
- Post-execution callbacks
- Real-time monitoring streams
- Emergency control interfaces
- Event logging integration

### 6. Sui Move Contracts (`contracts/`)
- Skill Reputation Registry
- Security Event Log
- Governance Module
- Verifiable Compute

### 7. Containerization & eBPF (`src/container/`)
- Container management utilities
- eBPF program loading and monitoring
- Syscall filtering profiles
- Network traffic inspection

## 🚀 Quick Start

### Installation

```bash
# Clone repository
git clone <repository-url>
cd shieldclaw

# Install Node.js dependencies
npm install

# Install Sui Move dependencies
sui client publish --package-url contracts

# Build eBPF programs
cd src/container/ebpf
make
```

### Configuration

```bash
# Copy example configuration
cp config/config.example.json config/config.json

# Edit configuration
nano config/config.json
```

### Run Basic Monitor

```bash
# Start runtime behavior monitor
npm run monitor:start

# Run skill verification check
npm run verify:skill <skill-path>

# Launch isolated executor
npm run executor:run <skill-name> --args <args>

# Test prompt injection defense
npm run defense:test --input "test input"
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run unit tests
npm run test:unit

# Run integration tests
npm run test:integration

# Run eBPF tests (requires root)
sudo npm run test:ebpf

# Run demo scenarios
npm run demo:malicious
npm run demo:injection
npm run demo:secure
```

## 📊 Demo Scenarios

### 1. Malicious Skill Detection
Simulates execution of a skill with malicious intent:
- Detects suspicious file access patterns
- Flags unauthorized network connections
- Blocks dangerous system calls
- Logs security event to Sui blockchain

### 2. Prompt Injection Mitigation
Tests prompt injection attack vectors:
- Role-playing attempts
- Direct instruction overrides
- Context manipulation
- Confusing objectives

### 3. Secure Command Execution
Demonstrates isolated execution:
- Sandboxed command execution
- Resource limit enforcement
- eBPF syscall monitoring
- Clean shutdown

## 🔐 Security Features

### Defense in Depth
- **Layer 1:** Prompt injection defense
- **Layer 2:** Runtime behavior monitoring
- **Layer 3:** Skill verification
- **Layer 4:** Isolated execution environment
- **Layer 5:** Blockchain-verified audit trail

### Immutable Audit Trail
All security events are logged to Sui blockchain:
- Cryptographically tamper-evident
- Immutable storage
- Verifiable by anyone
- Reputation tracking

### Real-time Response
- Instant detection of anomalies
- Automatic threat containment
- Emergency shutdown capability
- Alert notifications

## 📝 Development Plan

### Phase 1: Core Infrastructure (Week 1)
- [x] Project setup and structure
- [ ] Runtime behavior monitor
- [ ] Skill verification system
- [ ] Basic eBPF monitoring

### Phase 2: Isolation & Defense (Week 2)
- [ ] Isolated executor environment
- [ ] Prompt injection defense
- [ ] Container orchestration
- [ ] eBPF syscall filtering

### Phase 3: Blockchain Integration (Week 3)
- [ ] Sui Move contracts
- [ ] Reputation registry
- [ ] Security event logging
- [ ] Governance module

### Phase 4: OpenClaw Integration (Week 4)
- [ ] API hooks implementation
- [ ] Real-time monitoring
- [ ] Control interfaces
- [ ] Event synchronization

### Phase 5: Testing & Demos (Week 5)
- [ ] Unit tests
- [ ] Integration tests
- [ ] Demo scenarios
- [ ] Documentation

## 🛠️ Technology Stack

- **Runtime:** Node.js 22+
- **Monitoring:** eBPF (bcc, libbpf)
- **Containerization:** Docker/Podman
- **Blockchain:** Sui Move
- **AI/ML:** OpenAI API for prompt analysis
- **Testing:** Jest, Mocha

## 📄 License

MIT License - see LICENSE file for details

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📞 Support

For issues or questions:
- Open an issue on GitHub
- Check existing documentation
- Review demo scenarios

---

**Built for the Autonomous Agents Security Hackathon** 🛡️
