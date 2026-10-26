import { getDatabase } from './postgres-db.mjs';
export interface Statement {
  bind(...values: unknown[]): Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<{ meta: { changes: number } }>;
}
export interface Database {
  prepare(sql: string): Statement;
  batch(statements: Statement[]): Promise<{ meta: { changes: number } }[]>;
}
export const env = {
  get DB() { return getDatabase() as Database | undefined; },
  get ROSKINS_VAPID_PUBLIC_KEY() { return process.env.ROSKINS_VAPID_PUBLIC_KEY; },
  get ROSKINS_VAPID_PRIVATE_JWK() { return process.env.ROSKINS_VAPID_PRIVATE_JWK; },
};
export function requestURL(request: Request) {
  const url = new URL(request.url);
  if (!process.env.PUBLIC_ORIGIN) return url;
  const canonical = new URL(process.env.PUBLIC_ORIGIN);
  if (canonical.protocol !== 'https:' || canonical.pathname !== '/' || canonical.search || canonical.hash || canonical.username || canonical.password) throw new Error('Invalid public origin');
  // The configured hostname is trusted, not caller-supplied forwarded headers.
  return new URL(url.pathname + url.search, canonical.origin);
}
