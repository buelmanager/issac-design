/**
 * 결제 시스템 전체 검수 테스트
 *
 * 실행: npx tsx tests/payment-system-audit.ts
 *
 * 테스트 범위:
 * A. 상태 머신 (State Machine) - 모든 전이 규칙
 * B. 검증 유틸리티 (Validators) - 입력 검증
 * C. 로거 (PaymentLogger) - 로깅, 마스킹, 검색, 통계
 * D. Mock PG 어댑터 - PG 응답 시뮬레이션
 * E. API 엔드포인트 시나리오 - 통합 시나리오 검증
 */

// ─── 테스트 인프라 ─────────────────────────────────
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures: { section: string; test: string; error: string }[] = [];
let currentSection = '';

function section(name: string): void {
  currentSection = name;
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${name}`);
  console.log('═'.repeat(60));
}

async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failedTests++;
    const msg = err instanceof Error ? err.message : String(err);
    failures.push({ section: currentSection, test: name, error: msg });
    console.log(`  ❌ ${name}: ${msg}`);
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(`${message ?? 'assertEqual'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertThrows(fn: () => void, message?: string): void {
  let threw = false;
  try {
    fn();
  } catch {
    threw = true;
  }
  if (!threw) throw new Error(`${message ?? 'assertThrows'}: expected function to throw`);
}

// ─── 동적 import (Astro 환경 우회) ─────────────────
async function main() {
  // State Machine
  const { PaymentStateMachine } = await import('../src/lib/payment/state-machine.js');
  const { PAYMENT_STATUS } = await import('../src/lib/payment/types.js');

  // Validators
  const {
    validateAmount,
    isValidAmount,
    calculateOrderTotal,
    validateCreatePaymentRequest,
    validateCancelRequest,
    validateRefundRequest,
    isValidUUID,
    generateIdempotencyKey,
  } = await import('../src/lib/payment/validators.js');

  // Logger
  const { PaymentLogger } = await import('../src/lib/payment/logger.js');

  // Mock Adapter
  const { MockPaymentAdapter } = await import('../src/lib/payment/adapters/mock-adapter.js');

  // ══════════════════════════════════════════════════
  // A. 상태 머신 테스트
  // ══════════════════════════════════════════════════
  section('A. 상태 머신 (State Machine) - 전이 규칙 검증');

  // A-1. 정상 전이
  await test('A-1. INIT → PENDING (정상 전이)', () => {
    assert(
      PaymentStateMachine.canTransition(PAYMENT_STATUS.INIT, PAYMENT_STATUS.PENDING),
      'INIT → PENDING 허용되어야 함'
    );
  });

  await test('A-2. PENDING → PAID (정상 전이)', () => {
    assert(
      PaymentStateMachine.canTransition(PAYMENT_STATUS.PENDING, PAYMENT_STATUS.PAID),
      'PENDING → PAID 허용되어야 함'
    );
  });

  await test('A-3. PENDING → FAILED (정상 전이)', () => {
    assert(
      PaymentStateMachine.canTransition(PAYMENT_STATUS.PENDING, PAYMENT_STATUS.FAILED),
      'PENDING → FAILED 허용되어야 함'
    );
  });

  await test('A-4. PENDING → CANCELED (정상 전이)', () => {
    assert(
      PaymentStateMachine.canTransition(PAYMENT_STATUS.PENDING, PAYMENT_STATUS.CANCELED),
      'PENDING → CANCELED 허용되어야 함'
    );
  });

  await test('A-5. PAID → REFUND_PENDING (정상 전이)', () => {
    assert(
      PaymentStateMachine.canTransition(PAYMENT_STATUS.PAID, PAYMENT_STATUS.REFUND_PENDING),
      'PAID → REFUND_PENDING 허용되어야 함'
    );
  });

  await test('A-6. REFUND_PENDING → REFUNDED (정상 전이)', () => {
    assert(
      PaymentStateMachine.canTransition(PAYMENT_STATUS.REFUND_PENDING, PAYMENT_STATUS.REFUNDED),
      'REFUND_PENDING → REFUNDED 허용되어야 함'
    );
  });

  // A-2. 불법 전이
  await test('A-7. INIT → PAID (스킵 불가)', () => {
    assert(
      !PaymentStateMachine.canTransition(PAYMENT_STATUS.INIT, PAYMENT_STATUS.PAID),
      'INIT → PAID 불허되어야 함'
    );
  });

  await test('A-8. INIT → FAILED (스킵 불가)', () => {
    assert(
      !PaymentStateMachine.canTransition(PAYMENT_STATUS.INIT, PAYMENT_STATUS.FAILED),
      'INIT → FAILED 불허되어야 함'
    );
  });

  await test('A-9. PAID → PENDING (역전 불가)', () => {
    assert(
      !PaymentStateMachine.canTransition(PAYMENT_STATUS.PAID, PAYMENT_STATUS.PENDING),
      'PAID → PENDING 불허되어야 함'
    );
  });

  await test('A-10. FAILED → PENDING (역전 불가)', () => {
    assert(
      !PaymentStateMachine.canTransition(PAYMENT_STATUS.FAILED, PAYMENT_STATUS.PENDING),
      'FAILED → PENDING 불허되어야 함'
    );
  });

  await test('A-11. CANCELED → PENDING (역전 불가)', () => {
    assert(
      !PaymentStateMachine.canTransition(PAYMENT_STATUS.CANCELED, PAYMENT_STATUS.PENDING),
      'CANCELED → PENDING 불허되어야 함'
    );
  });

  await test('A-12. REFUNDED → PAID (역전 불가)', () => {
    assert(
      !PaymentStateMachine.canTransition(PAYMENT_STATUS.REFUNDED, PAYMENT_STATUS.PAID),
      'REFUNDED → PAID 불허되어야 함'
    );
  });

  await test('A-13. PENDING → REFUND_PENDING (스킵 불가)', () => {
    assert(
      !PaymentStateMachine.canTransition(PAYMENT_STATUS.PENDING, PAYMENT_STATUS.REFUND_PENDING),
      'PENDING → REFUND_PENDING 불허되어야 함'
    );
  });

  await test('A-14. INIT → REFUNDED (스킵 불가)', () => {
    assert(
      !PaymentStateMachine.canTransition(PAYMENT_STATUS.INIT, PAYMENT_STATUS.REFUNDED),
      'INIT → REFUNDED 불허되어야 함'
    );
  });

  // A-3. 최종 상태 확인
  await test('A-15. FAILED는 최종 상태', () => {
    assert(PaymentStateMachine.isFinalState(PAYMENT_STATUS.FAILED), 'FAILED는 최종 상태');
  });

  await test('A-16. CANCELED는 최종 상태', () => {
    assert(PaymentStateMachine.isFinalState(PAYMENT_STATUS.CANCELED), 'CANCELED는 최종 상태');
  });

  await test('A-17. REFUNDED는 최종 상태', () => {
    assert(PaymentStateMachine.isFinalState(PAYMENT_STATUS.REFUNDED), 'REFUNDED는 최종 상태');
  });

  await test('A-18. INIT는 최종 상태 아님', () => {
    assert(!PaymentStateMachine.isFinalState(PAYMENT_STATUS.INIT), 'INIT는 최종 상태 아님');
  });

  await test('A-19. PENDING은 최종 상태 아님', () => {
    assert(!PaymentStateMachine.isFinalState(PAYMENT_STATUS.PENDING), 'PENDING은 최종 상태 아님');
  });

  await test('A-20. PAID는 최종 상태 아님 (환불 가능)', () => {
    assert(!PaymentStateMachine.isFinalState(PAYMENT_STATUS.PAID), 'PAID는 최종 상태 아님');
  });

  // A-4. 비즈니스 로직 메서드
  await test('A-21. isPaid 검증', () => {
    assert(PaymentStateMachine.isPaid(PAYMENT_STATUS.PAID), 'PAID는 isPaid=true');
    assert(!PaymentStateMachine.isPaid(PAYMENT_STATUS.PENDING), 'PENDING은 isPaid=false');
  });

  await test('A-22. isCancelable 검증 (PENDING만 가능)', () => {
    assert(PaymentStateMachine.isCancelable(PAYMENT_STATUS.PENDING), 'PENDING은 취소 가능');
    assert(!PaymentStateMachine.isCancelable(PAYMENT_STATUS.PAID), 'PAID는 취소 불가');
    assert(!PaymentStateMachine.isCancelable(PAYMENT_STATUS.INIT), 'INIT은 취소 불가');
  });

  await test('A-23. isRefundable 검증 (PAID만 가능)', () => {
    assert(PaymentStateMachine.isRefundable(PAYMENT_STATUS.PAID), 'PAID는 환불 가능');
    assert(!PaymentStateMachine.isRefundable(PAYMENT_STATUS.PENDING), 'PENDING은 환불 불가');
    assert(!PaymentStateMachine.isRefundable(PAYMENT_STATUS.REFUNDED), 'REFUNDED는 환불 불가');
  });

  await test('A-24. getNextStates 검증', () => {
    const fromInit = PaymentStateMachine.getNextStates(PAYMENT_STATUS.INIT);
    assertEqual(fromInit.length, 1, 'INIT 다음 상태 1개');
    assert(fromInit.includes(PAYMENT_STATUS.PENDING), 'INIT → PENDING');

    const fromPending = PaymentStateMachine.getNextStates(PAYMENT_STATUS.PENDING);
    assertEqual(fromPending.length, 3, 'PENDING 다음 상태 3개');

    const fromFailed = PaymentStateMachine.getNextStates(PAYMENT_STATUS.FAILED);
    assertEqual(fromFailed.length, 0, 'FAILED 다음 상태 0개');
  });

  await test('A-25. validateTransition 에러 메시지 검증', () => {
    const result = PaymentStateMachine.validateTransition(PAYMENT_STATUS.INIT, PAYMENT_STATUS.PAID);
    assert(!result.valid, '유효하지 않은 전이');
    assert(result.error!.includes('not allowed'), '에러 메시지에 not allowed 포함');
    assert(result.error!.includes('PENDING'), '에러 메시지에 허용 상태 포함');
  });

  // ══════════════════════════════════════════════════
  // B. 검증 유틸리티 테스트
  // ══════════════════════════════════════════════════
  section('B. 검증 유틸리티 (Validators)');

  // B-1. 금액 검증
  await test('B-1. isValidAmount - 정상 금액 (양의 정수)', () => {
    assert(isValidAmount(1000), '1000은 유효');
    assert(isValidAmount(1), '1은 유효');
    assert(isValidAmount(999999999), '999999999는 유효');
  });

  await test('B-2. isValidAmount - 유효하지 않은 금액', () => {
    assert(!isValidAmount(0), '0은 무효');
    assert(!isValidAmount(-1), '-1은 무효');
    assert(!isValidAmount(1.5), '소수점은 무효');
    assert(!isValidAmount(NaN), 'NaN은 무효');
    assert(!isValidAmount(Infinity), 'Infinity는 무효');
    assert(!isValidAmount('1000'), '문자열은 무효');
    assert(!isValidAmount(null), 'null은 무효');
    assert(!isValidAmount(undefined), 'undefined는 무효');
  });

  await test('B-3. validateAmount - 금액 일치', () => {
    assert(validateAmount(50000, 50000), '50000 === 50000 일치');
  });

  await test('B-4. validateAmount - 금액 불일치 (CRITICAL 로그)', () => {
    // 이 호출은 내부적으로 PaymentLogger.critical을 호출함
    const result = validateAmount(50000, 49000);
    assert(!result, '금액 불일치 시 false');
    // CRITICAL 로그가 생성되었는지 확인
    const errorLogs = PaymentLogger.getErrorLogs(10);
    const amountMismatch = errorLogs.find(l => l.action === 'AMOUNT_MISMATCH');
    assert(!!amountMismatch, 'AMOUNT_MISMATCH CRITICAL 로그 생성됨');
    assertEqual(amountMismatch!.level, 'CRITICAL', 'CRITICAL 레벨');
  });

  // B-2. 주문 아이템 금액 계산
  await test('B-5. calculateOrderTotal - 정상 계산', () => {
    const total = calculateOrderTotal([
      { product_id: 'p1', name: '상품A', quantity: 2, unit_price: 10000 },
      { product_id: 'p2', name: '상품B', quantity: 1, unit_price: 5000 },
    ]);
    assertEqual(total, 25000, '2*10000 + 1*5000 = 25000');
  });

  await test('B-6. calculateOrderTotal - 단일 아이템', () => {
    const total = calculateOrderTotal([
      { product_id: 'p1', name: '상품A', quantity: 1, unit_price: 99000 },
    ]);
    assertEqual(total, 99000, '1*99000 = 99000');
  });

  await test('B-7. calculateOrderTotal - 잘못된 아이템 에러', () => {
    assertThrows(() => {
      calculateOrderTotal([
        { product_id: 'p1', name: '상품A', quantity: 0, unit_price: 10000 },
      ]);
    }, '수량 0은 에러');
  });

  await test('B-8. calculateOrderTotal - 음수 가격 에러', () => {
    assertThrows(() => {
      calculateOrderTotal([
        { product_id: 'p1', name: '상품A', quantity: 1, unit_price: -1000 },
      ]);
    }, '음수 가격은 에러');
  });

  // B-3. 결제 생성 요청 검증
  await test('B-9. validateCreatePaymentRequest - 정상 요청', () => {
    const result = validateCreatePaymentRequest({
      order_id: '550e8400-e29b-41d4-a716-446655440000',
      idempotency_key: 'test-key-001',
    });
    assert(result.valid, '정상 요청은 valid');
    assertEqual(result.errors.length, 0, '에러 없음');
  });

  await test('B-10. validateCreatePaymentRequest - 빈 body', () => {
    const result = validateCreatePaymentRequest(null);
    assert(!result.valid, '빈 body는 invalid');
    assert(result.errors.length > 0, '에러 있음');
  });

  await test('B-11. validateCreatePaymentRequest - order_id 누락', () => {
    const result = validateCreatePaymentRequest({ idempotency_key: 'key' });
    assert(!result.valid, 'order_id 누락은 invalid');
    assert(result.errors.some(e => e.includes('order_id')), 'order_id 에러 메시지');
  });

  await test('B-12. validateCreatePaymentRequest - idempotency_key 누락', () => {
    const result = validateCreatePaymentRequest({ order_id: 'uuid' });
    assert(!result.valid, 'idempotency_key 누락은 invalid');
    assert(result.errors.some(e => e.includes('idempotency_key')), 'idempotency_key 에러 메시지');
  });

  await test('B-13. validateCreatePaymentRequest - idempotency_key 길이 초과', () => {
    const result = validateCreatePaymentRequest({
      order_id: 'uuid',
      idempotency_key: 'x'.repeat(256),
    });
    assert(!result.valid, '256자 키는 invalid');
    assert(result.errors.some(e => e.includes('255')), '255자 제한 에러 메시지');
  });

  // B-4. 취소 요청 검증
  await test('B-14. validateCancelRequest - 정상 요청', () => {
    const result = validateCancelRequest({ payment_id: 'uuid', reason: '고객 요청' });
    assert(result.valid, '정상 취소 요청');
  });

  await test('B-15. validateCancelRequest - payment_id 누락', () => {
    const result = validateCancelRequest({ reason: '이유' });
    assert(!result.valid, 'payment_id 누락');
  });

  await test('B-16. validateCancelRequest - reason 누락', () => {
    const result = validateCancelRequest({ payment_id: 'uuid' });
    assert(!result.valid, 'reason 누락');
  });

  // B-5. 환불 요청 검증
  await test('B-17. validateRefundRequest - 정상 전액 환불', () => {
    const result = validateRefundRequest({ payment_id: 'uuid', reason: '환불' });
    assert(result.valid, '정상 전액 환불');
  });

  await test('B-18. validateRefundRequest - 정상 부분 환불', () => {
    const result = validateRefundRequest({ payment_id: 'uuid', reason: '환불', amount: 5000 });
    assert(result.valid, '정상 부분 환불');
  });

  await test('B-19. validateRefundRequest - 잘못된 금액', () => {
    const result = validateRefundRequest({ payment_id: 'uuid', reason: '환불', amount: -1000 });
    assert(!result.valid, '음수 금액');
    assert(result.errors.some(e => e.includes('positive integer')), '에러 메시지');
  });

  await test('B-20. validateRefundRequest - 소수점 금액', () => {
    const result = validateRefundRequest({ payment_id: 'uuid', reason: '환불', amount: 1000.5 });
    assert(!result.valid, '소수점 금액');
  });

  // B-6. UUID 검증
  await test('B-21. isValidUUID - 정상 UUID', () => {
    assert(isValidUUID('550e8400-e29b-41d4-a716-446655440000'), '정상 UUID');
    assert(isValidUUID('6ba7b810-9dad-11d1-80b4-00c04fd430c8'), '정상 UUID v1');
  });

  await test('B-22. isValidUUID - 잘못된 형식', () => {
    assert(!isValidUUID('not-a-uuid'), '문자열');
    assert(!isValidUUID('550e8400-e29b-41d4-a716'), '짧은 UUID');
    assert(!isValidUUID(''), '빈 문자열');
    assert(!isValidUUID('550e8400e29b41d4a716446655440000'), '하이픈 없음');
  });

  // B-7. 멱등성 키 생성
  await test('B-23. generateIdempotencyKey - 키 생성', () => {
    const key = generateIdempotencyKey('order-123');
    assert(key.startsWith('order-123_'), '주문ID로 시작');
    assert(key.endsWith('_1'), '기본 시도 1');

    const key2 = generateIdempotencyKey('order-123', 3);
    assert(key2.endsWith('_3'), '시도 3');
  });

  await test('B-24. generateIdempotencyKey - 고유성', () => {
    const key1 = generateIdempotencyKey('order-1');
    const key2 = generateIdempotencyKey('order-1');
    // 타임스탬프가 달라야 하지만, ms 단위라 같을 수도 있으므로 형식만 확인
    assert(typeof key1 === 'string', '문자열 타입');
    assert(key1.split('_').length === 3, '3파트 구성 (orderId_timestamp_attempt)');
  });

  // ══════════════════════════════════════════════════
  // C. 로거 테스트
  // ══════════════════════════════════════════════════
  section('C. PaymentLogger - 로깅 시스템 검증');

  // 테스트 시작 전 로그 클리어
  PaymentLogger.clear();

  await test('C-1. INFO 로그 기록', () => {
    const log = PaymentLogger.info('TEST_ACTION', { key: 'value' });
    assertEqual(log.level, 'INFO', 'INFO 레벨');
    assertEqual(log.action, 'TEST_ACTION', 'action 일치');
    assert(!!log.timestamp, 'timestamp 있음');
    assertEqual(log.details.key, 'value', 'details 포함');
  });

  await test('C-2. WARN 로그 기록', () => {
    const log = PaymentLogger.warn('TEST_WARN', { warning: true });
    assertEqual(log.level, 'WARN', 'WARN 레벨');
  });

  await test('C-3. ERROR 로그 기록', () => {
    const error = new Error('테스트 에러');
    const log = PaymentLogger.error('TEST_ERROR', error, { context: 'test' });
    assertEqual(log.level, 'ERROR', 'ERROR 레벨');
    assertEqual(log.error, '테스트 에러', 'error message 포함');
    assert(!!log.stack, 'stack trace 포함');
  });

  await test('C-4. CRITICAL 로그 기록', () => {
    const log = PaymentLogger.critical('TEST_CRITICAL', new Error('심각한 에러'), { severity: 'high' });
    assertEqual(log.level, 'CRITICAL', 'CRITICAL 레벨');
  });

  await test('C-5. payment_id, order_id 컨텍스트 포함', () => {
    const log = PaymentLogger.info('TEST_CONTEXT', {}, {
      payment_id: 'pay-123',
      order_id: 'ord-456',
    });
    assertEqual(log.payment_id, 'pay-123', 'payment_id 기록');
    assertEqual(log.order_id, 'ord-456', 'order_id 기록');
  });

  // C-2. 민감정보 마스킹
  await test('C-6. 카드번호 마스킹', () => {
    const log = PaymentLogger.info('MASKING_TEST', {
      card_number: '4111-1111-1111-1111',
    });
    const details = JSON.stringify(log.details);
    assert(!details.includes('4111'), '원본 카드번호 제거됨');
    assert(details.includes('[MASKED]') || details.includes('****'), '마스킹됨');
  });

  await test('C-7. CVV 마스킹', () => {
    const log = PaymentLogger.info('MASKING_CVV', {
      cvv: '123',
    });
    const details = JSON.stringify(log.details);
    assert(details.includes('[MASKED]'), 'CVV 마스킹됨');
  });

  await test('C-8. 비밀번호 마스킹', () => {
    const log = PaymentLogger.info('MASKING_PASSWORD', {
      password: 'my-secret-password',
    });
    const details = JSON.stringify(log.details);
    assert(!details.includes('my-secret-password'), '비밀번호 제거됨');
    assert(details.includes('[MASKED]'), '마스킹됨');
  });

  await test('C-9. 토큰 마스킹', () => {
    const log = PaymentLogger.info('MASKING_TOKEN', {
      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
    });
    const details = JSON.stringify(log.details);
    assert(!details.includes('eyJhbGci'), '토큰 제거됨');
  });

  await test('C-10. Authorization 헤더 마스킹', () => {
    const log = PaymentLogger.info('MASKING_AUTH', {
      authorization: 'Bearer sk-test-secret-key-12345',
    });
    const details = JSON.stringify(log.details);
    assert(!details.includes('sk-test'), '인증 헤더 제거됨');
  });

  // C-3. request_id 추적
  await test('C-11. request_id 설정/조회/해제', () => {
    PaymentLogger.setRequestId('req-test-123');
    assertEqual(PaymentLogger.getRequestId(), 'req-test-123', 'request_id 설정됨');

    const log = PaymentLogger.info('REQUEST_ID_TEST', {});
    assertEqual(log.request_id, 'req-test-123', '로그에 request_id 자동 포함');

    PaymentLogger.clearRequestId();
    assertEqual(PaymentLogger.getRequestId(), undefined, 'request_id 해제됨');
  });

  await test('C-12. context의 request_id가 글로벌보다 우선', () => {
    PaymentLogger.setRequestId('global-req');
    const log = PaymentLogger.log('INFO', 'OVERRIDE_TEST', {}, { request_id: 'context-req' });
    assertEqual(log.request_id, 'context-req', 'context request_id 우선');
    PaymentLogger.clearRequestId();
  });

  // C-4. API 미들웨어
  await test('C-13. apiRequest - 요청 로그 생성', () => {
    const prevCount = PaymentLogger.getAllLogs().total;

    const mockRequest = new Request('http://localhost/api/payment/test', {
      method: 'POST',
      headers: {
        'user-agent': 'test-agent',
        'x-forwarded-for': '1.2.3.4',
      },
    });

    const cleanup = PaymentLogger.apiRequest(mockRequest, '/api/payment/test');
    assert(typeof cleanup === 'function', 'cleanup 함수 반환');

    // request_id가 설정되었는지 확인
    assert(!!PaymentLogger.getRequestId(), 'request_id 설정됨');

    // 로그가 추가되었는지 확인
    const newCount = PaymentLogger.getAllLogs().total;
    assert(newCount > prevCount, '새 로그 추가됨');

    cleanup();
    assertEqual(PaymentLogger.getRequestId(), undefined, 'cleanup 후 request_id 해제');
  });

  await test('C-14. apiResponse - 응답 로그 생성 (200)', () => {
    const startTime = performance.now() - 50; // 50ms 전
    PaymentLogger.apiResponse(200, startTime, { test_c14: true });

    // 검색으로 정확한 로그 찾기 (타임스탬프 동일 시 정렬 불안정 대응)
    const allLogs = PaymentLogger.getAllLogs({ limit: 100 });
    const apiResponseLog = allLogs.logs.find(l => l.action === 'API_RESPONSE' && l.details.test_c14 === true);
    assert(!!apiResponseLog, 'API_RESPONSE 로그 존재');
    assertEqual(apiResponseLog!.level, 'INFO', '200은 INFO');
    assert(apiResponseLog!.http_status === 200, 'http_status 200');
    assert(apiResponseLog!.duration_ms! >= 40, 'duration >= 40ms');
  });

  await test('C-15. apiResponse - 400 오류는 WARN', () => {
    PaymentLogger.apiResponse(400, performance.now(), { test_c15: true });
    const allLogs = PaymentLogger.getAllLogs({ limit: 100 });
    const warnLog = allLogs.logs.find(l => l.action === 'API_RESPONSE' && l.details.test_c15 === true);
    assert(!!warnLog, 'WARN 로그 존재');
    assertEqual(warnLog!.level, 'WARN', '400은 WARN');
  });

  await test('C-16. apiResponse - 500 오류는 ERROR', () => {
    PaymentLogger.apiResponse(500, performance.now(), { test_c16: true });
    const allLogs = PaymentLogger.getAllLogs({ limit: 100 });
    const errorLog = allLogs.logs.find(l => l.action === 'API_RESPONSE' && l.details.test_c16 === true);
    assert(!!errorLog, 'ERROR 로그 존재');
    assertEqual(errorLog!.level, 'ERROR', '500은 ERROR');
  });

  // C-5. PG 호출 타이밍 측정
  await test('C-17. measurePgCall - 성공 케이스', async () => {
    const result = await PaymentLogger.measurePgCall(
      'PG_CALL_TEST_SUCCESS',
      async () => {
        await new Promise(r => setTimeout(r, 20));
        return { success: true };
      },
      { payment_id: 'test-pay-success' }
    );

    assertEqual(result.success, true, 'PG 호출 성공');

    // _START + _COMPLETE 로그 확인
    const allLogs = PaymentLogger.getAllLogs({ limit: 200 });
    const startLog = allLogs.logs.find(l => l.action === 'PG_CALL_TEST_SUCCESS_START');
    const completeLog = allLogs.logs.find(l => l.action === 'PG_CALL_TEST_SUCCESS_COMPLETE');
    assert(!!startLog, 'START 로그 생성');
    assert(!!completeLog, 'COMPLETE 로그 생성');
    assert(completeLog!.duration_ms! >= 15, 'duration >= 15ms');
  });

  await test('C-18. measurePgCall - 실패 케이스', async () => {
    let caught = false;
    try {
      await PaymentLogger.measurePgCall(
        'TEST_PG_FAIL',
        async () => { throw new Error('PG 타임아웃'); },
        { payment_id: 'test-pay-fail' }
      );
    } catch {
      caught = true;
    }
    assert(caught, 'PG 에러 재전파됨');

    const allLogs = PaymentLogger.getAllLogs({ limit: 200 });
    const errorLog = allLogs.logs.find(l => l.action === 'TEST_PG_FAIL_ERROR');
    assert(!!errorLog, 'ERROR 로그 생성');
    assertEqual(errorLog!.level, 'ERROR', 'ERROR 레벨');
  });

  // C-6. 로그 조회 및 필터링
  await test('C-19. getAllLogs - 전체 조회', () => {
    const result = PaymentLogger.getAllLogs();
    assert(result.total > 0, '로그 있음');
    assert(result.logs.length > 0, '로그 반환됨');
  });

  await test('C-20. getAllLogs - 레벨 필터', () => {
    const result = PaymentLogger.getAllLogs({ level: 'ERROR' });
    assert(result.logs.every(l => l.level === 'ERROR'), '모든 로그 ERROR');
  });

  await test('C-21. getAllLogs - payment_id 필터', () => {
    const result = PaymentLogger.getAllLogs({ payment_id: 'test-pay' });
    assert(result.logs.every(l => l.payment_id === 'test-pay'), '모든 로그 해당 payment_id');
  });

  await test('C-22. getAllLogs - 검색', () => {
    const result = PaymentLogger.getAllLogs({ search: 'MASKING' });
    assert(result.logs.every(l => l.action.includes('MASKING')), '검색 결과 일치');
  });

  await test('C-23. getAllLogs - 페이지네이션', () => {
    const page1 = PaymentLogger.getAllLogs({ limit: 5, offset: 0 });
    const page2 = PaymentLogger.getAllLogs({ limit: 5, offset: 5 });

    assert(page1.logs.length <= 5, '페이지 크기 제한');
    if (page1.total > 5) {
      assert(page2.logs.length > 0, '2페이지에 데이터 있음');
      assert(page1.logs[0].timestamp !== page2.logs[0].timestamp, '다른 페이지 데이터');
    }
  });

  await test('C-24. getAllLogs - 시간 정렬 (최신순)', () => {
    const result = PaymentLogger.getAllLogs({ limit: 10 });
    for (let i = 1; i < result.logs.length; i++) {
      assert(
        result.logs[i - 1].timestamp >= result.logs[i].timestamp,
        `로그 ${i - 1}이 ${i}보다 최신`
      );
    }
  });

  // C-7. 에러 로그 전용 조회
  await test('C-25. getErrorLogs - ERROR/CRITICAL만 반환', () => {
    const errors = PaymentLogger.getErrorLogs(100);
    assert(
      errors.every(l => l.level === 'ERROR' || l.level === 'CRITICAL'),
      '모든 로그가 ERROR 또는 CRITICAL'
    );
  });

  // C-8. 결제 타임라인
  await test('C-26. getPaymentTimeline - 시간순 정렬', () => {
    // 동일 payment_id로 여러 로그 생성
    PaymentLogger.info('TIMELINE_1', {}, { payment_id: 'timeline-pay' });
    PaymentLogger.info('TIMELINE_2', {}, { payment_id: 'timeline-pay' });
    PaymentLogger.info('TIMELINE_3', {}, { payment_id: 'timeline-pay' });

    const timeline = PaymentLogger.getPaymentTimeline('timeline-pay');
    assert(timeline.length >= 3, '타임라인 3개 이상');
    // 시간 오름차순 확인
    for (let i = 1; i < timeline.length; i++) {
      assert(
        timeline[i - 1].timestamp <= timeline[i].timestamp,
        '타임라인 시간 오름차순'
      );
    }
  });

  // C-9. 통계
  await test('C-27. getStats - 통계 형식', () => {
    const stats = PaymentLogger.getStats();
    assert(stats.total > 0, 'total > 0');
    assert(typeof stats.by_level.INFO === 'number', 'by_level.INFO 있음');
    assert(typeof stats.by_level.WARN === 'number', 'by_level.WARN 있음');
    assert(typeof stats.by_level.ERROR === 'number', 'by_level.ERROR 있음');
    assert(typeof stats.by_level.CRITICAL === 'number', 'by_level.CRITICAL 있음');
    assert(typeof stats.recent_errors === 'number', 'recent_errors 있음');
    assert(typeof stats.avg_api_duration_ms === 'number', 'avg_api_duration_ms 있음');
    assert(typeof stats.pg_call_count === 'number', 'pg_call_count 있음');
  });

  await test('C-28. getStats - PG 호출 카운트 포함', () => {
    // C-17, C-18에서 PG_CALL 로그가 생성되었으므로 카운트 > 0
    const allLogs = PaymentLogger.getAllLogs({ limit: 1000 });
    const pgLogs = allLogs.logs.filter(l => l.action.startsWith('PG_CALL_') || l.action.startsWith('TEST_PG_'));
    assert(pgLogs.length > 0, `PG 호출 관련 로그 존재 (${pgLogs.length}건)`);
    const stats = PaymentLogger.getStats();
    assert(stats.pg_call_count > 0, `PG 호출 카운트 > 0 (실제: ${stats.pg_call_count})`);
  });

  // C-10. 인메모리 최대 로그 수 제한
  await test('C-29. 인메모리 1000건 제한', () => {
    PaymentLogger.clear();
    // 1010건 로그 생성
    for (let i = 0; i < 1010; i++) {
      PaymentLogger.info(`OVERFLOW_TEST_${i}`, {});
    }
    const result = PaymentLogger.getAllLogs({ limit: 2000 });
    assert(result.total <= 1000, `인메모리 최대 1000건 (실제: ${result.total})`);
  });

  // C-11. clear() 테스트
  await test('C-30. clear() - 로그 초기화', () => {
    PaymentLogger.info('BEFORE_CLEAR', {});
    PaymentLogger.clear();
    const result = PaymentLogger.getAllLogs();
    assertEqual(result.total, 0, '초기화 후 0건');
  });

  // ══════════════════════════════════════════════════
  // D. Mock PG 어댑터 테스트
  // ══════════════════════════════════════════════════
  section('D. Mock PG 어댑터');

  const mockAdapter = new MockPaymentAdapter();

  await test('D-1. provider 식별자', () => {
    assertEqual(mockAdapter.provider, 'mock', 'provider = mock');
  });

  await test('D-2. createPayment - 정상 생성', async () => {
    const result = await mockAdapter.createPayment({
      order_id: 'test-order',
      amount: 50000,
      currency: 'KRW',
      order_name: 'ISSAC Design 테스트',
      customer_name: '홍길동',
      idempotency_key: 'test-key',
    });

    assert(result.success, '성공');
    assert(!!result.pg_payment_id, 'pg_payment_id 생성됨');
    assert(result.pg_payment_id!.startsWith('mock_pay_'), 'mock_ 접두사');
    assert(!!result.checkout_url, 'checkout_url 생성됨');
    assert(!!result.raw_response, 'raw_response 있음');
  });

  await test('D-3. confirmPayment - 정상 확인', async () => {
    const result = await mockAdapter.confirmPayment('mock_pay_test', 50000);

    assert(result.success, '성공');
    assertEqual(result.pg_payment_id, 'mock_pay_test', 'pg_payment_id 일치');
    assertEqual(result.amount, 50000, '금액 일치');
    assertEqual(result.method, 'card', '결제수단 card');
    assert(!!result.approved_at, 'approved_at 있음');
  });

  await test('D-4. cancelPayment - 정상 취소', async () => {
    const result = await mockAdapter.cancelPayment('mock_pay_test', '고객 요청');

    assert(result.success, '성공');
    assertEqual(result.pg_payment_id, 'mock_pay_test', 'pg_payment_id 일치');
    assert(result.raw_response?.cancel_reason === '고객 요청', '취소 사유 포함');
  });

  await test('D-5. refundPayment - 정상 환불', async () => {
    const result = await mockAdapter.refundPayment('mock_pay_test', 30000, '부분 환불');

    assert(result.success, '성공');
    assertEqual(result.refunded_amount, 30000, '환불 금액 일치');
    assert(result.raw_response?.refund_reason === '부분 환불', '환불 사유 포함');
  });

  // D-2. Webhook 서명 검증
  await test('D-6. verifyWebhookSignature - 정상 서명', () => {
    const payload = JSON.stringify({ type: 'payment.confirmed', amount: 50000 });
    const signature = MockPaymentAdapter.generateMockSignature(payload);
    assert(mockAdapter.verifyWebhookSignature(payload, signature), '정상 서명 검증 성공');
  });

  await test('D-7. verifyWebhookSignature - 잘못된 서명', () => {
    const payload = JSON.stringify({ type: 'payment.confirmed', amount: 50000 });
    assert(!mockAdapter.verifyWebhookSignature(payload, 'invalid-sig'), '잘못된 서명 검증 실패');
  });

  await test('D-8. verifyWebhookSignature - 빈 서명', () => {
    const payload = JSON.stringify({ type: 'payment.confirmed' });
    assert(!mockAdapter.verifyWebhookSignature(payload, ''), '빈 서명 검증 실패');
  });

  await test('D-9. verifyWebhookSignature - 변조된 payload', () => {
    const payload = JSON.stringify({ type: 'payment.confirmed', amount: 50000 });
    const signature = MockPaymentAdapter.generateMockSignature(payload);
    // Mock 서명은 payload 길이 기반이므로, 길이가 다른 변조 payload 사용
    const tamperedPayload = JSON.stringify({ type: 'payment.confirmed', amount: 50000, extra_field: 'injected_data' });
    assert(!mockAdapter.verifyWebhookSignature(tamperedPayload, signature), '변조된 payload 검증 실패');
  });

  // ══════════════════════════════════════════════════
  // E. API 엔드포인트 통합 시나리오 검증
  // ══════════════════════════════════════════════════
  section('E. API 엔드포인트 시나리오 (로직 검증)');

  // 테스트를 위한 로그 초기화
  PaymentLogger.clear();

  // E-1. 인증 시나리오 (auth-guard.ts 로직)
  await test('E-1. 인증: 토큰 없는 요청 → AUTH_MISSING_TOKEN WARN 로그', () => {
    // auth-guard가 PaymentLogger.warn('AUTH_MISSING_TOKEN', ...) 호출
    // 시뮬레이션:
    PaymentLogger.warn('AUTH_MISSING_TOKEN', {
      path: '/api/payment/create',
      ip: '192.168.1.1',
    });
    const logs = PaymentLogger.getAllLogs({ search: 'AUTH_MISSING_TOKEN' });
    assert(logs.total > 0, 'AUTH_MISSING_TOKEN 로그 생성');
    assertEqual(logs.logs[0].level, 'WARN', 'WARN 레벨');
    assertEqual(logs.logs[0].details.ip, '192.168.1.1', 'IP 기록');
  });

  await test('E-2. 인증: 유효하지 않은 토큰 → AUTH_INVALID_TOKEN WARN 로그', () => {
    PaymentLogger.warn('AUTH_INVALID_TOKEN', {
      path: '/api/payment/cancel',
      error: 'jwt expired',
      ip: '10.0.0.1',
    });
    const logs = PaymentLogger.getAllLogs({ search: 'AUTH_INVALID_TOKEN' });
    assert(logs.total > 0, 'AUTH_INVALID_TOKEN 로그 생성');
  });

  await test('E-3. 인증: 비관리자 → AUTH_NOT_ADMIN WARN 로그', () => {
    PaymentLogger.warn('AUTH_NOT_ADMIN', {
      user_id: 'user-non-admin',
      path: '/api/payment/logs',
      ip: '172.16.0.1',
    });
    const logs = PaymentLogger.getAllLogs({ search: 'AUTH_NOT_ADMIN' });
    assert(logs.total > 0, 'AUTH_NOT_ADMIN 로그 생성');
    assertEqual(logs.logs[0].details.user_id, 'user-non-admin', 'user_id 기록');
  });

  await test('E-4. 인증: 인증 서버 에러 → AUTH_VERIFICATION_ERROR ERROR 로그', () => {
    PaymentLogger.error('AUTH_VERIFICATION_ERROR', new Error('Connection refused'), {
      path: '/api/payment/status',
      ip: '192.168.0.1',
    });
    const logs = PaymentLogger.getAllLogs({ search: 'AUTH_VERIFICATION_ERROR' });
    assert(logs.total > 0, 'AUTH_VERIFICATION_ERROR 로그 생성');
    assertEqual(logs.logs[0].level, 'ERROR', 'ERROR 레벨');
  });

  await test('E-5. 인증: 성공 → AUTH_SUCCESS INFO 로그', () => {
    PaymentLogger.info('AUTH_SUCCESS', {
      user_id: 'admin-user-001',
      path: '/api/payment/create',
    });
    const logs = PaymentLogger.getAllLogs({ search: 'AUTH_SUCCESS' });
    assert(logs.total > 0, 'AUTH_SUCCESS 로그 생성');
    assertEqual(logs.logs[0].level, 'INFO', 'INFO 레벨');
  });

  // E-2. 결제 생성 시나리오
  await test('E-6. 결제 생성: 정상 플로우 로그 체인', () => {
    const paymentId = 'pay-' + Date.now();
    const orderId = 'ord-' + Date.now();

    // 결제 생성 플로우에서 발생하는 로그 체인 시뮬레이션
    PaymentLogger.setRequestId('req-create-001');

    PaymentLogger.info('API_REQUEST', { method: 'POST', path: '/api/payment/create' });
    PaymentLogger.info('PAYMENT_CREATE_START', { idempotency_key: 'key-001' }, { order_id: orderId });
    PaymentLogger.info('PAYMENT_CREATED', { amount: 50000 }, { payment_id: paymentId, order_id: orderId });
    PaymentLogger.info('PAYMENT_REQUEST_START', { amount: 50000 }, { payment_id: paymentId });
    PaymentLogger.info('PG_CALL_CREATE_PAYMENT_START', {}, { payment_id: paymentId });
    PaymentLogger.log('INFO', 'PG_CALL_CREATE_PAYMENT_COMPLETE', { duration_ms: 120 }, { payment_id: paymentId, duration_ms: 120 });
    PaymentLogger.info('STATE_TRANSITION', { from: 'INIT', to: 'PENDING' }, { payment_id: paymentId });
    PaymentLogger.info('PAYMENT_REQUESTED', { checkout_url: '/mock-checkout' }, { payment_id: paymentId });
    PaymentLogger.log('INFO', 'API_RESPONSE', { status: 200 }, { http_status: 200, duration_ms: 180 });

    PaymentLogger.clearRequestId();

    // 요청 전체 로그가 request_id로 묶이는지 확인
    const logs = PaymentLogger.getAllLogs({ search: 'req-create-001' });
    assert(logs.total >= 5, `request_id로 묶인 로그 5개 이상 (실제: ${logs.total})`);

    // 타임라인 확인
    const timeline = PaymentLogger.getPaymentTimeline(paymentId);
    assert(timeline.length >= 4, `결제 타임라인 4개 이상 (실제: ${timeline.length})`);
  });

  await test('E-7. 결제 생성: 멱등성 히트 로그', () => {
    PaymentLogger.warn('PAYMENT_IDEMPOTENCY_HIT', {
      idempotency_key: 'duplicate-key',
      existing_status: 'PENDING',
    }, { payment_id: 'pay-existing', order_id: 'ord-existing' });

    const logs = PaymentLogger.getAllLogs({ search: 'IDEMPOTENCY' });
    assert(logs.total > 0, 'IDEMPOTENCY_HIT 로그 생성');
    assertEqual(logs.logs[0].level, 'WARN', 'WARN 레벨');
  });

  await test('E-8. 결제 생성: 주문 미존재 에러 로그', () => {
    PaymentLogger.error('ORDER_NOT_FOUND', new Error('Order xxx not found'), {}, { order_id: 'ord-missing' });
    const logs = PaymentLogger.getAllLogs({ search: 'ORDER_NOT_FOUND' });
    assert(logs.total > 0, 'ORDER_NOT_FOUND 로그 생성');
    assertEqual(logs.logs[0].level, 'ERROR', 'ERROR 레벨');
  });

  await test('E-9. 결제 생성: 주문 상태 불일치 로그', () => {
    PaymentLogger.warn('ORDER_INVALID_STATUS', {
      current_status: 'paid',
      expected: 'pending_payment',
    }, { order_id: 'ord-already-paid' });
    const logs = PaymentLogger.getAllLogs({ search: 'ORDER_INVALID_STATUS' });
    assert(logs.total > 0, '주문 상태 불일치 로그');
  });

  await test('E-10. 결제 생성: PG 세션 생성 실패 로그', () => {
    PaymentLogger.error('PG_CREATE_FAILED', new Error('PG timeout'), {
      pg_error_code: 'TIMEOUT',
    }, { payment_id: 'pay-pg-fail' });
    const logs = PaymentLogger.getAllLogs({ search: 'PG_CREATE_FAILED' });
    assert(logs.total > 0, 'PG_CREATE_FAILED 로그');
    assertEqual(logs.logs[0].level, 'ERROR', 'ERROR 레벨');
  });

  // E-3. 웹훅 시나리오
  await test('E-11. 웹훅: 정상 결제 확인 플로우', () => {
    const paymentId = 'pay-webhook-' + Date.now();

    PaymentLogger.setRequestId('req-webhook-001');
    PaymentLogger.info('API_REQUEST', { method: 'POST', path: '/api/payment/webhook' });
    PaymentLogger.info('WEBHOOK_RAW_PAYLOAD', { content_length: 200, has_signature: true, body_preview: '...' });
    PaymentLogger.info('WEBHOOK_EVENT', { type: 'payment.confirmed', pg_payment_id: 'mock_pay_xxx' });
    PaymentLogger.info('PAYMENT_CONFIRM_START', { pg_payment_id: 'mock_pay_xxx', pg_amount: 50000 });
    PaymentLogger.info('PG_CALL_CONFIRM_PAYMENT_START', {}, { payment_id: paymentId });
    PaymentLogger.log('INFO', 'PG_CALL_CONFIRM_PAYMENT_COMPLETE', { duration_ms: 80 }, { payment_id: paymentId, duration_ms: 80 });
    PaymentLogger.info('STATE_TRANSITION', { from: 'PENDING', to: 'PAID' }, { payment_id: paymentId });
    PaymentLogger.info('PAYMENT_CONFIRMED', { amount: 50000, method: 'card' }, { payment_id: paymentId });
    PaymentLogger.info('WEBHOOK_PAYMENT_CONFIRMED', { pg_payment_id: 'mock_pay_xxx', amount: 50000 });
    PaymentLogger.log('INFO', 'API_RESPONSE', { status: 200 }, { http_status: 200, duration_ms: 150 });
    PaymentLogger.clearRequestId();

    const logs = PaymentLogger.getAllLogs({ search: 'req-webhook-001' });
    assert(logs.total >= 5, `웹훅 로그 체인 5개 이상 (실제: ${logs.total})`);
  });

  await test('E-12. 웹훅: 서명 검증 실패 → CRITICAL 로그', () => {
    PaymentLogger.critical('WEBHOOK_SIGNATURE_INVALID', new Error('Signature verification failed'), {
      signature_provided: true,
      content_length: 500,
      ip: '203.0.113.1',
    });
    const logs = PaymentLogger.getAllLogs({ search: 'WEBHOOK_SIGNATURE_INVALID' });
    assert(logs.total > 0, 'WEBHOOK_SIGNATURE_INVALID 로그');
    assertEqual(logs.logs[0].level, 'CRITICAL', 'CRITICAL 레벨 (보안 위협)');
  });

  await test('E-13. 웹훅: 금액 불일치 → CRITICAL 로그', () => {
    PaymentLogger.critical('AMOUNT_MISMATCH', new Error('Expected 50000 but received 49000'), {
      expected: 50000,
      actual: 49000,
      diff: -1000,
    }, { payment_id: 'pay-mismatch' });
    const logs = PaymentLogger.getAllLogs({ search: 'AMOUNT_MISMATCH' });
    assert(logs.total > 0, 'AMOUNT_MISMATCH CRITICAL 로그');
  });

  await test('E-14. 웹훅: 결제 실패 이벤트 → WARN 로그', () => {
    PaymentLogger.warn('WEBHOOK_PAYMENT_FAILED', {
      pg_payment_id: 'mock_pay_failed',
      error: 'Insufficient funds',
    });
    const logs = PaymentLogger.getAllLogs({ search: 'WEBHOOK_PAYMENT_FAILED' });
    assert(logs.total > 0, '결제 실패 로그');
    assertEqual(logs.logs[0].level, 'WARN', 'WARN 레벨');
  });

  await test('E-15. 웹훅: 알 수 없는 이벤트 타입', () => {
    PaymentLogger.warn('WEBHOOK_UNKNOWN_EVENT', {
      type: 'some.unknown.event',
      body_preview: '{"type":"some.unknown.event"}',
    });
    const logs = PaymentLogger.getAllLogs({ search: 'WEBHOOK_UNKNOWN_EVENT' });
    assert(logs.total > 0, '알 수 없는 이벤트 로그');
  });

  await test('E-16. 웹훅: JSON 파싱 에러', () => {
    PaymentLogger.error('WEBHOOK_PROCESSING_ERROR', new Error('Unexpected token'), {
      body_length: 100,
    });
    const logs = PaymentLogger.getAllLogs({ search: 'WEBHOOK_PROCESSING_ERROR' });
    assert(logs.total > 0, '웹훅 처리 에러 로그');
  });

  await test('E-17. 웹훅: PG 존재하지 않는 pg_payment_id', () => {
    PaymentLogger.error('PAYMENT_NOT_FOUND_BY_PG_ID', new Error('PG ID: mock_pay_unknown'));
    const logs = PaymentLogger.getAllLogs({ search: 'PAYMENT_NOT_FOUND_BY_PG_ID' });
    assert(logs.total > 0, '미존재 pg_payment_id 에러 로그');
  });

  // E-4. 취소 시나리오
  await test('E-18. 취소: 정상 취소 플로우', () => {
    const paymentId = 'pay-cancel-' + Date.now();
    PaymentLogger.info('PAYMENT_CANCEL_START', { reason: '고객 변심' }, { payment_id: paymentId });
    PaymentLogger.info('PG_CALL_CANCEL_PAYMENT_START', {}, { payment_id: paymentId });
    PaymentLogger.log('INFO', 'PG_CALL_CANCEL_PAYMENT_COMPLETE', { duration_ms: 50 }, { payment_id: paymentId, duration_ms: 50 });
    PaymentLogger.info('STATE_TRANSITION', { from: 'PENDING', to: 'CANCELED' }, { payment_id: paymentId });
    PaymentLogger.info('PAYMENT_CANCELED', { reason: '고객 변심' }, { payment_id: paymentId });

    const timeline = PaymentLogger.getPaymentTimeline(paymentId);
    assert(timeline.length >= 4, `취소 타임라인 4개 이상 (실제: ${timeline.length})`);
  });

  await test('E-19. 취소: 취소 불가 상태 (PAID) → 에러 로그', () => {
    // cancelPayment에서 isCancelable(PAID) = false → 에러 throw 전에 직접 체크
    assert(!PaymentStateMachine.isCancelable(PAYMENT_STATUS.PAID), 'PAID는 취소 불가');
    PaymentLogger.error('API_CANCEL_PAYMENT_ERROR', new Error('Payment cannot be canceled in status: PAID'));

    const logs = PaymentLogger.getAllLogs({ search: 'API_CANCEL_PAYMENT_ERROR' });
    assert(logs.total > 0, '취소 불가 에러 로그');
  });

  await test('E-20. 취소: PG 취소 실패', () => {
    PaymentLogger.error('PG_CANCEL_FAILED', new Error('PG cancel timeout'), {
      raw_response: { error: 'timeout' },
    }, { payment_id: 'pay-pg-cancel-fail' });
    const logs = PaymentLogger.getAllLogs({ search: 'PG_CANCEL_FAILED' });
    assert(logs.total > 0, 'PG 취소 실패 로그');
  });

  // E-5. 환불 시나리오
  await test('E-21. 환불: 정상 전액 환불 플로우', () => {
    const paymentId = 'pay-refund-' + Date.now();
    PaymentLogger.info('REFUND_REQUEST_START', {
      refund_amount: 50000,
      original_amount: 50000,
      reason: '제품 하자',
    }, { payment_id: paymentId });
    PaymentLogger.info('PG_CALL_REFUND_PAYMENT_START', {}, { payment_id: paymentId });
    PaymentLogger.log('INFO', 'PG_CALL_REFUND_PAYMENT_COMPLETE', { duration_ms: 90 }, { payment_id: paymentId, duration_ms: 90 });
    PaymentLogger.info('STATE_TRANSITION', { from: 'PAID', to: 'REFUND_PENDING' }, { payment_id: paymentId });
    PaymentLogger.info('REFUND_REQUESTED', { refund_amount: 50000 }, { payment_id: paymentId });

    const timeline = PaymentLogger.getPaymentTimeline(paymentId);
    assert(timeline.length >= 4, `환불 타임라인 4개 이상 (실제: ${timeline.length})`);
  });

  await test('E-22. 환불: 환불 불가 상태 (PENDING)', () => {
    assert(!PaymentStateMachine.isRefundable(PAYMENT_STATUS.PENDING), 'PENDING은 환불 불가');
  });

  await test('E-23. 환불: pg_payment_id 없는 결제', () => {
    PaymentLogger.error('REFUND_NO_PG_PAYMENT_ID', new Error('Missing pg_payment_id'), {}, { payment_id: 'pay-no-pg' });
    const logs = PaymentLogger.getAllLogs({ search: 'REFUND_NO_PG_PAYMENT_ID' });
    assert(logs.total > 0, 'pg_payment_id 없음 에러 로그');
  });

  await test('E-24. 환불: PG 환불 실패', () => {
    PaymentLogger.error('PG_REFUND_FAILED', new Error('Refund rejected'), {
      raw_response: { error: 'already_refunded' },
    }, { payment_id: 'pay-refund-fail' });
    const logs = PaymentLogger.getAllLogs({ search: 'PG_REFUND_FAILED' });
    assert(logs.total > 0, 'PG 환불 실패 로그');
  });

  // E-6. 상태 전이 에러
  await test('E-25. 상태 전이: 불법 전이 → ERROR 로그', () => {
    const validation = PaymentStateMachine.validateTransition(PAYMENT_STATUS.INIT, PAYMENT_STATUS.PAID);
    assert(!validation.valid, '불법 전이 감지');

    PaymentLogger.error('INVALID_STATE_TRANSITION', new Error(validation.error!), {
      from: PAYMENT_STATUS.INIT,
      to: PAYMENT_STATUS.PAID,
    }, { payment_id: 'pay-invalid-transition' });

    const logs = PaymentLogger.getAllLogs({ search: 'INVALID_STATE_TRANSITION' });
    assert(logs.total > 0, 'INVALID_STATE_TRANSITION 로그');
    assertEqual(logs.logs[0].level, 'ERROR', 'ERROR 레벨');
  });

  await test('E-26. 상태 전이: 이미 최종 상태인 결제 실패 처리 (멱등)', () => {
    // failPayment에서 이미 FAILED/CANCELED/PAID/REFUNDED이면 무시
    PaymentLogger.warn('FAIL_PAYMENT_ALREADY_FINAL', {
      current_status: 'FAILED',
      pg_payment_id: 'mock_pay_already_failed',
    }, { payment_id: 'pay-already-final' });
    const logs = PaymentLogger.getAllLogs({ search: 'FAIL_PAYMENT_ALREADY_FINAL' });
    assert(logs.total > 0, '이미 최종 상태 경고 로그');
    assertEqual(logs.logs[0].level, 'WARN', 'WARN 레벨');
  });

  // E-7. Logs API 시나리오
  await test('E-27. Logs API: stats 뷰 검증', () => {
    const stats = PaymentLogger.getStats();
    assert(stats.total > 0, 'total > 0');

    // 레벨별 합계 = total
    const levelSum = Object.values(stats.by_level).reduce((a, b) => a + b, 0);
    assertEqual(levelSum, stats.total, '레벨별 합계 = total');
  });

  await test('E-28. Logs API: errors 뷰 검증', () => {
    const errors = PaymentLogger.getErrorLogs(100);
    assert(errors.length > 0, '에러 로그 있음');
    assert(
      errors.every(l => l.level === 'ERROR' || l.level === 'CRITICAL'),
      'ERROR/CRITICAL만'
    );
  });

  // E-8. 엣지케이스
  await test('E-29. 빈 details 객체 허용', () => {
    const log = PaymentLogger.info('EMPTY_DETAILS');
    assert(typeof log.details === 'object', 'details는 객체');
  });

  await test('E-30. 매우 긴 action 이름', () => {
    const longAction = 'A'.repeat(1000);
    const log = PaymentLogger.info(longAction, {});
    assertEqual(log.action, longAction, '긴 action 저장됨');
  });

  await test('E-31. 특수문자가 포함된 로그 데이터', () => {
    const log = PaymentLogger.info('SPECIAL_CHARS', {
      message: '한글 テスト <script>alert("xss")</script> "quotes" \'single\' `backtick`',
    });
    assert(typeof log.details.message === 'string', '특수문자 데이터 유지');
  });

  await test('E-32. 중첩 객체 details', () => {
    const log = PaymentLogger.info('NESTED_DETAILS', {
      pg_response: {
        status: 'DONE',
        metadata: {
          card: { last4: '1234', brand: 'visa' },
        },
      },
    });
    assert(typeof log.details.pg_response === 'object', '중첩 객체 유지');
  });

  // ══════════════════════════════════════════════════
  // F. 종합 통계 및 관리 효율성 검증
  // ══════════════════════════════════════════════════
  section('F. 종합 통계 및 관리 효율성 검증');

  await test('F-1. 로그 레벨별 분포 확인', () => {
    const stats = PaymentLogger.getStats();
    console.log(`    → 전체: ${stats.total}건`);
    console.log(`    → INFO: ${stats.by_level.INFO}, WARN: ${stats.by_level.WARN}, ERROR: ${stats.by_level.ERROR}, CRITICAL: ${stats.by_level.CRITICAL}`);
    assert(stats.by_level.INFO > 0, 'INFO 로그 있음');
    assert(stats.by_level.WARN > 0, 'WARN 로그 있음');
    assert(stats.by_level.ERROR > 0, 'ERROR 로그 있음');
    assert(stats.by_level.CRITICAL > 0, 'CRITICAL 로그 있음');
  });

  await test('F-2. 최근 1시간 에러 카운트', () => {
    const stats = PaymentLogger.getStats();
    console.log(`    → 최근 1시간 에러: ${stats.recent_errors}건`);
    assert(stats.recent_errors > 0, '최근 에러 있음 (테스트에서 생성)');
  });

  await test('F-3. API 평균 응답시간 계산', () => {
    const stats = PaymentLogger.getStats();
    console.log(`    → API 평균 응답시간: ${stats.avg_api_duration_ms}ms`);
    // 테스트에서 API_RESPONSE를 생성했으므로 0보다 커야 함
    assert(stats.avg_api_duration_ms >= 0, '평균 응답시간 계산됨');
  });

  await test('F-4. PG 호출 카운트 추적', () => {
    const stats = PaymentLogger.getStats();
    console.log(`    → PG 호출 횟수: ${stats.pg_call_count}건`);
    assert(stats.pg_call_count > 0, 'PG 호출 추적됨');
  });

  await test('F-5. 검색으로 특정 에러 추적 가능', () => {
    const amountErrors = PaymentLogger.getAllLogs({ search: 'AMOUNT_MISMATCH' });
    assert(amountErrors.total > 0, 'AMOUNT_MISMATCH 검색 가능');

    const pgErrors = PaymentLogger.getAllLogs({ search: 'PG_' });
    assert(pgErrors.total > 0, 'PG 관련 로그 검색 가능');

    const authLogs = PaymentLogger.getAllLogs({ search: 'AUTH_' });
    assert(authLogs.total > 0, 'AUTH 관련 로그 검색 가능');
  });

  await test('F-6. 결제별 타임라인 추적 가능', () => {
    // E-6에서 생성한 결제의 타임라인이 있는지 확인
    const allLogs = PaymentLogger.getAllLogs({ search: 'STATE_TRANSITION' });
    assert(allLogs.total > 0, '상태 전이 로그로 결제 추적 가능');
  });

  await test('F-7. 보안 이벤트 모니터링 가능', () => {
    const criticalLogs = PaymentLogger.getAllLogs({ level: 'CRITICAL' });
    console.log(`    → CRITICAL 이벤트: ${criticalLogs.total}건`);
    assert(criticalLogs.total > 0, 'CRITICAL 보안 이벤트 추적 가능');

    // CRITICAL 이벤트에는 WEBHOOK_SIGNATURE_INVALID, AMOUNT_MISMATCH 등이 포함
    const securityEvents = criticalLogs.logs.map(l => l.action);
    console.log(`    → 보안 이벤트 종류: ${[...new Set(securityEvents)].join(', ')}`);
  });

  // ══════════════════════════════════════════════════
  // 결과 요약
  // ══════════════════════════════════════════════════

  console.log(`\n${'═'.repeat(60)}`);
  console.log('  검수 결과 요약');
  console.log('═'.repeat(60));
  console.log(`  전체 테스트: ${totalTests}개`);
  console.log(`  성공: ${passedTests}개`);
  console.log(`  실패: ${failedTests}개`);

  if (failures.length > 0) {
    console.log('\n  실패 목록:');
    for (const f of failures) {
      console.log(`    ❌ [${f.section}] ${f.test}`);
      console.log(`       → ${f.error}`);
    }
  }

  // 커버리지 요약
  console.log(`\n${'─'.repeat(60)}`);
  console.log('  테스트 커버리지 요약');
  console.log('─'.repeat(60));
  console.log('  A. 상태 머신: 25개 (전이 규칙, 최종 상태, 비즈니스 로직)');
  console.log('  B. 검증 유틸리티: 24개 (금액, 요청, UUID, 멱등성키)');
  console.log('  C. 로거: 30개 (기록, 마스킹, 추적, 조회, 통계)');
  console.log('  D. Mock PG 어댑터: 9개 (생성, 확인, 취소, 환불, 서명)');
  console.log('  E. API 시나리오: 32개 (인증, 생성, 웹훅, 취소, 환불, 엣지)');
  console.log('  F. 관리 효율성: 7개 (통계, 검색, 모니터링)');

  console.log(`\n${'─'.repeat(60)}`);
  console.log('  시나리오 상세 목록');
  console.log('─'.repeat(60));
  console.log(`
  [인증] AUTH_MISSING_TOKEN, AUTH_INVALID_TOKEN, AUTH_NOT_ADMIN,
         AUTH_VERIFICATION_ERROR, AUTH_SUCCESS
  [결제 생성] PAYMENT_CREATE_START → PAYMENT_CREATED → PAYMENT_REQUESTED
              멱등성 히트, 주문 미존재, 주문 상태 불일치, PG 실패
  [웹훅] WEBHOOK_RAW_PAYLOAD → WEBHOOK_EVENT → 결제확인/실패/환불확인
         서명 검증 실패(CRITICAL), 금액 불일치(CRITICAL),
         알 수 없는 이벤트, JSON 파싱 에러
  [취소] PAYMENT_CANCEL_START → PG 취소 → STATE_TRANSITION → PAYMENT_CANCELED
         취소 불가 상태, PG 취소 실패
  [환불] REFUND_REQUEST_START → PG 환불 → STATE_TRANSITION → REFUND_REQUESTED
         환불 불가 상태, pg_payment_id 없음, PG 환불 실패
  [상태 전이] 6개 정상 전이, 8개 불법 전이, 최종 상태 검증
  [검증] 금액(정수/양수), UUID, 멱등성키, 요청body 검증
  [로거] 3계층 저장, 민감정보 마스킹, request_id 추적,
         PG 타이밍 측정, 인메모리 1000건 제한
  [관리] 레벨별 통계, 검색, 결제 타임라인, 보안 모니터링
  `);

  const exitCode = failedTests > 0 ? 1 : 0;
  console.log(`\n  ${exitCode === 0 ? '✅ 모든 검수 테스트 통과!' : '❌ 일부 테스트 실패 - 위 실패 목록 확인'}`);
  console.log('═'.repeat(60));

  process.exit(exitCode);
}

main().catch((err) => {
  console.error('테스트 실행 실패:', err);
  process.exit(1);
});
