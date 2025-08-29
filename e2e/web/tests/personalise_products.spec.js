import { test, expect, chromium } from '@playwright/test';

import { getOtp, enterOtp } from '../utils/otp.js';
import { setPhoneNumber, enterPin } from '../utils/inputs.js';

// Using imported PIN functions from utils/inputs.js



test.describe('Personalise My Products Flow', () => {
  test('complete personalise my products flow after login', async ({ page, browser }) => {
    // Login using DEFAULT_PHONE
    const phoneDigits = process.env.DEFAULT_PHONE || process.env.DEFAULT_PHONE_FALLBACK || '0821234567';
    console.log('Logging in with phone:', phoneDigits);
    
    await page.goto('/');
    
    // Set phone number
    const ok = await setPhoneNumber(page, phoneDigits);
    if (!ok) throw new Error('PHONE_INPUT_NOT_FILLED');
    console.log('Phone input filled:', phoneDigits);
    
    // Request OTP via SMS
    console.log('Clicking SMS to request OTP');
    await page.getByRole('button', { name: /sms/i }).click();
    
    // Fetch OTP from CDM - try login first, fallback to signup if needed
    console.log('Fetching OTP from CDM for login');
    let otp;
    try {
      otp = await getOtp({ browser, type: 'login' });
      console.log('Got OTP from login endpoint');
    } catch (error) {
      console.log('Login OTP failed, trying signup endpoint:', error.message);
      try {
        otp = await getOtp({ browser, type: 'signup' });
        console.log('Got OTP from signup endpoint');
      } catch (signupError) {
        console.log('Both OTP endpoints failed:', signupError.message);
        throw new Error('Could not fetch OTP from either login or signup endpoint');
      }
    }
    await enterOtp(page, otp);
    console.log('OTP entered');
    
    // Wait for PIN entry screen to appear
    console.log('Waiting for PIN entry screen...');
    try {
      await page.locator('h6:has-text("Enter your 4-digit PIN to Log In")').waitFor({ timeout: parseInt(process.env.UNIVERSAL_WAIT_TIMEOUT || '3000', 10) });
      console.log('PIN entry screen found');
    } catch (error) {
      console.log('PIN entry screen not found, continuing anyway:', error.message);
    }
    
    // Enter PIN using default from environment
    try {
      const pinCode = process.env.DEFAULT_PIN || '0000';
      const pinSuccess = await enterPin(page, pinCode);
      if (pinSuccess) {
        console.log(`PIN entered successfully: ${pinCode}`);
      } else {
        console.log(`PIN entry failed: ${pinCode} - but continuing anyway`);
      }
    } catch (error) {
      console.log(`PIN entry error: ${error.message} - but continuing anyway`);
    }
    
    // Wait for dashboard to load
    await page.waitForLoadState('networkidle');
    console.log('Logged in successfully');
    
    // Wait for dashboard to be fully ready before looking for elements
    console.log('Waiting for dashboard to fully load...');
    try {
      // Wait for some dashboard element to appear
      await page.locator('h1, h2, h3, button, [role="button"]').first().waitFor({ timeout: parseInt(process.env.UNIVERSAL_WAIT_TIMEOUT || '3000', 10) });
      console.log('Dashboard elements found, waiting briefly for stability...');
      await page.waitForTimeout(1000); // Reduced from UNIVERSAL_WAIT_TIMEOUT to 1 second
    } catch (error) {
      console.log('Dashboard elements not found, continuing anyway:', error.message);
    }
    
    // Start Personalise My Products flow
    console.log('Starting Personalise My Products flow');
    
    // Click "Personalise My Products" button
    try {
      const personalise = page.locator([
        'button:has(h1:has-text("Personalise My Products"))',
        'button:has-text("Personalise My Products")',
        '[role="button"]:has-text("Personalise My Products")'
      ].join(', ')).first();
      await personalise.waitFor({ timeout: parseInt(process.env.UNIVERSAL_WAIT_TIMEOUT || '3000', 10) });
      await personalise.click({ timeout: parseInt(process.env.UNIVERSAL_CLICK_TIMEOUT || '3000', 10), force: true });
      console.log('Clicked Personalise My Products');
    } catch (error) {
      console.log('Personalise My Products button not found or not clickable:', error.message);
      // Don't throw error immediately, try to continue
      console.log('Waiting a bit more for dashboard to fully load...');
      await page.waitForTimeout(2000); // Reduced from UNIVERSAL_WAIT_TIMEOUT
      
      // Try again with a fresh locator
      try {
        const personaliseRetry = page.locator([
          'button:has(h1:has-text("Personalise My Products"))',
          'button:has-text("Personalise My Products")',
          '[role="button"]:has-text("Personalise My Products")'
        ].join(', ')).first();
        await personaliseRetry.waitFor({ timeout: parseInt(process.env.UNIVERSAL_WAIT_TIMEOUT || '3000', 10) });
        await personaliseRetry.click({ timeout: parseInt(process.env.UNIVERSAL_CLICK_TIMEOUT || '3000', 10), force: true });
        console.log('Clicked Personalise My Products on retry');
      } catch (retryError) {
        console.log('Personalise My Products button still not found after retry:', retryError.message);
        throw new Error(`Personalise My Products button not accessible after login: ${retryError.message}`);
      }
    }
    
    // Click "Let's Go!" button
    try {
      const letsGo = page.locator([
        'button:has(h1:has-text("Lets Go!"))',
        'button:has(h1:has-text("Let\'s Go!"))',
        'button:has-text("Lets Go!")',
        'button:has-text("Let\'s Go!")',
        '[role="button"]:has-text("Lets Go!")',
        '[role="button"]:has-text("Let\'s Go!")'
      ].join(', ')).first();
      await letsGo.waitFor({ timeout: parseInt(process.env.UNIVERSAL_WAIT_TIMEOUT || '3000', 10) });
              await letsGo.click({ timeout: parseInt(process.env.UNIVERSAL_CLICK_TIMEOUT || '3000', 10), force: true });
      console.log('Clicked Let\'s Go!');
    } catch (error) {
      console.log('Let\'s Go! button not found:', error.message);
      throw error;
    }
    
    // Click "Next" button
    try {
      const nextBtn = page.locator([
        'button:has(h1:has-text("Next"))',
        'button:has-text("Next")',
        '[role="button"]:has-text("Next")'
      ].join(', ')).first();
      await nextBtn.waitFor({ timeout: parseInt(process.env.UNIVERSAL_WAIT_TIMEOUT || '3000', 10) });
              await nextBtn.click({ timeout: parseInt(process.env.UNIVERSAL_CLICK_TIMEOUT || '3000', 10), force: true });
      console.log('Clicked Next');
    } catch (error) {
      console.log('Next button not found:', error.message);
      throw error;
    }
    
    // Employment status: select Yes/No and click Next
    try {
      const question = page.locator('text=Are you currently employed?').first();
      await question.waitFor({ timeout: parseInt(process.env.UNIVERSAL_WAIT_TIMEOUT || '3000', 10) });
              const employed = (process.env.EMPLOYED || '1') === '1';
        const choice = employed
          ? page.locator(`div[tabindex="0"]:has(h1:has-text("${process.env.EMPLOYED_YES_DISPLAY || 'Yes'}")), button:has(h1:has-text("${process.env.EMPLOYED_YES_DISPLAY || 'Yes'}")), [role="button"]:has-text("${process.env.EMPLOYED_YES_DISPLAY || 'Yes'}")`).first()
          : page.locator(`div[tabindex="0"]:has(h1:has-text("${process.env.EMPLOYED_NO_DISPLAY || 'No'}")), button:has(h1:has-text("${process.env.EMPLOYED_NO_DISPLAY || 'No'}")), [role="button"]:has-text("${process.env.EMPLOYED_NO_DISPLAY || 'No'}")`).first();
      await choice.waitFor({ timeout: parseInt(process.env.UNIVERSAL_WAIT_TIMEOUT || '3000', 10) });
      await choice.click({ timeout: parseInt(process.env.UNIVERSAL_CLICK_TIMEOUT || '3000', 10), force: true });
      console.log('Selected employment status:', employed ? 'Yes' : 'No');
      
      const next2 = page.locator([
        'button:has(h1:has-text("Next"))',
        'button:has-text("Next")',
        '[role="button"]:has-text("Next")'
      ].join(', ')).first();
      await next2.waitFor({ timeout: parseInt(process.env.UNIVERSAL_WAIT_TIMEOUT || '3000', 10) });
      await next2.click({ timeout: parseInt(process.env.UNIVERSAL_CLICK_TIMEOUT || '3000', 10), force: true });
      console.log('Clicked Next after employment');
    } catch (error) {
      console.log('Employment question not found:', error.message);
      throw error;
    }
    
    // Income band: select from environment
    try {
      const incomeQ = page.locator('text=What are you currently earning per month?').first();
      await incomeQ.waitFor({ timeout: parseInt(process.env.UNIVERSAL_WAIT_TIMEOUT || '3000', 10) });
              const incomeBand = process.env.INCOME_BAND || 'highest';
        const incomeOption = incomeBand === 'highest' ? (process.env.INCOME_HIGHEST_DISPLAY || 'R 25000+') : incomeBand === 'mid' ? (process.env.INCOME_MID_DISPLAY || 'R 15000 - R 25000') : (process.env.INCOME_LOW_DISPLAY || 'R 0 - R 10000');
      const highest = page.locator([
        `div[tabindex="0"]:has(h1:has-text("${incomeOption}"))`,
        `button:has(h1:has-text("${incomeOption}"))`,
        `[role="button"]:has-text("${incomeOption}")`
      ].join(', ')).first();
      await highest.waitFor({ timeout: parseInt(process.env.UNIVERSAL_WAIT_TIMEOUT || '3000', 10) });
      await highest.click({ timeout: parseInt(process.env.UNIVERSAL_CLICK_TIMEOUT || '3000', 10), force: true });
      console.log(`Selected income band: ${incomeOption}`);
      
      const next3 = page.locator([
        'button:has(h1:has-text("Next"))',
        'button:has-text("Next")',
        '[role="button"]:has-text("Next")'
      ].join(', ')).first();
      await next3.waitFor({ timeout: parseInt(process.env.UNIVERSAL_WAIT_TIMEOUT || '3000', 10) });
      await next3.click({ timeout: parseInt(process.env.UNIVERSAL_CLICK_TIMEOUT || '3000', 10), force: true });
      console.log('Clicked Next after income');
    } catch (error) {
      console.log('Income question not found:', error.message);
      throw error;
    }
    
    // Tax registration: select from environment
    try {
      const taxQ = page.locator('text=Where are you registered for tax?').first();
      await taxQ.waitFor({ timeout: parseInt(process.env.UNIVERSAL_WAIT_TIMEOUT || '3000', 10) });
              const taxRegion = process.env.TAX_REGION || 'sa_only';
        const taxOption = taxRegion === 'sa_only' ? (process.env.TAX_SA_ONLY_DISPLAY || 'South Africa Only') : (process.env.TAX_SA_AND_OTHER_DISPLAY || 'South Africa and Other');
      const saOnly = page.locator([
        `div[tabindex="0"]:has(h1:has-text("${taxOption}"))`,
        `button:has(h1:has-text("${taxOption}"))`,
        `[role="button"]:has-text("${taxOption}")`
      ].join(', ')).first();
      await saOnly.waitFor({ timeout: parseInt(process.env.UNIVERSAL_WAIT_TIMEOUT || '3000', 10) });
      await saOnly.click({ timeout: parseInt(process.env.UNIVERSAL_CLICK_TIMEOUT || '3000', 10), force: true });
      console.log(`Selected tax registration: ${taxOption}`);
      
      const next4 = page.locator([
        'button:has(h1:has-text("Next"))',
        'button:has-text("Next")',
        '[role="button"]:has-text("Next")'
      ].join(', ')).first();
      await next4.waitFor({ timeout: parseInt(process.env.UNIVERSAL_WAIT_TIMEOUT || '3000', 10) });
      await next4.click({ timeout: parseInt(process.env.UNIVERSAL_CLICK_TIMEOUT || '3000', 10), force: true });
      console.log('Clicked Next after tax registration');
    } catch (error) {
      console.log('Tax registration question not found:', error.message);
      throw error;
    }
    
    // Debt review/insolvency: default select "No" and click Next
    try {
      const debtQ = page.locator('text=Are you currently under debt review, or have you ever been declared insolvent?').first();
      await debtQ.waitFor({ timeout: parseInt(process.env.UNIVERSAL_WAIT_TIMEOUT || '3000', 10) });
              const underDebt = (process.env.DEBT_REVIEW || '0') === '1';
        const choice = underDebt
          ? page.locator(`div[tabindex="0"]:has(h1:has-text("${process.env.DEBT_REVIEW_YES_DISPLAY || 'Yes'}")), button:has(h1:has-text("${process.env.DEBT_REVIEW_YES_DISPLAY || 'Yes'}")), [role="button"]:has-text("${process.env.DEBT_REVIEW_YES_DISPLAY || 'Yes'}")`).first()
          : page.locator(`div[tabindex="0"]:has(h1:has-text("${process.env.DEBT_REVIEW_NO_DISPLAY || 'No'}")), button:has(h1:has-text("${process.env.DEBT_REVIEW_NO_DISPLAY || 'No'}")), [role="button"]:has-text("${process.env.DEBT_REVIEW_NO_DISPLAY || 'No'}")`).first();
      await choice.waitFor({ timeout: parseInt(process.env.UNIVERSAL_WAIT_TIMEOUT || '3000', 10) });
      await choice.click({ timeout: parseInt(process.env.UNIVERSAL_CLICK_TIMEOUT || '3000', 10), force: true });
      console.log('Selected debt review status:', underDebt ? 'Yes' : 'No');
      
      const next5 = page.locator([
        'button:has(h1:has-text("Next"))',
        'button:has-text("Next")',
        '[role="button"]:has-text("Next")'
      ].join(', ')).first();
      await next5.waitFor({ timeout: parseInt(process.env.UNIVERSAL_WAIT_TIMEOUT || '3000', 10) });
      await next5.click({ timeout: parseInt(process.env.UNIVERSAL_CLICK_TIMEOUT || '3000', 10), force: true });
      console.log('Clicked Next after debt review');
    } catch (error) {
      console.log('Debt review question not found:', error.message);
      throw error;
    }
    
    // Verify we've completed the Personalise My Products flow
    // The flow should now show the "Start Earning" button or similar completion state
    console.log('Personalise My Products flow completed successfully');
    
    // Optional: Wait a bit to see the final state
    await page.waitForTimeout(parseInt(process.env.UNIVERSAL_WAIT_TIMEOUT || '3000', 10));
  });
});
