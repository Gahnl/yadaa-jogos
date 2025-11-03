// js/admin.js
import { auth, db } from "./firebase.js";
import { ref, set } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-database.js";
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";

// --------- CADASTRAR PROFESSOR ---------
document.getElementById("btnCreateProf").addEventListener("click", async () => {
  const name = document.getElementById("profName").value.trim();
  const email = document.getElementById("profEmail").value.trim();
  const senha = document.getElementById("profSenha").value.trim();
  const materia = document.getElementById("profMateria").value;

  if (!name || !email || !senha || !materia) {
    alert("Preencha todos os campos do professor!");
    return;
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
    const userId = userCredential.user.uid;

    await set(ref(db, "users/" + userId), {
      name,
      email,
      role: "teacher",
      materia,
    });

    alert("Professor cadastrado com sucesso!");
    document.getElementById("profName").value = "";
    document.getElementById("profEmail").value = "";
    document.getElementById("profSenha").value = "";
    document.getElementById("profMateria").value = "";
  } catch (err) {
    alert("Erro ao cadastrar professor: " + err.message);
  }
});

// --------- CADASTRAR ALUNO ---------
document.getElementById("btnCreateAluno").addEventListener("click", async () => {
  const name = document.getElementById("alunoName").value.trim();
  const email = document.getElementById("alunoEmail").value.trim();
  const senha = document.getElementById("alunoSenha").value.trim();
  const serie = document.getElementById("alunoSerie").value;

  if (!name || !email || !senha || !serie) {
    alert("Preencha todos os campos do aluno!");
    return;
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
    const userId = userCredential.user.uid;

    await set(ref(db, "users/" + userId), {
      name,
      email,
      role: "student",
      serie,
    });

    alert("Aluno cadastrado com sucesso!");
    document.getElementById("alunoName").value = "";
    document.getElementById("alunoEmail").value = "";
    document.getElementById("alunoSenha").value = "";
    document.getElementById("alunoSerie").value = "";
  } catch (err) {
    alert("Erro ao cadastrar aluno: " + err.message);
  }
});

// --------- GERAR LISTA FILTRADA ---------
const btnCriarLista = document.getElementById("btnGerarLista"); // 🔹 Corrigido o ID aqui

if (btnCriarLista) {
  btnCriarLista.addEventListener("click", () => {
    const materia = document.getElementById("filtroMateria").value;
    const serie = document.getElementById("filtroSerie").value;
    const bimestre = document.getElementById("filtroBimestre").value;
    const aluno = document.getElementById("filtroAluno").value.trim();

    if (!materia || !serie || !bimestre) {
      alert("Selecione a matéria, série e bimestre!");
      return;
    }

    // Salva filtros no localStorage
    localStorage.setItem("filtroMateria", materia);
    localStorage.setItem("filtroSerie", serie);
    localStorage.setItem("filtroBimestre", bimestre);

    if (aluno) {
      localStorage.setItem("filtroAluno", aluno);
    } else {
      localStorage.removeItem("filtroAluno");
    }

    // Redireciona após breve espera (garante salvamento)
    setTimeout(() => {
      window.location.href = "lista.html";
    }, 300);
  });
} else {
  console.warn("⚠ Botão 'Criar Lista' não encontrado. Verifique o ID no HTML.");
}
// --------- CARREGAR LISTA DE ALUNOS PARA SUGESTÃO ---------
import { get } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-database.js";

async function carregarListaDeAlunos() {
  try {
    const snap = await get(ref(db, "users"));
    const dados = snap.val();
    const datalist = document.getElementById("listaAlunos");

    if (!dados || !datalist) return;

    datalist.innerHTML = ""; // limpa lista

    for (let uid in dados) {
      const user = dados[uid];
      if (user.role === "student" && user.name) {
        const option = document.createElement("option");
        option.value = user.name;
        datalist.appendChild(option);
      }
    }

    console.log("✅ Sugestões de alunos carregadas.");
  } catch (err) {
    console.error("❌ Erro ao carregar alunos:", err);
  }
}

// Carregar automaticamente ao abrir o painel
carregarListaDeAlunos();
