const BASE = '';

export async function fetchHealth() {
  const res = await fetch(`${BASE}/api/health`);
  return res.json();
}

export async function analyzePrompt(input) {
  const res = await fetch(`${BASE}/api/defense/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input })
  });
  return res.json();
}

export async function scanCode(code) {
  const res = await fetch(`${BASE}/api/verify/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code })
  });
  return res.json();
}

export async function logBlockchainEvent(event) {
  const res = await fetch(`${BASE}/api/blockchain/log-event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event)
  });
  return res.json();
}

export async function fetchBlockchainHealth() {
  const res = await fetch(`${BASE}/api/blockchain/health`);
  return res.json();
}

export async function fetchBlockchainEvents(limit = 20) {
  const res = await fetch(`${BASE}/api/blockchain/events?limit=${limit}`);
  return res.json();
}

export async function createAttestation(skillName, skillHash) {
  const res = await fetch(`${BASE}/api/blockchain/attest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ skillName, skillHash })
  });
  return res.json();
}

export async function startMonitor() {
  const res = await fetch(`${BASE}/api/monitor/start`, { method: 'POST' });
  return res.json();
}

export async function stopMonitor() {
  const res = await fetch(`${BASE}/api/monitor/stop`, { method: 'POST' });
  return res.json();
}
