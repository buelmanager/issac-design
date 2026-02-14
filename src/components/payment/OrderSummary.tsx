// ─── Types ───

interface OrderItem {
  name: string;
  quantity: number;
  unitPrice: number;
  options?: Record<string, string>;
}

interface OrderSummaryProps {
  items: OrderItem[];
  totalAmount: number;
}

// ─── Helpers ───

function formatWon(value: number): string {
  return value.toLocaleString('ko-KR') + '원';
}

// ─── Component ───

export default function OrderSummary({ items, totalAmount }: OrderSummaryProps) {
  return (
    <div className="order-summary">
      <h3 className="order-summary__title">주문 내역</h3>

      <ul className="order-summary__list">
        {items.map((item, index) => (
          <li key={index} className="order-summary__item">
            <div className="order-summary__item-info">
              <span className="order-summary__item-name">{item.name}</span>
              {item.options && Object.keys(item.options).length > 0 && (
                <div className="order-summary__item-options">
                  {Object.entries(item.options).map(([key, value]) => (
                    <span key={key} className="order-summary__option-tag">
                      {key}: {value}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="order-summary__item-detail">
              <span className="order-summary__item-qty">{item.quantity}개</span>
              <span className="order-summary__item-price">{formatWon(item.unitPrice * item.quantity)}</span>
            </div>
          </li>
        ))}
      </ul>

      <div className="order-summary__total">
        <span className="order-summary__total-label">총 결제 금액</span>
        <span className="order-summary__total-amount">{formatWon(totalAmount)}</span>
      </div>
    </div>
  );
}
