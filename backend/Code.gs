const TABS = { TRABALHOS: 'TRABALHOS', AVALIADORES: 'AVALIADORES', CRITERIOS: 'CRITERIOS', AVALIACOES: 'AVALIACOES' };
const EVALUATION_HEADERS = ['ID da avaliação','ID do trabalho','Número original','Modalidade','Título do trabalho','ID do avaliador','Nome do avaliador','Escola / instituição','Nota 1','Nota 2','Nota 3','Nota 4','Nota 5','Nota 6','Nota 7','Total','Média','Comentário','Data e hora','Situação da sincronização'];
const TABLE_HEADERS = {
  TRABALHOS:['ID do trabalho','Número original','Modalidade','Título','Escola','Dia / horário','Local','URL do QR Code'],
  AVALIADORES:['ID do avaliador','Nome','Escola / instituição','Ativo'],
  CRITERIOS:['ID do critério','Critério','O que observar'],
  AVALIACOES:EVALUATION_HEADERS
};
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    const result = body.action === 'submit' ? submitEvaluation(body.evaluation) : body.action === 'admin' ? adminRequest(body) : body.action === 'adminAddWork' ? adminAddWork(body) : body.action === 'adminAddEvaluator' ? adminAddEvaluator(body) : body.action === 'catalog' ? publicCatalog() : { ok:false, error:'Ação inválida.' };
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  } catch (error) { return ContentService.createTextOutput(JSON.stringify({ok:false,error:String(error.message || error)})).setMimeType(ContentService.MimeType.JSON); }
}
function doGet() { return ContentService.createTextOutput(JSON.stringify({ok:true,service:'Feira GLOBE API'})).setMimeType(ContentService.MimeType.JSON); }
function onOpen() { SpreadsheetApp.getUi().createMenu('Feira GLOBE').addItem('Importar cadastro oficial (JSON)','showImportDialog').addToUi(); }
function showImportDialog() { SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutputFromFile('ImportDialog').setWidth(520).setHeight(430),'Importar cadastro oficial'); }
function importOfficialCatalog(worksJson, criteriaJson) {
  const payload=JSON.parse(String(worksJson||'{}').replace(/^\uFEFF/,'')), criteriaPayload=JSON.parse(String(criteriaJson||'{}').replace(/^\uFEFF/,''));
  const works=payload.works, criteria=criteriaPayload.criteria;
  if(!Array.isArray(works)||works.length!==134) throw new Error('O JSON de trabalhos precisa conter os 134 registros oficiais.');
  if(new Set(works.map(w=>w.id)).size!==works.length) throw new Error('O arquivo contém IDs de trabalho duplicados.');
  const counts={Oral:0,'Pôster':0,Online:0},prefix={Oral:'ORAL','Pôster':'POSTER',Online:'ONLINE'};
  works.forEach(w=>{if(!prefix[w.modality]||!Number.isInteger(Number(w.number))||String(w.id)!==prefix[w.modality]+'-'+String(Number(w.number)).padStart(3,'0')||!w.title||!w.school||!w.dayTime||!w.location)throw new Error('Há um trabalho com ID, modalidade ou campo obrigatório inválido.');counts[w.modality]++;});
  if(counts.Oral!==37||counts['Pôster']!==88||counts.Online!==9)throw new Error('A distribuição de modalidades não corresponde à ficha oficial (37/88/9).');
  if(!Array.isArray(criteria)||criteria.length!==7||criteria.some(c=>!c.id||!c.name||!c.description)) throw new Error('O JSON precisa conter os sete critérios completos.');
  const lock=LockService.getScriptLock();lock.waitLock(20000);
  try {
    const workSheet=sheet(TABS.TRABALHOS), criterionSheet=sheet(TABS.CRITERIOS);
    const existingWorks=new Set(rows(TABS.TRABALHOS).map(r=>String(r[0])));
    const newWorks=works.filter(w=>!existingWorks.has(String(w.id))).map(w=>[w.id,w.number,w.modality,w.title,w.school,w.dayTime,w.location,w.url]);
    if(newWorks.length) workSheet.getRange(workSheet.getLastRow()+1,1,newWorks.length,8).setValues(newWorks);
    const existingCriteria=new Set(rows(TABS.CRITERIOS).map(r=>String(r[0])));
    const newCriteria=criteria.filter(c=>!existingCriteria.has(String(c.id))).map(c=>[c.id,c.name,c.description]);
    if(newCriteria.length) criterionSheet.getRange(criterionSheet.getLastRow()+1,1,newCriteria.length,3).setValues(newCriteria);
    return {ok:true,worksAdded:newWorks.length,worksSkipped:works.length-newWorks.length,criteriaAdded:newCriteria.length,criteriaSkipped:criteria.length-newCriteria.length};
  } finally { lock.releaseLock(); }
}
function sheet(name) { const s=SpreadsheetApp.getActive().getSheetByName(name); if(!s) throw new Error('Aba ausente: '+name); return s; }
function rows(name) { const values=sheet(name).getDataRange().getValues(); return values.slice(2).filter(r=>r.some(v=>v!=='')); }
function submitEvaluation(ev) {
  if (!ev || !ev.submissionId || !/^[0-9a-f-]{36}$/i.test(ev.submissionId)) throw new Error('submissionId inválido.');
  const lock=LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const target=sheet(TABS.AVALIACOES), vals=target.getDataRange().getValues();
    if (vals.slice(2).some(r=>String(r[0])===ev.submissionId)) return {ok:true,submissionId:ev.submissionId,duplicate:true};
    const work=rows(TABS.TRABALHOS).find(r=>String(r[0])===String(ev.workId));
    if(!work) throw new Error('Trabalho inexistente.');
    const evaluator=rows(TABS.AVALIADORES).find(r=>String(r[0])===String(ev.evaluatorId));
    if(!evaluator || String(evaluator[3]).toLowerCase()!=='true') throw new Error('Avaliador inexistente ou inativo.');
    if(!Array.isArray(ev.scores)||ev.scores.length!==7||ev.scores.some(n=>typeof n!=='number'||n<1||n>4||!Number.isInteger(n*2))) throw new Error('As sete notas devem estar entre 1 e 4 em passos de 0,5.');
    const sum=ev.scores.reduce((a,b)=>a+b,0), avg=Math.round((sum/7)*100)/100;
    target.appendRow([ev.submissionId,work[0],work[1],work[2],work[3],evaluator[0],evaluator[1],evaluator[2],...ev.scores,sum,avg,String(ev.comment||''),new Date(ev.createdAt||Date.now()),'Sincronizado']);
    return {ok:true,submissionId:ev.submissionId,total:sum,average:avg};
  } finally { lock.releaseLock(); }
}
function adminRequest(body) {
  const expected=PropertiesService.getScriptProperties().getProperty('ADMIN_KEY');
  if(!expected || body.adminKey!==expected) throw new Error('Acesso administrativo não autorizado.');
  return {ok:true, works:rows(TABS.TRABALHOS), evaluators:rows(TABS.AVALIADORES), evaluations:rows(TABS.AVALIACOES)};
}
function requireAdmin(body) {
  const expected=PropertiesService.getScriptProperties().getProperty('ADMIN_KEY');
  if(!expected || body.adminKey!==expected) throw new Error('Acesso administrativo não autorizado.');
}
function adminAddWork(body) {
  requireAdmin(body); const w=body.work||{};
  const prefixes={Oral:'ORAL', 'Pôster':'POSTER', Online:'ONLINE'};
  if(!prefixes[w.modality]) throw new Error('Modalidade inválida.');
  const number=Number(w.number); if(!Number.isInteger(number)||number<1||number>999) throw new Error('Número deve ser inteiro de 1 a 999.');
  const limits={title:500,school:250,dayTime:150,location:200};
  Object.keys(limits).forEach(k=>{const value=String(w[k]||'').trim();if(!value)throw new Error('Preencha todos os campos do trabalho.');if(value.length>limits[k])throw new Error('Um dos campos excede o tamanho permitido.');});
  const id=prefixes[w.modality]+'-'+String(number).padStart(3,'0'); const lock=LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const target=sheet(TABS.TRABALHOS); if(rows(TABS.TRABALHOS).some(r=>String(r[0])===id)) throw new Error('Já existe trabalho com este ID.');
    const url='?trabalho='+id; target.appendRow([id,number,w.modality,String(w.title).trim(),String(w.school).trim(),String(w.dayTime).trim(),String(w.location).trim(),url]);
    return {ok:true,work:[id,number,w.modality,String(w.title).trim(),String(w.school).trim(),String(w.dayTime).trim(),String(w.location).trim(),url]};
  } finally { lock.releaseLock(); }
}
function adminAddEvaluator(body) {
  requireAdmin(body); const p=body.evaluator||{};
  if(!/^[0-9a-f-]{36}$/i.test(String(p.evaluatorId||''))||!String(p.name||'').trim()||!String(p.institution||'').trim()) throw new Error('ID, nome e instituição válidos são obrigatórios.');
  if(String(p.name).trim().length>200||String(p.institution).trim().length>250) throw new Error('Nome ou instituição excede o tamanho permitido.');
  const lock=LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const target=sheet(TABS.AVALIADORES); if(rows(TABS.AVALIADORES).some(r=>String(r[0])===String(p.evaluatorId))) throw new Error('Já existe avaliador com este ID.');
    const record=[String(p.evaluatorId),String(p.name).trim(),String(p.institution).trim(),true]; target.appendRow(record); return {ok:true,evaluator:record};
  } finally { lock.releaseLock(); }
}
function publicCatalog() {
  const works=rows(TABS.TRABALHOS).map(r=>({id:String(r[0]),number:Number(r[1]),modality:String(r[2]),title:String(r[3]),school:String(r[4]),dayTime:String(r[5]),location:String(r[6]),url:String(r[7])}));
  const evaluators=rows(TABS.AVALIADORES).filter(r=>String(r[3]).toLowerCase()==='true').map(r=>({id:String(r[0]),name:String(r[1]),institution:String(r[2]),active:true}));
  const criteria=rows(TABS.CRITERIOS).map(r=>({id:String(r[0]),name:String(r[1]),description:String(r[2])})); return {ok:true,works,evaluators,criteria};
}
function initializeSheets() {
  const ss=SpreadsheetApp.getActive();
  Object.keys(TABLE_HEADERS).forEach(name=>{
    let s=ss.getSheetByName(name); if(!s)s=ss.insertSheet(name);
    const headers=TABLE_HEADERS[name], first=s.getRange(1,1,1,headers.length).getValues()[0];
    const oldFirstHeaders={TRABALHOS:'workId',AVALIADORES:'evaluatorId',CRITERIOS:'criterionId',AVALIACOES:'submissionId'};
    const rowOneIsHeader=String(first[0])===headers[0]||String(first[0])===oldFirstHeaders[name];
    if(rowOneIsHeader) s.insertRowsBefore(1,1);
    const rowTwo= s.getRange(2,1,1,headers.length).getValues()[0];
    const rowTwoIsHeader=String(rowTwo[0])===headers[0];
    if(!rowTwoIsHeader) s.getRange(2,1,1,headers.length).setValues([headers]);
    s.getRange(1,1,1,headers.length).merge();
    s.getRange(1,1).setValue('2ª FEIRA GLOBE BRASIL – 2026  |  '+name.replace('CRITERIOS','CRITÉRIOS'));
    s.setFrozenRows(2); s.setHiddenGridlines(true); s.setTabColor('#168579');
    s.setRowHeight(1,38); s.setRowHeight(2,42);
    s.getRange(1,1,1,headers.length).setBackground('#073b3a').setFontColor('#ffffff').setFontWeight('bold').setFontSize(14).setVerticalAlignment('middle');
    s.getRange(2,1,1,headers.length).setBackground('#168579').setFontColor('#ffffff').setFontWeight('bold').setWrap(true).setVerticalAlignment('middle');
    const widths={TRABALHOS:[120,105,105,440,270,190,240,240],AVALIADORES:[250,250,340,90],CRITERIOS:[120,330,650],AVALIACOES:[300,130,110,110,380,260,240,300,90,90,90,90,90,90,90,100,100,420,190,200]}[name];
    widths.forEach((width,i)=>s.setColumnWidth(i+1,width));
    const bodyRows=s.getMaxRows()-2;
    if(bodyRows>0){
      const body=s.getRange(3,1,bodyRows,headers.length);
      body.setFontColor('#172d2b').setVerticalAlignment('middle').setWrap(true);
      body.getBandings().forEach(banding=>banding.remove());
      body.applyRowBanding(SpreadsheetApp.BandingTheme.GREEN,false,false);
      if(s.getFilter()) s.getFilter().remove();
      s.getRange(2,1,s.getMaxRows()-1,headers.length).createFilter();
    }
    if(name==='TRABALHOS') s.getRange(3,1,bodyRows,headers.length).setVerticalAlignment('middle');
    if(name==='AVALIADORES'&&bodyRows>0) s.getRange(3,4,bodyRows,1).setDataValidation(SpreadsheetApp.newDataValidation().requireCheckbox().build());
    if(name==='AVALIACOES'&&bodyRows>0){
      const scores=s.getRange(3,9,bodyRows,7);
      const allowedNotes=s.getRange(1,27,7,1);
      allowedNotes.setValues([[1],[1.5],[2],[2.5],[3],[3.5],[4]]).setNumberFormat('0.0');
      s.hideColumns(27);
      scores.setDataValidation(SpreadsheetApp.newDataValidation().requireValueInRange(allowedNotes,true).setAllowInvalid(false).setHelpText('Selecione nota de 1 a 4, em incrementos de 0,5.').build()).setNumberFormat('0.0');
      s.getRange(3,16,bodyRows,1).setNumberFormat('0.0'); s.getRange(3,17,bodyRows,1).setNumberFormat('0.00'); s.getRange(3,19,bodyRows,1).setNumberFormat('dd/mm/yyyy hh:mm');
    }
  });
}
