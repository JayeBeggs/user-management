import { test, expect, chromium } from '@playwright/test';
import { clickStartEarning, loginWithPhone } from '../utils/app.js';
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

//
async function clickPinDigit(page, digitText = '0', times = 1) {
  // Click a keypad digit by trying several selectors
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

//
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
      // Landing
      const phoneDigits = (process.env.DEFAULT_PHONE && String(process.env.DEFAULT_PHONE).replace(/\D/g, ''))
        || `082${Math.floor(1000000 + Math.random()*8999999)}`;
      const ok = await setPhoneNumber(page, phoneDigits);
      if (!ok) throw new Error('PHONE_INPUT_NOT_FILLED');
      console.log('Phone input filled:', phoneDigits);
      // Request OTP via SMS

      console.log('Clicking SMS to request OTP');
      await page.getByRole('button', { name: /sms/i }).click();

      // Fetch OTP from admin panel

      console.log('Fetching OTP from admin');
      const otp = await getOtp({ browser, type: 'signup' });
      await enterOtp(page, otp);
      console.log('OTP entered');



      // After OTP, wait for Name input
      console.log('Waiting for Name field');
      await page.locator('input[placeholder="Name"]').waitFor({ timeout: 20000 });

      // Fill Name then click Next
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

      // Fill ID and click Next
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

      // Fill Email and click Next
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

      // Click the "I'm ready" button before KYC
      try {
        const ready = page.locator('button:has-text("I\'m ready"), button:has(h1:has-text("I\'m ready")), [role="button"]:has-text("I\'m ready")').first();
        await ready.click({ timeout: 5000, force: true });
        console.log('Clicked first I\'m ready');
      } catch {}

      // Select ID type: ID Card
      try {
        await page.locator('div:has(> button:has(h1))').first().waitFor({ timeout: 5000 }).catch(() => {});
        const card = page.locator('button:has-text("ID Card"), button:has(h1:has-text("ID Card")), [role="button"]:has-text("ID Card")').first();
        await card.click({ timeout: 5000, force: true });
        console.log('Selected ID type: ID Card');
      } catch {}

      // Click Upload CTA if present
      try { const did = await clickUploadCta(page); console.log('Upload CTA clicked:', !!did); } catch {}

      console.log('Uploading ID images');
      // Upload ID front/back and submit
      await uploadIdSection(page, 'ID Front', media.idFront);
      console.log('Set ID Front file:', media.idFront);
      await uploadIdSection(page, 'ID Back', media.idBack);
      console.log('Set ID Back file:', media.idBack);

      // Click the final Upload button in this section
      try {
        const uploadBtn = page.locator('button:has-text("Upload"), [role="button"]:has-text("Upload")').first();
        await uploadBtn.waitFor({ timeout: 10000 });
        // Wait until clickable
        await page.waitForFunction((el) => {
          const style = window.getComputedStyle(el);
          const pe = style.pointerEvents !== 'none';
          const op = Number(style.opacity || '1') > 0.2;
          return pe && op;
        }, await uploadBtn.elementHandle(), { timeout: 10000 }).catch(() => {});
        await uploadBtn.click({ force: true });
        console.log('Submitted ID images');
      } catch {}

      // Continue/Submit after upload
      try {
        await page.getByRole('button', { name: /continue|submit/i }).first().click();
        console.log('Post-upload Continue/Submit clicked');
      } catch {}

      // Click second "I'm ready"
      try {
        const ready2 = page.locator('button:has-text("I\'m ready"), button:has(h1:has-text("I\'m ready")), [role="button"]:has-text("I\'m ready")').first();
        await ready2.click({ timeout: 5000, force: true });
        console.log('Clicked second I\'m ready');
      } catch {}

      // Start/stop liveness recording (with retry)
      try { await recordLivenessWithRetry(page); } catch {}

      // After recording, click Submit/Continue
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
        // Wait for enabled/clickable
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
        // Fallback click strategies
        let clicked = false;
        for (let i = 0; i < 3 && !clicked; i++) {
          try { await submitBtn.click({ timeout: 1000, force: true }); clicked = true; break; } catch {}
          try { await submitBtn.focus(); await submitBtn.press('Enter'); clicked = true; break; } catch {}
          try { const h = await submitBtn.elementHandle(); if (h) { await h.evaluate((el) => el.click()); clicked = true; break; } } catch {}
          await page.waitForTimeout(200);
        }
        if (clicked) console.log('Liveness Submit/Continue clicked');
      } catch {}

      // Enter PIN 0000
      try {
        await enterPin(page, '0000');
        console.log('PIN entered: 0000');
      } catch {}

      // Final Continue to create user
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

      // CDM verification window
      let launched;
      let ctx;
      try {
        const cdmUrl = process.env.CDM_UI_URL || 'https://cdm.st4ge.com/';
        const channel = process.env.CDM_PW_BROWSER_CHANNEL || process.env.PW_BROWSER_CHANNEL || 'chrome';
        launched = await chromium.launch({ channel, headless: process.env.HEADLESS === '1' });
        const storageStatePath = process.env.PLAYWRIGHT_CDM_STATE || 'e2e/web/auth/.cdm_state.json';
        try {
          ctx = await launched.newContext({ storageState: storageStatePath });
        } catch {
          ctx = await launched.newContext();
        }
        const cdmPage = await ctx.newPage();
        await cdmPage.goto(cdmUrl);
        await cdmPage.waitForLoadState('domcontentloaded');
        console.log('Opened CDM UI (auth only):', { cdmUrl });
        // Navigate to Verification page
        try {
          const base = new URL(cdmUrl).origin;
          const verifyUrl = base + '/users/identity-verification/';
          console.log('Opening Verification URL:', verifyUrl);
          await cdmPage.goto(verifyUrl, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
          // Jump to the row matching the new user's ID
          try {
            const idText = String(media.id);
            await cdmPage.waitForSelector('tr', { timeout: 5000 }).catch(() => {});
            const row = cdmPage.locator(`tr:has(td:has-text("${idText}"))`).first();
            if (await row.count()) {
              // Parse onclick URL
              const relative = await row.evaluate((el) => {
                const m = (el.getAttribute('onclick') || '').match(/'([^']+)'/);
                return m ? m[1] : null;
              });
              if (relative) {
                const dest = new URL(relative, cdmPage.url()).toString();
                await cdmPage.goto(dest);
              } else {
                // Fallback to force click
                await row.click({ timeout: 1500, force: true });
              }
              // Verification detail: tick blocks and submit
              try {
                const labelMap = {
                  image_contains_id: 'Image contains an ID',
                  id_readable: 'ID is readable and not blurry',
                  id_of_person: 'Image is the ID of the person signing up',
                  image_in_color: 'Image is in colour',
                  id_condition: 'ID is in an acceptable condition',
                  id_in_frame: 'The ID is in frame',
                  latest_id: 'ID provided is the latest issued ID'
                };
                const firstNames = ['image_contains_id','id_readable','id_of_person','image_in_color','id_condition','id_in_frame'];
                const secondNames = ['image_contains_id','id_readable','id_of_person','image_in_color','id_condition','id_in_frame','latest_id'];
                const afterSubmitDelay = parseInt(process.env.INSPECT_CDM_AFTER_SUBMIT_MS || '100', 10);
                const tickInBlock = async (block, name) => {
                  let cb = block.locator(`input[name="${name}"]`);
                  if (!(await cb.count())) cb = block.locator(`#id_${name}`);
                  if (await cb.count()) {
                    const checked = await cb.isChecked().catch(() => false);
                    if (!checked) { await cb.check({ timeout: 800, force: true }).catch(async () => { await cb.click({ timeout: 800, force: true }); }); }
                    return;
                  }
                  const labelText = labelMap[name];
                  if (labelText) {
                    const label = block.locator(`label:has-text("${labelText}")`).first();
                    if (await label.count()) await label.click({ timeout: 800, force: true });
                  }
                };
                // First block
                let blocks = cdmPage.locator('div.my-4');
                await blocks.first().waitFor({ timeout: 5000 }).catch(() => {});
                let firstBlock = blocks.nth(0);
                for (const n of firstNames) { await tickInBlock(firstBlock, n); }
                // Submit and wait
                let form = firstBlock.locator('xpath=ancestor::form[1]');
                let submit = form.locator('button[type="submit"]:not([onclick*="startVoipCall"]) , input[type="submit"]:not([onclick*="startVoipCall"]) , button:has-text("Submit"):not([onclick*="startVoipCall"]) , [role="button"]:has-text("Submit"):not([onclick*="startVoipCall"])').first();
                if (await submit.count()) {
                  await Promise.all([
                    cdmPage.waitForLoadState('domcontentloaded').catch(() => {}),
                    submit.click({ timeout: 2000, force: true })
                  ]);
                  //if (afterSubmitDelay > 0) await cdmPage.waitForTimeout(afterSubmitDelay);
                }
                // Second block
                blocks = cdmPage.locator('div.my-4');
                let secondBlock = blocks.nth(1);
                try {
                  const latestLabel = cdmPage.locator('label:has-text("ID provided is the latest issued ID")').first();
                  await latestLabel.waitFor({ timeout: 15000 });
                  secondBlock = latestLabel.locator('xpath=ancestor::div[contains(@class, "my-4")][1]');
                } catch {}
                if (await secondBlock.count()) {
                  for (const n of secondNames) { await tickInBlock(secondBlock, n); }
                  form = secondBlock.locator('xpath=ancestor::form[1]');
                  submit = form.locator('button[type="submit"]:not([onclick*="startVoipCall"]) , input[type="submit"]:not([onclick*="startVoipCall"]) , button:has-text("Submit"):not([onclick*="startVoipCall"]) , [role="button"]:has-text("Submit"):not([onclick*="startVoipCall"])').first();
                  if (await submit.count()) {
                    await Promise.all([
                      cdmPage.waitForLoadState('domcontentloaded').catch(() => {}),
                      submit.click({ timeout: 2000, force: true })
                    ]);
                    //if (afterSubmitDelay > 0) await cdmPage.waitForTimeout(afterSubmitDelay);
                  }
                }
                // Race update form
                try {
                  // Find form by action or class
                  const raceForm = cdmPage.locator('form.update-form[action*="/users/update-race/"]');
                  await raceForm.first().waitFor({ timeout: 10000 });
                  // Select a race
                  const raceValue = (process.env.RACE_OPTION || 'coloured').toLowerCase();
                  const select = raceForm.locator('select#id_race, select[name="race"]').first();
                  // Try by value, then label, then keyboard
                  let selected = false;
                  try { await select.selectOption(raceValue); selected = true; } catch {}
                  if (!selected) {
                    const label = raceValue.charAt(0).toUpperCase() + raceValue.slice(1);
                    try { await select.selectOption({ label }); selected = true; } catch {}
                  }
                  if (!selected) {
                    await select.click({ force: true });
                    await cdmPage.keyboard.type(raceValue, { delay: 10 });
                    await cdmPage.keyboard.press('Enter');
                  }
                  const updateBtn = raceForm.locator('button.btn.btn-accent, button:has-text("Update"), input[type="submit"]').first();
                  if (await updateBtn.count()) {
                    await Promise.all([
                      cdmPage.waitForLoadState('domcontentloaded').catch(() => {}),
                      updateBtn.click({ timeout: 2000, force: true })
                    ]);
                    const afterRaceDelay = parseInt(process.env.INSPECT_CDM_AFTER_RACE_MS || process.env.INSPECT_CDM_AFTER_SUBMIT_MS || '100', 10);
                    if (afterRaceDelay > 0) await cdmPage.waitForTimeout(afterRaceDelay);
                  }
                } catch {}

                // Liveness review and Approve
                try {
                  const reviewForm = cdmPage.locator('form.review-form[action*="/users/review-liveness/"]');
                  await reviewForm.first().waitFor({ timeout: 10000 });
                  const liveNames = ['person_visible','enough_light','person_matches_id','sound_recorded','client_confirmed'];
                  const tickLive = async (name) => {
                    let cb = reviewForm.locator(`input[name="${name}"]`);
                    if (!(await cb.count())) cb = reviewForm.locator(`#id_${name}`);
                    if (await cb.count()) {
                      const checked = await cb.isChecked().catch(() => false);
                      if (!checked) { await cb.check({ timeout: 800, force: true }).catch(async () => { await cb.click({ timeout: 800, force: true }); }); }
                      return;
                    }
                    const label = reviewForm.locator(`label:has-text("${name.replace(/_/g, ' ')}")`).first();
                    if (await label.count()) await label.click({ timeout: 800, force: true });
                  };
                  for (const n of liveNames) { await tickLive(n); }
                  const submitLive = reviewForm.locator('button[type="submit"]:not([onclick*="startVoipCall"]) , input[type="submit"]:not([onclick*="startVoipCall"]) , button:has-text("Submit"):not([onclick*="startVoipCall"])').first();
                  if (await submitLive.count()) {
                    await Promise.all([
                      cdmPage.waitForLoadState('domcontentloaded').catch(() => {}),
                      submitLive.click({ timeout: 1500, force: true })
                    ]);
                  }
                  // Approve
                  try {
                    const approveBtn = cdmPage.locator('button:has-text("Approve"), [role="button"]:has-text("Approve"), .btn:has-text("Approve")').first();
                    await approveBtn.waitFor({ timeout: 8000 });
                    await approveBtn.click({ timeout: 1500, force: true });
                    // After approval, login as the created user and continue
                    try {
                      await page.goto('/');
                      await loginWithPhone(page, browser);
                      // Continue: Personalise My Products and onward
                      try {
                        const personalise = page.locator('button:has(h1:has-text("Personalise My Products")), button:has-text("Personalise My Products"), [role="button"]:has-text("Personalise My Products")').first();
                        await personalise.waitFor({ timeout: 10000 }).catch(() => {});
                        try { await personalise.click({ timeout: 2000, force: true }); } catch {}
                      } catch {}
                      // Next: click "Lets Go!" / "Let's Go!" if present
                      try {
                        const letsGo = page.locator(
                          [
                            'button:has(h1:has-text("Lets Go!"))',
                            'button:has(h1:has-text("Let\'s Go!"))',
                            'button:has-text("Lets Go!")',
                            'button:has-text("Let\'s Go!")',
                            '[role="button"]:has-text("Lets Go!")',
                            '[role="button"]:has-text("Let\'s Go!")'
                          ].join(', ')
                        ).first();
                        await letsGo.waitFor({ timeout: 8000 }).catch(() => {});
                        try { await letsGo.click({ timeout: 2000, force: true }); } catch {}
                      } catch {}
                      // Then: click "Next" if present
                      try {
                        const nextBtn = page.locator(
                          [
                            'button:has(h1:has-text("Next"))',
                            'button:has-text("Next")',
                            '[role="button"]:has-text("Next")'
                          ].join(', ')
                        ).first();
                        await nextBtn.waitFor({ timeout: 8000 }).catch(() => {});
                        try { await nextBtn.click({ timeout: 2000, force: true }); } catch {}
                      } catch {}
                      // Employment status: select Yes/No and click Next
                      try {
                        const question = page.locator('text=Are you currently employed?').first();
                        await question.waitFor({ timeout: 8000 });
                        const employed = (process.env.EMPLOYED || '1') === '1';
                        const choice = employed
                          ? page.locator('div[tabindex="0"]:has(h1:has-text("Yes")), button:has(h1:has-text("Yes")), [role="button"]:has-text("Yes")').first()
                          : page.locator('div[tabindex="0"]:has(h1:has-text("No")), button:has(h1:has-text("No")), [role="button"]:has-text("No")').first();
                        await choice.waitFor({ timeout: 5000 }).catch(() => {});
                        try { await choice.click({ timeout: 1500, force: true }); } catch {}
                        const next2 = page.locator(
                          [
                            'button:has(h1:has-text("Next"))',
                            'button:has-text("Next")',
                            '[role="button"]:has-text("Next")'
                          ].join(', ')
                        ).first();
                        await next2.waitFor({ timeout: 8000 }).catch(() => {});
                        try { await next2.click({ timeout: 1500, force: true }); } catch {}
                      } catch {}
                      // Income band: select highest ("R 25000+") and click Next
                      try {
                        const incomeQ = page.locator('text=What are you currently earning per month?').first();
                        await incomeQ.waitFor({ timeout: 8000 });
                        const highest = page.locator(
                          [
                            'div[tabindex="0"]:has(h1:has-text("R 25000+"))',
                            'button:has(h1:has-text("R 25000+"))',
                            '[role="button"]:has-text("R 25000+")'
                          ].join(', ')
                        ).first();
                        await highest.waitFor({ timeout: 5000 }).catch(() => {});
                        try { await highest.click({ timeout: 1500, force: true }); } catch {}
                        const next3 = page.locator(
                          [
                            'button:has(h1:has-text("Next"))',
                            'button:has-text("Next")',
                            '[role="button"]:has-text("Next")'
                          ].join(', ')
                        ).first();
                        await next3.waitFor({ timeout: 8000 }).catch(() => {});
                        try { await next3.click({ timeout: 1500, force: true }); } catch {}
                      } catch {}
                      // Tax registration: default select "South Africa Only" and click Next
                      try {
                        const taxQ = page.locator('text=Where are you registered for tax?').first();
                        await taxQ.waitFor({ timeout: 8000 });
                        const saOnly = page.locator(
                          [
                            'div[tabindex="0"]:has(h1:has-text("South Africa Only"))',
                            'button:has(h1:has-text("South Africa Only"))',
                            '[role="button"]:has-text("South Africa Only")'
                          ].join(', ')
                        ).first();
                        await saOnly.waitFor({ timeout: 5000 }).catch(() => {});
                        try { await saOnly.click({ timeout: 1500, force: true }); } catch {}
                        const next4 = page.locator(
                          [
                            'button:has(h1:has-text("Next"))',
                            'button:has-text("Next")',
                            '[role="button"]:has-text("Next")'
                          ].join(', ')
                        ).first();
                        await next4.waitFor({ timeout: 8000 }).catch(() => {});
                        try { await next4.click({ timeout: 1500, force: true }); } catch {}
                      } catch {}
                      // Debt review/insolvency: default select "No" and click Next
                      try {
                        const debtQ = page.locator('text=Are you currently under debt review, or have you ever been declared insolvent?').first();
                        await debtQ.waitFor({ timeout: 8000 });
                        const underDebt = (process.env.DEBT_REVIEW || '0') === '1';
                        const choice = underDebt
                          ? page.locator('div[tabindex="0"]:has(h1:has-text("Yes")), button:has(h1:has-text("Yes")), [role="button"]:has-text("Yes")').first()
                          : page.locator('div[tabindex="0"]:has(h1:has-text("No")), button:has(h1:has-text("No")), [role="button"]:has-text("No")').first();
                        await choice.waitFor({ timeout: 5000 }).catch(() => {});
                        try { await choice.click({ timeout: 1500, force: true }); } catch {}
                        const next5 = page.locator(
                          [
                            'button:has(h1:has-text("Next"))',
                            'button:has-text("Next")',
                            '[role="button"]:has-text("Next")'
                          ].join(', ')
                        ).first();
                        await next5.waitFor({ timeout: 8000 }).catch(() => {});
                        try { await next5.click({ timeout: 1500, force: true }); } catch {}
                      } catch {}
                      // Click Start Earning to finish onboarding
                      await clickStartEarning(page);
                    } catch {}
                  } catch {}
                } catch {}
              } catch {}
            }
          } catch {}
        } catch {}
      } catch {}
      finally {
        try { await ctx?.close(); } catch {}
        try { await launched?.close(); } catch {}
      }

      {
        const inspectDelay = parseInt(process.env.INSPECT_DELAY_MS || '100', 10);
        if (inspectDelay > 0) {
          await page.waitForTimeout(inspectDelay);
        }
      }
      await expect(page.getByText(/verification submitted|pending review/i)).toBeVisible();
    }
  });
});


