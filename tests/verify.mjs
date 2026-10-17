const NL = String.fromCharCode(10);
// dsh-latexcp 纯函数回归验证（Node，不依赖浏览器）
// 用法: node tests/verify.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const clientJs = path.join(dir, "..", "lib", "client.js");
const src = fs.readFileSync(clientJs, "utf8");

// 从 factory 函数体提取纯函数（仅测试用，不改仓库文件）
const bodyStart = src.indexOf("factory: () => {") + "factory: () => {".length;
const bodyEnd = src.lastIndexOf(NL + "  }" + NL + "});");
const body = src.slice(bodyStart, bodyEnd).replace(
  "exports.apply = apply;",
  "module.exports.__test = { texFrom, isDisplayKatex, wrapTex, tableToMarkdown, markdownTableFrom, apply };" + NL + "    exports.apply = apply;",
);

// 最小 DOM 桩：够 apply() 走完一次挂载/卸载
class El {
  constructor(tag) {
    this.tagName = tag.toUpperCase();
    this.dataset = {};
    this.children = [];
    this.parentNode = null;
    this.style = {};
    this.textContent = "";
    this.className = "";
    this.offsetWidth = 0;
    this.offsetHeight = 0;
    this.classList = { add() {}, remove() {}, toggle() { return false; }, contains() { return false; } };
  }
  appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
  removeChild(child) {
    const i = this.children.indexOf(child);
    if (i >= 0) this.children.splice(i, 1);
    child.parentNode = null;
    return child;
  }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
  addEventListener() {}
  removeEventListener() {}
  contains() { return false; }
}
const env = {
  document: {
    head: new El("head"),
    body: new El("body"),
    createElement: (tag) => new El(tag),
    addEventListener() {},
    removeEventListener() {},
  },
  navigator: { clipboard: { writeText: () => Promise.resolve() } },
};
const loaded = new Function("document", "navigator", body)(env.document, env.navigator);
const { texFrom, isDisplayKatex, wrapTex, apply, tableToMarkdown, markdownTableFrom } = loaded.__test;

const FORMATS = [
  { wrapInline: (t) => "$" + t + "$", wrapDisplay: (t) => "$$" + t + "$$" },
  { wrapInline: (t) => "\\(" + t + "\\)", wrapDisplay: (t) => "\\[" + t + "\\]" },
];

// 模拟 KaTeX 公式元素（够纯函数用即可）
function fakeKatex({ displayClass = false, parentDisplay = false, annText = null } = {}) {
  return {
    classList: { contains: (c) => c === "katex-display" && displayClass },
    parentElement: parentDisplay
      ? { classList: { contains: (c) => c === "katex-display" } }
      : { classList: { contains: () => false } },
    querySelector: () => (annText === null ? null : { textContent: annText }),
  };
}

let passed = 0;
let failed = 0;
function check(name, actual, expected) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a === b) { passed++; console.log("  ok  " + name); }
  else { failed++; console.log("FAIL  " + name + NL + "      actual:   " + a + NL + "      expected: " + b); }
}

// texFrom：annotation 文本直读；缺失时 null
check("texFrom 读 annotation", texFrom(fakeKatex({ annText: "E=mc^2" })), "E=mc^2");
check("texFrom 空源码", texFrom(fakeKatex({ annText: "" })), "");
check("texFrom 无 annotation", texFrom(fakeKatex({ annText: null })), null);

// isDisplayKatex：自身 / 父级带 katex-display 即行间
check("isDisplayKatex 行内", isDisplayKatex(fakeKatex()), false);
check("isDisplayKatex 自身标记", isDisplayKatex(fakeKatex({ displayClass: true })), true);
check("isDisplayKatex 父级标记", isDisplayKatex(fakeKatex({ parentDisplay: true })), true);

// wrapTex：格式 × 公式类型 → 定界符
check("wrapTex dollar inline", wrapTex(FORMATS[0], "E=mc^2", false), "$E=mc^2$");
check("wrapTex dollar display", wrapTex(FORMATS[0], "E=mc^2", true), "$$E=mc^2$$");
check("wrapTex latex inline", wrapTex(FORMATS[1], "E=mc^2", false), "\\(E=mc^2\\)");
check("wrapTex latex display", wrapTex(FORMATS[1], "E=mc^2", true), "\\[E=mc^2\\]");

// apply()：样式表带官方归属标记，fiber 卸载时回收
const disposers = [];
const ctx = { effect: (fn) => { disposers.push(fn()); } };
apply(ctx);
const styles = env.document.head.children.filter((el) => el.tagName === "STYLE");
check("样式表注入数量", styles.length, 1);
check("样式表 data-plugin", styles[0].dataset.plugin, "@chi-hong22/dsh-latexcp");
check("样式表 data-plugin-css", styles[0].dataset.pluginCss, "@chi-hong22/dsh-latexcp/latexcp.css");
check("样式表挂在 head", styles[0].parentNode === env.document.head, true);
check("样式表内容非空", styles[0].textContent.length > 0, true);
check("挂载后按钮在 body", env.document.body.children.length, 1);
for (const dispose of disposers) dispose();
check("卸载后样式表移除", styles[0].parentNode, null);
check("卸载后按钮移除", env.document.body.children.length, 0);

// ---- md 表格 → GFM 复制 ----
function textNode(value) {
  return { nodeType: 3, nodeValue: value };
}
function cellNode(tag, children, textAlign) {
  return {
    nodeType: 1,
    tagName: tag,
    style: textAlign ? { textAlign } : {},
    childNodes: children,
    classList: { contains: () => false },
  };
}
function inlineNode(tag, children, { attrs = {}, classes = [] } = {}) {
  return {
    nodeType: 1,
    tagName: tag,
    style: {},
    childNodes: children,
    classList: { contains: (c) => classes.includes(c) },
    getAttribute: (name) => (Object.prototype.hasOwnProperty.call(attrs, name) ? attrs[name] : null),
  };
}
function fakeTable(headCells, bodyRows) {
  const table = {
    tHead: { rows: [{ cells: headCells }] },
    tBodies: bodyRows.length === 0 ? [] : [{ rows: bodyRows.map((cells) => ({ cells })) }],
    closest: (selector) => (selector === "table" ? table : null),
  };
  return table;
}

const simpleTable = fakeTable(
  [cellNode("TH", [textNode("姓名")]), cellNode("TH", [textNode("备注")])],
  [[cellNode("TD", [textNode("张三")]), cellNode("TD", [textNode("ok")])]],
);
check(
  "表格复制 基本形态",
  tableToMarkdown(simpleTable, FORMATS[0]),
  ["| 姓名 | 备注 |", "| --- | --- |", "| 张三 | ok |"].join(NL),
);

const alignTable = fakeTable(
  [cellNode("TH", [textNode("a")], "left"), cellNode("TH", [textNode("b")], "center"), cellNode("TH", [textNode("c")], "right")],
  [[cellNode("TD", [textNode("1")]), cellNode("TD", [textNode("2")]), cellNode("TD", [textNode("3")])]],
);
check("表格复制 对齐标记", tableToMarkdown(alignTable, FORMATS[0]).split(NL)[1], "| :--- | :---: | ---: |");

const escapeTable = fakeTable(
  [cellNode("TH", [textNode("a|b")]), cellNode("TH", [textNode("c")])],
  [[cellNode("TD", [textNode("x")]), cellNode("TD", [textNode("line1" + NL + "line2")])]],
);
check("表格复制 竖线转义", tableToMarkdown(escapeTable, FORMATS[0]).split(NL)[0], "| a\\|b | c |");
check("表格复制 换行压平", tableToMarkdown(escapeTable, FORMATS[0]).split(NL)[2], "| x | line1 line2 |");

// 纯文本里的 * 必须转义，否则粘贴后会被 GFM 当成强调
const starTable = fakeTable(
  [cellNode("TH", [textNode("备注")])],
  [[cellNode("TD", [textNode("2*3*4 与 **不是粗体**")])]],
);
check("表格复制 星号转义", tableToMarkdown(starTable, FORMATS[0]).split(NL)[2], "| 2\\*3\\*4 与 \\*\\*不是粗体\\*\\* |");

// 行内代码里的 * 保持原样（反引号内不转义）
const codeStarTable = fakeTable(
  [cellNode("TH", [textNode("代码")])],
  [[cellNode("TD", [inlineNode("CODE", [textNode("a*b")])])]],
);
check("表格复制 行内代码不转义", tableToMarkdown(codeStarTable, FORMATS[0]).split(NL)[2], "| `a*b` |");

const inlineTable = fakeTable(
  [cellNode("TH", [textNode("富文本")])],
  [[cellNode("TD", [
    inlineNode("STRONG", [textNode("粗")]),
    textNode(" "),
    inlineNode("EM", [textNode("斜")]),
    inlineNode("DEL", [textNode("删")]),
    inlineNode("CODE", [textNode("code")]),
    inlineNode("A", [textNode("链接")], { attrs: { href: "https://e.com" } }),
    inlineNode("IMG", [], { attrs: { src: "https://e.com/x.png", alt: "图" } }),
    inlineNode("BR", []),
  ])]],
);
check(
  "表格复制 内联语法",
  tableToMarkdown(inlineTable, FORMATS[0]).split(NL)[2],
  "| **粗** *斜*~~删~~`code`[链接](https://e.com)![图](https://e.com/x.png)<br> |",
);

const mathCell = {
  nodeType: 1,
  tagName: "SPAN",
  style: {},
  childNodes: [textNode("E=mc2")],
  classList: { contains: (c) => c === "katex" },
  querySelector: () => ({ textContent: "E=mc^2" }),
};
const mathTable = fakeTable([cellNode("TH", [textNode("公式")])], [[cellNode("TD", [mathCell])]]);
check("表格复制 单元公式", tableToMarkdown(mathTable, FORMATS[0]).split(NL)[2], "| $E=mc^2$ |");
check("表格复制 单元公式 latex 格式", tableToMarkdown(mathTable, FORMATS[1]).split(NL)[2], "| \\(E=mc^2\\) |");

check("markdownTableFrom 命中", markdownTableFrom(simpleTable) === simpleTable, true);
check("markdownTableFrom 无 thead", markdownTableFrom({ closest: () => ({ tHead: null, tBodies: [] }) }), null);
check("markdownTableFrom 非表格", markdownTableFrom({ closest: () => null }), null);
check("markdownTableFrom 空节点", markdownTableFrom(null), null);

console.log(NL + passed + " passed, " + failed + " failed");
if (failed > 0) process.exit(1);
