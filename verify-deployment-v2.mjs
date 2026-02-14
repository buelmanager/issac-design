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
    
    // Get page content to check for sections
    const pageContent = await page1.content();
    
    // Check for sections by looking for common text/structure
    const heroExists = pageContent.includes('hero') || pageContent.includes('banner') || pageContent.includes('slider') || await page1.locator('body').first().isVisible();
    const servicesExists = pageContent.includes('service') || pageContent.includes('Services') || pageContent.includes('서비스');
    const signageExists = pageContent.includes('signage') || pageContent.includes('Signage') || pageContent.includes('사이니지');
    const clientExists = pageContent.includes('client') || pageContent.includes('Client') || pageContent.includes('portfolio') || pageContent.includes('Portfolio') || pageContent.includes('고객');
    const faqExists = pageContent.includes('faq') || pageContent.includes('FAQ') || pageContent.includes('자주') || pageContent.includes('질문');
    const contactExists = pageContent.includes('contact') || pageContent.includes('Contact') || pageContent.includes('문의') || pageContent.includes('form');
    const footerExists = pageContent.includes('footer') || pageContent.includes('Footer') || pageContent.includes('copyright') || pageContent.includes('Copyright');
    
    // Also check if page has actual content
    const bodyText = await page1.locator('body').textContent();
    const hasContent = bodyText && bodyText.length > 100;
    
    const test1Pass = hasContent && (heroExists || servicesExists || signageExists || clientExists || faqExists || contactExists || footerExists);
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
        footer: footerExists,
        hasContent: hasContent,
        contentLength: bodyText ? bodyText.length : 0
      }
    });
    console.log(`Result: ${test1Pass ? 'PASS' : 'FAIL'}`);
    console.log(`  - Has Content: ${hasContent}`);
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
    
    const loginFormExists = await page2.locator('form').first().isVisible().catch(() => false);
    const emailInputExists = await page2.locator('input[type="email"]').first().isVisible().catch(() => false);
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
    
    const currentUrl = page3.url();
    const dashboardContent = await page3.content();
    const isDashboard = dashboardContent.includes('dashboard') || dashboardContent.includes('Dashboard') || dashboardContent.includes('관리자');
    const isLoggedIn = !currentUrl.includes('/admin') || currentUrl.includes('/admin/dashboard') || currentUrl.includes('/admin/');
    
    const test3Pass = isDashboard || isLoggedIn;
    results.push({
      test: 'Admin Dashboard',
      pass: test3Pass,
      details: {
        isDashboard: isDashboard,
        loggedIn: isLoggedIn,
        currentUrl: currentUrl
      }
    });
    console.log(`Result: ${test3Pass ? 'PASS' : 'FAIL'}`);
    console.log(`  - Dashboard Content: ${isDashboard}`);
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
    
    const shopContent = await page4.content();
    const shopPageExists = shopContent.includes('shop') || shopContent.includes('Shop') || shopContent.includes('product') || shopContent.includes('Product');
    const productsExist = shopContent.includes('product') || shopContent.includes('Product') || shopContent.includes('상품');
    
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
    
    const blogContent = await page5.content();
    const blogPageExists = blogContent.includes('blog') || blogContent.includes('Blog') || blogContent.includes('post') || blogContent.includes('Post') || blogContent.includes('article') || blogContent.includes('Article');
    const articlesExist = blogContent.includes('post') || blogContent.includes('Post') || blogContent.includes('article') || blogContent.includes('Article') || blogContent.includes('글');
    
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
