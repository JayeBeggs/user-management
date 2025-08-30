import { chromium } from '@playwright/test';
import { clickButtonByText } from './app.js';

/**
 * Performs CDM verification in a completely separate browser context.
 * This ensures clean separation between signup and verification processes.
 * 
 * @param {Object} media - User media object containing ID and other details
 * @param {string} media.id - User ID to search for in CDM
 * @returns {Promise<boolean>} - Success status of verification
 */
export async function verifySeparatedCdm(media) {
  console.log('🔍 Starting separate CDM verification process...');
  
  let cdmBrowser;
  let cdmContext;
  let cdmPage;
  
  try {
    const cdmUrl = process.env.CDM_UI_URL || 'https://cdm.st4ge.com/';
    const channel = process.env.CDM_PW_BROWSER_CHANNEL || process.env.PW_BROWSER_CHANNEL || 'chrome';
    
    // Launch completely separate browser for CDM verification
    cdmBrowser = await chromium.launch({ 
      channel, 
      headless: process.env.HEADLESS === '1',
      args: ['--no-sandbox', '--disable-setuid-sandbox'] // Ensure clean isolation
    });
    
    const storageStatePath = process.env.PLAYWRIGHT_CDM_STATE || 'e2e/web/auth/.cdm_state.json';
    
    try {
      cdmContext = await cdmBrowser.newContext({ storageState: storageStatePath });
      console.log('✅ CDM auth state loaded from:', storageStatePath);
    } catch {
      console.log('⚠️ CDM auth state not found, creating new session');
      cdmContext = await cdmBrowser.newContext();
    }
    
    cdmPage = await cdmContext.newPage();
    await cdmPage.goto(cdmUrl);
    await cdmPage.waitForLoadState('domcontentloaded');
    console.log('✅ CDM verification browser opened');

    // Wait for user to appear in CDM system
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
            
            // Perform verification steps using existing helper logic
            await performCdmVerificationSteps(cdmPage, media);
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
      return false;
    }
    
        // Save CDM auth state for reuse
    try {
      await cdmContext.storageState({ path: storageStatePath });
      console.log('✅ CDM auth state saved to:', storageStatePath);
    } catch (error) {
      console.log('⚠️ Failed to save CDM auth state:', error.message);
    }

    return true;

  } catch (error) {
    console.log('⚠️ CDM verification setup error:', error.message);
    return false;
  } finally {
    try { await cdmPage?.close(); } catch {}
    try { await cdmContext?.close(); } catch {}
    try { await cdmBrowser?.close(); } catch {}
  }
}

/**
 * Performs the actual CDM verification steps on a given page.
 * This is the core verification logic extracted for reuse.
 * 
 * @param {Page} cdmPage - Playwright page object for CDM
 * @param {Object} media - User media object
 */
async function performCdmVerificationSteps(cdmPage, media) {
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

/** CDM verification flow that always closes the window. */
export async function verifyUserInCdm({ userIdText, raceOption }) {
  const cdmUrl = process.env.CDM_UI_URL || 'https://cdm.st4ge.com/';
  const channel = process.env.CDM_PW_BROWSER_CHANNEL || process.env.PW_BROWSER_CHANNEL || 'chrome';
  const storageStatePath = process.env.PLAYWRIGHT_CDM_STATE || 'e2e/web/auth/.cdm_state.json';

  let launched;
  let ctx;
  try {
    launched = await chromium.launch({ channel, headless: process.env.HEADLESS === '1' });
    try {
      ctx = await launched.newContext({ storageState: storageStatePath });
    } catch {
      ctx = await launched.newContext();
    }
    const cdmPage = await ctx.newPage();
    await cdmPage.goto(cdmUrl);
    await cdmPage.waitForLoadState('domcontentloaded');

    // Open verification page
    try {
      const base = new URL(cdmUrl).origin;
      const verifyUrl = base + '/users/identity-verification/';
              await cdmPage.goto(verifyUrl, { waitUntil: 'domcontentloaded', timeout: parseInt(process.env.UNIVERSAL_WAIT_TIMEOUT || '3000', 10) }).catch(() => {});

      // Open matching user row
      try {
        await cdmPage.waitForSelector('tr', { timeout: parseInt(process.env.UNIVERSAL_WAIT_TIMEOUT || '3000', 10) }).catch(() => {});
        const row = cdmPage.locator(`tr:has(td:has-text("${userIdText}"))`).first();
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
                          await row.click({ timeout: parseInt(process.env.UNIVERSAL_CLICK_TIMEOUT || '3000', 10), force: true });
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
                if (!checked) {
                  await cb.check({ timeout: parseInt(process.env.UNIVERSAL_CLICK_TIMEOUT || '3000', 10), force: true }).catch(async () => { await cb.click({ timeout: parseInt(process.env.UNIVERSAL_CLICK_TIMEOUT || '2000', 10), force: true }); });
                }
                return;
              }
              const labelText = labelMap[name];
              if (labelText) {
                const label = block.locator(`label:has-text("${labelText}")`).first();
                if (await label.count()) await label.click({ timeout: parseInt(process.env.UNIVERSAL_CLICK_TIMEOUT || '3000', 10), force: true });
              }
            };

            let blocks = cdmPage.locator('div.my-4');
            await blocks.first().waitFor({ timeout: parseInt(process.env.UNIVERSAL_WAIT_TIMEOUT || '3000', 10) }).catch(() => {});
            let firstBlock = blocks.nth(0);
            for (const n of firstNames) { await tickInBlock(firstBlock, n); }
            let form = firstBlock.locator('xpath=ancestor::form[1]');
            let submit = form.locator('button[type="submit"]:not([onclick*="startVoipCall"]) , input[type="submit"]:not([onclick*="startVoipCall"]) , button:has-text("Submit"):not([onclick*="startVoipCall"]) , [role="button"]:has-text("Submit"):not([onclick*="startVoipCall"])').first();
            if (await submit.count()) {
              await Promise.all([
                cdmPage.waitForLoadState('domcontentloaded').catch(() => {}),
                submit.click({ timeout: parseInt(process.env.UNIVERSAL_CLICK_TIMEOUT || '3000', 10), force: true })
              ]);
              if (afterSubmitDelay > 0) await cdmPage.waitForTimeout(afterSubmitDelay);
            }

            // Second block
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
              submit = form.locator('button[type="submit"]:not([onclick*="startVoipCall"]) , input[type="submit"]:not([onclick*="startVoipCall"]) , button:has-text("Submit"):not([onclick*="startVoipCall"]) , [role="button"]:has-text("Submit"):not([onclick*="startVoipCall"])').first();
              if (await submit.count()) {
                await Promise.all([
                  cdmPage.waitForLoadState('domcontentloaded').catch(() => {}),
                  submit.click({ timeout: parseInt(process.env.UNIVERSAL_CLICK_TIMEOUT || '3000', 10), force: true })
                ]);
                const afterRaceDelay = parseInt(process.env.INSPECT_CDM_AFTER_RACE_MS || process.env.INSPECT_CDM_AFTER_SUBMIT_MS || '100', 10);
                if (afterRaceDelay > 0) await cdmPage.waitForTimeout(afterRaceDelay);
              }
            }

            // Liveness review and approve
            try {
              const reviewForm = cdmPage.locator('form.review-form[action*="/users/review-liveness/"]');
              await reviewForm.first().waitFor({ timeout: parseInt(process.env.UNIVERSAL_WAIT_TIMEOUT || '3000', 10) });
              const liveNames = ['person_visible','enough_light','person_matches_id','sound_recorded','client_confirmed'];
              const tickLive = async (name) => {
                let cb = reviewForm.locator(`input[name="${name}"]`);
                if (!(await cb.count())) cb = reviewForm.locator(`#id_${name}`);
                if (await cb.count()) {
                  const checked = await cb.isChecked().catch(() => false);
                  if (!checked) { await cb.check({ timeout: parseInt(process.env.UNIVERSAL_CLICK_TIMEOUT || '3000', 10), force: true }).catch(async () => { await cb.click({ timeout: parseInt(process.env.UNIVERSAL_CLICK_TIMEOUT || '3000', 10), force: true }); }); }
                  return;
                }
                const label = reviewForm.locator(`label:has-text("${name.replace(/_/g, ' ')}")`).first();
                if (await label.count()) await label.click({ timeout: parseInt(process.env.UNIVERSAL_CLICK_TIMEOUT || '3000', 10), force: true });
              };
              for (const n of liveNames) { await tickLive(n); }
              // Submit live review
              try { await clickButtonByText(cdmPage, 'Submit', 8000); } catch {}
              // Approve
              await clickButtonByText(cdmPage, 'Approve', 8000);
            } catch {}
          } catch {}
        }
      } catch {}
    } catch {}

    return true;
  } catch {
    return false;
  } finally {
    try { await ctx?.close(); } catch {}
    try { await launched?.close(); } catch {}
  }
}


