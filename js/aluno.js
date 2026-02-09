import { auth, db } from "/js/firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-database.js";

const tabelaNotas = document.querySelector("#tabelaNotas tbody");

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  try {
    const snap = await get(ref(db, `grades/${user.uid}`));
    const grades = snap.val();

    if (!grades) {
      tabelaNotas.innerHTML = `<tr><td colspan="6">Nenhuma nota lançada.</td></tr>`;
      return;
    }

    renderTabela(grades);

  } catch (e) {
    console.error(e);
    tabelaNotas.innerHTML = `<tr><td colspan="6">Erro ao carregar notas.</td></tr>`;
  }
});

function renderTabela(grades) {
  tabelaNotas.innerHTML = "";

  for (const materia in grades) {
    const dadosMateria = grades[materia];

    const bimestres = {
      1: dadosMateria["1"] || null,
      2: dadosMateria["2"] || null,
      3: dadosMateria["3"] || null,
      4: dadosMateria["4"] || null
    };

    let soma = 0;
    let qtd = 0;

    Object.values(bimestres).forEach(b => {
      if (b?.media) {
        soma += Number(b.media);
        qtd++;
      }
    });

    const mediaFinal = qtd ? (soma / qtd).toFixed(1) : "-";

    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td><strong>${materia}</strong></td>
      ${[1,2,3,4].map(n => `
        <td>
          ${bimestres[n]?.media ?? "-"} <br>
          <small>Faltas: ${bimestres[n]?.faltas ?? "-"}</small>
        </td>
      `).join("")}
      <td><strong>${mediaFinal}</strong></td>
    `;

    tabelaNotas.appendChild(tr);
  }
}

document.getElementById("sairBtn").addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "index.html";
});
