#!/usr/bin/env node
import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables from .env (and optionally .env.local)
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local', override: true });

function getArg(name) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1];
  return undefined;
}

// App auth capture: interactive Vercel/app login and save app state
const APP_URL = process.env.APP_WEB_URL || 'https://app.st4ge.com';
const OUT = getArg('out') || process.env.PLAYWRIGHT_STORAGE_STATE || './e2e/web/auth/.app_state.json';

async function main() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(APP_URL);
  await page.waitForLoadState('domcontentloaded');

  const waitSelector = process.env.APP_WAIT_SELECTOR; // e.g. [data-test="user-avatar"]
  const waitUrlRegex = process.env.APP_WAIT_URL_REGEX; // e.g. ^https://app\.st4ge\.com/(dashboard|home)
  const waitSeconds = parseInt(process.env.APP_WAIT_SECONDS || '300', 10);
  const waitMs = waitSeconds * 1000;

  console.log('Complete Vercel app auth in the opened browser.');
  if (waitSelector) {
    console.log(`Waiting for selector: ${waitSelector}`);
    await page.waitForSelector(waitSelector, { timeout: waitMs });
  } else if (waitUrlRegex) {
    console.log(`Waiting for URL to match: ${waitUrlRegex}`);
    await page.waitForURL(new RegExp(waitUrlRegex), { timeout: waitMs });
  } else {
    console.log('Press Enter here when app login is complete to save the session...');
    await new Promise((resolve) => {
      process.stdin.setEncoding('utf8');
      process.stdin.resume();
      process.stdin.once('data', () => resolve());
    });
  }

  const outPath = path.resolve(process.cwd(), OUT);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  await context.storageState({ path: outPath });
  console.log(`Saved app storage state to ${outPath}`);
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });


