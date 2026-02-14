import { useState, useEffect, useRef, useCallback } from 'react';

// ─── Types ───

interface PaymentWidgetProps {
  orderId: string;
  orderName: string;
  amount: number;
  customerName: string;
  customerEmail?: string;
}

interface TossWidgets {
  setAmount: (opts: { currency: string; value: number }) => Promise<void>;
  renderPaymentMethods: (opts: { el: string; variantKey?: string }) => Promise<void>;
  renderAgreement: (opts: { el: string; variantKey?: string }) => Promise<void>;
  requestPayment: (opts: {
    orderId: string;
    orderName: string;
    successUrl: string;
    failUrl: string;
    customerName?: string;
    customerEmail?: string;
  }) => Promise<void>;
}

interface TossPayments {
  widgets: (opts: { customerKey: string }) => TossWidgets;
}

declare global {
  interface Window {
    __TOSS_CLIENT_KEY__?: string;
    loadTossPayments: (clientKey: string) => Promise<TossPayments>;
  }
}

// ─── Component ───

export default function PaymentWidget({
  orderId,
  orderName,
  amount,
  customerName,
  customerEmail,
}: PaymentWidgetProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const widgetsRef = useRef<TossWidgets | null>(null);
  const initializedRef = useRef(false);

  // ─── SDK Load & Init ───

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const initPayment = async () => {
      try {
        const clientKey = window.__TOSS_CLIENT_KEY__;
        if (!clientKey) {
          setError('결제 설정을 불러올 수 없습니다.');
          setLoading(false);
          return;
        }

        if (!window.loadTossPayments) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://js.tosspayments.com/v2/standard';
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('SDK 로드 실패'));
            document.head.appendChild(script);
          });
        }

        const tossPayments = await window.loadTossPayments(clientKey);
        const widgets = tossPayments.widgets({ customerKey: 'ANONYMOUS' });
        widgetsRef.current = widgets;

        await widgets.setAmount({ currency: 'KRW', value: amount });
        await widgets.renderPaymentMethods({ el: '#payment-methods', variantKey: 'DEFAULT' });
        await widgets.renderAgreement({ el: '#payment-agreement', variantKey: 'AGREEMENT' });

        setLoading(false);
      } catch (err) {
        const message = err instanceof Error ? err.message : '결제 위젯을 불러오는데 실패했습니다.';
        setError(message);
        setLoading(false);
      }
    };

    initPayment();
  }, [amount]);

  // ─── Request Payment ───

  const handlePayment = useCallback(async () => {
    if (!widgetsRef.current || processing) return;

    setProcessing(true);
    try {
      const origin = window.location.origin;
      await widgetsRef.current.requestPayment({
        orderId,
        orderName,
        successUrl: `${origin}/api/payment/confirm`,
        failUrl: `${origin}/api/payment/fail`,
        customerName,
        customerEmail,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : '결제 요청 중 오류가 발생했습니다.';
      setError(message);
      setProcessing(false);
    }
  }, [orderId, orderName, customerName, customerEmail, processing]);

  // ─── Render ───

  if (error) {
    return (
      <div className="payment-widget__error">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="2" />
          <path d="M16 10v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <circle cx="16" cy="22" r="1" fill="currentColor" />
        </svg>
        <p className="payment-widget__error-text">{error}</p>
        <button
          className="payment-widget__retry-btn"
          onClick={() => window.location.reload()}
          type="button"
        >
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="payment-widget">
      {loading && (
        <div className="payment-widget__loading">
          <div className="payment-widget__spinner" />
          <p className="payment-widget__loading-text">결제 수단을 불러오는 중...</p>
        </div>
      )}

      <div id="payment-methods" style={{ display: loading ? 'none' : 'block' }} />
      <div id="payment-agreement" style={{ display: loading ? 'none' : 'block' }} />

      {!loading && (
        <button
          className="payment-widget__submit-btn"
          onClick={handlePayment}
          disabled={processing}
          type="button"
        >
          {processing ? (
            <>
              <div className="payment-widget__btn-spinner" />
              처리 중...
            </>
          ) : (
            <>
              결제하기
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M14 2l-7 9-4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </>
          )}
        </button>
      )}
    </div>
  );
}
