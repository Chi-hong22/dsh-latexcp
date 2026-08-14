# dsh-latexcp

DeepSeek Harness（DSH）Web 界面 LaTeX 公式复制插件：悬停 KaTeX 公式浮现复制按钮，把公式的 TeX 源码按选定格式复制到剪贴板。本上下文记录该插件的领域语言。

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
悬停公式时浮现的固定定位控件（`LaTeX` 主按钮 + `▾` 格式箭头 + 下拉菜单）；挂在 `document.body` 下（React 渲染树之外），位置每 100ms 跟随公式，鼠标移出公式后延迟 250ms 隐藏（宽限期，保证鼠标能移上按钮）。
_Avoid_: 悬浮按钮之外的名字
