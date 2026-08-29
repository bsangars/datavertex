import {
  getMetricDefinition,
  getOnboardingStatus,
  getPipelineSummary,
  queryMetric,
  searchArticles,
  searchDocuments,
  searchOpportunities,
  searchWorkers,
  summarizeResult
} from '../data/live-queries.js';

const matches = {
  workday: /workday|employee|people|starter|start|hire|onboard|hr|headcount|manager|pto|leave/,
  sales: /sales|pipeline|opportunity|opportunities|deal|deals|crm|quota|forecast|revenue|account|accounts|win rate|closing/,
  documents: /document|file|onboard|policy|contract|handbook|need|missing/,
  data: /cost|data|rdbms|database|metric|fulfillment|inventory|west|increase|month|trend/,
  knowledge: /article|policy|hybrid|procedure|guideline|how do|what is/
};

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function dateWindow(now = new Date()) {
  const end = new Date(now);
  end.setDate(end.getDate() + 30);
  return { start: formatDate(now), end: formatDate(end) };
}

function addStep(plan, name, args, now) {
  const result = summarizeResult(name, runQuery(name, args, now));
  plan.push({ name, args, result });
}

function runQuery(name, args, now) {
  switch (name) {
    case 'workday.search_workers': return searchWorkers(args, now);
    case 'workday.get_onboarding_status': return getOnboardingStatus(args, now);
    case 'sales.search_opportunities': return searchOpportunities(args, now);
    case 'sales.get_pipeline_summary': return getPipelineSummary(args, now);
    case 'documents.search': return searchDocuments(args, now);
    case 'warehouse.query_readonly': return queryMetric(args, now);
    case 'warehouse.get_metric_definition': return getMetricDefinition(args);
    case 'knowledge.search_articles': return searchArticles(args, now);
    default: return {};
  }
}

export function makePlan(question, now = new Date()) {
  const query = question.toLowerCase();
  const window = dateWindow(now);
  const plan = [];
  const usesWorkday = matches.workday.test(query);
  const usesSales = matches.sales.test(query);

  if (usesWorkday) {
    addStep(plan, 'workday.search_workers', { query: 'new starters', start_after: window.start, start_before: window.end }, now);
    if (/onboard|document|need|missing/.test(query)) {
      addStep(plan, 'workday.get_onboarding_status', { start_after: window.start, start_before: window.end }, now);
    }
  }

  if (usesSales) {
    const region = /west/.test(query) ? 'West' : /east/.test(query) ? 'East' : undefined;
    const stage = /negotiation/.test(query) ? 'Negotiation' : /proposal/.test(query) ? 'Proposal' : undefined;
    const searchQuery = /account|deal|opportunity|owner|closing/.test(query) ? question : '';
    addStep(plan, 'sales.search_opportunities', { query: searchQuery, region, stage, close_before: window.end }, now);
    if (/pipeline|forecast|quota|win rate|summary|total/.test(query)) {
      addStep(plan, 'sales.get_pipeline_summary', { period: 'current quarter' }, now);
    }
  }

  if (matches.documents.test(query)) {
    addStep(plan, 'documents.search', { query: usesWorkday ? 'new starter onboarding required documents' : question }, now);
  }

  if (matches.data.test(query)) {
    addStep(plan, 'warehouse.query_readonly', { metric: 'fulfillment_cost', dimensions: ['region'], period: 'current month' }, now);
    addStep(plan, 'warehouse.get_metric_definition', { metric: 'fulfillment_cost' }, now);
  }

  if (matches.knowledge.test(query) && !usesWorkday && !usesSales && !matches.data.test(query)) {
    addStep(plan, 'knowledge.search_articles', { query: question, audience: 'managers' }, now);
  }

  if (!plan.length) {
    addStep(plan, 'knowledge.search_articles', { query: question, audience: 'all employees' }, now);
  }

  return plan.filter((step, index, all) => all.findIndex(item => item.name === step.name) === index);
}
