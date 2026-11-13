// ===============================
// UTILITARIOS
// ===============================

// Debounce para otimizar eventos
export function debounce(func, wait) {
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

// Torna um card acessivel por teclado (Enter/Space abrem o modal)
export function makeCardAccessible(card, handler) {
  card.setAttribute('tabindex', '0');
  card.setAttribute('role', 'button');
  card.addEventListener('click', handler);
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handler();
    }
  });
}

// Escape HTML para seguranca (tambem serve dentro de atributos: escapa aspas)
export function escapeHTML(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Texto com **negrito** vindo do JSON: escapa tudo primeiro, depois formata.
// Linhas so com "---" sao removidas e quebras de linha viram <br>.
export function richText(str) {
  return escapeHTML(str)
    .split('\n')
    .filter(linha => linha.trim() !== '---')
    .join('\n')
    .trim()
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
}

// Anuncia mensagem para leitores de tela
export function announceToScreenReader(message) {
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
export function manageFocus() {
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
