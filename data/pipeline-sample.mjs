// A fixed, synthetic snapshot created when these demo jobs are first imported.
export function buildPipelineSample(now = new Date()) {
  const snapshot = now.toISOString();
  const configs = [
    ['sales-crm', 'Sales', 'CRM opportunity sync', 'Sales Operations', 60, 8, 'Succeeded', 1540, ''],
    ['sales-orders', 'Sales', 'Order ingestion', 'Revenue Engineering', 120, 14, 'Succeeded', 820, ''],
    ['sales-revenue', 'Sales', 'Revenue aggregation', 'Revenue Engineering', 1440, 23, 'Failed', 0, 'Sample failure: source extract missing required currency field.'],
    ['sales-forecast', 'Sales', 'Forecast refresh', 'Sales Operations', 360, 11, 'Running', 460, 'Sample run in progress at snapshot time.'],
    ['hr-roster', 'HR', 'Employee roster sync', 'People Systems', 1440, 6, 'Succeeded', 1200, ''],
    ['hr-onboarding', 'HR', 'Onboarding task refresh', 'People Systems', 240, 9, 'Succeeded', 72, ''],
    ['planning-demand', 'Planning', 'Demand planning refresh', 'Planning Analytics', 1440, 31, 'Succeeded', 6200, '']
  ];
  return configs.map(([id, department, name, owner, interval, minutes, status, rows, error], index) => {
    const lastStart = new Date(now.getTime() - (status === 'Running' ? minutes : minutes + 20 + index * 5) * 60000);
    const date = value => new Date(value).toISOString();
    return { id, department, name, owner, schedule: `Every ${interval < 60 ? interval + ' minutes' : interval / 60 + ' hours'}`, timezone: 'UTC', snapshot_at: snapshot,
      next_run_at: date(lastStart.getTime() + interval * 60000),
      runs: [0, 1, 2].map(offset => {
        const started = lastStart.getTime() - interval * 60000 * offset;
        const duration = (minutes + offset) * 60;
        return { id: `${id}-${offset}`, started_at: date(started), finished_at: offset === 0 && status === 'Running' ? null : date(started + duration * 1000), duration_seconds: duration,
          status: offset === 0 ? status : 'Succeeded', rows_processed: offset === 0 ? rows : rows || 950,
          error: offset === 0 ? error : '' };
      }) };
  });
}
