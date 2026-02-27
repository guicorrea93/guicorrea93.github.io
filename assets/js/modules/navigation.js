// ===============================
// NAVEGACAO, TOPBAR, ANO, SCROLL, INTERACOES
// ===============================

import { debounce } from './utils.js';
import { announceToScreenReader } from './utils.js';

// ===============================
// TOPBAR E ANO
// ===============================

export function setYear() {
  const yearElement = document.getElementById('year');
  if (yearElement) {
    yearElement.textContent = new Date().getFullYear();
  }
}

export function getCurrentPage() {
  const path = location.pathname.split('/').pop() || 'index.html';
  return path.toLowerCase();
}

function isActivePage(fileName) {
  const currentPage = getCurrentPage();
  return currentPage === fileName ? 'active' : '';
}

export function setTopbar() {
  const topbarElement = document.getElementById('topbar');
  if (!topbarElement) return;

  const currentPage = getCurrentPage();

  // MENU: so existe completo no index.html
  const menuHTML = (currentPage === 'index.html')
    ? `
      <div class="menu">
        <a href="index.html#inicio" aria-label="Ir para o in\u00edcio">In\u00edcio</a>

        <a href="index.html#sobre" aria-label="Ir para se\u00e7\u00e3o sobre">
          Sobre
        </a>

        <a href="index.html#projetos" aria-label="Ir para se\u00e7\u00e3o de projetos">
          Projetos
        </a>

        <a href="index.html#diplomas" aria-label="Ir para se\u00e7\u00e3o de diplomas">
          Diplomas
        </a>

        <a href="index.html#certificados" aria-label="Ir para se\u00e7\u00e3o de certificados">
          Certificados
        </a>

        <a href="index.html#estudos" aria-label="Ir para se\u00e7\u00e3o de estudos">
          Estudos
        </a>

        <a href="index.html#livros" aria-label="Ir para se\u00e7\u00e3o de livros">
          Livros
        </a>
      </div>
    `
    : `
      <div class="menu">
        <a href="index.html"
           class="active back-home"
           aria-label="Voltar para a p\u00e1gina inicial">
          \u2190 Voltar ao in\u00edcio
        </a>
      </div>
    `;

  const navHTML = `
    <nav class="nav" role="navigation" aria-label="Navega\u00e7\u00e3o principal">
      <div class="brand">
        <img
          src="assets/img/avatares/avatar.webp"
          alt="Foto de perfil de Guilherme Corr\u00eaa"
          class="avatar"
          loading="lazy"
        />

        <span>
          Guilherme <b>Corr\u00eaa</b>

          <a class="btn small primary"
             href="https://www.linkedin.com/in/guilherme-corr%C3%AAa-893781169/"
             target="_blank"
             rel="noopener">
            LinkedIn
          </a>

          <a class="btn small ghost"
             href="https://github.com/guicorrea93"
             target="_blank"
             rel="noopener">
            GitHub
          </a>

          <a class="btn small ghost"
             href="mailto:guilherme93_correa@hotmail.com">
            Email
          </a>
        </span>
      </div>

      ${menuHTML}
    </nav>
  `;

  topbarElement.innerHTML = navHTML;
}

// ===============================
// SMOOTH SCROLL COM FALLBACK
// ===============================

export function initSmoothScroll() {
  // Verifica se o navegador suporta scroll-behavior
  if (!('scrollBehavior' in document.documentElement.style)) {
    // Polyfill para navegadores antigos
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function (e) {
        const targetId = this.getAttribute('href').substring(1);
        const targetElement = document.getElementById(targetId);

        if (targetElement) {
          e.preventDefault();
          targetElement.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        }
      });
    });
  }
}

// ===============================
// SCROLLSPY (MENU ATIVO POR SCROLL)
// ===============================

export function initScrollSpy() {
  // So no index
  if (getCurrentPage() !== 'index.html') return;

  const links = Array.from(document.querySelectorAll('.menu a[href*="#"]'));
  if (!links.length) return;

  // Pega IDs das secoes a partir do href (#inicio, #sobre, etc.)
  const ids = links
    .map(a => (a.hash || '').replace('#', ''))
    .filter(Boolean);

  const sections = ids
    .map(id => document.getElementById(id))
    .filter(Boolean);

  if (!sections.length) return;

  const setActive = (id) => {
    links.forEach(a => {
      const isThis = a.hash === `#${id}`;
      a.classList.toggle('active', isThis);
      if (isThis) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  };

  // Marca inicial
  setActive((location.hash || '#inicio').replace('#', ''));

  let ticking = false;

  const onScroll = () => {
    if (ticking) return;
    ticking = true;

    requestAnimationFrame(() => {
      ticking = false;

      // Linha de referencia: um pouco abaixo do topo (por causa da navbar fixa)
      const refY = window.scrollY + 140;

      let currentId = sections[0].id;

      for (const sec of sections) {
        if (sec.offsetTop <= refY) currentId = sec.id;
      }

      setActive(currentId);
    });
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);

  // Se mudar hash (ex: link direto)
  window.addEventListener('hashchange', () => {
    setActive((location.hash || '#inicio').replace('#', ''));
  });

  // Roda uma vez pra ajustar se voce ja abriu no meio da pagina
  onScroll();
}

// ===============================
// PERFORMANCE: LAZY LOADING
// ===============================

export function initLazyLoading() {
  if ('loading' in HTMLImageElement.prototype) {
    // O navegador suporta lazy loading nativo
    const images = document.querySelectorAll('img[loading="lazy"]');
    images.forEach(img => {
      img.src = img.dataset.src || img.src;
    });
  } else {
    // Fallback para navegadores antigos
    const images = document.querySelectorAll('img[loading="lazy"]');
    const imageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.src = img.dataset.src || img.src;
          img.classList.remove('lazy');
          imageObserver.unobserve(img);
        }
      });
    });

    images.forEach(img => imageObserver.observe(img));
  }
}

export function updateHeroScale() {
  const hero = document.querySelector('.hero');
  if (!hero) return;

  const canvas = hero.querySelector('.hero-canvas');
  if (!canvas) return;

  // So aplica no desktop/tablet grande (onde voce quer o "poster fixo")
  if (window.innerWidth <= 900) {
    hero.style.removeProperty('--hero-scale');
    return;
  }

  const w = hero.clientWidth;
  const h = hero.clientHeight;

  const scale = Math.min(w / 1536, h / 730);

  hero.style.setProperty('--hero-scale', scale);
}

// ===============================
// TIMELINE TOGGLE (VER MAIS)
// ===============================

export function initTimelineToggle() {
  const timeline = document.getElementById('timelineContent');
  const toggleBtn = document.getElementById('toggleTimeline');

  if (!timeline || !toggleBtn) return;

  const toggleText = toggleBtn.querySelector('.toggle-text');

  toggleBtn.addEventListener('click', function() {
    const isExpanded = this.getAttribute('aria-expanded') === 'true';

    if (isExpanded) {
      // Colapsar
      timeline.classList.remove('expanded');
      this.setAttribute('aria-expanded', 'false');
      toggleText.textContent = 'Ver mais';

      // Scroll suave para o topo da timeline
      setTimeout(() => {
        timeline.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);

    } else {
      // Expandir
      timeline.classList.add('expanded');
      this.setAttribute('aria-expanded', 'true');
      toggleText.textContent = 'Ver menos';
    }

    announceToScreenReader(
      isExpanded ? 'Se\u00e7\u00e3o recolhida' : 'Se\u00e7\u00e3o expandida'
    );
  });

  // Adiciona suporte para teclado
  toggleBtn.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.click();
    }
  });
}

// ===============================
// COMO TRABALHO TOGGLE (VER MAIS)
// ===============================

export function initWorkProcessToggle() {
  const content = document.getElementById('workProcessContent');
  const toggleBtn = document.getElementById('toggleWorkProcess');

  if (!content || !toggleBtn) return;

  // evita duplicar listener (porque teu initComoTrabalho roda 2x)
  if (toggleBtn.dataset.bound === '1') return;
  toggleBtn.dataset.bound = '1';

  const toggleText = toggleBtn.querySelector('.toggle-text');

  const setState = (expanded) => {
    if (expanded) {
      content.classList.add('expanded');
      toggleBtn.setAttribute('aria-expanded', 'true');
      toggleText.textContent = 'Ver menos';
    } else {
      content.classList.remove('expanded');
      toggleBtn.setAttribute('aria-expanded', 'false');
      toggleText.textContent = 'Ver mais';

      setTimeout(() => {
        content.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  };

  toggleBtn.addEventListener('click', () => {
    const isExpanded = toggleBtn.getAttribute('aria-expanded') === 'true';
    setState(!isExpanded);
  });

  toggleBtn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const isExpanded = toggleBtn.getAttribute('aria-expanded') === 'true';
      setState(!isExpanded);
    }
  });
}

// ===============================
// COMO TRABALHO (index) - escopado
// ===============================

export function initComoTrabalho() {
  const root = document.getElementById('como-trabalho');
  if (!root) return;

  // 1) Accordion dos steps (abre 1 por vez)
  const steps = Array.from(root.querySelectorAll('[data-work-step]'));

  const closeAllExcept = (keepEl) => {
    steps.forEach(el => {
      if (el === keepEl) return;
      el.classList.remove('is-active');
      el.setAttribute('aria-expanded', 'false');

      const details = el.querySelector('.work-step-details');
      if (details) details.hidden = true;
    });
  };

  const toggleStep = (el) => {
    const details = el.querySelector('.work-step-details');
    const isOpen = el.classList.contains('is-active');

    closeAllExcept(el);

    if (isOpen) {
      el.classList.remove('is-active');
      el.setAttribute('aria-expanded', 'false');
      if (details) details.hidden = true;
      return;
    }

    el.classList.add('is-active');
    el.setAttribute('aria-expanded', 'true');
    if (details) details.hidden = false;
  };

  steps.forEach(el => {
    el.addEventListener('click', () => toggleStep(el));
    el.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        toggleStep(el);
      }
    });
  });

  // 2) Animacao de entrada (so dentro da secao)
  const animTargets = root.querySelectorAll('[data-work-animate]');
  animTargets.forEach(el => el.classList.add('work-anim'));

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      io.unobserve(entry.target);
    });
  }, { threshold: 0.12 });

  animTargets.forEach(el => io.observe(el));
}

// ===============================
// SEARCH CLEAR BUTTON (generico)
// ===============================

export function initSearchClear() {
  const inputs = ['certSearch', 'bookSearch'];
  inputs.forEach(id => {
    const searchInput = document.getElementById(id);
    const clearBtn = document.getElementById('searchClear');
    if (!searchInput || !clearBtn) return;

    searchInput.addEventListener('input', () => {
      clearBtn.style.display = searchInput.value ? 'flex' : 'none';
    });

    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      searchInput.dispatchEvent(new Event('input'));
      searchInput.focus();
    });
  });
}
