# kanata 的小窝 · ParticleX

已配置 Hexo 7.3.0 + ParticleX 2.8.1。这里是网站的活动项目，原来的 `hexo-fluid-starter` 保留作比较。

网站地址：https://kanata-0527.github.io/ 。源仓库：https://github.com/kanata-0527/kanata-0527.github.io 。线上状态和构建记录以仓库 Actions 页面为准。

## 先打开预览

在 VS Code 中打开本目录，并在终端运行：

```powershell
npm run preview
```

打开 http://127.0.0.1:4000/ 。保持终端运行；停止预览按 Ctrl+C。首次从 ZIP 解压或在新电脑克隆项目时，先安装 Node.js 24，再运行一次：

```powershell
npm ci --ignore-scripts
```

本机项目依赖已安装。需要连同本地排版样例草稿一起查看时，改用 `npm run preview:drafts`。端口占用可加 `-- --port 4001`。

## 你最常改的地方

| 内容 | 文件或配置项 |
| --- | --- |
| 站名、昵称、简介、正式网址 | `_config.yml` 的 title、author、subtitle、description、url |
| 背景图、头像、加载图、菜单 | `_config.particlex.yml` |
| 主色、点缀色、文字颜色、背景色 | `source/css/particlex-notes.css` 开头的 CSS 变量 |
| 正式文章 | `source/_posts/` |
| 关于我 | `source/about/index.md` |
| 课程入口 | `source/courses/index.md` |

目前站名为“kanata 的小窝”，使用你明确提供的 GitHub 账号；计划网址为 https://kanata-0527.github.io 。这些都可自行修改。

## 怎样替换全部图片

首页背景使用你提供的 JPG 原图；头像和加载图仍是本项目的 SVG 占位图。网页仅通过 CSS 调整背景显示范围，原图文件未裁剪、未重绘。

| 图片 | 当前文件 | 配置项 |
| --- | --- | --- |
| 首页背景 | `source/images/background.jpg` | background |
| 个人头像 | `source/images/avatar.svg` | avatar |
| 加载图片 | `source/images/loading.svg` | loading |

例如，把你选好的图保存为 `source/images/my-background.webp`、`my-avatar.png` 和 `my-loading.gif`，然后编辑 `_config.particlex.yml`：

```yaml
avatar: /images/my-avatar.png
background:
  - /images/my-background.webp
loading: /images/my-loading.gif
```

背景可以列多张，每次打开首页随机选择一张。路径写 `/images/文件名`，不包含 `source`；文件名大小写要一致。修改配置后重新启动预览。

当前背景原图上下有白边，已在 source/css/particlex-notes.css 中调整显示范围。桌面标题靠右，手机标题在下方，以保留人物面部。以后换成其他构图时，可调整该文件中 `#home-background` 的 background-size 和 background-position。

建议背景用横向大图、头像用方图。背景会按屏幕裁切，重要人物尽量留在画面中部。浏览器标签图标默认跟随头像；如需分开，可修改主题的 `layout/layout.ejs` 中 icon 的引用。

## 课程笔记和阅读功能

CSE 笔记已从当前原始 `notes.md` 生成到 `source/_posts/cse-notes.md`，属于正式构建内容。它收录完整笔记，包含 Raft 与网络，未重新划定期中范围，也未改写知识内容。原始 notes.md 保持不变。

- 桌面右侧目录默认展开；箭头控制每个子目录，按钮可全部展开、收起。
- 手机目录默认收起，点击“本页目录”打开。
- 标题链接负责跳转；文章内链接和图片保留。
- 公式在构建时用 KaTeX 排版；Mermaid 用本地模块渲染。
- 代码支持高亮与复制；归档页面提供文章标题搜索。
- 正文折叠使用普通 HTML `<details><summary>标题</summary>内容</details>`，不再使用 Fluid 的 fold 标签。

目录开关在 `_config.particlex.yml` 的 `notes` 下。排版样例在 `source/_drafts/reading-demo.md`，普通构建不发布这篇样例。

继续以原笔记为内容源时，在本目录运行：

```powershell
npm run import:cse -- --published --force
```

默认读取本项目上三级目录的 notes.md；换了项目位置时显式指定路径：

```powershell
node tools/import-notes.mjs "D:\AAAStudying\coding\cse\notes.md" --published --force
```

此操作重新生成网页副本，因此课程正文请继续修改原 notes.md。图片会复制到 `source/assets/cse-notes/`。关于、首页、课程入口等独立页面可以直接编辑。源码导入工具放在 tools/；scripts/ 仅存放 Hexo 构建钩子。

## 自己调整颜色

修改 `source/css/particlex-notes.css` 最开头：

```css
:root {
  --note-accent: #6f9484;
  --note-pink: #bb8c89;
  --note-text: #435b54;
  --note-bg: #f7faf7;
}
```

它们控制本项目补充的阅读样式。ParticleX 原版仍有少量固定颜色和渐变，进一步调整请搜索 `themes/particlex/source/css/main.css` 中的颜色值。`_config.particlex.yml` 的 colors 仅用于标签、分类色彩。

## 发布到 GitHub Pages

本项目使用公开仓库 `kanata-0527.github.io`。在 GitHub Free 下，公开仓库可以免费部署，域名与主机都不需要另买。仓库保存这个项目的源码；`node_modules/`、`public/` 和本地缓存已由 .gitignore 排除。

从零建立空仓库时执行以下初始化命令；已有仓库或克隆下来的项目跳过这一步：

```powershell
git init -b main
git add .
git commit -m "Initialize ParticleX study blog"
git remote add origin https://github.com/kanata-0527/kanata-0527.github.io.git
git push -u origin main
```

仓库 Settings → Pages → Build and deployment → Source 选择 GitHub Actions。工作流已包含在 `.github/workflows/pages.yml` 中：推送 main 后安装锁定依赖、构建并发布。若首次推送早于 Pages 设置完成，在 Actions 中手动运行一次。

只要 build 与 deploy 都成功，网站即会发布到 https://kanata-0527.github.io/ 。

日常更新：修改图片、配置或文章后，在本项目目录执行：

```powershell
npm run build
git add .
git commit -m "Update blog"
git push
```

推送 main 后 GitHub Actions 会自动更新网站，无需手工上传生成的 HTML。

更换账号、站名或项目仓库时可以运行：

```powershell
npm run configure -- --user kanata-0527 --title "kanata 的小窝" --author kanata-0527
```

项目站点可额外加 `--repo study-notes`，工具会同步调整 url 和 root。部署前运行 `npm run build`，检查 public 中的首页和文章即可；此命令不执行网络发布。

## 来源与维护

ParticleX 固定在提交 `dcf8671f9a2aad0f2b43b9526ff6cb6391a38d82`，源码直接随项目保存，GitHub Actions 不需要递归拉取子模块。MIT 许可保存在 `themes/particlex/LICENSE`，本地改动说明在 `themes/particlex/UPSTREAM.md`；页脚保留 Hexo 和 ParticleX 署名。

浏览器所需的 Vue、图标、KaTeX、代码高亮和 Mermaid 从 package-lock.json 锁定的 npm 包构建进 vendor/。scripts/vendor-assets.js 同时复制所需许可证，正常阅读不依赖这些库的外部 CDN。

参考：[ParticleX 上游](https://github.com/theme-particlex/hexo-theme-particlex)、[Hexo 配置](https://hexo.io/docs/configuration)、[GitHub Pages 工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。
