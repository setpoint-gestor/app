"use strict";

// ==========================================
// MÓDULO DE AUDITORIA E LOGS (SaaS)
// ==========================================
let logsLocaisCache = [];     // Memória RAM com todos os logs do clube
let logsFiltradosCache = [];  // Memória RAM com a lista filtrada/ordenada na tela
let ordemCrescenteLogs = false; // Padrão: Mais recentes primeiro (Decrescente)

// Estado da Matriz de Filtros (Múltipla Seleção)
let filtrosAtivosAcao = new Set();
let filtrosAtivosTipo = new Set();
let filtrosAtivosReserva = new Set();
let filtrosAtivosJogo = new Set();

/**
 * Ponto de Entrada: Abre o modal de logs, atualiza a retenção e carrega a Timeline
 */
async function abrirModuloLogs() {
    if (navigator.vibrate) navigator.vibrate(30);

    // 1. Atualiza a Pílula com o estilo do Dashboard
    const elRetencao = document.getElementById('txt-dias-retencao-logs');
    if (elRetencao) {
        const dias = (typeof DiasLimpezaLogs !== 'undefined' && DiasLimpezaLogs !== null) ? DiasLimpezaLogs : 15;
        elRetencao.textContent = dias === 0 ? "Faxina: OFF" : `Auto-Faxina: ${dias}d`;
    }

    // 2. Abre a janela modal do sistema
    abrirModalConfig('modal-historico-logs'); 

    // 3. Exibe o estado de carregamento
    const container = document.getElementById('container-timeline-logs');
    if (container) {
        container.innerHTML = `
            <div style="text-align: center; color: #64748b; padding: 40px 0; font-size: 14px;">
                <i class="material-icons" style="font-size: 32px; animation: spin 1s linear infinite; margin-bottom: 8px;">sync</i><br>
                Buscando histórico de auditoria no servidor...
            </div>
        `;
    }

    // 4. Executa a leitura + auto-faxina silenciosa
    logsLocaisCache = await carregarLogsEExecutarFaxinaSaaS();
    
    // 5. Aplica a renderização inicial
    filtrarLogsReativoSaaS();
}

/**
 * Motor de Leitura e Auto-Faxina Silenciosa do Histórico
 */
async function carregarLogsEExecutarFaxinaSaaS() {
    console.log("📜 [Logs SaaS] Iniciando sincronização e auto-faxina do histórico...");

    if (!clubeAtivoId || !raizBanco) {
        console.warn("⚠️ [Logs SaaS] Abortado: Clube ativo não identificado.");
        return [];
    }

    let tokenAcesso = null;
    try {
        const snapToken = await database.ref('Clubes/SaaS_Config/githubToken').once('value');
        tokenAcesso = snapToken ? snapToken.val() : null;
    } catch (e) {
        console.error("❌ [Logs SaaS] Erro ao ler githubToken no Firebase:", e);
    }

    if (!tokenAcesso) {
        console.warn("⚠️ [Logs SaaS] Token do GitHub indisponível.");
        return [];
    }

    const repoOwner = "setpoint-gestor";
    const repoName = "app";
    const nomeArquivoLogs = `logs/${clubeAtivoId}_reservas-excluidas.json`;
    const urlApi = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${nomeArquivoLogs}`;

    let existenteSha = null;
    let arrayLogsGitHub = [];

    try {
        const respostaGet = await fetch(urlApi, {
            method: "GET",
            headers: {
                "Authorization": `token ${tokenAcesso}`,
                "Accept": "application/vnd.github.v3+json"
            },
            cache: "no-cache"
        });

        if (respostaGet.ok) {
            const dadosArquivo = await respostaGet.json();
            existenteSha = dadosArquivo.sha;
            const conteudoDecodificado = decodeURIComponent(escape(atob(dadosArquivo.content)));
            arrayLogsGitHub = JSON.parse(conteudoDecodificado || "[]");
        } else if (respostaGet.status === 404) {
            console.log(`📝 [Logs SaaS] Histórico inédito para o clube: ${clubeAtivoId}`);
            arrayLogsGitHub = [];
        }
    } catch (err) {
        console.error("❌ [Logs SaaS] Erro ao conectar à API do GitHub:", err);
    }

    let logsPendentesFirebase = [];
    try {
        const snapPendentes = await database.ref(`${raizBanco}/logs_pendentes`).once('value');
        const objPendentes = snapPendentes.val() || {};
        logsPendentesFirebase = Object.values(objPendentes);
    } catch (e) {
        console.error("❌ [Logs SaaS] Erro ao verificar logs_pendentes no Firebase:", e);
    }

    let todosOsLogs = [...arrayLogsGitHub, ...logsPendentesFirebase];
    let houveMudaçaOuLimpeza = logsPendentesFirebase.length > 0;

    const diasRetencao = (typeof DiasLimpezaLogs !== 'undefined' && DiasLimpezaLogs !== null) ? DiasLimpezaLogs : 15;

    if (diasRetencao > 0 && todosOsLogs.length > 0) {
        const agoraMs = Date.now();
        const limiteMs = diasRetencao * 24 * 60 * 60 * 1000;
        const totalAntes = todosOsLogs.length;

        todosOsLogs = todosOsLogs.filter(log => {
            if (!log.timestamp) return true;
            const logMs = new Date(log.timestamp).getTime();
            const idadeMs = agoraMs - logMs;
            return idadeMs <= limiteMs;
        });

        if (todosOsLogs.length < totalAntes) {
            houveMudaçaOuLimpeza = true;
            console.log(`🧹 [Logs SaaS] Auto-Faxina: ${totalAntes - todosOsLogs.length} registro(s) expirado(s) purgado(s) (Limite: ${diasRetencao}d).`);
        }
    }

    if (houveMudaçaOuLimpeza) {
        try {
            const payloadString = JSON.stringify(todosOsLogs, null, 2);
            const payloadBase64 = b64EncodeUnicodeSaaS(payloadString);

            const respostaPut = await fetch(urlApi, {
                method: "PUT",
                headers: {
                    "Authorization": `token ${tokenAcesso}`,
                    "Content-Type": "application/json",
                    "Accept": "application/vnd.github.v3+json"
                },
                body: JSON.stringify({
                    message: `🤖 [SetPoint SaaS] Auto-Faxina / Resgate: Mantidos ${todosOsLogs.length} registro(s) (Retenção: ${diasRetencao}d).`,
                    content: payloadBase64,
                    sha: existenteSha
                })
            });

            if (respostaPut.ok) {
                console.log("✅ [Logs SaaS] GitHub sincronizado e limpo com sucesso!");
                await database.ref(`${raizBanco}/logs_pendentes`).remove();
            }
        } catch (err) {
            console.error("❌ [Logs SaaS] Falha ao atualizar histórico limpo no GitHub:", err);
        }
    }

    logsLocaisCache = todosOsLogs;
    return logsLocaisCache;
}

/**
 * Renderizador Mestre da Timeline Feed
 */
function renderizarTimelineLogsSaaS(lista) {
    const container = document.getElementById('container-timeline-logs');
    if (!container) return;

    // Atualiza o contador de registros direto na Barra de Busca
    const contadorInput = document.getElementById('contador-logs-input');
    if (contadorInput) {
        const qtd = lista ? lista.length : 0;
        contadorInput.textContent = `(${qtd})`;
    }

    if (!lista || lista.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; color: #94a3b8; padding: 50px 20px; font-size: 14px;">
                <i class="material-icons" style="font-size: 48px; margin-bottom: 10px; color: #cbd5e1;">content_paste_off</i><br>
                Nenhum registro encontrado para os filtros selecionados.
            </div>
        `;
        return;
    }

    let htmlTimeline = '';

    lista.forEach((log, index) => {
        let tagClasse = 'tag-manual';
        let tagIcone = 'delete';
        let tagTexto = 'Exclusão Manual';
        let corBordaDot = '#dc3545';

        const acaoUpper = (log.acao || "").toUpperCase();

        if (acaoUpper.includes('RECUSA')) {
            tagClasse = 'tag-recusa';
            tagIcone = 'event_busy';
            tagTexto = acaoUpper.includes('CANCELAMENTO') ? 'Recusa de Convite' : 'Recusa (Parcial)';
            corBordaDot = '#f97316';
        } else if (acaoUpper.includes('EXPIRAÇÃO') || acaoUpper.includes('EXPIRADO')) {
            tagClasse = 'tag-expirado';
            tagIcone = 'timer_off';
            tagTexto = 'Expirado por Tempo';
            corBordaDot = '#eab308';
        } else if (acaoUpper.includes('EVIÇÃO') || acaoUpper.includes('PARCIAL')) {
            tagClasse = 'tag-eviccao';
            tagIcone = 'person_remove';
            tagTexto = 'Ajuste de Quórum';
            corBordaDot = '#0284c7';
        } else if (acaoUpper.includes('SISTEMA') || acaoUpper.includes('HISTÓRICO')) {
            tagClasse = 'tag-expirado';
            tagIcone = 'cleaning_services';
            tagTexto = 'Limpeza do Sistema';
            corBordaDot = '#64748b';
        }

        let dataHoraFormatada = log.dataLocal || "";
        if (!dataHoraFormatada && log.timestamp) {
            dataHoraFormatada = new Date(log.timestamp).toLocaleString('pt-BR');
        }

        let htmlJogadoresList = '';
        const confs = log.confirmacoes || {};
        const stringCompletos = log.jogadores_completo || log.jogadores || "";
        const listaNomes = stringCompletos.split(',').map(s => s.trim()).filter(s => s.length > 0);

        if (listaNomes.length > 0) {
            listaNomes.forEach((nomeJogador, idx) => {
                let statusTxt = "Confirmado";
                let statusCor = "#10b981";

                if (idx === 0) {
                    statusTxt = "Organizador (OK)";
                    statusCor = "#10b981";
                } else {
                    Object.keys(confs).forEach(k => {
                        if (k.toUpperCase() === nomeJogador.toUpperCase() || nomeJogador.toUpperCase().includes(k.toUpperCase())) {
                            if (confs[k] === false) {
                                statusTxt = "Pendente / Recusado";
                                statusCor = "#dc3545";
                            }
                        }
                    });
                }

                htmlJogadoresList += `
                    <div class="player-status-item" style="align-items: center;">
                        <span style="flex: 1; text-align: left; padding-right: 12px; line-height: 1.3;">• ${nomeJogador}</span>
                        <span style="color: ${statusCor}; font-weight: bold; text-align: right; max-width: 45%; line-height: 1.3;">${statusTxt}</span>
                    </div>
                `;
            });
        } else {
            htmlJogadoresList = `<div style="color: #94a3b8; font-style: italic;">Informação de jogadores não registrada.</div>`;
        }

        htmlTimeline += `
            <div class="timeline-item-saas">
                <div class="timeline-dot-saas" style="border-color: ${corBordaDot};"></div>
                <div class="timeline-card-saas" onclick="toggleCardDetailSaaS(${index})">
                    
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; flex-wrap: wrap; gap: 6px;">
                        <span class="badge-tag ${tagClasse}">
                            <i class="material-icons" style="font-size: 12px;">${tagIcone}</i> ${tagTexto}
                        </span>
                        <span style="font-size: 12px; color: var(--txt-suave, #94a3b8); font-weight: 500;">${dataHoraFormatada}</span>
                    </div>

                    <div style="font-weight: 800; font-size: 15px; color: var(--txt-titulo, #1e293b);">
                        ${log.quadra || 'Quadra'} • ${log.data || ''} <span style="white-space: nowrap;">(${log.horario || ''})</span>
                    </div>

                    <div style="font-size: 13px; color: var(--txt-corpo, #475569); margin-top: 4px;">
                        Autor da Ação: <b>${log.autor || 'Sistema'}</b>
                    </div>

                    <!-- GAVETA EXPANSÍVEL DE DETALHES DA AUDITORIA -->
                    <div id="drawer-log-${index}" class="details-drawer-saas">
                        <p style="margin: 0 0 10px 0; color: #b91c1c; font-size: 13px; line-height: 1.5; background: #fff1f2; padding: 10px; border-radius: 6px; border: 1px solid #fecdd3;">
                            <b>Motivo:</b> ${log.motivo || 'Sem motivo registrado.'}
                        </p>

                        <div style="font-size: 11px; font-weight: 800; color: var(--txt-suave, #94a3b8); margin-bottom: 6px; letter-spacing: 0.5px;">
                            SITUAÇÃO DOS JOGADORES NO MOMENTO:
                        </div>

                        <div class="player-status-list">
                            ${htmlJogadoresList}
                        </div>
                    </div>

                </div>
            </div>
        `;
    });

    container.innerHTML = htmlTimeline;
}

/**
 * Expande / Recolhe a gaveta interna do card ao clicar
 */
function toggleCardDetailSaaS(index) {
    if (navigator.vibrate) navigator.vibrate(15);
    const drawer = document.getElementById(`drawer-log-${index}`);
    if (drawer) {
        drawer.classList.toggle('visible');
    }
}

/**
 * Filtro Reativo Instantâneo (Funil Acumulativo 'E' Puro)
 */
function filtrarLogsReativoSaaS() {
    const termo = (document.getElementById('busca-logs-input')?.value || "").toLowerCase().trim();

    logsFiltradosCache = logsLocaisCache.filter(log => {
        
        // 1. Filtro Global por Texto
        let passaTexto = true;
        if (termo !== "") {
            const quadra = (log.quadra || "").toLowerCase();
            const autor = (log.autor || "").toLowerCase();
            const motivo = (log.motivo || "").toLowerCase();
            const jogadores = (log.jogadores_completo || log.jogadores || "").toLowerCase();
            const data = (log.data || "").toLowerCase();

            passaTexto = quadra.includes(termo) || autor.includes(termo) || motivo.includes(termo) || jogadores.includes(termo) || data.includes(termo);
        }

        // 2. Filtro: Origem da Ação (Manual / Sistema)
        let passaAcao = true;
        if (filtrosAtivosAcao.size > 0) {
            const origemLog = (log.origem) 
                ? log.origem.toLowerCase() 
                : ((log.autor || "").toLowerCase().includes('sistema') ? 'sistema' : 'manual');

            // Regra E: Deve atender a todas as pílulas de ação selecionadas
            passaAcao = Array.from(filtrosAtivosAcao).every(pill => {
                if (pill === 'MANUAL') return origemLog === 'manual';
                if (pill === 'SISTEMA') return origemLog === 'sistema';
                return true;
            });
        }

        // 3. Filtro: Tipo de Reserva (Ex: '1 HORA' + 'DUPLAS' afunila para Jogos de 1h em Duplas)
        let passaTipo = true;
        if (filtrosAtivosTipo.size > 0) {
            const dur = String(log.duracao || "").toLowerCase();
            const strJogadores = log.jogadores_completo || log.jogadores || "";
            const qtdJogadores = strJogadores.split(',').filter(s => s.trim().length > 0).length;

            // Regra E (Funil): O registro precisa cumprir TODAS as pílulas marcadas nesta aba
            passaTipo = Array.from(filtrosAtivosTipo).every(pill => {
                if (pill === '1 HORA') return dur === '1' || dur.includes('1 hora');
                if (pill === '2 HORAS') return dur === '2' || dur.includes('2 horas');
                if (pill === 'TORNEIO') return dur === '3' || dur.includes('pirâmide') || dur.includes('torneio');
                if (pill === 'DUPLAS') return qtdJogadores === 4;
                return true;
            });
        }

        // 4. Filtro: Status da Reserva
        let passaReserva = true;
        if (filtrosAtivosReserva.size > 0) {
            const st = (log.statusNoMomentoDaExclusao || "").toLowerCase();
            const ac = (log.acao || "").toLowerCase();

            // Regra E: Deve atender a todas as pílulas de reserva selecionadas
            passaReserva = Array.from(filtrosAtivosReserva).every(pill => {
                if (pill === 'CONFIRMADA') return st.includes('confirmada');
                if (pill === 'PENDENTE') return st.includes('pendente');
                if (pill === 'CANCELADA') return st.includes('cancelada');
                if (pill === 'EXCLUÍDA') return ac.includes('exclusão');
                if (pill === 'RECUSADA') return st.includes('recusad') || ac.includes('recusa') || st.includes('expirad');
                return true;
            });
        }

        // 5. Filtro: Status do Jogo
        let passaJogo = true;
        if (filtrosAtivosJogo.size > 0) {
            const st = (log.statusNoMomentoDaExclusao || "").toLowerCase();

            // Regra E: Deve atender a todas as pílulas de jogo selecionadas
            passaJogo = Array.from(filtrosAtivosJogo).every(pill => {
                if (pill === 'CONFIRMADO') return st.includes('confirmado');
                if (pill === 'AGUARDANDO') return st.includes('aguardando');
                if (pill === 'FINALIZADO') return st.includes('finalizado');
                if (pill === 'CANCELADO') return st.includes('cancelado');
                return true;
            });
        }

        // Retorna verdadeiro se o registro passar por todos os funis ativados
        return passaTexto && passaAcao && passaTipo && passaReserva && passaJogo;
    });

    // Ordenação Cronológica
    logsFiltradosCache.sort((a, b) => {
        const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return ordemCrescenteLogs ? (timeA - timeB) : (timeB - timeA);
    });

    renderizarTimelineLogsSaaS(logsFiltradosCache);
}


/* ======================================================== */
/* CONTROLADORES DA INTERFACE (GAVETA DE FILTROS - OPÇÃO 6) */
/* ======================================================== */

/**
 * Abre/Fecha a gaveta principal de filtros
 */
function togglePainelFiltroLogs() {
    const painel = document.getElementById('painel-filtros-logs');
    if (painel) {
        painel.style.display = painel.style.display === 'block' ? 'none' : 'block';
    }
}

/**
 * Alterna as abas dentro do painel (Tipo / Reserva / Jogo)
 */
function showTabFiltrosLogs(num, btnElement) {
    document.querySelectorAll('.tab-content-logs').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn-logs').forEach(el => el.classList.remove('active'));
    
    const target = document.getElementById('tab-log-' + num);
    if(target) target.classList.add('active');
    if(btnElement) btnElement.classList.add('active');
}

/**
 * Marca ou desmarca a pílula clicada (Permite Múltipla Seleção)
 */
function selecionarPilulaFiltroLogs(elementoClicado, categoria) {
    if (navigator.vibrate) navigator.vibrate(15);
    
    const valorPill = elementoClicado.textContent.trim().toUpperCase();
    const jaEstavaAtivo = elementoClicado.classList.contains('active');

    let conjuntoAlvo = null;
    if (categoria === 'AÇÃO') conjuntoAlvo = filtrosAtivosAcao;
    else if (categoria === 'TIPO') conjuntoAlvo = filtrosAtivosTipo;
    else if (categoria === 'RESERVA') conjuntoAlvo = filtrosAtivosReserva;
    else if (categoria === 'JOGO') conjuntoAlvo = filtrosAtivosJogo;

    if (!conjuntoAlvo) return;

    // Alterna a pílula clicada sem apagar as outras da mesma aba
    if (jaEstavaAtivo) {
        elementoClicado.classList.remove('active');
        conjuntoAlvo.delete(valorPill);
    } else {
        elementoClicado.classList.add('active');
        conjuntoAlvo.add(valorPill);
    }

    filtrarLogsReativoSaaS();
}


/**
 * Alterna a ordem de exibição (Mais Recentes x Mais Antigos)
 */
function alternarOrdenacaoLogsSaaS() {
    if (navigator.vibrate) navigator.vibrate(20);
    ordemCrescenteLogs = !ordemCrescenteLogs;

    const icone = document.getElementById('icone-ordem-logs');
    const txt = document.getElementById('txt-ordem-logs');

    if (ordemCrescenteLogs) {
        if (icone) icone.textContent = "arrow_upward";
        if (txt) txt.textContent = "Mais Antigos";
    } else {
        if (icone) icone.textContent = "swap_vert";
        if (txt) txt.textContent = "Mais Recentes";
    }

    filtrarLogsReativoSaaS();
}

/**
 * Exportador de Relatório de Auditoria em PDF Vetorial / Impressão Corporativa
 */
function exportarLogsPDFSaaS() {
    if (navigator.vibrate) navigator.vibrate(30);

    const listaParaExportar = (typeof logsFiltradosCache !== 'undefined' && logsFiltradosCache.length > 0) 
        ? logsFiltradosCache 
        : logsLocaisCache;

    if (!listaParaExportar || listaParaExportar.length === 0) {
        showToast("Nenhum registro disponível para exportação.", "warning");
        return;
    }

    const nomeClube = document.getElementById('txt-nome-clube')?.textContent || "SetPoint Arena";
    const dataEmissao = new Date().toLocaleString('pt-BR');
    const totalRegistros = listaParaExportar.length;
    
    // Mostra exatamente quais filtros estão sendo exportados
    const todasTags = [
    ...Array.from(filtrosAtivosAcao),
    ...Array.from(filtrosAtivosTipo),
    ...Array.from(filtrosAtivosReserva),
    ...Array.from(filtrosAtivosJogo)
	];
	const tagsMarcadas = todasTags.join(' | ') || "Visão Geral (Todos)";

    // Constrói as linhas da tabela de auditoria
    let linhasTabelaHTML = "";
    listaParaExportar.forEach(log => {
        let tagTexto = "Exclusão Manual";
        const acaoUpper = (log.acao || "").toUpperCase();

        if (acaoUpper.includes('RECUSA')) {
            tagTexto = acaoUpper.includes('CANCELAMENTO') ? 'Recusa de Convite' : 'Recusa (Parcial)';
        } else if (acaoUpper.includes('EXPIRAÇÃO') || acaoUpper.includes('EXPIRADO')) {
            tagTexto = 'Expirado por Tempo';
        } else if (acaoUpper.includes('EVIÇÃO')) {
            tagTexto = 'Evição Parcial';
        }

        const dataLog = log.dataLocal || log.timestamp || "-";
        const quadra = log.quadra || "Quadra";
        const horario = `${log.data || ''} (${log.horario || ''})`;
        const autor = log.autor || "Sistema";
        const motivo = log.motivo || "Não informado";
        const jogadores = log.jogadores_completo || log.jogadores || "-";

        linhasTabelaHTML += `
            <tr>
                <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px;">${dataLog}</td>
                <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px; font-weight: bold;">${tagTexto}</td>
                <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px;"><b>${quadra}</b><br>${horario}</td>
                <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px;">${autor}</td>
                <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px;">${motivo}<br><small style="color: #64748b;">Jogadores: ${jogadores}</small></td>
            </tr>
        `;
    });

    // Monta o documento impresso/PDF vetorial em janela isolada
    const janelaImpressao = window.open('', '_blank');
    janelaImpressao.document.write(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <title>Relatório de Auditoria - ${nomeClube}</title>
            <style>
                body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 20px; color: #1e293b; }
                .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #2E8B57; padding-bottom: 12px; margin-bottom: 20px; }
                .title { font-size: 20px; font-weight: bold; color: #2E8B57; margin: 0; }
                .sub { font-size: 12px; color: #64748b; margin-top: 4px; }
                .meta-box { background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px 14px; border-radius: 6px; font-size: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; }
                table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                th { background: #f1f5f9; color: #475569; text-align: left; padding: 8px; font-size: 11px; text-transform: uppercase; border-bottom: 2px solid #cbd5e1; }
                @media print {
                    body { padding: 0; }
                    .no-print { display: none; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <div>
                    <h1 class="title">${nomeClube}</h1>
                    <div class="sub">Relatório de Auditoria e Histórico de Cancelamentos</div>
                </div>
                <div style="text-align: right; font-size: 11px; color: #64748b;">
                    Emissão: <b>${dataEmissao}</b>
                </div>
            </div>

            <div class="meta-box">
                <span>Registros Exportados: <b>${totalRegistros}</b></span>
                <span>Filtros Ativos: <b>${tagsMarcadas}</b></span>
            </div>

            <table>
                <thead>
                    <tr>
                        <th style="width: 14%;">Data/Hora Ação</th>
                        <th style="width: 15%;">Tipo de Ação</th>
                        <th style="width: 20%;">Quadra / Agenda</th>
                        <th style="width: 18%;">Autor</th>
                        <th style="width: 33%;">Motivo & Detalhes</th>
                    </tr>
                </thead>
                <tbody>
                    ${linhasTabelaHTML}
                </tbody>
            </table>

            <script>
                window.onload = function() {
                    window.print();
                };
            </script>
        </body>
        </html>
    `);
    janelaImpressao.document.close();
}

/**
 * Oculta/Exibe o letreiro (Marquee) da barra de pesquisa baseado no foco e digitação
 */
function toggleMarqueeSaaS(valor) {
    const marquee = document.getElementById('marquee-container');
    if (!marquee) return;

    if (valor === 'focus' || valor.trim().length > 0) {
        // Se clicou dentro ou tem texto digitado, esconde a animação
        marquee.style.display = 'none';
    } else {
        // Se tirou o foco e está vazio, volta a animar
        marquee.style.display = 'flex';
    }
}