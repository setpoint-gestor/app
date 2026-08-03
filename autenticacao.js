
"use strict";

// ==========================================
// 1. CHASSI MOTOR INTERNO DE AUTO LOGIN (PERSISTÊNCIA)
// ==========================================
auth.onAuthStateChanged((user) => {
    if (!carregamentoInicial) return; // Trava de segurança: roda apenas no boot

    // 🌟 INJEÇÃO DO "GOD MODE" (PASSE LIVRE DO DESENVOLVEDOR)
    const urlParams = new URLSearchParams(window.location.search);
	const godModeClube = urlParams.get('god_mode_clube') || localStorage.getItem('god_mode_clube');

    if (godModeClube) {
        localStorage.setItem('god_mode_clube', godModeClube);
        carregamentoInicial = false;
        clubeAtivoId = godModeClube;
        raizBanco = `Clubes/${godModeClube}/sistemas`; 
        isGestorLogado = true;
        
        // Acorda os ouvintes mestres instantaneamente
        if (typeof iniciarOuvinteMestreSaaS === 'function') iniciarOuvinteMestreSaaS();

        // Busca apenas o nome do clube para colocar no cabeçalho
        database.ref(`Clubes/${godModeClube}/info_clube/nome`).once('value').then((snapNome) => {
            const nomeClubeReal = snapNome.val() || godModeClube;
            document.getElementById('txt-nome-clube').textContent = nomeClubeReal;

            // Injeção da Versão
            const elVersaoGestor = document.getElementById('txt-versao-gestor');
            if (elVersaoGestor) {
                if (window.AndroidBridge && typeof window.AndroidBridge.getAppVersion === 'function') {
                    elVersaoGestor.textContent = "v" + window.AndroidBridge.getAppVersion();
                } else {
                    elVersaoGestor.textContent = "v" + versaoWebGlobal;
                }
            }

            // Guardião de Roteamento (Dashboard vs Onboarding)
            database.ref(`${raizBanco}/config/Quadras/quantidade`).once('value').then((snapQtd) => {
                const qtd = snapQtd.val();
                if (!qtd || parseInt(qtd) < 1) {
                    if (typeof abrirOnboardingPrimeiroAcessoSaaS === 'function') {
                        abrirOnboardingPrimeiroAcessoSaaS();
                    } else {
                        navegarApp('tela-gerenciador-quadras');
                    }
                } else {
                    navegarApp('tela-gestor-dashboard'); 
                }
            });
        });

        return; // 🛑 INTERROMPE AQUI! O Firebase é ignorado e você passa direto.
    }
    // 🌟 FIM DA INJEÇÃO DO GOD MODE

    if (user) {
        // ROTA DO GESTOR (Logado no Firebase Auth)
        carregamentoInicial = false;
        database.ref('Clubes').once('value').then((snapshot) => {
            let codigoClubeEncontrado = null;
            let nomeClubeReal = "Clube";     

            snapshot.forEach((childSnapshot) => {
                const dadosClube = childSnapshot.val();
                if (dadosClube.info_clube && dadosClube.info_clube.gestor_uid === user.uid) {
                    codigoClubeEncontrado = childSnapshot.key;
                    nomeClubeReal = dadosClube.info_clube.nome || codigoClubeEncontrado; 
                }
            });

            if (codigoClubeEncontrado) {
                clubeAtivoId = codigoClubeEncontrado;
                raizBanco = `Clubes/${codigoClubeEncontrado}/sistemas`; 
                isGestorLogado = true;
                
                if (typeof iniciarOuvinteMestreSaaS === 'function') iniciarOuvinteMestreSaaS();
                
                document.getElementById('txt-nome-clube').textContent = nomeClubeReal;
				// 📱 INJEÇÃO DA VERSÃO REAL DO APK + GATILHO DE ATUALIZAÇÃO GLOBAL
                const elVersaoGestor = document.getElementById('txt-versao-gestor');
                if (elVersaoGestor) {
                    if (window.AndroidBridge && typeof window.AndroidBridge.getAppVersion === 'function') {
                        const versaoAndroidNativa = window.AndroidBridge.getAppVersion();
                        elVersaoGestor.textContent = "v" + versaoAndroidNativa;
                        
                        // 🤖 MÁGICA: O Gestor (APK) avisa o Firebase qual é a versão atual!
                        database.ref('Clubes/SaaS_Config/versao_web').set(versaoAndroidNativa);
                        
                    } else {
                        // Se não for APK (Web/PC), mostra a versão que o Firebase enviou
                        elVersaoGestor.textContent = "v" + versaoWebGlobal;
                    }
                }
                
                // 🛡️ GUARDIÃO GLOBAL: INTERCEPTA O GESTOR ANTES DO DASHBOARD
                database.ref(`${raizBanco}/config/Quadras/quantidade`).once('value').then((snapQtd) => {
                    const qtd = snapQtd.val();
                    if (!qtd || parseInt(qtd) < 1) {
                        if (typeof abrirOnboardingPrimeiroAcessoSaaS === 'function') {
                            abrirOnboardingPrimeiroAcessoSaaS();
                        } else {
                            navegarApp('tela-gerenciador-quadras');
                        }
                    } else {
                        navegarApp('tela-gestor-dashboard'); 
                    }
                });
                
            } else {
                navegarApp('tela-boas-vindas');
            }
        }).catch(() => navegarApp('tela-boas-vindas')); // Fuga em caso de falha de rede
        
    } else {
        // ROTA DO JOGADOR (Não usa Firebase Auth, usa Memória Local)
        carregamentoInicial = false;
        const clubeSalvoId = localStorage.getItem('setpoint_jogador_clube_id');
        const clubeSalvoNome = localStorage.getItem('setpoint_jogador_clube_nome');
        const jogadorSalvoId = localStorage.getItem('jogadorLogadoId');

        if (clubeSalvoId && clubeSalvoNome) {
            clubeAtivoId = clubeSalvoId;
            raizBanco = `Clubes/${clubeSalvoId}/sistemas`;
            
            if (typeof iniciarOuvinteMestreSaaS === 'function') iniciarOuvinteMestreSaaS();
            
            if (jogadorSalvoId) {
                // O Segredo do CTRL+F5: Função paciente que aguarda os scripts terminarem de baixar
                const iniciarPlanilhaSegura = setInterval(() => {
                    if (typeof abrirVisaoQuadras === 'function') {
                        clearInterval(iniciarPlanilhaSegura); // Para de procurar
                        abrirVisaoQuadras(); // Abre a planilha com sucesso
                    }
                }, 50); // Checa a cada 50 milissegundos
                return; 
            }
            
            // Tem clube salvo, mas não escolheu o jogador e senha ainda
            document.getElementById('nome-clube-encontrado').textContent = clubeSalvoNome;
            carregarDropdownLoginsSocio();
            navegarApp('tela-jogador-login');
        } else {
            // Primeiro acesso real ou vindo diretamente do site
            const urlParams = new URLSearchParams(window.location.search);
            const telaDesejada = urlParams.get('tela');

            if (telaDesejada && typeof navegarApp === 'function') {
                navegarApp(telaDesejada); // Abre direto na tela pedida pelo site (sem piscar!)
            } else {
                navegarApp('tela-boas-vindas');
            }
        }
    }
});

// ==========================================
// 2. FUNÇÕES DE AUTENTICAÇÃO GESTOR (SaaS)
// ==========================================
function loginGestorAuth() { 
    const email = document.getElementById('login-email').value.trim();
    const senderSenha = document.getElementById('login-senha').value;
    if (!email || !senderSenha) return showToast('Preencha E-mail e Senha.', 'warning');
    
    auth.signInWithEmailAndPassword(email, senderSenha).then((userCredential) => {
        const user = userCredential.user;
        database.ref('Clubes').once('value').then((snapshot) => {
            let codigoClubeEncontrado = null;
            let nomeClubeReal = "Clube";
            snapshot.forEach((childSnapshot) => {
                const dados = childSnapshot.val();  
                if (dados.info_clube && dados.info_clube.gestor_uid === user.uid) {
                    codigoClubeEncontrado = childSnapshot.key;
                    nomeClubeReal = dados.info_clube.nome || codigoClubeEncontrado;
                }
            });
            if (codigoClubeEncontrado) {
                clubeAtivoId = codigoClubeEncontrado;
                raizBanco = `Clubes/${codigoClubeEncontrado}/sistemas`;
                document.getElementById('txt-nome-clube').textContent = nomeClubeReal;
				// 📱 INJEÇÃO DA VERSÃO REAL DO APK + GATILHO DE ATUALIZAÇÃO GLOBAL
                const elVersaoGestor = document.getElementById('txt-versao-gestor');
                if (elVersaoGestor) {
                    if (window.AndroidBridge && typeof window.AndroidBridge.getAppVersion === 'function') {
                        const versaoAndroidNativa = window.AndroidBridge.getAppVersion();
                        elVersaoGestor.textContent = "v" + versaoAndroidNativa;
                        
                        // 🤖 MÁGICA: O Gestor (APK) avisa o Firebase qual é a versão atual!
                        database.ref('Clubes/SaaS_Config/versao_web').set(versaoAndroidNativa);
                        
                    } else {
                        // Se não for APK (Web/PC), mostra a versão que o Firebase enviou
                        elVersaoGestor.textContent = "v" + versaoWebGlobal;
                    }
                }
                isGestorLogado = true;
                
                // --- INÍCIO DO OUVINTE MESTRE SAAS ---
                if (typeof iniciarOuvinteMestreSaaS === 'function') iniciarOuvinteMestreSaaS();
                
                // 🛡️ GUARDIÃO GLOBAL: INTERCEPTA O GESTOR ANTES DO DASHBOARD
                database.ref(`${raizBanco}/config/Quadras/quantidade`).once('value').then((snapQtd) => {
                    const qtd = snapQtd.val();
                    if (!qtd || parseInt(qtd) < 1) {
                        if (typeof abrirOnboardingPrimeiroAcessoSaaS === 'function') {
                            abrirOnboardingPrimeiroAcessoSaaS();
                        } else {
                            navegarApp('tela-gerenciador-quadras');
                        }
                    } else {
                        navegarApp('tela-gestor-dashboard'); 
                    }
                });
                
            } else {
                showToast('Nenhum clube associado a este login.', 'error'); 
            }
        });
    }).catch(() => showToast('Dados incorretos.', 'error'));
}

function recuperarSenhaGestor() {
    const email = document.getElementById('login-email').value.trim();
    if (!email) {
        return showToast('Digite seu e-mail no campo acima para redefinir a senha.', 'warning');
    }
    
    auth.sendPasswordResetEmail(email).then(() => {
        showToast('E-mail de recuperação enviado! Verifique sua caixa de entrada.', 'success');
    }).catch((error) => {
        showToast('Erro ao enviar e-mail. Verifique se o endereço está correto.', 'error');
        console.error(error);
    });
}

function cadastrarNovoClube() { 
    const nomeClube = document.getElementById('cad-nome-clube').value.trim();
    const codigoClube = document.getElementById('cad-codigo-clube').value.trim().toUpperCase();
    const email = document.getElementById('cad-email').value.trim();
    const whatsapp = document.getElementById('cad-whatsapp').value.trim();
    const senha = document.getElementById('cad-senha').value;

    if (!nomeClube || !codigoClube || !email || !senha) return showToast('Preencha os campos obrigatórios.', 'warning');
    if (senha.length < 6) return showToast('A senha deve ter pelo menos 6 caracteres.', 'warning');

    database.ref(`Clubes/${codigoClube}`).once('value').then((snapshot) => {
        if (snapshot.exists()) {
            showToast('Este Código de Clube já está em uso.', 'error');
        } else {
            auth.createUserWithEmailAndPassword(email, senha).then((userCredential) => {
                const estruturaInicial = {
                    info_clube: { 
                        nome: nomeClube, 
                        gestor_uid: userCredential.user.uid, 
                        email_contato: email,
                        whatsapp: whatsapp || 'Não informado'
                    },
                    sistemas: { config: { Abrir: true }, jogadores: {}, reservas: {} }
                };
                
                database.ref(`Clubes/${codigoClube}`).set(estruturaInicial).then(() => {
                    clubeAtivoId = codigoClube;
                    raizBanco = `Clubes/${codigoClube}/sistemas`;
                    document.getElementById('txt-nome-clube').textContent = nomeClube;
                    isGestorLogado = true;
                    
                    if (typeof iniciarOuvinteMestreSaaS === 'function') iniciarOuvinteMestreSaaS();

                    if (typeof abrirOnboardingPrimeiroAcessoSaaS === 'function') {
                        abrirOnboardingPrimeiroAcessoSaaS();
                    } else {
                        navegarApp('tela-onboarding-quadras');
                    }

                    showToast('Clube criado com sucesso!', 'success');
                });
            }).catch(err => {
                let msgErro = "Erro ao cadastrar. Tente novamente.";
                if (err.code === 'auth/email-already-in-use') msgErro = "Este e-mail já está cadastrado em outro clube.";
                if (err.code === 'auth/invalid-email') msgErro = "Digite um e-mail válido.";
                showToast(msgErro, 'error');
            });
        }
    });
}

// ==========================================
// 3. FUNÇÕES DE AUTENTICAÇÃO JOGADOR
// ==========================================

// Prepara a tela de busca injetando o último código salvo na memória
function abrirTelaBuscaClube() {
    const ultimoCodigo = localStorage.getItem('ultimo_codigo_acessado') || "";
    document.getElementById('input-codigo-clube').value = ultimoCodigo; 
    navegarApp('tela-jogador-codigo');
}


function verificarCodigoClube() { 
    const codigo = document.getElementById('input-codigo-clube').value.trim().toUpperCase();
    if (codigo === "") return showToast('Digite o código do clube.', 'warning');

    database.ref(`Clubes/${codigo}`).once('value').then((snapshot) => {
        if (snapshot.exists()) {
            const dados = snapshot.val();
            clubeAtivoId = codigo;
            raizBanco = `Clubes/${codigo}/sistemas`; 
            const nomeRealClube = (dados.info_clube && dados.info_clube.nome) || `Clube: ${codigo}`;
            
            localStorage.setItem('setpoint_jogador_clube_id', codigo);
            localStorage.setItem('setpoint_jogador_clube_nome', nomeRealClube);
            localStorage.setItem('ultimo_codigo_acessado', codigo); 
            
            document.getElementById('nome-clube-encontrado').textContent = nomeRealClube;
            
            // Zera explicitamente o campo e limpa o cache visual do navegador
            const campoSenha = document.getElementById('acesso_user');
            if (campoSenha) campoSenha.value = "";

            // --- INJEÇÃO DA CORREÇÃO (SSOT) ---
            // Acorda o Ouvinte Mestre assim que o clube é reconhecido para preencher a RAM
            if (typeof iniciarOuvinteMestreSaaS === 'function') {
                iniciarOuvinteMestreSaaS();
            }

            carregarDropdownLoginsSocio();
            navegarApp('tela-jogador-login');
        } else {
            showToast('Clube não encontrado. Verifique o código.', 'error');
        }
    }).catch(err => {
        showToast('Erro ao conectar. Tente novamente.', 'error');
    });
}

function carregarDropdownLoginsSocio() {
    database.ref(`${raizBanco}/jogadores`).once('value').then((snapshot) => {
        if (snapshot.exists()) {
            const jogs = snapshot.val();
            const select = document.getElementById('jogadorSelect');
            select.innerHTML = '<option value="">Selecione seu nome...</option>';
            
            Object.entries(jogs).sort((a,b) => (a[1].nomeCompleto||"").localeCompare(b[1].nomeCompleto||"")).forEach(([id, j]) => {
                if(j.ativo !== false) {
                    select.innerHTML += `<option value="${id}">${j.nomeCompleto}</option>`;
                }
            });
        }
    });
}



function fazerLoginJogador() { 
    const idJogador = document.getElementById('jogadorSelect').value;
    const senhaDigitada = document.getElementById('acesso_user').value.trim();

    if (!idJogador || !senhaDigitada) {
        return showToast('Por favor, selecione seu nome e digite a senha.', 'warning');
    }

    const btnEntrar = document.querySelector('#tela-jogador-login .btn-jogador');
    const txtOriginal = btnEntrar ? btnEntrar.textContent : "Entrar";
    if (btnEntrar) {
        btnEntrar.textContent = "Validando...";
        btnEntrar.disabled = true;
    }

    database.ref(`${raizBanco}/jogadores/${idJogador}`).once('value').then((snapshot) => {
        if (btnEntrar) {
            btnEntrar.textContent = txtOriginal;
            btnEntrar.disabled = false;
        }

        if (snapshot.exists()) {
            const dados = snapshot.val();
            let senhaCorreta = dados.senha ? dados.senha.trim() : "";
            
            if (!senhaCorreta && dados.niver) {
                senhaCorreta = dados.niver.replace(/\D/g, ''); 
            }

            if (senhaCorreta === "") {
                return showToast('Seu cadastro não possui senha ou data de nascimento. Procure a secretaria.', 'error');
            }

            if (senhaDigitada === parseInt(senhaCorreta).toString() || senhaDigitada === senhaCorreta) {
                // PERSISTÊNCIA COMPLETA (SSOT)
                localStorage.setItem('jogadorLogadoId', idJogador);
                localStorage.setItem('jogadorLogadoNome', dados.nomeCompleto);
                localStorage.setItem('jogadorLogadoSocio', dados.socio || 'titular');
                localStorage.setItem('jogadorLogadoClasse', dados.classe || '');
                localStorage.setItem('jogadorLogadoPerfis', dados.perfis ? JSON.stringify(dados.perfis) : '{}');
                
                if (typeof sincronizarPresencaOnlineSaaS === 'function') {
                    sincronizarPresencaOnlineSaaS();
                }

                console.log("🟢 [Login] Autenticação concluída! Indo para a planilha...");
                showToast(`Bem-vindo, ${dados.apelido || dados.nomeCompleto}!`, 'success');
                if(typeof abrirVisaoQuadras === 'function') abrirVisaoQuadras();
            } else {
                showToast('Senha incorreta.', 'error');
            }
        } else {
            showToast('Cadastro não encontrado.', 'error');
        }
    }).catch(err => {
        if (btnEntrar) {
            btnEntrar.textContent = txtOriginal;
            btnEntrar.disabled = false;
        }
        showToast('Erro ao validar senha.', 'error'); 
        console.error(err);
    });
}




// ==========================================
// 4. FUNÇÕES DE SAÍDA (LOGOUT)
// ==========================================
function fazerLogout() { 
    // 🌟 RASGA O INGRESSO VIP DO GOD MODE SE ELE EXISTIR
    if (localStorage.getItem('god_mode_clube')) {
        localStorage.removeItem('god_mode_clube'); 
    }

    auth.signOut().then(() => {
        clubeAtivoId = ""; 
        raizBanco = ""; 
        isGestorLogado = false;
        localStorage.removeItem('jogadorLogadoId'); 
        localStorage.removeItem('jogadorLogadoNome');
        location.reload();  
    }); 
}

function trocarDeClubeJogador() { 
    localStorage.removeItem('setpoint_jogador_clube_id'); 
    localStorage.removeItem('jogadorLogadoId');
    localStorage.removeItem('jogadorLogadoNome');
    location.reload(); 
}


// ==========================================
// 5. ROTEAMENTO E TUTORIAL VINDO DO SITE
// ==========================================

// Criador do Banner Interativo do Safari
function exibirAvisoInstalacaoIOS() {
    // Evita duplicar o banner se ele já estiver visível
    if (document.getElementById('banner-dica-ios')) return;

    const banner = document.createElement('div');
    banner.id = 'banner-dica-ios';
    banner.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #1e293b;
        color: #ffffff;
        padding: 14px 18px;
        border-radius: 14px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.35);
        z-index: 99999;
        font-size: 13.5px;
        line-height: 1.4;
        font-weight: 500;
        text-align: left;
        max-width: 90%;
        width: 360px;
        cursor: pointer;
        border: 1px solid #334155;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
    `;

    banner.innerHTML = `
        <div>
            📱 <b>Dica de Instalação no Safari:</b><br>
            Toque em <b>"Compartilhar"</b> e selecione <b>"Adicionar à Tela de Início"</b>.
        </div>
        <span style="font-size: 14px; opacity: 0.7; font-weight: bold; background: rgba(255,255,255,0.15); padding: 4px 8px; border-radius: 20px;">✕</span>
    `;

    // ⏱️ Permanece na tela por 10 segundos
    const timer = setTimeout(() => {
        if (banner.parentNode) banner.remove();
    }, 10000);

    // 👈 Toque em qualquer lugar do aviso fecha imediatamente
    banner.onclick = () => {
        clearTimeout(timer);
        banner.remove();
    };

    document.body.appendChild(banner);
}

function verificarDirecionamentoSite() {
    const urlParams = new URLSearchParams(window.location.search);
    const origemPWA = urlParams.get('pwa');

    // 🍎 SE VIER DO CARD DO IPHONE NO SITE: Dispara o aviso estendido
    if (origemPWA === 'ios') {
        setTimeout(exibirAvisoInstalacaoIOS, 800);
    }
}

window.addEventListener('load', verificarDirecionamentoSite);




// ==========================================
// 6. OCULTA BOTÕES DE FECHAR NO PWA / WEB
// ==========================================
// ==========================================
// 6. OCULTA BOTÕES DE FECHAR NO PWA (iOS)
// ==========================================
function aplicarRegrasInterfacePWA() {
    // Detecta especificamente se é um dispositivo Apple (iPhone/iPad)
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    
    // Detecta se está rodando fora do navegador (instalado como PWA na tela inicial)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

    // A regra agora é cirúrgica: SÓ ESCONDE se for um iPhone instalado na tela de início
    if (isIos && isStandalone) {
        // Oculta botão de fechar na Tela de Boas-Vindas
        const btnBoasVindas = document.getElementById('btn-fechar-app');
        if (btnBoasVindas) btnBoasVindas.style.display = 'none';

        // Oculta botão de fechar no cabeçalho da Visão das Quadras
        const btnPlanilha = document.getElementById('btn-fechar-planilha');
        if (btnPlanilha) btnPlanilha.style.display = 'none';
    }
}

window.addEventListener('load', aplicarRegrasInterfacePWA);