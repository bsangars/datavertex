import { loadSettings } from '../data/settings.js';

const API_BASE = '';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Request failed (${response.status})`);
  }
  return payload;
}

export async function fetchHealth() {
  return request('/api/health');
}

export async function fetchCatalog() {
  return request('/api/catalog');
}

export async function runAgent(question) {
  const settings = loadSettings();
  return request('/api/agent/run', {
    method: 'POST',
    body: JSON.stringify({
      question,
      settings: settings.useOpenAI ? { apiKey: settings.apiKey, model: settings.model } : {}
    })
  });
}
