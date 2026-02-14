/**
 * Supabase 브라우저 클라이언트 (쿠키 기반)
 *
 * React 컴포넌트에서 사용하는 클라이언트.
 * createBrowserClient는 쿠키에서 세션을 읽고 쓴다.
 * localStorage 대신 쿠키를 사용하여 XSS 공격 시 세션 탈취 방지.
 */
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '../types/database';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string;

/**
 * 싱글턴 브라우저 클라이언트
 * 한 번만 생성하고 전체 SPA에서 재사용.
 */
export const supabaseBrowser = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
