// ===============================
// CERTIFICADOS - GERENCIAMENTO COMPLETO
// ===============================

import { CONFIG } from './config.js';
import { escapeHTML, makeCardAccessible, announceToScreenReader, debounce } from './utils.js';
import { fetchWithRetry } from './api.js';
import { showLoading, showError, animateCards } from './ui.js';

let allCertificates = [];
let currentCertificate = null;

// ===============================
// CERTIFICADOS SIMPLES (loadCerts / renderCerts / createCertCard)
// Mantidos por compatibilidade
// ===============================

async function loadCerts() {
  const grid = document.getElementById('certsGrid');
  if (!grid) return;

  showLoading(grid, 'Carregando certificados...');

  try {
    const certs = await fetchWithRetry(CONFIG.certsPath);

    if (!Array.isArray(certs)) {
      throw new Error('Formato de dados invalido');
    }

    renderCerts(certs);

  } catch (error) {
    console.error('Erro ao carregar certificados:', error);
    showError(
      grid,
      'Erro ao carregar certificados',
      `Verifique se o arquivo ${CONFIG.certsPath} existe e esta com JSON valido. Detalhes: ${error.message}`
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

function createCertCard(cert) {
  const {
    titulo = 'Certificado sem t\u00edtulo',
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
// CERTIFICADOS EM DESTAQUE (INDEX)
// ===============================

async function loadFeaturedCertificates() {
  const grid = document.getElementById('featuredCertsGrid');
  if (!grid) return;

  showLoading(grid, 'Carregando certificados em destaque...');

  try {
    const certificates = await fetchWithRetry(CONFIG.certsPath);

    if (!Array.isArray(certificates)) {
      throw new Error('Formato de dados invalido');
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
    makeCardAccessible(card, () => openCertificateModal(cert));
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
    : tipo === 'reposit\u00f3rio'
    ? 'featured-cert-card cert-card-repo'
    : 'featured-cert-card';

  const badge = destaque
    ? '<span class="cert-badge">\u2605 Destaque</span>'
    : '';

  const certCount = (tipo === 'Forma\u00e7\u00e3o' && certificados.length > 0)
    ? `<span class="cert-count-badge">${certificados.length} certificados</span>`
    : '';

  return `
    <article class="${cardClass}" data-cert-id="${id}">
      ${badge}
      ${certCount}
      <img
        src="${
          (tipo === 'Forma\u00e7\u00e3o'
            ? (certificados?.find(c => c.isFormacao)?.preview || thumbnail)
            : thumbnail
          ) || 'assets/img/certificados/placeholder-cert.webp'
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

// ===============================
// CARD UNIFICADO
// ===============================

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
    : tipo === 'reposit\u00f3rio'
    ? 'cert-card-with-thumb cert-card-repo'
    : 'cert-card-with-thumb';

  const destaqueBadge = destaque
    ? '<span class="tag" style="background: rgba(27, 127, 92, 0.2); border-color: rgba(27, 127, 92, 0.4); color: var(--success);">\u2605 Destaque</span>'
    : '';

  const certCount = (tipo === 'Forma\u00e7\u00e3o' && certificados.length > 0)
    ? `<span class="tag" style="background: rgba(59, 130, 246, 0.2); border-color: rgba(59, 130, 246, 0.4); color: #3B82F6;">${certificados.length} certificados</span>`
    : '';

  return `
    <article class="${cardClass}" data-cert-id="${id}">
      <img
        src="${
          (tipo === 'Forma\u00e7\u00e3o'
            ? (certificados?.find(c => c.isFormacao)?.preview || thumbnail)
            : thumbnail
          ) || 'assets/img/certificados/placeholder-cert.webp'
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

// Animacao de entrada dos cards de certificado
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

// ===============================
// GERACAO DINAMICA DE FILTROS
// ===============================

function generateDynamicFilters(certificates) {
  const filtersSection = document.querySelector('.filters');
  if (!filtersSection) return;

  // Coleta categorias unicas e conta certificados
  const categoryCounts = {};

  certificates.forEach(cert => {
    const categoria = cert.categoria || 'Sem Categoria';
    categoryCounts[categoria] = (categoryCounts[categoria] || 0) + 1;
  });

  // Ordena categorias alfabeticamente
  const sortedCategories = Object.keys(categoryCounts).sort();

  // Conta total
  const totalCount = certificates.length;

  // Gera HTML dos chips
  const chipsHTML = [
    // Chip "Todos"
    `<button class="chip active" data-filter="all" aria-label="Mostrar todos os certificados">
      Todos <span style="opacity: 0.7; font-size: 0.75em; margin-left: 4px;">(${totalCount})</span>
    </button>`,

    // Chips por categoria
    ...sortedCategories.map(categoria => {
      const count = categoryCounts[categoria];
      const slug = categoria.toLowerCase().replace(/\s+/g, '-');

      return `<button class="chip" data-filter="${categoria}" aria-label="Filtrar ${categoria}">
        ${categoria} <span style="opacity: 0.7; font-size: 0.75em; margin-left: 4px;">(${count})</span>
      </button>`;
    })
  ].join('');

  filtersSection.innerHTML = chipsHTML;

  // Re-bind eventos
  bindCertFilters(certificates);
}

// ===============================
// RENDERIZACAO INTELIGENTE
// ===============================

function renderAllCertificates(certificates, filter = 'all', searchTerm = '') {
  const grid = document.getElementById('certsGrid');
  if (!grid) return;

  let filtered = certificates;

  // Aplica filtro de categoria
  if (filter !== 'all') {
    filtered = filtered.filter(cert => {
      const categoria = (cert.categoria || '').toLowerCase();
      const filterLower = filter.toLowerCase();

      // Match exato ou parcial
      return categoria === filterLower || categoria.includes(filterLower);
    });
  }

  // Aplica busca textual
  if (searchTerm) {
    const searchLower = searchTerm.toLowerCase();

    filtered = filtered.filter(cert => {
      const titulo = (cert.titulo || '').toLowerCase();
      const instituicao = (cert.instituicao || '').toLowerCase();
      const descricao = (cert.descricao || '').toLowerCase();
      const competencias = (cert.competencias || []).join(' ').toLowerCase();
      const tipo = (cert.tipo || '').toLowerCase();
      const ano = (cert.ano || '').toString();

      return titulo.includes(searchLower) ||
             instituicao.includes(searchLower) ||
             descricao.includes(searchLower) ||
             competencias.includes(searchLower) ||
             tipo.includes(searchLower) ||
             ano.includes(searchLower);
    });
  }

  // Mostra mensagem se nao encontrou nada
  if (!filtered.length) {
    const message = searchTerm
      ? `Nenhum certificado encontrado para "${escapeHTML(searchTerm)}"`
      : 'Nenhum certificado encontrado';

    const suggestion = searchTerm
      ? 'Tente outro termo de busca ou limpe o filtro.'
      : 'Tente outro filtro.';

    grid.innerHTML = `
      <div class="card">
        <div class="card-title">${message}</div>
        <div class="card-sub muted">${suggestion}</div>
        ${searchTerm ? `
          <button class="btn small primary" onclick="document.getElementById('certSearch').value = ''; document.getElementById('certSearch').dispatchEvent(new Event('input'));" style="margin-top: 1rem;">
            Limpar busca
          </button>
        ` : ''}
      </div>
    `;
    return;
  }

  // Renderiza certificados
  const fragment = document.createDocumentFragment();
  const tempDiv = document.createElement('div');

  filtered.forEach(cert => {
    tempDiv.innerHTML = createCertificateCard(cert);
    const card = tempDiv.firstElementChild;
    makeCardAccessible(card, () => openCertificateModal(cert));
    fragment.appendChild(card);
  });

  grid.innerHTML = '';
  grid.appendChild(fragment);
  animateCertCards(grid);

  // Anuncia resultado para leitores de tela
  announceToScreenReader(`${filtered.length} certificado${filtered.length !== 1 ? 's' : ''} encontrado${filtered.length !== 1 ? 's' : ''}`);
}

// ===============================
// BIND DE FILTROS
// ===============================

function bindCertFilters(certificates) {
  const chips = document.querySelectorAll('.chip');
  const searchInput = document.getElementById('certSearch');

  if (!chips.length) return;

  chips.forEach(chip => {
    chip.addEventListener('click', function() {
      // Remove active de todos
      chips.forEach(c => c.classList.remove('active'));

      // Adiciona active no clicado
      this.classList.add('active');

      // Pega filtro e busca atual
      const filter = this.getAttribute('data-filter') || 'all';
      const searchTerm = searchInput ? searchInput.value.trim() : '';

      // Renderiza
      renderAllCertificates(certificates, filter, searchTerm);
    });

    // Suporte para teclado
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
// BUSCA TEXTUAL
// ===============================

function initCertSearch(certificates) {
  const searchInput = document.getElementById('certSearch');
  if (!searchInput) return;

  const handleSearch = debounce((searchTerm) => {
    // Pega filtro ativo
    const activeChip = document.querySelector('.chip.active');
    const currentFilter = activeChip ? activeChip.getAttribute('data-filter') : 'all';

    // Renderiza com filtro + busca
    renderAllCertificates(certificates, currentFilter, searchTerm);
  }, 300);

  searchInput.addEventListener('input', (e) => {
    handleSearch(e.target.value.trim());
  });

  // Limpar busca com ESC
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      searchInput.value = '';
      handleSearch('');
      searchInput.blur();
    }
  });
}

// ===============================
// CARREGAMENTO COMPLETO
// ===============================

async function loadAllCertificates() {
  const grid = document.getElementById('certsGrid');
  if (!grid) return;

  showLoading(grid, 'Carregando certificados...');

  try {
    const certificates = await fetchWithRetry(CONFIG.certsPath);

    if (!Array.isArray(certificates)) {
      throw new Error('Formato de dados invalido');
    }

    allCertificates = certificates;

    // 1. Gera filtros dinamicos com contagem
    generateDynamicFilters(certificates);

    // 2. Inicializa busca
    initCertSearch(certificates);

    // 3. Renderiza todos inicialmente
    renderAllCertificates(certificates, 'all', '');

    // 4. Inicializa handlers do modal
    initCertModalHandlers();

  } catch (error) {
    console.error('Erro ao carregar certificados:', error);
    showError(
      grid,
      'Erro ao carregar certificados',
      `Detalhes: ${error.message}`
    );
  }
}

// ===============================
// HIGHLIGHT DE BUSCA (OPCIONAL)
// ===============================

function highlightSearchTerm(text, searchTerm) {
  if (!searchTerm) return escapeHTML(text);

  const escapedText = escapeHTML(text);
  const escapedTerm = escapeHTML(searchTerm);

  const regex = new RegExp(`(${escapedTerm})`, 'gi');
  return escapedText.replace(regex, '<mark style="background: rgba(242, 140, 40, 0.3); color: var(--accent); padding: 0 2px; border-radius: 2px;">$1</mark>');
}

// ===============================
// ESTATISTICAS
// ===============================

function showCertStatistics(certificates) {
  const statsContainer = document.querySelector('.cert-stats');
  if (!statsContainer) return;

  const total = certificates.length;
  const emDestaque = certificates.filter(c => c.destaque).length;
  const categorias = new Set(certificates.map(c => c.categoria)).size;
  const instituicoes = new Set(certificates.map(c => c.instituicao)).size;

  statsContainer.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-number">${total}</div>
        <div class="stat-label">Total de Certificados</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${categorias}</div>
        <div class="stat-label">Categorias</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${instituicoes}</div>
        <div class="stat-label">Instituicoes</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${emDestaque}</div>
        <div class="stat-label">Em Destaque</div>
      </div>
    </div>
  `;
}

// ===============================
// MODAL DE CERTIFICADO
// ===============================

export function openCertificateModal(cert) {
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

export function closeCertificateModal() {
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
    status = 'Concluido'
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
                src="${c.preview || 'assets/img/certificados/placeholder-cert.webp'}"
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

  // Descricao completa
  document.getElementById('certModalDescCompleta').textContent =
    descricaoCompleta || descricao;

  // Competencias
  const compContainer = document.getElementById('certModalCompetencias');
  if (competencias.length > 0) {
    compContainer.innerHTML = competencias
      .map(comp => `<span class="tag">${escapeHTML(comp)}</span>`)
      .join('');
  } else {
    compContainer.innerHTML = '<p style="color: var(--muted); font-size: 0.875rem;">Nenhuma competencia listada</p>';
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

// ===============================
// INICIALIZACAO DE CERTIFICADOS
// ===============================

export function initCertificates() {
  // Index.html - Certificados em destaque
  if (document.getElementById('featuredCertsGrid')) {
    loadFeaturedCertificates();
  }

  // Certificados.html - Todos os certificados
  if (document.getElementById('certsGrid') &&
      !document.getElementById('featuredCertsGrid')) {
    loadAllCertificates();
  }

  // Inicializa modal em qualquer pagina que o tenha
  if (document.getElementById('certModal')) {
    initCertModalHandlers();
  }
}
