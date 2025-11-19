
// Wire uploader inputs to the audio elements
function wireFileToAudio(inputId, audioId) {
    const inp = $(inputId);
    const aud = $(audioId);
    if (!inp || !aud) return;
    inp.addEventListener('change', (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        try { // revoke previous if any
            if (aud.src && aud.dataset.objectUrl) URL.revokeObjectURL(aud.dataset.objectUrl);
        } catch (_) { }
        const url = URL.createObjectURL(f);
        aud.src = url; aud.dataset.objectUrl = url; aud.load();
    });
}
wireFileToAudio('#fileCorrect', '#sfxCorrect');
wireFileToAudio('#fileIncorrect', '#sfxIncorrect');
wireFileToAudio('#fileSkip', '#sfxSkip');

// Test buttons (with logging)
$('#testCorrect')?.addEventListener('click', () => { const a = $('#sfxCorrect'); if (a?.src) { a.currentTime = 0; a.play().catch(err => console.warn('testCorrect play failed', err)); } else console.warn('testCorrect: no src set'); });
$('#testIncorrect')?.addEventListener('click', () => { const a = $('#sfxIncorrect'); if (a?.src) { a.currentTime = 0; a.play().catch(err => console.warn('testIncorrect play failed', err)); } else console.warn('testIncorrect: no src set'); });
$('#testSkip')?.addEventListener('click', () => { const a = $('#sfxSkip'); if (a?.src) { a.currentTime = 0; a.play().catch(err => console.warn('testSkip play failed', err)); } else console.warn('testSkip: no src set'); });

// Try to 'unlock' audio on first user interaction (helps with autoplay/gesture restrictions)
function unlockAllAudio() {
    try {
        ['#sfxCorrect', '#sfxIncorrect', '#sfxSkip'].forEach(id => {
            const a = $(id);
            if (!a) return;
            // attempt to play/pause quickly to allow browsers to consider audio allowed
            const p = a.play();
            if (p && p.then) p.then(() => { try { a.pause(); a.currentTime = 0; } catch (_) { } }).catch(err => {/*ignore*/ });
        });
    } catch (e) {/*ignore*/ }
}
document.addEventListener('click', unlockAllAudio, { once: true });
$('#startBtn').addEventListener('click', () => startTimer());
$('#pauseBtn').addEventListener('click', () => pauseTimer());
$('#resetBtn').addEventListener('click', () => { resetTimer(); buildRosco(state.items.length ? state.items : []); });

$('#okBtn').addEventListener('click', () => pressCorrect());
$('#koBtn').addEventListener('click', () => pressIncorrect());
$('#skipBtn').addEventListener('click', () => pressSkip());
$('#nextBtn').addEventListener('click', () => nextInQueue());

$('#closeModal').addEventListener('click', () => $('#resultModal').close());

// Teclado rápido para presentador
document.addEventListener('keydown', (e) => {
    if (e.key === ' ') { e.preventDefault(); startTimer(); } // espacio inicia
    if (e.key === 'p' || e.key === 'P') { pauseTimer(); }
    if (e.key === 'ArrowRight') { nextInQueue(); }
    if (e.key === 's' || e.key === 'S') { pressSkip(); }
    if (e.key === 'c' || e.key === 'C') { pressCorrect(); }
    if (e.key === 'i' || e.key === 'I') { pressIncorrect(); }
});

// Construye una maqueta inicial vacía
buildRosco(SPANISH_ALPHABET.map(l => ({ letter: l, def: '', status: 'pending' })));
$('#startBtn').setAttribute('disabled', '');
$('#resetBtn').setAttribute('disabled', '');
$('#qtext').innerHTML = 'Presioná <span class="kbd"><b>Construir rosco</b></span> para comenzar.';
