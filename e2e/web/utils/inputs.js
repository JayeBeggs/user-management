export async function setPhoneNumber(page, digits) {
  const customSel = process.env.PHONE_SELECTOR;
  const pretty = `${digits.slice(0,3)} ${digits.slice(3,6)} ${digits.slice(6)}`;
  let phoneLocator = customSel ? page.locator(customSel) : page.locator('input');
  const inputCount = await phoneLocator.count();
  if (!customSel && inputCount !== 1) {
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

export async function enterPin(page, code = '0000') {
  try {
    await Promise.race([
      page.locator('div[tabindex="0"]:has(h3)').waitFor({ timeout: 10000 }),
      page.locator('input[maxlength="1"]').waitFor({ timeout: 10000 }),
      page.locator('input[type="password"], input[inputmode="numeric"], input[type="tel"], input').waitFor({ timeout: 10000 })
    ]);
  } catch {}
  try {
    for (const ch of code) {
      await clickPinDigit(page, ch, 1);
    }
    if (await isPinComplete(page, code.length)) return true;
  } catch {}
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

export async function clickPinDigit(page, digitText = '0', times = 1) {
  let key = page.locator(`div[tabindex="0"]:has(h3:has-text("${digitText}"))`).first();
  if (!(await key.count())) key = page.locator(`div[tabindex="0"]:has-text("${digitText}")`).first();
  if (!(await key.count())) key = page.getByRole('button', { name: new RegExp(`^${digitText}$`) }).first();
  await key.waitFor({ timeout: 15000 });
  try { await key.scrollIntoViewIfNeeded(); } catch {}
  for (let i = 0; i < times; i++) {
    try { await key.click({ force: true }); } catch {
      const handle = await key.elementHandle();
      if (handle) { try { await handle.evaluate((el) => el.click()); } catch {} }
    }
    await page.waitForTimeout(150);
  }
}

export async function isPinComplete(page, expectedLength = 4) {
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
  try {
    const input = page.locator('input[type="password"], input[inputmode="numeric"], input[type="tel"], input');
    if (await input.count()) {
      const v = (await input.first().inputValue()) || '';
      if ((v.replace(/\D/g, '').length) >= expectedLength) return true;
    }
  } catch {}
  return false;
}


