document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute("href"));
        if (target)
            target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
});

async function loadTeams() {
    const container = document.getElementById("team-sections");
    if (!container) return;

    try {
        const res = await fetch("data/team.json", { cache: "no-store" });
        if (!res.ok)
            throw new Error(`Failed to load team.json (${res.status})`);

        const data = await res.json();
        const teams = Array.isArray(data.teams) ? data.teams : [];

        container.innerHTML = teams.map(renderTeamSection).join("");
        setupTeamReveal();
    } catch (err) {
        console.error(err);
    }
}

function renderTeamSection(team) {
    const members = (team.members || []).map(renderMemberCard).join("");

    return `
    <div class="team-section" id="team-${escapeHtml(team.key || "")}">
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

function renderMemberCard(m) {
    return `
    <div class="team-member">
      <div class="team-info">
        <h4 class="team-name">${escapeHtml(m.name || "")}</h4>
        ${m.role ? `<div class="team-role"><span class="role-status-dot"></span>${escapeHtml(m.role)}</div>` : ""}
        ${m.description ? `<p class="team-bio">${escapeHtml(m.description)}</p>` : ""}
      </div>
    </div>
  `;
}

function setupTeamReveal() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: "0px 0px -100px 0px",
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = "1";
                entry.target.style.transform = "translateY(0)";
            }
        });
    }, observerOptions);

    document.querySelectorAll(".team-member").forEach((el) => {
        el.style.opacity = "0";
        el.style.transform = "translateY(20px)";
        el.style.transition = "all 0.6s ease-out";
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

    const SPAWN_EVERY_MS = 800;
    const MAX_PETALS = 15;

    function rand(min, max) {
        return Math.random() * (max - min) + min;
    }

    function createPetal() {
        if (container.childElementCount >= MAX_PETALS) return;

        const petal = document.createElement("div");
        petal.className = "petal";

        const size = rand(18, 44);
        const fall = rand(6.5, 13.5);
        const delay = rand(0, 1.8);
        const sway = rand(18, 90);
        const swayDur = rand(2.2, 5.0);
        const spin = rand(2.0, 6.0);
        const opacity = rand(0.35, 0.9);
        const x = rand(-5, 105);
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

        const swayWrap = document.createElement("div");
        swayWrap.className = "petal-sway";

        const img = document.createElement("img");
        img.className = "petal-img";
        img.src = PETAL_SRC;
        img.alt = "";
        img.loading = "lazy";

        swayWrap.appendChild(img);
        petal.appendChild(swayWrap);
        container.appendChild(petal);

        const lifetime = (fall + delay) * 1000 + 200;
        setTimeout(() => petal.remove(), lifetime);
    }

    for (let i = 0; i < 4; i++) createPetal();

    setInterval(createPetal, SPAWN_EVERY_MS);
})();

(function lockHeroHeightOnLoad() {
    const hero = document.querySelector(".hero");
    if (!hero) return;

    const initialVH = window.innerHeight;

    hero.style.setProperty("--heroH", `${initialVH}px`);
})();

loadTeams();

document.addEventListener("mousemove", (e) => {
    const card = e.target.closest(".team-member");
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const rotateY = ((x / rect.width) - 0.5) * 12;
    const rotateX = (0.5 - (y / rect.height)) * 12;
    
    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-8px)`;
    card.style.setProperty("--mouse-x", `${x}px`);
    card.style.setProperty("--mouse-y", `${y}px`);
});

document.addEventListener("mouseout", (e) => {
    const card = e.target.closest(".team-member");
    if (!card) return;
    if (!e.relatedTarget || !card.contains(e.relatedTarget)) {
        card.style.transform = "perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0px)";
    }
});
