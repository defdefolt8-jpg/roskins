import { authClient, authConfig } from '../lib/auth';
import { getChatGPTUser } from './chatgpt-auth';

export async function getMarketUser() {
  if (authConfig()) {
    const client = await authClient();
    // getUser verifies the token with the auth server; cookie contents are untrusted.
    const { data: { user }, error } = await client.auth.getUser();
    if (!error && user?.email && user.email_confirmed_at) {
      return { userId: 'supabase:' + user.id, email: user.email, displayName: user.email, fullName: null,
        authProvider: user.app_metadata.provider === 'google' ? 'google' : 'email' };
    }
  }
  const platformUser = await getChatGPTUser();
  return platformUser ? { ...platformUser, authProvider: 'chatgpt' } : null;
}
