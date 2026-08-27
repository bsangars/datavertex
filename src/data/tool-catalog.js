export const toolCatalog = [
  {
    name: 'workday.search_workers',
    server: 'Workday',
    icon: 'W',
    tone: 'workday',
    description: 'Find workers and approved, non-sensitive employment facts by name, team, status, or start-date window.',
    schema: '{ query, start_after?, start_before? }'
  },
  {
    name: 'workday.get_onboarding_status',
    server: 'Workday',
    icon: 'W',
    tone: 'workday',
    description: 'Return onboarding task completion for approved people and managers.',
    schema: '{ start_after?, start_before? }'
  },
  {
    name: 'documents.search',
    server: 'Documents',
    icon: '▤',
    tone: 'docs',
    description: 'Search approved document stores and return excerpts, owners, and canonical links.',
    schema: '{ query, filters? }'
  },
  {
    name: 'warehouse.query_readonly',
    server: 'Data Warehouse',
    icon: '⌁',
    tone: 'data',
    description: 'Run a validated, read-only analytical query against modeled business data.',
    schema: '{ metric, dimensions?, period? }'
  },
  {
    name: 'warehouse.get_metric_definition',
    server: 'Data Warehouse',
    icon: '⌁',
    tone: 'data',
    description: 'Retrieve the certified definition, owner, and lineage for a business metric.',
    schema: '{ metric }'
  },
  {
    name: 'knowledge.search_articles',
    server: 'Knowledge',
    icon: '✣',
    tone: 'knowledge',
    description: 'Search published policies, internal articles, and operating procedures.',
    schema: '{ query, audience? }'
  }
];
