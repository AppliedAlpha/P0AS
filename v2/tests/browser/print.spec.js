import { test, expect } from '@playwright/test';
import jsQR from 'jsqr';
import { mkdirSync, writeFileSync } from 'node:fs';

test('A4 tickets include reusable public QR and instructions on every ticket', async ({ page }) => {
  mkdirSync('.impeccable/review', { recursive: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/manage'); await page.getByRole('button', { name: '관리자 로그인', exact: true }).click();
  await expect(page.getByRole('heading', { name: '학생 명단', exact: true })).toBeVisible();
  await page.getByRole('navigation', { name: '관리 메뉴' }).getByRole('button', { name: '출석 토큰' }).click();
  await page.getByLabel('수량', { exact: true }).fill('31');
  await page.getByRole('button', { name: '발급', exact: true }).click();
  await expect(page.getByText('31개 발급했습니다.', { exact: true })).toBeVisible();
  // A previous test may have removed fixture tokens. Thirty-one new codes
  // guarantee a second page without depending on any other test's state.
  const total = await page.locator('.token-code').count();
  expect(total).toBeGreaterThanOrEqual(31);
  await expect(page.locator('.print-page')).toHaveCount(Math.ceil(total / 30));
  const imageData = await page.locator('.ticket-qr img').first().evaluate(async image => {
    await image.decode(); const canvas = document.createElement('canvas'); canvas.width = canvas.height = 330;
    const context = canvas.getContext('2d'); context.fillStyle = '#fff'; context.fillRect(0, 0, 330, 330); context.drawImage(image, 0, 0, 330, 330);
    return Array.from(context.getImageData(0, 0, 330, 330).data);
  });
  const decoded = jsQR(Uint8ClampedArray.from(imageData), 330, 330);
  expect(decoded?.data).toBe('https://p0as.applied.kr');
  expect(decoded?.data).not.toContain('?');
  await page.evaluate(() => { window.print = () => { window.__printCalled = true; }; });
  await page.getByRole('button', { name: '토큰 인쇄', exact: true }).click();
  await expect.poll(() => page.evaluate(() => !!window.__printCalled)).toBe(true);
  await page.emulateMedia({ media: 'print' });
  await page.evaluate(() => document.fonts.ready);
  await page.setViewportSize({ width: 794, height: 1123 });
  await expect(page.locator('.admin-topbar')).toBeHidden();
  await expect(page.locator('.token-list')).toBeHidden();
  await expect(page.locator('.token-ticket')).toHaveCount(total);
  await expect(page.locator('.token-ticket').first()).toContainText('1회용 출석 토큰입니다.');
  await expect(page.locator('.token-ticket').first()).toContainText('문제가 있으면 조교에게 문의하세요.');
  const issues = await page.locator('.token-ticket').evaluateAll(tickets => tickets.filter(ticket => ticket.scrollHeight > ticket.clientHeight + 1 || ticket.scrollWidth > ticket.clientWidth + 1).length);
  expect(issues).toBe(0);
  await page.locator('.print-page').first().screenshot({ path: '.impeccable/review/token-print-a4.png' });
  await page.pdf({ path: '.impeccable/review/token-print-a4.pdf', format: 'A4', preferCSSPageSize: true, printBackground: true, displayHeaderFooter: false });
  // Verify selecting one row prints exactly that token and one complete card.
  await page.emulateMedia({ media: 'screen' });
  await page.getByRole('checkbox', { name: '표시된 토큰 모두 선택' }).uncheck();
  await page.locator('.token-table tbody input[type=checkbox]').first().check();
  await expect(page.locator('.token-ticket')).toHaveCount(1);
  const selectedCode = (await page.locator('.token-code').first().innerText()).trim();
  await expect(page.locator('.ticket-number')).toHaveText(selectedCode);
  writeFileSync('.impeccable/review/print-result.json', JSON.stringify({ total, pages: Math.ceil(total / 30), decodedUrl: decoded.data, selectedCode, overflow: issues }, null, 2));
});
