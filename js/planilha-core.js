"use strict";

// ==========================================
// 1. VARIÁVEIS DE CONTROLE (INICIALIZAÇÃO SEGURA)
// ==========================================
let modoVisualizacaoQuadras = "grade";

let timeoutPillQuadra = null; 

// Variável de controle para o duplo toque no mobile
let ultimoCliqueTituloQuadra = 0;  

// Variável para controlar a transição perfeita da planilha
let primeiraCargaQuadra = true;   

// Ponteiro da escuta (listener) em tempo real do Firebase para a quadra ativa 
let ouvinteQuadraAtual = null;   

// Trava de segurança para bloquear interações concorrentes no mesmo horário 
let horarioBloqueadoPelaTabela = null;   

// Contador mestre para o controle elástico da gaveta de atletas no agendamento
let contAtletas = 1; 

// Controles de sincronização para a trava da tela de carregamento (UX Premium)
window.saasFaxinaPronta = false;
window.saasSnapshotInicialRecebido = false;       


// ==========================================
// 1.5. CAIXA DE ALARMES INVISÍVEIS (Limpeza de Fantasmas)
// ==========================================
window.alarmesReservasPendentes = [];    

function limparAlarmesInvisiveisSaaS() {
    if (window.alarmesReservasPendentes) {
        window.alarmesReservasPendentes.forEach(alarme => clearTimeout(alarme));
    }
    window.alarmesReservasPendentes = [];
}


// ==========================================
// 1.8. RECOMPOSIÇÃO DE CRACHÁS (SSOT)
// ==========================================
function atualizarCrachasCabecalhoSocioSaaS() {
    const elNome = document.getElementById('header-nome');
    if (!elNome || isGestorLogado) return;

    const nomeLogado = localStorage.getItem('jogadorLogadoNome') || "Sócio";
    const nomePC = nomeLogado.toLowerCase().split(' ').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
    let apelidoMobile = nomePC.split(' ')[0];
    
    const idLogado = localStorage.getItem('jogadorLogadoId');
    if (idLogado && typeof jogadoresGlobal !== 'undefined' && jogadoresGlobal[idLogado] && jogadoresGlobal[idLogado].apelido) {
        apelidoMobile = jogadoresGlobal[idLogado].apelido;
    } else {
        try {
            const cacheRaw = localStorage.getItem('jogadoresDataCache');
            if (cacheRaw) {
                const dadosJogadores = JSON.parse(cacheRaw);
                if (dadosJogadores[nomeLogado] && dadosJogadores[nomeLogado].apelido) {
                    apelidoMobile = dadosJogadores[nomeLogado].apelido;
                }
            }
        } catch (e) {}
    }

    // 🎯 AQUI ENTRA A SUA NOVA REGRA PARA O CELULAR:
    // Se o apelido tiver mais de uma palavra, corta e guarda só o primeiro nome.
    if (apelidoMobile) {
        apelidoMobile = apelidoMobile.trim().split(' ')[0];
    }

    const socio = localStorage.getItem('jogadorLogadoSocio') || 'titular'; 
    let perfis = {};
    try { perfis = JSON.parse(localStorage.getItem('jogadorLogadoPerfis') || '{}'); } catch(e) {}

    let badgesHtml = '';
    const corVinculo = socio === 'visitante' ? '#f39c12' : '#3498db';
    const txtVinculo = socio === 'visitante' ? 'Staff' : (socio ? socio.charAt(0).toUpperCase() + socio.slice(1).toLowerCase() : 'Sócio');
    badgesHtml += `<span class="badge" style="background-color: ${corVinculo};">${txtVinculo}</span>`;

    Object.keys(perfis).forEach(p => {
        if (perfis[p] === true) {
            let corPerfil = '#6c757d';
            let abrevPerfil = p.substring(0, 5);
            
            if (p === 'Admin') { corPerfil = '#dc3545'; abrevPerfil = 'Admin'; }
            else if (p === 'Professor') { corPerfil = '#198754'; abrevPerfil = 'Prof'; }
            else if (p === 'Financeiro') { corPerfil = '#007bff'; abrevPerfil = 'Fin'; }
            else if (p === 'Árbitro') { corPerfil = '#fd7e14'; abrevPerfil = 'Árbit'; }
            else if (p === 'Manutenção') { corPerfil = '#6f42c1'; abrevPerfil = 'Manut'; }

            badgesHtml += `<span class="badge" style="background-color: ${corPerfil};">${abrevPerfil}</span>`;
        }
    }); 
    
    badgesHtml += `<span class="badge badge-SaaS-off" style="background-color: #dc3545; display: none;">OFF</span>`;
    
    elNome.innerHTML = `
        <div class="header-user-wrapper">
            <span class="header-user-text">
                Olá, <span class="nome-desktop">${nomePC}</span><span class="nome-mobile">${apelidoMobile}</span>
            </span>
            <div class="header-user-badges">${badgesHtml}</div>
        </div>
    `;
}

// ==========================================
// 2. INICIALIZAÇÃO DA GRADE DE QUADRAS
// ==========================================


/**
 * Portaria de Sincronismo Visual: Avalia o estado das duas engrenagens do boot.
 * Só remove a tela de carregamento quando os dados chegarem E a faxina terminar.
 */
 
 function verificarLiberacaoTelaLoadingSaaS() {
    const telaLoading = document.getElementById('tela-loading');
    const isTelaAtiva = telaLoading ? telaLoading.classList.contains('ativa') : false;

    // 🛡️ Se o app estiver a acordar via push, mantém a cortina ativa até a Central abrir por cima
    if (window.aberturaViaPushPendente) return;

    if (primeiraCargaQuadra && window.saasSnapshotInicialRecebido && window.saasFaxinaPronta && telaLoading && isTelaAtiva) {
        primeiraCargaQuadra = false; 
        navegarApp('tela-visao-quadras');
    }
}


function abrirVisaoQuadras() {
    window.saasSnapshotInicialRecebido = false; 
	
    if (typeof iniciarOuvinteMestreSaaS === "function") {
        iniciarOuvinteMestreSaaS();
    }
    
    navegarApp('tela-loading');
    
    const txtLoading = document.querySelector('#tela-loading p');
    if (txtLoading) {
        txtLoading.textContent = "Carregando planilha... aguarde";
    }
	
    primeiraCargaQuadra = true;  
	
    let apelidoMobile = ""; 
    let socio = "";
    const elNome = document.getElementById('header-nome');
    const elHeaderLeft = document.querySelector('.header-left');
    
    if (elNome) {
        if (isGestorLogado) {
            // 🧠 Lógica de Identidade (Gestor vs Desenvolvedor)
            const isGodMode = !!localStorage.getItem('god_mode_clube');
            const txtDesktop = isGodMode ? "Desenvolvedor" : "Gestor";
            const txtMobile = isGodMode ? "Dev" : "Gestor";
            const txtBadge = isGodMode ? "God Mode" : "Admin";
            const corBadge = isGodMode ? "#8b5cf6" : "#dc3545";

            // 🛡️ Remove interatividade e o ícone para o painel de Gestor
            if (elHeaderLeft) {
                elHeaderLeft.style.cursor = 'default';
                elHeaderLeft.onclick = null;
                const iconeAvatar = elHeaderLeft.querySelector('.header-avatar');
                if (iconeAvatar) iconeAvatar.style.display = 'none';
            }

            // Renderiza o HTML Mestre sem ícone
            elNome.innerHTML = `
                <div class="header-user-wrapper">
                    <span class="header-user-text">
                        Olá, <span class="nome-desktop">${txtDesktop}</span><span class="nome-mobile">${txtMobile}</span>
                    </span>
                    <div class="header-user-badges" id="container-badges-gestor">
                        <span class="badge" style="background-color: ${corBadge};">${txtBadge}</span>
                    </div>
                </div>
            `;

            // Consulta o status real da licença da arena
            database.ref(`Clubes/${clubeAtivoId}/info_clube/ativo`).once('value').then((snapAtivo) => {
                if (snapAtivo.val() === false) {
                    const elBadges = document.getElementById('container-badges-gestor');
                    if (elBadges) {
                        elBadges.innerHTML += `<span class="badge" style="background-color: #ef4444; border: 1px solid #7f1d1d;">OFF</span>`;
                    }
                }
            });
        } else {
            // 🎾 Garante interatividade e o ícone para o Sócio
            if (elHeaderLeft) {
                elHeaderLeft.style.cursor = 'pointer';
                elHeaderLeft.onclick = abrirSheetPerfil;
                const iconeAvatar = elHeaderLeft.querySelector('.header-avatar');
                if (iconeAvatar) iconeAvatar.style.display = 'flex';
            }
            atualizarCrachasCabecalhoSocioSaaS();
        }
    }

    // 🔕 Controle do Sininho no Boot: Se o Sócio silenciou as notificações, acorda oculto sem piscar
    const notificacoesAtivasBoot = localStorage.getItem('setpoint_notificacoes_ativas') !== 'false';
    const badgeNotifBoot = document.getElementById('notificacao-badge');
    const containerNotifBoot = badgeNotifBoot ? badgeNotifBoot.closest('.notificacao-container') : null;
    if (containerNotifBoot) {
        containerNotifBoot.style.display = (!isGestorLogado && notificacoesAtivasBoot) ? 'flex' : 'none';
    }
	
	// 🚪 Controle de Visibilidade: Ícone de saída visível apenas para Gestor ou God Mode
        const btnSairHeader = document.getElementById('btn-fechar-planilha');
        if (btnSairHeader) {
            const isGodMode = !!localStorage.getItem('god_mode_clube');
            btnSairHeader.style.display = (isGestorLogado || isGodMode) ? '' : 'none';
        }
    
    const tabContainer = document.querySelector('.tab-container');
    if (!tabContainer) return;

    database.ref(`${raizBanco}/config/Quadras`).once('value').then((snapshot) => {
        const configQuadras = snapshot.val() || {};
        const qtdSalva = configQuadras.quantidade;
        const nomesSalvos = configQuadras.nomes || {};

        if (!qtdSalva || parseInt(qtdSalva) < 1) {
            if (isGestorLogado) {
                abrirOnboardingPrimeiroAcessoSaaS();
            } else {
                navegarApp('tela-loading'); 
                if (txtLoading) {
                    txtLoading.innerHTML = `
                        🏟️ Arena em configuração.<br>O gestor está finalizando a estrutura das quadras.<br><br>
                        <span onclick="fazerLogout()" style="color: #94a3b8; font-size: 13px; cursor: pointer; text-decoration: underline; font-family: 'Roboto', sans-serif;">
                            Sair da conta e voltar ao início
                        </span>
                    `;
                }
            }
            return;
        }

        tabContainer.innerHTML = ''; 
        let primeiraQuadra = "";

        for (let i = 1; i <= qtdSalva; i++) {
            const nomeQuadra = typeof nomesSalvos[i] === 'object' ? (nomesSalvos[i].nome || `Quadra ${i}`) : (nomesSalvos[i] || `Quadra ${i}`);
            if (i === 1) primeiraQuadra = nomeQuadra;

            const btn = document.createElement('button'); 
            btn.className = 'tab-button';
            btn.textContent = `Quadra ${i}`;
            btn.dataset.nomeReal = nomeQuadra;
            
            const statusBanco = (configQuadrasGlobal.nomes && configQuadrasGlobal.nomes['status_' + i]) || 'liberada';
            btn.dataset.statusSaas = statusBanco; 

            // 💬 Define a mensagem do hover no carregamento inicial da página
			if (statusBanco === 'interditada' || statusBanco === 'interdita') {
				btn.classList.add('status-saas-interditada');
				btn.title = "Atenção: Esta quadra está interditada provisoriamente para manutenção.";
			} else if (statusBanco === 'bloqueada') {
				btn.classList.add('status-saas-bloqueada');
				btn.title = "⚠️ Atenção: Esta quadra está bloqueada.";
			}
            
            btn.onclick = () => {
                selecionarQuadraSaaS(nomeQuadra);
                if (statusBanco === 'interditada' || statusBanco === 'interdita') {
                    showToast("Atenção: Esta quadra está interditada provisoriamente para manutenção.", "error");
                }
            };
            
            tabContainer.appendChild(btn);  
        }

        const abasGeradas = Array.from(tabContainer.querySelectorAll('.tab-button')).map(b => b.dataset.nomeReal);
        if (!quadraSelecionadaSaaS || !abasGeradas.includes(quadraSelecionadaSaaS)) {
            quadraSelecionadaSaaS = primeiraQuadra;
        }

        atualizarCabecalhoDias();
        montarEsqueletoPlanilha();
        selecionarQuadraSaaS(quadraSelecionadaSaaS);

        const btnTriggerMobile = document.getElementById('btn-trigger-mapa-mobile');
        if (qtdSalva === 1) {
            tabContainer.style.setProperty('display', 'none', 'important');
            if (btnTriggerMobile) btnTriggerMobile.style.setProperty('display', 'none', 'important');
        } else {
            if (window.innerWidth <= 767) {
                tabContainer.style.setProperty('display', 'none', 'important');
            } else {
                tabContainer.style.removeProperty('display');
            }
            if (btnTriggerMobile) btnTriggerMobile.style.setProperty('display', 'inline-flex', 'important');
        }
    });
}

// ==========================================
// 3. SELEÇÃO DE ABAS COM CAPTURA DE TEXTO BLINDADA
// ==========================================
function selecionarQuadraSaaS(nomeQuadra) {
    if (!nomeQuadra) return;
    quadraSelecionadaSaaS = nomeQuadra;
    
    const lblTitulo = document.getElementById('lbl-quadra-titulo');
    if (lblTitulo) {
        if (window.innerWidth <= 767) {
            const botoesArray = Array.from(document.querySelectorAll('.tab-button'));
            
            // CORREÇÃO MOBILE: Captura o índice real mapeando o dataset oculto
            let indexQuadra = botoesArray.findIndex(b => b.dataset.nomeReal === nomeQuadra) + 1;
            
            if (indexQuadra <= 0) {
                const numeroExtraido = nomeQuadra.match(/\d+/);
                indexQuadra = numeroExtraido ? numeroExtraido[0] : 1;
            }
            lblTitulo.textContent = "Quadra " + indexQuadra;
        } else {
            lblTitulo.textContent = nomeQuadra;
        }

        lblTitulo.onclick = () => {
            const tempoAtual = new Date().getTime();
            const diferencaTempo = tempoAtual - ultimoCliqueTituloQuadra;
            
            if (diferencaTempo < 300 && diferencaTempo > 0) {
                mostrarPillNomeQuadra();
            }
            ultimoCliqueTituloQuadra = tempoAtual;
        };

        // 🚨 DESTAQUE EM VERMELHO PARA QUADRA INTERDITADA
        const containerTitulo = lblTitulo.closest('.container-titulo-central') || lblTitulo.parentElement;
        if (containerTitulo) {
            let status = 'liberada';
            if (configQuadrasGlobal && configQuadrasGlobal.nomes) {
                const qtd = parseInt(configQuadrasGlobal.quantidade) || 0;
                for (let i = 1; i <= qtd; i++) {
                    const dadosQ = configQuadrasGlobal.nomes[i];
                    const nomeF = typeof dadosQ === 'object' ? (dadosQ.nome || `Quadra ${i}`) : (dadosQ || `Quadra ${i}`);
                    if (nomeF === nomeQuadra) {
                        status = configQuadrasGlobal.nomes['status_' + i] || 'liberada';
                        break;
                    }
                }
            }
            const ehInterditada = (status === 'interditada' || status === 'interdita');
            containerTitulo.classList.toggle('header-quadra-interditada', ehInterditada);
        }
    }
    
    // CORREÇÃO DE PINTURA (O BOTÃO VERDE): Avalia o metadado real e ignora a string visual curta
    document.querySelectorAll('.tab-button').forEach(btn => {
        if (btn.dataset.nomeReal === nomeQuadra) {
            btn.classList.add('selected'); // Injeta a classe de foco (Verde)
            
            // 💉 Só arrasta o menu se for mobile (evita o tranco horizontal no computador)
            if (window.innerWidth <= 767) {
                btn.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'nearest', 
                    inline: 'center' 
                });
            }
        } else {
            btn.classList.remove('selected');
        }
    });

    carregarAgendamentosDaQuadra(nomeQuadra);
}

// ==========================================
// 4. CONEXÃO EM LOTE DO BANCO SAAS COM A PLANILHA
// ==========================================

function carregarAgendamentosDaQuadra(nomeQuadra) {
    // 1. SEGURANÇA (Memory Leak): Desliga o ouvinte da quadra anterior para não misturar dados
    if (ouvinteQuadraAtual) {
        ouvinteQuadraAtual.off();
    }

    // 🎯 PADRONIZAÇÃO DE CHAVE SAAS NA LEITURA: Converte o nome longo em chave fixa (Ex: "Quadra 1 - Coberta" -> "Quadra - 1")
    let quadraChaveFixa = "Quadra - 1";
    if (nomeQuadra) {
        const match = nomeQuadra.match(/\d+/);
        quadraChaveFixa = match ? `Quadra - ${match[0]}` : nomeQuadra;
    }

    // Cria o novo ouvinte focado na chave padronizada e imutável
    ouvinteQuadraAtual = database.ref(`${raizBanco}/reservas/${quadraChaveFixa}`); 
    
    ouvinteQuadraAtual.on('value', (snap) => {
        reservasLocaisCache = snap.val() || {};
        
        // 2. TRABALHO DE BASTIDORES: Pinta as células e formata a tabela invisivelmente
        renderizarDadosPlanilha(reservasLocaisCache);
        
        // 3. MARCAÇÃO SAAS: Sinaliza que os dados da quadra chegaram na memória RAM
        window.saasSnapshotInicialRecebido = true;
        
        // Consulta o portão de sincronismo para avaliar se já pode abrir a cortina
        if (typeof verificarLiberacaoTelaLoadingSaaS === 'function') {
            verificarLiberacaoTelaLoadingSaaS();
        }
    });
}

// NOVO GATILHO SEGURO: Usado pelo core.js para forçar a repintura sem duplicar a conexão
function forcarRepinturaPlanilha() {
    // 🎨 Atualiza cor, mensagem de hover (title), status e alerta de clique das abas
    document.querySelectorAll('.tab-container .tab-button').forEach((btn) => {
        const nomeQuadraReal = btn.dataset.nomeReal;
        let status = 'liberada';

        if (configQuadrasGlobal && configQuadrasGlobal.nomes) {
            const qtd = parseInt(configQuadrasGlobal.quantidade) || 0;
            for (let i = 1; i <= qtd; i++) {
                const dadosQ = configQuadrasGlobal.nomes[i];
                const nomeF = typeof dadosQ === 'object' ? (dadosQ.nome || `Quadra ${i}`) : (dadosQ || `Quadra ${i}`);
                if (nomeF === nomeQuadraReal) {
                    status = configQuadrasGlobal.nomes['status_' + i] || 'liberada';
                    break;
                }
            }
        }

        const ehInterditada = (status === 'interditada' || status === 'interdita');
        const ehBloqueada = (status === 'bloqueada');

        // Atualiza a memória de status do botão para o clique
        btn.dataset.statusSaas = status;

        // Injeta/remove as cores visuais na aba
        btn.classList.toggle('status-saas-interditada', ehInterditada);
        btn.classList.toggle('status-saas-bloqueada', ehBloqueada);

        // 💬 Balão de texto flutuante ao passar o mouse (Hover)
        if (ehInterditada) {
            btn.title = "Atenção: Esta quadra está interditada provisoriamente para manutenção.";
        } else if (ehBloqueada) {
            btn.title = "⚠️ Atenção: Esta quadra está bloqueada.";
        } else {
            btn.title = "";
        }
    });

    // 🚨 DESTAQUE EM VERMELHO PARA O TÍTULO CENTRAL DA QUADRA ATIVA
    const lblTitulo = document.getElementById('lbl-quadra-titulo');
    if (lblTitulo) {
        const containerTitulo = lblTitulo.closest('.container-titulo-central') || lblTitulo.parentElement;
        if (containerTitulo) {
            let statusAtiva = 'liberada';
            if (configQuadrasGlobal && configQuadrasGlobal.nomes) {
                const qtd = parseInt(configQuadrasGlobal.quantidade) || 0;
                for (let i = 1; i <= qtd; i++) {
                    const dadosQ = configQuadrasGlobal.nomes[i];
                    const nomeF = typeof dadosQ === 'object' ? (dadosQ.nome || `Quadra ${i}`) : (dadosQ || `Quadra ${i}`);
                    if (nomeF === quadraSelecionadaSaaS) {
                        statusAtiva = configQuadrasGlobal.nomes['status_' + i] || 'liberada';
                        break;
                    }
                }
            }
            const ehInterditadaAtiva = (statusAtiva === 'interditada' || statusAtiva === 'interdita');
            containerTitulo.classList.toggle('header-quadra-interditada', ehInterditadaAtiva);
        }
    }

    renderizarDadosPlanilha(reservasLocaisCache);
}


// ====================================================================
// 🧠 MOTOR ORQUESTRADOR DE RENDERIZAÇÃO DA GRADE (SaaS)
// ====================================================================
function renderizarDadosPlanilha(reservas) {
    // 1. MÓDULO INTELIGENTE: IDENTIFICA A QUADRA PARA MATRIZES FIXAS
    let quadraKey = "Quadra1";
    if (quadraSelecionadaSaaS) {
        const match = quadraSelecionadaSaaS.match(/\d+/);
        if (match) {
            quadraKey = `Quadra${match[0]}`;
        }
    }
    
    const configAula = configAulasGlobal[quadraKey] || null;
    const configDupla = configDuplasGlobal[quadraKey] || null;
    const configTorneio = configTorneiosGlobal[quadraKey] || null;

    // 🧹 0. DESARMA OS ALARMES ANTIGOS ANTES DE REPINTAR A TELA
    if (typeof limparAlarmesInvisiveisSaaS === 'function') {
        limparAlarmesInvisiveisSaaS();
    }

    // 2. DISPAROS EM CADEIA DE RESPONSABILIDADE ÚNICA (Modulares)
    limparGridEAplicarGradesFixas(configAula, configDupla, configTorneio);
    plotarReservasAtivas(reservas);
    aplicarValidacoesETempoReal();

    // 🟡 Visibilidade dinâmica da legenda "Ranking"
    const elLegendaRanking = document.getElementById('legenda-item-ranking');
    if (elLegendaRanking) {
        const temSlotRanking = configTorneio && configTorneio.Ativo && configTorneio.Grade && Object.values(configTorneio.Grade).some(v => v === true);
        const isRankingRegraAtivo = (configRegrasGlobal && configRegrasGlobal.ranking && configRegrasGlobal.ranking.ativo === true);
        elLegendaRanking.style.display = (temSlotRanking || isRankingRegraAtivo) ? 'inline-flex' : 'none';
    }

    // 📅 ATUALIZAÇÃO REATIVA DA AGENDA PESSOAL E DO BADGE NUMÉRICO
    if (typeof atualizarBadgeAgendaSaaS === 'function') {
        atualizarBadgeAgendaSaaS();
    }

    const gavetaAgenda = document.getElementById('agenda-conteudo');
    if (gavetaAgenda && gavetaAgenda.style.display === 'block' && typeof renderizarAgendaPessoalSaaS === 'function') {
        renderizarAgendaPessoalSaaS();
    }
	
    // 🎟️ CONSOME A FICHA: Só recalcula os horários do modal se o usuário pediu (trocando a quadra)
    if (window.solicitouAtualizacaoModal && typeof window.atualizarHorariosModalSaaS === 'function') {
        window.atualizarHorariosModalSaaS();
        window.solicitouAtualizacaoModal = false; // Rasga a ficha para proteger contra fantasmas!
    }
}


// ====================================================================
// 🧹 SUB-MÓDULO 1: LIMPEZA RÍGIDA E INJEÇÃO DE TATUAGENS ADMINISTRATIVAS
// ====================================================================
function limparGridEAplicarGradesFixas(configAula, configDupla, configTorneio) {
    for (let h = 6; h <= 22; h++) {
        for (let d = 1; d <= 7; d++) {
            const cel = document.getElementById(`cel-${h}-${d}`);
            if (!cel) continue;

            // Limpeza completa e cirúrgica do slot
            cel.innerHTML = ''; 
            cel.className = ''; 
            cel.style.backgroundColor = ''; 
            cel.style.border = '';
            
            // 🧱 CORREÇÃO: Tapa o buraco deixado pela exclusão de blocos mesclados
            cel.rowSpan = 1;
            cel.style.display = '';
			
            cel.style.cursor = 'pointer';
            cel.style.pointerEvents = 'auto'; 
            cel.removeAttribute('title');     
            cel.removeAttribute('data-saas-proibido'); 
            
            // Instala o comportamento padrão de clique (Livre para Agendamento)
            cel.onclick = () => {
                cliqueCelula(d, h);
            };

            let deveBloquear = false; 

            // Analisa as Trancas Físicas (Horários de Abertura e Fechamento da Arena)
            if (regrasHorariosSaaS && regrasHorariosSaaS[d]) {
                const regraDia = regrasHorariosSaaS[d];

                if (regraDia.status === 'fechado') {
                    deveBloquear = true;
                } else {
                    const inicio = parseInt(regraDia.abertura?.split(':')[0]) || 6;
                    const fim = parseInt(regraDia.fechamento?.split(':')[0]) || 23;
                    if (h < inicio || h >= fim) {
                        deveBloquear = true;
                    }
                }

                if (deveBloquear) {
                    cel.classList.add('celula-bloqueada');
                    cel.onclick = null;
                    cel.setAttribute('data-saas-proibido', 'true'); 
                }
            }

            let preenchidoPorGradeFixa = false;

            // Tatuagem Visual da Grade de Aulas Fixas
            if (!deveBloquear && configAula && configAula.Ativo && configAula.Grade) {
                const keyGrade = `${d}_${h}`;
                
                if (configAula.Grade[keyGrade] && configAula.Grade[keyGrade] !== "") {
                    cel.innerHTML = 'Aula'; 
                    cel.classList.add('celula-aula'); 
                    cel.style.cursor = 'not-allowed';
                    cel.onclick = () => showToast(`Horário bloqueado para Aula Fixa com ${configAula.Grade[keyGrade]}.`, 'warning');
                    preenchidoPorGradeFixa = true;
                }
            }

            // Tatuagem Visual da Grade de Ranking / Torneios
            if (!deveBloquear && !preenchidoPorGradeFixa && configTorneio && configTorneio.Ativo && configTorneio.Grade) {
                const keyGrade = `${d}_${h}`;
                
                if (configTorneio.Grade[keyGrade] === true) {
                    cel.innerHTML = 'Ranking'; 
                    cel.classList.add('celula-torneio'); 
                    cel.style.cursor = 'pointer'; 
                    cel.onclick = () => {
                        cliqueCelula(d, h);
                    };
                    preenchidoPorGradeFixa = true;
                }
            }

            // Tatuagem Visual da Grade de Duplas Fixas
            if (!deveBloquear && !preenchidoPorGradeFixa && configDupla && configDupla.Ativo && configDupla.Grade) {
                const keyGrade = `${d}_${h}`;
                
                if (configDupla.Grade[keyGrade] === true) {
                    cel.innerHTML = 'Dupla'; 
                    cel.classList.add('celula-dupla'); 
                    
                    // 💉 CORREÇÃO CONCEITUAL: O horário de dupla é livre para o sócio agendar!
                    cel.style.cursor = 'pointer'; 
                    cel.onclick = () => {
                        cliqueCelula(d, h);
                    };
                }
            }
        }
    }
}


// ====================================================================
// 🎾 SUB-MÓDULO 2: PLOTAGEM DE RESERVAS ATIVAS E BORDAS CONTÍNUAS
// ====================================================================
function plotarReservasAtivas(reservas) {
    
    // ====================================================================
    // 🌟 SUB-MÓDULO 2.1: MOTOR DE MESCLAGEM MESTRA (AULAS E MANUTENÇÕES)
    // ====================================================================
    const mapaMesclagemSaaS = {}; 
    
    for (let d = 1; d <= 7; d++) {
        for (let h = 6; h <= 23; h++) {
            const key = `${d}_${h}`;
            if (mapaMesclagemSaaS[key] && mapaMesclagemSaaS[key].pular) continue;

            const r = reservas[key];
            if (!r || r.status === 'aula_cancelada') continue;

            const ehAula = (r.tipo === 'aula' || (r.jogadores && r.jogadores.toLowerCase() === 'aula'));
            const ehManutencao = (r.tipo === 'manutencao' || (r.jogadores && r.jogadores.includes('Manutenção')));

            if (ehAula || ehManutencao) {
                let span = 1;
                for (let nextH = h + 1; nextH <= 23; nextH++) {
                    const nextKey = `${d}_${nextH}`;
                    const nextR = reservas[nextKey];
                    
                    if (!nextR || nextR.status === 'aula_cancelada') break;

                    const ehNextAula = (nextR.tipo === 'aula' || (nextR.jogadores && nextR.jogadores.toLowerCase() === 'aula'));
                    const ehNextManut = (nextR.tipo === 'manutencao' || (nextR.jogadores && nextR.jogadores.includes('Manutenção')));
                    const ehMesmoOrganizador = (!r.organizador && !nextR.organizador) || (r.organizador === nextR.organizador);

                    if (((ehAula && ehNextAula) || (ehManutencao && ehNextManut)) && ehMesmoOrganizador) {
                        span++;
                        mapaMesclagemSaaS[nextKey] = { pular: true }; 
                    } else { 
                        break; 
                    }
                }
                
                if (span > 1) {
                    mapaMesclagemSaaS[key] = { rowSpan: span, horaFim: h + span, pular: false };
                }
            }
        }
    }

    Object.keys(reservas).forEach(key => {
        const r = reservas[key];
        if (!r || r.hora === undefined || r.dia === undefined) {
            return;
        }

        // 🛡️ TRAVA ANTI-DUPLICIDADE 2H: Ignora a 2ª célula de um bloco de 2h para alarmes e plotagem
        if (r.borda === undefined && r.status !== 'aula_cancelada') {
            return;
        }

        // --- ⏰ INÍCIO: ALARME INVISÍVEL PARA FAXINA ---
        if (r.status === 'pendente' && r.expiraEm) {
            const agora = Date.now();
            const tempoRestante = r.expiraEm - agora;

            if (tempoRestante > 0) {
                const idAlarme = setTimeout(() => {
                    if (typeof executarFaxinaAutomaticaSaaS === 'function') {
                        executarFaxinaAutomaticaSaaS();
                    }
                }, tempoRestante);
                window.alarmesReservasPendentes.push(idAlarme);
            } else {
                if (typeof executarFaxinaAutomaticaSaaS === 'function') {
                    executarFaxinaAutomaticaSaaS();
                }
            }
        }
        // --- ⏰ FIM: ALARME INVISÍVEL ---

        if (r.borda === undefined && r.status !== 'aula_cancelada') {
            return;
        }
        
        const cel = document.getElementById(`cel-${r.hora}-${r.dia}`);
        if (!cel) return;

        if (cel.getAttribute('data-saas-proibido') === 'true') {
            cel.setAttribute('title', `📝 Lembrete: Havia uma reserva de [${r.jogadores || 'Sócio'}] neste horário bloqueado.`);
            cel.innerHTML = ''; 
            return; 
        }

        if (r.status === 'aula_cancelada') {
            cel.innerHTML = '';
            cel.className = '';
            cel.style.backgroundColor = '';
            cel.style.border = '';
            cel.style.cursor = 'pointer';
            cel.onclick = () => { cliqueCelula(r.dia, r.hora); };
            return;
        }

        const isDark = document.body.classList.contains('dark-mode') || document.body.classList.contains('dark');
        const corBorda = isDark ? '2px solid #555' : '2px solid #666';

        // 🎓 BIFURCAÇÃO AULA EXCEPCIONAL (Com Mesclagem Inteligente)
        if (r.tipo === 'aula' || (r.jogadores && r.jogadores.toLowerCase() === 'aula')) {
            const infoMescla = mapaMesclagemSaaS[`${r.dia}_${r.hora}`];
            
            if (infoMescla && infoMescla.pular) {
                // 🧱 CORREÇÃO: Carimba a célula invisível para que o botão (+) saiba que ela está ocupada
                cel.classList.add('celula-aula'); 
                cel.style.display = 'none';
                return;
            }

            cel.classList.add('celula-aula');
            cel.style.color = 'var(--txt-celula-tabela)'; // Correção da cor da fonte para padronizar
            cel.style.cursor = 'pointer';
            
            // Aplica as Bordas Estilo Jogo
            cel.style.borderTop = corBorda;
            cel.style.borderLeft = corBorda;
            cel.style.borderRight = corBorda;
            cel.style.borderBottom = corBorda;

            if (infoMescla && infoMescla.rowSpan > 1) {
                cel.rowSpan = infoMescla.rowSpan;
                const horaFormatada = String(r.hora).padStart(2, '0') + ':00';
                const horaFimFormatada = String(infoMescla.horaFim).padStart(2, '0') + ':00';
                
                // Remove o negrito (<b>) e adiciona um espaçamento
                cel.innerHTML = `<span>Aula</span><br><span style="font-size:11.5px; opacity:0.8;">${horaFormatada} - ${horaFimFormatada}</span>`;
            } else {
                cel.innerHTML = '<span>Aula</span>'; // Remove o negrito
            }

            cel.onclick = () => {
                if (navigator.vibrate) navigator.vibrate(30);
                abrirMenuAcoesReservaSaaS(r.dia, r.hora, r);
            };
            return;
        } 
        
        // 💦 BIFURCAÇÃO MANUTENÇÃO (Com Mesclagem Inteligente)
        if (r.tipo === 'manutencao' || (r.jogadores && r.jogadores.includes('Manutenção'))) {
            const infoMescla = mapaMesclagemSaaS[`${r.dia}_${r.hora}`];
            
            if (infoMescla && infoMescla.pular) {
                // Carimba a célula invisível para ocultá-la e manter a busca livre informada
                cel.classList.add('celula-manutencao');
                cel.style.display = 'none';
                return;
            }

            cel.classList.add('celula-manutencao');
            cel.style.color = 'var(--txt-celula-especial)';
            cel.style.cursor = 'pointer';

            // Aplica as Bordas Estilo Jogo
            cel.style.borderTop = corBorda;
            cel.style.borderLeft = corBorda;
            cel.style.borderRight = corBorda;
            cel.style.borderBottom = corBorda;

            if (infoMescla && infoMescla.rowSpan > 1) {
                cel.rowSpan = infoMescla.rowSpan;
                const horaFormatada = String(r.hora).padStart(2, '0') + ':00';
                const horaFimFormatada = String(infoMescla.horaFim).padStart(2, '0') + ':00';
                
                cel.innerHTML = `<span>💦 Manutenção</span><br><span style="font-size:11.5px; opacity:0.8;">${horaFormatada} - ${horaFimFormatada}</span>`;
            } else {
                cel.innerHTML = '<span>💦 Manutenção</span>';
            }

            cel.onclick = () => {
                if (navigator.vibrate) navigator.vibrate(30);
                abrirMenuAcoesReservaSaaS(r.dia, r.hora, r);
            };
            return;
        }
        
        const confs = r.confirmacoes || {};

        const formatarNomeAtleta = (nomeBruto, index) => {
            let nomeStr = nomeBruto.trim();
            const nomeUpper = nomeStr.toUpperCase();
            
            if (nomeUpper === 'AULA' || nomeUpper === 'DUPLA') return nomeStr;

            let classes = [];

            if (index === 0) {
                classes.push("nome-organizador-grade");
            }
            
            let isPendente = false;

            if (nomeUpper.includes('CONVIDADO')) {
                nomeStr = "Convidado";
                if (r.dadosConvidados) {
                    const listaCompletos = (r.jogadores_completo || '').split(',').map(s => s.trim());
                    const nomeCompletoDeste = listaCompletos[index] || '';
                    const cLimpo = nomeCompletoDeste.replace(/\s*\(convidado\)/i, '').trim().toLowerCase();
                    const chaveMatch = Object.keys(r.dadosConvidados).find(k => k.trim().toLowerCase() === cLimpo);
                    if (chaveMatch) {
                        isPendente = (r.dadosConvidados[chaveMatch].statusTaxa !== 'pago');
                    } else {
                        isPendente = (confs['Convidado'] === false);
                    }
                } else {
                    isPendente = (confs['Convidado'] === false);
                }
            } else {
                Object.keys(confs).forEach(k => {
                    if (confs[k] === false && k.toUpperCase() === nomeUpper) {
                        isPendente = true;
                    }
                });
            }

            if (isPendente) {
                classes.push("nome-pendente-grade");
            }

            if (classes.length > 0) {
                return `<span class="${classes.join(' ')}">${nomeStr}</span>`;
            }
            return nomeStr;
        };

        if (r.jogadores && r.jogadores.toLowerCase() === 'dupla') {
            cel.innerHTML = `${r.jogadores}`;
            cel.classList.add('celula-dupla');
        } else if (r.duracao === 2) {
            // Bloco unificado de 2 Horas - Garante que ambas as células sejam marcadas como ocupadas
            cel.classList.add('celula-ocupada');

            const ehRanking = (r.isRanking === true || r.tipo === 'ranking');

            if (ehRanking) {
                cel.classList.add('celula-reserva-ranking');
            } else {
                cel.classList.add('celula-reserva-2h'); 
            }
            cel.classList.add('reserva-2h-topo');
            
            const partesBrutas = (r.jogadores || '').split(', ');
            const partesFormatadas = partesBrutas.map((n, idx) => formatarNomeAtleta(n, idx));

            const celNext = document.getElementById(`cel-${r.hora + 1}-${r.dia}`);

            if (ehRanking) {
                const p1 = partesFormatadas[0] || 'Desafiante';
                const p2 = partesFormatadas[1] || 'Desafiado';

                const partesBrutasOriginais = (r.jogadores || '').split(', ');

                // LEITURA DE POSIÇÃO CONGELADA (PIRÂMIDE / BARRAGEM)
                let tagPos1 = "";
                let tagPos2 = "";

                const txtP1 = r.posicaoP1 || "";
                const txtP2 = r.posicaoP2 || "";

                if (txtP1) tagPos1 = `<span class="pos-tag">${txtP1}</span>`;
                if (txtP2) tagPos2 = `<span class="pos-tag">${txtP2}</span>`;

                // 1ª Hora (Célula Superior)
                cel.innerHTML = `${tagPos1}${p1}`;

                // 2ª Hora (Célula Inferior): Pílula via classe CSS limpa
                if (celNext) {
                    celNext.innerHTML = `<span class="pilula-x-ranking">x</span>${tagPos2}${p2}`;
                }
            } else {
                const jogadoresMetadeCima = partesFormatadas.filter((_, idx) => idx === 0 || idx === 2).join(', ');
                const jogadoresMetadeBaixo = partesFormatadas.filter((_, idx) => idx === 1 || idx === 3).join(', ');

                cel.innerHTML = jogadoresMetadeCima || 'Ocupado';

                if (celNext) {
                    celNext.innerHTML = jogadoresMetadeBaixo || '';
                }
            }
            
            cel.style.borderTop = corBorda;
            cel.style.borderLeft = corBorda;
            cel.style.borderRight = corBorda;
            cel.style.borderBottom = 'none';

            // Garante cursor pointer e clique na 1ª Célula (Topo)
            cel.style.cursor = 'pointer';
            cel.onclick = () => {
                if (navigator.vibrate) navigator.vibrate(30);
                abrirMenuAcoesReservaSaaS(r.dia, r.hora, r); 
            };

            if (celNext) {
                celNext.classList.add('celula-ocupada');

                if (ehRanking) {
                    celNext.classList.add('celula-reserva-ranking');
                } else {
                    celNext.classList.add('celula-reserva-2h'); 
                }

                celNext.classList.add('reserva-2h-baixo');
                celNext.style.borderTop = 'none';
                celNext.style.borderLeft = corBorda;
                celNext.style.borderRight = corBorda;
                celNext.style.borderBottom = corBorda;
                
                // Garante cursor pointer e clique na 2ª Célula (Baixo)
                celNext.style.cursor = 'pointer';
                celNext.onclick = () => {
                    if (navigator.vibrate) navigator.vibrate(30);
                    abrirMenuAcoesReservaSaaS(r.dia, r.hora, r); 
                };
            }
        } else { 
            // Bloco individual de 1 Hora
            const partesBrutas = (r.jogadores || '').split(', ');
            const partesFormatadas = partesBrutas.map((n, idx) => formatarNomeAtleta(n, idx));
            
            const ehRanking = (r.isRanking === true || r.tipo === 'ranking');

            if (ehRanking) {
                const p1 = partesFormatadas[0] || 'Desafiante';
                const p2 = partesFormatadas[1] || 'Desafiado';

                const partesBrutasOriginais = (r.jogadores || '').split(', ');

                // LEITURA DE POSIÇÃO CONGELADA (PIRÂMIDE / BARRAGEM)
                let tagPos1 = "";
                let tagPos2 = "";

                const txtP1 = r.posicaoP1 || "";
                const txtP2 = r.posicaoP2 || "";

                if (txtP1) tagPos1 = `<span class="pos-tag">${txtP1}</span>`;
                if (txtP2) tagPos2 = `<span class="pos-tag">${txtP2}</span>`;

                cel.innerHTML = `${tagPos1}${p1}<br><span class="pilula-x-ranking-1h">x</span><br>${tagPos2}${p2}`;
            } else if (partesFormatadas.length === 4) {
                const linha1 = [partesFormatadas[0], partesFormatadas[1]].join(', ');
                const linha2 = [partesFormatadas[2], partesFormatadas[3]].join(', ');
                cel.innerHTML = `${linha1}<br>${linha2}`;
            } else if (partesFormatadas.length === 3) {
                const linha1 = [partesFormatadas[0], partesFormatadas[1]].join(', ');
                const linha2 = partesFormatadas[2];
                cel.innerHTML = `${linha1}<br>${linha2}`;
            } else {
                cel.innerHTML = partesFormatadas.join(', ') || 'Ocupado';
            }

            cel.style.fontSize = '';
            cel.style.lineHeight = '';
            cel.style.fontWeight = ''; 

            if (!cel.classList.contains('celula-dupla')) {
                cel.classList.add('celula-ocupada');    
            }

            if (ehRanking) {
                cel.classList.add('celula-reserva-ranking');
            } else {
                cel.classList.add('celula-reserva-1h');  
            }

            cel.style.border = corBorda; 
        }
        
        // Mantém o clique ativo independente da data da reserva
        cel.onclick = () => {
            if (navigator.vibrate) navigator.vibrate(30);
            abrirMenuAcoesReservaSaaS(r.dia, r.hora, r);
        };
    });
}


// ====================================================================
// ⏱️ SUB-MÓDULO 3: NEUTRALIZAÇÃO DO PASSADO E SENSOR HOVER EM TEMPO REAL
// ====================================================================
function aplicarValidacoesETempoReal() {
    const linhaDatasTabela = document.getElementById('linha-datas-tabela');
    if (!linhaDatasTabela) return;

    const agora = new Date();
    const diaMes = String(agora.getDate()).padStart(2, '0');
    const mes = String(agora.getMonth() + 1).padStart(2, '0');
    const ano = agora.getFullYear();
    const stringHoje = `${diaMes}/${mes}/${ano}`;
    const horaAtual = agora.getHours();

    for (let d = 1; d <= 7; d++) {
        const colHeader = linhaDatasTabela.children[d - 1];
        if (!colHeader) continue;

        const dataTexto = colHeader.textContent.trim();
        const ehHoje = (dataTexto === stringHoje);
        const ehDiaBloqueado = colHeader.classList.contains('dia-bloqueado-visual');

        if (ehDiaBloqueado || ehHoje) {
            for (let h = 6; h <= 22; h++) {
                const cel = document.getElementById(`cel-${h}-${d}`);
                if (!cel) continue;

                // 🚨 CORREÇÃO: Garante que as células ocupadas (Reservas, Aulas, Manutenções) 
                // não sejam afetadas pela neutralização, permitindo "Ver Detalhes" no passado.
                const ehCelulaLivreOuDupla = !cel.classList.contains('celula-ocupada') && 
                                             !cel.classList.contains('celula-aula') && 
                                             !cel.classList.contains('celula-manutencao') && 
                                             !cel.classList.contains('celula-bloqueada');

                if (ehCelulaLivreOuDupla) {
                    let deveNeutralizarImediato = ehDiaBloqueado || (ehHoje && h < horaAtual);

                    if (deveNeutralizarImediato) {
                        cel.onclick = null;
                        cel.style.cursor = 'default'; 
                        cel.onmouseenter = null;
                    } else if (ehHoje) {
                        // Sensor de Aproximação Premium (Lazy Hover Evaluation)
                        cel.onmouseenter = function() {
                            const horaDoMilissegundo = new Date().getHours();
                            if (h < horaDoMilissegundo) {
                                cel.onclick = null; 
                                cel.style.cursor = 'default'; 
                                cel.onmouseenter = null; 
                                console.log(`🎯 [Preciosismo SaaS] Slot das ${h}:00 auto-neutralizado via Sensor Hover.`);
                            }
                        };
                    }
                }
            }
        }
    }
}


// Rotação Responsiva
window.addEventListener('resize', () => {
    const telaPlanilha = document.getElementById('tela-visao-quadras');
    if (telaPlanilha && telaPlanilha.style.display !== 'none') {
        const btnTriggerMobile = document.getElementById('btn-trigger-mapa-mobile');
        const tabContainer = document.querySelector('.tab-container');
        const buttons = tabContainer ? tabContainer.querySelectorAll('.tab-button') : [];
        
        if (btnTriggerMobile) {
            // REGRA PREMIUM UNIFICADA: Sempre ativo (a menos que só exista 1 quadra no clube)
            btnTriggerMobile.style.setProperty('display', buttons.length <= 1 ? 'none' : 'inline-flex', 'important');
        }
        
        if (tabContainer) {
            if (window.innerWidth > 767 && buttons.length > 1) {
                tabContainer.style.removeProperty('display');
            } else if (window.innerWidth <= 767) {
                tabContainer.style.setProperty('display', 'none', 'important');
            }
        }

        if (quadraSelecionadaSaaS) {
            selecionarQuadraSaaS(quadraSelecionadaSaaS);
        }
    }
});


// ==========================================
// 5. MAPA EM GRADE EM MODAL (MOBILE)
// ==========================================
function abrirMapaQuadrasMobile() {
    const grid = document.getElementById('grid-numerico-quadras');
    if (!grid) return;

    const modal = document.getElementById('modal-mapa-quadras');
    const btnGrade = document.getElementById('btn-toggle-grade');
    const btnLista = document.getElementById('btn-toggle-lista');
    const inputBusca = document.getElementById('input-busca-mapa-quadras');

    // BLINDAGEM PREMIUM: Reseta a pesquisa ao abrir a janela dos atletas
    if (inputBusca) {
        inputBusca.value = '';
    }
    
    database.ref(`${raizBanco}/config/Quadras`).once('value').then((snapshot) => {
        const configQuadras = snapshot.val() || {};
        const qtdSalva = configQuadras.quantidade || 2;
        const nomesSalvos = configQuadras.nomes || {};
        
        const atualizarBotoesEestilo = () => {
            grid.innerHTML = '';

            // Captura o termo digitado na memória local
            const termo = inputBusca ? inputBusca.value.toLowerCase().trim() : '';

            // Sincroniza classes de visibilidade inteligente
            if (modoVisualizacaoQuadras === 'grade') {
                if (modal) {
                    modal.classList.add('modal-modo-grade');
                    modal.classList.remove('modal-modo-lista');
                }
            } else {
                if (modal) {
                    modal.classList.add('modal-modo-lista');
                    modal.classList.remove('modal-modo-grade'); 
                }
            }

            for (let i = 1; i <= qtdSalva; i++) {
                const nomeQuadra = typeof nomesSalvos[i] === 'object' ? (nomesSalvos[i].nome || `Quadra ${i}`) : (nomesSalvos[i] || `Quadra ${i}`);
                
                const statusQ = (configQuadrasGlobal.nomes && configQuadrasGlobal.nomes['status_' + i]) || 'liberada';
				
                if (modoVisualizacaoQuadras === 'lista' && termo !== '') {
                    if (!nomeQuadra.toLowerCase().includes(termo)) {
                        continue;
                    }
                }

                const acaoClique = () => {
                    if (navigator.vibrate) {
                        navigator.vibrate(30); 
                    }
                    selecionarQuadraSaaS(nomeQuadra);
                    fecharModalConfig('modal-mapa-quadras');
                };

                
				if (modoVisualizacaoQuadras === 'grade') {
                    const btnBloco = document.createElement('button');
                    btnBloco.className = 'btn-quadra-grade';
                    btnBloco.textContent = i;
                    
                    btnBloco.onclick = () => {
                        acaoClique();
                        if (statusQ === 'interditada' || statusQ === 'interdita') {
                            showToast("🏟️ Atenção: Esta quadra está interditada provisoriamente para manutenção.", "warning");
                        }
                    };

                    // 1. Aplica as classes de status de cor primeiro (Independente de estar ativa ou nao)
                    if (statusQ === 'interditada' || statusQ === 'interdita') {
                        btnBloco.classList.add('status-saas-interditada');
                    } else if (statusQ === 'bloqueada') {
                        btnBloco.classList.add('status-saas-bloqueada');
                    } else {
                        btnBloco.style.backgroundColor = '#f8fafc'; 
                        btnBloco.style.color = '#334155';
                    }

                    // 2. Aplica o destaque de Selecionada (Foco mestre) por cima
                    if (quadraSelecionadaSaaS === nomeQuadra) {
                        if (statusQ === 'interditada' || statusQ === 'interdita') {
                            btnBloco.style.setProperty('border-color', '#991b1b', 'important');
                            btnBloco.style.setProperty('border-width', '2px', 'important');
                            btnBloco.style.setProperty('border-style', 'solid', 'important');
                        } else if (statusQ === 'bloqueada') {
                            btnBloco.style.setProperty('border-color', '#9a3412', 'important');
                            btnBloco.style.setProperty('border-width', '2px', 'important');
                            btnBloco.style.setProperty('border-style', 'solid', 'important');
                        } else {
                            btnBloco.style.backgroundColor = 'var(--cor-primaria)'; 
                            btnBloco.style.color = 'white'; 
                            btnBloco.style.borderColor = 'var(--cor-primaria)';
                        }
                    }
                    grid.appendChild(btnBloco);

                // 2. COMPORTAMENTO MODO LISTA
                } else {
                    const btnNum = document.createElement('button');
                    btnNum.className = 'btn-quadra-num';
                    btnNum.textContent = i;
                    
                    btnNum.onclick = () => {
                        acaoClique();
                        if (statusQ === 'interditada' || statusQ === 'interdita') {
                            showToast("🏟️ Atenção: Esta quadra está interditada provisoriamente para manutenção.", "warning");
                        }
                    };

                    const btnNome = document.createElement('button');
                    btnNome.className = 'btn-quadra-nome';
                    btnNome.textContent = nomeQuadra;
                    
                    btnNome.onclick = () => {
                        acaoClique();
                        if (statusQ === 'interditada' || statusQ === 'interdita') {
                            showToast("🏟️ Atenção: Esta quadra está interditada provisoriamente para manutenção.", "warning");
                        }
                    };

                    // 1. Aplica as classes de status de cor primeiro (Independente de estar ativa ou nao)
                    if (statusQ === 'interditada' || statusQ === 'interdita') {
                        btnNum.classList.add('status-saas-interditada');
                        btnNome.classList.add('status-saas-interditada');
                    } else if (statusQ === 'bloqueada') {
                        btnNum.classList.add('status-saas-bloqueada');
                        btnNome.classList.add('status-saas-bloqueada');
                    } else {
                        btnNum.style.backgroundColor = '#f8fafc'; 
                        btnNum.style.color = '#334155';
                        btnNome.style.backgroundColor = '#f8fafc'; 
                        btnNome.style.color = '#334155';
                    }

                    // 2. Aplica o destaque de Selecionada (Foco mestre) por cima
                    if (quadraSelecionadaSaaS === nomeQuadra) {
                        if (statusQ === 'interditada' || statusQ === 'interdita') {
                            btnNum.style.setProperty('border-color', '#991b1b', 'important');
                            btnNum.style.setProperty('border-width', '2px', 'important');
                            btnNum.style.setProperty('border-style', 'solid', 'important');
                            
                            btnNome.style.setProperty('border-color', '#991b1b', 'important');
                            btnNome.style.setProperty('border-width', '2px', 'important');
                            btnNome.style.setProperty('border-style', 'solid', 'important');
                        } else if (statusQ === 'bloqueada') {
                            btnNum.style.setProperty('border-color', '#9a3412', 'important');
                            btnNum.style.setProperty('border-width', '2px', 'important');
                            btnNum.style.setProperty('border-style', 'solid', 'important');
                            
                            btnNome.style.setProperty('border-color', '#9a3412', 'important');
                            btnNome.style.setProperty('border-width', '2px', 'important');
                            btnNome.style.setProperty('border-style', 'solid', 'important');
                        } else {
                            btnNum.style.backgroundColor = 'var(--cor-primaria)'; 
                            btnNum.style.color = 'white'; 
                            btnNum.style.borderColor = 'var(--cor-primaria)';
                            
                            btnNome.style.backgroundColor = 'var(--cor-primaria)'; 
                            btnNome.style.color = 'white'; 
                            btnNome.style.borderColor = 'var(--cor-primaria)';
                        }
                    } // linha 1250
                    grid.appendChild(btnNum);
                    grid.appendChild(btnNome);
                }
            }
        };

		if (modoVisualizacaoQuadras === 'grade') {
            if (btnGrade) btnGrade.classList.add('active'); 
            if (btnLista) btnLista.classList.remove('active'); 
        } else {
            if (btnLista) btnLista.classList.add('active'); 
            if (btnGrade) btnGrade.classList.remove('active'); 
        }

        if (btnGrade) {
            btnGrade.onclick = () => {
				modoVisualizacaoQuadras = 'grade';
                btnGrade.classList.add('active');
                if (btnLista) btnLista.classList.remove('active'); 
                if (inputBusca) inputBusca.value = ''; 
                atualizarBotoesEestilo();
            };
        }

        if (btnLista) {
            btnLista.onclick = () => {
				modoVisualizacaoQuadras = 'lista';
                btnLista.classList.add('active');
                if (btnGrade) btnGrade.classList.remove('active'); 
                atualizarBotoesEestilo();
            };
        }

        if (inputBusca) {
            inputBusca.oninput = () => {
                atualizarBotoesEestilo();
            };
        }

        atualizarBotoesEestilo();
        abrirModalConfig('modal-mapa-quadras');
    });
}


// ==========================================
// 6. EXIBIÇÃO DA PÍLULA FLUTUANTE (DYNAMIC ISLAND)
// ==========================================
function mostrarPillNomeQuadra() {
    if (window.innerWidth > 767) {
        return;
    }

    const pill = document.getElementById('quadra-pill-toast');
    if (!pill || !quadraSelecionadaSaaS) {
        return;
    }

	if (timeoutPillQuadra) {
        clearTimeout(timeoutPillQuadra);
    }

    pill.textContent = quadraSelecionadaSaaS;
    pill.classList.add('visible');

	timeoutPillQuadra = setTimeout(() => {
        pill.classList.remove('visible');
    }, 3000);
}

// ==========================================
// 7. FUNÇÕES AUXILIARES DA PLANILHA
// ==========================================
function atualizarCabecalhoDias() {
    const líneaDatas = document.getElementById('linha-datas-tabela');
    if (!líneaDatas) {
        return;
    }

    const dataInicio = new Date();
    const diaDaSemana = dataInicio.getDay(); 
    let ajustes = [];

    switch (DiasParaLimpar){
        case 1:
            switch (diaDaSemana) {
                case 0: ajustes = [1, 2, 3, 4, 5, -1, 0]; break;
                case 1: ajustes = [0, 1, 2, 3, 4, 5, -1]; break;
                case 2: ajustes = [-1, 0, 1, 2, 3, 4, 5]; break;
                case 3: ajustes = [5, -1, 0, 1, 2, 3, 4]; break;
                case 4: ajustes = [4, 5, -1, 0, 1, 2, 3]; break;
                case 5: ajustes = [3, 4, 5, -1, 0, 1, 2]; break;
                case 6: ajustes = [2, 3, 4, 5, -1, 0, 1]; break;
            }
            break;
        case 2:
            switch (diaDaSemana) {
                case 0: ajustes = [1, 2, 3, 4, -2, -1, 0]; break;
                case 1: ajustes = [0, 1, 2, 3, 4, -2, -1]; break;
                case 2: ajustes = [-1, 0, 1, 2, 3, 4, -2]; break;
                case 3: ajustes = [-2, -1, 0, 1, 2, 3, 4]; break;
                case 4: ajustes = [4, -2, -1, 0, 1, 2, 3]; break;
                case 5: ajustes = [3, 4, -2, -1, 0, 1, 2]; break;
                case 6: ajustes = [2, 3, 4, -2, -1, 0, 1]; break;
            }
            break;
        case 3:
            switch (diaDaSemana) {
                case 0: ajustes = [1, 2, 3, -3, -2, -1, 0]; break;
                case 1: ajustes = [0, 1, 2, 3, -3, -2, -1]; break;
                case 2: ajustes = [-1, 0, 1, 2, 3, -3, -2]; break;
                case 3: ajustes = [-2, -1, 0, 1, 2, 3, -3]; break;
                case 4: ajustes = [-3, -2, -1, 0, 1, 2, 3]; break;
                case 5: ajustes = [3, -3, -2, -1, 0, 1, 2]; break;
                case 6: ajustes = [2, 3, -3, -2, -1, 0, 1]; break;
            }
            break;
        case 4:
            switch (diaDaSemana) {
                case 0: ajustes = [1, 2, -4, -3, -2, -1, 0]; break;
                case 1: ajustes = [0, 1, 2, -4, -3, -2, -1]; break;
                case 2: ajustes = [-1, 0, 1, 2, -4, -3, -2]; break;
                case 3: ajustes = [-2, -1, 0, 1, 2, -4, -3]; break;
                case 4: ajustes = [-3, -2, -1, 0, 1, 2, -4]; break;
                case 5: ajustes = [-4, -3, -2, -1, 0, 1, 2]; break;
                case 6: ajustes = [2, -4, -3, -2, -1, 0, 1]; break;
            }
            break;
        case 5:
            switch (diaDaSemana) {
                case 0: ajustes = [1, -5, -4, -3, -2, -1, 0]; break;
                case 1: ajustes = [0, 1, -5, -4, -3, -2, -1]; break;
                case 2: ajustes = [-1, 0, 1, -5, -4, -3, -2]; break;
                case 3: ajustes = [-2, -1, 0, 1, -5, -4, -3]; break;
                case 4: ajustes = [-3, -2, -1, 0, 1, -5, -4]; break;
                case 5:                  case 5: ajustes = [-4, -3, -2, -1, 0, 1, -5]; break;
                case 6: ajustes = [-5, -4, -3, -2, -1, 0, 1]; break;
            }
            break;
        case 6:
        case 7:
            switch (diaDaSemana) {
                case 0: ajustes = [-6, -5, -4, -3, -2, -1, 0]; break;
                case 1: ajustes = [0, -6, -5, -4, -3, -2, -1]; break;
                case 2: ajustes = [-1, 0, -6, -5, -4, -3, -2]; break;
                case 3: ajustes = [-2, -1, 0, -6, -5, -4, -3]; break;
                case 4: ajustes = [-3, -2, -1, 0, -6, -5, -4]; break;
                case 5: ajustes = [-4, -3, -2, -1, 0, -6, -5]; break;
                case 6: ajustes = [-5, -4, -3, -2, -1, 0, -6]; break;
            }
            break;
    }

    let maxDiasPermitidos = 2;
    switch (DiasParaLimpar) {
        case 1: maxDiasPermitidos = 5; break;
        case 2: maxDiasPermitidos = 4; break;
        case 3: maxDiasPermitidos = 3; break;
        case 4: maxDiasPermitidos = 2; break;
        case 5: maxDiasPermitidos = 1; break;
        case 6: maxDiasPermitidos = 0; break;
        case 7: maxDiasPermitidos = 0; break;
    }

    const dataLimite = new Date();
    dataLimite.setHours(0, 0, 0, 0);
    dataLimite.setDate(dataLimite.getDate() + maxDiasPermitidos);

    const hojeZero = new Date();
    hojeZero.setHours(0, 0, 0, 0);

    const linhaNomesDias = líneaDatas.previousElementSibling;

    for (let i = 0; i < ajustes.length; i++) {
        let novaData = new Date(dataInicio);
        novaData.setDate(dataInicio.getDate() + ajustes[i]);
        
        const dataCheck = new Date(novaData);
        dataCheck.setHours(0, 0, 0, 0);

        const diaMes = String(novaData.getDate()).padStart(2, '0');
        const mes = String(novaData.getMonth() + 1).padStart(2, '0');
        const ano = novaData.getFullYear();
        
        if (líneaDatas.children[i]) {
            líneaDatas.children[i].textContent = `${diaMes}/${mes}/${ano}`;
            
            if (dataCheck < hojeZero || dataCheck > dataLimite) {
                líneaDatas.children[i].classList.add('dia-bloqueado-visual');
                líneaDatas.children[i].title = "Indisponível para agendamento";

                if (linhaNomesDias && linhaNomesDias.children[i + 1]) {
                    linhaNomesDias.children[i + 1].classList.add('dia-bloqueado-visual');
                    linhaNomesDias.children[i + 1].title = "Indisponível para agendamento";
                }
            } else {
                líneaDatas.children[i].classList.remove('dia-bloqueado-visual');
                líneaDatas.children[i].title = "";

                if (linhaNomesDias && linhaNomesDias.children[i + 1]) {
                    linhaNomesDias.children[i + 1].classList.remove('dia-bloqueado-visual');
                    linhaNomesDias.children[i + 1].title = "";
                }
            }
        }
    }
}

function montarEsqueletoPlanilha() {
    const corpo = document.getElementById('tabelaCorpo');
    if (!corpo) {
        return;
    }
    corpo.innerHTML = ''; 
    for (let h = 6; h <= 22; h++) {
        const tr = document.createElement('tr');
        const horaInicio = String(h).padStart(2, '0') + ':00';
        const horaFim = String(h + 1).padStart(2, '0') + ':00';
        tr.innerHTML = `
            <td class="horario-celula"><span class="hora-item">${horaInicio}</span><span class="hora-traco"> - </span><span class="hora-item">${horaFim}</span></td>
            <td id="cel-${h}-1"></td><td id="cel-${h}-2"></td><td id="cel-${h}-3"></td>
            <td id="cel-${h}-4"></td><td id="cel-${h}-5"></td><td id="cel-${h}-6"></td>
            <td id="cel-${h}-7"></td>
            <td class="horario-celula"><span class="hora-item">${horaInicio}</span><span class="hora-traco"> - </span><span class="hora-item">${horaFim}</span></td>`;
        corpo.appendChild(tr);
    }
}

function toggleLegendaVisual() {
    const bloco = document.getElementById('legenda-bloco');
    const icone = document.getElementById('legenda-icone');
    if (bloco.style.display === 'block') { 
        bloco.style.display = 'none'; 
        icone.parentElement.classList.remove('expandido'); 
    } else { 
        bloco.style.display = 'block'; 
        icone.parentElement.classList.add('expandido'); 
        document.getElementById('agenda-conteudo').style.display = 'none'; 
    }
}

function toggleAgendaVisual() {
    const bloco = document.getElementById('agenda-conteudo');
    const icone = document.getElementById('agenda-icone');
    if (bloco.style.display === 'block') { 
        bloco.style.display = 'none'; 
        icone.parentElement.classList.remove('expandido'); 
    } else { 
        renderizarAgendaPessoalSaaS();
        bloco.style.display = 'block'; 
        icone.parentElement.classList.add('expandido'); 
        document.getElementById('legenda-bloco').style.display = 'none';   
    }
}

/* ======================================================== */
/* 10. MÓDULO AGENDA PESSOAL DO ATLETA (TICKET PASS)         */
/* ======================================================== */
function atualizarBadgeAgendaSaaS() {
    const badge = document.getElementById('badge-agenda-contador');
    if (!badge) return;

    const idLogado = localStorage.getItem('jogadorLogadoId');
    const nomeLogado = (localStorage.getItem('jogadorLogadoNome') || '').trim();
    const norm = (txt) => (txt || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, " ").trim().toUpperCase();
    const normNomeLogado = norm(nomeLogado);

    if ((!idLogado && !normNomeLogado) || isGestorLogado) {
        badge.style.display = 'none';
        return;
    }

    const agora = new Date();
    const hojeYMD = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`;
    const horaAtual = agora.getHours();

    let jogosFuturosCount = 0;

    Object.keys(reservasGeralGlobal || {}).forEach(quadraKey => {
        const slots = reservasGeralGlobal[quadraKey] || {};
        Object.keys(slots).forEach(slotKey => {
            const r = slots[slotKey];
            if (!r || !r.dataCompleta || r.status === 'aula_cancelada') return;
            if (r.borda === undefined && parseInt(r.duracao) === 2) return;

            if (r.dataCompleta < hojeYMD) return;

            const duracao = parseInt(r.duracao) || 1;
            if (r.dataCompleta === hojeYMD && (r.hora + duracao <= horaAtual)) return;

            // 🎾 Se a partida já foi jogada (súmula pendente de validação, contestada ou consolidada), sai da agenda
            const stPlacarBadge = r.statusPlacar || (r.dadosPlacar ? r.dadosPlacar.statusPlacar : '');
            if (stPlacarBadge && stPlacarBadge !== 'sem_placar') return;
            if (r.dadosPlacar || r.status === 'finalizada') return;

            const jogsComp = norm(r.jogadores_completo || '');
            const jogsAp = norm(r.jogadores || '');
            const org = norm(r.organizador || '');

            const pertenceAoAtleta = jogsComp.includes(normNomeLogado) || jogsAp.includes(normNomeLogado) || org.includes(normNomeLogado);

            if (pertenceAoAtleta) {
                jogosFuturosCount++;
            }
        });
    });

    if (jogosFuturosCount > 0) {
        badge.textContent = jogosFuturosCount;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }
}

function renderizarAgendaPessoalSaaS() {
    const container = document.getElementById('agenda-conteudo');
    if (!container) return;

    const nomeLogado = (localStorage.getItem('jogadorLogadoNome') || '').trim();
    const norm = (txt) => (txt || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, " ").trim().toUpperCase();
    const normNomeLogado = norm(nomeLogado);

    if (!normNomeLogado) {
        container.innerHTML = `<p class="agenda-nenhuma-reserva">Nenhum atleta identificado na sessão.</p>`;
        return;
    }

    const agora = new Date();
    const hojeYMD = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`;
    const horaAtual = agora.getHours();

    const diasSemanaCurto = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
    const meusJogosFuturos = [];

    Object.keys(reservasGeralGlobal || {}).forEach(quadraKey => {
        const slots = reservasGeralGlobal[quadraKey] || {};
        Object.keys(slots).forEach(slotKey => {
            const r = slots[slotKey];
            if (!r || !r.dataCompleta || r.status === 'aula_cancelada') return;
            if (r.borda === undefined && parseInt(r.duracao) === 2) return;

            if (r.dataCompleta < hojeYMD) return;

            const duracao = parseInt(r.duracao) || 1;
            if (r.dataCompleta === hojeYMD && (r.hora + duracao <= horaAtual)) return;

            // 🎾 Se a partida já foi jogada (súmula pendente de validação, contestada ou consolidada), sai da agenda
            const stPlacarFiltro = r.statusPlacar || (r.dadosPlacar ? r.dadosPlacar.statusPlacar : '');
            if (stPlacarFiltro && stPlacarFiltro !== 'sem_placar') return;
            if (r.dadosPlacar || r.status === 'finalizada') return;

            const jogsComp = norm(r.jogadores_completo || '');
            const jogsAp = norm(r.jogadores || '');
            const org = norm(r.organizador || '');

            const pertenceAoAtleta = jogsComp.includes(normNomeLogado) || jogsAp.includes(normNomeLogado) || org.includes(normNomeLogado);
            if (!pertenceAoAtleta) return;

            let nomeQuadraAmigavel = quadraKey;
            const numQuadra = quadraKey.match(/\d+/);
            if (numQuadra && typeof configQuadrasGlobal !== 'undefined' && configQuadrasGlobal.nomes) {
                const dadosQ = configQuadrasGlobal.nomes[numQuadra[0]];
                if (dadosQ) {
                    nomeQuadraAmigavel = typeof dadosQ === 'object' ? (dadosQ.nome || `Quadra ${numQuadra[0]}`) : dadosQ;
                }
            }

            const partesData = r.dataCompleta.split('-');
            const dataObj = new Date(parseInt(partesData[0]), parseInt(partesData[1]) - 1, parseInt(partesData[2]));
            const diaSemanaTxt = diasSemanaCurto[dataObj.getDay()] || "DIA";
            const dataFormatada = `${partesData[2]}/${partesData[1]}`;
            const ehHoje = (r.dataCompleta === hojeYMD);

            const rotuloStubDia = ehHoje ? "HOJE" : `${diaSemanaTxt} ${dataFormatada}`;
            const horaFormatada = `${String(r.hora).padStart(2, '0')}:00`;

            const ehRanking = (r.isRanking === true || r.tipo === 'ranking');
            const stPlacar = r.statusPlacar || (r.dadosPlacar ? r.dadosPlacar.statusPlacar : 'sem_placar');
            const statusReserva = r.status || 'confirmada';

            let badgeStatusHtml = '';
            if (ehRanking) {
                badgeStatusHtml = `<span style="font-size: 9.5px; font-weight: 800; color: #b45309; background: #fef3c7; border: 1px solid #fde68a; padding: 2px 6px; border-radius: 6px;">🏆 Ranking</span>`;
            } else if (statusReserva === 'pendente' || stPlacar === 'pendente_validacao') {
                const temConvidado = (r.dadosConvidados && Object.keys(r.dadosConvidados).length > 0) || 
                                     (r.jogadores_completo || r.jogadores || '').toLowerCase().includes('convidado');
                if (temConvidado && statusReserva === 'pendente') {
                    // 🛡️ Permissão de gestão da taxa na agenda: apenas Organizador, Admin ou Gestor
                    const idUsuarioLogado = localStorage.getItem('jogadorLogadoId') || ""; 
                    let perfisUsuarioLogado = {};
                    try { perfisUsuarioLogado = JSON.parse(localStorage.getItem('jogadorLogadoPerfis') || '{}'); } catch (e) {}
                    const ehAdminLogado = perfisUsuarioLogado['Admin'] === true;
                    const isGestor = typeof isGestorLogado !== 'undefined' && isGestorLogado;

                    let apelidoUsuarioLogado = normNomeLogado;
                    if (typeof jogadoresGlobal !== 'undefined' && jogadoresGlobal[idUsuarioLogado]) {
                        apelidoUsuarioLogado = norm(jogadoresGlobal[idUsuarioLogado].apelido);
                    }
                    const ehOrganizador = (org === normNomeLogado || org === apelidoUsuarioLogado);
                    const podeGerenciarTaxa = isGestor || ehAdminLogado || ehOrganizador;

                    if (podeGerenciarTaxa) {
                        badgeStatusHtml = `<span onclick="abrirCheckoutPelaAgendaSaaS('${quadraKey}', '${slotKey}')" style="font-size: 9.5px; font-weight: 800; color: #d97706; background: #fef3c7; border: 1px solid #fde68a; padding: 2px 6px; border-radius: 6px; cursor: pointer; text-decoration: underline;" title="Clique para abrir o pagamento da taxa de convidado">Pendente $</span>`;
                    } else {
                        badgeStatusHtml = `<span style="font-size: 9.5px; font-weight: 800; color: #d97706; background: #fef3c7; border: 1px solid #fde68a; padding: 2px 6px; border-radius: 6px;" title="Aguardando confirmação da taxa do convidado">Pendente $</span>`;
                    }
                } else {
                    badgeStatusHtml = `<span style="font-size: 9.5px; font-weight: 800; color: #d97706; background: #fef3c7; border: 1px solid #fde68a; padding: 2px 6px; border-radius: 6px;">Pendente</span>`;
                }
            } else {
                badgeStatusHtml = `<span style="font-size: 9.5px; font-weight: 800; color: #15803d; background: #dcfce7; border: 1px solid #86efac; padding: 2px 6px; border-radius: 6px;">Confirmado</span>`;
            }

            const listaParticipantes = (r.jogadores_completo || r.jogadores || '').split(',').map(s => s.trim()).filter(Boolean);
            const outrosParticipantes = listaParticipantes
                .filter(nome => !norm(nome).includes(normNomeLogado))
                .map(nome => capitalizarNome(buscarInfoJogador(nome).apelido)); 

            let textoParticipantes = "";
            if (ehRanking) {
                const adv = outrosParticipantes[0] || "Adversário";
                textoParticipantes = `Desafio contra ${adv} (${duracao}h)`;
            } else if (outrosParticipantes.length > 0) {
                textoParticipantes = `Com ${outrosParticipantes.join(', ')} (${duracao}h)`;
            } else {
                textoParticipantes = `Reserva individual (${duracao}h)`;
            }

            meusJogosFuturos.push({
                dataSort: `${r.dataCompleta}_${String(r.hora).padStart(2, '0')}`,
                rotuloStubDia,
                horaFormatada,
                nomeQuadraAmigavel,
                badgeStatusHtml,
                textoParticipantes,
                ehHoje
            });
        });
    });

    if (meusJogosFuturos.length === 0) {
        container.innerHTML = `<p class="agenda-nenhuma-reserva">Você não possui jogos agendados a partir de hoje.</p>`;
        return;
    }

    meusJogosFuturos.sort((a, b) => a.dataSort.localeCompare(b.dataSort));

    let htmlCards = `<div class="op4-list">`;
    meusJogosFuturos.forEach(j => {
        const bgStub = j.ehHoje ? `style="background: #f0fdf4;"` : '';
        const colorDay = j.ehHoje ? `style="color: var(--cor-primaria);"` : '';

        htmlCards += `
            <div class="op4-ticket">
                <div class="op4-stub" ${bgStub}>
                    <span style="font-size: 10px; font-weight: 900; color: #64748b;" ${colorDay}>${j.rotuloStubDia}</span>
                    <span style="font-size: 13px; font-weight: 900; color: #1e293b;">${j.horaFormatada}</span>
                </div>
                <div class="op4-body">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <strong style="font-size: 12.5px; color: #1e293b;">${j.nomeQuadraAmigavel}</strong>
                        ${j.badgeStatusHtml}
                    </div>
                    <span style="font-size: 11px; color: #64748b; margin-top: 2px;">${j.textoParticipantes}</span>
                </div>
            </div>
        `;
    });
    htmlCards += `</div>`;

    container.innerHTML = htmlCards;
}

function abrirCheckoutPelaAgendaSaaS(quadraKey, slotKey) {
    if (!reservasGeralGlobal || !reservasGeralGlobal[quadraKey] || !reservasGeralGlobal[quadraKey][slotKey]) return;
    const r = reservasGeralGlobal[quadraKey][slotKey];
    const reservaPayload = { ...r, dia: r.dia, hora: r.hora };
    if (typeof toggleAgendaVisual === 'function') {
        const bloco = document.getElementById('agenda-conteudo');
        if (bloco && bloco.style.display === 'block') {
            toggleAgendaVisual();
        }
    }
    if (typeof abrirCheckoutConvidadoSaaS === 'function') {
        abrirCheckoutConvidadoSaaS(reservaPayload, quadraKey);
    }
}

function sairDaVisaoQuadras() {
	if (isGestorLogado) {
        voltarAoQG();
    } else {
        if (typeof fecharAplicativoSaaS === 'function') {
            fecharAplicativoSaaS(); 
        } else {
            showToast("Feche o aplicativo no seu celular.", "info");
        }
    }
}

// ==========================================
// 8. BOTÃO FLUTUANTE (NOVO AGENDAMENTO) 
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const btnNovaReserva = document.getElementById('fab-nova-reserva');
    
    if (btnNovaReserva) {
        btnNovaReserva.addEventListener('click', () => {
            if (navigator.vibrate) navigator.vibrate(30);
            
            // Abre o formulário totalmente livre/destravado
            abrirAgendamentoSaaS();
        });
    }
});


// ==========================================
// 9. MÓDULO DE PERFIL DO JOGADOR (BOTTOM SHEET)
// ==========================================

function abrirSheetPerfil() {
    
    // 🛡️ Bloqueio Mestre: Gestores e God Mode não acessam a Central do Jogador
    if (typeof isGestorLogado !== 'undefined' && isGestorLogado) return;
    
    const sheet = document.getElementById('sheet-perfil-jogador');
    if (!sheet) return;

    let nomeExibicao = "Jogador";
    let clubeExibicao = "Arena";
    let classeExibicao = "Classe A";

    if (isGestorLogado) {
        const isGodMode = !!localStorage.getItem('god_mode_clube');
        nomeExibicao = isGodMode ? "Desenvolvedor" : "Gestor"; 
        
        const txtClubeDOM = document.getElementById('txt-nome-clube');
        clubeExibicao = (txtClubeDOM && txtClubeDOM.textContent !== "Carregando...") 
            ? txtClubeDOM.textContent 
            : (clubeAtivoId || "Painel Admin");
        classeExibicao = isGodMode ? "God Mode" : "Admin";
    } else {
        const nomeBruto = localStorage.getItem('jogadorLogadoNome') || "Jogador";
        // Capitalização suave do nome (Primeiras letras maiúsculas, mantendo preposições minúsculas)
        nomeExibicao = nomeBruto.toLowerCase().split(/\s+/).map(p => {
            if (['da', 'de', 'do', 'dos', 'das', 'e'].includes(p)) return p;
            return p.charAt(0).toUpperCase() + p.slice(1);
        }).join(' ');

        clubeExibicao = localStorage.getItem('setpoint_jogador_clube_nome') || "Arena";

        // Busca a classe oficial do atleta no cadastro global ou cache
        const idLogado = localStorage.getItem('jogadorLogadoId');
        if (idLogado && typeof jogadoresGlobal !== 'undefined' && jogadoresGlobal[idLogado] && jogadoresGlobal[idLogado].classe) {
            classeExibicao = "Classe " + jogadoresGlobal[idLogado].classe;
        } else {
            const classeArmazenada = localStorage.getItem('jogadorLogadoClasse');
            classeExibicao = classeArmazenada ? ("Classe " + classeArmazenada) : "Classe A";
        }
    }

    // Injeção de Identidade
    const elNome = document.getElementById('sheet-nome-jogador');
    const elClube = document.getElementById('sheet-clube-jogador');
    const elClasse = document.getElementById('sheet-classe-jogador');
    const elDivisorClasse = document.getElementById('perfil-divisor-classe');

    if (elNome) elNome.textContent = nomeExibicao;
    if (elClube) elClube.textContent = clubeExibicao;
    if (elClasse) {
        elClasse.textContent = classeExibicao;
        if (elDivisorClasse) elDivisorClasse.style.display = 'inline';
    }

    // Injeção da Versão exclusivamente no rodapé
    const elVersao = document.getElementById('sheet-versao-app');
    if (elVersao) {
        const numVersao = (window.AndroidBridge && typeof window.AndroidBridge.getAppVersion === 'function')
            ? window.AndroidBridge.getAppVersion()
            : (typeof versaoWebGlobal !== 'undefined' ? versaoWebGlobal : '2.0.6.5');
        elVersao.textContent = `SetPoint SaaS • Versão ${numVersao}`;
    }

    // 🧠 MEMÓRIA DAS NOTIFICAÇÕES: Lê o que foi salvo no aparelho
    const switchNotif = document.getElementById('saas-switch-notificacoes');
    if (switchNotif) {
        const prefSalva = localStorage.getItem('setpoint_notificacoes_ativas');
        if (prefSalva === 'false') {
            switchNotif.checked = false;
        } else {
            switchNotif.checked = true; // O padrão de fábrica é ligado
        }
    }

    // Garante que o menu principal abra ativo e pronto
    perfilVoltarHub();

    sheet.classList.add('visivel');
    setTimeout(() => {
        sheet.classList.add('ativa');
    }, 10);
}



function fecharSheetPerfil(event) {
    const sheet = document.getElementById('sheet-perfil-jogador');
    if (!sheet) return;
    
    if (event && !event.target.classList.contains('bottom-sheet-overlay')) return;

    sheet.classList.remove('ativa');
    setTimeout(() => {
        sheet.classList.remove('visivel');  
        perfilVoltarHub();
    }, 300);
}
 
function deslogarJogadorSaaS() {
    fecharSheetPerfil();
    
    showPrompt('Sair da Conta', 'Deseja trocar de usuário ou encerrar a sessão?', () => {
        if (typeof desligarTodosRadaresSaaS === 'function') {
            desligarTodosRadaresSaaS();
        }

        if (isGestorLogado || localStorage.getItem('god_mode_clube')) {
            fazerLogout();
        } else {
            // 📝 Encerra a sessão de acesso no log com o horário exato de saída e limpa presença online
            if (typeof removerPresencaOnlineSaaS === 'function') {
                removerPresencaOnlineSaaS(true, 'Saída manual', true);
            }

            // 🧹 HIGIENIZA O TOKEN DESTE APARELHO ANTES DE SAIR DA CONTA (Multi-Device)
            const idLogadoParaLimpeza = localStorage.getItem('jogadorLogadoId');
            const tokenDesteAparelho = localStorage.getItem('setpoint_aparelho_fcm_token');
            if (idLogadoParaLimpeza && typeof raizBanco !== 'undefined' && raizBanco && tokenDesteAparelho) {
                database.ref(`${raizBanco}/jogadores/${idLogadoParaLimpeza}/fcmTokens/${tokenDesteAparelho}`).remove().catch(() => {});
                database.ref(`${raizBanco}/jogadores/${idLogadoParaLimpeza}/fcmToken`).remove().catch(() => {});
            }
            
            localStorage.removeItem('jogadorLogadoId');
            localStorage.removeItem('jogadorLogadoNome');
            showToast('Sessão encerrada.', 'success');
            setTimeout(() => window.location.href = window.location.pathname, 600); 
        }
    });
}

// ====================================================================
// 9.1. NOVO MENU DE PERFIL — Seja PRO, navegação Guia Rápido, accordion
// ====================================================================

// Alterna entre Plano Básico <-> PRO de forma orgânica
let perfilEhPro = false;
function alternarPlanoPerfil() {
    perfilEhPro = !perfilEhPro;
    const card    = document.getElementById('perfil-card-upgrade');
    const badge   = document.getElementById('perfil-badge-pro');
    const divisor = document.getElementById('perfil-divisor-pro');
    if (!card || !badge || !divisor) return;

    if (perfilEhPro) {
        card.style.display = 'none';
        badge.style.display = 'inline-block';
        divisor.style.display = 'inline';
    } else {
        card.style.display = 'flex';
        badge.style.display = 'none';
        divisor.style.display = 'none';
    }
}

// Navega para a sub-tela de Guia Rápido
function perfilAbrirGuia() {
    const hub  = document.getElementById('perfil-view-hub');
    const guia = document.getElementById('perfil-view-guia');
    if (hub)  hub.classList.remove('ativo');
    if (guia) guia.classList.add('ativo');
}

// Retorna ao menu principal da Central do Jogador
function perfilVoltarHub() {
    const hub  = document.getElementById('perfil-view-hub');
    const guia = document.getElementById('perfil-view-guia');
    if (guia) guia.classList.remove('ativo');
    if (hub)  hub.classList.add('ativo');
}

// Comportamento da sanfona (accordion) do Guia Rápido
function perfilToggleAcc(headerEl) {
    const item = headerEl.parentElement;
    if (item) item.classList.toggle('open');
}

// ====================================================================
// 9.2. PREFERÊNCIA DE NOTIFICAÇÕES (PERSISTÊNCIA LOCAL E NUVEM)
// ====================================================================

function alternarNotificacoesSaaS(isLigado) {
    if (navigator.vibrate) navigator.vibrate(25);
    
    // 1. Salva imediatamente no aparelho (localStorage)
    localStorage.setItem('setpoint_notificacoes_ativas', isLigado ? 'true' : 'false');

    // 2. 🔕 Controla imediatamente a visibilidade do Sininho no cabeçalho
    const badge = document.getElementById('notificacao-badge');
    const containerBadge = badge ? badge.closest('.notificacao-container') : null;
    if (containerBadge) {
        containerBadge.style.display = isLigado ? 'flex' : 'none';
    }
    if (!isLigado && badge) {
        badge.style.display = 'none';
    }

    // 3. Re-sincroniza o ouvinte em tempo real
    if (typeof iniciarOuvinteNotificacoesJogadorSaaS === 'function') {
        iniciarOuvinteNotificacoesJogadorSaaS();
    }
    
    // 4. Salva na Nuvem (Firebase) se o atleta estiver logado
    const idLogado = localStorage.getItem('jogadorLogadoId');
    if (idLogado && typeof raizBanco !== 'undefined' && raizBanco) {
        database.ref(`${raizBanco}/jogadores/${idLogado}/receber_notificacoes`).set(isLigado)
        .then(() => {
            const statusTxt = isLigado ? "ativadas" : "silenciadas";
            showToast(`Notificações ${statusTxt} com sucesso.`, "success");
        })
        .catch(err => {
            console.error("Erro ao salvar preferência de notificação no banco:", err);
            showToast("Ocorreu um erro ao salvar sua preferência.", "error");
        });
    } else {
        const statusTxt = isLigado ? "ativadas" : "silenciadas";
        showToast(`Notificações ${statusTxt} no dispositivo.`, "info");
    }
}


// ====================================================================
// 10. MOTOR DE PRESENÇA ONLINE E HISTÓRICO DE ACESSOS (GAVETA MATTE)
// ====================================================================
let abaControleAcessosAtivaSaaS = 'online';
let cacheEntradasHojeSaaS = {};

function formatarHoraMinutoSaaS(timestamp) {
    if (!timestamp) return '--:--';
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return '--:--';
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
}

function formatarDuracaoSessaoSaaS(inicioMs, fimMs) {
    if (inicioMs === null || inicioMs === undefined || fimMs === null || fimMs === undefined || fimMs <= inicioMs) {
        return '1 min';
    }
    const totalMin = Math.max(1, Math.round((fimMs - inicioMs) / 60000));
    if (totalMin < 60) return `${totalMin} min`;
    const horas = Math.floor(totalMin / 60);
    const mins = totalMin % 60;
    return mins > 0 ? `${horas}h ${mins}m` : `${horas}h`;
}

function formatarNomeControleAcessoSaaS(nomeBruto) {
    return (nomeBruto || 'Atleta').toLowerCase().split(/\s+/).map(palavra => {
        if (['da', 'de', 'do', 'dos', 'das'].includes(palavra)) {
            return palavra;
        }
        return window.innerWidth <= 767 && palavra.length > 10
            ? palavra.charAt(0).toUpperCase() + '.'
            : palavra.charAt(0).toUpperCase() + palavra.slice(1);
    }).join(' ');
}

function montarTagsControleAcessoSaaS(usuarioId, nomeFallback, vinculoFallback, perfisFallback) {
    let dados = null;
    if (typeof obterDadosControlePresencaSaas === 'function') {
        const identificador = (usuarioId && usuarioId.startsWith('-')) ? usuarioId : nomeFallback;
        dados = obterDadosControlePresencaSaas(identificador);
    }

    const socio = (dados && dados.socio) ? dados.socio : (vinculoFallback || 'titular');
    const isAdmin = dados ? dados.isAdmin : !!(perfisFallback && perfisFallback['Admin'] === true);

    let tagsHtml = '';
    if (socio === 'titular') {
        tagsHtml += `<span class="SaaS-tag SaaS-tag-socio">Sócio</span>`;
    } else if (socio === 'dependente') {
        tagsHtml += `<span class="SaaS-tag SaaS-tag-dependente">Dependente</span>`;
    }

    if (isAdmin) {
        tagsHtml += `<span class="SaaS-tag SaaS-tag-admin">Admin</span>`;
    }

    return tagsHtml;
}

function obterIconePlataformaSaaS(plataforma) {
    const plat = (plataforma || 'Web PC').trim();
    if (plat.includes('iOS') || plat.includes('iPhone')) return `📱 ${plat}`;
    if (plat.includes('Android')) return `🤖 ${plat}`;
    return `💻 ${plat}`;
}

function atualizarSeloAutoFaxinaAcessosSaaS(diasRaw) {
    const elSelo = document.getElementById('txt-dias-retencao-acessos');
    const inpData = document.getElementById('inp-data-logs-acesso');

    const val = parseInt(diasRaw, 10);
    const diasEfetivos = (!isNaN(val) && val > 0) ? val : 15;

    if (elSelo) {
        elSelo.textContent = `Auto-Faxina: ${diasEfetivos}d`;
    }

    if (inpData) {
        const dtMin = new Date();
        dtMin.setDate(dtMin.getDate() - diasEfetivos);
        const minStr = (typeof obterDataLocalYMDSaaS === 'function')
            ? obterDataLocalYMDSaaS(dtMin.getTime())
            : dtMin.toISOString().split('T')[0];
        inpData.min = minStr;
    }
}

function abrirJanelaOnlineSaaS() {
    const overlay = document.getElementById('modal-online-SaaS');
    if (!overlay) return;

    cacheEntradasHojeSaaS = {};

    const inpData = document.getElementById('inp-data-logs-acesso');
    const hojeStr = (typeof obterDataLocalYMDSaaS === 'function')
        ? obterDataLocalYMDSaaS()
        : new Date().toISOString().split('T')[0];

    if (inpData) {
        inpData.value = hojeStr;
        inpData.max = hojeStr;
    }

    // Sincroniza o prazo da Auto-Faxina com as Regras de Reserva
    if (typeof configRegrasGlobal !== 'undefined' && configRegrasGlobal && configRegrasGlobal.DiasLimpezaLogs !== undefined) {
        atualizarSeloAutoFaxinaAcessosSaaS(configRegrasGlobal.DiasLimpezaLogs);
    } else if (typeof DiasLimpezaLogs !== 'undefined') {
        atualizarSeloAutoFaxinaAcessosSaaS(DiasLimpezaLogs);
    } else if (typeof raizBanco !== 'undefined' && raizBanco) {
        database.ref(`${raizBanco}/config/DiasLimpezaLogs`).once('value').then((snap) => {
            atualizarSeloAutoFaxinaAcessosSaaS(snap.val());
        }).catch(() => {
            atualizarSeloAutoFaxinaAcessosSaaS(15);
        });
    }

    overlay.style.display = 'flex';
    alternarAbaOnlineSaaS('online');
}

function fecharJanelaOnlineSaaS(event) {
    const overlay = document.getElementById('modal-online-SaaS');
    if (!overlay) return;
    if (event && event.target !== overlay) return;
    overlay.style.display = 'none';
}

function alternarAbaOnlineSaaS(aba) {
    abaControleAcessosAtivaSaaS = aba;

    const btnOnline = document.getElementById('btn-tab-online-agora');
    const btnHist = document.getElementById('btn-tab-online-historico');
    const viewOnline = document.getElementById('view-online-agora-saas');
    const viewHist = document.getElementById('view-online-historico-saas');

    if (btnOnline) btnOnline.classList.toggle('active', aba === 'online');
    if (btnHist) btnHist.classList.toggle('active', aba === 'historico');

    if (viewOnline) viewOnline.style.display = (aba === 'online') ? 'block' : 'none';
    if (viewHist) viewHist.style.display = (aba === 'historico') ? 'block' : 'none';

    if (aba === 'online') {
        renderizarListaUsuariosOnlineSaaS();
    } else {
        const inpData = document.getElementById('inp-data-logs-acesso');
        const dataAlvo = (inpData && inpData.value)
            ? inpData.value
            : ((typeof obterDataLocalYMDSaaS === 'function') ? obterDataLocalYMDSaaS() : new Date().toISOString().split('T')[0]);
        carregarHistoricoAcessosDiaSaaS(dataAlvo);
    }
}

function renderizarListaUsuariosOnlineSaaS() {
    const container = document.getElementById('lista-online-SaaS');
    if (!container) return;

    const chavesOnline = Object.keys(saasUsuariosOnlineCache || {});
    const agora = Date.now();
    const TOLERANCIA_GHOST_MS = 5 * 60 * 1000;

    const filtrados = chavesOnline.filter(key => {
        const usr = saasUsuariosOnlineCache[key];
        if (!usr || key === 'GESTOR' || usr.isGestor) return false;
        if (usr.lastSeen && (agora - usr.lastSeen > TOLERANCIA_GHOST_MS)) return false;
        return true;
    });

    if (filtrados.length === 0) {
        container.innerHTML = '<p class="SaaS-lista-vazia">Nenhum atleta online no momento.</p>';
        return;
    }

    // Busca silenciosa do horário de entrada e dispositivo de hoje
    const hojeStr = (typeof obterDataLocalYMDSaaS === 'function') ? obterDataLocalYMDSaaS() : '';
    const faltaEntradaNoCache = filtrados.some(k => !cacheEntradasHojeSaaS[k]);

    if (faltaEntradaNoCache && hojeStr && typeof raizBanco !== 'undefined' && raizBanco && !window.buscandoEntradasHojeSaaS) {
        window.buscandoEntradasHojeSaaS = true;
        database.ref(`${raizBanco}/logs_acesso/${hojeStr}`).once('value').then((snap) => {
            window.buscandoEntradasHojeSaaS = false;
            if (snap.exists()) {
                snap.forEach((child) => {
                    const s = child.val();
                    if (s && s.usuarioId && s.entrada) {
                        const atual = (cacheEntradasHojeSaaS[s.usuarioId] && cacheEntradasHojeSaaS[s.usuarioId].entrada) || 0;
                        if (s.entrada >= atual) {
                            cacheEntradasHojeSaaS[s.usuarioId] = {
                                entrada: s.entrada,
                                plataforma: s.plataforma || 'Web PC'
                            };
                        }
                    }
                });
            }
            filtrados.forEach(k => {
                if (!cacheEntradasHojeSaaS[k]) {
                    cacheEntradasHojeSaaS[k] = { entrada: null, plataforma: 'Web PC' };
                }
            });
            if (abaControleAcessosAtivaSaaS === 'online') {
                renderizarListaUsuariosOnlineSaaS();
            }
        }).catch(() => {
            window.buscandoEntradasHojeSaaS = false;
        });
    }

    let atletasRicos = filtrados.map(key => {
        const usrCache = saasUsuariosOnlineCache[key] || {};
        const nomeBruto = usrCache.usuario || 'Atleta';
        const infoHoje = cacheEntradasHojeSaaS[key] || {};
        return {
            id: key,
            nome: nomeBruto,
            entradaTs: infoHoje.entrada || null,
            plataforma: usrCache.plataforma || infoHoje.plataforma || ''
        };
    });

    atletasRicos.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

    container.innerHTML = '';
    atletasRicos.forEach(atleta => {
        const nomeFormatado = formatarNomeControleAcessoSaaS(atleta.nome);
        const tagsHtml = montarTagsControleAcessoSaaS(atleta.id, atleta.nome);

        let tempoOnlineHtml = '';
        if (atleta.entradaTs && agora >= atleta.entradaTs) {
            const mins = Math.max(1, Math.round((agora - atleta.entradaTs) / 60000));
            tempoOnlineHtml = `<span class="tempo-online-agora">• há ${mins} min</span>`;
        }

        let devicePillHtml = '';
        if (atleta.plataforma) {
            const deviceTexto = obterIconePlataformaSaaS(atleta.plataforma);
            devicePillHtml = `<span class="sessao-device-pill">${deviceTexto}</span>`;
        }

        const divLinha = document.createElement('div');
        divLinha.className = 'linha-usuario-SaaS';
        divLinha.innerHTML = `
            <div>
                <span class="nome-usuario-SaaS">${nomeFormatado}</span>
                ${tempoOnlineHtml}
            </div>
            <div class="tags-container-SaaS">${tagsHtml}${devicePillHtml}</div>
        `;
        container.appendChild(divLinha);
    });
}

function carregarHistoricoAcessosDiaSaaS(dataYMD) {
    const container = document.getElementById('lista-historico-acesso-SaaS');
    const badgeResumo = document.getElementById('txt-resumo-acessos-dia');
    if (!container || !raizBanco || !dataYMD) return;

    container.innerHTML = '<p class="SaaS-lista-vazia">Carregando registros...</p>';
    if (badgeResumo) badgeResumo.textContent = '...';

    database.ref(`${raizBanco}/logs_acesso/${dataYMD}`).once('value').then((snap) => {
        if (!snap.exists()) {
            container.innerHTML = '<p class="SaaS-lista-vazia">Nenhum acesso registrado nesta data.</p>';
            if (badgeResumo) badgeResumo.textContent = '0 acessos';
            return;
        }

        const sessoes = [];
        snap.forEach((child) => {
            const val = child.val();
            if (val && val.usuarioId && val.entrada) {
                sessoes.push({ id: child.key, ...val });
            }
        });

        if (sessoes.length === 0) {
            container.innerHTML = '<p class="SaaS-lista-vazia">Nenhum acesso registrado nesta data.</p>';
            if (badgeResumo) badgeResumo.textContent = '0 acessos';
            return;
        }

        // Ordena todas as sessões da mais recente para a mais antiga
        sessoes.sort((a, b) => (b.entrada || 0) - (a.entrada || 0));

        // Cálculo de métricas gerais do dia (sócios únicos e horário de pico)
        const contagemPorHora = {};
        sessoes.forEach(s => {
            const h = String(new Date(s.entrada).getHours()).padStart(2, '0');
            contagemPorHora[h] = (contagemPorHora[h] || 0) + 1;
        });

        let horaPico = '';
        let maxAcessosHora = 0;
        Object.keys(contagemPorHora).forEach(h => {
            if (contagemPorHora[h] > maxAcessosHora) {
                maxAcessosHora = contagemPorHora[h];
                horaPico = h;
            }
        });

        const agora = Date.now();
        const hojeStr = (typeof obterDataLocalYMDSaaS === 'function') ? obterDataLocalYMDSaaS(agora) : '';
        const TOLERANCIA_GHOST_MS = 5 * 60 * 1000;

        // Agrupa as sessões por usuarioId
        const gruposMap = {};
        sessoes.forEach(s => {
            if (!gruposMap[s.usuarioId]) {
                gruposMap[s.usuarioId] = {
                    usuarioId: s.usuarioId,
                    usuario: s.usuario || 'Atleta',
                    vinculo: s.vinculo,
                    perfis: s.perfis,
                    sessoes: []
                };
            }
            gruposMap[s.usuarioId].sessoes.push(s);
        });

        const gruposAtletas = Object.values(gruposMap).map(grupo => {
            grupo.sessoes.sort((a, b) => (b.entrada || 0) - (a.entrada || 0));

            const presencaAtiva = saasUsuariosOnlineCache && saasUsuariosOnlineCache[grupo.usuarioId];
            const algumaOnline = (dataYMD === hojeStr) &&
                presencaAtiva &&
                (!presencaAtiva.lastSeen || (agora - presencaAtiva.lastSeen <= TOLERANCIA_GHOST_MS)) &&
                grupo.sessoes.some(s => s.status === 'online');

            let totalDuracaoMs = 0;
            grupo.sessoes.forEach((s, idx) => {
                const sEstaOnline = algumaOnline && idx === 0;
                const fimMs = sEstaOnline ? agora : (s.saida || s.ultimaAtividade || s.entrada);
                totalDuracaoMs += Math.max(60000, fimMs - s.entrada);
            });

            const maisRecente = grupo.sessoes[0];
            const ultimoTs = maisRecente ? (maisRecente.entrada || 0) : 0;

            return {
                ...grupo,
                algumaOnline,
                totalDuracaoMs,
                ultimoTs
            };
        });

        // Ordena: quem está Online agora fica no topo, seguido pelos últimos acessos
        gruposAtletas.sort((a, b) => {
            if (a.algumaOnline !== b.algumaOnline) {
                return a.algumaOnline ? -1 : 1;
            }
            return b.ultimoTs - a.ultimoTs;
        });

        if (badgeResumo) {
            const totalSocios = gruposAtletas.length;
            const txtSocios = `${totalSocios} ${totalSocios === 1 ? 'sócio' : 'sócios'}`;
            badgeResumo.textContent = horaPico ? `${txtSocios} • Pico ${horaPico}h` : txtSocios;
        }

        container.innerHTML = '';
        gruposAtletas.forEach(grupo => {
            const nomeFormatado = formatarNomeControleAcessoSaaS(grupo.usuario);
            const tagsHtml = montarTagsControleAcessoSaaS(grupo.usuarioId, grupo.usuario, grupo.vinculo, grupo.perfis);
            const totalAcessos = grupo.sessoes.length;
            const duracaoAcumuladaTxt = formatarDuracaoSessaoSaaS(0, grupo.totalDuracaoMs);

            const maisRecente = grupo.sessoes[0];
            let resumoStatusHtml = '';
            if (grupo.algumaOnline) {
                resumoStatusHtml = `<span class="sessao-status-online">● Online agora</span>`;
            } else {
                const ultimoHorario = formatarHoraMinutoSaaS(maisRecente.saida || maisRecente.ultimaAtividade || maisRecente.entrada);
                resumoStatusHtml = `Último acesso: ${ultimoHorario}`;
            }

            const resumoBadgeTxt = `${totalAcessos} ${totalAcessos === 1 ? 'acesso' : 'acessos'} • ${duracaoAcumuladaTxt}`;

            let subLinhasHtml = '';
            grupo.sessoes.forEach((s, idx) => {
                const sEstaOnline = grupo.algumaOnline && idx === 0;
                const deviceTexto = obterIconePlataformaSaaS(s.plataforma);
                const horaEntrada = formatarHoraMinutoSaaS(s.entrada);

                let horarioRangeHtml = '';
                let duracaoItem = '';

                if (sEstaOnline) {
                    horarioRangeHtml = `${horaEntrada} ➔ <span class="sessao-status-online">● Online agora</span>`;
                    duracaoItem = formatarDuracaoSessaoSaaS(s.entrada, agora);
                } else {
                    const fimReal = s.saida || s.ultimaAtividade || s.entrada;
                    const horaSaida = formatarHoraMinutoSaaS(fimReal);
                    horarioRangeHtml = `${horaEntrada} ➔ ${horaSaida}`;
                    duracaoItem = formatarDuracaoSessaoSaaS(s.entrada, fimReal);
                }

                subLinhasHtml += `
                    <div class="sessao-sub-linha">
                        <span class="sessao-horario-range">${horarioRangeHtml}</span>
                        <div class="sessao-sub-right">
                            <span class="sessao-device-pill">${deviceTexto}</span>
                            <span class="sessao-duracao-badge ${sEstaOnline ? 'ativo' : ''}">${duracaoItem}</span>
                        </div>
                    </div>
                `;
            });

            const card = document.createElement('div');
            card.className = 'card-sessao-acesso';
            card.innerHTML = `
                <div class="sessao-card-header" onclick="this.parentElement.classList.toggle('aberto')">
                    <div class="sessao-topo-row">
                        <span class="sessao-nome-atleta">${nomeFormatado}</span>
                        <div class="tags-container-SaaS">
                            ${tagsHtml}
                            <i class="material-icons sessao-chevron">expand_more</i>
                        </div>
                    </div>
                    <div class="sessao-base-row">
                        <span class="sessao-horario-range">${resumoStatusHtml}</span>
                        <span class="sessao-duracao-badge ${grupo.algumaOnline ? 'ativo' : ''}">${resumoBadgeTxt}</span>
                    </div>
                </div>
                <div class="sessao-detalhes-drawer">
                    ${subLinhasHtml}
                </div>
            `;
            container.appendChild(card);
        });
    }).catch(() => {
        container.innerHTML = '<p class="SaaS-lista-vazia">Erro ao carregar histórico de acessos.</p>';
        if (badgeResumo) badgeResumo.textContent = 'Erro';
    });
}

// ====================================================================
// 11. MOTOR DE PUSH NOTIFICATIONS SERVERLESS (CLOUDFLARE)
// ====================================================================

/**
 * Dispara uma notificação push via Cloudflare Workers
 * @param {string} token - FCM Token do dispositivo de destino
 * @param {string} titulo - Título da notificação (com emoji)
 * @param {string} mensagem - Corpo da notificação
 * @param {object} dadosExtras - (Opcional) Dados JSON para ações no app ao clicar
 */
async function dispararPushCloudflare(token, titulo, mensagem, dadosExtras = {}, idJogador = null) {
  // Ignora o disparo se o token for falso, vazio ou o placeholder "fcm_pendente"
  if (!token || token === "fcm_pendente") {
      console.warn("FCM Token inválido ou não definido. Disparo abortado.");
      return;
  }

  const urlWorker = "https://setpoint-push.ronaldo-taborda.workers.dev/";

  const payload = {
      token: token,
      titulo: titulo,
      mensagem: mensagem,
      dados: dadosExtras
  };

  try {
      const response = await fetch(urlWorker, {
          method: "POST",
          headers: {
              "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
      });

      const result = await response.json();
      
      if (!response.ok) {
          console.error("Erro na nuvem Cloudflare:", result);

          // 🧹 AUTO-FAXINA DE TOKENS FANTASMAS: Remove do Firebase se o FCM/Apple acusar 404 (Token expirado/inválido)
          if (response.status === 404 && idJogador && typeof raizBanco !== 'undefined' && raizBanco) {
              console.warn(`🧹 [Auto-Faxina Push] Removendo token inválido (404) do atleta ${idJogador}...`);
              database.ref(`${raizBanco}/jogadores/${idJogador}/fcmTokens/${token}`).remove().catch(() => {});
              database.ref(`${raizBanco}/jogadores/${idJogador}/fcmToken`).once('value').then(snapLegacy => {
                  if (snapLegacy.val() === token) {
                      database.ref(`${raizBanco}/jogadores/${idJogador}/fcmToken`).remove().catch(() => {});
                  }
              }).catch(() => {});
          }
      } else {
          console.log("Notificação Push despachada com sucesso!", result);
      }
      
  } catch (error) {
      console.error("Falha ao comunicar com o Worker da Cloudflare:", error);
  }
}

/**
 * Localiza o atleta no banco, valida suas preferências e dispara a notificação nativa
 * @param {string} idJogador - ID único do atleta no Firebase
 * @param {string} titulo - Título do push (com emoji)
 * @param {string} mensagem - Texto da notificação
 * @param {object} dadosExtras - (Opcional) Metadados para navegação interna
 */
async function enviarPushParaAtletaSaaS(idJogador, titulo, mensagem, dadosExtras = {}) {
    if (!idJogador || !titulo || !mensagem) {
        console.warn("[Push SaaS] Parâmetros obrigatórios ausentes para o envio.");
        return;
    }

    try {
        const [snapshot, snapPresenca] = await Promise.all([
            database.ref(`${raizBanco}/jogadores/${idJogador}`).once('value'),
            database.ref(`${raizBanco}/usuariosOnline/${idJogador}`).once('value')
        ]);

        const atleta = snapshot.val();

        if (!atleta) {
            console.warn(`[Push SaaS] Atleta com ID ${idJogador} não foi localizado no banco.`);
            return;
        }

        if (atleta.receber_notificacoes === false) {
            console.log(`[Push SaaS] O atleta ${atleta.nome || atleta.nomeCompleto || idJogador} optou por silenciar notificações.`);
            return;
        }

        const carteiraTokens = atleta.fcmTokens || {};
        const tokenRetrocompativel = atleta.fcmToken || atleta.fcm_token;
        
        if (tokenRetrocompativel && tokenRetrocompativel !== "fcm_pendente") {
            carteiraTokens[tokenRetrocompativel] = true;
        }
        
        const tokensArray = Object.keys(carteiraTokens);

        if (tokensArray.length === 0) {
            console.log(`[Push SaaS] Atleta ${atleta.nome || atleta.nomeCompleto || idJogador} ainda não possui token FCM ativo.`);
            return;
        }

        // 🔕 Suprime o envio apenas para o dispositivo que já está com o app aberto e visível na tela
        const presenca = snapPresenca.val();
        const TOLERANCIA_GHOST_MS = 5 * 60 * 1000;
        const presencaAtivaValida = presenca && (!presenca.lastSeen || (Date.now() - presenca.lastSeen < TOLERANCIA_GHOST_MS));
        const tokenEmPrimeiroPlano = presencaAtivaValida ? (presenca.activePushToken || "") : "";

        if (!window.tokensPushProcessadosSaaS) window.tokensPushProcessadosSaaS = new Set();
        
        for (const tokenDestino of tokensArray) {
            if (tokenEmPrimeiroPlano && tokenDestino === tokenEmPrimeiroPlano) {
                console.log(`[Push SaaS] Disparo suprimido na origem: atleta já está com o app aberto neste aparelho.`);
                continue; 
            }

            if (!window.tokensPushProcessadosSaaS.has(tokenDestino)) {
                window.tokensPushProcessadosSaaS.add(tokenDestino);
                dispararPushCloudflare(tokenDestino, titulo, mensagem, dadosExtras, idJogador);
            }
        }

    } catch (erro) {
        console.error(`[Push SaaS] Falha ao processar push para o atleta ${idJogador}:`, erro);
    }
}

/**
 * Carteiro Central: Processa eventos do ecossistema e despacha Push Notifications.
 * @param {object} dadosReserva - O objeto oficial da reserva confirmada (com lista de jogadores e confirmacoes)
 * @param {string} organizadorFormatado - O nome do organizador já filtrado e pronto para exibição
 * @param {string} quadraAlvo - O nome da quadra (ex: "Quadra - 1" ou "Quadra 1 - Coberta")
 * @param {string} tipoEvento - Qual é o gatilho da notificação (ex: "NOVO_CONVITE")
 * @param {string} autorDaAcao - (Opcional) Nome de quem originou o evento (ex: O atleta que recusou o convite)
 */
function processarGatilhoPushSaaS(dadosReserva, organizadorFormatado, quadraAlvo, tipoEvento, autorDaAcao = "") {
    // Portaria Geral: exige apenas os dados da reserva e o cache de jogadores na memória
    if (!dadosReserva || !jogadoresGlobal) return;

    // 🛡️ Zera o filtro anti-repetição no início de cada novo bloco de eventos disparados no sistema
    window.tokensPushProcessadosSaaS = new Set();

    // Utilitários de formatação de exibição
    const txtQuadraFmt = quadraAlvo.toLowerCase().startsWith('quadra') ? quadraAlvo.toLowerCase() : `quadra ${quadraAlvo}`;
    const horaIniFmt = String(dadosReserva.hora).padStart(2, '0') + ":00";
    const diaSemanaArray = ["", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
    const diaNome = diaSemanaArray[dadosReserva.dia] || "Dia";

    // ----------------------------------------------------
    // EVENTO 1: NOVO CONVITE DE PARTIDA
    // ----------------------------------------------------
    if (tipoEvento === "NOVO_CONVITE") {
        if (!dadosReserva.confirmacoes) return; // Trava de segurança específica

        const ehRanking = (dadosReserva.isRanking === true || dadosReserva.tipo === 'ranking');
        const listaApelidos = (dadosReserva.jogadores || "").split(',').map(s => s.trim());
        const listaCompletos = (dadosReserva.jogadores_completo || "").split(',').map(s => s.trim());

        const orgBruto = (dadosReserva.organizador || organizadorFormatado || "").trim();
        const orgBrutoUp = orgBruto.toUpperCase();
        const orgPuroUp = (organizadorFormatado || "").replace(/\s*\(.*?\)\s*/g, "").trim().toUpperCase();
        const ehOperadorExterno = orgBrutoUp.includes("(GESTOR)") ||
                                  orgBrutoUp.includes("(ADMIN)") ||
                                  orgBrutoUp.includes("(ÁRBITRO)") ||
                                  orgBrutoUp.includes("(ARBITRO)") ||
                                  orgBrutoUp.includes("ADMINISTRAÇÃO") ||
                                  (!listaApelidos.some(a => a.toUpperCase() === orgPuroUp) && !listaCompletos.some(c => c.toUpperCase() === orgPuroUp));

        listaApelidos.forEach((apelidoConvidado, idx) => {
            // Se a confirmação no banco for falsa, ele é um convidado/adversário que precisa ser avisado
            if (dadosReserva.confirmacoes[apelidoConvidado] === false) {
                const apelidoUp = apelidoConvidado.toUpperCase();
                const completoUp = (listaCompletos[idx] || "").toUpperCase();

                // Localiza o ID desse jogador no banco de dados local da memória RAM
                const idConvidadoTarget = Object.keys(jogadoresGlobal).find(id => {
                    const j = jogadoresGlobal[id];
                    if (!j) return false;
                    const apDb = (j.apelido || "").toUpperCase();
                    const ncDb = (j.nomeCompleto || "").toUpperCase();
                    return apDb === apelidoUp || ncDb === apelidoUp || (completoUp !== "" && (ncDb === completoUp || apDb === completoUp));
                });

                let tituloPush = "🎾 Convite de Partida";
                let msgPush = `${organizadorFormatado} convidou você para jogar na ${diaNome} às ${horaIniFmt} (${txtQuadraFmt}). Toque para ver.`;

                if (ehRanking) {
                    if (ehOperadorExterno) {
                        const adversarioFmt = listaApelidos.find((_, i) => i !== idx) || "seu adversário";
                        tituloPush = "🏆 Partida Oficial de Ranking";
                        msgPush = `${orgBruto} agendou sua partida de Ranking contra ${adversarioFmt} na ${diaNome} às ${horaIniFmt} (${txtQuadraFmt}). Toque para confirmar.`;
                    } else {
                        tituloPush = "🏆 Desafio de Ranking";
                        msgPush = `${organizadorFormatado} desafiou você para uma partida de Ranking na ${diaNome} às ${horaIniFmt} (${txtQuadraFmt}). Toque para aceitar ou recusar.`;
                    }
                }

                // Despacha para a Cloudflare usando a função central
                if (idConvidadoTarget && typeof enviarPushParaAtletaSaaS === 'function') {
                    enviarPushParaAtletaSaaS(idConvidadoTarget, tituloPush, msgPush, { tipo: "NOVO_CONVITE" });
                }
            }
        });
    }
    
    // ----------------------------------------------------
    // EVENTO 2: RESERVA CANCELADA PELO ORGANIZADOR
    // ----------------------------------------------------
    if (tipoEvento === "RESERVA_CANCELADA_ORG") {
        if (!dadosReserva.confirmacoes) return; // Trava de segurança específica
        
        const tituloPush = "🚫 Partida Cancelada";
        const msgPush = `${organizadorFormatado} cancelou a partida de ${diaNome} às ${horaIniFmt} (${txtQuadraFmt}).`;

        const duracao = parseInt(dadosReserva.duracao) || 1;
        const horaFimFmt = String(dadosReserva.hora + duracao).padStart(2, '0') + ":00";
        const anoAtual = new Date().getFullYear();
        const strMes = String(new Date().getMonth() + 1).padStart(2, '0');
        const dataS = dadosReserva.dataCompleta || `${anoAtual}-${strMes}-${String(new Date().getDate()).padStart(2, '0')}`;
        const formatData = dataS.split('-').reverse().join('/');
        const detalheCardFmt = `A partida do dia ${formatData}, das ${horaIniFmt} às ${horaFimFmt} na ${txtQuadraFmt}, foi cancelada pelo organizador.`;
        const keyNotifCancelada = `remocao_jogador_${dadosReserva.dia}_${dadosReserva.hora}`;
        const agoraDisparo = Date.now();

        const listaApelidos = (dadosReserva.jogadores || "").split(',').map(s => s.trim());
        const orgUp = (organizadorFormatado || "").toUpperCase();

        listaApelidos.forEach(apelidoAtleta => {
            const apelidoUp = apelidoAtleta.toUpperCase();

            // Não envia notificação para o próprio organizador que executou o cancelamento
            if (apelidoUp === orgUp) return;

            // Identifica se o atleta estava confirmado na reserva
            let estavaConfirmado = (dadosReserva.confirmacoes[apelidoAtleta] === true);
            if (!estavaConfirmado) {
                Object.keys(dadosReserva.confirmacoes).forEach(k => {
                    if (k.toUpperCase() === apelidoUp && dadosReserva.confirmacoes[k] === true) {
                        estavaConfirmado = true; 
                    }
                });
            }

            if (estavaConfirmado) {
                const idTarget = Object.keys(jogadoresGlobal).find(id => {
                    const j = jogadoresGlobal[id];
                    return j && ((j.apelido || "").toUpperCase() === apelidoUp || (j.nomeCompleto || "").toUpperCase() === apelidoUp);
                });

                if (idTarget && typeof enviarPushParaAtletaSaaS === 'function') {
                    enviarPushParaAtletaSaaS(idTarget, tituloPush, msgPush, { 
                        tipo: "RESERVA_CANCELADA_ORG",
                        keyNotif: keyNotifCancelada,
                        categoria: "remocao_jogador",
                        detalhe: detalheCardFmt,
                        timestamp: String(agoraDisparo)
                    });
                }
            }
        });
    }
    
    // ----------------------------------------------------
    // EVENTO 3: CANCELAMENTO IMEDIATO POR RECUSA DE CONVITE
    // ----------------------------------------------------
    if (tipoEvento === "RESERVA_RECUSADA_QUORUM") {
        const ehRanking = (dadosReserva.isRanking === true || dadosReserva.tipo === 'ranking');
        const quemRecusouFmt = autorDaAcao || "Um jogador";
        const motivoRecusaTxt = (dadosReserva.motivoRecusaRanking || "").trim();

        const tituloPush = ehRanking ? "🏆 Desafio Recusado" : "❌ Reserva Cancelada";
        const msgPush = ehRanking
            ? `${quemRecusouFmt} recusou a partida de Ranking de ${diaNome} às ${horaIniFmt} (${txtQuadraFmt}).${motivoRecusaTxt ? ` Motivo: ${motivoRecusaTxt}.` : ""}`
            : `${quemRecusouFmt} recusou o convite. Sua partida de ${diaNome} às ${horaIniFmt} (${txtQuadraFmt}) foi cancelada por falta de quórum.`;

        const norm = (txt) => (txt || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, " ").trim().toUpperCase();
        const orgNorm = norm(organizadorFormatado || dadosReserva.organizador);

        let idDestinoTarget = Object.keys(jogadoresGlobal || {}).find(id => {
            const j = jogadoresGlobal[id];
            return j && (norm(j.nomeCompleto) === orgNorm || norm(j.apelido) === orgNorm);
        });

        // Se foi agendado pelo Gestor (sem ID de jogador), notifica o outro atleta da partida
        if (!idDestinoTarget && ehRanking) {
            const quemRecusouNorm = norm(quemRecusouFmt);
            const listaApelidos = (dadosReserva.jogadores || "").split(',').map(s => s.trim());
            const listaCompletos = (dadosReserva.jogadores_completo || "").split(',').map(s => s.trim());

            for (let i = 0; i < listaApelidos.length; i++) {
                const apNorm = norm(listaApelidos[i]);
                const compNorm = norm(listaCompletos[i]);
                if (apNorm !== quemRecusouNorm && compNorm !== quemRecusouNorm) {
                    idDestinoTarget = Object.keys(jogadoresGlobal || {}).find(id => {
                        const j = jogadoresGlobal[id];
                        return j && (norm(j.nomeCompleto) === compNorm || norm(j.apelido) === apNorm);
                    });
                    if (idDestinoTarget) break; 
                }
            }
        }

        if (idDestinoTarget && typeof enviarPushParaAtletaSaaS === 'function') {
            const duracao = parseInt(dadosReserva.duracao) || 1;
            const horaFimFmt = String(dadosReserva.hora + duracao).padStart(2, '0') + ":00";
            const diasSemanaCompleto = ["", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"];
            const diaSemanaNome = diasSemanaCompleto[dadosReserva.dia] || diaNome;
            const detalheCardFmt = `${diaSemanaNome}, das ${horaIniFmt} às ${horaFimFmt} hs, na ${txtQuadraFmt}`;
            const keyNotifRecusa = `cancelado_quorum_${dadosReserva.dia}_${dadosReserva.hora}`;
            const agoraDisparo = Date.now();

            enviarPushParaAtletaSaaS(idDestinoTarget, tituloPush, msgPush, { 
                tipo: "RESERVA_RECUSADA_QUORUM",
                keyNotif: keyNotifRecusa,
                categoria: "cancelado_quorum",
                adversario: quemRecusouFmt,
                motivoRecusa: motivoRecusaTxt,
                detalhe: detalheCardFmt,
                timestamp: String(agoraDisparo)
            });
        }
    }

    // ----------------------------------------------------
    // EVENTO 4: CANCELAMENTO AUTOMÁTICO POR TEMPO EXPIRADO (FAXINA)
    // ----------------------------------------------------
    if (tipoEvento === "RESERVA_EXPIRADA_QUORUM") {
        const tituloPush = "❌ Reserva Cancelada";
        const msgPush = `Sua partida de ${diaNome} às ${horaIniFmt} (${txtQuadraFmt}) expirou sem confirmações a tempo.`;

        const norm = (txt) => (txt || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, " ").trim().toUpperCase();
        const orgNorm = norm(organizadorFormatado || dadosReserva.organizador);

        const idOrgTarget = Object.keys(jogadoresGlobal || {}).find(id => {
            const j = jogadoresGlobal[id];
            return j && (norm(j.nomeCompleto) === orgNorm || norm(j.apelido) === orgNorm);
        });

        if (!idOrgTarget) return;

        // 🔒 TRAVA ATÔMICA COMPARTILHADA (FIREBASE) COM TTL DE 60 SEGUNDOS:
        const dataRefStr = (dadosReserva.dataCompleta || "").replace(/[^a-zA-Z0-9]/g, "");
        const quadraRefStr = (quadraAlvo || "quadra").replace(/[^a-zA-Z0-9]/g, "");
        const chaveTrava = `expira_${quadraRefStr}_${dadosReserva.dia}_${dadosReserva.hora}${dataRefStr ? '_' + dataRefStr : ''}`;
        const agoraTrava = Date.now();

        // 📦 DADOS ESTRUTURADOS DO CARD (OPÇÃO 1: CARGA INSTANTÂNEA 0MS)
        const hFimCalc = dadosReserva.hora + (dadosReserva.duracao || 1);
        const horaFimFmt = String(hFimCalc).padStart(2, '0') + ":00";
        const keyNotifExpira = `reserva_expirada_${dadosReserva.dia}_${dadosReserva.hora}`;
        const detalhePushFmt = `${diaNome}, das ${horaIniFmt} às ${horaFimFmt} hs, na ${txtQuadraFmt}`;

        database.ref(`${raizBanco}/controle_push/${chaveTrava}`).transaction((atual) => {
            if (atual && atual.timestamp && (agoraTrava - atual.timestamp < 60000)) {
                return; // Já despachado recentemente: aborta concorrência
            }
            return { despachado: true, timestamp: agoraTrava };
        }).then((result) => {
            if (result && result.committed) {
                if (typeof enviarPushParaAtletaSaaS === 'function') {
                    enviarPushParaAtletaSaaS(idOrgTarget, tituloPush, msgPush, { 
                        tipo: "RESERVA_EXPIRADA_QUORUM",
                        keyNotif: keyNotifExpira,
                        categoria: "reserva_expirada",
                        detalhe: detalhePushFmt,
                        timestamp: String(agoraTrava)
                    });
                }
            } else {
                console.log("🛑 [Push SaaS] Push de expiração barrado: outro dispositivo já realizou o envio.");
            }
        }).catch((err) => {
            console.error("Erro na trava atômica de push:", err);
        });
    }
	
	// ----------------------------------------------------
    // EVENTO 5: QUADRA INTERDITADA PARA MANUTENÇÃO
    // ----------------------------------------------------
    if (tipoEvento === "QUADRA_INTERDITADA") {
        const tituloPush = "⚠️ Quadra Interditada";
        const msgPush = `A ${quadraAlvo} foi interditada para manutenção. Seu horário de ${diaNome}, às ${horaIniFmt} foi cancelado.`;

        // 📦 DADOS ESTRUTURADOS DO CARD (OPÇÃO 1: CARGA INSTANTÂNEA 0MS)
        const keyNotifInterdita = `quadra_interditada_${dadosReserva.dia}_${dadosReserva.hora}`;
        const agoraDisparo = Date.now();

        const listaApelidos = (dadosReserva.jogadores || "").split(',').map(s => s.trim());

        listaApelidos.forEach(apelidoAtleta => {
            const apelidoUp = apelidoAtleta.toUpperCase();

            // Na interdição, a quadra fechou para todos. Notificamos todos que estavam confirmados na reserva.
            let estavaConfirmado = false;
            if (dadosReserva.confirmacoes) {
                if (dadosReserva.confirmacoes[apelidoAtleta] === true) estavaConfirmado = true;
                Object.keys(dadosReserva.confirmacoes).forEach(k => {
                    if (k.toUpperCase() === apelidoUp && dadosReserva.confirmacoes[k] === true) {
                        estavaConfirmado = true;
                    }
                });
            }

            if (estavaConfirmado) {
                const idTarget = Object.keys(jogadoresGlobal).find(id => {
                    const j = jogadoresGlobal[id];
                    return j && ((j.apelido || "").toUpperCase() === apelidoUp || (j.nomeCompleto || "").toUpperCase() === apelidoUp);
                });

                if (idTarget && typeof enviarPushParaAtletaSaaS === 'function') {
                    enviarPushParaAtletaSaaS(idTarget, tituloPush, msgPush, { 
                        tipo: "QUADRA_INTERDITADA",
                        keyNotif: keyNotifInterdita,
                        categoria: "quadra_interditada",
                        detalhe: `${diaNome}, às ${horaIniFmt}`,
                        timestamp: String(agoraDisparo)
                    });
                }
            }
        });
    }
	
	// ----------------------------------------------------
    // EVENTO 6: RESULTADO INFORMADO (SÚMULA PENDENTE)
    // ----------------------------------------------------
    if (tipoEvento === "RESULTADO_INFORMADO") {
        const tituloPush = "🏆 Resultado Informado";
        const autorNomeFmt = autorDaAcao || "Seu adversário";
        const msgPush = `${autorNomeFmt} informou o resultado da partida de Ranking. Toque para validar a súmula.`;

        const listaApelidos = (dadosReserva.jogadores || "").split(',').map(s => s.trim());
        const normAutor = autorDaAcao.trim().toUpperCase();

        listaApelidos.forEach(apelidoAtleta => {
            const apelidoUp = apelidoAtleta.toUpperCase();

            // Dispara para o adversário (ignora quem enviou a súmula)
            if (apelidoUp !== normAutor) {
                const idTarget = Object.keys(jogadoresGlobal || {}).find(id => {
                    const j = jogadoresGlobal[id];
                    return j && ((j.apelido || "").toUpperCase() === apelidoUp || (j.nomeCompleto || "").toUpperCase() === apelidoUp);
                });

                if (idTarget && typeof enviarPushParaAtletaSaaS === 'function') {
                    enviarPushParaAtletaSaaS(idTarget, tituloPush, msgPush, { tipo: "RESULTADO_INFORMADO" });
                }
            }
        });
    }
	
	// ----------------------------------------------------
    // EVENTO 7: CONVITE PARA TORNEIO (INSCRIÇÕES ABERTAS)
    // ----------------------------------------------------
    if (tipoEvento === "CONVITE_TORNEIO") {
        const tituloPush = "🏅 Inscrições Abertas";
        const nomeTorneio = autorDaAcao || "Torneio Oficial";
        const idsPendentes = Array.isArray(dadosReserva) ? dadosReserva : Object.keys(dadosReserva || {});

        // 📦 DADOS ESTRUTURADOS DO TORNEIO (CARGA INSTANTÂNEA 0MS NO APP)
        const confRanking = (typeof configRegrasGlobal !== 'undefined' && configRegrasGlobal && configRegrasGlobal.ranking) ? configRegrasGlobal.ranking : {};
        const cal = confRanking.calendario || {};

        const payloadDadosTorneio = {
            tipo: "CONVITE_TORNEIO",
            nomeTorneio: String(cal.nomeTorneio || nomeTorneio),
            formatoTorneio: String(cal.formatoTorneio || confRanking.modeloAtivo || "grupos"),
            fimInscricoes: String(cal.fimInscricoes || cal.fimInscricao || ""),
            inicioJogos: String(cal.inicioJogos || cal.inicioTorneio || cal.inicio || ""),
            fimTorneio: String(cal.fimTorneio || cal.fimPartidas || cal.fim || "")
        };

        idsPendentes.forEach(idAtleta => {
            const j = (typeof jogadoresGlobal !== 'undefined' && jogadoresGlobal) ? jogadoresGlobal[idAtleta] : null;
            if (!j) return;

            const classeAtleta = j.classe ? `Classe ${j.classe.toUpperCase().replace('CLASSE_', '').trim()}` : "sua categoria";
            const msgPush = `Você foi convidado para o ${nomeTorneio} na ${classeAtleta}. Toque para ver o convite.`;

            if (typeof enviarPushParaAtletaSaaS === 'function') {
                enviarPushParaAtletaSaaS(idAtleta, tituloPush, msgPush, payloadDadosTorneio);
            }
        });
    }

    // ----------------------------------------------------
    // EVENTO 8: PARTIDA CONFIRMADA (QUÓRUM 100% ATINGIDO)
    // ----------------------------------------------------
    if (tipoEvento === "PARTIDA_CONFIRMADA") {
        const tituloPush = "🎾 Partida Confirmada!";
        const msgPush = `Todos os jogadores confirmaram presença para a partida de ${diaNome} às ${horaIniFmt} (${txtQuadraFmt}).`;

        const norm = (txt) => (txt || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, " ").trim().toUpperCase();
        const orgLimpo = (organizadorFormatado || dadosReserva.organizador || "").replace(/\s*\(.*?\)\s*/g, "").trim();
        const orgNorm = norm(orgLimpo);

        const idOrgTarget = Object.keys(jogadoresGlobal || {}).find(id => {
            const j = jogadoresGlobal[id];
            return j && (norm(j.nomeCompleto) === orgNorm || norm(j.apelido) === orgNorm);
        });

        if (idOrgTarget && typeof enviarPushParaAtletaSaaS === 'function') {
            // 📦 DADOS ESTRUTURADOS DO CARD (CARGA INSTANTÂNEA 0MS NO APP)
            const duracao = parseInt(dadosReserva.duracao) || 1;
            const hFimCalc = dadosReserva.hora + duracao;
            const horaFimFmt = String(hFimCalc).padStart(2, '0') + ":00";
            const diasSemanaCompleto = ["", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"];
            const diaSemanaNome = diasSemanaCompleto[dadosReserva.dia] || diaNome;
            const detalhePushFmt = `${diaSemanaNome}, das ${horaIniFmt} às ${horaFimFmt} hs, na ${txtQuadraFmt}`;
            const keyNotifConfirmada = `partida_confirmada_${dadosReserva.dia}_${dadosReserva.hora}`;
            const agoraDisparo = Date.now();

            enviarPushParaAtletaSaaS(idOrgTarget, tituloPush, msgPush, { 
                tipo: "PARTIDA_CONFIRMADA",
                keyNotif: keyNotifConfirmada,
                categoria: "partida_confirmada",
                detalhe: detalhePushFmt,
                timestamp: String(agoraDisparo)
            });
        }
    }

    // ----------------------------------------------------
    // EVENTO 9: SÚMULA CONTESTADA (AUTOR E EQUIPE DE ARBITRAGEM)
    // ----------------------------------------------------
    if (tipoEvento === "SUMULA_CONTESTADA") {
        const norm = (txt) => (txt || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, " ").trim().toUpperCase();
        const quemContestouFmt = autorDaAcao || "Seu adversário";
        const contestadorNorm = norm(quemContestouFmt);
        const agoraDisparo = Date.now();

        const idContestador = contestadorNorm ? Object.keys(jogadoresGlobal || {}).find(id => {
            const j = jogadoresGlobal[id];
            return j && (norm(j.nomeCompleto) === contestadorNorm || norm(j.apelido) === contestadorNorm);
        }) : null;

        // 1. Notifica o Autor que lançou a súmula
        const autorBruto = (organizadorFormatado || dadosReserva.dadosPlacar?.autorSumula || "").replace(/\s*\(.*?\)\s*/g, "").trim();
        const autorNorm = norm(autorBruto);
        const idAutorTarget = autorNorm ? Object.keys(jogadoresGlobal || {}).find(id => {
            const j = jogadoresGlobal[id];
            return j && (norm(j.nomeCompleto) === autorNorm || norm(j.apelido) === autorNorm);
        }) : null;

        if (idAutorTarget && idAutorTarget !== idContestador && typeof enviarPushParaAtletaSaaS === 'function') {
            const tituloPushAutor = "⚠️ Placar Contestado";
            const msgPushAutor = `${quemContestouFmt} recusou o placar da partida de ${diaNome} às ${horaIniFmt} (${txtQuadraFmt}). O jogo foi encaminhado para a arbitragem.`;
            const keyNotifRecusado = `recusado_${dadosReserva.dia}_${dadosReserva.hora}`;
            const placarDetalhe = dadosReserva.dadosPlacar?.placarFormatado || `${diaNome} às ${horaIniFmt}`;

            enviarPushParaAtletaSaaS(idAutorTarget, tituloPushAutor, msgPushAutor, {
                tipo: "SUMULA_CONTESTADA_AUTOR",
                keyNotif: keyNotifRecusado,
                categoria: "recusado",
                adversario: quemContestouFmt,
                detalhe: placarDetalhe,
                timestamp: String(agoraDisparo)
            });
        }

        // 2. Notifica os Árbitros habilitados (excluindo os atletas envolvidos na partida)
        const confArbitrar = (typeof configRegrasGlobal !== 'undefined' && configRegrasGlobal?.ranking?.permiteArbitrar)
            ? configRegrasGlobal.ranking.permiteArbitrar
            : {};

        const jogadoresCompNorm = norm(dadosReserva.jogadores_completo || "");
        const jogadoresApNorm = norm(dadosReserva.jogadores || "");
        const listaApelidosMatch = (dadosReserva.jogadores || "").split(',').map(s => s.trim()).filter(Boolean);
        const confrontoTxt = listaApelidosMatch.length >= 2 ? `${listaApelidosMatch[0]} x ${listaApelidosMatch[1]}` : (dadosReserva.jogadores || "Ranking");

        const tituloPushArb = "⚖️ Súmula Contestada";
        const msgPushArb = `${quemContestouFmt} contestou o placar de ${confrontoTxt} (${diaNome} às ${horaIniFmt} • ${txtQuadraFmt}). Toque para julgar.`;

        Object.keys(jogadoresGlobal || {}).forEach(idUsuario => {
            const u = jogadoresGlobal[idUsuario];
            if (!u || u.ativo === false || !u.perfis) return;

            const temPermissaoArbitrar = (u.perfis['Árbitro'] === true || u.perfis['Arbitro'] === true) ||
                                         (confArbitrar.Admin === true && u.perfis['Admin'] === true) ||
                                         (confArbitrar.Professor === true && (u.perfis['Professor'] === true || u.perfis['Prof'] === true));

            if (!temPermissaoArbitrar) return;

            // Trava de imparcialidade: não notifica árbitro que seja um dos jogadores da partida
            const nomeU = norm(u.nomeCompleto || "");
            const apU = norm(u.apelido || "");
            const ehJogadorDaPartida = (idUsuario === idAutorTarget) ||
                                       (idUsuario === idContestador) ||
                                       (nomeU !== "" && (jogadoresCompNorm.includes(nomeU) || jogadoresApNorm.includes(nomeU))) ||
                                       (apU !== "" && (jogadoresCompNorm.includes(apU) || jogadoresApNorm.includes(apU)));

            if (!ehJogadorDaPartida && typeof enviarPushParaAtletaSaaS === 'function') {
                enviarPushParaAtletaSaaS(idUsuario, tituloPushArb, msgPushArb, {
                    tipo: "SUMULA_CONTESTADA"
                });
            }
        });
    }

    // ----------------------------------------------------
    // EVENTO 10: RESULTADO CONFIRMADO PELO ADVERSÁRIO (AUTOR)
    // ----------------------------------------------------
    if (tipoEvento === "RESULTADO_CONFIRMADO") {
        const norm = (txt) => (txt || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, " ").trim().toUpperCase();
        const quemConfirmouFmt = autorDaAcao || "O adversário";
        const confirmadorNorm = norm(quemConfirmouFmt);

        const autorBruto = (organizadorFormatado || dadosReserva.dadosPlacar?.autorSumula || "").replace(/\s*\(.*?\)\s*/g, "").trim();
        const autorNorm = norm(autorBruto);
        if (!autorNorm) return;

        const idAutorTarget = Object.keys(jogadoresGlobal || {}).find(id => {
            const j = jogadoresGlobal[id];
            return j && (norm(j.nomeCompleto) === autorNorm || norm(j.apelido) === autorNorm);
        });

        const idConfirmador = confirmadorNorm ? Object.keys(jogadoresGlobal || {}).find(id => {
            const j = jogadoresGlobal[id];
            return j && (norm(j.nomeCompleto) === confirmadorNorm || norm(j.apelido) === confirmadorNorm);
        }) : null;

        if (idAutorTarget && idAutorTarget !== idConfirmador && typeof enviarPushParaAtletaSaaS === 'function') {
            const placarTxt = dadosReserva.dadosPlacar?.placarFormatado || "";
            const tituloPush = "✅ Resultado Confirmado";
            const msgPush = `${quemConfirmouFmt} confirmou o resultado${placarTxt ? ` (${placarTxt})` : ""} da partida de ${diaNome} às ${horaIniFmt} (${txtQuadraFmt}).`;
            const keyNotifConfirmado = `confirmado_${dadosReserva.dia}_${dadosReserva.hora}`;
            const agoraDisparo = Date.now();

            enviarPushParaAtletaSaaS(idAutorTarget, tituloPush, msgPush, {
                tipo: "RESULTADO_CONFIRMADO",
                keyNotif: keyNotifConfirmado,
                categoria: "confirmado",
                adversario: quemConfirmouFmt,
                detalhe: placarTxt || `${diaNome} às ${horaIniFmt}`,
                timestamp: String(agoraDisparo)
            });
        }
    }

    // ----------------------------------------------------
    // EVENTO 11: DECISÃO DA ARBITRAGEM OU LANÇAMENTO DIRETO
    // ----------------------------------------------------
    if (tipoEvento === "FECHAMENTO_ARBITRAGEM") {
        const idJ1 = dadosReserva.idJ1;
        const idJ2 = dadosReserva.idJ2;
        if (!idJ1 || !idJ2) return;

        const catNotif = dadosReserva.categoriaNotif || "homologado_arb";
        const detalheNotif = dadosReserva.detalheNotif || "";
        const venciCod = dadosReserva.venciCod || dadosReserva.dadosPlacar?.vencedorCodigo || "";
        const responsavelFmt = autorDaAcao || organizadorFormatado || "A arbitragem";
        const agoraDisparo = Date.now();

        [idJ1, idJ2].forEach(idAtual => {
            const idAdversario = (idAtual === idJ1) ? idJ2 : idJ1;
            const atletaAdvObj = (typeof jogadoresGlobal !== 'undefined' && jogadoresGlobal[idAdversario]) ? jogadoresGlobal[idAdversario] : {};
            const nomeAdv = atletaAdvObj.apelido || atletaAdvObj.nomeCompleto || "seu adversário";
            const ehVitoria = (venciCod === 'J1' && idAtual === idJ1) || (venciCod === 'J2' && idAtual === idJ2);

            let tituloPush = "🏆 Resultado Registrado";
            let msgPush = "";

            if (catNotif === "homologado_arb") {
                tituloPush = "⚖️ Placar Homologado";
                msgPush = `${responsavelFmt} analisou a contestação e manteve o placar${detalheNotif ? ` (${detalheNotif})` : ""} da partida de ${diaNome} às ${horaIniFmt} (${txtQuadraFmt}).`;
            } else if (catNotif === "ajustado_arb") {
                tituloPush = "⚖️ Placar Ajustado";
                msgPush = `${responsavelFmt} analisou a contestação e ajustou o placar${detalheNotif ? ` para ${detalheNotif}` : ""} na partida de ${diaNome} às ${horaIniFmt} (${txtQuadraFmt}).`;
            } else if (catNotif === "anulado_arb") {
                tituloPush = "🔴 Súmula Anulada";
                msgPush = `${responsavelFmt} anulou a partida de Ranking de ${diaNome} às ${horaIniFmt} (${txtQuadraFmt}).${detalheNotif ? ` Motivo: ${detalheNotif}` : ""}`;
            } else {
                const termoRes = venciCod ? (ehVitoria ? "sua vitória" : "sua derrota") : "a partida";
                msgPush = `${responsavelFmt} registrou ${termoRes} contra ${nomeAdv}${detalheNotif ? `: ${detalheNotif}` : ""} (${diaNome} às ${horaIniFmt}).`;
            }

            if (typeof enviarPushParaAtletaSaaS === 'function') {
                enviarPushParaAtletaSaaS(idAtual, tituloPush, msgPush, {
                    tipo: "FECHAMENTO_ARBITRAGEM",
                    keyNotif: `${catNotif}_${dadosReserva.dia}_${dadosReserva.hora}`,
                    categoria: catNotif,
                    adversario: responsavelFmt,
                    nomeAdversarioPartida: nomeAdv,
                    ehVitoria: String(ehVitoria),
                    detalhe: detalheNotif || `${diaNome} às ${horaIniFmt}`,
                    timestamp: String(agoraDisparo)
                });
            }
        });
    }

    // ----------------------------------------------------
    // EVENTO 12: AUTO-HOMOLOGAÇÃO POR DECURSO DE PRAZO (FAXINA)
    // ----------------------------------------------------
    if (tipoEvento === "AUTO_HOMOLOGACAO") {
        const idJ1 = dadosReserva.idJ1;
        const idJ2 = dadosReserva.idJ2;
        if (!idJ1 || !idJ2) return;

        const placarTxt = dadosReserva.dadosPlacar?.placarFormatado || "";
        const prazoHoras = dadosReserva.prazoAutoHoras || dadosReserva.dadosPlacar?.prazoAutoHoras || 48;

        // 🔒 Trava atômica compartilhada no Firebase (TTL 60s) para evitar disparo duplicado entre aparelhos
        const dataRefStr = (dadosReserva.dataCompleta || "").replace(/[^a-zA-Z0-9]/g, "");
        const quadraRefStr = (quadraAlvo || "quadra").replace(/[^a-zA-Z0-9]/g, "");
        const chaveTrava = `autohomolog_${quadraRefStr}_${dadosReserva.dia}_${dadosReserva.hora}${dataRefStr ? '_' + dataRefStr : ''}`;
        const agoraTrava = Date.now();

        database.ref(`${raizBanco}/controle_push/${chaveTrava}`).transaction((atual) => {
            if (atual && atual.timestamp && (agoraTrava - atual.timestamp < 60000)) {
                return; // Outro aparelho já despachou recentemente
            }
            return { despachado: true, timestamp: agoraTrava };
        }).then((result) => {
            if (result && result.committed) {
                window.tokensPushProcessadosSaaS = new Set();
                const tituloPush = "⏱️ Placar Auto-Homologado";
                const msgPush = `O prazo de ${prazoHoras}h expirou sem contestação e o placar${placarTxt ? ` (${placarTxt})` : ""} da partida de ${diaNome} às ${horaIniFmt} (${txtQuadraFmt}) foi confirmado automaticamente.`;
                const keyNotifAuto = `auto_homologado_${dadosReserva.dia}_${dadosReserva.hora}`;

                [idJ1, idJ2].forEach(idAtual => {
                    if (typeof enviarPushParaAtletaSaaS === 'function') {
                        enviarPushParaAtletaSaaS(idAtual, tituloPush, msgPush, {
                            tipo: "AUTO_HOMOLOGACAO",
                            keyNotif: keyNotifAuto,
                            categoria: "auto_homologado",
                            prazoHoras: String(prazoHoras),
                            detalhe: placarTxt || `${diaNome} às ${horaIniFmt}`,
                            timestamp: String(agoraTrava)
                        });
                    }
                });
            }
        }).catch((err) => {
            console.error("Erro na trava atômica de push da auto-homologação:", err);
        });
    }

    // ----------------------------------------------------
    // EVENTO 13: LIBERAÇÃO DAS TABELAS / INÍCIO DA TEMPORADA
    // ----------------------------------------------------
    if (tipoEvento === "INICIO_TEMPORADA") {
        const tituloPush = "🏆 A temporada começou!";
        const nomeTorneio = autorDaAcao || "Torneio Oficial";
        const msgPush = `Tabelas do ${nomeTorneio} liberadas. Toque para ver e agendar sua partida.`;
        const detalheCard = `Tabelas do ${nomeTorneio} liberadas.\nAgende sua partida no app.`;
        const idsInscritos = Array.isArray(dadosReserva) ? dadosReserva : Object.keys(dadosReserva || {});
        const agoraDisparo = Date.now();

        idsInscritos.forEach(idAtleta => {
            const j = (typeof jogadoresGlobal !== 'undefined' && jogadoresGlobal) ? jogadoresGlobal[idAtleta] : null;
            if (!j) return;

            if (typeof enviarPushParaAtletaSaaS === 'function') {
                enviarPushParaAtletaSaaS(idAtleta, tituloPush, msgPush, {
                    tipo: "INICIO_TEMPORADA",
                    keyNotif: `inicio_temporada_${agoraDisparo}`,
                    categoria: "inicio_temporada",
                    titulo: "A temporada começou!", 
                    detalhe: detalheCard,
                    timestamp: String(agoraDisparo)
                });
            }
        });
    }
	
}

// ========================================================
// 12. CENTRAL DE BAIXAS: POPOVER TOPO (TAXAS DE CONVIDADOS)
// ========================================================

let intervaloTimerBaixasSaaS = null;

/**
 * Atualiza a visibilidade dos botões $ e a contagem de taxas pendentes
 * (Sincronizado tanto no Dashboard do Gestor quanto na Visão das Quadras)
 */
function atualizarBadgeBaixasSaaS(todasAsReservasParam) {
    const btnContainer = document.getElementById('container-btn-baixas');
    const badgeContador = document.getElementById('badge-baixas-contador');
    const btnContainerDash = document.getElementById('container-btn-baixas-dash');
    const badgeContadorDash = document.getElementById('badge-baixas-contador-dash');

    // 1. Portaria: Visível exclusivamente para o Gestor Mestre ou God Mode
    const isGodMode = !!localStorage.getItem('god_mode_clube');
    const temPermissao = (typeof isGestorLogado !== 'undefined' && isGestorLogado) || isGodMode;

    if (!temPermissao) {
        if (btnContainer) btnContainer.style.display = 'none';
        if (btnContainerDash) btnContainerDash.style.display = 'none';
        fecharPopoverBaixasSaaS();
        return;
    }

    // Exibe os botões para quem tem permissão
    if (btnContainer) btnContainer.style.display = 'inline-flex';
    if (btnContainerDash) btnContainerDash.style.display = 'inline-flex';

    // 2. Identificação das reservas com convidados pendentes
    const fonteReservas = todasAsReservasParam || (typeof reservasGeralGlobal !== 'undefined' ? reservasGeralGlobal : reservasLocaisCache) || {};
    const pendencias = obterListaReservasComConvidadosPendentesSaaS(fonteReservas);

    const total = pendencias.length;

    // Atualiza o crachá na Visão das Quadras
    if (badgeContador) {
        badgeContador.textContent = String(total);
        badgeContador.style.display = total > 0 ? 'flex' : 'none';
    }

    // Atualiza o crachá no Dashboard do Gestor
    if (badgeContadorDash) {
        badgeContadorDash.textContent = String(total);
        badgeContadorDash.style.display = total > 0 ? 'flex' : 'none';
    }

    // Se o Popover estiver aberto na tela, repinta a lista em tempo real
    const popover = document.getElementById('popover-central-baixas');
    if (popover && popover.style.display === 'flex') {
        renderizarListaBaixasPopoverSaaS(pendencias);
    }
}

/**
 * Varre a matriz de reservas e retorna os itens elegíveis para baixa financeira
 */
function obterListaReservasComConvidadosPendentesSaaS(todasAsReservas) {
    const lista = [];
    const agora = Date.now();

    Object.keys(todasAsReservas || {}).forEach(quadraKey => {
        const slots = todasAsReservas[quadraKey] || {};
        Object.keys(slots).forEach(slotKey => {
            const r = slots[slotKey];
            if (!r || r.status === 'aula_cancelada') return;
            if (r.borda === undefined && parseInt(r.duracao) === 2) return; // Evita duplicidade no bloco de 2h

            const stringJogadores = (r.jogadores_completo || r.jogadores || '').toLowerCase();
            const temConvidadoNaLista = stringJogadores.includes('convidado');

            if (!temConvidadoNaLista) return;

            // Filtro rigoroso: mapeia estritamente os convidados cujo statusTaxa ainda não seja 'pago'
            const dadosC = r.dadosConvidados || {};
            const confs = r.confirmacoes || {};
            const pendentesNomes = [];

            if (Object.keys(dadosC).length > 0) {
                Object.keys(dadosC).forEach(cNome => {
                    if (dadosC[cNome].statusTaxa !== 'pago') {
                        pendentesNomes.push(cNome);
                    }
                });
            } else {
                // Fallback para reservas legadas que não tenham o nó dadosConvidados
                Object.keys(confs).forEach(nome => {
                    if (confs[nome] === false && nome.toLowerCase().includes('convidado')) {
                        pendentesNomes.push(nome);
                    }
                });
            }

            const qtdPendentes = pendentesNomes.length;

            // Só entra na lista do gestor se houver convidados com taxa pendente dentro do prazo
            if (qtdPendentes > 0 && r.expiraEm && r.expiraEm > agora) {
                lista.push({
                    quadraKey: quadraKey,
                    slotKey: slotKey,
                    dados: r,
                    qtdConvidados: qtdPendentes,
                    convidadosPendentes: pendentesNomes
                });
            }
        });
    });

    // Ordenação por tempo restante de expiração (os mais urgentes no topo)
    lista.sort((a, b) => (a.dados.expiraEm || 0) - (b.dados.expiraEm || 0));
    return lista;
}

/**
 * Alterna a exibição do balão Popover da Central de Baixas
 */
function alternarPopoverBaixasSaaS() {
    const popover = document.getElementById('popover-central-baixas');
    if (!popover) return;

    if (popover.style.display === 'flex') {
        fecharPopoverBaixasSaaS();
    } else {
        if (navigator.vibrate) navigator.vibrate(25);
        popover.style.display = 'flex';
        renderizarListaBaixasPopoverSaaS();
    }
}

/**
 * Fecha o balão Popover
 */
function fecharPopoverBaixasSaaS() {
    const popover = document.getElementById('popover-central-baixas');
    if (popover) popover.style.display = 'none';

    if (intervaloTimerBaixasSaaS) {
        clearInterval(intervaloTimerBaixasSaaS);
        intervaloTimerBaixasSaaS = null;
    }
}

/**
 * Renderiza os cartões de confirmação de taxa dentro do Popover
 */
function renderizarListaBaixasPopoverSaaS(listaItensParam) {
    const container = document.getElementById('lista-baixas-popover');
    if (!container) return;

    const fonte = (typeof reservasGeralGlobal !== 'undefined' ? reservasGeralGlobal : reservasLocaisCache) || {};
    const itens = listaItensParam || obterListaReservasComConvidadosPendentesSaaS(fonte);

    if (itens.length === 0) {
        container.innerHTML = '<div class="baixas-vazio">Nenhuma taxa de convidado pendente.</div>';
        if (intervaloTimerBaixasSaaS) {
            clearInterval(intervaloTimerBaixasSaaS);
            intervaloTimerBaixasSaaS = null;
        }
        return;
    }

    const diasCurto = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    let html = '';

    itens.forEach(item => {
        const r = item.dados;
        const duracao = parseInt(r.duracao) || 1;

        // Formatação da data
        let dataTexto = '';
        if (r.dataCompleta) {
            const partes = r.dataCompleta.split('-');
            if (partes.length === 3) {
                const dt = new Date(parseInt(partes[0]), parseInt(partes[1]) - 1, parseInt(partes[2]));
                dataTexto = `${diasCurto[dt.getDay()]}, ${partes[2]}/${partes[1]}`;
            }
        }

        const hIni = String(r.hora).padStart(2, '0') + ':00';
        const hFim = String(r.hora + duracao).padStart(2, '0') + ':00';

        // Nome da quadra amigável
        let nomeQuadra = item.quadraKey;
        const numQ = item.quadraKey.match(/\d+/);
        if (numQ && typeof configQuadrasGlobal !== 'undefined' && configQuadrasGlobal.nomes) {
            const dq = configQuadrasGlobal.nomes[numQ[0]];
            if (dq) nomeQuadra = typeof dq === 'object' ? (dq.nome || `Quadra ${numQ[0]}`) : dq;
        }

        // Cálculo da taxa unitária e multiplicativa
        let taxaUnitStr = '0,00';
        if (numQ && typeof configConvidadosGlobal !== 'undefined' && configConvidadosGlobal[`Quadra${numQ[0]}`]?.Taxa) {
            taxaUnitStr = configConvidadosGlobal[`Quadra${numQ[0]}`].Taxa;
        } else if (typeof configConvidadosGlobal !== 'undefined' && configConvidadosGlobal?.Taxa) {
            taxaUnitStr = configConvidadosGlobal.Taxa; 
        }

        const taxaUnitNum = parseFloat(taxaUnitStr.replace(/\./g, '').replace(',', '.')) || 0;
        const taxaTotalNum = taxaUnitNum * item.qtdConvidados;
        const taxaTotalFmt = taxaTotalNum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        const rotuloValorTop = `R$ ${taxaTotalFmt}`;

        const orgNomeExibicao = r.organizador ? r.organizador.replace(/\s*\(.*?\)\s*/g, '').trim().toUpperCase() : 'ORGANIZADOR';
        const rotuloConvidado = item.qtdConvidados > 1 ? "Convidados:" : "Convidado:";

        // Montagem da Lista de Checkboxes (apenas convidados com taxa pendente)
        let listaConvidadosHtml = '';
        const convidadosChaves = item.convidadosPendentes || Object.keys(r.dadosConvidados || {});
        
        if (convidadosChaves.length === 0) {
            listaConvidadosHtml = `
                <label class="check-row">
                    <input type="checkbox">
                    <div style="display: flex; justify-content: space-between; width: 100%;">
                        <span class="texto-convidado-baixa">Convidado Avulso</span>
                        <span style="font-size: 13px; font-weight: 700; color: #475569;">R$ ${taxaUnitStr}</span>
                    </div>
                </label>
            `;
        } else {
            convidadosChaves.forEach(c => {
                const nomeBruto = r.dadosConvidados[c].nomeCompleto || c;
                const nomeTitleCase = nomeBruto.toLowerCase().replace(/(?:^|\s)\S/g, a => a.toUpperCase());
                
                listaConvidadosHtml += `
                    <label class="check-row">
                        <input type="checkbox" data-nome="${c}">
                        <div style="display: flex; justify-content: space-between; width: 100%;">
                            <span class="texto-convidado-baixa">${nomeTitleCase}</span>
                            <span style="font-size: 13px; font-weight: 700; color: #475569;">R$ ${taxaUnitStr}</span>
                        </div>
                    </label>
                `;
            });
        }

        const nomeUnicoConvidado = convidadosChaves.length > 0 
            ? ((r.dadosConvidados && r.dadosConvidados[convidadosChaves[0]] && r.dadosConvidados[convidadosChaves[0]].nomeCompleto) || convidadosChaves[0]).toLowerCase().replace(/(?:^|\s)\S/g, a => a.toUpperCase()) 
            : 'Convidado Avulso';

        html += `
            <div class="card-baixa-item" id="card-baixa-${item.quadraKey}-${item.slotKey}" style="border: none !important; padding: 0 !important; background: transparent !important; box-shadow: none !important;">
                <fieldset class="prompt-saas-fieldset" style="margin: 0 0 10px 0; padding: 12px 14px; text-align: left; background-color: #ffffff;">
                    <legend class="prompt-saas-legend">${nomeQuadra}</legend>
                    
                    <div class="conteudo-interno-caixa">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                            <div style="display: flex; flex-direction: column;">
                                ${item.qtdConvidados === 1 ? `
                                <div class="texto-convidado-baixa">
                                    <span class="rotulo-convidado">${rotuloConvidado}</span> ${nomeUnicoConvidado}
                                </div>
                                ` : ''}
                                <div class="texto-org-baixa" style="${item.qtdConvidados > 1 ? 'margin-bottom: 4px;' : 'margin-top: 2px;'}">
                                    Org: <b>${orgNomeExibicao}</b>
                                </div>
                                ${item.qtdConvidados > 1 ? `
                                <div class="texto-data-baixa">
                                    ${dataTexto} • ${hIni} - ${hFim}
                                </div>
                                ` : ''}
                            </div>
                            
                            <div class="coluna-direita-baixa">
                                <span class="baixa-valor-tag">${rotuloValorTop}</span>
                                <span class="baixa-timer-tag">
                                    <i class="material-icons" style="font-size: 13px;">timer</i>
                                    <span class="timer-baixa-item" data-expira="${r.expiraEm}">--:--</span>
                                </span>
                            </div>
                        </div>

                        ${item.qtdConvidados === 1 ? `
                        <div class="linha-divisoria-baixa">
                            <div class="texto-data-baixa">
                                ${dataTexto} • ${hIni} - ${hFim}
                            </div>
                            <div></div>
                        </div>
                        ` : ''}

                        ${item.qtdConvidados > 1 ? `<div class="linha-divisoria-baixa" style="padding-top: 8px; margin-top: 8px;"></div><div class="texto-org-baixa" style="color: #1e293b;">Selecione os pagamentos recebidos:</div>` : ''}

                        <div class="check-list-container" id="check-list-${item.quadraKey}-${item.slotKey}" ${item.qtdConvidados === 1 ? 'style="display:none;"' : ''}>
                            ${listaConvidadosHtml}
                        </div>
                    </div>
                </fieldset>
                
                <div class="baixa-botoes-grupo" style="margin-top: 0;">
                    <button type="button" class="btn-baixa-acao btn-baixa-confirmar btn-full" style="${item.qtdConvidados > 1 ? 'opacity: 0.5; pointer-events: none;' : ''}" onclick="confirmarBaixaTaxaConvidadoSaaS('${item.quadraKey}', '${item.slotKey}')">
                        <i class="material-icons" style="font-size: 16px;">${item.qtdConvidados > 1 ? 'playlist_add_check' : 'check'}</i> <span id="lbl-btn-confirma-${item.quadraKey}-${item.slotKey}">${item.qtdConvidados > 1 ? 'Selecione ao menos 1' : 'Confirmar Pagamento'}</span>
                    </button>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
    iniciarContadorRegressivoBaixasSaaS();

    // 🧠 Lógica Reativa: Atualiza o botão conforme os checkboxes marcados
    itens.forEach(item => {
        if (item.qtdConvidados <= 1) return;
        
        const checkContainer = document.getElementById(`check-list-${item.quadraKey}-${item.slotKey}`);
        const btnLbl = document.getElementById(`lbl-btn-confirma-${item.quadraKey}-${item.slotKey}`);
        
        if (checkContainer && btnLbl) {
            const checkboxes = checkContainer.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(chk => {
                chk.addEventListener('change', () => {
                    const marcados = checkContainer.querySelectorAll('input[type="checkbox"]:checked').length;
                    
                    if (marcados === 0) {
                        btnLbl.textContent = 'Selecione ao menos 1';
                        btnLbl.parentElement.style.opacity = '0.5';
                        btnLbl.parentElement.style.pointerEvents = 'none';
                    } else {
                        btnLbl.textContent = `Confirmar (${marcados})`;
                        btnLbl.parentElement.style.opacity = '1';
                        btnLbl.parentElement.style.pointerEvents = 'auto';
                    }
                });
            });
        }
    });
}

/**
 * Atualiza o cronômetro de expiração de cada item no Popover
 */
function iniciarContadorRegressivoBaixasSaaS() {
    if (intervaloTimerBaixasSaaS) clearInterval(intervaloTimerBaixasSaaS);

    const atualizar = () => {
        const agora = Date.now();
        const timers = document.querySelectorAll('.timer-baixa-item');

        timers.forEach(t => {
            const expiraEm = parseInt(t.getAttribute('data-expira'), 10) || 0;
            const diff = expiraEm - agora;

            if (diff <= 0) {
                t.textContent = 'Expirado';
                const card = t.closest('.card-baixa-item');
                if (card) card.style.opacity = '0.5';
            } else {
                const horas = Math.floor(diff / (1000 * 60 * 60));
                const minutos = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const segundos = Math.floor((diff % (1000 * 60)) / 1000);

                t.textContent = `${String(horas).padStart(2, '0')}h ${String(minutos).padStart(2, '0')}m ${String(segundos).padStart(2, '0')}s`;
            }
        });
    };

    atualizar();
    intervaloTimerBaixasSaaS = setInterval(atualizar, 1000);
}

/**
 * Dá baixa financeira nos convidados selecionados (Múltiplos ou Único)
 */
function confirmarBaixaTaxaConvidadoSaaS(quadraKey, slotKey) {
    if (navigator.vibrate) navigator.vibrate(30);

    // 1. Identifica quem o gestor selecionou no HTML
    const checkContainer = document.getElementById(`check-list-${quadraKey}-${slotKey}`);
    const nomesConfirmadosPelaUI = [];
    
    if (checkContainer && checkContainer.style.display !== 'none') {
        const checkboxesMarcados = checkContainer.querySelectorAll('input[type="checkbox"]:checked');
        checkboxesMarcados.forEach(chk => {
            if (chk.dataset.nome) nomesConfirmadosPelaUI.push(chk.dataset.nome.toLowerCase());
        });
    }

    const path1 = `${raizBanco}/reservas/${quadraKey}/${slotKey}`;

    database.ref(path1).transaction(reserva => {
        if (!reserva) return null;

        const confs = reserva.confirmacoes || {};
        const dadosC = reserva.dadosConvidados || {};
        let mudou = false;

        // Se for card de 1 convidado (caixas ocultas), aprova o convidado pendente
        const aprovarTodos = nomesConfirmadosPelaUI.length === 0;

        // Atualiza statusTaxa nos dadosConvidados
        Object.keys(dadosC).forEach(cNome => {
            if (dadosC[cNome].statusTaxa !== 'pago') {
                if (aprovarTodos || nomesConfirmadosPelaUI.includes(cNome.trim().toLowerCase())) {
                    dadosC[cNome].statusTaxa = 'pago';
                    mudou = true;
                }
            }
        });

        // Atualiza confirmações nominais caso existam
        Object.keys(confs).forEach(nome => {
            const chaveConvidado = Object.keys(dadosC).find(k => k.trim().toLowerCase() === nome.trim().toLowerCase());
            if (chaveConvidado && dadosC[chaveConvidado].statusTaxa === 'pago') {
                if (confs[nome] === false) {
                    confs[nome] = true;
                    mudou = true;
                }
            } else if (!chaveConvidado && nome.toLowerCase().includes('convidado') && aprovarTodos) {
                if (confs[nome] === false) {
                    confs[nome] = true;
                    mudou = true;
                }
            }
        });

        // Se todos os convidados em dadosConvidados estão pagos:
        const todosConvidadosPagos = Object.keys(dadosC).length === 0 || 
            Object.values(dadosC).every(g => g.statusTaxa === 'pago');

        if (todosConvidadosPagos) {
            Object.keys(confs).forEach(k => {
                if (k.toLowerCase().includes('convidado') && confs[k] === false) {
                    confs[k] = true;
                    mudou = true;
                }
            });
        }

        if (!mudou) return reserva;

        reserva.confirmacoes = confs;
        reserva.dadosConvidados = dadosC;

        // Verifica se todas as pendências da reserva foram sanadas
        const todasConfirmadas = Object.values(confs).every(v => v === true) && todosConvidadosPagos;

        if (todasConfirmadas) {
            if (reserva.status === 'pendente') {
                reserva.acabouDeConfirmarPorBaixa = true;
            }
            reserva.status = 'confirmada';
            delete reserva.expiraEm;
        }

        return reserva;
    }).then(res => {
        if (!res.committed) return;

        const rAtualizada = res.snapshot.val();
        if (rAtualizada && parseInt(rAtualizada.duracao) === 2) {
            const partes = slotKey.split('_');
            const proxSlot = `${partes[0]}_${parseInt(partes[1], 10) + 1}`;
            const path2 = `${raizBanco}/reservas/${quadraKey}/${proxSlot}`;

            const r2 = JSON.parse(JSON.stringify(rAtualizada));
            r2.hora = parseInt(partes[1], 10) + 1;
            delete r2.borda;

            database.ref(path2).set(r2);
        }

        // 🛡️ Auditoria: Gera o recibo no GitHub
        if (rAtualizada) {
            const autorLogado = (typeof isGestorLogado !== 'undefined' && isGestorLogado) ? "Administração (Gestor)" : (localStorage.getItem('jogadorLogadoNome') || "Sócio");
            const duracao = parseInt(rAtualizada.duracao) || 1;
            
            let nomeQuadraAmigavel = quadraKey;
            const numQ = quadraKey.match(/\d+/);
            if (numQ && typeof configQuadrasGlobal !== 'undefined' && configQuadrasGlobal.nomes) {
                const dq = configQuadrasGlobal.nomes[numQ[0]];
                if (dq) nomeQuadraAmigavel = typeof dq === 'object' ? (dq.nome || `Quadra ${numQ[0]}`) : dq;
            }

            const logConfirmacao = {
                origem: "manual",
                timestamp: new Date().toISOString(),
                dataLocal: new Date().toLocaleString('pt-BR'),
                autor: autorLogado,
                acao: "CONFIRMACAO_TAXA_CONVIDADO",
                motivo: `A taxa de convidado foi confirmada pela administração.`,
                clube: typeof clubeAtivoId !== 'undefined' ? clubeAtivoId : "",
                quadra: nomeQuadraAmigavel,
                horario: `${String(rAtualizada.hora).padStart(2, '0')}:00 - ${String(rAtualizada.hora + duracao).padStart(2, '0')}:00`,
                duracao: duracao === 1 ? "1 Hora" : "2 Horas",
                data: rAtualizada.dataCompleta ? rAtualizada.dataCompleta.split('-').reverse().join('-') : "",
                statusNoMomentoDaExclusao: rAtualizada.status || "confirmada",
                organizadorDaReserva: rAtualizada.organizador || "Não Informado",
                confirmacoes: rAtualizada.confirmacoes || {},
                jogadores: rAtualizada.jogadores || "",
                jogadores_completo: rAtualizada.jogadores_completo || "",
                slotsExcluidos: []
            };

            if (typeof enviarFilaLogsAoGitHubSaaS === 'function') {
                enviarFilaLogsAoGitHubSaaS([logConfirmacao]);
            }

            // 🔔 NOTIFICAÇÃO NO APP E PUSH PARA O ORGANIZADOR AO SANAR ÚLTIMA PENDÊNCIA
            if (rAtualizada.acabouDeConfirmarPorBaixa && rAtualizada.organizador) {
                // Remove a flag temporária do banco
                database.ref(`${path1}/acabouDeConfirmarPorBaixa`).remove();

                const norm = (txt) => (txt || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, " ").trim().toUpperCase();
                const orgLimpo = (rAtualizada.organizador || "").replace(/\s*\(.*?\)\s*/g, "").trim();
                const orgNorm = norm(orgLimpo);

                const idOrgTarget = Object.keys(jogadoresGlobal || {}).find(id => {
                    const j = jogadoresGlobal[id];
                    return j && (norm(j.nomeCompleto) === orgNorm || norm(j.apelido) === orgNorm);
                });

                if (idOrgTarget) {
                    const diasSemana = ["", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"];
                    const nomeDia = diasSemana[rAtualizada.dia] || "Dia";
                    const hInicio = String(rAtualizada.hora).padStart(2, '0') + ":00";
                    const hFim = String(rAtualizada.hora + duracao).padStart(2, '0') + ":00";
                    const quadraTexto = nomeQuadraAmigavel.toLowerCase().startsWith('quadra') ? nomeQuadraAmigavel.toLowerCase() : `quadra ${nomeQuadraAmigavel}`;
                    const detalheFormatado = `${nomeDia}, das ${hInicio} às ${hFim} hs, na ${quadraTexto}`;

                    // 1. Notificação interna do app (Sininho)
                    const payloadNotif = {
                        categoria: "partida_confirmada",
                        detalhe: detalheFormatado,
                        timestamp: Date.now()
                    };
                    database.ref(`${raizBanco}/jogadores/${idOrgTarget}/notificacoes`).push(payloadNotif);

                    // 2. Notificação Push Nativa (FCM)
                    if (typeof processarGatilhoPushSaaS === 'function') {
                        processarGatilhoPushSaaS(rAtualizada, orgLimpo, nomeQuadraAmigavel, "PARTIDA_CONFIRMADA");
                    }
                }
            }
        }

        showToast('Taxa confirmada com sucesso!', 'success');
        atualizarBadgeBaixasSaaS();
    }).catch(err => {
        console.error('Erro ao dar baixa na taxa:', err);
        showToast('Erro ao confirmar taxa no banco.', 'error');
    });
}

/**
 * Rejeita o convidado pendente e cancela a reserva se o quórum for violado
 */
function recusarBaixaTaxaConvidadoSaaS(quadraKey, slotKey) {
    if (navigator.vibrate) navigator.vibrate(25);

    const path = `${raizBanco}/reservas/${quadraKey}/${slotKey}`;

    database.ref(path).once('value').then(snap => {
        const r = snap.val();
        if (!r) return;

        showPrompt(
            'Recusar Convidado?',
            'Tem certeza de que deseja rejeitar a taxa deste convidado? Se o quórum mínimo for insuficiente, a reserva será cancelada.',
            () => {
                const partes = slotKey.split('_');
                const dia = parseInt(partes[0], 10);
                const hora = parseInt(partes[1], 10);
                const duracao = parseInt(r.duracao) || 1;

                const slotsExcluidos = [{ quadra: quadraKey, dia: dia, hora: hora }];
                if (duracao === 2) {
                    slotsExcluidos.push({ quadra: quadraKey, dia: dia, hora: hora + 1 });
                }

                if (typeof executarPipelineExclusaoSaaS === 'function') {
                    executarPipelineExclusaoSaaS(
                        slotsExcluidos,
                        r,
                        'Taxa de convidado recusada pela administração',
                        'Reserva cancelada devido à recusa do convidado.',
                        'warning'
                    );
                }

                atualizarBadgeBaixasSaaS();
            }
        );
    });
}

// Fechamento automático do Popover ao clicar fora
document.addEventListener('click', e => {
    const popover = document.getElementById('popover-central-baixas');
    const btn = document.getElementById('container-btn-baixas');
    const btnDash = document.getElementById('container-btn-baixas-dash');
    if (!popover || popover.style.display !== 'flex') return;

    if (!popover.contains(e.target) && !btn?.contains(e.target) && !btnDash?.contains(e.target)) {
        fecharPopoverBaixasSaaS();
    }
});

// Auto-arranque do Radar de Baixas
setInterval(() => {
    if (typeof raizBanco !== 'undefined' && raizBanco && !window.radarBaixasAtivo) {
        window.radarBaixasAtivo = true;
        database.ref(`${raizBanco}/reservas`).on('value', snap => {
            atualizarBadgeBaixasSaaS(snap.val() || {});
        });
    }
}, 1000);