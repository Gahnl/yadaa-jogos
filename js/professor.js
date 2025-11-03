import { auth, db } from "./firebase.js";
import { ref, get, set, push } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-database.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";

// ELEMENTOS
const serieSelect = document.getElementById("serieSelect");
const materiaInput = document.getElementById("materia");
const corpoTabelaNotas = document.getElementById("corpoTabelaNotas");
const btnSalvarNotas = document.getElementById("btnSalvarNotas");

const serieFaltasSelect = document.getElementById("serieFaltasSelect");
const listaAlunosFaltas = document.getElementById("listaAlunosFaltas");
const dataFaltaInput = document.getElementById("dataFalta");
const btnSalvarFaltas = document.getElementById("btnSalvarFaltas");

const conteudoInput = document.getElementById("conteudo");
const dataAulaInput = document.getElementById("dataAula");
const btnSalvarConteudo = document.getElementById("btnSalvarConteudo");
const listaConteudos = document.getElementById("listaConteudos");

// 🔹 Campo de seleção de bimestre
let selectBimestre = document.createElement("select");
selectBimestre.id = "selectBimestre";
selectBimestre.innerHTML = `
  <option value="">Selecione o bimestre</option>
  <option value="1">1º Bimestre</option>
  <option value="2">2º Bimestre</option>
  <option value="3">3º Bimestre</option>
  <option value="4">4º Bimestre</option>
`;
selectBimestre.style.marginTop = "10px";
selectBimestre.style.display = "block";
dataFaltaInput.insertAdjacentElement("afterend", selectBimestre);

// AUTENTICAÇÃO
auth.onAuthStateChanged(async (user) => {
  if (!user) { window.location.href = "index.html"; return; }

  const snapUser = await get(ref(db, 'users/' + user.uid));
  const u = snapUser.val();
  if (!u || u.role !== "teacher") { alert("Acesso negado"); window.location.href = "index.html"; return; }

  materiaInput.value = u.materia;
  carregarConteudos();
});

// --------- LANÇAMENTO DE NOTAS + FALTAS POR BIMESTRE ---------
serieSelect.addEventListener("change", async () => {
  const serie = serieSelect.value;
  if (!serie) return;

  const snapshot = await get(ref(db, 'users'));
  const data = snapshot.val();
  corpoTabelaNotas.innerHTML = "";

  for (let uid in data) {
    const u = data[uid];
    if (u.role === "student" && u.serie === serie) {
      const tr = document.createElement("tr");
      tr.dataset.uid = uid;

      const tdNome = document.createElement("td");
      tdNome.textContent = u.name;
      tr.appendChild(tdNome);

      // Campos de nota + faltas para cada bimestre
      for (let b = 1; b <= 4; b++) {
        // Nota
        const tdNota = document.createElement("td");
        const inputNota = document.createElement("input");
        inputNota.type = "number";
        inputNota.min = 0;
        inputNota.max = 10;
        inputNota.step = 0.1;
        inputNota.style.width = "60px";
        inputNota.dataset.bim = b;
        inputNota.classList.add("input-nota");
        tdNota.appendChild(inputNota);
        tr.appendChild(tdNota);

        // Faltas (somente exibição)
        const tdFalta = document.createElement("td");
        const inputFalta = document.createElement("input");
        inputFalta.type = "number";
        inputFalta.min = 0;
        inputFalta.style.width = "50px";
        inputFalta.dataset.bim = b;
        inputFalta.classList.add("input-falta");
        inputFalta.disabled = true;
        tdFalta.appendChild(inputFalta);
        tr.appendChild(tdFalta);
      }

      // Total de faltas
      const tdTotalFaltas = document.createElement("td");
      tdTotalFaltas.classList.add("totalFaltas");
      tdTotalFaltas.textContent = "0";
      tr.appendChild(tdTotalFaltas);

      corpoTabelaNotas.appendChild(tr);
    }
  }

  carregarNotasExistentes();
});

async function carregarNotasExistentes() {
  const alunos = corpoTabelaNotas.querySelectorAll("tr");
  const materia = materiaInput.value;

  for (let tr of alunos) {
    const uid = tr.dataset.uid;
    const gradesSnap = await get(ref(db, `grades/${uid}/${materia}`));
    const grades = gradesSnap.val();

    let totalFaltas = 0;

    if (grades) {
      for (let b = 1; b <= 4; b++) {
        const inputNota = tr.querySelector(`input.input-nota[data-bim='${b}']`);
        const inputFalta = tr.querySelector(`input.input-falta[data-bim='${b}']`);

        if (grades[b]) {
          inputNota.value = grades[b].nota ?? "";
          inputFalta.value = grades[b].faltas ?? "";
          totalFaltas += Number(grades[b].faltas || 0);
        }
      }
    }

    tr.querySelector(".totalFaltas").textContent = totalFaltas;
  }
}

btnSalvarNotas.addEventListener("click", async () => {
  const user = auth.currentUser;
  const materia = materiaInput.value;
  const alunos = corpoTabelaNotas.querySelectorAll("tr");

  try {
    for (let tr of alunos) {
      const uid = tr.dataset.uid;
      const grades = {};

      for (let b = 1; b <= 4; b++) {
        const nota = Number(tr.querySelector(`input.input-nota[data-bim='${b}']`).value) || 0;
        const faltas = Number(tr.querySelector(`input.input-falta[data-bim='${b}']`).value) || 0;

        grades[b] = { nota, faltas, professor: user.email };
      }

      await set(ref(db, `grades/${uid}/${materia}`), grades);
    }

    carregarNotasExistentes();
    alert("Notas salvas com sucesso!");
  } catch (err) {
    alert("Erro ao salvar: " + err.message);
  }
});

// --------- LANÇAMENTO DE FALTAS COM CHECKLIST ---------
serieFaltasSelect.addEventListener("change", async () => {
  const serie = serieFaltasSelect.value;
  listaAlunosFaltas.innerHTML = "";
  if (!serie) return;

  const snapshot = await get(ref(db, 'users'));
  const data = snapshot.val();

  for (let uid in data) {
    const u = data[uid];
    if (u.role === "student" && u.serie === serie) {
      const div = document.createElement("div");
      div.style.marginBottom = "5px";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = uid;
      checkbox.id = "falta_" + uid;

      const label = document.createElement("label");
      label.htmlFor = "falta_" + uid;
      label.textContent = u.name;

      div.appendChild(checkbox);
      div.appendChild(label);
      listaAlunosFaltas.appendChild(div);
    }
  }
});

btnSalvarFaltas.addEventListener("click", async () => {
  const user = auth.currentUser;
  const materia = materiaInput.value;
  const dataFalta = dataFaltaInput.value;
  const bimestre = selectBimestre.value;

  if (!serieFaltasSelect.value || !dataFalta || !bimestre) {
    alert("Selecione a série, a data e o bimestre!");
    return;
  }

  const checkboxes = listaAlunosFaltas.querySelectorAll("input[type='checkbox']");
  const alunosFaltantes = [];
  checkboxes.forEach(cb => { if (cb.checked) alunosFaltantes.push(cb.value); });

  if (alunosFaltantes.length === 0) {
    alert("Nenhum aluno selecionado!");
    return;
  }

  try {
    for (let uid of alunosFaltantes) {
      // 1️⃣ Registro no histórico
      const novoRef = push(ref(db, `faltas/${uid}/${materia}`));
      await set(novoRef, {
        data: dataFalta,
        professor: user.email,
        faltas: 1,
        bimestre: Number(bimestre)
      });

      // 2️⃣ Atualiza faltas no grades (para aparecer na tabela)
      const gradeRef = ref(db, `grades/${uid}/${materia}/${bimestre}`);
      const snap = await get(gradeRef);
      const atual = snap.val();

      const faltasAtuais = atual && atual.faltas ? atual.faltas : 0;
      const notaAtual = atual && atual.nota ? atual.nota : 0;

      await set(gradeRef, {
        nota: notaAtual,
        faltas: faltasAtuais + 1,
        professor: user.email
      });
    }

    dataFaltaInput.value = "";
    selectBimestre.value = "";
    checkboxes.forEach(cb => cb.checked = false);
    await carregarNotasExistentes();

    alert(`Faltas lançadas e atualizadas no ${bimestre}º bimestre!`);
  } catch (err) {
    alert("Erro ao lançar faltas: " + err.message);
  }
});

// --------- CONTEÚDOS ---------
btnSalvarConteudo.addEventListener("click", async () => {
  const user = auth.currentUser;
  const materia = materiaInput.value;
  const conteudo = conteudoInput.value.trim();
  const dataAula = dataAulaInput.value;

  if (!conteudo || !dataAula) { alert("Preencha o conteúdo e a data!"); return; }

  try {
    const novoRef = push(ref(db, `conteudos/${user.uid}/${materia}`));
    await set(novoRef, { conteudo, data: dataAula });
    conteudoInput.value = "";
    dataAulaInput.value = "";
    carregarConteudos();
    alert("Conteúdo salvo com sucesso!");
  } catch (err) {
    alert("Erro ao salvar conteúdo: " + err.message);
  }
});

async function carregarConteudos() {
  const user = auth.currentUser;
  const materia = materiaInput.value;
  const snap = await get(ref(db, `conteudos/${user.uid}/${materia}`));
  const dados = snap.val();

  listaConteudos.innerHTML = "";
  if (!dados) {
    listaConteudos.innerHTML = "<li>Nenhum conteúdo lançado ainda.</li>";
    return;
  }

  for (let key in dados) {
    const li = document.createElement("li");
    li.textContent = `${dados[key].data} - ${dados[key].conteudo}`;
    listaConteudos.appendChild(li);
  }
}

// --------- LOGOUT ---------
document.querySelector("a[href='index.html']").addEventListener("click", async () => {
  await signOut(auth);
});
