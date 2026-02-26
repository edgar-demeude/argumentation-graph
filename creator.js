/* ============================================================
   creator.js — Left panel: new argument creation form
   ============================================================
   Call: initCreatorPanel(graphState)
   ============================================================ */

function initCreatorPanel(gs) {
  const { data, nodes } = gs;

  /* ── State: tag lists ─────────────────────────────────── */
  let attacksTags    = [];   // IDs this new node attacks
  let attackedByTags = [];   // IDs that attack this new node

  /* ── DOM references ───────────────────────────────────── */
  const inputId         = document.getElementById('new-id');
  const inputLabel      = document.getElementById('new-label');
  const selectCat       = document.getElementById('new-cat');
  const textaDesc       = document.getElementById('new-desc');
  const attacksInput    = document.getElementById('attacks-input');
  const attacksByInput  = document.getElementById('attackedby-input');
  const attacksTags_el  = document.getElementById('attacks-tags');
  const attacksByTags_el= document.getElementById('attackedby-tags');
  const createBtn       = document.getElementById('btn-create');
  const formError       = document.getElementById('form-error');
  const panelTitle      = document.querySelector('.sidebar-left .panel-header h2');

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

  function refreshId() {
    inputId.value = nextId();
  }

  refreshId();

  /* ── Tag input helpers ────────────────────────────────── */
  function buildDatalist() {
    // Rebuild datalists with current node IDs (called when graph changes)
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
    const color = data.colors[selectCat.value] || '#7a9e80';
    renderTags(attacksTags,    attacksTags_el,   '#e07777');
    renderTags(attackedByTags, attacksByTags_el, '#5dba6f');
  }

  function addTag(inputEl, arr) {
    const val = inputEl.value.trim().toUpperCase();
    if (!val) return;
    // Allow any ID: existing or future
    if (!arr.includes(val)) {
      arr.push(val);
      renderAllTags();
    }
    inputEl.value = '';
  }

  // Reset form to blank "create" state
  function resetForm() {
    attacksTags    = [];
    attackedByTags = [];
    renderAllTags();
    inputLabel.value = '';
    textaDesc.value  = '';
    buildDatalist();
    refreshId();
    formError.textContent      = '';
    createBtn.textContent      = 'Create argument';
    createBtn.style.background = '';
    if (panelTitle) panelTitle.textContent = 'New argument';
  }

  // Expose reset so ui.js can call it on deselect
  gs.resetCreatorForm = resetForm;

  // Populate form for editing an existing node
  gs.fillCreatorForm = function(node) {
    inputId.value    = node.id;
    inputLabel.value = node.label.replace(/\n/g, '\\n');
    selectCat.value  = node.cat;
    textaDesc.value  = node.desc || '';

    attacksTags    = [...node.attacks];
    attackedByTags = [...node.attackedBy];
    renderAllTags();

    createBtn.textContent = 'Update argument';
    if (panelTitle) panelTitle.textContent = 'Update argument';
  };

  // Modify the Create Button listener
  createBtn.addEventListener('click', () => {
    formError.textContent = ''; //

    const id    = inputId.value.trim();
    const label = inputLabel.value.trim();
    const cat   = selectCat.value;
    const desc  = textaDesc.value.trim();

    if (!id || !label || !cat) { 
      formError.textContent = 'ID, Label, and Category are required.'; 
      return; 
    }

    const newNodeData = {
      id,
      label:      label.replace(/\\n/g, '\n'),
      cat,
      desc:       desc || '',
      attacks:    [...attacksTags],
      attackedBy: [...attackedByTags],
    };

    // Check if we are updating or creating
    const existingNode = nodes.find(n => n.id === id);
    if (existingNode) {
      gs.updateNode(id, newNodeData);  // syncs links + redraws
      if (gs.recalculate) gs.recalculate();
      if (gs.deselect)    gs.deselect();
      resetForm();

      // Brief feedback before form is already reset
      createBtn.textContent      = '✓ Updated!';
      createBtn.style.background = data.colors[cat] + '33';
      setTimeout(() => {
        createBtn.textContent      = 'Create argument';
        createBtn.style.background = '';
      }, 1500);
    } else {
      gs.addNode(newNodeData); // Create new
      if (gs.recalculate) gs.recalculate();

      resetForm();

      // Feedback
      createBtn.textContent      = '✓ Created!';
      createBtn.style.background = data.colors[cat] + '33';
      setTimeout(() => {
        createBtn.textContent      = 'Create argument';
        createBtn.style.background = '';
      }, 1500);
    }
  });

  attacksInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(attacksInput, attacksTags); }
  });
  document.getElementById('btn-add-attack').addEventListener('click', () => addTag(attacksInput, attacksTags));

  attacksByInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(attacksByInput, attackedByTags); }
  });
  document.getElementById('btn-add-attackedby').addEventListener('click', () => addTag(attacksByInput, attackedByTags));

}