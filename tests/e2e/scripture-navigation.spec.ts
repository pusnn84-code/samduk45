import {test,expect} from '@playwright/test';
import {login,expectNoOverflow} from './helpers';
test.use({serviceWorkers:'block'});
test('Bible chapter navigation crosses book boundaries and keeps daily-reading context',async({page})=>{
 test.skip(process.env.E2E_DATABASE_READY!=='1','Disposable CI only');await login(page);await page.goto('/scripture/bible/1/1');const nav=page.getByRole('navigation',{name:'성경 장 이동',exact:true});await expect(nav.getByRole('button',{name:'이전 장',exact:true})).toBeDisabled();await nav.getByRole('link',{name:/^다음 장/}).click();await expect(page).toHaveURL(/\/scripture\/bible\/1\/2$/);await expect(page.getByRole('heading',{name:'창세기 2장',exact:true})).toBeVisible();
 await page.goto('/scripture/bible/1/50');await nav.getByRole('link',{name:/^다음 장/}).click();await expect(page).toHaveURL(/\/scripture\/bible\/2\/1$/);await nav.getByRole('link',{name:/^이전 장/}).click();await expect(page).toHaveURL(/\/scripture\/bible\/1\/50$/);
 await page.goto('/scripture/bible/66/22');await expect(nav.getByRole('button',{name:'다음 장',exact:true})).toBeDisabled();
 await page.goto('/scripture/reading/2026-11-30');await nav.getByRole('link',{name:/^다음 장/}).click();await expect(page).toHaveURL(/\/scripture\/bible\/19\/55\?readingDate=2026-11-30$/);await nav.getByRole('link',{name:/^다음 장/}).click();await expect(page).toHaveURL(/\/scripture\/bible\/19\/56\?readingDate=2026-11-30$/);await expect(page.getByRole('link',{name:'통독표로 돌아가 완료 체크하기 ›',exact:true})).toHaveAttribute('href','/bible-reading?date=2026-11-30');
 for(const width of [320,390,430]){await page.setViewportSize({width,height:844});await expectNoOverflow(page);}
});
test('hymn navigation changes songs, resets score state and disables first/last edges',async({page})=>{
 test.skip(process.env.E2E_DATABASE_READY!=='1','Disposable CI only');await login(page);await page.goto('/scripture/hymns/18');const nav=page.getByRole('navigation',{name:'찬송가 장 이동',exact:true});await page.getByRole('button',{name:'150%',exact:true}).click();await nav.getByRole('link',{name:/^다음 장/}).click();await expect(page).toHaveURL(/\/scripture\/hymns\/19$/);await expect(page.getByRole('button',{name:'화면 맞춤',exact:true})).toHaveAttribute('aria-pressed','true');await expect(page.locator('.scripture-score-viewport img')).not.toHaveAttribute('src',/undefined/);await nav.getByRole('link',{name:/^이전 장/}).click();await expect(page).toHaveURL(/\/scripture\/hymns\/18$/);
 await page.goto('/scripture/hymns/1');await expect(nav.getByRole('button',{name:'이전 장',exact:true})).toBeDisabled();await page.goto('/scripture/hymns/645');await expect(nav.getByRole('button',{name:'다음 장',exact:true})).toBeDisabled();for(const width of [320,390,430]){await page.setViewportSize({width,height:844});await expectNoOverflow(page);}
});
