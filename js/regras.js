"use strict";

/**
 * ========================================================
 * 1. ESTADO LOCAL: CARRINHO DE COMPRAS E DICIONÁRIO
 * ========================================================
 */
let carrinhoRegras = {};

const dicNomesRegras = {
    Abrir: "Status do Sistema",
    LimpezaMural: "Limpeza do Mural",
    DiasLimpezaLogs: "Limpeza de Logs",
    DiasParaLimpar: "Antecedência Máxima",
	DiasParaExibir: "Dias para Exibir",
    DuracaoPermitida: "Duração Permitida",
    OrganizadorEdicao: "Edição pelo Organizador",
    Quorum1h: "Quórum Mínimo (1 Hora)",
	Quorum2h: "Quórum Mínimo (2 Horas)",
    ReservasPorConfirmacao: "Confirmação Obrigatória",
    horasParaExpirar: "Prazo para Confirmação",
    FilaEspera: "Fila de Espera",
    PartidasAbertas: "Partidas Abertas",
    PrivacidadeLGPD: "Privacidade (LGPD)",
    LimiteReservas: "Limite de Reservas Ativas",
    RestricaoNobre: "Restrição de Horário Nobre",
    PrazoCancelamento: "Prazo de Cancelamento",
    ToleranciaAtraso: "Tolerância de Atraso"
};
// Adicione logo abaixo de dicNomesRegras:
const dicSubNomesAgendar = {
	Titular: "Agendamento: Sócios Titulares",
	Dependente: "Agendamento: Dependentes",
	Professor: "Agendamento: Professores",
	Staff: "Agendamento: Staff / Manutenção",
	Convidado: "Agendamento: Convidados"
}; 

/**
 * ========================================================
 * 2. CONTROLE VISUAL (A SANFONA)
 * ========================================================
 */
function toggleGavetaRegras(elemento) {
    const evento = window.event;
    if (evento && evento.target.closest('.accordion-content')) return; 

    if (navigator.vibrate) navigator.vibrate(20); 
    
    const isActive = elemento.classList.contains('active');
    
    document.querySelectorAll('.accordion-item').forEach(item => {
        item.classList.remove('active');
        item.classList.remove('mobile-opened');
        const content = item.querySelector('.accordion-content');
        if (content) content.style.maxHeight = null;
    });

    if (!isActive) {
        elemento.classList.add('active');
        elemento.classList.add('mobile-opened');
		
		// 🎯 AJUSTE DE UX: Reseta as sub-gavetas internas (Gaveta 3 e Gaveta 5)
        const subAgendar = elemento.querySelector('.card-agendar-box');
        if (subAgendar) subAgendar.classList.remove('aberto');

        const subPermissoes = elemento.querySelector('#acordeao-permissao');
        if (subPermissoes) subPermissoes.classList.remove('aberto');
		
        const content = elemento.querySelector('.accordion-content');
        if (content) {
            content.style.maxHeight = content.scrollHeight + "px";
        }
    }
}

/**
 * ========================================================
 * 3. CARRINHO E RENDERIZAÇÃO
 * ========================================================
 */
function capturarCarrinhoRegrasDOM() {
    return {
        Abrir: document.getElementById('regra-sistema-onoff').checked,
        LimpezaMural: parseInt(document.getElementById('regra-limpeza-mural').value),
        DiasLimpezaLogs: parseInt(document.getElementById('regra-limpeza-logs').value),
        DiasParaLimpar: parseInt(document.getElementById('regra-antecedencia').value),
        DiasParaExibir: parseInt(document.getElementById('regra-exibicao').value), // 🌟 Linha Injetada
        DuracaoPermitida: document.getElementById('regra-duracao').value,
        OrganizadorEdicao: document.getElementById('regra-edicao-organizador').checked,
        Quorum1h: parseInt(document.getElementById('regra-quorum-1h').value),
		Quorum2h: parseInt(document.getElementById('regra-quorum-2h').value),
        ReservasPorConfirmacao: document.getElementById('regra-confirmacao-obrig').checked,
        horasParaExpirar: parseInt(document.getElementById('regra-tempo-expirar').value),
        FilaEspera: document.getElementById('regra-fila-espera').checked,
        PartidasAbertas: document.getElementById('regra-partidas-abertas').checked,
        PrivacidadeLGPD: document.getElementById('regra-privacidade-lgpd').checked,
        LimiteReservas: parseInt(document.getElementById('regra-limite-reservas').value),
        RestricaoNobre: document.getElementById('regra-horario-nobre').checked,
		
		// 🎯 OBJETO AGRUPADO
		PermiteAgendar: {
			Titular: document.getElementById('regra-agendar-titular').checked,
			Dependente: document.getElementById('regra-agendar-dependente').checked,
			Professor: document.getElementById('regra-agendar-professor').checked,
			Staff: document.getElementById('regra-agendar-staff').checked,
			Convidado: document.getElementById('regra-agendar-convidado').checked
		},
		
        PrazoCancelamento: parseInt(document.getElementById('regra-prazo-cancelamento').value),
        ToleranciaAtraso: parseInt(document.getElementById('regra-tolerancia-atraso').value)
    };
}

function renderizarInputsModalRegras() {
    const data = configRegrasGlobal || {};

    document.getElementById('regra-sistema-onoff').checked = data.Abrir !== false;
    document.getElementById('regra-limpeza-mural').value = data.LimpezaMural !== undefined ? data.LimpezaMural : 7;
    document.getElementById('regra-limpeza-logs').value = data.DiasLimpezaLogs !== undefined ? data.DiasLimpezaLogs : 15;
    
    const valAntecedencia = data.DiasParaLimpar !== undefined ? data.DiasParaLimpar : 3;
    const valExibicao = data.DiasParaExibir !== undefined ? data.DiasParaExibir : 1;

    document.getElementById('regra-antecedencia').value = valAntecedencia;
    
    // 🧠 GATILHO REATIVO: Popula as opções baseado na regra matemática anticonflito
    atualizarOpcoesDiasParaExibirSaaS(valAntecedencia, valExibicao);

    // Amarra o detector de mudança física no select de Antecedência
    const elAntecedencia = document.getElementById('regra-antecedencia');
    if (elAntecedencia) {
        elAntecedencia.onchange = () => {
            atualizarOpcoesDiasParaExibirSaaS(elAntecedencia.value, document.getElementById('regra-exibicao').value);
        };
    }

    document.getElementById('regra-duracao').value = data.DuracaoPermitida || "1_2";
    document.getElementById('regra-edicao-organizador').checked = data.OrganizadorEdicao !== false;
	
    document.getElementById('regra-quorum-1h').value = data.Quorum1h !== undefined ? data.Quorum1h : 1;
	document.getElementById('regra-quorum-2h').value = data.Quorum2h !== undefined ? data.Quorum2h : 2;  
	
    // 🎯 REGRAS DE CONFIRMAÇÃO E PRAZOS
    const switchConfirmacao = document.getElementById('regra-confirmacao-obrig');
    switchConfirmacao.checked = data.ReservasPorConfirmacao !== false;
    document.getElementById('regra-tempo-expirar').value = data.horasParaExpirar !== undefined ? data.horasParaExpirar : 2;
    
    // Sincroniza visualmente o campo de prazo no carregamento da tela
    if (typeof togglePrazoConfirmacaoSaaS === 'function') togglePrazoConfirmacaoSaaS();
    
    // Amarra o gatilho para o momento em que o gestor clicar na chave
    switchConfirmacao.onchange = togglePrazoConfirmacaoSaaS;
    
	document.getElementById('regra-fila-espera').checked = data.FilaEspera !== false;
    document.getElementById('regra-partidas-abertas').checked = data.PartidasAbertas !== false;
    document.getElementById('regra-privacidade-lgpd').checked = data.PrivacidadeLGPD === true;
    
    document.getElementById('regra-limite-reservas').value = data.LimiteReservas !== undefined ? data.LimiteReservas : 3;
    document.getElementById('regra-horario-nobre').checked = data.RestricaoNobre !== false;
	
	// 🎯 Sincroniza o objeto PermiteAgendar com os dados do Firebase (com retrocompatibilidade)
	const agendarObj = data.PermiteAgendar || {};

	document.getElementById('regra-agendar-titular').checked = agendarObj.Titular !== undefined ? agendarObj.Titular : (data.PermiteAgendarTitular !== false);
	document.getElementById('regra-agendar-dependente').checked = agendarObj.Dependente !== undefined ? agendarObj.Dependente : (data.PermiteAgendarDependente === true);
	document.getElementById('regra-agendar-professor').checked = agendarObj.Professor !== undefined ? agendarObj.Professor : (data.PermiteAgendarProfessor !== false);
	document.getElementById('regra-agendar-staff').checked = agendarObj.Staff !== undefined ? agendarObj.Staff : (data.PermiteAgendarStaff === true);
	document.getElementById('regra-agendar-convidado').checked = agendarObj.Convidado !== undefined ? agendarObj.Convidado : (data.PermiteAgendarConvidado === true);

	// Recalcula o badge "X liberados"
	atualizarBadgeQuemPodeAgendar();
    
    document.getElementById('regra-prazo-cancelamento').value = data.PrazoCancelamento !== undefined ? data.PrazoCancelamento : 12;
    document.getElementById('regra-tolerancia-atraso').value = data.ToleranciaAtraso !== undefined ? data.ToleranciaAtraso : 15;
	
	// 🔥 LINHA NOVA INJETADA AQUI: Sincroniza o dropdown de perfis ao abrir a tela
    if (typeof sincronizarSelectPerfisGaveta3 === 'function') {
        // Mantém selecionado o que já estava na tela, ou foca no Admin por padrão
        const perfilAtual = document.getElementById('regra-perfil-select').value || "Admin";
        sincronizarSelectPerfisGaveta3(perfilAtual);
    }

    carrinhoRegras = capturarCarrinhoRegrasDOM();
}


/**
 * Tranca Anticonflito (Fase 2.4): Calcula matematicamente o espaço restante 
 * no carrossel de 7 dias e reconstrói as opções seguras de forma minimalista. 
 */
function atualizarOpcoesDiasParaExibirSaaS(valorAntecedencia, valorExibicaoAtual) {
    const selectExibicao = document.getElementById('regra-exibicao');
    if (!selectExibicao) return;

    // A matemática provada: o limite do passado é o próprio valor da antecedência!
    const limiteMaximoPassado = parseInt(valorAntecedencia) || 3; 
    selectExibicao.innerHTML = '';

    for (let i = 0; i <= limiteMaximoPassado; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        
        // ✂️ Rótulos curtos e precisos para não estourar o layout visual
        opt.text = i === 0 ? "Nenhum dia" : (i === 1 ? "1 dia atrás" : `${i} dias atrás`);
        
        selectExibicao.add(opt);
    }

    // Se o valor vindo do banco for menor ou igual ao limite seguro, mantém ele.
    if (valorExibicaoAtual !== undefined && valorExibicaoAtual <= limiteMaximoPassado) {
        selectExibicao.value = valorExibicaoAtual;
    } else {
        // Se estourar, força o teto seguro de colunas restantes.
        selectExibicao.value = limiteMaximoPassado; 
    }
}


/**
 * ========================================================
 * 4. INTELIGÊNCIA ANTI-DESCARTE (COM EXTRATO DETALHADO)
 * ========================================================
 */
function fecharModalRegrasSaaS() {
    const estadoAtual = capturarCarrinhoRegrasDOM();
    let mudancasDescartadas = [];
    
    const mapaIdsDOM = {
        LimpezaMural: 'regra-limpeza-mural', 
        DiasLimpezaLogs: 'regra-limpeza-logs',
        DiasParaLimpar: 'regra-antecedencia', 
        DiasParaExibir: 'regra-exibicao', // 🌟 Linha Injetada para o Tradutor do Descarte
        DuracaoPermitida: 'regra-duracao', 
		Quorum1h: 'regra-quorum-1h',
        Quorum2h: 'regra-quorum-2h',
        horasParaExpirar: 'regra-tempo-expirar',
        LimiteReservas: 'regra-limite-reservas', 
        PrazoCancelamento: 'regra-prazo-cancelamento', 
        ToleranciaAtraso: 'regra-tolerancia-atraso'
    };

    Object.keys(estadoAtual).forEach(key => {
        const valorNovo = estadoAtual[key];
        const valorVelho = carrinhoRegras[key];

        // 🎯 TRATAMENTO ESPECIAL PARA O OBJETO PermiteAgendar
        if (key === 'PermiteAgendar') {
            const subNovos = valorNovo || {};
            const subVelhos = valorVelho || {};
            
            Object.keys(dicSubNomesAgendar).forEach(subKey => {
                if (subNovos[subKey] !== subVelhos[subKey]) {
                    const nomeCampo = dicSubNomesAgendar[subKey];
                    const txtVelho = subVelhos[subKey] ? "Ativado" : "Desativado";
                    const txtNovo = subNovos[subKey] ? "Ativado" : "Desativado";
                    
                    mudancasDescartadas.push(`• <b>${nomeCampo}:</b> de <i>${txtVelho}</i> para <b style="color:#dc3545;">${txtNovo}</b>`);
                }
            });
        } 
        // DEMAIS REGRAS PADRÃO (Valores simples)
        else if (valorNovo !== valorVelho) {
            const nomeCampo = dicNomesRegras[key] || key;
            const txtVelho = obterNomeLegivelCampo(key, valorVelho, mapaIdsDOM);
            const txtNovo = obterNomeLegivelCampo(key, valorNovo, mapaIdsDOM);
            
            mudancasDescartadas.push(`• <b>${nomeCampo}:</b> de <i>${txtVelho}</i> para <b style="color:#dc3545;">${txtNovo}</b>`);
        }
    });

    if (mudancasDescartadas.length > 0) {
        if (navigator.vibrate) navigator.vibrate(30);
        
        const msgDetalhada = `
            Você modificou as seguintes regras que ainda não foram salvas:<br><br>
            <div style="text-align:left; font-size:13px; line-height:1.5; color:#475569; background:#f8fafc; padding:12px; border-radius:8px; border:1px solid #e2e8f0; margin-bottom:15px; max-height:130px; overflow-y:auto;">
                ${mudancasDescartadas.join('<br>')}
            </div>
            Deseja realmente sair e <b style="color:#dc3545;">descartar</b> tudo?
        `;

        showPrompt(
            "Descartar Alterações?",
            msgDetalhada,
            () => {
                renderizarInputsModalRegras();
                fecharModalConfig('modal-regras');
            }
        );
    } else {
        fecharModalConfig('modal-regras'); 
    }
}

/**
 * ========================================================
 * 5. TRADUTOR DO EXTRATO VISUAL
 * ========================================================
 */
function obterNomeLegivelCampo(key, valor, mapaIds) {
    if (typeof valor === 'boolean') return valor ? "Ativado" : "Desativado";
    const idDOM = mapaIds[key];
    if (idDOM) {
        const el = document.getElementById(idDOM);
        if (el && el.options) {
            for (let i = 0; i < el.options.length; i++) {
                if (el.options[i].value === String(valor)) return el.options[i].text;
            }
        }
    }
    return valor;
}

/**
 * ========================================================
 * 6. CHECKOUT: SALVAR NO FIREBASE COM EXTRATO PREMIUM
 * ========================================================
 */
function salvarRegrasDeReserva() {
    if (navigator.vibrate) navigator.vibrate(40);

    const novoCarrinho = capturarCarrinhoRegrasDOM();
    let mudancas = [];
    let payloadFirebase = {};

    const mapaIdsDOM = {
        LimpezaMural: 'regra-limpeza-mural', DiasLimpezaLogs: 'regra-limpeza-logs',
        DiasParaLimpar: 'regra-antecedencia', DuracaoPermitida: 'regra-duracao',
        horasParaExpirar: 'regra-tempo-expirar', LimiteReservas: 'regra-limite-reservas',
        PrazoCancelamento: 'regra-prazo-cancelamento', ToleranciaAtraso: 'regra-tolerancia-atraso'
    };

    Object.keys(novoCarrinho).forEach(key => {
        const valorNovo = novoCarrinho[key];
        const valorVelho = carrinhoRegras[key];

        // 🎯 TRATAMENTO ESPECIAL PARA O OBJETO PermiteAgendar
        if (key === 'PermiteAgendar') {
            const subNovos = valorNovo || {};
            const subVelhos = valorVelho || {};
            let alterouObjeto = false;

            Object.keys(dicSubNomesAgendar).forEach(subKey => {
                if (subNovos[subKey] !== subVelhos[subKey]) {
                    alterouObjeto = true;
                    const nomeCampo = dicSubNomesAgendar[subKey];
                    const txtVelho = subVelhos[subKey] ? "Ativado" : "Desativado";
                    const txtNovo = subNovos[subKey] ? "Ativado" : "Desativado";

                    mudancas.push(`
                        <div style="margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px dashed rgba(148, 163, 184, 0.3); color: var(--txt-padrao, #475569); font-size: 13px; line-height: 1.6;">
                            • <b style="color: var(--txt-titulo, #1e293b);">${nomeCampo}:</b><br>
                            de <i style="opacity: 0.8;">${txtVelho}</i> para <span style="color: #10b981; font-weight: bold;">${txtNovo}</span>
                        </div>
                    `);
                }
            });

            // Se houve alteração em qualquer sub-chave, envia o objeto atualizado
            if (alterouObjeto) {
                payloadFirebase['PermiteAgendar'] = valorNovo;
            }
        } 
        // DEMAIS REGRAS PADRÃO (Valores simples)
        else if (valorNovo !== valorVelho) {
            const nomeCampo = dicNomesRegras[key] || key;
            const txtVelho = obterNomeLegivelCampo(key, valorVelho, mapaIdsDOM);
            const txtNovo = obterNomeLegivelCampo(key, valorNovo, mapaIdsDOM);
            
            mudancas.push(`
                <div style="margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px dashed rgba(148, 163, 184, 0.3); color: var(--txt-padrao, #475569); font-size: 13px; line-height: 1.6;">
                    • <b style="color: var(--txt-titulo, #1e293b);">${nomeCampo}:</b><br>
                    de <i style="opacity: 0.8;">${txtVelho}</i> para <span style="color: #10b981; font-weight: bold;">${txtNovo}</span>
                </div>
            `);
            
            payloadFirebase[key] = valorNovo;
        }
    });

    if (mudancas.length === 0) {
        return showToast("Nenhuma regra foi alterada.", "info");
    }

    const btnSalvar = document.querySelector('.btn-regras-salvar');
    if (btnSalvar) {
        btnSalvar.textContent = "Salvando...";
        btnSalvar.disabled = true;
    }

    database.ref(`${raizBanco}/config`).update(payloadFirebase)
        .then(() => {
            carrinhoRegras = JSON.parse(JSON.stringify(novoCarrinho)); 
            
            let msgExtrato = `
                <div style="background: var(--bg-painel, #ffffff); border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.15); border-left: 6px solid #10b981; padding: 20px; width: 100%; text-align: left; position: relative;">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px;">
                        <i class="material-icons" style="color: #10b981; font-size: 24px;">check_circle</i>
                        <h4 style="margin: 0; color: var(--txt-titulo, #1e293b); font-size: 16px; font-weight: 800;">Regras Atualizadas</h4>
                    </div>
                    <div style="max-height: 220px; overflow-y: auto; padding-right: 5px;">
                        ${mudancas.join('')}
                    </div>
                    <div style="font-size: 11px; color: #94a3b8; text-align: right; margin-top: 10px; font-weight: 500;">
                        👆 Toque para fechar
                    </div>
                </div>
            `;
            
            const tempoCalculado = 3000 + (mudancas.length * 1500);
            showToast(msgExtrato, "premium", tempoCalculado);
        })
        .catch(error => {
            console.error("Erro ao salvar regras:", error);
            showToast("Falha de comunicação com o banco.", "error");
        })
        .finally(() => {
            if (btnSalvar) {
                btnSalvar.textContent = "Salvar Regras";
                btnSalvar.disabled = false;
            }
        });
}

/**
 * ========================================================
 * 7. VALIDAÇÃO DE PORTARIA (SISTEMA OFF)
 * ========================================================
 */
function verificarPortariaSistema() {
    const config = configRegrasGlobal || {};
    const sistemaAberto = config.Abrir !== false; 

    if (!sistemaAberto) {
        if (isGestorLogado) return; 
        const nomeAtletaLogado = localStorage.getItem('jogadorLogadoNome') || "";
        const idAtleta = Object.keys(jogadoresGlobal).find(key => jogadoresGlobal[key].nomeCompleto === nomeAtletaLogado);
        const dadosAtleta = idAtleta ? jogadoresGlobal[idAtleta] : {};
        const ehAdmin = dadosAtleta.perfis && dadosAtleta.perfis['Admin'] === true;

        if (!ehAdmin && typeof navegarApp === "function") navegarApp('tela-manutencao'); 
    } else {
        const telaManutencao = document.getElementById('tela-manutencao');
        if (telaManutencao && telaManutencao.classList.contains('ativa')) {
            const nomeAtletaLogado = localStorage.getItem('jogadorLogadoNome');
            if (nomeAtletaLogado) {
                if (typeof abrirVisaoQuadras === "function") abrirVisaoQuadras();
                else navegarApp('tela-visao-quadras'); 
            } else {
                if (typeof navegarApp === "function") navegarApp('tela-boas-vindas'); 
            }
        }
    }
}

/**
 * ========================================================
 * 8. RESET INTELIGENTE E ANTI-FANTASMA
 * ========================================================
 */
function resetarModalRegras(idModal = 'modal-regras') {
    const modalTarget = document.getElementById(idModal);
    if (!modalTarget) return;

    const isMobile = window.innerWidth <= 768; 
    const gavetas = modalTarget.querySelectorAll('.accordion-item');
    if (gavetas.length === 0) return;  
	
    // 🎯 Reseta todas as sub-gavetas expandidas (Quem pode agendar + Permissões)
    modalTarget.querySelectorAll('.card-agendar-box, #acordeao-permissao').forEach(box => {
        box.classList.remove('aberto');
    });

    const conteudos = modalTarget.querySelectorAll('.accordion-content');
    conteudos.forEach(content => content.style.transition = 'none');

    gavetas.forEach(item => {
        item.classList.remove('active');
        item.classList.remove('mobile-opened'); 
        const content = item.querySelector('.accordion-content');
        if (content) content.style.maxHeight = null; 
    });

    if (!isMobile) {
        const primeiraGaveta = gavetas[0];
        primeiraGaveta.classList.add('active');
        const content = primeiraGaveta.querySelector('.accordion-content');
        if (content) content.style.maxHeight = content.scrollHeight + "px";
    } 

    setTimeout(() => {
        conteudos.forEach(content => content.style.transition = ''); 
    }, 50);
}


/**
 * ========================================================
 * 9. MÓDULO DE PERFIS & PERMISSÕES (CRIAR E EDITAR)
 * ========================================================
 */

let perfilSaaSEdicao = ""; // Armazena a Tag do perfil que está sendo editado

// A. Funções de Abertura dos Modais
function abrirModalNovoPerfilSaaS() {
    if (navigator.vibrate) navigator.vibrate(30);
    
    // Reseta o formulário
    document.getElementById('inp-novo-perfil-nome').value = "";
    document.getElementById('inp-novo-perfil-tag').value = "";
    
    // Reseta a paleta selecionando o Azul padrão
    const gridCores = document.getElementById('grid-cores-novo-perfil');
    if (gridCores) {
        const bolinhas = gridCores.querySelectorAll('.dot-cor');
        bolinhas.forEach(dot => dot.classList.remove('ativa'));
        
        // Pega a bolinha azul (a 7ª da lista) e ativa
        const bolinhaAzul = bolinhas[6];
        if (bolinhaAzul) {
            bolinhaAzul.classList.add('ativa');
            document.getElementById('inp-novo-perfil-cor').value = "#007bff";
        }
    }
    
    // Abre a janela através do motor do Core.js
    abrirModalConfig('modal-novo-perfil');
}


function abrirModalEditarPermissoesSaaS() {
    if (navigator.vibrate) navigator.vibrate(30);
    
    const selectP = document.getElementById('regra-perfil-select');
    if (!selectP || !selectP.value) {
        return showToast("Selecione um perfil primeiro.", "warning");
    }
    
    perfilSaaSEdicao = selectP.value;
    document.getElementById('txt-nome-perfil-edicao').textContent = `Permissões: ${perfilSaaSEdicao}`;
    
    // 🛡️ BLINDAGEM DO ADMIN: Regra Ouro do Documento Mestre
    const ehAdmin = (perfilSaaSEdicao === "Admin");
    const btnExcluir = document.getElementById('btn-excluir-perfil-saas');
    
    if (ehAdmin) {
        btnExcluir.style.display = 'none'; // Protege o perfil de exclusão
    } else {
        btnExcluir.style.display = 'block';
    }
    
    // 1. Carrega as permissões gravadas no banco para o perfil selecionado
    let poderes = {};
    if (configRegrasGlobal && configRegrasGlobal.Perfis && configRegrasGlobal.Perfis[perfilSaaSEdicao]) {
        poderes = configRegrasGlobal.Perfis[perfilSaaSEdicao].permissoes || {};
    }
    
    // 2. Sincroniza a Chave Mestra
    const chaveMaster = document.getElementById('chk-perm-master');
    const isMaster = poderes.super_admin === true;
    chaveMaster.checked = isMaster;
    
    // 3. Sincroniza os Filhos Individuais com os dados reais do banco
    document.getElementById('chk-perm-jogadores').checked = poderes.gestao_jogadores === true;
    document.getElementById('chk-perm-reservas').checked  = poderes.gerir_reservas === true;
    document.getElementById('chk-perm-aulas').checked     = poderes.gestor_aulas === true;
    document.getElementById('chk-perm-torneios').checked  = poderes.gestor_torneios === true;
    document.getElementById('chk-perm-quadras').checked   = poderes.controle_quadras === true;
    
    // 4. Trava/Destrava visualmente os botões sem apagar as seleções carregadas
    const chavesFilhas = document.querySelectorAll('.chk-perm-filho');
    chavesFilhas.forEach(filho => {
        filho.disabled = isMaster || ehAdmin; // Trava se for Admin/Master
    });
    
    abrirModalConfig('modal-editar-permissoes');
}


// B. Função da Paleta de Cores UI
function selecionarCorPerfilUI(elementoClicado, corHex) {
    if (navigator.vibrate) navigator.vibrate(15);
    
    const bolinhas = document.querySelectorAll('#grid-cores-novo-perfil .dot-cor');
    bolinhas.forEach(dot => dot.classList.remove('ativa'));
    
    elementoClicado.classList.add('ativa');
    document.getElementById('inp-novo-perfil-cor').value = corHex;
}

// C. Interatividade Inteligente das Chaves (Switches)
function gerenciarSwitchesPermissoesSaaS(gatilho) {
    const chaveMaster = document.getElementById('chk-perm-master');
    const chavesFilhas = document.querySelectorAll('.chk-perm-filho');
    
    if (navigator.vibrate) navigator.vibrate(20);

    // 🛡️ TRAVA RIGOROSA DO ADMIN
    if (perfilSaaSEdicao === "Admin") {
        chaveMaster.checked = true; // O Admin é intocável
        chavesFilhas.forEach(filho => {
            filho.checked = false; // Visualmente os outros somem para evidenciar o Master
            filho.disabled = true; // Impede cliques
        });
        
        if (gatilho === 'MASTER') {
            showToast("O Acesso Operacional do Admin não pode ser desligado.", "warning");
        }
        return; // Foge da função imediatamente
    }

    // Comportamento normal para os outros cargos
    if (gatilho === 'MASTER') {
        const estadoMaster = chaveMaster.checked;
        chavesFilhas.forEach(filho => {
            filho.checked = estadoMaster;
            filho.disabled = estadoMaster; // Trava os filhos se a mestre ligar
        });
    } else if (gatilho === 'CHILD') {
        // Se mexeu num filho manual, garante que a mestre apague e destrave os filhos
        chaveMaster.checked = false;
        chavesFilhas.forEach(f => f.disabled = false);
    }
}

// Avança da tela de Identidade (Passo 1) para a tela de Permissões (Passo 2)
function avancarModalNovoPerfilSaaS() {
    if (navigator.vibrate) navigator.vibrate(30);

    const nome = document.getElementById('inp-novo-perfil-nome').value.trim();
    const tag = document.getElementById('inp-novo-perfil-tag').value.trim();
    const cor = document.getElementById('inp-novo-perfil-cor').value;

    // Trava de segurança: não deixa avançar com os campos vazios
    if (!nome || !tag) {
        return showToast("Preencha o nome e a abreviação do Perfil.", "warning");
    }

    // Guarda os dados preenchidos temporariamente na memória RAM para o próximo passo
    window.novoPerfilTempSaaS = {
        nome: nome,
        abreviacao: tag,
        cor: cor
    };

    // Avisa o sistema que estamos CRIANDO um perfil novo, e não editando um antigo
    perfilSaaSEdicao = "NOVO_PERFIL";

    // Prepara o título do Modal 2 com o nome que acabou de ser digitado
    document.getElementById('txt-nome-perfil-edicao').textContent = `Permissões: ${nome}`;
    
    // Zera todas as chaves do Modal 2 para o novo cargo começar "sem poderes"
    const chaveMaster = document.getElementById('chk-perm-master');
    if(chaveMaster) chaveMaster.checked = false;
    
    document.querySelectorAll('.chk-perm-filho').forEach(chk => {
        chk.checked = false;
        chk.disabled = false;
    });

    // Oculta a lixeira (pois o cargo ainda nem foi salvo no banco)
    const btnExcluir = document.getElementById('btn-excluir-perfil-saas');
    if (btnExcluir) btnExcluir.style.display = 'none';

    // 🔄 TROCA DE CARTAS INSTANTÂNEA USANDO O CORE.JS
    // Sendo disparados juntos, o DOM renderiza no mesmo frame (sem piscar a máscara preta)
    fecharModalConfig('modal-novo-perfil');
    abrirModalConfig('modal-editar-permissoes');
}


// D. Salva o Novo Perfil ou Permissões Editadas diretamente no Firebase
async function salvarPermissoesSaaS() {
    if (navigator.vibrate) navigator.vibrate(40);

    // 1. Identifica se é um perfil novo ou edição de existente
    let nomePerfil = perfilSaaSEdicao;
    let abrev = perfilSaaSEdicao.substring(0, 5);
    let cor = "#007bff";

    if (perfilSaaSEdicao === "NOVO_PERFIL" && window.novoPerfilTempSaaS) {
        nomePerfil = window.novoPerfilTempSaaS.nome;
        abrev = window.novoPerfilTempSaaS.abreviacao;
        cor = window.novoPerfilTempSaaS.cor;
    } else if (configRegrasGlobal && configRegrasGlobal.Perfis && configRegrasGlobal.Perfis[nomePerfil]) {
        // Preserva metadados visuais se for apenas edição de permissões de um cargo existente
        abrev = configRegrasGlobal.Perfis[nomePerfil].abreviacao || abrev;
        cor = configRegrasGlobal.Perfis[nomePerfil].cor || cor;
    }

    // 2. Coleta o estado exato das chaves estilo iOS
    const isMaster = document.getElementById('chk-perm-master').checked;
    
    const objetoPermissoes = {
        super_admin: isMaster,
        gestao_jogadores: isMaster ? false : document.getElementById('chk-perm-jogadores').checked,
        gerir_reservas: isMaster ? false : document.getElementById('chk-perm-reservas').checked,
        gestor_aulas: isMaster ? false : document.getElementById('chk-perm-aulas').checked,
        gestor_torneios: isMaster ? false : document.getElementById('chk-perm-torneios').checked,
        controle_quadras: isMaster ? false : document.getElementById('chk-perm-quadras').checked
    };

    // 3. Monta o Payload oficial para a rota do banco
    const payloadPerfil = {
        abreviacao: abrev,
        cor: cor,
        descricao: "Criado via Configurações",
        permissoes: objetoPermissoes
    };

    try {
        // Gravando direto na rota oficial multi-tenant: Clubes/${codigo}/sistemas/config/Perfis/NomeDoPerfil
        await database.ref(`${raizBanco}/config/Perfis/${nomePerfil}`).set(payloadPerfil);

        showToast(`Cargo [${nomePerfil}] atualizado com sucesso!`, "success");

        // Atualiza a lista do Selectbox na Gaveta 3
        sincronizarSelectPerfisGaveta3(nomePerfil);
		
		// 🔔 INJEÇÃO AQUI: Garante que o acordeão reflita as novas pílulas imediatamente na tela
        if (typeof atualizarAcordeaoPermissoesSaaS === 'function') {
            atualizarAcordeaoPermissoesSaaS();
        }
		
        // Limpa a memória temporária
        window.novoPerfilTempSaaS = null;

        // Fecha a janela modal
        fecharModalConfig('modal-editar-permissoes');

    } catch (error) {
        console.error("Erro ao salvar perfil no banco:", error);
        showToast("Erro ao gravar permissões no Firebase.", "error");
    }
}

// E. Atualiza o dropdown da Gaveta 3 com os perfis cadastrados no banco
function sincronizarSelectPerfisGaveta3(perfilSelecionar = "") {
    const selectP = document.getElementById('regra-perfil-select');
    if (!selectP) return;

    selectP.innerHTML = "";

    const perfis = (configRegrasGlobal && configRegrasGlobal.Perfis) ? configRegrasGlobal.Perfis : {
        "Admin": { abreviacao: "Admin", cor: "#dc3545" }
    };

    Object.keys(perfis).forEach(pKey => {
        const opt = document.createElement('option');
        opt.value = pKey;
        opt.textContent = pKey;
        selectP.appendChild(opt);
    });

    if (perfilSelecionar && perfis[perfilSelecionar]) {
        selectP.value = perfilSelecionar;
    }
	
	// 🔔 INJEÇÃO AQUI: Atualiza as pílulas do Acordeão logo após repovoar o dropdown
    if (typeof atualizarAcordeaoPermissoesSaaS === 'function') {
        atualizarAcordeaoPermissoesSaaS();
    }
}


// ABRIR / FECHAR A GAVETA DESLIZANTE DE PERMISSÕES
function toggleGavetaAcordeao() {
    if (navigator.vibrate) navigator.vibrate(20);
    
    const container = document.getElementById('acordeao-permissao');
    if (!container) return;

    // 1. Alterna o estado do acordeão interno
    container.classList.toggle('aberto');

    // 2. Trava Infalível de Altura para Mobile (Ignora atraso de renderização)
    const itemPai = container.closest('.accordion-item'); 
    if (itemPai) {
        const contentPai = itemPai.querySelector('.accordion-content');
        if (contentPai) {
            if (container.classList.contains('aberto')) {
                // Se abriu, libera uma folga gigante de 1000px instantaneamente.
                // Isso elimina qualquer bug de corte, independente da velocidade do celular!
                contentPai.style.maxHeight = "1000px";
            } else {
                // Se fechou, recalcula o tamanho real para não deixar espaço morto no fundo.
                contentPai.style.maxHeight = contentPai.scrollHeight + "px";
            }
        }
    }
}



// ATUALIZAR CONTEÚDO DO ACORDEÃO BASEADO NO PERFIL SELECIONADO (SEM ÍCONES)
function atualizarAcordeaoPermissoesSaaS() {
    const selectPerfil = document.getElementById('regra-perfil-select');
    const resumoTxt = document.getElementById('txt-resumo-permissao');
    const gaveta = document.getElementById('gaveta-pilulas');

    if (!selectPerfil || !resumoTxt || !gaveta) return;

    const perfilSelecionado = selectPerfil.value; 
    gaveta.innerHTML = "";

    // Pega o nó de dados do Firebase
    let dadosPerfil = null;
    if (configRegrasGlobal && configRegrasGlobal.Perfis && configRegrasGlobal.Perfis[perfilSelecionado]) {
        dadosPerfil = configRegrasGlobal.Perfis[perfilSelecionado];
    }

    const permissoes = dadosPerfil ? (dadosPerfil.permissoes || {}) : {};

    // 1. Caso Master/Admin
    if (perfilSelecionado === "Admin" || permissoes.super_admin === true) {
        resumoTxt.innerHTML = `<span style="color:#854d0e; font-weight:600;">Acesso Total</span>`;
        gaveta.innerHTML = `<span class="tag-permissao tag-admin">Acesso Total</span>`;
        return;
    }

    // 2. Mapeamento de Permissões
    const mapaPermissoes = [
        { chave: 'gestao_jogadores', texto: 'Gestão de Jogadores' },
        { chave: 'gerir_reservas', texto: 'Gerir Reservas' },
        { chave: 'gestor_aulas', texto: 'Gestor de Aulas' },
        { chave: 'gestor_torneios', texto: 'Gestor de Torneios' },
        { chave: 'controle_quadras', texto: 'Controle de Quadras' }
    ];

    const ativas = mapaPermissoes.filter(p => permissoes[p.chave] === true);

    if (ativas.length === 0) {
        // 3. Nenhuma Permissão
        resumoTxt.innerHTML = `<span style="color:#64748b; font-weight:600;">Sem Permissões</span>`;
        gaveta.innerHTML = `<span class="tag-permissao tag-vazia">Sem permissões</span>`;
    } else {
        // 4. Permissões Personalizadas (Sem ícones)
        const qtd = ativas.length;
        const textoQtd = qtd === 1 ? '1 permissão' : `${qtd} permissões`;
        
        resumoTxt.innerHTML = `<span style="color:#0369a1; font-weight:600;">${textoQtd}</span>`;

        ativas.forEach(p => {
            gaveta.innerHTML += `
                <span class="tag-permissao tag-comum">
                    ${p.texto}
                </span>
            `;
        });
    }
}


// EXCLUIR PERFIL SAAS USANDO O ESQUELETO NATIVO DA ARENA (PROMPT-SAAS)
function excluirPerfilSaaS() {
    if (!perfilSaaSEdicao || perfilSaaSEdicao === "Admin") {
        return showToast("O perfil Admin é protegido e não pode ser excluído.", "warning");
    }

    const perfilParaExcluir = perfilSaaSEdicao;

    // 1. Identifica as permissões ativas do perfil
    let permissoesAtivas = [];
    if (configRegrasGlobal && configRegrasGlobal.Perfis && configRegrasGlobal.Perfis[perfilParaExcluir]) {
        const p = configRegrasGlobal.Perfis[perfilParaExcluir].permissoes || {};
        
        if (p.super_admin) {
            permissoesAtivas.push("Acesso Total");
        } else {
            if (p.gestao_jogadores) permissoesAtivas.push("Gestão de Jogadores");
            if (p.gerir_reservas) permissoesAtivas.push("Gerir Reservas");
            if (p.gestor_aulas) permissoesAtivas.push("Gestor de Aulas");
            if (p.gestor_torneios) permissoesAtivas.push("Gestor de Torneios");
            if (p.controle_quadras) permissoesAtivas.push("Controle de Quadras");
        }
    }

    // 2. Monta as <li> alinhadas à esquerda no padrão prompt-saas-item
    let listHtml = "";
    if (permissoesAtivas.length > 0) {
        permissoesAtivas.forEach(perm => {
            listHtml += `<li class="prompt-saas-item"><span class="prompt-saas-bullet">•</span> ${perm}</li>`;
        });
    } else {
        listHtml = `<li class="prompt-saas-item"><span class="prompt-saas-bullet">•</span> Nenhuma permissão atrelada</li>`;
    }

    // 3. Montagem usando a estrutura semântica padrão (Fieldset + Legend + List)
    const msgDetalhada = `
        <div class="prompt-saas-container">
            <fieldset class="prompt-saas-fieldset">
                <legend class="prompt-saas-legend">PERMISSÕES</legend>
                <ul class="prompt-saas-list">
                    ${listHtml}
                </ul>
            </fieldset>

            <p class="prompt-saas-warning">Você tem certeza que deseja excluir o perfil <b>${perfilParaExcluir}</b>?</p>
        </div>
    `;

    showPrompt(
        "Confirmação",
        msgDetalhada,
        async () => {
            try {
                if (navigator.vibrate) navigator.vibrate(40);

                // 1. Remove do Firebase
                await database.ref(`${raizBanco}/config/Perfis/${perfilParaExcluir}`).remove();

                // 2. Notifica o usuário
                showToast(`Perfil [${perfilParaExcluir}] excluído com sucesso!`, "success");

                // 3. Fecha o modal de edição
                fecharModalConfig('modal-editar-permissoes');

                // 4. Repovoa o select, volta para o Admin e atualiza o acordeão
                sincronizarSelectPerfisGaveta3("Admin");

            } catch (error) {
                console.error("Erro ao excluir perfil:", error);
                showToast("Erro ao excluir perfil do banco de dados.", "error");
            }
        }
    );
}


/**
 * ========================================================
 * 10. GAVETA: QUEM PODE AGENDAR (CONTROLE REATIVO)
 * ========================================================
 */
function toggleGavetaQuemPodeAgendar() {
    if (navigator.vibrate) navigator.vibrate(20);
    const cardBox = document.getElementById('box-quem-pode-agendar');
    if (cardBox) cardBox.classList.toggle('aberto');
}

function atualizarBadgeQuemPodeAgendar() {
    const chks = document.querySelectorAll('.chk-agendar-item');
    let marcados = 0;
    chks.forEach(c => { if (c.checked) marcados++; });

    const badge = document.getElementById('lbl-badge-contador-agendar');
    if (badge) {
        if (marcados === 0) {
            badge.textContent = "Nenhum";
            badge.style.background = "rgba(239, 68, 68, 0.12)";
            badge.style.color = "#ef4444";
        } else if (marcados === 1) {
            badge.textContent = "1 liberado";
            badge.style.background = "rgba(46, 139, 87, 0.15)";
            badge.style.color = "var(--cor-primaria, #2E8B57)";
        } else {
            badge.textContent = `${marcados} liberados`;
            badge.style.background = "rgba(46, 139, 87, 0.15)";
            badge.style.color = "var(--cor-primaria, #2E8B57)";
        }
    }
}

/**
 * ========================================================
 * 10.B. GAVETA: QUEM PODE ARBITRAR (CONTROLE REATIVO)
 * ========================================================
 */
function toggleGavetaQuemPodeArbitrar() {
    if (navigator.vibrate) navigator.vibrate(20);
    const cardBox = document.getElementById('box-quem-pode-arbitrar');
    if (cardBox) cardBox.classList.toggle('aberto');
}

function atualizarBadgeQuemPodeArbitrar() {
    const chks = document.querySelectorAll('.chk-arbitrar-item');
    let marcados = 1; // Árbitros é o padrão nativo e já começa valendo 1

    chks.forEach(c => {
        if (c.checked) marcados++;
    });

    const badge = document.getElementById('lbl-badge-contador-arbitrar');
    if (badge) {
        badge.textContent = marcados === 1 ? "1 liberado" : `${marcados} liberados`;
        badge.style.background = "rgba(46, 139, 87, 0.15)";
        badge.style.color = "var(--cor-primaria, #2E8B57)";
    }
}

/**
 * ========================================================
 * 11. GAVETA: DINÂMICA & CONFIRMAÇÕES (CONTROLE REATIVO)
 * ========================================================
 */
function togglePrazoConfirmacaoSaaS() {
    const switchConfirmacao = document.getElementById('regra-confirmacao-obrig');
    const selectPrazo = document.getElementById('regra-tempo-expirar');

    if (switchConfirmacao && selectPrazo) {
        if (switchConfirmacao.checked) {
            // Liga o dropdown
            selectPrazo.disabled = false;
            selectPrazo.style.opacity = '1';
            selectPrazo.style.cursor = 'pointer';
        } else {
            // Desliga e deixa opaco
            selectPrazo.disabled = true;
            selectPrazo.style.opacity = '0.5';
            selectPrazo.style.cursor = 'not-allowed';
        }
    }
}


// ========================================================
// 12. MÓDULO RANKING: PAINEL E CONFIGURAÇÕES DO GESTOR
// ========================================================

/**
 * Abertura e Preenchimento dos Parâmetros do Ranking
 */
function abrirModalConfigRanking() {
    if (navigator.vibrate) navigator.vibrate(30);
    console.log("⚡ [Ranking] Acessando painel de configurações do Gestor...");

    const conf = (configRegrasGlobal && configRegrasGlobal.ranking) ? configRegrasGlobal.ranking : {};
    const fin = conf.financeiro || {};
    const pir = conf.piramide || {};
    const bar = conf.barragem || {};
    const gru = conf.grupos || {};
    const sum = conf.sumula || {};

    // ABA 1: Parâmetros Gerais
    document.getElementById('regra-ranking-ativo').checked = conf.ativo !== false;
    document.getElementById('select-ranking-genero').value = conf.divisaoGenero || "separado";
	// 🏆 Nova Duração da Partida de Ranking (Padrão: 2 horas)
    document.getElementById('saas-ranking-duracao').value = String(conf.duracaoPartida !== undefined ? conf.duracaoPartida : 2);

    // ⚖️ Carrega as permissões de quem pode arbitrar
    const arbitrarObj = conf.permiteArbitrar || {};
    document.getElementById('regra-arbitrar-gestor').checked = arbitrarObj.Gestor === true;
    document.getElementById('regra-arbitrar-admin').checked = arbitrarObj.Admin === true;
    document.getElementById('regra-arbitrar-professor').checked = arbitrarObj.Professor === true;
    document.getElementById('regra-arbitrar-dev').checked = arbitrarObj.Dev === true;
    atualizarBadgeQuemPodeArbitrar();

    // ABA 2: Tipo de Torneio (Modelo Mestre)
    document.getElementById('select-ranking-modelo').value = conf.modeloAtivo || "piramide";

    // Subcampos Pirâmide
    document.getElementById('select-ranking-alcance-tipo').value = pir.alcanceTipo || "linha";
    document.getElementById('select-ranking-limite-posicoes').value = String(pir.limitePosicoes !== undefined ? pir.limitePosicoes : 3);
    document.getElementById('select-ranking-limite-mensal').value = String(pir.limiteMensal !== undefined ? pir.limiteMensal : 4);
    document.getElementById('select-ranking-aceite-minimo').value = String(pir.aceiteMinimo !== undefined ? pir.aceiteMinimo : 2);
    document.getElementById('select-ranking-mecanica-troca').value = pir.mecanicaTroca || "direta";
    document.getElementById('select-ranking-entrada-inscritos').value = pir.entradaInscritos || "fim";

    // Subcampos Barragem
    document.getElementById('select-ranking-barragem-vitoria').value = String(bar.pontosVitoria !== undefined ? bar.pontosVitoria : 3);
    document.getElementById('select-ranking-barragem-derrota').value = String(bar.pontosDerrota !== undefined ? bar.pontosDerrota : 1);
    document.getElementById('select-ranking-barragem-wo').value = String(bar.pontosWO !== undefined ? bar.pontosWO : 0);

    // Subcampos Grupos
    document.getElementById('select-ranking-grupos-tamanho').value = String(gru.tamanhoGrupo !== undefined ? gru.tamanhoGrupo : 4);
    document.getElementById('select-ranking-grupos-classificados').value = gru.classificadosGrupo || "2";
    document.getElementById('select-ranking-grupos-desempate').value = gru.criterioDesempate || "games_confronto_sorteio";
    document.getElementById('select-ranking-grupos-cabecas').value = gru.cabecasChave || "ranking";
    document.getElementById('select-ranking-grupos-desistência').value = gru.tratarDesistência || "anular";
    document.getElementById('select-ranking-grupos-prazo-rodada').value = String(gru.prazoRodada !== undefined ? gru.prazoRodada : 7);
    document.getElementById('select-ranking-grupos-estouro').value = gru.estouroPrazo || "sorteio";

    // ABA 3: Regras de Jogo & Súmula
    document.getElementById('select-ranking-formato-partida').value = sum.formatoPartida || "set_unico_6";
	// --> ADICIONE ESTAS DUAS LINHAS AQUI <--
    document.getElementById('select-ranking-decisao-3set').value = sum.decisaoTerceiroSet || "super_tiebreak";
    toggleDecisaoTerceiroSetSaaS(); // Força a exibição correta ao abrir a tela
    // ----------------------------------------
    document.getElementById('select-ranking-vantagem-games').value = sum.vantagemGames || "com_vantagem";
    
    document.getElementById('select-ranking-max-jogos').value = String(conf.maxJogosSemana !== undefined ? conf.maxJogosSemana : 2);
    document.getElementById('select-ranking-prazo-autoconf').value = String(sum.prazoAutoconf !== undefined ? sum.prazoAutoconf : 24);
	document.getElementById('select-ranking-tolerancia-wo').value = String(sum.toleranciaWO !== undefined ? sum.toleranciaWO : 15);
    document.getElementById('select-ranking-prazo-inatividade').value = String(conf.prazoInatividadeDias !== undefined ? conf.prazoInatividadeDias : 15);
	

    // ABA 4: Taxa de Inscrição & PIX
    const cobrarTaxa = fin.cobrarTaxa === true;
    document.getElementById('regra-ranking-cobrar-taxa').checked = cobrarTaxa;
    document.getElementById('txt-ranking-valor-taxa').value = fin.valorTaxa || "";
    document.getElementById('txt-ranking-chave-pix').value = fin.chavePix || "";
    document.getElementById('txt-ranking-recebedor-pix').value = fin.recebedorPix || "";

    toggleBlocoFinanceiroRankingSaaS(cobrarTaxa);
    toggleModeloTorneioRankingSaaS();

    // Reset de visualização da sanfona/sidebar
    if (typeof resetarModalRegras === 'function') {
        resetarModalRegras('modal-config-ranking');
    }

    abrirModalConfig('modal-config-ranking');
}

/**
 * Controla a exibição condicional dos blocos de modelo (Pirâmide, Barragem ou Grupos)
 */
function toggleModeloTorneioRankingSaaS() {
    const modelo = document.getElementById('select-ranking-modelo').value;
    const blocoPiramide = document.getElementById('bloco-regras-piramide');
    const blocoBarragem = document.getElementById('bloco-regras-barragem');
    const blocoGrupos = document.getElementById('bloco-regras-grupos');

    if (blocoPiramide) blocoPiramide.style.display = (modelo === 'piramide') ? 'block' : 'none';
    if (blocoBarragem) blocoBarragem.style.display = (modelo === 'barragem') ? 'block' : 'none';
    if (blocoGrupos) blocoGrupos.style.display = (modelo === 'grupos') ? 'block' : 'none';

    toggleSubAlcanceRankingSaaS();
}

/**
 * Controla a exibição do campo de Decisão do 3º Set
 */
function toggleDecisaoTerceiroSetSaaS() {
    const formato = document.getElementById('select-ranking-formato-partida').value;
    const row3Set = document.getElementById('row-decisao-terceiro-set');
    if (!row3Set) return;

    // Se for "Melhor de 3" (curto ou tradicional), exibe o campo
    if (formato === 'm3_curtos_4' || formato === 'm3_tradicional_6') {
        row3Set.style.display = 'flex';
    } else {
        row3Set.style.display = 'none';
    }
}

/**
 * Controla a exibição do subcampo numérico de limite de posições quando "Fixo por Posições" estiver ativo
 */
function toggleSubAlcanceRankingSaaS() {
    const alcanceTipo = document.getElementById('select-ranking-alcance-tipo').value;
    const rowNumPosicoes = document.getElementById('row-alcance-num-posicoes');
    if (!rowNumPosicoes) return;

    rowNumPosicoes.style.display = (alcanceTipo === 'fixo') ? 'flex' : 'none';
}

/**
 * Controla a visibilidade dos campos de PIX
 */
function toggleBlocoFinanceiroRankingSaaS(isAtivo) {
    const container = document.getElementById('container-financeiro-ranking');
    if (!container) return;
    container.style.display = isAtivo ? 'block' : 'none';
}

/**
 * Gravação Atômica das Regras do Ranking no Firebase
 */
function salvarConfigRankingSaas() {
    if (navigator.vibrate) navigator.vibrate(40); 
	
	const elTolWO = parseInt(document.getElementById('select-ranking-tolerancia-wo').value, 10);
	const elPrazoConf = parseInt(document.getElementById('select-ranking-prazo-autoconf').value, 10);

    const payloadRanking = {
        ativo: document.getElementById('regra-ranking-ativo').checked,
        divisaoGenero: document.getElementById('select-ranking-genero').value,
		duracaoPartida: parseInt(document.getElementById('saas-ranking-duracao').value) || 2,
        permiteArbitrar: {
            Arbitro: true,
            Gestor: document.getElementById('regra-arbitrar-gestor').checked,
            Admin: document.getElementById('regra-arbitrar-admin').checked,
            Professor: document.getElementById('regra-arbitrar-professor').checked,
            Dev: document.getElementById('regra-arbitrar-dev').checked
        },
        modeloAtivo: document.getElementById('select-ranking-modelo').value,
        maxJogosSemana: parseInt(document.getElementById('select-ranking-max-jogos').value) || 2,
        prazoInatividadeDias: parseInt(document.getElementById('select-ranking-prazo-inatividade').value) || 15,
        
        piramide: {
            alcanceTipo: document.getElementById('select-ranking-alcance-tipo').value,
            limitePosicoes: parseInt(document.getElementById('select-ranking-limite-posicoes').value) || 3,
            limiteMensal: parseInt(document.getElementById('select-ranking-limite-mensal').value) || 4,
            aceiteMinimo: parseInt(document.getElementById('select-ranking-aceite-minimo').value) || 2,
            mecanicaTroca: document.getElementById('select-ranking-mecanica-troca').value,
            entradaInscritos: document.getElementById('select-ranking-entrada-inscritos').value
        },
        barragem: {
            pontosVitoria: parseInt(document.getElementById('select-ranking-barragem-vitoria').value) || 3,
            pontosDerrota: parseInt(document.getElementById('select-ranking-barragem-derrota').value) || 1,
            pontosWO: parseInt(document.getElementById('select-ranking-barragem-wo').value) || 0
        },
        grupos: {
            tamanhoGrupo: parseInt(document.getElementById('select-ranking-grupos-tamanho').value) || 4,
            classificadosGrupo: document.getElementById('select-ranking-grupos-classificados').value,
            criterioDesempate: document.getElementById('select-ranking-grupos-desempate').value,
            cabecasChave: document.getElementById('select-ranking-grupos-cabecas').value,
            tratarDesistência: document.getElementById('select-ranking-grupos-desistência').value,
            prazoRodada: parseInt(document.getElementById('select-ranking-grupos-prazo-rodada').value) || 7,
            estouroPrazo: document.getElementById('select-ranking-grupos-estouro').value
        },
		sumula: {
			formatoPartida: document.getElementById('select-ranking-formato-partida').value,
			decisaoTerceiroSet: document.getElementById('select-ranking-decisao-3set').value,
			vantagemGames: document.getElementById('select-ranking-vantagem-games').value,
			prazoAutoconf: isNaN(elPrazoConf) ? 24 : elPrazoConf,
			toleranciaWO: isNaN(elTolWO) ? 15 : elTolWO
		},
        financeiro: {
            cobrarTaxa: document.getElementById('regra-ranking-cobrar-taxa').checked,
            valorTaxa: document.getElementById('txt-ranking-valor-taxa').value.trim(),
            chavePix: document.getElementById('txt-ranking-chave-pix').value.trim(),
            recebedorPix: document.getElementById('txt-ranking-recebedor-pix').value.trim()
        }
    };

    database.ref(`${raizBanco}/config/ranking`).set(payloadRanking)
        .then(() => {
            showToast("Parâmetros do Ranking salvos com sucesso!", "success");
            fecharModalConfig('modal-config-ranking');
        })
        .catch(err => {
            console.error("Erro ao salvar regras do ranking:", err);
            showToast("Erro ao gravar dados no Firebase.", "error");
        });
}

function abrirVisualizacaoRankingSaaS() {
    showToast("Abrindo gaveta do Leaderboard (Será conectada na Etapa 4).", "info");
}

function dispararConvitesTemporadaSaaS() {
    if (navigator.vibrate) navigator.vibrate(30);

    showToast("Verificando status da temporada...", "info");

    // 1. Checa se já existe um lote de convites ativo no banco
    database.ref(`${raizBanco}/convites_ranking`).once('value').then((snapConvites) => {
        const dadosConvite = snapConvites.exists() ? snapConvites.val() : null;

        if (dadosConvite && dadosConvite.status === "aberto") {
            // JÁ EXISTE TEMPORADA ABERTA: Exibe o Modal de Decisão Inteligente (Repescagem vs Reiniciar)
            exibirModalDecisaoRepescagemSaaS(dadosConvite);
        } else {
            // NENHUMA TEMPORADA ABERTA: Abre o modal de escolha inicial (Livre vs Herdada)
            exibirModalInicialDisparoTemporadaSaaS();
        }
    }).catch((err) => {
        console.error("Erro ao checar temporada:", err);
        exibirModalInicialDisparoTemporadaSaaS();
    });
}

// MODAL 1: Escolha Inicial (Quando NÃO há temporada aberta)
function exibirModalInicialDisparoTemporadaSaaS() {
    const msgHTML = `
        <div class="prompt-ranking-container">
            <p class="prompt-ranking-desc">Você está prestes a abrir as inscrições para uma nova temporada do Ranking. Como deseja organizar a fila inicial?</p>

            <div class="prompt-ranking-options">
                <label class="prompt-ranking-card">
                    <input type="radio" name="rd_ordem_ranking" value="livre" class="prompt-ranking-radio" checked>
                    <div>
                        <strong class="prompt-ranking-title">Inscrição Livre (Estaca Zero)</strong>
                        <span class="prompt-ranking-sub">Quem aceitar o convite primeiro no aplicativo, entra nas primeiras posições da tabela.</span>
                    </div>
                </label>

                <label class="prompt-ranking-card">
                    <input type="radio" name="rd_ordem_ranking" value="herdada" class="prompt-ranking-radio">
                    <div>
                        <strong class="prompt-ranking-title">Herdar Classificação Anterior</strong>
                        <span class="prompt-ranking-sub">Usa a posição final da última temporada como ordem de largada (Cabeças de Chave).</span>
                    </div>
                </label>
            </div>
        </div>
    `;

    showPrompt("Disparar Convites da Temporada", msgHTML, () => {
        const radios = document.getElementsByName('rd_ordem_ranking');
        let tipoOrdemEscolhida = 'livre';
        
        for (let r of radios) {
            if (r.checked) {
                tipoOrdemEscolhida = r.value;
                break;
            }
        }
        
        processarDisparoTemporadaFirebase(tipoOrdemEscolhida);
    });
}

// MODAL 2: Decisão Inteligente (Quando JÁ EXISTE temporada aberta)
function exibirModalDecisaoRepescagemSaaS(dadosConviteAtual) {
    const msgHTML = `
        <div class="prompt-ranking-container">
            <p class="prompt-ranking-desc">Já existem convites ativos para a temporada em andamento. O que você deseja fazer?</p>

            <div class="prompt-ranking-options">
                <!-- OPÇÃO A: Repescagem de Novos Atletas -->
                <label class="prompt-ranking-card">
                    <input type="radio" name="rd_acao_temporada" value="repescagem" class="prompt-ranking-radio" checked>
                    <div>
                        <strong class="prompt-ranking-title">Repescagem (Apenas Novos Atletas)</strong>
                        <span class="prompt-ranking-sub">Dispara convites SOMENTE para sócios recém-cadastrados que ainda não estão no ranking.</span>
                    </div>
                </label>

                <!-- OPÇÃO B: Reiniciar Geral -->
                <label class="prompt-ranking-card">
                    <input type="radio" name="rd_acao_temporada" value="reiniciar" class="prompt-ranking-radio">
                    <div>
                        <strong class="prompt-ranking-title">Reiniciar Geral (Nova Temporada)</strong>
                        <span class="prompt-ranking-sub">Cancela o lote atual e dispara convites do zero para TODOS os atletas habilitados.</span>
                    </div>
                </label>
            </div>
        </div>
    `;

    showPrompt("Temporada em Andamento", msgHTML, () => {
        const radios = document.getElementsByName('rd_acao_temporada');
        let acaoEscolhida = 'repescagem';
        
        for (let r of radios) {
            if (r.checked) {
                acaoEscolhida = r.value;
                break;
            }
        }

        if (acaoEscolhida === 'repescagem') {
            processarRepescagemNovosAtletasSaaS(dadosConviteAtual);
        } else {
            // Se optou por reiniciar geral, abre a escolha inicial de ordenação
            exibirModalInicialDisparoTemporadaSaaS();
        }
    });
}

// REPESCAGEM: Anexa apenas novos inscritos sem apagar a fila existente
function processarRepescagemNovosAtletasSaaS(dadosConviteAtual) {
    showToast("Verificando novos atletas no cadastro...", "info");

    // Consulta atletas e tabelas em paralelo
    Promise.all([
        database.ref(`${raizBanco}/jogadores`).once('value'),
        database.ref(`${raizBanco}/ranking/tabelas`).once('value')
    ]).then(([snapJogadores, snapTabelas]) => {
        if (!snapJogadores.exists()) {
            return showToast("Nenhum atleta localizado no cadastro.", "warning");
        }

        const todosJogadores = snapJogadores.val();
        const todasTabelas = snapTabelas.exists() ? snapTabelas.val() : {};
        const pendentesAtuais = dadosConviteAtual.pendentes || {};

        // Mapeia IDs de quem JÁ ESTÁ em alguma tabela do ranking
        const idsJaInseridos = new Set();
        Object.keys(todasTabelas).forEach(categoriaKey => {
            const listaIds = todasTabelas[categoriaKey];
            if (Array.isArray(listaIds)) {
                listaIds.forEach(id => idsJaInseridos.add(id));
            }
        });

        // Filtra apenas quem tem participaRanking === true, mas NÃO está pendente nem nas tabelas
        const novosPendentesUpdate = {};
        let totalNovos = 0;

        Object.keys(todosJogadores).forEach(id => {
            const j = todosJogadores[id];
            if (j.participaRanking === true) {
                const jaEstaPendente = pendentesAtuais[id] === true;
                const jaEstaNaTabela = idsJaInseridos.has(id);

                if (!jaEstaPendente && !jaEstaNaTabela) {
                    novosPendentesUpdate[id] = true;
                    totalNovos++;
                }
            }
        });

        if (totalNovos === 0) {
            return showToast("Todos os atletas do ranking já possuem convite ou estão inscritos.", "info");
        }

        // Grava apenas as novas chaves no nó pendentes via .update()
        database.ref(`${raizBanco}/convites_ranking/pendentes`).update(novosPendentesUpdate).then(() => {
            showToast(`Repescagem concluída! ${totalNovos} novo(s) atleta(s) convidado(s).`, "success");
        }).catch((err) => {
            console.error("Erro na repescagem:", err);
            showToast("Erro ao atualizar convites no banco de dados.", "error");
        });

    }).catch((err) => {
        console.error("Erro ao ler dados para repescagem:", err);
        showToast("Erro de leitura no banco de dados.", "error");
    });
}

function processarDisparoTemporadaFirebase(tipoOrdem) {
    showToast("Buscando atletas inscritos no ranking...", "info");

    database.ref(`${raizBanco}/jogadores`).once('value').then((snap) => {
        if (!snap.exists()) {
            showToast("Nenhum jogador encontrado no cadastro do clube.", "warning");
            return;
        }

        const todosJogadores = snap.val();
        const pendentesMap = {};
        let totalInscritos = 0;

        Object.keys(todosJogadores).forEach(id => {
            if (todosJogadores[id].participaRanking === true) {
                pendentesMap[id] = true;
                totalInscritos++;
            }
        });

        if (totalInscritos === 0) {
            showToast("Nenhum atleta possui a opção 'Participa do Ranking' ativa na ficha.", "warning");
            return;
        }

        const anoAtual = new Date().getFullYear();
        const temporadaData = {
            temporadaId: `${anoAtual}_T${Date.now()}`,
            dataAbertura: Date.now(),
            tipoOrdenacao: tipoOrdem,
            status: "aberto",
            pendentes: pendentesMap
        };

        database.ref(`${raizBanco}/convites_ranking`).set(temporadaData).then(() => {
            showToast(`Convites disparados com sucesso para ${totalInscritos} atleta(s)!`, "success");
        }).catch((err) => {
            console.error("Erro ao gravar convites:", err);
            showToast("Erro ao gravar convites no banco de dados.", "error");
        });
    }).catch((err) => {
        console.error("Erro na leitura de jogadores:", err);
        showToast("Erro ao acessar a base de atletas.", "error");
    });
}


function solicitarResetRankingSaaS() {
    showToast("Ação de zerar classificação (Será conectada na Etapa 5).", "info");
}