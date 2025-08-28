#!/usr/bin/env node
import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const CDM_URL = process.env.CDM_WEB_URL || 'https://cdm.st4ge.com';
const DJANGO_ADMIN_USERS_URL = process.env.DJANGO_ADMIN_USERS_URL || CDM_URL + '/users';
const OUT = process.env.PLAYWRIGHT_CDM_STATE || './e2e/web/auth/.cdm_state.json';

async function main() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(DJANGO_ADMIN_USERS_URL);

  const waitSelector = process.env.CDM_WAIT_SELECTOR; // e.g. text=Users
  const waitUrlRegex = process.env.CDM_WAIT_URL_REGEX;
  const waitSeconds = parseInt(process.env.CDM_WAIT_SECONDS || '300', 10);
  const waitMs = waitSeconds * 1000;

  console.log('Complete Google/CDM admin login in the opened browser.');
  if (waitSelector) {
    console.log(`Waiting for selector: ${waitSelector}`);
    await page.waitForSelector(waitSelector, { timeout: waitMs });
  } else if (waitUrlRegex) {
    console.log(`Waiting for URL to match: ${waitUrlRegex}`);
    await page.waitForURL(new RegExp(waitUrlRegex), { timeout: waitMs });
  } else {
    console.log('Press Enter here when admin page is loaded to save the session...');
    await new Promise((resolve) => {
      process.stdin.setEncoding('utf8');
      process.stdin.resume();
      process.stdin.once('data', () => resolve());
    });
  }

  const outPath = path.resolve(process.cwd(), OUT);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  await context.storageState({ path: outPath });
  console.log(`Saved CDM storage state to ${outPath}`);
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });


