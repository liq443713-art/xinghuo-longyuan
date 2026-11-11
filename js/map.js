/* =========================================================
   星火陇原 · 地图与坐标交互
   纯原生 JavaScript，无外部依赖，支持 file:// 直接打开
   ========================================================= */

(function () {
  "use strict";

  var D = window.SXL;
  if (!D) return;

  var VB = D.viewBox;
  var KEY = "xhlm-lit-v1";
  var uid = 0;

  /* ---------- 本地存储：星火册 ---------- */

  function loadLit() {
    try {
      var raw = JSON.parse(window.localStorage.getItem(KEY));
      if (Array.isArray(raw)) {
        return raw.filter(function (id) {
          return D.landmarks.some(function (lm) { return lm.id === id; });
        });
      }
    } catch (err) {
      /* file:// 或隐私模式下 localStorage 不可用时静默降级 */
    }
    return [];
  }

  function saveLit(value) {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(value));
    } catch (err) {
      /* 忽略存储失败，交互本身不受影响 */
    }
  }

  var lit = loadLit();

  function isLit(id) {
    return lit.indexOf(id) > -1;
  }

  function byId(id) {
    for (var i = 0; i < D.landmarks.length; i++) {
      if (D.landmarks[i].id === id) return D.landmarks[i];
    }
    return null;
  }

  function litCount() {
    return lit.length;
  }

  function toast(message) {
    if (typeof window.sxlToast === "function") {
      window.sxlToast(message);
    }
  }

  /* ---------- 路径工具 ---------- */

  function smoothOpen(points, k) {
    k = k || 0.55;
    if (!points.length) return "";
    var out = "M " + points[0][0].toFixed(1) + " " + points[0][1].toFixed(1);
    for (var i = 0; i < points.length - 1; i++) {
      var p0 = points[Math.max(i - 1, 0)];
      var p1 = points[i];
      var p2 = points[i + 1];
      var p3 = points[Math.min(i + 2, points.length - 1)];
      var c1x = p1[0] + ((p2[0] - p0[0]) / 6) * k;
      var c1y = p1[1] + ((p2[1] - p0[1]) / 6) * k;
      var c2x = p2[0] - ((p3[0] - p1[0]) / 6) * k;
      var c2y = p2[1] - ((p3[1] - p1[1]) / 6) * k;
      out += " C " + c1x.toFixed(1) + " " + c1y.toFixed(1) + " " +
        c2x.toFixed(1) + " " + c2y.toFixed(1) + " " +
        p2[0].toFixed(1) + " " + p2[1].toFixed(1);
    }
    return out;
  }

  function ringPath(cx, cy, radius, seed) {
    var steps = 84;
    var pts = [];
    for (var i = 0; i < steps; i++) {
      var t = (Math.PI * 2 * i) / steps;
      var r = radius * (1 + 0.06 * Math.sin(3 * t + seed) + 0.03 * Math.sin(7 * t + seed * 2));
      pts.push([cx + r * Math.cos(t), cy + r * Math.sin(t) * 0.72]);
    }
    var d = "M " + pts[0][0].toFixed(1) + " " + pts[0][1].toFixed(1);
    for (var j = 1; j < pts.length; j++) {
      d += " L " + pts[j][0].toFixed(1) + " " + pts[j][1].toFixed(1);
    }
    return d + " Z";
  }

  /* ---------- 构建地图 ---------- */

  function buildMap(container, opts) {
    opts = opts || {};
    var id = "map" + (++uid);
    var shortLabel = { liangdang: "两当", huining: "会宁", lanzhou: "兰州" };

    var rings = D.rings.map(function (r) {
      return '<path d="' + ringPath(r[0], r[1], r[2], r[3]) +
        '" class="map-contour" fill="none" stroke="#EFE6D6" stroke-width="0.8" opacity="0.09"/>';
    }).join("");

    var svg = '' +
      '<svg class="map-svg" viewBox="0 0 ' + VB.w + " " + VB.h + '" aria-hidden="true" focusable="false">' +
      '<defs><clipPath id="' + id + 'clip"><path d="' + D.mapPath + '"/></clipPath></defs>' +
      '<path class="map-land" d="' + D.mapPath + '" fill="#2c241e" stroke="#9a8570" stroke-width="1.1" stroke-linejoin="round"/>' +
      '<g clip-path="url(#' + id + 'clip)">' + rings + '</g>' +
      '<path class="map-river" d="' + smoothOpen(D.river, 0.5) +
        '" fill="none" stroke="#6e8b7d" stroke-width="1.5" opacity="0.8"/>' +
      '<path class="map-west-route" d="' + smoothOpen(D.westRoute, 0.55) +
        '" fill="none" stroke="#c8402f" stroke-width="1.2" stroke-dasharray="5 6" opacity="0.72"/>' +
      '<path class="map-route" d="' + smoothOpen(D.route, 0.55) +
        '" pathLength="100" fill="none" stroke="#c8402f" stroke-width="1.8" stroke-linecap="round" opacity="0.95"/>' +
      '<g class="map-compass" transform="translate(650 505)" opacity="0.6">' +
      '<circle r="13" fill="none" stroke="#c7b8a3" stroke-width="0.8"/>' +
      '<path d="M0 -9 L3.6 0 L0 9 L-3.6 0 Z" fill="#c7b8a3" opacity="0.85"/>' +
      '<text y="-17" text-anchor="middle" font-size="8" letter-spacing="1" font-family="Consolas, monospace" fill="#c7b8a3">N</text>' +
      '</g>' +
      '</svg>' +
      '<div class="map-pins" role="group" aria-label="甘肃红色坐标点位"></div>';

    container.innerHTML = svg;
    var layer = container.querySelector(".map-pins");
    var pinElements = [];

    D.landmarks.forEach(function (lm) {
      var pin = document.createElement("button");
      pin.type = "button";
      pin.className = "map-pin pin-side-" + lm.side;
      pin.style.setProperty("--x", (lm.x / VB.w) * 100);
      pin.style.setProperty("--y", (lm.y / VB.h) * 100);
      pin.dataset.id = lm.id;
      pin.dataset.tag = lm.tagKey;
      pin.setAttribute("aria-label", lm.name + "，" + lm.date + "，" + lm.place + "。" + lm.tagline);
      pin.innerHTML =
        '<span class="pin-halo" aria-hidden="true"></span>' +
        '<span class="pin-core" aria-hidden="true"></span>' +
        '<span class="pin-label">' + (shortLabel[lm.id] || lm.name) + '</span>';
      pin.addEventListener("click", function () {
        if (typeof opts.onSelect === "function") {
          opts.onSelect(lm.id);
        }
        container.dispatchEvent(new CustomEvent("sxlselect", {
          bubbles: true,
          detail: { id: lm.id }
        }));
      });
      layer.appendChild(pin);
      pinElements.push(pin);
    });

    function refresh(selectedId) {
      pinElements.forEach(function (pin) {
        var on = isLit(pin.dataset.id);
        pin.classList.toggle("is-lit", on);
        pin.classList.toggle("is-selected", pin.dataset.id === selectedId);
        pin.setAttribute("aria-pressed", on ? "true" : "false");
      });
    }

    refresh(null);
    return { refresh: refresh, container: container };
  }

  /* ---------- 首页：地图入口 ---------- */

  var hero = document.getElementById("heroMap");
  if (hero) {
    buildMap(hero, {});
    hero.addEventListener("sxlselect", function (event) {
      window.location.href = "pages/landmarks.html#" + event.detail.id;
    });
  }

  /* ---------- 红色坐标页 ---------- */

  var full = document.getElementById("fullMap");
  if (!full) return;

  var detail = document.getElementById("landmarkDetail");
  var emptyDetailHTML = detail ? detail.innerHTML : "";
  var grid = document.getElementById("landmarkGrid");
  var progressPanel = document.getElementById("progressPanel");
  var slotWrap = document.getElementById("litSlots");
  var live = document.querySelector("[data-live]");
  var selectedId = null;
  var filterKey = "all";
  var cards = [];

  var mapApi = buildMap(full, {});

  full.addEventListener("sxlselect", function (event) {
    select(event.detail.id);
  });

  /* 卡片 */
  if (grid) {
    var frag = document.createDocumentFragment();
    D.landmarks.forEach(function (lm) {
      var card = document.createElement("button");
      card.type = "button";
      card.className = "landmark-card";
      card.dataset.id = lm.id;
      card.dataset.tag = lm.tagKey;
      card.setAttribute("aria-pressed", "false");
      card.innerHTML =
        '<span class="landmark-card__top">' +
        '<span class="card-year">' + lm.year + '</span>' +
        '<span class="card-tag">' + lm.tagLabel + '</span>' +
        '</span>' +
        '<span class="card-name">' + lm.name + '</span>' +
        '<span class="card-place">' + lm.shortPlace + '</span>' +
        '<span class="card-line">' + lm.tagline + '</span>' +
        '<span class="card-status" data-card-status>点亮</span>';
      card.addEventListener("click", function () {
        select(lm.id, { scroll: true });
      });
      frag.appendChild(card);
      cards.push(card);
    });
    grid.appendChild(frag);
  }

  /* 星火册格 */
  if (slotWrap) {
    var slotFrag = document.createDocumentFragment();
    D.landmarks.forEach(function (lm) {
      var slot = document.createElement("span");
      slot.className = "slot";
      slot.dataset.slot = lm.id;
      slot.title = lm.name;
      slot.setAttribute("aria-hidden", "true");
      slot.textContent = "★";
      slotFrag.appendChild(slot);
    });
    slotWrap.appendChild(slotFrag);
  }

  /* 状态同步 */
  function syncUI() {
    var count = litCount();
    document.querySelectorAll("[data-lit-count]").forEach(function (node) {
      node.textContent = count + " / " + D.landmarks.length;
    });
    var fill = document.querySelector("[data-lit-progress]");
    if (fill) {
      fill.style.width = ((count / D.landmarks.length) * 100).toFixed(1) + "%";
    }
    if (progressPanel) {
      progressPanel.classList.toggle("is-complete", count === D.landmarks.length);
    }
    document.querySelectorAll(".slot").forEach(function (slot) {
      slot.classList.toggle("is-lit", isLit(slot.dataset.slot));
    });
    cards.forEach(function (card) {
      var on = isLit(card.dataset.id);
      var isCurrent = card.dataset.id === selectedId;
      card.classList.toggle("is-lit", on);
      card.classList.toggle("is-selected", isCurrent);
      card.setAttribute("aria-pressed", isCurrent ? "true" : "false");
      var status = card.querySelector("[data-card-status]");
      if (status) status.textContent = on ? "已点亮" : "点亮";
    });
    mapApi.refresh(selectedId);
    if (live) {
      live.textContent = "星火册已点亮 " + count + " 处，共 " + D.landmarks.length + " 处。";
    }
    var currentStatus = detail && detail.querySelector("[data-detail-status]");
    if (currentStatus && selectedId) {
      var currentLit = isLit(selectedId);
      currentStatus.classList.toggle("is-lit", currentLit);
      currentStatus.textContent = currentLit ? "星火已点亮 · 已收入星火册" : "选中，尚未点亮";
    }
  }

  function applyFilter() {
    cards.forEach(function (card) {
      card.classList.toggle("is-dim", filterKey !== "all" && card.dataset.tag !== filterKey);
    });
    document.querySelectorAll(".map-pin").forEach(function (pin) {
      pin.classList.toggle("is-dim", filterKey !== "all" && pin.dataset.tag !== filterKey);
    });
  }

  /* 详情面板 */
  function select(id, options) {
    options = options || {};
    var lm = byId(id);
    if (!lm || !detail) return;
    var firstTime = !isLit(id);
    if (firstTime) {
      lit.push(id);
      saveLit(lit);
    }
    selectedId = id;

    var index = D.landmarks.indexOf(lm);
    var prev = D.landmarks[(index - 1 + D.landmarks.length) % D.landmarks.length];
    var next = D.landmarks[(index + 1) % D.landmarks.length];

    detail.classList.remove("detail--empty");
    detail.innerHTML =
      '<article>' +
      '<button class="detail-close" type="button" data-close-detail aria-label="收起详情">收起 ×</button>' +
      '<p class="detail-kicker">' + lm.date + " · " + lm.tagLabel + '</p>' +
      '<h2 class="detail-title">' + lm.name + '</h2>' +
      '<div class="detail-place"><span>' + lm.place + '</span><span>' + lm.lonlat + '</span></div>' +
      '<p class="detail-story">' + lm.story + '</p>' +
      '<div class="detail-meaning">' +
      '<span class="detail-meaning__label">为什么记得</span>' +
      '<p>' + lm.meaning + '</p>' +
      '</div>' +
      '<div class="detail-foot">' +
      '<span class="detail-status is-lit" data-detail-status>星火已点亮 · 已收入星火册</span>' +
      '<span class="mono" style="font-size:10px;letter-spacing:.1em;color:var(--ink-3)">' +
      String(index + 1).padStart(2, "0") + " / " + String(D.landmarks.length).padStart(2, "0") +
      '</span>' +
      '</div>' +
      '<div class="detail-nav">' +
      '<button class="btn btn--ghost btn--small" type="button" data-step="-1">← 上一处：' + prev.name + '</button>' +
      '<button class="btn btn--ghost btn--small" type="button" data-step="1">下一处：' + next.name + ' →</button>' +
      '</div>' +
      '</article>';

    try {
      history.replaceState(null, "", "#" + id);
    } catch (err) {
      /* 某些 file:// 环境不支持 replaceState */
    }

    syncUI();

    if (firstTime) {
      if (litCount() === D.landmarks.length) {
        toast("八处星火，已全部点亮。你走完了一趟属于甘肃的红色地图。");
      } else {
        toast("已点亮「" + lm.name + "」 · 星火册 " + litCount() + " / " + D.landmarks.length);
      }
    }

    if (options.scroll) {
      var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      detail.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
    }
  }

  function closeDetail() {
    if (!detail || !selectedId) return;
    var previousId = selectedId;
    selectedId = null;
    detail.classList.add("detail--empty");
    detail.innerHTML = emptyDetailHTML;
    syncUI();
    try {
      history.replaceState(null, "", location.href.split("#")[0]);
    } catch (err) {
      /* file:// 环境下忽略 */
    }
    var pin = document.querySelector('.map-pin[data-id="' + previousId + '"]');
    if (pin && typeof pin.focus === "function") {
      try {
        pin.focus({ preventScroll: true });
      } catch (err) {
        pin.focus();
      }
    }
    if (live) {
      live.textContent = "已收起详情，星火册仍保留 " + litCount() + " 处。";
    }
  }

  if (detail) {
    detail.addEventListener("click", function (event) {
      var closeBtn = event.target.closest("[data-close-detail]");
      if (closeBtn) {
        closeDetail();
        return;
      }
      var startBtn = event.target.closest("[data-start]");
      if (startBtn) {
        select(startBtn.dataset.start);
        return;
      }
      var stepBtn = event.target.closest("[data-step]");
      if (!stepBtn || !selectedId) return;
      var index = D.landmarks.findIndex(function (lm) { return lm.id === selectedId; });
      var step = parseInt(stepBtn.dataset.step, 10);
      var nextIndex = (index + step + D.landmarks.length) % D.landmarks.length;
      select(D.landmarks[nextIndex].id);
    });
  }

  /* 筛选 */
  document.querySelectorAll("[data-filter]").forEach(function (chip) {
    chip.addEventListener("click", function () {
      filterKey = chip.dataset.filter;
      document.querySelectorAll("[data-filter]").forEach(function (other) {
        other.setAttribute("aria-pressed", other === chip ? "true" : "false");
      });
      applyFilter();
    });
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && selectedId) {
      closeDetail();
    }
  });

  /* 清空星火册 */
  var resetBtn = document.querySelector("[data-reset-lit]");
  if (resetBtn) {
    resetBtn.addEventListener("click", function () {
      if (!window.confirm("清空星火册，重新开始巡礼？")) return;
      lit = [];
      saveLit(lit);
      syncUI();
      toast("星火册已清空。八处坐标，等你重新点亮。");
    });
  }

  /* 初始状态：支持从首页传入 #坐标 */
  var hash = "";
  try {
    hash = decodeURIComponent(window.location.hash.replace("#", ""));
  } catch (err) {
    hash = window.location.hash.replace("#", "");
  }
  if (byId(hash)) {
    select(hash);
  } else {
    syncUI();
  }

  applyFilter();
})();
