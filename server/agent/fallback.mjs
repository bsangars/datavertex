import { runTool } from '../tools/handlers.mjs';
import { summarizeResult } from './summarize.mjs';

const matches = {
  workday: /workday|employee|people|starter|start|hire|onboard|hr|headcount|manager|pto|leave/,
  sales: /sales|pipeline|opportunity|opportunities|deal|deals|crm|quota|forecast|revenue|account|accounts|win rate|closing|order|orders|purchase order|\bpo\b|fulfillment order|shipping|shipped|deliver/,
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
    if (/onboard|document|need|missing|manager|department|team|dept|mix|remote|onsite/.test(query)) {
      addStep(steps, 'workday.get_onboarding_status', { start_after: window.start, start_before: window.end }, now);
    }
  }

  const asksOpenOrders = /\borders?\b|purchase order|\bpo\b|fulfillment order|shipping|shipped|deliver/.test(query) && !/pipeline runs/.test(query);
  if (asksOpenOrders) {
    const region = /west/.test(query) ? 'West' : /east/.test(query) ? 'East' : /central/.test(query) ? 'Central' : /south/.test(query) ? 'South' : undefined;
    const includeClosed = /shipped|delivered|closed|cancel/.test(query);
    addStep(steps, 'sales.get_open_orders', { region, include_closed: includeClosed }, now);
    return steps;
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
    const asksAggregation = /top|highest|who owns|by owner|slipping|at risk|owner rollup|largest|biggest/.test(query);
    const searchQuery = asksAggregation ? '' : (/account|specific|named|search/.test(query) ? question : '');
    // For aggregation questions, widen the window so we don't clip open deals that close later than 30 days
    const closeBefore = asksAggregation ? formatDate(new Date(now.getFullYear(), now.getMonth() + 6, 0)) : window.end;
    addStep(steps, 'sales.search_opportunities', { query: searchQuery, region, stage, close_before: closeBefore }, now);
    if (/pipeline|forecast|quota|win rate|summary|total/.test(query)) {
      addStep(steps, 'sales.get_pipeline_summary', { period: 'current quarter' }, now);
    }
  }

  if (matches.documents.test(query)) {
    addStep(steps, 'documents.search', { query: usesWorkday ? 'new starter onboarding required documents' : question }, now);
  }

  if (matches.data.test(query) && !usesSales) {
    const wantsCompare = /compare|across|region(s)?|all regions|east|central|south/.test(query);
    const wantsTrend = /trend|history|last (few |3 )?months|three months|3 months|over time|month over month/.test(query);
    const region = /west/.test(query) ? 'West' : /east/.test(query) ? 'East' : /central/.test(query) ? 'Central' : /south/.test(query) ? 'South' : undefined;
    const args = { metric: 'fulfillment_cost', dimensions: ['region'], period: 'current month' };
    if (wantsCompare) { args.compare = true; args.dimensions = ['all_regions']; }
    else if (wantsTrend) { args.trend = true; args.dimensions = ['trend']; if (region) args.region = region; }
    else if (region) { args.region = region; }
    addStep(steps, 'warehouse.query_readonly', args, now);
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
  if (jobs) {
    const asksFailures = /fail|error|failed|failure/.test(query);
    const asksLongest = /longest|runtime|slow|duration/.test(query);
    const asksNext = /next|scheduled|upcoming|when/.test(query);
    if (asksFailures) {
      const failed = jobs.pipelines.filter(job => job.latest_run?.status === 'Failed');
      const list = failed.map(job => `${job.name} (${job.department}, owner ${job.owner}): "${job.latest_run.error || 'no error message'}" at ${job.latest_run.started_at}`).join('; ') || 'No pipelines failed on the latest run.';
      return {
        title: `${failed.length} pipelines failed on the latest run.`,
        body: `Failing pipelines: ${list}. ${jobs.note}`,
        metrics: [[String(failed.length), 'failed'], [String(jobs.statuses.Succeeded), 'succeeded'], [String(jobs.statuses.Running), 'running']],
        sources: ['operations'], gifTitle: 'Pipeline failures', gifStat: `${failed.length} failed`
      };
    }
    if (asksLongest) {
      const sorted = [...jobs.pipelines].sort((a, b) => (b.latest_run?.duration_seconds || 0) - (a.latest_run?.duration_seconds || 0)).slice(0, 5);
      const list = sorted.map(job => `${job.name} (${job.department}): ${Math.round((job.latest_run?.duration_seconds || 0) / 60)} min`).join('; ');
      return {
        title: `Top ${sorted.length} pipelines by latest runtime.`,
        body: `${list}. ${jobs.note}`,
        metrics: sorted.slice(0, 3).map(job => [`${Math.round((job.latest_run?.duration_seconds || 0) / 60)}m`, job.name.slice(0, 20)]),
        sources: ['operations'], gifTitle: 'Longest pipelines', gifStat: `${Math.round((sorted[0]?.latest_run?.duration_seconds || 0) / 60)}m top`
      };
    }
    if (asksNext) {
      const hr = jobs.pipelines.filter(job => job.department === 'HR');
      const list = (hr.length ? hr : jobs.pipelines).slice(0, 5).map(job => `${job.name} (${job.department}) next at ${job.next_run_at}`).join('; ');
      return {
        title: `Next scheduled runs`,
        body: `${list}. ${jobs.note}`,
        metrics: [[String((hr.length ? hr : jobs.pipelines).length), 'pipelines shown']],
        sources: ['operations'], gifTitle: 'Next runs', gifStat: 'schedule loaded'
      };
    }
    return {
      title: `${jobs.count} company data pipelines`,
      body: `${jobs.departments.Sales} Sales, ${jobs.departments.HR} HR, and ${jobs.departments.Planning} Planning pipelines. Latest runs: ${jobs.statuses.Succeeded} succeeded, ${jobs.statuses.Failed} failed, ${jobs.statuses.Running} running. ${jobs.note}`,
      metrics: [[String(jobs.statuses.Succeeded), 'succeeded'], [String(jobs.statuses.Failed), 'failed'], [String(jobs.statuses.Running), 'running at snapshot']],
      sources: ['operations'], gifTitle: 'Company pipeline runs', gifStat: `${jobs.count} pipelines, ${jobs.statuses.Failed} failed`
    };
  }
  const orders = plan.find(step => step.name === 'sales.get_open_orders')?.structuredResult;
  if (orders && orders.count) {
    const money = value => '$' + Number(value).toLocaleString('en-US', { maximumFractionDigits: 0 });
    const active = orders.records.filter(row => ['Open', 'In Fulfillment', 'On Hold'].includes(row.status));
    const list = active.slice(0, 6).map(row => `${row.order_number} · ${row.account} · ${row.status} · ${money(row.amount)} · ships ${row.expected_ship_date || 'TBD'} (deal: ${row.opportunity || 'unlinked'})`).join('; ');
    const statusMix = Object.entries(orders.by_status).filter(([, count]) => count > 0).map(([status, count]) => `${count} ${status}`).join(', ');
    const topAccount = [...(orders.by_account || [])].sort((a, b) => b.value - a.value)[0];
    return {
      title: `${orders.active_count} active orders (${money(orders.active_value)}) linked to deals.`,
      body: `${orders.count} orders total, ${orders.active_count} active worth ${money(orders.active_value)}. Status mix: ${statusMix}. Top account by value: ${topAccount ? `${topAccount.account} at ${money(topAccount.value)} across ${topAccount.orders} orders` : 'n/a'}. Active orders: ${list}. ${orders.note}`,
      metrics: [
        [String(orders.active_count), 'active orders'],
        [money(orders.active_value), 'active order value'],
        [String(orders.by_account?.length || 0), 'accounts with orders']
      ],
      sources: ['sales'],
      gifTitle: 'Open orders on deals',
      gifStat: `${orders.active_count} active · ${money(orders.active_value)}`
    };
  }

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

  if (/starter|start|onboard|onboarding|manager|department|document|sign/.test(query)) {
    const status = plan.find(step => step.name === 'workday.get_onboarding_status')?.structuredResult
      || plan.find(step => step.name === 'workday.search_workers')?.structuredResult;
    if (status?.follow_up_needed !== undefined) {
      const gaps = status.common_gaps?.length ? status.common_gaps.join(' and ') : 'required onboarding items';
      const asksManager = /manager/.test(query);
      const asksDepartment = /department|mix|team/.test(query);
      const asksDocs = /document|sign|not signed|pending|outstanding/.test(query);
      const managerLine = asksManager && status.by_manager?.length
        ? ` Manager with the most pending items: ${status.by_manager[0].manager} (${status.by_manager[0].pending_tasks} tasks across ${status.by_manager[0].starters_with_gaps} starters). Full manager view: ${status.by_manager.map(row => `${row.manager} — ${row.pending_tasks} tasks`).join('; ')}.`
        : '';
      const deptLine = asksDepartment && status.by_department?.length
        ? ` Department mix of new starters: ${status.by_department.map(row => `${row.department} (${row.starters})`).join(', ')}.`
        : '';
      const docLine = asksDocs && status.pending_by_task?.length
        ? ` Documents/tasks not yet complete: ${status.pending_by_task.map(row => `${row.task_name} (${row.total})`).join(', ')}.`
        : '';
      return {
        title: `${status.follow_up_needed} new starters need an onboarding follow-up.`,
        body: `${status.starters} people are scheduled to start in the next 30 days. ${status.follow_up_needed} have at least one required item outstanding, with ${status.pending_tasks} tasks still open in total. The most common gaps are ${gaps}.${managerLine}${deptLine}${docLine}`,
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

  if (/sales|pipeline|opportunity|deal|crm|quota|forecast|win rate|owner|highest|top|closing/.test(query)) {
    const pipeline = plan.find(step => step.name === 'sales.get_pipeline_summary')?.structuredResult;
    const opportunities = plan.find(step => step.name === 'sales.search_opportunities')?.structuredResult;
    const asksOwner = /owner|who owns|by owner|highest[- ]?value|top open|top deals/.test(query);
    if (asksOwner && opportunities?.records?.length) {
      const money = value => '$' + Number(value).toLocaleString('en-US', { maximumFractionDigits: 0 });
      const byOwner = {};
      opportunities.records.forEach(row => {
        byOwner[row.owner] = byOwner[row.owner] || { owner: row.owner, count: 0, value: 0, top: null };
        byOwner[row.owner].count += 1;
        byOwner[row.owner].value += row.amount;
        if (!byOwner[row.owner].top || row.amount > byOwner[row.owner].top.amount) byOwner[row.owner].top = row;
      });
      const owners = Object.values(byOwner).sort((a, b) => b.value - a.value);
      const line = owners.map(row => `${row.owner}: ${row.count} deals, ${money(row.value)} (top: ${row.top.name} at ${money(row.top.amount)})`).join('; ');
      const topDeals = [...opportunities.records].sort((a, b) => b.amount - a.amount).slice(0, 3);
      return {
        title: `Top ${topDeals.length} open deals by value.`,
        body: `${topDeals.map(row => `${row.name} (${row.account}, ${row.owner}) — ${money(row.amount)} at ${row.stage}, closes ${row.close_date}`).join('; ')}. Owner rollup: ${line}.`,
        metrics: [[String(owners.length), 'owners'], [money(topDeals[0].amount), 'top deal value'], [topDeals[0].owner, 'top owner']],
        sources: ['sales'],
        gifTitle: 'Top open deals by owner',
        gifStat: `${owners[0].owner} — ${money(owners[0].value)}`
      };
    }
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

  if (/cost|fulfillment|west|increase|month|trend|compare|region/.test(query)) {
    const metric = plan.find(step => step.name === 'warehouse.query_readonly')?.structuredResult;
    if (metric?.by_region) {
      const rows = metric.by_region;
      const list = rows.map(row => `${row.region} ${row.value} (${row.comparison}, ${row.expedited_orders} expedited)`).join('; ');
      return {
        title: `Fulfillment cost across ${rows.length} regions this month.`,
        body: `Region breakdown: ${list}. Highest cost per order is ${metric.region} at ${metric.value}, ${metric.comparison}. Drivers include ${metric.drivers.join(' and ')}.`,
        metrics: [[metric.value.replace('/order', ''), `${metric.region} cost/order`], [metric.comparison, 'vs plan'], [String(rows.length), 'regions compared']],
        sources: ['warehouse'],
        gifTitle: 'Regional cost comparison',
        gifStat: `${metric.region} ${metric.comparison}`
      };
    }
    if (metric?.trend) {
      const list = metric.trend.map(row => `${row.period}: ${row.value} (${row.comparison})`).join('; ');
      return {
        title: `${metric.region} fulfillment cost — 3-month trend.`,
        body: `Trend: ${list}. Latest month is ${metric.value}, ${metric.comparison}. Drivers include ${metric.drivers.join(' and ')}.`,
        metrics: metric.trend.map(row => [row.value.replace('/order', ''), row.period]),
        sources: ['warehouse'],
        gifTitle: 'Cost trend',
        gifStat: `${metric.region} ${metric.comparison}`
      };
    }
    if (metric) {
      return {
        title: `${metric.region || 'Regional'} fulfillment cost is ${metric.comparison}.`,
        body: `Fulfillment cost is ${metric.value} in ${metric.region || 'the selected region'}, ${metric.comparison}. The variance is driven by ${metric.drivers.join(' and ')}.`,
        metrics: [[metric.value.replace('/order', ''), 'cost per order'], [metric.comparison, 'vs plan'], [metric.plan ? metric.plan.replace('/order', '') : '', 'plan']].filter(pair => pair[0]),
        sources: ['warehouse'],
        gifTitle: `${metric.region || 'Regional'} cost alert`,
        gifStat: metric.comparison
      };
    }
  }

  if (/hybrid|policy|article|guideline|exception|prior|previous version|owner|approved/.test(query)) {
    const knowledge = plan.find(step => step.name === 'knowledge.search_articles')?.structuredResult;
    const articles = knowledge?.articles || [];
    const current = articles.find(article => article.status === 'published' && /hybrid/i.test(article.title)) || articles.find(article => article.status === 'published') || articles[0];
    const prior = articles.find(article => article.status === 'archived');
    const exception = articles.find(article => /exception/i.test(article.title));
    if (current) {
      const asksOwner = /owner|approved|approved_at|when/.test(query);
      const asksPrior = /prior|previous|history|older|old version/.test(query);
      const asksExceptions = /exception|team lead|exception|coverage/.test(query);
      const parts = [`${current.title} v${current.version} — ${current.excerpt}`];
      if (asksOwner) parts.push(`Owned by ${current.owner || 'People Operations'}${current.approved_at ? `, approved ${current.approved_at}` : ''}.`);
      if (asksPrior && prior) parts.push(`Previous version: ${prior.title} v${prior.version} — ${prior.excerpt} (approved ${prior.approved_at}).`);
      if (asksExceptions && exception) parts.push(`Exceptions: ${exception.title} v${exception.version} — ${exception.excerpt}.`);
      return {
        title: `${current.title} v${current.version} is the current approved policy.`,
        body: parts.join(' '),
        metrics: [
          [`v${current.version}`, 'current version'],
          [current.owner || 'People Operations', 'owner'],
          [current.approved_at || 'n/a', 'approved']
        ],
        sources: ['knowledge'],
        gifTitle: current.title,
        gifStat: `v${current.version} approved ${current.approved_at || ''}`.trim()
      };
    }
    return {
      title: 'The current policy is Hybrid Work Policy v4.2.',
      body: 'Managers may approve up to three remote days per week when role requirements permit.',
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
