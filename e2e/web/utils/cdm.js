import { chromium } from '@playwright/test';
import { clickButtonByText } from './app.js';

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
      await cdmPage.goto(verifyUrl, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});

      // Open matching user row
      try {
        await cdmPage.waitForSelector('tr', { timeout: 5000 }).catch(() => {});
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
                if (!checked) {
                  await cb.check({ timeout: 800, force: true }).catch(async () => { await cb.click({ timeout: 800, force: true }); });
                }
                return;
              }
              const labelText = labelMap[name];
              if (labelText) {
                const label = block.locator(`label:has-text("${labelText}")`).first();
                if (await label.count()) await label.click({ timeout: 800, force: true });
              }
            };

            let blocks = cdmPage.locator('div.my-4');
            await blocks.first().waitFor({ timeout: 5000 }).catch(() => {});
            let firstBlock = blocks.nth(0);
            for (const n of firstNames) { await tickInBlock(firstBlock, n); }
            let form = firstBlock.locator('xpath=ancestor::form[1]');
            let submit = form.locator('button[type="submit"]:not([onclick*="startVoipCall"]) , input[type="submit"]:not([onclick*="startVoipCall"]) , button:has-text("Submit"):not([onclick*="startVoipCall"]) , [role="button"]:has-text("Submit"):not([onclick*="startVoipCall"])').first();
            if (await submit.count()) {
              await Promise.all([
                cdmPage.waitForLoadState('domcontentloaded').catch(() => {}),
                submit.click({ timeout: 2000, force: true })
              ]);
              if (afterSubmitDelay > 0) await cdmPage.waitForTimeout(afterSubmitDelay);
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
                const afterRaceDelay = parseInt(process.env.INSPECT_CDM_AFTER_RACE_MS || process.env.INSPECT_CDM_AFTER_SUBMIT_MS || '100', 10);
                if (afterRaceDelay > 0) await cdmPage.waitForTimeout(afterRaceDelay);
              }
            }

            // Liveness review and approve
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


