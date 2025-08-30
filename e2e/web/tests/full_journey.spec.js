import { test } from '@playwright/test';
import { completeUserCreationFlow, loginFlow, executePersonalisationFlow, executeStartEarningFlow } from '../utils/app.js';

const NUM_USERS = parseInt(process.env.NUM_USERS || '1', 10);

test.describe('Full Journey: Signup → Personalise → Start Earning', () => {
  test('complete full user journey from signup to earning activation', async ({ page, browser }) => {
    for (let i = 0; i < NUM_USERS; i++) {
      console.log(`\n=== STARTING FULL JOURNEY ${i + 1}/${NUM_USERS} ===`);
      
      const { userData } = await completeUserCreationFlow(page, browser);
      
      page = await browser.newPage();
      
      console.log('🎯 PHASE 2: Starting Login & Personalisation');
      
      await loginFlow(page, browser, userData.phone);
      console.log('✅ Login completed');

      await executePersonalisationFlow(page, 'PHASE 2 Personalisation');

      console.log('✅ PHASE 2 COMPLETED: Login and personalisation finished');

      console.log('💰 PHASE 3: Starting Earning Activation');
      await executeStartEarningFlow(page, 'PHASE 3');

      await page.waitForTimeout(2000);
      console.log('✅ PHASE 3 COMPLETED: Earning activation finished');

      console.log(`\n🎉 FULL JOURNEY COMPLETED FOR USER ${i + 1}/${NUM_USERS}`);
      console.log(`📊 User Details: ${userData.name} (${userData.phone}) - ${userData.email}`);
      console.log('🚀 Journey: Signup → KYC → PIN → Login → Personalise → Start Earning\n');
    }
    
    console.log('🏆 ALL FULL JOURNEYS COMPLETED SUCCESSFULLY!');
  });
});