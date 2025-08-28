export async function clickUploadCta(page) {
  const cta = page.locator('div[tabindex="0"]:has(h1:has-text("Upload"))').first();
  await cta.waitFor({ timeout: 5000 }).catch(() => {});
  try { await cta.scrollIntoViewIfNeeded(); } catch {}
  try { await cta.click({ timeout: 600, force: true }); return true; } catch {}
  const handle = await cta.elementHandle();
  if (handle) { try { await handle.evaluate((el) => el.click()); return true; } catch {} }
  try {
    const roleBtn = page.locator('[role="button"]:has(h1:has-text("Upload"))').first();
    await roleBtn.waitFor({ timeout: 3000 });
    await roleBtn.click({ force: true });
    return true;
  } catch {}
  return false;
}

export async function uploadIdSection(page, sectionHeadingText, filePath) {
  const heading = page.getByRole('heading', { name: new RegExp(sectionHeadingText, 'i') }).first();
  await heading.waitFor({ timeout: 20000 });
  const dropzone = heading.locator('xpath=following::div[@tabindex="0"][1]').first();
  try { await dropzone.scrollIntoViewIfNeeded(); } catch {}
  const inputs = page.locator('input[type="file"]');
  const beforeCount = await inputs.count();
  const fileChooserPromise = page.waitForEvent('filechooser').catch(() => null);
  await dropzone.click({ force: true });
  const fileChooser = await fileChooserPromise;
  if (fileChooser) { await fileChooser.setFiles(filePath); return true; }
  let targetInput = heading.locator('xpath=following::input[@type="file"][1]').first();
  await page.waitForFunction((sel, prev) => document.querySelectorAll(sel).length >= prev, 'input[type="file"]', beforeCount, { timeout: 1000 }).catch(() => {});
  const afterCount = await inputs.count();
  if (afterCount > 0) {
    const newestIndex = Math.max(0, afterCount - 1);
    targetInput = inputs.nth(newestIndex);
  }
  await targetInput.waitFor({ timeout: 10000 });
  await targetInput.setInputFiles(filePath);
  return true;
}

export async function clickRecordCircle(page) {
  const control = page.locator('div[tabindex="0"]:has(svg circle)').first();
  await control.waitFor({ timeout: 10000 }).catch(() => {});
  try { await control.scrollIntoViewIfNeeded(); } catch {}
  for (let i = 0; i < 6; i++) {
    try { await control.click({ timeout: 800, force: true }); return true; } catch {}
    const handle = await control.elementHandle();
    if (handle) { try { await handle.evaluate((el) => el.click()); return true; } catch {} }
    const box = await control.boundingBox();
    if (box) {
      const cx = box.x + box.width / 2; const cy = box.y + box.height / 2;
      await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.up();
      return true;
    }
    await page.waitForTimeout(200);
  }
  return false;
}

export async function ensureCameraReady(page) {
  try {
    const origin = (() => { try { return new URL(page.url()).origin; } catch { return 'https://app.st4ge.com'; } })();
    await page.context().grantPermissions(['camera', 'microphone'], { origin }).catch(() => {});
  } catch {}
  try {
    await page.evaluate(() => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
      const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = async (constraints) => {
        try { return await original(constraints); } catch (err) {
          const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 480;
          const ctx = canvas.getContext('2d'); ctx.fillStyle = '#777'; ctx.fillRect(0, 0, canvas.width, canvas.height);
          return canvas.captureStream(30);
        }
      };
    });
  } catch {}
}

export async function recordLivenessWithRetry(page) {
  const waitForSubmit = async (timeoutMs = 4000) => {
    try {
      await page.locator([
        'button:has-text("Submit")', '[role="button"]:has-text("Submit")', 'button:has(div:has-text("Submit"))',
        'button:has-text("Finish")', '[role="button"]:has-text("Finish")',
        'button:has-text("Continue")', '[role="button"]:has-text("Continue")',
        'div[tabindex="0"]:has-text("Submit")', 'div[tabindex="0"]:has-text("Finish")', 'div[tabindex="0"]:has-text("Continue")'
      ].join(', ')).first().waitFor({ timeout: timeoutMs });
      return true;
    } catch { return false; }
  };
  const doOnce = async () => {
    await ensureCameraReady(page);
    const start = Date.now();
    const started = await clickRecordCircle(page);
    if (!started) return false;
    await page.waitForTimeout(4000);
    let stopped = await clickRecordCircle(page);
    if (!stopped) {
      const elapsed = Date.now() - start;
      if (elapsed < 6000) await page.waitForTimeout(6000 - elapsed);
      stopped = await clickRecordCircle(page);
    }
    const advanced = await waitForSubmit(5000);
    return stopped && advanced;
  };
  let ok = await doOnce();
  if (ok) return true;
  try { await page.reload({ waitUntil: 'domcontentloaded' }); } catch {}
  try { await page.locator('button:has-text("I\'m ready"), button:has(h1:has-text("I\'m ready")), [role="button"]:has-text("I\'m ready")').first().click({ timeout: 7000, force: true }); } catch {}
  ok = await doOnce();
  return ok;
}


