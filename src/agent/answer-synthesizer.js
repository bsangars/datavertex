import {
  getOnboardingStatus,
  getPipelineSummary,
  queryMetric,
  searchOpportunities
} from '../data/live-queries.js';

export function answerFor(question, plan, now = new Date()) {
  const query = question.toLowerCase();

  if (/starter|start|onboard|onboarding/.test(query)) {
    const status = getOnboardingStatus({}, now);
    const gaps = status.common_gaps.length ? status.common_gaps.join(' and ') : 'required onboarding items';
    return {
      title: `${status.follow_up_needed} new starters need an onboarding follow-up.`,
      body: `${status.starters} people are scheduled to start in the next 30 days. ${status.follow_up_needed} have at least one required item outstanding, with ${status.pending_tasks} tasks still open in total. The most common gaps are ${gaps}.`,
      metrics: [
        [String(status.starters), 'starting in 30 days'],
        [String(status.follow_up_needed), 'need follow-up'],
        [String(status.pending_tasks), 'open tasks']
      ],
      sources: ['Workday', 'Documents'],
      gifTitle: 'New starter briefing',
      gifStat: `${status.follow_up_needed} need follow-up`
    };
  }

  if (/sales|pipeline|opportunity|deal|crm|quota|forecast|win rate/.test(query)) {
    const pipeline = getPipelineSummary({}, now);
    const opportunities = searchOpportunities({ close_before: new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10) }, now);
    const topStage = pipeline.by_stage[0];
    return {
      title: `$${pipeline.pipeline_value.toLocaleString()} in open pipeline across ${pipeline.open_deals} deals.`,
      body: `${opportunities.count} opportunities are closing in the next 30 days. The largest open stage is ${topStage?.stage || 'Negotiation'} at $${Math.round(topStage?.value || 0).toLocaleString()}. Recent closed deals show a ${pipeline.win_rate_pct}% win rate with an average open probability of ${pipeline.avg_probability}%.`,
      metrics: [
        [`$${pipeline.pipeline_value.toLocaleString()}`, 'open pipeline'],
        [String(opportunities.count), 'closing in 30 days'],
        [`${pipeline.win_rate_pct}%`, 'win rate']
      ],
      sources: ['Sales CRM'],
      gifTitle: 'Pipeline briefing',
      gifStat: `$${pipeline.pipeline_value.toLocaleString()} open`
    };
  }

  if (/cost|fulfillment|west|increase|month/.test(query)) {
    const metric = queryMetric({ metric: 'fulfillment_cost', dimensions: ['region'], period: 'current month' }, now);
    return {
      title: 'West-region fulfillment cost is above plan.',
      body: `Fulfillment cost is ${metric.value} in the West, ${metric.comparison}. The variance is driven by ${metric.drivers.join(' and ')}. The certified Finance definition confirms this comparison excludes returns.`,
      metrics: [[metric.value.replace('/order', ''), 'cost per order'], [metric.comparison, 'vs. plan'], ['17', 'expedited orders']],
      sources: ['Data Warehouse', 'Finance Metrics'],
      gifTitle: 'West cost alert',
      gifStat: metric.comparison
    };
  }

  if (/hybrid|policy|article|guideline/.test(query)) {
    return {
      title: 'The current policy is Hybrid Work Policy v4.2.',
      body: 'Managers may approve up to three remote days per week when role requirements permit. Team coverage, approved working locations, and local labor requirements still apply. The policy directs managers to document standing arrangements in the team operating plan.',
      metrics: [['v4.2', 'approved policy'], ['3 days', 'maximum remote'], ['1', 'current article']],
      sources: ['Knowledge'],
      gifTitle: 'Hybrid work policy',
      gifStat: 'Up to 3 remote days'
    };
  }

  return {
    title: 'I found the most relevant approved sources.',
    body: 'The available evidence points to a healthy operating picture. I used the listed sources to answer within the access scope of this demo. Connect your production MCP servers to replace sample records with governed live results.',
    metrics: [['1', 'question'], [`${plan.length}`, 'tools used'], ['100%', 'read-only']],
    sources: [...new Set(plan.map(step => step.name.split('.')[0]))],
    gifTitle: 'Vertex Agent briefing',
    gifStat: `${plan.length} tools used`
  };
}
