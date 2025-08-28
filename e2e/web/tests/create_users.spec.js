import { test, expect, chromium } from '@playwright/test';

const NUM_USERS = parseInt(process.env.NUM_USERS || '5', 10);

async function generateUserMedia() {
  const { spawnSync } = await import('child_process');
  const seed = `u${Date.now()}${Math.floor(Math.random()*1000)}`;
  const env = { ...process.env, TEST_SEED: seed };
  const res = spawnSync('node', ['e2e/tools/generate_user_media.js'], { encoding: 'utf8', env });
  if (res.status !== 0) throw new Error('generate_user_media failed');
  return JSON.parse(res.stdout);
}

async function getOtpFromAdmin(browser) {
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
  // Perform Django admin username/password login if a login form is present
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
  // Open the latest OTP entry (first row)
  await page.waitForSelector('#result_list tbody tr th.field-user a', { timeout: parseInt(process.env.OTP_ADMIN_TIMEOUT || '15000', 10) });
  await page.locator('#result_list tbody tr th.field-user a').first().click();
  // Try to read OTP code on detail page
  const timeoutMs = parseInt(process.env.OTP_ADMIN_TIMEOUT || '15000', 10);
  let otp = '';
  // Prefer explicit pin input first
  const pinInput = page.locator('input#id_pin, input[name="pin"]');
  try {
    if (await pinInput.count()) {
      await pinInput.first().waitFor({ timeout: timeoutMs });
      otp = (await pinInput.first().inputValue()).trim();
    }
  } catch {}
  if (!otp) {
    // Next, try labeled input
    const labeled = page.getByLabel(/otp|code|token|pin/i);
    try {
      await labeled.waitFor({ timeout: timeoutMs });
      otp = (await labeled.inputValue()).trim();
    } catch {}
  }
  if (!otp) {
    // Fallback: find any 4-8 digit token on the page
    const bodyText = (await page.locator('body').innerText());
    const match = bodyText.match(/\b(\d{4,8})\b/);
    if (match) otp = match[1];
  }
  await context.close();
  if (launched) await launched.close();
  if (!otp) throw new Error('ADMIN_OTP_NOT_FOUND');
  return otp;
}

// Note: Admin UI verification helper removed; CDM verification is handled via CDM UI window

// Removed interactive readline; OTP now fetched only via admin

async function getOtp({ browser }) {
  return await getOtpFromAdmin(browser);
}

async function isOtpRequired(page) {
  const custom = process.env.OTP_CHECK_SELECTOR;
  if (custom) {
    try {
      await page.waitForSelector(custom, { timeout: 2500 });
      return true;
    } catch {
      return false;
    }
  }
  try {
    await page.getByLabel(/OTP/i).waitFor({ timeout: 2500 });
    return true;
  } catch {}
  try {
    await page.getByPlaceholder(/otp|one[- ]time|code/i).waitFor({ timeout: 2500 });
    return true;
  } catch {}
  return false;
}

async function enterOtp(page, otp) {
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

async function uploadIdSection(page, sectionHeadingText, filePath) {
  const heading = page.getByRole('heading', { name: new RegExp(sectionHeadingText, 'i') }).first();
  await heading.waitFor({ timeout: 20000 });
  const dropzone = heading.locator('xpath=following::div[@tabindex="0"][1]').first();
  try { await dropzone.scrollIntoViewIfNeeded(); } catch {}

  // Track existing file inputs to detect new ones after click
  const inputs = page.locator('input[type="file"]');
  const beforeCount = await inputs.count();

  // Try to capture a native file chooser if the app triggers it
  const fileChooserPromise = page.waitForEvent('filechooser').catch(() => null);
  await dropzone.click({ force: true });
  const fileChooser = await fileChooserPromise;
  if (fileChooser) {
    await fileChooser.setFiles(filePath);
    return true;
  }

  // Prefer an input adjacent to this section
  let targetInput = heading.locator('xpath=following::input[@type="file"][1]').first();

  // If a new input was added globally, prefer the newest one
  await page.waitForFunction((sel, prev) => document.querySelectorAll(sel).length >= prev, 'input[type="file"]', beforeCount, { timeout: 3000 }).catch(() => {});
  const afterCount = await inputs.count();
  if (afterCount > 0) {
    const newestIndex = Math.max(0, afterCount - 1);
    targetInput = inputs.nth(newestIndex);
  }

  await targetInput.waitFor({ timeout: 10000 });
  await targetInput.setInputFiles(filePath);
  return true;
}

async function clickUploadCta(page) {
  // Prefer the floating Upload CTA (div with tabindex=0 and Upload text)
  const cta = page.locator('div[tabindex="0"]:has(h1:has-text("Upload"))').first();
  try {
    await cta.waitFor({ timeout: 5000 });
    // Ensure it's interactable
    const handle = await cta.elementHandle();
    if (handle) {
      const ok = await page.evaluate((el) => {
        const s = window.getComputedStyle(el);
        const pe = s.pointerEvents !== 'none';
        const op = Number(s.opacity || '1') > 0.2;
        const r = el.getBoundingClientRect();
        return pe && op && r.width > 5 && r.height > 5;
      }, handle);
      if (ok) {
        await cta.click({ force: true });
        return true;
      }
    }
  } catch {}
  // Fallback: try any role=button Upload that is clickable (avoids disabled submit at bottom)
  const roleBtn = page.locator('[role="button"]:has(h1:has-text("Upload"))').first();
  try {
    await roleBtn.waitFor({ timeout: 3000 });
    const handle = await roleBtn.elementHandle();
    if (handle) {
      const ok = await page.evaluate((el) => {
        const s = window.getComputedStyle(el);
        const pe = s.pointerEvents !== 'none';
        const op = Number(s.opacity || '1') > 0.2;
        const r = el.getBoundingClientRect();
        return pe && op && r.width > 5 && r.height > 5;
      }, handle);
      if (ok) {
        await roleBtn.click({ force: true });
        return true;
      }
    }
  } catch {}
  return false;
}

async function clickRecordCircle(page) {
  const control = page.locator('div[tabindex="0"]:has(svg circle)').first();
  await control.waitFor({ timeout: 10000 }).catch(() => {});
  try { await control.scrollIntoViewIfNeeded(); } catch {}
  for (let i = 0; i < 6; i++) {
    try {
      await control.click({ timeout: 800, force: true });
      return true;
    } catch {}
    try {
      const handle = await control.elementHandle();
      if (handle) {
        await handle.evaluate((el) => el.click());
        return true;
      }
    } catch {}
    try {
      const box = await control.boundingBox();
      if (box) {
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;
        await page.mouse.move(cx, cy);
        await page.mouse.down();
        await page.mouse.up();
        return true;
      }
    } catch {}
    await page.waitForTimeout(200);
  }
  return false;
}

async function ensureCameraReady(page) {
  try {
    const origin = (() => { try { return new URL(page.url()).origin; } catch { return 'https://app.st4ge.com'; } })();
    await page.context().grantPermissions(['camera', 'microphone'], { origin }).catch(() => {});
  } catch {}
  // Provide a fallback MediaStream if getUserMedia fails
  try {
    await page.evaluate(() => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
      const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = async (constraints) => {
        try {
          return await original(constraints);
        } catch (err) {
          // Fallback to a canvas-based fake stream
          const canvas = document.createElement('canvas');
          canvas.width = 640;
          canvas.height = 480;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#777';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          return canvas.captureStream(30);
        }
      };
    });
  } catch {}
}

async function recordLivenessWithRetry(page) {
  const waitForSubmit = async (timeoutMs = 4000) => {
    try {
      await page.locator([
        'button:has-text("Submit")',
        '[role="button"]:has-text("Submit")',
        'button:has(div:has-text("Submit"))',
        'button:has-text("Finish")',
        '[role="button"]:has-text("Finish")',
        'button:has-text("Continue")',
        '[role="button"]:has-text("Continue")',
        'div[tabindex="0"]:has-text("Submit")',
        'div[tabindex="0"]:has-text("Finish")',
        'div[tabindex="0"]:has-text("Continue")'
      ].join(', ')).first().waitFor({ timeout: timeoutMs });
      return true;
    } catch {
      return false;
    }
  };

  const doOnce = async () => {
    await ensureCameraReady(page);
    const start = Date.now();
    const started = await clickRecordCircle(page);
    if (!started) return false;
    console.log('Recording started');
    await page.waitForTimeout(4000);
    let stopped = await clickRecordCircle(page);
    if (!stopped) {
      const elapsed = Date.now() - start;
      if (elapsed < 6000) await page.waitForTimeout(6000 - elapsed);
      stopped = await clickRecordCircle(page);
    }
    if (stopped) console.log('Recording stop click issued');
    const advanced = await waitForSubmit(5000);
    if (advanced) console.log('Liveness advanced to submit/continue');
    return stopped && advanced;
  };

  // First attempt
  let ok = await doOnce();
  if (ok) return true;

  // Retry: reload and re-click the second "I'm ready" then try again
  console.log('Liveness stop failed; reloading and retrying');
  try { await page.reload({ waitUntil: 'domcontentloaded' }); } catch {}
  try {
    const ready2 = page.locator('button:has-text("I\'m ready"), button:has(h1:has-text("I\'m ready")), [role="button"]:has-text("I\'m ready")').first();
    await ready2.click({ timeout: 7000, force: true });
    console.log('Clicked I\'m ready after reload');
  } catch {}
  ok = await doOnce();
  return ok;
}

async function clickPinDigit(page, digitText = '0', times = 1) {
  // Try the circular keypad key like the provided markup
  let key = page.locator(`div[tabindex="0"]:has(h3:has-text("${digitText}"))`).first();
  if (!(await key.count())) key = page.locator(`div[tabindex="0"]:has-text("${digitText}")`).first();
  if (!(await key.count())) key = page.getByRole('button', { name: new RegExp(`^${digitText}$`) }).first();
  await key.waitFor({ timeout: 15000 });
  try { await key.scrollIntoViewIfNeeded(); } catch {}
  for (let i = 0; i < times; i++) {
    try {
      await key.click({ force: true });
    } catch {
      const handle = await key.elementHandle();
      if (handle) {
        try { await handle.evaluate((el) => el.click()); } catch {}
      }
    }
    await page.waitForTimeout(150);
  }
}

async function isPinComplete(page, expectedLength = 4) {
  // Check per-digit inputs
  try {
    const perDigit = page.locator('input[maxlength="1"]');
    const c = await perDigit.count();
    if (c >= expectedLength) {
      let filled = 0;
      for (let i = 0; i < expectedLength; i++) {
        const v = await perDigit.nth(i).inputValue();
        if (v && v.length === 1) filled++;
      }
      if (filled >= expectedLength) return true;
    }
  } catch {}
  // Check any single input holding 4 digits
  try {
    const input = page.locator('input[type="password"], input[inputmode="numeric"], input[type="tel"], input');
    if (await input.count()) {
      const v = (await input.first().inputValue()) || '';
      if ((v.replace(/\D/g, '').length) >= expectedLength) return true;
    }
  } catch {}
  return false;
}

async function enterPin(page, code = '0000') {
  // Wait for either keypad or inputs to appear
  try {
    await Promise.race([
      page.locator('div[tabindex="0"]:has(h3)').waitFor({ timeout: 10000 }),
      page.locator('input[maxlength="1"]').waitFor({ timeout: 10000 }),
      page.locator('input[type="password"], input[inputmode="numeric"], input[type="tel"], input').waitFor({ timeout: 10000 })
    ]);
  } catch {}

  // Strategy 1: Click keypad for each digit
  try {
    for (const ch of code) {
      await clickPinDigit(page, ch, 1);
    }
    if (await isPinComplete(page, code.length)) return true;
  } catch {}

  // Strategy 2: Per-digit inputs
  try {
    const perDigit = page.locator('input[maxlength="1"]');
    if (await perDigit.count()) {
      for (let i = 0; i < code.length; i++) {
        const box = perDigit.nth(i);
        await box.evaluate((el, ch) => {
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
          setter.call(el, ch);
          el.dispatchEvent(new InputEvent('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }, code[i]);
      }
      if (await isPinComplete(page, code.length)) return true;
    }
  } catch {}

  // Strategy 3: Single input
  try {
    const input = page.locator('input[type="password"], input[inputmode="numeric"], input[type="tel"], input');
    if (await input.count()) {
      const target = input.first();
      await target.evaluate((el, value) => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        setter.call(el, value);
        el.dispatchEvent(new InputEvent('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }, code);
      if (await isPinComplete(page, code.length)) return true;
      try { await target.focus(); await target.fill(''); await target.type(code, { delay: 50 }); } catch {}
      if (await isPinComplete(page, code.length)) return true;
    }
  } catch {}

  return false;
}

async function setPhoneNumber(page, digits) {
  const customSel = process.env.PHONE_SELECTOR;
  const pretty = `${digits.slice(0,3)} ${digits.slice(3,6)} ${digits.slice(6)}`;
  // Prefer the only input on the page if present
  let phoneLocator = customSel ? page.locator(customSel) : page.locator('input');
  const inputCount = await phoneLocator.count();
  if (!customSel && inputCount !== 1) {
    // Narrow down to a likely phone input
    phoneLocator = page.locator('input[type="tel"]');
    if (!(await phoneLocator.count())) phoneLocator = page.locator('input[data-testid="phone-input"][type="tel"]');
    if (!(await phoneLocator.count())) phoneLocator = page.locator('input[aria-label="Phone number"]');
    if (!(await phoneLocator.count())) phoneLocator = page.getByPlaceholder(/082 567 6728|phone|tel/i);
    if (!(await phoneLocator.count())) phoneLocator = page.getByRole('textbox', { name: /phone number/i });
    if (!(await phoneLocator.count())) phoneLocator = page.locator('input');
  }
  if (!(await phoneLocator.count())) return false;
  const input = phoneLocator.first();
  await input.scrollIntoViewIfNeeded();
  await input.waitFor({ state: 'visible' });
  await input.click({ force: true });
  await input.fill('');
  await input.type(digits, { delay: 80 });
  let val = await input.inputValue();
  if (val.replace(/\D/g, '') === digits) return true;
  await input.fill(pretty);
  val = await input.inputValue();
  if (val.replace(/\D/g, '') === digits) return true;
  await input.evaluate((el) => el.focus());
  await page.keyboard.down('Meta').catch(() => {});
  await page.keyboard.press('KeyA').catch(() => {});
  await page.keyboard.up('Meta').catch(() => {});
  await page.keyboard.down('Control').catch(() => {});
  await page.keyboard.press('KeyA').catch(() => {});
  await page.keyboard.up('Control').catch(() => {});
  await page.keyboard.type(digits, { delay: 70 });
  val = await input.inputValue();
  if (val.replace(/\D/g, '') === digits) return true;
  await input.evaluate((el, value) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(el, '');
    el.dispatchEvent(new InputEvent('input', { bubbles: true }));
    for (const ch of value) {
      el.value += ch;
      el.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, data: ch, inputType: 'insertText' }));
      el.dispatchEvent(new InputEvent('input', { bubbles: true, data: ch, inputType: 'insertText' }));
    }
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.blur();
  }, digits);
  val = await input.inputValue();
  return val.replace(/\D/g, '') === digits;
}

test.describe('Signup flow creates multiple users via app with OTP', () => {
  test('create 5 users via signup + OTP + KYC images', async ({ page, browser }) => {
    for (let i = 0; i < NUM_USERS; i++) {
      const media = await generateUserMedia();

      console.log('Navigating to app');
      await page.goto('/');
      // Landing: go to '/', then proceed with phone number -> SMS -> OTP
      const phoneDigits = `082${Math.floor(1000000 + Math.random()*8999999)}`;
      const ok = await setPhoneNumber(page, phoneDigits);
      if (!ok) throw new Error('PHONE_INPUT_NOT_FILLED');
      console.log('Phone input filled:', phoneDigits);
      // Click SMS button to move to OTP page if present

      console.log('Clicking SMS to request OTP');
      await page.getByRole('button', { name: /sms/i }).click();

      // Fetch OTP from admin panel using username/password-only flow

      console.log('Fetching OTP from admin');
      const otp = await getOtp({ browser, page });
      await enterOtp(page, otp);
      console.log('OTP entered');



      // OTP verification continues automatically after entry; next screen shows Name input
      console.log('Waiting for Name field');
      await page.locator('input[placeholder="Name"]').waitFor({ timeout: 20000 });

      // Fill name on next screen, then click Next
      {
        const base = String(media.seed || '').replace(/[^a-zA-Z0-9]/g, '');
        const nameValue = (`User${base}`).slice(0, 12);
        const nameInput = page.locator('input[placeholder="Name"]').first();
        await nameInput.waitFor({ timeout: 20000 });
        await nameInput.fill(nameValue);
        await nameInput.evaluate((el) => el.blur());
        const nextBtn = page.getByRole('button', { name: /^next$/i }).first();
        if (await nextBtn.count()) {
          await nextBtn.click();
        } else {
          await page.locator('button:has-text("Next")').first().click();
        }
        console.log('Name submitted:', nameValue);
      }

      // Fill ID number on the following screen, then click Next
      {
        await page.waitForURL(/onboarding\/user-details\/id-number/i, { timeout: 20000 }).catch(() => {});
        const idDigits = String(media.id).replace(/\D/g, '').slice(0, 13);
        let idInput = page.locator('input[placeholder="9807130178080"]').first();
        if (!(await idInput.count())) idInput = page.getByPlaceholder(/^\d{10,}$/).first();
        if (!(await idInput.count())) idInput = page.locator('input[inputmode="numeric"][maxlength="13"]').first();
        if (!(await idInput.count())) idInput = page.locator('input[maxlength="13"]').first();
        if (!(await idInput.count())) idInput = page.locator('input[type="text"]').first();
        await idInput.waitFor({ timeout: 20000 });
        await idInput.fill(idDigits);
        await idInput.evaluate((el, value) => {
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
          setter.call(el, value);
          el.dispatchEvent(new InputEvent('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }, idDigits);
        await idInput.evaluate((el) => el.blur());
        const nextBtn2 = page.getByRole('button', { name: /^next$/i }).first();
        if (await nextBtn2.count()) {
          await nextBtn2.click();
        } else {
          await page.locator('button:has-text("Next")').first().click();
        }
        console.log('ID number submitted:', idDigits);
      }

      // Fill Email on the next screen, then click Next
      {
        const base = String(media.seed || Date.now()).replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        const emailValue = `test+${base.slice(0, 18)}@gmail.com`;
        let emailInput = page.locator('input[placeholder="email@gmail.com"]').first();
        if (!(await emailInput.count())) emailInput = page.locator('input[type="email"]').first();
        if (!(await emailInput.count())) emailInput = page.locator('input[inputmode="email"]').first();
        if (!(await emailInput.count())) emailInput = page.getByPlaceholder(/@/).first();
        await emailInput.waitFor({ timeout: 20000 });
        await emailInput.fill(emailValue);
        await emailInput.evaluate((el) => el.blur());
        const nextBtn3 = page.getByRole('button', { name: /^next$/i }).first();
        if (await nextBtn3.count()) {
          await nextBtn3.click();
        } else {
          await page.locator('button:has-text("Next")').first().click();
        }
        console.log('Email submitted:', emailValue);
      }

      // Click the "I'm ready" button before KYC if present
      try {
        const ready = page.locator('button:has-text("I\'m ready"), button:has(h1:has-text("I\'m ready")), [role="button"]:has-text("I\'m ready")').first();
        await ready.click({ timeout: 5000, force: true });
        console.log('Clicked first I\'m ready');
      } catch {}

      // Select ID type: default to ID Card
      try {
        await page.locator('div:has(> button:has(h1))').first().waitFor({ timeout: 5000 }).catch(() => {});
        const card = page.locator('button:has-text("ID Card"), button:has(h1:has-text("ID Card")), [role="button"]:has-text("ID Card")').first();
        await card.click({ timeout: 5000, force: true });
        console.log('Selected ID type: ID Card');
      } catch {}

      // Some screens require clicking an Upload CTA to switch from camera to upload mode
      try { const did = await clickUploadCta(page); console.log('Upload CTA clicked:', !!did); } catch {}

      console.log('Uploading ID images');
      // Click each dropzone and set files, then submit via Upload button
      await uploadIdSection(page, 'ID Front', media.idFront);
      console.log('Set ID Front file:', media.idFront);
      await uploadIdSection(page, 'ID Back', media.idBack);
      console.log('Set ID Back file:', media.idBack);

      // Click the final Upload button in this section
      try {
        const uploadBtn = page.locator('button:has-text("Upload"), [role="button"]:has-text("Upload")').first();
        await uploadBtn.waitFor({ timeout: 10000 });
        // Wait until clickable (pointer-events not none and opacity > 0.2)
        await page.waitForFunction((el) => {
          const style = window.getComputedStyle(el);
          const pe = style.pointerEvents !== 'none';
          const op = Number(style.opacity || '1') > 0.2;
          return pe && op;
        }, await uploadBtn.elementHandle(), { timeout: 10000 }).catch(() => {});
        await uploadBtn.click({ force: true });
        console.log('Submitted ID images');
      } catch {}

      // Continue after upload if a continue/submit button appears
      try {
        await page.getByRole('button', { name: /continue|submit/i }).first().click();
        console.log('Post-upload Continue/Submit clicked');
      } catch {}

      // Click another "I'm ready" button if presented next
      try {
        const ready2 = page.locator('button:has-text("I\'m ready"), button:has(h1:has-text("I\'m ready")), [role="button"]:has-text("I\'m ready")').first();
        await ready2.click({ timeout: 5000, force: true });
        console.log('Clicked second I\'m ready');
      } catch {}

      // Start/stop recording; if stop fails within 6s, reload and retry from I'm ready
      try { await recordLivenessWithRetry(page); } catch {}

      // After recording completes, wait for the next page/section and click Submit/Continue
      try {
        const submitBtn = page.locator([
          'button:has-text("Submit")',
          '[role="button"]:has-text("Submit")',
          'button:has(div:has-text("Submit"))',
          'button:has-text("Finish")',
          '[role="button"]:has-text("Finish")',
          'button:has-text("Continue")',
          '[role="button"]:has-text("Continue")',
          'div[tabindex="0"]:has-text("Submit")',
          'div[tabindex="0"]:has-text("Finish")',
          'div[tabindex="0"]:has-text("Continue")'
        ].join(', ')).first();
        await submitBtn.waitFor({ timeout: 20000 });
        // Wait for enabled/clickable state
        const handle = await submitBtn.elementHandle();
        if (handle) {
          for (let i = 0; i < 30; i++) {
            const ok = await page.evaluate((el) => {
              const s = window.getComputedStyle(el);
              const pe = s.pointerEvents !== 'none';
              const op = Number(s.opacity || '1') > 0.2;
              const disabled = el.getAttribute('aria-disabled') === 'true' || el.hasAttribute('disabled');
              return pe && op && !disabled;
            }, handle);
            if (ok) break;
            await page.waitForTimeout(250);
          }
        }
        // Try multiple click strategies quickly
        let clicked = false;
        for (let i = 0; i < 3 && !clicked; i++) {
          try { await submitBtn.click({ timeout: 1000, force: true }); clicked = true; break; } catch {}
          try { await submitBtn.focus(); await submitBtn.press('Enter'); clicked = true; break; } catch {}
          try { const h = await submitBtn.elementHandle(); if (h) { await h.evaluate((el) => el.click()); clicked = true; break; } } catch {}
          await page.waitForTimeout(200);
        }
        if (clicked) console.log('Liveness Submit/Continue clicked');
      } catch {}

      // Enter PIN 0000 (handles keypad or input fallbacks)
      try {
        await enterPin(page, '0000');
        console.log('PIN entered: 0000');
      } catch {}

      // Click final Continue to finish user creation
      try {
        const contBtn = page.locator('button:has-text("Continue"), [role="button"]:has-text("Continue"), button:has(h1:has-text("Continue"))').first();
        await contBtn.waitFor({ timeout: 15000 });
        // Wait until enabled
        const h = await contBtn.elementHandle();
        if (h) {
          await page.waitForFunction((el) => {
            const s = window.getComputedStyle(el);
            const pe = s.pointerEvents !== 'none';
            const op = Number(s.opacity || '1') > 0.2;
            const dis = el.getAttribute('aria-disabled') === 'true' || el.hasAttribute('disabled');
            return pe && op && !dis;
          }, h, { timeout: 10000 }).catch(() => {});
        }
        await contBtn.click({ force: true });
        console.log('Final Continue clicked');
      } catch {}

      // Open CDM UI after user creation (auth only window) using saved CDM state, then pause
      try {
        const cdmUrl = process.env.CDM_UI_URL || 'https://cdm.st4ge.com/';
        const channel = process.env.CDM_PW_BROWSER_CHANNEL || process.env.PW_BROWSER_CHANNEL || 'chrome';
        const launched = await chromium.launch({ channel, headless: process.env.HEADLESS === '1' });
        const storageStatePath = process.env.PLAYWRIGHT_CDM_STATE || 'e2e/web/auth/.cdm_state.json';
        let ctx;
        try {
          ctx = await launched.newContext({ storageState: storageStatePath });
        } catch {
          ctx = await launched.newContext();
        }
        const cdmPage = await ctx.newPage();
        await cdmPage.goto(cdmUrl);
        await cdmPage.waitForLoadState('domcontentloaded');
        console.log('Opened CDM UI (auth only):', { cdmUrl });
        const cdmDelay = parseInt(process.env.INSPECT_CDM_DELAY_MS || process.env.INSPECT_DELAY_MS || '10000', 10);
        if (cdmDelay > 0) await cdmPage.waitForTimeout(cdmDelay);
        const keepOpen = process.env.INSPECT_CDM_KEEP_OPEN === '1';
        if (!keepOpen) {
          await ctx.close();
          await launched.close();
        }
      } catch {}

      {
        const inspectDelay = parseInt(process.env.INSPECT_DELAY_MS || '100000', 10);
        if (inspectDelay > 0) {
          await page.waitForTimeout(inspectDelay);
        }
      }
      await expect(page.getByText(/verification submitted|pending review/i)).toBeVisible();
    }
  });
});


