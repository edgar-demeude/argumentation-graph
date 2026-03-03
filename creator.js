/* ============================================================
   creator.js — Left panel: argument creation & editing
   ============================================================
   Call: initCreatorPanel(graphState)
   ============================================================ */

function initCreatorPanel(gs) {
  const { data, nodes } = gs;

  /* ── State ────────────────────────────────────────────── */
  let attacksTags      = [];
  let supportsTags     = [];
  let editingId        = null;   // null = create mode, string = edit mode

  /* ── DOM references ───────────────────────────────────── */
  const inputId            = document.getElementById('new-id');
  const inputLabel         = document.getElementById('new-label');
  const selectCat          = document.getElementById('new-cat');
  const textaDesc          = document.getElementById('new-desc');
  const valueInputGroup    = document.createElement('div');
  valueInputGroup.className = 'field-group';
  valueInputGroup.id = 'new-value-group';
  valueInputGroup.innerHTML = `
    <label for="new-value">Initial Value (0-1)</label>
    <input id="new-value" type="number" step="0.1" min="0" max="1" class="field-input" value="0.5">
  `;
  textaDesc.parentNode.insertBefore(valueInputGroup, textaDesc.nextSibling);
  const inputValue = document.getElementById('new-value');
  
  function toggleValueInput() {
    valueInputGroup.style.display = (selectCat.value === 'state') ? 'block' : 'none';
  }
  selectCat.addEventListener('change', toggleValueInput);
  toggleValueInput();

  const attacksInput       = document.getElementById('attacks-input');
  const supportsInput      = document.getElementById('supports-input');
  const attacksTags_el     = document.getElementById('attacks-tags');
  const supportsTags_el    = document.getElementById('supports-tags');
  const formError          = document.getElementById('form-error');
  const btnRow             = document.getElementById('form-btn-row');
  const btnCreate          = document.getElementById('btn-create');
  const btnUpdate          = document.getElementById('btn-update');
  const btnDelete          = document.getElementById('btn-delete');
  const panelTitle         = document.querySelector('.sidebar-left .panel-header h2');

  /* ── Populate category dropdown ───────────────────────── */
  Object.entries(data.cats).forEach(([key, label]) => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = label;
    selectCat.appendChild(opt);
  });

  /* ── Auto-generate next ID ────────────────────────────── */
  function nextId() {
    const nums = nodes
      .map(n => parseInt(n.id.replace(/\D/g, ''), 10))
      .filter(n => !isNaN(n));
    const max = nums.length ? Math.max(...nums) : 0;
    return `A${max + 1}`;
  }

  /* ── Datalists ────────────────────────────────────────── */
  function buildDatalist() {
    ['attacks-list', 'supports-list'].forEach(listId => {
      const dl = document.getElementById(listId);
      dl.innerHTML = '';
      nodes.forEach(n => {
        const opt = document.createElement('option');
        opt.value = n.id;
        dl.appendChild(opt);
      });
    });
  }
  buildDatalist();

  /* ── Tag rendering ────────────────────────────────────── */
  function renderTags(arr, container, color) {
    container.innerHTML = arr.map(id => `
      <span class="creator-tag" style="border-color:${color}44;color:${color}">
        ${id}
        <button class="tag-remove" data-id="${id}" style="color:${color}">×</button>
      </span>
    `).join('');
    container.querySelectorAll('.tag-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        if (container === attacksTags_el)     attacksTags     = attacksTags.filter(x => x !== id);
        else if (container === supportsTags_el)   supportsTags    = supportsTags.filter(x => x !== id);
        renderAllTags();
      });
    });
  }

  function renderAllTags() {
    renderTags(attacksTags,     attacksTags_el,     '#e07777');
    renderTags(supportsTags,    supportsTags_el,    '#4caf78');
  }

  function addTag(inputEl, arr) {
    const val = inputEl.value.trim().toUpperCase();
    if (!val) return;
    if (!arr.includes(val)) { arr.push(val); renderAllTags(); }
    inputEl.value = '';
  }

  /* ── Mode switching ───────────────────────────────────── */
  function setCreateMode() {
    editingId = null;
    btnRow.classList.remove('edit-mode');
    if (panelTitle) panelTitle.textContent = 'New argument';
    resetDeleteBtn();
  }

  function setEditMode(id) {
    editingId = id;
    btnRow.classList.add('edit-mode');
    if (panelTitle) panelTitle.textContent = 'Update argument';
    resetDeleteBtn();
  }

  /* ── Reset form ───────────────────────────────────────── */
  function resetForm() {
    attacksTags     = [];
    supportsTags    = [];
    renderAllTags();
    inputLabel.value      = '';
    textaDesc.value       = '';
    if (inputValue) inputValue.value = '0.5';
    if (toggleValueInput) toggleValueInput();
    formError.textContent = '';
    buildDatalist();
    inputId.value = nextId();
    setCreateMode();
  }

  gs.resetCreatorForm = resetForm;

  /* ── Fill form for editing ────────────────────────────── */
  gs.fillCreatorForm = function(node) {
    inputId.value    = node.id;
    inputLabel.value = node.label.replace(/\n/g, '\\n');
    selectCat.value  = node.cat;
    if (toggleValueInput) toggleValueInput();
    textaDesc.value  = node.desc || '';
    if (node.value !== undefined && inputValue) inputValue.value = node.value;
    attacksTags      = [...(node.attacks     || [])];
    supportsTags     = [...(node.supports    || [])];
    formError.textContent = '';
    renderAllTags();
    setEditMode(node.id);
  };

  /* ── Collect form data ────────────────────────────────── */
  function collectFormData() {
    const id    = inputId.value.trim();
    const label = inputLabel.value.trim();
    const cat   = selectCat.value;
    const desc  = textaDesc.value.trim();
    const val   = inputValue ? parseFloat(inputValue.value) : 0.5;

    if (!id || !label || !cat) {
      formError.textContent = 'ID, Label, and Category are required.';
      return null;
    }
    formError.textContent = '';
    return {
      id,
      label:       label.replace(/\\n/g, '\n'),
      cat,
      desc:        desc || '',
      value:       (cat === 'state') ? val : undefined,
      attacks:     [...attacksTags],
      supports:    [...supportsTags],
    };
  }

  /* ── CREATE button ────────────────────────────────────── */
  btnCreate.addEventListener('click', () => {
    const nodeData = collectFormData();
    if (!nodeData) return;

    if (nodes.find(n => n.id === nodeData.id)) {
      formError.textContent = `ID "${nodeData.id}" already exists.`;
      return;
    }

    gs.addNode(nodeData);
    if (gs.recalculate) gs.recalculate();

    resetForm();

    btnCreate.textContent      = '✓ Created!';
    btnCreate.style.background = data.colors[nodeData.cat] + '33';
    setTimeout(() => {
      btnCreate.textContent      = 'Create argument';
      btnCreate.style.background = '';
    }, 1500);
  });

  /* ── UPDATE button ────────────────────────────────────── */
  btnUpdate.addEventListener('click', () => {
    const nodeData = collectFormData();
    if (!nodeData) return;
    if (!editingId) return;

    gs.updateNode(editingId, nodeData);
    if (gs.recalculate) gs.recalculate();
    if (gs.deselect)    gs.deselect();

    btnUpdate.textContent      = '✓ Updated!';
    btnUpdate.style.background = data.colors[nodeData.cat] + '33';
    setTimeout(() => {
      btnUpdate.textContent      = 'Update argument';
      btnUpdate.style.background = '';
    }, 1500);
  });

  /* ── DELETE button ────────────────────────────────────── */
  function resetDeleteBtn() {
    btnDelete.textContent      = 'Delete argument';
    btnDelete.dataset.confirm  = 'false';
    btnDelete.style.background = '';
  }

  btnDelete.addEventListener('click', () => {
    if (!editingId) return;

    if (btnDelete.dataset.confirm === 'true') {
      gs.removeNode(editingId);
      if (gs.recalculate) gs.recalculate();
      if (gs.deselect)    gs.deselect();
    } else {
      btnDelete.textContent     = '⚠ Confirm?';
      btnDelete.dataset.confirm = 'true';
      btnDelete.style.background = '#c0392b44';
      setTimeout(() => {
        if (btnDelete.dataset.confirm === 'true') resetDeleteBtn();
      }, 3000);
    }
  });

  /* ── Tag keyboard/button listeners ───────────────────── */
  attacksInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(attacksInput, attacksTags); }
  });
  document.getElementById('btn-add-attack').addEventListener('click', () => addTag(attacksInput, attacksTags));

  supportsInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(supportsInput, supportsTags); }
  });
  document.getElementById('btn-add-support').addEventListener('click', () => addTag(supportsInput, supportsTags));
}