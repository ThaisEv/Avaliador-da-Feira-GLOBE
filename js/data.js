// Os cadastros oficiais são arquivos estáticos para uso offline após o primeiro acesso.
window.GLOBE_DATA_READY = Promise.all([
  fetch('./data/trabalhos.json').then(r => { if (!r.ok) throw new Error('Cadastro de trabalhos indisponível'); return r.json(); }),
  fetch('./data/criterios.json').then(r => { if (!r.ok) throw new Error('Critérios indisponíveis'); return r.json(); }),
  fetch('./data/avaliadores.json').then(r => { if (!r.ok) throw new Error('Cadastro de avaliadores indisponível'); return r.json(); })
]).then(async ([works, criteria, evaluators]) => {
  let catalog = { works: works.works, criteria: criteria.criteria, evaluators: evaluators.evaluators };
  try {
    const cached = JSON.parse(localStorage.getItem('globe-catalog') || 'null');
    if (cached && Array.isArray(cached.works) && Array.isArray(cached.evaluators)) catalog = { ...catalog, ...cached };
  } catch (_) { /* cache local inválido: usa os arquivos oficiais */ }
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
