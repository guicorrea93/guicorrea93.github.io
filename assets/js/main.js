// ===============================
// Topbar + Ano (todas as páginas)
// ===============================
function setYear(){
  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();
}

function setTopbar(){
  const page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const isActive = (file) => (page === file ? 'active' : '');

  const html = `
    <nav class="nav">
      <div class="brand">Guilherme <b>Corrêa</b></div>
      <div class="menu">
        <a class="${isActive('index.html')}" href="index.html">Início</a>
        <a class="${isActive('projetos.html')}" href="projetos.html">Projetos</a>
      </div>
    </nav>
  `;

  const el = document.getElementById('topbar');
  if (el) el.innerHTML = html;
}

// ===============================
// Projetos (somente projetos.html)
// ===============================
async function loadProjects(){
  const grid = document.getElementById('projectsGrid');
  if (!grid) return; // não está na página de projetos

  try{
    const resp = await fetch('data/projetos.json', { cache: 'no-store' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const projects = await resp.json();

    renderProjects(projects, 'all');
    bindFilters(projects);

  }catch(err){
    grid.innerHTML = `
      <div class="card">
        <div class="card-title">Erro ao carregar projetos</div>
        <div class="card-sub muted">
          Verifique o caminho <b>data/projetos.json</b> e se o arquivo está com JSON válido.
          <br/>Detalhe: ${String(err)}
        </div>
      </div>
    `;
  }
}

function renderProjects(projects, filter){
  const grid = document.getElementById('projectsGrid');
  if (!grid) return;

  const filtered = (filter === 'all')
    ? projects
    : projects.filter(p => (p.tipo || '').toLowerCase() === filter.toLowerCase());

  if (!filtered.length){
    grid.innerHTML = `
      <div class="card">
        <div class="card-title">Nenhum projeto encontrado</div>
        <div class="card-sub muted">Tente outro filtro.</div>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map(p => projectCard(p)).join('');
}

function projectCard(p){
  const tags = Array.isArray(p.tags) ? p.tags : [];
  const ver = p.links?.ver || '#';
  const repo = p.links?.repo || '#';

  return `
    <article class="pcard">
      <div class="p-top">
        <h3 class="p-title">${escapeHTML(p.titulo || 'Projeto')}</h3>
        <span class="p-type">${escapeHTML(p.tipo || 'Projeto')}</span>
      </div>

      <p class="p-desc">${escapeHTML(p.descricao || '')}</p>

      <div class="tags">
        ${tags.slice(0, 6).map(t => `<span class="tag">${escapeHTML(t)}</span>`).join('')}
      </div>

      <div class="p-actions">
        <a class="btn small primary" href="${ver}" target="_blank" rel="noopener">Ver</a>
        <a class="btn small ghost" href="${repo}" target="_blank" rel="noopener">Repositório</a>
      </div>
    </article>
  `;
}

function bindFilters(projects){
  const chips = document.querySelectorAll('.chip');
  if (!chips.length) return;

  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      chips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');

      const filter = chip.getAttribute('data-filter') || 'all';
      renderProjects(projects, filter);
    });
  });
}

// Segurança básica para evitar injeção no HTML
function escapeHTML(str){
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

// ===============================
// Boot
// ===============================
setTopbar();
setYear();
loadProjects();
