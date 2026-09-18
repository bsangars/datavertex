import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSeed } from '../../data/seed.js';
import { quarterlySales } from '../../data/quarterly-sales.mjs';
import { buildPipelineSample } from '../../data/pipeline-sample.mjs';
import { orders as sampleOrders } from '../../data/orders.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const dbPath = process.env.VERTEX_DB_PATH || join(root, 'data', 'vertex.db');

let database;

function getDatabase() {
  if (database) return database;
  mkdirSync(dirname(dbPath), { recursive: true });
  database = new DatabaseSync(dbPath);
  database.exec('PRAGMA foreign_keys = ON;');
  initializeSchema(database);
  seedIfEmpty(database);
  const insertSample = database.prepare('INSERT OR IGNORE INTO opportunities (id, account_id, name, stage, amount, close_date, owner, probability) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  database.exec('BEGIN');
  try {
    quarterlySales.forEach(row => insertSample.run(row.id, row.account_id, row.name, row.stage, row.amount, row.close_date, row.owner, row.probability));
    database.exec('COMMIT');
  } catch (error) { database.exec('ROLLBACK'); throw error; }
  seedPipelineSamples(database);
  seedOrders(database);
  return database;
}

function seedOrders(db) {
  const insert = db.prepare('INSERT OR IGNORE INTO orders (id, opportunity_id, account_id, order_number, status, amount, items, ordered_at, expected_ship_date, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  db.exec('BEGIN');
  try {
    sampleOrders.forEach(row => insert.run(row.id, row.opportunity_id, row.account_id, row.order_number, row.status, row.amount, row.items || null, row.ordered_at, row.expected_ship_date || null, row.notes || null));
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}

function initializeSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS workers (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      department TEXT NOT NULL,
      manager TEXT,
      start_date TEXT NOT NULL,
      status TEXT NOT NULL,
      location TEXT
    );

    CREATE TABLE IF NOT EXISTS onboarding_tasks (
      id INTEGER PRIMARY KEY,
      worker_id INTEGER NOT NULL REFERENCES workers(id),
      task_name TEXT NOT NULL,
      status TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      industry TEXT,
      region TEXT,
      owner TEXT
    );

    CREATE TABLE IF NOT EXISTS opportunities (
      id INTEGER PRIMARY KEY,
      account_id INTEGER NOT NULL REFERENCES accounts(id),
      name TEXT NOT NULL,
      stage TEXT NOT NULL,
      amount REAL NOT NULL,
      close_date TEXT,
      owner TEXT,
      probability INTEGER
    );

    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      owner TEXT
    );

    CREATE TABLE IF NOT EXISTS metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      metric TEXT NOT NULL,
      region TEXT,
      value REAL NOT NULL,
      plan_value REAL NOT NULL,
      period TEXT NOT NULL,
      expedited_orders INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      version TEXT,
      status TEXT NOT NULL,
      excerpt TEXT,
      owner TEXT,
      approved_at TEXT,
      audience TEXT
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY,
      opportunity_id INTEGER REFERENCES opportunities(id),
      account_id INTEGER REFERENCES accounts(id),
      order_number TEXT NOT NULL,
      status TEXT NOT NULL,
      amount REAL NOT NULL,
      items INTEGER,
      ordered_at TEXT NOT NULL,
      expected_ship_date TEXT,
      notes TEXT
    );
  `);
  // Best-effort schema evolution for pre-existing DBs
  const existingArticleCols = db.prepare("PRAGMA table_info('articles')").all().map(row => row.name);
  if (!existingArticleCols.includes('owner')) {
    try { db.exec('ALTER TABLE articles ADD COLUMN owner TEXT'); } catch {}
    try { db.exec('ALTER TABLE articles ADD COLUMN approved_at TEXT'); } catch {}
    try { db.exec('ALTER TABLE articles ADD COLUMN audience TEXT'); } catch {}
  }
}

function seedIfEmpty(db) {
  const count = db.prepare('SELECT COUNT(*) AS total FROM workers').get().total;
  if (count > 0) return;

  const seed = buildSeed();
  const insertWorker = db.prepare(
    'INSERT INTO workers (id, name, department, manager, start_date, status, location) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  const insertTask = db.prepare(
    'INSERT INTO onboarding_tasks (id, worker_id, task_name, status) VALUES (?, ?, ?, ?)'
  );
  const insertAccount = db.prepare(
    'INSERT INTO accounts (id, name, industry, region, owner) VALUES (?, ?, ?, ?, ?)'
  );
  const insertOpportunity = db.prepare(
    'INSERT INTO opportunities (id, account_id, name, stage, amount, close_date, owner, probability) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  const insertDocument = db.prepare('INSERT INTO documents (id, title, status, owner) VALUES (?, ?, ?, ?)');
  const insertMetric = db.prepare(
    'INSERT INTO metrics (metric, region, value, plan_value, period, expedited_orders) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const insertArticle = db.prepare('INSERT INTO articles (title, version, status, excerpt, owner, approved_at, audience) VALUES (?, ?, ?, ?, ?, ?, ?)');

  const seedAll = () => {
    seed.workers.forEach(row => insertWorker.run(row.id, row.name, row.department, row.manager, row.start_date, row.status, row.location));
    seed.onboardingTasks.forEach(row => insertTask.run(row.id, row.worker_id, row.task_name, row.status));
    seed.accounts.forEach(row => insertAccount.run(row.id, row.name, row.industry, row.region, row.owner));
    seed.opportunities.forEach(row => insertOpportunity.run(row.id, row.account_id, row.name, row.stage, row.amount, row.close_date, row.owner, row.probability));
    seed.documents.forEach(row => insertDocument.run(row.id, row.title, row.status, row.owner));
    seed.metrics.forEach(row => insertMetric.run(row.metric, row.region, row.value, row.plan_value, row.period, row.expedited_orders));
    seed.articles.forEach(row => insertArticle.run(row.title, row.version, row.status, row.excerpt, row.owner || null, row.approved_at || null, row.audience || null));
  };

  db.exec('BEGIN');
  try {
    seedAll();
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function dateWindow(now = new Date()) {
  const end = new Date(now);
  end.setDate(end.getDate() + 30);
  return { start: now.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export function searchWorkers({ query = '', start_after, start_before, all = false } = {}) {
  const db = getDatabase();
  const wantsFullList = all || /employee|employees|worker|workers|staff|roster|headcount|people list|employee list|who are/.test(query.toLowerCase());

  const records = wantsFullList
    ? db.prepare(`
        SELECT name AS employee, department, start_date, manager, location
        FROM workers
        ORDER BY name
      `).all()
    : (() => {
        const window = dateWindow();
        const after = start_after || window.start;
        const before = start_before || window.end;
        return db.prepare(`
          SELECT name AS employee, department, start_date, manager, location
          FROM workers
          WHERE start_date >= ? AND start_date <= ?
          ORDER BY start_date
        `).all(after, before);
      })();

  return {
    count: records.length,
    records,
    scope: wantsFullList ? 'all approved employees' : 'starts in the next 30 days',
    note: 'Approved fields only from SQLite HR store.'
  };
}

export function getOnboardingStatus({ start_after, start_before } = {}) {
  const db = getDatabase();
  const window = dateWindow();
  const after = start_after || window.start;
  const before = start_before || window.end;

  const starters = db.prepare(`
    SELECT id, name FROM workers
    WHERE start_date >= ? AND start_date <= ?
  `).all(after, before);

  const starterIds = starters.map(worker => worker.id);
  if (!starterIds.length) {
    return { starters: 0, follow_up_needed: 0, pending_tasks: 0, common_gaps: [] };
  }

  const placeholders = starterIds.map(() => '?').join(', ');
  const pendingTasks = db.prepare(`
    SELECT task_name, COUNT(*) AS total
    FROM onboarding_tasks
    WHERE worker_id IN (${placeholders}) AND status = 'pending'
    GROUP BY task_name
    ORDER BY total DESC
  `).all(...starterIds);

  const pendingCount = db.prepare(`
    SELECT COUNT(*) AS total
    FROM onboarding_tasks
    WHERE worker_id IN (${placeholders}) AND status = 'pending'
  `).get(...starterIds).total;

  const followUp = db.prepare(`
    SELECT COUNT(DISTINCT worker_id) AS total
    FROM onboarding_tasks
    WHERE worker_id IN (${placeholders}) AND status = 'pending'
  `).get(...starterIds).total;

  const byManager = db.prepare(`
    SELECT w.manager AS manager,
           COUNT(*) AS pending_tasks,
           COUNT(DISTINCT w.id) AS starters_with_gaps
    FROM onboarding_tasks t
    JOIN workers w ON w.id = t.worker_id
    WHERE t.worker_id IN (${placeholders}) AND t.status = 'pending'
    GROUP BY w.manager
    ORDER BY pending_tasks DESC
  `).all(...starterIds);

  const byDepartment = db.prepare(`
    SELECT department, COUNT(*) AS starters
    FROM workers
    WHERE id IN (${placeholders})
    GROUP BY department
    ORDER BY starters DESC
  `).all(...starterIds);

  return {
    starters: starters.length,
    follow_up_needed: followUp,
    pending_tasks: pendingCount,
    common_gaps: pendingTasks.slice(0, 3).map(row => row.task_name),
    by_manager: byManager,
    by_department: byDepartment,
    pending_by_task: pendingTasks
  };
}

export function searchOpportunities({ query = '', stage, region, close_before } = {}) {
  const db = getDatabase();
  const window = dateWindow();
  const before = close_before || window.end;
  const like = `%${query}%`;

  let sql = `
    SELECT o.name, o.stage, o.amount, o.close_date, o.owner, o.probability, a.name AS account, a.region
    FROM opportunities o
    JOIN accounts a ON a.id = o.account_id
    WHERE o.close_date <= ?
      AND o.stage NOT IN ('Closed Won', 'Closed Lost')
  `;
  const params = [before];

  if (query) {
    sql += ' AND (o.name LIKE ? OR a.name LIKE ? OR o.owner LIKE ?)';
    params.push(like, like, like);
  }
  if (stage) {
    sql += ' AND o.stage = ?';
    params.push(stage);
  }
  if (region) {
    sql += ' AND a.region = ?';
    params.push(region);
  }

  sql += ' ORDER BY o.close_date, o.amount DESC';
  const records = db.prepare(sql).all(...params);

  return {
    count: records.length,
    records,
    note: 'Open pipeline opportunities from SQLite CRM store.'
  };
}

export function getPipelineSummary({ period = 'current quarter' } = {}) {
  const db = getDatabase();
  const byStage = db.prepare(`
    SELECT stage, COUNT(*) AS deals, ROUND(SUM(amount), 2) AS value
    FROM opportunities
    WHERE stage NOT IN ('Closed Won', 'Closed Lost')
    GROUP BY stage
    ORDER BY value DESC
  `).all();

  const totals = db.prepare(`
    SELECT
      COUNT(*) AS open_deals,
      ROUND(SUM(amount), 2) AS pipeline_value,
      ROUND(AVG(probability), 1) AS avg_probability
    FROM opportunities
    WHERE stage NOT IN ('Closed Won', 'Closed Lost')
  `).get();

  const closed = db.prepare(`
    SELECT
      SUM(CASE WHEN stage = 'Closed Won' THEN 1 ELSE 0 END) AS won,
      SUM(CASE WHEN stage = 'Closed Lost' THEN 1 ELSE 0 END) AS lost
    FROM opportunities
    WHERE stage IN ('Closed Won', 'Closed Lost')
  `).get();

  const decided = (closed.won || 0) + (closed.lost || 0);
  const winRate = decided ? Math.round((closed.won / decided) * 1000) / 10 : 0;

  return {
    period,
    open_deals: totals.open_deals || 0,
    pipeline_value: totals.pipeline_value || 0,
    avg_probability: totals.avg_probability || 0,
    win_rate_pct: winRate,
    by_stage: byStage
  };
}

export function searchDocuments({ query = '' } = {}) {
  const db = getDatabase();
  const like = `%${query}%`;
  const documents = db.prepare(`
    SELECT title, status, owner
    FROM documents
    WHERE title LIKE ? OR owner LIKE ?
    ORDER BY title
  `).all(like, like);

  const window = dateWindow();
  const incomplete = getOnboardingStatus({ start_after: window.start, start_before: window.end }).follow_up_needed;

  return { documents, incomplete_packets: incomplete };
}

export function queryMetric({ metric = 'fulfillment_cost', dimensions = [], period = 'current month', region: regionArg, compare = false, trend = false } = {}) {
  const db = getDatabase();
  const wantsAllRegions = compare || dimensions.includes('all_regions');
  const wantsTrend = trend || dimensions.includes('trend') || dimensions.includes('history');
  const region = regionArg || (dimensions.includes('region') ? 'West' : null);

  const format = value => `$${Number(value).toFixed(2)}/order`;
  const pctVsPlan = row => {
    const variance = ((row.value - row.plan_value) / row.plan_value) * 100;
    const sign = variance >= 0 ? '+' : '';
    return `${sign}${variance.toFixed(1)}% vs plan`;
  };

  if (wantsAllRegions) {
    const rows = db.prepare('SELECT * FROM metrics WHERE metric = ? AND period = ? ORDER BY value DESC').all(metric, period);
    if (!rows.length) return { metric, value: 'n/a', comparison: 'No data', drivers: [] };
    const highest = rows[0];
    return {
      metric,
      period,
      scope: 'all regions',
      value: format(highest.value),
      comparison: pctVsPlan(highest),
      region: highest.region,
      by_region: rows.map(row => ({ region: row.region, value: format(row.value), plan: format(row.plan_value), comparison: pctVsPlan(row), expedited_orders: row.expedited_orders })),
      drivers: [`${highest.expedited_orders} expedited orders in ${highest.region}`, 'carrier fuel surcharge']
    };
  }

  if (wantsTrend) {
    const targetRegion = region || 'West';
    const history = db.prepare(`
      SELECT period, value, plan_value, expedited_orders
      FROM metrics WHERE metric = ? AND region = ?
      ORDER BY CASE period WHEN 'two months ago' THEN 0 WHEN 'last month' THEN 1 WHEN 'current month' THEN 2 ELSE 3 END
    `).all(metric, targetRegion);
    if (!history.length) return { metric, value: 'n/a', comparison: 'No data', drivers: [] };
    const latest = history[history.length - 1];
    return {
      metric,
      period: 'trend (3 months)',
      scope: 'trend',
      region: targetRegion,
      value: format(latest.value),
      comparison: pctVsPlan(latest),
      trend: history.map(row => ({ period: row.period, value: format(row.value), plan: format(row.plan_value), comparison: pctVsPlan(row), expedited_orders: row.expedited_orders })),
      drivers: [`${latest.expedited_orders} expedited orders latest month`, 'carrier fuel surcharge']
    };
  }

  const row = region
    ? db.prepare('SELECT * FROM metrics WHERE metric = ? AND region = ? AND period = ?').get(metric, region, period)
    : db.prepare('SELECT * FROM metrics WHERE metric = ? AND period = ? LIMIT 1').get(metric, period);
  if (!row) return { metric, value: 'n/a', comparison: 'No data', drivers: [] };
  return {
    metric: row.metric,
    region: row.region,
    period: row.period,
    value: format(row.value),
    plan: format(row.plan_value),
    comparison: pctVsPlan(row),
    drivers: [`${row.expedited_orders} expedited orders`, 'carrier fuel surcharge']
  };
}

export function getMetricDefinition({ metric = 'fulfillment_cost' } = {}) {
  return {
    metric,
    owner: 'Finance',
    definition: 'Fulfillment expense divided by shipped orders; returns excluded.',
    version: 'v3'
  };
}

export function searchArticles({ query = '', audience, status } = {}) {
  const db = getDatabase();
  // Extract simple keywords: strip punctuation, drop short/stop words, keep meaningful tokens
  const stop = new Set(['the', 'and', 'for', 'with', 'a', 'an', 'to', 'of', 'is', 'are', 'was', 'were', 'be', 'this', 'that', 'what', 'who', 'when', 'where', 'why', 'how', 'our', 'we', 'you', 'i', 'my', 'me', 'us', 'in', 'on', 'at', 'by', 'do', 'does', 'did', 'has', 'have', 'had', 'it', 'its', 'as', 'or', 'not', 'about', 'from', 'over', 'under', 'previous', 'current', 'latest', 'version']);
  const tokens = String(query || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(word => word.length >= 3 && !stop.has(word));

  const orderClause = ' ORDER BY CASE status WHEN \'published\' THEN 0 WHEN \'archived\' THEN 1 ELSE 2 END, title';
  const fields = 'title, version, status, excerpt, owner, approved_at, audience';

  const buildFilter = (extra = '', extraParams = []) => {
    let sql = `SELECT ${fields} FROM articles WHERE 1=1 ${extra}`;
    const params = [...extraParams];
    if (audience) { sql += ' AND audience = ?'; params.push(audience); }
    if (status) { sql += ' AND status = ?'; params.push(status); }
    sql += orderClause;
    return db.prepare(sql).all(...params);
  };

  if (tokens.length) {
    const clauses = tokens.map(() => '(LOWER(title) LIKE ? OR LOWER(excerpt) LIKE ?)').join(' OR ');
    const params = tokens.flatMap(word => [`%${word}%`, `%${word}%`]);
    const results = buildFilter(`AND (${clauses})`, params);
    if (results.length) return { articles: results, matched_on: tokens };
  }
  // Fall back to all articles for the audience/status filters when no keyword hit
  const fallback = buildFilter();
  return { articles: fallback, matched_on: tokens, fallback: true };
}

export function getOpenOrders({ opportunity_id, account_id, region, status, include_closed = false } = {}) {
  const db = getDatabase();
  const activeStatuses = ['Open', 'In Fulfillment', 'On Hold'];
  const closedStatuses = ['Shipped', 'Delivered', 'Cancelled'];

  let sql = `
    SELECT o.id, o.order_number, o.status, o.amount, o.items, o.ordered_at, o.expected_ship_date, o.notes,
           opp.id AS opportunity_id, opp.name AS opportunity, opp.stage AS opportunity_stage,
           a.id AS account_id, a.name AS account, a.region
    FROM orders o
    LEFT JOIN opportunities opp ON opp.id = o.opportunity_id
    LEFT JOIN accounts a ON a.id = o.account_id
    WHERE 1 = 1
  `;
  const params = [];
  if (!include_closed && !status) {
    sql += ` AND o.status IN (${activeStatuses.map(() => '?').join(',')})`;
    params.push(...activeStatuses);
  }
  if (status) { sql += ' AND o.status = ?'; params.push(status); }
  if (opportunity_id) { sql += ' AND o.opportunity_id = ?'; params.push(opportunity_id); }
  if (account_id) { sql += ' AND o.account_id = ?'; params.push(account_id); }
  if (region) { sql += ' AND a.region = ?'; params.push(region); }
  sql += ' ORDER BY o.expected_ship_date';

  const records = db.prepare(sql).all(...params);
  const money = value => Math.round(Number(value) * 100) / 100;
  const totalValue = money(records.reduce((total, row) => total + row.amount, 0));
  const activeValue = money(records.filter(row => activeStatuses.includes(row.status)).reduce((total, row) => total + row.amount, 0));

  const byStatus = Object.fromEntries([...activeStatuses, ...closedStatuses].map(name => [name, 0]));
  records.forEach(row => { byStatus[row.status] = (byStatus[row.status] || 0) + 1; });

  const byAccount = {};
  records.forEach(row => {
    const key = row.account || 'Unknown';
    byAccount[key] = byAccount[key] || { account: key, region: row.region, orders: 0, value: 0 };
    byAccount[key].orders += 1;
    byAccount[key].value = money(byAccount[key].value + row.amount);
  });

  return {
    count: records.length,
    active_count: records.filter(row => activeStatuses.includes(row.status)).length,
    total_value: totalValue,
    active_value: activeValue,
    by_status: byStatus,
    by_account: Object.values(byAccount),
    records,
    note: 'Synthetic SQLite orders linked to opportunities. Active orders exclude Shipped, Delivered, and Cancelled unless include_closed is true.'
  };
}

export function resetDatabaseForTests() {
  if (database) {
    database.close();
    database = undefined;
  }
}

export function getQuarterlySales({ year = new Date().getUTCFullYear(), quarter = Math.floor(new Date().getUTCMonth() / 3) + 1 } = {}) {
  if (!Number.isInteger(year) || year < 2000 || year > 2100 || !Number.isInteger(quarter) || quarter < 1 || quarter > 4) {
    throw new Error('Provide a year from 2000 to 2100 and a quarter from 1 to 4.');
  }
  const start = new Date(Date.UTC(year, (quarter - 1) * 3, 1)).toISOString().slice(0, 10);
  const endExclusive = new Date(Date.UTC(year, quarter * 3, 1)).toISOString().slice(0, 10);
  const records = getDatabase().prepare(`SELECT o.id, o.name, a.name AS account, o.stage, o.amount, o.close_date, o.probability, o.owner
    FROM opportunities o JOIN accounts a ON a.id = o.account_id
    WHERE o.close_date >= ? AND o.close_date < ? ORDER BY o.close_date, o.id`).all(start, endExclusive);
  const sum = rows => Math.round(rows.reduce((total, row) => total + row.amount, 0) * 100) / 100;
  const won = records.filter(row => row.stage === 'Closed Won');
  const lost = records.filter(row => row.stage === 'Closed Lost');
  const open = records.filter(row => !['Closed Won', 'Closed Lost'].includes(row.stage));
  return { period: `Q${quarter} ${year}`, start, end_exclusive: endExclusive, currency: 'USD',
    closed_won: { count: won.length, value: sum(won), deals: won },
    open_pipeline: { count: open.length, value: sum(open), weighted_value: Math.round(open.reduce((total, row) => total + row.amount * row.probability / 100, 0) * 100) / 100, deals: open },
    closed_lost: { count: lost.length, value: sum(lost), deals: lost },
    note: 'Synthetic SQLite data. Calendar quarter based on close date. Closed-won deal value is booked sales, not recognized revenue. Open pipeline is not booked sales; weighted pipeline is an estimate, not a guarantee. Closed-lost deals are excluded from sales and pipeline.' };
}

function seedPipelineSamples(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS pipelines (
    id TEXT PRIMARY KEY, department TEXT NOT NULL, name TEXT NOT NULL, owner TEXT NOT NULL,
    schedule TEXT NOT NULL, timezone TEXT NOT NULL, next_run_at TEXT NOT NULL, snapshot_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS pipeline_runs (
    id TEXT PRIMARY KEY, pipeline_id TEXT NOT NULL REFERENCES pipelines(id), started_at TEXT NOT NULL,
    finished_at TEXT, duration_seconds INTEGER NOT NULL, status TEXT NOT NULL,
    rows_processed INTEGER NOT NULL, error TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_pipeline_runs_pipeline_started ON pipeline_runs(pipeline_id, started_at DESC);`);
  const insertPipeline = db.prepare('INSERT OR IGNORE INTO pipelines VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  const insertRun = db.prepare('INSERT INTO pipeline_runs VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  db.exec('BEGIN');
  try {
    for (const job of buildPipelineSample()) {
      const inserted = insertPipeline.run(job.id, job.department, job.name, job.owner, job.schedule, job.timezone, job.next_run_at, job.snapshot_at);
      if (inserted.changes) job.runs.forEach(run => insertRun.run(run.id, job.id, run.started_at, run.finished_at, run.duration_seconds, run.status, run.rows_processed, run.error));
    }
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}

export function getPipelineRuns({ department } = {}) {
  if (department !== undefined && !['Sales', 'HR', 'Planning'].includes(department)) throw new Error('Department must be Sales, HR, or Planning.');
  const db = getDatabase();
  const pipelines = (department ? db.prepare('SELECT * FROM pipelines WHERE department = ? ORDER BY name').all(department) : db.prepare("SELECT * FROM pipelines ORDER BY CASE department WHEN 'Sales' THEN 1 WHEN 'HR' THEN 2 ELSE 3 END, name").all()).map(job => {
    const runs = db.prepare('SELECT * FROM pipeline_runs WHERE pipeline_id = ? ORDER BY started_at DESC LIMIT 3').all(job.id);
    return { ...job, latest_run: runs[0] || null, recent_runs: runs };
  });
  const departments = Object.fromEntries(['Sales', 'HR', 'Planning'].map(name => [name, pipelines.filter(job => job.department === name).length]));
  const statuses = Object.fromEntries(['Succeeded', 'Failed', 'Running'].map(status => [status, pipelines.filter(job => job.latest_run?.status === status).length]));
  return { count: pipelines.length, departments, statuses, pipelines,
    note: 'Synthetic SQLite snapshot, not live monitoring. All times UTC. Running durations are elapsed as of the snapshot. Next runs are scheduled times at the snapshot; no jobs are executed by this demo.' };
}
