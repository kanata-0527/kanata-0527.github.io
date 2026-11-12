// 将固定依赖中的浏览器资源打包进静态站点，预览和阅读不依赖外部 CDN。
const fs = require('node:fs');
const path = require('node:path');

hexo.extend.generator.register('local-vendor-assets', function () {
  const assets = [];
  const modules = path.join(hexo.base_dir, 'node_modules');
  function add(source, destination) {
    assets.push({path: destination, data: fs.readFileSync(path.join(modules, source))});
  }
  function tree(source, destination, accept) {
    for (const entry of fs.readdirSync(path.join(modules, source), {withFileTypes: true})) {
      const from = source + '/' + entry.name;
      const to = destination + '/' + entry.name;
      if (entry.isDirectory()) tree(from, to, accept);
      else if (accept(entry.name)) add(from, to);
    }
  }
  add('vue/dist/vue.global.prod.js', 'vendor/vue.js');
  add('@highlightjs/cdn-assets/highlight.min.js', 'vendor/highlight.js');
  add('@highlightjs/cdn-assets/styles/github.min.css', 'vendor/highlight-github.css');
  add('@fortawesome/fontawesome-free/css/all.min.css', 'vendor/fontawesome/css/all.min.css');
  tree('@fortawesome/fontawesome-free/webfonts', 'vendor/fontawesome/webfonts', name => name.endsWith('.woff2'));
  add('katex/dist/katex.min.css', 'vendor/katex/katex.min.css');
  tree('katex/dist/fonts', 'vendor/katex/fonts', name => /\.(woff2?|ttf)$/.test(name));
  add('mermaid/dist/mermaid.esm.min.mjs', 'vendor/mermaid/mermaid.esm.min.mjs');
  tree('mermaid/dist/chunks/mermaid.esm.min', 'vendor/mermaid/chunks/mermaid.esm.min', name => /\.(mjs|wasm)$/.test(name));
  // 资源和许可证一并保留。
  for (const [source, destination] of [
    ['vue/LICENSE', 'vendor/licenses/vue.txt'],
    ['mermaid/LICENSE', 'vendor/licenses/mermaid.txt'],
    ['katex/LICENSE', 'vendor/licenses/katex.txt'],
    ['@highlightjs/cdn-assets/LICENSE', 'vendor/licenses/highlight.txt'],
    ['@fortawesome/fontawesome-free/LICENSE.txt', 'vendor/licenses/fontawesome.txt'],
  ]) add(source, destination);
  return assets;
});
