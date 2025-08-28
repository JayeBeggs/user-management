import { chromium } from '@playwright/test';

export async function getOtpFromAdmin(browser) {
  const useSeparate = process.env.OTP_SEPARATE_BROWSER !== '0';
  const channel = process.env.PW_BROWSER_CHANNEL || undefined;
  const launched = useSeparate ? await chromium.launch({ channel, headless: process.env.HEADLESS === '1' }) : null;
  const targetBrowser = launched || browser;
  const context = await targetBrowser.newContext();
  const page = await context.newPage();
  const usersUrl = process.env.DJANGO_ADMIN_USERS_URL || 'https://cdm.st4ge.com/2tNFZrSGvTr9CqKM8Wsf5alcO9mBNwo4/users/user/';
  const adminRoot = usersUrl.replace(/users\/user\/?\.*/, '');
  let otpListUrl = process.env.CDM_OTP_URL || usersUrl.replace('/users/user/', '/users/otp/');
  if (!/\?/.test(otpListUrl)) otpListUrl += '?o=-5';
  console.log('Opening admin root:', adminRoot);
  await page.goto(adminRoot);
  await page.waitForLoadState('domcontentloaded');
  const adminUsername = process.env.DJANGO_ADMIN_USERNAME || process.env.ADMIN_USERNAME || '';
  const adminPassword = process.env.DJANGO_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || '';
  try {
    const usernameInput = page.locator('input#id_username, input[name="username"]');
    const passwordInput = page.locator('input#id_password, input[name="password"]');
    if ((await usernameInput.count()) && (await passwordInput.count()) && adminUsername && adminPassword) {
      await usernameInput.first().fill(adminUsername);
      await passwordInput.first().fill(adminPassword);
      const submitBtn = page.getByRole('button', { name: /log in|sign in|submit/i });
      if (await submitBtn.count()) {
        await submitBtn.first().click();
      } else {
        const form = page.locator('form');
        if (await form.count()) await form.first().evaluate((f) => f.submit());
      }
      await page.waitForLoadState('networkidle').catch(() => {});
    }
  } catch {}
  console.log('Opening admin OTP list:', otpListUrl);
  await page.goto(otpListUrl);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForSelector('#result_list tbody tr th.field-user a', { timeout: parseInt(process.env.OTP_ADMIN_TIMEOUT || '15000', 10) });
  await page.locator('#result_list tbody tr th.field-user a').first().click();
  const timeoutMs = parseInt(process.env.OTP_ADMIN_TIMEOUT || '15000', 10);
  let otp = '';
  const pinInput = page.locator('input#id_pin, input[name="pin"]');
  try {
    if (await pinInput.count()) {
      await pinInput.first().waitFor({ timeout: timeoutMs });
      otp = (await pinInput.first().inputValue()).trim();
    }
  } catch {}
  if (!otp) {
    const labeled = page.getByLabel(/otp|code|token|pin/i);
    try {
      await labeled.waitFor({ timeout: timeoutMs });
      otp = (await labeled.inputValue()).trim();
    } catch {}
  }
  if (!otp) {
    const bodyText = (await page.locator('body').innerText());
    const match = bodyText.match(/\b(\d{4,8})\b/);
    if (match) otp = match[1];
  }
  await context.close();
  if (launched) await launched.close();
  if (!otp) throw new Error('ADMIN_OTP_NOT_FOUND');
  return otp;
}

export async function getOtp({ browser }) {
  return await getOtpFromAdmin(browser);
}

export async function isOtpRequired(page) {
  const custom = process.env.OTP_CHECK_SELECTOR;
  if (custom) {
    try {
      await page.waitForSelector(custom, { timeout: 2500 });
      return true;
    } catch {
      return false;
    }
  }
  try { await page.getByLabel(/OTP/i).waitFor({ timeout: 2500 }); return true; } catch {}
  try { await page.getByPlaceholder(/otp|one[- ]time|code/i).waitFor({ timeout: 2500 }); return true; } catch {}
  return false;
}

export async function enterOtp(page, otp) {
  const digits = String(otp).replace(/\D/g, '');
  const selectors = [
    'input[data-testid="otp-input-hidden"]',
    'input[aria-label="One-Time Password"]',
    'input[aria-label*="One-Time Password" i]',
    'input[autocomplete="one-time-code"]',
    'input[name="otp"]',
    'input[placeholder*="OTP" i]'
  ];
  for (const sel of selectors) {
    const loc = page.locator(sel);
    if (await loc.count()) {
      const input = loc.first();
      await input.scrollIntoViewIfNeeded();
      await input.evaluate((el, value) => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        const maxLen = el.maxLength > 0 ? el.maxLength : value.length;
        const v = value.slice(0, maxLen);
        setter.call(el, v);
        el.dispatchEvent(new InputEvent('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }, digits);
      const val = await input.inputValue();
      if (val.replace(/\D/g, '') === digits.slice(0, val.length)) return true;
    }
  }
  const perDigit = page.locator('input[maxlength="1"]');
  const count = await perDigit.count();
  if (count >= digits.length) {
    for (let i = 0; i < digits.length; i++) {
      const box = perDigit.nth(i);
      await box.evaluate((el, ch) => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        setter.call(el, ch);
        el.dispatchEvent(new InputEvent('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }, digits[i]);
    }
    return true;
  }
  return false;
}


