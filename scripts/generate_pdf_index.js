#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const pdfDir = path.join(root, 'pdf');
const outPath = path.join(pdfDir, 'data.json');

const slugToCategory = {
  'shizekan': '自然観察'
};

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of list) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      results = results.concat(walk(full));
    } else if (ent.isFile() && /\.pdf$/i.test(ent.name)) {
      const rel = path.relative(root, full).replace(/\\/g, '/');
      const stat = fs.statSync(full);
      const parts = rel.split('/');
      const parent = parts.length >= 2 ? parts[parts.length - 2] : '';
      const category = slugToCategory[parent] || parent;
      const title = ent.name.replace(/\.pdf$/i, '');
      results.push({
        filename: ent.name,
        path: rel,
        title,
        category,
        size: stat.size,
        mtime: stat.mtime.toISOString()
      });
    }
  }
  return results;
}

try {
  const papers = walk(pdfDir);
  const out = { papers };
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
  console.log('Wrote', outPath);
} catch (err) {
  console.error('Error generating index:', err);
  process.exit(1);
}
