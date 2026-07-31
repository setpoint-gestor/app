
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
// 2. INICIALIZAÇÃO DA GRADE DE QUADRAS
// ==========================================

/**
 * Portaria de Sincronismo Visual: Avalia o estado das duas engrenagens do boot.
 * Só remove a tela de carregamento quando os dados chegarem E a faxina terminar.
 */
function verificarLiberacaoTelaLoadingSaaS() {
    const telaLoading = document.getElementById('tela-loading');
    const isTelaAtiva = telaLoading ? telaLoading.classList.contains('ativa') : false;

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
    
    if (elNome) {
        if (isGestorLogado) {
            const badgesHtml = `<span class="badge" style="background-color: #dc3545; margin-left: 6px; font-size: 10px; padding: 2px 6px;">Admin</span><span class="badge badge-SaaS-off" style="background-color: #dc3545; margin-left: 4px; font-size: 10px; padding: 2px 6px; display: none;">OFF</span>`;
            elNome.innerHTML = `
                <div class="header-user-wrapper">
                    <span class="header-user-text">
                        Olá, <span class="nome-desktop">Gestor</span><span class="nome-mobile">Gestor</span>
                    </span>
                    <div class="header-user-badges">${badgesHtml}</div>
                </div>
            `;
        } else {
            const nomeLogado = localStorage.getItem('jogadorLogadoNome') || "Sócio";
            const nomePC = nomeLogado.toLowerCase().split(' ').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
            apelidoMobile = nomePC.split(' ')[0];
            
            try {
                const cacheRaw = localStorage.getItem('jogadoresDataCache');
                if (cacheRaw) {
                    const dadosJogadores = JSON.parse(cacheRaw);
                    if (dadosJogadores[nomeLogado] && dadosJogadores[nomeLogado].apelido) {
                        apelidoMobile = dadosJogadores[nomeLogado].apelido;
                    }
                }
            } catch (e) {}

            socio = localStorage.getItem('jogadorLogadoSocio') || 'titular'; 
            let perfis = {};
            try { perfis = JSON.parse(localStorage.getItem('jogadorLogadoPerfis') || '{}'); } catch(e) {}

            let badgesHtml = '';
            const corVinculo = socio === 'visitante' ? '#f39c12' : '#3498db';
            const txtVinculo = socio === 'visitante' ? 'Staff' : (socio ? socio.charAt(0).toUpperCase() + socio.slice(1).toLowerCase() : 'Sócio');
            badgesHtml += `<span class="badge" style="background-color: ${corVinculo}; margin-left: 6px; font-size: 10px; padding: 2px 6px;">${txtVinculo}</span>`;

            Object.keys(perfis).forEach(p => {
                if (perfis[p] === true) {
                    let corPerfil = '#6c757d';
                    let abrevPerfil = p.substring(0, 5);
                    
                    if (p === 'Admin') { corPerfil = '#dc3545'; abrevPerfil = 'Admin'; }
                    else if (p === 'Professor') { corPerfil = '#198754'; abrevPerfil = 'Prof'; }
                    else if (p === 'Financeiro') { corPerfil = '#007bff'; abrevPerfil = 'Fin'; }
                    else if (p === 'Árbitro') { corPerfil = '#fd7e14'; abrevPerfil = 'Árbit'; }
                    else if (p === 'Manutenção') { corPerfil = '#6f42c1'; abrevPerfil = 'Manut'; }

                    badgesHtml += `<span class="badge" style="background-color: ${corPerfil}; margin-left: 4px; font-size: 10px; padding: 2px 6px;">${abrevPerfil}</span>`;
                }
            }); 
			
            badgesHtml += `<span class="badge badge-SaaS-off" style="background-color: #dc3545; margin-left: 4px; font-size: 10px; padding: 2px 6px; display: none;">OFF</span>`;

            elNome.innerHTML = `
                <div class="header-user-wrapper">
                    <span class="header-user-text">
                        Olá, <span class="nome-desktop">${nomePC}</span><span class="nome-mobile">${apelidoMobile}</span>
                    </span>
                    <div class="header-user-badges">${badgesHtml}</div>
                </div>
            `;
        }
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

            if (statusBanco === 'interditada' || statusBanco === 'interdita') {
                btn.classList.add('status-saas-interditada');
            } else if (statusBanco === 'bloqueada') {
                btn.classList.add('status-saas-bloqueada');
            }
            
            btn.onclick = () => {
                selecionarQuadraSaaS(nomeQuadra);
                if (statusBanco === 'interditada' || statusBanco === 'interdita') {
                    showToast("🏟️ Atenção: Esta quadra está interditada provisoriamente para manutenção.", "warning");
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

   
	//ouvinteQuadraAtual = database.ref(`${raizBanco}/reservas/${nomeQuadra}`);
	
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
// 🎾 SUB-MÓDULO 2: PLOTAGEM DE RESERVAS RICAS E BORDAS CONTÍNUAS (APELIDOS)
// ====================================================================
function plotarReservasAtivas(reservas) {
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
                // Planta a bomba-relógio
                const idAlarme = setTimeout(() => {
                    if (typeof executarFaxinaAutomaticaSaaS === 'function') {
                        executarFaxinaAutomaticaSaaS();
                    }
                }, tempoRestante);
                window.alarmesReservasPendentes.push(idAlarme);
            } else {
                // Se o tempo já passou, dispara o faxineiro imediatamente!
                if (typeof executarFaxinaAutomaticaSaaS === 'function') {
                    executarFaxinaAutomaticaSaaS();
                }
            }
        }
        // --- ⏰ FIM: ALARME INVISÍVEL ---

        // 🎯 SHIELD DE CONTINUIDADE: Se não tem 'borda', é extensão da hora anterior!
        // ✅ CÓDIGO NOVO (CORRIGIDO)
		// Se não tem 'borda', é uma 2ª hora. Ela JAMAIS desenha nada sozinha!
		if (r.borda === undefined && r.status !== 'aula_cancelada') {
			return;
		}
        
        const cel = document.getElementById(`cel-${r.hora}-${r.dia}`);
        if (!cel) return;

        // Memory Guard: Evita desenho por cima de horários fechados
        if (cel.getAttribute('data-saas-proibido') === 'true') {
            cel.setAttribute('title', `📝 Lembrete: Havia uma reserva de [${r.jogadores || 'Sócio'}] neste horário bloqueado.`);
            cel.innerHTML = ''; 
            return; 
        }

        // Exceção para Aulas Canceladas
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

        // ====================================================================
        // 🔹 MÁGICA DO FORMATADOR DE NOMES (Negrito e Cores de Pendência)
        // ====================================================================
        const confs = r.confirmacoes || {};

        // Adicionamos o "index" para saber a posição do jogador na lista
        const formatarNomeAtleta = (nomeBruto, index) => {
            const nomeStr = nomeBruto.trim();
            const nomeUpper = nomeStr.toUpperCase();
            
            // Se for string pura de grade, ignora
            if (nomeUpper === 'AULA' || nomeUpper === 'DUPLA') return nomeStr;

            let classes = [];

            // 1. Organizador: é SEMPRE o Jogador 1 (índice 0 da lista)
            if (index === 0) {
                classes.push("nome-organizador-grade");
            }
            
            // 2. Busca de Pendência (Case Insensitive)
            let isPendente = false;
            Object.keys(confs).forEach(k => {
                if (confs[k] === false && k.toUpperCase() === nomeUpper) {
                    isPendente = true;
                }
            });

            if (isPendente) {
                classes.push("nome-pendente-grade");
            }

            // Aplica a cápsula HTML se tiver alguma regra
            if (classes.length > 0) {
                return `<span class="${classes.join(' ')}">${nomeStr}</span>`;
            }
            return nomeStr; // Confirmado comum segue normal
        };

        // ====================================================================

        if (r.jogadores && r.jogadores.toLowerCase() === 'aula') {
            cel.innerHTML = `${r.jogadores}`;
            cel.classList.add('celula-aula');
        } else if (r.jogadores && r.jogadores.toLowerCase() === 'dupla') {
            cel.innerHTML = `${r.jogadores}`;
            cel.classList.add('celula-dupla');
        } else if (r.duracao === 2) {
            // Bloco unificado de 2 Horas
            
            if (!cel.classList.contains('celula-dupla')) {
                cel.classList.add('celula-ocupada');    
            }
            cel.classList.add('celula-reserva-2h'); 
            cel.classList.add('reserva-2h-topo');
            
            // 🎯 Passamos o index para a função mágica
            const partesBrutas = (r.jogadores || '').split(', ');
            const partesFormatadas = partesBrutas.map((n, idx) => formatarNomeAtleta(n, idx));

            const jogadoresMetadeCima = partesFormatadas.filter((_, idx) => idx === 0 || idx === 2).join(', ');
            const jogadoresMetadeBaixo = partesFormatadas.filter((_, idx) => idx === 1 || idx === 3).join(', ');

            cel.innerHTML = jogadoresMetadeCima || 'Ocupado';
            
            cel.style.borderTop = corBorda;
            cel.style.borderLeft = corBorda;
            cel.style.borderRight = corBorda;
            cel.style.borderBottom = 'none';

            const celNext = document.getElementById(`cel-${r.hora + 1}-${r.dia}`);
            if (celNext) {
                celNext.innerHTML = jogadoresMetadeBaixo || ''; 
                
                if (!celNext.classList.contains('celula-dupla')) {
                    celNext.classList.add('celula-ocupada');
                }
                celNext.classList.add('celula-reserva-2h');
                celNext.classList.add('reserva-2h-baixo');
                
                celNext.style.borderTop = 'none';
                celNext.style.borderLeft = corBorda;
                celNext.style.borderRight = corBorda;
                celNext.style.borderBottom = corBorda;
                
                celNext.onclick = () => {
                    if (navigator.vibrate) navigator.vibrate(30);
                    abrirMenuAcoesReservaSaaS(r.dia, r.hora, r); 
                };
            }
        } else {
            // Bloco individual de 1 Hora
            const partesBrutas = (r.jogadores || '').split(', ');
            
            // 🎯 Passamos o index para a função mágica
            const partesFormatadas = partesBrutas.map((n, idx) => formatarNomeAtleta(n, idx));
            
            if (partesFormatadas.length === 4) {
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
            cel.classList.add('celula-reserva-1h'); 
            cel.style.border = corBorda; 
        }
        
        cel.onclick = () => {
            if (navigator.vibrate) navigator.vibrate(30);
            abrirMenuAcoesReservaSaaS(r.dia, r.hora, r);
        };

        const hojeZero = new Date();
        hojeZero.setHours(0, 0, 0, 0);
        
        const partesDataPure = r.dataCompleta.split('-');
        const dataReservaPure = new Date(parseInt(partesDataPure[0]), parseInt(partesDataPure[1]) - 1, parseInt(partesDataPure[2]), 0, 0, 0, 0);

        if (dataReservaPure < hojeZero) {
            cel.onclick = null;
            cel.style.cursor = 'default';
            
            if (r.duracao === 2) {
                const celNext = document.getElementById(`cel-${r.hora + 1}-${r.dia}`);
                if (celNext) {
                    celNext.onclick = null;
                    celNext.style.cursor = 'default';
                }
            }
        }
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

                // Removemos a exceção da 'celula-dupla' para que o Guardião também bloqueie as duplas no passado!
                const ehCelulaLivreOuDupla = !cel.classList.contains('celula-ocupada') && 
                                             !cel.classList.contains('celula-aula') && 
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




function cliqueCelula(dia, hora) {
    // 🛡️ RECOLETA DE SEGURANÇA INTRA-DIA: Evita agendamentos passados se a pagina ficou aberta sem F5
    const linhaDatasTabela = document.getElementById('linha-datas-tabela');
    if (linhaDatasTabela) {
        const agora = new Date();
        const diaMes = String(agora.getDate()).padStart(2, '0');
        const mes = String(agora.getMonth() + 1).padStart(2, '0');
        const ano = agora.getFullYear();
        const stringHoje = `${diaMes}/${mes}/${ano}`;
        const horaAtual = agora.getHours();

        const colHeader = linhaDatasTabela.children[dia - 1];
        if (colHeader) {
            const dataTexto = colHeader.textContent.trim();
            // Se o usuario clicou na coluna de hoje e a hora do slot já se encerrou, barra na hora!
            if (dataTexto === stringHoje && hora < horaAtual) {
                showToast("Aviso: Não é permitido realizar agendamentos em horários passados.", "error");
                return;
            }
        }
    }

    let statusDaQuadraAtiva = 'liberada';
    if (configQuadrasGlobal.nomes && configQuadrasGlobal.quantidade) {
        const qtd = parseInt(configQuadrasGlobal.quantidade) || 0;
        for (let i = 1; i <= qtd; i++) {
            const dadosQuadra = configQuadrasGlobal.nomes[i];
            const nomeF = typeof dadosQuadra === 'object' ? (dadosQuadra.nome || `Quadra ${i}`) : (dadosQuadra || `Quadra ${i}`);
            if (nomeF === quadraSelecionadaSaaS) {
                statusDaQuadraAtiva = configQuadrasGlobal.nomes['status_' + i] || 'liberada';
                break;
            }
        }
    }

    // Interceptação Opção C: Bloqueia novas reservas se estiver interditada
    if (statusDaQuadraAtiva === 'interditada' || statusDaQuadraAtiva === 'interdita') {
        showToast("Aviso: Não é permitido realizar novas reservas em uma quadra interditada.", "error");
        return;
    }

    abrirAgendamentoSaaS(dia, hora);
}




/**
 * Gerencia o travamento contextual (Smart Lock) e monta os harvests reativos de dados.
 */
function abrirAgendamentoSaaS(dia, hora) {
	
	// 🌟 TRAVA DE SEGURANÇA CONTRA QUADRA INTERDITADA (BOTAO + E FLUXOS LIVRES)
    let statusDaQuadraAtiva = 'liberada';
    if (configQuadrasGlobal.nomes && configQuadrasGlobal.quantidade) {
        const qtd = parseInt(configQuadrasGlobal.quantidade) || 0;
        for (let i = 1; i <= qtd; i++) {
            const dadosQuadra = configQuadrasGlobal.nomes[i];
            const nomeF = typeof dadosQuadra === 'object' ? (dadosQuadra.nome || `Quadra ${i}`) : (dadosQuadra || `Quadra ${i}`);
            if (nomeF === quadraSelecionadaSaaS) {
                statusDaQuadraAtiva = configQuadrasGlobal.nomes['status_' + i] || 'liberada';
                break;
            }
        }
    }

    if (statusDaQuadraAtiva === 'interditada' || statusDaQuadraAtiva === 'interdita') {
        showToast("Aviso: Não é permitido realizar novas reservas em uma quadra interditada.", "error");
        return;
    }
	
	// Garante que o contador elástico de atletas reinicie a cada clique de célula
    contAtletas = 1;

    // 🧠 A PERGUNTA DIRETA: O interruptor de alteração está ligado (true)?
    if (jogadoresGlobalAlterado) {
        console.log("🔄 [Planilha] Mudança detectada no banco! Sincronizando seletores...");
        
        // Desliga o interruptor, pois a interface já vai ler os dados novos do 'jogadoresGlobal'
        jogadoresGlobalAlterado = false; 
    }
	
    const campoQuadra = document.getElementById('saas-quadra');
    const campoDia = document.getElementById('saas-dia');
    const campoHora = document.getElementById('saas-hora');
    const campoDuracao = document.getElementById('saas-duracao');
    const campoJogador1 = document.getElementById('saas-jogador1');

    if (!campoQuadra || !campoDia || !campoHora || !campoJogador1) return;
	
	// 🧠 GATILHO DA REGRA DE DURAÇÃO (SaaS): Lê o banco e controla a anatomia do campo
    if (campoDuracao) {
        const regraDuracao = (configRegrasGlobal && configRegrasGlobal.DuracaoPermitida) ? configRegrasGlobal.DuracaoPermitida : "1_2";
        const valorAnterior = campoDuracao.value;
        
        // 1. Limpa o select
        campoDuracao.innerHTML = ''; 
        
        // 2. A opção de 1 Hora sempre é a base
        campoDuracao.innerHTML += '<option value="1">1 hora</option>';
        
        // 3. O Campo Camaleão: Muda de formato baseado na regra
        if (regraDuracao === "1_2") {
            campoDuracao.innerHTML += '<option value="2">2 horas</option>';
            campoDuracao.disabled = false;
            campoDuracao.style.appearance = ''; // Garante que a setinha apareça
            campoDuracao.style.webkitAppearance = '';
        } else {
            // Trava o campo e ativa a cor cinza do CSS (.saas-field:disabled)
            campoDuracao.disabled = true;
            campoDuracao.style.appearance = 'none'; // Truque para apagar a setinha do dropdown
            campoDuracao.style.webkitAppearance = 'none';
        }
        
        // 4. Mantém o valor selecionado antes (se ainda existir) ou força 1 hora
        if (valorAnterior && campoDuracao.querySelector(`option[value="${valorAnterior}"]`)) {
            campoDuracao.value = valorAnterior;
        } else {
            campoDuracao.value = "1";
        }
    }

    // --- Harvest de Quadras direto do chassi ativo ---
    campoQuadra.innerHTML = '';
    document.querySelectorAll('.tab-container .tab-button').forEach(btn => {
        // Blindagem cirúrgica: Se a aba mapeada for interditada, ela é omitida do select
        if (btn.dataset.statusSaas === 'interditada' || btn.dataset.statusSaas === 'interdita') {
            return;
        }
        const opt = document.createElement('option');
        opt.value = btn.dataset.nomeReal;
        opt.textContent = btn.dataset.nomeReal;
        campoQuadra.appendChild(opt);
    });
    campoQuadra.value = quadraSelecionadaSaaS;

    // --- Harvest de Dias Mapeando o Cabeçalho (ATUALIZADO: Ordenação Cronológica Real) ---
    campoDia.innerHTML = '';
    const linhaDatas = document.getElementById('linha-datas-tabela');
    const linhaNomesDias = linhaDatas ? linhaDatas.previousElementSibling : null;
    
    if (linhaDatas && linhaNomesDias) {
        const filaDiasTriagem = []; // Mesa de triagem temporária na memória RAM

        for (let i = 0; i < 7; i++) {
            // 🛡️ Filtro de Antecedência: Ignora colunas bloqueadas (exceto se for o dia ativo do Smart Lock)
            if (linhaDatas.children[i] && linhaDatas.children[i].classList.contains('dia-bloqueado-visual')) {
                if (dia !== (i + 1)) {
                    continue; 
                }
            }

            const nomeDia = linhaNomesDias.children[i + 1].textContent.trim();
            const dataDia = linhaDatas.children[i].textContent.trim();
            
            // 🧠 Engenharia Cronológica: Divide "DD/MM/YYYY" para criar um timestamp de ordenação puro
            const partes = dataDia.split('/');
            let timestampOrdenacao = 0;
            if (partes.length === 3) {
                timestampOrdenacao = new Date(parseInt(partes[2]), parseInt(partes[1]) - 1, parseInt(partes[0])).getTime();
            }

            // Guarda temporariamente o dia com o seu carimbo de tempo (timestamp)
            filaDiasTriagem.push({
                value: i + 1,
                texto: `${nomeDia} (${dataDia})`,
                tempo: timestampOrdenacao
            });
        }

        // 📊 ORDENAÇÃO DE ALTO NÍVEL: Organiza a fila do menor timestamp (mais antigo) para o maior (mais futuro)
        filaDiasTriagem.sort((a, b) => a.tempo - b.tempo);

        // 🚀 Injeta as opções na interface de forma perfeitamente sequencial e linear
        filaDiasTriagem.forEach(item => {
            const opt = document.createElement('option');
            opt.value = item.value;
            opt.textContent = item.texto;
            campoDia.appendChild(opt);
        });
    }
	

    // --- Injeção Automática do Jogador Logado ---
    // --- Injeção Automática do Jogador Logado (Corrigido para o Padrão Minimalista) ---
    campoJogador1.innerHTML = '';
    const nomeLogado = localStorage.getItem('jogadorLogadoNome') || "Ronaldo Taborda Costa";
    const optUser = document.createElement('option');
    optUser.value = nomeLogado;
    
    // 1. LIMPEZA INICIAL: Remove os parênteses brutos de apelido se já existirem no localStorage
    let nomeLimpo = nomeLogado.replace(/\s*\(.*?\)\s*/g, "").trim();
    
    // 2. CONVERSÃO PARA INICIAIS MAIÚSCULAS (Title Case)
    nomeLimpo = nomeLimpo.toLowerCase().replace(/(?:^|\s)\S/g, function(a) { return a.toUpperCase(); });
    
    // 3. ENGENHARIA DE CORTE: Transforma "Ronaldo Taborda Costa" em "Ronaldo T Costa" (Sem Ponto)
    const palavras = nomeLimpo.split(/\s+/);
    if (palavras.length > 2) {
        let nomeFinalJ1 = palavras[0];
        for (let i = 1; i < palavras.length - 1; i++) {
            // Ignora preposições comuns no meio do nome para não virarem iniciais
            if (['Da', 'De', 'Do', 'Dos', 'Das'].includes(palavras[i])) {
                nomeFinalJ1 += " " + palavras[i].toLowerCase();
            } else {
                nomeFinalJ1 += " " + palavras[i].charAt(0).toUpperCase(); // Inserido Puro (Sem Ponto)
            }
        }
        nomeFinalJ1 += " " + palavras[palavras.length - 1];
        optUser.textContent = nomeFinalJ1;
    } else {
        optUser.textContent = nomeLimpo;
    }
    
    campoJogador1.appendChild(optUser);
    campoJogador1.value = nomeLogado;

    

		// --- FUNÇÃO INTERNA REATIVA: Sincronização Dinâmica de Horários e Duração ---
		// --- FUNÇÃO INTERNA REATIVA: Sincronização Dinâmica de Horários e Duração ---
		// --- FUNÇÃO INTERNA REATIVA: Sincronização Dinâmica de Horários e Duração ---
		const atualizarHorariosDisponiveisSaaS = () => {
			const diaSel = parseInt(campoDia.value) || 1;
			const duracaoSel = parseInt(campoDuracao.value) || 1;
			const duracaoReal = campoDuracao.value === '3-piramide' ? 2 : duracaoSel;
			
			let existeSequenciaNoDia = false;

			// A) PRIORIDADE MESTRE - SMART LOCK: Se veio do clique direto da célula da tabela
			if (horarioBloqueadoPelaTabela !== null && horarioBloqueadoPelaTabela !== undefined) {
				campoHora.innerHTML = '';
				
				// 💉 CORREÇÃO CRÍTICA: Uso seguro da variável de escopo let para evitar undefined/NaN
				const hInicio = String(horarioBloqueadoPelaTabela).padStart(2, '0') + ":00";
				const hFim = String(horarioBloqueadoPelaTabela + duracaoReal).padStart(2, '0') + ":00";
				
				const optHora = document.createElement('option');
				optHora.value = horarioBloqueadoPelaTabela;
				optHora.textContent = `${hInicio} - ${hFim}`;
				campoHora.appendChild(optHora);
				
				campoHora.value = horarioBloqueadoPelaTabela;

				campoQuadra.disabled = true;
				campoDia.disabled = true;
				campoHora.disabled = true;
			} else {
				// B) MODO LIVRE - BOTÃO (+): Faz o Harvest inteligente baseado no layout da planilha
				campoQuadra.disabled = false;
				campoDia.disabled = false;
				campoHora.disabled = false;
				
				const horaAntigaPrevia = campoHora.value;
				campoHora.innerHTML = '';

				const agora = new Date();
				const diaMes = String(agora.getDate()).padStart(2, '0');
				const mes = String(agora.getMonth() + 1).padStart(2, '0');
				const ano = agora.getFullYear();
				const stringHoje = `${diaMes}/${mes}/${ano}`;
				const horaAtual = agora.getHours();

				const colHeader = linhaDatas ? linhaDatas.children[diaSel - 1] : null;
				const ehHoje = colHeader ? (colHeader.textContent.trim() === stringHoje) : false;

				let encontrouAlgumHorario = false;
				const horasLivresNoDia = [];

				for (let h = 6; h <= 22; h++) {
					if (ehHoje && h < horaAtual) continue;

					const celAtual = document.getElementById(`cel-${h}-${diaSel}`);
					if (!celAtual) continue;

					// 💉 INJEÇÃO: Uma célula de dupla só está ocupada se o texto dela NÃO for mais "Dupla"
					const estaOcupada = celAtual.classList.contains('celula-ocupada') || 
										celAtual.classList.contains('celula-aula') || 
										(celAtual.classList.contains('celula-dupla') && celAtual.textContent.trim() !== 'Dupla') || 
										celAtual.classList.contains('celula-bloqueada');

					if (estaOcupada) continue;
					
					horasLivresNoDia.push(h);

					if (duracaoReal === 2) {
						if (h + 2 > 23) continue;
						
						const celSeguinte = document.getElementById(`cel-${h+1}-${diaSel}`);
						if (!celSeguinte) continue;

						// 💉 INJEÇÃO: Avalia a hora seguinte da sequência de forma inteligente
						const seguinteOcupada = celSeguinte.classList.contains('celula-ocupada') || 
												celSeguinte.classList.contains('celula-aula') || 
												(celSeguinte.classList.contains('celula-dupla') && celSeguinte.textContent.trim() !== 'Dupla') || 
												celSeguinte.classList.contains('celula-bloqueada');

						if (seguinteOcupada) continue;
					}

					const optHora = document.createElement('option');
					optHora.value = h;
					optHora.textContent = `${String(h).padStart(2, '0')}:00 - ${String(h + duracaoReal).padStart(2, '0')}:00`;
					campoHora.appendChild(optHora);
					encontrouAlgumHorario = true;
				}

				if (horaAntigaPrevia && campoHora.querySelector(`option[value="${horaAntigaPrevia}"]`)) {
					campoHora.value = horaAntigaPrevia;
				}
				
				for (let i = 0; i < horasLivresNoDia.length; i++) {
					const h = horasLivresNoDia[i];
					if (horasLivresNoDia.includes(h + 1)) {
						existeSequenciaNoDia = true;
						break;
					}
				}

				if (!encontrouAlgumHorario) {
					const optHora = document.createElement('option');
					optHora.value = "";
					optHora.textContent = "Sem horários livres";
					campoHora.appendChild(optHora);
					campoHora.disabled = true;
				}
			}

			// 🧠 VALIDAÇÃO REATIVA DINÂMICA DA DURAÇÃO (Aplica-se ao final de ambos os fluxos)
			const horaFoco = parseInt(campoHora.value);
			const btnAddInterno = document.querySelector('.add-jogador');

			if (!isNaN(horaFoco) && campoHora.value !== "") {
				const celSeguinte = document.getElementById(`cel-${horaFoco + 1}-${diaSel}`);
				
				// 💉 INJEÇÃO: Garante o cálculo perfeito da sequência de 2h para o dropdown de duração
				const seguinteOcupada = celSeguinte ? (
					celSeguinte.classList.contains('celula-ocupada') || 
					celSeguinte.classList.contains('celula-aula') || 
					(celSeguinte.classList.contains('celula-dupla') && celSeguinte.textContent.trim() !== 'Dupla') || 
					celSeguinte.classList.contains('celula-bloqueada')
				) : true;

				const limiteFisicoExcedido = (horaFoco + 2 > 23);
				const op2h = campoDuracao.querySelector('option[value="2"]');
				const opPiramide = campoDuracao.querySelector('option[value="3-piramide"]');

				const deveOcultarOpcoesLongas = (horarioBloqueadoPelaTabela !== null && horarioBloqueadoPelaTabela !== undefined)
					? (seguinteOcupada || limiteFisicoExcedido) 
					: (!existeSequenciaNoDia);                  

				if (deveOcultarOpcoesLongas) {
					if (op2h) op2h.style.display = 'none';
					if (opPiramide) opPiramide.style.display = 'none';
					if (campoDuracao.value === '2' || campoDuracao.value === '3-piramide') {
						campoDuracao.value = '1';
						setTimeout(() => { atualizarHorariosDisponiveisSaaS(); }, 0);
					}
				} else {
					if (op2h) op2h.style.display = 'block';
					if (opPiramide) {
						opPiramide.style.display = (typeof piramideAtivaGlobal !== 'undefined' && piramideAtivaGlobal) ? 'block' : 'none';
					}
				}

				if (btnAddInterno) {
					btnAddInterno.style.pointerEvents = 'auto';
					btnAddInterno.style.opacity = '1';
				}
			} else {
				if (btnAddInterno && campoHora.disabled) {
					btnAddInterno.style.pointerEvents = 'none';
					btnAddInterno.style.opacity = '0.3'; 
				}
			}
		}; 
		
		

		// 💉 INJEÇÃO: Registra a função na memória global para a planilha de fundo poder chamá-la
		window.atualizarHorariosModalSaaS = atualizarHorariosDisponiveisSaaS;

		// --- Vincula os Ouvintes Reativos no Chassi do Formulário ---
		// 💎 CARTA NA MANGA: Sincronização Orientada a Eventos (Sem timers, sem piscadas)
		campoQuadra.onchange = () => {
			// 1. Atualiza a referência da quadra
			quadraSelecionadaSaaS = campoQuadra.value;
			
			// 2. Emite o Ticket: "Avisa a tabela que eu mudei a quadra de propósito"
			window.solicitouAtualizacaoModal = true; 
            
			// 3. Dispara o Firebase. 
			// Não apagamos nada, não colocamos temporizador. Quando os dados chegarem, 
			// a função renderizarDadosPlanilha consumirá o Ticket e atualizará os horários instantaneamente.
			selecionarQuadraSaaS(campoQuadra.value); 
		};

		campoDia.onchange = () => {
			if (campoHora) campoHora.value = "";
			atualizarHorariosDisponiveisSaaS();
		};
		
		campoDuracao.onchange = () => {
			if (campoDuracao.value === "1" && campoHora) {
				campoHora.value = "";
			}
			atualizarHorariosDisponiveisSaaS();
		};
		
		campoHora.onchange = atualizarHorariosDisponiveisSaaS;

	
        // --- Orquestração Inicial de Estados ---
        // --- Orquestração Inicial de Estados (Consolidado e Blindado) ---
        if (dia !== undefined && hora !== undefined) {
            // 🔒 MODO CELULA: Fixa os parâmetros vindos direto do clique
            horarioBloqueadoPelaTabela = parseInt(hora, 10);
            campoDia.value = dia;
            if (campoDuracao) campoDuracao.value = "1";
            console.log("🔒 [Boot SaaS] Smart Lock Ativado. Hora Gravada na Memória:", horarioBloqueadoPelaTabela);
        } else {
            // ➕ MODO BOTÃO (+): Limpa completamente o passado para evitar memória fantasma
            horarioBloqueadoPelaTabela = null;
            if (campoDia.options.length > 0) {
                campoDia.selectedIndex = 0;
            }
            if (campoDuracao) campoDuracao.value = "1";
            if (campoHora) campoHora.value = "";
            console.log("➕ [Boot SaaS] Botão (+) Ativado. Memória de Horários Resetada.");
        }

        // Executa a carga inicial para desenhar o formulário com total inteligência
        atualizarHorariosDisponiveisSaaS();
        
        // Dispara a abertura do modal usando a engenharia nativa do core
        abrirModalConfig('modal-agendamento');
}





/**
 * ALGORITMO ESTRATÉGIA 2: Abrevia os nomes do meio SEM ponto e remove apelidos redundantes
 */
function expurgarEAbreviarNomeSaaS(nomeCompleto, apelido) {
    if (!nomeCompleto) return "";
    const nomeStr = String(nomeCompleto).trim();
    const apelidoStr = apelido ? String(apelido).trim() : "";
    
    const words = nomeStr.split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0) return "";
    
    let nomeFormatado = words[0]; // Primeiro nome sempre intacto
    
    if (words.length > 2) {
        for (let i = 1; i < words.length - 1; i++) {
            const wordLower = words[i].toLowerCase();
            if (['da', 'de', 'do', 'dos', 'das'].includes(wordLower)) {
                nomeFormatado += " " + wordLower;
            } else {
                nomeFormatado += " " + words[i].charAt(0).toUpperCase(); // Sem ponto
            }
        }
        nomeFormatado += " " + words[words.length - 1]; // Último sobrenome sempre intacto
    } else if (words.length === 2) {
        nomeFormatado += " " + words[1];
    }
    
    if (apelidoStr) {
        const nickClean = apelidoStr.toLowerCase();
        const nomeClean = nomeStr.toLowerCase();
        const primeiroNomeClean = words[0].toLowerCase();
        
        const ehRedundante = (nomeClean === nickClean) || 
                             (primeiroNomeClean === nickClean) || 
                             (nomeClean.startsWith(nickClean));
                             
        if (!ehRedundante) {
            nomeFormatado += " (" + apelidoStr + ")";
        }
    }
    
    return nomeFormatado;
}

/**
 * MOTOR DE BLOQUEIO: Mapeia em tempo real quem já foi escolhido nos outros campos
 */
function obterListaProibidosSaaS(selAtual) {
    const proibidos = [];
    
    const campoJ1 = document.getElementById('saas-jogador1');
    if (campoJ1) {
        proibidos.push(campoJ1.value);
        
        Object.keys(jogadoresGlobal).forEach(id => {
            if (jogadoresGlobal[id].nomeCompleto === campoJ1.value) {
                proibidos.push(id);
            }
        });
    }
    
    const container = document.getElementById('jogadoresContainerSaaS');
    if (container) {
        container.querySelectorAll('select').forEach(s => {
            if (s !== selAtual && s.value) {
                proibidos.push(s.value);
            }
        });
    }
    return proibidos;
}

/**
 * INTELECÇÃO CAMALEÃO + FILTRO EXCLUSIVO: Altera o texto e oculta duplicados dinamicamente
 */
function alternarTextoOpcoesSaaS(sel, exibirCompleto) {
    if (!jogadoresGlobal || Object.keys(jogadoresGlobal).length === 0) return;
    
    const proibidos = obterListaProibidosSaaS(sel);
    
    Array.from(sel.options).forEach(opt => {
        const id = opt.value;
        if (!id || id === "") return;
        
        if (proibidos.includes(id) && id !== sel.value) {
            opt.disabled = true;
            opt.style.display = 'none';
            return;
        } else {
            opt.disabled = false;
            opt.style.display = 'block';
        }
        
        const atleta = jogadoresGlobal[id];
        if (atleta) {
            if (exibirCompleto) {
                const apelidoTxt = atleta.apelido ? ' (' + atleta.apelido + ')' : '';
                opt.textContent = atleta.nomeCompleto + apelidoTxt;
            } else {
                opt.textContent = expurgarEAbreviarNomeSaaS(atleta.nomeCompleto, atleta.apelido);
            }
        }
    });
}

/**
 * MOTOR ELÁSTICO DE ATLETAS: Constrói as linhas, ordena de A a Z e amarra os gatilhos
 */
function adicionarJogadorSaaS() {
    const container = document.getElementById('jogadoresContainerSaaS');
    if (!container) return;

    const selects = container.querySelectorAll('select');
    
    if (selects[selects.length - 1].value === "") { 
        if (typeof showToast === 'function') {
            showToast("⚠️ Selecione o atleta anterior antes de abrir outro campo.", "info");
        } else {
            alert("⚠️ Selecione o atleta anterior antes de abrir outro campo."); 
        }
        return; 
    }
    
    if (contAtletas < 4) {
        contAtletas++;
        
        const div = document.createElement('div'); 
        div.className = 'saas-row'; 
        div.style.margin = '0';
        div.style.width = '100%';
        div.style.display = 'flex';
        div.style.alignItems = 'center';
        
        const sel = document.createElement('select'); 
        sel.className = 'saas-field';
        
        // ==========================================================
        // ✨ CORREÇÃO: Vincula o ID dinâmico esperado pelo Harvester
        // ==========================================================
        sel.id = `saas-jogador${contAtletas}`;
        // ==========================================================

        sel.style.width = '0px';
        sel.style.flex = '1';
        sel.style.maxWidth = '100%';
        sel.innerHTML = '<option value="">Selecionar Atleta ' + contAtletas + '...</option>';
        
        const proibidos = obterListaProibidosSaaS(sel);
        
        if (Object.keys(jogadoresGlobal).length > 0) {
            // 🔥 LAPIDAÇÃO DE ALTA PERFORMANCE: Transforma o objeto do Firebase em array e ordena alfabeticamente
            const atletasOrdenadosSaaS = Object.keys(jogadoresGlobal)
                .map(id => ({ id: id, ...jogadoresGlobal[id] }))
                .sort((a, b) => {
                    const nomeA = (a.nomeCompleto || "").trim().toLowerCase();
                    const nomeB = (b.nomeCompleto || "").trim().toLowerCase();
                    return nomeA.localeCompare(nomeB, 'pt-BR'); // Ordenação nativa brasileira ABC
                });

            // Alimenta o dropdown seguindo rigorosamente o arranjo alfabético indexado
            atletasOrdenadosSaaS.forEach(atleta => {
                const id = atleta.id;
                if (atleta && atleta.ativo !== false) {
                    const textoAbreviado = expurgarEAbreviarNomeSaaS(atleta.nomeCompleto, atleta.apelido);
                    
                    if (proibidos.includes(id)) {
                        sel.innerHTML += '<option value="' + id + '" disabled style="display:none;">' + textoAbreviado + '</option>';
                    } else {
                        sel.innerHTML += '<option value="' + id + '">' + textoAbreviado + '</option>';
                    }
                }
            });
        } else {
            sel.innerHTML += '<option value="convidado">Convidado / Avulso</option>';
        }
        
        const lixo = document.createElement('span'); 
        lixo.className = 'btn-remover-atleta'; 
        lixo.innerHTML = '&times;';
        
        lixo.onclick = () => { 
            div.remove(); 
            contAtletas--; 
            const btnAdd = document.getElementById('btn-add-atleta-SaaS');
            if (btnAdd) {
                btnAdd.style.opacity = '1'; 
                btnAdd.style.pointerEvents = 'auto'; 
            }
        };
        
        sel.addEventListener('mousedown', () => alternarTextoOpcoesSaaS(sel, true));
        sel.addEventListener('focus', () => alternarTextoOpcoesSaaS(sel, true));
        sel.addEventListener('change', () => alternarTextoOpcoesSaaS(sel, false));
        
        sel.addEventListener('blur', () => {
            setTimeout(() => {
                alternarTextoOpcoesSaaS(sel, false);
            }, 150);
        });
        
        div.appendChild(sel); 
        div.appendChild(lixo); 
        container.appendChild(div); 
        sel.focus();
        
        if (contAtletas === 4) { 
            const btnAdd = document.getElementById('btn-add-atleta-SaaS');
            if (btnAdd) {
                btnAdd.style.opacity = '0.3'; 
                btnAdd.style.pointerEvents = 'none'; 
            }
        }
    }
}



function resetContadorAtletasSaaS() {
    contAtletas = 1;
}

if (!window.nativeFecharModalConfig && typeof window.fecharModalConfig === 'function') {
    window.nativeFecharModalConfig = window.fecharModalConfig;
}

window.fecharModalConfig = function(idModal) {
    if (idModal === 'modal-agendamento') {
		// 💉 INJEÇÃO: Remove a ponte de sincronização para liberar memória RAM
        window.atualizarHorariosModalSaaS = null;
		
        const container = document.getElementById('jogadoresContainerSaaS');
        if (container) {
            while (container.children.length > 1) {
                container.removeChild(container.lastChild);
            }
            const btnAdd = document.getElementById('btn-add-atleta-SaaS');
            if (btnAdd) {
                btnAdd.style.opacity = '1'; 
                btnAdd.style.pointerEvents = 'auto'; 
            }
        }
        resetContadorAtletasSaaS();
    }
    if (typeof window.nativeFecharModalConfig === 'function') {
        window.nativeFecharModalConfig(idModal);
    }
};

function handleConvidadoSelectSaaS(el) {}



// ====================================================================
// MÓDULO DE GRAVAÇÃO ATÔMICA DE RESERVAS (SaaS) - COM TRANSAÇÕES E ROLLBACK
// ====================================================================
// ====================================================================
// 👮‍♂️ MÓDULO DE FISCALIZAÇÃO (ALFÂNDEGA DE REGRAS SAAS)
// Funções puras de validação. Retornam uma string de erro ou null se passar.
// ====================================================================

function validarRegraDuplasSaaS(isDupla, qtdJogadores) {
    if (isDupla && qtdJogadores < 4) {
        return "Este horário é exclusivo para Duplas. É obrigatório cadastrar os 4 jogadores!";
    }
    return null; // Sinal Verde
}

function validarAntiMonopolioSaaS(listaNomesCompletos, listaApelidos, todasReservas, limiteAtivo) {
    if (limiteAtivo <= 0 || !todasReservas) return null; // Regra desligada ou banco vazio

    const agora = new Date();
    let contagemPorJogador = {};
    
    // Zera o placar para todos os jogadores do pacote
    listaNomesCompletos.forEach(nome => contagemPorJogador[nome.toUpperCase()] = 0);

    // Varre o banco de dados fotográfico
    Object.keys(todasReservas).forEach(quadra => {
        const slotsQuadra = todasReservas[quadra] || {};
        Object.keys(slotsQuadra).forEach(slotKey => {
            const r = slotsQuadra[slotKey];
            if (!r || r.status === 'aula_cancelada' || !r.dataCompleta) return;
            if (r.borda === undefined && r.duracao === 2) return; // Ignora a segunda hora do bloco de 2h

            const partesData = r.dataCompleta.split('-');
            const duracaoDaReserva = parseInt(r.duracao) || 1;
            
            // 🕰️ CORREÇÃO: O relógio agora calcula o Término da partida (Hora + Duração)
            const dataTermino = new Date(parseInt(partesData[0]), parseInt(partesData[1]) - 1, parseInt(partesData[2]), r.hora + duracaoDaReserva, 0, 0, 0);

            // Só libera a cota do jogador quando o jogo realmente chegar ao fim!
            if (dataTermino > agora) {
                const jogadoresDestaReserva = (r.jogadores_completo || r.jogadores || "").toUpperCase();
                listaNomesCompletos.forEach(nome => {
                    if (jogadoresDestaReserva.includes(nome.toUpperCase())) {
                        contagemPorJogador[nome.toUpperCase()]++;
                    }
                });
            }
        });
    });

    // Emite o veredito
    for (let i = 0; i < listaNomesCompletos.length; i++) {
        if (contagemPorJogador[listaNomesCompletos[i].toUpperCase()] >= limiteAtivo) {
            const apelidoEstourado = listaApelidos[i] || listaNomesCompletos[i];
            
            // 🧠 TRUQUE DO PRIMEIRO NOME: Pega apenas a primeira palavra antes do espaço
            const primeiroNome = apelidoEstourado.trim().split(' ')[0];
            
            // 🧠 BIFURCAÇÃO DE MENSAGEM (Humanização UX com Quebra de Linha)
            if (limiteAtivo === 1) {
                return `${primeiroNome} possui uma reserva ativa.<br>Conclua o jogo pendente para realizar novos agendamentos.`;
            } else {
                return `${primeiroNome} atingiu o limite de ${limiteAtivo} reservas ativas.<br>Conclua um dos jogos pendentes para realizar novos agendamentos.`;
            }
        }
    }
    return null; // Sinal Verde
}

// ====================================================================
// 🎼 MOTOR ORQUESTRADOR: O MAESTRO DE AGENDAMENTOS (Fase Refatorada)
// ====================================================================

function validarEAgendarPartidaSaas() {
    if (navigator.vibrate) navigator.vibrate(40);

    // ----------------------------------------------------
    // 1. A COLETA (Montagem do Pacote de Dados da UI)
    // ----------------------------------------------------
    const selectDuracao = document.getElementById('saas-duracao') || document.getElementById('saas-duracao-reserva');
    const selectDia = document.getElementById('saas-dia') || document.getElementById('saas-dia-reserva');
    const selectHora = document.getElementById('saas-hora') || document.getElementById('saas-hora-reserva');
    
    const pacote = {
        duracao: selectDuracao ? parseInt(selectDuracao.value) : 1,
        dia: selectDia ? parseInt(selectDia.value) : 1,
        hora: selectHora ? parseInt(selectHora.value) : 6,
        quadraAlvo: "Quadra - 1",
        listaCamposBrutos: [],
        dataCompletaFormato: new Date().toISOString().split('T')[0]
    };

    if (typeof quadraSelecionadaSaaS !== 'undefined' && quadraSelecionadaSaaS) {
        const match = quadraSelecionadaSaaS.match(/\d+/);
        pacote.quadraAlvo = match ? `Quadra - ${match[0]}` : quadraSelecionadaSaaS;
    }

    const j1Select = document.getElementById('saas-jogador1');
    if (j1Select && j1Select.value) pacote.listaCamposBrutos.push(j1Select.value);
    
    for (let i = 2; i <= 4; i++) {
        const campoDinamico = document.getElementById(`saas-jogador${i}`);
        if (campoDinamico && campoDinamico.value) pacote.listaCamposBrutos.push(campoDinamico.value);
    }

    if (pacote.listaCamposBrutos.length === 0) {
        pacote.listaCamposBrutos.push(localStorage.getItem('jogadorLogadoNome') || "Sócio");
    }

    const linhaDatasTabela = document.getElementById('linha-datas-tabela');
    if (linhaDatasTabela && linhaDatasTabela.children[pacote.dia - 1]) {
        const dataTextoOriginal = linhaDatasTabela.children[pacote.dia - 1].textContent.trim();
        const partesData = dataTextoOriginal.split('/');
        if (partesData.length === 3) {
            pacote.dataCompletaFormato = `${partesData[2]}-${partesData[1]}-${partesData[0]}`;
        }
    }

    const celAlvo1 = document.getElementById(`cel-${pacote.hora}-${pacote.dia}`);
    const celAlvo2 = (pacote.duracao === 2) ? document.getElementById(`cel-${pacote.hora + 1}-${pacote.dia}`) : null;
    pacote.isDupla = (celAlvo1 && celAlvo1.classList.contains('celula-dupla')) || (celAlvo2 && celAlvo2.classList.contains('celula-dupla'));

    // ----------------------------------------------------
    // 1.5. ALFÂNDEGA DO QUÓRUM MÍNIMO (Barreira de Entrada)
    // ----------------------------------------------------
    let quorumExigido = 1;
    if (typeof configRegrasGlobal !== 'undefined' && configRegrasGlobal) {
        if (pacote.duracao === 1) {
            quorumExigido = configRegrasGlobal.Quorum1h !== undefined ? parseInt(configRegrasGlobal.Quorum1h) : 1;
        } else {
            quorumExigido = configRegrasGlobal.Quorum2h !== undefined ? parseInt(configRegrasGlobal.Quorum2h) : 2;
        }
    }

    // Conta quantos jogadores foram preenchidos no formulário
    const qtdJogadoresPreenchidos = pacote.listaCamposBrutos.length;

    if (qtdJogadoresPreenchidos < quorumExigido) {
        const txtHora = pacote.duracao === 1 ? 'hora' : 'horas';
        const txtJogador = quorumExigido === 1 ? 'jogador' : 'jogadores';
        
        showToast(`O quórum mínimo para ${pacote.duracao} ${txtHora} é de ${quorumExigido} ${txtJogador}. Adicione mais pessoas.`, "warning");
        return; // Aborta o agendamento na mesma hora!
    }

    // ----------------------------------------------------
    // 2. ALFÂNDEGA SÍNCRONA (Validações imediatas sem banco)
    // ----------------------------------------------------
    const erroDuplas = validarRegraDuplasSaaS(pacote.isDupla, qtdJogadoresPreenchidos);
    if (erroDuplas) {
        showToast(erroDuplas, "error");
        return; // Aborta
    }

    // Trava a UI para processamento
    const btnSubmit = document.getElementById('btn-saas-confirmar-agendamento');
    if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.textContent = "Validando regras...";
    }

    // ----------------------------------------------------
    // 3. A GRANDE LEITURA (Snapshot Fotográfico do Banco)
    // ----------------------------------------------------
    const limiteAtivo = (configRegrasGlobal && configRegrasGlobal.LimiteReservas !== undefined) ? parseInt(configRegrasGlobal.LimiteReservas) : 3;

    Promise.all([
        database.ref(`${raizBanco}/jogadores`).once('value'),
        (limiteAtivo > 0) ? database.ref(`${raizBanco}/reservas`).once('value') : Promise.resolve(null)
    ]).then(([snapJogadores, snapReservas]) => {
        const bancoJogadores = snapJogadores.val() || {};
        const todasReservas = snapReservas ? snapReservas.val() : null;
        
        let listaApelidos = [];
        let listaNomesCompletosReais = [];

        // Converte as identidades brutas da UI em nomes reais
        pacote.listaCamposBrutos.forEach(valorCampo => {
            if (bancoJogadores[valorCampo]) {
                listaApelidos.push(bancoJogadores[valorCampo].apelido || "Sócio");
                listaNomesCompletosReais.push(bancoJogadores[valorCampo].nomeCompleto || "Sócio");
            } else {
                const idEncontrado = Object.keys(bancoJogadores).find(key => 
                    bancoJogadores[key].nomeCompleto && bancoJogadores[key].nomeCompleto.toUpperCase() === valorCampo.toUpperCase()
                );
                if (idEncontrado) {
                    listaApelidos.push(bancoJogadores[idEncontrado].apelido);
                    listaNomesCompletosReais.push(bancoJogadores[idEncontrado].nomeCompleto);
                } else {
                    listaApelidos.push(valorCampo);
                    listaNomesCompletosReais.push(valorCampo);
                }
            }
        });

        // ----------------------------------------------------
        // 4. ALFÂNDEGA ASSÍNCRONA (Validações usando os dados)
        // ----------------------------------------------------
        const erroMonopolio = validarAntiMonopolioSaaS(listaNomesCompletosReais, listaApelidos, todasReservas, limiteAtivo);
        if (erroMonopolio) {
            showToast(erroMonopolio, "error", 4500);
            throw new Error("VALIDACAO_FALHOU"); // Ejeta do fluxo de gravação
        }

        // ESPAÇO PARA FUTURAS REGRAS:
        // const erroRegraFutura = validarMinhaNovaRegraSaaS(pacote, todasReservas);
        // if (erroRegraFutura) { ... throw new Error("VALIDACAO_FALHOU"); }

        // ----------------------------------------------------
        // 5. A GRAVAÇÃO (Transação Atômica no Firebase)
        // ----------------------------------------------------
        if (btnSubmit) btnSubmit.textContent = "Agendando...";

        const stringApelidosExibicao = listaApelidos.join(', ');
        const stringCompletosExibicao = listaNomesCompletosReais.join(', ');
        const organizadorPrincipal = listaNomesCompletosReais[0] || "Sócio";
        const organizadorApelido = listaApelidos[0] || "Sócio";

        // 🧠 INTELIGÊNCIA DE CONVITE SAAS (A Leitura do Interruptor Mestre)
        const exigenciaAtiva = (configRegrasGlobal && configRegrasGlobal.ReservasPorConfirmacao !== false);
        const prazoHoras = (configRegrasGlobal && configRegrasGlobal.horasParaExpirar !== undefined) ? parseInt(configRegrasGlobal.horasParaExpirar) : 2;
        
        let objetoConfirmacoes = {};
        let statusFinal = "confirmada";
        let timestampExpiracao = null;

        // 📅 VERIFICAÇÃO DE CALENDÁRIO: A reserva é para hoje?
        const hojeObj = new Date();
        const strHoje = `${hojeObj.getFullYear()}-${String(hojeObj.getMonth() + 1).padStart(2, '0')}-${String(hojeObj.getDate()).padStart(2, '0')}`;
        const reservaParaHoje = (pacote.dataCompletaFormato === strHoje);

        // Se a regra estiver ON, houver mais de 1 jogador E a reserva NÃO for para hoje, nasce PENDENTE
        if (exigenciaAtiva && listaApelidos.length > 1 && !reservaParaHoje) {
            statusFinal = "pendente";
            timestampExpiracao = Date.now() + (prazoHoras * 60 * 60 * 1000);
            
            // O organizador entra como confirmado (true), os convidados entram como pendentes (false)
            for (let i = 0; i < listaApelidos.length; i++) {
                if (i === 0) {
                    objetoConfirmacoes[listaApelidos[i]] = true; 
                } else {
                    objetoConfirmacoes[listaApelidos[i]] = false; 
                }
            }
        } else {
            // Se a regra for OFF, for jogo individual, OU o jogo for hoje: tudo nasce CONFIRMADO
            statusFinal = "confirmada";
            listaApelidos.forEach(apelido => {
                objetoConfirmacoes[apelido] = true;
            });
        }

        // O chassi do pacote que vai para o banco
        const objetoReservaReferencia = {
            borda: `${pacote.duracao}h`,
            status: statusFinal,                       
            dataCompleta: pacote.dataCompletaFormato,          
            dia: pacote.dia,
            hora: pacote.hora,
            duracao: pacote.duracao,
            organizador: organizadorPrincipal,          
            jogadores: stringApelidosExibicao,          
            jogadores_completo: stringCompletosExibicao,
            confirmacoes: objetoConfirmacoes            
        };

        // Injeta o cronômetro apenas se a reserva for pendente
        if (timestampExpiracao) {
            objetoReservaReferencia.expiraEm = timestampExpiracao;
        }

        const chaveReservaLimpa = `${pacote.dia}_${pacote.hora}`;
		
        const caminhoKey1 = `${raizBanco}/reservas/${pacote.quadraAlvo}/${chaveReservaLimpa}`;
        const caminhoKey2 = `${raizBanco}/reservas/${pacote.quadraAlvo}/${pacote.dia}_${pacote.hora + 1}`;

        return database.ref(caminhoKey1).transaction(currentData => {
            if (currentData === null || currentData.status === 'aula_cancelada') return objetoReservaReferencia;
            return; // Aborta se tiver colisão
        })
        .then(result1 => {
            if (!result1.committed) throw new Error("COLISAO_HORARIO_MESTRE");
            if (pacote.duracao === 1) return true;

            const objetoReservaReferencia2 = { ...objetoReservaReferencia, hora: pacote.hora + 1 };
            delete objetoReservaReferencia2.borda;

            return database.ref(caminhoKey2).transaction(currentData2 => {
                if (currentData2 === null || currentData2.status === 'aula_cancelada') return objetoReservaReferencia2;
                return;
            })
            .then(result2 => {
                if (!result2.committed) {
                    return database.ref(caminhoKey1).remove().then(() => { throw new Error("COLISAO_HORARIO_SEQUENCIAL"); });
                }
                return true;
            });
        });
    })
    .then(() => {
        showToast("Agendamento confirmado com sucesso!", "success");
        if (typeof fecharModalConfig === 'function') fecharModalConfig('modal-agendamento'); 
    })
    .catch(err => {
        // Controle de falhas inteligente
        if (err.message === "VALIDACAO_FALHOU") {
            // O Toast de aviso já foi emitido pelo fiscal, morre silenciosamente.
        } else if (err.message === "COLISAO_HORARIO_MESTRE") {
            showToast("Ops! Este horário acabou de ser preenchido por outro utilizador.", "error");
        } else if (err.message === "COLISAO_HORARIO_SEQUENCIAL") {
            showToast("Ops! A segunda hora deste bloco de 2h já se encontra ocupada.", "error");
        } else {
            console.error("Erro no motor orquestrador:", err);
            showToast("Erro de comunicação ao processar o agendamento.", "error");
        }
    })
    .finally(() => {
        // Libera a UI independente do que acontecer
        if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.textContent = "Confirmar Agendamento";
        }
    });
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
            //if (window.modoVisualizacaoQuadras === 'grade') {
			if (modoVisualizacaoQuadras === 'grade') {
                grid.style.setProperty('grid-template-columns', 'repeat(4, 1fr)', 'important');
                if (modal) {
                    modal.classList.add('modal-modo-grade');
                    modal.classList.remove('modal-modo-lista');
                }
            } else {
                grid.style.setProperty('grid-template-columns', '50px 1fr', 'important');
                if (modal) {
                    modal.classList.add('modal-modo-lista');
                    modal.classList.remove('modal-modo-grade'); 
                }
            }

            for (let i = 1; i <= qtdSalva; i++) {
                const nomeQuadra = typeof nomesSalvos[i] === 'object' ? (nomesSalvos[i].nome || `Quadra ${i}`) : (nomesSalvos[i] || `Quadra ${i}`);
                
				// 🌟 ADICIONE ESTA LINHA EXATAMENTE AQUI:
                const statusQ = (configQuadrasGlobal.nomes && configQuadrasGlobal.nomes['status_' + i]) || 'liberada';
				
                // ALGORITMO REATIVO ATLETA: Filtra linhas em tempo de execução
                //if (window.modoVisualizacaoQuadras === 'lista' && termo !== '') {
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

        //if (window.modoVisualizacaoQuadras === 'grade') {
		if (modoVisualizacaoQuadras === 'grade') {
            if (btnGrade) btnGrade.classList.add('active'); 
            if (btnLista) btnLista.classList.remove('active'); 
        } else {
            if (btnLista) btnLista.classList.add('active'); 
            if (btnGrade) btnGrade.classList.remove('active'); 
        }

        if (btnGrade) {
            btnGrade.onclick = () => {
                //window.modoVisualizacaoQuadras = 'grade';
				modoVisualizacaoQuadras = 'grade';
                btnGrade.classList.add('active');
                if (btnLista) btnLista.classList.remove('active'); 
                if (inputBusca) inputBusca.value = ''; // Limpa ao voltar para a grade
                atualizarBotoesEestilo();
            };
        }

        if (btnLista) {
            btnLista.onclick = () => {
                //window.modoVisualizacaoQuadras = 'lista';
				modoVisualizacaoQuadras = 'lista';
                btnLista.classList.add('active');
                if (btnGrade) btnGrade.classList.remove('active'); 
                atualizarBotoesEestilo();
            };
        }

        // Vincula a digitação do atleta à reatividade instantânea
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
        bloco.style.display = 'block'; 
        icone.parentElement.classList.add('expandido'); 
        document.getElementById('legenda-bloco').style.display = 'none';   
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
    const sheet = document.getElementById('sheet-perfil-jogador');
    if (!sheet) return;

    let nomeExibicao = "Jogador";
    let clubeExibicao = "Arena";

    if (isGestorLogado) {
        nomeExibicao = "Gestor"; 
        const txtClubeDOM = document.getElementById('txt-nome-clube');
        clubeExibicao = (txtClubeDOM && txtClubeDOM.textContent !== "Carregando...") 
            ? txtClubeDOM.textContent 
            : (clubeAtivoId || "Painel Admin");
    } else {
        nomeExibicao = localStorage.getItem('jogadorLogadoNome') || "Jogador";
        clubeExibicao = localStorage.getItem('setpoint_jogador_clube_nome') || "Arena";
    }

    const elClube = document.getElementById('sheet-clube-jogador');
    document.getElementById('sheet-nome-jogador').textContent = nomeExibicao;
    
    if (elClube) {
        elClube.textContent = clubeExibicao;

        // 💉 INJEÇÃO DA VERSÃO NATIVA (Opção A - Abaixo do Vínculo)
        let elVersao = document.getElementById('sheet-versao-app');
        if (!elVersao) {
            elVersao = document.createElement('div');
            elVersao.id = 'sheet-versao-app'; // O ID serve de âncora para a estilização do config.css
            
            // Insere o elemento dinamicamente logo após o bloco do clube
            elClube.parentNode.insertBefore(elVersao, elClube.nextSibling);
        }

        // 🧠 LEITURA INTELIGENTE DA PONTE DO CAPACITOR OU DO FIREBASE (SAAS)
        if (window.AndroidBridge && typeof window.AndroidBridge.getAppVersion === 'function') {
            elVersao.textContent = "Versão " + window.AndroidBridge.getAppVersion();
        } else {
            // Se for PWA, iPhone ou Computador, lê a versão sincronizada do Firebase!
            elVersao.textContent = "Versão " + versaoWebGlobal; 
        }
    }

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
    }, 300);
}
 
function deslogarJogadorSaaS() {
    fecharSheetPerfil();
    
    showPrompt('Sair da Conta', 'Tem certeza que deseja deslogar? Você precisará selecionar seu nome e inserir sua senha no próximo acesso.', () => {
        localStorage.removeItem('jogadorLogadoId');
        localStorage.removeItem('jogadorLogadoNome');
        
        showToast('Sessão encerrada.', 'success');
        
        setTimeout(() => location.reload(), 500); 
    });
}


// ====================================================================
// 🎮 10. MOTOR CONTROLADOR: GAVETA HÍBRIDA DE AÇÕES E EXCLUSÃO (SaaS)
// ====================================================================

function abrirMenuAcoesReservaSaaS(dia, hora, dadosReserva) {
    const modal = document.getElementById('modal-acoes-reserva');
    const txtDetalhes = document.getElementById('txt-acoes-detalhes');
    const content = modal ? modal.querySelector('.modal-acoes-content') : null;

    if (!modal || !dadosReserva) return;

    // 🛡️ PORTARIA DE SEGURANÇA: Avalia se o usuário ativo tem poder de alteração
    const nomeLogado = localStorage.getItem('jogadorLogadoNome') || "";
    let perfis = {};
    try { perfis = JSON.parse(localStorage.getItem('jogadorLogadoPerfis') || '{}'); } catch(e) {}
    const ehAdmin = perfis['Admin'] === true;

    // SHIELD ANTI-SUTILEZAS: Normaliza as strings para evitar furos de espaços ou case-sensitive
    const organizadorReserva = (dadosReserva.organizador || "").trim().toUpperCase();
    const usuarioAtivo = nomeLogado.trim().toUpperCase();

    // Só pode alterar se for estritamente o Gestor, Admin ou o próprio Organizador normalizado
    const podeAlterar = (isGestorLogado === true) || (ehAdmin === true) || (organizadorReserva === usuarioAtivo);

    // 1. Vincula o botão "Ver Detalhes" (Liberado para TODOS)
    const btnVerDetalhes = document.getElementById('btn-saas-ver-detalhes');
    if (btnVerDetalhes) {
        btnVerDetalhes.onclick = () => {
            fecharMenuAcoesReservaSaaS();
            abrirModalVerDetalhesSaaS(dia, hora, dadosReserva);
        };
    }

    // 2. Vincula o botão "Excluir" (Apenas quem pode alterar)
    const btnExcluir = document.getElementById('btn-saas-excluir-reserva');

    if (podeAlterar) {
        modal.classList.remove('saas-modo-leitura');
        if (btnExcluir) {
            btnExcluir.onclick = () => {
                fecharMenuAcoesReservaSaaS();
                solicitarExclusaoReservaSaaS(dia, hora, dadosReserva);
            };
        }
    } else {
        modal.classList.add('saas-modo-leitura');
    }

    // Mapeamento de dias para montagem do subtítulo
    const diasSemana = ["", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
    const nomeDia = diasSemana[dia] || "Dia";
    const horaFormatada = String(hora).padStart(2, '0') + ":00";
    
    if (txtDetalhes) {
        txtDetalhes.textContent = `${quadraSelecionadaSaaS} • ${nomeDia} às ${horaFormatada}`;
    }

    modal.style.display = 'flex';

    if (window.innerWidth <= 767 && content) {
        setTimeout(() => {
            content.style.transform = 'translateY(0)';
        }, 10);
    }
}




function fecharMenuAcoesReservaSaaS(event) {
    const modal = document.getElementById('modal-acoes-reserva');
    const content = modal ? modal.querySelector('.modal-acoes-content') : null;

    if (!modal) return;

    // Se o clique veio de fora da área do card (no backdrop), autoriza o fechar
    if (event && event.target !== modal) return;

    if (window.innerWidth <= 767 && content) {
        // Mobile: Desliza o painel para baixo primeiro, depois desliga o display
        content.style.transform = 'translateY(100%)';
        setTimeout(() => {
            modal.style.display = 'none';
        }, 250);
    } else {
        // Desktop: Desliga de imediato
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
    
    // 🔹 Desliga o motor do relógio quando a janela fecha
    if (intervaloDetalhesSaaS) clearInterval(intervaloDetalhesSaaS);
}

// 🧠 Auxiliar para converter Caixa Alta em Title Case com Ponto
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

    // Abrevia nomes do meio (ex: ADRIANO G FEITOSA ➔ Adriano G. Feitosa)
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

    const duracao = parseInt(dadosReserva.duracao) || 1;
    const diasSemana = ["", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"];
    const nomeDia = diasSemana[dia] || "Dia";

    let dataFormatada = "";
    if (dadosReserva.dataCompleta) {
        const partes = dadosReserva.dataCompleta.split('-'); // YYYY-MM-DD
        if (partes.length === 3) dataFormatada = `, ${partes[2]}/${partes[1]}`;
    }

    const hInicio = String(hora).padStart(2, '0') + ":00";
    const hFim = String(hora + duracao).padStart(2, '0') + ":00";

    // 1. Cabeçalho Reativo (1-hora-detalhes vs 2-horas-detalhes)
    const header = document.getElementById('detalhes-header');
    const icone = document.getElementById('detalhes-icone-horario');
    if (header) {
        header.className = `card-header-detalhes ${duracao === 2 ? 'header-2h' : 'header-1h'}`;
    }
    if (icone) {
        icone.textContent = duracao === 2 ? 'schedule' : 'event';
    }

    // 2. Textos de Quadra e Horário
    document.getElementById('detalhes-txt-quadra').textContent = quadraSelecionadaSaaS || "Quadra";
    document.getElementById('detalhes-texto-data-hora').textContent = `${nomeDia}${dataFormatada} • ${hInicio} - ${hFim}`;

    // 3. Bloco Organizador com Formatação Title Case
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

    // 4. Lista de Jogadores com Fonte Normal (Sem Negrito)
    const containerJogadores = document.getElementById('detalhes-lista-jogadores');
    containerJogadores.innerHTML = '';

    const stringJogadores = dadosReserva.jogadores_completo || dadosReserva.jogadores || "";
    const listaJogadores = stringJogadores.split(',').map(n => n.trim()).filter(n => n.length > 0);
    const listaApelidosParaBusca = (dadosReserva.jogadores || "").split(',').map(n => n.trim());

    let temPendente = false; // 🔹 Sensor para ligar o relógio

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
                        temPendente = true; // 🔹 Opa! Achamos um pendente!
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
            <span style="font-size: 13.5px;"><span class="status-dot-detalhes ${statusClasseDot}"></span>${nomeFormatado}</span>
            <span class="${statusClasseTxt}">${statusTexto}</span>
        `;
        containerJogadores.appendChild(row);
    });

    // 🔹 MÁGICA: Injeta o relógio na linha do título "JOGADORES"
    const tituloDOM = containerJogadores.previousElementSibling;
    if (tituloDOM) {
        if (temPendente && dadosReserva.expiraEm) {
            tituloDOM.innerHTML = `JOGADORES <span id="badge-timer-detalhes" data-expira="${dadosReserva.expiraEm}">Calculando...</span>`;
            tituloDOM.classList.add('titulo-jogadores-flex');
            iniciarRelogioDetalhesSaaS(); // Liga o motor
        } else {
            tituloDOM.innerHTML = `JOGADORES`;
            tituloDOM.classList.remove('titulo-jogadores-flex');
            if (intervaloDetalhesSaaS) clearInterval(intervaloDetalhesSaaS);
        }
    }

    // 5. Exibe a Janela
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
            
            // 🔫 NOVO: O relógio zerou? Dispara o Faxineiro na mesma hora!
            if (typeof executarFaxinaAutomaticaSaaS === 'function') {
                executarFaxinaAutomaticaSaaS();
            }
        } else {
            const horas = Math.floor(diff / (1000 * 60 * 60));
            const minutos = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const segundos = Math.floor((diff % (1000 * 60)) / 1000);
            
            badge.innerHTML = `<i class="material-icons" style="font-size:13px; margin-right:4px;">timer</i> ${String(horas).padStart(2, '0')}h ${String(minutos).padStart(2, '0')}m ${String(segundos).padStart(2, '0')}s`;
        }
    };

    atualizar(); // Roda a primeira vez imediatamente
    intervaloDetalhesSaaS = setInterval(atualizar, 1000); // 🔹 Bate a cada 1 segundo!
}



/**
 * Portaria de Segurança & Apresentação Premium: Valida as credenciais do usuário ativo,
 * extrai a lista de nomes formatados em Title Case e abre o prompt de descarte.
 */
function solicitarExclusaoReservaSaaS(dia, hora, dadosReserva) {
    // 1. Recupera credenciais do atleta ativo na RAM e LocalStorage
    const nomeLogado = localStorage.getItem('jogadorLogadoNome') || "";
    let perfis = {};
    try { perfis = JSON.parse(localStorage.getItem('jogadorLogadoPerfis') || '{}'); } catch(e) {}
    const ehAdmin = perfis['Admin'] === true;

    // 2. Validação SSOT: Apenas gestores, administradores ou o próprio organizador podem excluir
    const podeExcluir = isGestorLogado || ehAdmin || (dadosReserva.organizador === nomeLogado);
    if (!podeExcluir) {
        showToast("Apenas o organizador da reserva ou um administrador pode excluir este agendamento.", "error");
        return;
    }

    // 3. Quebra a string de jogadores cadastrados em um array limpo[cite: 8]
    const stringJogadores = dadosReserva.jogadores_completo || dadosReserva.jogadores || "";
    const listaJogadores = stringJogadores.split(',').map(nome => nome.trim()).filter(nome => nome.length > 0);

    // 4. Constrói as linhas contendo os nomes dos atletas em Title Case (Iniciais Maiúsculas)
    let listHtml = "";
    listaJogadores.forEach(jogador => {
        // Converte o nome inteiro para minúsculas e capitaliza a primeira letra de cada palavra
        const nomeFormatado = jogador.toLowerCase().split(/\s+/).map(palavra => {
            // Mantém preposições comuns de nomes em letras minúsculas para um visual profissional
            if (['da', 'de', 'do', 'dos', 'das'].includes(palavra)) {
                return palavra;
            }
            return palavra.charAt(0).toUpperCase() + palavra.slice(1);
        }).join(' ');

        listHtml += `<li class="prompt-saas-item"><span class="prompt-saas-bullet">•</span> ${nomeFormatado}</li>`;
    });

    // 5. Montagem do esqueleto semântico reduzido ao essencial[cite: 8]
    const promptBodyHTML = `
        <div class="prompt-saas-container">
            <fieldset class="prompt-saas-fieldset">
                <legend class="prompt-saas-legend">${quadraSelecionadaSaaS.toUpperCase()}</legend>
                <ul class="prompt-saas-list">
                    ${listHtml}
                </ul>
            </fieldset>

            <p class="prompt-saas-warning">Você tem certeza que deseja excluir esta reserva?</p>
        </div>
    `;

    // 6. Monta o lote de horários e dispara o Prompt de Confirmação
    showPrompt(
        "Confirmação",
        promptBodyHTML,
        () => {
            const duracao = parseInt(dadosReserva.duracao) || 1;
            const listaDeSlots = [];

            // Adiciona a primeira hora (mestre) no lote
            listaDeSlots.push({ dia: dia, hora: hora });

            // Se for um bloco unificado de 2 horas, injeta a segunda hora na esteira
            if (duracao === 2) {
                listaDeSlots.push({ dia: dia, hora: hora + 1 });
            }

            // Despacha o lote completo para o novo pipeline de dados
            executarPipelineExclusaoSaaS(listaDeSlots, dadosReserva, "Excluído via Painel pelo Usuário");
        }
    );
}




/**
 * Motor Atômico de Exclusão (Fase 2.5 - Híbrido Premium): Varre os slots informados,
 * avalia trancas de matriz fixa (Aulas), aplica Multi-Path Update no Firebase e
 * despacha relatórios ricos e humanizados no padrão ouro para o repositório do GitHub.
 */
function executarPipelineExclusaoSaaS(listaDeSlots, dadosReserva, motivo) {
    if (!listaDeSlots || listaDeSlots.length === 0) return;

    let quadraChaveFixa = "Quadra - 1";
    if (quadraSelecionadaSaaS) {
        const match = quadraSelecionadaSaaS.match(/\d+/);
        quadraChaveFixa = match ? `Quadra - ${match[0]}` : quadraSelecionadaSaaS;
    }

    const updatePayload = {};
    const quadraFoco = listaDeSlots[0].quadra || quadraChaveFixa;

    // 🧠 DETECTOR DE IDENTIDADE 1: Converte chaves físicas em nomes amigáveis para leitura do gestor
    let nomeQuadraAmigavel = quadraSelecionadaSaaS || "Quadra 1 - Coberta";
    const numQuadra = quadraFoco.match(/\d+/);
    if (numQuadra && configQuadrasGlobal && configQuadrasGlobal.nomes) {
        const dadosQ = configQuadrasGlobal.nomes[numQuadra[0]];
        if (dadosQ) {
            nomeQuadraAmigavel = typeof dadosQ === 'object' ? (dadosQ.nome || `Quadra ${numQuadra[0]}`) : dadosQ;
        }
    }

    // Monta o payload de descarte avaliando a integridade das grades de aulas fixas
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

    // 🎯 A FUSÃO PERFEITA: Estrutura SaaS indexável por fora, Riqueza do Modelo Antigo por dentro
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

    // Disparo Unificado no Firebase
    database.ref(raizBanco).update(updatePayload)
    .then(() => {
        showToast("Reserva cancelada com sucesso!", "success");
        // Despacha o recibo individual e completo para a esteira do GitHub
        enviarFilaLogsAoGitHubSaaS([logReciboRich]);
    })
    .catch(err => {
        console.error("❌ [Pipeline SaaS] Erro ao processar exclusão em lote:", err);
        showToast("Erro ao processar a exclusão no banco de dados.", "error");
    });
}

/**
 * Motor de Faxina Automatizada (Fase 7 - Sobrevivência de Quórum): 
 * 1. Limpa dias antigos.
 * 2. Caça convites pendentes vencidos e APLICA A REGRA DE QUÓRUM.
 *    - Se tiver quórum, expulsa apenas os pendentes e salva a reserva.
 *    - Se não tiver quórum, exclui a reserva inteira.
 * 3. RESGATA logs que falharam por queda de internet no GitHub.
 */
function executarFaxinaAutomaticaSaaS() {
    console.log("🤖 [SaaS Faxina] Iniciando varredura de histórico, convites expirados e resgates...");
    
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const linhaDeCorte = new Date(hoje);
    linhaDeCorte.setDate(hoje.getDate() - DiasParaExibir); 
    const agoraMs = Date.now(); 
    
    // 🔥 Agora fazemos DUAS consultas ao Firebase ao mesmo tempo: Reservas + Fila de Falhas
    Promise.all([
        database.ref(`${raizBanco}/reservas`).once('value'),
        database.ref(`${raizBanco}/logs_pendentes`).once('value')
    ]).then(([snapReservas, snapPendentes]) => {
        const todasAsReservas = snapReservas.val() || {};
        const logsPendentesObj = snapPendentes.val() || {};
        
        const updatePayload = {};
        const filaLogsPremium = [];
        let totalPartidasLimpas = 0;

        // ♻️ PASSO 1: Resgata os Logs Encalhados
        const chavesPendentes = Object.keys(logsPendentesObj);
        if (chavesPendentes.length > 0) {
            console.log(`♻️ [SaaS Faxina] Resgatando ${chavesPendentes.length} log(s) pendente(s) da fila de falhas.`);
            chavesPendentes.forEach(key => {
                filaLogsPremium.push(logsPendentesObj[key]);
            });
            // Apaga a fila no Firebase
            updatePayload['logs_pendentes'] = null; 
        }

        // 🧹 PASSO 2: Varre as Reservas (Histórico e Convites Expirados)
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
                if (!r || !r.dataCompleta || r.status === 'aula_cancelada') return;

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

                    // ----------------------------------------------------
                    // AVALIAÇÃO DE QUÓRUM PARA A SOBREVIVÊNCIA
                    // ----------------------------------------------------
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
                        
                        // Garante que o Organizador (índice 0) é contado caso ocorra erro no confs
                        if (idx === 0) isConfirmed = true;

                        if (isConfirmed) {
                            qtdConfirmados++;
                            newConfs[apelidoBusca] = true;
                            indicesConfirmados.push(idx);
                        }
                    });

                    // Define se a reserva atingiu o mínimo para sobreviver
                    const sobreviveuAoQuorum = conviteExpirou && !passouDoPrazoDeExibicao && (qtdConfirmados >= quorumExigido);

                    const pathNode1 = `reservas/${quadraChave}/${slotKey}`;
                    const temAula1 = aulaAtiva && configAula.Grade[slotKey] && configAula.Grade[slotKey] !== "";
                    
                    let proximaHora = horaReserva + 1;
                    let proximaChave = `${diaReserva}_${proximaHora}`;
                    let pathNode2 = `reservas/${quadraChave}/${proximaChave}`;
                    let temAula2 = aulaAtiva && configAula.Grade[proximaChave] && configAula.Grade[proximaChave] !== "";

                    if (sobreviveuAoQuorum) {
                        // ====================================================
                        // 1. SOBREVIVÊNCIA: EXPULSA PENDENTES E MANTÉM RESERVA
                        // ====================================================
                        const novosApelidos = indicesConfirmados.map(i => listApelidos[i]).join(', ');
                        const novosCompletos = indicesConfirmados.map(i => listCompleto[i]).join(', ');

                        const rAtualizada = { ...r };
                        rAtualizada.status = "confirmada";
                        rAtualizada.jogadores = novosApelidos;
                        rAtualizada.jogadores_completo = novosCompletos;
                        rAtualizada.confirmacoes = newConfs;
                        delete rAtualizada.expiraEm; // Desarma a bomba no banco

                        updatePayload[pathNode1] = rAtualizada;
                        chavesPuladas.add(slotKey);

                        if (duracaoReserva === 2) {
                            const rAtualizada2 = { ...rAtualizada };
                            rAtualizada2.hora = proximaHora;
                            delete rAtualizada2.borda; 
                            updatePayload[pathNode2] = rAtualizada2;
                            chavesPuladas.add(proximaChave);
                        }

                        // Log Riquíssimo de Auditoria
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
                            statusNoMomentoDaExclusao: "confirmada", // Virou confirmada
                            organizadorDaReserva: r.organizador || "Não Informado",
                            confirmacoes: newConfs,
                            jogadores: novosApelidos,
                            jogadores_completo: novosCompletos,
                            slotsExcluidos: [] // Nenhuma hora foi excluída fisicamente
                        };
                        filaLogsPremium.push(logEviccao);
                        totalPartidasLimpas++;

                    } else {
                        // ====================================================
                        // 2. ÓBITO: EXCLUSÃO TOTAL (Histórico ou Falta de Quórum)
                        // ====================================================
                        const slotsDestaPartida = [{ quadra: quadraChave, dia: diaReserva, hora: horaReserva }];

                        updatePayload[pathNode1] = temAula1 ? { status: 'aula_cancelada' } : null;
                        chavesPuladas.add(slotKey);

                        if (duracaoReserva === 2) {
                            slotsDestaPartida.push({ quadra: quadraChave, dia: diaReserva, hora: proximaHora });
                            updatePayload[pathNode2] = temAula2 ? { status: 'aula_cancelada' } : null;
                            chavesPuladas.add(proximaChave);
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

        // 🚀 DISPARO FINAL: Executa se limpamos/atualizamos alguma reserva OU se resgatamos algum log pendente
        if (totalPartidasLimpas > 0 || chavesPendentes.length > 0) {
            console.log(`🤖 [SaaS Faxina] Captura finalizada. Despachando lote para o Firebase...`);
            
            database.ref(raizBanco).update(updatePayload)
            .then(() => {
                console.log(`🤖 [SaaS Faxina] Firebase atualizado. Tentando enviar ${filaLogsPremium.length} relatórios para o GitHub...`);
                enviarFilaLogsAoGitHubSaaS(filaLogsPremium); 
                
                window.saasFaxinaPronta = true;
                if (typeof verificarLiberacaoTelaLoadingSaaS === 'function') { verificarLiberacaoTelaLoadingSaaS(); }
            })
            .catch(err => {
                console.error("❌ [SaaS Faxina] Falha ao aplicar descarte/atualização no Firebase:", err);
                window.saasFaxinaPronta = true;
                if (typeof verificarLiberacaoTelaLoadingSaaS === 'function') { verificarLiberacaoTelaLoadingSaaS(); }
            });
        } else {
            console.log("🤖 [SaaS Faxina] Varredura encerrada. Nenhuma reserva expirada ou log encalhado.");
            window.saasFaxinaPronta = true;
            if (typeof verificarLiberacaoTelaLoadingSaaS === 'function') { verificarLiberacaoTelaLoadingSaaS(); }
        }
    }).catch(err => {
        console.error("❌ [SaaS Faxina] Falha ao ler dados para triagem:", err);
    });
}


// ====================================================================
// 11. MOTOR DE PRESENÇA ONLINE GAVETA MATTE
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
    const filtrados = chavesOnline.filter(key => key !== 'GESTOR' && !saasUsuariosOnlineCache[key].isGestor);

    if (filtrados.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #888; font-size: 13.5px; margin: 15px 0; font-style: italic;">Nenhum atleta online no momento.</p>';
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
                t.parentElement.style.color = "#dc3545"; // Fica vermelho se zerar
                
                // 1. Remove a caixinha expirada da tela (se for a última, o modal fecha sozinho!)
                const card = t.closest('.convite-item');
                if (card && typeof concluirEfeitoCardSaaS === 'function') {
                    concluirEfeitoCardSaaS(card);
                }
                
                // 2. Dispara o Faxineiro na mesma hora para limpar o banco de dados
                if (typeof executarFaxinaAutomaticaSaaS === 'function') {
                    executarFaxinaAutomaticaSaaS();
                }
            } else {
                ativos++;
                const horas = Math.floor(diff / (1000 * 60 * 60));
                const minutos = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const segundos = Math.floor((diff % (1000 * 60)) / 1000);

                // ⏱️ Formatação idêntica às outras telas com segundos
                t.textContent = `${String(horas).padStart(2, '0')}h ${String(minutos).padStart(2, '0')}m ${String(segundos).padStart(2, '0')}s`;
            }
        });

        // Se zerou tudo, desliga o motor do relógio para economizar bateria do celular
        if (ativos === 0) clearInterval(intervaloConvitesSaaS);
    };

    atualizar(); 
    intervaloConvitesSaaS = setInterval(atualizar, 1000); // 🚀 Bate a cada 1 segundo
}


function fecharModalConvitesEntradaSaaS() {
    const modal = document.getElementById('modal-convites-entrada'); 
    if (!modal) return;
    
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

    // 1. Identifica a Identidade do Atleta Logado
    const idLogado = localStorage.getItem('jogadorLogadoId');
    const nomeCompletoBusca = localStorage.getItem('jogadorLogadoNome') || "Sócio";
    
    let apelidoBusca = nomeCompletoBusca;
    if (typeof jogadoresGlobal !== 'undefined' && jogadoresGlobal[idLogado]) {
        apelidoBusca = jogadoresGlobal[idLogado].apelido || nomeCompletoBusca;
    }

    // 📸 Foto dos dados da reserva antes da transação alterar ou excluir no banco
    let dadosReservaAntes = null;

    // 2. Feedback Visual Imediato (Optimistic UI)
    const card = document.getElementById(`convite-card-${quadraChave}-${slotKey}`);
    if (card) {
        card.style.opacity = '0.4';
        card.style.pointerEvents = 'none';
        card.style.transform = 'scale(0.98)';
        card.style.transition = 'all 0.2s';
    }

    const caminhoKey1 = `${raizBanco}/reservas/${quadraChave}/${slotKey}`;
    
    // 3. Transação Atômica no Firebase
    database.ref(caminhoKey1).transaction((reserva) => {
        if (!reserva) return null; // A reserva não existe mais

        // Captura o estado fotográfico original antes das edições
        dadosReservaAntes = JSON.parse(JSON.stringify(reserva));

        if (aceitou) {
            // =====================================
            // AÇÃO: CONFIRMAR PRESENÇA
            // =====================================
            if (reserva.confirmacoes && reserva.confirmacoes[apelidoBusca] !== undefined) {
                reserva.confirmacoes[apelidoBusca] = true;
            }
        } else {
            // =====================================
            // AÇÃO: RECUSAR CONVITE (Cirurgia de Dados)
            // =====================================
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

        // =====================================
        // REAVALIAÇÃO DO STATUS GERAL E QUÓRUM
        // =====================================
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

        // BARREIRA DE SOBREVIVÊNCIA
        if (qtdRestantes < quorumExigido) {
            console.log(`💀 [Quórum] Reserva cancelada: Restaram ${qtdRestantes} jogadores, mínimo exigido: ${quorumExigido}.`);
            return null; // O Firebase deleta a reserva mestre
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
        
        // Identifica o nome amigável da quadra para o relatório do GitHub
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

        // ====================================================
        // CENÁRIO 1: A RESERVA FOI CANCELADA (FALTA DE QUÓRUM)
        // ====================================================
        if (!reservaAtualizada) {
            const caminhoKey2 = `${raizBanco}/reservas/${quadraChave}/${dia}_${hora + 1}`;
            database.ref(caminhoKey2).remove(); // Apaga o segundo slot de 2h se existir

            // 📝 MONTA E DESPACHA O LOG DE EXCLUSÃO PARA O GITHUB
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

        // ====================================================
        // CENÁRIO 2: A RESERVA SOBREVIVEU (QUÓRUM MANTIDO)
        // ====================================================
        if (reservaAtualizada.duracao === 2) {
            const caminhoKey2 = `${raizBanco}/reservas/${quadraChave}/${dia}_${hora + 1}`;
            const reserva2 = JSON.parse(JSON.stringify(reservaAtualizada));
            reserva2.hora = hora + 1;
            delete reserva2.borda;
            
            database.ref(caminhoKey2).set(reserva2);
        }

        // 📝 MONTA E DESPACHA O LOG DE REMOÇÃO PARCIAL PARA O GITHUB
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
            card.style.opacity = '1';
            card.style.pointerEvents = 'auto';
            card.style.transform = 'scale(1)';
        }
    });
}



function concluirEfeitoCardSaaS(cardElement) {
    if (cardElement) {
        // Transição suave para o card sumir
        cardElement.style.transform = 'translateX(100%)';
        cardElement.style.opacity = '0';
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
