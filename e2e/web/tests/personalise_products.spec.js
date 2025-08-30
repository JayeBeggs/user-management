import { test } from '@playwright/test';
import { loginFlow, executePersonalisationFlow } from '../utils/app.js';

test.describe('Personalise My Products Flow', () => {
  test('complete personalise my products flow after login', async ({ page, browser }) => {
    console.log('🎨 Starting Personalise My Products Flow Test');
    
    await loginFlow(page, browser);
    await page.waitForTimeout(1000);
    console.log('✅ Login completed, starting personalisation');
    
    await executePersonalisationFlow(page, 'Personalise My Products');
    
    console.log('🎉 Personalise My Products flow completed successfully!');
  });
});