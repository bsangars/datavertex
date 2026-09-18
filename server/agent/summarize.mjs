export function summarizeResult(name, result) {
  switch (name) {
    case 'workday.search_workers': {
      const preview = (result.records || []).slice(0, 6).map(record => record.employee).join(', ');
      const suffix = result.count > 6 ? `, and ${result.count - 6} more` : '';
      return `${result.count} employees (${result.scope || 'matched'}): ${preview}${suffix}.`;
    }
    case 'workday.get_onboarding_status':
      return `${result.pending_tasks} onboarding tasks are pending across ${result.follow_up_needed} new starters.`;
    case 'operations.get_pipeline_runs':
      return `${result.count} pipelines: ${result.departments.Sales} Sales, ${result.departments.HR} HR, ${result.departments.Planning} Planning. Latest: ${result.statuses.Succeeded} succeeded, ${result.statuses.Failed} failed, ${result.statuses.Running} running. Synthetic SQLite snapshot.`;
    case 'sales.get_quarterly_sales':
      return `${result.period}: $${result.closed_won.value.toLocaleString()} closed-won (${result.closed_won.count} deals), $${result.open_pipeline.value.toLocaleString()} open (${result.open_pipeline.count} deals), $${result.open_pipeline.weighted_value.toLocaleString()} weighted open estimate. Synthetic SQLite data.`;
    case 'sales.search_opportunities':
      return `${result.count} open opportunities matched in the pipeline.`;
    case 'sales.get_pipeline_summary':
      return `$${Number(result.pipeline_value).toLocaleString()} in open pipeline across ${result.open_deals} deals (${result.win_rate_pct}% win rate).`;
    case 'sales.get_open_orders': {
      const money = value => '$' + Number(value).toLocaleString('en-US', { maximumFractionDigits: 0 });
      const statusPreview = Object.entries(result.by_status).filter(([, count]) => count > 0).map(([status, count]) => `${count} ${status}`).join(', ');
      return `${result.count} orders (${money(result.total_value)} total, ${money(result.active_value)} active): ${statusPreview}.`;
    }
    case 'documents.search':
      return `${result.documents.length} document templates and ${result.incomplete_packets} incomplete packets matched.`;
    case 'warehouse.query_readonly':
      return `${result.region || 'All'} fulfillment cost is ${result.value}, ${result.comparison}.`;
    case 'warehouse.get_metric_definition':
      return `Certified metric definition retrieved from Finance Metrics ${result.version}.`;
    case 'knowledge.search_articles':
      return result.articles[0]
        ? `${result.articles[0].title} v${result.articles[0].version} is the current approved article.`
        : 'Relevant company knowledge sources found.';
    default:
      return 'Tool completed successfully.';
  }
}
