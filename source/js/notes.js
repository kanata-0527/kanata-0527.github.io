// 目录开合独立于主题 Vue 组件，标题链接仍然可以直接跳转。
const toc = document.querySelector('[data-notes-toc]');
if (toc) {
  const branches = [];
  for (const item of toc.querySelectorAll('li')) {
    const children = Array.from(item.children).find(node => node.tagName === 'OL');
    const link = Array.from(item.children).find(node => node.tagName === 'A');
    if (!children || !link) continue;
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'toc-toggle';
    const setOpen = open => {
      children.hidden = !open;
      toggle.textContent = open ? '▾' : '▸';
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', (open ? '收起：' : '展开：') + link.textContent);
    };
    toggle.addEventListener('click', () => setOpen(children.hidden));
    item.prepend(toggle);
    setOpen(true);
    branches.push(setOpen);
  }
  document.querySelector('[data-toc-expand]')?.addEventListener('click', () => branches.forEach(set => set(true)));
  document.querySelector('[data-toc-collapse]')?.addEventListener('click', () => branches.forEach(set => set(false)));
  const panel = toc.closest('details');
  if (matchMedia('(max-width: 1179px)').matches) panel.open = false;
  const links = new Map(Array.from(toc.querySelectorAll('a')).map(link => [decodeURIComponent(link.hash.slice(1)), link]));
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      toc.querySelector('.is-active')?.classList.remove('is-active');
      links.get(entry.target.id)?.classList.add('is-active');
    }
  }, {rootMargin: '-80px 0px -65% 0px'});
  for (const id of links.keys()) {
    const heading = document.getElementById(id);
    if (heading) observer.observe(heading);
  }
}

const diagrams = Array.from(document.querySelectorAll('.article .content pre > code.language-mermaid'));
if (diagrams.length) {
  const resource = document.querySelector('script[data-mermaid-src]')?.dataset.mermaidSrc;
  if (resource) {
    try {
      const {default: mermaid} = await import(resource);
      mermaid.initialize({startOnLoad: false, securityLevel: 'strict', theme: 'neutral', fontFamily: 'system-ui, Microsoft YaHei, sans-serif'});
      const nodes = diagrams.map(code => {
        const node = document.createElement('div');
        node.className = 'mermaid';
        node.textContent = code.textContent;
        code.parentElement.replaceWith(node);
        return node;
      });
      await mermaid.run({nodes});
    } catch (error) {
      console.error('Mermaid rendering failed', error);
    }
  }
}
