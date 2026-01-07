// ===============================
// CONFIGURAÇÕES E UTILITÁRIOS
// ===============================

const CONFIG = {
  projectsPath: 'data/projetos.json',
  certsPath: 'data/certificados.json',
  cacheTime: 60000, // 1 minuto
  maxRetries: 3
};

// Debounce para otimizar eventos
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Escape HTML para segurança
function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ===============================
// TOPBAR E ANO
// ===============================

function setYear() {
  const yearElement = document.getElementById('year');
  if (yearElement) {
    yearElement.textContent = new Date().getFullYear();
  }
}

function getCurrentPage() {
  const path = location.pathname.split('/').pop() || 'index.html';
  return path.toLowerCase();
}

function isActivePage(fileName) {
  const currentPage = getCurrentPage();
  return currentPage === fileName ? 'active' : '';
}

function setTopbar() {
  const topbarElement = document.getElementById('topbar');
  if (!topbarElement) return;

  const currentPage = getCurrentPage(); // ex: index.html, certificados.html, projetos.html

  // MENU: só existe completo no index.html
  const menuHTML = (currentPage === 'index.html')
    ? `
      <div class="menu">
        <a href="index.html#inicio" aria-label="Ir para o início">Início</a>

        <a href="index.html#sobre" aria-label="Ir para seção sobre">
          Sobre
        </a>

        <a href="index.html#projetos" aria-label="Ir para seção de projetos">
          Projetos
        </a>

        <a href="index.html#certificados" aria-label="Ir para seção de certificados">
          Certificados
        </a>
      </div>
    `
    : `
      <div class="menu">
        <a href="index.html"
           class="active back-home"
           aria-label="Voltar para a página inicial">
          ← Voltar ao início
        </a>
      </div>
    `;

  const navHTML = `
    <nav class="nav" role="navigation" aria-label="Navegação principal">
      <div class="brand">
        <img
          src="assets/img/avatar.jpeg"
          alt="Foto de perfil de Guilherme Corrêa"
          class="avatar"
          loading="lazy"
        />

        <span>
          Guilherme <b>Corrêa</b>

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

function initSmoothScroll() {
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
function initScrollSpy() {
  // Só no index
  if (getCurrentPage() !== 'index.html') return;

  const links = Array.from(document.querySelectorAll('.menu a[href*="#"]'));
  if (!links.length) return;

  // Pega IDs das seções a partir do href (#inicio, #sobre, etc.)
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

      // Linha de referência: um pouco abaixo do topo (por causa da navbar fixa)
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

  // Roda uma vez pra ajustar se você já abriu no meio da página
  onScroll();
}

// ===============================
// LOADING STATE
// ===============================

function showLoading(element, message = 'Carregando...') {
  if (!element) return;
  
  element.innerHTML = `
    <div class="card" style="text-align: center; padding: 2rem;">
      <div class="card-title" style="color: var(--text-2);">
        ${escapeHTML(message)}
      </div>
      <div style="margin-top: 1rem;">
        <div style="display: inline-block; width: 2rem; height: 2rem; border: 3px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
      </div>
    </div>
  `;
  
  // Adiciona animação se não existir
  if (!document.getElementById('spin-animation')) {
    const style = document.createElement('style');
    style.id = 'spin-animation';
    style.textContent = `
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }
}

function showError(element, errorMessage, details = '') {
  if (!element) return;
  
  element.innerHTML = `
    <div class="card" style="border-color: rgba(239, 68, 68, 0.3);">
      <div class="card-title" style="color: #EF4444;">
        ⚠️ ${escapeHTML(errorMessage)}
      </div>
      <div class="card-sub muted">
        ${escapeHTML(details)}
      </div>
      <div style="margin-top: 1rem;">
        <button class="btn small primary" onclick="location.reload()">
          Tentar novamente
        </button>
      </div>
    </div>
  `;
}

// ===============================
// FETCH COM RETRY E CACHE
// ===============================

const cache = new Map();

async function fetchWithRetry(url, options = {}, retries = CONFIG.maxRetries) {
  // Verifica cache
  const cacheKey = url;
  const cached = cache.get(cacheKey);
  
  if (cached && (Date.now() - cached.timestamp < CONFIG.cacheTime)) {
    return cached.data;
  }

  // Tenta fazer o fetch
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        ...options,
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Salva no cache
      cache.set(cacheKey, {
        data,
        timestamp: Date.now()
      });

      return data;

    } catch (error) {
      console.warn(`Tentativa ${i + 1}/${retries} falhou:`, error.message);
      
      if (i === retries - 1) {
        throw error;
      }
      
      // Aguarda antes de tentar novamente
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}

// ===============================
// PROJETOS
// ===============================

async function loadProjects() {
  const grid = document.getElementById('projectsGrid');
  if (!grid) return;

  showLoading(grid, 'Carregando projetos...');

  try {
    const projects = await fetchWithRetry(CONFIG.projectsPath);

    if (!Array.isArray(projects)) {
      throw new Error('Formato de dados inválido');
    }

    renderProjects(projects, 'all');
    bindFilters(projects);

  } catch (error) {
    console.error('Erro ao carregar projetos:', error);
    showError(
      grid,
      'Erro ao carregar projetos',
      `Verifique se o arquivo ${CONFIG.projectsPath} existe e está com JSON válido. Detalhes: ${error.message}`
    );
  }
}

function renderProjects(projects, filter) {
  const grid = document.getElementById('projectsGrid');
  if (!grid) return;

  const filtered = (filter === 'all')
    ? projects
    : projects.filter(p => (p.tipo || '').toLowerCase() === filter.toLowerCase());

  if (!filtered.length) {
    grid.innerHTML = `
      <div class="card">
        <div class="card-title">Nenhum projeto encontrado</div>
        <div class="card-sub muted">
          Tente outro filtro ou adicione projetos no arquivo <code>data/projetos.json</code>.
        </div>
      </div>
    `;
    return;
  }

  // Usa DocumentFragment para melhor performance
  const fragment = document.createDocumentFragment();
  const tempDiv = document.createElement('div');
  
  filtered.forEach(project => {
    tempDiv.innerHTML = createProjectCard(project);
    fragment.appendChild(tempDiv.firstElementChild);
  });

  grid.innerHTML = '';
  grid.appendChild(fragment);

  // Adiciona animação de entrada
  setTimeout(() => {
    grid.querySelectorAll('.pcard').forEach((card, index) => {
      card.style.opacity = '0';
      card.style.transform = 'translateY(20px)';
      setTimeout(() => {
        card.style.transition = 'all 0.4s ease';
        card.style.opacity = '1';
        card.style.transform = 'translateY(0)';
      }, index * 50);
    });
  }, 10);
}

function createProjectCard(project) {
  const {
    titulo = 'Projeto sem título',
    tipo = 'Projeto',
    descricao = 'Sem descrição',
    tags = [],
    links = {}
  } = project;

  const tagsList = Array.isArray(tags) 
    ? tags.slice(0, 6).map(tag => `<span class="tag">${escapeHTML(tag)}</span>`).join('')
    : '';

  const verLink = links.ver || '#';
  const repoLink = links.repo || '#';

  return `
    <article class="pcard">
      <div class="p-top">
        <h3 class="p-title">${escapeHTML(titulo)}</h3>
        <span class="p-type">${escapeHTML(tipo)}</span>
      </div>

      <p class="p-desc">${escapeHTML(descricao)}</p>

      <div class="tags">
        ${tagsList}
      </div>

      <div class="p-actions">
        <a class="btn small primary" 
           href="${verLink}" 
           target="_blank" 
           rel="noopener noreferrer"
           aria-label="Ver projeto ${escapeHTML(titulo)}">
          Ver projeto
        </a>
        <a class="btn small ghost" 
           href="${repoLink}" 
           target="_blank" 
           rel="noopener noreferrer"
           aria-label="Ver repositório de ${escapeHTML(titulo)}">
          Repositório
        </a>
      </div>
    </article>
  `;
}

function bindFilters(projects) {
  const chips = document.querySelectorAll('.chip');
  if (!chips.length) return;

  chips.forEach(chip => {
    chip.addEventListener('click', function() {
      // Remove active de todos
      chips.forEach(c => c.classList.remove('active'));
      
      // Adiciona active no clicado
      this.classList.add('active');

      // Filtra projetos
      const filter = this.getAttribute('data-filter') || 'all';
      renderProjects(projects, filter);

      // Anuncia mudança para leitores de tela
      announceToScreenReader(`Filtro aplicado: ${this.textContent}`);
    });

    // Adiciona suporte para teclado
    chip.setAttribute('role', 'button');
    chip.setAttribute('tabindex', '0');
    chip.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.click();
      }
    });
  });
}

// ===============================
// CERTIFICADOS
// ===============================

async function loadCerts() {
  const grid = document.getElementById('certsGrid');
  if (!grid) return;

  showLoading(grid, 'Carregando certificados...');

  try {
    const certs = await fetchWithRetry(CONFIG.certsPath);

    if (!Array.isArray(certs)) {
      throw new Error('Formato de dados inválido');
    }

    renderCerts(certs);

  } catch (error) {
    console.error('Erro ao carregar certificados:', error);
    showError(
      grid,
      'Erro ao carregar certificados',
      `Verifique se o arquivo ${CONFIG.certsPath} existe e está com JSON válido. Detalhes: ${error.message}`
    );
  }
}

function renderCerts(certs) {
  const grid = document.getElementById('certsGrid');
  if (!grid) return;

  if (!certs.length) {
    grid.innerHTML = `
      <div class="card">
        <div class="card-title">Nenhum certificado cadastrado</div>
        <div class="card-sub muted">
          Adicione certificados no arquivo <code>data/certificados.json</code>.
        </div>
      </div>
    `;
    return;
  }

  // Usa DocumentFragment para melhor performance
  const fragment = document.createDocumentFragment();
  const tempDiv = document.createElement('div');
  
  certs.forEach(cert => {
    tempDiv.innerHTML = createCertCard(cert);
    fragment.appendChild(tempDiv.firstElementChild);
  });

  grid.innerHTML = '';
  grid.appendChild(fragment);

  // Adiciona animação de entrada
  setTimeout(() => {
    grid.querySelectorAll('.pcard').forEach((card, index) => {
      card.style.opacity = '0';
      card.style.transform = 'translateY(20px)';
      setTimeout(() => {
        card.style.transition = 'all 0.4s ease';
        card.style.opacity = '1';
        card.style.transform = 'translateY(0)';
      }, index * 50);
    });
  }, 10);
}

function createCertCard(cert) {
  const {
    titulo = 'Certificado sem título',
    tipo = 'certificado',
    descricao = '',
    instituicao = '',
    ano = '',
    link = '#'
  } = cert;

  const instTag = instituicao 
    ? `<span class="tag">${escapeHTML(instituicao)}</span>` 
    : '';
  
  const anoTag = ano 
    ? `<span class="tag">${escapeHTML(ano)}</span>` 
    : '';

  return `
    <article class="pcard">
      <div class="p-top">
        <h3 class="p-title">${escapeHTML(titulo)}</h3>
        <span class="p-type">${escapeHTML(tipo)}</span>
      </div>

      <p class="p-desc">${escapeHTML(descricao)}</p>

      <div class="tags">
        ${instTag}
        ${anoTag}
      </div>

      <div class="p-actions">
        <a class="btn small primary" 
           href="${link}" 
           target="_blank" 
           rel="noopener noreferrer"
           aria-label="Abrir certificado ${escapeHTML(titulo)}">
          Abrir certificado
        </a>
      </div>
    </article>
  `;
}

// ===============================
// ACESSIBILIDADE
// ===============================

function announceToScreenReader(message) {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', 'polite');
  announcement.className = 'sr-only';
  announcement.textContent = message;
  
  document.body.appendChild(announcement);
  
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

// Gerenciar foco para acessibilidade
function manageFocus() {
  const hash = window.location.hash;
  if (hash) {
    const target = document.querySelector(hash);
    if (target) {
      target.setAttribute('tabindex', '-1');
      target.focus();
      target.removeAttribute('tabindex');
    }
  }
}

// ===============================
// PERFORMANCE: LAZY LOADING
// ===============================

function initLazyLoading() {
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

function updateHeroScale() {
  const hero = document.querySelector('.hero');
  if (!hero) return;

  const canvas = hero.querySelector('.hero-canvas');
  if (!canvas) return;

  // Só aplica no desktop/tablet grande (onde você quer o "poster fixo")
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
// PROJETOS - GERENCIAMENTO
// ===============================

let allProjects = [];
let currentProject = null;

// Carrega projetos em destaque (index)
async function loadFeaturedProjects() {
  const grid = document.getElementById('featuredProjectsGrid');
  if (!grid) return;

  showLoading(grid, 'Carregando projetos em destaque...');

  try {
    const projects = await fetchWithRetry(CONFIG.projectsPath);
    
    if (!Array.isArray(projects)) {
      throw new Error('Formato de dados inválido');
    }

    allProjects = projects;
    const featured = projects.filter(p => p.destaque === true);

    if (!featured.length) {
      grid.innerHTML = `
        <div class="card">
          <div class="card-title">Nenhum projeto em destaque</div>
          <div class="card-sub muted">
            Configure projetos com "destaque": true no arquivo JSON.
          </div>
        </div>
      `;
      return;
    }

    renderFeaturedProjects(featured, grid);

  } catch (error) {
    console.error('Erro ao carregar projetos em destaque:', error);
    showError(
      grid,
      'Erro ao carregar projetos',
      `Detalhes: ${error.message}`
    );
  }
}

// Renderiza projetos em destaque
function renderFeaturedProjects(projects, container) {
  const fragment = document.createDocumentFragment();
  const tempDiv = document.createElement('div');

  projects.forEach(project => {
    tempDiv.innerHTML = createFeaturedCard(project);
    const card = tempDiv.firstElementChild;
    
    // Adiciona evento de clique para abrir modal
    card.addEventListener('click', () => openProjectModal(project));
    
    fragment.appendChild(card);
  });

  container.innerHTML = '';
  container.appendChild(fragment);

  // Animação de entrada
  animateCards(container);
}

// Cria card de projeto em destaque
function createFeaturedCard(project) {
  const {
    id,
    titulo,
    tipo,
    descricao,
    tags = [],
    thumbnail
  } = project;

  const tagsList = tags.slice(0, 3)
    .map(tag => `<span class="tag">${escapeHTML(tag)}</span>`)
    .join('');

  return `
    <article class="featured-card" data-project-id="${id}">
      <img 
        src="${thumbnail || 'assets/img/projetos/placeholder.png'}" 
        alt="Preview de ${escapeHTML(titulo)}" 
        class="featured-thumb"
        loading="lazy"
      />
      <div class="featured-body">
        <div class="featured-header">
          <h3 class="featured-title">${escapeHTML(titulo)}</h3>
          <span class="featured-type">${escapeHTML(tipo)}</span>
        </div>
        <p class="featured-desc">${escapeHTML(descricao)}</p>
        <div class="featured-footer">
          <div class="featured-tags">
            ${tagsList}
          </div>
          <span class="featured-link">
            Ver detalhes
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 3L11 8L6 13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </span>
        </div>
      </div>
    </article>
  `;
}

// Carrega todos os projetos (projetos.html)
async function loadAllProjects() {
  const grid = document.getElementById('projectsGrid');
  if (!grid) return;

  showLoading(grid, 'Carregando projetos...');

  try {
    const projects = await fetchWithRetry(CONFIG.projectsPath);

    if (!Array.isArray(projects)) {
      throw new Error('Formato de dados inválido');
    }

    allProjects = projects;
    renderProjects(projects, 'all');
    bindFilters(projects);
    initModalHandlers();

  } catch (error) {
    console.error('Erro ao carregar projetos:', error);
    showError(
      grid,
      'Erro ao carregar projetos',
      `Detalhes: ${error.message}`
    );
  }
}

// Renderiza projetos com filtro
function renderProjects(projects, filter) {
  const grid = document.getElementById('projectsGrid');
  if (!grid) return;

  const filtered = (filter === 'all')
    ? projects
    : projects.filter(p => (p.tipo || '').toLowerCase() === filter.toLowerCase());

  if (!filtered.length) {
    grid.innerHTML = `
      <div class="card">
        <div class="card-title">Nenhum projeto encontrado</div>
        <div class="card-sub muted">
          Tente outro filtro ou adicione projetos no arquivo JSON.
        </div>
      </div>
    `;
    return;
  }

  const fragment = document.createDocumentFragment();
  const tempDiv = document.createElement('div');

  filtered.forEach(project => {
    tempDiv.innerHTML = createProjectCard(project);
    const card = tempDiv.firstElementChild;
    
    // Adiciona evento de clique
    card.addEventListener('click', () => openProjectModal(project));
    
    fragment.appendChild(card);
  });

  grid.innerHTML = '';
  grid.appendChild(fragment);

  // Animação de entrada
  animateCards(grid);
}

// Cria card de projeto com thumbnail
function createProjectCard(project) {
  const {
    id,
    titulo,
    tipo,
    descricao,
    tags = [],
    thumbnail,
    destaque
  } = project;

  const tagsList = tags.slice(0, 4)
    .map(tag => `<span class="tag">${escapeHTML(tag)}</span>`)
    .join('');

  const destaqueBadge = destaque 
    ? '<span class="tag" style="background: rgba(242, 140, 40, 0.2); border-color: rgba(242, 140, 40, 0.4); color: var(--accent);">★ Destaque</span>'
    : '';

  return `
    <article class="pcard-with-thumb" data-project-id="${id}">
      <img 
        src="${thumbnail || 'assets/img/projetos/placeholder.png'}" 
        alt="Preview de ${escapeHTML(titulo)}" 
        class="pcard-thumb"
        loading="lazy"
      />
      <div class="pcard-body">
        <div class="p-top">
          <h3 class="p-title">${escapeHTML(titulo)}</h3>
          <span class="p-type">${escapeHTML(tipo)}</span>
        </div>
        <p class="p-desc">${escapeHTML(descricao)}</p>
        <div class="tags">
          ${destaqueBadge}
          ${tagsList}
        </div>
      </div>
    </article>
  `;
}

// Animação de entrada dos cards
function animateCards(container) {
  setTimeout(() => {
    container.querySelectorAll('.featured-card, .pcard-with-thumb').forEach((card, index) => {
      card.style.opacity = '0';
      card.style.transform = 'translateY(20px)';
      setTimeout(() => {
        card.style.transition = 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)';
        card.style.opacity = '1';
        card.style.transform = 'translateY(0)';
      }, index * 60);
    });
  }, 10);
}

// ===============================
// MODAL DE DETALHES
// ===============================

function openProjectModal(project) {
  currentProject = project;
  
  const modal = document.getElementById('projectModal');
  if (!modal) return;

  // Preenche conteúdo do modal
  populateModal(project);

  // Mostra modal
  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');

  // Foco acessível
  setTimeout(() => {
    const closeBtn = modal.querySelector('.modal-close');
    if (closeBtn) closeBtn.focus();
  }, 100);
}

function closeProjectModal() {
  const modal = document.getElementById('projectModal');
  if (!modal) return;

  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
  currentProject = null;
}

function populateModal(project) {
  const {
    titulo,
    tipo,
    descricao,
    descricaoCompleta,
    status = 'Concluído',
    screenshots = [],
    tecnologias = [],
    desafios = [],
    resultados = [],
    links = {}
  } = project;

  // Header
  document.getElementById('modalType').textContent = tipo;
  document.getElementById('modalStatus').textContent = status;
  document.getElementById('modalTitle').textContent = titulo;
  document.getElementById('modalDesc').textContent = descricao;

  // Screenshots
  const screenshotsContainer = document.getElementById('modalScreenshots');
  if (screenshots.length > 0) {
    screenshotsContainer.innerHTML = screenshots
      .map(url => `
        <img 
          src="${url}" 
          alt="Screenshot do projeto ${escapeHTML(titulo)}" 
          class="modal-screenshot"
          loading="lazy"
        />
      `)
      .join('');
    screenshotsContainer.style.display = 'grid';
  } else {
    screenshotsContainer.style.display = 'none';
  }

  // Descrição completa
  document.getElementById('modalDescCompleta').textContent = 
    descricaoCompleta || descricao;

  // Tecnologias
  const tecContainer = document.getElementById('modalTecnologias');
  if (tecnologias.length > 0) {
    tecContainer.innerHTML = tecnologias
      .map(tec => `<span class="tag">${escapeHTML(tec)}</span>`)
      .join('');
  }

  // Desafios
  const desafiosSection = document.getElementById('modalDesafiosSection');
  const desafiosList = document.getElementById('modalDesafios');
  if (desafios.length > 0) {
    desafiosList.innerHTML = desafios
      .map(d => `<li>${escapeHTML(d)}</li>`)
      .join('');
    desafiosSection.style.display = 'block';
  } else {
    desafiosSection.style.display = 'none';
  }

  // Resultados
  const resultadosSection = document.getElementById('modalResultadosSection');
  const resultadosList = document.getElementById('modalResultados');
  if (resultados.length > 0) {
    resultadosList.innerHTML = resultados
      .map(r => `<li>${escapeHTML(r)}</li>`)
      .join('');
    resultadosSection.style.display = 'block';
  } else {
    resultadosSection.style.display = 'none';
  }

  // Links
  const verBtn = document.getElementById('modalVerBtn');
  const repoBtn = document.getElementById('modalRepoBtn');

  if (links.ver && links.ver !== '#') {
    verBtn.href = links.ver;
    verBtn.style.display = 'inline-flex';
  } else {
    verBtn.style.display = 'none';
  }

  if (links.repo && links.repo !== '#') {
    repoBtn.href = links.repo;
    repoBtn.style.display = 'inline-flex';
  } else {
    repoBtn.style.display = 'none';
  }
}

function initModalHandlers() {
  const modal = document.getElementById('projectModal');
  if (!modal) return;

  // Fecha ao clicar no overlay ou botão de fechar
  modal.querySelectorAll('[data-close-modal]').forEach(el => {
    el.addEventListener('click', closeProjectModal);
  });

  // Fecha com ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
      closeProjectModal();
    }
  });

  // Previne propagação de clique dentro do conteúdo
  const modalContent = modal.querySelector('.modal-content');
  if (modalContent) {
    modalContent.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }
}

// ===============================
// ATUALIZAÇÃO DA FUNÇÃO INIT
// ===============================

// Adicione isso à função init() existente:
function initProjects() {
  // ✅ Inicializa handlers do modal para QUALQUER página que tenha o modal
  if (document.getElementById('projectModal')) {
    initModalHandlers();
  }

  // Se estiver na página index
  if (document.getElementById('featuredProjectsGrid')) {
    loadFeaturedProjects();
  }

  // Se estiver na página projetos.html
  if (document.getElementById('projectsGrid') &&
      !document.getElementById('featuredProjectsGrid')) {
    loadAllProjects();
  }
}

// Exporta para o namespace global
window.portfolioApp = {
  ...window.portfolioApp,
  loadFeaturedProjects,
  loadAllProjects,
  openProjectModal,
  closeProjectModal
};


// Executa quando o DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Exporta funções para uso global (se necessário)
window.portfolioApp = {
  loadProjects,
  loadCerts,
  renderProjects,
  renderCerts
};

// ===============================
// CERTIFICADOS - GERENCIAMENTO UNIFICADO
// ===============================

let allCertificates = [];
let currentCertificate = null;

// Carrega certificados em destaque (index.html)
async function loadFeaturedCertificates() {
  const grid = document.getElementById('featuredCertsGrid');
  if (!grid) return;

  showLoading(grid, 'Carregando certificados em destaque...');

  try {
    const certificates = await fetchWithRetry(CONFIG.certsPath);
    
    if (!Array.isArray(certificates)) {
      throw new Error('Formato de dados inválido');
    }

    allCertificates = certificates;
    const featured = certificates.filter(c => c.destaque === true);

    if (!featured.length) {
      const fallback = certificates.slice(0, 3);
      renderFeaturedCertificates(fallback, grid);
      return;
    }

    renderFeaturedCertificates(featured, grid);

  } catch (error) {
    console.error('Erro ao carregar certificados em destaque:', error);
    showError(grid, 'Erro ao carregar certificados', `Detalhes: ${error.message}`);
  }
}

// Renderiza certificados em destaque
function renderFeaturedCertificates(certificates, container) {
  const fragment = document.createDocumentFragment();
  const tempDiv = document.createElement('div');

  certificates.forEach(cert => {
    tempDiv.innerHTML = createFeaturedCertCard(cert);
    const card = tempDiv.firstElementChild;
    card.addEventListener('click', () => openCertificateModal(cert));
    fragment.appendChild(card);
  });

  container.innerHTML = '';
  container.appendChild(fragment);
  animateCertCards(container);
}

// Cria card de certificado em destaque
function createFeaturedCertCard(cert) {
  const {
    id,
    titulo,
    instituicao,
    ano,
    categoria,
    tipo,
    descricao,
    thumbnail,
    duracao,
    destaque,
    certificados = []
  } = cert;

  const cardClass = tipo === 'diploma' 
    ? 'featured-cert-card cert-card-diploma' 
    : tipo === 'repositório'
    ? 'featured-cert-card cert-card-repo'
    : 'featured-cert-card';

  const badge = destaque 
    ? '<span class="cert-badge">★ Destaque</span>' 
    : '';

  const certCount = (tipo === 'Formação' && certificados.length > 0)
    ? `<span class="cert-count-badge">${certificados.length} certificados</span>`
    : '';

  return `
    <article class="${cardClass}" data-cert-id="${id}">
      ${badge}
      ${certCount}
      <img 
        src="${
          (tipo === 'Formação'
            ? (certificados?.find(c => c.isFormacao)?.preview || thumbnail)
            : thumbnail
          ) || 'assets/img/certificados/placeholder-cert.png'
        }"
        alt="Preview de ${escapeHTML(titulo)}" 
        class="featured-cert-thumb"
        loading="lazy"
      />
      <div class="featured-cert-body">
        <div class="featured-cert-header">
          <h3 class="featured-cert-title">${escapeHTML(titulo)}</h3>
          <div class="cert-meta">
            <span class="cert-meta-item">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 6L8 2L14 6L8 10L2 6Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M2 10L8 14L14 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              ${escapeHTML(instituicao)}
            </span>
            ${duracao ? `
              <span class="cert-meta-item">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M8 14C11.3137 14 14 11.3137 14 8C14 4.68629 11.3137 2 8 2C4.68629 2 2 4.68629 2 8C2 11.3137 4.68629 14 8 14Z" stroke="currentColor" stroke-width="1.5"/>
                  <path d="M8 5V8L10 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
                ${escapeHTML(duracao)}
              </span>
            ` : ''}
            ${ano ? `
              <span class="cert-meta-item">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M8 2V8L11 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                  <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5"/>
                </svg>
                ${escapeHTML(ano)}
              </span>
            ` : ''}
          </div>
        </div>
        <p class="featured-cert-desc">${escapeHTML(descricao)}</p>
        <div class="featured-cert-footer">
          <span class="featured-cert-category">${escapeHTML(categoria)}</span>
          <span class="featured-cert-link">
            Ver detalhes
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 3L11 8L6 13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </span>
        </div>
      </div>
    </article>
  `;
}

// ✅ FUNÇÃO UNIFICADA - Carrega todos os certificados (certificados.html)
async function loadAllCertificates() {
  const grid = document.getElementById('certsGrid');
  if (!grid) return;

  showLoading(grid, 'Carregando certificados...');

  try {
    const certificates = await fetchWithRetry(CONFIG.certsPath);

    if (!Array.isArray(certificates)) {
      throw new Error('Formato de dados inválido');
    }

    allCertificates = certificates;
    renderAllCertificates(certificates, 'all'); // ✅ Renomeada para evitar conflito
    bindCertFilters(certificates);
    initCertModalHandlers();

  } catch (error) {
    console.error('Erro ao carregar certificados:', error);
    showError(grid, 'Erro ao carregar certificados', `Detalhes: ${error.message}`);
  }
}

// ✅ RENDERIZAÇÃO UNIFICADA - Usa sempre a mesma estrutura
function renderAllCertificates(certificates, filter) {
  const grid = document.getElementById('certsGrid');
  if (!grid) return;

  const filtered = (filter === 'all')
    ? certificates
    : certificates.filter(c => (c.categoria || '').toLowerCase() === filter.toLowerCase());

  if (!filtered.length) {
    grid.innerHTML = `
      <div class="card">
        <div class="card-title">Nenhum certificado encontrado</div>
        <div class="card-sub muted">Tente outro filtro.</div>
      </div>
    `;
    return;
  }

  const fragment = document.createDocumentFragment();
  const tempDiv = document.createElement('div');

  filtered.forEach(cert => {
    tempDiv.innerHTML = createCertificateCard(cert); // ✅ Sempre a mesma estrutura
    const card = tempDiv.firstElementChild;
    card.addEventListener('click', () => openCertificateModal(cert));
    fragment.appendChild(card);
  });

  grid.innerHTML = '';
  grid.appendChild(fragment);
  animateCertCards(grid);
}

// ✅ CARD UNIFICADO - Estrutura consistente
function createCertificateCard(cert) {
  const {
    id,
    titulo,
    instituicao,
    ano,
    categoria,
    tipo,
    descricao,
    thumbnail,
    destaque,
    certificados = []
  } = cert;

  const cardClass = tipo === 'diploma' 
    ? 'cert-card-with-thumb cert-card-diploma' 
    : tipo === 'repositório'
    ? 'cert-card-with-thumb cert-card-repo'
    : 'cert-card-with-thumb';

  const destaqueBadge = destaque 
    ? '<span class="tag" style="background: rgba(27, 127, 92, 0.2); border-color: rgba(27, 127, 92, 0.4); color: var(--success);">★ Destaque</span>'
    : '';

  const certCount = (tipo === 'Formação' && certificados.length > 0)
    ? `<span class="tag" style="background: rgba(59, 130, 246, 0.2); border-color: rgba(59, 130, 246, 0.4); color: #3B82F6;">${certificados.length} certificados</span>`
    : '';

  return `
    <article class="${cardClass}" data-cert-id="${id}">
      <img 
        src="${
          (tipo === 'Formação'
            ? (certificados?.find(c => c.isFormacao)?.preview || thumbnail)
            : thumbnail
          ) || 'assets/img/certificados/placeholder-cert.png'
        }"
        alt="Preview de ${escapeHTML(titulo)}" 
        class="cert-thumb"
        loading="lazy"
      />
      <div class="cert-card-body">
        <div class="p-top">
          <h3 class="p-title">${escapeHTML(titulo)}</h3>
          <span class="p-type">${escapeHTML(categoria)}</span>
        </div>
        <div class="cert-meta" style="margin: 0.5rem 0;">
          <span class="cert-meta-item">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M2 6L8 2L14 6L8 10L2 6Z" stroke="currentColor" stroke-width="1.5"/>
              <path d="M2 10L8 14L14 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            ${escapeHTML(instituicao)}
          </span>
          ${ano ? `
            <span class="cert-meta-item">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M8 2V8L11 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5"/>
              </svg>
              ${escapeHTML(ano)}
            </span>
          ` : ''}
        </div>
        <p class="p-desc">${escapeHTML(descricao)}</p>
        <div class="tags">
          ${destaqueBadge}
          ${certCount}
          <span class="tag">${escapeHTML(tipo)}</span>
        </div>
      </div>
    </article>
  `;
}

// Bind filtros de certificados
function bindCertFilters(certificates) {
  const chips = document.querySelectorAll('.chip');
  if (!chips.length) return;

  chips.forEach(chip => {
    chip.addEventListener('click', function() {
      chips.forEach(c => c.classList.remove('active'));
      this.classList.add('active');

      const filter = this.getAttribute('data-filter') || 'all';
      renderAllCertificates(certificates, filter); // ✅ Usa a função unificada

      announceToScreenReader(`Filtro aplicado: ${this.textContent}`);
    });

    chip.setAttribute('role', 'button');
    chip.setAttribute('tabindex', '0');
    chip.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.click();
      }
    });
  });
}

// Animação de entrada dos cards
function animateCertCards(container) {
  setTimeout(() => {
    container.querySelectorAll('.featured-cert-card, .cert-card-with-thumb').forEach((card, index) => {
      card.style.opacity = '0';
      card.style.transform = 'translateY(20px)';
      setTimeout(() => {
        card.style.transition = 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)';
        card.style.opacity = '1';
        card.style.transform = 'translateY(0)';
      }, index * 60);
    });
  }, 10);
}

// ✅ INICIALIZAÇÃO UNIFICADA
function initCertificates() {
  // Index.html - Certificados em destaque
  if (document.getElementById('featuredCertsGrid')) {
    loadFeaturedCertificates();
  }

  // Certificados.html - Todos os certificados
  if (document.getElementById('certsGrid') && 
      !document.getElementById('featuredCertsGrid')) {
    loadAllCertificates();
  }

  // Inicializa modal em qualquer página que o tenha
  if (document.getElementById('certModal')) {
    initCertModalHandlers();
  }
}

// ===============================
// MODAL DE CERTIFICADO
// ===============================

function openCertificateModal(cert) {
  currentCertificate = cert;
  
  const modal = document.getElementById('certModal');
  if (!modal) return;

  populateCertModal(cert);

  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');

  setTimeout(() => {
    const closeBtn = modal.querySelector('.modal-close');
    if (closeBtn) closeBtn.focus();
  }, 100);
}

function closeCertificateModal() {
  const modal = document.getElementById('certModal');
  if (!modal) return;

  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
  currentCertificate = null;
}

function populateCertModal(cert) {
  const {
    titulo,
    instituicao,
    ano,
    categoria,
    tipo,
    descricao,
    descricaoCompleta,
    preview,
    duracao,
    competencias = [],
    certificados = [],
    githubFolder,
    status = 'Concluído'
  } = cert;

  // Header
  document.getElementById('certModalCategoria').textContent = categoria;
  document.getElementById('certModalStatus').textContent = status;
  document.getElementById('certModalTitle').textContent = titulo;
  document.getElementById('certModalDesc').textContent = descricao;

  // Info
  if (duracao) document.getElementById('certModalDuracao').textContent = duracao;
  if (ano) document.getElementById('certModalAno').textContent = ano;
  document.getElementById('certModalInstituicao').textContent = instituicao;

  // Preview ou Galeria
  const previewContainer = document.getElementById('certModalPreview');
  
  if (certificados && certificados.length > 0) {
    previewContainer.innerHTML = `
      <div class="cert-gallery-header">
        <h3>Certificados da categoria (${certificados.length})</h3>
        <p class="cert-gallery-desc">Clique em um certificado para visualizar</p>
      </div>
      <div class="cert-gallery">
        ${certificados.map((c, idx) => `
          <div class="cert-gallery-item" data-cert-index="${idx}">
            <div class="cert-gallery-thumb">
              <img 
                src="${c.preview || 'assets/img/certificados/placeholder-cert.png'}" 
                alt="${escapeHTML(c.nome)}"
                loading="lazy"
              />
              <div class="cert-gallery-overlay">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                  <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
            </div>
            <div class="cert-gallery-name">${escapeHTML(c.nome)}</div>
          </div>
        `).join('')}
      </div>
    `;
    previewContainer.style.display = 'block';
    
    previewContainer.querySelectorAll('.cert-gallery-item').forEach((item, idx) => {
      item.addEventListener('click', () => {
        window.open(certificados[idx].url, '_blank', 'noopener,noreferrer');
      });
    });
    
  } else if (preview) {
    previewContainer.innerHTML = `
      <img 
        src="${preview}" 
        alt="Preview do certificado ${escapeHTML(titulo)}" 
        loading="lazy"
      />
    `;
    previewContainer.style.display = 'block';
  } else {
    previewContainer.style.display = 'none';
  }

  // Descrição completa
  document.getElementById('certModalDescCompleta').textContent = 
    descricaoCompleta || descricao;

  // Competências
  const compContainer = document.getElementById('certModalCompetencias');
  if (competencias.length > 0) {
    compContainer.innerHTML = competencias
      .map(comp => `<span class="tag">${escapeHTML(comp)}</span>`)
      .join('');
  } else {
    compContainer.innerHTML = '<p style="color: var(--muted); font-size: 0.875rem;">Nenhuma competência listada</p>';
  }

  // Links
  const verBtn = document.getElementById('certModalVerBtn');
  const repoBtn = document.getElementById('certModalRepoBtn');

  if (githubFolder) {
    repoBtn.href = githubFolder;
    repoBtn.textContent = tipo === 'categoria' ? 'Ver pasta no GitHub' : 'Ver no GitHub';
    repoBtn.style.display = 'inline-flex';
  } else {
    repoBtn.style.display = 'none';
  }

  verBtn.style.display = 'none';
}

function initCertModalHandlers() {
  const modal = document.getElementById('certModal');
  if (!modal) return;

  modal.querySelectorAll('[data-close-cert-modal]').forEach(el => {
    el.addEventListener('click', closeCertificateModal);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
      closeCertificateModal();
    }
  });

  const modalContent = modal.querySelector('.modal-content');
  if (modalContent) {
    modalContent.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }
}

// Exporta para o namespace global
window.portfolioApp = {
  ...window.portfolioApp,
  loadFeaturedCertificates,
  loadAllCertificates,
  openCertificateModal,
  closeCertificateModal
};

// ===============================
// INICIALIZAÇÃO PRINCIPAL
// ===============================

function init() {
  try {
    setTopbar();
    setYear();
    initSmoothScroll();
    initScrollSpy();
    initLazyLoading();
    manageFocus();
    
    // ✅ Inicializa projetos
    initProjects();
    
    // ✅ Inicializa certificados (corrigido)
    initCertificates();
    
    window.addEventListener('hashchange', manageFocus);
    
    console.log('✅ Portfólio inicializado com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro na inicialização:', error);
  }

  updateHeroScale();
  window.addEventListener('resize', debounce(updateHeroScale, 80));
}

// Executa quando o DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}