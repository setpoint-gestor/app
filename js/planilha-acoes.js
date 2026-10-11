"use strict";

// ====================================================================
// MÓDULO: AÇÕES, DETALHES, EXCLUSÃO E FAXINA (SaaS)
// Responsável pelo menu contextual de reservas, modal de detalhes,
// exclusão atômica com logs no GitHub, faxina automática e convites.
// ====================================================================

// ====================================================================
// 🎮 MOTOR CONTROLADOR: GAVETA HÍBRIDA DE AÇÕES E EXCLUSÃO (SaaS)
// ====================================================================

function abrirMenuAcoesReservaSaaS(dia, hora, dadosReserva) {
    const modal = document.getElementById('modal-acoes-reserva');
    const txtDetalhes = document.getElementById('txt-acoes-detalhes');
    const content = modal ? modal.querySelector('.modal-acoes-content') : null;

    if (!modal || !dadosReserva) return;

    // 🛡️ PORTARIA DE SEGURANÇA: Avalia se o usuário ativo tem poder de alteração
    const nomeLogado = localStorage.getItem('jogadorLogadoNome') || "";
    const idLogado = localStorage.getItem('jogadorLogadoId') || "";
    let perfis = {};
    try { perfis = JSON.parse(localStorage.getItem('jogadorLogadoPerfis') || '{}'); } catch(e) {}
    const ehAdmin = perfis['Admin'] === true;

    // SHIELD ANTI-SUTILEZAS: Normaliza as strings para evitar furos de espaços ou case-sensitive
    const organizadorReserva = (dadosReserva.organizador || "").trim().toUpperCase();
    const usuarioAtivoNome = nomeLogado.trim().toUpperCase();
    
    // Busca o apelido do jogador logado para também comparar
    let usuarioAtivoApelido = usuarioAtivoNome;
    if (typeof jogadoresGlobal !== 'undefined' && jogadoresGlobal[idLogado]) {
        usuarioAtivoApelido = (jogadoresGlobal[idLogado].apelido || "").trim().toUpperCase();
    }

    // Só pode alterar se for Gestor, Admin ou o próprio Organizador (batendo por nome ou apelido)
    const podeAlterar = (isGestorLogado === true) || (ehAdmin === true) || 
                        (organizadorReserva === usuarioAtivoNome) || 
                        (organizadorReserva === usuarioAtivoApelido);

    // 🧠 MÓDULO INTELIGENTE: Detecta se é uma mesclagem de Aula/Manutenção para corrigir a duração
    const ehAula = (dadosReserva.tipo === 'aula' || (dadosReserva.jogadores && dadosReserva.jogadores.toLowerCase() === 'aula'));
    const ehManutencao = (dadosReserva.tipo === 'manutencao' || (dadosReserva.jogadores && dadosReserva.jogadores.includes('Manutenção')));
    
    let duracaoRealDaReserva = parseInt(dadosReserva.duracao) || 1;

    // Se for Aula ou Manutenção, a "duração" não vem salva bonitinha como 1h ou 2h, então contamos quantos blocos iguais tem logo abaixo.
    if (ehAula || ehManutencao) {
        let quadraFoco = "Quadra - 1";
        if (quadraSelecionadaSaaS) {
            const match = quadraSelecionadaSaaS.match(/\d+/);
            quadraFoco = match ? `Quadra - ${match[0]}` : quadraSelecionadaSaaS;
        }
        const todasAsReservasDestaQuadra = reservasLocaisCache || {};
        
        let spansEncontrados = 1;
        for (let proximaHora = hora + 1; proximaHora <= 23; proximaHora++) {
            const rSeguinte = todasAsReservasDestaQuadra[`${dia}_${proximaHora}`];
            if (!rSeguinte || rSeguinte.status === 'aula_cancelada') break;

            const ehProximaAula = (rSeguinte.tipo === 'aula' || (rSeguinte.jogadores && rSeguinte.jogadores.toLowerCase() === 'aula'));
            const ehProximaManut = (rSeguinte.tipo === 'manutencao' || (rSeguinte.jogadores && rSeguinte.jogadores.includes('Manutenção')));
            
            if (ehAula && ehProximaAula && rSeguinte.organizador === dadosReserva.organizador) {
                spansEncontrados++;
            } else if (ehManutencao && ehProximaManut && rSeguinte.organizador === dadosReserva.organizador) {
                spansEncontrados++;
            } else {
                break;
            }
        }
        duracaoRealDaReserva = spansEncontrados;
        dadosReserva.duracao_calculada = duracaoRealDaReserva; // Injeta no objeto para a tela de detalhes poder usar depois!
    }

    // 1. Vincula o botão "Ver Detalhes" (Liberado para TODOS)
    const btnVerDetalhes = document.getElementById('btn-saas-ver-detalhes');
    if (btnVerDetalhes) {
        btnVerDetalhes.onclick = () => {
            fecharMenuAcoesReservaSaaS();
            abrirModalVerDetalhesSaaS(dia, hora, dadosReserva);
        };
    }

    // 2. Vincula o botão "Editar Reserva" (Inteligente e Oculto no Ranking/Aulas/Manutenção)
    const btnEditar = document.getElementById('btn-saas-editar-reserva');
    const ehRanking = (dadosReserva.isRanking === true || dadosReserva.tipo === 'ranking');

    if (btnEditar) {
		if (ehRanking || ehAula || ehManutencao) {
			// Não se edita jogadores numa Aula, Manutenção ou partida de Ranking
			btnEditar.style.setProperty('display', 'none', 'important');
		} else {
			btnEditar.style.setProperty('display', 'flex', 'important');
			btnEditar.classList.remove('btn-edit-1h', 'btn-edit-2h');
			
			if (duracaoRealDaReserva === 2) {
				btnEditar.classList.add('btn-edit-2h');
			} else {
				btnEditar.classList.add('btn-edit-1h');
			}
		}
	}

    // 3. Vincula o botão "Excluir" (Apenas quem pode alterar E se não houver placar lançado)
    const btnExcluir = document.getElementById('btn-saas-excluir-reserva');
    const temPlacarLancado = !!(dadosReserva.dadosPlacar || (dadosReserva.statusPlacar && dadosReserva.statusPlacar !== 'sem_placar'));

    if (podeAlterar && !temPlacarLancado) {
        modal.classList.remove('saas-modo-leitura');
        if (btnExcluir) {
            btnExcluir.style.removeProperty('display');
            
            // Textos contextuais para o botão
            if (ehAula) {
                btnExcluir.textContent = "Cancelar Aula";
            } else if (ehManutencao) {
                btnExcluir.textContent = "Cancelar Manutenção";
            } else {
                btnExcluir.textContent = "Excluir Reserva";
            }

            btnExcluir.onclick = () => {
                fecharMenuAcoesReservaSaaS();
                solicitarExclusaoReservaSaaS(dia, hora, dadosReserva); 
            };
        }
    } else {
        if (!podeAlterar) modal.classList.add('saas-modo-leitura');
        if (btnExcluir && temPlacarLancado) {
            btnExcluir.style.setProperty('display', 'none', 'important');
        }
    }

    // Mapeamento de dias para montagem do subtítulo
    const diasSemana = ["", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
    const nomeDia = diasSemana[dia] || "Dia";
    const horaFormatada = String(hora).padStart(2, '0') + ":00";
    const horaFimFormatada = String(hora + duracaoRealDaReserva).padStart(2, '0') + ":00";
    
    if (txtDetalhes) {
        txtDetalhes.textContent = `${quadraSelecionadaSaaS} • ${nomeDia}, ${horaFormatada} - ${horaFimFormatada}`;
    }

    modal.style.display = 'flex';

    if (window.innerWidth <= 767 && content) {
        setTimeout(() => {
            content.style.transform = 'translateY(0)';
        }, 10);
    }
	
	// ========================================================
    // 🏆 INJEÇÃO: LIGA O GATILHO DA SÚMULA NO MENU DE RESERVA
    // ========================================================
    if (typeof configurarGatilhoSumulaRanking === 'function') {
        configurarGatilhoSumulaRanking(dadosReserva);
    }
}

function fecharMenuAcoesReservaSaaS(event) {
    const modal = document.getElementById('modal-acoes-reserva');
    const content = modal ? modal.querySelector('.modal-acoes-content') : null;

    if (!modal) return;

    if (event && event.target !== modal) return;

    if (window.innerWidth <= 767 && content) {
        content.style.transform = 'translateY(100%)';
        setTimeout(() => {
            modal.style.display = 'none';
        }, 250);
    } else {
        modal.style.display = 'none';
    }
}

// ====================================================================
// 🎯 SUB-MÓDULO: EXIBIÇÃO DE DETALHES DA RESERVA (VER DETALHES)
// ====================================================================

let intervaloDetalhesSaaS = null;

function fecharModalVerDetalhesSaaS() {
    const modal = document.getElementById('modal-ver-detalhes');
    if (modal) modal.style.display = 'none';
    
    if (intervaloDetalhesSaaS) clearInterval(intervaloDetalhesSaaS);
}

function formatarNomeExibicaoDetalhes(nomeBruto) {
    if (!nomeBruto) return "";
    let limpo = String(nomeBruto).trim();
    if (limpo.toLowerCase() === "convidado / avulso" || limpo.toLowerCase() === "convidado") {
        return "Convidado / Avulso";
    }

    const palavras = limpo.toLowerCase().split(/\s+/);
    const formatadas = palavras.map(p => {
        if (['da', 'de', 'do', 'dos', 'das'].includes(p)) return p;
        return p.charAt(0).toUpperCase() + p.slice(1);
    });

    if (formatadas.length > 2) {
        let resultado = formatadas[0];
        for (let i = 1; i < formatadas.length - 1; i++) {
            const w = formatadas[i];
            if (['da', 'de', 'do', 'dos', 'das'].includes(w)) {
                resultado += " " + w;
            } else {
                resultado += " " + w.charAt(0).toUpperCase() + ".";
            }
        }
        resultado += " " + formatadas[formatadas.length - 1];
        return resultado;
    }

    return formatadas.join(' ');
}

function abrirModalVerDetalhesSaaS(dia, hora, dadosReserva) {
    if (!dadosReserva) return;

    const ehAula = (dadosReserva.tipo === 'aula' || (dadosReserva.jogadores && dadosReserva.jogadores.toLowerCase() === 'aula'));
    const ehManutencao = (dadosReserva.tipo === 'manutencao' || (dadosReserva.jogadores && dadosReserva.jogadores.includes('Manutenção')));
    const ehRanking = (dadosReserva.isRanking === true || dadosReserva.tipo === 'ranking');

    const duracao = dadosReserva.duracao_calculada || parseInt(dadosReserva.duracao) || 1;
    
    const diasSemana = ["", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"];
    const nomeDia = diasSemana[dia] || "Dia";

    let dataFormatada = "";
    if (dadosReserva.dataCompleta) {
        const partes = dadosReserva.dataCompleta.split('-'); 
        if (partes.length === 3) dataFormatada = `, ${partes[2]}/${partes[1]}`;
    }

    const hInicio = String(hora).padStart(2, '0') + ":00";
    const hFim = String(hora + duracao).padStart(2, '0') + ":00";

    const header = document.getElementById('detalhes-header');
    const icone = document.getElementById('detalhes-icone-horario');
    if (header) {
        header.className = 'card-header-detalhes';
        header.style.backgroundColor = ''; 

        if (ehRanking) {
            header.classList.add('header-ranking');
        } else if (ehAula) {
            header.style.backgroundColor = '#df7366'; 
        } else if (ehManutencao) {
            header.style.backgroundColor = '#64748b'; 
        } else {
            header.classList.add(duracao >= 2 ? 'header-2h' : 'header-1h');
        }
    }
    
    if (icone) {
        icone.textContent = ehRanking ? 'emoji_events' : (ehAula ? 'school' : (ehManutencao ? 'build' : (duracao >= 2 ? 'schedule' : 'event')));
    }

    document.getElementById('detalhes-txt-quadra').textContent = quadraSelecionadaSaaS || "Quadra";
    document.getElementById('detalhes-texto-data-hora').textContent = `${nomeDia}${dataFormatada} • ${hInicio} - ${hFim}`;

    const orgBox = document.querySelector('#modal-ver-detalhes .info-box-detalhes');
    const containerJogadores = document.getElementById('detalhes-lista-jogadores');
    const tituloJogadores = containerJogadores.previousElementSibling;

    if (ehRanking) {
        if (orgBox) orgBox.style.display = 'none';
        if (tituloJogadores) tituloJogadores.style.display = 'none';
        if (intervaloDetalhesSaaS) clearInterval(intervaloDetalhesSaaS);

        const stPlacar = dadosReserva.statusPlacar || 'sem_placar';
        let htmlRanking = '';

        if (stPlacar === 'consolidado') {
            htmlRanking += `<div class="status-panel panel-finalizada">Finalizada</div>`;
        } else if (stPlacar === 'pendente_validacao') {
            htmlRanking += `<div class="status-panel panel-pendente">Pendente de Validação</div>`;
        } else if (stPlacar === 'sem_placar') {
            htmlRanking += `<div class="status-panel panel-aguardando">Aguardando Placar</div>`;
        } else if (stPlacar === 'anulado') {
            htmlRanking += `<div class="status-panel panel-anulada">Súmula Anulada</div>`;
        } else if (stPlacar === 'contestado') {
            htmlRanking += `<div class="status-panel panel-pendente" style="background:#fef2f2; color:#dc2626; border-color:#fecaca;">Contestada (Em Análise)</div>`;
        }

        const nomesApelidos = (dadosReserva.jogadores || '').split(',').map(s => s.trim());
        const nomesCompletos = (dadosReserva.jogadores_completo || '').split(',').map(s => s.trim());
        
        const j1Completo = nomesCompletos[0] || nomesApelidos[0] || "Desafiante";
        const j2Completo = nomesCompletos[1] || nomesApelidos[1] || "Desafiado";
        
        const j1Exibicao = formatarNomeExibicaoDetalhes(j1Completo);
        const j2Exibicao = formatarNomeExibicaoDetalhes(j2Completo);

        const getPos = (nome, posCongelada) => {
            if (posCongelada) return posCongelada.replace('º', '').trim();
            return "";
        };

        const posJ1 = getPos(nomesApelidos[0], dadosReserva.posicaoP1);
        const posJ2 = getPos(nomesApelidos[1], dadosReserva.posicaoP2);

        const htmlPosJ1 = posJ1 ? `<span class="atp-pos">${posJ1}</span>` : '';
        const htmlPosJ2 = posJ2 ? `<span class="atp-pos">${posJ2}</span>` : '';

        const modeloReserva = (dadosReserva.modelo || dadosReserva.dadosPlacar?.modelo || "").toLowerCase();
        const mapaModelos = { piramide: 'Pirâmide', barragem: 'Barragem', grupos: 'Grupos' };

        let labelModelo = 'Ranking';

        if (dadosReserva.tagFaseRanking) {
            labelModelo = dadosReserva.tagFaseRanking;
        } else if (dadosReserva.dadosPlacar?.tagFaseRanking) {
            labelModelo = dadosReserva.dadosPlacar.tagFaseRanking;
        } else if (dadosReserva.tagGrupoRanking) {
            labelModelo = `Grupos - ${dadosReserva.tagGrupoRanking}`;
        } else if (dadosReserva.dadosPlacar?.tagGrupoRanking) {
            labelModelo = `Grupos - ${dadosReserva.dadosPlacar.tagGrupoRanking}`;
        } else if (mapaModelos[modeloReserva]) {
            labelModelo = mapaModelos[modeloReserva];
        } else {
            labelModelo = "Modelo Inválido";
        }

        let classNomeJ1 = '', classNomeJ2 = '';
        let setaJ1 = '', setaJ2 = '';
        let s1J1 = '-', s2J1 = '-', s3J1 = '-';
        let s1J2 = '-', s2J2 = '-', s3J2 = '-';
        let classS1J1 = '', classS2J1 = '', classS3J1 = '';
        let classS1J2 = '', classS2J2 = '', classS3J2 = '';

        const dp = dadosReserva.dadosPlacar;
        const temPlacar = !!dp && (stPlacar === 'consolidado' || stPlacar === 'pendente_validacao' || stPlacar === 'contestado' || stPlacar === 'anulado');
        const showWinner = (stPlacar === 'consolidado' || stPlacar === 'pendente_validacao');
        const isWO = !!dp && (dp.isWO || (dp.placarFormatado && dp.placarFormatado.includes("W.O.")));
        const isRET = !!dp && (dp.isRET || (dp.placarFormatado && dp.placarFormatado.includes("RET")));

        if (isWO) {
            const norm = s => (s||"").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
            const vencedorOficial = norm(dp.vencedor || "");
            const j1EhVencedor = (dp.vencedorCodigo === 'J1') || (vencedorOficial === norm(j1Completo)) || (vencedorOficial === norm(nomesApelidos[0]));

            htmlRanking += `
                <table class="atp-table">
                    <thead>
                        <tr>
                            <th style="text-align: left; font-size: 11px; font-weight: 700; color: #64748b; padding-left: 2px;">${labelModelo}</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>
                                ${htmlPosJ1}
                                <span class="atp-name ${j1EhVencedor ? 'match-winner' : ''}">${j1Exibicao}</span>
                            </td>
                            <td style="text-align: right; font-weight: 800; font-size: 15px; color: #1e293b; padding-right: 12px;">${j1EhVencedor ? 'W.O.' : ''}</td>
                        </tr>
                        <tr>
                            <td>
                                ${htmlPosJ2}
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
        } else if (temPlacar && dp.parciais) {
            const norm = s => (s||"").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();

            if (showWinner) {
                if (isRET) {
                    if (dp.desistenteCodigo === 'J1') {
                        classNomeJ2 = 'match-winner';
                        setaJ2 = '<div class="winner-arrow">◀</div>';
                    } else if (dp.desistenteCodigo === 'J2') {
                        classNomeJ1 = 'match-winner';
                        setaJ1 = '<div class="winner-arrow">◀</div>';
                    }
                } else {
                    const vencedorOficial = norm(dp.vencedor || "");
                    if (vencedorOficial === norm(j1Completo) || vencedorOficial === norm(nomesApelidos[0])) {
                        classNomeJ1 = 'match-winner';
                        setaJ1 = '<div class="winner-arrow">◀</div>';
                    } else if (vencedorOficial === norm(j2Completo) || vencedorOficial === norm(nomesApelidos[1])) {
                        classNomeJ2 = 'match-winner';
                        setaJ2 = '<div class="winner-arrow">◀</div>';
                    }
                }
            }

            const tagRetJ1 = (isRET && dp.desistenteCodigo === 'J1') ? '<span class="badge-ret" style="margin-left: 6px;">RET</span>' : '';
            const tagRetJ2 = (isRET && dp.desistenteCodigo === 'J2') ? '<span class="badge-ret" style="margin-left: 6px;">RET</span>' : '';

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
                s1J1 = fmtSet(p.set1.j1, p.set1.tbJ1);
                s1J2 = fmtSet(p.set1.j2, p.set1.tbJ2);
                const w1 = calcSetWinner(p.set1.j1, p.set1.j2, p.set1.tbJ1, p.set1.tbJ2);
                if (showWinner && w1 === 1) classS1J1 = 'set-winner';
                else if (showWinner && w1 === 2) classS1J2 = 'set-winner';
                tdSetsJ1Html += `<td class="col-score atp-score ${classS1J1}">${s1J1}</td>`;
                tdSetsJ2Html += `<td class="col-score atp-score ${classS1J2}">${s1J2}</td>`;
            }

            if (temSet2) {
                s2J1 = fmtSet(p.set2.j1, p.set2.tbJ1);
                s2J2 = fmtSet(p.set2.j2, p.set2.tbJ2);
                const w2 = calcSetWinner(p.set2.j1, p.set2.j2, p.set2.tbJ1, p.set2.tbJ2);
                if (showWinner && w2 === 1) classS2J1 = 'set-winner';
                else if (showWinner && w2 === 2) classS2J2 = 'set-winner';
                tdSetsJ1Html += `<td class="col-score atp-score ${classS2J1}">${s2J1}</td>`;
                tdSetsJ2Html += `<td class="col-score atp-score ${classS2J2}">${s2J2}</td>`;
            }

            if (temSet3) {
                s3J1 = fmtSet(p.set3.j1, p.set3.tbJ1);
                s3J2 = fmtSet(p.set3.j2, p.set3.tbJ2);
                const w3 = calcSetWinner(p.set3.j1, p.set3.j2, p.set3.tbJ1, p.set3.tbJ2);
                if (showWinner && w3 === 1) classS3J1 = 'set-winner';
                else if (showWinner && w3 === 2) classS3J2 = 'set-winner';
                tdSetsJ1Html += `<td class="col-score atp-score ${classS3J1}">${s3J1}</td>`;
                tdSetsJ2Html += `<td class="col-score atp-score ${classS3J2}">${s3J2}</td>`;
            }

            htmlRanking += `
                <table class="atp-table">
                    <thead>
                        <tr>
                            <th style="text-align: left; font-size: 11px; font-weight: 700; color: #64748b; padding-left: 2px;">${labelModelo}</th>
                            ${thSetsHtml}
                            <th class="col-arrow"></th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>
                                ${htmlPosJ1}
                                <span class="atp-name ${classNomeJ1}">${j1Exibicao}</span>
                                ${tagRetJ1}
                            </td>
                            ${tdSetsJ1Html}
                            <td class="col-arrow">${setaJ1}</td>
                        </tr>
                        <tr>
                            <td>
                                ${htmlPosJ2}
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
                htmlRanking += `
                    <div style="text-align: center; font-style: italic; color: #64748b; font-size: 13px; margin-top: 10px; margin-bottom: 4px;">
                        Motivo: ${dp.motivoRET}
                    </div>
                `;
            }
        } else {
            htmlRanking += `
                <table class="atp-table">
                    <thead>
                        <tr>
                            <th style="text-align: left; font-size: 11px; font-weight: 700; color: #64748b; padding-left: 2px;">${labelModelo}</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>
                                ${htmlPosJ1}
                                <span class="atp-name">${j1Exibicao}</span>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                ${htmlPosJ2}
                                <span class="atp-name">${j2Exibicao}</span>
                            </td>
                        </tr>
                    </tbody>
                </table>
            `;
        }

        if (stPlacar === 'anulado') {
            const arbNome = formatarNomeExibicaoDetalhes(dp?.arbitroResponsavel || 'Árbitro');
            htmlRanking += `<div class="motivo-anulacao">Anulada por ${arbNome}: "${dp?.motivoAnulacao || 'Decisão da arbitragem'}"</div>`;
        } else if (stPlacar === 'consolidado' && dp?.arbitroResponsavel) {
            const arbNome = formatarNomeExibicaoDetalhes(dp.arbitroResponsavel);
            const isEditado = (dp.decisaoArbitro === 'editado_pelo_arbitro');
            const textoAcaoArbitro = isEditado ? "Editado" : "Homologado";
            const corHex = isEditado ? "#d97706" : "#059669";
            
            htmlRanking += `<div class="motivo-anulacao" style="color: ${corHex};">${textoAcaoArbitro} pela arbitragem: ${arbNome}</div>`;
        }

        if (temPlacar || stPlacar === 'anulado') {
            let autorRaw = (dp?.autorSumula || 'Sistema').trim();
            let autorFormatado = autorRaw;

            if (autorRaw.toLowerCase() === 'gestor') {
                autorFormatado = 'Gestor';
            } else if (autorRaw.toLowerCase() === 'atleta') {
                autorFormatado = 'Atleta';
            } else if (autorRaw.toLowerCase().includes('(árbitro)') || autorRaw.toLowerCase().includes('(arbitro)')) {
                const nomeSemTag = autorRaw.replace(/[\(\[{]á?rbitro[\)\ harsh\]}]/gi, '').trim();
                autorFormatado = `${formatarNomeExibicaoDetalhes(nomeSemTag)} (Árbitro)`;
            } else {
                const norm = s => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
                const autorNorm = norm(autorRaw);
                let ehArbitro = !!dp?.arbitroResponsavel;

                if (!ehArbitro && typeof jogadoresGlobal !== 'undefined' && jogadoresGlobal) {
                    const idEncontrado = Object.keys(jogadoresGlobal).find(id => {
                        const j = jogadoresGlobal[id];
                        if (!j) return false;
                        return norm(j.nomeCompleto) === autorNorm || norm(j.apelido) === autorNorm;
                    });
                    if (idEncontrado && jogadoresGlobal[idEncontrado].perfis) {
                        const perf = jogadoresGlobal[idEncontrado].perfis;
                        ehArbitro = (perf['Árbitro'] === true || perf['Arbitro'] === true);
                    }
                }

                autorFormatado = formatarNomeExibicaoDetalhes(autorRaw);
                if (ehArbitro) {
                    autorFormatado += ' (Árbitro)';
                }
            }

            let dataLancamentoStr = dp?.dataHoraLancamento || '';
            
            if (dataLancamentoStr && !isNaN(dataLancamentoStr)) {
                const d = new Date(parseInt(dataLancamentoStr));
                if (!isNaN(d.getTime())) {
                    const dd = String(d.getDate()).padStart(2, '0');
                    const mm = String(d.getMonth() + 1).padStart(2, '0');
                    const yyyy = d.getFullYear();
                    const hh = String(d.getHours()).padStart(2, '0');
                    const min = String(d.getMinutes()).padStart(2, '0');
                    dataLancamentoStr = `${dd}/${mm}/${yyyy}, ${hh}:${min}`;
                }
            }
            
            htmlRanking += `<div class="audit-text">Informado por: ${autorFormatado} em ${dataLancamentoStr}.</div>`;
        }

        containerJogadores.innerHTML = htmlRanking;

    } else if (ehAula || ehManutencao) {
        if (orgBox) orgBox.style.removeProperty('display');
        if (tituloJogadores) tituloJogadores.style.removeProperty('display');
        if (intervaloDetalhesSaaS) clearInterval(intervaloDetalhesSaaS);

        const respNomeBruto = dadosReserva.organizador || "Responsável";
        const respNomeFormatado = formatarNomeExibicaoDetalhes(respNomeBruto);

        if (ehAula) {
            document.getElementById('detalhes-txt-org-nome').textContent = respNomeFormatado;
            document.getElementById('detalhes-txt-org-sub').textContent = "Professor Responsável";
            
            if (tituloJogadores) tituloJogadores.textContent = "FINALIDADE";
            containerJogadores.innerHTML = `
                <div class="player-row-detalhes">
                    <span>🎓 Aula Excepcional / Avulsa</span>
                </div>
            `;
        } else {
            document.getElementById('detalhes-txt-org-nome').textContent = respNomeFormatado;
            document.getElementById('detalhes-txt-org-sub').textContent = "Responsável pela Manutenção";

            const motivoTexto = dadosReserva.motivo && dadosReserva.motivo.trim() !== '' 
                ? dadosReserva.motivo 
                : "Manutenção Geral e Reparos";

            if (tituloJogadores) tituloJogadores.textContent = "MOTIVO DO BLOQUEIO";
            containerJogadores.innerHTML = `
                <div class="player-row-detalhes" style="flex-direction: column; align-items: flex-start; gap: 4px; padding: 10px 0;">
                    <span style="font-weight: 700; color: #1e293b;">💦 ${motivoTexto}</span>
                    <span style="font-size: 12px; color: #64748b;">Quadra temporariamente indisponível para jogos</span>
                </div>
            `;
        }

    } else {
        if (orgBox) orgBox.style.removeProperty('display');
        if (tituloJogadores) tituloJogadores.style.removeProperty('display');

        const orgNomeBruto = dadosReserva.organizador || "Sócio";
        let orgVinculo = "Sócio Titular";

        if (typeof jogadoresGlobal !== 'undefined' && jogadoresGlobal) {
            const idOrg = Object.keys(jogadoresGlobal).find(k => jogadoresGlobal[k].nomeCompleto === orgNomeBruto);
            if (idOrg && jogadoresGlobal[idOrg].socio) {
                const s = jogadoresGlobal[idOrg].socio.toLowerCase();
                orgVinculo = s === 'dependente' ? 'Sócio Dependente' : (s === 'visitante' ? 'Staff' : 'Sócio Titular');
            }
        }

        const orgNomeFormatado = formatarNomeExibicaoDetalhes(orgNomeBruto);

        document.getElementById('detalhes-txt-org-nome').textContent = orgNomeFormatado;
        document.getElementById('detalhes-txt-org-sub').textContent = `Organizador • ${orgVinculo}`;

        containerJogadores.innerHTML = '';

        const stringJogadores = dadosReserva.jogadores_completo || dadosReserva.jogadores || "";
        const listaJogadores = stringJogadores.split(',').map(n => n.trim()).filter(n => n.length > 0);
        const listaApelidosParaBusca = (dadosReserva.jogadores || "").split(',').map(n => n.trim());

        let temPendente = false; 

        listaJogadores.forEach((jNome, index) => {
            const nomeFormatado = formatarNomeExibicaoDetalhes(jNome);
            const apelidoDesteJogador = listaApelidosParaBusca[index] || jNome;

            let statusTexto = "Confirmado";
            let statusClasseDot = "confirmed-dot"; 
            let statusClasseTxt = "txt-confirmed";

            let isPendente = false;
            if (dadosReserva.confirmacoes) {
                Object.keys(dadosReserva.confirmacoes).forEach(chaveNoBanco => {
                    if (dadosReserva.confirmacoes[chaveNoBanco] === false) {
                        if (chaveNoBanco.toUpperCase() === apelidoDesteJogador.toUpperCase() || 
                            chaveNoBanco.toUpperCase() === jNome.toUpperCase()) {
                            isPendente = true;
                            temPendente = true; 
                        }
                    }
                });
            }

            if (isPendente) {
                statusTexto = "Pendente";
                statusClasseDot = "pending-dot";
                statusClasseTxt = "txt-pending";
            }

            const row = document.createElement('div');
            row.className = 'player-row-detalhes';
            row.innerHTML = `
                <span><span class="status-dot-detalhes ${statusClasseDot}"></span>${nomeFormatado}</span>
                <span class="${statusClasseTxt}">${statusTexto}</span>
            `;
            containerJogadores.appendChild(row);
        });

        if (tituloJogadores) {
            if (temPendente && dadosReserva.expiraEm) {
                tituloJogadores.innerHTML = `JOGADORES <span id="badge-timer-detalhes" data-expira="${dadosReserva.expiraEm}">Calculando...</span>`;
                tituloJogadores.classList.add('titulo-jogadores-flex');
                iniciarRelogioDetalhesSaaS(); 
            } else {
                tituloJogadores.innerHTML = `JOGADORES`;
                tituloJogadores.classList.remove('titulo-jogadores-flex');
                if (intervaloDetalhesSaaS) clearInterval(intervaloDetalhesSaaS);
            }
        }
    }

    const modal = document.getElementById('modal-ver-detalhes');
    if (modal) modal.style.display = 'flex';
}

function iniciarRelogioDetalhesSaaS() {
    if (intervaloDetalhesSaaS) clearInterval(intervaloDetalhesSaaS);

    const badge = document.getElementById('badge-timer-detalhes');
    if (!badge) return;

    const expiraEm = parseInt(badge.getAttribute('data-expira'));

    const atualizar = () => {
        const agora = Date.now();
        const diff = expiraEm - agora;

        if (diff <= 0) {
            badge.innerHTML = "Expirado";
            badge.style.color = "#dc3545";
            badge.style.backgroundColor = "#fee2e2";
            clearInterval(intervaloDetalhesSaaS);
            
            if (typeof executarFaxinaAutomaticaSaaS === 'function') {
                executarFaxinaAutomaticaSaaS();
            }
        } else {
            const horas = Math.floor(diff / (1000 * 60 * 60));
            const minutos = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const segundos = Math.floor((diff % (1000 * 60)) / 1000);
            
            badge.innerHTML = `<i class="material-icons">timer</i> ${String(horas).padStart(2, '0')}h ${String(minutos).padStart(2, '0')}m ${String(segundos).padStart(2, '0')}s`;
        }
    };

    atualizar(); 
    intervaloDetalhesSaaS = setInterval(atualizar, 1000); 
}

function solicitarExclusaoReservaSaaS(dia, hora, dadosReserva) {
    const nomeLogado = localStorage.getItem('jogadorLogadoNome') || "";
    const idLogado = localStorage.getItem('jogadorLogadoId') || "";
    let perfis = {};
    try { perfis = JSON.parse(localStorage.getItem('jogadorLogadoPerfis') || '{}'); } catch(e) {}
    const ehAdmin = perfis['Admin'] === true;

    let apelidoLogado = nomeLogado.trim().toUpperCase();
    if (typeof jogadoresGlobal !== 'undefined' && jogadoresGlobal[idLogado]) {
        apelidoLogado = (jogadoresGlobal[idLogado].apelido || "").trim().toUpperCase();
    }

    const organizadorReserva = (dadosReserva.organizador || "").trim().toUpperCase();
    const usuarioAtivoNome = nomeLogado.trim().toUpperCase();

    const podeExcluir = (isGestorLogado === true) || (ehAdmin === true) || 
                        (organizadorReserva === usuarioAtivoNome) || 
                        (organizadorReserva === apelidoLogado);

    const ehAula = (dadosReserva.tipo === 'aula' || (dadosReserva.jogadores && dadosReserva.jogadores.toLowerCase() === 'aula'));
    const ehManutencao = (dadosReserva.tipo === 'manutencao' || (dadosReserva.jogadores && dadosReserva.jogadores.includes('Manutenção')));

    if (!podeExcluir) {
        if (ehAula) {
            showToast("Apenas o Professor responsável ou um administrador pode cancelar esta aula.", "error");
        } else if (ehManutencao) {
            showToast("Apenas o responsável ou um administrador pode cancelar esta manutenção.", "error");
        } else {
            showToast("Apenas o organizador da reserva ou um administrador pode excluir este agendamento.", "error");
        }
        return;
    }

    const stringJogadores = dadosReserva.jogadores_completo || dadosReserva.jogadores || "";
    let listaJogadores = stringJogadores.split(',').map(nome => nome.trim()).filter(nome => nome.length > 0);

    if (ehAula) {
        listaJogadores = ["Aula Excepcional / Avulsa"];
    } else if (ehManutencao) {
        listaJogadores = ["Bloqueio de Manutenção"];
    }

    let listHtml = "";
    listaJogadores.forEach(jogador => {
        let nomeFormatado = jogador;
        if (!ehAula && !ehManutencao) {
            nomeFormatado = jogador.toLowerCase().split(/\s+/).map(palavra => {
                if (['da', 'de', 'do', 'dos', 'das'].includes(palavra)) {
                    return palavra;
                }
                return palavra.charAt(0).toUpperCase() + palavra.slice(1);
            }).join(' ');
        }

        listHtml += `<li class="prompt-saas-item"><span class="prompt-saas-bullet">•</span> ${nomeFormatado}</li>`;
    });

    const duracao = dadosReserva.duracao_calculada || parseInt(dadosReserva.duracao) || 1;
    const horaFormatada = String(hora).padStart(2, '0') + ":00";
    const horaFimFormatada = String(hora + duracao).padStart(2, '0') + ":00";
    
    if (ehAula || ehManutencao) {
        listHtml += `<li class="prompt-saas-item"><span class="prompt-saas-bullet">•</span> Horário: ${horaFormatada} às ${horaFimFormatada}</li>`;
    }

    let txtPergunta = "Você tem certeza que deseja excluir esta reserva?";
    if (ehAula) {
        txtPergunta = duracao > 1 ? "Você tem certeza que deseja cancelar esse range de aulas?" : "Você tem certeza que deseja cancelar esta aula?";
    }
    if (ehManutencao) {
        txtPergunta = duracao > 1 ? "Você tem certeza que deseja cancelar essa manutenção estendida?" : "Você tem certeza que deseja cancelar esta manutenção?";
    }

    const promptBodyHTML = `
        <div class="prompt-saas-container">
            <fieldset class="prompt-saas-fieldset">
                <legend class="prompt-saas-legend">${quadraSelecionadaSaaS.toUpperCase()}</legend>
                <ul class="prompt-saas-list">
                    ${listHtml}
                </ul>
            </fieldset>

            <p class="prompt-saas-warning">${txtPergunta}</p>
        </div>
    `;

    showPrompt(
        "Confirmação",
        promptBodyHTML,
        () => {
            const duracaoCalculada = dadosReserva.duracao_calculada || parseInt(dadosReserva.duracao) || 1;
            const listaDeSlots = [];

            for (let i = 0; i < duracaoCalculada; i++) {
                listaDeSlots.push({ dia: dia, hora: hora + i });
            }

            let motivoAcao = "Excluído via Painel pelo Usuário";
            if (ehAula) motivoAcao = "Aula cancelada pelo Professor";
            if (ehManutencao) motivoAcao = "Manutenção cancelada pela Equipe";

            executarPipelineExclusaoSaaS(listaDeSlots, dadosReserva, motivoAcao);
        }
    );
}

function executarPipelineExclusaoSaaS(listaDeSlots, dadosReserva, motivo) {
    if (!listaDeSlots || listaDeSlots.length === 0) return;

    let quadraChaveFixa = "Quadra - 1";
    if (quadraSelecionadaSaaS) {
        const match = quadraSelecionadaSaaS.match(/\d+/);
        quadraChaveFixa = match ? `Quadra - ${match[0]}` : quadraSelecionadaSaaS;
    }

    const updatePayload = {};
    const quadraFoco = listaDeSlots[0].quadra || quadraChaveFixa;

    let nomeQuadraAmigavel = quadraSelecionadaSaaS || "Quadra 1 - Coberta";
    const numQuadra = quadraFoco.match(/\d+/);
    if (numQuadra && configQuadrasGlobal && configQuadrasGlobal.nomes) {
        const dadosQ = configQuadrasGlobal.nomes[numQuadra[0]];
        if (dadosQ) {
            nomeQuadraAmigavel = typeof dadosQ === 'object' ? (dadosQ.nome || `Quadra ${numQuadra[0]}`) : dadosQ;
        }
    }

    listaDeSlots.forEach(slot => {
        const qFoco = slot.quadra || quadraChaveFixa;
        const slotKey = `${slot.dia}_${slot.hora}`;
        const pathNode = `reservas/${qFoco}/${slotKey}`;

        let quadraKey = "Quadra1";
        const matchQ = qFoco.match(/\d+/);
        if (matchQ) { quadraKey = `Quadra${matchQ[0]}`; }
        const configAula = configAulasGlobal[quadraKey] || null;
        const aulaAtiva = configAula && configAula.Ativo && configAula.Grade;
        const temAula = aulaAtiva && configAula.Grade[slotKey] && configAula.Grade[slotKey] !== "";

        if (temAula) {
            updatePayload[pathNode] = { status: 'aula_cancelada' };
        } else {
            updatePayload[pathNode] = null; 
        }
    });

    const autorExclusao = isGestorLogado ? "Administração (Gestor)" : (localStorage.getItem('jogadorLogadoNome') || "Sócio");
    const duracaoNumerica = parseInt(dadosReserva.duracao) || 1;

    const logReciboRich = {
		origem: "manual",
        timestamp: new Date().toISOString(),
        dataLocal: new Date().toLocaleString('pt-BR'),
        autor: autorExclusao,
        acao: "EXCLUSÃO_AGENDAMENTO",
        motivo: motivo,
        clube: clubeAtivoId,
        quadra: nomeQuadraAmigavel,
        horario: `${String(dadosReserva.hora).padStart(2, '0')}:00 - ${String(dadosReserva.hora + duracaoNumerica).padStart(2, '0')}:00`,
        duracao: duracaoNumerica === 1 ? "1 Hora" : "2 Horas",
        data: dadosReserva.dataCompleta ? dadosReserva.dataCompleta.split('-').reverse().join('-') : "",
        statusNoMomentoDaExclusao: dadosReserva.status || "confirmada",
        organizadorDaReserva: dadosReserva.organizador || "Não Informado",
        confirmacoes: dadosReserva.confirmacoes || {},
        jogadores: dadosReserva.jogadores || "",
        jogadores_completo: dadosReserva.jogadores_completo || "",
        slotsExcluidos: listaDeSlots
    };

    database.ref(raizBanco).update(updatePayload)
    .then(() => {
        showToast("Reserva cancelada com sucesso!", "success");
        enviarFilaLogsAoGitHubSaaS([logReciboRich]);
    })
    .catch(err => {
        console.error("❌ [Pipeline SaaS] Erro ao processar exclusão em lote:", err);
        showToast("Erro ao processar a exclusão no banco de dados.", "error");
    });
}

function executarFaxinaAutomaticaSaaS() {
    console.log("🤖 [SaaS Faxina] Iniciando varredura de histórico, convites expirados, súmulas vencidas e resgates...");
    
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const linhaDeCorte = new Date(hoje);
    linhaDeCorte.setDate(hoje.getDate() - DiasParaExibir); 
    const agoraMs = Date.now(); 

    const confRanking = (configRegrasGlobal && configRegrasGlobal.ranking) ? configRegrasGlobal.ranking : {};
    const prazoAutoconf = (confRanking.sumula && confRanking.sumula.prazoAutoconf !== undefined) ? parseInt(confRanking.sumula.prazoAutoconf, 10) : 24;
    
    Promise.all([
        database.ref(`${raizBanco}/reservas`).once('value'),
        database.ref(`${raizBanco}/logs_pendentes`).once('value'),
        database.ref(`${raizBanco}/ranking/partidas`).once('value')
    ]).then(([snapReservas, snapPendentes, snapPartidasRanking]) => {
        const todasAsReservas = snapReservas.val() || {};
        const logsPendentesObj = snapPendentes.val() || {};
        const todasPartidasRanking = snapPartidasRanking.val() || {};
        
        const updatePayload = {};
        const filaLogsPremium = [];
        let totalPartidasLimpas = 0;

        const chavesPendentes = Object.keys(logsPendentesObj);
        if (chavesPendentes.length > 0) {
            console.log(`♻️ [SaaS Faxina] Resgatando ${chavesPendentes.length} log(s) pendente(s) da fila de falhas.`);
            chavesPendentes.forEach(key => {
                filaLogsPremium.push(logsPendentesObj[key]);
            });
            updatePayload['logs_pendentes'] = null; 
        }

        Object.keys(todasPartidasRanking).forEach(pKey => {
            const partida = todasPartidasRanking[pKey];
            const dp = partida ? partida.dadosPlacar : null;

            if (dp && dp.statusPlacar === 'pendente_validacao' && dp.expiraValidacaoAt && dp.expiraValidacaoAt <= agoraMs) {
                let jaConsolidadaNaAgenda = false;

                Object.keys(todasAsReservas).forEach(quadraChave => {
                    const slotsQuadra = todasAsReservas[quadraChave] || {};
                    Object.keys(slotsQuadra).forEach(slotKey => {
                        const r = slotsQuadra[slotKey];
                        if (!r) return;
                        const rSt = r.statusPlacar || (r.dadosPlacar ? r.dadosPlacar.statusPlacar : '');

                        if (rSt === 'consolidado') {
                            const partesPKey = pKey.split('_');
                            if (partesPKey.length >= 6) {
                                const diaP = partesPKey[partesPKey.length - 4];
                                const horaP = partesPKey[partesPKey.length - 3];
                                if (String(r.dia) === String(diaP) && String(r.hora) === String(horaP)) {
                                    jaConsolidadaNaAgenda = true;
                                }
                            }
                        }
                    });
                });

                updatePayload[`ranking/partidas/${pKey}/status`] = 'finalizada';
                updatePayload[`ranking/partidas/${pKey}/dadosPlacar/statusPlacar`] = 'consolidado';

                if (jaConsolidadaNaAgenda) {
                    console.log(`🚑 [SaaS Faxina] Sincronização: Partida ${pKey} atualizada para consolidado.`);
                } else {
                    const horasPartida = dp.prazoAutoHoras || prazoAutoconf;
                    updatePayload[`ranking/partidas/${pKey}/dadosPlacar/autoHomologado`] = true;
                    updatePayload[`ranking/partidas/${pKey}/dadosPlacar/prazoAutoHoras`] = horasPartida;
                    totalPartidasLimpas++;
                    console.log(`⏱️ [SaaS Faxina] Partida ${pKey} auto-homologada por decurso do prazo de ${horasPartida}h.`);
                }
            }
        });

        Object.keys(todasAsReservas).forEach(quadraChave => {
            const slotsQuadra = todasAsReservas[quadraChave] || {};
            const chavesPuladas = new Set(); 

            let nomeQuadraAmigavel = quadraChave;
            const numQuadra = quadraChave.match(/\d+/);
            if (numQuadra && configQuadrasGlobal && configQuadrasGlobal.nomes) {
                const dadosQ = configQuadrasGlobal.nomes[numQuadra[0]];
                if (dadosQ) nomeQuadraAmigavel = typeof dadosQ === 'object' ? (dadosQ.nome || `Quadra ${numQuadra[0]}`) : dadosQ;
            }

            let quadraKey = "Quadra1";
            if (numQuadra) quadraKey = `Quadra${numQuadra[0]}`;
            const configAula = configAulasGlobal[quadraKey] || null;
            const aulaAtiva = configAula && configAula.Ativo && configAula.Grade;

            Object.keys(slotsQuadra).forEach(slotKey => {
                if (chavesPuladas.has(slotKey)) return;

                const r = slotsQuadra[slotKey];
                if (!r) return;

                const dp = r.dadosPlacar;
                const stPlacar = r.statusPlacar || (dp ? dp.statusPlacar : '');
                const ehRanking = (r.isRanking === true || r.isRanking === 'true' || r.tipo === 'ranking');

                if (dp && stPlacar === 'pendente_validacao' && dp.expiraValidacaoAt && dp.expiraValidacaoAt <= agoraMs) {
                    const horasPartida = dp.prazoAutoHoras || prazoAutoconf;
                    updatePayload[`reservas/${quadraChave}/${slotKey}/statusPlacar`] = 'consolidado';
                    updatePayload[`reservas/${quadraChave}/${slotKey}/dadosPlacar/statusPlacar`] = 'consolidado';
                    updatePayload[`reservas/${quadraChave}/${slotKey}/dadosPlacar/autoHomologado`] = true;
                    updatePayload[`reservas/${quadraChave}/${slotKey}/dadosPlacar/prazoAutoHoras`] = horasPartida;

                    const dur = parseInt(r.duracao) || 1;
                    if (dur === 2) {
                        const partes = slotKey.split('_');
                        if (partes.length === 2) {
                            const proxSlot = `${partes[0]}_${parseInt(partes[1], 10) + 1}`;
                            updatePayload[`reservas/${quadraChave}/${proxSlot}/statusPlacar`] = 'consolidado';
                            if (slotsQuadra[proxSlot] && slotsQuadra[proxSlot].dadosPlacar) {
                                updatePayload[`reservas/${quadraChave}/${proxSlot}/dadosPlacar/statusPlacar`] = 'consolidado';
                            }
                            chavesPuladas.add(proxSlot);
                        }
                    }

                    if (ehRanking) {
                        const partesApelidos = (r.jogadores || "").split(',').map(s => s.trim());
                        const partesCompletos = (r.jogadores_completo || "").split(',').map(s => s.trim());

                        const idJ1 = (typeof obterIdJogadorPorTextoSaaS === 'function') 
                            ? obterIdJogadorPorTextoSaaS(partesCompletos[0] || partesApelidos[0]) 
                            : null;
                        const idJ2 = (typeof obterIdJogadorPorTextoSaaS === 'function') 
                            ? obterIdJogadorPorTextoSaaS(partesCompletos[1] || partesApelidos[1]) 
                            : null;

                        if (idJ1 && idJ2) {
                            const atletaBase = (typeof jogadoresGlobal !== 'undefined' && jogadoresGlobal[idJ1]) ? jogadoresGlobal[idJ1] : {};
                            const classe = (atletaBase.classe || 'B').toUpperCase();
                            const divGenero = confRanking.divisaoGenero || 'separado';
                            let generoKey = (atletaBase.genero || 'MASCULINO').toUpperCase();
                            if (generoKey === 'NAO_INFORMAR') generoKey = 'MASCULINO';

                            const chaveTabela = (divGenero === 'unificado') ? `${classe}_UNIFICADO` : `${classe}_${generoKey}`;
                            
                            const matchQ = quadraChave.match(/\d+/);
                            const qKeyLimpa = matchQ ? `Quadra${matchQ[0]}` : quadraChave;

                            const partesSlot = slotKey.split('_');
                            const diaReserva = partesSlot[0] || r.dia;
                            const horaReserva = partesSlot[1] || r.hora;

                            const partidaId = `partida_${chaveTabela}_${qKeyLimpa}_${diaReserva}_${horaReserva}_${idJ1}_${idJ2}`;

                            let gamesP1 = 0, gamesP2 = 0;
                            if (dp.parciais) {
                                Object.values(dp.parciais).forEach(st => {
                                    gamesP1 += parseInt(st.j1) || 0;
                                    gamesP2 += parseInt(st.j2) || 0;
                                });
                            }

                            let idVencedor = null;
                            if (dp.vencedorCodigo === 'J1') idVencedor = idJ1;
                            else if (dp.vencedorCodigo === 'J2') idVencedor = idJ2;
                            else if (dp.vencedor && typeof obterIdJogadorPorTextoSaaS === 'function') {
                                idVencedor = obterIdJogadorPorTextoSaaS(dp.vencedor);
                            }

                            const dpConsolidado = {
                                ...dp,
                                statusPlacar: 'consolidado',
                                autoHomologado: true,
                                prazoAutoHoras: horasPartida
                            };

                            const payloadPartida = {
                                categoria: chaveTabela,
                                quadra: nomeQuadraAmigavel,
                                status: 'finalizada',
                                jogador1Id: idJ1,
                                jogador2Id: idJ2,
                                vencedorId: idVencedor,
                                gamesP1: gamesP1,
                                gamesP2: gamesP2,
                                posicaoP1: r.posicaoP1 || dp.posicaoP1 || '',
                                posicaoP2: r.posicaoP2 || dp.posicaoP2 || '',
                                dadosPlacar: dpConsolidado,
                                dataHora: dp.dataHoraValidacao || dp.dataHoraLancamento || Date.now()
                            };

                            if (r.tagGrupoRanking || dp.tagGrupoRanking) {
                                payloadPartida.tagGrupoRanking = r.tagGrupoRanking || dp.tagGrupoRanking;
                            }
                            if (r.tagFaseRanking || dp.tagFaseRanking) {
                                payloadPartida.tagFaseRanking = r.tagFaseRanking || dp.tagFaseRanking;
                            }

                            updatePayload[`ranking/partidas/${partidaId}`] = payloadPartida;

                            if (typeof processarResultadoRankingSaaS === 'function') {
                                processarResultadoRankingSaaS({
                                    ...r,
                                    statusPlacar: 'consolidado',
                                    dadosPlacar: dpConsolidado
                                });
                            }
                        }
                    }

                    totalPartidasLimpas++;
                    console.log(`⏱️ [SaaS Faxina] Reserva ${slotKey} auto-homologada e sincronizada no ranking.`);
                    return;
                }

                if (!r.dataCompleta || r.status === 'aula_cancelada') return;

                const partesData = r.dataCompleta.split('-');
                const dataReserva = new Date(parseInt(partesData[0]), parseInt(partesData[1]) - 1, parseInt(partesData[2]), 0, 0, 0, 0);

                const passouDoPrazoDeExibicao = (dataReserva < linhaDeCorte);
                const conviteExpirou = (r.status === 'pendente' && r.expiraEm && r.expiraEm < agoraMs);

                if (passouDoPrazoDeExibicao || conviteExpirou) {
                    const partes = slotKey.split('_');
                    if (partes.length !== 2) return;

                    const diaReserva = parseInt(partes[0], 10);
                    const horaReserva = parseInt(partes[1], 10);
                    const duracaoReserva = parseInt(r.duracao) || 1;

                    const isDuplaSlot = typeof configDuplasGlobal !== 'undefined' && configDuplasGlobal && 
                                        configDuplasGlobal[quadraKey] && 
                                        configDuplasGlobal[quadraKey].Ativo && 
                                        configDuplasGlobal[quadraKey].Grade && 
                                        configDuplasGlobal[quadraKey].Grade[slotKey] === true;

                    let quorumExigido = 1;
                    if (isDuplaSlot) {
                        quorumExigido = 4;
                    } else if (typeof configRegrasGlobal !== 'undefined' && configRegrasGlobal) {
                        if (duracaoReserva === 1) {
                            quorumExigido = configRegrasGlobal.Quorum1h !== undefined ? parseInt(configRegrasGlobal.Quorum1h) : 1;
                        } else {
                            quorumExigido = configRegrasGlobal.Quorum2h !== undefined ? parseInt(configRegrasGlobal.Quorum2h) : 2;
                        }
                    }

                    let qtdConfirmados = 0;
                    const listApelidos = (r.jogadores || "").split(',').map(s => s.trim());
                    const listCompleto = (r.jogadores_completo || "").split(',').map(s => s.trim());
                    const confs = r.confirmacoes || {};
                    
                    let newConfs = {};
                    let indicesConfirmados = [];

                    listApelidos.forEach((apelidoBusca, idx) => {
                        let isConfirmed = false;
                        
                        Object.keys(confs).forEach(k => {
                            if (k.toUpperCase() === apelidoBusca.toUpperCase() && confs[k] === true) {
                                isConfirmed = true;
                            }
                        });
                        
                        if (idx === 0) isConfirmed = true;

                        if (isConfirmed) {
                            qtdConfirmados++;
                            newConfs[apelidoBusca] = true;
                            indicesConfirmados.push(idx);
                        }
                    });

                    const sobreviveuAoQuorum = conviteExpirou && !passouDoPrazoDeExibicao && (qtdConfirmados >= quorumExigido);

                    const pathNode1 = `reservas/${quadraChave}/${slotKey}`;
                    const temAula1 = aulaAtiva && configAula.Grade[slotKey] && configAula.Grade[slotKey] !== "";
                    
                    let proximaHora = horaReserva + 1;
                    let proximaChave = `${diaReserva}_${proximaHora}`;
                    let pathNode2 = `reservas/${quadraChave}/${proximaChave}`;
                    let temAula2 = aulaAtiva && configAula.Grade[proximaChave] && configAula.Grade[proximaChave] !== "";

                    if (sobreviveuAoQuorum) {
                        const novosApelidos = indicesConfirmados.map(i => listApelidos[i]).join(', ');
                        const novosCompletos = indicesConfirmados.map(i => listCompleto[i]).join(', ');

                        const rAtualizada = { ...r };
                        rAtualizada.status = "confirmada";
                        rAtualizada.jogadores = novosApelidos;
                        rAtualizada.jogadores_completo = novosCompletos;
                        rAtualizada.confirmacoes = newConfs;
                        delete rAtualizada.expiraEm; 

                        updatePayload[pathNode1] = rAtualizada;
                        chavesPuladas.add(slotKey);

                        if (duracaoReserva === 2) {
                            const rAtualizada2 = { ...rAtualizada };
                            rAtualizada2.hora = proximaHora;
                            delete rAtualizada2.borda; 
                            updatePayload[pathNode2] = rAtualizada2;
                            chavesPuladas.add(proximaChave);
                        }

                        const logEviccao = {
                            origem: "sistema",
                            timestamp: new Date().toISOString(),
                            dataLocal: new Date().toLocaleString('pt-BR'),
                            autor: "Rotina Automática de Sistema",
                            acao: "EVIÇÃO_PARCIAL_CONVITE",
                            motivo: `Convite expirado. Reserva MANTIDA (${qtdConfirmados} confirmado(s)). Jogadores pendentes foram removidos.`,
                            clube: clubeAtivoId,
                            quadra: nomeQuadraAmigavel,
                            horario: `${String(horaReserva).padStart(2, '0')}:00 - ${String(horaReserva + duracaoReserva).padStart(2, '0')}:00`,
                            duracao: duracaoReserva === 1 ? "1 Hora" : "2 Horas",
                            data: r.dataCompleta ? r.dataCompleta.split('-').reverse().join('-') : "",
                            statusNoMomentoDaExclusao: "confirmada",
                            organizadorDaReserva: r.organizador || "Não Informado",
                            confirmacoes: newConfs,
                            jogadores: novosApelidos,
                            jogadores_completo: novosCompletos,
                            slotsExcluidos: []
                        };
                        filaLogsPremium.push(logEviccao);
                        totalPartidasLimpas++;

                    } else {
                        const slotsDestaPartida = [{ quadra: quadraChave, dia: diaReserva, hora: horaReserva }];

                        updatePayload[pathNode1] = temAula1 ? { status: 'aula_cancelada' } : null;
                        chavesPuladas.add(slotKey);

                        if (duracaoReserva === 2) {
                            slotsDestaPartida.push({ quadra: quadraChave, dia: diaReserva, hora: proximaHora });
                            updatePayload[pathNode2] = temAula2 ? { status: 'aula_cancelada' } : null;
                            chavesPuladas.add(proximaChave);
                        }

                        if (conviteExpirou && r.organizador) {
                            const norm = (txt) => (txt || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, " ").trim().toUpperCase();
                            const orgNorm = norm(r.organizador);

                            const idOrg = Object.keys(jogadoresGlobal || {}).find(id => {
                                const j = jogadoresGlobal[id];
                                return j && (norm(j.nomeCompleto) === orgNorm || norm(j.apelido) === orgNorm);
                            });

                            if (idOrg) {
                                const diasSemana = ["", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"];
                                const nomeDia = diasSemana[diaReserva] || "Dia";
                                const hInicio = String(horaReserva).padStart(2, '0') + ":00";
                                const hFim = String(horaReserva + duracaoReserva).padStart(2, '0') + ":00";
                                const quadraTexto = nomeQuadraAmigavel.toLowerCase().startsWith('quadra') ? nomeQuadraAmigavel.toLowerCase() : `quadra ${nomeQuadraAmigavel}`;

                                const keyNotif = database.ref().push().key;
                                const payloadNotif = {
                                    categoria: "cancelado_quorum",
                                    detalhe: `${nomeDia}, das ${hInicio} às ${hFim} hs, na ${quadraTexto}`,
                                    timestamp: Date.now()
                                };
                                updatePayload[`jogadores/${idOrg}/notificacoes/${keyNotif}`] = payloadNotif;
                            }
                        }

                        const motivoLog = conviteExpirou 
                            ? `Convite expirado (Cancelada por falta de quórum: Exigido ${quorumExigido}, Confirmado(s) ${qtdConfirmados})` 
                            : `Limpeza automática por decurso do prazo de exibição (${DiasParaExibir}d)`;

                        const logReciboAutomático = {
                            origem: "sistema", 
                            timestamp: new Date().toISOString(),
                            dataLocal: new Date().toLocaleString('pt-BR'),
                            autor: "Rotina Automática de Sistema",
                            acao: conviteExpirou ? "EXPIRAÇÃO_CONVITE" : "EXCLUSÃO_HISTÓRICO",
                            motivo: motivoLog,
                            clube: clubeAtivoId,
                            quadra: nomeQuadraAmigavel,
                            horario: `${String(horaReserva).padStart(2, '0')}:00 - ${String(horaReserva + duracaoReserva).padStart(2, '0')}:00`,
                            duracao: duracaoReserva === 1 ? "1 Hora" : "2 Horas",
                            data: r.dataCompleta ? r.dataCompleta.split('-').reverse().join('-') : "",
                            statusNoMomentoDaExclusao: r.status || "confirmada",
                            organizadorDaReserva: r.organizador || "Não Informado",
                            confirmacoes: r.confirmacoes || {},
                            jogadores: r.jogadores || "",
                            jogadores_completo: r.jogadores_completo || "",
                            slotsExcluidos: slotsDestaPartida
                        };

                        filaLogsPremium.push(logReciboAutomático);
                        totalPartidasLimpas++;
                    }
                }
            });
        });

        if (totalPartidasLimpas > 0 || chavesPendentes.length > 0) {
            console.log(`🤖 [SaaS Faxina] Captura finalizada. Despachando lote para o Firebase...`);
            
            database.ref(raizBanco).update(updatePayload)
            .then(() => {
                console.log(`🤖 [SaaS Faxina] Firebase atualizado. Tentando enviar ${filaLogsPremium.length} relatórios para o GitHub...`);
                if (typeof enviarFilaLogsAoGitHubSaaS === 'function') {
                    enviarFilaLogsAoGitHubSaaS(filaLogsPremium); 
                }
                window.saasFaxinaPronta = true;
                if (typeof verificarLiberacaoTelaLoadingSaaS === 'function') { verificarLiberacaoTelaLoadingSaaS(); }
            })
            .catch(err => {
                console.error("❌ [SaaS Faxina] Falha ao aplicar descarte/atualização no Firebase:", err);
                window.saasFaxinaPronta = true;
                if (typeof verificarLiberacaoTelaLoadingSaaS === 'function') { verificarLiberacaoTelaLoadingSaaS(); }
            });
        } else {
            console.log("🤖 [SaaS Faxina] Varredura encerrada. Nenhuma reserva expirada, súmula pendente vencida ou log encalhado.");
            window.saasFaxinaPronta = true;
            if (typeof verificarLiberacaoTelaLoadingSaaS === 'function') { verificarLiberacaoTelaLoadingSaaS(); }
        }
    }).catch(err => {
        console.error("❌ [SaaS Faxina] Falha ao ler dados para triagem:", err);
    });
}

// ====================================================================
// 🕵️ FASE 4: O ESPIÃO DE CONVITES PENDENTES (SAAS)
// ====================================================================

let intervaloConvitesSaaS = null;

function renderizarGavetaConvitesSaaS(convites) {
    const modal = document.getElementById('modal-convites-entrada');
    const container = document.getElementById('lista-convites-container');
    const titulo = document.getElementById('titulo-qtd-convites');
    
    if (!modal || !container || !titulo) return;

    titulo.textContent = convites.length === 1 ? '1 Convite Pendente' : `${convites.length} Convites Pendentes`;
    container.innerHTML = '';

    const diasCurto = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    convites.forEach(item => {
        const r = item.dados;
        const duracao = parseInt(r.duracao) || 1;
        
        let dataFormatada = "";
        if (r.dataCompleta) {
            const partesData = r.dataCompleta.split('-');
            const dataObj = new Date(parseInt(partesData[0]), parseInt(partesData[1]) - 1, parseInt(partesData[2]));
            dataFormatada = diasCurto[dataObj.getDay()];
        }

        const hInicio = String(r.hora).padStart(2, '0') + ":00";
        const hFim = String(r.hora + duracao).padStart(2, '0') + ":00";
        const horarioFormatado = `${hInicio} - ${hFim}`;
        
        let nomeOrg = r.organizador || "Não Informado";
        if (typeof jogadoresGlobal !== 'undefined') {
            for (let id in jogadoresGlobal) {
                if (jogadoresGlobal[id].nomeCompleto && jogadoresGlobal[id].nomeCompleto.toUpperCase() === nomeOrg.toUpperCase()) {
                    nomeOrg = jogadoresGlobal[id].apelido || nomeOrg;
                    break;
                }
            }
        }
        
        if (nomeOrg === nomeOrg.toUpperCase()) {
            nomeOrg = nomeOrg.split(' ').map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ');
        }
        
        let nomeQuadraAmigavel = item.quadra;
        const numQuadra = item.quadra.match(/\d+/);
        if (numQuadra && configQuadrasGlobal && configQuadrasGlobal.nomes) {
            const dadosQ = configQuadrasGlobal.nomes[numQuadra[0]];
            if (dadosQ) {
                nomeQuadraAmigavel = typeof dadosQ === 'object' ? (dadosQ.nome || `Quadra ${numQuadra[0]}`) : dadosQ;
            }
        }

        const htmlCard = `
            <div class="convite-item" id="convite-card-${item.quadra}-${item.slotKey}">
                <div class="convite-header">
                    <span class="convite-data">${dataFormatada} &bull; ${horarioFormatado}</span>
                    <span class="txt-expira"><i class="material-icons">timer</i> <span class="timer-countdown" data-expira="${r.expiraEm}">Calculando...</span></span>
                </div>
                
                <div class="convite-info">
                    ${nomeQuadraAmigavel} &bull; Org: ${nomeOrg}<br>
                    <strong>Jogadores:</strong> ${r.jogadores || 'N/A'}
                </div>
                
                <div class="botoes-acao">
                    <button class="btn-universal btn-danger" onclick="responderConviteSaaS('${item.quadra}', '${item.slotKey}', false)">Recusar</button>
                    <button class="btn-universal btn-success" onclick="responderConviteSaaS('${item.quadra}', '${item.slotKey}', true)">Confirmar</button>
                </div>
            </div>
        `;
        container.innerHTML += htmlCard;
    });

    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('ativa'), 20);
    iniciarRelogioConvitesSaaS();
}

function iniciarRelogioConvitesSaaS() {
    if (intervaloConvitesSaaS) clearInterval(intervaloConvitesSaaS);

    const atualizar = () => {
        const agora = Date.now();
        const timers = document.querySelectorAll('.timer-countdown');
        let ativos = 0;

        timers.forEach(t => {
            const expiraEm = parseInt(t.getAttribute('data-expira'));
            const diff = expiraEm - agora;

            if (diff <= 0) {
                t.textContent = "Expirado";
                t.parentElement.style.color = "#dc3545";
                
                const card = t.closest('.convite-item');
                if (card && typeof concluirEfeitoCardSaaS === 'function') {
                    concluirEfeitoCardSaaS(card);
                }
                
                if (typeof executarFaxinaAutomaticaSaaS === 'function') {
                    executarFaxinaAutomaticaSaaS();
                }
            } else {
                ativos++;
                const horas = Math.floor(diff / (1000 * 60 * 60));
                const minutos = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const segundos = Math.floor((diff % (1000 * 60)) / 1000);

                t.textContent = `${String(horas).padStart(2, '0')}h ${String(minutos).padStart(2, '0')}m ${String(segundos).padStart(2, '0')}s`;
            }
        });

        if (ativos === 0) clearInterval(intervaloConvitesSaaS);
    };

    atualizar(); 
    intervaloConvitesSaaS = setInterval(atualizar, 1000); 
}

function fecharModalConvitesEntradaSaaS(adiarSessao = false) {
    const modal = document.getElementById('modal-convites-entrada'); 
    if (!modal) return;
    
    if (adiarSessao) {
        const cards = document.querySelectorAll('#lista-convites-container .convite-item');
        cards.forEach(card => {
            const idBruto = card.id.replace('convite-card-', ''); 
            if (idBruto && !window.ignoradosSessaoSaaS.includes(idBruto)) {
                window.ignoradosSessaoSaaS.push(idBruto);
            }
        });
    }

    modal.classList.remove('ativa');
    setTimeout(() => {
        modal.style.display = 'none';
    }, 300);
    
    if (intervaloConvitesSaaS) clearInterval(intervaloConvitesSaaS);
}

// ----------------------------------------------------
// FASE 5: O MOTOR DE TRANSAÇÕES ATÔMICAS (RESPOSTAS COM LOGS)
// ----------------------------------------------------
function responderConviteSaaS(quadraChave, slotKey, aceitou) {
    if (navigator.vibrate) navigator.vibrate(30);

    const idLogado = localStorage.getItem('jogadorLogadoId');
    const nomeCompletoBusca = localStorage.getItem('jogadorLogadoNome') || "Sócio";
    
    let apelidoBusca = nomeCompletoBusca;
    if (typeof jogadoresGlobal !== 'undefined' && jogadoresGlobal[idLogado]) {
        apelidoBusca = jogadoresGlobal[idLogado].apelido || nomeCompletoBusca;
    }

    let dadosReservaAntes = null;

    const card = document.getElementById(`convite-card-${quadraChave}-${slotKey}`);
    if (card) {
        card.classList.add('convite-processando');
    }

    const caminhoKey1 = `${raizBanco}/reservas/${quadraChave}/${slotKey}`;
    
    database.ref(caminhoKey1).transaction((reserva) => {
        if (!reserva) return null; 

        dadosReservaAntes = JSON.parse(JSON.stringify(reserva));

        if (aceitou) {
            if (reserva.confirmacoes && reserva.confirmacoes[apelidoBusca] !== undefined) {
                reserva.confirmacoes[apelidoBusca] = true;
            }
        } else {
            if (reserva.confirmacoes) {
                delete reserva.confirmacoes[apelidoBusca];
            }
            
            if (reserva.jogadores) {
                let arr = reserva.jogadores.split(',').map(s => s.trim());
                arr = arr.filter(n => n.toUpperCase() !== apelidoBusca.toUpperCase());
                reserva.jogadores = arr.join(', ');
            }
            
            if (reserva.jogadores_completo) {
                let arrC = reserva.jogadores_completo.split(',').map(s => s.trim());
                arrC = arrC.filter(n => n.toUpperCase() !== nomeCompletoBusca.toUpperCase());
                reserva.jogadores_completo = arrC.join(', ');
            }
        }

        let todosConfirmados = true;
        let qtdRestantes = 0;

        if (reserva.confirmacoes) {
            Object.values(reserva.confirmacoes).forEach(val => {
                qtdRestantes++;
                if (val === false) todosConfirmados = false;
            });
        }

        let quadraIndex = "Quadra1";
        const matchQ = quadraChave.match(/\d+/);
        if (matchQ) quadraIndex = `Quadra${matchQ[0]}`;
        
        const isDuplaSlot = typeof configDuplasGlobal !== 'undefined' && configDuplasGlobal && 
                            configDuplasGlobal[quadraIndex] && 
                            configDuplasGlobal[quadraIndex].Ativo && 
                            configDuplasGlobal[quadraIndex].Grade && 
                            configDuplasGlobal[quadraIndex].Grade[slotKey] === true;

        const duracao = parseInt(reserva.duracao) || 1; 
        let quorumExigido = 1;
        
        if (isDuplaSlot) {
            quorumExigido = 4;
        } else if (typeof configRegrasGlobal !== 'undefined' && configRegrasGlobal) {
            if (duracao === 1) {
                quorumExigido = configRegrasGlobal.Quorum1h !== undefined ? parseInt(configRegrasGlobal.Quorum1h) : 1;
            } else {
                quorumExigido = configRegrasGlobal.Quorum2h !== undefined ? parseInt(configRegrasGlobal.Quorum2h) : 2;
            }
        }

        if (qtdRestantes < quorumExigido) {
            console.log(`💀 [Quórum] Reserva cancelada: Restaram ${qtdRestantes} jogadores, mínimo exigido: ${quorumExigido}.`);
            return null; 
        }

        if (todosConfirmados) {
            reserva.status = "confirmada";
        } else {
            reserva.status = "pendente";
        }

        return reserva;
    })
    .then((resultado) => {
        if (!resultado.committed) return;
        const reservaAtualizada = resultado.snapshot.val();
        
        let nomeQuadraAmigavel = quadraChave;
        const numQuadra = quadraChave.match(/\d+/);
        if (numQuadra && configQuadrasGlobal && configQuadrasGlobal.nomes) {
            const dadosQ = configQuadrasGlobal.nomes[numQuadra[0]];
            if (dadosQ) {
                nomeQuadraAmigavel = typeof dadosQ === 'object' ? (dadosQ.nome || `Quadra ${numQuadra[0]}`) : dadosQ;
            }
        }

        const partes = slotKey.split('_');
        const dia = parseInt(partes[0]);
        const hora = parseInt(partes[1]); 

        let idOrg = null;
        let detalheFormatado = "";

        if (dadosReservaAntes && dadosReservaAntes.organizador) {
            const norm = (txt) => (txt || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, " ").trim().toUpperCase();
            const orgNorm = norm(dadosReservaAntes.organizador);

            idOrg = Object.keys(jogadoresGlobal || {}).find(id => {
                const j = jogadoresGlobal[id];
                return j && (norm(j.nomeCompleto) === orgNorm || norm(j.apelido) === orgNorm);
            });

            const diasSemana = ["", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"];
            const nomeDia = diasSemana[dia] || "Dia";
            const duracaoRes = parseInt(dadosReservaAntes.duracao) || 1;
            const hInicio = String(hora).padStart(2, '0') + ":00";
            const hFim = String(hora + duracaoRes).padStart(2, '0') + ":00";
            const quadraTexto = nomeQuadraAmigavel.toLowerCase().startsWith('quadra') ? nomeQuadraAmigavel.toLowerCase() : `quadra ${nomeQuadraAmigavel}`;
            detalheFormatado = `${nomeDia}, das ${hInicio} às ${hFim} hs, na ${quadraTexto}`;
        }

        if (!reservaAtualizada) {
            const caminhoKey2 = `${raizBanco}/reservas/${quadraChave}/${dia}_${hora + 1}`;
            database.ref(caminhoKey2).remove();

            if (idOrg && !aceitou) {
                const payloadNotif = {
                    categoria: "cancelado_quorum",
                    adversario: apelidoBusca,
                    detalhe: detalheFormatado,
                    timestamp: Date.now()
                };
                database.ref(`${raizBanco}/jogadores/${idOrg}/notificacoes`).push(payloadNotif);
            }

            if (dadosReservaAntes && !aceitou) {
                const duracao = parseInt(dadosReservaAntes.duracao) || 1;
                const slotsExcluidos = [{ quadra: quadraChave, dia: dia, hora: hora }];
                if (duracao === 2) {
                    slotsExcluidos.push({ quadra: quadraChave, dia: dia, hora: hora + 1 });
                }

                const logRecusaCancelamento = {
                    origem: "sistema",
                    timestamp: new Date().toISOString(),
                    dataLocal: new Date().toLocaleString('pt-BR'),
                    autor: "Rotina Automática de Sistema",
                    acao: "RECUSA_CONVITE_CANCELAMENTO",
                    motivo: `Convite recusado por ${apelidoBusca}. Reserva cancelada por falta de quórum mínimo.`,
                    clube: clubeAtivoId,
                    quadra: nomeQuadraAmigavel,
                    horario: `${String(hora).padStart(2, '0')}:00 - ${String(hora + duracao).padStart(2, '0')}:00`,
                    duracao: duracao === 1 ? "1 Hora" : "2 Horas",
                    data: dadosReservaAntes.dataCompleta ? dadosReservaAntes.dataCompleta.split('-').reverse().join('-') : "",
                    statusNoMomentoDaExclusao: dadosReservaAntes.status || "pendente",
                    organizadorDaReserva: dadosReservaAntes.organizador || "Não Informado",
                    confirmacoes: dadosReservaAntes.confirmacoes || {},
                    jogadores: dadosReservaAntes.jogadores || "",
                    jogadores_completo: dadosReservaAntes.jogadores_completo || "",
                    slotsExcluidos: slotsExcluidos
                };

                if (typeof enviarFilaLogsAoGitHubSaaS === 'function') {
                    enviarFilaLogsAoGitHubSaaS([logRecusaCancelamento]);
                }
            }

            showToast("A reserva foi cancelada por falta de quórum.", "warning");
            concluirEfeitoCardSaaS(card);
            return;
        }

        if (reservaAtualizada.duracao === 2) {
            const caminhoKey2 = `${raizBanco}/reservas/${quadraChave}/${dia}_${hora + 1}`;
            const reserva2 = JSON.parse(JSON.stringify(reservaAtualizada));
            reserva2.hora = hora + 1;
            delete reserva2.borda;
            
            database.ref(caminhoKey2).set(reserva2);
        }

        if (idOrg) {
            if (!aceitou) {
                const payloadNotif = {
                    categoria: "convite_recusado",
                    adversario: apelidoBusca,
                    detalhe: detalheFormatado,
                    timestamp: Date.now()
                };
                database.ref(`${raizBanco}/jogadores/${idOrg}/notificacoes`).push(payloadNotif);
            } else if (reservaAtualizada.status === "confirmada" && dadosReservaAntes && dadosReservaAntes.status === "pendente") {
                const payloadNotif = {
                    categoria: "partida_confirmada",
                    detalhe: detalheFormatado,
                    timestamp: Date.now()
                };
                database.ref(`${raizBanco}/jogadores/${idOrg}/notificacoes`).push(payloadNotif);
            }
        }

        if (!aceitou && dadosReservaAntes) {
            const duracao = parseInt(reservaAtualizada.duracao) || 1;

            const logRecusaParcial = {
                origem: "manual", 
                timestamp: new Date().toISOString(),
                dataLocal: new Date().toLocaleString('pt-BR'),
                autor: nomeCompletoBusca,
                acao: "RECUSA_CONVITE_PARCIAL",
                motivo: `Convite recusado por ${apelidoBusca}. O atleta foi removido e a reserva foi MANTIDA para os demais jogadores.`,
                clube: clubeAtivoId,
                quadra: nomeQuadraAmigavel,
                horario: `${String(hora).padStart(2, '0')}:00 - ${String(hora + duracao).padStart(2, '0')}:00`,
                duracao: duracao === 1 ? "1 Hora" : "2 Horas",
                data: reservaAtualizada.dataCompleta ? reservaAtualizada.dataCompleta.split('-').reverse().join('-') : "",
                statusNoMomentoDaExclusao: reservaAtualizada.status || "pendente",
                organizadorDaReserva: reservaAtualizada.organizador || "Não Informado",
                confirmacoes: reservaAtualizada.confirmacoes || {},
                jogadores: reservaAtualizada.jogadores || "",
                jogadores_completo: reservaAtualizada.jogadores_completo || "",
                slotsExcluidos: []
            };

            if (typeof enviarFilaLogsAoGitHubSaaS === 'function') {
                enviarFilaLogsAoGitHubSaaS([logRecusaParcial]);
            }
        }
        
        concluirEfeitoCardSaaS(card);
    })
    .catch(err => {
        console.error("❌ [Transação de Convite] Falha ao processar:", err);
        showToast("Erro ao comunicar com o servidor. Tente novamente.", "error");
        if (card) {
            card.classList.remove('convite-processando');
        }
    });
}

function concluirEfeitoCardSaaS(cardElement) {
    if (cardElement) {
        cardElement.classList.add('convite-saindo');
        setTimeout(() => {
            cardElement.remove();
            avaliarGavetaVaziaSaaS();
        }, 200);
    } else {
        avaliarGavetaVaziaSaaS();
    }
}

function avaliarGavetaVaziaSaaS() {
    const container = document.getElementById('lista-convites-container');
    const titulo = document.getElementById('titulo-qtd-convites');
    
    if (container && container.children.length === 0) {
        fecharModalConvitesEntradaSaaS();
        showToast("Você não possui mais convites pendentes.", "success");
    } else if (titulo && container) {
        const qtd = container.children.length;
        titulo.textContent = qtd === 1 ? '1 Convite Pendente' : `${qtd} Convites Pendentes`;
    }
}