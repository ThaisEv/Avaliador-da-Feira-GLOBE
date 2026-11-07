const EvaluationForm = (() => {
  const criteriaRoot = document.getElementById('criteriaList');
  const totalNode = document.getElementById('totalScore');
  let scores = [];
  const format = value => Number(value).toFixed(1).replace('.', ',');
  function renderCriteria(criteria) {
    scores = Array(criteria.length).fill(null);
    criteriaRoot.replaceChildren();
    criteria.forEach((criterion, index) => {
      const item = document.createElement('div'); item.className = 'criterion';
      const head = document.createElement('div');
      const num = document.createElement('span'); num.className = 'criterion-number'; num.textContent = `CRITÉRIO ${String(index + 1).padStart(2, '0')}`;
      const name = document.createElement('div'); name.className = 'criterion-name'; name.textContent = criterion.name;
      const desc = document.createElement('p'); desc.className = 'criterion-description'; desc.textContent = criterion.description;
      head.append(num, name, desc);
      const control = document.createElement('div'); control.className = 'score-control';
      const minus = document.createElement('button'); minus.type = 'button'; minus.textContent = '−'; minus.setAttribute('aria-label', `Diminuir nota do critério ${index + 1}`); minus.disabled = true;
      const output = document.createElement('output'); output.setAttribute('aria-live', 'polite'); output.textContent = '—';
      const plus = document.createElement('button'); plus.type = 'button'; plus.textContent = '+'; plus.setAttribute('aria-label', `Aumentar nota do critério ${index + 1}`);
      function change(delta) {
        scores[index] = scores[index] === null ? 1 : Math.max(1, Math.min(4, scores[index] + delta));
        output.textContent = format(scores[index]); minus.disabled = scores[index] <= 1; plus.disabled = scores[index] >= 4; updateTotal();
      }
      minus.addEventListener('click', () => change(-.5)); plus.addEventListener('click', () => change(.5));
      control.append(minus, output, plus); item.append(head, control); criteriaRoot.append(item);
    });
    updateTotal();
  }
  function updateTotal() { totalNode.textContent = format(scores.reduce((sum, score) => sum + (score || 0), 0)); }
  function getScores() { return [...scores]; }
  function valid() { return scores.length === 7 && scores.every(value => value !== null && value >= 1 && value <= 4 && Number.isInteger(value * 2)); }
  function reset(criteria) { renderCriteria(criteria); }
  return { renderCriteria, getScores, valid, reset };
})();
