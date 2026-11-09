(async () => {
  const filters = [
    { id: 'dayFilter', label: 'Selecione a data', get: dayOf },
    { id: 'modalityFilter', label: 'Selecione a modalidade', get: work => work.modality || 'Modalidade não informada' },
    { id: 'shiftFilter', label: 'Selecione o turno', get: shiftOf },
    { id: 'locationFilter', label: 'Selecione o local', get: work => work.location || 'Local não informado' }
  ];
  const selected = ['', '', '', ''];
  const controls = filters.map(filter => document.getElementById(filter.id));
  const list = document.getElementById('projectList');
  const heading = document.getElementById('resultsHeading');
  const status = document.getElementById('connectionStatus');
  const sorters = [sortDays, sortModalities, sortShifts, (a,b) => a.localeCompare(b, 'pt-BR')];

  function dayOf(work) {
    return (String(work.dayTime || '').match(/\b\d{1,2}\/\d{1,2}\b/) || [])[0] || 'Data não informada';
  }

  function shiftOf(work) {
    const schedule = String(work.dayTime || '');
    const namedShift = schedule.match(/\b(manhã|tarde|noite)\b/i)?.[1];
    if (namedShift) return namedShift[0].toLocaleUpperCase('pt-BR') + namedShift.slice(1).toLocaleLowerCase('pt-BR');
    const startHour = Number((schedule.match(/\b(\d{1,2}):\d{2}\b/) || [])[1]);
    if (Number.isFinite(startHour) && startHour > 0) return startHour >= 12 ? 'Tarde' : 'Manhã';
    return 'Turno não informado';
  }

  function sortDays(a, b) {
    const parse = value => {
      const match = value.match(/^(\d{1,2})\/(\d{1,2})$/);
      return match ? Number(match[2]) * 32 + Number(match[1]) : Number.MAX_SAFE_INTEGER;
    };
    return parse(a) - parse(b) || a.localeCompare(b, 'pt-BR');
  }

  function sortModalities(a, b) {
    const order = ['Oral', 'Pôster', 'Online'];
    return order.indexOf(a) - order.indexOf(b) || a.localeCompare(b, 'pt-BR');
  }

  function sortShifts(a, b) {
    const order = ['Manhã', 'Tarde', 'Noite', 'Turno não informado'];
    return order.indexOf(a) - order.indexOf(b) || a.localeCompare(b, 'pt-BR');
  }

  function matchingWorks(count = filters.length) {
    return works.filter(work => filters.slice(0, count).every((filter, index) => !selected[index] || filter.get(work) === selected[index]));
  }

  function populateFrom(startIndex) {
    for (let i = startIndex; i < filters.length; i++) {
      const control = controls[i];
      const available = Boolean(i === 0 || selected[i - 1]);
      const placeholder = filters[i].label;
      const values = [...new Set(matchingWorks(i).map(filters[i].get))].sort(sorters[i]);
      control.replaceChildren(new Option(placeholder, ''));
      values.forEach(value => control.add(new Option(value, value)));
      control.disabled = !available || !values.length;
      if (selected[i] && values.includes(selected[i])) control.value = selected[i];
      else selected[i] = '';
      if (!selected[i]) {
        for (let j = i + 1; j < filters.length; j++) {
          selected[j] = '';
          controls[j].replaceChildren(new Option(filters[j].label, ''));
          controls[j].disabled = true;
        }
        break;
      }
    }
  }

  function renderProjects() {
    const complete = selected.every(Boolean);
    list.replaceChildren();
    if (!complete) {
      heading.textContent = 'Selecione os filtros para começar';
      return;
    }
    const projects = matchingWorks();
    heading.textContent = `${projects.length} ${projects.length === 1 ? 'projeto encontrado' : 'projetos encontrados'}`;
    if (!projects.length) {
      list.textContent = 'Nenhum projeto corresponde a esses filtros.';
      return;
    }
    projects.sort((a, b) => Number(a.number || 0) - Number(b.number || 0));
    projects.forEach(work => {
      const card = document.createElement('article');
      card.className = 'project-card';
      const info = document.createElement('div');
      info.className = 'project-info';
      const id = document.createElement('span');
      id.className = 'eyebrow';
      id.textContent = `${work.id} · ${work.modality}`;
      const title = document.createElement('h3');
      title.textContent = work.title;
      const school = document.createElement('p');
      school.textContent = work.school || 'Instituição não informada';
      const details = document.createElement('small');
      details.textContent = [work.dayTime, work.location].filter(Boolean).join(' · ');
      info.append(id, title, school, details);
      const open = document.createElement('a');
      open.className = 'project-open';
      open.href = `./?trabalho=${encodeURIComponent(work.id)}`;
      open.textContent = 'Abrir ficha de avaliação';
      card.append(info, open);
      list.append(card);
    });
  }

  try {
    await window.GLOBE_DATA_READY;
  } catch (error) {
    heading.textContent = 'Não foi possível carregar os projetos';
    list.textContent = 'Conecte-se à internet para carregar o cadastro, depois esta página poderá funcionar offline.';
    controls.forEach(control => { control.disabled = true; });
    return;
  }
  const { works } = window.GLOBE_DATA;
  controls.forEach((control, index) => control.addEventListener('change', () => {
    selected[index] = control.value;
    for (let i = index + 1; i < selected.length; i++) selected[i] = '';
    populateFrom(index + 1);
    renderProjects();
  }));
  populateFrom(0);
  renderProjects();

  const setConnection = () => {
    status.classList.toggle('offline', !navigator.onLine);
    status.innerHTML = `<i></i>${navigator.onLine ? 'Conectado' : 'Sem conexão'}`;
  };
  window.addEventListener('online', setConnection);
  window.addEventListener('offline', setConnection);
  setConnection();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./service-worker.js').catch(console.error);
})();
