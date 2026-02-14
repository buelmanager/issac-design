import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import AuthGuard from './guards/AuthGuard';
import AdminLayout from './layout/AdminLayout';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ProductListPage = lazy(() => import('./pages/ProductListPage'));
const ProductEditPage = lazy(() => import('./pages/ProductEditPage'));
const CategoryListPage = lazy(() => import('./pages/CategoryListPage'));
const PortfolioListPage = lazy(() => import('./pages/PortfolioListPage'));
const PortfolioEditPage = lazy(() => import('./pages/PortfolioEditPage'));
const FaqPage = lazy(() => import('./pages/FaqPage'));
const LandingPage = lazy(() => import('./pages/LandingPage'));
const ShopSettingsPage = lazy(() => import('./pages/ShopSettingsPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const BlogListPage = lazy(() => import('./pages/BlogListPage'));
const BlogEditPage = lazy(() => import('./pages/BlogEditPage'));
const QuotesPage = lazy(() => import('./pages/QuotesPage'));
const InquiriesPage = lazy(() => import('./pages/InquiriesPage'));
const SimulatorSettingsPage = lazy(() => import('./pages/SimulatorSettingsPage'));
const SiteSettingsPage = lazy(() => import('./pages/SiteSettingsPage'));

const PaymentsPage = lazy(() => import('./pages/PaymentsPage'));
const MembersPage = lazy(() => import('./pages/MembersPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

function SuspenseFallback() {
  return (
    <div className="admin-spinner admin-spinner-fullpage" />
  );
}

export default function AdminRouter() {
  return (
    <Suspense fallback={<SuspenseFallback />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<AuthGuard />}>
          <Route element={<AdminLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="/products" element={<ProductListPage />} />
            <Route path="/products/:id" element={<ProductEditPage />} />
            <Route path="/categories" element={<CategoryListPage />} />
            <Route path="/portfolio" element={<PortfolioListPage />} />
            <Route path="/portfolio/:id" element={<PortfolioEditPage />} />
            <Route path="/faq" element={<FaqPage />} />
            <Route path="/landing" element={<LandingPage />} />
            <Route path="/shop-settings" element={<ShopSettingsPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/blog" element={<BlogListPage />} />
            <Route path="/blog/:id" element={<BlogEditPage />} />
            <Route path="/quotes" element={<QuotesPage />} />
            <Route path="/inquiries" element={<InquiriesPage />} />
            <Route path="/simulator" element={<SimulatorSettingsPage />} />
            <Route path="/settings" element={<SiteSettingsPage />} />

            <Route path="/payments" element={<PaymentsPage />} />
            <Route path="/members" element={<MembersPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}
