"use strict";

/**
 * ========================================================
 * 🏆 MÓDULO RANKING SAAS - SORTEIO POR POTES (ATP/ITF)
 * Arquivo dedicado para a experiência lúdica do Globo,
 * animações, efeitos sonoros e gravação de chaves por Potes.
 * ========================================================
 */

// ========================================================
// BLOCO 1: VARIÁVEIS DE MEMÓRIA E ESTADO DO SORTEIO
// ========================================================
let sorteioPotesGlobal = {
    temporadaId: null,
    inscritos: {},
    potesData: [],
    drawSequence: [],
    gruposResultado: {},
    currentIndex: 0,
    autoTimer: null,
    isFastMode: false,
    torneioNome: "TORNEIO"
};

// ========================================================
// BLOCO 2: INJEÇÃO DINÂMICA DO MODAL E CSS NO DOM (RESPONSIVO MOBILE)
// ========================================================
function garantirModalSorteioNoDOMSaaS() {
    if (document.getElementById('modal-sorteio-potes')) return;

    const modalHTML = `
    <style id="style-sorteio-potes-anim">
        /* MINIBOLAS DE TÊNIS DENTRO DO GLOBO */
        .f-ball-potes {
            position: absolute;
            width: 22px;
            height: 22px;
            border-radius: 50%;
            background: radial-gradient(circle at 35% 35%, #e6ff33 0%, #b3e600 60%, #668800 100%);
            box-shadow: inset -2px -2px 4px rgba(0,0,0,0.5), 0 0 8px rgba(204, 255, 0, 0.5);
            overflow: hidden;
        }

        .f-ball-potes::before, .f-ball-potes::after {
            content: '';
            position: absolute;
            width: 100%;
            height: 100%;
            border: 1.5px solid #FFFFFF;
            border-radius: 50%;
            opacity: 0.65;
            pointer-events: none;
        }
        .f-ball-potes::before { top: -50%; left: -50%; }
        .f-ball-potes::after { bottom: -50%; right: -50%; }

        /* TURBULÊNCIA DE AR PARA AS MINIBOLAS */
        @keyframes floatOrbit1 {
            0%, 100% { transform: translate(15px, 130px) rotate(0deg); }
            33% { transform: translate(150px, 25px) rotate(120deg); }
            66% { transform: translate(90px, 160px) rotate(240deg); }
        }
        @keyframes floatOrbit2 {
            0%, 100% { transform: translate(160px, 70px) rotate(0deg); }
            50% { transform: translate(25px, 140px) rotate(180deg); }
        }
        @keyframes floatOrbit3 {
            0%, 100% { transform: translate(70px, 20px) rotate(0deg); }
            50% { transform: translate(140px, 140px) rotate(-180deg); }
        }

        .fb-1 { animation: floatOrbit1 2.2s infinite ease-in-out; }
        .fb-2 { animation: floatOrbit2 1.8s infinite ease-in-out; }
        .fb-3 { animation: floatOrbit3 2.5s infinite ease-in-out; }
        .fb-4 { animation: floatOrbit1 2.0s infinite ease-in-out reverse; }
        .fb-5 { animation: floatOrbit2 2.3s infinite ease-in-out reverse; }
        .fb-6 { animation: floatOrbit3 2.1s infinite ease-in-out reverse; }

        .globe-wrapper.fast-spinning .f-ball-potes {
            animation: fastOrbitPotes 0.3s infinite linear !important;
        }

        @keyframes fastOrbitPotes {
            0% { transform: rotate(0deg) translate(50px) rotate(0deg); }
            100% { transform: rotate(360deg) translate(50px) rotate(-360deg); }
        }

        /* BOLA PRINCIPAL COM O EFEITO DE TÊNIS E GIRO 360 (POP) */
        .tennis-ball-potes {
            width: 125px;
            height: 125px;
            border-radius: 50%;
            background: radial-gradient(circle at 35% 30%, #f7ff66 0%, #CCFF00 60%, #99cc00 100%);
            box-shadow: inset -8px -8px 18px rgba(0,0,0,0.35), 0 8px 22px rgba(0,0,0,0.6);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            color: #000;
            padding: 10px;
            position: relative;
            z-index: 2;
            box-sizing: border-box;
            transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        .tennis-ball-potes::before, .tennis-ball-potes::after {
            content: '';
            position: absolute;
            width: 100%;
            height: 100%;
            border: 2.5px solid #FFFFFF;
            border-radius: 50%;
            opacity: 0.65;
            pointer-events: none;
        }
        .tennis-ball-potes::before { top: -50%; left: -50%; }
        .tennis-ball-potes::after { bottom: -50%; right: -50%; }

        .tennis-ball-potes.tennis-ball-pop {
            transform: scale(1.12) rotate(360deg) !important;
        }

        /* AJUSTES EXCLUSIVOS PARA DISPOSITIVOS MÓVEIS */
        @media (max-width: 480px) {
            .modal-card-sorteio {
                padding: 20px 16px 24px 16px !important;
                max-height: 92vh !important;
                overflow-y: auto !important;
                border-radius: 20px !important;
            }
            .modal-title-header {
                font-size: 28px !important;
            }
            .globe-wrapper {
                width: 190px !important;
                height: 190px !important;
                margin-bottom: 16px !important;
            }
            .tennis-ball-potes {
                width: 105px !important;
                height: 105px !important;
            }
            .ball-player-name {
                font-size: 13px !important;
            }
            .btn-close-modal {
                top: 10px !important;
                right: 12px !important;
                padding: 10px !important;
                font-size: 24px !important;
            }
        }
    </style>

    <div id="modal-sorteio-potes" class="modal-overlay hidden" style="display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.88); backdrop-filter: blur(8px); justify-content: center; align-items: center; z-index: 10000; padding: 16px;">
        <div class="modal-card-sorteio" style="background: #0F172A; border: 1px solid #334155; border-radius: 24px; width: 100%; max-width: 520px; padding: 28px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.7); display: flex; flex-direction: column; align-items: center; text-align: center; color: #FFF; position: relative; box-sizing: border-box;">
            
            <!-- Botão Fechar (X) -->
            <button class="btn-close-modal" onclick="SorteioPotes.fecharModalSorteioSaaS()" title="Fechar" style="position: absolute; top: 16px; right: 18px; background: transparent; border: none; color: #94A3B8; font-size: 22px; font-weight: 700; cursor: pointer; line-height: 1; padding: 8px; z-index: 10;">✕</button>

            <!-- Título com Nome do Torneio -->
            <div class="modal-title-header" id="modalTournamentTitlePotes" style="font-family: 'Teko', sans-serif, 'Inter'; font-size: 36px; color: #CCFF00; letter-spacing: 1px; margin-bottom: 4px; text-transform: uppercase; word-break: break-word; max-width: 90%;">
                ATP FINALS 2009
            </div>
            
            <!-- Micro-Card de Resumo -->
            <div class="micro-card-info" id="modalMicroCardInfo" style="background: #1E293B; border: 1px solid #334155; padding: 6px 16px; border-radius: 20px; font-size: 13px; font-weight: 700; color: #38BDF8; margin-bottom: 20px;">
                0 Atletas Confirmados • 0 Potes
            </div>

            <!-- Globo de Sorteio com Bolinhas Orbitando -->
            <div class="globe-wrapper" id="globeWrapperPotes" style="width: 230px; height: 230px; border-radius: 50%; background: radial-gradient(circle at 30% 30%, rgba(204,255,0,0.18), rgba(15,23,42,0.95)); border: 3px solid rgba(204, 255, 0, 0.4); box-shadow: inset 0 0 30px rgba(204,255,0,0.2), 0 0 25px rgba(0,0,0,0.6); display: flex; justify-content: center; align-items: center; margin-bottom: 20px; position: relative; overflow: hidden; flex-shrink: 0;">
                <div class="floating-balls" style="position: absolute; width: 100%; height: 100%; pointer-events: none;">
                    <div class="f-ball-potes fb-1"></div>
                    <div class="f-ball-potes fb-2"></div>
                    <div class="f-ball-potes fb-3"></div>
                    <div class="f-ball-potes fb-4"></div>
                    <div class="f-ball-potes fb-5"></div>
                    <div class="f-ball-potes fb-6"></div>
                </div>

                <div class="tennis-ball-potes" id="ballAnimPotes">
                    <span class="ball-seed-badge" id="ballSeedPotes" style="font-size: 11px; font-weight: 800; background: #000; color: #FFF; padding: 2px 8px; border-radius: 8px; margin-bottom: 3px; z-index: 3;">AGUARDE</span>
                    <span class="ball-player-name" id="ballPlayerPotes" style="font-size: 15px; font-weight: 800; text-transform: uppercase; line-height: 1.1; z-index: 3;">INICIANDO...</span>
                </div>
            </div>

            <!-- Caixa de Status e Progresso -->
            <div class="draw-status-box" style="background: #1E293B; border-radius: 12px; width: 100%; padding: 12px 16px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; font-size: 13px; box-sizing: border-box; border: 1px solid #334155;">
                <span id="statusTextPotes" style="font-weight:700; color: #CCFF00;">Sorteando Pote 1...</span>
                <span id="progressTextPotes" style="color:#94A3B8; font-weight:600;">0/0 Concluídos</span>
            </div>

            <!-- Ações do Modal -->
            <div class="modal-actions" style="width: 100%; display: flex; flex-direction: column; gap: 10px;">
                <button class="btn-fast-forward" id="btnFastForwardPotes" onclick="SorteioPotes.sortearTudoRapidoSaaS()" style="background: transparent; border: 1px solid #475569; color: #94A3B8; padding: 12px; border-radius: 10px; font-size: 14px; font-weight: 700; cursor: pointer; transition: all 0.2s;">
                    ⚡ Sortear Tudo (Rápido)
                </button>

                <button class="btn-finish-go hidden" id="btnFinishGoPotes" onclick="SorteioPotes.irParaCentralRankingSaaS()" style="display: none; background: #10B981; color: #FFF; border: none; padding: 16px; border-radius: 12px; font-size: 16px; font-weight: 800; text-transform: uppercase; cursor: pointer; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.4); transition: all 0.2s; justify-content: center; align-items: center; gap: 8px;">
                    🏆 Ver Tabela na Central do Ranking
                </button>
            </div>
        </div>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML); 
}

// ========================================================
// BLOCO 3: ALGORITMO DO SORTEIO POR POTES (PADRÃO ATP/ITF)
// ========================================================
function prepararDadosEPotesSaaS(inscritosCatMap, tamanhoGrupoConfig = 4) {
    const ids = Object.keys(inscritosCatMap || {});
    if (ids.length === 0) return { potes: [], sequencia: [] };

    // Ordenação do Seed pelo Ranking/Mestre anterior ou ordem de inscrição
    ids.sort((a, b) => {
        const dataA = inscritosCatMap[a]?.dataAceite || 0;
        const dataB = inscritosCatMap[b]?.dataAceite || 0;
        return dataA - dataB;
    });

    const totalAtletas = ids.length;
    const numGrupos = Math.ceil(totalAtletas / tamanhoGrupoConfig);

    // Divisão em Potes (Pote 1 a Pote N)
    const potes = [];
    for (let i = 0; i < totalAtletas; i += numGrupos) {
        const fatia = ids.slice(i, i + numGrupos);
        potes.push({
            poteNum: potes.length + 1,
            atletas: fatia
        });
    }

    // Sequência de Sorteio Randomizada respeitando 1 jogador por pote por grupo
    const sequenciaSorteio = [];
    const gruposMapeados = {};
    for (let g = 1; g <= numGrupos; g++) {
        gruposMapeados[`GRUPO_${g}`] = [];
    }

    potes.forEach((poteObj, pIdx) => {
        let poolPote = [...poteObj.atletas];
        const numPote = pIdx + 1;

        // Distribuição Sorteada
        for (let g = 1; g <= numGrupos; g++) {
            if (poolPote.length === 0) break;

            const rIdx = Math.floor(Math.random() * poolPote.length);
            const atletaId = poolPote.splice(rIdx, 1)[0];
            const atletaObj = (typeof jogadoresGlobal !== 'undefined' && jogadoresGlobal[atletaId]) ? jogadoresGlobal[atletaId] : {};
            const nomeAtleta = atletaObj.apelido || atletaObj.nomeCompleto || "Atleta";

            const itemSorteio = {
                idAtleta: atletaId,
                nomeAtleta: nomeAtleta,
                seedNum: (ids.indexOf(atletaId) + 1),
                poteNum: numPote,
                grupoDestino: `GRUPO_${g}`
            };

            sequenciaSorteio.push(itemSorteio);
            gruposMapeados[`GRUPO_${g}`].push(atletaId);
        }
    });

    return {
        potes: potes,
        sequencia: sequenciaSorteio,
        gruposMapeados: gruposMapeados
    };
}

// ========================================================
// BLOCO 4: MOTOR DE ANIMAÇÃO E SOM (WEB AUDIO API)
// ========================================================
function playBounceSoundPotes() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(320, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(90, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
    } catch (e) {}
}

function runAutoDrawStepSaaS() {
    const s = sorteioPotesGlobal;
    if (s.currentIndex >= s.drawSequence.length) {
        SorteioPotes.concluirSorteioSaaS();
        return;
    }

    const item = s.drawSequence[s.currentIndex];
    playBounceSoundPotes();

    const ball = document.getElementById('ballAnimPotes');
    if (ball) {
        ball.classList.add('tennis-ball-pop');
        setTimeout(() => ball.classList.remove('tennis-ball-pop'), 400);
    }

    const elSeed = document.getElementById('ballSeedPotes');
    const elPlayer = document.getElementById('ballPlayerPotes');
    const elStatus = document.getElementById('statusTextPotes');
    const elProgress = document.getElementById('progressTextPotes');

    if (elSeed) {
        elSeed.style.display = 'inline-block';
        elSeed.innerText = `Cabeça ${item.seedNum} (Pote ${item.poteNum})`;
    }
    if (elPlayer) elPlayer.innerText = item.nomeAtleta;
    if (elStatus) elStatus.innerText = `Alocado no ${item.grupoDestino.replace('_', ' ')}`;

    s.currentIndex++;
    if (elProgress) elProgress.innerText = `${s.currentIndex}/${s.drawSequence.length} Concluídos`;

    if (s.currentIndex >= s.drawSequence.length) {
        SorteioPotes.concluirSorteioSaaS();
    }
}

// ========================================================
// BLOCO 5: CONTROLE DA INTERFACE E PROTEÇÃO AO FECHAR (X)
// ========================================================
window.SorteioPotes = {

    abrirModalSorteioSaaS: function (nomeTorneio, inscritosCatMap, tamanhoGrupoConfig = 4, callbackConclusao) {
        garantirModalSorteioNoDOMSaaS();

        const preparo = prepararDadosEPotesSaaS(inscritosCatMap, tamanhoGrupoConfig);

        sorteioPotesGlobal = {
            inscritos: inscritosCatMap,
            potesData: preparo.potes,
            drawSequence: preparo.sequencia,
            gruposResultado: preparo.gruposMapeados,
            currentIndex: 0,
            autoTimer: null,
            isFastMode: false,
            torneioNome: nomeTorneio || "ATP FINALS 2009",
            callbackConclusao: callbackConclusao
        };

        const modal = document.getElementById('modal-sorteio-potes');
        const elTitle = document.getElementById('modalTournamentTitlePotes');
        const elMicro = document.getElementById('modalMicroCardInfo');
        const btnFast = document.getElementById('btnFastForwardPotes');
        const btnFinish = document.getElementById('btnFinishGoPotes');
        const globe = document.getElementById('globeWrapperPotes');

        if (elTitle) elTitle.innerText = sorteioPotesGlobal.torneioNome;
        if (elMicro) elMicro.innerText = `${preparo.sequencia.length} Atletas Confirmados • ${preparo.potes.length} Potes`;
        if (btnFast) btnFast.style.display = 'block';
        if (btnFinish) btnFinish.style.display = 'none';
        if (globe) globe.classList.remove('fast-spinning');

        const elSeed = document.getElementById('ballSeedPotes');
        const elPlayer = document.getElementById('ballPlayerPotes');
        if (elSeed) {
            elSeed.style.display = 'inline-block';
            elSeed.innerText = 'AGUARDE';
        }
        if (elPlayer) elPlayer.innerText = 'INICIANDO...';

        if (modal) modal.style.display = 'flex';

        runAutoDrawStepSaaS();
        sorteioPotesGlobal.autoTimer = setInterval(runAutoDrawStepSaaS, 1000);
    },

    sortearTudoRapidoSaaS: function () {
        const s = sorteioPotesGlobal;
        if (s.isFastMode) return;
        s.isFastMode = true;

        if (s.autoTimer) clearInterval(s.autoTimer);

        const globe = document.getElementById('globeWrapperPotes');
        const elStatus = document.getElementById('statusTextPotes');

        if (globe) globe.classList.add('fast-spinning');
        if (elStatus) elStatus.innerText = "Acelerando Globo de Sorteio...";
        playBounceSoundPotes();

        setTimeout(() => {
            s.currentIndex = s.drawSequence.length;
            if (globe) globe.classList.remove('fast-spinning');
            SorteioPotes.concluirSorteioSaaS();
        }, 1500);
    },

    concluirSorteioSaaS: function () {
        const s = sorteioPotesGlobal;
        if (s.autoTimer) clearInterval(s.autoTimer);

        const elStatus = document.getElementById('statusTextPotes');
        const elProgress = document.getElementById('progressTextPotes');
        const elSeed = document.getElementById('ballSeedPotes');
        const elPlayer = document.getElementById('ballPlayerPotes');
        const btnFast = document.getElementById('btnFastForwardPotes');
        const btnFinish = document.getElementById('btnFinishGoPotes');

        if (elStatus) elStatus.innerText = "✅ Sorteio Finalizado com Sucesso!";
        if (elProgress) elProgress.innerText = `${s.drawSequence.length}/${s.drawSequence.length} Concluídos`;

        // Deixa a bola lisa (amarela sem textos/badges)
        if (elSeed) {
            elSeed.innerText = "";
            elSeed.style.display = "none";
        }
        if (elPlayer) elPlayer.innerText = "";

        if (btnFast) btnFast.style.display = 'none';
        if (btnFinish) btnFinish.style.display = 'flex';

        // Gravação dos Grupos no Banco de Dados
        if (typeof s.callbackConclusao === 'function') {
            s.callbackConclusao(s.gruposResultado);
        }
    },

    fecharModalSorteioSaaS: function () {
        const s = sorteioPotesGlobal;

        // PROTEÇÃO: Se o sorteio estiver rodando no meio
        if (s.drawSequence.length > 0 && s.currentIndex < s.drawSequence.length) {
            if (s.autoTimer) clearInterval(s.autoTimer);

            const htmlPrompt = `
                <div style="text-align: left; font-size: 14px; color: #334155; line-height: 1.5;">
                    <p style="margin: 0 0 10px 0;">⚠️ <b>O sorteio ainda não foi concluído!</b></p>
                    <p style="margin: 0 0 10px 0; font-size: 13px; color: #64748b;">
                        Se fechar agora, as chaves não serão salvas e o torneio continuará com as inscrições abertas.
                    </p>
                    <p style="margin: 0; font-size: 13px; color: #1e293b; font-weight: 700;">
                        Deseja interromper e cancelar este sorteio?
                    </p>
                </div>
            `;

            const restaurarBotoesGlobaiss = () => {
                const bConfirm = document.getElementById('btnPromptConfirm');
                const bCancel = document.getElementById('btnPromptCancel');
                if (bConfirm) bConfirm.textContent = "Confirmar";
                if (bCancel) bCancel.textContent = "Cancelar";
            };

            showPrompt("Interromper Sorteio", htmlPrompt, () => {
                if (s.autoTimer) clearInterval(s.autoTimer);
                s.currentIndex = 0;
                s.drawSequence = [];
                restaurarBotoesGlobaiss();

                const modal = document.getElementById('modal-sorteio-potes');
                if (modal) modal.style.display = 'none';
                showToast("Sorteio interrompido. Inscrições permanecem na Fase 2.", "info");
            });

            const btnConfirm = document.getElementById('btnPromptConfirm');
            const btnCancel = document.getElementById('btnPromptCancel');

            if (btnConfirm) btnConfirm.textContent = "Cancelar Sorteio";
            if (btnCancel) {
                btnCancel.textContent = "Voltar ao Sorteio";
                btnCancel.onclick = () => {
                    const modalPrompt = document.getElementById('modalPrompt');
                    if (modalPrompt) modalPrompt.style.display = 'none';
                    
                    restaurarBotoesGlobaiss();
                    s.autoTimer = setInterval(runAutoDrawStepSaaS, 1000);
                };
            }

            return;
        }

        if (s.autoTimer) clearInterval(s.autoTimer);
        const modal = document.getElementById('modal-sorteio-potes');
        if (modal) modal.style.display = 'none';
    },

    irParaCentralRankingSaaS: function () {
        SorteioPotes.fecharModalSorteioSaaS();
        if (typeof abrirLeaderboardSaaS === 'function') {
            abrirLeaderboardSaaS();
        }
    }
};
