// Retired paid storefront. Source and data are retained; no transactions are accepted.
export const dynamic = 'force-dynamic';
function closed() { return Response.json({ error: 'Старый магазин закрыт. Используй трейд-плазу Roskins.', plaza: '/' }, { status: 410, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } }); }
export async function GET(_request: Request) { return closed(); }
export async function POST(_request: Request) { return closed(); }
