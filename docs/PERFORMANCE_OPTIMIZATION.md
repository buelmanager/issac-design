# Performance Optimization Guide

This document outlines the performance optimizations implemented and recommended for the issac.design website.

## ✅ Implemented Optimizations

### 1. Layout & Core Web Vitals

**Layout.astro Improvements:**
- Added `dns-prefetch` and `preconnect` for external resources
- Implemented proper resource hints for faster loading
- Added viewport-fit=cover for better mobile display
- Theme color meta tag for browser UI integration
- Canonical URLs for better SEO
- Structured data (Schema.org) for rich search results

### 2. Accessibility (WCAG AA Compliance)

**Implemented Features:**
- Skip-to-content link for keyboard navigation
- `main` landmark with `id="main-content"` on all pages
- Focus-visible styles for keyboard users
- Respects `prefers-reduced-motion` preference
- Proper ARIA labels on interactive elements
- Color contrast ratios meet WCAG AA standards

### 3. Mobile Optimization

**Smooth Scroll Performance:**
- Reduced Lenis animation duration on mobile (0.8s vs 1.2s desktop)
- Disabled smooth wheel on mobile for better performance
- Adjusted touch multiplier for mobile gestures
- Completely disabled animations when `prefers-reduced-motion` is set

### 4. Component-Level Optimizations

**New Components:**
- `ScrollProgress.astro`: RAF-throttled scroll tracking
- `QuoteFloatingButton.astro`: Optimized visibility detection
- All components respect `prefers-reduced-motion`

## 🎯 Recommended Next Steps

### Phase 10.1: Performance Optimization

#### A. Image Optimization

**Current Status:** Using standard JPG/PNG images
**Recommended Actions:**

1. **Convert to Modern Formats:**
```bash
# Install sharp for image optimization
npm install -D sharp

# Create optimization script
node scripts/optimize-images.js
```

2. **Implement Responsive Images:**
```astro
<picture>
  <source
    type="image/avif"
    srcset="/images/hero-sm.avif 640w, /images/hero-md.avif 1024w, /images/hero-lg.avif 1920w"
    sizes="100vw"
  />
  <source
    type="image/webp"
    srcset="/images/hero-sm.webp 640w, /images/hero-md.webp 1024w, /images/hero-lg.webp 1920w"
    sizes="100vw"
  />
  <img
    src="/images/hero-lg.jpg"
    alt="Description"
    loading="lazy"
    decoding="async"
  />
</picture>
```

3. **Add Image Component:**
Create `src/components/ui/OptimizedImage.astro`:
```astro
---
interface Props {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  loading?: 'lazy' | 'eager';
}
---
```

#### B. Video Optimization

**Current:** hero1.mp4, hero2.mp4, hero3.mp4, hero4.mp4

**Recommended Actions:**

1. **Compress Videos:**
```bash
# Install ffmpeg
brew install ffmpeg  # macOS
# or use apt-get on Linux

# Compress video with H.264 (better compatibility)
ffmpeg -i input.mp4 -vcodec h264 -crf 28 -preset slow -vf "scale=1920:-1" output.mp4

# Create WebM version for better compression
ffmpeg -i input.mp4 -c:v libvpx-vp9 -crf 30 -b:v 0 output.webm
```

2. **Add Multiple Sources:**
```astro
<video autoplay muted loop playsinline>
  <source src="/videos/hero1.webm" type="video/webm" />
  <source src="/videos/hero1.mp4" type="video/mp4" />
</video>
```

3. **Target Video Sizes:**
- Desktop: 1920x1080, 2-4 MB max
- Mobile: 1280x720, 1-2 MB max
- Use `preload="none"` or `preload="metadata"` for better initial load

#### C. Code Splitting & Lazy Loading

1. **Lazy Load Images:**
```astro
<img src="..." loading="lazy" decoding="async" />
```

2. **Dynamic Imports for Heavy Scripts:**
```astro
<script>
  // Load GSAP animations only when needed
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(async (entry) => {
      if (entry.isIntersecting) {
        const { default: animateSection } = await import('./animations.js');
        animateSection(entry.target);
        observer.unobserve(entry.target);
      }
    });
  });
</script>
```

3. **Defer Non-Critical Scripts:**
```astro
<script defer src="/scripts/analytics.js"></script>
```

#### D. Font Optimization

**Current:** Google Fonts via CDN

**Recommended Actions:**

1. **Self-Host Fonts:**
```bash
# Download fonts
npx google-webfonts-helper

# Add to project
/public/fonts/inter-v12-latin-regular.woff2
/public/fonts/dm-sans-v11-latin-regular.woff2
```

2. **Update global.css:**
```css
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('/fonts/inter-v12-latin-regular.woff2') format('woff2');
}
```

3. **Subset Fonts (Korean + Latin only):**
```bash
pyftsubset Inter-Regular.ttf \
  --unicodes=U+0000-00FF,U+AC00-D7A3 \
  --output-file=Inter-Regular-subset.woff2 \
  --flavor=woff2
```

#### E. CSS Optimization

1. **Critical CSS Inline:**
```astro
<style is:inline>
  /* Critical above-the-fold styles */
  body { margin: 0; background: #1A1A1A; }
  .hero { min-height: 100vh; }
</style>
```

2. **Minimize CSS:**
- Astro automatically minifies in production
- Ensure `vite.build.minify: true` in astro.config.mjs

3. **Remove Unused CSS:**
```bash
npm install -D @fullhuman/postcss-purgecss
```

#### F. JavaScript Optimization

1. **Tree Shaking:**
- Import only needed GSAP plugins
- Use named imports: `import { gsap } from 'gsap'`

2. **Bundle Analysis:**
```bash
npm install -D rollup-plugin-visualizer
```

Add to `astro.config.mjs`:
```js
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  vite: {
    plugins: [visualizer({ open: true })],
  },
});
```

### Phase 10.2: SEO & Monitoring

#### A. Sitemap Generation

**Create `public/robots.txt`:**
```
User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/

Sitemap: https://issac.design/sitemap.xml
```

**Enable Sitemap in Astro:**
```bash
npm install @astrojs/sitemap
```

```js
// astro.config.mjs
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://issac.design',
  integrations: [sitemap()],
});
```

#### B. Analytics & Monitoring

1. **Web Vitals Monitoring:**
```astro
<script>
  import { onCLS, onFID, onLCP, onFCP, onTTFB } from 'web-vitals';

  function sendToAnalytics({ name, value, id }) {
    // Send to your analytics service
    console.log({ name, value, id });
  }

  onCLS(sendToAnalytics);
  onFID(sendToAnalytics);
  onLCP(sendToAnalytics);
  onFCP(sendToAnalytics);
  onTTFB(sendToAnalytics);
</script>
```

2. **Error Tracking:**
```bash
npm install @sentry/astro
```

### Phase 10.3: Deployment Checklist

#### Vercel Deployment (Recommended)

1. **Install Vercel CLI:**
```bash
npm i -g vercel
vercel login
```

2. **Configure `vercel.json`:**
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "astro",
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        },
        {
          "key": "Permissions-Policy",
          "value": "camera=(), microphone=(), geolocation=()"
        }
      ]
    },
    {
      "source": "/fonts/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    },
    {
      "source": "/(.*).(?:jpg|jpeg|png|gif|webp|avif|svg|ico)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ]
}
```

3. **Environment Variables:**
- Set in Vercel Dashboard:
  - `PUBLIC_SITE_URL=https://issac.design`
  - `SUPABASE_URL=...` (if using)
  - `SUPABASE_ANON_KEY=...` (if using)

4. **Deploy:**
```bash
vercel --prod
```

#### Performance Targets

**Lighthouse Scores (Target: 90+)**
- Performance: 90+
- Accessibility: 95+
- Best Practices: 95+
- SEO: 100

**Core Web Vitals**
- LCP (Largest Contentful Paint): < 2.5s
- FID (First Input Delay): < 100ms
- CLS (Cumulative Layout Shift): < 0.1
- FCP (First Contentful Paint): < 1.8s
- TTFB (Time to First Byte): < 0.8s

## Testing Commands

```bash
# Run Lighthouse
npx lighthouse https://issac.design --view

# Test mobile performance
npx lighthouse https://issac.design --emulated-form-factor=mobile --view

# Check accessibility
npm run a11y

# Run bundle analysis
npm run analyze
```

## Monitoring Tools

1. **Google PageSpeed Insights:** https://pagespeed.web.dev/
2. **WebPageTest:** https://www.webpagetest.org/
3. **Chrome DevTools Performance Tab**
4. **Lighthouse CI** for continuous monitoring

## Progressive Enhancement Checklist

- [x] Site works without JavaScript
- [x] Critical content visible without CSS
- [x] Images have alt text
- [x] Forms have labels
- [x] Links have meaningful text
- [x] Color contrast meets WCAG AA
- [x] Keyboard navigation works
- [x] Screen reader compatible
- [x] Mobile-friendly
- [x] Respects user preferences (reduced motion, prefers-color-scheme)

## Conclusion

This guide provides a comprehensive roadmap for optimizing the issac.design website. Implement these recommendations progressively, measuring impact at each stage with Lighthouse and real user monitoring.

**Priority Order:**
1. Image optimization (biggest impact)
2. Video compression (bandwidth savings)
3. Font optimization (render performance)
4. Code splitting (initial load time)
5. Analytics & monitoring (ongoing optimization)
