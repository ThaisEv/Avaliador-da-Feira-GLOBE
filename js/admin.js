(() => {
  let data = null;
  let adminKey = '';
  const status = document.getElementById('status');
  const endpoint = (window.GLOBE_CONFIG && window.GLOBE_CONFIG.appsScriptUrl || '').trim();
  const rankingSection = document.createElement('section');
  rankingSection.className = 'section-card';
  rankingSection.innerHTML = '<div class="section-heading"><div><p class="eyebrow">RESULTADO CONSOLIDADO</p><h2>Classificação dos trabalhos</h2></div></div><p class="form-help">Ordenada pela média dos pontos totais recebidos (máximo 28). Empates compartilham a posição.</p><p id="rankingSummary"></p><div class="table-scroll"><table><thead><tr><th>Posição</th><th>ID</th><th>Modalidade</th><th>Trabalho</th><th>Escola</th><th>Avaliações</th><th>Média final / 28</th><th>Média / 4</th></tr></thead><tbody id="rankingRows"></tbody></table></div>';
  document.getElementById('dashboard').prepend(rankingSection);

  async function api(action, fields = {}) {
    const response = await fetch(endpoint, {
      method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, adminKey, ...fields })
    });
    const result = await response.json();
    if (!response.ok || result.ok !== true) throw new Error(result.error || 'Falha ao processar solicitação.');
    return result;
  }

  document.getElementById('loadButton').addEventListener('click', async () => {
    if (!endpoint) { status.textContent = 'Configure a URL do Apps Script em config.js.'; return; }
    adminKey = document.getElementById('adminKey').value;
    status.textContent = 'Autenticando…';
    try {
      data = await api('admin');
      document.getElementById('dashboard').hidden = false;
      render(); status.textContent = `Dados carregados: ${data.works.length} trabalhos e ${data.evaluations.length} avaliações.`;
    } catch (error) { status.textContent = `Não foi possível autenticar ou carregar os dados: ${error.message}`; }
  });

  document.getElementById('workForm').addEventListener('submit', async event => {
    event.preventDefault(); const form = event.currentTarget; const values = Object.fromEntries(new FormData(form));
    status.textContent = 'Cadastrando trabalho…';
    try {
      const result = await api('adminAddWork', { work: values });
      data.works.push(result.work); form.reset(); render(); await publishCatalog();
      status.textContent = `Trabalho ${result.work[0]} cadastrado. URL do QR Code: ${new URL(result.work[7], location.href).href}`;
    } catch (error) { status.textContent = `Não foi possível cadastrar o trabalho: ${error.message}`; }
  });

  document.getElementById('evaluatorForm').addEventListener('submit', async event => {
    event.preventDefault(); const form = event.currentTarget; const values = Object.fromEntries(new FormData(form));
    status.textContent = 'Cadastrando avaliador…';
    try {
      const result = await api('adminAddEvaluator', { evaluator: { evaluatorId: crypto.randomUUID(), name: values.name, institution: values.institution } });
      data.evaluators.push(result.evaluator); form.reset(); render(); await publishCatalog();
      status.textContent = `Avaliador(a) ${result.evaluator[1]} cadastrado(a) e ativo(a) no catálogo.`;
    } catch (error) { status.textContent = `Não foi possível cadastrar o avaliador: ${error.message}`; }
  });

  async function publishCatalog() {
    // Atualiza o catálogo deste próprio navegador e os próximos carregamentos online.
    localStorage.setItem('globe-catalog', JSON.stringify({ works: data.works.map(r => Array.isArray(r) ? ({ id:r[0], number:Number(r[1]), modality:r[2], title:r[3], school:r[4], dayTime:r[5], location:r[6], url:r[7] }) : r), evaluators: data.evaluators.map(r => Array.isArray(r) ? ({ id:r[0], name:r[1], institution:r[2], active:String(r[3]).toLowerCase()==='true' }) : r) }));
  }

  const catalogButton = document.createElement('button');
  catalogButton.type = 'button'; catalogButton.textContent = 'Baixar cadastro completo para gerar QR Codes';
  catalogButton.addEventListener('click', () => {
    const works = data.works.map(r => Array.isArray(r) ? ({ id:r[0], number:Number(r[1]), modality:r[2], title:r[3], school:r[4], dayTime:r[5], location:r[6], url:r[7] }) : r);
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify({works},null,2)],{type:'application/json'}));a.download='trabalhos.json';a.click();URL.revokeObjectURL(a.href);
  });
  document.getElementById('workRows').closest('.section-card').prepend(catalogButton);

  function render() {
    if (!data) return;
    const modality = document.getElementById('modalityFilter').value;
    const evaluatorId = document.getElementById('evaluatorFilter').value;
    const evSelect = document.getElementById('evaluatorFilter'); const old = evSelect.value;
    evSelect.replaceChildren(new Option('Todos', ''));
    [...new Map(data.evaluations.map(r => [r[5], r[6]])).entries()].forEach(([id, name]) => evSelect.add(new Option(name, id)));
    evSelect.value = old;
    const evaluations = data.evaluations.filter(r => (!evaluatorId || String(r[5]) === evaluatorId) && (!modality || String(r[3]) === modality));
    const counts = {}; data.evaluations.forEach(r => counts[r[1]] = (counts[r[1]] || 0) + 1);
    const evaluationBody = document.getElementById('evaluationRows'); evaluationBody.replaceChildren();
    evaluations.forEach(r => { const tr = document.createElement('tr'); [`${r[1]} · ${r[4]}`,r[6],r.slice(8,15).join(' / '),`${r[15]} / ${r[16]}`,r[17],r[19]].forEach(value => { const td=document.createElement('td');td.textContent=value;tr.append(td); });evaluationBody.append(tr); });
    const workBody=document.getElementById('workRows');workBody.replaceChildren();
    data.works.filter(r => !modality || String(r[2]) === modality).forEach(r => { const tr=document.createElement('tr');[r[0],r[2],r[3],r[4],r[5],r[6],counts[r[0]]||0].forEach(value=>{const td=document.createElement('td');td.textContent=value;tr.append(td);});workBody.append(tr); });
    document.getElementById('summary').textContent=`${evaluations.length} avaliação(ões) filtrada(s) · ${data.works.length} trabalhos · ${data.evaluators.length} avaliadores cadastrados.`;
    renderRanking(modality);
  }

  function renderRanking(modality) {
    const ranking = window.GLOBE_RANKING.compute(data.works, data.evaluations, modality);
    const body = document.getElementById('rankingRows'); body.replaceChildren();
    ranking.forEach(item => {
      const row=document.createElement('tr'); if(item.position<=3) row.classList.add('rank-top');
      [item.position, item.work[0], item.work[2], item.work[3], item.work[4], item.evaluations, item.averageTotal.toFixed(2).replace('.',','), item.averageScore.toFixed(2).replace('.',',')].forEach(value=>{const cell=document.createElement('td');cell.textContent=value;row.append(cell);});
      body.append(row);
    });
    document.getElementById('rankingSummary').textContent = ranking.length ? `${ranking.length} trabalho(s) com avaliações confirmadas.` : 'Ainda não há avaliações sincronizadas para esta modalidade.';
  }

  document.getElementById('modalityFilter').addEventListener('change', render);
  document.getElementById('evaluatorFilter').addEventListener('change', render);
  document.getElementById('exportButton').addEventListener('click', () => {
    const rows=[['submissionId','workId','modalidade','titulo','evaluatorId','avaliador','escola','nota1','nota2','nota3','nota4','nota5','nota6','nota7','total','media','comentario','dataHora','sincronizacao'],...data.evaluations.map(r=>[r[0],r[1],r[3],r[4],r[5],r[6],r[7],...r.slice(8,20)])];
    const csv=rows.map(row=>row.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\r\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));a.download='avaliacoes-feira-globe.csv';a.click();URL.revokeObjectURL(a.href);
  });
})();
