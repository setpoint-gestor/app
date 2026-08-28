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

let modoWOAtivoSaaS = false;
let vencedorWOSaaS = null;
let nomeVencedorWOSaaS = "";
let motivoCustomizadoWOSaaS = "";

let modoRETAtivoSaaS = false;
let desistenteRETSaaS = null; // 'J1' ou 'J2'
let nomeDesistenteRETSaaS = "";
let motivoRETSaaS = "";
let motivoCustomizadoRETSaaS = "";

let eModoArbitroAtivoSumula = false;

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
	eModoArbitroAtivoSumula = !!eEdicaoArbitro; // Guarda o estado do Árbitro
	
    desativarModoWOSaaS();
    desativarModoRETSaaS();

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

    // 🎨 ADAPTAÇÃO VISUAL DO CABEÇALHO, BOTÃO E MENU KEBAB
    const elTituloHeader = document.querySelector('#modal-sumula-ranking .court-title-detalhes');
    const elSubtituloHeader = document.getElementById('sumula-txt-modelo');
    const btnSalvar = document.getElementById('btn-salvar-sumula-saas');
    const btnKebab = document.querySelector('#modal-sumula-ranking button[onclick*="toggleKebabSumulaSaaS"]');
    const menuKebab = document.getElementById('menu-excecoes-sumula');

    if (menuKebab) menuKebab.classList.remove('ativo');

    const statusPlacar = reserva.statusPlacar || 'sem_placar';

    if (eEdicaoArbitro) {
        if (elTituloHeader) elTituloHeader.innerHTML = '⚖️ Edição de Súmula';
        if (elSubtituloHeader) elSubtituloHeader.textContent = 'Modo de Arbitragem • Ajuste de Resultado';
        if (btnSalvar) { btnSalvar.textContent = 'Atualizar e Consolidar Placar'; btnSalvar.style.display = 'block'; }
        if (btnKebab) btnKebab.style.display = 'inline-flex';
    } else if (statusPlacar === 'anulado') {
        if (elTituloHeader) elTituloHeader.innerHTML = '🔴 Súmula Anulada';
        const motivo = reserva.dadosPlacar?.motivoAnulacao || "Anulada pela arbitragem";
        const juiz = reserva.dadosPlacar?.arbitroResponsavel || "Árbitro";
        if (elSubtituloHeader) elSubtituloHeader.textContent = `Anulada por ${juiz}: "${motivo}"`;
        if (btnSalvar) btnSalvar.style.display = 'none';
        if (btnKebab) btnKebab.style.display = 'none';
    } else if (modoLeitura || statusPlacar === 'consolidado') {
        if (elTituloHeader) elTituloHeader.innerHTML = '🏆 Súmula Consolidada';
        if (elSubtituloHeader) elSubtituloHeader.textContent = 'Resultado homologado no ranking';
        if (btnSalvar) btnSalvar.style.display = 'none';
        if (btnKebab) btnKebab.style.display = 'none';
    } else {
        if (elTituloHeader) elTituloHeader.innerHTML = '🏆 Súmula';
        const modeloAtivo = (configRegrasGlobal && configRegrasGlobal.ranking && configRegrasGlobal.ranking.modeloAtivo) || "piramide";
        const nomesModelos = { piramide: "Pirâmide", barragem: "Barragem", grupos: "Grupos" };
        if (elSubtituloHeader) elSubtituloHeader.textContent = `Ranking do tipo ${nomesModelos[modeloAtivo] || "Oficial"}`;
        if (btnSalvar) { btnSalvar.textContent = 'Salvar Súmula'; btnSalvar.style.display = 'block'; }
        if (btnKebab) btnKebab.style.display = 'inline-flex';
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

    // 🚩 LEITURA DO PLACAR
    const dadosPlacar = reserva.dadosPlacar || {};
    const eWO = dadosPlacar.isWO || (dadosPlacar.placarFormatado && dadosPlacar.placarFormatado.includes("W.O."));

    if (eWO) {
        modoWOAtivoSaaS = true;

        const subNormal = document.getElementById('subpainel-normal-sumula');
        const subWO = document.getElementById('subpainel-wo-sumula');
        if (subNormal) subNormal.style.display = 'none';
        if (subWO) subWO.style.display = 'block';

        const elWOJ1 = document.getElementById('sumula-wo-nome-j1');
        const elWOJ2 = document.getElementById('sumula-wo-nome-j2');
        if (elWOJ1) elWOJ1.innerHTML = formatarNomeInteligente(nomeCompletoJ1, apelidoJ1, true);
        if (elWOJ2) elWOJ2.innerHTML = formatarNomeInteligente(nomeCompletoJ2, apelidoJ2, true);

        if (dadosPlacar.vencedorCodigo) {
            selecionarVencedorWOSaaS(dadosPlacar.vencedorCodigo);
        }

        const elMotivo = document.getElementById('select-motivo-wo');
        if (elMotivo && dadosPlacar.motivoWO) {
            let achou = false;
            for (let i = 0; i < elMotivo.options.length; i++) {
                if (elMotivo.options[i].text.trim().toLowerCase() === dadosPlacar.motivoWO.trim().toLowerCase()) {
                    elMotivo.selectedIndex = i;
                    achou = true;
                    break;
                }
            }
            if (!achou) {
                elMotivo.value = 'outros';
                motivoCustomizadoWOSaaS = dadosPlacar.motivoWO;
            }
        }

        if (modoLeitura || statusPlacar === 'consolidado') {
            const cardJ1 = document.getElementById('card-wo-j1');
            const cardJ2 = document.getElementById('card-wo-j2');
            if (cardJ1) cardJ1.onclick = null;
            if (cardJ2) cardJ2.onclick = null;
            if (elMotivo) elMotivo.disabled = true;
        }
    }
	
    // 🚩 DETECÇÃO E EXIBIÇÃO DE RET EM MODO LEITURA / VER PLACAR
    const eRET = dadosPlacar.isRET || (dadosPlacar.placarFormatado && dadosPlacar.placarFormatado.includes("(RET)"));

    if (eRET) {
        modoRETAtivoSaaS = true;

        const subNormal = document.getElementById('subpainel-normal-sumula');
        const subRET = document.getElementById('subpainel-ret-sumula');
        if (subNormal) subNormal.style.display = 'block';
        if (subRET) subRET.style.display = 'block';

        const elRETJ1 = document.getElementById('sumula-ret-nome-j1');
        const elRETJ2 = document.getElementById('sumula-ret-nome-j2');
        if (elRETJ1) elRETJ1.innerHTML = formatarNomeInteligente(nomeCompletoJ1, apelidoJ1, true);
        if (elRETJ2) elRETJ2.innerHTML = formatarNomeInteligente(nomeCompletoJ2, apelidoJ2, true);

        if (dadosPlacar.desistenteCodigo) {
            selecionarDesistenteRETSaaS(dadosPlacar.desistenteCodigo);
        }

        const elMotivo = document.getElementById('select-motivo-ret');
        if (elMotivo && dadosPlacar.motivoRET) {
            let achou = false;
            for (let i = 0; i < elMotivo.options.length; i++) {
                if (elMotivo.options[i].text.trim().toLowerCase() === dadosPlacar.motivoRET.trim().toLowerCase()) {
                    elMotivo.selectedIndex = i;
                    achou = true;
                    break;
                }
            }
            if (!achou) {
                elMotivo.value = 'outros';
                motivoCustomizadoRETSaaS = dadosPlacar.motivoRET;
            }
        }

        if (modoLeitura || statusPlacar === 'consolidado') {
            const cardJ1 = document.getElementById('card-ret-j1');
            const cardJ2 = document.getElementById('card-ret-j2');
            if (cardJ1) cardJ1.onclick = null;
            if (cardJ2) cardJ2.onclick = null;
            if (elMotivo) elMotivo.disabled = true;
        }
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
    
	if (elPlacar) {
        if (dados.isWO || (dados.placarFormatado && dados.placarFormatado.includes("W.O."))) {
            const txtMotivo = dados.motivoWO || "Não informado";
            elPlacar.innerHTML = `
                W.O.
                <span class="txt-motivo-wo">(Motivo: ${txtMotivo})</span>
            `;
        } else if (dados.isRET || (dados.placarFormatado && dados.placarFormatado.includes("RET"))) {
            const txtMotivoRET = dados.motivoRET || "Não informado";
            const placarLimpo = (dados.placarFormatado || "").replace(/\s*\(?RET\)?/gi, "").trim();
            const placarComBadge = placarLimpo 
                ? `<span class="placar-com-badge"><span>${placarLimpo}</span><span class="badge-ret">RET</span></span>` 
                : `<span class="badge-ret">RET</span>`;

            elPlacar.innerHTML = `
                ${placarComBadge}
                <span class="txt-motivo-ret">(Desistência: ${txtMotivoRET})</span>
            `;
        } else {
            elPlacar.textContent = dados.placarFormatado || "--";
        }
    }

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
		
		// 🔔 DISPARO DO MOTOR DE RANKING (PIRÂMIDE)
        processarResultadoRankingSaaS(partidaRankingEmFoco);
		
		// 🔔 NOTIFICAÇÃO AO AUTOR DA SÚMULA
        notificarAutorSumulaSaaS(partidaRankingEmFoco, 'confirmado');
		
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
		
		// 🔔 NOTIFICAÇÃO AO AUTOR DA SÚMULA
        notificarAutorSumulaSaaS(partidaRankingEmFoco, 'recusado');
		
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

    // 1. EXTRAÇÃO DE JOGADORES
    const partesJogadores = (partidaRankingEmFoco.jogadores || '').split(', ');
    const infoJ1 = buscarInfoJogador(partesJogadores[0] || "");
    const infoJ2 = buscarInfoJogador(partesJogadores[1] || "");
    const nomeJ1 = capitalizarNome(infoJ1.nomeCompleto || partesJogadores[0]);
    const nomeJ2 = capitalizarNome(infoJ2.nomeCompleto || partesJogadores[1]);

    let nomeVencedor = "";
    let vencedorCodigo = "";
    let placarFormatado = "";
    let parciais = {};
    let isWO = false;
    let motivoWO = "";

    let isRET = false;
    let motivoRET = "";
    let desistenteCodigo = "";

    // 2. BIFURCAÇÃO DE DADOS (W.O. vs RET vs PLACAR NORMAL)
    if (modoWOAtivoSaaS) {
        if (!vencedorWOSaaS) {
            showToast("Selecione o atleta vencedor por W.O.", "warning");
            return;
        }
        
        const elMotivo = document.getElementById('select-motivo-wo');
        const valMotivo = elMotivo ? elMotivo.value : "";

        if (valMotivo === 'outros') {
            if (!motivoCustomizadoWOSaaS) {
                showToast("Por favor, especifique o motivo do W.O.", "warning");
                return;
            }
            motivoWO = `Outros: ${motivoCustomizadoWOSaaS}`;
        } else {
            motivoWO = elMotivo ? elMotivo.options[elMotivo.selectedIndex].text : "Ausência";
        }
        
        isWO = true;
        vencedorCodigo = vencedorWOSaaS;
        nomeVencedor = nomeVencedorWOSaaS;
        placarFormatado = `W.O. (${motivoWO})`;
    } else {
        // Leitura de sets parciais
        const getVal = (id) => {
            const el = document.getElementById(id);
            if (!el || el.value === "" || el.value === undefined) return NaN;
            return parseInt(el.value, 10);
        };

        const s1j1 = getVal('inp-s1-j1'), s1j2 = getVal('inp-s1-j2');
        const tb1j1 = getVal('inp-tb1-j1'), tb1j2 = getVal('inp-tb1-j2');
        const s2j1 = getVal('inp-s2-j1'), s2j2 = getVal('inp-s2-j2');
        const tb2j1 = getVal('inp-tb2-j1'), tb2j2 = getVal('inp-tb2-j2');
        const s3j1 = getVal('inp-s3-j1'), s3j2 = getVal('inp-s3-j2');
        const tb3j1 = getVal('inp-tb3-j1'), tb3j2 = getVal('inp-tb3-j2');

        const formatarSetStr = (g1, g2, tb1, tb2) => {
            if (isNaN(g1) || isNaN(g2)) return null;
            if (!isNaN(tb1) && !isNaN(tb2)) {
                const perdedorTb = (g1 > g2) ? tb2 : tb1; 
                return `${g1}/${g2}(${perdedorTb})`;
            }
            return `${g1}/${g2}`;
        };

        const partesPlacar = [];
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

        if (modoRETAtivoSaaS) {
            if (!desistenteRETSaaS) {
                showToast("Selecione o atleta que desistiu da partida.", "warning");
                return;
            }

            const elMotivoRET = document.getElementById('select-motivo-ret');
            const valMotivoRET = elMotivoRET ? elMotivoRET.value : "";

            if (valMotivoRET === 'outros') {
                if (!motivoCustomizadoRETSaaS) {
                    showToast("Por favor, especifique o motivo da desistência.", "warning");
                    return;
                }
                motivoRET = `Outros: ${motivoCustomizadoRETSaaS}`;
            } else {
                motivoRET = elMotivoRET ? elMotivoRET.options[elMotivoRET.selectedIndex].text : "Lesão";
            }

            isRET = true;
            desistenteCodigo = desistenteRETSaaS;
            vencedorCodigo = (desistenteRETSaaS === 'J1') ? "J2" : "J1";
            nomeVencedor = (vencedorCodigo === 'J1') ? nomeJ1 : nomeJ2;
            placarFormatado = partesPlacar.length > 0 ? `${partesPlacar.join(' ')} (RET)` : "RET";
        } else {
            const txtVencedorDOM = document.getElementById('label-vencedor-sumula');
            nomeVencedor = txtVencedorDOM ? txtVencedorDOM.textContent.trim() : "";
            vencedorCodigo = (nomeVencedor.toLowerCase() === nomeJ1.toLowerCase()) ? "J1" : "J2";
            placarFormatado = partesPlacar.join(' ');
        }
    }

    // 3. PERSISTÊNCIA ÚNICA NO BANCO DE DADOS
    const norm = (txt) => (txt || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9 ]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toUpperCase();

    const nomeLogado = (localStorage.getItem('jogadorLogadoNome') || 'Atleta').trim();
    const normNomeLogado = norm(nomeLogado);
    const jogadoresComp = norm(partidaRankingEmFoco.jogadores_completo || '');
    const jogadoresAp = norm(partidaRankingEmFoco.jogadores || '');
    
    // 🛡️ Identifica se o usuário logado é um dos competidores da partida
    const souJogadorDaPartida = normNomeLogado !== "" && (jogadoresComp.includes(normNomeLogado) || jogadoresAp.includes(normNomeLogado));

    const ehContestado = (partidaRankingEmFoco.statusPlacar === 'contestado');
    
    // ⚖️ Arbitragem neutra: só vale se for Gestor/Árbitro e NÃO estiver jogando a partida
    const ehArbitragemNeutra = !souJogadorDaPartida && ((typeof isGestorLogado !== 'undefined' && isGestorLogado) || podeArbitrarRankingSaaS());

    const executarGravacaoBanco = () => {
        if (navigator.vibrate) navigator.vibrate(40);

        if (btnSalvar) {
            btnSalvar.disabled = true;
            btnSalvar.textContent = "Gravando placar...";
        }

        const agora = Date.now();
        const prazoHorasAutoconf = (regrasSessaoRanking && regrasSessaoRanking.prazoAutoconf) || 24;

        // Se for um dos atletas jogando, entra OBRIGATORIAMENTE como 'pendente_validacao'
        const statusNovo = ehArbitragemNeutra ? "consolidado" : "pendente_validacao";

        const dadosPlacar = {
            statusPlacar: statusNovo,
            isWO: isWO,
            motivoWO: motivoWO,
            isRET: isRET,                       
            desistenteCodigo: desistenteCodigo, 
            motivoRET: motivoRET,               
            vencedor: nomeVencedor,
            vencedorCodigo: vencedorCodigo,
            placarFormatado: placarFormatado,
            parciais: parciais,
            autorSumula: (ehContestado && ehArbitragemNeutra) ? (partidaRankingEmFoco.dadosPlacar?.autorSumula || nomeLogado) : nomeLogado,
            dataHoraLancamento: partidaRankingEmFoco.dadosPlacar?.dataHoraLancamento || agora,
            expiraValidacaoAt: agora + (prazoHorasAutoconf * 60 * 60 * 1000)
        };

        if (ehContestado && ehArbitragemNeutra) {
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
            updates[`${pathSlot2}/dadosPlacar`] = statusNovo;
        }

        database.ref(raizBanco).update(updates)
        .then(() => {
            const msgSucesso = isWO 
                ? (ehArbitragemNeutra ? "W.O. confirmado e homologado!" : "W.O. registrado! Enviado para validação.")
                : (ehArbitragemNeutra ? "Placar corrigido e homologado com sucesso!" : "Súmula enviada para validação do adversário!");
            
            showToast(msgSucesso, "success");

            if (ehContestado && ehArbitragemNeutra) {
                notificarAtletasArbitragemSaaS(partidaRankingEmFoco, 'editado', placarFormatado);
            }

            partidaRankingEmFoco.statusPlacar = statusNovo;
            partidaRankingEmFoco.dadosPlacar = dadosPlacar;

            if (statusNovo === "consolidado") {
                processarResultadoRankingSaaS(partidaRankingEmFoco);
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
                btnSalvar.textContent = modoWOAtivoSaaS ? "Confirmar e Enviar W.O." : (ehArbitragemNeutra ? "Atualizar e Consolidar Placar" : "Salvar Súmula");
            }
        });
    };

    // 4. CONFIRMAÇÃO DE PROMPT SE FOR EDIÇÃO DE ÁRBITRO NEUTRO
    if (ehContestado && ehArbitragemNeutra) {
        let placarAntigoStr = partidaRankingEmFoco.dadosPlacar?.placarFormatado || "--";
        if (partidaRankingEmFoco.dadosPlacar?.isWO || (placarAntigoStr && placarAntigoStr.includes("W.O."))) {
            const motAntigo = partidaRankingEmFoco.dadosPlacar?.motivoWO || "Ausência";
            placarAntigoStr = `W.O. (${motAntigo})`;
        }

        const vencedorAntigoStr = partidaRankingEmFoco.dadosPlacar?.vencedor || "--";

        let placarNovoStr = placarFormatado;
        if (isWO) {
            placarNovoStr = `W.O. (${motivoWO})`;
        }

        const htmlPrompt = `
            <div style="text-align: left; font-size: 14px; line-height: 1.5; color: #334155;">
                <div style="background: #fee2e2; border: 1px solid #fca5a5; border-radius: 8px; padding: 10px; margin-bottom: 12px;">
                    <strong style="color: #991b1b; display: block; font-size: 12px; text-transform: uppercase;">Placar Anterior (Contestado)</strong>
                    <span style="color: #7f1d1d; font-weight: 700; font-size: 16px;">${placarAntigoStr}</span>
                    <span style="display: block; font-size: 12px; color: #b91c1c;">Vencedor: ${vencedorAntigoStr}</span>
                </div>

                <div style="background: #dcfce7; border: 1px solid #86efac; border-radius: 8px; padding: 10px; margin-bottom: 12px;">
                    <strong style="color: #166534; display: block; font-size: 12px; text-transform: uppercase;">Novo Placar (Sua Edição)</strong>
                    <span style="color: #14532d; font-weight: 800; font-size: 18px;">${placarNovoStr}</span>
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
/* 🛠️ AVALIADOR INTELIGENTE DE ESTADOS DO MENU KEBAB        */
/* ======================================================== */
function atualizarEstadoKebabSumulaSaaS() {
    const btnWO = document.querySelector('#menu-excecoes-sumula button[onclick*="declararWoSumulaSaaS"]');
    const btnRET = document.querySelector('#menu-excecoes-sumula button[onclick*="declararDesistenciaSumulaSaaS"]');
    const itemLive = document.querySelector('#menu-excecoes-sumula .item-menu-live');
    const chkLive = document.querySelector('#menu-excecoes-sumula .switch-mini input');

    if (!btnWO || !btnRET) return;

    // Detecta se a janela está aberta no Modo de Arbitragem
    const ehArbitragem = eModoArbitroAtivoSumula || (partidaRankingEmFoco && partidaRankingEmFoco.statusPlacar === 'contestado');

    // 1. Controle do Placar ao Vivo
    if (ehArbitragem) {
        if (chkLive) { chkLive.disabled = true; chkLive.checked = false; }
        if (itemLive) {
            itemLive.classList.add('desabilitado');
            itemLive.onclick = (e) => {
                e.stopPropagation();
                showToast("Transmissão ao vivo indisponível no modo de arbitragem.", "warning");
            };
        }
    } else {
        if (chkLive) chkLive.disabled = false;
        if (itemLive) {
            itemLive.classList.remove('desabilitado');
            itemLive.onclick = null;
        }
    }

    // 2. Controle de W.O. e Desistência (RET)
    if (ehArbitragem) {
        // Árbitro tem poder total para declarar W.O. ou RET sobre qualquer placar
        btnWO.classList.remove('desabilitado');
        btnWO.onclick = () => declararWoSumulaSaaS();

        btnRET.classList.remove('desabilitado');
        btnRET.onclick = () => declararDesistenciaSumulaSaaS();

    } else {
        // Regra Padrão para Atletas
        const getVal = (id) => {
            const el = document.getElementById(id);
            if (!el || el.value === "" || el.value === undefined) return NaN;
            return parseInt(el.value, 10);
        };

        const s1j1 = getVal('inp-s1-j1'), s1j2 = getVal('inp-s1-j2');
        const s2j1 = getVal('inp-s2-j1'), s2j2 = getVal('inp-s2-j2');
        const s3j1 = getVal('inp-s3-j1'), s3j2 = getVal('inp-s3-j2');

        const temAlgumGame = (!isNaN(s1j1) && s1j1 > 0) || (!isNaN(s1j2) && s1j2 > 0) ||
                             (!isNaN(s2j1) && s2j1 > 0) || (!isNaN(s2j2) && s2j2 > 0) ||
                             (!isNaN(s3j1) && s3j1 > 0) || (!isNaN(s3j2) && s3j2 > 0);

        const txtVencedor = document.getElementById('label-vencedor-sumula');
        const jogoFinalizado = txtVencedor && txtVencedor.textContent.trim() !== "--" && txtVencedor.textContent.trim() !== "";

        if (jogoFinalizado) {
            btnWO.classList.add('desabilitado');
            btnWO.onclick = () => showToast("Partida já finalizada por placar.", "warning");

            btnRET.classList.add('desabilitado');
            btnRET.onclick = () => showToast("Partida já finalizada por placar.", "warning");

        } else if (temAlgumGame) {
            btnWO.classList.add('desabilitado');
            btnWO.onclick = () => showToast("W.O. só é permitido antes do início da contagem de games.", "warning");

            btnRET.classList.remove('desabilitado');
            btnRET.onclick = () => declararDesistenciaSumulaSaaS();

        } else {
            btnWO.classList.remove('desabilitado');
            btnWO.onclick = () => declararWoSumulaSaaS();

            btnRET.classList.add('desabilitado');
            btnRET.onclick = () => showToast("Desistência (RET) exige ao menos 1 game em andamento.", "warning");
        }
    }
}

function toggleKebabSumulaSaaS(event) {
    event.stopPropagation();
    const menu = document.getElementById('menu-excecoes-sumula');
    if (menu) {
        atualizarEstadoKebabSumulaSaaS();
        menu.classList.toggle('ativo');
    }
}

function toggleModoLiveSumula(chk) {
    if (chk.checked) {
        showToast("Em breve: Transmissão e pontuação ponto a ponto ao vivo!", "info");
        setTimeout(() => {
            chk.checked = false;
        }, 1200);
    }
}

function declararWoSumulaSaaS() {
    if (!partidaRankingEmFoco) return;

    // 🛑 TRAVA RIGOROSA DE TOLERÂNCIA DE W.O.
    const toleranciaMinutos = (regrasSessaoRanking && regrasSessaoRanking.toleranciaWO !== undefined) 
        ? parseInt(regrasSessaoRanking.toleranciaWO, 10) 
        : 15;

    const horaInicioPartida = converterDataHoraParaTimestamp(partidaRankingEmFoco.dataCompleta, partidaRankingEmFoco.hora);
    const horaLiberaWO = horaInicioPartida + (toleranciaMinutos * 60 * 1000);
    const agora = Date.now();

    // Bloqueia a abertura se ainda não atingiu o horário do jogo + tolerância
    if (agora < horaLiberaWO) {
        const dataLibera = new Date(horaLiberaWO);
        const hFim = String(dataLibera.getHours()).padStart(2, '0');
        const mFim = String(dataLibera.getMinutes()).padStart(2, '0');

        showToast(`O W.O. só pode ser declarado após a tolerância de ${toleranciaMinutos} min (às ${hFim}:${mFim}).`, "warning");
        return;
    }

    const menu = document.getElementById('menu-excecoes-sumula');
    if (menu) menu.classList.remove('ativo');

    modoWOAtivoSaaS = true;

    // Alterna a exibição dos subpainéis
    const subNormal = document.getElementById('subpainel-normal-sumula');
    const subWO = document.getElementById('subpainel-wo-sumula');
    if (subNormal) subNormal.style.display = 'none';
    if (subWO) subWO.style.display = 'block';

    // Atualiza o cabeçalho do modal
    const elTituloHeader = document.querySelector('#modal-sumula-ranking .court-title-detalhes');
    const elSubtituloHeader = document.getElementById('sumula-txt-modelo');
    if (elTituloHeader) elTituloHeader.innerHTML = 'Declaração de W.O.';
    if (elSubtituloHeader) elSubtituloHeader.textContent = 'Registro de Ausência / Impossibilidade';

    // Preenche o nome dos atletas nos cards de W.O. com formatação inteligente
    if (partidaRankingEmFoco) {
        const partesApelidos = (partidaRankingEmFoco.jogadores || '').split(', ');
        const partesCompleto = (partidaRankingEmFoco.jogadores_completo || '').split(', ');

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

        const elWOJ1 = document.getElementById('sumula-wo-nome-j1');
        const elWOJ2 = document.getElementById('sumula-wo-nome-j2');

        if (elWOJ1) elWOJ1.innerHTML = formatarNomeInteligente(nomeCompletoJ1, apelidoJ1, true);
        if (elWOJ2) elWOJ2.innerHTML = formatarNomeInteligente(nomeCompletoJ2, apelidoJ2, true);
    }

    // Configura o botão do rodapé
    const btnSalvar = document.getElementById('btn-salvar-sumula-saas');
    if (btnSalvar) {
        btnSalvar.textContent = 'Confirmar e Enviar W.O.';
        btnSalvar.style.backgroundColor = '#dc2626';
        btnSalvar.disabled = true;
    }

    resetarSelecaoWOSaaS();
}

function desativarModoWOSaaS() {
    modoWOAtivoSaaS = false;

    // Destrava interações dos cards e do seletor de motivos
    const cardJ1 = document.getElementById('card-wo-j1');
    const cardJ2 = document.getElementById('card-wo-j2');
    const selectMotivo = document.getElementById('select-motivo-wo');

    if (cardJ1) cardJ1.onclick = () => selecionarVencedorWOSaaS('J1');
    if (cardJ2) cardJ2.onclick = () => selecionarVencedorWOSaaS('J2');
    if (selectMotivo) selectMotivo.disabled = false;

    const subNormal = document.getElementById('subpainel-normal-sumula');
    const subWO = document.getElementById('subpainel-wo-sumula');
    if (subNormal) subNormal.style.display = 'block';
    if (subWO) subWO.style.display = 'none';

    const elTituloHeader = document.querySelector('#modal-sumula-ranking .court-title-detalhes');
    const elSubtituloHeader = document.getElementById('sumula-txt-modelo');
    if (elTituloHeader) elTituloHeader.innerHTML = '🏆 Súmula';
    
    if (partidaRankingEmFoco) {
        const modeloAtivo = (configRegrasGlobal && configRegrasGlobal.ranking && configRegrasGlobal.ranking.modeloAtivo) || "piramide";
        const nomesModelos = { piramide: "Pirâmide", barragem: "Barragem", grupos: "Grupos" };
        if (elSubtituloHeader) elSubtituloHeader.textContent = `Ranking do tipo ${nomesModelos[modeloAtivo] || "Oficial"}`;
    }

    const btnSalvar = document.getElementById('btn-salvar-sumula-saas');
    if (btnSalvar) {
        btnSalvar.textContent = 'Salvar Súmula';
        btnSalvar.style.backgroundColor = 'var(--cor-primaria, #28a745)';
        btnSalvar.disabled = true;
    }

    const txtVencedor = document.getElementById('label-vencedor-sumula');
    if (txtVencedor) txtVencedor.textContent = '--';
    
    const boxVencedor = document.querySelector('#modal-sumula-ranking .vencedor-box');
    if (boxVencedor) boxVencedor.classList.remove('wo-ativo');
}


function selecionarVencedorWOSaaS(codigo) {
    if (!partidaRankingEmFoco) return;

    vencedorWOSaaS = codigo;

    const partesApelidos = (partidaRankingEmFoco.jogadores || '').split(', ');
    const partesCompleto = (partidaRankingEmFoco.jogadores_completo || '').split(', ');

    const infoJ1 = buscarInfoJogador(partesApelidos[0] || "");
    const infoJ2 = buscarInfoJogador(partesApelidos[1] || "");

    nomeVencedorWOSaaS = (codigo === 'J1') 
        ? capitalizarNome(infoJ1.nomeCompleto || partesCompleto[0] || partesApelidos[0])
        : capitalizarNome(infoJ2.nomeCompleto || partesCompleto[1] || partesApelidos[1]);

    const cardJ1 = document.getElementById('card-wo-j1');
    const cardJ2 = document.getElementById('card-wo-j2');
    const tagJ1 = document.getElementById('tag-wo-j1');
    const tagJ2 = document.getElementById('tag-wo-j2');

    if (cardJ1) cardJ1.classList.remove('selecionado');
    if (cardJ2) cardJ2.classList.remove('selecionado');
    if (tagJ1) tagJ1.textContent = 'Selecionar';
    if (tagJ2) tagJ2.textContent = 'Selecionar';

    if (codigo === 'J1') {
        if (cardJ1) cardJ1.classList.add('selecionado');
        if (tagJ1) tagJ1.textContent = 'Vencedor';
    } else {
        if (cardJ2) cardJ2.classList.add('selecionado');
        if (tagJ2) tagJ2.textContent = 'Vencedor';
    }

    const txtVencedor = document.getElementById('label-vencedor-sumula');
    if (txtVencedor) txtVencedor.textContent = nomeVencedorWOSaaS;

    const boxVencedor = document.querySelector('#modal-sumula-ranking .vencedor-box');
    if (boxVencedor) boxVencedor.classList.remove('wo-ativo');
	
    const btnSalvar = document.getElementById('btn-salvar-sumula-saas');
    if (btnSalvar) btnSalvar.disabled = false;
}

function resetarSelecaoWOSaaS() {
    const selectMotivo = document.getElementById('select-motivo-wo');
    if (selectMotivo) selectMotivo.selectedIndex = 0;
    motivoCustomizadoWOSaaS = "";

    vencedorWOSaaS = null;
    nomeVencedorWOSaaS = "";

    const cardJ1 = document.getElementById('card-wo-j1');
    const cardJ2 = document.getElementById('card-wo-j2');
    const tagJ1 = document.getElementById('tag-wo-j1');
    const tagJ2 = document.getElementById('tag-wo-j2');

    if (cardJ1) cardJ1.classList.remove('selecionado');
    if (cardJ2) cardJ2.classList.remove('selecionado');
    if (tagJ1) tagJ1.textContent = 'Selecionar';
    if (tagJ2) tagJ2.textContent = 'Selecionar';

    const txtVencedor = document.getElementById('label-vencedor-sumula');
    if (txtVencedor) txtVencedor.textContent = '--';

    const boxVencedor = document.querySelector('#modal-sumula-ranking .vencedor-box');
    if (boxVencedor) boxVencedor.classList.remove('wo-ativo');
}

function tratarSelecaoMotivoWOSaaS(valor) {
    if (valor === 'outros') {
        const htmlPrompt = `
            <div style="text-align: left; font-size: 14px; color: #334155; line-height: 1.5;">
                <p style="margin: 0 0 10px 0;">Informe a justificativa do W.O.:</p>
                <input type="text" id="inp-motivo-outros-popup" class="input-app" placeholder="Ex: Problema de saúde, viagem..." style="width: 100%; box-sizing: border-box; font-size: 14px; padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px;">
            </div>
        `;

        showPrompt("Motivo do W.O.", htmlPrompt, () => {
            const elInp = document.getElementById('inp-motivo-outros-popup');
            const txt = elInp ? elInp.value.trim() : "";
            if (txt) {
                motivoCustomizadoWOSaaS = txt;
            } else {
                showToast("Nenhuma justificativa digitada.", "warning");
                document.getElementById('select-motivo-wo').selectedIndex = 0;
                motivoCustomizadoWOSaaS = "";
            }
        }, () => {
            document.getElementById('select-motivo-wo').selectedIndex = 0;
            motivoCustomizadoWOSaaS = "";
        });
    } else {
        motivoCustomizadoWOSaaS = ""; 
    }
}

function clicarBotaoVoltarSumulaSaaS() {
    const stPlacar = partidaRankingEmFoco ? (partidaRankingEmFoco.statusPlacar || 'sem_placar') : 'sem_placar';
    const btnSalvar = document.getElementById('btn-salvar-sumula-saas');
    const ehModoLeitura = (stPlacar === 'consolidado' || stPlacar === 'anulado' || (btnSalvar && btnSalvar.style.display === 'none'));

    if (ehModoLeitura) {
        fecharModalConfig('modal-sumula-ranking');
        return;
    }

    if (modoWOAtivoSaaS) {
        desativarModoWOSaaS();
    } else if (modoRETAtivoSaaS) {
        desativarModoRETSaaS();
    } else {
        fecharModalConfig('modal-sumula-ranking');
    }
}

function declararDesistenciaSumulaSaaS() {
    if (!partidaRankingEmFoco) return;

    const menu = document.getElementById('menu-excecoes-sumula');
    if (menu) menu.classList.remove('ativo');

    modoWOAtivoSaaS = false;
    modoRETAtivoSaaS = true;

    // Esconde os demais subpainéis e exibe EXCLUSIVAMENTE o subpainel do RET (idêntico ao W.O.)
    const subNormal = document.getElementById('subpainel-normal-sumula');
    const subWO = document.getElementById('subpainel-wo-sumula');
    const subRET = document.getElementById('subpainel-ret-sumula');

    if (subNormal) subNormal.style.display = 'none'; // <-- Esconde os inputs de placar em cima
    if (subWO) subWO.style.display = 'none';
    if (subRET) subRET.style.display = 'block';

    const elTituloHeader = document.querySelector('#modal-sumula-ranking .court-title-detalhes');
    const elSubtituloHeader = document.getElementById('sumula-txt-modelo');
    if (elTituloHeader) elTituloHeader.innerHTML = 'Declaração de Desistência';
    if (elSubtituloHeader) elSubtituloHeader.textContent = 'Informe os placares parciais e o atleta que desistiu';

    if (partidaRankingEmFoco) {
        const partesApelidos = (partidaRankingEmFoco.jogadores || '').split(', ');
        const partesCompleto = (partidaRankingEmFoco.jogadores_completo || '').split(', ');

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

        const elRETJ1 = document.getElementById('sumula-ret-nome-j1');
        const elRETJ2 = document.getElementById('sumula-ret-nome-j2');

        if (elRETJ1) elRETJ1.innerHTML = formatarNomeInteligente(nomeCompletoJ1, apelidoJ1, true);
        if (elRETJ2) elRETJ2.innerHTML = formatarNomeInteligente(nomeCompletoJ2, apelidoJ2, true);
    }

    const btnSalvar = document.getElementById('btn-salvar-sumula-saas');
    if (btnSalvar) {
        btnSalvar.textContent = 'Confirmar e Enviar Desistência';
        btnSalvar.style.backgroundColor = '#dc2626';
        btnSalvar.disabled = true;
    }

    resetarSelecaoRETSaaS();
}


function selecionarDesistenteRETSaaS(codigo) {
    if (!partidaRankingEmFoco) return;

    desistenteRETSaaS = codigo; // 'J1' ou 'J2' (quem desistiu)
    const vencedorCodigo = (codigo === 'J1') ? 'J2' : 'J1';

    const partesApelidos = (partidaRankingEmFoco.jogadores || '').split(', ');
    const partesCompleto = (partidaRankingEmFoco.jogadores_completo || '').split(', ');

    const infoJ1 = buscarInfoJogador(partesApelidos[0] || "");
    const infoJ2 = buscarInfoJogador(partesApelidos[1] || "");

    nomeDesistenteRETSaaS = (codigo === 'J1') 
        ? capitalizarNome(infoJ1.nomeCompleto || partesCompleto[0] || partesApelidos[0])
        : capitalizarNome(infoJ2.nomeCompleto || partesCompleto[1] || partesApelidos[1]);

    const nomeVencedor = (vencedorCodigo === 'J1')
        ? capitalizarNome(infoJ1.nomeCompleto || partesCompleto[0] || partesApelidos[0])
        : capitalizarNome(infoJ2.nomeCompleto || partesCompleto[1] || partesApelidos[1]);

    const cardJ1 = document.getElementById('card-ret-j1');
    const cardJ2 = document.getElementById('card-ret-j2');
    const tagJ1 = document.getElementById('tag-ret-j1');
    const tagJ2 = document.getElementById('tag-ret-j2');

    if (cardJ1) cardJ1.classList.remove('desistente-selecionado');
    if (cardJ2) cardJ2.classList.remove('desistente-selecionado');
    if (tagJ1) tagJ1.textContent = 'Selecionar';
    if (tagJ2) tagJ2.textContent = 'Selecionar';

    if (codigo === 'J1') {
        if (cardJ1) cardJ1.classList.add('desistente-selecionado');
        if (tagJ1) tagJ1.textContent = 'Desistiu (RET)';
    } else {
        if (cardJ2) cardJ2.classList.add('desistente-selecionado');
        if (tagJ2) tagJ2.textContent = 'Desistiu (RET)';
    }

    const txtVencedor = document.getElementById('label-vencedor-sumula');
    if (txtVencedor) txtVencedor.textContent = nomeVencedor;

    const btnSalvar = document.getElementById('btn-salvar-sumula-saas');
    if (btnSalvar) btnSalvar.disabled = false;
}

function resetarSelecaoRETSaaS() {
    const selectMotivo = document.getElementById('select-motivo-ret');
    if (selectMotivo) selectMotivo.selectedIndex = 0;
    motivoCustomizadoRETSaaS = "";

    desistenteRETSaaS = null;
    nomeDesistenteRETSaaS = "";

    const cardJ1 = document.getElementById('card-ret-j1');
    const cardJ2 = document.getElementById('card-ret-j2');
    const tagJ1 = document.getElementById('tag-ret-j1');
    const tagJ2 = document.getElementById('tag-ret-j2');

    if (cardJ1) cardJ1.classList.remove('desistente-selecionado');
    if (cardJ2) cardJ2.classList.remove('desistente-selecionado');
    if (tagJ1) tagJ1.textContent = 'Selecionar';
    if (tagJ2) tagJ2.textContent = 'Selecionar';

    const txtVencedor = document.getElementById('label-vencedor-sumula');
    if (txtVencedor) txtVencedor.textContent = '--';
}

function desativarModoRETSaaS() {
    modoRETAtivoSaaS = false;

    const cardJ1 = document.getElementById('card-ret-j1');
    const cardJ2 = document.getElementById('card-ret-j2');
    const selectMotivo = document.getElementById('select-motivo-ret');

    if (cardJ1) cardJ1.onclick = () => selecionarDesistenteRETSaaS('J1');
    if (cardJ2) cardJ2.onclick = () => selecionarDesistenteRETSaaS('J2');
    if (selectMotivo) selectMotivo.disabled = false;

    // 1. Reexibe o painel normal de sets e esconde o subpainel de desistência
    const subNormal = document.getElementById('subpainel-normal-sumula');
    const subRET = document.getElementById('subpainel-ret-sumula');
    if (subNormal) subNormal.style.display = 'block';
    if (subRET) subRET.style.display = 'none';

    // 2. Restaura o título e o subtítulo originais do cabeçalho
    const elTituloHeader = document.querySelector('#modal-sumula-ranking .court-title-detalhes');
    const elSubtituloHeader = document.getElementById('sumula-txt-modelo');
    if (elTituloHeader) elTituloHeader.innerHTML = '🏆 Súmula';
    
    if (partidaRankingEmFoco) {
        const modeloAtivo = (configRegrasGlobal && configRegrasGlobal.ranking && configRegrasGlobal.ranking.modeloAtivo) || "piramide";
        const nomesModelos = { piramide: "Pirâmide", barragem: "Barragem", grupos: "Grupos" };
        if (elSubtituloHeader) elSubtituloHeader.textContent = `Ranking do tipo ${nomesModelos[modeloAtivo] || "Oficial"}`;
    }

    // 3. Restaura o texto e a cor padrão do botão do rodapé
    const btnSalvar = document.getElementById('btn-salvar-sumula-saas');
    if (btnSalvar) {
        btnSalvar.textContent = 'Salvar Súmula';
        btnSalvar.style.backgroundColor = 'var(--cor-primaria, #28a745)';
        btnSalvar.disabled = true;
    }

    resetarSelecaoRETSaaS();
}

function tratarSelecaoMotivoRETSaaS(valor) {
    if (valor === 'outros') {
        const htmlPrompt = `
            <div style="text-align: left; font-size: 14px; color: #334155; line-height: 1.5;">
                <p style="margin: 0 0 10px 0;">Informe a justificativa da desistência:</p>
                <input type="text" id="inp-motivo-ret-outros-popup" class="input-app" placeholder="Ex: Cãibra forte no 2º set..." style="width: 100%; box-sizing: border-box; font-size: 14px; padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px;">
            </div>
        `;

        showPrompt("Motivo da Desistência", htmlPrompt, () => {
            const elInp = document.getElementById('inp-motivo-ret-outros-popup');
            const txt = elInp ? elInp.value.trim() : "";
            if (txt) {
                motivoCustomizadoRETSaaS = txt;
            } else {
                showToast("Nenhuma justificativa digitada.", "warning");
                document.getElementById('select-motivo-ret').selectedIndex = 0;
                motivoCustomizadoRETSaaS = "";
            }
        }, () => {
            document.getElementById('select-motivo-ret').selectedIndex = 0;
            motivoCustomizadoRETSaaS = "";
        });
    } else {
        motivoCustomizadoRETSaaS = "";
    }
}

/* ======================================================== */
/* 5. AÇÕES DO PAINEL DO ÁRBITRO (FASING - ARBITRAGEM)      */
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

        // Formatação condicional do placar / motivo de W.O. e RET
        let txtResultado = dados.placarFormatado || "--";
        if (dados.isWO || (dados.placarFormatado && dados.placarFormatado.includes("W.O."))) {
            const motivoWO = dados.motivoWO || "Ausência";
            txtResultado = `W.O. (${motivoWO})`;
        } else if (dados.isRET || (dados.placarFormatado && dados.placarFormatado.includes("RET"))) {
            const motivoRET = dados.motivoRET || "Desistência";
            const placarTxt = dados.placarFormatado || "RET";
            txtResultado = `
                <span>${placarTxt}</span>
                <span class="txt-motivo-wo">Motivo: ${motivoRET}</span>
            `;
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
                        <span><span class="vencedor-txt">${nomeVencedor}</span> lançou vitória contra <span class="perdedor-txt">${nomePerdedor}</span></span>
                        <strong class="placar-numeros" style="display: block; margin-top: 6px;">${txtResultado}</strong>
                        <div class="motivo-recusa" style="margin-top: 8px;">
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

    if (idsParaNotificar.length === 0) return;

    let categoria = "geral";
    if (tipoDecisao === 'mantido') categoria = "homologado_arb";
    else if (tipoDecisao === 'editado') categoria = "ajustado_arb";
    else if (tipoDecisao === 'anulado') categoria = "anulado_arb";

    const partesApelidosOrig = (reserva.jogadores || '').split(',');
    const partesCompletoOrig = (reserva.jogadores_completo || '').split(',');
    const adversarioNome = partesApelidosOrig.length > 1 ? partesApelidosOrig[1].trim() : (partesCompletoOrig.length > 1 ? partesCompletoOrig[1].trim() : 'seu adversário');

    const payloadNotif = {
        categoria: categoria,
        detalhe: detalhe,
        adversario: adversarioNome,
        timestamp: Date.now()
    };

    idsParaNotificar.forEach(idJogador => {
        database.ref(`${raizBanco}/jogadores/${idJogador}/notificacoes`).push(payloadNotif);
    });
}

function notificarAutorSumulaSaaS(reserva, categoria) {
    if (!reserva || !raizBanco || !reserva.dadosPlacar) return;
    const norm = (txt) => (txt || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, " ").trim().toUpperCase();

    const autorSumulaNorm = norm(reserva.dadosPlacar.autorSumula || '');
    const nomeConfirmadorNorm = norm(localStorage.getItem('jogadorLogadoNome') || '');

    if (!autorSumulaNorm) return;

    const idAutor = Object.keys(jogadoresGlobal || {}).find(id => {
        const j = jogadoresGlobal[id];
        if (!j) return false;
        return norm(j.nomeCompleto) === autorSumulaNorm || norm(j.apelido) === autorSumulaNorm;
    });

    if (idAutor) {
        const confirmadorAtleta = Object.values(jogadoresGlobal || {}).find(j => norm(j.nomeCompleto) === nomeConfirmadorNorm || norm(j.apelido) === nomeConfirmadorNorm);
        const nomeConfirmadorFormatado = confirmadorAtleta ? (confirmadorAtleta.apelido || confirmadorAtleta.nomeCompleto) : (localStorage.getItem('jogadorLogadoNome') || 'Adversário');

        const payload = {
            categoria: categoria,
            adversario: nomeConfirmadorFormatado,
            timestamp: Date.now()
        };

        database.ref(`${raizBanco}/jogadores/${idAutor}/notificacoes`).push(payload);
    }
}

// ==========================================
// 6. AÇÕES DO SÓCIO: CONFIRMAÇÃO DE INSCRIÇÃO NO RANKING
// ==========================================

async function aceitarConviteRankingSocioSaaS() {
    const idLogado = localStorage.getItem('jogadorLogadoId');
    if (!idLogado || !raizBanco) return;

    if (navigator.vibrate) navigator.vibrate(30);

    try {
        const atleta = jogadoresGlobal[idLogado] || {};
        const snapConfig = await database.ref(`${raizBanco}/config/ranking`).once('value');
        const configRanking = snapConfig.val() || {};

        // 🛑 TRAVA DE ENCERRAMENTO: Impede inscrições após o congelamento das chaves (Fase 3+)
        const faseAtual = parseInt(configRanking.faseAtual, 10) || 1;
        if (faseAtual > 2) {
            showToast("As inscrições para este torneio já foram encerradas.", "warning");
            await database.ref(`${raizBanco}/convites_ranking/pendentes/${idLogado}`).remove();
            fecharModalNotificacoes();
            return;
        }

        // 🟢 Avisa apenas se a inscrição puder prosseguir
        showToast("Processando sua inscrição no ranking...", "info");

        // 🟢 INSCREVE O ATLETA APENAS NA LISTA DE CONFIRMADOS DO TORNEIO (FASE 2)
        const cobrarTaxa = configRanking.financeiro?.cobrarTaxa === true;
        const payloadInscrito = {
            nome: atleta.nomeCompleto || atleta.apelido || "Atleta",
            pixPago: !cobrarTaxa, // Se não houver cobrança de taxa, já nasce como Pago
            dataAceite: Date.now()
        };
        await database.ref(`${raizBanco}/config/ranking/inscritosConfirmados/${idLogado}`).set(payloadInscrito);

        // Remove do lote de convites pendentes
        await database.ref(`${raizBanco}/convites_ranking/pendentes/${idLogado}`).remove();

        showToast("Inscrição confirmada com sucesso! Bem-vindo ao Ranking.", "success");
        fecharModalNotificacoes();

    } catch (err) {
        console.error("Erro ao aceitar convite do ranking:", err);
        showToast("Erro ao confirmar inscrição no banco de dados.", "error");
    }
}


async function recusarConviteRankingSocioSaaS() {
    const idLogado = localStorage.getItem('jogadorLogadoId');
    if (!idLogado || !raizBanco) return;

    if (navigator.vibrate) navigator.vibrate(20);

    try {
        // 1. Remove da lista de pendentes do convite
        await database.ref(`${raizBanco}/convites_ranking/pendentes/${idLogado}`).remove();

        // 2. Varre as tabelas do ranking e remove o atleta de qualquer categoria
        const refTabelas = `${raizBanco}/ranking/tabelas`;
        const snapTabelas = await database.ref(refTabelas).once('value');
        
        if (snapTabelas.exists()) {
            const tabelasAtuais = snapTabelas.val() || {};
            let tabelasModificadas = false;

            Object.keys(tabelasAtuais).forEach(nomeTab => {
                if (Array.isArray(tabelasAtuais[nomeTab])) {
                    const idx = tabelasAtuais[nomeTab].indexOf(idLogado);
                    if (idx !== -1) {
                        tabelasAtuais[nomeTab].splice(idx, 1);
                        tabelasModificadas = true; 
                    }
                }
            });

            if (tabelasModificadas) {
                await database.ref(refTabelas).set(tabelasAtuais);
            }
        }

        showToast("Convite recusado. Seu nome foi removido do ranking.", "info");
        fecharModalNotificacoes();
    } catch (err) {
        console.error("Erro ao recusar convite:", err);
        showToast("Erro ao atualizar status do convite.", "error");
    }
}

/* ======================================================== */
/* 7. LEADERBOARD / GAVETA DA CLASSIFICAÇÃO                  */
/* ======================================================== */

// Abertura da Gaveta de Classificação com Trava de Ponto Zero (Leitura RAM)
function abrirLeaderboardSaaS() {
    if (navigator.vibrate) navigator.vibrate(30);

    const sheet = document.getElementById('sheet-leaderboard-ranking');
    if (!sheet) return;

    // 1. Lê os dados já sincronizados na RAM pelo core.js
    const confRanking = (configRegrasGlobal && configRegrasGlobal.ranking) ? configRegrasGlobal.ranking : {};
    const faseAtual = parseInt(confRanking.faseAtual, 10) || 1;
    const divGenero = confRanking.divisaoGenero || 'separado';

    const chaveTabela = (divGenero === 'unificado') 
        ? `${abaClasseAtivaSaaS}_UNIFICADO` 
        : `${abaClasseAtivaSaaS}_${abaGeneroAtivaSaaS}`;

    // 2. Checa Torneio Ativo e Ranking Geral na memória
    const tabelaTorneio = (typeof rankingTabelasGlobal !== 'undefined' && rankingTabelasGlobal) 
        ? rankingTabelasGlobal[chaveTabela] 
        : null;
    const temTorneioAtivo = (faseAtual >= 3 && Array.isArray(tabelaTorneio) && tabelaTorneio.length > 0);

    const tabelaGeral = (typeof rankingGeralGlobal !== 'undefined' && rankingGeralGlobal) 
        ? rankingGeralGlobal[chaveTabela] 
        : null;
    const temRankingGeral = (Array.isArray(tabelaGeral) && tabelaGeral.length > 0);

    // 🛑 ESTADO 1 (PONTO ZERO): Se não tem histórico e não tem torneio ativo, barra antes de abrir
    if (!temRankingGeral && !temTorneioAtivo) {
        showToast("Nenhum torneio em andamento ou histórico registrado.", "info");
        return;
    }

    // Se houver dados, abre a gaveta normalmente
    sheet.style.display = 'flex';
    setTimeout(() => sheet.classList.add('ativa'), 10);

    if (typeof renderizarLeaderboardSaaS === 'function') {
        renderizarLeaderboardSaaS();
    }
}

// Fechamento da Gaveta
function fecharLeaderboardSaaS(e) {
    const sheet = document.getElementById('sheet-leaderboard-ranking');
    if (!sheet) return;

    if (e && e.target && !e.target.classList.contains('bottom-sheet-overlay')) {
        return;
    }

    sheet.classList.remove('ativa');
    setTimeout(() => {
        sheet.style.display = 'none';
    }, 250);
}

// Vincula a ação de "Ver Tabela" do Painel do Gestor à mesma gaveta
function abrirVisualizacaoRankingSaaS() {
    // Mantém o modal de configurações aberto ao fundo
    abrirLeaderboardSaaS(); 
}


/* ======================================================== */
/* 8. MOTOR DO LEADERBOARD / RENDERIZAÇÃO DINÂMICA          */
/* ======================================================== */

let abaVisaoLeaderboardSaaS = 'TORNEIO'; // 'TORNEIO' ou 'GERAL'
let abaClasseAtivaSaaS = 'B';
let abaGeneroAtivaSaaS = 'MASCULINO';

function trocarVisaoLeaderboardSaaS(modo) {
    abaVisaoLeaderboardSaaS = modo;
    
    const btnTorneio = document.getElementById('btn-tab-torneio-saas');
    const btnGeral = document.getElementById('btn-tab-geral-saas');
    
    if (btnTorneio && btnGeral) {
        if (modo === 'TORNEIO') {
            btnTorneio.classList.add('active');
            btnGeral.classList.remove('active');
        } else {
            btnGeral.classList.add('active');
            btnTorneio.classList.remove('active');
        }
    }
    
    renderizarLeaderboardSaaS();
}

async function renderizarLeaderboardSaaS() {
    const selectClasse = document.getElementById('select-leaderboard-classe');
    const selectGenero = document.getElementById('select-leaderboard-genero');
    const bodyList = document.getElementById('body-leaderboard-scroll');
    const txtSub = document.getElementById('txt-subtitulo-leaderboard');

    const btnTorneio = document.getElementById('btn-tab-torneio-saas');
    const btnGeral = document.getElementById('btn-tab-geral-saas');
    const containerAbas = btnTorneio ? btnTorneio.parentElement : null;

    if (!bodyList) return;

    bodyList.innerHTML = '<p style="text-align: center; color: #888; margin-top: 30px;">Carregando classificação...</p>';

    try {
        // 1. Lê as configurações do ranking e pontuação do Firebase
        const snapConfig = await database.ref(`${raizBanco}/config/ranking`).once('value');
        const configRanking = snapConfig.val() || {};

        const modelo = configRanking.modeloAtivo || 'piramide';
        const divGenero = configRanking.divisaoGenero || 'separado';
        const ptsVit = parseInt(configRanking.barragem?.pontosVitoria) || 3;
        const ptsDer = parseInt(configRanking.barragem?.pontosDerrota) || 1;
        const faseAtual = parseInt(configRanking.faseAtual, 10) || 1;
        const cal = configRanking.calendario || {};

        // Identifica se o torneio está na fase concluída/homologada
        const torneioConcluido = (modelo !== "grupos" && faseAtual >= 4) || (modelo === "grupos" && faseAtual >= 5);

        if (txtSub) {
            if (torneioConcluido) {
                txtSub.innerHTML = `<b>🏆 Hall de Campeões</b> • ${cal.nomeTorneio || 'Torneio do Clube'} <span style="display:inline-block; background:#dcfce7; color:#15803d; font-size:10px; font-weight:800; padding:2px 8px; border-radius:10px; margin-left:4px; border:1px solid #86efac;">✓ Homologado</span>`;
            } else {
                const nomesModelos = { piramide: 'Pirâmide (Escada)', barragem: 'Barragem (Pontos)', grupos: 'Grupos (Chaves)' };
                txtSub.textContent = `Ranking Oficial do Clube • Modelo ${nomesModelos[modelo] || 'Oficial'}`;
            }
        }

        // 2. Popula os Selects de Filtro (Mantido intacto)
        const classesAvulsa = ['A', 'B', 'C'];
        if (selectClasse) {
            selectClasse.innerHTML = classesAvulsa.map(cls => `
                <option value="${cls}" ${cls === abaClasseAtivaSaaS ? 'selected' : ''}>Classe ${cls}</option>
            `).join('');
        }

        if (selectGenero) {
            if (divGenero === 'unificado') {
                selectGenero.innerHTML = `<option value="UNIFICADO" selected>Geral / Unificado</option>`;
                selectGenero.disabled = true;
                abaGeneroAtivaSaaS = 'UNIFICADO';
            } else {
                selectGenero.disabled = false;
                selectGenero.innerHTML = `
                    <option value="MASCULINO" ${abaGeneroAtivaSaaS === 'MASCULINO' ? 'selected' : ''}>Masculino</option>
                    <option value="FEMININO" ${abaGeneroAtivaSaaS === 'FEMININO' ? 'selected' : ''}>Feminino</option>
                `;
            }
        }

        // 3. Busca inscritos do torneio e Ranking Geral da RAM
        const chaveTabela = (divGenero === 'unificado') ? `${abaClasseAtivaSaaS}_UNIFICADO` : `${abaClasseAtivaSaaS}_${abaGeneroAtivaSaaS}`;
        const snapTabela = await database.ref(`${raizBanco}/ranking/tabelas/${chaveTabela}`).once('value');
        const listaIDs = snapTabela.exists() ? snapTabela.val() : [];

        const temTorneioAtivo = (faseAtual >= 3 && Array.isArray(listaIDs) && listaIDs.length > 0);

        let listaGeralIDs = (typeof rankingGeralGlobal !== 'undefined' && rankingGeralGlobal)
            ? rankingGeralGlobal[chaveTabela]
            : null;
        const temRankingGeral = (Array.isArray(listaGeralIDs) && listaGeralIDs.length > 0);

        // 📊 4. MATRIZ DE ESTADOS DAS ABAS DE NAVEGAÇÃO
        if (!temRankingGeral && !temTorneioAtivo) {
            // Estado 1: Ponto Zero (Nenhum histórico e nenhum torneio ativo)
            if (containerAbas) containerAbas.style.display = 'none';
            bodyList.innerHTML = '<p style="text-align: center; color: #94a3b8; margin-top: 40px; font-weight: 500;">Nenhum torneio em andamento ou histórico registrado.</p>';
            return;
        }

        if (containerAbas) containerAbas.style.display = 'flex';

        if (!temRankingGeral && temTorneioAtivo) {
            // Estado 2: 1º Torneio (Apenas Torneio Atual ativo a 100%)
            if (btnTorneio) { 
                btnTorneio.style.display = 'flex'; 
                btnTorneio.style.width = '100%'; 
                btnTorneio.style.cursor = 'default';
                btnTorneio.classList.add('active'); 
            }
            if (btnGeral) { btnGeral.style.display = 'none'; btnGeral.classList.remove('active'); }
            abaVisaoLeaderboardSaaS = 'TORNEIO';

        } else if (temRankingGeral && !temTorneioAtivo) {
            // Estado 3: Entre Torneios (Apenas Ranking Geral ativo a 100%)
            if (btnGeral) { 
                btnGeral.style.display = 'flex'; 
                btnGeral.style.width = '100%'; 
                btnGeral.style.cursor = 'default';
                btnGeral.classList.add('active'); 
            }
            if (btnTorneio) { btnTorneio.style.display = 'none'; btnTorneio.classList.remove('active'); }
            abaVisaoLeaderboardSaaS = 'GERAL';

        } else {
            // Estado 4: Torneios Seguintes (2 Abas a 50%/50%)
            if (btnTorneio) { 
                btnTorneio.style.display = 'flex'; 
                btnTorneio.style.width = '50%'; 
                btnTorneio.style.cursor = 'pointer';
            }
            if (btnGeral) { 
                btnGeral.style.display = 'flex'; 
                btnGeral.style.width = '50%'; 
                btnGeral.style.cursor = 'pointer';
            }
            
            if (btnTorneio && btnGeral) {
                if (abaVisaoLeaderboardSaaS === 'TORNEIO') {
                    btnTorneio.classList.add('active');
                    btnGeral.classList.remove('active');
                } else {
                    btnGeral.classList.add('active');
                    btnTorneio.classList.remove('active');
                }
            }
        }

        const idLogado = localStorage.getItem('jogadorLogadoId');

        // 📊 SE A ABA "RANKING GERAL" ESTIVER SELECIONADA: EXIBE A FILA MESTRE CONTÍNUA
        if (abaVisaoLeaderboardSaaS === 'GERAL') {
            let htmlGeral = `
                <div class="box-dica-leaderboard">
                    💡 <b>Ranking Geral do Clube:</b> Exibe a Fila Mestre acumulada da categoria.
                </div>
            `;

            if (!Array.isArray(listaGeralIDs) || listaGeralIDs.length === 0) {
                bodyList.innerHTML = '<p style="text-align: center; color: #94a3b8; margin-top: 40px; font-weight: 500;">Nenhum atleta cadastrado no Ranking Geral.</p>';
                return;
            }

            listaGeralIDs.forEach((idAtleta, index) => {
                const atleta = (typeof jogadoresGlobal !== 'undefined' && jogadoresGlobal[idAtleta]) ? jogadoresGlobal[idAtleta] : {};
                const pos = index + 1;
                const nomeAtleta = atleta.nomeCompleto || atleta.apelido || 'Atleta';
                const ehVoce = (idAtleta === idLogado);

                htmlGeral += `
                    <div class="item-leaderboard-piramide ${ehVoce ? 'voce' : ''}">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <span style="font-weight: 800; font-size: 13px; color: #64748b; width: 24px;">${pos}º</span>
                            <div>
                                <strong style="font-size: 14px; color: #1e293b; display: block;">${nomeAtleta} ${ehVoce ? '(Você)' : ''}</strong>
                                <span style="font-size: 11px; color: #64748b;">${pos === 1 ? 'Líder do Ranking Geral' : 'Atleta Cadastrado'}</span>
                            </div>
                        </div>
                    </div>
                `;
            });

            bodyList.innerHTML = htmlGeral;
            return;
        }

        const snapPartidas = await database.ref(`${raizBanco}/ranking/partidas`).once('value');
        const partidasGlobal = snapPartidas.exists() ? snapPartidas.val() : {};

        // 5. Mapeamento de estatísticas e confrontos diretos por atleta
        const estatisticas = {};
        const confrontosDiretos = {};

        listaIDs.forEach(id => {
            estatisticas[id] = { j: 0, v: 0, d: 0, sg: 0, pts: 0 };
        });

        Object.values(partidasGlobal).forEach(partida => {
            if (partida.status === 'finalizada' && partida.categoria === chaveTabela) {
                const p1 = partida.jogador1Id;
                const p2 = partida.jogador2Id;
                const vitorioso = partida.vencedorId;

                const gamesP1 = parseInt(partida.gamesP1) || 0;
                const gamesP2 = parseInt(partida.gamesP2) || 0;

                // Registra confronto direto entre atletas
                confrontosDiretos[`${p1}_vs_${p2}`] = vitorioso;
                confrontosDiretos[`${p2}_vs_${p1}`] = vitorioso;

                if (estatisticas[p1]) {
                    estatisticas[p1].j++;
                    estatisticas[p1].sg += (gamesP1 - gamesP2);
                    if (vitorioso === p1) {
                        estatisticas[p1].v++;
                        estatisticas[p1].pts += ptsVit;
                    } else {
                        estatisticas[p1].d++;
                        estatisticas[p1].pts += ptsDer;
                    }
                }

                if (estatisticas[p2]) {
                    estatisticas[p2].j++;
                    estatisticas[p2].sg += (gamesP2 - gamesP1);
                    if (vitorioso === p2) {
                        estatisticas[p2].v++;
                        estatisticas[p2].pts += ptsVit;
                    } else {
                        estatisticas[p2].d++;
                        estatisticas[p2].pts += ptsDer;
                    }
                }
            }
        });

        // ========================================================
        // 🏆 SE O TORNEIO ESTIVER CONCLUÍDO: HALL DE CAMPEÕES (SANFONA)
        // ========================================================
        if (torneioConcluido) {
            let htmlHall = '';

            const idCampeao = listaIDs[0];
            const idVice = listaIDs[1];
            const idTerceiro = listaIDs[2];

            const objCampeao = (typeof jogadoresGlobal !== 'undefined' && jogadoresGlobal[idCampeao]) ? jogadoresGlobal[idCampeao] : {};
            const objVice = (typeof jogadoresGlobal !== 'undefined' && jogadoresGlobal[idVice]) ? jogadoresGlobal[idVice] : {};
            const objTerceiro = (typeof jogadoresGlobal !== 'undefined' && jogadoresGlobal[idTerceiro]) ? jogadoresGlobal[idTerceiro] : {};

            const nomeCampeao = capitalizarNome(objCampeao.nomeCompleto || objCampeao.apelido || 'Campeão');
            const nomeVice = capitalizarNome(objVice.nomeCompleto || objVice.apelido || 'Vice-Campeão');
            const nomeTerceiro = capitalizarNome(objTerceiro.nomeCompleto || objTerceiro.apelido || '3º Colocado');

            // Mapeamento dinâmico do rótulo do troféu por modelo
            const rotulosBadgesCampeao = {
                piramide: "1º LUGAR • PIRÂMIDE",
                barragem: "1º LUGAR • BARRAGEM",
                grupos: "1º LUGAR • GRUPOS"
            };
            const txtBadgeCampeao = rotulosBadgesCampeao[modelo] || "1º LUGAR • CAMPEÃO";

            // Card Dourado do 1º Lugar (Campeão)
            htmlHall += `
                <div style="background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%); border: 2px solid #f59e0b; border-radius: 16px; padding: 14px; text-align: center; box-shadow: 0 10px 15px -3px rgba(245, 158, 11, 0.2); margin-bottom: 12px;">
                    <div style="font-size: 28px; margin-bottom: -4px;">👑</div>
                    <span style="background: #f59e0b; color: #ffffff; font-size: 10px; font-weight: 900; padding: 2px 8px; border-radius: 10px; display: inline-block;">${txtBadgeCampeao}</span>
                    <div style="font-size: 16px; font-weight: 800; color: #78350f; margin: 4px 0;">${nomeCampeao} ${idCampeao === idLogado ? '(Você)' : ''}</div>
                    <div style="font-size: 11.5px; color: #92400e; font-weight: 600;">Líder Homologado da Classe ${abaClasseAtivaSaaS}</div>
                </div>

                <div style="display: flex; flex-direction: column; gap: 8px;">
            `;

            // Card do 2º Lugar
            if (idVice) {
                htmlHall += `
                    <div style="background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 12px; padding: 10px 14px; display: flex; align-items: center; justify-content: space-between;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-weight: 800; font-size: 13px; width: 26px; color: #475569;">2º</span>
                            <div>
                                <strong style="font-size: 13px; font-weight: 700; color: #1e293b; display: block;">${nomeVice} ${idVice === idLogado ? '(Você)' : ''}</strong>
                                <span style="font-size: 11px; color: #64748b;">Vice-Líder da Categoria</span>
                            </div>
                        </div>
                    </div>
                `;
            }

            // Card do 3º Lugar
            if (idTerceiro) {
                htmlHall += `
                    <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 12px; padding: 10px 14px; display: flex; align-items: center; justify-content: space-between;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-weight: 800; font-size: 13px; width: 26px; color: #c2410c;">3º</span>
                            <div>
                                <strong style="font-size: 13px; font-weight: 700; color: #1e293b; display: block;">${nomeTerceiro} ${idTerceiro === idLogado ? '(Você)' : ''}</strong>
                                <span style="font-size: 11px; color: #64748b;">3ª Posição Final</span>
                            </div>
                        </div>
                    </div>
                `;
            }

            htmlHall += `</div>`;

            // Lista Oculta e Botão Sanfona (4º em diante)
            if (listaIDs.length > 3) {
                htmlHall += `
                    <div id="box-restante-hall" style="display: none; margin-top: 8px; flex-direction: column; gap: 8px;">
                `;

                for (let i = 3; i < listaIDs.length; i++) {
                    const idOutro = listaIDs[i];
                    const objOutro = (typeof jogadoresGlobal !== 'undefined' && jogadoresGlobal[idOutro]) ? jogadoresGlobal[idOutro] : {};
                    const nomeOutro = capitalizarNome(objOutro.nomeCompleto || objOutro.apelido || 'Atleta');

                    htmlHall += `
                        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px 14px; display: flex; align-items: center; justify-content: space-between;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span style="font-weight: 800; font-size: 13px; width: 26px; color: #64748b;">${i + 1}º</span>
                                <div>
                                    <strong style="font-size: 13px; font-weight: 700; color: #1e293b; display: block;">${nomeOutro} ${idOutro === idLogado ? '(Você)' : ''}</strong>
                                    <span style="font-size: 11px; color: #64748b;">Atleta Homologado</span>
                                </div>
                            </div>
                        </div>
                    `;
                }

                htmlHall += `</div>`;

                htmlHall += `
                    <button type="button" id="btn-sanfona-hall" onclick="toggleSanfonaHallCampeoesSaaS(${listaIDs.length})" style="width: 100%; background: #f1f5f9; border: 1px dashed #cbd5e1; padding: 10px; border-radius: 12px; color: #0284c7; font-weight: 700; font-size: 12.5px; cursor: pointer; margin-top: 10px; display: flex; align-items: center; justify-content: center; gap: 6px;">
                        <span>Ver Classificação Completa (${listaIDs.length} atletas)</span> 🔽
                    </button>
                `;
            }

            bodyList.innerHTML = htmlHall;
            return;
        }

        // ========================================================
        // 🏆 MODELO 1: PIRÂMIDE (ESCADA DE DESAFIOS)
        // ========================================================
        if (modelo === 'piramide') {
            let htmlList = `
                <div class="box-dica-leaderboard">
                    💡 <b>Modelo Pirâmide:</b> Exibe a posição ordinal. As posições destacadas em laranja estão dentro do seu limite de desafio (até 2 acima).
                </div>
            `;
            const idxLogado = listaIDs.indexOf(idLogado);

            listaIDs.forEach((idAtleta, index) => {
                const atleta = (typeof jogadoresGlobal !== 'undefined' && jogadoresGlobal[idAtleta]) ? jogadoresGlobal[idAtleta] : {};
                const pos = index + 1;
                const nomeAtleta = atleta.nomeCompleto || atleta.apelido || 'Atleta do Ranking';

                const ehVoce = (idAtleta === idLogado);
                const noAlcance = (idxLogado !== -1 && index < idxLogado && index >= idxLogado - 2);

                let classeCard = 'item-leaderboard-piramide';
                if (ehVoce) classeCard += ' voce';
                else if (noAlcance) classeCard += ' alcance-desafio';

                htmlList += `
                    <div class="${classeCard}">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <span style="font-weight: 800; font-size: 13px; color: #64748b; width: 24px;">${pos}º</span>
                            <div>
                                <strong style="font-size: 14px; color: #1e293b; display: block;">${nomeAtleta} ${ehVoce ? '(Você)' : ''}</strong>
                                <span style="font-size: 11px; color: #64748b;">${pos === 1 ? 'Líder da Categoria' : (noAlcance ? 'Alcance direto de desafio' : 'Atleta Inscrito')}</span>
                            </div>
                        </div>
                    </div>
                `;
            });

            bodyList.innerHTML = htmlList;

        // ========================================================
        // 🏆 MODELO 2: BARRAGEM (ORDENAÇÃO POR PONTOS & SALDO)
        // ========================================================
        } else if (modelo === 'barragem') {
            listaIDs.sort((a, b) => {
                const stA = estatisticas[a] || { pts: 0, sg: 0, v: 0 };
                const stB = estatisticas[b] || { pts: 0, sg: 0, v: 0 };
                if (stB.pts !== stA.pts) return stB.pts - stA.pts;
                if (stB.sg !== stA.sg) return stB.sg - stA.sg;
                return stB.v - stA.v;
            });

            let htmlTable = `
                <div class="box-dica-leaderboard">
                    💡 <b>Modelo Barragem:</b> Pontos corridos. Vitória = ${ptsVit} pts, Derrota = ${ptsDer} pt. Saldo de Games desempata a classificação.
                </div>

                <table class="tabela-leaderboard-barragem">
                    <thead>
                        <tr>
                            <th style="width: 35px;">POS</th>
                            <th style="text-align: left; padding-left: 8px;">ATLETA</th>
                            <th style="width: 25px;">J</th>
                            <th style="width: 25px;">V</th>
                            <th style="width: 25px;">D</th>
                            <th style="width: 35px;">SG</th>
                            <th style="width: 40px;">PTS</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            listaIDs.forEach((idAtleta, index) => {
                const atleta = (typeof jogadoresGlobal !== 'undefined' && jogadoresGlobal[idAtleta]) ? jogadoresGlobal[idAtleta] : {};
                const st = estatisticas[idAtleta] || { j: 0, v: 0, d: 0, sg: 0, pts: 0 };
                const pos = index + 1;
                const nomeAtleta = atleta.apelido || atleta.nomeCompleto || 'Atleta';
                const ehVoce = (idAtleta === idLogado);

                const sinalSG = st.sg > 0 ? `+${st.sg}` : st.sg;

                htmlTable += `
                    <tr class="${ehVoce ? 'voce' : ''}" style="${ehVoce ? 'background: #f0fdf4;' : ''}">
                        <td><b>${pos}º</b></td>
                        <td style="text-align: left; padding-left: 8px; color: ${ehVoce ? '#15803d' : '#1e293b'}; font-weight: 700;">${nomeAtleta} ${ehVoce ? '(Você)' : ''}</td>
                        <td>${st.j}</td>
                        <td>${st.v}</td>
                        <td>${st.d}</td>
                        <td style="color: ${st.sg > 0 ? '#16a34a' : (st.sg < 0 ? '#dc2626' : '#64748b')}; font-weight: 700;">${sinalSG}</td>
                        <td><span class="badge-pts-leaderboard">${st.pts}</span></td>
                    </tr>
                `;
            });

            htmlTable += `</tbody></table>`;
            bodyList.innerHTML = htmlTable;

        // ========================================================
        // 🏆 MODELO 3: GRUPOS (OPÇÃO 3 VISUAL - LINHA DUPLA & PÍLULAS)
        // ========================================================
        } else if (modelo === 'grupos') {
            const tamanhoGrupo = parseInt(configRanking.grupos?.tamanhoGrupo) || 4;
            const classificadosQtd = parseInt(configRanking.grupos?.classificadosGrupo) || 2;
            const criterioDesempate = configRanking.grupos?.criterioDesempate || 'games_confronto_sorteio';

            let htmlGrupos = `
                <div class="box-dica-leaderboard">
                    💡 <b>Modelo Grupos:</b> Atletas divididos em chaves. Os ${classificadosQtd} primeiros colocados avançam com a tag de Zona de Classificação.
                </div>
            `;
            let numGrupo = 1;

            const txtStatusTag = (faseAtual === 3) ? "Zona de Classificação" : "Classificado";

            for (let i = 0; i < listaIDs.length; i += tamanhoGrupo) {
                const membrosChave = listaIDs.slice(i, i + tamanhoGrupo);

                membrosChave.sort((a, b) => {
                    const stA = estatisticas[a] || { pts: 0, sg: 0, v: 0 };
                    const stB = estatisticas[b] || { pts: 0, sg: 0, v: 0 };

                    if (stB.pts !== stA.pts) return stB.pts - stA.pts;

                    if (criterioDesempate === 'confronto_games') {
                        const vencedorDireto = confrontosDiretos[`${a}_vs_${b}`];
                        if (vencedorDireto) return vencedorDireto === a ? -1 : 1;
                        if (stB.sg !== stA.sg) return stB.sg - stA.sg;
                    } else {
                        if (stB.sg !== stA.sg) return stB.sg - stA.sg;
                        const vencedorDireto = confrontosDiretos[`${a}_vs_${b}`];
                        if (vencedorDireto) return vencedorDireto === a ? -1 : 1;
                    }

                    return stB.v - stA.v;
                });

                htmlGrupos += `
                    <div class="card-leaderboard-grupo">
                        <div class="header-leaderboard-grupo">
                            <span>GRUPO ${numGrupo}</span>
                            <span>Fase de Chaves</span>
                        </div>
                `;

                membrosChave.forEach((idAtleta, idx) => {
                    const atleta = (typeof jogadoresGlobal !== 'undefined' && jogadoresGlobal[idAtleta]) ? jogadoresGlobal[idAtleta] : {};
                    const st = estatisticas[idAtleta] || { j: 0, v: 0, d: 0, sg: 0, pts: 0 };
                    const posInterna = idx + 1;
                    const nomeAtleta = atleta.apelido || atleta.nomeCompleto || 'Atleta';
                    const ehVoce = (idAtleta === idLogado);
                    const isClassificado = posInterna <= classificadosQtd;

                    const temEmpatePontos = membrosChave.some(outroId => outroId !== idAtleta && (estatisticas[outroId]?.pts || 0) === st.pts && st.pts > 0);
                    let exibeConfronto = false;
                    if (temEmpatePontos) {
                        const outrosEmpatados = membrosChave.filter(outroId => outroId !== idAtleta && (estatisticas[outroId]?.pts || 0) === st.pts);
                        exibeConfronto = outrosEmpatados.some(outroId => confrontosDiretos[`${idAtleta}_vs_${outroId}`] === idAtleta);
                    }

                    const sinalSG = st.sg > 0 ? `+${st.sg}` : st.sg;

                    htmlGrupos += `
                        <div class="item-membro-grupo ${isClassificado ? 'classificado' : ''}" style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; ${ehVoce ? 'background: #f0fdf4;' : ''}">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                <div style="font-size: 13px; color: ${ehVoce ? '#15803d' : '#1e293b'}; font-weight: 700;">
                                    <b>${posInterna}º</b> ${nomeAtleta} ${ehVoce ? '(Você)' : ''}
                                    ${isClassificado ? `<span class="badge-classificado">${txtStatusTag}</span>` : ''}
                                </div>
                                <span style="font-size: 14px; font-weight: 800; color: #15803d;">${st.pts} pts</span>
                            </div>
                            <div style="display: flex; gap: 6px;">
                                <span class="micro-pill destaque">SG ${sinalSG}</span>
                                <span class="micro-pill">${st.v}V - ${st.d}D</span>
                                ${exibeConfronto ? '<span class="micro-pill">Confronto ⚔️</span>' : ''}
                            </div>
                        </div>
                    `;
                });

                htmlGrupos += `</div>`;
                numGrupo++;
            }

            bodyList.innerHTML = htmlGrupos;
        }

    } catch (err) {
        console.error("❌ Erro ao renderizar Leaderboard:", err);
        bodyList.innerHTML = '<p style="text-align: center; color: #ef4444; margin-top: 30px;">Erro ao carregar a classificação.</p>';
    }
}

/**
 * Alterna a expansão/recolhimento dos atletas a partir do 4º lugar no Hall de Campeões
 */
function toggleSanfonaHallCampeoesSaaS(totalAtletas) {
    const boxResto = document.getElementById('box-restante-hall');
    const btn = document.getElementById('btn-sanfona-hall');

    if (!boxResto || !btn) return;

    if (boxResto.style.display === 'none') {
        boxResto.style.display = 'flex';
        btn.innerHTML = '<span>Recolher Lista</span> 🔼';
    } else {
        boxResto.style.display = 'none';
        btn.innerHTML = `<span>Ver Classificação Completa (${totalAtletas} atletas)</span> 🔽`;
    }
}

function trocarClasseLeaderboardSaaS(cls) {
    abaClasseAtivaSaaS = cls;
    renderizarLeaderboardSaaS();
}

function trocarGeneroLeaderboardSaaS(gen) {
    abaGeneroAtivaSaaS = gen;
    renderizarLeaderboardSaaS();
}


/* ======================================================== */
/* AUXILIAR: RESOLUÇÃO ROBUSTA DE ID DE ATLETA              */
/* ======================================================== */
function obterIdJogadorPorTextoSaaS(textoNomeOuApelido) {
    if (!textoNomeOuApelido || typeof jogadoresGlobal === 'undefined' || !jogadoresGlobal) return null;
    const norm = (txt) => (txt || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9 ]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toUpperCase();

    const alvo = norm(textoNomeOuApelido);
    if (!alvo) return null;

    return Object.keys(jogadoresGlobal).find(id => {
        const j = jogadoresGlobal[id];
        if (!j) return false;
        return norm(j.nomeCompleto) === alvo || norm(j.apelido) === alvo;
    }) || null;
}

/* ======================================================== */
/* 9. ENGINE DE PROCESSAMENTO DE RESULTADOS DO RANKING       */
/* ======================================================== */

/* 9.1 ROTEADOR GERAL DE PROCESSAMENTO */
async function processarResultadoRankingSaaS(reservaConsolidada) {
    if (!reservaConsolidada || !raizBanco) return;

    try {
        const snapConfig = await database.ref(`${raizBanco}/config/ranking`).once('value');
        const configRanking = snapConfig.val() || {};
        const modeloAtivo = configRanking.modeloAtivo || 'piramide';

        if (modeloAtivo === 'piramide') {
            await processarResultadoPiramideSaaS(reservaConsolidada, configRanking);
        } else if (modeloAtivo === 'barragem') {
            await processarResultadoBarragemSaaS(reservaConsolidada, configRanking);
        } else if (modeloAtivo === 'grupos') {
            await processarResultadoGruposSaaS(reservaConsolidada, configRanking);
        }
    } catch (err) {
        console.error("❌ [Ranking Engine] Erro ao processar resultado:", err);
    }
}

/* 9.2 MOTOR DO MODELO PIRÂMIDE (ESCADA) */
async function processarResultadoPiramideSaaS(reserva, configRanking) {
    const dadosPlacar = reserva.dadosPlacar;
    if (!dadosPlacar || !dadosPlacar.vencedor) return;

    const piramideConfig = configRanking.piramide || {};
    const mecanicaTroca = piramideConfig.mecanicaTroca || 'direta';
    const divGenero = configRanking.divisaoGenero || 'separado';

    const listaApelidosStr = (reserva.jogadores || "").split(',').map(s => s.trim());
    const listaCompletosStr = (reserva.jogadores_completo || "").split(',').map(s => s.trim());

    const idJ1 = obterIdJogadorPorTextoSaaS(listaCompletosStr[0] || listaApelidosStr[0]);
    const idJ2 = obterIdJogadorPorTextoSaaS(listaCompletosStr[1] || listaApelidosStr[1]);

    if (!idJ1 || !idJ2) return;

    const atletaBase = jogadoresGlobal[idJ1] || {};
    const classe = (atletaBase.classe || 'B').toUpperCase();
    let generoKey = (atletaBase.genero || 'MASCULINO').toUpperCase();

    const chaveTabela = (divGenero === 'unificado') ? `${classe}_UNIFICADO` : `${classe}_${generoKey}`;
    const refTabela = `${raizBanco}/ranking/tabelas/${chaveTabela}`;

    const snapTabela = await database.ref(refTabela).once('value');
    let listaIDs = snapTabela.exists() ? snapTabela.val() : [];

    if (!Array.isArray(listaIDs)) return;

    const idxJ1 = listaIDs.indexOf(idJ1);
    const idxJ2 = listaIDs.indexOf(idJ2);

    if (idxJ1 === -1 || idxJ2 === -1) return;

    const idxDesafiante = Math.max(idxJ1, idxJ2);
    const idxDesafiado = Math.min(idxJ1, idxJ2);
    const idDesafiante = listaIDs[idxDesafiante];

    const venciCodigo = dadosPlacar.vencedorCodigo;
    let idVencedor = (venciCodigo === 'J1') ? idJ1 : (venciCodigo === 'J2' ? idJ2 : null);

    if (!idVencedor && dadosPlacar.vencedor) {
        idVencedor = obterIdJogadorPorTextoSaaS(dadosPlacar.vencedor);
    }

    if (idVencedor === idDesafiante) {
        if (mecanicaTroca === 'escada') {
            const [desafianteID] = listaIDs.splice(idxDesafiante, 1);
            listaIDs.splice(idxDesafiado, 0, desafianteID);
        } else {
            const temp = listaIDs[idxDesafiante];
            listaIDs[idxDesafiante] = listaIDs[idxDesafiado];
            listaIDs[idxDesafiado] = temp;
        }

        await database.ref(refTabela).set(listaIDs);
    }
}

/* 9.3 MOTOR DO MODELO BARRAGEM (PONTOS CORRIDOS) */
async function processarResultadoBarragemSaaS(reserva, configRanking) {
    const dadosPlacar = reserva.dadosPlacar;
    if (!dadosPlacar || !dadosPlacar.vencedor) return;

    const divGenero = configRanking.divisaoGenero || 'separado';
    const ptsVit = parseInt(configRanking.barragem?.pontosVitoria) || 3;
    const ptsDer = parseInt(configRanking.barragem?.pontosDerrota) || 1;

    const listaApelidosStr = (reserva.jogadores || "").split(',').map(s => s.trim());
    const listaCompletosStr = (reserva.jogadores_completo || "").split(',').map(s => s.trim());

    const idJ1 = obterIdJogadorPorTextoSaaS(listaCompletosStr[0] || listaApelidosStr[0]);
    const idJ2 = obterIdJogadorPorTextoSaaS(listaCompletosStr[1] || listaApelidosStr[1]);

    if (!idJ1 || !idJ2) return;

    const atletaBase = jogadoresGlobal[idJ1] || {};
    const classe = (atletaBase.classe || 'B').toUpperCase();
    let generoKey = (atletaBase.genero || 'MASCULINO').toUpperCase();

    const chaveTabela = (divGenero === 'unificado') ? `${classe}_UNIFICADO` : `${classe}_${generoKey}`;

    const venciCodigo = dadosPlacar.vencedorCodigo;
    let idVencedor = (venciCodigo === 'J1') ? idJ1 : (venciCodigo === 'J2' ? idJ2 : null);

    if (!idVencedor && dadosPlacar.vencedor) {
        idVencedor = obterIdJogadorPorTextoSaaS(dadosPlacar.vencedor);
    }

    let gamesP1 = 0;
    let gamesP2 = 0;

    if (dadosPlacar.parciais) {
        Object.values(dadosPlacar.parciais).forEach(st => {
            gamesP1 += parseInt(st.j1) || 0;
            gamesP2 += parseInt(st.j2) || 0;
        });
    }

    // 1. Grava ou atualiza a partida finalizada
    let quadraKey = "Quadra1";
    if (reserva.quadra) {
        const match = reserva.quadra.match(/\d+/);
        quadraKey = match ? `Quadra${match[0]}` : reserva.quadra;
    }

    const partidaId = `partida_${chaveTabela}_${quadraKey}_${reserva.dia}_${reserva.hora}_${idJ1}_${idJ2}`;
    const refPartida = `${raizBanco}/ranking/partidas/${partidaId}`;

    const payloadPartida = {
        categoria: chaveTabela,
        status: 'finalizada',
        jogador1Id: idJ1,
        jogador2Id: idJ2,
        vencedorId: idVencedor,
        gamesP1: gamesP1,
        gamesP2: gamesP2,
        dataHora: Date.now()
    };

    await database.ref(refPartida).set(payloadPartida);

    // 2. Busca o histórico de partidas da categoria e a tabela de inscritos
    const [snapPartidas, snapTabela] = await Promise.all([
        database.ref(`${raizBanco}/ranking/partidas`).once('value'),
        database.ref(`${raizBanco}/ranking/tabelas/${chaveTabela}`).once('value')
    ]);

    const partidasGlobal = snapPartidas.exists() ? snapPartidas.val() : {};
    let listaIDs = snapTabela.exists() ? snapTabela.val() : [];

    if (!Array.isArray(listaIDs) || listaIDs.length === 0) return;

    // 3. Processa pontuação, saldo de games e vitórias de cada atleta
    const estatisticas = {};
    listaIDs.forEach(id => {
        estatisticas[id] = { j: 0, v: 0, d: 0, sg: 0, pts: 0 };
    });

    Object.values(partidasGlobal).forEach(partida => {
        if (partida.status === 'finalizada' && partida.categoria === chaveTabela) {
            const p1 = partida.jogador1Id;
            const p2 = partida.jogador2Id;
            const vitorioso = partida.vencedorId;
            const g1 = parseInt(partida.gamesP1) || 0;
            const g2 = parseInt(partida.gamesP2) || 0;

            if (estatisticas[p1]) {
                estatisticas[p1].j++;
                estatisticas[p1].sg += (g1 - g2);
                if (vitorioso === p1) { estatisticas[p1].v++; estatisticas[p1].pts += ptsVit; }
                else { estatisticas[p1].d++; estatisticas[p1].pts += ptsDer; }
            }

            if (estatisticas[p2]) {
                estatisticas[p2].j++;
                estatisticas[p2].sg += (g2 - g1);
                if (vitorioso === p2) { estatisticas[p2].v++; estatisticas[p2].pts += ptsVit; }
                else { estatisticas[p2].d++; estatisticas[p2].pts += ptsDer; }
            }
        }
    });

    // 4. Reordena a lista oficial de inscritos (PTS > SG > Vitórias)
    listaIDs.sort((a, b) => {
        const stA = estatisticas[a] || { pts: 0, sg: 0, v: 0 };
        const stB = estatisticas[b] || { pts: 0, sg: 0, v: 0 };
        if (stB.pts !== stA.pts) return stB.pts - stA.pts;
        if (stB.sg !== stA.sg) return stB.sg - stA.sg;
        return stB.v - stA.v;
    });

    // 5. Salva a lista reordenada no banco de dados
    await database.ref(`${raizBanco}/ranking/tabelas/${chaveTabela}`).set(listaIDs);
}

/* 9.4 MOTOR DO MODELO GRUPOS (FASE DE CHAVES - VERSÃO IDEAL COMBINADA) */
async function processarResultadoGruposSaaS(reserva, configRanking) {
    const dadosPlacar = reserva.dadosPlacar;
    if (!dadosPlacar || !dadosPlacar.vencedor) return;

    const divGenero = configRanking.divisaoGenero || 'separado';
    const tamanhoGrupo = parseInt(configRanking.grupos?.tamanhoGrupo) || 4;
    const ptsVit = parseInt(configRanking.grupos?.pontosVitoria) || 3;
    const ptsDer = parseInt(configRanking.grupos?.pontosDerrota) || 1;
    const criterioDesempate = configRanking.grupos?.criterioDesempate || 'games_confronto_sorteio';

    const listaApelidosStr = (reserva.jogadores || "").split(',').map(s => s.trim());
    const listaCompletosStr = (reserva.jogadores_completo || "").split(',').map(s => s.trim());

    const idJ1 = obterIdJogadorPorTextoSaaS(listaCompletosStr[0] || listaApelidosStr[0]);
    const idJ2 = obterIdJogadorPorTextoSaaS(listaCompletosStr[1] || listaApelidosStr[1]);

    if (!idJ1 || !idJ2) return;

    const atletaBase = jogadoresGlobal[idJ1] || {};
    const classe = (atletaBase.classe || 'B').toUpperCase();
    let generoKey = (atletaBase.genero || 'MASCULINO').toUpperCase();

    const chaveTabela = (divGenero === 'unificado') ? `${classe}_UNIFICADO` : `${classe}_${generoKey}`;

    const venciCodigo = dadosPlacar.vencedorCodigo;
    let idVencedor = (venciCodigo === 'J1') ? idJ1 : (venciCodigo === 'J2' ? idJ2 : null);

    if (!idVencedor && dadosPlacar.vencedor) {
        idVencedor = obterIdJogadorPorTextoSaaS(dadosPlacar.vencedor);
    }

    let gamesP1 = 0;
    let gamesP2 = 0;

    if (dadosPlacar.parciais) {
        Object.values(dadosPlacar.parciais).forEach(st => {
            gamesP1 += parseInt(st.j1) || 0;
            gamesP2 += parseInt(st.j2) || 0;
        });
    }

    // 1. Grava a partida finalizada no histórico
    let quadraKey = "Quadra1";
    if (reserva.quadra) {
        const match = reserva.quadra.match(/\d+/);
        quadraKey = match ? `Quadra${match[0]}` : reserva.quadra;
    }

    const partidaId = `partida_${chaveTabela}_${quadraKey}_${reserva.dia}_${reserva.hora}_${idJ1}_${idJ2}`;
    const refPartida = `${raizBanco}/ranking/partidas/${partidaId}`;

    const payloadPartida = {
        categoria: chaveTabela,
        status: 'finalizada',
        jogador1Id: idJ1,
        jogador2Id: idJ2,
        vencedorId: idVencedor,
        gamesP1: gamesP1,
        gamesP2: gamesP2,
        dataHora: Date.now()
    };

    await database.ref(refPartida).set(payloadPartida);

    // 2. Leitura síncrona de partidas e tabela
    const [snapPartidas, snapTabela] = await Promise.all([
        database.ref(`${raizBanco}/ranking/partidas`).once('value'),
        database.ref(`${raizBanco}/ranking/tabelas/${chaveTabela}`).once('value')
    ]);

    const partidasGlobal = snapPartidas.exists() ? snapPartidas.val() : {};
    let listaIDs = snapTabela.exists() ? snapTabela.val() : [];

    if (!Array.isArray(listaIDs) || listaIDs.length === 0) return;

    // 3. Processamento de estatísticas e mapeamento de confronto direto
    const estatisticas = {};
    const confrontosDiretos = {};

    listaIDs.forEach(id => {
        estatisticas[id] = { j: 0, v: 0, d: 0, sg: 0, pts: 0 };
    });

    Object.values(partidasGlobal).forEach(partida => {
        if (partida.status === 'finalizada' && partida.categoria === chaveTabela) {
            const p1 = partida.jogador1Id;
            const p2 = partida.jogador2Id;
            const vitorioso = partida.vencedorId;
            const g1 = parseInt(partida.gamesP1) || 0;
            const g2 = parseInt(partida.gamesP2) || 0;

            // Registra confronto direto
            confrontosDiretos[`${p1}_vs_${p2}`] = vitorioso;
            confrontosDiretos[`${p2}_vs_${p1}`] = vitorioso;

            if (estatisticas[p1]) {
                estatisticas[p1].j++;
                estatisticas[p1].sg += (g1 - g2);
                if (vitorioso === p1) { estatisticas[p1].v++; estatisticas[p1].pts += ptsVit; }
                else { estatisticas[p1].d++; estatisticas[p1].pts += ptsDer; }
            }

            if (estatisticas[p2]) {
                estatisticas[p2].j++;
                estatisticas[p2].sg += (g2 - g1);
                if (vitorioso === p2) { estatisticas[p2].v++; estatisticas[p2].pts += ptsVit; }
                else { estatisticas[p2].d++; estatisticas[p2].pts += ptsDer; }
            }
        }
    });

    // 4. Ordenação ISOLADA dentro de cada grupo (Chave)
    const novaListaOrdenada = [];
    for (let i = 0; i < listaIDs.length; i += tamanhoGrupo) {
        const membrosChave = listaIDs.slice(i, i + tamanhoGrupo);

        membrosChave.sort((a, b) => {
            const stA = estatisticas[a] || { pts: 0, sg: 0, v: 0 };
            const stB = estatisticas[b] || { pts: 0, sg: 0, v: 0 };

            // 1º Critério: Pontuação no Grupo
            if (stB.pts !== stA.pts) return stB.pts - stA.pts;

            // 2º Critério: Desempate por Confronto Direto ou Saldo de Games
            if (criterioDesempate === 'confronto_games') {
                const vencedorDireto = confrontosDiretos[`${a}_vs_${b}`];
                if (vencedorDireto) return vencedorDireto === a ? -1 : 1;
                if (stB.sg !== stA.sg) return stB.sg - stA.sg;
            } else {
                if (stB.sg !== stA.sg) return stB.sg - stA.sg;
                const vencedorDireto = confrontosDiretos[`${a}_vs_${b}`];
                if (vencedorDireto) return vencedorDireto === a ? -1 : 1;
            }

            return stB.v - stA.v;
        });

        novaListaOrdenada.push(...membrosChave);
    }

    // 5. Atualiza a tabela preservando a separação exata das chaves no banco
    await database.ref(`${raizBanco}/ranking/tabelas/${chaveTabela}`).set(novaListaOrdenada);
}


/* 9.5 ZERAR / REINICIAR RANKING (COM AUDITORIA DINÂMICA DE DADOS) */

/* AUXILIAR: RESETA OS CAMPOS DO FORMULÁRIO DA FASE 1 */
function limparFormularioFase1SaaS() {
    const elNome = document.getElementById('inp-torneio-nome');
    const elModelo = document.getElementById('inp-torneio-modelo');
    const elVagas = document.getElementById('inp-torneio-vagas');
    const elDtIncIni = document.getElementById('inp-torneio-dt-inc-ini');
    const elDtIncFim = document.getElementById('inp-torneio-dt-inc-fim');
    const elDtJogIni = document.getElementById('inp-torneio-dt-jog-ini');
    const elDtJogFim = document.getElementById('inp-torneio-dt-jog-fim');
    const lblPdf = document.getElementById('pdf-file-name');

    if (elNome) elNome.value = '';
    if (elModelo) elModelo.selectedIndex = 0;
    if (elVagas) elVagas.value = '';
    if (elDtIncIni) elDtIncIni.value = '';
    if (elDtIncFim) elDtIncFim.value = '';
    if (elDtJogIni) elDtJogIni.value = '';
    if (elDtJogFim) elDtJogFim.value = '';

    if (lblPdf) {
        lblPdf.innerText = 'Nenhum arquivo anexado (Opcional)';
        lblPdf.style.color = '#64748b';
        lblPdf.style.fontWeight = '400';
    }

    // Desmarca todas as pílulas de categorias
    document.querySelectorAll('#container-pills-categorias .pilula-check').forEach(p => {
        p.classList.remove('ativa');
        const ico = p.querySelector('.material-icons');
        if (ico) ico.textContent = 'add_circle_outline';
    });
}

async function zerarRankingSaaS() {
    if (!isGestorLogado || !raizBanco) {
        showToast("Apenas o gestor do clube pode zerar o ranking.", "error");
        return;
    }

    try {
        if (navigator.vibrate) navigator.vibrate(30);
        showToast("Analisando dados do ranking...", "info");

        // 1. Leitura fotográfica dos dados para auditoria prévia
        const [snapPartidas, snapTabelas, snapConvites, snapReservas, snapJogadores, snapConfig] = await Promise.all([
            database.ref(`${raizBanco}/ranking/partidas`).once('value'),
            database.ref(`${raizBanco}/ranking/tabelas`).once('value'),
            database.ref(`${raizBanco}/convites_ranking`).once('value'),
            database.ref(`${raizBanco}/reservas`).once('value'),
            database.ref(`${raizBanco}/jogadores`).once('value'),
            database.ref(`${raizBanco}/config/ranking`).once('value')
        ]);

        const partidas = snapPartidas.val() || {};
        const tabelas = snapTabelas.val() || {};
        const convites = snapConvites.val() || {};
        const reservas = snapReservas.val() || {};
        const jogadores = snapJogadores.val() || {};
        const configRanking = snapConfig.val() || {};

        const faseAtual = parseInt(configRanking.faseAtual, 10) || 1;
        const temCalendario = !!configRanking.calendario;

        // 2. Contagem minuciosa dos registros atrelados ao ranking
        const totalPartidas = Object.keys(partidas).length;

        let totalInscritos = 0;
        Object.values(tabelas).forEach(arr => {
            if (Array.isArray(arr)) totalInscritos += arr.length;
        });

        let totalReservasRanking = 0;
        const caminhosReservasExcluir = [];
        Object.keys(reservas).forEach(quadraKey => {
            const slots = reservas[quadraKey] || {};
            Object.keys(slots).forEach(slotKey => {
                const r = slots[slotKey];
                if (r && (r.isRanking === true || r.isRanking === 'true' || r.tipo === 'ranking')) {
                    // Adiciona TODOS os slots para expurgar do Firebase
                    caminhosReservasExcluir.push(`reservas/${quadraKey}/${slotKey}`);

                    // Ignora o segundo slot de reservas de 2h apenas para a contagem visual
                    if (r.borda === undefined && parseInt(r.duracao) === 2) {
                        return;
                    }

                    totalReservasRanking++;
                }
            });
        });

        let totalNotificacoes = 0;
        const caminhosNotificacoesExcluir = [];
        Object.keys(jogadores).forEach(idJog => {
            if (jogadores[idJog] && jogadores[idJog].notificacoes) {
                const keysNotif = Object.keys(jogadores[idJog].notificacoes);
                totalNotificacoes += keysNotif.length;
                caminhosNotificacoesExcluir.push(`jogadores/${idJog}/notificacoes`);
            }
        });

        const totalGeral = totalPartidas + totalInscritos + totalReservasRanking;

        // 3. Trava de segurança: impede execução se já estiver em estado zero na Fase 1
        if (totalGeral === 0 && !snapConvites.exists() && faseAtual === 1 && !temCalendario) {
            showToast("O ranking já se encontra completamente zerado.", "info");
            return;
        }

        // 4. Montagem do balanço minucioso para o Gestor
        const promptHTML = `
            <div style="text-align: left; font-size: 14px; color: #334155; line-height: 1.5;">
                <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px; margin-bottom: 12px;">
                    <strong style="color: #dc2626; display: block; font-size: 13px; text-transform: uppercase; margin-bottom: 4px;">
                        ⚠️ Ação Irreversível de Zeramento
                    </strong>
                    <span style="font-size: 13px; color: #7f1d1d;">
                        Foram localizados registros ativos referentes à temporada em andamento.
                    </span>
                </div>

                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 12px;">
                    <strong style="color: #475569; display: block; font-size: 12px; text-transform: uppercase; margin-bottom: 6px;">
                        Balanço de Dados que serão apagados:
                    </strong>
                    <ul style="margin: 0; padding-left: 18px; font-size: 13px; color: #1e293b;">
                        <li><b>${totalPartidas}</b> partida(s) finalizada(s) no histórico;</li>
                        <li><b>${totalInscritos}</b> inscrição(ões) nas tabelas de categorias;</li>
                        <li><b>${totalReservasRanking}</b> agendamento(s) de ranking nas quadras;</li>
                        <li><b>${totalNotificacoes}</b> notificação(ões) nas caixas dos atletas;</li>
                        <li>Contrato de calendário e inscrições ativas.</li>
                    </ul>
                </div>

                <p style="margin: 0; font-size: 12.5px; color: #64748b; font-weight: 500;">
                    <b>Nota de Segurança:</b> Reservas comuns dos sócios (1h e 2h) não serão afetadas. Deseja prosseguir?
                </p>
            </div>
        `;

        showPrompt("Balanço do Zeramento do Ranking", promptHTML, async () => {
            try {
                if (navigator.vibrate) navigator.vibrate(50);

                const updates = {};
                // Reset absoluto do contrato e fase no config/ranking
                updates['config/ranking/faseAtual'] = 1;
                updates['config/ranking/calendario'] = null;
                updates['config/ranking/inscritosConfirmados'] = null;

                // Expurgo das tabelas operacionais
                updates['ranking/partidas'] = null;
                updates['ranking/tabelas'] = null;
                updates['convites_ranking'] = null;

                caminhosReservasExcluir.forEach(path => { updates[path] = null; });
                caminhosNotificacoesExcluir.forEach(path => { updates[path] = null; });

                await database.ref(raizBanco).update(updates); 

                // Limpa visualmente o formulário da Fase 1 no navegador
                limparFormularioFase1SaaS();

                showToast("Ranking zerado com sucesso! Módulo retornado à Fase 1.", "success");

                if (typeof renderizarGestaoTemporadaSaaS === 'function') {
                    renderizarGestaoTemporadaSaaS();
                }
                if (typeof atualizarBotaoRodapeRankingSaaS === 'function') {
                    atualizarBotaoRodapeRankingSaaS();
                }

            } catch (err) {
                console.error("❌ [Ranking] Erro ao aplicar zeramento:", err);
                showToast("Erro ao zerar o ranking no banco de dados.", "error");
            }
        });

    } catch (err) {
        console.error("❌ [Ranking] Erro ao ler balanço para zeramento:", err);
        showToast("Erro ao auditar dados do ranking no banco.", "error");
    }
}

/* ======================================================== */
/* 10. ESTEIRA DINÂMICA DA TEMPORADA (MÁQUINA DE ESTADOS)   */
/* ======================================================== */

function renderizarGestaoTemporadaSaaS() {
    const containerStepper = document.getElementById('stepper-gestor-container');
    const cardResumo = document.getElementById('card-resumo-calendario-saas');
    if (!containerStepper) return;

    const conf = (configRegrasGlobal && configRegrasGlobal.ranking) ? configRegrasGlobal.ranking : {};
    const modelo = conf.modeloAtivo || "grupos";
    const faseAtual = parseInt(conf.faseAtual, 10) || 1;
    const cal = conf.calendario || {};

    // 1. Rótulos das Fases por Modelo de Disputa
    const rotulosPorModelo = {
        grupos: ["1. Calendário", "2. Inscrições", "3. Chaves", "4. Mata-Mata", "5. Concluído"],
        barragem: ["1. Calendário", "2. Inscrições", "3. Pontos Corridos", "4. Concluído"],
        piramide: ["1. Calendário", "2. Inscrições", "3. Escada", "4. Concluído"]
    };

    const listaRotulos = rotulosPorModelo[modelo] || rotulosPorModelo.grupos;

    // 2. Desenha o Stepper (INDICADOR 100% VISUAL - SEM ONCLICK)
    let htmlStepper = '';
    listaRotulos.forEach((rotulo, index) => {
        const numFase = index + 1;
        let classeNode = 'step-node';
        let conteudoCirculo = numFase;

        if (numFase < faseAtual) {
            classeNode += ' concluido';
            conteudoCirculo = '<i class="material-icons" style="font-size: 16px;">check</i>';
        } else if (numFase === faseAtual) {
            classeNode += ' ativo';
        }

        htmlStepper += `
            <div class="${classeNode}" style="cursor: default;">
                <div class="step-circle">${conteudoCirculo}</div>
                <span class="step-label">${rotulo}</span>
            </div>
        `;
    });
    containerStepper.innerHTML = htmlStepper;

    // 3. Mapeamento de Painéis: Pirâmide e Barragem usam a tela de Concluído (Painel 5) quando na Fase 4
    const painelAlvo = (modelo !== "grupos" && faseAtual === 4) ? 5 : faseAtual;
    document.querySelectorAll('#container-fases-gestor .fase-panel').forEach((panel, idx) => {
        if ((idx + 1) === painelAlvo) {
            panel.classList.add('ativa');
        } else {
            panel.classList.remove('ativa');
        }
    });

    // 3.1 DINAMIZAÇÃO ESPECÍFICA DO PAINEL DA FASE 3
    const panelFase3 = document.querySelectorAll('#container-fases-gestor .fase-panel')[2];
    if (panelFase3) {
        // Seleciona o aviso principal
        const elBoxAviso = panelFase3.children[0];
        
        // Seleciona o botão interno do modelo de Grupos
        const btnAcaoFase3 = panelFase3.querySelector('button[onclick*="encerrarFase3EAvancarSaaS"]');

        if (elBoxAviso) {
            if (modelo === 'barragem') {
                elBoxAviso.innerHTML = `
                    <p style="margin: 0 0 4px 0; font-weight: 700; color: #166534;">📍 Fase 3: Disputa por Pontos Corridos (Barragem)</p>
                    <span style="display: block; font-size: 12.5px; color: #15803d; line-height: 1.4;">• Atletas somam pontos a cada partida realizada na temporada.</span>
                    <span style="display: block; font-size: 12.5px; color: #15803d; line-height: 1.4;">• Acompanhe a tabela do Leaderboard em tempo real e encerre ao fim do prazo.</span>
                `;
            } else if (modelo === 'piramide') {
                elBoxAviso.innerHTML = `
                    <p style="margin: 0 0 4px 0; font-weight: 700; color: #166534;">📍 Fase 3: Escada de Desafios (Pirâmide)</p>
                    <span style="display: block; font-size: 12.5px; color: #15803d; line-height: 1.4;">• Atletas realizam desafios diretos para trocar de posição e subir na tabela.</span>
                    <span style="display: block; font-size: 12.5px; color: #15803d; line-height: 1.4;">• Acompanhe a movimentação em tempo real e encerre no prazo.</span>
                `;
            } else {
                elBoxAviso.innerHTML = `
                    <p style="margin: 0 0 4px 0; font-weight: 700; color: #166534;">📍 Fase 3: Fase de Chaves (Grupos)</p>
                    <span style="display: block; font-size: 12.5px; color: #15803d; line-height: 1.4;">• Grupos congelados no banco e agendamentos restritos aos adversários da mesma chave.</span>
                    <span style="display: block; font-size: 12.5px; color: #15803d; line-height: 1.4;">• Acompanhe a classificação em tempo real e encerre ao fim das rodadas.</span>
                `;
            }
        }

        // Exibe o botão do meio APENAS no modelo Grupos (sem gambiarra de setAttribute)
        // Garante que o botão central fique oculto, mantendo a ação concentrada no rodapé
        if (btnAcaoFase3) {
            btnAcaoFase3.style.display = 'none';
        }
    }

    // 3.2 Oculta o botão duplicado de dentro do painel 5 se o botão fixo do rodapé já estiver ativo
    const panelFase5 = document.getElementById('fase-panel-5');
    if (panelFase5) {
        const btnPainelAbrir = panelFase5.querySelector('button[onclick*="reiniciarEsteiraNovoTorneioSaaS"]');
        if (btnPainelAbrir) {
            btnPainelAbrir.style.display = 'none';
        }
    }

    // 4. Preenche o Card de Resumo Fixo do Calendário (Exibido a partir da Fase 2)
    if (cardResumo) {
        if (faseAtual > 1 && cal.nomeTorneio) {
            const fmtData = (str) => str ? str.split('-').reverse().join('/') : '--/--';
            const dtInc = `${fmtData(cal.inicioInscricoes)} a ${fmtData(cal.fimInscricoes)}`;
            const dtJog = `${fmtData(cal.inicioJogos)} a ${fmtData(cal.fimTorneio)}`;

            const nomesModelosLegiveis = {
                piramide: "Pirâmide",
                barragem: "Barragem",
                grupos: "Grupos"
            };
            const txtModeloExibicao = nomesModelosLegiveis[modelo] || "Oficial";

            const elNomeTorneio = document.getElementById('lbl-resumo-torneio-nome');
            if (elNomeTorneio) {
                elNomeTorneio.innerHTML = `${cal.nomeTorneio} <span style="font-size: 11px; background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 12px; margin-left: 6px; font-weight: 700; display: inline-flex; align-items: center; gap: 3px;">⚔️ Modelo: ${txtModeloExibicao}</span>`;
            }

            document.getElementById('lbl-resumo-torneio-insc').textContent = dtInc;
            document.getElementById('lbl-resumo-torneio-jog').textContent = dtJog;

            // 🛑 Oculta o botão Editar se o torneio já estiver concluído/homologado
            const btnEditarResumo = cardResumo.querySelector('button[onclick*="editarCalendarioAtivoSaaS"]') || cardResumo.querySelector('.btn-editar');
            if (btnEditarResumo) {
                const torneioConcluido = (modelo !== "grupos" && faseAtual >= 4) || (modelo === "grupos" && faseAtual >= 5);
                btnEditarResumo.style.setProperty('display', torneioConcluido ? 'none' : 'inline-flex', 'important');
            }

            cardResumo.style.display = 'flex';
        } else {
            cardResumo.style.display = 'none';
        }
    }

    // 5. ATUALIZA CONTADOR DE INSCRITOS, RÓTULO DINÂMICO E BOTÕES DA FASE 2
    const inscritos = conf.inscritosConfirmados || {};
    const qtdInscritos = Object.keys(inscritos).length;

    const lblBadge = document.getElementById('lbl-qtd-inscritos-badge');
    const btnInscritos = document.getElementById('btn-saas-fase2-inscritos');
    const btnEncerrar = document.getElementById('btn-saas-fase2-encerrar');
    const btnConvites = document.getElementById('btn-saas-fase2-convites');

    if (lblBadge) lblBadge.textContent = qtdInscritos;
    if (btnInscritos) btnInscritos.disabled = (qtdInscritos === 0);
    if (btnEncerrar) btnEncerrar.disabled = (qtdInscritos === 0); 

    if (btnConvites) {
        if (qtdInscritos > 0) {
            btnConvites.innerHTML = '<i class="material-icons">mark_email_read</i> Repescagem / Enviar a Novos Sócios';
        } else {
            btnConvites.innerHTML = '<i class="material-icons">send</i> Disparar Convites aos Sócios';
        }
    }

    // 6. Exibe o Botão Zerar/Reiniciar APENAS nas Fases em Andamento (Fases 2 e 3)
    const btnZerar = document.querySelector('#modal-config-ranking .btn-ranking-reset');
    if (btnZerar && btnZerar.parentElement) {
        const torneioConcluido = (modelo !== "grupos" && faseAtual >= 4) || (modelo === "grupos" && faseAtual >= 5);
        const exibirZerar = (faseAtual > 1 && !torneioConcluido);
        btnZerar.parentElement.style.display = exibirZerar ? 'block' : 'none';
    }
}

/* ======================================================== */
/* 10.1 GRAVAÇÃO E EDIÇÃO DO CALENDÁRIO (FASE 1)            */
/* ======================================================== */

/**
 * Atualiza o rótulo visual do arquivo PDF selecionado
 */
function atualizarStatusPdfSaaS(input) {
    const lbl = document.getElementById('pdf-file-name');
    if (!lbl) return;

    if (input.files && input.files[0]) {
        const file = input.files[0];
        lbl.innerText = `📄 ${file.name} (${(file.size / 1024).toFixed(0)} KB - Pronto para upload)`;
        lbl.style.color = '#15803d';
        lbl.style.fontWeight = '700';
    } else {
        lbl.innerText = 'Nenhum arquivo anexado (Opcional)';
        lbl.style.color = '#64748b';
        lbl.style.fontWeight = '400';
    }
}

/**
 * Salva o contrato mestre da edição revalidando todos os campos obrigatórios (*) e avança para a Fase 2
 */
function salvarCalendarioEAbrirInscricoesSaaS() {
    if (!isGestorLogado || !raizBanco) {
        showToast("Apenas o gestor pode alterar o calendário do torneio.", "warning");
        return;
    }

    const nome = document.getElementById('inp-torneio-nome').value.trim();
    const modeloDisputa = document.getElementById('inp-torneio-modelo').value;
    const vagasRaw = document.getElementById('inp-torneio-vagas').value.trim();

    // 1. Captura as pílulas de categorias/gêneros selecionadas
    const pillsAtivas = document.querySelectorAll('#container-pills-categorias .pilula-check.ativa');
    const categoriasHabilitadas = [];
    pillsAtivas.forEach(p => {
        const cat = p.getAttribute('data-cat');
        if (cat) categoriasHabilitadas.push(cat);
    });

    const dtIncIni = document.getElementById('inp-torneio-dt-inc-ini').value;
    const dtIncFim = document.getElementById('inp-torneio-dt-inc-fim').value;
    const dtJogIni = document.getElementById('inp-torneio-dt-jog-ini').value;
    const dtJogFim = document.getElementById('inp-torneio-dt-jog-fim').value;

    // 2. Validações Estritas de Campos Obrigatórios (*)
    if (!nome) {
        showToast("Preencha o Nome Oficial do Torneio.", "warning");
        return;
    }

    if (!modeloDisputa) {
        showToast("Selecione o Modelo de Disputa da Edição.", "warning");
        return;
    }

    if (vagasRaw === "") {
        showToast("Informe o limite de vagas (digite 0 para ilimitado).", "warning");
        return;
    }

    const limiteVagas = parseInt(vagasRaw, 10);
    if (isNaN(limiteVagas) || limiteVagas < 0) {
        showToast("Informe um número de vagas válido (0 para ilimitado).", "warning");
        return;
    }

    if (categoriasHabilitadas.length === 0) {
        showToast("Selecione ao menos uma Classe ou Gênero nas pílulas habilitadas.", "warning");
        return;
    }

    if (!dtIncIni || !dtIncFim || !dtJogIni || !dtJogFim) {
        showToast("Preencha todas as 4 datas oficiais do calendário.", "warning");
        return;
    }

    if (navigator.vibrate) navigator.vibrate(30);

    // 3. Monta o contrato para gravação
    const payloadCalendario = {
        nomeTorneio: nome,
        modeloDisputa: modeloDisputa,
        limiteVagas: limiteVagas, // 0 = Ilimitado
        categoriasHabilitadas: categoriasHabilitadas,
        inicioInscricoes: dtIncIni,
        fimInscricoes: dtIncFim,
        inicioJogos: dtJogIni,
        fimTorneio: dtJogFim
    };

    const confAnterior = (configRegrasGlobal && configRegrasGlobal.ranking && configRegrasGlobal.ranking.calendario) || {};
    if (confAnterior.regulamentoUrl) {
        payloadCalendario.regulamentoUrl = confAnterior.regulamentoUrl;
    }

    // 4. Se estiver na Fase 1, força o avanço para a Fase 2 (Inscrições). Em edições posteriores, preserva a fase ativa.
    const confGlobal = (configRegrasGlobal && configRegrasGlobal.ranking) ? configRegrasGlobal.ranking : {};
    const faseAtualBanco = parseInt(confGlobal.faseAtual, 10) || 1;
    const novaFase = (faseAtualBanco === 1) ? 2 : faseAtualBanco;

    database.ref(`${raizBanco}/config/ranking`).update({
        modeloAtivo: modeloDisputa,
        calendario: payloadCalendario,
        faseAtual: novaFase
    })
    .then(() => {
        showToast("Contrato da edição gravado com sucesso! Inscrições abertas.", "success");

        if (typeof renderizarGestaoTemporadaSaaS === 'function') {
            renderizarGestaoTemporadaSaaS();
        }

        // 5. Tentativa de upload do PDF em segundo plano (sem travar a esteira)
        const inputPdf = document.getElementById('inp-pdf-file');
        if (inputPdf && inputPdf.files && inputPdf.files[0]) {
            const file = inputPdf.files[0];
            const pathStorage = `Clubes/${clubeAtivoId || 'SaaS'}/torneios/regulamento_${Date.now()}.pdf`;

            firebase.storage().ref(pathStorage).put(file)
                .then(snapshot => snapshot.ref.getDownloadURL())
                .then(downloadURL => {
                    database.ref(`${raizBanco}/config/ranking/calendario/regulamentoUrl`).set(downloadURL);
                    showToast("Regulamento em PDF anexado com sucesso!", "info");
                })
                .catch(err => {
                    console.warn("⚠️ Upload do PDF barrado por CORS em localhost. O contrato do torneio foi mantido no banco:", err);
                });
        }
    })
    .catch(err => {
        console.error("❌ [Torneios] Erro ao salvar calendário:", err);
        showToast("Erro ao gravar calendário no Firebase.", "error");
    });
}

/**
 * Preenche o formulário da Fase 1 com os dados do contrato ativo para edição
 */
function editarCalendarioAtivoSaaS() {
    const conf = (configRegrasGlobal && configRegrasGlobal.ranking) ? configRegrasGlobal.ranking : {};
    const cal = conf.calendario || {};

    if (cal.nomeTorneio) document.getElementById('inp-torneio-nome').value = cal.nomeTorneio;
    if (cal.modeloDisputa) document.getElementById('inp-torneio-modelo').value = cal.modeloDisputa;
    if (cal.limiteVagas) document.getElementById('inp-torneio-vagas').value = cal.limiteVagas;

    // Sincroniza as pílulas ativas de categorias
    if (Array.isArray(cal.categoriasHabilitadas)) {
        document.querySelectorAll('#container-pills-categorias .pilula-check').forEach(p => {
            const cat = p.getAttribute('data-cat');
            if (cal.categoriasHabilitadas.includes(cat)) {
                p.classList.add('ativa');
                const ico = p.querySelector('.material-icons');
                if (ico) ico.textContent = 'check_circle';
            } else {
                p.classList.remove('ativa');
                const ico = p.querySelector('.material-icons');
                if (ico) ico.textContent = 'add_circle_outline';
            }
        });
    }

    if (cal.inicioInscricoes) document.getElementById('inp-torneio-dt-inc-ini').value = cal.inicioInscricoes;
    if (cal.fimInscricoes) document.getElementById('inp-torneio-dt-inc-fim').value = cal.fimInscricoes;
    if (cal.inicioJogos) document.getElementById('inp-torneio-dt-jog-ini').value = cal.inicioJogos;
    if (cal.fimTorneio) document.getElementById('inp-torneio-dt-jog-fim').value = cal.fimTorneio;

    const lblPdf = document.getElementById('pdf-file-name');
    if (lblPdf) {
        if (cal.regulamentoUrl) {
            lblPdf.innerText = "📄 Regulamento em PDF anexado";
            lblPdf.style.color = "#15803d";
            lblPdf.style.fontWeight = "700";
        } else {
            lblPdf.innerText = "Nenhum arquivo anexado (Opcional)";
            lblPdf.style.color = "#64748b";
            lblPdf.style.fontWeight = "400";
        }
    }

    // Alterna a visualização para o formulário da Fase 1 sem resetar o torneio
    document.querySelectorAll('#container-fases-gestor .fase-panel').forEach((panel, idx) => {
        if (idx === 0) panel.classList.add('ativa');
        else panel.classList.remove('ativa');
    });

    // Sincroniza o botão do rodapé para o estado de edição da interface local
    if (typeof atualizarBotaoRodapeRankingSaaS === 'function') {
        atualizarBotaoRodapeRankingSaaS();
    }
}

/* ======================================================== */
/* 10.2 INSCRIÇÕES E CONFERÊNCIA DE PIX (FASE 2)            */
/* ======================================================== */

/* ======================================================== */
/* 👥 POPULAR FILTROS E RENDERIZAR LISTA DE INSCRITOS (SAAS)  */
/* ======================================================== */

function popularFiltrosInscritosSaaS() {
    const selectClasse = document.getElementById('select-filtro-inscritos-classe');
    const selectGenero = document.getElementById('select-filtro-inscritos-genero');

    const conf = (configRegrasGlobal && configRegrasGlobal.ranking) ? configRegrasGlobal.ranking : {};
    const cal = conf.calendario || {};
    const catsHabilitadas = cal.categoriasHabilitadas || ['CLASSE_A', 'CLASSE_B', 'CLASSE_C'];
    const inscritos = conf.inscritosConfirmados || {};
    const ids = Object.keys(inscritos);

    // Contagem dinâmica por Classe e por Gênero
    const contagemClasse = { A: 0, B: 0, C: 0 };
    const contagemGenero = { MASCULINO: 0, FEMININO: 0 };

    ids.forEach(idAtleta => {
        const atleta = (typeof jogadoresGlobal !== 'undefined' && jogadoresGlobal[idAtleta]) ? jogadoresGlobal[idAtleta] : {};
        const classeAtleta = (atleta.classe || '').toUpperCase().replace('CLASSE_', '').trim();
        const generoAtleta = (atleta.genero || '').toUpperCase().trim();

        if (contagemClasse[classeAtleta] !== undefined) contagemClasse[classeAtleta]++;
        if (contagemGenero[generoAtleta] !== undefined) contagemGenero[generoAtleta]++;
    });

    if (selectClasse) {
        const valAnterior = selectClasse.value || 'TODAS';
        selectClasse.innerHTML = `<option value="TODAS">Todas as Classes (${ids.length})</option>`;
        const classesUnicas = new Set();

        catsHabilitadas.forEach(c => {
            const cls = c.replace('CLASSE_', '').trim();
            if (['A', 'B', 'C'].includes(cls)) classesUnicas.add(cls);
        });

        if (classesUnicas.size === 0) {
            ['A', 'B', 'C'].forEach(cls => classesUnicas.add(cls));
        }

        classesUnicas.forEach(cls => {
            const qtd = contagemClasse[cls] || 0;
            selectClasse.innerHTML += `<option value="${cls}">Classe ${cls} (${qtd})</option>`;
        });
        selectClasse.value = valAnterior;
    }

    if (selectGenero) {
        const valAnteriorG = selectGenero.value || 'TODOS';
        selectGenero.innerHTML = `
            <option value="TODOS">Todos os Gêneros (${ids.length})</option>
            <option value="MASCULINO">Masculino (${contagemGenero.MASCULINO || 0})</option>
            <option value="FEMININO">Feminino (${contagemGenero.FEMININO || 0})</option>
        `;
        selectGenero.value = valAnteriorG;
    }
}

function abrirModalGerenciarInscritosSaaS() {
    popularFiltrosInscritosSaaS();
    renderizarListaInscritosPixSaaS();
    if (typeof abrirModalConfig === 'function') {
        abrirModalConfig('modal-gerenciar-inscritos');
    }
}

function renderizarListaInscritosPixSaaS() {
    const container = document.getElementById('container-lista-inscritos-pix');
    const lblBadge = document.getElementById('lbl-qtd-inscritos-badge');
    const btnEncerrar = document.getElementById('btn-saas-fase2-encerrar');
    const btnInscritos = document.getElementById('btn-saas-fase2-inscritos');

    const selClasse = document.getElementById('select-filtro-inscritos-classe');
    const selGenero = document.getElementById('select-filtro-inscritos-genero');

    const filtroClasse = selClasse ? selClasse.value : 'TODAS';
    const filtroGenero = selGenero ? selGenero.value : 'TODOS';

    if (!container) return;

    const conf = (configRegrasGlobal && configRegrasGlobal.ranking) ? configRegrasGlobal.ranking : {};
    const inscritos = conf.inscritosConfirmados || {};
    const ids = Object.keys(inscritos);

    if (lblBadge) lblBadge.textContent = ids.length;
    if (btnInscritos) btnInscritos.disabled = (ids.length === 0);
    if (btnEncerrar) btnEncerrar.disabled = (ids.length === 0);

    if (ids.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #94a3b8; margin: 20px 0; font-size: 13px;">Nenhum inscrito confirmado até o momento.</p>';
        return;
    }

    // Filtra a lista com base na classe e gênero do cadastro do atleta na memória
    const idsFiltrados = ids.filter(idAtleta => {
        const atleta = (typeof jogadoresGlobal !== 'undefined' && jogadoresGlobal[idAtleta]) ? jogadoresGlobal[idAtleta] : {};
        const classeAtleta = (atleta.classe || '').toUpperCase().replace('CLASSE_', '').trim();
        const generoAtleta = (atleta.genero || '').toUpperCase().trim();

        if (filtroClasse !== 'TODAS' && classeAtleta !== filtroClasse) return false;
        if (filtroGenero !== 'TODOS' && generoAtleta !== filtroGenero) return false;

        return true;
    });

    if (idsFiltrados.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #94a3b8; margin: 20px 0; font-size: 13px;">Nenhum inscrito encontrado com os filtros selecionados.</p>';
        return;
    }

    let html = '';
    idsFiltrados.forEach((idAtleta, idx) => {
        const item = inscritos[idAtleta];
        const pago = item.pixPago === true;
        const nomeAtleta = item.nome || "Atleta";
        const dataAceiteStr = item.dataAceite ? new Date(item.dataAceite).toLocaleDateString('pt-BR') : '';

        html += `
            <div class="item-atleta-pix">
                <div>
                    <span style="font-size: 13.5px; font-weight: 700; color: #1e293b;">${idx + 1}. ${nomeAtleta}</span>
                    <span style="display: block; font-size: 11px; color: #64748b;">Inscrito em ${dataAceiteStr || 'Data N/D'}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span class="badge-pix ${pago ? 'pago' : 'pendente'}" onclick="togglePixStatusSaaS('${idAtleta}')">
                        ${pago ? '🟢 PIX Confirmado' : '🟡 PIX Pendente'}
                    </span>
                    <button type="button" style="background:none; border:none; color:#94a3b8; cursor:pointer;" onclick="removerInscritoTorneioSaaS('${idAtleta}')" title="Remover">
                        <i class="material-icons" style="font-size: 16px;">close</i>
                    </button>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

function togglePixStatusSaaS(idAtleta) {
    if (!isGestorLogado || !raizBanco) return;

    const pathPix = `${raizBanco}/config/ranking/inscritosConfirmados/${idAtleta}/pixPago`;
    database.ref(pathPix).once('value').then(snap => {
        const atual = snap.val() === true;
        return database.ref(pathPix).set(!atual);
    }).then(() => {
        showToast("Status de pagamento atualizado!", "info");
        renderizarListaInscritosPixSaaS();
    });
}

function removerInscritoTorneioSaaS(idAtleta) {
    if (!isGestorLogado || !raizBanco) return;

    showPrompt("Remover Inscrito", "Deseja remover este atleta da lista de inscritos?", () => {
        database.ref(`${raizBanco}/config/ranking/inscritosConfirmados/${idAtleta}`).remove().then(() => {
            showToast("Atleta removido da lista.", "success");
            renderizarListaInscritosPixSaaS();
        });
    });
}

function inscreverAtletaManualmenteSaaS() {
    showToast("Abertura do seletor manual em desenvolvimento.", "info");
}


function encerrarInscricoesECriarChavesSaaS() {
    if (!isGestorLogado || !raizBanco) {
        showToast("Apenas o gestor pode encerrar as inscrições.", "error");
        return;
    }

    const conf = (configRegrasGlobal && configRegrasGlobal.ranking) ? configRegrasGlobal.ranking : {};
    const cal = conf.calendario || {};
    const inscritos = conf.inscritosConfirmados || {};
    const qtdInscritos = Object.keys(inscritos).length;

    if (qtdInscritos === 0) {
        showToast("Não há inscritos confirmados para encerrar a fase.", "warning");
        return;
    }

    // 1. Comparação de Datas (Hoje vs. Deadline)
    const hojeStr = new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"
    const fimInscricoesStr = cal.fimInscricoes || "";

    const fmtData = (str) => str ? str.split('-').reverse().join('/') : '--/--';
    const dataFimFormatada = fmtData(fimInscricoesStr);

    const executarEncerramento = () => {
        if (navigator.vibrate) navigator.vibrate(40);

        const updates = {};
        updates[`${raizBanco}/config/ranking/faseAtual`] = 3;

        // 🏆 CONSTRUÇÃO DAS TABELAS DO TORNEIO (ranking/tabelas) BASEADAS NO RANKING GERAL
        const modoGenero = conf.divisaoGenero || 'separado';
        const inscritosPorCategoria = {};

        // 1. Agrupa os inscritos confirmados por categoria (Classe + Gênero)
        Object.keys(inscritos).forEach(idAtleta => {
            const atleta = (typeof jogadoresGlobal !== 'undefined' && jogadoresGlobal[idAtleta]) ? jogadoresGlobal[idAtleta] : {};
            const classe = (atleta.classe || 'B').toUpperCase();
            let generoKey = (atleta.genero || 'MASCULINO').toUpperCase();
            if (generoKey === 'NAO_INFORMAR') generoKey = 'MASCULINO';

            const chaveTabela = (modoGenero === 'unificado') ? `${classe}_UNIFICADO` : `${classe}_${generoKey}`;

            if (!inscritosPorCategoria[chaveTabela]) {
                inscritosPorCategoria[chaveTabela] = [];
            }
            inscritosPorCategoria[chaveTabela].push(idAtleta);
        });

        // 2. Para cada categoria, ordena os atletas usando a Fila Mestre (ranking_geral)
        Object.keys(inscritosPorCategoria).forEach(chaveTab => {
            const idsInscritosCat = inscritosPorCategoria[chaveTab];
            const ordemMestre = (typeof rankingGeralGlobal !== 'undefined' && rankingGeralGlobal[chaveTab]) 
                ? rankingGeralGlobal[chaveTab] 
                : [];

            idsInscritosCat.sort((a, b) => {
                let idxA = ordemMestre.indexOf(a);
                let idxB = ordemMestre.indexOf(b);
                if (idxA === -1) idxA = 9999;
                if (idxB === -1) idxB = 9999;

                if (idxA !== idxB) return idxA - idxB;

                // Desempate secundário pela data de aceite do convite
                const dataA = inscritos[a]?.dataAceite || 0;
                const dataB = inscritos[b]?.dataAceite || 0;
                return dataA - dataB;
            });

            // Grava na tabela do Torneio Atual sem alterar a Fila Mestre
            updates[`${raizBanco}/ranking/tabelas/${chaveTab}`] = idsInscritosCat;
        });

        // Disparo automático de notificação no padrão mestre para todos os inscritos
        const nomeTorneio = cal.nomeTorneio || "Torneio";
        const payloadNotificacao = {
            categoria: "inicio_temporada",
            titulo: "A temporada começou!",
            detalhe: `Tabela do ${nomeTorneio} liberada.\nAgende sua partida de ranking no app.`,
            timestamp: Date.now()
        };

        Object.keys(inscritos).forEach(idAtleta => {
            const keyNotif = database.ref().push().key;
            updates[`${raizBanco}/jogadores/${idAtleta}/notificacoes/${keyNotif}`] = payloadNotificacao;
        });

        database.ref().update(updates)
        .then(() => {
            showToast("Inscrições encerradas! Notificações enviadas e Fase 3 iniciada.", "success");
            if (typeof renderizarGestaoTemporadaSaaS === "function") {
                renderizarGestaoTemporadaSaaS();
            }
        })
        .catch(err => {
            console.error("❌ Erro ao encerrar inscrições:", err);
            showToast("Erro ao gravar dados no Firebase.", "error");
        });
    };

    // 2. Alerta de Antecipação Inteligente se estiver antes do Deadline
    if (fimInscricoesStr && hojeStr < fimInscricoesStr) {
        const htmlPrompt = `
            <div style="text-align: left; font-size: 14px; color: #334155; line-height: 1.5;">
                <p style="margin: 0 0 10px 0;">
                    ⚠️ <b>Atenção:</b> O prazo oficial de inscrições vai até <b>${dataFimFormatada}</b>.
                </p>
                <p style="margin: 0; font-size: 13px; color: #64748b;">
                    Tem certeza que deseja encerrar antecipadamente com <b>${qtdInscritos} inscrito(s)</b> e congelar as chaves agora?
                </p>
            </div>
        `;
        showPrompt("Encerrar Inscrições Antecipadamente", htmlPrompt, () => {
            executarEncerramento();
        });
    } else {
        const htmlPrompt = `
            <div style="text-align: left; font-size: 14px; color: #334155; line-height: 1.5;">
                <p style="margin: 0;">
                    Deseja encerrar as inscrições com <b>${qtdInscritos} atleta(s) confirmado(s)</b> e avançar para a próxima fase?
                </p>
            </div>
        `;
        showPrompt("Encerrar Inscrições e Congelar Grupos", htmlPrompt, () => {
            executarEncerramento();
        });
    }
}

/* ======================================================== */
/* 10.3 AÇÕES DA FASE DE CHAVES E PONTOS (FASE 3)           */
/* ======================================================== */

function exportarLeaderboardPDFSaaS() {
    const sheet = document.getElementById('sheet-leaderboard-ranking');
    if (sheet && sheet.style.display !== 'flex') {
        abrirLeaderboardSaaS();
    }
    
    setTimeout(() => {
        if (typeof window.print === 'function') {
            window.print();
        } else {
            showToast("A impressão em PDF não é suportada neste navegador.", "warning");
        }
    }, 300);
}

async function encerrarFase3EAvancarSaaS() {
    if (!isGestorLogado || !raizBanco) {
        showToast("Apenas o gestor pode encerrar esta fase.", "error");
        return;
    }

    const conf = (configRegrasGlobal && configRegrasGlobal.ranking) ? configRegrasGlobal.ranking : {};
    const cal = conf.calendario || {};
    const modelo = conf.modeloAtivo || "grupos";
    const faseAtual = parseInt(conf.faseAtual, 10) || 3;

    // 1. Comparação de Datas (Hoje vs. Fim do Torneio)
    const hojeStr = new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"
    const fimTorneioStr = cal.fimTorneio || "";

    const fmtData = (str) => str ? str.split('-').reverse().join('/') : '--/--';
    const dataFimFormatada = fmtData(fimTorneioStr);

    const titulosPrompt = {
        piramide: "Encerrar Pirâmide e Homologar Posições",
        barragem: "Encerrar Barragem e Consolidar Ranking",
        grupos: faseAtual === 3 ? "Avançar para o Mata-Mata" : "Encerrar Torneio e Homologar Campeões"
    };

    const msgsPrompt = {
        piramide: "Deseja encerrar o ciclo de desafios da Pirâmide e homologar as posições finais dos atletas no Ranking Geral?",
        barragem: "Deseja encerrar a disputa por pontos corridos e atualizar a classificação no Ranking Geral?",
        grupos: faseAtual === 3 
            ? "Deseja consolidar a classificação atual das chaves e avançar para a <b>Fase 4 (Mata-Mata / Quadro Eliminatório)</b>?" 
            : "Deseja encerrar a fase final e homologar a classificação no Ranking Geral?"
    };

    const executarEncerramentoFase3 = async () => {
        if (navigator.vibrate) navigator.vibrate(40);

        const novaFase = (modelo === "grupos" && faseAtual === 3) ? 4 : (modelo === "grupos" ? 5 : 4);
        const eHomologacaoFinal = (novaFase === 5 || (modelo !== "grupos" && novaFase === 4));

        try {
            const updates = {};
            updates[`${raizBanco}/config/ranking/faseAtual`] = novaFase;

            // 🏆 SE FOR A CONCLUSÃO FINAL DO TORNEIO: ALIMENTA/ATUALIZA O RANKING GERAL
            if (eHomologacaoFinal) {
                const snapTabelasTorneio = await database.ref(`${raizBanco}/ranking/tabelas`).once('value');
                const snapRankingGeral = await database.ref(`${raizBanco}/ranking/ranking_geral`).once('value');

                const tabelasTorneio = snapTabelasTorneio.exists() ? snapTabelasTorneio.val() : {};
                const rankingGeralAtual = snapRankingGeral.exists() ? snapRankingGeral.val() : {};

                Object.keys(tabelasTorneio).forEach(chaveCat => {
                    const classificacaoTorneio = tabelasTorneio[chaveCat] || [];
                    if (!Array.isArray(classificacaoTorneio) || classificacaoTorneio.length === 0) return;

                    let mestreCat = Array.isArray(rankingGeralAtual[chaveCat]) ? [...rankingGeralAtual[chaveCat]] : [];

                    if (mestreCat.length === 0) {
                        // 1. PRIMEIRO TORNEIO DO CLUBE: O Ranking Geral nasce com o resultado do torneio
                        mestreCat = [...classificacaoTorneio];
                    } else {
                        // 2. TORNEIOS SEGUINTES: Atualiza os participantes no topo e mantêm os demais abaixo
                        const participantesNoTorneio = new Set(classificacaoTorneio);
                        mestreCat = mestreCat.filter(id => !participantesNoTorneio.has(id));

                        mestreCat = [...classificacaoTorneio, ...mestreCat];
                    }

                    updates[`${raizBanco}/ranking/ranking_geral/${chaveCat}`] = mestreCat;
                });
            }

            await database.ref().update(updates);

            const msgsSucesso = {
                piramide: "Pirâmide encerrada e homologada com sucesso no Ranking Geral!",
                barragem: "Barragem encerrada e Ranking Geral atualizado!",
                grupos: novaFase === 4 ? "Fase de chaves encerrada! Avançando para o Mata-Mata." : "Torneio concluído e homologado no Ranking Geral!"
            };

            showToast(msgsSucesso[modelo] || "Fase encerrada com sucesso!", "success");

            if (typeof renderizarGestaoTemporadaSaaS === "function") {
                renderizarGestaoTemporadaSaaS();
            }
        } catch (err) {
            console.error("❌ Erro ao avançar de fase:", err);
            showToast("Erro ao gravar dados no Firebase.", "error");
        }
    };

    // 2. Alerta de Antecipação se estiver antes do Término Oficial
    if (fimTorneioStr && hojeStr < fimTorneioStr) {
        const htmlPrompt = `
            <div style="text-align: left; font-size: 14px; color: #334155; line-height: 1.5;">
                <p style="margin: 0 0 10px 0;">
                    ⚠️ <b>Atenção:</b> O término oficial do torneio está previsto para <b>${dataFimFormatada}</b>.
                </p>
                <p style="margin: 0; font-size: 13px; color: #64748b;">
                    Tem certeza que deseja encerrar a disputa antecipadamente e consolidar os resultados agora?
                </p>
            </div>
        `;
        showPrompt("Encerrar Torneio Antecipadamente", htmlPrompt, () => {
            executarEncerramentoFase3();
        });
    } else {
        const htmlPrompt = `
            <div style="text-align: left; font-size: 14px; color: #334155; line-height: 1.5;">
                <p style="margin: 0;">
                    ${msgsPrompt[modelo] || msgsPrompt.grupos}
                </p>
            </div>
        `;
        showPrompt(titulosPrompt[modelo] || "Encerrar Fase", htmlPrompt, () => {
            executarEncerramentoFase3();
        });
    }
}


/* ======================================================== */
/* 10.4 AÇÕES DA FASE CONCLUÍDA E HOMOLOGAÇÃO (FASE 4)      */
/* ======================================================== */

/**
 * Abre a visualização da classificação / hall de campeões da temporada homologada
 */
function abrirHallDeCampeoesSaaS() {
    if (typeof abrirLeaderboardSaaS === 'function') {
        abrirLeaderboardSaaS();
    } else {
        showToast("Exibindo classificação final da temporada.", "info");
    }
}

/**
 * Reinicia a esteira operacional do Ranking voltando para a Fase 1 (Calendário)
 */
/**
 * Reinicia a esteira operacional do Ranking voltando para a Fase 1 (Calendário)
 */
function reiniciarEsteiraNovoTorneioSaaS() {
    if (!isGestorLogado || !raizBanco) {
        showToast("Apenas o gestor pode iniciar uma nova temporada.", "error"); 
        return;
    }

    const htmlPrompt = `
        <div style="text-align: left; font-size: 14px; color: #334155; line-height: 1.5;">
            <p style="margin: 0 0 10px 0;">
                🚀 <b>Abrir Novo Torneio / Nova Temporada</b>
            </p>
            <p style="margin: 0; font-size: 13px; color: #64748b;">
                Deseja reiniciar a esteira de gestão e voltar para a <b>Fase 1 (Calendário)</b> para configurar uma nova edição do torneio?
            </p>
        </div>
    `;

    showPrompt("Abrir Nova Temporada", htmlPrompt, () => {
        if (navigator.vibrate) navigator.vibrate(40);

        // Atualiza a fase para 1 e expurga inscritos e convites do torneio anterior
        const updates = {};
        updates[`${raizBanco}/config/ranking/faseAtual`] = 1;
        updates[`${raizBanco}/config/ranking/inscritosConfirmados`] = null;
        updates[`${raizBanco}/convites_ranking`] = null;

        database.ref().update(updates)
        .then(() => {
            showToast("Esteira reiniciada! Configure o calendário da nova edição.", "success");
            if (typeof renderizarGestaoTemporadaSaaS === "function") {
                renderizarGestaoTemporadaSaaS();
            }
            if (typeof atualizarBotaoRodapeRankingSaaS === "function") {
                atualizarBotaoRodapeRankingSaaS();
            }
        })
        .catch(err => {
            console.error("❌ Erro ao reiniciar esteira:", err);
            showToast("Erro ao atualizar dados no Firebase.", "error");
        });
    });
}