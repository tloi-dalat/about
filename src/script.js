document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", function (e) {
        const href = this.getAttribute("href");
        if (!href || href === "#") return;
        const target = document.querySelector(href);
        if (target) {
            e.preventDefault();
            target.scrollIntoView({ behavior: "smooth" });
        }
    });
});

async function loadTeams() {
    const container = document.getElementById("team-sections");
    if (!container) return;

    try {
        const res = await fetch("data/team.json");
        if (!res.ok)
            throw new Error(`Failed to load team.json (${res.status})`);

        const data = await res.json();
        const teams = Array.isArray(data.teams) ? data.teams : [];

        container.innerHTML = teams.map(renderTeamSection).join("");
        setupTeamReveal();
    } catch (err) {
        console.error("Error loading team data:", err);
        container.innerHTML = `
            <div class="team-error-state">
                <p class="team-error-msg">Could not load team data at this moment.</p>
                <button class="btn-retry" onclick="loadTeams()">Retry</button>
            </div>
        `;
    }
}

function renderTeamSection(team) {
    const teamKey = team.key || "";
    const members = (team.members || []).map((m) => renderMemberCard(m, teamKey)).join("");

    return `
    <div class="team-section" id="team-${escapeHtml(teamKey)}">
      <div class="team-section-header">
        <h3 class="team-section-title">${escapeHtml(team.title || "")}</h3>
        ${team.subtitle ? `<p class="team-section-subtitle">${escapeHtml(team.subtitle)}</p>` : ""}
      </div>

      <div class="team-grid">
        ${members}
      </div>
    </div>
  `;
}

function renderMemberCard(m, teamKey) {
    return `
    <div class="team-member team-member-${escapeHtml(teamKey)}">
      <div class="team-info">
        <h4 class="team-name">${escapeHtml(m.name || "")}</h4>
        ${m.role ? `<div class="team-role">${escapeHtml(m.role)}</div>` : ""}
      </div>
    </div>
  `;
}

function setupTeamReveal() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: "0px 0px -50px 0px",
    };

    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add("is-revealed");
                obs.unobserve(entry.target);
            }
        });
    }, observerOptions);

    document.querySelectorAll(".team-member").forEach((el) => {
        observer.observe(el);
    });
}

function escapeHtml(str) {
    return String(str)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

(function blossomFalling() {
    const container = document.querySelector(".petal-container");
    if (!container) return;

    const reduceMotion = window.matchMedia?.(
        "(prefers-reduced-motion: reduce)",
    )?.matches;
    if (reduceMotion) return;

    const PETAL_SRC = "img/blossom.png";
    const isMobile = window.matchMedia?.("(max-width: 768px)")?.matches;
    const MAX_PETALS = isMobile ? 3 : 7;

    function rand(min, max) {
        return Math.random() * (max - min) + min;
    }

    function resetPetal(petal, isInitial = false) {
        const size = rand(18, 38);
        const fall = rand(7.5, 14.0);
        const delay = isInitial ? rand(0, 5.5) : 0;
        const sway = rand(25, 75);
        const swayDur = rand(2.8, 5.0);
        const spin = rand(3.0, 6.0);
        const opacity = rand(0.4, 0.85);
        const x = rand(-5, 102);
        const rot0 = rand(0, 360);

        petal.style.setProperty("--x", `${x}vw`);
        petal.style.setProperty("--size", `${size}px`);
        petal.style.setProperty("--fall", `${fall}s`);
        petal.style.setProperty("--delay", `${delay}s`);
        petal.style.setProperty("--sway", `${sway}px`);
        petal.style.setProperty("--swayDur", `${swayDur}s`);
        petal.style.setProperty("--spin", `${spin}s`);
        petal.style.setProperty("--opacity", `${opacity}`);
        petal.style.setProperty("--rot0", `${rot0}deg`);

        if (!isInitial) {
            petal.style.animation = "none";
            void petal.offsetWidth;
            petal.style.animation = "";
        }
    }

    function createPetalNode(isInitial = true) {
        const petal = document.createElement("div");
        petal.className = "petal";

        const swayWrap = document.createElement("div");
        swayWrap.className = "petal-sway";

        const img = document.createElement("img");
        img.className = "petal-img";
        img.src = PETAL_SRC;
        img.alt = "";
        img.setAttribute("aria-hidden", "true");

        swayWrap.appendChild(img);
        petal.appendChild(swayWrap);

        resetPetal(petal, isInitial);

        petal.addEventListener("animationend", (e) => {
            if (e.target === petal && !document.hidden) {
                resetPetal(petal, false);
            }
        });

        return petal;
    }

    for (let i = 0; i < MAX_PETALS; i++) {
        const petal = createPetalNode(true);
        container.appendChild(petal);
    }

    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) {
            const currentPetals = container.querySelectorAll(".petal");
            currentPetals.forEach((p, idx) => {
                if (idx < (isMobile ? 2 : 3)) resetPetal(p, false);
            });
        }
    });
})();

(function lockHeroHeightOnLoad() {
    const hero = document.querySelector(".hero");
    if (!hero) return;

    if (window.matchMedia?.("(min-width: 769px)")?.matches) {
        const initialVH = window.innerHeight;
        hero.style.setProperty("--heroH", `${initialVH}px`);
    }
})();

loadTeams();

(function initNavHoverGlare() {
    if (window.matchMedia?.("(pointer: coarse)")?.matches) return;

    let navRafId = null;
    let lastNavEvent = null;

    document.querySelectorAll(".navbar, nav").forEach((el) => {
        el.addEventListener("mousemove", (e) => {
            lastNavEvent = e;
            if (!navRafId) {
                navRafId = requestAnimationFrame(() => {
                    if (lastNavEvent) {
                        const rect = el.getBoundingClientRect();
                        const x = lastNavEvent.clientX - rect.left;
                        const y = lastNavEvent.clientY - rect.top;
                        el.style.setProperty("--nav-mouse-x", `${x}px`);
                        el.style.setProperty("--nav-mouse-y", `${y}px`);
                        el.style.setProperty("--nav-glare-opacity", "1");
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
            el.style.setProperty("--nav-glare-opacity", "0");
        });
    });
})();

const SURFACE_FNS = {
    convex_squircle: (x) => Math.pow(Math.max(0, 1 - Math.pow(1 - x, 4)), 0.25),
    convex_circle: (x) => Math.sqrt(Math.max(0, 1 - (1 - x) * (1 - x))),
    linear: (x) => Math.min(Math.max(x, 0), 1),
    straight: (x) => Math.min(Math.max(x, 0), 1),
    chamfer: (x) => Math.min(Math.max(x, 0), 1),
    lip: (x) => {
        const convex = Math.pow(Math.max(0, 1 - Math.pow(1 - Math.min(x * 2, 1), 4)), 0.25);
        const concave = 1 - Math.sqrt(Math.max(0, 1 - (1 - x) * (1 - x))) + 0.1;
        const t = 6 * x ** 5 - 15 * x ** 4 + 10 * x ** 3;
        return convex * (1 - t) + concave * t;
    },
};

function calculateRefractionProfile(glassThickness, bezelWidth, heightFn, ior, samples = 128) {
    const eta = 1 / ior;
    function refract(nx, ny) {
        const dot = ny;
        const k = 1 - eta * eta * (1 - dot * dot);
        if (k < 0) return null;
        const sq = Math.sqrt(k);
        return [-(eta * dot + sq) * nx, eta - (eta * dot + sq) * ny];
    }
    const profile = new Float64Array(samples);
    for (let i = 0; i < samples; i++) {
        const x = i / samples;
        const y = heightFn(x);
        const dx = x < 0.999 ? 0.001 : -0.001;
        const y2 = heightFn(x + dx);
        const deriv = (y2 - y) / dx;
        const mag = Math.sqrt(deriv * deriv + 1);
        const ref = refract(-deriv / mag, -1 / mag);
        if (!ref) {
            profile[i] = 0;
            continue;
        }
        profile[i] = ref[0] * ((y * bezelWidth + glassThickness) / ref[1]);
    }
    return profile;
}

function computeDistanceAndNormal(sx, sy, w, h, radius) {
    const hw = w / 2;
    const hh = h / 2;
    const clampedR = Math.min(Math.max(radius, 0), hw, hh);
    const kw = hw - clampedR;
    const kh = hh - clampedR;

    const px = sx - hw;
    const py = sy - hh;
    const ax = Math.abs(px);
    const ay = Math.abs(py);
    const signX = px >= 0 ? 1 : -1;
    const signY = py >= 0 ? 1 : -1;

    const qx = ax - kw;
    const qy = ay - kh;

    let distFromEdge = 0;
    let nx = 0;
    let ny = 0;

    if (qx <= 0 && qy <= 0) {
        const dX = -qx;
        const dY = -qy;
        if (dX < dY) {
            distFromEdge = clampedR + dX;
            nx = signX;
            ny = 0;
        } else {
            distFromEdge = clampedR + dY;
            nx = 0;
            ny = signY;
        }
    } else if (qx > 0 && qy <= 0) {
        distFromEdge = clampedR - qx;
        nx = signX;
        ny = 0;
    } else if (qx <= 0 && qy > 0) {
        distFromEdge = clampedR - qy;
        nx = 0;
        ny = signY;
    } else {
        const cornerDist = Math.sqrt(qx * qx + qy * qy);
        distFromEdge = clampedR - cornerDist;
        if (cornerDist > 0) {
            nx = (signX * qx) / cornerDist;
            ny = (signY * qy) / cornerDist;
        } else {
            nx = signX;
            ny = signY;
        }
    }

    return { distFromEdge, nx, ny };
}

function fastPow24(x) {
    if (x <= 0) return 0;
    const x2 = x * x;
    const x4 = x2 * x2;
    const x8 = x4 * x4;
    return x8 * x8 * x8;
}

function generateLiquidGlassMaps(w, h, radius, bezelWidth, profile, maxDisp, heightFn, angle = Math.PI / 3, strength = 1.1, specOpacity = 0.75, scaleFactor = 0.5) {
    const tw = Math.max(16, Math.ceil(w * scaleFactor));
    const th = Math.max(16, Math.ceil(h * scaleFactor));
    const tr = radius * scaleFactor;
    const tb = bezelWidth * scaleFactor;
    const S = profile.length;

    const dispCanvas = document.createElement("canvas");
    dispCanvas.width = tw;
    dispCanvas.height = th;
    const dispCtx = dispCanvas.getContext("2d");

    const specCanvas = document.createElement("canvas");
    specCanvas.width = tw;
    specCanvas.height = th;
    const specCtx = specCanvas.getContext("2d");

    if (!dispCtx || !specCtx) return { dispUrl: "", specUrl: "" };

    const dispImg = dispCtx.createImageData(tw, th);
    const dU32 = new Uint32Array(dispImg.data.buffer);
    const dU8 = dispImg.data;
    dU32.fill(0xFF008080);

    const specImg = specCtx.createImageData(tw, th);
    const sU32 = new Uint32Array(specImg.data.buffer);
    const sU8 = specImg.data;
    sU32.fill(0);

    const lx = Math.cos(angle);
    const ly = -Math.sin(angle);
    const lz = 0.75;
    const lMag = Math.sqrt(lx * lx + ly * ly + lz * lz);
    const Lx = lx / lMag, Ly = ly / lMag, Lz = lz / lMag;

    const hx = Lx, hy = Ly, hz = Lz + 1.0;
    const hMag = Math.sqrt(hx * hx + hy * hy + hz * hz);
    const Hx = hx / hMag, Hy = hy / hMag, Hz = hz / hMag;

    const safeMargin = tb + 1;
    const innerXMin = safeMargin;
    const innerXMax = tw - safeMargin;
    const innerYMin = safeMargin;
    const innerYMax = th - safeMargin;
    const sampleOffsets = [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]];

    for (let y1 = 0; y1 < th; y1++) {
        const isMiddleY = y1 >= innerYMin && y1 < innerYMax;
        for (let x1 = 0; x1 < tw; x1++) {
            if (isMiddleY && x1 >= innerXMin && x1 < innerXMax) continue;

            const center = computeDistanceAndNormal(x1, y1, tw, th, tr);
            if (center.distFromEdge < -1 || center.distFromEdge > tb) continue;

            let totalDx = 0, totalDy = 0, totalSpec = 0;

            if (center.distFromEdge >= 1.5 && center.distFromEdge <= tb - 1.0) {
                const bi = Math.min(Math.max(((center.distFromEdge / tb) * S) | 0, 0), S - 1);
                const disp = profile[bi] || 0;
                totalDx = (-center.nx * disp) / maxDisp;
                totalDy = (-center.ny * disp) / maxDisp;

                const t = center.distFromEdge / tb;
                const dt = 0.001;
                const yA = heightFn(Math.max(0, t - dt));
                const yB = heightFn(Math.min(1, t + dt));
                const slope = (yB - yA) / (2 * dt);

                const surfNx = center.nx * slope;
                const surfNy = center.ny * slope;
                const nMag = Math.sqrt(surfNx * surfNx + surfNy * surfNy + 1.0);
                const Nx = surfNx / nMag, Ny = surfNy / nMag, Nz = 1.0 / nMag;

                const NdotH = Math.max(0, Nx * Hx + Ny * Hy + Nz * Hz);
                const spec = fastPow24(NdotH) * strength;
                const oneMinusNz = Math.max(0, 1.0 - Nz);
                const fresnel = oneMinusNz * oneMinusNz * Math.sqrt(oneMinusNz) * 0.45;
                totalSpec = Math.min(1.0, spec + fresnel);
            } else {
                let totalWeight = 0;
                for (let s = 0; s < 4; s++) {
                    const sx = x1 + sampleOffsets[s][0];
                    const sy = y1 + sampleOffsets[s][1];
                    const { distFromEdge, nx, ny } = computeDistanceAndNormal(sx, sy, tw, th, tr);
                    if (distFromEdge < -1 || distFromEdge > tb) continue;
                    const op = distFromEdge >= 0 ? 1 : Math.max(0, 1 + distFromEdge);
                    if (op <= 0) continue;

                    const bi = Math.min(Math.max(((distFromEdge / tb) * S) | 0, 0), S - 1);
                    const disp = profile[bi] || 0;
                    totalDx += ((-nx * disp) / maxDisp) * op;
                    totalDy += ((-ny * disp) / maxDisp) * op;

                    const t = Math.min(Math.max(distFromEdge / tb, 0.001), 0.999);
                    const dt = 0.001;
                    const yA = heightFn(Math.max(0, t - dt));
                    const yB = heightFn(Math.min(1, t + dt));
                    const slope = (yB - yA) / (2 * dt);

                    const surfNx = nx * slope;
                    const surfNy = ny * slope;
                    const nMag = Math.sqrt(surfNx * surfNx + surfNy * surfNy + 1.0);
                    const Nx = surfNx / nMag, Ny = surfNy / nMag, Nz = 1.0 / nMag;

                    const NdotH = Math.max(0, Nx * Hx + Ny * Hy + Nz * Hz);
                    const spec = fastPow24(NdotH) * strength;
                    const oneMinusNz = Math.max(0, 1.0 - Nz);
                    const fresnel = oneMinusNz * oneMinusNz * Math.sqrt(oneMinusNz) * 0.45;

                    let edgeHighlight = 0;
                    if (distFromEdge >= -0.5 && distFromEdge <= 2.5) {
                        const edgeT = Math.max(0, 1.0 - Math.max(0, distFromEdge) / 2.5);
                        const topBias = Math.max(0, -ny * 0.5) + 0.5;
                        edgeHighlight = edgeT * Math.sqrt(edgeT) * 0.95 * topBias;
                    }

                    totalSpec += Math.min(1.0, (spec + fresnel + edgeHighlight) * op);
                    totalWeight++;
                }
                if (totalWeight > 0) {
                    totalDx /= 4;
                    totalDy /= 4;
                    totalSpec /= 4;
                }
            }

            const idx = (y1 * tw + x1) * 4;
            dU8[idx] = Math.round(128 + totalDx * 127);
            dU8[idx + 1] = Math.round(128 + totalDy * 127);

            if (totalSpec > 0) {
                const val = Math.min(255, Math.round(totalSpec * specOpacity * 255));
                sU8[idx] = 255;
                sU8[idx + 1] = 255;
                sU8[idx + 2] = 255;
                sU8[idx + 3] = val;
            }
        }
    }

    dispCtx.putImageData(dispImg, 0, 0);
    specCtx.putImageData(specImg, 0, 0);

    return {
        dispUrl: dispCanvas.toDataURL("image/png"),
        specUrl: specCanvas.toDataURL("image/png"),
    };
}

function shouldEnableLiquidGlass() {
    const isReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    const isMobileOrTouch = window.matchMedia?.("(max-width: 768px), (pointer: coarse)")?.matches;
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    return !isReducedMotion && !isMobileOrTouch && !isSafari;
}

let lastGlassW = 0;
let lastGlassH = 0;
let resizeLiquidTimer = null;

function rebuildLiquidGlassFilter() {
    const nav = document.querySelector(".navbar") || document.querySelector("nav");
    const svgDefs = document.getElementById("svg-defs");
    if (!nav || !svgDefs) return;

    if (!shouldEnableLiquidGlass()) {
        document.documentElement.classList.remove("liquid-glass-enabled");
        svgDefs.innerHTML = "";
        lastGlassW = 0;
        lastGlassH = 0;
        return;
    }

    const w = Math.round(nav.offsetWidth);
    const h = Math.round(nav.offsetHeight);
    if (w < 10 || h < 10) return;
    if (w === lastGlassW && h === lastGlassH) return;
    lastGlassW = w;
    lastGlassH = h;

    document.documentElement.classList.add("liquid-glass-enabled");

    const computedStyle = window.getComputedStyle ? window.getComputedStyle(nav) : null;
    const parsedRadius = computedStyle ? parseFloat(computedStyle.borderRadius) : NaN;
    const radius = Number.isFinite(parsedRadius)
        ? Math.min(Math.max(parsedRadius, 0), Math.min(w, h) / 2)
        : Math.min(Math.round(h / 2), 60);

    const surfaceKey = (nav.dataset && nav.dataset.surface) || "convex_squircle";
    const glassThickness = 80;
    const bezelWidth = Math.min(28, Math.min(w, h) / 2 - 1);
    const ior = 2.1;
    const scaleRatio = 1.0;
    const blurAmt = 2.0;
    const saturation = 0.45;
    const specOpacity = 0.75;
    const dispersion = 0.12;

    const heightFn = SURFACE_FNS[surfaceKey] || SURFACE_FNS.convex_squircle;
    const clampedBezel = Math.max(1, Math.min(bezelWidth, Math.min(w, h) / 2 - 1));

    const profile = calculateRefractionProfile(glassThickness, clampedBezel, heightFn, ior, 128);
    const maxDisp = Math.max(...Array.from(profile).map(Math.abs)) || 1;

    const { dispUrl, specUrl } = generateLiquidGlassMaps(
        w, h, radius, clampedBezel, profile, maxDisp, heightFn,
        Math.PI / 3, 1.1, specOpacity, 0.5
    );
    if (!dispUrl || !specUrl) return;

    const scale = maxDisp * scaleRatio;
    const scaleR = (scale * (1.0 - dispersion)).toFixed(2);
    const scaleG = scale.toFixed(2);
    const scaleB = (scale * (1.0 + dispersion)).toFixed(2);

    svgDefs.innerHTML = `
        <filter id="liquid-glass-filter" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
            <feGaussianBlur in="SourceGraphic" stdDeviation="${blurAmt}" result="blurred_source" />
            <feImage href="${dispUrl}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none" result="disp_map" />
            <feColorMatrix in="blurred_source" type="matrix"
                values="1 0 0 0 0
                        0 0 0 0 0
                        0 0 0 0 0
                        0 0 0 1 0"
                result="channel_r" />
            <feColorMatrix in="blurred_source" type="matrix"
                values="0 0 0 0 0
                        0 1 0 0 0
                        0 0 0 0 0
                        0 0 0 1 0"
                result="channel_g" />
            <feColorMatrix in="blurred_source" type="matrix"
                values="0 0 0 0 0
                        0 0 0 0 0
                        0 0 1 0 0
                        0 0 0 1 0"
                result="channel_b" />
            <feDisplacementMap in="channel_r" in2="disp_map"
                scale="${scaleR}" xChannelSelector="R" yChannelSelector="G"
                result="displaced_r" />
            <feDisplacementMap in="channel_g" in2="disp_map"
                scale="${scaleG}" xChannelSelector="R" yChannelSelector="G"
                result="displaced_g" />
            <feDisplacementMap in="channel_b" in2="disp_map"
                scale="${scaleB}" xChannelSelector="R" yChannelSelector="G"
                result="displaced_b" />
            <feComposite in="displaced_r" in2="displaced_g" operator="arithmetic" k2="1" k3="1" result="channel_rg" />
            <feComposite in="displaced_b" in2="channel_rg" operator="arithmetic" k2="1" k3="1" result="displaced_chromatic" />
            <feColorMatrix in="displaced_chromatic" type="saturate" values="${1.0 + saturation}" result="saturated_glass" />
            <feImage href="${specUrl}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none" result="spec_layer" />
            <feBlend in="spec_layer" in2="saturated_glass" mode="screen" />
        </filter>
    `;
}

function scheduleRebuildLiquidGlass() {
    if (resizeLiquidTimer) clearTimeout(resizeLiquidTimer);
    resizeLiquidTimer = setTimeout(() => {
        requestAnimationFrame(rebuildLiquidGlassFilter);
    }, 100);
}

function initLiquidGlass() {
    rebuildLiquidGlassFilter();
    const nav = document.querySelector(".navbar") || document.querySelector("nav");
    if (window.ResizeObserver && nav) {
        new ResizeObserver(scheduleRebuildLiquidGlass).observe(nav);
    } else {
        window.addEventListener("resize", scheduleRebuildLiquidGlass, { passive: true });
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
        requestAnimationFrame(() => requestAnimationFrame(initLiquidGlass));
    });
} else {
    requestAnimationFrame(() => requestAnimationFrame(initLiquidGlass));
}





