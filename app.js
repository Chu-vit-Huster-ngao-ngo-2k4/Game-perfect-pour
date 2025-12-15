// Main app script (moved from index.html)
const sfx = {
    pour: new Howl({ src: ['pour.mp3'], loop: true, volume: 0 }),
    drip: new Howl({ src: ['drip.mp3'], volume: 0.5 }),
    win: new Howl({ src: ['https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3'], volume: 0.5 })
};

// trough presets registry and render helper
const troughPresets = {
    'inverted-triangle': {
        clipPath: 'polygon(0 0, 100% 0, 50% 100%)',
        outletPositions: { left: 0.18, right: 0.82 }
    },
    'shallow-box': {
        clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0% 100%)',
        outletPositions: { left: 0.18, right: 0.82 }
    },
    'long-channel': {
        clipPath: 'polygon(6% 0, 94% 0, 94% 100%, 6% 100%)',
        outletPositions: { left: 0.14, right: 0.86 }
    }
};

function renderTrough(cfg) {
    window.troughEl = document.getElementById('trough');
    if (!window.troughEl) return;
    if (!cfg) {
        window.troughEl.style.display = 'none';
        stopOverflowStreams();
        return;
    }
    const preset = cfg.type && troughPresets[cfg.type] ? troughPresets[cfg.type] : null;
    const width = (cfg.width || (preset ? 80 : 80));
    const height = (cfg.height || (preset ? 36 : 36));
    const top = (typeof cfg.top !== 'undefined') ? cfg.top : 356;
    const capacity = cfg.capacity || window.troughCapacity || 6;

    window.troughEl.style.display = 'block';
    window.troughEl.style.width = width + 'px';
    window.troughEl.style.height = height + 'px';
    window.troughEl.style.top = top + 'px';
    window.troughEl.style.left = '50%'; window.troughEl.style.transform = 'translateX(-50%)';

    const shape = window.troughEl.querySelector('.trough-shape');
    if (shape) {
        shape.style.width = width + 'px';
        shape.style.height = height + 'px';
        const clip = (cfg.clipPath || (preset ? preset.clipPath : null));
        if (clip) {
            shape.style.clipPath = clip;
            const fillEl = window.troughEl.querySelector('.trough-fill');
            if (fillEl) fillEl.style.clipPath = clip;
        }
    }

    const mask = window.troughEl.querySelector('.trough-mask');
    if (mask) mask.style.height = '0%';
    window.troughEl.querySelector('.trough-indicator').innerText = '0 giọt';

    window.troughCapacity = capacity; window.troughAmount = 0;
    window.troughEl._outlet = (preset && preset.outletPositions) ? preset.outletPositions : { left: 0.18, right: 0.82 };
}

// shared state
let currentLv = 0, fill = 0, rotation = 0, isDragging = false, gameActive = true, hasStarted = false, isDraining = false, startX = 0, rotationAtStart = 0;
let boostBottleMode = 1.0, activeBoostMargin = false;
let troughAmount = 0, troughCapacity = 6; window.troughEl = null;
let paintPulseEnd = 0, paintJitter = 1.0;
let residualPaintEnd = 0, residualPaintRate = 0, spoutResidue = 0, paintWasFlowing = false;
let residualStart = 0, residualDur = 0, residualStreamEnd = 0;
let paintFlowVel = 0; let paintFlowSmooth = 0; let residualLastDrip = 0;
let mechanicTutActive = false;
let boosterTutActive = false;
let totalCoins = parseInt(localStorage.getItem('perfectPourCoins')) || 0;

function updateCoinUI() {
    document.getElementById('coin-count').innerText = totalCoins;
    localStorage.setItem('perfectPourCoins', totalCoins);
}

function populatePicker() {
    const select = document.getElementById('lv-select');
    window.levels.forEach((l, i) => {
        const opt = document.createElement('option');
        opt.value = i; opt.innerText = "Level " + l.id;
        select.appendChild(opt);
    });
    document.getElementById('lv-btn').onclick = () => { currentLv = parseInt(select.value); init(); };
}

const boostBtnScale = document.getElementById('boost-scale');
const bModal = document.getElementById('booster-modal');
boostBtnScale.onclick = () => {
    if (boostBottleMode !== 1.0) { boostBottleMode = 1.0; boostBtnScale.classList.remove('active'); document.getElementById('glass').style.transform = "scaleX(1)"; }
    else { bModal.style.display = 'flex'; }
};
document.getElementById('opt-expand').onclick = () => { boostBottleMode = 1.1; applyBottleScale(); };
document.getElementById('opt-shrink').onclick = () => { boostBottleMode = 0.9; applyBottleScale(); };
document.getElementById('opt-cancel').onclick = () => { bModal.style.display = 'none'; };
function applyBottleScale() { bModal.style.display = 'none'; boostBtnScale.classList.add('active'); document.getElementById('glass').style.transform = `scaleX(${boostBottleMode})`; }

document.getElementById('boost-margin').onclick = function() {
    activeBoostMargin = !activeBoostMargin;
    this.classList.toggle('active');
    const lv = window.levels[currentLv];
    const tolerance = activeBoostMargin ? 4.5 : 2.5;
    document.getElementById('target-zone').style.height = (tolerance * 2) + "%";
    document.getElementById('target-zone').style.bottom = (lv.target - tolerance) + "%";
};

function createBubble() {
    const wf = document.querySelector('.water-fill');
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    const size = Math.random() * 8 + 4;
    bubble.style.width = size + 'px'; bubble.style.height = size + 'px';
    bubble.style.left = (50 + (Math.random() - 0.5) * 20) + '%';
    wf.appendChild(bubble);
    setTimeout(() => bubble.remove(), 1800);
}

function updateTutorialUI() {
    const tutLayer = document.getElementById('tutorial-layer');
    // keep mechanic/booster tutorials visible even on non-zero levels when active
    if ((currentLv !== 0 || isDraining) && !mechanicTutActive && !boosterTutActive) { tutLayer.style.display = 'none'; return; }
    tutLayer.style.display = 'flex';
    const handImg = document.getElementById('hand-img');
    const tutTxt = document.getElementById('tut-txt');
    if (!hasStarted) { handImg.className = 'hand-icon anim-right'; tutTxt.innerHTML = "NHẤN GIỮ & KÉO SANG PHẢI<br>ĐỂ MỞ VÒI NƯỚC"; }
    else if (rotation > 10) { handImg.className = 'hand-icon anim-left'; tutTxt.innerHTML = `NƯỚC ĐANG DÂNG!<br>KÉO VỀ TRÁI ĐỂ KHÓA VAN`; }
}

function showMechanicTutorial(lv, force) {
    if (!lv) return;
    const key = `mechanicTutShown_${lv.id}`;
    if (!force && localStorage.getItem(key)) return; // already shown (unless forced)
    mechanicTutActive = true;
    const tutLayer = document.getElementById('tutorial-layer');
    const handImg = document.getElementById('hand-img');
    const tutTxt = document.getElementById('tut-txt');
    handImg.style.display = 'none';
    // level-specific mechanic text
    if (lv.id === 1) {
        tutTxt.innerHTML = `<b>HƯỚNG DẪN</b><br>Kéo sang phải để mở vòi và giữ để đổ nước vào bình. Kéo sang trái và thả để khóa vòi.`;
    } else if (lv.id === 2) {
        tutTxt.innerHTML = `<b>CHÚ Ý</b><br>Chú ý số lượng giọt nước dư ở trong vòi còn sót lại. Nó sẽ làm tăng mực nước trong bình`;
    } else if (lv.trough) {
        tutTxt.innerHTML = `<b>MÁNG (LEVEL ${lv.id})</b><br>Ở màn này có máng đặt dưới vòi. Máng sẽ chứa nước, tràn hai bên khi đầy và khi bạn khóa van, máng sẽ thả các giọt xuống.`;
    } else if (lv.noWaves || lv.color) {
        tutTxt.innerHTML = `<b>SƠN / MÀU (LEVEL ${lv.id})</b><br>Ở màn này chất lỏng là sơn màu; chảy chậm hơn và không có gợn sóng. Số giọt dư được ẩn — bạn sẽ không biết trước.`;
    } else {
        mechanicTutActive = false; tutLayer.style.display = 'none'; return;
    }
    tutLayer.style.pointerEvents = 'auto';
    tutLayer.style.display = 'flex';
    // dismiss on click and remember
    const hide = () => {
        tutLayer.style.display = 'none';
        tutLayer.style.pointerEvents = 'none';
        handImg.style.display = '';
        mechanicTutActive = false;
        localStorage.setItem(key, '1');
        tutLayer.removeEventListener('click', hide);
    };
    tutLayer.addEventListener('click', hide);
}

function showBoosterTutorial(lv) {
    if (!lv) return;
    const key = `boosterTutShown_${lv.id}`;
    if (localStorage.getItem(key)) return; // already shown
    boosterTutActive = true;
    const tutLayer = document.getElementById('tutorial-layer');
    const handImg = document.getElementById('hand-img');
    const tutTxt = document.getElementById('tut-txt');
    handImg.style.display = 'none';
    tutTxt.innerHTML = `<b>BOOSTERS (LEVEL ${lv.id})</b><br>Hai booster nằm ở góc trái: <br>🧪 'Biến hình lọ' thay đổi kích thước lọ.<br>🎯 'Tăng vùng mục tiêu' mở rộng vùng mục tiêu. Nhấn vào biểu tượng booster để kích hoạt.`;
    tutLayer.style.pointerEvents = 'auto';
    tutLayer.style.display = 'flex';
    const hide = () => {
        tutLayer.style.display = 'none';
        tutLayer.style.pointerEvents = 'none';
        handImg.style.display = '';
        boosterTutActive = false;
        localStorage.setItem(key, '1');
        tutLayer.removeEventListener('click', hide);
    };
    tutLayer.addEventListener('click', hide);
}

function init() {
    const lv = window.levels[currentLv];
    // Remove any paint configuration to disable paint mechanics entirely
    if (lv && lv.paint) delete lv.paint;
    // Clear any residual/paint state so previous paint runs don't persist
    residualPaintEnd = 0; residualPaintRate = 0; spoutResidue = 0; paintWasFlowing = false;
    residualStart = 0; residualDur = 0; residualStreamEnd = 0;
    paintFlowVel = 0; paintFlowSmooth = 0; residualLastDrip = 0;
    document.getElementById('level-indicator').innerText = `LEVEL ${lv.id}`;
    document.getElementById('target-txt').innerText = lv.target + "%";
    // Optionally hide the residual drop count (e.g., for special levels)
    if (lv.hideDrops) document.getElementById('drops-txt').innerText = '?'; else document.getElementById('drops-txt').innerText = lv.drops;
    const tolerance = activeBoostMargin ? 4.5 : 2.5;
    document.getElementById('target-zone').style.bottom = (lv.target - tolerance) + "%";
    document.getElementById('target-zone').style.height = (tolerance * 2) + "%";
    document.getElementById('glass').className = lv.shape;
    document.getElementById('glass').style.transform = `scaleX(${boostBottleMode})`;
    fill = 0; rotation = 0; isDraining = false; hasStarted = false; gameActive = true;
    document.querySelector('.water-fill').style.height = '0%';
    document.getElementById('valve').style.transform = 'rotate(0deg)';
    document.getElementById('popup').style.display = 'none';
    document.getElementById('coin-reward').style.display = 'none';
    document.getElementById('game-container').style.filter = "none";
    updateCoinUI();
    sfx.pour.stop();
    updateUI(0);
    // reset tutorial active flags to avoid carry-over between levels
    mechanicTutActive = false; boosterTutActive = false;
    const tutLayer = document.getElementById('tutorial-layer');
    if (tutLayer) { tutLayer.style.display = 'none'; tutLayer.style.pointerEvents = 'none'; }
    updateTutorialUI();

    // Only show tutorials on these levels: 1, 2, 11, 14
    if ([1,2,11,14].includes(lv.id)) showMechanicTutorial(lv, true);
    // Booster tutorial: keep only for level 2
    if (lv.id === 2) showBoosterTutorial(lv);

    window.troughEl = document.getElementById('trough');
    if (lv.trough) {
        renderTrough(lv.trough);
    } else {
        if (window.troughEl) { window.troughEl.style.display = 'none'; stopOverflowStreams(); }
    }
    try {
        const wf = document.querySelector('.water-fill');
        const troughFill = document.querySelector('#trough .trough-fill');
        // Priority: explicit `lv.color` (for coloured water levels), then legacy `lv.paint`, else default blue
        if (lv.color) {
            const paintColor = lv.color;
            const darker = window.darkenColor(paintColor, 0.35);
            if (wf) wf.style.background = `linear-gradient(180deg, ${paintColor}, ${darker})`;
            if (troughFill) troughFill.style.background = paintColor;
            document.documentElement.style.setProperty('--water-color', paintColor);
        } else if (lv.paint) {
            const paintColor = lv.paint.color || '#ff66cc';
            const darker = window.darkenColor(paintColor, 0.35);
            if (wf) wf.style.background = `linear-gradient(180deg, ${paintColor}, ${darker})`;
            if (troughFill) troughFill.style.background = paintColor;
            document.documentElement.style.setProperty('--water-color', paintColor);
        } else {
            if (wf) wf.style.background = 'linear-gradient(180deg, #4fc3f7, #1565c0)';
            if (troughFill) troughFill.style.background = '';
            document.documentElement.style.setProperty('--water-color', '#4fc3f7');
        }
        // Toggle wave visuals for levels marked with `noWaves` (paint-like appearance)
        if (wf) {
            if (lv.noWaves) wf.classList.add('no-waves'); else wf.classList.remove('no-waves');
        }
        if (troughFill) {
            if (lv.noWaves) troughFill.classList.add('no-waves'); else troughFill.classList.remove('no-waves');
        }
    } catch (e) { }
}

const handleStart = (e) => {
    if(!gameActive || isDraining) return;
    isDragging = true;
    startX = (e.clientX || e.touches[0].clientX);
    rotationAtStart = rotation;
    if (!sfx.pour.playing()) sfx.pour.play();
};

const handleMove = (e) => {
    if(!isDragging || !gameActive) return;
    const x = (e.clientX || e.touches[0].clientX);
    rotation = Math.min(Math.max(rotationAtStart + (x - startX), 0), 160);
    if (rotation > 10) { hasStarted = true; updateTutorialUI(); }
    const intensity = rotation / 160;
    sfx.pour.volume(intensity);
    if (hasStarted && rotation < 2) { isDragging = false; sfx.pour.stop(); startDraining(); }
    updateUI(intensity);
};

function updateUI(intensity) {
    document.getElementById('valve').style.transform = `rotate(${rotation}deg)`;
    document.getElementById('meter-fill').style.width = (intensity * 100) + "%";
    const s = document.getElementById('stream');
    // If valve effectively closed and there's no residual stream, ensure the stream UI is hidden
    const residualActiveCheck = Date.now() < residualStreamEnd;
    if (intensity <= 0.001 && !residualActiveCheck) {
        // Valve fully closed and no residual — force-reset paint flow state to avoid UI getting stuck
        paintFlowSmooth = 0;
        paintWasFlowing = false;
        s.style.opacity = 0; s.style.height = '0px'; s.style.width = '0px'; s.style.animationDuration = '0s';
        return;
    }
    if (intensity > 0.05 || Date.now() < residualStreamEnd) {
        const lv = window.levels[currentLv];
        const residualActive = Date.now() < residualStreamEnd;
        // If this is a paint-active level we'd previously allow the stream to persist
        // while closing; since paint mechanics are disabled, nothing extra needed here.
        s.style.opacity = 1;
        let effectiveIntensity = intensity;
        if (lv && lv.paint) {
            effectiveIntensity = Math.min(1, (paintFlowSmooth / 0.06) || 0.001);
            // During residual stream window, cap the visible intensity so a previously
            // large `paintFlowSmooth` doesn't keep the stream at max indefinitely.
            if (Date.now() < residualStreamEnd) {
                if (paintFlowSmooth < 0.0005) {
                    effectiveIntensity = Math.max(effectiveIntensity, 0.06);
                }
                effectiveIntensity = Math.min(effectiveIntensity, 0.12);
            }
            const paintColor = lv.paint.color || '#ff66cc';
            s.style.background = `linear-gradient(90deg, transparent 15%, rgba(255,255,255,0.18) 25%, transparent 35%, rgba(255,255,255,0.12) 75%, transparent 85%), repeating-linear-gradient(180deg, rgba(255,255,255,0.15) 0px, transparent 2px, transparent 30px), ${paintColor}`;
            s.style.boxShadow = `0 0 18px ${paintColor}`;
            s.style.width = (8 + effectiveIntensity * 36) + "px";
            s.style.animationDuration = '0.6s';
        } else {
            s.style.width = (4 + intensity * 20) + "px";
            s.style.animationDuration = '0.2s';
        }
        const waterFill = document.querySelector('.water-fill');
        const gcRect = document.getElementById('game-container').getBoundingClientRect();
        const wfRect = waterFill.getBoundingClientRect();
        const waterSurfaceY = wfRect.top - gcRect.top;
        const streamTop = s.offsetTop;
            if (window.troughEl && window.troughEl.style.display !== 'none') {
            const troughTop = window.troughEl.offsetTop;
            const desired = Math.max(6, troughTop - streamTop - 6);
            s.style.height = desired + "px";
        } else {
            const desiredHeight = Math.max(6, waterSurfaceY - streamTop);
            s.style.height = desiredHeight + "px";
            if (desiredHeight > 6 && Math.random() < 0.15 + intensity * 0.2) {
                const isPaint = window.levels[currentLv] && window.levels[currentLv].paint;
                createSplashEffect(waterSurfaceY, s.offsetLeft + s.offsetWidth / 2, !!isPaint);
            }
        }
    } else { s.style.height = "0"; s.style.opacity = 0; }
}

function startDraining() {
    if(isDraining) return;
    const lvImmediate = window.levels[currentLv];
    if (lvImmediate && lvImmediate.paint && paintWasFlowing) {
        const now = Date.now();
        paintWasFlowing = false;
        const dur = 800 + Math.random() * 2200;
        residualStart = now; residualDur = dur;
        residualPaintEnd = now + dur;
        residualPaintRate = (spoutResidue > 0) ? (spoutResidue / (dur / 1000)) : (0.02 + Math.random() * 0.06);
        const streamDur = 250 + (spoutResidue * 600) + Math.random() * 300;
        residualStreamEnd = now + streamDur;
        spoutResidue = 0;
    }
    isDraining = true; rotation = 0; updateUI(0);
    updateTutorialUI();
    stopOverflowStreams();

    function startValveDrops() {
        return new Promise((resolve) => {
            let drops = window.levels[currentLv].drops, count = 0;
            const interval = setInterval(() => {
                if(count < drops) {
                    const d = document.createElement('div');
                    const isPaint = window.levels[currentLv] && window.levels[currentLv].paint;
                    d.className = isPaint ? 'paint-drop' : 'drop';
                    document.getElementById('game-container').appendChild(d);
                    sfx.drip.play(); createBubble(); createBubble();
                    setTimeout(() => {
                        const waterFill = document.querySelector('.water-fill');
                        const gcRect = document.getElementById('game-container').getBoundingClientRect();
                        const wfRect = waterFill.getBoundingClientRect();
                        const waterSurfaceY = wfRect.top - gcRect.top;
                        createTinySplash(waterSurfaceY, 180, false, !!isPaint);
                        d.remove();
                    }, isPaint ? 700 : 350);
                    let mult = window.levels[currentLv].rise || window.levels[currentLv].riseSpeed;
                    if(window.levels[currentLv].shape === 'shape-neck' && fill > 40) mult = 2.5;
                    const visc = (window.levels[currentLv].paint && window.levels[currentLv].paint.viscousFactor) ? window.levels[currentLv].paint.viscousFactor : 1;
                    const dryShrink = (window.levels[currentLv].paint && typeof window.levels[currentLv].paint.dryShrink !== 'undefined') ? window.levels[currentLv].paint.dryShrink : (window.levels[currentLv].paint ? 0.02 : 0);
                    fill += (1.4 * mult * (1 / boostBottleMode) * visc) * (1 - dryShrink);
                    document.querySelector('.water-fill').style.height = Math.min(fill, 100) + "%";
                    count++;
                } else {
                    clearInterval(interval);
                    setTimeout(() => { resolve(); }, 800);
                }
            }, 500);
        });
    }

    if (lvImmediate.trough && troughAmount > 0) {
        const totalNow = troughAmount;
        troughAmount = 0;
        const maskNow = window.troughEl.querySelector('.trough-mask'); if (maskNow) maskNow.style.height = '0%';
        if (window.troughEl) window.troughEl.querySelector('.trough-indicator').innerText = '0 giọt';
        releaseTroughSequential(totalNow).then(() => { startValveDrops().then(check); });
    } else {
        startValveDrops().then(check);
    }
}

function check() {
    gameActive = false;
    const lv = window.levels[currentLv];
    const diff = Math.abs(fill - lv.target);
    document.getElementById('game-container').style.filter = "blur(10px)";
    document.getElementById('popup').style.display = 'flex';
    const toleranceThreshold = activeBoostMargin ? 4.5 : 2.5;
    if(diff <= toleranceThreshold) {
        document.getElementById('status').innerText = "THÀNH CÔNG!";
        document.getElementById('status').style.color = "#2e7d32";
        document.getElementById('next-btn').style.display = 'block';
        document.getElementById('coin-reward').style.display = 'block';
        sfx.win.play();
        totalCoins += 40; updateCoinUI();
    } else {
        document.getElementById('status').innerText = "THẤT BẠI!";
        document.getElementById('status').style.color = "#d32f2f";
        document.getElementById('next-btn').style.display = 'none';
    }
    document.getElementById('desc').innerText = `KẾT QUẢ: ${fill.toFixed(1)}% / MỤC TIÊU: ${lv.target}%`;
}

const v = document.getElementById('valve');
v.addEventListener('mousedown', handleStart);
window.addEventListener('mousemove', handleMove);
window.addEventListener('mouseup', () => isDragging = false);
v.addEventListener('touchstart', (e) => { e.preventDefault(); handleStart(e); });
window.addEventListener('touchmove', (e) => { handleMove(e); });
window.addEventListener('touchend', () => isDragging = false);
document.getElementById('next-btn').onclick = () => { currentLv = (currentLv + 1) % window.levels.length; init(); };
document.getElementById('retry-btn').onclick = init;

function loop() {
    const now = Date.now();
    if(gameActive && !isDraining) {
        const lv = window.levels[currentLv];
        let mult = lv.rise || lv.riseSpeed;
        if(lv.shape === 'shape-neck' && fill > 40) mult = 2.8;
        const percent = rotation / 160;
        let delta = 0;
        if (lv.paint) {
            const visc = lv.paint.viscousFactor || 1;
            if (now > paintPulseEnd) {
                if (Math.random() < (lv.paint.pulseProb || 0.02)) {
                    paintPulseEnd = now + (lv.paint.pulseDuration || 600);
                    paintJitter = (lv.paint.pulseMultiplier || 3.5);
                } else {
                    paintJitter = 1 + (Math.random() - 0.5) * 0.6;
                }
            }
            const rawPerFrame = percent * 0.45 * mult * (1 / boostBottleMode);
            let targetPerFrame = 0;
                const flowScale = (lv.paint.flowScale !== undefined) ? lv.paint.flowScale : 0.5;
                // If valve opened past threshold we start paint flow. Once started, keep flowing
                // until the valve is fully closed (percent ~= 0). Only after fully closed do we
                // switch to residual dripping.
                if (percent >= 0.3) {
                    targetPerFrame = rawPerFrame * (lv.paint.baseFlow || 1) * paintJitter * flowScale;
                    if (!paintWasFlowing) {
                        paintWasFlowing = true;
                        spoutResidue = Math.random() * (lv.paint.residueMax || 0.8);
                    }
                } else {
                    // Valve is below start threshold. If paint was flowing, keep flowing proportional
                    // to the current valve position until the valve is fully closed (percent <= ~0).
                    if (paintWasFlowing && percent > 0.001) {
                        targetPerFrame = rawPerFrame * (lv.paint.baseFlow || 1) * paintJitter * flowScale;
                    } else {
                        // Valve is essentially closed — end active flow and begin residual behavior
                        if (paintWasFlowing) {
                            paintWasFlowing = false;
                            const dur = 800 + Math.random() * 2200;
                            residualPaintEnd = now + dur;
                            residualStart = now; residualDur = dur;
                            residualPaintRate = (spoutResidue > 0) ? (spoutResidue / (dur / 1000)) : (0.02 + Math.random() * 0.06);
                            const streamDur = 250 + (spoutResidue * 600) + Math.random() * 300;
                            residualStreamEnd = now + streamDur;
                            spoutResidue = 0;
                        }
                        if (now < residualStreamEnd) {
                            targetPerFrame = (residualPaintRate || 0.02) / 60 * flowScale;
                        } else {
                            targetPerFrame = 0;
                        }
                    }
                }
            // base smoothing (viscous inertia)
            let alpha = 0.03 * (visc);
            // If the valve is below the paint start threshold (closing phase),
            // accelerate smoothing so `paintFlowSmooth` decays quickly and the
            // visible stream doesn't stay at a previous peak.
            if (percent < 0.3) {
                alpha = Math.max(alpha, 0.12);
            }
            paintFlowSmooth += (targetPerFrame - paintFlowSmooth) * alpha;
            delta = paintFlowSmooth;
        } else {
            if (rotation > 5) delta = percent * 0.45 * mult * (1 / boostBottleMode);
        }
        const dryShrink = (lv.paint && typeof lv.paint.dryShrink !== 'undefined') ? lv.paint.dryShrink : (lv.paint ? 0.02 : 0);
        if (lv.trough) {
            const captureFraction = 1.0;
            let capture = delta * captureFraction;
            let spill = delta - capture;
            if (troughAmount + capture > troughCapacity) {
                const overflow = troughAmount + capture - troughCapacity;
                capture -= overflow; spill += overflow;
            }
            troughAmount += capture;
            if (window.troughEl) {
                const pct = Math.min(1, troughAmount / troughCapacity);
                const mask = window.troughEl.querySelector('.trough-mask');
                if (mask) mask.style.height = (pct * 100) + '%';
                const dropsCount = Math.round(troughAmount);
                window.troughEl.querySelector('.trough-indicator').innerText = dropsCount + ' giọt';
                window.troughEl.style.display = 'block';
            }
            if (spill > 0) {
                fill += spill * (1 - dryShrink);
                document.querySelector('.water-fill').style.height = Math.min(fill, 100) + "%";
            }
            if (troughAmount >= troughCapacity - 1e-6 && spill > 0) startOverflowStreams(); else stopOverflowStreams();
        } else {
            fill += delta * (1 - dryShrink);
        }
        document.querySelector('.water-fill').style.height = Math.min(fill, 100) + "%";
        updateUI(percent);
        if (fill >= 100) { fill = 100; startDraining(); }
    }
    const now2 = Date.now();
    const rate = residualPaintRate || 0.02;
        if (now2 < residualStreamEnd) {
            const streamDur = Math.max(50, residualStreamEnd - residualStart);
            const streamFade = Math.max(0, (residualStreamEnd - now2) / streamDur);
            paintFlowSmooth = Math.max(paintFlowSmooth, Math.min(0.004, 0.001 + rate * 0.0006) * (0.6 + 0.4 * streamFade));
            const lvCur = window.levels[currentLv];
            const flowScale = (lvCur && lvCur.paint && lvCur.paint.flowScale) ? lvCur.paint.flowScale : 0.5;
            const dryShrink2 = (lvCur && lvCur.paint && typeof lvCur.paint.dryShrink !== 'undefined') ? lvCur.paint.dryShrink : (lvCur && lvCur.paint ? 0.02 : 0);
            const perFrame = (rate * streamFade * flowScale) / 60;
            fill += perFrame * (1 - dryShrink2);
            document.querySelector('.water-fill').style.height = Math.min(fill, 100) + "%";
        } else if (now2 < residualPaintEnd) {
            paintFlowSmooth *= 0.88;
            if (rate > 0.18) {
                const intervalMs = 2000 + Math.random() * 4000;
                if (now2 - residualLastDrip > intervalMs) {
                    residualLastDrip = now2;
                    spawnResidualDrip();
                }
            }
        }
    if (window.overflowActive && window.overflowLeftEl && window.overflowRightEl) {
        updateOverflowStreamHeights();
        if (Math.random() < 0.12) {
            const gcRect = document.getElementById('game-container').getBoundingClientRect();
            const wfRect = document.querySelector('.water-fill').getBoundingClientRect();
            const waterY = wfRect.top - gcRect.top;
            const leftX = window.overflowLeftEl.offsetLeft + window.overflowLeftEl.offsetWidth / 2;
            const rightX = window.overflowRightEl.offsetLeft + window.overflowRightEl.offsetWidth / 2;
            const isPaint = window.levels[currentLv] && window.levels[currentLv].paint;
            createOverflowSplash(waterY, leftX, !!isPaint);
            createOverflowSplash(waterY, rightX, !!isPaint);
        }
    }
    requestAnimationFrame(loop);
}

// overflow management variables
window.overflowLeftEl = null; window.overflowRightEl = null; window.overflowActive = false;
let overflowLastSpawn = { left: 0, right: 0 };
const overflowSpawnInterval = 220;
function startOverflowStreams() {
    if (!window.troughEl || window.overflowActive) return; window.overflowActive = true;
    const container = document.getElementById('game-container');
    const tr = window.troughEl.getBoundingClientRect();
    const gc = container.getBoundingClientRect();
    const wf = document.querySelector('.water-fill');
    const wfRect = wf.getBoundingClientRect();
    const troughLeft = tr.left - gc.left;
    const troughTop = tr.top - gc.top;
    const troughWidth = tr.width;
    const troughHeight = tr.height;
    const troughTopY = troughTop;
    const waterSurfaceY = wfRect.top - gc.top;
    const streamHeight = Math.max(0, waterSurfaceY - troughTopY);
    const left = document.createElement('div'); left.className = 'overflow-stream';
    const right = document.createElement('div'); right.className = 'overflow-stream';
    const outlets = window.troughEl && window.troughEl._outlet ? window.troughEl._outlet : { left: 0.18, right: 0.82 };
    const streamHalf = 4;
    left.style.left = (troughLeft + troughWidth * outlets.left - streamHalf) + 'px';
    left.style.top = troughTopY + 'px'; left.style.height = streamHeight + 'px';
    right.style.left = (troughLeft + troughWidth * outlets.right - streamHalf) + 'px';
    right.style.top = troughTopY + 'px'; right.style.height = streamHeight + 'px';
    left.classList.add('animate'); right.classList.add('animate');
    container.appendChild(left); container.appendChild(right);
    window.overflowLeftEl = left; window.overflowRightEl = right;
}

function updateOverflowStreamHeights() {
    if (!window.overflowActive || !window.overflowLeftEl || !window.overflowRightEl) return;
    const tr = window.troughEl.getBoundingClientRect();
    const gc = document.getElementById('game-container').getBoundingClientRect();
    const wf = document.querySelector('.water-fill');
    const wfRect = wf.getBoundingClientRect();
    const troughTopY = tr.top - gc.top;
    const waterSurfaceY = wfRect.top - gc.top;
    const streamHeight = Math.max(0, waterSurfaceY - troughTopY);
    window.overflowLeftEl.style.height = streamHeight + 'px';
    window.overflowRightEl.style.height = streamHeight + 'px';
}
function stopOverflowStreams() {
    if (!window.overflowActive) return; window.overflowActive = false;
    if (window.overflowLeftEl) { window.overflowLeftEl.remove(); window.overflowLeftEl = null; }
    if (window.overflowRightEl) { window.overflowRightEl.remove(); window.overflowRightEl = null; }
}

function createOverflowDrop(side) {
    if (!window.troughEl) return;
    const container = document.getElementById('game-container');
    const isPaint = window.levels[currentLv] && window.levels[currentLv].paint;
    const td = document.createElement('div'); td.className = isPaint ? 'paint-drop' : 'trough-drop';
    container.appendChild(td);
    const tr = window.troughEl.getBoundingClientRect();
    const gc = container.getBoundingClientRect();
    const topPos = tr.top - gc.top + (tr.height * 0.9);
    const outlets = window.troughEl._outlet || { left: 0.18, right: 0.82 };
    const leftPos = (side === 'left') ? (tr.left - gc.left + tr.width * outlets.left) : (tr.left - gc.left + tr.width * outlets.right);
    td.style.top = (topPos) + 'px';
    td.style.left = (leftPos) + 'px';
    sfx.drip.play();
    setTimeout(() => {
        try {
            const wf = document.querySelector('.water-fill');
            const wfRect = wf.getBoundingClientRect();
            const gcRect = container.getBoundingClientRect();
            const waterY = wfRect.top - gcRect.top;
            const isPaint = window.levels[currentLv] && window.levels[currentLv].paint;
            createTinySplash(waterY, leftPos, true, !!isPaint);
        } catch (e) { }
        td.remove();
    }, 600);
}

function releaseTroughSequential(total) {
    return new Promise((resolve) => {
        if (!window.troughEl || total <= 0) { resolve(); return; }
        const pieces = Math.min(8, Math.max(1, Math.ceil(total * 1.0)));
        let side = 0; let released = 0;
        const isPaint = window.levels[currentLv] && window.levels[currentLv].paint;
        const visc = isPaint && window.levels[currentLv].paint.viscousFactor ? window.levels[currentLv].paint.viscousFactor : 1;
        const step = () => {
            if (released >= pieces) { resolve(); return; }
            const sideStr = (side === 0) ? 'left' : 'right';
            const container = document.getElementById('game-container');
            const td = document.createElement('div'); td.className = isPaint ? 'paint-drop' : 'trough-drop';
            container.appendChild(td);
            const tr = window.troughEl.getBoundingClientRect();
            const gc = container.getBoundingClientRect();
            const topPos = tr.top - gc.top + (tr.height * 0.9);
            const outlets = window.troughEl._outlet || { left: 0.18, right: 0.82 };
            const leftPos = (side === 0) ? (tr.left - gc.left + tr.width * outlets.left) : (tr.left - gc.left + tr.width * outlets.right);
            td.style.top = (topPos) + 'px';
            td.style.left = (leftPos) + 'px';
            sfx.drip.play();
            setTimeout(() => td.remove(), isPaint ? 900 : 600);
            const dryShrink = (isPaint && typeof window.levels[currentLv].paint.dryShrink !== 'undefined') ? window.levels[currentLv].paint.dryShrink : (isPaint ? 0.02 : 0);
            const inc = (total / pieces) * visc * (1 - dryShrink);
            fill += inc; document.querySelector('.water-fill').style.height = Math.min(fill, 100) + '%';
            released++; side = 1 - side;
            setTimeout(step, 140);
        };
        step();
    });
}

function createSplashEffect(waterY, streamX, isPaint = false) {
    const container = document.getElementById('game-container');
    const numDrops = isPaint ? (5 + Math.floor(Math.random() * 4)) : (4 + Math.floor(Math.random() * 3));
    for (let i = 0; i < numDrops; i++) {
        const drop = document.createElement('div');
        drop.className = isPaint ? 'paint-splash' : 'splash-drop';
        const angle = (Math.PI * 2 * i) / numDrops + (Math.random() - 0.5) * 0.4;
        const distance = isPaint ? (24 + Math.random() * 36) : (20 + Math.random() * 30);
        const tx = Math.cos(angle) * distance;
        const ty = (Math.random() - 0.5) * (isPaint ? 56 : 40) - (isPaint ? 6 : 10);
        drop.style.setProperty('--tx', tx + 'px');
        drop.style.setProperty('--ty', ty + 'px');
        drop.style.left = (streamX - (isPaint ? 6 : 4)) + 'px';
        drop.style.top = (waterY - (isPaint ? 6 : 4)) + 'px';
        container.appendChild(drop);
        setTimeout(() => {
            const hitX = streamX - (isPaint ? 6 : 4) + parseFloat(drop.style.getPropertyValue('--tx'));
            createTinySplash(waterY, hitX, false, isPaint);
            drop.remove();
        }, isPaint ? 600 : 400);
    }
}

function createOverflowSplash(waterY, streamX, isPaint = false) {
    const container = document.getElementById('game-container');
    const numDrops = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < numDrops; i++) {
        const drop = document.createElement('div');
        drop.className = isPaint ? 'paint-splash' : 'splash-drop';
        drop.style.width = isPaint ? '6px' : '5px';
        drop.style.height = isPaint ? '6px' : '5px';
        const angle = (Math.PI * 2 * i) / numDrops + (Math.random() - 0.5) * 0.5;
        const distance = 12 + Math.random() * 20;
        const tx = Math.cos(angle) * distance;
        const ty = (Math.random() - 0.5) * 30 - 8;
        drop.style.setProperty('--tx', tx + 'px');
        drop.style.setProperty('--ty', ty + 'px');
        drop.style.left = (streamX - (isPaint ? 3 : 2.5)) + 'px';
        drop.style.top = (waterY - (isPaint ? 3 : 2.5)) + 'px';
        container.appendChild(drop);
        setTimeout(() => {
            const hitX = streamX - (isPaint ? 3 : 2.5) + parseFloat(drop.style.getPropertyValue('--tx'));
            createTinySplash(waterY, hitX, true, !!isPaint);
            drop.remove();
        }, isPaint ? 500 : 350);
    }
}

function spawnResidualDrip() {
    const now = Date.now();
    if (now > residualPaintEnd) return;
    const s = document.getElementById('stream');
    const gc = document.getElementById('game-container');
    const gcRect = gc.getBoundingClientRect();
    const sRect = s.getBoundingClientRect();
    const left = sRect.left - gcRect.left + sRect.width / 2;
    const top = sRect.top - gcRect.top + sRect.height;
    const isPaint = window.levels[currentLv] && window.levels[currentLv].paint;
    const d = document.createElement('div'); d.className = isPaint ? 'paint-drop' : 'drop';
    d.style.left = left + 'px'; d.style.top = top + 'px';
    document.getElementById('game-container').appendChild(d);
    sfx.drip.play();
    setTimeout(() => {
        try {
            const wf = document.querySelector('.water-fill');
            const wfRect = wf.getBoundingClientRect();
            const waterSurfaceY = wfRect.top - gcRect.top;
            createTinySplash(waterSurfaceY, left, true, !!isPaint);
            const dryShrink = (isPaint && typeof window.levels[currentLv].paint.dryShrink !== 'undefined') ? window.levels[currentLv].paint.dryShrink : (isPaint ? 0.02 : 0);
            const smallInc = 0.3 * (isPaint && window.levels[currentLv].paint && window.levels[currentLv].paint.flowScale ? window.levels[currentLv].paint.flowScale : 0.5);
            fill += smallInc * (1 - dryShrink);
            document.querySelector('.water-fill').style.height = Math.min(fill, 100) + "%";
        } catch (e) { }
        d.remove();
    }, isPaint ? 900 : 450);
}

function createTinySplash(waterY, x, isSmall = false, isPaint = false) {
    const container = document.getElementById('game-container');
    const numTiny = isSmall ? (1 + Math.floor(Math.random())) : (2 + Math.floor(Math.random() * 2));
    for (let i = 0; i < numTiny; i++) {
        const tiny = document.createElement('div');
        tiny.className = isPaint ? 'paint-splash' : 'splash-drop';
        tiny.style.width = isSmall ? (isPaint ? '4px' : '3px') : (isPaint ? '5px' : '4px');
        tiny.style.height = isSmall ? (isPaint ? '4px' : '3px') : (isPaint ? '5px' : '4px');
        const angle = (Math.PI * 2 * i) / Math.max(1, numTiny) + (Math.random() - 0.5) * 0.3;
        const distance = isSmall ? (isPaint ? (8 + Math.random() * 10) : (6 + Math.random() * 10)) : (isPaint ? (10 + Math.random() * 12) : (8 + Math.random() * 12));
        const tx = Math.cos(angle) * distance;
        const ty = -4 - Math.random() * 6;
        tiny.style.setProperty('--tx', tx + 'px');
        tiny.style.setProperty('--ty', ty + 'px');
        tiny.style.left = (x - (isSmall ? (isPaint ? 2 : 1.5) : (isPaint ? 2.5 : 2))) + 'px';
        tiny.style.top = (waterY - (isSmall ? (isPaint ? 2 : 1.5) : (isPaint ? 2.5 : 2))) + 'px';
        container.appendChild(tiny);
        setTimeout(() => tiny.remove(), isPaint ? 700 : 450);
    }
}

// start
populatePicker(); init(); loop();
