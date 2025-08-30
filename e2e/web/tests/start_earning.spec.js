import { test } from '@playwright/test';
import { loginFlow, ensurePersonalisationComplete, executeStartEarningFlow } from '../utils/app.js';

test.describe('Start Earning Flow', () => {
  test('complete start earning flow after login', async ({ page, browser }) => {
    console.log('💰 Starting Start Earning Flow Test');
    
    await loginFlow(page, browser);
    console.log('✅ Login completed');
    
    await ensurePersonalisationComplete(page);
    await executeStartEarningFlow(page);
    
    console.log('🎉 Start Earning flow completed successfully!');
  });
});