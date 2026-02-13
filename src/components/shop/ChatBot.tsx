/**
 * ChatBot — React floating chat widget
 * Floating button + chat window with intent-based responses
 */
import { useState, useRef, useEffect, useCallback, type FormEvent } from 'react';
import {
  generateResponse,
  getWelcomeResponse,
  type ChatResponse,
  type ConversationContext,
  type ProductCard,
  type QuickReply,
} from '../../data/chatbot-data';

// =====================
// Types
// =====================
interface Message {
  id: string;
  role: 'bot' | 'user';
  text: string;
  productCards?: ProductCard[];
  actionButtons?: ChatResponse['actionButtons'];
  quickReplies?: QuickReply[];
  timestamp: number;
}

const STORAGE_KEY = 'issac-chatbot-messages';
const STORAGE_CTX_KEY = 'issac-chatbot-context';

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// =====================
// Sub-components
// =====================
function TypingIndicator() {
  return (
    <div className="cb-msg cb-msg--bot">
      <div className="cb-msg__bubble cb-msg__bubble--bot cb-typing">
        <span className="cb-typing__dot" />
        <span className="cb-typing__dot" />
        <span className="cb-typing__dot" />
      </div>
    </div>
  );
}

function ProductCardItem({ product }: { product: ProductCard }) {
  return (
    <a
      href={`/shop/${product.slug}`}
      className="cb-product-card"
      target="_blank"
      rel="noopener noreferrer"
    >
      <div className="cb-product-card__img">
        <img
          src={`${product.thumbnail}&w=120&q=60`}
          alt={product.name}
          loading="lazy"
          decoding="async"
          width="120"
          height="90"
        />
      </div>
      <div className="cb-product-card__info">
        <span className="cb-product-card__cat">{product.categoryName}</span>
        <span className="cb-product-card__name">{product.name}</span>
        <span className="cb-product-card__price">{product.priceRange}</span>
      </div>
    </a>
  );
}

function ActionButton({ btn }: { btn: NonNullable<ChatResponse['actionButtons']>[number] }) {
  return (
    <a
      href={btn.href}
      className={`cb-action-btn cb-action-btn--${btn.type}`}
      target={btn.type === 'kakao' ? '_blank' : undefined}
      rel={btn.type === 'kakao' ? 'noopener noreferrer' : undefined}
    >
      {btn.type === 'tel' && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/>
        </svg>
      )}
      {btn.type === 'kakao' && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 3C6.48 3 2 6.58 2 10.94c0 2.8 1.86 5.27 4.66 6.67-.15.53-.54 1.91-.62 2.21-.1.37.14.37.29.27.12-.08 1.84-1.22 2.59-1.72.7.1 1.41.16 2.08.16 5.52 0 10-3.58 10-7.94S17.52 3 12 3z" />
        </svg>
      )}
      {btn.label}
    </a>
  );
}

function formatBotText(text: string) {
  // Simple markdown-like formatting: **bold**, \n → <br>
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    // Handle newlines
    const lines = part.split('\n');
    return lines.map((line, j) => (
      <span key={`${i}-${j}`}>
        {j > 0 && <br />}
        {line}
      </span>
    ));
  });
}

// =====================
// Main ChatBot Component
// =====================
export default function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [context, setContext] = useState<ConversationContext>({
    lastIntent: null,
    interestedCategory: null,
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const initialized = useRef(false);

  // Load saved messages
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const savedCtx = localStorage.getItem(STORAGE_CTX_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Message[];
        if (parsed.length > 0) {
          setMessages(parsed);
          if (savedCtx) setContext(JSON.parse(savedCtx));
          return;
        }
      }
    } catch { /* ignore */ }

    // No saved messages — add welcome on first open
  }, []);

  // Save messages to localStorage
  useEffect(() => {
    if (messages.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
        localStorage.setItem(STORAGE_CTX_KEY, JSON.stringify(context));
      } catch { /* ignore */ }
    }
  }, [messages, context]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  // Listen for custom open-chatbot event (from KakaoFloat + ShopHero)
  useEffect(() => {
    function handleOpen() {
      setIsOpen(true);
      // Add welcome message if none exist
      setMessages((prev) => {
        if (prev.length === 0) {
          const welcome = getWelcomeResponse();
          return [{
            id: generateId(),
            role: 'bot' as const,
            text: welcome.text,
            quickReplies: welcome.quickReplies,
            timestamp: Date.now(),
          }];
        }
        return prev;
      });
    }
    window.addEventListener('open-chatbot', handleOpen);
    return () => window.removeEventListener('open-chatbot', handleOpen);
  }, []);

  // Lock body scroll when chatbot is open (mobile full-screen)
  useEffect(() => {
    if (isOpen) {
      const scrollY = window.scrollY;
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      return () => {
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [isOpen]);

  // ESC to close
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const addBotResponse = useCallback(
    (response: ChatResponse) => {
      const delay = 300 + Math.random() * 500;
      setIsTyping(true);

      setTimeout(() => {
        setIsTyping(false);
        const botMsg: Message = {
          id: generateId(),
          role: 'bot',
          text: response.text,
          productCards: response.productCards,
          actionButtons: response.actionButtons,
          quickReplies: response.quickReplies,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, botMsg]);
        setContext((prev) => ({
          ...prev,
          lastIntent: response.intent,
          interestedCategory:
            response.intent === 'product' && response.productCards?.[0]
              ? response.productCards[0].category
              : prev.interestedCategory,
        }));
      }, delay);
    },
    [],
  );

  const handleSend = useCallback(
    (text: string) => {
      if (!text.trim()) return;

      const userMsg: Message = {
        id: generateId(),
        role: 'user',
        text: text.trim(),
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setInputValue('');

      const response = generateResponse(text, context);
      addBotResponse(response);
    },
    [context, addBotResponse],
  );

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      handleSend(inputValue);
    },
    [inputValue, handleSend],
  );

  const handleQuickReply = useCallback(
    (qr: QuickReply) => {
      handleSend(qr.value);
    },
    [handleSend],
  );

  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <>
      {/* Chat Window */}
      {isOpen && (
        <div className="cb-window" role="dialog" aria-label="AI 상담 채팅">
          {/* Header */}
          <div className="cb-header">
            <div className="cb-header__info">
              <div className="cb-header__avatar">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                </svg>
              </div>
              <div>
                <div className="cb-header__title">issac.design 상담봇</div>
                <div className="cb-header__status">온라인</div>
              </div>
            </div>
            <button
              className="cb-header__close"
              onClick={() => setIsOpen(false)}
              aria-label="채팅 닫기"
              type="button"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="cb-messages">
            {messages.map((msg) => (
              <div key={msg.id}>
                <div className={`cb-msg cb-msg--${msg.role}`}>
                  <div className={`cb-msg__bubble cb-msg__bubble--${msg.role}`}>
                    {msg.role === 'bot' ? formatBotText(msg.text) : msg.text}
                  </div>
                </div>

                {/* Product Cards */}
                {msg.productCards && msg.productCards.length > 0 && (
                  <div className="cb-products">
                    {msg.productCards.map((p) => (
                      <ProductCardItem key={p.id} product={p} />
                    ))}
                  </div>
                )}

                {/* Action Buttons */}
                {msg.actionButtons && msg.actionButtons.length > 0 && (
                  <div className="cb-actions">
                    {msg.actionButtons.map((btn, i) => (
                      <ActionButton key={i} btn={btn} />
                    ))}
                  </div>
                )}

                {/* Quick Replies (only show on last bot message) */}
                {msg.role === 'bot' &&
                  msg.quickReplies &&
                  msg.id === messages.filter((m) => m.role === 'bot').at(-1)?.id && (
                    <div className="cb-quick-replies">
                      {msg.quickReplies.map((qr, i) => (
                        <button
                          key={i}
                          className="cb-quick-reply"
                          onClick={() => handleQuickReply(qr)}
                          type="button"
                        >
                          {qr.label}
                        </button>
                      ))}
                    </div>
                  )}
              </div>
            ))}

            {isTyping && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form className="cb-input" onSubmit={handleSubmit}>
            <input
              ref={inputRef}
              type="text"
              className="cb-input__field"
              placeholder="궁금한 점을 물어보세요..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              disabled={isTyping}
            />
            <button
              className="cb-input__send"
              type="submit"
              disabled={!inputValue.trim() || isTyping}
              aria-label="메시지 전송"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
            </button>
          </form>
        </div>
      )}

      <style>{`
        /* ==================
           Chat Window
           ================== */
        .cb-window {
          position: fixed;
          bottom: 24px;
          right: 24px;
          z-index: 1100;
          width: 400px;
          height: 600px;
          max-height: calc(100vh - 48px);
          display: flex;
          flex-direction: column;
          background: rgba(26, 26, 26, 0.97);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(76, 175, 80, 0.2);
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
          animation: ${reducedMotion ? 'none' : 'cbSlideUp 0.3s ease'};
        }

        @keyframes cbSlideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        /* Header */
        .cb-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          background: rgba(26, 77, 46, 0.3);
          border-bottom: 1px solid rgba(76, 175, 80, 0.15);
        }

        .cb-header__info {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .cb-header__avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: linear-gradient(135deg, #1a4d2e, #4caf50);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
        }

        .cb-header__title {
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          font-weight: 600;
          color: #fff;
        }

        .cb-header__status {
          font-size: 11px;
          color: #4caf50;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .cb-header__status::before {
          content: '';
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #4caf50;
          display: inline-block;
        }

        .cb-header__close {
          background: none;
          border: none;
          color: rgba(255, 255, 255, 0.6);
          cursor: pointer;
          padding: 4px;
          border-radius: 8px;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .cb-header__close:hover {
          color: #fff;
          background: rgba(255, 255, 255, 0.1);
        }

        /* Messages Area */
        .cb-messages {
          flex: 1;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior: contain;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .cb-messages::-webkit-scrollbar {
          width: 4px;
        }

        .cb-messages::-webkit-scrollbar-track {
          background: transparent;
        }

        .cb-messages::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 2px;
        }

        /* Message Bubbles */
        .cb-msg {
          display: flex;
          margin-bottom: 4px;
        }

        .cb-msg--bot {
          justify-content: flex-start;
        }

        .cb-msg--user {
          justify-content: flex-end;
        }

        .cb-msg__bubble {
          max-width: 85%;
          padding: 10px 14px;
          font-size: 13px;
          line-height: 1.55;
          word-break: keep-all;
          overflow-wrap: break-word;
        }

        .cb-msg__bubble--bot {
          background: rgba(26, 77, 46, 0.15);
          border: 1px solid rgba(76, 175, 80, 0.12);
          border-radius: 16px 16px 16px 4px;
          color: rgba(255, 255, 255, 0.92);
        }

        .cb-msg__bubble--bot strong {
          color: #4caf50;
          font-weight: 600;
        }

        .cb-msg__bubble--user {
          background: rgba(76, 175, 80, 0.9);
          border-radius: 16px 16px 4px 16px;
          color: #fff;
        }

        /* Typing Indicator */
        .cb-typing {
          display: flex;
          gap: 4px;
          padding: 12px 18px;
        }

        .cb-typing__dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: rgba(76, 175, 80, 0.5);
          animation: ${reducedMotion ? 'none' : 'cbTypingBounce 1.4s ease-in-out infinite'};
        }

        .cb-typing__dot:nth-child(2) { animation-delay: 0.2s; }
        .cb-typing__dot:nth-child(3) { animation-delay: 0.4s; }

        @keyframes cbTypingBounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-6px); opacity: 1; }
        }

        /* Product Cards */
        .cb-products {
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding: 0 0 4px 0;
          margin-bottom: 4px;
        }

        .cb-product-card {
          display: flex;
          gap: 10px;
          padding: 8px 10px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 10px;
          text-decoration: none;
          transition: all 0.2s;
          cursor: pointer;
        }

        .cb-product-card:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(76, 175, 80, 0.3);
        }

        .cb-product-card__img {
          width: 60px;
          height: 45px;
          border-radius: 6px;
          overflow: hidden;
          flex-shrink: 0;
        }

        .cb-product-card__img img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .cb-product-card__info {
          display: flex;
          flex-direction: column;
          gap: 1px;
          min-width: 0;
        }

        .cb-product-card__cat {
          font-size: 10px;
          color: #4caf50;
          font-weight: 600;
          letter-spacing: 0.03em;
        }

        .cb-product-card__name {
          font-size: 12px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.9);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .cb-product-card__price {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.5);
        }

        /* Action Buttons */
        .cb-actions {
          display: flex;
          gap: 8px;
          padding: 4px 0;
          margin-bottom: 4px;
        }

        .cb-action-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          font-size: 12px;
          font-weight: 500;
          border-radius: 20px;
          text-decoration: none;
          transition: all 0.2s;
          cursor: pointer;
        }

        .cb-action-btn--tel {
          background: rgba(76, 175, 80, 0.15);
          color: #4caf50;
          border: 1px solid rgba(76, 175, 80, 0.3);
        }

        .cb-action-btn--tel:hover {
          background: rgba(76, 175, 80, 0.25);
        }

        .cb-action-btn--kakao {
          background: rgba(254, 229, 0, 0.12);
          color: #fee500;
          border: 1px solid rgba(254, 229, 0, 0.25);
        }

        .cb-action-btn--kakao:hover {
          background: rgba(254, 229, 0, 0.2);
        }

        /* Quick Replies */
        .cb-quick-replies {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          padding: 4px 0 8px;
        }

        .cb-quick-reply {
          padding: 6px 14px;
          font-size: 12px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.8);
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        }

        .cb-quick-reply:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(76, 175, 80, 0.4);
          color: #4caf50;
        }

        /* Input Area */
        .cb-input {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(0, 0, 0, 0.2);
        }

        .cb-input__field {
          flex: 1;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 10px 14px;
          font-size: 13px;
          color: #fff;
          outline: none;
          transition: border-color 0.2s;
          font-family: 'Inter', sans-serif;
        }

        .cb-input__field::placeholder {
          color: rgba(255, 255, 255, 0.35);
        }

        .cb-input__field:focus {
          border-color: rgba(76, 175, 80, 0.4);
        }

        .cb-input__field:disabled {
          opacity: 0.5;
        }

        .cb-input__send {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          background: rgba(76, 175, 80, 0.9);
          color: #fff;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          flex-shrink: 0;
        }

        .cb-input__send:hover:not(:disabled) {
          background: #4caf50;
        }

        .cb-input__send:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        /* ==================
           Mobile — Full Screen
           ================== */
        @media (max-width: 720px) {
          .cb-window {
            inset: 0;
            width: 100%;
            height: 100%;
            max-height: 100%;
            border-radius: 0;
            border: none;
          }
        }

        /* ==================
           Reduced Motion
           ================== */
        @media (prefers-reduced-motion: reduce) {
          .cb-widget,
          .cb-window,
          .cb-quick-reply,
          .cb-product-card,
          .cb-action-btn,
          .cb-header__close {
            transition: none !important;
            animation: none !important;
          }

          .cb-typing__dot {
            animation: none !important;
            opacity: 0.5;
          }
        }
      `}</style>
    </>
  );
}
