import { fetchCatalog, fetchHealth, runAgent } from './api/client.js';
import { defaultWorkspace } from './config/workspace.js';
import { loadSettings, maskApiKey, saveSettings } from './data/settings.js';
import { downloadGif } from './ui/gif-exporter.js';
import {
  escapeHTML,
  renderAnswer,
  renderHistory,
  renderPolicies,
  renderServers,
  renderSettingsForm,
  renderToolCatalog,
  renderTrace,
  welcomeMarkup
} from './ui/renderers.js';

const state = { history: [], current: null, config: { ...defaultWorkspace }, health: { ok: false } };
const elements = {
  conversation: document.getElementById('conversation-body'),
  traceList: document.getElementById('trace-list'),
  traceEmpty: document.getElementById('trace-empty'),
  tracePolicy: document.getElementById('trace-policy'),
  traceState: document.getElementById('trace-state'),
  runLabel: document.getElementById('run-label'),
  runSubtitle: document.getElementById('run-subtitle'),
  runButton: document.getElementById('run-button'),
  input: document.getElementById('question-input'),
  toast: document.getElementById('toast'),
  history: document.getElementById('history-list'),
  toolGrid: document.getElementById('tool-grid'),
  serverList: document.getElementById('server-list'),
  policyGrid: document.getElementById('policy-grid'),
  settingsHost: document.getElementById('settings-host'),
  gatewayStatus: document.getElementById('gateway-status'),
  catalogServerCount: document.getElementById('catalog-server-count'),
  toolCountBadge: document.getElementById('tool-count-badge')
};

const viewMeta = {
  workspace: ['Ask across your connected tools.', 'AGENT WORKSPACE'],
  catalog: ['Tool catalog', 'MCP TOOL REGISTRY'],
  runs: ['Run history', 'AUDITABLE HISTORY'],
  policies: ['Access policies', 'SAFETY LAYER'],
  settings: ['Model and API settings', 'SETTINGS']
};

function sleep(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function notify(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add('show');
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => elements.toast.classList.remove('show'), 2600);
}

function openView(view) {
  if (!viewMeta[view]) return;
  document.querySelectorAll('.view-panel').forEach(panel => panel.classList.toggle('active', panel.id === `${view}-view`));
  document.querySelectorAll('.nav-link').forEach(link => link.classList.toggle('active', link.dataset.view === view));
  document.getElementById('page-title').textContent = viewMeta[view][0];
  document.getElementById('section-eyebrow').textContent = viewMeta[view][1];
  window.location.hash = view;
}

function bindPromptButtons() {
  document.querySelectorAll('[data-prompt]').forEach(button => {
    button.addEventListener('click', () => {
      elements.input.value = button.dataset.prompt;
      elements.input.focus();
    });
  });
}

function applyWorkspaceConfig(config) {
  state.config = config;
  document.title = `${config.brand.name} — MCP workspace`;
  document.querySelector('.brand span:nth-child(2)').innerHTML = `${escapeHTML(config.brand.name.split(' ')[0])} <span>${escapeHTML(config.brand.name.split(' ').slice(1).join(' ') || 'workspace')}</span>`;
  document.querySelector('.workspace-switcher span:nth-child(2)').textContent = config.workspace.name;
  document.querySelector('.workspace-avatar').textContent = config.workspace.avatar;
  document.querySelector('.profile strong').textContent = config.user.name;
  document.querySelector('.profile small').textContent = config.user.role;
  document.querySelector('.profile-avatar').textContent = config.user.avatar;
  document.querySelector('.hero-copy .eyebrow').textContent = config.hero.eyebrow;
  document.querySelector('.hero-copy h2').textContent = config.hero.title;
  document.querySelector('.hero-copy p').textContent = config.hero.body;
  elements.toolCountBadge.textContent = String(config.toolCount);
  elements.catalogServerCount.textContent = `${config.serverCount} servers connected`;
  renderToolCatalog(config.tools, elements.toolGrid);
  renderServers(config.servers, elements.serverList);
  renderPolicies(config.policies, elements.policyGrid);
  elements.conversation.innerHTML = welcomeMarkup(config);
  bindPromptButtons();
  updateRunSubtitle();
}

function updateRunSubtitle(extra = '') {
  const count = state.config.toolCount;
  elements.runSubtitle.textContent = extra || `${count} approved tool${count === 1 ? '' : 's'} are available to this agent`;
}

function updateGatewayStatus() {
  const settings = loadSettings();
  const hasKey = Boolean(settings.apiKey || state.health.openaiConfigured);
  const online = state.health.ok;
  elements.gatewayStatus.innerHTML = `<i class="live-dot"></i> ${online ? 'API online' : 'API offline'}${hasKey ? ' · OpenAI ready' : ' · add API key in Settings'}`;
}

function resetRun() {
  if (state.current) return;
  elements.conversation.innerHTML = welcomeMarkup(state.config);
  elements.traceList.innerHTML = '';
  elements.traceEmpty.classList.remove('trace-hidden');
  elements.tracePolicy.classList.remove('trace-hidden');
  elements.traceState.textContent = 'IDLE';
  elements.traceState.className = 'trace-state';
  elements.runLabel.textContent = 'Ready for a question';
  updateRunSubtitle();
  bindPromptButtons();
}

function renderSettingsView() {
  const settings = loadSettings();
  elements.settingsHost.innerHTML = renderSettingsForm(settings, {
    serverOpenAIConfigured: state.health.openaiConfigured,
    serverModel: state.health.model
  });

  const form = document.getElementById('settings-form');
  const status = document.getElementById('settings-status');
  form.addEventListener('submit', event => {
    event.preventDefault();
    const next = saveSettings({
      apiKey: form.apiKey.value.trim(),
      model: form.model.value.trim() || 'gpt-4o-mini',
      useOpenAI: form.useOpenAI.checked
    });
    status.textContent = next.apiKey ? `Saved settings for ${maskApiKey(next.apiKey)}.` : 'Saved settings. Server env key will be used if configured.';
    updateGatewayStatus();
    notify('Settings saved.');
  });

  document.getElementById('settings-test').addEventListener('click', async () => {
    status.textContent = 'Testing API connection...';
    try {
      const health = await fetchHealth();
      state.health = health;
      status.textContent = health.ok
        ? `API reachable. ${health.openaiConfigured ? 'Server OpenAI key configured.' : 'Add a browser or server API key to enable model routing.'}`
        : 'API unreachable.';
      updateGatewayStatus();
    } catch (error) {
      status.textContent = error.message;
    }
  });
}

async function runQuestion(question) {
  const cleanQuestion = question.trim();
  if (!cleanQuestion || state.current) return;

  state.current = { question: cleanQuestion };
  elements.runButton.disabled = true;
  elements.runLabel.textContent = 'Planning tool calls';
  elements.runSubtitle.textContent = 'Selecting relevant tools and preparing execution.';
  elements.traceState.textContent = 'RUNNING';
  elements.traceState.className = 'trace-state running';
  elements.conversation.insertAdjacentHTML('beforeend', `<div class="user-message"><p>${escapeHTML(cleanQuestion)}</p></div><div class="thinking-message" id="thinking"><span class="agent-orb small">✦</span><span>The agent is coordinating your approved tools</span><span class="thinking-dots"><i></i><i></i><i></i></span></div>`);

  try {
    const output = await runAgent(cleanQuestion);
    const { plan, answer, mode, warning } = output;
    state.current = { question: cleanQuestion, plan, answer, mode, warning };

    renderTrace(plan, elements);
    elements.conversation.scrollTop = elements.conversation.scrollHeight;

    for (let index = 0; index < plan.length; index += 1) {
      const stepElement = document.getElementById(`step-${index}`);
      stepElement.classList.add('running');
      elements.runLabel.textContent = `Running ${plan[index].name}`;
      elements.runSubtitle.textContent = `Tool ${index + 1} of ${plan.length} · read-only access`;
      await sleep(360);
      stepElement.classList.remove('running');
      stepElement.classList.add('done');
      stepElement.querySelector('.step-state').textContent = '✓';
      const result = stepElement.querySelector('.tool-result');
      result.hidden = false;
      result.textContent = plan[index].result;
    }

    document.getElementById('thinking')?.remove();
    elements.conversation.insertAdjacentHTML('beforeend', renderAnswer(answer, plan.length, plan));
    const gifButton = [...elements.conversation.querySelectorAll('[data-gif-button]')].at(-1);
    gifButton.addEventListener('click', () => {
      downloadGif(answer);
      notify('Animated GIF briefing generated.');
    });
    elements.conversation.scrollTop = elements.conversation.scrollHeight;
    elements.traceState.textContent = 'COMPLETE';
    elements.traceState.className = 'trace-state complete';
    elements.runLabel.textContent = 'Run complete';
    elements.runSubtitle.textContent = `${plan.length} read-only tool call${plan.length === 1 ? '' : 's'} completed via ${mode}.`;
    if (warning) notify(warning);

    state.history.unshift({ question: cleanQuestion, plan, answer, mode, time: new Date() });
    renderHistory(state.history, elements.history);
  } catch (error) {
    document.getElementById('thinking')?.remove();
    elements.conversation.insertAdjacentHTML('beforeend', `<article class="answer"><span class="agent-orb small">✦</span><div class="answer-card"><span class="answer-label">ERROR</span><h3>Could not complete the run</h3><p>${escapeHTML(error.message)}</p></div></article>`);
    elements.traceState.textContent = 'ERROR';
    elements.traceState.className = 'trace-state';
    notify(error.message);
  } finally {
    state.current = null;
    elements.runButton.disabled = false;
  }
}

async function bootstrap() {
  try {
    const [catalog, health] = await Promise.all([fetchCatalog(), fetchHealth()]);
    state.health = health;
    applyWorkspaceConfig(catalog);
  } catch {
    applyWorkspaceConfig(defaultWorkspace);
    notify('Could not load API catalog. Start the server with `node server/app.mjs`.');
  }
  updateGatewayStatus();
  renderSettingsView();
}

document.querySelectorAll('[data-view]').forEach(link => link.addEventListener('click', event => {
  event.preventDefault();
  openView(link.dataset.view);
}));
document.getElementById('clear-run').addEventListener('click', resetRun);
document.getElementById('question-form').addEventListener('submit', event => {
  event.preventDefault();
  runQuestion(elements.input.value);
  elements.input.value = '';
});
elements.input.addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    document.getElementById('question-form').requestSubmit();
  }
});

const requestedView = window.location.hash.slice(1);
bootstrap().then(() => {
  if (viewMeta[requestedView]) openView(requestedView);
});
