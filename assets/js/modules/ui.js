// ===============================
// UI: LOADING, ERROR, ANIMACOES
// ===============================

import { escapeHTML } from './utils.js';

// ===============================
// LOADING STATE
// ===============================

export function showLoading(element, message = 'Carregando...') {
  if (!element) return;

  element.innerHTML = `
    <div class="card" style="text-align: center; padding: 2rem;">
      <div class="card-title" style="color: var(--text-2);">
        ${escapeHTML(message)}
      </div>
      <div style="margin-top: 1rem;">
        <div style="display: inline-block; width: 2rem; height: 2rem; border: 3px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
      </div>
    </div>
  `;

  // Adiciona animacao se nao existir
  if (!document.getElementById('spin-animation')) {
    const style = document.createElement('style');
    style.id = 'spin-animation';
    style.textContent = `
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }
}

export function showError(element, errorMessage, details = '') {
  if (!element) return;

  element.innerHTML = `
    <div class="card" style="border-color: rgba(239, 68, 68, 0.3);">
      <div class="card-title" style="color: #EF4444;">
        \u26A0\uFE0F ${escapeHTML(errorMessage)}
      </div>
      <div class="card-sub muted">
        ${escapeHTML(details)}
      </div>
      <div style="margin-top: 1rem;">
        <button class="btn small primary" onclick="location.reload()">
          Tentar novamente
        </button>
      </div>
    </div>
  `;
}

// ===============================
// ANIMACAO GENERICA DE CARDS
// ===============================

export function animateCards(container, selectors = '.featured-card, .pcard-with-thumb') {
  setTimeout(() => {
    container.querySelectorAll(selectors).forEach((card, index) => {
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
