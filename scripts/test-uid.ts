import generateUID from '../src/util/generateUID';

const testCases = [
  { area: 'Florida', expectedPrefix: 'FLO' },
  { area: 'New York', expectedPrefix: 'NEW' },
  { area: 'CA', expectedPrefix: 'CAX' },
  { area: '', expectedPrefix: 'SYS' },
  { area: 'Miami 26', expectedPrefix: 'MIA' },
];

console.log('--- UID Generation Test ---');
testCases.forEach(({ area, expectedPrefix }) => {
  const uid = generateUID(area);
  const prefix = uid.split('-')[0];
  const isValid = prefix === expectedPrefix && uid.split('-')[1].length === 6;
  console.log(`Area: "${area}" => UID: "${uid}" | Prefix Match: ${prefix === expectedPrefix} | Valid: ${isValid}`);
});
console.log('---------------------------');
