"use strict";

// ====================================================================
// MÓDULO: AGENDAMENTO E CRIAÇÃO DE RESERVAS (SaaS)
// Responsável pela captura de clique na célula, formulário de
// agendamento, validações (quórum, monopólio, duplas) e gravação.
// ====================================================================

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

    // 🏆 Interceptação Opção A: Exclusividade Total de Horário de Ranking
    const celClicada = document.getElementById(`cel-${hora}-${dia}`);
    if (celClicada && celClicada.classList.contains('celula-torneio')) {
        const confRanking = (configRegrasGlobal && configRegrasGlobal.ranking) ? configRegrasGlobal.ranking : {};
        const faseAtualRanking = parseInt(confRanking.faseAtual, 10) || 1;
        const modeloRanking = confRanking.calendario?.formatoTorneio || 'grupos';
        const emFaseDeJogos = (modeloRanking === 'grupos') ? (faseAtualRanking === 3 || faseAtualRanking === 4) : (faseAtualRanking === 3);

        const idLogado = localStorage.getItem('jogadorLogadoId');
        let perfisLogado = {};
        try { perfisLogado = JSON.parse(localStorage.getItem('jogadorLogadoPerfis') || '{}'); } catch(e) {}
        const isArbitroLogado = perfisLogado['Árbitro'] === true || perfisLogado['Arbitro'] === true;
        let estaInscrito = isGestorLogado || isArbitroLogado || !!(confRanking.inscritosConfirmados && confRanking.inscritosConfirmados[idLogado]);

        if (confRanking.ativo === false || !emFaseDeJogos || !estaInscrito) {
            showToast("Aviso: Este horário é exclusivo para partidas do Ranking.", "warning");
            return;
        }
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

    // ====================================================================
    // 🎭 MÓDULO INTELIGENTE: PERFIS ESPECIAIS (AULA / MANUTENÇÃO)
    // ====================================================================
    
    // 1. Identifica os perfis ativos do usuário logado
    const idLogadoParaPerfis = localStorage.getItem('jogadorLogadoId');
    let perfisLogadoEspeciais = {};
    if (isGestorLogado) {
        perfisLogadoEspeciais = { 'Admin': true }; // O Gestor herda poder de Admin para as lógicas
    } else {
        try { perfisLogadoEspeciais = JSON.parse(localStorage.getItem('jogadorLogadoPerfis') || '{}'); } catch(e) {}
    }

    const ehAdminOuGestor = isGestorLogado || perfisLogadoEspeciais['Admin'] === true;
    const ehProfessor = perfisLogadoEspeciais['Professor'] === true || perfisLogadoEspeciais['Prof'] === true;
    const ehManutencao = perfisLogadoEspeciais['Manutenção'] === true || perfisLogadoEspeciais['Manut'] === true;

    // 2. Verifica se o Professor tem permissão para dar aula NESTA quadra selecionada
    let temPermissaoAulaNaQuadraAtiva = false;
    let profResponsavelNaQuadra = "";
    
    let quadraParaFiltro = quadraSelecionadaSaaS || "Quadra 1";
    const matchFiltro = quadraParaFiltro.match(/\d+/);
    const chaveQuadraFiltro = matchFiltro ? `Quadra${matchFiltro[0]}` : "Quadra1";

    if (configAulasGlobal && configAulasGlobal[chaveQuadraFiltro]) {
        if (configAulasGlobal[chaveQuadraFiltro].Ativo === true) {
            profResponsavelNaQuadra = configAulasGlobal[chaveQuadraFiltro].Professor || "";
            const nomeLogado = (localStorage.getItem('jogadorLogadoNome') || '').trim();
            const apelidoLogado = (jogadoresGlobal && jogadoresGlobal[idLogadoParaPerfis] && jogadoresGlobal[idLogadoParaPerfis].apelido) ? jogadoresGlobal[idLogadoParaPerfis].apelido : nomeLogado;
            
            if (ehAdminOuGestor) {
                temPermissaoAulaNaQuadraAtiva = true;
            } else if (ehProfessor) {
                if (!profResponsavelNaQuadra || 
                    profResponsavelNaQuadra.toLowerCase() === apelidoLogado.toLowerCase() || 
                    profResponsavelNaQuadra.toLowerCase() === nomeLogado.toLowerCase()) {
                    temPermissaoAulaNaQuadraAtiva = true;
                }
            }
        }
    }

    // 3. Modifica a interface com base nos perfis detectados (SEM EMOJIS ERRADOS)
    const containerTipoReserva = document.getElementById('linha-tipo-reserva');
    const selectTipoReserva = document.getElementById('saas-tipo-reserva');

    if (containerTipoReserva && selectTipoReserva) {
        selectTipoReserva.innerHTML = ''; 

        let adicionouOpcoesEspeciais = false;

        // Sempre existe a opção de Jogo (Livre de emojis e textos adicionais)
        selectTipoReserva.innerHTML += '<option value="jogo">Jogo</option>';

        if (temPermissaoAulaNaQuadraAtiva || ehAdminOuGestor) {
            selectTipoReserva.innerHTML += '<option value="aula">Aula</option>';
            adicionouOpcoesEspeciais = true;
        }

        if (ehManutencao || ehAdminOuGestor) {
            selectTipoReserva.innerHTML += '<option value="manutencao">Manutenção</option>';
            adicionouOpcoesEspeciais = true;
        }

        // Se for um usuário comum, esconde totalmente o campo. Se for VIP, exibe.
        if (!adicionouOpcoesEspeciais) {
            containerTipoReserva.style.setProperty('display', 'none', 'important');
        } else {
            containerTipoReserva.style.setProperty('display', 'flex', 'important');
        }
        
        selectTipoReserva.value = "jogo";
        
        // Chamamos a função camaleão para garantir que os campos de baixo fiquem certos
        if (typeof alternarVisaoFormularioAgendamentoSaaS === 'function') {
            alternarVisaoFormularioAgendamentoSaaS();
        }
    }
  	
    // 🧠 GATILHO DA REGRA DE DURAÇÃO (SaaS): Lê o banco e controla a anatomia do campo
    if (campoDuracao) {
        const regraDuracao = (configRegrasGlobal && configRegrasGlobal.DuracaoPermitida) ? configRegrasGlobal.DuracaoPermitida : "1_2";
        const confRanking = (configRegrasGlobal && configRegrasGlobal.ranking) ? configRegrasGlobal.ranking : {};
        const faseAtualRanking = parseInt(confRanking.faseAtual, 10) || 1;
        const modeloRanking = confRanking.calendario?.formatoTorneio || 'grupos';

        // 🔒 Trava de Inscrição/Classificação: Exige estar inscrito e, no Mata-Mata (Fase 4), estar classificado
        const idLogado = localStorage.getItem('jogadorLogadoId');
        const dadosLogado = (typeof jogadoresGlobal !== 'undefined' && idLogado) ? jogadoresGlobal[idLogado] : null;

        let perfisLogado = {};
        try { perfisLogado = JSON.parse(localStorage.getItem('jogadorLogadoPerfis') || '{}'); } catch(e) {}
        const isArbitroLogado = perfisLogado['Árbitro'] === true || perfisLogado['Arbitro'] === true;

        let estaInscrito = isGestorLogado || isArbitroLogado || !!(confRanking.inscritosConfirmados && confRanking.inscritosConfirmados[idLogado]);

        // Na Fase 4 do modelo de Grupos (Mata-Mata), valida se o atleta está ativo na rodada atual
		const emMataMataDireto = (modeloRanking === 'grupos' && confRanking.grupos?.faseInicial === 'matamata');
		const emFaseMataMata = (modeloRanking === 'grupos' && ((emMataMataDireto && faseAtualRanking >= 3) || (!emMataMataDireto && faseAtualRanking >= 4)));

		if (estaInscrito && !isGestorLogado && !isArbitroLogado && emFaseMataMata && dadosLogado) {
            const modoGenero = confRanking.divisaoGenero || 'separado';
            let generoKey = (dadosLogado.genero || 'MASCULINO').toUpperCase(); 
            if (generoKey === 'NAO_INFORMAR') generoKey = 'MASCULINO';
            const classeKey = (dadosLogado.classe || 'B').toUpperCase();
            const chaveTabela = (modoGenero === 'unificado') ? `${classeKey}_UNIFICADO` : `${classeKey}_${generoKey}`;

            const dadosChaveCat = (typeof rankingChavesGlobal !== 'undefined' && rankingChavesGlobal) ? rankingChavesGlobal[chaveTabela] : null;
            const rodadaAtiva = (dadosChaveCat && dadosChaveCat.rodada1) ? dadosChaveCat.rodada1 : [];

            // Verifica se o atleta está presente em algum confronto da rodada ativa atual
            const estaAtivoNaRodada = rodadaAtiva.some(conf => conf.jogador1Id === idLogado || conf.jogador2Id === idLogado);

            if (!estaAtivoNaRodada) {
                estaInscrito = false; // Oculta a opção 'Ranking' para atletas eliminados em fases anteriores do Mata-Mata
            }
        }

        const emFaseDeJogos = (modeloRanking === 'grupos') ? (faseAtualRanking === 3 || faseAtualRanking === 4) : (faseAtualRanking === 3);
        const isRankingAtivo = confRanking.ativo !== false && emFaseDeJogos && estaInscrito;
        const valorAnterior = campoDuracao.value;
        
        // 1. Limpa o select
        campoDuracao.innerHTML = ''; 
        
        // 2. A opção de 1 Hora sempre é a base
        campoDuracao.innerHTML += '<option value="1">1 hora</option>';
        
        // 3. Libera 2 Horas se permitido pelas regras
        if (regraDuracao === "1_2") {
            campoDuracao.innerHTML += '<option value="2">2 horas</option>';
        }

        // 4. Libera a opção de Ranking apenas se estiver na fase de jogos
        if (isRankingAtivo) {
            campoDuracao.innerHTML += '<option value="ranking" id="opt-duracao-ranking">Ranking</option>';
        }

        // 5. Habilita ou trava o campo conforme opções disponíveis
        if (regraDuracao === "1_2" || isRankingAtivo) {
            campoDuracao.disabled = false;
            campoDuracao.style.appearance = '';
            campoDuracao.style.webkitAppearance = '';
        } else {
            campoDuracao.disabled = true;
            campoDuracao.style.appearance = 'none';
            campoDuracao.style.webkitAppearance = 'none';
        }
        
        // 6. Mantém o valor selecionado antes (se ainda existir) ou força 1 hora
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
    campoJogador1.innerHTML = '';

    if (isGestorLogado || perfisLogadoEspeciais['Admin'] === true) {
        // 🟢 MODO GESTOR E ADMIN: Campo destravado, ativo e clicável
        campoJogador1.disabled = false;
        campoJogador1.classList.add('saas-field-atleta');
        campoJogador1.style.backgroundColor = '#ffffff';
        campoJogador1.style.cursor = 'pointer';
        campoJogador1.style.opacity = '1';
        campoJogador1.dataset.modo = 'normal';

        const optDefault = document.createElement('option');
        optDefault.value = '';
        optDefault.textContent = 'Selecionar Atleta 1...'; 
        campoJogador1.appendChild(optDefault);

        if (typeof jogadoresGlobal !== 'undefined' && Object.keys(jogadoresGlobal).length > 0) {
            const atletasOrdenados = Object.keys(jogadoresGlobal)
                .map(id => ({ id: id, ...jogadoresGlobal[id] }))
                .sort((a, b) => {
                    const nomeA = (a.nomeCompleto || "").trim().toLowerCase();
                    const nomeB = (b.nomeCompleto || "").trim().toLowerCase();
                    return nomeA.localeCompare(nomeB, 'pt-BR'); 
                });

            atletasOrdenados.forEach(j => {
                if (j && j.ativo !== false) {
                    const opt = document.createElement('option');
                    opt.value = j.id; 
                    opt.textContent = formatarNomeJogador1GestorSaaS(j.nomeCompleto); 
                    campoJogador1.appendChild(opt);
                }
            });
        }
        
        if (isGestorLogado) {
            campoJogador1.value = ''; // O Gestor sempre começa com o seletor em branco
        } else {
            // O Admin começa com o próprio nome selecionado, mas com o campo destravado para editar
            const meuId = localStorage.getItem('jogadorLogadoId');
            if (meuId && campoJogador1.querySelector(`option[value="${meuId}"]`)) {
                campoJogador1.value = meuId;
            } else {
                campoJogador1.value = '';
            }
        }
    } else {
        // 🔒 MODO SÓCIO COMUM (Fica travado com o próprio nome e não clica)
        campoJogador1.disabled = true;
        campoJogador1.classList.remove('saas-field-atleta');
        campoJogador1.style.backgroundColor = '';
        campoJogador1.style.cursor = 'not-allowed';

        const nomeLogado = localStorage.getItem('jogadorLogadoNome') || "Sócio";
        const optUser = document.createElement('option');
        optUser.value = nomeLogado;

        let nomeLimpo = nomeLogado.replace(/\s*\(.*?\)\s*/g, "").trim();
        nomeLimpo = nomeLimpo.toLowerCase().replace(/(?:^|\s)\S/g, function(a) { return a.toUpperCase(); });

        const palavras = nomeLimpo.split(/\s+/);
        if (palavras.length > 2) {
            let nomeFinalJ1 = palavras[0];
            for (let i = 1; i < palavras.length - 1; i++) {
                if (['Da', 'De', 'Do', 'Dos', 'Das'].includes(palavras[i])) {
                    nomeFinalJ1 += " " + palavras[i].toLowerCase();
                } else {
                    nomeFinalJ1 += " " + palavras[i].charAt(0).toUpperCase();
                }
            }
            nomeFinalJ1 += " " + palavras[palavras.length - 1];
            optUser.textContent = nomeFinalJ1;
        } else {
            optUser.textContent = nomeLimpo;
        }

        campoJogador1.appendChild(optUser);
        campoJogador1.value = nomeLogado;
    }

    
		// --- FUNÇÃO INTERNA REATIVA: Sincronização Dinâmica de Horários e Duração ---
		const atualizarHorariosDisponiveisSaaS = () => {
			const diaSel = parseInt(campoDia.value) || 1;
			const valDuracao = campoDuracao ? campoDuracao.value : "1";
			const duracaoSel = parseInt(valDuracao, 10) || 1;
			
			// 🏆 Duração dinâmica do Ranking definida pelo Gestor (Padrão: 2h)
			const duracaoRankingConfig = (typeof configRegrasGlobal !== 'undefined' && 
										  configRegrasGlobal && configRegrasGlobal.ranking && 
										  configRegrasGlobal.ranking.duracaoPartida !== undefined) 
										  ? parseInt(configRegrasGlobal.ranking.duracaoPartida, 10) 
										  : 2;

			const duracaoReal = (valDuracao === 'ranking' || valDuracao === '3-piramide') ? duracaoRankingConfig : duracaoSel;
			
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

					// 💉 INJEÇÃO: Dupla só ocupa se preenchida; Torneio é exclusivo do Ranking
					const estaOcupada = celAtual.classList.contains('celula-ocupada') || 
										celAtual.classList.contains('celula-aula') || 
										celAtual.classList.contains('celula-manutencao') || 
										(celAtual.classList.contains('celula-dupla') && celAtual.textContent.trim() !== 'Dupla') || 
										(valDuracao !== 'ranking' && celAtual.classList.contains('celula-torneio')) ||
										(valDuracao === 'ranking' && celAtual.classList.contains('celula-torneio') && celAtual.textContent.trim() !== 'Ranking') ||
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
												celSeguinte.classList.contains('celula-manutencao') || 
												(celSeguinte.classList.contains('celula-dupla') && celSeguinte.textContent.trim() !== 'Dupla') || 
												(valDuracao !== 'ranking' && celSeguinte.classList.contains('celula-torneio')) ||
												(valDuracao === 'ranking' && celSeguinte.classList.contains('celula-torneio') && celSeguinte.textContent.trim() !== 'Ranking') ||
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
					celSeguinte.classList.contains('celula-manutencao') || 
					(celSeguinte.classList.contains('celula-dupla') && celSeguinte.textContent.trim() !== 'Dupla') || 
					(valDuracao !== 'ranking' && celSeguinte.classList.contains('celula-torneio')) ||
					(valDuracao === 'ranking' && celSeguinte.classList.contains('celula-torneio') && celSeguinte.textContent.trim() !== 'Ranking') ||
					celSeguinte.classList.contains('celula-bloqueada')
				) : true;

				const limiteFisicoExcedido = (horaFoco + duracaoReal > 23); // 🏆 Usa a duração real aqui
				const op2h = campoDuracao.querySelector('option[value="2"]');
				const opPiramide = campoDuracao.querySelector('option[value="3-piramide"]');
				const opRanking = campoDuracao.querySelector('option[value="ranking"]');
				
				const rankingExige2h = (duracaoRankingConfig === 2);

				const deveOcultarOpcoesLongas = (horarioBloqueadoPelaTabela !== null && horarioBloqueadoPelaTabela !== undefined)
					? (seguinteOcupada || limiteFisicoExcedido) 
					: (!existeSequenciaNoDia);                  

				if (deveOcultarOpcoesLongas) {
					if (op2h) op2h.style.display = 'none';
					if (opPiramide) opPiramide.style.display = 'none';
					if (opRanking && rankingExige2h) opRanking.style.display = 'none'; // Só oculta se exigir 2h
					
					if (campoDuracao.value === '2' || campoDuracao.value === '3-piramide' || (campoDuracao.value === 'ranking' && rankingExige2h)) {
						campoDuracao.value = '1';
						setTimeout(() => { atualizarHorariosDisponiveisSaaS(); }, 0);
					}
				} else {
					if (op2h) op2h.style.display = 'block';
					if (opRanking) opRanking.style.display = 'block';
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

			// 👥 Reavalia a permissão de convidados em todos os selects abertos
			if (typeof atualizarOpcoesConvidadosNosSelectsSaaS === 'function') {
				atualizarOpcoesConvidadosNosSelectsSaaS();
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
            aplicarFiltroRankingModalSaaS(); // 🏆 Gatilho do Módulo de Ranking
		};
		
		campoHora.onchange = atualizarHorariosDisponiveisSaaS;

	
        // --- Orquestração Inicial de Estados (Consolidado e Blindado) ---
        if (dia !== undefined && hora !== undefined) {
            // 🔒 MODO CELULA: Fixa os parâmetros vindos direto do clique
            horarioBloqueadoPelaTabela = parseInt(hora, 10);
            campoDia.value = dia;

            const celClicadaSmart = document.getElementById(`cel-${hora}-${dia}`);
            const ehTorneioSlot = celClicadaSmart && celClicadaSmart.classList.contains('celula-torneio');

            if (ehTorneioSlot && campoDuracao) {
                campoDuracao.value = "ranking";
                const op1h = campoDuracao.querySelector('option[value="1"]');
                const op2h = campoDuracao.querySelector('option[value="2"]');
                if (op1h) op1h.style.display = 'none';
                if (op2h) op2h.style.display = 'none';
                campoDuracao.disabled = true;

                const cTipo = document.getElementById('linha-tipo-reserva');
                if (cTipo) cTipo.style.setProperty('display', 'none', 'important');

                setTimeout(() => {
                    aplicarFiltroRankingModalSaaS();
                }, 0);
            } else if (campoDuracao) {
                campoDuracao.value = "1";
                const op1h = campoDuracao.querySelector('option[value="1"]');
                const op2h = campoDuracao.querySelector('option[value="2"]');
                if (op1h) op1h.style.display = '';
                if (op2h) op2h.style.display = '';
            }
            console.log("🔒 [Boot SaaS] Smart Lock Ativado. Hora Gravada na Memória:", horarioBloqueadoPelaTabela);
        } else {
            // ➕ MODO BOTÃO (+): Limpa completamente o passado para evitar memória fantasma
            horarioBloqueadoPelaTabela = null;
            if (campoDia.options.length > 0) {
                campoDia.selectedIndex = 0;
            }
            if (campoDuracao) {
                campoDuracao.value = "1";
                const op1h = campoDuracao.querySelector('option[value="1"]');
                const op2h = campoDuracao.querySelector('option[value="2"]');
                if (op1h) op1h.style.display = '';
                if (op2h) op2h.style.display = '';
            }
            if (campoHora) campoHora.value = "";
            console.log("➕ [Boot SaaS] Botão (+) Ativado. Memória de Horários Resetada.");
        }

        // Executa a carga inicial para desenhar o formulário com total inteligência
        atualizarHorariosDisponiveisSaaS();
        
        // Dispara a abertura do modal usando a engenharia nativa do core
        abrirModalConfig('modal-agendamento');
}


// ====================================================================
// 🎭 FUNÇÃO CAMALEÃO: ALTERNA OS CAMPOS BASEADO NO TIPO DE RESERVA
// ====================================================================
function alternarVisaoFormularioAgendamentoSaaS() {
    const selectTipo = document.getElementById('saas-tipo-reserva');
    if (!selectTipo) return;

    const tipoEscolhido = selectTipo.value;

    const linhaJogadores = document.getElementById('linha-jogadores-reserva');
    const linhaAula = document.getElementById('linha-aula-professor');
    const linhaManutencao = document.getElementById('linha-manutencao-responsavel');

    // Reseta todos os campos para escondidos, para mostrar só o que importa
    if (linhaJogadores) linhaJogadores.style.setProperty('display', 'none', 'important');
    if (linhaAula) linhaAula.style.setProperty('display', 'none', 'important');
    if (linhaManutencao) linhaManutencao.style.setProperty('display', 'none', 'important');

    const isGestorOuAdmin = isGestorLogado || (function() {
        try { return JSON.parse(localStorage.getItem('jogadorLogadoPerfis') || '{}')['Admin'] === true; } catch(e) { return false; }
    })();

    if (tipoEscolhido === 'jogo') {
        // Modo Jogo: Mostra a seleção normal de Jogadores
        if (linhaJogadores) linhaJogadores.style.setProperty('display', 'flex', 'important');
        
    } else if (tipoEscolhido === 'aula') {
        // Modo Aula: Esconde jogadores, mostra a seleção do professor
        if (linhaAula) linhaAula.style.setProperty('display', 'flex', 'important');
        
        const selProf = document.getElementById('saas-aula-professor');
        if (selProf) {
            if (isGestorOuAdmin) {
                // Se for Admin/Gestor, povoa com a lista de todos os professores
                selProf.disabled = false;
                selProf.style.cursor = 'pointer';
                selProf.style.opacity = '1';
                selProf.innerHTML = '<option value="">Selecione o Professor...</option>';
                
                Object.keys(jogadoresGlobal || {}).forEach(id => {
                    const j = jogadoresGlobal[id];
                    if (j && j.ativo !== false && j.perfis && (j.perfis['Professor'] === true || j.perfis['Prof'] === true)) {
                        const apelidoProf = j.apelido || j.nomeCompleto;
                        selProf.innerHTML += `<option value="${apelidoProf}">${apelidoProf}</option>`;
                    }
                });
            } else {
                // Se for o próprio Professor logado, o nome dele trava na caixa
                selProf.disabled = true;
                selProf.style.cursor = 'not-allowed';
                selProf.style.opacity = '0.8';
                
                const meuNome = localStorage.getItem('jogadorLogadoNome') || '';
                const meuId = localStorage.getItem('jogadorLogadoId');
                const meuApelido = (jogadoresGlobal && jogadoresGlobal[meuId] && jogadoresGlobal[meuId].apelido) ? jogadoresGlobal[meuId].apelido : meuNome;
                
                selProf.innerHTML = `<option value="${meuApelido}" selected>${meuApelido}</option>`;
            }
        }
        
    } else if (tipoEscolhido === 'manutencao') {
        // Modo Manutenção: Exibe Responsável e Botão de Motivo
        if (linhaManutencao) linhaManutencao.style.setProperty('display', 'flex', 'important');
        
        const selResp = document.getElementById('saas-manutencao-responsavel');
        if (selResp) {
            if (isGestorOuAdmin) {
                // Se for Admin/Gestor, lista a equipe de manutenção
                selResp.disabled = false;
                selResp.style.cursor = 'pointer';
                selResp.style.opacity = '1';
                selResp.innerHTML = '<option value="">Selecione o Responsável...</option>';
                
                Object.keys(jogadoresGlobal || {}).forEach(id => {
                    const j = jogadoresGlobal[id];
                    if (j && j.ativo !== false && j.perfis && (j.perfis['Manutenção'] === true || j.perfis['Manut'] === true)) {
                        const apelidoManu = j.apelido || j.nomeCompleto;
                        selResp.innerHTML += `<option value="${apelidoManu}">${apelidoManu}</option>`;
                    }
                });
            } else {
                // Se for o próprio funcionário logado, o nome dele trava na caixa
                selResp.disabled = true;
                selResp.style.cursor = 'not-allowed';
                selResp.style.opacity = '0.8';
                
                const meuNome = localStorage.getItem('jogadorLogadoNome') || '';
                const meuId = localStorage.getItem('jogadorLogadoId');
                const meuApelido = (jogadoresGlobal && jogadoresGlobal[meuId] && jogadoresGlobal[meuId].apelido) ? jogadoresGlobal[meuId].apelido : meuNome;
                
                selResp.innerHTML = `<option value="${meuApelido}" selected>${meuApelido}</option>`;
                
                // 🟢 LIBERA O BOTÃO DO MOTIVO AUTOMATICAMENTE AQUI:
                alternarBotaoMotivoSaaS(meuApelido);
            }
        }
    }
}

// ====================================================================
// 🛠️ FUNÇÃO: ABRIR PROMPT DE MOTIVO DA MANUTENÇÃO
// ====================================================================
function abrirPromptMotivoManutencaoSaaS() {
    const inputOculto = document.getElementById('saas-manutencao-motivo-hidden');
    const valorAtual = inputOculto ? inputOculto.value : '';

    const htmlPrompt = `
        <div style="text-align: left; margin-top: 10px;">
            <label style="font-size: 13px; font-weight: 700; color: #64748b;">Informe o motivo (Opcional):</label>
            <input type="text" id="input-prompt-motivo" class="input-app" placeholder="Ex: Reparo de piso, Troca de rede..." value="${valorAtual}" style="margin-top: 6px; box-sizing: border-box;" autocomplete="off">
        </div>
    `;

    showPrompt("Detalhes da Manutenção", htmlPrompt, () => {
        const novoValor = document.getElementById('input-prompt-motivo').value.trim();
        if (inputOculto) {
            inputOculto.value = novoValor;
        }
        
        // Dá um feedback visual no botão pintando ele de verde caso a pessoa tenha digitado algo
        const btnMotivo = document.getElementById('btn-add-motivo-manutencao');
        if (btnMotivo) {
            if (novoValor !== '') {
                btnMotivo.style.backgroundColor = '#dcfce7'; // Verde bem clarinho
                btnMotivo.style.color = '#15803d';          // Verde escuro
                btnMotivo.style.borderColor = '#86efac';
            } else {
                btnMotivo.style.backgroundColor = '#f1f5f9'; // Voltar ao original
                btnMotivo.style.color = '#475569';
                btnMotivo.style.borderColor = '#cbd5e1';
            }
        }
    });
}

// ====================================================================
// 🛠️ FUNÇÃO: LIBERA O BOTÃO DE MOTIVO APÓS SELECIONAR RESPONSÁVEL
// ====================================================================
function alternarBotaoMotivoSaaS(valorSelecionado) {
    const btnMotivo = document.getElementById('btn-add-motivo-manutencao');
    if (!btnMotivo) return;

    if (valorSelecionado && valorSelecionado.trim() !== '') {
        // Libera o botão
        btnMotivo.style.opacity = '1';
        btnMotivo.style.pointerEvents = 'auto';
    } else {
        // Bloqueia o botão e reseta a cor se a pessoa voltar para "Selecione..."
        btnMotivo.style.opacity = '0.3';
        btnMotivo.style.pointerEvents = 'none';
        btnMotivo.style.backgroundColor = '#f1f5f9';
        btnMotivo.style.color = '#475569';
        btnMotivo.style.borderColor = '#cbd5e1';
    }
}

/**
 * Formata o nome do Jogador 1 (Gestor) no padrão Title Case com iniciais no meio.
 * Ex: "RONALDO TABORDA COSTA" -> "Ronaldo T Costa"
 * Ex: "NICOLAY DAVYDENKO" -> "Nicolay Davydenko"
 */
function formatarNomeJogador1GestorSaaS(nomeBruto) {
    if (!nomeBruto) return "";
    
    let nomeLimpo = String(nomeBruto).replace(/\s*\(.*?\)\s*/g, "").trim();
    nomeLimpo = nomeLimpo.toLowerCase().replace(/(?:^|\s)\S/g, function(a) { return a.toUpperCase(); });

    const palavras = nomeLimpo.split(/\s+/);
    if (palavras.length > 2) {
        let nomeFinal = palavras[0];
        for (let i = 1; i < palavras.length - 1; i++) {
            if (['Da', 'De', 'Do', 'Dos', 'Das'].includes(palavras[i])) {
                nomeFinal += " " + palavras[i].toLowerCase();
            } else {
                nomeFinal += " " + palavras[i].charAt(0).toUpperCase();
            }
        }
        nomeFinal += " " + palavras[palavras.length - 1];
        return nomeFinal;
    }
    return nomeLimpo;
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
            if (s !== selAtual && s.value && s.value !== 'convidado') {
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

    // 🛡️ TRAVA DO RANKING: Se for o modo de duelo, aborta a formatação camaleão para preservar a numeração ("1º - ")
    const campoDuracao = document.getElementById('saas-duracao') || document.getElementById('saas-duracao-reserva');
    if (campoDuracao && campoDuracao.value === 'ranking') {
        return; 
    }
    
    const proibidos = obterListaProibidosSaaS(sel);
    const isMobile = window.innerWidth <= 767;
    
    Array.from(sel.options).forEach(opt => {
        const id = opt.value;
        if (!id || id === "" || id === "convidado") return;
        
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
            if (isMobile) {
                // 📱 NO CELULAR: Mantém rigorosamente a mesma formatação Title Case do Jogador 1
                opt.textContent = formatarNomeJogador1GestorSaaS(atleta.nomeCompleto);
            } else {
                // 💻 NO COMPUTADOR: Mantém 100% o comportamento original
                if (exibirCompleto) {
                    const apelidoTxt = atleta.apelido ? ' (' + atleta.apelido + ')' : '';
                    opt.textContent = atleta.nomeCompleto + apelidoTxt;
                } else {
                    opt.textContent = expurgarEAbreviarNomeSaaS(atleta.nomeCompleto, atleta.apelido);
                }
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
        div.className = 'saas-row saas-row-atleta'; 
        
        const sel = document.createElement('select'); 
        sel.className = 'saas-field saas-field-atleta';
        sel.id = `saas-jogador${contAtletas}`;
        sel.innerHTML = '<option value="">Selecionar Atleta ' + contAtletas + '...</option>';
        
        const proibidos = obterListaProibidosSaaS(sel);
        const isMobile = window.innerWidth <= 767;
        
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
                    const textoExibicao = isMobile 
                        ? formatarNomeJogador1GestorSaaS(atleta.nomeCompleto)
                        : expurgarEAbreviarNomeSaaS(atleta.nomeCompleto, atleta.apelido);
                    
                    if (proibidos.includes(id)) {
                        sel.innerHTML += '<option value="' + id + '" disabled style="display:none;">' + textoExibicao + '</option>';
                    } else {
                        sel.innerHTML += '<option value="' + id + '">' + textoExibicao + '</option>';
                    }
                }
            });
        }

        // 👥 Injeta separador e Convidado no final se a quadra e o horário permitirem
        if (typeof podeIncluirConvidadoSaaS === 'function' && podeIncluirConvidadoSaaS()) {
            const linhaDivisoria = isMobile ? '────────' : '──────────────────────────────';
            sel.innerHTML += `<option value="" disabled data-divisor="convidado" style="color: #94a3b8;">${linhaDivisoria}</option>`;
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
        sel.addEventListener('change', () => {
            alternarTextoOpcoesSaaS(sel, false);
            handleConvidadoSelectSaaS(sel);
        });
        
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


// ====================================================================
// 🏆 MOTOR DE RANKING: FILTRO INTELIGENTE E EXIBIÇÃO DE ADVERSÁRIOS
// ====================================================================
async function aplicarFiltroRankingModalSaaS() {
    const campoDuracao = document.getElementById('saas-duracao') || document.getElementById('saas-duracao-reserva');
    const container = document.getElementById('jogadoresContainerSaaS');
    const btnAdd = document.getElementById('btn-add-atleta-SaaS');
    
    if (!campoDuracao || !container) return;

    const isRanking = (campoDuracao.value && campoDuracao.value.toLowerCase().includes('ranking'));

    if (isRanking) {
        // 1. Limpa linhas de atletas extras (3º e 4º jogadores, se existirem)
        const rows = container.querySelectorAll('.saas-row-atleta');
        for (let i = 1; i < rows.length; i++) {
            rows[i].remove();
        }
        resetContadorAtletasSaaS();

        const selJ1 = document.getElementById('saas-jogador1');
        if (!selJ1) return;

        let idLogado = '';

        let perfisLogado = {};
        try { perfisLogado = JSON.parse(localStorage.getItem('jogadorLogadoPerfis') || '{}'); } catch(e) {}
        const isArbitroLogado = perfisLogado['Árbitro'] === true || perfisLogado['Arbitro'] === true;
        const ehAdminLogado = perfisLogado['Admin'] === true;
        const podeSelecionarJ1Ranking = isGestorLogado || isArbitroLogado || ehAdminLogado;

        if (podeSelecionarJ1Ranking) {
            // 🟢 MODO GESTOR / ÁRBITRO NO RANKING: Ativa o estilo clicável e adiciona o evento de troca
            selJ1.disabled = false;
            selJ1.classList.add('saas-field-atleta');
            selJ1.style.backgroundColor = '#ffffff';
            selJ1.style.cursor = 'pointer';
            selJ1.style.opacity = '1';

            // Atualiza dinamicamente a Linha 2 ao selecionar um atleta na Linha 1
            selJ1.onchange = () => {
                aplicarFiltroRankingModalSaaS();
            };

            const confRanking = (configRegrasGlobal && configRegrasGlobal.ranking) ? configRegrasGlobal.ranking : {};
            const modeloAtivo = confRanking.calendario?.formatoTorneio || 'grupos';
            const faseAtualRanking = parseInt(confRanking.faseAtual, 10) || 1;
            const emMataMataDireto = (modeloAtivo === 'grupos' && confRanking.grupos?.faseInicial === 'matamata');
            const emFaseMataMata = (modeloAtivo === 'grupos' && ((emMataMataDireto && faseAtualRanking >= 3) || (!emMataMataDireto && faseAtualRanking >= 4)));

            // 🎯 CONSOLIDAÇÃO DE ATLETAS VÁLIDOS: Filtra apenas quem está competindo ativamente na rodada atual
            const atletasValidosNaTabela = new Set(); 

            if (modeloAtivo === 'grupos' && emFaseMataMata) {
                // 🏆 NO MATA-MATA DE GRUPOS: Filtra exclusivamente os atletas com confronto ativo e não finalizado na rodada atual das chaves
                if (typeof rankingChavesGlobal !== 'undefined' && rankingChavesGlobal) {
                    const partidasRanking = (typeof rankingPartidasGlobal !== 'undefined' && rankingPartidasGlobal) ? rankingPartidasGlobal : {};

                    Object.entries(rankingChavesGlobal).forEach(([catKey, dadosChave]) => {
                        const rodada1 = (dadosChave && dadosChave.rodada1) ? dadosChave.rodada1 : [];
                        rodada1.forEach(confronto => {
                            if (!confronto.isBye && confronto.jogador1Id && confronto.jogador2Id) {
                                const jaFinalizado = Object.values(partidasRanking).some(p => {
                                    if (p.categoria !== catKey || p.status !== 'finalizada') return false;
                                    return (p.jogador1Id === confronto.jogador1Id && p.jogador2Id === confronto.jogador2Id) ||
                                           (p.jogador1Id === confronto.jogador2Id && p.jogador2Id === confronto.jogador1Id);
                                });

                                if (!jaFinalizado) {
                                    atletasValidosNaTabela.add(confronto.jogador1Id);
                                    atletasValidosNaTabela.add(confronto.jogador2Id);
                                }
                            }
                        });
                    });
                }
            } else {
                // 🎾 NA FASE DE GRUPOS, PIRÂMIDE OU BARRAGEM: Considera todos os atletas das tabelas ativas
                if (typeof rankingTabelasGlobal !== 'undefined' && rankingTabelasGlobal) {
                    Object.values(rankingTabelasGlobal).forEach(categoriaTabela => {
                        const idsCategoria = Array.isArray(categoriaTabela) ? categoriaTabela : Object.values(categoriaTabela);
                        idsCategoria.forEach(id => { if (id) atletasValidosNaTabela.add(id); });
                    });
                }
            }

            const precisaPovoar = (selJ1.options.length <= 1) || 
                     (selJ1.options[0].textContent !== 'Selecionar Jogador 1...');

            if (precisaPovoar) {
                const valSalvoJ1 = selJ1.value;
                selJ1.innerHTML = '<option value="">Selecionar Jogador 1...</option>';

                if (typeof jogadoresGlobal !== 'undefined' && Object.keys(jogadoresGlobal).length > 0) {
                    const atletasOrdenados = Object.keys(jogadoresGlobal)
                        .map(id => ({ id: id, ...jogadoresGlobal[id] }))
                        .sort((a, b) => {
                            const nomeA = (a.nomeCompleto || "").trim().toLowerCase();
                            const nomeB = (b.nomeCompleto || "").trim().toLowerCase();
                            return nomeA.localeCompare(nomeB, 'pt-BR');
                        });

                    atletasOrdenados.forEach(j => {
                        // 🎯 FILTRO DE ALTA PRECISÃO: Exige que o atleta esteja ativo, apto ao ranking e presente nas disputas ativas
                        const participaETaNaTabela = j && j.ativo !== false && j.participaRanking && atletasValidosNaTabela.has(j.id);
                        if (participaETaNaTabela) {
                            const opt = document.createElement('option');
                            opt.value = j.id;
                            opt.textContent = formatarNomeJogador1GestorSaaS(j.nomeCompleto);
                            selJ1.appendChild(opt); 
                        }
                    });
                }

                const meuId = localStorage.getItem('jogadorLogadoId');
                if (valSalvoJ1 && selJ1.querySelector(`option[value="${valSalvoJ1}"]`)) {
                    selJ1.value = valSalvoJ1;
                } else if (meuId && !isGestorLogado && selJ1.querySelector(`option[value="${meuId}"]`)) {
                    selJ1.value = meuId;
                }
            }

            idLogado = selJ1.value;

            // 🎯 REGRA DO GESTOR: Se o Jogador 1 não foi selecionado, a Linha 2 NÃO aparece
            if (!idLogado) {
                const selJ2Existente = document.getElementById('saas-jogador2');
                if (selJ2Existente && selJ2Existente.closest('.saas-row-atleta')) {
                    selJ2Existente.closest('.saas-row-atleta').remove();
                }
                resetContadorAtletasSaaS();
                return;
            }
        } else {
            idLogado = localStorage.getItem('jogadorLogadoId');
        }

        // 2. SE O JOGADOR 1 FOI DEFINIDO, CRIA A LINHA 2 (DESAFIADO)
        let selJ2 = document.getElementById('saas-jogador2');
        if (!selJ2) {
            contAtletas = 2;
            const divJ2 = document.createElement('div');
            divJ2.className = 'saas-row saas-row-atleta';

            selJ2 = document.createElement('select');
            selJ2.className = 'saas-field saas-field-atleta';
            selJ2.id = 'saas-jogador2';

            const lixo = document.createElement('span');
            lixo.className = 'btn-remover-atleta';
            lixo.innerHTML = '&times;';
            lixo.onclick = () => {
                divJ2.remove();
                resetContadorAtletasSaaS();
            };

            divJ2.appendChild(selJ2);
            divJ2.appendChild(lixo);
            container.appendChild(divJ2);
        }

        const dadosLogado = (typeof jogadoresGlobal !== 'undefined' && idLogado) ? jogadoresGlobal[idLogado] : null;

        if (!dadosLogado || !dadosLogado.participaRanking) {
            selJ2.innerHTML = '<option value="">Atleta não participa do Ranking</option>';
            selJ2.disabled = true;
            return;
        }

        // 3. LEITURA DE REGRAS E CATEGORIAS DO RANKING
        const confRanking = (configRegrasGlobal && configRegrasGlobal.ranking) ? configRegrasGlobal.ranking : {};
        const modoGenero = confRanking.divisaoGenero || 'separado';
        const modeloAtivo = confRanking.calendario?.formatoTorneio || 'grupos';
        
        const faseAtualRanking = parseInt(confRanking.faseAtual, 10) || 1;
        let generoKey = (dadosLogado.genero || 'MASCULINO').toUpperCase();
        if (generoKey === 'NAO_INFORMAR') generoKey = 'MASCULINO';

        const chaveTabela = (modoGenero === 'unificado') ? `${dadosLogado.classe.toUpperCase()}_UNIFICADO` : `${dadosLogado.classe.toUpperCase()}_${generoKey}`;
        const listaIdsRanking = rankingTabelasGlobal[chaveTabela] || [];

        selJ2.innerHTML = '<option value="">Selecionar Jogador 2...</option>';
        selJ2.disabled = false;

        const idsArray = Array.isArray(listaIdsRanking) ? listaIdsRanking : Object.values(listaIdsRanking);
        const partidasRanking = rankingPartidasGlobal || {};
        const nomeLogadoNorm = (dadosLogado.nomeCompleto || dadosLogado.apelido || '').trim().toUpperCase();

        const listaTodasReservasGeral = [];
        Object.keys(reservasGeralGlobal || {}).forEach(qKey => {
            const slots = reservasGeralGlobal[qKey] || {};
            Object.values(slots).forEach(r => {
                if (r) listaTodasReservasGeral.push(r);
            });
        });

        // 4. CÁLCULO DE ADVERSÁRIOS ELEGÍVEIS (PIRÂMIDE / GRUPOS / BARRAGEM)
        let idsPermitidos = idsArray;

        const emMataMataDireto = (modeloAtivo === 'grupos' && confRanking.grupos?.faseInicial === 'matamata');
        const emFaseMataMata = (modeloAtivo === 'grupos' && ((emMataMataDireto && faseAtualRanking >= 3) || (!emMataMataDireto && faseAtualRanking >= 4)));

        if (modeloAtivo === 'grupos') {
            if (emFaseMataMata) {
                const dadosChaveCat = (typeof rankingChavesGlobal !== 'undefined' && rankingChavesGlobal)
                    ? rankingChavesGlobal[chaveTabela]
                    : null;

                const rodada1 = (dadosChaveCat && dadosChaveCat.rodada1) ? dadosChaveCat.rodada1 : [];

                if (rodada1.length > 0) {
                    const confrontoAtleta = rodada1.find(c => c.jogador1Id === idLogado || c.jogador2Id === idLogado);

                    if (confrontoAtleta) {
                        const idAdversario = (confrontoAtleta.jogador1Id === idLogado) 
                            ? confrontoAtleta.jogador2Id 
                            : confrontoAtleta.jogador1Id;

                        idsPermitidos = idAdversario ? [idAdversario] : [];
                    } else {
                        idsPermitidos = [];
                    }
                } else {
                    idsPermitidos = [];
                }
            } else {
                const idxLogado = idsArray.indexOf(idLogado);
                if (idxLogado !== -1) {
                    const tamanhoGrupo = parseInt(confRanking.grupos?.tamanhoGrupo, 10) || 3;
                    const numGrupo = Math.floor(idxLogado / tamanhoGrupo);
                    const inicioGrupo = numGrupo * tamanhoGrupo;
                    const fimGrupo = inicioGrupo + tamanhoGrupo;
                    idsPermitidos = idsArray.slice(inicioGrupo, fimGrupo);
                }
            }
        } else if (modeloAtivo === 'piramide') {
            const idxLogado = idsArray.indexOf(idLogado);
            if (idxLogado !== -1) {
                const alcanceTipo = confRanking.piramide?.alcanceTipo || 'posicoes';

                if (alcanceTipo === 'linha') {
                    const posLogado = idxLogado + 1;
                    let linhaAtual = 1;
                    let acum = 1;
                    while (acum < posLogado) {
                        linhaAtual++;
                        acum += linhaAtual;  
                    }

                    if (linhaAtual > 1) {
                        const linhaAcima = linhaAtual - 1;
                        const posInicioLinhaAcima = ((linhaAcima - 1) * linhaAcima / 2) + 1;
                        const posFimLinhaAcima = (linhaAcima * (linhaAcima + 1)) / 2;
                        idsPermitidos = idsArray.slice(posInicioLinhaAcima - 1, posFimLinhaAcima);
                    } else {
                        idsPermitidos = [];
                    }
                } else if (alcanceTipo === 'livre') {
                    idsPermitidos = idsArray.slice(0, idxLogado);
                } else {
                    const alcance = parseInt(confRanking.piramide?.limitePosicoes, 10) || 3;
                    const inicio = Math.max(0, idxLogado - alcance);
                    idsPermitidos = idsArray.slice(inicio, idxLogado);
                }
            }
        }

        idsPermitidos = idsPermitidos.filter(idAtleta => {
            if (idAtleta === idLogado) return false;

            if (modeloAtivo === 'barragem' || modeloAtivo === 'grupos') {
                const jaEnfrentou = Object.values(partidasRanking).some(p => {
                    if (p.categoria !== chaveTabela || p.status !== 'finalizada') return false;
                    const ehDuelo = (p.jogador1Id === idLogado && p.jogador2Id === idAtleta) || 
                                    (p.jogador1Id === idAtleta && p.jogador2Id === idLogado);
                    if (!ehDuelo) return false;

                    if (modeloAtivo === 'grupos' && faseAtualRanking === 3) {
                        const dp = p.dadosPlacar || {};
                        return !!(dp.tagGrupoRanking || p.tagGrupoRanking);
                    }
                    if (modeloAtivo === 'grupos' && faseAtualRanking === 4) {
                        const dp = p.dadosPlacar || {};
                        return !(dp.tagGrupoRanking || p.tagGrupoRanking);
                    }
                    return true;
                });
                if (jaEnfrentou) return false;
            }

            const atletaObj = jogadoresGlobal[idAtleta] || {};
            const nomeAtletaNorm = (atletaObj.nomeCompleto || atletaObj.apelido || '').trim().toUpperCase();

            const jaAgendado = listaTodasReservasGeral.some(r => {
                if (!r || r.status === 'aula_cancelada') return false;
                const ehRanking = (r.isRanking === true || r.tipo === 'ranking');
                if (!ehRanking) return false;

                const jogs = (r.jogadores_completo || r.jogadores || '').toUpperCase();
                const envolveAmbos = jogs.includes(nomeLogadoNorm) && jogs.includes(nomeAtletaNorm);
                if (!envolveAmbos) return false;

                const stPlacar = r.statusPlacar || (r.dadosPlacar ? r.dadosPlacar.statusPlacar : 'sem_placar');
                if (stPlacar === 'consolidado' || stPlacar === 'anulado') return false;

                return true;
            });
            if (jaAgendado) return false;

            return true;
        });

        if (idsPermitidos.length === 0) {
            selJ2.innerHTML = '<option value="">Nenhum adversário disponível</option>';
            selJ2.disabled = true;
            return;
        }

        idsPermitidos.forEach((idAtleta) => {
            if (jogadoresGlobal && jogadoresGlobal[idAtleta]) {
                const atleta = jogadoresGlobal[idAtleta];
                let apelidoLimpo = (atleta.apelido || atleta.nomeCompleto || "").trim();
                apelidoLimpo = apelidoLimpo.toLowerCase().replace(/(?:^|\s)\S/g, function(a) { return a.toUpperCase(); });
                
                const opt = document.createElement('option');
                opt.value = idAtleta;
                opt.textContent = `${apelidoLimpo}`;
                selJ2.appendChild(opt);
            }
        });

    } else {
        // === MODO NORMAL (1h ou 2h) ===
        const rows = container.querySelectorAll('.saas-row-atleta');
        if (rows.length > 0) {
            for (let i = 0; i < rows.length; i++) {
                rows[i].remove();
            }
        }
        resetContadorAtletasSaaS();

        const selJ1 = document.getElementById('saas-jogador1');
        const selJ2 = document.getElementById('saas-jogador2');

        let perfisLogadoNormal = {};
        try { perfisLogadoNormal = JSON.parse(localStorage.getItem('jogadorLogadoPerfis') || '{}'); } catch(e) {}
        const ehAdminLogadoNormal = perfisLogadoNormal['Admin'] === true;

        if ((isGestorLogado || ehAdminLogadoNormal) && selJ1) {
            // 🟢 MODO GESTOR E ADMIN: Mantém o campo destravado, ativo e clicável
            selJ1.disabled = false;
            selJ1.classList.add('saas-field-atleta');
            selJ1.style.backgroundColor = '#ffffff';
            selJ1.style.cursor = 'pointer';
            selJ1.style.opacity = '1';
            selJ1.onchange = null;

            const prevVal = selJ1.value;
            selJ1.innerHTML = '<option value="">Selecionar Atleta 1...</option>';

            if (typeof jogadoresGlobal !== 'undefined' && Object.keys(jogadoresGlobal).length > 0) {
                const atletasOrdenados = Object.keys(jogadoresGlobal)
                    .map(id => ({ id: id, ...jogadoresGlobal[id] }))
                    .sort((a, b) => {
                        const nomeA = (a.nomeCompleto || "").trim().toLowerCase();
                        const nomeB = (b.nomeCompleto || "").trim().toLowerCase();
                        return nomeA.localeCompare(nomeB, 'pt-BR'); 
                    });

                atletasOrdenados.forEach(j => {
                    if (j && j.ativo !== false) {
                        const opt = document.createElement('option');
                        opt.value = j.id;
                        opt.textContent = expurgarEAbreviarNomeSaaS(j.nomeCompleto, j.apelido);
                        selJ1.appendChild(opt);
                    }
                });
            }

            const meuId = localStorage.getItem('jogadorLogadoId');
            if (prevVal && selJ1.querySelector(`option[value="${prevVal}"]`)) {
                selJ1.value = prevVal;
            } else if (!isGestorLogado && meuId && selJ1.querySelector(`option[value="${meuId}"]`)) {
                selJ1.value = meuId;
            } else {
                selJ1.value = '';
            }
        } else if (selJ1) {
            // 🔒 RESTAURA MODO NORMAL PARA ÁRBITRO / SÓCIO (Campo travado com o próprio nome)
            selJ1.disabled = true;
            selJ1.classList.remove('saas-field-atleta');
            selJ1.style.backgroundColor = '';
            selJ1.style.cursor = 'not-allowed';
            selJ1.onchange = null;

            const nomeLogado = localStorage.getItem('jogadorLogadoNome') || "";
            selJ1.innerHTML = '';
            const optUser = document.createElement('option');
            optUser.value = nomeLogado;

            let nomeLimpo = nomeLogado.replace(/\s*\(.*?\)\s*/g, "").trim();
            nomeLimpo = nomeLimpo.toLowerCase().replace(/(?:^|\s)\S/g, function(a) { return a.toUpperCase(); });

            const palavras = nomeLimpo.split(/\s+/);
            if (palavras.length > 2) {
                let nomeFinalJ1 = palavras[0];
                for (let i = 1; i < palavras.length - 1; i++) {
                    if (['Da', 'De', 'Do', 'Dos', 'Das'].includes(palavras[i])) {
                        nomeFinalJ1 += " " + palavras[i].toLowerCase();
                    } else {
                        nomeFinalJ1 += " " + palavras[i].charAt(0).toUpperCase();
                    }
                }
                nomeFinalJ1 += " " + palavras[palavras.length - 1];
                optUser.textContent = nomeFinalJ1;
            } else {
                optUser.textContent = nomeLimpo;
            }

            selJ1.appendChild(optUser);
            selJ1.value = nomeLogado;
            selJ1.dataset.modo = 'normal';
        }

        if (selJ2) {
            selJ2.disabled = false;
            const idSelecionadoAntes = selJ2.value;
            selJ2.innerHTML = '<option value="">Selecionar Atleta 2...</option>';
            
            if (typeof jogadoresGlobal !== 'undefined' && Object.keys(jogadoresGlobal).length > 0) {
                const atletasOrdenadosSaaS = Object.keys(jogadoresGlobal)
                    .map(id => ({ id: id, ...jogadoresGlobal[id] }))
                    .sort((a, b) => {
                        const nomeA = (a.nomeCompleto || "").trim().toLowerCase();
                        const nomeB = (b.nomeCompleto || "").trim().toLowerCase();
                        return nomeA.localeCompare(nomeB, 'pt-BR'); 
                    });

                atletasOrdenadosSaaS.forEach(atleta => {
                    const id = atleta.id;
                    if (atleta && atleta.ativo !== false) {
                        const textoAbreviado = expurgarEAbreviarNomeSaaS(atleta.nomeCompleto, atleta.apelido);
                        selJ2.innerHTML += '<option value="' + id + '">' + textoAbreviado + '</option>';
                    }
                });
            } else {
                selJ2.innerHTML += '<option value="convidado">Convidado / Avulso</option>';
            }

            if (idSelecionadoAntes && selJ2.querySelector(`option[value="${idSelecionadoAntes}"]`)) {
                selJ2.value = idSelecionadoAntes;   
            }
        }
        
        if (btnAdd) {
            btnAdd.style.removeProperty('display');
            btnAdd.style.display = 'inline-flex';
            btnAdd.style.opacity = '1';
            btnAdd.style.pointerEvents = 'auto'; 
        }
    }
}

// ====================================================================
// 🏆 AUXILIAR DE POSIÇÃO DO RANKING (LEITURA SÍNCRONA EM RAM)
// ====================================================================

function obterPosicaoTextoRankingSaaS(nomeOuApelido) {
    if (!nomeOuApelido || !jogadoresGlobal) return "";

    const nomeUpper = nomeOuApelido.trim().toUpperCase();

    // Busca o ID do atleta na memória RAM
    const idAtleta = Object.keys(jogadoresGlobal).find(id => {
        const j = jogadoresGlobal[id];
        if (!j) return false;
        const nomeComp = (j.nomeCompleto || "").trim().toUpperCase();
        const apelido = (j.apelido || "").trim().toUpperCase();
        return nomeComp === nomeUpper || apelido === nomeUpper; 
    });

    if (!idAtleta) return "";

    const atleta = jogadoresGlobal[idAtleta];
    if (!atleta || !atleta.classe) return "";

    const confRanking = (configRegrasGlobal && configRegrasGlobal.ranking) ? configRegrasGlobal.ranking : {};
    const modeloAtivo = confRanking.calendario?.formatoTorneio || confRanking.modeloAtivo || 'piramide';

    const modoGenero = confRanking.divisaoGenero || 'separado';
    let generoKey = (atleta.genero || 'MASCULINO').toUpperCase();
    if (generoKey === 'NAO_INFORMAR') generoKey = 'MASCULINO';
    const chaveCat = (modoGenero === 'unificado') ? `${atleta.classe.toUpperCase()}_UNIFICADO` : `${atleta.classe.toUpperCase()}_${generoKey}`;

    // 🏆 PRIORIZAÇÃO INTELIGENTE DE TABELA POR MODELO:
    // - Pirâmide / Barragem: lê prioritariamente a tabela viva/dinâmica (rankingTabelasGlobal)
    // - Grupos: preserva intocada a prioridade da semeadura fixa (rankingSemeaduraGlobal)
    let tabela = null;
    if (modeloAtivo === 'piramide' || modeloAtivo === 'barragem') {
        tabela = (typeof rankingTabelasGlobal !== 'undefined' && rankingTabelasGlobal && rankingTabelasGlobal[chaveCat])
            ? rankingTabelasGlobal[chaveCat]
            : ((typeof rankingSemeaduraGlobal !== 'undefined' && rankingSemeaduraGlobal && rankingSemeaduraGlobal[chaveCat])
                ? rankingSemeaduraGlobal[chaveCat]
                : null);
    } else {
        tabela = (typeof rankingSemeaduraGlobal !== 'undefined' && rankingSemeaduraGlobal && rankingSemeaduraGlobal[chaveCat])
            ? rankingSemeaduraGlobal[chaveCat]
            : ((typeof rankingTabelasGlobal !== 'undefined' && rankingTabelasGlobal && rankingTabelasGlobal[chaveCat])
                ? rankingTabelasGlobal[chaveCat]
                : null);
    }

    if (!tabela) return ""; 

    const idsArray = Array.isArray(tabela) ? tabela : Object.values(tabela);
    const idx = idsArray.indexOf(idAtleta);

    if (idx !== -1) {
        // Se for Pirâmide retorna com o ordinal 'º' (ex: 1º, 2º), se for Barragem/Grupos retorna a semente pura (ex: 6, 7)
        return (modeloAtivo === 'piramide') ? `${idx + 1}º` : `${idx + 1}`;
    }

    return "";
}

// ====================================================================
// 🏆 AUXILIAR DE POSIÇÃO DO RANKING (GERAÇÃO DE TAG HTML PARA TELA)
// ====================================================================
function obterTagPosicaoRankingSaaS(nomeOuApelido) {
    const posTexto = obterPosicaoTextoRankingSaaS(nomeOuApelido);
    if (!posTexto) return "";
    return `<span class="pos-tag">${posTexto}</span>`;
}


// ====================================================================
// MÓDULO DE GRAVAÇÃO ATÔMICA DE RESERVAS (SaaS) - COM TRANSAÇÕES E ROLLBACK
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

function validarConflitoHorarioAtletaSaaS(listaNomesCompletos, listaApelidos, pacote, todasReservas) {
    if (!todasReservas) return null;

    const diaAlvo = pacote.dia;
    const horaInicioAlvo = pacote.hora;
    const horaFimAlvo = pacote.hora + pacote.duracao;

    let conflitoEncontrado = null;

    Object.keys(todasReservas).forEach(quadraKey => {
        const slots = todasReservas[quadraKey] || {};
        Object.keys(slots).forEach(slotKey => {
            const r = slots[slotKey];
            if (!r || r.status === 'aula_cancelada' || r.dia !== diaAlvo) return;
            if (r.borda === undefined && r.duracao === 2) return; // Ignora a segunda hora do bloco de 2h

            const hInicioReserva = r.hora;
            const hFimReserva = r.hora + (parseInt(r.duracao) || 1);

            // Verifica se há sobreposição de horário na grade
            const haSobreposicao = (hInicioReserva < horaFimAlvo) && (hFimReserva > horaInicioAlvo);

            if (haSobreposicao) {
                const jogadoresReservaStr = (r.jogadores_completo || r.jogadores || "").toUpperCase();

                listaNomesCompletos.forEach((nome, idx) => {
                    if (jogadoresReservaStr.includes(nome.toUpperCase())) {
                        const apelidoConf = listaApelidos[idx] || nome;
                        const primeiroNome = apelidoConf.trim().split(' ')[0];
                        const numQuadra = quadraKey.match(/\d+/);
                        const qNomeVisual = numQuadra ? `Quadra ${numQuadra[0]}` : quadraKey;

                        conflitoEncontrado = `${primeiroNome} já possui agendamento neste mesmo horário (${qNomeVisual}).`;
                    }
                });
            }
        });
    });

    return conflitoEncontrado;
}

// ====================================================================
// 🎼 MOTOR ORQUESTRADOR: O MAESTRO DE AGENDAMENTOS (Fase Refatorada)
// ====================================================================

// ====================================================================
// 🎼 MOTOR ORQUESTRADOR: O MAESTRO DE AGENDAMENTOS (Fase Refatorada)
// ====================================================================

function validarEAgendarPartidaSaas() {
    if (navigator.vibrate) navigator.vibrate(40);   

    // --- NOVO: Captura o Tipo de Agendamento ---
    const elTipoContainer = document.getElementById('linha-tipo-reserva');
    const elTipo = document.getElementById('saas-tipo-reserva');
    const isTipoVisivel = elTipoContainer && elTipoContainer.style.display.includes('flex');
    const tipoAgendamento = isTipoVisivel ? elTipo.value : 'jogo';

    // ----------------------------------------------------
    // 1. A COLETA (Montagem do Pacote de Dados da UI)
    // ----------------------------------------------------
    const selectDuracao = document.getElementById('saas-duracao') || document.getElementById('saas-duracao-reserva');
    const selectDia = document.getElementById('saas-dia') || document.getElementById('saas-dia-reserva');
    const selectHora = document.getElementById('saas-hora') || document.getElementById('saas-hora-reserva');
    
    const valorDuracaoRaw = selectDuracao ? selectDuracao.value : "1";
    const ehPartidaRanking = (valorDuracaoRaw === "ranking" && tipoAgendamento === 'jogo');
    
    const duracaoRankingConfig = (typeof configRegrasGlobal !== 'undefined' && 
                                  configRegrasGlobal && 
                                  configRegrasGlobal.ranking && 
                                  configRegrasGlobal.ranking.duracaoPartida !== undefined) 
                                  ? parseInt(configRegrasGlobal.ranking.duracaoPartida, 10) 
                                  : 2;

    const duracaoHoras = ehPartidaRanking ? duracaoRankingConfig : (parseInt(valorDuracaoRaw, 10) || 1);

    const pacote = {
        duracao: duracaoHoras,
        isRanking: ehPartidaRanking,
        tipo: tipoAgendamento === 'jogo' ? (ehPartidaRanking ? "ranking" : "comum") : tipoAgendamento,
        dia: selectDia ? parseInt(selectDia.value) : 1,
        hora: selectHora ? parseInt(selectHora.value) : 6,
        quadraAlvo: "Quadra - 1",
        dataCompletaFormato: new Date().toISOString().split('T')[0]
    };

    if (typeof quadraSelecionadaSaaS !== 'undefined' && quadraSelecionadaSaaS) {
        const match = quadraSelecionadaSaaS.match(/\d+/);
        pacote.quadraAlvo = match ? `Quadra - ${match[0]}` : quadraSelecionadaSaaS;
    }

    const linhaDatasTabela = document.getElementById('linha-datas-tabela');
    if (linhaDatasTabela && linhaDatasTabela.children[pacote.dia - 1]) {
        const dataTextoOriginal = linhaDatasTabela.children[pacote.dia - 1].textContent.trim();
        const partesData = dataTextoOriginal.split('/');
        if (partesData.length === 3) {
            pacote.dataCompletaFormato = `${partesData[2]}-${partesData[1]}-${partesData[0]}`;
        }
    }

    // ====================================================================
    // 🚀 BIFURCAÇÃO EXPRESSA: AULA OU MANUTENÇÃO (Ignora quórum e monopólio)
    // ====================================================================
    if (tipoAgendamento === 'aula' || tipoAgendamento === 'manutencao') {
        const celAlvo1Esp = document.getElementById(`cel-${pacote.hora}-${pacote.dia}`);
        const celAlvo2Esp = (pacote.duracao === 2) ? document.getElementById(`cel-${pacote.hora + 1}-${pacote.dia}`) : null;
        const isTorneioSlotEsp = (celAlvo1Esp && celAlvo1Esp.classList.contains('celula-torneio')) || (celAlvo2Esp && celAlvo2Esp.classList.contains('celula-torneio'));
        
        if (isTorneioSlotEsp) {
            showToast("Este horário é exclusivo para partidas do Ranking.", "error");
            return;
        }
        let organizadorEspecial = "";
        let textoGrid = "";
        let motivoOpcional = "";

        if (tipoAgendamento === 'aula') {
            const prof = document.getElementById('saas-aula-professor').value;
            if (!prof || prof === "") { showToast("Selecione o Professor responsável.", "warning"); return; }
            organizadorEspecial = prof;
            textoGrid = "Aula";
        } else {
            const resp = document.getElementById('saas-manutencao-responsavel').value;
            const mot = document.getElementById('saas-manutencao-motivo-hidden').value;
            if (!resp || resp === "") { showToast("Selecione o Responsável pela manutenção.", "warning"); return; }
            organizadorEspecial = resp;
            textoGrid = "💦 Manutenção";
            motivoOpcional = mot;
        }

        const btnSubmit = document.getElementById('btn-saas-confirmar-agendamento');
        if (btnSubmit) { btnSubmit.disabled = true; btnSubmit.textContent = "Agendando..."; }

        const objetoEspecial = {
            borda: `${pacote.duracao}h`,
            status: "confirmada",
            dataCompleta: pacote.dataCompletaFormato,
            dia: pacote.dia,
            hora: pacote.hora,
            duracao: pacote.duracao,
            isRanking: false,
            tipo: pacote.tipo,
            organizador: organizadorEspecial,
            jogadores: textoGrid, 
            jogadores_completo: textoGrid,
            confirmacoes: { [organizadorEspecial]: true },
            motivo: motivoOpcional 
        };

        const chaveLimpa = `${pacote.dia}_${pacote.hora}`;
        const path1 = `${raizBanco}/reservas/${pacote.quadraAlvo}/${chaveLimpa}`;
        const path2 = `${raizBanco}/reservas/${pacote.quadraAlvo}/${pacote.dia}_${pacote.hora + 1}`;
        
        let commitado1 = false;

        database.ref(path1).transaction(curr => {
            if (curr === null || curr.status === 'aula_cancelada') return objetoEspecial;
            return;
        })
        .then(res1 => {
            if (!res1.committed) throw new Error("COLISAO_1");
            commitado1 = true;
            if (pacote.duracao === 1) return true;

            const obj2 = { ...objetoEspecial, hora: pacote.hora + 1 };
            delete obj2.borda;
            return database.ref(path2).transaction(curr2 => {
                if (curr2 === null || curr2.status === 'aula_cancelada') return obj2;
                return;
            }).then(res2 => {
                if (!res2.committed) throw new Error("COLISAO_2");
                return true;
            });
        })
        .then(() => {
            showToast("Agendamento confirmado com sucesso!", "success");
            if (typeof fecharModalConfig === 'function') fecharModalConfig('modal-agendamento');
        })
        .catch(async err => {
            if (commitado1 && pacote.duracao === 2) {
                await database.ref(path1).remove();
            }
            if (err.message && err.message.includes("COLISAO")) {
                showToast("Ops! Este horário acabou de ser preenchido por outro utilizador.", "error");
            } else {
                showToast("Erro ao gravar no servidor. Tente novamente.", "error");
            }
        })
        .finally(() => {
            if (btnSubmit) { btnSubmit.disabled = false; btnSubmit.textContent = "Confirmar Agendamento"; }
        });

        return;
    }

    // ====================================================================
    // FLUXO PADRÃO (JOGOS E RANKING)
    // ====================================================================
    const celAlvo1 = document.getElementById(`cel-${pacote.hora}-${pacote.dia}`);
    const celAlvo2 = (pacote.duracao === 2) ? document.getElementById(`cel-${pacote.hora + 1}-${pacote.dia}`) : null;
    pacote.isDupla = (celAlvo1 && celAlvo1.classList.contains('celula-dupla')) || (celAlvo2 && celAlvo2.classList.contains('celula-dupla'));
    const isTorneioSlot = (celAlvo1 && celAlvo1.classList.contains('celula-torneio')) || (celAlvo2 && celAlvo2.classList.contains('celula-torneio'));

    if (isTorneioSlot && !ehPartidaRanking) {
        showToast("Este horário é exclusivo para partidas do Ranking.", "error"); 
        return;
    }

    // ----------------------------------------------------
    // 🚨 CAPTURA ESTRUTURADA DE ATLETAS E CONVIDADOS
    // ----------------------------------------------------
    const j1Select = document.getElementById('saas-jogador1');
    if (!j1Select || !j1Select.value || j1Select.value === "") {
        showToast("Por favor, selecione o organizador/atleta 1.", "warning");
        return;
    }

    const slotsAgendamento = [];
    slotsAgendamento.push({
        tipo: 'socio',
        valorBruto: j1Select.value
    });

    let temCampoAbertoEmBranco = false;
    for (let i = 2; i <= 4; i++) {
        const campoDinamico = document.getElementById(`saas-jogador${i}`);
        if (campoDinamico) {
            const val = campoDinamico.value;
            if (!val || val === "") {
                temCampoAbertoEmBranco = true;
            } else if (val === 'convidado') {
                const cNome = (campoDinamico.dataset.convidadoNome || '').trim();
                const cWhats = (campoDinamico.dataset.convidadoWhats || '').trim();

                if (!cNome || cWhats.length !== 11) {
                    showToast(`Por favor, identifique os dados do Convidado no campo ${i}.`, "warning");
                    abrirModalIdentificacaoConvidadoSaaS(campoDinamico);
                    return;
                }

                slotsAgendamento.push({
                    tipo: 'convidado',
                    valorBruto: 'convidado',
                    nomeCompleto: cNome,
                    whatsapp: cWhats
                });
            } else {
                slotsAgendamento.push({
                    tipo: 'socio',
                    valorBruto: val
                });
            }
        }
    }

    if (temCampoAbertoEmBranco) {
        if (ehPartidaRanking) {
            showToast("Partidas de Ranking exigem a seleção obrigatória do desafiado.", "warning");
        } else {
            showToast("Por favor, selecione o atleta em todos os campos abertos ou remova os campos não utilizados antes de confirmar.", "warning");
        }
        return;
    }

    // ----------------------------------------------------
    // 1.5. ALFÂNDEGA DO QUÓRUM MÍNIMO
    // ----------------------------------------------------
    let quorumExigido = 1;
    if (typeof configRegrasGlobal !== 'undefined' && configRegrasGlobal) {
        if (pacote.duracao === 1) {
            quorumExigido = configRegrasGlobal.Quorum1h !== undefined ? parseInt(configRegrasGlobal.Quorum1h) : 1;
        } else {
            quorumExigido = configRegrasGlobal.Quorum2h !== undefined ? parseInt(configRegrasGlobal.Quorum2h) : 2;
        }
    }

    const qtdJogadoresPreenchidos = slotsAgendamento.length;
    if (qtdJogadoresPreenchidos < quorumExigido) {
        const txtHora = pacote.duracao === 1 ? 'hora' : 'horas';
        const txtJogador = quorumExigido === 1 ? 'jogador' : 'jogadores';
        showToast(`O quórum mínimo para ${pacote.duracao} ${txtHora} é de ${quorumExigido} ${txtJogador}. Adicione mais pessoas.`, "warning");
        return;
    }

    // ----------------------------------------------------
    // 2. ALFÂNDEGA SÍNCRONA
    // ----------------------------------------------------
    const erroDuplas = validarRegraDuplasSaaS(pacote.isDupla, qtdJogadoresPreenchidos);
    if (erroDuplas) {
        showToast(erroDuplas, "error");
        return;
    }

    // 🛡️ Dupla Checagem Backend: Garante que o convidado é permitido na quadra/horário
    const temConvidadoValidacao = slotsAgendamento.some(s => s.tipo === 'convidado');
    if (temConvidadoValidacao && typeof podeIncluirConvidadoSaaS === 'function') {
        const permiteConvidado = podeIncluirConvidadoSaaS(pacote.quadraAlvo, pacote.dia, pacote.hora, pacote.duracao);
        if (!permiteConvidado) {
            showToast("O horário ou quadra selecionada não permite a inclusão de convidados.", "error");
            return;
        }
    }

    // Trava a UI para processamento
    const btnSubmit = document.getElementById('btn-saas-confirmar-agendamento');
    if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.textContent = "Validando regras...";
    }

    // ----------------------------------------------------
    // 3. A GRANDE LEITURA (Snapshot + Resolução de Nomes)
    // ----------------------------------------------------
    const limiteAtivo = (configRegrasGlobal && configRegrasGlobal.LimiteReservas !== undefined) ? parseInt(configRegrasGlobal.LimiteReservas) : 3;

    Promise.all([
        database.ref(`${raizBanco}/jogadores`).once('value'),
        (limiteAtivo > 0) ? database.ref(`${raizBanco}/reservas`).once('value') : Promise.resolve(null),
        database.ref(`${raizBanco}/convites_ranking/temporadaId`).once('value')
    ]).then(([snapJogadores, snapReservas, snapTemporadaId]) => {
        const bancoJogadores = snapJogadores.val() || {};
        const todasReservas = snapReservas ? snapReservas.val() : null;
        const temporadaIdMestre = snapTemporadaId.exists() ? snapTemporadaId.val() : null;

        let listaApelidos = [];
        let listaNomesCompletosReais = [];
        const dadosConvidadosMap = {};

        // Resolução individual de Sócios vs Convidados
        slotsAgendamento.forEach(slot => {
            if (slot.tipo === 'convidado') {
                const apelidoConvidado = "Convidado";
                const nomeCompletoConvidado = `${slot.nomeCompleto} (Convidado)`;

                listaApelidos.push(apelidoConvidado);
                listaNomesCompletosReais.push(nomeCompletoConvidado);

                dadosConvidadosMap[slot.nomeCompleto] = {
                    nomeCompleto: slot.nomeCompleto,
                    whatsapp: slot.whatsapp,
                    statusTaxa: "pendente"
                };
            } else {
                const valorCampo = slot.valorBruto;
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
            }
        });

        // ----------------------------------------------------
        // 4. ALFÂNDEGA ASSÍNCRONA (Apenas para Sócios)
        // ----------------------------------------------------
        const sociosNomesCompletos = [];
        const sociosApelidos = [];
        slotsAgendamento.forEach((s, idx) => {
            if (s.tipo === 'socio') {
                sociosNomesCompletos.push(listaNomesCompletosReais[idx]);
                sociosApelidos.push(listaApelidos[idx]);
            }
        });

        const erroMonopolio = validarAntiMonopolioSaaS(sociosNomesCompletos, sociosApelidos, todasReservas, limiteAtivo);
        if (erroMonopolio) {
            showToast(erroMonopolio, "error", 4500);
            throw new Error("VALIDACAO_FALHOU");
        }

        const erroConflitoHorario = validarConflitoHorarioAtletaSaaS(sociosNomesCompletos, sociosApelidos, pacote, todasReservas);
        if (erroConflitoHorario) {
            showToast(erroConflitoHorario, "error", 4500);
            throw new Error("VALIDACAO_FALHOU");
        }

        // ----------------------------------------------------
        // 5. A GRAVAÇÃO ATÓMICA
        // ----------------------------------------------------
        if (btnSubmit) btnSubmit.textContent = "Agendando...";

        const stringApelidosExibicao = listaApelidos.join(', ');
        const stringCompletosExibicao = listaNomesCompletosReais.join(', ');
        
        let organizadorPrincipal = listaNomesCompletosReais[0] || "Sócio";
        let isOperadorExterno = false;

        if (typeof isGestorLogado !== 'undefined' && isGestorLogado) {
            organizadorPrincipal = "Administração (Gestor)";
            isOperadorExterno = true;
        } else {
            const nomeLogado = (localStorage.getItem('jogadorLogadoNome') || '').trim().toUpperCase();
            const nomeJ1 = (listaNomesCompletosReais[0] || '').trim().toUpperCase();
            
            if (nomeLogado !== "" && nomeLogado !== nomeJ1) {
                let perfis = {};
                try { perfis = JSON.parse(localStorage.getItem('jogadorLogadoPerfis') || '{}'); } catch(e) {}
                
                if (perfis['Admin'] === true) {
                    const capitalizarNomeTemp = (str) => {
                        if (!str) return '';
                        return str.split(' ').map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ');
                    };
                    organizadorPrincipal = capitalizarNomeTemp(nomeLogado) + " (Admin)";
                    isOperadorExterno = true;
                }
            }
        }

        const temConvidado = slotsAgendamento.some(s => s.tipo === 'convidado');
        const exigenciaAtiva = (configRegrasGlobal && configRegrasGlobal.ReservasPorConfirmacao !== false);
        const prazoHoras = (configRegrasGlobal && configRegrasGlobal.horasParaExpirar !== undefined) ? parseInt(configRegrasGlobal.horasParaExpirar) : 2;
        
        let objetoConfirmacoes = {};
        let statusFinal = "confirmada";
        let timestampExpiracao = null;

        const hojeObj = new Date();
        const strHoje = `${hojeObj.getFullYear()}-${String(hojeObj.getMonth() + 1).padStart(2, '0')}-${String(hojeObj.getDate()).padStart(2, '0')}`;
        const reservaParaHoje = (pacote.dataCompletaFormato === strHoje);

        // 🚨 REGRA DE OURO DO MÓDULO CONVIDADOS: Se tiver convidado, a reserva nasce SEMPRE pendente
        if (temConvidado) {
            statusFinal = "pendente";
            timestampExpiracao = Date.now() + (prazoHoras * 60 * 60 * 1000);

            slotsAgendamento.forEach((slot, i) => {
                const apelido = listaApelidos[i];
                if (slot.tipo === 'convidado') {
                    objetoConfirmacoes[apelido] = false; // Convidado nasce não confirmado até quitação da taxa
                } else {
                    if (i === 0 && !isOperadorExterno) {
                        objetoConfirmacoes[apelido] = true; 
                    } else if (!exigenciaAtiva || reservaParaHoje) {
                        objetoConfirmacoes[apelido] = true;
                    } else {
                        objetoConfirmacoes[apelido] = false;
                    }
                }
            });
        } else if (exigenciaAtiva && listaApelidos.length > 1 && !reservaParaHoje && !pacote.isRanking) {
            statusFinal = "pendente";
            timestampExpiracao = Date.now() + (prazoHoras * 60 * 60 * 1000);
            
            for (let i = 0; i < listaApelidos.length; i++) {
                if (i === 0 && !isOperadorExterno) {
                    objetoConfirmacoes[listaApelidos[i]] = true; 
                } else {
                    objetoConfirmacoes[listaApelidos[i]] = false; 
                }
            }
        } else {
            statusFinal = "confirmada";
            listaApelidos.forEach(apelido => {
                objetoConfirmacoes[apelido] = true;
            });
        }

        const objetoReservaReferencia = {
            borda: `${pacote.duracao}h`,
            status: statusFinal,                       
            dataCompleta: pacote.dataCompletaFormato,          
            dia: pacote.dia,
            hora: pacote.hora,
            duracao: pacote.duracao,
            isRanking: pacote.isRanking || false,
            tipo: pacote.tipo || "comum",
            organizador: organizadorPrincipal,          
            jogadores: stringApelidosExibicao,          
            jogadores_completo: stringCompletosExibicao,
            confirmacoes: objetoConfirmacoes            
        };

        if (temConvidado) {
            objetoReservaReferencia.dadosConvidados = dadosConvidadosMap;
        }

        if (timestampExpiracao) {
            objetoReservaReferencia.expiraEm = timestampExpiracao;
        }

        // Configurações do Ranking (mantidas integralmente)
        if (pacote.isRanking) {
            const confRanking = (configRegrasGlobal && configRegrasGlobal.ranking) ? configRegrasGlobal.ranking : {};
            const faseAtualRanking = parseInt(confRanking.faseAtual, 10) || 1;
            const modeloDisputaOficial = confRanking.calendario?.formatoTorneio;
            
            if (!modeloDisputaOficial) {
                showToast("Erro: O torneio ativo não possui um modelo de disputa configurado no contrato.", "error");
                throw new Error("VALIDACAO_FALHOU");
            }

            objetoReservaReferencia.modelo = modeloDisputaOficial;
            if (temporadaIdMestre) {
                objetoReservaReferencia.temporadaId = temporadaIdMestre;
            } else if (window.dadosTemporadaRankingAtiva && window.dadosTemporadaRankingAtiva.temporadaId) {
                objetoReservaReferencia.temporadaId = window.dadosTemporadaRankingAtiva.temporadaId;
            }

            objetoReservaReferencia.posicaoP1 = obterPosicaoTextoRankingSaaS(listaApelidos[0]);
            objetoReservaReferencia.posicaoP2 = obterPosicaoTextoRankingSaaS(listaApelidos[1]);

            const idAtleta1 = Object.keys(bancoJogadores).find(key => 
                bancoJogadores[key] && bancoJogadores[key].nomeCompleto && 
                bancoJogadores[key].nomeCompleto.toUpperCase() === listaNomesCompletosReais[0].toUpperCase()
            );
            const atleta1Obj = (idAtleta1 && bancoJogadores[idAtleta1]) ? bancoJogadores[idAtleta1] : {};
            const modoGenero = confRanking.divisaoGenero || 'separado';
            let generoKey = (atleta1Obj.genero || 'MASCULINO').toUpperCase();
            if (generoKey === 'NAO_INFORMAR') generoKey = 'MASCULINO';
            const classeKey = (atleta1Obj.classe || 'B').toUpperCase();
            const chaveTabela = (modoGenero === 'unificado') ? `${classeKey}_UNIFICADO` : `${classeKey}_${generoKey}`;

            objetoReservaReferencia.categoria = chaveTabela;

            const emMataMataDireto = (modeloDisputaOficial === 'grupos' && confRanking.grupos?.faseInicial === 'matamata');

            if (modeloDisputaOficial === 'grupos' && !emMataMataDireto && faseAtualRanking === 3) {
                if (idAtleta1 && typeof rankingTabelasGlobal !== 'undefined' && rankingTabelasGlobal[chaveTabela]) {
                    const idsArr = Array.isArray(rankingTabelasGlobal[chaveTabela]) ? rankingTabelasGlobal[chaveTabela] : Object.values(rankingTabelasGlobal[chaveTabela]);
                    const idx = idsArr.indexOf(idAtleta1);
                    if (idx !== -1) {
                        const tamanhoGrupo = parseInt(confRanking.grupos?.tamanhoGrupo, 10) || 3;
                        const numGrupo = Math.floor(idx / tamanhoGrupo) + 1;
                        objetoReservaReferencia.tagGrupoRanking = `G${numGrupo}`;
                        objetoReservaReferencia.tagFaseRanking = `Grupos - G${numGrupo}`;
                    }
                }
            } else if (modeloDisputaOficial === 'grupos' && ((emMataMataDireto && faseAtualRanking >= 3) || (!emMataMataDireto && faseAtualRanking >= 4))) {
                if (idAtleta1) {
                    const dadosChaveCat = (typeof rankingChavesGlobal !== 'undefined' && rankingChavesGlobal) ? rankingChavesGlobal[chaveTabela] : null;
                    const tamChave = dadosChaveCat ? parseInt(dadosChaveCat.faseAtual, 10) : 2;

                    if (typeof obterRotuloFaseMataMataSaaS === 'function') {
                        objetoReservaReferencia.tagFaseRanking = `Grupos - ${obterRotuloFaseMataMataSaaS(tamChave)}`;
                    } else {
                        objetoReservaReferencia.tagFaseRanking = "Grupos - Mata-Mata";
                    }
                }
            }
        }

        const chaveReservaLimpa = `${pacote.dia}_${pacote.hora}`;
        const caminhoKey1 = `${raizBanco}/reservas/${pacote.quadraAlvo}/${chaveReservaLimpa}`;
        const caminhoKey2 = `${raizBanco}/reservas/${pacote.quadraAlvo}/${pacote.dia}_${pacote.hora + 1}`;

        let key1Committed = false;

        return database.ref(caminhoKey1).transaction(currentData => {
            if (currentData === null || currentData.status === 'aula_cancelada') return objetoReservaReferencia;
            return;
        })
        .then(result1 => {
            if (!result1.committed) throw new Error("COLISAO_HORARIO_MESTRE");
            key1Committed = true;

            if (pacote.duracao === 1) return true;

            const objetoReservaReferencia2 = { ...objetoReservaReferencia, hora: pacote.hora + 1 };
            delete objetoReservaReferencia2.borda;

            return database.ref(caminhoKey2).transaction(currentData2 => {
                if (currentData2 === null || currentData2.status === 'aula_cancelada') return objetoReservaReferencia2;
                return;
            })
            .then(result2 => {
                if (!result2.committed) throw new Error("COLISAO_HORARIO_SEQUENCIAL");
                return true;
            });
        })
        .then(() => {
            if (typeof fecharModalConfig === 'function') fecharModalConfig('modal-agendamento');

            // 🎯 BIFURCAÇÃO PÓS-GRAVAÇÃO: Check-out vs Confirmação Regular
            if (temConvidado) {
                showToast("Horário pré-agendado! Conclua a taxa do convidado.", "info", 3500);
                abrirCheckoutConvidadoSaaS(objetoReservaReferencia, pacote.quadraAlvo);
            } else {
                showToast("Agendamento confirmado com sucesso!", "success");
            }
            
            // Push Notification para outros atletas
            if (!pacote.isRanking && statusFinal === "pendente") {
                const nomeOrgPuro = organizadorPrincipal.replace(/\s*\(.*?\)\s*/g, "").trim();
                if (typeof processarGatilhoPushSaaS === 'function') {
                    processarGatilhoPushSaaS(objetoReservaReferencia, nomeOrgPuro, pacote.quadraAlvo, "NOVO_CONVITE");
                }
            }
        });
    })
    .catch(async err => {
        if (typeof key1Committed !== 'undefined' && key1Committed && pacote.duracao === 2) {
            try {
                await database.ref(caminhoKey1).remove();
                console.log("🧹 [Rollback] 1ª hora removida para evitar reserva pela metade.");
            } catch (e) {
                console.error("Erro no rollback:", e);
            }
        }

        if (err.message === "VALIDACAO_FALHOU") {
            // Toast já emitido
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
        if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.textContent = "Confirmar Agendamento";
        }
    });
}


// ====================================================================
// 👥 MÓDULO CONVIDADOS: REATIVIDADE, IDENTIFICAÇÃO E MÁSCARA ESTREITA
// ====================================================================

/**
 * Avalia se a quadra e o horário selecionados permitem a inclusão de convidados
 */
function podeIncluirConvidadoSaaS(quadraNome, dia, hora, duracao) {
    // 1. Bloqueios de Tipo / Duração Especial
    const campoDuracao = document.getElementById('saas-duracao') || document.getElementById('saas-duracao-reserva');
    if (campoDuracao && (campoDuracao.value === 'ranking' || campoDuracao.value === '3-piramide')) {
        return false;
    }
    const selTipo = document.getElementById('saas-tipo-reserva');
    if (selTipo && (selTipo.value === 'aula' || selTipo.value === 'manutencao')) {
        return false;
    }

    // 2. Chave Mestra da Quadra
    const qNome = quadraNome || document.getElementById('saas-quadra')?.value || quadraSelecionadaSaaS || "Quadra 1";
    const match = qNome.match(/\d+/);
    const chaveQuadra = match ? `Quadra${match[0]}` : "Quadra1";

    const confConv = (typeof configConvidadosGlobal !== 'undefined' && configConvidadosGlobal) ? configConvidadosGlobal : {};
    const dadosQuadra = confConv[chaveQuadra];
    
    if (!dadosQuadra || dadosQuadra.Ativo !== true) {
        return false; // Chave Mestra OFF
    }

    // 3. Verificação de Horário 'Exceto' na Grade
    const campoDia = document.getElementById('saas-dia') || document.getElementById('saas-dia-reserva');
    const campoHora = document.getElementById('saas-hora') || document.getElementById('saas-hora-reserva');

    const d = dia !== undefined ? parseInt(dia, 10) : (campoDia ? parseInt(campoDia.value, 10) : 1);
    const h = hora !== undefined ? parseInt(hora, 10) : (campoHora && campoHora.value !== "" ? parseInt(campoHora.value, 10) : null);
    const durVal = duracao !== undefined ? parseInt(duracao, 10) : (campoDuracao ? parseInt(campoDuracao.value, 10) : 1);
    const dur = isNaN(durVal) ? 1 : durVal;

    if (h === null || isNaN(h)) {
        return true; // Se a hora ainda não foi fixada no livre, permite manter
    }

    const grade = dadosQuadra.Grade || {};
    if (grade[`${d}_${h}`] === true) {
        return false;
    }
    if (dur === 2 && grade[`${d}_${h + 1}`] === true) {
        return false;
    }

    return true;
}

/**
 * Atualiza dinamicamente as opções de Convidado em todos os seletores abertos
 */
function atualizarOpcoesConvidadosNosSelectsSaaS() {
    const container = document.getElementById('jogadoresContainerSaaS');
    if (!container) return;

    const pode = podeIncluirConvidadoSaaS();
    const selects = container.querySelectorAll('select.saas-field-atleta'); 

    selects.forEach(sel => {
        let optConvidado = sel.querySelector('option[value="convidado"]');
        let optDivisor = sel.querySelector('option[data-divisor="convidado"]');

        if (pode) {
            if (!optDivisor) {
                const linhaDivisoria = (window.innerWidth <= 767) ? '────────' : '──────────────────────────────';
                optDivisor = document.createElement('option');
                optDivisor.value = '';
                optDivisor.disabled = true;
                optDivisor.dataset.divisor = 'convidado';
                optDivisor.style.color = '#94a3b8';
                optDivisor.textContent = linhaDivisoria;
                sel.appendChild(optDivisor);
            }
            if (!optConvidado) {
                optConvidado = document.createElement('option');
                optConvidado.value = 'convidado';
                optConvidado.textContent = sel.dataset.convidadoNome 
                    ? `${formatarNomeJogador1GestorSaaS(sel.dataset.convidadoNome)} (Convidado)` 
                    : 'Convidado / Avulso';
                sel.appendChild(optConvidado);
            }
        } else {
            if (optConvidado) {
                if (sel.value === 'convidado') {
                    sel.value = '';
                    delete sel.dataset.convidadoNome;
                    delete sel.dataset.convidadoWhats;
                    showToast("O horário ou quadra selecionada não permite convidados. Campo resetado.", "warning");
                }
                optConvidado.remove();
            }
            if (optDivisor) {
                optDivisor.remove();
            }
        }
    });
}

/**
 * Trata a seleção do item "Convidado / Avulso" no dropdown
 */
function handleConvidadoSelectSaaS(el) {
    if (!el) return;
    if (el.value === 'convidado') {
        abrirModalIdentificacaoConvidadoSaaS(el);
    } else {
        delete el.dataset.convidadoNome;
        delete el.dataset.convidadoWhats;
        const opt = el.querySelector('option[value="convidado"]');
        if (opt) opt.textContent = 'Convidado / Avulso';
    }
}

/**
 * Abre o modal para coleta de Nome e WhatsApp do Convidado
 */
function abrirModalIdentificacaoConvidadoSaaS(selectEl) {
    if (!selectEl) return;
    if (navigator.vibrate) navigator.vibrate(25);

    document.getElementById('convidado-select-target-id').value = selectEl.id;
    const inpNome = document.getElementById('inp-convidado-nome');
    const inpWhats = document.getElementById('inp-convidado-whats');

    if (inpNome) inpNome.value = selectEl.dataset.convidadoNome || '';
    if (inpWhats) {
        inpWhats.value = selectEl.dataset.convidadoWhats || '';
        mascaraTelefoneConvidadoSaaS(inpWhats);
    }

    const modal = document.getElementById('modal-dados-convidado');
    if (modal) {
        modal.style.display = 'flex';
        setTimeout(() => {
            if (inpNome) inpNome.focus();
        }, 150);
    }
}

/**
 * Cancela a identificação e reseta o select se não houver dados salvos
 */
function cancelarModalDadosConvidadoSaaS() {
    const targetId = document.getElementById('convidado-select-target-id')?.value;
    const sel = document.getElementById(targetId);

    if (sel && !sel.dataset.convidadoNome) {
        sel.value = '';
        const opt = sel.querySelector('option[value="convidado"]');
        if (opt) opt.textContent = 'Convidado / Avulso';
    }

    const modal = document.getElementById('modal-dados-convidado');
    if (modal) modal.style.display = 'none';
}

/**
 * Validação e confirmação de Nome e WhatsApp do Convidado
 */
function confirmarDadosConvidadoSaaS() {
    const targetId = document.getElementById('convidado-select-target-id')?.value;
    const sel = document.getElementById(targetId);
    if (!sel) return;

    const nome = (document.getElementById('inp-convidado-nome')?.value || '').trim();
    const whats = (document.getElementById('inp-convidado-whats')?.value || '').trim();
    const whatsLimpo = whats.replace(/\D/g, '');

    if (!nome || nome.length < 3) {
        showToast("Informe o nome completo do convidado.", "warning");
        return;
    }

    if (whatsLimpo.length !== 11) {
        showToast("Digite um WhatsApp válido com DDD (ex: 41999998888).", "warning");
        return;
    }

    sel.dataset.convidadoNome = nome;
    sel.dataset.convidadoWhats = whatsLimpo;

    let optConvidado = sel.querySelector('option[value="convidado"]');
    if (!optConvidado) {
        optConvidado = document.createElement('option');
        optConvidado.value = 'convidado';
        sel.appendChild(optConvidado);
    }

    optConvidado.textContent = `${formatarNomeJogador1GestorSaaS(nome)} (Convidado)`;
    sel.value = 'convidado';

    const modal = document.getElementById('modal-dados-convidado');
    if (modal) modal.style.display = 'none';

    showToast(`Convidado ${nome.split(' ')[0]} confirmado!`, "success");
}

/**
 * Máscara estrita de telefone (DDD + 9 dígitos)
 */
function mascaraTelefoneConvidadoSaaS(el) {
    if (!el) return;
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


// ====================================================================
// 💳 MÓDULO CONVIDADOS: MOTOR DO CHECK-OUT PROVISÓRIO & WHATSAPP
// ====================================================================

let timerCheckoutIntervaloSaaS = null;
let dadosReservaCheckoutAtiva = null;
let modoPagadorCheckoutAtivo = 'titular';

/**
 * Abre o Modal de Check-out Provisório logo após salvar a reserva com convidados
 */
function abrirCheckoutConvidadoSaaS(reserva, quadraAlvo) {
    if (!reserva) return;
    if (navigator.vibrate) navigator.vibrate(35);

    dadosReservaCheckoutAtiva = {
        reserva: reserva,
        quadra: quadraAlvo
    };

    const numQuadra = (quadraAlvo || '').match(/\d+/);
    const chaveQuadra = numQuadra ? `Quadra${numQuadra[0]}` : "Quadra1";
    const confGeral = (typeof configConvidadosGlobal !== 'undefined' && configConvidadosGlobal) ? configConvidadosGlobal : {};
    const dadosConfigQ = confGeral[chaveQuadra] || confGeral;

    // 1. Identificação da quantidade de convidados
    const convidados = Object.keys(reserva.dadosConvidados || {});
    const qtdConvidados = convidados.length > 0 ? convidados.length : 1;

    // 2. Parâmetros Financeiros
    const taxaUnitStr = dadosConfigQ.Taxa || "0,00";
    const taxaUnitNum = parseFloat(taxaUnitStr.replace(/\./g, '').replace(',', '.')) || 0;
    const taxaTotalNum = taxaUnitNum * qtdConvidados;
    const taxaTotalFmt = taxaTotalNum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const chavePix = dadosConfigQ.ChavePix || "Chave PIX não configurada";
    const recebedor = dadosConfigQ.Recebedor || "Arena / Secretaria";

    // 3. Formatação da Data e Horários
    const diasSemana = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
    let dataTexto = "";
    if (reserva.dataCompleta) {
        const partes = reserva.dataCompleta.split('-');
        if (partes.length === 3) {
            const dt = new Date(parseInt(partes[0]), parseInt(partes[1]) - 1, parseInt(partes[2]));
            dataTexto = `${diasSemana[dt.getDay()]}, ${partes[2]}/${partes[1]}`;
        }
    }

    const duracao = parseInt(reserva.duracao) || 1;
    const hIni = String(reserva.hora).padStart(2, '0') + ":00";
    const hFim = String(reserva.hora + duracao).padStart(2, '0') + ":00";

    let nomeQuadraVisual = quadraAlvo;
    if (numQuadra && typeof configQuadrasGlobal !== 'undefined' && configQuadrasGlobal.nomes) {
        const dq = configQuadrasGlobal.nomes[numQuadra[0]];
        if (dq) nomeQuadraVisual = typeof dq === 'object' ? (dq.nome || `Quadra ${numQuadra[0]}`) : dq;
    }

    // 4. Injeção no DOM
    const elResumo = document.getElementById('checkout-resumo-texto');
    if (elResumo) {
        // Formatação inteligente (Title Case) para múltiplos nomes
        const nomesConvidadosList = convidados.map(c => {
            const nomeBruto = reserva.dadosConvidados[c].nomeCompleto || 'Avulso';
            return nomeBruto.toLowerCase().replace(/(?:^|\s)\S/g, a => a.toUpperCase());
        }).join(', ');
        
        // Rótulo Dinâmico: Singular ou Plural
        const rotuloConvidado = qtdConvidados > 1 ? "Convidados:" : "Convidado:";
        
        elResumo.innerHTML = `
            <fieldset class="prompt-saas-fieldset" style="margin: 0 0 12px 0; padding: 12px 14px; text-align: left; background-color: #f8fafc;">
                <legend class="prompt-saas-legend">${nomeQuadraVisual}</legend>
                <div style="font-size: 13px; color: #475569; line-height: 1.6;">
                    ${dataTexto} (${hIni} - ${hFim})<br>
                    <span>${rotuloConvidado} <b style="color: #1e293b;">${nomesConvidadosList || 'Avulso'}</b></span>
                </div>
            </fieldset>
        `;
        
        elResumo.style.background = 'transparent';
        elResumo.style.border = 'none';
        elResumo.style.padding = '0';
    }

    const elTotal = document.getElementById('checkout-valor-total');
    if (elTotal) {
        elTotal.textContent = qtdConvidados > 1 
            ? `${qtdConvidados} x ${taxaUnitNum} = R$ ${taxaTotalFmt}` 
            : `R$ ${taxaTotalFmt}`;
    }

    const elTitularPix = document.getElementById('checkout-titular-pix');
    if (elTitularPix) elTitularPix.textContent = recebedor;

    const elInputPix = document.getElementById('checkout-input-chave-pix');
    if (elInputPix) elInputPix.value = chavePix;

    const feedback = document.getElementById('checkout-feedback-copia');
    if (feedback) feedback.style.display = 'none';

    // 5. Inicialização da Chave Seletora no modo "titular" (Padrão)
    selecionarPagadorCheckoutSaaS('titular');

    // 6. Início do Contador Regressivo
    iniciarTimerCheckoutSaaS(reserva.expiraEm);

    const modal = document.getElementById('modal-checkout-convidado');
    if (modal) modal.style.display = 'flex';
}

/**
 * Fecha o Modal de Check-out Provisório
 */
function fecharCheckoutConvidadoSaaS() {
    const modal = document.getElementById('modal-checkout-convidado');
    if (modal) modal.style.display = 'none';

    if (timerCheckoutIntervaloSaaS) {
        clearInterval(timerCheckoutIntervaloSaaS);
        timerCheckoutIntervaloSaaS = null;
    }
}

/**
 * Contador regressivo com atualização segundo a segundo
 */
function iniciarTimerCheckoutSaaS(expiraEm) {
    if (timerCheckoutIntervaloSaaS) clearInterval(timerCheckoutIntervaloSaaS);

    const elTimer = document.getElementById('checkout-timer-regressivo');
    if (!elTimer || !expiraEm) return;

    const atualizar = () => {
        const agora = Date.now();
        const diff = expiraEm - agora;

        if (diff <= 0) {
            elTimer.textContent = "Expirado";
            clearInterval(timerCheckoutIntervaloSaaS);
        } else {
            const h = Math.floor(diff / (1000 * 60 * 60));
            const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const s = Math.floor((diff % (1000 * 60)) / 1000);
            elTimer.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        }
    };

    atualizar();
    timerCheckoutIntervaloSaaS = setInterval(atualizar, 1000);
}

/**
 * Copia a Chave PIX para a Área de Transferência
 */
function copiarChavePixCheckoutSaaS() {
    const input = document.getElementById('checkout-input-chave-pix');
    if (!input || !input.value) return;

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(input.value);
    } else {
        input.select();
        document.execCommand('copy');
    }

    if (navigator.vibrate) navigator.vibrate(20);

    const btn = document.getElementById('btn-copiar-pix');
    const feedback = document.getElementById('checkout-feedback-copia');

    if (btn) btn.classList.add('copiado');
    if (feedback) feedback.style.display = 'inline';

    setTimeout(() => {
        if (btn) btn.classList.remove('copiado');
        if (feedback) feedback.style.display = 'none';
    }, 2500);
}

/**
 * Alterna entre "Eu vou pagar" e "Convidado paga" no modal de Check-out
 */
function selecionarPagadorCheckoutSaaS(modo) {
    modoPagadorCheckoutAtivo = modo;

    const tabTitular = document.getElementById('tab-pagador-titular');
    const tabConvidado = document.getElementById('tab-pagador-convidado');
    const containerPix = document.getElementById('container-pix-arena');
    const btnAcao = document.getElementById('btn-acao-checkout-dinamico');
    const iconeAcao = document.getElementById('icone-acao-checkout-dinamico');
    const textoAcao = document.getElementById('texto-acao-checkout-dinamico');

    if (tabTitular) tabTitular.classList.toggle('active', modo === 'titular');
    if (tabConvidado) tabConvidado.classList.toggle('active', modo === 'convidado');

    if (modo === 'titular') {
        if (containerPix) containerPix.style.display = 'flex';
        if (btnAcao) btnAcao.className = 'btn-checkout-acao verde';
        if (iconeAcao) iconeAcao.textContent = 'receipt_long';
        if (textoAcao) textoAcao.textContent = 'Enviar Comprovante (Secretaria)';
    } else {
        if (containerPix) containerPix.style.display = 'none';
        if (btnAcao) btnAcao.className = 'btn-checkout-acao azul';
        if (iconeAcao) iconeAcao.textContent = 'forward_to_inbox';

        const convidados = Object.keys(dadosReservaCheckoutAtiva?.reserva?.dadosConvidados || {});
        if (textoAcao) {
            textoAcao.textContent = convidados.length > 1 
                ? 'Cobrar Convidados (WhatsApp)' 
                : 'Cobrar Convidado (WhatsApp)';
        }
    }
}

/**
 * Ponto de entrada do clique no botão único de ação do Check-out
 */
function executarAcaoCheckoutSaaS() {
    if (modoPagadorCheckoutAtivo === 'titular') {
        enviarComprovanteWhatsAppSaaS();
    } else {
        const r = dadosReservaCheckoutAtiva?.reserva;
        if (!r) return;

        const convidados = Object.keys(r.dadosConvidados || {});
        if (convidados.length > 1) {
            abrirSubSeletorConvidadosSaaS();
        } else if (convidados.length === 1) {
            cobrarConvidadoWhatsAppSaaS(r.dadosConvidados[convidados[0]]);
        } else {
            showToast("Nenhum dado de convidado registrado nesta reserva.", "warning");
        }
    }
}

/**
 * Abre o sub-seletor para cobrança individual quando houver múltiplos convidados em duplas
 */
function abrirSubSeletorConvidadosSaaS() {
    const r = dadosReservaCheckoutAtiva?.reserva;
    if (!r) return;

    const container = document.getElementById('lista-botoes-seletor-convidados');
    if (!container) return;
    container.innerHTML = '';

    const convidados = Object.keys(r.dadosConvidados || {});
    convidados.forEach(c => {
        const item = r.dadosConvidados[c];
        let nomeConv = (item.nomeCompleto || c).replace(/\s*\(.*?\)\s*/g, '').trim();
        nomeConv = nomeConv.toLowerCase().replace(/(?:^|\s)\S/g, a => a.toUpperCase());

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn-convidado-item';
        btn.innerHTML = `
            <span>${nomeConv}</span>
            <i class="material-icons" style="font-size: 18px; color: #0284c7;">chat</i>
        `;
        btn.onclick = () => {
            fecharSubSeletorConvidadosSaaS();
            cobrarConvidadoWhatsAppSaaS(item);
        };
        container.appendChild(btn);
    });

    const modal = document.getElementById('modal-seletor-convidados');
    if (modal) modal.style.display = 'flex';
}

/**
 * Fecha o sub-seletor de múltiplos convidados
 */
function fecharSubSeletorConvidadosSaaS(event) {
    if (event && event.target && event.target.id !== 'modal-seletor-convidados') return;
    const modal = document.getElementById('modal-seletor-convidados');
    if (modal) modal.style.display = 'none';
}

/**
 * Monta a mensagem executiva e abre o WhatsApp com os dados da reserva e convidados para a Secretaria
 */
function enviarComprovanteWhatsAppSaaS() {
    if (!dadosReservaCheckoutAtiva) return;

    const r = dadosReservaCheckoutAtiva.reserva;
    const qAlvo = dadosReservaCheckoutAtiva.quadra;

    const numQuadra = (qAlvo || '').match(/\d+/);
    const chaveQuadra = numQuadra ? `Quadra${numQuadra[0]}` : "Quadra1";
    const confGeral = (typeof configConvidadosGlobal !== 'undefined' && configConvidadosGlobal) ? configConvidadosGlobal : {};
    const dadosConfigQ = confGeral[chaveQuadra] || confGeral;

    // 1. Resolução do WhatsApp da Secretaria
    let whatsDestino = (dadosConfigQ.Whatsapp || dadosConfigQ.WhatsApp || dadosConfigQ.whatsapp || confGeral.Whatsapp || confGeral.WhatsApp || '').replace(/\D/g, '');
    if (!whatsDestino) {
        showToast("WhatsApp da secretaria não configurado.", "warning");
        return;
    }

    if (!whatsDestino.startsWith('55') && whatsDestino.length <= 11) {
        whatsDestino = '55' + whatsDestino;
    }

    // 2. Nome do Clube (dinâmico em CAIXA ALTA)
    let nomeClube = "CLUBE OLÍMPICO";
    const elNomeClube = document.getElementById('txt-nome-clube');
    if (elNomeClube && elNomeClube.textContent && elNomeClube.textContent.trim() !== "Carregando...") {
        nomeClube = elNomeClube.textContent.trim().toUpperCase();
    } else {
        const salvo = localStorage.getItem('setpoint_jogador_clube_nome');
        if (salvo && salvo.trim()) nomeClube = salvo.trim().toUpperCase();
    }

    // 3. Nome da Quadra
    let nomeQuadraVisual = qAlvo;
    if (numQuadra && typeof configQuadrasGlobal !== 'undefined' && configQuadrasGlobal.nomes) {
        const dq = configQuadrasGlobal.nomes[numQuadra[0]];
        if (dq) nomeQuadraVisual = typeof dq === 'object' ? (dq.nome || `Quadra ${numQuadra[0]}`) : dq;
    }

    // 4. Data Completa com Dia da Semana e Horários
    const duracao = parseInt(r.duracao) || 1;
    const hIni = String(r.hora).padStart(2, '0') + ":00";
    const hFim = String(r.hora + duracao).padStart(2, '0') + ":00";

    const diasSemana = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
    let horarioTexto = `${hIni} às ${hFim}`;

    if (r.dataCompleta) {
        const partes = r.dataCompleta.split('-');
        if (partes.length === 3) {
            const dt = new Date(parseInt(partes[0], 10), parseInt(partes[1], 10) - 1, parseInt(partes[2], 10));
            const diaSemanaNome = diasSemana[dt.getDay()] || '';
            horarioTexto = `${diaSemanaNome}, ${partes[2]}/${partes[1]}/${partes[0]} • ${hIni} às ${hFim}`;
        }
    }

    // 5. Titular em Title Case elegante
    let titularFormatado = (r.organizador || 'Sócio').replace(/\s*\(.*?\)\s*/g, '').trim();
    titularFormatado = titularFormatado.toLowerCase().replace(/(?:^|\s)\S/g, a => a.toUpperCase());

    // 6. Lista de Convidados formatada com máscara de telefone
    const convidados = Object.keys(r.dadosConvidados || {});
    const listaConvidadosTxt = convidados.map(c => {
        const item = r.dadosConvidados[c];
        let nomeConv = (item.nomeCompleto || c).replace(/\s*\(.*?\)\s*/g, '').trim();
        nomeConv = nomeConv.toLowerCase().replace(/(?:^|\s)\S/g, a => a.toUpperCase());

        const foneRaw = (item.whatsapp || '').replace(/\D/g, '');
        let foneFmt = item.whatsapp || '';
        if (foneRaw.length === 11) {
            foneFmt = `(${foneRaw.substring(0, 2)}) ${foneRaw.substring(2, 7)}-${foneRaw.substring(7)}`;
        } else if (foneRaw.length === 10) {
            foneFmt = `(${foneRaw.substring(0, 2)}) ${foneRaw.substring(2, 6)}-${foneRaw.substring(6)}`;
        }

        return `• ${nomeConv} - ${foneFmt}`;
    }).join('\n');

    // 7. Valor Total
    const totalTxt = document.getElementById('checkout-valor-total')?.textContent || 'R$ 0,00';
    const valorTotalFmt = totalTxt.includes('=') ? totalTxt.split('=').pop().trim() : totalTxt;

    // 8. Mensagem no formato oficial para a Secretaria
    const textoMensagem = 
`🎾 *${nomeClube}*
*Comprovante - Taxa de Convidado*

📍 *Local:* ${nomeQuadraVisual}
📅 *Horário:* ${horarioTexto}
👤 *Titular:* ${titularFormatado}

🎟️ *Convidado(s):*
${listaConvidadosTxt}

💰 *Valor Total:* ${valorTotalFmt}

_Segue anexo o comprovante do PIX para liberação da reserva na planilha._`;

    // 9. Abertura direta via API WhatsApp
    const url = `https://api.whatsapp.com/send?phone=${whatsDestino}&text=${encodeURIComponent(textoMensagem)}`;
    window.open(url, '_blank');
}

/**
 * Monta o convite individual e abre o WhatsApp diretamente para o Convidado
 */
function cobrarConvidadoWhatsAppSaaS(convidadoItem) {
    if (!dadosReservaCheckoutAtiva || !convidadoItem) return;

    const r = dadosReservaCheckoutAtiva.reserva;
    const qAlvo = dadosReservaCheckoutAtiva.quadra;

    const numQuadra = (qAlvo || '').match(/\d+/);
    const chaveQuadra = numQuadra ? `Quadra${numQuadra[0]}` : "Quadra1";
    const confGeral = (typeof configConvidadosGlobal !== 'undefined' && configConvidadosGlobal) ? configConvidadosGlobal : {};
    const dadosConfigQ = confGeral[chaveQuadra] || confGeral;

    // 1. Resolução do WhatsApp do Convidado
    let whatsDestinoConvidado = (convidadoItem.whatsapp || '').replace(/\D/g, '');
    if (!whatsDestinoConvidado) {
        showToast("WhatsApp do convidado não informado.", "warning");
        return;
    }
    if (!whatsDestinoConvidado.startsWith('55') && whatsDestinoConvidado.length <= 11) {
        whatsDestinoConvidado = '55' + whatsDestinoConvidado;
    }

    // 2. WhatsApp da Secretaria (para o link dentro da mensagem)
    let whatsSecretaria = (dadosConfigQ.Whatsapp || dadosConfigQ.WhatsApp || dadosConfigQ.whatsapp || confGeral.Whatsapp || confGeral.WhatsApp || '').replace(/\D/g, '');
    if (whatsSecretaria && !whatsSecretaria.startsWith('55') && whatsSecretaria.length <= 11) {
        whatsSecretaria = '55' + whatsSecretaria;
    }

    // 3. Nome do Clube (dinâmico em CAIXA ALTA)
    let nomeClube = "CLUBE OLÍMPICO";
    const elNomeClube = document.getElementById('txt-nome-clube');
    if (elNomeClube && elNomeClube.textContent && elNomeClube.textContent.trim() !== "Carregando...") {
        nomeClube = elNomeClube.textContent.trim().toUpperCase();
    } else {
        const salvo = localStorage.getItem('setpoint_jogador_clube_nome');
        if (salvo && salvo.trim()) nomeClube = salvo.trim().toUpperCase();
    }

    // 4. Nome da Quadra
    let nomeQuadraVisual = qAlvo;
    if (numQuadra && typeof configQuadrasGlobal !== 'undefined' && configQuadrasGlobal.nomes) {
        const dq = configQuadrasGlobal.nomes[numQuadra[0]];
        if (dq) nomeQuadraVisual = typeof dq === 'object' ? (dq.nome || `Quadra ${numQuadra[0]}`) : dq;
    }

    // 5. Data Completa com Horários
    const duracao = parseInt(r.duracao) || 1;
    const hIni = String(r.hora).padStart(2, '0') + ":00";
    const hFim = String(r.hora + duracao).padStart(2, '0') + ":00";

    const mesesCurto = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const diasSemana = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
    let horarioTexto = `${r.hora}h`;
    let dataResumo = "Data a confirmar";

    if (r.dataCompleta) {
        const partes = r.dataCompleta.split('-');
        if (partes.length === 3) {
            const dt = new Date(parseInt(partes[0], 10), parseInt(partes[1], 10) - 1, parseInt(partes[2], 10));
            const diaSemanaNome = diasSemana[dt.getDay()] || '';
            const mesNome = mesesCurto[dt.getMonth()] || '';
            horarioTexto = `${diaSemanaNome}, ${partes[2]} ${mesNome} • ${r.hora}h`;
            dataResumo = `${diaSemanaNome}, ${partes[2]} ${mesNome}`;
        }
    }

    // 6. Nomes Formatados
    let titularFormatado = (r.organizador || 'Sócio').replace(/\s*\(.*?\)\s*/g, '').trim();
    titularFormatado = titularFormatado.toLowerCase().replace(/(?:^|\s)\S/g, a => a.toUpperCase());

    let nomeConv = (convidadoItem.nomeCompleto || 'Convidado').replace(/\s*\(.*?\)\s*/g, '').trim();
    nomeConv = nomeConv.toLowerCase().replace(/(?:^|\s)\S/g, a => a.toUpperCase());

    // 7. Parâmetros Financeiros Individuais (sem centavos desnecessários para não ativar o WhatsApp Pay)
    const taxaUnitStr = dadosConfigQ.Taxa || "0";
    const taxaNum = parseFloat(taxaUnitStr.replace(/\./g, '').replace(',', '.')) || 0;
    const taxaFormatada = (taxaNum % 1 === 0) 
        ? `${taxaNum}` 
        : taxaNum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const chavePix = dadosConfigQ.ChavePix || confGeral.ChavePix || "Chave PIX não configurada";
    const recebedor = (dadosConfigQ.Recebedor || confGeral.Recebedor || "Secretaria").trim();

    // 8. Formatação do WhatsApp da Secretaria para exibição direta
    const whatsSecRaw = (dadosConfigQ.Whatsapp || dadosConfigQ.WhatsApp || dadosConfigQ.whatsapp || confGeral.Whatsapp || confGeral.WhatsApp || '').replace(/\D/g, '');
    let whatsSecFormatado = dadosConfigQ.Whatsapp || confGeral.Whatsapp || '';

    if (whatsSecRaw.length === 11) {
        whatsSecFormatado = `(${whatsSecRaw.substring(0, 2)}) ${whatsSecRaw.substring(2, 7)}-${whatsSecRaw.substring(7)}`;
    } else if (whatsSecRaw.length === 10) {
        whatsSecFormatado = `(${whatsSecRaw.substring(0, 2)}) ${whatsSecRaw.substring(2, 6)}-${whatsSecRaw.substring(6)}`;
    } else if (whatsSecRaw.length === 13 && whatsSecRaw.startsWith('55')) {
        whatsSecFormatado = `(${whatsSecRaw.substring(2, 4)}) ${whatsSecRaw.substring(4, 9)}-${whatsSecRaw.substring(9)}`;
    } else if (whatsSecRaw.length === 12 && whatsSecRaw.startsWith('55')) {
        whatsSecFormatado = `(${whatsSecRaw.substring(2, 4)}) ${whatsSecRaw.substring(4, 8)}-${whatsSecRaw.substring(8)}`;
    }

    // 9. Mensagem de cobrança e convite para o Visitante
    const textoMensagemConvidado = 
`🎾 *${nomeClube}*
*Convite de Jogo & Taxa de Convidado*

Olá, *${nomeConv}*!
*${titularFormatado}* convidou você:

📍 *Local:* ${nomeQuadraVisual}
📅 *Horário:* ${horarioTexto}
💰 *Taxa Individual:* R$ ${taxaFormatada}

🔑 *Chave PIX da Arena:* ${chavePix}
👤 *Titular PIX:* ${recebedor}

⚠️ *Para confirmar sua vaga:*
Faça o PIX e envie o comprovante para:
📲 ${whatsSecFormatado} (${recebedor})
informe: Convidado • Nome • Data

Nos vemos na quadra!`;

    // 10. Abertura do WhatsApp do Convidado
    const url = `https://api.whatsapp.com/send?phone=${whatsDestinoConvidado}&text=${encodeURIComponent(textoMensagemConvidado)}`;
    window.open(url, '_blank');
}