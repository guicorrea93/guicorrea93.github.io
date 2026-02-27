// ===============================
// PROJETOS - GERENCIAMENTO COMPLETO
// ===============================

import { CONFIG } from './config.js';
import { escapeHTML, makeCardAccessible, announceToScreenReader } from './utils.js';
import { fetchWithRetry } from './api.js';
import { showLoading, showError, animateCards } from './ui.js';

let allProjects = [];
let currentProject = null;

// ===============================
// PROJETOS ANTIGOS (loadProjects / renderProjects / createProjectCard / bindFilters)
// Usados potencialmente em versoes anteriores, mantidos por compatibilidade
// ===============================

async function loadProjects() {
  const grid = document.getElementById('projectsGrid');
  if (!grid) return;

  showLoading(grid, 'Carregando projetos...');

  try {
    const projects = await fetchWithRetry(CONFIG.projectsPath);

    if (!Array.isArray(projects)) {
      throw new Error('Formato de dados invalido');
    }

    renderProjectsSimple(projects, 'all');
    bindFiltersSimple(projects);

  } catch (error) {
    console.error('Erro ao carregar projetos:', error);
    showError(
      grid,
      'Erro ao carregar projetos',
      `Verifique se o arquivo ${CONFIG.projectsPath} existe e esta com JSON valido. Detalhes: ${error.message}`
    );
  }
}

function renderProjectsSimple(projects, filter) {
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
    tempDiv.innerHTML = createProjectCardSimple(project);
    fragment.appendChild(tempDiv.firstElementChild);
  });

  grid.innerHTML = '';
  grid.appendChild(fragment);

  // Adiciona animacao de entrada
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

function createProjectCardSimple(project) {
  const {
    titulo = 'Projeto sem t\u00edtulo',
    tipo = 'Projeto',
    descricao = 'Sem descri\u00e7\u00e3o',
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
           aria-label="Ver reposit\u00f3rio de ${escapeHTML(titulo)}">
          Reposit\u00f3rio
        </a>
      </div>
    </article>
  `;
}

function bindFiltersSimple(projects) {
  const chips = document.querySelectorAll('.chip');
  if (!chips.length) return;

  chips.forEach(chip => {
    chip.addEventListener('click', function() {
      chips.forEach(c => c.classList.remove('active'));
      this.classList.add('active');
      const filter = this.getAttribute('data-filter') || 'all';
      renderProjectsSimple(projects, filter);
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

// ===============================
// PROJETOS EM DESTAQUE (INDEX)
// ===============================

async function loadFeaturedProjects() {
  const grid = document.getElementById('featuredProjectsGrid');
  if (!grid) return;

  showLoading(grid, 'Carregando projetos em destaque...');

  try {
    const projects = await fetchWithRetry(CONFIG.projectsPath);

    if (!Array.isArray(projects)) {
      throw new Error('Formato de dados invalido');
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

    makeCardAccessible(card, () => openProjectModal(project));

    fragment.appendChild(card);
  });

  container.innerHTML = '';
  container.appendChild(fragment);

  // Animacao de entrada
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
        src="${thumbnail || 'assets/img/projetos/placeholder.webp'}"
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

// ===============================
// TODOS OS PROJETOS (projetos.html)
// ===============================

async function loadAllProjects() {
  const grid = document.getElementById('projectsGrid');
  if (!grid) return;

  showLoading(grid, 'Carregando projetos...');

  try {
    const projects = await fetchWithRetry(CONFIG.projectsPath);

    if (!Array.isArray(projects)) {
      throw new Error('Formato de dados invalido');
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

    makeCardAccessible(card, () => openProjectModal(project));

    fragment.appendChild(card);
  });

  grid.innerHTML = '';
  grid.appendChild(fragment);

  // Animacao de entrada
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
    ? '<span class="tag" style="background: rgba(242, 140, 40, 0.2); border-color: rgba(242, 140, 40, 0.4); color: var(--accent);">\u2605 Destaque</span>'
    : '';

  return `
    <article class="pcard-with-thumb" data-project-id="${id}">
      <img
        src="${thumbnail || 'assets/img/projetos/placeholder.webp'}"
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

// Bind filtros de projetos
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

      // Anuncia mudanca para leitores de tela
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
// MODAL DE DETALHES DE PROJETO
// ===============================

export function openProjectModal(project) {
  currentProject = project;

  const modal = document.getElementById('projectModal');
  if (!modal) return;

  // Preenche conteudo do modal
  populateModal(project);

  // Mostra modal
  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');

  // Foco acessivel
  setTimeout(() => {
    const closeBtn = modal.querySelector('.modal-close');
    if (closeBtn) closeBtn.focus();
  }, 100);
}

export function closeProjectModal() {
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
    status = 'Concluido',
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

  // Descricao completa
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

  // Fecha ao clicar no overlay ou botao de fechar
  modal.querySelectorAll('[data-close-modal]').forEach(el => {
    el.addEventListener('click', closeProjectModal);
  });

  // Fecha com ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
      closeProjectModal();
    }
  });

  // Previne propagacao de clique dentro do conteudo
  const modalContent = modal.querySelector('.modal-content');
  if (modalContent) {
    modalContent.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }
}

// ===============================
// INICIALIZACAO DE PROJETOS
// ===============================

export function initProjects() {
  // Inicializa handlers do modal para QUALQUER pagina que tenha o modal
  if (document.getElementById('projectModal')) {
    initModalHandlers();
  }

  // Se estiver na pagina index
  if (document.getElementById('featuredProjectsGrid')) {
    loadFeaturedProjects();
  }

  // Se estiver na pagina projetos.html
  if (document.getElementById('projectsGrid') &&
      !document.getElementById('featuredProjectsGrid')) {
    loadAllProjects();
  }
}
