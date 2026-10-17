# dsh-latexcp

DeepSeek Harness（DSH）Web 界面复制插件：悬停 KaTeX 公式浮现复制按钮，把公式的 TeX 源码按选定格式复制到剪贴板；悬停 Markdown 表格则把整张表回写成 GFM 表格文本。本上下文记录该插件的领域语言。

## 公式与定界符

**公式类型**:
公式的行内/行间之分。行内公式随文字排布，行间公式独占一行居中。KaTeX 渲染后，行间公式的外层元素带 `.katex-display` class，是插件识别公式类型的唯一依据。
_Avoid_: 块级、display、inline 混用

**定界符映射**:
按用户选定格式（美元符号 / 斜杠括号）与公式类型组合出的包裹方式：美元×行内 `$…$`、美元×行间 `$$…$$`、斜杠×行内 `\(…\)`、斜杠×行间 `\[…\]`。
_Avoid_: 包裹、wrapping 之外的叫法

**默认格式**:
格式菜单当前选中项（✓ 标记），主按钮按它输出；只存在浏览器内存（插件运行期），不持久化。
_Avoid_: 配置、设置（易与 profile 配置混淆）

## 与 DSH 渲染 DOM 的边界

**annotation 节点（源码保留处）**:
KaTeX 输出 MathML 子树时把原始 TeX 源码写入 `<annotation encoding="application/x-tex">`，位于隐藏的 `.katex-mathml` 内；DSH 的 Markdown 渲染完整保留了它。插件从中取源码，不解析、不渲染公式。
_Avoid_: 源码节点、TeX 节点

**katex 元素**:
KaTeX 渲染的公式根元素（`.katex`）；插件用事件委托（`mouseover`/`mouseout` 冒泡到 `document`）识别悬停目标，不往 React 管理的公式子树里插 DOM。
_Avoid_: 公式节点（易与 annotation 节点混淆）

**复制按钮（copy popover）**:
悬停公式或 Markdown 表格时浮现的固定定位控件；公式形态是 `LaTeX` 主按钮 + `▾` 格式箭头 + 下拉菜单，表格形态是单个 DSH 官方复制图标按钮（`IconCopyOutlineRegular`，16×16，无文字、无格式箭头）。挂在 `document.body` 下（React 渲染树之外），位置每帧按目标当前矩形重算（滚动、流式渲染时不滞后），目标滚出视口即隐藏；鼠标移出后延迟 250ms 隐藏（宽限期，保证鼠标能移上按钮）。触屏上点目标浮现、`Esc` 或点空白收起；键盘上聚焦宽表滚动容器浮现，`Enter`/`Space` 复制。
_Avoid_: 悬浮按钮之外的名字

## 表格复制

**Markdown 表格**:
DSH Markdown 渲染器产出的 `<table>`（必带 `<thead>` 表头行与 `<th>`）。插件以此区分对话里的 Markdown 表格与文档预览、Excel 预览等其他 `<table>`；不依赖 CSS module 的哈希 class。
_Avoid_: 数据表、table 混用

**GFM 回写**:
把表格 DOM 还原成 GitHub Flavored Markdown 文本：表头行 + 分隔行（列对齐写成 `:---` / `:---:` / `---:`，未声明对齐用 `---`）+ 各数据行；单元格内联节点按 Markdown 语法回写（粗体、斜体、删除线、行内代码、链接、图片、`<br>`、行内公式），竖线转义成 `\|`，纯文本星号转义成 `\*`（行内代码内不转义），换行压成空格。
_Avoid_: 导出、序列化

**表格模式**:
copy popover 的第二种形态：主按钮换成复制图标（不再显示文字）、隐藏格式箭头、贴在表格可见区右上角内侧（宽表取表格与其滚动父容器的交集）。与公式模式共用同一个控件、定位与隐藏逻辑。
_Avoid_: 表格按钮（指控件时仍叫 copy popover）

