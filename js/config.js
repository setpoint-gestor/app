
"use strict";

// ========================================================
// 1. ESTADO LOCAL DO HUB DE CONFIGURAÇÕES (Memória RAM do Módulo)
// ========================================================
let carrinhoAulas = {};         // Espelho local temporário para edições em lote da Grade de Aulas (SaaS)
let carrinhoDuplas = {};        // Espelho local temporário para edições em lote do Horário de Duplas (SaaS)
let carrinhoConvidados = {};    // Espelho local temporário para os parâmetros e regras do Concierge de Convidados (SaaS)
let quadraAulaAtual = '';       // Armazena a string da quadra ativa em edição no submódulo de Aulas
let selecaoLoteAulas = {};      // Rastreador de células selecionadas simultaneamente para atribuição em lote
let quadraDuplaAtual = '';      // Armazena a string da quadra ativa em edição no submódulo de Duplas
let quadraConvidadosAtual = '';  // Armazena a string da quadra ativa em edição no submódulo de Convidados



// ========================================================
// CONTROLE DO HUB CENTRAL DE HORÁRIOS & GRADES
// ========================================================

/**
 * Altera de escopo entre as abas originais da tela mestre (Arena / Quadras)
 */
function mudarEscopoConfig(escopoTarget) {
    if (navigator.vibrate) navigator.vibrate(30);  

    document.getElementById('btn-escopo-arena').classList.remove('ativa');
    document.getElementById('btn-escopo-quadras').classList.remove('ativa');
    document.getElementById(`btn-escopo-${escopoTarget}`).classList.add('ativa');

    document.getElementById('escopo-conteudo-arena').classList.remove('ativa');
    document.getElementById('escopo-conteudo-quadras').classList.remove('ativa');
    document.getElementById(`escopo-conteudo-${escopoTarget}`).classList.add('ativa'); 
}

/**
 * Inicializador dos sub-módulos operacionais
 */
function abrirSubModulo(moduloKey) {
    if (navigator.vibrate) navigator.vibrate(40); 

    const modalJanela = document.querySelector('.modal-config-janela'); 
    const tabsEscopo = document.querySelector('.config-tabs-escopo');
    const headerJanela = document.querySelector('.modal-config-janela .header-painel');
    const footerJanela = document.querySelector('.config-modal-footer');

    if (moduloKey === 'horario-padrao') {
        // ASSOCIA A CLASSE AMPLA (680px) PARA O HORÁRIO PADRÃO
        if (modalJanela) {
            modalJanela.classList.remove('modal-config-janela-fullscreen');
            modalJanela.classList.add('modal-config-janela-ampla');
        }
        if (tabsEscopo) tabsEscopo.style.display = 'none';

        headerJanela.innerHTML = `<h2 style="text-align: center; width: 100%; margin: 0; font-size: 22px; font-weight: 700;">Horários Padrão</h2>`;
		
        document.getElementById('arena-visao-menu').classList.remove('ativa');
        document.getElementById('arena-visao-horario-padrao').classList.add('ativa');

        if (footerJanela) {
            footerJanela.classList.add('layout-duplo');
            footerJanela.innerHTML = `
                <button class="btn-config-fechar" onclick="voltarAoMenuHubGeral()">Fechar</button>
                <button class="btn-config-salvar" onclick="salvarHorarioPadraoSaas()">Salvar</button>
            `;
        }
        buscarHorarioPadraoFirebase();

    } else if (moduloKey === 'aula') {
        // ASSOCIA A CLASSE FULLSCREEN (100vw) EXCLUSIVAMENTE PARA A GRADE DE AULAS
        if (modalJanela) {
            modalJanela.classList.remove('modal-config-janela-ampla');
            modalJanela.classList.add('modal-config-janela-fullscreen');
        }
        if (tabsEscopo) tabsEscopo.style.display = 'none';

        headerJanela.innerHTML = `<h2 style="text-align: center; width: 100%; margin: 0; font-size: 22px; font-weight: 700;">Grade de Aulas</h2>`;

        document.getElementById('quadras-visao-menu').classList.remove('ativa');
        
        const visaoAula = document.getElementById('quadras-visao-aula');
        visaoAula.classList.add('ativa');
        visaoAula.style.display = 'flex'; 

        if (footerJanela) {
            footerJanela.classList.add('layout-duplo');
            footerJanela.innerHTML = `
                <button class="btn-config-fechar" onclick="voltarAoMenuHubGeral()">Fechar</button>
                <button class="btn-config-salvar" onclick="salvarGradeAulasSaas()">Salvar</button>
            `;
        }
        inicializarModuloAulas(); 

    } else if (moduloKey === 'duplas') {
        // ASSOCIA A CLASSE FULLSCREEN (100vw) TAMBÉM PARA OS TREINOS DE DUPLAS
        if (modalJanela) {
            modalJanela.classList.remove('modal-config-janela-ampla');
            modalJanela.classList.add('modal-config-janela-fullscreen');
        }
        if (tabsEscopo) tabsEscopo.style.display = 'none';

        headerJanela.innerHTML = `<h2 style="text-align: center; width: 100%; margin: 0; font-size: 22px; font-weight: 700;">Horário de Duplas</h2>`;

        document.getElementById('quadras-visao-menu').classList.remove('ativa');
        
        const visaoDuplas = document.getElementById('quadras-visao-duplas');
        visaoDuplas.classList.add('ativa');
        visaoDuplas.style.display = 'flex'; 

        if (footerJanela) {
            footerJanela.classList.add('layout-duplo');
            footerJanela.innerHTML = `
                <button class="btn-config-fechar" onclick="voltarAoMenuHubGeral()">Fechar</button>
                <button class="btn-config-salvar" onclick="salvarGradeDuplasSaas()">Salvar</button>
            `;
        }
        inicializarModuloDuplas(); 

    } else if (moduloKey === 'convidados') {
        // ASSOCIA A CLASSE FULLSCREEN PARA O HORÁRIO DE CONVIDADOS
        if (modalJanela) {
            modalJanela.classList.remove('modal-config-janela-ampla');
            modalJanela.classList.add('modal-config-janela-fullscreen');
        }
        if (tabsEscopo) tabsEscopo.style.display = 'none';

        headerJanela.innerHTML = `<h2 style="text-align: center; width: 100%; margin: 0; font-size: 22px; font-weight: 700;">Horário de Convidados</h2>`;

        document.getElementById('quadras-visao-menu').classList.remove('ativa');
        
        const visaoConvidados = document.getElementById('quadras-visao-convidados');
        if (visaoConvidados) {
            visaoConvidados.classList.add('ativa');
            visaoConvidados.style.display = 'flex';  
        }

        if (footerJanela) {
            footerJanela.classList.add('layout-duplo');
            footerJanela.innerHTML = `
                <button class="btn-config-fechar" onclick="voltarAoMenuHubGeral()">Fechar</button>
                <button class="btn-config-salvar" onclick="salvarGradeConvidadosSaas()">Salvar</button>
            `;
        }
        inicializarModuloConvidados();

    } else {
        showToast(`Módulo [${moduloKey.toUpperCase()}] será integrado em breve!`, 'info');
    }
}



/**
 * Alerta e controle anti-descarte com Painéis Semânticos de Grupo (Fieldset Legend)
 */
function voltarAoMenuHubGeral() {
    const diasNome = { 1: 'Segunda-feira', 2: 'Terça-feira', 3: 'Quarta-feira', 4: 'Quinta-feira', 5: 'Sexta-feira', 6: 'Sábado', 7: 'Domingo' };

    // Filtro que limpa as cascas estruturais vazias injetadas para que não gerem falsos positivos
    const normalizarEstado = (obj) => {
        if (!obj) return {};
        const clone = JSON.parse(JSON.stringify(obj));
        for (const key in clone) {
            const item = clone[key];
            if (typeof item === 'object' && item !== null && 'Ativo' in item) {
                const temGrade = item.Grade && Object.keys(item.Grade).length > 0;
                if (item.Ativo === false && !temGrade) {
                    delete clone[key];
                }
            }
        }
        return clone;
    };

    // --- 🛠️ 1. DETALHAMENTO: ANTI-DESCARTE NA GRADE DE AULAS ---
    const visaoAula = document.getElementById('quadras-visao-aula');
    if (visaoAula && visaoAula.classList.contains('ativa')) {
        let blocosHTML = [];

        // Se houver slots soltos selecionados em lote
        if (typeof selecaoLoteAulas !== 'undefined' && selecaoLoteAulas && Object.keys(selecaoLoteAulas).length > 0) {
            blocosHTML.push(`
                <div style="background: #fff9db; color: #b0851a; padding: 10px; border-radius: 6px; font-size: 13px; font-weight: 600; margin-bottom: 12px; border: 1px solid #ffe3e3; text-align: left;">
                    ⚠️ Slots em Lote: ${Object.keys(selecaoLoteAulas).length} horários selecionados e pendentes.
                </div>
            `);
        }

        Object.keys(carrinhoAulas).forEach(qKey => {
            const nomeQuadra = qKey.replace('Quadra', 'Quadra ');
            let subMudancas = [];

            const novoAtivo = carrinhoAulas[qKey].Ativo === true;
            const velhoAtivo = configAulasGlobal[qKey]?.Ativo === true;

            if (novoAtivo !== velhoAtivo) {
                subMudancas.push(`• <b>Status Geral:</b> de <i>${velhoAtivo ? 'Ativada' : 'Desativada'}</i> para <b style="color:#dc3545;">${novoAtivo ? 'Ativada' : 'Desativada'}</b>`);
            }

            const novaGrade = carrinhoAulas[qKey].Grade || {};
            const velhaGrade = configAulasGlobal[qKey]?.Grade || {};
            const todasChaves = new Set([...Object.keys(novaGrade), ...Object.keys(velhaGrade)]);

            todasChaves.forEach(k => {
                if (novaGrade[k] !== velhaGrade[k]) {
                    const [d, h] = k.split('_');
                    const diaTxt = diasNome[d] || `Dia ${d}`;
                    const horaTxt = `${String(h).padStart(2, '0')}:00`;
                    const txtVelho = velhaGrade[k] ? `Prof. ${velhaGrade[k]}` : 'Livre';
                    const txtNovo = novaGrade[k] ? `Prof. ${novaGrade[k]}` : 'Livre';

                    subMudancas.push(`• <b>${diaTxt} às ${horaTxt}:</b> de <i>${txtVelho}</i> para <b style="color:#dc3545;">${txtNovo}</b>`);
                }
            });

            // 💎 O RETÂNGULO INTELIGENTE: A própria linha superior vira o divisor da Quadra atual!
            if (subMudancas.length > 0) {
                blocosHTML.push(`
                    <fieldset style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 0 12px 10px 12px; margin: 15px 0 5px 0; background: #f8fafc; text-align: left;">
                        <legend style="padding: 0 8px; font-size: 11px; font-weight: 900; color: #94a3b8; letter-spacing: 1.5px; text-transform: uppercase; text-align: center; margin: 0 auto;">
                            ${nomeQuadra}
                        </legend>
                        <div style="max-height: 110px; overflow-y: auto; padding-top: 8px; font-size: 13px; line-height: 1.6; color: #475569;">
                            ${subMudancas.join('<br>')}
                        </div>
                    </fieldset>
                `);
            }
        });

        if (blocosHTML.length > 0) {
            if (navigator.vibrate) navigator.vibrate(30);
            const msgDetalhada = `
                Você modificou as seguintes configurações que ainda não foram salvas:<br>
                ${blocosHTML.join('')}
                <br>Deseja realmente sair e <b style="color:#dc3545;">descartar</b> tudo?
            `;
            showPrompt("Descartar Alterações?", msgDetalhada, () => {
                selecaoLoteAulas = {};
                carrinhoAulas = JSON.parse(JSON.stringify(configAulasGlobal || {}));
                executarFechamentoHubGeral();
            });
            return;
        }
    }

    // --- ⚙️ 2. DETALHAMENTO: ANTI-DESCARTE NO HORÁRIO DE DUPLAS ---
    const visaoDuplas = document.getElementById('quadras-visao-duplas');
    if (visaoDuplas && visaoDuplas.classList.contains('ativa')) {
        let blocosHTML = [];

        Object.keys(carrinhoDuplas).forEach(qKey => {
            const nomeQuadra = qKey.replace('Quadra', 'Quadra ');
            let subMudancas = [];

            const novoAtivo = carrinhoDuplas[qKey].Ativo === true;
            const velhoAtivo = configDuplasGlobal[qKey]?.Ativo === true;

            if (novoAtivo !== velhoAtivo) {
                subMudancas.push(`• <b>Status Geral:</b> de <i>${velhoAtivo ? 'Ativada' : 'Desativada'}</i> para <b style="color:#dc3545;">${novoAtivo ? 'Ativada' : 'Desativada'}</b>`);
            }

            const novaGrade = carrinhoDuplas[qKey].Grade || {};
            const velhaGrade = configDuplasGlobal[qKey]?.Grade || {};
            const todasChaves = new Set([...Object.keys(novaGrade), ...Object.keys(velhaGrade)]);

            todasChaves.forEach(k => {
                if (novaGrade[k] !== velhaGrade[k]) {
                    const [d, h] = k.split('_');
                    const diaTxt = diasNome[d] || `Dia ${d}`;
                    const horaTxt = `${String(h).padStart(2, '0')}:00`;

                    subMudancas.push(`• <b>${diaTxt} às ${horaTxt}:</b> de <i>${velhaGrade[k] ? 'Dupla' : 'Livre'}</i> para <b style="color:#dc3545;">${novaGrade[k] ? 'Dupla' : 'Livre'}</b>`);
                }
            });

            // 💎 O RETÂNGULO INTELIGENTE DUPLAS
            if (subMudancas.length > 0) {
                blocosHTML.push(`
                    <fieldset style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 0 12px 10px 12px; margin: 15px 0 5px 0; background: #f8fafc; text-align: left;">
                        <legend style="padding: 0 8px; font-size: 11px; font-weight: 900; color: #94a3b8; letter-spacing: 1.5px; text-transform: uppercase; text-align: center; margin: 0 auto;">
                            ${nomeQuadra}
                        </legend>
                        <div style="max-height: 110px; overflow-y: auto; padding-top: 8px; font-size: 13px; line-height: 1.6; color: #475569;">
                            ${subMudancas.join('<br>')}
                        </div>
                    </fieldset>
                `);
            }
        });

        if (blocosHTML.length > 0) {
            if (navigator.vibrate) navigator.vibrate(30);
            const msgDetalhada = `
                Você modificou as seguintes configurações que ainda não foram salvas:<br>
                ${blocosHTML.join('')}
                <br>Deseja realmente sair e <b style="color:#dc3545;">descartar</b> tudo?
            `;
            showPrompt("Descartar Alterações?", msgDetalhada, () => {
                carrinhoDuplas = JSON.parse(JSON.stringify(configDuplasGlobal || {}));
                executarFechamentoHubGeral();
            });
            return;
        }
    }

    // --- 🥂 3. DETALHAMENTO: ANTI-DESCARTE EM CONVIDADOS ---
    const visaoConvidados = document.getElementById('quadras-visao-convidados');
    if (visaoConvidados && visaoConvidados.classList.contains('ativa')) {
        let blocosHTML = [];
        let metaMudancas = [];

        const verificarMeta = (idDOM, label, chaveObjeto) => {
            const el = document.getElementById(idDOM);
            const vNovo = el ? el.value : (carrinhoConvidados[chaveObjeto] || '');
            const vVelho = configConvidadosGlobal[chaveObjeto] || '';
            if (vNovo !== vVelho) {
                metaMudancas.push(`• <b>${label}:</b> de <i>${vVelho || 'Vazio'}</i> para <b style="color:#dc3545;">${vNovo || 'Vazio'}</b>`);
            }
        };

        verificarMeta('txt-taxa-convidado', 'Taxa por Convidado', 'Taxa');
        verificarMeta('select-recebedor-convidado', 'Destinatário Financeiro', 'Recebedor');
        verificarMeta('txt-chave-pix-convidado', 'Chave PIX', 'ChavePix');
        verificarMeta('txt-whatsapp-convidado', 'WhatsApp Concierge', 'Whatsapp');

        // Se alterou alguma configuração financeira mestre, joga no retângulo de Parâmetros
        if (metaMudancas.length > 0) {
            blocosHTML.push(`
                <fieldset style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 0 12px 10px 12px; margin: 10px 0 5px 0; background: #f8fafc; text-align: left;">
                    <legend style="padding: 0 8px; font-size: 11px; font-weight: 900; color: #94a3b8; letter-spacing: 1.5px; text-transform: uppercase; text-align: center; margin: 0 auto;">
                        Parâmetros Gerais
                    </legend>
                    <div style="max-height: 110px; overflow-y: auto; padding-top: 8px; font-size: 13px; line-height: 1.6; color: #475569;">
                        ${metaMudancas.join('<br>')}
                    </div>
                </fieldset>
            `);
        }

        Object.keys(carrinhoConvidados).forEach(qKey => {
            if (qKey.startsWith('Quadra')) {
                const nomeQuadra = qKey.replace('Quadra', 'Quadra ');
                let subMudancas = [];

                const novoAtivo = carrinhoConvidados[qKey].Ativo === true;
                const velhoAtivo = configConvidadosGlobal[qKey]?.Ativo === true;

                if (novoAtivo !== velhoAtivo) {
                    subMudancas.push(`• <b>Status Geral:</b> de <i>${velhoAtivo ? 'Ativada' : 'Desativada'}</i> para <b style="color:#dc3545;">${novoAtivo ? 'Ativada' : 'Desativada'}</b>`);
                }

                const novaGrade = carrinhoConvidados[qKey].Grade || {};
                const velhaGrade = configConvidadosGlobal[qKey]?.Grade || {};
                const todasChaves = new Set([...Object.keys(novaGrade), ...Object.keys(velhaGrade)]);

                todasChaves.forEach(k => {
                    if (novaGrade[k] !== velhaGrade[k]) {
                        const [d, h] = k.split('_');
                        const diaTxt = diasNome[d] || `Dia ${d}`;
                        const horaTxt = `${String(h).padStart(2, '0')}:00`;

                        subMudancas.push(`• <b>${diaTxt} às ${horaTxt}:</b> de <i>${velhaGrade[k] ? 'Bloqueado' : 'Livre'}</i> para <b style="color:#dc3545;">${novaGrade[k] ? 'Bloqueado' : 'Livre'}</b>`);
                    }
                });

                // 💎 O RETÂNGULO INTELIGENTE CONVIDADOS
                if (subMudancas.length > 0) {
                    blocosHTML.push(`
                        <fieldset style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 0 12px 10px 12px; margin: 15px 0 5px 0; background: #f8fafc; text-align: left;">
                            <legend style="padding: 0 8px; font-size: 11px; font-weight: 900; color: #94a3b8; letter-spacing: 1.5px; text-transform: uppercase; text-align: center; margin: 0 auto;">
                                ${nomeQuadra}
                            </legend>
                            <div style="max-height: 110px; overflow-y: auto; padding-top: 8px; font-size: 13px; line-height: 1.6; color: #475569;">
                                ${subMudancas.join('<br>')}
                            </div>
                        </fieldset>
                    `);
                }
            }
        });

        if (blocosHTML.length > 0) {
            if (navigator.vibrate) navigator.vibrate(30);
            const msgDetalhada = `
                Você modificou as seguintes configurações que ainda não foram salvas:<br>
                ${blocosHTML.join('')}
                <br>Deseja realmente sair e <b style="color:#dc3545;">descartar</b> tudo?
            `;
            showPrompt("Descartar Alterações?", msgDetalhada, () => {
                carrinhoConvidados = JSON.parse(JSON.stringify(configConvidadosGlobal || {}));
                executarFechamentoHubGeral();
            });
            return;
        }
    }

    executarFechamentoHubGeral();
}




function executarFechamentoHubGeral() {
    const modalJanela = document.querySelector('.modal-config-janela');
    if (modalJanela) {
        modalJanela.classList.remove('modal-config-janela-ampla');
        modalJanela.classList.remove('modal-config-janela-fullscreen');
    }

    const tabsEscopo = document.querySelector('.config-tabs-escopo');
    if (tabsEscopo) tabsEscopo.style.display = 'flex';

    const headerJanela = document.querySelector('.modal-config-janela .header-painel');
    if (headerJanela) {
        headerJanela.innerHTML = `
            <div>
                <h2>⏱️ Horários & Grades</h2>
                <span style="font-size: 13px; color: #888;">Definição de expedientes e grades de quadras.</span>
            </div>
            <button class="material-icons" style="background:none; border:none; cursor:pointer; color:var(--cor-escura); font-size: 28px;" onclick="fecharModalConfig('modal-horarios')" title="Fechar Janela">arrow_back</button>
        `;
    }

    // Desativa as telas internas e restaura os menus do Hub
    document.getElementById('arena-visao-horario-padrao').classList.remove('ativa');
    document.getElementById('arena-visao-menu').classList.add('ativa');

    const visaoAula = document.getElementById('quadras-visao-aula');
    if (visaoAula) {
        visaoAula.classList.remove('ativa');
        visaoAula.style.display = 'none'; 
    }

    const visaoDuplas = document.getElementById('quadras-visao-duplas');
    if (visaoDuplas) {
        visaoDuplas.classList.remove('ativa');
        visaoDuplas.style.display = 'none'; 
    }
	
	const visaoConvidados = document.getElementById('quadras-visao-convidados');
	if (visaoConvidados) {
		visaoConvidados.classList.remove('ativa');
		visaoConvidados.style.display = 'none';
	}

    const quadrasMenu = document.getElementById('quadras-visao-menu');
    if (quadrasMenu) quadrasMenu.classList.add('ativa');

    const footerJanela = document.querySelector('.config-modal-footer');
    if (footerJanela) {
        footerJanela.classList.remove('layout-duplo');
        footerJanela.innerHTML = '';
    }
   
}

// ========================================================
// MÓDULO OPERACIONAL 1: HORÁRIO PADRÃO (ARENA GERAL)
// ========================================================

function buscarHorarioPadraoFirebase() {
    const tbody = document.getElementById('tbodyHorarioPadraoSaas');
    if (!tbody) return;

    // Estado de Carregamento Limpo e Sem Poluição de Estilos inline
    tbody.innerHTML = `<tr><td colspan="4" class="txt-loading-SaaS" style="text-align: center; color: #64748b; padding: 24px 0;">Buscando parâmetros operacionais...</td></tr>`;

    // ARQUITETURA RESPONSIVA: Aproveita as classes .txt-desktop que já existem no seu CSS
    const diasSemana = {
        1: 'Segunda<span class="txt-desktop">-feira</span>', 
        2: 'Terça<span class="txt-desktop">-feira</span>', 
        3: 'Quarta<span class="txt-desktop">-feira</span>',
        4: 'Quinta<span class="txt-desktop">-feira</span>', 
        5: 'Sexta<span class="txt-desktop">-feira</span>', 
        6: 'Sábado', 
        7: 'Domingo'
    };

    database.ref(`${raizBanco}/config/Horarios/Padrao`).once('value').then((snapshot) => {
        tbody.innerHTML = '';
        const dados = snapshot.val() || {};

        for (let d = 1; d <= 7; d++) {
            const configDia = dados[d] || { status: "aberto", abertura: "06:00", fechamento: "23:00" };
            const tr = document.createElement('tr');
            tr.id = `linha_config_dia_${d}`;
            
            if (configDia.status === 'fechado') {
                tr.className = 'linha-dia-fechada';
            }

            const isFechado = configDia.status === 'fechado';

            // REMOVIDOS OS ESTILOS INLINE DO TD QUE ESTAVAM IGNORANDO O SEU ARQUIVO CSS NO CELULAR!
            tr.innerHTML = `
                <td>${diasSemana[d]}</td>
                <td>
                    <select id="status-SaaS-${d}" class="input-app" style="margin:0; padding:4px 8px; font-size:13px; font-weight:bold; height:32px;" onchange="toggleLinhaHorarioPadrao(${d}, this.value === 'aberto')">
                        <option value="aberto" ${configDia.status === 'aberto' ? 'selected' : ''}>Aberto</option>
                        <option value="fechado" ${configDia.status === 'fechado' ? 'selected' : ''}>Fechado</option>
                    </select>
                </td>
                <td>
                    <input type="time" id="abertura-SaaS-${d}" class="time-input-SaaS" value="${configDia.abertura || '06:00'}" ${isFechado ? 'disabled' : ''}>
                </td>
                <td>
                    <input type="time" id="fechamento-SaaS-${d}" class="time-input-SaaS" value="${configDia.fechamento || '23:00'}" ${isFechado ? 'disabled' : ''}>
                </td>
            `;
            tbody.appendChild(tr);
        }
    }).catch(err => {
        console.error("Erro ao ler horários padrão:", err);
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #dc3545; padding: 16px 0;">Erro ao sincronizar dados operacionais.</td></tr>`;
    });
}



function toggleLinhaHorarioPadrao(dia, isChecked) {
    if (navigator.vibrate) navigator.vibrate(25);
    
    const inputAbertura = document.getElementById(`abertura-SaaS-${dia}`);
    const inputFechamento = document.getElementById(`fechamento-SaaS-${dia}`);
    const grandfather = inputAbertura.closest('tr');

    if (isChecked) {
        if (grandfather) grandfather.classList.remove('linha-dia-fechada');
        if (inputAbertura) inputAbertura.disabled = false;
        if (inputFechamento) inputFechamento.disabled = false;
    } else {
        if (grandfather) grandfather.classList.add('linha-dia-fechada');
        if (inputAbertura) inputAbertura.disabled = true;
        if (inputFechamento) inputFechamento.disabled = true;
    }
}

function salvarHorarioPadraoSaas() {
    if (navigator.vibrate) navigator.vibrate(50);
    const payload = {};
    let diasMadrugada = [];
    const diasSemanaNomes = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'];

    for (let d = 1; d <= 7; d++) {
        const isAberto = document.getElementById(`status-SaaS-${d}`).value === 'aberto';
        payload[d] = {
            status: isAberto ? "aberto" : "fechado",
            abertura: document.getElementById(`abertura-SaaS-${d}`).value || "06:00",
            fechamento: document.getElementById(`fechamento-SaaS-${d}`).value || "23:00"
        };

        // TRAVA INTELIGENTE RECUPERADA: Detecta se o encerramento avança pela madrugada interna
        if (isAberto) {
            const abertura = payload[d].abertura;
            const fechamento = payload[d].fechamento;
            if (abertura !== "" && fechamento !== "" && fechamento < abertura) {
                diasMadrugada.push(diasSemanaNomes[d - 1]);
            }
        }
    }

    // Isola o despacho original para ser acionado direto ou via confirmação do Prompt
    const despacharDadosAoFirebase = () => {
        database.ref(`${raizBanco}/config/Horarios/Padrao`).set(payload).then(() => {
            regrasHorariosSaaS = payload;
            showToast("Horários de funcionamento da arena atualizados com sucesso!", "success");
        }).catch(err => {
            console.error("Erro ao salvar horários padrão:", err);
            showToast("Erro ao gravar dados no Firebase.", "error");
        });
    };

    // BIFURCAÇÃO DE SEGURANÇA: Se houver recesso/corujão interno, intercepta com o alarme visual
    if (diasMadrugada.length > 0) {
        const listaDiasTxt = diasMadrugada.join(', ');
        showPrompt(
            "⚠️ Operação na Madrugada",
            `Você definiu um horário de fechamento menor que o de abertura em: <b>${listaDiasTxt}</b>.<br><br>Deseja salvar mesmo assim operando no corujão?`,
            despacharDadosAoFirebase
        );
    } else {
        despacharDadosAoFirebase();
    }
}


// ========================================================
// MÓDULO OPERACIONAL 2: GRADE DE AULAS (INDIVIDUAL QUADRAS)
// ========================================================

function inicializarModuloAulas() {
    selecaoLoteAulas = {};
    atualizarBotaoFabLote();

    Promise.all([
        database.ref(`${raizBanco}/config/Quadras`).once('value'),
        database.ref(`${raizBanco}/config/Horarios/Aulas`).once('value')
    ]).then(([snapQuadras, snapAulas]) => {
        const quadrasObj = snapQuadras.val() || {};
        const qtdQuadras = quadrasObj.quantidade || 2;
        const nomesQuadras = quadrasObj.nomes || {};
        
        configAulasGlobal = snapAulas.val() || {};
        carrinhoAulas = JSON.parse(JSON.stringify(configAulasGlobal)); 

        renderizarAbasQuadrasAulas(qtdQuadras, nomesQuadras);

    }).catch(err => {
        console.error("Erro ao carregar módulo de Aulas:", err);
        showToast("Erro ao sincronizar a matriz de aulas.", "error");
    });
}


function renderizarAbasQuadrasAulas(qtd, nomes) {
    const containerPC = document.getElementById('aulas-tabs-quadras-desktop');
    if(containerPC) containerPC.innerHTML = ''; 
    let primeiraQuadra = '';

    for (let i = 1; i <= qtd; i++) {
        // Extração rica e segura do nome da quadra
        const nomeDaQuadra = typeof nomes[i] === 'object' ? (nomes[i].nome || `Quadra ${i}`) : (nomes[i] || `Quadra ${i}`);
        const quadraKey = `Quadra${i}`;
        if (i === 1) primeiraQuadra = quadraKey;

        const btn = document.createElement('button');
        btn.className = 'quadra-pill';
        btn.id = `btn-aula-${quadraKey}`;
        btn.textContent = `Quadra ${i}`;
        btn.onclick = () => selecionarQuadraAulaConfig(quadraKey, nomeDaQuadra);
        
        if(containerPC) containerPC.appendChild(btn);
    }
    
    // 🛡️ LAPIDAÇÃO PREMIUM UX: Ajuste visual cirúrgico para 1 quadra
    const btnMapaGrade = document.querySelector('#quadras-visao-aula .container-titulo-central button');
    
    if (parseInt(qtd) === 1) {
        if (containerPC) containerPC.style.setProperty('display', 'none', 'important');
        if (btnMapaGrade) btnMapaGrade.style.setProperty('display', 'none', 'important');
    } else {
        if (containerPC) containerPC.style.removeProperty('display');
        if (btnMapaGrade) btnMapaGrade.style.removeProperty('display');
    }
    
    // Passagem protegida para a quadra inicial
    const nomeInicial = typeof nomes[1] === 'object' ? (nomes[1].nome || 'Quadra 1') : (nomes[1] || 'Quadra 1');
    selecionarQuadraAulaConfig(primeiraQuadra, nomeInicial);
}





function selecionarQuadraAulaConfig(quadraKey, nomeExibicao) {
    if (navigator.vibrate) navigator.vibrate(20);
    quadraAulaAtual = quadraKey;
    selecaoLoteAulas = {}; 
    atualizarBotaoFabLote();

    document.querySelectorAll('#aulas-tabs-quadras-desktop .quadra-pill').forEach(btn => btn.classList.remove('ativa'));
    const btnAtivo = document.getElementById(`btn-aula-${quadraKey}`);
    if (btnAtivo) btnAtivo.classList.add('ativa');

    const lblMobile = document.getElementById('lbl-quadra-titulo-aulas');
    if (lblMobile) {
        if (nomeExibicao) lblMobile.textContent = nomeExibicao;
        const containerTitulo = lblMobile.closest('.container-titulo-central') || lblMobile.parentElement;
        if (containerTitulo) {
            containerTitulo.onclick = () => abrirMapaUniversal('aula');
        }
    }

    if (!carrinhoAulas[quadraKey]) {
        carrinhoAulas[quadraKey] = { Ativo: false, Grade: {} };
    }

    document.getElementById('chk-aulas-ativas').checked = carrinhoAulas[quadraKey].Ativo === true;
    
    atualizarFiltroFantasma();
    renderizarGradeAulas();
}



// ========================================================
// MOTOR UNIVERSAL: GERENCIADOR DINÂMICO DO MAPA DE QUADRAS
// ========================================================
function abrirMapaUniversal(tipoTela) {
    const grid = document.getElementById('grid-numerico-quadras');
    if (!grid) return;

    if (navigator.vibrate) navigator.vibrate(20);

    const modal = document.getElementById('modal-mapa-quadras');
    const btnGrade = document.getElementById('btn-toggle-grade');
    const btnLista = document.getElementById('btn-toggle-lista');
    const inputBusca = document.getElementById('input-busca-mapa-quadras');

    // BLINDAGEM PREMIUM: Reseta a barra de pesquisa sempre que o modal abre
    if (inputBusca) {
        inputBusca.value = '';
    }

    let quadraAtual, selecionarConfigFn;
    if (tipoTela === 'aula') {
        quadraAtual = quadraAulaAtual;
        selecionarConfigFn = selecionarQuadraAulaConfig;
    } else if (tipoTela === 'duplas') {
        quadraAtual = quadraDuplaAtual;
        selecionarConfigFn = selecionarQuadraDuplaConfig;
    } else if (tipoTela === 'convidados') {
        quadraAtual = quadraConvidadosAtual;
        selecionarConfigFn = selecionarQuadraConvidadosConfig;
    }

    database.ref(`${raizBanco}/config/Quadras`).once('value').then((snapshot) => {
        const configQuadras = snapshot.val() || {};
        const qtdSalva = configQuadras.quantidade || 2;
        const nomesSalvos = configQuadras.nomes || {};

        const atualizarBotoesEestilo = () => {
            grid.innerHTML = '';

            // Captura o valor digitado diretamente da memória RAM
            const termo = inputBusca ? inputBusca.value.toLowerCase().trim() : '';

            // Sincroniza as classes de controle visual do CSS para ocultar/exibir a busca
            if (window.modoVisualizacaoQuadras === 'grade') {
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
                // Tratamento seguro: extrai a string de texto caso a quadra seja um objeto rico
                const nomeQuadra = typeof nomesSalvos[i] === 'object' ? (nomesSalvos[i].nome || `Quadra ${i}`) : (nomesSalvos[i] || `Quadra ${i}`);
                const quadraKey = `Quadra${i}`;

                // ALGORITMO REATIVO: Oculta dinamicamente linhas sem correspondência
                if (window.modoVisualizacaoQuadras === 'lista' && termo !== '') {
                    if (!nomeQuadra.toLowerCase().includes(termo)) {
                        continue; // Salta a renderização sem tocar no Firebase
                    }
                }

                const acaoClique = () => {
                    if (navigator.vibrate) navigator.vibrate(30);
                    selecionarConfigFn(quadraKey, nomeQuadra);
                    fecharModalConfig('modal-mapa-quadras');
                };

                if (window.modoVisualizacaoQuadras === 'grade') {
                    const btnBloco = document.createElement('button');
                    btnBloco.className = 'btn-quadra-grade';
                    btnBloco.style.padding = '12px 5px';
                    btnBloco.style.fontSize = '15px';
                    btnBloco.style.fontWeight = 'bold';
                    btnBloco.style.border = '1px solid #cbd5e1';
                    btnBloco.style.borderRadius = '8px';
                    btnBloco.style.cursor = 'pointer';
                    btnBloco.textContent = i;
                    btnBloco.onclick = acaoClique;

                    if (quadraAtual === quadraKey) {
                        btnBloco.style.backgroundColor = 'var(--cor-primaria)';
                        btnBloco.style.color = 'white';
                        btnBloco.style.borderColor = 'var(--cor-primaria)';
                    } else {
                        btnBloco.style.backgroundColor = '#f8fafc';
                        btnBloco.style.color = '#334155';
                    }
                    grid.appendChild(btnBloco);

                } else {
                    const btnNum = document.createElement('button');
                    btnNum.className = 'btn-quadra-num';
                    btnNum.style.padding = '12px 5px';
                    btnNum.style.fontSize = '15px';
                    btnNum.style.fontWeight = 'bold';
                    btnNum.style.border = '1px solid #cbd5e1';
                    btnNum.style.borderRadius = '8px';
                    btnNum.style.cursor = 'pointer';
                    btnNum.textContent = i;
                    btnNum.onclick = acaoClique;

                    const btnNome = document.createElement('button');
                    btnNome.className = 'btn-quadra-nome';
                    btnNome.style.padding = '12px 12px';
                    btnNome.style.fontSize = '14px';
                    btnNome.style.fontWeight = '500';
                    btnNome.style.border = '1px solid #cbd5e1';
                    btnNome.style.borderRadius = '8px';
                    btnNome.style.cursor = 'pointer';
                    btnNome.style.textAlign = 'left';
                    btnNome.style.whiteSpace = 'nowrap';
                    btnNome.style.overflow = 'hidden';
                    btnNome.style.textOverflow = 'ellipsis';
                    btnNome.textContent = nomeQuadra;
                    btnNome.onclick = acaoClique;

                    if (quadraAtual === quadraKey) {
                        btnNum.style.backgroundColor = 'var(--cor-primaria)';
                        btnNum.style.color = 'white';
                        btnNum.style.borderColor = 'var(--cor-primaria)';
                        btnNome.style.backgroundColor = 'var(--cor-primaria)';
                        btnNome.style.color = 'white';
                        btnNome.style.borderColor = 'var(--cor-primaria)';
                    } else {
                        btnNum.style.backgroundColor = '#f8fafc';
                        btnNum.style.color = '#334155';
                        btnNome.style.backgroundColor = '#f8fafc';
                        btnNome.style.color = '#334155';
                    }

                    grid.appendChild(btnNum);
                    grid.appendChild(btnNome);
                }
            }
        };

        if (window.modoVisualizacaoQuadras === 'grade') {
            if (btnGrade) btnGrade.classList.add('active');
            if (btnLista) btnLista.classList.remove('active');
        } else {
            if (btnLista) btnLista.classList.add('active');
            if (btnGrade) btnGrade.classList.remove('active');
        }

        if (btnGrade) {
            btnGrade.onclick = () => {
                window.modoVisualizacaoQuadras = 'grade';
                btnGrade.classList.add('active');
                if (btnLista) btnLista.classList.remove('active');
                if (inputBusca) inputBusca.value = ''; // Limpa ao voltar para a grade
                atualizarBotoesEestilo();
            };
        }

        if (btnLista) {
            btnLista.onclick = () => {
                window.modoVisualizacaoQuadras = 'lista';
                btnLista.classList.add('active');
                if (btnGrade) btnGrade.classList.remove('active');
                atualizarBotoesEestilo();
            };
        }

        // VITAL: Vincula o ouvinte reativo de digitação sem delay
        if (inputBusca) {
            inputBusca.oninput = () => {
                atualizarBotoesEestilo();
            };
        }

        atualizarBotoesEestilo();
        abrirModalConfig('modal-mapa-quadras');
    });
}



function toggleChaveMestraAulas(isAtivo) {
    carrinhoAulas[quadraAulaAtual].Ativo = isAtivo;
    selecaoLoteAulas = {}; 
    atualizarBotaoFabLote();
    renderizarGradeAulas();
}


function renderizarGradeAulas() {
    const tbody = document.getElementById('tbodyGradeAulas');
    tbody.innerHTML = '';
    const dadosQuadra = carrinhoAulas[quadraAulaAtual] || { Grade: {} };
    const grade = dadosQuadra.Grade || {};
    const isAtiva = dadosQuadra.Ativo;

    const filtroProf = document.getElementById('filtro-professores-aulas').value;

    const tabelaScroll = document.querySelector('#quadras-visao-aula .tabela-grade-scroll');
    if (tabelaScroll) {
        if (isAtiva) tabelaScroll.classList.remove('tabela-grade-desativada');
        else tabelaScroll.classList.add('tabela-grade-desativada');
    }

    for (let h = 6; h <= 22; h++) {
        const tr = document.createElement('tr');
        const txtHora = `<span class="time-part">${String(h).padStart(2,'0')}:00</span><span class="time-sep"> - </span><span class="time-part">${String(h+1).padStart(2,'0')}:00</span>`;
        
        let tdHoraEsq = document.createElement('td');
        tdHoraEsq.className = 'horario-celula';
        tdHoraEsq.innerHTML = txtHora;
        tr.appendChild(tdHoraEsq);

        for (let d = 1; d <= 7; d++) {
            const td = document.createElement('td');
            const key = `${d}_${h}`;

            let bloqueadoPorHorario = false;
            if (typeof regrasHorariosSaaS !== 'undefined' && regrasHorariosSaaS && regrasHorariosSaaS[d]) {
                const regraDia = regrasHorariosSaaS[d];
                if (regraDia.status === 'fechado') {
                    bloqueadoPorHorario = true;
                } else {
                    const inicio = parseInt(regraDia.abertura?.split(':')[0]) || 6;
                    const fim = parseInt(regraDia.fechamento?.split(':')[0]) || 23;
                    if (h < inicio || h >= fim) bloqueadoPorHorario = true;
                }
            }

            if (bloqueadoPorHorario) {
                td.className = 'celula-bloqueada-padrao';
            } else {
                const profNome = grade[key];

                if (profNome) {
                    td.className = 'celula-aula-atribuida';
                    td.textContent = profNome;

                    if (filtroProf !== 'todos' && profNome !== filtroProf) {
                        td.classList.add('celula-apagada-filtro');
                    }
                } else if (selecaoLoteAulas[key] === true) {
                    // CORRIGIDO: Usa a variável certa (selecaoLoteAulas) e sintaxe de Objeto
                    td.className = 'celula-selecionada-lote';
                    td.textContent = ''; 
                } else {
                    td.className = 'celula-livre';
                    td.textContent = '';
                }

                td.onclick = () => alternarSelecaoLote(key, td);
                td.oncontextmenu = (e) => { 
                    e.preventDefault(); 
                    // CORRIGIDO: Valida o tamanho do Objeto em vez de usar .size do Set
                    if(Object.keys(selecaoLoteAulas).length > 0) abrirModalAtribuicaoProfessor(); 
                };
            }
            tr.appendChild(td);
        }
        
        let tdHoraDir = document.createElement('td');
        tdHoraDir.className = 'horario-celula';
        tdHoraDir.innerHTML = txtHora;
        tr.appendChild(tdHoraDir);

        tbody.appendChild(tr);
    }
}



function alternarSelecaoLote(key, td) {
    // Bloqueia qualquer ação se a chave mestra das aulas estiver desativada
    if (!carrinhoAulas[quadraAulaAtual] || !carrinhoAulas[quadraAulaAtual].Ativo) return;

    const grade = carrinhoAulas[quadraAulaAtual].Grade || {};

    // 1. CAMINHO DE EXCLUSÃO RÁPIDA: Se a célula já possui um professor, deleta na hora
    if (grade[key]) {
        if (navigator.vibrate) navigator.vibrate(25);
        delete carrinhoAulas[quadraAulaAtual].Grade[key]; // Remove o professor da memória
        
        atualizarFiltroFantasma(); // Atualiza a lista de filtros de professores
        renderizarGradeAulas();    // Repinta a grade atualizada
        return;
    }

    // 2. CAMINHO DE SELEÇÃO EM LOTE: Se a célula está vazia, joga para o rascunho
    if (navigator.vibrate) navigator.vibrate(20);
    if (selecaoLoteAulas[key] === true) {
        delete selecaoLoteAulas[key];
    } else {
        selecaoLoteAulas[key] = true;
    }
    
    atualizarBotaoFabLote();
    renderizarGradeAulas();
}



function selecionarTudoAulas() {
    if (!carrinhoAulas[quadraAulaAtual] || !carrinhoAulas[quadraAulaAtual].Ativo) return;
    const tbody = document.getElementById('tbodyGradeAulas');
    const filtroProf = document.getElementById('filtro-professores-aulas').value;
    const grade = carrinhoAulas[quadraAulaAtual].Grade || {};

    for (let r = 0; r < tbody.rows.length; r++) {
        const hora = r + 6;
        for (let d = 1; d <= 7; d++) {
            const td = tbody.rows[r].cells[d];
            if (td.classList.contains('celula-livre') || td.classList.contains('celula-aula-atribuida') || td.classList.contains('celula-selecionada-lote')) {
                const key = `${d}_${hora}`;
                
                if (filtroProf !== 'todos') {
                    if (grade[key] === filtroProf || !grade[key]) {
                        selecaoLoteAulas[key] = true;
                    }
                } else {
                    selecaoLoteAulas[key] = true;
                }
            }
        }
    }
    atualizarBotaoFabLote();
    renderizarGradeAulas();
}

function limparTudoAulas() {
    if (!carrinhoAulas[quadraAulaAtual] || !carrinhoAulas[quadraAulaAtual].Ativo) return;
    const tbody = document.getElementById('tbodyGradeAulas');
    const filtroProf = document.getElementById('filtro-professores-aulas').value;
    const grade = carrinhoAulas[quadraAulaAtual].Grade || {};

    for (let r = 0; r < tbody.rows.length; r++) {
        const hora = r + 6;
        for (let d = 1; d <= 7; d++) {
            const key = `${d}_${hora}`;
            if (selecaoLoteAulas[key] === true) {
                delete selecaoLoteAulas[key];
            } else if (filtroProf === 'todos') {
                delete grade[key];
            } else if (grade[key] === filtroProf) {
                delete grade[key];
            }
        }
    }
    atualizarBotaoFabLote();
    renderizarGradeAulas();
}

function atualizarBotaoFabLote() {
    const fab = document.getElementById('fab-atribuir-professor');
    if (!fab) return;

    const qtd = Object.keys(selecaoLoteAulas).length;
    if (qtd > 0) {
        document.getElementById('fab-qtd-selecionada').textContent = `+${qtd}`;
        fab.style.display = 'flex';
    } else {
        fab.style.display = 'none';
    }
}

function abrirModalAtribuicaoProfessor() {
    if (navigator.vibrate) navigator.vibrate(30);
    carregarProfessoresAtribuicao();
    abrirModalConfig('modalAtribuirProfessor');
}

function fecharModalAtribuicao() {
    fecharModalConfig('modalAtribuirProfessor');
}

function confirmarAtribuicaoProfessor() {
    const profSelecionado = document.getElementById('select-atribuir-professor').value;
    
    if (navigator.vibrate) navigator.vibrate(40);
    
    if (!carrinhoAulas[quadraAulaAtual].Grade) {
        carrinhoAulas[quadraAulaAtual].Grade = {};
    }

    Object.keys(selecaoLoteAulas).forEach(key => {
        if (profSelecionado === "") {
            delete carrinhoAulas[quadraAulaAtual].Grade[key];
        } else {
            carrinhoAulas[quadraAulaAtual].Grade[key] = profSelecionado;
        }
    });

    selecaoLoteAulas = {};
    atualizarBotaoFabLote();
    fecharModalAtribuicao();
    atualizarFiltroFantasma();
    renderizarGradeAulas(); 
    showToast("Mudanças aplicadas ao rascunho com sucesso!", "success");
}

function carregarProfessoresAtribuicao() {
    database.ref(`${raizBanco}/jogadores`).once('value').then(snap => {
        const jogs = snap.val() || {};
        const sel = document.getElementById('select-atribuir-professor');
        if (!sel) return;
        
        // Restaura o placeholder original do seu APK de ontem
        sel.innerHTML = '<option value="">Selecione o professor...</option>';
        
        Object.keys(jogs).forEach(key => {
            const j = jogs[key];
            if (j.perfis && j.perfis['Professor'] === true) {
                const primeiroNome = j.apelido ? j.apelido.split(' ')[0] : j.nomeCompleto.split(' ')[0];
                sel.innerHTML += `<option value="${primeiroNome}">${j.nomeCompleto}</option>`;
            }
        });
    }).catch(e => console.error("Erro ao carregar professores: ", e));
}

function atualizarFiltroFantasma() {
    const selectFiltro = document.getElementById('filtro-professores-aulas');
    if (!selectFiltro) return;

    const valorVelho = selectFiltro.value;
    selectFiltro.innerHTML = `<option value="todos">Todos</option>`;

    const grade = carrinhoAulas[quadraAulaAtual]?.Grade || {};
    const professoresListados = new Set();

    Object.keys(grade).forEach(k => {
        if (grade[k]) professoresListados.add(grade[k]);
    });

    professoresListados.forEach(prof => {
        const opt = document.createElement('option');
        opt.value = prof;
        opt.textContent = prof;
        selectFiltro.appendChild(opt);
    });

    if (professoresListados.has(valorVelho)) {
        selectFiltro.value = valorVelho;
    } else {
        selectFiltro.value = 'todos';
    }
}

function aplicarFiltroProfessoresAulas(valor) {
    selecaoLoteAulas = {};
    atualizarBotaoFabLote();
    renderizarGradeAulas();
}


function salvarGradeAulasSaas() {
    if (navigator.vibrate) navigator.vibrate(50);  

    // ALINHAMENTO PREMIUM: Detecta se há horários pendentes no Objeto antes de enviar ao banco
    if (typeof selecaoLoteAulas !== 'undefined' && selecaoLoteAulas && Object.keys(selecaoLoteAulas).length > 0) {
        return showToast("Você tem horários selecionados! Atribua um professor antes de salvar.", "warning");
    }
    
    let profsAdicionados = {};
    let profsRemovidos = {};
    let mudancasVisual = [];
    let totalMudancas = 0;

    Object.keys(carrinhoAulas).forEach(qKey => {
        const gradeNova = carrinhoAulas[qKey].Grade || {};
        const gradeVelha = (configAulasGlobal[qKey] && configAulasGlobal[qKey].Grade) ? configAulasGlobal[qKey].Grade : {};
        
        const ativoNovo = carrinhoAulas[qKey].Ativo === true;
        const ativoVelho = (configAulasGlobal[qKey] && configAulasGlobal[qKey].Ativo === true);
        
        const nomeQuadraFormatado = qKey.replace('Quadra', 'Quadra ');

        if (ativoNovo !== ativoVelho) {
            mudancasVisual.push(`
                <div style="margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px dashed rgba(148, 163, 184, 0.3); color: var(--txt-padrao, #475569); font-size: 13px; line-height: 1.6;">
                    • <b style="color: var(--txt-titulo, #1e293b);">${nomeQuadraFormatado} - Chave Mestra:</b><br>
                    de <i style="opacity: 0.8;">${ativoVelho ? 'Ativada' : 'Desativada'}</i> para <span style="color: #10b981; font-weight: bold;">${ativoNovo ? 'Ativada' : 'Desativada'}</span>
                </div>
            `);
            totalMudancas++;
        }

        Object.keys(gradeNova).forEach(k => {
            const profNovo = gradeNova[k];
            const profVelho = gradeVelha[k];

            if (profNovo !== profVelho) {
                if (profVelho) {
                    profsRemovidos[profVelho] = (profsRemovidos[profVelho] || 0) + 1;
                    totalMudancas++;
                }
                profsAdicionados[profNovo] = (profsAdicionados[profNovo] || 0) + 1;
                totalMudancas++;
            }
        });

        Object.keys(gradeVelha).forEach(k => {
            if (!gradeNova[k]) {
                const profVelho = gradeVelha[k];
                profsRemovidos[profVelho] = (profsRemovidos[profVelho] || 0) + 1;
                totalMudancas++;
            }
        });
    });

    // Popula o extrato visual agregado por professor
    Object.keys(profsAdicionados).forEach(p => {
        mudancasVisual.push(`
            <div style="margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px dashed rgba(148, 163, 184, 0.3); color: var(--txt-padrao, #475569); font-size: 13px; line-height: 1.6;">
                • <b style="color: var(--cor-primaria, #2E8B57);">Aulas Atribuídas:</b><br>
                Professor <span style="color: #10b981; font-weight: bold;">${p}</span> (+${profsAdicionados[p]} slots)
            </div>
        `);
    });

    Object.keys(profsRemovidos).forEach(p => {
        mudancasVisual.push(`
            <div style="margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px dashed rgba(148, 163, 184, 0.3); color: var(--txt-padrao, #475569); font-size: 13px; line-height: 1.6;">
                • <b style="color: #dc3545;">Aulas Removidas:</b><br>
                Professor <i style="opacity: 0.8;">${p}</i> (-${profsRemovidos[p]} slots)
            </div>
        `);
    });

    if (totalMudancas === 0) {
        return showToast("Nenhuma alteração identificada na grade.", "info");
    }

    database.ref(`${raizBanco}/config/Horarios/Aulas`).set(carrinhoAulas).then(() => {
        configAulasGlobal = JSON.parse(JSON.stringify(carrinhoAulas));
        atualizarFiltroFantasma();
        
        let msgExtrato = `
            <div style="background: var(--bg-painel, #ffffff); border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.15); border-left: 6px solid #10b981; padding: 20px; width: 100%; text-align: left; position: relative;">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px;">
                    <i class="material-icons" style="color: #10b981; font-size: 24px;">check_circle</i>
                    <h4 style="margin: 0; color: var(--txt-titulo, #1e293b); font-size: 16px; font-weight: 800;">GRADE DE AULAS</h4>
                </div>
                <div style="max-height: 220px; overflow-y: auto; padding-right: 5px;">
                    ${mudancasVisual.join('')}
                </div>
                <div style="font-size: 11px; color: #94a3b8; text-align: right; margin-top: 10px; font-weight: 500;">
                    👆 Toque para fechar
                </div>
            </div>
        `;
        
        const tempoCalculado = 3000 + (mudancasVisual.length * 1500);
        showToast(msgExtrato, "premium", tempoCalculado);
         
    }).catch(err => {
        console.error("Erro ao salvar Grade de Aulas:", err);
        showToast("Erro ao gravar dados no banco.", "error");
    });
}



// ========================================================
// INOVAÇÃO COMPLETA: MÓDULO HORÁRIO DE DUPLAS (SSOT)
// ========================================================

function inicializarModuloDuplas() {
    Promise.all([
        database.ref(`${raizBanco}/config/Quadras`).once('value'),
        database.ref(`${raizBanco}/config/Horarios/Duplas`).once('value')
    ]).then(([snapQuadras, snapDuplas]) => {
        const quadrasObj = snapQuadras.val() || {};
        const qtdQuadras = quadrasObj.quantidade || 2;
        const nomesQuadras = quadrasObj.nomes || {};
        
        configDuplasGlobal = snapDuplas.val() || {};
        carrinhoDuplas = JSON.parse(JSON.stringify(configDuplasGlobal)); 

        renderizarAbasQuadrasDuplas(qtdQuadras, nomesQuadras);

    }).catch(err => {
        console.error("Erro ao carregar módulo de Duplas:", err);
        showToast("Erro ao sincronizar os dados de Duplas.", "error");
    });
}


function renderizarAbasQuadrasDuplas(qtd, nomes) {
    const containerPC = document.getElementById('duplas-tabs-quadras-desktop');
    if(containerPC) containerPC.innerHTML = '';
    let primeiraQuadra = '';

    for (let i = 1; i <= qtd; i++) {
        // Extração rica e segura do nome da quadra (suporta os novos objetos salvos ontem)
        const nomeDaQuadra = typeof nomes[i] === 'object' ? (nomes[i].nome || `Quadra ${i}`) : (nomes[i] || `Quadra ${i}`);
        const quadraKey = `Quadra${i}`;
        if (i === 1) primeiraQuadra = quadraKey;

        const btn = document.createElement('button');
        btn.className = 'quadra-pill';
        btn.id = `btn-dupla-${quadraKey}`;
        
        btn.textContent = `Quadra ${i}`;
        
        btn.onclick = () => selecionarQuadraDuplaConfig(quadraKey, nomeDaQuadra);
        
        if(containerPC) containerPC.appendChild(btn);
    }
    
    // 🛡️ LAPIDAÇÃO PREMIUM UX: Ajuste visual cirúrgico para 1 quadra
    const btnMapaDuplas = document.querySelector('#quadras-visao-duplas .container-titulo-central button');
    
    if (parseInt(qtd) === 1) {
        if(containerPC) containerPC.style.setProperty('display', 'none', 'important');
        if(btnMapaDuplas) btnMapaDuplas.style.setProperty('display', 'none', 'important');
    } else {
        if(containerPC) containerPC.style.removeProperty('display');
        if(btnMapaDuplas) btnMapaDuplas.style.removeProperty('display');
    }
    
    // Passagem protegida para a quadra inicial
    const nomeInicial = typeof nomes[1] === 'object' ? (nomes[1].nome || 'Quadra 1') : (nomes[1] || 'Quadra 1');
    selecionarQuadraDuplaConfig(primeiraQuadra, nomeInicial);
}



function selecionarQuadraDuplaConfig(quadraKey, nomeExibicao) {
    if (navigator.vibrate) navigator.vibrate(20);
    quadraDuplaAtual = quadraKey;

    document.querySelectorAll('#duplas-tabs-quadras-desktop .quadra-pill').forEach(btn => btn.classList.remove('ativa'));
    const btnAtivo = document.getElementById(`btn-dupla-${quadraKey}`);
    if (btnAtivo) btnAtivo.classList.add('ativa');

    const lblMobile = document.getElementById('lbl-quadra-titulo-duplas');
    if (lblMobile) {
        if (nomeExibicao) lblMobile.textContent = nomeExibicao;
        const containerTitulo = lblMobile.closest('.container-titulo-central') || lblMobile.parentElement;
        if (containerTitulo) {
            containerTitulo.onclick = () => abrirMapaUniversal('duplas');
        }
    }

    if (!carrinhoDuplas[quadraKey]) {
        carrinhoDuplas[quadraKey] = { Ativo: false, Grade: {} };
    }
	// 🛡️ GARANTIA DA PROPRIEDADE: Se a quadra veio do Firebase sem a caixinha Grade, injeta ela vazia para evitar o erro de undefined no clique
    if (!carrinhoDuplas[quadraKey].Grade) {
        carrinhoDuplas[quadraKey].Grade = {};
    }

    document.getElementById('chk-duplas-ativas').checked = carrinhoDuplas[quadraKey].Ativo === true;
    
    renderizarGradeDuplas();
}

function toggleChaveMestraDuplas(isAtivo) {
    carrinhoDuplas[quadraDuplaAtual].Ativo = isAtivo;
    renderizarGradeDuplas();
}

function renderizarGradeDuplas() {
    const tbody = document.getElementById('tbodyGradeDuplas');
    tbody.innerHTML = '';
    const dadosQuadra = carrinhoDuplas[quadraDuplaAtual] || { Grade: {} };
    const grade = dadosQuadra.Grade || {};
    const isAtiva = dadosQuadra.Ativo;

    const tabelaScroll = document.querySelector('#quadras-visao-duplas .tabela-grade-scroll');
    if (tabelaScroll) {
        if (isAtiva) tabelaScroll.classList.remove('tabela-grade-desativada');
        else tabelaScroll.classList.add('tabela-grade-desativada');
    }

    for (let h = 6; h <= 22; h++) {
        const tr = document.createElement('tr');
        const txtHora = `<span class="time-part">${String(h).padStart(2,'0')}:00</span><span class="time-sep ="> - </span><span class="time-part">${String(h+1).padStart(2,'0')}:00</span>`;
        
        let tdHoraEsq = document.createElement('td');
        tdHoraEsq.className = 'horario-celula';
        tdHoraEsq.innerHTML = txtHora;
        tr.appendChild(tdHoraEsq);

        for (let d = 1; d <= 7; d++) {
            const td = document.createElement('td');
            const key = `${d}_${h}`;

            // 1. ESCUDO DO HORÁRIO PADRÃO (FUNCIONAMENTO DA ARENA)
            let bloqueadoPorHorario = false;
            if (typeof regrasHorariosSaaS !== 'undefined' && regrasHorariosSaaS[d]) {
                const regraDia = regrasHorariosSaaS[d];
                if (regraDia.status === 'fechado') {
                    td.className = 'celula-bloqueada-padrao'; // Salvaguarda
                    bloqueadoPorHorario = true;
                } else {
                    const inicio = parseInt(regraDia.abertura?.split(':')[0]) || 6;
                    const fim = parseInt(regraDia.fechamento?.split(':')[0]) || 23;
                    if (h < inicio || h >= fim) bloqueadoPorHorario = true;
                }
            }

            if (bloqueadoPorHorario) {
                td.className = 'celula-bloqueada-padrao';
            } else {
                // 2. INOVAÇÃO: ESCUDO ANTICONFLITO DA GRADE DE AULAS
                const aulaExistente = (configAulasGlobal[quadraDuplaAtual] && configAulasGlobal[quadraDuplaAtual].Grade) ? configAulasGlobal[quadraDuplaAtual].Grade[key] : null;

                if (aulaExistente) {
                    td.className = 'celula-bloqueada-padrao';
                    td.textContent = ''; 
                    td.style.cursor = 'not-allowed';
                    
                    // FORÇA O NAVEGADOR A ESCUTAR O CLICK EXCLUSIVAMENTE NESSA CÉLULA DE AULA
                    td.style.setProperty('pointer-events', 'auto', 'important');

                    td.onclick = () => {
                        if (navigator.vibrate) navigator.vibrate(30);
                        showToast(`Horário indisponível: Aula com o Professor ${aulaExistente}`, 'warning');
                    };
                } else {
                    // 3. ESTADO NORMAL DA CÉLULA (LIVRE OU ATIVA PARA DUPLAS)
                    if (grade[key] === true) {
                        td.className = 'celula-aula-atribuida'; 
                        td.style.backgroundColor = 'var(--bg-celula-dupla)'; 
                        td.style.color = 'var(--txt-celula-tabela)';
                        td.style.fontWeight = '700';
                        td.style.textAlign = 'center';
                        td.textContent = 'Dupla';
                    } else {
                        td.className = 'celula-livre';
                        td.style.backgroundColor = '';
                        td.textContent = '';
                    }

                    // CLIQUE DIRETO (TOGGLE LIGA/DESLIGA)
                    td.onclick = () => {
                        if (!carrinhoDuplas[quadraDuplaAtual].Ativo) return;
                        if (navigator.vibrate) navigator.vibrate(25);

                        // 🛡️ A LINHA MÁGICA: Recria a Grade vazia se o Firebase tiver apagado
                        if (!carrinhoDuplas[quadraDuplaAtual].Grade) carrinhoDuplas[quadraDuplaAtual].Grade = {};

                        if (carrinhoDuplas[quadraDuplaAtual].Grade[key] === true) {
                            delete carrinhoDuplas[quadraDuplaAtual].Grade[key];
                        } else {
                            carrinhoDuplas[quadraDuplaAtual].Grade[key] = true;
                        }
                        renderizarGradeDuplas();
                    };
                }
            }
            tr.appendChild(td);
        }
        
        let tdHoraDir = document.createElement('td');
        tdHoraDir.className = 'horario-celula';
        tdHoraDir.innerHTML = txtHora;
        tr.appendChild(tdHoraDir);

        tbody.appendChild(tr);
    }
}


function selecionarTudoDuplas() {
    if (!carrinhoDuplas[quadraDuplaAtual] || !carrinhoDuplas[quadraDuplaAtual].Ativo) return;
    
    // 🛡️ PROTEÇÃO: Recria a Grade para evitar o erro de 'undefined'
    if (!carrinhoDuplas[quadraDuplaAtual].Grade) carrinhoDuplas[quadraDuplaAtual].Grade = {};
    
    const tbody = document.getElementById('tbodyGradeDuplas');
    
    for (let r = 0; r < tbody.rows.length; r++) {
        const hora = r + 6;
        for (let d = 1; d <= 7; d++) {
            const td = tbody.rows[r].cells[d];
            if (td.classList.contains('celula-livre')) {
                const key = `${d}_${hora}`;
                carrinhoDuplas[quadraDuplaAtual].Grade[key] = true;
            }
        }
    }
    renderizarGradeDuplas();
}


function limparTudoDuplas() {
    if (!carrinhoDuplas[quadraDuplaAtual] || !carrinhoDuplas[quadraDuplaAtual].Ativo) return;
    carrinhoDuplas[quadraDuplaAtual].Grade = {};
    renderizarGradeDuplas();
}


/**
 * ========================================================
 * SALVAR NO FIREBASE COM EXTRATO DE DUPLAS PREMIUM
 * ========================================================
 */
function salvarGradeDuplasSaas() {
    if (navigator.vibrate) navigator.vibrate(50); //[cite: 5]

    const diasNome = { 1: 'Segunda-feira', 2: 'Terça-feira', 3: 'Quarta-feira', 4: 'Quinta-feira', 5: 'Sexta-feira', 6: 'Sábado', 7: 'Domingo' };
    let blocosHTML = [];
    let totalMudancas = 0;

    Object.keys(carrinhoDuplas).forEach(qKey => { //[cite: 5]
        const gradeNova = carrinhoDuplas[qKey].Grade || {}; //[cite: 5]
        const gradeVelha = (configDuplasGlobal[qKey] && configDuplasGlobal[qKey].Grade) ? configDuplasGlobal[qKey].Grade : {}; //[cite: 5]
        
        const ativoNovo = carrinhoDuplas[qKey].Ativo === true; //[cite: 5]
        const ativoVelho = (configDuplasGlobal[qKey] && configDuplasGlobal[qKey].Ativo === true); //[cite: 5]
        
        const nomeQuadraFormatado = qKey.replace('Quadra', 'Quadra '); //[cite: 5]
        let subMudancas = [];

        // 1. Monitora a mutação da chave mestra da quadra
        if (ativoNovo !== ativoVelho) {
            subMudancas.push(`• <b>Chave Mestra:</b> de <i>${ativoVelho ? 'Ativada' : 'Desativada'}</i> para <span style="color: #10b981; font-weight: bold;">${ativoNovo ? 'Ativada' : 'Desativada'}</span>`);
            totalMudancas++;
        }

        // 2. Varre a matriz de horários cronológicos para listar alteração por alteração
        for (let d = 1; d <= 7; d++) { //[cite: 5]
            for (let h = 6; h <= 22; h++) { //[cite: 5]
                const key = `${d}_${h}`; //[cite: 5]
                const vNovo = gradeNova[key] === true;
                const vVelho = gradeVelha[key] === true;

                if (vNovo !== vVelho) {
                    const diaTxt = diasNome[d];
                    const horaTxt = `${String(h).padStart(2, '0')}:00`;
                    
                    subMudancas.push(`• <b>${diaTxt} às ${horaTxt}:</b> de <i>${vVelho ? 'Dupla' : 'Livre'}</i> para <span style="color: #10b981; font-weight: bold;">${vNovo ? 'Dupla' : 'Livre'}</span>`);
                    totalMudancas++;
                }
            }
        }

        // 💎 O RETÂNGULO INTELIGENTE: Corta a linha superior do painel para injetar o nome da quadra
        if (subMudancas.length > 0) {
            blocosHTML.push(`
                <fieldset style="border: 1px solid rgba(148, 163, 184, 0.25); border-radius: 8px; padding: 0 12px 10px 12px; margin: 12px 0 4px 0; background: rgba(0, 0, 0, 0.02); text-align: left; box-sizing: border-box;">
                    <legend style="padding: 0 8px; font-size: 11px; font-weight: 900; color: #94a3b8; letter-spacing: 1.5px; text-transform: uppercase; text-align: center; margin: 0 auto;">
                        ${nomeQuadraFormatado}
                    </legend>
                    <div style="max-height: 120px; overflow-y: auto; padding-top: 8px; font-size: 13px; line-height: 1.6; color: var(--txt-padrao, #475569);">
                        ${subMudancas.join('<br>')}
                    </div>
                </fieldset>
            `);
        }
    });

    if (totalMudancas === 0) {
        return showToast("Nenhum parâmetro de duplas foi modificado.", "info");
    }

    // Gravação direta via set no nó de duplas utilizando o barramento mestre
    database.ref(`${raizBanco}/config/Horarios/Duplas`).set(carrinhoDuplas).then(() => { //[cite: 5]
        configDuplasGlobal = JSON.parse(JSON.stringify(carrinhoDuplas)); //[cite: 5]
        
        // 💎 O Toast Oficial no Padrão Ouro (Clean & Minimal)
        let msgExtrato = `
            <div style="background: var(--bg-painel, #ffffff); border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.15); border-left: 6px solid #10b981; padding: 20px; width: 100%; text-align: left; position: relative; box-sizing: border-box;">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                    <i class="material-icons" style="color: #10b981; font-size: 24px;">check_circle</i>
                    <h4 style="margin: 0; color: var(--txt-titulo, #1e293b); font-size: 16px; font-weight: 800; letter-spacing: 0.3px;">HORÁRIO DE DUPLAS</h4>
                </div>
                <div style="max-height: 240px; overflow-y: auto; padding-right: 5px;">
                    ${blocosHTML.join('')}
                </div>
                <div style="font-size: 11px; color: #94a3b8; text-align: right; margin-top: 12px; font-weight: 500;">
                    👆 Toque para fechar
                </div>
            </div>
        `;
        
        // Métrica de tempo dinâmica baseada no volume de dados alterados
        const tempoCalculado = 3000 + (totalMudancas * 1000);
        showToast(msgExtrato, "premium", tempoCalculado); //[cite: 4]
        
    }).catch(err => {
        console.error("Erro ao salvar Grade de Duplas:", err); //[cite: 5]
        showToast("Erro ao gravar dados de duplas no banco.", "error"); //[cite: 5]
    });
}


// ========================================================
// INOVAÇÃO COMPLETA: MÓDULO HORÁRIO DE CONVIDADOS (SSOT)
// ========================================================

function inicializarModuloConvidados() {
    Promise.all([
        database.ref(`${raizBanco}/config/Quadras`).once('value'),
        database.ref(`${raizBanco}/config/Horarios/Convidados`).once('value')
    ]).then(([snapQuadras, snapConvidados]) => {
        const quadrasObj = snapQuadras.val() || {};
        const qtdQuadras = quadrasObj.quantidade || 2;
        const nomesQuadras = quadrasObj.nomes || {};

        configConvidadosGlobal = snapConvidados.val() || {};
        carrinhoConvidados = JSON.parse(JSON.stringify(configConvidadosGlobal));

        // Popula os parâmetros financeiros gerais nas caixas de input automaticamente
        document.getElementById('txt-taxa-convidado').value = configConvidadosGlobal.Taxa || '';
        document.getElementById('txt-chave-pix-convidado').value = configConvidadosGlobal.ChavePix || '';
        document.getElementById('txt-whatsapp-convidado').value = configConvidadosGlobal.Whatsapp || '';
        
        const selectRecebedor = document.getElementById('select-recebedor-convidado');
        if (selectRecebedor) {
            selectRecebedor.innerHTML = '<option value="Arena">Secretaria / Arena</option>';
            if (configConvidadosGlobal.Recebedor && configConvidadosGlobal.Recebedor !== 'Arena') {
                const opt = document.createElement('option');
                opt.value = configConvidadosGlobal.Recebedor;
                opt.textContent = configConvidadosGlobal.Recebedor;
                selectRecebedor.appendChild(opt);
            }
            selectRecebedor.value = configConvidadosGlobal.Recebedor || 'Arena';
        }

        // Renderiza os botões e a grade inicial pacificamente
        renderizarAbasQuadrasConvidados(qtdQuadras, nomesQuadras);

    }).catch(err => {
        console.error("Erro ao carregar módulo de Convidados:", err);
        showToast("Erro ao sincronizar os dados de Convidados.", "error");
    });
}



function renderizarAbasQuadrasConvidados(qtd, nomes) {
    const containerPC = document.getElementById('convidados-tabs-quadras-desktop');
    if (containerPC) containerPC.innerHTML = '';
    let primeiraQuadra = '';

    for (let i = 1; i <= qtd; i++) {
        // Extração rica e segura do nome da quadra
        const nomeDaQuadra = typeof nomes[i] === 'object' ? (nomes[i].nome || `Quadra ${i}`) : (nomes[i] || `Quadra ${i}`);
        const quadraKey = `Quadra${i}`;
        if (i === 1) primeiraQuadra = quadraKey;

        const btn = document.createElement('button');
        btn.className = 'quadra-pill';
        btn.id = `btn-convidado-${quadraKey}`;
        btn.textContent = `Quadra ${i}`;
        btn.onclick = () => selecionarQuadraConvidadosConfig(quadraKey, nomeDaQuadra);
        
        if (containerPC) containerPC.appendChild(btn);
    }
    
    // 🛡️ LAPIDAÇÃO PREMIUM UX: Ajuste visual cirúrgico para 1 quadra
    const btnMapaConvidados = document.querySelector('#quadras-visao-convidados .container-titulo-central button');
    
    if (parseInt(qtd) === 1) {
        if(containerPC) containerPC.style.setProperty('display', 'none', 'important');
        if(btnMapaConvidados) btnMapaConvidados.style.setProperty('display', 'none', 'important');
    } else {
        if(containerPC) containerPC.style.removeProperty('display');
        if(btnMapaConvidados) btnMapaConvidados.style.removeProperty('display');
    }
    
    // Passagem protegida para a quadra inicial
    const nomeInicial = typeof nomes[1] === 'object' ? (nomes[1].nome || 'Quadra 1') : (nomes[1] || 'Quadra 1');
    selecionarQuadraConvidadosConfig(primeiraQuadra, nomeInicial);
}


function selecionarQuadraConvidadosConfig(quadraKey, nomeExibicao) {
    if (navigator.vibrate) navigator.vibrate(20);
    quadraConvidadosAtual = quadraKey;

    document.querySelectorAll('#convidados-tabs-quadras-desktop .quadra-pill').forEach(btn => btn.classList.remove('ativa'));
    const btnAtivo = document.getElementById(`btn-convidado-${quadraKey}`);
    if (btnAtivo) btnAtivo.classList.add('ativa');

    const lblMobile = document.getElementById('lbl-quadra-titulo-convidados');
    if (lblMobile) {
        if (nomeExibicao) lblMobile.textContent = nomeExibicao;
        const containerTitulo = lblMobile.closest('.container-titulo-central') || lblMobile.parentElement;
        if (containerTitulo) {
            containerTitulo.onclick = () => abrirMapaUniversal('convidados');
        }
    }

    if (!carrinhoConvidados[quadraKey]) {
        carrinhoConvidados[quadraKey] = { Ativo: false, Grade: {} };
    }

    document.getElementById('chk-convidados-ativos').checked = carrinhoConvidados[quadraKey].Ativo === true;
    
    renderizarGradeConvidados();
}

function toggleChaveMestraConvidados(isAtivo) {
    if (!carrinhoConvidados[quadraConvidadosAtual]) {
        carrinhoConvidados[quadraConvidadosAtual] = { Ativo: false, Grade: {} };
    }
    carrinhoConvidados[quadraConvidadosAtual].Ativo = isAtivo;
    renderizarGradeConvidados();
}

function toggleGavetaTaxasConvidados() {
    const gaveta = document.getElementById('gaveta-taxas-convidados');
    if (!gaveta) return;
    if (gaveta.style.display === 'none') {
        gaveta.style.display = 'block';
    } else {
        gaveta.style.display = 'none';
    }
}

/* Restante das funções auxiliares mantidas intactas */
function mascaraMoedaRealSaaS(el) {
    let valor = el.value.replace(/\D/g, "");
    valor = (valor / 100).toFixed(2) + "";
    valor = valor.replace(".", ",");
    valor = valor.replace(/(\d)(\d{3})(\d{3}),/g, "$1.$2.$3,");
    valor = valor.replace(/(\d)(\d{3}),/g, "$1.$2,");
    el.value = valor === "0,00" ? "" : valor;
}

function mascaraTelefoneSaaS(el) {
    let valor = el.value.replace(/\D/g, "");
    if (valor.length > 11) valor = valor.substring(0, 11);
    if (valor.length > 10) {
        valor = valor.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
    } else if (valor.length > 5) {
        valor = valor.replace(/^(\d{2})(\d{4})(\d{0,4})$/, "($1) $2-$3");
    } else if (valor.length > 2) {
        valor = valor.replace(/^(\d{2})(\d{0,5})$/, "($1) $2");
    } else if (valor.length > 0) {
        valor = valor.replace(/^(\d*)$/, "($1");
    }
    el.value = valor;
}

function renderizarGradeConvidados() {
    const tbody = document.getElementById('tbodyGradeConvidados');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    const dadosQuadra = carrinhoConvidados[quadraConvidadosAtual] || { Grade: {} };
    const grade = dadosQuadra.Grade || {};
    const isAtiva = dadosQuadra.Ativo;

    const tabelaScroll = document.querySelector('#quadras-visao-convidados .tabela-grade-scroll');
    if (tabelaScroll) {
        if (isAtiva) tabelaScroll.classList.remove('tabela-grade-desativada');
        else tabelaScroll.classList.add('tabela-grade-desativada');
    }

    for (let h = 6; h <= 22; h++) {
        const tr = document.createElement('tr');
        const txtHora = `<span class="time-part">${String(h).padStart(2,'0')}:00</span><span class="time-sep"> - </span><span class="time-part">${String(h+1).padStart(2,'0')}:00</span>`;
        
        let tdHoraEsq = document.createElement('td');
        tdHoraEsq.className = 'horario-celula';
        tdHoraEsq.innerHTML = txtHora;
        tr.appendChild(tdHoraEsq);

        for (let d = 1; d <= 7; d++) {
            const td = document.createElement('td');
            const key = `${d}_${h}`;

            // 1. ESCUDO DO HORÁRIO PADRÃO (FUNCIONAMENTO DA ARENA)
            let bloqueadoPorHorario = false;
            if (typeof regrasHorariosSaaS !== 'undefined' && regrasHorariosSaaS[d]) {
                const regraDia = regrasHorariosSaaS[d];
                if (regraDia.status === 'fechado') {
                    bloqueadoPorHorario = true;
                } else {
                    const inicio = parseInt(regraDia.abertura?.split(':')[0]) || 6;
                    const fim = parseInt(regraDia.fechamento?.split(':')[0]) || 23;
                    if (h < inicio || h >= fim) bloqueadoPorHorario = true;
                }
            }

            if (bloqueadoPorHorario) {
                td.className = 'celula-bloqueada-padrao';
            } else {
                // 2. ESCUDO ANTICONFLITO DA GRADE DE AULAS
                const aulaExistente = (configAulasGlobal[quadraConvidadosAtual] && configAulasGlobal[quadraConvidadosAtual].Grade) ? configAulasGlobal[quadraConvidadosAtual].Grade[key] : null;
                
                // 3. ESCUDO ANTICONFLITO DE TREINO DE DUPLAS
                const duplaExistente = (configDuplasGlobal[quadraConvidadosAtual] && configDuplasGlobal[quadraConvidadosAtual].Grade && configDuplasGlobal[quadraConvidadosAtual].Grade[key] === true);

                if (aulaExistente) {
                    td.className = 'celula-bloqueada-padrao';
                    td.textContent = ''; 
                    td.style.cursor = 'not-allowed';
                    td.style.setProperty('pointer-events', 'auto', 'important');
                    td.onclick = () => {
                        if (navigator.vibrate) navigator.vibrate(30);
                        showToast(`Horário indisponível: Aula com o Professor ${aulaExistente}`, 'warning');
                    };
                } else if (duplaExistente) {
                    td.className = 'celula-bloqueada-padrao';
                    td.textContent = ''; 
                    td.style.cursor = 'not-allowed';
                    td.style.setProperty('pointer-events', 'auto', 'important');
                    td.onclick = () => {
                        if (navigator.vibrate) navigator.vibrate(30);
                        showToast(`Horário indisponível: Reservado para Treino de Duplas`, 'warning');
                    };
                } else {
                    // 4. ESTADO NORMAL DA CÉLULA (LIVRE OU "EXCETO" TRAVADO)
                    if (grade[key] === true) {
                        td.className = 'celula-aula-atribuida'; 
                        td.style.backgroundColor = '#ef4444'; 
                        td.style.color = '#ffffff';
                        td.style.fontWeight = '700';
                        td.style.textAlign = 'center';
                        td.textContent = 'exceto';
                    } else {
                        td.className = 'celula-livre';
                        td.style.backgroundColor = '';
                        td.textContent = '';
                    }

                    // CLIQUE DIRETO (TOGGLE LIGA/DESLIGA REGRA "EXCETO")
                    td.onclick = () => {
                        if (!carrinhoConvidados[quadraConvidadosAtual].Ativo) return;
                        if (navigator.vibrate) navigator.vibrate(25);

                        // 🛡️ A LINHA MÁGICA: Se a Grade não existe, recria ela vazia na memória antes de clicar!
                        if (!carrinhoConvidados[quadraConvidadosAtual].Grade) carrinhoConvidados[quadraConvidadosAtual].Grade = {};

                        if (carrinhoConvidados[quadraConvidadosAtual].Grade[key] === true) {
                            delete carrinhoConvidados[quadraConvidadosAtual].Grade[key];
                        } else {
                            carrinhoConvidados[quadraConvidadosAtual].Grade[key] = true;
                        }
                        renderizarGradeConvidados();
                    };
                }
            }
            tr.appendChild(td);
        }
        
        let tdHoraDir = document.createElement('td');
        tdHoraDir.className = 'horario-celula';
        tdHoraDir.innerHTML = txtHora;
        tr.appendChild(tdHoraDir);

        tbody.appendChild(tr);
    }
}



function selecionarTudoConvidados() {
    if (!carrinhoConvidados[quadraConvidadosAtual] || !carrinhoConvidados[quadraConvidadosAtual].Ativo) return;
    
    // 🛡️ PROTEÇÃO: Recria a Grade se o Firebase tiver apagado
    if (!carrinhoConvidados[quadraConvidadosAtual].Grade) carrinhoConvidados[quadraConvidadosAtual].Grade = {};
    
    const tbody = document.getElementById('tbodyGradeConvidados');
    if (!tbody) return;
    
    for (let r = 0; r < tbody.rows.length; r++) {
        const hora = r + 6;
        for (let d = 1; d <= 7; d++) {
            const td = tbody.rows[r].cells[d];
            if (td.classList.contains('celula-livre')) {
                const key = `${d}_${hora}`;
                carrinhoConvidados[quadraConvidadosAtual].Grade[key] = true;
            }
        }
    }
    renderizarGradeConvidados();
}

function limparTudoConvidados() {
    if (!carrinhoConvidados[quadraConvidadosAtual] || !carrinhoConvidados[quadraConvidadosAtual].Ativo) return;
    carrinhoConvidados[quadraConvidadosAtual].Grade = {};
    renderizarGradeConvidados();
}

/**
 * ========================================================
 * SALVAR NO FIREBASE COM EXTRATO DE CONVIDADOS PREMIUM
 * ========================================================
 */
function salvarGradeConvidadosSaas() {
    if (navigator.vibrate) navigator.vibrate(50);

    const diasNome = { 1: 'Segunda-feira', 2: 'Terça-feira', 3: 'Quarta-feira', 4: 'Quinta-feira', 5: 'Sexta-feira', 6: 'Sábado', 7: 'Domingo' };
    let blocosHTML = [];
    let totalMudancas = 0;

    // Captura os valores em tela antes de comparar
    const nTaxa = document.getElementById('txt-taxa-convidado').value;
    const nRecebedor = document.getElementById('select-recebedor-convidado').value;
    const nChavePix = document.getElementById('txt-chave-pix-convidado').value;
    const nWhatsapp = document.getElementById('txt-whatsapp-convidado').value;
	// Validação estrita do WhatsApp de Convidados (DDD + 9 dígitos)
    const whatsLimpo = nWhatsapp.replace(/\D/g, '');
    if (nWhatsapp.trim() !== "" && whatsLimpo.length !== 11) {
        return showToast("Digite um WhatsApp válido com DDD (ex: 41999998888).", "warning");
    }

    // Sincroniza os dados textuais para dentro do carrinho local
    carrinhoConvidados.Taxa = nTaxa;
    carrinhoConvidados.Recebedor = nRecebedor;
    carrinhoConvidados.ChavePix = nChavePix;
    carrinhoConvidados.Whatsapp = nWhatsapp;

    // --- 🛠️ Bloco A: Varre Alterações nos Inputs de Texto ---
    let subMeta = [];
    const verificarMeta = (label, vNovo, vVelho) => {
        if (vNovo !== vVelho) {
            subMeta.push(`• <b>${label}:</b> de <i>${vVelho || 'Vazio'}</i> para <span style="color: #10b981; font-weight: bold;">${vNovo || 'Vazio'}</span>`);
            totalMudancas++;
        }
    };

    verificarMeta('Taxa Unitária', nTaxa, configConvidadosGlobal.Taxa || '');
    verificarMeta('Recebedor Financeiro', nRecebedor, configConvidadosGlobal.Recebedor || '');
    verificarMeta('Chave PIX', nChavePix, configConvidadosGlobal.ChavePix || '');
    verificarMeta('WhatsApp Concierge', nWhatsapp, configConvidadosGlobal.Whatsapp || '');

    // Se houve mudança nos inputs, encapsula no retângulo de parâmetros gerais
    if (subMeta.length > 0) {
        blocosHTML.push(`
            <fieldset style="border: 1px solid rgba(148, 163, 184, 0.25); border-radius: 8px; padding: 0 12px 10px 12px; margin: 12px 0 4px 0; background: rgba(0, 0, 0, 0.02); text-align: left; box-sizing: border-box;">
                <legend style="padding: 0 8px; font-size: 11px; font-weight: 900; color: #94a3b8; letter-spacing: 1.5px; text-transform: uppercase; text-align: center; margin: 0 auto;">
                    Parâmetros Gerais
                </legend>
                <div style="max-height: 120px; overflow-y: auto; padding-top: 8px; font-size: 13px; line-height: 1.6; color: var(--txt-padrao, #475569);">
                    ${subMeta.join('<br>')}
                </div>
            </fieldset>
        `);
    }

    // --- 🏟️ Bloco B: Varre Alterações nas Grades Interativas ---
    Object.keys(carrinhoConvidados).forEach(qKey => {
        if (qKey.startsWith('Quadra')) {
            const gradeNova = carrinhoConvidados[qKey].Grade || {};
            const gradeVelha = (configConvidadosGlobal[qKey] && configConvidadosGlobal[qKey].Grade) ? configConvidadosGlobal[qKey].Grade : {};
            
            const ativoNovo = carrinhoConvidados[qKey].Ativo === true;
            const ativoVelho = (configConvidadosGlobal[qKey] && configConvidadosGlobal[qKey].Ativo === true);
            
            const nomeQuadraFormatado = qKey.replace('Quadra', 'Quadra ');
            let subMudancas = [];

            if (ativoNovo !== ativoVelho) {
                subMudancas.push(`• <b>Chave Mestra:</b> de <i>${ativoVelho ? 'Ativada' : 'Desativada'}</i> para <span style="color: #10b981; font-weight: bold;">${ativoNovo ? 'Ativada' : 'Desativada'}</span>`);
                totalMudancas++;
            }

            for (let d = 1; d <= 7; d++) {
                for (let h = 6; h <= 22; h++) {
                    const key = `${d}_${h}`;
                    const vNovo = gradeNova[key] === true;
                    const vVelho = gradeVelha[key] === true;

                    if (vNovo !== vVelho) {
                        const diaTxt = diasNome[d];
                        const horaTxt = `${String(h).padStart(2, '0')}:00`;
                        
                        subMudancas.push(`• <b>${diaTxt} às ${horaTxt}:</b> de <i>${vVelho ? 'Bloqueado' : 'Livre'}</i> para <span style="color: #10b981; font-weight: bold;">${vNovo ? 'Bloqueado' : 'Livre'}</span>`);
                        totalMudancas++;
                    }
                }
            }

            // 💎 O RETÂNGULO INTELIGENTE: Corta a linha superior para o nome da respectiva quadra
            if (subMudancas.length > 0) {
                blocosHTML.push(`
                    <fieldset style="border: 1px solid rgba(148, 163, 184, 0.25); border-radius: 8px; padding: 0 12px 10px 12px; margin: 15px 0 4px 0; background: rgba(0, 0, 0, 0.02); text-align: left; box-sizing: border-box;">
                        <legend style="padding: 0 8px; font-size: 11px; font-weight: 900; color: #94a3b8; letter-spacing: 1.5px; text-transform: uppercase; text-align: center; margin: 0 auto;">
                            ${nomeQuadraFormatado}
                        </legend>
                        <div style="max-height: 120px; overflow-y: auto; padding-top: 8px; font-size: 13px; line-height: 1.6; color: var(--txt-padrao, #475569);">
                            ${subMudancas.join('<br>')}
                        </div>
                    </fieldset>
                `);
            }
        }
    });

    if (totalMudancas === 0) {
        return showToast("Nenhum parâmetro de convidados foi alterado.", "info");
    }

    // Despacha o pacote unificado via set na rota dinâmica SaaS do Firebase
    database.ref(`${raizBanco}/config/Horarios/Convidados`).set(carrinhoConvidados).then(() => {
        configConvidadosGlobal = JSON.parse(JSON.stringify(carrinhoConvidados));

        // 💎 Renderização do Toast com suporte adaptativo total Claro/Escuro
        let msgExtrato = `
            <div style="background: var(--bg-painel, #ffffff); border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.15); border-left: 6px solid #10b981; padding: 20px; width: 100%; text-align: left; position: relative; box-sizing: border-box;">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                    <i class="material-icons" style="color: #10b981; font-size: 24px;">check_circle</i>
                    <h4 style="margin: 0; color: var(--txt-titulo, #1e293b); font-size: 16px; font-weight: 800; letter-spacing: 0.3px;">CONCIERGE DE CONVIDADOS</h4>
                </div>
                <div style="max-height: 240px; overflow-y: auto; padding-right: 5px;">
                    ${blocosHTML.join('')}
                </div>
                <div style="font-size: 11px; color: #94a3b8; text-align: right; margin-top: 12px; font-weight: 500;">
                    👆 Toque para fechar
                </div>
            </div>
        `;
        
        // Métrica de tempo dinâmica oficial
        const tempoCalculado = 3000 + (totalMudancas * 1000); 
        showToast(msgExtrato, "premium", tempoCalculado);

    }).catch(err => {
        console.error("Erro ao salvar Grade de Convidados:", err);
        showToast("Erro ao gravar dados de convidados no banco.", "error");
    });
}