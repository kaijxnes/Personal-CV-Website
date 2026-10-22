(function () {
  const root = document.documentElement;
  const toggle = document.getElementById('themeToggle');
  const stored = localStorage.getItem('theme');
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (stored) {
    root.setAttribute('data-theme', stored);
  }

  toggle.addEventListener('click', function () {
    const current = root.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    const next = current === 'light' ? 'dark' : 'light';
    root.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    if (window.__redrawHeroCanvas) {
      window.__redrawHeroCanvas();
    }
  });

  const yearEl = document.getElementById('year');
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }

  const navToggle = document.getElementById('navToggle');
  const nav = document.getElementById('siteNav');

  navToggle.addEventListener('click', function () {
    const isOpen = nav.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });

  nav.addEventListener('click', function (event) {
    if (event.target.tagName === 'A') {
      nav.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
    }
  });

  // Scroll-triggered reveal animations
  const revealEls = document.querySelectorAll('.reveal');
  revealEls.forEach(function (el) {
    const siblings = Array.prototype.filter.call(el.parentElement.children, function (c) {
      return c.classList.contains('reveal');
    });
    const index = siblings.indexOf(el);
    el.style.transitionDelay = (Math.min(index, 6) * 0.08) + 's';
  });

  if (prefersReducedMotion) {
    revealEls.forEach(function (el) {
      el.classList.add('is-visible');
    });
  } else if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
    revealEls.forEach(function (el) {
      revealObserver.observe(el);
    });
  } else {
    revealEls.forEach(function (el) {
      el.classList.add('is-visible');
    });
  }

  // Stat count-up
  function animateCount(el) {
    const target = parseInt(el.getAttribute('data-count'), 10);
    const suffix = el.getAttribute('data-suffix') || '';
    if (prefersReducedMotion || isNaN(target)) {
      el.textContent = target + suffix;
      return;
    }
    const duration = 1200;
    const start = performance.now();
    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(eased * target) + suffix;
      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    }
    requestAnimationFrame(tick);
  }

  const statsRow = document.querySelector('.stats-row');
  if (statsRow) {
    const statNums = statsRow.querySelectorAll('.stat-num[data-count]');
    if ('IntersectionObserver' in window) {
      const statObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            statNums.forEach(animateCount);
            statObserver.unobserve(entry.target);
          }
        });
      }, { threshold: 0.4 });
      statObserver.observe(statsRow);
    } else {
      statNums.forEach(animateCount);
    }
  }

  // Scrollspy nav
  const sections = Array.prototype.slice.call(document.querySelectorAll('main section[id]'));
  const navLinks = document.querySelectorAll('#siteNav a');
  if (sections.length && navLinks.length) {
    let ticking = false;
    function updateActiveNav() {
      const atBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
      let currentId;
      if (atBottom) {
        currentId = sections[sections.length - 1].id;
      } else {
        const probe = window.scrollY + 140;
        currentId = sections[0].id;
        for (let i = 0; i < sections.length; i++) {
          if (sections[i].offsetTop <= probe) {
            currentId = sections[i].id;
          }
        }
      }
      navLinks.forEach(function (link) {
        link.classList.toggle('active', link.getAttribute('href') === '#' + currentId);
      });
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) {
        requestAnimationFrame(updateActiveNav);
        ticking = true;
      }
    }, { passive: true });
    window.addEventListener('resize', function () {
      if (!ticking) {
        requestAnimationFrame(updateActiveNav);
        ticking = true;
      }
    });
    updateActiveNav();
  }

  // Hero network canvas
  const canvas = document.getElementById('heroCanvas');
  if (canvas && canvas.getContext) {
    const ctx = canvas.getContext('2d');
    const hero = canvas.closest('.hero');
    let width = 0;
    let height = 0;
    let dpr = 1;
    let particles = [];
    let animId = null;
    let running = false;
    const mouse = { x: 0, y: 0, active: false };

    function hexToRgba(hex, alpha) {
      const h = hex.replace('#', '').trim();
      const full = h.length === 3 ? h.split('').map(function (c) { return c + c; }).join('') : h;
      const bigint = parseInt(full, 16);
      const r = (bigint >> 16) & 255;
      const g = (bigint >> 8) & 255;
      const b = bigint & 255;
      return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
    }

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = hero.clientWidth;
      height = hero.clientHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.max(20, Math.min(55, Math.round((width * height) / 20000)));
      particles = [];
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.25,
          vy: (Math.random() - 0.5) * 0.25
        });
      }
    }

    function draw() {
      ctx.clearRect(0, 0, width, height);
      const accentRaw = getComputedStyle(root).getPropertyValue('--accent').trim() || '#5eead4';

      if (!prefersReducedMotion) {
        const mouseRadius = 170;
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          p.x += p.vx;
          p.y += p.vy;
          if (p.x < 0 || p.x > width) p.vx *= -1;
          if (p.y < 0 || p.y > height) p.vy *= -1;

          if (mouse.active) {
            const dx = mouse.x - p.x;
            const dy = mouse.y - p.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < mouseRadius && dist > 0.01) {
              const pull = (1 - dist / mouseRadius) * 0.03;
              p.x += dx * pull;
              p.y += dy * pull;
            }
          }
        }
      }

      const maxDist = 140;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i];
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < maxDist) {
            ctx.strokeStyle = hexToRgba(accentRaw, (1 - dist / maxDist) * 0.25);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      ctx.fillStyle = hexToRgba(accentRaw, 0.8);
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }

      if (mouse.active && !prefersReducedMotion) {
        const cursorDist = 170;
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          const dx = p.x - mouse.x;
          const dy = p.y - mouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < cursorDist) {
            ctx.strokeStyle = hexToRgba(accentRaw, (1 - dist / cursorDist) * 0.45);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.stroke();
          }
        }
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba(accentRaw, 0.9);
        ctx.fill();
      }
    }

    function loop() {
      draw();
      if (!prefersReducedMotion && running) {
        animId = requestAnimationFrame(loop);
      }
    }

    function start() {
      if (running || prefersReducedMotion) {
        if (prefersReducedMotion) draw();
        return;
      }
      running = true;
      loop();
    }

    function stop() {
      running = false;
      if (animId) {
        cancelAnimationFrame(animId);
        animId = null;
      }
    }

    resize();
    draw();
    window.__redrawHeroCanvas = draw;

    if (!prefersReducedMotion) {
      hero.addEventListener('pointermove', function (e) {
        const rect = hero.getBoundingClientRect();
        mouse.x = e.clientX - rect.left;
        mouse.y = e.clientY - rect.top;
        mouse.active = true;
      });
      hero.addEventListener('pointerleave', function () {
        mouse.active = false;
      });
    }

    let resizeTimer = null;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        resize();
        draw();
      }, 150);
    });

    if ('IntersectionObserver' in window) {
      const visibilityObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            start();
          } else {
            stop();
          }
        });
      }, { threshold: 0 });
      visibilityObserver.observe(hero);
    } else {
      start();
    }
  }
})();
