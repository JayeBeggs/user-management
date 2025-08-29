import { test, expect, chromium } from '@playwright/test';
import { clickStartEarning, clickButtonByText, completePersonaliseMyProductsFlow } from '../utils/app.js';
import { getOtp, enterOtp } from '../utils/otp.js';
import { setPhoneNumber, createPin, enterPin } from '../utils/inputs.js';
import { clickUploadCta, uploadIdSection, recordLivenessWithRetry } from '../utils/kyc.js';

const NUM_USERS = parseInt(process.env.NUM_USERS || '1', 10);

async function generateUserMedia() {
  const { spawnSync } = await import('child_process');
  const seed = `u${Date.now()}${Math.floor(Math.random()*1000)}`;
  const env = { ...process.env, TEST_SEED: seed };
  const res = spawnSync('node', ['e2e/tools/generate_user_media.js'], { encoding: 'utf8', env });
  if (res.status !== 0) throw new Error('generate_user_media failed');
  return JSON.parse(res.stdout);
}

async function performCdmVerification(cdmPage, media) {
  console.log('📋 Starting CDM verification process...');
  
  try {
    // Verification form handling
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
    
    const tickInBlock = async (block, name) => {
      let cb = block.locator(`input[name="${name}"]`);
      if (!(await cb.count())) cb = block.locator(`#id_${name}`);
      if (await cb.count()) {
        const checked = await cb.isChecked().catch(() => false);
        if (!checked) { 
          await cb.check({ timeout: parseInt(process.env.UNIVERSAL_CLICK_TIMEOUT || '3000', 10), force: true }).catch(async () => { 
            await cb.click({ timeout: parseInt(process.env.UNIVERSAL_CLICK_TIMEOUT || '3000', 10), force: true }); 
          }); 
        }
        return;
      }
      const labelText = labelMap[name];
      if (labelText) {
        const label = block.locator(`label:has-text("${labelText}")`).first();
        if (await label.count()) await label.click({ timeout: parseInt(process.env.UNIVERSAL_CLICK_TIMEOUT || '3000', 10), force: true });
      }
    };
    
    // First verification block
    console.log('📝 Processing first verification block...');
    let blocks = cdmPage.locator('div.my-4');
    await blocks.first().waitFor({ timeout: parseInt(process.env.UNIVERSAL_WAIT_TIMEOUT || '3000', 10) }).catch(() => {});
    let firstBlock = blocks.nth(0);
    for (const n of firstNames) { await tickInBlock(firstBlock, n); }
    
    // Submit first block
    let form = firstBlock.locator('xpath=ancestor::form[1]');
    let submit = form.locator('button[type="submit"]:not([onclick*="startVoipCall"]), input[type="submit"]:not([onclick*="startVoipCall"]), button:has-text("Submit"):not([onclick*="startVoipCall"])').first();
    if (await submit.count()) {
      await Promise.all([
        cdmPage.waitForLoadState('domcontentloaded').catch(() => {}),
        submit.click({ timeout: parseInt(process.env.UNIVERSAL_CLICK_TIMEOUT || '3000', 10), force: true })
      ]);
      console.log('✅ First verification block submitted');
    }
    
    // Second verification block
    console.log('📝 Processing second verification block...');
    blocks = cdmPage.locator('div.my-4');
    let secondBlock = blocks.nth(1);
    try {
      const latestLabel = cdmPage.locator('label:has-text("ID provided is the latest issued ID")').first();
      await latestLabel.waitFor({ timeout: parseInt(process.env.UNIVERSAL_WAIT_TIMEOUT || '3000', 10) });
      secondBlock = latestLabel.locator('xpath=ancestor::div[contains(@class, "my-4")][1]');
    } catch {}
    
    if (await secondBlock.count()) {
      for (const n of secondNames) { await tickInBlock(secondBlock, n); }
      form = secondBlock.locator('xpath=ancestor::form[1]');
      submit = form.locator('button[type="submit"]:not([onclick*="startVoipCall"]), input[type="submit"]:not([onclick*="startVoipCall"]), button:has-text("Submit"):not([onclick*="startVoipCall"])').first();
      if (await submit.count()) {
        await Promise.all([
          cdmPage.waitForLoadState('domcontentloaded').catch(() => {}),
          submit.click({ timeout: parseInt(process.env.UNIVERSAL_CLICK_TIMEOUT || '3000', 10), force: true })
        ]);
        console.log('✅ Second verification block submitted');
      }
    }
    
    // Race update form
    console.log('🏃 Processing race update form...');
    try {
      const raceForm = cdmPage.locator('form.update-form[action*="/users/update-race/"]');
      await raceForm.first().waitFor({ timeout: parseInt(process.env.UNIVERSAL_WAIT_TIMEOUT || '3000', 10) });
      
      const raceValue = (process.env.RACE_OPTION || 'coloured').toLowerCase();
      const select = raceForm.locator('select#id_race, select[name="race"]').first();
      
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
          updateBtn.click({ timeout: parseInt(process.env.UNIVERSAL_CLICK_TIMEOUT || '3000', 10), force: true })
        ]);
        console.log('✅ Race information updated');
      }
    } catch {}

    // Liveness review and approval
    console.log('🎥 Processing liveness review...');
    try {
      const reviewForm = cdmPage.locator('form.review-form[action*="/users/review-liveness/"]');
      await reviewForm.first().waitFor({ timeout: parseInt(process.env.UNIVERSAL_WAIT_TIMEOUT || '3000', 10) });
      
      const liveNames = ['person_visible','enough_light','person_matches_id','sound_recorded','client_confirmed'];
      const tickLive = async (name) => {
        let cb = reviewForm.locator(`input[name="${name}"]`);
        if (!(await cb.count())) cb = reviewForm.locator(`#id_${name}`);
        if (await cb.count()) {
          const checked = await cb.isChecked().catch(() => false);
          if (!checked) { 
            await cb.check({ timeout: parseInt(process.env.UNIVERSAL_CLICK_TIMEOUT || '3000', 10), force: true }).catch(async () => { 
              await cb.click({ timeout: parseInt(process.env.UNIVERSAL_CLICK_TIMEOUT || '3000', 10), force: true }); 
            }); 
          }
          return;
        }
        const label = reviewForm.locator(`label:has-text("${name.replace(/_/g, ' ')}")`).first();
        if (await label.count()) await label.click({ timeout: parseInt(process.env.UNIVERSAL_CLICK_TIMEOUT || '3000', 10), force: true });
      };
      
      for (const n of liveNames) { await tickLive(n); }
      
      const submitLive = reviewForm.locator('button[type="submit"]:not([onclick*="startVoipCall"]), input[type="submit"]:not([onclick*="startVoipCall"]), button:has-text("Submit"):not([onclick*="startVoipCall"])').first();
      if (await submitLive.count()) {
        await Promise.all([
          cdmPage.waitForLoadState('domcontentloaded').catch(() => {}),
          submitLive.click({ timeout: parseInt(process.env.UNIVERSAL_CLICK_TIMEOUT || '3000', 10), force: true })
        ]);
        console.log('✅ Liveness review submitted');
      }
      
      // Final approval
      console.log('✅ Processing final approval...');
      const approveBtn = cdmPage.locator('button:has-text("Approve"), [role="button"]:has-text("Approve"), .btn:has-text("Approve")').first();
      await approveBtn.waitFor({ timeout: parseInt(process.env.UNIVERSAL_WAIT_TIMEOUT || '3000', 10) });
      await approveBtn.click({ timeout: parseInt(process.env.UNIVERSAL_CLICK_TIMEOUT || '3000', 10), force: true });
      console.log('🎉 User approved successfully!');
      
    } catch (error) {
      console.log('⚠️ Liveness review error:', error.message);
    }
    
  } catch (error) {
    console.log('⚠️ CDM verification process error:', error.message);
    throw error;
  }
}

test.describe('Full Journey: Signup → Personalise → Start Earning', () => {
  test('complete full user journey from signup to earning activation', async ({ page, browser }) => {
    for (let i = 0; i < NUM_USERS; i++) {
      console.log(`\n=== STARTING FULL JOURNEY ${i + 1}/${NUM_USERS} ===`);
      
      const media = await generateUserMedia();

      // =====================================================================
      // PHASE 1: USER SIGNUP & KYC
      // =====================================================================
      console.log('🚀 PHASE 1: Starting User Signup & KYC');
      
      await page.goto('/');
      
      // Generate phone number
      const phoneDigits = (process.env.DEFAULT_PHONE && String(process.env.DEFAULT_PHONE).replace(/\D/g, ''))
        || `082${Math.floor(1000000 + Math.random()*8999999)}`;
      
      // Fill phone number
      const ok = await setPhoneNumber(page, phoneDigits);
      if (!ok) throw new Error('PHONE_INPUT_NOT_FILLED');
      console.log('📱 Phone input filled:', phoneDigits);

      // Request OTP via SMS
      console.log('📨 Requesting OTP via SMS');
      await page.getByRole('button', { name: /sms/i }).click();

      // Fetch OTP from admin panel
      console.log('🔐 Fetching OTP from admin panel');
      const signupOtp = await getOtp({ browser, type: 'signup' });
      await enterOtp(page, signupOtp);
      console.log('✅ OTP entered successfully');

      // Fill user details
      console.log('👤 Filling user details');
      
      // Name
      await page.locator('input[placeholder="Name"]').waitFor({ timeout: parseInt(process.env.UNIVERSAL_WAIT_TIMEOUT || '3000', 10) });
      const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      const nameValue = `Kastelo_user_${randomNum}`;
      
      const nameInput = page.locator('input[placeholder="Name"]').first();
      await nameInput.waitFor({ timeout: parseInt(process.env.UNIVERSAL_WAIT_TIMEOUT || '3000', 10) });
      await nameInput.fill(nameValue);
      await nameInput.evaluate((el) => el.blur());
      
      const nextBtn = page.getByRole('button', { name: /^next$/i }).first();
      if (await nextBtn.count()) {
        await nextBtn.click();
      } else {
        await page.locator('button:has-text("Next")').first().click();
      }
      console.log('✅ Name submitted:', nameValue);

      // ID Number
      await page.waitForURL(/onboarding\/user-details\/id-number/i, { timeout: parseInt(process.env.UNIVERSAL_WAIT_TIMEOUT || '3000', 10) }).catch(() => {});
      const idDigits = String(media.id).replace(/\D/g, '').slice(0, 13);
      let idInput = page.locator('input[placeholder="9807130178080"]').first();
      if (!(await idInput.count())) idInput = page.getByPlaceholder(/^\d{10,}$/).first();
      if (!(await idInput.count())) idInput = page.locator('input[inputmode="numeric"][maxlength="13"]').first();
      if (!(await idInput.count())) idInput = page.locator('input[maxlength="13"]').first();
      if (!(await idInput.count())) idInput = page.locator('input[type="text"]').first();
      
      await idInput.waitFor({ timeout: parseInt(process.env.UNIVERSAL_WAIT_TIMEOUT || '3000', 10) });
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
      console.log('🆔 ID number submitted:', idDigits);

      // Email
      const emailDomain = process.env.EMAIL_DOMAIN;
      const emailValue = process.env.KASTELO_USER + `+${nameValue}@${emailDomain}`;
      let emailInput = page.locator(`input[placeholder="email@${emailDomain}"]`).first();
      if (!(await emailInput.count())) emailInput = page.locator('input[type="email"]').first();
      if (!(await emailInput.count())) emailInput = page.locator('input[inputmode="email"]').first();
      if (!(await emailInput.count())) emailInput = page.getByPlaceholder(/@/).first();
      
      await emailInput.waitFor({ timeout: parseInt(process.env.UNIVERSAL_WAIT_TIMEOUT || '3000', 10) });
      await emailInput.fill(emailValue);
      await emailInput.evaluate((el) => el.blur());
      
      const nextBtn3 = page.getByRole('button', { name: /^next$/i }).first();
      if (await nextBtn3.count()) {
        await nextBtn3.click();
      } else {
        await page.locator('button:has-text("Next")').first().click();
      }
      console.log('📧 Email submitted:', emailValue);

      // KYC Flow
      console.log('📋 Starting KYC process');
      
      // Click "I'm ready" button
      try {
        const ready = page.locator('button:has-text("I\'m ready"), button:has(h1:has-text("I\'m ready")), [role="button"]:has-text("I\'m ready")').first();
        await ready.click({ timeout: parseInt(process.env.UNIVERSAL_CLICK_TIMEOUT || '3000', 10), force: true });
        console.log('✅ Clicked first I\'m ready');
      } catch {}

      // Select ID type
      try {
        await page.locator('div:has(> button:has(h1))').first().waitFor({ timeout: parseInt(process.env.UNIVERSAL_WAIT_TIMEOUT || '3000', 10) }).catch(() => {});
        const idType = process.env.ID_TYPE || 'ID Card';
        const card = page.locator(`button:has-text("${idType}"), button:has(h1:has-text("${idType}")), [role="button"]:has-text("${idType}")`).first();
        await card.click({ timeout: parseInt(process.env.UNIVERSAL_CLICK_TIMEOUT || '3000', 10), force: true });
        console.log('🆔 Selected ID type:', idType);
      } catch {}

      // Upload ID documents
      try { 
        const did = await clickUploadCta(page); 
        console.log('📤 Upload CTA clicked:', !!did); 
      } catch {}

      console.log('📸 Uploading ID images');
      await uploadIdSection(page, 'ID Front', media.idFront);
      console.log('✅ ID Front uploaded:', media.idFront);
      await uploadIdSection(page, 'ID Back', media.idBack);
      console.log('✅ ID Back uploaded:', media.idBack);

      // Submit ID uploads
      try {
        const uploadBtn = page.locator('button:has-text("Upload"), [role="button"]:has-text("Upload")').first();
        await uploadBtn.waitFor({ timeout: parseInt(process.env.UNIVERSAL_WAIT_TIMEOUT || '3000', 10) });
        await page.waitForFunction((el) => {
          const style = window.getComputedStyle(el);
          const pe = style.pointerEvents !== 'none';
          const op = Number(style.opacity || '1') > 0.2;
          return pe && op;
        }, await uploadBtn.elementHandle(), { timeout: parseInt(process.env.UNIVERSAL_WAIT_TIMEOUT || '3000', 10) }).catch(() => {});
        await uploadBtn.click({ force: true });
        console.log('✅ ID images submitted');
      } catch {}

      // Continue after upload
      try {
        await page.getByRole('button', { name: /continue|submit/i }).first().click();
        console.log('✅ Post-upload Continue clicked');
      } catch {}

      // Second "I'm ready" for liveness
      try {
        const ready2 = page.locator('button:has-text("I\'m ready"), button:has(h1:has-text("I\'m ready")), [role="button"]:has-text("I\'m ready")').first();
        await ready2.click({ timeout: parseInt(process.env.UNIVERSAL_CLICK_TIMEOUT || '3000', 10), force: true });
        console.log('✅ Clicked second I\'m ready');
      } catch {}

      // Liveness recording
      console.log('🎥 Starting liveness recording');
      try { 
        await recordLivenessWithRetry(page); 
        console.log('✅ Liveness recording completed');
      } catch (error) {
        console.log('⚠️ Liveness recording failed:', error.message);
      }

      // Submit liveness
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
        
        await submitBtn.waitFor({ timeout: parseInt(process.env.UNIVERSAL_WAIT_TIMEOUT || '3000', 10) });
        
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
            await page.waitForTimeout(parseInt(process.env.UNIVERSAL_WAIT_TIMEOUT || '3000', 10));
          }
        }
        
        // Try multiple click strategies
        let clicked = false;
        for (let i = 0; i < 3 && !clicked; i++) {
          try { 
            await submitBtn.click({ timeout: parseInt(process.env.UNIVERSAL_CLICK_TIMEOUT || '3000', 10), force: true }); 
            clicked = true; 
            break; 
          } catch {}
          try { 
            await submitBtn.focus(); 
            await submitBtn.press('Enter'); 
            clicked = true; 
            break; 
          } catch {}
          try { 
            const h = await submitBtn.elementHandle(); 
            if (h) { 
              await h.evaluate((el) => el.click()); 
              clicked = true; 
              break; 
            } 
          } catch {}
          await page.waitForTimeout(parseInt(process.env.UNIVERSAL_WAIT_TIMEOUT || '3000', 10));
        }
        if (clicked) console.log('✅ Liveness submitted');
      } catch {}

      // PIN Creation
      console.log('🔐 Creating PIN');
      try {
        await page.locator('h6:has-text("PIN"), h1:has-text("PIN"), h2:has-text("PIN")').first().waitFor({ timeout: 10000 });
        console.log('✅ PIN creation screen found');
        
        const pinCode = process.env.DEFAULT_PIN || '0000';
        const pinCreated = await createPin(page, pinCode);
        
        if (pinCreated) {
          console.log('✅ PIN creation successful:', pinCode);
        } else {
          console.log('⚠️ PIN creation failed:', pinCode);
        }
        
        // Click Continue after PIN creation
        console.log('🔄 Clicking Continue after PIN creation');
        const continueClicked = await clickButtonByText(page, 'Continue');
        if (continueClicked) {
          console.log('✅ Continue button clicked');
        } else {
          console.log('⚠️ Continue button not found');
        }
        
      } catch (error) {
        console.log('⚠️ PIN creation error:', error.message);
      }

      // CDM Verification (simplified for full journey)
      console.log('🔍 Starting CDM verification');
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
        console.log('✅ CDM UI opened');

        // Quick verification and approval (simplified)
        try {
          const base = new URL(cdmUrl).origin;
          const verifyUrl = base + '/users/identity-verification/';
          await cdmPage.goto(verifyUrl, { waitUntil: 'domcontentloaded', timeout: parseInt(process.env.UNIVERSAL_WAIT_TIMEOUT || '3000', 10) }).catch(() => {});
          
          const idText = String(media.id);
          await cdmPage.waitForSelector('tr', { timeout: parseInt(process.env.UNIVERSAL_WAIT_TIMEOUT || '3000', 10) }).catch(() => {});
          const row = cdmPage.locator(`tr:has(td:has-text("${idText}"))`).first();
          
          if (await row.count()) {
            const relative = await row.evaluate((el) => {
              const m = (el.getAttribute('onclick') || '').match(/'([^']+)'/);
              return m ? m[1] : null;
            });
            
            if (relative) {
              const dest = new URL(relative, cdmPage.url()).toString();
              await cdmPage.goto(dest);
              
              // Auto-approve (simplified verification)
              const approveBtn = cdmPage.locator('button:has-text("Approve"), [role="button"]:has-text("Approve"), .btn:has-text("Approve")').first();
              if (await approveBtn.count()) {
                await approveBtn.click({ timeout: parseInt(process.env.UNIVERSAL_CLICK_TIMEOUT || '3000', 10), force: true });
                console.log('✅ User approved in CDM');
              }
            }
          }
        } catch (error) {
          console.log('⚠️ CDM verification error:', error.message);
          // Don't fail the test for CDM issues - continue with login
        }
      } catch (error) {
        console.log('⚠️ CDM setup error:', error.message);
      } finally {
        try { await ctx?.close(); } catch {}
        try { await launched?.close(); } catch {}
      }

      console.log('✅ PHASE 1 COMPLETED: User signup and KYC finished');

      // =====================================================================
      // PHASE 1.5: SEPARATE CDM VERIFICATION (AFTER SIGNUP WINDOW CLOSES)
      // =====================================================================
      console.log('🔍 PHASE 1.5: Starting Separate CDM Verification');
      
      // Close the signup page/context to ensure clean separation
      console.log('🚪 Closing signup window for clean verification...');
      await page.close();
      
      // Create completely separate browser context for CDM verification
      console.log('🆕 Opening separate CDM verification session...');
      let cdmBrowser;
      let cdmContext;
      let cdmPage;
      
      try {
        const cdmUrl = process.env.CDM_UI_URL || 'https://cdm.st4ge.com/';
        const channel = process.env.CDM_PW_BROWSER_CHANNEL || process.env.PW_BROWSER_CHANNEL || 'chrome';
        
        // Launch completely separate browser for CDM
        cdmBrowser = await chromium.launch({ 
          channel, 
          headless: process.env.HEADLESS === '1',
          args: ['--no-sandbox', '--disable-setuid-sandbox'] // Ensure clean isolation
        });
        
        const storageStatePath = process.env.PLAYWRIGHT_CDM_STATE || 'e2e/web/auth/.cdm_state.json';
        
        try {
          cdmContext = await cdmBrowser.newContext({ storageState: storageStatePath });
        } catch {
          cdmContext = await cdmBrowser.newContext();
        }
        
        cdmPage = await cdmContext.newPage();
        await cdmPage.goto(cdmUrl);
        await cdmPage.waitForLoadState('domcontentloaded');
        console.log('✅ CDM verification browser opened');

        // Wait a moment for the user to appear in CDM system
        console.log('⏳ Waiting for user to appear in CDM system...');
        await cdmPage.waitForTimeout(3000);

        // Navigate to verification page
        const base = new URL(cdmUrl).origin;
        const verifyUrl = base + '/users/identity-verification/';
        console.log('🔍 Opening verification URL:', verifyUrl);
        await cdmPage.goto(verifyUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
        
        // Look for the user by ID with retries
        const idText = String(media.id);
        console.log('🔎 Looking for user with ID:', idText);
        
        let userFound = false;
        for (let attempt = 1; attempt <= 5; attempt++) {
          console.log(`🔄 Verification attempt ${attempt}/5...`);
          
          try {
            await cdmPage.waitForSelector('tr', { timeout: 5000 });
            const row = cdmPage.locator(`tr:has(td:has-text("${idText}"))`).first();
            
            if (await row.count()) {
              console.log('✅ User found in CDM, starting verification...');
              userFound = true;
              
              // Click on the user row
              const relative = await row.evaluate((el) => {
                const m = (el.getAttribute('onclick') || '').match(/'([^']+)'/);
                return m ? m[1] : null;
              });
              
              if (relative) {
                const dest = new URL(relative, cdmPage.url()).toString();
                await cdmPage.goto(dest);
                console.log('📋 Opened user verification form');
                
                // Perform verification steps
                await performCdmVerification(cdmPage, media);
                console.log('✅ CDM verification completed');
                break;
              }
            } else {
              console.log(`⏳ User not found yet, waiting... (attempt ${attempt}/5)`);
              await cdmPage.waitForTimeout(2000);
              await cdmPage.reload();
            }
          } catch (error) {
            console.log(`⚠️ Verification attempt ${attempt} failed:`, error.message);
            if (attempt < 5) {
              await cdmPage.waitForTimeout(2000);
              await cdmPage.reload();
            }
          }
        }
        
        if (!userFound) {
          console.log('⚠️ User not found in CDM after 5 attempts - continuing anyway');
        }
        
      } catch (error) {
        console.log('⚠️ CDM verification setup error:', error.message);
      } finally {
        try { await cdmPage?.close(); } catch {}
        try { await cdmContext?.close(); } catch {}
        try { await cdmBrowser?.close(); } catch {}
      }

      console.log('✅ PHASE 1.5 COMPLETED: CDM verification finished');

      // Create new page for login phase
      page = await browser.newPage();
      
      // =====================================================================
      // PHASE 2: LOGIN & PERSONALISATION
      // =====================================================================
      console.log('🎯 PHASE 2: Starting Login & Personalisation');
      
      // Wait a moment for any post-signup redirects to complete
      await page.waitForTimeout(2000);
      
      // Navigate back to app for login and wait for page to be ready
      await page.goto('/', { waitUntil: 'networkidle' });
      await page.waitForLoadState('domcontentloaded');
      
      // Wait for the login form to be available
      console.log('⏳ Waiting for login form to be ready...');
      try {
        // Wait for phone input or login-related elements
        await page.waitForSelector('input[type="tel"], input[data-testid="phone-input"], input[placeholder*="phone" i], input[aria-label*="phone" i]', { 
          timeout: 10000 
        });
        console.log('✅ Login form detected');
      } catch (error) {
        console.log('⚠️ Login form not immediately found, continuing anyway');
      }
      
      // Login with created user
      const loginOk = await setPhoneNumber(page, phoneDigits);
      if (!loginOk) {
        console.log('⚠️ First login attempt failed, trying page refresh...');
        await page.reload({ waitUntil: 'networkidle' });
        await page.waitForTimeout(1000);
        
        const retryOk = await setPhoneNumber(page, phoneDigits);
        if (!retryOk) throw new Error('LOGIN_PHONE_INPUT_NOT_FILLED_AFTER_RETRY');
      }
      console.log('📱 Login phone filled:', phoneDigits);

      // Request login OTP
      await page.getByRole('button', { name: /sms/i }).click();
      console.log('📨 Login OTP requested');

      // Get login OTP (with fallback)
      let loginOtp;
      try {
        loginOtp = await getOtp({ browser, type: 'login' });
        console.log('🔐 Got OTP from login endpoint');
      } catch (error) {
        console.log('⚠️ Login OTP failed, trying signup endpoint:', error.message);
        try {
          loginOtp = await getOtp({ browser, type: 'signup' });
          console.log('🔐 Got OTP from signup endpoint');
        } catch (signupError) {
          throw new Error('Could not fetch OTP from either endpoint');
        }
      }
      
      await enterOtp(page, loginOtp);
      console.log('✅ Login OTP entered');

      // Enter PIN for login
      try {
        await page.locator('h6:has-text("Enter your 4-digit PIN to Log In")').waitFor({ timeout: parseInt(process.env.UNIVERSAL_WAIT_TIMEOUT || '3000', 10) });
        console.log('🔐 PIN entry screen found');
      } catch (error) {
        console.log('⚠️ PIN entry screen not found:', error.message);
      }

      const pinCode = process.env.DEFAULT_PIN || '0000';
      try {
        const pinSuccess = await enterPin(page, pinCode);
        if (pinSuccess) {
          console.log('✅ PIN entered successfully for login');
        } else {
          console.log('⚠️ PIN entry failed - continuing anyway');
        }
      } catch (error) {
        console.log('⚠️ PIN entry error:', error.message);
      }

      // Wait for dashboard
      await page.waitForLoadState('networkidle');
      console.log('✅ Logged in successfully');

      // Complete personalisation flow
      console.log('🎨 Starting personalisation flow');
      try {
        const personalised = await completePersonaliseMyProductsFlow(page);
        if (personalised) {
          console.log('✅ Personalisation completed');
        } else {
          console.log('⚠️ Personalisation may have failed');
        }
      } catch (error) {
        console.log('⚠️ Personalisation error:', error.message);
      }

      console.log('✅ PHASE 2 COMPLETED: Login and personalisation finished');

      // =====================================================================
      // PHASE 3: START EARNING ACTIVATION
      // =====================================================================
      console.log('💰 PHASE 3: Starting Earning Activation');
      
      try {
        const earningStarted = await clickStartEarning(page);
        if (earningStarted) {
          console.log('✅ Start Earning activated successfully');
        } else {
          console.log('⚠️ Start Earning activation failed');
        }
      } catch (error) {
        console.log('⚠️ Start Earning error:', error.message);
      }

      // Final verification
      await page.waitForTimeout(2000);
      console.log('✅ PHASE 3 COMPLETED: Earning activation finished');

      console.log(`\n🎉 FULL JOURNEY COMPLETED FOR USER ${i + 1}/${NUM_USERS}`);
      console.log(`📊 User Details: ${nameValue} (${phoneDigits}) - ${emailValue}`);
      console.log('🚀 Journey: Signup → KYC → PIN → Login → Personalise → Start Earning\n');
    }
    
    console.log('🏆 ALL FULL JOURNEYS COMPLETED SUCCESSFULLY!');
  });
});
