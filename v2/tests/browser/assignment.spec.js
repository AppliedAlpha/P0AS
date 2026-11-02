import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';

test('assignment guidance has equal tabs, reason-specific steps and safe reusable downloads', async ({ page }) => {
  mkdirSync('.impeccable/review', { recursive: true });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/config', route => route.fulfill({ json: { title: 'K-MOOC 특강', state: 'CLOSED', local: false } }));
  const fixture = 'Fictional document for download verification only';
  let documentsReady = false;
  await page.context().route('**/documents/*', route => route.fulfill(documentsReady ? {
    status: 200,
    contentType: route.request().url().endsWith('.pdf') ? 'application/pdf' : '',
    body: route.request().method() === 'HEAD' ? '' : fixture,
  } : { status: 200, contentType: 'text/html', body: '<!doctype html><title>Missing document fallback</title>' }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('link', { name: '대체과제 증빙 방법', exact: true }).click();
  await expect(page).toHaveURL(/\/assignment$/);
  await expect(page.getByRole('heading', { name: '어떤 사유로 대체과제를 신청하시나요?', exact: true })).toBeVisible();
  await expect(page.locator('.student-tabs [aria-current=page]')).toHaveText('대체과제 증빙 방법');
  await expect(page.locator('.assignment-instructions')).toBeEmpty();
  await expect(page.locator('.assignment-reasons button')).toHaveCount(4);
  await page.screenshot({ path: '.impeccable/review/assignment-initial-mobile.png', fullPage: true, animations: 'disabled' });

  const choose = name => page.getByRole('button', { name, exact: true }).click();
  await choose('타 수업/시험과 중복');
  await expect(page.locator('.document-download')).toHaveCount(3);
  await expect(page.getByRole('button', { name: '대체과제 (DOCX) 준비 중', exact: true })).toBeDisabled();
  await expect(page.locator('.document-download svg')).toHaveCount(3);
  await expect(page.locator('.document-download[href]')).toHaveCount(0);

  // Serve fictional bytes at the future public paths; do not invent or publish
  // the actual course assignment or official evidence forms.
  documentsReady = true;
  await page.reload();
  await choose('타 수업/시험과 중복');
  const links = page.locator('.document-download[href]');
  await expect(links).toHaveCount(3);
  expect(await links.evaluateAll(elements => elements.map(element => element.getAttribute('href')))).toEqual(['/documents/assignment.docx', '/documents/absence-reason.docx', '/documents/class-confirmation.pdf']);
  expect(await links.evaluateAll(elements => elements.every(element => element.hasAttribute('download') && element.firstElementChild.tagName.toLowerCase() === 'svg'))).toBe(true);
  await expect(page.locator('.assignment-steps>li')).toHaveCount(5);
  await expect(page.locator('.assignment-steps>li').nth(2)).toContainText('시간표와 U-Check 사진');
  await expect(page.locator('.assignment-steps>li').nth(3)).toContainText('수업 진행 담당자(교수 등)에게 서명');
  await expect(page.locator('.assignment-steps>li').last()).toContainText('본인 이름');
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    const widths = await page.locator('.student-tabs a').evaluateAll(elements => elements.map(element => element.getBoundingClientRect().width));
    expect(widths).toHaveLength(3); expect(Math.max(...widths) - Math.min(...widths)).toBeLessThan(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.locator('.student-page').evaluate(element => element.getBoundingClientRect().width)).toBeLessThanOrEqual(440);
    await page.screenshot({ path: `.impeccable/review/assignment-${width === 1440 ? 'desktop' : width === 390 ? 'mobile' : 'small-mobile'}.png`, fullPage: true, animations: 'disabled' });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await choose('수업 조교 혹은 업무 진행');
  await expect(page.locator('.assignment-reasons [aria-pressed=true]')).toHaveCount(1);
  await expect(page.getByRole('link', { name: '수업업무증빙서 (PDF)', exact: true })).toHaveAttribute('href', '/documents/duty-confirmation.pdf');
  await expect(page.getByRole('link', { name: '수업증빙서 (PDF)', exact: true })).toHaveCount(0);
  await expect(page.locator('.assignment-steps>li').nth(2)).toContainText('‘수업 조교 혹은 업무 진행’');
  await expect(page.locator('.assignment-steps>li').nth(3)).toContainText('수업업무증빙서');
  await choose('기타 공적인 사유에 의한 공결 사용');
  await expect(links).toHaveCount(2);
  await expect(page.locator('.assignment-steps>li').nth(3)).toContainText('학사정보시스템에서 공결 승인을 받은 뒤 공결처리요청서를 출력');
  await expect(page.locator('.assignment-steps>li').nth(3)).toContainText('이 페이지에서 다운로드할 수 없습니다');
  await page.screenshot({ path: '.impeccable/review/assignment-official-mobile.png', fullPage: true, animations: 'disabled' });
  await choose('해당하지 않아요.');
  await expect(page.locator('.assignment-steps')).toHaveCount(0);
  await expect(page.locator('.assignment-warning-text strong')).toContainText('특강 미참여로 과목 NP 처리될 수 있습니다.');
  expect(await page.locator('.assignment-warning-text strong').evaluate(element => ({ color: getComputedStyle(element).color, weight: getComputedStyle(element).fontWeight }))).toEqual({ color: 'rgb(161, 50, 50)', weight: '750' });
  await expect(page.getByRole('link', { name: '메일 보내기', exact: true })).toHaveAttribute('href', 'mailto:kmooc@applied.kr');
  await page.screenshot({ path: '.impeccable/review/assignment-warning-mobile.png', fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: '타 수업/시험과 중복', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.assignment-instructions h3')).toHaveText('타 수업/시험과 중복');
  await page.getByRole('link', { name: '결과 조회', exact: true }).click();
  await expect(page.locator('.student-tabs [aria-current=page]')).toHaveText('결과 조회');
  await expect(page.getByLabel('학번', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
