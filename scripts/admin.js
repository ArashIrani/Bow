// Manshoor Admin Panel Engine
// Independent Serverless CMS with GitHub REST API Synchronization

class ManshoorAdmin {
  constructor() {
    this.terms = [];
    this.posts = [];
    this.settings = {};
    this.currentTab = "terms";
    this.filterLevel = "all";
    this.searchQuery = "";
    this.openEditId = null;

    this.init();
  }

  async init() {
    this.loadTheme();
    this.initThemeToggle();
    this.loadGitHubConfig();
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    await this.loadInitialData();
    this.updateStatusBadge();
    this.renderActiveTab();
  }

  // ================= THEME =================
  loadTheme() {
    const saved = localStorage.getItem("manshoor_theme");
    if (saved === "light") {
      document.documentElement.classList.add("light");
    } else {
      document.documentElement.classList.remove("light");
    }
  }

  initThemeToggle() {
    const btn = document.getElementById("adminThemeToggle");
    if (!btn) return;
    btn.addEventListener("click", () => {
      const isLight = document.documentElement.classList.toggle("light");
      localStorage.setItem("manshoor_theme", isLight ? "light" : "dark");
    });
  }

  // ================= TAB NAVIGATION =================
  switchTab(tabId) {
    this.currentTab = tabId;
    document.querySelectorAll(".tab-pane").forEach(el => el.classList.remove("active"));
    document.querySelectorAll(".admin-menu-item").forEach(el => el.classList.remove("active"));

    const targetPane = document.getElementById(`tab-${tabId}`);
    if (targetPane) targetPane.classList.add("active");

    const targetBtn = document.querySelector(`.admin-menu-item[data-tab="${tabId}"]`);
    if (targetBtn) targetBtn.classList.add("active");

    this.renderActiveTab();
  }

  renderActiveTab() {
    if (this.currentTab === "terms") {
      this.renderTermsList();
    } else if (this.currentTab === "posts") {
      this.renderPostsList();
    } else if (this.currentTab === "settings") {
      this.populateSettingsForm();
    }
    this.updateBadges();
  }

  updateBadges() {
    const tBadge = document.getElementById("termsCountBadge");
    if (tBadge) tBadge.textContent = this.terms ? this.terms.length : 0;

    const pBadge = document.getElementById("postsCountBadge");
    if (pBadge) pBadge.textContent = this.posts ? this.posts.length : 0;
  }

  // ================= DATA LOADING =================
  async loadInitialData() {
    // 1. Load Settings
    try {
      const res = await fetch("data/settings.json");
      if (res.ok) {
        this.settings = await res.json();
      }
    } catch (e) {
      console.warn("Could not load settings.json via fetch", e);
    }
    const draftSettings = localStorage.getItem("manshoor_draft_settings");
    if (draftSettings) {
      try {
        this.settings = Object.assign({}, this.settings, JSON.parse(draftSettings));
      } catch (err) {}
    }

    // 2. Load Content
    try {
      const res = await fetch("data/content.json");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          this.terms = data;
          this.posts = [];
        } else {
          this.terms = data.terms || [];
          this.posts = data.posts || [];
        }
      }
    } catch (e) {
      console.warn("Could not load content.json via fetch", e);
    }

    const draftContent = localStorage.getItem("manshoor_draft_content");
    if (draftContent) {
      try {
        const data = JSON.parse(draftContent);
        if (data.terms && data.terms.length) this.terms = data.terms;
        if (data.posts && data.posts.length) this.posts = data.posts;
      } catch (err) {}
    }
  }

  // ================= GITHUB CONFIG & SECURITY =================
  loadGitHubConfig() {
    const token = localStorage.getItem("manshoor_gh_token") || "";
    const owner = localStorage.getItem("manshoor_gh_owner") || "";
    const repo = localStorage.getItem("manshoor_gh_repo") || "";
    const branch = localStorage.getItem("manshoor_gh_branch") || "main";

    const tInput = document.getElementById("ghToken");
    const oInput = document.getElementById("ghOwner");
    const rInput = document.getElementById("ghRepo");
    const bInput = document.getElementById("ghBranch");

    if (tInput) tInput.value = token;
    if (oInput) oInput.value = owner;
    if (rInput) rInput.value = repo;
    if (bInput) bInput.value = branch;
  }

  saveGitHubConfig() {
    const token = document.getElementById("ghToken")?.value.trim() || "";
    const owner = document.getElementById("ghOwner")?.value.trim() || "";
    const repo = document.getElementById("ghRepo")?.value.trim() || "";
    const branch = document.getElementById("ghBranch")?.value.trim() || "main";

    if (token) localStorage.setItem("manshoor_gh_token", token);
    else localStorage.removeItem("manshoor_gh_token");

    if (owner) localStorage.setItem("manshoor_gh_owner", owner);
    if (repo) localStorage.setItem("manshoor_gh_repo", repo);
    if (branch) localStorage.setItem("manshoor_gh_branch", branch);

    this.updateStatusBadge();
    this.showAdminToast("مشخصات اتصال گیت‌هاب با موفقیت در این دستگاه ذخیره شد.");
  }

  updateStatusBadge() {
    const token = localStorage.getItem("manshoor_gh_token");
    const owner = localStorage.getItem("manshoor_gh_owner");
    const repo = localStorage.getItem("manshoor_gh_repo");

    const badge = document.getElementById("repoStatusBadge");
    const text = document.getElementById("repoStatusText");
    if (!badge || !text) return;

    if (token && owner && repo) {
      badge.className = "conn-status-badge online";
      text.textContent = `گیت‌هاب: ${owner}/${repo}`;
    } else {
      badge.className = "conn-status-badge offline";
      text.textContent = "حالت پیش‌نویس محلی (آفلاین)";
    }
  }

  async verifyGitHubAccess() {
    const token = document.getElementById("ghToken")?.value.trim();
    const owner = document.getElementById("ghOwner")?.value.trim();
    const repo = document.getElementById("ghRepo")?.value.trim();
    const resultBox = document.getElementById("verifyResultAlert");
    const verifyBtn = document.getElementById("verifyRepoBtn");

    if (!token || !owner || !repo) {
      this.showAdminToast("لطفاً توکن دسترسی، نام مالک و نام مخزن را وارد کنید.");
      return;
    }

    if (verifyBtn) {
      verifyBtn.disabled = true;
      verifyBtn.innerHTML = `<span class="spinner-icon">🔄</span> در حال بررسی...`;
    }

    try {
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json"
        }
      });

      if (!res.ok) {
        throw new Error(`خطای ${res.status}: عدم دسترسی یا یافت نشدن مخزن`);
      }

      const repoData = await res.json();
      const hasPush = repoData.permissions ? repoData.permissions.push : true;

      if (resultBox) {
        resultBox.style.display = "block";
        resultBox.innerHTML = `
          <div style="color:#10b981;display:flex;align-items:center;gap:0.6rem;font-weight:700;margin-bottom:0.5rem;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            <span>اتصال به مخزن با موفقیت تایید شد</span>
          </div>
          <div style="font-size:0.875rem;color:var(--color-text-secondary);line-height:1.6;">
            نام مخزن: <strong>${repoData.full_name}</strong> | وضعیت: <strong>${repoData.private ? "خصوصی (Private)" : "عمومی (Public)"}</strong><br/>
            مجوز کامیت و نوشتن: <strong>${hasPush ? "تایید شده ✓" : "دسترسی نوشتن وجود ندارد ❌"}</strong>
          </div>
        `;
      }
      this.saveGitHubConfig();
      this.showAdminToast("اتصال به مخزن گیت‌هاب با موفقیت اعتبارسنجی شد.");
    } catch (err) {
      if (resultBox) {
        resultBox.style.display = "block";
        resultBox.innerHTML = `
          <div style="color:#ef4444;display:flex;align-items:center;gap:0.6rem;font-weight:700;margin-bottom:0.5rem;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span>خطا در اعتبارسنجی اتصال</span>
          </div>
          <div style="font-size:0.875rem;color:var(--color-text-secondary);line-height:1.6;">
            ${err.message}. لطفاً از صحت توکن شخصی، نام مالک و نام مخزن مطمئن شوید.
          </div>
        `;
      }
    } finally {
      if (verifyBtn) {
        verifyBtn.disabled = false;
        verifyBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg><span>آزمون و اعتبارسنجی اتصال</span>`;
      }
    }
  }

  purgeTokenConfirm() {
    const ok = confirm("آیا از حذف توکن دسترسی و پاکسازی ردپای ادمین از این دستگاه اطمینان دارید؟");
    if (!ok) return;

    localStorage.removeItem("manshoor_gh_token");
    localStorage.removeItem("manshoor_gh_owner");
    localStorage.removeItem("manshoor_gh_repo");
    localStorage.removeItem("manshoor_gh_branch");

    const tInput = document.getElementById("ghToken");
    if (tInput) tInput.value = "";
    this.updateStatusBadge();
    this.showAdminToast("توکن دسترسی و مشخصات مخزن از این مرورگر پاکسازی شدند.");
  }

  togglePasswordVisibility(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.type = input.type === "password" ? "text" : "password";
  }

  // ================= SAVE MECHANISMS (SERVERLESS GITHUB REST API) =================
  async commitFileToGitHub(path, contentString, commitMessage) {
    const token = localStorage.getItem("manshoor_gh_token");
    const owner = localStorage.getItem("manshoor_gh_owner");
    const repo = localStorage.getItem("manshoor_gh_repo");
    const branch = localStorage.getItem("manshoor_gh_branch") || "main";

    if (!token || !owner || !repo) {
      return { ok: false, localOnly: true, reason: "مشخصات گیت‌هاب تنظیم نشده است" };
    }

    try {
      // 1. Get existing file sha if it exists
      let sha = null;
      try {
        const getRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json"
          }
        });
        if (getRes.ok) {
          const fileData = await getRes.json();
          sha = fileData.sha;
        }
      } catch (e) {}

      // 2. Base64 UTF-8 encode
      const base64Content = btoa(unescape(encodeURIComponent(contentString)));

      // 3. Put request
      const bodyPayload = {
        message: commitMessage || `Update ${path} via Manshoor Admin`,
        content: base64Content,
        branch: branch
      };
      if (sha) bodyPayload.sha = sha;

      const putRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify(bodyPayload)
      });

      if (!putRes.ok) {
        const errJson = await putRes.json().catch(() => ({}));
        throw new Error(errJson.message || `خطای HTTP ${putRes.status}`);
      }

      return { ok: true, localOnly: false };
    } catch (err) {
      console.error("GitHub Commit Error:", err);
      return { ok: false, localOnly: false, reason: err.message };
    }
  }

  async saveContentJson(commitMessage) {
    const payload = {
      terms: this.terms,
      posts: this.posts
    };
    const jsonStr = JSON.stringify(payload, null, 2);

    // Save to local draft first
    localStorage.setItem("manshoor_draft_content", jsonStr);

    const ghResult = await this.commitFileToGitHub("data/content.json", jsonStr, commitMessage || "به‌روزرسانی محتوای دانشنامه");

    if (ghResult.ok) {
      this.showAdminToast("تغییرات با موفقیت در مخزن گیت‌هاب کامیت شد.");
    } else if (ghResult.localOnly) {
      this.showAdminToast("تغییرات در پیش‌نویس محلی ذخیره شد (توکن گیت‌هاب وارد نشده است).");
    } else {
      this.showAdminToast(`ذخیره در پیش‌نویس انجام شد اما خطا در کامیت گیت‌هاب: ${ghResult.reason}`);
    }
    this.updateBadges();
  }

  async saveSettingsJson(commitMessage) {
    const jsonStr = JSON.stringify(this.settings, null, 2);
    localStorage.setItem("manshoor_draft_settings", jsonStr);

    const ghResult = await this.commitFileToGitHub("data/settings.json", jsonStr, commitMessage || "به‌روزرسانی تنظیمات دانشنامه");

    if (ghResult.ok) {
      this.showAdminToast("تنظیمات با موفقیت در مخزن گیت‌هاب کامیت شد.");
    } else if (ghResult.localOnly) {
      this.showAdminToast("تنظیمات در پیش‌نویس محلی این دستگاه ذخیره شد.");
    } else {
      this.showAdminToast(`خطا در کامیت گیت‌هاب: ${ghResult.reason}`);
    }
  }

  // ================= TAB 1: TERMS MANAGEMENT =================
  setTermsFilter(filter) {
    this.filterLevel = filter;
    document.querySelectorAll("[data-admin-filter]").forEach(el => {
      el.classList.toggle("active", el.getAttribute("data-admin-filter") === filter);
    });
    this.renderTermsList();
  }

  filterTermsList() {
    const input = document.getElementById("termsSearchInput");
    this.searchQuery = input ? input.value.trim().toLowerCase() : "";
    this.renderTermsList();
  }

  renderTermsList() {
    const container = document.getElementById("termsListContainer");
    if (!container) return;

    const filtered = (this.terms || []).filter(t => {
      if (this.filterLevel === "level-1" && t.level !== 1) return false;
      if (this.filterLevel === "level-2" && t.level !== 2) return false;
      if (this.filterLevel === "level-3" && t.level !== 3) return false;
      if (this.searchQuery) {
        const pool = `${t.letter} ${t.persianName} ${t.englishTerm} ${t.shortDef}`.toLowerCase();
        return pool.includes(this.searchQuery);
      }
      return true;
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding:2.5rem 1rem;">
          <h3 style="font-weight:700;margin-bottom:0.5rem;">واژه‌ای مطابق فیلتر یافت نشد</h3>
          <p style="color:var(--color-text-secondary);font-size:0.875rem;">می‌توانید عبارت جستجو را تغییر دهید یا واژه جدیدی بیافزایید.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map((term, index) => {
      const isEditing = this.openEditId === term.id;
      return `
        <div class="admin-card" id="term-card-${term.id}">
          <div class="admin-card-header" onclick="adminApp.toggleTermEdit('${term.id}')">
            <div class="admin-card-meta">
              <div class="card-letter" style="width:38px;height:38px;font-size:1.15rem;border-radius:10px;">${term.letter || "?"}</div>
              <div>
                <strong style="font-size:1.05rem;">${term.persianName}</strong>
                <span style="font-size:0.85rem;color:var(--color-text-muted);margin-right:0.6rem;direction:ltr;display:inline-block;">${term.englishTerm || ""}</span>
              </div>
              <span class="level-badge ${term.levelClass || ('level-' + (term.level || 1))}">
                <span class="level-dot"></span>
                ${term.levelName || ('سطح ' + (term.level || 1))}
              </span>
            </div>
            <div class="admin-card-actions" onclick="event.stopPropagation();">
              <button type="button" class="admin-btn admin-btn-secondary admin-btn-sm" onclick="adminApp.toggleTermEdit('${term.id}')">
                ${isEditing ? "بستن ویرایشگر" : "ویرایش"}
              </button>
              <button type="button" class="admin-btn admin-btn-danger admin-btn-sm" onclick="adminApp.deleteTerm('${term.id}')" title="حذف واژه">
                حذف
              </button>
            </div>
          </div>

          ${isEditing ? this.renderTermEditForm(term) : `
            <p style="font-size:0.9rem;color:var(--color-text-secondary);margin:0;line-height:1.6;">
              ${term.shortDef || "بدون تعریف کوتاه"}
            </p>
          `}
        </div>
      `;
    }).join("");
  }

  toggleTermEdit(termId) {
    this.openEditId = this.openEditId === termId ? null : termId;
    this.renderTermsList();
  }

  renderTermEditForm(term) {
    const misconceptions = term.misconceptions || [];
    return `
      <form id="editForm-${term.id}" onsubmit="event.preventDefault(); adminApp.handleSaveSingleTerm('${term.id}');" style="border-top:1px solid var(--border-subtle);padding-top:1.25rem;margin-top:0.75rem;">
        <div class="form-grid-3">
          <div class="form-group">
            <label class="form-label">حرف یا نماد اختصاری (Letter) *</label>
            <input type="text" id="edit-letter-${term.id}" class="form-control" value="${term.letter || ''}" required />
          </div>
          <div class="form-group">
            <label class="form-label">شناسه مدخل (ID - Slug) *</label>
            <input type="text" id="edit-id-${term.id}" class="form-control" value="${term.id || ''}" required style="direction:ltr;" />
          </div>
          <div class="form-group">
            <label class="form-label">دسته‌بندی موضوعی</label>
            <input type="text" id="edit-cat-${term.id}" class="form-control" value="${term.category || ''}" />
          </div>
        </div>

        <div class="form-grid-3">
          <div class="form-group">
            <label class="form-label">نام فارسی مدخل *</label>
            <input type="text" id="edit-pName-${term.id}" class="form-control" value="${term.persianName || ''}" required />
          </div>
          <div class="form-group">
            <label class="form-label">نام انگلیسی (English Term)</label>
            <input type="text" id="edit-eTerm-${term.id}" class="form-control" value="${term.englishTerm || ''}" style="direction:ltr;" />
          </div>
          <div class="form-group">
            <label class="form-label">سطح علمی و تثبیت</label>
            <select id="edit-level-${term.id}" class="form-control">
              <option value="1" ${term.level === 1 ? "selected" : ""}>سطح ۱ (نهادی)</option>
              <option value="2" ${term.level === 2 ? "selected" : ""}>سطح ۲ (رایج)</option>
              <option value="3" ${term.level === 3 ? "selected" : ""}>سطح ۳ (جامعه‌ساخت)</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">تعریف کوتاه کارت (Short Definition) *</label>
          <textarea id="edit-sDef-${term.id}" class="form-control" rows="2" required>${term.shortDef || ''}</textarea>
        </div>

        <div class="form-group">
          <label class="form-label">مقاله تشریحی کامل (پشتیبانی از فرمت‌بندی مارک‌داون) *</label>
          <div class="md-editor-wrapper">
            <div class="md-toolbar">
              <div class="md-tools-group">
                <button type="button" class="md-tool-btn" onclick="adminApp.insertMdTag('edit-article-${term.id}', '**', '**')" title="درشت (Bold)"><strong>B</strong></button>
                <button type="button" class="md-tool-btn" onclick="adminApp.insertMdTag('edit-article-${term.id}', '*', '*')" title="مورب (Italic)"><em>I</em></button>
                <button type="button" class="md-tool-btn" onclick="adminApp.insertMdTag('edit-article-${term.id}', '- ', '')" title="فهرست گلوله‌ای">• فهرست</button>
                <button type="button" class="md-tool-btn" onclick="adminApp.insertMdLink('edit-article-${term.id}')" title="پیوند اینترنتی">🔗 پیوند</button>
              </div>
              <div class="md-tools-group">
                <button type="button" id="tab-edit-article-${term.id}" class="md-tab-btn active" onclick="adminApp.switchMdTab('article-${term.id}', 'edit')">ویرایش متنی</button>
                <button type="button" id="tab-prev-article-${term.id}" class="md-tab-btn" onclick="adminApp.switchMdTab('article-${term.id}', 'prev')">پیش‌نمایش زنده</button>
              </div>
            </div>
            <textarea id="edit-article-${term.id}" class="form-control" rows="5" required style="border:none;border-radius:0;background:transparent;" oninput="adminApp.updateMdLivePreview('article-${term.id}')">${term.fullArticle || ''}</textarea>
            <div id="preview-article-${term.id}" class="md-preview-pane markdown-body"></div>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">دیدگاه مراجع علمی و پزشکی (پشتیبانی از مارک‌داون: WHO / APA)</label>
          <div class="md-editor-wrapper">
            <div class="md-toolbar">
              <div class="md-tools-group">
                <button type="button" class="md-tool-btn" onclick="adminApp.insertMdTag('edit-science-${term.id}', '**', '**')" title="درشت (Bold)"><strong>B</strong></button>
                <button type="button" class="md-tool-btn" onclick="adminApp.insertMdTag('edit-science-${term.id}', '*', '*')" title="مورب (Italic)"><em>I</em></button>
                <button type="button" class="md-tool-btn" onclick="adminApp.insertMdTag('edit-science-${term.id}', '- ', '')" title="فهرست گلوله‌ای">• فهرست</button>
                <button type="button" class="md-tool-btn" onclick="adminApp.insertMdLink('edit-science-${term.id}')" title="پیوند اینترنتی">🔗 پیوند</button>
              </div>
              <div class="md-tools-group">
                <button type="button" id="tab-edit-science-${term.id}" class="md-tab-btn active" onclick="adminApp.switchMdTab('science-${term.id}', 'edit')">ویرایش متنی</button>
                <button type="button" id="tab-prev-science-${term.id}" class="md-tab-btn" onclick="adminApp.switchMdTab('science-${term.id}', 'prev')">پیش‌نمایش زنده</button>
              </div>
            </div>
            <textarea id="edit-science-${term.id}" class="form-control" rows="3" style="border:none;border-radius:0;background:transparent;" oninput="adminApp.updateMdLivePreview('science-${term.id}')">${term.science || ''}</textarea>
            <div id="preview-science-${term.id}" class="md-preview-pane markdown-body"></div>
          </div>
        </div>

        <!-- Misconceptions Section -->
        <div style="margin:1.5rem 0;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.75rem;">
            <label class="form-label" style="margin:0;">کج‌فهمی‌ها و باورهای نادرست در برابر واقعیت علمی</label>
            <button type="button" class="admin-btn admin-btn-secondary admin-btn-sm" onclick="adminApp.addMisconception('${term.id}')">
              + افزودن کج‌فهمی
            </button>
          </div>
          <div id="miscList-${term.id}">
            ${misconceptions.map((m, mIndex) => `
              <div class="subitem-box" id="miscItem-${term.id}-${mIndex}">
                <div class="subitem-header">
                  <span>کج‌فهمی شماره ${mIndex + 1}</span>
                  <button type="button" class="admin-btn admin-btn-danger admin-btn-sm" style="padding:0.2rem 0.5rem;" onclick="adminApp.removeMisconception('${term.id}', ${mIndex})">حذف</button>
                </div>
                <div class="form-group" style="margin-bottom:0.6rem;">
                  <input type="text" class="form-control edit-myth-input" placeholder="باور غلط (Myth)..." value="${m.myth || ''}" />
                </div>
                <div class="form-group" style="margin-bottom:0;">
                  <textarea class="form-control edit-fact-input" rows="2" placeholder="واقعیت علمی (Fact)...">${m.fact || ''}</textarea>
                </div>
              </div>
            `).join("")}
          </div>
        </div>

        <div style="display:flex;align-items:center;justify-content:flex-end;gap:0.75rem;padding-top:1rem;border-top:1px solid var(--border-subtle);">
          <button type="button" class="admin-btn admin-btn-secondary" onclick="adminApp.toggleTermEdit('${term.id}')">انصراف</button>
          <button type="submit" id="saveBtn-${term.id}" class="admin-btn admin-btn-primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/></svg>
            <span>ذخیره تغییرات این واژه</span>
          </button>
        </div>
      </form>
    `;
  }

  addMisconception(termId) {
    const term = this.terms.find(t => t.id === termId);
    if (!term) return;
    if (!term.misconceptions) term.misconceptions = [];
    term.misconceptions.push({ myth: "", fact: "" });
    this.renderTermsList();
  }

  removeMisconception(termId, mIndex) {
    const term = this.terms.find(t => t.id === termId);
    if (!term || !term.misconceptions) return;
    term.misconceptions.splice(mIndex, 1);
    this.renderTermsList();
  }

  async handleSaveSingleTerm(termId) {
    const term = this.terms.find(t => t.id === termId);
    if (!term) return;

    const letter = document.getElementById(`edit-letter-${termId}`)?.value.trim() || term.letter;
    const newId = document.getElementById(`edit-id-${termId}`)?.value.trim() || term.id;
    const category = document.getElementById(`edit-cat-${termId}`)?.value.trim() || term.category;
    const pName = document.getElementById(`edit-pName-${termId}`)?.value.trim() || term.persianName;
    const eTerm = document.getElementById(`edit-eTerm-${termId}`)?.value.trim() || term.englishTerm;
    const levelVal = parseInt(document.getElementById(`edit-level-${termId}`)?.value || "1", 10);
    const sDef = document.getElementById(`edit-sDef-${termId}`)?.value.trim() || term.shortDef;
    const article = document.getElementById(`edit-article-${termId}`)?.value.trim() || term.fullArticle;
    const science = document.getElementById(`edit-science-${termId}`)?.value.trim() || term.science;

    // Collect misconceptions
    const miscContainer = document.getElementById(`miscList-${termId}`);
    const misconceptions = [];
    if (miscContainer) {
      const boxes = miscContainer.querySelectorAll(".subitem-box");
      boxes.forEach(box => {
        const myth = box.querySelector(".edit-myth-input")?.value.trim() || "";
        const fact = box.querySelector(".edit-fact-input")?.value.trim() || "";
        if (myth || fact) {
          misconceptions.push({ myth, fact });
        }
      });
    }

    const levelNames = {
      1: "سطح ۱ (نهادی)",
      2: "سطح ۲ (رایج)",
      3: "سطح ۳ (جامعه‌ساخت)"
    };

    term.id = newId;
    term.letter = letter;
    term.persianName = pName;
    term.englishTerm = eTerm;
    term.category = category;
    term.level = levelVal;
    term.levelName = levelNames[levelVal] || `سطح ${levelVal}`;
    term.levelClass = `level-${levelVal}`;
    term.shortDef = sDef;
    term.fullArticle = article;
    term.science = science;
    term.misconceptions = misconceptions;

    const saveBtn = document.getElementById(`saveBtn-${termId}`);
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = `<span class="spinner-icon">🔄</span> در حال ذخیره...`;
    }

    await this.saveContentJson(`ویرایش مدخل «${pName}»`);
    this.openEditId = null;
    this.renderTermsList();
  }

  addNewTermPrompt() {
    const newId = "term-" + Date.now().toString(36);
    const newTerm = {
      id: newId,
      letter: "N",
      persianName: "واژه جدید",
      englishTerm: "New Term",
      level: 2,
      levelName: "سطح ۲ (رایج)",
      levelClass: "level-2",
      category: "گرایش جنسی",
      shortDef: "تعریف کوتاه واژه جدید را در اینجا وارد نمایید.",
      fullArticle: "مقاله تشریحی و زمینه تاریخی-اجتماعی این مدخل را در اینجا بنویسید.",
      science: "دیدگاه نهادهای معتبر بین‌المللی سلامت و پزشکی (WHO / APA)",
      sources: [],
      misconceptions: [
        { myth: "باور نادرست رایج درباره این مفهوم", fact: "واقعیت علمی و مستند بر پایه پژوهش‌ها" }
      ]
    };

    this.terms.unshift(newTerm);
    this.openEditId = newId;
    this.renderTermsList();
    this.showAdminToast("مدخل جدید ایجاد شد؛ مشخصات را تکمیل کرده و ذخیره کنید.");
  }

  async deleteTerm(termId) {
    const term = this.terms.find(t => t.id === termId);
    const pName = term ? term.persianName : termId;
    const ok = confirm(`آیا از حذف مدخل «${pName}» اطمینان دارید؟`);
    if (!ok) return;

    this.terms = this.terms.filter(t => t.id !== termId);
    if (this.openEditId === termId) this.openEditId = null;
    await this.saveContentJson(`حذف مدخل «${pName}»`);
    this.renderTermsList();
  }

  // ================= TAB 2: POSTS MANAGEMENT =================
  renderPostsList() {
    const container = document.getElementById("postsListContainer");
    if (!container) return;

    if (!this.posts || this.posts.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding:2rem 1rem;">
          <p style="color:var(--color-text-secondary);margin:0;">هنوز پستی در بخش «تازه‌های منشور» منتشر نشده است.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = this.posts.map(p => `
      <div class="admin-card" style="padding:1.25rem;">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;margin-bottom:0.6rem;">
          <div>
            <h3 style="font-size:1.05rem;font-weight:800;margin:0 0 0.25rem 0;">${p.title}</h3>
            <span style="font-size:0.8rem;color:var(--color-primary);font-weight:600;">📅 ${p.date || 'بدون تاریخ'}</span>
          </div>
          <button type="button" class="admin-btn admin-btn-danger admin-btn-sm" onclick="adminApp.deletePost('${p.id}')">
            حذف پست
          </button>
        </div>
        <div class="markdown-body" style="font-size:0.9rem;margin:0;line-height:1.65;">
          ${this.renderMarkdown(p.content)}
        </div>
      </div>
    `).join("");

    // Set default date in post form
    const dateInput = document.getElementById("postDate");
    if (dateInput && !dateInput.value) {
      const today = new Date().toLocaleDateString("fa-IR");
      dateInput.value = today;
    }
  }

  async handleCreatePost(event) {
    event.preventDefault();
    const titleInput = document.getElementById("postTitle");
    const dateInput = document.getElementById("postDate");
    const contentInput = document.getElementById("postContent");
    const saveBtn = document.getElementById("savePostBtn");

    const title = titleInput?.value.trim();
    const date = dateInput?.value.trim();
    const content = contentInput?.value.trim();

    if (!title || !content) return;

    const newPost = {
      id: "post-" + Date.now().toString(36),
      title: title,
      date: date || new Date().toLocaleDateString("fa-IR"),
      content: content
    };

    if (!this.posts) this.posts = [];
    this.posts.unshift(newPost);

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = `<span class="spinner-icon">🔄</span> در حال انتشار...`;
    }

    await this.saveContentJson(`انتشار پست جدید: «${title}»`);

    if (titleInput) titleInput.value = "";
    if (contentInput) contentInput.value = "";
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg><span>انتشار در «تازه‌های منشور»</span>`;
    }

    this.renderPostsList();
  }

  async deletePost(postId) {
    const post = this.posts.find(p => p.id === postId);
    const title = post ? post.title : "";
    const ok = confirm(`آیا از حذف پست «${title}» اطمینان دارید؟`);
    if (!ok) return;

    this.posts = this.posts.filter(p => p.id !== postId);
    await this.saveContentJson(`حذف پست «${title}»`);
    this.renderPostsList();
  }

  // ================= TAB 3: SETTINGS & BACKUP =================
  populateSettingsForm() {
    const s = this.settings || {};
    const nameInput = document.getElementById("settingSiteName");
    const camoInput = document.getElementById("settingCamoTitle");
    const exitInput = document.getElementById("settingQuickExitUrl");
    const taglineInput = document.getElementById("settingTagline");
    const footerInput = document.getElementById("settingFooterText");

    if (nameInput) nameInput.value = s.siteName || "منشور — دانشنامه فارسی رنگین‌کمان";
    if (camoInput) camoInput.value = s.camoTitle || "پیش‌بینی وضعیت آب و هوا — ۱۰ روز آینده";
    if (exitInput) exitInput.value = s.quickExitUrl || "https://www.google.com/search?q=" + encodeURIComponent("آب و هوای امروز");
    if (taglineInput) taglineInput.value = s.tagline || "";
    if (footerInput) footerInput.value = s.footerText || "";
  }

  async handleSaveSettings() {
    this.settings = {
      siteName: document.getElementById("settingSiteName")?.value.trim() || "منشور — دانشنامه فارسی رنگین‌کمان",
      camoTitle: document.getElementById("settingCamoTitle")?.value.trim() || "پیش‌بینی وضعیت آب و هوا — ۱۰ روز آینده",
      quickExitUrl: document.getElementById("settingQuickExitUrl")?.value.trim() || "https://www.google.com/search?q=%D8%A2%D8%A8+%D9%88+%D9%87%D9%88%D8%A7%DB%8C+%D8%A7%D9%85%D8%B1%D9%88%D8%B2",
      tagline: document.getElementById("settingTagline")?.value.trim() || "",
      footerText: document.getElementById("settingFooterText")?.value.trim() || ""
    };

    await this.saveSettingsJson("به‌روزرسانی تنظیمات منشور");
  }

  downloadFullBackup(type) {
    let filename = "";
    let dataStr = "";

    if (type === "content") {
      filename = `manshoor-content-backup-${new Date().toISOString().slice(0, 10)}.json`;
      dataStr = JSON.stringify({ terms: this.terms, posts: this.posts }, null, 2);
    } else {
      filename = `manshoor-settings-backup-${new Date().toISOString().slice(0, 10)}.json`;
      dataStr = JSON.stringify(this.settings, null, 2);
    }

    const blob = new Blob([dataStr], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.showAdminToast(`فایل پشتیبان ${filename} با موفقیت دانلود شد.`);
  }

  // ================= TOAST NOTIFICATION =================
  showAdminToast(msg) {
    let toast = document.getElementById("adminToast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "adminToast";
      toast.className = "toast";
      document.body.appendChild(toast);
    }
    toast.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 14 14"/>
      </svg>
      <span>${msg}</span>
    `;
    toast.classList.add("show");
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      toast.classList.remove("show");
    }, 3200);
  }

  // ================= MARKDOWN PARSER & LIVE EDITOR TOOLS =================
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

  insertMdTag(textareaId, prefix, suffix) {
    const textarea = document.getElementById(textareaId);
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selected = text.substring(start, end);

    const replacement = prefix + (selected || "متن") + suffix;
    textarea.value = text.substring(0, start) + replacement + text.substring(end);
    textarea.focus();
    const newCursor = start + prefix.length + (selected ? selected.length : 3);
    textarea.setSelectionRange(newCursor, newCursor);

    const suffixKey = textareaId.replace(/^edit-/, "");
    this.updateMdLivePreview(suffixKey);
  }

  insertMdLink(textareaId) {
    const textarea = document.getElementById(textareaId);
    if (!textarea) return;
    const url = prompt("آدرس اینترنتی پیوند را وارد فرمایید (مثال: https://who.int):", "https://");
    if (!url) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selected = text.substring(start, end) || "عنوان پیوند";

    const replacement = `[${selected}](${url})`;
    textarea.value = text.substring(0, start) + replacement + text.substring(end);
    textarea.focus();

    const suffixKey = textareaId.replace(/^edit-/, "");
    this.updateMdLivePreview(suffixKey);
  }

  switchMdTab(idSuffix, mode) {
    const textarea = document.getElementById(`edit-${idSuffix}`) || document.getElementById(idSuffix);
    const preview = document.getElementById(`preview-${idSuffix}`);
    const tabEdit = document.getElementById(`tab-edit-${idSuffix}`);
    const tabPrev = document.getElementById(`tab-prev-${idSuffix}`);

    if (mode === "prev") {
      if (textarea && preview) {
        preview.innerHTML = this.renderMarkdown(textarea.value) || "<em style='color:var(--color-text-muted);'>متنی برای پیش‌نمایش وارد نشده است.</em>";
        textarea.style.display = "none";
        preview.style.display = "block";
      }
      if (tabEdit) tabEdit.classList.remove("active");
      if (tabPrev) tabPrev.classList.add("active");
    } else {
      if (textarea && preview) {
        textarea.style.display = "block";
        preview.style.display = "none";
        textarea.focus();
      }
      if (tabEdit) tabEdit.classList.add("active");
      if (tabPrev) tabPrev.classList.remove("active");
    }
  }

  updateMdLivePreview(idSuffix) {
    const textarea = document.getElementById(`edit-${idSuffix}`) || document.getElementById(idSuffix);
    const preview = document.getElementById(`preview-${idSuffix}`);
    if (textarea && preview && preview.style.display !== "none") {
      preview.innerHTML = this.renderMarkdown(textarea.value) || "<em style='color:var(--color-text-muted);'>متنی برای پیش‌نمایش وارد نشده است.</em>";
    }
  }

  // ================= ADMIN HANDBOOK GENERATOR (PRINT / PDF / HTML / MD) =================
  openAdminHandbook() {
    let modal = document.getElementById("adminHandbookModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "adminHandbookModal";
      modal.className = "modal-overlay";
      modal.innerHTML = `
        <div class="modal-content handbook-modal-content">
          <div class="modal-header-nav">
            <div class="modal-nav-meta">
              <span class="modal-nav-tag">پیش‌نمایش کتابچه جامع و نسخه چاپی دانشنامه</span>
            </div>
            <div class="modal-nav-controls">
              <button type="button" class="admin-btn admin-btn-primary admin-btn-sm" onclick="window.print()" title="چاپ یا ذخیره به صورت PDF">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                <span>چاپ / خروجی PDF</span>
              </button>
              <button type="button" class="modal-close-btn" onclick="adminApp.closeAdminHandbook()" title="بستن (Esc)">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>

          <div id="adminHandbookBody">
            <!-- Rendered dynamically -->
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      modal.addEventListener("click", e => {
        if (e.target === modal) this.closeAdminHandbook();
      });
    }

    this.renderAdminHandbookContent();
    modal.classList.add("open");
    document.body.style.overflow = "hidden";
  }

  closeAdminHandbook() {
    const modal = document.getElementById("adminHandbookModal");
    if (modal) {
      modal.classList.remove("open");
      document.body.style.overflow = "";
    }
  }

  renderAdminHandbookContent() {
    const container = document.getElementById("adminHandbookBody");
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
          <span>تعداد کل واژگان: <strong>${terms.length} مدخل</strong></span>
          <span>·</span>
          <span>پروانه آزاد CC BY-SA 4.0</span>
          <span>·</span>
          <span>آماده چاپ و خروجی دیجیتال</span>
        </div>
        <div style="display:flex;justify-content:center;gap:0.75rem;margin-top:1.5rem;flex-wrap:wrap;">
          <button type="button" class="admin-btn admin-btn-primary" onclick="window.print()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            <span>چاپ کتابچه / ذخیره PDF</span>
          </button>
          <button type="button" class="admin-btn admin-btn-secondary" onclick="adminApp.downloadHandbookHtml()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            <span>دانلود کتابچه کامل آفلاین (HTML)</span>
          </button>
          <button type="button" class="admin-btn admin-btn-secondary" onclick="adminApp.downloadHandbookMarkdown()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <span>دانلود متن کتابچه (ePub / Markdown)</span>
          </button>
        </div>
      </div>

      <div class="handbook-toc">
        <h3 style="font-size:1.1rem;font-weight:800;margin-bottom:0.5rem;">فهرست الفبایی اصطلاحات دانشنامه</h3>
        <div class="handbook-toc-grid">
          ${terms.map(t => `
            <a href="#admin-handbook-term-${t.id}" style="color:var(--color-text);text-decoration:none;display:flex;align-items:center;gap:0.4rem;font-size:0.875rem;">
              <span style="font-weight:800;color:var(--color-primary);">${t.letter}:</span>
              <span>${t.persianName}</span>
            </a>
          `).join("")}
        </div>
      </div>

      <div class="handbook-content-section">
        ${this.renderAdminHandbookLevelSection("بخش اول: اصطلاحات سطح ۱ (نهادی و جهان‌شمول)", level1Terms)}
        ${this.renderAdminHandbookLevelSection("بخش دوم: اصطلاحات سطح ۲ (رایج و تثبیت‌شده)", level2Terms)}
        ${this.renderAdminHandbookLevelSection("بخش سوم: اصطلاحات سطح ۳ (جامعه‌ساخت و طیفی)", level3Terms)}
      </div>
    `;
  }

  renderAdminHandbookLevelSection(title, list) {
    if (!list || !list.length) return "";
    return `
      <div style="margin-top:2.5rem;padding-bottom:1rem;border-bottom:2px solid var(--border-highlight);">
        <h2 style="font-size:1.4rem;font-weight:800;color:var(--color-primary);margin-bottom:1.5rem;">${title}</h2>
        ${list.map(t => `
          <article id="admin-handbook-term-${t.id}" class="handbook-entry">
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
                <strong style="font-size:0.875rem;display:block;margin-bottom:0.6rem;">کج‌فهمی‌های رایج و شواهد علمی:</strong>
                ${t.misconceptions.map(m => `
                  <div style="margin-bottom:0.6rem;">
                    <div style="color:#ef4444;font-size:0.825rem;font-weight:700;">❌ باور غلط: ${m.myth}</div>
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
    const bodyContent = document.getElementById("adminHandbookBody")?.innerHTML || "";
    const fullHtml = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} — کتابچه جامع دانشنامه</title>
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
    this.showAdminToast("فایل کتابچه جامع آفلاین HTML با موفقیت دانلود شد.");
  }

  downloadHandbookMarkdown() {
    const terms = this.terms || [];
    let md = `# منشور — دانشنامه فارسی رنگین‌کمان\n\n`;
    md += `مرجع مستند، علمی و بدون سوگیری برای بازشناسی تنوع هویت‌ها، گرایش‌ها و مفاهیم جامعه رنگین‌کمان به زبان فارسی.\n\n`;
    md += `پروانه انتشار: Creative Commons (CC BY-SA 4.0)\n\n`;
    md += `تاریخ ایجاد نسخه چاپی: ${new Date().toLocaleDateString("fa-IR")}\n\n`;
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
    this.showAdminToast("فایل کتابچه متنی Markdown/ePub با موفقیت دانلود شد.");
  }
}

// Instantiate on load
let adminApp;
document.addEventListener("DOMContentLoaded", () => {
  adminApp = new ManshoorAdmin();
  window.adminApp = adminApp;
});
