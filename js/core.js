
"use strict";

// ==========================================
// 1. CONFIGURAÇÕES BASE (FIREBASE E VARIÁVEIS GLOBAIS) 
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyARV9a_z2gzWHJ_I9hTxCM90ytvA_7qo0Y",
    authDomain: "agenda-5ce95.firebaseapp.com",
    databaseURL: "https://agenda-5ce95-default-rtdb.firebaseio.com/",
    projectId: "agenda-5ce95",
    storageBucket: "agenda-5ce95.firebasestorage.app",
    messagingSenderId: "852007565195",
    appId: "1:852007565195:web:d7bd789d140858f53f618e"
};

// Evita inicialização duplicada do Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);  
}

const database = firebase.database();  
const auth = firebase.auth(); 



// ==========================================
// 1. ESTADO GLOBAL DA APLICAÇÃO (Memória RAM do Sistema)
// ==========================================
let clubeAtivoId = "";          // Identificador único da arena para isolamento multi-inquilino (SaaS)
let versaoWebGlobal = "1.105";  // Versão mestre lida do Firebase para Web/iOS
let raizBanco = "";             // Caminho mestre dinâmico no Firebase Realtime Database
let carregamentoInicial = true; // Trava de segurança para rotinas que só devem rodar no primeiro boot
let isGestorLogado = false;     // Flag de portaria: define se quem está navegando é o administrador
let quadraSelecionadaSaaS = ""; // Armazena a string exata da quadra ativa selecionada nas abas
let DiasParaLimpar = 3;         // Parâmetro mestre de limite de antecedência para agendamentos
let DiasParaExibir = 1;         // Parâmetro mestre de retenção visual de dias passados na grade (Apenas Leitura)

// --- SINCRONIZAÇÃO EM TEMPO REAL ---
let regrasHorariosSaaS = null;  // Espelho local das regras de abertura/fechamento ditadas pelo gestor
let configAulasGlobal = {};     // Espelho local da Grade de Aulas
let configDuplasGlobal = {};    // Espelho local do Horário de Duplas
let configConvidadosGlobal = {}; // Backup em tempo real de Convidados
let reservasLocaisCache = {};   // Espelho local das reservas e agendamentos da quadra ativa
let isLicencaAtivaGlobal = true; // Espelho local do status da licença (Kill Switch)

// 🌟 VARIÁVEL INJETADA DA ETAPA 1 (Retenção de Logs):
let DiasLimpezaLogs = 15;       // Parâmetro mestre de retenção de logs no GitHub (Padrão: 15 dias)

let jogadoresGlobal = {};       // 🔥 DECLARAÇÃO GARANTIDA: Banco de dados de atletas na memória RAM
let jogadoresGlobalAlterado = false; // 🔥 INTERRUPTOR INTELIGENTE: Controla se houve mudanças online no Firebase

let rankingTabelasGlobal = {}; // Espelho local das tabelas do ranking na memória RAM

let configQuadrasGlobal = {};    // Espelho local em tempo real da Infraestrutura e Status das Quadras

let configRegrasGlobal = {};    // Espelho local em tempo real dos Parâmetros operacionais e controle de uso da arena. 

let saasUsuariosOnlineCache = {}; // Espelho local dos usuários conectados em tempo real (RAM)

// ==========================================
// 2. LISTENERS GLOBAIS (Ouvintes de Eventos)
// ========================================== 

// Auto-fechamento universal dos Menus Kebab (3 pontinhos) ao clicar fora deles
window.addEventListener('click', () => {
    document.querySelectorAll('.dropdown-kebab').forEach(dropdown => {
        dropdown.classList.remove('ativo'); 
    });
});

// 🎯 OUVINTE DE DEEP LINK PARA APK ANDROID (CAPACITOR / GOD MODE)
if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
    window.Capacitor.Plugins.App.addListener('appUrlOpen', (data) => {
        if (data && data.url) {
            try {
                const urlObj = new URL(data.url);
                const clubeDeepLink = urlObj.searchParams.get('god_mode_clube');
                if (clubeDeepLink) {
                    localStorage.setItem('god_mode_clube', clubeDeepLink);
                    window.location.reload(); // Recarrega o APK já no novo clube
                }
            } catch (e) {
                console.error("Erro ao processar Deep Link no APK:", e);
            }
        }
    });
}

// ==========================================
// 3. UTILITÁRIOS GLOBAIS DE UI (Interface do Usuário)
// ==========================================



/**
 * Exibe as notificações em formato de Pílula Flutuante com Click-to-Dismiss seguro.
 */
// ==========================================
// FILA DE MENSAGENS (TOASTS) - UX PREMIUM
// ==========================================
window.filaToastsSaaS = window.filaToastsSaaS || [];
window.toastAtivoSaaS = window.toastAtivoSaaS || false;

/**
 * Exibe as notificações em formato de Pílula Flutuante com Click-to-Dismiss seguro.
 * Coloca a notificação na fila de espera e aciona o processador.
 */
function showToast(msg, tipo = 'info', tempoCustomizado = null) {
    window.filaToastsSaaS.push({ msg, tipo, tempoCustomizado });
    processarFilaToastsSaaS();
}

/**
 * Processa a fila: só exibe se a tela estiver limpa, garantindo uma mensagem por vez.
 */
function processarFilaToastsSaaS() {
    // Se já tem uma mensagem na tela ou a fila está vazia, o motor descansa.
    if (window.toastAtivoSaaS || window.filaToastsSaaS.length === 0) return;

    // Tranca a porta: avisa o sistema que uma mensagem está em exibição
    window.toastAtivoSaaS = true;

    // Pega a primeira mensagem da fila (a mais antiga)
    const atual = window.filaToastsSaaS.shift();

    const container = document.getElementById('toastContainer');
    if (!container) {
        window.toastAtivoSaaS = false;
        return;
    }

    const toast = document.createElement('div');
    toast.className = `toast ${atual.tipo}`;
    
    // 💎 MODIFICAÇÃO: Sem ícones (design limpo). Renderiza apenas a string centralizada.
    if (atual.tipo === 'premium') {
        toast.innerHTML = atual.msg;
    } else {
        toast.innerHTML = `<span>${atual.msg}</span>`;
    }
    
    container.appendChild(toast); 
    
    let timeoutId; // Variável que guardará o temporizador

    // Função interna blindada para remover a pílula (Desliza para cima e some)
    const fecharToast = () => {
        clearTimeout(timeoutId); // Mata o temporizador pendente
        toast.classList.add('saindo'); // Chama a nova animação de subida do CSS
        toast.onclick = null; // Remove o evento de clique por segurança
        
        // Aguarda a animação de saída (300ms) terminar para remover o elemento
        setTimeout(() => {
            toast.remove();
            
            // Destranca a porta e chama a próxima mensagem da fila (se houver)
            window.toastAtivoSaaS = false;
            processarFilaToastsSaaS(); 
            
        }, 300); 
    };

    // 🎯 O Click-to-Dismiss preservado e ativo: o usuário clica e a pílula foge pra cima!
    toast.onclick = fecharToast;

    // ⏱️ Ocupação por tempo (se o usuário não clicar)
    const duracao = atual.tempoCustomizado !== null ? atual.tempoCustomizado : 3000;
    timeoutId = setTimeout(fecharToast, duracao);
}


/**
 * Encerra o ciclo de vida do aplicativo de forma limpa e nativa (Capacitor/Android/iOS).
 */
function fecharAplicativoSaaS() {
    // Feedback tátil sutil
    if (navigator.vibrate) {
        navigator.vibrate(40);
    }

    // Tenta invocar o encerramento nativo através da API do Capacitor ou barramento do WebView do Android
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
        window.Capacitor.Plugins.App.exitApp();
    } else if (navigator.app && navigator.app.exitApp) {
        navigator.app.exitApp();
    } else {
        // Fallback elegante para o navegador desktop durante o desenvolvimento local (Localhost)
        showToast("No smartphone nativo, esta ação fechará o aplicativo!", "info");
    }
}


/**
 * Cria a caixa de confirmação (Prompt) vermelha/cinza padrão.
 */
function showPrompt(titulo, msg, callback) {
    const modal = document.getElementById('modalPrompt');
    if (!modal) return;

    document.getElementById('promptTitle').textContent = titulo; 
    document.getElementById('promptMessage').innerHTML = msg;
    
    const btnSim = document.getElementById('btnPromptConfirm'); 
    const btnNao = document.getElementById('btnPromptCancel');
    
    // Clona os botões para remover eventos de cliques velhos que ficaram na memória
    const novoBtnSim = btnSim.cloneNode(true); 
    btnSim.parentNode.replaceChild(novoBtnSim, btnSim);
    
    const novoBtnNao = btnNao.cloneNode(true); 
    btnNao.parentNode.replaceChild(novoBtnNao, btnNao);
    
    novoBtnSim.onclick = () => { 
        modal.style.display = 'none'; 
        callback(); // Executa a ação confirmada
    }; 
    novoBtnNao.onclick = () => { 
        modal.style.display = 'none'; 
    };
    
    modal.style.display = 'flex';
}


function avaliarEstadoManutencaoSaaS() {
    const licencaOk = isLicencaAtivaGlobal !== false;
    const gestorOk = configRegrasGlobal ? configRegrasGlobal.Abrir !== false : true;
    const sistemaAberto = licencaOk && gestorOk;

    if (typeof atualizarVisualManutencaoSaaS === 'function') {
        atualizarVisualManutencaoSaaS(sistemaAberto);
    }
}

// Variable de controle para evitar disparos repetidos e mapear transições em tempo real
let sistemaAbertoAnterior = null;

/**
 * Controla os estados visuais macro do ecossistema quando o sistema vai para OFF
 */
function atualizarVisualManutencaoSaaS(sistemaAberto) {
    // Liga/Desliga o interruptor ambiental no corpo do app de forma global
    document.body.classList.toggle('sistema-SaaS-off', !sistemaAberto);

    // 🌟 REATIVIDADE CINEMATOGRÁFICA (ON/OFF)
    if (sistemaAbertoAnterior !== null) {
        if (sistemaAbertoAnterior === true && !sistemaAberto) {
            // Transição em tempo real: LIGADO -> DESLIGADO
            dispararFumacaSaaS();
        } else if (sistemaAbertoAnterior === false && sistemaAberto) {
            // Transição em tempo real: DESLIGADO -> LIGADO
            if (typeof dispararConfetes === "function") dispararConfetes();
        }
    } else {
        // Primeiro Boot do Aplicativo: Se o chassi já acordar em OFF, roda a fumaça de cortina
        if (!sistemaAberto) {
            setTimeout(() => { dispararFumacaSaaS(); }, 800); // Aguarda o fim do loading de entrada
        }
    }
    sistemaAbertoAnterior = sistemaAberto;

    const dashboard = document.getElementById('tela-gestor-dashboard');
    if (!dashboard) return;

    let faixa = dashboard.querySelector('.faixa-manutencao-SaaS');

    if (!sistemaAberto) {
        if (!faixa) {
            faixa = document.createElement('div');
            faixa.className = 'faixa-manutencao-SaaS';
            faixa.innerHTML = `
                <i class="material-icons">construction</i>
                <span class="texto-alerta">SISTEMA EM MANUTENÇÃO</span>
            `;
            const header = dashboard.querySelector('.header-painel');
            if (header) {
                header.insertAdjacentElement('afterend', faixa);
            }
        }
    } else {
        if (faixa) faixa.remove();
    }
}

/**
 * MOTOR DE PARTÍCULAS 3D PROCEDURAL: Gera fumaça volumosa realista sem assets externos
 */
function dispararFumacaSaaS() {
    // Impede duplicação do canvas na tela
    if (document.getElementById('canvas-fumaca-saas')) return;

    const canvas = document.createElement('canvas');
    canvas.id = 'canvas-fumaca-saas';
    canvas.className = 'canvas-fumaca-saas';
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    const particles = [];
    const startTime = Date.now();
    let animationFrameId;

    // Explosão volumosa de fumaça inicial cobrindo a tela de baixo para cima
    for (let i = 0; i < 35; i++) {
        particles.push({
            x: Math.random() * width,
            y: height + Math.random() * 120,
            vx: (Math.random() - 0.5) * 5,
            vy: -Math.random() * 4 - 3,
            radius: Math.random() * 80 + 70,
            alpha: Math.random() * 0.4 + 0.3,
            growth: Math.random() * 0.6 + 0.4,
            spin: (Math.random() - 0.5) * 0.02,
            angle: Math.random() * Math.PI * 2
        });
    }

    function renderLoop() {
        const elapsed = Date.now() - startTime;
        
        // Auto-destruição atômica após 3 segundos para liberar a memória RAM do celular
        if (elapsed > 3000 || particles.length === 0) {
            cancelAnimationFrame(animationFrameId);
            canvas.remove();
            return;
        }

        ctx.clearRect(0, 0, width, height);

        // Alimenta o fluxo com novas bafejadas de névoa no primeiro 1.2 segundo
        if (elapsed < 1200 && particles.length < 70 && Math.random() < 0.5) {
            particles.push({
                x: Math.random() * width,
                y: height + 40,
                vx: (Math.random() - 0.5) * 4,
                vy: -Math.random() * 5 - 4,
                radius: Math.random() * 40 + 40,
                alpha: Math.random() * 0.5 + 0.3,
                growth: Math.random() * 0.9 + 0.5,
                spin: (Math.random() - 0.5) * 0.04,
                angle: Math.random() * Math.PI * 2
            });
        }

        particles.forEach((p, idx) => {
            p.x += p.vx;
            p.y += p.vy;
            p.radius += p.growth;
            p.angle += p.spin;

            // Dissipação matemática baseada no tempo de vida
            if (elapsed > 1200) {
                p.alpha -= 0.009;
            } else {
                p.alpha -= 0.002;
            }

            if (p.alpha <= 0) {
                particles.splice(idx, 1);
                return;
            }

            // Desenho Volumoso: Gradiente esférico simulando profundidade 3D
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.angle);

            const gradient = ctx.createRadialGradient(0, 0, p.radius * 0.05, 0, 0, p.radius);
            // Tom acinzentado misturado com o coral quente da manutenção
            gradient.addColorStop(0, `rgba(215, 215, 220, ${p.alpha})`);
            gradient.addColorStop(0.3, `rgba(185, 170, 170, ${p.alpha * 0.6})`);
            gradient.addColorStop(0.7, `rgba(140, 125, 125, ${p.alpha * 0.15})`);
            gradient.addColorStop(1, 'rgba(140, 125, 125, 0)');

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });

        animationFrameId = requestAnimationFrame(renderLoop);
    }

    renderLoop(); 
}


// ==========================================
// 4. MOTORES DE ROTEAMENTO (Troca de Telas)
// ==========================================

/**
 * Alterna entre as telas principais do sistema SPA.
 */
function navegarApp(idDestino) {
    const isGodMode = !!localStorage.getItem('god_mode_clube');
    const licencaOk = isLicencaAtivaGlobal !== false;
    const config = configRegrasGlobal || {};
    const gestorOk = config.Abrir !== false;

    // 1. TRAVA MESTRE DO DESENVOLVEDOR (Arena desativada pelo Console)
    if (!licencaOk && !isGodMode) {
        if (idDestino !== 'tela-manutencao' && idDestino !== 'tela-boas-vindas') {
            idDestino = 'tela-manutencao';
        }
    } 
    // 2. TRAVA DE MANUTENÇÃO DO GESTOR (config.Abrir = false)
    else if (!gestorOk && !isGestorLogado && !isGodMode) {
        const nomeAtletaLogado = localStorage.getItem('jogadorLogadoNome') || "";
        const idAtleta = Object.keys(jogadoresGlobal).find(key => 
            jogadoresGlobal[key].nomeCompleto === nomeAtletaLogado
        );
        const dadosAtleta = idAtleta ? jogadoresGlobal[idAtleta] : {};
        const ehAdmin = dadosAtleta.perfis && dadosAtleta.perfis['Admin'] === true;

        if (!ehAdmin && idDestino !== 'tela-manutencao' && idDestino !== 'tela-boas-vindas' && idDestino !== 'tela-gestor-login' && idDestino !== 'tela-gestor-cadastro') {
            idDestino = 'tela-manutencao';
        }
    }

    document.querySelectorAll('.tela-app').forEach(tela => {
        tela.classList.remove('ativa');
    });
    
    const telaDestino = document.getElementById(idDestino);  
    if (telaDestino) {
        telaDestino.classList.add('ativa');
    }
    
    const btnBack = document.getElementById('btn-floating-back-qg');
    if (btnBack) {
        btnBack.style.display = (idDestino === 'tela-sub-jogadores' || idDestino === 'tela-visao-quadras') ? 'flex' : 'none';
    }

    if (idDestino === 'tela-visao-quadras') {
        setTimeout(() => {
            if (typeof iniciarRadarDeConvitesSaaS === 'function') {
                iniciarRadarDeConvitesSaaS(true);
            }
            if (typeof iniciarRadarSumulasPendentesSaaS === 'function') {
                iniciarRadarSumulasPendentesSaaS(true);
            }
            // ⚖️ DISPARO DO ÁRBITRO
            if (typeof iniciarRadarArbitroContestacoesSaaS === 'function') {
                iniciarRadarArbitroContestacoesSaaS();
            }
			// ⚖️ NOTIFICAÇAO DA DECISAO DO ÁRBITRO
			if (typeof iniciarOuvinteNotificacoesJogadorSaaS === 'function') {
				iniciarOuvinteNotificacoesJogadorSaaS();
			}
			// 🔔 RADAR SILENCIOSO DO RANKING
            if (typeof iniciarRadarConviteRankingSilenciosoSaaS === 'function') {
                iniciarRadarConviteRankingSilenciosoSaaS(true);
            }
        }, 300);
    }
}



// Atalhos Globais de Navegação
function voltarAoQG() { 
    navegarApp('tela-gestor-dashboard');  
}

function abrirModalConfig(idModal) { 
    const modal = document.getElementById(idModal);
    if (modal) {
        // 1. Mostra a janela primeiro (necessário para o navegador calcular o tamanho do conteúdo)
        modal.style.display = 'flex'; 

        // 2. 🧹 RESET INTELIGENTE: Se for a janela de Regras, chama o faxineiro
        if (idModal === 'modal-regras' && typeof resetarModalRegras === 'function') {
            resetarModalRegras();
        }
    }
}

// A FUNÇÃO OFICIAL QUE ESTAVA FALTANDO AQUI:
function fecharModalConfig(idModal) {
    const modal = document.getElementById(idModal);
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('ativa');
    }
}

// ==========================================
// 5. MODO ESCURO (THEME TOGGLE GLOBAL)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // 1. Aplica o tema salvo na memória assim que o aplicativo abre
    const temaSalvo = localStorage.getItem('theme');
    if (temaSalvo === 'dark') {
        document.body.classList.add('dark-mode');
    }

    // 2. Configura a ação de clique se os botões existirem na tela
    const btnTemaSocio = document.getElementById('fab-toggle-tema');
    const btnTemaGestor = document.getElementById('btn-tema-gestor');

    // 🔄 Função interna para sincronizar o estado visual dos ícones de forma segura
    const sincronizarIconesTema = (isDark) => {
        if (btnTemaSocio) {
            const iconeSocio = btnTemaSocio.querySelector('.material-icons');
            if (iconeSocio) iconeSocio.textContent = isDark ? 'light_mode' : 'dark_mode';
        }
        if (btnTemaGestor) {
            btnTemaGestor.textContent = isDark ? 'light_mode' : 'dark_mode'; 
        }
    };

    // Ajusta os ícones iniciais de acordo com o cache da memória no primeiro boot
    sincronizarIconesTema(temaSalvo === 'dark');

    // Motor unificado de inversão de tema mestre
    const alternarTemaMestre = () => {
        // Vibração física sutil no celular
        if (navigator.vibrate) navigator.vibrate(30); 
        
        // Alterna a classe global no <body>
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');

        // Salva a preferência atualizada e inverte os ícones visualmente
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        sincronizarIconesTema(isDark);
    };

    // Vincula o evento de clique de forma independente (evita quebra se um deles não estiver na tela)
    if (btnTemaSocio) btnTemaSocio.addEventListener('click', alternarTemaMestre);
    if (btnTemaGestor) btnTemaGestor.addEventListener('click', alternarTemaMestre);
});



// ==========================================
// 6. OUVINTES MESTRES SAAS (Single Source of Truth)
// ==========================================

/**
 * Inicia a conexão vital com as configurações do clube no Firebase.
 * Deve ser acionado uma única vez após o sistema reconhecer a raizBanco.
 */
function iniciarOuvinteMestreSaaS() {
    // Trava de segurança: impede que a conexão seja duplicada acidentalmente
    if (window.ouvinteMestreSaaSAtivo) return;
    window.ouvinteMestreSaaSAtivo = true; 

    // 🛑 OUVINTE MESTRE DE LICENÇA (KILL SWITCH DO DESENVOLVEDOR)
    database.ref(`Clubes/${clubeAtivoId}/info_clube/ativo`).on('value', (snapshot) => {
        isLicencaAtivaGlobal = snapshot.val() !== false;
        const isGodMode = !!localStorage.getItem('god_mode_clube');
        const telaManutencao = document.getElementById('tela-manutencao');
        const estaNaManutencao = telaManutencao && telaManutencao.classList.contains('ativa');

        // Sincroniza o tema ambiental unificado
        if (typeof avaliarEstadoManutencaoSaaS === 'function') {
            avaliarEstadoManutencaoSaaS();
        }

        if (!isLicencaAtivaGlobal && !isGodMode) {
            console.warn("🛑 [Kill Switch] Arena desativada pelo Desenvolvedor.");
            // 🧹 Remove o carimbo de presença online do banco imediatamente
            if (typeof removerPresencaOnlineSaaS === 'function') {
                removerPresencaOnlineSaaS();
            }
            if (typeof navegarApp === 'function') {
                navegarApp('tela-manutencao');
            }
        } else if (isLicencaAtivaGlobal && estaNaManutencao && !isGodMode) {
            console.log("✅ [Kill Switch] Arena religada! Redirecionando usuário de volta...");
            if (isGestorLogado) {
                navegarApp('tela-gestor-dashboard');
            } else {
                if (typeof abrirVisaoQuadras === 'function') {
                    abrirVisaoQuadras();
                } else {
                    navegarApp('tela-visao-quadras');
                }
            }
        }
    });


    // --- 1. OUVINTE DO HORÁRIO PADRÃO ---
    database.ref(`${raizBanco}/config/Horarios/Padrao`).on('value', (snapshot) => {
        regrasHorariosSaaS = snapshot.val() || {};
        const telaQuadras = document.getElementById('tela-visao-quadras');
        if (telaQuadras && telaQuadras.classList.contains('ativa')) {
            if (typeof forcarRepinturaPlanilha === 'function') {
                forcarRepinturaPlanilha();  
            }
        }
    });

    // --- 2. OUVINTE DA GRADE DE AULAS ---
    database.ref(`${raizBanco}/config/Horarios/Aulas`).on('value', (snapshot) => {
        configAulasGlobal = snapshot.val() || {};
        const telaQuadras = document.getElementById('tela-visao-quadras');
        if (telaQuadras && telaQuadras.classList.contains('ativa')) {
            if (typeof forcarRepinturaPlanilha === 'function') {
                forcarRepinturaPlanilha();
            }
        }
    });

    // --- 3. OUVINTE DO HORÁRIO DE DUPLAS ---
    database.ref(`${raizBanco}/config/Horarios/Duplas`).on('value', (snapshot) => {
        configDuplasGlobal = snapshot.val() || {};
        const telaQuadras = document.getElementById('tela-visao-quadras');
        if (telaQuadras && telaQuadras.classList.contains('ativa')) {
            if (typeof forcarRepinturaPlanilha === 'function') {
                forcarRepinturaPlanilha();
            }
        }
    });
	
	// --- 3.5. OUVINTE DO HORÁRIO DE CONVIDADOS ---
    database.ref(`${raizBanco}/config/Horarios/Convidados`).on('value', (snapshot) => {
        configConvidadosGlobal = snapshot.val() || {};
        const telaQuadras = document.getElementById('tela-visao-quadras');
        if (telaQuadras && telaQuadras.classList.contains('ativa')) {
            if (typeof forcarRepinturaPlanilha === 'function') {
                forcarRepinturaPlanilha();
            }
        }
    });
	
	// --- 4. OUVINTE MESTRE DE JOGADORES ---
    console.log("⚡ [Core] Sincronizando banco de jogadores em tempo real...");
    database.ref(`${raizBanco}/jogadores`).on('value', (snapshot) => {
        jogadoresGlobal = snapshot.val() || {};
        jogadoresGlobalAlterado = true; // 🔥 Liga o alerta de alteração
        console.log(`✓ [Core] ${Object.keys(jogadoresGlobal).length} jogadores sincronizados na memória RAM.`);
    });
	
	// --- 4.5. OUVINTE MESTRE DAS TABELAS DE RANKING ---
    console.log("🏆 [Core] Sincronizando tabelas do ranking em tempo real...");
    database.ref(`${raizBanco}/ranking/tabelas`).on('value', (snapshot) => {
        rankingTabelasGlobal = snapshot.val() || {};
        console.log("✓ [Core] Tabelas do ranking atualizadas na memória RAM.");
        
        const telaQuadras = document.getElementById('tela-visao-quadras');
        if (telaQuadras && telaQuadras.classList.contains('ativa')) {
            if (typeof forcarRepinturaPlanilha === 'function') {
                forcarRepinturaPlanilha();
            }
        }
    });
	
	// --- 5. OUVINTE MESTRE DE INFRAESTRUTURA E STATUS DE QUADRAS ---
    console.log("🏟️ [Core] Sincronizando infraestrutura e status das quadras em tempo real...");
    database.ref(`${raizBanco}/config/Quadras`).on('value', (snapshot) => {
        configQuadrasGlobal = snapshot.val() || {};
        console.log("✓ [Core] Configurações e status das quadras atualizados na memória RAM.");
        
        // Se a planilha principal estiver aberta na tela, solicita uma repintura reativa
        const telaQuadras = document.getElementById('tela-visao-quadras');
        if (telaQuadras && telaQuadras.classList.contains('ativa')) {
            if (typeof forcarRepinturaPlanilha === 'function') {
                forcarRepinturaPlanilha();
            }
        }
    });	
	
	
	// --- 6. OUVINTE MESTRE DE CONFIGURAÇÕES GERAIS (SaaS) ---
    console.log("⚙️ [Core] Sincronizando regras e configurações gerais em tempo real...");
    database.ref(`${raizBanco}/config`).on('value', (snapshot) => {
        if (snapshot.exists()) {
            configRegrasGlobal = snapshot.val();
            
            // 🧠 INTEGRAÇÃO GAVETA 2: Atualiza os Dias de Antecedência na Memória RAM
            DiasParaLimpar = parseInt(configRegrasGlobal.DiasParaLimpar) || 3;
			DiasParaExibir = configRegrasGlobal.DiasParaExibir !== undefined ? parseInt(configRegrasGlobal.DiasParaExibir) : 1; // 🌟 Linha Injetada
			
			// 📜 ETAPA 1: Sincroniza a retenção de logs em dias na memória RAM
            DiasLimpezaLogs = configRegrasGlobal.DiasLimpezaLogs !== undefined ? parseInt(configRegrasGlobal.DiasLimpezaLogs) : 15;
            window.DiasLimpezaLogs = DiasLimpezaLogs; // Registra também na janela global
        }
                  
        console.log("✓ [Core] Regras operacionais atualizadas na memória RAM.");
		
		// 🚨 DISPARO DA COORDENAÇÃO DE MANUTENÇÃO UNIFICADA
        if (typeof avaliarEstadoManutencaoSaaS === "function") {
            avaliarEstadoManutencaoSaaS();
        }
		
		// ====================================================================
        // 💥 GATILHO SILENCIOSO: COORDENAÇÃO DE PRESENÇA ONLINE (ON/OFF)
        // ====================================================================
        let ehAdminLogado = false;
        try {
            const perfisRaw = localStorage.getItem('jogadorLogadoPerfis') || '{}';
            const perfisObj = JSON.parse(perfisRaw);
            ehAdminLogado = perfisObj['Admin'] === true;
        } catch(e) {}

        // A triagem só se aplica a usuários comuns (não gestor e não admin)
        if (!isGestorLogado && !ehAdminLogado) {
            if (configRegrasGlobal.Abrir === false) {
                // 1. Se o sistema fechou, remove a presença em silêncio
                if (typeof removerPresencaOnlineSaaS === 'function') {
                    removerPresencaOnlineSaaS();
                }
            } else {
                // 2. Se o sistema reabriu, recupera o carimbo de presença na mesma hora
                if (typeof sincronizarPresencaOnlineSaaS === 'function') {
                    sincronizarPresencaOnlineSaaS();
                }
            }
        }

        // Dispara a portaria para os arquivos de logística checarem o acesso
        if (typeof verificarPortariaSistema === "function") {
            verificarPortariaSistema();
        }

        // Avisa o regras.js para preencher os inputs do modal
        if (typeof renderizarInputsModalRegras === "function") {
            renderizarInputsModalRegras();
        }

        // 🔄 ATUALIZAÇÃO DA PLANILHA EM TEMPO REAL
        // Se a tela de quadras estiver aberta, refaz o cálculo dos dias bloqueados instantaneamente!
        const telaQuadras = document.getElementById('tela-visao-quadras');
        if (telaQuadras && telaQuadras.classList.contains('ativa')) {
            if (typeof atualizarCabecalhoDias === "function") {
                atualizarCabecalhoDias();
            }
            // Reaplica os sensores (Lockdown do tempo) nos dias que mudaram de status
            if (typeof aplicarValidacoesETempoReal === "function") {
                aplicarValidacoesETempoReal();
            }
        }
		// ====================================================================
        // 🤖 GATILHO INJETADO: Faxina Crônica Automática Multiquadras
        // ====================================================================
        if (typeof executarFaxinaAutomaticaSaaS === 'function') { 
            executarFaxinaAutomaticaSaaS();  
        }
		
		// ====================================================================
        // 📡 GATILHO INJETADO: Radar de Convites Pendentes (Tempo Real)
        // ====================================================================
        if (typeof iniciarRadarDeConvitesSaaS === 'function') {
            iniciarRadarDeConvitesSaaS(); 
        }
		
		// ====================================================================
        // 🏆 GATILHO INJETADO: Radar de Súmulas Pendentes (Tempo Real)
        // ====================================================================
        if (typeof iniciarRadarSumulasPendentesSaaS === 'function') {
            iniciarRadarSumulasPendentesSaaS();
        }
		
		// ====================================================================
        // ⚖️ GATILHO INJETADO: Radar de Contestações para o Árbitro (Tempo Real)
        // ====================================================================
        if (typeof iniciarRadarArbitroContestacoesSaaS === 'function') {
            iniciarRadarArbitroContestacoesSaaS();
        }
		
		// ====================================================================
        // 🔔 GATILHO INJETADO: Ouvinte de Notificações do Jogador (Tempo Real)
        // ====================================================================
        if (typeof iniciarOuvinteNotificacoesJogadorSaaS === 'function') {
            iniciarOuvinteNotificacoesJogadorSaaS();
        }
		
		// 🔔 GATILHO INJETADO: Radar Silencioso do Convite do Ranking (Sininho)
        if (typeof iniciarRadarConviteRankingSilenciosoSaaS === 'function') {
            iniciarRadarConviteRankingSilenciosoSaaS();
        }
		
		// ====================================================================
        // 🟡 ATUALIZAÇÃO CIRÚRGICA DA LEGENDA (Sem repintar a grade)
        // ====================================================================
		const elLegendaRanking = document.getElementById('legenda-item-ranking');
        if (elLegendaRanking) {
            const isRankingAtivo = (configRegrasGlobal && 
                                    configRegrasGlobal.ranking && 
                                    configRegrasGlobal.ranking.ativo === true);
            elLegendaRanking.style.display = isRankingAtivo ? 'inline-flex' : 'none';
        }
    });  

    // ====================================================================
	// 👥 --- 7. OUVINTE MESTRE DE PRESENÇA ONLINE (SaaS) ---
	// ====================================================================
	console.log("👥 [Core] Sincronizando sistema de presença online em tempo real...");
	
	// PARTE 1: Radar de Conexão (.info/connected) com Reativação Automática de Presença
	database.ref(".info/connected").on("value", (snap) => {
		if (snap.val() === true) {
			console.log("📡 [SaaS Rede] Conexão ativa ou restabelecida! Atualizando carimbo de presença...");
			sincronizarPresencaOnlineSaaS();
		}
	});

	// PARTE 2: Escuta Ativa e Orquestração de Visibilidade dos Badges (Com Filtro Anti-Fantasma)
	database.ref(`${raizBanco}/usuariosOnline`).on('value', (snapshot) => {
		saasUsuariosOnlineCache = snapshot.val() || {}; 
		
		let totalOnlineSocio = 0;
		const agora = Date.now();
		const TOLERANCIA_GHOST_MS = 5 * 60 * 1000; // 5 minutos sem sinal de vida
		
		// Aplica o Filtro de Isenção e Descarte de Fantasmas
		Object.keys(saasUsuariosOnlineCache).forEach(key => {
			const usr = saasUsuariosOnlineCache[key];
			if (key === "GESTOR" || usr.isGestor === true) {
				return;
			}

			// Filtro Anti-Fantasma: se o sinal de vida for mais antigo que 5 min, desconsidera
			if (usr.lastSeen && (agora - usr.lastSeen > TOLERANCIA_GHOST_MS)) {
				return;
			}

			totalOnlineSocio++;
		});

		// Captura os elementos injetados na interface
		const elContainer = document.getElementById('saas-online-container');
		const elBadge = document.getElementById('saas-online-badge');
		const elContainerDash = document.getElementById('saas-online-container-dash');
		const elBadgeDash = document.getElementById('saas-online-badge-dash');
		const elTxtSubtítulo = document.getElementById('txt-saas-online-contador');

		// Atualiza o valor numérico do crachá do topo (Visão das Quadras)
		if (elBadge) {
			elBadge.textContent = totalOnlineSocio;
			// Regra do Badge: Se for rigorosamente 0, fica oculto. Se for >= 1, exibe verde.
			elBadge.style.display = totalOnlineSocio > 0 ? 'flex' : 'none';
		}

		// Atualiza o valor numérico do crachá do topo (Painel Dashboard)
		if (elBadgeDash) {
			elBadgeDash.textContent = totalOnlineSocio;
			elBadgeDash.style.display = totalOnlineSocio > 0 ? 'flex' : 'none';
		}

		// Atualiza o subtítulo interno da gaveta Matte
		if (elTxtSubtítulo) {
			elTxtSubtítulo.textContent = `${totalOnlineSocio} usuário${totalOnlineSocio !== 1 ? 's' : ''} online agora`;
		}

		// Portaria de Exclusividade: Controla se os ícones mestres devem aparecer nas telas
		let ehAdminLogado = false;
		try {
			const perfisRaw = localStorage.getItem('jogadorLogadoPerfis') || '{}';
			const perfisObj = JSON.parse(perfisRaw);
			ehAdminLogado = perfisObj['Admin'] === true;
		} catch(e) {}

		const temPermissaoDeVisao = isGestorLogado || ehAdminLogado;

		if (elContainer) {
			elContainer.style.display = temPermissaoDeVisao ? 'flex' : 'none';
		}

		if (elContainerDash) {
			elContainerDash.style.display = temPermissaoDeVisao ? 'flex' : 'none';
		}

		// Se a gaveta Matte estiver aberta na tela, avisa para repintar as linhas em tempo real
		if (typeof renderizarListaUsuariosOnlineSaaS === 'function' && document.getElementById('modal-online-SaaS').style.display === 'flex') {
			renderizarListaUsuariosOnlineSaaS();
		}
	});	

}






// ==========================================
// 7. PROVEDOR GITHUB API (SaaS AUDITORIA EXTERNA)
// ==========================================

/**
 * Garante a codificação perfeita de caracteres especiais (acentos, cedilhas, etc.)
 * para o padrão Base64 exigido de forma estrita pela API do GitHub.
 */
function b64EncodeUnicodeSaaS(str) {
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function(match, p1) {
        return String.fromCharCode('0x' + p1);
    }));
}


/**
 * Motor de Auditoria Externa: Consome a API do GitHub para ler, anexar e salvar
 * relatórios textuais. Se a internet falhar (Timeout), usa a Dead Letter Queue (Firebase).
 */
async function enviarFilaLogsAoGitHubSaaS(arrayNovosLogs) {
    if (!arrayNovosLogs || arrayNovosLogs.length === 0) return;

    let tokenAcesso = null;
    try {
        const snapToken = await database.ref('Clubes/SaaS_Config/githubToken').once('value');
        tokenAcesso = snapToken ? snapToken.val() : null;
    } catch(e) {
        console.error("❌ [GitHub API] Erro ao ler nó SaaS_Config no Firebase:", e); 
    }

    if (!tokenAcesso) {
        console.warn("⚠️ [GitHub API] Abortado: githubToken não localizado. Salvando na fila local.");
        // Se nem o token ele conseguiu ler, salva na fila de emergência
        const refPendentes = database.ref(`${raizBanco}/logs_pendentes`);
        arrayNovosLogs.forEach(log => refPendentes.push(log));
        return;
    }

    const repoOwner = "setpoint-gestor";
    const repoName = "app";
    const nomeArquivoLogs = `logs/${clubeAtivoId}_reservas-excluidas.json`;
    const urlApi = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${nomeArquivoLogs}`;

    let existenteSha = null;
    let arrayLogsCompleto = [];

    try {
        const respostaGet = await fetch(urlApi, {
            method: "GET",
            headers: {
                "Authorization": `token ${tokenAcesso}`,
                "Accept": "application/vnd.github.v3+json"
            }
        });

        if (respostaGet.ok) {
            const dadosArquivo = await respostaGet.json();
            existenteSha = dadosArquivo.sha; 
            const conteudoDecodificado = decodeURIComponent(escape(atob(dadosArquivo.content)));
            arrayLogsCompleto = JSON.parse(conteudoDecodificado || "[]");
        } else if (respostaGet.status === 404) {
            console.log(`📝 [GitHub API] Criando arquivo inédito para o clube: ${clubeAtivoId}`);
            arrayLogsCompleto = [];
        } else {
            throw new Error(`Falha de comunicação. Status: ${respostaGet.status}`);
        }

        arrayLogsCompleto.push(...arrayNovosLogs);

        const payloadString = JSON.stringify(arrayLogsCompleto, null, 2);
        const payloadBase64 = b64EncodeUnicodeSaaS(payloadString);

        const respostaPut = await fetch(urlApi, {
            method: "PUT",
            headers: {
                "Authorization": `token ${tokenAcesso}`,
                "Content-Type": "application/json",
                "Accept": "application/vnd.github.v3+json"
            },
            body: JSON.stringify({
                message: `🤖 [SetPoint SaaS] Auditoria: ${arrayNovosLogs.length} registro(s) arquivado(s).`,
                content: payloadBase64,
                sha: existenteSha 
            })
        });

        if (respostaPut.ok) {
            console.log(`✅ [GitHub API] Sucesso! ${arrayNovosLogs.length} recibo(s) commitado(s).`);
        } else {
            throw new Error(respostaPut.statusText);
        }

    } catch (erro) {
        console.error("❌ [GitHub API] Falha crítica (Timeout/Net). Acionando Dead Letter Queue...", erro);
        
        // 🛡️ DEAD LETTER QUEUE: O para-quedas! A internet caiu? Guarda no Firebase.
        const refPendentes = database.ref(`${raizBanco}/logs_pendentes`);
        arrayNovosLogs.forEach(log => {
            refPendentes.push(log);
        });
    }
}



// ==========================================
// 8. LOGÍSTICA DE PRESENÇA ONLINE (SaaS)
// ==========================================
let intervaloHeartbeatSaaS = null;

function sincronizarPresencaOnlineSaaS() {
    if (!raizBanco) return; 

    // 🛑 TRAVA MESTRE: Se a arena estiver desativada pelo Console (e não for God Mode), impede qualquer registro de presença
    const isGodMode = !!localStorage.getItem('god_mode_clube');
    if (isLicencaAtivaGlobal === false && !isGodMode) {
        removerPresencaOnlineSaaS();
        return;
    }

    const agora = Date.now();

    if (isGestorLogado) {
        const refPresencaGestor = database.ref(`${raizBanco}/usuariosOnline/GESTOR`);
        refPresencaGestor.set({ usuario: "Gestor Mestre", isGestor: true, lastSeen: agora });
        refPresencaGestor.onDisconnect().remove();
    } else {
        const idJogadorLogado = localStorage.getItem('jogadorLogadoId');
        const nomeJogadorLogado = localStorage.getItem('jogadorLogadoNome');
        
        if (idJogadorLogado && nomeJogadorLogado) {
            const refPresencaAtleta = database.ref(`${raizBanco}/usuariosOnline/${idJogadorLogado}`);
            refPresencaAtleta.set({ usuario: nomeJogadorLogado, id: idJogadorLogado, lastSeen: agora });
            refPresencaAtleta.onDisconnect().remove();
        }
    }

    // ⏱️ HEARTBEAT: Atualiza o sinal de vida a cada 2 minutos
    if (intervaloHeartbeatSaaS) clearInterval(intervaloHeartbeatSaaS);
    intervaloHeartbeatSaaS = setInterval(() => {
        if (!usuarioEstaOciosoSaaS && raizBanco) {
            const agoraLoop = Date.now();
            if (isGestorLogado) {
                database.ref(`${raizBanco}/usuariosOnline/GESTOR/lastSeen`).set(agoraLoop);
            } else {
                const idLogado = localStorage.getItem('jogadorLogadoId');
                if (idLogado) {
                    database.ref(`${raizBanco}/usuariosOnline/${idLogado}/lastSeen`).set(agoraLoop);
                }
            }
        }
    }, 2 * 60 * 1000);

    // 🦾 GATILHO INJETADO: Ativa o monitor de ausência/ociosidade
    if (typeof iniciarMonitorOciosidadeSaaS === 'function') {
        iniciarMonitorOciosidadeSaaS();
    }
}

// ====================================================================
// 💤 MOTOR DE OCIO-MONITORAMENTO DE SESSÃO ATIVA (SAAS ANTI-FANTASMA)
// ====================================================================
let temporizadorOciosidadeSaaS = null;
let usuarioEstaOciosoSaaS = false;
const TEMPO_OCIOSIDADE_MS = 5 * 60 * 1000; // ⏱️ Calibrado para 5 minutos de tolerância

/**
 * Remove a presença do banco imediatamente quando o usuário se ausenta
 */
function removerPresencaOnlineSaaS() {
    if (intervaloHeartbeatSaaS) {
        clearInterval(intervaloHeartbeatSaaS);
        intervaloHeartbeatSaaS = null;
    }
    if (!raizBanco) return;
    if (isGestorLogado) {
        database.ref(`${raizBanco}/usuariosOnline/GESTOR`).remove();
    } else {
        const idJogadorLogado = localStorage.getItem('jogadorLogadoId');
        if (idJogadorLogado) {
            database.ref(`${raizBanco}/usuariosOnline/${idJogadorLogado}`).remove();
        }
    }
    console.log("💤 [Ociosidade] Usuário inativo por muito tempo. Presença recolhida.");
}


/**
 * Monitora interações físicas, visibilidade da aba e foco da janela (Universal Cross-Browser)
 */
function iniciarMonitorOciosidadeSaaS() {
    if (window.monitorOciosidadeAtivo) return;
    window.monitorOciosidadeAtivo = true;

    const resetarCronometro = () => {
        if (usuarioEstaOciosoSaaS) {
            usuarioEstaOciosoSaaS = false;
            sincronizarPresencaOnlineSaaS(); 
            
            // 🧹 1. O FAXINEIRO AGE PRIMEIRO: Limpa o banco de dados em silêncio
            if (typeof executarFaxinaAutomaticaSaaS === 'function') {
                executarFaxinaAutomaticaSaaS();
            }

            // 📡 2. O RADAR VAI DEPOIS: Com um pequeno atraso de meio segundo para 
            // garantir que o Faxineiro terminou de varrer o banco antes do Radar ler.
            if (typeof iniciarRadarDeConvitesSaaS === 'function') {
                setTimeout(() => {
                    iniciarRadarDeConvitesSaaS(true);
                }, 500); 
            }
        }

        clearTimeout(temporizadorOciosidadeSaaS);
        temporizadorOciosidadeSaaS = setTimeout(() => {
            usuarioEstaOciosoSaaS = true;
            removerPresencaOnlineSaaS();
        }, TEMPO_OCIOSIDADE_MS);
    };

    window.addEventListener('mousemove', resetarCronometro);
    window.addEventListener('keydown', resetarCronometro);
    window.addEventListener('click', resetarCronometro);
    window.addEventListener('touchstart', resetarCronometro);

    window.addEventListener('blur', () => {
        usuarioEstaOciosoSaaS = true;
        clearTimeout(temporizadorOciosidadeSaaS); 
        removerPresencaOnlineSaaS(); 
    });

    window.addEventListener('focus', resetarCronometro);

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            usuarioEstaOciosoSaaS = true;
            clearTimeout(temporizadorOciosidadeSaaS);
            removerPresencaOnlineSaaS();
        } else {
            resetarCronometro();
        }
    });

    resetarCronometro();
}


// ==========================================
// VARIAVEL DE SESSÃO: ITENS ADIADOS PELO USUÁRIO
// ==========================================
window.ignoradosSessaoSaaS = [];

function desligarTodosRadaresSaaS() {
    if (listenerConvitesCallback) database.ref(`${raizBanco}/reservas`).off('value', listenerConvitesCallback);
    if (listenerSumulasCallback) database.ref(`${raizBanco}/reservas`).off('value', listenerSumulasCallback);
    if (listenerArbitroCallback) database.ref(`${raizBanco}/reservas`).off('value', listenerArbitroCallback);
    if (listenerRankingCallback) database.ref(`${raizBanco}/convites_ranking`).off('value', listenerRankingCallback);
    
    radarConvitesAtivoId = null;
    radarSumulasAtivoId = null;
    radarRankingAtivoId = null;
    listenerConvitesCallback = null;
    listenerSumulasCallback = null;
    listenerArbitroCallback = null;
    listenerRankingCallback = null;
    window.ignoradosSessaoSaaS = [];
}

// ==========================================
// 9. RADAR DE CONVITES PENDENTES (SAAS)
// ==========================================
let radarConvitesAtivoId = null;
let listenerConvitesCallback = null;

function iniciarRadarDeConvitesSaaS(forcar = false) {
    if (configRegrasGlobal && configRegrasGlobal.ReservasPorConfirmacao === false) return;

    const nomeLogado = localStorage.getItem('jogadorLogadoNome');
    const idLogado = localStorage.getItem('jogadorLogadoId');

    if (!nomeLogado || !idLogado || isGestorLogado) return;
    if (!forcar && radarConvitesAtivoId === idLogado) return;

    if (radarConvitesAtivoId !== null && listenerConvitesCallback) {
        database.ref(`${raizBanco}/reservas`).off('value', listenerConvitesCallback);
    }

    radarConvitesAtivoId = idLogado;
    
    const norm = (txt) => (txt || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, " ").trim().toUpperCase();

    listenerConvitesCallback = snap => {
        const nomeAtual = localStorage.getItem('jogadorLogadoNome');
        const idAtual = localStorage.getItem('jogadorLogadoId');
        if (!nomeAtual || !idAtual || isGestorLogado) return;

        const normNomeLogado = norm(nomeAtual);
        const todasAsReservas = snap.val() || {};
        const meusConvites = [];
        const agora = Date.now();

        Object.keys(todasAsReservas).forEach(quadraKey => {
            const slots = todasAsReservas[quadraKey];
            if (!slots) return;

            Object.keys(slots).forEach(slotKey => {
                const r = slots[slotKey];
                const chaveUnica = `${quadraKey}_${slotKey}`;
                
                if (!r || r.status !== 'pendente' || !r.expiraEm) return;
                if (r.borda === undefined && r.duracao === 2) return;
                if (r.expiraEm < agora) return;
                if (window.ignoradosSessaoSaaS.includes(chaveUnica)) return;

                const confs = r.confirmacoes || {};
                let souEuPendente = false;

                const listCompleto = (r.jogadores_completo || "").split(',').map(s => norm(s));
                const listApelidos = (r.jogadores || "").split(',').map(s => norm(s));

                let idxMatch = listCompleto.findIndex(n => n === normNomeLogado);
                if (idxMatch === -1) idxMatch = listApelidos.findIndex(a => a === normNomeLogado);

                if (idxMatch !== -1) {
                    const nomeOriginalNoBanco = (r.jogadores || "").split(',')[idxMatch].trim();
                    if (confs[nomeOriginalNoBanco] === false) {
                        souEuPendente = true;
                    } else {
                        const chavesConfs = Object.keys(confs);
                        const chaveCorrespondente = chavesConfs.find(k => norm(k) === norm(nomeOriginalNoBanco));
                        if (chaveCorrespondente && confs[chaveCorrespondente] === false) souEuPendente = true;
                    }
                }

                if (souEuPendente) meusConvites.push({ quadra: quadraKey, slotKey: slotKey, dados: r });
            });
        });

        if (meusConvites.length > 0) {
            if (typeof renderizarGavetaConvitesSaaS === 'function') renderizarGavetaConvitesSaaS(meusConvites);
        } else {
            const modal = document.getElementById('modal-convites-entrada');
            if (modal && modal.style.display !== 'none' && typeof fecharModalConvitesEntradaSaaS === 'function') {
                fecharModalConvitesEntradaSaaS();
            }
        }
    };

    database.ref(`${raizBanco}/reservas`).on('value', listenerConvitesCallback);
}


// ====================================================================
// 10. OUVINTE GLOBAL: SINCRONIZA A VERSÃO DA WEB/IOS COM O FIREBASE
// ====================================================================
database.ref('Clubes/SaaS_Config/versao_web').on('value', (snapshot) => {
    if (snapshot.exists()) {
        versaoWebGlobal = snapshot.val();
        console.log("📱 [SaaS Version] Versão Web/iOS sincronizada: v" + versaoWebGlobal);
    }
});


// ==========================================
// 11. RADAR AUTOMÁTICO DE SÚMULAS PENDENTES (SAAS)
// ==========================================
let radarSumulasAtivoId = null;
let listenerSumulasCallback = null;

function iniciarRadarSumulasPendentesSaaS(forcar = false) {
    const idLogado = localStorage.getItem('jogadorLogadoId');
    const nomeLogado = (localStorage.getItem('jogadorLogadoNome') || '').trim();

    if (!idLogado || !nomeLogado || (typeof isGestorLogado !== 'undefined' && isGestorLogado)) return;
    if (!forcar && radarSumulasAtivoId === idLogado && listenerSumulasCallback !== null) return;

    // Sempre desliga o ouvinte anterior para evitar escutas zumbis
    if (listenerSumulasCallback) {
        database.ref(`${raizBanco}/reservas`).off('value', listenerSumulasCallback);
        listenerSumulasCallback = null;
    }

    radarSumulasAtivoId = idLogado;
    const norm = (txt) => (txt || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, " ").trim().toUpperCase();

    listenerSumulasCallback = snap => {
        const nomeAtual = localStorage.getItem('jogadorLogadoNome');
        const idAtual = localStorage.getItem('jogadorLogadoId');
        if (!nomeAtual || !idAtual || isGestorLogado) return;

        const normNomeLogado = norm(nomeAtual);
        const todasReservas = snap.val() || {};
        let sumulaPendenteTarget = null;

        Object.keys(todasReservas).forEach(quadraKey => {
            const slots = todasReservas[quadraKey];
            if (!slots) return;

            Object.keys(slots).forEach(slotKey => {
                const r = slots[slotKey];
                const chaveUnica = `${quadraKey}_${slotKey}`;
                if (!r || r.statusPlacar !== 'pendente_validacao' || !r.dadosPlacar) return;
                if (r.borda === undefined && r.duracao === 2) return; // Trava anti-duplicação de 2h
                if (window.ignoradosSessaoSaaS.includes(chaveUnica)) return;

                const autorSumula = norm(r.dadosPlacar.autorSumula || '');
                const jogadoresComp = norm(r.jogadores_completo || '');
                const jogadoresAp = norm(r.jogadores || '');

                const souJogador = jogadoresComp.includes(normNomeLogado) || jogadoresAp.includes(normNomeLogado);
                const souOAutor = (normNomeLogado === autorSumula);

                if (souJogador && !souOAutor && !sumulaPendenteTarget) {
                    r.quadra = quadraKey;
                    r.slotKey = slotKey;
                    sumulaPendenteTarget = r;
                }
            });
        });

        if (sumulaPendenteTarget) {
            if (typeof abrirModalValidacaoAdversario === 'function') abrirModalValidacaoAdversario(sumulaPendenteTarget);
        } else {
            const modalVal = document.getElementById('modal-validacao-placar');
            if (modalVal && modalVal.style.display !== 'none' && typeof fecharModalConfig === 'function') {
                fecharModalConfig('modal-validacao-placar');
            }
        }
    };

    database.ref(`${raizBanco}/reservas`).on('value', listenerSumulasCallback);
}


// ==========================================
// 12. RADAR DO ÁRBITRO - SÚMULAS CONTESTADAS (SAAS)
// ==========================================
let listenerArbitroCallback = null;

function iniciarRadarArbitroContestacoesSaaS() {
    // Sempre desliga o ouvinte anterior antes de avaliar as permissões
    if (listenerArbitroCallback) {
        database.ref(`${raizBanco}/reservas`).off('value', listenerArbitroCallback);
        listenerArbitroCallback = null;
    }

    // 🛡️ Trava Mestre: Se o perfil não tiver permissão para arbitrar, mata o radar na hora
    if (typeof podeArbitrarRankingSaaS === 'function' && !podeArbitrarRankingSaaS()) return;

    const norm = (txt) => (txt || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, " ").trim().toUpperCase();

    listenerArbitroCallback = snap => {
        const idAtual = localStorage.getItem('jogadorLogadoId');
        if (!isGestorLogado && !idAtual) return;

        // 🛡️ Re-checagem em tempo real dentro do callback
        if (typeof podeArbitrarRankingSaaS === 'function' && !podeArbitrarRankingSaaS()) return;

        const nomeAtual = (localStorage.getItem('jogadorLogadoNome') || '').trim();
        const normNomeLogado = norm(nomeAtual);
        const todasReservas = snap.val() || {};
        const listaContestacoes = [];

        Object.keys(todasReservas).forEach(quadraKey => {
            const slots = todasReservas[quadraKey];
            if (!slots) return;

            Object.keys(slots).forEach(slotKey => {
                const r = slots[slotKey];
                const chaveUnica = `${quadraKey}_${slotKey}`;
                if (!r || r.statusPlacar !== 'contestado' || !r.dadosPlacar) return;
                if (r.borda === undefined && r.duracao === 2) return; // Trava anti-duplicação de 2h
                if (window.ignoradosSessaoSaaS.includes(chaveUnica)) return;

                const jogadoresComp = norm(r.jogadores_completo || '');
                const jogadoresAp = norm(r.jogadores || '');

                const souJogador = normNomeLogado !== "" && (jogadoresComp.includes(normNomeLogado) || jogadoresAp.includes(normNomeLogado));

                if (!souJogador) {
                    r.quadra = quadraKey;
                    r.slotKey = slotKey;
                    listaContestacoes.push(r);
                }
            });
        });

        if (listaContestacoes.length > 0) {
            if (typeof renderizarGavetaArbitroSaaS === 'function') {
                renderizarGavetaArbitroSaaS(listaContestacoes);
            }
        } else {
            const modalArb = document.getElementById('modal-arbitro-placar');
            if (modalArb && modalArb.style.display !== 'none' && typeof fecharModalConfig === 'function') {
                fecharModalConfig('modal-arbitro-placar');
            }
        }
    };

    database.ref(`${raizBanco}/reservas`).on('value', listenerArbitroCallback);
}


// ==========================================
// 13. OUVINTE DE NOTIFICAÇÕES DO JOGADOR (SAAS)
// ==========================================
let listenerNotificacoesCallback = null;
let qtdNotificacoesAnterior = null;

function iniciarOuvinteNotificacoesJogadorSaaS() {
    const idLogado = localStorage.getItem('jogadorLogadoId');
    if (!idLogado || (typeof isGestorLogado !== 'undefined' && isGestorLogado)) return;

    if (listenerNotificacoesCallback) {
        database.ref(`${raizBanco}/jogadores/${idLogado}/notificacoes`).off('value', listenerNotificacoesCallback);
        listenerNotificacoesCallback = null;
    }

    listenerNotificacoesCallback = snap => {
        const idAtual = localStorage.getItem('jogadorLogadoId');
        if (!idAtual || isGestorLogado) return;

        const notifs = snap.exists() ? snap.val() : {};
        const qtdNotifs = Object.keys(notifs).length;
        const temRanking = window.temConviteRankingPendenteSocio === true ? 1 : 0;

        // O total é a soma real das notificações no banco + o convite do ranking pendente
        const total = qtdNotifs + temRanking;

        const badge = document.getElementById('notificacao-badge');
        const containerBadge = badge ? badge.parentElement : null;

        if (total > 0) {
            if (badge) {
                badge.textContent = String(total);
                badge.style.display = "flex";
            }
            if (containerBadge) containerBadge.style.display = "flex";

            // 1. Dispara o Toast no boot ao abrir o app
            if (qtdNotificacoesAnterior === null) {
                if (typeof dispararToastNotificacoesEntradaSaaS === 'function') {
                    dispararToastNotificacoesEntradaSaaS(total);
                }
            } 
            // 2. Dispara em tempo real se uma nova notificação chegar enquanto online
            else if (qtdNotifs > qtdNotificacoesAnterior) {
                const novasChegadas = qtdNotifs - qtdNotificacoesAnterior;
                if (typeof dispararToastNotificacoesEntradaSaaS === 'function') {
                    dispararToastNotificacoesEntradaSaaS(novasChegadas);
                }
            }
        } else {
            if (badge) {
                badge.textContent = "0";
                badge.style.display = "none";
            }
        }

        qtdNotificacoesAnterior = qtdNotifs;

        const modal = document.getElementById('modal-central-notificacoes');
        if (modal && modal.style.display === 'flex') {
            if (typeof renderizarListaNotificacoesSocioSaaS === 'function') {
                renderizarListaNotificacoesSocioSaaS();
            }
        }
    };

    database.ref(`${raizBanco}/jogadores/${idLogado}/notificacoes`).on('value', listenerNotificacoesCallback);
}


// ==========================================
// 14. RADAR SILENCIOSO DO RANKING (SAAS)
// ==========================================
let radarRankingAtivoId = null;
let listenerRankingCallback = null;

function iniciarRadarConviteRankingSilenciosoSaaS(forcar = false) {
    const idLogado = localStorage.getItem('jogadorLogadoId');
    if (!idLogado || (typeof isGestorLogado !== 'undefined' && isGestorLogado)) return;
    if (!forcar && radarRankingAtivoId === idLogado && listenerRankingCallback !== null) return;

    if (listenerRankingCallback) {
        database.ref(`${raizBanco}/convites_ranking`).off('value', listenerRankingCallback);
        listenerRankingCallback = null;
    }

    radarRankingAtivoId = idLogado;

    listenerRankingCallback = snap => {
        const idAtual = localStorage.getItem('jogadorLogadoId');
        if (!idAtual || isGestorLogado) return;

        const dadosConvite = snap.exists() ? snap.val() : null;

        if (dadosConvite && dadosConvite.status === 'aberto' && dadosConvite.pendentes && dadosConvite.pendentes[idAtual] === true) {
            window.temConviteRankingPendenteSocio = true;
            window.dadosTemporadaRankingAtiva = dadosConvite;
        } else {
            window.temConviteRankingPendenteSocio = false;
        }

        if (typeof iniciarOuvinteNotificacoesJogadorSaaS === 'function') {
            iniciarOuvinteNotificacoesJogadorSaaS();
        }
    };

    database.ref(`${raizBanco}/convites_ranking`).on('value', listenerRankingCallback);
}