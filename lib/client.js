window.__ModuleLoader__.load({
  id: "@chi-hong22/dsh-latexcp",
  factory: () => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    // dsh-latexcp: 悬停 KaTeX 公式浮现复制按钮，复制其 LaTeX 源码。
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
  opacity: 0; pointer-events: none;
  transition: opacity .1s ease;
  font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
}
.ltx-copy-wrap.ltx-visible { opacity: 1; pointer-events: auto; }
.ltx-copy-btn {
  border: none; background: transparent; cursor: pointer;
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
    const HIDE_GRACE_MS = 250;
    const RESTORE_LABEL_MS = 1200;
    const FOLLOW_MS = 100;

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
      let currentRect = null;
      let visible = false;
      let followTimerId = null; // setInterval
      let restoreTimerId = null; // setTimeout
      let pendingHideTimerId = null; // setTimeout

      function clearFollow() {
        if (followTimerId !== null) { clearInterval(followTimerId); followTimerId = null; }
      }
      function clearRestore() {
        if (restoreTimerId !== null) { clearTimeout(restoreTimerId); restoreTimerId = null; }
      }
      function clearPendingHide() {
        if (pendingHideTimerId !== null) { clearTimeout(pendingHideTimerId); pendingHideTimerId = null; }
      }

      function restoreLabel() {
        clearRestore();
        copyBtn.textContent = BUTTON_LABEL;
        copyBtn.style.color = "";
      }

      function position() {
        if (!currentRect) return;
        const w = wrap.offsetWidth || 80;
        const h = wrap.offsetHeight || 22;
        let left = currentRect.right + 6;
        let top = currentRect.top - h - 2;
        if (top < 4) top = currentRect.bottom + 2;
        if (left + w > window.innerWidth - 4) left = currentRect.left - w - 6;
        if (left < 4) left = 4;
        wrap.style.left = Math.round(left) + "px";
        wrap.style.top = Math.round(top) + "px";
      }

      function hide() {
        clearPendingHide();
        visible = false;
        wrap.classList.remove("ltx-visible");
        closeMenu();
        currentRect = null;
        clearFollow();
      }

      function show() {
        visible = true;
        wrap.classList.add("ltx-visible");
        closeMenu();
        position();
        if (followTimerId === null) {
          followTimerId = setInterval(() => { if (visible) position(); }, FOLLOW_MS);
        }
      }

      function onOver(event) {
        const target = event.target;
        if (!target || typeof target.closest !== "function") return;
        if (wrap.contains(target)) { clearPendingHide(); return; }
        const katexEl = target.closest(".katex");
        if (!katexEl) return;
        const tex = texFrom(katexEl);
        if (tex === null || tex.trim() === "") return;
        currentTex = tex;
        currentDisplay = isDisplayKatex(katexEl);
        currentRect = katexEl.getBoundingClientRect();
        clearPendingHide();
        show();
      }

      function onOut(event) {
        const to = event.relatedTarget;
        if (to && wrap.contains(to)) return;
        if (to && typeof to.closest === "function" && to.closest(".katex")) return;
        clearPendingHide();
        pendingHideTimerId = setTimeout(hide, HIDE_GRACE_MS);
      }

      function onCopy() {
        closeMenu();
        if (currentTex === null) return;
        const tex = currentTex;
        const wrapped = wrapTex(currentFormat, tex, currentDisplay);
        navigator.clipboard.writeText(wrapped).then(
          () => {
            copyBtn.textContent = "✓ 已复制";
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
      copyBtn.addEventListener("click", onCopy);
      arrowBtn.addEventListener("click", onArrow);
      document.body.appendChild(wrap);

      ctx.effect(() => () => {
        document.removeEventListener("mouseover", onOver);
        document.removeEventListener("mouseout", onOut);
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
