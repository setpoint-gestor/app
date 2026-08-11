"use strict";

/**
 * ========================================================
 * 🏆 MÓDULO RANKING SAAS - MOTOR DE SÚMULAS E VALIDAÇÕES
 * Arquivo exclusivo para a lógica do Árbitro Invisível.
 * ========================================================
 */

// Memória local para a reserva que está sendo analisada no momento
let partidaRankingEmFoco = null;
let regrasSessaoRanking = null; // Guardará o configRegrasGlobal.ranking.sumula

/**
 * ========================================================
 * 1. GATILHO DA SÚMULA: REGRAS DE VISIBILIDADE E ESTADOS
 * ========================================================
 */
function configurarGatilhoSumulaRanking(reserva) {
    const btnGatilho = document.getElementById('btn-saas-gatilho-placar');
    if (!btnGatilho) return;

    const ehRanking = (reserva.tipo === 'ranking' || reserva.isRanking === true || reserva.isRanking === 'true');

    if (!ehRanking || !verificarAcessoSocioRanking(reserva)) {
        btnGatilho.style.display = 'none';
        return;
    }

    btnGatilho.style.display = 'flex';
    const spanTexto = btnGatilho.querySelector('span');
    const icone = btnGatilho.querySelector('i');

    const horaInicioPartida = converterDataHoraParaTimestamp(reserva.dataCompleta, reserva.hora);
    const horaAtual = new Date().getTime();

    if (horaAtual < horaInicioPartida) {
        btnGatilho.classList.add('btn-bloqueado');
        if (spanTexto) spanTexto.textContent = "Placar Bloqueado";
        if (icone) icone.textContent = "lock";
        btnGatilho.onclick = () => showToast("O placar só destrava no horário do jogo.", "warning");
        return;
    }

    btnGatilho.classList.remove('btn-bloqueado');

    const statusPlacar = reserva.statusPlacar || 'sem_placar';
    const nomeLogado = (localStorage.getItem('jogadorLogadoNome') || '').trim().toUpperCase();
    const autorSumula = (reserva.dadosPlacar && reserva.dadosPlacar.autorSumula) ? reserva.dadosPlacar.autorSumula.trim().toUpperCase() : "";
    
    const souOAutor = (nomeLogado === autorSumula);

    if (spanTexto) {
        if (statusPlacar === 'consolidado') {
            spanTexto.textContent = "Ver Placar";
        } else if (statusPlacar === 'pendente_validacao') {
            spanTexto.textContent = souOAutor ? "Editar Placar" : "Validar Placar";
        } else if (statusPlacar === 'contestado') {
            spanTexto.textContent = "Placar Contestado";
        } else {
            spanTexto.textContent = "Lançar Placar";
        }
    }

    if (icone) {
        if (statusPlacar === 'consolidado') {
            icone.textContent = "visibility";
        } else if (statusPlacar === 'pendente_validacao') {
            icone.textContent = souOAutor ? "edit" : "fact_check";
        } else if (statusPlacar === 'contestado') {
            icone.textContent = "gavel";
        } else {
            icone.textContent = "emoji_events";
        }
    }

    btnGatilho.onclick = (e) => {
        if (statusPlacar === 'pendente_validacao' && !souOAutor) {
            abrirModalValidacaoAdversario(reserva);
        } else {
            abrirModalSumulaPrincipal(reserva, statusPlacar === 'consolidado');
        }
    };
}



/**
 * Função Auxiliar: Converte Data (YYYY-MM-DD) e Hora Inteira do sistema em Timestamp real
 */
function converterDataHoraParaTimestamp(dataYMD, horaInteira) {
    if (!dataYMD || horaInteira === undefined) return 0;
    
    // Divide YYYY-MM-DD
    const partesData = dataYMD.split('-'); 
    if (partesData.length !== 3) return 0;
    
    // Meses no JS vão de 0 a 11
    const dataIso = new Date(partesData[0], partesData[1] - 1, partesData[2], horaInteira, 0, 0);
    return dataIso.getTime();
}

function verificarAcessoSocioRanking(reserva) {
    if (typeof isGestorLogado !== 'undefined' && isGestorLogado) return true;
    
    const nomeLogado = (localStorage.getItem('jogadorLogadoNome') || '').trim().toUpperCase();
    if (!nomeLogado || !reserva) return false; 

    const jogadoresCompleto = (reserva.jogadores_completo || '').toUpperCase();
    const jogadoresApelidos = (reserva.jogadores || '').toUpperCase();
    const organizador = (reserva.organizador || '').toUpperCase();

    // Libera o acesso se o atleta estiver em qualquer um dos campos do banco
    return (
        jogadoresCompleto.includes(nomeLogado) ||
        jogadoresApelidos.includes(nomeLogado) ||
        organizador.includes(nomeLogado)
    );
}


/* ======================================================== */
/* AUXILIARES DE FORMATAÇÃO INTELIGENTE DE NOMES             */
/* ======================================================== */
function capitalizarNome(nome) {
    if (!nome) return "";
    return nome.split(' ')
               .filter(p => p.trim().length > 0)
               .map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
               .join(' ');
}

function buscarInfoJogador(apelidoOuNome) {
    if (!apelidoOuNome) return { nomeCompleto: "", apelido: "" };
    const termo = apelidoOuNome.trim().toLowerCase();

    if (typeof jogadoresData !== 'undefined' && jogadoresData) {
        // Busca na lista de valores do objeto leituras do Firebase
        const lista = Object.values(jogadoresData);
        const encontrado = lista.find(j => {
            if (!j) return false;
            const ap = (j.apelido || '').trim().toLowerCase();
            const nc = (j.nomeCompleto || '').trim().toLowerCase();
            return ap === termo || nc === termo;
        });

        if (encontrado) {
            return {
                nomeCompleto: encontrado.nomeCompleto || apelidoOuNome,
                apelido: encontrado.apelido || apelidoOuNome
            };
        }

        // Busca por chave direta
        const chaveEncontrada = Object.keys(jogadoresData).find(
            k => k.trim().toLowerCase() === termo
        );
        if (chaveEncontrada && jogadoresData[chaveEncontrada]) {
            return {
                nomeCompleto: jogadoresData[chaveEncontrada].nomeCompleto || chaveEncontrada,
                apelido: jogadoresData[chaveEncontrada].apelido || chaveEncontrada
            };
        }
    }

    return { nomeCompleto: apelidoOuNome, apelido: apelidoOuNome };
}

function formatarNomeInteligente(nomeCompletoRaw, apelidoRaw, isHorizontal = true) {
    if (!nomeCompletoRaw && !apelidoRaw) return "";
    const nomeCompleto = capitalizarNome(nomeCompletoRaw || apelidoRaw);
    const apelido = capitalizarNome(apelidoRaw);

    if (!isHorizontal) return apelido;

    const apelidoWords = apelido.split(' ').filter(w => w.trim().length > 0);
    const todasPalavrasPresentes = apelidoWords.length > 0 && apelidoWords.every(word => 
        nomeCompleto.toLowerCase().includes(word.toLowerCase())
    );

    if (todasPalavrasPresentes) {
        // Apelido contido no nome: destaca apenas as palavras do apelido em negrito
        let nomeFinal = nomeCompleto;
        apelidoWords.forEach(word => {
            const regex = new RegExp(`\\b${word}\\b`, 'gi');
            nomeFinal = nomeFinal.replace(regex, '<b>$&</b>');
        });
        return nomeFinal;
    } else {
        // Apelido diferente: Nome Completo (Apelido em negrito)
        return `${nomeCompleto} (<b>${apelido}</b>)`;
    }
}

/* ======================================================== */
/* AUXILIAR: LIMPEZA DE CAMPOS DA SÚMULA                   */
/* ======================================================== */
function limparCamposSumulaRanking() {
    const modalSumula = document.getElementById('modal-sumula-ranking');
    if (!modalSumula) return;

    // 1. Zera todos os inputs numéricos
    const inputs = modalSumula.querySelectorAll('input[type="number"]');
    inputs.forEach(input => {
        input.value = '';
    });

    // 2. Esconde minicampos de tie-break
    ['inp-tb1-j1', 'inp-tb1-j2', 'inp-tb2-j1', 'inp-tb2-j2'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    // 3. Esconde a coluna do 3º Set
    ['head-set-3', 'wrap-s3-j1', 'wrap-s3-j2'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    // 4. Reseta a declaração de Vencedor e trava o botão Salvar
    const txtVencedor = document.getElementById('label-vencedor-sumula');
    if (txtVencedor) txtVencedor.textContent = '--';

    const btnSalvar = document.getElementById('btn-salvar-sumula-saas');
    if (btnSalvar) btnSalvar.disabled = true;
}

/* ======================================================== */
/* 2. O ECOSSISTEMA DE TELAS (ABERTURA E UI DINÂMICA)       */
/* ======================================================== */
function abrirModalSumulaPrincipal(reserva, modoLeitura) {
    // Limpa qualquer resquício de digitação anterior antes de carregar a tela
    limparCamposSumulaRanking();

    partidaRankingEmFoco = reserva;
    regrasSessaoRanking = (configRegrasGlobal && configRegrasGlobal.ranking && configRegrasGlobal.ranking.sumula) 
                          ? configRegrasGlobal.ranking.sumula 
                          : { formatoPartida: "melhor_3_sets", decisaoTerceiroSet: "super_tiebreak" };

    // 1. Fecha a gaveta de opções da reserva
    if (typeof fecharMenuAcoesReservaSaaS === 'function') {
        fecharMenuAcoesReservaSaaS();
    }

    // 2. Extrai apelidos e nomes completos
    const partesApelidos = (reserva.jogadores || '').split(', ');
    const partesCompleto = (reserva.jogadores_completo || '').split(', ');

    const apelidoJ1 = partesApelidos[0] || "Desafiante";
    const apelidoJ2 = partesApelidos[1] || "Desafiado";

    let nomeCompletoJ1 = partesCompleto[0] || "";
    let nomeCompletoJ2 = partesCompleto[1] || "";

    if (!nomeCompletoJ1 || nomeCompletoJ1.trim().toLowerCase() === apelidoJ1.trim().toLowerCase()) {
        const info = buscarInfoJogador(apelidoJ1);
        if (info.nomeCompleto) nomeCompletoJ1 = info.nomeCompleto;
    }
    if (!nomeCompletoJ2 || nomeCompletoJ2.trim().toLowerCase() === apelidoJ2.trim().toLowerCase()) {
        const info = buscarInfoJogador(apelidoJ2);
        if (info.nomeCompleto) nomeCompletoJ2 = info.nomeCompleto;
    }

    // 3. Renderiza com a formatação inteligente
    const elJ1 = document.getElementById('sumula-nome-j1');
    const elJ2 = document.getElementById('sumula-nome-j2');

    if (elJ1) elJ1.innerHTML = formatarNomeInteligente(nomeCompletoJ1, apelidoJ1, true);
    if (elJ2) elJ2.innerHTML = formatarNomeInteligente(nomeCompletoJ2, apelidoJ2, true);

    // 4. Subtítulo do Modelo
    const modeloAtivo = (configRegrasGlobal && configRegrasGlobal.ranking && configRegrasGlobal.ranking.modeloAtivo) || "piramide";
    const nomesModelos = { piramide: "Pirâmide", barragem: "Barragem", grupos: "Grupos" };
    const elModelo = document.getElementById('sumula-txt-modelo');
    if (elModelo) elModelo.textContent = `Ranking do tipo ${nomesModelos[modeloAtivo] || "Oficial"}`;

    // 5. Adapta a colunagem de sets
    adaptarRenderizacaoMatematica(regrasSessaoRanking);

    // 6. Vincula o gatilho automático a todos os campos de digitação da súmula
    const modalSumula = document.getElementById('modal-sumula-ranking');
    if (modalSumula) {
        modalSumula.style.setProperty('display', 'flex', 'important');
        
        const inputsSumula = modalSumula.querySelectorAll('input');
        inputsSumula.forEach(input => {
            input.oninput = acionarArbitroInvisivelSaaS;
            input.onkeyup = acionarArbitroInvisivelSaaS;
        });
    }

    // Reseta veredicto visual inicial
    acionarArbitroInvisivelSaaS();
}



function adaptarRenderizacaoMatematica(regras) {
    if (!regras) return;
    const formato = regras.formatoPartida || "set_unico_6";

    const headSet2 = document.getElementById('head-set-2');
    const headSet3 = document.getElementById('head-set-3');
    const wrapS2J1 = document.getElementById('wrap-s2-j1');
    const wrapS2J2 = document.getElementById('wrap-s2-j2');
    const wrapS3J1 = document.getElementById('wrap-s3-j1');
    const wrapS3J2 = document.getElementById('wrap-s3-j2');

    if (formato === "set_unico_6" || formato === "pro_set_8") {
        if (headSet2) headSet2.style.display = 'none';
        if (headSet3) headSet3.style.display = 'none';
        if (wrapS2J1) wrapS2J1.style.display = 'none';
        if (wrapS2J2) wrapS2J2.style.display = 'none';
        if (wrapS3J1) wrapS3J1.style.display = 'none';
        if (wrapS3J2) wrapS3J2.style.display = 'none';
    } else {
        if (headSet2) headSet2.style.display = 'inline-block';
        if (headSet3) headSet3.style.display = 'none';
        if (wrapS2J1) wrapS2J1.style.display = 'block';
        if (wrapS2J2) wrapS2J2.style.display = 'block';
        if (wrapS3J1) wrapS3J1.style.display = 'none';
        if (wrapS3J2) wrapS3J2.style.display = 'none';
    }
}


/* ======================================================== */
/* 3. MOTOR DE VALIDAÇÃO DINÂMICO (O ÁRBITRO INVISÍVEL)    */
/* ======================================================== */

function calcularVencedorTiebreak(p1, p2) {
    if (isNaN(p1) || isNaN(p2)) return null;
    if (p1 >= 7 && p1 - p2 >= 2) return "J1";
    if (p2 >= 7 && p2 - p1 >= 2) return "J2";
    return null;
}

function calcularVencedorSuperTiebreak(p1, p2) {
    if (isNaN(p1) || isNaN(p2)) return null;
    if (p1 >= 10 && p1 - p2 >= 2) return "J1";
    if (p2 >= 10 && p2 - p1 >= 2) return "J2";
    return null;
}

function calcularVencedorSet(gamesJ1, gamesJ2, formato, tbJ1, tbJ2) {
    if (isNaN(gamesJ1) || isNaN(gamesJ2)) return null;

    const limite = (formato === "m3_curtos_4") ? 4 : (formato === "pro_set_8" ? 8 : 6);

    // 1. Desempate via Tie-break (ex: 5x4 no curto, 7x6 no tradicional, 9x8 no pro-set)
    const isTiebreakScore = (gamesJ1 === limite && gamesJ2 === limite) || 
                            (gamesJ1 === limite + 1 && gamesJ2 === limite) || 
                            (gamesJ1 === limite && gamesJ2 === limite + 1);

    if (isTiebreakScore) {
        const winnerTb = calcularVencedorTiebreak(tbJ1, tbJ2);
        if (!winnerTb) return null;

        if (gamesJ1 === limite + 1 && gamesJ2 === limite && winnerTb !== "J1") return null;
        if (gamesJ1 === limite && gamesJ2 === limite + 1 && winnerTb !== "J2") return null;

        return winnerTb;
    }

    // 2. Vitória direta no limite do set (ex: 4x0, 4x1, 4x2 | 6x0..6x4 | 8x0..8x6)
    if (gamesJ1 === limite && gamesJ2 <= limite - 2) return "J1";
    if (gamesJ2 === limite && gamesJ1 <= limite - 2) return "J2";

    // 3. Vitória direta com 2 games de vantagem após o limite (ex: 5x3 no curto | 7x5 no tradicional | 9x7 no pro-set)
    if (gamesJ1 === limite + 1 && gamesJ2 === limite - 1) return "J1";
    if (gamesJ2 === limite + 1 && gamesJ1 === limite - 1) return "J2";

    return null; // Rejeita placares inválidos como 5x1, 5x2, 7x1, 9x1
}

// Injeção dinâmica dos minicampos de Tie-break no 3º Set se não existirem no HTML
function garantirInputsTiebreakSet3() {
    let inputTbS3J1 = document.getElementById('inp-tb3-j1');
    let inputTbS3J2 = document.getElementById('inp-tb3-j2');
    const refTb1 = document.getElementById('inp-tb1-j1');
    const refTb2 = document.getElementById('inp-tb1-j2');

    if (!inputTbS3J1 && refTb1) {
        const inpS3J1 = document.getElementById('inp-s3-j1');
        if (inpS3J1 && inpS3J1.parentNode) {
            inputTbS3J1 = refTb1.cloneNode(true);
            inputTbS3J1.id = 'inp-tb3-j1';
            inputTbS3J1.value = '';
            inputTbS3J1.style.display = 'none';
            inpS3J1.parentNode.appendChild(inputTbS3J1);
            inputTbS3J1.addEventListener('input', acionarArbitroInvisivelSaaS);
        }
    }

    if (!inputTbS3J2 && refTb2) {
        const inpS3J2 = document.getElementById('inp-s3-j2');
        if (inpS3J2 && inpS3J2.parentNode) {
            inputTbS3J2 = refTb2.cloneNode(true);
            inputTbS3J2.id = 'inp-tb3-j2';
            inputTbS3J2.value = '';
            inputTbS3J2.style.display = 'none';
            inpS3J2.parentNode.appendChild(inputTbS3J2);
            inputTbS3J2.addEventListener('input', acionarArbitroInvisivelSaaS);
        }
    }

    return { inputTbS3J1, inputTbS3J2 };
}

function acionarArbitroInvisivelSaaS() {
    if (!partidaRankingEmFoco) return;

    const formato = (regrasSessaoRanking && regrasSessaoRanking.formatoPartida) || "m3_tradicional_6";
    const decisaoTerceiroSet = (regrasSessaoRanking && regrasSessaoRanking.decisaoTerceiroSet) || "super_tiebreak";

    const limiteTb = (formato === "pro_set_8") ? 8 : (formato === "m3_curtos_4" ? 4 : 6);
    const maximoAbsoluto = limiteTb + 1;
    const isSuperTiebreak3Set = (decisaoTerceiroSet === "super_tiebreak");

    // 0. Trava Dinâmica de Entrada nos Inputs
    const camposGames = ['inp-s1-j1', 'inp-s1-j2', 'inp-s2-j1', 'inp-s2-j2'];
    if (!isSuperTiebreak3Set) {
        camposGames.push('inp-s3-j1', 'inp-s3-j2');
    }

    camposGames.forEach(id => {
        const el = document.getElementById(id);
        if (el && el === document.activeElement && el.value !== "") {
            const val = parseInt(el.value, 10);
            if (isNaN(val) || val > maximoAbsoluto) {
                el.value = '';
            }
        }
    });

    const getVal = (id) => {
        const el = document.getElementById(id);
        if (!el || el.value === "" || el.value === undefined) return NaN;
        return parseInt(el.value, 10);
    };

    // 1. Elementos DOM (incluindo garantia do 3º set)
    const inputTbS1J1 = document.getElementById('inp-tb1-j1');
    const inputTbS1J2 = document.getElementById('inp-tb1-j2');
    const inputTbS2J1 = document.getElementById('inp-tb2-j1');
    const inputTbS2J2 = document.getElementById('inp-tb2-j2');

    const { inputTbS3J1, inputTbS3J2 } = garantirInputsTiebreakSet3();

    const inputS1J1 = document.getElementById('inp-s1-j1');
    const inputS1J2 = document.getElementById('inp-s1-j2');
    const inputS2J1 = document.getElementById('inp-s2-j1');
    const inputS2J2 = document.getElementById('inp-s2-j2');
    const inputS3J1 = document.getElementById('inp-s3-j1');
    const inputS3J2 = document.getElementById('inp-s3-j2');

    const headSet3 = document.getElementById('head-set-3');
    const wrapS3J1 = document.getElementById('wrap-s3-j1');
    const wrapS3J2 = document.getElementById('wrap-s3-j2');

    const txtVencedor = document.getElementById('label-vencedor-sumula');
    const btnSalvar = document.getElementById('btn-salvar-sumula-saas');

    // Reset por Foco de Digitação
    if ((document.activeElement === inputS1J1 || document.activeElement === inputS1J2) && inputTbS1J1) {
        inputTbS1J1.value = ''; inputTbS1J2.value = '';
    }
    if ((document.activeElement === inputS2J1 || document.activeElement === inputS2J2) && inputTbS2J1) {
        inputTbS2J1.value = ''; inputTbS2J2.value = '';
    }
    if ((document.activeElement === inputS3J1 || document.activeElement === inputS3J2) && inputTbS3J1) {
        inputTbS3J1.value = ''; inputTbS3J2.value = '';
    }

    let valS1J1 = getVal('inp-s1-j1');
    let valS1J2 = getVal('inp-s1-j2');
    let valS2J1 = getVal('inp-s2-j1');
    let valS2J2 = getVal('inp-s2-j2');
    let valS3J1 = getVal('inp-s3-j1');
    let valS3J2 = getVal('inp-s3-j2');

    const ocultarEResetarSet3 = () => {
        if (headSet3) headSet3.style.display = 'none';
        if (wrapS3J1) wrapS3J1.style.display = 'none';
        if (wrapS3J2) wrapS3J2.style.display = 'none';
        if (inputS3J1) inputS3J1.value = '';
        if (inputS3J2) inputS3J2.value = '';
        if (inputTbS3J1) { inputTbS3J1.value = ''; inputTbS3J1.style.display = 'none'; }
        if (inputTbS3J2) { inputTbS3J2.value = ''; inputTbS3J2.style.display = 'none'; }
    };

    // 2. Controle de Exibição dos Tie-breaks
    const checkTbVisibility = (v1, v2, el1, el2) => {
        if (!el1 || !el2) return;
        const isValid = (!isNaN(v1) && !isNaN(v2) && 
                        ((v1 === limiteTb && v2 === limiteTb) || 
                         (v1 === limiteTb + 1 && v2 === limiteTb) || 
                         (v1 === limiteTb && v2 === limiteTb + 1)));
        if (isValid) {
            el1.style.display = 'block'; el2.style.display = 'block';
        } else {
            el1.style.display = 'none'; el2.style.display = 'none';
            el1.value = ''; el2.value = '';
        }
    };

    checkTbVisibility(valS1J1, valS1J2, inputTbS1J1, inputTbS1J2);
    checkTbVisibility(valS2J1, valS2J2, inputTbS2J1, inputTbS2J2);

    if (!isSuperTiebreak3Set) {
        checkTbVisibility(valS3J1, valS3J2, inputTbS3J1, inputTbS3J2);
    }

    const valTb1J1 = getVal('inp-tb1-j1');
    const valTb1J2 = getVal('inp-tb1-j2');
    const valTb2J1 = getVal('inp-tb2-j1');
    const valTb2J2 = getVal('inp-tb2-j2');
    const valTb3J1 = getVal('inp-tb3-j1');
    const valTb3J2 = getVal('inp-tb3-j2');

    // 3. Aplicação do Vencedor do Tie-break nos Games
    const aplicarResultadoTb = (vTb, valJ1, valJ2, inpJ1, inpJ2) => {
        if (vTb === "J1" && (valJ1 !== limiteTb + 1 || valJ2 !== limiteTb)) {
            if (inpJ1) inpJ1.value = limiteTb + 1;
            if (inpJ2) inpJ2.value = limiteTb;
        } else if (vTb === "J2" && (valJ1 !== limiteTb || valJ2 !== limiteTb + 1)) {
            if (inpJ1) inpJ1.value = limiteTb;
            if (inpJ2) inpJ2.value = limiteTb + 1;
        }
    };

    if (document.activeElement !== inputS1J1 && document.activeElement !== inputS1J2) {
        aplicarResultadoTb(calcularVencedorTiebreak(valTb1J1, valTb1J2), valS1J1, valS1J2, inputS1J1, inputS1J2);
        valS1J1 = getVal('inp-s1-j1'); valS1J2 = getVal('inp-s1-j2');
    }
    if (document.activeElement !== inputS2J1 && document.activeElement !== inputS2J2) {
        aplicarResultadoTb(calcularVencedorTiebreak(valTb2J1, valTb2J2), valS2J1, valS2J2, inputS2J1, inputS2J2);
        valS2J1 = getVal('inp-s2-j1'); valS2J2 = getVal('inp-s2-j2');
    }
    if (!isSuperTiebreak3Set && document.activeElement !== inputS3J1 && document.activeElement !== inputS3J2) {
        aplicarResultadoTb(calcularVencedorTiebreak(valTb3J1, valTb3J2), valS3J1, valS3J2, inputS3J1, inputS3J2);
        valS3J1 = getVal('inp-s3-j1'); valS3J2 = getVal('inp-s3-j2');
    }

    // 4. Avaliação de Sets e Partida
    const isMelhor3 = (formato === "m3_tradicional_6" || formato === "m3_curtos_4" || formato === "melhor_3_sets");
    const vSet1 = calcularVencedorSet(valS1J1, valS1J2, formato, valTb1J1, valTb1J2);
    let vSet2 = null;
    let vSet3 = null;
    let vencedorPartida = null;

    if (isMelhor3) {
        if (vSet1) {
            vSet2 = calcularVencedorSet(valS2J1, valS2J2, formato, valTb2J1, valTb2J2);

            if (vSet1 === vSet2) {
                vencedorPartida = vSet1;
                ocultarEResetarSet3();
            } else if (vSet2 && vSet1 !== vSet2) {
                if (headSet3) headSet3.style.display = 'inline-block';
                if (wrapS3J1) wrapS3J1.style.display = 'block';
                if (wrapS3J2) wrapS3J2.style.display = 'block';

                if (isSuperTiebreak3Set) {
                    vSet3 = calcularVencedorSuperTiebreak(valS3J1, valS3J2);
                } else {
                    vSet3 = calcularVencedorSet(valS3J1, valS3J2, formato, valTb3J1, valTb3J2);
                }
                if (vSet3) vencedorPartida = vSet3;
            } else {
                ocultarEResetarSet3();
            }
        } else {
            ocultarEResetarSet3();
        }
    } else {
        vencedorPartida = vSet1;
        ocultarEResetarSet3();
    }

    // 5. Atualização da Interface
    const partesJogadores = (partidaRankingEmFoco.jogadores || '').split(', ');
    const infoJ1 = buscarInfoJogador(partesJogadores[0] || "");
    const infoJ2 = buscarInfoJogador(partesJogadores[1] || "");

    if (vencedorPartida) {
        const nomeVencedor = (vencedorPartida === "J1") 
            ? (infoJ1.nomeCompleto || partesJogadores[0]) 
            : (infoJ2.nomeCompleto || partesJogadores[1]);
            
        if (txtVencedor) txtVencedor.textContent = capitalizarNome(nomeVencedor);
        if (btnSalvar) btnSalvar.disabled = false;
    } else {
        if (txtVencedor) txtVencedor.textContent = "--";
        if (btnSalvar) btnSalvar.disabled = true;
    }
}


/* ======================================================== */
/* 4. AÇÕES DA CONFIRMAÇÃO E DO ÁRBITRO                    */
/* ======================================================== */
let intervaloTimerValidacao = null;

function abrirModalValidacaoAdversario(reserva) {
    if (!reserva || !reserva.dadosPlacar) return;

    partidaRankingEmFoco = reserva;

    if (typeof fecharMenuAcoesReservaSaaS === 'function') {
        fecharMenuAcoesReservaSaaS();
    }

    const dados = reserva.dadosPlacar;
    
    // 1. Extração dos Nomes
    const partesJogadores = (reserva.jogadores || '').split(', ');
    const infoJ1 = buscarInfoJogador(partesJogadores[0] || "");
    const infoJ2 = buscarInfoJogador(partesJogadores[1] || "");

    const nomeJ1 = capitalizarNome(infoJ1.nomeCompleto || partesJogadores[0]);
    const nomeJ2 = capitalizarNome(infoJ2.nomeCompleto || partesJogadores[1]);

    const nomeVencedor = capitalizarNome(dados.vencedor || "");
    const nomePerdedor = (nomeVencedor.toLowerCase() === nomeJ1.toLowerCase()) ? nomeJ2 : nomeJ1;

    // 2. Formatação das Informações
    const diasSemana = ["", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
    const nomeDia = diasSemana[reserva.dia] || "Dia";
    const duracao = parseInt(reserva.duracao) || 1;
    const hInicio = String(reserva.hora).padStart(2, '0') + ":00";
    const hFim = String(reserva.hora + duracao).padStart(2, '0') + ":00";

    const modeloAtivo = (configRegrasGlobal && configRegrasGlobal.ranking && configRegrasGlobal.ranking.modeloAtivo) || "piramide";
    const nomesModelos = { piramide: "Pirâmide", barragem: "Barragem", grupos: "Grupos" };
    const nomeQuadra = quadraSelecionadaSaaS || "Quadra";

    // 3. Preenchimento no HTML oficial (setpoint-gestor.html)
    const elDataHora = document.getElementById('val-txt-data-horario');
    const elQuadraModelo = document.getElementById('val-txt-quadra-modelo');
    const elVencedor = document.getElementById('val-txt-vencedor');
    const elPerdedor = document.getElementById('val-txt-perdedor');
    const elPlacar = document.getElementById('val-txt-placar');

    if (elDataHora) elDataHora.textContent = `${nomeDia} • ${hInicio} - ${hFim}`;
    if (elQuadraModelo) elQuadraModelo.textContent = `${nomeQuadra} • Ranking ${nomesModelos[modeloAtivo] || "Oficial"}`;
    if (elVencedor) elVencedor.textContent = nomeVencedor;
    if (elPerdedor) elPerdedor.textContent = nomePerdedor;
    if (elPlacar) elPlacar.textContent = dados.placarFormatado || "--";

    // 4. Disparo do Cronômetro de 24h
    iniciarRelogioValidacaoSaaS(dados.expiraValidacaoAt);

    // 5. Exibição da Gaveta
    const modalVal = document.getElementById('modal-validacao-placar');
    if (modalVal) {
        modalVal.style.display = 'flex';
    }
}

function iniciarRelogioValidacaoSaaS(expiraEm) {
    if (intervaloTimerValidacao) clearInterval(intervaloTimerValidacao);

    const elTimer = document.getElementById('val-timer-countdown');
    if (!elTimer || !expiraEm) return;

    const atualizar = () => {
        const agora = Date.now();
        const diff = expiraEm - agora;

        if (diff <= 0) {
            elTimer.textContent = "Expirado";
            clearInterval(intervaloTimerValidacao);
        } else {
            const horas = Math.floor(diff / (1000 * 60 * 60));
            const minutos = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const segundos = Math.floor((diff % (1000 * 60)) / 1000);
            elTimer.textContent = `${String(horas).padStart(2, '0')}h ${String(minutos).padStart(2, '0')}m ${String(segundos).padStart(2, '0')}s`;
        }
    };

    atualizar();
    intervaloTimerValidacao = setInterval(atualizar, 1000);
}

function confirmarPlacarAdversarioSaaS() {
    if (!partidaRankingEmFoco || !raizBanco) return;

    let quadraKey = "Quadra - 1";
    if (partidaRankingEmFoco.quadra) {
        const match = partidaRankingEmFoco.quadra.match(/\d+/);
        quadraKey = match ? `Quadra - ${match[0]}` : partidaRankingEmFoco.quadra;
    } else if (typeof quadraSelecionadaSaaS !== 'undefined' && quadraSelecionadaSaaS) {
        const match = quadraSelecionadaSaaS.match(/\d+/);
        quadraKey = match ? `Quadra - ${match[0]}` : quadraSelecionadaSaaS;
    }

    const dia = partidaRankingEmFoco.dia;
    const hora = partidaRankingEmFoco.hora;
    const duracao = parseInt(partidaRankingEmFoco.duracao) || 1;

    const pathSlot1 = `reservas/${quadraKey}/${dia}_${hora}`;
    const updates = {};

    updates[`${pathSlot1}/statusPlacar`] = "consolidado";
    updates[`${pathSlot1}/dadosPlacar/statusPlacar`] = "consolidado";
    updates[`${pathSlot1}/dadosPlacar/dataHoraValidacao`] = Date.now();

    if (duracao === 2) {
        const pathSlot2 = `reservas/${quadraKey}/${dia}_${hora + 1}`;
        updates[`${pathSlot2}/statusPlacar`] = "consolidado";
        updates[`${pathSlot2}/dadosPlacar/statusPlacar`] = "consolidado";
        updates[`${pathSlot2}/dadosPlacar/dataHoraValidacao`] = Date.now();
    }

    database.ref(raizBanco).update(updates)
    .then(() => {
        showToast("Placar confirmado com sucesso! O ranking será atualizado.", "success");
        if (intervaloTimerValidacao) clearInterval(intervaloTimerValidacao);
        fecharModalConfig('modal-validacao-placar');
    })
    .catch(err => {
        console.error("❌ [Validação] Erro ao confirmar placar:", err);
        showToast("Erro ao confirmar o placar.", "error");
    });
}

function recusarPlacarAdversarioSaaS() {
    if (!partidaRankingEmFoco || !raizBanco) return;

    let quadraKey = "Quadra - 1";
    if (partidaRankingEmFoco.quadra) {
        const match = partidaRankingEmFoco.quadra.match(/\d+/);
        quadraKey = match ? `Quadra - ${match[0]}` : partidaRankingEmFoco.quadra;
    } else if (typeof quadraSelecionadaSaaS !== 'undefined' && quadraSelecionadaSaaS) {
        const match = quadraSelecionadaSaaS.match(/\d+/);
        quadraKey = match ? `Quadra - ${match[0]}` : quadraSelecionadaSaaS;
    }

    const dia = partidaRankingEmFoco.dia;
    const hora = partidaRankingEmFoco.hora;
    const duracao = parseInt(partidaRankingEmFoco.duracao) || 1;

    const pathSlot1 = `reservas/${quadraKey}/${dia}_${hora}`;
    const updates = {};

    updates[`${pathSlot1}/statusPlacar`] = "contestado";
    updates[`${pathSlot1}/dadosPlacar/statusPlacar`] = "contestado";
    updates[`${pathSlot1}/dadosPlacar/dataHoraContestacao`] = Date.now();

    if (duracao === 2) {
        const pathSlot2 = `reservas/${quadraKey}/${dia}_${hora + 1}`;
        updates[`${pathSlot2}/statusPlacar`] = "contestado";
        updates[`${pathSlot2}/dadosPlacar/statusPlacar`] = "contestado";
        updates[`${pathSlot2}/dadosPlacar/dataHoraContestacao`] = Date.now();
    }

    database.ref(raizBanco).update(updates)
    .then(() => {
        showToast("Súmula contestada! Encaminhada para a arbitragem.", "warning");
        if (intervaloTimerValidacao) clearInterval(intervaloTimerValidacao);
        fecharModalConfig('modal-validacao-placar');
    })
    .catch(err => {
        console.error("❌ [Validação] Erro ao contestar placar:", err);
        showToast("Erro ao registrar contestação.", "error");
    });
}

function abrirPainelArbitroSaaS(reserva) {
    console.log("Abre a gaveta com status 'Contestado' com botões: Manter, Editar, Anular (Fase 3).");
}

function salvarSumulaSaaS() {
    if (!partidaRankingEmFoco || !raizBanco) {
        showToast("Erro ao identificar a partida. Tente novamente.", "error");
        return;
    }

    const btnSalvar = document.getElementById('btn-salvar-sumula-saas');
    if (btnSalvar && btnSalvar.disabled) return;

    if (navigator.vibrate) navigator.vibrate(40);

    if (btnSalvar) {
        btnSalvar.disabled = true;
        btnSalvar.textContent = "Enviando súmula...";
    }

    const getVal = (id) => {
        const el = document.getElementById(id);
        if (!el || el.value === "" || el.value === undefined) return NaN;
        return parseInt(el.value, 10);
    };

    // 1. Leitura dos Parciais
    const s1j1 = getVal('inp-s1-j1'), s1j2 = getVal('inp-s1-j2');
    const tb1j1 = getVal('inp-tb1-j1'), tb1j2 = getVal('inp-tb1-j2');

    const s2j1 = getVal('inp-s2-j1'), s2j2 = getVal('inp-s2-j2');
    const tb2j1 = getVal('inp-tb2-j1'), tb2j2 = getVal('inp-tb2-j2');

    const s3j1 = getVal('inp-s3-j1'), s3j2 = getVal('inp-s3-j2');
    const tb3j1 = getVal('inp-tb3-j1'), tb3j2 = getVal('inp-tb3-j2');

    // 2. Extração dos Jogadores e Vencedor
    const partesJogadores = (partidaRankingEmFoco.jogadores || '').split(', ');
    const infoJ1 = buscarInfoJogador(partesJogadores[0] || "");
    const infoJ2 = buscarInfoJogador(partesJogadores[1] || "");

    const nomeJ1 = capitalizarNome(infoJ1.nomeCompleto || partesJogadores[0]);
    const nomeJ2 = capitalizarNome(infoJ2.nomeCompleto || partesJogadores[1]);

    const txtVencedorDOM = document.getElementById('label-vencedor-sumula');
    const nomeVencedor = txtVencedorDOM ? txtVencedorDOM.textContent.trim() : "";
    const vencedorCodigo = (nomeVencedor.toLowerCase() === nomeJ1.toLowerCase()) ? "J1" : "J2";

    // 3. Formatação da String do Placar (Ex: "6/4 4/6 10/8" ou "7/6(5) 6/3")
    const formatarSetStr = (g1, g2, tb1, tb2) => {
        if (isNaN(g1) || isNaN(g2)) return null;
        if (!isNaN(tb1) && !isNaN(tb2)) {
            const perdedorTb = (g1 > g2) ? tb2 : tb1;
            return `${g1}/${g2}(${perdedorTb})`;
        }
        return `${g1}/${g2}`;
    };

    const partesPlacar = [];
    const parciais = {};

    if (!isNaN(s1j1) && !isNaN(s1j2)) {
        partesPlacar.push(formatarSetStr(s1j1, s1j2, tb1j1, tb1j2));
        parciais.set1 = { j1: s1j1, j2: s1j2, tbJ1: isNaN(tb1j1) ? null : tb1j1, tbJ2: isNaN(tb1j2) ? null : tb1j2 };
    }

    if (!isNaN(s2j1) && !isNaN(s2j2)) {
        partesPlacar.push(formatarSetStr(s2j1, s2j2, tb2j1, tb2j2));
        parciais.set2 = { j1: s2j1, j2: s2j2, tbJ1: isNaN(tb2j1) ? null : tb2j1, tbJ2: isNaN(tb2j2) ? null : tb2j2 };
    }

    if (!isNaN(s3j1) && !isNaN(s3j2)) {
        partesPlacar.push(formatarSetStr(s3j1, s3j2, tb3j1, tb3j2));
        parciais.set3 = { j1: s3j1, j2: s3j2, tbJ1: isNaN(tb3j1) ? null : tb3j1, tbJ2: isNaN(tb3j2) ? null : tb3j2 };
    }

    const placarFormatado = partesPlacar.join(' ');
    const nomeLogado = (localStorage.getItem('jogadorLogadoNome') || 'Atleta').trim();
    const agora = Date.now();
    const prazoHorasAutoconf = (regrasSessaoRanking && regrasSessaoRanking.prazoAutoconf) || 24;
    const expiraValidacaoAt = agora + (prazoHorasAutoconf * 60 * 60 * 1000);

    // 4. Montagem da Estrutura da Súmula
    const dadosPlacar = {
        statusPlacar: "pendente_validacao",
        vencedor: nomeVencedor,
        vencedorCodigo: vencedorCodigo,
        placarFormatado: placarFormatado,
        parciais: parciais,
        autorSumula: nomeLogado,
        dataHoraLancamento: agora,
        expiraValidacaoAt: expiraValidacaoAt
    };

    // 5. Identificação das Chaves no Firebase
    let quadraKey = "Quadra - 1";
    if (partidaRankingEmFoco.quadra) {
        const match = partidaRankingEmFoco.quadra.match(/\d+/);
        quadraKey = match ? `Quadra - ${match[0]}` : partidaRankingEmFoco.quadra;
    } else if (typeof quadraSelecionadaSaaS !== 'undefined' && quadraSelecionadaSaaS) {
        const match = quadraSelecionadaSaaS.match(/\d+/);
        quadraKey = match ? `Quadra - ${match[0]}` : quadraSelecionadaSaaS;
    }

    const dia = partidaRankingEmFoco.dia;
    const hora = partidaRankingEmFoco.hora;
    const duracao = parseInt(partidaRankingEmFoco.duracao) || 1;

    const pathSlot1 = `reservas/${quadraKey}/${dia}_${hora}`;
    const updates = {};

    updates[`${pathSlot1}/statusPlacar`] = "pendente_validacao";
    updates[`${pathSlot1}/dadosPlacar`] = dadosPlacar;

    if (duracao === 2) {
        const pathSlot2 = `reservas/${quadraKey}/${dia}_${hora + 1}`;
        updates[`${pathSlot2}/statusPlacar`] = "pendente_validacao";
        updates[`${pathSlot2}/dadosPlacar`] = dadosPlacar;
    }

    // 6. Gravação Atômica Multi-Path
    database.ref(raizBanco).update(updates)
    .then(() => {
        showToast("Súmula enviada para validação do adversário!", "success");
        fecharModalConfig('modal-sumula-ranking');
    })
    .catch(err => {
        console.error("❌ [Súmula] Erro ao gravar no Firebase:", err);
        showToast("Erro de comunicação ao salvar a súmula.", "error");
    })
    .finally(() => {
        if (btnSalvar) {
            btnSalvar.disabled = false;
            btnSalvar.textContent = "Salvar Súmula";
        }
    });
}


/* ======================================================== */
/* 🛠️ AUXILIARES DO MENU KEBAB DA SÚMULA                     */
/* ======================================================== */
function toggleKebabSumulaSaaS(event) {
    event.stopPropagation();
    const menu = document.getElementById('menu-excecoes-sumula');
    if (menu) menu.classList.toggle('ativo');
}

function declararWoSumulaSaaS() {
    showToast("Declarar W.O. selecionado.", "warning");
}

function declararDesistenciaSumulaSaaS() {
    showToast("Declarar Desistência selecionado.", "warning");
}