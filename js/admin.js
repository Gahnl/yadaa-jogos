import { auth, db, firebaseConfig } from "/js/firebase.js";
import { ref, set, get, remove, onValue, update } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-database.js";
import { onAuthStateChanged, getAuth, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";


// Variáveis globais de controle
let atribuicoesProfessor = {};
let editandoProfessorUid = null;

// --- FUNÇÃO PARA MOSTRAR/ESCONDER SENHA (NOVA) ---
window.toggleSenha = (idCampo) => {
    const campo = document.getElementById(idCampo);
    if (campo.type === "password") {
        campo.type = "text";
    } else {
        campo.type = "password";
    }
};

// ------------------------------------------------------------------
// 🔒 PROTEÇÃO DE ROTA
// ------------------------------------------------------------------
onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = "index.html"; return; }
    try {
        const snap = await get(ref(db, "users/" + user.uid));
        if (!snap.exists() || snap.val().role !== "admin") {
            window.location.href = "index.html";
        } else {
            carregarListasUsuarios();
            carregarAlunosDatalist();
        }
    } catch (err) { window.location.href = "index.html"; }
});

// ------------------------------------------------------------------
// 📋 GERENCIAMENTO DE EXIBIÇÃO (TOGGLES)
// ------------------------------------------------------------------
function setupToggles() {
    const btnProf = document.getElementById("btnToggleProf");
    const btnAlu = document.getElementById("btnToggleAlunos");
    const contProf = document.getElementById("containerProfessores");
    const contAlu = document.getElementById("containerAlunos");

    btnProf?.addEventListener("click", () => {
        const isHidden = contProf.style.display === "none";
        contProf.style.display = isHidden ? "block" : "none";
        contAlu.style.display = "none";
        btnProf.textContent = isHidden ? "📁 Fechar Professores" : "📂 Ver Professores";
    });

    btnAlu?.addEventListener("click", () => {
        const isHidden = contAlu.style.display === "none";
        contAlu.style.display = isHidden ? "block" : "none";
        contProf.style.display = "none";
        btnAlu.textContent = isHidden ? "📁 Fechar Alunos" : "📂 Ver Alunos";
    });
}
setupToggles();

// ------------------------------------------------------------------
// 📋 LISTAR USUÁRIOS (COM EDIÇÃO DE ALUNO E SENHA)
// ------------------------------------------------------------------
function carregarListasUsuarios() {
    const listaProf = document.getElementById("listaProfessores");
    const listaAlu = document.getElementById("listaAlunosCadastrados");

    // TRAVA DE SEGURANÇA: Se um dos dois não existir, para a execução aqui
    if (!listaProf || !listaAlu) {
        console.warn("Elementos de lista não encontrados no HTML atual.");
        return;
    }

    onValue(ref(db, "users"), (snapshot) => {
        if (!snapshot.exists()) return;
        
        // Se o elemento sumiu da tela enquanto os dados chegavam, aborta
        if (!listaProf || !listaAlu) return;

        const usuariosObj = snapshot.val();
        
        const usuariosOrdenados = Object.keys(usuariosObj).map(uid => ({
            uid: uid,
            ...usuariosObj[uid]
        })).sort((a, b) => (a.name || "").localeCompare(b.name || "", 'pt-BR'));

        listaProf.innerHTML = ""; 
        listaAlu.innerHTML = "";

        usuariosOrdenados.forEach((user) => {
            const uid = user.uid;
            const tr = document.createElement("tr");

            if (user.role === "teacher") {
                let atribStr = "-";
                if (user.atribuicoes) {
                    atribStr = Object.entries(user.atribuicoes)
                        .map(([turma, mats]) => `${turma} (${mats.join(", ")})`)
                        .join(" | ");
                }
                tr.innerHTML = `
                    <td>${user.name}</td>
                    <td>${user.email}</td>
                    <td>${atribStr}</td>
                    <td>
                        <button onclick="prepararEdicaoProf('${uid}')" style="background-color: #f8f008; color: #32066d; border:none; padding:5px 10px; cursor:pointer; margin-right:5px; border-radius:4px; font-weight:bold;">Editar</button>
                        <button onclick="removerUser('${uid}')" class="btn-delete">Excluir</button>
                    </td>`;
                listaProf.appendChild(tr);
            } else if (user.role === "student") {
                tr.innerHTML = `
                    <td>${user.name}</td>
                    <td>${user.email}</td>
                    <td>${user.serie || "-"}</td>
                    <td>
                        <button onclick="editarNomeAluno('${uid}', '${user.name}')" style="background-color: #4CAF50; color: white; border:none; padding:5px 10px; cursor:pointer; margin-right:5px; border-radius:4px; font-weight:bold;">Nome</button>
                        <button onclick="resetarSenhaFicticia('${uid}')" style="background-color: #2196F3; color: white; border:none; padding:5px 10px; cursor:pointer; margin-right:5px; border-radius:4px; font-weight:bold;">Senha</button>
                        <button onclick="removerUser('${uid}')" class="btn-delete">Excluir</button>
                    </td>`;
                listaAlu.appendChild(tr);
            }
        });
    }, (error) => {
        console.error("Erro de permissão ou leitura:", error);
    });
}

// 📝 FUNÇÃO PARA EDITAR NOME DO ALUNO (Direto no Banco de Dados)
window.editarNomeAluno = function(uid, nomeAtual) {
    const novoNome = prompt("Digite o nome correto do aluno:", nomeAtual);
    
    if (novoNome && novoNome.trim() !== "") {
        const userRef = ref(db, `users/${uid}`);
        update(userRef, { name: novoNome.trim() })
            .then(() => alert("Nome atualizado com sucesso!"))
            .catch((error) => alert("Erro ao atualizar: " + error.message));
    }
};

// 🔑 FUNÇÃO PARA RESETAR SENHA (PARA E-MAILS FICTÍCIOS)
window.resetarSenhaFicticia = function(uid) {
    const novaSenha = prompt("Digite a nova senha para este aluno (mínimo 6 caracteres):");
    
    if (novaSenha && novaSenha.length >= 6) {
        const userRef = ref(db, `users/${uid}`);
        // Grava no banco para controle do ADM. 
        // Nota: O Firebase Auth não muda automaticamente, mas você terá o registro do que definiu.
        update(userRef, { 
            senhaProvisoria: novaSenha,
            precisaTrocarSenha: true 
        })
        .then(() => alert("Comando de senha enviado para o banco de dados!"))
        .catch((error) => alert("Erro ao registrar nova senha: " + error.message));
    } else if (novaSenha) {
        alert("A senha precisa ter pelo menos 6 caracteres!");
    }
};

// ------------------------------------------------------------------
// 📄 FUNÇÕES DE GERAÇÃO DE PDF (LUCKY SYSTEM)
// ------------------------------------------------------------------

document.getElementById("btnGerarPdfProf")?.addEventListener("click", () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text("RELATÓRIO DE PROFESSORES - COLÉGIO SABER", 14, 15);
    const rows = [];
    document.querySelectorAll("#listaProfessores tr").forEach(tr => {
        rows.push([tr.cells[0].innerText, tr.cells[1].innerText, tr.cells[2].innerText]);
    });
    doc.autoTable({
        startY: 25,
        head: [['Nome', 'E-mail', 'Atribuições']],
        body: rows,
        headStyles: { fillColor: [50, 6, 109] }
    });
    doc.save("Professores_Cadastrados.pdf");
});

document.getElementById("btnGerarPdfAlunos")?.addEventListener("click", () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text("RELATÓRIO GERAL DE ALUNOS - COLÉGIO SABER", 14, 15);
    const rows = [];
    document.querySelectorAll("#listaAlunosCadastrados tr").forEach(tr => {
        rows.push([tr.cells[0].innerText, tr.cells[1].innerText, tr.cells[2].innerText]);
    });
    doc.autoTable({
        startY: 25,
        head: [['Nome', 'E-mail', 'Série']],
        body: rows,
        headStyles: { fillColor: [50, 6, 109] }
    });
    doc.save("Alunos_Geral.pdf");
});

document.getElementById("btnPdfListaTurma")?.addEventListener("click", () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const titulo = document.getElementById("tituloListaTurma").innerText;
    doc.text(titulo, 14, 15);
    const rows = [];
    document.querySelectorAll("#corpoListaTurma tr").forEach(tr => {
        if(tr.cells.length > 1) rows.push([tr.cells[0].innerText, tr.cells[1].innerText]);
    });
    doc.autoTable({
        startY: 25,
        head: [['Nome do Aluno', 'E-mail']],
        body: rows,
        headStyles: { fillColor: [50, 6, 109] }
    });
    doc.save(`${titulo.replace(/ /g, "_")}.pdf`);
});

// ------------------------------------------------------------------
// 🛠️ LÓGICA DE EDIÇÃO E CADASTRO
// ------------------------------------------------------------------

window.prepararEdicaoProf = async (uid) => {
    try {
        const snap = await get(ref(db, "users/" + uid));
        if (!snap.exists()) return;
        const prof = snap.val();

        document.getElementById("profName").value = prof.name;
        document.getElementById("profEmail").value = prof.email;
        document.getElementById("profEmail").disabled = true; 
        document.getElementById("profSenha").placeholder = "Bloqueado na edição";
        document.getElementById("profSenha").disabled = true; 
        document.getElementById("profSenha").type = "password"; // Garante que volte a ser password na edição

        atribuicoesProfessor = JSON.parse(JSON.stringify(prof.atribuicoes || {}));
        editandoProfessorUid = uid;

        renderizarListaAtribuicoes();
        document.getElementById("btnCreateProf").textContent = "💾 Salvar Alterações";
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) { alert("Erro ao carregar: " + e.message); }
};

document.getElementById("btnAddAtribuicao")?.addEventListener("click", () => {
    const checksTurmas = document.querySelectorAll("#listTurmaAtribuicao input:checked");
    const checksMaterias = document.querySelectorAll("#listMatAtribuicao input:checked");
    
    const turmas = Array.from(checksTurmas).map(c => c.value);
    const materias = Array.from(checksMaterias).map(c => c.value);

    if (turmas.length === 0 || materias.length === 0) return alert("Selecione turma e matéria!");

    turmas.forEach(t => {
        if (atribuicoesProfessor[t]) {
            atribuicoesProfessor[t] = Array.from(new Set([...atribuicoesProfessor[t], ...materias]));
        } else {
            atribuicoesProfessor[t] = materias;
        }
    });

    renderizarListaAtribuicoes();
    
    checksTurmas.forEach(c => c.checked = false);
    checksMaterias.forEach(c => c.checked = false);
    document.getElementById("fieldTurmaAtribuicao").textContent = "Selecionar Turmas";
    document.getElementById("fieldMatAtribuicao").textContent = "Selecionar Matérias";
});

function renderizarListaAtribuicoes() {
    const listaUI = document.getElementById("listaAtribuidas");
    listaUI.innerHTML = "";
    for (let t in atribuicoesProfessor) {
        const li = document.createElement("li");
        li.innerHTML = `<b>${t}:</b> ${atribuicoesProfessor[t].join(", ")} 
                        <button type="button" onclick="removerAtribuicao('${t}')" style="color:red; border:none; background:none; cursor:pointer; font-weight:bold;">[x]</button>`;
        listaUI.appendChild(li);
    }
}

window.removerAtribuicao = (turma) => {
    delete atribuicoesProfessor[turma];
    renderizarListaAtribuicoes();
};

document.getElementById("btnCreateProf")?.addEventListener("click", async () => {
    const name = document.getElementById("profName").value.trim();
    const email = document.getElementById("profEmail").value.trim();
    const senha = document.getElementById("profSenha").value.trim();

    if (!name || !email || (Object.keys(atribuicoesProfessor).length === 0)) 
        return alert("Preencha nome e adicione atribuições!");

    try {
        if (editandoProfessorUid) {
            const updates = {};
            updates[`/users/${editandoProfessorUid}/name`] = name;
            updates[`/users/${editandoProfessorUid}/atribuicoes`] = atribuicoesProfessor;

            await update(ref(db), updates);
            alert("Professor atualizado com sucesso!");
        } else {
            if (!senha) return alert("Senha é obrigatória!");
            const dados = { name, email, role: "teacher", atribuicoes: atribuicoesProfessor, precisaTrocarSenha: true };
            await criarUsuarioNoSecondaryApp(email, senha, dados);
            alert("Professor cadastrado!");
        }
        resetarFormularioProf();
    } catch (e) { 
        console.error(e);
        alert("Erro ao salvar: " + e.message); 
    }
});

function resetarFormularioProf() {
    atribuicoesProfessor = {};
    editandoProfessorUid = null;
    document.getElementById("profName").value = "";
    document.getElementById("profEmail").value = "";
    document.getElementById("profEmail").disabled = false;
    document.getElementById("profSenha").value = "";
    document.getElementById("profSenha").disabled = false;
    document.getElementById("profSenha").type = "password";
    document.getElementById("profSenha").placeholder = "Senha";
    document.getElementById("btnCreateProf").textContent = "Finalizar Cadastro do Professor";
    document.getElementById("listaAtribuidas").innerHTML = "";
    document.getElementById("fieldTurmaAtribuicao").textContent = "Selecionar Turmas";
    document.getElementById("fieldMatAtribuicao").textContent = "Selecionar Matérias";
}

function setupMultiSelect(fieldId, listId, defaultText) {
    const field = document.getElementById(fieldId);
    const list = document.getElementById(listId);
    
    field?.addEventListener("click", (e) => {
        e.stopPropagation();
        list.style.display = list.style.display === "block" ? "none" : "block";
    });

    list?.addEventListener("change", () => {
        const checks = list.querySelectorAll("input:checked");
        const sel = Array.from(checks).map(c => c.value);
        field.textContent = sel.length ? sel.join(", ") : defaultText;
        field.style.fontWeight = sel.length ? "bold" : "normal";
        field.style.color = sel.length ? "#32066d" : "#666";
    });

    document.addEventListener("click", (e) => { 
        if (!field?.contains(e.target) && !list?.contains(e.target)) list.style.display = "none"; 
    });
}

setupMultiSelect("fieldTurmaAtribuicao", "listTurmaAtribuicao", "Selecionar Turmas");
setupMultiSelect("fieldMatAtribuicao", "listMatAtribuicao", "Selecionar Matérias");

async function criarUsuarioNoSecondaryApp(email, senha, dadosPublicos) {
    const appName = "TempApp_" + Date.now();
    const tempApp = initializeApp(firebaseConfig, appName);
    const tempAuth = getAuth(tempApp);
    try {
        const uc = await createUserWithEmailAndPassword(tempAuth, email, senha);
        await set(ref(db, "users/" + uc.user.uid), dadosPublicos);
        await signOut(tempAuth);
        await deleteApp(tempApp);
        return true;
    } catch (error) { await deleteApp(tempApp); throw error; }
}

window.removerUser = async (uid) => {
    if (confirm("Deseja realmente excluir?")) {
        try { await remove(ref(db, "users/" + uid)); alert("Removido!"); } 
        catch (e) { alert(e.message); }
    }
};

document.getElementById("btnCreateAluno")?.addEventListener("click", async () => {
    const name = document.getElementById("alunoName").value.trim();
    const email = document.getElementById("alunoEmail").value.trim();
    const senha = document.getElementById("alunoSenha").value.trim();
    const serie = document.getElementById("alunoSerie").value;
    if (!name || !email || !senha || !serie) return alert("Preencha tudo!");
    try {
        await criarUsuarioNoSecondaryApp(email, senha, { name, email, role: "student", serie, precisaTrocarSenha: true });
        alert("Aluno cadastrado!");
        location.reload();
    } catch (e) { alert(e.message); }
});

const setupSearch = (inputId, tableBodyId) => {
    document.getElementById(inputId)?.addEventListener("keyup", (e) => {
        const term = e.target.value.toLowerCase();
        const rows = document.getElementById(tableBodyId).querySelectorAll("tr");
        rows.forEach(row => row.style.display = row.innerText.toLowerCase().includes(term) ? "" : "none");
    });
};
setupSearch("buscaProf", "listaProfessores");
setupSearch("buscaAluno", "listaAlunosCadastrados");

document.getElementById("btnGerarLista")?.addEventListener("click", async () => {
    const serie = document.getElementById("filtroSerie").value;
    const corpo = document.getElementById("corpoListaTurma");
    const container = document.getElementById("containerListaTurma");
    const titulo = document.getElementById("tituloListaTurma");

    if (!serie) return alert("Selecione a turma para gerar a lista!");

    try {
        const snap = await get(ref(db, "users"));
        const usuariosObj = snap.val();
        corpo.innerHTML = "";
        titulo.innerText = `Alunos Matriculados - ${serie}`;

        const alunosOrdenados = Object.values(usuariosObj)
            .filter(u => u.role === "student" && u.serie === serie)
            .sort((a, b) => (a.name || "").localeCompare(b.name || "", 'pt-BR'));

        if (alunosOrdenados.length === 0) {
            corpo.innerHTML = "<tr><td colspan='2' style='text-align:center;'>Nenhum aluno encontrado nesta turma.</td></tr>";
        } else {
            alunosOrdenados.forEach(u => {
                const tr = document.createElement("tr");
                tr.innerHTML = `<td>${u.name}</td><td>${u.email}</td>`;
                corpo.appendChild(tr);
            });
        }

        container.style.display = "block";
        container.scrollIntoView({ behavior: 'smooth' });
    } catch (e) { alert("Erro ao buscar lista."); }
});

// ------------------------------------------------------------------
// 📊 VISUALIZAÇÃO DO BOLETIM (ADM - PADRÃO FINAL)
// ------------------------------------------------------------------

let dadosGlobaisBoletim = [];
let alunoSelecionadoNome = "";
let serieSelecionada = "";

// 🔥 ARREDONDAMENTO IGUAL AO PROFESSOR
function arredondarEscola(nota) {
    if (isNaN(nota) || nota === null) return 0;

    const inteiro = Math.floor(nota);
    const decimal = parseFloat((nota - inteiro).toFixed(2)); 

    if (decimal <= 0.25) {
        return inteiro;
    } else if (decimal <= 0.75) {
        return inteiro + 0.5;
    } else {
        return inteiro + 1;
    }
}

// 🔥 NORMALIZAÇÃO (aceita 6,4 ou 6.4)
function normalizarNota(valor) {
    if (valor === undefined || valor === null || valor === "") return null;
    return parseFloat(String(valor).replace(",", "."));
}

document.getElementById("btnVisualizarBoletim")?.addEventListener("click", async () => {
    const nome = document.getElementById("filtroAluno").value.trim();
    const corpo = document.getElementById("tabelaCorpoPreview");

    if (!nome) return alert("Selecione um Aluno!");

    try {
        const usersSnap = await get(ref(db, "users"));
        const users = usersSnap.val();
        
        let alunoUID = Object.keys(users).find(uid => users[uid].name === nome);
        if (!alunoUID) return alert("Aluno não encontrado!");

        const serieDoAluno = users[alunoUID].serie;
        serieSelecionada = serieDoAluno;

        if (!serieDoAluno) {
            return alert("Aluno sem série cadastrada.");
        }

        const gradesSnap = await get(ref(db, `grades/${alunoUID}`));
        const notas = gradesSnap.val() || {};

        const materiasParaExibir = new Set();

        // matérias dos professores
        Object.values(users).forEach(u => {
            if (u.role === "teacher" && u.atribuicoes && u.atribuicoes[serieDoAluno]) {
                u.atribuicoes[serieDoAluno].forEach(m => materiasParaExibir.add(m));
            }
        });

        // matérias que já têm nota
        Object.keys(notas).forEach(mat => materiasParaExibir.add(mat));

        const listaFinalMaterias = Array.from(materiasParaExibir)
            .sort((a, b) => a.localeCompare(b, 'pt-BR'));

        if (listaFinalMaterias.length === 0) {
            return alert("Nenhuma matéria encontrada.");
        }

        corpo.innerHTML = "";
        dadosGlobaisBoletim = [];
        alunoSelecionadoNome = nome;

        document.getElementById("infoAlunoPreview").innerText =
            `${nome} - ${serieDoAluno}`;

        // ----------------------------
        // 🔥 GERAÇÃO DA TABELA
        // ----------------------------
        listaFinalMaterias.forEach(mat => {
            let somaMedias = 0;
            let totalFaltas = 0;

            let nBims = [];
            let estilosBims = [];

            for (let b = 1; b <= 4; b++) {
                const dado = (notas[mat] && notas[mat][b]) ? notas[mat][b] : null;

                let notaBruta = normalizarNota(dado?.media);

                let notaExibicao = "";

                if (notaBruta !== null && !isNaN(notaBruta)) {
                    const notaArredondada = arredondarEscola(notaBruta);
                    notaExibicao = notaArredondada.toString().replace(".", ",");

                    somaMedias += notaBruta;
                } else {
                    somaMedias += 0; // 🔥 garante divisão por 4
                }

                const faltaValor = Number(dado?.faltas ?? 0);
                totalFaltas += faltaValor;

                nBims.push(notaExibicao);

                const cor = (notaExibicao !== "" && parseFloat(notaExibicao.replace(",", ".")) < 6)
                    ? "color: red;" : "";

                estilosBims.push(cor);
            }

            // 🔥 MÉDIA FINAL /4 + ARREDONDAMENTO ESCOLA
            const mediaBase = somaMedias / 4;
            const mediaFinal = arredondarEscola(mediaBase);

            const corMediaFinal = (mediaFinal < 6) ? "color: red;" : "";

            const faltasExibir = totalFaltas > 0 ? totalFaltas : "";

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><strong>${mat}</strong></td>
                <td style="${estilosBims[0]}">${nBims[0]}</td>
                <td style="${estilosBims[1]}">${nBims[1]}</td>
                <td style="${estilosBims[2]}">${nBims[2]}</td>
                <td style="${estilosBims[3]}">${nBims[3]}</td>
                <td style="font-weight:bold; ${corMediaFinal}">
                    ${mediaFinal.toString().replace(".", ",")}
                </td>
                <td>${faltasExibir}</td>
            `;

            corpo.appendChild(tr);

            dadosGlobaisBoletim.push([
                mat,
                nBims[0],
                nBims[1],
                nBims[2],
                nBims[3],
                mediaFinal,
                faltasExibir
            ]);
        });

        document.getElementById("areaPreview").style.display = "block";

    } catch (e) {
        console.error("Erro no boletim:", e);
        alert("Erro ao carregar boletim.");
    }
});

// ----------------------------
// 📄 PDF
// ----------------------------
document.getElementById("btnBaixarPDFConfirmado")?.addEventListener("click", () => {

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // ===== LOGO =====
    const logo = new Image();

    // caminho da logo
    logo.src = "/Assets/logo cs.png";
    


    logo.onload = () => {

        // ===== IMAGEM =====
        doc.addImage(logo, "PNG", 15, 8, 40, 22);

        // ===== TITULO =====
        doc.setFontSize(18);
        doc.setTextColor(50, 6, 109);

        doc.text("BOLETIM ESCOLAR", 105, 18, {
            align: "center"
        });

        // ===== DADOS =====
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);

        doc.text(`Aluno: ${alunoSelecionadoNome}`, 10, 42);
        doc.text(`Série: ${serieSelecionada}`, 10, 49);

        // ===== REMOVE MÉDIA =====
        const dadosSemMedia = dadosGlobaisBoletim.map(linha => [
            linha[0], // matéria
            linha[1], // 1º
            linha[2], // 2º
            linha[3], // 3º
            linha[4], // 4º
            linha[6]  // faltas
        ]);

        // ===== TABELA =====
        doc.autoTable({

            startY: 58,

            head: [[
                'Matéria',
                '1ºB',
                '2ºB',
                '3ºB',
                '4ºB',
                'Faltas'
            ]],

            body: dadosSemMedia,

            headStyles: {
                fillColor: [50, 6, 109]
            },

            styles: {
                halign: 'center'
            },

            columnStyles: {
                0: {
                    halign: 'left'
                }
            }
        });

        // ===== SALVAR =====
        doc.save(`Boletim_${alunoSelecionadoNome}.pdf`);
    };
});

// ----------------------------
// ❌ FECHAR
// ----------------------------
document.getElementById("btnFecharPreview")?.addEventListener("click", () => {
    document.getElementById("areaPreview").style.display = "none";
});

// ----------------------------
// 👥 LISTA DE ALUNOS
// ----------------------------
async function carregarAlunosDatalist() {
    const snap = await get(ref(db, "users"));
    const dados = snap.val();
    const datalist = document.getElementById("listaAlunos");

    if (!dados || !datalist) return;

    const nomesOrdenados = Object.values(dados)
        .filter(u => u.role === "student")
        .map(u => u.name)
        .sort((a, b) => (a || "").localeCompare(b || "", 'pt-BR'));

    datalist.innerHTML = "";

    nomesOrdenados.forEach(nome => {
        const opt = document.createElement("option");
        opt.value = nome;
        datalist.appendChild(opt);
    });
}