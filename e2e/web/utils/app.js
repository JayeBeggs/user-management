/** Generic clicker by button text variants. */
export async function clickButtonByText(page, texts, timeoutMs = 15000) {
  const variants = Array.isArray(texts) ? texts : [texts];
  const selectors = [];
  for (const t of variants) {
    const safe = String(t).replace(/"/g, '\\"');
    selectors.push(
      `button:has(h1:has-text("${safe}"))`,
      `button:has-text("${safe}")`,
      `[role="button"]:has-text("${safe}")`,
      `div[tabindex="0"]:has(h1:has-text("${safe}"))`,
      `div[tabindex="0"]:has-text("${safe}")`
    );
  }
  const btn = page.locator(selectors.join(', ')).first();
  await btn.waitFor({ timeout: timeoutMs }).catch(() => {});
  try { await btn.click({ timeout: 2000, force: true }); return true; } catch {}
  try {
    const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(variants.map(escapeRegex).join('|'), 'i');
    const byRole = page.getByRole('button', { name: pattern }).first();
    await byRole.waitFor({ timeout: 4000 });
    await byRole.click({ timeout: 1500, force: true });
    return true;
  } catch {}
  const handle = await btn.elementHandle();
  if (handle) {
    try { await handle.scrollIntoViewIfNeeded(); } catch {}
    try { await handle.evaluate((el) => el.click()); return true; } catch {}
  }
  return false;
}

/** Clicks the "Start Earning!" button. */
export async function clickStartEarning(page) { return await clickButtonByText(page, ['Start Earning!', 'Start Earning', 'start earning']); }

/**
 * Drives the full post-approval onboarding until "Start Earning!" is clicked.
 * Respects env defaults: EMPLOYED, INCOME_BAND, TAX_REGION, DEBT_REVIEW.
 */
export async function completePersonaliseMyProductsFlow(page) {
  // Personalise My Products
  try {
    await clickButtonByText(page, 'Personalise My Products');
  } catch {}

  // Let's Go!
  try {
    await clickButtonByText(page, ["Lets Go!", "Let's Go!"]);
  } catch {}

  const clickNext = async () => {
    await clickButtonByText(page, 'Next');
  };

  // A generic option chooser by question text and option text
  const chooseOption = async (questionText, optionText) => {
    const q = page.locator(`text=${questionText}`).first();
    await q.waitFor({ timeout: 10000 });
    const opt = page.locator([
      `div[tabindex="0"]:has(h1:has-text("${optionText}"))`,
      `button:has(h1:has-text("${optionText}"))`,
      `[role="button"]:has-text("${optionText}")`
    ].join(', ')).first();
    await opt.waitFor({ timeout: 8000 }).catch(() => {});
    try { await opt.click({ timeout: 1500, force: true }); } catch {}
    await clickNext();
  };

  // Employment
  try {
    const employed = (process.env.EMPLOYED || '1') === '1';
    await chooseOption('Are you currently employed?', employed ? 'Yes' : 'No');
  } catch {}

  // Income
  try {
    const band = (process.env.INCOME_BAND || 'highest').toLowerCase();
    const opt = band === 'highest' ? 'R 25000+' : band === 'mid' ? 'R 15000 - R 25000' : 'R 0 - R 10000';
    await chooseOption('What are you currently earning per month?', opt);
  } catch {}

  // Tax region
  try {
    const region = (process.env.TAX_REGION || 'sa_only').toLowerCase();
    const opt = region === 'sa_only' ? 'South Africa Only' : 'South Africa and Other';
    await chooseOption('Where are you registered for tax?', opt);
  } catch {}

  // Debt review / insolvent
  try {
    const underDebt = (process.env.DEBT_REVIEW || '0') === '1';
    await chooseOption('Are you currently under debt review, or have you ever been declared insolvent?', underDebt ? 'Yes' : 'No');
  } catch {}

  // End of Personalise My Products flow (do NOT click Start Earning here)
  return true;
}

/** Shortcut helpers for common buttons */
export async function clickLetsGo(page) { return await clickButtonByText(page, ["Lets Go!", "Let's Go!"]); }
export async function clickImReady(page) { return await clickButtonByText(page, "I'm ready"); }
export async function clickNext(page) { return await clickButtonByText(page, 'Next'); }
export async function clickSubmit(page) { return await clickButtonByText(page, ['Submit', 'Continue', 'Finish']); }


/** Login to the app using DEFAULT_PHONE and OTP from admin (login flow). */
export async function loginWithPhone(page, browser) {
  const raw = process.env.DEFAULT_PHONE || '';
  const digits = String(raw).replace(/\D/g, '');
  if (!digits) throw new Error('DEFAULT_PHONE not set');
  // Fill phone and request OTP
  const { setPhoneNumber } = await import('./inputs.js');
  const { getOtp, enterOtp } = await import('./otp.js');
  const ok = await setPhoneNumber(page, digits);
  if (!ok) throw new Error('PHONE_INPUT_NOT_FILLED');
  await page.getByRole('button', { name: /sms/i }).first().click();
  const otp = await getOtp({ browser, type: 'login' });
  await enterOtp(page, otp);
  return true;
}


