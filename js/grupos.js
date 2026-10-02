"use strict";

/**
 * ========================================================
 * 🏆 MÓDULO RANKING SAAS - VISÃO GRÁFICA DO MATA-MATA
 * Arquivo dedicado à montagem visual da árvore eliminatória
 * multi-colunas com navegação por blocos de 8 jogos (>16 atletas),
 * botões flutuantes no rodapé, setas inteligentes e PNG.
 * ========================================================
 */

// Variável de controle do bloco de 8 jogos ativo
let quadranteAtivoMataMataSaaS = 0;

function selecionarQuadranteSaaS(idxVal) {
    quadranteAtivoMataMataSaaS = parseInt(idxVal, 10) || 0;
    
    // Re-renderiza a árvore filtrando estritamente os 8 jogos do bloco selecionado
    const containerAlvo = document.getElementById('body-leaderboard-scroll');
    if (containerAlvo && window.chaveCatDataUltimaSaaS) {
        renderizarVisaoMataMataSaaS(
            containerAlvo, 
            window.chaveCatDataUltimaSaaS, 
            localStorage.getItem('jogadorLogadoId'),
            window.partidasCustomizadasUltimaSaaS
        );
    }
}

function atualizarVisibilidadeSetasSaaS() {
    const viewport = document.getElementById('bracket-scroll-viewport');
    const btnLeft = document.querySelector('#area-capture-matamata .bracket-nav-btn.left');
    const btnRight = document.querySelector('#area-capture-matamata .bracket-nav-btn.right'); 

    if (!viewport || !btnLeft || !btnRight) return;

    const temScrollHorizontal = viewport.scrollWidth > viewport.clientWidth + 5;

    if (!temScrollHorizontal) {
        btnLeft.style.display = 'none';
        btnRight.style.display = 'none';
        return;
    }

    const maxScroll = viewport.scrollWidth - viewport.clientWidth;
    const scrollAtual = viewport.scrollLeft;

    btnLeft.style.display = scrollAtual <= 5 ? 'none' : 'flex';
    btnRight.style.display = scrollAtual >= maxScroll - 5 ? 'none' : 'flex';
}

function rolarMataMataSaaS(direcao) {
    const viewport = document.getElementById('bracket-scroll-viewport');
    if (!viewport) return; 

    const deslocamento = 256; // Largura da coluna (240px) + Gap (16px)
    viewport.scrollBy({
        left: direcao * deslocamento,  
        behavior: 'smooth'
    });
}

function renderizarVisaoMataMataSaaS(containerAlvo, chaveCatData, idLogado, partidasCustomizadas = null) {
    if (!containerAlvo || !chaveCatData) return;

    // Guarda referências para permitir a re-renderização instantânea ao trocar no dropdown
    window.chaveCatDataUltimaSaaS = chaveCatData;
    window.partidasCustomizadasUltimaSaaS = partidasCustomizadas;

    const confRanking = (typeof configRegrasGlobal !== 'undefined' && configRegrasGlobal.ranking) ? configRegrasGlobal.ranking : {};
    const rodadaAtualBanco = chaveCatData.rodada1 || [];
    const historicoRodadas = chaveCatData.historicoRodadas || {};
    const partidasGlobal = partidasCustomizadas || ((typeof rankingPartidasGlobal !== 'undefined' && rankingPartidasGlobal) ? rankingPartidasGlobal : {});
    const chaveCat = (typeof abaClasseAtivaSaaS !== 'undefined' && typeof abaGeneroAtivaSaaS !== 'undefined')
        ? (confRanking.divisaoGenero === 'unificado' ? `${abaClasseAtivaSaaS}_UNIFICADO` : `${abaClasseAtivaSaaS}_${abaGeneroAtivaSaaS}`)
        : '';

    const totalClassific = parseInt(chaveCatData.totalClassificados, 10) || 8;
    const faseInicial = (typeof calcularPotenciaDeDoisSuperiorSaaS === 'function')
        ? calcularPotenciaDeDoisSuperiorSaaS(totalClassific)
        : (parseInt(chaveCatData.faseAtual, 10) || 8);

    // 🎯 CORREÇÃO CRÍTICA: Aceita posSeedOverride enviado pelo histórico e impede busca no ranking ao vivo
    const buscarNomeAtleta = (id, tagStatusHtml = '', posSeedOverride = '') => {
        if (!id) {
            return `
                <div style="display: flex; align-items: center; flex: 1; min-width: 0;">
                    <span class="seed-num" style="display: inline-block; width: 16px; flex-shrink: 0; font-weight: 400; color: #94a3b8;"></span>
                    <span style="color: #94a3b8; font-weight: 500;">A definir</span>
                </div>
            `;
        }
        const j = (typeof jogadoresGlobal !== 'undefined' && jogadoresGlobal[id]) ? jogadoresGlobal[id] : {};
        const nomeStr = j.apelido || j.nomeCompleto || 'A definir';
        const cap = (s) => (typeof capitalizarNome === 'function') ? capitalizarNome(s) : s; 

        let posClean = '';
        if (posSeedOverride !== null && posSeedOverride !== undefined && posSeedOverride !== '') {
            posClean = String(posSeedOverride).replace('º', '').trim();
        } else {
            const posRaw = (typeof obterPosicaoTextoRankingSaaS === 'function' && obterPosicaoTextoRankingSaaS(j.nomeCompleto || j.apelido || nomeStr)) || '';
            posClean = posRaw.replace('º', '').trim();
        }
        
        const seedHtml = `<span class="seed-num" style="display: inline-block; width: 16px; flex-shrink: 0; font-weight: 400; color: #94a3b8; text-align: left;">${posClean}</span>`;
        const nomeForm = (id === idLogado) ? `${cap(nomeStr)} <span class="tag-voce" style="font-size: 10px; color: #15803d; font-weight: 800;">(Você)</span>` : cap(nomeStr);

        return `
            <div style="display: flex; align-items: center; flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                ${seedHtml}
                <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex-shrink: 1;">${nomeForm}</span>
                ${tagStatusHtml}
            </div>
        `;
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

    const buscarDadosAtpPartida = (idA, idB) => {
        if (!idA || !idB) {
            return {
                estaFinalizada: false,
                vencedorId: null,
                htmlJ1: '<span style="width: 24px; min-width: 24px; text-align: center; display: inline-block; color: #cbd5e1;">-</span>',
                htmlJ2: '<span style="width: 24px; min-width: 24px; text-align: center; display: inline-block; color: #cbd5e1;">-</span>',
                tagJ1: '',
                tagJ2: ''
            };
        }

        const pFound = Object.values(partidasGlobal).find(p => {
            if (p.categoria && p.categoria !== chaveCat && chaveCat !== '') return false;
            const dp = p.dadosPlacar || {};
            if (p.tagGrupoRanking || dp.tagGrupoRanking) return false;
            return (p.jogador1Id === idA && p.jogador2Id === idB) || (p.jogador1Id === idB && p.jogador2Id === idA);
        });

        if (pFound && pFound.dadosPlacar) {
            const dp = pFound.dadosPlacar || {};
            const p = dp.parciais || {};
            const isJ1Original = (pFound.jogador1Id === idA);

            let tagJ1 = '', tagJ2 = '';
            const badgeRet = `<span style="background: #ef4444; color: #ffffff; font-size: 8.5px; font-weight: 800; padding: 1px 4px; border-radius: 4px; margin-left: 4px; display: inline-block; line-height: 1.2; flex-shrink: 0;">RET</span>`;

            const isRET = dp.isRET === true || (dp.placarFormatado && dp.placarFormatado.includes("RET"));
            const isWO = dp.isWO === true || (dp.placarFormatado && dp.placarFormatado.includes("W.O."));

            if (isRET) {
                const desistiuJ1Orig = (dp.desistenteCodigo === 'J1') || (pFound.vencedorId && pFound.vencedorId === pFound.jogador2Id);
                if (isJ1Original) {
                    if (desistiuJ1Orig) tagJ1 = badgeRet;
                    else tagJ2 = badgeRet;
                } else {
                    if (desistiuJ1Orig) tagJ2 = badgeRet;
                    else tagJ1 = badgeRet;
                }
            }

            if (isWO) {
                const j1Venceu = (pFound.vencedorId === idA);
                const txtWoWinner = `<span style="font-size: 11px; font-weight: 800; color: #0f172a; display: inline-block;">W.O.</span>`;
                const emptyLoser = `<span style="width: 24px; min-width: 24px; display: inline-block;"></span>`;

                return {
                    estaFinalizada: true,
                    vencedorId: pFound.vencedorId,
                    htmlJ1: j1Venceu ? txtWoWinner : emptyLoser,
                    htmlJ2: j1Venceu ? emptyLoser : txtWoWinner,
                    tagJ1: '',
                    tagJ2: ''
                };
            }

            const fmtSet = (pts, tb, isWinner) => {
                if (pts === undefined || pts === null || pts === "") return '';
                const style = isWinner ? 'font-weight: 800; color: #0f172a;' : 'font-weight: 600; color: #64748b;';
                const tbSup = (tb !== undefined && tb !== null && tb !== "")
                    ? `<sup style="font-size: 8px; position: absolute; top: -3px; right: -1px; color: #94a3b8; font-weight: 700; line-height: 1;">${tb}</sup>`
                    : '';
                return `<span style="width: 24px; min-width: 24px; text-align: center; display: inline-block; position: relative; flex-shrink: 0; ${style}">${pts}${tbSup}</span>`;
            };

            const temSet1 = (p.set1 && p.set1.j1 !== undefined && p.set1.j1 !== "");
            const temSet2 = (p.set2 && p.set2.j1 !== undefined && p.set2.j1 !== "");
            const temSet3 = (p.set3 && p.set3.j1 !== undefined && p.set3.j1 !== "");

            let hJ1 = '', hJ2 = '';

            if (temSet1) {
                const w1 = calcSetWinner(p.set1.j1, p.set1.j2, p.set1.tbJ1, p.set1.tbJ2);
                const valJ1 = isJ1Original ? p.set1.j1 : p.set1.j2;
                const valJ2 = isJ1Original ? p.set1.j2 : p.set1.j1;
                const tbJ1 = isJ1Original ? p.set1.tbJ1 : p.set1.tbJ2;
                const tbJ2 = isJ1Original ? p.set1.tbJ2 : p.set1.tbJ1;
                const winJ1 = isJ1Original ? (w1 === 1) : (w1 === 2);
                const winJ2 = isJ1Original ? (w1 === 2) : (w1 === 1);

                hJ1 += fmtSet(valJ1, tbJ1, winJ1);
                hJ2 += fmtSet(valJ2, tbJ2, winJ2);
            }

            if (temSet2) {
                const w2 = calcSetWinner(p.set2.j1, p.set2.j2, p.set2.tbJ1, p.set2.tbJ2);
                const valJ1 = isJ1Original ? p.set2.j1 : p.set2.j2;
                const valJ2 = isJ1Original ? p.set2.j2 : p.set2.j1;
                const tbJ1 = isJ1Original ? p.set2.tbJ1 : p.set2.tbJ2;
                const tbJ2 = isJ1Original ? p.set2.tbJ2 : p.set2.tbJ1;
                const winJ1 = isJ1Original ? (w2 === 1) : (w2 === 2);
                const winJ2 = isJ1Original ? (w2 === 2) : (w2 === 1);

                hJ1 += fmtSet(valJ1, tbJ1, winJ1);
                hJ2 += fmtSet(valJ2, tbJ2, winJ2);
            }

            if (temSet3) {
                const w3 = calcSetWinner(p.set3.j1, p.set3.j2, p.set3.tbJ1, p.set3.tbJ2);
                const valJ1 = isJ1Original ? p.set3.j1 : p.set3.j2;
                const valJ2 = isJ1Original ? p.set3.j2 : p.set3.j1;
                const tbJ1 = isJ1Original ? p.set3.tbJ1 : p.set3.tbJ2;
                const tbJ2 = isJ1Original ? p.set3.tbJ2 : p.set3.tbJ1;
                const winJ1 = isJ1Original ? (w3 === 1) : (w3 === 2);
                const winJ2 = isJ1Original ? (w3 === 2) : (w3 === 1);

                hJ1 += fmtSet(valJ1, tbJ1, winJ1);
                hJ2 += fmtSet(valJ2, tbJ2, winJ2);
            }

            if (!temSet1 && !temSet2 && !temSet3) {
                hJ1 = '<span style="width: 24px; min-width: 24px; text-align: center; display: inline-block; color: #cbd5e1;">-</span>';
                hJ2 = '<span style="width: 24px; min-width: 24px; text-align: center; display: inline-block; color: #cbd5e1;">-</span>';
            }

            return {
                estaFinalizada: true,
                vencedorId: pFound.vencedorId,
                htmlJ1: hJ1,
                htmlJ2: hJ2,
                tagJ1,
                tagJ2
            };
        }

        return {
            estaFinalizada: false,
            vencedorId: null,
            htmlJ1: '<span style="width: 24px; min-width: 24px; text-align: center; display: inline-block; color: #cbd5e1;">-</span>',
            htmlJ2: '<span style="width: 24px; min-width: 24px; text-align: center; display: inline-block; color: #cbd5e1;">-</span>',
            tagJ1: '',
            tagJ2: ''
        };
    };

    const totalJogosR1 = faseInicial / 2;
    const jogosPorBloco = 8;

    let htmlDropdownSaaS = '';
    if (totalJogosR1 > jogosPorBloco) {
    const totalBlocos = Math.ceil(totalJogosR1 / jogosPorBloco);
		let htmlOptions = '';

		for (let b = 0; b < totalBlocos; b++) {
			const ini = (b * jogosPorBloco) + 1;
			const fim = Math.min((b + 1) * jogosPorBloco, totalJogosR1);
			const selected = (b === quadranteAtivoMataMataSaaS) ? 'selected' : '';
			htmlOptions += `<option value="${b}" ${selected}>📍 Jogos ${ini} a ${fim}</option>`;
		}

        htmlDropdownSaaS = `
            <div class="bracket-quadrante-row" data-html2canvas-ignore="true">
                <select id="select-saas-quadrante" class="select-saas-quadrante" onchange="selecionarQuadranteSaaS(this.value)">
                    ${htmlOptions}
                </select>
            </div>
        `;
    }
	
	// Construção da barra de bolinhas (dots) para navegação mobile
    let htmlDotsSaaS = '';
    if (totalJogosR1 > jogosPorBloco) {
        const totalBlocos = Math.ceil(totalJogosR1 / jogosPorBloco);
        let dotsItems = '';
        for (let b = 0; b < totalBlocos; b++) {
            const activeClass = (b === quadranteAtivoMataMataSaaS) ? 'active' : '';
            dotsItems += `<div class="dot-item ${activeClass}" onclick="selecionarQuadranteSaaS(${b})" title="Bloco ${b + 1}"></div>`;
        }
        htmlDotsSaaS = `<div class="dots-bar-saas" data-html2canvas-ignore="true">${dotsItems}</div>`;
    }

    let htmlColunas = '';


    for (let pot = faseInicial; pot >= 2; pot /= 2) {
        const rotuloFase = (typeof obterRotuloFaseMataMataSaaS === 'function')
            ? obterRotuloFaseMataMataSaaS(pot)
            : `Fase ${pot}`;

        // 🟢 1. Preenche a variável rodadaFase com os jogos do banco/histórico
        let rodadaFase = [];
        if (parseInt(chaveCatData.faseAtual, 10) === pot && rodadaAtualBanco.length > 0) {
            rodadaFase = rodadaAtualBanco;
        } else if (historicoRodadas[pot] || historicoRodadas[String(pot)]) {
            rodadaFase = historicoRodadas[pot] || historicoRodadas[String(pot)]; 
        } else {
            const numJogos = pot / 2;
            for (let i = 0; i < numJogos; i++) {
                rodadaFase.push({ fase: pot, jogador1Id: null, jogador2Id: null, isBye: false });
            }
        }

        // 🟢 2. Cálculo do intervalo proporcional de jogos para o quadrante ativo
        const fatorEscala = faseInicial / pot;
        const inicioJogoPot = Math.floor((quadranteAtivoMataMataSaaS * jogosPorBloco) / fatorEscala);
        const fimJogoPot = Math.ceil(((quadranteAtivoMataMataSaaS + 1) * jogosPorBloco) / fatorEscala);

        let htmlCardsJogo = '';

        rodadaFase.forEach((confItem, idxJogo) => {
            // FILTRO ESTRITO: Exibe APENAS os 8 jogos do bloco selecionado
            if (totalJogosR1 > jogosPorBloco) {
                if (idxJogo < inicioJogoPot || idxJogo >= fimJogoPot) {
                    return; // Oculta jogos fora do intervalo de 8
                }
            }

            if (!confItem) {
                confItem = { fase: pot, jogador1Id: null, jogador2Id: null, isBye: false };
            }
            
            const p1 = confItem.jogador1Id;
            const p2 = confItem.jogador2Id;
            const ehBye = confItem.isBye || (p1 && !p2 && pot === faseInicial);

            const idAncora = (pot === faseInicial && totalJogosR1 > jogosPorBloco && (idxJogo % jogosPorBloco === 0))
                ? `id="ancora-quadrante-${Math.floor(idxJogo / jogosPorBloco)}"`
                : '';

            // 🎯 PASSAGEM DIRETA DAS SEMENTES DO HISTÓRICO PARA A INTERFACE
            const seedP1 = confItem.posicaoP1 || (confItem.dadosPlacar ? confItem.dadosPlacar.posicaoP1 : '') || '';
            const seedP2 = confItem.posicaoP2 || (confItem.dadosPlacar ? confItem.dadosPlacar.posicaoP2 : '') || '';

            if (ehBye) {
                const idBye = p1 || p2;
                const name1 = buscarNomeAtleta(idBye, '', seedP1);
                const ehVoce = (idLogado && idLogado === idBye);

                htmlCardsJogo += `
                    <div class="match-card bye ${ehVoce ? 'voce' : ''}" ${idAncora}>
                        <div class="match-player winner" style="padding: 2px 0; border-bottom: 1px dashed #cbd5e1;">
                            ${name1}
                            <div style="display: flex; align-items: center; justify-content: flex-end; gap: 2px; flex-shrink: 0; margin-left: auto;">
                                <span class="player-score bye" style="font-size: 10px; font-weight: 800; color: #15803d; background: #dcfce7; padding: 1px 6px; border-radius: 4px; flex-shrink: 0;">BYE</span>
                            </div>
                        </div>
                        <div class="match-player" style="padding: 2px 0; font-weight: 500; color: #94a3b8; font-style: italic; font-size: 11px;">
                            <div style="display: flex; align-items: center; flex: 1; min-width: 0;">
                                <span style="display: inline-block; width: 12px; flex-shrink: 0;"></span>
                                <span>Classificado (Folga)</span>
                            </div>
                            <div style="width: 14px; min-width: 14px; flex-shrink: 0;"></div>
                        </div>
                    </div>
                `;
            } else {
                const infoPlacar = buscarDadosAtpPartida(p1, p2);
                const name1 = buscarNomeAtleta(p1, infoPlacar.tagJ1, seedP1);
                const name2 = buscarNomeAtleta(p2, infoPlacar.tagJ2, seedP2);
                const ehVoce = (idLogado && (idLogado === p1 || idLogado === p2));

                const p1Venceu = infoPlacar.estaFinalizada && infoPlacar.vencedorId === p1;
                const p2Venceu = infoPlacar.estaFinalizada && infoPlacar.vencedorId === p2;

                const classJ1 = p1Venceu ? 'winner' : '';
                const classJ2 = p2Venceu ? 'winner' : '';

                const setaJ1 = p1Venceu
                    ? '<span style="width: 14px; min-width: 14px; font-size: 10px; color: #0f172a; text-align: center; display: inline-block; flex-shrink: 0;">◀</span>'
                    : '<span style="width: 14px; min-width: 14px; display: inline-block; flex-shrink: 0;"></span>';

                const setaJ2 = p2Venceu
                    ? '<span style="width: 14px; min-width: 14px; font-size: 10px; color: #0f172a; text-align: center; display: inline-block; flex-shrink: 0;">◀</span>'
                    : '<span style="width: 14px; min-width: 14px; display: inline-block; flex-shrink: 0;"></span>';

                htmlCardsJogo += `
                    <div class="match-card ${p1 && p2 ? 'active-match' : ''} ${ehVoce ? 'voce' : ''}" ${idAncora}>
                        <div class="match-player ${classJ1}" style="padding: 2px 0; border-bottom: 1px dashed #f1f5f9;">
                            ${name1}
                            <div style="display: flex; align-items: center; justify-content: flex-end; gap: 3px; flex-shrink: 0; margin-left: auto;">
                                ${infoPlacar.htmlJ1}
                                ${setaJ1}
                            </div>
                        </div>
                        <div class="match-player ${classJ2}" style="padding: 3px 0;">
                            ${name2}
                            <div style="display: flex; align-items: center; justify-content: flex-end; gap: 3px; flex-shrink: 0; margin-left: auto;">
                                ${infoPlacar.htmlJ2}
                                ${setaJ2}
                            </div>
                        </div>
                    </div>
                `;
            }
        });

        htmlColunas += `
            <div class="bracket-column">
                <div class="column-header">${rotuloFase}</div>
                <div class="bracket-column-matches">
                    ${htmlCardsJogo}
                </div>
            </div>
        `;
    }

    const btnNavLeft = `
        <button type="button" class="bracket-nav-btn left" onclick="rolarMataMataSaaS(-1)" title="Fase Anterior" data-html2canvas-ignore="true">
            <span class="material-icons" style="font-size: 18px;">chevron_left</span>
        </button>
    `;

    const btnNavRight = `
        <button type="button" class="bracket-nav-btn right" onclick="rolarMataMataSaaS(1)" title="Próxima Fase" data-html2canvas-ignore="true">
            <span class="material-icons" style="font-size: 18px;">chevron_right</span>
        </button>
    `;

    const btnPngHtml = `
        <button type="button" class="btn-png-saas" onclick="exportarMataMataPNGSaaS()" title="Exportar Chave em PNG" data-html2canvas-ignore="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5 9V17C5 18.1046 5.89543 19 7 19H15" stroke="#10b981" stroke-width="2.5" stroke-linecap="round"/>
                <rect x="9" y="4" width="11" height="11" rx="2" fill="#10b981"/>
                <text x="14.5" y="11.8" fill="#ffffff" font-size="4.8" font-family="Arial, sans-serif" font-weight="900" text-anchor="middle">PNG</text>
            </svg>
        </button>
    `;

    containerAlvo.innerHTML = `
        <div class="full-bracket-container" id="area-capture-matamata" style="position: relative; width: 100%;">
            ${htmlDropdownSaaS}
            ${btnNavLeft}
            ${btnNavRight}
            <div class="bracket-scroll-viewport" id="bracket-scroll-viewport">
                <div class="bracket-wrapper">
                    ${htmlColunas}
                </div>
            </div>
            ${htmlDotsSaaS}
            <button type="button" class="btn-voltar-arvore-saas" onclick="alternarVisaoMataMataSaaS()" title="Voltar para a Visão Lista" data-html2canvas-ignore="true">
                <span class="material-icons" style="font-size: 20px;">format_list_bulleted</span>
            </button>
            ${btnPngHtml}
        </div>
    `;

    setTimeout(() => {
        const viewport = document.getElementById('bracket-scroll-viewport');
        if (viewport) {
            viewport.onscroll = atualizarVisibilidadeSetasSaaS;
            atualizarVisibilidadeSetasSaaS();

            // Captura de gestos VERTICAIS no celular para alternar blocos de 8 jogos
            if (totalJogosR1 > jogosPorBloco) {
                let touchStartX = 0;
                let touchStartY = 0;

                viewport.addEventListener('touchstart', (e) => {
                    touchStartX = e.changedTouches[0].screenX;
                    touchStartY = e.changedTouches[0].screenY;
                }, { passive: true });

                viewport.addEventListener('touchend', (e) => {
                    const touchEndX = e.changedTouches[0].screenX;
                    const touchEndY = e.changedTouches[0].screenY;

                    const diffX = touchEndX - touchStartX;
                    const diffY = touchEndY - touchStartY;

                    // Detecta se a rolagem foi predominantemente VERTICAL (mínimo 40px)
                    if (Math.abs(diffY) > 40 && Math.abs(diffY) > Math.abs(diffX)) {
                        const totalBlocos = Math.ceil(totalJogosR1 / jogosPorBloco);

                        if (diffY < 0 && quadranteAtivoMataMataSaaS < totalBlocos - 1) {
                            // Roulou para CIMA -> Muda para os próximos 8 jogos (ex: 9 a 16)
                            selecionarQuadranteSaaS(quadranteAtivoMataMataSaaS + 1);
                        } else if (diffY > 0 && quadranteAtivoMataMataSaaS > 0) {
                            // Roulou para BAIXO -> Volta para os 8 jogos anteriores (ex: 1 a 8)
                            selecionarQuadranteSaaS(quadranteAtivoMataMataSaaS - 1);
                        }
                    }
                }, { passive: true });
            }
        }
    }, 50);
}

async function exportarMataMataPNGSaaS() {
    if (navigator.vibrate) navigator.vibrate(30);

    const areaCaptura = document.getElementById('area-capture-matamata');
    const wrapperOriginal = areaCaptura ? areaCaptura.querySelector('.bracket-wrapper') : null;

    if (!areaCaptura || !wrapperOriginal) {
        if (typeof showToast === 'function') showToast("Área do Mata-Mata não encontrada.", "error");
        return;
    }

    if (typeof showToast === 'function') showToast("Gerando imagem panorâmica da chave completa...", "info");

    if (typeof window.html2canvas === 'undefined') {
        try {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        } catch (err) {
            console.error("❌ Erro html2canvas:", err);
            if (typeof showToast === 'function') showToast("Erro ao carregar motor de captura.", "error");
            return;
        }
    }

    // 🎯 MUDANÇA DE ESTRATÉGIA: CLONE OFF-SCREEN
    // Criamos um container isolado fora do ecrã e sem restrições de modal
    const cloneContainer = document.createElement('div');
    cloneContainer.style.position = 'absolute';
    cloneContainer.style.top = '-9999px';
    cloneContainer.style.left = '-9999px';
    cloneContainer.style.backgroundColor = '#ffffff';
    cloneContainer.style.padding = '24px';
    cloneContainer.style.borderRadius = '12px';
    cloneContainer.style.boxSizing = 'border-box';

    // Clona as colunas originais
    const wrapperClone = wrapperOriginal.cloneNode(true);
    wrapperClone.style.display = 'flex';
    wrapperClone.style.flexDirection = 'row';
    wrapperClone.style.gap = '16px';
    wrapperClone.style.width = 'max-content';
    wrapperClone.style.overflow = 'visible';

    // 🎯 Anula o 'position: sticky' no clone para corrigir o cálculo do html2canvas e fixar os títulos no TOPO
    wrapperClone.querySelectorAll('.bracket-column').forEach(col => {
        col.style.setProperty('display', 'flex', 'important');
        col.style.setProperty('flex-direction', 'column', 'important');
        col.style.setProperty('justify-content', 'flex-start', 'important');
    });

    wrapperClone.querySelectorAll('.column-header').forEach(header => {
        header.style.setProperty('position', 'static', 'important');
        header.style.setProperty('top', 'auto', 'important');
        header.style.setProperty('order', '-1', 'important');
        header.style.setProperty('margin-top', '0', 'important');
        header.style.setProperty('margin-bottom', '16px', 'important');
    });

    wrapperClone.querySelectorAll('.bracket-column-matches').forEach(matches => {
        matches.style.setProperty('margin-top', '0', 'important');
    });

    // Remove elementos de navegação/botões que não devem sair no PNG
    wrapperClone.querySelectorAll('[data-html2canvas-ignore="true"]').forEach(el => el.remove());

    // Identificação do Clube e Contexto do Torneio
    const elNomeClube = document.getElementById('txt-nome-clube');
    let nomeClubeRaw = elNomeClube ? elNomeClube.textContent.trim() : 'Clube';
    if (!nomeClubeRaw || nomeClubeRaw.toUpperCase() === 'CARREGANDO...') {
        nomeClubeRaw = localStorage.getItem('setpoint_jogador_clube_nome') || 'Clube Olímpico';
    }

    const ehHistorico = !!(typeof edicaoHistoricaFocoSaaS !== 'undefined' && edicaoHistoricaFocoSaaS);
    const confRanking = (typeof configRegrasGlobal !== 'undefined' && configRegrasGlobal && configRegrasGlobal.ranking) ? configRegrasGlobal.ranking : {};
    const cal = ehHistorico ? (edicaoHistoricaFocoSaaS.contrato || {}) : (confRanking.calendario || {});
    const faseAtual = parseInt(confRanking.faseAtual, 10) || 1;
    const modelo = cal.formatoTorneio || confRanking.calendario?.formatoTorneio || 'grupos';
    const ehHomologadoAtivo = !ehHistorico && ((modelo !== "grupos" && faseAtual >= 4) || (modelo === "grupos" && faseAtual >= 5));

    // Formatação de Categoria e Período (DD/MM para torneio ativo, DD/MM/AAAA para acervo histórico)
    const nomeTorneio = cal.nomeTorneio || 'Torneio Oficial';
    const clsTxt = typeof abaClasseAtivaSaaS !== 'undefined' ? `Classe ${abaClasseAtivaSaaS}` : '';
    const genTxt = (typeof abaGeneroAtivaSaaS !== 'undefined' && abaGeneroAtivaSaaS !== 'UNIFICADO') 
        ? (abaGeneroAtivaSaaS.charAt(0) + abaGeneroAtivaSaaS.slice(1).toLowerCase()) 
        : '';
    const catFormatada = [clsTxt, genTxt].filter(Boolean).join(' • ');

    const fmtData = (str, comAno = false) => {
        if (!str) return '';
        const p = str.split('-');
        if (p.length === 3) {
            return comAno ? `${p[2]}/${p[1]}/${p[0]}` : `${p[2]}/${p[1]}`;
        }
        return str;
    };
    const dtInicio = fmtData(cal.inicioJogos, ehHistorico);
    const dtFim = fmtData(cal.fimTorneio, ehHistorico);
    const periodoStr = (dtInicio && dtFim) ? `${dtInicio} a ${dtFim}` : '';

    const dataHojeStr = new Date().toLocaleDateString('pt-BR');

    // Badges Contextuais de Estado
    let badgeEstadoHtml = '';
    if (ehHistorico) {
        badgeEstadoHtml = `<span style="background: #f1f5f9; color: #475569; font-size: 11px; font-weight: 800; padding: 3px 10px; border-radius: 12px; border: 1px solid #cbd5e1; font-family: sans-serif;">[Acervo Histórico]</span>`;
    } else if (ehHomologadoAtivo) {
        badgeEstadoHtml = `<span style="background: #dcfce7; color: #15803d; font-size: 11px; font-weight: 800; padding: 3px 10px; border-radius: 12px; border: 1px solid #86efac; font-family: sans-serif;">✓ Homologado</span>`;
    }

    const badgePeriodoHtml = periodoStr 
        ? `<span style="background: #f1f5f9; color: #475569; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 8px; border: 1px solid #cbd5e1; font-family: sans-serif; display: inline-flex; align-items: center; gap: 4px;">📅 ${periodoStr}</span>` 
        : '';

    // Cabeçalho elegante e completo no Padrão SaaS
    const headerClone = document.createElement('div');
    headerClone.style.marginBottom = '16px';
    headerClone.style.paddingBottom = '12px';
    headerClone.style.borderBottom = '2px solid #e2e8f0';
    headerClone.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; font-family: sans-serif; margin-bottom: 4px;">
            <h2 style="margin: 0; font-size: 18px; font-weight: 800; color: #0f172a;">🏆 ${nomeClubeRaw.toUpperCase()}</h2>
            ${badgeEstadoHtml ? `<div>${badgeEstadoHtml}</div>` : ''}
        </div>
        <div style="font-size: 13.5px; font-weight: 800; color: #2563eb; margin-bottom: 8px; font-family: sans-serif;">
            ${nomeTorneio}${catFormatada ? ' — ' + catFormatada : ''}
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; font-family: sans-serif;">
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <span style="font-size: 11.5px; color: #64748b; font-weight: 600;">Fase Eliminatória • Modelo Grupos (Chaves)</span>
                ${badgePeriodoHtml}
            </div>
            <span style="font-size: 11px; color: #64748b; font-weight: 600;">${dataHojeStr}</span>
        </div>
    `;

    cloneContainer.appendChild(headerClone);
    cloneContainer.appendChild(wrapperClone);
    document.body.appendChild(cloneContainer);

    try {
        const larguraExata = cloneContainer.scrollWidth;
        const alturaExata = cloneContainer.scrollHeight;

        const canvas = await window.html2canvas(cloneContainer, {
            scale: 2, // Resolução HD
            useCORS: true,
            backgroundColor: '#ffffff',
            width: larguraExata,
            height: alturaExata,
            windowWidth: larguraExata + 100,
            windowHeight: alturaExata + 100
        });

        // Limpa o clone do documento
        document.body.removeChild(cloneContainer);

        const imageBase64 = canvas.toDataURL('image/png');
        const nomeArquivo = `MataMata_${nomeClubeRaw.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.png`;
        const isNative = typeof window.Capacitor !== 'undefined' && window.Capacitor.isNativePlatform();

        if (isNative) {
            const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
            const Filesystem = window.Capacitor.Plugins.Filesystem;
            const FileOpener = window.Capacitor.Plugins.FileOpener;

            const fileResult = await Filesystem.writeFile({
                path: nomeArquivo,
                data: cleanBase64,
                directory: 'CACHE'
            });

            await FileOpener.openFile({
                path: fileResult.uri,
                mimeType: 'image/png'
            });

            if (typeof showToast === 'function') showToast("Chave completa exportada em PNG!", "success");
        } else {
            const link = document.createElement('a');
            link.download = nomeArquivo;
            link.href = imageBase64;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link); 

            if (typeof showToast === 'function') showToast("Chave completa exportada em PNG!", "success");
        }
    } catch (err) {
        if (document.body.contains(cloneContainer)) {
            document.body.removeChild(cloneContainer);
        }
        console.error("❌ Erro captura Mata-Mata:", err);
        if (typeof showToast === 'function') showToast("Erro ao gerar imagem PNG.", "error");
    }
}