# AI4S Evaluation Atlas

[公开访问 / Public site](https://sci-ultron.github.io/ai4s-evaluation-atlas/)

按科学领域、能力、科研流程、模态、访问条件和证据类型浏览评测基准。本站仅展示元数据和官方入口；不托管受限数据，不发布私有评测仓库。来源许可证和数据访问边界以各条目说明为准，收录不等于已提供可运行实现。

## 维护

页面是无依赖的 HTML/CSS/JavaScript。`catalog.json` 必须由维护仓库的 `scripts/build_ai4s_catalog.py` 生成，不可直接复制 `science_registry.json`；网站目录还需要 facets、suites 和逐条 organizations。

在有权限的维护仓库中重新生成并校验，再将网站目录复制到本仓库。发布前运行：

```sh
node --check app.js
node scripts/check-site.mjs
```

推送到 main 后，GitHub Actions 在校验通过后才发布 GitHub Pages，只部署六个静态文件。页面路径使用相对链接，兼容 GitHub 项目站点子路径。

目录更新日期代表导出时间，不保证所有上游链接在当日都经过在线复核。分类为可解释的规则派生，非逐条人工认证；公司模型被外部评测不等于公司内部采用。
