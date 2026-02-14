/**
 * 결제 시스템 전용 로거
 *
 * 로그 저장 계층:
 * 1. DB (system_logs 테이블): 영구 저장 - 서버 재시작해도 유지
 * 2. 인메모리 캐시: 빠른 조회용 (최근 1000건)
 * 3. Console: 개발/디버깅용
 *
 * 핵심 기능:
 * - request_id로 요청 단위 추적 (같은 API 호출의 모든 로그 묶어보기)
 * - duration_ms로 성능 추적 (PG 호출, API 응답 시간)
 * - 민감정보 자동 마스킹 (카드번호, CVV, 비밀번호)
 * - DB 저장 실패해도 서비스 영향 없음 (fire-and-forget)
 */
import { LOG_LEVEL, type LogLevel, type SystemLog } from './types';

// ─── 민감 정보 마스킹 ────────────────────────────
const SENSITIVE_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  // 카드번호 (16자리)
  { pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, replacement: '****-****-****-****' },
  { pattern: /\b\d{3,4}\b(?=.*cvv)/gi, replacement: '***' },
  // JSON 키 기반 마스킹
  { pattern: /"card_number"\s*:\s*"[^"]+"/g, replacement: '"card_number":"[MASKED]"' },
  { pattern: /"cardNumber"\s*:\s*"[^"]+"/g, replacement: '"cardNumber":"[MASKED]"' },
  { pattern: /"cvv"\s*:\s*"[^"]+"/g, replacement: '"cvv":"[MASKED]"' },
  { pattern: /"cvc"\s*:\s*"[^"]+"/g, replacement: '"cvc":"[MASKED]"' },
  { pattern: /"password"\s*:\s*"[^"]+"/g, replacement: '"password":"[MASKED]"' },
  { pattern: /"secret"\s*:\s*"[^"]+"/g, replacement: '"secret":"[MASKED]"' },
  { pattern: /"secretKey"\s*:\s*"[^"]+"/g, replacement: '"secretKey":"[MASKED]"' },
  { pattern: /"token"\s*:\s*"[^"]+"/g, replacement: '"token":"[MASKED]"' },
  { pattern: /"authorization"\s*:\s*"[^"]+"/gi, replacement: '"authorization":"[MASKED]"' },
  // 계좌번호 (10~14자리 숫자)
  { pattern: /"accountNumber"\s*:\s*"[^"]+"/g, replacement: '"accountNumber":"[MASKED]"' },
  { pattern: /"account_number"\s*:\s*"[^"]+"/g, replacement: '"account_number":"[MASKED]"' },
  // 전화번호
  { pattern: /"customer_phone"\s*:\s*"[^"]+"/g, replacement: '"customer_phone":"[MASKED]"' },
  // 토스 Secret Key 패턴 (test_sk_ 또는 live_sk_)
  { pattern: /\b(test_sk_|live_sk_)[A-Za-z0-9]+\b/g, replacement: '[MASKED_SECRET_KEY]' },
  // Basic Auth 헤더
  { pattern: /Basic\s+[A-Za-z0-9+/=]+/g, replacement: 'Basic [MASKED]' },
];

function maskSensitiveData(data: string): string {
  let masked = data;
  for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
    pattern.lastIndex = 0;
    masked = masked.replace(pattern, replacement);
  }
  return masked;
}

// ─── 콘솔 포맷팅 ─────────────────────────────────
function formatLogForConsole(log: SystemLog): string {
  const prefix: Record<LogLevel, string> = {
    INFO: '[INFO]',
    WARN: '[WARN]',
    ERROR: '[ERROR]',
    CRITICAL: '[CRITICAL]',
  };

  const parts = [
    `${prefix[log.level]} [PAYMENT]`,
    log.timestamp,
    log.action,
  ];

  if (log.request_id) parts.push(`req=${log.request_id.slice(0, 8)}`);
  if (log.payment_id) parts.push(`payment=${log.payment_id.slice(0, 8)}`);
  if (log.order_id) parts.push(`order=${log.order_id.slice(0, 8)}`);
  if (log.duration_ms != null) parts.push(`${log.duration_ms}ms`);
  if (log.error) parts.push(`error=${log.error}`);

  return parts.join(' | ');
}

// ─── DB 영구 저장 ─────────────────────────────────
let dbSaveEnabled = true;
let dbSaveQueue: SystemLog[] = [];
let dbFlushTimer: ReturnType<typeof setTimeout> | null = null;

async function flushLogsToDB(): Promise<void> {
  if (dbSaveQueue.length === 0) return;

  const batch = dbSaveQueue.splice(0, dbSaveQueue.length);

  try {
    // 동적 import로 순환 의존성 방지
    const { createAdminClient } = await import('../supabase');
    const supabase = createAdminClient();

    const rows = batch.map((log) => ({
      timestamp: log.timestamp,
      level: log.level,
      action: log.action,
      payment_id: log.payment_id ?? null,
      order_id: log.order_id ?? null,
      request_id: log.request_id ?? null,
      details: log.details,
      error_message: log.error ?? null,
      error_stack: log.stack ?? null,
      duration_ms: log.duration_ms ?? null,
      actor_ip: log.actor_ip ?? null,
      http_method: log.http_method ?? null,
      http_path: log.http_path ?? null,
      http_status: log.http_status ?? null,
    }));

    const { error } = await supabase.from('system_logs').insert(rows);

    if (error) {
      // DB 저장 실패해도 서비스에 영향 없음 - 콘솔에만 경고
      console.warn('[PAYMENT_LOGGER] DB save failed:', error.message);
      // 연속 실패 시 DB 저장 일시 중단 (서버 재시작까지)
      if (error.message.includes('does not exist')) {
        dbSaveEnabled = false;
        console.warn('[PAYMENT_LOGGER] system_logs table not found, DB logging disabled');
      }
    }
  } catch (err) {
    console.warn('[PAYMENT_LOGGER] DB flush error:', err instanceof Error ? err.message : err);
  }
}

function scheduleFlush(): void {
  if (dbFlushTimer) return;
  // 500ms 디바운스로 배치 저장 (성능 최적화)
  dbFlushTimer = setTimeout(() => {
    dbFlushTimer = null;
    flushLogsToDB();
  }, 500);
}

// ─── 요청 컨텍스트 ────────────────────────────────
interface LogContext {
  payment_id?: string;
  order_id?: string;
  request_id?: string;
  error?: Error;
  duration_ms?: number;
  actor_ip?: string;
  http_method?: string;
  http_path?: string;
  http_status?: number;
}

// ─── PaymentLogger ────────────────────────────────
export class PaymentLogger {
  private static logs: SystemLog[] = [];
  private static maxInMemoryLogs = 1000;

  // 현재 요청의 request_id (API 핸들러에서 설정)
  private static _currentRequestId: string | undefined;

  /**
   * 요청 단위 추적을 위한 request_id 설정
   * API 핸들러 진입 시 호출
   */
  static setRequestId(requestId: string): void {
    PaymentLogger._currentRequestId = requestId;
  }

  static getRequestId(): string | undefined {
    return PaymentLogger._currentRequestId;
  }

  static clearRequestId(): void {
    PaymentLogger._currentRequestId = undefined;
  }

  /**
   * 로그 기록 (메모리 + DB + 콘솔)
   */
  static log(
    level: LogLevel,
    action: string,
    details: Record<string, unknown> = {},
    context?: LogContext,
  ): SystemLog {
    const entry: SystemLog = {
      timestamp: new Date().toISOString(),
      level,
      action,
      payment_id: context?.payment_id,
      order_id: context?.order_id,
      request_id: context?.request_id ?? PaymentLogger._currentRequestId,
      details: JSON.parse(maskSensitiveData(JSON.stringify(details))),
      error: context?.error?.message,
      stack: context?.error?.stack,
      duration_ms: context?.duration_ms,
      actor_ip: context?.actor_ip,
      http_method: context?.http_method,
      http_path: context?.http_path,
      http_status: context?.http_status,
    };

    // 1. 인메모리 캐시 (빠른 조회용)
    PaymentLogger.logs.push(entry);
    while (PaymentLogger.logs.length > PaymentLogger.maxInMemoryLogs) {
      PaymentLogger.logs.shift();
    }

    // 2. DB 영구 저장 (fire-and-forget, 배치)
    if (dbSaveEnabled) {
      dbSaveQueue.push(entry);
      scheduleFlush();
    }

    // 3. 콘솔 출력
    const formatted = formatLogForConsole(entry);
    switch (level) {
      case LOG_LEVEL.INFO:
        console.log(formatted);
        break;
      case LOG_LEVEL.WARN:
        console.warn(formatted);
        break;
      case LOG_LEVEL.ERROR:
        console.error(formatted);
        if (entry.stack) console.error(entry.stack);
        break;
      case LOG_LEVEL.CRITICAL:
        console.error(`🚨 ${formatted}`);
        if (entry.stack) console.error(entry.stack);
        break;
    }

    return entry;
  }

  // ─── 편의 메서드 ─────────────────────────────
  static info(action: string, details?: Record<string, unknown>, ctx?: { payment_id?: string; order_id?: string }) {
    return PaymentLogger.log(LOG_LEVEL.INFO, action, details, ctx);
  }

  static warn(action: string, details?: Record<string, unknown>, ctx?: { payment_id?: string; order_id?: string }) {
    return PaymentLogger.log(LOG_LEVEL.WARN, action, details, ctx);
  }

  static error(action: string, error: Error, details?: Record<string, unknown>, ctx?: { payment_id?: string; order_id?: string }) {
    return PaymentLogger.log(LOG_LEVEL.ERROR, action, details, { ...ctx, error });
  }

  static critical(action: string, error: Error, details?: Record<string, unknown>, ctx?: { payment_id?: string; order_id?: string }) {
    return PaymentLogger.log(LOG_LEVEL.CRITICAL, action, details, { ...ctx, error });
  }

  // ─── API 미들웨어용 ─────────────────────────
  /**
   * API 요청 시작 로그
   * 반환값: 완료 시 호출할 함수 (소요시간 자동 계산)
   */
  static apiRequest(request: Request, path: string): () => void {
    const requestId = crypto.randomUUID();
    const startTime = performance.now();

    PaymentLogger.setRequestId(requestId);

    PaymentLogger.log(LOG_LEVEL.INFO, 'API_REQUEST', {
      method: request.method,
      path,
      user_agent: request.headers.get('user-agent')?.slice(0, 100),
    }, {
      request_id: requestId,
      actor_ip: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? undefined,
      http_method: request.method,
      http_path: path,
    });

    // 완료 함수 반환
    return () => {
      PaymentLogger.clearRequestId();
    };
  }

  /**
   * API 응답 로그 (소요시간 포함)
   */
  static apiResponse(status: number, startTime: number, details?: Record<string, unknown>): void {
    PaymentLogger.log(
      status >= 500 ? LOG_LEVEL.ERROR : status >= 400 ? LOG_LEVEL.WARN : LOG_LEVEL.INFO,
      'API_RESPONSE',
      { status, ...details },
      {
        http_status: status,
        duration_ms: Math.round(performance.now() - startTime),
      }
    );
  }

  /**
   * PG 호출 타이밍 측정 래퍼
   */
  static async measurePgCall<T>(
    action: string,
    pgCall: () => Promise<T>,
    ctx?: { payment_id?: string; order_id?: string }
  ): Promise<T> {
    const start = performance.now();
    PaymentLogger.info(`${action}_START`, {}, ctx);

    try {
      const result = await pgCall();
      const duration = Math.round(performance.now() - start);
      PaymentLogger.log(LOG_LEVEL.INFO, `${action}_COMPLETE`, { duration_ms: duration }, { ...ctx, duration_ms: duration });
      return result;
    } catch (err) {
      const duration = Math.round(performance.now() - start);
      const error = err instanceof Error ? err : new Error(String(err));
      PaymentLogger.log(LOG_LEVEL.ERROR, `${action}_ERROR`, { duration_ms: duration }, { ...ctx, error, duration_ms: duration });
      throw err;
    }
  }

  // ─── 조회 메서드 (관리자 화면용) ─────────────
  /**
   * 전체 로그 조회 (인메모리 + DB 폴백)
   */
  static getAllLogs(filters?: {
    level?: LogLevel;
    payment_id?: string;
    order_id?: string;
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
    search?: string;
  }): { logs: SystemLog[]; total: number } {
    let filtered = [...PaymentLogger.logs];

    if (filters?.level) {
      filtered = filtered.filter((l) => l.level === filters.level);
    }
    if (filters?.payment_id) {
      filtered = filtered.filter((l) => l.payment_id === filters.payment_id);
    }
    if (filters?.order_id) {
      filtered = filtered.filter((l) => l.order_id === filters.order_id);
    }
    if (filters?.from) {
      filtered = filtered.filter((l) => l.timestamp >= filters.from!);
    }
    if (filters?.to) {
      filtered = filtered.filter((l) => l.timestamp <= filters.to!);
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      filtered = filtered.filter((l) =>
        l.action.toLowerCase().includes(q) ||
        l.error?.toLowerCase().includes(q) ||
        l.payment_id?.includes(q) ||
        l.order_id?.includes(q) ||
        l.request_id?.includes(q)
      );
    }

    filtered.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    const total = filtered.length;
    const offset = filters?.offset ?? 0;
    const limit = filters?.limit ?? 50;

    return {
      logs: filtered.slice(offset, offset + limit),
      total,
    };
  }

  /**
   * DB에서 전체 로그 조회 (인메모리에 없는 과거 로그 포함)
   */
  static async getLogsFromDB(filters?: {
    level?: LogLevel;
    payment_id?: string;
    order_id?: string;
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
    search?: string;
  }): Promise<{ logs: SystemLog[]; total: number }> {
    try {
      const { createAdminClient } = await import('../supabase');
      const supabase = createAdminClient();

      let query = supabase
        .from('system_logs')
        .select('*', { count: 'exact' })
        .order('timestamp', { ascending: false });

      if (filters?.level) query = query.eq('level', filters.level);
      if (filters?.payment_id) query = query.eq('payment_id', filters.payment_id);
      if (filters?.order_id) query = query.eq('order_id', filters.order_id);
      if (filters?.from) query = query.gte('timestamp', filters.from);
      if (filters?.to) query = query.lte('timestamp', filters.to);
      if (filters?.search) {
        query = query.or(`action.ilike.%${filters.search}%,error_message.ilike.%${filters.search}%`);
      }

      const limit = filters?.limit ?? 50;
      const offset = filters?.offset ?? 0;
      query = query.range(offset, offset + limit - 1);

      const { data, count, error } = await query;

      if (error) {
        console.warn('[PAYMENT_LOGGER] DB query failed:', error.message);
        return PaymentLogger.getAllLogs(filters);
      }

      const logs: SystemLog[] = (data ?? []).map((row: Record<string, unknown>) => ({
        timestamp: row.timestamp as string,
        level: row.level as LogLevel,
        action: row.action as string,
        payment_id: row.payment_id as string | undefined,
        order_id: row.order_id as string | undefined,
        request_id: row.request_id as string | undefined,
        details: (row.details ?? {}) as Record<string, unknown>,
        error: row.error_message as string | undefined,
        stack: row.error_stack as string | undefined,
        duration_ms: row.duration_ms as number | undefined,
        actor_ip: row.actor_ip as string | undefined,
        http_method: row.http_method as string | undefined,
        http_path: row.http_path as string | undefined,
        http_status: row.http_status as number | undefined,
      }));

      return { logs, total: count ?? 0 };
    } catch {
      return PaymentLogger.getAllLogs(filters);
    }
  }

  /**
   * 특정 결제의 전체 로그 타임라인
   */
  static getPaymentTimeline(paymentId: string): SystemLog[] {
    return PaymentLogger.logs
      .filter((l) => l.payment_id === paymentId)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  /**
   * 에러/크리티컬 로그만 조회
   */
  static getErrorLogs(limit = 50): SystemLog[] {
    return PaymentLogger.logs
      .filter((l) => l.level === LOG_LEVEL.ERROR || l.level === LOG_LEVEL.CRITICAL)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, limit);
  }

  /**
   * 로그 통계 (대시보드용)
   */
  static getStats(): {
    total: number;
    by_level: Record<LogLevel, number>;
    recent_errors: number;
    avg_api_duration_ms: number;
    pg_call_count: number;
  } {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    const by_level = {
      INFO: 0,
      WARN: 0,
      ERROR: 0,
      CRITICAL: 0,
    } as Record<LogLevel, number>;

    let recent_errors = 0;
    let apiDurationTotal = 0;
    let apiDurationCount = 0;
    let pgCallCount = 0;

    for (const log of PaymentLogger.logs) {
      by_level[log.level]++;

      if (
        (log.level === LOG_LEVEL.ERROR || log.level === LOG_LEVEL.CRITICAL) &&
        new Date(log.timestamp).getTime() > oneHourAgo
      ) {
        recent_errors++;
      }

      if (log.action === 'API_RESPONSE' && log.duration_ms != null) {
        apiDurationTotal += log.duration_ms;
        apiDurationCount++;
      }

      if (log.action.startsWith('PG_CALL_')) {
        pgCallCount++;
      }
    }

    return {
      total: PaymentLogger.logs.length,
      by_level,
      recent_errors,
      avg_api_duration_ms: apiDurationCount > 0 ? Math.round(apiDurationTotal / apiDurationCount) : 0,
      pg_call_count: pgCallCount,
    };
  }

  /**
   * 로그 초기화 (테스트용)
   */
  static clear(): void {
    PaymentLogger.logs = [];
  }
}
