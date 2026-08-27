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
  const metrics = answer.metrics.map(([number, label]) => `
    <span class="answer-metric"><strong>${escapeHTML(number)}</strong><small>${escapeHTML(label)}</small></span>
  `).join('');
  const sources = answer.sources.map(source => `<span>${escapeHTML(source)}</span>`).join('');
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
      <span class="gif-ready">GIF READY</span>
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

export function welcomeMarkup() {
  return `
    <article class="welcome-message"><span class="agent-orb small">✦</span><div><strong>What would you like to know?</strong><p>I can search Workday, documents, your data warehouse, and knowledge articles—then show you exactly what I used.</p></div></article>
    <div class="prompt-ideas">
      <button type="button" data-prompt="Who is starting in the next 30 days, and what onboarding documents do they still need?">New starters and missing onboarding documents</button>
      <button type="button" data-prompt="Why did West region fulfillment cost increase this month?">Why did West-region fulfillment cost rise?</button>
      <button type="button" data-prompt="What is our current hybrid-work policy for managers?">Find the hybrid-work policy</button>
    </div>
  `;
}
