import type { APIRoute } from 'astro';
import { createAstroServerClient } from '../../../lib/supabase-server';

export const POST: APIRoute = async ({ request, url }) => {
  const { supabase } = createAstroServerClient(request);

  let redirectTo: string;
  try {
    const body = await request.json();
    redirectTo = body.redirectTo ?? '/shop';
  } catch {
    redirectTo = '/shop';
  }

  const callbackUrl = new URL('/auth/callback', url.origin);
  callbackUrl.searchParams.set('next', redirectTo);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: callbackUrl.toString(),
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });

  if (error || !data.url) {
    return new Response(JSON.stringify({
      success: false,
      error: { code: 'OAUTH_ERROR', message: 'Google 로그인을 시작할 수 없습니다.' },
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  return new Response(JSON.stringify({
    success: true,
    data: { url: data.url },
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
