import { test } from '@playwright/test';
import { generateUserMedia, signupFlow, kycFlow } from '../utils/app.js';

const NUM_USERS = parseInt(process.env.NUM_USERS || '5', 10);

test.describe('User Signup Flow', () => {
  test('create users via signup + OTP + KYC + PIN creation', async ({ page, browser }) => {
    for (let i = 0; i < NUM_USERS; i++) {
      console.log(`\n=== STARTING USER SIGNUP ${i + 1}/${NUM_USERS} ===`);
      
      const media = await generateUserMedia();
      console.log('📸 Generated user media:', { id: media.id, seed: media.seed });
      
      console.log('🚀 PHASE 1: Starting Signup Flow');
      const userData = await signupFlow(page, browser, { id: media.id });
      console.log('✅ PHASE 1 COMPLETED: Signup finished');
      console.log('👤 User Details:', userData);
      
      console.log('📋 PHASE 2: Starting KYC Flow');
      await kycFlow(page, media);
      console.log('✅ PHASE 2 COMPLETED: KYC + PIN creation finished');
      
      if (i < NUM_USERS - 1) {
        await page.close();
        page = await browser.newPage();
        console.log('🆕 New page created for next user');
      }
      
      console.log(`🎉 USER SIGNUP ${i + 1}/${NUM_USERS} COMPLETED`);
      console.log(`📊 User Created: ${userData.name} (${userData.phone}) - ID: ${userData.id}`);
      console.log('🚀 Flow: Phone → OTP → Details → KYC → PIN ✅\n');
    }
    
    console.log('🏆 ALL USER SIGNUPS COMPLETED SUCCESSFULLY!');
    console.log('💡 Next step: Run user_verification.spec.js to verify users in CDM');
  });
});
