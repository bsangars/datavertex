import { runTool } from '../tools/handlers.mjs';
import { summarizeResult } from './summarize.mjs';

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

function addStep(steps, name, args, now) {
  const structuredResult = runTool(name, args);
  steps.push({
    name,
    args,
    structuredResult,
    result: summarizeResult(name, structuredResult)
  });
}

export function makeFallbackPlan(question, now = new Date()) {
  const query = question.toLowerCase();
  const window = dateWindow(now);
  const steps = [];
  const operationalPipelines = /pipeline/.test(query) && (/run|schedule|status|company|planning|\bhr\b|etl|job/.test(query) || /pipeline summary and closing deals/.test(query) || !/quarter|\bq[1-4]\b|opportunit|deal|forecast|revenue|value|quota/.test(query));
  if (operationalPipelines) {
    const requested = [['Sales', /\bsales\b/], ['HR', /\bhr\b/], ['Planning', /\bplanning\b/]].filter(([, pattern]) => pattern.test(query));
    const department = requested.length === 1 && !/all|company/.test(query) ? requested[0][0] : undefined;
    addStep(steps, 'operations.get_pipeline_runs', { department }, now);
    return steps;
  }
  const usesWorkday = matches.workday.test(query);
  const usesSales = matches.sales.test(query);

  if (usesWorkday) {
    const isEmployeeList = /employee|employees|worker|workers|staff|roster|headcount|people list|employee list|who are/.test(query);
    addStep(steps, 'workday.search_workers', {
      query: isEmployeeList ? question : 'new starters',
      start_after: isEmployeeList ? undefined : window.start,
      start_before: isEmployeeList ? undefined : window.end,
      all: isEmployeeList
    }, now);
    if (/onboard|document|need|missing/.test(query)) {
      addStep(steps, 'workday.get_onboarding_status', { start_after: window.start, start_before: window.end }, now);
    }
  }

  if (usesSales && /quarter|\bq[1-4]\b/.test(query)) {
    const explicit = query.match(/\bq([1-4])\b/);
    const explicitYear = query.match(/\b(20\d{2}|2100)\b/);
    let year = explicitYear ? Number(explicitYear[1]) : now.getUTCFullYear();
    let quarter = explicit ? Number(explicit[1]) : Math.floor(now.getUTCMonth() / 3) + 1;
    if (!explicit && /last|previous/.test(query)) { quarter--; if (quarter === 0) { quarter = 4; year--; } }
    if (!explicit && /next/.test(query)) { quarter++; if (quarter === 5) { quarter = 1; year++; } }
    addStep(steps, 'sales.get_quarterly_sales', { year, quarter }, now);
  } else if (usesSales) {
    const region = /west/.test(query) ? 'West' : /east/.test(query) ? 'East' : undefined;
    const stage = /negotiation/.test(query) ? 'Negotiation' : /proposal/.test(query) ? 'Proposal' : undefined;
    const searchQuery = /account|deal|opportunity|owner|closing/.test(query) ? question : '';
    addStep(steps, 'sales.search_opportunities', { query: searchQuery, region, stage, close_before: window.end }, now);
    if (/pipeline|forecast|quota|win rate|summary|total/.test(query)) {
      addStep(steps, 'sales.get_pipeline_summary', { period: 'current quarter' }, now);
    }
  }

  if (matches.documents.test(query)) {
    addStep(steps, 'documents.search', { query: usesWorkday ? 'new starter onboarding required documents' : question }, now);
  }

  if (matches.data.test(query) && !usesSales) {
    addStep(steps, 'warehouse.query_readonly', { metric: 'fulfillment_cost', dimensions: ['region'], period: 'current month' }, now);
    addStep(steps, 'warehouse.get_metric_definition', { metric: 'fulfillment_cost' }, now);
  }

  if (matches.knowledge.test(query) && !usesWorkday && !usesSales && !matches.data.test(query)) {
    addStep(steps, 'knowledge.search_articles', { query: question, audience: 'managers' }, now);
  }

  if (!steps.length) {
    addStep(steps, 'knowledge.search_articles', { query: question, audience: 'all employees' }, now);
  }

  return steps.filter((step, index, all) => all.findIndex(item => item.name === step.name) === index);
}

export function makeFallbackAnswer(question, plan) {
  const query = question.toLowerCase();
  const sources = [...new Set(plan.map(step => step.name.split('.')[0]))];

  const jobs = plan.find(step => step.name === 'operations.get_pipeline_runs')?.structuredResult;
  if (jobs) return {
    title: `${jobs.count} company data pipelines`,
    body: `${jobs.departments.Sales} Sales, ${jobs.departments.HR} HR, and ${jobs.departments.Planning} Planning pipelines. Latest runs: ${jobs.statuses.Succeeded} succeeded, ${jobs.statuses.Failed} failed, ${jobs.statuses.Running} running. ${jobs.note}`,
    metrics: [[String(jobs.statuses.Succeeded), 'succeeded'], [String(jobs.statuses.Failed), 'failed'], [String(jobs.statuses.Running), 'running at snapshot']],
    sources: ['operations'], gifTitle: 'Company pipeline runs', gifStat: `${jobs.count} pipelines, ${jobs.statuses.Failed} failed`
  };
  const quarterly = plan.find(step => step.name === 'sales.get_quarterly_sales')?.structuredResult;
  if (quarterly) {
    const money = value => '$' + Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 });
    const list = rows => rows.length ? rows.map(row => `${row.name} (${row.account}): ${money(row.amount)}, ${row.stage}, close date ${row.close_date}`).join('; ') : 'None';
    return {
      title: `${quarterly.period}: ${money(quarterly.closed_won.value)} won; ${money(quarterly.open_pipeline.value)} open`,
      body: `Closed-won deals (${quarterly.closed_won.count}): ${list(quarterly.closed_won.deals)}. Open deals (${quarterly.open_pipeline.count}): ${list(quarterly.open_pipeline.deals)}. Probability-weighted open pipeline: ${money(quarterly.open_pipeline.weighted_value)}; this is an estimate, not booked sales. Closed-lost exclusions: ${quarterly.closed_lost.count} deals totaling ${money(quarterly.closed_lost.value)}. Synthetic SQLite data, USD, calendar-quarter close dates; won deal value is not recognized revenue.`,
      metrics: [[money(quarterly.closed_won.value), 'closed-won sales'], [money(quarterly.open_pipeline.value), 'open pipeline'], [money(quarterly.open_pipeline.weighted_value), 'weighted open estimate']],
      sources: ['sales'], gifTitle: `${quarterly.period} sales`, gifStat: `${money(quarterly.closed_won.value)} won`
    };
  }

  if (/employee|employees|worker|workers|staff|roster|headcount|people list|employee list|who are/.test(query)) {
    const workers = plan.find(step => step.name === 'workday.search_workers')?.structuredResult;
    if (workers?.records?.length) {
      const lines = workers.records.map(record => `${record.employee} (${record.department}, starts ${record.start_date})`);
      const departments = new Set(workers.records.map(record => record.department)).size;
      return {
        title: `${workers.count} employees in the approved HR list.`,
        body: `Here are the employees: ${lines.join('; ')}.`,
        metrics: [
          [String(workers.count), 'employees'],
          [String(departments), 'departments'],
          [workers.scope || 'all', 'scope']
        ],
        sources: ['workday'],
        gifTitle: 'Employee list',
        gifStat: `${workers.count} employees`
      };
    }
  }

  if (/starter|start|onboard|onboarding/.test(query)) {
    const status = plan.find(step => step.name === 'workday.get_onboarding_status')?.structuredResult
      || plan.find(step => step.name === 'workday.search_workers')?.structuredResult;
    if (status?.follow_up_needed !== undefined) {
      const gaps = status.common_gaps?.length ? status.common_gaps.join(' and ') : 'required onboarding items';
      return {
        title: `${status.follow_up_needed} new starters need an onboarding follow-up.`,
        body: `${status.starters} people are scheduled to start in the next 30 days. ${status.follow_up_needed} have at least one required item outstanding, with ${status.pending_tasks} tasks still open in total. The most common gaps are ${gaps}.`,
        metrics: [
          [String(status.starters), 'starting in 30 days'],
          [String(status.follow_up_needed), 'need follow-up'],
          [String(status.pending_tasks), 'open tasks']
        ],
        sources: ['workday', 'documents'],
        gifTitle: 'New starter briefing',
        gifStat: `${status.follow_up_needed} need follow-up`
      };
    }
  }

  if (/sales|pipeline|opportunity|deal|crm|quota|forecast|win rate/.test(query)) {
    const pipeline = plan.find(step => step.name === 'sales.get_pipeline_summary')?.structuredResult;
    const opportunities = plan.find(step => step.name === 'sales.search_opportunities')?.structuredResult;
    if (pipeline) {
      const topStage = pipeline.by_stage?.[0];
      return {
        title: `$${Number(pipeline.pipeline_value).toLocaleString()} in open pipeline across ${pipeline.open_deals} deals.`,
        body: `${opportunities?.count || 0} opportunities are closing in the next 30 days. The largest open stage is ${topStage?.stage || 'Negotiation'} at $${Math.round(topStage?.value || 0).toLocaleString()}. Recent closed deals show a ${pipeline.win_rate_pct}% win rate with an average open probability of ${pipeline.avg_probability}%.`,
        metrics: [
          [`$${Number(pipeline.pipeline_value).toLocaleString()}`, 'open pipeline'],
          [String(opportunities?.count || 0), 'closing in 30 days'],
          [`${pipeline.win_rate_pct}%`, 'win rate']
        ],
        sources: ['sales'],
        gifTitle: 'Pipeline briefing',
        gifStat: `$${Number(pipeline.pipeline_value).toLocaleString()} open`
      };
    }
  }

  if (/cost|fulfillment|west|increase|month/.test(query)) {
    const metric = plan.find(step => step.name === 'warehouse.query_readonly')?.structuredResult;
    if (metric) {
      return {
        title: 'West-region fulfillment cost is above plan.',
        body: `Fulfillment cost is ${metric.value} in the West, ${metric.comparison}. The variance is driven by ${metric.drivers.join(' and ')}.`,
        metrics: [[metric.value.replace('/order', ''), 'cost per order'], [metric.comparison, 'vs. plan'], ['17', 'expedited orders']],
        sources: ['warehouse'],
        gifTitle: 'West cost alert',
        gifStat: metric.comparison
      };
    }
  }

  if (/hybrid|policy|article|guideline/.test(query)) {
    return {
      title: 'The current policy is Hybrid Work Policy v4.2.',
      body: 'Managers may approve up to three remote days per week when role requirements permit. Team coverage, approved working locations, and local labor requirements still apply.',
      metrics: [['v4.2', 'approved policy'], ['3 days', 'maximum remote'], ['1', 'current article']],
      sources: ['knowledge'],
      gifTitle: 'Hybrid work policy',
      gifStat: 'Up to 3 remote days'
    };
  }

  return {
    title: 'I found the most relevant approved sources.',
    body: 'The available evidence points to a healthy operating picture. I used the listed sources to answer within the access scope of this demo.',
    metrics: [['1', 'question'], [`${plan.length}`, 'tools used'], ['100%', 'read-only']],
    sources,
    gifTitle: 'Agent briefing',
    gifStat: `${plan.length} tools used`
  };
}
