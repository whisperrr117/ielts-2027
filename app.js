/* IELTS 2027 Personal Prep Manager */
(function () {
  "use strict";

  const STORAGE_KEY = "ielts2027_v1";
  const PHASES = [
    { id: 1, name: "英语重启期", start: "2026-09-22", end: "2026-10-31", focus: "恢复语感与听说，建立习惯。能力 70% / 雅思 30%。" },
    { id: 2, name: "基础＋雅思入门期", start: "2026-11-01", end: "2026-12-31", focus: "系统训练四科，Writing 每周至少一次。能力 40% / 雅思 60%。" },
    { id: 3, name: "系统提高期", start: "2027-01-01", end: "2027-03-31", focus: "真题＋精听限时，Speaking 每周 2–3 次，Writing 每周 1–2 次。" },
    { id: 4, name: "6.5 冲刺期", start: "2027-04-01", end: "2027-05-31", focus: "真题、限时、模考、错题。关注拖累 Overall 的科目。" },
    { id: 5, name: "考试冲刺期", start: "2027-06-01", end: "2027-07-31", focus: "完整模考、弱项强化、稳定发挥，不盲目加量。" },
  ];

  const WORKDAY_CYCLE = ["A", "B", "C", "A", "B", "D", "C"];
  const WORKDAY_DEFS = {
    A: {
      key: "Listening",
      title: "Listening Day",
      icon: "🎧",
      full: { mins: 30, desc: "英语听力输入 + 简单复述 / IELTS Listening" },
      light: { mins: 15, desc: "轻松听一段英语内容" },
      min: { mins: 10, desc: "听 10 分钟英语，保持接触" },
    },
    B: {
      key: "Speaking",
      title: "Speaking Day",
      icon: "🗣",
      full: { mins: 30, desc: "与 ChatGPT 对话 / IELTS Speaking / 复述纠正" },
      light: { mins: 15, desc: "简短口语练习 15 分钟" },
      min: { mins: 10, desc: "说几句英语即可" },
    },
    C: {
      key: "Reading",
      title: "Reading Day",
      icon: "📖",
      full: { mins: 30, desc: "英语文章 / IELTS Reading：定位与主旨" },
      light: { mins: 15, desc: "读一篇短文" },
      min: { mins: 10, desc: "浏览英文内容 10 分钟" },
    },
    D: {
      key: "Light",
      title: "Light Day",
      icon: "🌿",
      full: { mins: 20, desc: "听英语或看英文内容，不做题也行" },
      light: { mins: 12, desc: "轻松接触英语" },
      min: { mins: 10, desc: "10 分钟保底接触" },
    },
  };

  const REST_MODULES = [
    {
      key: "Listening",
      icon: "🎧",
      full: { mins: 45, desc: "IELTS Listening 真题 / 精听 / 错题复盘" },
      light: { mins: 25, desc: "听力练习 + 简要复盘" },
      min: { mins: 15, desc: "听一段并标记难点" },
    },
    {
      key: "Reading",
      icon: "📖",
      full: { mins: 45, desc: "IELTS Reading 真题 / 限时 / 错题分析" },
      light: { mins: 25, desc: "一篇阅读 + 核对" },
      min: { mins: 15, desc: "短文阅读理解" },
    },
    {
      key: "Speaking",
      icon: "🗣",
      full: { mins: 35, desc: "Part 1–3 / ChatGPT 对话 / 生活话题" },
      light: { mins: 20, desc: "Part 1 或自由对话" },
      min: { mins: 10, desc: "说几分钟英语" },
    },
    {
      key: "Writing",
      icon: "✍️",
      full: { mins: 40, desc: "Task 1 或 Task 2 完整写作 + 结构" },
      light: { mins: 20, desc: "写一段 Introduction / Body" },
      min: { mins: 10, desc: "列提纲或改一句" },
    },
  ];

  const SPEAK_TOPICS = [
    "Work", "Daily routine", "Travel", "Stress", "Technology",
    "Food", "Future plans", "Relationships", "IELTS Part 1",
    "IELTS Part 2", "IELTS Part 3", "Hometown", "Hobbies", "Education",
  ];

  const EXPR_CATS = ["All", "Work", "Emotion", "Daily Life", "Relationship", "Travel", "Opinion", "IELTS"];
  const FAMILIARITY = ["陌生", "见过", "熟悉", "能主动使用"];
  const ERR_TYPES = ["Grammar", "Vocabulary", "Collocation", "Logic", "Coherence", "Sentence structure"];
  const MOODS = [
    { v: "tired", l: "😫 很累" },
    { v: "ok", l: "😐 普通" },
    { v: "normal", l: "🙂 正常" },
    { v: "great", l: "🔥 状态很好" },
  ];

  function todayStr(d = new Date()) {
    const x = new Date(d);
    const y = x.getFullYear();
    const m = String(x.getMonth() + 1).padStart(2, "0");
    const day = String(x.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function parseDate(s) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function daysBetween(a, b) {
    const ms = parseDate(b) - parseDate(a);
    return Math.round(ms / 86400000);
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function defaultData() {
    return {
      settings: {
        startDate: "2026-09-22",
        examDate: "2027-07-15",
        target: 6.5,
        stretch: 7.0,
        workdayTargetMin: 30,
        restDayTargetMin: 120,
        monthlyHourGoal: 25,
      },
      schedule: {}, // "YYYY-MM-DD": "work" | "rest"
      dayModes: {}, // override for today display
      workdayIndex: 0,
      taskTier: {}, // date -> "full"|"light"|"min"
      dayTasks: {}, // date -> [{id,key,title,...}]
      completedTaskIds: {}, // date -> [ids]
      skippedDays: {}, // date -> true
      logs: [],
      mocks: [],
      baseline: null,
      expressions: [],
      vocab: [],
      writingErrors: [],
      writings: [],
      resources: [],
      reviews: {}, // "YYYY-MM" -> note
      achievements: [],
    };
  }

  let state = load();

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultData();
      const parsed = JSON.parse(raw);
      return Object.assign(defaultData(), parsed, {
        settings: Object.assign(defaultData().settings, parsed.settings || {}),
      });
    } catch (e) {
      return defaultData();
    }
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function toast(msg) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove("show"), 2200);
  }

  /* ---------- Phase & schedule ---------- */
  function getPhase(dateStr = todayStr()) {
    for (const p of PHASES) {
      if (dateStr >= p.start && dateStr <= p.end) return p;
    }
    if (dateStr < PHASES[0].start) return PHASES[0];
    return PHASES[PHASES.length - 1];
  }

  function isRestDay(dateStr) {
    if (state.schedule[dateStr] === "rest") return true;
    if (state.schedule[dateStr] === "work") return false;
    // default: weekdays work, but user should set schedule; fallback treat as work
    return false;
  }

  function getDayMode(dateStr = todayStr()) {
    if (state.dayModes[dateStr]) return state.dayModes[dateStr];
    return isRestDay(dateStr) ? "rest" : "work";
  }

  function setDayMode(mode, dateStr = todayStr()) {
    state.dayModes[dateStr] = mode;
    if (mode === "rest") state.schedule[dateStr] = "rest";
    else state.schedule[dateStr] = "work";
    // regenerate tasks for day
    delete state.dayTasks[dateStr];
    delete state.taskTier[dateStr];
    save();
  }

  function getTier(dateStr = todayStr()) {
    return state.taskTier[dateStr] || "full";
  }

  function setTier(tier, dateStr = todayStr()) {
    const order = ["full", "light", "min"];
    const cur = getTier(dateStr);
    let next = tier;
    if (tier === "downgrade") {
      const i = order.indexOf(cur);
      next = order[Math.min(i + 1, order.length - 1)];
    }
    state.taskTier[dateStr] = next;
    // refresh task minutes/desc
    ensureTasks(dateStr, true);
    save();
    return next;
  }

  function weakSubjects() {
    if (!state.mocks.length && !state.baseline) return [];
    const last = state.mocks.length
      ? state.mocks[state.mocks.length - 1]
      : state.baseline;
    if (!last) return [];
    const scores = [
      { k: "Listening", v: last.L },
      { k: "Reading", v: last.R },
      { k: "Writing", v: last.W },
      { k: "Speaking", v: last.S },
    ].filter((x) => x.v != null);
    scores.sort((a, b) => a.v - b.v);
    return scores.map((x) => x.k);
  }

  function ensureTasks(dateStr = todayStr(), force = false) {
    if (state.dayTasks[dateStr] && !force) return state.dayTasks[dateStr];
    const mode = getDayMode(dateStr);
    const tier = getTier(dateStr);
    let tasks = [];

    if (mode === "work") {
      // advance cycle only when first creating for a work day that isn't skipped
      let idx = state.workdayIndex % WORKDAY_CYCLE.length;
      // Use stored cycle letter if regenerating same day with existing meta
      const letter = WORKDAY_CYCLE[idx];
      const def = WORKDAY_DEFS[letter];
      const t = def[tier] || def.full;
      tasks = [
        {
          id: uid(),
          letter,
          key: def.key,
          title: `${def.icon} ${def.title}`,
          mins: t.mins,
          desc: t.desc,
          tier,
        },
      ];
      if (!state.dayTasks[dateStr]) {
        // only bump index when first assigning
        state.workdayIndex = (state.workdayIndex + 1) % WORKDAY_CYCLE.length;
      }
    } else {
      // rest day: prioritize weak subjects
      const weak = weakSubjects();
      let mods = REST_MODULES.slice();
      if (weak.length) {
        mods.sort((a, b) => {
          const ia = weak.indexOf(a.key);
          const ib = weak.indexOf(b.key);
          return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
        });
      }
      // phase 1: lower writing weight
      const phase = getPhase(dateStr);
      if (phase.id === 1) {
        mods = mods.filter((m) => m.key !== "Writing").concat(mods.filter((m) => m.key === "Writing"));
        // only 3 modules on rest in phase 1 optionally show writing as optional light
      }
      tasks = mods.map((m) => {
        const t = m[tier] || m.full;
        return {
          id: uid(),
          key: m.key,
          title: `${m.icon} ${m.key}`,
          mins: t.mins,
          desc: t.desc,
          tier,
        };
      });
    }

    state.dayTasks[dateStr] = tasks;
    save();
    return tasks;
  }

  /* ---------- Connection ---------- */
  function lastContactDays() {
    const dates = new Set();
    state.logs.forEach((l) => {
      if (l.completed !== false) dates.add(l.date);
    });
    Object.keys(state.completedTaskIds).forEach((d) => {
      if ((state.completedTaskIds[d] || []).length) dates.add(d);
    });
    if (!dates.size) return null;
    const sorted = [...dates].sort();
    const last = sorted[sorted.length - 1];
    return daysBetween(last, todayStr());
  }

  /* ---------- UI helpers ---------- */
  function showPage(name) {
    document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
    const page = document.getElementById("page-" + name);
    if (page) page.classList.add("active");
    document.querySelectorAll(".nav-item").forEach((n) => {
      n.classList.toggle("active", n.dataset.page === name);
    });
    document.querySelectorAll("#desktopNav .btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.page === name);
    });
    if (name === "home") renderHome();
    if (name === "schedule") renderCalendar();
    if (name === "log") renderLogs();
    if (name === "scores") renderScores();
    if (name === "bank") renderBank();
    if (name === "settings") renderSettings();
    window.scrollTo(0, 0);
  }

  function openModal(title, bodyHtml, onMount) {
    const root = document.getElementById("modalRoot");
    root.innerHTML = `
      <div class="modal-backdrop" id="modalBg">
        <div class="modal">
          <div class="modal-head">
            <h3>${title}</h3>
            <button type="button" class="modal-close" id="modalClose">×</button>
          </div>
          <div id="modalBody">${bodyHtml}</div>
        </div>
      </div>`;
    const close = () => { root.innerHTML = ""; };
    document.getElementById("modalClose").onclick = close;
    document.getElementById("modalBg").addEventListener("click", (e) => {
      if (e.target.id === "modalBg") close();
    });
    if (onMount) onMount(close);
  }

  /* ---------- Home ---------- */
  function renderHome() {
    const t = todayStr();
    const exam = state.settings.examDate;
    const left = daysBetween(t, exam);
    document.getElementById("daysLeft").textContent = left >= 0 ? left : 0;

    const phase = getPhase(t);
    document.getElementById("phasePill").textContent = `第 ${phase.id} 阶段｜${phase.name}`;

    const mode = getDayMode(t);
    const btnW = document.getElementById("btnWork");
    const btnR = document.getElementById("btnRest");
    btnW.classList.toggle("active-work", mode === "work");
    btnR.classList.toggle("active-rest", mode === "rest");
    document.getElementById("modeHint").textContent =
      mode === "work"
        ? "工作日模式：维持英语不断线。可随时降档到 15 或 10 分钟。"
        : "休息日模式：真正推进四科。不必全部完成，按状态选择。";

    // tasks
    const skipped = state.skippedDays[t];
    const box = document.getElementById("todayTasks");
    if (skipped) {
      box.innerHTML = `<p class="hint-text">今天选择休息，不学习。尽量不要连续 3 天完全不接触英语。</p>`;
    } else {
      const tasks = ensureTasks(t);
      const done = new Set(state.completedTaskIds[t] || []);
      const tier = getTier(t);
      box.innerHTML = tasks
        .map((task) => {
          const isDone = done.has(task.id);
          return `
          <div class="task ${isDone ? "done" : ""}" data-id="${task.id}">
            <div class="task-head">
              <div>
                <div class="task-title">${task.title}</div>
                <div class="task-meta">${task.mins} 分钟 · ${task.desc}</div>
              </div>
              <span class="tier-badge tier-${tier}">${tier === "full" ? "完整" : tier === "light" ? "轻量" : "保底"}</span>
            </div>
            ${
              isDone
                ? `<div class="task-actions"><span class="hint-text">已完成</span></div>`
                : `<div class="task-actions">
                    <button type="button" class="btn btn-success btn-sm btn-done" data-id="${task.id}">完成</button>
                    <button type="button" class="btn btn-sm btn-soft btn-partial" data-id="${task.id}">记一笔</button>
                  </div>`
            }
          </div>`;
        })
        .join("");
      box.querySelectorAll(".btn-done").forEach((b) => {
        b.onclick = () => completeTask(b.dataset.id);
      });
      box.querySelectorAll(".btn-partial").forEach((b) => {
        b.onclick = () => openLogModal(b.dataset.id);
      });
    }

    // connection
    const days = lastContactDays();
    const dot = document.getElementById("connDot");
    const ct = document.getElementById("connText");
    dot.className = "conn-dot";
    if (days === null) {
      ct.textContent = "还没有学习记录。今天做一个 10 分钟保底任务即可开始。";
    } else if (days <= 1) {
      ct.textContent = days === 0 ? "今天已接触英语，很好。" : "最近一次接触英语：1 天前。状态正常。";
    } else if (days === 2) {
      dot.classList.add("warn");
      ct.textContent = "最近一次接触英语：2 天前。今天哪怕 10 分钟也好。";
    } else {
      dot.classList.add("alert");
      ct.textContent = `最近一次接触英语：${days} 天前。今天做一个 10 分钟保底任务即可，不必补课。`;
    }

    // month stats
    const ym = t.slice(0, 7);
    const monthLogs = state.logs.filter((l) => l.date.startsWith(ym) && l.completed !== false);
    const mins = monthLogs.reduce((s, l) => s + (Number(l.minutes) || 0), 0);
    const hours = (mins / 60).toFixed(1);
    document.getElementById("monthHours").textContent = hours + " h";
    document.getElementById("monthTasks").textContent = String(monthLogs.length);
    const goal = state.settings.monthlyHourGoal || 25;
    const pct = Math.min(100, (mins / 60 / goal) * 100);
    document.getElementById("monthBar").style.width = pct + "%";
    document.getElementById("monthHint").textContent = `本月目标约 ${goal} 小时（仅作参考，不是考核）`;

    // scores
    const latest = state.mocks.length
      ? state.mocks[state.mocks.length - 1]
      : state.baseline;
    const grid = document.getElementById("scoreGrid");
    ["L", "R", "W", "S"].forEach((k, i) => {
      const cell = grid.children[i];
      cell.querySelector(".v").textContent = latest && latest[k] != null ? latest[k] : "—";
    });

    // baseline delta
    const deltaEl = document.getElementById("baselineDelta");
    if (state.baseline && latest && latest !== state.baseline) {
      const fmt = (a, b) => {
        if (a == null || b == null) return "—";
        const d = +(b - a).toFixed(1);
        if (d > 0) return `<span class="delta-pos">+${d}</span>`;
        if (d < 0) return `<span class="delta-neu">${d}</span>`;
        return `<span class="delta-neu">0</span>`;
      };
      deltaEl.innerHTML = `从第一次测评以来：Listening ${fmt(state.baseline.L, latest.L)} · Reading ${fmt(state.baseline.R, latest.R)} · Writing ${fmt(state.baseline.W, latest.W)} · Speaking ${fmt(state.baseline.S, latest.S)}`;
    } else if (state.baseline) {
      deltaEl.textContent = "已记录起点。完成下一次模考后会显示进步。";
    } else {
      deltaEl.textContent = "建议在重启期完成一次完整模考，作为「我的起点」。";
    }

    // week
    let contact = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = todayStr(d);
      const has =
        (state.completedTaskIds[ds] || []).length > 0 ||
        state.logs.some((l) => l.date === ds && l.completed !== false);
      if (has) contact++;
    }
    document.getElementById("weekSummary").textContent = `最近 7 天接触英语 ${contact} 天。不强调连续打卡，重要的是别断太久。`;
  }

  function completeTask(taskId) {
    const t = todayStr();
    const tasks = state.dayTasks[t] || [];
    const task = tasks.find((x) => x.id === taskId);
    if (!task) return;
    if (!state.completedTaskIds[t]) state.completedTaskIds[t] = [];
    if (!state.completedTaskIds[t].includes(taskId)) {
      state.completedTaskIds[t].push(taskId);
    }
    state.logs.push({
      id: uid(),
      date: t,
      type: task.key === "Light" ? "Other" : task.key,
      minutes: task.mins,
      completed: true,
      content: task.title + " · " + task.desc,
      difficulty: "",
      mood: "normal",
      note: "",
      tier: task.tier,
    });
    delete state.skippedDays[t];
    save();
    toast("已完成 · 今天这样就很好");
    renderHome();
  }

  function openLogModal(taskId) {
    const t = todayStr();
    const task = (state.dayTasks[t] || []).find((x) => x.id === taskId);
    openModal(
      "记录学习",
      `
      <div class="field"><label>类型</label>
        <select id="mType">
          <option>Listening</option><option>Reading</option><option>Speaking</option><option>Writing</option><option>Other</option>
        </select>
      </div>
      <div class="field"><label>分钟</label><input type="number" id="mMins" value="${task ? task.mins : 20}" min="1" /></div>
      <div class="field"><label>内容</label><input type="text" id="mContent" value="${task ? task.title : ""}" /></div>
      <div class="field"><label>今天状态</label>
        <select id="mMood">${MOODS.map((m) => `<option value="${m.v}">${m.l}</option>`).join("")}</select>
      </div>
      <div class="field"><label>备注</label><textarea id="mNote"></textarea></div>
      <button type="button" class="btn btn-primary btn-block" id="mSave">保存</button>
      `,
      (close) => {
        if (task) {
          const sel = document.getElementById("mType");
          const k = task.key === "Light" ? "Other" : task.key;
          sel.value = k;
        }
        document.getElementById("mSave").onclick = () => {
          const entry = {
            id: uid(),
            date: t,
            type: document.getElementById("mType").value,
            minutes: Number(document.getElementById("mMins").value) || 0,
            completed: true,
            content: document.getElementById("mContent").value,
            difficulty: "",
            mood: document.getElementById("mMood").value,
            note: document.getElementById("mNote").value,
            tier: getTier(t),
          };
          state.logs.push(entry);
          if (task) {
            if (!state.completedTaskIds[t]) state.completedTaskIds[t] = [];
            if (!state.completedTaskIds[t].includes(task.id)) {
              state.completedTaskIds[t].push(task.id);
            }
          }
          delete state.skippedDays[t];
          save();
          close();
          toast("已记录");
          renderHome();
        };
      }
    );
  }

  /* ---------- Calendar ---------- */
  let calCursor = new Date();

  function renderCalendar() {
    const y = calCursor.getFullYear();
    const m = calCursor.getMonth();
    document.getElementById("calTitle").textContent = `${y} 年 ${m + 1} 月`;

    const dows = ["日", "一", "二", "三", "四", "五", "六"];
    document.getElementById("calDows").innerHTML = dows
      .map((d) => `<div class="cal-dow">${d}</div>`)
      .join("");

    const first = new Date(y, m, 1);
    const startDow = first.getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const prevDays = new Date(y, m, 0).getDate();
    const cells = [];
    for (let i = 0; i < startDow; i++) {
      cells.push({ day: prevDays - startDow + 1 + i, other: true, date: null });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      cells.push({ day: d, other: false, date: ds });
    }
    let nextDay = 1;
    while (cells.length % 7 !== 0) {
      cells.push({ day: nextDay++, other: true, date: null });
    }

    const today = todayStr();
    document.getElementById("calDays").innerHTML = cells
      .map((c) => {
        if (c.other || !c.date) return `<button type="button" class="cal-day other" disabled>${c.day}</button>`;
        const rest = state.schedule[c.date] === "rest";
        const cls = [
          "cal-day",
          rest ? "rest" : state.schedule[c.date] === "work" ? "work-marked" : "",
          c.date === today ? "today" : "",
        ]
          .filter(Boolean)
          .join(" ");
        return `<button type="button" class="${cls}" data-date="${c.date}">${c.day}</button>`;
      })
      .join("");

    document.querySelectorAll("#calDays .cal-day[data-date]").forEach((btn) => {
      btn.onclick = () => {
        const d = btn.dataset.date;
        const cur = state.schedule[d];
        if (cur === "rest") state.schedule[d] = "work";
        else state.schedule[d] = "rest";
        // sync day mode if today
        if (d === todayStr()) {
          state.dayModes[d] = state.schedule[d] === "rest" ? "rest" : "work";
          delete state.dayTasks[d];
        }
        save();
        renderCalendar();
      };
    });
  }

  /* ---------- Logs ---------- */
  function renderLogs() {
    const filter = document.getElementById("logFilter").value;
    let logs = state.logs.slice().reverse();
    if (filter !== "all") logs = logs.filter((l) => l.type === filter);
    const list = document.getElementById("logList");
    if (!logs.length) {
      list.innerHTML = `<div class="empty">还没有学习记录</div>`;
      return;
    }
    list.innerHTML = logs
      .map((l) => {
        const mood = MOODS.find((m) => m.v === l.mood);
        return `
        <div class="list-item">
          <div class="main">
            <div class="title">${l.type} · ${l.minutes || 0} 分钟</div>
            <div class="sub">${l.date}${mood ? " · " + mood.l : ""}${l.content ? " · " + l.content : ""}</div>
            ${l.note ? `<div class="sub">${l.note}</div>` : ""}
          </div>
          <button type="button" class="btn btn-sm btn-soft btn-del-log" data-id="${l.id}">删</button>
        </div>`;
      })
      .join("");
    list.querySelectorAll(".btn-del-log").forEach((b) => {
      b.onclick = () => {
        state.logs = state.logs.filter((x) => x.id !== b.dataset.id);
        save();
        renderLogs();
        toast("已删除");
      };
    });
  }

  /* ---------- Scores ---------- */
  function renderScores() {
    const box = document.getElementById("baselineBox");
    if (state.baseline) {
      const b = state.baseline;
      box.innerHTML = `
        <div><strong>${b.date}</strong> · Overall ${b.overall ?? "—"}</div>
        <div style="margin-top:6px">L ${b.L ?? "—"} · R ${b.R ?? "—"} · W ${b.W ?? "—"} · S ${b.S ?? "—"}</div>
        ${b.feeling ? `<div style="margin-top:6px">感受：${b.feeling}</div>` : ""}
        ${b.problem ? `<div style="margin-top:4px">最大问题：${b.problem}</div>` : ""}
      `;
    } else {
      box.innerHTML = `尚未记录第一次完整模考。<button type="button" class="btn btn-sm" style="margin-top:8px" id="btnSetBaseline">现在记录起点</button>`;
      const btn = document.getElementById("btnSetBaseline");
      if (btn) btn.onclick = () => openBaselineModal();
    }

    const list = document.getElementById("mockList");
    if (!state.mocks.length) {
      list.innerHTML = `<div class="empty">暂无模考记录</div>`;
    } else {
      list.innerHTML = state.mocks
        .slice()
        .reverse()
        .map(
          (m) => `
        <div class="list-item">
          <div class="main">
            <div class="title">${m.date} · Overall ${m.overall ?? "—"}</div>
            <div class="sub">L ${m.L ?? "—"} · R ${m.R ?? "—"} · W ${m.W ?? "—"} · S ${m.S ?? "—"}</div>
            ${m.note ? `<div class="sub">${m.note}</div>` : ""}
          </div>
          <button type="button" class="btn btn-sm btn-soft btn-del-mock" data-id="${m.id}">删</button>
        </div>`
        )
        .join("");
      list.querySelectorAll(".btn-del-mock").forEach((b) => {
        b.onclick = () => {
          state.mocks = state.mocks.filter((x) => x.id !== b.dataset.id);
          save();
          renderScores();
        };
      });
    }

    drawScoreChart();
    renderAdvice();
  }

  function openBaselineModal() {
    const b = state.baseline || {};
    openModal(
      "我的起点 · Baseline",
      `
      <div class="field"><label>日期</label><input type="date" id="bDate" value="${b.date || todayStr()}" /></div>
      <div class="split-2">
        <div class="field"><label>Listening</label><input type="number" id="bL" step="0.5" min="0" max="9" value="${b.L ?? ""}" /></div>
        <div class="field"><label>Reading</label><input type="number" id="bR" step="0.5" min="0" max="9" value="${b.R ?? ""}" /></div>
        <div class="field"><label>Writing</label><input type="number" id="bW" step="0.5" min="0" max="9" value="${b.W ?? ""}" /></div>
        <div class="field"><label>Speaking</label><input type="number" id="bS" step="0.5" min="0" max="9" value="${b.S ?? ""}" /></div>
      </div>
      <div class="field"><label>Overall（可留空自动估算）</label><input type="number" id="bO" step="0.5" min="0" max="9" value="${b.overall ?? ""}" /></div>
      <div class="field"><label>当时感受</label><textarea id="bFeel">${b.feeling || ""}</textarea></div>
      <div class="field"><label>最大问题</label><textarea id="bProb">${b.problem || ""}</textarea></div>
      <button type="button" class="btn btn-primary btn-block" id="bSave">保存起点</button>
      `,
      (close) => {
        document.getElementById("bSave").onclick = () => {
          const L = numOrNull("bL"),
            R = numOrNull("bR"),
            W = numOrNull("bW"),
            S = numOrNull("bS");
          let overall = numOrNull("bO");
          if (overall == null && [L, R, W, S].every((x) => x != null)) {
            overall = Math.round(((L + R + W + S) / 4) * 2) / 2;
          }
          state.baseline = {
            date: document.getElementById("bDate").value,
            L, R, W, S,
            overall,
            feeling: document.getElementById("bFeel").value,
            problem: document.getElementById("bProb").value,
          };
          save();
          close();
          toast("起点已保存");
          renderScores();
          renderHome();
        };
      }
    );
  }

  function numOrNull(id) {
    const v = document.getElementById(id).value;
    if (v === "" || v == null) return null;
    return Number(v);
  }

  function openMockModal() {
    openModal(
      "添加模考成绩",
      `
      <div class="field"><label>日期</label><input type="date" id="mkDate" value="${todayStr()}" /></div>
      <div class="split-2">
        <div class="field"><label>Listening</label><input type="number" id="mkL" step="0.5" min="0" max="9" /></div>
        <div class="field"><label>Reading</label><input type="number" id="mkR" step="0.5" min="0" max="9" /></div>
        <div class="field"><label>Writing</label><input type="number" id="mkW" step="0.5" min="0" max="9" /></div>
        <div class="field"><label>Speaking</label><input type="number" id="mkS" step="0.5" min="0" max="9" /></div>
      </div>
      <div class="field"><label>Overall</label><input type="number" id="mkO" step="0.5" min="0" max="9" /></div>
      <div class="field"><label>备注</label><textarea id="mkNote"></textarea></div>
      <button type="button" class="btn btn-primary btn-block" id="mkSave">保存</button>
      `,
      (close) => {
        document.getElementById("mkSave").onclick = () => {
          const L = numOrNull("mkL"),
            R = numOrNull("mkR"),
            W = numOrNull("mkW"),
            S = numOrNull("mkS");
          let overall = numOrNull("mkO");
          if (overall == null && [L, R, W, S].every((x) => x != null)) {
            overall = Math.round(((L + R + W + S) / 4) * 2) / 2;
          }
          state.mocks.push({
            id: uid(),
            date: document.getElementById("mkDate").value,
            L, R, W, S,
            overall,
            note: document.getElementById("mkNote").value,
          });
          state.mocks.sort((a, b) => a.date.localeCompare(b.date));
          save();
          close();
          toast("模考已记录");
          renderScores();
          renderHome();
        };
      }
    );
  }

  const chartSeries = { L: true, R: true, W: true, S: true };

  function drawScoreChart() {
    const canvas = document.getElementById("scoreChart");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const points = [];
    if (state.baseline) {
      points.push({
        date: state.baseline.date,
        L: state.baseline.L,
        R: state.baseline.R,
        W: state.baseline.W,
        S: state.baseline.S,
        label: "起点",
      });
    }
    state.mocks.forEach((m) => points.push(m));
    if (points.length < 1) {
      ctx.fillStyle = "#8b9bb4";
      ctx.font = "13px sans-serif";
      ctx.fillText("录入模考后显示趋势", 12, h / 2);
      return;
    }

    const pad = { l: 28, r: 10, t: 12, b: 28 };
    const colors = { L: "#5b9fd4", R: "#6ecb9a", W: "#c9a227", S: "#c47ad4" };
    const keys = ["L", "R", "W", "S"].filter((k) => chartSeries[k]);

    ctx.strokeStyle = "#2d3a4f";
    ctx.lineWidth = 1;
    for (let s = 4; s <= 9; s++) {
      const y = pad.t + ((9 - s) / 5) * (h - pad.t - pad.b);
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(w - pad.r, y);
      ctx.stroke();
      ctx.fillStyle = "#8b9bb4";
      ctx.font = "10px sans-serif";
      ctx.fillText(String(s), 4, y + 3);
    }

    const n = points.length;
    keys.forEach((k) => {
      ctx.strokeStyle = colors[k];
      ctx.lineWidth = 2;
      ctx.beginPath();
      let started = false;
      points.forEach((p, i) => {
        if (p[k] == null) return;
        const x = pad.l + (n === 1 ? (w - pad.l - pad.r) / 2 : (i / (n - 1)) * (w - pad.l - pad.r));
        const y = pad.t + ((9 - p[k]) / 5) * (h - pad.t - pad.b);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else ctx.lineTo(x, y);
      });
      ctx.stroke();
      points.forEach((p, i) => {
        if (p[k] == null) return;
        const x = pad.l + (n === 1 ? (w - pad.l - pad.r) / 2 : (i / (n - 1)) * (w - pad.l - pad.r));
        const y = pad.t + ((9 - p[k]) / 5) * (h - pad.t - pad.b);
        ctx.fillStyle = colors[k];
        ctx.beginPath();
        ctx.arc(x, y, 3.5, 0, Math.PI * 2);
        ctx.fill();
      });
    });

    // x labels
    ctx.fillStyle = "#8b9bb4";
    ctx.font = "10px sans-serif";
    points.forEach((p, i) => {
      if (n > 6 && i % Math.ceil(n / 5) !== 0 && i !== n - 1) return;
      const x = pad.l + (n === 1 ? (w - pad.l - pad.r) / 2 : (i / (n - 1)) * (w - pad.l - pad.r));
      const label = (p.date || "").slice(5);
      ctx.fillText(label, x - 12, h - 8);
    });
  }

  function renderAdvice() {
    const el = document.getElementById("scoreAdvice");
    const last = state.mocks.length
      ? state.mocks[state.mocks.length - 1]
      : state.baseline;
    if (!last) {
      el.textContent = "完成几次模考后，这里会给出温和建议。";
      return;
    }
    const parts = [];
    const target = state.settings.target || 6.5;
    const weak = weakSubjects();
    if (weak.length) {
      parts.push(`目前相对薄弱：${weak.slice(0, 2).join("、")}。休息日可适当增加比重（仅建议，不强制）。`);
    }
    if (last.W != null && last.W <= 5.5 && last.L >= 6.5) {
      parts.push("Listening 已不错，可减少阅读听力重复时间，把更多精力给 Writing。");
    }
    // speaking frequency
    const month = todayStr().slice(0, 7);
    const speakLogs = state.logs.filter((l) => l.date.startsWith(month) && l.type === "Speaking");
    if (speakLogs.length < 2) {
      parts.push("本月 Speaking 训练偏少，下一次工作日可优先安排口语。");
    }
    if (!parts.length) {
      parts.push(`继续保持趋势即可。目标 Overall ${target}，关注长期进步，不看单次波动。`);
    }
    el.textContent = parts.join(" ");
  }

  /* ---------- Bank ---------- */
  let bankTab = "expr";
  let exprCat = "All";

  function renderBank() {
    document.querySelectorAll("#bankTabs .tag").forEach((t) => {
      t.classList.toggle("active", t.dataset.tab === bankTab);
    });
    ["expr", "vocab", "writing", "resources", "speak", "review"].forEach((id) => {
      const el = document.getElementById("bank-" + id);
      if (el) el.style.display = bankTab === id ? "block" : "none";
    });
    if (bankTab === "expr") renderExpr();
    if (bankTab === "vocab") renderVocab();
    if (bankTab === "writing") renderWriting();
    if (bankTab === "resources") renderResources();
    if (bankTab === "speak") renderSpeak();
    if (bankTab === "review") renderReview();
  }

  function renderExpr() {
    const cats = document.getElementById("exprCats");
    cats.innerHTML = EXPR_CATS.map(
      (c) => `<span class="tag ${exprCat === c ? "active" : ""}" data-c="${c}">${c}</span>`
    ).join("");
    cats.querySelectorAll(".tag").forEach((t) => {
      t.onclick = () => {
        exprCat = t.dataset.c;
        renderExpr();
      };
    });
    let items = state.expressions.slice().reverse();
    if (exprCat !== "All") items = items.filter((x) => x.category === exprCat);
    const list = document.getElementById("exprList");
    if (!items.length) {
      list.innerHTML = `<div class="empty">把「想说却不会说的」记在这里</div>`;
      return;
    }
    list.innerHTML = items
      .map(
        (e) => `
      <div class="list-item">
        <div class="main">
          <div class="title">${e.zh}</div>
          <div class="sub">我的：${e.mine || "—"}</div>
          <div class="sub">更自然：${e.natural || "—"}</div>
          <div class="sub">${e.category || ""} · ${e.date || ""}${e.keywords ? " · " + e.keywords : ""}</div>
        </div>
        <button type="button" class="btn btn-sm btn-soft" data-id="${e.id}">删</button>
      </div>`
      )
      .join("");
    list.querySelectorAll("button[data-id]").forEach((b) => {
      b.onclick = () => {
        state.expressions = state.expressions.filter((x) => x.id !== b.dataset.id);
        save();
        renderExpr();
      };
    });
  }

  function openExprModal() {
    openModal(
      "表达库",
      `
      <div class="field"><label>中文原意</label><textarea id="eZh" placeholder="我今天真的被工作搞得很烦。"></textarea></div>
      <div class="field"><label>我的原始英文</label><input type="text" id="eMine" placeholder="I am very annoyed by my work today." /></div>
      <div class="field"><label>更自然的英文</label><input type="text" id="eNat" placeholder="Work really frustrated me today." /></div>
      <div class="field"><label>关键词 / 句型</label><input type="text" id="eKey" /></div>
      <div class="field"><label>分类</label>
        <select id="eCat">${EXPR_CATS.filter((c) => c !== "All")
          .map((c) => `<option>${c}</option>`)
          .join("")}</select>
      </div>
      <button type="button" class="btn btn-primary btn-block" id="eSave">保存</button>
      `,
      (close) => {
        document.getElementById("eSave").onclick = () => {
          const zh = document.getElementById("eZh").value.trim();
          if (!zh) return toast("请填写中文原意");
          state.expressions.push({
            id: uid(),
            zh,
            mine: document.getElementById("eMine").value,
            natural: document.getElementById("eNat").value,
            keywords: document.getElementById("eKey").value,
            category: document.getElementById("eCat").value,
            date: todayStr(),
          });
          save();
          close();
          toast("已加入表达库");
          renderExpr();
        };
      }
    );
  }

  function renderVocab() {
    const list = document.getElementById("vocabList");
    if (!state.vocab.length) {
      list.innerHTML = `<div class="empty">词汇表为空</div>`;
      return;
    }
    list.innerHTML = state.vocab
      .slice()
      .reverse()
      .map(
        (v) => `
      <div class="list-item">
        <div class="main">
          <div class="title">${v.word} <span class="sub">${v.pos || ""}</span></div>
          <div class="sub">${v.meaning || ""}</div>
          ${v.example ? `<div class="sub">例：${v.example}</div>` : ""}
          ${v.mine ? `<div class="sub">我的句子：${v.mine}</div>` : ""}
          <div class="sub">${v.topic || ""} · ${FAMILIARITY[v.familiarity] || ""} · ${v.date || ""}</div>
        </div>
        <button type="button" class="btn btn-sm btn-soft" data-id="${v.id}">删</button>
      </div>`
      )
      .join("");
    list.querySelectorAll("button[data-id]").forEach((b) => {
      b.onclick = () => {
        state.vocab = state.vocab.filter((x) => x.id !== b.dataset.id);
        save();
        renderVocab();
      };
    });
  }

  function openVocabModal() {
    openModal(
      "新词 / 表达",
      `
      <div class="field"><label>Word / Expression</label><input type="text" id="vWord" /></div>
      <div class="field"><label>Meaning</label><input type="text" id="vMean" /></div>
      <div class="field"><label>Example</label><input type="text" id="vEx" /></div>
      <div class="field"><label>My own sentence</label><input type="text" id="vMine" /></div>
      <div class="split-2">
        <div class="field"><label>词性</label><input type="text" id="vPos" placeholder="n. / v. / adj." /></div>
        <div class="field"><label>Topic</label><input type="text" id="vTopic" /></div>
      </div>
      <div class="field"><label>熟悉度</label>
        <select id="vFam">${FAMILIARITY.map((f, i) => `<option value="${i}">${f}</option>`).join("")}</select>
      </div>
      <button type="button" class="btn btn-primary btn-block" id="vSave">保存</button>
      `,
      (close) => {
        document.getElementById("vSave").onclick = () => {
          const word = document.getElementById("vWord").value.trim();
          if (!word) return toast("请填写单词");
          state.vocab.push({
            id: uid(),
            word,
            meaning: document.getElementById("vMean").value,
            example: document.getElementById("vEx").value,
            mine: document.getElementById("vMine").value,
            pos: document.getElementById("vPos").value,
            topic: document.getElementById("vTopic").value,
            familiarity: Number(document.getElementById("vFam").value),
            date: todayStr(),
          });
          save();
          close();
          toast("已添加");
          renderVocab();
        };
      }
    );
  }

  function renderWriting() {
    // error stats
    const counts = {};
    state.writingErrors.forEach((e) => {
      counts[e.type] = (counts[e.type] || 0) + 1;
    });
    const month = todayStr().slice(0, 7);
    const monthErrs = state.writingErrors.filter((e) => (e.date || "").startsWith(month));
    const monthCounts = {};
    monthErrs.forEach((e) => {
      monthCounts[e.type] = (monthCounts[e.type] || 0) + 1;
    });
    const top = Object.entries(monthCounts).sort((a, b) => b[1] - a[1])[0];
    document.getElementById("writingStats").textContent = top
      ? `本月最常出现的问题：${top[0]}（${top[1]} 次）`
      : "本月暂无写作错误记录。";

    const list = document.getElementById("writingErrList");
    if (!state.writingErrors.length) {
      list.innerHTML = `<div class="empty">Writing Error Bank 为空</div>`;
    } else {
      list.innerHTML = state.writingErrors
        .slice()
        .reverse()
        .map(
          (e) => `
        <div class="list-item">
          <div class="main">
            <div class="title">${e.type}</div>
            <div class="sub">${e.detail || ""}</div>
            <div class="sub">${e.date || ""}</div>
          </div>
          <button type="button" class="btn btn-sm btn-soft" data-id="${e.id}">删</button>
        </div>`
        )
        .join("");
      list.querySelectorAll("button[data-id]").forEach((b) => {
        b.onclick = () => {
          state.writingErrors = state.writingErrors.filter((x) => x.id !== b.dataset.id);
          save();
          renderWriting();
        };
      });
    }

    const wlist = document.getElementById("writingList");
    if (!state.writings.length) {
      wlist.innerHTML = `<div class="empty">还没有保存的作文</div>`;
    } else {
      wlist.innerHTML = state.writings
        .slice()
        .reverse()
        .map(
          (w) => `
        <div class="list-item">
          <div class="main">
            <div class="title">${(w.prompt || "作文").slice(0, 40)}</div>
            <div class="sub">${w.date}${w.done ? " · 已完成" : ""}</div>
          </div>
          <button type="button" class="btn btn-sm btn-soft" data-id="${w.id}">删</button>
        </div>`
        )
        .join("");
      wlist.querySelectorAll("button[data-id]").forEach((b) => {
        b.onclick = () => {
          state.writings = state.writings.filter((x) => x.id !== b.dataset.id);
          save();
          renderWriting();
        };
      });
    }
  }

  function openWritingErrModal() {
    openModal(
      "写作问题",
      `
      <div class="field"><label>类型</label>
        <select id="weType">${ERR_TYPES.map((t) => `<option>${t}</option>`).join("")}</select>
      </div>
      <div class="field"><label>具体问题</label><textarea id="weDetail"></textarea></div>
      <button type="button" class="btn btn-primary btn-block" id="weSave">保存</button>
      `,
      (close) => {
        document.getElementById("weSave").onclick = () => {
          state.writingErrors.push({
            id: uid(),
            type: document.getElementById("weType").value,
            detail: document.getElementById("weDetail").value,
            date: todayStr(),
          });
          save();
          close();
          toast("已记录");
          renderWriting();
        };
      }
    );
  }

  function renderResources() {
    const list = document.getElementById("resList");
    if (!state.resources.length) {
      list.innerHTML = `<div class="empty">资源库为空，可添加真题、播客、文章链接等</div>`;
      return;
    }
    list.innerHTML = state.resources
      .slice()
      .reverse()
      .map(
        (r) => `
      <div class="list-item">
        <div class="main">
          <div class="title">${r.name}${r.done ? " ✓" : ""}</div>
          <div class="sub">${r.type || ""} · ${r.subject || ""} · ${r.level || ""} · ${r.phase || ""}</div>
          ${r.url ? `<div class="sub"><a href="${r.url}" target="_blank" rel="noopener">打开链接</a></div>` : ""}
          ${r.note ? `<div class="sub">${r.note}</div>` : ""}
        </div>
        <div style="display:flex;flex-direction:column;gap:4px">
          <button type="button" class="btn btn-sm btn-soft btn-toggle-res" data-id="${r.id}">${r.done ? "未完成" : "完成"}</button>
          <button type="button" class="btn btn-sm btn-soft btn-del-res" data-id="${r.id}">删</button>
        </div>
      </div>`
      )
      .join("");
    list.querySelectorAll(".btn-del-res").forEach((b) => {
      b.onclick = () => {
        state.resources = state.resources.filter((x) => x.id !== b.dataset.id);
        save();
        renderResources();
      };
    });
    list.querySelectorAll(".btn-toggle-res").forEach((b) => {
      b.onclick = () => {
        const r = state.resources.find((x) => x.id === b.dataset.id);
        if (r) r.done = !r.done;
        save();
        renderResources();
      };
    });
  }

  function openResModal() {
    openModal(
      "添加资源",
      `
      <div class="field"><label>名称</label><input type="text" id="rName" /></div>
      <div class="field"><label>类型</label>
        <select id="rType">
          <option>Listening</option><option>Reading</option><option>Writing</option>
          <option>Speaking</option><option>Vocabulary</option><option>General English</option>
        </select>
      </div>
      <div class="field"><label>链接</label><input type="url" id="rUrl" placeholder="https://…" /></div>
      <div class="split-2">
        <div class="field"><label>科目</label><input type="text" id="rSub" /></div>
        <div class="field"><label>难度</label><input type="text" id="rLevel" placeholder="入门/中等/难" /></div>
      </div>
      <div class="field"><label>阶段</label><input type="text" id="rPhase" placeholder="Phase 1…" /></div>
      <div class="field"><label>备注</label><textarea id="rNote"></textarea></div>
      <button type="button" class="btn btn-primary btn-block" id="rSave">保存</button>
      `,
      (close) => {
        document.getElementById("rSave").onclick = () => {
          const name = document.getElementById("rName").value.trim();
          if (!name) return toast("请填写名称");
          state.resources.push({
            id: uid(),
            name,
            type: document.getElementById("rType").value,
            url: document.getElementById("rUrl").value,
            subject: document.getElementById("rSub").value,
            level: document.getElementById("rLevel").value,
            phase: document.getElementById("rPhase").value,
            note: document.getElementById("rNote").value,
            done: false,
          });
          save();
          close();
          toast("已添加");
          renderResources();
        };
      }
    );
  }

  function renderSpeak() {
    const grid = document.getElementById("topicGrid");
    // pick topic by day of year for stability
    const dayNum = Math.floor(
      (parseDate(todayStr()) - parseDate(state.settings.startDate)) / 86400000
    );
    const todayTopic = SPEAK_TOPICS[Math.abs(dayNum) % SPEAK_TOPICS.length];
    grid.innerHTML = SPEAK_TOPICS.map((t) => {
      const isToday = t === todayTopic;
      return `<button type="button" class="topic-btn" style="${isToday ? "border-color:var(--accent)" : ""}">${isToday ? "今日 · " : ""}${t}</button>`;
    }).join("");
  }

  function renderReview() {
    const sel = document.getElementById("reviewMonth");
    const months = new Set();
    state.logs.forEach((l) => months.add(l.date.slice(0, 7)));
    const now = todayStr().slice(0, 7);
    months.add(now);
    const arr = [...months].sort().reverse();
    const cur = sel.value && arr.includes(sel.value) ? sel.value : now;
    sel.innerHTML = arr.map((m) => `<option value="${m}" ${m === cur ? "selected" : ""}>${m}</option>`).join("");

    const ym = sel.value || now;
    const logs = state.logs.filter((l) => l.date.startsWith(ym) && l.completed !== false);
    const totalMin = logs.reduce((s, l) => s + (Number(l.minutes) || 0), 0);
    const byType = { Listening: 0, Reading: 0, Speaking: 0, Writing: 0, Other: 0 };
    logs.forEach((l) => {
      if (byType[l.type] != null) byType[l.type] += Number(l.minutes) || 0;
      else byType.Other += Number(l.minutes) || 0;
    });
    const mocks = state.mocks.filter((m) => m.date.startsWith(ym));
    const exprs = state.expressions.filter((e) => (e.date || "").startsWith(ym));
    const weak = weakSubjects();

    document.getElementById("reviewBody").innerHTML = `
      <div>学习总时长：<strong>${(totalMin / 60).toFixed(1)} 小时</strong></div>
      <div>完成任务数：<strong>${logs.length}</strong></div>
      <div style="margin-top:8px">Listening ${(byType.Listening / 60).toFixed(1)}h · Reading ${(byType.Reading / 60).toFixed(1)}h · Speaking ${(byType.Speaking / 60).toFixed(1)}h · Writing ${(byType.Writing / 60).toFixed(1)}h</div>
      <div style="margin-top:8px">本月模考：${mocks.length ? mocks.map((m) => `${m.date} Overall ${m.overall ?? "—"}`).join("；") : "无"}</div>
      <div style="margin-top:8px">相对薄弱：${weak.slice(0, 2).join("、") || "数据不足"}</div>
      <div style="margin-top:8px">本月新增表达：${exprs.length} 条</div>
      <div style="margin-top:8px">下个月重点：继续按排休推进，弱项优先，不欠债补课。</div>
    `;
    document.getElementById("reviewNote").value = state.reviews[ym] || "";
  }

  /* ---------- Settings ---------- */
  function renderSettings() {
    document.getElementById("setExamDate").value = state.settings.examDate;
    document.getElementById("setStartDate").value = state.settings.startDate;
    document.getElementById("setTarget").value = state.settings.target;
    document.getElementById("setStretch").value = state.settings.stretch;

    document.getElementById("phaseList").innerHTML = PHASES.map((p) => {
      const cur = getPhase();
      const mark = cur.id === p.id ? " ← 当前" : "";
      return `<div style="margin-bottom:10px"><strong>Phase ${p.id} · ${p.name}</strong>${mark}<br/><span style="color:var(--muted)">${p.start} — ${p.end}<br/>${p.focus}</span></div>`;
    }).join("");
  }

  /* ---------- Export / Import ---------- */
  function exportJson() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    downloadBlob(blob, `ielts2027-backup-${todayStr()}.json`);
    toast("已导出 JSON");
  }

  function exportCsv() {
    const rows = [["date", "type", "minutes", "completed", "content", "mood", "note"]];
    state.logs.forEach((l) => {
      rows.push([l.date, l.type, l.minutes, l.completed, csvEsc(l.content), l.mood, csvEsc(l.note)]);
    });
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    downloadBlob(blob, `ielts2027-logs-${todayStr()}.csv`);
    toast("已导出学习记录 CSV");
  }

  function csvEsc(s) {
    s = String(s ?? "");
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  function downloadBlob(blob, name) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function importData(text) {
    try {
      const data = JSON.parse(text);
      if (!data || typeof data !== "object") throw new Error("invalid");
      state = Object.assign(defaultData(), data, {
        settings: Object.assign(defaultData().settings, data.settings || {}),
      });
      save();
      toast("导入成功");
      showPage("home");
    } catch (e) {
      toast("导入失败：JSON 格式不正确");
    }
  }

  /* ---------- Events ---------- */
  function bind() {
    // nav
    document.querySelectorAll(".nav-item").forEach((n) => {
      n.addEventListener("click", () => showPage(n.dataset.page));
    });
    const desk = document.getElementById("desktopNav");
    [
      ["home", "首页"],
      ["schedule", "排休"],
      ["log", "记录"],
      ["scores", "成绩"],
      ["bank", "积累"],
      ["settings", "设置"],
    ].forEach(([p, label]) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "btn" + (p === "home" ? " active" : "");
      b.dataset.page = p;
      b.textContent = label;
      b.onclick = () => showPage(p);
      desk.appendChild(b);
    });

    document.querySelectorAll("[data-go]").forEach((el) => {
      el.addEventListener("click", () => showPage(el.dataset.go));
    });

    document.getElementById("btnWork").onclick = () => {
      setDayMode("work");
      toast("已切换为工作日模式");
      renderHome();
    };
    document.getElementById("btnRest").onclick = () => {
      setDayMode("rest");
      toast("已切换为休息日模式");
      renderHome();
    };
    document.getElementById("btnDowngrade").onclick = () => {
      const next = setTier("downgrade");
      toast(next === "full" ? "完整模式" : next === "light" ? "已降为轻量" : "已降为保底 10 分钟");
      renderHome();
    };
    document.getElementById("btnSkipDay").onclick = () => {
      state.skippedDays[todayStr()] = true;
      save();
      toast("今天休息。明天按原计划继续，不补课。");
      renderHome();
    };
    document.getElementById("btnSpeakQuick").onclick = () => {
      bankTab = "speak";
      showPage("bank");
    };

    document.getElementById("calPrev").onclick = () => {
      calCursor.setMonth(calCursor.getMonth() - 1);
      renderCalendar();
    };
    document.getElementById("calNext").onclick = () => {
      calCursor.setMonth(calCursor.getMonth() + 1);
      renderCalendar();
    };
    document.getElementById("btnBatchRest").onclick = () => {
      const raw = document.getElementById("batchRestInput").value;
      const y = calCursor.getFullYear();
      const parts = raw.split(/[,，\s\n]+/).filter(Boolean);
      let n = 0;
      parts.forEach((p) => {
        let m, d;
        if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(p)) {
          state.schedule[p] = "rest";
          n++;
          return;
        }
        const mm = p.match(/^(\d{1,2})[\/\-](\d{1,2})$/);
        if (mm) {
          m = Number(mm[1]);
          d = Number(mm[2]);
          const ds = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          state.schedule[ds] = "rest";
          n++;
        }
      });
      save();
      toast(`已标记 ${n} 个休息日`);
      renderCalendar();
    };

    document.getElementById("btnAddLog").onclick = () => openLogModal(null);
    document.getElementById("logFilter").onchange = () => renderLogs();

    document.getElementById("btnEditBaseline").onclick = () => openBaselineModal();
    document.getElementById("btnAddMock").onclick = () => openMockModal();
    document.querySelectorAll("#chartLegend .tag").forEach((t) => {
      t.onclick = () => {
        const s = t.dataset.s;
        chartSeries[s] = !chartSeries[s];
        t.classList.toggle("active", chartSeries[s]);
        drawScoreChart();
      };
    });

    document.getElementById("bankTabs").addEventListener("click", (e) => {
      const t = e.target.closest(".tag");
      if (!t) return;
      bankTab = t.dataset.tab;
      renderBank();
    });
    document.getElementById("btnAddExpr").onclick = () => openExprModal();
    document.getElementById("btnAddVocab").onclick = () => openVocabModal();
    document.getElementById("btnAddWritingErr").onclick = () => openWritingErrModal();
    document.getElementById("btnAddRes").onclick = () => openResModal();
    document.getElementById("btnSaveWriting").onclick = () => {
      const prompt = document.getElementById("writingPrompt").value.trim();
      const draft = document.getElementById("writingDraft").value.trim();
      if (!prompt && !draft) return toast("请填写题目或草稿");
      state.writings.push({
        id: uid(),
        date: todayStr(),
        prompt,
        draft,
        feedback: document.getElementById("writingFeedback").value,
        done: true,
      });
      save();
      document.getElementById("writingPrompt").value = "";
      document.getElementById("writingDraft").value = "";
      document.getElementById("writingFeedback").value = "";
      toast("作文已保存");
      renderWriting();
    };

    document.getElementById("reviewMonth").onchange = () => renderReview();
    document.getElementById("btnSaveReview").onclick = () => {
      const ym = document.getElementById("reviewMonth").value;
      state.reviews[ym] = document.getElementById("reviewNote").value;
      save();
      toast("总结已保存");
    };

    document.getElementById("btnSaveSettings").onclick = () => {
      state.settings.examDate = document.getElementById("setExamDate").value;
      state.settings.startDate = document.getElementById("setStartDate").value;
      state.settings.target = Number(document.getElementById("setTarget").value) || 6.5;
      state.settings.stretch = Number(document.getElementById("setStretch").value) || 7;
      save();
      toast("设置已保存");
      renderHome();
    };

    document.getElementById("btnExportJson").onclick = exportJson;
    document.getElementById("btnExportCsv").onclick = exportCsv;
    document.getElementById("btnPickImport").onclick = () => {
      document.getElementById("importFile").click();
    };
    document.getElementById("btnImport").onclick = () => {
      const text = document.getElementById("importArea").value.trim();
      if (!text) return toast("请先粘贴 JSON，或用「选择文件并导入」");
      if (!confirm("导入将覆盖当前全部数据，确定？")) return;
      importData(text);
    };
    document.getElementById("importFile").onchange = (e) => {
      const f = e.target.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        const text = String(reader.result || "");
        document.getElementById("importArea").value = text;
        if (!confirm("将用所选文件覆盖当前全部数据，确定导入？")) {
          e.target.value = "";
          return;
        }
        importData(text);
        e.target.value = "";
      };
      reader.onerror = () => toast("读取文件失败");
      reader.readAsText(f);
    };
    document.getElementById("btnReset").onclick = () => {
      if (!confirm("确定清空全部本地数据？此操作不可恢复（请先导出备份）。")) return;
      state = defaultData();
      save();
      toast("已清空");
      showPage("home");
    };

    window.addEventListener("resize", () => {
      if (document.getElementById("page-scores").classList.contains("active")) drawScoreChart();
    });
  }

  // init
  bind();
  // ensure today's tasks exist
  ensureTasks(todayStr());
  showPage("home");
})();
