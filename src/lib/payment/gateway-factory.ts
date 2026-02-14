/**
 * PG 어댑터 팩토리 (싱글턴)
 *
 * 모든 API 엔드포인트가 동일한 인스턴스를 공유한다.
 * 환경변수로 PG사를 결정한다.
 */
import type { PaymentGateway } from './payment-gateway';
import { MockPaymentAdapter } from './adapters/mock-adapter';
import { TossPaymentAdapter } from './adapters/toss-adapter';
import { PaymentService } from './payment-service';

let gatewayInstance: PaymentGateway | null = null;
let serviceInstance: PaymentService | null = null;

function createGateway(): PaymentGateway {
  const provider = import.meta.env.PAYMENT_PROVIDER ?? 'mock';
  switch (provider) {
    case 'toss': return new TossPaymentAdapter();
    default: return new MockPaymentAdapter();
  }
}

export function getPaymentService(): { gateway: PaymentGateway; service: PaymentService } {
  if (!gatewayInstance) {
    gatewayInstance = createGateway();
  }
  if (!serviceInstance) {
    serviceInstance = new PaymentService(gatewayInstance);
  }
  return { gateway: gatewayInstance, service: serviceInstance };
}
