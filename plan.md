# Plano: Seção "Estudos" no Portfolio

## Resumo
Criar seção "Estudos" entre Certificados e Livros, com página dedicada, JSON de dados e integração completa no padrão existente.

## Passos

### 1. Backup do index.html
- Copiar `index.html` para `index.html.bak`

### 2. Criar `data/estudos.json`
- Array vazio `[]` como ponto de partida
- Estrutura de cada item:
  ```json
  {
    "id": "nome-do-estudo",
    "titulo": "Nome do Estudo",
    "plataforma": "Alura / Udemy / etc",
    "descricao": "Descrição curta",
    "thumbnail": "assets/img/estudos/thumb.webp",
    "tecnologias": ["Python", "Pandas"],
    "link": "https://link-do-projeto",
    "destaque": false
  }
  ```

### 3. Adicionar seção no `index.html`
- Inserir entre `#certificados` e `#livros`
- Seguir padrão: `<section id="estudos">` com `.pagehead`, grid `#featuredStudiesGrid`, e `.section-actions`
- Botão "Ver todos os estudos" → `estudos.html`

### 4. Criar `estudos.html`
- Página dedicada seguindo padrão de `projetos.html`
- Filtros por plataforma/tecnologia
- Grid com todos os estudos
- Modal para detalhes

### 5. Adicionar JS no `main.js`
- `estudosPath` no CONFIG
- `loadFeaturedStudies()` — carrega destaques no index
- `renderFeaturedStudies()` — renderiza cards
- `createFeaturedStudyCard()` — HTML do card (thumbnail, título, plataforma, tecnologias, descrição, link)
- `loadAllStudies()` — para página dedicada
- `initStudies()` — inicialização
- Chamar `initStudies()` no `init()`

### 6. Adicionar CSS no `styles.css`
- `.featured-studies` grid (padrão 340px minmax)
- `.featured-study-card` com tema de cor próprio (azul? para diferenciar de certificados/livros)
- Hover, badge, thumb, body, footer — seguindo o padrão

### 7. Atualizar navegação
- Adicionar link "Estudos" no menu do `main.js` (entre Certificados e Livros)
- Adicionar breadcrumb na `estudos.html`
- Atualizar `sitemap.xml`
