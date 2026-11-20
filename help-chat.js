(function () {
  const launcher = document.getElementById('help-chat-launcher');
  const panel = document.getElementById('help-chat-panel');
  const closeButton = document.getElementById('help-chat-close');
  const form = document.getElementById('help-chat-form');
  const input = document.getElementById('help-chat-input');
  const body = document.getElementById('help-chat-body');
  const conversation = document.getElementById('help-chat-conversation');
  if (!launcher || !panel || !closeButton || !form || !input || !body || !conversation) return;
  const appHelpMode = new URLSearchParams(window.location.search).get('assistant') === 'app';

  let entries = [];
  let entryById = new Map();
  let knowledgePromise;

  const relatedTerms = {
    ai: ['mcp', 'assistant'],
    bill: ['billing', 'invoice', 'billable'],
    cloud: ['network', 'sync', 'repository'],
    combine: ['consolidate', 'team', 'organization'],
    cost: ['price', 'pricing', 'subscription'],
    data: ['records', 'slips', 'export', 'storage'],
    iphone: ['mobile', 'ios'],
    note: ['comment', 'comments'],
    report: ['reporting', 'summary', 'export'],
    safe: ['security', 'notarized', 'signed'],
    sync: ['synchronize', 'network', 'pending'],
    team: ['organization', 'members', 'manager'],
    time: ['timer', 'slip', 'elapsed']
  };

  const stopWords = new Set(['a', 'an', 'and', 'are', 'can', 'do', 'does', 'for', 'how', 'i', 'in', 'is', 'it', 'my', 'of', 'on', 'the', 'to', 'what', 'when', 'where', 'which', 'with']);

  function normalize(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9$.-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function tokens(value) {
    const base = normalize(value).split(' ').filter(function (token) { return token.length > 1 && !stopWords.has(token); });
    const expanded = new Set(base);
    base.forEach(function (token) {
      Object.keys(relatedTerms).forEach(function (key) {
        const group = [key].concat(relatedTerms[key]);
        if (group.includes(token)) group.forEach(function (word) { expanded.add(word); });
      });
    });
    return Array.from(expanded);
  }

  function loadKnowledge() {
    if (knowledgePromise) return knowledgePromise;
    knowledgePromise = fetch('/help/knowledge-base.json', { cache: 'no-store' })
      .then(function (response) {
        if (!response.ok) throw new Error('Help guide unavailable');
        return response.json();
      })
      .then(function (data) {
        entries = Array.isArray(data.entries) ? data.entries : [];
        entryById = new Map(entries.map(function (entry) { return [entry.id, entry]; }));
        return entries;
      })
      .catch(function () {
        entries = [];
        entryById = new Map();
        return entries;
      });
    return knowledgePromise;
  }

  function scoreEntry(query, entry) {
    const cleanQuery = normalize(query);
    const queryTokens = tokens(query);
    const cleanQuestion = normalize(entry.question);
    const cleanKeywords = (entry.keywords || []).map(normalize);
    const questionTokens = new Set(tokens(entry.question));
    const keywordTokens = new Set(tokens(cleanKeywords.join(' ')));
    const answerTokens = new Set(tokens(entry.answer));
    let score = 0;

    if (cleanQuestion === cleanQuery) score += 80;
    if (cleanQuestion.includes(cleanQuery) || cleanQuery.includes(cleanQuestion)) score += 18;
    cleanKeywords.forEach(function (keyword) {
      if (keyword && cleanQuery.includes(keyword)) score += keyword.includes(' ') ? 15 : 8;
    });
    queryTokens.forEach(function (token) {
      if (questionTokens.has(token)) score += 5;
      if (keywordTokens.has(token)) score += 4;
      if (answerTokens.has(token)) score += 1;
    });
    return score;
  }

  function findMatches(question) {
    return entries
      .map(function (entry) { return { entry, score: scoreEntry(question, entry) }; })
      .filter(function (match) { return match.score > 0; })
      .sort(function (a, b) { return b.score - a.score; });
  }

  function addMessage(kind, text) {
    const message = document.createElement('div');
    message.className = `help-chat-message help-chat-message-${kind}`;
    const paragraph = document.createElement('p');
    paragraph.textContent = text;
    message.appendChild(paragraph);
    conversation.appendChild(message);
    return message;
  }

  function addAnswer(entry) {
    const message = document.createElement('div');
    message.className = 'help-chat-message help-chat-message-bot help-chat-answer';
    const category = document.createElement('span');
    category.className = 'help-chat-category';
    category.textContent = entry.category;
    message.appendChild(category);
    entry.answer.split(/\n\n+/).forEach(function (text) {
      const paragraph = document.createElement('p');
      paragraph.textContent = text;
      message.appendChild(paragraph);
    });
    conversation.appendChild(message);

    const followUps = (entry.followUps || []).map(function (id) { return entryById.get(id); }).filter(Boolean).slice(0, 3);
    if (followUps.length) {
      const group = document.createElement('div');
      group.className = 'help-chat-followups';
      const label = document.createElement('span');
      label.textContent = 'Related questions';
      group.appendChild(label);
      followUps.forEach(function (followUp) {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.helpQuestion = followUp.question;
        button.textContent = followUp.question;
        group.appendChild(button);
      });
      conversation.appendChild(group);
    }
  }

  function addFallback() {
    const message = document.createElement('div');
    message.className = 'help-chat-message help-chat-message-bot help-chat-answer';
    const paragraph = document.createElement('p');
    paragraph.textContent = 'I could not confirm that from the current SlipMeter product guide. Try asking who SlipMeter is for, what is included, pricing, team use, Network, privacy, installation, or MCP.';
    const link = document.createElement('a');
    link.href = 'mailto:support@clickcoach.io?subject=SlipMeter%20question';
    link.textContent = 'Ask SlipMeter support';
    message.append(paragraph, link);
    conversation.appendChild(message);
  }

  function scrollToLatest() {
    requestAnimationFrame(function () { body.scrollTop = body.scrollHeight; });
  }

  async function answerQuestion(question) {
    const cleanQuestion = String(question || '').trim();
    if (!cleanQuestion) return;
    addMessage('user', cleanQuestion);
    input.value = '';
    await loadKnowledge();
    const matches = findMatches(cleanQuestion);
    if (!matches.length || matches[0].score < 5) addFallback();
    else addAnswer(matches[0].entry);
    scrollToLatest();
  }

  function setOpen(open) {
    panel.hidden = !open;
    launcher.setAttribute('aria-expanded', String(open));
    launcher.classList.toggle('is-hidden', open);
    if (open) {
      loadKnowledge();
      window.setTimeout(function () { input.focus(); }, 0);
    } else {
      launcher.focus();
    }
  }

  if (appHelpMode) {
    const title = document.getElementById('help-chat-title');
    const guideLabel = panel.querySelector('.help-chat-header span');
    const welcome = panel.querySelector('.help-chat-message-bot p');
    const trialLink = panel.querySelector('.help-chat-trial');
    const formLabel = form.querySelector('label');
    const starters = Array.from(panel.querySelectorAll('#help-chat-starters [data-help-question]'));
    if (title) title.textContent = 'SlipMeter How-to Assistant';
    if (guideLabel) guideLabel.innerHTML = '<i aria-hidden="true"></i> Product guide';
    if (welcome) welcome.textContent = 'Ask how to use SlipMeter, understand a slip state, correct a record, export data, or connect your team.';
    closeButton.setAttribute('aria-label', 'Close SlipMeter How-to Assistant');
    if (trialLink) trialLink.hidden = true;
    if (formLabel) formLabel.textContent = 'Ask a how-to question about SlipMeter';
    input.setAttribute('placeholder', 'Ask how to use SlipMeter…');
    [
      ['How do I edit a saved slip?', 'How do I edit a saved slip?'],
      ['What happens if I close while running?', 'What happens if I close while a timer is running?'],
      ['How do I combine team data?', 'How can several SlipMeter users combine their data?']
    ].forEach(function (starter, index) {
      if (!starters[index]) return;
      starters[index].dataset.helpQuestion = starter[1];
      starters[index].textContent = starter[0];
    });
  }

  launcher.addEventListener('click', function () { setOpen(true); });
  closeButton.addEventListener('click', function () { setOpen(false); });
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    answerQuestion(input.value);
  });
  panel.addEventListener('click', function (event) {
    const button = event.target.closest('[data-help-question]');
    if (!button) return;
    answerQuestion(button.dataset.helpQuestion);
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && !panel.hidden) setOpen(false);
  });
  if (appHelpMode) setOpen(true);
})();
