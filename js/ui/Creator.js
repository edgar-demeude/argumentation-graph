/**
 * @fileoverview Logic for the left sidebar (node creation and editing).
 */

export class Creator {
  /**
   * @param {GraphState} graphState 
   */
  constructor(graphState) {
    this.state = graphState;
    this.editingId = null;

    // DOM references
    this.form = document.getElementById('creator-form');
    this.inputId = document.getElementById('new-id');
    this.inputLabel = document.getElementById('new-label');
    this.selectCat = document.getElementById('new-cat');
    this.textaDesc = document.getElementById('new-desc');
    
    // Dynamically created initial value group (for states)
    this.valueInputGroup = this.createValueInput();
    this.inputValue = document.getElementById('new-value');
    this.inputValueLabel = document.getElementById('new-value-label');

    this.attacksInput = document.getElementById('attacks-input');
    this.supportsInput = document.getElementById('supports-input');
    
    this.attacksTagsContainer = document.getElementById('attacks-tags');
    this.supportsTagsContainer = document.getElementById('supports-tags');
    
    this.btnCreate = document.getElementById('btn-create');
    this.btnDelete = document.getElementById('btn-delete');
    this.btnRow = document.getElementById('form-btn-row');
    this.panelTitle = document.querySelector('.sidebar-left .panel-header h2');

    this.attacksTags = [];
    this.supportsTags = [];

    this.init();
  }

  init() {
    this.populateCategories();
    this.reset();
    this.setupEventListeners();
    
    // External hook for selection change
    this.state.onSelectionChange = (node) => {
      if (node) this.fill(node);
      else this.reset();
    };
  }

  createValueInput() {
    const group = document.createElement('div');
    group.className = 'field-group';
    group.id = 'new-value-group';
    group.innerHTML = `
      <label for="new-value">Initial Value</label>
      <div class="weight-item" style="padding: 0; background: transparent; border: none;">
        <div class="weight-label" style="margin-bottom: 5px;">
          <span class="weight-val" id="new-value-label">0.50</span>
        </div>
        <input id="new-value" type="range" min="0" max="1" step="0.01" value="0.5" class="weight-range">
      </div>
    `;
    this.textaDesc.parentNode.insertBefore(group, this.textaDesc.nextSibling);
    return group;
  }

  populateCategories() {
    Object.entries(this.state.cats).forEach(([key, label]) => {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = label;
      this.selectCat.appendChild(opt);
    });
  }

  setupEventListeners() {
    const triggerUpdate = () => { if (this.editingId) this.liveUpdate(); };

    [this.inputId, this.inputLabel, this.textaDesc].forEach(el => {
      el.addEventListener('input', triggerUpdate);
    });

    this.inputValue.addEventListener('input', () => {
      this.inputValueLabel.textContent = parseFloat(this.inputValue.value).toFixed(2);
      if (this.editingId) this.liveUpdate();
    });

    this.selectCat.addEventListener('change', () => {
      this.toggleValueVisibility();
      if (this.editingId) this.liveUpdate();
    });

        // Tag management
        document.getElementById('btn-add-attack').addEventListener('click', () => this.addTag('attack'));
        document.getElementById('btn-add-support').addEventListener('click', () => this.addTag('support'));
    
        this.btnCreate.addEventListener('click', () => this.handleCreate());
        this.btnDelete.addEventListener('click', () => this.handleDelete());
      }
    
      toggleValueVisibility() {
        this.valueInputGroup.style.display = (this.selectCat.value === 'state') ? 'block' : 'none';
      }
    
      generateNextId() {
        const ids = this.state.nodes.map(n => parseInt(n.id.replace(/\D/g, ''), 10)).filter(n => !isNaN(n));
        return `A${(ids.length ? Math.max(...ids) : 0) + 1}`;
      }
    
      reset() {
        this.editingId = null;
        this.attacksTags = [];
        this.supportsTags = [];
        this.inputLabel.value = '';
        this.textaDesc.value = '';
        this.inputValue.value = '0.5';
        this.inputValueLabel.textContent = '0.50';
        this.inputId.value = this.generateNextId();
        this.toggleValueVisibility();
        this.renderAllTags();
        this.setMode('create');
        this.updateDatalists();
      }
    
      fill(node) {
        this.editingId = node.id;
        this.inputId.value = node.id;
        this.inputLabel.value = node.label.replace(/\n/g, '\\n');
        this.selectCat.value = node.cat;
        this.textaDesc.value = node.desc || '';
        
        if (node.value !== undefined) {
          this.inputValue.value = node.value;
          this.inputValueLabel.textContent = parseFloat(node.value).toFixed(2);
        }
        
        this.attacksTags = [...(node.attacks || [])];
        this.supportsTags = [...(node.supports || [])];
    
        this.toggleValueVisibility();
        this.renderAllTags();
        this.setMode('edit');
        this.updateDatalists();
      }
    
      setMode(mode) {
        if (mode === 'create') {
          this.btnRow.classList.remove('edit-mode');
          if (this.panelTitle) this.panelTitle.textContent = 'New node';
          this.btnCreate.style.display = 'block';
        } else {
          this.btnRow.classList.add('edit-mode');
          if (this.panelTitle) this.panelTitle.textContent = 'Update node';
          this.btnCreate.style.display = 'none';
        }
      }
    
      updateDatalists() {
        ['attacks-list', 'supports-list'].forEach(id => {
          const dl = document.getElementById(id);
          if (dl) {
            dl.innerHTML = '';
            this.state.nodes.forEach(n => {
              const opt = document.createElement('option');
              opt.value = n.id;
              dl.appendChild(opt);
            });
          }
        });
      }
    
      addTag(type) {
        if (type === 'attack') {
          const val = this.attacksInput.value.trim().toUpperCase();
          if (val && !this.attacksTags.includes(val)) this.attacksTags.push(val);
          this.attacksInput.value = '';
        } else if (type === 'support') {
          const val = this.supportsInput.value.trim().toUpperCase();
          if (val && !this.supportsTags.includes(val)) this.supportsTags.push(val);
          this.supportsInput.value = '';
        }
        this.renderAllTags();
        if (this.editingId) this.liveUpdate();
      }
    
      renderAllTags() {
        const render = (arr, container, color) => {
          container.innerHTML = arr.map(item => {
            const id = typeof item === 'string' ? item : item.id;
            return `
              <span class="creator-tag" style="border-color:${color}44; color:${color}">
                ${id}
                <button class="tag-remove" data-id="${id}" style="color:${color}">×</button>
              </span>
            `;
          }).join('');
    
          container.querySelectorAll('.tag-remove').forEach(btn => {
            btn.onclick = () => {
              const id = btn.dataset.id;
              if (container === this.attacksTagsContainer) this.attacksTags = this.attacksTags.filter(x => x !== id);
              else if (container === this.supportsTagsContainer) this.supportsTags = this.supportsTags.filter(x => x !== id);
              this.renderAllTags();
              if (this.editingId) this.liveUpdate();
            };
          });
        };
    
        render(this.attacksTags, this.attacksTagsContainer, '#e07777');
        render(this.supportsTags, this.supportsTagsContainer, '#4caf78');
      }
    
      collectData() {
        const id = this.inputId.value.trim();
        const label = this.inputLabel.value.trim().replace(/\\n/g, '\n');
        const cat = this.selectCat.value;
        if (!id || !label) return null;
    
        return {
          id,
          label,
          cat,
          desc: this.textaDesc.value.trim(),
          value: cat === 'state' ? parseFloat(this.inputValue.value) : undefined,
          attacks: [...this.attacksTags],
          supports: [...this.supportsTags]
        };
      }
  liveUpdate() {
    const data = this.collectData();
    if (!data) return;
    this.state.updateNode(this.editingId, data);
    this.editingId = data.id; // In case ID was renamed
  }

  handleCreate() {
    const data = this.collectData();
    if (!data) return;
    this.state.addNode(data);
    this.reset();
  }

  handleDelete() {
    if (!this.editingId) return;
    if (this.btnDelete.dataset.confirm === 'true') {
      this.state.removeNode(this.editingId);
      this.reset();
    } else {
      this.btnDelete.dataset.confirm = 'true';
      this.btnDelete.textContent = 'Confirm?';
      setTimeout(() => {
        this.btnDelete.dataset.confirm = 'false';
        this.btnDelete.textContent = 'Delete node';
      }, 3000);
    }
  }
}
