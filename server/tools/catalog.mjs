export const tools = [
  {
    name: 'operations.get_pipeline_runs', title: 'Company pipeline runs',
    description: 'Read synthetic SQLite operational data pipelines across Sales, HR and Planning: schedules, owners, latest status, runtime, next scheduled run, error details and three recent runs per pipeline. Use for company pipeline summary or job monitoring, not sales opportunity value.',
    inputSchema: { type: 'object', additionalProperties: false, properties: { department: { type: 'string', enum: ['Sales', 'HR', 'Planning'] } } }
  },
  {
    name: 'sales.get_quarterly_sales', title: 'Quarterly sales — won and open deals',
    description: 'Read the SQLite sales database for a calendar quarter. Separately returns closed-won booked sales, open pipeline, probability-weighted open pipeline, closed-lost exclusions, and individual deals. Defaults to the current calendar quarter. Data is synthetic.',
    inputSchema: { type: 'object', additionalProperties: false, properties: {
      year: { type: 'integer', minimum: 2000, maximum: 2100 }, quarter: { type: 'integer', minimum: 1, maximum: 4 }
    } }
  },
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
    name: 'sales.get_open_orders',
    title: 'Get open orders on deals',
    description: 'Return purchase orders linked to sales opportunities. Defaults to active statuses (Open, In Fulfillment, On Hold). Optional filters: opportunity_id, account_id, region, or a specific status. Set include_closed=true to include Shipped, Delivered, and Cancelled orders. Data is synthetic SQLite.',
    inputSchema: {
      type: 'object',
      properties: {
        opportunity_id: { type: 'integer' },
        account_id: { type: 'integer' },
        region: { type: 'string' },
        status: { type: 'string', enum: ['Open', 'In Fulfillment', 'On Hold', 'Shipped', 'Delivered', 'Cancelled'] },
        include_closed: { type: 'boolean' }
      }
    }
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
