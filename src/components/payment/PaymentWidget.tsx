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
  renderPaymentMethods: (opts: { selector: string; variantKey?: string }) => Promise<void>;
  renderAgreement: (opts: { selector: string; variantKey?: string }) => Promise<void>;
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
    TossPayments: (clientKey: string) => TossPayments;
    loadTossPayments?: (clientKey: string) => Promise<TossPayments>;
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
  const paymentMethodsRef = useRef<HTMLDivElement>(null);
  const agreementRef = useRef<HTMLDivElement>(null);

  // ─── SDK Load & Init ───

  useEffect(() => {
    console.log('[PaymentWidget] useEffect triggered', { amount, initialized: initializedRef.current });
    if (initializedRef.current) {
      console.log('[PaymentWidget] Already initialized, skipping');
      return;
    }
    initializedRef.current = true;

    const initPayment = async () => {
      console.log('[PaymentWidget] initPayment START');
      console.log('[PaymentWidget] Props:', { orderId, orderName, amount, customerName, customerEmail });
      try {
        const clientKey = window.__TOSS_CLIENT_KEY__;
        console.log('[PaymentWidget] clientKey:', clientKey ? `${clientKey.substring(0, 15)}...` : 'MISSING');
        if (!clientKey) {
          setError('결제 설정을 불러올 수 없습니다.');
          setLoading(false);
          return;
        }

        console.log('[PaymentWidget] window.TossPayments exists:', !!window.TossPayments);
        console.log('[PaymentWidget] typeof window.TossPayments:', typeof window.TossPayments);

        if (!window.TossPayments) {
          console.log('[PaymentWidget] Loading Toss SDK script...');
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://js.tosspayments.com/v2/standard';
            script.onload = () => {
              console.log('[PaymentWidget] SDK script loaded OK');
              console.log('[PaymentWidget] window.TossPayments after load:', typeof window.TossPayments);
              resolve();
            };
            script.onerror = (e) => {
              console.error('[PaymentWidget] SDK script FAILED', e);
              reject(new Error('SDK 로드 실패'));
            };
            document.head.appendChild(script);
          });
        }

        const elMethods = document.getElementById('payment-methods');
        const elAgreement = document.getElementById('payment-agreement');
        console.log('[PaymentWidget] DOM check BEFORE wait:', {
          methods: !!elMethods, methodsDisplay: elMethods?.style.display,
          agreement: !!elAgreement, agreementDisplay: elAgreement?.style.display,
        });

        if (!elMethods || !elAgreement) {
          console.log('[PaymentWidget] DOM not ready, waiting rAF...');
          await new Promise(resolve => requestAnimationFrame(resolve));
          console.log('[PaymentWidget] DOM check AFTER wait:', {
            methods: !!document.getElementById('payment-methods'),
            agreement: !!document.getElementById('payment-agreement'),
          });
        }

        console.log('[PaymentWidget] Calling TossPayments(clientKey)...');
        const tossPayments = window.TossPayments(clientKey);
        console.log('[PaymentWidget] tossPayments:', tossPayments);

        console.log('[PaymentWidget] Calling widgets({ customerKey: "ANONYMOUS" })...');
        const widgets = tossPayments.widgets({ customerKey: 'ANONYMOUS' });
        console.log('[PaymentWidget] widgets:', widgets);
        widgetsRef.current = widgets;

        console.log('[PaymentWidget] setAmount({ currency: "KRW", value:', amount, '})...');
        await widgets.setAmount({ currency: 'KRW', value: amount });
        console.log('[PaymentWidget] setAmount OK');

        console.log('[PaymentWidget] renderPaymentMethods({ selector: "#payment-methods" })...');
        await widgets.renderPaymentMethods({ selector: '#payment-methods', variantKey: 'DEFAULT' });
        console.log('[PaymentWidget] renderPaymentMethods OK');

        console.log('[PaymentWidget] renderAgreement({ selector: "#payment-agreement" })...');
        await widgets.renderAgreement({ selector: '#payment-agreement', variantKey: 'AGREEMENT' });
        console.log('[PaymentWidget] renderAgreement OK');

        console.log('[PaymentWidget] ALL INIT COMPLETE');
        setLoading(false);
      } catch (err) {
        console.error('[PaymentWidget] INIT ERROR:', err);
        if (err instanceof Error) {
          console.error('[PaymentWidget] message:', err.message);
          console.error('[PaymentWidget] stack:', err.stack);
        }
        const message = err instanceof Error ? err.message : '결제 위젯을 불러오는데 실패했습니다.';
        setError(message);
        setLoading(false);
      }
    };

    initPayment();
  }, [amount]);

  // ─── Request Payment ───

  const handlePayment = useCallback(async () => {
    console.log('[PaymentWidget] handlePayment called', { hasWidgets: !!widgetsRef.current, processing });
    if (!widgetsRef.current || processing) return;

    setProcessing(true);
    try {
      const origin = window.location.origin;
      const params = {
        orderId,
        orderName,
        successUrl: `${origin}/api/payment/confirm`,
        failUrl: `${origin}/api/payment/fail`,
        customerName,
        customerEmail,
      };
      console.log('[PaymentWidget] requestPayment params:', params);
      await widgetsRef.current.requestPayment(params);
      console.log('[PaymentWidget] requestPayment OK');
    } catch (err) {
      console.error('[PaymentWidget] requestPayment ERROR:', err);
      const message = err instanceof Error ? err.message : '결제 요청 중 오류가 발생했습니다.';
      setError(message);
      setProcessing(false);
    }
  }, [orderId, orderName, customerName, customerEmail, processing]);

  // ─── Render ───

  console.log('[PaymentWidget] Render:', { loading, error, processing });

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

      <div id="payment-methods" style={loading ? { visibility: 'hidden', height: 0, overflow: 'hidden' } : {}} />
      <div id="payment-agreement" style={loading ? { visibility: 'hidden', height: 0, overflow: 'hidden' } : {}} />

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
