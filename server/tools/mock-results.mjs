export const mockResults = {
  'workday.search_workers': {
    count: 12,
    records: [
      { employee: 'Avery Chen', start_date: '2026-09-01', department: 'Operations' },
      { employee: 'Jordan Lee', start_date: '2026-09-03', department: 'Sales' }
    ],
    note: 'Sample approved fields only.'
  },
  'workday.get_onboarding_status': {
    starters: 12,
    follow_up_needed: 5,
    pending_tasks: 8,
    common_gaps: ['IT-access acknowledgement', 'Benefits enrollment']
  },
  'documents.search': {
    documents: [
      { title: 'New Starter Onboarding Checklist', status: 'approved', owner: 'People Operations' },
      { title: 'IT Access Acknowledgement', status: 'approved', owner: 'IT' }
    ],
    incomplete_packets: 3
  },
  'warehouse.query_readonly': {
    metric: 'fulfillment_cost',
    value: '$18.42/order',
    comparison: '+8.2% vs plan',
    drivers: ['17 expedited orders', 'carrier fuel surcharge']
  },
  'warehouse.get_metric_definition': {
    metric: 'fulfillment_cost',
    owner: 'Finance',
    definition: 'Fulfillment expense divided by shipped orders; returns excluded.',
    version: 'v3'
  },
  'knowledge.search_articles': {
    articles: [
      {
        title: 'Hybrid Work Policy',
        version: '4.2',
        status: 'published',
        excerpt: 'Managers may approve up to three remote days per week when role requirements permit.'
      }
    ]
  }
};
