import puppeteer from 'puppeteer';

const ADMIN_URL = 'http://localhost:4321/admin';
const EMAIL = 'admin@issac.design';
const PASSWORD = '12344321';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1280, height: 900 },
    args: ['--no-sandbox'],
  });

  const page = await browser.newPage();

  try {
    // 1. 어드민 페이지 접속
    console.log('=== 1. 어드민 페이지 접속 ===');
    await page.goto(ADMIN_URL, { waitUntil: 'networkidle2', timeout: 15000 });
    await sleep(1500);
    console.log('  URL:', page.url());

    // 2. 로그인
    console.log('\n=== 2. 로그인 ===');
    await page.waitForSelector('input[type="email"], input[name="email"], input[placeholder*="이메일"], input[placeholder*="email"]', { timeout: 5000 });
    const emailInput = await page.$('input[type="email"]') || await page.$('input[name="email"]');
    const pwInput = await page.$('input[type="password"]');

    if (emailInput && pwInput) {
      await emailInput.click({ clickCount: 3 });
      await emailInput.type(EMAIL, { delay: 30 });
      await pwInput.click({ clickCount: 3 });
      await pwInput.type(PASSWORD, { delay: 30 });
      await sleep(500);

      // Find and click login button
      const loginBtn = await page.$('button[type="submit"]') || await page.evaluateHandle(() => {
        return [...document.querySelectorAll('button')].find(b => b.textContent.includes('로그인'));
      });
      if (loginBtn) await loginBtn.click();

      await sleep(3000);
      console.log('  로그인 후 URL:', page.url());
    } else {
      console.log('  이미 로그인 상태이거나 로그인 폼을 찾을 수 없음');
    }

    // 3. Products 페이지 이동
    console.log('\n=== 3. Products 페이지 이동 ===');
    // Click on products nav link
    const productsLink = await page.evaluateHandle(() => {
      return [...document.querySelectorAll('a, button, [role="button"]')].find(el =>
        el.textContent.includes('제품') || el.textContent.includes('Products') || el.getAttribute('href')?.includes('products')
      );
    });
    if (productsLink) {
      await productsLink.click();
      await sleep(2000);
    } else {
      await page.goto(ADMIN_URL + '#/products', { waitUntil: 'networkidle2' });
      await sleep(2000);
    }
    console.log('  URL:', page.url());

    // Take screenshot of product list
    await page.screenshot({ path: '/tmp/admin-products-list.png' });
    console.log('  상품 목록 스크린샷 저장: /tmp/admin-products-list.png');

    // Count products on the page
    const productCount = await page.evaluate(() => {
      const rows = document.querySelectorAll('tr, [class*="product-item"], [class*="list-item"], [class*="card"]');
      return rows.length;
    });
    console.log(`  페이지에 표시된 항목: ${productCount}개`);

    // 4. 제품 추가 버튼 클릭
    console.log('\n=== 4. 제품 추가 페이지 이동 ===');
    const addBtn = await page.evaluateHandle(() => {
      return [...document.querySelectorAll('a, button')].find(el =>
        el.textContent.includes('추가') || el.textContent.includes('새') || el.textContent.includes('New') || el.getAttribute('href')?.includes('new')
      );
    });
    if (addBtn) {
      await addBtn.click();
      await sleep(2000);
    }
    console.log('  URL:', page.url());
    await page.screenshot({ path: '/tmp/admin-products-new.png' });
    console.log('  새 제품 폼 스크린샷 저장: /tmp/admin-products-new.png');

    // 5. 폼 입력
    console.log('\n=== 5. 새 상품 정보 입력 ===');

    // 제품명 입력
    const nameInput = await page.$('#name') || await page.$('input[placeholder*="제품"]');
    if (nameInput) {
      await nameInput.click({ clickCount: 3 });
      await nameInput.type('브라우저 테스트 간판', { delay: 30 });
      console.log('  제품명: 브라우저 테스트 간판');
    }
    await sleep(300);

    // 카테고리 선택
    const categorySelect = await page.$('#category_id') || await page.$('select');
    if (categorySelect) {
      await categorySelect.select('neon');
      console.log('  카테고리: neon (네온 사인)');
    }
    await sleep(300);

    // 가격
    const priceInput = await page.$('#price');
    if (priceInput) {
      await priceInput.click({ clickCount: 3 });
      await priceInput.type('30만원~', { delay: 30 });
      console.log('  가격: 30만원~');
    }
    await sleep(300);

    // 설명
    const descInput = await page.$('#description');
    if (descInput) {
      await descInput.click();
      await descInput.type('Puppeteer로 등록한 테스트 상품입니다', { delay: 20 });
      console.log('  설명: Puppeteer로 등록한 테스트 상품입니다');
    }
    await sleep(500);

    await page.screenshot({ path: '/tmp/admin-products-filled.png' });
    console.log('  입력 완료 스크린샷: /tmp/admin-products-filled.png');

    // 6. 저장 버튼 클릭
    console.log('\n=== 6. 저장 ===');
    const saveBtn = await page.evaluateHandle(() => {
      return [...document.querySelectorAll('button')].find(b =>
        b.textContent.includes('저장')
      );
    });
    if (saveBtn) {
      await saveBtn.click();
      await sleep(3000);
    }
    console.log('  저장 후 URL:', page.url());
    await page.screenshot({ path: '/tmp/admin-products-saved.png' });
    console.log('  저장 후 스크린샷: /tmp/admin-products-saved.png');

    // Check for toast message
    const toastMsg = await page.evaluate(() => {
      const toast = document.querySelector('[class*="toast"], [role="status"], [class*="Toaster"]');
      return toast?.textContent || '';
    });
    if (toastMsg) console.log(`  토스트 메시지: ${toastMsg}`);

    // 7. DB 확인
    console.log('\n=== 7. DB에서 등록 확인 ===');
    const result = await page.evaluate(async () => {
      const res = await fetch('http://127.0.0.1:54321/rest/v1/products?slug=eq.브라우저-테스트-간판&select=id,name,slug,category_id,price', {
        headers: {
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
        }
      });
      return res.json();
    });
    console.log('  조회 결과:', JSON.stringify(result, null, 2));

    // 8. 제품 목록으로 돌아가서 확인
    console.log('\n=== 8. 목록에서 확인 ===');
    const backBtn = await page.evaluateHandle(() => {
      return [...document.querySelectorAll('a, button')].find(el =>
        el.textContent.includes('목록')
      );
    });
    if (backBtn) {
      await backBtn.click();
      await sleep(2000);
    }
    await page.screenshot({ path: '/tmp/admin-products-final.png' });
    console.log('  최종 목록 스크린샷: /tmp/admin-products-final.png');

    // Count products
    const finalCount = await page.evaluate(() => {
      const items = document.querySelectorAll('tbody tr, [class*="list-row"], [class*="product-item"]');
      return items.length;
    });
    console.log(`  최종 상품 수: ${finalCount}개`);

    console.log('\n=== 테스트 완료 ===');
    console.log('브라우저가 열려있습니다. 확인 후 닫아주세요.');

    // Keep browser open for user to see
    await sleep(30000);

  } catch (err) {
    console.error('ERROR:', err.message);
    await page.screenshot({ path: '/tmp/admin-products-error.png' });
    console.log('  에러 스크린샷: /tmp/admin-products-error.png');
  } finally {
    await browser.close();
  }
})();
