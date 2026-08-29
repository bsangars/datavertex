import { tools } from '../tools/catalog.mjs';
import { runTool } from '../tools/handlers.mjs';
import { summarizeResult } from './summarize.mjs';

const DEFAULT_MODEL = 'gpt-4o-mini';
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

function todayLabel() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysLabel(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function openAiTools() {
  return tools.map(tool => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema
    }
  }));
}

async function callOpenAI({ apiKey, model, messages, tools: toolDefs }) {
  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: model || DEFAULT_MODEL,
      temperature: 0.2,
      messages,
      tools: toolDefs,
      tool_choice: toolDefs ? 'auto' : undefined,
      response_format: toolDefs ? undefined : { type: 'json_object' }
    })
  });

  const payload = await response.json();
  if (!response.ok) {
    const message = payload?.error?.message || `OpenAI request failed (${response.status})`;
    throw new Error(message);
  }
  return payload.choices[0].message;
}

export async function planWithOpenAI(question, settings = {}) {
  const message = await callOpenAI({
    apiKey: settings.apiKey,
    model: settings.model,
    messages: [
      {
        role: 'system',
        content: [
          'You route user questions to approved read-only tools.',
          `Today is ${todayLabel()}. For starter or onboarding windows, use start_after=${todayLabel()} and start_before=${addDaysLabel(30)} unless the user specifies otherwise.`,
          'Pick only the tools needed to answer the question. Prefer fewer, more precise calls.',
          'Use exact tool names and valid JSON arguments that match each tool schema.'
        ].join(' ')
      },
      { role: 'user', content: question }
    ],
    tools: openAiTools()
  });

  const calls = message.tool_calls || [];
  return calls.map(call => ({
    name: call.function.name,
    args: JSON.parse(call.function.arguments || '{}')
  }));
}

export function executePlan(steps) {
  return steps.map(step => {
    const structuredResult = runTool(step.name, step.args);
    if (!structuredResult) {
      throw new Error(`Unknown tool: ${step.name}`);
    }
    return {
      name: step.name,
      args: step.args,
      structuredResult,
      result: summarizeResult(step.name, structuredResult)
    };
  });
}

export async function synthesizeWithOpenAI(question, plan, settings = {}) {
  const evidence = plan.map(step => ({
    tool: step.name,
    arguments: step.args,
    result: step.structuredResult
  }));

  const message = await callOpenAI({
    apiKey: settings.apiKey,
    model: settings.model,
    messages: [
      {
        role: 'system',
        content: [
          'You synthesize a concise business answer from tool evidence.',
          'Return JSON only with this shape:',
          '{"title":"string","body":"string","metrics":[["value","label"]],"sources":["string"],"gifTitle":"string","gifStat":"string"}',
          'Ground every claim in the tool results. Use source namespaces like workday, sales, documents, warehouse, knowledge.',
          'When employee or worker records are present, list every employee name and department in the body.',
          'Keep body to 2-4 sentences. Include 2-3 metrics when possible.'
        ].join(' ')
      },
      {
        role: 'user',
        content: JSON.stringify({ question, evidence })
      }
    ]
  });

  try {
    return JSON.parse(message.content);
  } catch {
    return {
      title: 'Answer synthesized from tool evidence',
      body: message.content,
      metrics: [[`${plan.length}`, 'tools used']],
      sources: [...new Set(plan.map(step => step.name.split('.')[0]))],
      gifTitle: 'Agent briefing',
      gifStat: `${plan.length} tools used`
    };
  }
}
