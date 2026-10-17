"use strict";

// ====================================================================
// 🧠 MÓDULO INTELIGÊNCIA ARTIFICIAL - CONCIERGE DO JOGADOR (SaaS)
// ====================================================================

let iaReconhecimentoDeVoz = null;
let iaGravandoVoz = false;
let iaIndexSugestao = 0;
let iaEsgotadaSessao = false; // 🛑 NOVA TRAVA: Controla se os créditos acabaram
let iaModoContinuo = false; // 🎙️ Controla o modo de conversa contínua (Hands-Free)
let iaPermissaoMicrofoneConcedida = false; // Cache para não travar o hardware abrindo permissão a cada fala
let iaFalaAtivaGlobal = null;              // Proteção contra o Garbage Collector do Android WebView

// ====================================================================
// 1. INICIALIZAÇÃO DA INTERFACE (Injeção limpa no DOM)
// ====================================================================
function inicializarUIConcierge() {
    if (document.getElementById('fab-ia-concierge')) return;

    const fab = document.createElement('button');
    fab.id = 'fab-ia-concierge';
    fab.title = 'Concierge SetPoint';
    fab.innerHTML = '<i class="material-icons">auto_awesome</i>';
    fab.onclick = abrirBarraConcierge;

    const backdrop = document.createElement('div');
    backdrop.id = 'ia-backdrop';
    backdrop.onclick = fecharBarraConcierge;

    const menuSugestoes = document.createElement('div');
    menuSugestoes.id = 'ia-menu-sugestoes';

    const barra = document.createElement('div');
    barra.id = 'ia-barra-mestra';
    barra.innerHTML = `
        <button class="btn-acao-ia" id="ia-btn-add" title="Sugestões de atalho">
            <i class="material-icons">add</i>
        </button>
        <input type="text" id="ia-input-texto" placeholder="Peça ao SetPoint..." autocomplete="off">
        <button class="btn-acao-ia icon-mic" id="ia-btn-mic" title="Falar">
            <i class="material-icons">mic</i>
        </button>
        <button class="btn-acao-ia icon-live" id="ia-btn-live" title="Conversa contínua">
            <i class="material-icons">graphic_eq</i>
        </button>
    `;

    document.body.appendChild(fab);
    document.body.appendChild(backdrop);
    document.body.appendChild(menuSugestoes);
    document.body.appendChild(barra);

    vincularEventosConcierge();
    prepararMotorDeVozConcierge();
}

// ====================================================================
// 2. GESTÃO DE ESTADOS (Abertura, Fechamento e Interação)
// ====================================================================
function vincularEventosConcierge() {
    const btnAdd = document.getElementById('ia-btn-add');
    const btnMic = document.getElementById('ia-btn-mic');
    const btnLive = document.getElementById('ia-btn-live');
    const inputTexto = document.getElementById('ia-input-texto');

    btnAdd.addEventListener('click', ciclarSugestoesIA);

    inputTexto.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const comando = inputTexto.value.trim();
            if (comando) processarMensagemConcierge(comando);
        }
    });

    btnMic.addEventListener('click', alternarGravacaoVozConcierge);
    btnLive.addEventListener('click', alternarModoContinuoConcierge);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && document.getElementById('ia-barra-mestra').classList.contains('aberta')) {
            fecharBarraConcierge();
        }
    });
}

function alternarModoContinuoConcierge() {
    if (iaEsgotadaSessao) return;

    iaModoContinuo = !iaModoContinuo;
    const btnLive = document.getElementById('ia-btn-live');

    if (iaModoContinuo) {
        if (btnLive) {
            btnLive.style.color = '#10b981';
            btnLive.style.filter = 'drop-shadow(0 0 8px rgba(16, 185, 129, 0.7))';
        }
        if (typeof showToast === 'function') {
            showToast("Conversa contínua ativada! Fale à vontade.", "info", 3000);
        }
        if (!iaGravandoVoz) {
            iniciarGravacaoVozConcierge();
        }
    } else {
        desativarModoContinuoVisual();
        encerrarMicrofoneSilencioso();
        if ('speechSynthesis' in window) window.speechSynthesis.cancel();
        if (typeof showToast === 'function') {
            showToast("Conversa contínua desativada.", "info", 2000);
        }
    }
}

function desativarModoContinuoVisual() {
    iaModoContinuo = false;
    const btnLive = document.getElementById('ia-btn-live');
    if (btnLive) {
        btnLive.style.color = '';
        btnLive.style.filter = '';
    }
}

function abrirBarraConcierge() {
    if (iaEsgotadaSessao) {
        if (typeof showToast === 'function') {
            showToast("Meus créditos esgotaram. Volto amanhã!", "warning");
        }
        return;
    }

    document.getElementById('fab-ia-concierge').classList.add('oculto');
    document.getElementById('ia-backdrop').classList.add('ativo');
    document.getElementById('ia-barra-mestra').classList.add('aberta');

    const input = document.getElementById('ia-input-texto');
    setTimeout(() => input.focus(), 250);
}

function fecharBarraConcierge() {
    document.getElementById('ia-barra-mestra').classList.remove('aberta');
    document.getElementById('ia-backdrop').classList.remove('ativo');
    document.getElementById('fab-ia-concierge').classList.remove('oculto');

    const input = document.getElementById('ia-input-texto');
    if (!iaEsgotadaSessao) input.value = '';
    input.blur();

    fecharMenuSugestoes();
    encerrarMicrofoneSilencioso();
    desativarModoContinuoVisual();

    // Corta imediatamente qualquer fala ativa
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}

// ====================================================================
// 3. CARROSSEL DINÂMICO DE ATALHOS (Adaptive Space Budgeting)
// ====================================================================

// Cache para evitar repetição imediata das mesmas pílulas ao ciclar
let iaUltimasPilulasExibidas = [];

// Catálogo com todas as intenções homologadas divididas por perfil
function gerarPilulasDinamicas() {
    let sugestoes = [];
    
    const idLogado = localStorage.getItem('jogadorLogadoId') || '';
    const atleta = (typeof jogadoresGlobal !== 'undefined' && jogadoresGlobal[idLogado]) ? jogadoresGlobal[idLogado] : {};
    const perfis = atleta.perfis || {};

    // 1. DOMÍNIO UNIVERSAL: Agendamento, Quadras e Minha Agenda
    sugestoes.push({ icon: 'event_available', text: 'Quais quadras estão livres hoje à noite?', color: '#4ade80' });
    sugestoes.push({ icon: 'schedule', text: 'Quais horários estão vagos amanhã?', color: '#38bdf8' });
    sugestoes.push({ icon: 'info', text: 'Resumo da minha agenda de jogos.', color: '#cbd5e1' });
    sugestoes.push({ icon: 'alarm', text: 'Que horas é o meu próximo jogo?', color: '#f43f5e' });
    
    // 2. DOMÍNIO UNIVERSAL: Regras, Operacional e Financeiro
    sugestoes.push({ icon: 'gavel', text: 'Qual o prazo para cancelar minha reserva sem multa?', color: '#f87171' });
    sugestoes.push({ icon: 'hourglass_empty', text: 'Qual a tolerância de atraso na quadra?', color: '#94a3b8' });
    sugestoes.push({ icon: 'groups', text: 'Quantos jogadores preciso pra confirmar 2 horas?', color: '#c084fc' });
    sugestoes.push({ icon: 'attach_money', text: 'Qual a chave PIX e favorecido para convidados?', color: '#10b981' });
    sugestoes.push({ icon: 'payments', text: 'Qual a taxa cobrada por convidado extra?', color: '#34d399' });
    sugestoes.push({ icon: 'rule', text: 'Quem tem permissão para agendar quadras?', color: '#fbbf24' });
    sugestoes.push({ icon: 'date_range', text: 'Quantos dias para frente posso reservar uma quadra?', color: '#e879f9' });
    sugestoes.push({ icon: 'access_time', text: 'Que horas o clube abre e fecha no domingo?', color: '#a78bfa' });

    // 3. PERFIL COMPETITIVO (Ranking e Torneio)
    const rankingAtivo = (typeof configRegrasGlobal !== 'undefined' && configRegrasGlobal.ranking && configRegrasGlobal.ranking.ativo !== false);
    if (atleta.participaRanking || atleta.categoria || rankingAtivo) {
        sugestoes.push({ icon: 'emoji_events', text: 'Quem posso desafiar na minha classe de ranking?', color: '#f59e0b' });
        sugestoes.push({ icon: 'person_search', text: 'Quem são os jogadores disponíveis na minha categoria?', color: '#38bdf8' });
        sugestoes.push({ icon: 'military_tech', text: 'Qual é o formato de disputa do torneio ativo?', color: '#fbbf24' });
        sugestoes.push({ icon: 'sports_tennis', text: 'A partida do torneio tem super tie-break no terceiro set?', color: '#f43f5e' });
        sugestoes.push({ icon: 'scoreboard', text: 'Quantos pontos vale a vitória e a derrota no ranking?', color: '#c084fc' });
        sugestoes.push({ icon: 'format_list_numbered', text: 'Quantas posições acima de mim posso desafiar?', color: '#94a3b8' });
        sugestoes.push({ icon: 'timer_off', text: 'Qual a tolerância de tempo para W.O. no ranking?', color: '#f87171' });
    }

    // 4. PERFIL ESPECIAL: Professor / Treinador
    if (perfis['Professor'] || perfis['Treinador']) {
        sugestoes.push({ icon: 'school', text: 'Me mostre a grade de aulas marcadas para hoje.', color: '#60a5fa' });
        sugestoes.push({ icon: 'assignment', text: 'Resumo das minhas aulas agendadas para amanhã.', color: '#4ade80' });
    }

    // 5. PERFIL ESPECIAL: Árbitro / Diretor / Admin
    if (perfis['Arbitro'] || perfis['Admin']) {
        sugestoes.push({ icon: 'balance', text: 'Quais regras de súmula e desempate estão ativas?', color: '#f43f5e' });
        sugestoes.push({ icon: 'settings', text: 'Quantos jogadores classificam por chave nos grupos?', color: '#cbd5e1' });
    }

    return sugestoes;
}

// Medidor físico de largura em pixels antes de renderizar na tela
function medirLarguraFisicaPilula(item) {
    const tester = document.createElement('div');
    tester.className = 'pilula-sugestao tester-medicao';
    tester.style.cssText = 'position:absolute; visibility:hidden; white-space:nowrap; width:auto; left:-9999px; top:-9999px; font-size: 13px; font-weight: 500; padding: 8px 14px; display: inline-flex; align-items: center; gap: 8px; font-family: Roboto, sans-serif;';
    tester.innerHTML = `<i class="material-icons" style="font-size:16px;">${item.icon}</i> <span>${item.text}</span>`;
    document.body.appendChild(tester);
    const larguraReal = tester.offsetWidth;
    document.body.removeChild(tester);
    return larguraReal;
}

// Sorteia N itens aleatórios do catálogo sem repetir o mesmo item no mesmo par
function sortearPilulasAleatorias(catalogo, quantidade = 2) {
    if (catalogo.length <= quantidade) return [...catalogo];

    // Tenta priorizar itens que não foram mostrados no clique anterior
    let disponiveis = catalogo.filter(item => !iaUltimasPilulasExibidas.includes(item.text));
    if (disponiveis.length < quantidade) disponiveis = [...catalogo];

    // Embaralha
    const embaralhado = disponiveis.sort(() => Math.random() - 0.5);
    const selecionadas = embaralhado.slice(0, quantidade);

    iaUltimasPilulasExibidas = selecionadas.map(i => i.text);
    return selecionadas;
}

// Motor de Renderização Adaptativo
function ciclarSugestoesIA() {
    if (iaEsgotadaSessao) return;
    const container = document.getElementById('ia-menu-sugestoes');
    if (!container) return;

    const catalogo = gerarPilulasDinamicas();
    if (!catalogo || catalogo.length === 0) return;

    // Sorteia duas candidatas
    const candidatas = sortearPilulasAleatorias(catalogo, 2);

    // Calcula largura útil real do viewport
    const larguraTela = window.innerWidth;
    
    // Define a largura máxima permitida para o menu (baseado no CSS max-width: 650px ou 100vw - 24px)
    let larguraUtilDisponivel = Math.min(larguraTela - 24, 650); 
    const gapEntrePilulas = 8;

    // Mede a largura real das duas pílulas em linha única (simulação)
    const larguraItem1 = medirLarguraFisicaPilula(candidatas[0]);
    const larguraItem2 = candidatas[1] ? medirLarguraFisicaPilula(candidatas[1]) : 0;

    let pilulasParaExibir = [];
    let modoExibicao = 'unica';

    // A REGRA DE OURO UNIVERSAL: Só exibe duas se a soma exata couber na largura útil máxima permitida
    if (candidatas[1] && (larguraItem1 + larguraItem2 + gapEntrePilulas) <= larguraUtilDisponivel) {
        pilulasParaExibir = candidatas;
        modoExibicao = 'dupla';
    } else {
        // Se estourar (mesmo no PC), exibe apenas a primeira pílula com permissão para 2 linhas
        pilulasParaExibir = [candidatas[0]];
        modoExibicao = 'unica';
    }

    // Animação de Saída
    container.style.opacity = '0';
    container.style.transform = 'translateX(-50%) translateY(8px)';

    setTimeout(() => {
        container.innerHTML = '';
        container.className = `ia-menu-sugestoes modo-${modoExibicao}`;

        pilulasParaExibir.forEach(item => {
            const pilula = document.createElement('div');
            // Aplica classe de 1 linha se for modo dupla, ou de 2 linhas flexíveis se for modo única
            pilula.className = `pilula-sugestao ${modoExibicao === 'unica' ? 'pilula-formato-duas-linhas' : 'pilula-formato-linha-unica'}`;
            pilula.innerHTML = `<i class="material-icons" style="font-size:16px; color:${item.color};">${item.icon}</i> <span>${item.text}</span>`;

            pilula.onclick = () => {
                const inputTexto = document.getElementById('ia-input-texto');
                if (inputTexto) inputTexto.value = item.text;
                fecharMenuSugestoes();
                processarMensagemConcierge(item.text);
            };

            container.appendChild(pilula);
        });

        // Animação de Entrada
        container.classList.add('visivel');
        container.style.opacity = '1';
        container.style.transform = 'translateX(-50%) translateY(0)';
    }, 160);
}

function fecharMenuSugestoes() {
    const container = document.getElementById('ia-menu-sugestoes');
    if (container) {
        container.classList.remove('visivel');
        container.style.opacity = '0';
        container.style.transform = 'translateX(-50%) translateY(8px)';
    }
}

// ====================================================================
// 4. MOTOR DE VOZ (Captação Fonética Toggle & Android Permission Gateway)
// ====================================================================

// Solicita permissão nativa apenas na primeira execução da sessão
async function garantirPermissaoMicrofoneAndroid() {
    if (iaPermissaoMicrofoneConcedida) return true;

    try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop());
            iaPermissaoMicrofoneConcedida = true;
            return true;
        }
    } catch (err) {
        console.warn("Permissão de microfone negada no Android:", err);
        iaPermissaoMicrofoneConcedida = false;
        return false;
    }
    return true;
}

function prepararMotorDeVozConcierge() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const btnMic = document.getElementById('ia-btn-mic');
    
    if (!SpeechRecognition) {
        if (btnMic) btnMic.style.display = 'none'; 
        return;
    }

    iaReconhecimentoDeVoz = new SpeechRecognition();
    iaReconhecimentoDeVoz.lang = 'pt-BR';
    iaReconhecimentoDeVoz.continuous = false; 
    iaReconhecimentoDeVoz.interimResults = false;

    iaReconhecimentoDeVoz.onresult = (event) => {
        const transcricao = event.results[0][0].transcript.trim();
        if (transcricao) {
            const inputTexto = document.getElementById('ia-input-texto');
            if (inputTexto) inputTexto.value = transcricao; 
            processarMensagemConcierge(transcricao); 
        }
        encerrarMicrofoneSilencioso(); 
    };

    iaReconhecimentoDeVoz.onerror = (event) => {
        encerrarMicrofoneSilencioso();
        console.warn("Erro no reconhecimento de voz:", event.error);
        
        if (event.error === 'not-allowed') {
            iaPermissaoMicrofoneConcedida = false;
            if (typeof showToast === 'function') showToast("Permita o acesso ao microfone no celular.", "warning");
        } else if (event.error === 'no-speech') {
            if (iaModoContinuo) {
                if (typeof showToast === 'function') showToast("Não captei sua resposta. Pode repetir?", "info", 2500);
            } else {
                if (typeof showToast === 'function') showToast("Não captei sua voz. Tente novamente.", "info");
            }
        }
    };

    iaReconhecimentoDeVoz.onend = () => {
        encerrarMicrofoneSilencioso();
    };
}

// Disparo direto da escuta com verificação única de permissão
async function iniciarGravacaoVozConcierge() {
    if (!iaReconhecimentoDeVoz || iaEsgotadaSessao || iaGravandoVoz) return;

    const permissaoConcedida = await garantirPermissaoMicrofoneAndroid();
    if (!permissaoConcedida) {
        if (typeof showToast === 'function') showToast("O microfone está bloqueado no Android.", "error");
        desativarModoContinuoVisual();
        return;
    }

    const btnMic = document.getElementById('ia-btn-mic');
    const inputTexto = document.getElementById('ia-input-texto');

    try {
        iaGravandoVoz = true;
        if (btnMic) {
            btnMic.classList.add('gravando');
            btnMic.innerHTML = '<i class="material-icons">close</i>';
            btnMic.style.color = '#f87171';
        }
        if (inputTexto) {
            inputTexto.value = '';
            inputTexto.placeholder = "Ouvindo... (fale agora)";
        }
        if (navigator.vibrate) navigator.vibrate([30, 50, 30]);

        iaReconhecimentoDeVoz.start();
    } catch (e) {
        console.warn("Falha ao iniciar SpeechRecognition:", e);
        encerrarMicrofoneSilencioso();
    }
}

// Alternância manual ao tocar no botão de microfone
async function alternarGravacaoVozConcierge() {
    if (iaGravandoVoz) {
        encerrarMicrofoneSilencioso();
    } else {
        await iniciarGravacaoVozConcierge();
    }
}

function encerrarMicrofoneSilencioso() {
    iaGravandoVoz = false;
    const btnMic = document.getElementById('ia-btn-mic');
    const inputTexto = document.getElementById('ia-input-texto');
    
    if (btnMic) {
        btnMic.classList.remove('gravando');
        btnMic.innerHTML = '<i class="material-icons">mic</i>';
        btnMic.style.color = ''; 
    }
    if (inputTexto && inputTexto.placeholder === "Ouvindo... (fale agora)") {
        inputTexto.placeholder = "Peça ao SetPoint...";
    }
    if (iaReconhecimentoDeVoz) {
        try { iaReconhecimentoDeVoz.stop(); } catch(e) {}
    }
}

// ====================================================================
// 5. EXTRATOR OMNIPRESENTE DE OCUPAÇÃO (Matriz de Todas as Quadras)
// ====================================================================
function extrairContextoPlanilha() {
    let contexto = {};
    let nomeUsuario = "Atleta";
    let tipoUsuario = "Sócio";
    const headerUser = document.querySelector('.user-block') || document.querySelector('header');
    if (headerUser) {
        const textoHeader = headerUser.innerText.replace(/\n/g, ' ');
        nomeUsuario = textoHeader.split('Titular')[0].replace('Olá,', '').trim() || "Atleta";
        if (textoHeader.includes('Titular')) tipoUsuario = "Titular";
    }
    contexto.usuario = `${nomeUsuario} (${tipoUsuario})`;

    const agora = new Date();
    const diaHojeIdx = agora.getDay() === 0 ? 7 : agora.getDay();
    const diaAmanhaIdx = diaHojeIdx === 7 ? 1 : diaHojeIdx + 1;
    
    contexto.momento = `Hoje é ${agora.toLocaleDateString('pt-BR')} às ${agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

    let resumoGlobal = [];
    const todasReservas = (typeof reservasGeralGlobal !== 'undefined' && reservasGeralGlobal) ? reservasGeralGlobal : {};

    // Vasculha a matriz inteira (Todas as quadras)
    Object.keys(todasReservas).forEach(quadra => {
        let ocupadosHoje = [];
        let ocupadosAmanha = [];
        
        Object.keys(todasReservas[quadra]).forEach(slotKey => {
            const r = todasReservas[quadra][slotKey];
            if (!r || r.status === 'aula_cancelada') return;

            const diaReserva = parseInt(r.dia) || parseInt(slotKey.split('_')[0]);
            const horaIni = String(r.hora || slotKey.split('_')[1]).padStart(2, '0') + ":00";
            const textoSlot = `${horaIni} (${r.status === 'manutencao' ? 'Manutenção' : 'Ocupado'})`;

            if (diaReserva === diaHojeIdx) ocupadosHoje.push(textoSlot);
            else if (diaReserva === diaAmanhaIdx) ocupadosAmanha.push(textoSlot);
        });

        const quadraNome = quadra.replace('Quadra', 'Quadra ');
        if (ocupadosHoje.length > 0) resumoGlobal.push(`- Hoje na ${quadraNome}: Ocupado às ${ocupadosHoje.join(', ')}`);
        if (ocupadosAmanha.length > 0) resumoGlobal.push(`- Amanhã na ${quadraNome}: Ocupado às ${ocupadosAmanha.join(', ')}`);
    });

    contexto.ocupacoes = resumoGlobal.length > 0 ? resumoGlobal.join('\n') : "Todas as quadras estão TOTALMENTE LIVRES hoje e amanhã.";
    return `CONTEXTO ATUAL DO CLUBE:\n- Atleta: ${contexto.usuario}\n- Momento: ${contexto.momento}\n- Ocupações Globais:\n${contexto.ocupacoes}\n- Regra Geral: Qualquer quadra/horário não listado acima está LIVRE.`;
}

// ====================================================================
// 6. EXTRATOR DE REGRAS OPERACIONAIS, CONVIDADOS E TAXAS (SÓCIO)
// ====================================================================
function extrairRegrasDoClube() {
    let texto = "REGRAS E POLÍTICAS DO CLUBE SETPOINT:\n";

    const config = typeof configRegrasGlobal !== 'undefined' && configRegrasGlobal ? configRegrasGlobal : {};
    const convidados = typeof configConvidadosGlobal !== 'undefined' && configConvidadosGlobal ? configConvidadosGlobal : (config.Horarios?.Convidados || {});

    // 1. Antecedência Máxima
    const antecedencia = config.DiasParaLimpar !== undefined ? config.DiasParaLimpar : 3;
    texto += `- Antecedência máxima para agendar: até ${antecedencia} dia(s) para frente.\n`;

    // 2. Políticas de Cancelamento, Tolerância de Atraso e Quórum
    const prazoCanc = config.PrazoCancelamento !== undefined ? config.PrazoCancelamento : 12;
    const tolerancia = config.ToleranciaAtraso !== undefined ? config.ToleranciaAtraso : 15;
    const quorum1h = config.Quorum1h !== undefined ? config.Quorum1h : 1;
    const quorum2h = config.Quorum2h !== undefined ? config.Quorum2h : 2;
    const prazoConf = config.horasParaExpirar !== undefined ? config.horasParaExpirar : 2;

    texto += `- Prazo para cancelamento sem penalidade: até ${prazoCanc} hora(s) antes do início da partida.\n`;
    texto += `- Tolerância máxima de atraso na quadra: ${tolerancia} minuto(s).\n`;
    texto += `- Quórum mínimo de atletas: ${quorum1h} jogador(es) para 1 hora e ${quorum2h} para 2 horas de reserva.\n`;
    texto += `- Prazo de aceite de convites entre sócios: ${prazoConf} hora(s) após o envio.\n`;

    // 3. Quem tem permissão para abrir agendamentos
    if (config.PermiteAgendar) {
        const pa = config.PermiteAgendar;
        let liberados = [];
        if (pa.Titular) liberados.push("Sócios Titulares");
        if (pa.Dependente) liberados.push("Dependentes");
        if (pa.Professor) liberados.push("Professores");
        if (pa.Convidado) liberados.push("Convidados");
        texto += `- Quem pode agendar quadras: ${liberados.join(', ') || 'Apenas Sócios Titulares'}.\n`;
    }

    // 4. Taxas de Convidados e Dados de Pagamento (PIX)
    const taxa = convidados.Taxa || config.Horarios?.Convidados?.Taxa;
    const pix = convidados.ChavePix || config.Horarios?.Convidados?.ChavePix;
    const recebedor = convidados.Recebedor || config.Horarios?.Convidados?.Recebedor;

    if (taxa && taxa.trim() !== "") {
        texto += `- Taxa de Convidado / Avulso: R$ ${taxa} por convidado.\n`;
    }
    if (pix && pix.trim() !== "") {
        texto += `- Pagamento de taxa via PIX: Chave "${pix}" (Favorecido: ${recebedor || 'Arena SetPoint'}).\n`;
    }

    // 5. Horário de Funcionamento da Arena (Semana Inteira)
    const regrasPadrao = typeof regrasHorariosSaaS !== 'undefined' && regrasHorariosSaaS ? regrasHorariosSaaS : (config.Horarios?.Padrao || {});
    const nomesDias = ["", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
    
    let textoHorarios = [];
    for (let i = 1; i <= 7; i++) {
        if (regrasPadrao[i]) {
            if (regrasPadrao[i].status === 'fechado') {
                textoHorarios.push(`${nomesDias[i]}: Fechado`);
            } else {
                textoHorarios.push(`${nomesDias[i]}: ${regrasPadrao[i].abertura || '06:00'} às ${regrasPadrao[i].fechamento || '23:00'}`);
            }
        }
    }
    texto += `- Horários de funcionamento do clube: ${textoHorarios.join(' | ')}.\n`;

    return texto;
}

// ====================================================================
// 6.1. EXTRATOR DE MATCHMAKING (Nomes e Categorias)
// ====================================================================
function extrairContextoRanking() {
    let listaLegivel = [];

    // TENTATIVA 1: Varredura Visual (Lê a tela se houverem cartões de jogadores)
    const cartoesJogadores = document.querySelectorAll('.jogador-card, .nome-jogador-ranking, .linha-ranking');
    if (cartoesJogadores.length > 0) {
        cartoesJogadores.forEach(cartao => {
            const nome = cartao.innerText.replace(/\n/g, ' ').trim();
            if (nome && nome.length > 2) listaLegivel.push(nome);
        });
    }

    // TENTATIVA 2: Varredura de Memória RAM (Acessa direto sem usar window)
    const temTabelas = typeof rankingTabelasGlobal !== 'undefined' && rankingTabelasGlobal;
    const temJogadores = typeof jogadoresGlobal !== 'undefined' && jogadoresGlobal;

    if (listaLegivel.length === 0 && temTabelas && temJogadores) {
        for (const categoria in rankingTabelasGlobal) {
            const idsJogadores = rankingTabelasGlobal[categoria];
            if (Array.isArray(idsJogadores)) {
                let nomesNaCategoria = [];
                idsJogadores.forEach(id => {
                    if (id && jogadoresGlobal[id]) {
                        // Resgata o apelido ou o nome completo do atleta
                        const atleta = jogadoresGlobal[id];
                        nomesNaCategoria.push(atleta.apelido || atleta.nomeCompleto);
                    }
                });
                if (nomesNaCategoria.length > 0) {
                    listaLegivel.push(`Categoria ${categoria}: ${nomesNaCategoria.join(', ')}`);
                }
            }
        }
    }

    if (listaLegivel.length === 0) {
        return "Dados de Matchmaking: Não há jogadores listados nesta tela.";
    }

    let textoFinal = listaLegivel.join(' | ');
    if (textoFinal.length > 800) {
        textoFinal = textoFinal.substring(0, 800) + "... (lista encurtada)";
    }

    return `MATCHMAKING (JOGADORES DISPONÍVEIS):\n${textoFinal}\nRegra de IA: Responda APENAS usando os nomes reais destas listas. NÃO leia códigos soltos.`;
}

// ====================================================================
// 6.2. EXTRATOR DE AGENDA PESSOAL (Jogos do Sócio)
// ====================================================================
function extrairAgendaPessoal() {
    const nomeLogado = (localStorage.getItem('jogadorLogadoNome') || '').trim().toUpperCase();
    const idLogado = localStorage.getItem('jogadorLogadoId') || '';
    
    let apelidoLogado = nomeLogado;
    if (typeof jogadoresGlobal !== 'undefined' && jogadoresGlobal[idLogado]) {
        apelidoLogado = (jogadoresGlobal[idLogado].apelido || '').trim().toUpperCase();
    }

    if (!nomeLogado) return "AGENDA PESSOAL: Usuário não identificado.";

    const todasReservas = (typeof reservasGeralGlobal !== 'undefined' && reservasGeralGlobal) ? reservasGeralGlobal : {};
    let meusJogos = [];
    
    // Obter o dia da semana atual (1 = Segunda, ..., 7 = Domingo)
    const hoje = new Date();
    const diaAtual = hoje.getDay() === 0 ? 7 : hoje.getDay();

    Object.keys(todasReservas).forEach(quadraKey => {
        const slotsQuadra = todasReservas[quadraKey];
        if (!slotsQuadra) return;

        Object.keys(slotsQuadra).forEach(slotKey => {
            const r = slotsQuadra[slotKey];
            if (!r || r.status === 'aula_cancelada') return;

            // Filtro de Segurança 1: Ignora reservas passadas (limita a hoje + 2 dias)
            const diaReserva = parseInt(r.dia) || parseInt(slotKey.split('_')[0]);
            let diffDias = diaReserva - diaAtual;
            if (diffDias < 0) diffDias += 7; // Trata a virada da semana
            
            if (diffDias > 2) return; // Lê apenas Hoje, Amanhã e Depois de Amanhã

            const jogadoresComp = (r.jogadores_completo || '').toUpperCase();
            const jogadoresAp = (r.jogadores || '').toUpperCase();
            const organizador = (r.organizador || '').toUpperCase();

            // Filtro 2 (Expandido): Apenas jogos do sócio (jogador, organizador ou instrutor)
            const ehAula = (r.tipo === 'aula' || r.tipo === 'clinica');
            const ehMeuJogo = jogadoresComp.includes(nomeLogado) || 
                              jogadoresAp.includes(apelidoLogado) || 
                              organizador.includes(nomeLogado) || 
                              organizador.includes(apelidoLogado);

            // Se for professor logado (tem id técnico na aula) ou for o próprio jogo
            if (ehMeuJogo || (ehAula && String(r.id_professor) === idLogado)) {
                
                // Formatação do Dia Legível
                const diasNomes = ["", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
                let diaTexto = diasNomes[diaReserva] || `Dia ${diaReserva}`;
                if (diffDias === 0) diaTexto = "Hoje";
                else if (diffDias === 1) diaTexto = "Amanhã";

                const duracao = parseInt(r.duracao) || 1;
                const horaIni = String(r.hora || slotKey.split('_')[1]).padStart(2, '0') + ":00";
                const horaFim = String((r.hora || parseInt(slotKey.split('_')[1])) + duracao).padStart(2, '0') + ":00";
                
                let tipoComp = (r.isRanking === true || r.tipo === 'ranking') ? "[Ranking] " : "";
                if (ehAula) tipoComp = "[Aula] ";
                
                // Evita duplicidade
                const hashJogo = `${diaTexto}|${quadraKey}|${horaIni}`;
                if (!meusJogos.some(j => j.hash === hashJogo)) {
                    meusJogos.push({
                        hash: hashJogo,
                        texto: `- ${diaTexto} das ${horaIni} às ${horaFim} na ${quadraKey.replace('Quadra', 'Quadra ')}. ${tipoComp}Com: ${r.jogadores || 'Alunos'}`
                    });
                }
            }
        });
    });

    if (meusJogos.length === 0) {
        return "AGENDA PESSOAL DO SÓCIO LOGADO: Nenhum jogo marcado para hoje ou para os próximos 2 dias.";
    }

    return "AGENDA PESSOAL DO SÓCIO LOGADO:\n" + meusJogos.map(j => j.texto).join('\n');
}

// ====================================================================
// 6.3. EXTRATOR DAS REGRAS DE COMPETIÇÃO E SÚMULA (Torneio Ativo)
// ====================================================================
function extrairRegrasDoRanking() {
    const config = typeof configRegrasGlobal !== 'undefined' && configRegrasGlobal ? configRegrasGlobal : {};
    const ranking = config.ranking || {};
    
    if (ranking.ativo === false) {
        return "REGULAMENTO DO TORNEIO:\n- Atualmente, não há campeonato ou ranking ativo no clube.";
    }

    let texto = "REGULAMENTO DO TORNEIO/RANKING ATUAL:\n";
    
    // 1. Duração e Formato da Partida (A Súmula)
    const sumula = ranking.sumula || {};
    const duracao = ranking.duracaoPartida !== undefined ? ranking.duracaoPartida : 2;
    texto += `- Duração reservada na grade para jogos oficiais: ${duracao} hora(s).\n`;
    
    const formato = sumula.formatoPartida || "m3_tradicional_6";
    if (formato.includes('set_unico')) texto += "- O formato dos jogos é em Set Único.\n";
    else if (formato.includes('pro_set_8')) texto += "- O formato dos jogos é um Pro Set (até 8 games).\n";
    else texto += "- O formato dos jogos é em Melhor de 3 Sets.\n";
    
    if (sumula.decisaoTerceiroSet === "super_tiebreak") {
        texto += "- Em caso de empate em sets, o 3º set é decidido em Super Tie-break (10 pontos).\n";
    }
    
    if (sumula.vantagemGames === "no_ad") texto += "- Os games são disputados SEM vantagem (No-Ad/Ponto de Ouro).\n";
    else texto += "- Os games são disputados COM vantagem tradicional.\n";

    texto += `- Prazo máximo para autoconfirmação do placar: ${sumula.prazoAutoconf || 24} horas.\n`;
    texto += `- Tolerância máxima de atraso para W.O. no ranking: ${sumula.toleranciaWO || 15} minutos.\n`;

    // 2. Modelo de Disputa e Pontuação Específica
    const modelo = ranking.calendario?.formatoTorneio || ranking.modeloAtivo || "grupos";
    const piramide = ranking.piramide || {};
    const barragem = ranking.barragem || {};
    const grupos = ranking.grupos || {};

    if (modelo === "piramide") {
        texto += "- Formato Atual: Pirâmide (Escada de Desafios).\n";
        texto += `- Limite de desafios por atleta no mês: ${piramide.limiteMensal || 4}.\n`;
        texto += `- Distância permitida para desafiar: Até ${piramide.limitePosicoes || 3} posições acima da sua.\n`;
        if (piramide.mecanicaTroca === "direta") {
            texto += "- Em caso de vitória do desafiante, ele toma a posição do desafiado e o desafiado cai 1 posição.\n";
        }
    } else if (modelo === "barragem") {
        texto += "- Formato Atual: Torneio de Barragem (Pontos Corridos).\n";
        texto += `- Pontuação: Vitória vale ${barragem.pontosVitoria || 3} ponto(s), Derrota vale ${barragem.pontosDerrota || 1} ponto(s) e W.O. vale ${barragem.pontosWO || 0} ponto(s).\n`;
    } else if (modelo === "grupos") {
        texto += "- Formato Atual: Torneio de Grupos.\n";
        texto += `- Fase Inicial: Os grupos são formados por ${grupos.tamanhoGrupo || 4} atletas.\n`;
        texto += `- Classificam-se os ${grupos.classificadosGrupo || 2} melhores de cada chave para a fase eliminatória.\n`;
    }

    return texto;
}

// ====================================================================
// 6.4. EXTRATOR ORÁCULO DE BUSCA DINÂMICO (Histórico Sob Demanda - Ação 6.2)
// ====================================================================

function verificarNecessidadeHistorico(texto) {
    if (!texto) return false;
    const t = texto.toLowerCase();
    const termosHistoricos = [
        "passado", "anterior", "anteriores", "último torneio", "ultimo torneio",
        "campeão", "campeao", "campeões", "campeoes", "campeã", "campea", "venceu o torneio",
        "ganhou o torneio", "edição", "edicao", "temporada", "acervo", "histórico", "historico",
        "antigo", "ano passado", "2024", "2025", "2026"
    ];
    return termosHistoricos.some(termo => t.includes(termo));
}

async function carregarAcervoHistoricoSobDemanda() {
    if (typeof acervoHistoricoGlobalSaaS !== 'undefined' && acervoHistoricoGlobalSaaS !== null) {
        return acervoHistoricoGlobalSaaS;
    }
    if (typeof raizBanco === 'undefined' || !raizBanco) return null;

    try {
        // Tenta buscar no Hall de Campeões primeiro
        const snap = await database.ref(`${raizBanco}/hall_de_campeoes`).once('value');
        if (snap.exists() && snap.val()) {
            if (typeof acervoHistoricoGlobalSaaS !== 'undefined') {
                acervoHistoricoGlobalSaaS = snap.val();
            }
            return snap.val();
        }
    } catch (erro) {
        console.warn("⚠️ [Oráculo IA] Falha ao consultar acervo sob demanda:", erro);
    }
    return null;
}

function extrairContextoHistoricoTorneios() {
    const acervo = (typeof acervoHistoricoGlobalSaaS !== 'undefined' && acervoHistoricoGlobalSaaS) 
        ? acervoHistoricoGlobalSaaS 
        : null;

    if (!acervo || Object.keys(acervo).length === 0) {
        return "ACERVO HISTÓRICO DE TORNEIOS ENCERRADOS:\n- Nenhum torneio finalizado ou campeão registrado em edições anteriores.";
    }

    let linhasHistorico = [];
    
    // Função auxiliar para traduzir o ID do Firebase para o nome real do Atleta
    const traduzirNome = (id) => {
        if (!id) return "";
        if (typeof jogadoresGlobal !== 'undefined' && jogadoresGlobal[id]) {
            return jogadoresGlobal[id].apelido || jogadoresGlobal[id].nomeCompleto;
        }
        return "Atleta Desconhecido"; // Caso o jogador tenha sido excluído do clube
    };

    Object.keys(acervo).forEach(nomeTorneioBanco => {
        const torneio = acervo[nomeTorneioBanco];
        if (!torneio) return;

        // Limpa a string da chave do Firebase para ficar mais legível
        const nomeLegivel = nomeTorneioBanco.replace(/_/g, ' ').replace(/-/g, '').trim();
        let resumoCampeoes = [];

        Object.keys(torneio).forEach(categoriaKey => {
            const dadosCat = torneio[categoriaKey];
            const catNome = categoriaKey.replace(/_/g, ' ');
            
            if (typeof dadosCat === 'object' && dadosCat !== null) {
                const campeaoNome = traduzirNome(dadosCat.campeao);
                const viceNome = traduzirNome(dadosCat.vice);
                
                if (campeaoNome) {
                    resumoCampeoes.push(`Na categoria ${catNome}, o Campeão foi ${campeaoNome}${viceNome ? ` (Vice: ${viceNome})` : ''}`);
                }
            }
        });

        if (resumoCampeoes.length > 0) {
            linhasHistorico.push(`- Torneio: ${nomeLegivel} -> ${resumoCampeoes.join('; ')}.`);
        }
    });

    let textoFinal = linhasHistorico.join('\n');
    
    // Limite de segurança de tokens da API
    if (textoFinal.length > 1500) {
        textoFinal = textoFinal.substring(0, 1500) + "\n... (edições omitidas por segurança)";
    }

    return "HALL DE CAMPEÕES (TORNEIOS PASSADOS):\n" + textoFinal;
}

// ====================================================================
// 7. ROTEADOR DE AÇÕES (Function Calling / Dedo Invisível)
// ====================================================================
function executarAcaoDaIA(jsonDaIA) {
    if (!jsonDaIA || !jsonDaIA.intencao) return;
    
    // Normalização defensiva: remove espaços e força caixa alta
    const intencao = String(jsonDaIA.intencao).trim().toUpperCase();
    const parametros = jsonDaIA.parametros_acao || {};

    switch (intencao) {
        case "AGENDAR_QUADRA":
            if (parametros.hora_inicio) {
                const horaNumero = parseInt(parametros.hora_inicio.split(':')[0], 10);
                const hoje = new Date();
                const diaDaSemanaIdx = hoje.getDay(); 
                const diaSetPoint = diaDaSemanaIdx === 0 ? 7 : diaDaSemanaIdx;

                setTimeout(() => {
                    let quadraNum = 1;
                    const btnAtivo = document.querySelector('.tab-btn.active') || document.querySelector('.aba-quadra.active');
                    if (btnAtivo) {
                        const parts = btnAtivo.id.split('-');
                        const num = parseInt(parts[parts.length - 1], 10);
                        if (!isNaN(num)) quadraNum = num;
                    }

                    if (typeof abrirAgendamentoSaaS === 'function') {
                        abrirAgendamentoSaaS(diaSetPoint, horaNumero, { quadra: quadraNum });
                    }
                }, 1500);
            }
            break;

        case "LISTAR_DESAFIANTES":
            console.log("🤖 [Ação IA] Intenção de Matchmaking detectada. A IA já respondeu com os nomes.");
            // Na Ação 6.1 (futura), este bloco acionará a injeção dos botões de WhatsApp.
            break;

        case "CONSULTA_GERAL":
        case "ERRO_REGRA":
            // Respostas conversacionais ou históricas puras terminam aqui (apenas Toast e Voz).
            console.log("🤖 [Ação IA] Consulta respondida com sucesso.");
            break;

        default:
            console.log("🤖 [Ação IA] Intenção desconhecida:", intencao);
            break;
    }
}

// ====================================================================
// 8. DISPACHO E COMUNICAÇÃO (JSON API REST + FALLBACK + COTA INTELIGENTE)
// ====================================================================

// Lê o limite em tempo real do espelho na memória (atualizado pelo core.js)
function obterLimiteDiarioPerguntas() {
    if (typeof configRegrasGlobal !== 'undefined' && configRegrasGlobal.limiteIaDiario !== undefined) {
        const limiteConfigurado = parseInt(configRegrasGlobal.limiteIaDiario, 10);
        if (!isNaN(limiteConfigurado)) {
            return limiteConfigurado;
        }
    }
    return 10; // Fallback padrão
}

function verificarEConsumirCotaLocal() {
    const limiteDiario = obterLimiteDiarioPerguntas();
    const hoje = new Date().toLocaleDateString('pt-BR');
    let registroCota = JSON.parse(localStorage.getItem('setpoint_ia_cota') || '{}');

    if (registroCota.data !== hoje) {
        registroCota = { data: hoje, usos: 0 };
    }

    // Compara o uso armazenado com o limite FRESCO da memória RAM
    if (registroCota.usos >= limiteDiario) {
        return false; // Cota esgotada (temporária ou não, dependendo do Firebase)
    }

    registroCota.usos += 1;
    localStorage.setItem('setpoint_ia_cota', JSON.stringify(registroCota));

    console.log(`🤖 [Cota Local] Uso: ${registroCota.usos} de ${limiteDiario}`);
    return true;
}

async function processarMensagemConcierge(texto) {
    if (!verificarEConsumirCotaLocal()) {
        const limiteAtual = obterLimiteDiarioPerguntas();
        if (typeof showToast === 'function') {
            showToast(`Você atingiu seu limite diário de perguntas (${limiteAtual}/dia). Créditos renovam à meia-noite!`, "warning", 6000);
        }
        const inputTexto = document.getElementById('ia-input-texto');
        if (inputTexto) {
            inputTexto.value = '';
            inputTexto.placeholder = "Limite diário atingido. Até amanhã!";
            inputTexto.disabled = true; 
        }
        encerrarMicrofoneSilencioso();
        desativarModoContinuoVisual();
        return; 
    }

    const inputTexto = document.getElementById('ia-input-texto');
    if (inputTexto && inputTexto.disabled) {
        inputTexto.disabled = false;
        inputTexto.placeholder = "Peça ao SetPoint...";
    }

    if (!geminiApiKeyGlobal) {
        if (typeof showToast === 'function') showToast("Aguarde, conectando ao cérebro do SetPoint...", "warning");
        return;
    }

    if (inputTexto) {
        inputTexto.value = 'Interpretando pedido...';
        inputTexto.disabled = true;
    }

    // 🔮 ORÁCULO DINÂMICO: Ação 6.2 - Lazy Loading
    let contextoHistorico = "";
    if (verificarNecessidadeHistorico(texto)) {
        if (typeof showToast === 'function') {
            showToast("Buscando no Acervo Histórico do Clube...", "info", 2000);
        }
        await carregarAcervoHistoricoSobDemanda();
        contextoHistorico = extrairContextoHistoricoTorneios();
    } else {
        if (typeof showToast === 'function') showToast("Consultando a base de dados com o Gemini...", "info", 2000);
    }

    const contextoPlanilha = extrairContextoPlanilha();
    const regrasClube = extrairRegrasDoClube();
    const contextoRanking = extrairContextoRanking();
    const minhaAgenda = extrairAgendaPessoal();
    const regrasCompeticao = extrairRegrasDoRanking();

    const modelosParaTestar = [
        { nome: 'Gemini 2.5 Flash', id: 'gemini-2.5-flash' },
        { nome: 'Gemini 3.5 Flash Lite', id: 'gemini-3.5-flash-lite' },
        { nome: 'Gemini 3.5 Flash', id: 'gemini-3.5-flash' }
    ];

    const corpoRequisicao = {
        contents: [{
            parts: [{
                text: `
DIRETRIZES DO SISTEMA (GROUNDING):
Você é o concierge inteligente do clube SetPoint. Sua função é ajudar os atletas de forma educada, rápida e MUITO CONCISA.

${minhaAgenda}
${contextoPlanilha}
${regrasClube}
${regrasCompeticao}
${contextoRanking}
${contextoHistorico}

O sócio disse: "${texto}"

REGRA DE RESPOSTA E UX (MUITO IMPORTANTE):
1. O campo "mensagem" vai aparecer num pequeno Toast. Você DEVE ser ULTRA-CONCISO (Máximo de 2 a 3 frases curtas).
2. Não use formatação Markdown (como ** ou *).
3. INTELIGÊNCIA HISTÓRICA: Como o aplicativo do atleta não possui uma tela visual para ver o histórico antigo, VOCÊ é o oráculo exclusivo dele. Se ele perguntar sobre o histórico geral, não despeje todos os dados. Resuma, citando apenas 1 ou 2 torneios recentes, e pergunte se ele deseja saber sobre um campeonato ou atleta específico. Se a pergunta for exata ("quem venceu o torneio X?"), responda diretamente e de forma amigável.
4. Responda EXCLUSIVAMENTE com um objeto JSON válido contendo:
- "intencao": "AGENDAR_QUADRA", "LISTAR_DESAFIANTES" ou "CONSULTA_GERAL".
- "mensagem": Seu texto limpo e curto.
- "parametros_acao": Objeto com "quadra_id" e "hora_inicio" (ex: "20:00") se for AGENDAR_QUADRA. Vazio nas outras.
`
            }]
        }],
        generationConfig: { temperature: 0.0, responseMimeType: "application/json" }
    };

    let respostaIAObj = null;
    let cotaEsgotadaDetectada = false;

    for (const modelo of modelosParaTestar) {
        const urlEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelo.id}:generateContent?key=${geminiApiKeyGlobal}`;

        try {
            const resposta = await fetch(urlEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(corpoRequisicao)
            });

            const dados = await resposta.json();

            if (dados.candidates && dados.candidates[0].content) {
                try {
                    respostaIAObj = JSON.parse(dados.candidates[0].content.parts[0].text);
                    console.log(`🤖 [${modelo.nome} Retornou JSON]:`, respostaIAObj);
                } catch (e) {
                    console.error("❌ Erro JSON:", e);
                }
                break;
            } else if (dados.error) {
                console.warn(`⚠️ [Falha no ${modelo.nome}] Motivo:`, dados.error.message);
                if (dados.error.code === 429 || (dados.error.message && dados.error.message.includes('Quota exceeded'))) {
                    cotaEsgotadaDetectada = true;
                }
            }
        } catch (e) {
            console.warn(`Falha de conexão com ${modelo.nome}:`, e);
        }
    }

    if (respostaIAObj && respostaIAObj.mensagem) {
        if (typeof showToast === 'function') showToast(respostaIAObj.mensagem, "success", 7000);
        if (typeof falarRespostaConcierge === 'function') falarRespostaConcierge(respostaIAObj.mensagem);
        if (typeof executarAcaoDaIA === 'function') executarAcaoDaIA(respostaIAObj);
    } else {
        if (cotaEsgotadaDetectada) {
            const fab = document.getElementById('fab-ia-concierge');
            if (fab) {
                fab.innerHTML = '<i class="material-icons">bedtime</i>';
                fab.style.filter = 'grayscale(100%)';
                fab.style.opacity = '0.7';
            }

            if (inputTexto) {
                inputTexto.placeholder = "IA descansando... (Sem créditos Google)";
                inputTexto.disabled = true;
            }

            if (typeof showToast === 'function') {
                showToast("Os limites da central Google esgotaram. Volto em breve!", "warning", 8000);
            }

            fecharBarraConcierge();
            return;
        } else {
            if (typeof showToast === 'function') {
                showToast("Ocorreu um erro ao processar o seu pedido. Tente novamente.", "error");
            }
        }
    }

    if (inputTexto) {
        inputTexto.value = '';
        inputTexto.disabled = false;
        inputTexto.focus();
    }
}

// ====================================================================
// 9. DEVOLUÇÃO SENSORIAL (Text-to-Speech nativo)
// ====================================================================
function falarRespostaConcierge(textoBase) {
    if (!('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();
    encerrarMicrofoneSilencioso();

    const textoLimpo = textoBase.replace(/\*\*/g, '').replace(/\*/g, '');

    const fala = new SpeechSynthesisUtterance(textoLimpo);
    fala.lang = 'pt-BR';
    fala.rate = 1.0; 
    fala.pitch = 1.0; 

    const vozes = window.speechSynthesis.getVoices();
    const vozGoogleBr = vozes.find(v => v.name.includes('Google') && v.lang === 'pt-BR');
    if (vozGoogleBr) fala.voice = vozGoogleBr;

    iaFalaAtivaGlobal = fala;

    const reativarEscutaModoContinuo = () => {
        iaFalaAtivaGlobal = null;
        if (iaModoContinuo && !iaEsgotadaSessao) {
            // Atraso intencional maior (800ms) para libertar o hardware no Android
            setTimeout(() => {
                iniciarGravacaoVozConcierge();
            }, 800);
        }
    };

    // 🔥 O "Desfibrilador": Obriga o Android a manter o evento ativo
    let controleRespiracao = setInterval(() => {
        if (!window.speechSynthesis.speaking) {
            clearInterval(controleRespiracao);
        } else {
            // Pausa e retoma microscopicamente para renovar o timer interno do SO
            window.speechSynthesis.pause();
            window.speechSynthesis.resume();
        }
    }, 14000); // Acorda o sistema antes dos 15s críticos

    fala.onend = () => {
        clearInterval(controleRespiracao);
        reativarEscutaModoContinuo();
    };

    fala.onerror = (err) => {
        console.warn("Erro no sintetizador de voz:", err);
        clearInterval(controleRespiracao);
        reativarEscutaModoContinuo();
    };

    // Adição de segurança: timeout máximo de fallback caso o onend ainda falhe
    let tempoEstimado = textoLimpo.length * 100; // Cálculo aproximado em milissegundos
    setTimeout(() => {
        if (iaFalaAtivaGlobal) {
            console.warn("⚠️ Recuperação ativada: onend falhou, forçando libertação.");
            clearInterval(controleRespiracao);
            window.speechSynthesis.cancel();
            reativarEscutaModoContinuo();
        }
    }, Math.max(tempoEstimado, 5000));

    window.speechSynthesis.speak(fala);
}

// Inicialização automática
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('tela-visao-quadras')) {
        setTimeout(inicializarUIConcierge, 400);
    }
});