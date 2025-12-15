// levels and helper
const levels = [
    { id: 1, target: 70, drops: 0, shape: 'shape-standard', rise: 1 },
    { id: 2, target: 85, drops: 3, shape: 'shape-neck', rise: 1.2 },
    { id: 3, target: 45, drops: 6, shape: 'shape-erlenmeyer', rise: 0.8 },
    { id: 4, target: 60, drops: 4, shape: 'shape-martini', rise: 1.5 },
    { id: 5, target: 72, drops: 5, shape: 'shape-chalice', rise: 1.1 },
    { id: 6, target: 95, drops: 1, shape: 'shape-martini', riseSpeed: 1.5 },
    { id: 7, target: 52, drops: 4, shape: 'shape-wide', riseSpeed: 1.0 },
    { id: 8, target: 78, drops: 6, shape: 'shape-neck', riseSpeed: 1.25 },
    { id: 9, target: 40, drops: 7, shape: 'shape-bulb', riseSpeed: 0.9 },
    { id: 10, target: 66, drops: 5, shape: 'shape-chalice', riseSpeed: 1.7 },
    { id: 11, target: 74, drops: 4, shape: 'shape-standard', riseSpeed: 1.2, trough: { type: 'inverted-triangle', capacity: 6, width: 80, height: 36, top: 356 } },
    { id: 12, target: 68, drops: 5, shape: 'shape-chalice', riseSpeed: 1.1, trough: { type: 'shallow-box', capacity: 5, width: 100, height: 28, top: 340 } },
    { id: 13, target: 80, drops: 3, shape: 'shape-wide', riseSpeed: 1.3, trough: { type: 'long-channel', capacity: 8, width: 140, height: 28, top: 348 } },
    // Level 14: pink slow-flow water. `hideDrops` hides the residual count from the UI.
        { id: 14, target: 75, drops: 6, shape: 'shape-standard', riseSpeed: 0.9, color: '#ff66cc', flowMultiplier: 0.6, hideDrops: true, noWaves: true },
    // Additional pink paint-like levels (different bottles)
    { id: 15, target: 70, drops: 5, shape: 'shape-neck', riseSpeed: 0.85, color: '#ff99d9', flowMultiplier: 0.55, hideDrops: true, noWaves: true },
    { id: 16, target: 78, drops: 6, shape: 'shape-chalice', riseSpeed: 0.8, color: '#ff66b3', flowMultiplier: 0.5, hideDrops: true, noWaves: true },
    { id: 17, target: 65, drops: 7, shape: 'shape-bulb', riseSpeed: 0.9, color: '#ffb3e6', flowMultiplier: 0.65, hideDrops: true, noWaves: true },
];

// helper: darken a hex color by a factor (0..1)
function darkenColor(hex, factor) {
    if (!hex) return hex;
    let c = hex.replace('#','');
    if (c.length === 3) c = c.split('').map(ch=>ch+ch).join('');
    const num = parseInt(c,16);
    let r = (num >> 16) & 0xff;
    let g = (num >> 8) & 0xff;
    let b = num & 0xff;
    r = Math.max(0, Math.min(255, Math.floor(r * (1 - factor))));
    g = Math.max(0, Math.min(255, Math.floor(g * (1 - factor))));
    b = Math.max(0, Math.min(255, Math.floor(b * (1 - factor))));
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

// expose to global scope
window.levels = levels;
window.darkenColor = darkenColor;
