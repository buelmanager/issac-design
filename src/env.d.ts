/// <reference path="../.astro/types.d.ts" />

declare namespace App {
  interface Locals {
    /** 인증된 사용자 (미들웨어에서 설정) */
    user: import('@supabase/supabase-js').User | null;
    /** Supabase 서버 클라이언트의 응답 헤더 (Set-Cookie) */
    responseHeaders: Headers;
  }
}
