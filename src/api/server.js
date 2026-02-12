/**
 * ShieldClaw API Server
 * Express server wrapping all security modules for the frontend dashboard
 */

import 'dotenv/config';
import express from 'express';
import { SuiBlockchainClient } from '../blockchain/index.js';
import { PromptInjectionDefense, PromptInjectionDetector, createDefaultDetector, createDefaultSanitizer } from '../defense/index.js';
import { LLMAnalyzer } from '../defense/llm-analyzer.js';
import { SkillVerifier } from '../verify/verifier.js';
import { BehaviorMonitor } from '../monitor/monitor.js';
import { createLogger } from '../utils/logger.js';

const app = express();
app.use(express.json());

// CORS — allow any origin in dev, same-origin in production
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Initialize modules
const logger = createLogger({ name: 'api-server' });
const sui = new SuiBlockchainClient();
const defense = new PromptInjectionDefense({ enablePatternDetection: true, enableLLMAnalysis: false });
const detector = createDefaultDetector({ threshold: 0.2, enableHeuristics: true });
const sanitizer = createDefaultSanitizer({ maxInputLength: 5000 });
const llmAnalyzer = new LLMAnalyzer();
const verifier = new SkillVerifier();
const monitor = new BehaviorMonitor({ checkInterval: 2000 });

// State
let suiInitialized = false;
let monitorRunning = false;
const eventLog = [];
const sseClients = new Set();

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function confidenceFromScore(score) {
  if (score >= 0.75) return 'high';
  if (score >= 0.45) return 'medium';
  return 'low';
}

function mergeThreatDecision(detection, llmResult, threshold) {
  const localScore = clamp01(detection?.score || 0);
  const hasLLM = llmResult && !llmResult.error && typeof llmResult.confidence === 'number';
  const llmThreatScore = hasLLM && llmResult.isMalicious ? clamp01(llmResult.confidence) : 0;

  let score = localScore;
  if (llmThreatScore > 0) {
    score = Math.max(
      localScore,
      (localScore + llmThreatScore) / 2,
      llmThreatScore * 0.85
    );
  }

  score = clamp01(score);
  const detected = score >= threshold || llmThreatScore >= 0.85;

  return {
    score,
    confidence: confidenceFromScore(score),
    detected,
    source: hasLLM ? 'merged' : 'local'
  };
}

// Lazy Sui initialization (runs once, reused across warm invocations)
const suiInitPromise = (async () => {
  try {
    await sui.initialize();
    suiInitialized = true;
    logger.info('Sui blockchain client initialized');
  } catch (err) {
    logger.warn(`Sui init failed (degraded mode): ${err.message}`);
  }
})();

// Ensure Sui is initialized before handling any request
app.use(async (req, res, next) => {
  await suiInitPromise;
  next();
});

// ── SSE helpers ──────────────────────────────────────────────

function pushEvent(event) {
  eventLog.push(event);
  if (eventLog.length > 500) eventLog.shift();
  const data = `data: ${JSON.stringify(event)}\n\n`;
  for (const client of sseClients) {
    client.res.write(data);
  }
}

// ── Health ───────────────────────────────────────────────────

app.get('/api/health', async (req, res) => {
  try {
    const suiHealth = suiInitialized ? await sui.getHealth().catch(e => ({ error: e.message })) : { initialized: false };
    const monitorStats = monitorRunning ? monitor.getStatistics() : null;
    const defenseStats = defense.getStatistics();
    const detectorStats = detector.getStatistics();

    res.json({
      status: 'ok',
      timestamp: Date.now(),
      sui: { initialized: suiInitialized, ...suiHealth },
      llm: { enabled: llmAnalyzer.isEnabled(), model: llmAnalyzer.model },
      monitor: { running: monitorRunning, stats: monitorStats },
      defense: defenseStats,
      detector: detectorStats,
      events: { total: eventLog.length, recent: eventLog.slice(-10) }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── Defense / Prompt Analysis ────────────────────────────────

app.post('/api/defense/analyze', async (req, res) => {
  try {
    const { input } = req.body;
    if (!input) return res.status(400).json({ error: 'input required' });

    const detection = detector.detect(input);
    const analysis = await defense.analyzeInput(input);
    const sanitized = sanitizer.sanitize(input);
    const llmResult = llmAnalyzer.isEnabled()
      ? await llmAnalyzer.analyze(input).catch(e => ({ error: e.message }))
      : null;
    const decision = mergeThreatDecision(detection, llmResult, detector.threshold);

    pushEvent({
      type: 'prompt_analysis',
      timestamp: Date.now(),
      input: input.substring(0, 80),
      detected: decision.detected,
      score: decision.score,
      safe: analysis.safe,
      llm: llmResult ? (llmResult.isMalicious ? 'threat' : 'clean') : 'off'
    });

    // Auto-log threats to Sui blockchain
    let chainResult = null;
    if (decision.detected && suiInitialized) {
      chainResult = await sui.logSecurityEvent({
        title: 'Prompt Injection Detected',
        description: `Score: ${decision.score.toFixed(2)}, Patterns: ${detection.patterns.length}, Risks: ${detection.risks.map(r => r.type).join(', ')}`,
        severity: decision.confidence === 'high' ? 3 : decision.confidence === 'medium' ? 2 : 1,
        eventType: 1,
        source: 'prompt-detector',
        component: 'defense'
      }).catch(e => { logger.warn('Auto-log to chain failed:', e.message); return null; });

      if (chainResult) {
        pushEvent({
          type: 'blockchain_log',
          timestamp: Date.now(),
          title: 'Prompt Injection Detected',
          digest: chainResult.digest || null,
          onChain: chainResult.onChain || false,
          eventHash: chainResult.eventHash || null
        });
      }
    }

    res.json({ detection, decision, analysis, sanitized, llm: llmResult, chain: chainResult });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── Verify / Code Scanning ───────────────────────────────────

app.post('/api/verify/scan', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'code required' });

    const patterns = verifier.scanSecurityPatterns(code);
    const permissions = verifier.checkPermissions(code, {
      fileRead: true,
      fileWrite: false,
      network: false
    });
    const hash = verifier.generateCodeHash(code);

    pushEvent({
      type: 'skill_verification',
      timestamp: Date.now(),
      hash: hash.slice(0, 16),
      patternsFound: patterns.length,
      allowed: permissions.allowed
    });

    // Auto-log dangerous code to Sui blockchain
    let chainResult = null;
    if (patterns.length > 0 && suiInitialized) {
      chainResult = await sui.logSecurityEvent({
        title: 'Dangerous Code Patterns Found',
        description: `${patterns.length} pattern(s): ${patterns.map(p => p.pattern).join(', ')}, Hash: ${hash.slice(0, 16)}`,
        severity: patterns.some(p => p.severity === 'high') ? 3 : 2,
        eventType: 2,
        source: 'skill-verifier',
        component: 'verify'
      }).catch(e => { logger.warn('Auto-log to chain failed:', e.message); return null; });

      if (chainResult) {
        pushEvent({
          type: 'blockchain_log',
          timestamp: Date.now(),
          title: 'Dangerous Code Patterns Found',
          digest: chainResult.digest || null,
          onChain: chainResult.onChain || false,
          eventHash: chainResult.eventHash || null
        });
      }
    }

    res.json({ patterns, permissions, hash, chain: chainResult });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── Blockchain ───────────────────────────────────────────────

app.get('/api/blockchain/health', async (req, res) => {
  try {
    const health = suiInitialized
      ? await sui.getHealth().catch(e => ({ error: e.message }))
      : { initialized: false };
    res.json(health);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/blockchain/log-event', async (req, res) => {
  try {
    if (!suiInitialized) return res.status(503).json({ error: 'Sui not initialized' });

    const { title, description, severity, eventType } = req.body;
    const result = await sui.logSecurityEvent({
      title: title || 'Security Event',
      description: description || '',
      severity: severity || 1,
      eventType: eventType || 1,
      source: 'shieldclaw-dashboard',
      component: 'frontend'
    });

    pushEvent({
      type: 'blockchain_log',
      timestamp: Date.now(),
      title,
      digest: result.digest || null,
      onChain: result.onChain || false,
      eventHash: result.eventHash || null
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/blockchain/attest', async (req, res) => {
  try {
    if (!suiInitialized) return res.status(503).json({ error: 'Sui not initialized' });

    const { skillName, skillHash } = req.body;
    const result = await sui.createAttestation(
      skillName || 'demo-skill',
      skillHash || 'a1b2c3d4e5f6',
      { version: '1.0.0' }
    );

    pushEvent({
      type: 'attestation',
      timestamp: Date.now(),
      skillName,
      onChain: result.onChain || false,
      digest: result.digest || null
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/blockchain/events', async (req, res) => {
  try {
    if (!suiInitialized) return res.status(503).json({ error: 'Sui not initialized' });
    const events = await sui.queryEvents({ limit: parseInt(req.query.limit) || 20 });
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── Monitor ──────────────────────────────────────────────────

app.post('/api/monitor/start', async (req, res) => {
  try {
    if (monitorRunning) return res.json({ status: 'already running' });

    await monitor.start();
    monitorRunning = true;

    monitor.on('alert', (alert) => {
      pushEvent({ type: 'monitor_alert', timestamp: Date.now(), ...alert });
    });
    monitor.on('metrics', (metrics) => {
      pushEvent({ type: 'monitor_metrics', timestamp: Date.now(), cpu: metrics.cpu, memory: metrics.memory });
    });

    res.json({ status: 'started' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/monitor/stop', (req, res) => {
  try {
    monitor.stop();
    monitorRunning = false;
    res.json({ status: 'stopped' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── SSE Event Stream ─────────────────────────────────────────

app.get('/api/events/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': 'http://localhost:5173'
  });

  const client = { res };
  sseClients.add(client);

  res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: Date.now() })}\n\n`);

  req.on('close', () => {
    sseClients.delete(client);
  });
});

// ── Serve frontend static files in production ────────────────

const frontendDist = new URL('../../frontend/dist', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');

app.use(express.static(frontendDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile('index.html', { root: frontendDist });
});

// ── Export for Vercel serverless ──────────────────────────────

export { app };
export default app;

// ── Start Server (local dev only) ────────────────────────────

if (!process.env.VERCEL) {
  const PORT = process.env.API_PORT || 3991;
  await suiInitPromise;
  app.listen(PORT, () => {
    logger.info(`ShieldClaw API server running on http://localhost:${PORT}`);
    logger.info(`SSE endpoint: http://localhost:${PORT}/api/events/stream`);
    logger.info(`Sui connected: ${suiInitialized}`);
  });
}
