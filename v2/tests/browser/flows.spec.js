import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const consent = page => page.getByRole('checkbox', { name: '개인정보 수집·이용에 동의합니다 (필수)' });
const mobileNav = page => page.getByRole('navigation', { name: '모바일 관리 메뉴' });
async function login(page) {
  await page.goto('/manage'); await page.getByRole('button', { name: '관리자 로그인', exact: true }).click();
  await expect(page.getByRole('heading', { name: '학생 명단', exact: true })).toBeVisible();
}

async function expectRenderedWebFont(page, selector) {
  await page.evaluate(() => document.fonts.ready);
  const session = await page.context().newCDPSession(page);
  try {
    await session.send('DOM.enable'); await session.send('CSS.enable');
    const { root } = await session.send('DOM.getDocument');
    const { nodeId } = await session.send('DOM.querySelector', { nodeId: root.nodeId, selector });
    const { fonts } = await session.send('CSS.getPlatformFontsForNode', { nodeId });
    expect(fonts.some(font => font.isCustomFont && font.familyName.includes('Pretendard') && font.glyphCount > 0)).toBe(true);
  } finally { await session.detach(); }
  const fontUrls = await page.evaluate(() => performance.getEntriesByType('resource').filter(entry => entry.name.endsWith('.woff2')).map(entry => entry.name));
  expect(fontUrls.length).toBeGreaterThan(0);
  expect(fontUrls.every(url => url.startsWith(new URL('/fonts/pretendard/', page.url()).href))).toBe(true);
}

test('student consent, compact layouts and complete administrator controls', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  // Exercise the student UI with a deployed configuration, using only the isolated local test server.
  await page.route('**/api/config', async route => {
    const response = await route.fetch();
    const { title, state } = await response.json();
    await route.fulfill({ response, json: { title, state, local: false } });
  });
  mkdirSync('.impeccable/review', { recursive: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/'); await expect(page.getByRole('heading', { name: '현장 출석', exact: true })).toBeVisible();
  await expectRenderedWebFont(page, '.form-title');
  expect(await page.locator('.student-page').evaluate(element => element.getBoundingClientRect().width)).toBeLessThanOrEqual(440);
  await expect(page.locator('footer,.environment,.status')).toHaveCount(0);
  await expect(page.getByText(/로컬|가상 데이터|개발용/)).toHaveCount(0);
  await page.screenshot({ path: '.impeccable/review/student-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '.impeccable/review/student-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.getByLabel('학번', { exact: true }).fill('26000001'); await page.getByLabel('이름', { exact: true }).fill('가상하나'); await page.getByLabel('출석 토큰', { exact: true }).fill('482913');
  await expect(page.getByRole('button', { name: '출석 완료하기' })).toBeDisabled();
  await page.getByText('개인정보 수집·이용 안내', { exact: true }).click();
  await expect(page.getByText('성적 산출 및 학기 종료 시 파기', { exact: true })).toBeVisible();
  await expect(page.getByText('개인정보 수집·이용에 동의하지 않으면 이 페이지의 출결 등록·조회 등을 이용할 수 없으며, 현장에서 조교에게 수기 출석을 요청해야 합니다.', { exact: true })).toBeVisible();
  await page.screenshot({ path: '.impeccable/review/consent-mobile.png', fullPage: true });
  await consent(page).check(); await expect(page.getByRole('button', { name: '출석 완료하기' })).toBeEnabled(); await page.getByRole('button', { name: '출석 완료하기' }).click();
  await expect(page.getByRole('heading', { name: '출석이 확인되었습니다.' })).toBeVisible();
  await page.screenshot({ path: '.impeccable/review/result-mobile.png', fullPage: true });
  await page.goto('/check'); await page.getByLabel('학번', { exact: true }).fill('26000001'); await page.getByLabel('이름', { exact: true }).fill('가상하나');
  await expectRenderedWebFont(page, '.form-title');
  await expect(page.getByRole('button', { name: '출석 결과 확인' })).toBeDisabled();
  await consent(page).check(); await expect(page.getByRole('button', { name: '출석 결과 확인' })).toBeEnabled(); await page.getByRole('button', { name: '출석 결과 확인' }).click();
  await expect(page.getByRole('heading', { name: '출석이 확인되었습니다.' })).toBeVisible();

  await page.unroute('**/api/config');
  await login(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expectRenderedWebFont(page, '.admin-title-row h1');
  await expect(page.getByRole('button', { name: '관리자 로그아웃' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: '시도 횟수', exact: true })).toBeVisible();
  await expect(page.locator('.student-table tbody tr').filter({ hasText: '26000001' }).locator('.attempt-count')).toHaveText('0회');
  const lockedStudent = page.locator('.student-table tbody tr').filter({ hasText: '26000012' });
  await expect(lockedStudent.locator('.attempt-count')).toHaveText('3회');
  await lockedStudent.getByRole('button', { name: '잠금 해제', exact: true }).click();
  await expect(lockedStudent.locator('.attempt-count')).toHaveText('0회');
  await expect(page.locator('footer,.environment,.status')).toHaveCount(0);
  await expect(page.getByText('가상하나', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '이름 표시', exact: true }).click();
  await expect(page.getByRole('cell', { name: '가상하나', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '이름 가리기', exact: true }).click();
  await expect(page.getByRole('cell', { name: '가상하나', exact: true })).toHaveCount(0);
  await page.locator('.student-table tbody tr').filter({ hasText: '26000002' }).getByRole('button', { name: '수동', exact: true }).click();
  await expect(page.getByText('수동 승인했습니다.', { exact: true })).toBeVisible();
  await page.locator('.filter-tabs').getByRole('button', { name: '출석', exact: true }).click();
  for (const type of ['FIELD', 'ASSIGNMENT', 'MANUAL']) {
    await page.getByLabel('출석 유형', { exact: true }).selectOption(type);
    expect(await page.locator('.student-table tbody tr').count()).toBeGreaterThan(0);
    const text = await page.locator('.student-table tbody').innerText();
    expect(text).toContain({ FIELD: '현장 출석', ASSIGNMENT: '과제 인정', MANUAL: '수동 승인' }[type]);
  }
  await page.getByLabel('출석 유형', { exact: true }).selectOption('all');
  await page.locator('.filter-tabs').getByRole('button', { name: '전체', exact: true }).click();
  await page.getByRole('button', { name: '학번', exact: true }).click();
  await expect(page.locator('.student-table tbody tr').first().locator('td').first()).toHaveText('26000016');
  await page.getByRole('button', { name: '학번', exact: true }).click();
  await page.getByRole('button', { name: '처리 시각', exact: true }).click();
  await expect(page.locator('th[aria-sort="ascending"]')).toContainText('처리 시각');
  await page.getByRole('button', { name: '처리 시각', exact: true }).click();
  await expect(page.locator('th[aria-sort="descending"]')).toContainText('처리 시각');
  await page.getByRole('button', { name: '학번', exact: true }).click();
  await page.screenshot({ path: '.impeccable/review/admin-desktop.png', fullPage: true });
  await page.getByRole('textbox', { name: '학번 또는 이름 검색' }).fill('26000001');
  await expect(page.locator('.student-table tbody tr')).toHaveCount(1);
  await page.getByRole('textbox', { name: '학번 또는 이름 검색' }).fill('');
  await page.getByRole('button', { name: '명단 등록', exact: true }).click();
  await page.getByLabel('명단 CSV', { exact: true }).fill('student_id,name\n27000001,테스트학생');
  await page.getByRole('button', { name: '등록하기', exact: true }).click();
  await expect(page.getByText('명단을 등록했습니다.', { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '.impeccable/review/admin-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();

  await mobileNav(page).getByRole('button', { name: '출석 토큰' }).click();
  await page.getByLabel('수량', { exact: true }).fill('3'); await page.getByRole('button', { name: '발급', exact: true }).click();
  await expect(page.getByText('3개 발급했습니다.', { exact: true })).toBeVisible();
  const code = (await page.locator('.token-code').first().innerText()).trim(); expect(code).toMatch(/^\d{6}$/);
  await expect(page.getByRole('cell', { name: '482913', exact: true })).toBeVisible();
  await page.screenshot({ path: '.impeccable/review/tokens-mobile.png', fullPage: true });
  await page.getByRole('checkbox', { name: `토큰 ${code} 선택`, exact: true }).check();
  await page.getByRole('button', { name: '선택 삭제', exact: true }).click();
  const dialog = page.getByRole('dialog'); await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('기존 학생의 출결 기록은 유지됩니다.');
  await page.screenshot({ path: '.impeccable/review/token-confirm-mobile.png', fullPage: true });
  await dialog.getByRole('button', { name: '취소', exact: true }).click();
  await expect(page.getByRole('cell', { name: code, exact: true })).toBeVisible();
  await page.getByRole('button', { name: '선택 삭제', exact: true }).click(); await dialog.getByRole('button', { name: '삭제', exact: true }).click();
  await expect(page.getByRole('cell', { name: code, exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '전체 초기화', exact: true }).click(); await dialog.getByRole('button', { name: '초기화', exact: true }).click();
  await expect(page.locator('.token-table').getByText('사용 완료', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '전체 삭제', exact: true }).click(); await dialog.getByRole('button', { name: '삭제', exact: true }).click();
  await expect(page.getByRole('heading', { name: '발급된 토큰이 없습니다.' })).toBeVisible();
  await page.screenshot({ path: '.impeccable/review/tokens-empty-mobile.png', fullPage: true });
  await mobileNav(page).getByRole('button', { name: '학생 명단' }).click();
  await page.getByRole('textbox', { name: '학번 또는 이름 검색' }).fill('26000001');
  await expect(page.locator('.student-table tbody')).toContainText('현장 출석');
  await mobileNav(page).getByRole('button', { name: '운영 설정' }).click();
  await expect(page.getByLabel('학기', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('행사명', { exact: true })).toHaveValue('K-MOOC 특강');
  await page.screenshot({ path: '.impeccable/review/settings-mobile.png', fullPage: true });
  await page.getByRole('radio', { name: '출석 종료', exact: true }).check(); await page.getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.getByText('저장했습니다.', { exact: true })).toBeVisible();
  await page.goto('/'); await expect(page.getByRole('heading', { name: '출석이 종료되었습니다.' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('local database and secrets cannot be downloaded from the dev server', async ({ request }) => {
  for (const path of ['/.local/secrets.json', '/.local/p0as.sqlite', '/@fs/' + resolve('.local/secrets.json').replaceAll('\\', '/')]) {
    const response = await request.get(path); expect([403, 404]).toContain(response.status());
  }
});
test('mobile administrator can log out and lose data access', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await login(page);
  await page.getByRole('button', { name: '관리자 로그아웃' }).click();
  await expect(page.getByRole('button', { name: '관리자 로그인', exact: true })).toBeVisible();
  expect((await page.request.get('/api/admin/overview')).status()).toBe(401);
});

test('full reset requires warning confirmation, supports retry and clears all operational data', async ({ page, browser, baseURL }) => {
  const student = await browser.newContext({ baseURL });
  try {
    await page.setViewportSize({ width: 390, height: 844 }); await login(page);
    const adminPost = (path, data) => page.request.post(path, { headers: { origin: baseURL }, data });
    expect((await adminPost('/api/admin/students', { students: [{ studentId: '28000001', name: '가상초기화' }] })).status()).toBe(200);
    const issued = await adminPost('/api/admin/tokens', { count: 1, label: '초기화 검증용' });
    const { codes } = await issued.json();
    expect((await student.request.post('/api/session', { headers: { origin: baseURL }, data: { studentId: '28000001', name: '가상초기화', consent: true } })).status()).toBe(200);
    expect((await adminPost('/api/admin/settings', { title: '초기화 확인 행사', state: 'OPEN' })).status()).toBe(200);
    expect((await student.request.post('/api/attendance', { headers: { origin: baseURL }, data: { token: codes[0], consent: true } })).status()).toBe(200);
    await page.goto('/manage'); await mobileNav(page).getByRole('button', { name: '운영 설정', exact: true }).click();
    await expect(page.getByLabel('행사명', { exact: true })).toHaveValue('초기화 확인 행사');
    let resetRequests = 0;
    page.on('request', request => { if (request.url().endsWith('/api/admin/reset') && request.method() === 'POST') resetRequests++; });
    const open = page.getByRole('button', { name: '모두 초기화', exact: true });
    await open.click();
    const dialog = page.getByRole('dialog', { name: '모두 초기화하시겠습니까?' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('학생 명단, 모든 출결과 점수, 발급한 토큰, 활동 기록을 삭제합니다.');
    await expect(dialog).toContainText('삭제한 데이터는 복구할 수 없습니다.');
    await expect(dialog.getByRole('button', { name: '취소', exact: true })).toBeFocused();
    await page.screenshot({ path: '.impeccable/review/reset-confirm-mobile.png', fullPage: true });
    await dialog.getByRole('button', { name: '취소', exact: true }).click();
    await expect(dialog).toBeHidden();
    await open.click(); await page.keyboard.press('Escape'); await expect(dialog).toBeHidden();
    expect(resetRequests).toBe(0);
    expect((await student.request.get('/api/result')).status()).toBe(200);
    await page.route('**/api/admin/reset', route => route.fulfill({ status: 500, json: { error: '초기화 검증용 일시 오류', code: 'TEST_FAILURE' } }), { times: 1 });
    await open.click(); await dialog.getByRole('button', { name: '모두 초기화', exact: true }).click();
    await expect(dialog.getByRole('alert')).toContainText('초기화하지 못했습니다.');
    await expect(dialog.getByRole('button', { name: '모두 초기화', exact: true })).toBeEnabled();
    const unchanged = await (await page.request.get('/api/admin/overview')).json();
    expect(unchanged.students.some(row => row.id === '28000001' && row.is_attended === 1)).toBe(true);
    await dialog.getByRole('button', { name: '모두 초기화', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText('모두 초기화했습니다.', { exact: true })).toBeVisible();
    await expect(page.getByLabel('행사명', { exact: true })).toHaveValue('K-MOOC 특강');
    await expect(page.getByRole('radio', { name: '시작 전', exact: true })).toBeChecked();
    const empty = await (await page.request.get('/api/admin/overview')).json();
    for (const key of ['students', 'tokens', 'batches', 'logs']) expect(empty[key]).toEqual([]);
    expect((await student.request.get('/api/result')).status()).toBe(401);
    await page.getByLabel('행사명', { exact: true }).fill('저장하지 않은 행사명');
    await page.getByRole('radio', { name: '출석 진행 중', exact: true }).check();
    await open.click(); await dialog.getByRole('button', { name: '모두 초기화', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByLabel('행사명', { exact: true })).toHaveValue('K-MOOC 특강');
    await expect(page.getByRole('radio', { name: '시작 전', exact: true })).toBeChecked();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: '.impeccable/review/settings-reset-mobile.png', fullPage: true });
    await page.goto('/'); await expect(page.getByRole('heading', { name: '출석 시작 전입니다.', exact: true })).toBeVisible();
  } finally { await student.close(); }
});
