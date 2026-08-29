import { tools } from './tools/catalog.mjs';

const SERVER_META = {
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
    brand: { name: 'Agent Workspace', mark: '✦', beta: true },
    workspace: { name: 'Default workspace', avatar: 'A' },
    user: { name: 'Workspace user', role: 'Operator', avatar: 'U' },
    hero: {
      eyebrow: 'ORCHESTRATOR',
      title: 'One question. The right tools.',
      body: 'The agent plans work across your approved MCP servers, shows the evidence it used, and turns the answer into a shareable briefing.'
    },
    welcome: {
      title: 'What would you like to know?',
      body: 'Ask a question and the agent will pick the right read-only tools, run them, and synthesize a sourced answer.'
    },
    samplePrompts: [
      { label: 'People starting soon and onboarding gaps', prompt: 'Who is starting in the next 30 days, and what onboarding documents do they still need?' },
      { label: 'Pipeline summary and closing deals', prompt: 'What is our sales pipeline summary and which deals are closing this month?' },
      { label: 'Regional cost variance', prompt: 'Why did West region fulfillment cost increase this month?' },
      { label: 'Current workplace policy', prompt: 'What is our current hybrid-work policy for managers?' }
    ],
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
