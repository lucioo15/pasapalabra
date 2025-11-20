
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




