# E2E Test Codebase Cleanup & Optimization Work Plan

## Overview
Final cleanup and optimization of the E2E test codebase to ensure consistency, remove duplication, and improve maintainability.

## Work Items (Ordered by Difficulty - Easiest First)

### ✅ 1. Rename create_users to signup_users
- [x] Rename `e2e/web/tests/create_users.spec.js` → `signup_users.spec.js`
- [x] Update package.json script `test:web:create` → `test:web:signup`
- [x] Update any references in README.md
- [x] Update any internal comments/descriptions

### ✅ 2. Remove non-essential comments
- [x] Review all files for outdated/redundant comments
- [x] Remove comments that don't add value
- [x] Ensure remaining comments accurately reflect the code
- [x] Keep only essential documentation comments

### ✅ 3. Verify environment variable usage
- [x] Check all files use proper env var fallback pattern `process.env.VAR || 'default'`
- [x] Ensure no hardcoded values bypass environment variables
- [x] Verify DEFAULT_PHONE, DEFAULT_PIN, EMAIL_DOMAIN, KASTELO_USER are used consistently
- [x] Test that .env/.env.local values are properly loaded

### ✅ 4. Check for duplicated code across all files
- [x] Scan `e2e/web/tests/*.spec.js` for duplicate logic
- [x] Scan `e2e/web/utils/*.js` for duplicate functions
- [x] Look for repeated patterns that could be helpers
- [x] Create `executePersonalisationFlow()` and `executeStartEarningFlow()` helpers
- [x] Update `personalise_products.spec.js` to use new helpers
- [x] Update remaining test files to use new helpers

### ✅ 5. Implement CDM auth state saving/loading
- [x] Update `e2e/web/utils/cdm.js` to use saved auth state
- [x] Modify `verifySeparatedCdm` to load existing CDM session
- [x] Ensure CDM login only happens once and state is reused
- [x] Test that CDM auth persists across test runs

### ✅ 6. Comprehensive file review for consistency
- [x] Review all test files for consistent patterns
- [x] Ensure all files use the same helper functions
- [x] Check import statements are consistent
- [x] Verify error handling patterns are uniform
- [x] Ensure logging patterns are consistent

### ✅ 7. Update README.md
- [x] Update script names (create → signup)
- [x] Document new helper functions
- [x] Update architecture section
- [x] Add troubleshooting section
- [x] Update examples with current code

### ✅ 8. Final testing and validation
- [x] Run all tests to ensure no regressions
- [x] Verify environment variable loading works
- [x] Test CDM auth state reuse
- [x] Confirm all renamed references work
- [x] Validate helper function consistency

## Files Reviewed ✅

### Test Files
- [x] `e2e/web/tests/signup_users.spec.js` (renamed)
- [x] `e2e/web/tests/full_journey.spec.js`
- [x] `e2e/web/tests/personalise_products.spec.js`
- [x] `e2e/web/tests/start_earning.spec.js`
- [x] `e2e/web/tests/complete_onboarding.spec.js`

### Utility Files
- [x] `e2e/web/utils/app.js`
- [x] `e2e/web/utils/cdm.js`
- [x] `e2e/web/utils/inputs.js`
- [x] `e2e/web/utils/otp.js`
- [x] `e2e/web/utils/kyc.js`

### Configuration Files
- [x] `package.json`
- [x] `README.md`
- [x] `playwright.config.ts`

## Success Criteria ✅
- [x] All tests pass without regressions
- [x] No code duplication exists
- [x] Environment variables work consistently
- [x] CDM auth state is properly reused
- [x] All files follow consistent patterns
- [x] Documentation is accurate and up-to-date
