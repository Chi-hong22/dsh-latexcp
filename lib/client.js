window.__ModuleLoader__.load({
  id: "@chi-hong22/dsh-latexcp",
  factory: () => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    // dsh-latexcp: 悬停 KaTeX 公式浮现复制按钮，复制其 LaTeX 源码；悬停 Markdown
    // 表格则把整张表复制成 GFM 表格文本。
    // 两种输出格式（$…$ 与 \(…\)），行内/行间公式自动对应单/双定界符。
    // 源码取自 KaTeX 渲染 DOM 保留的 .katex-mathml annotation 节点。

    // ---- 常量 ----
    const PLUGIN_ID = "@chi-hong22/dsh-latexcp";
    const CSS = `
.ltx-copy-wrap {
  position: fixed; z-index: 99999;
  display: inline-flex; align-items: center;
  border-radius: 999px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.35));
  background: var(--dsw-alias-bg-overlay, #ffffff);
  color: var(--dsw-alias-label-primary, #1f2328);
  box-shadow: 0 2px 8px rgba(0,0,0,.18);
  opacity: 0; visibility: hidden; pointer-events: none;
  transition: opacity .1s ease, visibility 0s linear .1s;
  font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
}
.ltx-copy-wrap.ltx-visible { opacity: 1; visibility: visible; pointer-events: auto; transition: opacity .1s ease; }
.ltx-copy-wrap.ltx-no-format .ltx-copy-arrow { display: none; }
.ltx-copy-wrap.ltx-icon-only .ltx-copy-btn { padding: 3px 10px; }
.ltx-copy-btn svg { display: block; }
.ltx-copy-btn {
  border: none; background: transparent; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  padding: 2px 10px; font-size: 12px; line-height: 18px;
  color: inherit; white-space: nowrap; font-family: inherit;
}
.ltx-copy-arrow {
  border: none; background: transparent; cursor: pointer;
  padding: 2px 6px 2px 2px; font-size: 10px; line-height: 18px;
  color: inherit; font-family: inherit;
  border-left: 1px solid var(--dsw-alias-border-l1, rgba(128,128,128,.25));
}
.ltx-copy-menu {
  position: absolute; top: calc(100% + 4px); right: 0;
  display: none; flex-direction: column;
  min-width: 160px; padding: 4px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.35));
  border-radius: 8px;
  background: var(--dsw-alias-bg-overlay, #ffffff);
  color: var(--dsw-alias-label-primary, #1f2328);
  box-shadow: 0 4px 12px rgba(0,0,0,.18);
  font-size: 12px; line-height: 20px;
}
.ltx-copy-menu.ltx-open { display: flex; }
.ltx-copy-menu button {
  border: none; background: transparent; cursor: pointer;
  padding: 4px 8px; border-radius: 6px; text-align: left;
  color: inherit; font-family: inherit; font-size: 12px;
  display: flex; flex-direction: column; align-items: stretch; gap: 2px;
}
.ltx-copy-menu button:hover { background: var(--dsw-alias-bg-layer-1, rgba(0,0,0,.06)); }
.ltx-fmt-row { display: flex; align-items: center; gap: 6px; }
.ltx-copy-menu .ltx-check { visibility: hidden; }
.ltx-copy-menu button.ltx-selected .ltx-check { visibility: visible; }
.ltx-fmt-sub {
  font-size: 10px; line-height: 14px;
  color: var(--dsw-alias-label-secondary, #666666);
  padding-left: 18px;
}
`;
    const FORMATS = [
      {
        id: "dollar",
        label: "$ … $",
        sub: "行内 $…$ · 行间 $$…$$",
        wrapInline: (t) => "$" + t + "$",
        wrapDisplay: (t) => "$$" + t + "$$",
      },
      {
        id: "latex",
        label: "\\( … \\)",
        sub: "行内 \\(…\\) · 行间 \\[…\\]",
        wrapInline: (t) => "\\(" + t + "\\)",
        wrapDisplay: (t) => "\\[" + t + "\\]",
      },
    ];
    const BUTTON_LABEL = "LaTeX";
    const TABLE_TITLE = "复制 Markdown 表格";
    const FORMULA_TITLE = "复制 LaTeX 源码";
    // 表格模式用 DSH 官方复制图标（IconCopyOutlineRegular：16×16、strokeWidth 1），
    // 复制成功后换成官方对勾（IconCheckOutlineRegular），风格与代码块复制按钮一致。
    const COPY_ICON =
      '<svg data-icon="copy" viewBox="0 0 16 16" width="16" height="16" fill="none" stroke-width="1" aria-hidden="true" focusable="false">' +
      '<rect x="1.52075" y="4.07373" width="10.3932" height="10.3932" rx="2" stroke="currentColor"/>' +
      '<path d="M11.9792 1.53296C13.36 1.53296 14.4792 2.65225 14.4792 4.03296V9.42847C14.4792 10.3756 13.9521 11.1987 13.1755 11.6228V10.3298C13.3652 10.0787 13.4792 9.7674 13.4792 9.42847V4.03296C13.4792 3.20453 12.8077 2.53296 11.9792 2.53296H6.58374C6.27966 2.53301 5.99684 2.6235 5.7605 2.77905H4.42358C4.85652 2.03463 5.66056 1.53304 6.58374 1.53296H11.9792Z" fill="currentColor"/></svg>';
    const DONE_ICON =
      '<svg data-icon="check" viewBox="0 0 16 16" width="16" height="16" fill="none" stroke-width="1" aria-hidden="true" focusable="false">' +
      '<path d="M2.25 8.5L5.49732 11.7473C5.90519 12.1552 6.57263 12.1344 6.95426 11.7018L13.75 4" stroke="currentColor"/></svg>';
    const HIDE_GRACE_MS = 250;
    const RESTORE_LABEL_MS = 1200;

    // ---- 纯函数（可被 Node 回归测试提取） ----
    function texFrom(katexEl) {
      const ann = katexEl.querySelector('.katex-mathml annotation[encoding="application/x-tex"]');
      return ann ? String(ann.textContent) : null;
    }

    function isDisplayKatex(katexEl) {
      if (katexEl.classList.contains("katex-display")) return true;
      const parent = katexEl.parentElement;
      return !!parent && parent.classList.contains("katex-display");
    }

    function wrapTex(fmt, tex, display) {
      return display ? fmt.wrapDisplay(tex) : fmt.wrapInline(tex);
    }

    // ---- markdown 表格 → GFM ----
    // 只认 DSH markdown 渲染器产出的表格（渲染器保证 <thead> 首行有 th）；单元格
    // 内联节点按 GFM 语法回写，列对齐取自 th 的内联 text-align（渲染器仅在源表
    // 声明了对齐时写入）。
    const ALIGN_MARKERS = { left: ":---", center: ":---:", right: "---:" };
    const ALIGN_DEFAULT = "---";

    function attrOf(node, name) {
      return typeof node.getAttribute === "function" ? node.getAttribute(name) ?? "" : "";
    }

    // 代码片段里的字符保持原样（反引号内不需要转义）
    function rawText(node) {
      if (node === null || node === undefined) return "";
      if (node.nodeType === 3) return String(node.nodeValue ?? "");
      if (node.nodeType !== 1) return "";
      return Array.prototype.map.call(node.childNodes ?? [], rawText).join("");
    }

    function inlineMarkdown(node, fmt) {
      if (node === null || node === undefined) return "";
      // 纯文本里的 * 会被 GFM 当成强调起始，转义成 \*；生成的语法（**…** 等）不经过这里
      if (node.nodeType === 3) return String(node.nodeValue ?? "").replace(/\*/g, "\\*");
      if (node.nodeType !== 1) return "";
      const tag = node.tagName;
      if (tag === "BR") return "<br>";
      if (tag === "IMG") return "![" + attrOf(node, "alt") + "](" + attrOf(node, "src") + ")";
      if (tag === "CODE") return "`" + rawText(node) + "`";
      if (node.classList && node.classList.contains("katex")) {
        const tex = texFrom(node);
        return tex === null || tex.trim() === "" ? "" : wrapTex(fmt, tex, false);
      }
      const inner = Array.prototype.map.call(
        node.childNodes ?? [],
        (child) => inlineMarkdown(child, fmt),
      ).join("");
      if (inner === "") return "";
      if (tag === "STRONG" || tag === "B") return "**" + inner + "**";
      if (tag === "EM" || tag === "I") return "*" + inner + "*";
      if (tag === "DEL" || tag === "S") return "~~" + inner + "~~";
      if (tag === "A") {
        const href = attrOf(node, "href");
        return href === "" ? inner : "[" + inner + "](" + href + ")";
      }
      return inner;
    }

    function cellMarkdown(cell, fmt) {
      if (!cell) return "";
      const text = Array.prototype.map.call(
        cell.childNodes ?? [],
        (child) => inlineMarkdown(child, fmt),
      ).join("");
      // 单元格不能跨行，竖线是列分隔符
      return text.replace(/\r?\n/g, " ").replace(/\|/g, "\\|").trim();
    }

    function alignMarker(cell) {
      const declared = cell && cell.style ? cell.style.textAlign : "";
      return ALIGN_MARKERS[declared] || ALIGN_DEFAULT;
    }

    function tableLine(cells) {
      return "| " + cells.join(" | ") + " |";
    }

    function markdownTableFrom(node) {
      if (!node || typeof node.closest !== "function") return null;
      const table = node.closest("table");
      if (!table || !table.tHead || !table.tHead.rows || table.tHead.rows.length === 0) return null;
      const headRow = table.tHead.rows[0];
      return headRow.cells && headRow.cells.length > 0 ? table : null;
    }

    // 宽表被滚动容器裁剪：按钮定位取表格与其父容器的可见交集
    function tableVisibleRect(table) {
      const tableRect = table.getBoundingClientRect();
      const host = table.parentElement;
      if (!host) return tableRect;
      const hostRect = host.getBoundingClientRect();
      return {
        left: Math.max(tableRect.left, hostRect.left),
        right: Math.min(tableRect.right, hostRect.right),
        top: Math.max(tableRect.top, hostRect.top),
        bottom: Math.min(tableRect.bottom, hostRect.bottom),
      };
    }

    function tableToMarkdown(table, fmt) {
      if (!markdownTableFrom(table)) return null;
      const headCells = Array.prototype.slice.call(table.tHead.rows[0].cells);
      const lines = [
        tableLine(headCells.map((cell) => cellMarkdown(cell, fmt))),
        tableLine(headCells.map(alignMarker)),
      ];
      const bodies = table.tBodies ? Array.prototype.slice.call(table.tBodies) : [];
      for (const body of bodies) {
        for (const row of Array.prototype.slice.call(body.rows ?? [])) {
          const cells = Array.prototype.slice.call(row.cells ?? []);
          lines.push(tableLine(headCells.map((_, index) => cellMarkdown(cells[index], fmt))));
        }
      }
      return lines.join("\n");
    }

    // ---- 样式表 ----
    // 官方客户端插件约定：<style> 带 data-plugin / data-plugin-css 归属标记，宿主按
    // 插件 id 回收（removeOwnedStyles）；插件自身也在 fiber 卸载时移除。
    function installStyles(ctx) {
      ctx.effect(() => {
        const tag = document.createElement("style");
        tag.dataset.plugin = PLUGIN_ID;
        tag.dataset.pluginCss = `${PLUGIN_ID}/latexcp.css`;
        tag.textContent = CSS;
        document.head.appendChild(tag);
        return () => { tag.remove(); };
      }, "latexcp: stylesheet");
    }

    // ---- 插件主体 ----
    function apply(ctx) {
      installStyles(ctx);

      const wrap = document.createElement("div");
      wrap.className = "ltx-copy-wrap";
      const copyBtn = document.createElement("button");
      copyBtn.type = "button";
      copyBtn.className = "ltx-copy-btn";
      copyBtn.textContent = BUTTON_LABEL;
      copyBtn.title = "复制 LaTeX 源码";
      const arrowBtn = document.createElement("button");
      arrowBtn.type = "button";
      arrowBtn.className = "ltx-copy-arrow";
      arrowBtn.textContent = "▾";
      arrowBtn.title = "选择复制格式";
      const menu = document.createElement("div");
      menu.className = "ltx-copy-menu";
      wrap.appendChild(copyBtn);
      wrap.appendChild(arrowBtn);
      wrap.appendChild(menu);

      let currentFormat = FORMATS[0];
      const menuButtons = {};
      for (const fmt of FORMATS) {
        const b = document.createElement("button");
        b.type = "button";
        const row = document.createElement("span");
        row.className = "ltx-fmt-row";
        const check = document.createElement("span");
        check.className = "ltx-check";
        check.textContent = "✓";
        const label = document.createElement("span");
        label.textContent = fmt.label;
        row.appendChild(check);
        row.appendChild(label);
        const sub = document.createElement("span");
        sub.className = "ltx-fmt-sub";
        sub.textContent = fmt.sub;
        b.appendChild(row);
        b.appendChild(sub);
        b.addEventListener("click", () => {
          currentFormat = fmt;
          updateSelected();
          closeMenu();
        });
        menu.appendChild(b);
        menuButtons[fmt.id] = b;
      }
      function updateSelected() {
        for (const fmt of FORMATS) menuButtons[fmt.id].classList.toggle("ltx-selected", fmt.id === currentFormat.id);
      }
      updateSelected();

      function closeMenu() {
        menu.classList.remove("ltx-open");
      }

      let currentTex = null;
      let currentDisplay = false;
      let currentTable = null;
      let currentElement = null;
      let currentRect = null;
      let visible = false;
      let followFrameId = null; // requestAnimationFrame
      let restoreTimerId = null; // setTimeout
      let pendingHideTimerId = null; // setTimeout
      let lastLeft = null;
      let lastTop = null;

      function clearFollow() {
        if (followFrameId !== null) { cancelAnimationFrame(followFrameId); followFrameId = null; }
      }
      function clearRestore() {
        if (restoreTimerId !== null) { clearTimeout(restoreTimerId); restoreTimerId = null; }
      }
      function clearPendingHide() {
        if (pendingHideTimerId !== null) { clearTimeout(pendingHideTimerId); pendingHideTimerId = null; }
      }

      function updateLabel() {
        const tableMode = currentTable !== null;
        if (tableMode) {
          copyBtn.innerHTML = COPY_ICON;
        } else {
          copyBtn.textContent = BUTTON_LABEL;
        }
        copyBtn.setAttribute("aria-label", tableMode ? TABLE_TITLE : FORMULA_TITLE);
        copyBtn.title = tableMode ? TABLE_TITLE : FORMULA_TITLE;
        wrap.classList.toggle("ltx-no-format", tableMode);
        wrap.classList.toggle("ltx-icon-only", tableMode);
      }

      function restoreLabel() {
        clearRestore();
        updateLabel();
        copyBtn.style.color = "";
      }

      function position() {
        if (!currentRect) return;
        const w = wrap.offsetWidth || 80;
        const h = wrap.offsetHeight || 22;
        let left = currentRect.right + 6;
        let top = currentRect.top - h - 2;
        if (currentTable !== null) {
          // 表格：贴在表格可视区右上角内侧
          left = currentRect.right - w - 8;
          top = Math.max(currentRect.top, 0) + 8;
        }
        if (top < 4) top = currentRect.bottom + 2;
        if (left + w > window.innerWidth - 4) left = currentRect.left - w - 6;
        if (left < 4) left = 4;
        const x = Math.round(left);
        const y = Math.round(top);
        if (x === lastLeft && y === lastTop) return;
        lastLeft = x;
        lastTop = y;
        wrap.style.left = x + "px";
        wrap.style.top = y + "px";
      }

      function targetRect() {
        if (currentTable !== null) return currentTable.isConnected ? tableVisibleRect(currentTable) : null;
        return currentElement !== null && currentElement.isConnected
          ? currentElement.getBoundingClientRect()
          : null;
      }

      function inViewport(rect) {
        return rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth;
      }

      // 每帧重取目标位置：滚动、流式渲染时按钮都贴着目标走，不再用 100ms 轮询
      function followLoop() {
        followFrameId = null;
        if (!visible) return;
        const rect = targetRect();
        if (rect === null || !inViewport(rect)) { hide(); return; }
        currentRect = rect;
        position();
        followFrameId = requestAnimationFrame(followLoop);
      }

      function startFollow() {
        if (followFrameId === null) followFrameId = requestAnimationFrame(followLoop);
      }

      function hide() {
        clearPendingHide();
        visible = false;
        wrap.classList.remove("ltx-visible");
        closeMenu();
        currentRect = null;
        currentTable = null;
        currentElement = null;
        clearFollow();
      }

      function show() {
        visible = true;
        wrap.classList.add("ltx-visible");
        closeMenu();
        position();
        startFollow();
      }

      function targetOf(node) {
        const table = markdownTableFrom(node);
        if (table !== null) return { table, katex: null };
        const katexEl = node.closest(".katex");
        if (katexEl === null) return null;
        const tex = texFrom(katexEl);
        return tex === null || tex.trim() === "" ? null : { table: null, katex: katexEl };
      }

      // 触屏点在滚动容器或表格边距上时 closest("table") 取不到，往回查一层；
      // 只认直接子表格，避免点在空白处时命中页面里别的表格
      function tableWithin(node) {
        const direct = markdownTableFrom(node);
        if (direct !== null) return direct;
        if (!node || typeof node.querySelector !== "function") return null;
        const inner = node.querySelector("table");
        if (inner === null || inner.parentElement !== node) return null;
        return markdownTableFrom(inner);
      }

      function activate(hit) {
        const nextTable = hit.table;
        const katexEl = hit.katex;
        const switched = (nextTable !== null) !== (currentTable !== null);
        currentTable = nextTable;
        currentElement = katexEl;
        currentTex = katexEl === null ? null : texFrom(katexEl);
        currentDisplay = katexEl === null ? false : isDisplayKatex(katexEl);
        currentRect = nextTable !== null ? tableVisibleRect(nextTable) : katexEl.getBoundingClientRect();
        clearPendingHide();
        if (switched || !visible) updateLabel();
        show();
      }

      function onOver(event) {
        const target = event.target;
        if (!target || typeof target.closest !== "function") return;
        if (wrap.contains(target)) { clearPendingHide(); return; }
        const hit = targetOf(target);
        if (hit !== null) activate(hit);
      }

      // 触屏：点表格或公式即浮现按钮，点空白处收起
      function onPointerDown(event) {
        if (event.pointerType === "mouse") return;
        const target = event.target;
        if (!target || typeof target.closest !== "function" || wrap.contains(target)) return;
        const table = tableWithin(target);
        if (table !== null) { activate({ table, katex: null }); return; }
        const hit = targetOf(target);
        if (hit !== null) activate(hit);
        else hide();
      }

      // 键盘：宽表滚动容器可 Tab 聚焦，聚焦即浮现；Enter/Space 复制，Esc 收起
      function onFocusIn(event) {
        const target = event.target;
        if (!target || typeof target.closest !== "function" || wrap.contains(target)) return;
        const table = tableWithin(target);
        if (table !== null) activate({ table, katex: null });
      }

      function onKeyDown(event) {
        if (event.key === "Escape") { if (visible) hide(); return; }
        if (event.key !== "Enter" && event.key !== " ") return;
        if (!visible || currentTable === null) return;
        const target = event.target;
        const onWrapper = target !== currentTable && typeof target.getAttribute === "function"
          && target.getAttribute("tabindex") === "0"
          && typeof target.contains === "function" && target.contains(currentTable);
        if (target !== currentTable && !onWrapper) return;
        event.preventDefault();
        onCopy();
      }

      function onOut(event) {
        const to = event.relatedTarget;
        if (to && wrap.contains(to)) return;
        if (to && typeof to.closest === "function" && (to.closest(".katex") || markdownTableFrom(to))) return;
        clearPendingHide();
        pendingHideTimerId = setTimeout(hide, HIDE_GRACE_MS);
      }

      function onCopy() {
        closeMenu();
        const text = currentTable !== null
          ? tableToMarkdown(currentTable, currentFormat)
          : currentTex === null ? null : wrapTex(currentFormat, currentTex, currentDisplay);
        if (text === null) return;
        navigator.clipboard.writeText(text).then(
          () => {
            copyBtn.innerHTML = currentTable !== null ? DONE_ICON : "✓ 已复制";
            copyBtn.style.color = "var(--dsw-alias-state-success-primary, #16a34a)";
            clearRestore();
            restoreTimerId = setTimeout(restoreLabel, RESTORE_LABEL_MS);
          },
          () => {
            copyBtn.textContent = "复制失败";
            clearRestore();
            restoreTimerId = setTimeout(restoreLabel, RESTORE_LABEL_MS);
          },
        );
      }

      function onArrow() {
        const open = menu.classList.toggle("ltx-open");
        if (open) position();
      }

      document.addEventListener("mouseover", onOver);
      document.addEventListener("mouseout", onOut);
      document.addEventListener("pointerdown", onPointerDown);
      document.addEventListener("focusin", onFocusIn);
      document.addEventListener("keydown", onKeyDown);
      copyBtn.addEventListener("click", onCopy);
      arrowBtn.addEventListener("click", onArrow);
      document.body.appendChild(wrap);

      ctx.effect(() => () => {
        document.removeEventListener("mouseover", onOver);
        document.removeEventListener("mouseout", onOut);
        document.removeEventListener("pointerdown", onPointerDown);
        document.removeEventListener("focusin", onFocusIn);
        document.removeEventListener("keydown", onKeyDown);
        copyBtn.removeEventListener("click", onCopy);
        arrowBtn.removeEventListener("click", onArrow);
        if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
        clearFollow();
        clearRestore();
        clearPendingHide();
      });
    }

    exports.apply = apply;
    return module.exports;
  }
});
