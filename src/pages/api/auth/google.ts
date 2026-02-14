import type { APIRoute } from 'astro';
import { createAstroServerClient } from '../../../lib/supabase-server';
import { validateRedirect } from '../../../lib/auth/validate-redirect';
import { PaymentLogger } from '../../../lib/payment/logger';

export const POST: APIRoute = async ({ request, url }) => {
  const { supabase, response } = createAstroServerClient(request);
  const ip = request.headers.get('x-real-ip')
    ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? 'unknown';

  let rawRedirect: string | undefined;
  try {
    const body = await request.json();
    rawRedirect = body.redirectTo;
  } catch {
    // invalid JSON — use default
  }
  const redirectTo = validateRedirect(rawRedirect);

  PaymentLogger.info('OAUTH_GOOGLE_INITIATED', { ip, redirect: redirectTo });

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
    PaymentLogger.error('OAUTH_GOOGLE_FAILED', error ?? new Error('No redirect URL returned'), {
      ip,
      error_code: error?.status,
      error_message: error?.message,
      redirect: redirectTo,
      callback_url: callbackUrl.toString(),
    });
    const errHeaders = new Headers(response.headers);
    errHeaders.set('Content-Type', 'application/json');
    return new Response(JSON.stringify({
      success: false,
      error: { code: 'OAUTH_ERROR', message: 'Google 로그인을 시작할 수 없습니다.' },
    }), { status: 500, headers: errHeaders });
  }

  PaymentLogger.info('OAUTH_GOOGLE_REDIRECT', { ip, oauth_url: data.url });

  // PKCE code_verifier 쿠키를 응답에 포함
  const resHeaders = new Headers(response.headers);
  resHeaders.set('Content-Type', 'application/json');
  return new Response(JSON.stringify({
    success: true,
    data: { url: data.url },
  }), { status: 200, headers: resHeaders });
};
