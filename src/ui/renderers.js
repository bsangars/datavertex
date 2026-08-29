export function escapeHTML(value) {
  const element = document.createElement('div');
  element.textContent = value;
  return element.innerHTML;
}

export function renderTrace(plan, { traceList, traceEmpty, tracePolicy }) {
  traceEmpty.classList.add('trace-hidden');
  tracePolicy.classList.add('trace-hidden');
  traceList.innerHTML = plan.map((step, index) => `
    <li class="trace-step" id="step-${index}">
      <span class="step-state">${index + 1}</span>
      <div>
        <h3>${step.name}</h3>
        <p>${escapeHTML(JSON.stringify(step.args))}</p>
        <div class="tool-result" hidden></div>
      </div>
    </li>
  `).join('');
}

export function renderAnswer(answer, toolCount) {
  const metrics = (answer.metrics || []).map(([number, label]) => `
    <span class="answer-metric"><strong>${escapeHTML(number)}</strong><small>${escapeHTML(label)}</small></span>
  `).join('');
  const sources = (answer.sources || []).map(source => `<span>${escapeHTML(source)}</span>`).join('');
  return `
    <article class="answer">
      <span class="agent-orb small">✦</span>
      <div class="answer-card">
        <span class="answer-label">SYNTHESIZED ANSWER · ${toolCount} TOOL${toolCount === 1 ? '' : 'S'}</span>
        <h3>${escapeHTML(answer.title)}</h3>
        <p>${escapeHTML(answer.body)}</p>
        <div class="answer-metrics">${metrics}</div>
        <div class="answer-footer"><div class="evidence">${sources}</div><button class="gif-button" type="button" data-gif-button>▸ Generate GIF briefing</button></div>
      </div>
    </article>
  `;
}

export function renderHistory(runs, host) {
  host.innerHTML = runs.length ? runs.map(run => `
    <article class="history-row">
      <strong>${escapeHTML(run.question)}</strong>
      <span class="history-tools">${run.plan.map(step => `<span>${escapeHTML(step.name.split('.')[0])}</span>`).join('')}</span>
      <span class="gif-ready">${escapeHTML(run.mode || 'ready').toUpperCase()}</span>
      <time>${run.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
    </article>
  `).join('') : '<p class="history-empty">No runs yet. Ask your first question in the Agent workspace.</p>';
}

export function renderToolCatalog(catalog, host) {
  host.innerHTML = catalog.map(tool => `
    <article class="tool-card panel">
      <div class="tool-card-head"><span class="tool-icon ${tool.tone}">${tool.icon}</span><div><h3>${tool.name}</h3><small>${tool.server} MCP server</small></div></div>
      <p>${tool.description}</p>
      <div class="tool-card-footer"><span>${tool.schema}</span><span class="read-badge">READ ONLY</span></div>
    </article>
  `).join('');
}

export function renderServers(servers, host) {
  host.innerHTML = servers.map(server => `
    <div class="server">
      <span class="server-icon ${server.tone}">${server.icon}</span>
      <span><strong>${escapeHTML(server.name)}</strong><small>${escapeHTML(server.label)} · ${server.tools.length} tool${server.tools.length === 1 ? '' : 's'}</small></span>
      <i class="live-dot" title="Connected"></i>
    </div>
  `).join('');
}

export function renderPolicies(policies, host) {
  host.innerHTML = policies.map(policy => `
    <article class="policy-card panel">
      <span>${escapeHTML(policy.id)}</span>
      <h3>${escapeHTML(policy.title)}</h3>
      <p>${escapeHTML(policy.body)}</p>
    </article>
  `).join('');
}

export function welcomeMarkup(config) {
  const prompts = (config.samplePrompts || []).map(item => `
    <button type="button" data-prompt="${escapeHTML(item.prompt)}">${escapeHTML(item.label)}</button>
  `).join('');
  return `
    <article class="welcome-message"><span class="agent-orb small">✦</span><div><strong>${escapeHTML(config.welcome.title)}</strong><p>${escapeHTML(config.welcome.body)}</p></div></article>
    <div class="prompt-ideas">${prompts}</div>
  `;
}

export function renderSettingsForm(settings, { serverOpenAIConfigured, serverModel }) {
  return `
    <section class="settings-panel panel">
      <form id="settings-form" class="settings-form">
        <label>
          <span>OpenAI API key</span>
          <input id="settings-api-key" type="password" name="apiKey" value="${escapeHTML(settings.apiKey)}" placeholder="sk-..." autocomplete="off" />
          <small>Use your own key for browser sessions, or set <code>OPENAI_API_KEY</code> on the server for deployment.</small>
        </label>
        <label>
          <span>Model</span>
          <input id="settings-model" type="text" name="model" value="${escapeHTML(settings.model)}" placeholder="gpt-4o-mini" />
          <small>Server default: ${escapeHTML(serverModel || 'gpt-4o-mini')}${serverOpenAIConfigured ? ' · server key configured' : ''}</small>
        </label>
        <label class="settings-checkbox">
          <input id="settings-use-openai" type="checkbox" name="useOpenAI" ${settings.useOpenAI ? 'checked' : ''} />
          <span>Use OpenAI to plan tools and synthesize answers</span>
        </label>
        <div class="settings-actions">
          <button type="submit" class="settings-save">Save settings</button>
          <button type="button" class="settings-test" id="settings-test">Test connection</button>
        </div>
        <p class="settings-status" id="settings-status"></p>
      </form>
    </section>
  `;
}
