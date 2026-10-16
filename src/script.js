document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", function (e) {
        const href = this.getAttribute("href");
        if (!href || href === "#") return;
        try {
            const target = document.querySelector(href);
            if (target) {
                e.preventDefault();
                target.scrollIntoView({ behavior: "smooth" });
                if (history.pushState) {
                    history.pushState(null, "", href);
                }
                if (this.classList.contains("skip-link") || target.hasAttribute("tabindex")) {
                    target.focus({ preventScroll: true });
                }
            }
        } catch (_) { }
    });
});

const I18N_TRANSLATIONS = {
    vi: {
        pageTitle: "TLOI - Thang Long Da Lat Olympiad in Informatics",
        pageDescription: "Gặp gỡ từ đam mê, đồng hành cùng công nghệ. TLOI - CLB Tin học Trường THPT Chuyên Thăng Long Đà Lạt.",
        nav: {
            skipLink: "Chuyển đến nội dung chính",
            mainAria: "Điều hướng chính",
            logoAria: "Trang chủ TLOI",
            team: "Đội ngũ",
            onlineJudge: "Online Judge",
            facebook: "Facebook",
            langSelectorAria: "Ngôn ngữ",
        },
        hero: {
            title: "Thang Long Da Lat Olympiad in Informatics",
            desc: "Gặp gỡ từ đam mê, đồng hành cùng công nghệ\nTLOI - CLB Tin học Trường THPT Chuyên Thăng Long Đà Lạt",
            onlineJudgeBtn: "Online Judge",
            facebookBtn: "Facebook",
        },
        mascot: {
            organizer: "TLOI Team",
            location: "Đà Lạt, Việt Nam",
        },
        team: {
            sectionTag: "Ban tổ chức",
            sectionTitle: "Đội ngũ TLOI",
            errorMsg: "Có vẻ như danh sách thành viên đang đi đâu đó.",
            retryBtn: "Thử lại",
        },
        footer: {
            desc: "Thang Long Da Lat Olympiad in Informatics. CLB Tin học Trường THPT Chuyên Thăng Long - Đà Lạt.",
            navigation: "ĐIỀU HƯỚNG",
            home: "Trang chủ",
            team: "Thành viên",
            onlineJudge: "Online Judge",
            connect: "KẾT NỐI",
            facebook: "Facebook",
            github: "GitHub",
            email: "Email",
            copyright: "© 2026 TLOI — Thang Long Da Lat Olympiad in Informatics. All rights reserved.",
        },
    },
    en: {
        pageTitle: "TLOI - Thang Long Da Lat Olympiad in Informatics",
        pageDescription: "Connected by passion, journeying with technology. TLOI - The Informatics Club of Thang Long High School for the Gifted, Da Lat.",
        nav: {
            skipLink: "Skip to main content",
            mainAria: "Main Navigation",
            logoAria: "TLOI Home",
            team: "Team",
            onlineJudge: "Online Judge",
            facebook: "Facebook",
            langSelectorAria: "Language selector",
        },
        hero: {
            title: "Thang Long Da Lat Olympiad in Informatics",
            desc: "Connected by passion, journeying with technology\nTLOI - The Informatics Club of Thang Long High School for the Gifted, Da Lat",
            onlineJudgeBtn: "Online Judge",
            facebookBtn: "Facebook",
        },
        mascot: {
            organizer: "TLOI Team",
            location: "Da Lat, Vietnam",
        },
        team: {
            sectionTag: "The Team",
            sectionTitle: "The people behind TLOI",
            errorMsg: "Looks like the team list went somewhere.",
            retryBtn: "Retry",
        },
        footer: {
            desc: "Thang Long Da Lat Olympiad in Informatics. The Informatics Club of Thang Long High School for the Gifted, Da Lat.",
            navigation: "NAVIGATION",
            home: "Home",
            team: "Team",
            onlineJudge: "Online Judge",
            connect: "CONNECT",
            facebook: "Facebook Page",
            github: "GitHub Org",
            email: "Email",
            copyright: "© 2026 TLOI — Thang Long Da Lat Olympiad in Informatics. All rights reserved.",
        },
    },
};

let currentLang = getInitialLanguage();
let cachedTeamData = null;

function getInitialLanguage() {
    try {
        const saved = localStorage.getItem("tloi_lang");
        if (saved && (saved === "vi" || saved === "en")) return saved;
    } catch (_) { }
    return "en";
}

const FLAT_TRANSLATIONS = { vi: {}, en: {} };
function flattenTranslations(sourceObj, prefix, targetObj) {
    for (const k in sourceObj) {
        const fullKey = prefix ? `${prefix}.${k}` : k;
        if (typeof sourceObj[k] === "object" && sourceObj[k] !== null) {
            flattenTranslations(sourceObj[k], fullKey, targetObj);
        } else {
            targetObj[fullKey] = sourceObj[k];
        }
    }
}
flattenTranslations(I18N_TRANSLATIONS.vi, "", FLAT_TRANSLATIONS.vi);
flattenTranslations(I18N_TRANSLATIONS.en, "", FLAT_TRANSLATIONS.en);

function getTranslation(key, lang = currentLang) {
    return FLAT_TRANSLATIONS[lang]?.[key] ?? FLAT_TRANSLATIONS.en?.[key] ?? FLAT_TRANSLATIONS.vi?.[key] ?? null;
}

function getLocalized(field, lang = currentLang) {
    if (!field) return "";
    if (typeof field === "object") {
        return field[lang] || field.en || field.vi || Object.values(field)[0] || "";
    }
    return field;
}

let languageRenderToken = 0;
let cachedLangButtons = null;
let cachedLangToggles = null;

function getLangButtons() {
    if (!cachedLangButtons || cachedLangButtons.length === 0) {
        cachedLangButtons = Array.from(document.querySelectorAll(".lang-toggle-btn, .cute-lang-btn, .lang-btn"));
    }
    return cachedLangButtons;
}

function getLangToggles() {
    if (!cachedLangToggles || cachedLangToggles.length === 0) {
        cachedLangToggles = Array.from(document.querySelectorAll(".footer-lang-toggle"));
    }
    return cachedLangToggles;
}

function setLanguage(lang) {
    if (!I18N_TRANSLATIONS[lang]) return;
    currentLang = lang;
    try {
        localStorage.setItem("tloi_lang", lang);
    } catch (_) { }

    document.documentElement.lang = lang;

    getLangButtons().forEach((btn) => {
        const btnLang = btn.getAttribute("data-lang-code");
        const isActive = btnLang === lang;
        btn.classList.toggle("active", isActive);
        btn.setAttribute("aria-pressed", isActive ? "true" : "false");
    });

    getLangToggles().forEach((toggle) => {
        toggle.setAttribute("data-current-lang", lang);
    });

    const token = ++languageRenderToken;
    const applyHeavy = () => {
        if (token !== languageRenderToken) return;

        const pageTitle = getTranslation("pageTitle", lang);
        if (pageTitle) document.title = pageTitle;

        const pageDesc = getTranslation("pageDescription", lang);
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc && pageDesc) metaDesc.setAttribute("content", pageDesc);
        const ogDesc = document.querySelector('meta[property="og:description"]');
        if (ogDesc && pageDesc) ogDesc.setAttribute("content", pageDesc);
        const twDesc = document.querySelector('meta[name="twitter:description"]');
        if (twDesc && pageDesc) twDesc.setAttribute("content", pageDesc);

        document.querySelectorAll("[data-i18n]").forEach((el) => {
            const key = el.getAttribute("data-i18n");
            const val = getTranslation(key, lang);
            if (val !== null && val !== undefined) {
                if (el.classList.contains("hero-title")) {
                    el.innerHTML = val.split(" ").map((word) => `<span class="title-word">${Array.from(word).map((char) => `<span class="title-char">${char}</span>`).join("")}</span>`).join(" ");
                    el.setAttribute("aria-label", val);
                } else {
                    el.textContent = val;
                }
            }
        });

        document.querySelectorAll("[data-i18n-attr]").forEach((el) => {
            const specs = el.getAttribute("data-i18n-attr").split(",");
            for (const spec of specs) {
                const [attr, key] = spec.split(":").map((s) => s.trim());
                if (attr && key) {
                    const val = getTranslation(key, lang);
                    if (val !== null && val !== undefined) {
                        el.setAttribute(attr, val);
                    }
                }
            }
        });

        if (cachedTeamData) {
            renderTeams(cachedTeamData);
        }
        if (typeof window.__LG_REFRESH__ === "function") {
            window.__LG_REFRESH__();
        }
    };

    if (token === 1) {
        applyHeavy();
    } else if (typeof requestIdleCallback === "function") {
        requestIdleCallback(applyHeavy, { timeout: 150 });
    } else if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(() => {
            requestAnimationFrame(applyHeavy);
        });
    } else {
        setTimeout(applyHeavy, 0);
    }
}

function initLanguageSwitcher() {
    setLanguage(currentLang);
    if (typeof window.__LG_REFRESH__ === "function") {
        window.__LG_REFRESH__();
    }

    const reducedMotionQuery = typeof window !== "undefined" && window.matchMedia
        ? window.matchMedia("(prefers-reduced-motion: reduce)")
        : null;

    const POS_K = 380;
    const POS_C = 26;
    const SWELL_K = 420;
    const SWELL_C = 22;
    const SWELL_PEAK = 1.14;
    const VELOCITY_STRETCH_K = 0.10;
    const MAX_STRETCH = 0.14;
    const DRAG_THRESHOLD_PX = 4;
    const TAP_HOP_DURATION_MS = 60;

    document.querySelectorAll(".cute-lang-btn, .lang-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            const lang = btn.getAttribute("data-lang-code");
            if (lang && lang !== currentLang) {
                setLanguage(lang);
            }
        });
    });

    document.querySelectorAll(".footer-lang-toggle").forEach((toggle) => {
        const glider = toggle.querySelector(".lang-toggle-glider");
        const viBtn = toggle.querySelector('[data-lang-code="vi"]');
        const enBtn = toggle.querySelector('[data-lang-code="en"]');
        if (!glider || !viBtn || !enBtn) return;

        let posX = 0;
        let velX = 0;
        let targetPosX = 0;

        let swell = 1.0;
        let velSwell = 0;
        let targetSwell = 1.0;
        let holdSwellUntil = 0;

        let smoothedDragVel = 0;
        let lastPointerX = 0;
        let lastPointerTime = 0;

        let isPointerDown = false;
        let isDragging = false;
        let startPointerX = 0;
        let dragStartTime = 0;
        let dragAnchorX = 0;
        let initialLang = "vi";
        let targetLang = "vi";
        let travelDistance = 0;
        let preventClickUntil = 0;
        let lastP = 0;

        let rafId = null;
        let lastFrameTime = 0;

        const rubber = (x, range = 28) => (1 - 1 / (x * 0.55 / range + 1)) * range;

        function getTravelDistance() {
            const dist = enBtn.offsetLeft - viBtn.offsetLeft;
            return dist > 0 ? dist : (glider.offsetWidth || 89);
        }

        function syncFromAttr() {
            if (rafId || isPointerDown) return;
            targetLang = toggle.getAttribute("data-current-lang") || currentLang || "vi";
            travelDistance = getTravelDistance();
            posX = targetPosX = targetLang === "en" ? travelDistance : 0;
            velX = 0;
        }

        travelDistance = getTravelDistance();
        targetLang = currentLang || toggle.getAttribute("data-current-lang") || "vi";
        initialLang = targetLang;
        posX = targetPosX = targetLang === "en" ? travelDistance : 0;

        function stepPhysics(dt) {
            const prefersReducedMotion = Boolean(reducedMotionQuery?.matches);

            if (prefersReducedMotion) {
                const step = Math.min(dt * 18, 1);
                posX += (targetPosX - posX) * step;
                velX = 0;
                swell = 1.0;
                velSwell = 0;
                glider.style.transform = `translate3d(${posX.toFixed(2)}px,0,0)`;
                return;
            }

            let remaining = Math.min(dt, 0.064);
            const subStep = 0.004;
            const isHoldingSwell = performance.now() < holdSwellUntil;
            const flightSwell = 1 + (SWELL_PEAK - 1) * 0.6 * Math.min(Math.abs(velX) / 800, 1);
            const currentTargetSwell = isHoldingSwell ? SWELL_PEAK : Math.max(targetSwell, flightSwell);

            while (remaining > 0) {
                const h = Math.min(remaining, subStep);

                if (!isDragging) {
                    velX += (-POS_K * (posX - targetPosX) - POS_C * velX) * h;
                    posX += velX * h;
                }

                velSwell += (-SWELL_K * (swell - currentTargetSwell) - SWELL_C * velSwell) * h;
                swell += velSwell * h;

                remaining -= h;
            }

            if (isDragging) {
                smoothedDragVel *= Math.exp(-16 * dt);
            }

            const speedMs = Math.abs(isDragging ? smoothedDragVel : (velX / 1000));
            const stretch = Math.min(speedMs * VELOCITY_STRETCH_K, MAX_STRETCH);

            const sx = swell * (1 + stretch);
            const sy = swell / (1 + stretch);

            const p = Math.min(Math.max((swell - 1) / (SWELL_PEAK - 1), 0), 1);
            if (Math.abs(p - lastP) >= 0.015) {
                lastP = p;
                glider.style.setProperty("--p", p.toFixed(3));
            }
            const dir = Math.sign(isDragging ? smoothedDragVel : velX);
            const lead = dir * stretch * travelDistance * 0.35;
            glider.style.transform = `translate3d(${(posX + lead).toFixed(2)}px,0,0) scale(${sx.toFixed(4)},${sy.toFixed(4)})`;
        }

        function checkSettled() {
            if (isPointerDown || isDragging) return false;
            if (performance.now() < holdSwellUntil) return false;

            const isPosSettled = Math.abs(posX - targetPosX) < 0.20 && Math.abs(velX) < 10;
            const isSwellSettled = Math.abs(swell - 1.0) < 0.005 && Math.abs(velSwell) < 0.05;

            return isPosSettled && isSwellSettled;
        }

        function stopAndSettle() {
            if (rafId) {
                cancelAnimationFrame(rafId);
                rafId = null;
            }
            lastFrameTime = 0;

            posX = targetPosX;
            velX = 0;
            swell = 1.0;
            velSwell = 0;

            toggle.setAttribute("data-current-lang", targetLang);
            if (targetLang !== currentLang) {
                setLanguage(targetLang);
            }

            glider.style.transform = "";
            glider.style.willChange = "";
            glider.style.removeProperty("--p");
            lastP = 0;

            toggle.classList.remove("is-animating", "is-pressed", "is-dragging");
        }

        function onFrame(timestamp) {
            if (!lastFrameTime) lastFrameTime = timestamp;
            const dt = Math.min((timestamp - lastFrameTime) / 1000, 0.064);
            lastFrameTime = timestamp;

            stepPhysics(dt);

            if (checkSettled()) {
                stopAndSettle();
                return;
            }

            rafId = requestAnimationFrame(onFrame);
        }

        function startLoop() {
            toggle.classList.add("is-animating");
            glider.style.willChange = "transform";
            if (!rafId) {
                lastFrameTime = 0;
                rafId = requestAnimationFrame(onFrame);
            }
        }

        function triggerLanguageSwitch(newLang) {
            syncFromAttr();
            targetLang = newLang;
            targetPosX = targetLang === "en" ? travelDistance : 0;

            targetSwell = 1.0;
            holdSwellUntil = performance.now() + TAP_HOP_DURATION_MS;

            if (targetLang !== currentLang) {
                setLanguage(targetLang);
            }

            startLoop();
        }

        function handlePointerMove(e) {
            if (!isPointerDown) return;

            const deltaX = e.clientX - startPointerX;
            const now = performance.now();
            const dt = now - lastPointerTime;

            if (!isDragging) {
                if (Math.abs(deltaX) > DRAG_THRESHOLD_PX) {
                    isDragging = true;
                    toggle.classList.add("is-dragging");
                    try {
                        toggle.setPointerCapture(e.pointerId);
                    } catch (_) {}
                }
            }

            if (dt >= 4) {
                const rawVel = (e.clientX - lastPointerX) / dt;
                const clampedRawVel = Math.max(-3.0, Math.min(3.0, rawVel));
                smoothedDragVel = smoothedDragVel * 0.7 + clampedRawVel * 0.3;
                lastPointerX = e.clientX;
                lastPointerTime = now;
            }

            if (isDragging) {
                let rawPos = dragAnchorX + deltaX;

                if (rawPos < 0) {
                    rawPos = -rubber(-rawPos);
                } else if (rawPos > travelDistance) {
                    rawPos = travelDistance + rubber(rawPos - travelDistance);
                }

                posX = rawPos;
                targetPosX = rawPos;
            }
        }

        function cleanupWindowPointerListeners() {
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", handlePointerEnd);
            window.removeEventListener("pointercancel", handlePointerCancel);
            window.removeEventListener("blur", handleWindowBlur);
        }

        function handlePointerEnd(e) {
            cleanupWindowPointerListeners();

            if (!isPointerDown) return;
            isPointerDown = false;

            toggle.classList.remove("is-pressed");

            if (isDragging) {
                isDragging = false;
                preventClickUntil = performance.now() + 250;
                toggle.classList.remove("is-dragging");

                if (e && e.pointerId) {
                    try {
                        if (toggle.hasPointerCapture && toggle.hasPointerCapture(e.pointerId)) {
                            toggle.releasePointerCapture(e.pointerId);
                        }
                    } catch (_) {}
                }

                const deltaX = (e ? e.clientX : lastPointerX) - startPointerX;
                const totalElapsed = Math.max(1, performance.now() - dragStartTime);
                const rawReleaseVel = Math.abs(smoothedDragVel) > 0.05 ? smoothedDragVel : (deltaX / totalElapsed);
                const releaseVel = Math.max(-3.0, Math.min(3.0, rawReleaseVel));

                const projected = posX + releaseVel * 1000 * 0.12;
                const nextLang = projected > travelDistance / 2 ? "en" : "vi";

                targetLang = nextLang;
                targetPosX = targetLang === "en" ? travelDistance : 0;
                velX = releaseVel * 1000;
                targetSwell = 1.0;
                holdSwellUntil = 0;

                if (targetLang !== currentLang) {
                    setLanguage(targetLang);
                }

                startLoop();
            } else {
                targetSwell = 1.0;
                startLoop();
            }
        }

        function handlePointerCancel(e) {
            cleanupWindowPointerListeners();

            if (!isPointerDown) return;
            isPointerDown = false;
            isDragging = false;

            toggle.classList.remove("is-pressed", "is-dragging");

            if (e && e.pointerId) {
                try {
                    if (toggle.hasPointerCapture && toggle.hasPointerCapture(e.pointerId)) {
                        toggle.releasePointerCapture(e.pointerId);
                    }
                } catch (_) {}
            }

            targetLang = initialLang;
            targetPosX = targetLang === "en" ? travelDistance : 0;
            velX = 0;
            targetSwell = 1.0;
            holdSwellUntil = 0;

            startLoop();
        }

        function handleWindowBlur() {
            if (isPointerDown) {
                handlePointerCancel();
            }
        }

        toggle.addEventListener("pointerdown", (e) => {
            if (e.button !== 0) return;

            syncFromAttr();

            isPointerDown = true;
            isDragging = false;
            startPointerX = e.clientX;
            lastPointerX = e.clientX;
            lastPointerTime = performance.now();
            dragStartTime = lastPointerTime;
            smoothedDragVel = 0;

            dragAnchorX = posX;
            initialLang = toggle.getAttribute("data-current-lang") || currentLang || "vi";

            targetSwell = SWELL_PEAK;
            holdSwellUntil = 0;

            window.addEventListener("pointermove", handlePointerMove, { passive: true });
            window.addEventListener("pointerup", handlePointerEnd, { passive: true });
            window.addEventListener("pointercancel", handlePointerCancel, { passive: true });
            window.addEventListener("blur", handleWindowBlur, { passive: true });

            toggle.classList.add("is-pressed");
            startLoop();
        });

        toggle.addEventListener("click", (e) => {
            if (performance.now() < preventClickUntil) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }

            const btn = e.target.closest(".lang-toggle-btn");
            if (!btn) return;

            const langCode = btn.getAttribute("data-lang-code");
            if (langCode) {
                triggerLanguageSwitch(langCode);
            }
        }, true);
    });
}

async function loadTeams() {
    const container = document.getElementById("team-sections");
    if (!container) return;

    if (cachedTeamData) {
        renderTeams(cachedTeamData);
        return;
    }

    try {
        const res = await fetch("data/team.json");
        if (!res.ok)
            throw new Error(`Failed to load team.json (${res.status})`);

        cachedTeamData = await res.json();
        renderTeams(cachedTeamData);
    } catch (err) {
        console.error("Error loading team data:", err);
        const errorMsg = getTranslation("team.errorMsg") || "Could not load team data at this moment.";
        const retryBtn = getTranslation("team.retryBtn") || "Retry";
        container.innerHTML = `
            <div class="team-error-state">
                <p class="team-error-msg">${escapeHtml(errorMsg)}</p>
                <button class="btn-retry" onclick="loadTeams()">${escapeHtml(retryBtn)}</button>
            </div>
        `;
    }
}
window.loadTeams = loadTeams;

function renderTeams(data) {
    const container = document.getElementById("team-sections");
    if (!container) return;

    const wasAlreadyRevealed = Boolean(container.querySelector(".team-member.is-revealed"));
    const teams = Array.isArray(data.teams) ? data.teams : [];
    container.innerHTML = teams.map((team) => renderTeamSection(team, wasAlreadyRevealed)).join("");
    if (typeof window.__LG_REFRESH__ === "function") {
        window.__LG_REFRESH__();
    }
    setupTeamReveal(wasAlreadyRevealed);
}

function renderTeamSection(team, wasAlreadyRevealed = false) {
    const teamKey = team.key || "";
    const title = getLocalized(team.title, currentLang);
    const subtitle = getLocalized(team.subtitle, currentLang);
    const members = (team.members || []).map((m) => renderMemberCard(m, teamKey, wasAlreadyRevealed)).join("");

    return `
    <div class="team-section" id="team-${escapeHtml(teamKey)}">
      <div class="team-section-header">
        <h3 class="team-section-title">${escapeHtml(title)}</h3>
        ${subtitle ? `<p class="team-section-subtitle">${escapeHtml(subtitle)}</p>` : ""}
      </div>

      <div class="team-grid">
        ${members}
      </div>
    </div>
  `;
}

const DEFAULT_AVATARS = {
    "Dinh Cao Minh Quan": "data/pfp/dcmq.webp",
    "Đinh Cao Minh Quân": "data/pfp/dcmq.webp",
    "Hoang Duc Huy": "data/pfp/hdh.webp",
    "Hoàng Đức Huy": "data/pfp/hdh.webp",
    "Tran The Bao": "data/pfp/ttb.webp",
    "Trần Thế Bảo": "data/pfp/ttb.webp",
    "La Gia Huy": "data/pfp/lgh.webp",
    "Lã Gia Huy": "data/pfp/lgh.webp",
    "Nguyen Quang Long (chovang)": "data/pfp/nql.webp",
    "Nguyễn Quang Long (chovang)": "data/pfp/nql.webp",
    "Ta Hoang Phuc": "data/pfp/thp.webp",
    "Tạ Hoàng Phúc": "data/pfp/thp.webp",
    "Le Tuan Thinh": "data/pfp/ltt.webp",
    "Lê Tuấn Thịnh": "data/pfp/ltt.webp",
    "Nguyen Tien Son": "data/pfp/nts.webp",
    "Nguyễn Tiến Sơn": "data/pfp/nts.webp",
    "Nguyen Pham Dong Nhi": "data/pfp/npdn.webp",
    "Nguyễn Phạm Đông Nhi": "data/pfp/npdn.webp",
    "Bui Duy Tri Thien": "data/pfp/bdtt.webp",
    "Bùi Duy Trí Thiện": "data/pfp/bdtt.webp",
    "Tran Minh Huy": "data/pfp/tmh.webp",
    "Trần Minh Huy": "data/pfp/tmh.webp",
    "Huynh Anh Kiet": "data/pfp/hak.webp",
    "Huỳnh Anh Kiệt": "data/pfp/hak.webp",
    "Hoang Duc Chinh": "data/pfp/hdc.webp",
    "Hoàng Đức Chính": "data/pfp/hdc.webp",
    "Dang Huy Hau": "data/pfp/dhh.webp",
    "Đặng Huy Hậu": "data/pfp/dhh.webp",
    "Pham Huu Khiem": "data/pfp/phk.webp",
    "Phạm Hữu Khiêm": "data/pfp/phk.webp",
    "Vo Gia Minh": "data/pfp/vgm.webp",
    "Võ Gia Minh": "data/pfp/vgm.webp"
};

function getMemberInitial(name) {
    if (!name) return "?";
    const cleaned = name.replace(/\s*\([^)]*\)/g, "").trim();
    const parts = cleaned.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    const givenName = parts[parts.length - 1];
    return givenName.charAt(0).toUpperCase();
}

function handleAvatarError(img) {
    if (!img) return;
    const maxRetries = 2;
    const currentRetries = parseInt(img.getAttribute("data-retries") || "0", 10);
    const originalSrc = img.getAttribute("data-original-src") || img.getAttribute("src") || "";

    if (!img.getAttribute("data-original-src") && originalSrc) {
        img.setAttribute("data-original-src", originalSrc.split("?")[0]);
    }

    const baseSrc = img.getAttribute("data-original-src") || originalSrc;

    if (currentRetries < maxRetries && baseSrc) {
        img.setAttribute("data-retries", String(currentRetries + 1));
        const backoffMs = (currentRetries + 1) * 350;
        setTimeout(() => {
            const separator = baseSrc.includes("?") ? "&" : "?";
            img.src = `${baseSrc}${separator}_r=${Date.now()}`;
        }, backoffMs);
    } else {
        img.style.display = "none";
        const letterFallback = img.nextElementSibling;
        if (letterFallback) {
            letterFallback.style.display = "flex";
        }
    }
}

function handleAvatarLoad(img) {
    if (!img) return;
    img.style.display = "";
    const letterFallback = img.nextElementSibling;
    if (letterFallback) {
        letterFallback.style.display = "none";
    }
}

window.handleAvatarError = handleAvatarError;
window.handleAvatarLoad = handleAvatarLoad;

function renderMemberCard(m, teamKey, isRevealed = false) {
    const rawEnName = typeof m.name === "object" ? (m.name.en || "") : (m.name || "");
    const rawViName = typeof m.name === "object" ? (m.name.vi || "") : (m.name || "");
    const memberName = getLocalized(m.name, currentLang);
    const role = getLocalized(m.role, currentLang);
    const avatarSrc = m.avatar || DEFAULT_AVATARS[rawEnName] || DEFAULT_AVATARS[rawViName] || DEFAULT_AVATARS[memberName] || "";
    const initial = getMemberInitial(memberName);
    const revealedClass = isRevealed ? " is-revealed" : "";

    let avatarMarkup = "";
    if (avatarSrc) {
        avatarMarkup = `
        <div class="team-avatar">
          <img 
            src="${escapeHtml(avatarSrc)}" 
            alt="${escapeHtml(memberName || "")}" 
            class="team-avatar-img" 
            width="160"
            height="160"
            loading="lazy"
            decoding="async"
            onload="handleAvatarLoad(this)"
            onerror="handleAvatarError(this)"
          />
          <span class="team-avatar-letter" style="display: none;">${escapeHtml(initial)}</span>
        </div>
      `;
    } else {
        avatarMarkup = `
        <div class="team-avatar">
          <span class="team-avatar-letter">${escapeHtml(initial)}</span>
        </div>
      `;
    }

    return `
    <div class="team-member team-member-${escapeHtml(teamKey)}${revealedClass}">
      ${avatarMarkup}
      <div class="team-info">
        <h4 class="team-name">${escapeHtml(memberName || "")}</h4>
        ${role ? `<div class="team-role">${escapeHtml(role)}</div>` : ""}
      </div>
    </div>
  `;
}

let teamRevealObserver = null;

function setupTeamReveal(wasAlreadyRevealed = false) {
    if (wasAlreadyRevealed) {
        if (teamRevealObserver) teamRevealObserver.disconnect();
        return;
    }

    if (!teamRevealObserver) {
        teamRevealObserver = new IntersectionObserver((entries, obs) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("is-revealed");
                    obs.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.1,
            rootMargin: "0px 0px -50px 0px",
        });
    } else {
        teamRevealObserver.disconnect();
    }

    document.querySelectorAll(".team-member:not(.is-revealed)").forEach((el) => {
        teamRevealObserver.observe(el);
    });
}

const HTML_ESCAPE_MAP = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
};
const HTML_ESCAPE_REGEX = /[&<>"']/g;

function escapeHtml(str) {
    return String(str).replace(HTML_ESCAPE_REGEX, (char) => HTML_ESCAPE_MAP[char]);
}

(function initScrollState() {
    let isScrolling = false;
    let scrollStopTimer = null;
    window.addEventListener("scroll", () => {
        if (!isScrolling) {
            isScrolling = true;
            document.documentElement.classList.add("is-scrolling");
        }
        if (scrollStopTimer) clearTimeout(scrollStopTimer);
        scrollStopTimer = setTimeout(() => {
            isScrolling = false;
            document.documentElement.classList.remove("is-scrolling");
        }, 150);
    }, { passive: true });
})();

(function blossomFalling() {
    const container = document.querySelector(".petal-container");
    if (!container) return;

    const reduceMotionMedia = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (reduceMotionMedia?.matches) return;

    const PETAL_WEBP = "img/blossom-petal.webp";
    const PETAL_PNG = "img/blossom-petal.png";

    const mobileMediaQuery = typeof window.matchMedia === "function" ? window.matchMedia("(max-width: 768px)") : null;
    const isMobileViewport = () => Boolean(mobileMediaQuery?.matches);
    const isLowEndDevice = () =>
        document.documentElement.classList.contains("low-end-device") ||
        Boolean(navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) ||
        Boolean(navigator.deviceMemory && navigator.deviceMemory <= 4);

    const isLowEnd = isLowEndDevice();
    const isMobile = isMobileViewport();
    const MAX_PETALS = isLowEnd ? (isMobile ? 4 : 6) : (isMobile ? 5 : 8);

    function rand(min, max) {
        return Math.random() * (max - min) + min;
    }

    function resetPetal(petal, isInitial = false, customDelay = null) {
        const mobile = isMobileViewport();
        const size = mobile ? rand(18, 28) : rand(22, 34);
        const fall = rand(7.5, 13.5);
        const delay = customDelay !== null ? customDelay : (isInitial ? -rand(0, fall * 0.9) : rand(0.1, 1.8));
        const sway = mobile ? rand(16, 34) : rand(28, 62);
        const swayDur = rand(2.8, 4.8);
        const spin = rand(3.6, 6.8);
        const opacity = rand(0.58, 0.92);
        const x = rand(1, 95);
        const rot0 = rand(0, 360);

        const scaleVal = (size / 32).toFixed(2);
        const swayVal = sway.toFixed(1);
        const rot0Val = rot0.toFixed(0);
        const rot1Val = (rot0 + 360).toFixed(0);

        petal.style.cssText = `--x:${x.toFixed(1)}vw;--scale:${scaleVal};--fall:${fall.toFixed(2)}s;--delay:${delay.toFixed(2)}s;--sway:${swayVal}px;--sway-neg:-${swayVal}px;--swayDur:${swayDur.toFixed(2)}s;--spin:${spin.toFixed(2)}s;--opacity:${opacity.toFixed(2)};--rot0:${rot0Val}deg;--rot1:${rot1Val}deg;`;

        if (!isInitial) {
            petal.classList.toggle("is-alt");
        }
    }

    const templatePetal = document.createElement("div");
    templatePetal.className = "petal";

    const templateImg = document.createElement("img");
    templateImg.className = "petal-img";
    templateImg.src = PETAL_WEBP;
    templateImg.width = 96;
    templateImg.height = 96;
    templateImg.decoding = "async";
    templateImg.alt = "";
    templateImg.setAttribute("aria-hidden", "true");
    templateImg.setAttribute("draggable", "false");
    templatePetal.appendChild(templateImg);

    container.addEventListener("animationend", (e) => {
        if (e.animationName === "petal-fall-0" || e.animationName === "petal-fall-1") {
            resetPetal(e.target, false);
        }
    });

    container.addEventListener("error", (e) => {
        const target = e.target;
        if (target && target.tagName === "IMG" && typeof target.src === "string" && target.src.indexOf(".webp") !== -1) {
            target.src = PETAL_PNG;
        }
    }, true);

    const fragment = document.createDocumentFragment();
    for (let i = 0; i < MAX_PETALS; i++) {
        const petal = templatePetal.cloneNode(true);
        resetPetal(petal, true);
        fragment.appendChild(petal);
    }
    container.replaceChildren(fragment);

    if (typeof navigator.getBattery === "function") {
        navigator.getBattery().then((battery) => {
            let wasDisabled = false;
            const handleBattery = () => {
                if (!battery.charging && battery.level <= 0.2) {
                    container.style.display = "none";
                    wasDisabled = true;
                } else {
                    container.style.display = "";
                    if (wasDisabled) {
                        wasDisabled = false;
                        const petals = container.querySelectorAll(".petal");
                        petals.forEach((p, idx) => {
                            resetPetal(p, false, idx * 0.45);
                        });
                    }
                }
            };
            handleBattery();
            battery.addEventListener("levelchange", handleBattery);
            battery.addEventListener("chargingchange", handleBattery);
        }).catch(() => { });
    }

    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            document.documentElement.classList.add("is-tab-hidden");
        } else {
            document.documentElement.classList.remove("is-tab-hidden");
        }
    });
})();

(function observeHeroViewport() {
    const heroVisual = document.querySelector(".hero-visual-raw");
    if (!heroVisual || !("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                heroVisual.classList.remove("is-offscreen");
            } else {
                heroVisual.classList.add("is-offscreen");
            }
        });
    }, { rootMargin: "150px 0px" });

    observer.observe(heroVisual);
})();

(function lockHeroHeightOnLoad() {
    const hero = document.querySelector(".hero");
    if (!hero) return;

    if (window.matchMedia?.("(min-width: 769px)")?.matches) {
        const initialVH = window.innerHeight;
        hero.style.setProperty("--heroH", `${initialVH}px`);
    }
})();

initLanguageSwitcher();
loadTeams();

(function initNavHoverGlare() {
    if (window.matchMedia?.("(pointer: coarse)")?.matches) return;

    let navRafId = null;
    let lastNavEvent = null;

    document.querySelectorAll(".navbar, nav").forEach((el) => {
        let cachedNavRect = null;
        const invalidateNavRect = () => { cachedNavRect = null; };

        el.addEventListener("mouseenter", () => {
            cachedNavRect = el.getBoundingClientRect();
            el.style.setProperty("--nav-glare-opacity", "1");
        }, { passive: true });

        window.addEventListener("scroll", invalidateNavRect, { passive: true });
        window.addEventListener("resize", invalidateNavRect, { passive: true });

        el.addEventListener("mousemove", (e) => {
            lastNavEvent = e;
            if (!navRafId) {
                navRafId = requestAnimationFrame(() => {
                    if (lastNavEvent) {
                        if (!cachedNavRect) {
                            cachedNavRect = el.getBoundingClientRect();
                        }
                        const x = lastNavEvent.clientX - cachedNavRect.left;
                        const y = lastNavEvent.clientY - cachedNavRect.top;
                        el.style.setProperty("--nav-mouse-x", `${x}px`);
                        el.style.setProperty("--nav-mouse-y", `${y}px`);
                    }
                    navRafId = null;
                });
            }
        }, { passive: true });

        el.addEventListener("mouseleave", () => {
            if (navRafId) {
                cancelAnimationFrame(navRafId);
                navRafId = null;
            }
            cachedNavRect = null;
            el.style.setProperty("--nav-glare-opacity", "0");
        });
    });
})();

(function initNavbarScroll() {
    const navEl = document.querySelector(".navbar, nav");
    if (!navEl) return;

    let isScrolled = false;
    let tick = false;

    function checkScroll() {
        const scrolled = window.scrollY > 20;
        if (scrolled !== isScrolled) {
            isScrolled = scrolled;
            navEl.classList.toggle("navbar-scrolled", isScrolled);
        }
        tick = false;
    }

    window.addEventListener("scroll", () => {
        if (!tick) {
            requestAnimationFrame(checkScroll);
            tick = true;
        }
    }, { passive: true });
    checkScroll();
})();

window.addEventListener("online", () => {
    document.querySelectorAll(".team-avatar-img").forEach((img) => {
        if (img.style.display === "none") {
            img.removeAttribute("data-retries");
            const baseSrc = img.getAttribute("data-original-src") || img.src.split("?")[0];
            if (baseSrc) {
                const sep = baseSrc.includes("?") ? "&" : "?";
                img.src = `${baseSrc}${sep}_r=${Date.now()}`;
            }
        }
    });
}, { passive: true });
