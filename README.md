# Kastelo E2E Testing Suite

A comprehensive end-to-end testing framework for the Kastelo financial application using Playwright. This suite automates user registration, KYC verification, personalisation, and onboarding flows with intelligent OTP handling and CDM admin panel integration.

## 🚀 Features

- **Complete User Journey Testing**: From signup to earning activation
- **Automated KYC Processing**: ID document upload and liveness verification
- **Smart OTP Handling**: Automatic OTP retrieval from CDM admin panel
- **Dynamic Media Generation**: Synthetic ID cards and user data
- **Multi-Browser Support**: Chromium, Chrome, Edge with camera/microphone permissions
- **Robust Error Handling**: Intelligent fallbacks and retry mechanisms
- **Environment-Driven Configuration**: Flexible test parameters via environment variables

## 📁 Project Structure

```
e2e/
├── web/
│   ├── auth/                    # Authentication state management
│   │   ├── capture_app_state.js    # Capture app login state
│   │   └── capture_cdm_state.js    # Capture CDM admin state
│   ├── tests/                   # Test specifications
│   │   ├── create_users.spec.js         # User signup + KYC flow
│   │   ├── personalise_products.spec.js # Product personalisation
│   │   ├── start_earning.spec.js        # Earning activation
│   │   ├── complete_onboarding.spec.js  # Full onboarding flow
│   │   ├── full_journey.spec.js         # Complete signup to earning
│   │   └── update_users.spec.js         # User profile updates
│   ├── utils/                   # Utility functions
│   │   ├── app.js                  # App interaction helpers
│   │   ├── inputs.js               # Input handling (phone, PIN)
│   │   ├── otp.js                  # OTP retrieval from CDM
│   │   ├── kyc.js                  # KYC upload and liveness
│   │   └── cdm.js                  # CDM admin panel operations
│   └── playwright.config.ts     # Playwright configuration
└── tools/                       # Media generation tools
    ├── generate_user_media.js      # Complete user media package
    ├── make_id_images.js           # ID card image generation
    └── sa_id_gen.js               # South African ID generation
```

## 🛠️ Installation

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Setup
```bash
# Clone and install dependencies
npm install

# Install Playwright browsers with dependencies
npm run pw:install

# Set up authentication states (optional)
npm run auth:app    # Capture app login state
npm run auth:cdm    # Capture CDM admin state
```

## ⚙️ Configuration

### Environment Variables

Create `.env` and `.env.local` files in the project root:

```bash
# Application URLs
APP_WEB_URL=https://app.st4ge.com
CDM_UI_URL=https://cdm.st4ge.com/

# CDM Admin Panel
DJANGO_ADMIN_USERNAME=+27725235000
DJANGO_ADMIN_PASSWORD=1234
CDM_OTP_URL=https://cdm.st4ge.com/.../users/otp/?o=-5
CDM_SIGNUP_OTP_URL=https://cdm.st4ge.com/.../users/signupotp/?o=-5

# Test Configuration
DEFAULT_PHONE=0689100001
DEFAULT_PIN=1234
EMAIL_DOMAIN=kastelo.com
KASTELO_USER=jody

# Timeouts (milliseconds)
UNIVERSAL_CLICK_TIMEOUT=3000
UNIVERSAL_WAIT_TIMEOUT=3000

# Test Data
NUM_USERS=1
EMPLOYED=1
INCOME_BAND=highest
TAX_REGION=sa_only
DEBT_REVIEW=0

# Browser Settings
HEADLESS=0                    # 0=headed, 1=headless
PW_BROWSER_CHANNEL=chrome
```

### Key Configuration Options

| Variable | Description | Default |
|----------|-------------|---------|
| `APP_WEB_URL` | Main application URL | `https://app.st4ge.com` |
| `DEFAULT_PHONE` | Test phone number | `0689100001` |
| `DEFAULT_PIN` | User PIN code | `1234` |
| `EMAIL_DOMAIN` | Email domain for test users | `kastelo.com` |
| `NUM_USERS` | Number of users to create in batch | `1` |
| `HEADLESS` | Run tests in headless mode | `0` (headed) |
| `UNIVERSAL_CLICK_TIMEOUT` | Global click timeout | `3000ms` |
| `UNIVERSAL_WAIT_TIMEOUT` | Global wait timeout | `3000ms` |

## 🧪 Test Suites

### Individual Test Flows

```bash
# User Creation (Signup + KYC)
npm run test:web:create

# Product Personalisation (after login)
npm run test:web:personalise

# Start Earning Activation
npm run test:web:start-earning

# Complete Onboarding (Personalise + Start Earning)
npm run test:web:onboarding

# Full Journey (Signup + Personalise + Start Earning)
npm run test:web:full-journey
```

### Utility Scripts

```bash
# Generate synthetic user media
npm run gen:user-media

# Generate South African ID numbers
npm run gen:sa-id

# Create ID card images
npm run gen:media
```

## 🔧 Core Utilities

### Phone & PIN Input (`utils/inputs.js`)
- **`setPhoneNumber(page, digits)`**: Robust phone number input with multiple fallback strategies
- **`enterPin(page, code)`**: PIN entry for login (keypad + input field support)
- **`createPin(page, code)`**: PIN creation during signup (keypad interaction)
- **`isPinComplete(page, expectedLength)`**: Validates PIN completion across different UI patterns

### OTP Management (`utils/otp.js`)
- **`getOtp({browser, type})`**: Retrieves OTP from CDM admin panel
- **`enterOtp(page, otp)`**: Enters OTP with support for single/multi-input fields
- Smart routing between login (`CDM_OTP_URL`) and signup (`CDM_SIGNUP_OTP_URL`) endpoints

### App Interactions (`utils/app.js`)
- **`clickButtonByText(page, texts, timeout)`**: Generic button clicker with text variants
- **`completePersonaliseMyProductsFlow(page)`**: Complete personalisation questionnaire
- **`loginWithPhone(page, browser)`**: Full login flow with phone + OTP + PIN

### KYC Processing (`utils/kyc.js`)
- **`uploadIdSection(page, label, filePath)`**: Upload ID documents
- **`recordLivenessWithRetry(page)`**: Liveness detection with camera
- **`ensureCameraReady(page)`**: Camera permission and readiness checks

## 📊 Test Flows

### 1. User Creation Flow (`create_users.spec.js`)
```
Navigate to App → Enter Phone → Request OTP → Enter OTP → 
Fill Name → Fill ID Number → Fill Email → Select ID Type → 
Upload ID Front/Back → Record Liveness → Create PIN → 
CDM Verification → Approval
```

### 2. Personalisation Flow (`personalise_products.spec.js`)
```
Login → Enter PIN → Navigate to Personalise → Answer Employment → 
Answer Income → Answer Tax Registration → Answer Debt Review → Complete
```

### 3. Start Earning Flow (`start_earning.spec.js`)
```
Login → Complete Personalisation (if needed) → Click Start Earning → Activate
```

### 4. Complete Onboarding (`complete_onboarding.spec.js`)
```
Login → Complete Personalisation → Activate Start Earning
```

### 5. Full Journey (`full_journey.spec.js`)
```
Signup → KYC → PIN Creation → [Signup Window Closes] → 
Separate CDM Verification → Login → Personalisation → Start Earning
```

## 🎯 Key Features

### Intelligent PIN Handling
- **Separate Functions**: `createPin()` for signup, `enterPin()` for login
- **Multiple Strategies**: Keypad clicking, input field filling, per-digit inputs
- **Visual Validation**: Checks PIN completion via UI dots and input values

### Smart OTP Retrieval
- **Automatic Admin Login**: Connects to CDM admin panel
- **Endpoint Fallback**: Tries login endpoint, falls back to signup endpoint
- **Error Recovery**: Handles OTP retrieval failures gracefully

### Dynamic Media Generation
- **Synthetic ID Cards**: Generates realistic South African ID documents
- **Random User Data**: Creates unique names, ID numbers, and media files
- **Automated KYC**: Uses generated media for document upload

### Robust Error Handling
- **Retry Mechanisms**: Multiple attempts for critical operations
- **Fallback Strategies**: Alternative selectors and interaction methods
- **Detailed Logging**: Comprehensive console output for debugging

## 🐛 Debugging

### Enable Debug Mode
```bash
# Verbose Playwright logs
DEBUG=pw:api npm run test:web:create

# Run in headed mode
HEADLESS=0 npm run test:web:personalise

# Inspect element interactions
INSPECT_DELAY_MS=1000 npm run test:web:onboarding
```

### Common Issues

**PIN Entry Fails**
- Check `DEFAULT_PIN` environment variable
- Verify keypad elements are visible
- Enable debug logging in `enterPin()` function

**OTP Retrieval Fails**
- Verify CDM admin credentials
- Check `CDM_OTP_URL` and `CDM_SIGNUP_OTP_URL`
- Ensure admin panel is accessible

**Upload Failures**
- Verify media files exist in `e2e/.run_media/`
- Check camera permissions
- Run `npm run gen:user-media` to regenerate media

## 🔒 Security Notes

- **Test Environment Only**: Never use production credentials
- **Synthetic Data**: All generated IDs and media are for testing only
- **Admin Access**: CDM admin credentials should be test-specific

## 📈 Performance

- **Optimized Timeouts**: Balanced speed vs reliability
- **Parallel Execution**: Multiple test files can run concurrently
- **Smart Waits**: Uses `waitForLoadState` and element visibility
- **Efficient Media**: Generates media once per test run

## 🤝 Contributing

1. **Environment Setup**: Ensure all environment variables are configured
2. **Code Style**: Follow existing patterns for utility functions
3. **Error Handling**: Add comprehensive try-catch blocks
4. **Logging**: Include detailed console.log statements for debugging
5. **Testing**: Verify changes work across different browsers

## 📝 License

This testing suite is proprietary to Kastelo and intended for internal testing purposes only.

---

**Built with ❤️ for reliable E2E testing of the Kastelo financial platform**
