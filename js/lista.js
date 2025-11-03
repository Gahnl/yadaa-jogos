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
    const snapUser = await get(ref(db, "users/" + user.uid));
    const u = snapUser.val();

    if (!u || u.role !== "teacher") {
      alert("Acesso negado!");
      window.location.href = "index.html";
      return;
    }

    console.log("Professor logado:", u.name, "-", u.materia);
    await carregarLista(u.materia);
  } catch (err) {
    console.error("Erro ao obter usuário:", err);
    tabelaContainer.innerHTML = "<p style='color:red;'>Erro ao carregar informações do professor.</p>";
  }
});

async function carregarLista(materia) {
  tabelaContainer.innerHTML = "<p style='text-align:center;'>Carregando planilha...</p>";
  pdfContainer.style.display = "none";

  try {
    const snapUsers = await get(ref(db, "users"));
    const users = snapUsers.val();

    const tabela = document.createElement("table");
    tabela.border = "1";
    tabela.style.width = "100%";
    tabela.style.borderCollapse = "collapse";
    tabela.style.fontSize = "14px";

    tabela.innerHTML = `
      <thead>
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
        </tr>
      </thead>
      <tbody></tbody>
    `;

    const tbody = tabela.querySelector("tbody");

    let encontrouAlgum = false;

    for (let uid in users) {
      const aluno = users[uid];
      if (aluno.role === "student") {
        const snapGrades = await get(ref(db, `grades/${uid}/${materia}`));
        const grades = snapGrades.val();

        if (!grades) continue; // se o aluno não tem essa matéria, pula

        encontrouAlgum = true;
        const tr = document.createElement("tr");

        const tdNome = document.createElement("td");
        tdNome.textContent = aluno.name || "-";
        tr.appendChild(tdNome);

        const tdSerie = document.createElement("td");
        tdSerie.textContent = aluno.serie || "-";
        tr.appendChild(tdSerie);

        let totalFaltas = 0;

        for (let b = 1; b <= 4; b++) {
          // Verifica se é array ou objeto
          const dadosBim = Array.isArray(grades) ? grades[b] : grades?.[b];

          const tdNota = document.createElement("td");
          tdNota.textContent = dadosBim?.nota ?? "-";
          tr.appendChild(tdNota);

          const tdFalta = document.createElement("td");
          tdFalta.textContent = dadosBim?.faltas ?? "-";
          tr.appendChild(tdFalta);

          totalFaltas += Number(dadosBim?.faltas || 0);
        }

        const tdTotal = document.createElement("td");
        tdTotal.textContent = totalFaltas;
        tr.appendChild(tdTotal);

        tbody.appendChild(tr);
      }
    }

    if (!encontrouAlgum) {
      tabelaContainer.innerHTML = "<p style='text-align:center; color:#888;'>Nenhum dado encontrado para esta matéria.</p>";
      return;
    }

    tabelaContainer.innerHTML = "";
    tabelaContainer.appendChild(tabela);
    pdfContainer.style.display = "block";
  } catch (err) {
    console.error("Erro ao carregar lista:", err);
    tabelaContainer.innerHTML = "<p style='color:red;'>Erro ao carregar lista.</p>";
  }
}

// --------- EXPORTAR PDF ---------
btnExportarPDF.addEventListener("click", async () => {
  const snapUser = await get(ref(db, "users/" + auth.currentUser.uid));
  const u = snapUser.val();
  const materia = u.materia || "Matéria";
  const dataAtual = new Date().toLocaleDateString("pt-BR");

  const conteudoPDF = document.createElement("div");
  conteudoPDF.innerHTML = `
    <h2 style="text-align:center;">Colégio Saber - Igaraçu do Tietê</h2>
    <h3 style="text-align:center;">Planilha de Notas e Faltas</h3>
    <p><strong>Matéria:</strong> ${materia}</p>
    <p><strong>Data:</strong> ${dataAtual}</p>
    <br>
    ${tabelaContainer.innerHTML}
  `;

  const options = {
    margin: 10,
    filename: `Planilha_${materia}_${dataAtual.replace(/\//g, "-")}.pdf`,
    html2canvas: { scale: 2 },
    jsPDF: { orientation: "landscape", unit: "mm", format: "a4" }
  };

  html2pdf().set(options).from(conteudoPDF).save();
});
