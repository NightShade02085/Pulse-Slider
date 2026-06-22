
(() => {
  const data = window.APP_DATA;
  const searchInput = document.getElementById('searchInput');
  const searchDropdown = document.getElementById('searchDropdown');
  const searchClear = document.getElementById('searchClear');
  const stateLayer = document.getElementById('stateLayer');
  const cityLayer = document.getElementById('cityLayer');
  const mapScene = document.getElementById('mapScene');
  const mapViewport = document.getElementById('mapViewport');
  const infoTitle = document.getElementById('infoTitle');
  const infoText = document.getElementById('infoText');
  const helpModal = document.getElementById('helpModal');

  document.getElementById('stateCount').textContent = data.states.length;
  document.getElementById('cityCount').textContent = data.cities.length;
  document.getElementById('majorCount').textContent = data.cities.filter(c => c.major).length;

  let scale = 0.72;
  let tx = 20;
  let ty = 12;
  let dragging = false;
  let dotsVisible = true;
  let dragStartX = 0;
  let dragStartY = 0;
  let baseTx = 0;
  let baseTy = 0;

  function applyTransform() {
    mapScene.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
  }

  function clampPan() {
    const vw = mapViewport.clientWidth;
    const vh = mapViewport.clientHeight;
    const w = 1499 * scale;
    const h = 1055 * scale;

    if (w <= vw) {
      tx = (vw - w) / 2;
    } else {
      const minX = vw - w - 20;
      const maxX = 20;
      tx = Math.max(minX, Math.min(maxX, tx));
    }

    if (h <= vh) {
      ty = (vh - h) / 2;
    } else {
      const minY = vh - h - 20;
      const maxY = 20;
      ty = Math.max(minY, Math.min(maxY, ty));
    }
  }

  function zoomToRect(x, y, w, h, title, text) {
    const vw = mapViewport.clientWidth;
    const vh = mapViewport.clientHeight;
    const pad = 50;
    const targetScale = Math.max(0.72, Math.min(4.2, Math.min((vw - pad) / w, (vh - pad) / h)));
    scale = targetScale;
    tx = (vw - (w * scale)) / 2 - (x * scale);
    ty = (vh - (h * scale)) / 2 - (y * scale);
    clampPan();
    applyTransform();
    if (title) infoTitle.textContent = title;
    if (text) infoText.textContent = text;
  }

  function zoomToPoint(x, y, scaleTarget, title, text) {
    const vw = mapViewport.clientWidth;
    const vh = mapViewport.clientHeight;
    scale = Math.max(0.72, Math.min(6, scaleTarget));
    tx = (vw / 2) - (x * scale);
    ty = (vh / 2) - (y * scale);
    clampPan();
    applyTransform();
    if (title) infoTitle.textContent = title;
    if (text) infoText.textContent = text;
  }

  function renderStates() {
    stateLayer.innerHTML = '';
    data.states.forEach(s => {
      const el = document.createElement('button');
      el.className = 'state-hitbox';
      el.style.left = s.x + 'px';
      el.style.top = s.y + 'px';
      el.style.width = s.w + 'px';
      el.style.height = s.h + 'px';
      el.title = s.name;
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        zoomToRect(s.x, s.y, s.w, s.h, s.name, `Zoomed to ${s.name}. Click another state, city, or use search.`);
      });
      stateLayer.appendChild(el);
    });
  }

  function shouldShowLabel(city) {
    return city.major || ["Louisville","Springfield","Boston","Chicago","New York","Washington","Atlanta","Seattle","Los Angeles","San Diego","Denver","Phoenix","Houston","Miami"].includes(city.name);
  }

  function renderCities() {
    cityLayer.innerHTML = '';
    data.cities.forEach(c => {
      const dot = document.createElement('button');
      dot.className = 'city-dot' + (c.major ? ' major' : '');
      dot.style.left = c.x + 'px';
      dot.style.top = c.y + 'px';
      dot.title = `${c.name}, ${c.state}`;
      dot.addEventListener('click', (e) => {
        e.stopPropagation();
        zoomToPoint(c.x, c.y, c.major ? 3.3 : 4.1, `${c.name}, ${c.stateCode}`, `${c.county}. Click and drag to pan around nearby areas.`);
      });
      cityLayer.appendChild(dot);

      if (shouldShowLabel(c)) {
        const label = document.createElement('div');
        label.className = 'dot-label';
        label.style.left = c.x + 'px';
        label.style.top = c.y + 'px';
        label.textContent = c.name;
        cityLayer.appendChild(label);
      }
    });
  }

  function searchAll(q) {
    const query = q.trim().toLowerCase();
    if (!query) return [];
    const stateMatches = data.states
      .filter(s => s.name.toLowerCase().includes(query) || s.code.toLowerCase().includes(query))
      .map(s => ({type:'state', score: s.name.toLowerCase().startsWith(query) ? 0 : 1, ...s}));

    const cityMatches = data.cities
      .filter(c =>
        c.name.toLowerCase().includes(query) ||
        c.state.toLowerCase().includes(query) ||
        `${c.name}, ${c.state}`.toLowerCase().includes(query)
      )
      .map(c => ({type:'city', score: c.name.toLowerCase().startsWith(query) ? 0 : 1, ...c}));

    return [...stateMatches, ...cityMatches]
      .sort((a,b) => a.score - b.score || (a.name || '').localeCompare(b.name || ''))
      .slice(0, 12);
  }

  function renderDropdown(items) {
    if (!items.length) {
      searchDropdown.classList.add('hidden');
      searchDropdown.innerHTML = '';
      return;
    }
    searchDropdown.classList.remove('hidden');
    searchDropdown.innerHTML = '';

    items.forEach(item => {
      const div = document.createElement('div');
      div.className = 'search-item';
      if (item.type === 'state') {
        div.innerHTML = `<div class="search-line1"><span class="search-name">${item.name}</span><span class="search-state">${item.code}</span></div><div class="search-line2">State</div>`;
        div.addEventListener('click', () => {
          zoomToRect(item.x, item.y, item.w, item.h, item.name, `Zoomed to ${item.name}.`);
          searchInput.value = item.name;
          searchDropdown.classList.add('hidden');
        });
      } else {
        div.innerHTML = `<div class="search-line1"><span class="search-name">${item.name},</span><span class="search-state">${item.state}</span></div><div class="search-line2">${item.county}</div>`;
        div.addEventListener('click', () => {
          zoomToPoint(item.x, item.y, item.major ? 3.3 : 4.1, `${item.name}, ${item.stateCode}`, `${item.county}.`);
          searchInput.value = `${item.name}, ${item.state}`;
          searchDropdown.classList.add('hidden');
        });
      }
      searchDropdown.appendChild(div);
    });
  }

  searchInput.addEventListener('input', () => renderDropdown(searchAll(searchInput.value)));
  searchInput.addEventListener('focus', () => renderDropdown(searchAll(searchInput.value)));

  document.addEventListener('click', (e) => {
    if (!searchDropdown.contains(e.target) && e.target !== searchInput) searchDropdown.classList.add('hidden');
  });

  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    searchDropdown.classList.add('hidden');
    searchInput.focus();
  });

  function zoomAroundCenter(mult) {
    const cx = mapViewport.clientWidth / 2;
    const cy = mapViewport.clientHeight / 2;
    const old = scale;
    const next = Math.max(0.72, Math.min(6, scale * mult));
    tx = cx - ((cx - tx) / old) * next;
    ty = cy - ((cy - ty) / old) * next;
    scale = next;
    clampPan();
    applyTransform();
  }

  document.getElementById('zoomInBtn').addEventListener('click', () => zoomAroundCenter(1.2));
  document.getElementById('zoomOutBtn').addEventListener('click', () => zoomAroundCenter(1/1.2));

  function resetView() {
    scale = 0.72;
    tx = 20;
    ty = 12;
    clampPan();
    applyTransform();
    infoTitle.textContent = 'Ready';
    infoText.textContent = 'Select a state, city, or search result.';
    searchInput.value = '';
    searchDropdown.classList.add('hidden');
  }

  document.getElementById('centerBtn').addEventListener('click', resetView);
  document.getElementById('resetBtn').addEventListener('click', resetView);

  document.getElementById('toggleDotsBtn').addEventListener('click', () => {
    dotsVisible = !dotsVisible;
    cityLayer.style.display = dotsVisible ? 'block' : 'none';
  });

  document.getElementById('helpBtn').addEventListener('click', () => helpModal.classList.remove('hidden'));
  document.getElementById('closeHelpBtn').addEventListener('click', () => helpModal.classList.add('hidden'));
  helpModal.addEventListener('click', (e) => { if (e.target === helpModal) helpModal.classList.add('hidden'); });

  mapScene.addEventListener('pointerdown', (e) => {
    dragging = true;
    mapScene.classList.add('dragging');
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    baseTx = tx;
    baseTy = ty;
    try { mapScene.setPointerCapture(e.pointerId); } catch (_) {}
  });
  mapScene.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    tx = baseTx + (e.clientX - dragStartX);
    ty = baseTy + (e.clientY - dragStartY);
    clampPan();
    applyTransform();
  });
  function endDrag(e) {
    dragging = false;
    mapScene.classList.remove('dragging');
    try { mapScene.releasePointerCapture(e.pointerId); } catch (_) {}
  }
  mapScene.addEventListener('pointerup', endDrag);
  mapScene.addEventListener('pointercancel', endDrag);

  mapScene.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = mapViewport.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const old = scale;
    const next = Math.max(0.72, Math.min(6, e.deltaY < 0 ? scale * 1.12 : scale / 1.12));
    tx = px - ((px - tx) / old) * next;
    ty = py - ((py - ty) / old) * next;
    scale = next;
    clampPan();
    applyTransform();
  }, {passive:false});

  window.addEventListener('resize', () => {
    clampPan();
    applyTransform();
  });

  renderStates();
  renderCities();
  resetView();
})();
