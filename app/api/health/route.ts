export const dynamic = 'force-dynamic';
export async function GET() {
  // Health checks must not wake the PostgreSQL server or create profiles.
  return Response.json({ ok: true, service: 'roskins' }, { headers: { 'Cache-Control': 'no-store' } });
}
