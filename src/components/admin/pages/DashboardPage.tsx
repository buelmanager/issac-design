import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import type { QuoteRequest, ContactInquiry } from '../../../types/admin';
import { StatusBadge, LoadingSpinner } from '../ui';
import { Package, FileText, MessageSquare, BookOpen } from 'lucide-react';

interface DashboardStats {
  totalProducts: number;
  pendingQuotes: number;
  newInquiries: number;
  publishedPosts: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    pendingQuotes: 0,
    newInquiries: 0,
    publishedPosts: 0,
  });
  const [recentQuotes, setRecentQuotes] = useState<QuoteRequest[]>([]);
  const [recentInquiries, setRecentInquiries] = useState<ContactInquiry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);

    const [productsRes, pendingQuotesRes, newInquiriesRes, publishedPostsRes, quotesRes, inquiriesRes] =
      await Promise.all([
        supabase.from('products').select('id', { count: 'exact', head: true }),
        supabase.from('quote_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('contact_inquiries').select('id', { count: 'exact', head: true }).eq('status', 'new'),
        supabase.from('blog_posts').select('id', { count: 'exact', head: true }).eq('is_published', true),
        supabase.from('quote_requests').select('*').order('created_at', { ascending: false }).limit(5),
        supabase.from('contact_inquiries').select('*').order('created_at', { ascending: false }).limit(5),
      ]);

    setStats({
      totalProducts: productsRes.count ?? 0,
      pendingQuotes: pendingQuotesRes.count ?? 0,
      newInquiries: newInquiriesRes.count ?? 0,
      publishedPosts: publishedPostsRes.count ?? 0,
    });

    setRecentQuotes((quotesRes.data ?? []) as QuoteRequest[]);
    setRecentInquiries((inquiriesRes.data ?? []) as ContactInquiry[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) return <LoadingSpinner size="lg" />;

  const statCards = [
    { label: '전체 제품', value: stats.totalProducts, icon: <Package size={24} />, color: 'blue' },
    { label: '대기 견적', value: stats.pendingQuotes, icon: <FileText size={24} />, color: 'amber' },
    { label: '새 문의', value: stats.newInquiries, icon: <MessageSquare size={24} />, color: 'green' },
    { label: '게시된 블로그', value: stats.publishedPosts, icon: <BookOpen size={24} />, color: 'purple' },
  ];

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  }

  return (
    <div className="admin-page">
      <h1 className="admin-page-title">대시보드</h1>

      <div className="admin-dashboard-stats">
        {statCards.map((card) => (
          <div key={card.label} className="admin-stat-card">
            <div className={`admin-stat-icon admin-stat-icon-${card.color}`}>{card.icon}</div>
            <div className="admin-stat-number">{card.value}</div>
            <div className="admin-stat-label">{card.label}</div>
          </div>
        ))}
      </div>

      <div className="admin-dashboard-grid">
        <div className="admin-card">
          <h2 className="admin-card-title">최근 견적 요청</h2>
          {recentQuotes.length === 0 ? (
            <p className="admin-empty-text">견적 요청이 없습니다</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>고객명</th>
                  <th>업체명</th>
                  <th>상태</th>
                  <th>날짜</th>
                </tr>
              </thead>
              <tbody>
                {recentQuotes.map((q) => (
                  <tr key={q.id}>
                    <td>{q.customer_name}</td>
                    <td>{q.business_name ?? '-'}</td>
                    <td><StatusBadge status={q.status} /></td>
                    <td>{formatDate(q.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="admin-card">
          <h2 className="admin-card-title">최근 문의</h2>
          {recentInquiries.length === 0 ? (
            <p className="admin-empty-text">문의가 없습니다</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>이름</th>
                  <th>유형</th>
                  <th>상태</th>
                  <th>날짜</th>
                </tr>
              </thead>
              <tbody>
                {recentInquiries.map((inq) => (
                  <tr key={inq.id}>
                    <td>{inq.name}</td>
                    <td>{inq.inquiry_type ?? '-'}</td>
                    <td><StatusBadge status={inq.status} /></td>
                    <td>{formatDate(inq.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
