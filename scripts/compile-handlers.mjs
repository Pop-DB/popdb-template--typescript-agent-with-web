import { build } from 'esbuild';
import { readFile, writeFile } from 'fs/promises';
import { pathToFileURL } from 'url';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

const projectDir = process.cwd();

const esbuildOptions = {
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  packages: 'external',
};

async function compileFile(inputPath, outputPath) {
  await build({
    ...esbuildOptions,
    entryPoints: [inputPath],
    outfile: outputPath,
  });
}

async function main() {
  const configTs = join(projectDir, 'popdb.config.ts');
  const configJs = join(projectDir, 'popdb.config.js');
  const compiledConfigPath = join(projectDir, 'popdb.config.compiled.mjs');

  let configPath;
  try {
    await readFile(configTs);
    configPath = configTs;
  } catch {
    try {
      await readFile(configJs);
      console.log('popdb.config.js found — no compilation needed for config');
      configPath = configJs;
    } catch {
      console.error('Error: No popdb.config.ts or popdb.config.js found');
      process.exit(1);
    }
  }

  if (configPath === configTs) {
    await compileFile(configTs, compiledConfigPath);
    console.log('✓ popdb.config.ts → popdb.config.compiled.mjs');
  }

  let config;
  if (configPath === configTs) {
    const tmpPath = join(tmpdir(), `popdb-config-${randomUUID()}.mjs`);
    const compiledSource = await readFile(compiledConfigPath, 'utf-8');
    await writeFile(tmpPath, compiledSource);
    try {
      const mod = await import(pathToFileURL(tmpPath).href);
      config = mod.default || mod;
    } finally {
      await import('fs/promises').then(f => f.unlink(tmpPath)).catch(() => {});
    }
  } else {
    const mod = await import(pathToFileURL(configPath).href);
    config = mod.default || mod;
  }

  const handlerEntries = config.handlers ?? config.tasks;
  if (!handlerEntries || Object.keys(handlerEntries).length === 0) {
    console.log('No handlers found in config');
    return;
  }

  const entries = Object.entries(handlerEntries);
  const tsHandlers = entries.filter(([, h]) => h.file.endsWith('.ts'));

  if (tsHandlers.length === 0) {
    console.log('No TypeScript handlers to compile');
    return;
  }

  await Promise.all(
    tsHandlers.map(async ([name, h]) => {
      const inputPath = join(projectDir, h.file);
      const outputPath = inputPath.replace(/\.ts$/, '.compiled.mjs');
      await compileFile(inputPath, outputPath);
      console.log(`✓ ${h.file} → ${h.file.replace(/\.ts$/, '.compiled.mjs')}`);
    })
  );

  console.log(`\nCompiled ${tsHandlers.length} handler(s) successfully`);
}

main().catch((err) => {
  console.error('Compilation failed:', err.message || err);
  process.exit(1);
});
