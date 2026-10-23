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

    // 🧹 0. DESARMA OS ALARMES ANTIGOS ANTES DE REPINTAR A TELA
    if (typeof limparAlarmesInvisiveisSaaS === 'function') {
        limparAlarmesInvisiveisSaaS();
    }

    // 2. DISPAROS EM CADEIA DE RESPONSABILIDADE ÚNICA (Modulares)
    limparGridEAplicarGradesFixas(configAula, configDupla);
    plotarReservasAtivas(reservas);
    aplicarValidacoesETempoReal();

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
function limparGridEAplicarGradesFixas(configAula, configDupla) {
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
            const nomeStr = nomeBruto.trim();
            const nomeUpper = nomeStr.toUpperCase();
            
            if (nomeUpper === 'AULA' || nomeUpper === 'DUPLA') return nomeStr;

            let classes = [];

            if (index === 0) {
                classes.push("nome-organizador-grade");
            }
            
            let isPendente = false;
            Object.keys(confs).forEach(k => {
                if (confs[k] === false && k.toUpperCase() === nomeUpper) {
                    isPendente = true;
                }
            });

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
                    }
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
                badgeStatusHtml = `<span style="font-size: 9.5px; font-weight: 800; color: #d97706; background: #fef3c7; border: 1px solid #fde68a; padding: 2px 6px; border-radius: 6px;">Pendente</span>`;
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
            setTimeout(() => window.location.href = window.location.pathname, 500); 
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
    
    // 2. Tenta salvar na Nuvem (Firebase) se o atleta estiver logado
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
// 10. MOTOR DE PRESENÇA ONLINE GAVETA MATTE
// ====================================================================
function abrirJanelaOnlineSaaS() {
    document.getElementById('modal-online-SaaS').style.display = 'flex';
    renderizarListaUsuariosOnlineSaaS();
}

function fecharJanelaOnlineSaaS(event) {
    const overlay = document.getElementById('modal-online-SaaS');
    if (event && event.target !== overlay) return; 
    overlay.style.display = 'none';
}

function renderizarListaUsuariosOnlineSaaS() {
    const container = document.getElementById('lista-online-SaaS');
    if (!container) return;
    container.innerHTML = ''; 

    const chavesOnline = Object.keys(saasUsuariosOnlineCache || {});
    const agora = Date.now();
    const TOLERANCIA_GHOST_MS = 5 * 60 * 1000;

    const filtrados = chavesOnline.filter(key => {
        const usr = saasUsuariosOnlineCache[key];
        if (key === 'GESTOR' || usr.isGestor) return false;
        if (usr.lastSeen && (agora - usr.lastSeen > TOLERANCIA_GHOST_MS)) return false;
        return true;
    });

    if (filtrados.length === 0) {
        container.innerHTML = '<p class="SaaS-lista-vazia">Nenhum atleta online no momento.</p>';
        return;
    }

    let atletasRicos = filtrados.map(key => {
        const nomeBruto = saasUsuariosOnlineCache[key].usuario || "Atleta";
        const identificador = key.startsWith('-') ? key : nomeBruto;
        return obterDadosControlePresencaSaas(identificador);
    });

    atletasRicos.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')); 

    atletasRicos.forEach(atleta => {
        const nomeFormatado = atleta.nome.toLowerCase().split(/\s+/).map(palavra => {
            if (['da', 'de', 'do', 'dos', 'das'].includes(palavra)) {
                return palavra;
            }
            return window.innerWidth <= 767 && palavra.length > 10 ? palavra.charAt(0).toUpperCase() + '.' : palavra.charAt(0).toUpperCase() + palavra.slice(1);
        }).join(' '); 

        let tagsHtml = '';
        if (atleta.socio === 'titular') {
            tagsHtml += `<span class="SaaS-tag SaaS-tag-socio">Sócio</span>`;
        } else if (atleta.socio === 'dependente') {
            tagsHtml += `<span class="SaaS-tag SaaS-tag-dependente">Dependente</span>`;
        }

        if (atleta.isAdmin) {
            tagsHtml += `<span class="SaaS-tag SaaS-tag-admin">Admin</span>`; 
        }

        const divLinha = document.createElement('div');
        divLinha.className = 'linha-usuario-SaaS';
        divLinha.innerHTML = `
            <span class="nome-usuario-SaaS">${nomeFormatado}</span>
            <div class="tags-container-SaaS">${tagsHtml}</div>
        `;
        container.appendChild(divLinha);
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
async function dispararPushCloudflare(token, titulo, mensagem, dadosExtras = {}) {
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
        // 1. Consulta os dados do atleta no Firebase
        const snapshot = await database.ref(`${raizBanco}/jogadores/${idJogador}`).once('value');
        const atleta = snapshot.val();

        if (!atleta) {
            console.warn(`[Push SaaS] Atleta com ID ${idJogador} não foi localizado no banco.`);
            return;
        }

        // 2. Respeita a privacidade (se o atleta desativou nas preferências do perfil)
        if (atleta.receber_notificacoes === false) {
            console.log(`[Push SaaS] O atleta ${atleta.nome || atleta.nomeCompleto || idJogador} optou por silenciar notificações.`);
            return;
        }

        // 3. Valida a existência de tokens na carteira Multi-Device do atleta
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

        // 4. Encaminha o envio individual para CADA aparelho ativo do atleta (Ex: Celular e Tablet)
        // 🛡️ Filtro Global Injetado: A variável externa 'window.tokensPushProcessadosSaaS' protege contra repetição do mesmo celular na mesma chamada em lote
        if (!window.tokensPushProcessadosSaaS) window.tokensPushProcessadosSaaS = new Set();
        
        for (const tokenDestino of tokensArray) {
            if (!window.tokensPushProcessadosSaaS.has(tokenDestino)) {
                window.tokensPushProcessadosSaaS.add(tokenDestino);
                dispararPushCloudflare(tokenDestino, titulo, mensagem, dadosExtras);
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
        
        const tituloPush = "🎾 Convite de Partida";
        const msgPush = `${organizadorFormatado} convidou você para jogar na ${diaNome} às ${horaIniFmt} (${txtQuadraFmt}). Toque para ver.`;

        // Extrai a lista em array ("João, Maria" -> ["João", "Maria"])
        const listaApelidos = (dadosReserva.jogadores || "").split(',').map(s => s.trim());

        listaApelidos.forEach(apelidoConvidado => {
            // Se a confirmação no banco for falsa, ele é um convidado que precisa ser avisado
            if (dadosReserva.confirmacoes[apelidoConvidado] === false) {
                const apelidoUp = apelidoConvidado.toUpperCase();
                
                // Localiza o ID desse jogador no banco de dados local da memória RAM
                const idConvidadoTarget = Object.keys(jogadoresGlobal).find(id => {
                    const j = jogadoresGlobal[id];
                    return j && ((j.apelido || "").toUpperCase() === apelidoUp || (j.nomeCompleto || "").toUpperCase() === apelidoUp);
                });
                
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
                    enviarPushParaAtletaSaaS(idTarget, tituloPush, msgPush, { tipo: "RESERVA_CANCELADA_ORG" });
                }
            }
        });
    }
    
    // ----------------------------------------------------
    // EVENTO 3: CANCELAMENTO IMEDIATO POR RECUSA DE CONVITE
    // ----------------------------------------------------
    if (tipoEvento === "RESERVA_RECUSADA_QUORUM") {
        const tituloPush = "❌ Reserva Cancelada";
        const quemRecusouFmt = autorDaAcao || "Um jogador";
        const msgPush = `${quemRecusouFmt} recusou o convite. Sua partida de ${diaNome} às ${horaIniFmt} (${txtQuadraFmt}) foi cancelada por falta de quórum.`;

        const norm = (txt) => (txt || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, " ").trim().toUpperCase();
        const orgNorm = norm(organizadorFormatado || dadosReserva.organizador);

        const idOrgTarget = Object.keys(jogadoresGlobal || {}).find(id => {
            const j = jogadoresGlobal[id];
            return j && (norm(j.nomeCompleto) === orgNorm || norm(j.apelido) === orgNorm);
        });

        if (idOrgTarget && typeof enviarPushParaAtletaSaaS === 'function') {
            enviarPushParaAtletaSaaS(idOrgTarget, tituloPush, msgPush, { tipo: "RESERVA_RECUSADA_QUORUM" });
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

        // 🛡️ TRAVA ANTI-DUPLICIDADE: Se este aparelho pertence ao próprio organizador, não dispara push remoto para si mesmo
        const meuIdLogado = localStorage.getItem('jogadorLogadoId');
        if (meuIdLogado && idOrgTarget && meuIdLogado === idOrgTarget) {
            return;
        }

        if (idOrgTarget && typeof enviarPushParaAtletaSaaS === 'function') {
            enviarPushParaAtletaSaaS(idOrgTarget, tituloPush, msgPush, { tipo: "RESERVA_EXPIRADA_QUORUM" });
        }
    }
	
	// ----------------------------------------------------
    // EVENTO 5: QUADRA INTERDITADA PARA MANUTENÇÃO
    // ----------------------------------------------------
    if (tipoEvento === "QUADRA_INTERDITADA") {
        const tituloPush = "⚠️ Quadra Interditada";
        const msgPush = `A ${quadraAlvo} foi interditada para manutenção. Seu horário de ${diaNome}, às ${horaIniFmt} foi cancelado.`;

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
                    enviarPushParaAtletaSaaS(idTarget, tituloPush, msgPush, { tipo: "QUADRA_INTERDITADA" });
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

        idsPendentes.forEach(idAtleta => {
            const j = (typeof jogadoresGlobal !== 'undefined' && jogadoresGlobal) ? jogadoresGlobal[idAtleta] : null;
            if (!j) return;

            const classeAtleta = j.classe ? `Classe ${j.classe.toUpperCase().replace('CLASSE_', '').trim()}` : "sua categoria";
            const msgPush = `Você foi convidado para o ${nomeTorneio} na ${classeAtleta}. Toque para ver o convite.`;

            if (typeof enviarPushParaAtletaSaaS === 'function') {
                enviarPushParaAtletaSaaS(idAtleta, tituloPush, msgPush, { tipo: "CONVITE_TORNEIO" });
            }
        });
    }
	
}