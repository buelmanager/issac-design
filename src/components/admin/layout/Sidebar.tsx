import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Tags,
  Image,
  HelpCircle,
  Globe,
  Store,
  Info,
  FileText,
  MessageSquare,
  Mail,
  Palette,
  Settings,
  X,
  CreditCard,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
}

const navItems: NavItem[] = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/products', label: 'Products', icon: Package },
  { path: '/categories', label: 'Categories', icon: Tags },
  { path: '/portfolio', label: 'Portfolio', icon: Image },
  { path: '/faq', label: 'FAQ', icon: HelpCircle },
  { path: '/landing', label: 'Landing Page', icon: Globe },
  { path: '/shop-settings', label: 'Shop Settings', icon: Store },
  { path: '/about', label: 'About Page', icon: Info },
  { path: '/blog', label: 'Blog', icon: FileText },
  { path: '/quotes', label: 'Quotes', icon: MessageSquare },
  { path: '/inquiries', label: 'Inquiries', icon: Mail },
  { path: '/payments', label: 'Payments', icon: CreditCard },
  { path: '/members', label: 'Members', icon: Users },
  { path: '/simulator', label: 'Simulator', icon: Palette },
  { path: '/settings', label: 'Settings', icon: Settings },

];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <>
      <div
        className={`admin-sidebar-overlay${open ? ' visible' : ''}`}
        onClick={onClose}
        role="presentation"
      />
      <aside className={`admin-sidebar${open ? ' open' : ''}`}>
        <div className="admin-sidebar-logo">
          <span className="admin-sidebar-logo-text">issac.design</span>
          <span className="admin-sidebar-badge">Admin</span>
          <button
            className="admin-hamburger"
            onClick={onClose}
            aria-label="Close sidebar"
            style={{ marginLeft: 'auto' }}
          >
            <X size={18} />
          </button>
        </div>

        <nav className="admin-sidebar-nav">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`admin-nav-item${isActive(item.path) ? ' active' : ''}`}
              onClick={onClose}
            >
              <item.icon className="admin-nav-icon" size={18} />
              <span className="admin-nav-label">{item.label}</span>
            </Link>
          ))}
        </nav>
      </aside>
    </>
  );
}
