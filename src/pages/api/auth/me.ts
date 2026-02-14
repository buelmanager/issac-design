import type { APIRoute } from 'astro';
import { createAstroServerClient } from '../../../lib/supabase-server';

export const GET: APIRoute = async ({ request }) => {
  const { supabase } = createAstroServerClient(request);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new Response(JSON.stringify({ authenticated: false }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const profileResult = await supabase
    .from('profiles')
    .select('display_name, avatar_url, provider')
    .eq('id' as never, user.id)
    .limit(1);

  const profile = (profileResult.data as Array<{ display_name?: string; avatar_url?: string; provider?: string }> | null)?.[0];

  return new Response(JSON.stringify({
    authenticated: true,
    user: {
      id: user.id,
      email: user.email,
      displayName: profile?.display_name ?? user.email?.split('@')[0],
      avatarUrl: profile?.avatar_url ?? null,
      provider: profile?.provider ?? 'email',
    },
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-cache' },
  });
};
