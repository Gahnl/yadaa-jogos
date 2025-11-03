// js/lista.js
import { auth, db } from "./firebase.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-database.js";

const tabelaContainer = document.getElementById("tabelaNotasFaltas");
const btnExportarPDF = document.getElementById("btnExportarPDF");
const pdfContainer = document.getElementById("pdfContainer");

auth.onAuthStateChanged(async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  try {
    // Busca o usuário no banco
    const snapUser = await get(ref(db, "users/" + user.uid));
    let u = snapUser.val();

    // Se não encontrar, trata como admin
    if (!u) {
      const email = user.email?.toLowerCase() || "";
      if (email.includes("admin") || email === "admin@colegiosaber.com") {
        u = { name: "Administrador", role: "admin" };
      } else {
        alert("Usuário não encontrado!");
        window.location.href = "index.html";
        return;
      }
    }

    if (u.role !== "teacher" && u.role !== "admin") {
      alert("Acesso negado!");
      window.location.href = "index.html";
      return;
    }

    // Coleta filtros
    const materia = localStorage.getItem("filtroMateria") || u.materia || "";
    const serie = localStorage.getItem("filtroSerie") || "";
    const bimestre = localStorage.getItem("filtroBimestre") || "";
    const alunoFiltro = localStorage.getItem("filtroAluno") || "";

    console.log("📘 Filtros recebidos:");
    console.log({ materia, serie, bimestre, alunoFiltro });

    if (!materia) {
      tabelaContainer.innerHTML = `<p style="color:red; text-align:center;">Matéria não informada!</p>`;
      return;
    }

    await carregarLista(materia, serie, bimestre, alunoFiltro);

  } catch (err) {
    console.error("Erro geral:", err);
    tabelaContainer.innerHTML = "<p style='color:red;'>Erro ao carregar informações.</p>";
  }
});

async function carregarLista(materia, serie = null, bimestre = null, alunoFiltro = null) {
  tabelaContainer.innerHTML = "<p style='text-align:center;'>Carregando dados...</p>";
  pdfContainer.style.display = "none";

  try {
    const snapUsers = await get(ref(db, "users"));
    const users = snapUsers.val();

    if (!users) {
      tabelaContainer.innerHTML = "<p style='color:#888;'>Nenhum usuário encontrado no banco.</p>";
      return;
    }

    let encontrou = false;

    // Cabeçalho informativo
    let header = `
      <div style="text-align:center; margin-bottom:20px;">
        <h2 style="color:#32066d;">Colégio Saber - Igaraçu do Tietê</h2>
        <h3>Planilha de Notas e Faltas</h3>
        <p><strong>Matéria:</strong> ${materia}</p>
        ${serie ? `<p><strong>Série:</strong> ${serie}</p>` : ""}
        ${bimestre ? `<p><strong>Bimestre:</strong> ${bimestre}º</p>` : ""}
        ${alunoFiltro ? `<p><strong>Aluno:</strong> ${alunoFiltro}</p>` : ""}
      </div>
    `;

    let html = `
      ${header}
      <table border="1" cellspacing="0" cellpadding="8" 
        style="width:100%; border-collapse:collapse; text-align:center;">
        <thead style="background-color:#32066d; color:#f8f008;">
          <tr>
            <th>Aluno</th>
            <th>Série</th>
            <th>1º Bim (Nota)</th>
            <th>1º Bim (Faltas)</th>
            <th>2º Bim (Nota)</th>
            <th>2º Bim (Faltas)</th>
            <th>3º Bim (Nota)</th>
            <th>3º Bim (Faltas)</th>
            <th>4º Bim (Nota)</th>
            <th>4º Bim (Faltas)</th>
            <th>Total Faltas</th>
            <th>Média Final</th>
          </tr>
        </thead>
        <tbody>
    `;

    let contadorAlunos = 0;

    for (let uid in users) {
      const aluno = users[uid];
      if (aluno.role !== "student") continue;

      // Filtros de série e aluno
      if (serie && aluno.serie !== serie) continue;
      if (alunoFiltro && aluno.name.toLowerCase() !== alunoFiltro.toLowerCase()) continue;

      const snapGrades = await get(ref(db, `grades/${uid}/${materia}`));
      const grades = snapGrades.val();

      if (!grades) continue;

      encontrou = true;
      contadorAlunos++;

      let totalFaltas = 0;
      let somaNotas = 0;
      let countNotas = 0;

      html += `<tr><td><strong>${aluno.name || "-"}</strong></td><td>${aluno.serie || "-"}</td>`;

      for (let b = 1; b <= 4; b++) {
        // se tiver filtro de bimestre, mostra só aquele
        if (bimestre && Number(bimestre) !== b) continue;

        const dadosBim = grades[b] || {};
        const nota = dadosBim.nota ?? "-";
        const faltas = dadosBim.faltas ?? "-";

        html += `<td>${nota}</td><td>${faltas}</td>`;

        if (!isNaN(nota)) {
          somaNotas += Number(nota);
          countNotas++;
        }

        totalFaltas += Number(faltas || 0);
      }

      const mediaFinal = countNotas > 0 ? (somaNotas / countNotas).toFixed(1) : "-";
      html += `<td>${totalFaltas}</td><td><strong>${mediaFinal}</strong></td></tr>`;
    }

    html += `
      </tbody></table>
      <p style="margin-top:10px; text-align:right; font-weight:bold;">
        Total de alunos: ${contadorAlunos}
      </p>
    `;

    if (!encontrou) {
      tabelaContainer.innerHTML = `<p style="text-align:center; color:#888;">Nenhum dado encontrado para "${materia}"</p>`;
      console.warn("⚠ Nenhum dado encontrado com os filtros:", { materia, serie, bimestre, alunoFiltro });
      return;
    }

    tabelaContainer.innerHTML = html;
    pdfContainer.style.display = "block";
    console.log("✅ Lista carregada com sucesso!");

  } catch (err) {
    console.error("❌ Erro ao carregar lista:", err);
    tabelaContainer.innerHTML = "<p style='color:red;'>Erro ao carregar lista.</p>";
  }
}

// --------- EXPORTAR PDF ---------
btnExportarPDF.addEventListener("click", () => {
  const dataAtual = new Date().toLocaleDateString("pt-BR");
  const conteudoPDF = document.createElement("div");
  conteudoPDF.innerHTML = `
    <h2 style="text-align:center;">Colégio Saber - Igaraçu do Tietê</h2>
    <h3 style="text-align:center;">Planilha de Notas e Faltas</h3>
    <p style="text-align:center;"><strong>Data:</strong> ${dataAtual}</p>
    <br>
    ${tabelaContainer.innerHTML}
  `;

  const options = {
    margin: 10,
    filename: `Planilha_${dataAtual.replace(/\//g, "-")}.pdf`,
    html2canvas: { scale: 2 },
    jsPDF: { orientation: "landscape", unit: "mm", format: "a4" }
  };

  html2pdf().set(options).from(conteudoPDF).save();
});
