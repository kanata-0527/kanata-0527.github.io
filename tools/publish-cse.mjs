import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const draft = path.join(root, 'source/_drafts/cse-notes.md');
const post = path.join(root, 'source/_posts/cse-notes.md');
const exists = file => fs.access(file).then(() => true, () => false);
if (await exists(post)) throw new Error('已有正式文章。更新请使用 npm run import:cse -- --published --force。');
if (!(await exists(draft))) throw new Error('没有 CSE 草稿。请先使用 npm run import:cse。');
await fs.mkdir(path.dirname(post), {recursive: true});
await fs.rename(draft, post);
console.log('已将 CSE 草稿移入正式文章目录，正文和元数据保持原样；这不会执行网络发布。');
