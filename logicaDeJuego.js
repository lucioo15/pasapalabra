// ======== Utilidades ========
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
function getRandomArbitrary(min, max) {
    return Math.random() * (max - min) + min;
}

function isLetrasIgualesSinTildesNiMayusculas(a, b) {
    const normalizar = (str) => str.normalize("NFD").replace(/[\u0300-\u0302\u0304-\u036f]/g, "").toUpperCase();
    return normalizar(a) === normalizar(b);
}

// Alfabeto español básico para el rosco.
const SPANISH_ALPHABET = [
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'Ñ', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'
];

// Estado del juego
const state = {
    items: [],         // [{letter, word, def, status: 'pending'|'correct'|'incorrect'|'skipped'}]
    queue: [],         // índices pendientes en orden de juego
    activeIndex: null, // índice dentro de items
    seconds: 160,      // tiempo total
    timerId: null,
    running: false,
};

// ======== 

async function parseTxt(fileText) { // convierte el txt en un array de items del estilo {letter, def, status}
    const lines = fileText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const items = [];
    let autoIdx = 0;
    for (const raw of lines) {
        let letter = null, def = raw, word = null;
        const m = raw.match(/^([A-Za-zÁÉÍÓÚÜÑñ])\s*[-–:;|]\s*([^–:;|]+?)\s*[-–:;|]\s*(.+)$/);
        if (m) {
            letter = m[1].toUpperCase().replace('Á', 'A').replace('É', 'E').replace('Í', 'I').replace('Ó', 'O').replace('Ú', 'U').replace('Ü', 'U');
            def = m[2];
            word = m[3];
        }
        if (!letter) {
            // asignación automática según alfabeto
            letter = SPANISH_ALPHABET[autoIdx % SPANISH_ALPHABET.length];
            autoIdx++;
        }
        items.push({ letter, word, def, status: 'pending' });
    }
    return items;
}
// TODO : armar el modal de confirmación con las definiciones seleccionadas
function confirmarRosco(items) {
    state.items = items; // <-- util para la funcion buildRosco()
    const confirmModal = $('#confirmaRoscoModal');
    const table = confirmModal.querySelector('table tbody');
    table.innerHTML = '';
    items.forEach(item => {
        const row = document.createElement('tr');
        const select = document.createElement('select');
        // console.log('Definiciones para', item.word, ':', item.def);
        item.def.forEach((definicion) => {
            const option = document.createElement('option');
            option.value = definicion;
            option.textContent = definicion;
            select.appendChild(option);
        });
        row.innerHTML = `
        <td>
            <b>${item.letter}</b>
        </td>
        <td>
            <a target="_blank" href="https://dle.rae.es/${item.word}">${item.word}<span class="material-symbols-outlined">open_in_new</span></a>
        </td>
        <td></td>
        <td>
            <div class="btnsContainer">
                <button title="Generar un nueva palabra aleatoria" letter="${item.letter}" id="getNewWord${item.letter}" class="btn primary">
                    <span class="material-symbols-outlined">refresh</span>
                </button>
                <button title="Esta función está en desarrollo" class="btn" id="editWord${item.letter}">
                    <span class="material-symbols-outlined">edit</span>
                </button>
                <button title="Reportar un error en la palabra y/o definición" value="${item.word}" class="btn bad" id="reportWord${item.letter}">
                    <span class="material-symbols-outlined">report</span>
                </button>
            </div>
        </td>`;
        row.children[2].appendChild(select);
        table.appendChild(row);
    });
    actualizarListenersGetNewWord();
    actualizarListenersEditWord();
    actualizarListenersReportWord();
    confirmModal.showModal();
}

function buildRosco() { // actualiza contadores, imprime definicion, inicializa el estado y pinta el rosco
    // state.items = items; // ahora se asigna en confirmarRosco()
    let items = state.items;
    state.queue = items.map((_, i) => i); // orden inicial
    state.activeIndex = state.queue[0] ?? null;
    state.seconds = parseInt($('#time').textContent, 10) || 160;
    state.running = false; clearInterval(state.timerId); state.timerId = null;

    // Pintar rosco
    const rosco = $('#rosco');
    $$('.letter', rosco).forEach(n => n.remove());
    const n = items.length;
    const r = 140; // radio
    const cx = 160, cy = 160; // centro
    items.forEach((it, idx) => {
        const angle = (idx / n) * 2 * Math.PI - Math.PI / 2; // arranca arriba
        const x = cx + r * Math.cos(angle) - 19; // 19 = 38/2
        const y = cy + r * Math.sin(angle) - 19;
        const el = document.createElement('div');
        el.className = 'letter pending';
        el.style.left = x + "px"; el.style.top = y + "px";
        el.dataset.idx = idx;
        el.textContent = it.letter;
        rosco.appendChild(el);
    });

    updateCounts();
    setActive(state.activeIndex);

    $('#startBtn').removeAttribute('disabled');
    $('#resetBtn').removeAttribute('disabled');
}

function setActive(idx) {  // marca la letra activa en el rosco
    state.activeIndex = idx;
    $$('.letter').forEach(el => el.classList.remove('active'));
    if (idx == null) return;
    const el = $(`.letter[data-idx="${idx}"]`);
    el?.classList.add('active');
}

function hideQuestion() { // oculta la definición (se usa al pausar el timer)
    $('#qtext').innerHTML = 'Presiona <span class="kbd">Iniciar / Reanudar</span> para revelar la definición.';
    $('#qtextWord').setAttribute('hidden', '');
    $('#qheadWord').setAttribute('hidden', '');
}

function renderQuestion() { // imprime la definición de la letra activa (segun state)
    const idx = state.activeIndex;
    if (idx == null) { $('#qtext').innerHTML = 'Sin elementos en la cola.'; return; }
    const it = state.items[idx];
    $('#qtextWord').innerHTML = `<b>${it.word ?? ''}</b>`;
    $('#qtextWord').removeAttribute('hidden');
    $('#qheadWord').removeAttribute('hidden');
    $('#qtext').innerHTML = `Con la ${it.letter}: ${it.def}`;
}

function markStatus(idx, status) { // actualiza el estado y la UI de una letra
    const it = state.items[idx];
    it.status = status; // 'correct' | 'incorrect' | 'skipped'
    const el = $(`.letter[data-idx="${idx}"]`);
    el.classList.remove('pending', 'active', 'correct', 'incorrect', 'skipped');
    el.classList.add(status);
}

function nextInQueue() { // avannza al siguiente pendiente en la cola, e imprime la definición
    // Quita el actual de la cabeza si coincide
    if (state.queue[0] === state.activeIndex) state.queue.shift();
    // Buscar el próximo índice pendiente
    while (state.queue.length && state.items[state.queue[0]].status !== 'pending') {
        state.queue.shift();
    }
    const next = state.queue[0] ?? null;
    setActive(next);
    renderQuestion();
    if (next == null) {
        // Se terminaron las pendientes ANTES de agotar tiempo => mostrar resumen
        endGame();
    }
}

function pressCorrect() {
    if (state.activeIndex == null) return;
    // play custom correct sound if set
    try { 
        const a = $('#sfxCorrect'); 
        if (a?.src) { 
            a.currentTime = 0; 
            a.play().catch(err => console.warn('sfxCorrect play failed', err)); 
        } 
    } catch (e) { console.warn(e) }
    markStatus(state.activeIndex, 'correct');
    updateCounts();
    nextInQueue();
}

function pressIncorrect() {
    if (state.activeIndex == null) return;
    // play custom incorrect sound if set
    try { 
        const a = $('#sfxIncorrect'); 
        if (a?.src) { 
            a.currentTime = 0; 
            a.play().catch(err => console.warn('sfxIncorrect play failed', err)); 
        } 
    } catch (e) { console.warn(e) }
    markStatus(state.activeIndex, 'incorrect');
    updateCounts();

    // el orden de las siguientes lineas es importante porque 
    // pauseTimer() llama a hideQuestion() y nextInQueue() a renderQuestion()
    nextInQueue();
    pauseTimer();
}

function pressSkip() {
    if (state.activeIndex == null) return;
    // play custom pasapalabra sound if set
    try { 
        const a = $('#sfxSkip'); 
        if (a?.src) { 
            a.currentTime = 0; 
            a.play().catch(err => console.warn('sfxSkip play failed', err)); 
        } 
    } catch (e) { console.warn(e) }
    // Mantiene como pending pero lo manda al final
    const idx = state.activeIndex;
    markStatusVisualOnly(idx, 'skipped');
    nextInQueue();
    state.queue.push(idx);
    pauseTimer();
    updateCounts();
}

function markStatusVisualOnly(idx, vis) {
    const el = $(`.letter[data-idx="${idx}"]`);
    if (!el) return;
    el.classList.remove('pending', 'active', 'correct', 'incorrect', 'skipped');
    el.classList.add(vis);

    // comentado por Lucio para que mantenga el color de saltada
    // setTimeout(()=>{
    //   el.classList.remove('skipped');
    //   el.classList.add('pending');
    // }, 400);
}

function updateCounts() {  // actualiza los contadores de estado de la UI
    const g = state.items.filter(i => i.status === 'correct').length;
    const b = state.items.filter(i => i.status === 'incorrect').length;
    const s = state.items.filter(i => i.status === 'pending').length; // pendientes (incluye saltadas)
    $('#countGood').textContent = `✔ ${g}`;
    $('#countBad').textContent = `✖ ${b}`;
    $('#countSkip').textContent = `⟲ ${s}`;
}

// ======== Timer ========
function startTimer() {
    if (state.running) return;
    state.running = true;
    const snd = $('#timerSound');
    try {
        snd.loop = true;
        snd.currentTime = 0;
        snd.play();
    } catch (e) { console.warn('Could not play timer sound', e); }
    state.timerId = setInterval(() => {
        state.seconds--; $('#time').textContent = state.seconds;
        if (state.seconds <= 0) { endGame(); }
    }, 1000);

    renderQuestion(); // modificado por Lucio para que muestre la definición al iniciar

    // agregado por Lucio: habilitar botones de control
    $('#okBtn').removeAttribute('disabled');
    $('#skipBtn').removeAttribute('disabled');
    $('#nextBtn').removeAttribute('disabled');
    $('#pauseBtn').removeAttribute('disabled');
    $('#koBtn').removeAttribute('disabled');
}
function pauseTimer() {
    state.running = false; clearInterval(state.timerId); state.timerId = null;

    // stop and reset timer audio
    try {
        const snd = $('#timerSound');
        snd.pause(); snd.currentTime = 0; snd.loop = false;
    } catch (e) { console.warn('Error stopping timer sound', e); }

    hideQuestion(); // modificado por Lucio para que oculte la definición al pausar

    // agregado por Lucio: deshabilitar botones de control
    $('#okBtn').setAttribute('disabled', '');
    $('#skipBtn').setAttribute('disabled', '');
    $('#nextBtn').setAttribute('disabled', '');
    $('#pauseBtn').setAttribute('disabled', '');
    $('#koBtn').setAttribute('disabled', '');
}
function resetTimer() { pauseTimer(); state.seconds = 160; $('#time').textContent = state.seconds; }

function endGame() {
    pauseTimer();
    // Construir listas
    const good = state.items.map((it, i) => [it, i]).filter(([it]) => it.status === 'correct');
    const bad = state.items.map((it, i) => [it, i]).filter(([it]) => it.status === 'incorrect');
    const skip = state.items.map((it, i) => [it, i]).filter(([it]) => it.status === 'pending');

    $('#sumGood').textContent = good.length;
    $('#sumBad').textContent = bad.length;
    $('#sumSkip').textContent = skip.length;

    const fill = (ul, arr) => {
        ul.innerHTML = '';
        for (const [it, i] of arr) {
            const li = document.createElement('li');
            li.innerHTML = `<b>${it.word}</b>: ${it.def}`;
            ul.appendChild(li);
        }
    };
    fill($('#ulGood'), good);
    fill($('#ulBad'), bad);
    fill($('#ulSkip'), skip);

    $('#resultModal').showModal();
}

function buscarPalabraAleatoriaPorLetra(letra) {
    let opcionesWords = [];
    let i = 0;
    // buscar la primer palabra que coincida con la letra
    while(i < dataPalabras.length && dataPalabras[i].palabra[0].toUpperCase() != letra.toUpperCase()) {
        i++;
    }
    // guardar todas las palabras que coincidan con la letra
    while ((dataPalabras.length > i) && (dataPalabras[i].palabra[0].toUpperCase() == letra.toUpperCase())) {
        opcionesWords.push(dataPalabras[i]);
        i++;
    }
    if (opcionesWords.length > 0) {
        let opcionFinal = opcionesWords[Math.floor(getRandomArbitrary(0, opcionesWords.length))];
        console.log('Palabra aleatoria para letra', letra, ':', opcionFinal);
        return {
            'letter': letra,
            'word': opcionFinal.palabra[0].toUpperCase() + opcionFinal.palabra.slice(1),
            'def': opcionFinal.significados,
            'status': 'pending'
        };
    }
}

// Teclado rápido para presentador
document.addEventListener('keydown', (e) => {
    if (e.key === ' ') { e.preventDefault(); startTimer(); } // espacio inicia
    if (e.key === 'p' || e.key === 'P') { pauseTimer(); }
    if (e.key === 'ArrowRight') { nextInQueue(); }
    if (e.key === 's' || e.key === 'S') { pressSkip(); }
    if (e.key === 'c' || e.key === 'C') { pressCorrect(); }
    if (e.key === 'i' || e.key === 'I') { pressIncorrect(); }
});