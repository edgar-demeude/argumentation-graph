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

    this.addBlock('Node score — extended h-categorizer', [
      { tex: String.raw`\sigma(a) = \frac{1 + \displaystyle\sum_{b\in Sup(a)}\phi(b,a)\sigma(b)}{2 + \displaystyle\sum_{b\in Att(a)}\phi(b,a)\sigma(b) + \displaystyle\sum_{b\in Sup(a)}\phi(b,a)\sigma(b)}` },
      { note: 'Base score: 0.5. Supporters raise σ(a) toward 1; attackers lower it toward 0.' },
    ]);

    this.addBlock('Notation', [
      { tex: String.raw`Att(a),\; Sup(a)` },
      { note: 'sets of attackers / supporters of a' },
      { tex: String.raw`\sigma(a) \in (0, 1)` },
      { note: 'gradual acceptability score of a' },
      { tex: String.raw`\phi(b,a) \in [0, 1]` },
      { note: 'link activation: σ(condition) if conditional, else 1' },
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
