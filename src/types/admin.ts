import type { Tables } from './database';

export type AdminUser = Tables<'admin_users'>;
export type SiteConfig = Tables<'site_config'>;
export type LandingSection = Tables<'landing_sections'>;
export type HeroSlide = Tables<'hero_slides'>;
export type ServiceItem = Tables<'service_items'>;
export type SignageType = Tables<'signage_types'>;
export type ClientProject = Tables<'client_projects'>;
export type ProjectFilterTab = Tables<'project_filter_tabs'>;
export type ProductCategory = Tables<'product_categories'>;
export type Product = Tables<'products'>;
export type PortfolioItem = Tables<'portfolio_items'>;
export type FaqCategory = Tables<'faq_categories'>;
export type FaqItem = Tables<'faq_items'>;
export type LandingFaq = Tables<'landing_faqs'>;
export type TrustIndicator = Tables<'trust_indicators'>;
export type ClientLogo = Tables<'client_logos'>;
export type AboutSection = Tables<'about_sections'>;
export type BlogPost = Tables<'blog_posts'>;
export type QuoteRequest = Tables<'quote_requests'>;
export type ContactInquiry = Tables<'contact_inquiries'>;
export type SimulatorConfig = Tables<'simulator_config'>;
export type PageContent = Tables<'page_contents'>;
export type NavigationItem = Tables<'navigation_items'>;
export type InquiryType = Tables<'inquiry_types'>;
export type Profile = Tables<'profiles'>;
export type Order = Tables<'orders'>;
export type Payment = Tables<'payments'>;

export type QuoteStatus = 'pending' | 'reviewing' | 'quoted' | 'completed' | 'cancelled';
export type InquiryStatus = 'new' | 'read' | 'replied' | 'closed';
export type MemberStatus = 'active' | 'suspended' | 'withdrawn';
export type MemberProvider = 'email' | 'google' | 'kakao';

export interface AdminRoute {
  path: string;
  label: string;
  icon: string;
  children?: AdminRoute[];
}

export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
}

export interface SortState {
  column: string;
  direction: 'asc' | 'desc';
}

export interface FilterState {
  [key: string]: string | boolean | number | undefined;
}
