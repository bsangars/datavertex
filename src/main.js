import { makePlan } from './agent/planner.js';
import { answerFor } from './agent/answer-synthesizer.js';
import { toolCatalog } from './data/tool-catalog.js';
import { downloadGif } from './ui/gif-exporter.js';
import { renderAnswer, renderHistory, renderToolCatalog, renderTrace, welcomeMarkup, escapeHTML } from './ui/renderers.js';

const state = { history: [], current: null };
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
  history: document.getElementById('history-list')
};
const viewMeta = {
  workspace: ['Ask across your work.', 'AGENT WORKSPACE'],
  catalog: ['Tool catalog', 'MCP TOOL REGISTRY'],
  runs: ['Run history', 'AUDITABLE HISTORY'],
  policies: ['Access policies', 'SAFETY LAYER']
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

function resetRun() {
  if (state.current) return;
  elements.conversation.innerHTML = welcomeMarkup();
  elements.traceList.innerHTML = '';
  elements.traceEmpty.classList.remove('trace-hidden');
  elements.tracePolicy.classList.remove('trace-hidden');
  elements.traceState.textContent = 'IDLE';
  elements.traceState.className = 'trace-state';
  elements.runLabel.textContent = 'Ready for a question';
  elements.runSubtitle.textContent = '6 approved tools are available to this agent';
  bindPromptButtons();
}

async function runQuestion(question) {
  const cleanQuestion = question.trim();
  if (!cleanQuestion || state.current) return;
  const plan = makePlan(cleanQuestion);
  const answer = answerFor(cleanQuestion, plan);
  state.current = { question: cleanQuestion, plan, answer };
  elements.runButton.disabled = true;
  elements.runLabel.textContent = 'Planning tool calls';
  elements.runSubtitle.textContent = `Matching your question to ${plan.length} approved tool${plan.length === 1 ? '' : 's'}.`;
  elements.traceState.textContent = 'RUNNING';
  elements.traceState.className = 'trace-state running';
  elements.conversation.insertAdjacentHTML('beforeend', `<div class="user-message"><p>${escapeHTML(cleanQuestion)}</p></div><div class="thinking-message" id="thinking"><span class="agent-orb small">✦</span><span>Vertex is coordinating your approved tools</span><span class="thinking-dots"><i></i><i></i><i></i></span></div>`);
  renderTrace(plan, elements);
  elements.conversation.scrollTop = elements.conversation.scrollHeight;

  for (let index = 0; index < plan.length; index += 1) {
    const stepElement = document.getElementById(`step-${index}`);
    stepElement.classList.add('running');
    elements.runLabel.textContent = `Running ${plan[index].name}`;
    elements.runSubtitle.textContent = `Tool ${index + 1} of ${plan.length} · read-only access`;
    await sleep(560);
    stepElement.classList.remove('running');
    stepElement.classList.add('done');
    stepElement.querySelector('.step-state').textContent = '✓';
    const result = stepElement.querySelector('.tool-result');
    result.hidden = false;
    result.textContent = plan[index].result;
  }

  document.getElementById('thinking')?.remove();
  elements.conversation.insertAdjacentHTML('beforeend', renderAnswer(answer, plan.length));
  const gifButton = [...elements.conversation.querySelectorAll('[data-gif-button]')].at(-1);
  gifButton.addEventListener('click', () => {
    downloadGif(answer);
    notify('Animated GIF briefing generated.');
  });
  elements.conversation.scrollTop = elements.conversation.scrollHeight;
  elements.traceState.textContent = 'COMPLETE';
  elements.traceState.className = 'trace-state complete';
  elements.runLabel.textContent = 'Run complete';
  elements.runSubtitle.textContent = `${plan.length} read-only tool call${plan.length === 1 ? '' : 's'} completed with evidence.`;
  state.history.unshift({ question: cleanQuestion, plan, answer, time: new Date() });
  renderHistory(state.history, elements.history);
  state.current = null;
  elements.runButton.disabled = false;
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

renderToolCatalog(toolCatalog, document.getElementById('tool-grid'));
bindPromptButtons();
const requestedView = window.location.hash.slice(1);
if (viewMeta[requestedView]) openView(requestedView);
