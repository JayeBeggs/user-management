import { test } from '@playwright/test';
import { loginFlow, executePersonalisationFlow, executeStartEarningFlow } from '../utils/app.js';

test.describe('Complete Onboarding Flow', () => {
  test('complete personalise my products and start earning flows', async ({ page, browser }) => {
    console.log('🎯 Starting Complete Onboarding Flow Test');
    
    await loginFlow(page, browser);
    console.log('✅ Login completed');
    
    console.log('=== PHASE 1: Starting Personalise My Products Flow ===');
    await executePersonalisationFlow(page, 'PHASE 1');
    
    console.log('=== PHASE 2: Starting Start Earning Flow ===');
    await executeStartEarningFlow(page, 'PHASE 2');
    
    console.log('🎉 Complete Onboarding Flow finished successfully!');
  });
});