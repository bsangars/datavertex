export const tools = [
  {
    name: 'workday.search_workers',
    title: 'Search workers',
    description: 'Find approved, non-sensitive worker records by an allowed query.',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string' }, start_after: { type: 'string' }, start_before: { type: 'string' } },
      required: ['query']
    }
  },
  {
    name: 'workday.get_onboarding_status',
    title: 'Get onboarding status',
    description: 'Return approved onboarding progress for a date window.',
    inputSchema: { type: 'object', properties: { start_after: { type: 'string' }, start_before: { type: 'string' } } }
  },
  {
    name: 'sales.search_opportunities',
    title: 'Search opportunities',
    description: 'Search open sales opportunities by account, owner, stage, or region.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        stage: { type: 'string' },
        region: { type: 'string' },
        close_before: { type: 'string' }
      }
    }
  },
  {
    name: 'sales.get_pipeline_summary',
    title: 'Get pipeline summary',
    description: 'Return open pipeline value, stage mix, and recent win rate.',
    inputSchema: { type: 'object', properties: { period: { type: 'string' } } }
  },
  {
    name: 'documents.search',
    title: 'Search documents',
    description: 'Search approved document sources and return citations.',
    inputSchema: { type: 'object', properties: { query: { type: 'string' }, filters: { type: 'object' } }, required: ['query'] }
  },
  {
    name: 'warehouse.query_readonly',
    title: 'Query analytical data',
    description: 'Run a validated, read-only query against certified data.',
    inputSchema: {
      type: 'object',
      properties: { metric: { type: 'string' }, dimensions: { type: 'array', items: { type: 'string' } }, period: { type: 'string' } },
      required: ['metric']
    }
  },
  {
    name: 'warehouse.get_metric_definition',
    title: 'Get metric definition',
    description: 'Return the certified definition and lineage for a metric.',
    inputSchema: { type: 'object', properties: { metric: { type: 'string' } }, required: ['metric'] }
  },
  {
    name: 'knowledge.search_articles',
    title: 'Search knowledge articles',
    description: 'Search published policies and company knowledge.',
    inputSchema: { type: 'object', properties: { query: { type: 'string' }, audience: { type: 'string' } }, required: ['query'] }
  }
];
