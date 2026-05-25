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
    sand.style.backgroundImage = `url('images/1.png')`; // Mulai dari istana utuh
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
    const bufferSize = audioCtx.sampleRate * 0.2; // Waktu sfx berdurasi 0.2 detik
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    
    const noiseNode = audioCtx.createBufferSource();
    noiseNode.buffer = buffer;
    
    // Lowpass filter memotong suara bising tinggi agar terasa berat seperti pasir tanah asli
    const filterNode = audioCtx.createBiquadFilter();
    filterNode.type = 'lowpass';
    filterNode.frequency.value = 750;
    
    const gainNode = audioCtx.createGain();
    gainNode.gain.setValueAtTime(0.8, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
    
    noiseNode.connect(filterNode);
    filterNode.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    noiseNode.start();
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

document.querySelectorAll('.castle-spot').forEach(el => {
    el.addEventListener('pointerdown', (e) => {
        const idx = el.getAttribute('data-index');
        
        // Kunci fungsi bila gundukan pasir sudah digali habis
        if (castleStates[idx] >= 2) return;
        
        // Pindahkan posisi koordinat gambar alat sekop ke area klik
        shovel.style.left = (e.clientX - 40) + 'px';
        shovel.style.top = (e.clientY - 40) + 'px';
        shovel.classList.remove('digging');
        void shovel.offsetWidth; // Memicu pengaturan ulang DOM agar animasi dapat berulang
        shovel.classList.add('digging');
        
        playSandSound();
        
// Update visual gambar runtuhnya gundukan tanah pasir
        castleStates[idx]++;
        const sandLayer = el.querySelector('.sand-layer'); // Targetkan Layer 3
        
        if (castleStates[idx] === 1) {
            sandLayer.style.backgroundImage = `url('images/2.png')`;
        } else if (castleStates[idx] === 2) {
            sandLayer.style.backgroundImage = `url('images/3.png')`;
            // Munculkan telur dari Layer 2
            const egg = el.querySelector('.buried-egg');
            egg.classList.add('show');
        }
    });
});

// --- 4. NAVIGATION INTERACTION (ZOOM IN-OUT PAN CAMERA) ---
const world = document.getElementById('world');
const viewport = document.getElementById('viewport');
let scale = 1, posX = 0, posY = 0;
let isDragging = false, startX, startY;
let initialDistance = null, initialScale = 1;

function getDistance(touches) {
    return Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
}

function updateTransform() {
    world.style.transform = `translate(${posX}px, ${posY}px) scale(${scale})`;
}

// Logika Drag Geser Map (Pan)
viewport.addEventListener('pointerdown', (e) => {
    // Matikan pergeseran jika jendela penetasan tengah layar sedang aktif ditonton
    if (document.getElementById('hatch-overlay').classList.contains('active')) return;
    
    isDragging = true;
    startX = e.clientX - posX;
    startY = e.clientY - posY;
});

viewport.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    // Cegah peta ikut bergeser secara tidak sengaja ketika sedang fokus mengetuk/menyekop pasir
    if (e.target.closest('.castle-spot')) return;

    posX = e.clientX - startX;
    posY = e.clientY - startY;
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
    centerEgg.classList.remove('shake');
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
    
    // Guncang telur mengikuti kecepatan ketukan jari tangan
    centerEgg.classList.remove('shake');
    void centerEgg.offsetWidth;
    centerEgg.classList.add('shake');
    centerEgg.style.animationDuration = (0.35 - (hatchClicks * 0.06)) + 's'; // Efek getaran semakin kencang menjelang pecah

    if (hatchClicks >= clicksNeeded) {
        // Momen Klimaks -> Telur Menetas!
        centerEgg.classList.remove('shake');
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
            .then(reg => console.log('ServiceWorker registered:', reg.scope))
            .catch(err => console.warn('ServiceWorker registration failed:', err));
    });
}
