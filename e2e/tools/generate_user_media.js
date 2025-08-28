#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { stdio: 'pipe', encoding: 'utf8', ...opts });
  if (res.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} failed with code ${res.status}`);
  }
}

function readJsonFromStdout(cmd, args) {
  const res = spawnSync(cmd, args, { encoding: 'utf8' });
  if (res.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} failed with code ${res.status}`);
  }
  return JSON.parse(res.stdout);
}

const seed = process.env.TEST_SEED || String(Date.now());
const outDir = path.resolve(process.cwd(), `e2e/.run_media/${seed}`);
fs.mkdirSync(outDir, { recursive: true });

// Generate SA ID
const idObj = readJsonFromStdout('node', [path.resolve(process.cwd(), 'e2e/tools/sa_id_gen.js')]);

// Compute issue date: today by default
const issueDate = new Date().toISOString().slice(0,10);

// Create front/back ID images
const name = process.env.TEST_NAME || 'Test User';
const makeImagesArgs = [path.resolve(process.cwd(), 'e2e/tools/make_id_images.js'),
  '--outDir', outDir,
  '--id', idObj.id,
  '--name', name,
  '--issueDate', issueDate
];
run('node', makeImagesArgs);

// Emit paths for downstream tests
const result = {
  seed,
  id: idObj.id,
  issueDate,
  idFront: path.join(outDir, 'id_front.png'),
  idBack: path.join(outDir, 'id_back.png')
};

fs.writeFileSync(path.join(outDir, 'meta.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));


