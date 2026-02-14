/**
 * 결제 시스템 전용 로거
 *
 * 요구사항:
 * 1. 파일 로그 + 전체 로그 조회 가능
 * 2. 오류 발생 시 정확한 위치 추적
 * 3. 관리자 화면에서 모든 상태 확인
 * 4. 카드번호, CVV 등 민감정보 절대 기록 금지
 *
 * 로그 저장:
 * - DB: payment_status_logs (상태 변경 이력)
 * - DB: system_logs (시스템 이벤트 전체)
 * - Console: 개발/디버깅용
 */
import { LOG_LEVEL, type LogLevel, type SystemLog } from './types';

// 민감 정보 마스킹 패턴
const SENSITIVE_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, replacement: '****-****-****-****' },
  { pattern: /\b\d{3,4}\b(?=.*cvv)/gi, replacement: '***' },
  { pattern: /"card_number"\s*:\s*"[^"]+"/g, replacement: '"card_number":"[MASKED]"' },
  { pattern: /"cvv"\s*:\s*"[^"]+"/g, replacement: '"cvv":"[MASKED]"' },
  { pattern: /"password"\s*:\s*"[^"]+"/g, replacement: '"password":"[MASKED]"' },
  { pattern: /"secret"\s*:\s*"[^"]+"/g, replacement: '"secret":"[MASKED]"' },
];

function maskSensitiveData(data: string): string {
  let masked = data;
  for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
    pattern.lastIndex = 0; // 글로벌 플래그 사용 시 lastIndex 리셋
    masked = masked.replace(pattern, replacement);
  }
  return masked;
}

function formatLogForConsole(log: SystemLog): string {
  const emoji: Record<LogLevel, string> = {
    INFO: '[INFO]',
    WARN: '[WARN]',
    ERROR: '[ERROR]',
    CRITICAL: '[CRITICAL]',
  };

  const parts = [
    `${emoji[log.level]} [PAYMENT]`,
    log.timestamp,
    log.action,
  ];

  if (log.payment_id) parts.push(`payment=${log.payment_id}`);
  if (log.order_id) parts.push(`order=${log.order_id}`);
  if (log.error) parts.push(`error=${log.error}`);

  return parts.join(' | ');
}

export class PaymentLogger {
  private static logs: SystemLog[] = [];
  private static maxInMemoryLogs = 1000;

  /**
   * 로그 기록
   */
  static log(
    level: LogLevel,
    action: string,
    details: Record<string, unknown> = {},
    context?: { payment_id?: string; order_id?: string; error?: Error }
  ): SystemLog {
    const entry: SystemLog = {
      timestamp: new Date().toISOString(),
      level,
      action,
      payment_id: context?.payment_id,
      order_id: context?.order_id,
      details: JSON.parse(maskSensitiveData(JSON.stringify(details))),
      error: context?.error?.message,
      stack: context?.error?.stack,
    };

    // 메모리 로그 (관리자 조회용) - 최대 크기 초과 시 가장 오래된 항목 제거
    PaymentLogger.logs.push(entry);
    while (PaymentLogger.logs.length > PaymentLogger.maxInMemoryLogs) {
      PaymentLogger.logs.shift();
    }

    // 콘솔 출력
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

  // ─── 조회 메서드 (관리자 화면용) ─────────────
  /**
   * 전체 로그 조회
   */
  static getAllLogs(filters?: {
    level?: LogLevel;
    payment_id?: string;
    order_id?: string;
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
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

    // 최신순 정렬
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

    for (const log of PaymentLogger.logs) {
      by_level[log.level]++;
      if (
        (log.level === LOG_LEVEL.ERROR || log.level === LOG_LEVEL.CRITICAL) &&
        new Date(log.timestamp).getTime() > oneHourAgo
      ) {
        recent_errors++;
      }
    }

    return {
      total: PaymentLogger.logs.length,
      by_level,
      recent_errors,
    };
  }

  /**
   * 로그 초기화 (테스트용)
   */
  static clear(): void {
    PaymentLogger.logs = [];
  }
}
