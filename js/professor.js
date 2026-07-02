import { auth, db } from "/js/firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import { ref, get, set, push, remove, update } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-database.js";

// 🔒 PROTEÇÃO DE ROTA
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "index.html";
        return;
    }
    try {
        const snapUser = await get(ref(db, "users/" + user.uid));
        if (!snapUser.exists()) {
            window.location.href = "index.html";
            return;
        }
        const u = snapUser.val();
        if (u.role !== "teacher") {
            alert("Acesso negado: apenas professores podem acessar esta área.");
            window.location.href = "index.html";
            return;
        }
        iniciarSistemaProfessor(u);
    } catch (err) {
        console.error("Erro ao verificar permissões:", err);
        window.location.href = "index.html";
    }
});

function iniciarSistemaProfessor(u) {
    // 1. ELEMENTOS DO DOM (MESTRES)
    const serieSelect = document.getElementById("serieSelect"); 
    const materiaSelect = document.getElementById("materiaSelect");
    const selectBimestre = document.getElementById("bimestreNotas"); // ID mestre para o bimestre

    // Seções, Tabelas e Botões
    const corpoTabelaNotas = document.getElementById("corpoTabelaNotas");
    const listaAlunosFaltas = document.getElementById("listaAlunosFaltas");
    const listaConteudos = document.getElementById("listaConteudos");
    const btnSalvarNotas = document.getElementById("btnSalvarNotas");
    const btnSalvarFaltas = document.getElementById("btnSalvarFaltas");
    const btnSalvarConteudo = document.getElementById("btnSalvarConteudo");
    const secaoNotas = document.getElementById("secaoNotas");
    const mensagemNotas = document.getElementById("mensagemNotas");
    const dataFaltaInput = document.getElementById("dataFalta");
    const conteudoInput = document.getElementById("conteudo");
    const dataAulaInput = document.getElementById("dataAula");

    let idEdicaoAtual = null;

    // 2. 🛠️ SISTEMA DE FILTROS UNIFICADO
    function inicializarFiltros() {
        materiaSelect.innerHTML = '<option value="">Selecione a série primeiro</option>';
        if (u.atribuicoes) {
            Object.keys(u.atribuicoes).sort().forEach(turma => {
                serieSelect.add(new Option(turma, turma));
            });
        }
    }

    const atualizarTudo = () => {
        const serie = serieSelect.value;
        const materia = materiaSelect.value;
        const bimestre = selectBimestre.value;

        if (serie && materia && bimestre) {
            secaoNotas.style.display = "block";
            mensagemNotas.style.display = "none";
            
            // Dispara todos os carregamentos simultaneamente
            carregarTabelaNotas();
            carregarAlunosParaFaltas();
            carregarConteudos();
        } else {
            secaoNotas.style.display = "none";
            mensagemNotas.style.display = "block";
        }
    };

    // Eventos dos Filtros
    serieSelect.addEventListener("change", () => {
        const serieEscolhida = serieSelect.value;
        materiaSelect.innerHTML = '<option value="">Selecione a matéria</option>';
        if (serieEscolhida && u.atribuicoes[serieEscolhida]) {
            u.atribuicoes[serieEscolhida].forEach(m => materiaSelect.add(new Option(m, m)));
        }
        atualizarTudo();
    });

    materiaSelect.addEventListener("change", atualizarTudo);
    selectBimestre.addEventListener("change", atualizarTudo);

    // ==========================================
    // 📊 LÓGICA DE NOTAS (PROFESSOR) - ARREDONDAMENTO POR QUARTIS
    // ==========================================

    // 🔘 LIGA O BOTÃO SALVAR
    btnSalvarNotas.addEventListener("click", salvarNotas);

    // 1. FUNÇÃO DE ARREDONDAMENTO ESPECIAL
    function arredondarEscola(nota) {
        if (isNaN(nota) || nota === null || nota === 0) return 0;
        
        const inteiro = Math.floor(nota);
        const decimal = parseFloat((nota - inteiro).toFixed(2)); 

        if (decimal <= 0.25) {
            return inteiro;
        } else if (decimal >= 0.26 && decimal <= 0.75) {
            return inteiro + 0.5;
        } else {
            return inteiro + 1;
        }
    }

    // ==========================================
    // 💾 FUNÇÃO SALVAR NOTAS
    // ==========================================
    async function salvarNotas() {
        const materia = materiaSelect.value;
        const bimestre = selectBimestre.value;
        const linhas = corpoTabelaNotas.querySelectorAll("tr");

        if (!materia || !bimestre) {
            alert("Selecione matéria e bimestre!");
            return;
        }

        try {
            for (let tr of linhas) {
                const uid = tr.dataset.uid;

                const p1 = tr.querySelector("[data-campo='p1']").value;
                const p2 = tr.querySelector("[data-campo='p2']").value;
                const trabalhos = tr.querySelector("[data-campo='trabalhos']").value;
                const recuperacao = tr.querySelector("[data-campo='recuperacao']").value;
                const faltas = tr.querySelector(".td-faltas").textContent;
                const mediaTxt = tr.querySelector(".td-media").textContent.replace(",", ".");

                const dados = {
                    p1: p1 ? parseFloat(p1) : null,
                    p2: p2 ? parseFloat(p2) : null,
                    trabalhos: trabalhos ? parseFloat(trabalhos) : null,
                    recuperacao: recuperacao ? parseFloat(recuperacao) : null,
                    faltas: parseInt(faltas) || 0,
                    professor: auth.currentUser.uid
                };

                // só salva média se for válida
                if (mediaTxt !== "-" && !isNaN(mediaTxt)) {
                    dados.media = parseFloat(mediaTxt);
                }

                await set(ref(db, `grades/${uid}/${materia}/${bimestre}`), dados);
            }

            alert("Notas salvas com sucesso!");

        } catch (error) {
            console.error("ERRO AO SALVAR:", error);
            alert("Erro ao salvar: " + error.message);
        }
    }

    // ==========================================
    // 📋 CARREGAR TABELA
    // ==========================================
    async function carregarTabelaNotas() {
        const serie = serieSelect.value;
        corpoTabelaNotas.innerHTML = "<tr><td colspan='8'>Carregando alunos...</td></tr>";
        
        try {
            const snapshot = await get(ref(db, "users"));
            const data = snapshot.val();
            corpoTabelaNotas.innerHTML = "";
            
            if (!data) return;

            const listaOrdenada = Object.keys(data)
                .map(uid => ({ uid, ...data[uid] }))
                .filter(aluno => aluno.role === "student" && aluno.serie === serie)
                .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

            listaOrdenada.forEach(aluno => {
                const tr = document.createElement("tr");
                tr.dataset.uid = aluno.uid;
                tr.innerHTML = `
                    <td>${aluno.name}</td>
                    <td><input type="number" data-campo="p1" min="0" max="10" step="0.1"></td>
                    <td><input type="number" data-campo="p2" min="0" max="10" step="0.1"></td>
                    <td><input type="number" data-campo="trabalhos" min="0" max="10" step="0.1"></td>
                    <td><input type="number" data-campo="recuperacao" min="0" max="10" step="0.1"></td>
                    <td class="td-media" style="font-weight:bold; text-align:center;">-</td>
                    <td class="td-media-final" style="font-weight:bold; color:#32066d; text-align:center;">-</td>
                    <td class="td-faltas" style="text-align:center;">0</td>
                `;
                corpoTabelaNotas.appendChild(tr);
            });
            
            await carregarNotasExistentes();
        } catch (err) { 
            console.error(err); 
        }
    }
// ==========================================
// ⚡ CÁLCULO AUTOMÁTICO (CALCULA A PARTIR DE 1 NOTA LANÇADA, DIVIDINDO POR 3)
// ==========================================
corpoTabelaNotas.addEventListener("input", (e) => {
    if (e.target.tagName === "INPUT") {
        const tr = e.target.closest("tr");
        const p1Val = tr.querySelector("[data-campo='p1']").value;
        const p2Val = tr.querySelector("[data-campo='p2']").value;
        const trabVal = tr.querySelector("[data-campo='trabalhos']").value;
        const recVal = tr.querySelector("[data-campo='recuperacao']").value;
        const tdMedia = tr.querySelector(".td-media");

        // 1. Só joga no array se o campo estiver preenchido de fato
        let notas = [];
        if (p1Val !== "") notas.push(parseFloat(p1Val));
        if (p2Val !== "") notas.push(parseFloat(p2Val));
        if (trabVal !== "") notas.push(parseFloat(trabVal));

        // 2. ALTERAÇÃO AQUI: Calcula se houver pelo menos 1 nota preenchida
        if (notas.length > 0) {
            // Soma as notas digitadas e divide SEMPRE por 3 (as não digitadas valem 0 na soma)
            let media = notas.reduce((a, b) => a + b, 0) / 3; 

            // Se a recuperação for maior que a média parcial/total, ela substitui a média
            if (recVal && parseFloat(recVal) > media) {
                media = parseFloat(recVal);
            }

            const final = arredondarEscola(media);
            tdMedia.textContent = final.toString().replace(".", ",");
            tdMedia.style.color = final < 6 ? "red" : "#32066d";

        // Caso o professor digite uma recuperação direto (sem nenhuma outra nota)
        } else if (recVal && notas.length === 0) {
            const final = arredondarEscola(parseFloat(recVal));
            tdMedia.textContent = final.toString().replace(".", ",");
            tdMedia.style.color = final < 6 ? "red" : "#32066d";
            
        } else {
            // Se todos os campos de notas e recuperação forem apagados, limpa a média
            tdMedia.textContent = "-";
        }

        atualizarMediaFinalNaTabela(tr);
    }
});
    // ==========================================
    // 📈 MÉDIA FINAL
    // ==========================================
    async function atualizarMediaFinalNaTabela(tr) {
        const uid = tr.dataset.uid;
        const materia = materiaSelect.value;
        const bimAtual = selectBimestre.value;
        const notaAtualTxt = tr.querySelector(".td-media").textContent.replace(",", ".");

        const snap = await get(ref(db, `grades/${uid}/${materia}`));
        const notasBanco = snap.val() || {};

        let soma = 0;

        for(let b = 1; b <= 4; b++) {
            if(b == bimAtual) {
                if(notaAtualTxt !== "-") soma += parseFloat(notaAtualTxt);
            } else if(notasBanco[b]?.media) {
                soma += parseFloat(notasBanco[b].media);
            }
        }
        
        const mediaFinal = soma > 0 ? arredondarEscola(soma / 4) : "-";
        
        const tdFinal = tr.querySelector(".td-media-final");
        tdFinal.textContent = mediaFinal === "-" ? "-" : mediaFinal.toString().replace(".", ",");
        tdFinal.style.color = (mediaFinal !== "-" && mediaFinal < 6) ? "red" : "#32066d";
    }

    // ==========================================
    // 📥 CARREGAR NOTAS EXISTENTES
    // ==========================================
    async function carregarNotasExistentes() {
        const materia = materiaSelect.value;
        const bimestre = selectBimestre.value;
        const lines = corpoTabelaNotas.querySelectorAll("tr");
        
        for (let tr of lines) {
            const uid = tr.dataset.uid;
            const snap = await get(ref(db, `grades/${uid}/${materia}/${bimestre}`));
            const g = snap.val();
            
            if (g) {
                tr.querySelector("[data-campo='p1']").value = g.p1 ?? "";
                tr.querySelector("[data-campo='p2']").value = g.p2 ?? "";
                tr.querySelector("[data-campo='trabalhos']").value = g.trabalhos ?? "";
                tr.querySelector("[data-campo='recuperacao']").value = g.recuperacao ?? "";
                tr.querySelector(".td-faltas").textContent = g.faltas ?? "0";

                tr.querySelector("[data-campo='p1']")
                  .dispatchEvent(new Event('input', { bubbles: true }));
            } else {
                tr.querySelectorAll("input").forEach(i => i.value = "");
                tr.querySelector(".td-media").textContent = "-";
                tr.querySelector(".td-faltas").textContent = "0";
                await atualizarMediaFinalNaTabela(tr);
            }
        }
    }

    // ==========================================
    // 🗓️ 4. LÓGICA DE FALTAS
    // ==========================================
    async function carregarAlunosParaFaltas() {
        const serie = serieSelect.value;
        if (!serie) return;
        
        listaAlunosFaltas.innerHTML = "Carregando alunos...";

        try {
            const snap = await get(ref(db, "users"));
            const data = snap.val(); // 🛠️ CORRIGIDO: alterado de snapshot.val() para snap.val()
            listaAlunosFaltas.innerHTML = "";

            if (!data) return;

            Object.keys(data)
                .map(uid => ({ uid, ...data[uid] }))
                .filter(a => a.role === "student" && a.serie === serie)
                .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
                .forEach(a => {
                    const div = document.createElement("div");
                    div.style.cssText = "display:flex; align-items:center; justify-content:space-between; margin:5px 0; border-bottom:1px solid #eee; padding:8px 5px;";
                    div.innerHTML = `
                        <span class="nome-aluno" style="flex: 1;">${a.name}</span>
                        <div style="display:flex; gap:8px; align-items:center; flex-wrap: wrap;">
                            ${[1, 2, 3, 4].map(num => `
                                <label style="cursor:pointer; font-size:11px; display:flex; align-items:center; gap:3px; background:#f8f008; padding:4px 6px; border-radius:6px; color:#32066d; font-weight:bold;">
                                    <input type="checkbox" class="chk-aula-${num}" data-uid="${a.uid}"> ${num}ª
                                </label>
                            `).join('')}
                        </div>`;
                    listaAlunosFaltas.appendChild(div);
                });

            await carregarHistoricoFaltas();
        } catch (e) { console.error(e); }
    }

    // ==========================================
    // 💾 SALVAR FALTAS
    // ==========================================
    async function salvarFaltas() {
        const materia = materiaSelect.value;
        const bimestre = String(selectBimestre.value);
        const serie = serieSelect.value;
        const dataFalta = dataFaltaInput.value;

        if (!materia || !serie || !bimestre || !dataFalta) {
            alert("Preencha Data, Matéria, Série e Bimestre.");
            return;
        }

        try {
            btnSalvarFaltas.disabled = true;
            btnSalvarFaltas.innerText = "Salvando...";

            const faltasPorAluno = {};
            const checkboxes = document.querySelectorAll('input[class^="chk-aula-"]:checked');

            checkboxes.forEach(chk => {
                const uid = chk.dataset.uid;
                if (!faltasPorAluno[uid]) faltasPorAluno[uid] = 0;
                faltasPorAluno[uid]++;
            });

            const promessas = [];

            for (let uid in faltasPorAluno) {
                const qtd = faltasPorAluno[uid];

                const p = (async () => {
                    await push(ref(db, `faltas/${uid}/${materia}`), {
                        data: dataFalta,
                        bimestre: bimestre,
                        faltas: qtd,
                        professor: auth.currentUser.email
                    });

                    const refP = `grades/${uid}/${materia}/${bimestre}`;
                    const snapG = await get(ref(db, refP));
                    const dados = snapG.exists() ? snapG.val() : { faltas: 0 };

                    const faltasAtuais = parseInt(dados.faltas) || 0;

                    await update(ref(db, refP), {
                        faltas: faltasAtuais + qtd
                    });
                })();

                promessas.push(p);
            }

            await Promise.all(promessas);
            checkboxes.forEach(c => c.checked = false);

            await carregarHistoricoFaltas();
            if (typeof carregarTabelaNotas === "function") await carregarTabelaNotas();

            alert("Faltas salvas com sucesso!");

        } catch (e) {
            console.error(e);
            alert("Erro ao salvar.");
        } finally { // 🛠️ CORRIGIDO: de 'finaly' para 'finally'
            btnSalvarFaltas.disabled = false;
            btnSalvarFaltas.innerText = "Salvar Faltas";
        }
    }

    if (typeof btnSalvarFaltas !== 'undefined') {
        btnSalvarFaltas.onclick = salvarFaltas;
    }

    // ==========================================
    // 📊 CARREGAR HISTÓRICO + BOTÃO EXCLUIR
    // ==========================================
    async function carregarHistoricoFaltas() {
        const materia = materiaSelect.value;
        const bimestre = String(selectBimestre.value);
        const serie = serieSelect.value;
        let cont = document.getElementById("contHistFaltas");

        if (!cont) {
            cont = document.createElement("div");
            cont.id = "contHistFaltas";
            cont.style.cssText = "margin-top:20px;padding:15px;background:#f9f9f9;border:1px solid #ddd;border-radius:8px;";
            btnSalvarFaltas.after(cont);
        }

        if (!materia || !serie || !bimestre) {
            cont.innerHTML = "<p>Selecione os filtros.</p>";
            return;
        }

        cont.innerHTML = `🔍 Buscando registros do ${bimestre}º Bimestre...`;

        try {
            const snapUsers = await get(ref(db, "users"));
            const users = snapUsers.val();

            let mapaDatas = {};

            for (let uid in users) {
                const aluno = users[uid];
                if (aluno.role === "student" && aluno.serie === serie) {
                    const snapF = await get(ref(db, `faltas/${uid}/${materia}`));

                    if (snapF.exists()) {
                        Object.values(snapF.val()).forEach(item => {
                            if (String(item.bimestre) !== bimestre) return;

                            const data = item.data;
                            if (!data) return;

                            if (!mapaDatas[data]) mapaDatas[data] = [];

                            if (!mapaDatas[data].includes(aluno.name)) {
                                mapaDatas[data].push(aluno.name);
                            }
                        });
                    }
                }
            }

            const listaDatas = Object.keys(mapaDatas).sort().reverse();
            cont.innerHTML = `<h4 style="color:#32066d;">🗓️ Histórico de Faltas</h4>`;

            if (listaDatas.length === 0) {
                cont.innerHTML += `<p style='color:#888;'>Nenhum registro neste bimestre.</p>`;
                return;
            }

            const ul = document.createElement("ul");
            ul.style.listStyle = "none";

            listaDatas.forEach(data => {
                const li = document.createElement("li");
                const dataFormatada = data.split('-').reverse().join('/');

                li.innerHTML = `
                    <strong>${dataFormatada}</strong><br>
                    <small>Faltaram: ${mapaDatas[data].join(", ")}</small><br>
                    <button onclick="window.excluirFalta('${data}')" 
                        style="margin-top:5px;background:red;color:white;border:none;padding:5px;border-radius:4px;cursor:pointer;">
                        Excluir dia
                    </button>
                `;
                li.style.marginBottom = "10px";
                ul.appendChild(li);
            });

            cont.appendChild(ul);

        } catch (e) {
            console.error(e);
            cont.innerHTML = "<p style='color:red;'>Erro ao carregar histórico.</p>";
        }
    }

    // ==========================================
    // ❌ EXCLUIR FALTA
    // ==========================================
    window.excluirFalta = async (dataAlvo) => {
        const materia = materiaSelect.value;
        const serie = serieSelect.value;

        if (!confirm("Excluir todas as faltas desse dia?")) return;

        try {
            const snapUsers = await get(ref(db, "users"));
            const users = snapUsers.val();

            for (let uid in users) {
                const aluno = users[uid];
                if (aluno.role === "student" && aluno.serie === serie) {
                    const refF = ref(db, `faltas/${uid}/${materia}`);
                    const snapF = await get(refF);

                    if (snapF.exists()) {
                        const dados = snapF.val();

                        for (let key in dados) {
                            const item = dados[key];

                            if (item.data === dataAlvo) {
                                await remove(ref(db, `faltas/${uid}/${materia}/${key}`));

                                const refG = ref(db, `grades/${uid}/${materia}/${item.bimestre}`);
                                const snapG = await get(refG);

                                if (snapG.exists()) {
                                    const g = snapG.val();
                                    const faltasAtuais = parseInt(g.faltas) || 0;

                                    await update(refG, {
                                        faltas: Math.max(0, faltasAtuais - (item.faltas || 1))
                                    });
                                }
                            }
                        }
                    }
                }
            }

            alert("Faltas removidas!");
            await carregarHistoricoFaltas();
            if (typeof carregarTabelaNotas === "function") await carregarTabelaNotas();

        } catch (e) {
            console.error(e);
            alert("Erro ao excluir.");
        }
    };

    // ==========================================
    // 📖 5. LÓGICA DE CONTEÚDOS (COM FILTRO MESTRE)
    // ==========================================
    async function carregarConteudos() {
        const materia = materiaSelect.value;
        const serie = serieSelect.value;
        const bimestreAtual = selectBimestre.value; 

        listaConteudos.innerHTML = "";
        if (!materia || !serie) return;

        try {
            const snap = await get(ref(db, `conteudos/${auth.currentUser.uid}/${serie}/${materia}`));
            const dados = snap.val();
            
            if (!dados) { 
                listaConteudos.innerHTML = "<li>Nenhum conteúdo cadastrado para esta matéria/série.</li>"; 
                return; 
            }

            const listaCompleta = Object.keys(dados).map(k => ({
                id: k,
                ...dados[k]
            }));

            // 🎯 FILTRAGEM: Exibe apenas os conteúdos do bimestre selecionado
            const listaFiltrada = listaCompleta.filter(c => String(c.bimestre) === String(bimestreAtual));

            if (listaFiltrada.length === 0) {
                listaConteudos.innerHTML = `<li>Nenhum conteúdo lançado para o ${bimestreAtual}º Bimestre.</li>`;
                return;
            }

            listaFiltrada.sort((a, b) => new Date(a.data) - new Date(b.data));

            listaFiltrada.forEach(c => {
                const dataObjeto = new Date(c.data + "T00:00:00");
                const dataBR = dataObjeto.toLocaleDateString('pt-BR');
                const nomeMes = dataObjeto.toLocaleString('pt-BR', { month: 'long' });
                const mesCapitalizado = nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1);

                const li = document.createElement("li");
                li.innerHTML = `
                    <span>
                        <strong>[${c.bimestre}º Bim]</strong> - ${mesCapitalizado}<br>
                        <small>Aula do dia ${dataBR}</small><br>
                        ${c.conteudo}
                    </span>
                    <div class="botoes-lista">
                        <button class="btn-editar" onclick="window.editarConteudo('${c.id}', '${c.data}', '${c.conteudo}', '${c.bimestre}')">Editar</button>
                        <button class="btn-excluir" onclick="window.excluirConteudo('${c.id}')">Excluir</button>
                    </div>`;
                listaConteudos.appendChild(li);
            });
        } catch (e) { 
            console.error("Erro ao carregar:", e); 
        }
    }

    btnSalvarConteudo.addEventListener("click", async () => {
        const materia = materiaSelect.value;
        const serie = serieSelect.value;
        const texto = conteudoInput.value.trim();
        const bimestre = selectBimestre.value; 

        if (!materia || !serie || !texto) return alert("Selecione os campos e preencha o conteúdo!");

        const dados = { data: dataAulaInput.value, conteudo: texto, bimestre: bimestre };
        const path = `conteudos/${auth.currentUser.uid}/${serie}/${materia}`;

        try {
            if (idEdicaoAtual) {
                await update(ref(db, `${path}/${idEdicaoAtual}`), dados);
                idEdicaoAtual = null;
                btnSalvarConteudo.innerText = "Salvar Conteúdo";
            } else {
                await push(ref(db, path), dados);
            }
            conteudoInput.value = "";
            alert("✅ Conteúdo Salvo!");
            carregarConteudos();
        } catch (e) { alert("Erro ao salvar conteúdo."); }
    });

    window.excluirConteudo = async (id) => {
        const materia = materiaSelect.value;
        const serie = serieSelect.value;
        if (confirm("Excluir este conteúdo?")) {
            await remove(ref(db, `conteudos/${auth.currentUser.uid}/${serie}/${materia}/${id}`));
            carregarConteudos();
        }
    };

    window.editarConteudo = (id, data, conteudo, bimestre) => {
        idEdicaoAtual = id;
        dataAulaInput.value = data;
        conteudoInput.value = conteudo;
        selectBimestre.value = bimestre;
        btnSalvarConteudo.innerText = "Atualizar Conteúdo";
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.toggleLista = () => {
        const lista = document.getElementById("listaConteudos");
        const btn = document.getElementById("btnToggleLista");
        
        if (lista.style.display === "none") {
            lista.style.display = "block";
            btn.textContent = "Esconder";
        } else {
            lista.style.display = "none";
            btn.textContent = "Mostrar";
        }
    };

    // 🚪 LOGOUT E INICIALIZAÇÃO
    document.querySelector(".btn-logout").addEventListener("click", async (e) => {
        e.preventDefault();
        if (confirm("Deseja sair?")) {
            await signOut(auth);
            window.location.href = "index.html";
        }
    });

    inicializarFiltros();

    // === CÓDIGO PARA GERAR PDF (ADICIONAR NO FINAL) ===
    window.gerarPDFConteudo = async () => {
        const serie = document.getElementById("serieSelect").value;
        const materia = document.getElementById("materiaSelect").value;
        const bimestreFiltro = document.getElementById("filtroBimestrePDF").value;

        if (!serie || !materia) {
            return alert("Por favor, selecione a Série e a Matéria nos filtros do topo primeiro!");
        }

        try {
            const path = `conteudos/${auth.currentUser.uid}/${serie}/${materia}`;
            const snap = await get(ref(db, path));
            
            if (!snap.exists()) {
                return alert("Nenhum conteúdo encontrado para esta série/matéria.");
            }

            const todos = snap.val();
            const filtrados = Object.values(todos).filter(c => 
                String(c.bimestre) === String(bimestreFiltro)
            );

            if (filtrados.length === 0) {
                return alert(`Não há conteúdos lançados para o ${bimestreFiltro}º Bimestre.`);
            }

            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();

            doc.setFontSize(16);
            doc.text("Relatório de Conteúdos Lecionados", 10, 15);
            
            doc.setFontSize(11);
            doc.text(`Série: ${serie} | Matéria: ${materia}`, 10, 25);
            doc.text(`Bimestre: ${bimestreFiltro}º Bimestre`, 10, 32);
            doc.line(10, 35, 200, 35);

            let y = 45;
            filtrados.sort((a, b) => new Date(a.data) - new Date(b.data)).forEach((c, index) => {
                if (y > 270) { 
                    doc.addPage();
                    y = 20;
                }
                const dataF = c.data.split('-').reverse().join('/');
                
                doc.setFont("helvetica", "bold");
                doc.text(`${index + 1}. Data: ${dataF}`, 10, y);
                
                doc.setFont("helvetica", "normal");
                const txt = doc.splitTextToSize(`Conteúdo: ${c.conteudo}`, 180);
                doc.text(txt, 10, y + 7);
                
                y += (txt.length * 7) + 12; 
            });

            doc.save(`Relatorio_Conteudo_${serie}_${bimestreFiltro}Bim.pdf`);

        } catch (e) {
            console.error("Erro ao gerar PDF:", e);
            alert("Erro ao processar o arquivo PDF.");
        }
    };
}