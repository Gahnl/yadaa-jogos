import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-database.js";

const tabelaNotas = document.querySelector("#tabelaNotas tbody");

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  const snap = await get(ref(db, "users/" + user.uid));
  const u = snap.val();

  if (!u || u.role !== "student") {
    alert("Acesso negado");
    window.location.href = "index.html";
    return;
  }

  const gradesSnap = await get(ref(db, "grades/" + user.uid));
  const grades = gradesSnap.val();

  tabelaNotas.innerHTML = "";

  if (!grades) {
    tabelaNotas.innerHTML = `<tr><td colspan="6">Nenhuma nota lançada ainda.</td></tr>`;
    return;
  }

  for (const materia in grades) {
    const materiaData = grades[materia];

    let notas = ["-", "-", "-", "-"];
    let faltas = ["-", "-", "-", "-"];
    let somaNotas = 0;
    let countNotas = 0;

    if (Array.isArray(materiaData)) {
      for (let i = 1; i <= 4; i++) {
        const bimData = materiaData[i];
        if (bimData) {
          if (bimData.nota != null) {
            notas[i - 1] = bimData.nota;
            somaNotas += bimData.nota;
            countNotas++;
          }
          if (bimData.faltas != null) {
            faltas[i - 1] = bimData.faltas;
          }
        }
      }
    }

    const mediaFinal = countNotas > 0 ? (somaNotas / countNotas).toFixed(1) : "-";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${materia}</td>
      ${gerarCelula(0, notas, faltas)}
      ${gerarCelula(1, notas, faltas)}
      ${gerarCelula(2, notas, faltas)}
      ${gerarCelula(3, notas, faltas)}
      <td><strong>${mediaFinal}</strong></td>
    `;
    tabelaNotas.appendChild(tr);
  }
});

// Função para colorir dinamicamente
function gerarCelula(i, notas, faltas) {
  const nota = notas[i];
  const falta = faltas[i];

  // cores das notas
  let notaCor = "gray";
  if (nota !== "-") {
    if (nota >= 6) notaCor = "green";
    else notaCor = "red";
  }

  // cores das faltas
  let faltaCor = "gray";
  if (falta !== "-") {
    if (falta == 0) faltaCor = "green";
    else if (falta < 5) faltaCor = "orange";
    else faltaCor = "red";
  }

  return `
    <td>
      <span style="color:${notaCor}; font-weight:600;">${nota}</span> /
      <span style="color:${faltaCor}; font-weight:600;">${falta}</span>
    </td>
  `;
}

// Botão sair
document.getElementById("sairBtn").addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "index.html";
});
