import { tools } from './tools/catalog.mjs';

const SERVER_META = {
  operations: { label: 'Pipeline runs', icon: '↻', tone: 'data' },
  workday: { label: 'HRIS', icon: 'W', tone: 'workday' },
  sales: { label: 'CRM', icon: 'S', tone: 'sales' },
  documents: { label: 'Files', icon: '▤', tone: 'docs' },
  warehouse: { label: 'Analytics', icon: '⌁', tone: 'data' },
  knowledge: { label: 'Articles', icon: '✣', tone: 'knowledge' }
};

function schemaSummary(inputSchema = {}) {
  const required = new Set(inputSchema.required || []);
  const properties = Object.keys(inputSchema.properties || {});
  if (!properties.length) return '{}';
  return `{ ${properties.map(key => `${key}${required.has(key) ? '' : '?'}`).join(', ')} }`;
}

function serverLabel(namespace) {
  return namespace.charAt(0).toUpperCase() + namespace.slice(1).replace(/_/g, ' ');
}

export function buildToolCatalog() {
  return tools.map(tool => {
    const namespace = tool.name.split('.')[0];
    const meta = SERVER_META[namespace] || { label: 'Tools', icon: '•', tone: 'data' };
    return {
      name: tool.name,
      title: tool.title,
      server: serverLabel(namespace),
      namespace,
      icon: meta.icon,
      tone: meta.tone,
      description: tool.description,
      schema: schemaSummary(tool.inputSchema),
      inputSchema: tool.inputSchema
    };
  });
}

export function buildServerGroups(catalog = buildToolCatalog()) {
  const groups = new Map();
  catalog.forEach(tool => {
    if (!groups.has(tool.namespace)) {
      const meta = SERVER_META[tool.namespace] || { label: 'Tools', icon: '•', tone: 'data' };
      groups.set(tool.namespace, {
        id: tool.namespace,
        name: tool.server,
        icon: meta.icon,
        tone: meta.tone,
        label: meta.label,
        tools: []
      });
    }
    groups.get(tool.namespace).tools.push(tool.name);
  });
  return [...groups.values()];
}

export function buildWorkspaceConfig() {
  const catalog = buildToolCatalog();
  const servers = buildServerGroups(catalog);
  return {
    brand: { name: 'Data Vertex', mark: '✦', beta: true },
    workspace: { name: 'Default workspace', avatar: 'A' },
    user: { name: 'Workspace user', role: 'Operator', avatar: 'U' },
    hero: {
      eyebrow: 'MCP AGENT WORKSPACE',
      title: 'The agent handles the rest.',
      body: ''
    },
    welcome: {
      title: 'Pick a starting question — or write your own.',
      body: 'The agent picks the right tools, runs them read-only, and shows every argument, result, and citation as it works.'
    },
    samplePrompts: [
      {
        label: 'Quarterly sales — closed and open deals',
        prompt: 'What are our sales for this quarter? Show closed-won sales and open deals separately, including weighted pipeline.',
        followUps: [
          'What are the open orders on these deals?',
          'Which open deals are at risk of slipping past this quarter?',
          'Who owns the highest-value open deals?'
        ]
      },
      {
        label: 'People starting soon and onboarding gaps',
        prompt: 'Who is starting in the next 30 days, and what onboarding documents do they still need?',
        followUps: [
          'Which manager has the most pending onboarding tasks?',
          'Which onboarding documents have not been signed yet?',
          'What is the department mix of new starters?'
        ]
      },
      {
        label: 'Company pipelines — schedules and status',
        prompt: 'List all company data pipelines across Sales, HR and Planning with schedules, runtimes, latest status and recent runs.',
        followUps: [
          'Which pipelines failed most recently and what were the errors?',
          'Which pipelines have the longest runtimes?',
          'When is the next scheduled run for the HR pipelines?'
        ]
      },
      {
        label: 'Regional cost variance',
        prompt: 'Why did West region fulfillment cost increase this month?',
        followUps: [
          'How does fulfillment cost compare across all regions this month?',
          'What is the 3-month trend for West fulfillment cost?',
          'How many expedited orders drove the variance this month?'
        ]
      },
      {
        label: 'Current workplace policy',
        prompt: 'What is our current hybrid-work policy for managers?',
        followUps: [
          'Who owns this policy and when was it approved?',
          'Are there policy exceptions for team leads?',
          'What was the previous version of the hybrid-work policy?'
        ]
      }
    ],
    followUpsByTool: {
      'sales.get_quarterly_sales': [
        'What are the open orders on these deals?',
        'Which open deals are at risk of slipping past this quarter?',
        'Who owns the highest-value open deals?'
      ],
      'sales.get_open_orders': [
        'Which orders are In Fulfillment and expected to ship next week?',
        'Break down open orders by account and region.',
        'Show all orders on Northwind Logistics deals.'
      ],
      'sales.search_opportunities': [
        'What are the open orders on these deals?',
        'Which deals are closing in the next 14 days?',
        'Which regions have the largest open pipeline?'
      ],
      'sales.get_pipeline_summary': [
        'What are the open orders on these deals?',
        'Which open deals are at risk of slipping past this quarter?',
        'Show me the top open deals by owner.'
      ],
      'workday.get_onboarding_status': [
        'Which manager has the most pending onboarding tasks?',
        'Which onboarding documents have not been signed yet?',
        'What is the department mix of new starters?'
      ],
      'workday.search_workers': [
        'Which onboarding documents have not been signed yet?',
        'Which manager has the most pending onboarding tasks?',
        'Which new starters are remote versus onsite?'
      ],
      'operations.get_pipeline_runs': [
        'Which pipelines failed most recently and what were the errors?',
        'Which pipelines have the longest runtimes?',
        'When is the next scheduled run for the HR pipelines?'
      ],
      'warehouse.query_readonly': [
        'How does fulfillment cost compare across all regions this month?',
        'What is the 3-month trend for West fulfillment cost?',
        'How many expedited orders drove the variance this month?'
      ],
      'warehouse.get_metric_definition': [
        'How does fulfillment cost compare across all regions this month?',
        'What is the 3-month trend for West fulfillment cost?'
      ],
      'knowledge.search_articles': [
        'Who owns this policy and when was it approved?',
        'Are there policy exceptions for team leads?',
        'What was the previous version of the hybrid-work policy?'
      ],
      'documents.search': [
        'Which onboarding documents have not been signed yet?',
        'Who owns the onboarding checklist?'
      ]
    },
    policies: [
      { id: '01', title: 'Scoped access', body: 'Tools are exposed only after identity, tenant, and role checks. Sensitive fields should be filtered before the model sees them.' },
      { id: '02', title: 'Read first', body: 'Queries and search are automatically allowed. Any write, export, or external action must pause for clear approval.' },
      { id: '03', title: 'Evidence trail', body: 'Every answer keeps its plan, tool arguments, source references, and result summary for review.' }
    ],
    toolCount: catalog.length,
    serverCount: servers.length,
    servers,
    tools: catalog
  };
}
