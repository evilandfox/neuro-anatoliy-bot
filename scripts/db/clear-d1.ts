import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import path from 'node:path';
import JSON5 from 'json5';

type WranglerD1Config = {
  d1_databases?: Array<{ database_name?: string; database_id?: string; binding?: string }>;
};

type ExecResult = {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
};

function getArgValue(args: string[], name: string): string | undefined {
  const idx = args.indexOf(name);
  if (idx === -1) return undefined;
  return args[idx + 1];
}

function hasFlag(args: string[], name: string): boolean {
  return args.includes(name);
}

function escapeSqlIdentifier(name: string): string {
  // SQLite identifier escaping: wrap in double-quotes, double any internal quotes
  return `"${name.replaceAll('"', '""')}"`;
}

async function execWrangler(args: string[]): Promise<ExecResult> {
  return new Promise((resolve) => {
    const wranglerPath = path.join(process.cwd(), 'node_modules', 'wrangler', 'bin', 'wrangler.js');

    const child = spawn(process.execPath, [wranglerPath, ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (d) => {
      stdout += d.toString();
    });

    child.stderr.on('data', (d) => {
      stderr += d.toString();
    });

    child.on('close', (exitCode) => {
      resolve({
        success: exitCode === 0,
        stdout,
        stderr,
        exitCode: exitCode ?? -1,
      });
    });
  });
}

async function resolveD1DatabaseName(explicit?: string): Promise<string> {
  if (explicit) return explicit;

  const raw = await readFile('wrangler.jsonc', 'utf8');
  const parsed = JSON5.parse(raw) as WranglerD1Config;

  const first = parsed.d1_databases?.[0];
  const name = first?.database_name;

  if (!name) {
    throw new Error(
      'Не смог определить имя D1 базы из wrangler.jsonc (поле d1_databases[0].database_name). Укажи явно через --db <name>.'
    );
  }

  return name;
}

async function confirmOrThrow(force: boolean): Promise<void> {
  if (force) return;

  const rl = readline.createInterface({ input, output });
  try {
    const answer = await rl.question(
      'ВНИМАНИЕ: это удалит ВСЕ данные из ВСЕХ таблиц D1.\nНапечатай YES чтобы продолжить: '
    );
    if (answer.trim() !== 'YES') {
      throw new Error('Отменено пользователем.');
    }
  } finally {
    rl.close();
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  const dbArg = getArgValue(args, '--db');
  const force = hasFlag(args, '--force');
  const useLocal = hasFlag(args, '--local');

  const dbName = await resolveD1DatabaseName(dbArg);

  await confirmOrThrow(force);

  const locationArgs = useLocal ? ['--local'] : ['--remote'];

  const listSql =
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;";

  const listRes = await execWrangler([
    'd1',
    'execute',
    dbName,
    ...locationArgs,
    '--command',
    listSql,
    '--json',
  ]);

  if (!listRes.success) {
    throw new Error(`wrangler d1 execute (list tables) failed (exit ${listRes.exitCode})\n${listRes.stderr}`);
  }

  let parsed: any;
  try {
    parsed = JSON.parse(listRes.stdout);
  } catch {
    throw new Error(`Не смог распарсить JSON от wrangler. Output:\n${listRes.stdout}`);
  }

  const results = Array.isArray(parsed) ? parsed : [parsed];
  const tableNames: string[] = [];

  for (const item of results) {
    const directRows = item?.results;
    const legacyRows = item?.results?.[0]?.results;
    const rows = Array.isArray(directRows) ? directRows : legacyRows;

    if (!Array.isArray(rows)) continue;

    for (const row of rows) {
      const name = row?.name;
      if (typeof name === 'string' && name.trim()) tableNames.push(name);
    }
  }

  if (tableNames.length === 0) {
    console.log('Таблицы не найдены (или база пустая). Нечего очищать.');
    return;
  }

  const tablesToClear = tableNames.filter((t) => t !== '_cf_KV');

  if (tablesToClear.length === 0) {
    console.log('Найдены только системные/защищённые таблицы. Нечего очищать.');
    return;
  }

  const pragmaRes = await execWrangler([
    'd1',
    'execute',
    dbName,
    ...locationArgs,
    '--command',
    'PRAGMA foreign_keys=OFF;',
  ]);

  if (!pragmaRes.success) {
    throw new Error(`wrangler d1 execute (pragma foreign_keys=OFF) failed (exit ${pragmaRes.exitCode})\n${pragmaRes.stderr}`);
  }

  const cleared: string[] = [];
  const skipped: Array<{ table: string; error: string }> = [];

  for (const t of tablesToClear) {
    const sql = `DELETE FROM ${escapeSqlIdentifier(t)};`;
    const res = await execWrangler(['d1', 'execute', dbName, ...locationArgs, '--command', sql]);

    if (res.success) {
      cleared.push(t);
      continue;
    }

    skipped.push({ table: t, error: res.stderr.trim() || `exit ${res.exitCode}` });
  }

  console.log(`Очищено таблиц: ${cleared.length}`);
  for (const t of cleared) console.log(`- ${t}`);

  if (skipped.length > 0) {
    console.log(`Пропущено таблиц (ошибки/права): ${skipped.length}`);
    for (const s of skipped) console.log(`- ${s.table}: ${s.error}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
