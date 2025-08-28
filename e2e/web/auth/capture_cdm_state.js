#!/usr/bin/env node
import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local', override: true });

const USERS_URL = process.env.DJANGO_ADMIN_USERS_URL || 'https://cdm.st4ge.com/2tNFZrSGvTr9CqKM8Wsf5alcO9mBNwo4/users/user/';
const ADMIN_ROOT = USERS_URL.replace(/users\/user\/?\.*/, '');
const OUT = process.env.PLAYWRIGHT_CDM_STATE || './e2e/web/auth/.cdm_state.json';

async function main() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  const adminUsername = process.env.DJANGO_ADMIN_USERNAME || process.env.ADMIN_USERNAME || '';
  const adminPassword = process.env.DJANGO_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || '';
  if (!adminUsername || !adminPassword) {
    throw new Error('Set DJANGO_ADMIN_USERNAME and DJANGO_ADMIN_PASSWORD to use this script.');
  }

  console.log('Opening admin root:', ADMIN_ROOT);
  await page.goto(ADMIN_ROOT);
  await page.waitForLoadState('domcontentloaded');

  const usernameInput = page.locator('input#id_username, input[name="username"]');
  const passwordInput = page.locator('input#id_password, input[name="password"]');
  await usernameInput.first().fill(adminUsername);
  await passwordInput.first().fill(adminPassword);
  const submitBtn = page.getByRole('button', { name: /log in|sign in|submit/i });
  if (await submitBtn.count()) {
    await submitBtn.first().click();
  } else {
    const form = page.locator('form');
    if (await form.count()) await form.first().evaluate((f) => f.submit());
  }

  try {
    await page.waitForSelector('a[href*="/logout/"], #content-main, .module', { timeout: 20000 });
  } catch {}

  const outPath = path.resolve(process.cwd(), OUT);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  await context.storageState({ path: outPath });
  console.log(`Saved CDM admin storage state to ${outPath}`);
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });


