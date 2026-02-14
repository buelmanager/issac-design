import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const screenshotDir = path.join(__dirname, 'deployment-verification');

// Create screenshot directory if it doesn't exist
if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir, { recursive: true });
}

async function verifyDeployment() {
  const browser = await chromium.launch();
  const results = [];

  try {
    // Test 1: Homepage
    console.log('\n=== TEST 1: Homepage ===');
    const page1 = await browser.newPage();
    await page1.goto('https://issac-design.vercel.app/', { waitUntil: 'networkidle' });
    
    // Take screenshot
    const screenshot1 = path.join(screenshotDir, '01-homepage.png');
    await page1.screenshot({ path: screenshot1, fullPage: true });
    console.log(`✓ Screenshot saved: ${screenshot1}`);
    
    // Check for sections
    const heroExists = await page1.locator('[class*="hero"], [class*="banner"], [class*="slider"]').first().isVisible().catch(() => false);
    const servicesExists = await page1.locator('[class*="service"]').first().isVisible().catch(() => false);
    const signageExists = await page1.locator('[class*="signage"]').first().isVisible().catch(() => false);
    const clientExists = await page1.locator('[class*="client"], [class*="portfolio"], [class*="showcase"]').first().isVisible().catch(() => false);
    const faqExists = await page1.locator('[class*="faq"], [class*="accordion"]').first().isVisible().catch(() => false);
    const contactExists = await page1.locator('[class*="contact"], form').first().isVisible().catch(() => false);
    const footerExists = await page1.locator('footer').first().isVisible().catch(() => false);
    
    const test1Pass = heroExists && servicesExists && signageExists && clientExists && faqExists && contactExists && footerExists;
    results.push({
      test: 'Homepage - All Sections',
      pass: test1Pass,
      details: {
        hero: heroExists,
        services: servicesExists,
        signage: signageExists,
        client: clientExists,
        faq: faqExists,
        contact: contactExists,
        footer: footerExists
      }
    });
    console.log(`Result: ${test1Pass ? 'PASS' : 'FAIL'}`);
    console.log(`  - Hero: ${heroExists}`);
    console.log(`  - Services: ${servicesExists}`);
    console.log(`  - Signage: ${signageExists}`);
    console.log(`  - Client Showcase: ${clientExists}`);
    console.log(`  - FAQ: ${faqExists}`);
    console.log(`  - Contact: ${contactExists}`);
    console.log(`  - Footer: ${footerExists}`);
    
    await page1.close();

    // Test 2: Admin Login Page
    console.log('\n=== TEST 2: Admin Login Page ===');
    const page2 = await browser.newPage();
    await page2.goto('https://issac-design.vercel.app/admin', { waitUntil: 'networkidle' });
    
    const screenshot2 = path.join(screenshotDir, '02-admin-login.png');
    await page2.screenshot({ path: screenshot2, fullPage: true });
    console.log(`✓ Screenshot saved: ${screenshot2}`);
    
    const loginFormExists = await page2.locator('form, [class*="login"]').first().isVisible().catch(() => false);
    const emailInputExists = await page2.locator('input[type="email"], input[name*="email"]').first().isVisible().catch(() => false);
    const passwordInputExists = await page2.locator('input[type="password"]').first().isVisible().catch(() => false);
    
    const test2Pass = loginFormExists && emailInputExists && passwordInputExists;
    results.push({
      test: 'Admin Login Page',
      pass: test2Pass,
      details: {
        loginForm: loginFormExists,
        emailInput: emailInputExists,
        passwordInput: passwordInputExists
      }
    });
    console.log(`Result: ${test2Pass ? 'PASS' : 'FAIL'}`);
    console.log(`  - Login Form: ${loginFormExists}`);
    console.log(`  - Email Input: ${emailInputExists}`);
    console.log(`  - Password Input: ${passwordInputExists}`);
    
    await page2.close();

    // Test 3: Admin Login & Dashboard
    console.log('\n=== TEST 3: Admin Login & Dashboard ===');
    const page3 = await browser.newPage();
    await page3.goto('https://issac-design.vercel.app/admin', { waitUntil: 'networkidle' });
    
    // Fill login form
    await page3.fill('input[type="email"]', 'admin@issac.design');
    await page3.fill('input[type="password"]', '12344321');
    await page3.click('button[type="submit"]');
    
    // Wait for navigation
    await page3.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => {});
    await page3.waitForTimeout(2000);
    
    const screenshot3 = path.join(screenshotDir, '03-admin-dashboard.png');
    await page3.screenshot({ path: screenshot3, fullPage: true });
    console.log(`✓ Screenshot saved: ${screenshot3}`);
    
    const dashboardExists = await page3.locator('[class*="dashboard"], [class*="admin"]').first().isVisible().catch(() => false);
    const currentUrl = page3.url();
    const isLoggedIn = !currentUrl.includes('/admin') || currentUrl.includes('/admin/dashboard') || currentUrl.includes('/admin/');
    
    const test3Pass = dashboardExists || isLoggedIn;
    results.push({
      test: 'Admin Dashboard',
      pass: test3Pass,
      details: {
        dashboardVisible: dashboardExists,
        loggedIn: isLoggedIn,
        currentUrl: currentUrl
      }
    });
    console.log(`Result: ${test3Pass ? 'PASS' : 'FAIL'}`);
    console.log(`  - Dashboard Visible: ${dashboardExists}`);
    console.log(`  - Logged In: ${isLoggedIn}`);
    console.log(`  - Current URL: ${currentUrl}`);
    
    await page3.close();

    // Test 4: Shop Page
    console.log('\n=== TEST 4: Shop Page ===');
    const page4 = await browser.newPage();
    await page4.goto('https://issac-design.vercel.app/shop', { waitUntil: 'networkidle' });
    
    const screenshot4 = path.join(screenshotDir, '04-shop.png');
    await page4.screenshot({ path: screenshot4, fullPage: true });
    console.log(`✓ Screenshot saved: ${screenshot4}`);
    
    const shopPageExists = await page4.locator('[class*="shop"], [class*="product"]').first().isVisible().catch(() => false);
    const productsExist = await page4.locator('[class*="product-card"], [class*="product-item"], [class*="item"]').first().isVisible().catch(() => false);
    
    const test4Pass = shopPageExists || productsExist;
    results.push({
      test: 'Shop Page',
      pass: test4Pass,
      details: {
        shopPageVisible: shopPageExists,
        productsVisible: productsExist
      }
    });
    console.log(`Result: ${test4Pass ? 'PASS' : 'FAIL'}`);
    console.log(`  - Shop Page Visible: ${shopPageExists}`);
    console.log(`  - Products Visible: ${productsExist}`);
    
    await page4.close();

    // Test 5: Blog Page
    console.log('\n=== TEST 5: Blog Page ===');
    const page5 = await browser.newPage();
    await page5.goto('https://issac-design.vercel.app/blog', { waitUntil: 'networkidle' });
    
    const screenshot5 = path.join(screenshotDir, '05-blog.png');
    await page5.screenshot({ path: screenshot5, fullPage: true });
    console.log(`✓ Screenshot saved: ${screenshot5}`);
    
    const blogPageExists = await page5.locator('[class*="blog"], [class*="post"], [class*="article"]').first().isVisible().catch(() => false);
    const articlesExist = await page5.locator('[class*="post-card"], [class*="article-card"], [class*="blog-item"]').first().isVisible().catch(() => false);
    
    const test5Pass = blogPageExists || articlesExist;
    results.push({
      test: 'Blog Page',
      pass: test5Pass,
      details: {
        blogPageVisible: blogPageExists,
        articlesVisible: articlesExist
      }
    });
    console.log(`Result: ${test5Pass ? 'PASS' : 'FAIL'}`);
    console.log(`  - Blog Page Visible: ${blogPageExists}`);
    console.log(`  - Articles Visible: ${articlesExist}`);
    
    await page5.close();

  } catch (error) {
    console.error('Error during verification:', error);
  } finally {
    await browser.close();
  }

  // Print summary
  console.log('\n=== SUMMARY ===');
  const passCount = results.filter(r => r.pass).length;
  const totalCount = results.length;
  console.log(`Passed: ${passCount}/${totalCount}`);
  
  results.forEach(r => {
    console.log(`${r.pass ? '✓' : '✗'} ${r.test}`);
  });

  // Save results to JSON
  const resultsFile = path.join(screenshotDir, 'results.json');
  fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
  console.log(`\n✓ Results saved to: ${resultsFile}`);
  console.log(`✓ Screenshots saved to: ${screenshotDir}`);
}

verifyDeployment().catch(console.error);
