const header = document.querySelector("[data-header]");
const navToggle = document.querySelector("[data-nav-toggle]");
const navMenu = document.querySelector("[data-nav-menu]");
const revealItems = Array.from(document.querySelectorAll(".reveal"));
const faqItems = Array.from(document.querySelectorAll(".faq-item"));
const showcaseImage = document.querySelector("[data-showcase-image]");
const showcaseTabs = Array.from(document.querySelectorAll(".showcase-tab"));
const showcaseKicker = document.querySelector("#showcaseKicker");
const showcaseTitle = document.querySelector("#showcaseTitle");
const showcaseBody = document.querySelector("#showcaseBody");
const countItems = Array.from(document.querySelectorAll("[data-count]"));
const tiltCards = Array.from(document.querySelectorAll("[data-tilt-card]"));
const videoEmbeds = Array.from(document.querySelectorAll("[data-video-embed]"));
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function updateHeader() {
  header?.classList.toggle("is-scrolled", window.scrollY > 12);
}

function closeNav() {
  document.body.classList.remove("nav-open");
  navMenu?.classList.remove("is-open");
  navToggle?.setAttribute("aria-expanded", "false");
  navToggle?.setAttribute("aria-label", "Open navigation menu");
}

function toggleNav() {
  const isOpen = navToggle?.getAttribute("aria-expanded") === "true";
  document.body.classList.toggle("nav-open", !isOpen);
  navMenu?.classList.toggle("is-open", !isOpen);
  navToggle?.setAttribute("aria-expanded", String(!isOpen));
  navToggle?.setAttribute("aria-label", isOpen ? "Open navigation menu" : "Close navigation menu");
}

function selectShowcase(tab) {
  if (!showcaseImage || tab.classList.contains("is-active")) return;

  showcaseTabs.forEach((item) => {
    const active = item === tab;
    item.classList.toggle("is-active", active);
    item.setAttribute("aria-selected", String(active));
  });

  showcaseImage.classList.add("is-switching");

  window.setTimeout(() => {
    showcaseImage.src = tab.dataset.src || "";
    showcaseImage.alt = tab.dataset.alt || "";
    if (showcaseKicker) showcaseKicker.textContent = tab.dataset.kicker || "";
    if (showcaseTitle) showcaseTitle.textContent = tab.dataset.title || "";
    if (showcaseBody) showcaseBody.textContent = tab.dataset.body || "";
    showcaseImage.classList.remove("is-switching");
  }, 180);
}

function setupShowcaseTabs() {
  showcaseTabs.forEach((tab) => {
    tab.addEventListener("click", () => selectShowcase(tab));
    tab.addEventListener("keydown", (event) => {
      const currentIndex = showcaseTabs.indexOf(tab);
      const lastIndex = showcaseTabs.length - 1;
      let nextIndex = currentIndex;

      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        nextIndex = currentIndex === lastIndex ? 0 : currentIndex + 1;
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        nextIndex = currentIndex === 0 ? lastIndex : currentIndex - 1;
      } else if (event.key === "Home") {
        nextIndex = 0;
      } else if (event.key === "End") {
        nextIndex = lastIndex;
      } else {
        return;
      }

      event.preventDefault();
      showcaseTabs[nextIndex].focus();
      selectShowcase(showcaseTabs[nextIndex]);
    });
  });
}

function setupFaq() {
  faqItems.forEach((item) => {
    const button = item.querySelector("button");
    const answer = item.querySelector(".faq-answer");
    if (!button || !answer) return;

    button.addEventListener("click", () => {
      const open = item.classList.toggle("is-open");
      button.setAttribute("aria-expanded", String(open));
      answer.style.maxHeight = open ? `${answer.scrollHeight}px` : "0px";
    });
  });
}

function setupVideoEmbeds() {
  videoEmbeds.forEach((frame) => {
    const trigger = frame.querySelector("[data-video-src]");
    if (!(trigger instanceof HTMLButtonElement)) return;

    trigger.addEventListener("click", () => {
      const iframe = document.createElement("iframe");
      iframe.src = trigger.dataset.videoSrc || "";
      iframe.title = trigger.getAttribute("aria-label") || "Course Focus Pro demo video";
      iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
      iframe.allowFullscreen = true;

      frame.replaceChildren(iframe);
      iframe.focus();
    });
  });
}

function setupReveals() {
  if (!("IntersectionObserver" in window)) {
    revealItems.forEach((item) => item.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.14, rootMargin: "0px 0px -8% 0px" }
  );

  revealItems.forEach((item) => observer.observe(item));
}

function animateCount(element) {
  const target = Number(element.dataset.count || 0);
  const duration = 1200;
  const start = performance.now();

  function tick(now) {
    const progress = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    element.textContent = String(Math.round(target * eased));
    if (progress < 1) requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

function setupCounters() {
  if (!countItems.length) return;
  if (!("IntersectionObserver" in window) || reduceMotion.matches) {
    countItems.forEach((item) => {
      item.textContent = item.dataset.count || "0";
    });
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        animateCount(entry.target);
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.5 }
  );

  countItems.forEach((item) => observer.observe(item));
}

function setupTilt() {
  const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (!canHover || reduceMotion.matches) return;

  tiltCards.forEach((card) => {
    card.addEventListener("mousemove", (event) => {
      const rect = card.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      card.style.setProperty("--tilt-x", `${(-y * 4).toFixed(2)}deg`);
      card.style.setProperty("--tilt-y", `${(x * 5).toFixed(2)}deg`);
    });

    card.addEventListener("mouseleave", () => {
      card.style.setProperty("--tilt-x", "0deg");
      card.style.setProperty("--tilt-y", "0deg");
    });
  });
}

window.addEventListener("scroll", updateHeader, { passive: true });
window.addEventListener("resize", () => {
  if (window.innerWidth > 900) closeNav();
});

navToggle?.addEventListener("click", toggleNav);
navMenu?.addEventListener("click", (event) => {
  if (event.target instanceof HTMLAnchorElement) closeNav();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeNav();
});

updateHeader();
setupReveals();
setupFaq();
setupShowcaseTabs();
setupVideoEmbeds();
setupCounters();
setupTilt();
