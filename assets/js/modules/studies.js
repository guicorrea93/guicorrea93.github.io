// ===============================
// ESTUDOS - GERENCIAMENTO COMPLETO
// ===============================

import { CONFIG } from './config.js';
import { escapeHTML, makeCardAccessible } from './utils.js';
import { fetchWithRetry } from './api.js';
import { showLoading, showError, animateCards } from './ui.js';

let allStudies = [];
let currentStudy = null;

// ===============================
// CARREGA ESTUDOS EM DESTAQUE (INDEX)
// ===============================

async function loadFeaturedStudies() {
  const grid = document.getElementById('featuredStudiesGrid');
  if (!grid) return;

  showLoading(grid, 'Carregando estudos em destaque...');

  try {
    const studies = await fetchWithRetry(CONFIG.studiesPath);

    if (!Array.isArray(studies)) {
      throw new Error('Formato de dados inv\u00e1lido');
    }

    allStudies = studies;

    if (!studies.length) {
      grid.innerHTML = `
        <div class="card">
          <div class="card-title">Nenhum estudo cadastrado</div>
          <div class="card-sub muted">
            Adicione estudos no arquivo data/estudos.json.
          </div>
        </div>
      `;
      return;
    }

    const featured = studies.filter(s => s.destaque === true);
    const toRender = featured.length ? featured : studies.slice(0, 3);
    renderFeaturedStudies(toRender, grid);

  } catch (error) {
    console.error('Erro ao carregar estudos em destaque:', error);
    showError(grid, 'Erro ao carregar estudos', `Detalhes: ${error.message}`);
  }
}

function renderFeaturedStudies(studies, container) {
  const fragment = document.createDocumentFragment();
  const tempDiv = document.createElement('div');

  studies.forEach(study => {
    tempDiv.innerHTML = createFeaturedStudyCard(study);
    const card = tempDiv.firstElementChild;
    makeCardAccessible(card, () => openStudyModal(study));
    fragment.appendChild(card);
  });

  container.innerHTML = '';
  container.appendChild(fragment);

  // Anima os cards com o mesmo padr\u00e3o
  const cards = container.querySelectorAll('.featured-study-card');
  cards.forEach((card, i) => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(20px)';
    setTimeout(() => {
      card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
      card.style.opacity = '1';
      card.style.transform = 'translateY(0)';
    }, i * 100);
  });
}

function createFeaturedStudyCard(study) {
  const {
    id,
    titulo,
    plataforma,
    descricao,
    thumbnail,
    tecnologias = [],
    link,
    destaque
  } = study;

  const badge = destaque
    ? '<span class="study-badge">\u2605 Destaque</span>'
    : '';

  const techHTML = tecnologias.slice(0, 4).map(t =>
    `<span class="study-tech-tag">${escapeHTML(t)}</span>`
  ).join('');

  return `
    <article class="featured-study-card" data-study-id="${id}">
      ${badge}
      <img
        src="${thumbnail || 'assets/img/estudos/placeholder-study.webp'}"
        alt="Preview de ${escapeHTML(titulo)}"
        class="featured-study-thumb"
        loading="lazy"
      />
      <div class="featured-study-body">
        <div class="featured-study-header">
          <h3 class="featured-study-title">${escapeHTML(titulo)}</h3>
          <div class="study-meta">
            <span class="study-meta-item">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 6L8 2L14 6L8 10L2 6Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M2 10L8 14L14 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              ${escapeHTML(plataforma || '')}
            </span>
          </div>
        </div>
        <p class="featured-study-desc">${escapeHTML(descricao || '')}</p>
        <div class="featured-study-techs">${techHTML}</div>
        <div class="featured-study-footer">
          <span class="featured-study-link">
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
// PAGINA DEDICADA (estudos.html)
// ===============================

async function loadAllStudies() {
  const grid = document.getElementById('studiesGrid');
  if (!grid) return;

  showLoading(grid, 'Carregando estudos...');

  try {
    const studies = await fetchWithRetry(CONFIG.studiesPath);

    if (!Array.isArray(studies)) {
      throw new Error('Formato de dados inv\u00e1lido');
    }

    allStudies = studies;

    if (!studies.length) {
      grid.innerHTML = `
        <div class="pcard">
          <div class="p-top"><h3 class="p-title">Nenhum estudo cadastrado</h3></div>
          <p class="p-desc muted">Adicione estudos no arquivo data/estudos.json.</p>
        </div>
      `;
      return;
    }

    // Gera filtros din\u00e2micos por plataforma
    generateStudyFilters(studies);

    renderStudies(studies, 'all');
    initStudyModalHandlers();

  } catch (error) {
    console.error('Erro ao carregar estudos:', error);
    showError(grid, 'Erro ao carregar estudos', `Detalhes: ${error.message}`);
  }
}

function generateStudyFilters(studies) {
  const filtersContainer = document.getElementById('studyFilters');
  if (!filtersContainer) return;

  const plataformas = [...new Set(studies.map(s => s.plataforma).filter(Boolean))];

  let html = '<button class="chip active" data-filter="all" aria-label="Mostrar todos">Todos</button>';
  plataformas.forEach(p => {
    html += `<button class="chip" data-filter="${escapeHTML(p)}" aria-label="Filtrar ${escapeHTML(p)}">${escapeHTML(p)}</button>`;
  });

  filtersContainer.innerHTML = html;

  bindStudyFilters();
}

function bindStudyFilters() {
  const chips = document.querySelectorAll('#studyFilters .chip');
  if (!chips.length) return;

  chips.forEach(chip => {
    chip.addEventListener('click', function() {
      chips.forEach(c => c.classList.remove('active'));
      this.classList.add('active');
      const filter = this.getAttribute('data-filter') || 'all';
      renderStudies(allStudies, filter);
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

function renderStudies(studies, filter) {
  const grid = document.getElementById('studiesGrid');
  if (!grid) return;

  const filtered = (filter === 'all')
    ? studies
    : studies.filter(s => (s.plataforma || '') === filter);

  if (!filtered.length) {
    grid.innerHTML = `
      <div class="card">
        <div class="card-title">Nenhum estudo encontrado</div>
        <div class="card-sub muted">Tente outro filtro ou adicione estudos no arquivo JSON.</div>
      </div>
    `;
    return;
  }

  const fragment = document.createDocumentFragment();
  const tempDiv = document.createElement('div');

  filtered.forEach(study => {
    tempDiv.innerHTML = createStudyCard(study);
    const card = tempDiv.firstElementChild;
    makeCardAccessible(card, () => openStudyModal(study));
    fragment.appendChild(card);
  });

  grid.innerHTML = '';
  grid.appendChild(fragment);

  animateCards(grid);
}

function createStudyCard(study) {
  const {
    id,
    titulo = 'Estudo sem t\u00edtulo',
    plataforma = 'Curso',
    descricao = '',
    thumbnail,
    tecnologias = [],
    destaque
  } = study;

  const tagsList = tecnologias.slice(0, 4)
    .map(t => `<span class="tag">${escapeHTML(t)}</span>`)
    .join('');

  const destaqueBadge = destaque
    ? '<span class="tag" style="background: rgba(59, 130, 246, 0.2); border-color: rgba(59, 130, 246, 0.4); color: var(--blue-accent, #3B82F6);">\u2605 Destaque</span>'
    : '';

  return `
    <article class="pcard-with-thumb" data-study-id="${id}">
      <img
        src="${thumbnail || 'assets/img/estudos/placeholder-study.webp'}"
        alt="Preview de ${escapeHTML(titulo)}"
        class="pcard-thumb"
        loading="lazy"
      />
      <div class="pcard-body">
        <div class="p-top">
          <h3 class="p-title">${escapeHTML(titulo)}</h3>
          <span class="p-type">${escapeHTML(plataforma)}</span>
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

// ===============================
// MODAL DE ESTUDOS
// ===============================

function openStudyModal(study) {
  currentStudy = study;

  const modal = document.getElementById('studyModal');
  if (!modal) return;

  populateStudyModal(study);

  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');

  setTimeout(() => {
    const closeBtn = modal.querySelector('.modal-close');
    if (closeBtn) closeBtn.focus();
  }, 100);
}

function closeStudyModal() {
  const modal = document.getElementById('studyModal');
  if (!modal) return;

  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
  currentStudy = null;
}

function populateStudyModal(study) {
  const {
    titulo,
    plataforma,
    descricao,
    descricaoCompleta,
    thumbnail,
    tecnologias = [],
    link,
    github
  } = study;

  document.getElementById('studyModalPlataforma').textContent = plataforma || '';
  document.getElementById('studyModalTitle').textContent = titulo || '';
  document.getElementById('studyModalDesc').textContent = descricao || '';

  // Thumbnail
  const thumbContainer = document.getElementById('studyModalThumb');
  if (thumbnail) {
    thumbContainer.innerHTML = `<img src="${thumbnail}" alt="Preview de ${escapeHTML(titulo)}" class="modal-screenshot" loading="lazy" />`;
    thumbContainer.style.display = 'block';
  } else {
    thumbContainer.style.display = 'none';
  }

  // Descri\u00e7\u00e3o completa
  document.getElementById('studyModalDescCompleta').textContent =
    descricaoCompleta || descricao || '';

  // Tecnologias
  const tecContainer = document.getElementById('studyModalTecnologias');
  if (tecnologias.length > 0) {
    tecContainer.innerHTML = tecnologias
      .map(tec => `<span class="tag">${escapeHTML(tec)}</span>`)
      .join('');
  } else {
    tecContainer.innerHTML = '';
  }

  // Link "Ver estudo"
  const verBtn = document.getElementById('studyModalVerBtn');
  if (link && link !== '#') {
    verBtn.href = link;
    verBtn.style.display = 'inline-flex';
  } else {
    verBtn.style.display = 'none';
  }

  // Link "Ver no GitHub"
  const repoBtn = document.getElementById('studyModalRepoBtn');
  if (github) {
    repoBtn.href = github;
    repoBtn.style.display = 'inline-flex';
  } else {
    repoBtn.style.display = 'none';
  }
}

function initStudyModalHandlers() {
  const modal = document.getElementById('studyModal');
  if (!modal) return;

  modal.querySelectorAll('[data-close-modal]').forEach(el => {
    el.addEventListener('click', closeStudyModal);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
      closeStudyModal();
    }
  });

  const modalContent = modal.querySelector('.modal-content');
  if (modalContent) {
    modalContent.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }
}

// ===============================
// INICIALIZACAO DE ESTUDOS
// ===============================

export function initStudies() {
  // Inicializa handlers do modal para qualquer p\u00e1gina que tenha o modal
  if (document.getElementById('studyModal')) {
    initStudyModalHandlers();
  }

  // Index.html - Estudos em destaque
  if (document.getElementById('featuredStudiesGrid')) {
    loadFeaturedStudies();
  }

  // estudos.html - Todos os estudos
  if (document.getElementById('studiesGrid')) {
    loadAllStudies();
  }
}
