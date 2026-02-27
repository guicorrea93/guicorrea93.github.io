// ===============================
// LIVROS - GERENCIAMENTO COMPLETO
// ===============================

import { CONFIG } from './config.js';
import { escapeHTML, makeCardAccessible, announceToScreenReader, debounce } from './utils.js';
import { fetchWithRetry } from './api.js';
import { showLoading, showError } from './ui.js';

let allBooks = [];
let currentBook = null;

// ===============================
// CRIA RATING DE ESTRELAS
// ===============================

function createStarRating(rating) {
  const maxStars = 5;
  let stars = '';

  for (let i = 1; i <= maxStars; i++) {
    const filled = i <= rating;
    stars += `
      <svg class="star ${filled ? '' : 'empty'}" viewBox="0 0 24 24" fill="${filled ? 'currentColor' : 'none'}">
        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
              stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
      </svg>
    `;
  }

  return stars;
}

// ===============================
// CARREGA LIVROS EM DESTAQUE (INDEX)
// ===============================

async function loadFeaturedBooks() {
  const grid = document.getElementById('featuredBooksGrid');
  if (!grid) return;

  showLoading(grid, 'Carregando livros...');

  try {
    const books = await fetchWithRetry(CONFIG.booksPath);

    if (!Array.isArray(books)) {
      throw new Error('Formato de dados invalido');
    }

    allBooks = books;
    const featured = books.filter(b => b.destaque === true);

    if (!featured.length) {
      grid.innerHTML = `
        <div class="card">
          <div class="card-title">Nenhum livro em destaque</div>
          <div class="card-sub muted">
            Configure livros com "destaque": true no arquivo JSON.
          </div>
        </div>
      `;
      return;
    }

    renderFeaturedBooks(featured, grid);

  } catch (error) {
    console.error('Erro ao carregar livros:', error);
    showError(grid, 'Erro ao carregar livros', `Detalhes: ${error.message}`);
  }
}

// ===============================
// RENDERIZA LIVROS EM DESTAQUE
// ===============================

function renderFeaturedBooks(books, container) {
  const fragment = document.createDocumentFragment();
  const tempDiv = document.createElement('div');

  books.forEach(book => {
    tempDiv.innerHTML = createFeaturedBookCard(book);
    const card = tempDiv.firstElementChild;
    makeCardAccessible(card, () => openBookModal(book));
    fragment.appendChild(card);
  });

  container.innerHTML = '';
  container.appendChild(fragment);
  animateBookCards(container);
}

// ===============================
// CRIA CARD DE LIVRO EM DESTAQUE
// ===============================

function createFeaturedBookCard(book) {
  const {
    id,
    titulo,
    autor,
    capa,
    anoLeitura,
    avaliacao = 5,
    paginas,
    destaque,
    generos = [],
    colecao
  } = book;

  const genreClass = generos.length > 0
    ? `genre-${generos[0].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}`
    : '';

  const badge = destaque
    ? '<span class="book-badge">\u2B50 Destaque</span>'
    : '';

  const stars = createStarRating(avaliacao);

  const collectionBadge = colecao
    ? `<span class="book-collection-badge">\uD83D\uDCDA ${escapeHTML(colecao)}</span>`
    : '';

  return `
    <article class="featured-book-card ${genreClass}" data-book-id="${id}">
      ${badge}
      <img
        src="${capa || 'assets/img/livros/placeholder-book.webp'}"
        alt="Capa de ${escapeHTML(titulo)}"
        class="featured-book-cover"
        loading="lazy"
      />
      <div class="featured-book-body">
        <h3 class="featured-book-title">${escapeHTML(titulo)}</h3>

        <div class="featured-book-author">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M8 7C9.65685 7 11 5.65685 11 4C11 2.34315 9.65685 1 8 1C6.34315 1 5 2.34315 5 4C5 5.65685 6.34315 7 8 7Z"
                  stroke="currentColor" stroke-width="1.5"/>
            <path d="M14 15C14 12.2386 11.3137 10 8 10C4.68629 10 2 12.2386 2 15"
                  stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          ${escapeHTML(autor)}
        </div>

        ${collectionBadge}

        <div class="featured-book-rating">
          ${stars}
        </div>

        <div class="featured-book-footer">
          <span class="book-year">${anoLeitura}</span>
          ${paginas ? `
            <span class="book-pages">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <path d="M4 2H12C12.5304 2 13.0391 2.21071 13.4142 2.58579C13.7893 2.96086 14 3.46957 14 4V14L8 11L2 14V4C2 3.46957 2.21071 2.96086 2.58579 2.58579C2.96086 2.21071 3.46957 2 4 2Z"
                      stroke="currentColor" stroke-width="1.5"/>
              </svg>
              ${paginas}p
            </span>
          ` : ''}
        </div>
      </div>
    </article>
  `;
}

// ===============================
// CARREGA TODOS OS LIVROS (livros.html)
// ===============================

async function loadAllBooks() {
  const grid = document.getElementById('booksGrid');
  if (!grid) return;

  showLoading(grid, 'Carregando biblioteca...');

  try {
    const books = await fetchWithRetry(CONFIG.booksPath);

    if (!Array.isArray(books)) {
      throw new Error('Formato de dados invalido');
    }

    allBooks = books;

    // Gera estatisticas
    generateBookStats(books);

    // Gera filtros dinamicos
    generateBookFilters(books);

    // Inicializa busca
    initBookSearch(books);

    // Renderiza todos inicialmente
    renderAllBooks(books, 'all', '');

    // Inicializa handlers do modal
    initBookModalHandlers();

  } catch (error) {
    console.error('Erro ao carregar livros:', error);
    showError(grid, 'Erro ao carregar livros', `Detalhes: ${error.message}`);
  }
}

// ===============================
// RENDERIZA TODOS OS LIVROS
// ===============================

function renderAllBooks(books, filter = 'all', searchTerm = '') {
  const grid = document.getElementById('booksGrid');
  if (!grid) return;

  let filtered = books;

  // Aplica filtro de genero/colecao
  if (filter !== 'all') {
    filtered = filtered.filter(book => {
      const generos = (book.generos || []).map(g => g.toLowerCase());
      const colecao = (book.colecao || '').toLowerCase();
      const filterLower = filter.toLowerCase();

      return generos.includes(filterLower) || colecao === filterLower;
    });
  }

  // Aplica busca textual
  if (searchTerm) {
    const searchLower = searchTerm.toLowerCase();

    filtered = filtered.filter(book => {
      const titulo = (book.titulo || '').toLowerCase();
      const autor = (book.autor || '').toLowerCase();
      const colecao = (book.colecao || '').toLowerCase();
      const generos = (book.generos || []).join(' ').toLowerCase();
      const tags = (book.tags || []).join(' ').toLowerCase();

      return titulo.includes(searchLower) ||
             autor.includes(searchLower) ||
             colecao.includes(searchLower) ||
             generos.includes(searchLower) ||
             tags.includes(searchLower);
    });
  }

  // Mostra mensagem se nao encontrou nada
  if (!filtered.length) {
    const message = searchTerm
      ? `Nenhum livro encontrado para "${escapeHTML(searchTerm)}"`
      : 'Nenhum livro encontrado';

    const suggestion = searchTerm
      ? 'Tente outro termo de busca ou limpe o filtro.'
      : 'Tente outro filtro.';

    grid.innerHTML = `
      <div class="card">
        <div class="card-title">${message}</div>
        <div class="card-sub muted">${suggestion}</div>
        ${searchTerm ? `
          <button class="btn small primary" onclick="document.getElementById('bookSearch').value = ''; document.getElementById('bookSearch').dispatchEvent(new Event('input'));" style="margin-top: 1rem;">
            Limpar busca
          </button>
        ` : ''}
      </div>
    `;
    return;
  }

  // Renderiza livros
  const fragment = document.createDocumentFragment();
  const tempDiv = document.createElement('div');

  filtered.forEach(book => {
    tempDiv.innerHTML = createBookCard(book);
    const card = tempDiv.firstElementChild;
    makeCardAccessible(card, () => openBookModal(book));
    fragment.appendChild(card);
  });

  grid.innerHTML = '';
  grid.appendChild(fragment);
  animateBookCards(grid);

  // Anuncia resultado para leitores de tela
  announceToScreenReader(`${filtered.length} livro${filtered.length !== 1 ? 's' : ''} encontrado${filtered.length !== 1 ? 's' : ''}`);
}

// ===============================
// CRIA CARD DE LIVRO
// ===============================

function createBookCard(book) {
  const {
    id,
    titulo,
    autor,
    capa,
    anoLeitura,
    avaliacao = 5,
    generos = [],
    colecao,
    destaque
  } = book;

  const genreClass = generos.length > 0
    ? `genre-${generos[0].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}`
    : '';

  const destaqueBadge = destaque
    ? '<span class="book-badge">\u2B50 Destaque</span>'
    : '';

  const stars = createStarRating(avaliacao);

  const collectionBadge = colecao
    ? `<span class="book-collection-badge">\uD83D\uDCDA ${escapeHTML(colecao)}</span>`
    : '';

  return `
    <article class="book-card ${genreClass}" data-book-id="${id}">
      ${destaqueBadge}
      <img
        src="${capa || 'assets/img/livros/placeholder-book.webp'}"
        alt="Capa de ${escapeHTML(titulo)}"
        class="book-cover"
        loading="lazy"
      />
      <div class="book-card-body">
        <h3 class="book-title">${escapeHTML(titulo)}</h3>
        <div class="book-author">${escapeHTML(autor)}</div>
        ${collectionBadge}
        <div class="featured-book-rating">
          ${stars}
        </div>
        <div class="featured-book-footer">
          <span class="book-year">${anoLeitura}</span>
        </div>
      </div>
    </article>
  `;
}

// ===============================
// GERA ESTATISTICAS
// ===============================

function generateBookStats(books) {
  const statsContainer = document.getElementById('bookStats');
  if (!statsContainer) return;

  const totalBooks = books.length;
  const totalPages = books.reduce((sum, book) => sum + (book.paginas || 0), 0);
  const uniqueAuthors = new Set(books.map(b => b.autor)).size;
  const avgRating = (books.reduce((sum, book) => sum + (book.avaliacao || 0), 0) / totalBooks).toFixed(1);

  statsContainer.innerHTML = `
    <div class="book-stats-grid">
      <div class="book-stat-card">
        <svg class="book-stat-icon" viewBox="0 0 24 24" fill="none">
          <path d="M4 19.5C4 18.837 4.26339 18.2011 4.73223 17.7322C5.20107 17.2634 5.83696 17 6.5 17H20" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M6.5 2H20V22H6.5C5.83696 22 5.20107 21.7366 4.73223 21.2678C4.26339 20.7989 4 20.163 4 19.5V4.5C4 3.83696 4.26339 3.20107 4.73223 2.73223C5.20107 2.26339 5.83696 2 6.5 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <div class="book-stat-number">${totalBooks}</div>
        <div class="book-stat-label">Livros Lidos</div>
      </div>

      <div class="book-stat-card">
        <svg class="book-stat-icon" viewBox="0 0 24 24" fill="none">
          <path d="M12 20H21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M16.5 3.5C16.8978 3.10217 17.4374 2.87868 18 2.87868C18.2786 2.87868 18.5544 2.93355 18.8118 3.04015C19.0692 3.14674 19.303 3.30301 19.5 3.5C19.697 3.69698 19.8533 3.93083 19.9599 4.18819C20.0665 4.44556 20.1214 4.72141 20.1214 5C20.1214 5.27859 20.0665 5.55444 19.9599 5.81181C19.8533 6.06917 19.697 6.30302 19.5 6.5L7 19L3 20L4 16L16.5 3.5Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <div class="book-stat-number">${uniqueAuthors}</div>
        <div class="book-stat-label">Autores</div>
      </div>

      <div class="book-stat-card">
        <svg class="book-stat-icon" viewBox="0 0 24 24" fill="none">
          <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M14 2V8H20" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <div class="book-stat-number">${totalPages.toLocaleString()}</div>
        <div class="book-stat-label">Paginas</div>
      </div>

      <div class="book-stat-card">
        <svg class="book-stat-icon" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
        </svg>
        <div class="book-stat-number">${avgRating}</div>
        <div class="book-stat-label">Media</div>
      </div>
    </div>
  `;
}

// ===============================
// GERA FILTROS DINAMICOS
// ===============================

function generateBookFilters(books) {
  const filtersSection = document.getElementById('bookFilters');
  if (!filtersSection) return;

  // Coleta generos e colecoes unicos
  const generos = new Set();
  const colecoes = new Set();

  books.forEach(book => {
    if (book.generos) book.generos.forEach(g => generos.add(g));
    if (book.colecao) colecoes.add(book.colecao);
  });

  const totalCount = books.length;

  // Gera HTML dos chips
  const chipsHTML = [
    `<button class="chip active" data-filter="all" aria-label="Mostrar todos os livros">
      Todos <span style="opacity: 0.7; font-size: 0.75em; margin-left: 4px;">(${totalCount})</span>
    </button>`,

    ...Array.from(generos).sort().map(genero => {
      const count = books.filter(b => b.generos && b.generos.includes(genero)).length;
      return `<button class="chip" data-filter="${genero}" aria-label="Filtrar ${genero}">
        ${genero} <span style="opacity: 0.7; font-size: 0.75em; margin-left: 4px;">(${count})</span>
      </button>`;
    }),

    ...Array.from(colecoes).sort().map(colecao => {
      const count = books.filter(b => b.colecao === colecao).length;
      return `<button class="chip" data-filter="${colecao}" aria-label="Filtrar ${colecao}">
        \uD83D\uDCDA ${colecao} <span style="opacity: 0.7; font-size: 0.75em; margin-left: 4px;">(${count})</span>
      </button>`;
    })
  ].join('');

  filtersSection.innerHTML = chipsHTML;

  // Re-bind eventos
  bindBookFilters(books);
}

// ===============================
// BIND DE FILTROS
// ===============================

function bindBookFilters(books) {
  const chips = document.querySelectorAll('.chip');
  const searchInput = document.getElementById('bookSearch');

  if (!chips.length) return;

  chips.forEach(chip => {
    chip.addEventListener('click', function() {
      chips.forEach(c => c.classList.remove('active'));
      this.classList.add('active');

      const filter = this.getAttribute('data-filter') || 'all';
      const searchTerm = searchInput ? searchInput.value.trim() : '';

      renderAllBooks(books, filter, searchTerm);
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
// BUSCA TEXTUAL
// ===============================

function initBookSearch(books) {
  const searchInput = document.getElementById('bookSearch');
  if (!searchInput) return;

  const handleSearch = debounce((searchTerm) => {
    const activeChip = document.querySelector('.chip.active');
    const currentFilter = activeChip ? activeChip.getAttribute('data-filter') : 'all';

    renderAllBooks(books, currentFilter, searchTerm);
  }, 300);

  searchInput.addEventListener('input', (e) => {
    handleSearch(e.target.value.trim());
  });

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      searchInput.value = '';
      handleSearch('');
      searchInput.blur();
    }
  });
}

// ===============================
// MODAL DE LIVRO
// ===============================

export function openBookModal(book) {
  currentBook = book;

  const modal = document.getElementById('bookModal');
  if (!modal) return;

  populateBookModal(book);

  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');

  setTimeout(() => {
    const closeBtn = modal.querySelector('.modal-close');
    if (closeBtn) closeBtn.focus();
  }, 100);
}

export function closeBookModal() {
  const modal = document.getElementById('bookModal');
  if (!modal) return;

  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
  currentBook = null;
}

function populateBookModal(book) {
  const {
    titulo,
    tituloOriginal,
    autor,
    capa,
    anoLeitura,
    mesLeitura,
    avaliacao = 5,
    generos = [],
    colecao,
    volumeColecao,
    sinopse,
    sinopseCompleta,
    paginas,
    tempoLeitura,
    tags = [],
    citacaoFavorita,
    porqueLer = [],
    aprendizados = []
  } = book;

  // Capa
  document.getElementById('bookModalCapa').src = capa || 'assets/img/livros/placeholder-book.webp';
  document.getElementById('bookModalCapa').alt = `Capa de ${titulo}`;

  // Rating
  document.getElementById('bookModalRating').innerHTML = createStarRating(avaliacao);

  // Header
  if (generos.length > 0) {
    document.getElementById('bookModalGenero').textContent = generos[0];
  }

  if (colecao) {
    const colecaoEl = document.getElementById('bookModalColecao');
    colecaoEl.textContent = volumeColecao
      ? `${colecao} - Vol. ${volumeColecao}`
      : colecao;
    colecaoEl.style.display = 'inline-flex';
  } else {
    document.getElementById('bookModalColecao').style.display = 'none';
  }

  document.getElementById('bookModalTitle').textContent = titulo;

  if (tituloOriginal) {
    document.getElementById('bookModalTituloOriginal').textContent = tituloOriginal;
    document.getElementById('bookModalTituloOriginal').style.display = 'block';
  } else {
    document.getElementById('bookModalTituloOriginal').style.display = 'none';
  }

  // Meta info
  document.getElementById('bookModalAutor').textContent = autor;
  document.getElementById('bookModalLeitura').textContent = mesLeitura
    ? `${mesLeitura} de ${anoLeitura}`
    : anoLeitura;

  if (paginas) {
    document.getElementById('bookModalPaginas').textContent = paginas;
    document.getElementById('bookModalPaginasContainer').style.display = 'flex';
  } else {
    document.getElementById('bookModalPaginasContainer').style.display = 'none';
  }

  if (tempoLeitura) {
    document.getElementById('bookModalTempo').textContent = tempoLeitura;
    document.getElementById('bookModalTempoContainer').style.display = 'flex';
  } else {
    document.getElementById('bookModalTempoContainer').style.display = 'none';
  }

  document.getElementById('bookModalSinopse').textContent = sinopse;

  // Sinopse completa
  document.getElementById('bookModalSinopseCompleta').textContent = sinopseCompleta || sinopse;

  // Citacao
  const quoteSection = document.getElementById('bookModalQuoteSection');
  if (citacaoFavorita) {
    document.getElementById('bookModalQuote').textContent = citacaoFavorita;
    quoteSection.style.display = 'block';
  } else {
    quoteSection.style.display = 'none';
  }

  // Tags
  const tagsContainer = document.getElementById('bookModalTags');
  if (tags.length > 0) {
    tagsContainer.innerHTML = tags
      .map(tag => `<span class="tag">${escapeHTML(tag)}</span>`)
      .join('');
  } else {
    tagsContainer.innerHTML = '<p style="color: var(--muted); font-size: 0.875rem;">Nenhuma tag</p>';
  }

  // Por que ler
  const porqueSection = document.getElementById('bookModalPorqueSection');
  const porqueList = document.getElementById('bookModalPorque');
  if (porqueLer.length > 0) {
    porqueList.innerHTML = porqueLer
      .map(item => `<li>${escapeHTML(item)}</li>`)
      .join('');
    porqueSection.style.display = 'block';
  } else {
    porqueSection.style.display = 'none';
  }

  // Aprendizados
  const aprendizadosSection = document.getElementById('bookModalAprendizadosSection');
  const aprendizadosList = document.getElementById('bookModalAprendizados');
  if (aprendizados.length > 0) {
    aprendizadosList.innerHTML = aprendizados
      .map(item => `<li>${escapeHTML(item)}</li>`)
      .join('');
    aprendizadosSection.style.display = 'block';
  } else {
    aprendizadosSection.style.display = 'none';
  }
}

function initBookModalHandlers() {
  const modal = document.getElementById('bookModal');
  if (!modal) return;

  modal.querySelectorAll('[data-close-book-modal]').forEach(el => {
    el.addEventListener('click', closeBookModal);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
      closeBookModal();
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
// ANIMACAO DOS CARDS
// ===============================

function animateBookCards(container) {
  setTimeout(() => {
    container.querySelectorAll('.featured-book-card, .book-card').forEach((card, index) => {
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
// INICIALIZACAO DE LIVROS
// ===============================

export function initBooks() {
  // Index.html - Livros em destaque
  if (document.getElementById('featuredBooksGrid')) {
    loadFeaturedBooks();
  }

  // livros.html - Todos os livros
  if (document.getElementById('booksGrid')) {
    loadAllBooks();
  }

  // Inicializa modal em qualquer pagina que o tenha
  if (document.getElementById('bookModal')) {
    initBookModalHandlers();
  }
}
