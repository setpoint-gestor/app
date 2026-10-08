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
        const atleta = jogadoresGlobal[idLogado] || {};
        const snapConfig = await database.ref(`${raizBanco}/config/ranking`).once('value');
        const configRanking = snapConfig.val() || {};

        const faseAtual = parseInt(configRanking.faseAtual, 10) || 1;
        if (faseAtual > 2) {
            showToast("As inscrições para este torneio já foram encerradas.", "warning");
            await database.ref(`${raizBanco}/convites_ranking/pendentes/${idLogado}`).remove();
            fecharModalNotificacoes();
            return;
        }

        showToast("Processando sua inscrição no ranking...", "info");

        const cobrarTaxa = configRanking.financeiro?.cobrarTaxa === true;
        const payloadInscrito = {
            nome: atleta.nomeCompleto || atleta.apelido || "Atleta",
            pixPago: !cobrarTaxa,
            dataAceite: Date.now()
        };
        await database.ref(`${raizBanco}/config/ranking/inscritosConfirmados/${idLogado}`).set(payloadInscrito);
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

        // 2. Unificação precisa de inscritos (Fase 2 e Fase 3+) sem duplicidades
        const setInscritos = new Set(Object.keys(configRanking.inscritosConfirmados || {}));
        Object.values(tabelas).forEach(arr => {
            if (Array.isArray(arr)) {
                arr.forEach(id => { if (id) setInscritos.add(id); });
            }
        });
        const totalInscritos = setInscritos.size;

        // 3. Filtragem EXCLUSIVA de reservas vinculadas ao temporadaId ativo
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

        // 4. Mapeamento de notificações ativas da temporada
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

        if (totalGeral === 0 && !snapConvites.exists() && faseAtual === 1 && !temCalendario) {
            showToast("O ranking já se encontra completamente zerado.", "info");
            return;
        }

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
                        <li><b>${totalInscritos}</b> inscrição(ões) nas tabelas ativas do torneio;</li>
                        <li><b>${totalReservasRanking}</b> agendamento(s) da edição atual nas quadras;</li>
                        <li><b>${totalNotificacoes}</b> notificação(ões) nas caixas dos atletas;</li>
                        <li>Contrato de calendário e inscrições ativas da edição atual.</li>
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

                if (typeof rankingPartidasGlobal !== 'undefined') {
                    rankingPartidasGlobal = {};
                }

                // 2. Atualiza os parâmetros de configuração e limpa reservas/notificações vinculadas
                const updates = {};
                updates['config/ranking/faseAtual'] = 1;
                updates['config/ranking/calendario'] = null;
                updates['config/ranking/inscritosConfirmados'] = null;

                caminhosReservasExcluir.forEach(path => { updates[path] = null; });
                caminhosNotificacoesExcluir.forEach(path => { updates[path] = null; }); 

                await database.ref(raizBanco).update(updates); 

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

function renderizarGestaoTemporadaSaaS() {
    const containerStepper = document.getElementById('stepper-gestor-container');
    const cardResumo = document.getElementById('card-resumo-calendario-saas');
    if (!containerStepper) return;

    const conf = (configRegrasGlobal && configRegrasGlobal.ranking) ? configRegrasGlobal.ranking : {};
    
    // 💡 Lógica Neutra: Se houver formato salvo usa ele, senão assume o 'generico'
    const temContratoSalvo = !!conf.calendario?.formatoTorneio;
    const modelo = temContratoSalvo ? conf.calendario.formatoTorneio : "generico";
    
    // 🎯 Leitura do parâmetro de Fase Inicial do modelo Grupos
    const faseInicialGrupos = conf.grupos?.faseInicial || "grupos";
    
    const faseAtual = parseInt(conf.faseAtual, 10) || 1;
    const cal = conf.calendario || {};

    // 🎯 Ajuste dinâmico da esteira de Grupos conforme a Fase Inicial (5 ou 4 passos)
    const rotulosGrupos = (faseInicialGrupos === "matamata")
        ? ["1. Calendário", "2. Inscrições", "3. Mata-Mata", "4. Concluído"]
        : ["1. Calendário", "2. Inscrições", "3. Chaves", "4. Mata-Mata", "5. Concluído"];

    const rotulosPorModelo = {
        grupos: rotulosGrupos,
        barragem: ["1. Calendário", "2. Inscrições", "3. Pontos Corridos", "4. Concluído"],
        piramide: ["1. Calendário", "2. Inscrições", "3. Escada", "4. Concluído"],
        generico: ["1. Calendário", "2. Inscrições", "3. Competição", "4. Concluído"] // 🌟 Esteira Base
    };

    const listaRotulos = rotulosPorModelo[modelo] || rotulosPorModelo.generico;

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

    // Se a fase for 1 (início/zerado), direciona para o painel neutro (Painel 5)
        let painelAlvo = faseAtual;
        if (faseAtual === 1) {
            painelAlvo = 5;
        } else if (modelo !== "grupos" && faseAtual === 4) {
            painelAlvo = 5;
        } else if (modelo === "grupos" && faseInicialGrupos === "matamata") {
            if (faseAtual === 3) painelAlvo = 4; // No Mata-Mata Direto, a Fase 3 exibe o painel do Mata-Mata (#fase-panel-4)
            if (faseAtual === 4) painelAlvo = 5; // A Fase 4 encerra e exibe o painel Concluído (#fase-panel-5)
        }

        document.querySelectorAll('#container-fases-gestor .fase-panel').forEach((panel, idx) => {
            if ((idx + 1) === painelAlvo) {
                panel.classList.add('ativa');
            } else {
                panel.classList.remove('ativa');
            }
        });

    const panelFase3 = document.querySelectorAll('#container-fases-gestor .fase-panel')[2];
    if (panelFase3) {
        const elBoxAviso = panelFase3.children[0];
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

        if (btnAcaoFase3) {
            btnAcaoFase3.style.display = 'none';
        }
    }
    
    const panelFase4 = document.querySelectorAll('#container-fases-gestor .fase-panel')[3];
    const emMataMataDiretoF4 = (modelo === 'grupos' && faseInicialGrupos === 'matamata');
    const emFaseExibicaoMataMata = (modelo === 'grupos' && ((emMataMataDiretoF4 && faseAtual === 3) || (!emMataMataDiretoF4 && faseAtual === 4)));

    if (panelFase4 && emFaseExibicaoMataMata) {
        const elBoxAviso4 = panelFase4.children[0];
        if (elBoxAviso4) {
            const chavesMap = (typeof rankingChavesGlobal !== 'undefined' && rankingChavesGlobal) ? rankingChavesGlobal : {};
            let maiorTamanhoChave = 2;
            const chavesList = Object.values(chavesMap);
            if (chavesList.length > 0) {
                const tamanhos = chavesList.map(c => parseInt(c.faseAtual || (c.rodada1 ? c.rodada1.length * 2 : 2), 10));
                maiorTamanhoChave = Math.max(...tamanhos);
            }

            const rotuloAtual = (typeof obterRotuloFaseMataMataSaaS === 'function')
                ? obterRotuloFaseMataMataSaaS(maiorTamanhoChave)
                : "Mata-Mata"; 
            
            const artigoAtual = (maiorTamanhoChave === 2) ? "da" : "das";

            let bulletInstrucao = "";
            if (maiorTamanhoChave > 2) {
                const proximoTamanho = maiorTamanhoChave / 2;
                const rotuloProximo = (typeof obterRotuloFaseMataMataSaaS === 'function')
                    ? obterRotuloFaseMataMataSaaS(proximoTamanho)
                    : "Próxima Fase";
                const artigoProximo = (proximoTamanho === 2) ? "para a" : "para as";

                bulletInstrucao = `• Finalizados os jogos, avance ${artigoProximo} ${rotuloProximo}.`;
            } else {
                bulletInstrucao = "• Finalizados os jogos, conclua a temporada para pontuar os atletas.";
            }

            elBoxAviso4.innerHTML = `
                <p style="margin: 0 0 4px 0; font-weight: 700; color: #6b21a8;">📍 Fase ${faseAtual}: Quadro Eliminatório (${rotuloAtual})</p>
                <span style="display: block; font-size: 12.5px; color: #7e22ce; line-height: 1.4;">• Confrontos decisivos ${artigoAtual} ${rotuloAtual} em andamento.</span>
                <span style="display: block; font-size: 12.5px; color: #7e22ce; line-height: 1.4;">${bulletInstrucao}</span>
            `;
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
                const torneioConcluido = (modelo !== "grupos" && faseAtual >= 4) || (modelo === "grupos" && faseAtual >= 5);
                btnEditarResumo.style.setProperty('display', torneioConcluido ? 'none' : 'inline-flex', 'important');
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
    if (btnInscritos) btnInscritos.disabled = (qtdInscritos === 0);
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
        const torneioConcluido = (modelo !== "grupos" && faseAtual >= 4) || (modelo === "grupos" && faseAtual >= 5);
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
    const gruposConfig = confGlobalCheck.grupos || {}; // 👈 LINHA ADICIONADA

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

    const payloadCalendario = {
        nomeTorneio: nome,
        formatoTorneio: formatoTorneioEscolhido,
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

    // 🛡️ LIMPEZA FÍSICA APENAS DA ÁREA DE TRABALHO INTERNA DO RANKING
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
        // 🚀 Sincroniza a memória RAM imediatamente para aplicar as travas "online" sem precisar de F5
        if (typeof configRegrasGlobal !== 'undefined' && configRegrasGlobal && configRegrasGlobal.ranking) {
            configRegrasGlobal.ranking.faseAtual = 2;
            configRegrasGlobal.ranking.calendario = payloadCalendario;
            configRegrasGlobal.ranking.inscritosConfirmados = null;
        }

        showToast("Contrato da edição gravado com sucesso! Inscrições abertas.", "success");

        if (typeof renderizarGestaoTemporadaSaaS === 'function') {
            renderizarGestaoTemporadaSaaS();
        }

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


function editarCalendarioAtivoSaaS() {
	// 🧹 Limpa todos os campos e pílulas antes de abrir, garantindo formulário virgem
    if (typeof limparFormularioFase1SaaS === 'function') {
        limparFormularioFase1SaaS();
    }
    const conf = (configRegrasGlobal && configRegrasGlobal.ranking) ? configRegrasGlobal.ranking : {};
    const cal = conf.calendario || {};

    if (cal.nomeTorneio) document.getElementById('inp-torneio-nome').value = cal.nomeTorneio;
    if (cal.formatoTorneio) document.getElementById('inp-torneio-modelo').value = cal.formatoTorneio;
    if (cal.limiteVagas) document.getElementById('inp-torneio-vagas').value = cal.limiteVagas;

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
    const selectClasse = document.getElementById('select-filtro-inscritos-classe');
    const selectGenero = document.getElementById('select-filtro-inscritos-genero');

    const conf = (configRegrasGlobal && configRegrasGlobal.ranking) ? configRegrasGlobal.ranking : {};
    const cal = conf.calendario || {};
    const catsHabilitadas = cal.categoriasHabilitadas || ['CLASSE_A', 'CLASSE_B', 'CLASSE_C'];
    const inscritos = conf.inscritosConfirmados || {};
    const ids = Object.keys(inscritos);

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

    // ORDENAÇÃO CRONOLÓGICA (Garante a ordem exata de aceite do convite)
    ids.sort((a, b) => (inscritos[a]?.dataAceite || 0) - (inscritos[b]?.dataAceite || 0));

    if (lblBadge) lblBadge.textContent = ids.length;
    if (btnInscritos) btnInscritos.disabled = (ids.length === 0);
    if (btnEncerrar) btnEncerrar.disabled = (ids.length === 0);

    if (ids.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #94a3b8; margin: 20px 0; font-size: 13px;">Nenhum inscrito confirmado até o momento.</p>';
        return;
    }

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
    const modelo = conf.calendario?.formatoTorneio || "grupos";
    
    const inscritos = conf.inscritosConfirmados || {};
    const qtdInscritos = Object.keys(inscritos).length;

    // 🛡️ TRAVA MÍNIMA DE SEGURANÇA: Exige no mínimo 2 atletas confirmados
    if (qtdInscritos < 2) {
        showToast("É necessário ter no mínimo 2 atletas confirmados para iniciar a competição.", "warning");
        return;
    }

    const hojeStr = new Date().toISOString().split('T')[0];
    const fimInscricoesStr = cal.fimInscricoes || "";
    const dataFimFormatada = fimInscricoesStr ? fimInscricoesStr.split('-').reverse().join('/') : '--/--';

    const processarMontagemEGerarFase3 = async () => {
        if (navigator.vibrate) navigator.vibrate(40);

        // Lê a regra de ordenação definida no disparo de convites
        const snapConvites = await database.ref(`${raizBanco}/convites_ranking`).once('value');
        const dadosConvites = snapConvites.exists() ? snapConvites.val() : {};
        const tipoOrdenacao = conf.tipoOrdenacao || dadosConvites.tipoOrdenacao || 'livre';

        const nomeTorneio = cal.nomeTorneio || "Torneio";
        const modoGenero = conf.divisaoGenero || 'separado';
        const inscritosPorCategoria = {};

        // Agrupa inscritos por Categoria/Gênero
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

        // 🎯 ORDENAÇÃO OFICIAL DA LISTA DE SEMENTES (#1 a #N) CONFORME A REGRA DO DISPARO
        const snapRankingGeral = await database.ref(`${raizBanco}/ranking/ranking_geral`).once('value');
        const rankingGeralMap = snapRankingGeral.exists() ? snapRankingGeral.val() : {};

        Object.keys(inscritosPorCategoria).forEach(chaveTab => {
            const idsList = inscritosPorCategoria[chaveTab];
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
                // Inscrição Livre: Ordena por data/hora de aceite no app
                idsList.sort((a, b) => (inscritos[a]?.dataAceite || 0) - (inscritos[b]?.dataAceite || 0));
            }
        });

        // CENÁRIO A: Torneio de GRUPOS ou Pirâmide/Barragem com SORTEIO -> Abre o Globo
        const faseInicialGrupos = conf.grupos?.faseInicial || "grupos";
        const emMataMataDireto = (modelo === 'grupos' && faseInicialGrupos === 'matamata');

        // CENÁRIO A: Torneio de GRUPOS (tradicional), Pirâmide/Barragem com SORTEIO, ou Mata-Mata Direto -> Abre o Globo de Potes
        if ((modelo === 'grupos' && !emMataMataDireto) || tipoOrdenacao === 'sorteio' || emMataMataDireto) {
            // No Mata-Mata Direto, o tamanho passa a ser a quantidade total de inscritos (sem fatiar em grupos de 3 ou 4)
            const tamanhoGrupoConfig = emMataMataDireto
                ? qtdInscritos
                : ((modelo === 'grupos') ? (parseInt(conf.grupos?.tamanhoGrupo, 10) || 4) : qtdInscritos);

            // Achata os IDs ordenados/sorteados de todas as categorias e monta o mapa de inscritos
            const listaInscritosParaPotes = {};
            Object.values(inscritosPorCategoria).flat().forEach(idAtleta => {
                if (inscritos[idAtleta]) {
                    listaInscritosParaPotes[idAtleta] = inscritos[idAtleta];
                }
            });

            SorteioPotes.abrirModalSorteioSaaS(nomeTorneio, listaInscritosParaPotes, tamanhoGrupoConfig, async (gruposResultado) => {
                try {
                    showToast("Gravando chaveamento no banco...", "info"); 
                    const updates = {};
                    updates[`${raizBanco}/config/ranking/faseAtual`] = 3;

                    // 🚀 Sincroniza a memória RAM local para evitar atraso de renderização
                    if (typeof configRegrasGlobal !== 'undefined' && configRegrasGlobal && configRegrasGlobal.ranking) {
                        configRegrasGlobal.ranking.faseAtual = 3;
                    }

                    Object.keys(inscritosPorCategoria).forEach(chaveTab => {
                        const idsInscritosCat = inscritosPorCategoria[chaveTab];

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
                            updates[`${raizBanco}/ranking/tabelas/${chaveTab}`] = listaFinal;
                            
                            // 🌱 Cofre da Semeadura: Preserva a hierarquia oficial de Sementes (#1, #2, #3...)
                            updates[`${raizBanco}/ranking/semeadura/${chaveTab}`] = idsInscritosCat.filter(Boolean);

                            // 🎯 Mata-Mata Direto: Garante a ordem oficial de sementes (1 no topo, 2 na base)
                            if (emMataMataDireto) {
                                const resultadoMM = gerarCruzamentosMataMataDiretoSaaS(idsInscritosCat, chaveTab);
                                updates[`${raizBanco}/ranking/chaves/${chaveTab}`] = {
                                    totalClassificados: resultadoMM.totalClassificados,
                                    faseAtual: resultadoMM.faseAtual,
                                    rodada1: resultadoMM.rodada1
                                };
                            }
                        } else {
                            // Fallback direto caso a modal não devolva mapa
                            updates[`${raizBanco}/ranking/tabelas/${chaveTab}`] = idsInscritosCat;
                            updates[`${raizBanco}/ranking/semeadura/${chaveTab}`] = idsInscritosCat.filter(Boolean);

                            if (emMataMataDireto) {
                                const resultadoMM = gerarCruzamentosMataMataDiretoSaaS(idsInscritosCat, chaveTab);
                                updates[`${raizBanco}/ranking/chaves/${chaveTab}`] = {
                                    totalClassificados: resultadoMM.totalClassificados,
                                    faseAtual: resultadoMM.faseAtual,
                                    rodada1: resultadoMM.rodada1
                                };
                            }
                        }
                    });

                    // Notificações aos inscritos
                    const payloadNotificacao = {
                        categoria: "inicio_temporada",
                        titulo: "A temporada começou!",
                        detalhe: `Tabela do ${nomeTorneio} liberada.\nAgende sua partida no app.`,
                        timestamp: Date.now()
                    };

                    Object.keys(inscritos).forEach(idAtleta => {
                        const keyNotif = database.ref().push().key;
                        updates[`${raizBanco}/jogadores/${idAtleta}/notificacoes/${keyNotif}`] = payloadNotificacao;
                    });

                    await database.ref().update(updates);
                    showToast("Sorteio concluído! Temporada iniciada.", "success");

                    if (typeof renderizarGestaoTemporadaSaaS === "function") {
                        renderizarGestaoTemporadaSaaS();
                    }

                } catch (err) {
                    console.error("❌ Erro ao persistir tabela sorteada:", err);
                    showToast("Erro ao gravar tabela no Firebase.", "error");
                }
            });
			
            return;
        }

        // CENÁRIO B: Pirâmide / Barragem SEM sorteio (Inscrição Livre ou Herança) -> Monta silenciosamente
        try {
            showToast("Montando tabela da temporada...", "info");
            const updates = {};
            updates[`${raizBanco}/config/ranking/faseAtual`] = 3;

            // Lê o Ranking Geral para os casos de herança de classificação
            const snapRankingGeral = await database.ref(`${raizBanco}/ranking/ranking_geral`).once('value');
            const rankingGeralMap = snapRankingGeral.exists() ? snapRankingGeral.val() : {};

            Object.keys(inscritosPorCategoria).forEach(chaveTab => {
                const idsInscritosCat = inscritosPorCategoria[chaveTab];

                if (tipoOrdenacao === 'herdada') {
                    // Ordena pela posição acumulada no Ranking Geral
                    const listaGeral = rankingGeralMap[chaveTab] || [];
                    idsInscritosCat.sort((a, b) => {
                        const posA = listaGeral.indexOf(a);
                        const posB = listaGeral.indexOf(b);
                        if (posA !== -1 && posB !== -1) return posA - posB;
                        if (posA !== -1) return -1;
                        if (posB !== -1) return 1;
                        return (inscritos[a]?.dataAceite || 0) - (inscritos[b]?.dataAceite || 0);
                    });
                } else {
                    // Inscrição Livre: Ordena por data/hora de aceite no app
                    idsInscritosCat.sort((a, b) => (inscritos[a]?.dataAceite || 0) - (inscritos[b]?.dataAceite || 0));
                }

                updates[`${raizBanco}/ranking/tabelas/${chaveTab}`] = idsInscritosCat;
            });

            // Notificações aos inscritos
            const payloadNotificacao = {
                categoria: "inicio_temporada",
                titulo: "A temporada começou!",
                detalhe: `Tabela do ${nomeTorneio} liberada.\nAgende sua partida no app.`,
                timestamp: Date.now()
            };

            Object.keys(inscritos).forEach(idAtleta => {
                const keyNotif = database.ref().push().key;
                updates[`${raizBanco}/jogadores/${idAtleta}/notificacoes/${keyNotif}`] = payloadNotificacao;
            });

            await database.ref().update(updates);
            showToast("Tabela congelada e temporada iniciada com sucesso!", "success");

            if (typeof renderizarGestaoTemporadaSaaS === "function") {
                renderizarGestaoTemporadaSaaS();
            }

        } catch (err) {
            console.error("❌ Erro ao congelar tabela:", err);
            showToast("Erro ao gravar tabela no Firebase.", "error");
        }
    };

    // TEXTOS DINÂMICOS CONFORME O MODELO DO TORNEIO (AJUSTADOS NO PLURAL)
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

    if (fimInscricoesStr && hojeStr < fimInscricoesStr) {
        const htmlPrompt = `
            <div style="text-align: left; font-size: 14px; color: #334155; line-height: 1.5;">
                <p style="margin: 0 0 10px 0;">
                    ⚠️ <b>Atenção:</b> O prazo oficial de inscrições vai até <b>${dataFimFormatada}</b>.
                </p>
                <p style="margin: 0; font-size: 13px; color: #64748b;">
                    Tem certeza que deseja encerrar antecipadamente com <b>${qtdInscritos} inscritos</b> e ${acaoPrompt} agora?
                </p>
            </div>
        `;
        showPrompt(tituloPrompt, htmlPrompt, () => {
            processarMontagemEGerarFase3();
        });
    } else {
        const htmlPrompt = `
            <div style="text-align: left; font-size: 14px; color: #334155; line-height: 1.5;">
                <p style="margin: 0;">
                    Deseja encerrar as inscrições com <b>${qtdInscritos} atletas confirmados</b> e ${acaoPrompt}?
                </p>
            </div>
        `;
        showPrompt(tituloPrompt, htmlPrompt, () => {
            processarMontagemEGerarFase3();
        });
    }
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

    // 🛡️ 1. PRÉ-VALIDAÇÃO INTELIGENTE DO MATA-MATA (BLOQUEIA O MODAL SE HOUVER PENDÊNCIAS)
    if (emFaseMataMata) {
        const chavesMap = (typeof rankingChavesGlobal !== 'undefined' && rankingChavesGlobal) ? rankingChavesGlobal : {};
        const partidasMap = (typeof rankingPartidasGlobal !== 'undefined' && rankingPartidasGlobal) ? rankingPartidasGlobal : {};

        for (const chaveCat of Object.keys(chavesMap)) {
            const chaveInfo = chavesMap[chaveCat] || {};
            const rodadaAtual = chaveInfo.rodada1 || [];
            const tamChave = parseInt(chaveInfo.faseAtual, 10) || (rodadaAtual.length * 2) || 2;
            const nomeFaseAtual = (typeof obterRotuloFaseMataMataSaaS === 'function') 
                ? obterRotuloFaseMataMataSaaS(tamChave) 
                : "fase atual";

            let totalPendentes = 0;
            rodadaAtual.forEach(conf => {
                if (conf.isBye || !conf.jogador2Id) return;

                const partidaSalva = Object.values(partidasMap || {}).find(p => {
                    if (p.categoria !== chaveCat || p.status !== 'finalizada') return false;

                    const dp = p.dadosPlacar || {};
                    if (p.tagGrupoRanking || dp.tagGrupoRanking) return false;

                    return (p.jogador1Id === conf.jogador1Id && p.jogador2Id === conf.jogador2Id) ||
                           (p.jogador1Id === conf.jogador2Id && p.jogador2Id === conf.jogador1Id);
                });

                if (!partidaSalva || !partidaSalva.vencedorId) {
                    totalPendentes++;
                }
            });

            if (totalPendentes > 0) {
                const artigoFase = (tamChave === 2) ? "na" : "nas";
                const verbo = (totalPendentes === 1) ? "Existe" : "Existem";
                const substantivo = (totalPendentes === 1) ? "partida pendente" : "partidas pendentes";

                showToast(`${verbo} ${totalPendentes} ${substantivo} ${artigoFase} ${nomeFaseAtual}.`, "warning");
                return; // ⛔ INTERROMPE A EXECUÇÃO: NÃO ABRE O MODAL
            }
        }
    }

    // 🛡️ 2. PRÉ-VALIDAÇÃO DE SÚMULAS E RESERVAS EM ABERTO NO QUADRO DE QUADRAS
    try {
        const snapReservas = await database.ref(`${raizBanco}/reservas`).once('value');
        const todasReservas = snapReservas.exists() ? snapReservas.val() : {};
        
        const pendentes = [];
        const contestadas = [];

        Object.keys(todasReservas).forEach(quadraKey => {
            const slots = todasReservas[quadraKey] || {};
            Object.keys(slots).forEach(slotKey => {
                const r = slots[slotKey];
                if (!r) return;
                
                const ehRanking = (r.isRanking === true || r.isRanking === 'true' || r.tipo === 'ranking');
                if (!ehRanking) return;

                if (r.borda === undefined && parseInt(r.duracao) === 2) return;

                const stPlacar = r.statusPlacar || (r.dadosPlacar ? r.dadosPlacar.statusPlacar : 'sem_placar');

                if (stPlacar === 'pendente_validacao' || stPlacar === 'contestado' || stPlacar === 'sem_placar') {
                    if (stPlacar === 'pendente_validacao' || stPlacar === 'sem_placar') {
                        pendentes.push(r);
                    } else {
                        contestadas.push(r);
                    }
                }
            });
        });

        const totalPendencias = pendentes.length + contestadas.length;

        if (totalPendencias > 0) {
            const verbo = (totalPendencias === 1) ? "Existe" : "Existem";
            const substantivo = (totalPendencias === 1) ? "partida pendente" : "partidas pendentes";
            const complementoFase = (modelo === 'grupos' && !emMataMataDireto && faseAtual === 3) 
                ? " na Fase de Grupos." 
                : " no Mata-Mata.";

            showToast(`${verbo} ${totalPendencias} ${substantivo}${complementoFase}`, "warning");
            return; // ⛔ INTERROMPE A EXECUÇÃO: NÃO ABRE O MODAL
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

                const chavesMap = snapChaves.exists() ? snapChaves.val() : {};
                const partidasMap = snapPartidas.exists() ? snapPartidas.val() : {};

                let temProximaRodada = false;

                for (const chaveCat of Object.keys(chavesMap)) {
                    const chaveInfo = chavesMap[chaveCat] || {};
                    const rodadaAtual = chaveInfo.rodada1 || [];

                    const res = gerarProximaRodadaMataMataSaaS(rodadaAtual, partidasMap, chaveCat);

                    if (!res.concluida) {
                        showToast(res.motivo || "Existem partidas pendentes no Mata-Mata.", "warning");
                        return;
                    }

                    if (rodadaAtual.length > 1) {
                        temProximaRodada = true;
                        
                        const historico = chaveInfo.historicoRodadas || {};
                        const faseAnteriorNum = parseInt(chaveInfo.faseAtual, 10) || (rodadaAtual.length * 2);
                        historico[faseAnteriorNum] = rodadaAtual;
                        
                        updates[`${raizBanco}/ranking/chaves/${chaveCat}`] = {
                            totalClassificados: chaveInfo.totalClassificados || 0,
                            faseAtual: res.faseAtual,
                            rodada1: res.rodada1,
                            historicoRodadas: historico
                        };
                    }
                }

                if (temProximaRodada) {
                    novaFase = faseAtual;
                    eHomologacaoFinal = false;
                    updates[`${raizBanco}/config/ranking/faseAtual`] = novaFase;
                } else {
                    novaFase = emMataMataDireto ? 4 : 5;
                    eHomologacaoFinal = true;
                    updates[`${raizBanco}/config/ranking/faseAtual`] = novaFase;
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
            }

            await database.ref().update(updates);

            if (typeof configRegrasGlobal !== 'undefined' && configRegrasGlobal && configRegrasGlobal.ranking) {
                configRegrasGlobal.ranking.faseAtual = novaFase;
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

    // 🚀 4. SÓ CHEGA AQUI SE ZERADAS TODAS AS PENDÊNCIAS: MONTA E EXIBE O MODAL
    let tituloPrompt = "Avançar Fase";
    let msgPrompt = "Deseja avançar para a próxima fase?";

    if (emFaseMataMata) {
        const chavesMap = (typeof rankingChavesGlobal !== 'undefined' && rankingChavesGlobal) ? rankingChavesGlobal : {};
        let maiorTamanhoChave = 2;
        const chavesList = Object.values(chavesMap);
        if (chavesList.length > 0) {
            const tamanhos = chavesList.map(c => parseInt(c.faseAtual || (c.rodada1 ? c.rodada1.length * 2 : 2), 10));
            maiorTamanhoChave = Math.max(...tamanhos);
        }

        if (maiorTamanhoChave > 2) {
            const proximaTamanho = maiorTamanhoChave / 2;
            const rotuloProxima = (typeof obterRotuloFaseMataMataSaaS === 'function')
                ? obterRotuloFaseMataMataSaaS(proximaTamanho)
                : "Próxima Fase";
            const artigo = (proximaTamanho === 2) ? "para a" : "para as";
            
            tituloPrompt = `Avançar ${artigo} ${rotuloProxima}`;
            msgPrompt = `Todas as partidas da rodada atual foram concluídas. Deseja consolidar os vencedores e avançar ${artigo} <b>${rotuloProxima}</b>?`;
        } else {
            tituloPrompt = "Concluir e Homologar Torneio";
            msgPrompt = "Deseja encerrar o torneio, creditar os pontos e arquivar a edição no Histórico?"; 
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

            await database.ref().update(updates);

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