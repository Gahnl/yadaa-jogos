import { auth, db } from "/js/firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import { ref, get, set, push, remove } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-database.js";

// 🔒 PROTEÇÃO DE ROTA E VERIFICAÇÃO DE PERMISSÃO
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
        console.error("Erro de autenticação:", err);
        window.location.href = "index.html";
    }
});

function iniciarSistemaProfessor(u) {
    // ELEMENTOS DO DOM
    const serieSelect = document.getElementById("serieSelect");
    const materiaSelect = document.getElementById("materiaSelect");
    const corpoTabelaNotas = document.getElementById("corpoTabelaNotas");
    const btnSalvarNotas = document.getElementById("btnSalvarNotas");
    const serieFaltasSelect = document.getElementById("serieFaltasSelect");
    const listaAlunosFaltas = document.getElementById("listaAlunosFaltas");
    const dataFaltaInput = document.getElementById("dataFalta");
    const btnSalvarFaltas = document.getElementById("btnSalvarFaltas");
    const selectBimestre = document.getElementById("selectBimestre");
    const conteudoInput = document.getElementById("conteudo");
    const dataAulaInput = document.getElementById("dataAula");
    const bimestreConteudo = document.getElementById("bimestreConteudo");
    const btnSalvarConteudo = document.getElementById("btnSalvarConteudo");
    const listaConteudos = document.getElementById("listaConteudos");
    const secaoNotas = document.getElementById("secaoNotas");
    const bimestreNotas = document.getElementById("bimestreNotas");
    const mensagemNotas = document.getElementById("mensagemNotas");
    const btnGerarPDF = document.getElementById("btnGerarPDF");
    const filtroBimestrePDF = document.getElementById("filtroBimestrePDF");

    // POPULAR MATÉRIAS E TURMAS DO PROFESSOR
    function inicializarFiltros() {
        materiaSelect.innerHTML = '<option value="">Selecione a matéria</option>';
        if (u.subjects) {
            Object.keys(u.subjects).forEach(m => materiaSelect.add(new Option(m, m)));
        } else if (u.materia) {
            materiaSelect.add(new Option(u.materia, u.materia));
        }

        serieSelect.innerHTML = '<option value="">Selecione a série</option>';
        serieFaltasSelect.innerHTML = '<option value="">Selecione a série</option>';
        if (u.classes) {
            Object.keys(u.classes).filter(k => u.classes[k]).sort().forEach(t => {
                serieSelect.add(new Option(t, t));
                serieFaltasSelect.add(new Option(t, t));
            });
        }
    }

    inicializarFiltros();

    // CONTROLE DE VISIBILIDADE DA SEÇÃO DE NOTAS
    const atualizarVisibilidadeNotas = () => {
        if (bimestreNotas.value && materiaSelect.value && serieSelect.value) {
            secaoNotas.style.display = "block";
            mensagemNotas.style.display = "none";
            carregarTabelaNotas();
        } else {
            secaoNotas.style.display = "none";
            mensagemNotas.style.display = "block";
        }
    };

    bimestreNotas.addEventListener("change", atualizarVisibilidadeNotas);
    serieSelect.addEventListener("change", atualizarVisibilidadeNotas);
    materiaSelect.addEventListener("change", (e) => {
        atualizarVisibilidadeNotas();
        carregarConteudos();
    });

    // CARREGAR LISTA DE ALUNOS NA TABELA
    async function carregarTabelaNotas() {
        const serie = serieSelect.value;
        const materia = materiaSelect.value;
        if (!serie || !materia) return;

        corpoTabelaNotas.innerHTML = "<tr><td colspan='6'>Carregando alunos...</td></tr>";

        try {
            const snapshot = await get(ref(db, "users"));
            const data = snapshot.val();
            corpoTabelaNotas.innerHTML = "";

            for (let uid in data) {
                const aluno = data[uid];
                if (aluno.role === "student" && aluno.serie === serie) {
                    const tr = document.createElement("tr");
                    tr.dataset.uid = uid;
                    tr.innerHTML = `
                        <td>${aluno.name}</td>
                        <td><input type="number" data-campo="multidisciplinar" min="0" max="10" step="0.1" value="0"></td>
                        <td><input type="number" data-campo="avaliacao" min="0" max="10" step="0.1" value="0"></td>
                        <td><input type="number" data-campo="trabalho" min="0" max="10" step="0.1" value="0"></td>
                        <td class="td-media">0.0</td>
                        <td class="td-faltas">0</td>
                    `;
                    corpoTabelaNotas.appendChild(tr);
                }
            }
            carregarNotasExistentes();
        } catch (err) {
            console.error("Erro ao carregar alunos:", err);
        }
    }

    // CÁLCULO DE MÉDIA EM TEMPO REAL NA TELA
    corpoTabelaNotas.addEventListener("input", (e) => {
        if (e.target.tagName === "INPUT") {
            const tr = e.target.closest("tr");
            const m = parseFloat(tr.querySelector("[data-campo='multidisciplinar']").value) || 0;
            const a = parseFloat(tr.querySelector("[data-campo='avaliacao']").value) || 0;
            const t = parseFloat(tr.querySelector("[data-campo='trabalho']").value) || 0;
            tr.querySelector(".td-media").textContent = ((m + a + t) / 3).toFixed(1);
        }
    });

    // BUSCAR NOTAS JÁ SALVAS NO BANCO
    async function carregarNotasExistentes() {
        const materia = materiaSelect.value;
        const bimestre = bimestreNotas.value;
        const linhas = corpoTabelaNotas.querySelectorAll("tr");

        for (let tr of linhas) {
            const uid = tr.dataset.uid;
            const snap = await get(ref(db, `grades/${uid}/${materia}/${bimestre}`));
            const g = snap.val();
            if (g) {
                tr.querySelector("[data-campo='multidisciplinar']").value = g.multidisciplinar ?? 0;
                tr.querySelector("[data-campo='avaliacao']").value = g.avaliacao ?? 0;
                tr.querySelector("[data-campo='trabalho']").value = g.trabalho ?? 0;
                tr.querySelector(".td-media").textContent = g.media ?? "0.0";
                tr.querySelector(".td-faltas").textContent = g.faltas ?? "0";
            }
        }
    }

    // 🚀 SALVAR NOTAS (CORRIGIDO: INDIVIDUAL POR ALUNO NO LOOP)
    btnSalvarNotas.addEventListener("click", async () => {
        const materia = materiaSelect.value;
        const bimestre = bimestreNotas.value;
        if (!materia || !bimestre) return alert("Selecione matéria e bimestre!");

        btnSalvarNotas.disabled = true;
        btnSalvarNotas.innerText = "Salvando...";

        try {
            const linhas = corpoTabelaNotas.querySelectorAll("tr");
            for (let tr of linhas) {
                const uid = tr.dataset.uid;
                const m = parseFloat(tr.querySelector("[data-campo='multidisciplinar']").value) || 0;
                const a = parseFloat(tr.querySelector("[data-campo='avaliacao']").value) || 0;
                const t = parseFloat(tr.querySelector("[data-campo='trabalho']").value) || 0;
                const media = parseFloat(((m + a + t) / 3).toFixed(1));
                const faltas = parseInt(tr.querySelector(".td-faltas").textContent) || 0;

                // Caminho específico para cada aluno: grades/ID_ALUNO/MATERIA/BIMESTRE
                await set(ref(db, `grades/${uid}/${materia}/${bimestre}`), {
                    multidisciplinar: m,
                    avaliacao: a,
                    trabalho: t,
                    media: media,
                    faltas: faltas,
                    professor: auth.currentUser.email,
                    dataPostagem: new Date().toLocaleDateString()
                });
            }
            alert("Notas salvas com sucesso!");
        } catch (error) {
            console.error("Erro ao salvar:", error);
            alert("Erro de permissão ou conexão ao salvar notas.");
        } finally {
            btnSalvarNotas.disabled = false;
            btnSalvarNotas.innerText = "Salvar Notas";
        }
    });

    // CONTROLE DE FALTAS
    serieFaltasSelect.addEventListener("change", async () => {
        listaAlunosFaltas.innerHTML = "Carregando...";
        const serie = serieFaltasSelect.value;
        if (!serie) return;
        const snap = await get(ref(db, "users"));
        const data = snap.val();
        listaAlunosFaltas.innerHTML = "";
        for (let uid in data) {
            const a = data[uid];
            if (a.role === "student" && a.serie === serie) {
                listaAlunosFaltas.innerHTML += `<div><label><input type="checkbox" value="${uid}"> ${a.name}</label></div>`;
            }
        }
    });

    btnSalvarFaltas.addEventListener("click", async () => {
        const materia = materiaSelect.value;
        const dataFalta = dataFaltaInput.value;
        const bimestre = selectBimestre.value;
        if (!materia || !bimestre || !dataFalta) return alert("Preencha matéria, data e bimestre.");

        const selecionados = [...listaAlunosFaltas.querySelectorAll("input:checked")].map(cb => cb.value);
        if (selecionados.length === 0) return alert("Nenhum aluno selecionado.");

        btnSalvarFaltas.disabled = true;

        try {
            for (let uid of selecionados) {
                const refGrade = ref(db, `grades/${uid}/${materia}/${bimestre}`);
                const snap = await get(refGrade);
                const atual = snap.val() || { faltas: 0 };
                
                // Preserva os dados de notas existentes e incrementa faltas
                await set(refGrade, { 
                    ...atual, 
                    faltas: (parseInt(atual.faltas) || 0) + 1, 
                    professor: auth.currentUser.email 
                });
            }
            alert("Faltas registradas!");
            listaAlunosFaltas.querySelectorAll("input:checked").forEach(cb => cb.checked = false);
        } catch (err) {
            alert("Erro ao registrar faltas.");
        } finally {
            btnSalvarFaltas.disabled = false;
        }
    });

    // CONTEÚDOS DE AULA
    async function carregarConteudos() {
        const materia = materiaSelect.value;
        if (!materia) return;
        
        try {
            const snap = await get(ref(db, `conteudos/${auth.currentUser.uid}/${materia}`));
            const dados = snap.val();
            listaConteudos.innerHTML = "";
            if (!dados) {
                listaConteudos.innerHTML = "<li>Nenhum conteúdo lançado.</li>";
                return;
            }
            for (let k in dados) {
                const c = dados[k];
                const li = document.createElement("li");
                li.className = "item-conteudo";
                li.innerHTML = `
                    <span><strong>[${c.bimestre}º Bim]</strong> ${c.data} - ${c.conteudo}</span>
                    <button class="btn-editar" data-id="${k}">Editar</button>
                    <button class="btn-excluir" data-id="${k}">Excluir</button>
                `;

                li.querySelector(".btn-editar").onclick = () => {
                    dataAulaInput.value = c.data;
                    conteudoInput.value = c.conteudo;
                    bimestreConteudo.value = c.bimestre;
                    btnSalvarConteudo.innerText = "Atualizar";
                    btnSalvarConteudo.dataset.mode = "edit";
                    btnSalvarConteudo.dataset.editId = k;
                };

                li.querySelector(".btn-excluir").onclick = async () => {
                    if (confirm("Excluir conteúdo?")) {
                        await remove(ref(db, `conteudos/${auth.currentUser.uid}/${materia}/${k}`));
                        carregarConteudos();
                    }
                };
                listaConteudos.appendChild(li);
            }
        } catch (e) { console.error(e); }
    }

    btnSalvarConteudo.addEventListener("click", async () => {
        const materia = materiaSelect.value;
        if (!materia || !conteudoInput.value) return alert("Preencha os campos.");

        const dados = {
            data: dataAulaInput.value,
            conteudo: conteudoInput.value.trim(),
            bimestre: bimestreConteudo.value
        };

        if (btnSalvarConteudo.dataset.mode === "edit") {
            const id = btnSalvarConteudo.dataset.editId;
            await set(ref(db, `conteudos/${auth.currentUser.uid}/${materia}/${id}`), dados);
            delete btnSalvarConteudo.dataset.mode;
            btnSalvarConteudo.innerText = "Salvar Conteúdo";
        } else {
            const newRef = push(ref(db, `conteudos/${auth.currentUser.uid}/${materia}`));
            await set(newRef, dados);
        }
        conteudoInput.value = "";
        carregarConteudos();
    });

    // LOGOUT
    document.querySelector(".btn-logout").addEventListener("click", async () => {
        if (confirm("Deseja sair do sistema?")) {
            await signOut(auth);
            window.location.href = "index.html";
        }
    });
}