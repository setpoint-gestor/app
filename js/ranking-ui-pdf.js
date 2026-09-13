"use strict";

/**
 * ========================================================
 * 🏆 MÓDULO RANKING SAAS - UI & EXPORTAÇÃO PDF (3/3)
 * Contém: Leaderboard, Central do Ranking, Acervo Histórico,
 * Galeria de Súmulas e Relatórios Vetoriais em PDF (jsPDF).
 * ========================================================
 */

// --------------------------------------------------------
// MEMÓRIA LOCAL E ESTADOS EXCLUSIVOS DE INTERFACE E ACERVO
// --------------------------------------------------------
let abaVisaoLeaderboardSaaS = 'TORNEIO'; // 'TORNEIO', 'SUMULAS' ou 'GERAL'
let abaClasseAtivaSaaS = 'B';
let abaGeneroAtivaSaaS = 'MASCULINO'; 
let abaFaseAtivaSaaS = 'AUTO';

let edicaoHistoricaFocoSaaS = null;
let categoriaHistoricaAtivaSaaS = null;
let listenerGavetaHistoricoAdd = false;
let acervoHistoricoGlobalSaaS = [];

/* ======================================================== */
/* 1. LEADERBOARD / GAVETA DA CLASSIFICAÇÃO                 */
/* ======================================================== */

function abrirLeaderboardSaaS() {
    if (navigator.vibrate) navigator.vibrate(30);

    const sheet = document.getElementById('sheet-leaderboard-ranking');
    if (!sheet) return;

    edicaoHistoricaFocoSaaS = null;

    const containerAbas = document.getElementById('btn-tab-torneio-saas') ? document.getElementById('btn-tab-torneio-saas').parentElement : null;
    const selectClasse = document.getElementById('select-leaderboard-classe');
    const selectGenero = document.getElementById('select-leaderboard-genero');
    const containerDropdowns = document.querySelector('#sheet-leaderboard-ranking .dropdowns-leaderboard-container');

    if (containerAbas) containerAbas.style.display = '';
    if (selectClasse) selectClasse.style.display = '';
    if (selectGenero) selectGenero.style.display = '';
    if (containerDropdowns) containerDropdowns.style.display = '';

    const idLogado = localStorage.getItem('jogadorLogadoId');
    if (idLogado && typeof jogadoresGlobal !== 'undefined' && jogadoresGlobal[idLogado]) {
        const atleta = jogadoresGlobal[idLogado];
        if (atleta.classe) {
            abaClasseAtivaSaaS = atleta.classe.toUpperCase().replace('CLASSE_', '').trim();
        }
        if (atleta.genero) {
            let gen = atleta.genero.toUpperCase().trim();
            if (gen === 'NAO_INFORMAR') gen = 'MASCULINO';
            abaGeneroAtivaSaaS = gen;
        }
    }

    sheet.style.display = 'flex';
    setTimeout(() => sheet.classList.add('ativa'), 10);

    if (typeof renderizarLeaderboardSaaS === 'function') {
        renderizarLeaderboardSaaS();
    }
}

function fecharLeaderboardSaaS(e) {
    const sheet = document.getElementById('sheet-leaderboard-ranking');
    if (!sheet) return;

    if (e && e.target && !e.target.classList.contains('bottom-sheet-overlay')) {
        return;
    }

    sheet.classList.remove('ativa');
    setTimeout(() => {
        sheet.style.display = 'none';

        edicaoHistoricaFocoSaaS = null;

        const containerAbas = document.getElementById('btn-tab-torneio-saas') ? document.getElementById('btn-tab-torneio-saas').parentElement : null;
        const selectClasse = document.getElementById('select-leaderboard-classe');
        const selectGenero = document.getElementById('select-leaderboard-genero');
        const containerDropdowns = document.querySelector('#sheet-leaderboard-ranking .dropdowns-leaderboard-container');

        if (containerAbas) containerAbas.style.display = '';
        if (selectClasse) selectClasse.style.display = '';
        if (selectGenero) selectGenero.style.display = '';
        if (containerDropdowns) containerDropdowns.style.display = '';
    }, 250);
}

function abrirVisualizacaoRankingSaaS() {
    abrirLeaderboardSaaS(); 
}

/* ======================================================== */
/* 2. MOTOR DO LEADERBOARD / RENDERIZAÇÃO DINÂMICA          */
/* ======================================================== */

function trocarVisaoLeaderboardSaaS(modo) {
    abaVisaoLeaderboardSaaS = modo;
    
    const btnTorneio = document.getElementById('btn-tab-torneio-saas');
    const btnSumulas = document.getElementById('btn-tab-sumulas-saas');
    const btnGeral = document.getElementById('btn-tab-geral-saas');
    
    [btnTorneio, btnSumulas, btnGeral].forEach(btn => {
        if (btn) btn.classList.remove('active');
    });

    if (modo === 'TORNEIO' && btnTorneio) {
        btnTorneio.classList.add('active');
    } else if (modo === 'SUMULAS' && btnSumulas) {
        btnSumulas.classList.add('active');
    } else if (modo === 'GERAL' && btnGeral) {
        btnGeral.classList.add('active');
    }
    
    renderizarLeaderboardSaaS();
}

function renderizarLeaderboardSaaS() {
    const selectClasse = document.getElementById('select-leaderboard-classe');
    const selectGenero = document.getElementById('select-leaderboard-genero');
    const bodyList = document.getElementById('body-leaderboard-scroll');
    const txtSub = document.getElementById('txt-subtitulo-leaderboard');

    const btnTorneio = document.getElementById('btn-tab-torneio-saas');
    const btnSumulas = document.getElementById('btn-tab-sumulas-saas');
    const btnGeral = document.getElementById('btn-tab-geral-saas');
    const containerAbas = btnTorneio ? btnTorneio.parentElement : null;

    if (!bodyList) return;

    try {
        const configRanking = (configRegrasGlobal && configRegrasGlobal.ranking) ? configRegrasGlobal.ranking : {};

        const modelo = configRanking.modeloAtivo || 'piramide';
        const divGenero = configRanking.divisaoGenero || 'separado';
        const ptsVit = parseInt(configRanking.barragem?.pontosVitoria) || 3;
        const ptsDer = parseInt(configRanking.barragem?.pontosDerrota) || 1;
        const faseAtual = parseInt(configRanking.faseAtual, 10) || 1;
        const cal = configRanking.calendario || {};

        const torneioConcluido = (modelo !== "grupos" && faseAtual >= 4) || (modelo === "grupos" && faseAtual >= 5);

        if (txtSub) {
            if (torneioConcluido) {
                txtSub.innerHTML = `<b>🏆 Hall de Campeões</b> • ${cal.nomeTorneio || 'Torneio do Clube'} <span style="display:inline-block; background:#dcfce7; color:#15803d; font-size:10px; font-weight:800; padding:2px 8px; border-radius:10px; margin-left:4px; border:1px solid #86efac;">✓ Homologado</span>`;
            } else {
                const nomesModelos = { piramide: 'Pirâmide (Escada)', barragem: 'Barragem (Pontos)', grupos: 'Grupos (Chaves)' };
                txtSub.textContent = `Ranking Oficial do Clube • Modelo ${nomesModelos[modelo] || 'Oficial'}`;
            }
        }

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

        const chaveTabela = (divGenero === 'unificado') ? `${abaClasseAtivaSaaS}_UNIFICADO` : `${abaClasseAtivaSaaS}_${abaGeneroAtivaSaaS}`;
        
        const listaIDs = (typeof rankingTabelasGlobal !== 'undefined' && rankingTabelasGlobal && rankingTabelasGlobal[chaveTabela])
            ? rankingTabelasGlobal[chaveTabela]
            : [];

        let listaGeralIDs = (typeof rankingGeralGlobal !== 'undefined' && rankingGeralGlobal && rankingGeralGlobal[chaveTabela])
            ? rankingGeralGlobal[chaveTabela]
            : [];

        const temTorneioAtivo = (faseAtual >= 3 && Array.isArray(listaIDs) && listaIDs.length > 0);
        const temRankingGeral = (Array.isArray(listaGeralIDs) && listaGeralIDs.length > 0);

        if (!temTorneioAtivo) {
            abaVisaoLeaderboardSaaS = 'GERAL';
        }

        let selectFase = document.getElementById('select-leaderboard-fase');
        if (!selectFase && selectGenero && selectGenero.parentElement) {
            selectFase = document.createElement('select');
            selectFase.id = 'select-leaderboard-fase';
            selectFase.className = 'select-leaderboard-fase';
            selectFase.style.cssText = 'background:#ffffff; border:1px solid #cbd5e1; border-radius:10px; padding:8px 6px; font-size:12px; font-weight:700; color:#8b5cf6; outline:none; cursor:pointer; flex:1;';
            selectGenero.parentElement.insertBefore(selectFase, selectGenero.nextSibling);
            
            selectFase.onchange = (e) => {
                abaFaseAtivaSaaS = e.target.value;
                renderizarLeaderboardSaaS();
            };
        }

        if (selectFase) {
            const dadosChaveCat = (typeof rankingChavesGlobal !== 'undefined' && rankingChavesGlobal) 
                ? rankingChavesGlobal[chaveTabela] 
                : null;

            if (faseAtual >= 4 && modelo === 'grupos' && dadosChaveCat && dadosChaveCat.faseAtual >= 2) {
                const rodada1 = dadosChaveCat.rodada1 || [];
                const tamanhoChaveAtual = parseInt(dadosChaveCat.faseAtual, 10) || (rodada1.length * 2);
                const totalClassific = parseInt(dadosChaveCat.totalClassificados, 10) || tamanhoChaveAtual;

                const tamanhoInicial = (typeof calcularPotenciaDeDoisSuperiorSaaS === 'function') 
                    ? calcularPotenciaDeDoisSuperiorSaaS(totalClassific) 
                    : tamanhoChaveAtual;

                let opcoesMataMata = "";

                for (let pot = tamanhoInicial; pot >= tamanhoChaveAtual && pot >= 2; pot /= 2) {
                    const rotuloFase = (typeof obterRotuloFaseMataMataSaaS === 'function') 
                        ? obterRotuloFaseMataMataSaaS(pot) 
                        : `Mata-Mata (${pot})`;
                    const valOpt = `MM_${pot}`; 
                    
                    const isSelected = (abaFaseAtivaSaaS === valOpt) || 
                                       ((abaFaseAtivaSaaS === 'AUTO' || abaFaseAtivaSaaS === 'MATA_MATA' || abaFaseAtivaSaaS === 'SEMI') && pot === tamanhoChaveAtual);

                    if (isSelected) abaFaseAtivaSaaS = valOpt;

                    opcoesMataMata += `<option value="${valOpt}" ${isSelected ? 'selected' : ''}>${rotuloFase}</option>`;
                }

                selectFase.style.display = 'block';
                selectFase.innerHTML = `
                    ${opcoesMataMata}
                    <option value="GRUPOS" ${abaFaseAtivaSaaS === 'GRUPOS' ? 'selected' : ''}>Grupos</option>
                    <option value="TODAS" ${abaFaseAtivaSaaS === 'TODAS' ? 'selected' : ''}>Todas</option>
                `;
            } else {
                selectFase.style.display = 'none';
                abaFaseAtivaSaaS = 'GRUPOS';
            }
        }

        if (!temRankingGeral && !temTorneioAtivo) {
            if (containerAbas) containerAbas.style.display = 'none';
            bodyList.innerHTML = '<p style="text-align: center; color: #94a3b8; margin-top: 40px; font-weight: 500;">Nenhum torneio em andamento ou histórico registrado.</p>';
            return;
        }

        if (containerAbas) containerAbas.style.display = 'flex';

        if (btnTorneio) btnTorneio.style.display = temTorneioAtivo ? 'flex' : 'none';
        if (btnSumulas) btnSumulas.style.display = temTorneioAtivo ? 'flex' : 'none';
        if (btnGeral) btnGeral.style.display = temRankingGeral ? 'flex' : 'none';

        const botoesVisiveis = [btnTorneio, btnSumulas, btnGeral].filter(b => b && b.style.display !== 'none');

        if (botoesVisiveis.length === 1 && btnGeral && btnGeral.style.display !== 'none') {
            btnGeral.style.flex = '1';
            btnGeral.style.cursor = 'default';
            btnGeral.style.pointerEvents = 'none';
            btnGeral.classList.add('active');
        } else {
            botoesVisiveis.forEach(b => {
                b.style.flex = '1';
                b.style.cursor = 'pointer';
                b.style.pointerEvents = 'auto';
            });

            [btnTorneio, btnSumulas, btnGeral].forEach(btn => {
                if (btn) btn.classList.remove('active');
            });
            if (abaVisaoLeaderboardSaaS === 'TORNEIO' && btnTorneio) btnTorneio.classList.add('active');
            if (abaVisaoLeaderboardSaaS === 'SUMULAS' && btnSumulas) btnSumulas.classList.add('active');
            if (abaVisaoLeaderboardSaaS === 'GERAL' && btnGeral) btnGeral.classList.add('active');
        }

        const idLogado = localStorage.getItem('jogadorLogadoId');

        if (abaVisaoLeaderboardSaaS === 'GERAL') {
            let htmlGeral = `
                <div class="box-dica-leaderboard">
                    💡 <b>Ranking Geral do Clube:</b> Exibe a Fila Mestre acumulada e o saldo de pontos da categoria.
                </div>
            `;

            if (!Array.isArray(listaGeralIDs) || listaGeralIDs.length === 0) {
                bodyList.innerHTML = '<p style="text-align: center; color: #94a3b8; margin-top: 40px; font-weight: 500;">Nenhum atleta cadastrado no Ranking Geral.</p>';
                return;
            }

            const dictPontos = (typeof rankingPontosGeralGlobal !== 'undefined' && rankingPontosGeralGlobal && rankingPontosGeralGlobal[chaveTabela])
                ? rankingPontosGeralGlobal[chaveTabela]
                : ((typeof pontosGeralGlobal !== 'undefined' && pontosGeralGlobal && pontosGeralGlobal[chaveTabela])
                    ? pontosGeralGlobal[chaveTabela]
                    : {});

            listaGeralIDs.forEach((idAtleta, index) => {
                const atleta = (typeof jogadoresGlobal !== 'undefined' && jogadoresGlobal[idAtleta]) ? jogadoresGlobal[idAtleta] : {};
                const pos = index + 1;
                const nomeAtleta = atleta.nomeCompleto || atleta.apelido || 'Atleta';
                const ehVoce = (idAtleta === idLogado);
                const pts = parseInt(dictPontos[idAtleta], 10) || 0;

                const estiloPontos = pts > 0 
                    ? "color: #15803d;" 
                    : "color: #94a3b8;";

                htmlGeral += `
                    <div class="item-leaderboard-piramide ${ehVoce ? 'voce' : ''}" style="display: flex; align-items: center; justify-content: space-between;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <span style="font-weight: 800; font-size: 13px; color: #64748b; width: 24px;">${pos}º</span>
                            <div>
                                <strong style="font-size: 14px; color: #1e293b; display: block;">${nomeAtleta} ${ehVoce ? '(Você)' : ''}</strong>
                                <span style="font-size: 11px; color: #64748b;">${pos === 1 ? 'Líder do Ranking Geral' : 'Atleta Cadastrado'}</span>
                            </div>
                        </div>
                        <span style="font-weight: 800; font-size: 13.5px; flex-shrink: 0; ${estiloPontos}">${pts} pts</span>
                    </div>
                `;
            });

            bodyList.innerHTML = htmlGeral;
            return;
        }

        const partidasGlobal = (typeof rankingPartidasGlobal !== 'undefined' && rankingPartidasGlobal)
            ? rankingPartidasGlobal
            : {};

        if (abaVisaoLeaderboardSaaS === 'SUMULAS') {
            let listaPartidas = Object.values(partidasGlobal).filter(p => p.categoria === chaveTabela);

            if (modelo === 'grupos' && abaFaseAtivaSaaS && abaFaseAtivaSaaS !== 'TODAS' && abaFaseAtivaSaaS !== 'AUTO') {
                let potAlvo = null;
                if (typeof abaFaseAtivaSaaS === 'string' && abaFaseAtivaSaaS.startsWith('MM_')) {
                    potAlvo = parseInt(abaFaseAtivaSaaS.replace('MM_', ''), 10);
                }

                const dadosChaveCat = (typeof rankingChavesGlobal !== 'undefined' && rankingChavesGlobal) ? rankingChavesGlobal[chaveTabela] : null;
                let confsFase = [];

                if (dadosChaveCat) {
                    const tamAtual = parseInt(dadosChaveCat.faseAtual, 10) || 0;
                    if (potAlvo === tamAtual && Array.isArray(dadosChaveCat.rodada1)) {
                        confsFase = dadosChaveCat.rodada1;
                    } else if (dadosChaveCat.historicoRodadas) {
                        confsFase = dadosChaveCat.historicoRodadas[potAlvo] || dadosChaveCat.historicoRodadas[String(potAlvo)] || [];
                    }
                }

                listaPartidas = listaPartidas.filter(p => {
                    const dp = p.dadosPlacar || {};
                    const tagG = dp.tagGrupoRanking || p.tagGrupoRanking;

                    const ehPartidaGrupo = !!tagG;

                    if (abaFaseAtivaSaaS === 'GRUPOS') {
                        return ehPartidaGrupo;
                    }

                    if (ehPartidaGrupo) return false;

                    if (potAlvo && Array.isArray(confsFase) && confsFase.length > 0) {
                        return confsFase.some(c => 
                            (c.jogador1Id === p.jogador1Id && c.jogador2Id === p.jogador2Id) ||
                            (c.jogador1Id === p.jogador2Id && c.jogador2Id === p.jogador1Id)
                        );
                    }

                    return false;
                });
            }

            if (listaPartidas.length === 0) {
                bodyList.innerHTML = '<p style="text-align: center; color: #94a3b8; margin-top: 40px; font-weight: 500;">Nenhuma súmula lançada para esta categoria no torneio atual.</p>';
                return;
            }

            const buscarNome = (id) => {
                const j = (typeof jogadoresGlobal !== 'undefined' && jogadoresGlobal[id]) ? jogadoresGlobal[id] : {};
                const nomeStr = j.nomeCompleto || j.apelido || 'Atleta';
                return nomeStr.split(' ').map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ');
            };

            const formatarNomeCurto = (nomeBruto) => {
                if (!nomeBruto) return "";
                const palavras = nomeBruto.trim().toLowerCase().split(/\s+/).map(p => {
                    if (['da', 'de', 'do', 'dos', 'das'].includes(p)) return p;
                    return p.charAt(0).toUpperCase() + p.slice(1);
                });
                if (palavras.length > 2) {
                    let res = palavras[0];
                    for (let i = 1; i < palavras.length - 1; i++) {
                        if (['da', 'de', 'do', 'dos', 'das'].includes(palavras[i])) {
                            res += " " + palavras[i];
                        } else {
                            res += " " + palavras[i].charAt(0).toUpperCase() + ".";
                        }
                    }
                    res += " " + palavras[palavras.length - 1];
                    return res;
                }
                return palavras.join(' ');
            };

            const fmtSet = (pts, tb) => {
                if (pts === undefined || pts === null || pts === "") return '-';
                if (tb !== undefined && tb !== null && tb !== "") return `${pts}<sup>${tb}</sup>`;
                return pts;
            };

            const calcSetWinner = (p1, p2, tb1, tb2) => {
                const n1 = parseInt(p1), n2 = parseInt(p2);
                if (isNaN(n1) || isNaN(n2)) return 0;
                const t1 = parseInt(tb1), t2 = parseInt(tb2);
                if (!isNaN(t1) && !isNaN(t2)) {
                    if (t1 > t2) return 1;
                    if (t2 > t1) return 2;
                }
                if ((n1 === 6 && n2 <= 4) || (n1 === 7 && (n2 === 5 || n2 === 6))) return 1;
                if ((n2 === 6 && n1 <= 4) || (n2 === 7 && (n1 === 5 || n1 === 6))) return 2;
                if ((n1 === 4 && n2 <= 2) || (n1 === 5 && (n2 === 3 || n2 === 4))) return 1;
                if ((n2 === 4 && n1 <= 2) || (n2 === 5 && (n1 === 3 || n1 === 4))) return 2;
                if ((n1 === 8 && n2 <= 6) || (n1 === 9 && (n2 === 7 || n2 === 8))) return 1;
                if ((n2 === 8 && n1 <= 6) || (n2 === 9 && (n1 === 7 || n1 === 8))) return 2;
                if (n1 >= 10 && n1 - n2 >= 2) return 1;
                if (n2 >= 10 && n2 - n1 >= 2) return 2;
                return 0;
            };

            let htmlSumulas = `
                <div style="margin-top: 2px; margin-bottom: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 8px 10px; font-size: 12px; color: #64748b; text-align: center;">
                    📋 Total de <b>${listaPartidas.length} partida(s)</b> nesta categoria.
                </div>
                <div style="display: flex; flex-direction: column; gap: 12px;">
            `;

            listaPartidas.forEach(partida => {
                const j1NomeLongo = buscarNome(partida.jogador1Id);
                const j2NomeLongo = buscarNome(partida.jogador2Id);
                const j1Exibicao = formatarNomeCurto(j1NomeLongo);
                const j2Exibicao = formatarNomeCurto(j2NomeLongo);

                const catKey = partida.categoria || '';
                let catLabel = catKey.replace('CLASSE_', 'Classe ').replace('_', ' ');
                catLabel = catLabel.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');

                const dp = partida.dadosPlacar || {};
                const dataMs = partida.dataHora || dp.dataHoraLancamento || dp.dataHoraValidacao || dp.dataHoraArbitragem;
                let dataPartidaStr = '--/--/----';
                if (dataMs) {
                    const d = new Date(dataMs);
                    if (!isNaN(d.getTime())) {
                        dataPartidaStr = d.toLocaleDateString('pt-BR');
                    }
                } else if (partida.dataCompleta) {
                    const p = partida.dataCompleta.split('-');
                    if (p.length === 3) dataPartidaStr = `${p[2]}/${p[1]}/${p[0]}`;
                }

                const stPlacar = dp.statusPlacar || partida.status || 'consolidado';
                const decisaoArb = dp.decisaoArbitro || '';
                const isWO = !!dp.isWO || (dp.placarFormatado && dp.placarFormatado.includes("W.O."));
                const isRET = !!dp.isRET || (dp.placarFormatado && dp.placarFormatado.includes("RET"));

                let labelFasePartida = 'Ranking';
                let tagG = dp.tagGrupoRanking || partida.tagGrupoRanking;

                if (modelo === 'grupos') {
                    const idsArr = Array.isArray(listaIDs) ? listaIDs : Object.values(listaIDs);
                    const idx1 = partida.jogador1Id ? idsArr.indexOf(partida.jogador1Id) : -1;
                    const idx2 = partida.jogador2Id ? idsArr.indexOf(partida.jogador2Id) : -1;
                    const tamanhoGrupo = parseInt(configRanking.grupos?.tamanhoGrupo, 10) || 3;

                    const grp1 = idx1 !== -1 ? Math.floor(idx1 / tamanhoGrupo) : -1;
                    const grp2 = idx2 !== -1 ? Math.floor(idx2 / tamanhoGrupo) : -2;

                    if (tagG) {
                        labelFasePartida = `Grupos - ${tagG}`;
                    } else if (grp1 !== -1 && grp1 === grp2) {
                        tagG = `G${grp1 + 1}`;
                        labelFasePartida = `Grupos - ${tagG}`;
                    } else {
                        if (faseAtual >= 4) {
                            let rotuloFaseMM = "Mata-Mata";
                            const dadosChaveCat = (typeof rankingChavesGlobal !== 'undefined' && rankingChavesGlobal) ? rankingChavesGlobal[chaveTabela] : null;

                            if (dadosChaveCat) {
                                const tamAtual = parseInt(dadosChaveCat.faseAtual, 10) || 0;
                                const ehNaRodadaAtiva = (dadosChaveCat.rodada1 || []).some(c => 
                                    (c.jogador1Id === partida.jogador1Id && c.jogador2Id === partida.jogador2Id) ||
                                    (c.jogador1Id === partida.jogador2Id && c.jogador2Id === partida.jogador1Id)
                                );

                                if (ehNaRodadaAtiva) {
                                    rotuloFaseMM = (typeof obterRotuloFaseMataMataSaaS === 'function') ? obterRotuloFaseMataMataSaaS(tamAtual) : "Mata-Mata";
                                } else if (dadosChaveCat.historicoRodadas) {
                                    const potEncontrada = Object.keys(dadosChaveCat.historicoRodadas).find(pot => {
                                        const confs = dadosChaveCat.historicoRodadas[pot] || [];
                                        return confs.some(c => 
                                            (c.jogador1Id === partida.jogador1Id && c.jogador2Id === partida.jogador2Id) ||
                                            (c.jogador1Id === partida.jogador2Id && c.jogador2Id === partida.jogador1Id)
                                        );
                                    });

                                    if (potEncontrada) {
                                        rotuloFaseMM = (typeof obterRotuloFaseMataMataSaaS === 'function') ? obterRotuloFaseMataMataSaaS(parseInt(potEncontrada, 10)) : "Mata-Mata";
                                    }
                                }
                            }

                            if (rotuloFaseMM === "Mata-Mata" && typeof abaFaseAtivaSaaS === 'string' && abaFaseAtivaSaaS.startsWith('MM_')) {
                                const potSel = parseInt(abaFaseAtivaSaaS.replace('MM_', ''), 10);
                                if (!isNaN(potSel) && typeof obterRotuloFaseMataMataSaaS === 'function') {
                                    rotuloFaseMM = obterRotuloFaseMataMataSaaS(potSel);
                                }
                            }

                            labelFasePartida = rotuloFaseMM;
                        } else {
                            labelFasePartida = 'Mata-Mata';
                        }
                    }
                } else if (modelo === 'barragem') {
                    labelFasePartida = 'Barragem';
                } else if (modelo === 'piramide') {
                    labelFasePartida = 'Pirâmide';
                }

                let badgeHtml = '';
                let footerArbHtml = '';

                if (stPlacar === 'anulado' || decisaoArb === 'anulado_pelo_arbitro') {
                    badgeHtml = `<span style="font-size: 11px; color: #dc2626; font-weight: 700;"><span style="margin-right: 3px;">🔴</span> Arbitrado</span>`;
                    const juizNome = dp.arbitroResponsavel ? formatarNomeCurto(dp.arbitroResponsavel) : 'Árbitro';
                    const motivoAnul = dp.motivoAnulacao || 'partida inválida pelo torneio.';
                    footerArbHtml = `<div style="text-align: center; font-style: italic; color: #dc2626; font-size: 12px; margin-top: 6px; margin-bottom: 2px;">Anulada por ${juizNome}: "${motivoAnul}"</div>`;
                } else if (decisaoArb === 'editado_pelo_arbitro') {
                    badgeHtml = `<span style="font-size: 11px; color: #d97706; font-weight: 700;"><span style="margin-right: 3px;">🟠</span> Arbitrado</span>`;
                    const juizNome = dp.arbitroResponsavel ? formatarNomeCurto(dp.arbitroResponsavel) : 'Árbitro';
                    footerArbHtml = `<div style="text-align: center; font-style: italic; color: #d97706; font-size: 12px; margin-top: 6px; margin-bottom: 2px;">Editado pela arbitragem: ${juizNome}</div>`;
                } else if (decisaoArb === 'mantido_pelo_arbitro') {
                    badgeHtml = `<span style="font-size: 11px; color: #16a34a; font-weight: 700;"><span style="margin-right: 3px;">🟢</span> Arbitrado</span>`;
                    const juizNome = dp.arbitroResponsavel ? formatarNomeCurto(dp.arbitroResponsavel) : 'Árbitro';
                    footerArbHtml = `<div style="text-align: center; font-style: italic; color: #16a34a; font-size: 12px; margin-top: 6px; margin-bottom: 2px;">Homologado pela arbitragem: ${juizNome}</div>`;
                } else {
                    badgeHtml = `<span style="font-size: 11px; color: #16a34a; font-weight: 700;">✓ Homologado</span>`;
                }

                const norm = s => (s||"").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
                const vencedorOficial = norm(dp.vencedor || "");
                const ehAnulado = (stPlacar === 'anulado' || decisaoArb === 'anulado_pelo_arbitro');
                
                const j1EhVencedor = !ehAnulado && ((partida.vencedorId === partida.jogador1Id) || (dp.vencedorCodigo === 'J1') || (vencedorOficial === norm(j1NomeLongo)));

                let classNomeJ1 = (j1EhVencedor && !ehAnulado) ? 'match-winner' : '';
                let classNomeJ2 = (!j1EhVencedor && !ehAnulado) ? 'match-winner' : '';
                let setaJ1 = (j1EhVencedor && !ehAnulado) ? '<div class="winner-arrow">◀</div>' : '';
                let setaJ2 = (!j1EhVencedor && !ehAnulado) ? '<div class="winner-arrow">◀</div>' : '';

                htmlSumulas += `
                    <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 14px; padding: 12px 14px 6px 14px; box-shadow: 0 2px 4px rgba(0,0,0,0.03);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid #f1f5f9; padding-bottom: 6px;">
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <span style="font-size: 11px; font-weight: 700; color: #8b5cf6; background: #f5f3ff; padding: 2px 8px; border-radius: 8px; border: 1px solid #ddd6fe;">
                                    ${catLabel || 'Categoria Oficial'}
                                </span>
                                <span style="font-size: 11px; font-weight: 700; color: #475569; background: #f1f5f9; padding: 2px 8px; border-radius: 8px; border: 1px solid #cbd5e1; display: inline-flex; align-items: center; gap: 3px;">
                                    <i class="material-icons" style="font-size: 12px;">event</i> ${dataPartidaStr}
                                </span>
                            </div>
                            ${badgeHtml}
                        </div>
                `;

                if (isWO) {
                    htmlSumulas += `
                        <table class="atp-table">
                            <thead>
                                <tr>
                                    <th style="text-align: left; font-size: 11px; font-weight: 700; color: #64748b; padding-left: 2px;">${labelFasePartida}</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>
                                        <span class="atp-name ${j1EhVencedor ? 'match-winner' : ''}">${j1Exibicao}</span>
                                    </td>
                                    <td style="text-align: right; font-weight: 800; font-size: 15px; color: #1e293b; padding-right: 12px;">${j1EhVencedor ? 'W.O.' : ''}</td>
                                </tr>
                                <tr>
                                    <td>
                                        <span class="atp-name ${!j1EhVencedor ? 'match-winner' : ''}">${j2Exibicao}</span>
                                    </td>
                                    <td style="text-align: right; font-weight: 800; font-size: 15px; color: #1e293b; padding-right: 12px;">${!j1EhVencedor ? 'W.O.' : ''}</td>
                                </tr>
                            </tbody>
                        </table>
                        <div style="text-align: center; font-style: italic; color: #64748b; font-size: 13px; margin-top: 10px; margin-bottom: 4px;">
                            Motivo: ${dp.motivoWO || 'Não informado'}
                        </div>
                    `;
                } else if (dp.parciais) {
                    const tagRetJ1 = (isRET && dp.desistenteCodigo === 'J1') ? '<span class="badge-ret" style="margin-left: 6px;">RET</span>' : '';
                    const tagRetJ2 = (isRET && dp.desistenteCodigo === 'J2') ? '<span class="badge-ret" style="margin-left: 6px;">RET</span>' : '';

                    const p = dp.parciais || {};
                    const temSet1 = (p.set1 && p.set1.j1 !== undefined && p.set1.j1 !== null && p.set1.j1 !== "");
                    const temSet2 = (p.set2 && p.set2.j1 !== undefined && p.set2.j1 !== null && p.set2.j1 !== "");
                    const temSet3 = (p.set3 && p.set3.j1 !== undefined && p.set3.j1 !== null && p.set3.j1 !== "");

                    let thSetsHtml = '';
                    if (temSet1) thSetsHtml += `<th class="col-score">1</th>`;
                    if (temSet2) thSetsHtml += `<th class="col-score">2</th>`;
                    if (temSet3) thSetsHtml += `<th class="col-score">3</th>`;

                    let tdSetsJ1Html = '';
                    let tdSetsJ2Html = '';

                    if (temSet1) {
                        const s1J1 = fmtSet(p.set1.j1, p.set1.tbJ1);
                        const s1J2 = fmtSet(p.set1.j2, p.set1.tbJ2);
                        const w1 = calcSetWinner(p.set1.j1, p.set1.j2, p.set1.tbJ1, p.set1.tbJ2);
                        const classS1J1 = (!ehAnulado && w1 === 1) ? 'set-winner' : '';
                        const classS1J2 = (!ehAnulado && w1 === 2) ? 'set-winner' : '';
                        tdSetsJ1Html += `<td class="col-score atp-score ${classS1J1}">${s1J1}</td>`;
                        tdSetsJ2Html += `<td class="col-score atp-score ${classS1J2}">${s1J2}</td>`;
                    }

                    if (temSet2) {
                        const s2J1 = fmtSet(p.set2.j1, p.set2.tbJ1);
                        const s2J2 = fmtSet(p.set2.j2, p.set2.tbJ2);
                        const w2 = calcSetWinner(p.set2.j1, p.set2.j2, p.set2.tbJ1, p.set2.tbJ2);
                        const classS2J1 = (!ehAnulado && w2 === 1) ? 'set-winner' : '';
                        const classS2J2 = (!ehAnulado && w2 === 2) ? 'set-winner' : '';
                        tdSetsJ1Html += `<td class="col-score atp-score ${classS2J1}">${s2J1}</td>`;
                        tdSetsJ2Html += `<td class="col-score atp-score ${classS2J2}">${s2J2}</td>`;
                    }

                    if (temSet3) {
                        const s3J1 = fmtSet(p.set3.j1, p.set3.tbJ1);
                        const s3J2 = fmtSet(p.set3.j2, p.set3.tbJ2);
                        const w3 = calcSetWinner(p.set3.j1, p.set3.j2, p.set3.tbJ1, p.set3.tbJ2);
                        const classS3J1 = (!ehAnulado && w3 === 1) ? 'set-winner' : '';
                        const classS3J2 = (!ehAnulado && w3 === 2) ? 'set-winner' : '';
                        tdSetsJ1Html += `<td class="col-score atp-score ${classS3J1}">${s3J1}</td>`;
                        tdSetsJ2Html += `<td class="col-score atp-score ${classS3J2}">${s3J2}</td>`;
                    }

                    htmlSumulas += `
                        <table class="atp-table">
                            <thead>
                                <tr>
                                    <th style="text-align: left; font-size: 11px; font-weight: 700; color: #64748b; padding-left: 2px;">${labelFasePartida}</th>
                                    ${thSetsHtml}
                                    <th class="col-arrow"></th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>
                                        <span class="atp-name ${classNomeJ1}">${j1Exibicao}</span>
                                        ${tagRetJ1}
                                    </td>
                                    ${tdSetsJ1Html}
                                    <td class="col-arrow">${setaJ1}</td>
                                </tr>
                                <tr>
                                    <td>
                                        <span class="atp-name ${classNomeJ2}">${j2Exibicao}</span>
                                        ${tagRetJ2}
                                    </td>
                                    ${tdSetsJ2Html}
                                    <td class="col-arrow">${setaJ2}</td>
                                </tr>
                            </tbody>
                        </table>
                    `;

                    if (isRET && dp.motivoRET) {
                        htmlSumulas += `
                            <div style="text-align: center; font-style: italic; color: #64748b; font-size: 13px; margin-top: 10px; margin-bottom: 4px;">
                                Motivo: ${dp.motivoRET}
                            </div>
                        `;
                    }
                } else {
                    htmlSumulas += `
                        <table class="atp-table">
                            <thead>
                                <tr>
                                    <th style="text-align: left; font-size: 11px; font-weight: 700; color: #64748b; padding-left: 2px;">${labelFasePartida}</th>
                                    <th class="col-score">1</th>
                                    <th class="col-arrow"></th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>
                                        <span class="atp-name ${j1EhVencedor ? 'match-winner' : ''}">${j1Exibicao}</span>
                                    </td>
                                    <td class="col-score atp-score ${j1EhVencedor ? 'set-winner' : ''}">${partida.gamesP1 || 0}</td>
                                    <td class="col-arrow">${setaJ1}</td>
                                </tr>
                                <tr>
                                    <td>
                                        <span class="atp-name ${!j1EhVencedor ? 'match-winner' : ''}">${j2Exibicao}</span>
                                    </td>
                                    <td class="col-score atp-score ${!j1EhVencedor ? 'set-winner' : ''}">${partida.gamesP2 || 0}</td>
                                    <td class="col-arrow">${setaJ2}</td>
                                </tr>
                            </tbody>
                        </table>
                    `;
                }

                if (footerArbHtml) {
                    htmlSumulas += footerArbHtml;
                }

                htmlSumulas += `</div>`;
            });

            htmlSumulas += `</div>`;
            bodyList.innerHTML = htmlSumulas;
            return;
        }

        const estatisticas = {};
        const confrontosDiretos = {};

        listaIDs.forEach(id => {
            estatisticas[id] = { j: 0, v: 0, d: 0, sg: 0, pts: 0 };
        });

        Object.values(partidasGlobal).forEach(partida => {
            if (partida.status === 'finalizada' && partida.categoria === chaveTabela) {
                if (modelo === 'grupos') {
                    const dp = partida.dadosPlacar || {};
                    const tagG = dp.tagGrupoRanking || partida.tagGrupoRanking;
                    const tamanhoGrupo = parseInt(configRanking.grupos?.tamanhoGrupo, 10) || 3;

                    const idx1 = partida.jogador1Id ? listaIDs.indexOf(partida.jogador1Id) : -1;
                    const idx2 = partida.jogador2Id ? listaIDs.indexOf(partida.jogador2Id) : -1;
                    const grp1 = idx1 !== -1 ? Math.floor(idx1 / tamanhoGrupo) : -1;
                    const grp2 = idx2 !== -1 ? Math.floor(idx2 / tamanhoGrupo) : -2;

                    const ehPartidaGrupo = !!tagG || (grp1 !== -1 && grp1 === grp2);

                    if (!ehPartidaGrupo) return;
                }

                const p1 = partida.jogador1Id;
                const p2 = partida.jogador2Id;
                const vitorioso = partida.vencedorId;

                const gamesP1 = parseInt(partida.gamesP1) || 0;
                const gamesP2 = parseInt(partida.gamesP2) || 0;

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

        const exibeHall = torneioConcluido && (abaFaseAtivaSaaS === 'AUTO' || abaFaseAtivaSaaS === 'MM_2' || abaFaseAtivaSaaS === 'FINAL');

        if (exibeHall) {
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

            const rotulosBadgesCampeao = {
                piramide: "1º LUGAR • PIRÂMIDE",
                barragem: "1º LUGAR • BARRAGEM",
                grupos: "1º LUGAR • GRUPOS"
            };
            const txtBadgeCampeao = rotulosBadgesCampeao[modelo] || "1º LUGAR • CAMPEÃO";

            htmlHall += `
                <div style="background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%); border: 2px solid #f59e0b; border-radius: 16px; padding: 14px; text-align: center; box-shadow: 0 10px 15px -3px rgba(245, 158, 11, 0.2); margin-bottom: 12px;">
                    <div style="font-size: 28px; margin-bottom: -4px;">👑</div>
                    <span style="background: #f59e0b; color: #ffffff; font-size: 10px; font-weight: 900; padding: 2px 8px; border-radius: 10px; display: inline-block;">${txtBadgeCampeao}</span>
                    <div style="font-size: 16px; font-weight: 800; color: #78350f; margin: 4px 0;">${nomeCampeao} ${idCampeao === idLogado ? '(Você)' : ''}</div>
                    <div style="font-size: 11.5px; color: #92400e; font-weight: 600;">Campeão do Torneio</div>
                </div>

                <div style="display: flex; flex-direction: column; gap: 8px;">
            `;

            if (idVice) {
                htmlHall += `
                    <div style="background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 12px; padding: 10px 14px; display: flex; align-items: center; justify-content: space-between;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-weight: 800; font-size: 13px; width: 26px; color: #475569;">2º</span>
                            <div>
                                <strong style="font-size: 13px; font-weight: 700; color: #1e293b; display: block;">${nomeVice} ${idVice === idLogado ? '(Você)' : ''}</strong>
                                <span style="font-size: 11px; color: #64748b;">Vice-Campeão do Torneio</span>
                            </div>
                        </div>
                    </div>
                `;
            }

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

        if (modelo === 'piramide') {
            const idxLogado = listaIDs.indexOf(idLogado);
            const alcanceTipo = configRanking.piramide?.alcanceTipo || 'posicoes';
            const alcancePosicoes = parseInt(configRanking.piramide?.limitePosicoes, 10) || 3;

            let textoAlcanceDica = `até ${alcancePosicoes} acima`;
            let idxInicioAlcance = -1;
            let idxFimAlcance = -1;

            if (idxLogado !== -1) {
                if (alcanceTipo === 'linha') {
                    textoAlcanceDica = "na linha acima";
                    const posLogado = idxLogado + 1;
                    
                    let linhaAtual = 1;
                    let acum = 1;
                    while (acum < posLogado) {
                        linhaAtual++;
                        acum += linhaAtual;
                    }

                    if (linhaAtual > 1) {
                        const linhaAcima = linhaAtual - 1;
                        const posInicioLinhaAcima = ((linhaAcima - 1) * linhaAcima / 2) + 1;
                        const posFimLinhaAcima = (linhaAcima * (linhaAcima + 1)) / 2;

                        idxInicioAlcance = posInicioLinhaAcima - 1;
                        idxFimAlcance = posFimLinhaAcima - 1;
                    }
                } else if (alcanceTipo === 'livre') {
                    textoAlcanceDica = "todas as posições acima";
                    idxInicioAlcance = 0;
                    idxFimAlcance = idxLogado - 1;
                } else {
                    idxInicioAlcance = Math.max(0, idxLogado - alcancePosicoes);
                    idxFimAlcance = idxLogado - 1;
                }
            }

            let htmlList = `
                <div class="box-dica-leaderboard">
                    💡 <b>Modelo Pirâmide:</b> Exibe a posição ordinal. As posições destacadas em laranja estão dentro do seu limite de desafio (${textoAlcanceDica}).
                </div>
            `;

            listaIDs.forEach((idAtleta, index) => {
                const atleta = (typeof jogadoresGlobal !== 'undefined' && jogadoresGlobal[idAtleta]) ? jogadoresGlobal[idAtleta] : {};
                const pos = index + 1;
                const nomeAtleta = atleta.nomeCompleto || atleta.apelido || 'Atleta do Ranking';

                const ehVoce = (idAtleta === idLogado);
                const noAlcance = (idxLogado !== -1 && !ehVoce && index >= idxInicioAlcance && index <= idxFimAlcance);

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

                    const tagTexto = (faseAtual === 3 && membrosChave.length > 1) ? "Zona de Classificação" : "Classificado";

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
                                    ${isClassificado ? `<span class="badge-classificado">${tagTexto}</span>` : ''}
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
            
			let htmlMataMata = '';
			
            if (faseAtual >= 4) {
                const dadosChaveCat = (typeof rankingChavesGlobal !== 'undefined' && rankingChavesGlobal) 
                    ? rankingChavesGlobal[chaveTabela] 
                    : null;

                const rodadaAtualBanco = (dadosChaveCat && dadosChaveCat.rodada1) ? dadosChaveCat.rodada1 : [];
                const tamanhoChaveAtual = (dadosChaveCat && dadosChaveCat.faseAtual) ? parseInt(dadosChaveCat.faseAtual, 10) : (rodadaAtualBanco.length * 2);

                let potAlvo = tamanhoChaveAtual;
                if (abaFaseAtivaSaaS && abaFaseAtivaSaaS.startsWith('MM_')) {
                    potAlvo = parseInt(abaFaseAtivaSaaS.replace('MM_', ''), 10);
                }

				let rodadaExibir = [];

				if (potAlvo === tamanhoChaveAtual && rodadaAtualBanco.length > 0) {
					rodadaExibir = rodadaAtualBanco;
				} else if (dadosChaveCat && dadosChaveCat.historicoRodadas && dadosChaveCat.historicoRodadas[potAlvo]) {
					rodadaExibir = dadosChaveCat.historicoRodadas[potAlvo];
				} else {
					rodadaExibir = [];
				}

                const rotuloFaseHeader = (typeof obterRotuloFaseMataMataSaaS === 'function') 
                    ? obterRotuloFaseMataMataSaaS(potAlvo) 
                    : "Mata-Mata";

                const buscarPartidaGenericaMM = (idA, idB) => {
                    if (!idA || !idB) return null;
                    if (typeof rankingPartidasGlobal !== 'undefined' && rankingPartidasGlobal) {
                        const pFound = Object.values(rankingPartidasGlobal).find(p => {
                            if (p.categoria !== chaveTabela || p.status !== 'finalizada') return false;

                            const dp = p.dadosPlacar || {};
                            const ehPartidaDeGrupo = !!(p.tagGrupoRanking || dp.tagGrupoRanking);
                            if (ehPartidaDeGrupo) return false;

                            return (p.jogador1Id === idA && p.jogador2Id === idB) || (p.jogador1Id === idB && p.jogador2Id === idA);
                        });
                        if (pFound) {
                            return {
                                vencedorId: pFound.vencedorId,
                                placarFormatado: pFound.dadosPlacar?.placarFormatado || ''
                            };
                        }
                    }
                    return null;
                };

                const buscarNomeMM = (id) => {
                    if (!id) return 'A definir';
                    const j = (typeof jogadoresGlobal !== 'undefined' && jogadoresGlobal[id]) ? jogadoresGlobal[id] : {};
                    const nomeStr = j.apelido || j.nomeCompleto || 'A definir';
                    return (id === idLogado) ? `${nomeStr} <span style="font-size: 11px; color: #15803d; font-weight: 800;">(Você)</span>` : nomeStr;
                };

                let cardsConfrontosHtml = '';

                if (rodadaExibir.length > 0) {
                    rodadaExibir.forEach((confItem, idx) => {
                        const p1 = confItem.jogador1Id;
                        const p2 = confItem.jogador2Id;
                        const ehBye = confItem.isBye || !p2;

                        if (ehBye) {
                            const name1 = buscarNomeMM(p1);
                            const ehVoceNoJogo = (idLogado && idLogado === p1);
                            const styleCard = ehVoceNoJogo
                                ? 'background: #f0fdf4; border: 1.5px solid #16a34a; border-radius: 12px; padding: 12px; box-shadow: 0 2px 6px rgba(0,0,0,0.04);'
                                : 'background: #ffffff; border: 1.5px solid #8b5cf6; border-radius: 12px; padding: 12px; box-shadow: 0 2px 6px rgba(0,0,0,0.04);';

                            cardsConfrontosHtml += `
                                <div style="${styleCard}">
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                        <div style="font-size: 11px; font-weight: 800; color: ${ehVoceNoJogo ? '#15803d' : '#8b5cf6'}; text-transform: uppercase;">⚔️ Jogo ${idx + 1} • Folga (BYE)</div>
                                        <span style="font-size: 10.5px; font-weight: 800; color: #15803d; background: #dcfce7; padding: 2px 8px; border-radius: 10px; border: 1px solid #86efac;">Classificado(a)</span>
                                    </div>
                                    <div style="font-size: 13.5px; font-weight: 700; color: #1e293b; padding: 4px 0;">
                                        ${name1} <span style="font-size: 11px; color: #64748b; font-weight: 600;">(Avança direto para a próxima fase)</span>
                                    </div>
                                </div>
                            `;
                            return;
                        }

                        const partida = buscarPartidaGenericaMM(p1, p2);
                        const vitoriosoId = partida ? partida.vencedorId : null;

                        let name1 = buscarNomeMM(p1);
                        let name2 = buscarNomeMM(p2);

                        if (vitoriosoId) {
                            if (p1 === vitoriosoId) name1 += ' <span style="font-size: 10px; background: #dcfce7; color: #15803d; font-weight: 800; padding: 2px 6px; border-radius: 8px; margin-left: 6px;">✓ Vencedor</span>';
                            if (p2 === vitoriosoId) name2 += ' <span style="font-size: 10px; background: #dcfce7; color: #15803d; font-weight: 800; padding: 2px 6px; border-radius: 8px; margin-left: 6px;">✓ Vencedor</span>';
                        }

                        const ehVoceNoJogo = (idLogado && (idLogado === p1 || idLogado === p2));
                        const styleCard = ehVoceNoJogo
                            ? 'background: #f0fdf4; border: 1.5px solid #16a34a; border-radius: 12px; padding: 12px; box-shadow: 0 2px 6px rgba(0,0,0,0.04);'
                            : 'background: #ffffff; border: 1.5px solid #8b5cf6; border-radius: 12px; padding: 12px; box-shadow: 0 2px 6px rgba(0,0,0,0.04);';

                        const headerCard = partida
                            ? `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;"><div style="font-size: 11px; font-weight: 800; color: ${ehVoceNoJogo ? '#15803d' : '#8b5cf6'}; text-transform: uppercase;">⚔️ Jogo ${idx + 1}</div><span style="font-size: 10.5px; font-weight: 800; color: #16a34a; background: #dcfce7; padding: 2px 8px; border-radius: 10px; border: 1px solid #86efac;">Placar: ${partida.placarFormatado}</span></div>`
                            : `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;"><div style="font-size: 11px; font-weight: 800; color: ${ehVoceNoJogo ? '#15803d' : '#8b5cf6'}; text-transform: uppercase;">⚔️ Jogo ${idx + 1}</div></div>`;

                        cardsConfrontosHtml += `
                            <div style="${styleCard}">
                                ${headerCard}
                                <div style="font-size: 13.5px; font-weight: 700; color: #1e293b; padding: 4px 0; border-bottom: 1px dashed #e2e8f0;">
                                    ${name1}
                                </div>
                                <div style="font-size: 13.5px; font-weight: 700; color: #1e293b; padding: 4px 0;">
                                    ${name2}
                                </div>
                            </div>
                        `;
                    });
                } else {
                    cardsConfrontosHtml = `
                        <div style="background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 12px; padding: 16px; text-align: center; color: #64748b; font-size: 13px;">
                            Aguardando consolidação dos confrontos do Quadro Eliminatório.
                        </div>
                    `;
                }

                htmlMataMata = `
                    <div class="box-dica-leaderboard">
                        🌳 <b>Fase 4 - ${rotuloFaseHeader}:</b> Confrontos decisivos do torneio.
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        ${cardsConfrontosHtml}
                    </div>
                `;
            }

            if (faseAtual >= 4) {
                if (abaFaseAtivaSaaS === 'GRUPOS') {
                    bodyList.innerHTML = htmlGrupos;
                } else if (abaFaseAtivaSaaS === 'TODAS') {
                    const htmlSeparador = `
                        <div style="display:flex; align-items:center; gap:8px; margin:18px 0 10px 0;">
                            <span style="font-size:11px; font-weight:800; color:#64748b; text-transform:uppercase; white-space:nowrap;">📊 Histórico da Fase de Grupos</span>
                            <div style="height:1px; background:#e2e8f0; width:100%;"></div>
                        </div>
                    `;
                    bodyList.innerHTML = htmlMataMata + htmlSeparador + htmlGrupos;
                } else {
                    bodyList.innerHTML = htmlMataMata;
                }
            } else {
                bodyList.innerHTML = htmlGrupos; 
            }
        }

    } catch (err) {
        console.error("❌ Erro ao renderizar Leaderboard:", err);
        bodyList.innerHTML = '<p style="text-align: center; color: #ef4444; margin-top: 30px;">Erro ao carregar a classificação.</p>';
    }
}

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
/* 3. CONTROLES DA ABA DE HISTÓRICO E ACERVO                 */
/* ======================================================== */

async function carregarHistoricoTorneiosSaaS() {
    const tbody = document.getElementById('tbody-historico-torneios');
    if (!tbody || !raizBanco) return;

    try {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px; color: #94a3b8;">Buscando acervo no banco de dados...</td></tr>';

        const snapHistorico = await database.ref(`${raizBanco}/historico_torneios`).once('value');
        const historicoData = snapHistorico.exists() ? snapHistorico.val() : {};

        acervoHistoricoGlobalSaaS = Object.keys(historicoData).map(key => {
            return { id: key, ...historicoData[key] };
        });

        acervoHistoricoGlobalSaaS.sort((a, b) => (b.dataHomologacao || 0) - (a.dataHomologacao || 0));

        popularFiltrosHistoricoSaaS();
        renderizarTabelaHistoricoSaaS();

    } catch (err) {
        console.error("❌ Erro ao carregar histórico:", err);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px; color: #ef4444;">Erro de conexão ao carregar os dados.</td></tr>';
    }
}

function popularFiltrosHistoricoSaaS() {
    const selAno = document.getElementById('filtro-historico-ano');
    const selCategoria = document.getElementById('filtro-historico-categoria');
    
    if (!selAno || !selCategoria) return;

    const anos = new Set();
    const categorias = new Set();

    acervoHistoricoGlobalSaaS.forEach(edicao => {
        if (edicao.dataHomologacao) {
            anos.add(new Date(edicao.dataHomologacao).getFullYear());
        }
        if (edicao.classificacaoFinal) {
            Object.keys(edicao.classificacaoFinal).forEach(cat => categorias.add(cat));
        }
    });

    let htmlAno = '<option value="todos">Ano: Todos</option>';
    Array.from(anos).sort((a, b) => b - a).forEach(ano => {
        htmlAno += `<option value="${ano}">${ano}</option>`;
    });
    selAno.innerHTML = htmlAno;

    let htmlCat = '<option value="todas">Categoria: Todas</option>';
    Array.from(categorias).sort().forEach(cat => {
        let labelVisivel = cat.replace('CLASSE_', 'Classe ').replace('_', ' ');
        labelVisivel = labelVisivel.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
        htmlCat += `<option value="${cat}">${labelVisivel}</option>`;
    });
    selCategoria.innerHTML = htmlCat;
}

function filtrarHistoricoSaaS() {
    renderizarTabelaHistoricoSaaS();
}

function renderizarTabelaHistoricoSaaS() {
    const tbody = document.getElementById('tbody-historico-torneios');
    if (!tbody) return;

    const selAno = document.getElementById('filtro-historico-ano');
    const selModelo = document.getElementById('filtro-historico-modelo');
    const selCategoria = document.getElementById('filtro-historico-categoria');

    const filtroAno = selAno ? selAno.value : 'todos';
    const filtroModelo = selModelo ? selModelo.value : 'todos';
    const filtroCategoria = selCategoria ? selCategoria.value : 'todas';

    const listaFiltrada = acervoHistoricoGlobalSaaS.filter(edicao => {
        if (filtroAno !== 'todos') {
            const anoEdicao = edicao.dataHomologacao ? new Date(edicao.dataHomologacao).getFullYear().toString() : '';
            if (anoEdicao !== filtroAno) return false;
        }

        if (filtroModelo !== 'todos' && edicao.modelo !== filtroModelo) {
            return false;
        }

        if (filtroCategoria !== 'todas') {
            if (!edicao.classificacaoFinal || !edicao.classificacaoFinal[filtroCategoria]) {
                return false;
            }
        }

        return true;
    });

    if (listaFiltrada.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 30px; color: #64748b;">Nenhum torneio encontrado com estes filtros.</td></tr>';
        return;
    }

    let html = '';
    const fmtDataCurta = (str) => {
        if(!str) return '--/--';
        const p = str.split('-');
        if(p.length === 3) return `${p[2]}/${p[1]}`;
        return str;
    };

    const iconesModelos = {
        piramide: { icone: 'account_tree', label: 'Pirâmide' },
        barragem: { icone: 'leaderboard', label: 'Barragem' },
        grupos: { icone: 'grid_view', label: 'Grupos' }
    };

    listaFiltrada.forEach(edicao => {
        const cal = edicao.contrato || {};
        const modeloInfo = iconesModelos[edicao.modelo] || { icone: 'emoji_events', label: 'Oficial' };
        const dtInicio = fmtDataCurta(cal.inicioJogos);
        const dtFim = fmtDataCurta(cal.fimTorneio); 
        
        const btnPdf = cal.regulamentoUrl 
            ? `<a href="${cal.regulamentoUrl}" target="_blank" class="pdf-link-inline" title="Ver Regulamento PDF"><i class="material-icons" style="font-size: 14px;">picture_as_pdf</i></a>`
            : `<a href="#" class="pdf-link-inline" title="Sem PDF anexado" onclick="event.preventDefault(); showToast('Nenhum regulamento em PDF anexado para esta edição.', 'info');"><i class="material-icons" style="font-size: 14px;">picture_as_pdf</i></a>`;
        html += `
            <tr>
                <td class="col-edicao">
                    <strong style="color: #1e293b; font-size: 14px;">${cal.nomeTorneio || 'Edição Sem Nome'}</strong>
                    ${btnPdf}
                </td>
                <td class="col-modelo">
                    <span class="format-badge" onclick="showToast('Abertura da árvore/chave em desenvolvimento.', 'info')">
                        <i class="material-icons" style="font-size: 14px;">${modeloInfo.icone}</i> ${modeloInfo.label}
                    </span>
                </td>
                <td class="col-periodo"><strong style="color: #475569;">${dtInicio} a ${dtFim}</strong></td>
                <td class="col-classificacao">
                    <button class="btn-col-action green" onclick="abrirPodioAcervoSaaS('${edicao.id}')">
                        <i class="material-icons" style="font-size: 16px;">emoji_events</i> Tabelas
                    </button>
                </td>
                <td class="col-resultados">
                    <button class="btn-col-action purple" onclick="abrirSumulasAcervoSaaS('${edicao.id}')">
                        <i class="material-icons" style="font-size: 16px;">fact_check</i> Súmulas
                    </button>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

function abrirPodioAcervoSaaS(idEdicao) {
    const edicao = acervoHistoricoGlobalSaaS.find(e => e.id === idEdicao);
    if (!edicao || !edicao.classificacaoFinal) {
        showToast("Dados do pódio indisponíveis para esta edição.", "warning");
        return;
    }

    edicaoHistoricaFocoSaaS = edicao;
    const categorias = Object.keys(edicao.classificacaoFinal);
    
    if (categorias.length === 0) {
        showToast("Nenhuma categoria homologada nesta edição.", "warning");
        return;
    }

    categoriaHistoricaAtivaSaaS = categorias.sort()[0];

    const sheet = document.getElementById('sheet-leaderboard-ranking');
    const containerAbas = document.getElementById('btn-tab-torneio-saas') ? document.getElementById('btn-tab-torneio-saas').parentElement : null;
    const selectClasse = document.getElementById('select-leaderboard-classe');
    const selectGenero = document.getElementById('select-leaderboard-genero');
    const containerDropdowns = document.querySelector('#sheet-leaderboard-ranking .dropdowns-leaderboard-container');

    if (containerAbas) containerAbas.style.display = 'none';
    if (selectClasse) selectClasse.style.display = 'none';
    if (selectGenero) selectGenero.style.display = 'none';
    if (containerDropdowns) containerDropdowns.style.display = 'none';

    if (sheet && !listenerGavetaHistoricoAdd) {
        sheet.addEventListener('transitionend', () => {
            if (!sheet.classList.contains('ativa')) {
                if (containerAbas) containerAbas.style.display = '';
                if (selectClasse) selectClasse.style.display = '';
                if (selectGenero) selectGenero.style.display = '';
                if (containerDropdowns) containerDropdowns.style.display = '';
            }
        });
        listenerGavetaHistoricoAdd = true;
    }

    renderizarHTMLPodioAcervoSaaS();

    if (sheet) {
        sheet.style.display = 'flex';
        setTimeout(() => sheet.classList.add('ativa'), 10);
    }
}

function mudarCategoriaHistoricaSaaS(novaCat) {
    categoriaHistoricaAtivaSaaS = novaCat;
    renderizarHTMLPodioAcervoSaaS();
}

function renderizarHTMLPodioAcervoSaaS() {
    const bodyList = document.getElementById('body-leaderboard-scroll');
    const txtSub = document.getElementById('txt-subtitulo-leaderboard');
    if (!bodyList || !edicaoHistoricaFocoSaaS) return;

    const edicao = edicaoHistoricaFocoSaaS;
    const cal = edicao.contrato || {};
    const categorias = Object.keys(edicao.classificacaoFinal);
    const listaIDs = edicao.classificacaoFinal[categoriaHistoricaAtivaSaaS] || [];
    
    if (txtSub) {
        txtSub.innerHTML = `<b>🏆 Hall de Campeões</b> • ${cal.nomeTorneio || 'Torneio'} <span style="display:inline-block; background:#f1f5f9; color:#475569; font-size:10px; font-weight:800; padding:2px 8px; border-radius:10px; margin-left:4px; border:1px solid #cbd5e1;">[Acervo Histórico]</span>`;
    }

    let html = '';

    if (categorias.length > 1) {
        html += `<div style="margin-bottom: 16px; display: flex; gap: 8px; overflow-x: auto; padding-bottom: 8px; border-bottom: 1px solid #f1f5f9;">`;
        categorias.sort().forEach(cat => {
            const ativa = (cat === categoriaHistoricaAtivaSaaS);
            let label = cat.replace('CLASSE_', 'Classe ').replace('_', ' ');
            label = label.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
            
            html += `
                <button onclick="mudarCategoriaHistoricaSaaS('${cat}')" style="white-space: nowrap; padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 700; border: 1px solid ${ativa ? '#8b5cf6' : '#cbd5e1'}; background: ${ativa ? '#8b5cf6' : '#f8fafc'}; color: ${ativa ? '#fff' : '#475569'}; cursor: pointer; transition: all 0.2s;">
                    ${label}
                </button>
            `;
        });
        html += `</div>`;
    }

    if (listaIDs.length === 0) {
        html += '<p style="text-align: center; color: #94a3b8; margin-top: 40px;">Nenhum atleta homologado nesta categoria.</p>';
        bodyList.innerHTML = html;
        return;
    }

    const idLogado = localStorage.getItem('jogadorLogadoId');
    const idCampeao = listaIDs[0];
    const idVice = listaIDs[1];
    const idTerceiro = listaIDs[2];

    const buscarNome = (id) => {
        const j = (typeof jogadoresGlobal !== 'undefined' && jogadoresGlobal[id]) ? jogadoresGlobal[id] : {};
        const nomeStr = j.nomeCompleto || j.apelido || 'Atleta';
        return nomeStr.split(' ').map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ');
    };

    const rotulosBadges = { piramide: "1º LUGAR • PIRÂMIDE", barragem: "1º LUGAR • BARRAGEM", grupos: "1º LUGAR • GRUPOS" };
    const txtBadgeCampeao = rotulosBadges[edicao.modelo] || "1º LUGAR • CAMPEÃO";

    html += `
        <div style="background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%); border: 2px solid #f59e0b; border-radius: 16px; padding: 14px; text-align: center; box-shadow: 0 10px 15px -3px rgba(245, 158, 11, 0.2); margin-bottom: 12px;">
            <div style="font-size: 28px; margin-bottom: -4px;">👑</div>
            <span style="background: #f59e0b; color: #ffffff; font-size: 10px; font-weight: 900; padding: 2px 8px; border-radius: 10px; display: inline-block;">${txtBadgeCampeao}</span>
            <div style="font-size: 16px; font-weight: 800; color: #78350f; margin: 4px 0;">${buscarNome(idCampeao)} ${idCampeao === idLogado ? '(Você)' : ''}</div>
            <div style="font-size: 11.5px; color: #92400e; font-weight: 600;">Campeão do Torneio</div>
        </div>
        <div style="display: flex; flex-direction: column; gap: 8px;">
    `;

    if (idVice) {
        html += `
            <div style="background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 12px; padding: 10px 14px; display: flex; align-items: center; justify-content: space-between;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-weight: 800; font-size: 13px; width: 26px; color: #475569;">2º</span>
                    <div>
                        <strong style="font-size: 13px; font-weight: 700; color: #1e293b; display: block;">${buscarNome(idVice)} ${idVice === idLogado ? '(Você)' : ''}</strong>
                        <span style="font-size: 11px; color: #64748b;">Vice-Campeão do Torneio</span>
                    </div>
                </div>
            </div>
        `;
    }

    if (idTerceiro) {
        html += `
            <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 12px; padding: 10px 14px; display: flex; align-items: center; justify-content: space-between;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-weight: 800; font-size: 13px; width: 26px; color: #c2410c;">3º</span>
                    <div>
                        <strong style="font-size: 13px; font-weight: 700; color: #1e293b; display: block;">${buscarNome(idTerceiro)} ${idTerceiro === idLogado ? '(Você)' : ''}</strong>
                        <span style="font-size: 11px; color: #64748b;">3ª Posição Final</span>
                    </div>
                </div>
            </div>
        `;
    }
    html += `</div>`;

    if (listaIDs.length > 3) {
        html += `<div id="box-restante-hall" style="display: none; margin-top: 8px; flex-direction: column; gap: 8px;">`;
        for (let i = 3; i < listaIDs.length; i++) {
            const idOutro = listaIDs[i];
            html += `
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px 14px; display: flex; align-items: center; justify-content: space-between;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-weight: 800; font-size: 13px; width: 26px; color: #64748b;">${i + 1}º</span>
                        <div>
                            <strong style="font-size: 13px; font-weight: 700; color: #1e293b; display: block;">${buscarNome(idOutro)} ${idOutro === idLogado ? '(Você)' : ''}</strong>
                        </div>
                    </div>
                </div>
            `;
        }
        html += `</div>`;
    }

    html += `
        <div style="display: flex; gap: 8px; align-items: center; margin-top: 10px;">
    `;

    if (listaIDs.length > 3) {
        html += `
            <button type="button" id="btn-sanfona-hall" onclick="toggleSanfonaHallCampeoesSaaS(${listaIDs.length})" style="flex: 1; background: #f1f5f9; border: 1px dashed #cbd5e1; padding: 10px; border-radius: 12px; color: #0284c7; font-weight: 700; font-size: 12.5px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;">
                <span>Ver Classificação Completa (${listaIDs.length} atletas)</span> 🔽
            </button>
        `;
    }

    html += `
            <button type="button" onclick="exportarLeaderboardPDFSaaS()" title="Exportar PDF" style="width: 44px; height: 42px; background: #0284c7; border: none; border-radius: 12px; color: #ffffff; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(2, 132, 199, 0.25); flex-shrink: 0; margin-left: ${listaIDs.length <= 3 ? 'auto' : '0'};">
                <i class="material-icons" style="font-size: 20px;">picture_as_pdf</i>
            </button>
        </div>
    `;

    bodyList.innerHTML = html;
}

function abrirSumulasAcervoSaaS(idEdicao) {
    const edicao = acervoHistoricoGlobalSaaS.find(e => e.id === idEdicao);
    if (!edicao) {
        showToast("Dados da edição não encontrados.", "warning");
        return; 
    }

    edicaoHistoricaFocoSaaS = edicao;

    const partidasObj = edicao.partidas || {};
    const listaPartidas = Object.values(partidasObj);

    if (listaPartidas.length === 0) {
        showToast("Nenhuma súmula cadastrada para esta edição.", "info");
        return;
    }

    const sheet = document.getElementById('sheet-leaderboard-ranking');
    const bodyList = document.getElementById('body-leaderboard-scroll');
    const txtSub = document.getElementById('txt-subtitulo-leaderboard');
    
    const containerAbas = document.getElementById('btn-tab-torneio-saas') ? document.getElementById('btn-tab-torneio-saas').parentElement : null;
    const selectClasse = document.getElementById('select-leaderboard-classe');
    const selectGenero = document.getElementById('select-leaderboard-genero');
    const containerDropdowns = document.querySelector('#sheet-leaderboard-ranking .dropdowns-leaderboard-container');

    if (containerAbas) containerAbas.style.display = 'none';
    if (selectClasse) selectClasse.style.display = 'none';
    if (selectGenero) selectGenero.style.display = 'none';
    if (containerDropdowns) containerDropdowns.style.display = 'none';

    if (sheet && !listenerGavetaHistoricoAdd) {
        sheet.addEventListener('transitionend', () => {
            if (!sheet.classList.contains('ativa')) {
                if (containerAbas) containerAbas.style.display = '';
                if (selectClasse) selectClasse.style.display = '';
                if (selectGenero) selectGenero.style.display = '';
                if (containerDropdowns) containerDropdowns.style.display = '';
            }
        });
        listenerGavetaHistoricoAdd = true;
    }

    const cal = edicao.contrato || {};
    const fmtDataCurta = (str) => {
        if (!str) return '--/--';
        const p = str.split('-');
        if (p.length === 3) return `${p[2]}/${p[1]}`;
        return str;
    };
    const dtInicio = fmtDataCurta(cal.inicioJogos);
    const dtFim = fmtDataCurta(cal.fimTorneio);

    if (txtSub) {
        txtSub.innerHTML = `<span style="font-weight: 700; color: #1e293b;">${cal.nomeTorneio || 'Torneio'}</span> <span style="display:inline-block; background:#f1f5f9; color:#475569; font-size:11px; font-weight:700; padding:2px 8px; border-radius:12px; margin-left:6px; border:1px solid #cbd5e1;">${dtInicio} a ${dtFim}</span>`;
        txtSub.style.marginBottom = "0px";
    }

    const buscarNome = (id) => {
        const j = (typeof jogadoresGlobal !== 'undefined' && jogadoresGlobal[id]) ? jogadoresGlobal[id] : {};
        const nomeStr = j.nomeCompleto || j.apelido || 'Atleta';
        return nomeStr.split(' ').map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ');
    };

    const formatarNomeCurto = (nomeBruto) => {
        if (!nomeBruto) return "";
        const palavras = nomeBruto.trim().toLowerCase().split(/\s+/).map(p => {
            if (['da', 'de', 'do', 'dos', 'das'].includes(p)) return p;
            return p.charAt(0).toUpperCase() + p.slice(1);
        });
        if (palavras.length > 2) {
            let res = palavras[0];
            for (let i = 1; i < palavras.length - 1; i++) {
                if (['da', 'de', 'do', 'dos', 'das'].includes(palavras[i])) {
                    res += " " + palavras[i];
                } else {
                    res += " " + palavras[i].charAt(0).toUpperCase() + ".";
                }
            }
            res += " " + palavras[palavras.length - 1];
            return res;
        }
        return palavras.join(' ');
    };

    const fmtSet = (pts, tb) => {
        if (pts === undefined || pts === null || pts === "") return '-';
        if (tb !== undefined && tb !== null && tb !== "") return `${pts}<sup>${tb}</sup>`;
        return pts;
    };

    let htmlCardsMain = '';
    let htmlCardsExtra = '';

    listaPartidas.forEach((partida, idx) => {
        const j1NomeLongo = buscarNome(partida.jogador1Id);
        const j2NomeLongo = buscarNome(partida.jogador2Id);
        const j1Exibicao = formatarNomeCurto(j1NomeLongo);
        const j2Exibicao = formatarNomeCurto(j2NomeLongo);

        const catKey = partida.categoria || '';
        let catLabel = catKey.replace('CLASSE_', 'Classe ').replace('_', ' ');
        catLabel = catLabel.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');

        const dp = partida.dadosPlacar || {};
        const dataMs = partida.dataHora || dp.dataHoraLancamento || dp.dataHoraValidacao || dp.dataHoraArbitragem;
        let dataPartidaStr = '--/--/----';
        if (dataMs) {
            const d = new Date(dataMs);
            if (!isNaN(d.getTime())) {
                dataPartidaStr = d.toLocaleDateString('pt-BR');
            }
        } else if (partida.dataCompleta) {
            const p = partida.dataCompleta.split('-');
            if (p.length === 3) dataPartidaStr = `${p[2]}/${p[1]}/${p[0]}`;
        }

        const stPlacar = dp.statusPlacar || partida.status || 'consolidado';
        const decisaoArb = dp.decisaoArbitro || '';
        const isWO = !!dp.isWO || (dp.placarFormatado && dp.placarFormatado.includes("W.O."));
        const isRET = !!dp.isRET || (dp.placarFormatado && dp.placarFormatado.includes("RET"));

        let badgeHtml = '';
        let footerArbHtml = '';

        if (stPlacar === 'anulado' || decisaoArb === 'anulado_pelo_arbitro') {
            badgeHtml = `<span style="font-size: 10px; color: #dc2626; font-weight: 700;"><span style="margin-right: 2px;">🔴</span> Arbitrado</span>`;
            const juizNome = dp.arbitroResponsavel ? formatarNomeCurto(dp.arbitroResponsavel) : 'Árbitro';
            const motivoAnul = dp.motivoAnulacao || 'partida inválida.';
            footerArbHtml = `<div style="text-align: center; font-style: italic; color: #dc2626; font-size: 11px; margin-top: 1px; margin-bottom: 0px; line-height: 1.1;">Anulada por ${juizNome}: "${motivoAnul}"</div>`;
        } else if (decisaoArb === 'editado_pelo_arbitro') {
            badgeHtml = `<span style="font-size: 10px; color: #d97706; font-weight: 700;"><span style="margin-right: 2px;">🟠</span> Arbitrado</span>`;
            const juizNome = dp.arbitroResponsavel ? formatarNomeCurto(dp.arbitroResponsavel) : 'Árbitro';
            footerArbHtml = `<div style="text-align: center; font-style: italic; color: #d97706; font-size: 11px; margin-top: 1px; margin-bottom: 0px; line-height: 1.1;">Editado pela arbitragem: ${juizNome}</div>`;
        } else if (decisaoArb === 'mantido_pelo_arbitro') {
            badgeHtml = `<span style="font-size: 10px; color: #16a34a; font-weight: 700;"><span style="margin-right: 2px;">🟢</span> Arbitrado</span>`;
            const juizNome = dp.arbitroResponsavel ? formatarNomeCurto(dp.arbitroResponsavel) : 'Árbitro';
            footerArbHtml = `<div style="text-align: center; font-style: italic; color: #16a34a; font-size: 11px; margin-top: 1px; margin-bottom: 0px; line-height: 1.1;">Homologado pela arbitragem: ${juizNome}</div>`;
        } else {
            badgeHtml = `<span style="font-size: 10px; color: #16a34a; font-weight: 700;">✓ Homologado</span>`;
        }

        const norm = s => (s||"").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
        const vencedorOficial = norm(dp.vencedor || "");
        const ehAnulado = (stPlacar === 'anulado' || decisaoArb === 'anulado_pelo_arbitro');
        
        const j1EhVencedor = !ehAnulado && ((partida.vencedorId === partida.jogador1Id) || (dp.vencedorCodigo === 'J1') || (vencedorOficial === norm(j1NomeLongo)));

        let classNomeJ1 = (j1EhVencedor && !ehAnulado) ? 'match-winner' : '';
        let classNomeJ2 = (!j1EhVencedor && !ehAnulado) ? 'match-winner' : '';
        let setaJ1 = (j1EhVencedor && !ehAnulado) ? '<div class="winner-arrow">◀</div>' : '';
        let setaJ2 = (!j1EhVencedor && !ehAnulado) ? '<div class="winner-arrow">◀</div>' : ''; 

        let cardSingle = `
            <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 10px; padding: 6px 10px 4px 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px; border-bottom: 1px solid #f1f5f9; padding-bottom: 3px;">
                    <div style="display: flex; align-items: center; gap: 4px;">
                        <span style="font-size: 10px; font-weight: 700; color: #8b5cf6; background: #f5f3ff; padding: 2px 6px; border-radius: 6px; border: 1px solid #ddd6fe;">
                            ${catLabel || 'Oficial'}
                        </span>
                        <span style="font-size: 10px; font-weight: 700; color: #475569; background: #f1f5f9; padding: 2px 6px; border-radius: 6px; border: 1px solid #cbd5e1; display: inline-flex; align-items: center; gap: 3px;">
                            <i class="material-icons" style="font-size: 11px;">event</i> ${dataPartidaStr}
                        </span>
                    </div>
                    ${badgeHtml}
                </div>
        `;

        if (isWO) {
            cardSingle += `
                <table class="atp-table" style="margin-bottom: 0px;">
                    <tbody>
                        <tr>
                            <td><span class="atp-name ${j1EhVencedor ? 'match-winner' : ''}">${j1Exibicao}</span></td>
                            <td style="text-align: right; font-weight: 800; font-size: 15px; color: #1e293b; padding-right: 12px;">${j1EhVencedor ? 'W.O.' : ''}</td>
                        </tr>
                        <tr>
                            <td><span class="atp-name ${!j1EhVencedor ? 'match-winner' : ''}">${j2Exibicao}</span></td>
                            <td style="text-align: right; font-weight: 800; font-size: 15px; color: #1e293b; padding-right: 12px;">${!j1EhVencedor ? 'W.O.' : ''}</td>
                        </tr>
                    </tbody>
                </table>
                <div style="text-align: center; font-style: italic; color: #64748b; font-size: 11.5px; margin-top: 1px; margin-bottom: 0px; line-height: 1.1;">
                    Motivo: ${dp.motivoWO || 'Não informado'}
                </div>
            `;
        } else if (dp.parciais) {
            const tagRetJ1 = (isRET && dp.desistenteCodigo === 'J1') ? '<span class="badge-ret" style="margin-left: 6px;">RET</span>' : '';
            const tagRetJ2 = (isRET && dp.desistenteCodigo === 'J2') ? '<span class="badge-ret" style="margin-left: 6px;">RET</span>' : '';

            const p = dp.parciais || {};
            const temSet1 = (p.set1 && p.set1.j1 !== undefined && p.set1.j1 !== null && p.set1.j1 !== "");
            const temSet2 = (p.set2 && p.set2.j1 !== undefined && p.set2.j1 !== null && p.set2.j1 !== "");
            const temSet3 = (p.set3 && p.set3.j1 !== undefined && p.set3.j1 !== null && p.set3.j1 !== "");

            let tdSetsJ1Html = '';
            let tdSetsJ2Html = '';

            if (temSet1) {
                tdSetsJ1Html += `<td class="col-score atp-score ${classNomeJ1}">${fmtSet(p.set1.j1, p.set1.tbJ1)}</td>`;
                tdSetsJ2Html += `<td class="col-score atp-score ${classNomeJ2}">${fmtSet(p.set1.j2, p.set1.tbJ2)}</td>`;
            }
            if (temSet2) {
                tdSetsJ1Html += `<td class="col-score atp-score ${classNomeJ1}">${fmtSet(p.set2.j1, p.set2.tbJ1)}</td>`;
                tdSetsJ2Html += `<td class="col-score atp-score ${classNomeJ2}">${fmtSet(p.set2.j2, p.set2.tbJ2)}</td>`;
            }
            if (temSet3) {
                tdSetsJ1Html += `<td class="col-score atp-score ${classNomeJ1}">${fmtSet(p.set3.j1, p.set3.tbJ1)}</td>`;
                tdSetsJ2Html += `<td class="col-score atp-score ${classNomeJ2}">${fmtSet(p.set3.j2, p.set3.tbJ2)}</td>`;
            }

            cardSingle += `
                <table class="atp-table" style="margin-bottom: 0px;">
                    <tbody>
                        <tr><td><span class="atp-name ${classNomeJ1}">${j1Exibicao}</span>${tagRetJ1}</td>${tdSetsJ1Html}<td class="col-arrow">${setaJ1}</td></tr>
                        <tr><td><span class="atp-name ${classNomeJ2}">${j2Exibicao}</span>${tagRetJ2}</td>${tdSetsJ2Html}<td class="col-arrow">${setaJ2}</td></tr>
                    </tbody>
                </table>
            `;

            if (isRET && dp.motivoRET) {
                cardSingle += `
                    <div style="text-align: center; font-style: italic; color: #64748b; font-size: 11.5px; margin-top: 1px; margin-bottom: 0px; line-height: 1.1;">
                        Motivo: ${dp.motivoRET}
                    </div>
                `;
            }
        } else {
            cardSingle += `
                <table class="atp-table" style="margin-bottom: 0px;">
                    <tbody>
                        <tr><td><span class="atp-name ${j1EhVencedor ? 'match-winner' : ''}">${j1Exibicao}</span></td><td class="col-score atp-score ${j1EhVencedor ? 'set-winner' : ''}">${partida.gamesP1 || 0}</td><td class="col-arrow">${setaJ1}</td></tr>
                        <tr><td><span class="atp-name ${!j1EhVencedor ? 'match-winner' : ''}">${j2Exibicao}</span></td><td class="col-score atp-score ${!j1EhVencedor ? 'set-winner' : ''}">${partida.gamesP2 || 0}</td><td class="col-arrow">${setaJ2}</td></tr>
                    </tbody>
                </table>
            `;
        }

        if (footerArbHtml) cardSingle += footerArbHtml; 

        cardSingle += `</div>`;

        if (idx < 2) {
            htmlCardsMain += cardSingle;
        } else {
            htmlCardsExtra += cardSingle;
        }
    });

    let html = `
        <style>
            #sheet-leaderboard-ranking .bottom-sheet-header { padding-top: 12px !important; padding-bottom: 6px !important; }
        </style>
        <div style="margin-top: 0px; margin-bottom: 8px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 6px 8px; font-size: 11.5px; color: #64748b; text-align: center;">
            📋 Total de <b>${listaPartidas.length} partida(s)</b> homologada(s).
        </div>
        
        <div style="display: flex; flex-direction: column; gap: 8px;">
            ${htmlCardsMain}
        </div>
    `;

    if (htmlCardsExtra) {
        html += `
            <div id="box-restante-sumulas-acervo" style="display: none; flex-direction: column; gap: 8px; margin-top: 8px;">
                ${htmlCardsExtra}
            </div>
        `;
    }

    const txtSumi = listaPartidas.length === 1 ? 'súmula' : 'súmulas';
    const temMaisDeDuas = listaPartidas.length > 2;

    html += `
        <div style="display: flex; gap: 8px; align-items: center; margin-top: 8px;">
    `;

    if (temMaisDeDuas) {
        html += `
            <button type="button" id="btn-sanfona-sumulas-acervo" onclick="toggleSanfonaSumulasAcervoSaaS(${listaPartidas.length})" style="flex: 1; background: #f1f5f9; border: 1px dashed #cbd5e1; padding: 10px; border-radius: 10px; color: #0284c7; font-weight: 700; font-size: 12.5px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;">
                <span>Ver todas as súmulas (${listaPartidas.length} ${txtSumi}) 🔽</span>
            </button>
        `;
    } else {
        html += `
            <div style="flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px; border-radius: 10px; color: #64748b; font-weight: 700; font-size: 12px; text-align: center;">
                📋 Exibindo ${listaPartidas.length} ${txtSumi}
            </div>
        `;
    }

    html += `
            <button type="button" onclick="exportarSumulasPDFSaaS()" title="Exportar PDF" style="width: 42px; height: 40px; background: #0284c7; border: none; border-radius: 10px; color: #ffffff; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(2, 132, 199, 0.25); flex-shrink: 0;">
                <i class="material-icons" style="font-size: 18px;">picture_as_pdf</i>
            </button>
        </div>
    `;

    bodyList.innerHTML = html;

    if (sheet) {
        sheet.style.display = 'flex';
        setTimeout(() => sheet.classList.add('ativa'), 10);
    }
}

function toggleSanfonaSumulasAcervoSaaS(total) {
    if (navigator.vibrate) navigator.vibrate(15);
    
    const boxResto = document.getElementById('box-restante-sumulas-acervo');
    const btn = document.getElementById('btn-sanfona-sumulas-acervo');
    if (!boxResto || !btn) return;

    const spanTxt = btn.querySelector('span');

    if (boxResto.style.display === 'none' || !boxResto.style.display) {
        boxResto.style.display = 'flex';
        if (spanTxt) spanTxt.textContent = 'Recolher súmulas 🔼';
        
        setTimeout(() => {
            btn.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }, 50);
    } else {
        boxResto.style.display = 'none';
        const txtSumi = total === 1 ? 'súmula' : 'súmulas';
        if (spanTxt) spanTxt.textContent = `Ver todas as súmulas (${total} ${txtSumi}) 🔽`;
    }
}

/* ======================================================== */
/* 4. EXPORTAÇÃO VETORIAL DE RELATÓRIOS PDF (JSPDF)         */
/* ======================================================== */

async function exportarLeaderboardPDFSaaS() {
    if (navigator.vibrate) navigator.vibrate(30);
    
    const sheetLeaderboard = document.getElementById('sheet-leaderboard-ranking');
    const ehHistorico = !!(edicaoHistoricaFocoSaaS && sheetLeaderboard && sheetLeaderboard.classList.contains('ativa'));

    showToast(ehHistorico ? "Gerando PDF do Acervo Histórico..." : "Gerando PDF do Torneio Atual...", "info");

    const limparTextoPdf = (txt) => {
        if (!txt) return '';
        return txt.replace(/[•—–]/g, '-')
                  .replace(/[^\x20-\x7E\xA0-\xFF]/g, '')
                  .replace(/\s+/g, ' ')
                  .trim();
    };

    if (typeof window.jspdf === 'undefined' && typeof window.jsPDF === 'undefined') {
        await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    const { jsPDF } = window.jspdf || { jsPDF: window.jsPDF };
    if (!jsPDF) {
        showToast("Erro ao carregar o motor de PDF.", "error");
        return;
    }

    if (ehHistorico) {
        if (typeof renderizarHTMLPodioAcervoSaaS === 'function') {
            renderizarHTMLPodioAcervoSaaS();
        }
    } else {
        if (typeof renderizarLeaderboardSaaS === 'function') {
            await renderizarLeaderboardSaaS();
        }
    }

    const bodyLeaderboard = document.getElementById('body-leaderboard-scroll');
    const txtSub = document.getElementById('txt-subtitulo-leaderboard');
    const elNomeClube = document.getElementById('txt-nome-clube');

    if (!bodyLeaderboard || !bodyLeaderboard.innerHTML.trim() || bodyLeaderboard.innerText.includes("Nenhum torneio")) {
        showToast("Erro ao localizar o conteúdo da classificação para exportação.", "error");
        return;
    }

    let nomeClubeRaw = elNomeClube ? elNomeClube.textContent.trim() : '';
    if (!nomeClubeRaw || nomeClubeRaw.toUpperCase() === 'CARREGANDO...') {
        nomeClubeRaw = localStorage.getItem('setpoint_jogador_clube_nome') || clubeAtivoId || 'CLUBE';
    }
    const nomeClube = limparTextoPdf(nomeClubeRaw.toUpperCase());
    const dataHojeStr = new Date().toLocaleDateString('pt-BR');

    let linha2TorneioCategoria = "";
    let linha3Subtitulo = "";
    let tipoModelo = 'piramide';
    const leaderboardItems = [];
    const mataMataItems = [];
    const grupoItems = [];

    if (ehHistorico) {
        const cal = edicaoHistoricaFocoSaaS.contrato || {};
        const nomeTorneio = limparTextoPdf(cal.nomeTorneio || 'Torneio');
        let catLabel = (categoriaHistoricaAtivaSaaS || '').replace('CLASSE_', 'Classe ').replace('_', ' ');
        catLabel = limparTextoPdf(catLabel.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' '));

        linha2TorneioCategoria = `${nomeTorneio} - ${catLabel}`;
        linha3Subtitulo = "Hall de Campeões [Acervo Histórico]";

        const listaIDs = (edicaoHistoricaFocoSaaS.classificacaoFinal && edicaoHistoricaFocoSaaS.classificacaoFinal[categoriaHistoricaAtivaSaaS]) || [];
        const capitalizar = (str) => {
            if (!str) return '';
            return str.split(' ').map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ');
        };

        const idLogado = localStorage.getItem('jogadorLogadoId');

        listaIDs.forEach((idAtleta, idx) => {
            const j = (typeof jogadoresGlobal !== 'undefined' && jogadoresGlobal[idAtleta]) ? jogadoresGlobal[idAtleta] : {};
            const nomeStr = limparTextoPdf(capitalizar(j.nomeCompleto || j.apelido || 'Atleta'));
            const pos = `${idx + 1}º`;
            let sub = '';
            if (idx === 0) sub = 'Campeão do Torneio';
            else if (idx === 1) sub = 'Vice-Campeão do Torneio';
            else if (idx === 2) sub = '3ª Posição Final';

            leaderboardItems.push({ pos, nome: nomeStr, sub, ehVoce: idAtleta === idLogado });
        });
    } else {
        const conf = (configRegrasGlobal && configRegrasGlobal.ranking) ? configRegrasGlobal.ranking : {};
        const cal = conf.calendario || {};
        const nomeTorneio = limparTextoPdf(cal.nomeTorneio || 'Torneio Oficial');

        const selClasse = document.getElementById('select-leaderboard-classe');
        const selGenero = document.getElementById('select-leaderboard-genero');
        const selFase = document.getElementById('select-leaderboard-fase');

        const txtClasse = selClasse ? `Classe ${selClasse.value}` : '';
        const txtGenero = (selGenero && selGenero.value !== 'UNIFICADO') ? selGenero.value : '';
        const txtFase = selFase ? (selFase.options[selFase.selectedIndex]?.text || '') : '';

        const categoriaAtivaTxt = limparTextoPdf([txtClasse, txtGenero, txtFase].filter(Boolean).join(' - '));

        linha2TorneioCategoria = categoriaAtivaTxt ? `${nomeTorneio} - ${categoriaAtivaTxt}` : nomeTorneio;
        
        let modeloTxt = txtSub ? txtSub.innerText.replace('Ranking Oficial do Clube', '').replace('Central do Ranking', '').trim() : '';
        modeloTxt = limparTextoPdf(modeloTxt);
        linha3Subtitulo = modeloTxt ? `Tabela de Classificação - ${modeloTxt}` : "Tabela de Classificação";

        const cardsMataMataDOM = Array.from(bodyLeaderboard.querySelectorAll('div[style*="border: 1.5px solid"], div[style*="border: 2px solid"]'));
        
		if (cardsMataMataDOM.length > 0 && (abaFaseAtivaSaaS === 'MATA_MATA' || abaFaseAtivaSaaS === 'SEMI' || abaFaseAtivaSaaS === 'FINAL' || abaFaseAtivaSaaS === 'TODAS' || abaFaseAtivaSaaS === 'AUTO' || (typeof abaFaseAtivaSaaS === 'string' && abaFaseAtivaSaaS.startsWith('MM_')))) {
            cardsMataMataDOM.forEach(card => {
                const tagEl = card.querySelector('div[style*="text-transform: uppercase"]');
                const playerRows = Array.from(card.querySelectorAll('div[style*="font-size: 13.5px"], div[style*="font-size: 12px"]'));

                let placarTxt = '';
                const placarSpan = Array.from(card.querySelectorAll('span')).find(s => s.innerText && s.innerText.includes('Placar:'));
                if (placarSpan) {
                    placarTxt = limparTextoPdf(placarSpan.innerText.replace('Placar:', '').trim());
                }

                if (tagEl && playerRows.length > 0) {
                    const extrairAtleta = (rowEl) => {
                        if (!rowEl) return { nome: '', ehVencedor: false, ehCampeao: false };
                        const clone = rowEl.cloneNode(true);
                        const txtFull = clone.innerText || '';
                        const ehVencedor = txtFull.includes('Vencedor');
                        const ehCampeao = txtFull.includes('Campeão') || txtFull.includes('Campeao');

                        clone.querySelectorAll('span').forEach(sp => sp.remove());
                        let nomeLimpo = limparTextoPdf(clone.innerText.replace(/\(Você\)/gi, '').trim());

                        return { nome: nomeLimpo, ehVencedor, ehCampeao };
                    };

                    const p1 = extrairAtleta(playerRows[0]);
                    const p2 = extrairAtleta(playerRows[1]);

                    let faseTxt = limparTextoPdf(tagEl.innerText.replace(/[⚔️🏆]/g, '').trim());

                    mataMataItems.push({
                        fase: faseTxt,
                        placar: placarTxt,
                        p1Name: p1.nome,
                        p1Vencedor: p1.ehVencedor,
                        p1Campeao: p1.ehCampeao,
                        p2Name: p2.nome,
                        p2Vencedor: p2.ehVencedor,
                        p2Campeao: p2.ehCampeao
                    });
                }
            });
        }

        const cardsGruposDOM = Array.from(bodyLeaderboard.querySelectorAll('.card-leaderboard-grupo'));
        if (cardsGruposDOM.length > 0 && (abaFaseAtivaSaaS === 'GRUPOS' || abaFaseAtivaSaaS === 'TODAS' || abaFaseAtivaSaaS === 'AUTO')) {
            cardsGruposDOM.forEach(cardG => {
                const headerTxt = limparTextoPdf(cardG.querySelector('.header-leaderboard-grupo')?.innerText.replace(/\n/g, ' - ').trim() || 'GRUPO');
                const membros = Array.from(cardG.querySelectorAll('.item-membro-grupo')).map(mEl => {
					const posNomeEl = mEl.querySelector('div[style*="font-size: 13px"]');
					let pos = '', nome = '', pts = '', isClassificado = mEl.classList.contains('classificado');
					let tagTexto = '';
					if (posNomeEl) {
						const clone = posNomeEl.cloneNode(true);
						const badge = clone.querySelector('.badge-classificado');
						if (badge) {
							tagTexto = limparTextoPdf(badge.innerText.trim());
							badge.remove();
						}
						const bTag = clone.querySelector('b');
						if (bTag) { pos = limparTextoPdf(bTag.innerText); bTag.remove(); }
						nome = limparTextoPdf(clone.innerText.replace('(Você)', '').trim());
					}
					const ptsEl = mEl.querySelector('span[style*="font-size: 14px"]');
					if (ptsEl) pts = limparTextoPdf(ptsEl.innerText);

					const pills = Array.from(mEl.querySelectorAll('.micro-pill')).map(p => limparTextoPdf(p.innerText)).join(' | ');

					return { pos, nome, pts, pills, isClassificado, tagTexto };
				});
                grupoItems.push({ grupoHeader: headerTxt, membros });
            });
        }

        const rowsBarragem = Array.from(bodyLeaderboard.querySelectorAll('.tabela-leaderboard-barragem tbody tr'));
        const rowsPiramide = Array.from(bodyLeaderboard.querySelectorAll('.item-leaderboard-piramide'));

        if (rowsBarragem.length > 0 && mataMataItems.length === 0 && grupoItems.length === 0) {
            tipoModelo = 'barragem';
            rowsBarragem.forEach(tr => {
                const tds = Array.from(tr.querySelectorAll('td'));
                if (tds.length >= 7) {
                    leaderboardItems.push({
                        pos: limparTextoPdf(tds[0].innerText.trim()),
                        nome: limparTextoPdf(tds[1].innerText.trim()),
                        j: limparTextoPdf(tds[2].innerText.trim()),
                        v: limparTextoPdf(tds[3].innerText.trim()),
                        d: limparTextoPdf(tds[4].innerText.trim()),
                        sg: limparTextoPdf(tds[5].innerText.trim()),
                        pts: limparTextoPdf(tds[6].innerText.trim()),
                        ehVoce: tr.classList.contains('voce') || tr.style.background.includes('f0fdf4')
                    });
                }
            });
        } else if (rowsPiramide.length > 0 && mataMataItems.length === 0 && grupoItems.length === 0) {
            tipoModelo = 'piramide';
            rowsPiramide.forEach(itemEl => {
                const pos = limparTextoPdf(itemEl.querySelector('span[style*="font-weight: 800"]')?.innerText.trim() || '');
                const nome = limparTextoPdf(itemEl.querySelector('strong')?.innerText.trim() || '');
                const sub = limparTextoPdf(itemEl.querySelector('span[style*="font-size: 11px"]')?.innerText.trim() || '');
                leaderboardItems.push({ pos, nome, sub, ehVoce: itemEl.classList.contains('voce') });
            });
        } else if ((bodyLeaderboard.innerText.includes('Líder Homologado') || bodyLeaderboard.innerText.includes('Vice-Líder') || bodyLeaderboard.innerText.includes('Campeão do Torneio') || bodyLeaderboard.innerText.includes('Vice-Campeão') || bodyLeaderboard.innerText.includes('1º LUGAR')) && mataMataItems.length === 0 && grupoItems.length === 0) {
            tipoModelo = 'piramide';

            const card1 = bodyLeaderboard.querySelector('div[style*="fffbeb"]') || bodyLeaderboard.querySelector('div[style*="fef3c7"]');
            if (card1) {
                const nome1 = limparTextoPdf(card1.querySelector('div[style*="font-size: 16px"]')?.innerText.replace(/\(Você\)/gi, '').trim() || '');
                const sub1 = limparTextoPdf(card1.querySelector('div[style*="font-size: 11.5px"]')?.innerText.trim() || 'Líder Homologado');
                const ehVoce1 = card1.innerText.includes('(Você)');
                if (nome1) leaderboardItems.push({ pos: '1º', nome: nome1, sub: sub1, ehVoce: ehVoce1 });
            }

            const outrosCards = Array.from(bodyLeaderboard.querySelectorAll('div[style*="display: flex; align-items: center; justify-content: space-between"]'));
            outrosCards.forEach(cEl => {
                const posEl = cEl.querySelector('span[style*="font-weight: 800"]');
                const nomeEl = cEl.querySelector('strong');
                const subEl = cEl.querySelector('span[style*="font-size: 11px"]');
                if (posEl && nomeEl) {
                    const pos = limparTextoPdf(posEl.innerText.trim());
                    const nome = limparTextoPdf(nomeEl.innerText.replace(/\(Você\)/gi, '').trim());
                    const sub = limparTextoPdf(subEl ? subEl.innerText.trim() : '');
                    const ehVoce = cEl.innerText.includes('(Você)');
                    if (nome && pos !== '1º') {
                        leaderboardItems.push({ pos, nome, sub, ehVoce });
                    }
                }
            });
        }
    }

    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const pageWidth = 210;
    const pageHeight = 297;
    const marginX = 15;
    const contentWidth = pageWidth - (marginX * 2);

    let currentY = 15;

    const drawHeader = () => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.setTextColor(15, 23, 42);
        doc.text(nomeClube, marginX, currentY);

        currentY += 5;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10.5);
        doc.setTextColor(37, 99, 235);
        doc.text(linha2TorneioCategoria, marginX, currentY);

        currentY += 4.5;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(71, 85, 105);
        doc.text(linha3Subtitulo, marginX, currentY);

        doc.setFontSize(9);
        doc.setTextColor(71, 85, 105);
        doc.text(dataHojeStr, pageWidth - marginX, currentY, { align: "right" });

        currentY += 2.5;
        doc.setDrawColor(15, 23, 42);
        doc.setLineWidth(0.4);
        doc.line(marginX, currentY, pageWidth - marginX, currentY);
        currentY += 6;
    };

    const drawFooter = (finalY) => {
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.2);
        doc.line(marginX, finalY, pageWidth - marginX, finalY);

        const footerY = finalY + 4;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);
        doc.text("SetPoint SaaS", marginX, footerY);

        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 116, 139);
        doc.text(" - Relatório Oficial do Ranking", marginX + 21, footerY);
        doc.text("Documento emitido automaticamente pelo sistema.", marginX, footerY + 3.5);

        const sigWidth = 45;
        const sigX = pageWidth - marginX - sigWidth;
        doc.setDrawColor(15, 23, 42);
        doc.setLineWidth(0.3);
        doc.line(sigX, footerY + 2, pageWidth - marginX, footerY + 2);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(15, 23, 42);
        doc.text("Arbitragem / Gestão", sigX + (sigWidth / 2), footerY + 5.5, { align: "center" });
    };

    drawHeader();

    if (mataMataItems.length > 0) {
        doc.setFillColor(245, 243, 255);
        doc.setDrawColor(139, 92, 246);
        doc.setLineWidth(0.3);
        doc.roundedRect(marginX, currentY, contentWidth, 6.5, 1, 1, "FD");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(139, 92, 246);
        doc.text("QUADRO ELIMINATÓRIO (MATA-MATA)", marginX + 4, currentY + 4.5);
        currentY += 9;

        mataMataItems.forEach(item => {
            const boxH = 17;
            if (currentY + boxH > pageHeight - 20) { doc.addPage(); currentY = 15; }

            doc.setDrawColor(203, 213, 225);
            doc.setFillColor(255, 255, 255);
            doc.setLineWidth(0.2);
            doc.roundedRect(marginX, currentY, contentWidth, boxH, 2, 2, "FD");

            doc.setFont("helvetica", "bold");
            doc.setFontSize(8);
            doc.setTextColor(139, 92, 246);
            doc.text(item.fase, marginX + 4, currentY + 4.5);

            if (item.placar) {
                const txtPlacar = `Placar: ${item.placar}`;
                doc.setFont("helvetica", "bold");
                doc.setFontSize(7.5);
                const pW = doc.getTextWidth(txtPlacar) + 4;
                const pX = marginX + contentWidth - 4 - pW;

                doc.setFillColor(220, 252, 231);
                doc.setDrawColor(134, 239, 172);
                doc.setLineWidth(0.15);
                doc.roundedRect(pX, currentY + 1.5, pW, 4.2, 1, 1, "FD");

                doc.setTextColor(22, 163, 74);
                doc.text(txtPlacar, pX + 2, currentY + 4.4);
            }

            let row1Y = currentY + 9.5;
            doc.setFont("helvetica", item.p1Vencedor || item.p1Campeao ? "bold" : "normal");
            doc.setFontSize(8.5);
            doc.setTextColor(15, 23, 42);
            doc.text(item.p1Name, marginX + 4, row1Y);

            if (item.p1Vencedor || item.p1Campeao) {
                const nameW = doc.getTextWidth(item.p1Name);
                const tagTxt = item.p1Campeao ? "Campeão" : "Vencedor";
                doc.setFont("helvetica", "bold");
                doc.setFontSize(6.5);
                const tagW = doc.getTextWidth(tagTxt) + 4;
                const tagX = marginX + 6 + nameW;

                if (item.p1Campeao) {
                    doc.setFillColor(254, 243, 199);
                    doc.setDrawColor(252, 211, 77);
                    doc.setTextColor(180, 83, 9);
                } else {
                    doc.setFillColor(220, 252, 231);
                    doc.setDrawColor(134, 239, 172);
                    doc.setTextColor(22, 163, 74);
                }
                doc.setLineWidth(0.15);
                doc.roundedRect(tagX, row1Y - 3.2, tagW, 3.8, 0.8, 0.8, "FD");
                doc.text(tagTxt, tagX + 2, row1Y - 0.5);
            }

            doc.setDrawColor(241, 245, 249);
            doc.setLineWidth(0.15);
            doc.line(marginX + 4, currentY + 11.2, pageWidth - marginX - 4, currentY + 11.2);

            let row2Y = currentY + 15;
            doc.setFont("helvetica", item.p2Vencedor || item.p2Campeao ? "bold" : "normal");
            doc.setFontSize(8.5);
            doc.setTextColor(15, 23, 42);
            doc.text(item.p2Name, marginX + 4, row2Y);

            if (item.p2Vencedor || item.p2Campeao) {
                const nameW2 = doc.getTextWidth(item.p2Name);
                const tagTxt2 = item.p2Campeao ? "Campeão" : "Vencedor";
                doc.setFont("helvetica", "bold");
                doc.setFontSize(6.5);
                const tagW2 = doc.getTextWidth(tagTxt2) + 4;
                const tagX2 = marginX + 6 + nameW2;

                if (item.p2Campeao) {
                    doc.setFillColor(254, 243, 199);
                    doc.setDrawColor(252, 211, 77);
                    doc.setTextColor(180, 83, 9);
                } else {
                    doc.setFillColor(220, 252, 231);
                    doc.setDrawColor(134, 239, 172);
                    doc.setTextColor(22, 163, 74);
                }
                doc.setLineWidth(0.15);
                doc.roundedRect(tagX2, row2Y - 3.2, tagW2, 3.8, 0.8, 0.8, "FD");
                doc.text(tagTxt2, tagX2 + 2, row2Y - 0.5);
            }

            currentY += boxH + 3;
        });
        currentY += 2;
    }

    if (grupoItems.length > 0) {
        if (mataMataItems.length > 0) {
            doc.setDrawColor(226, 232, 240);
            doc.setLineWidth(0.3);
            doc.line(marginX, currentY, pageWidth - marginX, currentY);
            currentY += 5;
        }

        grupoItems.forEach((grupo) => {
            const grupoHeight = 8 + (grupo.membros.length * 10);
            if (currentY + grupoHeight > pageHeight - 20) { doc.addPage(); currentY = 15; }

            doc.setFillColor(248, 250, 252);
            doc.setDrawColor(203, 213, 225);
            doc.setLineWidth(0.2);
            doc.roundedRect(marginX, currentY, contentWidth, 6.5, 1, 1, "FD");

            doc.setFont("helvetica", "bold");
            doc.setFontSize(8.5);
            doc.setTextColor(71, 85, 105);
            doc.text(grupo.grupoHeader, marginX + 4, currentY + 4.5);

            currentY += 8;

            grupo.membros.forEach((membro) => {
			doc.setFont("helvetica", "bold");
			doc.setFontSize(8.5);
			doc.setTextColor(15, 23, 42);
			const labelAtleta = `${membro.pos} ${membro.nome}${membro.tagTexto ? `  [${membro.tagTexto}]` : ''}`;
			doc.text(labelAtleta, marginX + 4, currentY + 4);

                doc.setFont("helvetica", "bold");
                doc.setFontSize(8.5);
                doc.setTextColor(21, 128, 61);
                doc.text(membro.pts, marginX + contentWidth - 4, currentY + 4, { align: "right" });

                doc.setFont("helvetica", "normal");
                doc.setFontSize(7.5);
                doc.setTextColor(100, 116, 139);
                doc.text(membro.pills, marginX + 4, currentY + 8);

                currentY += 10;
                doc.setDrawColor(241, 245, 249);
                doc.setLineWidth(0.15);
                doc.line(marginX + 2, currentY - 1, pageWidth - marginX - 2, currentY - 1);
            });

            currentY += 3;
        });
    }

    if (tipoModelo === 'barragem' && leaderboardItems.length > 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(marginX, currentY, contentWidth, 6, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);

        doc.text("POS", marginX + 3, currentY + 4.2);
        doc.text("ATLETA", marginX + 18, currentY + 4.2);
        doc.text("J", marginX + 110, currentY + 4.2, { align: "center" });
        doc.text("V", marginX + 125, currentY + 4.2, { align: "center" });
        doc.text("D", marginX + 140, currentY + 4.2, { align: "center" });
        doc.text("SG", marginX + 158, currentY + 4.2, { align: "center" });
        doc.text("PTS", marginX + 174, currentY + 4.2, { align: "center" });

        currentY += 6;
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.3);
        doc.line(marginX, currentY, pageWidth - marginX, currentY);

        leaderboardItems.forEach((item) => {
            if (currentY + 8 > pageHeight - 20) { doc.addPage(); currentY = 15; }

            if (item.ehVoce) {
                doc.setFillColor(240, 253, 244);
                doc.rect(marginX, currentY, contentWidth, 7, "F");
            }

            doc.setFont("helvetica", "bold");
            doc.setFontSize(8.5);
            doc.setTextColor(item.ehVoce ? 21 : 30, item.ehVoce ? 128 : 41, item.ehVoce ? 61 : 59);
            doc.text(item.pos, marginX + 3, currentY + 4.8);
            doc.text(item.nome, marginX + 18, currentY + 4.8);

            doc.setFont("helvetica", "normal");
            doc.setTextColor(51, 65, 85);
            doc.text(item.j, marginX + 110, currentY + 4.8, { align: "center" });
            doc.text(item.v, marginX + 125, currentY + 4.8, { align: "center" });
            doc.text(item.d, marginX + 140, currentY + 4.8, { align: "center" });

            if (item.sg.startsWith('+')) doc.setTextColor(22, 163, 74);
            else if (item.sg.startsWith('-')) doc.setTextColor(220, 38, 38);
            else doc.setTextColor(100, 116, 139);
            doc.setFont("helvetica", "bold");
            doc.text(item.sg, marginX + 158, currentY + 4.8, { align: "center" });

            doc.setTextColor(21, 128, 61);
            doc.setFont("helvetica", "bold");
            doc.text(item.pts, marginX + 174, currentY + 4.8, { align: "center" });

            currentY += 7;
            doc.setDrawColor(241, 245, 249);
            doc.setLineWidth(0.15);
            doc.line(marginX, currentY, pageWidth - marginX, currentY);
        });
    }

    if (tipoModelo === 'piramide' && leaderboardItems.length > 0) {
        leaderboardItems.forEach((item, index) => {
            if (currentY + 11 > pageHeight - 20) { doc.addPage(); currentY = 15; }

            let bgRGB = [255, 255, 255];
            let borderRGB = [226, 232, 240];
            let posRGB = [100, 116, 139];
            let subRGB = [100, 116, 139];
            let borderWidth = 0.15;

            if (index === 0) {
                bgRGB = [255, 251, 235];
                borderRGB = [245, 158, 11];
                posRGB = [180, 83, 9];
                subRGB = [120, 53, 15];
                borderWidth = 0.35;
            } else if (index === 1) {
                bgRGB = [241, 245, 249];
                borderRGB = [203, 213, 225];
                posRGB = [71, 85, 105];
                subRGB = [71, 85, 105];
                borderWidth = 0.25;
            } else if (index === 2) {
                bgRGB = [255, 247, 237];
                borderRGB = [254, 215, 170];
                posRGB = [194, 65, 12];
                subRGB = [194, 65, 12];
                borderWidth = 0.25;
            } else if (item.ehVoce) {
                bgRGB = [240, 253, 244];
                borderRGB = [134, 239, 172];
                posRGB = [21, 128, 61];
            }

            doc.setFillColor(bgRGB[0], bgRGB[1], bgRGB[2]);
            doc.setDrawColor(borderRGB[0], borderRGB[1], borderRGB[2]);
            doc.setLineWidth(borderWidth);
            doc.roundedRect(marginX, currentY, contentWidth, 9, 1.5, 1.5, "FD");

            doc.setFont("helvetica", "bold");
            doc.setFontSize(9);
            doc.setTextColor(posRGB[0], posRGB[1], posRGB[2]);
            doc.text(item.pos, marginX + 4, currentY + 5.8);

            doc.setTextColor(15, 23, 42);
            doc.text(item.nome, marginX + 18, currentY + 5.8);

            if (item.sub) {
                doc.setFont("helvetica", "bold");
                doc.setFontSize(8);
                doc.setTextColor(subRGB[0], subRGB[1], subRGB[2]);
                doc.text(item.sub, marginX + contentWidth - 4, currentY + 5.8, { align: "right" });
            }

            currentY += 11; 
        });
    }

    drawFooter(Math.max(currentY + 2, pageHeight - 20));

    const nomeArquivo = ehHistorico 
        ? `Tabela_Acervo_${limparTextoPdf(edicaoHistoricaFocoSaaS?.contrato?.nomeTorneio || 'Torneio').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`
        : `Torneio_Atual_${limparTextoPdf(nomeClube).replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;

    try {
        await processarSaidaPDFSaaS(doc, nomeArquivo, ehHistorico ? "PDF do Acervo Histórico" : "PDF do Torneio Atual");
    } catch (err) {
        console.error("❌ Erro ao exportar classificação:", err);
        showToast("Erro ao gerar PDF da classificação.", "error");
    }
}

async function processarSaidaPDFSaaS(pdfWorkerOrDoc, nomeArquivo, tituloMensagem = "PDF") {
    const isNative = typeof window.Capacitor !== 'undefined' && window.Capacitor.isNativePlatform();

    if (isNative) {
        try {
            let base64Pdf = '';

            if (typeof pdfWorkerOrDoc.output === 'function') {
                base64Pdf = await Promise.resolve(pdfWorkerOrDoc.output('datauristring'));
            } else if (typeof pdfWorkerOrDoc.outputPdf === 'function') {
                base64Pdf = await pdfWorkerOrDoc.outputPdf('datauristring');
            } else {
                base64Pdf = await Promise.resolve(pdfWorkerOrDoc);
            }

            const cleanBase64 = base64Pdf.includes(',') ? base64Pdf.split(',')[1] : base64Pdf;

            const Filesystem = window.Capacitor.Plugins.Filesystem;
            const FileOpener = window.Capacitor.Plugins.FileOpener;

            const fileResult = await Filesystem.writeFile({
                path: nomeArquivo,
                data: cleanBase64,
                directory: 'CACHE'
            });

            await FileOpener.openFile({
                path: fileResult.uri,
                mimeType: 'application/pdf'
            });

            showToast(`${tituloMensagem} gerado e aberto!`, "success");
        } catch (err) {
            console.error("❌ Erro ao processar PDF nativo:", err);
            showToast(`Erro ao abrir PDF: ${err.message || err}`, "error");
        }
    } else {
        if (typeof pdfWorkerOrDoc.save === 'function') {
            pdfWorkerOrDoc.save(nomeArquivo);
        } else if (typeof pdfWorkerOrDoc.save === 'function') {
            await pdfWorkerOrDoc.save();
        }
        showToast(`${tituloMensagem} baixado com sucesso!`, "success");
    }
}

function exportarPDFContextualSaaS() {
    if (abaVisaoLeaderboardSaaS === 'TORNEIO') {
        exportarLeaderboardPDFSaaS();
    } else if (abaVisaoLeaderboardSaaS === 'SUMULAS') {
        exportarSumulasPDFSaaS();
    } else if (abaVisaoLeaderboardSaaS === 'GERAL') {
        exportarRankingGeralPDFSaaS();
    } else {
        exportarLeaderboardPDFSaaS();
    }
}

async function exportarRankingGeralPDFSaaS() {
    if (navigator.vibrate) navigator.vibrate(30);
    showToast("Gerando PDF do Ranking Geral...", "info");

    if (typeof window.jspdf === 'undefined' && typeof window.jsPDF === 'undefined') {
        await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    const { jsPDF } = window.jspdf || { jsPDF: window.jsPDF };
    if (!jsPDF) {
        showToast("Erro ao carregar o motor de PDF.", "error");
        return;
    }

    const modoAnterior = abaVisaoLeaderboardSaaS;
    abaVisaoLeaderboardSaaS = 'GERAL';

    if (typeof renderizarLeaderboardSaaS === 'function') {
        await renderizarLeaderboardSaaS();
    }

    const bodyLeaderboard = document.getElementById('body-leaderboard-scroll');
    const elNomeClube = document.getElementById('txt-nome-clube');

    if (!bodyLeaderboard || !bodyLeaderboard.innerHTML.trim() || bodyLeaderboard.innerText.includes("Nenhum atleta")) {
        showToast("Nenhum atleta cadastrado no Ranking Geral desta categoria.", "warning");
        abaVisaoLeaderboardSaaS = modoAnterior;
        if (typeof renderizarLeaderboardSaaS === 'function') await renderizarLeaderboardSaaS();
        return;
    }

    let nomeClubeRaw = elNomeClube ? elNomeClube.textContent.trim() : '';
    if (!nomeClubeRaw || nomeClubeRaw.toUpperCase() === 'CARREGANDO...') {
        nomeClubeRaw = localStorage.getItem('setpoint_jogador_clube_nome') || clubeAtivoId || 'CLUBE';
    }
    const nomeClube = nomeClubeRaw.toUpperCase();
    const dataHojeStr = new Date().toLocaleDateString('pt-BR');

    const conf = (configRegrasGlobal && configRegrasGlobal.ranking) ? configRegrasGlobal.ranking : {};
    const cal = conf.calendario || {};
    const nomeTorneio = cal.nomeTorneio || 'Torneio Oficial';

    const selClasse = document.getElementById('select-leaderboard-classe');
    const selGenero = document.getElementById('select-leaderboard-genero');
    const txtClasse = selClasse ? `Classe ${selClasse.value}` : '';
    const txtGenero = (selGenero && selGenero.value !== 'UNIFICADO') ? selGenero.value : '';
    const categoriaAtivaTxt = [txtClasse, txtGenero].filter(Boolean).join(' • ');

    const linha2TorneioCategoria = categoriaAtivaTxt ? `${nomeTorneio} — ${categoriaAtivaTxt}` : nomeTorneio;
    const linha3Subtitulo = "Extrato do Ranking Geral";

    const rowsPiramide = Array.from(bodyLeaderboard.querySelectorAll('.item-leaderboard-piramide'));
    const leaderboardItems = rowsPiramide.map(itemEl => {
        const pos = itemEl.querySelector('span[style*="font-weight: 800"]')?.innerText.trim() || '';
        const nome = itemEl.querySelector('strong')?.innerText.trim() || '';
        const sub = itemEl.querySelector('span[style*="font-size: 11px"]')?.innerText.trim() || 'Atleta Cadastrado';
        const ehVoce = itemEl.classList.contains('voce') || itemEl.style.background?.includes('f0fdf4');
        
        let pts = '';
        const spans = itemEl.querySelectorAll('span');
        spans.forEach(s => {
            if (s.innerText.includes('pts')) {
                pts = s.innerText.trim();
            }
        });

        return { pos, nome, sub, pts, ehVoce };
    });

    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const pageWidth = 210;
    const pageHeight = 297;
    const marginX = 15;
    const contentWidth = pageWidth - (marginX * 2);

    let currentY = 15;

    const drawHeader = () => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.setTextColor(15, 23, 42);
        doc.text(nomeClube + " — SETPOINT", marginX, currentY);

        currentY += 5;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10.5);
        doc.setTextColor(37, 99, 235);
        doc.text(linha2TorneioCategoria, marginX, currentY);

        currentY += 4.5;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(71, 85, 105);
        doc.text(linha3Subtitulo, marginX, currentY);

        doc.setFontSize(9);
        doc.setTextColor(71, 85, 105);
        doc.text(dataHojeStr, pageWidth - marginX, currentY, { align: "right" });

        currentY += 2.5;
        doc.setDrawColor(15, 23, 42);
        doc.setLineWidth(0.4);
        doc.line(marginX, currentY, pageWidth - marginX, currentY);
        currentY += 6;
    };

    const drawFooter = (finalY) => {
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.2);
        doc.line(marginX, finalY, pageWidth - marginX, finalY);

        const footerY = finalY + 4;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);
        doc.text("SetPoint SaaS", marginX, footerY);

        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 116, 139);
        doc.text(" • Relatório Oficial do Ranking", marginX + 21, footerY);
        doc.text("Documento emitido automaticamente pelo sistema.", marginX, footerY + 3.5);

        const sigWidth = 45;
        const sigX = pageWidth - marginX - sigWidth;
        doc.setDrawColor(15, 23, 42);
        doc.setLineWidth(0.3);
        doc.line(sigX, footerY + 2, pageWidth - marginX, footerY + 2);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(15, 23, 42);
        doc.text("Arbitragem / Gestão", sigX + (sigWidth / 2), footerY + 5.5, { align: "center" });
    };

    drawHeader();

    const cardH = 13.5;

    leaderboardItems.forEach((item, index) => {
        const isLast = (index === leaderboardItems.length - 1);
        const neededSpace = isLast ? (cardH + 22) : cardH;

        if (currentY + neededSpace > (pageHeight - 15)) {
            doc.addPage();
            currentY = 15;
        }

        doc.setDrawColor(203, 213, 225);
        doc.setFillColor(item.ehVoce ? 240 : 255, item.ehVoce ? 253 : 255, item.ehVoce ? 244 : 255);
        doc.setLineWidth(item.ehVoce ? 0.3 : 0.15);
        doc.roundedRect(marginX, currentY, contentWidth, cardH, 2, 2, "FD");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(item.ehVoce ? 21 : 100, item.ehVoce ? 128 : 116, item.ehVoce ? 61 : 139);
        doc.text(item.pos, marginX + 5, currentY + 8.2);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(15, 23, 42);
        doc.text(item.nome, marginX + 20, currentY + 5.5);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(item.sub, marginX + 20, currentY + 10);

        if (item.pts) {
            const numPts = parseInt(item.pts, 10) || 0;
            const textX = marginX + contentWidth - 5;

            if (numPts > 0) {
                doc.setTextColor(21, 128, 61);
            } else {
                doc.setTextColor(148, 163, 184);
            }

            doc.setFont("helvetica", "bold");
            doc.setFontSize(9.5);
            doc.text(item.pts, textX, currentY + 8.2, { align: "right" });
        }

        currentY += cardH + 3.5;
    });

    drawFooter(Math.max(currentY + 2, pageHeight - 20));

    const nomeArquivo = `Ranking_Geral_${nomeClube.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
    try {
        await processarSaidaPDFSaaS(doc, nomeArquivo, "PDF do Ranking Geral");
    } catch (err) {
        console.error("❌ Erro ao exportar Ranking Geral:", err);
        showToast("Erro ao gerar PDF do Ranking Geral.", "error");
    } finally {
        abaVisaoLeaderboardSaaS = modoAnterior;
        if (typeof renderizarLeaderboardSaaS === 'function') {
            await renderizarLeaderboardSaaS();
        }
    }
}

async function exportarSumulasPDFSaaS() {
    if (navigator.vibrate) navigator.vibrate(30);
    
    const sheetLeaderboard = document.getElementById('sheet-leaderboard-ranking');
    const ehHistorico = !!(edicaoHistoricaFocoSaaS && sheetLeaderboard && sheetLeaderboard.classList.contains('ativa'));

    showToast(ehHistorico ? "Gerando PDF das Súmulas do Acervo..." : "Gerando PDF das Súmulas...", "info");

    const limparTextoPdf = (txt) => {
        if (!txt) return '';
        return txt.replace(/[•—–]/g, '-')
                  .replace(/[^\x20-\x7E\xA0-\xFF]/g, '')
                  .replace(/\s+/g, ' ')
                  .trim();
    };

    if (typeof window.jspdf === 'undefined' && typeof window.jsPDF === 'undefined') {
        await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    const { jsPDF } = window.jspdf || { jsPDF: window.jsPDF };
    if (!jsPDF) {
        showToast("Erro ao carregar o motor de PDF.", "error");
        return;
    }

    const modoAnterior = abaVisaoLeaderboardSaaS;
    
    if (!ehHistorico) {
        abaVisaoLeaderboardSaaS = 'SUMULAS';
        if (typeof renderizarLeaderboardSaaS === 'function') {
            await renderizarLeaderboardSaaS();
        }
    }

    const bodyLeaderboard = document.getElementById('body-leaderboard-scroll');
    const txtSub = document.getElementById('txt-subtitulo-leaderboard');
    const elNomeClube = document.getElementById('txt-nome-clube');

    if (!bodyLeaderboard || !bodyLeaderboard.innerHTML.trim() || bodyLeaderboard.innerText.includes("Nenhuma súmula")) {
        showToast("Nenhuma súmula encontrada para exportar.", "warning");
        if (!ehHistorico) {
            abaVisaoLeaderboardSaaS = modoAnterior;
            if (typeof renderizarLeaderboardSaaS === 'function') await renderizarLeaderboardSaaS();
        }
        return;
    }

    let nomeClubeRaw = elNomeClube ? elNomeClube.textContent.trim() : '';
    if (!nomeClubeRaw || nomeClubeRaw.toUpperCase() === 'CARREGANDO...') {
        nomeClubeRaw = localStorage.getItem('setpoint_jogador_clube_nome') || clubeAtivoId || 'CLUBE';
    }
    const nomeClube = limparTextoPdf(nomeClubeRaw.toUpperCase());
    const dataHojeStr = new Date().toLocaleDateString('pt-BR');

    let linha2TorneioCategoria = "";
    let linha3Subtitulo = "";

    if (ehHistorico) {
        const cal = edicaoHistoricaFocoSaaS.contrato || {};
        const nomeTorneio = limparTextoPdf(cal.nomeTorneio || 'Torneio Histórico');
        linha2TorneioCategoria = `${nomeTorneio} - Acervo Histórico`;
        linha3Subtitulo = "Súmulas e Resultados - Edição Concluída";
    } else {
        const conf = (configRegrasGlobal && configRegrasGlobal.ranking) ? configRegrasGlobal.ranking : {};
        const cal = conf.calendario || {};
        const nomeTorneio = limparTextoPdf(cal.nomeTorneio || 'Torneio Oficial');

        const selClasse = document.getElementById('select-leaderboard-classe');
        const selGenero = document.getElementById('select-leaderboard-genero');
        const txtClasse = selClasse ? `Classe ${selClasse.value}` : '';
        const txtGenero = (selGenero && selGenero.value !== 'UNIFICADO') ? selGenero.value : '';
        const categoriaAtivaTxt = limparTextoPdf([txtClasse, txtGenero].filter(Boolean).join(' - '));

        linha2TorneioCategoria = categoriaAtivaTxt ? `${nomeTorneio} - ${categoriaAtivaTxt}` : nomeTorneio;
        let modeloTxt = txtSub ? txtSub.innerText.replace('Ranking Oficial do Clube • ', '').trim() : 'Modelo Oficial';
        linha3Subtitulo = limparTextoPdf(`Súmulas e Resultados - ${modeloTxt}`);
    }

    const atpTables = Array.from(bodyLeaderboard.querySelectorAll('.atp-table'));
    let cardElements = atpTables.map(table => {
        let el = table;
        while (el.parentElement && el.parentElement !== bodyLeaderboard && el.parentElement.id !== 'box-restante-sumulas-acervo' && !el.parentElement.classList.contains('pdf-body-content')) {
            if (el.parentElement.tagName === 'DIV' && (el.parentElement.style.background || el.parentElement.style.border)) {
                return el.parentElement;
            }
            el = el.parentElement;
        }
        return el;
    }).filter((card, index, self) => self.indexOf(card) === index);

    if (cardElements.length === 0) {
        const allDivs = Array.from(bodyLeaderboard.querySelectorAll('div[style*="border-radius: 14px"]'));
        if (allDivs.length > 0) {
            cardElements = allDivs;
        } else {
            cardElements = Array.from(bodyLeaderboard.children).filter(child => 
                !child.classList.contains('box-dica-leaderboard') && child.innerText.trim().length > 0
            );
        }
    }

    const matchesData = cardElements.map(cardEl => {
        const txtFull = cardEl.innerText || '';
        
        let badgeCategoria = cardEl.querySelector('span[style*="purple"], span[style*="8b5cf6"], .badge-categoria')?.innerText.trim();
        if (!badgeCategoria) {
            if (ehHistorico) {
                badgeCategoria = 'Súmula Histórica';
            } else {
                const selClasse = document.getElementById('select-leaderboard-classe');
                const selGenero = document.getElementById('select-leaderboard-genero');
                const txtClasse = selClasse ? `Classe ${selClasse.value}` : '';
                const txtGenero = (selGenero && selGenero.value !== 'UNIFICADO') ? selGenero.value : '';
                badgeCategoria = [txtClasse, txtGenero].filter(Boolean).join(' - ') || 'Súmula Oficial';
            }
        }
        badgeCategoria = limparTextoPdf(badgeCategoria);
        
        let labelFase = cardEl.querySelector('th[style*="text-align: left"], th')?.innerText.trim() || '';
        labelFase = limparTextoPdf(labelFase);

        const dateMatch = txtFull.match(/\b\d{2}\/\d{2}\/\d{4}\b/);
        const matchDate = dateMatch ? dateMatch[0] : '';

        let noteText = '';
        const noteEl = cardEl.querySelector('div[style*="italic"]');
        if (noteEl) {
            noteText = limparTextoPdf(noteEl.innerText.trim());
        } else if (txtFull.includes('Motivo:')) {
            const match = txtFull.match(/Motivo:[^\n]+/i);
            if (match) noteText = limparTextoPdf(match[0].trim());
        }

        let statusTag = 'Homologado';
        let statusColor = [22, 163, 74];

        const noteLower = noteText.toLowerCase();
        if (noteLower.includes('anulada por') || txtFull.includes('Anulada por')) {
            statusTag = 'Arbitrado';
            statusColor = [220, 38, 38];
        } else if (noteLower.includes('editado pela arbitragem')) {
            statusTag = 'Arbitrado';
            statusColor = [217, 119, 6];
        } else if (noteLower.includes('homologado pela arbitragem')) {
            statusTag = 'Arbitrado';
            statusColor = [22, 163, 74];
        } else if (txtFull.includes('Arbitrado')) {
            statusTag = 'Arbitrado';
            statusColor = [22, 163, 74];
        }

        const rows = Array.from(cardEl.querySelectorAll('tr')).filter(r => r.querySelector('.atp-name') || r.querySelectorAll('td').length >= 2);
        
        const players = [];
        rows.forEach(r => {
            const nameEl = r.querySelector('.atp-name');
            if (!nameEl) return;
            const name = limparTextoPdf(nameEl.innerText.trim());
            const isWinner = nameEl.classList.contains('match-winner') || r.querySelector('.winner-arrow') !== null;
            const hasRET = r.querySelector('.badge-ret') !== null;

            const scoreTds = Array.from(r.querySelectorAll('.atp-score, td.col-score'));
            const scores = scoreTds.map(td => {
                const sup = td.querySelector('sup')?.innerText || '';
                const mainVal = td.innerText.replace(sup, '').trim();
                return { val: mainVal, sup: sup };
            });

            players.push({ name, isWinner, hasRET, scores });
        });

        return { badgeCategoria, matchDate, statusTag, statusColor, players, noteText, labelFase };
    });

    const totalPartidas = matchesData.length;

    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const pageWidth = 210;
    const pageHeight = 297;
    const marginX = 15;
    const contentWidth = pageWidth - (marginX * 2);

    let currentY = 15;

    const drawHeaderPage1 = () => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.setTextColor(15, 23, 42);
        doc.text(nomeClube, marginX, currentY);

        currentY += 5;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10.5);
        doc.setTextColor(37, 99, 235);
        doc.text(linha2TorneioCategoria, marginX, currentY);

        currentY += 4.5;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(71, 85, 105);
        doc.text(linha3Subtitulo, marginX, currentY);

        doc.setFontSize(9);
        doc.setTextColor(71, 85, 105);
        doc.text(dataHojeStr, pageWidth - marginX, currentY, { align: "right" });

        currentY += 2.5;
        doc.setDrawColor(15, 23, 42);
        doc.setLineWidth(0.4);
        doc.line(marginX, currentY, pageWidth - marginX, currentY);
        currentY += 5;

        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.2);
        doc.roundedRect(marginX, currentY, contentWidth, 7, 1.5, 1.5, "FD");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(71, 85, 105);
        doc.text(`Total de ${totalPartidas} partida(s) nesta edição/categoria.`, marginX + (contentWidth / 2), currentY + 4.6, { align: "center" });

        currentY += 11;
    };

    const drawFooterLastPage = (finalY) => {
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.2);
        doc.line(marginX, finalY, pageWidth - marginX, finalY);

        const footerY = finalY + 4;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);
        doc.text("SetPoint SaaS", marginX, footerY);

        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 116, 139);
        doc.text(" - Relatório Oficial do Ranking", marginX + 21, footerY);
        doc.text("Documento emitido automaticamente pelo sistema.", marginX, footerY + 3.5);

        const sigWidth = 45;
        const sigX = pageWidth - marginX - sigWidth;
        doc.setDrawColor(15, 23, 42);
        doc.setLineWidth(0.3);
        doc.line(sigX, footerY + 2, pageWidth - marginX, footerY + 2);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(15, 23, 42);
        doc.text("Arbitragem / Gestão", sigX + (sigWidth / 2), footerY + 5.5, { align: "center" });
    };

    const drawWinnerArrow = (x, y) => {
        doc.setFillColor(15, 23, 42);
        doc.triangle(x, y - 1.2, x, y + 1.2, x - 1.8, y, "F");
    };

    drawHeaderPage1();

    matchesData.forEach((match, index) => {
        const hasNote = Boolean(match.noteText);
        const cardHeight = hasNote ? 31 : 26; 
        const isLastMatch = (index === matchesData.length - 1);
        const neededSpace = isLastMatch ? (cardHeight + 22) : cardHeight;

        if (currentY + neededSpace > (pageHeight - 15)) {
            doc.addPage();
            currentY = 15;
        }

        const cardX = marginX;
        const cardY = currentY;

        doc.setDrawColor(203, 213, 225);
        doc.setFillColor(255, 255, 255);
        doc.setLineWidth(0.2);
        doc.roundedRect(cardX, cardY, contentWidth, cardHeight, 2, 2, "FD");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        const badgeTxt = match.badgeCategoria;
        const badgeW = doc.getTextWidth(badgeTxt) + 5;
        
        doc.setFillColor(245, 243, 255);
        doc.setDrawColor(221, 214, 254);
        doc.setLineWidth(0.15);
        doc.roundedRect(cardX + 3, cardY + 2, badgeW, 4.2, 1, 1, "FD");
        doc.setTextColor(139, 92, 246);
        doc.text(badgeTxt, cardX + 5.5, cardY + 5);

        if (match.matchDate) {
            const dateTxt = match.matchDate;
            const dateW = doc.getTextWidth(dateTxt) + 5;
            const dateX = cardX + 3 + badgeW + 2;

            doc.setFillColor(241, 245, 249);
            doc.setDrawColor(203, 213, 225);
            doc.setLineWidth(0.15);
            doc.roundedRect(dateX, cardY + 2, dateW, 4.2, 1, 1, "FD");
            doc.setTextColor(71, 85, 105);
            doc.text(dateTxt, dateX + 2.5, cardY + 5);
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        const statusTxt = match.statusTag;
        const statusTxtW = doc.getTextWidth(statusTxt);
        const statusX = cardX + contentWidth - 4;

        doc.setFillColor(match.statusColor[0], match.statusColor[1], match.statusColor[2]);
        doc.setDrawColor(match.statusColor[0], match.statusColor[1], match.statusColor[2]);
        doc.circle(statusX - statusTxtW - 2.5, cardY + 4, 1.1, "F");

        doc.setTextColor(match.statusColor[0], match.statusColor[1], match.statusColor[2]);
        doc.text(statusTxt, statusX, cardY + 5, { align: "right" });

        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.5);
        doc.setTextColor(148, 163, 184);
        doc.text(match.labelFase || 'Ranking', cardX + 5, cardY + 10.2);

        doc.setDrawColor(241, 245, 249);
        doc.setLineWidth(0.15);
        doc.line(cardX + 3, cardY + 11, cardX + contentWidth - 3, cardY + 11);

        const p1 = match.players[0] || { name: '--', isWinner: false, hasRET: false, scores: [] };
        const row1Y = cardY + 15.5;

        doc.setFont("helvetica", p1.isWinner ? "bold" : "normal");
        doc.setFontSize(p1.isWinner ? 9.5 : 9);
        doc.setTextColor(15, 23, 42);
        doc.text(p1.name, cardX + 5, row1Y);

        if (p1.hasRET) {
            const wName = doc.getTextWidth(p1.name);
            doc.setFillColor(220, 38, 38);
            doc.roundedRect(cardX + 6 + wName, row1Y - 3, 8, 3.5, 0.6, 0.6, "F");
            doc.setFont("helvetica", "bold");
            doc.setFontSize(6);
            doc.setTextColor(255, 255, 255);
            doc.text("RET", cardX + 6 + wName + 1.2, row1Y - 0.5);
        }

        let scoreX1 = cardX + contentWidth - 28;
        p1.scores.forEach(s => {
            doc.setFont("helvetica", p1.isWinner ? "bold" : "normal");
            doc.setFontSize(9);
            doc.setTextColor(15, 23, 42);
            doc.text(s.val, scoreX1, row1Y, { align: "center" });

            if (s.sup) {
                doc.setFontSize(5.5);
                doc.setTextColor(148, 163, 184);
                doc.text(s.sup, scoreX1 + 2.2, row1Y - 1.8);
            }
            scoreX1 += 9;
        });

        if (p1.isWinner) {
            drawWinnerArrow(cardX + contentWidth - 4, row1Y - 0.8);
        }

        doc.setDrawColor(241, 245, 249);
        doc.setLineWidth(0.15);
        doc.line(cardX + 3, cardY + 17.5, cardX + contentWidth - 3, cardY + 17.5);

        const p2 = match.players[1] || { name: '--', isWinner: false, hasRET: false, scores: [] };
        const row2Y = cardY + 22;

        doc.setFont("helvetica", p2.isWinner ? "bold" : "normal");
        doc.setFontSize(p2.isWinner ? 9.5 : 9);
        doc.setTextColor(15, 23, 42);
        doc.text(p2.name, cardX + 5, row2Y);

        if (p2.hasRET) {
            const wName2 = doc.getTextWidth(p2.name);
            doc.setFillColor(220, 38, 38);
            doc.roundedRect(cardX + 6 + wName2, row2Y - 3, 8, 3.5, 0.6, 0.6, "F");
            doc.setFont("helvetica", "bold");
            doc.setFontSize(6);
            doc.setTextColor(255, 255, 255);
            doc.text("RET", cardX + 6 + wName2 + 1.2, row2Y - 0.5);
        }

        let scoreX2 = cardX + contentWidth - 28;
        p2.scores.forEach(s => {
            doc.setFont("helvetica", p2.isWinner ? "bold" : "normal");
            doc.setFontSize(9);
            doc.setTextColor(15, 23, 42);
            doc.text(s.val, scoreX2, row2Y, { align: "center" });

            if (s.sup) {
                doc.setFontSize(5.5);
                doc.setTextColor(148, 163, 184);
                doc.text(s.sup, scoreX2 + 2.2, row2Y - 1.8);
            }
            scoreX2 += 9;
        });

        if (p2.isWinner) {
            drawWinnerArrow(cardX + contentWidth - 4, row2Y - 0.8);
        }

        if (hasNote) {
            doc.setFont("helvetica", "italic");
            doc.setFontSize(7.5);
            doc.setTextColor(match.statusColor[0], match.statusColor[1], match.statusColor[2]);
            doc.text(match.noteText, cardX + (contentWidth / 2), cardY + cardHeight - 2.5, { align: "center" });
        }

        currentY += cardHeight + 3.5;
    });

    drawFooterLastPage(Math.max(currentY + 2, pageHeight - 20));

    const nomeArquivo = ehHistorico
        ? `Sumulas_Acervo_${limparTextoPdf(edicaoHistoricaFocoSaaS?.contrato?.nomeTorneio || 'Torneio').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`
        : `Sumulas_${nomeClube.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
    
    try {
        await processarSaidaPDFSaaS(doc, nomeArquivo, ehHistorico ? "PDF das Súmulas do Acervo" : "PDF das Súmulas");
    } catch (err) {
        console.error("❌ Erro ao salvar PDF vetorial:", err);
        showToast("Erro ao gerar arquivo PDF.", "error");
    } finally {
        if (!ehHistorico) {
            abaVisaoLeaderboardSaaS = modoAnterior;
            if (typeof renderizarLeaderboardSaaS === 'function') {
                await renderizarLeaderboardSaaS();
            }
        }
    }
}

async function exportarRelatorioHistoricoSaaS() {
    if (!acervoHistoricoGlobalSaaS || acervoHistoricoGlobalSaaS.length === 0) {
        if (typeof carregarHistoricoTorneiosSaaS === 'function') {
            await carregarHistoricoTorneiosSaaS();
        }
    }

    if (!acervoHistoricoGlobalSaaS || acervoHistoricoGlobalSaaS.length === 0) {
        showToast("Nenhum torneio arquivado no histórico para gerar relatório.", "warning");
        return;
    }

    if (navigator.vibrate) navigator.vibrate(30);
    showToast("Gerando relatório PDF...", "info");

    if (typeof window.jspdf === 'undefined' && typeof window.jsPDF === 'undefined') {
        await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    const { jsPDF } = window.jspdf || { jsPDF: window.jsPDF };
    if (!jsPDF) {
        showToast("Erro ao carregar o motor de PDF.", "error");
        return;
    }

    const dataHojeStr = new Date().toLocaleDateString('pt-BR');
    const elNomeClube = document.getElementById('txt-nome-clube');
    const nomeClube = (elNomeClube ? elNomeClube.textContent.trim() : 'CLUBE OLÍMPICO').toUpperCase();

    const totalTorneios = acervoHistoricoGlobalSaaS.length;
    let totalPartidasValidadas = 0;
    const atletasUnicosSet = new Set();
    const contagemTitulos = {};

    const capitalizar = (str) => {
        if (!str) return '';
        return str.split(' ').map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ');
    };

    const buscarNomeAtleta = (id) => {
        const j = (typeof jogadoresGlobal !== 'undefined' && jogadoresGlobal[id]) ? jogadoresGlobal[id] : {};
        return capitalizar(j.nomeCompleto || j.apelido || 'Atleta');
    };

    acervoHistoricoGlobalSaaS.forEach(edicao => {
        const partidas = edicao.partidas || {};
        totalPartidasValidadas += Object.keys(partidas).length;

        const classif = edicao.classificacaoFinal || {};
        Object.keys(classif).forEach(catKey => {
            const listaIds = classif[catKey] || [];
            listaIds.forEach(id => atletasUnicosSet.add(id));

            let catLabel = catKey.replace('CLASSE_', '').replace('_', ' ');
            catLabel = catLabel.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');

            if (listaIds[0]) {
                const idC = listaIds[0];
                if (!contagemTitulos[idC]) {
                    contagemTitulos[idC] = { id: idC, nome: buscarNomeAtleta(idC), titulos: 0, vices: 0, categorias: new Set() };
                }
                contagemTitulos[idC].titulos++;
                contagemTitulos[idC].categorias.add(catLabel);
            }

            if (listaIds[1]) {
                const idV = listaIds[1];
                if (!contagemTitulos[idV]) {
                    contagemTitulos[idV] = { id: idV, nome: buscarNomeAtleta(idV), titulos: 0, vices: 0, categorias: new Set() };
                }
                contagemTitulos[idV].vices++;
                contagemTitulos[idV].categorias.add(catLabel);
            }
        });
    });

    const rankingCampeoes = Object.values(contagemTitulos)
        .filter(c => c.titulos > 0)
        .sort((a, b) => {
            if (b.titulos !== a.titulos) return b.titulos - a.titulos;
            return b.vices - a.vices;
        });

    const top5Campeoes = rankingCampeoes.slice(0, 5);
    const liderAbsolutoNome = top5Campeoes.length > 0 ? top5Campeoes[0].nome : '--';

    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const pageWidth = 210;
    const pageHeight = 297;
    const marginX = 15;
    const contentWidth = pageWidth - (marginX * 2);

    let currentY = 15;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text(nomeClube + " — SETPOINT", marginX, currentY);

    currentY += 5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(71, 85, 105);
    doc.text("Relatório Geral do Acervo de Torneios", marginX, currentY);

    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(dataHojeStr, pageWidth - marginX, currentY, { align: "right" });

    currentY += 2.5;
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.4);
    doc.line(marginX, currentY, pageWidth - marginX, currentY);
    currentY += 6;

    const kpiH = 14;
    const w1 = 36;
    const w2 = 36;
    const w3 = 38;
    const w4 = contentWidth - (w1 + w2 + w3 + 9);

    const kpiConfigs = [
        { x: marginX, w: w1, val: String(totalTorneios), lbl: "TORNEIOS REALIZADOS", isLider: false },
        { x: marginX + w1 + 3, w: w2, val: String(totalPartidasValidadas), lbl: "PARTIDAS VALIDADAS", isLider: false },
        { x: marginX + w1 + w2 + 6, w: w3, val: String(atletasUnicosSet.size), lbl: "ATLETAS PARTICIPANTES", isLider: false },
        { x: marginX + w1 + w2 + w3 + 9, w: w4, val: liderAbsolutoNome, lbl: "LÍDER ABSOLUTO(A)", isLider: true }
    ];

    kpiConfigs.forEach((k) => {
        doc.setFillColor(248, 250, 252);
        
        if (k.isLider) {
            doc.setDrawColor(250, 204, 21);
            doc.setLineWidth(0.3);
        } else {
            doc.setDrawColor(226, 232, 240);
            doc.setLineWidth(0.2);
        }
        
        doc.roundedRect(k.x, currentY, k.w, kpiH, 2, 2, "FD");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        const txtVal = doc.getTextWidth(k.val) > (k.w - 5) ? k.val.substring(0, 18) + "…" : k.val;
        doc.text(txtVal, k.x + 4, currentY + 5.5);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.5);
        doc.setTextColor(100, 116, 139);
        doc.text(k.lbl, k.x + 4, currentY + 10.5);
    });

    currentY += kpiH + 6;

    const panelLeftW = 68;
    const panelRightW = contentWidth - panelLeftW - 5;
    const panelRightX = marginX + panelLeftW + 5;
    const panelY = currentY;

    const countTop5 = top5Campeoes.length || 1;
    const countEdicoes = acervoHistoricoGlobalSaaS.length || 1;

    const panelLeftH = Math.max(35, 10 + (countTop5 * 21) + 2);
    const panelRightH = Math.max(35, 13.5 + (countEdicoes * 7) + 3);

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.roundedRect(marginX, panelY, panelLeftW, panelLeftH, 2.5, 2.5, "FD");
    doc.roundedRect(panelRightX, panelY, panelRightW, panelRightH, 2.5, 2.5, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text("TOP 5 MAIORES CAMPEÕES", marginX + 4, panelY + 6);

    let itemY = panelY + 10;

    const medalColors = [
        { cardFill: [254, 252, 232], cardBorder: [250, 204, 21], fill: [254, 240, 138], border: [250, 204, 21], text: [161, 98, 7], label: "1º" },
        { cardFill: [248, 250, 252], cardBorder: [203, 213, 225], fill: [241, 245, 249], border: [203, 213, 225], text: [71, 85, 105], label: "2º" },
        { cardFill: [255, 247, 237], cardBorder: [253, 186, 116], fill: [254, 215, 170], border: [253, 186, 116], text: [194, 65, 12], label: "3º" },
        { cardFill: [255, 255, 255], cardBorder: [226, 232, 240], fill: [255, 255, 255], border: [226, 232, 240], text: [100, 116, 139], label: "4º" },
        { cardFill: [255, 255, 255], cardBorder: [226, 232, 240], fill: [255, 255, 255], border: [226, 232, 240], text: [100, 116, 139], label: "5º" }
    ];

    top5Campeoes.forEach((c, idx) => {
        const mc = medalColors[idx] || medalColors[3];
        const cardW = panelLeftW - 8;
        const cardX = marginX + 4;

        doc.setFillColor(mc.cardFill[0], mc.cardFill[1], mc.cardFill[2]);
        doc.setDrawColor(mc.cardBorder[0], mc.cardBorder[1], mc.cardBorder[2]);
        doc.setLineWidth(0.25);
        doc.roundedRect(cardX, itemY, cardW, 19, 2, 2, "FD");

        doc.setFillColor(mc.fill[0], mc.fill[1], mc.fill[2]);
        doc.setDrawColor(mc.border[0], mc.border[1], mc.border[2]);
        doc.setLineWidth(0.15);
        doc.roundedRect(cardX + 2.5, itemY + 3.5, 6.5, 6, 1, 1, "FD");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(mc.text[0], mc.text[1], mc.text[2]);
        doc.text(mc.label, cardX + 5.75, itemY + 7.7, { align: "center" });

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(15, 23, 42);
        const nomeFormatado = c.nome.length > 28 ? c.nome.substring(0, 27) + "…" : c.nome;
        doc.text(nomeFormatado, cardX + 11, itemY + 7);

        const catArray = Array.from(c.categorias);
        const catTxt = catArray.length > 0 ? catArray[0] : "Classe Oficial";
        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.5);
        const badgeW = doc.getTextWidth(catTxt) + 4;

        doc.setFillColor(245, 243, 255);
        doc.setDrawColor(221, 214, 254);
        doc.setLineWidth(0.15);
        doc.roundedRect(cardX + 11, itemY + 11, badgeW, 4.2, 1, 1, "FD");
        doc.setTextColor(139, 92, 246);
        doc.text(catTxt, cardX + 13, itemY + 14);

        const titulosTxt = c.titulos === 1 ? "1 título" : `${c.titulos} títulos`;
        const vicesTxt = c.vices === 1 ? "1 vice" : `${c.vices} vices`;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(180, 83, 9);
        doc.text(titulosTxt, cardX + cardW - 3, itemY + 13, { align: "right" });

        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.5);
        doc.setTextColor(100, 116, 139);
        doc.text(vicesTxt, cardX + cardW - 3, itemY + 16.8, { align: "right" });

        itemY += 21;
    });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text("EDIÇÕES REGISTRADAS NO ACERVO", panelRightX + 4, panelY + 6);

    let tableY = panelY + 11;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);

    doc.text("EDIÇÃO / TORNEIO", panelRightX + 3, tableY);
    doc.text("MODELO", panelRightX + 63, tableY, { align: "center" });
    doc.text("PERÍODO", panelRightX + 84, tableY, { align: "center" });
    doc.text("JOGOS", panelRightX + 100, tableY, { align: "center" });

    tableY += 2.5;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(panelRightX + 3, tableY, panelRightX + panelRightW - 3, tableY);

    tableY += 5;

    const fmtDataCurta = (str) => {
        if (!str) return '--/--';
        const p = str.split('-');
        return p.length === 3 ? `${p[2]}/${p[1]}` : str;
    };

    acervoHistoricoGlobalSaaS.forEach((edicao) => {
        const cal = edicao.contrato || {};
        const dtIni = fmtDataCurta(cal.inicioJogos);
        const dtFim = fmtDataCurta(cal.fimTorneio);
        const qtdJogos = edicao.partidas ? Object.keys(edicao.partidas).length : 0;
        const modRaw = (edicao.modelo || 'barragem').toLowerCase();
        const modTxt = modRaw.charAt(0).toUpperCase() + modRaw.slice(1);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(15, 23, 42);
        const nomeTorneioRaw = cal.nomeTorneio || 'Torneio';
        const nomeTorneioTxt = nomeTorneioRaw.length > 36 ? nomeTorneioRaw.substring(0, 35) + "…" : nomeTorneioRaw;
        doc.text(nomeTorneioTxt, panelRightX + 3, tableY + 2.8);

        let pillFill = [245, 243, 255];
        let pillBorder = [221, 214, 254];
        let pillText = [139, 92, 246];

        if (modRaw === 'barragem') {
            pillFill = [224, 242, 254];
            pillBorder = [186, 230, 253];
            pillText = [2, 132, 199];
        } else if (modRaw === 'grupos') {
            pillFill = [220, 252, 231];
            pillBorder = [134, 239, 172];
            pillText = [22, 163, 74];
        }

        const pillW = 15;
        const pillX = panelRightX + 63 - (pillW / 2);

        doc.setFillColor(pillFill[0], pillFill[1], pillFill[2]);
        doc.setDrawColor(pillBorder[0], pillBorder[1], pillBorder[2]);
        doc.setLineWidth(0.15);
        doc.roundedRect(pillX, tableY - 0.7, pillW, 4.2, 1, 1, "FD");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.5);
        doc.setTextColor(pillText[0], pillText[1], pillText[2]);
        doc.text(modTxt, panelRightX + 63, tableY + 2.3, { align: "center" });

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(71, 85, 105);
        doc.text(`${dtIni} a ${dtFim}`, panelRightX + 84, tableY + 2.8, { align: "center" });

        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(15, 23, 42);
        doc.text(String(qtdJogos), panelRightX + 100, tableY + 2.8, { align: "center" });

        tableY += 7;
        doc.setDrawColor(241, 245, 249);
        doc.setLineWidth(0.15);
        doc.line(panelRightX + 3, tableY - 1.5, panelRightX + panelRightW - 3, tableY - 1.5);
    });

    const finalY = pageHeight - 20;
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.2);
    doc.line(marginX, finalY, pageWidth - marginX, finalY);

    const footerY = finalY + 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text("SetPoint SaaS", marginX, footerY);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(" • Relatório Geral do Acervo de Torneios", marginX + 21, footerY);
    doc.text("Documento gerado automaticamente pelo módulo de auditoria.", marginX, footerY + 3.5);

    const sigWidth = 45;
    const sigX = pageWidth - marginX - sigWidth;
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.3);
    doc.line(sigX, footerY + 2, pageWidth - marginX, footerY + 2);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text("Arbitragem / Gestão", sigX + (sigWidth / 2), footerY + 5.5, { align: "center" });

    const nomeArquivo = `Relatorio_Acervo_${nomeClube.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
    try {
        await processarSaidaPDFSaaS(doc, nomeArquivo, "Relatório Histórico");
    } catch (err) {
        console.error("❌ Erro ao exportar Relatório Histórico:", err);
        showToast("Erro ao gerar relatório PDF.", "error");
    }
}

/* ======================================================== */
/* 5. QUADRO ELIMINATÓRIO (MATA-MATA) & DOM LISTENERS       */
/* ======================================================== */

function abrirQuadroMataMataSaaS() {
    if (navigator.vibrate) navigator.vibrate(30);

    abaVisaoLeaderboardSaaS = 'TORNEIO';
    abaFaseAtivaSaaS = 'MATA_MATA';

    if (typeof abrirLeaderboardSaaS === 'function') {
        abrirLeaderboardSaaS();
    } else {
        showToast("Exibindo quadro eliminatório do torneio.", "info");
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const modalRanking = document.getElementById('modal-config-ranking');
    if (modalRanking) {
        const abas = modalRanking.querySelectorAll('.accordion-header');
        abas.forEach((aba, idx) => {
            aba.addEventListener('click', () => {
                if (idx === 5) carregarHistoricoTorneiosSaaS(); 
                
                if (window.innerWidth <= 768) {
                    setTimeout(() => {
                        const paiItem = aba.parentElement;
                        
                        if (paiItem && paiItem.classList.contains('active')) {
                            aba.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        } else {
                            if (abas.length > 0) {
                                abas[0].scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }
                        }
                    }, 320); 
                }
            });
        });
    }
});
