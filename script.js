// script.js

// --- 1. KONFIGURASI DANPENGACAKAN AWAL ---
// Koleksi 10 kandidat monster placeholder. Sistem otomatis memilih 6 secara acak & anti-kembar.
const allMonsters = ['👹', '👽', '👾', '🧟', '🧛', '👻', '🤖', '🎃', '👺', '🐉'];
// Menggunakan metode pengacakan acak presisi untuk memotong 6 slot unik
let selectedMonsters = allMonsters.sort(() => 0.5 - Math.random()).slice(0, 6);

// Status kerusakan bangunan istana (0: Utuh, 1: Retak Separo, 2: Runtuh/Telur Terbuka)
const castleStates = [0, 0, 0, 0, 0, 0];

// Tekstur/gambar cangkang luar telur bawaan projek lama kamu
const eggImages = [
    'images/egg/1.jpg', 
    'images/egg/2.jpg', 
    'images/egg/3.jpg', 
    'images/egg/4.jpg', 
    'images/egg/5.jpg', 
    'images/egg/6.jpg'
];

// Warna overlay unik untuk tiap telur (tidak boleh ada warna yang sama di 6 telur)
const colorPalette = [
    'rgba(255,99,71,0.30)',    // tomato
    'rgba(255,165,0,0.30)',    // orange
    'rgba(60,179,113,0.30)',   // mediumseagreen
    'rgba(65,105,225,0.30)',   // royalblue
    'rgba(186,85,211,0.30)',   // mediumorchid
    'rgba(255,215,0,0.30)',    // gold
    'rgba(244,164,96,0.30)',   // sandybrown
    'rgba(70,130,180,0.30)'    // steelblue (extra options)
];

function shuffleArray(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

const eggOverlays = shuffleArray(colorPalette).slice(0, 6);

document.querySelectorAll('.castle-spot').forEach((el, index) => {
    // Kosongkan background bawaan (Layer 1 dibiarin transparan/kosong)
    el.style.backgroundImage = 'none'; 
    
    // Bikin Layer 2: Telur
    const egg = document.createElement('div');
    egg.className = 'buried-egg';
    egg.style.backgroundImage = `url('${eggImages[index]}')`;
    egg.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        openHatchOverlay(index, eggImages[index]);
    });
    el.appendChild(egg); // Masuk duluan

    // Bikin Layer 3: Pasir
    const sand = document.createElement('div');
    sand.className = 'sand-layer';
    sand.style.backgroundImage = `url('images/sands/1.png')`; // Mulai dari istana utuh
    el.appendChild(sand); // Masuk belakangan (niban telur)
});

// --- 2. AUDIO SYNTHESIZER PROCEDURAL (MURNI TANPA FILE ASSET) ---
let audioCtx;
function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

// Efek Gesekan Suara Sekop Pasir Pantai (*krsk*) menggunakan algoritma White Noise Generator
function playSandSound() {
    initAudio();
    const duration = 0.14; // pendek dan renyah
    const sampleRate = audioCtx.sampleRate;
    const buffer = audioCtx.createBuffer(1, Math.floor(sampleRate * duration), sampleRate);
    const data = buffer.getChannelData(0);

    // White noise with soft envelope (fade-out) to avoid sharp transient
    for (let i = 0; i < data.length; i++) {
        // apply slight decay into the buffer so the tail is softer
        const env = 1 - (i / data.length);
        data[i] = (Math.random() * 2 - 1) * 0.6 * env;
    }

    const noiseNode = audioCtx.createBufferSource();
    noiseNode.buffer = buffer;

    // Gentle highpass to remove rumble, then lowpass to remove harsh clicks
    const hp = audioCtx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 220;
    hp.Q.value = 0.7;

    const lp = audioCtx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1400;
    lp.Q.value = 0.9;

    const gainNode = audioCtx.createGain();
    const now = audioCtx.currentTime;
    gainNode.gain.setValueAtTime(0.22, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);

    // route
    noiseNode.connect(hp);
    hp.connect(lp);
    lp.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    noiseNode.start(now);
}

// Efek Pukulan/Hantaman Keretakan Kulit Telur menggunakan Oscillator Sawtooth
function playCrackSound(intensity) {
    initAudio();
    const t = audioCtx.currentTime;
    const oscNode = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscNode.type = 'sawtooth';
    oscNode.frequency.setValueAtTime(60 + Math.random() * 40, t);
    oscNode.frequency.exponentialRampToValueAtTime(12, t + 0.12);
    
    gainNode.gain.setValueAtTime(intensity, t);
    gainNode.gain.exponentialRampToValueAtTime(0.01, t + 0.14);
    
    oscNode.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    oscNode.start(t);
    oscNode.stop(t + 0.14);
}

// --- 3. LOGIKA INTERAKSI AYUNAN SEKOP & PENGHANCURAN ---
const shovel = document.getElementById('shovel');
let isDraggingShovel = false;
let shovelPointerId = null;
let shovelOffsetX = 0;
let shovelOffsetY = 0;
let lastHitIdx = null; // untuk mencegah multiple hits saat terus menempel

// Batasi pergerakan sekop agar tidak keluar dari peta (world)
function clampShovelPosition(x, y) {
    const minX = 0;
    const minY = 0;
    const maxX = world.offsetWidth - shovel.offsetWidth;
    const maxY = world.offsetHeight - shovel.offsetHeight;
    return {
        x: Math.min(Math.max(minX, x), maxX),
        y: Math.min(Math.max(minY, y), maxY)
    };
}

function moveShovel(clientX, clientY) {
    // KUNCI PERBAIKAN: Konversi koordinat layar (screen) ke koordinat dunia (world)
    // dengan memperhitungkan faktor pan (posX/Y) dan zoom (scale)
    const worldX = (clientX - posX) / scale - shovelOffsetX;
    const worldY = (clientY - posY) / scale - shovelOffsetY;
    
    const pos = clampShovelPosition(worldX, worldY);
    
    // Lepaskan ikatan right/bottom awal dari CSS
    shovel.style.right = 'auto';
    shovel.style.bottom = 'auto';
    
    shovel.style.left = pos.x + 'px';
    shovel.style.top = pos.y + 'px';
}

function handleShovelHit(castle) {
    if (!castle) return;
    const idx = Number(castle.getAttribute('data-index'));
    if (castleStates[idx] >= 2) return;

    playSandSound();
    
    // Mainkan animasi ayunan sekop saat mengenai istana
    shovel.classList.remove('digging');
    void shovel.offsetWidth; // Trigger reflow
    shovel.classList.add('digging');
    
    castleStates[idx]++;
    const sandLayer = castle.querySelector('.sand-layer');

    if (castleStates[idx] === 1) {
        sandLayer.style.backgroundImage = `url('images/sands/2.png')`;
    } else if (castleStates[idx] === 2) {
        sandLayer.style.backgroundImage = `url('images/sands/3.png')`;
        const egg = castle.querySelector('.buried-egg');
        if (egg) egg.classList.add('show');
    }
}

shovel.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return; // Abaikan klik kanan
    e.preventDefault();
    e.stopPropagation(); // SANGAT PENTING: Cegah map ikut tergeser saat kita menarik sekop
    
    isDraggingShovel = true;
    shovelPointerId = e.pointerId;
    shovel.setPointerCapture(shovelPointerId);
    
    // Offset juga harus dihitung berdasarkan skala zoom
    const rect = shovel.getBoundingClientRect();
    shovelOffsetX = (e.clientX - rect.left) / scale;
    shovelOffsetY = (e.clientY - rect.top) / scale;
});

shovel.addEventListener('pointermove', (e) => {
    if (!isDraggingShovel || e.pointerId !== shovelPointerId) return;
    moveShovel(e.clientX, e.clientY);
    // Cek tumpang-tindih dengan setiap castle-spot saat sedang drag
    try {
        const shovelRect = shovel.getBoundingClientRect();
        const spots = document.querySelectorAll('.castle-spot');
        let hitFound = false;
        const shrinkFactor = 0.3; // hitbox ~30% of visual size
        spots.forEach((spot) => {
            const idx = Number(spot.getAttribute('data-index'));
            const r = spot.getBoundingClientRect();
            const shrW = r.width * shrinkFactor;
            const shrH = r.height * shrinkFactor;
            const shrLeft = r.left + (r.width - shrW) / 2;
            const shrTop = r.top + (r.height - shrH) / 2;
            const shrRight = shrLeft + shrW;
            const shrBottom = shrTop + shrH;

            const intersects = !(shovelRect.right < shrLeft || shovelRect.left > shrRight || shovelRect.bottom < shrTop || shovelRect.top > shrBottom);
            if (intersects) {
                hitFound = true;
                if (lastHitIdx !== idx) {
                    lastHitIdx = idx;
                    handleShovelHit(spot);
                }
            }
        });
        if (!hitFound) lastHitIdx = null;
    } catch (err) {
        // jika terjadi error, jangan ganggu pengalaman drag
        console.warn('Shovel hit detection error', err);
    }
});

function endShovelDrag(e) {
    if (!isDraggingShovel || e.pointerId !== shovelPointerId) return;
    isDraggingShovel = false;
    shovel.releasePointerCapture(shovelPointerId);
    shovelPointerId = null;

    // Sembunyikan sekop sesaat untuk mendeteksi apa yang ada di bawahnya
    shovel.style.visibility = 'hidden'; 
    const hitElement = document.elementFromPoint(e.clientX, e.clientY);
    shovel.style.visibility = 'visible';
    
    const castle = hitElement && hitElement.closest('.castle-spot');
    handleShovelHit(castle);
}

shovel.addEventListener('pointerup', endShovelDrag);
shovel.addEventListener('pointercancel', endShovelDrag);

// --- 4. NAVIGATION INTERACTION (ZOOM IN-OUT PAN CAMERA) ---
const world = document.getElementById('world');
const viewport = document.getElementById('viewport');
let scale = 1, posX = 0, posY = 0;
let isDragging = false, startX, startY;
let startPointerX = 0, startPointerY = 0;
let startPosX = 0, startPosY = 0;
let initialDistance = null, initialScale = 1;

function getDistance(touches) {
    return Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
}

function updateTransform() {
    // Clamp pan so world doesn't move outside viewport bounds
    clampPan();
    world.style.transform = `translate(${posX}px, ${posY}px) scale(${scale})`;
}

function clampPan() {
    const vpW = viewport.clientWidth;
    const vpH = viewport.clientHeight;
    const worldW = world.offsetWidth * scale;
    const worldH = world.offsetHeight * scale;

    let minX, maxX, minY, maxY;

    if (worldW > vpW) {
        minX = vpW - worldW;
        maxX = 0;
    } else {
        // center when world smaller than viewport
        minX = maxX = (vpW - worldW) / 2;
    }

    if (worldH > vpH) {
        minY = vpH - worldH;
        maxY = 0;
    } else {
        minY = maxY = (vpH - worldH) / 2;
    }

    posX = Math.min(Math.max(posX, minX), maxX);
    posY = Math.min(Math.max(posY, minY), maxY);
}

// Logika Drag Geser Map (Pan)
viewport.addEventListener('pointerdown', (e) => {
    // Matikan pergeseran jika jendela penetasan tengah layar sedang aktif ditonton
    if (document.getElementById('hatch-overlay').classList.contains('active')) return;
    if (isDraggingShovel) return;
    if (e.target.closest('#shovel')) return;
    if (e.target.closest('.castle-spot')) return;

    isDragging = true;
    startPointerX = e.clientX;
    startPointerY = e.clientY;
    startPosX = posX;
    startPosY = posY;
});

viewport.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    if (isDraggingShovel) return;

    const dx = e.clientX - startPointerX;
    const dy = e.clientY - startPointerY;
    // Convert screen movement to world-space movement (unscaled)
    posX = startPosX + dx / scale;
    posY = startPosY + dy / scale;
    updateTransform();
});

viewport.addEventListener('pointerup', () => isDragging = false);
viewport.addEventListener('pointerleave', () => isDragging = false);

// Fitur Cubit Layar (Pinch to Zoom) untuk Kamera Intro Konten HP
viewport.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
        isDragging = false;
        initialDistance = getDistance(e.touches);
        initialScale = scale;
    }
}, { passive: false });

viewport.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2) {
        e.preventDefault(); // Menghentikan scroll bar ditarik bawaan handphone
        const currentDistance = getDistance(e.touches);
        scale = initialScale * (currentDistance / initialDistance);
        
        // Pembatasan jarak pandang kamera (Minimal Zoom 1x, Maksimal Zoom 3x)
        scale = Math.max(1, Math.min(scale, 3));
        updateTransform();
    }
}, { passive: false });

// --- 5. LOGIKA OVERLAY PENETASAN MONSTER UTAMA ---
const overlay = document.getElementById('hatch-overlay');
const centerEgg = document.getElementById('center-egg');
const monsterReveal = document.getElementById('monster-reveal');
let activeEggIndex = -1;
let hatchClicks = 0;
const clicksNeeded = 5; // Ketuk sebanyak 5 kali pukulan cepat agar menetas

function openHatchOverlay(index, eggImgSrc) {
    activeEggIndex = index;
    hatchClicks = 0;
    
    // Kembalikan ke visual cangkang kulit utuh semula
    centerEgg.style.backgroundImage = `url('${eggImgSrc}')`;
    centerEgg.style.opacity = '1';
    centerEgg.style.backgroundColor = 'transparent';
    centerEgg.style.boxShadow = 'inset -20px -20px 40px rgba(0,0,0,0.6)';
    monsterReveal.classList.remove('show');
    
    // Taruh monster unik yang sudah ditentukan tanpa takut kembar
    monsterReveal.innerText = selectedMonsters[index];

    overlay.classList.add('active');
}

// Pemicu aksi saat telur raksasa diketuk di layar tengah
centerEgg.addEventListener('pointerdown', () => {
    if (hatchClicks >= clicksNeeded) return; // Kunci input jika cangkang sudah pecah total
    
    hatchClicks++;
    playCrackSound(0.4 + (hatchClicks * 0.12)); // Suara pukulan cangkang semakin nyaring kencang
    
    // (Telur tidak lagi diguncang secara visual)

    if (hatchClicks >= clicksNeeded) {
        // Momen Klimaks -> Telur Menetas!
        centerEgg.style.backgroundImage = 'none'; // Cangkang lenyap seketika
        centerEgg.style.boxShadow = 'none';
        playCrackSound(1.6); // Ledakan sfx pecah keras
        
        // Munculkan gambar monster utama ke penonton
        monsterReveal.classList.add('show');
        
        // Semburkan partikel kembang api meriah di layar laptop/HP
        if (typeof confetti === 'function') {
            confetti({
                particleCount: 180,
                spread: 75,
                origin: { y: 0.6 },
                colors: ['#FFD700', '#FF8C00', '#FFFFFF']
            });
        }
        
        // Menutup otomatis setelah 3.5 detik tayang & menghilangkan telur dunia lama agar rapi
        setTimeout(() => {
            overlay.classList.remove('active');
            const targetBuriedEgg = document.querySelector(`.castle-spot[data-index="${activeEggIndex}"] .buried-egg`);
            if (targetBuriedEgg) {
                targetBuriedEgg.style.display = 'none';
            }
                }, 3500);
        }
});

// --- 6. REGISTER SERVICE WORKER ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then((reg) => {
                console.log('ServiceWorker registered:', reg.scope);
                if (reg.update) reg.update();
            })
            .catch((err) => console.warn('ServiceWorker registration failed:', err));
    });
}
