#!/usr/bin/env node
/**
 * Run the full import from a Confluence export zip in the input folder.
 *
 * 1. Finds the .zip in ./input
 * 2. Unzips it with progress
 * 3. Runs the import script for each shelf (subdirectory) in the export
 * 4. For each shelf: runs the attachments upload (Confluence attachment files + embedded images are handled during import)
 * 5. Optionally removes the zip (disabled by default)
 *
 * Usage: node run-from-input.js [shelfName]
 *   If shelfName is omitted, imports every shelf found in the export.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const INPUT_DIR = path.join(__dirname, 'input');
const HTML_DIR = path.join(__dirname, 'html');

function log(prefix, msg) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [${prefix}] ${msg}`);
}

function findZip() {
  if (!fs.existsSync(INPUT_DIR)) {
    fs.mkdirSync(INPUT_DIR, { recursive: true });
    log('INPUT', 'Created input folder. Place your Confluence export .zip here and run again.');
    process.exit(1);
  }
  const files = fs.readdirSync(INPUT_DIR);
  const zips = files.filter((f) => f.toLowerCase().endsWith('.zip'));
  if (zips.length === 0) {
    log('INPUT', 'No .zip file found in input/. Place your Confluence export .zip there and run again.');
    process.exit(1);
  }
  if (zips.length > 1) {
    log('INPUT', `Multiple .zip files found: ${zips.join(', ')}. Leave only one and run again.`);
    process.exit(1);
  }
  return path.join(INPUT_DIR, zips[0]);
}

async function unzip(zipPath) {
  const unzipper = require('unzipper');
  log('UNZIP', `Extracting to ${HTML_DIR} ...`);
  if (!fs.existsSync(HTML_DIR)) fs.mkdirSync(HTML_DIR, { recursive: true });
  const directory = await unzipper.Open.file(zipPath);
  await directory.extract({ path: HTML_DIR });
  log('UNZIP', 'Extraction complete.');
  return HTML_DIR;
}

function getHtmlRoot(extractDir) {
  // The HTML root is the folder that contains shelf subdirs (each with .html files).
  // If the zip had one top-level dir (e.g. Confluence-space-export-093824.html), that's a wrapper:
  // use it as the root so shelves like CHAX are found inside it.
  const entries = fs.readdirSync(extractDir, { withFileTypes: true });
  const dirs = entries.filter((e) => e.isDirectory());
  const hasIndex = entries.some((e) => e.name === 'index.html');
  if (hasIndex && dirs.length >= 1) return extractDir;
  if (dirs.length === 1) return path.join(extractDir, dirs[0].name);
  return extractDir;
}

function getShelfSubdirs(htmlRoot) {
  const entries = fs.readdirSync(htmlRoot, { withFileTypes: true });
  const shelves = entries
    .filter((e) => e.isDirectory())
    .filter((d) => {
      const subPath = path.join(htmlRoot, d.name);
      try {
        const files = fs.readdirSync(subPath);
        return files.some((f) => f.toLowerCase().endsWith('.html'));
      } catch {
        return false;
      }
    })
    .map((d) => d.name);
  return shelves;
}

function runTsc() {
  return new Promise((resolve, reject) => {
    log('IMPORT', 'Building TypeScript...');
    const child = spawn('npx', ['tsc'], { cwd: __dirname, stdio: 'inherit', shell: true });
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`tsc exited with code ${code}`))));
    child.on('error', reject);
  });
}

function runImport(htmlRoot, shelfName) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, PATH_TO_HTML: htmlRoot };
    const args = ['./dist/import.js', '--', 'import', shelfName];
    log('IMPORT', `Starting import ${shelfName} (PATH_TO_HTML=${htmlRoot})`);
    const child = spawn('node', args, {
      env,
      cwd: __dirname,
      stdio: 'inherit',
      shell: true,
    });
    child.on('close', (code) => {
      if (code === 0) {
        log('IMPORT', `Shelf "${shelfName}" finished successfully.`);
        resolve();
      } else {
        reject(new Error(`Import exited with code ${code}`));
      }
    });
    child.on('error', reject);
  });
}

function runAttachments(htmlRoot, shelfName) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, PATH_TO_HTML: htmlRoot };
    const args = ['./dist/import.js', '--', 'attachments', shelfName];
    log('ATTACHMENTS', `Uploading attachments and images for ${shelfName}`);
    const child = spawn('node', args, {
      env,
      cwd: __dirname,
      stdio: 'inherit',
      shell: true,
    });
    child.on('close', (code) => {
      if (code === 0) {
        log('ATTACHMENTS', `Attachments for "${shelfName}" finished.`);
        resolve();
      } else {
        reject(new Error(`Attachments exited with code ${code}`));
      }
    });
    child.on('error', reject);
  });
}

function removeZip(zipPath) {
  try {
    fs.unlinkSync(zipPath);
    log('CLEANUP', `Removed ${path.basename(zipPath)}`);
  } catch (e) {
    log('CLEANUP', `Warning: could not remove zip: ${e.message}`);
  }
}

async function main() {
  const singleShelf = process.argv[2];
  log('RUN', '--- Run from input ---');

  const zipPath = findZip();
  log('INPUT', `Using zip: ${path.basename(zipPath)}`);

  const extractDir = await unzip(zipPath);
  const htmlRoot = getHtmlRoot(extractDir);
  log('PATHS', `HTML root: ${htmlRoot}`);

  const shelves = getShelfSubdirs(htmlRoot);
  if (shelves.length === 0) {
    log('IMPORT', 'No shelf subdirectories (with .html files) found in export. Nothing to import.');
    // removeZip(zipPath);  // disabled: keep zip for now
    return;
  }
  log('IMPORT', `Found shelves: ${shelves.join(', ')}`);

  const toImport = singleShelf
    ? shelves.includes(singleShelf)
      ? [singleShelf]
      : (log('IMPORT', `Shelf "${singleShelf}" not found. Importing all.`), shelves)
    : shelves;

  await runTsc();
  for (const shelf of toImport) {
    await runImport(htmlRoot, shelf);
    await runAttachments(htmlRoot, shelf);
  }

  // removeZip(zipPath);  // disabled: keep zip for now
  log('RUN', '--- Done ---');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
