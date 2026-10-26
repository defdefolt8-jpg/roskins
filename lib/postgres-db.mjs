import pg from 'pg';
pg.types.setTypeParser(20, value => { const number = Number(value); if (!Number.isSafeInteger(number)) throw new Error('Unsafe integer in database'); return number; });

// Translate only the small prepared-statement dialect used by Roskins.
// All values still travel as bound PostgreSQL parameters, never SQL fragments.
export function postgresSQL(sql) {
  const ignore = /^\s*INSERT OR IGNORE\b/i.test(sql);
  sql = sql.replace(/^\s*INSERT OR IGNORE\b/i, 'INSERT');
  sql = sql.replace(/\bSET count=count\+1\b/g, 'SET count=roskins_auth_limits.count+1');
  let quoted = false, index = 0, out = '';
  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    if (char === "'") {
      out += char;
      if (quoted && sql[i + 1] === "'") { out += sql[++i]; continue; }
      quoted = !quoted; continue;
    }
    out += char === '?' && !quoted ? '$' + (++index) : char;
  }
  out = out.replace(/(\$\d+)\s+IS NULL\b/gi, '$1::text IS NULL');
  if (ignore) out = out.replace(/;?\s*$/, ' ON CONFLICT DO NOTHING');
  return out;
}

export class PostgresDatabase {
  constructor(pool) { this.pool = pool; }
  prepare(sql) { return new Statement(this, sql, []); }
  async execute(sql, values) {
    if (/^\s*SELECT\b/i.test(sql)) return this.pool.query(postgresSQL(sql), values);
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      // SQLite previously serialized writers. Keep that guarantee across processes:
      // count limits, competing acceptance and recovery rotations remain atomic.
      await client.query('SELECT pg_advisory_xact_lock(741269031)');
      const result = await client.query(postgresSQL(sql), values);
      await client.query('COMMIT'); return result;
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
  async batch(statements) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN'); await client.query('SELECT pg_advisory_xact_lock(741269031)');
      const results = [];
      for (const statement of statements) {
        if (statement.db !== this) throw new Error('Foreign statement');
        const result = await client.query(postgresSQL(statement.sql), statement.values);
        results.push({ meta: { changes: result.rowCount || 0 }, results: result.rows });
      }
      await client.query('COMMIT'); return results;
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
}
class Statement {
  constructor(db, sql, values) { this.db = db; this.sql = sql; this.values = values; }
  bind(...values) { return new Statement(this.db, this.sql, values); }
  async first() { return (await this.db.execute(this.sql, this.values)).rows[0] || null; }
  async all() { return { results: (await this.db.execute(this.sql, this.values)).rows }; }
  async run() { const result = await this.db.execute(this.sql, this.values); return { meta: { changes: result.rowCount || 0 } }; }
}
let database;
export function getDatabase() {
  if (!process.env.DATABASE_URL) return undefined;
  if (!database) {
    const connection = new URL(process.env.DATABASE_URL);
    if (!['postgres:', 'postgresql:'].includes(connection.protocol)) throw new Error('Unsupported database connection');
    // Do not turn off TLS verification or emit the connection string into logs.
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 4, idleTimeoutMillis: 10000, connectionTimeoutMillis: 10000, statement_timeout: 10000, application_name: 'roskins-plaza' });
    pool.on('error', () => console.error('roskins_database_pool_error'));
    database = new PostgresDatabase(pool);
  }
  return database;
}
