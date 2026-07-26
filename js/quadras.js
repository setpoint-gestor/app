"use strict";

// ==========================================================================
// 1. ESTADO GLOBAL DO GERENCIADOR DE QUADRAS
// ==========================================================================
let ordemInvertidaSaaS = localStorage.getItem('setpoint_ordem_quadras') === 'true';
let filtroPesquisaSaaS = '';
let cacheQuadrasSaaS = {}; 

// Estado Mestre Arquitetural: Preferências compartilhadas por todas as quadras
let visibilidadeGlobalSaaS = { piso: true, vip: true, luz: true, arqui: true };

function atualizarBotaoInversaoUI() {
    const btn = document.getElementById('btn-inverter-ordem');
    if (btn) {
        btn.style.background = ordemInvertidaSaaS ? 'var(--cor-escura, #1e293b)' : '#e2e8f0';
        btn.style.color = ordemInvertidaSaaS ? '#ffffff' : '#475569';
    }
}

// ==========================================================================
// 2. MOTOR DE ENTRADA E CARREGAMENTO PRINCIPAL (CARREGA INFRA + PREFERÊNCIAS)
// ==========================================================================
function abrirGerenciadorQuadras() {
    navegarApp('tela-gerenciador-quadras');
    
    database.ref(`${raizBanco}/config/Quadras`).once('value').then((snapshot) => {
        const configQuadras = snapshot.val() || {};
        const qtdSalva = parseInt(configQuadras.quantidade) || 0;
        const nomesSalvos = configQuadras.nomes || {};

        // Configuração de Engenharia: Puxa o painel de filtros globais salvos do clube
        visibilidadeGlobalSaaS = configQuadras.visibilidadeGlobal || { piso: true, vip: true, luz: true, arqui: true };
        
        // Sincroniza visualmente as caixas da gaveta sanfona com o banco de dados
        document.getElementById('vis-global-piso').checked = visibilidadeGlobalSaaS.piso !== false;
        document.getElementById('vis-global-vip').checked = visibilidadeGlobalSaaS.vip !== false;
        document.getElementById('vis-global-luz').checked = visibilidadeGlobalSaaS.luz !== false;
        document.getElementById('vis-global-arqui').checked = visibilidadeGlobalSaaS.arqui !== false;

        renderizarCardsQuadrasDoBanco(qtdSalva, nomesSalvos);
    }).catch(err => {
        console.error("Erro ao carregar quadras do banco:", err);
        showToast("Erro ao carregar configurações das quadras.", "error");
    });
}

// ==========================================================================
// 3. RENDERIZADOR DE CARDS FILTRADO PELA DIRETRIZ GLOBAL DO CLUBE
// ==========================================================================
function renderizarCardsQuadrasDoBanco(quantidade, nomesSalvos) {
    const container = document.getElementById('container-cards-quadras');
    const indicador = document.getElementById('indicador-qtd-quadras');
    if (!container) return;

    container.innerHTML = '';
    atualizarBotaoInversaoUI();

    const qtd = parseInt(quantidade) || 0;
    if (indicador) {
        indicador.innerText = `Você tem ${qtd} ${qtd === 1 ? 'quadra configurada' : 'quadras configuradas'}`;
    }

    let listaIndices = [];
    for (let i = 1; i <= qtd; i++) {
        listaIndices.push(i);
    }

    if (ordemInvertidaSaaS) {
        listaIndices.reverse();
    }

    listaIndices.forEach((i) => {
        let dadosQuadra = nomesSalvos[i] || {};
        let nomeFantasia = typeof dadosQuadra === 'object' ? (dadosQuadra.nome || `Quadra ${i}`) : dadosQuadra;
        let statusBanco = nomesSalvos[`status_${i}`] || 'liberada';
        
        let piso = dadosQuadra.piso || '';
        let isVip = dadosQuadra.vip === true;
        let temLuz = dadosQuadra.iluminacao === true;
        let temArqui = dadosQuadra.arquibancada === true;
        let capArqui = dadosQuadra.capacidade || '';

        cacheQuadrasSaaS[i] = nomeFantasia.toLowerCase();

        if (filtroPesquisaSaaS && !cacheQuadrasSaaS[i].includes(filtroPesquisaSaaS)) {
            return;
        }

        let statusFormatado = 'Liberada';
        let colCirculo = '#28a745'; 

        if (statusBanco === 'interditada' || statusBanco === 'interdita') {
            statusFormatado = 'Interditada';
            colCirculo = '#dc3545'; 
        } else if (statusBanco === 'bloqueada') {
            statusFormatado = 'Bloqueada';
            colCirculo = '#f97316'; 
        }

        // 🧠 MATRIZ DE ESTADOS INTELIGENTE: Monta dinamicamente as ações cabíveis
        let botoesStatusHTML = '';
        if (statusBanco === 'liberada') {
            botoesStatusHTML += `
                <button onclick="event.stopPropagation(); mudarStatusDiretoSaaS(${i}, 'interditada')"><i class="material-icons" style="color:#dc3545;">block</i> Interditar</button>
                <button onclick="event.stopPropagation(); mudarStatusDiretoSaaS(${i}, 'bloqueada')"><i class="material-icons" style="color:#f97316;">warning</i> Bloquear</button>
            `;
        } else if (statusBanco === 'interditada' || statusBanco === 'interdita') {
            botoesStatusHTML += `
                <button onclick="event.stopPropagation(); mudarStatusDiretoSaaS(${i}, 'liberada')"><i class="material-icons" style="color:#28a745;">check_circle</i> Liberar</button>
            `;
        } else if (statusBanco === 'bloqueada') {
            botoesStatusHTML += `
                <button onclick="event.stopPropagation(); mudarStatusDiretoSaaS(${i}, 'liberada')"><i class="material-icons" style="color:#28a745;">check_circle</i> Liberar</button>
                <button onclick="event.stopPropagation(); mudarStatusDiretoSaaS(${i}, 'interditada')"><i class="material-icons" style="color:#dc3545;">block</i> Interditar</button>
            `;
        }

        const card = document.createElement('div');
        card.className = 'quadra-card-premium';
        
        // Regra de Ouro: Pílulas fixas obedecem estritamente ao filtro global unificado
        let tagsFisicasHTML = '';
        if (piso && visibilidadeGlobalSaaS.piso !== false) {
            tagsFisicasHTML += `<span class="quadra-badge-item" style="background-color: #7f8c8d;">${piso}</span>`;
        }
        if (isVip && visibilidadeGlobalSaaS.vip !== false) {
            tagsFisicasHTML += `<span class="quadra-badge-item" style="background-color: #d97706;">VIP</span>`;
        }
        if (temLuz && visibilidadeGlobalSaaS.luz !== false) {
            tagsFisicasHTML += `<span class="quadra-badge-item" style="background-color: #16a34a;">Refletores</span>`;
        }
        if (temArqui && visibilidadeGlobalSaaS.arqui !== false) {
            tagsFisicasHTML += `<span class="quadra-badge-item" style="background-color: #0d9488;">Arq. ${capArqui ? '(' + capArqui + ')' : ''}</span>`;
        }

        card.innerHTML = `
            <div class="quadra-avatar-status" style="background-color: ${colCirculo};">
                ${i}
            </div>
            
            <div class="quadra-info-block">
                <h4 class="quadra-titulo-fixo">Quadra ${i}</h4>
                <div style="font-size: 13px; color: #7f8c8d; margin-bottom: 5px;">${nomeFantasia}</div>
                
                <div class="quadra-badges-container">
                    <span class="quadra-badge-item" style="background-color: ${colCirculo};">${statusFormatado}</span>
                    
                    <span id="pilula-aula-${i}" class="quadra-badge-item" style="display:none; background-color: #2563eb;">Aula</span>
                    <span id="pilula-dupla-${i}" class="quadra-badge-item" style="display:none; background-color: #2b5c3f;">Dupla</span>
                    <span id="pilula-convidado-${i}" class="quadra-badge-item" style="display:none; background-color: #9333ea;">Convidado</span>
                    
                    ${tagsFisicasHTML}
                </div>
            </div>
            
            <div class="quadra-kebab-container">
                <button class="quadra-btn-kebab" onclick="abrirMenuOpcoesQuadraSaaS(event, ${i})">
                    <i class="material-icons">more_vert</i>
                </button>
                
                <div id="dropdown-quadra-${i}" class="dropdown-saas-menu">
                    <button onclick="event.stopPropagation(); abrirModalCadastroQuadraSaaS(true, ${i})"><i class="material-icons">edit</i> Editar Quadra</button>
                    
                    ${botoesStatusHTML}
                    
                    <div style="height: 1px; background: #eee; margin: 2px 0;"></div>
                    <button class="item-excluir-saas" onclick="event.stopPropagation(); solicitarExclusaoQuadraSaaS(${i})"><i class="material-icons">delete</i> Excluir Quadra</button>
                </div>
            </div>
        `;
        
        container.appendChild(card);
        verificarSensoresAtivosNoBanco(i);
    });
}


// ==========================================================================
// 4. MECÂNICA DE ABERTURA E PERSISTÊNCIA DA GAVETA MESTRE GLOBAL
// ==========================================================================
function toggleGavetaFiltrosGlobalSaaS() {
    const gaveta = document.getElementById('gaveta-filtros-global-quadras');
    const btn = document.getElementById('btn-filtros-global-quadras');
    if (!gaveta) return;
    
    const estaVisivel = gaveta.style.display === 'block';
    gaveta.style.display = estaVisivel ? 'none' : 'block';
    
    if (btn) {
        btn.style.background = estaVisivel ? '#e2e8f0' : 'var(--cor-escura, #1e293b)';
        btn.style.color = estaVisivel ? '#475569' : '#ffffff';
    }
}

function salvarFiltrosGlobalSaaS() {
    visibilidadeGlobalSaaS = {
        piso: document.getElementById('vis-global-piso').checked,
        vip: document.getElementById('vis-global-vip').checked,
        luz: document.getElementById('vis-global-luz').checked,
        arqui: document.getElementById('vis-global-arqui').checked
    };
    
    // Salva em um endereço mestre unificado do clube
    database.ref(`${raizBanco}/config/Quadras/visibilidadeGlobal`).set(visibilidadeGlobalSaaS).then(() => {
        // Recarrega o painel instantaneamente aplicando o sumiço/aparecimento em lote
        abrirGerenciadorQuadras();
    });
}

// ==========================================================================
// 5. FORMULÁRIO DE INFRAESTRUTURA INDIVIDUAL (TOTALMENTE LIMPO)
// ==========================================================================
function abrirModalCadastroQuadraSaaS(isEdicao, index = null) {
    const modal = document.getElementById('modal-form-quadra');
    const faixa = document.getElementById('faixa-status-quadra');
    const titulo = document.getElementById('titulo-form-quadra');
    const chaveInput = document.getElementById('chave-edicao-quadra');
    
    if (!modal) return;

    document.querySelectorAll('#esportes-grid-quadra .pilula-check-saas').forEach(el => el.classList.remove('ativa'));
    
    if (!isEdicao) {
        database.ref(`${raizBanco}/config/Quadras/quantidade`).once('value').then((snap) => {
            const proxima = (parseInt(snap.val()) || 0) + 1;
            
            chaveInput.value = ""; 
            titulo.innerText = `Nova Quadra ${proxima}`;
            faixa.className = "faixa-status faixa-verde";
            
            document.getElementById('inp-nome-quadra').value = `Quadra ${proxima}`;
            document.getElementById('inp-piso-quadra').value = "Saibro";
            document.getElementById('check-vip-quadra').checked = false;
            document.getElementById('check-luz-quadra').checked = true;
            document.getElementById('check-arquibancada-quadra').checked = false;
            toggleCampoCapacidadeSaaS(false);
            document.getElementById('inp-capacidade-quadra').value = "";
            
            modal.classList.add('visivel');
        });
    } else {
        chaveInput.value = index;
        
        database.ref(`${raizBanco}/config/Quadras`).once('value').then((snap) => {
            const config = snap.val() || {};
            const nomes = config.nomes || {};
            const dados = nomes[index] || {};
            const statusAtual = config.nomes[`status_${index}`] || 'liberada';

            if (statusAtual === 'liberada') faixa.className = "faixa-status faixa-verde";
            if (statusAtual === 'interditada' || statusAtual === 'interdita') faixa.className = "faixa-status faixa-vermelha";
            if (statusAtual === 'bloqueada') faixa.className = "faixa-status faixa-laranja";

            titulo.innerText = `Editar Quadra ${index}`;
            
            document.getElementById('inp-nome-quadra').value = typeof dados === 'object' ? (dados.nome || `Quadra ${index}`) : dados;
            document.getElementById('inp-piso-quadra').value = dados.piso || "Saibro";
            document.getElementById('check-vip-quadra').checked = dados.vip === true;
            document.getElementById('check-luz-quadra').checked = dados.iluminacao !== false; 
            document.getElementById('check-arquibancada-quadra').checked = dados.arquibancada === true;
            
            toggleCampoCapacidadeSaaS(dados.arquibancada === true);
            document.getElementById('inp-capacidade-quadra').value = dados.capacidade || "";

            if (dados.esportes && typeof dados.esportes === 'object') {
                Object.keys(dados.esportes).forEach(esp => {
                    const pilula = document.querySelector(`#esportes-grid-quadra .pilula-check-saas[onclick*="'${esp}'"]`);
                    if (pilula) pilula.classList.add('ativa');
                });
            }

            modal.classList.add('visivel');
        });
    }
}

function fecharModalCadastroQuadraSaaS() {
    const modal = document.getElementById('modal-form-quadra');
    if (modal) modal.classList.remove('visivel');
}

function toggleSelecaoEsporteSaaS(elemento, esporte) {
    if (navigator.vibrate) navigator.vibrate(20);
    elemento.classList.toggle('ativa');
}

function toggleCampoCapacidadeSaaS(checked) {
    const grupo = document.getElementById('grupo-capacidade-arquibancada');
    if (!grupo) return;
    if (checked) {
        grupo.classList.add('visivel');
    } else {
        grupo.classList.remove('visivel');
        document.getElementById('inp-capacidade-quadra').value = "";
    }
}

function salvarConfiguracaoRichQuadraSaaS() {
    const nomeInp = document.getElementById('inp-nome-quadra').value.trim();
    const pisoInp = document.getElementById('inp-piso-quadra').value;
    const vipInp = document.getElementById('check-vip-quadra').checked;
    const luzInp = document.getElementById('check-luz-quadra').checked;
    const arquiInp = document.getElementById('check-arquibancada-quadra').checked;
    const capInp = document.getElementById('inp-capacidade-quadra').value;
    const chaveEdicao = document.getElementById('chave-edicao-quadra').value;

    if (!nomeInp) {
        showToast("Por favor, dê um nome para a quadra.", "warning");
        return;
    }

    const esportesSalvar = {};
    document.querySelectorAll('#esportes-grid-quadra .pilula-check-saas.ativa').forEach(el => {
        const match = el.getAttribute('onclick').match(/'([^']+)'/);
        if (match && match[1]) {
            esportesSalvar[match[1]] = true;
        }
    });

    // O payload individual salva puramente o hardware físico da quadra
    const payloadQuadra = {
        nome: nomeInp,
        piso: pisoInp,
        vip: vipInp,
        iluminacao: luzInp,
        arquibancada: arquiInp,
        capacidade: arquiInp ? capInp : "",
        esportes: esportesSalvar
    };

    if (chaveEdicao === "") {
        database.ref(`${raizBanco}/config/Quadras`).once('value').then((snap) => {
            const config = snap.val() || {};
            const qtdAtual = parseInt(config.quantidade) || 0;
            const proximoIndex = qtdAtual + 1;

            const updates = {};
            updates['quantidade'] = proximoIndex;
            updates[`nomes/${proximoIndex}`] = payloadQuadra;
            updates[`nomes/status_${proximoIndex}`] = 'liberada';

            database.ref(`${raizBanco}/config/Quadras`).update(updates).then(() => {
                showToast(`${nomeInp} adicionada com sucesso!`, 'success');
                document.getElementById('busca-quadra').value = '';
                filtroPesquisaSaaS = '';
                fecharModalCadastroQuadraSaaS();
                abrirGerenciadorQuadras();
            });
        });
    } else {
        const updates = {};
        updates[`nomes/${chaveEdicao}`] = payloadQuadra;

        database.ref(`${raizBanco}/config/Quadras`).update(updates).then(() => {
            showToast("Configurações da quadra updated!", 'success');
            fecharModalCadastroQuadraSaaS();
            abrirGerenciadorQuadras();
        });
    }
}

// ==========================================================================
// 6. CONTROLADORES EXECUTIVOS DO ECOSSISTEMA
// ==========================================================================
function filtrarQuadrasPorNomeSaaS(valor) {
    filtroPesquisaSaaS = valor.trim().toLowerCase();
    database.ref(`${raizBanco}/config/Quadras`).once('value').then((snapshot) => {
        const dados = snapshot.val() || {};
        renderizarCardsQuadrasDoBanco(dados.quantidade || 0, dados.nomes || {});
    });
}

function alternarInversaoOrdemSaaS() {
    ordemInvertidaSaaS = !ordemInvertidaSaaS;
    localStorage.setItem('setpoint_ordem_quadras', ordemInvertidaSaaS);
    
    database.ref(`${raizBanco}/config/Quadras`).once('value').then((snapshot) => {
        const dados = snapshot.val() || {};
        renderizarCardsQuadrasDoBanco(dados.quantidade || 0, dados.nomes || {});
    });
}

function abrirMenuOpcoesQuadraSaaS(event, index) {
    event.stopPropagation();
    document.querySelectorAll('.dropdown-saas-menu').forEach(el => el.style.display = 'none');
    
    const dropdown = document.getElementById(`dropdown-quadra-${index}`);
    if (dropdown) dropdown.style.display = 'block';
    
    document.onclick = function() {
        if (dropdown) dropdown.style.display = 'none';
    };
}

function mudarStatusDiretoSaaS(index, novoStatus) {
    database.ref(`${raizBanco}/config/Quadras/nomes/status_${index}`).set(novoStatus).then(() => {
        showToast("Status da quadra atualizado com sucesso!", 'success');
        abrirGerenciadorQuadras();
    });
}


function solicitarExclusaoQuadraSaaS(index) {
    if (navigator.vibrate) {
        navigator.vibrate(40);
    }

    // 🛡️ PASSO 1: Validação sequencial imediata antes de onerar o servidor
    database.ref(`${raizBanco}/config/Quadras`).once('value').then((snapshot) => {
        const configQuadras = snapshot.val() || {};
        const qtdAtual = parseInt(configQuadras.quantidade) || 0;
        
        if (index !== qtdAtual) {
            showToast("Por motivos de segurança matemática, remova as quadras sequencialmente (a última da fila).", "warning");
            return;
        }

        showToast("Escaneando riscos operacionais...", "info");

        let chavesReservasParaDeletar = []; // 📦 Rascunho local para armazenar os nós de reservas órfãs detectados

        // 🔍 PASSO 2: Varredura Assíncrona em Lote (Sensores de Impacto)
        Promise.all([
            database.ref(`${raizBanco}/config/Horarios/Aulas/Quadra${index}`).once('value'),
            database.ref(`${raizBanco}/config/Horarios/Duplas/Quadra${index}`).once('value'),
            database.ref(`${raizBanco}/config/Horarios/Convidados/Quadra${index}`).once('value'),
            database.ref(`${raizBanco}/reservas`).once('value')
        ]).then(([snapAulas, snapDuplas, snapConvidados, snapReservas]) => {
            
            // Contabilização reativa dos nós de configuração
            const qtdAulas = snapAulas.exists() && snapAulas.val().Grade ? Object.keys(snapAulas.val().Grade).length : 0;
            const qtdDuplas = snapDuplas.exists() && snapDuplas.val().Grade ? Object.keys(snapDuplas.val().Grade).length : 0;
            const qtdConvidados = snapConvidados.exists() && snapConvidados.val().Grade ? Object.keys(snapConvidados.val().Grade).length : 0;
            
            // Algoritmo por extração de dígitos e batimento de strings
            let qtdReservas = 0;
            if (snapReservas.exists()) {
                const resData = snapReservas.val();
                
                // Mapeia reativamente o nome fantasia salvo na infraestrutura para checagem cruzada
                const dadosQuadraAtual = configQuadras.nomes ? configQuadras.nomes[index] : null;
                const nomeFantasiaAtual = typeof dadosQuadraAtual === 'object' ? (dadosQuadraAtual.nome || `Quadra ${index}`) : (dadosQuadraAtual || `Quadra ${index}`);

                Object.entries(resData).forEach(([key, slots]) => {
                    if (!slots || typeof slots !== 'object') return;

                    // Isola apenas os números de chaves dinâmicas como "Quadra - 9" ou "Quadra 9"
                    const digitosChave = key.replace(/\D/g, '');
                    const numeroQuadraChave = digitosChave ? parseInt(digitosChave) : null;

                    // Valida a herança se bater com o texto exato do nome ou se for a mesma numeração de quadra
                    const pertenceAEstaQuadra = 
                        (key.toLowerCase() === nomeFantasiaAtual.toLowerCase()) || 
                        (key.toLowerCase().includes('quadra') && numeroQuadraChave === index);

                    if (pertenceAEstaQuadra) {
                        qtdReservas += Object.keys(slots).length;
                        chavesReservasParaDeletar.push(key); // Guardamos a string da chave (Ex: "Quadra - 9") para expurgo
                    }
                });
            }

            // 📊 PASSO 3: Construção Dinâmica do Modal de Impacto Reativo (Texto Otimizado)
            let msgHTML = "";
            const totalImpactos = qtdAulas + qtdDuplas + qtdConvidados + qtdReservas;

            if (totalImpactos > 0) {
                msgHTML = `
                    <div style="text-align: left; font-size: 14px; line-height: 1.6; color: #334155;">
                        Deseja mesmo excluir permanentemente a <b>Quadra ${index}</b>?<br><br>
                        <b style="color: #e11d48; display: block; margin-bottom: 6px;">⚠️ ALERTA DE IMPACTO OPERACIONAL:</b>
                        O scanner detectou os seguintes dados ativos que serão removidos permanentemente:
                        <ul style="margin: 6px 0; padding-left: 20px; color: #475569; font-size: 13.5px;">
                            ${qtdAulas > 0 ? `<li><b>${qtdAulas}</b> horário(s) na Grade de Aulas</li>` : ''}
                            ${qtdDuplas > 0 ? `<li><b>${qtdDuplas}</b> horário(s) de Treino de Duplas</li>` : ''}
                            ${qtdConvidados > 0 ? `<li><b>${qtdConvidados}</b> exceção(ões) de Convidados</li>` : ''}
                            ${qtdReservas > 0 ? `<li><b>${qtdReservas}</b> agendamento(s) ou histórico(s) de reserva</li>` : ''}
                        </ul>
                    </div>
                `;
            } else {
                msgHTML = `
                    <div style="text-align: left; font-size: 14px; line-height: 1.6; color: #334155;">
                        Deseja mesmo excluir permanentemente a <b>Quadra ${index}</b>?<br><br>
                        <b style="color: #16a34a; display: block; margin-bottom: 6px;">✅ ZONA DE RISCO ZERO:</b>
                        O scanner não encontrou nenhuma reserva, aula ou configuração activa vinculada a esta quadra. A remoção é 100% segura.
                    </div>
                `;
            }

            // 🚀 PASSO 4: Execução do Despacho Limpo no Firebase Realtime Database
            showPrompt("⚠️ ATENÇÃO TOTAL", msgHTML, () => {
                const novaQtd = qtdAtual - 1;
                
                // Expurgando hardware e subnós órfãos para manter o banco limpo
                database.ref(`${raizBanco}/config/Quadras/nomes/${index}`).remove();
                database.ref(`${raizBanco}/config/Quadras/nomes/status_${index}`).remove();
                database.ref(`${raizBanco}/config/Horarios/Aulas/Quadra${index}`).remove();
                database.ref(`${raizBanco}/config/Horarios/Duplas/Quadra${index}`).remove();
                database.ref(`${raizBanco}/config/Horarios/Convidados/Quadra${index}`).remove();
                
                // Expulsa as reservas órfãs do banco de dados para evitar reaparecimento
                if (chavesReservasParaDeletar.length > 0) {
                    chavesReservasParaDeletar.forEach(ch => {
                        database.ref(`${raizBanco}/reservas/${ch}`).remove();
                    });

                    // =========================================================================
                    // 📝 ANOTAÇÃO DE ARQUITETURA (PENDÊNCIA DE SPRINT FUTURA):
                    // TODO: Mais tarde, vamos trabalhar aqui para capturar os IDs/WhatsApps dos 
                    // usuários dessas reservas canceladas que acabamos de apagar do servidor,
                    // montando o barramento para disparar um push/aviso informando a exclusão da quadra.
                    // =========================================================================
                }
                
                database.ref(`${raizBanco}/config/Quadras/quantidade`).set(novaQtd).then(() => {
                    showToast("Quadra e todas as suas dependências removidas!", "success");
                    abrirGerenciadorQuadras();
                });
            });

        }).catch(err => {
            console.error("Erro ao auditar riscos da quadra:", err);
            showToast("Erro ao processar auditoria de dados no servidor.", "error");
        });
    });
}



function verificarSensoresAtivosNoBanco(num) {
    // Sensor 1: Grade de Aulas
    database.ref(`${raizBanco}/config/Horarios/Aulas/Quadra${num}`).once('value').then(snap => {
        if (snap.exists() && snap.val() !== null) {
            const dadosAulas = snap.val();
            // Só acende a pílula se a chave mestra for true ou se houver aula marcada na grade
            const temAula = (dadosAulas.Grade && Object.keys(dadosAulas.Grade).length > 0);
            
            if (dadosAulas.Ativo === true || temAula) {
                const el = document.getElementById(`pilula-aula-${num}`);
                if (el) el.style.display = 'inline-flex';
            }
        }
    });

    // Sensor 2: Treino de Duplas
    database.ref(`${raizBanco}/config/Horarios/Duplas/Quadra${num}`).once('value').then(snap => {
        if (snap.exists() && snap.val() !== null) {
            const dadosDuplas = snap.val();
            // Só acende a pílula se a chave mestra for true ou se houver treino marcado
            const temDupla = (dadosDuplas.Grade && Object.keys(dadosDuplas.Grade).length > 0);
            
            if (dadosDuplas.Ativo === true || temDupla) {
                const el = document.getElementById(`pilula-dupla-${num}`);
                if (el) el.style.display = 'inline-flex';
            }
        }
    });

    // Sensor 3: Convidados (A origem da pílula fantasma)
    database.ref(`${raizBanco}/config/Horarios/Convidados/Quadra${num}`).once('value').then(snap => {
        if (snap.exists() && snap.val() !== null) {
            const dadosConvidados = snap.val();
            // BLINDAGEM: O objeto "Ativo" pode vir como "Ativo" ou "Ativa" (legado do banco). 
            const mestreConvidado = dadosConvidados.Ativo === true || dadosConvidados.Ativa === true;
            const temExcecaoConvidado = (dadosConvidados.Grade && Object.keys(dadosConvidados.Grade).length > 0);

            // O sistema só vai acender se o botão central estiver ligado ou houver exceções na Grade
            if (mestreConvidado || temExcecaoConvidado) {
                const el = document.getElementById(`pilula-convidado-${num}`);
                if (el) el.style.display = 'inline-flex';
            }
        }
    });
}




// ========================================================
// 7. ATALHO EXCLUSIVO DE DESENVOLVIMENTO (RESET DE FÁBRICA)
// ========================================================
function solicitarResetDeFabricaSaaS() {
    
    if (navigator.vibrate) {
        navigator.vibrate(60);
    }

    // 1. Monta o corpo do formulário de validação em HTML
    const msgHTML = `
        <div style="text-align: left; font-size: 14px; line-height: 1.6; color: #334155;">
            Esta operação é <b style="color: #dc3545;">destrutiva</b> e apagará todas as quadras, agendamentos e grades configuradas deste clube para testar o Onboarding do zero.<br><br>
            
            Para confirmar o reset, digite a palavra <b>RESET</b> no campo abaixo:
            
            <input type="text" id="input-confirmacao-reset" class="input-app" placeholder="Digite RESET aqui" 
                   style="width: 100%; margin-top: 12px; text-align: center; font-weight: bold; text-transform: uppercase; letter-spacing: 2px;">
        </div>
    `;

    // 2. Dispara o modal nativo do chassi SetPoint Gestor
    showPrompt("⚠️ Reset de Fábrica Operacional", msgHTML, () => {
        
        const campoConfirmacao = document.getElementById('input-confirmacao-reset');
        const token = campoConfirmacao ? campoConfirmacao.value.trim().toUpperCase() : "";

        // Se o token não bater, cancela a destruição imediatamente
        if (token !== "RESET") {
            showToast("A palavra de confirmação está incorreta. Reset cancelado.", "warning");
            return;
        }

        showToast("Executando reset estrutural no servidor...", "info");

        // 3. Monta o lote de caminhos que serão limpos no Firebase de uma vez só
        const caminhosParaLimpar = {
            [`${raizBanco}/config/Quadras`]: null,
            [`${raizBanco}/reservas`]: null,
            [`${raizBanco}/config/Horarios/Aulas`]: null,
            [`${raizBanco}/config/Horarios/Duplas`]: null,
            [`${raizBanco}/config/Horarios/Convidados`]: null
        };

        // 4. Dispara a atualização em lote (multi-path update) para o Firebase
        database.ref().update(caminhosParaLimpar).then(() => {
            
            showToast("Banco limpo com sucesso! Reiniciando chassi...", "success");
            
            setTimeout(() => {
                location.reload();
            }, 1500);

        }).catch(err => {
            console.error("Erro ao executar reset do clube:", err);
            showToast("Falha técnica ao tentar limpar as rotas do servidor.", "error");
        });

    });

}



// ========================================================
// 8. MOTOR DE ONBOARDING: ASSISTENTE DE PRIMEIRO ACESSO (FASE 3)
// ========================================================

/**
 * Ativa a tela de boas-vindas e garante o estado inicial correto
 */
function abrirOnboardingPrimeiroAcessoSaaS() {
    
    navegarApp('tela-onboarding-quadras');  
    
    const etapaInput = document.getElementById('onboarding-etapa-input');
    const etapaPreview = document.getElementById('onboarding-etapa-preview');
    const inputQtd = document.getElementById('input-onboarding-qtd');
    
    if (etapaInput) {
        etapaInput.style.display = 'block';
    }
    
    if (etapaPreview) {
        etapaPreview.style.display = 'none';
    }
    
    if (inputQtd) {
        inputQtd.value = 1; // Força começar com o mínimo obrigatório de 1
    }
    
}


/**
 * Valida o número inserido e gera a revisão prévia para o gestor
 */
function avancarPreviewOnboardingSaaS() {
    
    const inputQtd = document.getElementById('input-onboarding-qtd');
    let qtd = inputQtd ? parseInt(inputQtd.value) : 1;
    
    // Trava física de segurança: nunca permite menos de 1 quadra
    if (isNaN(qtd) || qtd < 1) {
        showToast("O clube deve possuir obrigatoriamente pelo menos 1 quadra.", "warning");
        if (inputQtd) {
            inputQtd.value = 1;
        }
        return;
    }
    
    if (navigator.vibrate) {
        navigator.vibrate(30);
    }
    
    // Monta o texto explicativo dinâmico (Preview) para o Dono do Clube revisar
    const textoPreviewDOM = document.getElementById('onboarding-texto-preview');
    if (textoPreviewDOM) {
        
        let resumoQuadras = "";
        for (let i = 1; i <= Math.min(qtd, 5); i++) {
            resumoQuadras += `• Quadra ${i}<br>`;
        }
        
        if (qtd > 5) {
            resumoQuadras += `• ... e mais ${qtd - 5} quadras sequenciais.<br>`;
        }
        
        textoPreviewDOM.innerHTML = `
            <b style="color: #1e293b; display: block; margin-bottom: 8px;">📋 Resumo da Estrutura a ser Criada:</b>
            Você está prestes a inicializar a arena com <b>${qtd} ${qtd === 1 ? 'quadra' : 'quadras'}</b>.<br><br>
            
            <b style="color: #475569;">Nomes Iniciais Automáticos:</b><br>
            ${resumoQuadras}<br>
            
            <i style="color: #64748b; display: block; margin-top: 5px;">*Você poderá alterar o nome de cada uma delas de forma personalizada a qualquer momento dentro do Gerenciador.</i>
        `;
        
    }
    
    // Altera a visibilidade das etapas
    document.getElementById('onboarding-etapa-input').style.display = 'none';
    document.getElementById('onboarding-etapa-preview').style.display = 'block';
    
}


/**
 * Retorna à primeira etapa para o gestor corrigir o número de quadras
 */
function voltarEtapaInputOnboardingSaaS() {
    
    if (navigator.vibrate) {
        navigator.vibrate(20);
    }
    
    document.getElementById('onboarding-etapa-input').style.display = 'block';
    document.getElementById('onboarding-etapa-preview').style.display = 'none';
    
}


/**
 * Dispara a gravação estrutural em lote no Firebase e libera o chassi
 */
function confirmarECriarArenaSaaS() {
    
    const inputQtd = document.getElementById('input-onboarding-qtd');
    const qtd = inputQtd ? parseInt(inputQtd.value) : 1;
    
    showToast("Construindo infraestrutura da arena...", "info");
    
    // 1. Cria o mapa de nomes padrões sequenciais ("Quadra 1", "Quadra 2"...)
    const nomesIniciais = {};
    for (let i = 1; i <= qtd; i++) {
        nomesIniciais[i] = `Quadra ${i}`;
    }
    
    // 2. Monta o pacote estrutural base exigido pelo ecossistema do SetPoint
    const payloadOnboarding = {
        quantidade: qtd,
        nomes: nomesIniciais
    };
    
    // 3. Grava de forma soberana na rota mestre de configurações de quadra
    database.ref(`${raizBanco}/config/Quadras`).set(payloadOnboarding).then(() => {
        
        if (navigator.vibrate) {
            navigator.vibrate([100, 50, 100]);
        }
        
        showToast("Arena inicializada com sucesso absoluto!", "success");
        
        // Aguarda o toast finalizar e força o recarregamento total da planilha já configurada
        setTimeout(() => {
            location.reload();
        }, 1500);
        
    }).catch(err => {
        console.error("Erro no deploy do onboarding:", err);
        showToast("Erro técnico ao tentar inicializar a estrutura no servidor.", "error");
    });
    
}