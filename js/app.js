(async () => {
  const params = new URLSearchParams(location.search);
  const workId = params.get('trabalho') || params.get('work') || '';
  const form = document.getElementById('evaluationForm');
  const message = document.getElementById('saveMessage');
  const pendingPanel = document.getElementById('pendingPanel');
  const syncButton = document.getElementById('syncButton');
  try { await window.GLOBE_DATA_READY; }
  catch (error) { document.getElementById('workTitle').textContent = 'Não foi possível carregar os dados oficiais'; document.getElementById('workMeta').textContent = 'Conecte-se à internet uma vez para armazenar o cadastro neste aparelho.'; form.querySelector('[type=submit]').disabled = true; return; }
  const { works, criteria, evaluators } = window.GLOBE_DATA;
  EvaluationForm.renderCriteria(criteria);
  const work = works.find(item => item.id === workId);
  const title = document.getElementById('workTitle'), meta = document.getElementById('workMeta'), status = document.getElementById('workStatus');
  if (work) {
    title.textContent = work.title;
    meta.textContent = [work.modality, `Nº ${work.number}`, work.dayTime, work.location, work.school].filter(Boolean).join(' • ');
    status.textContent = work.modality.toUpperCase();
  } else {
    title.textContent = workId ? 'Trabalho não localizado' : 'Abra a ficha pelo QR Code do trabalho';
    meta.textContent = workId ? `O código ${workId} não consta no cadastro oficial deste aparelho.` : 'Cada QR Code identifica um trabalho da Feira.';
    status.textContent = 'VERIFICAR'; form.querySelector('[type=submit]').disabled = true;
  }
  evaluators.filter(item => item.active).forEach(person => { const option = document.createElement('option'); option.value = person.id; option.textContent = person.name; document.getElementById('evaluator').append(option); });
  const setConnection = () => { const node = document.getElementById('connectionStatus'); node.classList.toggle('offline', !navigator.onLine); node.innerHTML = `<i></i>${navigator.onLine ? 'Conectado' : 'Sem conexão'}`; };
  window.addEventListener('online', () => { setConnection(); SyncManager.syncAll(); }); window.addEventListener('offline', setConnection); setConnection();
  if (params.has('painel')) pendingPanel.hidden = false;
  async function showRecords() {
    const records = (await LocalDB.all()).sort((a,b) => b.createdAt.localeCompare(a.createdAt));
    document.getElementById('localRecords').replaceChildren();
    if (!records.length) { document.getElementById('localRecords').textContent = 'Ainda não há avaliações salvas neste aparelho.'; return; }
    records.forEach(record => { const row = document.createElement('p'); row.className = 'local-record'; row.textContent = `${record.workId} • ${record.evaluatorName} • ${record.total.toFixed(1)} pts • ${record.syncStatus}`; document.getElementById('localRecords').append(row); });
  }
  await showRecords();
  syncButton.addEventListener('click', async () => { syncButton.disabled = true; message.textContent = 'Sincronizando avaliações pendentes…'; const result = await SyncManager.syncAll(); message.textContent = result.message; await showRecords(); syncButton.disabled = false; });
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (!work) return;
    const evaluatorId = document.getElementById('evaluator').value;
    if (!evaluatorId) { message.textContent = 'Selecione seu nome para continuar.'; document.getElementById('evaluator').focus(); return; }
    if (!EvaluationForm.valid()) { message.textContent = 'Atribua uma nota válida de 1 a 4, em intervalos de 0,5, nos sete critérios.'; return; }
    const evaluator = evaluators.find(item => item.id === evaluatorId);
    const scores = EvaluationForm.getScores();
    const record = { submissionId: crypto.randomUUID(), workId: work.id, workNumber: work.number, workTitle: work.title, modality: work.modality, evaluatorId, evaluatorName: evaluator.name, evaluatorSchool: evaluator.institution, scores, total: scores.reduce((a,b)=>a+b,0), average: scores.reduce((a,b)=>a+b,0)/7, comment: document.getElementById('comment').value.trim(), createdAt: new Date().toISOString(), syncStatus: 'pending' };
    try {
      await LocalDB.save(record);
      message.textContent = 'Avaliação salva neste aparelho. ' + (navigator.onLine ? 'Tentando sincronizar…' : 'Ficará pendente até a conexão retornar.');
      document.getElementById('comment').value = ''; EvaluationForm.reset(criteria); await showRecords();
      if (navigator.onLine) { const result = await SyncManager.syncRecord(record); message.textContent = result.message; await showRecords(); }
    } catch (error) { console.error(error); message.textContent = 'Não foi possível salvar no armazenamento deste navegador.'; }
  });
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./service-worker.js').catch(console.error);
  if (navigator.onLine) SyncManager.syncAll();
})();
