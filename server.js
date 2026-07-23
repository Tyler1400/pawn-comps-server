<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
<title>Counter Offer</title>
<style>
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  body {
    margin: 0;
    background: #1B1712;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
  #app {
    max-width: 420px; margin: 0 auto; min-height: 100vh; background: #1B1712;
    display: flex; flex-direction: column;
  }
  #main { flex: 1; padding-bottom: 88px; }
  input {
    width: 100%; box-sizing: border-box; background: #332A20;
    border: 1px solid #4A3D2E; color: #F2E9D8; padding: 10px 12px; font-size: 14px;
  }
  button { cursor: pointer; font-family: inherit; }
  .label {
    font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase;
    color: #8A7F6A; margin-bottom: 8px; font-weight: 600;
  }
  .perf {
    display: flex; justify-content: space-between; padding: 0 10px;
    margin-top: -7px; margin-bottom: -7px; position: relative; z-index: 2;
  }
  .perf span { width: 10px; height: 10px; border-radius: 50%; background: #FFFFFF; display: block; }
  .spin { animation: spin 0.9s linear infinite; display: inline-block; }
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  .navbar {
    position: fixed; bottom: 0; left: 50%; transform: translateX(-50%);
    width: 100%; max-width: 420px; display: flex; background: #22190F;
    border-top: 1px solid #3A2F24; padding: 8px 8px calc(8px + env(safe-area-inset-bottom));
  }
  .navbtn {
    flex: 1; background: none; border: none; display: flex; flex-direction: column;
    align-items: center; gap: 4px; padding: 8px 4px; color: #8A7F6A;
  }
  .navbtn.active { color: #D9B87C; }
  .navbtn span.label2 { font-size: 11px; font-weight: 600; letter-spacing: 0.02em; }
  .thumb { position: relative; width: 68px; height: 68px; }
  .thumb img { width: 100%; height: 100%; object-fit: cover; border: 1px solid #B8874A; }
  .thumb button {
    position: absolute; top: -6px; right: -6px; width: 20px; height: 20px;
    border-radius: 50%; background: #9C4A32; border: none; color: #fff;
    display: flex; align-items: center; justify-content: center; font-size: 12px; line-height: 1;
  }
</style>
</head>
<body>
<div id="app"></div>
<script>
const INK = "#2B2620", PAPER = "#F2E9D8", PAPER_DARK = "#E6D9BF";
const COUNTER = "#1B1712", COUNTER_2 = "#26201A";
const BRASS = "#B8874A", BRASS_LIGHT = "#D9B87C", RUST = "#9C4A32", GREEN = "#3E6B4F";

const state = {
  view: "home",
  photos: [],
  itemName: "",
  notes: "",
  ebayValue: "",
  apiUrl: localStorage.getItem("pawn_api_url") || "",
  showSettings: false,
  ebayStep: "form",
  lookupState: "idle",
  compsCount: null,
  history: [],
};

function fmt(n) {
  if (isNaN(n)) return "$0";
  return "$" + Math.round(n).toLocaleString("en-US");
}

function perfRow() {
  return `<div class="perf">${Array(14).fill('<span></span>').join("")}</div>`;
}

const ICON_EBAY = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 12V6a2 2 0 0 1 2-2h6l8 8-8 8-8-8Z"/><circle cx="8.5" cy="8.5" r="1.4" fill="currentColor" stroke="none"/></svg>`;
const ICON_GUN = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M3 14h9v-2.5h4.5V14H19v2h-1v2h-3v-2h-3.2L10 19H7v-3H5a2 2 0 0 1-2-2Z"/><path d="M12 11.5V8h3l2 3.5"/></svg>`;
const ICON_DIAMOND = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M6 4h12l4 5-10 11L2 9Z"/><path d="M2 9h20M9 4l-3 5 6 11 6-11-3-5"/></svg>`;

function header() {
  return `
    <div style="background:${COUNTER_2}; padding:22px 20px 18px; border-bottom:1px solid #3A2F24;">
      <div style="display:flex; align-items:center; justify-content:space-between;">
        <div style="display:flex; align-items:center; gap:10px;">
          ${state.view !== "home" ? `<button id="backBtn" aria-label="Back" style="background:none; border:none; color:${BRASS_LIGHT}; font-size:20px; padding:0 4px 0 0;">←</button>` : ""}
          <div>
            <div style="font-family:Georgia, serif; font-weight:700; font-size:20px; color:${BRASS_LIGHT};">Counter Offer</div>
            <div style="font-size:12px; color:#8A7F6A; margin-top:2px;">${
              state.view === "home" ? "Instant buy price, three ways" :
              state.view === "ebay" ? "eBay sold comps" :
              state.view === "guns" ? "Gun values" : "Jewelry values"
            }</div>
          </div>
        </div>
        ${state.view === "ebay" ? `<button id="settingsBtn" aria-label="Settings" style="width:38px; height:38px; border-radius:50%; background:#332A20; border:1px solid #4A3D2E; color:${BRASS_LIGHT};">⚙</button>` : ""}
      </div>
      ${state.showSettings && state.view === "ebay" ? `
        <div style="margin-top:14px;">
          <div class="label">Comps server URL</div>
          <input id="apiUrlInput" value="${state.apiUrl}" placeholder="https://your-app-name.onrender.com" style="font-family:monospace; font-size:12px;" />
          <div style="font-size:11px; color:#6B6152; margin-top:6px;">The web address of your deployed comps server. Set this once.</div>
        </div>
      ` : ""}
    </div>
  `;
}

function homeScreen() {
  let html = `<div style="padding:28px 20px;">`;
  html += `
    <div style="text-align:center; padding:20px 0 30px;">
      <div style="font-size:13px; color:#8A7F6A;">Choose a category below to price an item</div>
    </div>
  `;
  if (state.history.length > 0) {
    html += `<div class="label">🕐 Recent items</div><div style="display:flex; flex-direction:column; gap:8px;">`;
    state.history.forEach(h => {
      html += `<div style="display:flex; align-items:center; gap:10px; background:#241D16; border:1px solid #3A2F24; padding:8px 10px;">
        <div style="flex:1; min-width:0;">
          <div style="color:${PAPER}; font-size:13px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${h.itemName}</div>
          <div style="color:#8A7F6A; font-size:11px;">${h.date} · ${h.category} · eBay ${fmt(h.ebayValue)}</div>
        </div>
        <div style="font-family:monospace; font-size:12px; color:${BRASS_LIGHT};">${fmt(h.low)}–${fmt(h.high)}</div>
      </div>`;
    });
    html += `</div>`;
  }
  html += `</div>`;
  return html;
}

function comingSoonScreen(name, icon) {
  return `
    <div style="padding:60px 30px; text-align:center;">
      <div style="width:64px; height:64px; border-radius:50%; background:#332A20; border:1px solid ${BRASS}; display:flex; align-items:center; justify-content:center; margin:0 auto 20px; color:${BRASS_LIGHT};">
        ${icon}
      </div>
      <div style="font-family:Georgia, serif; font-weight:700; font-size:17px; color:${PAPER}; margin-bottom:8px;">${name} values coming soon</div>
      <div style="font-size:13px; color:#8A7F6A;">This category isn't set up yet. Use eBay lookup for now.</div>
    </div>
  `;
}

function ebayScreen() {
  const value = parseFloat(state.ebayValue) || 0;
  const low = value * 0.35, mid = value * 0.5, high = value * 0.7;
  let html = `<div style="padding:20px 20px 32px;">`;

  if (state.ebayStep === "form") {
    html += `
      <div style="margin-bottom:20px;">
        <div class="label">Photos (optional)</div>
        <div id="photoRow" style="display:flex; gap:8px; flex-wrap:wrap;">
          ${state.photos.map((p, i) => `
            <div class="thumb"><img src="${p}" /><button data-idx="${i}" class="removePhoto">×</button></div>
          `).join("")}
          <button id="addPhotoBtn" style="width:68px; height:68px; background:transparent; border:1px dashed ${BRASS}; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; color:${BRASS_LIGHT};">
            <span>📷</span><span style="font-size:10px;">Add</span>
          </button>
          <input id="photoInput" type="file" accept="image/*" capture="environment" multiple style="display:none;" />
        </div>
      </div>
      <div style="margin-bottom:14px;">
        <div class="label">Item</div>
        <input id="itemNameInput" value="${state.itemName}" placeholder="e.g. DeWalt 20V drill, cordless" />
      </div>
      <div style="margin-bottom:14px;">
        <div class="label">Condition notes</div>
        <input id="notesInput" value="${state.notes}" placeholder="e.g. light wear, missing case" />
      </div>
      <div style="margin-bottom:22px;">
        <div class="label">eBay sold value (last 30 days, US, median)</div>
    `;

    if (state.lookupState === "idle") {
      html += `<button id="lookupBtn" ${!state.itemName.trim() ? "disabled" : ""} style="width:100%; background:transparent; border:1px dashed ${BRASS}; color:${state.itemName.trim() ? BRASS_LIGHT : "#5A5142"}; padding:12px 0; font-size:13px; font-weight:600;">🔍 Look up eBay comps</button>`;
    } else if (state.lookupState === "loading") {
      html += `<div style="width:100%; border:1px dashed #4A3D2E; color:#8A7F6A; padding:12px 0; font-size:13px; text-align:center;"><span class="spin">⟳</span> Checking sold listings...</div>`;
    } else if (state.lookupState === "error") {
      html += `<div style="color:${RUST}; font-size:12px; margin-bottom:8px;">Couldn't reach the comps server. Enter the value manually below, or try the lookup again.</div>
        <button id="retryBtn" style="background:transparent; border:1px solid #4A3D2E; color:${BRASS_LIGHT}; padding:8px 14px; font-size:12px; margin-bottom:10px;">Retry lookup</button>`;
    }

    if (state.lookupState === "done" || state.lookupState === "error" || state.lookupState === "manual") {
      html += `
        <div style="position:relative; margin-top:8px;">
          <span style="position:absolute; left:12px; top:50%; transform:translateY(-50%); color:${BRASS_LIGHT}; font-size:15px; font-family:monospace;">$</span>
          <input id="ebayValueInput" value="${state.ebayValue}" placeholder="0" inputmode="decimal" style="padding-left:24px; font-size:18px; font-family:monospace; font-weight:700;" />
        </div>
      `;
    }
    if (state.lookupState === "done" && state.compsCount != null) {
      html += `<div style="font-size:11px; color:#6B6152; margin-top:6px;">Based on ${state.compsCount} sold listing${state.compsCount === 1 ? "" : "s"}. <button id="refreshBtn" style="background:none; border:none; color:${BRASS_LIGHT}; font-size:11px; text-decoration:underline; padding:0;">Refresh</button></div>`;
    }
    if (state.lookupState === "manual") {
      html += `<div style="font-size:11px; color:#6B6152; margin-top:6px;">✎ Entered manually.</div>`;
    }

    html += `</div>
      <button id="getOffersBtn" ${!value ? "disabled" : ""} style="width:100%; background:${value ? BRASS : "#4A3D2E"}; border:none; color:${value ? COUNTER : "#8A7F6A"}; padding:14px 0; font-size:14px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase;">Get offers →</button>
    `;
  } else {
    html += `
      <div style="display:flex; align-items:center; gap:10px; margin-bottom:18px;">
        ${state.photos[0] ? `<img src="${state.photos[0]}" style="width:46px; height:46px; object-fit:cover; border:1px solid ${BRASS};" />` : ""}
        <div>
          <div style="color:${PAPER}; font-size:15px; font-weight:600;">${state.itemName || "Untitled item"}</div>
          <div style="color:#8A7F6A; font-size:12px;">eBay sold median ${fmt(value)}</div>
        </div>
      </div>
      <div style="display:flex; flex-direction:column; gap:16px; margin-bottom:20px;">
        ${offerTicket("Low offer", "tight margin, quick turn", 35, low, RUST, "#3D1A0F")}
        ${offerTicket("Mid offer", "standard counter offer", 50, mid, BRASS, "#3D2A0F")}
        ${offerTicket("High offer", "mint condition, easy resale", 70, high, GREEN, "#12321F")}
      </div>
      <div style="display:flex; gap:10px;">
        <button id="editBtn" style="flex:1; background:transparent; border:1px solid #4A3D2E; color:${PAPER}; padding:12px 0; font-size:13px; font-weight:600;">Edit</button>
        <button id="saveBtn" style="flex:2; background:${BRASS}; border:none; color:${COUNTER}; padding:12px 0; font-size:13px; font-weight:700; letter-spacing:0.04em; text-transform:uppercase;">Save item</button>
      </div>
      <button id="discardBtn" style="width:100%; background:transparent; border:none; color:#8A7F6A; padding:10px 0 0; font-size:12px;">🗑 Discard, start new item</button>
    `;
  }
  html += `</div>`;
  return html;
}

function offerTicket(label, sublabel, pct, amount, accent, accentText) {
  return `
    <div style="position:relative;">
      ${perfRow()}
      <div style="background:${PAPER}; border:1px solid ${PAPER_DARK}; border-top:none; border-bottom:none; padding:14px 18px 16px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-family:Georgia, serif; font-weight:700; font-size:13px; letter-spacing:0.12em; text-transform:uppercase; color:${accentText};">${label}</div>
            <div style="font-size:11px; color:#8A7F6A; margin-top:2px;">${sublabel}</div>
          </div>
          <div style="font-family:Georgia, serif; font-weight:700; font-size:11px; color:${accentText}; background:${accent}; padding:3px 8px; transform:rotate(3deg); border:1px solid ${accentText};">${pct}%</div>
        </div>
        <div style="font-family:monospace; font-weight:700; font-size:34px; color:${INK}; margin-top:6px;">${fmt(amount)}</div>
      </div>
      ${perfRow()}
    </div>
  `;
}

function navbar() {
  function btn(id, icon, label, view) {
    const active = state.view === view;
    return `<button class="navbtn ${active ? "active" : ""}" data-view="${view}">${icon}<span class="label2">${label}</span></button>`;
  }
  return `
    <div class="navbar">
      ${btn("navEbay", ICON_EBAY, "eBay", "ebay")}
      ${btn("navGuns", ICON_GUN, "Guns", "guns")}
      ${btn("navJewelry", ICON_DIAMOND, "Jewelry", "jewelry")}
    </div>
  `;
}

function render() {
  let mainHtml = "";
  if (state.view === "home") mainHtml = homeScreen();
  else if (state.view === "ebay") mainHtml = ebayScreen();
  else if (state.view === "guns") mainHtml = comingSoonScreen("Gun", ICON_GUN);
  else if (state.view === "jewelry") mainHtml = comingSoonScreen("Jewelry", ICON_DIAMOND);

  document.getElementById("app").innerHTML = `
    ${header()}
    <div id="main">${mainHtml}</div>
    ${navbar()}
  `;
  attachHandlers();
}

async function handleLookup() {
  if (!state.itemName.trim()) return;
  if (!state.apiUrl.trim()) {
    state.showSettings = true;
    render();
    return;
  }
  state.lookupState = "loading";
  state.compsCount = null;
  render();
  try {
    const base = state.apiUrl.replace(/\/+$/, "");
    const res = await fetch(`${base}/api/comps?q=${encodeURIComponent(state.itemName.trim())}`);
    const data = await res.json();
    if (!res.ok || data.average == null) {
      state.lookupState = "error";
      render();
      return;
    }
    state.ebayValue = String(data.average);
    state.compsCount = data.count;
    state.lookupState = "done";
  } catch (e) {
    state.lookupState = "error";
  }
  render();
}

function handlePhotoFiles(files) {
  Array.from(files).forEach((file) => {
    const reader = new FileReader();
    reader.onload = () => {
      state.photos.push(reader.result);
      render();
    };
    reader.readAsDataURL(file);
  });
}

function attachHandlers() {
  document.querySelectorAll(".navbtn").forEach((b) => {
    b.onclick = () => { state.view = b.dataset.view; state.showSettings = false; render(); };
  });

  const backBtn = document.getElementById("backBtn");
  if (backBtn) backBtn.onclick = () => { state.view = "home"; render(); };

  const settingsBtn = document.getElementById("settingsBtn");
  if (settingsBtn) settingsBtn.onclick = () => { state.showSettings = !state.showSettings; render(); };

  const apiUrlInput = document.getElementById("apiUrlInput");
  if (apiUrlInput) apiUrlInput.oninput = (e) => {
    state.apiUrl = e.target.value;
    localStorage.setItem("pawn_api_url", state.apiUrl);
  };

  const addPhotoBtn = document.getElementById("addPhotoBtn");
  const photoInput = document.getElementById("photoInput");
  if (addPhotoBtn && photoInput) {
    addPhotoBtn.onclick = () => photoInput.click();
    photoInput.onchange = (e) => { handlePhotoFiles(e.target.files); e.target.value = ""; };
  }
  document.querySelectorAll(".removePhoto").forEach((b) => {
    b.onclick = () => {
      state.photos.splice(parseInt(b.dataset.idx, 10), 1);
      render();
    };
  });

  const itemNameInput = document.getElementById("itemNameInput");
  if (itemNameInput) {
    itemNameInput.oninput = (e) => { state.itemName = e.target.value; };
    itemNameInput.onblur = () => render();
  }

  const notesInput = document.getElementById("notesInput");
  if (notesInput) {
    notesInput.oninput = (e) => { state.notes = e.target.value; };
  }

  const ebayValueInput = document.getElementById("ebayValueInput");
  if (ebayValueInput) {
    ebayValueInput.oninput = (e) => {
      state.ebayValue = e.target.value.replace(/[^0-9.]/g, "");
      state.lookupState = "manual";
    };
    ebayValueInput.onblur = () => render();
  }

  const lookupBtn = document.getElementById("lookupBtn");
  if (lookupBtn) lookupBtn.onclick = handleLookup;

  const retryBtn = document.getElementById("retryBtn");
  if (retryBtn) retryBtn.onclick = handleLookup;

  const refreshBtn = document.getElementById("refreshBtn");
  if (refreshBtn) refreshBtn.onclick = handleLookup;

  const getOffersBtn = document.getElementById("getOffersBtn");
  if (getOffersBtn) getOffersBtn.onclick = () => {
    const value = parseFloat(state.ebayValue) || 0;
    if (!value) return;
    state.ebayStep = "offers";
    render();
  };

  const editBtn = document.getElementById("editBtn");
  if (editBtn) editBtn.onclick = () => { state.ebayStep = "form"; render(); };

  const saveBtn = document.getElementById("saveBtn");
  if (saveBtn) saveBtn.onclick = () => {
    const value = parseFloat(state.ebayValue) || 0;
    state.history.unshift({
      itemName: state.itemName || "Untitled item",
      category: "eBay",
      ebayValue: value,
      low: value * 0.35,
      mid: value * 0.5,
      high: value * 0.7,
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    });
    resetItem();
    state.view = "home";
    render();
  };

  const discardBtn = document.getElementById("discardBtn");
  if (discardBtn) discardBtn.onclick = () => { resetItem(); render(); };
}

function resetItem() {
  state.photos = [];
  state.itemName = "";
  state.notes = "";
  state.ebayValue = "";
  state.ebayStep = "form";
  state.lookupState = "idle";
  state.compsCount = null;
}

render();
</script>
</body>
</html>
