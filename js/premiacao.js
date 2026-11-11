(() => {
  const endpoint = (window.GLOBE_CONFIG && window.GLOBE_CONFIG.appsScriptUrl || '').trim();
  const loginPanel = document.getElementById('loginPanel');
  const awardsPanel = document.getElementById('awardsPanel');
  const keyInput = document.getElementById('awardKey');
  const button = document.getElementById('loadAwardsButton');
  const status = document.getElementById('awardStatus');
  const summary = document.getElementById('awardsSummary');
  const sphereList = document.getElementById('sphereList');
  const medalLabels = ['1º lugar', '2º lugar', '3º lugar'];
  const sphereOrder = ['Atmosfera', 'Biosfera', 'Hidrosfera', 'Pedosfera', 'Terra como sistema'];

  function setStatus(text, state = '') {
    status.textContent = text;
    status.className = `save-message${state ? ` ${state}` : ''}`;
  }

  async function loadData() {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'admin', adminKey: keyInput.value })
    });
    const result = await response.json();
    if (!response.ok || result.ok !== true) throw new Error(result.error || 'Não foi possível carregar os resultados.');
    return result;
  }

  async function loadSpheres() {
    const response = await fetch('./data/projetos_esferas_globe.json');
    if (!response.ok) throw new Error('O cadastro de esferas não está disponível.');
    const projects = await response.json();
    return new Map(projects.map(project => [String(project.numero_projeto), String(project.esfera).trim()]));
  }

  function rankingBySphere(data, spheres) {
    const rankings = window.GLOBE_RANKING.compute(data.works, data.evaluations);
    const groups = new Map();
    rankings.forEach(item => {
      const sphere = spheres.get(String(item.work[1])) || 'Esfera não informada';
      if (!groups.has(sphere)) groups.set(sphere, []);
      groups.get(sphere).push(item);
    });
    return [...groups.entries()].sort(([a], [b]) => {
      const aIndex = sphereOrder.indexOf(a), bIndex = sphereOrder.indexOf(b);
      return (aIndex < 0 ? 99 : aIndex) - (bIndex < 0 ? 99 : bIndex) || a.localeCompare(b, 'pt-BR');
    });
  }

  function projectCard(item, index) {
    const card = document.createElement('article');
    card.className = `award-card award-place-${index + 1}`;
    const medal = document.createElement('img');
    medal.className = 'award-medal';
    medal.src = `./assets/medalhas/${['ouro', 'prata', 'bronze'][index]}.png`;
    medal.alt = `${medalLabels[index] || `${index + 1}º lugar`} da esfera`;
    const content = document.createElement('div');
    content.className = 'award-content';
    const place = document.createElement('span');
    place.className = 'eyebrow';
    place.textContent = medalLabels[index] || `${index + 1}º lugar`;
    const title = document.createElement('h3');
    title.textContent = item.work[3];
    const details = document.createElement('p');
    details.textContent = `${item.work[0]} · ${item.work[4] || 'Instituição não informada'}`;
    const score = document.createElement('strong');
    score.className = 'award-score';
    score.innerHTML = `${item.averageTotal.toFixed(2).replace('.', ',')} <small>/ 28 pontos</small>`;
    content.append(place, title, details, score);
    card.append(medal, content);
    return card;
  }

  function render(data, groups) {
    const evaluated = groups.reduce((total, [, items]) => total + items.length, 0);
    summary.innerHTML = `<strong>${groups.length}</strong><span>esferas com projetos avaliados</span><strong>${evaluated}</strong><span>projetos classificados</span>`;
    sphereList.replaceChildren();
    groups.forEach(([sphere, items]) => {
      const section = document.createElement('section');
      section.className = 'sphere-section';
      const heading = document.createElement('div');
      heading.className = 'sphere-heading';
      const title = document.createElement('div');
      title.innerHTML = `<p class="eyebrow">ESFERA GLOBE</p><h2></h2>`;
      title.querySelector('h2').textContent = sphere;
      const count = document.createElement('span');
      count.textContent = `${items.length} ${items.length === 1 ? 'projeto avaliado' : 'projetos avaliados'}`;
      heading.append(title, count);
      const podium = document.createElement('div');
      podium.className = 'award-podium';
      [1, 0, 2].forEach(index => {
        if (items[index]) podium.append(projectCard(items[index], index));
      });
      section.append(heading, podium);
      if (items.length > 3) {
        const rest = document.createElement('details');
        rest.className = 'award-rest';
        const label = document.createElement('summary');
        label.textContent = `Ver classificação completa (${items.length - 3} projeto(s))`;
        const list = document.createElement('ol');
        items.slice(3).forEach(item => {
          const row = document.createElement('li');
          row.innerHTML = `<span></span><strong>${item.averageTotal.toFixed(2).replace('.', ',')} pts</strong>`;
          row.querySelector('span').textContent = `${item.work[0]} · ${item.work[3]}`;
          list.append(row);
        });
        rest.append(label, list);
        section.append(rest);
      }
      sphereList.append(section);
    });
    awardsPanel.hidden = false;
  }

  button.addEventListener('click', async () => {
    if (!endpoint) { setStatus('Configure a URL do Apps Script em config.js.', 'error'); return; }
    if (!keyInput.value) { setStatus('Informe a chave administrativa.', 'error'); keyInput.focus(); return; }
    button.disabled = true;
    setStatus('Carregando resultados…');
    try {
      const [data, spheres] = await Promise.all([loadData(), loadSpheres()]);
      render(data, rankingBySphere(data, spheres));
      loginPanel.hidden = true;
    } catch (error) {
      setStatus(`Não foi possível carregar a premiação: ${error.message}`, 'error');
    } finally {
      button.disabled = false;
    }
  });
  keyInput.addEventListener('keydown', event => { if (event.key === 'Enter') button.click(); });
})();
