// Classificação por média dos totais recebidos; cada avaliação confirmada tem o mesmo peso.
window.GLOBE_RANKING = {
  compute(works, evaluations, modality = '') {
    const workById = new Map(works.map(row => [String(row[0]), row]));
    const grouped = new Map();
    for (const evaluation of evaluations) {
      const work = workById.get(String(evaluation[1]));
      const total = Number(evaluation[15]);
      if (!work || (modality && String(work[2]) !== modality) || !Number.isFinite(total)) continue;
      const workId = String(work[0]);
      if (!grouped.has(workId)) grouped.set(workId, { work, total: 0, count: 0 });
      const item = grouped.get(workId); item.total += total; item.count += 1;
    }
    const ranking = [...grouped.values()].map(item => ({
      work: item.work,
      evaluations: item.count,
      averageTotal: item.total / item.count,
      averageScore: item.total / item.count / 7
    })).sort((a, b) => b.averageTotal - a.averageTotal || String(a.work[0]).localeCompare(String(b.work[0]), 'pt-BR'));
    let lastScore = null, lastRank = 0;
    ranking.forEach((item, index) => {
      const score = Math.round(item.averageTotal * 100) / 100;
      if (lastScore === null || score !== lastScore) lastRank = index + 1;
      item.position = lastRank; lastScore = score;
    });
    return ranking;
  }
};
