/**
 * @fileoverview Renders the mathematical formula using KaTeX.
 */

export class Formula {
  /**
   * @param {string} containerSelector - Selector for the formula container.
   */
  constructor(containerSelector) {
    this.container = document.querySelector(containerSelector);
    this.init();
  }

  init() {
    if (typeof katex === 'undefined') {
      window.addEventListener('load', () => this.render());
    } else {
      this.render();
    }
  }

  /**
   * Renders the formula blocks into the container.
   */
  render() {
    if (!this.container || typeof katex === 'undefined') return;

    this.container.innerHTML = '';

    const select = document.getElementById('semantics-method');
    const method = select ? select.value : 'h-categorizer';

    switch (method) {
      case 'max-based':
        this.addBlock('Node score — Max-based', [
          { tex: String.raw`\sigma(a) = \frac{1 + \max \text{Sup}}{1 + \max \text{Att} + \max \text{Sup}} \times \text{States}(a)` },
          { note: 'Quality over quantity: only the strongest attacker/supporter counts.' },
        ]);
        break;
      case 'drastic':
        this.addBlock('Node score — Drastic', [
          { tex: String.raw`\sigma(a) = \text{Clamp}(\;(1 - \sum \text{Att}) \times (1 + \sum \text{Sup}) \times \text{States}(a)\;)` },
          { note: 'Attacker at 1.0 destroys target. Supports can compensate for low state values.' },
        ]);
        break;
      case 'drastic-linear':
        this.addBlock('Node score — Drastic (Linear)', [
          { tex: String.raw`\sigma(a) = \text{Clamp}(\;(1 - \sum \text{Att}) \times (1 + \sum \text{Sup})\;) \times \text{States}(a)` },
          { note: 'Linear state scaling: state value acts as a final filter (76% state = 0.76 max score).' },
        ]);
        break;
      case 'h-categorizer':
      default:
        this.addBlock('Node score — H-Categorizer', [
          { tex: String.raw`\sigma(a) = \frac{1 + \sum \text{Sup}}{1 + \sum \text{Att} + \sum \text{Sup}} \times \text{States}(a)` },
          { note: 'Standard gradual semantics: every attacker and supporter contributes fractional influence.' },
        ]);
    }

    this.addBlock('Notation', [
      { tex: String.raw`\text{States}(a)` },
      { note: 'State multipliers: (SupporterState %) × (1 - AttackerState %)' },
      { tex: String.raw`\text{Clamp}(x)` },
      { note: 'Result limited to the [0, 1] range.' },
    ]);
  }

  /**
   * Helper to add a titled block with math and notes.
   */
  addBlock(title, lines) {
    const block = document.createElement('div');
    block.className = 'formula-block';
    
    if (title) {
      const t = document.createElement('div');
      t.className = 'formula-title';
      t.textContent = title;
      block.appendChild(t);
    }
    
    lines.forEach(({ tex, note, isSmall }) => {
      if (note) {
        const row = document.createElement('div');
        row.className = 'formula-note' + (isSmall ? ' formula-note--small' : '');
        row.textContent = note;
        block.appendChild(row);
      } else {
        const math = document.createElement('div');
        math.className = 'formula-math';
        try { 
          katex.render(tex, math, { displayMode: true, throwOnError: false }); 
        } catch(e) { 
          math.textContent = tex; 
        }
        block.appendChild(math);
      }
    });
    
    this.container.appendChild(block);
  }
}
