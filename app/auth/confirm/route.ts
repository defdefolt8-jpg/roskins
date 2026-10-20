import { authClient, authConfig, authRedirect } from '../../../lib/auth';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const url = new URL(request.url), config = authConfig(), token_hash = url.searchParams.get('token_hash'), type = url.searchParams.get('type');
  if (!config || url.origin !== config.origin || !token_hash || !['email', 'recovery'].includes(type || '')) return authRedirect('/?auth=error');
  try {
    const client = await authClient();
    const { error } = await client.auth.verifyOtp({ token_hash, type: type as 'email' | 'recovery' });
    return authRedirect(error ? '/?auth=error' : type === 'recovery' ? '/?auth=recovery' : '/?auth=success');
  } catch { return authRedirect('/?auth=error'); }
}
