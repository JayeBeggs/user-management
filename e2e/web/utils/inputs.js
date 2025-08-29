import { clickButtonByText } from '../utils/app.js';

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
  console.log(`Attempting to enter PIN for login: ${code}`);
  
  // This function is ONLY for PIN entry during login, NOT PIN creation during signup
  
  // Try the keypad method first (for login screens with keypad)
  try {
    console.log(`Clicking keypad digits for PIN entry: ${code}`);
    for (const ch of code) {
      await clickPinDigit(page, ch, 1);
      await page.waitForTimeout(100);
    }
    
    console.log(`Keypad PIN entry completed: ${code}`);
    
    // Wait for PIN completion to be visible
    await page.waitForTimeout(500);
    
    if (await isPinComplete(page, code.length)) {
      console.log(`PIN entry successful via keypad method`);
      return true;
    } else {
      console.log(`PIN entry failed - keypad method didn't complete PIN`);
    }
  } catch (error) {
    console.log(`Keypad PIN entry failed:`, error.message);
  }

  // Fallback: Try input field method for login screens without keypad
  try {
    let input = page.locator('input[data-testid="pin-input"], input[type="password"], input[inputmode="numeric"]');
    if (await input.count()) {
      console.log(`Found PIN input field for login`);
      const target = input.first();
      
      await target.evaluate((el, value) => {
        el.value = value;
        el.dispatchEvent(new InputEvent('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('blur', { bubbles: true }));
      }, code);
      
      if (await isPinComplete(page, code.length)) {
        console.log(`PIN entry successful via input field method`);
        return true;
      }
    }
  } catch (error) {
    console.log(`Input field PIN entry failed:`, error.message);
  }

  console.log(`All PIN entry methods failed for code: ${code}`);
  return false;
}



// Just use the working enterPin function like the original script
export async function enterPinRobust(page, code = '0000') {
  try {
    const success = await enterPin(page, code);
    if (success) {
      console.log(`PIN entered successfully: ${code}`);
      return true;
    } else {
      console.log(`PIN entry failed: ${code}`);
      return false;
    }
  } catch (error) {
    console.log('enterPin failed with error:', error.message);
    return false;
  }
}

export async function clickPinDigit(page, digitText = '0', times = 1) {
  console.log(`Looking for keypad digit: ${digitText}`);
  
  // Debug: Let's see what's actually on the page
  try {
    const allH3s = page.locator('h3');
    const h3Count = await allH3s.count();
    console.log(`Found ${h3Count} h3 elements on the page`);
    
    if (h3Count > 0) {
      for (let i = 0; i < Math.min(h3Count, 5); i++) {
        const text = await allH3s.nth(i).textContent();
        console.log(`H3 ${i}: "${text}"`);
      }
    }
    
    const tabindexDivs = page.locator('div[tabindex="0"]');
    const tabindexCount = await tabindexDivs.count();
    console.log(`Found ${tabindexCount} div[tabindex="0"] elements on the page`);
  } catch (error) {
    console.log('Debug info failed:', error.message);
  }
  
  // Based on your exact UI structure: heading with level=3 containing the digit
  let key = page.locator(`h3:has-text("${digitText}")`).first();
  
  if (!(await key.count())) {
    // Try the parent generic element that contains the h3 with the digit
    key = page.locator(`generic:has(h3:has-text("${digitText}"))`).first();
    console.log('Trying parent generic with h3');
  }
  
  if (!(await key.count())) {
    // Try any element with the digit text that's clickable
    key = page.locator(`*:has(h3:has-text("${digitText}"))`).first();
    console.log('Trying any element with h3 containing digit');
  }
  
  if (!(await key.count())) {
    // Try the tabindex="0" parent div that contains the h3
    key = page.locator(`div[tabindex="0"]:has(h3:has-text("${digitText}"))`).first();
    console.log('Trying tabindex div with h3 containing digit');
  }
  
  if (!(await key.count())) {
    // Try the exact structure from your HTML: div with tabindex="0" containing h3
    key = page.locator(`div[tabindex="0"]:has(h3:has-text("${digitText}"))`).first();
    console.log('Trying exact tabindex div structure');
  }
  
  if (!(await key.count())) {
    // Try finding the h3 first, then its clickable parent
    const h3 = page.locator(`h3:has-text("${digitText}")`).first();
    if (await h3.count()) {
      // Find the closest clickable parent
      key = h3.locator('xpath=..').first();
      console.log('Trying h3 parent element');
    }
  }
  
  if (!(await key.count())) {
    // Last resort: find any clickable element with the digit text
    key = page.locator(`*:has-text("${digitText}"):has([cursor="pointer"])`).first();
    console.log('Trying any clickable element with digit text');
  }
  
  if (!(await key.count())) {
    console.log(`Could not find keypad digit: ${digitText}`);
    throw new Error(`Keypad digit ${digitText} not found`);
  }
  
  console.log(`Found keypad digit: ${digitText}, clicking ${times} times`);
  await key.waitFor({ timeout: parseInt(process.env.UNIVERSAL_WAIT_TIMEOUT || '3000', 10) });
  try { await key.scrollIntoViewIfNeeded(); } catch {}
  
  for (let i = 0; i < times; i++) {
    try { 
      await key.click({ force: true }); 
      console.log(`Click ${i + 1} successful`);
    } catch (clickError) {
      console.log(`Click ${i + 1} failed, trying element handle click`);
      const handle = await key.elementHandle();
      if (handle) { 
        try { 
          await handle.evaluate((el) => el.click()); 
          console.log(`Click ${i + 1} via element handle successful`);
        } catch (handleError) {
          console.log(`Click ${i + 1} via element handle failed:`, handleError.message);
        }
      }
    }
    await page.waitForTimeout(100); // Reduced delay for faster PIN entry
  }
}

export async function isPinComplete(page, expectedLength = 4) {
  console.log(`=== CHECKING PIN COMPLETION (expected: ${expectedLength}) ===`);
  
  try {
    // Check for the specific PIN input from your UI
    let pinInput = page.locator('input[data-testid="pin-input"]');
    if (await pinInput.count()) {
      const v = (await pinInput.first().inputValue()) || '';
      console.log(`PIN input value: "${v}"`);
      const digitCount = v.replace(/\D/g, '').length;
      console.log(`PIN input digit count: ${digitCount}/${expectedLength}`);
      if (digitCount >= expectedLength) {
        console.log(`PIN complete via input: ${v.replace(/\D/g, '')}`);
        return true;
      } else {
        console.log(`PIN incomplete via input: ${digitCount}/${expectedLength} digits`);
      }
    } else {
      console.log(`No PIN input with data-testid="pin-input" found`);
    }
  } catch (error) {
    console.log(`PIN input check failed:`, error.message);
  }
  
  try {
    const perDigit = page.locator('input[maxlength="1"]');
    const c = await perDigit.count();
    console.log(`Found ${c} per-digit inputs`);
    if (c >= expectedLength) {
      let filled = 0;
      for (let i = 0; i < expectedLength; i++) {
        const v = await perDigit.nth(i).inputValue();
        if (v && v.length === 1) filled++;
      }
      console.log(`Per-digit filled: ${filled}/${expectedLength}`);
      if (filled >= expectedLength) {
        console.log(`PIN complete via per-digit inputs`);
        return true;
      }
    }
  } catch (error) {
    console.log(`Per-digit check failed:`, error.message);
  }
  
  try {
    const input = page.locator('input[type="password"], input[inputmode="numeric"], input[type="tel"], input');
    if (await input.count()) {
      const v = (await input.first().inputValue()) || '';
      const digitCount = v.replace(/\D/g, '').length;
      console.log(`Generic input value: "${v}", digits: ${digitCount}/${expectedLength}`);
      if (digitCount >= expectedLength) {
        console.log(`PIN complete via generic input`);
        return true;
      }
    }
  } catch (error) {
    console.log(`Generic input check failed:`, error.message);
  }
  
  // Check if the PIN dots are filled (visual indicator) - based on your HTML structure
  try {
    // Look for the dots container that shows PIN progress
    const dotsContainer = page.locator('div.css-g5y9jx.h-12.w-64.justify-center.items-center');
    if (await dotsContainer.count() > 0) {
      const dots = dotsContainer.locator('div.css-g5y9jx.h-4.w-4.rounded-full.border.border-grey-500.m-2.duration-200');
      const dotCount = await dots.count();
      console.log(`Found ${dotCount} visual dot elements in container`);
      
      if (dotCount >= expectedLength) {
        // Check if dots have been filled (they should have a different style when filled)
        let filledDots = 0;
        for (let i = 0; i < expectedLength; i++) {
          const dot = dots.nth(i);
          const classes = await dot.getAttribute('class') || '';
          const style = await dot.getAttribute('style') || '';
          // Look for filled dot indicators - might have different background or border colors
          if (classes.includes('bg-') || classes.includes('filled') || classes.includes('active') || 
              style.includes('background') || style.includes('bg-')) {
            filledDots++;
          }
        }
        console.log(`Visual dots filled: ${filledDots}/${expectedLength}`);
        if (filledDots >= expectedLength) {
          console.log(`PIN complete via visual dots: ${filledDots}/${expectedLength}`);
          return true;
        }
      }
    }
  } catch (error) {
    console.log(`Visual dots check failed:`, error.message);
  }
  
  console.log(`=== PIN NOT COMPLETE - expected ${expectedLength} digits ===`);
  return false;
}

// PIN CREATION function - ONLY for signup, creates new PIN
export async function createPin(page, pinCode = '0000') {
  console.log(`Creating new PIN during signup: ${pinCode}`);
  
  // Click each digit on the keypad - optimized timing for signup
  for (const ch of pinCode) {
    await clickPinDigit(page, ch, 1);
    await page.waitForTimeout(50); // Fast timing for PIN creation
  }
  
  console.log(`PIN creation completed: ${pinCode}`);
  
  // Wait for PIN completion to be visible
  await page.waitForTimeout(200);
  
  // Check if PIN creation was successful
  if (await isPinComplete(page, pinCode.length)) {
    console.log(`PIN creation successful: ${pinCode}`);
    return true;
  } else {
    console.log(`PIN creation failed: ${pinCode}`);
    return false;
  }
}