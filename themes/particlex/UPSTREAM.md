# ParticleX 来源与本地适配

- 上游：https://github.com/theme-particlex/hexo-theme-particlex
- 版本：2.8.1
- 固定提交：dcf8671f9a2aad0f2b43b9526ff6cb6391a38d82
- 原作者及 MIT 许可：见同目录 LICENSE。

本项目保留上游页面结构及样式，增加以下阅读适配：

- 文章目录与手动展开、收起；样式、行为分别放在项目 source/css/particlex-notes.css 和 source/js/notes.js。
- 浏览器依赖从锁定的 npm 包生成到 vendor/，替换外部 CDN；许可证同时输出。
- KaTeX 使用构建时渲染，Mermaid 使用本地模块渲染。
- 代码高亮识别 Markdown 语言类，跳过 Mermaid，避免把未转义代码作为 HTML 插入。
- 调整移动端 viewport、加载提示及无 JavaScript 时的回退。
- 将上游默认菜单清空，由项目配置提供中文菜单，避免 Hexo 合并出两套导航。
- 入场效果使用轻微竖向位移，避免原版整体缩放造成短暂的横向滚动。

升级主题时请保留以上适配。source/images/background.jpg 使用用户提供的原图，显示裁切通过 CSS 实现；头像和加载图为本项目的 SVG 占位图。首页标题位置与配色已适配这张插画。
