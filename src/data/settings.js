const STORAGE_KEY = 'vertex-agent-settings';

const defaults = {
  apiKey: '',
  model: 'gpt-4o-mini',
  useOpenAI: true
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...defaults, ...JSON.parse(raw) } : { ...defaults };
  } catch {
    return { ...defaults };
  }
}

export function saveSettings(settings) {
  const next = { ...defaults, ...settings };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function maskApiKey(apiKey) {
  if (!apiKey) return '';
  if (apiKey.length <= 8) return '••••••••';
  return `${apiKey.slice(0, 3)}••••${apiKey.slice(-4)}`;
}
