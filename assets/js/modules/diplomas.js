// ===============================
// DIPLOMAS - GERENCIAMENTO COMPLETO
// ===============================

import { CONFIG } from './config.js';
import { escapeHTML, makeCardAccessible } from './utils.js';
import { fetchWithRetry } from './api.js';
import { showLoading, showError } from './ui.js';

let allDiplomas = [];
let currentDiploma = null;

// Expoe allDiplomas globalmente para uso no onclick do timeline
// (renderDiplomaTimeline gera inline onclick que referencia allDiplomas)
function syncGlobals() {
  window.allDiplomas = allDiplomas;
}

// ===============================
// CARREGA DIPLOMAS EM DESTAQUE (INDEX)
// ===============================

async function loadFeaturedDiplomas() {
  const grid = document.getElementById('featuredDiplomasGrid');
  if (!grid) return;

  showLoading(grid, 'Carregando diplomas em destaque...');

  try {
    const diplomas = await fetchWithRetry(CONFIG.diplomasPath);

    if (!Array.isArray(diplomas)) {
      throw new Error('Formato de dados invalido');
    }

    allDiplomas = diplomas;
    syncGlobals();

    // Todos os diplomas sao destaque (sao apenas 3)
    const featured = diplomas.filter(d => d.destaque === true);

    if (!featured.length) {
      grid.innerHTML = `
        <div class="card">
          <div class="card-title">Nenhum diploma cadastrado</div>
          <div class="card-sub muted">
            Adicione diplomas no arquivo data/diplomas.json
          </div>
        </div>
      `;
      return;
    }

    renderFeaturedDiplomas(featured, grid);

  } catch (error) {
    console.error('Erro ao carregar diplomas:', error);
    showError(grid, 'Erro ao carregar diplomas', `Detalhes: ${error.message}`);
  }
}

// ===============================
// RENDERIZA DIPLOMAS EM DESTAQUE
// ===============================

function renderFeaturedDiplomas(diplomas, container) {
  const fragment = document.createDocumentFragment();
  const tempDiv = document.createElement('div');

  diplomas.forEach(diploma => {
    tempDiv.innerHTML = createFeaturedDiplomaCard(diploma);
    const card = tempDiv.firstElementChild;
    makeCardAccessible(card, () => openDiplomaModal(diploma));
    fragment.appendChild(card);
  });

  container.innerHTML = '';
  container.appendChild(fragment);
  animateDiplomaCards(container);
}

// ===============================
// CRIA CARD DE DIPLOMA EM DESTAQUE
// ===============================

function createFeaturedDiplomaCard(diploma) {
  const {
    id,
    titulo,
    instituicao,
    tipo,
    nivel,
    ano,
    descricao,
    thumbnail,
    duracao
  } = diploma;

  const typeColors = {
    'MBA': 'diploma-mba',
    'Especializa\u00e7\u00e3o': 'diploma-especializacao',
    'Gradua\u00e7\u00e3o': 'diploma-graduacao'
  };

  const cardClass = `featured-diploma-card ${typeColors[tipo] || ''}`;

  return `
    <article class="${cardClass}" data-diploma-id="${id}">
      <div class="diploma-seal">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
                fill="currentColor" stroke="currentColor" stroke-width="1.5"/>
        </svg>
      </div>

      <img
        src="${thumbnail || 'assets/img/diplomas/placeholder-diploma.webp'}"
        alt="Preview de ${escapeHTML(titulo)}"
        class="featured-diploma-thumb"
        loading="lazy"
      />

      <div class="featured-diploma-body">
        <div class="featured-diploma-header">
          <h3 class="featured-diploma-title">${escapeHTML(titulo)}</h3>
          <span class="featured-diploma-type">${escapeHTML(tipo)}</span>
        </div>

        <div class="diploma-meta">
          <span class="diploma-meta-item">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 6L8 2L14 6L8 10L2 6Z" stroke="currentColor" stroke-width="1.5"/>
              <path d="M2 10L8 14L14 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            ${escapeHTML(instituicao)}
          </span>

          ${duracao ? `
            <span class="diploma-meta-item">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 14C11.3137 14 14 11.3137 14 8C14 4.68629 11.3137 2 8 2C4.68629 2 2 4.68629 2 8C2 11.3137 4.68629 14 8 14Z" stroke="currentColor" stroke-width="1.5"/>
                <path d="M8 5V8L10 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
              ${escapeHTML(duracao)}
            </span>
          ` : ''}

          ${ano ? `
            <span class="diploma-meta-item">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 2V8L11 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5"/>
              </svg>
              ${escapeHTML(ano)}
            </span>
          ` : ''}
        </div>

        <p class="featured-diploma-desc">${escapeHTML(descricao)}</p>

        <div class="featured-diploma-footer">
          <span class="featured-diploma-nivel">${escapeHTML(nivel)}</span>
          <span class="featured-diploma-link">
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
// CARREGA TODOS OS DIPLOMAS (diplomas.html)
// ===============================

async function loadAllDiplomas() {
  const grid = document.getElementById('diplomasGrid');
  const timeline = document.getElementById('diplomaTimeline');

  if (!grid) return;

  showLoading(grid, 'Carregando diplomas...');

  try {
    const diplomas = await fetchWithRetry(CONFIG.diplomasPath);

    if (!Array.isArray(diplomas)) {
      throw new Error('Formato de dados invalido');
    }

    allDiplomas = diplomas;
    syncGlobals();

    // Renderiza grid
    renderAllDiplomasGrid(diplomas, grid);

    // Renderiza timeline se existir
    if (timeline) {
      renderDiplomaTimeline(diplomas, timeline);
    }

    initDiplomaModalHandlers();

  } catch (error) {
    console.error('Erro ao carregar diplomas:', error);
    showError(grid, 'Erro ao carregar diplomas', `Detalhes: ${error.message}`);
  }
}

// ===============================
// RENDERIZA GRID DE DIPLOMAS
// ===============================

function renderAllDiplomasGrid(diplomas, container) {
  const fragment = document.createDocumentFragment();
  const tempDiv = document.createElement('div');

  diplomas.forEach(diploma => {
    tempDiv.innerHTML = createDiplomaCard(diploma);
    const card = tempDiv.firstElementChild;
    makeCardAccessible(card, () => openDiplomaModal(diploma));
    fragment.appendChild(card);
  });

  container.innerHTML = '';
  container.appendChild(fragment);
  animateDiplomaCards(container);
}

// ===============================
// CRIA CARD DE DIPLOMA
// ===============================

function createDiplomaCard(diploma) {
  const {
    id,
    titulo,
    instituicao,
    tipo,
    nivel,
    ano,
    descricao,
    thumbnail
  } = diploma;

  const typeColors = {
    'MBA': 'diploma-card-mba',
    'Especializa\u00e7\u00e3o': 'diploma-card-especializacao',
    'Gradua\u00e7\u00e3o': 'diploma-card-graduacao'
  };

  const cardClass = `diploma-card-with-thumb ${typeColors[tipo] || ''}`;

  return `
    <article class="${cardClass}" data-diploma-id="${id}">
      <div class="diploma-badge">${escapeHTML(tipo)}</div>

      <img
        src="${thumbnail || 'assets/img/diplomas/placeholder-diploma.webp'}"
        alt="Preview de ${escapeHTML(titulo)}"
        class="diploma-thumb"
        loading="lazy"
      />

      <div class="diploma-card-body">
        <div class="p-top">
          <h3 class="p-title">${escapeHTML(titulo)}</h3>
          <span class="p-type">${escapeHTML(nivel)}</span>
        </div>

        <div class="diploma-meta" style="margin: 0.5rem 0;">
          <span class="diploma-meta-item">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M2 6L8 2L14 6L8 10L2 6Z" stroke="currentColor" stroke-width="1.5"/>
              <path d="M2 10L8 14L14 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            ${escapeHTML(instituicao)}
          </span>

          ${ano ? `
            <span class="diploma-meta-item">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M8 2V8L11 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5"/>
              </svg>
              ${escapeHTML(ano)}
            </span>
          ` : ''}
        </div>

        <p class="p-desc">${escapeHTML(descricao)}</p>
      </div>
    </article>
  `;
}

// ===============================
// RENDERIZA TIMELINE DE DIPLOMAS
// ===============================

function renderDiplomaTimeline(diplomas, container) {
  // Ordena por ano (mais recente primeiro)
  const sorted = [...diplomas].sort((a, b) => {
    const yearA = parseInt(a.ano.split('-').pop());
    const yearB = parseInt(b.ano.split('-').pop());
    return yearB - yearA;
  });

  const timelineHTML = sorted.map((diploma, index) => {
    const side = index % 2 === 0 ? 'left' : 'right';

    return `
      <div class="diploma-timeline-item ${side}">
        <div class="timeline-dot"></div>
        <div class="timeline-card" onclick="window.portfolioApp.openDiplomaModal(allDiplomas.find(d => d.id === '${diploma.id}'))">
          <div class="timeline-year">${escapeHTML(diploma.ano)}</div>
          <h3 class="timeline-title">${escapeHTML(diploma.titulo)}</h3>
          <p class="timeline-institution">${escapeHTML(diploma.instituicao)}</p>
          <span class="timeline-type">${escapeHTML(diploma.tipo)}</span>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = timelineHTML;
}

// ===============================
// ANIMACAO DOS CARDS
// ===============================

function animateDiplomaCards(container) {
  setTimeout(() => {
    container.querySelectorAll('.featured-diploma-card, .diploma-card-with-thumb').forEach((card, index) => {
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
// MODAL DE DIPLOMA
// ===============================

export function openDiplomaModal(diploma) {
  currentDiploma = diploma;

  const modal = document.getElementById('diplomaModal');
  if (!modal) return;

  populateDiplomaModal(diploma);

  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');

  setTimeout(() => {
    const closeBtn = modal.querySelector('.modal-close');
    if (closeBtn) closeBtn.focus();
  }, 100);
}

export function closeDiplomaModal() {
  const modal = document.getElementById('diplomaModal');
  if (!modal) return;

  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
  currentDiploma = null;
}

function populateDiplomaModal(diploma) {
  const {
    titulo,
    instituicao,
    tipo,
    nivel,
    ano,
    duracao,
    descricao,
    descricaoCompleta,
    preview,
    competencias = [],
    destaques = [],
    link,
    status = 'Concluido'
  } = diploma;

  // Header
  document.getElementById('diplomaModalTipo').textContent = tipo;
  document.getElementById('diplomaModalStatus').textContent = status;
  document.getElementById('diplomaModalTitle').textContent = titulo;
  document.getElementById('diplomaModalDesc').textContent = descricao;

  // Info
  document.getElementById('diplomaModalInstituicao').textContent = instituicao;
  if (duracao) document.getElementById('diplomaModalDuracao').textContent = duracao;
  if (ano) document.getElementById('diplomaModalAno').textContent = ano;
  document.getElementById('diplomaModalNivel').textContent = nivel;

  // Preview
  const previewContainer = document.getElementById('diplomaModalPreview');
  if (preview) {
    // Verifica se e PDF ou imagem
    const isPdf = preview.toLowerCase().endsWith('.pdf');

    if (isPdf) {
      previewContainer.innerHTML = `
        <div class="diploma-pdf-preview">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
            <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z"
                  stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M14 2V8H20" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M8 13H16M8 17H16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <p>Documento PDF disponivel</p>
          <a href="${preview}" target="_blank" rel="noopener noreferrer" class="btn small primary">
            Abrir PDF
          </a>
        </div>
      `;
    } else {
      previewContainer.innerHTML = `
        <img
          src="${preview}"
          alt="Preview do diploma ${escapeHTML(titulo)}"
          loading="lazy"
        />
      `;
    }
    previewContainer.style.display = 'block';
  } else {
    previewContainer.style.display = 'none';
  }

  // Descricao completa
  document.getElementById('diplomaModalDescCompleta').textContent =
    descricaoCompleta || descricao;

  // Destaques
  const destaquesSection = document.getElementById('diplomaModalDestaquesSection');
  const destaquesList = document.getElementById('diplomaModalDestaques');
  if (destaques.length > 0) {
    destaquesList.innerHTML = destaques
      .map(d => `<li>${escapeHTML(d)}</li>`)
      .join('');
    destaquesSection.style.display = 'block';
  } else {
    destaquesSection.style.display = 'none';
  }

  // Competencias
  const compContainer = document.getElementById('diplomaModalCompetencias');
  if (competencias.length > 0) {
    compContainer.innerHTML = competencias
      .map(comp => `<span class="tag">${escapeHTML(comp)}</span>`)
      .join('');
  }

  // Link
  const verBtn = document.getElementById('diplomaModalVerBtn');
  if (link) {
    verBtn.href = link;
    verBtn.style.display = 'inline-flex';
  } else {
    verBtn.style.display = 'none';
  }
}

function initDiplomaModalHandlers() {
  const modal = document.getElementById('diplomaModal');
  if (!modal) return;

  modal.querySelectorAll('[data-close-diploma-modal]').forEach(el => {
    el.addEventListener('click', closeDiplomaModal);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
      closeDiplomaModal();
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
// INICIALIZACAO DE DIPLOMAS
// ===============================

export function initDiplomas() {
  // Index.html - Diplomas em destaque
  if (document.getElementById('featuredDiplomasGrid')) {
    loadFeaturedDiplomas();
  }

  // diplomas.html - Todos os diplomas
  if (document.getElementById('diplomasGrid')) {
    loadAllDiplomas();
  }

  // Inicializa modal em qualquer pagina que o tenha
  if (document.getElementById('diplomaModal')) {
    initDiplomaModalHandlers();
  }
}
