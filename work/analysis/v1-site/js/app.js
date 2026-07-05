const header = document.querySelector("[data-header]");
const navToggle = document.querySelector("[data-nav-toggle]");
const navMenu = document.querySelector("[data-nav-menu]");
const previewImage = document.querySelector("[data-preview-image]");
const previewTabs = Array.from(document.querySelectorAll(".preview-tab"));
const revealItems = Array.from(document.querySelectorAll(".reveal"));
const faqItems = Array.from(document.querySelectorAll(".faq-item"));

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

function selectPreview(tab) {
  if (!previewImage || tab.classList.contains("is-active")) return;

  const nextSrc = tab.dataset.previewSrc;
  const nextAlt = tab.dataset.previewAlt || "";

  previewTabs.forEach((item) => {
    const active = item === tab;
    item.classList.toggle("is-active", active);
    item.setAttribute("aria-selected", String(active));
  });

  previewImage.classList.add("is-switching");

  window.setTimeout(() => {
    previewImage.src = nextSrc;
    previewImage.alt = nextAlt;
    previewImage.classList.remove("is-switching");
  }, 180);
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

window.addEventListener("scroll", updateHeader, { passive: true });
navToggle?.addEventListener("click", toggleNav);
navMenu?.addEventListener("click", (event) => {
  if (event.target instanceof HTMLAnchorElement) closeNav();
});

previewTabs.forEach((tab) => {
  tab.addEventListener("click", () => selectPreview(tab));
  tab.addEventListener("keydown", (event) => {
    const currentIndex = previewTabs.indexOf(tab);
    const lastIndex = previewTabs.length - 1;
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
    previewTabs[nextIndex].focus();
    selectPreview(previewTabs[nextIndex]);
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeNav();
});

updateHeader();
setupReveals();
setupFaq();
