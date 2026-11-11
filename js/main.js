/* =========================================================
   星火陇原 · 通用交互
   滚动入场、提示条、青春接力登记
   ========================================================= */

(function () {
  "use strict";

  /* ---------- 提示条 ---------- */

  var toastEl = null;
  var toastTimer = null;

  window.sxlToast = function (message) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "toast";
      toastEl.setAttribute("role", "status");
      toastEl.setAttribute("aria-live", "polite");
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = message;
    // 强制一次重排，保证连续提示时动画可以重播
    void toastEl.offsetWidth;
    toastEl.classList.add("is-on");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      toastEl.classList.remove("is-on");
    }, 3600);
  };

  /* ---------- 滚动入场 ---------- */

  var reveals = Array.prototype.slice.call(document.querySelectorAll(".reveal"));
  if (reveals.length) {
    if ("IntersectionObserver" in window) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            observer.unobserve(entry.target);
          }
        });
      }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
      reveals.forEach(function (item) { observer.observe(item); });
    } else {
      reveals.forEach(function (item) { item.classList.add("is-in"); });
    }
  }

  /* ---------- 青春接力 ---------- */

  var form = document.getElementById("pledgeForm");
  var result = document.getElementById("pledgeResult");
  var error = document.getElementById("pledgeError");
  var nameInput = document.getElementById("pledgeName");
  var PLEDGE_KEY = "xhlm-pledge-v1";

  var OPTION_LINES = {
    "知农": "读懂土地、作物与节气，把课本知识带进田间",
    "爱农": "尊重每一份劳作，把农民的需要放在心上",
    "兴农": "用专业所学服务乡村，让技术真正长出收成",
    "传薪": "讲好甘肃红色故事，让星火被更多人看见"
  };

  function formatDate(date) {
    var y = date.getFullYear();
    var m = String(date.getMonth() + 1).padStart(2, "0");
    var d = String(date.getDate()).padStart(2, "0");
    return y + "年" + m + "月" + d + "日";
  }

  function renderResult(data) {
    if (!result) return;
    var name = (data.name && data.name.trim()) || "一位陇原青年";
    var options = (data.options || []).filter(function (key) {
      return OPTION_LINES[key];
    });
    if (!options.length) {
      result.hidden = true;
      return;
    }
    result.hidden = false;
    result.innerHTML =
      '<p class="pledge-result__title">接力已登记 · 写给你的这一页</p>' +
      '<p class="pledge-result__line"><strong>' + escapeHTML(name) + '</strong>，你选择把这些事，写进接下来的日子：</p>' +
      '<ul class="pledge-result__list">' +
      options.map(function (key) {
        return "<li>" + key + " · " + OPTION_LINES[key] + "</li>";
      }).join("") +
      '</ul>' +
      '<p class="pledge-result__line">愿把论文写在田野上，把青春种进陇原的春天。</p>' +
      '<p class="pledge-result__meta">记录于 ' + formatDate(new Date(data.savedAt || Date.now())) +
      ' · 仅保存在本机浏览器，不会上传</p>' +
      '<button class="progress-panel__reset" type="button" data-pledge-clear>清除本地记录</button>';

    var clearBtn = result.querySelector("[data-pledge-clear]");
    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        try { window.localStorage.removeItem(PLEDGE_KEY); } catch (err) { /* ignore */ }
        result.hidden = true;
        result.innerHTML = "";
        if (error) error.hidden = true;
        if (form) {
          form.querySelectorAll('input[name="pledge"]').forEach(function (input) {
            input.checked = false;
          });
          syncPledgeOptionState();
        }
        if (nameInput) nameInput.value = "";
        window.sxlToast("本地接力记录已清除。");
      });
    }
  }

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, function (ch) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[ch];
    });
  }

  function syncPledgeOptionState() {
    if (!form) return;
    var labels = form.querySelectorAll('.pledge-option');
    Array.prototype.forEach.call(labels, function (label) {
      var input = label.querySelector('input[name="pledge"]');
      label.classList.toggle('is-checked', !!(input && input.checked));
    });
  }

  if (form) {
    try {
      var saved = JSON.parse(window.localStorage.getItem(PLEDGE_KEY));
      if (saved && saved.options && saved.options.length) {
        renderResult(saved);
        if (nameInput && saved.name) nameInput.value = saved.name;
        saved.options.forEach(function (key) {
          var box = form.querySelector('input[name="pledge"][value="' + key + '"]');
          if (box) box.checked = true;
        });
      }
    } catch (err) {
      /* 忽略 */
    }

    Array.prototype.forEach.call(
      form.querySelectorAll('.pledge-option input[name="pledge"]'),
      function (input) {
        input.addEventListener("change", syncPledgeOptionState);
      }
    );
    syncPledgeOptionState();

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var checked = Array.prototype.slice.call(
        form.querySelectorAll('input[name="pledge"]:checked')
      ).map(function (input) { return input.value; });

      if (!checked.length) {
        if (error) error.hidden = false;
        var firstBox = form.querySelector('input[name="pledge"]');
        if (firstBox) firstBox.focus();
        return;
      }
      if (error) error.hidden = true;

      var data = {
        name: nameInput ? nameInput.value.trim().slice(0, 16) : "",
        options: checked,
        savedAt: new Date().getTime()
      };
      try {
        window.localStorage.setItem(PLEDGE_KEY, JSON.stringify(data));
      } catch (err) {
        /* 存储不可用时仍然显示结果 */
      }
      renderResult(data);
      window.sxlToast("接力已记下。愿你在田野里，遇见自己的星火。");
      if (result) {
        var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        result.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
      }
    });
  }
})();
