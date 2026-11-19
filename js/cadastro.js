
"use strict";

// ==========================================
// 1. VARIÁVEIS GLOBAIS DO MÓDULO DE CADASTRO
// ==========================================

let perfisConfigGlobal = {};
let listenersJogadoresAtivos = false;
let modoEdicao = false;
let confeteJaDisparado = false;

// ==========================================
// 2. INICIALIZAÇÃO DO MÓDULO AND ABAS
// ==========================================
function abrirModuloJogadores() {
    navegarApp('tela-sub-jogadores');     
    mudarAbaJogadores('consulta'); 
    ajustarTextosBotoesResponsivos(); // Ajusta os rótulos de acordo com o tamanho da tela

    if (!listenersJogadoresAtivos && raizBanco) {
        listenersJogadoresAtivos = true; 
        
        database.ref(`${raizBanco}/config/Perfis`).on('value', (snap) => {
            perfisConfigGlobal = snap.val() || {
                'Admin': { cor: '#dc3545', abreviacao: 'Admin' },
                'Professor': { cor: '#198754', abreviacao: 'Prof' },
                'Financeiro': { cor: '#007bff', abreviacao: 'Fin' }
            };
            renderizarCheckboxesPerfis();
            renderizarCardsJogadores();  
        });

        database.ref(`${raizBanco}/jogadores`).on('value', (snap) => {
            jogadoresGlobal = snap.val() || {};
            renderizarCardsJogadores();
            checarAniversariosDoDia();
        });
    }
}

function mudarAbaJogadores(abaId) {
    document.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.area-conteudo-jogadores').forEach(c => c.classList.remove('ativa'));
    
    if (abaId === 'consulta') {
        document.getElementById('btn-aba-consulta').classList.add('active');
        document.getElementById('conteudo-consulta').classList.add('ativa');
        
        // CORREÇÃO UX MOBILE: Auto-focus travado no celular para impedir o teclado invasivo
        if (window.innerWidth > 767) {
            document.getElementById('busca-jogador').focus();
        }

    } else if (abaId === 'aniversarios') {
        document.getElementById('btn-aba-aniversarios').classList.add('active');
        document.getElementById('conteudo-aniversarios').classList.add('ativa');
        renderizarAniversarios();
    }
}

/**
 * Filtro de Arquitetura de Conteúdo: Modifica cirurgicamente os rótulos dos botões 
 * para garantir o encaixe anatômico perfeito em telas de smartphones.
 */
function ajustarTextosBotoesResponsivos() {
    document.querySelectorAll('.pill-tabs .pill-btn').forEach(btn => {
        const texto = btn.textContent.trim();
        if (window.innerWidth <= 767) {
            if (texto.includes('Consulta')) btn.innerHTML = 'Consulta';
            if (texto.includes('Cadastro')) btn.innerHTML = 'Cadastro';
            if (texto.includes('Aniversários')) btn.innerHTML = 'Aniversários';
        } else {
            if (texto === 'Consulta') btn.innerHTML = '🔍 Consulta';
            if (texto === 'Cadastro') btn.innerHTML = '+ Novo Cadastro';
            if (texto === 'Aniversários') btn.innerHTML = '🎂 Aniversários';
        }
    });
}

function getCorDoPerfil(nomePerfil) {
    if (nomePerfil === 'Admin') return '#dc3545';
    if (perfisConfigGlobal[nomePerfil] && perfisConfigGlobal[nomePerfil].cor) return perfisConfigGlobal[nomePerfil].cor;
    return '#6c757d';
}

function getAbrevPerfil(nomePerfil) {
    if (perfisConfigGlobal[nomePerfil] && perfisConfigGlobal[nomePerfil].abreviacao) return perfisConfigGlobal[nomePerfil].abreviacao;
    return nomePerfil.substring(0, 5);
}

function capitalizarNome(str) {
    if (!str) return "";
    return str.toLowerCase().replace(/(?:^|\s)\S/g, function(a) { return a.toUpperCase(); });
}

function extrairIniciais(nome) {
    const partes = nome.trim().split(' ');
    if (partes.length === 1) return partes[0].substring(0, 2).toUpperCase();
    return (partes[0].charAt(0) + partes[partes.length - 1].charAt(0)).toUpperCase();
} 


// ==========================================
// 4. RENDERIZAÇÃO DOS SÓCIOS & FILTROS AVANÇADOS
// ==========================================

function renderizarCardsJogadores() {
    const container = document.getElementById('cards-jogadores');
    if (!container) return;
    container.innerHTML = '';
    
    // Assegura que o menu de perfis esteja alimentado com as opções do clube
    popularDropdownPerfisFiltroSaaS();

    const elBusca = document.getElementById('busca-jogador');
    const busca = elBusca ? elBusca.value.toLowerCase().trim() : "";
    
    const elStatus = document.getElementById('filtro-status');
    const filtroStatus = elStatus ? elStatus.value : 'todos';

    const elVinculo = document.getElementById('filtro-vinculo');
    const filtroVinculo = elVinculo ? elVinculo.value : 'todos';

    const elGenero = document.getElementById('filtro-genero');
    const filtroGenero = elGenero ? elGenero.value : 'todos';

    const elRankAtivo = document.getElementById('filtro-ranking-ativo');
    const filtroRankAtivo = elRankAtivo ? elRankAtivo.value : 'todos';

    const elRankClasse = document.getElementById('filtro-ranking-classe');
    const filtroRankClasse = elRankClasse ? elRankClasse.value : 'todas';

    const perfisMarcados = Array.from(document.querySelectorAll('#lista-perfis-dinamicos-filtro input[type="checkbox"]:checked')).map(c => c.value);

    const totalGeral = Object.keys(jogadoresGlobal).length;
    let arrJogadores = Object.keys(jogadoresGlobal).map(id => ({ id, dados: jogadoresGlobal[id] }));
    arrJogadores.sort((a, b) => (a.dados.nomeCompleto || "").localeCompare(b.dados.nomeCompleto || ""));

    let exibidos = 0;
    arrJogadores.forEach(jog => {
        const dados = jog.dados;
        const nomeReal = dados.nomeCompleto || "Sem Nome";
        const apelido = dados.apelido ? dados.apelido.toLowerCase() : "";
        const isAtivo = dados.ativo !== false; 

        // 1. Filtro de Status da Conta
        if (filtroStatus === 'ativos' && !isAtivo) return;
        if (filtroStatus === 'inativos' && isAtivo) return;

        // 2. Filtro de Vínculo no Clube
        if (filtroVinculo !== 'todos') {
            const vinculoAtleta = (dados.socio || 'titular').toLowerCase();
            if (vinculoAtleta !== filtroVinculo.toLowerCase()) return;
        }

        // 3. Filtro de Gênero
        if (filtroGenero !== 'todos') {
            const generoAtleta = (dados.genero || 'NAO_INFORMAR').toUpperCase();
            if (generoAtleta !== filtroGenero.toUpperCase()) return;
        }

        // 4. Filtro de Ranking (Chave de Inscrição e Classe)
        if (filtroRankAtivo === 'sim' && dados.participaRanking === false) return;
        if (filtroRankAtivo === 'nao' && dados.participaRanking !== false) return;

        if (filtroRankClasse !== 'todas') {
            if (dados.participaRanking === false) return;
            const classeAtleta = (dados.classe || '').toUpperCase();
            if (classeAtleta !== filtroRankClasse.toUpperCase()) return;
        }

        // 5. Filtro de Perfis Especiais (Exige todos os cargos selecionados)
        if (perfisMarcados.length > 0) {
            const temTodos = perfisMarcados.every(p => dados.perfis && dados.perfis[p] === true);
            if (!temTodos) return;
        }

        // 6. Filtro Textual (Nome Completo ou Apelido)
        if (busca !== "" && !nomeReal.toLowerCase().includes(busca) && !apelido.toLowerCase().includes(busca)) return;

        exibidos++;
        let badgesHtml = '';
        const corVinculo = dados.socio === 'visitante' ? '#f39c12' : '#3498db';
        badgesHtml += `<span class="badge" style="background-color: ${corVinculo}">${dados.socio === 'visitante' ? 'Staff' : (dados.socio ? capitalizarNome(dados.socio) : 'Sócio')}</span>`;

        if (dados.perfis) {
            Object.keys(dados.perfis).forEach(p => {
                if (dados.perfis[p] === true) badgesHtml += `<span class="badge" style="background-color: ${getCorDoPerfil(p)}">${getAbrevPerfil(p)}</span>`;
            });
        }

        const card = document.createElement('div');
        card.className = `player-card ${isAtivo ? '' : 'jogador-inativo'}`;
        const nomeEscapado = nomeReal.replace(/'/g, "\\'");

        card.innerHTML = `
            <div class="player-avatar">${extrairIniciais(nomeReal)}</div>
            <div class="player-info">
                <h4 class="player-name">${capitalizarNome(nomeReal)}</h4>
                <div style="font-size: 13px; color: #7f8c8d; margin-bottom: 5px;">Apelido: ${capitalizarNome(dados.apelido)}</div>
                <div class="player-badges">${badgesHtml}</div>
            </div>
            <div class="kebab-container">
                <button class="btn-kebab" onclick="toggleKebabMenu(event, '${jog.id}')"><i class="material-icons">more_vert</i></button>
                <div id="dropdown-${jog.id}" class="dropdown-kebab">
                    <button class="dropdown-item" onclick="event.stopPropagation(); acaoEditarKebab('${jog.id}')"><i class="material-icons" style="color: #3498db;">edit</i> Editar Dados</button>
                    <button class="dropdown-item" onclick="event.stopPropagation(); acaoBloquearKebab('${jog.id}')"><i class="material-icons" style="color: #f39c12;">${isAtivo ? 'block' : 'check_circle'}</i> ${isAtivo ? 'Bloquear Sócio' : 'Ativar Sócio'}</button>
                    <button class="dropdown-item" onclick="event.stopPropagation(); acaoWhatsAppKebab('${jog.id}')"><i class="material-icons" style="color: #27ae60;">chat</i> WhatsApp</button>
                    <button class="dropdown-item item-excluir" onclick="event.stopPropagation(); acaoExcluirKebab('${jog.id}', '${nomeEscapado}')"><i class="material-icons">delete</i> Excluir Conta</button>
                </div>
            </div>`;
        container.appendChild(card);
    });

    const txtContador = document.getElementById('txt-qtd-jogadores');
    if (txtContador) {
        const temFiltroAtivo = (busca !== "" || filtroStatus !== 'todos' || filtroVinculo !== 'todos' || filtroGenero !== 'todos' || filtroRankAtivo !== 'todos' || filtroRankClasse !== 'todas' || perfisMarcados.length > 0);
        txtContador.textContent = temFiltroAtivo ? `Mostrando ${exibidos} de ${totalGeral} sócios` : `${totalGeral} sócio(s) cadastrado(s)`;
    }
}

function filtrarCardsJogadores() { 
    renderizarCardsJogadores(); 
}

// Alterna abertura da gaveta de filtros e limpa automaticamente todos os critérios de busca
function toggleGavetaFiltrosCadastroSaaS(btn) {
    const drawer = document.getElementById('drawer-filtros-cadastro');
    if (!drawer) return;
    const isOpen = drawer.style.display === 'block';
    drawer.style.display = isOpen ? 'none' : 'block';
    if (btn) btn.classList.toggle('active', !isOpen);
    if (!isOpen) popularDropdownPerfisFiltroSaaS();

    limparTodosFiltrosPesquisaSaaS();
}

// Reseta todos os seletores, caixas de texto e checkboxes para o estado limpo original
function limparTodosFiltrosPesquisaSaaS() {
    const elBusca = document.getElementById('busca-jogador');
    const elStatus = document.getElementById('filtro-status');
    const elVinculo = document.getElementById('filtro-vinculo');
    const elGenero = document.getElementById('filtro-genero');
    const elRankAtivo = document.getElementById('filtro-ranking-ativo');
    const elRankClasse = document.getElementById('filtro-ranking-classe');

    if (elBusca) elBusca.value = '';
    if (elStatus) elStatus.value = 'ativos';
    if (elVinculo) elVinculo.value = 'todos';
    if (elGenero) elGenero.value = 'todos';
    if (elRankAtivo) elRankAtivo.value = 'todos';
    if (elRankClasse) {
        elRankClasse.value = 'todas';
        elRankClasse.disabled = false;
    }

    const containerPerfis = document.getElementById('container-multiselect-perfis');
    if (containerPerfis) containerPerfis.classList.remove('open');

    selecionarTodosPerfisFiltroSaaS(false);
}

// Abre/fecha a bandeja suspensa de perfis múltiplos
function toggleDropdownPerfisCadastroSaaS(event) {
    if (event) event.stopPropagation();
    const container = document.getElementById('container-multiselect-perfis');
    if (container) container.classList.toggle('open');
}

// Popula os checkboxes de perfis dinamicamente com base nas configurações da arena
function popularDropdownPerfisFiltroSaaS() {
    const containerFiltro = document.getElementById('lista-perfis-dinamicos-filtro');
    if (!containerFiltro || !perfisConfigGlobal) return;
    
    const chavesPerfis = Object.keys(perfisConfigGlobal);
    if (chavesPerfis.length === 0) return;
    
    const marcadosAntes = Array.from(containerFiltro.querySelectorAll('input:checked')).map(c => c.value);
    containerFiltro.innerHTML = '';
    chavesPerfis.forEach(nomePerfil => {
        const label = document.createElement('label');
        label.className = 'multiselect-item';
        const estaMarcado = marcadosAntes.includes(nomePerfil) ? 'checked' : '';
        label.innerHTML = `<input type="checkbox" value="${nomePerfil}" ${estaMarcado} onchange="atualizarResumoPerfisFiltroSaaS(); filtrarCardsJogadores();"> ${nomePerfil}`;
        containerFiltro.appendChild(label);
    });
    atualizarResumoPerfisFiltroSaaS();
}

// Atualiza o texto resumo no cabeçalho do dropdown de perfis
function atualizarResumoPerfisFiltroSaaS() {
    const container = document.getElementById('container-multiselect-perfis');
    if (!container) return;
    const checks = container.querySelectorAll('.multiselect-options-list input[type="checkbox"]:checked');
    const txtResumo = document.getElementById('txt-resumo-perfis');
    if (!txtResumo) return;

    if (checks.length === 0) {
        txtResumo.textContent = "Cargos: Qualquer um";
        txtResumo.style.fontWeight = "500";
        txtResumo.style.color = "";
    } else if (checks.length === 1) {
        txtResumo.textContent = `Cargo: ${checks[0].value}`;
        txtResumo.style.fontWeight = "700";
        txtResumo.style.color = "var(--cor-primaria, #28a745)";
    } else {
        const nomes = Array.from(checks).map(c => c.value);
        txtResumo.textContent = `Cargos: ${nomes.join(', ')}`;
        txtResumo.style.fontWeight = "700";
        txtResumo.style.color = "var(--cor-primaria, #28a745)";
    }
}

// Ações rápidas de Marcar Todos ou Limpar Perfis
function selecionarTodosPerfisFiltroSaaS(marcar) {
    const container = document.getElementById('container-multiselect-perfis');
    if (!container) return;
    const checks = container.querySelectorAll('.multiselect-options-list input[type="checkbox"]');
    checks.forEach(c => c.checked = marcar);
    atualizarResumoPerfisFiltroSaaS();
    filtrarCardsJogadores();
}

// Alternância inteligente do ranking (desativa a classe se a chave for 'não')
function tratarTrocaFiltroRankingSaaS(valor) {
    const selClasse = document.getElementById('filtro-ranking-classe');
    if (selClasse) {
        if (valor === 'nao') {
            selClasse.value = 'todas';
            selClasse.disabled = true;
        } else {
            selClasse.disabled = false;
        }
    }
    filtrarCardsJogadores();
}

// Fecha o dropdown múltiplo ao clicar fora dele
window.addEventListener('click', (e) => {
    const container = document.getElementById('container-multiselect-perfis');
    if (container && !container.contains(e.target)) {
        container.classList.remove('open');
    }
});

// ==========================================
// 5. INTERAÇÕES DO MENU 3 PONTINHOS (KEBAB)
// ==========================================
function toggleKebabMenu(event, id) {
    event.stopPropagation();
    const dropdown = document.getElementById(`dropdown-${id}`);
    const estaAtivo = dropdown.classList.contains('ativo');
    
    document.querySelectorAll('.dropdown-kebab').forEach(d => d.classList.remove('ativo'));
    
    if (!estaAtivo) {
        dropdown.classList.add('ativo');
    }
}

function acaoEditarKebab(id) { 
    if (jogadoresGlobal[id]) abrirFormularioEdicao(id, jogadoresGlobal[id]); 
}

function acaoBloquearKebab(id) { 
    if (jogadoresGlobal[id]) bloquearJogadorRapido(id, jogadoresGlobal[id].ativo !== false); 
}

function acaoWhatsAppKebab(id) { 
    if (jogadoresGlobal[id]) chamarWhatsAppJogador(jogadoresGlobal[id].whatsapp || ''); 
}

function acaoExcluirKebab(id, nomeReal) { 
    confirmarExclusaoJogador(id, nomeReal); 
}

function renderizarCheckboxesPerfis() {
    const container = document.getElementById('roles-grid-container');
    if (!container) return;
    
    container.innerHTML = '';
    Object.keys(perfisConfigGlobal).forEach(nomePerfil => {
        const label = document.createElement('label');
        label.innerHTML = `<input type="checkbox" name="perfisDinamicos" value="${nomePerfil}"> ${nomePerfil}`;
        container.appendChild(label);
    });
}

// Função auxiliar de alternância visual do ranking
function toggleCamposRankingSaaS(ativo) {
    const box = document.getElementById('container-campos-ranking-jog');
    if (box) {
        box.style.opacity = ativo ? '1' : '0.4';
        box.style.pointerEvents = ativo ? 'auto' : 'none';
    }
}

function abrirFormularioNovoJogador() {
    modoEdicao = false;
    document.getElementById('chave-edicao-jog').value = "";
    document.getElementById('inp-nome-jog').value = ""; 
    document.getElementById('inp-nome-jog').disabled = false;
    document.getElementById('inp-apelido-jog').value = ""; 
    document.getElementById('inp-niver-jog').value = "";
    document.getElementById('inp-whats-jog').value = ""; 
    document.getElementById('inp-email-jog').value = "";
    document.getElementById('inp-socio-jog').value = "titular"; 
    document.getElementById('inp-genero-jog').value = "NAO_INFORMAR";
    document.getElementById('check-participa-ranking-jog').checked = true;
    document.getElementById('inp-classe-jog').value = "";
    
    toggleCamposRankingSaaS(true);

    document.querySelectorAll('input[name="perfisDinamicos"]').forEach(c => c.checked = false);
    
    document.getElementById('check-ativo-jog').checked = true; 
    document.getElementById('check-ativo-jog').style.display = 'none'; 
    
    atualizarFaixaStatus();
    document.getElementById('modal-form-jogador').style.display = 'flex';
}

function abrirFormularioEdicao(idFirebase, dados) {
    modoEdicao = true;
    document.getElementById('chave-edicao-jog').value = idFirebase;
    document.getElementById('inp-nome-jog').value = dados.nomeCompleto || "";
    document.getElementById('inp-apelido-jog').value = dados.apelido || "";
    document.getElementById('inp-niver-jog').value = dados.niver || "";
    document.getElementById('inp-whats-jog').value = dados.whatsapp || "";
    document.getElementById('inp-email-jog').value = dados.email || "";
    document.getElementById('inp-socio-jog').value = dados.socio || "titular";
    document.getElementById('inp-genero-jog').value = dados.genero || "NAO_INFORMAR";
    
    const participaRanking = (dados.participaRanking !== false);
    document.getElementById('check-participa-ranking-jog').checked = participaRanking;
    document.getElementById('inp-classe-jog').value = dados.classe || "";
    
    toggleCamposRankingSaaS(participaRanking);

    document.querySelectorAll('input[name="perfisDinamicos"]').forEach(c => {
        c.checked = !!(dados.perfis && dados.perfis[c.value]);
    });
    
    document.getElementById('check-ativo-jog').style.display = 'block'; 
    document.getElementById('check-ativo-jog').checked = dados.ativo !== false;
    
    atualizarFaixaStatus();
    document.getElementById('modal-form-jogador').style.display = 'flex';
}


/* ======================================================== */
/* 🏆 AUXILIAR DE SINCRONIZAÇÃO AUTOMÁTICA COM O RANKING    */
/* ======================================================== */
async function sincronizarJogadorRankingSaaS(idJogador, dados) {
    if (!raizBanco || !idJogador) return;

    try {
        // 1. Busca configurações gerais do ranking
        const snapConfig = await database.ref(`${raizBanco}/config/ranking`).once('value');
        const configRanking = snapConfig.val() || {};
        const modoGenero = configRanking.divisaoGenero || 'separado';

        // 2. Determina a chave da tabela (ex: B_MASCULINO, B_FEMININO ou B_UNIFICADO)
        const classe = (dados.classe || 'A').toUpperCase();
        let generoKey = (dados.genero || 'MASCULINO').toUpperCase();
        if (generoKey === 'NAO_INFORMAR') generoKey = 'MASCULINO';

        const chaveTabela = (modoGenero === 'unificado') ? `${classe}_UNIFICADO` : `${classe}_${generoKey}`;
        const refTabelas = `${raizBanco}/ranking/tabelas`;

        // 3. Lê as tabelas atuais do banco
        const snapTabelas = await database.ref(refTabelas).once('value');
        const tabelasAtuais = snapTabelas.val() || {};

        let tabelasModificadas = false;

        // 4. Faxina: Se o atleta desativou o ranking ou mudou de classe/gênero, remove da tabela antiga
        Object.keys(tabelasAtuais).forEach(nomeTab => {
            if (Array.isArray(tabelasAtuais[nomeTab])) {
                const idx = tabelasAtuais[nomeTab].indexOf(idJogador);
                if (idx !== -1) {
                    if (!dados.participaRanking || nomeTab !== chaveTabela) {
                        tabelasAtuais[nomeTab].splice(idx, 1);
                        tabelasModificadas = true;
                    }
                }
            }
        });

        // 5. Atualiza o banco caso tenha havido remoção de categoria antiga
        if (tabelasModificadas) {
            await database.ref(refTabelas).set(tabelasAtuais);
        }

    } catch (e) {
        console.error("Erro ao sincronizar jogador no ranking:", e);
    }
}


async function salvarJogador() {
    const nomeRaw = document.getElementById('inp-nome-jog').value.trim().toUpperCase(); 
    let apelidoRaw = document.getElementById('inp-apelido-jog').value.trim();
    const niver = document.getElementById('inp-niver-jog').value.trim(); 
    const whatsapp = document.getElementById('inp-whats-jog').value.trim();
    const email = document.getElementById('inp-email-jog').value.trim().toLowerCase(); 
    const socio = document.getElementById('inp-socio-jog').value;
    const genero = document.getElementById('inp-genero-jog').value;
    const participaRanking = document.getElementById('check-participa-ranking-jog').checked;
    const classe = document.getElementById('inp-classe-jog').value; 
    const isAtivo = document.getElementById('check-ativo-jog').checked;

    const whatsLimpo = whatsapp.replace(/\D/g, '');

    if (!nomeRaw || !apelidoRaw || !whatsapp) {
        return showToast("Nome, Apelido e WhatsApp são obrigatórios.", 'warning');
    }

    if (whatsLimpo.length !== 11) {
        return showToast("Digite um WhatsApp do jogador válido com DDD (ex: 41999998888).", "warning");
    }
    
    apelidoRaw = apelidoRaw.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());

    const perfisObj = {};
    document.querySelectorAll('input[name="perfisDinamicos"]:checked').forEach(c => perfisObj[c.value] = true);
    
    const dadosSalvar = { 
        nomeCompleto: nomeRaw, 
        apelido: apelidoRaw, 
        socio, 
        genero,
        participaRanking,
        classe, 
        niver, 
        whatsapp, 
        email, 
        ativo: isAtivo, 
        perfis: perfisObj 
    };
    
    const refJogadores = `${raizBanco}/jogadores`;

    if (modoEdicao) {
        const idEdicao = document.getElementById('chave-edicao-jog').value;
        if (jogadoresGlobal[idEdicao] && jogadoresGlobal[idEdicao].senha) {
            dadosSalvar.senha = jogadoresGlobal[idEdicao].senha;
        }
        
        try { 
            await database.ref(`${refJogadores}/${idEdicao}`).update(dadosSalvar); 
            await sincronizarJogadorRankingSaaS(idEdicao, dadosSalvar);
            showToast("Cadastro atualizado!", "success"); 
            fecharFormularioJogador(); 
        } catch(e) { 
            showToast("Erro ao atualizar.", "error"); 
        }
    } else {
        try { 
            const novaRef = database.ref(refJogadores).push();
            await novaRef.set(dadosSalvar); 
            await sincronizarJogadorRankingSaaS(novaRef.key, dadosSalvar);
            showToast("Jogador cadastrado!", "success"); 
            fecharFormularioJogador(); 
            document.getElementById('busca-jogador').value = ""; 
        } catch(e) { 
            showToast("Erro ao cadastrar.", "error"); 
        }
    }
}


function fecharFormularioJogador() { 
    document.getElementById('modal-form-jogador').style.display = 'none'; 
}

function atualizarFaixaStatus() {
    const Counseling = document.getElementById('faixa-status-jog'); 
    const titulo = document.getElementById('titulo-form-jog'); 
    const isAtivo = document.getElementById('check-ativo-jog').checked;
    
    Counseling.className = isAtivo ? "faixa-status faixa-verde" : "faixa-status faixa-vermelha";
    titulo.textContent = modoEdicao ? (isAtivo ? "Editar Jogador (Ativo)" : "Editar Jogador (Inativo)") : "Novo Cadastro";
}

document.addEventListener('DOMContentLoaded', () => {
    const inpNiver = document.getElementById('inp-niver-jog'); 
    const inpWhats = document.getElementById('inp-whats-jog');
    
    if (inpNiver) { 
        inpNiver.addEventListener('input', function(e) { 
            let x = e.target.value.replace(/\D/g, '').match(/(\d{0,2})(\d{0,2})(\d{0,4})/); 
            e.target.value = !x[2] ? x[1] : x[1] + '/' + x[2] + (x[3] ? '/' + x[3] : ''); 
        }); 
    }
    
    if (inpWhats) { 
        inpWhats.addEventListener('input', function(e) { 
            let x = e.target.value.replace(/\D/g, '').match(/(\d{0,2})(\d{0,5})(\d{0,4})/); 
            e.target.value = !x[2] ? x[1] : '(' + x[1] + ') ' + x[2] + (x[3] ? '-' + x[3] : ''); 
        }); 
    }
});

async function bloquearJogadorRapido(id, statusAtual) { 
    try { 
        await database.ref(`${raizBanco}/jogadores/${id}`).update({ ativo: !statusAtual }); 
        showToast(`Status alterado com sucesso!`, 'success'); 
    } catch(e) { 
        showToast('Erro ao atualizar status.', 'error'); 
    } 
}

function chamarWhatsAppJogador(num) { 
    if (!num) return showToast('Sócio sem telefone.', 'warning'); 
    const limpo = num.replace(/\D/g, ''); 
    window.open(`https://wa.me/${limpo.startsWith('55') ? limpo : '55' + limpo}`, '_blank'); 
}

function confirmarExclusaoJogador(id, nome) { 
    showPrompt("Excluir Cadastro", `Deseja excluir permanentemente <b>${capitalizarNome(nome)}</b>?`, async () => { 
        try { 
            await database.ref(`${raizBanco}/jogadores/${id}`).remove(); 
            showToast("Jogador excluído.", "success"); 
        } catch(e) { 
            showToast("Erro ao excluir.", "error"); 
        } 
    }); 
}

function renderizarAniversarios() {
    const container = document.getElementById('lista-aniversarios'); 
    if (!container) return; 
    
    container.innerHTML = '';
    const filtroEl = document.getElementById('filtro-mes-niver'); 
    const mesFiltro = filtroEl ? parseInt(filtroEl.value) : 0; 
    const mesesStr = ["", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    
    let arrNivers = []; 
    Object.values(jogadoresGlobal).forEach(j => { 
        if (j.ativo !== false && j.niver && j.niver.length === 10) { 
            const [dia, mes] = j.niver.split('/'); 
            arrNivers.push({ 
                nome: capitalizarNome(j.nomeCompleto), 
                apelido: capitalizarNome(j.apelido), 
                dia: parseInt(dia), 
                mes: parseInt(mes) 
            }); 
        } 
    });
    
    if (mesFiltro !== 0) {
        arrNivers = arrNivers.filter(j => j.mes === mesFiltro);
    }
    
    if (arrNivers.length === 0) { 
        container.innerHTML = '<p style="text-align: center; color: #888;">Nenhum aniversariante.</p>'; 
        return; 
    }
    
    const grupos = {}; 
    arrNivers.forEach(j => { 
        if (!grupos[j.mes]) grupos[j.mes] = []; 
        grupos[j.mes].push(j); 
    });
    
    Object.keys(grupos).sort((a,b) => a - b).forEach(mes => {
        let divMes = `<div class="niver-group"><div class="niver-mes-titulo">${mesesStr[mes]}</div>`;
        grupos[mes].sort((a,b) => a.dia - b.dia).forEach(j => { 
            const ehHoje = (j.dia === new Date().getDate() && parseInt(mes) === (new Date().getMonth()+1)); 
            divMes += `<div class="niver-item ${ehHoje ? 'niver-hoje' : ''}"><div class="niver-dia">${String(j.dia).padStart(2,'0')}</div><div style="flex:1;"><div style="font-weight:bold;">${j.nome}${ehHoje ? '<span class="badge" style="background:#e74c3c; margin-left:10px;">🎉 Hoje!</span>' : ''}</div><div style="font-size:13px; color:#888;">${j.apelido}</div></div></div>`; 
        });
        container.innerHTML += divMes + '</div>';
    });
}

function checarAniversariosDoDia() { 
    if (confeteJaDisparado) return; 
    
    const d = String(new Date().getDate()).padStart(2, '0'); 
    const m = String(new Date().getMonth() + 1).padStart(2, '0'); 
    const hjStr = `${d}/${m}`; 
    
    if (Object.values(jogadoresGlobal).some(j => j.ativo !== false && j.niver && j.niver.startsWith(hjStr))) { 
        confeteJaDisparado = true; 
        dispararConfetes(); 
        showToast("🎉 Temos aniversariantes hoje!", "info"); 
    } 
}

function dispararConfetes() { 
    const duration = 3 * 1000; 
    const end = Date.now() + duration; 
    
    const interval = setInterval(() => { 
        if (Date.now() > end) return clearInterval(interval); 
        confetti({ 
            startVelocity: 30, 
            spread: 360, 
            ticks: 60, 
            zIndex: 20000, 
            origin: { x: Math.random() * 0.2 + 0.1, y: Math.random() - 0.2 } 
        }); 
        confetti({ 
            startVelocity: 30, 
            spread: 360, 
            ticks: 60, 
            zIndex: 20000, 
            origin: { x: Math.random() * 0.2 + 0.7, y: Math.random() - 0.2 } 
        }); 
    }, 250); 
}

// Escuta em tempo real o redimensionamento físico do dispositivo para alternar as strings dinamicamente
window.addEventListener('resize', () => {
    const telaCadastro = document.getElementById('tela-sub-jogadores');
    if (telaCadastro && telaCadastro.classList.contains('ativa')) {
        ajustarTextosBotoesResponsivos();
    }
});

// Universal close para os 3 pontinhos
window.addEventListener('click', () => {
    document.querySelectorAll('.dropdown-kebab').forEach(d => d.classList.remove('ativo'));
});


// ==========================================
// 6. INTEGRALIZAÇÃO E AUXILIARES DE PRESENÇA SAAS
// ==========================================
function obterDadosControlePresencaSaas(idOrName) {
    if (!jogadoresGlobal) {
        return { nome: idOrName, socio: "titular", isAdmin: false };
    }
    
    let atleta = jogadoresGlobal[idOrName];
    
    if (!atleta) {
        const arrKeys = Object.keys(jogadoresGlobal);
        const keyEncontrada = arrKeys.find(k => 
            jogadoresGlobal[k].nomeCompleto && 
            jogadoresGlobal[k].nomeCompleto.toUpperCase().trim() === idOrName.toUpperCase().trim()
        );
        if (keyEncontrada) {
            atleta = jogadoresGlobal[keyEncontrada];
        }
    }
    
    if (atleta) {
        return {
            nome: atleta.nomeCompleto || idOrName,
            socio: atleta.socio || "titular",
            isAdmin: !!(atleta.perfis && atleta.perfis["Admin"] === true)
        };
    }
    
    return { nome: idOrName, socio: "titular", isAdmin: false };
}

// ==========================================
// 7. AUTOEXCLUSÃO DE CONTA DO JOGADOR (LGPD & GOOGLE PLAY)
// ==========================================

/**
 * Inicia o fluxo protegido de autoexclusão da conta do jogador logado:
 * 1. Bloqueia se estiver em torneio/ranking em andamento (Fases 3 ou 4);
 * 2. Exige confirmação explícita digitando a palavra EXCLUIR;
 * 3. Cancela/ajusta reservas futuras, limpa rankings, registra auditoria no GitHub
 *    e remove definitivamente os dados pessoais do Firebase.
 */
function solicitarAutoExclusaoSocioSaaS() {
    if (navigator.vibrate) navigator.vibrate(30);

    const isGodMode = !!localStorage.getItem('god_mode_clube');
    if ((typeof isGestorLogado !== 'undefined' && isGestorLogado) || isGodMode) {
        showToast("A autoexclusão de atleta está disponível apenas para contas de jogadores.", "warning");
        return;
    }

    const idLogado = localStorage.getItem('jogadorLogadoId');
    const nomeLogado = (localStorage.getItem('jogadorLogadoNome') || '').trim();

    if (!idLogado || typeof raizBanco === 'undefined' || !raizBanco) {
        showToast("Nenhum atleta identificado na sessão.", "warning");
        return;
    }

    if (typeof fecharSheetPerfil === 'function') {
        fecharSheetPerfil();
    }

    // 1. Trava preventiva: verifica se o atleta está em torneio/ranking ativo em andamento (Fases 3 ou 4)
    const confRanking = (typeof configRegrasGlobal !== 'undefined' && configRegrasGlobal && configRegrasGlobal.ranking)
        ? configRegrasGlobal.ranking
        : {};
    const faseAtual = parseInt(confRanking.faseAtual, 10) || 1;
    const estaInscritoTorneio = !!(confRanking.inscritosConfirmados && confRanking.inscritosConfirmados[idLogado]);
    let estaNaTabelaAtiva = false;

    if (typeof rankingTabelasGlobal !== 'undefined' && rankingTabelasGlobal) {
        Object.values(rankingTabelasGlobal).forEach(listaIds => {
            if (Array.isArray(listaIds) && listaIds.includes(idLogado)) {
                estaNaTabelaAtiva = true;
            }
        });
    }

    if (confRanking.ativo === true && (faseAtual === 3 || faseAtual === 4) && (estaInscritoTorneio || estaNaTabelaAtiva)) {
        showPrompt(
            "Torneio em Andamento",
            "Você está participando de uma edição ativa do <b>Ranking/Torneio</b> em andamento.<br><br>Para não prejudicar as chaves dos demais atletas, solicite primeiro o seu desligamento da competição ao <b>Gestor</b> ou <b>Árbitro</b> antes de excluir sua conta.",
            () => {}
        );
        return;
    }

    const atletaObj = (typeof jogadoresGlobal !== 'undefined' && jogadoresGlobal && jogadoresGlobal[idLogado])
        ? jogadoresGlobal[idLogado]
        : {};
    const ehAssinantePro = (atletaObj.isPro === true || atletaObj.pro_ativo === true);

    const avisoProHtml = ehAssinantePro
        ? `<div style="background: #fffbeb; border: 1px solid #fde68a; color: #92400e; padding: 10px 12px; border-radius: 8px; font-size: 12.5px; line-height: 1.45; margin-bottom: 12px; text-align: left;">
               ⚠️ <b>Assinatura SetPoint PRO ativa:</b> Excluir sua conta remove seus dados deste clube, mas não cancela automaticamente a cobrança recorrente na <b>Google Play Store</b>. Lembre-se de cancelar a assinatura nas configurações da loja.
           </div>`
        : '';

    const corpoModalHtml = `
        <div style="text-align: left; font-size: 13.5px; color: #475569; line-height: 1.5;">
            <p style="margin: 0 0 10px 0;">
                Esta ação é <b>permanente e irreversível</b>. Ao prosseguir:
            </p>
            <ul style="margin: 0 0 12px 0; padding-left: 18px; font-size: 13px; color: #334155;">
                <li>Seus dados pessoais (nome, e-mail, telefone e notificações) serão apagados deste clube;</li>
                <li>Suas reservas futuras serão canceladas ou ajustadas conforme o quórum da quadra;</li>
                <li>Seu acesso será encerrado imediatamente.</li>
            </ul>
            ${avisoProHtml}
            <div style="background: #fef2f2; border: 1px dashed #fca5a5; padding: 10px 12px; border-radius: 8px;">
                <label for="inp-confirmar-autoexclusao" style="display: block; font-size: 12px; font-weight: 700; color: #991b1b; margin-bottom: 6px;">
                    Digite <span style="font-weight: 900; text-decoration: underline;">EXCLUIR</span> para confirmar:
                </label>
                <input type="text" id="inp-confirmar-autoexclusao" autocomplete="off" spellcheck="false"
                       placeholder="Digite EXCLUIR aqui"
                       style="width: 100%; box-sizing: border-box; padding: 9px 10px; border: 1px solid #fca5a5; border-radius: 6px; font-size: 14px; font-weight: 800; text-align: center; text-transform: uppercase; outline: none; color: #991b1b; background: #ffffff;">
            </div>
        </div>
    `;

    const restaurarBotaoPrompt = () => {
        const btnConfirm = document.getElementById('btnPromptConfirm');
        if (btnConfirm) {
            btnConfirm.disabled = false;
            btnConfirm.style.opacity = '';
            btnConfirm.style.cursor = '';
            btnConfirm.textContent = 'Confirmar';
        }
    };

    showPrompt(
        "Excluir Minha Conta",
        corpoModalHtml,
        async () => {
            restaurarBotaoPrompt();
            await executarAutoExclusaoSocioSaaS(idLogado, nomeLogado);
        },
        () => {
            restaurarBotaoPrompt();
        }
    );

    // Configura a trava de digitação no botão recém-clonado pelo showPrompt
    setTimeout(() => {
        const btnConfirm = document.getElementById('btnPromptConfirm');
        const inpConfirm = document.getElementById('inp-confirmar-autoexclusao');

        if (btnConfirm) {
            btnConfirm.textContent = 'Excluir Conta';
            btnConfirm.disabled = true;
            btnConfirm.style.opacity = '0.45';
            btnConfirm.style.cursor = 'not-allowed';
        }

        if (inpConfirm && btnConfirm) {
            inpConfirm.oninput = () => {
                const valido = inpConfirm.value.trim().toUpperCase() === 'EXCLUIR';
                btnConfirm.disabled = !valido;
                btnConfirm.style.opacity = valido ? '1' : '0.45';
                btnConfirm.style.cursor = valido ? 'pointer' : 'not-allowed';
            };
        }
    }, 20);
}

/**
 * Executa a exclusão atômica da conta do jogador, limpa reservas futuras,
 * registra o recibo de auditoria no GitHub e encerra a sessão local.
 */
async function executarAutoExclusaoSocioSaaS(idLogado, nomeFallback) {
    const toastAguarde = showToast("Excluindo conta e atualizando registros...", "info", 0);

    try {
        const snapJogador = await database.ref(`${raizBanco}/jogadores/${idLogado}`).once('value');
        const atleta = snapJogador.val() || (typeof jogadoresGlobal !== 'undefined' && jogadoresGlobal[idLogado]) || {};

        const nomeCompletoAtleta = (atleta.nomeCompleto || nomeFallback || "Atleta").trim();
        const apelidoAtleta = (atleta.apelido || nomeCompletoAtleta.split(' ')[0]).trim();
        const vinculoAtleta = atleta.socio || localStorage.getItem('jogadorLogadoSocio') || 'titular';

        const norm = (txt) => (txt || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-zA-Z0-9 ]/g, "")
            .replace(/\s+/g, " ")
            .trim()
            .toUpperCase();

        const normNomeCompleto = norm(nomeCompletoAtleta);
        const normApelido = norm(apelidoAtleta);

        const updates = {};
        const filaLogsAuditoria = [];
        const filaNotificacoesPush = [];

        let qtdReservasCanceladas = 0;
        let qtdReservasAjustadas = 0;

        // 1. Varredura de reservas futuras para cancelamento ou ajuste de quórum
        const snapReservas = await database.ref(`${raizBanco}/reservas`).once('value');
        const todasReservas = snapReservas.val() || {};

        const agora = new Date();
        const hojeYMD = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`;
        const horaAtual = agora.getHours();
        const diasSemana = ["", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"];

        Object.keys(todasReservas).forEach(quadraChave => {
            const slots = todasReservas[quadraChave] || {};
            const matchQ = quadraChave.match(/\d+/);
            const quadraIndex = matchQ ? `Quadra${matchQ[0]}` : "Quadra1";

            let nomeQuadraAmigavel = quadraChave;
            if (matchQ && typeof configQuadrasGlobal !== 'undefined' && configQuadrasGlobal && configQuadrasGlobal.nomes) {
                const dq = configQuadrasGlobal.nomes[matchQ[0]];
                if (dq) nomeQuadraAmigavel = typeof dq === 'object' ? (dq.nome || `Quadra ${matchQ[0]}`) : dq;
            }

            const configAula = (typeof configAulasGlobal !== 'undefined' && configAulasGlobal) ? configAulasGlobal[quadraIndex] : null;
            const aulaAtiva = !!(configAula && configAula.Ativo && configAula.Grade);

            Object.keys(slots).forEach(slotKey => {
                const r = slots[slotKey];
                if (!r || !r.dataCompleta || r.status === 'aula_cancelada') return;
                if (r.borda === undefined && parseInt(r.duracao, 10) === 2) return;
                if (r.tipo === 'aula' || r.tipo === 'manutencao') return;

                const duracao = parseInt(r.duracao, 10) || 1;
                const ehFutura = (r.dataCompleta > hojeYMD) || (r.dataCompleta === hojeYMD && (parseInt(r.hora, 10) + duracao > horaAtual));
                if (!ehFutura) return;

                const orgPuro = (r.organizador || "").replace(/\s*\(.*?\)\s*/g, "").trim();
                const orgNorm = norm(orgPuro);
                const souOrganizador = (normNomeCompleto && orgNorm === normNomeCompleto) || (normApelido && orgNorm === normApelido);

                const arrApelidos = (r.jogadores || "").split(',').map(s => s.trim()).filter(Boolean);
                const arrCompletos = (r.jogadores_completo || "").split(',').map(s => s.trim()).filter(Boolean);

                const souParticipante = arrCompletos.some(n => norm(n) === normNomeCompleto || (normApelido && norm(n) === normApelido)) ||
                                        arrApelidos.some(a => norm(a) === normNomeCompleto || (normApelido && norm(a) === normApelido));

                if (!souOrganizador && !souParticipante) return;

                const dia = parseInt(r.dia, 10);
                const hora = parseInt(r.hora, 10);
                const ehRanking = (r.isRanking === true || r.tipo === 'ranking');
                const formatData = r.dataCompleta.split('-').reverse().join('/');
                const hIniFmt = String(hora).padStart(2, '0') + ":00";
                const hFimFmt = String(hora + duracao).padStart(2, '0') + ":00";
                const quadraTexto = nomeQuadraAmigavel.toLowerCase().startsWith('quadra')
                    ? nomeQuadraAmigavel.toLowerCase()
                    : `quadra ${nomeQuadraAmigavel}`;

                const limparSlotsReserva = () => {
                    const slotsExcluidos = [{ quadra: quadraChave, dia, hora }];
                    const temAula1 = aulaAtiva && configAula.Grade[slotKey] && configAula.Grade[slotKey] !== "";
                    updates[`reservas/${quadraChave}/${slotKey}`] = temAula1 ? { status: 'aula_cancelada' } : null;

                    if (duracao === 2) {
                        const slotKey2 = `${dia}_${hora + 1}`;
                        const temAula2 = aulaAtiva && configAula.Grade[slotKey2] && configAula.Grade[slotKey2] !== "";
                        updates[`reservas/${quadraChave}/${slotKey2}`] = temAula2 ? { status: 'aula_cancelada' } : null;
                        slotsExcluidos.push({ quadra: quadraChave, dia, hora: hora + 1 });
                    }
                    return slotsExcluidos;
                };

                // Caso A: Organizador da reserva ou partida de Ranking 1x1 -> cancela a reserva inteira
                if (souOrganizador || ehRanking) {
                    const slotsExcluidos = limparSlotsReserva();
                    qtdReservasCanceladas++;

                    const confs = r.confirmacoes || {};
                    arrApelidos.forEach((ap, idx) => {
                        const comp = arrCompletos[idx] || ap;
                        if (norm(ap) === normApelido || norm(comp) === normNomeCompleto) return;

                        const idParceiro = Object.keys(jogadoresGlobal || {}).find(k => {
                            if (k === idLogado) return false;
                            const j = jogadoresGlobal[k];
                            return j && (norm(j.nomeCompleto) === norm(comp) || norm(j.apelido) === norm(ap));
                        });

                        if (idParceiro) {
                            const keyNotif = `remocao_jogador_${dia}_${hora}_${Date.now()}`;
                            updates[`jogadores/${idParceiro}/notificacoes/${keyNotif}`] = {
                                categoria: "remocao_jogador",
                                detalhe: `A partida do dia ${formatData}, das ${hIniFmt} às ${hFimFmt} na ${quadraTexto}, foi cancelada pois o organizador encerrou sua conta.`,
                                timestamp: Date.now()
                            };
                        }
                    });

                    filaNotificacoesPush.push({
                        reserva: { ...r, dia, hora },
                        organizador: nomeCompletoAtleta,
                        quadra: nomeQuadraAmigavel,
                        evento: "RESERVA_CANCELADA_ORG"
                    });

                    filaLogsAuditoria.push({
                        origem: "sistema",
                        timestamp: new Date().toISOString(),
                        dataLocal: new Date().toLocaleString('pt-BR'),
                        autor: `${nomeCompletoAtleta} (Autoexclusão pelo Usuário)`,
                        acao: "EXCLUSÃO_AGENDAMENTO",
                        motivo: "Reserva futura cancelada automaticamente devido à autoexclusão da conta do organizador.",
                        clube: typeof clubeAtivoId !== 'undefined' ? clubeAtivoId : "",
                        quadra: nomeQuadraAmigavel,
                        horario: `${hIniFmt} - ${hFimFmt}`,
                        duracao: duracao === 1 ? "1 Hora" : "2 Horas",
                        data: formatData,
                        statusNoMomentoDaExclusao: r.status || "confirmada",
                        organizadorDaReserva: r.organizador || nomeCompletoAtleta,
                        confirmacoes: confs,
                        jogadores: r.jogadores || "",
                        jogadores_completo: r.jogadores_completo || "",
                        slotsExcluidos: slotsExcluidos
                    });
                } else {
                    // Caso B: Participante em reserva de terceiro -> remove do elenco e reavalia quórum
                    const indicesManter = [];
                    arrApelidos.forEach((ap, idx) => {
                        const comp = arrCompletos[idx] || ap;
                        const ehEsteUsuario = (norm(ap) === normApelido) || (norm(comp) === normNomeCompleto);
                        if (!ehEsteUsuario) indicesManter.push(idx);
                    });

                    const novosApelidos = indicesManter.map(i => arrApelidos[i]);
                    const novosCompletos = indicesManter.map(i => arrCompletos[i] || arrApelidos[i]);

                    const novasConfs = {};
                    const confsAntigas = r.confirmacoes || {};
                    Object.keys(confsAntigas).forEach(k => {
                        if (norm(k) !== normApelido && norm(k) !== normNomeCompleto) {
                            novasConfs[k] = confsAntigas[k];
                        }
                    });

                    const isDuplaSlot = typeof configDuplasGlobal !== 'undefined' && configDuplasGlobal &&
                                        configDuplasGlobal[quadraIndex]?.Ativo &&
                                        configDuplasGlobal[quadraIndex]?.Grade?.[slotKey] === true;

                    let quorumExigido = 1;
                    if (isDuplaSlot) {
                        quorumExigido = 4;
                    } else if (typeof configRegrasGlobal !== 'undefined' && configRegrasGlobal) {
                        quorumExigido = (duracao === 1)
                            ? (configRegrasGlobal.Quorum1h !== undefined ? parseInt(configRegrasGlobal.Quorum1h, 10) : 1)
                            : (configRegrasGlobal.Quorum2h !== undefined ? parseInt(configRegrasGlobal.Quorum2h, 10) : 2);
                    }

                    const idOrg = Object.keys(jogadoresGlobal || {}).find(k => {
                        if (k === idLogado) return false;
                        const j = jogadoresGlobal[k];
                        return j && (norm(j.nomeCompleto) === orgNorm || norm(j.apelido) === orgNorm);
                    });

                    const nomeDia = diasSemana[dia] || "Dia";
                    const detalheTempo = `${nomeDia}, das ${hIniFmt} às ${hFimFmt} hs, na ${quadraTexto}`;

                    if (novosApelidos.length < quorumExigido) {
                        const slotsExcluidos = limparSlotsReserva();
                        qtdReservasCanceladas++;

                        if (idOrg) {
                            updates[`jogadores/${idOrg}/notificacoes/cancelado_quorum_${dia}_${hora}_${Date.now()}`] = {
                                categoria: "cancelado_quorum",
                                adversario: apelidoAtleta,
                                detalhe: detalheTempo,
                                timestamp: Date.now()
                            };
                        }

                        filaLogsAuditoria.push({
                            origem: "sistema",
                            timestamp: new Date().toISOString(),
                            dataLocal: new Date().toLocaleString('pt-BR'),
                            autor: `${nomeCompletoAtleta} (Autoexclusão pelo Usuário)`,
                            acao: "EXCLUSÃO_AGENDAMENTO",
                            motivo: `Reserva cancelada por falta de quórum após autoexclusão do participante ${apelidoAtleta}.`,
                            clube: typeof clubeAtivoId !== 'undefined' ? clubeAtivoId : "",
                            quadra: nomeQuadraAmigavel,
                            horario: `${hIniFmt} - ${hFimFmt}`,
                            duracao: duracao === 1 ? "1 Hora" : "2 Horas",
                            data: formatData,
                            statusNoMomentoDaExclusao: r.status || "pendente",
                            organizadorDaReserva: r.organizador || "Não Informado",
                            confirmacoes: confsAntigas,
                            jogadores: r.jogadores || "",
                            jogadores_completo: r.jogadores_completo || "",
                            slotsExcluidos: slotsExcluidos
                        });
                    } else {
                        qtdReservasAjustadas++;
                        const todosConfirmados = Object.values(novasConfs).every(v => v === true);
                        const rAtualizada = {
                            ...r,
                            jogadores: novosApelidos.join(', '),
                            jogadores_completo: novosCompletos.join(', '),
                            confirmacoes: novasConfs,
                            status: todosConfirmados ? 'confirmada' : 'pendente'
                        };
                        if (todosConfirmados) delete rAtualizada.expiraEm;

                        updates[`reservas/${quadraChave}/${slotKey}`] = rAtualizada;
                        if (duracao === 2) {
                            const rAtualizada2 = { ...rAtualizada, hora: hora + 1 };
                            delete rAtualizada2.borda;
                            updates[`reservas/${quadraChave}/${dia}_${hora + 1}`] = rAtualizada2;
                        }

                        if (idOrg) {
                            updates[`jogadores/${idOrg}/notificacoes/convite_recusado_${dia}_${hora}_${Date.now()}`] = {
                                categoria: "convite_recusado",
                                adversario: apelidoAtleta,
                                detalhe: detalheTempo,
                                timestamp: Date.now()
                            };
                        }
                    }
                }
            });
        });

        // 2. Limpeza de vínculos em convites, fila de espera e rankings gerais
        updates[`convites_ranking/pendentes/${idLogado}`] = null;
        updates[`config/ranking/inscritosConfirmados/${idLogado}`] = null;

        const confRank = (typeof configRegrasGlobal !== 'undefined' && configRegrasGlobal && configRegrasGlobal.ranking)
            ? configRegrasGlobal.ranking
            : {};
        if (confRank.filaEspera && typeof confRank.filaEspera === 'object') {
            Object.keys(confRank.filaEspera).forEach(cat => {
                if (confRank.filaEspera[cat] && confRank.filaEspera[cat][idLogado]) {
                    updates[`config/ranking/filaEspera/${cat}/${idLogado}`] = null;
                }
            });
        }

        if (typeof rankingTabelasGlobal !== 'undefined' && rankingTabelasGlobal) {
            Object.keys(rankingTabelasGlobal).forEach(cat => {
                if (Array.isArray(rankingTabelasGlobal[cat]) && rankingTabelasGlobal[cat].includes(idLogado)) {
                    updates[`ranking/tabelas/${cat}`] = rankingTabelasGlobal[cat].filter(id => id !== idLogado);
                }
            });
        }

        if (typeof rankingGeralGlobal !== 'undefined' && rankingGeralGlobal) {
            Object.keys(rankingGeralGlobal).forEach(cat => {
                if (Array.isArray(rankingGeralGlobal[cat]) && rankingGeralGlobal[cat].includes(idLogado)) {
                    updates[`ranking/ranking_geral/${cat}`] = rankingGeralGlobal[cat].filter(id => id !== idLogado);
                }
            });
        }

        if (typeof rankingPontosGeralGlobal !== 'undefined' && rankingPontosGeralGlobal) {
            Object.keys(rankingPontosGeralGlobal).forEach(cat => {
                if (rankingPontosGeralGlobal[cat] && rankingPontosGeralGlobal[cat][idLogado] !== undefined) {
                    updates[`ranking/pontos_geral/${cat}/${idLogado}`] = null;
                }
            });
        }

        // 3. Remoção da presença online e exclusão definitiva do cadastro pessoal
        updates[`usuariosOnline/${idLogado}`] = null;
        updates[`jogadores/${idLogado}`] = null;

        // Encerra e anonimiza a sessão ativa no log de acessos do dia
        if (typeof encerrarSessaoAcessoAtletaSaaS === 'function') {
            encerrarSessaoAcessoAtletaSaaS('Conta excluída pelo usuário', true);
        }

        // 4. Monta o recibo blindado de auditoria jurídica para o Gestor
        const plataformaAtual = (typeof detectarPlataformaAcessoSaaS === 'function')
            ? detectarPlataformaAcessoSaaS()
            : 'App SetPoint';
        const resumoReservasTxt = (qtdReservasCanceladas > 0 || qtdReservasAjustadas > 0)
            ? `Reservas futuras impactadas: ${qtdReservasCanceladas} cancelada(s), ${qtdReservasAjustadas} ajustada(s).`
            : 'Nenhuma reserva futura ativa no momento da exclusão.';

        const logAutoExclusao = {
            origem: "manual",
            timestamp: new Date().toISOString(),
            dataLocal: new Date().toLocaleString('pt-BR'),
            autor: `${nomeCompletoAtleta} (Autoexclusão pelo Usuário)`,
            acao: "EXCLUSÃO_CONTA",
            motivo: `O próprio usuário solicitou o encerramento permanente da conta e confirmou digitando "EXCLUIR" via ${plataformaAtual}. ${resumoReservasTxt}`,
            clube: typeof clubeAtivoId !== 'undefined' ? clubeAtivoId : "",
            quadra: "Cadastro de Atletas",
            horario: plataformaAtual,
            duracao: "Conta Encerrada",
            data: new Date().toLocaleDateString('pt-BR').replace(/\//g, '-'),
            statusNoMomentoDaExclusao: "conta_excluida",
            organizadorDaReserva: nomeCompletoAtleta,
            confirmacoes: { [apelidoAtleta]: true },
            jogadores: apelidoAtleta,
            jogadores_completo: `${nomeCompletoAtleta} (${vinculoAtleta})`,
            slotsExcluidos: []
        };

        filaLogsAuditoria.unshift(logAutoExclusao);

        // 5. Executa a gravação atômica no Firebase e envia os recibos ao GitHub
        await database.ref(raizBanco).update(updates);

        if (filaNotificacoesPush.length > 0 && typeof processarGatilhoPushSaaS === 'function') {
            filaNotificacoesPush.forEach(item => {
                processarGatilhoPushSaaS(item.reserva, item.organizador, item.quadra, item.evento);
            });
        }

        if (typeof enviarFilaLogsAoGitHubSaaS === 'function') {
            await enviarFilaLogsAoGitHubSaaS(filaLogsAuditoria);
        }

        // 6. Desliga radares, limpa memória local e redireciona para a tela inicial
        if (typeof desligarTodosRadaresSaaS === 'function') {
            desligarTodosRadaresSaaS();
        }

        localStorage.removeItem('jogadorLogadoId');
        localStorage.removeItem('jogadorLogadoNome');
        localStorage.removeItem('jogadorLogadoSocio');
        localStorage.removeItem('jogadorLogadoClasse');
        localStorage.removeItem('jogadorLogadoPerfis');
        localStorage.removeItem('setpoint_aparelho_fcm_token');
        localStorage.removeItem('setpoint_notificacoes_ativas');

        if (toastAguarde && typeof toastAguarde.fechar === 'function') {
            toastAguarde.fechar();
        }

        showToast("Sua conta e seus dados pessoais foram excluídos permanentemente.", "success", 4000);

        setTimeout(() => {
            window.location.href = window.location.pathname;
        }, 900);

    } catch (erro) {
        console.error("❌ [Autoexclusão SaaS] Falha ao excluir conta:", erro);
        if (toastAguarde && typeof toastAguarde.fechar === 'function') {
            toastAguarde.fechar();
        }
        showToast("Erro ao excluir a conta. Verifique sua conexão e tente novamente.", "error");
    }
}
