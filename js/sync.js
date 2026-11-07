const SyncManager = (() => {
  const endpoint = (window.GLOBE_CONFIG && window.GLOBE_CONFIG.appsScriptUrl || '').trim();
  async function syncRecord(record) {
    if (!navigator.onLine) return { ok: false, message: 'Sem conexão: avaliação pendente neste aparelho.' };
    if (!endpoint) return { ok: false, message: 'Avaliação salva localmente. Configure a URL do Apps Script para sincronizar.' };
    const current = { ...record, syncStatus: 'syncing' }; await LocalDB.update(current);
    try {
      const response = await fetch(endpoint, { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'submit', evaluation: record }) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      if (result.ok !== true || result.submissionId !== record.submissionId) throw new Error(result.error || 'Confirmação do backend inválida.');
      await LocalDB.update({ ...record, syncStatus: 'synced', syncedAt: new Date().toISOString() });
      return { ok: true, message: 'Avaliação sincronizada e confirmada pelo servidor.' };
    } catch (error) {
      await LocalDB.update({ ...record, syncStatus: 'error', syncError: String(error.message || error) });
      return { ok: false, message: 'Não houve confirmação do servidor. A avaliação permanece neste aparelho para nova tentativa.' };
    }
  }
  async function syncAll() {
    if (!endpoint) return { message: 'Avaliações preservadas neste aparelho. Configure o endpoint do Apps Script.' };
    const all = await LocalDB.all(); let sent = 0;
    for (const record of all.filter(item => item.syncStatus !== 'synced')) { const result = await syncRecord(record); if (result.ok) sent++; }
    return { message: sent ? `${sent} avaliação(ões) confirmada(s) pelo servidor.` : 'Nenhuma avaliação recebeu confirmação. Os registros locais foram preservados.' };
  }
  return { syncRecord, syncAll };
})();
