#!/usr/bin/env node
import { createCanvas, loadImage } from 'canvas';
import fs from 'fs';
import path from 'path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function drawIdCard({ idNumber, name, issueDate, variant = 'front', width = 1080, height = 720 }) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = variant === 'front' ? '#203040' : '#304860';
  ctx.fillRect(0, 0, width, height);

  // Header bar
  ctx.fillStyle = '#0aa370';
  ctx.fillRect(0, 0, width, 120);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 48px sans-serif';
  ctx.fillText('SOUTH AFRICA - TEST ID', 40, 80);

  // Photo placeholder
  ctx.fillStyle = '#556B8B';
  ctx.fillRect(40, 160, 300, 400);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4;
  ctx.strokeRect(40, 160, 300, 400);
  ctx.fillStyle = '#ffffff';
  ctx.font = '28px sans-serif';
  ctx.fillText('PHOTO', 140, 370);

  // Text blocks
  ctx.fillStyle = '#ffffff';
  ctx.font = '36px sans-serif';
  ctx.fillText(`Name: ${name}`, 380, 240);
  ctx.fillText(`ID No: ${idNumber}`, 380, 300);
  if (variant === 'back') {
    ctx.fillText(`Issue Date: ${issueDate}`, 380, 360);
  }

  // Large watermark token for OCR uniqueness
  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.rotate(-Math.PI / 8);
  ctx.globalAlpha = 0.15;
  ctx.fillStyle = '#ffff66';
  ctx.font = 'bold 92px sans-serif';
  ctx.fillText(idNumber, -ctx.measureText(idNumber).width / 2, 0);
  ctx.restore();

  return canvas;
}

function writePng(canvas, outPath) {
  const buf = canvas.toBuffer('image/png');
  fs.writeFileSync(outPath, buf);
}

const argv = yargs(hideBin(process.argv))
  .option('outDir', { type: 'string', demandOption: true })
  .option('id', { type: 'string', demandOption: true })
  .option('name', { type: 'string', default: 'Test User' })
  .option('issueDate', { type: 'string', demandOption: true })
  .help()
  .argv;

ensureDir(argv.outDir);

const front = drawIdCard({ idNumber: argv.id, name: argv.name, issueDate: argv.issueDate, variant: 'front' });
const back = drawIdCard({ idNumber: argv.id, name: argv.name, issueDate: argv.issueDate, variant: 'back' });

writePng(front, path.join(argv.outDir, 'id_front.png'));
writePng(back, path.join(argv.outDir, 'id_back.png'));

process.stdout.write(JSON.stringify({
  idFront: path.join(argv.outDir, 'id_front.png'),
  idBack: path.join(argv.outDir, 'id_back.png')
}, null, 2));


