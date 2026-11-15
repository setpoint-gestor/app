"use strict";

// ====================================================================
// 🧠 MÓDULO INTELIGÊNCIA ARTIFICIAL - CONCIERGE DO GESTOR (SaaS)
// ====================================================================

let iaGestorReconhecimentoVoz = null;
let iaGestorGravandoVoz = false;
let iaGestorEsgotadaSessao = false;
let iaGestorModoContinuo = false;
let iaGestorPermissaoMicConcedida = false;
let iaGestorFalaAtivaGlobal = null;
let iaGestorUltimasPilulas = [];

// ====================================================================
// 1. INICIALIZAÇÃO E CONTROLE DE VISIBILIDADE DA INTERFACE
// ====================================================================
function inicializarUIConciergeGestor() {
    if (typeof isGestorLogado === 'undefined' || !isGestorLogado) return;
    if (document.getElementById('fab-ia-gestor')) return;

    const fab = document.createElement('button');
    fab.id = 'fab-ia-gestor';
    fab.title = 'Concierge Executivo SetPoint';
    fab.innerHTML = '<i class="material-icons">auto_awesome</i>';
    fab.style.cssText = `
        position: fixed;
        bottom: 25px;
        right: 20px;
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: linear-gradient(135deg, #8b5cf6 0%, #4f46e5 100%);
        color: #ffffff;
        border: 1px solid rgba(255, 255, 255, 0.25);
        box-shadow: 0 6px 16px rgba(139, 92, 246, 0.4);
        cursor: pointer;
        z-index: 9000;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.2s;
        outline: none;
        -webkit-tap-highlight-color: transparent;
    `;
    fab.onclick = abrirBarraConciergeGestor;

    const backdrop = document.createElement('div');
    backdrop.id = 'ia-gestor-backdrop';
    backdrop.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(15, 23, 42, 0.4);
        backdrop-filter: blur(2px);
        -webkit-backdrop-filter: blur(2px);
        z-index: 9500;
        display: none;
        opacity: 0;
        transition: opacity 0.25s ease;
    `;
    backdrop.onclick = fecharBarraConciergeGestor;

    const menuSugestoes = document.createElement('div');
    menuSugestoes.id = 'ia-gestor-menu-sugestoes';
    menuSugestoes.style.cssText = `
        position: fixed;
        bottom: 90px;
        left: 50%;
        transform: translateX(-50%) translateY(15px);
        width: 92%;
        max-width: 650px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        box-sizing: border-box;
        z-index: 10001;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.25s ease, transform 0.25s ease;
    `;

    const barra = document.createElement('div');
    barra.id = 'ia-gestor-barra-mestra';
    barra.style.cssText = `
        position: fixed;
        bottom: -80px;
        left: 50%;
        transform: translateX(-50%);
        width: 92%;
        max-width: 650px;
        height: 56px;
        border-radius: 30px;
        background-color: #0f172a;
        border: 1px solid #334155;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
        z-index: 10000;
        display: flex;
        align-items: center;
        padding: 0 12px;
        box-sizing: border-box;
        transition: bottom 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.15);
    `;
    barra.innerHTML = `
        <button class="btn-acao-ia" id="ia-gestor-btn-add" title="Sugestões executivas">
            <i class="material-icons">add</i>
        </button>
        <input type="text" id="ia-gestor-input-texto" placeholder="Pergunte ao Concierge do Gestor..." autocomplete="off" style="flex: 1; height: 100%; background: transparent; border: none; outline: none; font-size: 15.5px; font-family: 'Roboto', sans-serif; color: #ffffff; margin: 0 8px;">
        <button class="btn-acao-ia icon-mic" id="ia-gestor-btn-mic" title="Falar">
            <i class="material-icons">mic</i>
        </button>
        <button class="btn-acao-ia icon-live" id="ia-gestor-btn-live" title="Conversa contínua">
            <i class="material-icons">graphic_eq</i>
        </button>
    `;

    document.body.appendChild(fab);
    document.body.appendChild(backdrop);
    document.body.appendChild(menuSugestoes);
    document.body.appendChild(barra);

    vincularEventosConciergeGestor();
    prepararMotorDeVozConciergeGestor();
    iniciarObservadorVisibilidadeFabGestor();
}

function iniciarObservadorVisibilidadeFabGestor() {
    const atualizarVisibilidade = () => {
        const fab = document.getElementById('fab-ia-gestor');
        const barra = document.getElementById('ia-gestor-barra-mestra');
        if (!fab) return;

        if (typeof isGestorLogado === 'undefined' || !isGestorLogado) {
            fab.style.display = 'none';
            return;
        }

        const telaDash = document.getElementById('tela-gestor-dashboard');
        const telaQuadras = document.getElementById('tela-visao-quadras');
        const emTelaPermitida = (telaDash && telaDash.classList.contains('ativa')) ||
                                (telaQuadras && telaQuadras.classList.contains('ativa'));

        const barraAberta = barra && barra.dataset.aberta === 'true';

        if (!emTelaPermitida || barraAberta) {
            fab.style.display = 'none';
        } else {
            fab.style.display = 'flex';
        }
    };

    atualizarVisibilidade();
    setInterval(atualizarVisibilidade, 400);
}

// ====================================================================
// 2. GESTÃO DE ESTADOS (Abertura, Fechamento e Interação)
// ====================================================================
function vincularEventosConciergeGestor() {
    const btnAdd = document.getElementById('ia-gestor-btn-add');
    const btnMic = document.getElementById('ia-gestor-btn-mic');
    const btnLive = document.getElementById('ia-gestor-btn-live');
    const inputTexto = document.getElementById('ia-gestor-input-texto');

    if (btnAdd) btnAdd.addEventListener('click', ciclarSugestoesGestorIA);

    if (inputTexto) {
        inputTexto.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const comando = inputTexto.value.trim();
                if (comando) processarMensagemConciergeGestor(comando);
            }
        });
    }

    if (btnMic) btnMic.addEventListener('click', alternarGravacaoVozConciergeGestor);
    if (btnLive) btnLive.addEventListener('click', alternarModoContinuoConciergeGestor);

    document.addEventListener('keydown', (e) => {
        const barra = document.getElementById('ia-gestor-barra-mestra');
        if (e.key === 'Escape' && barra && barra.dataset.aberta === 'true') {
            fecharBarraConciergeGestor();
        }
    });
}

function alternarModoContinuoConciergeGestor() {
    if (iaGestorEsgotadaSessao) return;

    iaGestorModoContinuo = !iaGestorModoContinuo;
    const btnLive = document.getElementById('ia-gestor-btn-live');

    if (iaGestorModoContinuo) {
        if (btnLive) {
            btnLive.style.color = '#10b981';
            btnLive.style.filter = 'drop-shadow(0 0 8px rgba(16, 185, 129, 0.7))';
        }
        if (typeof showToast === 'function') {
            showToast("Conversa contínua ativada! Fale à vontade.", "info", 3000);
        }
        if (!iaGestorGravandoVoz) {
            iniciarGravacaoVozConciergeGestor();
        }
    } else {
        desativarModoContinuoVisualGestor();
        encerrarMicrofoneSilenciosoGestor();
        if ('speechSynthesis' in window) window.speechSynthesis.cancel();
        if (typeof showToast === 'function') {
            showToast("Conversa contínua desativada.", "info", 2000);
        }
    }
}

function desativarModoContinuoVisualGestor() {
    iaGestorModoContinuo = false;
    const btnLive = document.getElementById('ia-gestor-btn-live');
    if (btnLive) {
        btnLive.style.color = '';
        btnLive.style.filter = '';
    }
}

function abrirBarraConciergeGestor() {
    if (iaGestorEsgotadaSessao) {
        if (typeof showToast === 'function') {
            showToast("Meus créditos esgotaram. Volto amanhã!", "warning");
        }
        return;
    }

    const fab = document.getElementById('fab-ia-gestor');
    const backdrop = document.getElementById('ia-gestor-backdrop');
    const barra = document.getElementById('ia-gestor-barra-mestra');

    if (fab) fab.style.display = 'none';
    if (backdrop) {
        backdrop.style.display = 'block';
        setTimeout(() => { backdrop.style.opacity = '1'; }, 10);
    }
    if (barra) {
        barra.dataset.aberta = 'true';
        barra.style.bottom = '25px';
    }

    ciclarSugestoesGestorIA();
}

function fecharBarraConciergeGestor() {
    const fab = document.getElementById('fab-ia-gestor');
    const backdrop = document.getElementById('ia-gestor-backdrop');
    const barra = document.getElementById('ia-gestor-barra-mestra');

    if (barra) {
        barra.dataset.aberta = 'false';
        barra.style.bottom = '-80px';
    }
    if (backdrop) {
        backdrop.style.opacity = '0';
        setTimeout(() => { backdrop.style.display = 'none'; }, 250);
    }
    if (fab) fab.style.display = 'flex';

    const input = document.getElementById('ia-gestor-input-texto');
    if (input) {
        if (!iaGestorEsgotadaSessao) input.value = '';
        input.blur();
    }

    fecharMenuSugestoesGestor();
    encerrarMicrofoneSilenciosoGestor();
    desativarModoContinuoVisualGestor();

    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}

// ====================================================================
// 3. CARROSSEL DINÂMICO DE ATALHOS EXECUTIVOS (Pílulas do Gestor)
// ====================================================================
function gerarPilulasDinamicasGestor() {
    const sugestoes = [
        { icon: 'analytics', text: 'Resumo operacional da arena hoje', color: '#4ade80' },
        { icon: 'paid', text: 'Temos taxas de convidados pendentes?', color: '#10b981' },
        { icon: 'grid_on', text: 'Qual a taxa de ocupação das quadras hoje?', color: '#38bdf8' },
        { icon: 'people', text: 'Quantos sócios estão online agora?', color: '#60a5fa' },
        { icon: 'emoji_events', text: 'Como está o andamento do ranking atual?', color: '#f59e0b' },
        { icon: 'cake', text: 'Quais sócios fazem aniversário este mês?', color: '#f43f5e' },
        { icon: 'gavel', text: 'Há alguma súmula contestada ou pendente?', color: '#fbbf24' },
        { icon: 'person_add', text: 'Abrir Cadastro de Jogadores', color: '#c084fc' },
        { icon: 'settings', text: 'Abrir Configurações do Ranking', color: '#cbd5e1' },
        { icon: 'history', text: 'Abrir Histórico e Logs', color: '#e879f9' }
    ];

    return sugestoes;
}

function medirLarguraFisicaPilulaGestor(item) {
    const tester = document.createElement('div');
    tester.className = 'pilula-sugestao tester-medicao';
    tester.style.cssText = 'position:absolute; visibility:hidden; white-space:nowrap; width:auto; left:-9999px; top:-9999px; font-size: 13px; font-weight: 500; padding: 8px 14px; display: inline-flex; align-items: center; gap: 8px; font-family: Roboto, sans-serif;';
    tester.innerHTML = `<i class="material-icons" style="font-size:16px;">${item.icon}</i> <span>${item.text}</span>`;
    document.body.appendChild(tester);
    const larguraReal = tester.offsetWidth;
    document.body.removeChild(tester);
    return larguraReal;
}

function sortearPilulasAleatoriasGestor(catalogo, quantidade = 2) {
    if (catalogo.length <= quantidade) return [...catalogo];

    let disponiveis = catalogo.filter(item => !iaGestorUltimasPilulas.includes(item.text));
    if (disponiveis.length < quantidade) disponiveis = [...catalogo];

    const embaralhado = disponiveis.sort(() => Math.random() - 0.5);
    const selecionadas = embaralhado.slice(0, quantidade);

    iaGestorUltimasPilulas = selecionadas.map(i => i.text);
    return selecionadas;
}

function ciclarSugestoesGestorIA() {
    if (iaGestorEsgotadaSessao) return;
    const container = document.getElementById('ia-gestor-menu-sugestoes');
    if (!container) return;

    const catalogo = gerarPilulasDinamicasGestor();
    const candidatas = sortearPilulasAleatoriasGestor(catalogo, 2);

    const larguraTela = window.innerWidth;
    const larguraUtilDisponivel = Math.min(larguraTela - 24, 650);
    const gapEntrePilulas = 8;

    const larguraItem1 = medirLarguraFisicaPilulaGestor(candidatas[0]);
    const larguraItem2 = candidatas[1] ? medirLarguraFisicaPilulaGestor(candidatas[1]) : 0;

    let pilulasParaExibir = [];
    let modoExibicao = 'unica';

    if (candidatas[1] && (larguraItem1 + larguraItem2 + gapEntrePilulas) <= larguraUtilDisponivel) {
        pilulasParaExibir = candidatas;
        modoExibicao = 'dupla';
    } else {
        pilulasParaExibir = [candidatas[0]];
        modoExibicao = 'unica';
    }

    container.style.opacity = '0';
    container.style.transform = 'translateX(-50%) translateY(8px)';

    setTimeout(() => {
        container.innerHTML = '';

        pilulasParaExibir.forEach(item => {
            const pilula = document.createElement('div');
            pilula.className = `pilula-sugestao ${modoExibicao === 'unica' ? 'pilula-formato-duas-linhas' : 'pilula-formato-linha-unica'}`;
            pilula.innerHTML = `<i class="material-icons" style="font-size:16px; color:${item.color};">${item.icon}</i> <span>${item.text}</span>`;

            pilula.onclick = () => {
                const inputTexto = document.getElementById('ia-gestor-input-texto');
                if (inputTexto) inputTexto.value = item.text;
                fecharMenuSugestoesGestor();
                processarMensagemConciergeGestor(item.text);
            };

            container.appendChild(pilula);
        });

        container.style.pointerEvents = 'auto';
        container.style.opacity = '1';
        container.style.transform = 'translateX(-50%) translateY(0)';
    }, 160);
}

function fecharMenuSugestoesGestor() {
    const container = document.getElementById('ia-gestor-menu-sugestoes');
    if (container) {
        container.style.pointerEvents = 'none';
        container.style.opacity = '0';
        container.style.transform = 'translateX(-50%) translateY(8px)';
    }
}

// ====================================================================
// 4. MOTOR DE VOZ (Captação Fonética & Permissões Nativas)
// ====================================================================
async function garantirPermissaoMicrofoneGestor() {
    if (iaGestorPermissaoMicConcedida) return true;

    try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop());
            iaGestorPermissaoMicConcedida = true;
            return true;
        }
    } catch (err) {
        console.warn("Permissão de microfone negada:", err);
        iaGestorPermissaoMicConcedida = false;
        return false;
    }
    return true;
}

function prepararMotorDeVozConciergeGestor() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const btnMic = document.getElementById('ia-gestor-btn-mic');

    if (!SpeechRecognition) {
        if (btnMic) btnMic.style.display = 'none';
        return;
    }

    iaGestorReconhecimentoVoz = new SpeechRecognition();
    iaGestorReconhecimentoVoz.lang = 'pt-BR';
    iaGestorReconhecimentoVoz.continuous = false;
    iaGestorReconhecimentoVoz.interimResults = false;

    iaGestorReconhecimentoVoz.onresult = (event) => {
        const transcricao = event.results[0][0].transcript.trim();
        if (transcricao) {
            const inputTexto = document.getElementById('ia-gestor-input-texto');
            if (inputTexto) inputTexto.value = transcricao;
            processarMensagemConciergeGestor(transcricao);
        }
        encerrarMicrofoneSilenciosoGestor();
    };

    iaGestorReconhecimentoVoz.onerror = (event) => {
        encerrarMicrofoneSilenciosoGestor();
        if (event.error === 'not-allowed') {
            iaGestorPermissaoMicConcedida = false;
            if (typeof showToast === 'function') showToast("Permita o acesso ao microfone no dispositivo.", "warning");
        } else if (event.error === 'no-speech') {
            if (typeof showToast === 'function') {
                showToast(iaGestorModoContinuo ? "Não captei sua resposta. Pode repetir?" : "Não captei sua voz. Tente novamente.", "info", 2500);
            }
        }
    };

    iaGestorReconhecimentoVoz.onend = () => {
        encerrarMicrofoneSilenciosoGestor();
    };
}

async function iniciarGravacaoVozConciergeGestor() {
    if (!iaGestorReconhecimentoVoz || iaGestorEsgotadaSessao || iaGestorGravandoVoz) return;

    const permissaoConcedida = await garantirPermissaoMicrofoneGestor();
    if (!permissaoConcedida) {
        if (typeof showToast === 'function') showToast("O microfone está bloqueado.", "error");
        desativarModoContinuoVisualGestor();
        return;
    }

    const btnMic = document.getElementById('ia-gestor-btn-mic');
    const inputTexto = document.getElementById('ia-gestor-input-texto');

    try {
        iaGestorGravandoVoz = true;
        if (btnMic) {
            btnMic.classList.add('gravando');
            btnMic.innerHTML = '<i class="material-icons">close</i>';
            btnMic.style.color = '#f87171';
        }
        if (inputTexto) {
            inputTexto.value = '';
            inputTexto.placeholder = "Ouvindo... (fale agora)";
        }
        if (navigator.vibrate) navigator.vibrate([30, 50, 30]);

        iaGestorReconhecimentoVoz.start();
    } catch (e) {
        encerrarMicrofoneSilenciosoGestor();
    }
}

async function alternarGravacaoVozConciergeGestor() {
    if (iaGestorGravandoVoz) {
        encerrarMicrofoneSilenciosoGestor();
    } else {
        await iniciarGravacaoVozConciergeGestor();
    }
}

function encerrarMicrofoneSilenciosoGestor() {
    iaGestorGravandoVoz = false;
    const btnMic = document.getElementById('ia-gestor-btn-mic');
    const inputTexto = document.getElementById('ia-gestor-input-texto');

    if (btnMic) {
        btnMic.classList.remove('gravando');
        btnMic.innerHTML = '<i class="material-icons">mic</i>';
        btnMic.style.color = '';
    }
    if (inputTexto && inputTexto.placeholder === "Ouvindo... (fale agora)") {
        inputTexto.placeholder = "Pergunte ao Concierge do Gestor...";
    }
    if (iaGestorReconhecimentoVoz) {
        try { iaGestorReconhecimentoVoz.stop(); } catch (e) {}
    }
}

// ====================================================================
// 5. EXTRATORES EXECUTIVOS EM TEMPO REAL (RAG GERENCIAL IN-BROWSER)
// ====================================================================

// 5.1. Panorama da Arena, Infraestrutura e Ocupação/Ociosidade
function extrairPanoramaEOcupacaoGestor() {
    const agora = new Date();
    const diaHojeIdx = agora.getDay() === 0 ? 7 : agora.getDay();
    const diaAmanhaIdx = diaHojeIdx === 7 ? 1 : diaHojeIdx + 1;

    const nomeClube = (document.getElementById('txt-nome-clube')?.textContent || clubeAtivoId || 'Arena').trim();
    const config = (typeof configRegrasGlobal !== 'undefined' && configRegrasGlobal) ? configRegrasGlobal : {};
    const sistemaAberto = config.Abrir !== false ? 'ABERTO (Operando normalmente)' : 'FECHADO (Em Manutenção)';

    const quadrasCfg = (typeof configQuadrasGlobal !== 'undefined' && configQuadrasGlobal) ? configQuadrasGlobal : {};
    const qtdQuadras = parseInt(quadrasCfg.quantidade, 10) || 0;
    const nomesQuadras = quadrasCfg.nomes || {};

    let statusQuadrasLista = [];
    for (let i = 1; i <= qtdQuadras; i++) {
        const dadosQ = nomesQuadras[i];
        const nomeQ = typeof dadosQ === 'object' ? (dadosQ.nome || `Quadra ${i}`) : (dadosQ || `Quadra ${i}`);
        const stQ = nomesQuadras['status_' + i] || 'liberada';
        statusQuadrasLista.push(`${nomeQ} (${stQ})`);
    }

    const todasReservas = (typeof reservasGeralGlobal !== 'undefined' && reservasGeralGlobal) ? reservasGeralGlobal : {};
    let totalJogosHoje = 0;
    let totalJogosAmanha = 0;
    let ocupacaoPorQuadraHoje = [];

    for (let i = 1; i <= qtdQuadras; i++) {
        const chaveQ = `Quadra - ${i}`;
        const slots = todasReservas[chaveQ] || {};
        let ocupadosHoje = [];
        let aulasHoje = 0;
        let rankingHoje = 0;

        Object.keys(slots).forEach(slotKey => {
            const r = slots[slotKey];
            if (!r || r.status === 'aula_cancelada') return;
            const diaR = parseInt(r.dia, 10) || parseInt(slotKey.split('_')[0], 10);
            const horaR = parseInt(r.hora, 10) || parseInt(slotKey.split('_')[1], 10);

            if (diaR === diaHojeIdx) {
                ocupadosHoje.push(`${String(horaR).padStart(2, '0')}:00`);
                if (r.borda !== undefined || parseInt(r.duracao, 10) !== 2) {
                    totalJogosHoje++;
                    if (r.tipo === 'aula') aulasHoje++;
                    if (r.isRanking || r.tipo === 'ranking') rankingHoje++;
                }
            } else if (diaR === diaAmanhaIdx) {
                if (r.borda !== undefined || parseInt(r.duracao, 10) !== 2) {
                    totalJogosAmanha++;
                }
            }
        });

        const dadosQ = nomesQuadras[i];
        const nomeQ = typeof dadosQ === 'object' ? (dadosQ.nome || `Quadra ${i}`) : (dadosQ || `Quadra ${i}`);
        const slotsTotaisDia = 17; // 06h às 22h
        const pctOcup = Math.round((ocupadosHoje.length / slotsTotaisDia) * 100);
        ocupacaoPorQuadraHoje.push(
            `- ${nomeQ}: ${ocupadosHoje.length}/${slotsTotaisDia} horários ocupados (${pctOcup}%), ${aulasHoje} aula(s), ${rankingHoje} jogo(s) de ranking.`
        );
    }

    return `PANORAMA DA ARENA & OCUPAÇÃO:
- Clube: ${nomeClube} | Status do App: ${sistemaAberto}
- Momento: ${agora.toLocaleDateString('pt-BR')} às ${agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
- Infraestrutura (${qtdQuadras} quadras): ${statusQuadrasLista.join(', ') || 'Nenhuma quadra cadastrada'}
- Resumo de Agendamentos: ${totalJogosHoje} reserva(s) hoje e ${totalJogosAmanha} reserva(s) amanhã.
- Detalhe por Quadra Hoje:
${ocupacaoPorQuadraHoje.join('\n') || '- Sem dados de ocupação.'}`;
}

// 5.2. Financeiro (Taxas de Convidados Pendentes e Inscrições Ranking)
function extrairFinanceiroGestor() {
    const todasReservas = (typeof reservasGeralGlobal !== 'undefined' && reservasGeralGlobal) ? reservasGeralGlobal : {};
    const confConv = (typeof configConvidadosGlobal !== 'undefined' && configConvidadosGlobal) ? configConvidadosGlobal : {};
    const agora = Date.now();

    let qtdReservasComPendencia = 0;
    let qtdConvidadosPendentes = 0;
    let valorTotalPendente = 0;
    let detalhesPendencias = [];

    Object.keys(todasReservas).forEach(quadraKey => {
        const slots = todasReservas[quadraKey] || {};
        const numQ = quadraKey.match(/\d+/);
        const taxaStr = (numQ && confConv[`Quadra${numQ[0]}`]?.Taxa) ? confConv[`Quadra${numQ[0]}`].Taxa : (confConv.Taxa || '0,00');
        const taxaUnit = parseFloat(String(taxaStr).replace(/\./g, '').replace(',', '.')) || 0;

        Object.keys(slots).forEach(slotKey => {
            const r = slots[slotKey];
            if (!r || r.status === 'aula_cancelada') return;
            if (r.borda === undefined && parseInt(r.duracao, 10) === 2) return;
            if (!r.expiraEm || r.expiraEm <= agora) return;

            const dadosC = r.dadosConvidados || {};
            let pendentesNestaReserva = [];

            Object.keys(dadosC).forEach(nomeC => {
                if (dadosC[nomeC].statusTaxa !== 'pago') {
                    pendentesNestaReserva.push(dadosC[nomeC].nomeCompleto || nomeC);
                }
            });

            if (pendentesNestaReserva.length > 0) {
                qtdReservasComPendencia++;
                qtdConvidadosPendentes += pendentesNestaReserva.length;
                const subtotal = pendentesNestaReserva.length * taxaUnit;
                valorTotalPendente += subtotal;
                detalhesPendencias.push(
                    `Org: ${r.organizador || 'Sócio'} (${quadraKey}, ${String(r.hora).padStart(2, '0')}:00) - ${pendentesNestaReserva.length} convidado(s) - R$ ${subtotal.toFixed(2).replace('.', ',')}`
                );
            }
        });
    });

    const rankingCfg = (typeof configRegrasGlobal !== 'undefined' && configRegrasGlobal?.ranking) ? configRegrasGlobal.ranking : {};
    const finRanking = rankingCfg.financeiro || {};
    const inscritosMap = rankingCfg.inscritosConfirmados || {};
    const idsInscritos = Object.keys(inscritosMap);
    const pagosRanking = idsInscritos.filter(id => inscritosMap[id]?.pixPago === true).length;
    const pendentesPixRanking = idsInscritos.length - pagosRanking;

    return `FINANCEIRO & BAIXAS:
- Taxas de Convidados Pendentes: ${qtdConvidadosPendentes} convidado(s) em ${qtdReservasComPendencia} reserva(s), totalizando R$ ${valorTotalPendente.toFixed(2).replace('.', ',')}.
${detalhesPendencias.length > 0 ? '- Detalhes: ' + detalhesPendencias.join(' | ') : '- Nenhuma taxa de convidado pendente no momento.'}
- Inscrições Ranking (Taxa ativa: ${finRanking.cobrarTaxa ? 'Sim, R$ ' + (finRanking.valorTaxa || '0,00') : 'Não'}): ${idsInscritos.length} inscritos (${pagosRanking} PIX pago(s), ${pendentesPixRanking} pendente(s)).`;
}

// 5.3. Quadro Social, Aniversariantes e Usuários Online
function extrairQuadroSocialEOnlineGestor() {
    const jogs = (typeof jogadoresGlobal !== 'undefined' && jogadoresGlobal) ? jogadoresGlobal : {};
    const ids = Object.keys(jogs);
    const mesAtual = String(new Date().getMonth() + 1).padStart(2, '0');
    const diaHojeStr = String(new Date().getDate()).padStart(2, '0');

    let ativos = 0;
    let inativos = 0;
    let titulares = 0;
    let dependentes = 0;
    let visitantes = 0;
    let noRanking = 0;
    let aniversariantesMes = [];

    ids.forEach(id => {
        const j = jogs[id];
        if (!j) return;
        if (j.ativo === false) {
            inativos++;
            return;
        }
        ativos++;
        if (j.socio === 'dependente') dependentes++;
        else if (j.socio === 'visitante') visitantes++;
        else titulares++;

        if (j.participaRanking) noRanking++;

        if (j.niver && j.niver.includes('/')) {
            const partes = j.niver.split('/');
            if (partes[1] === mesAtual) {
                const ehHoje = partes[0] === diaHojeStr ? ' (HOJE!)' : '';
                aniversariantesMes.push(`${j.apelido || j.nomeCompleto} dia ${partes[0]}/${partes[1]}${ehHoje}`);
            }
        }
    });

    const onlineCache = (typeof saasUsuariosOnlineCache !== 'undefined' && saasUsuariosOnlineCache) ? saasUsuariosOnlineCache : {};
    const agora = Date.now();
    const onlineNomes = [];
    Object.keys(onlineCache).forEach(k => {
        const u = onlineCache[k];
        if (!u || k === 'GESTOR' || u.isGestor) return;
        if (u.lastSeen && (agora - u.lastSeen > 5 * 60 * 1000)) return;
        onlineNomes.push(u.usuario || k);
    });

    return `QUADRO SOCIAL & PRESENÇA AO VIVO:
- Sócios Online Agora (${onlineNomes.length}): ${onlineNomes.length > 0 ? onlineNomes.join(', ') : 'Nenhum sócio online no momento.'}
- Base Cadastral: ${ativos} ativos (${titulares} titulares, ${dependentes} dependentes, ${visitantes} staff/visitantes), ${inativos} inativos, ${noRanking} habilitados no ranking.
- Aniversariantes do Mês (${aniversariantesMes.length}): ${aniversariantesMes.length > 0 ? aniversariantesMes.join(', ') : 'Nenhum aniversariante este mês.'}`;
}

// 5.4. Ranking, Convites da Temporada e Arbitragem
function extrairStatusRankingEArbitragemGestor() {
    const rankingCfg = (typeof configRegrasGlobal !== 'undefined' && configRegrasGlobal?.ranking) ? configRegrasGlobal.ranking : {};
    const cal = rankingCfg.calendario || {};
    const faseAtual = parseInt(rankingCfg.faseAtual, 10) || 1;
    const mapaFases = {
        1: 'Fase 1 (Configuração & Calendário)',
        2: 'Fase 2 (Inscrições Abertas)',
        3: 'Fase 3 (Competição / Fase de Chaves Ativa)',
        4: 'Fase 4 (Quadro Eliminatório / Mata-Mata)',
        5: 'Fase 5 (Torneio Concluído & Homologado)'
    };

    const convites = (typeof convitesRankingGlobal !== 'undefined' && convitesRankingGlobal) ? convitesRankingGlobal : {};
    const qtdConvitesPendentes = (convites.status === 'aberto' && convites.pendentes) ? Object.keys(convites.pendentes).length : 0;

    const todasReservas = (typeof reservasGeralGlobal !== 'undefined' && reservasGeralGlobal) ? reservasGeralGlobal : {};
    let sumulasPendentes = 0;
    let sumulasContestadas = 0;

    Object.keys(todasReservas).forEach(qKey => {
        const slots = todasReservas[qKey] || {};
        Object.keys(slots).forEach(sKey => {
            const r = slots[sKey];
            if (!r) return;
            if (r.borda === undefined && parseInt(r.duracao, 10) === 2) return;
            if (r.statusPlacar === 'pendente_validacao') sumulasPendentes++;
            if (r.statusPlacar === 'contestado') sumulasContestadas++;
        });
    });

    const partidasObj = (typeof rankingPartidasGlobal !== 'undefined' && rankingPartidasGlobal) ? rankingPartidasGlobal : {};
    const totalPartidasFinalizadas = Object.values(partidasObj).filter(p => p && p.status === 'finalizada').length;

    return `RANKING & ARBITRAGEM:
- Módulo Ranking: ${rankingCfg.ativo !== false ? 'ATIVO' : 'DESATIVADO'}
- Torneio: ${cal.nomeTorneio || rankingCfg.nomeTorneio || 'Sem nome definido'} | Modelo: ${cal.formatoTorneio || 'grupos'}
- Estágio Atual: ${mapaFases[faseAtual] || `Fase ${faseAtual}`}
- Convites Aguardando Resposta: ${qtdConvitesPendentes} atleta(s)
- Súmulas: ${totalPartidasFinalizadas} finalizada(s), ${sumulasPendentes} aguardando validação do adversário, ${sumulasContestadas} contestada(s) aguardando árbitro.`;
}

// ====================================================================
// 6. ROTEADOR DE AÇÕES ADMINISTRATIVAS (Function Calling Executivo)
// ====================================================================
function executarAcaoDoGestorIA(jsonDaIA) {
    if (!jsonDaIA || !jsonDaIA.intencao) return;

    const intencao = String(jsonDaIA.intencao).trim().toUpperCase();

    setTimeout(() => {
        switch (intencao) {
            case "ABRIR_CADASTRO":
                fecharBarraConciergeGestor();
                if (typeof abrirModuloJogadores === 'function') abrirModuloJogadores();
                break;

            case "ABRIR_QUADRAS":
                fecharBarraConciergeGestor();
                if (typeof abrirGerenciadorQuadras === 'function') abrirGerenciadorQuadras();
                break;

            case "ABRIR_HORARIOS":
                fecharBarraConciergeGestor();
                if (typeof abrirModalConfig === 'function') abrirModalConfig('modal-horarios');
                break;

            case "ABRIR_REGRAS":
                fecharBarraConciergeGestor();
                if (typeof abrirModalConfig === 'function') abrirModalConfig('modal-regras');
                break;

            case "ABRIR_RANKING":
                fecharBarraConciergeGestor();
                if (typeof abrirModalConfigRanking === 'function') {
                    abrirModalConfigRanking();
                } else if (typeof abrirModalConfig === 'function') {
                    abrirModalConfig('modal-config-ranking');
                }
                break;

            case "ABRIR_LOGS":
                fecharBarraConciergeGestor();
                if (typeof abrirModuloLogs === 'function') {
                    abrirModuloLogs();
                } else if (typeof abrirModalConfig === 'function') {
                    abrirModalConfig('modal-historico-logs');
                }
                break;

            case "ABRIR_PLANILHA":
                fecharBarraConciergeGestor();
                if (typeof abrirVisaoQuadras === 'function') abrirVisaoQuadras();
                break;

            case "ABRIR_BAIXAS":
                fecharBarraConciergeGestor();
                if (typeof alternarPopoverBaixasSaaS === 'function') alternarPopoverBaixasSaaS();
                break;

            case "ABRIR_ONLINE":
                fecharBarraConciergeGestor();
                if (typeof abrirJanelaOnlineSaaS === 'function') abrirJanelaOnlineSaaS();
                break;

            case "CONSULTA_GERAL":
            default:
                break;
        }
    }, 1200);
}

// ====================================================================
// 7. DISPACHO E COMUNICAÇÃO COM GEMINI API (JSON + FALLBACK)
// ====================================================================
async function processarMensagemConciergeGestor(texto) {
    if (!geminiApiKeyGlobal) {
        if (typeof showToast === 'function') showToast("Aguarde, conectando ao cérebro do SetPoint...", "warning");
        return;
    }

    const inputTexto = document.getElementById('ia-gestor-input-texto');
    if (inputTexto) {
        inputTexto.value = 'Analisando indicadores...';
        inputTexto.disabled = true;
    }

    if (typeof showToast === 'function') {
        showToast("Consultando indicadores da arena...", "info", 2000);
    }

    const panoramaArena = extrairPanoramaEOcupacaoGestor();
    const financeiroArena = extrairFinanceiroGestor();
    const quadroSocial = extrairQuadroSocialEOnlineGestor();
    const statusRanking = extrairStatusRankingEArbitragemGestor();

    const modelosParaTestar = [
        { nome: 'Gemini 2.5 Flash', id: 'gemini-2.5-flash' },
        { nome: 'Gemini 3.5 Flash Lite', id: 'gemini-3.5-flash-lite' },
        { nome: 'Gemini 3.5 Flash', id: 'gemini-3.5-flash' }
    ];

    const corpoRequisicao = {
        contents: [{
            parts: [{
                text: `
DIRETRIZES DO SISTEMA (CONCIERGE EXECUTIVO DO GESTOR):
Você é o assistente executivo inteligente do Gestor/Dono da arena no sistema SetPoint.
Responda de forma objetiva, estratégica, educada e ULTRA-CONCISA (máximo de 2 a 3 frases curtas, pois a resposta aparecerá num Toast e será lida por voz).
Não use formatação Markdown (como ** ou *).

DADOS EM TEMPO REAL DA ARENA:
${panoramaArena}

${financeiroArena}

${quadroSocial}

${statusRanking}

Solicitação do Gestor: "${texto}"

Responda EXCLUSIVAMENTE com um objeto JSON válido contendo:
- "intencao": Uma das opções exatas:
  * "ABRIR_CADASTRO" (se pedir para abrir cadastro/jogadores)
  * "ABRIR_QUADRAS" (se pedir para abrir gerenciador de quadras)
  * "ABRIR_HORARIOS" (se pedir para abrir horários e grades)
  * "ABRIR_REGRAS" (se pedir para abrir regras de reserva)
  * "ABRIR_RANKING" (se pedir para abrir configurações do ranking)
  * "ABRIR_LOGS" (se pedir para abrir histórico e logs)
  * "ABRIR_PLANILHA" (se pedir para ir para visão das quadras/planilha)
  * "ABRIR_BAIXAS" (se pedir para abrir ou dar baixa nas taxas de convidados)
  * "ABRIR_ONLINE" (se pedir para ver a lista de usuários online/acessos)
  * "CONSULTA_GERAL" (para qualquer pergunta analítica, financeira, de ocupação, aniversariantes ou status)
- "mensagem": Sua resposta executiva curta e direta.
- "parametros_acao": Objeto vazio {}.
`
            }]
        }],
        generationConfig: { temperature: 0.0, responseMimeType: "application/json" }
    };

    let respostaIAObj = null;
    let cotaEsgotadaDetectada = false;

    for (const modelo of modelosParaTestar) {
        const urlEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelo.id}:generateContent?key=${geminiApiKeyGlobal}`;

        try {
            const resposta = await fetch(urlEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(corpoRequisicao)
            });

            const dados = await resposta.json();

            if (dados.candidates && dados.candidates[0].content) {
                try {
                    respostaIAObj = JSON.parse(dados.candidates[0].content.parts[0].text);
                    console.log(`🤖 [Gestor IA - ${modelo.nome}]:`, respostaIAObj);
                } catch (e) {
                    console.error("❌ Erro JSON Gestor IA:", e);
                }
                break;
            } else if (dados.error) {
                if (dados.error.code === 429 || (dados.error.message && dados.error.message.includes('Quota exceeded'))) {
                    cotaEsgotadaDetectada = true;
                }
            }
        } catch (e) {
            console.warn(`Falha de conexão com ${modelo.nome}:`, e);
        }
    }

if (respostaIAObj && respostaIAObj.mensagem) {
        // Dispensa eventual aviso intermediário ("Consultando indicadores...") para exibir a resposta imediatamente
        const toastIntermediario = document.querySelector('#toastContainer .toast.info');
        if (toastIntermediario) toastIntermediario.click();

        const temSuporteVoz = ('speechSynthesis' in window);
        const controleToast = (typeof showToast === 'function')
            ? showToast(respostaIAObj.mensagem, "success", temSuporteVoz ? 0 : 7500, () => {
                if ('speechSynthesis' in window) window.speechSynthesis.cancel();
                iaGestorFalaAtivaGlobal = null;
                desativarModoContinuoVisualGestor();
            })
            : null;

        falarRespostaConciergeGestor(respostaIAObj.mensagem, controleToast);
        executarAcaoDoGestorIA(respostaIAObj);
    } else if (cotaEsgotadaDetectada) {
        iaGestorEsgotadaSessao = true;
        const fab = document.getElementById('fab-ia-gestor');
        if (fab) {
            fab.innerHTML = '<i class="material-icons">bedtime</i>';
            fab.style.filter = 'grayscale(100%)';
            fab.style.opacity = '0.7';
        }
        if (typeof showToast === 'function') {
            showToast("Os limites da API Google esgotaram. Volto em breve!", "warning", 8000);
        }
        fecharBarraConciergeGestor();
        return;
    } else {
        if (typeof showToast === 'function') {
            showToast("Não consegui processar sua solicitação agora. Tente novamente.", "error");
        }
    }

    if (inputTexto) {
        inputTexto.value = '';
        inputTexto.disabled = false;
        inputTexto.focus();
    }
}

// ====================================================================
// 8. DEVOLUÇÃO SENSORIAL (Text-to-Speech Nativo)
// ====================================================================
let iaGestorControleRespiracaoFala = null;
let iaGestorTimeoutSegurancaFala = null;

function falarRespostaConciergeGestor(textoBase, controleToast = null) {
    if (!('speechSynthesis' in window)) {
        if (controleToast && typeof controleToast.fechar === 'function') {
            setTimeout(() => controleToast.fechar(), 7000);
        }
        return;
    }

    if (iaGestorControleRespiracaoFala) clearInterval(iaGestorControleRespiracaoFala);
    if (iaGestorTimeoutSegurancaFala) clearTimeout(iaGestorTimeoutSegurancaFala);

    window.speechSynthesis.cancel();
    encerrarMicrofoneSilenciosoGestor();

    const textoLimpo = textoBase.replace(/\*\*/g, '').replace(/\*/g, '');
    const fala = new SpeechSynthesisUtterance(textoLimpo);
    fala.lang = 'pt-BR';
    fala.rate = 1.0;
    fala.pitch = 1.0;

    const vozes = window.speechSynthesis.getVoices();
    const vozGoogleBr = vozes.find(v => v.name.includes('Google') && v.lang === 'pt-BR');
    if (vozGoogleBr) fala.voice = vozGoogleBr;

    iaGestorFalaAtivaGlobal = fala;
    let falaFinalizada = false;

    const finalizarLeitura = (reativarEscuta = true) => {
        if (falaFinalizada) return;
        falaFinalizada = true;

        if (iaGestorControleRespiracaoFala) {
            clearInterval(iaGestorControleRespiracaoFala);
            iaGestorControleRespiracaoFala = null;
        }
        if (iaGestorTimeoutSegurancaFala) {
            clearTimeout(iaGestorTimeoutSegurancaFala);
            iaGestorTimeoutSegurancaFala = null;
        }

        iaGestorFalaAtivaGlobal = null;

        if (controleToast && typeof controleToast.fechar === 'function') {
            controleToast.fechar();
        }

        if (reativarEscuta && iaGestorModoContinuo && !iaGestorEsgotadaSessao) {
            setTimeout(() => {
                iniciarGravacaoVozConciergeGestor();
            }, 800);
        }
    };

    iaGestorControleRespiracaoFala = setInterval(() => {
        if (!window.speechSynthesis.speaking) {
            clearInterval(iaGestorControleRespiracaoFala);
            iaGestorControleRespiracaoFala = null;
        } else {
            window.speechSynthesis.pause();
            window.speechSynthesis.resume();
        }
    }, 14000);

    fala.onend = () => {
        finalizarLeitura(true);
    };

    fala.onerror = () => {
        finalizarLeitura(false);
    };

    const tempoMaximoSeguranca = Math.max((textoLimpo.length * 250) + 4000, 12000);
    iaGestorTimeoutSegurancaFala = setTimeout(() => {
        if (!falaFinalizada && iaGestorFalaAtivaGlobal === fala) {
            window.speechSynthesis.cancel();
            finalizarLeitura(true);
        }
    }, tempoMaximoSeguranca);

    window.speechSynthesis.speak(fala);
}

// ====================================================================
// 9. AUTO-ARRANQUE QUANDO O GESTOR AUTENTICAR
// ====================================================================
(function aguardarAutenticacaoGestorIA() {
    const timerArranque = setInterval(() => {
        if (typeof isGestorLogado !== 'undefined' && isGestorLogado === true) {
            clearInterval(timerArranque);
            inicializarUIConciergeGestor();
        }
    }, 300);
})();