import chalk from 'chalk';
import ora, { Ora } from 'ora';

// ─── Spinner ──────────────────────────────────────────────────────────────────

let _spinner: Ora | null = null;

export const spinner = {
  start(text: string): void {
    _spinner = ora({ text, color: 'cyan' }).start();
  },
  succeed(text: string): void {
    _spinner?.succeed(chalk.green(text));
    _spinner = null;
  },
  fail(text: string): void {
    _spinner?.fail(chalk.red(text));
    _spinner = null;
  },
  stop(): void {
    _spinner?.stop();
    _spinner = null;
  },
};

// ─── Section Headers ──────────────────────────────────────────────────────────

export const log = {
  section(title: string): void {
    console.log('');
    console.log(chalk.bold.cyan(`  ▶  ${title}`));
  },

  created(label: string): void {
    console.log(chalk.green(`     + ${label}`));
  },

  skipped(label: string): void {
    console.log(chalk.yellow(`     = ${label} (already exists, skipped)`));
  },

  linked(label: string): void {
    console.log(chalk.blue(`     ↗ ${label}`));
  },

  error(label: string): void {
    console.log(chalk.red(`     ✗ ERROR: ${label}`));
  },

  info(label: string): void {
    console.log(chalk.gray(`     · ${label}`));
  },
};

// ─── Dividers ─────────────────────────────────────────────────────────────────

export function printDivider(): void {
  console.log(chalk.gray('  ' + '─'.repeat(77)));
}

export function printHeader(): void {
  console.log('');
  printDivider();
  console.log(chalk.bold.white('  🌱  moeb26 Database Seeder'));
  console.log(chalk.gray('       Industry-standard modular seeding system'));
  printDivider();
}

// ─── Summary Table ────────────────────────────────────────────────────────────

export type SeededUserRow = {
  index: number;
  role: string;
  name: string;
  email: string;
  note?: string;
}

export function printSummaryTable(rows: SeededUserRow[]): void {
  const PASSWORD = 'Password123!';
  const W = 79;

  console.log('');
  printDivider();
  console.log(chalk.bold.white('  SEEDED CREDENTIALS SUMMARY'));
  printDivider();
  console.log(chalk.gray(`  All passwords: `) + chalk.bold.yellow(PASSWORD));
  console.log('');

  // Header
  console.log(
    chalk.bold(
      `  ${pad('#', 3)}  ${pad('Role', 20)}  ${pad('Email', 36)}  Note`,
    ),
  );
  console.log(chalk.gray('  ' + '─'.repeat(74)));

  for (const row of rows) {
    const idx = chalk.gray(pad(String(row.index), 3));
    const role = chalk.cyan(pad(row.role, 20));
    const email = chalk.white(pad(row.email, 36));
    const note = row.note ? chalk.gray(row.note) : '';
    console.log(`  ${idx}  ${role}  ${email}  ${note}`);
  }

  printDivider();
  console.log('');
}

function pad(str: string, len: number): string {
  return str.length >= len ? str.slice(0, len) : str + ' '.repeat(len - str.length);
}
