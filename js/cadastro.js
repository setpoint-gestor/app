
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
// 4. RENDERIZAÇÃO DOS SÓCIOS
// ==========================================
function renderizarCardsJogadores() {
    const container = document.getElementById('cards-jogadores');
    if (!container) return;
    container.innerHTML = '';
    
    const busca = document.getElementById('busca-jogador').value.toLowerCase().trim();
    const filtroStatus = document.getElementById('filtro-status').value;
    const totalGeral = Object.keys(jogadoresGlobal).length;

    let arrJogadores = Object.keys(jogadoresGlobal).map(id => ({ id, dados: jogadoresGlobal[id] }));
    arrJogadores.sort((a, b) => (a.dados.nomeCompleto || "").localeCompare(b.dados.nomeCompleto || ""));

    let exibidos = 0;
    arrJogadores.forEach(jog => {
        const dados = jog.dados;
        const nomeReal = dados.nomeCompleto || "Sem Nome";
        const apelido = dados.apelido ? dados.apelido.toLowerCase() : "";
        const isAtivo = dados.ativo !== false; 

        if (filtroStatus === 'ativos' && !isAtivo) return;
        if (filtroStatus === 'inativos' && isAtivo) return;
        
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
                <div style="font-size: 13px; color: #7f8c8d; margin-bottom: 5px;">Aka: ${capitalizarNome(dados.apelido)}</div>
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
        txtContador.textContent = (busca !== "" || filtroStatus !== 'todos') ? `Mostrando ${exibidos} de ${totalGeral} sócios` : `${totalGeral} sócio(s) cadastrado(s)`;
    }
}

function filtrarCardsJogadores() { 
    renderizarCardsJogadores(); 
}

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
    document.getElementById('inp-classe-jog').value = "";
    
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
    document.getElementById('inp-classe-jog').value = dados.classe || "";
    
    document.querySelectorAll('input[name="perfisDinamicos"]').forEach(c => {
        c.checked = !!(dados.perfis && dados.perfis[c.value]);
    });
    
    document.getElementById('check-ativo-jog').style.display = 'block'; 
    document.getElementById('check-ativo-jog').checked = dados.ativo !== false;
    
    atualizarFaixaStatus();
    document.getElementById('modal-form-jogador').style.display = 'flex';
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

async function salvarJogador() {
    const nomeRaw = document.getElementById('inp-nome-jog').value.trim().toUpperCase(); 
    let apelidoRaw = document.getElementById('inp-apelido-jog').value.trim();
    const niver = document.getElementById('inp-niver-jog').value.trim(); 
    const whatsapp = document.getElementById('inp-whats-jog').value.trim();
    const email = document.getElementById('inp-email-jog').value.trim().toLowerCase(); 
    const socio = document.getElementById('inp-socio-jog').value;
    const classe = document.getElementById('inp-classe-jog').value; 
    const isAtivo = document.getElementById('check-ativo-jog').checked;

    if (!nomeRaw || !apelidoRaw || !whatsapp) {
        return showToast("Nome, Apelido e WhatsApp são obrigatórios.", 'warning');
    }
    
    apelidoRaw = apelidoRaw.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());

    const perfisObj = {};
    document.querySelectorAll('input[name="perfisDinamicos"]:checked').forEach(c => perfisObj[c.value] = true);
    
    const dadosSalvar = { 
        nomeCompleto: nomeRaw, 
        apelido: apelidoRaw, 
        socio, 
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
            showToast("Cadastro atualizado!", "success"); 
            fecharFormularioJogador(); 
        } catch(e) { 
            showToast("Erro ao atualizar.", "error"); 
        }
    } else {
        try { 
            await database.ref(refJogadores).push().set(dadosSalvar); 
            showToast("Jogador cadastrado!", "success"); 
            fecharFormularioJogador(); 
            document.getElementById('busca-jogador').value = ""; 
        } catch(e) { 
            showToast("Erro ao cadastrar.", "error"); 
        }
    }
}

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
