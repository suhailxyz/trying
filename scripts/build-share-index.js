#!/usr/bin/env node
/**
 * Regenerate annex/sections/share/share.json from assets/files/share/
 * Run from repo root: node scripts/build-share-index.js
 * See _site-tools/update-share-index.md for the spec.
 */

const fs = require('fs');
const path = require('path');

// Use cwd as repo root so we always read/write the repo you ran the command from
const REPO_ROOT = process.cwd();
const SHARE_ROOT = path.join(REPO_ROOT, 'assets', 'files', 'share');
const OUT_FILE = path.join(REPO_ROOT, 'annex', 'sections', 'share', 'share.json');
const TIMESTAMP_OFFSET_CONFIG = path.join(REPO_ROOT, 'annex', 'sections', 'share', 'timestamp-offset.json');
const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp']);

function isImage(name) {
  const ext = path.extname(name).toLowerCase();
  return IMAGE_EXTS.has(ext);
}

function isHidden(name) {
  return name.startsWith('.');
}

function readShareFolderJson(dirPath) {
  const filePath = path.join(dirPath, '.share-folder.json');
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw);
    return {
      protected: data.protected === true,
      password: typeof data.password === 'string' ? data.password : undefined
    };
  } catch (_) {
    return null;
  }
}

function buildFolder(dirPath, relativePath, mtimeOffsetMs) {
  const name = path.basename(dirPath);
  const children = [];
  let folderMeta = null;

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const ent of entries) {
    if (isHidden(ent.name)) {
      if (ent.name === '.share-folder.json' && ent.isFile()) {
        folderMeta = readShareFolderJson(dirPath);
      }
      continue;
    }
    const fullPath = path.join(dirPath, ent.name);
    const relPath = relativePath ? relativePath + path.sep + ent.name : ent.name;
    const relPathForward = relPath.split(path.sep).join('/');
    if (ent.isDirectory()) {
      children.push(buildFolder(fullPath, relPath, mtimeOffsetMs));
    } else if (ent.isFile() && isImage(ent.name)) {
      const stat = fs.statSync(fullPath);
      const imageEntry = {
        name: ent.name,
        type: 'image',
        path: '../assets/files/share/' + relPathForward
      };
      if (typeof stat.size === 'number') imageEntry.size = stat.size;
      if (stat.mtime) {
        const ms = stat.mtime.getTime() + (mtimeOffsetMs || 0);
        imageEntry.mtime = new Date(ms).toISOString();
      }
      children.push(imageEntry);
    }
  }

  const folder = {
    name,
    type: 'folder',
    children
  };
  if (folderMeta && folderMeta.protected && folderMeta.password) {
    folder.protected = true;
    folder.password = folderMeta.password;
  }
  return folder;
}

function loadTimestampOffset() {
  try {
    if (!fs.existsSync(TIMESTAMP_OFFSET_CONFIG)) return null;
    const raw = fs.readFileSync(TIMESTAMP_OFFSET_CONFIG, 'utf8');
    const config = JSON.parse(raw);
    const refPath = config.referencePath;
    const correctMtime = config.correctMtime;
    if (typeof refPath !== 'string' || typeof correctMtime !== 'string') return null;
    const absolutePath = path.join(SHARE_ROOT, refPath);
    if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
      console.warn('timestamp-offset: reference file not found:', refPath);
      return null;
    }
    const stat = fs.statSync(absolutePath);
    const offsetMs = new Date(correctMtime).getTime() - stat.mtime.getTime();
    console.log('Applying timestamp offset from', refPath, '(' + offsetMs + ' ms)');
    return offsetMs;
  } catch (e) {
    console.warn('timestamp-offset config ignored:', e.message);
    return null;
  }
}

function main() {
  if (!fs.existsSync(SHARE_ROOT) || !fs.statSync(SHARE_ROOT).isDirectory()) {
    console.error('Share root not found:', SHARE_ROOT);
    process.exit(1);
  }
  const mtimeOffsetMs = loadTimestampOffset();
  const rootEntries = fs.readdirSync(SHARE_ROOT, { withFileTypes: true });
  const rootFolders = rootEntries
    .filter(ent => ent.isDirectory() && !isHidden(ent.name))
    .map(ent => buildFolder(path.join(SHARE_ROOT, ent.name), ent.name, mtimeOffsetMs));
  const json = JSON.stringify(rootFolders, null, 2);
  if (process.argv[2] === '--stdout') {
    process.stdout.write(json);
  } else {
    fs.writeFileSync(OUT_FILE, json, 'utf8');
    console.log('Wrote', OUT_FILE);
  }
}

main();
