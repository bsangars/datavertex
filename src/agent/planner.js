const matches = {
  workday: /workday|employee|people|starter|start|hire|onboard|hr|headcount|manager|pto|leave/,
  documents: /document|file|onboard|policy|contract|handbook|need|missing/,
  data: /cost|revenue|data|rdbms|database|metric|fulfillment|inventory|west|increase|month|trend/,
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

export function makePlan(question, now) {
  const query = question.toLowerCase();
  const window = dateWindow(now);
  const plan = [];
  const usesWorkday = matches.workday.test(query);

  if (usesWorkday) {
    plan.push({
      name: 'workday.search_workers',
      args: { query: 'new starters', start_after: window.start, start_before: window.end },
      result: '12 approved worker records found with starts in the next 30 days.'
    });
    if (/onboard|document|need|missing/.test(query)) {
      plan.push({
        name: 'workday.get_onboarding_status',
        args: { start_after: window.start, start_before: window.end },
        result: '8 onboarding tasks are pending across 5 new starters.'
      });
    }
  }

  if (matches.documents.test(query)) {
    plan.push({
      name: 'documents.search',
      args: { query: usesWorkday ? 'new starter onboarding required documents' : question },
      result: usesWorkday ? '4 document templates and 3 incomplete packets matched.' : '7 relevant approved documents matched.'
    });
  }

  if (matches.data.test(query)) {
    plan.push({
      name: 'warehouse.query_readonly',
      args: { metric: 'fulfillment_cost', dimensions: ['region'], period: 'current month' },
      result: 'West fulfillment cost is $18.42/order, 8.2% above plan.'
    });
    plan.push({
      name: 'warehouse.get_metric_definition',
      args: { metric: 'fulfillment_cost' },
      result: 'Certified metric definition retrieved from Finance Metrics v3.'
    });
  }

  if (matches.knowledge.test(query)) {
    plan.push({
      name: 'knowledge.search_articles',
      args: { query: question, audience: 'managers' },
      result: 'Hybrid Work Policy v4.2 is the current approved article.'
    });
  }

  if (!plan.length) {
    plan.push({
      name: 'knowledge.search_articles',
      args: { query: question, audience: 'all employees' },
      result: 'Relevant company knowledge sources found.'
    });
  }

  return plan.filter((step, index, all) => all.findIndex(item => item.name === step.name) === index);
}
