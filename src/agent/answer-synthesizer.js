export function answerFor(question, plan) {
  const query = question.toLowerCase();

  if (/starter|start|onboard|onboarding/.test(query)) {
    return {
      title: 'Five new starters need an onboarding follow-up.',
      body: 'Twelve people are scheduled to start in the next 30 days. Five have at least one required item outstanding, with eight tasks still open in total. The most common gaps are signed IT-access acknowledgement and benefits enrollment.',
      metrics: [['12', 'starting in 30 days'], ['5', 'need follow-up'], ['8', 'open tasks']],
      sources: ['Workday', 'Documents'],
      gifTitle: 'New starter briefing',
      gifStat: '5 need follow-up'
    };
  }

  if (/cost|fulfillment|west|increase|month/.test(query)) {
    return {
      title: 'West-region fulfillment cost is above plan.',
      body: 'Fulfillment cost is $18.42 per order in the West, 8.2% over plan. The variance is driven by expedited shipments on 17 high-value orders and carrier fuel surcharges. The certified Finance definition confirms this comparison excludes returns.',
      metrics: [['$18.42', 'cost per order'], ['+8.2%', 'vs. plan'], ['17', 'expedited orders']],
      sources: ['Data Warehouse', 'Finance Metrics'],
      gifTitle: 'West cost alert',
      gifStat: '+8.2% vs plan'
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
