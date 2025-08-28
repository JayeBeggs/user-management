#!/usr/bin/env node
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import dayjs from 'dayjs';

function luhnCheckDigit(numberWithoutCheck) {
  // Luhn for numeric string
  // Starting from right, double every second digit and sum digits
  const digits = numberWithoutCheck.split('').map(n => parseInt(n, 10));
  let sum = 0;
  for (let i = digits.length - 1, alt = true; i >= 0; i--, alt = !alt) {
    let d = digits[i];
    if (alt) {
      d = d * 2;
      if (d > 9) d = d - 9;
    }
    sum += d;
  }
  const check = (10 - (sum % 10)) % 10;
  return String(check);
}

function pad(num, size) {
  let s = String(num);
  while (s.length < size) s = '0' + s;
  return s;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateSaId({ birthDate, gender, citizen }) {
  // Structure: YYMMDD SSSS C A Z
  // YYMMDD: birth date
  // SSSS: sequence+gender (0000–4999 female, 5000–9999 male)
  // C: citizenship (0 citizen, 1 permanent resident)
  // A: usually 8 or 9 (often 8 for SA IDs)
  // Z: Luhn check digit
  const dob = dayjs(birthDate);
  if (!dob.isValid()) throw new Error('Invalid birthDate');
  const yymmdd = dob.format('YYMMDD');
  const seq = gender === 'male' ? randomInt(5000, 9999) : randomInt(0, 4999);
  const ssss = pad(seq, 4);
  const c = citizen === 'resident' ? '1' : '0';
  const a = '8';
  const base = `${yymmdd}${ssss}${c}${a}`; // 12 digits
  const z = luhnCheckDigit(base);
  const id = `${base}${z}`;
  return {
    id,
    birthDate: dob.format('YYYY-MM-DD'),
    gender,
    citizen: c === '0' ? 'citizen' : 'resident'
  };
}

const argv = yargs(hideBin(process.argv))
  .option('birthdate', { type: 'string', desc: 'YYYY-MM-DD; defaults random adult 18-65' })
  .option('gender', { choices: ['male', 'female'], default: 'male' })
  .option('citizen', { choices: ['citizen', 'resident'], default: 'citizen' })
  .option('count', { type: 'number', default: 1 })
  .help()
  .argv;

function randomAdultBirthdate() {
  const now = dayjs();
  const minAge = 18;
  const maxAge = 65;
  const years = randomInt(minAge, maxAge);
  const days = randomInt(0, 364);
  return now.subtract(years, 'year').subtract(days, 'day').format('YYYY-MM-DD');
}

const out = [];
for (let i = 0; i < argv.count; i++) {
  const bd = argv.birthdate || randomAdultBirthdate();
  const g = argv.gender;
  const c = argv.citizen;
  out.push(generateSaId({ birthDate: bd, gender: g, citizen: c }));
}

process.stdout.write(JSON.stringify(out.length === 1 ? out[0] : out, null, 2));


