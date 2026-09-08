import {
  getPipelineRuns,
  getQuarterlySales,
  getMetricDefinition,
  getOnboardingStatus,
  getPipelineSummary,
  queryMetric,
  searchArticles,
  searchDocuments,
  searchOpportunities,
  searchWorkers
} from '../db/index.mjs';

export const toolHandlers = {
  'operations.get_pipeline_runs': args => getPipelineRuns(args),
  'sales.get_quarterly_sales': args => getQuarterlySales(args),
  'workday.search_workers': args => searchWorkers(args),
  'workday.get_onboarding_status': args => getOnboardingStatus(args),
  'sales.search_opportunities': args => searchOpportunities(args),
  'sales.get_pipeline_summary': args => getPipelineSummary(args),
  'documents.search': args => searchDocuments(args),
  'warehouse.query_readonly': args => queryMetric(args),
  'warehouse.get_metric_definition': args => getMetricDefinition(args),
  'knowledge.search_articles': args => searchArticles(args)
};

export function runTool(name, args = {}) {
  const handler = toolHandlers[name];
  if (!handler) return null;
  return handler(args);
}
