import { auth, db } from "./firebase.js";
import { ref, get, remove } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-database.js";

const listaUsuarios = document.getElementById("listaUsuarios");
const voltarAdmin = document.getElementById("voltarAdmin");

// Carregar usuários ao abrir
document.addEventListener("DOMContentLoaded", carregarUsuarios);

// Voltar ao painel admin
voltarAdmin.addEventListener("click", () => {
  window.location.href = "admin.html";
});

async function carregarUsuarios() {
  try {
    const snap = await get(ref(db, "users"));
    const users = snap.val();

    if (!users) {
      listaUsuarios.innerHTML = "<p style='text-align:center;'>Nenhum usuário cadastrado.</p>";
      return;
    }

    let html = `
      <table border="1" style="width:100%; border-collapse:collapse;">
        <thead>
          <tr style="background-color:#eee;">
            <th>Nome</th>
            <th>E-mail</th>
            <th>Função</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
    `;

    for (let uid in users) {
      const u = users[uid];
      html += `
        <tr>
          <td>${u.name || "-"}</td>
          <td>${u.email || "-"}</td>
          <td>${u.role === "teacher" ? "Professor" : "Aluno"}</td>
          <td style="text-align:center;">
            <button class="btn-excluir" onclick="excluirUsuario('${uid}')">Excluir</button>
          </td>
        </tr>
      `;
    }

    html += "</tbody></table>";
    listaUsuarios.innerHTML = html;
  } catch (err) {
    listaUsuarios.innerHTML = "<p style='color:red;'>Erro ao carregar usuários.</p>";
    console.error(err);
  }
}

// Tornar função global
window.excluirUsuario = async (uid) => {
  const confirmar = confirm("Tem certeza que deseja excluir este usuário permanentemente?");
  if (!confirmar) return;

  try {
    await remove(ref(db, "users/" + uid));
    await remove(ref(db, "grades/" + uid));
    alert("Usuário removido com sucesso!");
    carregarUsuarios(); // Atualiza lista
  } catch (err) {
    alert("Erro ao excluir: " + err.message);
  }
};
