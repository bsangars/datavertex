import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSeed } from '../../data/seed.js';
import { quarterlySales } from '../../data/quarterly-sales.mjs';
import { buildPipelineSample } from '../../data/pipeline-sample.mjs';

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
  return database;
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
      excerpt TEXT
    );
  `);
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
  const insertArticle = db.prepare('INSERT INTO articles (title, version, status, excerpt) VALUES (?, ?, ?, ?)');

  const seedAll = () => {
    seed.workers.forEach(row => insertWorker.run(row.id, row.name, row.department, row.manager, row.start_date, row.status, row.location));
    seed.onboardingTasks.forEach(row => insertTask.run(row.id, row.worker_id, row.task_name, row.status));
    seed.accounts.forEach(row => insertAccount.run(row.id, row.name, row.industry, row.region, row.owner));
    seed.opportunities.forEach(row => insertOpportunity.run(row.id, row.account_id, row.name, row.stage, row.amount, row.close_date, row.owner, row.probability));
    seed.documents.forEach(row => insertDocument.run(row.id, row.title, row.status, row.owner));
    seed.metrics.forEach(row => insertMetric.run(row.metric, row.region, row.value, row.plan_value, row.period, row.expedited_orders));
    seed.articles.forEach(row => insertArticle.run(row.title, row.version, row.status, row.excerpt));
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

  return {
    starters: starters.length,
    follow_up_needed: followUp,
    pending_tasks: pendingCount,
    common_gaps: pendingTasks.slice(0, 3).map(row => row.task_name)
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

export function queryMetric({ metric = 'fulfillment_cost', dimensions = [], period = 'current month' } = {}) {
  const db = getDatabase();
  const region = dimensions.includes('region') ? 'West' : null;
  const row = region
    ? db.prepare('SELECT * FROM metrics WHERE metric = ? AND region = ? AND period = ?').get(metric, region, period)
    : db.prepare('SELECT * FROM metrics WHERE metric = ? AND period = ? LIMIT 1').get(metric, period);

  if (!row) {
    return { metric, value: 'n/a', comparison: 'No data', drivers: [] };
  }

  const variance = ((row.value - row.plan_value) / row.plan_value) * 100;
  const sign = variance >= 0 ? '+' : '';
  return {
    metric: row.metric,
    region: row.region,
    value: `$${row.value.toFixed(2)}/order`,
    comparison: `${sign}${variance.toFixed(1)}% vs plan`,
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

export function searchArticles({ query = '' } = {}) {
  const db = getDatabase();
  const like = `%${query}%`;
  const articles = db.prepare(`
    SELECT title, version, status, excerpt
    FROM articles
    WHERE title LIKE ? OR excerpt LIKE ?
    ORDER BY title
  `).all(like, like);

  return { articles };
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
