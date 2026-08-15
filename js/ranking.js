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

    // Usa a portaria estrita definida no Passo 1
    if (!ehRanking || !verificarAcessoSocioRanking(reserva)) {
        btnGatilho.style.setProperty('display', 'none', 'important');
        return;
    }

    const norm = (txt) => (txt || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9 ]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toUpperCase();

    const statusPlacar = reserva.statusPlacar || 'sem_placar';
    const nomeLogado = (localStorage.getItem('jogadorLogadoNome') || '').trim();
    const normNomeLogado = norm(nomeLogado);

    // Mapeamento de papéis com Nomes Normalizados
    const jogadoresComp = norm(reserva.jogadores_completo || '');
    const jogadoresAp = norm(reserva.jogadores || '');
    const souJogador = normNomeLogado !== "" && (jogadoresComp.includes(normNomeLogado) || jogadoresAp.includes(normNomeLogado));

    // 🛑 STATUS CONTESTADO (Apenas quem tiver permissão em "Quem Pode Arbitrar" resolve contestações)
    if (statusPlacar === 'contestado') {
        if (souJogador) {
            btnGatilho.style.setProperty('display', 'none', 'important');
            return;
        } else if (podeArbitrarRankingSaaS()) {
            btnGatilho.style.setProperty('display', 'flex', 'important');
            btnGatilho.classList.remove('btn-bloqueado');
            const spanTexto = btnGatilho.querySelector('span');
            const icone = btnGatilho.querySelector('i');
            if (spanTexto) spanTexto.textContent = "Placar Contestado";
            if (icone) icone.textContent = "gavel";
            btnGatilho.onclick = () => abrirModalArbitroPlacar(reserva);
            return;
        } else {
            btnGatilho.style.setProperty('display', 'none', 'important');
            return;
        }
    }

    // DEMAIS STATUS
    const horaInicioPartida = converterDataHoraParaTimestamp(reserva.dataCompleta, reserva.hora);
    const horaAtual = new Date().getTime();

    if (horaAtual < horaInicioPartida && statusPlacar === 'sem_placar') {
        btnGatilho.style.setProperty('display', 'flex', 'important');
        btnGatilho.classList.add('btn-bloqueado');
        const spanTexto = btnGatilho.querySelector('span');
        const icone = btnGatilho.querySelector('i');
        if (spanTexto) spanTexto.textContent = "Placar Bloqueado";
        if (icone) icone.textContent = "lock";
        btnGatilho.onclick = () => showToast("O placar só destrava no horário do jogo.", "warning");
        return;
    }

    btnGatilho.style.setProperty('display', 'flex', 'important');
    btnGatilho.classList.remove('btn-bloqueado');

    const spanTexto = btnGatilho.querySelector('span');
    const icone = btnGatilho.querySelector('i');
    const autorSumula = norm(reserva.dadosPlacar ? reserva.dadosPlacar.autorSumula : "");
    const souOAutor = (normNomeLogado !== "" && normNomeLogado === autorSumula);

    if (spanTexto) {
        // 🎯 UNIFICAÇÃO: 'consolidado' ou 'anulado' exibem o mesmo texto limpo
        if (statusPlacar === 'consolidado' || statusPlacar === 'anulado') {
            spanTexto.textContent = "Ver Placar";
        } else if (statusPlacar === 'pendente_validacao') {
            spanTexto.textContent = souOAutor ? "Editar Placar" : "Validar Placar";
        } else {
            spanTexto.textContent = "Lançar Placar";
        }
    }

    if (icone) {
        // 🎯 UNIFICAÇÃO: 'consolidado' ou 'anulado' exibem o mesmo ícone de Olho
        if (statusPlacar === 'consolidado' || statusPlacar === 'anulado') {
            icone.textContent = "visibility";
        } else if (statusPlacar === 'pendente_validacao') {
            icone.textContent = souOAutor ? "edit" : "fact_check";
        } else {
            icone.textContent = "emoji_events";
        }
    }

    btnGatilho.onclick = (e) => {
        if (statusPlacar === 'pendente_validacao' && !souOAutor) {
            abrirModalValidacaoAdversario(reserva);
        } else {
            const modoLeitura = (statusPlacar === 'consolidado' || statusPlacar === 'anulado');
            abrirModalSumulaPrincipal(reserva, modoLeitura);
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


/**
 * Guardião de Permissão: Avalia se o usuário ativo pode resolver contestações do Ranking
 */
function podeArbitrarRankingSaaS() {
    const conf = (configRegrasGlobal && configRegrasGlobal.ranking && configRegrasGlobal.ranking.permiteArbitrar) 
                 ? configRegrasGlobal.ranking.permiteArbitrar 
                 : {};

    // 1. Gestor Mestre da Arena (Sua decisão é ESTRITA e EXCLUSIVA pela chave Gestor)
    if (typeof isGestorLogado !== 'undefined' && isGestorLogado) {
        return conf.Gestor === true;
    }

    let perfisObj = {};
    try { perfisObj = JSON.parse(localStorage.getItem('jogadorLogadoPerfis') || '{}'); } catch(e) {}

    // 2. Árbitros (Padrão nativo do sistema)
    if (perfisObj['Árbitro'] === true) return true;

    // 3. Desenvolvedor / God Mode
    const isGod = !!localStorage.getItem('god_mode_clube');
    if (conf.Dev === true && isGod) return true;

    // 4. Administradores (Aplicado a atletas com perfil Admin)
    if (conf.Admin === true && perfisObj['Admin'] === true) return true;

    // 5. Professores
    if (conf.Professor === true && perfisObj['Professor'] === true) return true;

    return false;
}


function verificarAcessoSocioRanking(reserva) {
    if (!reserva) return false; 

    // 1. Gestor Mestre do Clube ou God Mode
    if (typeof isGestorLogado !== 'undefined' && isGestorLogado) return true;

    // 2. Perfis com permissão de arbitragem liberada nas configurações
    if (typeof podeArbitrarRankingSaaS === 'function' && podeArbitrarRankingSaaS()) return true;

    // 3. Jogadores ou Organizador da Partida
    const nomeLogado = (localStorage.getItem('jogadorLogadoNome') || '').trim().toUpperCase();
    if (!nomeLogado) return false; 

    const jogadoresCompleto = (reserva.jogadores_completo || '').toUpperCase();
    const jogadoresApelidos = (reserva.jogadores || '').toUpperCase();
    const organizador = (reserva.organizador || '').toUpperCase();

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
function abrirModalSumulaPrincipal(reserva, modoLeitura, eEdicaoArbitro = false) {
    limparCamposSumulaRanking();

    partidaRankingEmFoco = reserva;
    regrasSessaoRanking = (configRegrasGlobal && configRegrasGlobal.ranking && configRegrasGlobal.ranking.sumula) 
                          ? configRegrasGlobal.ranking.sumula 
                          : { formatoPartida: "melhor_3_sets", decisaoTerceiroSet: "super_tiebreak" };

    if (typeof fecharMenuAcoesReservaSaaS === 'function') {
        fecharMenuAcoesReservaSaaS();
    }

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

    const elJ1 = document.getElementById('sumula-nome-j1');
    const elJ2 = document.getElementById('sumula-nome-j2');

    if (elJ1) elJ1.innerHTML = formatarNomeInteligente(nomeCompletoJ1, apelidoJ1, true);
    if (elJ2) elJ2.innerHTML = formatarNomeInteligente(nomeCompletoJ2, apelidoJ2, true);

    // 🎨 ADAPTAÇÃO VISUAL DO CABEÇALHO E BOTÃO
    const elTituloHeader = document.querySelector('#modal-sumula-ranking .court-title-detalhes');
    const elSubtituloHeader = document.getElementById('sumula-txt-modelo');
    const btnSalvar = document.getElementById('btn-salvar-sumula-saas');

    const statusPlacar = reserva.statusPlacar || 'sem_placar';

    if (eEdicaoArbitro) {
        if (elTituloHeader) elTituloHeader.innerHTML = '⚖️ Edição de Súmula';
        if (elSubtituloHeader) elSubtituloHeader.textContent = 'Modo de Arbitragem • Ajuste de Resultado';
        if (btnSalvar) { btnSalvar.textContent = 'Atualizar e Consolidar Placar'; btnSalvar.style.display = 'block'; }
    } else if (statusPlacar === 'anulado') {
        if (elTituloHeader) elTituloHeader.innerHTML = '🔴 Súmula Anulada';
        const motivo = reserva.dadosPlacar?.motivoAnulacao || "Anulada pela arbitragem";
        const juiz = reserva.dadosPlacar?.arbitroResponsavel || "Árbitro";
        if (elSubtituloHeader) elSubtituloHeader.textContent = `Anulada por ${juiz}: "${motivo}"`;
        if (btnSalvar) btnSalvar.style.display = 'none';
    } else if (modoLeitura || statusPlacar === 'consolidado') {
        if (elTituloHeader) elTituloHeader.innerHTML = '🏆 Súmula Consolidada';
        if (elSubtituloHeader) elSubtituloHeader.textContent = 'Resultado homologado no ranking';
        if (btnSalvar) btnSalvar.style.display = 'none';
    } else {
        if (elTituloHeader) elTituloHeader.innerHTML = '🏆 Súmula';
        const modeloAtivo = (configRegrasGlobal && configRegrasGlobal.ranking && configRegrasGlobal.ranking.modeloAtivo) || "piramide";
        const nomesModelos = { piramide: "Pirâmide", barragem: "Barragem", grupos: "Grupos" };
        if (elSubtituloHeader) elSubtituloHeader.textContent = `Ranking do tipo ${nomesModelos[modeloAtivo] || "Oficial"}`;
        if (btnSalvar) { btnSalvar.textContent = 'Salvar Súmula'; btnSalvar.style.display = 'block'; }
    }

    adaptarRenderizacaoMatematica(regrasSessaoRanking);

    // 📥 PRÉ-PREENCHIMENTO DOS CAMPOS EXISTENTES
    if (reserva.dadosPlacar && reserva.dadosPlacar.parciais) {
        const p = reserva.dadosPlacar.parciais;
        if (p.set1) {
            if (p.set1.j1 !== undefined && p.set1.j1 !== null && !isNaN(p.set1.j1)) document.getElementById('inp-s1-j1').value = p.set1.j1;
            if (p.set1.j2 !== undefined && p.set1.j2 !== null && !isNaN(p.set1.j2)) document.getElementById('inp-s1-j2').value = p.set1.j2;
            if (p.set1.tbJ1 !== undefined && p.set1.tbJ1 !== null && !isNaN(p.set1.tbJ1)) document.getElementById('inp-tb1-j1').value = p.set1.tbJ1;
            if (p.set1.tbJ2 !== undefined && p.set1.tbJ2 !== null && !isNaN(p.set1.tbJ2)) document.getElementById('inp-tb1-j2').value = p.set1.tbJ2;
        }
        if (p.set2) {
            if (p.set2.j1 !== undefined && p.set2.j1 !== null && !isNaN(p.set2.j1)) document.getElementById('inp-s2-j1').value = p.set2.j1;
            if (p.set2.j2 !== undefined && p.set2.j2 !== null && !isNaN(p.set2.j2)) document.getElementById('inp-s2-j2').value = p.set2.j2;
            if (p.set2.tbJ1 !== undefined && p.set2.tbJ1 !== null && !isNaN(p.set2.tbJ1)) document.getElementById('inp-tb2-j1').value = p.set2.tbJ1;
            if (p.set2.tbJ2 !== undefined && p.set2.tbJ2 !== null && !isNaN(p.set2.tbJ2)) document.getElementById('inp-tb2-j2').value = p.set2.tbJ2;
        }
        if (p.set3) {
            if (p.set3.j1 !== undefined && p.set3.j1 !== null && !isNaN(p.set3.j1)) document.getElementById('inp-s3-j1').value = p.set3.j1;
            if (p.set3.j2 !== undefined && p.set3.j2 !== null && !isNaN(p.set3.j2)) document.getElementById('inp-s3-j2').value = p.set3.j2;
            const { inputTbS3J1, inputTbS3J2 } = garantirInputsTiebreakSet3();
            if (p.set3.tbJ1 !== undefined && p.set3.tbJ1 !== null && !isNaN(p.set3.tbJ1) && inputTbS3J1) inputTbS3J1.value = p.set3.tbJ1;
            if (p.set3.tbJ2 !== undefined && p.set3.tbJ2 !== null && !isNaN(p.set3.tbJ2) && inputTbS3J2) inputTbS3J2.value = p.set3.tbJ2;
        }
    }

    const modalSumula = document.getElementById('modal-sumula-ranking');
    if (modalSumula) {
        modalSumula.style.setProperty('display', 'flex', 'important');
        
        const inputsSumula = modalSumula.querySelectorAll('input');
        inputsSumula.forEach(input => {
            input.disabled = !!modoLeitura;
            if (!modoLeitura) {
                input.oninput = acionarArbitroInvisivelSaaS;
                input.onkeyup = acionarArbitroInvisivelSaaS;
            }
        });
    }

    acionarArbitroInvisivelSaaS();

    if (modoLeitura && btnSalvar) {
        btnSalvar.disabled = true;
    }
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

    // 3. Formatação da String do Placar
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
    const ehContestado = (partidaRankingEmFoco.statusPlacar === 'contestado');

    // 4. Função interna de Persistência no Firebase
    const executarGravacaoBanco = () => {
        if (navigator.vibrate) navigator.vibrate(40);

        if (btnSalvar) {
            btnSalvar.disabled = true;
            btnSalvar.textContent = "Gravando placar...";
        }

        const nomeLogado = (localStorage.getItem('jogadorLogadoNome') || 'Atleta').trim();
        const agora = Date.now();
        const prazoHorasAutoconf = (regrasSessaoRanking && regrasSessaoRanking.prazoAutoconf) || 24;

        // Se for arbitragem de jogo contestado, já entra direto como CONSOLIDADO
        const statusNovo = ehContestado ? "consolidado" : "pendente_validacao";

        const dadosPlacar = {
            statusPlacar: statusNovo,
            vencedor: nomeVencedor,
            vencedorCodigo: vencedorCodigo,
            placarFormatado: placarFormatado,
            parciais: parciais,
            autorSumula: ehContestado ? (partidaRankingEmFoco.dadosPlacar?.autorSumula || nomeLogado) : nomeLogado,
            dataHoraLancamento: partidaRankingEmFoco.dadosPlacar?.dataHoraLancamento || agora,
            expiraValidacaoAt: agora + (prazoHorasAutoconf * 60 * 60 * 1000)
        };

        if (ehContestado) {
            dadosPlacar.decisaoArbitro = "editado_pelo_arbitro";
            dadosPlacar.dataHoraArbitragem = agora;
            dadosPlacar.arbitroResponsavel = nomeLogado;
        }

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

        updates[`${pathSlot1}/statusPlacar`] = statusNovo;
        updates[`${pathSlot1}/dadosPlacar`] = dadosPlacar;

        if (duracao === 2) {
            const pathSlot2 = `reservas/${quadraKey}/${dia}_${hora + 1}`;
            updates[`${pathSlot2}/statusPlacar`] = statusNovo;
            updates[`${pathSlot2}/dadosPlacar`] = dadosPlacar;
        }

        database.ref(raizBanco).update(updates)
        .then(() => {
            const msgSucesso = ehContestado 
                ? "Placar corrigido e homologado com sucesso!" 
                : "Súmula enviada para validação do adversário!";
            showToast(msgSucesso, "success");
			if (ehContestado) {
				notificarAtletasArbitragemSaaS(partidaRankingEmFoco, 'editado', placarFormatado);
			}
            fecharModalConfig('modal-sumula-ranking');
        })
        .catch(err => {
            console.error("❌ [Súmula] Erro ao gravar no Firebase:", err);
            showToast("Erro de comunicação ao salvar a súmula.", "error");
        })
        .finally(() => {
            if (btnSalvar) {
                btnSalvar.disabled = false;
                btnSalvar.textContent = ehContestado ? "Atualizar e Consolidar Placar" : "Salvar Súmula";
            }
        });
    };

    // 5. BIFURCAÇÃO: Exibe modal comparativo se for Edição do Árbitro
    if (ehContestado) {
        const placarAntigoStr = partidaRankingEmFoco.dadosPlacar?.placarFormatado || "--";
        const vencedorAntigoStr = partidaRankingEmFoco.dadosPlacar?.vencedor || "--";

        const htmlPrompt = `
            <div style="text-align: left; font-size: 14px; line-height: 1.5; color: #334155;">
                <div style="background: #fee2e2; border: 1px solid #fca5a5; border-radius: 8px; padding: 10px; margin-bottom: 12px;">
                    <strong style="color: #991b1b; display: block; font-size: 12px; text-transform: uppercase;">Placar Anterior (Contestado)</strong>
                    <span style="color: #7f1d1d; font-weight: 700; font-size: 16px;">${placarAntigoStr}</span>
                    <span style="display: block; font-size: 12px; color: #b91c1c;">Vencedor: ${vencedorAntigoStr}</span>
                </div>

                <div style="background: #dcfce7; border: 1px solid #86efac; border-radius: 8px; padding: 10px; margin-bottom: 12px;">
                    <strong style="color: #166534; display: block; font-size: 12px; text-transform: uppercase;">Novo Placar (Sua Edição)</strong>
                    <span style="color: #14532d; font-weight: 800; font-size: 18px;">${placarFormatado}</span>
                    <span style="display: block; font-size: 12.5px; color: #15803d; font-weight: 700;">Vencedor: ${nomeVencedor}</span>
                </div>

                <p style="margin: 0; font-size: 12.5px; color: #64748b;">
                    Ao confirmar, este resultado será definido como final e homologado no ranking do clube.
                </p>
            </div>
        `;

        showPrompt("Confirmar Alteração de Súmula", htmlPrompt, () => {
            executarGravacaoBanco();
        });
    } else {
        executarGravacaoBanco();
    }
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


/* ======================================================== */
/* 5. AÇÕES DO PAINEL DO ÁRBITRO (FASING - ARBITRAGEM)      */
/* ======================================================== */
/* ======================================================== */
/* RENDERIZAÇÃO DA GAVETA DO ÁRBITRO (LISTA & INDIVIDUAL)   */
/* ======================================================== */

// Renderiza uma lista com 1 ou mais contestações na gaveta do árbitro
function renderizarGavetaArbitroSaaS(listaContestacoes) {
    const modalArb = document.getElementById('modal-arbitro-placar');
    const container = document.getElementById('lista-arbitro-container');
    const elTitulo = document.getElementById('arb-txt-titulo');

    if (!modalArb || !container || !elTitulo) return;

    const total = listaContestacoes.length;
    elTitulo.textContent = total === 1 ? '1 Súmula Contestada' : `${total} Súmulas Contestadas`;
    container.innerHTML = '';

    const diasSemana = ["", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

    listaContestacoes.forEach((reserva, index) => {
        const dados = reserva.dadosPlacar || {};
        const partesJogadores = (reserva.jogadores || '').split(', ');
        const infoJ1 = buscarInfoJogador(partesJogadores[0] || "");
        const infoJ2 = buscarInfoJogador(partesJogadores[1] || "");

        const nomeJ1 = capitalizarNome(infoJ1.nomeCompleto || partesJogadores[0]);
        const nomeJ2 = capitalizarNome(infoJ2.nomeCompleto || partesJogadores[1]);

        const nomeVencedor = capitalizarNome(dados.vencedor || "");
        const nomePerdedor = (nomeVencedor.toLowerCase() === nomeJ1.toLowerCase()) ? nomeJ2 : nomeJ1;

        const nomeDia = diasSemana[reserva.dia] || "Dia";
        const duracao = parseInt(reserva.duracao) || 1;
        const hInicio = String(reserva.hora).padStart(2, '0') + ":00";
        const hFim = String(reserva.hora + duracao).padStart(2, '0') + ":00";

        const modeloAtivo = (configRegrasGlobal && configRegrasGlobal.ranking && configRegrasGlobal.ranking.modeloAtivo) || "piramide";
        const nomesModelos = { piramide: "Pirâmide", barragem: "Barragem", grupos: "Grupos" };

        let nomeQuadra = reserva.quadra || quadraSelecionadaSaaS || "Quadra";
        const numQuadra = nomeQuadra.match(/\d+/);
        if (numQuadra && configQuadrasGlobal && configQuadrasGlobal.nomes) {
            const dadosQ = configQuadrasGlobal.nomes[numQuadra[0]];
            if (dadosQ) {
                nomeQuadra = typeof dadosQ === 'object' ? (dadosQ.nome || `Quadra ${numQuadra[0]}`) : dadosQ;
            }
        }

        const cardHtml = `
            <div class="convite-item" style="margin-bottom: 15px;">
                <div class="convite-header">
                    <span class="convite-data">${nomeDia} • ${hInicio} - ${hFim}</span>
                    <span class="txt-alerta">Contestada</span>
                </div>
                
                <div class="convite-info">
                    <span>${nomeQuadra} • Ranking ${nomesModelos[modeloAtivo] || "Oficial"}</span><br>
                    
                    <div class="box-placar">
                        <span class="vencedor-txt">${nomeVencedor}</span> lançou vitória contra <span class="perdedor-txt">${nomePerdedor}</span>
                        <strong class="placar-numeros">${dados.placarFormatado || "--"}</strong>
                        <div class="motivo-recusa">
                            <i class="material-icons" style="font-size: 14px;">front_hand</i> 
                            <span>${nomePerdedor}</span> recusou este placar.
                        </div>
                    </div>
                </div>
                
                <div class="botoes-acao">
                    <button class="btn-universal btn-success" onclick="manterPlacarArbitroItemSaaS(${index})">Manter</button>
                    <button class="btn-universal btn-warning" onclick="editarPlacarArbitroItemSaaS(${index})">Editar</button>
                    <button class="btn-universal btn-danger" onclick="anularPlacarArbitroItemSaaS(${index})">Anular</button>
                </div>
            </div>
        `;
        container.innerHTML += cardHtml;
    });

    // Guarda a lista ativa de contestações na memória global para os botões acionarem o item correto
    window.contestacoesAbertasSaaS = listaContestacoes;

    modalArb.style.display = 'flex';
}

// Quando clicado direto do card da reserva na planilha, abre exclusivamente 1 partida
function abrirModalArbitroPlacar(reserva) {
    if (!reserva || !reserva.dadosPlacar) return;

    if (typeof fecharMenuAcoesReservaSaaS === 'function') {
        fecharMenuAcoesReservaSaaS();
    }

    renderizarGavetaArbitroSaaS([reserva]);
}


/* ======================================================== */
/* AÇÕES DE DECISÃO DO ÁRBITRO (MANTER, EDITAR, ANULAR)     */
/* ======================================================== */
function manterPlacarArbitroSaaS() {
    if (!partidaRankingEmFoco || !raizBanco) return;

    const nomeLogado = (localStorage.getItem('jogadorLogadoNome') || 'Árbitro').trim();
    let quadraKey = "Quadra - 1";
    if (partidaRankingEmFoco.quadra) {
        const match = partidaRankingEmFoco.quadra.match(/\d+/);
        quadraKey = match ? `Quadra - ${match[0]}` : partidaRankingEmFoco.quadra;
    }

    const dia = partidaRankingEmFoco.dia;
    const hora = partidaRankingEmFoco.hora;
    const duracao = parseInt(partidaRankingEmFoco.duracao) || 1;

    const pathSlot1 = `reservas/${quadraKey}/${dia}_${hora}`;
    const updates = {};

    updates[`${pathSlot1}/statusPlacar`] = "consolidado";
    updates[`${pathSlot1}/dadosPlacar/statusPlacar`] = "consolidado";
    updates[`${pathSlot1}/dadosPlacar/decisaoArbitro`] = "mantido_pelo_arbitro";
    updates[`${pathSlot1}/dadosPlacar/arbitroResponsavel`] = nomeLogado;
    updates[`${pathSlot1}/dadosPlacar/dataHoraArbitragem`] = Date.now();

    if (duracao === 2) {
        const pathSlot2 = `reservas/${quadraKey}/${dia}_${hora + 1}`;
        updates[`${pathSlot2}/statusPlacar`] = "consolidado";
        updates[`${pathSlot2}/dadosPlacar/statusPlacar`] = "consolidado";
        updates[`${pathSlot2}/dadosPlacar/decisaoArbitro`] = "mantido_pelo_arbitro";
        updates[`${pathSlot2}/dadosPlacar/arbitroResponsavel`] = nomeLogado;
        updates[`${pathSlot2}/dadosPlacar/dataHoraArbitragem`] = Date.now();
    }

    database.ref(raizBanco).update(updates)
    .then(() => {
        showToast("Placar mantido e homologado pelo árbitro!", "success");
		notificarAtletasArbitragemSaaS(partidaRankingEmFoco, 'mantido');
        fecharModalConfig('modal-arbitro-placar');
    })
    .catch(err => {
        console.error("❌ [Arbitragem] Erro ao manter placar:", err);
        showToast("Erro ao processar decisão.", "error");
    });
}

function editarPlacarArbitroSaaS() {
    if (!partidaRankingEmFoco) return;
    const reservaTemp = partidaRankingEmFoco;
    fecharModalConfig('modal-arbitro-placar');
    abrirModalSumulaPrincipal(reservaTemp, false, true);
}

function anularPlacarArbitroSaaS() {
    if (!partidaRankingEmFoco || !raizBanco) return;

    // 1. Fecha o modal da arbitragem para evitar sobreposição de camadas escuras
    fecharModalConfig('modal-arbitro-placar');

    const htmlPrompt = `
        <div style="text-align: left; font-size: 14px; color: #334155; line-height: 1.5;">
            <p style="margin: 0 0 10px 0;">Informe o <strong>motivo da anulação</strong> desta partida:</p>
            <textarea id="inp-motivo-anulacao" class="input-app" placeholder="Ex: Divergência de placar / Infração ao regulamento..." style="width: 100%; height: 70px; resize: none; box-sizing: border-box; font-size: 13px; padding: 8px; border: 1px solid #cbd5e1; border-radius: 8px; margin-bottom: 8px;"></textarea>
            <span style="font-size: 12px; color: #64748b; display: block; line-height: 1.4;">
                ⚠️ A partida será marcada como <strong>Anulada</strong> no histórico. O resultado será mantido para auditoria, sem contagem de pontos no ranking.
            </span>
        </div>
    `;

    showPrompt("Anular Súmula", htmlPrompt, () => {
        const elMotivo = document.getElementById('inp-motivo-anulacao');
        const motivo = elMotivo ? elMotivo.value.trim() : "";

        if (!motivo) {
            showToast("Informe a justificativa da anulação.", "warning");
            return;
        }

        const nomeLogado = (localStorage.getItem('jogadorLogadoNome') || 'Árbitro').trim();
        const agora = Date.now();

        let quadraKey = "Quadra - 1";
        if (partidaRankingEmFoco.quadra) {
            const match = partidaRankingEmFoco.quadra.match(/\d+/);
            quadraKey = match ? `Quadra - ${match[0]}` : partidaRankingEmFoco.quadra;
        }

        const dia = partidaRankingEmFoco.dia;
        const hora = partidaRankingEmFoco.hora;
        const duracao = parseInt(partidaRankingEmFoco.duracao) || 1;

        const pathSlot1 = `reservas/${quadraKey}/${dia}_${hora}`;
        const updates = {};

        updates[`${pathSlot1}/statusPlacar`] = "anulado";
        updates[`${pathSlot1}/dadosPlacar/statusPlacar`] = "anulado";
        updates[`${pathSlot1}/dadosPlacar/decisaoArbitro`] = "anulado_pelo_arbitro";
        updates[`${pathSlot1}/dadosPlacar/motivoAnulacao`] = motivo;
        updates[`${pathSlot1}/dadosPlacar/arbitroResponsavel`] = nomeLogado;
        updates[`${pathSlot1}/dadosPlacar/dataHoraArbitragem`] = agora;

        if (duracao === 2) {
            const pathSlot2 = `reservas/${quadraKey}/${dia}_${hora + 1}`;
            updates[`${pathSlot2}/statusPlacar`] = "anulado";
            updates[`${pathSlot2}/dadosPlacar/statusPlacar`] = "anulado";
            updates[`${pathSlot2}/dadosPlacar/decisaoArbitro`] = "anulado_pelo_arbitro";
            updates[`${pathSlot2}/dadosPlacar/motivoAnulacao`] = motivo;
            updates[`${pathSlot2}/dadosPlacar/arbitroResponsavel`] = nomeLogado;
            updates[`${pathSlot2}/dadosPlacar/dataHoraArbitragem`] = agora;
        }

        database.ref(raizBanco).update(updates)
        .then(() => {
            showToast("Partida anulada com sucesso e arquivada no histórico.", "success");
			notificarAtletasArbitragemSaaS(partidaRankingEmFoco, 'anulado', motivo);
        })
        .catch(err => {
            console.error("❌ [Arbitragem] Erro ao anular súmula:", err);
            showToast("Erro ao registrar anulação.", "error");
        });
    });
}

/* ======================================================== */
/* AÇÕES INDIVIDUAIS DE CADA ITEM DA LISTA DO ÁRBITRO       */
/* ======================================================== */
function manterPlacarArbitroItemSaaS(index) {
    const lista = window.contestacoesAbertasSaaS || [];
    if (!lista[index]) return;
    partidaRankingEmFoco = lista[index];
    manterPlacarArbitroSaaS();
}

function editarPlacarArbitroItemSaaS(index) {
    const lista = window.contestacoesAbertasSaaS || [];
    if (!lista[index]) return;
    partidaRankingEmFoco = lista[index];
    editarPlacarArbitroSaaS();
}

function anularPlacarArbitroItemSaaS(index) {
    const lista = window.contestacoesAbertasSaaS || [];
    if (!lista[index]) return;
    partidaRankingEmFoco = lista[index];
    anularPlacarArbitroSaaS();
}

/* ======================================================== */
/* ADIAMENTO DE DECISÃO / VALIDAÇÃO (MEMÓRIA DE SESSÃO)     */
/* ======================================================== */
function adiarValidacaoAdversarioSaaS() {
    if (partidaRankingEmFoco) {
        let quadraKey = "Quadra - 1";
        if (partidaRankingEmFoco.quadra) {
            const match = partidaRankingEmFoco.quadra.match(/\d+/);
            quadraKey = match ? `Quadra - ${match[0]}` : partidaRankingEmFoco.quadra;
        }
        const slotKey = `${partidaRankingEmFoco.dia}_${partidaRankingEmFoco.hora}`;
        const chaveUnica = `${quadraKey}_${slotKey}`;
        
        if (!window.ignoradosSessaoSaaS.includes(chaveUnica)) {
            window.ignoradosSessaoSaaS.push(chaveUnica);
        }
    }
    fecharModalConfig('modal-validacao-placar');
}

function adiarDecisaoArbitroSaaS() {
    if (partidaRankingEmFoco) {
        let quadraKey = "Quadra - 1";
        if (partidaRankingEmFoco.quadra) {
            const match = partidaRankingEmFoco.quadra.match(/\d+/);
            quadraKey = match ? `Quadra - ${match[0]}` : partidaRankingEmFoco.quadra;
        }
        const slotKey = `${partidaRankingEmFoco.dia}_${partidaRankingEmFoco.hora}`;
        const chaveUnica = `${quadraKey}_${slotKey}`;

        if (!window.ignoradosSessaoSaaS.includes(chaveUnica)) {
            window.ignoradosSessaoSaaS.push(chaveUnica);
        }
    }
    fecharModalConfig('modal-arbitro-placar');
}


/* ======================================================== */
/* NOTIFICAÇÃO DE DECISÃO DA ARBITRAGEM AOS ATLETAS         */
/* ======================================================== */
function notificarAtletasArbitragemSaaS(reserva, tipoDecisao, detalhe = "") {
    if (!reserva || !raizBanco) return;

    // 🛡️ Filtro Blindado: Remove acentos, caracteres especiais e espaços extras
    const norm = (txt) => (txt || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, " ").trim().toUpperCase();

    const partesApelidos = (reserva.jogadores || '').split(',').map(s => norm(s));
    const partesCompleto = (reserva.jogadores_completo || '').split(',').map(s => norm(s));

    const termosBusca = [...partesCompleto, ...partesApelidos].filter(t => t.length > 0);
    const idsParaNotificar = [];

    if (typeof jogadoresGlobal !== 'undefined' && jogadoresGlobal) {
        termosBusca.forEach(normTermo => {
            const idEncontrado = Object.keys(jogadoresGlobal).find(id => {
                const j = jogadoresGlobal[id];
                if (!j) return false;
                const nc = norm(j.nomeCompleto);
                const ap = norm(j.apelido);
                return nc === normTermo || ap === normTermo;
            });
            if (idEncontrado && !idsParaNotificar.includes(idEncontrado)) {
                idsParaNotificar.push(idEncontrado);
            }
        });
    }

    console.log("🔔 [Arbitragem] Enviar notificação para IDs:", idsParaNotificar);

    if (idsParaNotificar.length === 0) {
        console.warn("⚠️ [Arbitragem] Nenhum ID de jogador localizado para notificar.");
        return;
    }

    let tipoToast = "info"; 
    let mensagem = "";

    if (tipoDecisao === 'mantido') {
        tipoToast = "success";
        mensagem = "🟢 Arbitragem: O resultado da sua partida contestada foi MANTIDO e homologado.";
    } else if (tipoDecisao === 'editado') {
        tipoToast = "warning";
        mensagem = `🟡 Arbitragem: O placar da sua partida foi CORRIGIDO. Novo resultado: ${detalhe}`;
    } else if (tipoDecisao === 'anulado') {
        tipoToast = "error";
        mensagem = `🔴 Arbitragem: A sua partida foi ANULADA. Motivo: ${detalhe}`;
    }

    const payloadNotif = {
        tipo: tipoToast,
        mensagem: mensagem,
        timestamp: Date.now()
    };

    idsParaNotificar.forEach(idJogador => {
        database.ref(`${raizBanco}/jogadores/${idJogador}/notificacoes`).push(payloadNotif)
            .then(() => console.log(`✅ [Arbitragem] Notificação entregue no nó do jogador: ${idJogador}`))
            .catch(err => console.error(`❌ [Arbitragem] Erro ao notificar jogador ${idJogador}:`, err));
    });
}