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

  const SPEAK_TOPICS = [
    "Work", "Daily routine", "Travel", "Stress", "Technology",
    "Food", "Future plans", "Relationships", "IELTS Part 1",
    "IELTS Part 2", "IELTS Part 3", "Hometown", "Hobbies", "Education",
  ];

  const PART2_CUES = [
    "Describe a time when work made you feel stressed.",
    "Describe something you do to relax after a long day.",
    "Describe a skill you want to improve.",
    "Describe a place you would like to visit.",
    "Describe a person who encourages you.",
    "Describe a change you want to make in your routine.",
    "Describe an English learning method that works for you.",
    "Describe a difficult decision you made at work.",
  ];

  const EXPR_CATS = ["All", "Work", "Emotion", "Daily Life", "Relationship", "Travel", "Opinion", "IELTS"];
  const FAMILIARITY = ["陌生", "见过", "熟悉", "能主动使用"];
  const ERR_TYPES = ["Grammar", "Vocabulary", "Collocation", "Logic", "Coherence", "Sentence structure", "Natural expression", "Pronunciation"];
  const PROBLEM_TYPES = ["Grammar", "Word choice", "Logic", "Naturalness", "Sentence structure"];
  const REVIEW_STATUS = ["未复习", "已复习", "已主动使用"];
  const MOODS = [
    { v: "tired", l: "😫 很累" },
    { v: "ok", l: "😐 普通" },
    { v: "normal", l: "🙂 正常" },
    { v: "great", l: "🔥 状态很好" },
  ];
  const SKILLS = ["Listening", "Reading", "Writing", "Speaking"];
  const ICONS = { Listening: "🎧", Reading: "📖", Writing: "✍️", Speaking: "🗣", Review: "🔁", Free: "🌿" };

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
        focusSkill: "", // optional manual focus
      },
      schedule: {}, // "YYYY-MM-DD": "work" | "rest"
      dayModes: {}, // override work|rest
      dayEnergy: {}, // date -> normal|tired|exhausted|off
      workdayIndex: 0,
      taskTier: {}, // date -> "full"|"light"|"min" (legacy compat)
      dayTasks: {}, // date -> [{id,key,title,mins,steps,doneStd,...}]
      completedTaskIds: {}, // date -> [ids]
      skippedDays: {}, // date -> true
      activeTaskId: {}, // date -> task id currently focused
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
    delete state.dayTasks[dateStr];
    delete state.taskTier[dateStr];
    save();
  }

  function getEnergy(dateStr = todayStr()) {
    if (state.skippedDays[dateStr]) return "off";
    return state.dayEnergy[dateStr] || "normal";
  }

  function setEnergy(energy, dateStr = todayStr()) {
    state.dayEnergy[dateStr] = energy;
    if (energy === "off") {
      state.skippedDays[dateStr] = true;
      // record Rest Day (not a failed zero-minute day)
      const already = state.logs.some(
        (l) => l.date === dateStr && l.type === "Rest" && l.completed !== false
      );
      if (!already) {
        state.logs.push({
          id: uid(),
          date: dateStr,
          type: "Rest",
          minutes: 0,
          completed: true,
          content: "Rest Day · 今日休息",
          difficulty: "",
          mood: "off",
          note: "计划内休息，非失败",
          tier: "off",
        });
      }
    } else {
      delete state.skippedDays[dateStr];
    }
    // map energy to legacy tier for compat
    if (energy === "tired") state.taskTier[dateStr] = "light";
    else if (energy === "exhausted") state.taskTier[dateStr] = "min";
    else if (energy === "normal") state.taskTier[dateStr] = "full";
    delete state.dayTasks[dateStr];
    save();
  }

  function getTier(dateStr = todayStr()) {
    const e = getEnergy(dateStr);
    if (e === "exhausted") return "min";
    if (e === "tired") return "light";
    return state.taskTier[dateStr] || "full";
  }

  function setTier(tier, dateStr = todayStr()) {
    const order = ["full", "light", "min"];
    const cur = getTier(dateStr);
    let next = tier;
    if (tier === "downgrade") {
      const i = Math.max(0, order.indexOf(cur));
      next = order[Math.min(i + 1, order.length - 1)];
    }
    state.taskTier[dateStr] = next;
    if (next === "light") state.dayEnergy[dateStr] = "tired";
    if (next === "min") state.dayEnergy[dateStr] = "exhausted";
    if (next === "full") state.dayEnergy[dateStr] = "normal";
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

  /** Count skill practice in last N days */
  function skillStats(days = 7) {
    const counts = { Listening: 0, Reading: 0, Writing: 0, Speaking: 0 };
    const lastDate = {};
    const t = todayStr();
    state.logs.forEach((l) => {
      if (l.completed === false) return;
      if (!counts.hasOwnProperty(l.type)) return;
      const d = daysBetween(l.date, t);
      if (d >= 0 && d < days) counts[l.type]++;
      if (!lastDate[l.type] || l.date > lastDate[l.type]) lastDate[l.type] = l.date;
    });
    return { counts, lastDate };
  }

  function daysSinceSkill(skill, lastDate) {
    if (!lastDate[skill]) return 99;
    return daysBetween(lastDate[skill], todayStr());
  }

  /** Priority list + reason for homepage */
  function getPriority() {
    const { counts, lastDate } = skillStats(7);
    const weak = weakSubjects();
    const manual = state.settings.focusSkill;
    const scored = SKILLS.map((k) => {
      let score = 0;
      score += (3 - Math.min(counts[k], 3)) * 3; // fewer sessions = higher
      score += Math.min(daysSinceSkill(k, lastDate), 14); // longer gap
      if (weak[0] === k) score += 4;
      if (weak[1] === k) score += 2;
      if (manual === k) score += 8;
      // phase 1 soft-deprioritize writing slightly
      if (getPhase().id === 1 && k === "Writing") score -= 2;
      return { k, score, count: counts[k], gap: daysSinceSkill(k, lastDate) };
    });
    scored.sort((a, b) => b.score - a.score);
    const top = scored[0];
    let reason = "";
    if (manual && manual === top.k) reason = "你标记为本阶段重点";
    else if (top.count === 0) reason = "过去 7 天还没练过，下一次会优先安排";
    else if (top.gap >= 7) reason = "这阵子练得少，适合作为下次主项";
    else if (weak[0] === top.k) reason = "最近模考相对薄弱";
    else reason = "过去 7 天相对练得少";
    return { focus: top.k, reason, ranked: scored, counts };
  }

  /** Pull 3 expressions needing review for Review tasks */
  function reviewExprHints() {
    const pending = state.expressions
      .filter((e) => (e.reviewStatus || 0) < 2)
      .slice(-8)
      .reverse();
    if (!pending.length) {
      return ["打开表达库，选 3 个表达", "每个口头造句 / 说出来一次", "把仍卡住的标为未复习"];
    }
    return pending.slice(0, 3).map((e, i) => {
      const line = e.natural || e.mine || e.zh || "（一条表达）";
      return `${i + 1}. 说出来：${line.slice(0, 60)}${line.length > 60 ? "…" : ""}`;
    });
  }

  function pickTopic(dateStr) {
    const n = Math.abs(daysBetween(state.settings.startDate, dateStr));
    return {
      speak: SPEAK_TOPICS[n % SPEAK_TOPICS.length],
      part2: PART2_CUES[n % PART2_CUES.length],
    };
  }

  function makeTask(partial) {
    return Object.assign(
      {
        id: uid(),
        key: "Other",
        title: "",
        mins: 10,
        steps: [],
        doneStd: "按步骤做完即可",
        desc: "",
        tier: "full",
      },
      partial
    );
  }

  function buildWorkPlan(dateStr, energy) {
    const { focus } = getPriority();
    const topics = pickTopic(dateStr);
    const tasks = [];

    if (energy === "exhausted") {
      // 最低连接 10–15 min，最多 2 模块
      tasks.push(
        makeTask({
          key: "Speaking",
          title: "🗣 Speaking · 5 min",
          mins: 5,
          steps: [
            `话题：${topics.speak}`,
            "只说 4–6 句即可，不追求完整 Part 2",
            "卡住的句子可点「存进表达库」",
          ],
          doneStd: "开口说过几句英语",
          tier: "min",
        })
      );
      tasks.push(
        makeTask({
          key: "Review",
          title: "🔁 Review · 5 min",
          mins: 5,
          steps: reviewExprHints().slice(0, 2).concat(["今天不追求进度，只保持连接"]),
          doneStd: "接触表达库或任意英语即可",
          tier: "min",
        })
      );
      return tasks;
    }

    if (energy === "tired") {
      // ~20–25 min，2 模块
      tasks.push(
        makeTask({
          key: focus === "Writing" ? "Speaking" : focus === "Reading" ? "Reading" : focus === "Listening" ? "Listening" : "Speaking",
          title:
            focus === "Listening"
              ? "🎧 Listening · 12 min"
              : focus === "Reading"
              ? "📖 Reading · 12 min"
              : "🗣 Speaking · 12 min",
          mins: 12,
          steps:
            focus === "Listening"
              ? ["听一小段材料", "跟读或标出 1 个难点"]
              : focus === "Reading"
              ? ["读一段短文", "用一句话概括主旨"]
              : [`话题：${topics.speak}`, "说 1–2 分钟 → 纠正一处 → 再说一次"],
          doneStd: focus === "Speaking" || focus === "Writing" ? "回答一次并重说" : "完成轻量输入即可",
          tier: "light",
        })
      );
      tasks.push(
        makeTask({
          key: "Review",
          title: "🔁 Review · 8 min",
          mins: 8,
          steps: reviewExprHints(),
          doneStd: "至少主动说出 2–3 个表达",
          tier: "light",
        })
      );
      return tasks;
    }

    // normal workday: max 3 modules ~35 min
    const primary = focus;
    const secondary = getPriority().ranked.find((x) => x.k !== primary && x.k !== "Writing")?.k || "Listening";

    if (primary === "Speaking") {
      tasks.push(
        makeTask({
          key: "Speaking",
          title: "🗣 Speaking · 15 min",
          mins: 15,
          cue: topics.part2,
          steps: [
            `Part 2 · ${topics.part2}`,
            "① 独立回答约 2 分钟",
            "② 记录不会表达的地方 → 点「存进表达库」",
            "③ 获取纠正（ChatGPT / 笔记）",
            "④ 用更自然的表达再回答一次",
          ],
          doneStd: "完整回答 1 次 + 重说 1 次",
        })
      );
    } else if (primary === "Writing") {
      tasks.push(
        makeTask({
          key: "Writing",
          title: "✍️ Writing · 段落训练",
          mins: 15,
          steps: [
            "写一个 Introduction 或 Body 段落",
            "检查时态 / 主谓一致",
            "把反复出错的点记入 Writing Error Bank",
          ],
          doneStd: "完成一个完整段落",
        })
      );
    } else if (primary === "Listening") {
      tasks.push(
        makeTask({
          key: "Listening",
          title: "🎧 Listening · 精听片段",
          mins: 15,
          steps: [
            "选一小段（不要求完整 Test）",
            "精听 / 跟读",
            "标出 2 个听不出来的地方",
          ],
          doneStd: "完成片段 + 找出 2 个难点",
        })
      );
    } else {
      tasks.push(
        makeTask({
          key: "Reading",
          title: "📖 Reading · 定位练习",
          mins: 15,
          steps: ["读半篇或一篇短文", "做 3–5 题或口头概括", "记录 1 个错题原因"],
          doneStd: "完成阅读并记录错因",
        })
      );
    }

    // second module
    if (secondary === "Listening" || primary === "Speaking") {
      tasks.push(
        makeTask({
          key: "Listening",
          title: "🎧 Listening · 10 min",
          mins: 10,
          steps: ["指定一小段材料", "不要求完整 Test", "重点精听或跟读"],
          doneStd: "听完指定片段",
        })
      );
    } else if (secondary === "Reading") {
      tasks.push(
        makeTask({
          key: "Reading",
          title: "📖 Reading · 10 min",
          mins: 10,
          steps: ["快速读一段英文", "用中文或英文说清主旨"],
          doneStd: "能说出主旨即可",
        })
      );
    } else {
      tasks.push(
        makeTask({
          key: "Speaking",
          title: "🗣 Speaking · 10 min",
          mins: 10,
          steps: [`话题：${topics.speak}`, "说 1 分钟 → 纠正 → 再说"],
          doneStd: "回答一次并重说",
        })
      );
    }

    tasks.push(
      makeTask({
        key: "Review",
        title: "🔁 Review · 10 min",
        mins: 10,
        steps: reviewExprHints().concat(["每个至少主动说出来一次"]),
        doneStd: "主动使用至少 3 个表达",
      })
    );

    return tasks.slice(0, 3);
  }

  function buildRestPlan(dateStr, energy) {
    const pri = getPriority();
    const focus = pri.focus;
    const topics = pickTopic(dateStr);
    const tasks = [];

    if (energy === "exhausted") {
      return buildWorkPlan(dateStr, "exhausted");
    }

    // Phase 1: core production 40-60
    const coreIsWriting = focus === "Writing" || (pri.ranked[0].k !== "Speaking" && pri.counts.Writing === 0);
    if (coreIsWriting && getPhase(dateStr).id > 1) {
      tasks.push(
        makeTask({
          key: "Writing",
          title: "✍️ 核心 · Writing 产出",
          mins: energy === "tired" ? 30 : 50,
          steps: [
            "完成 Task 1 或 Task 2（可只写完整一篇的主体）",
            "写完后标出 2–3 个不确定的地方",
            "把问题记入 Writing Error Bank",
          ],
          doneStd: "有实际文字产出（完整作文或完整段落组）",
        })
      );
    } else {
      tasks.push(
        makeTask({
          key: "Speaking",
          title: "🗣 核心 · Speaking 产出",
          mins: energy === "tired" ? 25 : 40,
          steps: [
            `Part 2：${topics.part2}`,
            "独立回答 → 纠正 → 重说",
            "再练 2–3 个 Part 1 问题，或一段自由表达",
            "把卡住的句子存进表达库",
          ],
          doneStd: "至少 1 次完整 Part 2 + 纠正重说",
        })
      );
    }

    if (energy === "tired") {
      tasks.push(
        makeTask({
          key: pri.ranked.find((x) => x.k === "Listening" || x.k === "Reading")?.k || "Listening",
          title: "🎧/📖 输入训练",
          mins: 25,
          steps: ["做一段 Listening 或一篇 Reading", "对答案，记 1–2 个错因"],
          doneStd: "完成一段输入并对答案",
        })
      );
      tasks.push(
        makeTask({
          key: "Review",
          title: "🔁 表达 / 错题复盘",
          mins: 15,
          steps: reviewExprHints().concat(["主动说 / 写 3 句"]),
          doneStd: "主动使用至少 3 项",
        })
      );
      return tasks.slice(0, 3);
    }

    // full rest day up to 4 modules
    const inputSkill = pri.ranked.find((x) => x.k === "Listening" || x.k === "Reading")?.k || "Listening";
    tasks.push(
      makeTask({
        key: inputSkill,
        title: `${ICONS[inputSkill]} 输入 · ${inputSkill}`,
        mins: 40,
        steps:
          inputSkill === "Listening"
            ? ["IELTS Listening 一段或精听", "对答案", "分析听不出的原因"]
            : ["限时阅读一篇 passage", "对答案", "记录错题原因"],
        doneStd: "完成输入训练并对答案 / 记错因",
      })
    );

    tasks.push(
      makeTask({
        key: "Review",
        title: "🔁 错题与表达复盘",
        mins: 30,
        steps: reviewExprHints().concat([
          "把反复出现的问题归类（语法 / 自然度 / 逻辑）",
          "各造 1–2 句巩固",
        ]),
        doneStd: "复盘并主动使用至少 3 项",
      })
    );

    tasks.push(
      makeTask({
        key: "Free",
        title: "🌿 自由英语",
        mins: 20,
        steps: ["视频 / 文章 / 英语聊天 / 任意喜欢的输入", "不强制做题，保持愉悦接触"],
        doneStd: "接触英语即可，无压力",
      })
    );

    return tasks.slice(0, 4);
  }

  function ensureTasks(dateStr = todayStr(), force = false) {
    if (state.dayTasks[dateStr] && !force) return state.dayTasks[dateStr];
    const mode = getDayMode(dateStr);
    const energy = getEnergy(dateStr);
    let tasks = [];
    if (energy === "off" || state.skippedDays[dateStr]) {
      tasks = [];
    } else if (mode === "rest") {
      tasks = buildRestPlan(dateStr, energy);
    } else {
      tasks = buildWorkPlan(dateStr, energy);
    }
    // migrate: if old tasks lack steps, force rebuild once when force or missing steps
    if (!force && state.dayTasks[dateStr] && state.dayTasks[dateStr][0] && !state.dayTasks[dateStr][0].steps) {
      // keep old until force
    }
    state.dayTasks[dateStr] = tasks;
    if (!state.activeTaskId[dateStr] && tasks.length) {
      state.activeTaskId[dateStr] = tasks[0].id;
    }
    save();
    return tasks;
  }

  function nextRestDayHint() {
    const t = parseDate(todayStr());
    for (let i = 1; i <= 14; i++) {
      const d = new Date(t);
      d.setDate(d.getDate() + i);
      const ds = todayStr(d);
      if (state.schedule[ds] === "rest") {
        return { date: ds, days: i };
      }
    }
    return null;
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
    const energy = getEnergy(t);
    const pri = getPriority();

    // status + goal
    let statusText = mode === "rest" ? "今日：休息日" : "今日：工作日";
    if (energy === "tired") statusText += " · 有点累（轻量）";
    if (energy === "exhausted") statusText += " · 很累（保底）";
    if (energy === "off") statusText = "今日：休息 / 不安排正式学习";
    document.getElementById("statusLine").textContent = statusText;

    let goalText = "";
    if (energy === "off") {
      goalText = "今日休息 · 不安排正式学习。休息是计划的一部分，不是失败。";
    } else if (mode === "rest") {
      goalText =
        energy === "tired"
          ? "建议约 1–1.5 小时 · 核心产出 + 一段输入，不求四科全做。"
          : energy === "exhausted"
          ? "休息日也选了保底 · 10–15 分钟保持连接即可。"
          : "建议 2–3 小时 · 完成一次有产出的训练，不必四科全满。";
    } else {
      if (energy === "exhausted") goalText = "最低连接模式 · 10–15 分钟。今天不追求进度，只保持英语连接。";
      else if (energy === "tired") goalText = "轻量模式 · 约 20 分钟。低负荷保持连接即可。";
      else goalText = "建议 30–40 分钟 · 保持英语连接，不追求大量输入。";
    }
    document.getElementById("goalLine").textContent = goalText;

    // energy buttons
    document.querySelectorAll("#energyRow .energy-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.e === energy);
    });

    // focus banner
    const avoid = SKILLS.filter((k) => (pri.counts[k] || 0) === 0);
    let banner = "";
    if (energy === "off") {
      banner = "今日休息（Rest Day）。明天按计划继续，不补课。";
    } else if (energy === "exhausted") {
      banner = "今天不追求进度，只保持英语连接。";
    } else {
      banner = `本周重点：<strong>${pri.focus}</strong><br>${pri.reason}`;
      if (avoid.length) {
        banner += `<br><span class="soft-hint">${avoid.join("、")} 本周偏少 · 下次休息日会优先安排</span>`;
      }
    }
    document.getElementById("focusBanner").innerHTML = banner;

    // tasks
    const box = document.getElementById("todayTasks");
    const startBtn = document.getElementById("btnStartToday");
    if (energy === "off" || state.skippedDays[t]) {
      document.getElementById("planTotal").textContent = "今日休息 · Rest Day";
      box.innerHTML = `<div class="rest-card">
        <p>今天不安排正式学习。</p>
        <p class="hint-text">这是排休/恢复的一部分，不是「0 分钟失败」。需要时把状态改回「正常」即可。</p>
      </div>`;
      startBtn.style.display = "none";
    } else {
      let tasks = state.dayTasks[t];
      if (!tasks || !tasks.length || (tasks[0] && !Array.isArray(tasks[0].steps))) {
        tasks = ensureTasks(t, true);
      } else {
        tasks = ensureTasks(t);
      }
      const done = new Set(state.completedTaskIds[t] || []);
      const totalMin = tasks.reduce((s, x) => s + (x.mins || 0), 0);
      const doneCount = tasks.filter((x) => done.has(x.id)).length;
      const allDone = doneCount === tasks.length && tasks.length > 0;

      if (allDone && energy === "exhausted") {
        document.getElementById("planTotal").innerHTML =
          `今日最低连接已完成 · 不需要补课`;
      } else if (allDone) {
        document.getElementById("planTotal").innerHTML =
          `今日模块已完成 · <strong>${totalMin} 分钟</strong> · 今天这样就很好`;
      } else {
        document.getElementById("planTotal").innerHTML =
          `今日计划 · <strong>${totalMin} 分钟</strong> · ${doneCount}/${tasks.length} 模块`;
      }

      const activeId = state.activeTaskId[t] || (tasks.find((x) => !done.has(x.id)) || tasks[0] || {}).id;

      box.innerHTML = tasks
        .map((task) => {
          const isDone = done.has(task.id);
          const isActive = task.id === activeId && !isDone;
          const steps = (task.steps || []).map((s) => `<li>${s}</li>`).join("");
          // collapsed for non-active unfinished tasks to reduce scroll
          const collapsed = !isDone && !isActive;
          return `
          <div class="task ${isDone ? "done" : ""} ${isActive ? "active-now" : ""} ${collapsed ? "collapsed" : ""}" data-id="${task.id}">
            <div class="task-top">
              <div class="task-title">${task.title}</div>
              <span class="task-mins">${task.mins} min</span>
            </div>
            ${
              !collapsed
                ? `${steps ? `<ul class="task-steps">${steps}</ul>` : ""}
                   <div class="task-done-std">完成标准：${task.doneStd || "做完即可"}</div>`
                : `<div class="task-preview">${(task.steps && task.steps[0]) || task.doneStd || ""}</div>`
            }
            ${
              isDone
                ? `<div class="task-actions"><span class="hint-text">已完成</span>
                    ${task.key === "Speaking" ? `<button type="button" class="btn btn-sm btn-soft btn-save-expr">存进表达库</button>` : ""}
                    ${task.key === "Writing" ? `<button type="button" class="btn btn-sm btn-soft btn-write-err">记写作问题</button>` : ""}
                  </div>`
                : isActive
                ? `<div class="task-actions">
                    <button type="button" class="btn btn-success btn-sm btn-done" data-id="${task.id}">标记完成</button>
                    ${task.key === "Speaking" ? `<button type="button" class="btn btn-sm btn-soft btn-save-expr">不会说 → 存表达库</button>` : ""}
                    ${task.key === "Writing" ? `<button type="button" class="btn btn-sm btn-soft btn-write-err">记写作问题</button>` : ""}
                  </div>`
                : `<div class="task-actions">
                    <button type="button" class="btn btn-sm btn-soft btn-focus" data-id="${task.id}">展开 / 开始这项</button>
                  </div>`
            }
          </div>`;
        })
        .join("");

      box.querySelectorAll(".btn-done").forEach((b) => {
        b.onclick = () => completeTask(b.dataset.id);
      });
      box.querySelectorAll(".btn-focus").forEach((b) => {
        b.onclick = () => {
          state.activeTaskId[t] = b.dataset.id;
          save();
          renderHome();
          toast("按步骤做完，再点「标记完成」");
        };
      });
      box.querySelectorAll(".btn-save-expr").forEach((b) => {
        b.onclick = () => openExprModal();
      });
      box.querySelectorAll(".btn-write-err").forEach((b) => {
        b.onclick = () => openWritingErrModal();
      });

      startBtn.style.display = "block";
      const next = tasks.find((x) => !done.has(x.id));
      if (!next) {
        startBtn.textContent =
          energy === "exhausted" ? "今日最低连接已完成" : "今日已完成 · 今天这样就很好";
        startBtn.disabled = true;
        startBtn.classList.add("btn-done-state");
      } else if (next.id === activeId) {
        startBtn.textContent = "当前任务进行中 · 完成后点「标记完成」";
        startBtn.disabled = false;
        startBtn.classList.remove("btn-done-state");
        startBtn.onclick = () => {
          const el = box.querySelector(`.task[data-id="${next.id}"]`);
          if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
        };
      } else {
        const short = next.title.replace(/^[^\s]+\s/, "").slice(0, 28);
        startBtn.textContent = `开始任务 · ${short}`;
        startBtn.disabled = false;
        startBtn.classList.remove("btn-done-state");
        startBtn.onclick = () => {
          state.activeTaskId[t] = next.id;
          save();
          renderHome();
          requestAnimationFrame(() => {
            const el = document.querySelector(`#todayTasks .task[data-id="${next.id}"]`);
            if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
          });
          toast("题目和步骤已展开 · 做完点「标记完成」");
        };
      }
    }

    // week connection + balance
    let contact = 0;
    let weekMins = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = todayStr(d);
      const dayLogs = state.logs.filter(
        (l) => l.date === ds && l.completed !== false && l.type !== "Rest"
      );
      if (dayLogs.length || (state.completedTaskIds[ds] || []).length) contact++;
      weekMins += dayLogs.reduce((s, l) => s + (Number(l.minutes) || 0), 0);
    }
    // also count rest days marked intentionally as contact? No - rest is rest
    const restDaysWeek = (() => {
      let n = 0;
      for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const ds = todayStr(d);
        if (state.dayEnergy[ds] === "off" || state.skippedDays[ds]) n++;
      }
      return n;
    })();
    document.getElementById("weekSummary").textContent =
      `本周连接 ${contact}/7 天 · 约 ${(weekMins / 60).toFixed(1)} h` +
      (restDaysWeek ? ` · 其中休息日 ${restDaysWeek} 天（正常）` : "") +
      " · 断一天没关系";

    const maxC = Math.max(1, ...Object.values(pri.counts), 1);
    document.getElementById("balanceGrid").innerHTML =
      SKILLS.map((k) => {
        const c = pri.counts[k] || 0;
        const pct = Math.round((c / Math.max(maxC, 3)) * 100);
        const low = c === 0 ? " low" : "";
        return `<div class="balance-row">
          <span class="name">${k}</span>
          <div class="balance-bar${low}"><i style="width:${Math.min(100, pct)}%"></i></div>
          <span class="count">${c}次</span>
        </div>`;
      }).join("") +
      (avoid.length
        ? `<p class="hint-text" style="margin-top:8px">${avoid.join("、")} 本周偏少 · 下一个休息日将优先安排</p>`
        : "");

    // tomorrow / next rest hint
    const nr = nextRestDayHint();
    const th = document.getElementById("tomorrowHint");
    if (mode === "work" && nr && nr.days === 1) {
      th.textContent = `明天休息 · 已按排休准备深度学习日（约 2–3 小时），今天保持连接即可。`;
    } else if (nr && nr.days <= 3) {
      th.textContent = `${nr.days} 天后有休息日（${nr.date.slice(5)}）。到时再做深度训练。`;
    } else {
      th.textContent = "可在「排休」里标记休息日，系统会自动切换深度学习模式。";
    }

    // secondary: connection
    const days = lastContactDays();
    const dot = document.getElementById("connDot");
    const ct = document.getElementById("connText");
    if (dot && ct) {
      dot.className = "conn-dot";
      if (days === null) ct.textContent = "还没有学习记录。今天做一个保底任务即可开始。";
      else if (days <= 1) ct.textContent = days === 0 ? "今天已接触英语。" : "最近一次：1 天前。";
      else if (days === 2) {
        dot.classList.add("warn");
        ct.textContent = "最近一次：2 天前。今天哪怕 10 分钟也好。";
      } else {
        dot.classList.add("alert");
        ct.textContent = `最近一次：${days} 天前。做 10 分钟保底即可，不必补课。`;
      }
    }

    const ym = t.slice(0, 7);
    const monthLogs = state.logs.filter((l) => l.date.startsWith(ym) && l.completed !== false);
    const mins = monthLogs.reduce((s, l) => s + (Number(l.minutes) || 0), 0);
    const mh = document.getElementById("monthHours");
    if (mh) {
      mh.textContent = (mins / 60).toFixed(1) + " h";
      document.getElementById("monthTasks").textContent = String(monthLogs.length);
      const goal = state.settings.monthlyHourGoal || 25;
      document.getElementById("monthBar").style.width = Math.min(100, (mins / 60 / goal) * 100) + "%";
      document.getElementById("monthHint").textContent = `本月目标约 ${goal} 小时（参考，不是考核）`;
    }

    const latest = state.mocks.length ? state.mocks[state.mocks.length - 1] : state.baseline;
    const grid = document.getElementById("scoreGrid");
    if (grid) {
      ["L", "R", "W", "S"].forEach((k, i) => {
        grid.children[i].querySelector(".v").textContent =
          latest && latest[k] != null ? latest[k] : "—";
      });
    }
    const deltaEl = document.getElementById("baselineDelta");
    if (deltaEl) {
      if (state.baseline && latest && latest !== state.baseline) {
        const fmt = (a, b) => {
          if (a == null || b == null) return "—";
          const d = +(b - a).toFixed(1);
          if (d > 0) return `<span class="delta-pos">+${d}</span>`;
          return `<span class="delta-neu">${d}</span>`;
        };
        deltaEl.innerHTML = `自起点：L ${fmt(state.baseline.L, latest.L)} · R ${fmt(state.baseline.R, latest.R)} · W ${fmt(state.baseline.W, latest.W)} · S ${fmt(state.baseline.S, latest.S)}`;
      } else if (state.baseline) deltaEl.textContent = "已记录起点。下次模考后显示进步。";
      else deltaEl.textContent = "建议完成一次完整模考作为「我的起点」。";
    }
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
    const logType = ["Listening", "Reading", "Writing", "Speaking"].includes(task.key)
      ? task.key
      : "Other";
    state.logs.push({
      id: uid(),
      date: t,
      type: logType,
      minutes: task.mins,
      completed: true,
      content: task.title + (task.doneStd ? " · " + task.doneStd : ""),
      difficulty: "",
      mood: getEnergy(t),
      note: "",
      tier: task.tier || getTier(t),
    });
    delete state.skippedDays[t];
    save();
    const energy = getEnergy(t);
    const tasksLeft = (state.dayTasks[t] || []).filter(
      (x) => !(state.completedTaskIds[t] || []).includes(x.id)
    );
    if (energy === "exhausted" && !tasksLeft.length) {
      toast("今日最低连接已完成，不需要补课");
    } else if (!tasksLeft.length) {
      toast("今日模块已完成 · 今天这样就很好");
    } else {
      toast("已完成这一项 · 可继续下一项");
    }
    // auto focus next
    if (tasksLeft[0]) state.activeTaskId[t] = tasksLeft[0].id;
    save();
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
    // problem type stats
    const pcounts = {};
    state.expressions.forEach((e) => {
      if (e.problemType) pcounts[e.problemType] = (pcounts[e.problemType] || 0) + 1;
    });
    const ptop = Object.entries(pcounts).sort((a, b) => b[1] - a[1]).slice(0, 3);

    list.innerHTML =
      (ptop.length
        ? `<p class="hint-text" style="margin-bottom:10px">常见问题：${ptop.map(([k, v]) => `${k} ×${v}`).join(" · ")}</p>`
        : "") +
      items
        .map(
          (e) => `
      <div class="list-item">
        <div class="main">
          <div class="title">${e.zh || e.mine || "（无中文）"}</div>
          <div class="sub">我的：${e.mine || "—"}</div>
          <div class="sub">更自然：${e.natural || "—"}</div>
          <div class="sub">${e.problemType || ""} · ${REVIEW_STATUS[e.reviewStatus || 0] || ""} · ${e.category || ""} · ${e.date || ""}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px">
          <button type="button" class="btn btn-sm btn-soft btn-adv-expr" data-id="${e.id}">推进复习</button>
          <button type="button" class="btn btn-sm btn-soft" data-id="${e.id}">删</button>
        </div>
      </div>`
        )
        .join("");
    list.querySelectorAll("button[data-id]:not(.btn-adv-expr)").forEach((b) => {
      b.onclick = () => {
        state.expressions = state.expressions.filter((x) => x.id !== b.dataset.id);
        save();
        renderExpr();
      };
    });
    list.querySelectorAll(".btn-adv-expr").forEach((b) => {
      b.onclick = () => {
        const e = state.expressions.find((x) => x.id === b.dataset.id);
        if (!e) return;
        e.reviewStatus = Math.min(2, (e.reviewStatus || 0) + 1);
        save();
        renderExpr();
        toast(REVIEW_STATUS[e.reviewStatus]);
      };
    });
  }

  function openExprModal() {
    openModal(
      "存进表达库",
      `
      <div class="field"><label>中文原意（可空）</label><textarea id="eZh" placeholder="我想更清楚地表达自己。"></textarea></div>
      <div class="field"><label>我的原表达</label><input type="text" id="eMine" placeholder="I want you express myself more clearly." /></div>
      <div class="field"><label>更自然的表达</label><input type="text" id="eNat" placeholder="I want you to help me express myself more clearly." /></div>
      <div class="field"><label>问题类型</label>
        <select id="eProb">${PROBLEM_TYPES.map((t) => `<option>${t}</option>`).join("")}</select>
      </div>
      <div class="field"><label>我的例句</label><input type="text" id="eEx" /></div>
      <div class="field"><label>分类</label>
        <select id="eCat">${EXPR_CATS.filter((c) => c !== "All")
          .map((c) => `<option>${c}</option>`)
          .join("")}</select>
      </div>
      <button type="button" class="btn btn-primary btn-block" id="eSave">保存</button>
      `,
      (close) => {
        document.getElementById("eSave").onclick = () => {
          const mine = document.getElementById("eMine").value.trim();
          const zh = document.getElementById("eZh").value.trim();
          if (!mine && !zh) return toast("请至少填写一句表达");
          state.expressions.push({
            id: uid(),
            zh,
            mine,
            natural: document.getElementById("eNat").value,
            problemType: document.getElementById("eProb").value,
            example: document.getElementById("eEx").value,
            keywords: "",
            category: document.getElementById("eCat").value,
            reviewStatus: 0,
            date: todayStr(),
          });
          save();
          close();
          toast("已加入表达库");
          if (document.getElementById("page-bank")?.classList.contains("active")) renderExpr();
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
    const byCount = { Listening: 0, Reading: 0, Speaking: 0, Writing: 0 };
    const daySet = new Set();
    logs.forEach((l) => {
      daySet.add(l.date);
      if (byType[l.type] != null) byType[l.type] += Number(l.minutes) || 0;
      else byType.Other += Number(l.minutes) || 0;
      if (byCount[l.type] != null) byCount[l.type]++;
    });
    const mocks = state.mocks.filter((m) => m.date.startsWith(ym));
    const exprs = state.expressions.filter((e) => (e.date || "").startsWith(ym));
    const errs = state.writingErrors.filter((e) => (e.date || "").startsWith(ym));
    const errCount = {};
    errs.forEach((e) => {
      errCount[e.type] = (errCount[e.type] || 0) + 1;
    });
    exprs.forEach((e) => {
      if (e.problemType) errCount[e.problemType] = (errCount[e.problemType] || 0) + 1;
    });
    const errTop = Object.entries(errCount).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const avoided = SKILLS.filter((k) => byCount[k] === 0);
    const tips = [];
    if (avoided.length) tips.push(`下月优先补：${avoided.join("、")}（本月几乎未练）`);
    if (errTop[0]) tips.push(`针对高频问题「${errTop[0][0]}」每周刻意练 1–2 次`);
    if (byCount.Writing < 2 && getPhase().id >= 2) tips.push("Writing 本月偏少，休息日至少完成 1 次完整产出");
    if (!tips.length) tips.push("节奏尚可，继续按排休推进，不欠债补课");

    document.getElementById("reviewBody").innerHTML = `
      <div><strong>我做了多少</strong></div>
      <div>学习天数 ${daySet.size} · 总时长 ${(totalMin / 60).toFixed(1)} h · 记录 ${logs.length} 条</div>
      <div style="margin-top:6px">Speaking ${byCount.Speaking} 次 · Writing ${byCount.Writing} 次 · Listening ${byCount.Listening} 次 · Reading ${byCount.Reading} 次</div>
      <div style="margin-top:10px"><strong>我主要练了什么</strong></div>
      <div>L ${(byType.Listening / 60).toFixed(1)}h · R ${(byType.Reading / 60).toFixed(1)}h · S ${(byType.Speaking / 60).toFixed(1)}h · W ${(byType.Writing / 60).toFixed(1)}h</div>
      <div style="margin-top:10px"><strong>我反复错什么</strong></div>
      <div>${errTop.length ? errTop.map(([k, v]) => `${k} ×${v}`).join(" · ") : "本月暂无错误标记"}</div>
      <div style="margin-top:10px"><strong>哪一项被回避</strong></div>
      <div>${avoided.length ? avoided.join("、") : "四科都有接触"}</div>
      <div style="margin-top:10px"><strong>模考 / 表达</strong></div>
      <div>模考 ${mocks.length} 次 · 新增表达 ${exprs.length} 条</div>
      <div style="margin-top:10px"><strong>下月 1–3 条调整</strong></div>
      <div>${tips.map((t, i) => `${i + 1}. ${t}`).join("<br>")}</div>
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

    document.querySelectorAll("#energyRow .energy-btn").forEach((b) => {
      b.onclick = () => {
        setEnergy(b.dataset.e);
        const msg = {
          normal: "正常负荷 · 直接开始即可",
          tired: "轻量模式 · 约 20 分钟",
          exhausted: "最低连接 · 10–15 分钟，不追求进度",
          off: "今日休息已记录 · 不是失败",
        };
        toast(msg[b.dataset.e] || "已更新状态");
        renderHome();
      };
    });

    document.getElementById("btnModeToggle").onclick = () => {
      const cur = getDayMode();
      setDayMode(cur === "work" ? "rest" : "work");
      toast(cur === "work" ? "已切到休息日深度学习" : "已切到工作日连接模式");
      renderHome();
    };

    document.getElementById("btnAdjustPlan").onclick = () => {
      openModal(
        "调整今日计划",
        `
        <p class="hint-text" style="margin-bottom:12px">系统已根据本周平衡自动安排。你可以临时调整：</p>
        <button type="button" class="btn btn-block" id="adjRegen" style="margin-bottom:8px">按当前状态重新生成计划</button>
        <button type="button" class="btn btn-block" id="adjTired" style="margin-bottom:8px">标记疲劳 · 轻量计划</button>
        <button type="button" class="btn btn-block" id="adjMin" style="margin-bottom:8px">很累 · 只留保底任务</button>
        <button type="button" class="btn btn-block" id="adjOff" style="margin-bottom:8px">今天不学</button>
        <div class="field" style="margin-top:12px">
          <label>本阶段手动重点（影响优先级）</label>
          <select id="adjFocus">
            <option value="">自动</option>
            ${SKILLS.map((s) => `<option value="${s}" ${state.settings.focusSkill === s ? "selected" : ""}>${s}</option>`).join("")}
          </select>
        </div>
        <button type="button" class="btn btn-primary btn-block" id="adjFocusSave">保存重点并刷新计划</button>
        `,
        (close) => {
          document.getElementById("adjRegen").onclick = () => {
            ensureTasks(todayStr(), true);
            close();
            renderHome();
            toast("已重新生成");
          };
          document.getElementById("adjTired").onclick = () => {
            setEnergy("tired");
            close();
            renderHome();
          };
          document.getElementById("adjMin").onclick = () => {
            setEnergy("exhausted");
            close();
            renderHome();
          };
          document.getElementById("adjOff").onclick = () => {
            setEnergy("off");
            close();
            renderHome();
          };
          document.getElementById("adjFocusSave").onclick = () => {
            state.settings.focusSkill = document.getElementById("adjFocus").value;
            ensureTasks(todayStr(), true);
            save();
            close();
            renderHome();
            toast("重点已更新");
          };
        }
      );
    };

    const moreBtn = document.getElementById("btnMoreHome");
    if (moreBtn) {
      moreBtn.onclick = () => {
        const el = document.getElementById("moreHome");
        const open = el.style.display !== "none";
        el.style.display = open ? "none" : "block";
        moreBtn.textContent = open ? "显示更多 · 成绩与进度 ▾" : "收起 ▴";
      };
    }

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
