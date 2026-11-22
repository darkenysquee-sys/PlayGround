(() => {
  const SAVE_KEY = 'cronicas-valle-roble-v1';
  const definitions = {
    manor: { name: 'Casa solariega', icon: '🏰', desc: 'El corazón de tu asentamiento. Cada mejora atrae nuevas familias.', cost: { wood: 24, stone: 18 }, yield: {}, max: 1 },
    lumber: { name: 'Campamento maderero', icon: '🪵', desc: 'Leñadores expertos abastecen de madera tus proyectos.', cost: { wood: 12 }, yield: { wood: 8 }, max: 2 },
    quarry: { name: 'Cantera', icon: '⛏️', desc: 'Extrae piedra resistente de las laderas cercanas.', cost: { wood: 12 }, yield: { stone: 6 }, max: 2 },
    farm: { name: 'Granja', icon: '🌾', desc: 'Cultiva cereal y prepara una despensa para el invierno.', cost: { wood: 20, stone: 8 }, yield: { food: 12 }, max: 2 },
    mine: { name: 'Mina de hierro', icon: '🪨', desc: 'Los mineros buscan vetas de hierro bajo la montaña.', cost: { wood: 22, stone: 20 }, yield: { iron: 5 }, max: 1 },
    barracks: { name: 'Cuartel', icon: '🛡️', desc: 'Entrena una guardia para defender las fronteras.', cost: { wood: 22, stone: 26, gold: 8 }, yield: {}, max: 1 },
    forge: { name: 'Forja', icon: '⚒️', desc: 'Transforma hierro en herramientas y prosperidad.', cost: { wood: 20, stone: 24, iron: 8 }, yield: { gold: 4 }, max: 1 },
    market: { name: 'Mercado', icon: '🏪', desc: 'Comerciantes convierten excedentes en monedas.', cost: { wood: 26, stone: 14 }, yield: { gold: 6 }, max: 1 },
    library: { name: 'Scriptorium', icon: '📜', desc: 'Los escribas preservan el saber del reino.', cost: { wood: 25, stone: 25, gold: 20 }, yield: { gold: 2 }, max: 1 }
  };
  const objectiveDefs = [
    { id: 'farm', title: 'Asegura la despensa', text: 'Construye una granja para alimentar a tu pueblo.', reward: { food: 15, gold: 5 }, rewardText: '+15 alimento · +5 oro', check: s => s.buildings.some(b => b.type === 'farm') },
    { id: 'manor', title: 'Un hogar más grande', text: 'Mejora tu casa solariega hasta el nivel 2.', reward: { wood: 15, stone: 10 }, rewardText: '+15 madera · +10 piedra', check: s => (s.buildings.find(b => b.type === 'manor')?.level || 1) >= 2 },
    { id: 'barracks', title: 'Protege el valle', text: 'Construye un cuartel para organizar la guardia.', reward: { gold: 15, food: 10 }, rewardText: '+15 oro · +10 alimento', check: s => s.buildings.some(b => b.type === 'barracks') },
    { id: 'troops', title: 'La primera guardia', text: 'Recluta 5 soldados en el cuartel.', reward: { iron: 8, gold: 15 }, rewardText: '+8 hierro · +15 oro', check: s => s.military >= 5 },
    { id: 'forge', title: 'Domina el hierro', text: 'Construye una forja para entrar en la era feudal.', reward: { gold: 25 }, rewardText: '+25 oro · Nueva era', check: s => s.buildings.some(b => b.type === 'forge') }
  ];
  const initial = () => ({ day: 1, year: 1, resources: { wood: 46, stone: 38, iron: 0, food: 24, gold: 38 }, military: 0, buildings: [{ type: 'manor', level: 1, slot: 4 }, { type: 'lumber', level: 1, slot: 0 }, { type: 'quarry', level: 1, slot: 8 }], completed: [], sound: true });
  let state;
  try { state = JSON.parse(localStorage.getItem(SAVE_KEY)) || initial(); } catch { state = initial(); }
  let selectedSlot = null;
  let toastTimer;
  const $ = id => document.getElementById(id);
  const resourceNames = { wood: 'madera', stone: 'piedra', iron: 'hierro', food: 'alimento', gold: 'oro' };
  const resourceIcons = { wood: '♣', stone: '◆', iron: '⬟', food: '✿', gold: '◉' };
  const clampState = () => { state.resources ||= initial().resources; state.completed ||= []; state.buildings ||= []; state.military ||= 0; state.day ||= 1; state.year ||= 1; };
  clampState();
  function save() { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); }
  function counts(type) { return state.buildings.filter(b => b.type === type).length; }
  function production() {
    const out = { wood: 0, stone: 0, iron: 0, food: 0, gold: 0 };
    state.buildings.forEach(b => Object.entries(definitions[b.type].yield).forEach(([key, value]) => { out[key] += value * b.level; }));
    return out;
  }
  function population() { return 12 + Math.max(0, (state.buildings.find(b => b.type === 'manor')?.level || 1) - 1) * 8 + Math.max(0, state.buildings.length - 3) * 2; }
  function prestige() { return state.buildings.reduce((n, b) => n + (b.type === 'manor' ? 8 : 5) * b.level, 0) + state.military * 2 + state.completed.length * 3; }
  function canAfford(cost) { return Object.entries(cost).every(([key, amount]) => state.resources[key] >= amount); }
  function costText(cost) { return Object.entries(cost).map(([key, amount]) => `${resourceIcons[key]} ${amount}`).join('　'); }
  function age() { return state.completed.includes('forge') ? 'Feudal' : state.completed.length >= 2 ? 'Aldea avanzada' : 'Aldea'; }
  function render() {
    const rate = production();
    Object.keys(resourceNames).forEach(key => { $(key).textContent = Math.floor(state.resources[key]); $(`${key}-rate`).textContent = `+${rate[key]} / día`; });
    $('military').textContent = state.military;
    $('day-label').textContent = `Día ${state.day} · Año ${state.year}`;
    $('season-name').textContent = ['Primavera', 'Verano', 'Otoño', 'Invierno'][Math.floor(((state.day - 1) % 48) / 12)];
    $('population').textContent = population();
    $('building-count').innerHTML = `${state.buildings.length} <i>/ 9</i>`;
    $('prestige').textContent = prestige();
    $('age-label').textContent = age();
    renderGrid(); renderObjectives(); renderRanking(); renderMilestone(); renderTip();
    save();
  }
  function renderGrid() {
    const grid = $('city-grid'); grid.innerHTML = '';
    for (let i = 0; i < 9; i++) {
      const building = state.buildings.find(b => b.slot === i);
      const button = document.createElement('button'); button.className = `plot${building ? '' : ' plot-empty'}`; button.type = 'button';
      if (building) {
        const def = definitions[building.type];
        const yieldText = Object.entries(def.yield).map(([key, value]) => `+${value * building.level} ${resourceNames[key]}`).join(' · ') || (building.type === 'barracks' ? `⚔ ${state.military} soldados` : '✦ centro del valle');
        button.setAttribute('aria-label', `${def.name}, nivel ${building.level}. Toca para gestionar.`);
        button.innerHTML = `<span class="plot-inner"><span class="building-art">${def.icon}</span><b class="plot-name">${def.name}</b><span class="plot-level">NIVEL ${building.level}</span><span class="plot-production">${yieldText}</span></span>`;
        button.addEventListener('click', () => openBuilding(building.slot));
      } else {
        button.setAttribute('aria-label', `Parcela ${i + 1} vacía. Construir edificio.`);
        button.innerHTML = '<span class="plot-inner"><span class="empty-plus">+</span><b class="empty-label">Parcela libre</b></span>';
        button.addEventListener('click', () => openBuild(i));
      }
      grid.appendChild(button);
    }
  }
  function renderObjectives() {
    const host = $('objectives'); host.innerHTML = '';
    objectiveDefs.forEach(obj => {
      const done = state.completed.includes(obj.id);
      const row = document.createElement('div'); row.className = `objective${done ? ' done' : ''}`;
      row.innerHTML = `<span class="objective-check">${done ? '✓' : ''}</span><div><h4>${obj.title}</h4><p>${done ? 'Completado · ¡bien hecho!' : obj.text}</p></div><span class="objective-reward">${done ? '✓ obtenido' : obj.rewardText}</span>`;
      host.appendChild(row);
    });
  }
  function renderRanking() {
    const score = prestige() * 7 + state.buildings.length * 12 + state.military * 5 + state.day * 2;
    const entries = [
      { name: 'Duquesa Elowen', town: 'Liria del Lago', score: 248 + state.day * 2, avatar: 'E', color: 'rank-avatar' },
      { name: 'Lord Cedric', town: 'Piedraverde', score: 190 + state.day, avatar: 'C', color: 'rank-avatar' },
      { name: 'Tú · Valle de Roble', town: 'Tu asentamiento', score, avatar: 'E', color: 'rank-avatar player', player: true },
      { name: 'Barón Odran', town: 'Puerto del Cuervo', score: Math.max(39, 93 + state.day), avatar: 'O', color: 'rank-avatar' },
      { name: 'Lady Maelis', town: 'Prado Azul', score: Math.max(21, 61 + Math.floor(state.day / 2)), avatar: 'M', color: 'rank-avatar' }
    ].sort((a, b) => b.score - a.score);
    $('ranking').innerHTML = entries.map((e, i) => `<div class="rank-row"><span class="rank-num">${String(i + 1).padStart(2, '0')}</span><span class="${e.color}">${e.avatar}</span><span class="rank-name"><b>${e.name}</b><small>${e.town}</small></span><span class="rank-score">${e.score}<small>prestigio</small></span></div>`).join('');
  }
  function renderMilestone() {
    const done = state.completed.length;
    $('progress-text').textContent = `${done} / ${objectiveDefs.length}`;
    $('progress-fill').style.width = `${done / objectiveDefs.length * 100}%`;
    if (done >= 5) { $('age-heading').textContent = 'El comienzo de una era'; $('age-copy').textContent = 'Tu valle prospera bajo estandartes feudales. Sigue ampliando la ciudad y escala en la tabla de honor.'; }
    else if (done >= 2) { $('age-heading').textContent = 'Un asentamiento en expansión'; $('age-copy').textContent = 'Tu comunidad crece. Completa los siguientes hitos para desbloquear la era feudal.'; }
    else { $('age-heading').textContent = 'Una aldea con futuro'; $('age-copy').textContent = 'Cumple objetivos sencillos para descubrir nuevos edificios y hacer crecer tu reino.'; }
  }
  function renderTip() {
    let tip = 'Una gran ciudad comienza con una buena despensa. Construye una granja para alimentar a tu gente.';
    if (state.completed.includes('farm') && !state.completed.includes('manor')) tip = 'Mejorar tu casa solariega atrae nuevos habitantes y abre el camino al cuartel.';
    else if (state.completed.includes('manor') && !state.completed.includes('barracks')) tip = 'Un cuartel requiere madera, piedra y un poco de oro. ¡Tu guardia protegerá el valle!';
    else if (state.buildings.some(b => b.type === 'barracks') && state.military < 5) tip = 'Abre el cuartel y recluta soldados. Cada unidad cuesta 5 alimentos y 3 monedas.';
    else if (state.completed.includes('troops') && !state.completed.includes('forge')) tip = 'La mina de hierro se descubre tras organizar tu guardia. Luego podrás levantar una forja.';
    else if (state.completed.includes('forge')) tip = '¡Bienvenido a la era feudal! Una forja produce oro y tu ciudad ya figura entre los grandes reinos.';
    $('tip-text').textContent = tip;
  }
  function unlockedTypes() {
    const unlocked = ['lumber', 'quarry', 'farm'];
    if (state.completed.includes('farm')) unlocked.push('manor');
    if (state.completed.includes('manor')) unlocked.push('barracks');
    if (state.completed.includes('barracks')) unlocked.push('mine', 'market');
    if (state.completed.includes('troops')) unlocked.push('forge');
    if (state.completed.includes('forge')) unlocked.push('library');
    return [...new Set(unlocked)];
  }
  function openBuild(slot) {
    selectedSlot = slot;
    $('modal-content').innerHTML = `<span class="modal-kicker">PARCELA ${slot + 1} · DISTRITO CENTRAL</span><h2 class="modal-heading">¿Qué construiremos?</h2><p class="modal-desc">Elige un edificio para dar forma al futuro de tu ciudad.</p><div class="building-options" id="building-options"></div>`;
    const host = $('building-options');
    const unlocked = unlockedTypes();
    Object.entries(definitions).forEach(([type, def]) => {
      if (!unlocked.includes(type) || counts(type) >= def.max || (type === 'manor' && counts('manor') > 0)) return;
      const affordable = canAfford(def.cost);
      const yieldText = Object.entries(def.yield).map(([key, value]) => `+${value} ${resourceNames[key]} / día`).join(' · ') || (type === 'barracks' ? 'Permite entrenar soldados' : 'El centro de tu ciudad');
      const item = document.createElement('div'); item.className = 'building-option';
      item.innerHTML = `<span class="option-art">${def.icon}</span><span class="option-copy"><h3>${def.name}</h3><p>${def.desc}</p><span class="option-yield">${yieldText}</span></span><button class="option-buy" ${affordable ? '' : 'disabled'}>Construir<span class="cost-line">${costText(def.cost) || 'Gratis'}</span></button>`;
      item.querySelector('button').addEventListener('click', () => build(type, slot)); host.appendChild(item);
    });
    if (!host.children.length) host.innerHTML = '<p class="modal-desc">Aún no hay edificios disponibles. Completa los objetivos del consejo para descubrir nuevas construcciones.</p>';
    showModal();
  }
  function build(type, slot) {
    const def = definitions[type];
    if (state.buildings.length >= 9 || !canAfford(def.cost)) return;
    Object.entries(def.cost).forEach(([key, amount]) => state.resources[key] -= amount);
    state.buildings.push({ type, level: 1, slot });
    hideModal(); checkObjectives(); render(); notify(`${def.name} construido. ¡Tu ciudad prospera!`);
  }
  function openBuilding(slot) {
    const b = state.buildings.find(item => item.slot === slot); if (!b) return;
    const def = definitions[b.type];
    const nextCost = b.type === 'manor' ? { wood: 28 + (b.level - 1) * 15, stone: 20 + (b.level - 1) * 12, gold: 8 + (b.level - 1) * 5 } : { wood: 18 + b.level * 10, stone: 14 + b.level * 8, gold: 8 + b.level * 4 };
    const canUpgrade = b.type !== 'barracks' && b.type !== 'market' && b.type !== 'library' && b.level < 3;
    const productionText = Object.entries(def.yield).map(([key, value]) => `+${value * b.level} ${resourceNames[key]} cada día`).join(' · ') || (b.type === 'barracks' ? `${state.military} soldados · guarnición del valle` : `${population()} habitantes · centro de la ciudad`);
    const upgradeYield = Object.entries(def.yield).map(([key, value]) => `+${value} ${resourceNames[key]}`).join(' · ') || (b.type === 'manor' ? '+8 población' : 'Más capacidad y prestigio');
    $('modal-content').innerHTML = `<span class="modal-kicker">GESTIÓN DEL DISTRITO</span><div class="detail-hero"><span class="detail-art">${def.icon}</span><div><h2>${def.name}</h2><p>Nivel ${b.level} · ${def.desc}</p></div></div><div class="detail-stats"><div class="detail-stat"><small>PRODUCCIÓN</small><b>${productionText}</b></div><div class="detail-stat"><small>PRESTIGIO</small><b>+${(b.type === 'manor' ? 8 : 5) * b.level}</b></div><div class="detail-stat"><small>ESTADO</small><b>Activo</b></div></div><div class="detail-actions">${canUpgrade ? `<button class="action-btn primary" id="upgrade-btn" ${canAfford(nextCost) ? '' : 'disabled'}>Mejorar a nivel ${b.level + 1}<br><span class="cost-line">${costText(nextCost)}</span></button>` : ''}${b.type === 'barracks' ? `<button class="action-btn primary" id="recruit-btn" ${state.resources.food >= 5 && state.resources.gold >= 3 ? '' : 'disabled'}>Reclutar 1 soldado<br><span class="cost-line">✿ 5 alimento · ◉ 3 oro</span></button>` : ''}${b.type === 'forge' ? '<button class="action-btn" id="trade-btn">Cambiar 5 hierro por 12 oro</button>' : ''}<button class="action-btn" id="close-detail">Cerrar</button></div><p class="modal-note">Los edificios permanecen en tu ciudad y producen recursos al avanzar cada día.</p>`;
    if (canUpgrade) $('upgrade-btn').addEventListener('click', () => upgrade(b, nextCost));
    if (b.type === 'barracks') $('recruit-btn').addEventListener('click', recruit);
    if (b.type === 'forge') $('trade-btn').addEventListener('click', trade);
    $('close-detail').addEventListener('click', hideModal); showModal();
  }
  function upgrade(b, cost) {
    if (!canAfford(cost)) return;
    Object.entries(cost).forEach(([key, amount]) => state.resources[key] -= amount);
    b.level++; checkObjectives(); render(); openBuilding(b.slot); notify(`${definitions[b.type].name} mejorado al nivel ${b.level}.`);
  }
  function recruit() {
    if (state.resources.food < 5 || state.resources.gold < 3) return;
    state.resources.food -= 5; state.resources.gold -= 3; state.military++;
    checkObjectives(); render(); openBuilding(state.buildings.find(b => b.type === 'barracks').slot); notify('Un soldado se ha unido a tu guardia.');
  }
  function trade() {
    if (state.resources.iron < 5) { notify('Necesitas 5 de hierro para comerciar.'); return; }
    state.resources.iron -= 5; state.resources.gold += 12; render(); openBuilding(state.buildings.find(b => b.type === 'forge').slot); notify('Intercambio realizado: +12 oro.');
  }
  function checkObjectives() {
    objectiveDefs.forEach(obj => {
      if (!state.completed.includes(obj.id) && obj.check(state)) {
        state.completed.push(obj.id);
        Object.entries(obj.reward).forEach(([key, amount]) => state.resources[key] += amount);
        setTimeout(() => notify(`Objetivo completado: ${obj.title} · recompensa recibida`), 120);
      }
    });
  }
  function advanceDay() {
    const gains = production();
    Object.entries(gains).forEach(([key, amount]) => state.resources[key] += amount);
    state.day++;
    if (state.day > 48) { state.day = 1; state.year++; }
    checkObjectives(); render();
    const total = Object.entries(gains).filter(([, n]) => n > 0).map(([key, n]) => `+${n} ${resourceNames[key]}`).join(' · ');
    notify(total ? `Día avanzado · ${total}` : 'Día avanzado. Construye edificios para generar recursos.');
    const btn = $('advance-btn'); btn.animate?.([{ transform: 'scale(1)' }, { transform: 'scale(.96)' }, { transform: 'scale(1)' }], { duration: 230 });
  }
  function showModal() { $('modal-backdrop').classList.add('open'); $('modal-backdrop').setAttribute('aria-hidden', 'false'); }
  function hideModal() { $('modal-backdrop').classList.remove('open'); $('modal-backdrop').setAttribute('aria-hidden', 'true'); }
  function notify(message) { const el = $('toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2600); }

  $('advance-btn').addEventListener('click', advanceDay);
  $('modal-close').addEventListener('click', hideModal);
  $('modal-backdrop').addEventListener('click', e => { if (e.target === $('modal-backdrop')) hideModal(); });
  $('sound-btn').addEventListener('click', e => { state.sound = !state.sound; e.currentTarget.textContent = state.sound ? '♫' : '♪'; e.currentTarget.style.opacity = state.sound ? '1' : '.5'; notify(state.sound ? 'Sonido activado' : 'Sonido silenciado'); save(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') hideModal(); if (e.key === 'Enter' && !$('modal-backdrop').classList.contains('open') && !['BUTTON', 'INPUT'].includes(document.activeElement.tagName)) advanceDay(); });
  if (!state.sound) { $('sound-btn').textContent = '♪'; $('sound-btn').style.opacity = '.5'; }
  render();
})();
