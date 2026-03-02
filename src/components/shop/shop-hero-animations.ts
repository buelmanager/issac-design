/**
 * Shop Hero — 4-slide Rolling Hero GSAP animations
 * Handles: split text, entrance, slide rotation (text + video), scroll parallax, magnetic buttons
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let shopHeroInitialized = false;
let activeAbortController: AbortController | null = null;
let slideInterval: ReturnType<typeof setInterval> | null = null;

const SLIDE_COUNT = 4;
const SLIDE_DURATION = 6000; // 6s per slide

export function initShopHero() {
  if (shopHeroInitialized) return;
  shopHeroInitialized = true;

  const hero = document.querySelector('[data-shop-hero]') as HTMLElement;
  if (!hero || prefersReducedMotion) return;

  // Elements
  const bgWrappers = hero.querySelectorAll<HTMLElement>('[data-shop-hero-bg-wrapper]');
  const videos = hero.querySelectorAll<HTMLVideoElement>('[data-shop-hero-video]');
  const textSlides = hero.querySelectorAll<HTMLElement>('[data-hero-slide]');
  const indicators = hero.querySelectorAll<HTMLElement>('[data-hero-indicator]');
  const indicatorsWrap = hero.querySelector('[data-hero-indicators]') as HTMLElement;
  const ctaEl = hero.querySelector('[data-shop-hero-cta]') as HTMLElement;
  const categoriesEl = hero.querySelector('[data-shop-hero-categories]') as HTMLElement;
  const scrollEl = hero.querySelector('[data-shop-hero-scroll]') as HTMLElement;
  const simulatorEl = hero.querySelector('[data-shop-hero-simulator]') as HTMLElement;
  const simCtaEl = hero.querySelector('.shop-hero__sim-cta') as HTMLElement;
  const simDescEl = hero.querySelector('.shop-hero__sim-desc') as HTMLElement;

  // AbortController for event listener cleanup
  const abortController = new AbortController();
  const { signal } = abortController;
  activeAbortController = abortController;

  let currentSlide = 0;

  // Astro 페이지 전환 후 autoplay 속성이 재트리거되지 않으므로 명시적으로 재생
  videos[0]?.play().catch(() => {});

  // =====================
  // INIT: Split text on ALL slides, hide ALL slides
  // =====================
  textSlides.forEach((slide) => {
    const titleTexts = slide.querySelectorAll('[data-split-text]');
    titleTexts.forEach((textEl) => {
      const el = textEl as HTMLElement;
      splitTextToChars(el);
      gsap.set(el, { opacity: 1, y: 0 });
    });
    gsap.set(slide, { opacity: 0, visibility: 'hidden' });
  });

  const firstSlide = textSlides[0];
  if (firstSlide) {
    gsap.set(firstSlide, { opacity: 1, visibility: 'visible' });
    firstSlide.classList.add('is-active');
  }

  const firstChars = firstSlide?.querySelectorAll('.char') || [];

  // =====================
  // INITIAL ENTRANCE TIMELINE
  // =====================
  // Background zoom on first video wrap
  const firstBgWrapper = bgWrappers[0];
  if (firstBgWrapper) {
    gsap.fromTo(firstBgWrapper,
      { scale: 1.15 },
      { scale: 1, duration: 2.0, ease: 'power2.out', delay: 0.3 }
    );
  }

  // Reset first slide children for staggered entrance
  const firstEyebrow = firstSlide?.querySelector('[data-shop-hero-eyebrow]') as HTMLElement;
  const firstDesc = firstSlide?.querySelector('[data-shop-hero-desc]') as HTMLElement;

  if (firstEyebrow) gsap.set(firstEyebrow, { opacity: 0, y: 15 });
  gsap.set(firstChars, { opacity: 0, y: '100%' });
  if (firstDesc) gsap.set(firstDesc, { opacity: 0, y: 20 });
  gsap.set(ctaEl, { opacity: 0, y: 15 });
  if (indicatorsWrap) gsap.set(indicatorsWrap, { opacity: 0, y: 10 });
  if (categoriesEl) gsap.set(categoriesEl, { opacity: 0, y: 15 });
  if (simDescEl) gsap.set(simDescEl, { opacity: 0, y: 10 });
  if (simulatorEl) gsap.set(simulatorEl, { opacity: 0, scale: 0.92, y: 20 });
  if (simCtaEl) gsap.set(simCtaEl, { opacity: 0, y: 10 });

  const tl = gsap.timeline({ delay: 0.3 });

  // Eyebrow
  if (firstEyebrow) {
    tl.to(firstEyebrow, {
      opacity: 1, y: 0,
      duration: 0.4, ease: 'power3.out'
    }, 0);
  }

  // Characters — staggered reveal
  tl.to(firstChars, {
    opacity: 1, y: 0,
    duration: 0.4,
    stagger: { amount: 0.35, from: 'start' },
    ease: 'power4.out',
  }, 0.15);

  // Description
  if (firstDesc) {
    tl.to(firstDesc, {
      opacity: 1, y: 0,
      duration: 0.5, ease: 'power3.out'
    }, '-=0.15');
  }

  // Indicators
  if (indicatorsWrap) {
    tl.to(indicatorsWrap, {
      opacity: 1, y: 0,
      duration: 0.4, ease: 'power3.out'
    }, '-=0.2');
  }

  // CTA
  tl.to(ctaEl, {
    opacity: 1, y: 0,
    duration: 0.5, ease: 'power3.out'
  }, '-=0.15');

  // Simulator desc
  if (simDescEl) {
    tl.to(simDescEl, {
      opacity: 1, y: 0,
      duration: 0.4, ease: 'power3.out'
    }, '-=0.3');
  }

  // Simulator preview (fade-in + scale)
  if (simulatorEl) {
    tl.to(simulatorEl, {
      opacity: 1, scale: 1, y: 0,
      duration: 0.7, ease: 'power3.out'
    }, '-=0.3');
  }

  // Simulator CTA
  if (simCtaEl) {
    tl.to(simCtaEl, {
      opacity: 1, y: 0,
      duration: 0.4, ease: 'power3.out'
    }, '-=0.3');
  }

  // Categories
  if (categoriesEl) {
    tl.to(categoriesEl, {
      opacity: 1, y: 0,
      duration: 0.4, ease: 'power2.out'
    }, '-=0.1');
  }

  // Scroll indicator
  if (scrollEl) {
    tl.to(scrollEl, {
      opacity: 0.5,
      duration: 0.6
    }, '-=0.1');
  }

  // =====================
  // SLIDE ROTATION
  // =====================
  function goToSlide(nextIdx: number) {
    if (nextIdx === currentSlide) return;

    // --- Video transition ---
    bgWrappers.forEach((wrap, i) => {
      if (i === nextIdx) {
        wrap.classList.add('is-active');
        // Start playing the next video
        const video = videos[i];
        if (video) {
          video.preload = 'auto';
          video.play().catch(() => {});
        }
      } else {
        wrap.classList.remove('is-active');
      }
    });

    // --- Text transition (GSAP only, char-by-char entrance) ---
    const prevSlide = textSlides[currentSlide];
    const nextSlideEl = textSlides[nextIdx];

    const revealNextSlide = () => {
      if (!nextSlideEl) return;

      // Reset all children before showing
      const chars = nextSlideEl.querySelectorAll('.char');
      const eyebrow = nextSlideEl.querySelector('[data-shop-hero-eyebrow]') as HTMLElement;
      const desc = nextSlideEl.querySelector('[data-shop-hero-desc]') as HTMLElement;

      gsap.set(chars, { opacity: 0, y: '100%' });
      if (eyebrow) gsap.set(eyebrow, { opacity: 0, y: 15 });
      if (desc) gsap.set(desc, { opacity: 0, y: 20 });

      // Show slide container
      gsap.set(nextSlideEl, { opacity: 1, visibility: 'visible' });
      nextSlideEl.classList.add('is-active');

      // Animate children in sequence
      const tl2 = gsap.timeline();
      if (eyebrow) {
        tl2.to(eyebrow, { opacity: 1, y: 0, duration: 0.4, ease: 'power3.out' }, 0);
      }
      tl2.to(chars, {
        opacity: 1, y: 0,
        duration: 0.4,
        stagger: { amount: 0.35, from: 'start' },
        ease: 'power4.out',
      }, 0.1);
      if (desc) {
        tl2.to(desc, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }, '-=0.15');
      }
    };

    // Step 1: Fade out previous slide completely
    if (prevSlide) {
      gsap.killTweensOf(prevSlide);
      gsap.to(prevSlide, {
        opacity: 0,
        duration: 0.4,
        ease: 'power2.in',
        onComplete: () => {
          gsap.set(prevSlide, { visibility: 'hidden' });
          prevSlide.classList.remove('is-active');
          // Step 2: Only after previous is fully hidden, reveal next
          revealNextSlide();
        }
      });
    } else {
      revealNextSlide();
    }

    // --- Indicator transition ---
    indicators.forEach((ind, i) => {
      const fill = ind.querySelector('.shop-hero__indicator-fill') as HTMLElement;
      if (i === nextIdx) {
        ind.classList.add('is-active');
        // Restart fill animation
        if (fill) {
          fill.style.animation = 'none';
          // Force reflow
          void fill.offsetHeight;
          fill.style.animation = '';
        }
      } else {
        ind.classList.remove('is-active');
        if (fill) {
          fill.style.animation = 'none';
        }
      }
    });

    currentSlide = nextIdx;
  }

  function nextSlide() {
    goToSlide((currentSlide + 1) % SLIDE_COUNT);
  }

  // Start auto-rotation after entrance animation
  tl.call(() => {
    slideInterval = setInterval(nextSlide, SLIDE_DURATION);
  });

  // Indicator click → go to that slide
  indicators.forEach((ind, i) => {
    ind.addEventListener('click', () => {
      if (i === currentSlide) return;
      // Reset timer
      if (slideInterval) clearInterval(slideInterval);
      goToSlide(i);
      slideInterval = setInterval(nextSlide, SLIDE_DURATION);
    }, { signal });
  });

  // =====================
  // MAGNETIC BUTTONS
  // =====================
  const magneticBtns = hero.querySelectorAll('[data-magnetic]');
  magneticBtns.forEach((btn) => {
    const button = btn as HTMLElement;
    button.addEventListener('mousemove', (e: MouseEvent) => {
      const rect = button.getBoundingClientRect();
      gsap.to(button, {
        x: (e.clientX - rect.left - rect.width / 2) * 0.2,
        y: (e.clientY - rect.top - rect.height / 2) * 0.2,
        duration: 0.3, ease: 'power2.out',
      });
    }, { signal });
    button.addEventListener('mouseleave', () => {
      gsap.to(button, { x: 0, y: 0, duration: 0.5, ease: 'elastic.out(1, 0.5)' });
    }, { signal });
  });

  // =====================
  // SCROLL PARALLAX
  // =====================
  // Parallax the active bg wrapper
  bgWrappers.forEach((wrap) => {
    gsap.to(wrap, {
      yPercent: 25,
      ease: 'none',
      scrollTrigger: {
        trigger: hero,
        start: 'top top',
        end: 'bottom top',
        scrub: 1,
      }
    });
  });


  // =====================
  // SCROLL INDICATOR CLICK
  // =====================
  function scrollToProducts() {
    const productsSection = document.querySelector('#products');
    if (productsSection) productsSection.scrollIntoView({ behavior: 'smooth' });
  }

  scrollEl?.addEventListener('click', scrollToProducts, { signal });
  scrollEl?.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      scrollToProducts();
    }
  }, { signal });
}

// =====================
// HELPERS
// =====================
function splitTextToChars(el: HTMLElement) {
  const text = el.textContent || '';
  el.innerHTML = '';

  text.split('').forEach((char) => {
    const span = document.createElement('span');
    if (char === ' ') {
      span.className = 'char char-space';
      span.innerHTML = '&nbsp;';
    } else {
      span.className = 'char';
      span.textContent = char;
    }
    el.appendChild(span);
  });
}

export function cleanupShopHero() {
  shopHeroInitialized = false;

  if (slideInterval) {
    clearInterval(slideInterval);
    slideInterval = null;
  }

  const hero = document.querySelector('[data-shop-hero]') as HTMLElement;
  if (!hero) return;

  if (activeAbortController) {
    activeAbortController.abort();
    activeAbortController = null;
  }

  ScrollTrigger.getAll().forEach(trigger => {
    const triggerEl = trigger.vars?.trigger;
    if (triggerEl && hero.contains(triggerEl as Node)) {
      trigger.kill();
    } else if (triggerEl === hero) {
      trigger.kill();
    }
  });

  const heroElements = hero.querySelectorAll('*');
  heroElements.forEach(el => gsap.killTweensOf(el));
  gsap.killTweensOf(hero);
}
