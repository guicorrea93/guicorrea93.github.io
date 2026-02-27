// ===============================
// FETCH COM RETRY E CACHE
// ===============================

import { CONFIG } from './config.js';

const cache = new Map();

export async function fetchWithRetry(url, options = {}, retries = CONFIG.maxRetries) {
  // Verifica cache
  const cacheKey = url;
  const cached = cache.get(cacheKey);

  if (cached && (Date.now() - cached.timestamp < CONFIG.cacheTime)) {
    return cached.data;
  }

  // Tenta fazer o fetch
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        ...options,
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Salva no cache
      cache.set(cacheKey, {
        data,
        timestamp: Date.now()
      });

      return data;

    } catch (error) {
      console.warn(`Tentativa ${i + 1}/${retries} falhou:`, error.message);

      if (i === retries - 1) {
        throw error;
      }

      // Aguarda antes de tentar novamente
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}
