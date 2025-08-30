import { test } from '@playwright/test';
import { completeUserCreationFlow } from '../utils/app.js';

const NUM_USERS = parseInt(process.env.NUM_USERS || '5', 10);

test.describe('Signup flow creates multiple users via app with OTP', () => {
  test('create 5 users via signup + OTP + KYC images', async ({ page, browser }) => {
    for (let i = 0; i < NUM_USERS; i++) {
      console.log(`\n=== STARTING USER CREATION ${i + 1}/${NUM_USERS} ===`);
      
      const { userData } = await completeUserCreationFlow(page, browser);
      
      if (i < NUM_USERS - 1) {
        page = await browser.newPage();
        console.log('🆕 New page created for next user');
      }
      
      console.log(`🎉 USER ${i + 1}/${NUM_USERS} CREATION COMPLETED`);
      console.log(`📊 Final User: ${userData.name} (${userData.phone}) - ID: ${userData.id}`);
      console.log('🚀 Flow: Signup → KYC → CDM Verification ✅\n');
    }
    
    console.log('🏆 ALL USER CREATIONS COMPLETED SUCCESSFULLY!');
  });
});