// External hosts must never trust arbitrary oai-authenticated-* request headers.
export type ChatGPTUser = { userId: string; displayName: string; email: string; fullName: string | null };
export async function getChatGPTUser(): Promise<ChatGPTUser | null> { return null; }
