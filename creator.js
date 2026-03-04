/* ============================================================
   creator.js — Left panel: argument creation & editing
   ============================================================ */

function initCreatorPanel(gs) {
  const { data, nodes } = gs;

  /* ── State ────────────────────────────────────────────── */
  let attacksTags      = [];
  let supportsTags     = [];
  let influencesTags   = [];
  let editingId        = null;

  /* ── DOM references ───────────────────────────────────── */
  const inputId            = document.getElementById('new-id');
  const inputLabel         = document.getElementById('new-label');
  const selectCat          = document.getElementById('new-cat');
  const textaDesc          = document.getElementById('new-desc');
  
  // Dynamically create Value slider for State nodes
  const valueInputGroup    = document.createElement('div');
  valueInputGroup.className = 'field-group';
  valueInputGroup.id = 'new-value-group';
  valueInputGroup.innerHTML = `
    <label for="new-value">Initial Value</label>
    <div class="weight-item" style="padding: 0; background: transparent; border: none;">
      <div class="weight-label" style="margin-bottom: 5px;">
        <span class="weight-val" id="new-value-label">0.50</span>
      </div>
      <input id="new-value" type="range" min="0" max="1" step="0.01" value="0.5" class="weight-range">
    </div>
  `;
  textaDesc.parentNode.insertBefore(valueInputGroup, textaDesc.nextSibling);
  
  const inputValue         = document.getElementById('new-value');
  const inputValueLabel    = document.getElementById('new-value-label');

  const attacksInput       = document.getElementById('attacks-input');
  const supportsInput      = document.getElementById('supports-input');
  const influencesInput    = document.getElementById('influences-input');
  const influencesCondition = document.getElementById('influences-condition');
  
  const attacksTags_el     = document.getElementById('attacks-tags');
  const supportsTags_el    = document.getElementById('supports-tags');
  const influencesTags_el  = document.getElementById('influences-tags');
  
  const formError          = document.getElementById('form-error');
  const btnRow             = document.getElementById('form-btn-row');
  const btnCreate          = document.getElementById('btn-create');
  const btnDelete          = document.getElementById('btn-delete');
  const panelTitle         = document.querySelector('.sidebar-left .panel-header h2');

  /* ── Populate category dropdown ───────────────────────── */
  Object.entries(data.cats).forEach(([key, label]) => {
    const opt = document.createElement('option');
    opt.value = key; opt.textContent = label;
    selectCat.appendChild(opt);
  });

  function nextId() {
    const nums = gs.nodes.map(n => parseInt(n.id.replace(/\D/g, ''), 10)).filter(n => !isNaN(n));
    return `A${(nums.length ? Math.max(...nums) : 0) + 1}`;
  }

  function buildDatalist() {
    ['attacks-list', 'supports-list', 'influences-list'].forEach(id => {
      const dl = document.getElementById(id);
      if (dl) {
        dl.innerHTML = '';
        gs.nodes.forEach(n => { const opt = document.createElement('option'); opt.value = n.id; dl.appendChild(opt); });
      }
    });

    if (influencesCondition) {
      const currentVal = influencesCondition.value;
      influencesCondition.innerHTML = '<option value="">Condition</option>';
      gs.nodes.filter(n => n.cat === 'state').forEach(n => {
        const labelText = n.label.replace('\n', ' ');
        // Normal
        const opt = document.createElement('option');
        opt.value = n.id; opt.textContent = `if ${n.id} (${labelText})`;
        influencesCondition.appendChild(opt);
        // Inverse
        const optInv = document.createElement('option');
        optInv.value = `!${n.id}`; optInv.textContent = `if NOT ${n.id} (not ${labelText})`;
        influencesCondition.appendChild(optInv);
      });
      influencesCondition.value = currentVal;
    }
  }
  buildDatalist();

  function triggerRealTimeUpdate() {
    if (!editingId) return;
    const data = collectFormData();
    if (!data) return;
    gs.updateNode(editingId, data);
    if (gs.recalculate) gs.recalculate();
  }

  [inputId, inputLabel, textaDesc].forEach(el => el.addEventListener('input', () => { if (editingId) triggerRealTimeUpdate(); }));
  inputValue.addEventListener('input', () => { inputValueLabel.textContent = parseFloat(inputValue.value).toFixed(2); if (editingId) triggerRealTimeUpdate(); });
  selectCat.addEventListener('change', () => { toggleValueInput(); if (editingId) triggerRealTimeUpdate(); });

  function toggleValueInput() {
    valueInputGroup.style.display = (selectCat.value === 'state') ? 'block' : 'none';
  }
  toggleValueInput();

  /* ── Tag rendering ────────────────────────────────────── */
  function renderTags(arr, container, color) {
    container.innerHTML = arr.map(item => {
      const id = typeof item === 'string' ? item : item.id;
      const cond = typeof item === 'object' ? item.conditionId : null;
      let condLabel = cond;
      if (cond && cond.startsWith('!')) condLabel = `NOT ${cond.substring(1)}`;
      
      return `
        <span class="creator-tag" style="border-color:${color}44;color:${color}">
          ${id}${cond ? `<small style="opacity:0.7;margin-left:4px">[if ${condLabel}]</small>` : ''}
          <button class="tag-remove" data-id="${id}" data-cond="${cond || ''}" style="color:${color}">×</button>
        </span>
      `;
    }).join('');

    container.querySelectorAll('.tag-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id, cond = btn.dataset.cond;
        if (container === attacksTags_el) attacksTags = attacksTags.filter(x => x !== id);
        else if (container === supportsTags_el) supportsTags = supportsTags.filter(x => x !== id);
        else influencesTags = influencesTags.filter(x => !(x.id === id && x.conditionId === cond));
        renderAllTags();
      });
    });
  }

  function renderAllTags(skipUpdate = false) {
    renderTags(attacksTags,  attacksTags_el,  '#e07777');
    renderTags(supportsTags, supportsTags_el, '#4caf78');
    renderTags(influencesTags, influencesTags_el, '#ffffff');
    if (editingId && !skipUpdate) triggerRealTimeUpdate();
  }

  function addTag(inputEl, condEl, arr, isInfluence = false) {
    const targetId = inputEl.value.trim().toUpperCase();
    if (!targetId) return;
    const condId = condEl ? condEl.value : null;

    if (isInfluence) {
      if (!condId) { alert("Please select a condition state for dynamic influence."); return; }
      if (!arr.some(x => x.id === targetId && x.conditionId === condId)) arr.push({ id: targetId, conditionId: condId });
    } else {
      if (!arr.includes(targetId)) arr.push(targetId);
    }
    renderAllTags();
    inputEl.value = ''; if (condEl) condEl.value = '';
  }

  /* ── Actions ─────────────────────────────────────── */
  function resetForm() {
    editingId = null; attacksTags = []; supportsTags = []; influencesTags = [];
    inputLabel.value = ''; textaDesc.value = ''; inputValue.value = '0.5'; inputValueLabel.textContent = '0.50';
    toggleValueInput(); formError.textContent = ''; buildDatalist(); inputId.value = nextId();
    setCreateMode(); renderAllTags(true);
  }
  gs.resetCreatorForm = resetForm;

  gs.fillCreatorForm = function(node) {
    inputId.value = node.id; inputLabel.value = node.label.replace(/\n/g, '\\n'); selectCat.value = node.cat;
    toggleValueInput(); textaDesc.value = node.desc || '';
    if (node.value !== undefined) { inputValue.value = node.value; inputValueLabel.textContent = parseFloat(node.value).toFixed(2); }
    attacksTags = [...(node.attacks || [])]; supportsTags = [...(node.supports || [])]; influencesTags = [...(node.influences || [])];
    formError.textContent = ''; setEditMode(node.id); renderAllTags(true);
  };

  function collectFormData() {
    const id = inputId.value.trim(), label = inputLabel.value.trim(), cat = selectCat.value;
    if (!id || !label || !cat) return null;
    return { id, label: label.replace(/\\n/g, '\n'), cat, desc: textaDesc.value.trim(), value: (cat === 'state') ? parseFloat(inputValue.value) : undefined, attacks: [...attacksTags], supports: [...supportsTags], influences: [...influencesTags] };
  }

  function setCreateMode() { editingId = null; btnRow.classList.remove('edit-mode'); if (panelTitle) panelTitle.textContent = 'New argument'; btnCreate.style.display = 'block'; }
  function setEditMode(id) { editingId = id; btnRow.classList.add('edit-mode'); if (panelTitle) panelTitle.textContent = 'Update argument'; btnCreate.style.display = 'none'; }

  btnCreate.addEventListener('click', () => { const d = collectFormData(); if (!d) return; gs.addNode(d); if (gs.recalculate) gs.recalculate(); resetForm(); });
  btnDelete.addEventListener('click', () => { if (!editingId) return; if (btnDelete.dataset.confirm === 'true') { gs.removeNode(editingId); if (gs.recalculate) gs.recalculate(); gs.deselect(); } else { btnDelete.dataset.confirm = 'true'; btnDelete.textContent = 'Confirm?'; setTimeout(() => { btnDelete.dataset.confirm = 'false'; btnDelete.textContent = 'Delete argument'; }, 3000); } });

  document.getElementById('btn-add-attack').addEventListener('click', () => addTag(attacksInput, null, attacksTags));
  document.getElementById('btn-add-support').addEventListener('click', () => addTag(supportsInput, null, supportsTags));
  document.getElementById('btn-add-influence').addEventListener('click', () => addTag(influencesInput, influencesCondition, influencesTags, true));
  
  attacksInput.addEventListener('keydown', e => { if (e.key === 'Enter') addTag(attacksInput, null, attacksTags); });
  supportsInput.addEventListener('keydown', e => { if (e.key === 'Enter') addTag(supportsInput, null, supportsTags); });
  influencesInput.addEventListener('keydown', e => { if (e.key === 'Enter') addTag(influencesInput, influencesCondition, influencesTags, true); });
}