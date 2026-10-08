"use strict";

/**
 * ========================================================
 * 🏆 MÓDULO RANKING SAAS - VISÃO GRÁFICA DO MATA-MATA
 * Arquivo dedicado à montagem visual da árvore eliminatória
 * multi-colunas com navegação por blocos de 8 jogos (>16 atletas),
 * botões flutuantes no rodapé, setas inteligentes e PNG.
 * ========================================================
 */

// Variáveis de controle do bloco, da fase focada e temporizador do toque
let quadranteAtivoMataMataSaaS = 0;
let faseFocoMataMataSaaS = null;
let timerScrollMataMataSaaS = null;

function agendarVerificacaoFaseSaaS() {
    if (timerScrollMataMataSaaS) clearTimeout(timerScrollMataMataSaaS);
    timerScrollMataMataSaaS = setTimeout(() => {
        verificarEAtualizarFaseFocadaSaaS();
    }, 180); // Aguarda a rolagem do dedo parar para recriar o HTML suavemente
}

function selecionarQuadranteSaaS(idxVal) {
    quadranteAtivoMataMataSaaS = parseInt(idxVal, 10) || 0;
    
    const viewport = document.getElementById('bracket-scroll-viewport');
    const scrollSalvo = viewport ? viewport.scrollLeft : 0;
    const containerAlvo = document.getElementById('body-leaderboard-scroll'); 

    if (containerAlvo && window.chaveCatDataUltimaSaaS) {
        renderizarVisaoMataMataSaaS(
            containerAlvo, 
            window.chaveCatDataUltimaSaaS, 
            localStorage.getItem('jogadorLogadoId'),
            window.partidasCustomizadasUltimaSaaS
        );

        const novoViewport = document.getElementById('bracket-scroll-viewport');
        if (novoViewport) {
            const ehMobile = window.innerWidth <= 768;
            novoViewport.style.scrollBehavior = 'auto';
            novoViewport.scrollLeft = scrollSalvo;

            // 📱 NO TELEMÓVEL: Faz scroll suave vertical até ao bloco de jogos selecionado
            if (ehMobile) {
                const elAncora = document.getElementById(`ancora-quadrante-${quadranteAtivoMataMataSaaS}`);
                if (elAncora) {
                    elAncora.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }

            setTimeout(() => {
                novoViewport.style.scrollBehavior = '';
            }, 50);
        }
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


function verificarEAtualizarFaseFocadaSaaS() {
    const ehMobile = window.innerWidth <= 768;

    // 📱 NO CELULAR: Cancela a re-renderização no scroll horizontal!
    // A chave do bloco já está montada e a rolagem lateral é 100% nativa, suave e sem "efeito mola".
    if (ehMobile) return;

    const viewport = document.getElementById('bracket-scroll-viewport');
    if (!viewport || !window.chaveCatDataUltimaSaaS) return;

    const scrollLeft = viewport.scrollLeft;
    const larguraColuna = 256; // 240px + 16px gap
    const colIdx = Math.max(0, Math.floor((scrollLeft + 60) / larguraColuna));

    const totalClassific = parseInt(window.chaveCatDataUltimaSaaS.totalClassificados, 10) || 8;
    const faseInicial = (typeof calcularPotenciaDeDoisSuperiorSaaS === 'function')
        ? calcularPotenciaDeDoisSuperiorSaaS(totalClassific)
        : (parseInt(window.chaveCatDataUltimaSaaS.faseAtual, 10) || 8);

    const potArray = [];
    for (let pot = faseInicial; pot >= 2; pot /= 2) {
        potArray.push(pot);
    }

    const potFocadoNova = potArray[Math.min(colIdx, potArray.length - 1)];

    if (potFocadoNova && potFocadoNova !== faseFocoMataMataSaaS) {
        faseFocoMataMataSaaS = potFocadoNova;
        quadranteAtivoMataMataSaaS = 0; // Reseta para o bloco 1 da nova fase

        const scrollSalvo = viewport.scrollLeft;
        const containerAlvo = document.getElementById('body-leaderboard-scroll');

        if (containerAlvo) {
            renderizarVisaoMataMataSaaS(
                containerAlvo,
                window.chaveCatDataUltimaSaaS,
                localStorage.getItem('jogadorLogadoId'),
                window.partidasCustomizadasUltimaSaaS
            );

            const novoViewport = document.getElementById('bracket-scroll-viewport');
            if (novoViewport) {
                novoViewport.style.scrollBehavior = 'auto';
                novoViewport.scrollLeft = scrollSalvo;
                setTimeout(() => {
                    novoViewport.style.scrollBehavior = '';
                }, 50);
            }
        }
    }
}


function renderizarVisaoMataMataSaaS(containerAlvo, chaveCatData, idLogado, partidasCustomizadas = null) {
    if (!containerAlvo || !chaveCatData) return;
	
	const ehMobile = window.innerWidth <= 768;

    // Guarda referências para permitir a re-renderização instantânea ao trocar no dropdown
    window.chaveCatDataUltimaSaaS = chaveCatData;
    window.partidasCustomizadasUltimaSaaS = partidasCustomizadas;

    const confRanking = (typeof configRegrasGlobal !== 'undefined' && configRegrasGlobal.ranking) ? configRegrasGlobal.ranking : {};
	
	const ehHistorico = !!(typeof edicaoHistoricaFocoSaaS !== 'undefined' && edicaoHistoricaFocoSaaS);
	const cal = ehHistorico ? (edicaoHistoricaFocoSaaS.contrato || {}) : (confRanking.calendario || {});
	const faseInicialGrupos = ehHistorico
		? (cal.faseInicial || cal.grupos?.faseInicial || 'grupos')
		: (confRanking.grupos?.faseInicial || "grupos"); 
	const modeloTorneio = cal.formatoTorneio || confRanking.calendario?.formatoTorneio || 'grupos';
	const ehMataMataDiretoHistorico = ehHistorico && (modeloTorneio === 'grupos' && faseInicialGrupos === 'matamata');

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
					<span class="seed-num" style="display: inline-block; width: 16px; flex-shrink: 0; font-size: 10px; font-weight: 400; color: #94a3b8;"></span>
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
        
        const seedHtml = `<span class="seed-num" style="display: inline-block; width: 16px; flex-shrink: 0; font-size: 10px; font-weight: 400; color: #94a3b8; text-align: left;">${posClean}</span>`;        
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

    if (!faseFocoMataMataSaaS || faseFocoMataMataSaaS > faseInicial) {
        faseFocoMataMataSaaS = faseInicial;
    }

    const totalJogosFoco = faseFocoMataMataSaaS / 2;
    const jogosPorBloco = 8;
    const totalBlocosFoco = Math.ceil(totalJogosFoco / jogosPorBloco);

    if (quadranteAtivoMataMataSaaS >= totalBlocosFoco) {
        quadranteAtivoMataMataSaaS = 0;
    }

    let htmlDropdownSaaS = '';
    let htmlDotsSaaS = '';

    if (totalJogosFoco > jogosPorBloco) {
        let htmlOptions = '';
        let dotsItems = '';

        for (let b = 0; b < totalBlocosFoco; b++) {
            const ini = (b * jogosPorBloco) + 1;
            const fim = Math.min((b + 1) * jogosPorBloco, totalJogosFoco);
            const selected = (b === quadranteAtivoMataMataSaaS) ? 'selected' : '';
            const activeClass = (b === quadranteAtivoMataMataSaaS) ? 'active' : '';

            htmlOptions += `<option value="${b}" ${selected}>📍 Jogos ${ini} a ${fim}</option>`;
            dotsItems += `<div class="dot-item ${activeClass}" onclick="selecionarQuadranteSaaS(${b})" title="Bloco ${b + 1}"></div>`;
        }

        htmlDropdownSaaS = `
            <div class="bracket-quadrante-row" data-html2canvas-ignore="true">
                <select id="select-saas-quadrante" class="select-saas-quadrante" onchange="selecionarQuadranteSaaS(this.value)">
                    ${htmlOptions}
                </select>
            </div>
        `;
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

        // 🟢 2. Cálculo do intervalo proporcional de jogos com base na FASE FOCADA
        let inicioJogoPot = 0;
        let fimJogoPot = pot / 2;

        if (totalJogosFoco > jogosPorBloco) {
            if (pot <= faseFocoMataMataSaaS) {
                const fatorEscala = faseFocoMataMataSaaS / pot;
                inicioJogoPot = Math.floor((quadranteAtivoMataMataSaaS * jogosPorBloco) / fatorEscala);
                fimJogoPot = Math.ceil(((quadranteAtivoMataMataSaaS + 1) * jogosPorBloco) / fatorEscala);
            } else {
                const fatorEscala = pot / faseFocoMataMataSaaS;
                inicioJogoPot = quadranteAtivoMataMataSaaS * jogosPorBloco * fatorEscala;
                fimJogoPot = (quadranteAtivoMataMataSaaS + 1) * jogosPorBloco * fatorEscala;
            }
        }

        let htmlCardsJogo = '';

        const ehMobile = window.innerWidth <= 768; 

		rodadaFase.forEach((confItem, idxJogo) => {
			// 🖥️ NO PC: Mantém o filtro original por blocos intocado
			// 📱 NO CELULAR: Renderiza a árvore completa para dar a altura real e alinhar as Quartas/Semis
			if (!ehMobile && totalJogosR1 > jogosPorBloco) {
				if (idxJogo < inicioJogoPot || idxJogo >= fimJogoPot) {
					return;
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

                // Adicione a trava de estilo inline no card para anular o margin-top do CSS global
				const estiloCardMobile = ehMobile ? 'style="margin: auto 0 !important;"' : '';

                htmlCardsJogo += `
					<div class="match-card ${p1 && p2 ? 'active-match' : ''} ${ehVoce ? 'voce' : ''}" ${idAncora} style="width: 100%; box-sizing: border-box;">
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

		const estiloColuna = ehMobile ? 'style="display: flex; flex-direction: column; flex: 1;"' : '';
		const estiloMatches = ehMobile ? 'style="display: flex; flex-direction: column; justify-content: space-around !important; flex: 1;"' : '';
		
		htmlColunas += `
			<div class="bracket-column" ${estiloColuna}>
				<div class="column-header">${rotuloFase}</div>
				<div class="bracket-column-matches" ${estiloMatches}>${htmlCardsJogo}
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
	
	const btnVoltarListaHtml = ehMataMataDiretoHistorico ? '' : `
		<button type="button" class="btn-voltar-arvore-saas" onclick="alternarVisaoMataMataSaaS()" title="Voltar para a Visão Lista" data-html2canvas-ignore="true">
			<span class="material-icons" style="font-size: 20px;">format_list_bulleted</span>
		</button>
	`;

    const estiloViewportMobile = ehMobile 
        ? 'style="overflow-x: auto !important; overflow-y: auto !important; max-height: 75vh !important; touch-action: pan-x pan-y !important; -webkit-overflow-scrolling: touch !important;"' 
        : '';

    const estiloWrapperMobile = ehMobile
        ? 'style="display: flex; flex-direction: row; align-items: stretch; min-height: 100%; width: max-content;"'
        : '';

    containerAlvo.innerHTML = `
        <div class="full-bracket-container" id="area-capture-matamata" style="position: relative; width: 100%;">
            ${htmlDropdownSaaS}
            ${btnNavLeft}
            ${btnNavRight}
            <div class="bracket-scroll-viewport" id="bracket-scroll-viewport" ${estiloViewportMobile}>
				<div class="bracket-wrapper" ${estiloWrapperMobile}>
					${htmlColunas}
				</div>
			</div>
            ${htmlDotsSaaS}
            ${btnVoltarListaHtml}
            ${btnPngHtml}
        </div>
    `;

    setTimeout(() => {
        const viewport = document.getElementById('bracket-scroll-viewport');
        if (viewport) {
            viewport.onscroll = () => {
                atualizarVisibilidadeSetasSaaS();
                agendarVerificacaoFaseSaaS();
            };
            atualizarVisibilidadeSetasSaaS();
        }
    }, 50);
}

async function exportarMataMataPNGSaaS() {
    if (navigator.vibrate) navigator.vibrate(30);

    const areaCaptura = document.getElementById('area-capture-matamata');
    if (!areaCaptura || !window.chaveCatDataUltimaSaaS) {
        if (typeof showToast === 'function') showToast("Área do Mata-Mata não encontrada.", "error");
        return;
    }

    // 1. Carregamento dinâmico da biblioteca html2canvas caso não esteja presente
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
            console.error("❌ Erro ao carregar html2canvas:", err);
            if (typeof showToast === 'function') showToast("Erro ao carregar motor de captura.", "error");
            return;
        }
    }

    const chaveCatData = window.chaveCatDataUltimaSaaS;
    const partidasCustomizadas = window.partidasCustomizadasUltimaSaaS;
    const idLogado = localStorage.getItem('jogadorLogadoId');
    const rodadaAtualBanco = chaveCatData.rodada1 || [];
    const historicoRodadas = chaveCatData.historicoRodadas || {};
    const partidasGlobal = partidasCustomizadas || ((typeof rankingPartidasGlobal !== 'undefined' && rankingPartidasGlobal) ? rankingPartidasGlobal : {});
    const confRanking = (typeof configRegrasGlobal !== 'undefined' && configRegrasGlobal.ranking) ? configRegrasGlobal.ranking : {};

    const totalClassific = parseInt(chaveCatData.totalClassificados, 10) || 8;
    const faseInicial = (typeof calcularPotenciaDeDoisSuperiorSaaS === 'function')
        ? calcularPotenciaDeDoisSuperiorSaaS(totalClassific)
        : (parseInt(chaveCatData.faseAtual, 10) || 8);

    const totalJogosR1 = faseInicial / 2;
    const jogosPorBlocoPng = 16; 
    
    // 🎯 2. Criação inteligente da Fila de Trabalhos (Jobs)
    let trabalhosExportacao = [];
    
    if (totalJogosR1 <= jogosPorBlocoPng) {
        // Torneio pequeno (até 16avos): 1 único arquivo com tudo
        trabalhosExportacao.push({ tipo: 'completo', startPot: faseInicial, endPot: 2, qIndex: 0 });
    } else {
        // Torneios Grandes (32avos, 64avos, etc): Aplicação do 'Corte B'
        const totalBases = Math.ceil(totalJogosR1 / jogosPorBlocoPng);
        
        // A) Criar as Chaves Base que param nas Oitavas de Final (pot = 16)
        for (let q = 0; q < totalBases; q++) {
            trabalhosExportacao.push({ tipo: 'base', startPot: faseInicial, endPot: 16, qIndex: q });
        }
        
        // B) Criar a Fase Final começando nas Quartas de Final (pot = 8)
        trabalhosExportacao.push({ tipo: 'final', startPot: 8, endPot: 2, qIndex: 0 });
    }

    if (typeof showToast === 'function') {
        if (trabalhosExportacao.length > 1) {
            showToast(`Gerando os ${trabalhosExportacao.length} arquivos do torneio... Aguarde.`, "info");
        } else {
            showToast("Gerando arquivo da chave...", "info");
        }
    }

    const buscarNomeAtleta = (id, tagStatusHtml = '', posSeedOverride = '') => {
        if (!id) {
            return `
                <div style="display: flex; align-items: center; flex: 1; min-width: 0;">
                    <span class="seed-num" style="display: inline-block; width: 16px; flex-shrink: 0; font-size: 10px; font-weight: 400; color: #94a3b8;"></span>
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

        const seedHtml = `<span class="seed-num" style="display: inline-block; width: 16px; flex-shrink: 0; font-size: 10px; font-weight: 400; color: #94a3b8; text-align: left;">${posClean}</span>`;
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
        if ((n2 === 6 && n1 <= 4) || (n2 === 7 && (n1 === 3 || n1 === 4))) return 2;
        if ((n1 === 4 && n2 <= 2) || (n1 === 5 && (n2 === 3 || n2 === 4))) return 1;
        if ((n2 === 4 && n1 <= 2) || (n2 === 5 && (n1 === 3 || n1 === 4))) return 2;
        if ((n1 === 8 && n2 <= 6) || (n1 === 9 && (n2 === 7 || n2 === 8))) return 1;
        if ((n2 === 8 && n1 <= 6) || (n2 === 9 && (n1 === 7 || n1 === 8))) return 2;
        if (n1 >= 10 && n1 - n2 >= 2) return 1;
        if (n2 >= 10 && n2 - n1 >= 2) return 2;
        return 0;
    };

    const chaveCat = (typeof abaClasseAtivaSaaS !== 'undefined' && typeof abaGeneroAtivaSaaS !== 'undefined')
        ? (confRanking.divisaoGenero === 'unificado' ? `${abaClasseAtivaSaaS}_UNIFICADO` : `${abaClasseAtivaSaaS}_${abaGeneroAtivaSaaS}`)
        : '';

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

    // 🎯 3. Processamento e Exportação de cada arquivo planejado
    for (let i = 0; i < trabalhosExportacao.length; i++) {
        const job = trabalhosExportacao[i];

        if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 500)); // Pausa leve para evitar bloqueio da tela
        }

        let htmlColunasPng = '';

        for (let pot = job.startPot; pot >= job.endPot; pot /= 2) {
            const rotuloFase = (typeof obterRotuloFaseMataMataSaaS === 'function')
                ? obterRotuloFaseMataMataSaaS(pot)
                : `Fase ${pot}`;

            let rodadaFase = [];
            if (parseInt(chaveCatData.faseAtual, 10) === pot && rodadaAtualBanco.length > 0) {
                rodadaFase = rodadaAtualBanco;
            } else if (historicoRodadas[pot] || historicoRodadas[String(pot)]) {
                rodadaFase = historicoRodadas[pot] || historicoRodadas[String(pot)];
            } else {
                const numJogos = pot / 2;
                for (let j = 0; j < numJogos; j++) {
                    rodadaFase.push({ fase: pot, jogador1Id: null, jogador2Id: null, isBye: false });
                }
            }

            let inicioJogoPot = 0;
            let fimJogoPot = pot / 2;

            // Fatiamento matemático aplicável apenas nos arquivos Base
            if (job.tipo === 'base') {
                const fatorEscala = faseInicial / pot;
                inicioJogoPot = Math.floor((job.qIndex * jogosPorBlocoPng) / fatorEscala);
                fimJogoPot = Math.ceil(((job.qIndex + 1) * jogosPorBlocoPng) / fatorEscala);
            } 
            // Nos arquivos 'completo' e 'final', desenhamos todos os jogos disponíveis da coluna

            let htmlCardsJogoPng = '';

            rodadaFase.forEach((confItem, idxJogo) => {
                if (idxJogo < inicioJogoPot || idxJogo >= fimJogoPot) {
                    return;
                }

                if (!confItem) {
                    confItem = { fase: pot, jogador1Id: null, jogador2Id: null, isBye: false };
                }

                const p1 = confItem.jogador1Id;
                const p2 = confItem.jogador2Id;
                const ehBye = confItem.isBye || (p1 && !p2 && pot === faseInicial);

                const seedP1 = confItem.posicaoP1 || (confItem.dadosPlacar ? confItem.dadosPlacar.posicaoP1 : '') || '';
                const seedP2 = confItem.posicaoP2 || (confItem.dadosPlacar ? confItem.dadosPlacar.posicaoP2 : '') || '';

                if (ehBye) {
                    const idBye = p1 || p2;
                    const name1 = buscarNomeAtleta(idBye, '', seedP1);
                    const ehVoce = (idLogado && idLogado === idBye);

                    htmlCardsJogoPng += `
                        <div class="match-card bye ${ehVoce ? 'voce' : ''}" style="width: 240px; box-sizing: border-box; margin: 2px 0 !important;">
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

                    htmlCardsJogoPng += `
                        <div class="match-card ${p1 && p2 ? 'active-match' : ''} ${ehVoce ? 'voce' : ''}" style="width: 240px; box-sizing: border-box; margin: 2px 0 !important;">
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

            htmlColunasPng += `
                <div class="bracket-column" style="display: flex; flex-direction: column; flex: 1;">
                    <div class="column-header" style="position: static !important; margin-top: 0 !important; margin-bottom: 16px !important;">${rotuloFase}</div>
                    <div class="bracket-column-matches" style="display: flex; flex-direction: column; justify-content: space-around !important; flex: 1; margin-top: 0 !important;">
                        ${htmlCardsJogoPng}
                    </div>
                </div>
            `;
        }

        const cloneContainer = document.createElement('div');
        cloneContainer.style.position = 'absolute';
        cloneContainer.style.top = '-9999px';
        cloneContainer.style.left = '-9999px';
        cloneContainer.style.backgroundColor = '#ffffff';
        cloneContainer.style.padding = '24px';
        cloneContainer.style.borderRadius = '12px';
        cloneContainer.style.boxSizing = 'border-box';

        const wrapperClone = document.createElement('div');
        wrapperClone.className = 'bracket-wrapper';
        wrapperClone.style.display = 'flex';
        wrapperClone.style.flexDirection = 'row';
        wrapperClone.style.gap = '16px';
        wrapperClone.style.width = 'max-content';
        wrapperClone.style.overflow = 'visible';
        wrapperClone.innerHTML = htmlColunasPng;

        const elNomeClube = document.getElementById('txt-nome-clube');
        let nomeClubeRaw = elNomeClube ? elNomeClube.textContent.trim() : 'Clube';
        if (!nomeClubeRaw || nomeClubeRaw.toUpperCase() === 'CARREGANDO...') {
            nomeClubeRaw = localStorage.getItem('setpoint_jogador_clube_nome') || 'Clube Olímpico';
        }

        const ehHistorico = !!(typeof edicaoHistoricaFocoSaaS !== 'undefined' && edicaoHistoricaFocoSaaS);
        const cal = ehHistorico ? (edicaoHistoricaFocoSaaS.contrato || {}) : (confRanking.calendario || {});
        const faseAtual = parseInt(confRanking.faseAtual, 10) || 1;
        const modelo = cal.formatoTorneio || confRanking.calendario?.formatoTorneio || 'grupos';
        const ehHomologadoAtivo = !ehHistorico && ((modelo !== "grupos" && faseAtual >= 4) || (modelo === "grupos" && faseAtual >= 5));

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

        let badgeEstadoHtml = '';
        if (ehHistorico) {
            badgeEstadoHtml = `<span style="background: #f1f5f9; color: #475569; font-size: 11px; font-weight: 800; padding: 3px 10px; border-radius: 12px; border: 1px solid #cbd5e1; font-family: sans-serif;">[Acervo Histórico]</span>`;
        } else if (ehHomologadoAtivo) {
            badgeEstadoHtml = `<span style="background: #dcfce7; color: #15803d; font-size: 11px; font-weight: 800; padding: 3px 10px; border-radius: 12px; border: 1px solid #86efac; font-family: sans-serif;">✓ Homologado</span>`;
        }

        const badgePeriodoHtml = periodoStr
            ? `<span style="background: #f1f5f9; color: #475569; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 8px; border: 1px solid #cbd5e1; font-family: sans-serif; display: inline-flex; align-items: center; gap: 4px;">📅 ${periodoStr}</span>`
            : '';

        let etiquetaQuadranteHtml = '';
        if (job.tipo === 'base') {
            const jogoInicialPng = (job.qIndex * jogosPorBlocoPng) + 1;
            const jogoFinalPng = Math.min((job.qIndex + 1) * jogosPorBlocoPng, totalJogosR1);
            etiquetaQuadranteHtml = `<span style="background: #eff6ff; color: #2563eb; font-size: 11px; font-weight: 800; padding: 3px 10px; border-radius: 8px; border: 1px solid #bfdbfe; font-family: sans-serif; display: inline-flex; align-items: center; gap: 4px;">📍 Chave ${job.qIndex + 1} (Jogos ${jogoInicialPng} a ${jogoFinalPng})</span>`;
        } else if (job.tipo === 'final') {
            etiquetaQuadranteHtml = `<span style="background: #fef08a; color: #854d0e; font-size: 11px; font-weight: 800; padding: 3px 10px; border-radius: 8px; border: 1px solid #fde047; font-family: sans-serif; display: inline-flex; align-items: center; gap: 4px;">🏆 Fase Final (Quartas de Final à Final)</span>`;
        }

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
                    ${etiquetaQuadranteHtml}
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
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                width: larguraExata,
                height: alturaExata,
                windowWidth: larguraExata + 100,
                windowHeight: alturaExata + 100
            });

            document.body.removeChild(cloneContainer);

            const imageBase64 = canvas.toDataURL('image/png');
            
            // Nomenclatura dinâmica
            let nomeArquivo = `MataMata_${nomeClubeRaw.replace(/[^a-zA-Z0-9]/g, '_')}`;
            if (job.tipo === 'base') {
                nomeArquivo += `_Chave${job.qIndex + 1}`;
            } else if (job.tipo === 'final') {
                nomeArquivo += `_Fase_Final`;
            }
            nomeArquivo += `_${Date.now()}.png`;

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
            } else {
                const link = document.createElement('a');
                link.download = nomeArquivo;
                link.href = imageBase64;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        } catch (err) {
            if (document.body.contains(cloneContainer)) {
                document.body.removeChild(cloneContainer);
            }
            console.error(`❌ Erro ao capturar imagem em PNG:`, err);
            if (typeof showToast === 'function') showToast(`Erro ao gerar arquivo.`, "error");
        }
    }

    if (typeof showToast === 'function') {
        showToast(trabalhosExportacao.length > 1 ? `Exportação dos ${trabalhosExportacao.length} arquivos concluída!` : "Chave exportada em PNG com sucesso!", "success");
    }
}