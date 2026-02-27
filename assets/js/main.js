// ===============================
// MAIN.JS - ENTRY POINT (ES6 MODULES)
// ===============================

// --- Utils ---
import { debounce, manageFocus } from './modules/utils.js';

// --- UI ---
// (imported by other modules internally, no direct use here)

// --- Navigation & Interactions ---
import {
  setTopbar,
  setYear,
  initSmoothScroll,
  initScrollSpy,
  initLazyLoading,
  updateHeroScale,
  initTimelineToggle,
  initWorkProcessToggle,
  initComoTrabalho,
  initSearchClear
} from './modules/navigation.js';

// --- Projects ---
import { initProjects, openProjectModal, closeProjectModal } from './modules/projects.js';

// --- Certificates ---
import { initCertificates, openCertificateModal, closeCertificateModal } from './modules/certificates.js';

// --- Diplomas ---
import { initDiplomas, openDiplomaModal, closeDiplomaModal } from './modules/diplomas.js';

// --- Books ---
import { initBooks, openBookModal, closeBookModal } from './modules/books.js';

// --- Studies ---
import { initStudies } from './modules/studies.js';

// ===============================
// NAMESPACE GLOBAL (para onclick inline no HTML gerado)
// ===============================

window.portfolioApp = {
  openProjectModal,
  closeProjectModal,
  openCertificateModal,
  closeCertificateModal,
  openDiplomaModal,
  closeDiplomaModal,
  openBookModal,
  closeBookModal
};

// ===============================
// COMO TRABALHO - listeners extras
// (o original chamava initComoTrabalho em DOMContentLoaded e load)
// ===============================

document.addEventListener('DOMContentLoaded', initComoTrabalho);
window.addEventListener('load', initComoTrabalho);

// ===============================
// INICIALIZA\u00c7\u00c3O PRINCIPAL
// ===============================

function init() {
  try {
    setTopbar();
    setYear();
    initSmoothScroll();
    initScrollSpy();
    initLazyLoading();
    manageFocus();
    initTimelineToggle();
    initWorkProcessToggle();
    initSearchClear();

    // Inicializa projetos
    initProjects();

    // Inicializa diplomas
    initDiplomas();

    // Inicializa certificados
    initCertificates();

    // Inicializa estudos
    initStudies();

    // Inicializa livros
    initBooks();

    window.addEventListener('hashchange', manageFocus);

  } catch (error) {
    console.error('Erro na inicializa\u00e7\u00e3o:', error);
  }

  updateHeroScale();
  window.addEventListener('resize', debounce(updateHeroScale, 80));
}

// Executa quando o DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
