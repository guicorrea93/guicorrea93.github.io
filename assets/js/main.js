const topbarHTML = `
  <nav class="nav">
    <div class="brand">Guilherme <b>Corrêa</b></div>
    <div class="menu">
      <a href="index.html">Início</a>
      <a href="projetos.html">Projetos</a>
    </div>
  </nav>
`;

const el = document.getElementById('topbar');
if (el) el.innerHTML = topbarHTML;
