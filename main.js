/* ============================================================
   main.js — Entry point
   ============================================================
   Fetches data.json, then wires up graph + both panels.
   Load order in index.html: graph.js → ui.js → creator.js → main.js
   ============================================================ */

fetch('data.json')
  .then(res => {
    if (!res.ok) throw new Error(`Failed to load data.json (${res.status})`);
    return res.json();
  })
  .then(data => {
    const graphState = initGraph(data);
    initDetailPanel(graphState);
    initCreatorPanel(graphState);

    // Export button — serialises the current live graph to JSON
    document.getElementById('btn-export').addEventListener('click', () => {
      graphState.exportJSON();
    });
  })
  .catch(err => {
    console.error('Argumentation graph init error:', err);
    document.body.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;height:100vh;
                  font-family:monospace;color:#e07777;background:#0e1a12;font-size:13px;">
        ⚠ Could not load data.json — make sure you're serving via HTTP (not file://).<br>
        <small style="color:#7a9e80;margin-top:8px;">${err.message}</small>
      </div>`;
  });
