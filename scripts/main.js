// Manshoor App - Data & Settings are loaded asynchronously from /data/content.json & /data/settings.json
const MANSHOOR_FAVICON = "data:image/svg+xml," + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><polygon points='12,2 22,21 2,21' fill='none' stroke='%23e91e8c' stroke-width='2.5'/><polygon points='12,7 18,19 6,19' fill='%2306b6d4' opacity='0.4'/></svg>");
const CAMO_FAVICON = "data:image/svg+xml," + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'><path d='M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z'/><circle cx='12' cy='7' r='2.5' fill='%23f59e0b' stroke='none'/></svg>");

class ManshoorApp {
  constructor() {
    this.terms = [];
    this.posts = [];
    this.settings = null;
    this.currentFilter = "all";
    this.searchQuery = "";
    this.bookmarkedIds = new Set();
    this.isCamouflaged = false;
    this.isReadingMode = false;
    this.originalTitle = document.title;
    this.activeTerm = null;
    this.init();
  }

  async init() {
    this.updateFavicon(false);
    this.loadTheme();
    this.loadBookmarks();
    this.setupScrollProgress();
    this.setupEventListeners();
    this.setupSearchSuggestions();
    this.setupPWAAndOffline();
    await this.loadDataAndSettings();
  }

  async loadDataAndSettings() {
    // 1. Fetch settings
    try {
      const resSettings = await fetch("data/settings.json");
      if (resSettings.ok) {
        this.settings = await resSettings.json();
        this.applySettings();
      }
    } catch (e) {
      console.warn("Could not load settings.json, checking draft or defaults", e);
      try {
        const draftSettings = localStorage.getItem("manshoor_draft_settings");
        if (draftSettings) {
          this.settings = JSON.parse(draftSettings);
          this.applySettings();
        }
      } catch(err) {}
    }

    // 2. Fetch content
    try {
      const resContent = await fetch("data/content.json");
      if (!resContent.ok) throw new Error("HTTP " + resContent.status);
      const data = await resContent.json();
      if (Array.isArray(data)) {
        this.terms = data;
        this.posts = [];
      } else {
        this.terms = data.terms || [];
        this.posts = data.posts || [];
      }
      this.renderUpdatesWidget();
      this.renderCards();
      this.updateBookmarkBadges();
    } catch (err) {
      console.error("Error loading content.json:", err);
      // Check localStorage draft fallback
      try {
        const draft = localStorage.getItem("manshoor_draft_content");
        if (draft) {
          const data = JSON.parse(draft);
          this.terms = data.terms || data;
          this.posts = data.posts || [];
          this.renderUpdatesWidget();
          this.renderCards();
          this.updateBookmarkBadges();
          return;
        }
      } catch(e) {}
      this.renderErrorMessage();
    }
  }

  applySettings() {
    if (!this.settings) return;
    if (this.settings.siteName && !this.isCamouflaged) {
      document.title = this.settings.siteName;
      this.originalTitle = this.settings.siteName;
    }
    if (this.settings.tagline) {
      const descEl = document.querySelector(".hero-desc");
      if (descEl) descEl.textContent = this.settings.tagline;
    }
    if (this.settings.footerText) {
      const footerDesc = document.querySelector(".site-footer .footer-grid div p");
      if (footerDesc) footerDesc.textContent = this.settings.footerText;
    }
  }

  renderUpdatesWidget() {
    const container = document.getElementById("manshoorUpdatesContainer");
    if (!container || !this.posts || !this.posts.length) return;
    const latestPost = this.posts[0];
    const dismissed = sessionStorage.getItem("dismissed_manshoor_update_" + latestPost.id);
    if (dismissed) return;

    container.innerHTML = `
      <aside class="manshoor-updates-card" aria-label="تازه‌های منشور">
        <div class="updates-content">
          <div class="updates-meta">
            <span class="updates-label"><span class="updates-dot"></span>تازه‌های منشور</span>
            <span>·</span>
            <time>${latestPost.date || ''}</time>
          </div>
          <h2 class="updates-title">${latestPost.title}</h2>
          <p class="updates-text">${latestPost.content}</p>
        </div>
        <button type="button" class="updates-dismiss" title="بستن این پیام" aria-label="بستن این پیام" onclick="app.dismissUpdate('${latestPost.id}')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </aside>
    `;
  }

  dismissUpdate(postId) {
    sessionStorage.setItem("dismissed_manshoor_update_" + postId, "true");
    const card = document.querySelector(".manshoor-updates-card");
    if (card) {
      card.style.transition = "opacity 0.2s, transform 0.2s";
      card.style.opacity = "0";
      card.style.transform = "translateY(-6px)";
      setTimeout(() => card.remove(), 220);
    }
  }

  renderErrorMessage() {
    const grid = document.getElementById("cardsGrid");
    if (!grid) return;
    grid.innerHTML = `
      <div class="empty-state error-state" style="padding:3.5rem 1.5rem;text-align:center;">
        <div style="width:56px;height:56px;border-radius:16px;background:rgba(239,68,68,0.12);color:var(--rainbow-red);display:flex;align-items:center;justify-content:center;margin:0 auto 1.25rem;">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        </div>
        <h3 style="font-size:1.25rem;font-weight:800;margin-bottom:0.75rem;color:var(--color-text);">بارگذاری پایگاه دانش با اختلال مواجه شد</h3>
        <p style="color:var(--color-text-secondary);max-width:480px;margin:0 auto 1.5rem;line-height:1.75;font-size:0.95rem;">
          با پوزش از شما مخاطب گرامی، در دریافت داده‌های دانشنامه منشور وقفه‌ای رخ داده است. لطفاً اتصال اینترنت خود را بازبینی فرموده و صفحه را مجدداً بارگذاری نمایید.
        </p>
        <button type="button" class="filter-chip active" onclick="location.reload()" style="padding:0.6rem 1.4rem;">
          بارگذاری مجدد دانشنامه
        </button>
      </div>
    `;
  }

  setupScrollProgress() {
    let track = document.getElementById("globalScrollTrack");
    let bar = document.getElementById("globalProgressBar");
    let tooltip = document.getElementById("globalScrollTooltip");
    if (!track) {
      track = document.createElement("div");
      track.id = "globalScrollTrack";
      track.className = "global-scroll-track";
      track.setAttribute("role", "progressbar");
      track.setAttribute("aria-valuemin", "0");
      track.setAttribute("aria-valuemax", "100");
      track.setAttribute("aria-valuenow", "0");
      track.setAttribute("aria-label", "میزان پیشرفت مطالعه صفحه");
      track.setAttribute("title", "برای رفتن به بخش‌های صفحه کلیک کنید");
      bar = document.createElement("div");
      bar.id = "globalProgressBar";
      bar.className = "global-progress-bar";
      track.appendChild(bar);
      tooltip = document.createElement("div");
      tooltip.id = "globalScrollTooltip";
      tooltip.className = "global-scroll-tooltip";
      tooltip.textContent = "پیشرفت مطالعه: ۰٪";
      document.body.prepend(tooltip);
      document.body.prepend(track);
    }
    const persianDigits = ["۰","۱","۲","۳","۴","۵","۶","۷","۸","۹"];
    const toPersian = num => String(num).replace(/\d/g, d => persianDigits[d]);
    let ticking = false;
    let hideTimer = null;
    const updateProgress = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
      const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const progress = scrollHeight > 0 ? Math.min(Math.max(scrollTop / scrollHeight, 0), 1) : 0;
      const percent = Math.round(progress * 100);
      bar.style.width = `${percent}%`;
      track.setAttribute("aria-valuenow", String(percent));
      tooltip.innerHTML = `پیشرفت مطالعه: <strong>${toPersian(percent)}٪</strong>`;
      tooltip.style.right = `clamp(10px, calc(${percent}% - 35px), calc(100vw - 115px))`;
      tooltip.classList.add("visible");
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => {
        tooltip.classList.remove("visible");
      }, 1500);
      ticking = false;
    };
    window.addEventListener("scroll", () => {
      if (!ticking) {
        requestAnimationFrame(updateProgress);
        ticking = true;
      }
    }, { passive: true });
    window.addEventListener("resize", () => {
      requestAnimationFrame(updateProgress);
    }, { passive: true });
    track.addEventListener("mousemove", e => {
      const rect = track.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (rect.right - e.clientX) / rect.width));
      const hoverPercent = Math.round(ratio * 100);
      tooltip.innerHTML = `پرش به: <strong>${toPersian(hoverPercent)}٪</strong>`;
      tooltip.style.right = `clamp(10px, calc(${hoverPercent}% - 35px), calc(100vw - 115px))`;
      tooltip.classList.add("visible");
    });
    track.addEventListener("mouseleave", () => {
      updateProgress();
    });
    track.addEventListener("click", e => {
      const rect = track.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (rect.right - e.clientX) / rect.width));
      const targetScroll = ratio * (document.documentElement.scrollHeight - document.documentElement.clientHeight);
      window.scrollTo({ top: targetScroll, behavior: "smooth" });
    });
    updateProgress();
  }

  loadTheme() {
    const savedTheme = localStorage.getItem("manshoor_theme") || "dark";
    if (savedTheme === "light") {
      document.documentElement.classList.add("light");
    } else {
      document.documentElement.classList.remove("light");
    }
    this.updateThemeIcon(savedTheme);
  }

  toggleTheme() {
    const isLight = document.documentElement.classList.toggle("light");
    const newTheme = isLight ? "light" : "dark";
    localStorage.setItem("manshoor_theme", newTheme);
    this.updateThemeIcon(newTheme);
    this.showToast(newTheme === "light" ? "تم روشن فعال شد." : "تم تاریک فعال شد.");
  }

  updateThemeIcon(theme) {
    const themeIcon = document.getElementById("themeIcon");
    if (!themeIcon) return;
    if (theme === "light") {
      themeIcon.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
    } else {
      themeIcon.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
    }
  }

  loadBookmarks() {
    try {
      const data = localStorage.getItem("manshoor_bookmarks");
      if (data) {
        this.bookmarkedIds = new Set(JSON.parse(data));
      }
    } catch(e) {
      console.error("Error loading bookmarks", e);
    }
  }

  saveBookmarks() {
    try {
      localStorage.setItem("manshoor_bookmarks", JSON.stringify(Array.from(this.bookmarkedIds)));
    } catch(e) {
      console.error("Error saving bookmarks", e);
    }
  }

  toggleBookmark(termId) {
    const term = (this.terms || []).find(t => t.id === termId);
    const name = term ? term.persianName : "اصطلاح";
    if (this.bookmarkedIds.has(termId)) {
      this.bookmarkedIds.delete(termId);
      this.showToast(`«${name}» از کتابخانه حذف شد.`);
    } else {
      this.bookmarkedIds.add(termId);
      this.showToast(`«${name}» به کتابخانه من افزوده شد.`);
    }
    this.saveBookmarks();
    this.updateBookmarkBadges();
    this.updateModalBookmarkBtn(termId);
    if (this.currentFilter === "bookmarks") {
      this.renderCards();
    } else {
      const btns = document.querySelectorAll(`.bookmark-btn[data-id="${termId}"]`);
      btns.forEach(btn => {
        const active = this.bookmarkedIds.has(termId);
        btn.classList.toggle("active", active);
        const svg = btn.querySelector("svg");
        if (svg) svg.setAttribute("fill", active ? "currentColor" : "none");
      });
    }
  }

  updateBookmarkBadges() {
    const count = this.bookmarkedIds.size;
    const headerBadge = document.getElementById("headerBookmarkBadge");
    if (headerBadge) {
      headerBadge.textContent = count;
      headerBadge.style.display = count > 0 ? "flex" : "none";
    }
    const filterBadge = document.getElementById("bookmarksCount");
    if (filterBadge) {
      filterBadge.textContent = count;
    }
  }

  updateModalBookmarkBtn(termId) {
    const modalBtn = document.getElementById("modalBookmarkBtn");
    if (!modalBtn) return;
    const isBookmarked = this.bookmarkedIds.has(termId);
    modalBtn.classList.toggle("active", isBookmarked);
    const svg = modalBtn.querySelector("svg");
    if (svg) svg.setAttribute("fill", isBookmarked ? "currentColor" : "none");
    const textSpan = modalBtn.querySelector(".btn-text");
    if (textSpan) {
      textSpan.textContent = isBookmarked ? "نشان‌شده در کتابخانه (حذف)" : "افزودن به کتابخانه من";
    }
  }

  normalizeSearchText(text) {
    if (!text) return "";
    return String(text).toLowerCase()
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .replace(/[ي]/g, "ی")
      .replace(/[ك]/g, "ک")
      .replace(/[أإآ]/g, "ا")
      .replace(/[ة]/g, "ه")
      .replace(/[ئ]/g, "ی")
      .replace(/[\u064B-\u065F]/g, "")
      .replace(/[-_.]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  highlightMatch(text, query) {
    if (!query || !text) return text;
    const qClean = query.trim();
    if (!qClean) return text;
    try {
      const escaped = qClean.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
      const regex = new RegExp(`(${escaped})`, "gi");
      return text.replace(regex, '<mark class="search-highlight">$1</mark>');
    } catch(e) {
      return text;
    }
  }

  clearSearch() {
    const sInput = document.getElementById("searchInput");
    const sClear = document.getElementById("searchClearBtn");
    if (sInput) sInput.value = "";
    this.searchQuery = "";
    if (sClear) sClear.style.display = "none";
    this.renderCards();
    if (sInput) sInput.focus();
  }

  renderCards() {
    const grid = document.getElementById("cardsGrid");
    if (!grid) return;
    const persianDigits = ["۰","۱","۲","۳","۴","۵","۶","۷","۸","۹"];
    const toPersian = num => String(num).replace(/\d/g, d => persianDigits[d]);
    grid.innerHTML = "";
    const qNorm = this.normalizeSearchText(this.searchQuery);
    const filtered = (this.terms || []).filter(term => {
      if (this.currentFilter === "bookmarks" && !this.bookmarkedIds.has(term.id)) return false;
      if (this.currentFilter === "level-1" && term.level !== 1) return false;
      if (this.currentFilter === "level-2" && term.level !== 2) return false;
      if (this.currentFilter === "level-3" && term.level !== 3) return false;
      if (qNorm) {
        const pool = this.normalizeSearchText(`${term.letter} ${term.persianName} ${term.englishTerm} ${term.category} ${term.shortDef} ${term.fullArticle} ${term.science}`);
        const tokens = qNorm.split(" ").filter(Boolean);
        return tokens.every(tok => pool.includes(tok));
      }
      return true;
    });

    let statusEl = document.getElementById("searchStatusBar");
    if (this.searchQuery && this.searchQuery.trim()) {
      if (!statusEl) {
        statusEl = document.createElement("div");
        statusEl.id = "searchStatusBar";
        statusEl.className = "search-status-bar";
        grid.parentNode.insertBefore(statusEl, grid);
      }
      statusEl.style.display = "flex";
      statusEl.innerHTML = `<span>یافت شد: <strong>${toPersian(filtered.length)}</strong> مورد برای «${this.searchQuery.trim()}»</span><button type="button" class="search-reset-link" onclick="app.clearSearch()">پاک کردن جستجو</button>`;
    } else if (statusEl) {
      statusEl.style.display = "none";
    }

    if (filtered.length === 0) {
      if (this.searchQuery && this.searchQuery.trim()) {
        grid.innerHTML = `<div class="empty-state"><h3 style="font-size:1.15rem;font-weight:700;margin-bottom:0.5rem;">اصطلاحی با «${this.searchQuery.trim()}» یافت نشد</h3><p style="color:var(--color-text-muted);margin-bottom:1.25rem;">املا را بررسی کنید یا عبارت دیگری را جستجو نمایید.</p><button type="button" class="filter-chip active" onclick="app.clearSearch()">پاک کردن فیلتر جستجو</button></div>`;
      } else if (this.currentFilter === "bookmarks") {
        grid.innerHTML = `<div class="empty-state"><div class="empty-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg></div><h3 style="font-size:1.25rem;font-weight:800;margin-bottom:0.5rem;">کتابخانه شما هنوز خالی است</h3><p style="color:var(--color-text-secondary);max-width:480px;margin:0 auto 1.5rem;">با کلیک روی دکمه نشان‌کتاب (🔖) در هر کارت می‌توانید اصطلاحات مورد نظرتان را برای دسترسی سریع‌تر ذخیره کنید.</p><button class="filter-chip active" onclick="app.setFilter('all')">مشاهده همه اصطلاحات</button></div>`;
      } else {
        grid.innerHTML = `<div class="empty-state"><h3 style="font-size:1.15rem;font-weight:700;margin-bottom:0.5rem;">موردی در این دسته‌بندی یافت نشد</h3><p style="color:var(--color-text-muted);">لطفاً فیلتر را تغییر دهید.</p></div>`;
      }
      return;
    }

    filtered.forEach((term, index) => {
      const isBookmarked = this.bookmarkedIds.has(term.id);
      const card = document.createElement("article");
      card.className = "term-card glass-card";
      card.setAttribute("role", "button");
      card.setAttribute("tabindex", "0");
      card.style.setProperty("--card-index", String(index));
      const highlightedTitle = this.highlightMatch(term.persianName, this.searchQuery);
      const highlightedDesc = this.highlightMatch(term.shortDef, this.searchQuery);
      const highlightedEnglish = this.highlightMatch(term.englishTerm, this.searchQuery);
      card.innerHTML = `<div><div class="card-top"><div class="card-letter">${term.letter}</div><div style="display:flex;align-items:center;gap:0.5rem;"><span class="level-badge ${term.levelClass}"><span class="level-dot"></span>${term.levelName}</span><button class="bookmark-btn ${isBookmarked ? "active" : ""}" data-id="${term.id}" title="نشان‌کتاب" aria-label="نشان‌کتاب"><svg width="15" height="15" viewBox="0 0 24 24" fill="${isBookmarked ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2.2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg></button></div></div><h3 class="card-title">${highlightedTitle}</h3><div class="card-english">${highlightedEnglish}</div><p class="card-desc">${highlightedDesc}</p></div><div class="card-footer"><span>مطالعه مقاله و کج‌فهمی‌ها</span><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg></div>`;
      const bBtn = card.querySelector(".bookmark-btn");
      if (bBtn) {
        bBtn.addEventListener("click", e => {
          e.stopPropagation();
          this.toggleBookmark(term.id);
        });
      }
      card.addEventListener("click", () => this.openDetailModal(term));
      card.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          this.openDetailModal(term);
        }
      });
      grid.appendChild(card);
    });
  }

  setFilter(filterName) {
    this.currentFilter = filterName;
    const chips = document.querySelectorAll(".filter-chip[data-filter]");
    chips.forEach(c => {
      c.classList.toggle("active", c.getAttribute("data-filter") === filterName);
    });
    this.renderCards();
  }

  openDetailModal(term) {
    this.ensureModal();
    this.setReadingMode(false);
    this.activeTerm = term;
    const modal = document.getElementById("detailModal");
    if (!modal) return;
    document.getElementById("modalLetter").textContent = term.letter;
    document.getElementById("modalTitle").textContent = term.persianName;
    document.getElementById("modalEnglish").textContent = term.englishTerm;
    const badge = document.getElementById("modalBadge");
    badge.className = `level-badge ${term.levelClass}`;
    const modalArt = document.getElementById("modalArticle");
    if (modalArt) {
      modalArt.className = "modal-article markdown-body";
      modalArt.innerHTML = this.renderMarkdown(term.fullArticle);
    }
    const modalSci = document.getElementById("modalScience");
    if (modalSci) {
      modalSci.className = "science-box-text markdown-body";
      modalSci.innerHTML = this.renderMarkdown(term.science);
    }

    const sourcesContainer = document.getElementById("modalSourcesList");
    if (sourcesContainer) {
      sourcesContainer.innerHTML = "";
      if (term.sources && term.sources.length) {
        term.sources.forEach(src => {
          const a = document.createElement("a");
          a.className = "medical-source-link";
          a.href = src.url;
          a.target = "_blank";
          a.rel = "noopener noreferrer";
          a.innerHTML = `<div class="source-content"><span class="source-org">${src.org}</span><span class="source-label">${src.title}</span></div><span class="source-ext-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></span>`;
          sourcesContainer.appendChild(a);
        });
      }
    }

    this.updateModalBookmarkBtn(term.id);

    const accContainer = document.getElementById("modalAccordions");
    accContainer.innerHTML = "";
    term.misconceptions.forEach((item, index) => {
      const acc = document.createElement("div");
      acc.className = "accordion-item";
      acc.innerHTML = `<button class="accordion-header" type="button"><span>کج‌فهمی ${index + 1}: ${item.myth.substring(0, 36)}...</span><svg class="accordion-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg></button><div class="accordion-body"><div class="myth-tag">❌ باور غلط:</div><p style="font-size:0.92rem;margin-bottom:0.75rem;">${item.myth}</p><div class="fact-tag">✓ واقعیت علمی:</div><p style="font-size:0.92rem;color:var(--color-text-secondary);">${item.fact}</p></div>`;
      const header = acc.querySelector(".accordion-header");
      header.addEventListener("click", () => {
        acc.classList.toggle("active");
      });
      accContainer.appendChild(acc);
    });

    modal.classList.add("open");
    document.body.style.overflow = "hidden";
  }

  ensureModal() {
    let modal = document.getElementById("detailModal");
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = "detailModal";
    modal.className = "modal-overlay";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.innerHTML = `<div class="modal-content"><div class="modal-reading-container"><div class="modal-header-nav"><div class="modal-nav-meta"><span class="modal-nav-tag">دانشنامه منشور — بررسی تخصصی</span></div><div class="modal-nav-controls"><button id="modalReadingModeBtn" type="button" class="modal-reading-mode-btn" title="حالت مطالعه تمام‌صفحه (بزرگ‌نمایی و فوکوس)" aria-label="حالت مطالعه تمام‌صفحه"><svg class="reading-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg><span class="reading-mode-text">حالت مطالعه</span></button><button id="modalCloseBtn" class="modal-close-btn" title="بستن (Esc)" aria-label="بستن پنجره"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div></div><div class="modal-header-top"><div id="modalLetter" class="card-letter" style="width:52px;height:52px;font-size:1.75rem;"></div><div><div style="display:flex;align-items:center;gap:0.6rem;flex-wrap:wrap;"><h2 id="modalTitle" style="font-size:1.5rem;font-weight:800;"></h2><span id="modalBadge" class="level-badge"></span></div><div id="modalEnglish" style="font-size:0.9rem;color:var(--color-text-muted);direction:ltr;text-align:right;"></div></div></div><div id="modalArticle" class="modal-article"></div><div class="science-box"><div class="science-box-header"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 2v7.31L4.2 18.2a2 2 0 0 0 1.6 3.8h12.4a2 2 0 0 0 1.6-3.8L14 9.31V2"/></svg><span>دیدگاه مراجع علمی و پزشکی بین‌المللی (WHO / APA)</span></div><div id="modalScience" class="science-box-text"></div></div><div class="modal-sources-section"><div class="modal-sources-title"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg><span>لینک به منابع و اسناد پزشکی معتبر</span></div><div id="modalSourcesList" class="modal-sources-list"></div></div><div style="margin-bottom:1.5rem;"><h3 style="font-size:1.15rem;font-weight:800;margin-bottom:1rem;">کج‌فهمی‌های رایج در برابر شواهد علمی</h3><div id="modalAccordions"></div></div><div class="modal-action-bar"><span style="font-size:0.85rem;color:var(--color-text-secondary);">مدیریت کتابخانه اصطلاحات:</span><button id="modalBookmarkBtn" type="button" class="modal-bookmark-btn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg><span class="btn-text">افزودن به کتابخانه من</span></button></div></div></div>`;
    document.body.appendChild(modal);
    modal.addEventListener("click", e => {
      if (e.target === modal) this.closeDetailModal();
    });
    modal.querySelector("#modalCloseBtn")?.addEventListener("click", () => this.closeDetailModal());
    modal.querySelector("#modalReadingModeBtn")?.addEventListener("click", () => this.toggleReadingMode());
    modal.querySelector("#modalBookmarkBtn")?.addEventListener("click", () => {
      if (this.activeTerm) this.toggleBookmark(this.activeTerm.id);
    });
    return modal;
  }

  closeDetailModal() {
    this.setReadingMode(false);
    const modal = document.getElementById("detailModal");
    if (modal) {
      modal.classList.remove("open");
      document.body.style.overflow = "";
      this.activeTerm = null;
    }
  }

  toggleReadingMode(forceState) {
    const nextState = typeof forceState === "boolean" ? forceState : !this.isReadingMode;
    this.setReadingMode(nextState);
  }

  setReadingMode(active) {
    this.isReadingMode = active;
    const modal = document.getElementById("detailModal");
    const readingBtn = document.getElementById("modalReadingModeBtn");
    if (active) {
      document.body.classList.add("reading-mode-active");
      if (modal) modal.classList.add("reading-mode");
      if (readingBtn) {
        readingBtn.classList.add("active");
        readingBtn.setAttribute("title", "خروج از حالت مطالعه");
        readingBtn.setAttribute("aria-label", "خروج از حالت مطالعه");
        readingBtn.innerHTML = `<svg class="reading-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg><span class="reading-mode-text">خروج از حالت مطالعه</span>`;
      }
      this.showToast("حالت مطالعه تمام‌صفحه با فونت بزرگ فعال شد.");
    } else {
      document.body.classList.remove("reading-mode-active");
      if (modal) modal.classList.remove("reading-mode");
      if (readingBtn) {
        readingBtn.classList.remove("active");
        readingBtn.setAttribute("title", "حالت مطالعه تمام‌صفحه (بزرگ‌نمایی و فوکوس)");
        readingBtn.setAttribute("aria-label", "حالت مطالعه تمام‌صفحه");
        readingBtn.innerHTML = `<svg class="reading-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg><span class="reading-mode-text">حالت مطالعه</span>`;
      }
    }
  }

  toggleCamouflage() {
    this.isCamouflaged = !this.isCamouflaged;
    if (this.isCamouflaged) {
      document.title = (this.settings && this.settings.camoTitle) || "پیش‌بینی وضعیت آب و هوا — ۱۰ روز آینده";
      this.updateFavicon(true);
      this.showToast("حالت استتار تب فعال شد (پیش‌بینی آب و هوا).");
    } else {
      document.title = (this.settings && this.settings.siteName) || this.originalTitle;
      this.updateFavicon(false);
      this.showToast("عنوان اصلی بازگردانده شد.");
    }
  }

  updateFavicon(isCamo) {
    let link = document.querySelector("link[rel*='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.type = "image/svg+xml";
    link.href = isCamo ? CAMO_FAVICON : MANSHOOR_FAVICON;
  }

  clearLocalTrace() {
    localStorage.removeItem("manshoor_theme");
    localStorage.removeItem("manshoor_bookmarks");
    this.bookmarkedIds = new Set();
    this.updateBookmarkBadges();
    if (typeof this.renderCards === "function") {
      this.renderCards();
    }
    document.documentElement.classList.remove("light");
    this.updateThemeIcon("dark");
    this.showToast("ردپای محلی این دستگاه پاک شد.");
  }

  quickExit() {
    const dest = (this.settings && this.settings.quickExitUrl) || ("https://www.google.com/search?q=" + encodeURIComponent("آب و هوای امروز"));
    window.location.replace(dest);
  }

  showToast(message) {
    let toast = document.getElementById("siteToast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "siteToast";
      toast.className = "toast";
      document.body.appendChild(toast);
    }
    toast.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 14 14"/></svg><span>${message}</span>`;
    toast.classList.add("show");
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      toast.classList.remove("show");
    }, 2800);
  }

  toggleNavMenu(forceState) {
    const nav = document.getElementById("main-nav");
    const toggleBtn = document.querySelector(".nav-toggle");
    if (!nav || !toggleBtn) return;
    const isOpen = typeof forceState === "boolean" ? forceState : !nav.classList.contains("open");
    nav.classList.toggle("open", isOpen);
    toggleBtn.classList.toggle("open", isOpen);
    toggleBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
    toggleBtn.setAttribute("aria-label", isOpen ? "بستن منو" : "باز کردن منو");
  }

  closeNavMenu() {
    this.toggleNavMenu(false);
  }

  setupEventListeners() {
    window.addEventListener("keydown", e => {
      if (e.key === "Escape") {
        const modal2 = document.getElementById("detailModal");
        const isModalOpen = modal2 && modal2.classList.contains("open");
        const nav = document.getElementById("main-nav");
        const isNavOpen = nav && nav.classList.contains("open");
        if (isModalOpen) {
          if (this.isReadingMode) {
            this.setReadingMode(false);
            return;
          }
          this.closeDetailModal();
          return;
        }
        if (isNavOpen) {
          this.closeNavMenu();
          return;
        }
        this.quickExit();
      }
    });

    const navToggle = document.querySelector(".nav-toggle");
    const mainNav = document.getElementById("main-nav");
    if (navToggle) {
      navToggle.addEventListener("click", e => {
        e.stopPropagation();
        this.toggleNavMenu();
      });
    }
    if (mainNav) {
      mainNav.querySelectorAll("a").forEach(link => {
        link.addEventListener("click", () => this.closeNavMenu());
      });
    }
    document.addEventListener("click", e => {
      if (mainNav && mainNav.classList.contains("open")) {
        if (!mainNav.contains(e.target) && !navToggle?.contains(e.target)) {
          this.closeNavMenu();
        }
      }
    });

    const themeBtn = document.getElementById("themeToggleBtn");
    if (themeBtn) {
      themeBtn.addEventListener("click", () => this.toggleTheme());
    }

    const exitBtns = document.querySelectorAll(".quick-exit-btn, .floating-quick-exit");
    exitBtns.forEach(btn => {
      btn.addEventListener("click", () => this.quickExit());
    });

    const camoBtn = document.getElementById("camoBtn");
    if (camoBtn) {
      camoBtn.addEventListener("click", () => this.toggleCamouflage());
    }

    const clearTraceBtns = document.querySelectorAll("#clearTraceBtn, .clear-trace-btn");
    clearTraceBtns.forEach(btn => {
      btn.addEventListener("click", () => this.clearLocalTrace());
    });

    const modal = document.getElementById("detailModal");
    if (modal) {
      modal.addEventListener("click", e => {
        if (e.target === modal) this.closeDetailModal();
      });
      const closeBtn = document.getElementById("modalCloseBtn");
      if (closeBtn) {
        closeBtn.addEventListener("click", () => this.closeDetailModal());
      }
    }

    const modalBBtn = document.getElementById("modalBookmarkBtn");
    if (modalBBtn) {
      modalBBtn.addEventListener("click", () => {
        if (this.activeTerm) {
          this.toggleBookmark(this.activeTerm.id);
        }
      });
    }

    const sInput = document.getElementById("searchInput");
    const sClear = document.getElementById("searchClearBtn");
    if (sInput) {
      sInput.addEventListener("input", e => {
        this.searchQuery = e.target.value;
        if (sClear) sClear.style.display = this.searchQuery ? "block" : "none";
        this.renderCards();
      });
      sInput.addEventListener("keydown", e => {
        if (e.key === "Escape" && sInput.value) {
          e.stopPropagation();
          this.clearSearch();
        }
      });
    }
    if (sClear) {
      sClear.addEventListener("click", () => this.clearSearch());
    }

    const chips = document.querySelectorAll(".filter-chip[data-filter]");
    chips.forEach(chip => {
      chip.addEventListener("click", () => {
        const filter = chip.getAttribute("data-filter");
        this.setFilter(filter);
      });
    });

    const headerLibBtn = document.getElementById("headerBookmarksBtn");
    if (headerLibBtn) {
      headerLibBtn.addEventListener("click", () => {
        this.setFilter("bookmarks");
        const cardsSec = document.getElementById("cardsSection") || document.getElementById("letters-section");
        if (cardsSec) {
          cardsSec.scrollIntoView({ behavior: "smooth" });
        }
      });
    }
  }

  // ================= MARKDOWN PARSER =================
  escapeHtml(text) {
    if (!text) return "";
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  renderMarkdown(md) {
    if (!md) return "";
    let escaped = this.escapeHtml(md);

    // Bold & Italic
    escaped = escaped.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    escaped = escaped.replace(/__(.*?)__/g, "<strong>$1</strong>");
    escaped = escaped.replace(/\*(.*?)\*/g, "<em>$1</em>");
    escaped = escaped.replace(/_(.*?)_/g, "<em>$1</em>");

    // Inline code
    escaped = escaped.replace(/`([^`]+)`/g, "<code>$1</code>");

    // Links [text](url)
    escaped = escaped.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    const lines = escaped.split("\n");
    let html = "";
    let inUl = false;
    let inOl = false;
    let currentParagraph = [];

    const flushParagraph = () => {
      if (currentParagraph.length) {
        html += `<p>${currentParagraph.join("<br />")}</p>`;
        currentParagraph = [];
      }
    };

    const flushList = () => {
      if (inUl) {
        html += "</ul>";
        inUl = false;
      }
      if (inOl) {
        html += "</ol>";
        inOl = false;
      }
    };

    for (let line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        flushParagraph();
        flushList();
        continue;
      }

      if (trimmed.startsWith("### ")) {
        flushParagraph();
        flushList();
        html += `<h3>${trimmed.slice(4)}</h3>`;
        continue;
      } else if (trimmed.startsWith("## ")) {
        flushParagraph();
        flushList();
        html += `<h2>${trimmed.slice(3)}</h2>`;
        continue;
      } else if (trimmed.startsWith("# ")) {
        flushParagraph();
        flushList();
        html += `<h1>${trimmed.slice(2)}</h1>`;
        continue;
      }

      if (trimmed.startsWith("&gt; ")) {
        flushParagraph();
        flushList();
        html += `<blockquote>${trimmed.slice(5)}</blockquote>`;
        continue;
      }

      const ulMatch = trimmed.match(/^[-*]\s+(.*)$/);
      if (ulMatch) {
        flushParagraph();
        if (!inUl) {
          flushList();
          html += "<ul>";
          inUl = true;
        }
        html += `<li>${ulMatch[1]}</li>`;
        continue;
      }

      const olMatch = trimmed.match(/^\d+\.\s+(.*)$/);
      if (olMatch) {
        flushParagraph();
        if (!inOl) {
          flushList();
          html += "<ol>";
          inOl = true;
        }
        html += `<li>${olMatch[1]}</li>`;
        continue;
      }

      flushList();
      currentParagraph.push(trimmed);
    }

    flushParagraph();
    flushList();

    return html;
  }

  // ================= LIVE SEARCH AUTOCOMPLETE =================
  setupSearchSuggestions() {
    const sInput = document.getElementById("searchInput");
    const dropdown = document.getElementById("searchSuggestionsDropdown");
    if (!sInput || !dropdown) return;

    this.focusedSuggestionIndex = -1;

    sInput.addEventListener("input", () => {
      this.updateSuggestions(sInput.value);
    });

    sInput.addEventListener("focus", () => {
      if (sInput.value.trim()) {
        this.updateSuggestions(sInput.value);
      }
    });

    sInput.addEventListener("keydown", e => {
      if (!dropdown.classList.contains("open") && dropdown.style.display === "none") return;
      const items = dropdown.querySelectorAll(".suggestion-item:not(.suggestion-action)");
      if (!items.length) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        this.focusedSuggestionIndex = (this.focusedSuggestionIndex + 1) % items.length;
        this.highlightFocusedSuggestion(items);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        this.focusedSuggestionIndex = (this.focusedSuggestionIndex - 1 + items.length) % items.length;
        this.highlightFocusedSuggestion(items);
      } else if (e.key === "Enter") {
        if (this.focusedSuggestionIndex >= 0 && items[this.focusedSuggestionIndex]) {
          e.preventDefault();
          items[this.focusedSuggestionIndex].click();
        }
      } else if (e.key === "Escape") {
        this.closeSuggestions();
      }
    });

    document.addEventListener("click", e => {
      if (!sInput.contains(e.target) && !dropdown.contains(e.target)) {
        this.closeSuggestions();
      }
    });
  }

  updateSuggestions(query) {
    const dropdown = document.getElementById("searchSuggestionsDropdown");
    if (!dropdown) return;
    const qTrim = (query || "").trim();
    if (!qTrim || qTrim.length < 1) {
      this.closeSuggestions();
      return;
    }

    const qNorm = this.normalizeSearchText(qTrim);
    const scoredMatches = [];

    (this.terms || []).forEach(term => {
      const pNameNorm = this.normalizeSearchText(term.persianName);
      const eTermNorm = this.normalizeSearchText(term.englishTerm);
      const letterNorm = this.normalizeSearchText(term.letter);
      const shortDefNorm = this.normalizeSearchText(term.shortDef);

      let score = 0;
      if (letterNorm === qNorm) score += 100;
      if (pNameNorm.startsWith(qNorm)) score += 60;
      else if (pNameNorm.includes(qNorm)) score += 40;
      if (eTermNorm.startsWith(qNorm)) score += 50;
      else if (eTermNorm.includes(qNorm)) score += 30;
      if (shortDefNorm.includes(qNorm)) score += 15;

      if (score > 0) {
        scoredMatches.push({ term, score });
      }
    });

    scoredMatches.sort((a, b) => b.score - a.score);
    const topMatches = scoredMatches.slice(0, 5).map(m => m.term);

    if (topMatches.length === 0) {
      dropdown.innerHTML = `
        <div style="padding:1rem;text-align:center;font-size:0.875rem;color:var(--color-text-muted);">
          واژه‌ای با عنوان «<strong>${this.escapeHtml(qTrim)}</strong>» پیدا نشد. برای جستجو در کل متون کلید Enter را بفشارید.
        </div>
      `;
      dropdown.style.display = "block";
      dropdown.classList.add("open");
      this.focusedSuggestionIndex = -1;
      return;
    }

    const persianDigits = ["۰","۱","۲","۳","۴","۵","۶","۷","۸","۹"];
    const toPersian = num => String(num).replace(/\d/g, d => persianDigits[d]);

    dropdown.innerHTML = topMatches.map((term, index) => {
      const highlightedName = this.highlightMatch(term.persianName, qTrim);
      const highlightedEnglish = this.highlightMatch(term.englishTerm || "", qTrim);
      return `
        <div class="suggestion-item" data-index="${index}" data-term-id="${term.id}" role="option" tabindex="-1">
          <div class="suggestion-left">
            <div class="suggestion-letter">${term.letter || "?"}</div>
            <div class="suggestion-info">
              <span class="suggestion-title">${highlightedName}</span>
              <span class="suggestion-sub">
                <span>${highlightedEnglish}</span>
                <span>·</span>
                <span>${term.levelName || "سطح " + term.level}</span>
              </span>
            </div>
          </div>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="color:var(--color-text-muted);"><polyline points="15 18 9 12 15 6"/></svg>
        </div>
      `;
    }).join("") + `
      <div class="suggestion-item suggestion-action" style="border-top:1px solid var(--border-subtle);margin-top:0.35rem;font-size:0.85rem;color:var(--color-accent);font-weight:700;">
        <span>مشاهده همه نتایج فیلترشده (${toPersian(scoredMatches.length)} مورد)</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
      </div>
    `;

    dropdown.querySelectorAll(".suggestion-item:not(.suggestion-action)").forEach(item => {
      const tId = item.getAttribute("data-term-id");
      const term = (this.terms || []).find(t => t.id === tId);
      item.addEventListener("click", () => {
        if (term) {
          const sInput = document.getElementById("searchInput");
          if (sInput) sInput.value = term.persianName;
          this.searchQuery = term.persianName;
          this.closeSuggestions();
          this.renderCards();
          this.openDetailModal(term);
        }
      });
    });

    const actionItem = dropdown.querySelector(".suggestion-action");
    if (actionItem) {
      actionItem.addEventListener("click", () => {
        this.closeSuggestions();
        this.renderCards();
      });
    }

    dropdown.style.display = "block";
    dropdown.classList.add("open");
    this.focusedSuggestionIndex = -1;
  }

  highlightFocusedSuggestion(items) {
    items.forEach((it, idx) => {
      it.classList.toggle("focused", idx === this.focusedSuggestionIndex);
      if (idx === this.focusedSuggestionIndex) {
        it.scrollIntoView({ block: "nearest" });
      }
    });
  }

  closeSuggestions() {
    const dropdown = document.getElementById("searchSuggestionsDropdown");
    if (dropdown) {
      dropdown.style.display = "none";
      dropdown.classList.remove("open");
    }
    this.focusedSuggestionIndex = -1;
  }

  // ================= PWA & OFFLINE SYSTEM =================
  setupPWAAndOffline() {
    // 1. Register Service Worker
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("/sw.js").then(reg => {
          console.log("Manshoor PWA Service Worker registered:", reg.scope);
        }).catch(err => {
          console.warn("Service Worker registration failed:", err);
        });
      });
    }

    // 2. Connectivity handling
    const updateOnlineStatus = () => {
      const badge = document.getElementById("offlineIndicatorBadge");
      const isOnline = navigator.onLine;
      if (badge) {
        badge.style.display = isOnline ? "none" : "flex";
      }
      if (!isOnline) {
        this.showToast("شما در حالت آفلاین هستید. دانشنامه از حافظه دستگاه در دسترس است.");
      }
    };
    window.addEventListener("online", () => {
      this.showToast("اتصال اینترنت برقرار شد — پایگاه داده همگام است.");
      updateOnlineStatus();
    });
    window.addEventListener("offline", () => {
      updateOnlineStatus();
    });
    updateOnlineStatus();

    // 3. In-App Install Prompt
    const installBtn = document.getElementById("pwaInstallBtn");
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;

    if (!isStandalone) {
      window.addEventListener("beforeinstallprompt", e => {
        e.preventDefault();
        this.deferredInstallPrompt = e;
        if (installBtn) {
          installBtn.style.display = "inline-flex";
          installBtn.classList.add("pulse-install");
        }
      });

      const isIOS = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
      if (isIOS && installBtn) {
        installBtn.style.display = "inline-flex";
        installBtn.setAttribute("title", "راهنمای نصب روی آیفون / آیپد");
      }

      if (installBtn) {
        installBtn.addEventListener("click", async () => {
          if (this.deferredInstallPrompt) {
            await this.deferredInstallPrompt.prompt();
            const { outcome } = await this.deferredInstallPrompt.userChoice;
            if (outcome === "accepted") {
              this.showToast("اپلیکیشن منشور با موفقیت روی دستگاه شما نصب شد.");
              installBtn.style.display = "none";
              this.deferredInstallPrompt = null;
            }
          } else if (isIOS) {
            this.showIOSInstallModal();
          } else {
            this.showToast("برای نصب، از منوی مرورگر گزینه «Add to Home screen» یا «Install App» را انتخاب فرمایید.");
          }
        });
      }
    }

    window.addEventListener("appinstalled", () => {
      if (installBtn) installBtn.style.display = "none";
      this.showToast("اپلیکیشن دانشنامه منشور با موفقیت نصب شد.");
    });
  }

  showIOSInstallModal() {
    let modal = document.getElementById("iosInstallModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "iosInstallModal";
      modal.className = "modal-overlay";
      modal.innerHTML = `
        <div class="modal-content" style="max-width:440px;text-align:center;padding:2rem 1.5rem;">
          <div style="width:52px;height:52px;border-radius:14px;background:rgba(6,182,212,0.15);color:var(--color-accent);display:flex;align-items:center;justify-content:center;margin:0 auto 1.25rem;">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v10m0 0l-3-3m3 3l3-3"/><rect x="4" y="14" width="16" height="8" rx="2"/></svg>
          </div>
          <h3 style="font-size:1.25rem;font-weight:800;margin-bottom:0.75rem;">نصب دانشنامه روی iOS (آیفون و آیپد)</h3>
          <p style="color:var(--color-text-secondary);font-size:0.9rem;line-height:1.75;margin-bottom:1.5rem;text-align:right;">
            برای استفاده از دانشنامه به عنوان اپلیکیشن مستقل و تمام‌صفحه بدون نوار آدرس:
            <br /><br />
            ۱. در نوار پایین مرورگر سافاری روی دکمه <strong>Share (اشتراک‌گذاری)</strong> بزنید.
            <br />
            ۲. به پایین اسکرول کرده و گزینه <strong>Add to Home Screen (افزودن به صفحه اصلی)</strong> را انتخاب کنید.
          </p>
          <button type="button" class="filter-chip active" style="width:100%;justify-content:center;padding:0.7rem;" onclick="document.getElementById('iosInstallModal').classList.remove('open')">
            متوجه شدم
          </button>
        </div>
      `;
      document.body.appendChild(modal);
      modal.addEventListener("click", e => {
        if (e.target === modal) modal.classList.remove("open");
      });
    }
    modal.classList.add("open");
  }

  // ================= HANDBOOK MODAL & EXPORT (PDF, HTML, EPUB/MD) =================
  openHandbookModal() {
    let modal = document.getElementById("handbookModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "handbookModal";
      modal.className = "modal-overlay";
      modal.innerHTML = `
        <div class="modal-content handbook-modal-content">
          <div class="modal-header-nav">
            <div class="modal-nav-meta">
              <span class="modal-nav-tag">کتابچه رسمی و نسخه چاپی دانشنامه</span>
            </div>
            <div class="modal-nav-controls">
              <button type="button" class="admin-btn admin-btn-primary admin-btn-sm" onclick="window.print()" title="چاپ یا ذخیره به عنوان فایل PDF">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                <span>چاپ / خروجی PDF</span>
              </button>
              <button type="button" class="modal-close-btn" onclick="app.closeHandbookModal()" title="بستن (Esc)">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>

          <div id="handbookBody">
            <!-- Rendered by renderHandbookContent() -->
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      modal.addEventListener("click", e => {
        if (e.target === modal) this.closeHandbookModal();
      });
    }

    this.renderHandbookContent();
    modal.classList.add("open");
    document.body.style.overflow = "hidden";
  }

  closeHandbookModal() {
    const modal = document.getElementById("handbookModal");
    if (modal) {
      modal.classList.remove("open");
      document.body.style.overflow = "";
    }
  }

  renderHandbookContent() {
    const container = document.getElementById("handbookBody");
    if (!container) return;

    const terms = this.terms || [];
    const settings = this.settings || {};
    const title = settings.siteName || "منشور — دانشنامه فارسی رنگین‌کمان";
    const tagline = settings.tagline || "مرجع مستند، علمی و بدون سوگیری برای بازشناسی تنوع هویت‌ها، گرایش‌ها و مفاهیم جامعه رنگین‌کمان به زبان فارسی";

    const level1Terms = terms.filter(t => t.level === 1);
    const level2Terms = terms.filter(t => t.level === 2);
    const level3Terms = terms.filter(t => t.level === 3);

    container.innerHTML = `
      <div class="handbook-cover-banner">
        <div style="font-size:2rem;font-weight:900;margin-bottom:0.75rem;color:var(--color-text);">${title}</div>
        <p style="font-size:1.05rem;color:var(--color-text-secondary);max-width:640px;margin:0 auto 1.5rem;line-height:1.8;">${tagline}</p>
        <div style="display:flex;align-items:center;justify-content:center;gap:1.5rem;font-size:0.875rem;color:var(--color-text-muted);flex-wrap:wrap;">
          <span>تعداد کل مدخل‌ها: <strong>${terms.length} اصطلاح</strong></span>
          <span>·</span>
          <span>پروانه: <strong>CC BY-SA 4.0 آزاد</strong></span>
          <span>·</span>
          <span>نسخه مطالعه آفلاین و چاپی</span>
        </div>
        <div style="display:flex;justify-content:center;gap:0.75rem;margin-top:1.5rem;flex-wrap:wrap;">
          <button type="button" class="admin-btn admin-btn-primary" onclick="window.print()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            <span>چاپ کتابچه / ذخیره PDF</span>
          </button>
          <button type="button" class="admin-btn admin-btn-secondary" onclick="app.downloadHandbookHtml()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            <span>دانلود کتابچه کامل آفلاین (HTML)</span>
          </button>
          <button type="button" class="admin-btn admin-btn-secondary" onclick="app.downloadHandbookMarkdown()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <span>دانلود متن کتابچه (ePub / Markdown)</span>
          </button>
        </div>
      </div>

      <div class="handbook-toc">
        <h3 style="font-size:1.1rem;font-weight:800;margin-bottom:0.5rem;">فهرست مطالب کتابچه دانشنامه</h3>
        <div class="handbook-toc-grid">
          ${terms.map(t => `
            <a href="#handbook-term-${t.id}" style="color:var(--color-text);text-decoration:none;display:flex;align-items:center;gap:0.4rem;font-size:0.875rem;">
              <span style="font-weight:800;color:var(--color-primary);">${t.letter}:</span>
              <span>${t.persianName}</span>
            </a>
          `).join("")}
        </div>
      </div>

      <div class="handbook-content-section">
        ${this.renderHandbookLevelSection("بخش اول: اصطلاحات سطح ۱ (نهادی و جهان‌شمول)", level1Terms)}
        ${this.renderHandbookLevelSection("بخش دوم: اصطلاحات سطح ۲ (رایج و تثبیت‌شده)", level2Terms)}
        ${this.renderHandbookLevelSection("بخش سوم: اصطلاحات سطح ۳ (جامعه‌ساخت و طیفی)", level3Terms)}
      </div>
    `;
  }

  renderHandbookLevelSection(title, list) {
    if (!list || !list.length) return "";
    return `
      <div style="margin-top:2.5rem;padding-bottom:1rem;border-bottom:2px solid var(--border-highlight);">
        <h2 style="font-size:1.4rem;font-weight:800;color:var(--color-primary);margin-bottom:1.5rem;">${title}</h2>
        ${list.map(t => `
          <article id="handbook-term-${t.id}" class="handbook-entry">
            <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.75rem;">
              <div class="card-letter" style="width:36px;height:36px;font-size:1.15rem;border-radius:8px;">${t.letter}</div>
              <div>
                <h3 style="font-size:1.25rem;font-weight:800;margin:0;">${t.persianName}</h3>
                <span style="font-size:0.85rem;color:var(--color-text-muted);direction:ltr;display:inline-block;">${t.englishTerm || ""}</span>
              </div>
            </div>
            <p style="font-weight:600;color:var(--color-text);margin-bottom:1rem;line-height:1.7;">${t.shortDef}</p>
            <div class="markdown-body" style="font-size:0.95rem;line-height:1.8;margin-bottom:1.25rem;">
              ${this.renderMarkdown(t.fullArticle)}
            </div>
            ${t.science ? `
              <div class="science-box" style="margin-bottom:1rem;">
                <div class="science-box-header"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 2v7.31L4.2 18.2a2 2 0 0 0 1.6 3.8h12.4a2 2 0 0 0 1.6-3.8L14 9.31V2"/></svg><span>دیدگاه مراجع علمی و پزشکی (WHO / APA)</span></div>
                <div class="markdown-body" style="font-size:0.9rem;">${this.renderMarkdown(t.science)}</div>
              </div>
            ` : ""}
            ${t.misconceptions && t.misconceptions.length ? `
              <div style="background:var(--color-surface-subtle);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:1rem;margin-top:1rem;">
                <strong style="font-size:0.875rem;display:block;margin-bottom:0.6rem;">کج‌فهمی‌های رایج و پاسخ علمی:</strong>
                ${t.misconceptions.map(m => `
                  <div style="margin-bottom:0.6rem;">
                    <div style="color:#ef4444;font-size:0.825rem;font-weight:700;">❌ باور نادرست: ${m.myth}</div>
                    <div style="color:#10b981;font-size:0.825rem;font-weight:700;margin-top:0.2rem;">✓ شواهد علمی: ${m.fact}</div>
                  </div>
                `).join("")}
              </div>
            ` : ""}
          </article>
        `).join("")}
      </div>
    `;
  }

  downloadHandbookHtml() {
    const title = (this.settings && this.settings.siteName) || "منشور — دانشنامه فارسی رنگین‌کمان";
    const bodyContent = document.getElementById("handbookBody")?.innerHTML || "";
    const fullHtml = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} — کتابچه جامع آفلاین</title>
  <link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;600;700;800;900&display=swap" rel="stylesheet" />
  <style>
    body { font-family: 'Vazirmatn', system-ui, sans-serif; background: #fff; color: #1e293b; line-height: 1.8; padding: 2rem; max-width: 900px; margin: 0 auto; }
    h1, h2, h3 { color: #0f172a; }
    .handbook-cover-banner { text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 2rem; margin-bottom: 2rem; }
    .handbook-toc { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1.25rem; margin-bottom: 2rem; }
    .handbook-toc-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 0.5rem; }
    .handbook-entry { padding: 1.5rem 0; border-bottom: 1px solid #e2e8f0; page-break-inside: avoid; }
    .card-letter { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; font-weight: 800; }
    .science-box { background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 8px; padding: 1rem; margin: 1rem 0; }
    @media print { body { padding: 0; } button { display: none !important; } }
  </style>
</head>
<body>
  ${bodyContent}
</body>
</html>`;

    const blob = new Blob([fullHtml], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "manshoor-handbook.html";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
    this.showToast("فایل کتابچه جامع آفلاین HTML با موفقیت دانلود شد.");
  }

  downloadHandbookMarkdown() {
    const terms = this.terms || [];
    let md = `# منشور — دانشنامه فارسی رنگین‌کمان\n\n`;
    md += `مرجع مستند، علمی و بدون سوگیری برای بازشناسی تنوع هویت‌ها، گرایش‌ها و مفاهیم جامعه رنگین‌کمان به زبان فارسی.\n\n`;
    md += `پروانه انتشار: Creative Commons (CC BY-SA 4.0)\n\n`;
    md += `تاریخ ایجاد نسخه آفلاین: ${new Date().toLocaleDateString("fa-IR")}\n\n`;
    md += `---\n\n## فهرست مطالب\n\n`;
    terms.forEach(t => {
      md += `- [${t.letter}: ${t.persianName} (${t.englishTerm})](#term-${t.id})\n`;
    });
    md += `\n---\n\n## اصطلاحات و مقالات\n\n`;
    terms.forEach(t => {
      md += `### <a id="term-${t.id}"></a>${t.letter} — ${t.persianName} (${t.englishTerm})\n\n`;
      md += `**سطح علمی:** ${t.levelName || "سطح " + t.level}\n\n`;
      md += `**تعریف کوتاه:** ${t.shortDef}\n\n`;
      md += `#### مقاله تفصیلی\n\n${t.fullArticle}\n\n`;
      if (t.science) {
        md += `#### دیدگاه مراجع علمی و پزشکی (WHO / APA)\n\n${t.science}\n\n`;
      }
      if (t.misconceptions && t.misconceptions.length) {
        md += `#### کج‌فهمی‌های رایج و واقعیت‌های علمی\n\n`;
        t.misconceptions.forEach((m, idx) => {
          md += `${idx + 1}. **باور غلط:** ${m.myth}\n   **شواهد علمی:** ${m.fact}\n\n`;
        });
      }
      md += `---\n\n`;
    });

    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "manshoor-handbook.md";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
    this.showToast("فایل کتابچه متنی Markdown/ePub با موفقیت دانلود شد.");
  }
}

let app;
document.addEventListener("DOMContentLoaded", () => {
  app = new ManshoorApp();
});
