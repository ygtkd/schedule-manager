import {test,expect} from '@playwright/test';
test.beforeEach(async({page})=>{
 await page.route('**/api/**',async route=>{
 const url=new URL(route.request().url());let body;
 if(url.pathname==='/api/me')body={connected:true,csrf:'test',aiConsent:true,autoRegister:false,lineEnabled:false,lineConfigured:true};
 else if(url.pathname==='/api/events')body=[];
 else if(url.pathname==='/api/history')body=[];
 else body={ok:true};
 await route.fulfill({json:body});
 });
});
test('calendar manual entry, details backdrop and bottom tabs',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await expect(page.locator('#connection-state')).toHaveText('連携済み');
 await expect(page.locator('.brand')).toHaveText('予定の自動管理アプリ');
 await expect(page.getByText('モックアップ')).toHaveCount(0);
 const day=page.locator('.day[aria-pressed="true"]');await day.click();await day.click();
 await expect(page.locator('#day-dialog')).toBeVisible();
 await page.mouse.click(5,5);await expect(page.locator('#day-dialog')).not.toBeVisible();
 await page.getByRole('button',{name:'＋ 予定を追加'}).click();
 await page.locator('#event-title').fill('手入力テスト');
 const request=page.waitForRequest(r=>r.url().endsWith('/api/events/create'));
 await page.getByRole('button',{name:'保存',exact:false}).click();
 expect((await request).postDataJSON().title).toBe('手入力テスト');
 await expect(page.locator('#event-dialog')).not.toBeVisible();
 await page.getByRole('tab',{name:'登録',exact:true}).click();
 await expect(page.locator('#panel-register')).not.toHaveAttribute('inert','');
 await page.locator('#message').fill('2026年10月15日14時から15時 会議');
 await page.locator('#ai-consent').check();
 const message=page.waitForRequest(r=>r.url().endsWith('/api/messages'));
 await page.locator('#extract').click();expect((await message).postDataJSON().text).toContain('会議');
 await page.getByRole('tab',{name:'設定',exact:true}).click();
 await expect(page.locator('#line-enabled')).toBeVisible();
 expect(errors).toEqual([]);
});
test('unauthenticated users cannot enter manual events',async({page})=>{
 await page.route('**/api/me',route=>route.fulfill({status:401,json:{error:'Googleでログインしてください。'}}));
 await page.goto('/');await page.locator('#add-event').click();
 await expect(page.locator('#event-dialog')).not.toBeVisible();
 await expect(page.locator('#calendar-status')).toContainText('ログイン');
});

test('LINE-only account can enter events without Google',async({page})=>{
 await page.route('**/api/auth/config',route=>route.fulfill({json:{lineLogin:true}}));
 await page.route('**/api/me',route=>route.fulfill({json:{connected:false,lineLogin:true,csrf:'test',aiConsent:false}}));
 await page.goto('/');await page.locator('#add-event').click();await expect(page.locator('#event-dialog')).toBeVisible();
 await page.locator('#close-dialog').click();await page.getByRole('tab',{name:'設定',exact:true}).click();
 await expect(page.locator('#calendar-name')).toHaveText('アプリ内カレンダー');
 await expect(page.locator('#line-login')).toHaveText('LINEログイン設定済み');
 await expect(page.locator('#connect')).toHaveText('Google連携');
});
