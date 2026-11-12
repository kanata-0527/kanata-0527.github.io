import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const force = args.includes('--force');
const toPublished = args.includes('--published');
const positional = args.filter(arg => !['--force', '--published'].includes(arg));
if (positional.length > 1 || positional.some(arg => arg.startsWith('--'))) {
  throw new Error('用法：node tools/import-notes.mjs [原 notes.md 路径] [--published] [--force]');
}
const source = positional[0] ? path.resolve(positional[0]) : path.resolve(root, '../../../notes.md');
const draft = path.join(root, 'source/_drafts/cse-notes.md');
const published = path.join(root, 'source/_posts/cse-notes.md');
const destination = toPublished ? published : draft;
const exists = async p => fs.access(p).then(() => true, () => false);
if (!toPublished && await exists(published)) throw new Error('已有正式 CSE 文章；更新其派生副本请显式使用 --published --force。');
if (toPublished && await exists(draft)) throw new Error('请先用 npm run publish:cse 将现有草稿转为正式文章，再使用 --published --force 更新。');
if (await exists(destination) && !force) throw new Error('CSE 网页副本已存在；若确认重新生成派生副本，请加 --force。原笔记不会被修改。');

let body = await fs.readFile(source, 'utf8');
body = body.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
body = body.replace(/^---\n[\s\S]*?\n---\s*\n/, '');
body = body.replace(/^#\s+notes\s*\n/i, '');
body = body.replace(/^\[TOC\]\s*$/gmi, '');
body = body.replace(/<div\s+style=["'][^"']*page-break-after[^"']*["']\s*>\s*<\/div>/gi, '');

const assets = [];
const unresolved = [];
const allowed = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg']);
const sourceDirectory = path.dirname(source);
let fenced = false;
const lines = [];
for (const line of body.split('\n')) {
  if (/^\s*(`{3,}|~{3,})/.test(line)) fenced = !fenced;
  if (fenced) { lines.push(line); continue; }
  const matches = [...line.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)];
  let converted = line;
  for (const match of matches) {
    const target = match[2].trim().replace(/^<|>$/g, '');
    if (/^(?:https?:|data:|\/\/|#)/i.test(target)) continue;
    const assetPath = path.resolve(sourceDirectory, decodeURIComponent(target));
    const within = path.relative(sourceDirectory, assetPath);
    if (path.isAbsolute(target) || within === '..' || within.startsWith(`..${path.sep}`) || path.isAbsolute(within) || !allowed.has(path.extname(assetPath).toLowerCase()) || !(await exists(assetPath))) {
      unresolved.push({target, reason: '图片需位于原笔记目录内且文件存在'});
      continue;
    }
    const bytes = await fs.readFile(assetPath);
    const name = crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 12) + path.extname(assetPath).toLowerCase();
    const output = path.join(root, 'source/assets/cse-notes', name);
    await fs.mkdir(path.dirname(output), {recursive: true});
    await fs.writeFile(output, bytes);
    // notes/:title/ 是两层路径；相对资源路径同时兼容主页站点和 /repo/ 项目站点。
    converted = converted.replace(match[0], `![${match[1]}](../../assets/cse-notes/${name})`);
    assets.push({original: target, exported: `assets/cse-notes/${name}`});
  }
  lines.push(converted);
}
const frontmatter = `---\ntitle: CSE 课程笔记\ndate: 2026-11-12 12:00:00\nslug: cse-notes\npinned: 1\ncategories:\n  - 本科课程\n  - CSE\ntags:\n  - 课程笔记\n  - 计算机系统工程\nmath: true\nmermaid: true\ndescription: 从本地文件系统、RPC 和分布式文件系统，到一致性、事务、共识与网络。\n---\n\n`;
await fs.mkdir(path.dirname(destination), {recursive: true});
await fs.writeFile(destination, frontmatter + lines.join('\n').trim() + '\n', 'utf8');
await fs.mkdir(path.join(root, '.local'), {recursive: true});
await fs.writeFile(path.join(root, '.local/import-report.json'), JSON.stringify({source, destination, assets, unresolved}, null, 2));
console.log(`已生成本地${toPublished ? '文章副本' : '草稿'}：${path.relative(root, destination)}\n复制图片：${assets.length}\n待处理图片：${unresolved.length}\n原 notes.md 保持不变。`);
if (unresolved.length) process.exitCode = 2;
