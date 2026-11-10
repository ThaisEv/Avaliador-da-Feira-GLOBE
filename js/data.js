// Os arquivos oficiais vêm da rede ou do cache do Service Worker; o catálogo local
// só é usado como fallback para manter cadastros publicados disponíveis offline.
const loadCatalogFile = (file, key) => fetch(`./data/${file}`).then(response => {
  if (!response.ok) throw new Error(`${key} indisponível`);
  return response.json();
}).then(data => data[key]);

window.GLOBE_DATA_READY = Promise.all([
  loadCatalogFile('trabalhos.json', 'works'),
  loadCatalogFile('criterios.json', 'criteria'),
  loadCatalogFile('avaliadores.json', 'evaluators')
]).catch(async error => {
  try {
    const cached = JSON.parse(localStorage.getItem('globe-catalog') || 'null');
    if (cached && Array.isArray(cached.works) && Array.isArray(cached.evaluators)) {
      return [cached.works, cached.criteria || [], cached.evaluators];
    }
  } catch (_) { /* fallback inválido: preserva o erro original */ }
  throw error;
}).then(async ([works, criteria, evaluators]) => {
  let catalog = { works, criteria, evaluators };
  const endpoint = (window.GLOBE_CONFIG && window.GLOBE_CONFIG.appsScriptUrl || '').trim();
  if (endpoint && navigator.onLine) {
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'catalog' }) });
      const remote = await response.json();
      if (response.ok && remote.ok && Array.isArray(remote.works) && Array.isArray(remote.evaluators)) {
        catalog = { ...catalog, works: remote.works, evaluators: remote.evaluators, criteria: remote.criteria?.length ? remote.criteria : catalog.criteria };
        localStorage.setItem('globe-catalog', JSON.stringify({ works: catalog.works, evaluators: catalog.evaluators }));
      }
    } catch (_) { /* mantém catálogo local para operação offline */ }
  }
  window.GLOBE_DATA = catalog;
  return window.GLOBE_DATA;
});
