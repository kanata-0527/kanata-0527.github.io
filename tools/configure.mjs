import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const options = {};
for (let i = 0; i < args.length; i += 2) {
  if (!['--user', '--repo', '--title', '--author'].includes(args[i]) || !args[i + 1]) {
    throw new Error('用法：npm run configure -- --user YOUR_USERNAME [--repo REPOSITORY] [--title "站点名"] [--author "昵称"]');
  }
  options[args[i].slice(2)] = args[i + 1];
}
if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(options.user || '')) {
  throw new Error('请用 --user 指定有效的 GitHub 用户名。');
}
const repository = options.repo || `${options.user.toLowerCase()}.github.io`;
if (!/^[a-zA-Z0-9_.-]+$/.test(repository) || ['.', '..'].includes(repository)) {
  throw new Error('--repo 必须是仓库名称，不能包含路径或网址。');
}
const mainPath = path.join(root, '_config.yml');
const themePath = path.join(root, '_config.particlex.yml');
const main = yaml.load(await fs.readFile(mainPath, 'utf8'));
const theme = yaml.load(await fs.readFile(themePath, 'utf8'));
main.root = repository.toLowerCase() === `${options.user}.github.io`.toLowerCase() ? '/' : `/${repository}/`;
main.url = `https://${options.user.toLowerCase()}.github.io${main.root === '/' ? '' : main.root.slice(0, -1)}`;
if (options.title) main.title = options.title;
if (options.author) main.author = options.author;
theme.card.iconLinks = {GitHub: {name: 'github', theme: 'brands', link: `https://github.com/${options.user}`}};
await fs.writeFile(mainPath, yaml.dump(main, {lineWidth: -1, noRefs: true}), 'utf8');
await fs.writeFile(themePath, yaml.dump(theme, {lineWidth: -1, noRefs: true}), 'utf8');
console.log(`已配置：${main.title}\n网站地址：${main.url}\n仓库：${options.user}/${repository}`);
