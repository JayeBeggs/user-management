import { test } from '@playwright/test';
import { verifySeparatedCdm } from '../utils/cdm.js';

test.describe('User Verification Flow', () => {
  test('verify users in CDM admin panel', async () => {
    console.log('🔍 Starting User Verification Flow');
    
    // Get list of users to verify from environment or use default test data
    const userIds = process.env.VERIFY_USER_IDS ? 
      process.env.VERIFY_USER_IDS.split(',').map(id => id.trim()) : 
      ['8207106197083']; // Default test ID
    
    console.log('👥 Users to verify:', userIds);
    
    for (let i = 0; i < userIds.length; i++) {
      const userId = userIds[i];
      console.log(`\n=== STARTING VERIFICATION ${i + 1}/${userIds.length} ===`);
      console.log(`🔎 Verifying user with ID: ${userId}`);
      
      // Create mock media object for verification
      const media = {
        id: userId,
        seed: `verification_${userId}`,
        idFront: 'mock_front.jpg',
        idBack: 'mock_back.jpg'
      };
      
      console.log('🔍 Starting CDM Verification Process');
      const verificationSuccess = await verifySeparatedCdm(media);
      
      if (verificationSuccess) {
        console.log(`✅ VERIFICATION ${i + 1}/${userIds.length} COMPLETED: User ${userId} verified successfully`);
      } else {
        console.log(`⚠️ VERIFICATION ${i + 1}/${userIds.length} FAILED: User ${userId} not found or verification failed`);
      }
      
      console.log(`📊 Verification Result: ID ${userId} - ${verificationSuccess ? 'SUCCESS' : 'FAILED'}\n`);
    }
    
    console.log('🏆 ALL USER VERIFICATIONS COMPLETED!');
    console.log('💡 Users are now ready for login and onboarding flows');
  });
});
