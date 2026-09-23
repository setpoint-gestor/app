"use strict";

/**
 * ========================================================
 * 🏆 MÓDULO RANKING SAAS - VISÃO PIRÂMIDE LÚDICA
 * Arquivo isolado para cálculo geométrico dos degraus,
 * extração de nomes, cabeçalhos dinâmicos e renderização.
 * ========================================================
 */

function formatarNomePiramideSaaS(atleta) {
    if (!atleta) return 'Atleta';

    const cap = (str) => (typeof capitalizarNome === 'function') ? capitalizarNome(str) : str;

    // 1. Prioriza Apelido se for de APENAS 1 palavra (ex: "Joca", "Guga")
    if (atleta.apelido && atleta.apelido.trim()) {
        const apelidoTrim = atleta.apelido.trim();
        const palavrasApelido = apelidoTrim.split(/\s+/);
        if (palavrasApelido.length === 1) {
            return cap(palavrasApelido[0]);
        }
    }

    // 2. Se o apelido for composto (> 1 palavra) ou não existir:
    // Padrão: Primeiro Nome + Inicial do Último Sobrenome (sem conectivos)
    const nomeBruto = atleta.nomeCompleto || atleta.apelido || 'Atleta';
    const palavras = nomeBruto.trim().split(/\s+/);

    if (palavras.length === 1) {
        return cap(palavras[0]);
    }

    const primeiroNome = cap(palavras[0]);
    const conectivos = ['de', 'da', 'do', 'dos', 'das'];
    let inicialSobrenome = '';

    for (let i = palavras.length - 1; i > 0; i--) {
        const p = palavras[i].toLowerCase();
        if (!conectivos.includes(p)) {
            inicialSobrenome = palavras[i].charAt(0).toUpperCase() + '.';
            break;
        }
    }

    return inicialSobrenome ? `${primeiroNome} ${inicialSobrenome}` : primeiroNome;
}

function extrairPrimeiroNomeSaaS(nomeBruto) {
    if (!nomeBruto) return "ATLETA";
    const partes = nomeBruto.trim().split(/\s+/);
    return partes[0].toUpperCase();
}

function agruparAtletasEmDegrausSaaS(listaAtletas) {
    const degraus = [];
    let index = 0;
    let tamanhoDegrau = 1;

    while (index < listaAtletas.length) {
        degraus.push(listaAtletas.slice(index, index + tamanhoDegrau));
        index += tamanhoDegrau;
        tamanhoDegrau++;
    }
    return degraus;
}

function renderizarVisaoPiramideSaaS(containerAlvo, listaIDs, idLogado, fnAlternar, isHistorico = false) {
    if (!containerAlvo || !Array.isArray(listaIDs) || listaIDs.length === 0) return;

    // 🧠 MONTAGEM DO CABEÇALHO DINÂMICO (INVISÍVEL NO ECRÃ / EXCLUSIVO DA FOTO)
    const elNomeClube = document.getElementById('txt-nome-clube');
    let nomeClube = elNomeClube ? elNomeClube.textContent.trim() : 'CLUBE';
    if (!nomeClube || nomeClube.toUpperCase() === 'CARREGANDO...') {
        nomeClube = localStorage.getItem('setpoint_jogador_clube_nome') || 'CLUBE';
    }
    nomeClube = nomeClube.toUpperCase();

    const confRanking = (typeof configRegrasGlobal !== 'undefined' && configRegrasGlobal.ranking) ? configRegrasGlobal.ranking : {};
    const faseAtual = parseInt(confRanking.faseAtual, 10) || 1;

    let nomeTorneio = 'Torneio Pirâmide';
    let catTxt = '';
    let subtituloTxt = 'Escada Oficial de Desafios';
    let badgeTxt = '⚡ Em Andamento';
    let badgeBg = '#fef3c7';
    let badgeColor = '#d97706';
    let badgeBorder = '#fde68a';

    if (isHistorico && typeof edicaoHistoricaFocoSaaS !== 'undefined' && edicaoHistoricaFocoSaaS) {
        const cal = edicaoHistoricaFocoSaaS.contrato || {};
        nomeTorneio = cal.nomeTorneio || 'Torneio Histórico';
        if (typeof categoriaHistoricaAtivaSaaS !== 'undefined' && categoriaHistoricaAtivaSaaS) {
            catTxt = categoriaHistoricaAtivaSaaS.replace('CLASSE_', 'Classe ').replace('_', ' ');
            catTxt = (typeof capitalizarNome === 'function') ? capitalizarNome(catTxt) : catTxt;
        }
        subtituloTxt = 'Edição Encerrada';
        badgeTxt = '📦 Acervo Histórico';
        badgeBg = '#f1f5f9';
        badgeColor = '#475569';
        badgeBorder = '#cbd5e1';
    } else {
        const cal = confRanking.calendario || {};
        nomeTorneio = cal.nomeTorneio || 'Torneio Pirâmide';
        
        const selClasse = document.getElementById('select-leaderboard-classe');
        const selGenero = document.getElementById('select-leaderboard-genero');
        const txtClasse = selClasse ? `Classe ${selClasse.value}` : (typeof abaClasseAtivaSaaS !== 'undefined' ? `Classe ${abaClasseAtivaSaaS}` : '');
        const txtGenero = (selGenero && selGenero.value !== 'UNIFICADO') ? selGenero.value : (typeof abaGeneroAtivaSaaS !== 'undefined' && abaGeneroAtivaSaaS !== 'UNIFICADO' ? abaGeneroAtivaSaaS : '');
        catTxt = [txtClasse, (typeof capitalizarNome === 'function' && txtGenero ? capitalizarNome(txtGenero) : txtGenero)].filter(Boolean).join(' • ');

        if (faseAtual >= 4) {
            subtituloTxt = 'Classificação Final Homologada';
            badgeTxt = '🏆 Resultado Oficial';
            badgeBg = '#dcfce7';
            badgeColor = '#15803d';
            badgeBorder = '#86efac';
        }
    }

    const dataHoje = new Date().toLocaleDateString('pt-BR');

    // Agrupa os atletas em camadas crescentes (1, 2, 3, 4...)
    const tiers = [];
    let index = 0;
    let tierSize = 1;

    while (index < listaIDs.length) {
        tiers.push(listaIDs.slice(index, index + tierSize));
        index += tierSize;
        tierSize++;
    }

    const totalTiers = tiers.length;
    const minWidth = 26;
    const maxWidth = 100;

    // 🏆 Botão de alternar visão (Canto Superior Direito)
    let btnToggleHtml = '';
    if (!isHistorico && typeof fnAlternar === 'function') {
        btnToggleHtml = `
            <button type="button" class="floating-toggle-btn" onclick="alternarVisaoPiramideSaaS()" title="Voltar para a Visão Lista" data-html2canvas-ignore="true">
                <span class="material-icons" style="font-size: 22px;">format_list_bulleted</span>
            </button>
        `;
    }

    // 📸 Botão PNG Verde Esmeralda Vazado (Compacto 38x38px - Simétrico ao botão do topo)
    const btnPngHtml = `
        <button type="button" onclick="exportarPiramidePNGSaaS()" title="Exportar Imagem PNG" data-html2canvas-ignore="true" style="position: absolute; bottom: 12px; right: 12px; width: 38px; height: 38px; background-color: #ffffff; border: 1.5px solid #10b981; border-radius: 10px; color: #10b981; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(16, 185, 129, 0.15); z-index: 10; transition: transform 0.2s, background-color 0.2s;" onmouseover="this.style.transform='scale(1.08)'; this.style.backgroundColor='#f0fdf4';" onmouseout="this.style.transform='scale(1)'; this.style.backgroundColor='#ffffff';">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5 9V17C5 18.1046 5.89543 19 7 19H15" stroke="#10b981" stroke-width="2.5" stroke-linecap="round"/>
                <rect x="9" y="4" width="11" height="11" rx="2" fill="#10b981"/>
                <text x="14.5" y="11.8" fill="#ffffff" font-size="4.8" font-family="Arial, sans-serif" font-weight="900" text-anchor="middle">PNG</text>
            </svg>
        </button>
    `;

    let pyrHtml = `
        <div class="full-pyramid-container" style="position: relative;">
            <div class="pyramid-panel" id="area-capture-piramide" style="position: relative; background: #ffffff; padding: 18px 16px 20px 16px; border-radius: 16px;">
                ${btnToggleHtml}
                ${btnPngHtml}

                <!-- 🏛️ CABEÇALHO OCULTO NO ECRÃ (display: none) / ATIVADO APENAS NA FOTO -->
                <div id="pyr-header-export" class="pyr-header-card" style="display: none; text-align: center; margin-bottom: 16px; padding-top: 4px;">
                    <div style="font-size: 10px; font-weight: 800; color: #64748b; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 2px;">
                        ${nomeClube} • SETPOINT SAAS
                    </div>
                    <div style="font-size: 17px; font-weight: 900; color: #0f172a; line-height: 1.2;">
                        ${nomeTorneio}
                    </div>
                    ${catTxt ? `<div style="font-size: 12px; font-weight: 700; color: #0284c7; margin-top: 2px;">${catTxt}</div>` : ''}
                    
                    <div style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 6px;">
                        <span style="font-size: 11.5px; font-weight: 600; color: #475569;">${subtituloTxt}</span>
                        <span style="font-size: 10px; font-weight: 800; background: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${badgeBorder}; padding: 2px 8px; border-radius: 10px; display: inline-block;">${badgeTxt}</span>
                    </div>
                </div>
    `;

    tiers.forEach((tier, idx) => {
        let widthPct;
        if (totalTiers === 1) {
            widthPct = 32;
        } else {
            widthPct = minWidth + (idx / (totalTiers - 1)) * (maxWidth - minWidth);
        }

        let borderStyle = idx < totalTiers - 1 ? 'border-bottom: 2px solid #e2e8f0; padding-bottom: 6px;' : '';

        pyrHtml += `<div class="p2-shelf" style="width: ${widthPct.toFixed(1)}%; ${borderStyle}">`;

        tier.forEach((idAtleta) => {
            const atleta = (typeof jogadoresGlobal !== 'undefined' && jogadoresGlobal[idAtleta]) ? jogadoresGlobal[idAtleta] : {};
            const pos = listaIDs.indexOf(idAtleta) + 1;
            
            const nomeCompletoRaw = atleta.nomeCompleto || atleta.apelido || 'Atleta';
            const nomeCompletoCap = (typeof capitalizarNome === 'function') ? capitalizarNome(nomeCompletoRaw) : nomeCompletoRaw;
            const nomeExibicao = formatarNomePiramideSaaS(atleta);

            const ehVoce = (!isHistorico && idAtleta === idLogado);
            const ehTop = (pos === 1);

            let tileClass = 'pyr-tile';
            if (ehTop) tileClass += ' is-top';
            else if (ehVoce) tileClass += ' is-me';

            let ordTxt = ehTop ? `👑 1º` : (ehVoce ? `${pos}º (Você)` : `${pos}º`);
            let fontSize = tier.length >= 7 ? '9px' : (tier.length >= 5 ? '9.8px' : '10.5px');

            const nomeEscapadoToast = String(nomeCompletoCap).replace(/'/g, "\\'");

            pyrHtml += `
                <div class="${tileClass}" onclick="exibirTooltipNomePiramideSaaS(this, '${nomeEscapadoToast}')" style="cursor: pointer; position: relative;">
                    <span class="p-ord">${ordTxt}</span>
                    <span class="p-name" style="font-size: ${fontSize}; text-transform: none !important;" title="${nomeCompletoCap}">${nomeExibicao}</span>
                </div>
            `;
        });

        pyrHtml += `</div>`;
    });

    pyrHtml += `
            <!-- 🏷️ RODAPÉ OCULTO NO ECRÃ (display: none) / ATIVADO APENAS NA FOTO -->
            <div id="pyr-footer-export" class="pyr-footer-card" style="display: none; text-align: center; margin-top: 18px; padding-top: 8px; border-top: 1px dashed #cbd5e1; font-size: 10px; color: #94a3b8; font-weight: 600;">
                Gerado em ${dataHoje} via SetPoint SaaS
            </div>

        </div></div>
    `;

    containerAlvo.innerHTML = pyrHtml;
}

function abrirPiramideAcervoSaaS(idEdicao) {
    const edicao = acervoHistoricoGlobalSaaS.find(e => e.id === idEdicao);
    if (!edicao || !edicao.classificacaoFinal) {
        showToast("Dados da pirâmide indisponíveis para esta edição.", "warning");
        return;
    }

    edicaoHistoricaFocoSaaS = edicao;
    const categorias = Object.keys(edicao.classificacaoFinal);
    if (categorias.length === 0) return;

    categoriaHistoricaAtivaSaaS = categorias.sort()[0];
    const listaIDs = edicao.classificacaoFinal[categoriaHistoricaAtivaSaaS] || [];

    const sheet = document.getElementById('sheet-leaderboard-ranking');
    const bodyList = document.getElementById('body-leaderboard-scroll');
    const txtSub = document.getElementById('txt-subtitulo-leaderboard');

    const containerAbas = document.getElementById('btn-tab-torneio-saas') ? document.getElementById('btn-tab-torneio-saas').parentElement : null;
    const selectClasse = document.getElementById('select-leaderboard-classe');
    const selectGenero = document.getElementById('select-leaderboard-genero');
    const containerDropdowns = document.querySelector('#sheet-leaderboard-ranking .dropdowns-leaderboard-container');

    if (containerAbas) containerAbas.style.display = 'none';
    if (selectClasse) selectClasse.style.display = 'none';
    if (selectGenero) selectGenero.style.display = 'none';
    if (containerDropdowns) containerDropdowns.style.display = 'none';

    const cal = edicao.contrato || {};
    if (txtSub) {
        txtSub.innerHTML = `<b>🏆 Pirâmide Final</b> • ${cal.nomeTorneio || 'Torneio'} <span style="display:inline-block; background:#f1f5f9; color:#475569; font-size:10px; font-weight:800; padding:2px 8px; border-radius:10px; margin-left:4px; border:1px solid #cbd5e1;">[Acervo Histórico]</span>`;
    }

    if (typeof renderizarVisaoPiramideSaaS === 'function') {
        renderizarVisaoPiramideSaaS(bodyList, listaIDs, null, null, true);
    }

    if (sheet) {
        sheet.style.display = 'flex';
        setTimeout(() => sheet.classList.add('ativa'), 10);
    }
}

/**
 * ========================================================
 * 📸 MOTOR DE EXPORTAÇÃO EM IMAGEM PNG (HTML2CANVAS)
 * ========================================================
 */
async function exportarPiramidePNGSaaS() {
    if (navigator.vibrate) navigator.vibrate(30);

    const painelPiramide = document.getElementById('area-capture-piramide');
    if (!painelPiramide) {
        showToast("Erro ao localizar a área gráfica da pirâmide.", "error");
        return;
    }

    showToast("Gerando imagem PNG...", "info");

    // Injeta a biblioteca html2canvas se ainda não estiver carregada
    if (typeof window.html2canvas === 'undefined') {
        try {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        } catch (err) {
            console.error("❌ Erro ao carregar html2canvas:", err);
            showToast("Erro ao carregar o motor de captura de imagem.", "error");
            return;
        }
    }

    try {
        // Captura usando 'onclone' para alterar apenas a cópia em memória (Zero Piscada na Tela)
        const canvas = await window.html2canvas(painelPiramide, {
            scale: 2, // Resolução HD (2x)
            useCORS: true,
            backgroundColor: '#ffffff',
            ignoreElements: (element) => {
                return element.getAttribute('data-html2canvas-ignore') === 'true';
            },
            onclone: (clonedDoc) => {
                const clonedHeader = clonedDoc.getElementById('pyr-header-export');
                const clonedFooter = clonedDoc.getElementById('pyr-footer-export');
                if (clonedHeader) clonedHeader.style.display = 'block';
                if (clonedFooter) clonedFooter.style.display = 'block';
            }
        });

        const imageBase64 = canvas.toDataURL('image/png');
        const elNomeClube = document.getElementById('txt-nome-clube');
        let nomeClubeRaw = elNomeClube ? elNomeClube.textContent.trim() : 'Clube';
        if (!nomeClubeRaw || nomeClubeRaw.toUpperCase() === 'CARREGANDO...') {
            nomeClubeRaw = localStorage.getItem('setpoint_jogador_clube_nome') || 'Clube';
        }
        
        const nomeArquivo = `Piramide_${nomeClubeRaw.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.png`;

        // Verifica se é execução em App Nativo ou Navegador Web
        const isNative = typeof window.Capacitor !== 'undefined' && window.Capacitor.isNativePlatform();

        if (isNative) {
            const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
            const Filesystem = window.Capacitor.Plugins.Filesystem;
            const FileOpener = window.Capacitor.Plugins.FileOpener;

            const fileResult = await Filesystem.writeFile({
                path: nomeArquivo,
                data: cleanBase64,
                directory: 'CACHE'
            });

            await FileOpener.openFile({
                path: fileResult.uri,
                mimeType: 'image/png'
            });

            showToast("Imagem da Pirâmide gerada e aberta!", "success");
        } else {
            const link = document.createElement('a');
            link.download = nomeArquivo;
            link.href = imageBase64;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            showToast("Imagem da Pirâmide baixada com sucesso!", "success");
        }

    } catch (err) {
        console.error("❌ Erro ao capturar imagem da pirâmide:", err);
        showToast("Erro ao gerar a imagem PNG da pirâmide.", "error");
    }
}

function exibirTooltipNomePiramideSaaS(elemento, nomeCompleto) {
    if (!elemento || !nomeCompleto) return;

    // Esconde tooltip anterior para evitar duplicidade na tela
    document.querySelectorAll('.piramide-tooltip-pop').forEach(t => t.remove());

    const tooltip = document.createElement('div');
    tooltip.className = 'piramide-tooltip-pop';
    tooltip.textContent = nomeCompleto;
    tooltip.style.cssText = 'position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%); margin-bottom: 6px; background: #0f172a; color: #ffffff; padding: 5px 10px; border-radius: 8px; font-size: 11.5px; font-weight: 800; white-space: nowrap; z-index: 100; box-shadow: 0 4px 14px rgba(0,0,0,0.3); pointer-events: none; opacity: 1; transition: opacity 0.2s;';

    elemento.appendChild(tooltip);

    // Oculta suavemente após 2 segundos
    setTimeout(() => {
        tooltip.style.opacity = '0';
        setTimeout(() => tooltip.remove(), 200);
    }, 2000);
}