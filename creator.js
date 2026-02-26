/* ============================================================
   creator.js — Left panel: argument creation & editing
   ============================================================
   Call: initCreatorPanel(graphState)
   ============================================================ */

function initCreatorPanel(gs) {
  const { data, nodes } = gs;

  /* ── State ────────────────────────────────────────────── */
  let attacksTags    = [];
  let attackedByTags = [];
  let editingId      = null;   // null = create mode, string = edit mode

  /* ── DOM references ───────────────────────────────────── */
  const inputId          = document.getElementById('new-id');
  const inputLabel       = document.getElementById('new-label');
  const selectCat        = document.getElementById('new-cat');
  const textaDesc        = document.getElementById('new-desc');
  const attacksInput     = document.getElementById('attacks-input');
  const attacksByInput   = document.getElementById('attackedby-input');
  const attacksTags_el   = document.getElementById('attacks-tags');
  const attacksByTags_el = document.getElementById('attackedby-tags');
  const formError        = document.getElementById('form-error');
  const btnRow           = document.getElementById('form-btn-row');
  const btnCreate        = document.getElementById('btn-create');
  const btnUpdate        = document.getElementById('btn-update');
  const btnDelete        = document.getElementById('btn-delete');
  const panelTitle       = document.querySelector('.sidebar-left .panel-header h2');

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
    ['attacks-list', 'attackedby-list'].forEach(listId => {
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
        if (container === attacksTags_el)  attacksTags    = attacksTags.filter(x => x !== id);
        else                               attackedByTags = attackedByTags.filter(x => x !== id);
        renderAllTags();
      });
    });
  }

  function renderAllTags() {
    renderTags(attacksTags,    attacksTags_el,   '#e07777');
    renderTags(attackedByTags, attacksByTags_el, '#5dba6f');
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
    attacksTags    = [];
    attackedByTags = [];
    renderAllTags();
    inputLabel.value  = '';
    textaDesc.value   = '';
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
    textaDesc.value  = node.desc || '';
    attacksTags      = [...node.attacks];
    attackedByTags   = [...node.attackedBy];
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

    if (!id || !label || !cat) {
      formError.textContent = 'ID, Label, and Category are required.';
      return null;
    }
    formError.textContent = '';
    return {
      id,
      label:      label.replace(/\\n/g, '\n'),
      cat,
      desc:       desc || '',
      attacks:    [...attacksTags],
      attackedBy: [...attackedByTags],
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

    // updateNode: rebuilds links, redraws, recomputes
    gs.updateNode(editingId, nodeData);
    if (gs.recalculate) gs.recalculate();
    if (gs.deselect)    gs.deselect();   // clears highlight + calls resetForm via gs.resetCreatorForm

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
      // Confirmed — delete
      gs.removeNode(editingId);
      if (gs.recalculate) gs.recalculate();
      if (gs.deselect)    gs.deselect();  // resets form too
    } else {
      // First click — ask for confirmation
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

  attacksByInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(attacksByInput, attackedByTags); }
  });
  document.getElementById('btn-add-attackedby').addEventListener('click', () => addTag(attacksByInput, attackedByTags));

}