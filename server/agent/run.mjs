import { makeFallbackAnswer, makeFallbackPlan } from './fallback.mjs';
import { executePlan, planWithOpenAI, synthesizeWithOpenAI } from './openai.mjs';

export async function runAgent(question, settings = {}) {
  const trimmed = question.trim();
  if (!trimmed) {
    throw new Error('Question is required.');
  }

  const hasOpenAI = Boolean(settings.apiKey || process.env.OPENAI_API_KEY);
  const openAiSettings = {
    apiKey: settings.apiKey || process.env.OPENAI_API_KEY,
    model: settings.model || process.env.OPENAI_MODEL || 'gpt-4o-mini'
  };

  if (!hasOpenAI) {
    const plan = makeFallbackPlan(trimmed);
    return {
      mode: 'fallback',
      plan,
      answer: makeFallbackAnswer(trimmed, plan)
    };
  }

  try {
    const plannedSteps = await planWithOpenAI(trimmed, openAiSettings);
    const plan = plannedSteps.length ? executePlan(plannedSteps) : makeFallbackPlan(trimmed);
    const answer = await synthesizeWithOpenAI(trimmed, plan, openAiSettings);
    return { mode: 'openai', plan, answer };
  } catch (error) {
    const plan = makeFallbackPlan(trimmed);
    return {
      mode: 'fallback',
      plan,
      answer: makeFallbackAnswer(trimmed, plan),
      warning: error.message
    };
  }
}
