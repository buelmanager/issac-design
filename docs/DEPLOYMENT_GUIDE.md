# Deployment Guide - issac.design

Complete guide for deploying the issac.design website to production.

## 🚀 Pre-Deployment Checklist

### 1. Code Quality
- [ ] All tests passing
- [ ] No console errors or warnings
- [ ] All TODO comments addressed
- [ ] Code reviewed and approved
- [ ] Git history clean (no sensitive data)

### 2. Performance
- [ ] Images optimized (WebP/AVIF)
- [ ] Videos compressed
- [ ] Bundle size acceptable (< 500KB initial JS)
- [ ] Lighthouse score > 90
- [ ] Core Web Vitals passing

### 3. SEO
- [ ] Meta tags complete
- [ ] Open Graph images generated
- [ ] Sitemap generated
- [ ] robots.txt configured
- [ ] Schema.org markup verified

### 4. Accessibility
- [ ] Keyboard navigation tested
- [ ] Screen reader tested
- [ ] Color contrast verified
- [ ] Focus indicators visible
- [ ] ARIA labels complete

### 5. Security
- [ ] No API keys in client code
- [ ] Environment variables configured
- [ ] HTTPS enforced
- [ ] Security headers set
- [ ] Dependencies updated (no vulnerabilities)

### 6. Content
- [ ] All placeholder content replaced
- [ ] Images have proper alt text
- [ ] Contact information correct
- [ ] Legal pages complete (Privacy, Terms)
- [ ] 404 page styled

## 📦 Build Configuration

### Astro Config (astro.config.mjs)

```javascript
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://issac.design',
  integrations: [sitemap()],
  output: 'static',

  vite: {
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor': ['gsap', 'lenis'],
          },
        },
      },
    },
  },

  build: {
    inlineStylesheets: 'auto',
  },
});
```

### Environment Variables

Create `.env.production`:
```env
PUBLIC_SITE_URL=https://issac.design
PUBLIC_KAKAO_CHANNEL_URL=your_kakao_channel_url
PUBLIC_ANALYTICS_ID=your_analytics_id

# If using Supabase (Phase 6)
PUBLIC_SUPABASE_URL=your_supabase_url
PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

**⚠️ Important:** Never commit `.env` files to git!

Add to `.gitignore`:
```
.env
.env.local
.env.production
```

## 🎯 Deployment Options

### Option 1: Vercel (Recommended) ⭐

**Pros:**
- Zero configuration for Astro
- Automatic deployments from Git
- Edge network (CDN)
- Free SSL
- Preview deployments
- Analytics included

**Steps:**

1. **Install Vercel CLI:**
```bash
npm i -g vercel
```

2. **Login:**
```bash
vercel login
```

3. **Deploy:**
```bash
# Test deployment
vercel

# Production deployment
vercel --prod
```

4. **Configure via Dashboard:**
- Go to https://vercel.com/dashboard
- Add environment variables
- Configure custom domain
- Set up Git integration

**Vercel Configuration (vercel.json):**
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "astro",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/$1"
    }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
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
      "source": "/images/(.*)",
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

### Option 2: Netlify

**Pros:**
- Easy Git integration
- Form handling built-in
- Split testing
- Free SSL
- Good documentation

**Steps:**

1. **Install Netlify CLI:**
```bash
npm i -g netlify-cli
```

2. **Login:**
```bash
netlify login
```

3. **Initialize:**
```bash
netlify init
```

4. **Deploy:**
```bash
# Test deployment
netlify deploy

# Production deployment
netlify deploy --prod
```

**Netlify Configuration (netlify.toml):**
```toml
[build]
  command = "npm run build"
  publish = "dist"

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"

[[headers]]
  for = "/fonts/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/images/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[redirects]]
  from = "/shop"
  to = "/shop/index.html"
  status = 200
```

### Option 3: Cloudflare Pages

**Pros:**
- Global CDN
- Unlimited bandwidth
- Fast builds
- Free SSL
- Workers for edge functions

**Steps:**

1. Connect Git repository in Cloudflare Dashboard
2. Configure build settings:
   - Build command: `npm run build`
   - Build output: `dist`
   - Environment variables: Add from dashboard

### Option 4: Self-Hosted (VPS)

**For advanced users needing full control.**

**Requirements:**
- Ubuntu 22.04 LTS
- Nginx
- Node.js 18+
- SSL certificate (Let's Encrypt)

**Setup Steps:**

1. **Install Node.js:**
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

2. **Install Nginx:**
```bash
sudo apt update
sudo apt install nginx
```

3. **Clone and Build:**
```bash
git clone https://github.com/yourusername/issac-design.git
cd issac-design
npm install
npm run build
```

4. **Configure Nginx:**
```nginx
server {
    listen 80;
    server_name issac.design www.issac.design;

    root /var/www/issac-design/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Security headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
}
```

5. **Install SSL with Certbot:**
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d issac.design -d www.issac.design
```

## 🔐 SSL/HTTPS Configuration

### Vercel/Netlify/Cloudflare
- **Automatic:** SSL certificates are provisioned automatically
- Enforces HTTPS by default
- Automatic renewal

### Custom Domain Setup

1. **Add DNS Records:**
```
Type: A
Name: @
Value: [Provider IP or CNAME]

Type: CNAME
Name: www
Value: issac.design
```

2. **Wait for DNS Propagation:**
```bash
# Check DNS propagation
dig issac.design
nslookup issac.design
```

3. **Verify SSL:**
```bash
curl -I https://issac.design
```

## 📊 Post-Deployment Verification

### 1. Functional Testing
- [ ] Homepage loads correctly
- [ ] All navigation links work
- [ ] Shop pages display products
- [ ] Forms submit successfully
- [ ] Videos play properly
- [ ] Mobile layout correct

### 2. Performance Testing
```bash
# Run Lighthouse
npx lighthouse https://issac.design --view

# Check load time
curl -w "@curl-format.txt" -o /dev/null -s https://issac.design
```

**curl-format.txt:**
```
    time_namelookup:  %{time_namelookup}\n
       time_connect:  %{time_connect}\n
    time_appconnect:  %{time_appconnect}\n
   time_pretransfer:  %{time_pretransfer}\n
      time_redirect:  %{time_redirect}\n
 time_starttransfer:  %{time_starttransfer}\n
                    ----------\n
         time_total:  %{time_total}\n
```

### 3. SEO Testing
- [ ] Google Search Console verified
- [ ] Sitemap submitted
- [ ] robots.txt accessible
- [ ] Meta tags render correctly
- [ ] Open Graph preview working

**Test OG Tags:**
- Facebook Debugger: https://developers.facebook.com/tools/debug/
- Twitter Card Validator: https://cards-dev.twitter.com/validator
- LinkedIn Inspector: https://www.linkedin.com/post-inspector/

### 4. Analytics Setup

**Google Analytics 4:**
```astro
<!-- Add to Layout.astro head -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script is:inline>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>
```

**Google Tag Manager:**
```astro
<!-- Head -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-XXXXXXX');</script>

<!-- Body (immediately after opening tag) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-XXXXXXX"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
```

### 5. Monitoring Setup

**Uptime Monitoring:**
- UptimeRobot: https://uptimerobot.com/
- Pingdom: https://www.pingdom.com/
- StatusCake: https://www.statuscake.com/

**Error Tracking:**
```bash
# Install Sentry
npm install @sentry/astro

# Configure
```

```javascript
// src/sentry.config.ts
import * as Sentry from "@sentry/astro";

Sentry.init({
  dsn: "your-sentry-dsn",
  environment: import.meta.env.MODE,
  tracesSampleRate: 1.0,
});
```

## 🔄 Continuous Deployment

### GitHub Actions

Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy to Production

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build
        env:
          PUBLIC_SITE_URL: ${{ secrets.SITE_URL }}

      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
          vercel-args: '--prod'
```

## 📈 Performance Monitoring

### Real User Monitoring (RUM)

Add web-vitals tracking:
```bash
npm install web-vitals
```

```javascript
// src/scripts/vitals.js
import {onCLS, onFID, onLCP, onFCP, onTTFB} from 'web-vitals';

function sendToAnalytics(metric) {
  // Send to your analytics endpoint
  const body = JSON.stringify(metric);
  const url = '/api/vitals';

  if (navigator.sendBeacon) {
    navigator.sendBeacon(url, body);
  } else {
    fetch(url, {method: 'POST', body, keepalive: true});
  }
}

onCLS(sendToAnalytics);
onFID(sendToAnalytics);
onLCP(sendToAnalytics);
onFCP(sendToAnalytics);
onTTFB(sendToAnalytics);
```

## 🐛 Troubleshooting

### Common Issues

**1. Build Fails:**
```bash
# Clear cache and rebuild
rm -rf node_modules .astro dist
npm install
npm run build
```

**2. Videos Not Loading:**
- Check video paths are correct
- Verify MIME types configured
- Ensure videos compressed properly

**3. Fonts Not Loading:**
- Verify font files in public/fonts
- Check CORS headers
- Validate @font-face declarations

**4. Environment Variables Not Working:**
- Prefix client-side vars with `PUBLIC_`
- Rebuild after changing env vars
- Check vars are set in deployment platform

**5. 404 on Client-Side Routes:**
- Configure rewrites/redirects
- Ensure SPA fallback enabled

## 📝 Rollback Procedure

### Vercel
```bash
# List deployments
vercel ls

# Rollback to specific deployment
vercel rollback [deployment-url]
```

### Git-based
```bash
# Revert to previous commit
git revert HEAD
git push origin main

# Or reset to specific commit
git reset --hard [commit-hash]
git push origin main --force
```

## ✅ Launch Checklist

- [ ] Domain purchased and DNS configured
- [ ] SSL certificate active
- [ ] All environment variables set
- [ ] Analytics tracking verified
- [ ] Error monitoring active
- [ ] Uptime monitoring configured
- [ ] Performance baseline established
- [ ] Backup strategy in place
- [ ] Team notified of launch
- [ ] Documentation updated
- [ ] Social media profiles updated
- [ ] Google Search Console verified
- [ ] Google My Business updated

## 🎉 Post-Launch

1. **Monitor First 24 Hours:**
   - Check error logs
   - Monitor traffic patterns
   - Watch Core Web Vitals
   - Verify forms working

2. **Week 1:**
   - Review analytics
   - Check for 404 errors
   - Monitor performance trends
   - Collect user feedback

3. **Month 1:**
   - SEO ranking check
   - Conversion rate analysis
   - Performance optimization
   - Content updates based on data

## 📞 Support

For deployment issues:
- Check docs: https://docs.astro.build/
- Community: https://astro.build/chat
- GitHub Issues: https://github.com/withastro/astro/issues

---

**Good luck with your deployment! 🚀**
