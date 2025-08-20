/***********************************************
 * app.rag.js
 * Enhancement layer for RAG + Run-Command + UI
 * Load this BEFORE your main app.js (or at top)
 ***********************************************/

// Immediately-invoked safe wrapper
(function () {
  // Avoid double-loading
  if (window.__SAP_RAG_LOADED__) {
    console.log("app.rag.js: already loaded, skipping.");
    return;
  }
  window.__SAP_RAG_LOADED__ = true;
  console.log("app.rag.js: enhancement layer loaded.");

  // -------------------------
  // Config
  // -------------------------
  const CHAT_ENDPOINT = "/.netlify/functions/chatbot";
  const RUN_COMMAND_ENDPOINT = "/.netlify/functions/run-command";

  // -------------------------
  // Small util helpers
  // -------------------------
  function safeQuery(selector, root = document) {
    try { return root.querySelector(selector); } catch(e){ return null; }
  }
  function safeQueryAll(selector, root = document) {
    try { return Array.from(root.querySelectorAll(selector)); } catch(e){ return []; }
  }
  function el(tag, attrs = {}, children = []) {
    const e = document.createElement(tag);
    for (const k in attrs) {
      if (k === "class") e.className = attrs[k];
      else if (k === "style") e.style.cssText = attrs[k];
      else e.setAttribute(k, attrs[k]);
    }
    children.forEach(c => e.appendChild(typeof c === "string" ? document.createTextNode(c) : c));
    return e;
  }

  // -------------------------
  // Chatbot / RAG helpers
  // -------------------------
  async function askChatbot(query) {
    const resp = await fetch(CHAT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query })
    });
    if (!resp.ok) {
      const text = await resp.text().catch(()=>"");
      throw new Error(`Chatbot failed: ${resp.status} ${text}`);
    }
    return resp.json();
  }

  // Keep compatibility with older code expecting runCommand(checkId)
  async function runCommand(checkId) {
    const resp = await fetch(RUN_COMMAND_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ check_id: Number(checkId) })
    });
    if (!resp.ok) {
      const text = await resp.text().catch(()=>"");
      throw new Error(`Run-command failed: ${resp.status} ${text}`);
    }
    return resp.json();
  }

  // -------------------------
  // Chat UI: ensure elements exist (non-destructive)
  // -------------------------
  // If the page already has a chat area, prefer it. Otherwise create one and append to body.
  (function ensureChatUI() {
    const btn = document.getElementById("chatbot-btn");
    const panel = document.getElementById("chatbot-panel");
    const closeBtn = document.getElementById("chatbot-close");
    const messages = document.getElementById("chatbot-messages");
    const input = document.getElementById("chat-input");
    const sendBtn = document.getElementById("chat-send");

    if (!btn || !panel || !closeBtn || !messages || !input || !sendBtn) {
      console.warn("Chatbot elements not found in DOM");
      return;
    }

      // === Make chatbot draggable ===
    let isDragging = false;
    let offsetX, offsetY;

    const floatWrapper = panel;

    if (floatWrapper) {
      // Start drag on header
      const header = panel.querySelector(".chatbot-header");
      header.style.cursor = "move";

      header.addEventListener("mousedown", (e) => {
        isDragging = true;
        offsetX = e.clientX - floatWrapper.offsetLeft;
        offsetY = e.clientY - floatWrapper.offsetTop;
        panel.classList.add("dragging");
      });

      document.addEventListener("mousemove", (e) => {
        if (isDragging) {
          floatWrapper.style.left = e.clientX - offsetX + "px";
          floatWrapper.style.top = e.clientY - offsetY + "px";
          floatWrapper.style.position = "fixed";
        }
      });

      document.addEventListener("mouseup", () => {
        isDragging = false;
        panel.classList.remove("dragging");
      });
    }


    // Toggle open/close
    btn.addEventListener("click", () => {
      panel.classList.toggle("hidden");
    });
    closeBtn.addEventListener("click", () => {
      panel.classList.add("hidden");
    });

    // Message helpers
    function addMessage(role, text) {
      const msg = document.createElement("div");
      msg.className = `chat-message ${role}`;
      msg.innerHTML = `<div class="message-content">${text}</div>`;
      messages.appendChild(msg);
      messages.scrollTop = messages.scrollHeight;
      return msg;
    }

    function updateMessage(msg, text) {
      msg.querySelector(".message-content").innerText = text;
    }

    async function handleSend() {
      const query = input.value.trim();
      if (!query) return;

      addMessage("user", query);
      input.value = "";

      const botMsg = addMessage("bot", "Thinking...");

      try {
        const result = await askChatbot(query);
        updateMessage(botMsg, result.answer);

        // Drilldowns if available
        if (result.sources) {
          result.sources.forEach(src => {
            if (src.command_query && src.command_query.startsWith("dashboard://")) {
              const drill = document.createElement("button");
              drill.className = "drilldown-btn";
              drill.innerText = `🔎 Drilldown: ${src.checkname}`;
              drill.addEventListener("click", () => openDrilldown(src.command_query));
              messages.appendChild(drill);
            }
          });
        }
      } catch (err) {
        updateMessage(botMsg, "Error: " + err.message);
      }
    }

    // Send on button click
    sendBtn.addEventListener("click", handleSend);

    // Send on Enter key
    input.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSend();
      }
    });
  })();



  // chat-message utilities
  function addChatMessage(role, text) {
    const box = safeQuery("#chatMessages");
    if (!box) return null;
    const msg = el("div", { class: `chat-message ${role}` }, [text]);
    const id = "rag_msg_" + Date.now() + "_" + Math.floor(Math.random()*1000);
    msg.id = id;
    box.appendChild(msg);
    box.scrollTop = box.scrollHeight;
    return id;
  }
  function updateChatMessage(id, text) {
    const elMsg = safeQuery("#" + id);
    if (elMsg) elMsg.innerText = text;
  }

  // Hook chat form submission (idempotent)
  (function wireChatForm() {
    const form = safeQuery("#chatForm");
    if (!form) return;
    // Prevent multiple bindings
    if (form.__rag_bound__) return;
    form.__rag_bound__ = true;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const input = safeQuery("#chatInput", form);
      if (!input) return;
      const query = (input.value || "").trim();
      if (!query) return;
      addChatMessage("user", query);
      input.value = "";
      const loadingId = addChatMessage("bot", "Thinking...");

      try {
        const data = await askChatbot(query);
        const answer = (data && data.answer) ? data.answer : (data?.response || "No answer");
        updateChatMessage(loadingId, answer);

        // If sources exist and have drilldown links, add buttons
        if (Array.isArray(data.sources)) {
          data.sources.forEach(src => {
            if (src.command_query && typeof src.command_query === "string" && src.command_query.startsWith("dashboard://")) {
              const btn = el("button", { class: "drilldown-btn", "data-drill": src.command_query }, [`Drill: ${src.checkname}`]);
              btn.addEventListener("click", () => openDrilldown(src.command_query));
              const box = safeQuery("#chatMessages");
              box.appendChild(btn);
            }
          });
        }
      } catch (err) {
        updateChatMessage(loadingId, "Error: " + (err.message || err));
        console.error("RAG chat error:", err);
      }
    });
  })();

  // -------------------------
  // Run command button wiring (idempotent)
  // -------------------------
  function wireRunCommandButtons(root = document) {
    const runBtns = safeQueryAll(".run-command-btn", root);
    runBtns.forEach(btn => {
      if (btn.__rag_bound__) return;
      btn.__rag_bound__ = true;
      btn.addEventListener("click", async (ev) => {
        const checkId = btn.dataset.checkId || btn.getAttribute("data-check-id");
        if (!checkId) {
          alert("run-command: missing data-check-id");
          return;
        }
        btn.disabled = true;
        const orig = btn.innerText;
        btn.innerText = "Running...";
        try {
          const res = await runCommand(checkId);
          // The run-command function we wrote earlier returns { check, result } structure
          // We show output in a small modal/popup.
          let output = res?.result?.output ?? res?.output ?? res;
          showCommandPopup(checkId, output);
        } catch (err) {
          alert("Run command error: " + (err.message || err));
        } finally {
          btn.disabled = false;
          btn.innerText = orig;
        }
      });
    });
  }
  // wire now and also watch for dynamic DOM later
  wireRunCommandButtons();
  // observe DOM additions and re-wire buttons (useful if SPA or dynamic content)
  const bodyObserver = new MutationObserver(() => wireRunCommandButtons());
  bodyObserver.observe(document.body, { childList: true, subtree: true });

  // -------------------------
  // AI Analysis Buttons wiring
  // -------------------------
  function wireAIAnalysisButtons(root = document) {
    const aiBtns = safeQueryAll(".ai-analysis-btn", root);
    aiBtns.forEach(btn => {
      if (btn.__rag_bound__) return;
      btn.__rag_bound__ = true;
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        const orig = btn.innerText;
        btn.innerText = "Analyzing...";
        try {
          // Use dataset.query if provided, otherwise derive from check name data
          const q = btn.dataset.query || btn.getAttribute("data-query") || `Analyze check id:${btn.dataset.checkId || btn.getAttribute("data-check-id")}`;
          const res = await askChatbot(q);
          // show modal
          showAnalysisResult(res.answer || res?.response || "No analysis", res.sources || []);
        } catch (err) {
          alert("AI Analysis error: " + (err.message || err));
        } finally {
          btn.disabled = false;
          btn.innerText = orig;
        }
      });
    });
  }
  wireAIAnalysisButtons();
  // MutationObserver to re-run wiring on dynamic page parts
  const aiObserver = new MutationObserver(() => wireAIAnalysisButtons());
  aiObserver.observe(document.body, { childList: true, subtree: true });

  // -------------------------
  // Drilldown: open dashboard://... links
  // -------------------------
  function openDrilldown(link) {
    if (!link || typeof link !== "string") return;
    const key = link.replace(/^dashboard:\/\//, "");
    console.log("openDrilldown ->", key);
    // Try data-dashboard matches
    const target = safeQuery(`[data-dashboard='${key}']`) || safeQuery(`#${key}`) || safeQuery(`.${key.replace(/[\/:]/g,"-")}`);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      target.classList.add("rag-highlight");
      setTimeout(()=>target.classList.remove("rag-highlight"), 3000);
      return;
    }
    // fallback: show an alert
    alert("Drilldown section not present on page: " + key);
  }

  // -------------------------
  // Modal / popup helpers
  // -------------------------
  // create a minimal modal if none exists
  (function ensureModal() {
    if (safeQuery("#rag-analysis-modal")) return;
    const modal = el("div", { id: "rag-analysis-modal", class: "rag-modal", style: "display:none" });
    const content = el("div", { class: "rag-modal-content" });
    const close = el("button", { class: "rag-modal-close" }, ["Close"]);
    close.addEventListener("click", () => modal.style.display = "none");
    content.appendChild(el("h3", {}, ["AI Analysis"]));
    content.appendChild(el("div", { id: "rag-modal-body", class: "rag-modal-body" }, []));
    content.appendChild(close);
    modal.appendChild(content);
    document.body.appendChild(modal);
  })();

  function showAnalysisResult(htmlOrText, sources = []) {
    const modal = safeQuery("#rag-analysis-modal");
    const body = safeQuery("#rag-modal-body");
    if (!modal || !body) return;
    body.innerHTML = ""; // reset
    const p = el("div", {}, [ document.createTextNode(typeof htmlOrText === "string" ? htmlOrText : JSON.stringify(htmlOrText)) ]);
    body.appendChild(p);
    if (Array.isArray(sources) && sources.length > 0) {
      const list = el("ul", {});
      sources.forEach(s => {
        const li = el("li", {}, [
          el("div", { class: "rag-src-name" }, [ s.checkname || s.name || "unnamed" ]),
          el("div", { class: "rag-src-meta" }, [ s.command_query || s.command || "" ])
        ]);
        // Drilldown button if available
        if (s.command_query && s.command_query.startsWith("dashboard://")) {
          const dbtn = el("button", { class: "drilldown-btn" }, ["Open Drilldown"]);
          dbtn.addEventListener("click", () => openDrilldown(s.command_query));
          li.appendChild(dbtn);
        }
        list.appendChild(li);
      });
      body.appendChild(el("h4", {}, ["Sources"]));
      body.appendChild(list);
    }
    modal.style.display = "block";
  }

  function showCommandPopup(checkId, output) {
    const existing = safeQuery("#rag-command-popup");
    if (existing) existing.remove();
    const popup = el("div", { id: "rag-command-popup", class: "rag-command-popup" });
    const title = el("h4", {}, [`Command Output — Check #${checkId}`]);
    const pre = el("pre", {}, [ JSON.stringify(output, null, 2) ]);
    const close = el("button", {}, ["Close"]);
    close.addEventListener("click", () => popup.remove());
    popup.appendChild(title);
    popup.appendChild(pre);
    popup.appendChild(close);
    document.body.appendChild(popup);
  }

  // -------------------------
  // Minor cleanup classes (visual feedback)
  // -------------------------
  const style = document.createElement("style");
  style.innerHTML = `
    /* RAG UI additions */
    .chatbot-rag { position: fixed; right: 18px; bottom: 18px; width: 340px; max-height: 70vh; background: linear-gradient(180deg,#350a4a,#2b0533); color: #fff; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.4); padding: 12px; z-index: 9999; }
    .chatbot-rag .chatbot-rag-header { font-weight:700; margin-bottom:8px; }
    .chat-messages { overflow:auto; max-height:50vh; padding:8px; }
    .chat-message.user { background: rgba(255,255,255,0.08); padding:8px; margin:6px 0; border-radius:8px; color:#fff; }
    .chat-message.bot { background: rgba(0,0,0,0.2); padding:8px; margin:6px 0; border-radius:8px; color:#fff; }
    .chat-form { display:flex; gap:8px; margin-top:8px; }
    .chat-form input { flex:1; padding:8px; border-radius:8px; border:1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.03); color:#fff; }
    .chat-form button { padding:8px 12px; border-radius:8px; border:none; background:#7b2cbf; color:#fff; cursor:pointer; }
    .rag-modal { position:fixed; inset:0; display:flex; align-items:center; justify-content:center; background: rgba(0,0,0,0.5); z-index: 99999; }
    .rag-modal-content { background:#2b0633; color:#fff; padding:18px; border-radius:10px; width: min(900px, 96%); max-height: 86vh; overflow:auto; }
    .rag-modal-close { margin-top:12px; background:#7b2cbf; border:none; padding:8px 10px; border-radius:6px; color:#fff; cursor:pointer; }
    .rag-highlight { box-shadow: 0 0 0 4px rgba(123,44,191,0.14) inset; transition: box-shadow 300ms ease; }
    .rag-command-popup { position: fixed; left:50%; top:50%; transform: translate(-50%,-50%); background:#1b0420; color:#fff; padding:16px; border-radius:8px; z-index:99999; width: min(900px, 95%); max-height:80vh; overflow:auto; }
    .drilldown-btn { margin:6px 6px 0 0; background:#ffd166; border:none; padding:6px 10px; border-radius:6px; cursor:pointer; }
  `;
  document.head.appendChild(style);

  // -------------------------
  // Expose a small API for the main app to use if needed
  // -------------------------
  window.SAP_RAG = {
    askChatbot,
    runCommand,
    openDrilldown,
    showAnalysisResult,
    showCommandPopup
  };

  console.log("app.rag.js: API exposed at window.SAP_RAG");

})(); // end wrapper
