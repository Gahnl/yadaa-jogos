// ===============================================
// lista-page.js — VERSÃO FINAL CORRIGIDA
// Compatível com as regras novas do Firebase
// ===============================================

import { auth, db } from "/js/firebase.js";

import { ref, get } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-database.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";

console.log("lista-page.js carregado ✔");

const tabelaContainer = document.getElementById("tabelaNotasFaltas");
const pdfContainer = document.getElementById("pdfContainer");
const btnExportarPDF = document.getElementById("btnExportarPDF");

// -------------------------------------------------------------
// VERIFICA LOGIN — INCLUINDO BYPASS DO ADMIN LOCAL
// -------------------------------------------------------------

onAuthStateChanged(auth, async (user) => {

  // Se o Firebase não autenticou, tentar admin local
  if (!user) {
    const lastEmail = localStorage.getItem("lastLoginEmail");
    
    if (lastEmail === "admin@saber.com") {
      console.warn("Admin Local detectado. Prosseguindo sem Firebase Auth…");

      const fakeAdmin = {
        uid: "admin-local",
        email: "admin@saber.com",
        role: "admin"
      };

      iniciarLista(fakeAdmin);
      return;
    }

    alert("Sessão expirada. Faça login novamente.");
    window.location.href = "index.html";
    return;
  }

  // Autenticado normalmente → buscar dados
  try {
    const snap = await get(ref(db, "users/" + user.uid));
    const dados = snap.val() || {};

    const usuario = {
      uid: user.uid,
      email: user.email,
      role: dados.role || "admin" // fallback para admin caso role não exista
    };

    iniciarLista(usuario);

  } catch (e) {
    console.error("Erro ao validar usuário:", e);
    alert("Erro ao verificar permissões.");
    window.location.href = "index.html";
  }
});


// -------------------------------------------------------------
// FUNÇÃO PRINCIPAL
// -------------------------------------------------------------

async function iniciarLista(usuario) {
  console.log("Usuário carregado:", usuario);

  if (usuario.role !== "admin") {
    alert("Apenas administradores podem acessar esta página.");
    window.location.href = "index.html";
    return;
  }

  const materia = localStorage.getItem("filtroMateria");
  const serie = localStorage.getItem("filtroSerie");
  const bimestre = localStorage.getItem("filtroBimestre");
  const alunoFiltro = localStorage.getItem("filtroAluno") || "";

  if (!materia || !serie || !bimestre) {
    tabelaContainer.innerHTML =
      "<p style='text-align:center;color:red;'>Filtros inválidos.</p>";
    return;
  }

  await carregarTabela(materia, serie, bimestre, alunoFiltro);
}


// -------------------------------------------------------------
// CARREGAR TABELA — 100% COMPATÍVEL COM AS REGRAS
// -------------------------------------------------------------

async function carregarTabela(materia, serie, bimestre, alunoFiltro) {
  tabelaContainer.innerHTML = "<p style='text-align:center;'>Carregando…</p>";

  try {
    // 🔥 Carrega usuários (admin pode ler /users inteiro)
    const snapUsers = await get(ref(db, "users"));
    const users = snapUsers.val() || {};

    // 🔥 Carrega TODAS as notas (admin tem permissão total)
    const snapGrades = await get(ref(db, "grades"));
    const allGrades = snapGrades.val() || {};

    let html = `
      <table border="1" cellpadding="6" cellspacing="0"
      style="width:100%;border-collapse:collapse;text-align:center;">
      <thead style="background:#32066d;color:#f8f008;">
        <tr>
          <th>Aluno</th><th>Série</th>
          <th>1ª Nota</th><th>1ª Falta</th>
          <th>2ª Nota</th><th>2ª Falta</th>
          <th>3ª Nota</th><th>3ª Falta</th>
          <th>4ª Nota</th><th>4ª Falta</th>
          <th>Total Faltas</th><th>Média Final</th>
        </tr>
      </thead><tbody>
    `;

    let encontrou = false;

    for (let uid in users) {
      const aluno = users[uid];
      if (aluno.role !== "student") continue;
      if (aluno.serie !== serie) continue;

      if (alunoFiltro && aluno.name.toLowerCase() !== alunoFiltro.toLowerCase())
        continue;

      const grades = allGrades?.[uid]?.[materia] || {};

      encontrou = true;

      let totalFaltas = 0;
      let somaNotas = 0;
      let qtdNotas = 0;

      html += `<tr>
                <td><strong>${aluno.name}</strong></td>
                <td>${aluno.serie}</td>`;

      for (let b = 1; b <= 4; b++) {
        const dado = grades[b] || {};
        const nota = dado.media ?? "-";
        const faltas = dado.faltas ?? "-";

        if (nota !== "-" && !isNaN(nota)) {
          somaNotas += Number(nota);
          qtdNotas++;
        }
        totalFaltas += Number(faltas) || 0;

        html += `<td>${nota}</td><td>${faltas}</td>`;
      }

      const mediaFinal = qtdNotas ? (somaNotas / qtdNotas).toFixed(1) : "-";

      html += `<td>${totalFaltas}</td>
               <td><strong>${mediaFinal}</strong></td>
              </tr>`;
    }

    html += "</tbody></table>";

    tabelaContainer.innerHTML = encontrou
      ? html
      : "<p style='text-align:center;'>Nenhum resultado com estes filtros.</p>";

    pdfContainer.style.display = encontrou ? "block" : "none";

  } catch (err) {
    console.error("Erro ao carregar tabela:", err);
    tabelaContainer.innerHTML =
      "<p style='color:red;text-align:center;'>Erro ao carregar lista.</p>";
  }
}


// -------------------------------------------------------------
// EXPORTAR PDF
// -------------------------------------------------------------

if (btnExportarPDF) {
  btnExportarPDF.addEventListener("click", () => {
    if (typeof html2pdf === "undefined") {
      alert("html2pdf não carregado!");
      return;
    }

    const elemento = tabelaContainer.cloneNode(true);
    const dataAtual = new Date().toLocaleDateString("pt-BR").replace(/\//g, "-");

    html2pdf()
      .set({
        margin: 10,
        filename: `Planilha_${dataAtual}.pdf`,
        html2canvas: { scale: 2 },
        jsPDF: { orientation: "landscape", unit: "mm", format: "a4" }
      })
      .from(elemento)
      .save();
  });
}
