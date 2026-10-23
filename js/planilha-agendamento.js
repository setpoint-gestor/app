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
                    opt.textContent = expurgarEAbreviarNomeSaaS(j.nomeCompleto, j.apelido); 
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

					// 💉 INJEÇÃO: Uma célula de dupla só está ocupada se o texto dela NÃO for mais "Dupla"
					const estaOcupada = celAtual.classList.contains('celula-ocupada') || 
										celAtual.classList.contains('celula-aula') || 
										celAtual.classList.contains('celula-manutencao') || 
										(celAtual.classList.contains('celula-dupla') && celAtual.textContent.trim() !== 'Dupla') || 
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
            if (campoDuracao) campoDuracao.value = "1";
            console.log("🔒 [Boot SaaS] Smart Lock Ativado. Hora Gravada na Memória:", horarioBloqueadoPelaTabela);
        } else {
            // ➕ MODO BOTÃO (+): Limpa completamente o passado para evitar memória fantasma
            horarioBloqueadoPelaTabela = null;
            if (campoDia.options.length > 0) {
                campoDia.selectedIndex = 0;
            }
            if (campoDuracao) campoDuracao.value = "1";
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
            if (s !== selAtual && s.value) {
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
    
    Array.from(sel.options).forEach(opt => {
        const id = opt.value;
        if (!id || id === "") return;
        
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
            if (exibirCompleto) {
                const apelidoTxt = atleta.apelido ? ' (' + atleta.apelido + ')' : '';
                opt.textContent = atleta.nomeCompleto + apelidoTxt;
            } else {
                opt.textContent = expurgarEAbreviarNomeSaaS(atleta.nomeCompleto, atleta.apelido);
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
                    const textoAbreviado = expurgarEAbreviarNomeSaaS(atleta.nomeCompleto, atleta.apelido);
                    
                    if (proibidos.includes(id)) {
                        sel.innerHTML += '<option value="' + id + '" disabled style="display:none;">' + textoAbreviado + '</option>';
                    } else {
                        sel.innerHTML += '<option value="' + id + '">' + textoAbreviado + '</option>';
                    }
                }
            });
        } else {
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
        sel.addEventListener('change', () => alternarTextoOpcoesSaaS(sel, false));
        
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

function handleConvidadoSelectSaaS(el) {}

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
            
            // 🎯 CONSOLIDAÇÃO DE ATLETAS VÁLIDOS NAS TABELAS: Cria uma lista de todos os IDs de quem está competindo ativamente
            const atletasValidosNaTabela = new Set();
            if (typeof rankingTabelasGlobal !== 'undefined' && rankingTabelasGlobal) {
                Object.values(rankingTabelasGlobal).forEach(categoriaTabela => {
                    const idsCategoria = Array.isArray(categoriaTabela) ? categoriaTabela : Object.values(categoriaTabela);
                    idsCategoria.forEach(id => { if (id) atletasValidosNaTabela.add(id); });
                });
            }

            const precisaPovoar = (selJ1.options.length <= 1) || 
                     (selJ1.options[0].textContent !== 'Selecionar Jogador 1...');

            if (precisaPovoar) {
                const valSalvoJ1 = selJ1.value;
                selJ1.innerHTML = '<option value="">Selecionar Jogador 1...</option>';

                if (typeof jogadoresGlobal !== 'undefined' && Object.keys(jogadoresGlobal).length > 0) {
                    Object.keys(jogadoresGlobal).forEach(id => {
                        const j = jogadoresGlobal[id];
                        // 🎯 FILTRO DE ALTA PRECISÃO: Exige que o atleta esteja ativo, apto ao ranking e presente nas tabelas de sorteio/chaves
                        const participaETaNaTabela = j && j.ativo !== false && j.participaRanking && atletasValidosNaTabela.has(id);
                        if (participaETaNaTabela) {
                            const opt = document.createElement('option');
                            opt.value = id;
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
        listaCamposBrutos: [],
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

        return; // 🛑 ABORTA O FLUXO NORMAL (Para não exigir a validação do campo Jogadores)
    }

    // ====================================================================
    // FLUXO PADRÃO (JOGOS E RANKING) - CONTINUA INTACTO
    // ====================================================================
    const celAlvo1 = document.getElementById(`cel-${pacote.hora}-${pacote.dia}`);
    const celAlvo2 = (pacote.duracao === 2) ? document.getElementById(`cel-${pacote.hora + 1}-${pacote.dia}`) : null;
    pacote.isDupla = (celAlvo1 && celAlvo1.classList.contains('celula-dupla')) || (celAlvo2 && celAlvo2.classList.contains('celula-dupla'));

    // ----------------------------------------------------
    // 🚨 TRAVA DE SEGURANÇA: VALIDAÇÃO DE CAMPOS ABERTOS / EMBRANCO
    // ----------------------------------------------------
    const j1Select = document.getElementById('saas-jogador1');
    if (!j1Select || !j1Select.value || j1Select.value === "") {
        showToast("Por favor, selecione o organizador/atleta 1.", "warning");
        return;
    }
    pacote.listaCamposBrutos.push(j1Select.value);

    let temCampoAbertoEmBranco = false;
    for (let i = 2; i <= 4; i++) {
        const campoDinamico = document.getElementById(`saas-jogador${i}`);
        if (campoDinamico) {
            if (!campoDinamico.value || campoDinamico.value === "") {
                temCampoAbertoEmBranco = true;
            } else {
                pacote.listaCamposBrutos.push(campoDinamico.value);
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
    // 1.5. ALFÂNDEGA DO QUÓRUM MÍNIMO (Barreira de Entrada)
    // ----------------------------------------------------
    let quorumExigido = 1;
    if (typeof configRegrasGlobal !== 'undefined' && configRegrasGlobal) {
        if (pacote.duracao === 1) {
            quorumExigido = configRegrasGlobal.Quorum1h !== undefined ? parseInt(configRegrasGlobal.Quorum1h) : 1;
        } else {
            quorumExigido = configRegrasGlobal.Quorum2h !== undefined ? parseInt(configRegrasGlobal.Quorum2h) : 2;
        }
    }

    // Conta quantos jogadores foram preenchidos no formulário
    const qtdJogadoresPreenchidos = pacote.listaCamposBrutos.length;

    if (qtdJogadoresPreenchidos < quorumExigido) {
        const txtHora = pacote.duracao === 1 ? 'hora' : 'horas';
        const txtJogador = quorumExigido === 1 ? 'jogador' : 'jogadores';
        
        showToast(`O quórum mínimo para ${pacote.duracao} ${txtHora} é de ${quorumExigido} ${txtJogador}. Adicione mais pessoas.`, "warning");
        return;
    }

    // ----------------------------------------------------
    // 2. ALFÂNDEGA SÍNCRONA (Validações imediatas sem banco)
    // ----------------------------------------------------
    const erroDuplas = validarRegraDuplasSaaS(pacote.isDupla, qtdJogadoresPreenchidos);
    if (erroDuplas) {
        showToast(erroDuplas, "error");
        return;
    }

    // Trava a UI para processamento
    const btnSubmit = document.getElementById('btn-saas-confirmar-agendamento');
    if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.textContent = "Validando regras...";
    }

    // ----------------------------------------------------
    // 3. A GRANDE LEITURA (Snapshot Fotográfico + Captura SSOT do temporadaId)
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

        // Converte as identidades brutas da UI em nomes reais
        pacote.listaCamposBrutos.forEach(valorCampo => {
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
        });

        // ----------------------------------------------------
        // 4. ALFÂNDEGA ASSÍNCRONA (Validações usando os dados)
        // ----------------------------------------------------
        const erroMonopolio = validarAntiMonopolioSaaS(listaNomesCompletosReais, listaApelidos, todasReservas, limiteAtivo);
        if (erroMonopolio) {
            showToast(erroMonopolio, "error", 4500);
            throw new Error("VALIDACAO_FALHOU");
        }

        // 🛑 TRAVA DE DUPLO AGENDAMENTO
        const erroConflitoHorario = validarConflitoHorarioAtletaSaaS(listaNomesCompletosReais, listaApelidos, pacote, todasReservas);
        if (erroConflitoHorario) {
            showToast(erroConflitoHorario, "error", 4500);
            throw new Error("VALIDACAO_FALHOU");
        }

        // ----------------------------------------------------
        // 5. A GRAVAÇÃO (Transação Atômica no Firebase)
        // ----------------------------------------------------
        if (btnSubmit) btnSubmit.textContent = "Agendando...";

        const stringApelidosExibicao = listaApelidos.join(', ');
        const stringCompletosExibicao = listaNomesCompletosReais.join(', ');
        
        let organizadorPrincipal = listaNomesCompletosReais[0] || "Sócio";

        // 🌟 LÓGICA DO ORGANIZADOR: IDENTIFICA SE FOI UMA OPERAÇÃO EXTERNA DA QUADRA
        let isOperadorExterno = false;

        if (typeof isGestorLogado !== 'undefined' && isGestorLogado) {
            organizadorPrincipal = "Administração (Gestor)";
            isOperadorExterno = true;
        } else {
            const nomeLogado = (localStorage.getItem('jogadorLogadoNome') || '').trim().toUpperCase();
            const nomeJ1 = (listaNomesCompletosReais[0] || '').trim().toUpperCase();
            
            // O Sócio que está agendando é Admin, MAS NÃO colocou ele mesmo no Jogador 1. 
            // Ele está agindo como a Secretaria.
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

        const exigenciaAtiva = (configRegrasGlobal && configRegrasGlobal.ReservasPorConfirmacao !== false);
        const prazoHoras = (configRegrasGlobal && configRegrasGlobal.horasParaExpirar !== undefined) ? parseInt(configRegrasGlobal.horasParaExpirar) : 2;
        
        let objetoConfirmacoes = {};
        let statusFinal = "confirmada";
        let timestampExpiracao = null;

        const hojeObj = new Date();
        const strHoje = `${hojeObj.getFullYear()}-${String(hojeObj.getMonth() + 1).padStart(2, '0')}-${String(hojeObj.getDate()).padStart(2, '0')}`;
        const reservaParaHoje = (pacote.dataCompletaFormato === strHoje);

        if (exigenciaAtiva && listaApelidos.length > 1 && !reservaParaHoje && !pacote.isRanking) {
            statusFinal = "pendente";
            timestampExpiracao = Date.now() + (prazoHoras * 60 * 60 * 1000);
            
            for (let i = 0; i < listaApelidos.length; i++) {
                // Se a reserva foi criada por um Operador Externo (Gestor ou Admin para outros), 
                // NINGUÉM entra confirmado na quadra. Todos ficam pendentes.
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

        // PASSO 1: CONGELAMENTO HISTÓRICO DE POSIÇÕES, TAGS E CARIMBO MESTRE DE TEMPORADA
        if (pacote.isRanking) {
            const confRanking = (configRegrasGlobal && configRegrasGlobal.ranking) ? configRegrasGlobal.ranking : {};
            const faseAtualRanking = parseInt(confRanking.faseAtual, 10) || 1;

            // 🎯 SSOT: Lê estritamente o modelo oficial cadastrado no contrato do torneio (calendario.formatoTorneio)
            const modeloDisputaOficial = confRanking.calendario?.formatoTorneio;
            
            if (!modeloDisputaOficial) {
                showToast("Erro: O torneio ativo não possui um modelo de disputa configurado no contrato.", "error");
                throw new Error("VALIDACAO_FALHOU");
            }

            // 🎯 GRAVAÇÃO IMUTÁVEL DO MODELO NA RESERVA
            objetoReservaReferencia.modelo = modeloDisputaOficial;

            // 🎯 CARIMBO MESTRE DA TEMPORADA ATIVA
            if (temporadaIdMestre) {
                objetoReservaReferencia.temporadaId = temporadaIdMestre;
            } else if (window.dadosTemporadaRankingAtiva && window.dadosTemporadaRankingAtiva.temporadaId) {
                objetoReservaReferencia.temporadaId = window.dadosTemporadaRankingAtiva.temporadaId;
            }

            // 🎯 SSOT UNIFICADO: Congela as posições de ranking dos atletas em TODOS os modelos (Pirâmide, Barragem e Grupos)
            objetoReservaReferencia.posicaoP1 = obterPosicaoTextoRankingSaaS(listaApelidos[0]);
            objetoReservaReferencia.posicaoP2 = obterPosicaoTextoRankingSaaS(listaApelidos[1]);

            const emMataMataDireto = (modeloDisputaOficial === 'grupos' && confRanking.grupos?.faseInicial === 'matamata');

            if (modeloDisputaOficial === 'grupos' && !emMataMataDireto && faseAtualRanking === 3) {
                const idAtleta1 = Object.keys(bancoJogadores).find(key => 
                    bancoJogadores[key] && bancoJogadores[key].nomeCompleto && 
                    bancoJogadores[key].nomeCompleto.toUpperCase() === listaNomesCompletosReais[0].toUpperCase()
                );
                if (idAtleta1 && typeof rankingTabelasGlobal !== 'undefined') {
                    const atleta1Obj = bancoJogadores[idAtleta1] || {};
                    const modoGenero = confRanking.divisaoGenero || 'separado';
                    let generoKey = (atleta1Obj.genero || 'MASCULINO').toUpperCase();
                    if (generoKey === 'NAO_INFORMAR') generoKey = 'MASCULINO';
                    const classeKey = (atleta1Obj.classe || 'B').toUpperCase();
                    const chaveTabela = (modoGenero === 'unificado') ? `${classeKey}_UNIFICADO` : `${classeKey}_${generoKey}`;

                    if (rankingTabelasGlobal[chaveTabela]) {
                        const idsArr = Array.isArray(rankingTabelasGlobal[chaveTabela]) ? rankingTabelasGlobal[chaveTabela] : Object.values(rankingTabelasGlobal[chaveTabela]);
                        const idx = idsArr.indexOf(idAtleta1);
                        if (idx !== -1) {
                            const tamanhoGrupo = parseInt(confRanking.grupos?.tamanhoGrupo, 10) || 3;
                            const numGrupo = Math.floor(idx / tamanhoGrupo) + 1;
                            objetoReservaReferencia.tagGrupoRanking = `G${numGrupo}`;
                            objetoReservaReferencia.tagFaseRanking = `Grupos - G${numGrupo}`;
                        }
                    }
                }
            } else if (modeloDisputaOficial === 'grupos' && ((emMataMataDireto && faseAtualRanking >= 3) || (!emMataMataDireto && faseAtualRanking >= 4))) {
                const idAtleta1 = Object.keys(bancoJogadores).find(key => 
                    bancoJogadores[key] && bancoJogadores[key].nomeCompleto && 
                    bancoJogadores[key].nomeCompleto.toUpperCase() === listaNomesCompletosReais[0].toUpperCase()
                );
                if (idAtleta1) {
                    const atleta1Obj = bancoJogadores[idAtleta1] || {};
                    const modoGenero = confRanking.divisaoGenero || 'separado';
                    let generoKey = (atleta1Obj.genero || 'MASCULINO').toUpperCase();
                    if (generoKey === 'NAO_INFORMAR') generoKey = 'MASCULINO';
                    const classeKey = (atleta1Obj.classe || 'B').toUpperCase();
                    const chaveTabela = (modoGenero === 'unificado') ? `${classeKey}_UNIFICADO` : `${classeKey}_${generoKey}`;

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

        if (timestampExpiracao) {
            objetoReservaReferencia.expiraEm = timestampExpiracao;
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
                if (!result2.committed) {
                    throw new Error("COLISAO_HORARIO_SEQUENCIAL");
                }
                return true;
            });
        })
        .then(() => {
            showToast("Agendamento confirmado com sucesso!", "success");
            if (typeof fecharModalConfig === 'function') fecharModalConfig('modal-agendamento'); 
            
            // 🔔 GATILHO DE NOTIFICAÇÃO PUSH (EVENTO 1)
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
                console.log("🧹 [Rollback] 1ª hora removida com sucesso para evitar reserva pela metade.");
            } catch (e) {
                console.error("Erro ao executar rollback no banco:", e);
            }
        }

        if (err.message === "VALIDACAO_FALHOU") {
            // Toast emitido previamente
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