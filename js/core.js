
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

let jogadoresGlobal = {};       // 🔥 DECLARAÇÃO GARANTIDA: Banco de dados de atletas na memória RAM
let jogadoresGlobalAlterado = false; // 🔥 INTERRUPTOR INTELIGENTE: Controla se houve mudanças online no Firebase

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

// ==========================================
// 3. UTILITÁRIOS GLOBAIS DE UI (Interface do Usuário)
// ==========================================



/**
 * Exibe as notificações em formato de Pílula Flutuante com Click-to-Dismiss seguro.
 */
function showToast(msg, tipo = 'info', tempoCustomizado = null) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${tipo}`;
    
    // 💎 MODIFICAÇÃO: Sem ícones (design limpo). Renderiza apenas a string centralizada.
    if (tipo === 'premium') {
        toast.innerHTML = msg;
        toast.style.background = 'transparent'; 
        toast.style.boxShadow = 'none';
        toast.style.padding = '0';
    } else {
        toast.innerHTML = `<span style="letter-spacing: 0.3px;">${msg}</span>`;
    }
    
    container.appendChild(toast); 
    
    let timeoutId; // Variável que guardará o temporizador

    // Função interna blindada para remover a pílula (Desliza para cima e some)
    const fecharToast = () => {
        clearTimeout(timeoutId); // Mata o temporizador pendente
        toast.classList.add('saindo'); // Chama a nova animação de subida do CSS
        toast.onclick = null; // Remove o evento de clique por segurança
        setTimeout(() => toast.remove(), 300); // Destrói o elemento após a animação
    };

    // 🎯 O Click-to-Dismiss preservado e ativo: o usuário clica e a pílula foge pra cima!
    toast.onclick = fecharToast;

    // ⏱️ Ocupação por tempo (se o usuário não clicar)
    const duracao = tempoCustomizado !== null ? tempoCustomizado : 3000;
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
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.zIndex = '99999'; // Camada mestre por cima de tudo
    canvas.style.pointerEvents = 'none'; // Não bloqueia os cliques do Admin
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
    // 🛡️ INTERCEPTOR CENTRAL DE PORTARIA (LOCKDOWN SAAS)
    const config = configRegrasGlobal || {};
    const sistemaAberto = config.Abrir !== false;

    if (!sistemaAberto && !isGestorLogado) {
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

    // --- FLUXO ORIGINAL DE PINTURA DE TELA ---
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
            
            // 🎨 INJEÇÃO DE COR: Sol amarelo no modo escuro, lua padrão no claro
            if (isDark) {
                btnTemaGestor.style.color = '#f1c40f'; // Amarelo girassol premium
            } else {
                btnTemaGestor.style.color = ''; // Reseta para o grafite padrão do seu CSS
            }
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
        }
                  
        console.log("✓ [Core] Regras operacionais atualizadas na memória RAM.");
		
		// 🚨 DISPARO DA COORDENAÇÃO DE MANUTENÇÃO
        if (typeof atualizarVisualManutencaoSaaS === "function") {
            atualizarVisualManutencaoSaaS(configRegrasGlobal.Abrir !== false);
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

	// PARTE 2: Escuta Ativa e Orquestração de Visibilidade dos Badges
	database.ref(`${raizBanco}/usuariosOnline`).on('value', (snapshot) => {
		saasUsuariosOnlineCache = snapshot.val() || {}; 
		
		let totalOnlineSocio = 0;
		
		// Aplica o Filtro de Isenção: Ignora estritamente a conta mestre do Gestor
		Object.keys(saasUsuariosOnlineCache).forEach(key => {
			if (key === "GESTOR" || saasUsuariosOnlineCache[key].isGestor === true) {
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
function sincronizarPresencaOnlineSaaS() {
    if (!raizBanco) return;
    
    if (isGestorLogado) {
        const refPresencaGestor = database.ref(`${raizBanco}/usuariosOnline/GESTOR`);
        refPresencaGestor.set({ usuario: "Gestor Mestre", isGestor: true });
        refPresencaGestor.onDisconnect().remove();
    } else {
        const idJogadorLogado = localStorage.getItem('jogadorLogadoId');
        const nomeJogadorLogado = localStorage.getItem('jogadorLogadoNome');
        
        if (idJogadorLogado && nomeJogadorLogado) {
            const refPresencaAtleta = database.ref(`${raizBanco}/usuariosOnline/${idJogadorLogado}`);
            refPresencaAtleta.set({ usuario: nomeJogadorLogado, id: idJogadorLogado });
            refPresencaAtleta.onDisconnect().remove();
        }
    }

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
        // Se o usuário estava sumido e voltou a interagir, reativa a presença online na hora
        if (usuarioEstaOciosoSaaS) {
            usuarioEstaOciosoSaaS = false;
            console.log("⏰ [Ociosidade] Atividade detectada! Reativando presença online...");
            sincronizarPresencaOnlineSaaS();
        }

        clearTimeout(temporizadorOciosidadeSaaS);
        temporizadorOciosidadeSaaS = setTimeout(() => {
            usuarioEstaOciosoSaaS = true;
            removerPresencaOnlineSaaS();
        }, TEMPO_OCIOSIDADE_MS);
    };

    // 🖱️ Sensores de movimento e cliques físicos no PC/Celular
    window.addEventListener('mousemove', resetarCronometro);
    window.addEventListener('keydown', resetarCronometro);
    window.addEventListener('click', resetarCronometro);
    window.addEventListener('touchstart', resetarCronometro);

    // 🖥️ Sensores de Foco de Janela (Cura definitiva para o Firefox/Safari)
    window.addEventListener('blur', () => {
        // No segundo em que mudar de janela ou clicar fora do navegador, recolhe a presença
        usuarioEstaOciosoSaaS = true;
        clearTimeout(temporizadorOciosidadeSaaS); 
        removerPresencaOnlineSaaS(); 
    });

    window.addEventListener('focus', () => {
        // No instante em que clicar de volta na janela do sistema, acorda a presença
        resetarCronometro();
    });

    // 📑 Sentinela de Abas (Visibility API): Mantido para garantir o comportamento do Chrome
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            usuarioEstaOciosoSaaS = true;
            clearTimeout(temporizadorOciosidadeSaaS);
            removerPresencaOnlineSaaS();
        } else {
            resetarCronometro();
        }
    });

    // Inicia a primeira contagem regressiva protetora
    resetarCronometro();
}


// ==========================================
// 9. RADAR DE CONVITES PENDENTES (SAAS)
// ==========================================
let radarConvitesAtivoId = null; // Guarda o ID do jogador ativo no radar

function iniciarRadarDeConvitesSaaS(forcar = false) {
    // 1. Aborta se a regra de Confirmação Obrigatória estiver desligada no sistema
    if (configRegrasGlobal && configRegrasGlobal.ReservasPorConfirmacao === false) return;

    // 2. Identifica quem é o usuário logado (Gestor não recebe convites)
    const nomeLogado = localStorage.getItem('jogadorLogadoNome');
    const idLogado = localStorage.getItem('jogadorLogadoId');
    if (!nomeLogado || !idLogado || isGestorLogado) return;

    // 🛡️ TRAVA INTELIGENTE: Se o radar já está rodando PARA ESTE MESMO JOGADOR e não for forçado, ignora
    if (!forcar && radarConvitesAtivoId === idLogado) return;

    // Se trocou de conta ou solicitou recarga forçada na abertura de tela, desliga o ouvinte anterior
    if (radarConvitesAtivoId !== null) {
        database.ref(`${raizBanco}/reservas`).off('value');
    }

    radarConvitesAtivoId = idLogado;
    console.log(`📡 [Core] Radar de Convites ativado em tempo real para: ${nomeLogado} (${idLogado})...`);

    // Função de normalização para ignorar acentos e caixa alta/baixa
    const normalizar = (txt) => (txt || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();

    let apelidoBusca = nomeLogado;
    if (typeof jogadoresGlobal !== 'undefined' && jogadoresGlobal[idLogado]) {
        apelidoBusca = jogadoresGlobal[idLogado].apelido || nomeLogado;
    }

    const normNomeLogado = normalizar(nomeLogado);
    const normApelidoBusca = normalizar(apelidoBusca);

    // 3. A Escuta Ativa em Tempo Real (.on)
    database.ref(`${raizBanco}/reservas`).on('value', snap => {
        const todasAsReservas = snap.val() || {};
        const meusConvites = [];
        const agora = Date.now();

        Object.keys(todasAsReservas).forEach(quadraKey => {
            const slots = todasAsReservas[quadraKey];
            if (!slots) return;

            Object.keys(slots).forEach(slotKey => {
                const r = slots[slotKey];
                
                // Filtros de descarte rápido
                if (!r || r.status !== 'pendente' || !r.expiraEm) return;
                if (r.borda === undefined && r.duracao === 2) return;
                if (r.expiraEm < agora) return;

                // Busca o atleta na lista de confirmações como "false"
                const confs = r.confirmacoes || {};
                let souEuPendente = false;

                Object.keys(confs).forEach(nomeAtleta => {
                    if (confs[nomeAtleta] === false) {
                        const normAtleta = normalizar(nomeAtleta);
                        if (normAtleta === normApelidoBusca || normAtleta === normNomeLogado) {
                            souEuPendente = true;
                        }
                    }
                });

                if (souEuPendente) {
                    meusConvites.push({
                        quadra: quadraKey,
                        slotKey: slotKey,
                        dados: r
                    });
                }
            });
        });

        // 4. Comunica com a UI (que mora no planilha.js)
        if (meusConvites.length > 0) {
            if (typeof renderizarGavetaConvitesSaaS === 'function') {
                renderizarGavetaConvitesSaaS(meusConvites);
            }
        } else {
            const modal = document.getElementById('modal-convites-entrada');
            if (modal && modal.style.display !== 'none' && typeof fecharModalConvitesEntradaSaaS === 'function') {
                fecharModalConvitesEntradaSaaS();
            }
        }
    });
}
