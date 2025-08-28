# Web QA Tests – Super Simple Guide

Hi! We will do things one by one. Nice and easy.

## What this does
- It pretends to be you on the website.
- It makes 5 new users (or more if you want).
- It uses the real signup flow with an OTP code (not the admin).
- It grabs the OTP code from the admin panel and types it in.
- It uploads two ID images and does the 2‑click video step.

## Before we start (one time)
1) Install things
```bash
npm install
npx playwright install --with-deps
```

2) Save your app login (Vercel auth)
- This opens a browser. You sign in once. We save the session for later.
```bash
npm run auth:web
```

3) Save your admin login (Google → CDM/Django)
- This opens a browser. You sign in once. We save the session for later.
```bash
npm run auth:cdm
```

If the saved login ever stops working, just run the command again.

## Make 5 users (the easy button)
```bash
npm run test:web:create-5
```
What happens:
- The test makes a unique South African ID and two pictures for each person.
- It opens the app, taps “Sign up”, fills name + ID + phone.
- It presses “Send OTP”.
- It opens the admin in the background, reads the OTP, and comes back.
- It types the OTP and continues.
- It uploads the two ID pictures.
- It clicks “Record”, waits a moment, then “Stop”. Done!

## Change a user (quick edit)
```bash
npm run test:web:update
```
This opens the latest user and changes the name (you can expand this later).

## Make more or fewer users
- Default is 5.
- To make 10 users:
```bash
NUM_USERS=10 npm run test:web:create-5
```

## Where do the pictures live?
- We make new pictures for each user with their ID number on them.
- They are saved here: `e2e/.run_media/<seed>/`
- We also save a tiny `meta.json` with the ID number and file paths.

## Optional: fake camera video for the 2‑click step (web only)
- You don’t need this, but if you want a “fake camera” with unique content:
  1) Make a tiny 4‑second y4m file (needs ffmpeg installed):
  ```bash
  seed="cam$(date +%s)"; mkdir -p e2e/.run_media; \
  ffmpeg -f lavfi -i color=c=darkblue:s=1280x720:r=30 -t 4 \
    -vf "drawtext=text='${seed}':fontsize=48:fontcolor=yellow:x=40:y=40" \
    -pix_fmt yuv420p -f yuv4mpegpipe e2e/.run_media/${seed}.y4m
  ```
  2) Tell Playwright to use it:
  ```bash
  CAMERA_Y4M=./e2e/.run_media/${seed}.y4m npm run test:web:create-5
  ```
- The app still thinks it’s the camera. We just give the browser a file to use.

## Important notes
- Admin is only used to read OTP. We do not add users in admin.
- The test uses your saved sessions. No passwords are stored in code.
- If OTP lookup fails, tell me where the OTP shows in admin (page + selector). I’ll wire it up.

## Useful commands (all from the project root)
```bash
# Install
npm install
npx playwright install --with-deps

# Save sessions (do these once, headed)
npm run auth:web
npm run auth:cdm

# Create users
npm run test:web:create-5

# Update a user
npm run test:web:update
```

## Files to know
- `e2e/web/tests/create_users.spec.js` – makes users via signup + OTP + uploads + video
- `e2e/web/tests/update_users.spec.js` – updates a user
- `e2e/tools/sa_id_gen.js` – makes valid South African ID numbers
- `e2e/tools/make_id_images.js` – makes two pictures with the ID on them
- `e2e/tools/generate_user_media.js` – creates per‑user media + meta.json

## Extra: SA ID format (why it looks real)
- South African ID looks like `YYMMDD SSSS C A Z` with a Luhn check digit.
- For reference:
  - SA ID Generator: https://saidtools.co.za/sa-id-generator/
  - South Africa ID Generator: https://globalidcheck.com/en/generator/south-africa-idnr

