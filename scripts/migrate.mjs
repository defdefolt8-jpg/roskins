import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import pg from 'pg';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
// Operator command, never invoked during an HTTP request or module import.
export async function migrate(client) {
  await client.query('BEGIN');
  try {
    await client.query('SELECT pg_advisory_xact_lock(741269031)');
    await client.query('CREATE TABLE IF NOT EXISTS roskins_schema_migrations (name text PRIMARY KEY, hash text NOT NULL, applied_at bigint NOT NULL)');
    for (const name of (await readdir(new URL('../migrations/', import.meta.url))).filter(x => x.endsWith('.sql')).sort()) {
      const source = await readFile(new URL('../migrations/'+name, import.meta.url),'utf8');
      const hash = createHash('sha256').update(source).digest('hex');
      const existing = (await client.query('SELECT hash FROM roskins_schema_migrations WHERE name=$1',[name])).rows[0];
      if (existing) { if (existing.hash !== hash) throw new Error('Applied migration changed'); continue; }
      await client.query(source);
      await client.query('INSERT INTO roskins_schema_migrations VALUES ($1,$2,$3)',[name,hash,Date.now()]);
    }
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const client=new pg.Client({connectionString:process.env.DATABASE_URL});
  try { await client.connect(); await migrate(client); console.log('Schema migrations applied.'); }
  catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'UNKNOWN';
    const message = error instanceof Error ? error.message.replace(/postgres(?:ql)?:\/\/[^\s]+/gi, 'postgresql://[redacted]') : 'unknown database error';
    console.error(`Migration failed (${code}): ${message}`);
    process.exitCode=1;
  }
  finally { await client.end(); }
}
