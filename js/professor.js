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

// 1. FUNÇÃO DE ARREDONDAMENTO ESPECIAL (0.25 BAIXO / 0.5 MANTÉM / 0.76 CIMA)
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
                <td><input type="number" data-campo="p1" min="0" max="10" step="0.1" value=""></td>
                <td><input type="number" data-campo="p2" min="0" max="10" step="0.1" value=""></td>
                <td><input type="number" data-campo="trabalhos" min="0" max="10" step="0.1" value=""></td>
                <td><input type="number" data-campo="recuperacao" min="0" max="10" step="0.1" value=""></td>
                <td class="td-media" style="font-weight:bold; text-align:center;">-</td>
                <td class="td-media-final" style="font-weight:bold; color: #32066d; text-align:center;">-</td>
                <td class="td-faltas" style="text-align:center;">0</td>
            `;
            corpoTabelaNotas.appendChild(tr);
        });
        
        await carregarNotasExistentes();
    } catch (err) { 
        console.error(err); 
    }
}

// OUVINTE PARA CÁLCULO EM TEMPO REAL (RECUPERAÇÃO SUBSTITUI MÉDIA DO BIMESTRE)
corpoTabelaNotas.addEventListener("input", (e) => {
    if (e.target.tagName === "INPUT") {
        const tr = e.target.closest("tr");
        const p1Val = tr.querySelector("[data-campo='p1']").value;
        const p2Val = tr.querySelector("[data-campo='p2']").value;
        const trabVal = tr.querySelector("[data-campo='trabalhos']").value;
        const recVal = tr.querySelector("[data-campo='recuperacao']").value;
        const tdMedia = tr.querySelector(".td-media");

        let notasParaCalcular = [];
        if (p1Val !== "") notasParaCalcular.push(parseFloat(p1Val));
        if (p2Val !== "") notasParaCalcular.push(parseFloat(p2Val));
        if (trabVal !== "") notasParaCalcular.push(parseFloat(trabVal));

        if (notasParaCalcular.length > 0) {
            const soma = notasParaCalcular.reduce((a, b) => a + b, 0);
            let mBase = soma / notasParaCalcular.length;
            
            // --- NOVA LÓGICA: RECUPERAÇÃO SUBSTITUI O BIMESTRE INTEIRO ---
            if (recVal !== "") {
                let notaRec = parseFloat(recVal);
                // Se a nota da recuperação for maior que a média calculada, ela vira a nova média
                if (notaRec > mBase) {
                    mBase = notaRec;
                }
            }

            const notaBimestreArredondada = arredondarEscola(mBase);
            tdMedia.textContent = notaBimestreArredondada.toString().replace(".", ",");
            tdMedia.style.color = notaBimestreArredondada < 6 ? "red" : "#32066d";
        } else if (recVal !== "") {
            // Caso só tenha a nota de recuperação preenchida
            const notaRecArredondada = arredondarEscola(parseFloat(recVal));
            tdMedia.textContent = notaRecArredondada.toString().replace(".", ",");
            tdMedia.style.color = notaRecArredondada < 6 ? "red" : "#32066d";
        } else {
            tdMedia.textContent = "-";
            tdMedia.style.color = "inherit";
        }
        
        atualizarMediaFinalNaTabela(tr);
    }
});

// ATUALIZA MÉDIA FINAL DO ANO (SOMA DOS BIMESTRES / 4)
async function atualizarMediaFinalNaTabela(tr) {
    const uid = tr.dataset.uid;
    const materia = materiaSelect.value;
    const bimAtual = selectBimestre.value;
    const notaAtualTxt = tr.querySelector(".td-media").textContent.replace(",", ".");

    const snap = await get(ref(db, `grades/${uid}/${materia}`));
    const notasBanco = snap.val() || {};

    let somaNotasBimestrais = 0;

    for(let b = 1; b <= 4; b++) {
        if(b == bimAtual) {
            if(notaAtualTxt !== "-") {
                somaNotasBimestrais += parseFloat(notaAtualTxt);
            }
        } else if(notasBanco[b] && notasBanco[b].media !== undefined) {
            somaNotasBimestrais += parseFloat(notasBanco[b].media);
        }
    }
    
    // MÉDIA ANUAL: Soma de todos os bimestres / 4
    const mediaAnualBruta = somaNotasBimestrais / 4;
    
    const mF = somaNotasBimestrais > 0 ? arredondarEscola(mediaAnualBruta) : "-";
    
    const tdFinal = tr.querySelector(".td-media-final");
    tdFinal.textContent = mF === "-" ? "-" : mF.toString().replace(".", ",");
    tdFinal.style.color = (mF !== "-" && mF < 6) ? "red" : "#32066d";
}

async function carregarNotasExistentes() {
    const materia = materiaSelect.value;
    const bimestre = selectBimestre.value;
    const linhas = corpoTabelaNotas.querySelectorAll("tr");
    
    for (let tr of linhas) {
        const uid = tr.dataset.uid;
        const snap = await get(ref(db, `grades/${uid}/${materia}/${bimestre}`));
        const g = snap.val();
        
        if (g) {
            tr.querySelector("[data-campo='p1']").value = g.p1 !== undefined ? g.p1 : "";
            tr.querySelector("[data-campo='p2']").value = g.p2 !== undefined ? g.p2 : "";
            tr.querySelector("[data-campo='trabalhos']").value = g.trabalhos !== undefined ? g.trabalhos : "";
            tr.querySelector("[data-campo='recuperacao']").value = g.recuperacao ?? "";
            tr.querySelector(".td-faltas").textContent = g.faltas ?? "0";
            tr.querySelector("[data-campo='p1']").dispatchEvent(new Event('input', { bubbles: true }));
        } else {
            tr.querySelectorAll("input").forEach(i => i.value = "");
            tr.querySelector(".td-media").textContent = "-";
            tr.querySelector(".td-faltas").textContent = "0";
            await atualizarMediaFinalNaTabela(tr);
        }
    }
}
// ==========================================
// 🗓️ 4. LÓGICA DE FALTAS (VERSÃO ATUALIZADA)
// ==========================================

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

// --- NOVO: FUNÇÃO PARA SALVAR AS FALTAS ---
async function salvarFaltas() {
    const materia = materiaSelect.value;
    const bimestre = selectBimestre.value;
    const serie = serieSelect.value;
    const dataFalta = dataFaltaInput.value; // Certifique-se que o id do input de data é 'dataFaltaInput'

    if (!materia || !serie || !bimestre || !dataFalta) {
        alert("Preencha Data, Matéria, Série e Bimestre antes de salvar.");
        return;
    }

    try {
        btnSalvarFaltas.disabled = true;
        btnSalvarFaltas.innerText = "Salvando...";

        // 1. Captura todos os checkboxes marcados
        const faltasPorAluno = {};
        const checkboxes = document.querySelectorAll('input[class^="chk-aula-"]:checked');

        checkboxes.forEach(chk => {
            const uid = chk.dataset.uid;
            if (!faltasPorAluno[uid]) faltasPorAluno[uid] = 0;
            faltasPorAluno[uid]++; // Soma 1 falta para cada aula marcada
        });

        const promessas = [];

        // 2. Registra no Firebase para cada aluno que teve falta
        for (let uid in faltasPorAluno) {
            const qtdFaltasNovas = faltasPorAluno[uid];
            const refP = `grades/${uid}/${materia}/${bimestre}`;

            const p = (async () => {
                const snapG = await get(ref(db, refP));
                const dados = snapG.exists() ? snapG.val() : { faltas: 0 };
                
                const faltasAtuais = parseInt(dados.faltas) || 0;

                // Atualiza o total de faltas e registra no histórico/pesos
                await update(ref(db, refP), { faltas: faltasAtuais + qtdFaltasNovas });
                await push(ref(db, `${refP}/historicoFaltas`), dataFalta);
                await update(ref(db, `${refP}/pesosFaltas`), { [dataFalta]: qtdFaltasNovas });
            })();
            promessas.push(p);
        }

        await Promise.all(promessas);
        
        // Limpa a seleção e atualiza a tela
        checkboxes.forEach(c => c.checked = false);
        await carregarHistoricoFaltas();
        if (typeof carregarTabelaNotas === "function") await carregarTabelaNotas();
        
        alert("Faltas salvas com sucesso!");

    } catch (e) {
        console.error(e);
        alert("Erro ao salvar.");
    } finally {
        btnSalvarFaltas.disabled = false;
        btnSalvarFaltas.innerText = "Salvar Faltas";
    }
}

// Vincular a função ao botão (caso não esteja no HTML)
if (typeof btnSalvarFaltas !== 'undefined') {
    btnSalvarFaltas.onclick = salvarFaltas;
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
        
        cont.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <h4 style="margin:0; color:#32066d;">🗓️ Histórico de Faltas</h4>
                <div style="display:flex; gap:10px;">
                    <button onclick="window.toggleHistoricoCompleto(this)" style="background:#32066d; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; font-size:12px; font-weight:bold;">
                        Ver Lista de Datas
                    </button>
                    <button onclick="window.limparTodoHistorico()" style="background:#000; color:white; border:none; padding:6px 10px; border-radius:4px; cursor:pointer; font-size:11px;">Apagar Tudo</button>
                </div>
            </div>`;

        if (listaDatas.length === 0) {
            cont.innerHTML += `<p style='color:#888;'>Nenhum registro no ${bimestre}º bimestre.</p>`;
            return;
        }

        const wrapperLista = document.createElement("div");
        wrapperLista.id = "wrapperHistoricoFaltas";
        wrapperLista.style.display = "none";
        wrapperLista.style.marginTop = "15px";

        const ul = document.createElement("ul");
        ul.style.cssText = "list-style:none;padding:0;";

        listaDatas.forEach(data => {
            const li = document.createElement("li");
            li.style.cssText = "background:#fff;border:1px solid #eee;border-left:5px solid #32066d;margin-bottom:8px;padding:10px;border-radius:5px;";
            const dataFormatada = data.split('-').reverse().join('/');
            
            li.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div style="flex:1;">
                        <span>Aula dia: <strong>${dataFormatada}</strong></span><br>
                        <small style="color:#666; display:block; margin-top:4px;">Faltaram: ${mapaDatas[data].join(", ")}</small>
                    </div>
                    <button onclick="window.excluirDiaFalta('${data}')" style="background:#ff4444; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer; font-size:12px;">Excluir</button>
                </div>`;
            ul.appendChild(li);
        });

        wrapperLista.appendChild(ul);
        cont.appendChild(wrapperLista);

    } catch (e) { 
        console.error(e);
        cont.innerHTML = "<p style='color:red;'>Erro ao carregar histórico.</p>"; 
    }
}

// --- FUNÇÕES GLOBAIS DE CONTROLE ---

window.toggleHistoricoCompleto = (btn) => {
    const wrapper = document.getElementById("wrapperHistoricoFaltas");
    if (!wrapper) return;

    if (wrapper.style.display === "none") {
        wrapper.style.display = "block";
        btn.innerText = "Ocultar Lista";
        btn.style.background = "#666";
    } else {
        wrapper.style.display = "none";
        btn.innerText = "Ver Lista de Datas";
        btn.style.background = "#32066d";
    }
};

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
    // 5. 📖 LÓGICA DE CONTEÚDOS
    async function carregarConteudos() {
    const materia = materiaSelect.value;
    const serie = serieSelect.value;
    listaConteudos.innerHTML = "";
    if (!materia || !serie) return;

    try {
        const snap = await get(ref(db, `conteudos/${auth.currentUser.uid}/${serie}/${materia}`));
        const dados = snap.val();
        if (!dados) { 
            listaConteudos.innerHTML = "<li>Nenhum conteúdo.</li>"; 
            return; 
        }

        // Converter objeto em array para conseguir ordenar
        const listaOrdenada = Object.keys(dados).map(k => ({
            id: k,
            ...dados[k]
        }));

        // Ordenar por data (da mais antiga para a mais recente)
        listaOrdenada.sort((a, b) => new Date(a.data) - new Date(b.data));

        listaOrdenada.forEach(c => {
            // Tratamento da data para o padrão BR e extração do mês
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
