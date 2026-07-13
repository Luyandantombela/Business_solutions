(() => {
  "use strict";

  document.getElementById("year").textContent = new Date().getFullYear();

  /* ------------------------------------------------------------------ */
  /* Sticky nav + scroll progress + mobile drawer                        */
  /* ------------------------------------------------------------------ */
  const nav = document.getElementById("siteNav");
  const progress = document.getElementById("scrollProgress");

  function onScroll() {
    const scrolled = window.scrollY;
    nav.classList.toggle("is-scrolled", scrolled > 8);

    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const pct = docHeight > 0 ? (scrolled / docHeight) * 100 : 0;
    progress.style.width = pct + "%";
  }
  document.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  const navToggle = document.getElementById("navToggle");
  const navDrawer = document.getElementById("navDrawer");
  navToggle.addEventListener("click", () => {
    const open = navDrawer.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(open));
  });
  navDrawer.querySelectorAll("a").forEach((a) =>
    a.addEventListener("click", () => {
      navDrawer.classList.remove("is-open");
      navToggle.setAttribute("aria-expanded", "false");
    })
  );

  /* ------------------------------------------------------------------ */
  /* Reveal-on-scroll animation                                          */
  /* ------------------------------------------------------------------ */
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );
  function observeReveals(root = document) {
    root.querySelectorAll(".reveal").forEach((el) => revealObserver.observe(el));
  }
  observeReveals();

  /* ------------------------------------------------------------------ */
  /* Solutions: load data, render, search, filter                        */
  /* ------------------------------------------------------------------ */
  const grid = document.getElementById("solutionsGrid");
  const chipsWrap = document.getElementById("filterChips");
  const searchInput = document.getElementById("solutionSearch");
  const noResults = document.getElementById("noResults");

  let allSolutions = [];
  let activeCategory = "All";

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function videoThumbFallbackSvg() {
    return `<div class="thumb-fallback" aria-hidden="true">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1.5">
        <rect x="3" y="5" width="18" height="14" rx="2"/><path d="M8 5v14M16 5v14M3 9h5M3 15h5M16 9h5M16 15h5"/>
      </svg>
    </div>`;
  }

  function buildCard(solution) {
    const card = document.createElement("article");
    card.className = "solution-card reveal";
    card.dataset.category = solution.category;
    card.dataset.search = (solution.title + " " + solution.description + " " + solution.category).toLowerCase();

    const media = document.createElement("div");
    media.className = "solution-media";
    media.setAttribute("role", "button");
    media.setAttribute("tabindex", "0");
    media.setAttribute("aria-label", "Play preview video for " + solution.title);

    if (solution.thumbnail) {
      media.innerHTML = `<img class="thumb" src="${escapeHtml(solution.thumbnail)}" alt="${escapeHtml(solution.title)} preview" loading="lazy" />`;
    } else {
      media.innerHTML = videoThumbFallbackSvg();
    }
    if (solution.video && solution.video.url) {
      const playBtn = document.createElement("div");
      playBtn.className = "play-btn";
      playBtn.setAttribute("aria-hidden", "true");
      playBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
      media.appendChild(playBtn);

      const playVideo = () => embedVideo(media, solution.video);
      media.addEventListener("click", playVideo);
      media.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          playVideo();
        }
      });
    }

    const body = document.createElement("div");
    body.className = "solution-body";
    body.innerHTML = `
      <span class="solution-category">${escapeHtml(solution.category)}</span>
      <h3>${escapeHtml(solution.title)}</h3>
      <p>${escapeHtml(solution.description)}</p>
      <div class="solution-tech">
        ${(solution.technologies || []).map((t) => `<span>${escapeHtml(t)}</span>`).join("")}
      </div>
    `;

    card.appendChild(media);
    card.appendChild(body);
    return card;
  }

  function embedVideo(mediaEl, video) {
    const url = video.url;
    let inner = "";
    if (video.type === "youtube") {
      const id = extractYouTubeId(url);
      inner = `<iframe src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0" title="Video preview" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe>`;
    } else if (video.type === "vimeo") {
      const id = extractVimeoId(url);
      inner = `<iframe src="https://player.vimeo.com/video/${id}?autoplay=1" title="Video preview" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen loading="lazy"></iframe>`;
    } else if (video.type === "mp4") {
      inner = `<video src="${escapeHtml(url)}" controls autoplay playsinline></video>`;
    } else {
      return;
    }
    mediaEl.innerHTML = inner;
  }

  function extractYouTubeId(url) {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{6,})/
    ];
    for (const p of patterns) {
      const m = url.match(p);
      if (m) return m[1];
    }
    return "";
  }
  function extractVimeoId(url) {
    const m = url.match(/vimeo\.com\/(?:.*\/)?(\d+)/);
    return m ? m[1] : "";
  }

  function renderChips(categories) {
    chipsWrap.innerHTML = "";
    const cats = ["All", ...categories];
    cats.forEach((cat) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip" + (cat === activeCategory ? " is-active" : "");
      chip.textContent = cat;
      chip.addEventListener("click", () => {
        activeCategory = cat;
        chipsWrap.querySelectorAll(".chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        applyFilters();
      });
      chipsWrap.appendChild(chip);
    });
  }

  function applyFilters() {
    const query = searchInput.value.trim().toLowerCase();
    let visibleCount = 0;
    grid.querySelectorAll(".solution-card").forEach((card) => {
      const matchesCategory = activeCategory === "All" || card.dataset.category === activeCategory;
      const matchesSearch = !query || card.dataset.search.includes(query);
      const visible = matchesCategory && matchesSearch;
      card.style.display = visible ? "" : "none";
      if (visible) visibleCount++;
    });
    noResults.classList.toggle("is-visible", visibleCount === 0);
  }

  searchInput.addEventListener("input", applyFilters);

  function renderSolutions(solutions) {
    allSolutions = [...solutions].sort((a, b) => (a.order || 0) - (b.order || 0));
    grid.innerHTML = "";
    allSolutions.forEach((s) => grid.appendChild(buildCard(s)));
    observeReveals(grid);

    const categories = [...new Set(allSolutions.map((s) => s.category))];
    renderChips(categories);
    applyFilters();
  }

  async function loadSolutions() {
    try {
      // Admin edits are staged in localStorage before publishing; prefer them if present.
      const draft = localStorage.getItem("solutionsDraft");
      if (draft) {
        renderSolutions(JSON.parse(draft).solutions || []);
        return;
      }
      const res = await fetch("data/solutions.json", { cache: "no-store" });
      const data = await res.json();
      renderSolutions(data.solutions || []);
    } catch (err) {
      grid.innerHTML = `<p style="color:var(--text-secondary)">Solutions could not be loaded right now.</p>`;
      console.error("Failed to load solutions.json", err);
    }
  }
  loadSolutions();

  /* ------------------------------------------------------------------ */
  /* Contact form (static-site friendly: opens a pre-filled email)       */
  /* ------------------------------------------------------------------ */
  const form = document.getElementById("contactForm");
  const formStatus = document.getElementById("formStatus");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = form.name.value.trim();
    const email = form.email.value.trim();
    const message = form.message.value.trim();
    if (!name || !email || !message) {
      formStatus.textContent = "Please fill in every field.";
      formStatus.className = "form-status error";
      return;
    }
    const subject = encodeURIComponent(`New project inquiry from ${name}`);
    const body = encodeURIComponent(`${message}\n\n— ${name} (${email})`);
    window.location.href = `mailto:you@example.com?subject=${subject}&body=${body}`;
    formStatus.textContent = "Opening your email client…";
    formStatus.className = "form-status success";
  });

  /* ------------------------------------------------------------------ */
  /* Hidden admin access: /admin URL is always reachable directly.       */
  /* Secret shortcut here is an extra, undocumented entry point.         */
  /* Sequence: press "a" then "d" then "m" within 1.2s of each other.    */
  /* ------------------------------------------------------------------ */
  let keySequence = [];
  let lastKeyTime = 0;
  window.addEventListener("keydown", (e) => {
    const now = Date.now();
    if (now - lastKeyTime > 1200) keySequence = [];
    lastKeyTime = now;
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "a") {
      window.location.href = "admin/";
      return;
    }
    if (document.activeElement && ["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) return;
    keySequence.push(e.key.toLowerCase());
    if (keySequence.length > 3) keySequence.shift();
    if (keySequence.join("") === "adm") {
      window.location.href = "admin/";
    }
  });
})();
