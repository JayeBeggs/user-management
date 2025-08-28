import { test, expect, chromium } from '@playwright/test';
import { getOtp, enterOtp } from '../utils/otp.js';
import { setPhoneNumber, enterPin } from '../utils/inputs.js';
import { clickUploadCta, uploadIdSection, recordLivenessWithRetry } from '../utils/kyc.js';

const NUM_USERS = parseInt(process.env.NUM_USERS || '5', 10);

async function generateUserMedia() {
  const { spawnSync } = await import('child_process');
  const seed = `u${Date.now()}${Math.floor(Math.random()*1000)}`;
  const env = { ...process.env, TEST_SEED: seed };
  const res = spawnSync('node', ['e2e/tools/generate_user_media.js'], { encoding: 'utf8', env });
  if (res.status !== 0) throw new Error('generate_user_media failed');
  return JSON.parse(res.stdout);
}

// (helper moved to utils/otp)

// Note: Admin UI verification helper removed; CDM verification is handled via CDM UI window

// (helper moved to utils/otp)

// (helper moved to utils/otp)

// (helper moved to utils/otp)

// (helper moved to utils/kyc)

// (helper moved to utils/kyc)

// (helper moved to utils/kyc)

// (helper moved to utils/kyc)

// (helper moved to utils/kyc)

// moved to utils/inputs
// (helper moved to utils/inputs)
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

// moved to utils/inputs
// (helper moved to utils/inputs)
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

// (helper moved to utils/inputs)

// moved to utils/inputs
// (helper moved to utils/inputs)
// (helper moved to utils/inputs)

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


