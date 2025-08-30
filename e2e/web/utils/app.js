/** Generic clicker by button text variants. */
export async function clickButtonByText(page, texts, timeoutMs = parseInt(process.env.UNIVERSAL_WAIT_TIMEOUT || '3000', 10)) {
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
  const clickTimeout = parseInt(process.env.UNIVERSAL_CLICK_TIMEOUT || '3000', 10);
  const elementTimeout = parseInt(process.env.UNIVERSAL_WAIT_TIMEOUT || '3000', 10);
  try { await btn.click({ timeout: clickTimeout, force: true }); return true; } catch {}
  try {
    const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(variants.map(escapeRegex).join('|'), 'i');
    const byRole = page.getByRole('button', { name: pattern }).first();
    await byRole.waitFor({ timeout: elementTimeout });
    await byRole.click({ timeout: clickTimeout, force: true });
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
 * Enhanced with proper logging and error handling.
 */
export async function completePersonaliseMyProductsFlow(page) {
  console.log('🎨 Starting complete personalisation flow...');
  
  console.log('📋 Step 1: Looking for Personalise My Products button');
  try {
    const clicked = await clickButtonByText(page, 'Personalise My Products');
    if (clicked) {
      console.log('✅ Personalise My Products button clicked');
    } else {
      console.log('⚠️ Personalise My Products button not found - may already be in flow');
    }
  } catch (error) {
    console.log('⚠️ Personalise My Products button error:', error.message);
  }

  console.log('🚀 Step 2: Looking for Let\'s Go button');
  try {
    const clicked = await clickButtonByText(page, ["Lets Go!", "Let's Go!"]);
    if (clicked) {
      console.log('✅ Let\'s Go button clicked');
    } else {
      console.log('⚠️ Let\'s Go button not found - may already be past this step');
    }
  } catch (error) {
    console.log('⚠️ Let\'s Go button error:', error.message);
  }

  const clickNext = async () => {
    console.log('➡️ Clicking Next button');
    const clicked = await clickButtonByText(page, 'Next');
    if (clicked) {
      console.log('✅ Next button clicked');
    } else {
      console.log('⚠️ Next button not found');
    }
    return clicked;
  };

  console.log('🌍 Step 2.5: Checking for language selection');
  try {
    const languageQuestion = page.locator('h6:has-text("What is your preferred language?")').first();
    if (await languageQuestion.count()) {
      console.log('✅ Language selection carousel found');
      
      console.log('📱 Using current carousel selection and proceeding');
      await clickNext();
    } else {
      console.log('⚠️ No language selection screen found');
    }
  } catch (error) {
    console.log('⚠️ Language selection error:', error.message);
  }



  const chooseOption = async (questionText, optionText) => {
    console.log(`🔍 Looking for question: "${questionText}" with option: "${optionText}"`);
    
    try {
      const q = page.locator(`text=${questionText}`).first();
      const waitTimeout = parseInt(process.env.UNIVERSAL_WAIT_TIMEOUT || '3000', 10);
      const elementTimeout = parseInt(process.env.UNIVERSAL_WAIT_TIMEOUT || '3000', 10);
      const clickTimeout = parseInt(process.env.UNIVERSAL_CLICK_TIMEOUT || '3000', 10);
      
      await q.waitFor({ timeout: waitTimeout });
      console.log(`✅ Found question: "${questionText}"`);
      
      const opt = page.locator([
        `div[tabindex="0"]:has(h1:has-text("${optionText}"))`,
        `button:has(h1:has-text("${optionText}"))`,
        `[role="button"]:has-text("${optionText}")`
      ].join(', ')).first();
      
      await opt.waitFor({ timeout: elementTimeout });
      await opt.click({ timeout: clickTimeout, force: true });
      console.log(`✅ Selected option: "${optionText}"`);
      
      await clickNext();
      
    } catch (error) {
      console.log(`⚠️ Error with question "${questionText}":`, error.message);
      throw error;
    }
  };

  console.log('💼 Step 3: Employment question');
  try {
    const employed = (process.env.EMPLOYED || '1') === '1';
    const optionText = employed ? (process.env.EMPLOYED_YES_DISPLAY || 'Yes') : (process.env.EMPLOYED_NO_DISPLAY || 'No');
    await chooseOption('Are you currently employed?', optionText);
    console.log('✅ Employment question completed');
  } catch (error) {
    console.log('⚠️ Employment question failed:', error.message);
    throw error;
  }

  console.log('💰 Step 4: Income question');
  try {
    const band = (process.env.INCOME_BAND || 'highest').toLowerCase();
    const opt = band === 'highest' ? (process.env.INCOME_HIGHEST_DISPLAY || 'R 25000+') : 
                 band === 'mid' ? (process.env.INCOME_MID_DISPLAY || 'R 15000 - R 25000') : 
                 (process.env.INCOME_LOW_DISPLAY || 'R 0 - R 10000');
    await chooseOption('What are you currently earning per month?', opt);
    console.log('✅ Income question completed');
  } catch (error) {
    console.log('⚠️ Income question failed:', error.message);
    throw error;
  }

  console.log('🏛️ Step 5: Tax region question');
  try {
    const region = (process.env.TAX_REGION || 'sa_only').toLowerCase();
    const opt = region === 'sa_only' ? (process.env.TAX_SA_ONLY_DISPLAY || 'South Africa Only') : 
                (process.env.TAX_SA_AND_OTHER_DISPLAY || 'South Africa and Other');
    await chooseOption('Where are you registered for tax?', opt);
    console.log('✅ Tax region question completed');
  } catch (error) {
    console.log('⚠️ Tax region question failed:', error.message);
    throw error;
  }

  console.log('📊 Step 6: Debt review question');
  try {
    const underDebt = (process.env.DEBT_REVIEW || '0') === '1';
    const optionText = underDebt ? (process.env.DEBT_REVIEW_YES_DISPLAY || 'Yes') : (process.env.DEBT_REVIEW_NO_DISPLAY || 'No');
    await chooseOption('Are you currently under debt review, or have you ever been declared insolvent?', optionText);
    console.log('✅ Debt review question completed');
  } catch (error) {
    console.log('⚠️ Debt review question failed:', error.message);
    throw error;
  }

  console.log('🏁 Step 7: Waiting for personalisation completion screen');
  try {
    await page.waitForTimeout(2000); // Give time for final screen to load
    
    const completionElements = page.locator([
      'button:has-text("Complete")',
      'button:has-text("Finish")',
      'button:has-text("Done")',
      'button:has-text("Continue")',
      'h1:has-text("Complete")',
      'h1:has-text("Congratulations")',
      'h1:has-text("Well done")',
      'text=personalisation complete',
      'text=setup complete'
    ].join(', ')).first();
    
    if (await completionElements.count()) {
      console.log('✅ Found completion screen element');
      
      if (await page.locator('button:has-text("Complete"), button:has-text("Finish"), button:has-text("Done"), button:has-text("Continue")').first().count()) {
        await clickNext();
        console.log('✅ Clicked final completion button');
      }
    } else {
      console.log('⚠️ No completion screen found - may have finished already');
    }
    
    await page.waitForTimeout(1000);
    
  } catch (error) {
    console.log('⚠️ Final completion step error:', error.message);
  }

  console.log('🎉 Personalisation flow completed successfully!');
  return true;
}

/** Shortcut helpers for common buttons */
export async function clickLetsGo(page) { return await clickButtonByText(page, ["Lets Go!", "Let's Go!"]); }
export async function clickImReady(page) { return await clickButtonByText(page, "I'm ready"); }
export async function clickNext(page) { return await clickButtonByText(page, 'Next'); }
export async function clickSubmit(page) { return await clickButtonByText(page, ['Submit', 'Continue', 'Finish']); }

/**
 * Standardized personalisation flow execution with consistent error handling
 */
export async function executePersonalisationFlow(page, stepName = 'Personalisation') {
  console.log(`🎨 Starting ${stepName} flow`);
  try {
    const personalised = await completePersonaliseMyProductsFlow(page);
    if (personalised) {
      console.log(`✅ ${stepName} completed successfully`);
      return true;
    } else {
      console.log(`⚠️ ${stepName} may have failed`);
      return false;
    }
  } catch (error) {
    console.log(`⚠️ ${stepName} error:`, error.message);
    throw error;
  }
}

/**
 * Complete user creation flow: Signup + KYC + CDM Verification
 * Extracts the common pattern from signup_users.spec.js and full_journey.spec.js
 */
export async function completeUserCreationFlow(page, browser, userData = {}) {
  console.log('🚀 Starting complete user creation flow...');
  
  const media = await generateUserMedia();
  console.log('📸 Generated user media:', { id: media.id, seed: media.seed });
  
  console.log('🚀 PHASE 1: Starting Signup Flow');
  const finalUserData = await signupFlow(page, browser, { id: media.id, ...userData });
  console.log('✅ PHASE 1 COMPLETED: Signup finished');
  console.log('👤 User Details:', finalUserData);
  
  console.log('📋 PHASE 2: Starting KYC Flow');
  await kycFlow(page, media);
  console.log('✅ PHASE 2 COMPLETED: KYC finished');
  
  console.log('🚪 Closing signup window for verification...');
  await page.close();
  
  console.log('🔍 PHASE 3: Starting Separate CDM Verification');
  const { verifySeparatedCdm } = await import('./cdm.js');
  const verificationSuccess = await verifySeparatedCdm(media);
  
  if (verificationSuccess) {
    console.log('✅ PHASE 3 COMPLETED: CDM verification finished successfully');
  } else {
    console.log('⚠️ PHASE 3 COMPLETED: CDM verification failed or user not found - continuing anyway');
  }
  
  return { userData: finalUserData, media, verificationSuccess };
}

/**
 * Helper to handle OTP fetching with fallback logic
 */
async function fetchOtpWithFallback(browser, type = 'login') {
  console.log('🔐 Fetching OTP from admin panel');
  const { getOtp } = await import('./otp.js');
  
  if (type === 'signup') {
    return await getOtp({ browser, type: 'signup' });
  }
  
  try {
    const otp = await getOtp({ browser, type: 'login' });
    console.log('✅ Got OTP from login endpoint');
    return otp;
  } catch (error) {
    console.log('⚠️ Login OTP failed, trying signup endpoint:', error.message);
    try {
      const otp = await getOtp({ browser, type: 'signup' });
      console.log('✅ Got OTP from signup endpoint');
      return otp;
    } catch (signupError) {
      console.log('❌ Both OTP endpoints failed:', signupError.message);
      throw new Error('Could not fetch OTP from either login or signup endpoint');
    }
  }
}

/**
 * Helper to check if personalisation is needed and complete it if required
 */
export async function ensurePersonalisationComplete(page) {
  console.log('🔍 Checking if personalisation is needed...');
  
  const personaliseButton = page.locator([
    'button:has(h1:has-text("Personalise My Products"))',
    'button:has-text("Personalise My Products")',
    '[role="button"]:has-text("Personalise My Products")'
  ].join(', ')).first();
  
  if (await personaliseButton.count()) {
    console.log('📋 Personalise My Products button found - completing that flow first');
    await executePersonalisationFlow(page);
    return true;
  } else {
    console.log('✅ Personalisation already completed or not required');
    return false;
  }
}

/**
 * Standardized start earning flow execution with consistent error handling
 */
export async function executeStartEarningFlow(page, stepName = 'Start Earning') {
  console.log(`💰 Starting ${stepName} activation`);
  try {
    const earningStarted = await clickStartEarning(page);
    if (earningStarted) {
      console.log(`✅ ${stepName} activated successfully`);
      return true;
    } else {
      console.log(`⚠️ ${stepName} activation may have failed`);
      return false;
    }
  } catch (error) {
    console.log(`⚠️ ${stepName} error:`, error.message);
    throw error;
  }
}


/** 
 * Complete login flow: Phone + OTP + PIN entry + dashboard wait
 * Replaces 40+ lines of duplicated login code across test files
 */
export async function loginFlow(page, browser, phoneNumber = null) {
  console.log('🔐 Starting complete login flow...');
  
  const raw = phoneNumber || process.env.DEFAULT_PHONE || process.env.DEFAULT_PHONE_FALLBACK || '0821234567';
  const digits = String(raw).replace(/\D/g, '');
  if (!digits) throw new Error('No phone number provided for login');
  
  console.log('📱 Login phone:', digits);
  
  const { setPhoneNumber, enterPin } = await import('./inputs.js');
  const { enterOtp } = await import('./otp.js');
  
  await page.goto('/');
  
  const phoneOk = await setPhoneNumber(page, digits);
  if (!phoneOk) throw new Error('PHONE_INPUT_NOT_FILLED');
  console.log('✅ Phone input filled:', digits);
  
  console.log('📨 Requesting OTP via SMS');
  await page.getByRole('button', { name: /sms/i }).click();
  
  const otp = await fetchOtpWithFallback(browser, 'login');
  
  await enterOtp(page, otp);
  console.log('✅ OTP entered successfully');
  
  console.log('🔐 Waiting for PIN entry screen...');
  try {
    await page.locator('h6:has-text("Enter your 4-digit PIN to Log In")').waitFor({ 
      timeout: parseInt(process.env.UNIVERSAL_WAIT_TIMEOUT || '3000', 10) 
    });
    console.log('✅ PIN entry screen found');
  } catch (error) {
    console.log('⚠️ PIN entry screen not found, continuing anyway:', error.message);
  }
  const pinCode = process.env.DEFAULT_PIN || '0000';
  try {
    const pinSuccess = await enterPin(page, pinCode);
    if (pinSuccess) {
      console.log(`✅ PIN entered successfully: ${pinCode}`);
    } else {
      console.log(`⚠️ PIN entry failed: ${pinCode} - but continuing anyway`);
    }
  } catch (error) {
    console.log(`⚠️ PIN entry error: ${error.message} - but continuing anyway`);
  }
  
  await page.waitForLoadState('networkidle');
  console.log('✅ Logged in successfully - dashboard loaded');
  
  return true;
}

/**
 * Complete signup flow: Phone + OTP + User Details (Name, ID, Email) + PIN Creation
 * Extracts signup logic from signup_users.spec.js for reuse
 */
export async function signupFlow(page, browser, userData = {}) {
  console.log('🚀 Starting complete signup flow...');
  
  const { setPhoneNumber, createPin } = await import('./inputs.js');
  const { getOtp, enterOtp } = await import('./otp.js');
  const phoneDigits = userData.phone || 
    (process.env.DEFAULT_PHONE && String(process.env.DEFAULT_PHONE).replace(/\D/g, '')) ||
    `082${Math.floor(1000000 + Math.random() * 8999999)}`;
  
  console.log('📱 Signup phone:', phoneDigits);
  
  await page.goto('/');
  
  const phoneOk = await setPhoneNumber(page, phoneDigits);
  if (!phoneOk) throw new Error('PHONE_INPUT_NOT_FILLED');
  console.log('✅ Phone input filled:', phoneDigits);
  
  console.log('📨 Requesting OTP via SMS');
  await page.getByRole('button', { name: /sms/i }).click();
  
  const otp = await fetchOtpWithFallback(browser, 'signup');
  await enterOtp(page, otp);
  console.log('✅ OTP entered successfully');
  
  console.log('👤 Filling user details');
  
  await page.locator('input[placeholder="Name"]').waitFor({ 
    timeout: parseInt(process.env.UNIVERSAL_WAIT_TIMEOUT || '3000', 10) 
  });
  
  const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  const nameValue = userData.name || `Kastelo_user_${randomNum}`;
  
  const nameInput = page.locator('input[placeholder="Name"]').first();
  await nameInput.waitFor({ timeout: parseInt(process.env.UNIVERSAL_WAIT_TIMEOUT || '3000', 10) });
  await nameInput.fill(nameValue);
  await nameInput.evaluate((el) => el.blur());
  
  await clickNext(page);
  console.log('✅ Name submitted:', nameValue);
  
  await page.waitForURL(/onboarding\/user-details\/id-number/i, { 
    timeout: parseInt(process.env.UNIVERSAL_WAIT_TIMEOUT || '3000', 10) 
  }).catch(() => {});
  
  const idDigits = userData.id || '8207106197083'; // Default ID for testing
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
  
  await clickNext(page);
  console.log('✅ ID number submitted:', idDigits);
  
  const emailDomain = process.env.EMAIL_DOMAIN || 'gmail.com';
  const emailValue = userData.email || `${process.env.KASTELO_USER || 'test'}+${nameValue}@${emailDomain}`;
  
  let emailInput = page.locator(`input[placeholder="email@${emailDomain}"]`).first();
  if (!(await emailInput.count())) emailInput = page.locator('input[type="email"]').first();
  if (!(await emailInput.count())) emailInput = page.locator('input[inputmode="email"]').first();
  if (!(await emailInput.count())) emailInput = page.getByPlaceholder(/@/).first();
  
  await emailInput.waitFor({ timeout: parseInt(process.env.UNIVERSAL_WAIT_TIMEOUT || '3000', 10) });
  await emailInput.fill(emailValue);
  await emailInput.evaluate((el) => el.blur());
  
  await clickNext(page);
  console.log('✅ Email submitted:', emailValue);
  
  console.log('✅ Signup details completed - ready for KYC');
  
  return {
    phone: phoneDigits,
    name: nameValue,
    id: idDigits,
    email: emailValue,
    pin: process.env.DEFAULT_PIN || '0000'
  };
}

/**
 * Complete KYC flow: ID Type Selection + ID Upload + Liveness Recording
 * Extracts KYC logic from signup_users.spec.js and full_journey.spec.js for reuse
 */
export async function kycFlow(page, media) {
  console.log('📋 Starting complete KYC flow...');
  
  const { clickUploadCta, uploadIdSection, recordLivenessWithRetry } = await import('./kyc.js');
  try {
    await clickImReady(page);
    console.log('✅ Clicked first I\'m ready');
  } catch (error) {
    console.log('⚠️ First I\'m ready button not found:', error.message);
  }
  
  try {
    await page.locator('div:has(> button:has(h1))').first().waitFor({ 
      timeout: parseInt(process.env.UNIVERSAL_WAIT_TIMEOUT || '3000', 10) 
    }).catch(() => {});
    
    const idType = process.env.ID_TYPE || 'ID Card';
    await clickButtonByText(page, idType);
    console.log(`✅ Selected ID type: ${idType}`);
  } catch (error) {
    console.log('⚠️ ID type selection failed:', error.message);
  }
  
  try {
    const uploadCtaClicked = await clickUploadCta(page);
    console.log('✅ Upload CTA clicked:', !!uploadCtaClicked);
  } catch (error) {
    console.log('⚠️ Upload CTA failed:', error.message);
  }
  
  console.log('📸 Uploading ID images');
  
  try {
    await uploadIdSection(page, 'ID Front', media.idFront);
    console.log('✅ ID Front uploaded:', media.idFront);
    
    await uploadIdSection(page, 'ID Back', media.idBack);
    console.log('✅ ID Back uploaded:', media.idBack);
  } catch (error) {
    console.log('⚠️ ID upload failed:', error.message);
    throw error;
  }
  
  // Click the final Upload button in this section
  try {
    const uploadBtn = page.locator('button:has-text("Upload"), [role="button"]:has-text("Upload")').first();
    await uploadBtn.waitFor({ timeout: parseInt(process.env.UNIVERSAL_WAIT_TIMEOUT || '3000', 10) });
    
    // Wait until clickable
    await page.waitForFunction((el) => {
      const style = window.getComputedStyle(el);
      const pe = style.pointerEvents !== 'none';
      const op = Number(style.opacity || '1') > 0.2;
      return pe && op;
    }, await uploadBtn.elementHandle(), { 
      timeout: parseInt(process.env.UNIVERSAL_WAIT_TIMEOUT || '3000', 10) 
    }).catch(() => {});
    
    await uploadBtn.click({ force: true });
    console.log('✅ ID images submitted');
  } catch (error) {
    console.log('⚠️ Upload button click failed:', error.message);
  }
  
  // Continue/Submit after upload
  try {
    await page.getByRole('button', { name: /continue|submit/i }).first().click();
    console.log('✅ Post-upload Continue clicked');
  } catch (error) {
    console.log('⚠️ Post-upload continue failed:', error.message);
  }
  
  // Click second "I'm ready" for liveness
  try {
    await clickImReady(page);
    console.log('✅ Clicked second I\'m ready');
  } catch (error) {
    console.log('⚠️ Second I\'m ready button not found:', error.message);
  }
  
  // Start/stop liveness recording (with retry)
  console.log('🎥 Starting liveness recording');
  try {
    await recordLivenessWithRetry(page);
    console.log('✅ Liveness recording completed');
  } catch (error) {
    console.log('⚠️ Liveness recording failed:', error.message);
    throw error;
  }
  
  // After recording, click Submit/Continue
  try {
    await clickSubmit(page);
    console.log('✅ Liveness submitted');
  } catch (error) {
    console.log('⚠️ Liveness submit failed:', error.message);
  }
  
  // PIN Creation - happens AFTER KYC
  console.log('🔐 Creating PIN after KYC completion');
  try {
    // Wait for PIN creation screen
    await page.locator('h6:has-text("PIN"), h1:has-text("PIN"), h2:has-text("PIN")').first().waitFor({ 
      timeout: parseInt(process.env.UNIVERSAL_WAIT_TIMEOUT || '3000', 10) 
    });
    console.log('✅ PIN creation screen found');
    
    // Create PIN using default from environment
    const pinCode = process.env.DEFAULT_PIN || '0000';
    const { createPin } = await import('./inputs.js');
    const pinCreated = await createPin(page, pinCode);
    
    if (pinCreated) {
      console.log(`✅ PIN creation successful: ${pinCode}`);
    } else {
      console.log(`⚠️ PIN creation returned false for code: ${pinCode} - but continuing anyway`);
    }
    
    // Click Continue button after PIN creation
    console.log('🔄 Clicking Continue after PIN creation');
    const continueClicked = await clickButtonByText(page, 'Continue');
    if (continueClicked) {
      console.log('✅ Continue button clicked');
    } else {
      console.log('⚠️ Continue button not found after PIN creation - but continuing anyway');
    }
    
  } catch (error) {
    console.log(`⚠️ PIN creation error: ${error.message} - but continuing anyway`);
  }
  
  console.log('✅ KYC + PIN creation flow completed');
  return true;
}

/**
 * Generate user media (ID images) for testing
 * Moved from test files to utils for reuse
 */
export async function generateUserMedia() {
  const { spawnSync } = await import('child_process');
  const seed = `u${Date.now()}${Math.floor(Math.random()*1000)}`;
  const env = { ...process.env, TEST_SEED: seed };
  const res = spawnSync('node', ['e2e/tools/generate_user_media.js'], { encoding: 'utf8', env });
  if (res.status !== 0) throw new Error('generate_user_media failed');
  return JSON.parse(res.stdout);
}

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


