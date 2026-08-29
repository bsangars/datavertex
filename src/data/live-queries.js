import { buildSeed } from '../../data/seed.js';

function dateWindow(now = new Date()) {
  const end = new Date(now);
  end.setDate(end.getDate() + 30);
  return { start: now.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

function getSeed(now) {
  return buildSeed(now);
}

export function searchWorkers({ query = '', start_after, start_before, all = false } = {}, now = new Date()) {
  const wantsFullList = all || /employee|employees|worker|workers|staff|roster|headcount|people list|employee list|who are/.test(query.toLowerCase());
  const records = (wantsFullList ? getSeed(now).workers : getSeed(now).workers.filter(worker => {
    const window = dateWindow(now);
    const after = start_after || window.start;
    const before = start_before || window.end;
    return worker.start_date >= after && worker.start_date <= before;
  })).map(({ name, department, start_date, manager, location }) => ({
    employee: name,
    department,
    start_date,
    manager,
    location
  }));

  return {
    count: records.length,
    records,
    scope: wantsFullList ? 'all approved employees' : 'starts in the next 30 days',
    note: 'Approved fields only from SQLite HR store.'
  };
}

export function getOnboardingStatus({ start_after, start_before } = {}, now = new Date()) {
  const window = dateWindow(now);
  const after = start_after || window.start;
  const before = start_before || window.end;
  const starters = getSeed(now).workers.filter(worker => worker.start_date >= after && worker.start_date <= before);
  const starterIds = new Set(starters.map(worker => worker.id));
  const pending = getSeed(now).onboardingTasks.filter(task => starterIds.has(task.worker_id) && task.status === 'pending');
  const followUpIds = new Set(pending.map(task => task.worker_id));
  const gapCounts = pending.reduce((counts, task) => {
    counts[task.task_name] = (counts[task.task_name] || 0) + 1;
    return counts;
  }, {});

  return {
    starters: starters.length,
    follow_up_needed: followUpIds.size,
    pending_tasks: pending.length,
    common_gaps: Object.entries(gapCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name]) => name)
  };
}

export function searchOpportunities({ query = '', stage, region, close_before } = {}, now = new Date()) {
  const window = dateWindow(now);
  const before = close_before || window.end;
  const seed = getSeed(now);
  const accountById = Object.fromEntries(seed.accounts.map(account => [account.id, account]));
  const needle = query.toLowerCase();

  const records = seed.opportunities
    .filter(opportunity => opportunity.close_date <= before && !['Closed Won', 'Closed Lost'].includes(opportunity.stage))
    .filter(opportunity => {
      const account = accountById[opportunity.account_id];
      if (stage && opportunity.stage !== stage) return false;
      if (region && account.region !== region) return false;
      if (!query) return true;
      return [opportunity.name, account.name, opportunity.owner].some(value => value.toLowerCase().includes(needle));
    })
    .map(opportunity => {
      const account = accountById[opportunity.account_id];
      return {
        name: opportunity.name,
        stage: opportunity.stage,
        amount: opportunity.amount,
        close_date: opportunity.close_date,
        owner: opportunity.owner,
        probability: opportunity.probability,
        account: account.name,
        region: account.region
      };
    });

  return { count: records.length, records, note: 'Open pipeline opportunities from SQLite CRM store.' };
}

export function getPipelineSummary({ period = 'current quarter' } = {}, now = new Date()) {
  const opportunities = getSeed(now).opportunities;
  const open = opportunities.filter(item => !['Closed Won', 'Closed Lost'].includes(item.stage));
  const closed = opportunities.filter(item => ['Closed Won', 'Closed Lost'].includes(item.stage));
  const byStageMap = open.reduce((groups, item) => {
    if (!groups[item.stage]) groups[item.stage] = { stage: item.stage, deals: 0, value: 0 };
    groups[item.stage].deals += 1;
    groups[item.stage].value += item.amount;
    return groups;
  }, {});

  const won = closed.filter(item => item.stage === 'Closed Won').length;
  const lost = closed.filter(item => item.stage === 'Closed Lost').length;
  const decided = won + lost;

  return {
    period,
    open_deals: open.length,
    pipeline_value: Math.round(open.reduce((sum, item) => sum + item.amount, 0)),
    avg_probability: open.length ? Math.round((open.reduce((sum, item) => sum + item.probability, 0) / open.length) * 10) / 10 : 0,
    win_rate_pct: decided ? Math.round((won / decided) * 1000) / 10 : 0,
    by_stage: Object.values(byStageMap).sort((a, b) => b.value - a.value)
  };
}

export function searchDocuments({ query = '' } = {}, now = new Date()) {
  const needle = query.toLowerCase();
  const documents = getSeed(now).documents.filter(doc => [doc.title, doc.owner].some(value => value.toLowerCase().includes(needle)));
  const window = dateWindow(now);
  const incomplete = getOnboardingStatus({ start_after: window.start, start_before: window.end }, now).follow_up_needed;
  return { documents, incomplete_packets: incomplete };
}

export function queryMetric({ metric = 'fulfillment_cost', dimensions = [], period = 'current month' } = {}, now = new Date()) {
  const region = dimensions.includes('region') ? 'West' : null;
  const row = getSeed(now).metrics.find(item => item.metric === metric && item.period === period && (!region || item.region === region));
  if (!row) return { metric, value: 'n/a', comparison: 'No data', drivers: [] };

  const variance = ((row.value - row.plan_value) / row.plan_value) * 100;
  const sign = variance >= 0 ? '+' : '';
  return {
    metric: row.metric,
    region: row.region,
    value: `$${row.value.toFixed(2)}/order`,
    comparison: `${sign}${variance.toFixed(1)}% vs plan`,
    drivers: [`${row.expedited_orders} expedited orders`, 'carrier fuel surcharge']
  };
}

export function getMetricDefinition({ metric = 'fulfillment_cost' } = {}) {
  return {
    metric,
    owner: 'Finance',
    definition: 'Fulfillment expense divided by shipped orders; returns excluded.',
    version: 'v3'
  };
}

export function searchArticles({ query = '' } = {}, now = new Date()) {
  const needle = query.toLowerCase();
  const articles = getSeed(now).articles.filter(article => [article.title, article.excerpt].some(value => value.toLowerCase().includes(needle)));
  return { articles };
}

export function summarizeResult(name, result) {
  switch (name) {
    case 'workday.search_workers': {
      const preview = (result.records || []).slice(0, 6).map(record => record.employee).join(', ');
      const suffix = result.count > 6 ? `, and ${result.count - 6} more` : '';
      return `${result.count} employees (${result.scope || 'matched'}): ${preview}${suffix}.`;
    }
    case 'workday.get_onboarding_status':
      return `${result.pending_tasks} onboarding tasks are pending across ${result.follow_up_needed} new starters.`;
    case 'sales.search_opportunities':
      return `${result.count} open opportunities matched in the pipeline.`;
    case 'sales.get_pipeline_summary':
      return `$${result.pipeline_value.toLocaleString()} in open pipeline across ${result.open_deals} deals (${result.win_rate_pct}% win rate).`;
    case 'documents.search':
      return `${result.documents.length} document templates and ${result.incomplete_packets} incomplete packets matched.`;
    case 'warehouse.query_readonly':
      return `${result.region || 'All'} fulfillment cost is ${result.value}, ${result.comparison}.`;
    case 'warehouse.get_metric_definition':
      return `Certified metric definition retrieved from Finance Metrics ${result.version}.`;
    case 'knowledge.search_articles':
      return result.articles[0] ? `${result.articles[0].title} v${result.articles[0].version} is the current approved article.` : 'Relevant company knowledge sources found.';
    default:
      return 'Tool completed successfully.';
  }
}
