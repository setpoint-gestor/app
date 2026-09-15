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
        const tabelas = snapTabelas.val() || {};
        const convites = snapConvites.val() || {};
        const reservas = snapReservas.val() || {};
        const jogadores = snapJogadores.val() || {};
        const configRanking = snapConfig.val() || {};

        const faseAtual = parseInt(configRanking.faseAtual, 10) || 1;
        const cal = configRanking.calendario || {};
        const temCalendario = !!configRanking.calendario;

        // Datas de início e término do torneio ativo para proteção de saldo
        const dtInicioTorneio = cal.inicioInscricoes || cal.inicioJogos || "";
        const dtFimTorneio = cal.fimTorneio || "";

        const totalPartidas = Object.keys(partidas).length;

        let totalInscritos = 0;
        Object.values(tabelas).forEach(arr => {
            if (Array.isArray(arr)) totalInscritos += arr.length;
        });

        const temporadaIdAtiva = convites.temporadaId || null;
        let totalReservasRanking = 0;
        const caminhosReservasExcluir = [];

        Object.keys(reservas).forEach(quadraKey => {
            const slots = reservas[quadraKey] || {};
            Object.keys(slots).forEach(slotKey => {
                const r = slots[slotKey];
                if (!r) return;

                // 🛡️ TRAVA 1: Ignora 100% agendamentos comuns de sócios (1h/2h)
                const ehRanking = (r.isRanking === true || r.isRanking === 'true' || r.tipo === 'ranking');
                if (!ehRanking) return;

                // 🛡️ TRAVA 2: Filtro Estrito por ID Único de Temporada
                if (r.temporadaId) {
                    if (temporadaIdAtiva && r.temporadaId !== temporadaIdAtiva) return;
                } else {
                    if (dtInicioTorneio && r.dataCompleta && r.dataCompleta < dtInicioTorneio) return;
                    if (dtFimTorneio && r.dataCompleta && r.dataCompleta > dtFimTorneio) return;
                }

                caminhosReservasExcluir.push(`reservas/${quadraKey}/${slotKey}`);
                if (r.borda === undefined && parseInt(r.duracao) === 2) return;
                totalReservasRanking++;
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
                        <li><b>${totalPartidas}</b> partida(s) finalizada(s) no histórico;</li>
                        <li><b>${totalInscritos}</b> inscrição(ões) nas tabelas de categorias;</li>
                        <li><b>${totalReservasRanking}</b> agendamento(s) do torneio atual nas quadras;</li>
                        <li><b>${totalNotificacoes}</b> notificação(ões) nas caixas dos atletas;</li>
                        <li>Contrato de calendário e inscrições ativas.</li>
                    </ul>
                </div>

                <p style="margin: 0; font-size: 12.5px; color: #64748b; font-weight: 500;">
                    <b>Nota de Segurança:</b> Deseja prosseguir?
                </p>
            </div>
        `;

        showPrompt("Balanço do Zeramento do Ranking", promptHTML, async () => {
            try {
                if (navigator.vibrate) navigator.vibrate(50);

                const updates = {};
                updates['config/ranking/faseAtual'] = 1;
                updates['config/ranking/calendario'] = null;
                updates['config/ranking/inscritosConfirmados'] = null;

                updates['ranking/partidas'] = null;
                updates['ranking/tabelas'] = null;
                updates['ranking/chaves'] = null;
                updates['convites_ranking'] = null;

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
    const modelo = conf.modeloAtivo || "grupos";
    const faseAtual = parseInt(conf.faseAtual, 10) || 1;
    const cal = conf.calendario || {};

    const rotulosPorModelo = {
        grupos: ["1. Calendário", "2. Inscrições", "3. Chaves", "4. Mata-Mata", "5. Concluído"],
        barragem: ["1. Calendário", "2. Inscrições", "3. Pontos Corridos", "4. Concluído"],
        piramide: ["1. Calendário", "2. Inscrições", "3. Escada", "4. Concluído"]
    };

    const listaRotulos = rotulosPorModelo[modelo] || rotulosPorModelo.grupos;

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
    const painelAlvo = (faseAtual === 1 || (modelo !== "grupos" && faseAtual === 4)) ? 5 : faseAtual;
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
    if (panelFase4 && modelo === 'grupos' && faseAtual === 4) {
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
                <p style="margin: 0 0 4px 0; font-weight: 700; color: #6b21a8;">📍 Fase 4: Quadro Eliminatório (Mata-Mata)</p>
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
        if (qtdInscritos > 0) {
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
}

function atualizarBotaoRodapeRankingSaaS() {
    const modalConfig = document.getElementById('modal-config-ranking');
    if (!modalConfig) return;

    const btnFooter = modalConfig.querySelector('.regras-footer button');
    if (!btnFooter) return;

    const items = modalConfig.querySelectorAll('.sanfona-container .accordion-item');
    let idxAbaAtiva = 0;
    items.forEach((item, idx) => {
        if (item.classList.contains('active')) {
            idxAbaAtiva = idx;
        }
    });

    const conf = (configRegrasGlobal && configRegrasGlobal.ranking) ? configRegrasGlobal.ranking : {};
    const modelo = conf.modeloAtivo || "grupos";
    const faseAtual = parseInt(conf.faseAtual, 10) || 1;

    if (idxAbaAtiva === 4) {
        let textoBotao = '';
        let corBotao = '#8b5cf6';
        let acaoOnClick = 'encerrarFase3EAvancarSaaS()';

        if (faseAtual === 1) {
            const painel1Ativo = document.querySelectorAll('#container-fases-gestor .fase-panel')[0]?.classList.contains('ativa');
            if (painel1Ativo) {
                textoBotao = '<i class="material-icons">event_available</i> Salvar Calendário e Abrir Inscrições';
                corBotao = '#16a34a';
                acaoOnClick = 'salvarCalendarioEAbrirInscricoesSaaS()';
            } else {
                textoBotao = '<i class="material-icons">add_circle</i> Criar Novo Torneio';
                corBotao = '#2563eb';
                acaoOnClick = 'editarCalendarioAtivoSaaS()';
            }
        } else if (faseAtual === 2) {
            textoBotao = '<i class="material-icons">lock</i> Encerrar Inscrições e Congelar Chaves';
            corBotao = '#f59e0b';
            acaoOnClick = 'encerrarInscricoesECriarChavesSaaS()';
        } else if (faseAtual === 3) {
            textoBotao = '<i class="material-icons">alt_route</i> Encerrar Chaves e Gerar Mata-Mata';
            corBotao = '#f59e0b';
            acaoOnClick = 'encerrarFase3EAvancarSaaS()';
        } else if (modelo === 'grupos' && faseAtual === 4) {
            const chavesMap = (typeof rankingChavesGlobal !== 'undefined' && rankingChavesGlobal) ? rankingChavesGlobal : {};
            const chavesList = Object.values(chavesMap);
            
            let maiorTamanhoChave = 2; 
            if (chavesList.length > 0) {
                const tamanhos = chavesList.map(c => parseInt(c.faseAtual || (c.rodada1 ? c.rodada1.length * 2 : 2), 10));
                maiorTamanhoChave = Math.max(...tamanhos);
            }

            if (maiorTamanhoChave > 2) {
                const proximaFaseTamanho = maiorTamanhoChave / 2;
                const rotuloProxima = (typeof obterRotuloFaseMataMataSaaS === 'function')
                    ? obterRotuloFaseMataMataSaaS(proximaFaseTamanho)
                    : "Próxima Fase";

                const artigo = (proximaFaseTamanho === 2) ? "para a" : "para as";
                textoBotao = `<i class="material-icons">east</i> Avançar ${artigo} ${rotuloProxima}`;
                corBotao = '#8b5cf6';
            } else {
                textoBotao = '<i class="material-icons">workspace_premium</i> Concluir Torneio e Somar Pontos no Ranking';
                corBotao = '#16a34a';
            }
        } else if (faseAtual >= 5) {
            textoBotao = '<i class="material-icons">add_circle</i> Criar Novo Torneio';
            corBotao = '#2563eb';
            acaoOnClick = 'reiniciarEsteiraNovoTorneioSaaS()';
        } else {
            textoBotao = 'Salvar Parâmetros do Ranking';
            corBotao = '#28a745';
            acaoOnClick = 'salvarConfigRankingSaas()';
        }

        btnFooter.innerHTML = textoBotao;
        btnFooter.setAttribute('onclick', acaoOnClick);
        btnFooter.style.cssText = `background-color: ${corBotao} !important; display: inline-flex !important; align-items: center; justify-content: center; gap: 8px;`;

    } else if (idxAbaAtiva === 5) {
        btnFooter.innerHTML = '<i class="material-icons">picture_as_pdf</i> Exportar Relatório Geral do Acervo (PDF)';
        btnFooter.setAttribute('onclick', 'exportarRelatorioHistoricoSaaS()');
        btnFooter.style.cssText = 'background-color: #8b5cf6 !important; display: inline-flex !important; align-items: center; justify-content: center; gap: 8px;';

    } else if (idxAbaAtiva === 6) { // 7ª ABA: RANKING GERAL
        const vConfig = document.getElementById('visao-config-ranking-geral');
        const estaEmConfig = vConfig && vConfig.style.display !== 'none';

        if (estaEmConfig) {
            btnFooter.innerHTML = '<i class="material-icons" style="font-size: 18px;">save</i> Salvar Parâmetros do Ranking Geral';
            btnFooter.setAttribute('onclick', 'salvarParametrosRankingGeralSaaS()');
            btnFooter.style.cssText = 'background-color: #f97316 !important; display: inline-flex !important; align-items: center; justify-content: center; gap: 8px;';
        } else {
            btnFooter.innerHTML = '<i class="material-icons" style="font-size: 18px;">picture_as_pdf</i> Exportar Ranking Geral (PDF)';
            btnFooter.setAttribute('onclick', 'exportarRankingGeralPDFSaaS()');
            btnFooter.style.cssText = 'background-color: #f97316 !important; display: inline-flex !important; align-items: center; justify-content: center; gap: 8px;';
        }

    } else {
        btnFooter.innerHTML = 'Salvar Parâmetros do Ranking';
        btnFooter.setAttribute('onclick', 'salvarConfigRankingSaas()');
        btnFooter.style.cssText = 'background-color: #28a745 !important; display: inline-flex !important; align-items: center; justify-content: center; gap: 8px;';
    }
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

/* ABERTURA DO MODAL DE ZERAMENTO COM DADOS EM MEMÓRIA RAM (core.js) */
function zerarPontuacaoRankingGeralSaaS() {
    if (!isGestorLogado || !raizBanco) {
        showToast("Apenas o gestor pode zerar a pontuação do Ranking Geral.", "warning");
        return;
    }

    // Leitura síncrona diretamente da memória RAM mantida pelo core.js
    const dadosPontosGeral = (typeof rankingPontosGeralGlobal !== 'undefined' && rankingPontosGeralGlobal)
        ? rankingPontosGeralGlobal
        : {};

    const atletasUnicos = new Set();
    let totalPontos = 0;

    Object.keys(dadosPontosGeral).forEach(catKey => {
        const catObj = dadosPontosGeral[catKey] || {};
        if (typeof catObj === 'object') {
            Object.keys(catObj).forEach(idAtleta => {
                atletasUnicos.add(idAtleta);
                const pts = Number(catObj[idAtleta] || 0);
                totalPontos += pts;
            });
        }
    });

    const qtdAtletas = atletasUnicos.size;

    // Trava de segurança: Se não houver dados acumulados, apenas avisa via Toast
    if (qtdAtletas === 0 || totalPontos === 0) {
        showToast("O Ranking Geral já se encontra completamente zerado.", "info");
        return;
    }

    const modal = document.getElementById('modal-zerar-ranking-geral');
    const ulBalanco = modal ? modal.querySelector('ul') : null;

    if (!modal) {
        console.error("❌ Modal #modal-zerar-ranking-geral não foi encontrado no HTML.");
        showToast("Erro: Estrutura do modal não localizada na tela.", "error");
        return;
    }

    if (ulBalanco) {
        ulBalanco.innerHTML = `
            <li><b>${qtdAtletas} atleta(s)</b> com pontuação ativa na Fila Mestre;</li>
            <li><b>${totalPontos.toLocaleString('pt-BR')} ponto(s)</b> acumulados que serão zerados;</li>
            <li>Histórico de edições e súmulas homologadas <b>NÃO</b> serão afetados.</li>
        `;
    }

    modal.style.display = 'flex';
}

/* FECHAR MODAL DE ZERAMENTO */
function fecharModalZerarRankingGeralSaaS() {
    const modal = document.getElementById('modal-zerar-ranking-geral');
    if (modal) modal.style.display = 'none';
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
    const modeloDisputa = document.getElementById('inp-torneio-modelo').value;
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

    const confGlobalCheck = (configRegrasGlobal && configRegrasGlobal.ranking) ? configRegrasGlobal.ranking : {};
    const divGenero = confGlobalCheck.divisaoGenero || 'separado';

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
        modeloDisputa: modeloDisputa,
        limiteVagas: limiteVagas,
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

    const faseAtualBanco = parseInt(confGlobalCheck.faseAtual, 10) || 1;
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
    const conf = (configRegrasGlobal && configRegrasGlobal.ranking) ? configRegrasGlobal.ranking : {};
    const cal = conf.calendario || {};

    if (cal.nomeTorneio) document.getElementById('inp-torneio-nome').value = cal.nomeTorneio;
    if (cal.modeloDisputa) document.getElementById('inp-torneio-modelo').value = cal.modeloDisputa;
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
    const inscritos = conf.inscritosConfirmados || {};
    const qtdInscritos = Object.keys(inscritos).length;

    if (qtdInscritos === 0) {
        showToast("Não há inscritos confirmados para encerrar a fase.", "warning");
        return;
    }

    const hojeStr = new Date().toISOString().split('T')[0];
    const fimInscricoesStr = cal.fimInscricoes || "";

    const fmtData = (str) => str ? str.split('-').reverse().join('/') : '--/--';
    const dataFimFormatada = fmtData(fimInscricoesStr);

    const executarEncerramento = async () => {
        if (navigator.vibrate) navigator.vibrate(40);

        const updates = {};
        updates[`${raizBanco}/config/ranking/faseAtual`] = 3;

        const modoGenero = conf.divisaoGenero || 'separado';
        const inscritosPorCategoria = {};

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

        const snapConvitesInfo = await database.ref(`${raizBanco}/convites_ranking`).once('value');
        const tipoOrdenacao = snapConvitesInfo.exists() ? (snapConvitesInfo.val().tipoOrdenacao || 'herdada') : 'herdada';

        Object.keys(inscritosPorCategoria).forEach(chaveTab => {
            const idsInscritosCat = inscritosPorCategoria[chaveTab];

            if (tipoOrdenacao === 'livre') {
                idsInscritosCat.sort((a, b) => {
                    const dataA = inscritos[a]?.dataAceite || 0;
                    const dataB = inscritos[b]?.dataAceite || 0;
                    return dataA - dataB;
                });
            } else {
                const ordemMestre = (typeof rankingGeralGlobal !== 'undefined' && rankingGeralGlobal[chaveTab]) 
                    ? rankingGeralGlobal[chaveTab] 
                    : [];

                idsInscritosCat.sort((a, b) => {
                    let idxA = ordemMestre.indexOf(a);
                    let idxB = ordemMestre.indexOf(b);
                    if (idxA === -1) idxA = 9999;
                    if (idxB === -1) idxB = 9999;

                    if (idxA !== idxB) return idxA - idxB;

                    const dataA = inscritos[a]?.dataAceite || 0;
                    const dataB = inscritos[b]?.dataAceite || 0;
                    return dataA - dataB;
                });
            }

            const tamanhoGrupoConfig = parseInt(conf.grupos?.tamanhoGrupo, 10) || 3;
            const totalAtletasCat = idsInscritosCat.length;

            if (totalAtletasCat > 0) {
                const numGrupos = Math.ceil(totalAtletasCat / tamanhoGrupoConfig);
                const matrizGrupos = Array.from({ length: numGrupos }, () => []);

                let direcaoInversa = false;
                let grupoAtual = 0;

                idsInscritosCat.forEach((idAtleta) => {
                    matrizGrupos[grupoAtual].push(idAtleta);

                    if (!direcaoInversa) {
                        if (grupoAtual === numGrupos - 1) {
                            direcaoInversa = true;
                        } else {
                            grupoAtual++;
                        }
                    } else {
                        if (grupoAtual === 0) {
                            direcaoInversa = false;
                        } else {
                            grupoAtual--;
                        }
                    }
                });

                const listaIDsSemeada = [];
                matrizGrupos.forEach(grupo => {
                    while (grupo.length < tamanhoGrupoConfig) {
                        grupo.push(null);
                    }
                    listaIDsSemeada.push(...grupo);
                });

                updates[`${raizBanco}/ranking/tabelas/${chaveTab}`] = listaIDsSemeada;
            } else {
                updates[`${raizBanco}/ranking/tabelas/${chaveTab}`] = idsInscritosCat;
            }
        });

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
/* 3.3 AÇÕES DA FASE DE CHAVES, MATA-MATA E AVANÇO (FASE 3/4) */
/* ======================================================== */

async function encerrarFase3EAvancarSaaS() {
    if (!isGestorLogado || !raizBanco) {
        showToast("Apenas o gestor pode encerrar esta fase.", "error");
        return;
    }

    const conf = (configRegrasGlobal && configRegrasGlobal.ranking) ? configRegrasGlobal.ranking : {};
    const cal = conf.calendario || {};
    const modelo = conf.modeloAtivo || "grupos";
    const faseAtual = parseInt(conf.faseAtual, 10) || 3;

    if (modelo === 'grupos' && faseAtual === 4) {
        const chavesMap = (typeof rankingChavesGlobal !== 'undefined' && rankingChavesGlobal) ? rankingChavesGlobal : {};
        const partidasMap = (typeof rankingPartidasGlobal !== 'undefined' && rankingPartidasGlobal) ? rankingPartidasGlobal : {};

        for (const chaveCat of Object.keys(chavesMap)) {
            const chaveInfo = chavesMap[chaveCat] || {};
            const rodadaAtual = chaveInfo.rodada1 || [];

            if (typeof gerarProximaRodadaMataMataSaaS === 'function') {
                const checagem = gerarProximaRodadaMataMataSaaS(rodadaAtual, partidasMap, chaveCat);
                if (!checagem.concluida) {
                    const tamChave = parseInt(chaveInfo.faseAtual, 10) || 2;
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

                    const artigoFase = (tamChave === 2) ? "na" : "nas";
                    const verbo = (totalPendentes === 1) ? "Existe" : "Existem";
                    const substantivo = (totalPendentes === 1) ? "partida pendente" : "partidas pendentes";

                    showToast(`${verbo} ${totalPendentes} ${substantivo} ${artigoFase} ${nomeFaseAtual}.`, "warning");
                    return;
                }
            }
        }
    }

    try {
        const snapReservas = await database.ref(`${raizBanco}/reservas`).once('value');
        const todasReservas = snapReservas.exists() ? snapReservas.val() : {};
        
        const pendentes = [];
        const contestadas = [];
        const diasSemana = ["", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

        Object.keys(todasReservas).forEach(quadraKey => {
            const slots = todasReservas[quadraKey] || {};
            Object.keys(slots).forEach(slotKey => {
                const r = slots[slotKey];
                if (!r) return;
                
                const ehRanking = (r.isRanking === true || r.isRanking === 'true' || r.tipo === 'ranking');
                if (!ehRanking) return;

                if (r.borda === undefined && parseInt(r.duracao) === 2) return;

                const stPlacar = r.statusPlacar || (r.dadosPlacar ? r.dadosPlacar.statusPlacar : 'sem_placar');

                if (stPlacar === 'pendente_validacao' || stPlacar === 'contestado') {
                    const nomeDia = diasSemana[r.dia] || "Dia";
                    const hInicio = String(r.hora).padStart(2, '0') + ":00";
                    const detalheLimpo = `
                        <div style="display: flex; align-items: baseline;">
                            <span style="white-space: nowrap; margin-right: 6px;">${nomeDia} às ${hInicio}:</span>
                            <span style="font-weight: 700; line-height: 1.4; flex: 1;">${r.jogadores || 'Atletas'}</span>
                        </div>
                    `;

                    if (stPlacar === 'pendente_validacao') {
                        pendentes.push(detalheLimpo);
                    } else {
                        contestadas.push(detalheLimpo);
                    }
                }
            });
        });

        const totalPendencias = pendentes.length + contestadas.length;

        if (totalPendencias > 0) {
            let textoSubtitulo = `Foram localizadas <b>${totalPendencias} partidas</b> com pendências de súmula/arbitragem.`;
            let fieldsetsHtml = "";

            if (pendentes.length > 0) {
                let listHtml = "";
                pendentes.forEach(p => {
                    listHtml += `<li class="prompt-saas-item" style="display: flex; align-items: baseline; margin-bottom: 6px;"><span class="prompt-saas-bullet" style="margin-right: 6px;">•</span> <div style="flex: 1;">${p}</div></li>`;
                });
                fieldsetsHtml += `
                    <fieldset class="prompt-saas-fieldset" style="margin-bottom: 12px;">
                        <legend class="prompt-saas-legend">SÚMULAS PENDENTES</legend>
                        <ul class="prompt-saas-list" style="padding: 0; margin: 0; list-style: none;">${listHtml}</ul>
                    </fieldset>
                `;
            }

            if (contestadas.length > 0) {
                let listHtml = "";
                contestadas.forEach(p => {
                    listHtml += `<li class="prompt-saas-item" style="display: flex; align-items: baseline; margin-bottom: 6px;"><span class="prompt-saas-bullet" style="color: #dc2626; margin-right: 6px;">•</span> <div style="flex: 1;">${p}</div></li>`;
                });
                fieldsetsHtml += `
                    <fieldset class="prompt-saas-fieldset" style="border-color: #fecaca; margin-bottom: 12px;">
                        <legend class="prompt-saas-legend" style="color: #dc2626;">SÚMULAS CONTESTADAS</legend>
                        <ul class="prompt-saas-list" style="padding: 0; margin: 0; list-style: none;">${listHtml}</ul>
                    </fieldset>
                `;
            }

            const htmlBloqueio = `
                <div class="prompt-saas-container">
                    <p style="margin: 0 0 12px 0; font-size: 13.5px; color: #475569; line-height: 1.5;">${textoSubtitulo}</p>
                    ${fieldsetsHtml}
                    <p class="prompt-saas-warning" style="color: #dc2626; font-weight: 700; margin-top: 12px; text-align: center;">
                        Valide ou arbitre estes placares antes de prosseguir.
                    </p>
                </div>
            `;

            showPrompt("Súmulas Pendentes", htmlBloqueio, () => {});
            const btnConfirm = document.getElementById('btnPromptConfirm');
            if (btnConfirm) btnConfirm.style.display = 'none';
            return;
        }

    } catch (err) {
        console.error("❌ Erro ao auditar reservas pendentes antes de encerrar:", err);
    }

    const executarEncerramentoFase3 = async () => {
        if (navigator.vibrate) navigator.vibrate(40);

        let novaFase = (modelo === "grupos" && faseAtual === 3) ? 4 : (modelo === "grupos" ? 5 : 4);
        let eHomologacaoFinal = (novaFase === 5 || (modelo !== "grupos" && novaFase === 4));

        try {
            const updates = {};
            
            if (modelo === 'grupos' && faseAtual === 3) {
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

                    const resultadoMM = gerarCruzamentosMataMataSaaS(classificadosMataMata, classificadosQtd);

                    updates[`${raizBanco}/ranking/chaves/${chaveCat}`] = {
                        totalClassificados: resultadoMM.totalClassificados,
                        faseAtual: resultadoMM.faseAtual,
                        rodada1: resultadoMM.rodada1
                    };
                });
                
                updates[`${raizBanco}/config/ranking/faseAtual`] = 4;
            } 
            else if (modelo === 'grupos' && faseAtual === 4) {
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
                    novaFase = 4;
                    eHomologacaoFinal = false;
                    updates[`${raizBanco}/config/ranking/faseAtual`] = 4;
                } else {
                    novaFase = 5;
                    eHomologacaoFinal = true;
                    updates[`${raizBanco}/config/ranking/faseAtual`] = 5;
                }
            }

            if (eHomologacaoFinal) {
                const edicaoId = `${new Date().getFullYear()}_${(cal.nomeTorneio || 'Torneio').replace(/\s+/g, '_')}`;

                const [snapTabelasTorneio, snapRankingGeral, snapPartidas, snapPontosGeral] = await Promise.all([
                    database.ref(`${raizBanco}/ranking/tabelas`).once('value'),
                    database.ref(`${raizBanco}/ranking/ranking_geral`).once('value'),
                    database.ref(`${raizBanco}/ranking/partidas`).once('value'),
                    database.ref(`${raizBanco}/ranking/pontos_geral`).once('value')
                ]);

                const tabelasTorneio = snapTabelasTorneio.exists() ? snapTabelasTorneio.val() : {};
                const partidasTorneio = snapPartidas.exists() ? snapPartidas.val() : {};
                const pontosGeralAtual = snapPontosGeral.exists() ? snapPontosGeral.val() : {};

                const TABELA_PONTOS_SaaS = { 0: 250, 1: 180, 2: 120, 3: 60 };
                const PONTOS_PARTICIPACAO_DEFAULT = 20;

                const chavesMapGlobal = (typeof rankingChavesGlobal !== 'undefined' && rankingChavesGlobal) ? rankingChavesGlobal : {};

                Object.keys(tabelasTorneio).forEach(chaveCat => {
                    let classificacaoTorneio = tabelasTorneio[chaveCat] || [];
                    if (!Array.isArray(classificacaoTorneio) || classificacaoTorneio.length === 0) return;

                    if (modelo === 'grupos') {
                        classificacaoTorneio = obterClassificacaoFinalGruposMataMataSaaS(chaveCat, classificacaoTorneio, chavesMapGlobal, partidasTorneio);
                        updates[`${raizBanco}/ranking/tabelas/${chaveCat}`] = classificacaoTorneio;
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

                updates[`${raizBanco}/historico_torneios/${edicaoId}`] = {
                    dataHomologacao: Date.now(),
                    modelo: modelo,
                    contrato: cal,
                    classificacaoFinal: tabelasTorneio,
                    partidas: partidasTorneio
                };
            }

            await database.ref().update(updates);

            const msgSucesso = eHomologacaoFinal 
                ? "Torneio homologado e arquivado com sucesso no Histórico!" 
                : "Rodada avançada com sucesso!";
            showToast(msgSucesso, "success");

            if (typeof renderizarGestaoTemporadaSaaS === "function") {
                renderizarGestaoTemporadaSaaS();
            }
        } catch (err) {
            console.error("❌ Erro ao avançar de fase:", err);
            showToast("Erro ao gravar dados no Firebase.", "error");
        }
    };

    const btnConfirm = document.getElementById('btnPromptConfirm');
    if (btnConfirm) btnConfirm.style.display = '';

    let tituloPrompt = "Avançar Fase";
    let msgPrompt = "Deseja avançar para a próxima fase?";

    if (modelo === 'grupos' && faseAtual === 4) {
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
            msgPrompt = "A Grande Final foi concluída! Deseja encerrar o torneio, creditar a pontuação no Ranking Geral e arquivar esta edição no Histórico?";
        }
    } else if (faseAtual === 3) {
        tituloPrompt = "Encerrar Chaves e Gerar Mata-Mata";
        msgPrompt = "Deseja consolidar a classificação da Fase de Grupos e gerar os confrontos do Mata-Mata?";
    }

    showPrompt(tituloPrompt, `<div style="text-align: left; font-size: 14px; color: #334155; line-height: 1.5;"><p style="margin: 0;">${msgPrompt}</p></div>`, () => {
        executarEncerramentoFase3();
    });
}

function abrirHallDeCampeoesSaaS() {
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

    const htmlPrompt = `
        <div style="text-align: left; font-size: 14px; color: #334155; line-height: 1.5;">
            <p style="margin: 0 0 10px 0;">🏆 <b>Criar Novo Torneio</b></p>
            <p style="margin: 0; font-size: 13px; color: #64748b;">
                Deseja iniciar a criação de um novo torneio? Os dados e resultados do torneio concluído já estão salvos em seu <b>Histórico</b> e no <b>Ranking Geral</b>.
            </p>
        </div>
    `;

    showPrompt("Criar Novo Torneio", htmlPrompt, () => {
        if (navigator.vibrate) navigator.vibrate(40);

        const updates = {};
        updates[`${raizBanco}/config/ranking/faseAtual`] = 1;
        updates[`${raizBanco}/config/ranking/calendario`] = null;
        updates[`${raizBanco}/config/ranking/inscritosConfirmados`] = null;
        updates[`${raizBanco}/convites_ranking`] = null;
        updates[`${raizBanco}/ranking/tabelas`] = null;
        updates[`${raizBanco}/ranking/partidas`] = null;

        database.ref().update(updates)
        .then(() => {
            if (typeof limparFormularioFase1SaaS === "function") {
                limparFormularioFase1SaaS();
            }
            showToast("Módulo pronto para o novo torneio!", "success");
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
        default:
            if (numFase > 32) return "Fase Eliminatória"; 
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

function gerarCruzamentosMataMataSaaS(listaClassificados, classificadosPorGrupo = 2) {
    const totalClassific = listaClassificados.filter(id => id !== null).length;
    const tamanhoChave = calcularPotenciaDeDoisSuperiorSaaS(totalClassific);

    const primeiros = [];
    const segundos = [];

    listaClassificados.forEach((idAtleta, idx) => {
        if (!idAtleta) return;
        const posNoGrupo = (idx % classificadosPorGrupo) + 1;
        if (posNoGrupo === 1) primeiros.push(idAtleta);
        else segundos.push(idAtleta);
    });

    const slots = new Array(tamanhoChave).fill(null);

    primeiros.forEach((idAtleta, idx) => {
        const posSlot = idx * 2;
        if (posSlot < tamanhoChave) {
            slots[posSlot] = idAtleta;
        }
    });

    segundos.forEach((idAtleta, idx) => {
        let posSlot = (tamanhoChave - 1) - (idx * 2);
        if (posSlot < 0 || slots[posSlot] !== null) {
            posSlot = slots.findIndex(s => s === null);
        }
        if (posSlot !== -1) {
            slots[posSlot] = idAtleta;
        }
    });

    const rodada1 = [];
    for (let i = 0; i < tamanhoChave; i += 2) {
        const j1 = slots[i];
        const j2 = slots[i + 1];

        rodada1.push({
            fase: tamanhoChave,
            jogador1Id: j1,
            jogador2Id: j2,
            isBye: (j1 && !j2) || (!j1 && j2)
        });
    }

    return {
        totalClassificados: totalClassific,
        faseAtual: tamanhoChave,
        rodada1: rodada1
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