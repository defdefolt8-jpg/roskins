import { authClient, authConfig, authRedirect } from '../../../lib/auth';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const url = new URL(request.url), config = authConfig();
  if (!config || url.origin !== config.origin || !url.searchParams.get('code') || url.searchParams.has('error')) return authRedirect('/?auth=error');
  try {
    const client = await authClient();
    const { error } = await client.auth.exchangeCodeForSession(url.searchParams.get('code')!);
    return authRedirect(error ? '/?auth=error' : '/?auth=success');
  } catch { return authRedirect('/?auth=error'); }
}
