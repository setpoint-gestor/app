"use strict";

/**
 * ========================================================
 * 🏆 MÓDULO RANKING SAAS - ESTEIRA & MATA-MATA (2/3)
 * Contém: Esteira de Fases (1 a 5), Convites, Inscrições,
 * Gestão do Torneio e Algoritmos de Chaveamento / Mata-Mata.
 * ========================================================
 */

/* ======================================================== */
/* 1. AÇÕES DO SÓCIO: CONFIRMAÇÃO DE INSCRIÇÃO NO RANKING   */
/* ======================================================== */

async function aceitarConviteRankingSocioSaaS() {
    const idLogado = localStorage.getItem('jogadorLogadoId'); 
    if (!idLogado || !raizBanco) return;

    if (navigator.vibrate) navigator.vibrate(30);

    try {
        const atleta = (typeof jogadoresGlobal !== 'undefined' && jogadoresGlobal[idLogado]) ? jogadoresGlobal[idLogado] : {};
        const snapConfig = await database.ref(`${raizBanco}/config/ranking`).once('value');
        const configRanking = snapConfig.val() || {};

        const faseAtual = parseInt(configRanking.faseAtual, 10) || 1;
        if (faseAtual > 2) {
            showToast("As inscrições para este torneio já foram encerradas.", "warning");
            window.temConviteRankingPendenteSocio = false;
            await database.ref(`${raizBanco}/convites_ranking/pendentes/${idLogado}`).remove();
            if (typeof fecharModalNotificacoes === 'function') fecharModalNotificacoes();
            return;
        }

        // 🛡️ VALIDAÇÃO DE LIMITE DE VAGAS POR CATEGORIA (ABORDAGEM A)
        const cal = configRanking.calendario || {};
        const limiteVagasPorCat = parseInt(cal.limiteVagas, 10) || 0;

        if (limiteVagasPorCat > 0) {
            const classeAtleta = (atleta.classe || 'B').toUpperCase().replace('CLASSE_', '').trim();
            let generoAtleta = (atleta.genero || 'MASCULINO').toUpperCase().trim();
            if (generoAtleta === 'NAO_INFORMAR') generoAtleta = 'MASCULINO';

            const modoGenero = configRanking.divisaoGenero || 'separado';
            const chaveCatAtleta = (modoGenero === 'unificado') ? `${classeAtleta}_UNIFICADO` : `${classeAtleta}_${generoAtleta}`;

            const inscritos = configRanking.inscritosConfirmados || {};
            let confirmadosNaCat = 0;

            Object.keys(inscritos).forEach(id => {
                const at = (typeof jogadoresGlobal !== 'undefined' && jogadoresGlobal[id]) ? jogadoresGlobal[id] : {};
                const cl = (at.classe || 'B').toUpperCase().replace('CLASSE_', '').trim();
                let gen = (at.genero || 'MASCULINO').toUpperCase().trim();
                if (gen === 'NAO_INFORMAR') gen = 'MASCULINO';
                const catInscrito = (modoGenero === 'unificado') ? `${cl}_UNIFICADO` : `${cl}_${gen}`;

                if (catInscrito === chaveCatAtleta) {
                    confirmadosNaCat++;
                }
            });

            // 🛡️ BLINDAGEM DA FILA: Se o limite foi atingido OU se há suplentes na fila de espera,
            // impede qualquer convite comum de assumir a vaga titular aberta por desistência.
            const filaCat = (configRanking.filaEspera && configRanking.filaEspera[chaveCatAtleta]) ? configRanking.filaEspera[chaveCatAtleta] : {};
            const qtdFila = Object.keys(filaCat).length;

            if (confirmadosNaCat >= limiteVagasPorCat || qtdFila > 0) {
                const rotuloCat = `Classe ${classeAtleta}` + (modoGenero !== 'unificado' ? ` (${generoAtleta === 'FEMININO' ? 'Feminino' : 'Masculino'})` : '');
                const motivoMsg = (confirmadosNaCat >= limiteVagasPorCat)
                    ? `Vagas esgotadas para a ${rotuloCat} (limite de ${limiteVagasPorCat} atletas atingido).`
                    : `As vagas titulares da ${rotuloCat} já foram preenchidas e há suplentes na fila de espera.`;
                showToast(motivoMsg, "warning", 5000);

                // Atualiza a tela para transformar o botão em "Entrar na Fila" imediatamente
                if (typeof renderizarListaNotificacoesSocioSaaS === 'function') {
                    renderizarListaNotificacoesSocioSaaS();
                } else if (typeof fecharModalNotificacoes === 'function') {
                    fecharModalNotificacoes();
                }
                return;
            }
        }

        // 🛡️ PROTEÇÃO ANTI-PISCADA: Trava a flag na RAM imediatamente
        window.temConviteRankingPendenteSocio = false;

        showToast("Confirmando sua inscrição...", "info");

        const cobrarTaxa = configRanking.financeiro?.cobrarTaxa === true;
        const payloadInscrito = {
            nome: atleta.nomeCompleto || atleta.apelido || "Atleta",
            pixPago: !cobrarTaxa,
            dataAceite: Date.now()
        };

        // 🚀 DISPARO ATÔMICO SIMULTÂNEO: Grava a vaga titular e remove o convite pendente no mesmo milissegundo
        const updates = {};
        updates[`config/ranking/inscritosConfirmados/${idLogado}`] = payloadInscrito;
        updates[`convites_ranking/pendentes/${idLogado}`] = null;

        await database.ref(raizBanco).update(updates);

        showToast("Inscrição confirmada com sucesso! Bem-vindo ao Ranking.", "success");
        if (typeof fecharModalNotificacoes === 'function') fecharModalNotificacoes();

    } catch (err) {
        console.error("Erro ao aceitar convite do ranking:", err);
        showToast("Erro ao processar sua inscrição. Tente novamente.", "error");
    }
}

async function recusarConviteRankingSocioSaaS() {
    const idLogado = localStorage.getItem('jogadorLogadoId');
    if (!idLogado || !raizBanco) return;

    if (navigator.vibrate) navigator.vibrate(20);

    try {
        await database.ref(`${raizBanco}/convites_ranking/pendentes/${idLogado}`).remove();

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

/**
 * Registra o atleta na Fila de Espera inteligente da respectiva Categoria
 */
async function entrarFilaEsperaRankingSocioSaaS() {
    const idLogado = localStorage.getItem('jogadorLogadoId'); 
    if (!idLogado || !raizBanco) return;

    if (navigator.vibrate) navigator.vibrate(30);

    try {
        const atleta = (typeof jogadoresGlobal !== 'undefined' && jogadoresGlobal[idLogado]) ? jogadoresGlobal[idLogado] : {};
        const snapConfig = await database.ref(`${raizBanco}/config/ranking`).once('value');
        const configRanking = snapConfig.val() || {};

        const faseAtual = parseInt(configRanking.faseAtual, 10) || 1;
        if (faseAtual > 2) {
            showToast("As inscrições para este torneio já foram encerradas.", "warning");
            await database.ref(`${raizBanco}/convites_ranking/pendentes/${idLogado}`).remove();
            if (typeof fecharModalNotificacoes === 'function') fecharModalNotificacoes();
            return;
        }

        // 1. Identificar a categoria técnica do atleta
        const classeAtleta = (atleta.classe || 'B').toUpperCase().replace('CLASSE_', '').trim();
        let generoAtleta = (atleta.genero || 'MASCULINO').toUpperCase().trim();
        if (generoAtleta === 'NAO_INFORMAR') generoAtleta = 'MASCULINO';

        const modoGenero = configRanking.divisaoGenero || 'separado';
        const chaveCatAtleta = (modoGenero === 'unificado') ? `${classeAtleta}_UNIFICADO` : `${classeAtleta}_${generoAtleta}`;
        const rotuloCat = `Classe ${classeAtleta}` + (modoGenero !== 'unificado' ? ` (${generoAtleta === 'FEMININO' ? 'Feminino' : 'Masculino'})` : '');

        // 2. Apurar a posição por ordem de chegada na respectiva categoria
        const snapFila = await database.ref(`${raizBanco}/config/ranking/filaEspera/${chaveCatAtleta}`).once('value');
        const filaCat = snapFila.val() || {};
        const posicaoFila = Object.keys(filaCat).length + 1;

        const payloadEspera = {
            nome: atleta.nomeCompleto || atleta.apelido || "Atleta",
            posicao: posicaoFila,
            dataEntrada: Date.now(),
            pixPago: false
        };

        // 3. Gravar na fila e limpar a pendência da caixa de entrada
        await database.ref(`${raizBanco}/config/ranking/filaEspera/${chaveCatAtleta}/${idLogado}`).set(payloadEspera);
        await database.ref(`${raizBanco}/convites_ranking/pendentes/${idLogado}`).remove();

        showToast(`Confirmado na Fila de Espera da ${rotuloCat} (Suplente #${posicaoFila}).`, "success", 5000);
        if (typeof fecharModalNotificacoes === 'function') fecharModalNotificacoes();

    } catch (err) {
        console.error("Erro ao entrar na fila de espera do ranking:", err);
        showToast("Erro ao processar a entrada na fila de espera. Tente novamente.", "error");
    }
}


/**
 * Confirma a aceitação da vaga de titular pelo suplente convocado (Regra: Quem chegar primeiro leva)
 */
async function aceitarVagaSuplenteRankingSocioSaaS() {
    const idLogado = localStorage.getItem('jogadorLogadoId'); 
    if (!idLogado || !raizBanco) return;

    if (navigator.vibrate) navigator.vibrate(30);

    try {
        const atleta = (typeof jogadoresGlobal !== 'undefined' && jogadoresGlobal[idLogado]) ? jogadoresGlobal[idLogado] : {};
        const snapConfig = await database.ref(`${raizBanco}/config/ranking`).once('value');
        const configRanking = snapConfig.val() || {};

        const faseAtual = parseInt(configRanking.faseAtual, 10) || 1;
        if (faseAtual > 2) {
            showToast("As inscrições para este torneio já foram encerradas.", "warning");
            await database.ref(`${raizBanco}/convites_ranking/pendentes/${idLogado}`).remove();
            if (typeof fecharModalNotificacoes === 'function') fecharModalNotificacoes();
            return;
        }

        // 1. Identificar a categoria técnica do atleta
        const classeAtleta = (atleta.classe || 'B').toUpperCase().replace('CLASSE_', '').trim();
        let generoAtleta = (atleta.genero || 'MASCULINO').toUpperCase().trim();
        if (generoAtleta === 'NAO_INFORMAR') generoAtleta = 'MASCULINO';

        const modoGenero = configRanking.divisaoGenero || 'separado';
        const chaveCat = (modoGenero === 'unificado') ? `${classeAtleta}_UNIFICADO` : `${classeAtleta}_${generoAtleta}`;

        // 🛡️ VALIDAÇÃO DE LIMITE DE VAGAS: SE O OUTRO CONCORRENTE JÁ PREENCHEU
        const cal = configRanking.calendario || {};
        const limiteVagasPorCat = parseInt(cal.limiteVagas, 10) || 0;

        if (limiteVagasPorCat > 0) {
            const inscritos = configRanking.inscritosConfirmados || {};
            let confirmadosNaCat = 0;

            Object.keys(inscritos).forEach(id => {
                const at = (typeof jogadoresGlobal !== 'undefined' && jogadoresGlobal[id]) ? jogadoresGlobal[id] : {};
                const cl = (at.classe || 'B').toUpperCase().replace('CLASSE_', '').trim();
                let gen = (at.genero || 'MASCULINO').toUpperCase().trim();
                if (gen === 'NAO_INFORMAR') gen = 'MASCULINO';
                const catInscrito = (modoGenero === 'unificado') ? `${cl}_UNIFICADO` : `${cl}_${gen}`;

                if (catInscrito === chaveCat) {
                    confirmadosNaCat++;
                }
            });

            if (confirmadosNaCat >= limiteVagasPorCat) {
                // A vaga foi preenchida pelo concorrente mais rápido!
                await database.ref(`${raizBanco}/convites_ranking/pendentes/${idLogado}`).remove();
                await database.ref(`${raizBanco}/config/ranking/filaEspera/${chaveCat}/${idLogado}`).update({
                    status: "aguardando",
                    expiraEm: null,
                    convocadoEm: null,
                    janelaAberta: null
                });

                showToast("Que pena! A vaga aberta acabou de ser preenchida por outro atleta. Seu nome continua seguro na fila como #1 para a próxima oportunidade.", "warning", 6500);
                if (typeof fecharModalNotificacoes === 'function') fecharModalNotificacoes();
                return;
            }
        }

        showToast("Garantindo sua vaga de titular...", "info");

        const cobrarTaxa = configRanking.financeiro?.cobrarTaxa === true;
        const payloadInscrito = {
            nome: atleta.nomeCompleto || atleta.apelido || "Atleta",
            pixPago: !cobrarTaxa,
            dataAceite: Date.now()
        };

        // 2. Promover o ganhador a titular oficial e limpar sua pendência e fila
        await Promise.all([
            database.ref(`${raizBanco}/config/ranking/inscritosConfirmados/${idLogado}`).set(payloadInscrito),
            database.ref(`${raizBanco}/config/ranking/filaEspera/${chaveCat}/${idLogado}`).remove(),
            database.ref(`${raizBanco}/convites_ranking/pendentes/${idLogado}`).remove()
        ]);

        // 3. Encerrar a convocação dos outros concorrentes da categoria e reorganizar a fila restante
        const snapFila = await database.ref(`${raizBanco}/config/ranking/filaEspera/${chaveCat}`).once('value');
        const filaRestante = snapFila.val() || {};
        const idsRestantes = Object.keys(filaRestante);

        if (idsRestantes.length > 0) {
            idsRestantes.sort((a, b) => (filaRestante[a].posicao || 0) - (filaRestante[b].posicao || 0));
            const updatesPos = {};
            for (let idx = 0; idx < idsRestantes.length; idx++) {
                const idOutro = idsRestantes[idx];
                updatesPos[`${raizBanco}/config/ranking/filaEspera/${chaveCat}/${idOutro}/posicao`] = idx + 1;

                // Se outro atleta estava em concorrência, fecha a janela dele pois a vaga foi preenchida
                if (filaRestante[idOutro].status === 'convocado') {
                    updatesPos[`${raizBanco}/config/ranking/filaEspera/${chaveCat}/${idOutro}/status`] = "aguardando";
                    updatesPos[`${raizBanco}/config/ranking/filaEspera/${chaveCat}/${idOutro}/expiraEm`] = null;
                    updatesPos[`${raizBanco}/config/ranking/filaEspera/${chaveCat}/${idOutro}/convocadoEm`] = null;
                    updatesPos[`${raizBanco}/config/ranking/filaEspera/${chaveCat}/${idOutro}/janelaAberta`] = null;
                    await database.ref(`${raizBanco}/convites_ranking/pendentes/${idOutro}`).remove();
                }
            }
            await database.ref().update(updatesPos);
        }

        showToast("Parabéns! Sua vaga titular foi confirmada com sucesso.", "success", 5000);
        if (typeof fecharModalNotificacoes === 'function') fecharModalNotificacoes();

    } catch (err) {
        console.error("Erro ao aceitar vaga de suplente:", err);
        showToast("Erro ao confirmar vaga titular. Tente novamente.", "error");
    }
}


/**
 * Suplente convocado abre mão da vaga, passando a vez ao próximo da fila
 */
async function passarVezSuplenteRankingSocioSaaS() {
    const idLogado = localStorage.getItem('jogadorLogadoId'); 
    if (!idLogado || !raizBanco) return;

    if (navigator.vibrate) navigator.vibrate(20);

    try {
        const atleta = (typeof jogadoresGlobal !== 'undefined' && jogadoresGlobal[idLogado]) ? jogadoresGlobal[idLogado] : {};
        const snapConfig = await database.ref(`${raizBanco}/config/ranking`).once('value');
        const configRanking = snapConfig.val() || {};

        // 1. Identificar a categoria técnica do atleta
        const classeAtleta = (atleta.classe || 'B').toUpperCase().replace('CLASSE_', '').trim();
        let generoAtleta = (atleta.genero || 'MASCULINO').toUpperCase().trim();
        if (generoAtleta === 'NAO_INFORMAR') generoAtleta = 'MASCULINO';

        const modoGenero = configRanking.divisaoGenero || 'separado';
        const chaveCat = (modoGenero === 'unificado') ? `${classeAtleta}_UNIFICADO` : `${classeAtleta}_${generoAtleta}`;

        showToast("Processando passagem de vaga...", "info");

        // 2. Remover da fila de espera e desativar a pendência do sininho
        await Promise.all([
            database.ref(`${raizBanco}/config/ranking/filaEspera/${chaveCat}/${idLogado}`).remove(),
            database.ref(`${raizBanco}/convites_ranking/pendentes/${idLogado}`).remove()
        ]);

        // 3. Reorganizar posições da fila restante e convocar o próximo da fila
        const snapFila = await database.ref(`${raizBanco}/config/ranking/filaEspera/${chaveCat}`).once('value');
        const filaRestante = snapFila.val() || {};
        const idsRestantes = Object.keys(filaRestante);

        if (idsRestantes.length > 0) {
            idsRestantes.sort((a, b) => (filaRestante[a].posicao || 0) - (filaRestante[b].posicao || 0));
            const updatesPos = {};
            idsRestantes.forEach((id, idx) => {
                updatesPos[`${raizBanco}/config/ranking/filaEspera/${chaveCat}/${id}/posicao`] = idx + 1;
            });
            await database.ref().update(updatesPos);

            // Convoca autonomamente o novo #1 (ex: Rafael Nadal)
            if (typeof convocarProximoSuplenteFilaEsperaRankingSaaS === 'function') {
                await convocarProximoSuplenteFilaEsperaRankingSaaS(chaveCat);
            }
        }

        showToast("Vaga dispensada. O próximo suplente da fila foi convocado.", "info", 5000);
        if (typeof fecharModalNotificacoes === 'function') fecharModalNotificacoes();

    } catch (err) {
        console.error("Erro ao passar a vez do suplente:", err);
        showToast("Erro ao processar a passagem de vaga.", "error");
    }
}

/* ======================================================== */
/* 2. ZERAR / REINICIAR RANKING                              */
/* ======================================================== */

function limparFormularioFase1SaaS() {
    const elNome = document.getElementById('inp-torneio-nome');
    const elModelo = document.getElementById('inp-torneio-modelo');
    const elVagas = document.getElementById('inp-torneio-vagas');
    const elDtIncIni = document.getElementById('inp-torneio-dt-inc-ini');
    const elDtIncFim = document.getElementById('inp-torneio-dt-inc-fim');
    const elDtJogIni = document.getElementById('inp-torneio-dt-jog-ini');
    const elDtJogFim = document.getElementById('inp-torneio-dt-jog-fim');
    const lblPdf = document.getElementById('pdf-file-name');
    const containerPills = document.getElementById('container-pills-categorias');

    // 1. Zera os valores e destrava todos os campos (limpa os status de edição)
    if (elNome) { elNome.value = ''; elNome.disabled = false; elNome.title = ''; }
    if (elModelo) { elModelo.selectedIndex = 0; elModelo.disabled = false; elModelo.title = ''; }
    if (elVagas) { elVagas.value = ''; elVagas.disabled = false; elVagas.title = ''; }
    if (elDtIncIni) { elDtIncIni.value = ''; elDtIncIni.disabled = false; elDtIncIni.title = ''; }
    if (elDtIncFim) { elDtIncFim.value = ''; elDtIncFim.disabled = false; elDtIncFim.title = ''; }
    if (elDtJogIni) { elDtJogIni.value = ''; elDtJogIni.disabled = false; elDtJogIni.title = ''; }
    if (elDtJogFim) { elDtJogFim.value = ''; elDtJogFim.disabled = false; elDtJogFim.title = ''; }

    if (lblPdf) {
        lblPdf.innerText = 'Nenhum arquivo anexado (Opcional)';
        lblPdf.style.color = '#64748b';
        lblPdf.style.fontWeight = '400';
    }

    // 2. Destrava e zera as pílulas de categorias
    if (containerPills) {
        containerPills.classList.remove('travado');
        containerPills.title = '';
    }

    document.querySelectorAll('#container-pills-categorias .pilula-check').forEach(p => {
        p.classList.remove('ativa');
        const ico = p.querySelector('.material-icons');
        if (ico) ico.textContent = 'add_circle_outline';
    });
	
	// 3. Reseta a flag de segurança de edição (Garante modo Criação limpo)
    window.emModoEdicaoCalendarioSaaS = false;
}


async function zerarRankingSaaS() {
    if (!isGestorLogado || !raizBanco) {
        showToast("Apenas o gestor do clube pode zerar o ranking.", "error");
        return;
    }

    try {
        if (navigator.vibrate) navigator.vibrate(30);
        showToast("Analisando dados do ranking...", "info");

        const [snapPartidas, snapTabelas, snapConvites, snapReservas, snapJogadores, snapConfig] = await Promise.all([
            database.ref(`${raizBanco}/ranking/partidas`).once('value'),
            database.ref(`${raizBanco}/ranking/tabelas`).once('value'),
            database.ref(`${raizBanco}/convites_ranking`).once('value'),
            database.ref(`${raizBanco}/reservas`).once('value'),
            database.ref(`${raizBanco}/jogadores`).once('value'),
            database.ref(`${raizBanco}/config/ranking`).once('value')
        ]);

        const partidas = snapPartidas.val() || {};
        console.log("📊 [Audit Zeramento] Partidas encontradas no nó /ranking/partidas:", partidas);
        const tabelas = snapTabelas.val() || {};
        const convites = snapConvites.val() || {};
        const reservas = snapReservas.val() || {};
        const jogadores = snapJogadores.val() || {};
        const configRanking = snapConfig.val() || {};

        const faseAtual = parseInt(configRanking.faseAtual, 10) || 1;
        const cal = configRanking.calendario || {};
        const temCalendario = !!configRanking.calendario;

        // 1. Contagem das partidas ativas na temporada atual
        const totalPartidas = Object.keys(partidas).length;

        // 2. Unificação precisa de titulares inscritos (Fase 2 e Fase 3+) sem duplicidades
        const setInscritos = new Set(Object.keys(configRanking.inscritosConfirmados || {}));
        Object.values(tabelas).forEach(arr => {
            if (Array.isArray(arr)) {
                arr.forEach(id => { if (id) setInscritos.add(id); });
            }
        });
        const totalInscritos = setInscritos.size;

        // 3. Contagem de suplentes na fila de espera
        const filaEspera = configRanking.filaEspera || {};
        let totalSuplentes = 0;
        Object.keys(filaEspera).forEach(cat => {
            const suplentes = filaEspera[cat] || {};
            totalSuplentes += Object.keys(suplentes).length;
        });

        // 4. Filtragem EXCLUSIVA de reservas vinculadas ao temporadaId ativo
        const temporadaIdAtiva = convites.temporadaId || null;
        let totalReservasRanking = 0;
        const caminhosReservasExcluir = [];

        Object.keys(reservas).forEach(quadraKey => {
            const slots = reservas[quadraKey] || {};
            Object.keys(slots).forEach(slotKey => {
                const r = slots[slotKey];
                if (!r) return;

                // 🛡️ TRAVA 1: Ignora 100% agendamentos comuns de sócios (lazer)
                const ehRanking = (r.isRanking === true || r.isRanking === 'true' || r.tipo === 'ranking');
                if (!ehRanking) return;

                // 🛡️ TRAVA 2: Filtro Exclusivo por ID Único da Temporada Ativa (sem fallback de data)
                if (!temporadaIdAtiva || r.temporadaId !== temporadaIdAtiva) return;

                caminhosReservasExcluir.push(`reservas/${quadraKey}/${slotKey}`);
                if (r.borda === undefined && parseInt(r.duracao) === 2) return;
                totalReservasRanking++;
            });
        });

        // 5. Mapeamento de notificações ativas da temporada
        let totalNotificacoes = 0;
        const caminhosNotificacoesExcluir = [];
        Object.keys(jogadores).forEach(idJog => {
            if (jogadores[idJog] && jogadores[idJog].notificacoes) {
                const keysNotif = Object.keys(jogadores[idJog].notificacoes);
                totalNotificacoes += keysNotif.length;
                caminhosNotificacoesExcluir.push(`jogadores/${idJog}/notificacoes`);
            }
        });

        const totalGeral = totalPartidas + totalInscritos + totalSuplentes + totalReservasRanking;

        if (totalGeral === 0 && !snapConvites.exists() && faseAtual === 1 && !temCalendario) {
            showToast("O ranking já se encontra completamente zerado.", "info");
            return;
        }

        const linhaSuplentesHTML = totalSuplentes > 0 
            ? `<li><b>${totalSuplentes}</b> suplente(s) na <b>fila de espera</b>;</li>` 
            : '';

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
                        <li><b>${totalPartidas}</b> partida(s) registradas na <b>temporada ativa</b>;</li>
                        <li><b>${totalInscritos}</b> inscrição(ões) de titulares confirmados;</li>
                        ${linhaSuplentesHTML}
                        <li><b>${totalReservasRanking}</b> agendamento(s) da edição atual nas quadras;</li>
                        <li><b>${totalNotificacoes}</b> notificação(ões) nas caixas dos atletas;</li>
                        <li>Contrato de calendário, inscrições e fila de espera da edição atual.</li>
                    </ul>
                </div>

                <p style="margin: 8px 0 0 0; font-size: 12.5px; color: #64748b; font-weight: 500;">
                    <b>Nota de Segurança:</b> Deseja prosseguir?
                </p>
            </div>
        `;

        showPrompt("Balanço do Zeramento do Ranking", promptHTML, async () => {
            try {
                if (navigator.vibrate) navigator.vibrate(50); 

                // 1. Executa a remoção física direta das estruturas ativas do torneio
                await Promise.all([
                    database.ref(`${raizBanco}/ranking/partidas`).set(null),
                    database.ref(`${raizBanco}/ranking/tabelas`).remove(),
                    database.ref(`${raizBanco}/ranking/semeadura`).remove(), // 🌱 Limpa o cofre da semeadura do Torneio de Grupos
                    database.ref(`${raizBanco}/ranking/chaves`).remove(),
                    database.ref(`${raizBanco}/convites_ranking`).remove()
                ]);

                // 2. Atualiza os parâmetros de configuração e limpa reservas/notificações/fila vinculadas
                const updates = {};
                updates['config/ranking/faseAtual'] = 1;
                updates['config/ranking/calendario'] = null;
                updates['config/ranking/inscritosConfirmados'] = null;
                updates['config/ranking/filaEspera'] = null;
                updates['config/ranking/torneioConcluido'] = null;

                caminhosReservasExcluir.forEach(path => { updates[path] = null; });
                caminhosNotificacoesExcluir.forEach(path => { updates[path] = null; }); 

                await database.ref(raizBanco).update(updates); 

                // 3. Sincroniza a memória RAM imediatamente para evitar cache fantasma
                if (typeof rankingPartidasGlobal !== 'undefined') {
                    rankingPartidasGlobal = {};
                }
                if (typeof convitesRankingGlobal !== 'undefined') {
                    convitesRankingGlobal = null;
                }
                if (typeof configRegrasGlobal !== 'undefined' && configRegrasGlobal && configRegrasGlobal.ranking) {
                    configRegrasGlobal.ranking.faseAtual = 1;
                    configRegrasGlobal.ranking.calendario = null;
                    configRegrasGlobal.ranking.inscritosConfirmados = null;
                    configRegrasGlobal.ranking.filaEspera = null;
                    configRegrasGlobal.ranking.torneioConcluido = null;
                }

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
/* 3. ESTEIRA DINÂMICA DA TEMPORADA (MÁQUINA DE ESTADOS)   */
/* ======================================================== */

let categoriaGestaoAtivaSaaS = null;

function renderizarGestaoTemporadaSaaS() {
    const containerStepper = document.getElementById('stepper-gestor-container');
    const cardResumo = document.getElementById('card-resumo-calendario-saas');
    if (!containerStepper) return;

    const conf = (configRegrasGlobal && configRegrasGlobal.ranking) ? configRegrasGlobal.ranking : {};
    const cal = conf.calendario || {};
    
    // 💡 Lógica Neutra: Se houver formato salvo usa ele, senão assume o 'generico'
    const temContratoSalvo = !!cal.formatoTorneio;
    const modelo = temContratoSalvo ? cal.formatoTorneio : "generico";

    // 🛡️ DETEÇÃO DE HOMOLOGAÇÃO: Verifica se a edição ativa já foi homologada no histórico
    const edicaoIdAtual = cal.nomeTorneio ? `${new Date().getFullYear()}_${cal.nomeTorneio.replace(/\s+/g, '_')}` : '';
    const jaEstaNoHistorico = edicaoIdAtual && (
        typeof acervoHistoricoGlobalSaaS !== 'undefined' && 
        Array.isArray(acervoHistoricoGlobalSaaS) && 
        acervoHistoricoGlobalSaaS.some(item => item.id === edicaoIdAtual)
    );
    const itemHistoricoEdicao = jaEstaNoHistorico 
        ? acervoHistoricoGlobalSaaS.find(item => item.id === edicaoIdAtual) 
        : null;

    // 🎯 Prioriza a faseInicial congelada no contrato do torneio (imune a trocas na Aba 2)
    const faseInicialGrupos = cal.faseInicial || itemHistoricoEdicao?.contrato?.faseInicial || conf.grupos?.faseInicial || "grupos";
    const faseAtual = parseInt(conf.faseAtual, 10) || 1;

    // 🎯 Identificação universal do estado concluído
    const emMataMataDiretoEsteira = (modelo === 'grupos' && faseInicialGrupos === 'matamata');
    const torneioConcluido = conf.torneioConcluido === true || jaEstaNoHistorico || 
        (modelo !== "grupos" && faseAtual >= 4) || 
        (modelo === "grupos" && ((emMataMataDiretoEsteira && faseAtual >= 4) || (!emMataMataDiretoEsteira && faseAtual >= 5)));

    // 🎯 Ajuste dinâmico da esteira de Grupos conforme a Fase Inicial (5 ou 4 passos)
    const rotulosGrupos = (faseInicialGrupos === "matamata")
        ? ["1. Calendário", "2. Inscrições", "3. Mata-Mata", "4. Concluído"]
        : ["1. Calendário", "2. Inscrições", "3. Chaves", "4. Mata-Mata", "5. Concluído"];

    const rotulosPorModelo = {
        grupos: rotulosGrupos,
        barragem: ["1. Calendário", "2. Inscrições", "3. Pontos Corridos", "4. Concluído"],
        piramide: ["1. Calendário", "2. Inscrições", "3. Escada", "4. Concluído"],
        generico: ["1. Calendário", "2. Inscrições", "3. Competição", "4. Concluído"]
    };

    const listaRotulos = rotulosPorModelo[modelo] || rotulosPorModelo.generico;
    const totalPassos = listaRotulos.length;

    let htmlStepper = '';
    listaRotulos.forEach((rotulo, index) => {
        const numFase = index + 1;
        let classeNode = 'step-node';
        let conteudoCirculo = numFase;

        if (torneioConcluido) {
            if (numFase < totalPassos) {
                classeNode += ' concluido';
                conteudoCirculo = '<i class="material-icons" style="font-size: 16px;">check</i>';
            } else {
                classeNode += ' ativo';
            }
        } else {
            if (numFase < faseAtual) {
                classeNode += ' concluido';
                conteudoCirculo = '<i class="material-icons" style="font-size: 16px;">check</i>';
            } else if (numFase === faseAtual) {
                classeNode += ' ativo';
            }
        }

        htmlStepper += `
            <div class="${classeNode}" style="cursor: default;">
                <div class="step-circle">${conteudoCirculo}</div>
                <span class="step-label">${rotulo}</span>
            </div>
        `;
    });
    containerStepper.innerHTML = htmlStepper;

    // Se a fase for 1 ou o torneio estiver homologado, exibe o Painel 5 (Dourado de Campeões)
    let painelAlvo = faseAtual;
    if (faseAtual === 1 || torneioConcluido) {
        painelAlvo = 5;
    } else if (modelo === "grupos" && faseInicialGrupos === "matamata") {
        if (faseAtual === 3) painelAlvo = 4;
        if (faseAtual === 4) painelAlvo = 5;
    }

    document.querySelectorAll('#container-fases-gestor .fase-panel').forEach((panel, idx) => {
        if ((idx + 1) === painelAlvo) {
            panel.classList.add('ativa');
        } else {
            panel.classList.remove('ativa');
        }
    });

    
    // 🎯 SELETOR MODULAR DE CATEGORIA (CLASSE E GÊNERO) NA GESTÃO
    const chavesMap = (typeof rankingChavesGlobal !== 'undefined' && rankingChavesGlobal) ? rankingChavesGlobal : {};
    const tabelasMap = (typeof rankingTabelasGlobal !== 'undefined' && rankingTabelasGlobal) ? rankingTabelasGlobal : {};
    const categoriasTorneio = Array.from(new Set([
        ...Object.keys(chavesMap),
        ...Object.keys(tabelasMap)
    ])).sort();

    // Oculta o seletor quando o torneio estiver concluído ou zerado
    const emFaseCompeticao = (faseAtual >= 3 && !torneioConcluido && categoriasTorneio.length > 0);

    let containerSeletorCat = document.getElementById('container-seletor-gestor-categoria');
    const containerFases = document.getElementById('container-fases-gestor');
	
    if (!containerSeletorCat && containerFases) {
        containerSeletorCat = document.createElement('div');
        containerSeletorCat.id = 'container-seletor-gestor-categoria';
        containerFases.parentElement.insertBefore(containerSeletorCat, containerFases);
    }

    if (containerSeletorCat) {
        if (!emFaseCompeticao) {
            containerSeletorCat.style.display = 'none';
        } else {
            if (!categoriaGestaoAtivaSaaS || !categoriasTorneio.includes(categoriaGestaoAtivaSaaS)) {
                categoriaGestaoAtivaSaaS = categoriasTorneio[0] || 'A_MASCULINO';
            }

            const classesDisponiveis = Array.from(new Set(categoriasTorneio.map(cat => cat.split('_')[0]))).sort();
            const generosDisponiveis = Array.from(new Set(categoriasTorneio.map(cat => cat.split('_')[1] || 'MASCULINO'))).sort();

            const partesAtiva = (categoriaGestaoAtivaSaaS || 'A_MASCULINO').split('_');
            const classeAtiva = partesAtiva[0] || 'A';
            const generoAtivo = partesAtiva[1] || 'MASCULINO';

            const divGenero = conf.divisaoGenero || 'separado';

            let optionsClasseHtml = classesDisponiveis.map(c => `
                <option value="${c}" ${c === classeAtiva ? 'selected' : ''}>Classe ${c}</option>
            `).join('');

            let selectGeneroHtml = '';
            if (divGenero !== 'unificado') {
                const optionsGen = generosDisponiveis.map(g => `
                    <option value="${g}" ${g === generoAtivo ? 'selected' : ''}>${g === 'FEMININO' ? 'Feminino' : 'Masculino'}</option>
                `).join('');

                selectGeneroHtml = `
                    <select id="select-gestor-genero" style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 6px 12px; font-size: 12.5px; font-weight: 700; color: #1e293b; outline: none; cursor: pointer;">
                        ${optionsGen}
                    </select>
                `;
            }

            containerSeletorCat.style.cssText = 'display: flex; gap: 8px; justify-content: center; align-items: center; margin: 0 0 14px 0; padding: 8px 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px;';
            containerSeletorCat.innerHTML = `
                <span style="font-size: 11.5px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; gap: 4px;">
                    <i class="material-icons" style="font-size: 16px; color: #8b5cf6;">tune</i> Categoria:
                </span>
                <select id="select-gestor-classe" style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 6px 12px; font-size: 12.5px; font-weight: 700; color: #1e293b; outline: none; cursor: pointer;">
                    ${optionsClasseHtml}
                </select>
                ${selectGeneroHtml}
            `;

            const selCls = document.getElementById('select-gestor-classe');
            const selGen = document.getElementById('select-gestor-genero');

            const aplicarTrocaCategoriaGestao = () => {
                const novaClasse = selCls ? selCls.value : classeAtiva;
                const novoGenero = (selGen && divGenero !== 'unificado') ? selGen.value : (divGenero === 'unificado' ? 'UNIFICADO' : generoAtivo);
                
                let chaveCandidata = `${novaClasse}_${novoGenero}`;
                if (!categoriasTorneio.includes(chaveCandidata)) {
                    chaveCandidata = categoriasTorneio.find(k => k.startsWith(`${novaClasse}_`)) || categoriasTorneio[0];
                }

                categoriaGestaoAtivaSaaS = chaveCandidata;
                renderizarGestaoTemporadaSaaS();
                if (typeof atualizarBotaoRodapeRankingSaaS === 'function') {
                    atualizarBotaoRodapeRankingSaaS();
                }
            };

            if (selCls) selCls.onchange = aplicarTrocaCategoriaGestao;
            if (selGen) selGen.onchange = aplicarTrocaCategoriaGestao;
        }
    }

    const panelFase3 = document.querySelectorAll('#container-fases-gestor .fase-panel')[2];
    if (panelFase3) {
        const elBoxAviso = panelFase3.children[0];
        const btnAcaoFase3 = panelFase3.querySelector('button[onclick*="encerrarFase3EAvancarSaaS"]');

        if (elBoxAviso) {
            const partesCatFoco = (categoriaGestaoAtivaSaaS || 'A_MASCULINO').split('_');
            const rotuloCatTexto = `Classe ${partesCatFoco[0]}` + (partesCatFoco[1] && partesCatFoco[1] !== 'UNIFICADO' ? ` (${partesCatFoco[1] === 'FEMININO' ? 'Feminino' : 'Masculino'})` : '');

            if (modelo === 'barragem') {
                elBoxAviso.innerHTML = `
                    <p style="margin: 0 0 4px 0; font-weight: 700; color: #166534;">📍 Fase 3: Disputa por Pontos Corridos (Barragem) • ${rotuloCatTexto}</p>
                    <span style="display: block; font-size: 12.5px; color: #15803d; line-height: 1.4;">• Atletas somam pontos a cada partida realizada na temporada.</span>
                    <span style="display: block; font-size: 12.5px; color: #15803d; line-height: 1.4;">• Acompanhe a tabela do Leaderboard em tempo real e encerre ao fim do prazo.</span>
                `;
            } else if (modelo === 'piramide') {
                elBoxAviso.innerHTML = `
                    <p style="margin: 0 0 4px 0; font-weight: 700; color: #166534;">📍 Fase 3: Escada de Desafios (Pirâmide) • ${rotuloCatTexto}</p>
                    <span style="display: block; font-size: 12.5px; color: #15803d; line-height: 1.4;">• Atletas realizam desafios diretos para trocar de posição e subir na tabela.</span>
                    <span style="display: block; font-size: 12.5px; color: #15803d; line-height: 1.4;">• Acompanhe a movimentação em tempo real e encerre no prazo.</span>
                `;
            } else {
                elBoxAviso.innerHTML = `
                    <p style="margin: 0 0 4px 0; font-weight: 700; color: #166534;">📍 Fase 3: Fase de Chaves (Grupos) • ${rotuloCatTexto}</p>
                    <span style="display: block; font-size: 12.5px; color: #15803d; line-height: 1.4;">• Grupos congelados no banco e agendamentos restritos aos adversários da mesma chave.</span>
                    <span style="display: block; font-size: 12.5px; color: #15803d; line-height: 1.4;">• Acompanhe a classificação em tempo real e encerre ao fim das rodadas.</span>
                `;
            }
        }

        if (btnAcaoFase3) {
            btnAcaoFase3.style.display = 'none';
        }

        // 🔗 Vincula o botão para abrir a Central filtrada na categoria ativa selecionada na tela
        const btnVerTabelaFase3 = panelFase3.querySelector('button[onclick*="abrirLeaderboardSaaS"]') || 
                                  Array.from(panelFase3.querySelectorAll('button')).find(b => b !== btnAcaoFase3);
        if (btnVerTabelaFase3) {
            btnVerTabelaFase3.onclick = () => {
                const partes = (categoriaGestaoAtivaSaaS || 'A_MASCULINO').split('_');
                abaClasseAtivaSaaS = partes[0] || 'A';
                abaGeneroAtivaSaaS = partes[1] || 'MASCULINO';
                abaFaseAtivaSaaS = 'AUTO';
                if (typeof abrirLeaderboardSaaS === 'function') {
                    abrirLeaderboardSaaS();
                }
            };
        }
    }
    
    const panelFase4 = document.querySelectorAll('#container-fases-gestor .fase-panel')[3];
    const emMataMataDiretoF4 = (modelo === 'grupos' && faseInicialGrupos === 'matamata');
    const emFaseExibicaoMataMata = (modelo === 'grupos' && ((emMataMataDiretoF4 && faseAtual === 3) || (!emMataMataDiretoF4 && faseAtual === 4)));

    if (panelFase4 && emFaseExibicaoMataMata) {
        const elBoxAviso4 = panelFase4.children[0];
        if (elBoxAviso4) {
            const chaveCatFoco = categoriaGestaoAtivaSaaS || Object.keys(chavesMap)[0] || 'A_MASCULINO';
            const chaveInfoCat = chavesMap[chaveCatFoco] || {};
            const tamanhoChaveCat = parseInt(chaveInfoCat.faseAtual || (chaveInfoCat.rodada1 ? chaveInfoCat.rodada1.length * 2 : 2), 10);

            const rotuloAtual = (typeof obterRotuloFaseMataMataSaaS === 'function')
                ? obterRotuloFaseMataMataSaaS(tamanhoChaveCat)
                : "Mata-Mata"; 
            
            const artigoAtual = (tamanhoChaveCat === 2) ? "da" : "das";

            const partesCatFoco = chaveCatFoco.split('_');
            const rotuloCatTexto = `Classe ${partesCatFoco[0]}` + (partesCatFoco[1] && partesCatFoco[1] !== 'UNIFICADO' ? ` (${partesCatFoco[1] === 'FEMININO' ? 'Feminino' : 'Masculino'})` : '');

			let bulletInstrucao = "";
            let subtituloFase4 = `• Confrontos decisivos ${artigoAtual} ${rotuloAtual} em andamento.`;

            if (tamanhoChaveCat > 2) {
                const proximoTamanho = tamanhoChaveCat / 2;
                const rotuloProximo = (typeof obterRotuloFaseMataMataSaaS === 'function')
                    ? obterRotuloFaseMataMataSaaS(proximoTamanho)
                    : "Próxima Fase";
                const artigoProximo = (proximoTamanho === 2) ? "para a" : "para as";

                bulletInstrucao = `• Finalizados os jogos desta categoria, avance ${artigoProximo} ${rotuloProximo}.`;
            } else {
                // Afere o estado real da Grande Final desta categoria específica com blindagem de temporadaId
                const finalMatch = (chaveInfoCat.rodada1 && chaveInfoCat.rodada1[0]) || null;
                let finalConcluidaCat = false;
                let finalAgendadaCat = false;

                if (finalMatch) {
                    if (finalMatch.isBye) {
                        finalConcluidaCat = true;
                    } else {
                        // 1. Procura em rankingPartidasGlobal
                        const partidasMap = (typeof rankingPartidasGlobal !== 'undefined' && rankingPartidasGlobal) ? rankingPartidasGlobal : {};
                        const pFinal = Object.values(partidasMap).find(p => {
                            if (p.categoria !== chaveCatFoco || p.status !== 'finalizada') return false;
                            const dp = p.dadosPlacar || {};
                            if (p.tagGrupoRanking || dp.tagGrupoRanking) return false;
                            return (p.jogador1Id === finalMatch.jogador1Id && p.jogador2Id === finalMatch.jogador2Id) ||
                                   (p.jogador1Id === finalMatch.jogador2Id && p.jogador2Id === finalMatch.jogador1Id);
                        });

                        if (pFinal && pFinal.vencedorId) {
                            finalConcluidaCat = true;
                        } else {
                            // 2. Consulta em reservas com blindagem de temporadaId
                            const temporadaIdAtiva = (typeof convitesRankingGlobal !== 'undefined' && convitesRankingGlobal?.temporadaId)
                                ? convitesRankingGlobal.temporadaId
                                : null;

                            const reservasRAM = (typeof reservasGeralGlobal !== 'undefined' && reservasGeralGlobal) ? reservasGeralGlobal : {};
                            for (const qKey of Object.keys(reservasRAM)) {
                                const slots = reservasRAM[qKey] || {};
                                for (const sKey of Object.keys(slots)) {
                                    const r = slots[sKey];
                                    if (!r) continue;

                                    const ehRanking = (r.isRanking === true || r.isRanking === 'true' || r.tipo === 'ranking');
                                    if (!ehRanking) continue;

                                    // 🛡️ TRAVA CRUCIAL: Ignora partidas de edições ou testes anteriores
                                    if (temporadaIdAtiva && r.temporadaId !== temporadaIdAtiva) continue;
                                    if (!r.temporadaId) continue;

                                    const partesComp = (r.jogadores_completo || '').split(',').map(s => s.trim());
                                    const partesAp = (r.jogadores || '').split(',').map(s => s.trim());
                                    const id1 = (typeof obterIdJogadorPorTextoSaaS === 'function') ? obterIdJogadorPorTextoSaaS(partesComp[0] || partesAp[0]) : null;
                                    const id2 = (typeof obterIdJogadorPorTextoSaaS === 'function') ? obterIdJogadorPorTextoSaaS(partesComp[1] || partesAp[1]) : null;

                                    if ((id1 === finalMatch.jogador1Id && id2 === finalMatch.jogador2Id) ||
                                        (id1 === finalMatch.jogador2Id && id2 === finalMatch.jogador1Id)) {
                                        finalAgendadaCat = true;
                                        const dp = r.dadosPlacar || {};
                                        const st = r.statusPlacar || dp.statusPlacar || 'sem_placar';
                                        if (st === 'consolidado' && (dp.vencedorCodigo || dp.vencedor)) {
                                            finalConcluidaCat = true;
                                        }
                                        break;
                                    }
                                }
                                if (finalConcluidaCat) break;
                            }
                        }
                    }
                }

                if (finalConcluidaCat) {
                    subtituloFase4 = "• Grande Final desta categoria finalizada e homologada com sucesso!";
                    bulletInstrucao = "• Aguardando a conclusão das decisões das demais classes para concluir o torneio.";
                } else if (finalAgendadaCat) {
                    subtituloFase4 = "• Partida da Grande Final agendada nas quadras da arena.";
                    bulletInstrucao = "• Lance o resultado oficial da súmula para homologar esta categoria.";
                } else {
                    subtituloFase4 = "• Confronto da Grande Final definido no chaveamento.";
                    bulletInstrucao = "• Partida ainda não agendada. Crie a reserva na agenda de quadras para realizar a disputa.";
                }
            }

            elBoxAviso4.innerHTML = `
                <p style="margin: 0 0 4px 0; font-weight: 700; color: #6b21a8;">📍 Fase ${faseAtual}: Quadro Eliminatório (${rotuloAtual}) • ${rotuloCatTexto}</p>
                <span style="display: block; font-size: 12.5px; color: #7e22ce; line-height: 1.4;">${subtituloFase4}</span>
                <span style="display: block; font-size: 12.5px; color: #7e22ce; line-height: 1.4;">${bulletInstrucao}</span>
            `;
        }

        // 🔗 Vincula o botão central para abrir a Central filtrada na categoria ativa da tela
        const btnVerQuadro = panelFase4.querySelector('button[onclick*="abrirQuadroMataMataSaaS"]');
        if (btnVerQuadro) {
            btnVerQuadro.onclick = () => {
                const partes = (categoriaGestaoAtivaSaaS || 'A_MASCULINO').split('_');
                abaClasseAtivaSaaS = partes[0] || 'A';
                abaGeneroAtivaSaaS = partes[1] || 'MASCULINO';
                abaFaseAtivaSaaS = 'AUTO';
                if (typeof abrirLeaderboardSaaS === 'function') {
                    abrirLeaderboardSaaS();
                } else if (typeof abrirQuadroMataMataSaaS === 'function') {
                    abrirQuadroMataMataSaaS();
                }
            };
        }
    }

    const panelFase5 = document.getElementById('fase-panel-5');
    if (panelFase5) {
        const btnPainelAbrir = panelFase5.querySelector('button[onclick*="reiniciarEsteiraNovoTorneioSaaS"]');
        if (btnPainelAbrir) {
            btnPainelAbrir.style.display = 'none';
        }

        const elBoxAviso5 = panelFase5.children[0];
        if (elBoxAviso5) {
            if (faseAtual === 1) {
                elBoxAviso5.innerHTML = `
                    <p style="margin: 0 0 4px 0; font-weight: 700; color: #854d0e;">📍 Status: Nenhuma Temporada em Andamento</p>
                    <span style="display: block; font-size: 12.5px; color: #a16207; line-height: 1.4;">Seja bem-vindo à Gestão da Temporada! Nenhuma competição está ativa no momento. Clique no botão <b>"+ Criar Novo Torneio"</b> abaixo para configurar o calendário e abrir as inscrições.</span>
                `;
            } else {
                const nomeTorneio = cal.nomeTorneio || 'Torneio';
                elBoxAviso5.innerHTML = `
                    <p style="margin: 0 0 4px 0; font-weight: 700; color: #854d0e;">📍 Status: ${nomeTorneio} Finalizado & Homologado 🏆</p>
                    <span style="display: block; font-size: 12.5px; color: #a16207; line-height: 1.4;">Os resultados desta edição foram consolidados no histórico e a pontuação creditada no ranking anual do clube.</span>
                `;
            }
        }
    }

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

            const btnEditarResumo = cardResumo.querySelector('button[onclick*="editarCalendarioAtivoSaaS"]') || cardResumo.querySelector('.btn-editar');
            if (btnEditarResumo) {
                const podeEditar = (faseAtual === 2);
                btnEditarResumo.style.setProperty('display', podeEditar ? 'inline-flex' : 'none', 'important');
            }

            cardResumo.style.display = 'flex';
        } else {
            cardResumo.style.display = 'none';
        }
    }

    const inscritos = conf.inscritosConfirmados || {};
    const qtdInscritos = Object.keys(inscritos).length;

    const lblBadge = document.getElementById('lbl-qtd-inscritos-badge');
    const btnInscritos = document.getElementById('btn-saas-fase2-inscritos');
    const btnEncerrar = document.getElementById('btn-saas-fase2-encerrar');
    const btnConvites = document.getElementById('btn-saas-fase2-convites');

    if (lblBadge) lblBadge.textContent = qtdInscritos;
	
    const temFilaEsperaAtiva = Object.keys(conf.filaEspera || {}).some(cat => Object.keys(conf.filaEspera[cat] || {}).length > 0);
    if (btnInscritos) btnInscritos.disabled = (qtdInscritos === 0 && !temFilaEsperaAtiva);
	
    if (btnEncerrar) btnEncerrar.disabled = (qtdInscritos === 0); 

    if (btnConvites) {
        // 🎯 LEITURA DIRETA DA MEMÓRIA RAM DO CORE.JS:
        // Se o nó convitesRankingGlobal existir e estiver com status 'aberto' (ou já houver inscritos), considera os convites disparados.
        const temConvitesDisparados = (convitesRankingGlobal && convitesRankingGlobal.status === 'aberto') || qtdInscritos > 0;
        
        if (temConvitesDisparados) {
            btnConvites.innerHTML = '<i class="material-icons">mark_email_read</i> Repescagem / Enviar a Novos Sócios';
        } else {
            btnConvites.innerHTML = '<i class="material-icons">send</i> Disparar Convites aos Sócios';
        }
    }

    const btnZerar = document.querySelector('#modal-config-ranking .btn-ranking-reset');
    if (btnZerar && btnZerar.parentElement) {
        const exibirZerar = (faseAtual > 1 && !torneioConcluido);
        btnZerar.parentElement.style.display = exibirZerar ? 'block' : 'none';
    }
    
    if (typeof atualizarBotaoRodapeRankingSaaS === 'function') {
        atualizarBotaoRodapeRankingSaaS();
    }
	
	// 🔒 Invocação da trava de segurança para reavaliar os campos sempre que a esteira for renderizada
    if (typeof aplicarTravaParametrosCongeladosSaaS === 'function') {
        aplicarTravaParametrosCongeladosSaaS(conf);
    }
}


/* ======================================================== */
/* RENDERING E CONTROLE DE ESTADO DO RANKING GERAL (ABA 7)  */
/* ======================================================== */
let modoTabelaGeralSaaS = "OFICIAL"; 
let rascunhoRankingInicialSaaS = [];

function renderizarTabelaRankingGeralSaaS() {
    const tbody = document.getElementById('tbody-ranking-geral-saas');
    const selClasse = document.getElementById('sel-classe-geral');
    const selGenero = document.getElementById('sel-genero-geral');

    if (!tbody) return;

    const classe = selClasse ? selClasse.value : 'B';
    const genero = selGenero ? selGenero.value : 'MASCULINO';
    const chaveTabela = `${classe}_${genero}`;

    const listaGeralIDs = (typeof rankingGeralGlobal !== 'undefined' && rankingGeralGlobal && rankingGeralGlobal[chaveTabela])
        ? rankingGeralGlobal[chaveTabela]
        : [];

    const dictPontos = (typeof rankingPontosGeralGlobal !== 'undefined' && rankingPontosGeralGlobal && rankingPontosGeralGlobal[chaveTabela])
        ? rankingPontosGeralGlobal[chaveTabela]
        : ((typeof pontosGeralGlobal !== 'undefined' && pontosGeralGlobal && pontosGeralGlobal[chaveTabela])
            ? pontosGeralGlobal[chaveTabela]
            : {});

    // ESTADO 1: ZERO STATE (Nenhum atleta e não estamos no modo de edição)
    if (!Array.isArray(listaGeralIDs) || listaGeralIDs.length === 0) {
        if (modoTabelaGeralSaaS !== "EDICAO_INICIAL") {
            tbody.innerHTML = `
                <tr>
                    <td colspan="3" style="text-align: center; padding: 40px 20px; border: none;">
                        <p style="color: #94a3b8; font-size: 14px; margin: 0 0 15px 0;">Nenhum atleta cadastrado nesta categoria do Ranking Geral.</p>
                        <button type="button" onclick="event.stopPropagation(); ativarModoInsercaoInicialRankingSaaS()" style="background: #f1f5f9; border: 1px dashed #cbd5e1; color: #0284c7; padding: 10px 20px; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.2s;">
							<i class="material-icons" style="font-size: 18px;">post_add</i> Inserir Ranking Inicial
						</button>
                    </td>
                </tr>
            `;
            if (typeof atualizarBotaoRodapeRankingSaaS === 'function') atualizarBotaoRodapeRankingSaaS();
            return;
        }
    }

    // ESTADO 2: MODO DE EDIÇÃO DO RANKING INICIAL (FORMULÁRIO DINÂMICO)
    if (modoTabelaGeralSaaS === "EDICAO_INICIAL") {
        let htmlEdicao = '';

        if (!window.rascunhoRankingInicialSaaS || window.rascunhoRankingInicialSaaS.length === 0) {
            window.rascunhoRankingInicialSaaS = [{ idJ: "", pts: 0 }];
        }

        window.rascunhoRankingInicialSaaS.forEach((item, idx) => {
            htmlEdicao += gerarLinhaEdicaoRankingSaaS(item.idJ, item.pts, idx);
        });

        htmlEdicao += `
            <tr id="linha-btn-add-atleta">
                <td colspan="3" style="text-align: center; padding: 15px 0; border: none;">
                    <button type="button" onclick="adicionarLinhaRascunhoRankingSaaS()" style="background: #f1f5f9; border: 1px dashed #cbd5e1; color: #0284c7; padding: 8px 16px; border-radius: 8px; font-weight: 700; font-size: 12px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; transition: all 0.2s;">
                        <i class="material-icons" style="font-size: 16px;">add</i> Adicionar Atleta
                    </button>
                </td>
            </tr>
        `;

        tbody.innerHTML = htmlEdicao;
        if (typeof atualizarBotaoRodapeRankingSaaS === 'function') atualizarBotaoRodapeRankingSaaS();
        return;
    }

    // ESTADO 3: OFICIAL (TRANCADO)
    const idLogado = localStorage.getItem('jogadorLogadoId');
    let htmlOficial = '';

    listaGeralIDs.forEach((idAtleta, index) => {
        const atleta = (typeof jogadoresGlobal !== 'undefined' && jogadoresGlobal[idAtleta]) ? jogadoresGlobal[idAtleta] : {};
        const pos = index + 1;
        const nomeAtleta = atleta.nomeCompleto || atleta.apelido || 'Atleta';
        const pts = parseInt(dictPontos[idAtleta], 10) || 0;
        const ehVoce = (idAtleta === idLogado);

        htmlOficial += `
            <tr class="row-atleta-geral-item ${ehVoce ? 'voce' : ''}" data-nome="${nomeAtleta.toLowerCase()}" style="${ehVoce ? 'background: #f0fdf4;' : ''}">
                <td style="text-align: left; padding-left: 8px; font-weight: 800; color: #64748b;">${pos}º</td>
                <td style="text-align: left; font-weight: 700; color: ${ehVoce ? '#15803d' : '#1e293b'};">${nomeAtleta} ${ehVoce ? '(Você)' : ''}</td>
                <td style="text-align: right; padding-right: 8px; font-weight: 800; color: ${pts > 0 ? '#15803d' : '#94a3b8'};">${pts} pts</td>
            </tr>
        `;
    });

    tbody.innerHTML = htmlOficial;
    if (typeof atualizarBotaoRodapeRankingSaaS === 'function') atualizarBotaoRodapeRankingSaaS();
}

function ativarModoInsercaoInicialRankingSaaS() {
    modoTabelaGeralSaaS = "EDICAO_INICIAL";
    window.rascunhoRankingInicialSaaS = [{ idJ: "", pts: 0 }];
    renderizarTabelaRankingGeralSaaS();

    // 📱 REFORÇO EXCLUSIVO PARA O MOBILE (SANFONA)
    if (window.innerWidth <= 768) {
        const itemAba7 = document.getElementById('accordion-item-ranking-geral');
        if (itemAba7) {
            itemAba7.classList.add('active');
            itemAba7.classList.add('mobile-opened');

            const content = itemAba7.querySelector('.accordion-content');
            if (content) {
                content.style.maxHeight = '3000px';
            }
        }
    }
}

/* AUXILIARES DE CONSTRUÇÃO DAS LINHAS EDITÁVEIS */
function gerarLinhaEdicaoRankingSaaS(idSelecionado, pts, indice) {
    let optionsAtletas = '<option value="">Selecione o atleta...</option>';

    const selClasse = document.getElementById('sel-classe-geral');
    const selGenero = document.getElementById('sel-genero-geral');
    const filtroClasse = selClasse ? selClasse.value.toUpperCase() : 'B';
    const filtroGenero = selGenero ? selGenero.value.toUpperCase() : 'MASCULINO';

    if (typeof jogadoresGlobal !== 'undefined' && jogadoresGlobal) {
        const listaAtletas = Object.keys(jogadoresGlobal)
            .filter(id => jogadoresGlobal[id] && jogadoresGlobal[id].ativo !== false && jogadoresGlobal[id].participaRanking === true)
            .map(id => ({ id: id, nome: (jogadoresGlobal[id].apelido || jogadoresGlobal[id].nomeCompleto || "").toUpperCase(), obj: jogadoresGlobal[id] }))
            .sort((a, b) => a.nome.localeCompare(b.nome));

        listaAtletas.forEach(atleta => {
            const j = atleta.obj;
            const cAtleta = (j.classe || 'B').toUpperCase().replace('CLASSE_', '').trim();
            let gAtleta = (j.genero || 'MASCULINO').toUpperCase().trim();
            if (gAtleta === 'NAO_INFORMAR') gAtleta = 'MASCULINO';

            const classeBate = (cAtleta === filtroClasse);
            const generoBate = (filtroGenero === 'UNIFICADO' || gAtleta === filtroGenero);

            if (classeBate && generoBate) {
                const isSelected = (atleta.id === idSelecionado) ? 'selected' : '';
                const nomeLabel = j.apelido ? `${j.nomeCompleto} (${j.apelido})` : j.nomeCompleto;
                optionsAtletas += `<option value="${atleta.id}" ${isSelected}>${nomeLabel}</option>`;
            }
        });
    }

    return `
        <tr class="linha-edicao-ranking-inicial" data-index="${indice}">
            <td style="font-weight: 800; color: #64748b; padding-left: 4px; width: 35px; text-align: left;">${indice + 1}º</td>
            <td style="width: auto;">
                <div style="display: flex; gap: 6px; align-items: center; width: 100%;">
                    <select class="select-jogador-inicial" onchange="atualizarRascunhoRankingSaaS(${indice}, 'idJ', this.value)" style="flex: 1; width: 100%; min-width: 0; padding: 8px 6px; font-size: 12.5px; font-weight: 600; border-radius: 8px; border: 1px solid #cbd5e1; background: #f8fafc; color: #1e293b; outline: none; cursor: pointer;">
                        ${optionsAtletas}
                    </select>
                    <button type="button" onclick="removerLinhaRascunhoRankingSaaS(${indice})" title="Remover Atleta" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 2px; display: flex; align-items: center; justify-content: center; border-radius: 6px; flex-shrink: 0; transition: background 0.2s;">
                        <i class="material-icons" style="font-size: 18px;">delete_outline</i>
                    </button>
                </div>
            </td>
            <td style="text-align: right; padding-right: 4px; width: 65px;">
                <input type="number" value="${pts === 0 ? '' : pts}" placeholder="0" class="input-pts-inicial" oninput="atualizarRascunhoRankingSaaS(${indice}, 'pts', this.value)" style="width: 60px; padding: 8px 6px; font-size: 13px; font-weight: 800; border-radius: 6px; border: 1px solid #cbd5e1; outline: none; color: #1e293b; text-align: right; background: #ffffff;">
                <style>
                    .input-pts-inicial:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.15); }
                    .input-pts-inicial::-webkit-outer-spin-button, .input-pts-inicial::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
                    .input-pts-inicial[type=number] { -moz-appearance: textfield; }
                </style>
            </td>
        </tr>
    `;
}


function adicionarLinhaRascunhoRankingSaaS() {
    if (!window.rascunhoRankingInicialSaaS) window.rascunhoRankingInicialSaaS = [];
    window.rascunhoRankingInicialSaaS.push({ idJ: "", pts: 0 });
    renderizarTabelaRankingGeralSaaS();
}

function removerLinhaRascunhoRankingSaaS(index) {
    if (!window.rascunhoRankingInicialSaaS) return;
    window.rascunhoRankingInicialSaaS.splice(index, 1);
    renderizarTabelaRankingGeralSaaS();
}

function atualizarRascunhoRankingSaaS(index, campo, valor) {
    if (window.rascunhoRankingInicialSaaS && window.rascunhoRankingInicialSaaS[index]) {
        if (campo === 'pts') {
            window.rascunhoRankingInicialSaaS[index].pts = parseInt(valor, 10) || 0;
        } else {
            window.rascunhoRankingInicialSaaS[index].idJ = valor;
        }
    }
}

function filtrarTabelaRankingGeralSaaS() {
    const inp = document.getElementById('inp-busca-atleta-geral');
    if (!inp) return;
    const termo = inp.value.toLowerCase().trim();
    
    const selectorClass = modoTabelaGeralSaaS === "EDICAO_INICIAL" ? '.linha-edicao-ranking-inicial' : '.row-atleta-geral-item';
    const rows = document.querySelectorAll(`#tbody-ranking-geral-saas ${selectorClass}`);

    rows.forEach(tr => {
        if (modoTabelaGeralSaaS === "EDICAO_INICIAL") {
            const selectEl = tr.querySelector('.select-jogador-inicial');
            if (selectEl) {
                const nomeSelecionado = selectEl.options[selectEl.selectedIndex].text.toLowerCase();
                tr.style.display = nomeSelecionado.includes(termo) ? '' : 'none';
            }
        } else {
            const nome = tr.getAttribute('data-nome') || '';
            tr.style.display = nome.includes(termo) ? '' : 'none';
        }
    });
}

/* GRAVAÇÃO ATÔMICA E BLOQUEIO DO RANKING INICIAL NO FIREBASE */
function salvarRankingInicialNoBancoSaaS() {
    if (!isGestorLogado || !raizBanco) return;

    if (!window.rascunhoRankingInicialSaaS || window.rascunhoRankingInicialSaaS.length === 0) {
        showToast("Adicione pelo menos um atleta antes de salvar.", "warning");
        return;
    }

    // Filtra apenas as linhas com atleta selecionado
    const inscritosReais = window.rascunhoRankingInicialSaaS.filter(item => item.idJ && item.idJ.trim() !== "");

    if (inscritosReais.length === 0) {
        showToast("Selecione pelo menos um atleta na tabela antes de salvar.", "warning");
        return;
    }

    // Valida se não há atletas duplicados na lista
    const idsSelecionados = inscritosReais.map(i => i.idJ);
    const temDuplicado = new Set(idsSelecionados).size !== idsSelecionados.length;
    
    if (temDuplicado) {
        showToast("Erro: O mesmo atleta foi selecionado mais de uma vez na tabela.", "error");
        return;
    }

    // Ordena do maior pontuador para o menor (define as posições 1º, 2º, 3º...)
    inscritosReais.sort((a, b) => (parseInt(b.pts, 10) || 0) - (parseInt(a.pts, 10) || 0));

    const selClasse = document.getElementById('sel-classe-geral');
    const selGenero = document.getElementById('sel-genero-geral');
    const classe = selClasse ? selClasse.value : 'B';
    const genero = selGenero ? selGenero.value : 'MASCULINO';
    const chaveTabela = `${classe}_${genero}`;

    if (navigator.vibrate) navigator.vibrate(40);
    showToast("Gravando saldo do ranking no banco...", "info"); 

    const updates = {};
    const arrayHierarquiaIDs = [];
    const dicionarioPontos = {};

    inscritosReais.forEach(item => {
        const pontosNum = parseInt(item.pts, 10) || 0;
        arrayHierarquiaIDs.push(item.idJ);
        dicionarioPontos[item.idJ] = pontosNum;
    });

    updates[`ranking/ranking_geral/${chaveTabela}`] = arrayHierarquiaIDs;
    updates[`ranking/pontos_geral/${chaveTabela}`] = dicionarioPontos;

    database.ref(raizBanco).update(updates)
        .then(() => {
            modoTabelaGeralSaaS = "OFICIAL";
            window.rascunhoRankingInicialSaaS = [];
            showToast("Ranking inicial gravado e bloqueado com sucesso!", "success");
            
            // Redesenha a tabela trancada no modo leitura oficial
            renderizarTabelaRankingGeralSaaS();
        })
        .catch(err => {
            console.error("❌ Erro ao gravar ranking inicial:", err);
            showToast("Erro ao gravar dados no Firebase.", "error");
        });
}

/* GRAVAÇÃO DOS PARÂMETROS DE PONTUAÇÃO DO RANKING GERAL */
function salvarParametrosRankingGeralSaaS() {
    if (!isGestorLogado || !raizBanco) {
        showToast("Apenas o gestor pode alterar os parâmetros do Ranking Geral.", "warning");
        return;
    }

    const pts1 = parseInt(document.getElementById('cfg-pts-1')?.value, 10) || 0;
    const pts2 = parseInt(document.getElementById('cfg-pts-2')?.value, 10) || 0;
    const pts3 = parseInt(document.getElementById('cfg-pts-3')?.value, 10) || 0;
    const pts4 = parseInt(document.getElementById('cfg-pts-4')?.value, 10) || 0;
    const ptsPart = parseInt(document.getElementById('cfg-pts-part')?.value, 10) || 0;
    const descarteN = parseInt(document.getElementById('cfg-descarte-n')?.value, 10) || 0;
    const validadeMeses = parseInt(document.getElementById('cfg-validade-meses')?.value, 10) || 12;

    const descarteAtivo = document.getElementById('chk-descarte-ativo')?.checked ?? true;
    const validadeAtiva = document.getElementById('chk-validade-ativa')?.checked ?? true;

    if (pts1 <= 0 || pts2 <= 0) {
        showToast("Informe pontuações válidas para o campeão e vice.", "warning");
        return;
    }

    if (navigator.vibrate) navigator.vibrate(30);

    const payloadParametros = {
        pontos1: pts1,
        pontos2: pts2,
        pontos3: pts3,
        pontos4: pts4,
        pontosParticipacao: ptsPart,
        descarteN: descarteN,
        descarteAtivo: descarteAtivo,
        validadeMeses: validadeMeses,
        validadeAtiva: validadeAtiva,
        dataAtualizacao: Date.now()
    };

    database.ref(`${raizBanco}/config/ranking/parametrosGeral`).update(payloadParametros)
    .then(() => {
        showToast("Parâmetros do Ranking Geral salvos com sucesso!", "success");
    })
    .catch(err => {
        console.error("❌ Erro ao salvar parâmetros do Ranking Geral:", err);
        showToast("Erro ao gravar parâmetros no Firebase.", "error");
    });
}


/* LEITURA E PREENCHIMENTO DOS PARÂMETROS DO RANKING GERAL */
function preencherCamposParametrosRankingGeralSaaS() {
    const conf = (typeof configRegrasGlobal !== 'undefined' && configRegrasGlobal && configRegrasGlobal.ranking) ? configRegrasGlobal.ranking : {};
    const p = conf.parametrosGeral || {};

    const el1 = document.getElementById('cfg-pts-1');
    const el2 = document.getElementById('cfg-pts-2');
    const el3 = document.getElementById('cfg-pts-3');
    const el4 = document.getElementById('cfg-pts-4');
    const elPart = document.getElementById('cfg-pts-part');
    const elDesc = document.getElementById('cfg-descarte-n');
    const elVal = document.getElementById('cfg-validade-meses');

    const chkDesc = document.getElementById('chk-descarte-ativo');
    const chkVal = document.getElementById('chk-validade-ativa');

    if (el1) el1.value = p.pontos1 !== undefined ? p.pontos1 : 250;
    if (el2) el2.value = p.pontos2 !== undefined ? p.pontos2 : 180;
    if (el3) el3.value = p.pontos3 !== undefined ? p.pontos3 : 120;
    if (el4) el4.value = p.pontos4 !== undefined ? p.pontos4 : 60;
    if (elPart) elPart.value = p.pontosParticipacao !== undefined ? p.pontosParticipacao : 20;
    if (elDesc) elDesc.value = p.descarteN !== undefined ? p.descarteN : 5;
    if (elVal) elVal.value = p.validadeMeses !== undefined ? p.validadeMeses : 12;

    const isDescAtivo = p.descarteAtivo !== undefined ? p.descarteAtivo : true;
    const isValAtiva = p.validadeAtiva !== undefined ? p.validadeAtiva : true;

    if (chkDesc) {
        chkDesc.checked = isDescAtivo;
        toggleCampoConfigSaaS('cfg-descarte-n', isDescAtivo);
    }
    if (chkVal) {
        chkVal.checked = isValAtiva;
        toggleCampoConfigSaaS('cfg-validade-meses', isValAtiva);
    }
}


/* BALÃO EXPLICATIVO AO CLICAR NO ÍCONE (?) */
function mostrarAjudaIconeSaaS(e, el, texto) {
    if (e) e.stopPropagation();

    let balaoExistente = el.parentElement.querySelector('.mini-tooltip-ajuda');
    if (balaoExistente) {
        balaoExistente.remove();
        return;
    }

    document.querySelectorAll('.mini-tooltip-ajuda').forEach(b => b.remove());

    const balao = document.createElement('div');
    balao.className = 'mini-tooltip-ajuda';
    balao.innerText = texto;
    balao.style.cssText = 'position: absolute; top: 22px; left: 0; z-index: 99; background: #1e293b; color: #ffffff; padding: 8px 12px; border-radius: 8px; font-size: 11px; font-weight: 500; width: 220px; box-shadow: 0 4px 14px rgba(0,0,0,0.2); line-height: 1.35; text-transform: none; pointer-events: auto;';

    el.parentElement.style.position = 'relative';
    el.parentElement.appendChild(balao);

    const fechar = () => {
        balao.remove();
        document.removeEventListener('click', fechar);
    };
    setTimeout(() => document.addEventListener('click', fechar), 10);
}

/* HABILITA OU DESABILITA O CAMPO DE INPUT CONFORME O SWITCH */
function toggleCampoConfigSaaS(inputId, ativo) {
    const inputEl = document.getElementById(inputId);
    if (!inputEl) return;

    inputEl.disabled = !ativo;
    if (ativo) {
        inputEl.style.opacity = "1";
        inputEl.style.background = "#ffffff";
        inputEl.style.cursor = "text";
    } else {
        inputEl.style.opacity = "0.5";
        inputEl.style.background = "#f1f5f9";
        inputEl.style.cursor = "not-allowed";
    }
}

/* 1. ABRE A MODAL DE ZERAR E LISTA APENAS AS CATEGORIAS QUE POSSUEM DADOS */
function zerarPontuacaoRankingGeralSaaS() {
    if (!isGestorLogado || !raizBanco) return;

    const modal = document.getElementById('modal-zerar-ranking-saas');
    const container = document.getElementById('container-chk-categorias-zerar');
    const inputPalavra = document.getElementById('input-confirmacao-palavra-zerar');
    const chkTodas = document.getElementById('chk-zerar-todas-categorias');
    const btnExecutar = document.getElementById('btn-executar-zerar-ranking');

    if (!modal || !container) return;

    // Reseta o estado inicial do formulário
    container.innerHTML = '<div style="padding: 12px; text-align: center; color: #64748b; font-size: 13px;">Verificando rankings ativos...</div>';
    if (inputPalavra) { inputPalavra.value = ''; inputPalavra.disabled = true; }
    if (chkTodas) { chkTodas.checked = false; chkTodas.disabled = true; }
    if (btnExecutar) {
        btnExecutar.disabled = true;
        btnExecutar.style.opacity = '0.5';
        btnExecutar.style.cursor = 'not-allowed';
    }

    modal.style.display = 'flex';

    // Consulta o Firebase para identificar quais categorias realmente têm dados
    database.ref(`${raizBanco}/ranking`).once('value').then(snapshot => {
        const dadosRanking = snapshot.val() || {};
        const pontosGeral = dadosRanking.pontos_geral || {};
        const rankingGeral = dadosRanking.ranking_geral || {};

        // Une as chaves existentes em pontos_geral e ranking_geral
        const chavesExistentes = Array.from(new Set([
            ...Object.keys(pontosGeral),
            ...Object.keys(rankingGeral)
        ]));

        if (chavesExistentes.length === 0) {
            container.innerHTML = `
                <div style="padding: 16px; text-align: center; background: #f1f5f9; border-radius: 8px; color: #64748b; font-size: 13px; font-weight: 600;">
                    ℹ️ Nenhum ranking acumulado encontrado no clube para zerar.
                </div>
            `;
            return;
        }

        // Categoria atualmente selecionada nos dropdowns do painel
        const selClasse = document.getElementById('sel-classe-geral');
        const selGenero = document.getElementById('sel-genero-geral');
        const classeAtual = selClasse ? selClasse.value : 'B';
        const generoAtual = selGenero ? selGenero.value : 'MASCULINO';
        const chaveAtual = `${classeAtual}_${generoAtual}`;

        // Habilita as opções globais
        if (inputPalavra) inputPalavra.disabled = false;
        if (chkTodas) chkTodas.disabled = false;

        let htmlChk = '';
        chavesExistentes.sort().forEach(chave => {
            const partes = chave.split('_');
            const c = partes[0] || '';
            const g = partes.slice(1).join('_') || '';

            const labelClasse = c.startsWith('CLASSE') ? c.replace('CLASSE', 'Classe ') : `Classe ${c}`;
            const labelGenero = g ? (g.charAt(0) + g.slice(1).toLowerCase()) : '';
            const labelVisivel = `${labelClasse} - ${labelGenero}`;
            
            const isChecked = (chave === chaveAtual) ? 'checked' : '';

            htmlChk += `
                <label style="display: flex; align-items: center; gap: 10px; padding: 8px 10px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; color: #334155;">
                    <input type="checkbox" class="chk-categoria-zerar-item" value="${chave}" ${isChecked} onchange="validarLiberacaoBotaoZerar()" style="width: 16px; height: 16px; accent-color: #ef4444; cursor: pointer;">
                    <span>${labelVisivel}</span>
                </label>
            `;
        });

        container.innerHTML = htmlChk;
        validarLiberacaoBotaoZerar();

    }).catch(err => {
        console.error("❌ Erro ao buscar rankings no Firebase:", err);
        container.innerHTML = '<div style="padding: 12px; text-align: center; color: #ef4444; font-size: 13px;">Erro ao carregar categorias. Tente novamente.</div>';
    });
}

/* 2. FECHAR A MODAL */
function fecharModalZerarRankingSaaS() {
    const modal = document.getElementById('modal-zerar-ranking-saas');
    if (modal) modal.style.display = 'none';
}

/* 3. ALTERNAR SELEÇÃO DE TODAS AS CHECKBOXES */
function alternarSelecaoTodasCategoriasZerar(marcarTodas) {
    const itens = document.querySelectorAll('.chk-categoria-zerar-item');
    itens.forEach(chk => chk.checked = marcarTodas);
    validarLiberacaoBotaoZerar(); 
}

/* 4. VALIDAR SE PODE LIBERAR O BOTÃO DE CONFIRMAÇÃO */
function validarLiberacaoBotaoZerar() {
    const inputPalavra = document.getElementById('input-confirmacao-palavra-zerar');
    const btnExecutar = document.getElementById('btn-executar-zerar-ranking');
    const selecionadas = document.querySelectorAll('.chk-categoria-zerar-item:checked');

    if (!inputPalavra || !btnExecutar) return;

    const palavraDigitada = inputPalavra.value.trim().toUpperCase();
    const temCategoriaMarcada = selecionadas.length > 0;
    const palavraCorreta = (palavraDigitada === 'ZERAR');

    if (temCategoriaMarcada && palavraCorreta) {
        btnExecutar.disabled = false;
        btnExecutar.style.opacity = '1';
        btnExecutar.style.cursor = 'pointer';
    } else {
        btnExecutar.disabled = true;
        btnExecutar.style.opacity = '0.5';
        btnExecutar.style.cursor = 'not-allowed';
    }
}

/* 5. EXECUTA O APAGAMENTO NO FIREBASE DAS CATEGORIAS SELECIONADAS */
function executarApagamentoCategoriasSelecionadasSaaS() {
    if (!isGestorLogado || !raizBanco) return;

    const selecionadas = document.querySelectorAll('.chk-categoria-zerar-item:checked');
    const inputPalavra = document.getElementById('input-confirmacao-palavra-zerar');
    const btnExecutar = document.getElementById('btn-executar-zerar-ranking');

    if (!selecionadas || selecionadas.length === 0) {
        showToast("Selecione ao menos uma categoria para zerar.", "warning");
        return;
    }

    if (!inputPalavra || inputPalavra.value.trim().toUpperCase() !== 'ZERAR') {
        showToast("Digite a palavra ZERAR corretamente para confirmar.", "warning");
        return;
    }

    // Coleta as chaves selecionadas
    const chavesParaZerar = Array.from(selecionadas).map(chk => chk.value);

    // Desabilita o botão para evitar duplo clique
    if (btnExecutar) {
        btnExecutar.disabled = true;
        btnExecutar.innerText = "Zerando dados...";
    }

    if (navigator.vibrate) navigator.vibrate([80, 50, 80]);

    // Monta os updates para remoção no Firebase
    const updates = {};
    chavesParaZerar.forEach(chave => {
        updates[`ranking/ranking_geral/${chave}`] = null;
        updates[`ranking/pontos_geral/${chave}`] = null;
    });

    database.ref(raizBanco).update(updates)
        .then(() => {
            showToast(`Ranking de ${chavesParaZerar.length} categoria(s) zerado com sucesso!`, "success");
            
            fecharModalZerarRankingSaaS();

            // Atualiza a exibição da tabela principal se a categoria atual estiver entre as zeradas
            if (typeof modoTabelaGeralSaaS !== 'undefined') {
                modoTabelaGeralSaaS = "OFICIAL";
            }
            renderizarTabelaRankingGeralSaaS();
        })
        .catch(err => {
            console.error("❌ Erro ao zerar categorias do ranking:", err);
            showToast("Erro ao zerar dados no Firebase.", "error");
            if (btnExecutar) {
                btnExecutar.disabled = false;
                btnExecutar.innerText = "Confirmo e Quero Zerar";
            }
        });
}

/* EXECUÇÃO DEFINITIVA DO ZERAMENTO */
function executarZeramentoRankingGeralSaaS() {
    if (!isGestorLogado || !raizBanco) {
        showToast("Operação não autorizada.", "warning");
        return;
    }

    if (navigator.vibrate) navigator.vibrate([50, 50, 50]);

    const updates = {};
    updates[`${raizBanco}/ranking/pontos_geral`] = null;
    updates[`${raizBanco}/ranking/ranking_geral`] = null;

    database.ref().update(updates)
    .then(() => {
        fecharModalZerarRankingGeralSaaS();
        showToast("Pontuação do Ranking Geral zerada com sucesso!", "success");
        if (typeof renderizarTabelaRankingGeralSaaS === 'function') {
            renderizarTabelaRankingGeralSaaS();
        }
    })
    .catch(err => {
        console.error("❌ Erro ao zerar pontuação do Ranking Geral:", err);
        showToast("Erro ao zerar pontuação no Firebase.", "error");
    });
}

/* ======================================================== */
/* 3.1 GRAVAÇÃO E EDIÇÃO DO CALENDÁRIO (FASE 1)             */
/* ======================================================== */

/* ALTERNÂNCIA DE VISÃO DA 7ª ABA (TABELA vs CONFIGURAÇÕES) */
function toggleVisaoRankingGeralSaaS(e) {
    if (e) e.stopPropagation();

    const vTabela = document.getElementById('visao-tabela-ranking-geral');
    const vConfig = document.getElementById('visao-config-ranking-geral');
    const topBar = document.querySelector('#accordion-item-ranking-geral .ranking-top-bar');

    if (!vTabela || !vConfig) return;

    if (vTabela.style.display === 'none') {
        vTabela.style.display = 'block';
        vConfig.style.display = 'none';
        if (topBar) topBar.style.display = '';
    } else {
        vTabela.style.display = 'none';
        vConfig.style.display = 'block';
        if (topBar) topBar.style.display = 'none';
    }

    if (typeof atualizarBotaoRodapeRankingSaaS === 'function') {
        atualizarBotaoRodapeRankingSaaS();
    }
}

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


function salvarCalendarioEAbrirInscricoesSaaS() {
    if (!isGestorLogado || !raizBanco) {
        showToast("Apenas o gestor pode alterar o calendário do torneio.", "warning");
        return;
    }

    const nome = document.getElementById('inp-torneio-nome').value.trim();
    const formatoTorneioEscolhido = document.getElementById('inp-torneio-modelo').value;
    const vagasRaw = document.getElementById('inp-torneio-vagas').value.trim();

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

    if (!nome) {
        showToast("Preencha o Nome Oficial do Torneio.", "warning");
        return;
    }

    if (!formatoTorneioEscolhido) {
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

    const confGlobalCheck = (configRegrasGlobal && configRegrasGlobal.ranking) ? configRegrasGlobal.ranking : {};
    const divGenero = confGlobalCheck.divisaoGenero || 'separado';
    const gruposConfig = confGlobalCheck.grupos || {};

    const temClasse = categoriasHabilitadas.some(cat => cat.startsWith('CLASSE_'));
    const temGenero = categoriasHabilitadas.includes('MASCULINO') || categoriasHabilitadas.includes('FEMININO');

    if (!temClasse) {
        showToast("Selecione ao menos uma Classe (A, B ou C) nas pílulas habilitadas.", "warning");
        return;
    }

    if (divGenero !== 'unificado' && !temGenero) {
        showToast("Selecione ao menos um Gênero (Masculino ou Feminino) nas pílulas habilitadas.", "warning");
        return;
    }

    if (!dtIncIni || !dtIncFim || !dtJogIni || !dtJogFim) {
        showToast("Preencha todas as 4 datas oficiais do calendário.", "warning");
        return;
    }

    if (navigator.vibrate) navigator.vibrate(30);

    // Função interna auxiliar para envio de PDF opcional
    const uploadPdfOpcional = () => {
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
    };

    // 🔒 1. CENÁRIO: MODO DE EDIÇÃO (TORNEIO EM ANDAMENTO - PRESERVAÇÃO TOTAL)
    if (window.emModoEdicaoCalendarioSaaS === true) {
        showToast("Salvando alterações do torneio...", "info");

        const payloadEdicao = {
            nomeTorneio: nome,
            fimInscricoes: dtIncFim,
            inicioJogos: dtJogIni,
            fimTorneio: dtJogFim
        };

        database.ref(`${raizBanco}/config/ranking/calendario`).update(payloadEdicao)
        .then(() => {
            // Sincroniza a memória RAM imediatamente
            if (typeof configRegrasGlobal !== 'undefined' && configRegrasGlobal && configRegrasGlobal.ranking && configRegrasGlobal.ranking.calendario) {
                Object.assign(configRegrasGlobal.ranking.calendario, payloadEdicao);
            }

            window.emModoEdicaoCalendarioSaaS = false;
            showToast("Alterações do calendário salvas com sucesso!", "success");

            uploadPdfOpcional();

            if (typeof renderizarGestaoTemporadaSaaS === 'function') {
                renderizarGestaoTemporadaSaaS();
            }
        })
        .catch(err => {
            console.error("❌ [Torneios] Erro ao atualizar calendário:", err);
            showToast("Erro ao salvar alterações no Firebase.", "error");
        });

        return; // Interrompe para NÃO executar o reset de criação abaixo
    }

    // 🚀 2. CENÁRIO: CRIAÇÃO DO ZERO (ABERTURA INICIAL DA TEMPORADA)
    const payloadCalendario = {
        nomeTorneio: nome,
        formatoTorneio: formatoTorneioEscolhido,
        faseInicial: (formatoTorneioEscolhido === 'grupos') ? (gruposConfig.faseInicial || 'grupos') : 'grupos',
        limiteVagas: limiteVagas,
        categoriasHabilitadas: categoriasHabilitadas,
        inicioInscricoes: dtIncIni,
        fimInscricoes: dtIncFim,
        inicioJogos: dtJogIni,
        fimTorneio: dtJogFim,
        tamanhoGrupo: parseInt(gruposConfig.tamanhoGrupo, 10) || 3,
        classificadosGrupo: parseInt(gruposConfig.classificadosGrupo, 10) || 2,
        criterioDesempate: gruposConfig.criterioDesempate || 'games_confronto_sorteio'
    };

    showToast("Gravando contrato e limpando área de trabalho do ranking...", "info");

    console.log("🧹 [Torneios] Limpando área interna do ranking (mantendo /reservas intocado)...");

    // 🛡️ LIMPEZA FÍSICA APENAS NA CRIAÇÃO INICIAL
    Promise.all([
        database.ref(`${raizBanco}/ranking/partidas`).remove(),
        database.ref(`${raizBanco}/ranking/tabelas`).remove(),
        database.ref(`${raizBanco}/ranking/chaves`).remove(),
        database.ref(`${raizBanco}/convites_ranking`).remove()
    ])
    .then(() => {
        console.log("✅ [Torneios] Área interna de trabalho do ranking limpa no Firebase.");
        return database.ref(`${raizBanco}/config/ranking`).update({
            calendario: payloadCalendario, 
            inscritosConfirmados: null,
            faseAtual: 2
        });
    })
    .then(() => {
        // Sincroniza a memória RAM imediatamente
        if (typeof configRegrasGlobal !== 'undefined' && configRegrasGlobal && configRegrasGlobal.ranking) {
            configRegrasGlobal.ranking.faseAtual = 2;
            configRegrasGlobal.ranking.calendario = payloadCalendario;
            configRegrasGlobal.ranking.inscritosConfirmados = null;
        }

        window.emModoEdicaoCalendarioSaaS = false;
        showToast("Contrato da edição gravado com sucesso! Inscrições abertas.", "success");

        if (typeof renderizarGestaoTemporadaSaaS === 'function') {
            renderizarGestaoTemporadaSaaS();
        }

        uploadPdfOpcional();
    })
    .catch(err => {
        console.error("❌ [Torneios] Erro ao salvar calendário:", err);
        showToast("Erro ao gravar calendário no Firebase.", "error");
    });
}


function editarCalendarioAtivoSaaS() {
    // 🧹 Limpa todos os campos e pílulas antes de abrir, garantindo formulário virgem
    if (typeof limparFormularioFase1SaaS === 'function') {
        limparFormularioFase1SaaS();
    }
    const conf = (configRegrasGlobal && configRegrasGlobal.ranking) ? configRegrasGlobal.ranking : {};
    const cal = conf.calendario || {};

    // 1. Preenchimento dos dados existentes (se houver)
    if (cal.nomeTorneio) document.getElementById('inp-torneio-nome').value = cal.nomeTorneio;
    if (cal.formatoTorneio) document.getElementById('inp-torneio-modelo').value = cal.formatoTorneio;
    if (cal.limiteVagas !== undefined && cal.limiteVagas !== null) document.getElementById('inp-torneio-vagas').value = cal.limiteVagas;

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

    // 🔒 2. CONDICIONAMENTO INTELIGENTE: TRAVA APENAS SE FOR EDIÇÃO DE TORNEIO ATIVO (FASE >= 2)
    const elVagas = document.getElementById('inp-torneio-vagas');
    const elModelo = document.getElementById('inp-torneio-modelo');
    const elDtIncIni = document.getElementById('inp-torneio-dt-inc-ini');
    const containerPills = document.getElementById('container-pills-categorias');

    const faseAtual = parseInt(conf.faseAtual, 10) || 1;
    const emEdicaoDeTorneioAtivo = (faseAtual >= 2 && !!cal.nomeTorneio);

    if (emEdicaoDeTorneioAtivo) {
        // Modo Edição: trava os parâmetros estruturais
        if (elVagas) {
            elVagas.disabled = true;
            elVagas.title = "O limite de vagas não pode ser alterado com as inscrições em andamento.";
        }
        if (elModelo) {
            elModelo.disabled = true;
            elModelo.title = "O modelo de disputa não pode ser alterado após o início do torneio.";
        }
        if (elDtIncIni) {
            elDtIncIni.disabled = true;
            elDtIncIni.title = "A data de início das inscrições já foi consumada.";
        }
        if (containerPills) {
            containerPills.classList.add('travado');
            containerPills.title = "As categorias habilitadas não podem ser alteradas com o torneio em andamento.";
        }
        window.emModoEdicaoCalendarioSaaS = true;
    } else {
        // Modo Criação do Zero: garante tudo destravado e habilitado
        if (elVagas) { elVagas.disabled = false; elVagas.title = ''; }
        if (elModelo) { elModelo.disabled = false; elModelo.title = ''; }
        if (elDtIncIni) { elDtIncIni.disabled = false; elDtIncIni.title = ''; }
        if (containerPills) {
            containerPills.classList.remove('travado');
            containerPills.title = '';
        }
        window.emModoEdicaoCalendarioSaaS = false;
    }

    // Exibe o painel do formulário
    document.querySelectorAll('#container-fases-gestor .fase-panel').forEach((panel, idx) => {
        if (idx === 0) panel.classList.add('ativa');
        else panel.classList.remove('ativa');
    });

    if (typeof atualizarBotaoRodapeRankingSaaS === 'function') {
        atualizarBotaoRodapeRankingSaaS();
    }
}

/* ======================================================== */
/* 3.2 INSCRIÇÕES E CONFERÊNCIA DE PIX (FASE 2)            */
/* ======================================================== */

function popularFiltrosInscritosSaaS() {
    const selectCat = document.getElementById('select-filtro-inscritos-categoria');
    if (!selectCat) return;

    const conf = (configRegrasGlobal && configRegrasGlobal.ranking) ? configRegrasGlobal.ranking : {};
    const inscritos = conf.inscritosConfirmados || {};
    const filaEspera = conf.filaEspera || {};
    const ids = Object.keys(inscritos);
    const modoGenero = conf.divisaoGenero || 'separado';

    const contagemPorCat = {};
    const catsComDados = new Set();

    // 1. Contabiliza apenas os atletas confirmados
    ids.forEach(idAtleta => {
        const atleta = (typeof jogadoresGlobal !== 'undefined' && jogadoresGlobal[idAtleta]) ? jogadoresGlobal[idAtleta] : {};
        const classeAtleta = (atleta.classe || 'B').toUpperCase().replace('CLASSE_', '').trim();
        let generoAtleta = (atleta.genero || 'MASCULINO').toUpperCase().trim();
        if (generoAtleta === 'NAO_INFORMAR') generoAtleta = 'MASCULINO';
        const chaveCat = (modoGenero === 'unificado') ? `${classeAtleta}_UNIFICADO` : `${classeAtleta}_${generoAtleta}`;

        contagemPorCat[chaveCat] = (contagemPorCat[chaveCat] || 0) + 1;
        catsComDados.add(chaveCat);
    });

    // 2. Inclui categorias que possuem suplentes na fila de espera
    Object.keys(filaEspera).forEach(chaveCat => {
        const suplentes = filaEspera[chaveCat] || {};
        if (Object.keys(suplentes).length > 0) {
            catsComDados.add(chaveCat);
            if (!contagemPorCat[chaveCat]) {
                contagemPorCat[chaveCat] = 0;
            }
        }
    });

    const valAnterior = selectCat.value || 'TODAS';
    let htmlOptions = `<option value="TODAS">Todas as Categorias (${ids.length})</option>`;

    // 3. Ordenação alfabética por Classe (A, B, C...) e Gênero
    const listaOrdenada = Array.from(catsComDados).sort((a, b) => {
        const pA = a.split('_');
        const pB = b.split('_');
        if (pA[0] !== pB[0]) return pA[0].localeCompare(pB[0]);
        return pA[1].localeCompare(pB[1]);
    });

    listaOrdenada.forEach(chaveCat => {
        const partes = chaveCat.split('_');
        const cl = partes[0] || 'B';
        const gen = partes[1] || 'MASCULINO';
        const labelGen = (gen === 'UNIFICADO') ? '' : (gen === 'FEMININO' ? ' - Feminino' : ' - Masculino');
        const qtd = contagemPorCat[chaveCat] || 0;
        htmlOptions += `<option value="${chaveCat}">Classe ${cl}${labelGen} (${qtd})</option>`;
    });

    selectCat.innerHTML = htmlOptions;
    if (valAnterior && Array.from(selectCat.options).some(o => o.value === valAnterior)) {
        selectCat.value = valAnterior;
    } else {
        selectCat.value = 'TODAS';
    }
}

function abrirModalGerenciarInscritosSaaS() {
    popularFiltrosInscritosSaaS();
    renderizarListaInscritosPixSaaS();
    if (typeof abrirModalConfig === 'function') {
        abrirModalConfig('modal-gerenciar-inscritos');
    }
}


let timerFilaEsperaGestorInterval = null;

function formatarContagemRegressivaFilaSaaS(expiraTimestamp) {
    const diff = Math.max(0, Math.floor(((expiraTimestamp || 0) - Date.now()) / 1000));
    const h = String(Math.floor(diff / 3600)).padStart(2, '0');
    const m = String(Math.floor((diff % 3600) / 60)).padStart(2, '0');
    const s = String(diff % 60).padStart(2, '0');
    return `${h}h ${m}m ${s}s`;
}

function iniciarTimersFilaEsperaGestorSaaS() {
    if (timerFilaEsperaGestorInterval) {
        clearInterval(timerFilaEsperaGestorInterval);
        timerFilaEsperaGestorInterval = null;
    }

    const elementosTimer = document.querySelectorAll('.badge-timer-suplente-vivo');
    if (!elementosTimer || elementosTimer.length === 0) return;

    timerFilaEsperaGestorInterval = setInterval(() => {
        const ativos = document.querySelectorAll('.badge-timer-suplente-vivo');
        if (!ativos || ativos.length === 0) {
            clearInterval(timerFilaEsperaGestorInterval);
            timerFilaEsperaGestorInterval = null;
            return;
        }

        ativos.forEach(el => {
            const expiraEm = parseInt(el.getAttribute('data-expira'), 10) || 0;
            const diff = expiraEm - Date.now();

            if (diff > 0) {
                el.textContent = formatarContagemRegressivaFilaSaaS(expiraEm);
            } else {
                el.textContent = "00h 00m 00s";
                const cat = el.getAttribute('data-cat');
                const idAtleta = el.getAttribute('data-id');
                if (cat && idAtleta && !el.dataset.expirando) {
                    el.dataset.expirando = "true";
                    tratarExpiracaoSuplenteFilaSaaS(cat, idAtleta);
                }
            }
        });
    }, 1000);
}

async function tratarExpiracaoSuplenteFilaSaaS(chaveCat, idAtleta) {
    if (!raizBanco || !chaveCat || !idAtleta) return;
    try {
        console.log(`⏱️ [Fila de Espera] Prazo exclusivo de 2h expirou para o atleta ${idAtleta}. Abrindo concorrência...`);

        // 1. NÃO REMOVE o atleta da fila nem do sininho! Marca apenas a janela aberta
        await database.ref(`${raizBanco}/config/ranking/filaEspera/${chaveCat}/${idAtleta}`).update({
            janelaAberta: true
        });

        // 2. Convoca cumulativamente o próximo da fila (Suplente #2) com Push e novo cronômetro
        if (typeof convocarProximoSuplenteFilaEsperaRankingSaaS === 'function') {
            await convocarProximoSuplenteFilaEsperaRankingSaaS(chaveCat);
        }

        showToast("Prazo exclusivo expirado! A vaga agora está aberta para disputa com o próximo da fila.", "info", 5000);
        renderizarListaInscritosPixSaaS();

    } catch (err) {
        console.error("Erro ao tratar expiração do suplente:", err);
    }
}

function renderizarListaInscritosPixSaaS() {
    const container = document.getElementById('container-lista-inscritos-pix');
    const lblBadge = document.getElementById('lbl-qtd-inscritos-badge');
    const btnEncerrar = document.getElementById('btn-saas-fase2-encerrar');
    const btnInscritos = document.getElementById('btn-saas-fase2-inscritos');

    popularFiltrosInscritosSaaS();

    const selCat = document.getElementById('select-filtro-inscritos-categoria');
    const filtroCat = selCat ? selCat.value : 'TODAS';

    if (!container) return;

    const conf = (configRegrasGlobal && configRegrasGlobal.ranking) ? configRegrasGlobal.ranking : {};
    const inscritos = conf.inscritosConfirmados || {};
    const filaEspera = conf.filaEspera || {};
    const ids = Object.keys(inscritos);

    ids.sort((a, b) => (inscritos[a]?.dataAceite || 0) - (inscritos[b]?.dataAceite || 0));

    if (lblBadge) lblBadge.textContent = ids.length;
    if (btnInscritos) btnInscritos.disabled = (ids.length === 0);
    if (btnEncerrar) btnEncerrar.disabled = (ids.length === 0);

    const temInscritos = ids.length > 0;
    const temFilaEspera = Object.keys(filaEspera).some(cat => Object.keys(filaEspera[cat] || {}).length > 0);

    if (!temInscritos && !temFilaEspera) {
        container.innerHTML = '<p style="text-align: center; color: #94a3b8; margin: 20px 0; font-size: 13px;">Nenhum inscrito confirmado até o momento.</p>';
        return;
    }

    const idsFiltrados = ids.filter(idAtleta => {
        if (filtroCat === 'TODAS') return true;
        const atleta = (typeof jogadoresGlobal !== 'undefined' && jogadoresGlobal[idAtleta]) ? jogadoresGlobal[idAtleta] : {};
        const classeAtleta = (atleta.classe || 'B').toUpperCase().replace('CLASSE_', '').trim();
        let generoAtleta = (atleta.genero || 'MASCULINO').toUpperCase().trim();
        if (generoAtleta === 'NAO_INFORMAR') generoAtleta = 'MASCULINO';
        const modoGenero = conf.divisaoGenero || 'separado';
        const catAtleta = (modoGenero === 'unificado') ? `${classeAtleta}_UNIFICADO` : `${classeAtleta}_${generoAtleta}`;

        return catAtleta === filtroCat;
    });

    let html = '';

    // 1. LISTA DE TITULARES CONFIRMADOS
    if (idsFiltrados.length > 0) {
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
                            ${pago ? '🟢 Pago' : '🟡 Pendente'}
                        </span>
                        <button type="button" style="background:none; border:none; color:#94a3b8; cursor:pointer;" onclick="removerInscritoTorneioSaaS('${idAtleta}')" title="Remover">
                            <i class="material-icons" style="font-size: 16px;">close</i>
                        </button>
                    </div>
                </div>
            `;
        });
    } else if (temInscritos) {
        html += '<p style="text-align: center; color: #94a3b8; margin: 12px 0; font-size: 12.5px;">Nenhum titular encontrado para este filtro.</p>';
    }

    // 2. BLOCO DE FILA DE ESPERA (SUPLENTES POR CATEGORIA)
    let htmlFila = '';
    Object.keys(filaEspera).sort().forEach(chaveCat => {
        if (filtroCat !== 'TODAS' && chaveCat !== filtroCat) return;

        const partes = chaveCat.split('_');
        const classeCat = partes[0] || 'B';
        const generoCat = partes[1] || 'MASCULINO';

        const suplentesMap = filaEspera[chaveCat] || {};
        const suplentesIds = Object.keys(suplentesMap);

        if (suplentesIds.length === 0) return;

        suplentesIds.sort((a, b) => (suplentesMap[a].posicao || 0) - (suplentesMap[b].posicao || 0));

        // Rótulo compacto da Fila de Espera (ex: Classe B (Masc))
        const rotuloGenAbrev = (generoCat === 'FEMININO') ? 'Fem' : (generoCat === 'MASCULINO' ? 'Masc' : 'Unif');
        const rotuloCat = (generoCat === 'UNIFICADO') 
            ? `Classe ${classeCat}` 
            : `Classe ${classeCat} (${rotuloGenAbrev})`;

        htmlFila += `
            <div style="margin-top: 18px; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #fde68a; padding-bottom: 4px;">
                <span style="font-size: 12px; font-weight: 800; text-transform: uppercase; color: #b45309; display: flex; align-items: center; gap: 5px;">
                    ⏳ Fila de Espera • ${rotuloCat}
                </span>
                <span style="font-size: 11px; font-weight: 700; background: #fffbeb; color: #b45309; border: 1px solid #fde68a; padding: 2px 8px; border-radius: 12px;">
                    ${suplentesIds.length} ${suplentesIds.length === 1 ? 'suplente' : 'suplentes'}
                </span>
            </div>
        `;

        suplentesIds.forEach(idSup => {
            const item = suplentesMap[idSup];
            const nomeSup = item.nome || "Atleta";
            const posSup = item.posicao || 1;
            const dataEntradaStr = item.dataEntrada ? new Date(item.dataEntrada).toLocaleDateString('pt-BR') : '';
            const ehConvocado = item.status === 'convocado';
            const expiraTimestamp = item.expiraEm || 0;
            const prazoEsgotado = ehConvocado && expiraTimestamp > 0 && (Date.now() >= expiraTimestamp);
            const tempoVivoInicial = (ehConvocado && !prazoEsgotado) ? formatarContagemRegressivaFilaSaaS(expiraTimestamp) : '';

            let badgeStatusHtml = '';
            if (ehConvocado) {
                if (prazoEsgotado) {
                    badgeStatusHtml = `
                        <span style="font-size: 11px; font-weight: 700; color: #854d0e; background: #fef08a; border: 1px solid #facc15; padding: 4px 8px; border-radius: 6px; white-space: nowrap; display: inline-flex; align-items: center; gap: 4px;">
                            🟡 Aguardando...
                        </span>
                    `;
                } else {
                    badgeStatusHtml = `
                        <span style="font-size: 11px; font-weight: 700; color: #854d0e; background: #fef08a; border: 1px solid #facc15; padding: 4px 8px; border-radius: 6px; white-space: nowrap; display: inline-flex; align-items: center; gap: 4px;">
                            <i class="material-icons" style="font-size: 13px;">timer</i> <span class="badge-timer-suplente-vivo" data-cat="${chaveCat}" data-id="${idSup}" data-expira="${expiraTimestamp}">${tempoVivoInicial}</span>
                        </span>
                    `;
                }
            } else {
                badgeStatusHtml = `
                    <span style="font-size: 11px; font-weight: 700; color: #b45309; background: #fffbeb; border: 1px solid #fde68a; padding: 4px 8px; border-radius: 6px;">
                        Na Fila
                    </span>
                `;
            }

            htmlFila += `
                <div class="item-atleta-pix" style="background: ${ehConvocado ? '#fefce8' : '#fffdf5'}; border-left: 3px solid ${ehConvocado ? '#eab308' : '#f59e0b'};">
                    <div>
                        <span style="font-size: 13.5px; font-weight: 700; color: #1e293b;">
                            <span style="background: #fef3c7; color: #92400e; padding: 1px 6px; border-radius: 4px; font-size: 11px; margin-right: 4px; font-weight: 800;">#${posSup}</span>
                            ${nomeSup}
                        </span>
                        <span style="display: block; font-size: 11px; color: #92400e;">
                            ${ehConvocado ? `⚡ Convocado em ${new Date(item.convocadoEm || Date.now()).toLocaleDateString('pt-BR')}` : `Na fila desde ${dataEntradaStr || 'Data N/D'}`}
                        </span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        ${badgeStatusHtml}
                        <button type="button" style="background:none; border:none; color:#94a3b8; cursor:pointer;" onclick="removerSuplenteFilaEsperaRankingSaaS('${chaveCat}', '${idSup}')" title="Remover da Fila">
                            <i class="material-icons" style="font-size: 16px;">close</i>
                        </button>
                    </div>
                </div>
            `;
        });
    });

    if (htmlFila) {
        html += htmlFila;
    } else if (idsFiltrados.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #94a3b8; margin: 20px 0; font-size: 13px;">Nenhum inscrito ou suplente encontrado com os filtros selecionados.</p>';
        return;
    }

    container.innerHTML = html;
    iniciarTimersFilaEsperaGestorSaaS();
}

function removerSuplenteFilaEsperaRankingSaaS(chaveCat, idAtleta) {
    if (!isGestorLogado || !raizBanco) return;

    showPrompt("Remover da Fila", "Deseja remover este atleta da fila de espera?", () => {
        database.ref(`${raizBanco}/config/ranking/filaEspera/${chaveCat}/${idAtleta}`).remove().then(() => {
            showToast("Atleta removido da fila de espera.", "success");
            renderizarListaInscritosPixSaaS();
        });
    });
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

async function convocarProximoSuplenteFilaEsperaRankingSaaS(chaveCat) {
    if (!raizBanco || !chaveCat) return;

    try {
        const [snapFila, snapConfig] = await Promise.all([
            database.ref(`${raizBanco}/config/ranking/filaEspera/${chaveCat}`).once('value'),
            database.ref(`${raizBanco}/config/ranking`).once('value')
        ]);

        const filaCat = snapFila.val() || {};
        const configRanking = snapConfig.val() || {};
        const idsSuplentes = Object.keys(filaCat);

        if (idsSuplentes.length === 0) return;

        idsSuplentes.sort((a, b) => (filaCat[a].posicao || 0) - (filaCat[b].posicao || 0));

        const proximoId = idsSuplentes.find(id => filaCat[id].status !== 'convocado') || idsSuplentes[0];
        const suplenteAlvo = filaCat[proximoId] || {};

        const prazoHorasMs = 2 * 60 * 60 * 1000;
        const timestampAgora = Date.now();
        const timestampExpira = timestampAgora + prazoHorasMs;

        const cal = configRanking.calendario || {};
        const nomeTorneio = cal.nomeTorneio || "Torneio de Ranking";

        // 1. Atualiza o status do suplente no Firebase
        await database.ref(`${raizBanco}/config/ranking/filaEspera/${chaveCat}/${proximoId}`).update({
            status: "convocado",
            convocadoEm: timestampAgora,
            expiraEm: timestampExpira
        });

        // 2. Reinsere a pendência para ativar exclusivamente o Card Interativo Oficial no Sininho
        await database.ref(`${raizBanco}/convites_ranking/pendentes/${proximoId}`).set(true);

        // 3. Barramento Oficial de Push Notification Serverless do SetPoint
        if (typeof enviarPushParaAtletaSaaS === 'function') {
            window.tokensPushProcessadosSaaS = new Set();
            const tituloPush = "🎾 Vaga Disponível!";
            const msgPush = `Abriu uma vaga para sua categoria no ${nomeTorneio}. Confirme em até 2 horas!`;
            const payloadDadosTorneio = {
                tipo: "CONVITE_TORNEIO",
                nomeTorneio: String(cal.nomeTorneio || nomeTorneio),
                formatoTorneio: String(cal.formatoTorneio || configRanking.modeloAtivo || "grupos"),
                fimInscricoes: String(cal.fimInscricoes || cal.fimInscricao || ""),
                inicioJogos: String(cal.inicioJogos || cal.inicioTorneio || cal.inicio || ""),
                fimTorneio: String(cal.fimTorneio || cal.fimPartidas || cal.fim || "")
            };
            enviarPushParaAtletaSaaS(proximoId, tituloPush, msgPush, payloadDadosTorneio);
        }

        showToast(`Vaga liberada! Suplente #${suplenteAlvo.posicao || 1} (${suplenteAlvo.nome || 'Atleta'}) foi convocado (prazo de 2h).`, "info", 5000);

    } catch (err) {
        console.error("Erro ao convocar próximo suplente:", err);
    }
}

function removerInscritoTorneioSaaS(idAtleta) {
    if (!isGestorLogado || !raizBanco) return;

    showPrompt("Remover Titular", "Deseja remover este atleta da lista oficial de titulares? Se houver suplentes na fila, o primeiro será convocado automaticamente por 2 horas.", async () => {
        try {
            const atletaRemovido = (typeof jogadoresGlobal !== 'undefined' && jogadoresGlobal[idAtleta]) ? jogadoresGlobal[idAtleta] : {};
            const classeAtleta = (atletaRemovido.classe || 'B').toUpperCase().replace('CLASSE_', '').trim();
            let generoAtleta = (atletaRemovido.genero || 'MASCULINO').toUpperCase().trim();
            if (generoAtleta === 'NAO_INFORMAR') generoAtleta = 'MASCULINO';

            const snapConfig = await database.ref(`${raizBanco}/config/ranking`).once('value');
            const configRanking = snapConfig.val() || {};
            const modoGenero = configRanking.divisaoGenero || 'separado';
            const chaveCat = (modoGenero === 'unificado') ? `${classeAtleta}_UNIFICADO` : `${classeAtleta}_${generoAtleta}`;

            await database.ref(`${raizBanco}/config/ranking/inscritosConfirmados/${idAtleta}`).remove();

            showToast("Atleta titular removido.", "success");
            await convocarProximoSuplenteFilaEsperaRankingSaaS(chaveCat);
            renderizarListaInscritosPixSaaS();

        } catch (err) {
            console.error("Erro ao remover titular:", err);
            showToast("Erro ao processar remoção do atleta.", "error");
        }
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
    const modelo = conf.calendario?.formatoTorneio || "grupos";
    const modoGenero = conf.divisaoGenero || 'separado';
    
    const inscritos = conf.inscritosConfirmados || {};
    const qtdInscritos = Object.keys(inscritos).length;

    // 1. Agrupa os inscritos confirmados isolando rigorosamente Classe e Gênero
    const inscritosPorCategoria = {};
    Object.keys(inscritos).forEach(idAtleta => {
        const atleta = (typeof jogadoresGlobal !== 'undefined' && jogadoresGlobal[idAtleta]) ? jogadoresGlobal[idAtleta] : {};
        const classe = (atleta.classe || 'B').toUpperCase().replace('CLASSE_', '').trim();
        let generoKey = (atleta.genero || 'MASCULINO').toUpperCase().trim();
        if (generoKey === 'NAO_INFORMAR') generoKey = 'MASCULINO';

        const chaveTabela = (modoGenero === 'unificado') ? `${classe}_UNIFICADO` : `${classe}_${generoKey}`;

        if (!inscritosPorCategoria[chaveTabela]) {
            inscritosPorCategoria[chaveTabela] = [];
        }
        inscritosPorCategoria[chaveTabela].push(idAtleta);
    });

    // 2. Mapeia todas as categorias que foram habilitadas no calendário
    const classesHabilitadas = (cal.categoriasHabilitadas || [])
        .filter(c => c.startsWith("CLASSE_") || ["A", "B", "C"].includes(c))
        .map(c => c.replace("CLASSE_", "").trim());

    const generosHabilitados = (cal.categoriasHabilitadas || [])
        .filter(c => ["MASCULINO", "FEMININO"].includes(c.toUpperCase()));

    let todasCategoriasEsperadas = [];
    if (classesHabilitadas.length > 0) {
        if (modoGenero === 'unificado') {
            classesHabilitadas.forEach(c => todasCategoriasEsperadas.push(`${c}_UNIFICADO`));
        } else {
            const gens = generosHabilitados.length > 0 ? generosHabilitados : ['MASCULINO'];
            classesHabilitadas.forEach(c => {
                gens.forEach(g => todasCategoriasEsperadas.push(`${c}_${g}`));
            });
        }
    } else {
        todasCategoriasEsperadas = Object.keys(inscritosPorCategoria);
    }

    // Garante que qualquer categoria que possua atletas confirmados também seja avaliada
    Object.keys(inscritosPorCategoria).forEach(cat => {
        if (!todasCategoriasEsperadas.includes(cat)) {
            todasCategoriasEsperadas.push(cat);
        }
    });

    // 3. Triagem de quórum por categoria (mínimo de 2 atletas)
    const categoriasConfirmadas = [];
    const categoriasCanceladas = [];

    todasCategoriasEsperadas.sort().forEach(chaveCat => {
        const idsCat = inscritosPorCategoria[chaveCat] || [];
        const total = idsCat.length;

        const partes = chaveCat.split('_');
        const rotuloClasse = `Classe ${partes[0]}`;
        const rotuloGenero = partes[1] === 'UNIFICADO' ? 'Unificado' : (partes[1] === 'FEMININO' ? 'Feminino' : 'Masculino');
        const rotuloAmigavel = `${rotuloClasse} (${rotuloGenero})`;

        if (total >= 2) {
            categoriasConfirmadas.push({
                chave: chaveCat,
                rotulo: rotuloAmigavel,
                total: total,
                ids: idsCat
            });
        } else {
            categoriasCanceladas.push({
                chave: chaveCat,
                rotulo: rotuloAmigavel,
                total: total,
                ids: idsCat
            });
        }
    });

    // CENÁRIO 1: Nenhuma categoria atingiu quórum (todas com 0 ou 1 atleta)
    if (categoriasConfirmadas.length === 0) {
        showToast("Quórum insuficiente: Nenhuma categoria atingiu o mínimo de 2 atletas para iniciar a competição.", "warning", 4500);
        return;
    }

    const hojeStr = new Date().toISOString().split('T')[0];
    const fimInscricoesStr = cal.fimInscricoes || "";
    const dataFimFormatada = fimInscricoesStr ? fimInscricoesStr.split('-').reverse().join('/') : '--/--';

    // 4. Monta o mapa de categorias aptas para a Fase 3
    const inscritosAptosPorCategoria = {};
    categoriasConfirmadas.forEach(c => {
        inscritosAptosPorCategoria[c.chave] = c.ids;
    });

    const processarMontagemEGerarFase3 = async () => {
        if (navigator.vibrate) navigator.vibrate(40);

        const snapConvites = await database.ref(`${raizBanco}/convites_ranking`).once('value');
        const dadosConvites = snapConvites.exists() ? snapConvites.val() : {};
        const tipoOrdenacao = conf.tipoOrdenacao || dadosConvites.tipoOrdenacao || 'livre';

        const nomeTorneio = cal.nomeTorneio || "Torneio";
        const snapRankingGeral = await database.ref(`${raizBanco}/ranking/ranking_geral`).once('value');
        const rankingGeralMap = snapRankingGeral.exists() ? snapRankingGeral.val() : {};

        // Ordenação das sementes de cada categoria apta
        Object.keys(inscritosAptosPorCategoria).forEach(chaveTab => {
            const idsList = inscritosAptosPorCategoria[chaveTab];
            if (tipoOrdenacao === 'herdada') {
                const listaGeral = rankingGeralMap[chaveTab] || [];
                idsList.sort((a, b) => {
                    const posA = listaGeral.indexOf(a);
                    const posB = listaGeral.indexOf(b);
                    if (posA !== -1 && posB !== -1) return posA - posB;
                    if (posA !== -1) return -1;
                    if (posB !== -1) return 1;
                    return (inscritos[a]?.dataAceite || 0) - (inscritos[b]?.dataAceite || 0);
                });
            } else if (tipoOrdenacao === 'sorteio') {
                for (let i = idsList.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [idsList[i], idsList[j]] = [idsList[j], idsList[i]];
                }
            } else {
                idsList.sort((a, b) => (inscritos[a]?.dataAceite || 0) - (inscritos[b]?.dataAceite || 0));
            }
        });

        const faseInicialGrupos = conf.grupos?.faseInicial || "grupos";
        const emMataMataDireto = (modelo === 'grupos' && faseInicialGrupos === 'matamata');
        const precisaSorteio = (modelo === 'grupos' && !emMataMataDireto) || tipoOrdenacao === 'sorteio' || emMataMataDireto;

        // CENÁRIO A: Sorteio Interativo em Fila Sequencial por Categoria
        if (precisaSorteio) {
            const categoriasFila = Object.keys(inscritosAptosPorCategoria).sort();
            const updatesGerais = {};
            updatesGerais[`${raizBanco}/config/ranking/faseAtual`] = 3;
			
			// 🛑 FECHAMENTO DE CONVITES: Encerra formalmente as inscrições
            updatesGerais[`${raizBanco}/convites_ranking/status`] = "fechado";
            updatesGerais[`${raizBanco}/convites_ranking/pendentes`] = null;

            const executarSorteioCategoriaFila = (idxFila) => {
                const catChaveAtual = categoriasFila[idxFila];
                const idsCatAtual = inscritosAptosPorCategoria[catChaveAtual];
                
                const partesCat = catChaveAtual.split('_');
                const rotuloCatAmigavel = `Classe ${partesCat[0]}` + (partesCat[1] !== 'UNIFICADO' ? ` (${partesCat[1] === 'FEMININO' ? 'Feminino' : 'Masculino'})` : '');
                const tituloModalCategoria = `${nomeTorneio} • ${rotuloCatAmigavel}`;

                const mapaInscritosDestaCat = {};
                idsCatAtual.forEach(id => {
                    if (inscritos[id]) mapaInscritosDestaCat[id] = inscritos[id];
                });

                const tamanhoGrupoConfig = emMataMataDireto
                    ? idsCatAtual.length
                    : ((modelo === 'grupos') ? (parseInt(conf.grupos?.tamanhoGrupo, 10) || 4) : idsCatAtual.length);

                SorteioPotes.abrirModalSorteioSaaS(tituloModalCategoria, mapaInscritosDestaCat, tamanhoGrupoConfig, async (gruposResultado) => {
                    if (gruposResultado && Object.keys(gruposResultado).length > 0) {
                        const listaIDsSemeada = [];
                        Object.values(gruposResultado).forEach(grupoArray => {
                            const grupoCompletado = [...grupoArray];
                            if (modelo === 'grupos' && !emMataMataDireto) {
                                while (grupoCompletado.length < tamanhoGrupoConfig) {
                                    grupoCompletado.push(null);
                                }
                            }
                            listaIDsSemeada.push(...grupoCompletado);
                        });

                        const listaFinal = (modelo === 'grupos' && !emMataMataDireto) ? listaIDsSemeada : listaIDsSemeada.filter(Boolean);
                        updatesGerais[`${raizBanco}/ranking/tabelas/${catChaveAtual}`] = listaFinal;
                        updatesGerais[`${raizBanco}/ranking/semeadura/${catChaveAtual}`] = idsCatAtual.filter(Boolean);

                        if (emMataMataDireto) {
                            const resultadoMM = gerarCruzamentosMataMataDiretoSaaS(idsCatAtual, catChaveAtual);
                            updatesGerais[`${raizBanco}/ranking/chaves/${catChaveAtual}`] = {
                                totalClassificados: resultadoMM.totalClassificados,
                                faseAtual: resultadoMM.faseAtual,
                                rodada1: resultadoMM.rodada1
                            };
                        }
                    } else {
                        updatesGerais[`${raizBanco}/ranking/tabelas/${catChaveAtual}`] = idsCatAtual;
                        updatesGerais[`${raizBanco}/ranking/semeadura/${catChaveAtual}`] = idsCatAtual.filter(Boolean);

                        if (emMataMataDireto) {
                            const resultadoMM = gerarCruzamentosMataMataDiretoSaaS(idsCatAtual, catChaveAtual);
                            updatesGerais[`${raizBanco}/ranking/chaves/${catChaveAtual}`] = {
                                totalClassificados: resultadoMM.totalClassificados,
                                faseAtual: resultadoMM.faseAtual,
                                rodada1: resultadoMM.rodada1
                            };
                        }
                    }

                    const btnFinish = document.getElementById('btnFinishGoPotes');
                    const proximoIndice = idxFila + 1;

                    if (proximoIndice < categoriasFila.length) {
                        const proxCatChave = categoriasFila[proximoIndice];
                        const partesProx = proxCatChave.split('_');
                        const rotuloProxGenero = (partesProx[1] === 'FEMININO' ? 'Feminino' : (partesProx[1] === 'MASCULINO' ? 'Masculino' : ''));
                        const proxNomeCompleto = `Classe ${partesProx[0]}` + (rotuloProxGenero ? ` (${rotuloProxGenero})` : '');

                        if (btnFinish) {
                            btnFinish.innerHTML = `
                                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1.25;">
                                    <span>Sorteio da Próxima Categoria</span>
                                    <span style="font-size: 13.5px; opacity: 0.95; font-weight: 700; text-transform: none; margin-top: 2px;">${proxNomeCompleto}</span>
                                </div>
                                <i class="material-icons" style="font-size: 22px;">arrow_forward</i>
                            `;
                            btnFinish.onclick = () => {
                                btnFinish.onclick = null;
                                executarSorteioCategoriaFila(proximoIndice);
                            };
                        }
                    } else {
                        try {
                            const payloadNotificacao = {
                                categoria: "inicio_temporada",
                                titulo: "A temporada começou!",
                                detalhe: `Tabelas do ${nomeTorneio} liberadas.\nAgende sua partida no app.`,
                                timestamp: Date.now()
                            };

                            const idsParaNotificar = Object.values(inscritosAptosPorCategoria).flat();
                            idsParaNotificar.forEach(idAtleta => {
                                const keyNotif = database.ref().push().key;
                                updatesGerais[`${raizBanco}/jogadores/${idAtleta}/notificacoes/${keyNotif}`] = payloadNotificacao;
                            });

                            await database.ref().update(updatesGerais);

                            if (typeof configRegrasGlobal !== 'undefined' && configRegrasGlobal && configRegrasGlobal.ranking) {
                                configRegrasGlobal.ranking.faseAtual = 3;
                            }

                            if (btnFinish) {
                                btnFinish.innerHTML = `🏆 Concluir e Ver Tabelas`;
                                btnFinish.onclick = () => {
                                    SorteioPotes.fecharModalSorteioSaaS();
                                    if (typeof abrirLeaderboardSaaS === 'function') {
                                        abrirLeaderboardSaaS();
                                    }
                                };
                            }

                            showToast("Sorteio de todas as categorias concluído! Temporada iniciada.", "success");

                            if (typeof renderizarGestaoTemporadaSaaS === "function") {
                                renderizarGestaoTemporadaSaaS();
                            }
                        } catch (err) {
                            console.error("❌ Erro ao salvar chaves multi-classes:", err);
                            showToast("Erro ao gravar tabelas no Firebase.", "error");
                        }
                    }
                });
            };

            executarSorteioCategoriaFila(0);
            return;
        }

        // CENÁRIO B: Pirâmide ou Barragem sem sorteio (Montagem atômica imediata)
        try {
            showToast("Montando tabelas das categorias...", "info");
            const updates = {};
            updates[`${raizBanco}/config/ranking/faseAtual`] = 3;
			
			// 🛑 FECHAMENTO DE CONVITES: Encerra formalmente as inscrições
            updates[`${raizBanco}/convites_ranking/status`] = "fechado";
            updates[`${raizBanco}/convites_ranking/pendentes`] = null;

            Object.keys(inscritosAptosPorCategoria).forEach(chaveTab => {
                updates[`${raizBanco}/ranking/tabelas/${chaveTab}`] = inscritosAptosPorCategoria[chaveTab];
            });

            const payloadNotificacao = {
                categoria: "inicio_temporada",
                titulo: "A temporada começou!",
                detalhe: `Tabelas do ${nomeTorneio} liberadas.\nAgende sua partida no app.`,
                timestamp: Date.now()
            };

            const idsParaNotificar = Object.values(inscritosAptosPorCategoria).flat();
            idsParaNotificar.forEach(idAtleta => {
                const keyNotif = database.ref().push().key;
                updates[`${raizBanco}/jogadores/${idAtleta}/notificacoes/${keyNotif}`] = payloadNotificacao;
            });

            await database.ref().update(updates);

            if (typeof configRegrasGlobal !== 'undefined' && configRegrasGlobal && configRegrasGlobal.ranking) {
                configRegrasGlobal.ranking.faseAtual = 3;
            }

            showToast("Tabelas congeladas e temporada iniciada com sucesso!", "success");

            if (typeof renderizarGestaoTemporadaSaaS === "function") {
                renderizarGestaoTemporadaSaaS();
            }

        } catch (err) {
            console.error("❌ Erro ao congelar tabelas multi-classes:", err);
            showToast("Erro ao gravar tabelas no Firebase.", "error");
        }
    };

    const titulosModal = {
        piramide: "Encerrar Inscrições e Iniciar Pirâmide",
        barragem: "Encerrar Inscrições e Iniciar Barragem",
        grupos: "Encerrar Inscrições e Congelar Chaves"
    };

    const acoesModal = {
        piramide: "iniciar a Pirâmide",
        barragem: "iniciar a Barragem",
        grupos: "congelar a tabela oficial de chaves"
    };

    const tituloPrompt = titulosModal[modelo] || "Encerrar Inscrições";
    const acaoPrompt = acoesModal[modelo] || "iniciar a disputa";

    // 5. Construção dinâmica do corpo do modal (Cenário 2 vs Cenário 3)
    const listaConfirmadasHTML = categoriasConfirmadas
        .map(c => `<li><b>${c.rotulo}:</b> ${c.total} atletas</li>`)
        .join('');

    const totalAtletasConfirmados = categoriasConfirmadas.reduce((acc, c) => acc + c.total, 0);

    let promptConteudoHTML = '';

    // CENÁRIO 2: Todas as categorias habilitadas alcançaram quórum
    if (categoriasCanceladas.length === 0) {
        promptConteudoHTML = `
            <p style="margin: 0 0 8px 0;">Categorias confirmadas para ${acaoPrompt}:</p>
            <ul style="margin: 0 0 12px 18px; padding: 0; font-size: 13px; color: #1e293b;">
                ${listaConfirmadasHTML}
            </ul>
            <p style="margin: 0; font-size: 12.5px; color: #64748b;">
                Total geral: <b>${totalAtletasConfirmados} atletas</b>. Deseja prosseguir?
            </p>
        `;
    } 
    // CENÁRIO 3: Quórum parcial (ao menos uma categoria atingiu quórum e outra ficou com 0 ou 1 atleta)
    else {
        const listaCanceladasHTML = categoriasCanceladas
            .map(c => `<li><b>${c.rotulo}:</b> ${c.total} ${c.total === 1 ? 'atleta' : 'inscritos'}</li>`)
            .join('');

        promptConteudoHTML = `
            <p style="margin: 0 0 6px 0; font-weight: 600; color: #1e293b;">Categorias confirmadas para ${acaoPrompt}:</p>
            <ul style="margin: 0 0 12px 18px; padding: 0; font-size: 13px; color: #1e293b;">
                ${listaConfirmadasHTML}
            </ul>
            <p style="margin: 0 0 6px 0; font-weight: 700; color: #b45309;">⚠️ Categorias canceladas por falta de inscritos:</p>
            <ul style="margin: 0 0 12px 18px; padding: 0; font-size: 13px; color: #991b1b;">
                ${listaCanceladasHTML}
            </ul>
            <p style="margin: 8px 0 0 0; font-size: 13px; color: #334155; font-weight: 600;">
                Deseja prosseguir apenas com as categorias confirmadas?
            </p>
        `;
    }

    let avisoPrazoHTML = '';
    if (fimInscricoesStr && hojeStr < fimInscricoesStr) {
        avisoPrazoHTML = `
            <p style="margin: 0 0 10px 0; color: #b45309;">
                ⚠️ <b>Atenção:</b> O prazo oficial de inscrições vai até <b>${dataFimFormatada}</b>.
            </p>
        `;
    }

    const htmlPrompt = `
        <div style="text-align: left; font-size: 14px; color: #334155; line-height: 1.5;">
            ${avisoPrazoHTML}
            ${promptConteudoHTML}
        </div>
    `;

    showPrompt(tituloPrompt, htmlPrompt, () => {
        processarMontagemEGerarFase3();
    });
}

/* ======================================================== */
/* 3.3 AÇÕES DA FASE DE CHAVES, MATA-MATA E AVANÇO (FASE 3/4) */
/* ======================================================== */

async function encerrarFase3EAvancarSaaS() {
    if (!isGestorLogado || !raizBanco) {
        showToast("Apenas o gestor pode encerrar esta fase.", "error");
        return;
    }

    const conf = (configRegrasGlobal && configRegrasGlobal.ranking) ? configRegrasGlobal.ranking : {};
    const cal = conf.calendario || {};
    const modelo = conf.calendario?.formatoTorneio || "grupos";
    const faseAtual = parseInt(conf.faseAtual, 10) || 3;
    const faseInicialGrupos = conf.grupos?.faseInicial || "grupos";
    const emMataMataDireto = (modelo === 'grupos' && faseInicialGrupos === 'matamata');
    const emFaseMataMata = (modelo === 'grupos' && ((emMataMataDireto && faseAtual === 3) || (!emMataMataDireto && faseAtual === 4)));

    // 🎯 IDENTIFICAÇÃO DA CATEGORIA FOCO SELECIONADA NA GESTÃO
    const chavesMap = (typeof rankingChavesGlobal !== 'undefined' && rankingChavesGlobal) ? rankingChavesGlobal : {};
    const chaveCatFoco = (typeof categoriaGestaoAtivaSaaS !== 'undefined' && categoriaGestaoAtivaSaaS)
        ? categoriaGestaoAtivaSaaS
        : (window.categoriaGestaoAtivaSaaS || Object.keys(chavesMap)[0] || 'A_MASCULINO');

    const chaveInfoCat = chavesMap[chaveCatFoco] || {};
    const tamanhoChaveCat = parseInt(chaveInfoCat.faseAtual || (chaveInfoCat.rodada1 ? chaveInfoCat.rodada1.length * 2 : 2), 10);

    // 1. Verifica se todas as categorias concluíram suas decisões finais (com blindagem de temporadaId)
    const temporadaIdAtiva = (typeof convitesRankingGlobal !== 'undefined' && convitesRankingGlobal?.temporadaId)
        ? convitesRankingGlobal.temporadaId
        : null;

    const checarFinalConcluidaAvanco = (catKey) => {
        const info = chavesMap[catKey] || {};
        const tam = parseInt(info.faseAtual, 10) || (info.rodada1 ? info.rodada1.length * 2 : 2);
        if (tam > 2) return false;

        const finalMatch = (info.rodada1 && info.rodada1[0]) || null;
        if (!finalMatch || finalMatch.isBye) return true;

        // A. Procura em rankingPartidasGlobal
        const pFinal = Object.values(rankingPartidasGlobal || {}).find(p => {
            if (p.categoria !== catKey || p.status !== 'finalizada') return false;
            const dp = p.dadosPlacar || {};
            if (p.tagGrupoRanking || dp.tagGrupoRanking) return false;
            return (p.jogador1Id === finalMatch.jogador1Id && p.jogador2Id === finalMatch.jogador2Id) ||
                   (p.jogador1Id === finalMatch.jogador2Id && p.jogador2Id === finalMatch.jogador1Id);
        });
        if (pFinal && pFinal.vencedorId) return true;

        // B. Procura em reservas da temporada ativa
        const reservasRAM = (typeof reservasGeralGlobal !== 'undefined' && reservasGeralGlobal) ? reservasGeralGlobal : {};
        for (const quadraKey of Object.keys(reservasRAM)) {
            const slots = reservasRAM[quadraKey] || {};
            for (const slotKey of Object.keys(slots)) {
                const r = slots[slotKey];
                if (!r) continue;

                const ehRanking = (r.isRanking === true || r.isRanking === 'true' || r.tipo === 'ranking');
                if (!ehRanking) continue;
                if (temporadaIdAtiva && r.temporadaId !== temporadaIdAtiva) continue;
                if (!r.temporadaId) continue;

                const dp = r.dadosPlacar || {};
                const stPlacar = r.statusPlacar || dp.statusPlacar || 'sem_placar';
                if (stPlacar !== 'consolidado') continue;

                const tagF = (r.tagFaseRanking || dp.tagFaseRanking || '').toLowerCase();
                if (tagF.includes('grupo') && !tagF.includes('final')) continue;

                const partesComp = (r.jogadores_completo || '').split(',').map(s => s.trim());
                const partesAp = (r.jogadores || '').split(',').map(s => s.trim());
                const id1 = (typeof obterIdJogadorPorTextoSaaS === 'function') ? obterIdJogadorPorTextoSaaS(partesComp[0] || partesAp[0]) : null;
                const id2 = (typeof obterIdJogadorPorTextoSaaS === 'function') ? obterIdJogadorPorTextoSaaS(partesComp[1] || partesAp[1]) : null;

                if ((id1 === finalMatch.jogador1Id && id2 === finalMatch.jogador2Id) ||
                    (id1 === finalMatch.jogador2Id && id2 === finalMatch.jogador1Id)) {
                    if (dp.vencedorCodigo || dp.vencedor) return true;
                }
            }
        }
        return false;
    };

    const todasCategoriasConcluidas = Object.keys(chavesMap).length > 0 && Object.keys(chavesMap).every(catKey => checarFinalConcluidaAvanco(catKey));

    // 🛡️ 1. PRÉ-VALIDAÇÃO DO MATA-MATA: Valida apenas a categoria ativa (ou todas, se for homologação)
    if (emFaseMataMata) {
        const partidasMap = (typeof rankingPartidasGlobal !== 'undefined' && rankingPartidasGlobal) ? rankingPartidasGlobal : {};
        const reservasRAM = (typeof reservasGeralGlobal !== 'undefined' && reservasGeralGlobal) ? reservasGeralGlobal : {};
        const categoriasParaValidar = todasCategoriasConcluidas ? Object.keys(chavesMap) : [chaveCatFoco];

        let totalPendentes = 0;
        const pendenciasPorClasse = [];

        categoriasParaValidar.forEach(catKey => {
            const chaveInfo = chavesMap[catKey] || {};
            const rodadaAtual = chaveInfo.rodada1 || [];

            let pendentesCat = 0;
            rodadaAtual.forEach(confItem => {
                if (confItem.isBye || !confItem.jogador2Id) return;

                // 1. Procura em rankingPartidasGlobal
                let partidaFinalizada = Object.values(partidasMap || {}).find(p => {
                    if (p.categoria !== catKey || p.status !== 'finalizada') return false;
                    const dp = p.dadosPlacar || {};
                    if (p.tagGrupoRanking || dp.tagGrupoRanking) return false;
                    return (p.jogador1Id === confItem.jogador1Id && p.jogador2Id === confItem.jogador2Id) ||
                           (p.jogador1Id === confItem.jogador2Id && p.jogador2Id === confItem.jogador1Id);
                });

                if (partidaFinalizada && partidaFinalizada.vencedorId) return;

                // 2. Consulta em reservas com blindagem de temporadaId
                let achouEmReservas = false;
                for (const qKey of Object.keys(reservasRAM)) {
                    const slots = reservasRAM[qKey] || {};
                    for (const sKey of Object.keys(slots)) {
                        const r = slots[sKey];
                        if (!r) continue;

                        const ehRanking = (r.isRanking === true || r.isRanking === 'true' || r.tipo === 'ranking');
                        if (!ehRanking) continue;
                        if (temporadaIdAtiva && r.temporadaId !== temporadaIdAtiva) continue;
                        if (!r.temporadaId) continue;

                        const dp = r.dadosPlacar || {};
                        const st = r.statusPlacar || dp.statusPlacar || 'sem_placar';
                        if (st !== 'consolidado') continue;

                        const partesComp = (r.jogadores_completo || '').split(',').map(s => s.trim());
                        const partesAp = (r.jogadores || '').split(',').map(s => s.trim());
                        const id1 = (typeof obterIdJogadorPorTextoSaaS === 'function') ? obterIdJogadorPorTextoSaaS(partesComp[0] || partesAp[0]) : null;
                        const id2 = (typeof obterIdJogadorPorTextoSaaS === 'function') ? obterIdJogadorPorTextoSaaS(partesComp[1] || partesAp[1]) : null;

                        if ((id1 === confItem.jogador1Id && id2 === confItem.jogador2Id) ||
                            (id1 === confItem.jogador2Id && id2 === confItem.jogador1Id)) {
                            if (dp.vencedorCodigo || dp.vencedor) {
                                achouEmReservas = true;
                                break;
                            }
                        }
                    }
                    if (achouEmReservas) break;
                }

                if (!achouEmReservas) {
                    pendentesCat++;
                }
            });

            if (pendentesCat > 0) {
                totalPendentes += pendentesCat;
                const partesCat = catKey.split('_');
                const rotuloClasse = `Classe ${partesCat[0]}`;
                pendenciasPorClasse.push(`${pendentesCat} na ${rotuloClasse}`);
            }
        });

        if (totalPendentes > 0) {
            let msgToast = '';
            if (pendenciasPorClasse.length === 1) {
                const classeInfo = pendenciasPorClasse[0].replace(/^\d+\s+na\s+/, '');
                msgToast = totalPendentes === 1
                    ? `Existe 1 partida pendente na ${classeInfo}.`
                    : `Existem ${totalPendentes} partidas pendentes na ${classeInfo}.`;
            } else {
                msgToast = `Existem ${totalPendentes} partidas pendentes (${pendenciasPorClasse.join(' • ')}).`;
            }

            showToast(msgToast, "warning");
            return; // ⛔ Interrompe se houver pendência na categoria
        }
    }

    // 🛡️ 2. PRÉ-VALIDAÇÃO DE SÚMULAS E RESERVAS: Garante que nenhuma partida da temporada fique pendente
    try {
        const [snapReservas, snapTabelasBanco, snapConvites] = await Promise.all([
            database.ref(`${raizBanco}/reservas`).once('value'),
            database.ref(`${raizBanco}/ranking/tabelas`).once('value'),
            database.ref(`${raizBanco}/convites_ranking`).once('value')
        ]);
        const todasReservas = snapReservas.exists() ? snapReservas.val() : {};
        const tabelasBanco = snapTabelasBanco.exists() ? snapTabelasBanco.val() : {};
        const dadosConvites = snapConvites.exists() ? snapConvites.val() : {};
        const temporadaIdAtiva = dadosConvites.temporadaId || (typeof convitesRankingGlobal !== 'undefined' && convitesRankingGlobal?.temporadaId) || null;

        const pendentesPorCat = {};

        // Mapeamento universal dos atletas por categoria (Grupos e Mata-Mata)
        const mapaAtletasPorCat = {};
        Object.keys(tabelasBanco).forEach(catK => {
            if (!mapaAtletasPorCat[catK]) mapaAtletasPorCat[catK] = new Set();
            (tabelasBanco[catK] || []).forEach(id => { if (id) mapaAtletasPorCat[catK].add(id); });
        });
        Object.keys(chavesMap).forEach(catK => {
            if (!mapaAtletasPorCat[catK]) mapaAtletasPorCat[catK] = new Set();
            (chavesMap[catK]?.rodada1 || []).forEach(c => {
                if (c.jogador1Id) mapaAtletasPorCat[catK].add(c.jogador1Id);
                if (c.jogador2Id) mapaAtletasPorCat[catK].add(c.jogador2Id);
            });
        });

        Object.keys(todasReservas).forEach(quadraKey => {
            const slots = todasReservas[quadraKey] || {};
            Object.keys(slots).forEach(slotKey => {
                const r = slots[slotKey];
                if (!r) return;
                
                const ehRanking = (r.isRanking === true || r.isRanking === 'true' || r.tipo === 'ranking');
                if (!ehRanking) return;

                if (r.borda === undefined && parseInt(r.duracao) === 2) return;

                // 🛡️ TRAVA DE TEMPORADA: Considera apenas agendamentos da temporada ativa
                if (temporadaIdAtiva && r.temporadaId && r.temporadaId !== temporadaIdAtiva) return;

                const stPlacar = r.statusPlacar || (r.dadosPlacar ? r.dadosPlacar.statusPlacar : 'sem_placar');
                if (stPlacar !== 'pendente_validacao' && stPlacar !== 'contestado' && stPlacar !== 'sem_placar') return;

                // Identifica com precisão a qual categoria técnica este agendamento pertence
                let catR = r.categoria || r.dadosPlacar?.categoria;

                const partesAp = (r.jogadores || '').split(',').map(s => s.trim());
                const partesComp = (r.jogadores_completo || '').split(',').map(s => s.trim());
                const id1 = (typeof obterIdJogadorPorTextoSaaS === 'function') ? obterIdJogadorPorTextoSaaS(partesComp[0] || partesAp[0]) : null;
                const id2 = (typeof obterIdJogadorPorTextoSaaS === 'function') ? obterIdJogadorPorTextoSaaS(partesComp[1] || partesAp[1]) : null;

                if (!catR && (id1 || id2)) {
                    for (const catK of Object.keys(mapaAtletasPorCat)) {
                        if ((id1 && mapaAtletasPorCat[catK].has(id1)) || (id2 && mapaAtletasPorCat[catK].has(id2))) {
                            catR = catK;
                            break;
                        }
                    }
                    if (!catR && id1 && typeof jogadoresGlobal !== 'undefined' && jogadoresGlobal[id1]) {
                        const at = jogadoresGlobal[id1];
                        const cl = (at.classe || 'B').toUpperCase().replace('CLASSE_', '').trim();
                        let gen = (at.genero || 'MASCULINO').toUpperCase().trim();
                        if (gen === 'NAO_INFORMAR') gen = 'MASCULINO';
                        catR = (conf.divisaoGenero === 'unificado') ? `${cl}_UNIFICADO` : `${cl}_${gen}`;
                    }
                }

                const catFinal = catR || chaveCatFoco;

                // Se estiver no Mata-Mata e ainda não for a final geral, filtra estritamente pela categoria ativa
                if (emFaseMataMata && !todasCategoriasConcluidas && catFinal !== chaveCatFoco) return;

                if (!pendentesPorCat[catFinal]) pendentesPorCat[catFinal] = [];
                pendentesPorCat[catFinal].push(r);
            });
        });

        const totalPendenciasGeral = Object.values(pendentesPorCat).reduce((acc, arr) => acc + arr.length, 0);

        if (totalPendenciasGeral > 0) {
            const pendenciasTxt = Object.keys(pendentesPorCat).map(catK => {
                const qtd = pendentesPorCat[catK].length;
                const partes = catK.split('_');
                const rotulo = `Classe ${partes[0]}`;
                return `${qtd} na ${rotulo}`;
            });

            let msgToast = '';
            if (pendenciasTxt.length === 1) {
                const classeInfo = pendenciasTxt[0].replace(/^\d+\s+na\s+/, '');
                msgToast = totalPendenciasGeral === 1
                    ? `Existe 1 partida pendente na ${classeInfo}.`
                    : `Existem ${totalPendenciasGeral} partidas pendentes na ${classeInfo}.`;
            } else {
                msgToast = `Existem ${totalPendenciasGeral} partidas pendentes (${pendenciasTxt.join(' • ')}).`;
            }

            showToast(msgToast, "warning", 5000);
            return; // ⛔ Interrompe se houver jogo não homologado
        }

    } catch (err) {
        console.error("❌ Erro ao auditar reservas pendentes antes de encerrar:", err);
    }

    // 🚀 3. EXECUÇÃO DO AVANÇO APÓS A CONFIRMAÇÃO DO MODAL
    const executarEncerramentoFase3 = async () => {
        if (navigator.vibrate) navigator.vibrate(40);

        try {
            const updates = {};
            let novaFase = faseAtual;
            let eHomologacaoFinal = false;

            if (emFaseMataMata) {
                const [snapChaves, snapPartidas] = await Promise.all([
                    database.ref(`${raizBanco}/ranking/chaves`).once('value'),
                    database.ref(`${raizBanco}/ranking/partidas`).once('value')
                ]);

                const chavesMapBanco = snapChaves.exists() ? snapChaves.val() : {};
                const partidasMap = snapPartidas.exists() ? snapPartidas.val() : {};

                if (todasCategoriasConcluidas) {
                    // 🏆 HOMOLOGAÇÃO GERAL: Todas as finais de todas as classes terminaram
                    novaFase = emMataMataDireto ? 4 : 5;
                    eHomologacaoFinal = true;
                    updates[`${raizBanco}/config/ranking/faseAtual`] = novaFase;
                } else {
                    // 🎯 AVANÇO MODULAR: Avança exclusivamente a categoria ativa selecionada
                    const chaveInfo = chavesMapBanco[chaveCatFoco] || {};
                    const rodadaAtual = chaveInfo.rodada1 || [];

                    const res = gerarProximaRodadaMataMataSaaS(rodadaAtual, partidasMap, chaveCatFoco);

                    if (!res.concluida) {
                        showToast(res.motivo || "Existem partidas pendentes nesta categoria.", "warning");
                        return;
                    }

                    const historico = chaveInfo.historicoRodadas || {};
                    const faseAnteriorNum = parseInt(chaveInfo.faseAtual, 10) || (rodadaAtual.length * 2);
                    historico[faseAnteriorNum] = rodadaAtual;

                    updates[`${raizBanco}/ranking/chaves/${chaveCatFoco}`] = {
                        totalClassificados: chaveInfo.totalClassificados || 0,
                        faseAtual: res.faseAtual,
                        rodada1: res.rodada1,
                        historicoRodadas: historico
                    };

                    novaFase = faseAtual;
                    eHomologacaoFinal = false;
                }
            } else if (modelo === 'grupos' && !emMataMataDireto && faseAtual === 3) {
                const [snapTabelas, snapPartidas] = await Promise.all([
                    database.ref(`${raizBanco}/ranking/tabelas`).once('value'),
                    database.ref(`${raizBanco}/ranking/partidas`).once('value')
                ]);

                const tabelasMap = snapTabelas.exists() ? snapTabelas.val() : {};
                const partidasMap = snapPartidas.exists() ? snapPartidas.val() : {};

                const tamanhoGrupo = parseInt(conf.grupos?.tamanhoGrupo, 10) || 3;
                const classificadosQtd = parseInt(conf.grupos?.classificadosGrupo, 10) || 2;
                const criterioDesempate = conf.grupos?.criterioDesempate || 'games_confronto_sorteio';
                const ptsVit = parseInt(conf.grupos?.pontosVitoria, 10) || 3;
                const ptsDer = parseInt(conf.grupos?.pontosDerrota, 10) || 1;

                Object.keys(tabelasMap).forEach(chaveCat => {
                    const idsArray = tabelasMap[chaveCat] || [];
                    if (!Array.isArray(idsArray) || idsArray.length === 0) return;

                    const estatisticas = {};
                    const confrontosDiretos = {};
                    idsArray.forEach(id => { estatisticas[id] = { j: 0, v: 0, d: 0, sg: 0, pts: 0 }; });

                    Object.values(partidasMap).forEach(partida => {
                        if (partida.status === 'finalizada' && partida.categoria === chaveCat) {
                            const p1 = partida.jogador1Id;
                            const p2 = partida.jogador2Id;
                            const vitorioso = partida.vencedorId;
                            const g1 = parseInt(partida.gamesP1) || 0;
                            const g2 = parseInt(partida.gamesP2) || 0;

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

                    const classificadosMataMata = [];
                    for (let i = 0; i < idsArray.length; i += tamanhoGrupo) {
                        const membrosChave = idsArray.slice(i, i + tamanhoGrupo);
                        membrosChave.sort((a, b) => {
                            const stA = estatisticas[a] || { pts: 0, sg: 0, v: 0 };
                            const stB = estatisticas[b] || { pts: 0, sg: 0, v: 0 };
                            if (stB.pts !== stA.pts) return stB.pts - stA.pts;
                            if (criterioDesempate === 'confronto_games') {
                                const vDir = confrontosDiretos[`${a}_vs_${b}`];
                                if (vDir) return vDir === a ? -1 : 1;
                                if (stB.sg !== stA.sg) return stB.sg - stA.sg;
                            } else {
                                if (stB.sg !== stA.sg) return stB.sg - stA.sg;
                                const vDir = confrontosDiretos[`${a}_vs_${b}`];
                                if (vDir) return vDir === a ? -1 : 1;
                            }
                            return stB.v - stA.v;
                        });
                        classificadosMataMata.push(...membrosChave.slice(0, classificadosQtd));
                    }

                    const resultadoMM = gerarCruzamentosMataMataSaaS(classificadosMataMata, classificadosQtd, chaveCat);

                    updates[`${raizBanco}/ranking/chaves/${chaveCat}`] = {
                        totalClassificados: resultadoMM.totalClassificados,
                        faseAtual: resultadoMM.faseAtual,
                        rodada1: resultadoMM.rodada1
                    };
                });

                novaFase = 4;
                updates[`${raizBanco}/config/ranking/faseAtual`] = 4;
            } else {
                novaFase = 4;
                eHomologacaoFinal = true;
                updates[`${raizBanco}/config/ranking/faseAtual`] = 4;
            }

            if (eHomologacaoFinal) {
                const edicaoId = `${new Date().getFullYear()}_${(cal.nomeTorneio || 'Torneio').replace(/\s+/g, '_')}`;

                const [snapTabelasTorneio, snapSemeadura, snapRankingGeral, snapPartidas, snapPontosGeral] = await Promise.all([
                    database.ref(`${raizBanco}/ranking/tabelas`).once('value'),
                    database.ref(`${raizBanco}/ranking/semeadura`).once('value'),
                    database.ref(`${raizBanco}/ranking/ranking_geral`).once('value'),
                    database.ref(`${raizBanco}/ranking/partidas`).once('value'),
                    database.ref(`${raizBanco}/ranking/pontos_geral`).once('value')
                ]);

                const tabelasTorneio = snapTabelasTorneio.exists() ? snapTabelasTorneio.val() : {};
                const semeaduraTorneio = snapSemeadura.exists() ? snapSemeadura.val() : {};
                const partidasTorneio = snapPartidas.exists() ? snapPartidas.val() : {};
                const pontosGeralAtual = snapPontosGeral.exists() ? snapPontosGeral.val() : {};
                
                const tabelasGruposFoto = JSON.parse(JSON.stringify(tabelasTorneio));
                const semeaduraGruposMap = JSON.parse(JSON.stringify(semeaduraTorneio));

                const pGeral = conf.parametrosGeral || {};
                const TABELA_PONTOS_SaaS = {
                    0: parseInt(pGeral.pontos1, 10) || 250,
                    1: parseInt(pGeral.pontos2, 10) || 180,
                    2: parseInt(pGeral.pontos3, 10) || 120,
                    3: parseInt(pGeral.pontos4, 10) || 60
                };
                const PONTOS_PARTICIPACAO_DEFAULT = (pGeral.pontosParticipacao !== undefined && pGeral.pontosParticipacao !== null) 
                    ? parseInt(pGeral.pontosParticipacao, 10) 
                    : 20;

                const chavesMapGlobal = (typeof rankingChavesGlobal !== 'undefined' && rankingChavesGlobal) ? rankingChavesGlobal : {};

                Object.keys(tabelasTorneio).forEach(chaveCat => {
                    let classificacaoTorneio = tabelasTorneio[chaveCat] || [];
                    if (!Array.isArray(classificacaoTorneio) || classificacaoTorneio.length === 0) return;

                    if (modelo === 'grupos') {
                        classificacaoTorneio = obterClassificacaoFinalGruposMataMataSaaS(chaveCat, classificacaoTorneio, chavesMapGlobal, partidasTorneio);
                        tabelasTorneio[chaveCat] = classificacaoTorneio;
                    }

                    let pontosCat = pontosGeralAtual[chaveCat] || {};

                    classificacaoTorneio.forEach((idAtleta, posicaoIdx) => {
                        const pontosGanhos = TABELA_PONTOS_SaaS[posicaoIdx] !== undefined 
                            ? TABELA_PONTOS_SaaS[posicaoIdx] 
                            : PONTOS_PARTICIPACAO_DEFAULT;

                        const pontosAtuais = parseInt(pontosCat[idAtleta], 10) || 0;
                        pontosCat[idAtleta] = pontosAtuais + pontosGanhos;
                    });

                    updates[`${raizBanco}/ranking/pontos_geral/${chaveCat}`] = pontosCat; 

                    const todosAtletasCat = Object.keys(pontosCat);
                    todosAtletasCat.sort((a, b) => (parseInt(pontosCat[b], 10) || 0) - (parseInt(pontosCat[a], 10) || 0));

                    updates[`${raizBanco}/ranking/ranking_geral/${chaveCat}`] = todosAtletasCat;

                    updates[`${raizBanco}/hall_de_campeoes/${edicaoId}/${chaveCat}`] = {
                        campeao: classificacaoTorneio[0] || null,
                        vice: classificacaoTorneio[1] || null,
                        terceiro: classificacaoTorneio[2] || null
                    };
                });

                const gruposConfig = conf.grupos || {};

                const contratoCongelado = {
                    ...cal,
					faseInicial: cal.faseInicial || gruposConfig.faseInicial || 'grupos',
                    tamanhoGrupo: parseInt(cal.tamanhoGrupo || gruposConfig.tamanhoGrupo, 10) || 3,
                    classificadosGrupo: parseInt(cal.classificadosGrupo || gruposConfig.classificadosGrupo, 10) || 2,
                    criterioDesempate: cal.criterioDesempate || gruposConfig.criterioDesempate || 'games_confronto_sorteio'
                };

                const objetoHistorico = {
                    dataHomologacao: Date.now(),
                    modelo: modelo,
                    contrato: contratoCongelado,
                    classificacaoFinal: tabelasTorneio,
                    partidas: partidasTorneio
                };

                if (modelo === 'grupos') {
                    objetoHistorico.semeaduraGrupos = semeaduraGruposMap;
                    objetoHistorico.tabelasGrupos = tabelasGruposFoto;
                }

                updates[`${raizBanco}/historico_torneios/${edicaoId}`] = objetoHistorico;
				
				// 🧹 LIMPEZA DE CICLO: Extingue a fila de espera e inscrições ao homologar o torneio
                updates[`${raizBanco}/config/ranking/filaEspera`] = null;
                updates[`${raizBanco}/config/ranking/inscritosConfirmados`] = null;
                // 🏆 CARIMBO IMUTÁVEL DE CONCLUSÃO (0 ms de latência no reload)
                updates[`${raizBanco}/config/ranking/torneioConcluido`] = true;
				
				// 🧠 SINCRONIZAÇÃO IMEDIATA DA MEMÓRIA RAM (ACERVO HISTÓRICO):
                const novaEdicaoHistorica = { id: edicaoId, ...objetoHistorico };
                if (typeof acervoHistoricoGlobalSaaS !== 'undefined' && Array.isArray(acervoHistoricoGlobalSaaS)) {
                    acervoHistoricoGlobalSaaS = acervoHistoricoGlobalSaaS.filter(item => item.id !== edicaoId);
                    acervoHistoricoGlobalSaaS.unshift(novaEdicaoHistorica);
                } else {
                    acervoHistoricoGlobalSaaS = [novaEdicaoHistorica];
                }
            }

            await database.ref().update(updates);

            if (typeof configRegrasGlobal !== 'undefined' && configRegrasGlobal && configRegrasGlobal.ranking) {
                configRegrasGlobal.ranking.faseAtual = novaFase;
                if (eHomologacaoFinal) {
                    configRegrasGlobal.ranking.torneioConcluido = true;
                }
            }

            const msgSucesso = eHomologacaoFinal 
                ? "Torneio homologado e arquivado com sucesso no Histórico!" 
                : "Rodada avançada com sucesso!";
            showToast(msgSucesso, "success");

            if (typeof renderizarGestaoTemporadaSaaS === "function") {
                renderizarGestaoTemporadaSaaS();
            }

            if (eHomologacaoFinal && typeof abrirHallDeCampeoesSaaS === "function") {
                setTimeout(() => {
                    abrirHallDeCampeoesSaaS();
                    if (typeof dispararComemoracaoCampeaoSaaS === 'function') {
                        dispararComemoracaoCampeaoSaaS();
                    }
                }, 800);
            }
        } catch (err) {
            console.error("❌ Erro ao avançar de fase:", err);
            showToast("Erro ao gravar dados no Firebase.", "error");
        }
    };

    // 🚀 4. MONTAGEM CONTEXTUAL DO MODAL
    let tituloPrompt = "Avançar Fase";
    let msgPrompt = "Deseja avançar para a próxima fase?";

    if (emFaseMataMata) {
        if (todasCategoriasConcluidas) {
            tituloPrompt = "Concluir e Homologar Torneio";
            msgPrompt = "Todas as finais foram concluídas! Deseja homologar o torneio, creditar os pontos e arquivar a edição no Histórico?";
        } else {
            const partesCat = chaveCatFoco.split('_');
            const rotuloCatTxt = `Classe ${partesCat[0]}`;

            const proximoTamanho = tamanhoChaveCat / 2;
            const rotuloProxima = (typeof obterRotuloFaseMataMataSaaS === 'function')
                ? obterRotuloFaseMataMataSaaS(proximoTamanho)
                : "Próxima Fase";
            const artigo = (proximoTamanho === 2) ? "para a" : "para as";

            tituloPrompt = `Avançar ${artigo} ${rotuloProxima} (${rotuloCatTxt})`;
            msgPrompt = `As partidas desta rodada na <b>${rotuloCatTxt}</b> foram concluídas. Deseja consolidar os vencedores e avançar ${artigo} <b>${rotuloProxima}</b>?`;
        }
    } else if (faseAtual === 3) {
        if (modelo === 'piramide') {
            tituloPrompt = "Encerrar Pirâmide e Homologar Posições";
            msgPrompt = "Deseja encerrar o ciclo de desafios da Pirâmide, atualizar o Ranking Geral e arquivar esta edição no Histórico?";
        } else if (modelo === 'barragem') {
            tituloPrompt = "Encerrar Barragem e Consolidar Ranking";
            msgPrompt = "Deseja encerrar a disputa por pontos corridos, atualizar o Ranking Geral e arquivar esta edição no Histórico?";
        } else {
            tituloPrompt = "Encerrar Chaves e Gerar Mata-Mata";
            msgPrompt = "Deseja consolidar a classificação da Fase de Grupos e gerar os confrontos do Mata-Mata?";
        }
    }

    showPrompt(tituloPrompt, `<div style="text-align: left; font-size: 14px; color: #334155; line-height: 1.5;"><p style="margin: 0;">${msgPrompt}</p></div>`, () => {
        executarEncerramentoFase3();
    });
}



function abrirHallDeCampeoesSaaS() {
    abaVisaoLeaderboardSaaS = 'TORNEIO';
    if (typeof abrirLeaderboardSaaS === 'function') {
        abrirLeaderboardSaaS();
    } else {
        showToast("Exibindo classificação final da temporada.", "info");
    }
}

function reiniciarEsteiraNovoTorneioSaaS() {
    if (!isGestorLogado || !raizBanco) {
        showToast("Apenas o gestor pode iniciar uma nova temporada.", "error"); 
        return;
    }

    showPrompt("Criar Novo Torneio", "Deseja iniciar a criação de um novo torneio? Os dados anteriores já estão no Histórico.", async () => {
        try {
            console.log("🔄 [Novo Torneio] Apagando dados ativos da temporada anterior...");

            // Limpeza física direta via .remove()
            await Promise.all([
                database.ref(`${raizBanco}/ranking/partidas`).remove(),
                database.ref(`${raizBanco}/ranking/tabelas`).remove(),
                database.ref(`${raizBanco}/ranking/chaves`).remove(),
                database.ref(`${raizBanco}/convites_ranking`).remove()
            ]);

            const updates = {};
            updates[`${raizBanco}/config/ranking/faseAtual`] = 1;
            updates[`${raizBanco}/config/ranking/calendario`] = null;
            updates[`${raizBanco}/config/ranking/inscritosConfirmados`] = null;
			updates[`${raizBanco}/config/ranking/filaEspera`] = null;
            updates[`${raizBanco}/config/ranking/torneioConcluido`] = null;

            await database.ref().update(updates);

            if (typeof configRegrasGlobal !== 'undefined' && configRegrasGlobal && configRegrasGlobal.ranking) {
                configRegrasGlobal.ranking.torneioConcluido = null;
            }

            console.log("✅ [Novo Torneio] Banco zerado e retornado à Fase 1.");
            showToast("Módulo pronto para o novo torneio!", "success");

            // Atualiza a esteira e abre diretamente o formulário do cadastro (Painel 1)
            renderizarGestaoTemporadaSaaS();
            if (typeof editarCalendarioAtivoSaaS === 'function') {
                editarCalendarioAtivoSaaS();
            }

        } catch (err) {
            console.error("❌ [Novo Torneio] Erro ao reiniciar esteira:", err);
            showToast("Erro ao atualizar dados no Firebase.", "error");
        }
    });
}
/* ======================================================== */
/* 4. MOTOR V2: FUNÇÕES MATEMÁTICAS E ALGORITMOS DE MATA-MATA */
/* ======================================================== */

function obterRotuloFaseMataMataSaaS(fase) {
    const numFase = parseInt(fase, 10) || 2;

    switch (numFase) {
        case 2:
            return "Grande Final";   
        case 4:
            return "Semi-Finais";
        case 8:
            return "Quartas de Final";
        case 16:
            return "Oitavas de Final";
        case 32:
            return "16avos de Final";
        case 64:
            return "32avos de Final";
        case 128:
            return "64avos de Final";
        case 256:
            return "128avos de Final";
        default:
            if (numFase > 32) {
                return `${Math.floor(numFase / 2)}avos de Final`;
            }
            return "Mata-Mata";
    }
}

function calcularPotenciaDeDoisSuperiorSaaS(valor) {
    let pot = 2;
    while (pot < valor) {
        pot *= 2;
    }
    return pot;
}


/* ======================================================== */
/* GERADOR AUXILIAR DE PRIORIDADE DE SEMENTES (ATP/ITF)     */
/* ======================================================== */
function obterOrdemPrioridadePartidasSaaS(numPartidas) {
    let ordem = [0];
    while (ordem.length < numPartidas) {
        const len = ordem.length;
        const proximo = [];
        for (let i = 0; i < len; i++) {
            proximo.push(ordem[i]);
            proximo.push(2 * len - 1 - ordem[i]);
        }
        ordem = proximo;
    }
    return ordem;
}


/* ======================================================== */
/* CHAVEAMENTO ELIMINATÓRIO OFICIAL ITF/ATP (UNIVERSAL)     */
/* ======================================================== */
function gerarCruzamentosMataMataSaaS(listaClassificados, classificadosPorGrupo = 2, chaveCat = '') {
    const totalClassific = listaClassificados.filter(id => id !== null && id !== undefined).length;
    if (totalClassific < 2) return { totalClassificados: totalClassific, faseAtual: 2, rodada1: [] };

    const tamanhoChave = calcularPotenciaDeDoisSuperiorSaaS(totalClassific);
    const numPartidas = tamanhoChave / 2;
    const numByes = tamanhoChave - totalClassific;

    const semeaduraOriginal = (typeof rankingSemeaduraGlobal !== 'undefined' && chaveCat && rankingSemeaduraGlobal[chaveCat]) 
        ? rankingSemeaduraGlobal[chaveCat] 
        : null;

    // Helper para obter a semente oficial do atleta no ranking (#1, #2, #3...)
    const obterSementeId = (id) => {
        if (!id || !semeaduraOriginal) return 999;
        const idx = semeaduraOriginal.indexOf(id);
        return idx !== -1 ? idx + 1 : 999;
    };

    // 1. Mapeia 1ºs e 2ºs colocados preservando a semente oficial de cada um
    const primeiros = [];
    const segundos = [];

    listaClassificados.forEach((idAtleta, idx) => {
        if (!idAtleta) return;
        const grupoIdx = Math.floor(idx / classificadosPorGrupo) + 1;
        const posNoGrupo = (idx % classificadosPorGrupo) + 1;
        const semente = obterSementeId(idAtleta);

        if (posNoGrupo === 1) {
            primeiros.push({ id: idAtleta, grupoIdx, semente, posNoGrupo });
        } else if (posNoGrupo === 2) {
            segundos.push({ id: idAtleta, grupoIdx, semente, posNoGrupo });
        }
    });

    // Ordena ambos os potes rigorosamente por semente (#1, #2, #3...)
    primeiros.sort((a, b) => a.semente - b.semente);
    segundos.sort((a, b) => a.semente - b.semente);

    // Array de N slots para o quadro (0 até tamanhoChave - 1)
    const slotsQuadro = new Array(tamanhoChave).fill(null);
    const gruposNaMetadeSuperior = new Set();

    // 2. Alocação dos Cabeças de Chave principais (1ºs colocados)
    const ordemPrioridadePartidas = obterOrdemPrioridadePartidasSaaS(numPartidas);

    primeiros.forEach((p, i) => {
        const matchIdx = ordemPrioridadePartidas[i];
        const slotPos = matchIdx * 2; // Posição do confronto no quadro
        slotsQuadro[slotPos] = p.id;

        // Registra se o 1º colocado deste grupo ficou na Metade Superior
        if (slotPos < tamanhoChave / 2) {
            gruposNaMetadeSuperior.add(p.grupoIdx);
        }
    });

    // 3. Atribuição de BYEs prioritários para as sementes mais altas (#1, #2...)
    for (let i = 0; i < numByes; i++) {
        const matchIdx = ordemPrioridadePartidas[i];
        const slotByePos = matchIdx * 2 + 1; // Posição do adversário do BYE
        slotsQuadro[slotByePos] = "BYE";
    }

    // 4. Alocação dos 2ºs Colocados aplicando a Regra da Metade Oposta (ITF)
    segundos.forEach(s => {
        // Se o 1º do grupo está no Topo, o 2º deve ir obrigatoriamente para a Metade Inferior
        const prefereMetadeInferior = gruposNaMetadeSuperior.has(s.grupoIdx);

        let slotEscolhido = -1;

        for (let i = 0; i < tamanhoChave; i++) {
            const slotCandidate = prefereMetadeInferior 
                ? (Math.floor(tamanhoChave / 2) + i) % tamanhoChave 
                : i;

            if (slotsQuadro[slotCandidate] === null) {
                slotEscolhido = slotCandidate;
                break;
            }
        }

        if (slotEscolhido !== -1) {
            slotsQuadro[slotEscolhido] = s.id; 
        }
    });

    // 5. Monta o objeto oficial de partidas da Rodada 1
    const partidas = [];
    for (let i = 0; i < numPartidas; i++) {
        const id1 = slotsQuadro[i * 2];
        const id2 = slotsQuadro[i * 2 + 1];

        const ehBye = id1 === "BYE" || id2 === "BYE";
        const p1 = id1 === "BYE" ? null : id1;
        const p2 = id2 === "BYE" ? null : id2;

        partidas.push({
            fase: tamanhoChave,
            jogador1Id: p1,
            jogador2Id: p2,
            isBye: ehBye
        });
    }

    return {
        totalClassificados: totalClassific,
        faseAtual: tamanhoChave,
        rodada1: partidas
    };
}


/**
 * 🏆 Geração de Chave Eliminatória Direta ($2^N$ com BYEs Oficiais ITF/ATP)
 * Função isolada e exclusiva para o modelo Mata-Mata Direto.
 */
/* ======================================================== */
/* CHAVEAMENTO ELIMINATÓRIO DIRETO OFICIAL ITF/ATP (UNIVERSAL) */
/* ======================================================== */
function gerarCruzamentosMataMataDiretoSaaS(listaInscritos, chaveCat = '') {
    const totalInscritos = listaInscritos.filter(id => id !== null && id !== undefined).length;
    if (totalInscritos < 2) return { totalClassificados: totalInscritos, faseAtual: 2, rodada1: [] };

    // 1. Busca a semeadura oficial (#1, #2, #3...)
    const semeaduraOficial = (typeof rankingSemeaduraGlobal !== 'undefined' && chaveCat && rankingSemeaduraGlobal[chaveCat])
        ? rankingSemeaduraGlobal[chaveCat]
        : listaInscritos.filter(Boolean);

    // 2. Calcula a potência de 2 superior (2, 4, 8, 16, 32, 64, 128...)
    const tamanhoChave = calcularPotenciaDeDoisSuperiorSaaS(totalInscritos);
    const numPartidas = tamanhoChave / 2;
    const numByes = tamanhoChave - totalInscritos;

    // 3. Obtém a ordem de prioridade matemática universal do motor homologado
    const ordemPrioridadePartidas = obterOrdemPrioridadePartidasSaaS(numPartidas);

    // 4. Monta os slots do quadro (0 até tamanhoChave - 1)
    const slotsQuadro = new Array(tamanhoChave).fill(null);

    // Aloca as sementes na ordem matemática prioritária (#1 no topo Slot 0, #2 na base do último jogo, etc.)
    semeaduraOficial.forEach((idAtleta, idxSemente) => {
        if (!idAtleta || idxSemente >= numPartidas) return;
        const matchIdx = ordemPrioridadePartidas[idxSemente];
        slotsQuadro[matchIdx * 2] = idAtleta;
    });

    // Atribui BYEs prioritariamente como oponentes dos cabeças de chave mais altos
    for (let i = 0; i < numByes; i++) {
        const matchIdx = ordemPrioridadePartidas[i];
        slotsQuadro[matchIdx * 2 + 1] = "BYE";
    }

    // Preenche as sementes restantes que jogarão contra adversários reais na 1ª rodada
    let idxRestantes = numPartidas;
    for (let i = numByes; i < numPartidas; i++) {
        const matchIdx = ordemPrioridadePartidas[i];
        if (slotsQuadro[matchIdx * 2 + 1] === null && idxRestantes < totalInscritos) {
            slotsQuadro[matchIdx * 2 + 1] = semeaduraOficial[idxRestantes] || null;
            idxRestantes++;
        }
    }

    // 5. Monta o objeto oficial das partidas da Rodada 1
    const partidas = [];
    for (let i = 0; i < numPartidas; i++) {
        const id1 = slotsQuadro[i * 2];
        const id2 = slotsQuadro[i * 2 + 1];

        const ehBye = id1 === "BYE" || id2 === "BYE";
        const p1 = id1 === "BYE" ? null : id1;
        const p2 = id2 === "BYE" ? null : id2;

        partidas.push({
            fase: tamanhoChave,
            jogador1Id: p1,
            jogador2Id: p2,
            isBye: ehBye
        });
    }

    return {
        totalClassificados: totalInscritos,
        faseAtual: tamanhoChave,
        rodada1: partidas
    };
}



function gerarProximaRodadaMataMataSaaS(rodadaAnterior, partidasGlobal, chaveCat) {
    const proximaRodada = [];
    let todasFinalizadas = true;

    for (let i = 0; i < rodadaAnterior.length; i += 2) {
        const conf1 = rodadaAnterior[i];
        const conf2 = rodadaAnterior[i + 1];

        let v1Id = null;
        let v2Id = null;

        if (conf1) {
            if (conf1.isBye || !conf1.jogador2Id) {
                v1Id = conf1.jogador1Id || conf1.jogador2Id;
            } else {
                const p1 = Object.values(partidasGlobal || {}).find(partida => {
                    if (partida.categoria !== chaveCat || partida.status !== 'finalizada') return false;
                    const dp = partida.dadosPlacar || {};
                    if (partida.tagGrupoRanking || dp.tagGrupoRanking) return false;
                    return (partida.jogador1Id === conf1.jogador1Id && partida.jogador2Id === conf1.jogador2Id) ||
                           (partida.jogador1Id === conf1.jogador2Id && partida.jogador2Id === conf1.jogador1Id);
                });

                if (p1 && p1.vencedorId) {
                    v1Id = p1.vencedorId;
                } else {
                    todasFinalizadas = false;
                }
            }
        }

        if (conf2) {
            if (conf2.isBye || !conf2.jogador2Id) {
                v2Id = conf2.jogador1Id || conf2.jogador2Id;
            } else {
                const p2 = Object.values(partidasGlobal || {}).find(partida => {
                    if (partida.categoria !== chaveCat || partida.status !== 'finalizada') return false;
                    const dp = partida.dadosPlacar || {};
                    if (partida.tagGrupoRanking || dp.tagGrupoRanking) return false;
                    return (partida.jogador1Id === conf2.jogador1Id && partida.jogador2Id === conf2.jogador2Id) ||
                           (partida.jogador1Id === conf2.jogador2Id && partida.jogador2Id === conf2.jogador1Id);
                });

                if (p2 && p2.vencedorId) {
                    v2Id = p2.vencedorId;
                } else {
                    todasFinalizadas = false;
                }
            }
        }

        if (v1Id || v2Id) {
            const tamanhoNovaFase = (conf1 ? conf1.fase : 4) / 2;
            proximaRodada.push({
                fase: tamanhoNovaFase,
                jogador1Id: v1Id,
                jogador2Id: v2Id,
                isBye: (v1Id && !v2Id) || (!v1Id && v2Id)
            });
        }
    }

    if (!todasFinalizadas) {
        return {
            concluida: false,
            motivo: "Existem partidas pendentes na rodada atual do Mata-Mata."
        };
    }

    return {
        concluida: true,
        faseAtual: proximaRodada.length > 0 ? proximaRodada[0].fase : 2,
        rodada1: proximaRodada
    };
}

/**
 * Recalcula a classificação final do torneio de Grupos ordenando
 * Campeão (1º), Vice (2º), Perdedores reais da Semi (3º/4º) e demais eliminados.
 */
function obterClassificacaoFinalGruposMataMataSaaS(chaveCat, ordemGruposOriginal, chavesMap, partidasMap) {
    const chaveInfo = (chavesMap && chavesMap[chaveCat]) ? chavesMap[chaveCat] : {};
    const rodadaFinal = chaveInfo.rodada1 || [];

    if (!rodadaFinal || rodadaFinal.length === 0) return ordemGruposOriginal;

    const finalMatch = rodadaFinal[0];
    if (!finalMatch || !finalMatch.jogador1Id || !finalMatch.jogador2Id) return ordemGruposOriginal;

    // Localiza a partida da Grande Final no histórico (excluindo jogos de grupo)
    const partidaFinal = Object.values(partidasMap || {}).find(p => 
        p.categoria === chaveCat && p.status === 'finalizada' &&
        !p.tagGrupoRanking && !p.dadosPlacar?.tagGrupoRanking &&
        ((p.jogador1Id === finalMatch.jogador1Id && p.jogador2Id === finalMatch.jogador2Id) ||
         (p.jogador1Id === finalMatch.jogador2Id && p.jogador2Id === finalMatch.jogador1Id))
    );

    if (!partidaFinal || !partidaFinal.vencedorId) return ordemGruposOriginal;

    const campeaoId = partidaFinal.vencedorId;
    const viceId = (campeaoId === finalMatch.jogador1Id) ? finalMatch.jogador2Id : finalMatch.jogador1Id;

    const atletasProcessados = new Set([campeaoId, viceId]);
    const ordemFinal = [campeaoId, viceId];

    // Coleta os eliminados EXCLUSIVAMENTE das Semi-Finais (Fase 4 no histórico)
    const historico = chaveInfo.historicoRodadas || {};
    const rodadaSemis = historico[4] || historico["4"] || [];
    const perdedoresSemis = [];

    if (rodadaSemis.length > 0) {
        rodadaSemis.forEach(conf => {
            if (conf.isBye || !conf.jogador2Id) return;

            const partidaSemi = Object.values(partidasMap || {}).find(p =>
                p.categoria === chaveCat && p.status === 'finalizada' &&
                !p.tagGrupoRanking && !p.dadosPlacar?.tagGrupoRanking &&
                ((p.jogador1Id === conf.jogador1Id && p.jogador2Id === conf.jogador2Id) ||
                 (p.jogador1Id === conf.jogador2Id && p.jogador2Id === conf.jogador1Id)) // 🟢 Corrigido: jogador2Id
            );

            if (partidaSemi && partidaSemi.vencedorId) {
                const perdedor = (partidaSemi.vencedorId === partidaSemi.jogador1Id) ? partidaSemi.jogador2Id : partidaSemi.jogador1Id;
                if (perdedor && !atletasProcessados.has(perdedor)) {
                    perdedoresSemis.push(perdedor);
                    atletasProcessados.add(perdedor);
                }
            }
        }); 
    }

    // Desempata os perdedores das semis usando o critério de melhor campanha dos grupos
    perdedoresSemis.sort((a, b) => ordemGruposOriginal.indexOf(a) - ordemGruposOriginal.indexOf(b));
    ordemFinal.push(...perdedoresSemis);

    // Mantém a ordem dos demais participantes eliminados nas fases anteriores
    ordemGruposOriginal.forEach(id => {
        if (!atletasProcessados.has(id)) {
            ordemFinal.push(id);
            atletasProcessados.add(id);
        }
    });

    return ordemFinal;
}

/* ======================================================== */
/* 5. EXCLUSÃO SEGURA DE TORNEIO DO ACERVO HISTÓRICO        */
/* ======================================================== */
function excluirTorneioHistoricoSaaS(edicaoId, nomeTorneio) {
    if (!raizBanco || !edicaoId) return;

    // Trava de Segurança: Apenas Gestor ou Admin podem excluir
    let perfis = {};
    try { perfis = JSON.parse(localStorage.getItem('jogadorLogadoPerfis') || '{}'); } catch(e) {}
    const ehAdmin = perfis['Admin'] === true;

    if (!isGestorLogado && !ehAdmin) {
        showToast("Apenas o gestor ou administrador pode excluir torneios do histórico.", "error");
        return;
    }

    if (navigator.vibrate) navigator.vibrate(30);

    const nomeExibicao = nomeTorneio || edicaoId.replace(/^\d{4}_/, '').replace(/_/g, ' ');

    const promptHTML = `
        <div style="text-align: left; font-size: 14px; color: #334155; line-height: 1.5;">
            <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px; margin-bottom: 12px;">
                <strong style="color: #dc2626; display: block; font-size: 13px; text-transform: uppercase; margin-bottom: 4px;">
                    ⚠️ Exclusão Permanente de Histórico
                </strong>
                <span style="font-size: 13px; color: #7f1d1d;">
                    Tem certeza que deseja excluir permanentemente a edição <b>"${nomeExibicao}"</b> do Acervo Histórico?
                </span>
            </div>
            <p style="margin: 0; font-size: 12.5px; color: #64748b;">
                Esta ação removerá o registro do Acervo e do Hall de Campeões. Os pontos acumulados no Ranking Geral permanecerão intactos.
            </p>
        </div>
    `;

    showPrompt("Excluir Torneio do Histórico", promptHTML, async () => {
        try {
            if (navigator.vibrate) navigator.vibrate(50);
            showToast("Excluindo torneio do histórico...", "info");

            const updates = {};
            updates[`${raizBanco}/historico_torneios/${edicaoId}`] = null;
            updates[`${raizBanco}/hall_de_campeoes/${edicaoId}`] = null;

            await database.ref().update(updates);

            // 🧠 1. REMOÇÃO DA MEMÓRIA RAM (EVITA ATUALIZAÇÃO MANUAL COM F5)
            if (typeof acervoHistoricoGlobalSaaS !== 'undefined' && Array.isArray(acervoHistoricoGlobalSaaS)) {
                acervoHistoricoGlobalSaaS = acervoHistoricoGlobalSaaS.filter(item => item.id !== edicaoId);
            }

            showToast(`Edição "${nomeExibicao}" removida do histórico!`, "success");

            // 🔄 2. ATUALIZAÇÃO IMEDIATA DA TABELA NA TELA
            if (typeof renderizarTabelaHistoricoSaaS === 'function') {
                renderizarTabelaHistoricoSaaS();
            } else if (typeof renderizarAcervoHistoricoSaaS === 'function') {
                renderizarAcervoHistoricoSaaS();
            }

        } catch (err) {
            console.error("❌ Erro ao excluir torneio do histórico:", err);
            showToast("Erro ao remover torneio do Firebase.", "error");
        }
    });
}