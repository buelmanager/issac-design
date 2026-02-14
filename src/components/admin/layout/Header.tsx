import { useLocation, useNavigate } from 'react-router-dom';
import { LogOut, Menu } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/products': 'Products',
  '/categories': 'Categories',
  '/portfolio': 'Portfolio',
  '/faq': 'FAQ',
  '/landing': 'Landing Page',
  '/shop-settings': 'Shop Settings',
  '/about': 'About Page',
  '/blog': 'Blog',
  '/quotes': 'Quotes',
  '/inquiries': 'Inquiries',
  '/simulator': 'Simulator',
  '/settings': 'Settings',
};

interface HeaderProps {
  onToggleSidebar: () => void;
}

export default function Header({ onToggleSidebar }: HeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const getPageTitle = () => {
    const path = location.pathname;
    if (pageTitles[path]) return pageTitles[path];

    for (const [key, title] of Object.entries(pageTitles)) {
      if (key !== '/' && path.startsWith(key)) return title;
    }
    return 'Admin';
  };

  const handleSignOut = async () => {
    // 서버사이드 로그아웃 (쿠키 삭제 + 감사 로깅)
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // 서버 로그아웃 실패해도 클라이언트 세션은 정리
    }
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <header className="admin-header">
      <div className="admin-header-left">
        <button
          className="admin-hamburger"
          onClick={onToggleSidebar}
          aria-label="Toggle sidebar"
        >
          <Menu size={20} />
        </button>
        <div className="admin-breadcrumb">
          <span>{getPageTitle()}</span>
        </div>
      </div>
      <div className="admin-header-right">
        <span className="admin-header-user">{user?.email}</span>
        <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={handleSignOut}>
          <LogOut size={15} />
          로그아웃
        </button>
      </div>
    </header>
  );
}
