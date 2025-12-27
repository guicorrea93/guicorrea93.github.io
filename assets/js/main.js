function setYear(){
  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();
}

function setTopbar(){
  // Detecta a página atual para marcar "active"
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

setTopbar();
setYear();
