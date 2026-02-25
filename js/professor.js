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

    // 3. 📊 LÓGICA DE NOTAS
    async function carregarTabelaNotas() {
        const serie = serieSelect.value;
        corpoTabelaNotas.innerHTML = "<tr><td colspan='7'>Carregando alunos...</td></tr>";
        try {
            const snapshot = await get(ref(db, "users"));
            const data = snapshot.val();
            corpoTabelaNotas.innerHTML = "";
            
            const listaOrdenada = Object.keys(data)
                .map(uid => ({ uid, ...data[uid] }))
                .filter(aluno => aluno.role === "student" && aluno.serie === serie)
                .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

            listaOrdenada.forEach(aluno => {
                const tr = document.createElement("tr");
                tr.dataset.uid = aluno.uid;
                tr.innerHTML = `
                    <td>${aluno.name}</td>
                    <td><input type="number" data-campo="p1" min="0" max="10" step="0.1" value="0"></td>
                    <td><input type="number" data-campo="p2" min="0" max="10" step="0.1" value="0"></td>
                    <td><input type="number" data-campo="trabalhos" min="0" max="10" step="0.1" value="0"></td>
                    <td><input type="number" data-campo="recuperacao" min="0" max="10" step="0.1" value=""></td>
                    <td class="td-media">0.0</td>
                    <td class="td-faltas">0</td>
                `;
                corpoTabelaNotas.appendChild(tr);
            });
            carregarNotasExistentes();
        } catch (err) { console.error(err); }
    }

    corpoTabelaNotas.addEventListener("input", (e) => {
        if (e.target.tagName === "INPUT") {
            const tr = e.target.closest("tr");
            const p1 = parseFloat(tr.querySelector("[data-campo='p1']").value) || 0;
            const p2 = parseFloat(tr.querySelector("[data-campo='p2']").value) || 0;
            const trab = parseFloat(tr.querySelector("[data-campo='trabalhos']").value) || 0;
            const recVal = tr.querySelector("[data-campo='recuperacao']").value;
            
            let mediaBase = (p1 + p2 + trab) / 3;
            let mediaFinal = mediaBase;

            if (recVal !== "") {
                const rec = parseFloat(recVal) || 0;
                if (rec > mediaBase) mediaFinal = rec;
            }
            tr.querySelector(".td-media").textContent = mediaFinal.toFixed(1);
        }
    });

    async function carregarNotasExistentes() {
        const materia = materiaSelect.value;
        const bimestre = selectBimestre.value;
        const linhas = corpoTabelaNotas.querySelectorAll("tr");
        
        for (let tr of linhas) {
            const uid = tr.dataset.uid;
            const snap = await get(ref(db, `grades/${uid}/${materia}/${bimestre}`));
            const g = snap.val();
            
            if (g) {
                tr.querySelector("[data-campo='p1']").value = g.p1 ?? 0;
                tr.querySelector("[data-campo='p2']").value = g.p2 ?? 0;
                tr.querySelector("[data-campo='trabalhos']").value = g.trabalhos ?? 0;
                tr.querySelector("[data-campo='recuperacao']").value = g.recuperacao ?? "";
                tr.querySelector("[data-campo='p1']").dispatchEvent(new Event('input', { bubbles: true }));
                tr.querySelector(".td-faltas").textContent = g.faltas ?? "0";
            }
        }
    }

    btnSalvarNotas.addEventListener("click", async () => {
        const materia = materiaSelect.value;
        const bimestre = selectBimestre.value;
        btnSalvarNotas.disabled = true;
        btnSalvarNotas.innerText = "Salvando...";
        try {
            const linhas = corpoTabelaNotas.querySelectorAll("tr");
            for (let tr of linhas) {
                const uid = tr.dataset.uid;
                const p1 = parseFloat(tr.querySelector("[data-campo='p1']").value) || 0;
                const p2 = parseFloat(tr.querySelector("[data-campo='p2']").value) || 0;
                const trab = parseFloat(tr.querySelector("[data-campo='trabalhos']").value) || 0;
                const recVal = tr.querySelector("[data-campo='recuperacao']").value;
                const media = parseFloat(tr.querySelector(".td-media").textContent) || 0;
                const faltas = parseInt(tr.querySelector(".td-faltas").textContent) || 0;

                const snap = await get(ref(db, `grades/${uid}/${materia}/${bimestre}`));
                const dadosOriginais = snap.val() || {};

                await set(ref(db, `grades/${uid}/${materia}/${bimestre}`), {
                    ...dadosOriginais,
                    p1, p2, trabalhos: trab, recuperacao: recVal !== "" ? parseFloat(recVal) : "",
                    media, faltas, professor: u.email, dataPostagem: new Date().toLocaleDateString()
                });
            }
            alert("Notas salvas!");
        } catch (e) { alert("Erro ao salvar."); }
        finally { btnSalvarNotas.disabled = false; btnSalvarNotas.innerText = "Salvar Notas"; }
    });

  // 4. 🗓️ LÓGICA DE FALTAS (ATUALIZADA: INSTANTÂNEA + AULA DUPLA)
    async function carregarAlunosParaFaltas() {
        const serie = serieSelect.value;
        if (!serie) return;
        
        listaAlunosFaltas.innerHTML = "Carregando alunos...";

        try {
            const snap = await get(ref(db, "users"));
            const data = snap.val();
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
                        <div style="display:flex; gap:15px; align-items:center;">
                            <label style="cursor:pointer; font-size:12px; display:flex; align-items:center; gap:4px; background:#f8f008; padding:5px 8px; border-radius:6px; color:#32066d; font-weight:bold;">
                                <input type="checkbox" class="chk-aula-1" data-uid="${a.uid}"> 1ª Aula
                            </label>
                            <label style="cursor:pointer; font-size:12px; display:flex; align-items:center; gap:4px; background:#f8f008; padding:5px 8px; border-radius:6px; color:#32066d; font-weight:bold;">
                                <input type="checkbox" class="chk-aula-2" data-uid="${a.uid}"> 2ª Aula
                            </label>
                        </div>`;
                    listaAlunosFaltas.appendChild(div);
                });

            await carregarHistoricoFaltas();
        } catch (e) { console.error(e); }
    }

    async function carregarHistoricoFaltas() {
        const materia = materiaSelect.value;
        const bimestre = selectBimestre.value;
        const serie = serieSelect.value;
        let cont = document.getElementById("contHistFaltas");

        if (!cont) {
            cont = document.createElement("div");
            cont.id = "contHistFaltas";
            cont.style.cssText = "margin-top:20px;padding:15px;background:#f9f9f9;border:1px solid #ddd;border-radius:8px;";
            btnSalvarFaltas.after(cont);
        }

        if (!materia || !serie || !bimestre) {
            cont.innerHTML = "<p style='color:#666;'>Selecione todos os filtros no topo.</p>";
            return;
        }

        cont.innerHTML = `🔍 Buscando registros do ${bimestre}º Bimestre...`;

        try {
            const snapUsers = await get(ref(db, "users"));
            const users = snapUsers.val();
            let mapaDatas = {}; 

            for (let uid in users) {
                if (users[uid].role === "student" && users[uid].serie === serie) {
                    const snapH = await get(ref(db, `grades/${uid}/${materia}/${bimestre}/historicoFaltas`));
                    if (snapH.exists()) {
                        Object.values(snapH.val()).forEach(dataFalta => {
                            if (!mapaDatas[dataFalta]) mapaDatas[dataFalta] = [];
                            if (!mapaDatas[dataFalta].includes(users[uid].name)) {
                                mapaDatas[dataFalta].push(users[uid].name);
                            }
                        });
                    }
                }
            }

            const listaDatas = Object.keys(mapaDatas).sort().reverse();
            
            cont.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <h4 style="margin:0; color:#32066d;">🗓️ Datas com faltas (${bimestre}º Bimestre):</h4>
                <button onclick="window.limparTodoHistorico()" style="background:#000; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer; font-size:11px;">Apagar Tudo</button>
            </div>`;

            if (listaDatas.length === 0) {
                cont.innerHTML += `<p style='color:#888;'>Nenhum registro no ${bimestre}º bimestre.</p>`;
                return;
            }

            const ul = document.createElement("ul");
            ul.style.cssText = "list-style:none;padding:0;";
            listaDatas.forEach(data => {
                const li = document.createElement("li");
                li.style.cssText = "background:#fff;border:1px solid #eee;border-left:5px solid #32066d;margin-bottom:8px;padding:10px;border-radius:5px;position:relative;";
                const dataFormatada = data.split('-').reverse().join('/');
                li.innerHTML = `
                    <div style="margin-right:100px;">
                        <span>Aula dia: <strong>${dataFormatada}</strong></span><br>
                        <small style="color:#666; display:block; margin-top:4px;">Faltaram: ${mapaDatas[data].join(", ")}</small>
                    </div>
                    <button onclick="window.excluirDiaFalta('${data}')" style="position:absolute; right:10px; top:50%; transform:translateY(-50%); background:#ff4444; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer; font-size:12px;">Excluir</button>`;
                ul.appendChild(li);
            });
            cont.appendChild(ul);
        } catch (e) { 
            console.error(e);
            cont.innerHTML = "<p style='color:red;'>Erro ao carregar histórico.</p>"; 
        }
    }

    window.excluirDiaFalta = async (dataAlvo) => {
        const materia = materiaSelect.value;
        const bimestre = selectBimestre.value;
        const serie = serieSelect.value;
        if (!confirm(`Excluir as faltas do dia ${dataAlvo.split('-').reverse().join('/')}?`)) return;

        try {
            const snapUsers = await get(ref(db, "users"));
            const users = snapUsers.val();
            const promessas = [];

            for (let uid in users) {
                if (users[uid].role === "student" && users[uid].serie === serie) {
                    const refP = `grades/${uid}/${materia}/${bimestre}`;
                    const p = (async () => {
                        const snapG = await get(ref(db, refP));
                        if (!snapG.exists()) return;
                        const dados = snapG.val();
                        if (dados.historicoFaltas) {
                            for (let key in dados.historicoFaltas) {
                                if (dados.historicoFaltas[key] === dataAlvo) {
                                    const peso = (dados.pesosFaltas && dados.pesosFaltas[dataAlvo]) ? dados.pesosFaltas[dataAlvo] : 1;
                                    await remove(ref(db, `${refP}/historicoFaltas/${key}`));
                                    if (dados.pesosFaltas && dados.pesosFaltas[dataAlvo]) {
                                        await remove(ref(db, `${refP}/pesosFaltas/${dataAlvo}`));
                                    }
                                    const faltasAtuais = parseInt(dados.faltas) || 0;
                                    await update(ref(db, refP), { faltas: Math.max(0, faltasAtuais - peso) });
                                }
                            }
                        }
                    })();
                    promessas.push(p);
                }
            }
            await Promise.all(promessas);

            // ATUALIZAÇÃO INSTANTÂNEA
            setTimeout(async () => {
                await carregarHistoricoFaltas();
                if (typeof carregarTabelaNotas === "function") await carregarTabelaNotas();
                alert("Dia excluído com sucesso!");
            }, 400);

        } catch (e) { console.error(e); alert("Erro ao excluir."); }
    };

    window.limparTodoHistorico = async () => {
        const materia = materiaSelect.value;
        const bimestre = selectBimestre.value;
        const serie = serieSelect.value;
        if (!confirm("⚠️ Apagar TODAS as faltas desta matéria no bimestre?")) return;
        try {
            const snapUsers = await get(ref(db, "users"));
            const users = snapUsers.val();
            const promessas = [];
            for (let uid in users) {
                if (users[uid].role === "student" && users[uid].serie === serie) {
                    promessas.push(update(ref(db, `grades/${uid}/${materia}/${bimestre}`), { 
                        faltas: 0, 
                        historicoFaltas: null,
                        pesosFaltas: null 
                    }));
                }
            }
            await Promise.all(promessas);
            
            setTimeout(async () => {
                await carregarHistoricoFaltas();
                if (typeof carregarTabelaNotas === "function") await carregarTabelaNotas();
                alert("Histórico limpo!");
            }, 400);

        } catch (e) { alert("Erro ao limpar."); }
    };

    btnSalvarFaltas.addEventListener("click", async () => {
        const materia = materiaSelect.value;
        const dataFalta = dataFaltaInput.value;
        const bimestre = selectBimestre.value;

        if (!materia || !dataFalta || !bimestre) return alert("Preencha matéria, data e bimestre!");

        const linhas = listaAlunosFaltas.querySelectorAll("div[style*='display:flex']");
        btnSalvarFaltas.disabled = true;
        btnSalvarFaltas.innerText = "Salvando...";

        try {
            const promessas = [];
            for (let linha of linhas) {
                const cb1 = linha.querySelector(".chk-aula-1");
                const cb2 = linha.querySelector(".chk-aula-2");
                const uid = cb1.dataset.uid;

                let faltasNoDia = 0;
                if (cb1.checked) faltasNoDia++;
                if (cb2.checked) faltasNoDia++;

                if (faltasNoDia > 0) {
                    const operacao = (async () => {
                        const refP = `grades/${uid}/${materia}/${bimestre}`;
                        let snap = await get(ref(db, refP));
                        let dados = snap.val() || { faltas: 0 };

                        const snapHist = await get(ref(db, `${refP}/historicoFaltas`));
                        let jaExiste = false;
                        if (snapHist.exists()) jaExiste = Object.values(snapHist.val()).includes(dataFalta);

                        if (!jaExiste) {
                            await push(ref(db, `${refP}/historicoFaltas`), dataFalta);
                            await update(ref(db, refP), { 
                                faltas: (parseInt(dados.faltas) || 0) + faltasNoDia,
                                [`pesosFaltas/${dataFalta}`]: faltasNoDia
                            });
                        }
                    })();
                    promessas.push(operacao);
                }
            }
            await Promise.all(promessas);
            
            // ATUALIZAÇÃO INSTANTÂNEA DO BOLETIM E HISTÓRICO
            setTimeout(async () => {
                await carregarHistoricoFaltas();
                if (typeof carregarTabelaNotas === "function") await carregarTabelaNotas();
                
                alert("Faltas lançadas e boletim atualizado!");
                dataFaltaInput.value = "";
                listaAlunosFaltas.querySelectorAll("input:checked").forEach(i => i.checked = false);
                btnSalvarFaltas.disabled = false; 
                btnSalvarFaltas.innerText = "Salvar Faltas";
            }, 400);

        } catch (e) { 
            alert("Erro ao salvar."); 
            btnSalvarFaltas.disabled = false;
            btnSalvarFaltas.innerText = "Salvar Faltas";
        }
    });
    // 5. 📖 LÓGICA DE CONTEÚDOS
    async function carregarConteudos() {
        const materia = materiaSelect.value;
        const serie = serieSelect.value;
        listaConteudos.innerHTML = "";
        if (!materia || !serie) return;

        try {
            const snap = await get(ref(db, `conteudos/${auth.currentUser.uid}/${serie}/${materia}`));
            const dados = snap.val();
            if (!dados) { listaConteudos.innerHTML = "<li>Nenhum conteúdo.</li>"; return; }

            Object.keys(dados).reverse().forEach(k => {
                const c = dados[k];
                const li = document.createElement("li");
                li.innerHTML = `<span><strong>[${c.bimestre}º Bim]</strong> ${c.data} - ${c.conteudo}</span>
                    <div class="botoes-lista">
                        <button class="btn-editar" onclick="window.editarConteudo('${k}', '${c.data}', '${c.conteudo}', '${c.bimestre}')">Editar</button>
                        <button class="btn-excluir" onclick="window.excluirConteudo('${k}')">Excluir</button>
                    </div>`;
                listaConteudos.appendChild(li);
            });
        } catch (e) { console.error(e); }
    }

    btnSalvarConteudo.addEventListener("click", async () => {
        const materia = materiaSelect.value;
        const serie = serieSelect.value;
        const texto = conteudoInput.value.trim();
        const bimestre = selectBimestre.value; // Usa o bimestre mestre

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

    // Globais de Conteúdo
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
        // Opcional: sincronizar o bimestre mestre com o do conteúdo editado
        selectBimestre.value = bimestre;
        btnSalvarConteudo.innerText = "Atualizar Conteúdo";
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    // --- ADICIONE OU SUBSTITUA ESTAS FUNÇÕES NO SEU ARQUIVO ---

// 1. Função para Esconder/Mostrar a lista (Toggle)
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
            // Caminho no Firebase para buscar os conteúdos
            const path = `conteudos/${auth.currentUser.uid}/${serie}/${materia}`;
            const snap = await get(ref(db, path));
            
            if (!snap.exists()) {
                return alert("Nenhum conteúdo encontrado para esta série/matéria.");
            }

            // Filtra os conteúdos pelo bimestre selecionado no seletor do PDF
            const todos = snap.val();
            const filtrados = Object.values(todos).filter(c => 
                String(c.bimestre) === String(bimestreFiltro)
            );

            if (filtrados.length === 0) {
                return alert(`Não há conteúdos lançados para o ${bimestreFiltro}º Bimestre.`);
            }

            // Inicializa o jsPDF
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();

            // Configuração do cabeçalho
            doc.setFontSize(16);
            doc.text("Relatório de Conteúdos Lecionados", 10, 15);
            
            doc.setFontSize(11);
            doc.text(`Série: ${serie} | Matéria: ${materia}`, 10, 25);
            doc.text(`Bimestre: ${bimestreFiltro}º Bimestre`, 10, 32);
            doc.line(10, 35, 200, 35);

            let y = 45;
            // Ordena os conteúdos por data (do mais antigo para o mais novo)
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
                
                y += (txt.length * 7) + 12; // Espaçamento entre itens
            });

            // Nome do arquivo PDF
            doc.save(`Relatorio_Conteudo_${serie}_${bimestreFiltro}Bim.pdf`);

        } catch (e) {
            console.error("Erro ao gerar PDF:", e);
            alert("Erro ao processar o arquivo PDF.");
        }
    };
}
