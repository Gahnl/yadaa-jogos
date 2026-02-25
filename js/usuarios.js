import { auth, db } from "/js/firebase.js";
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
          <td>${
            u.role === "admin"
              ? "Administrador"
              : u.role === "teacher"
              ? "Professor"
              : "Aluno"
          }</td>
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
    // 1️⃣ Revalida token do admin
    await auth.currentUser.getIdToken(true);

    // 2️⃣ Remove usuário do nó "users"
    await remove(ref(db, "users/" + uid));
    console.log("Usuário removido do users");

    // 3️⃣ Remove notas do aluno, se existirem
    const gradesSnap = await get(ref(db, "grades/" + uid));
    if (gradesSnap.exists()) {
      await remove(ref(db, "grades/" + uid));
      console.log("Notas removidas");
    }

    // 4️⃣ Remove faltas do aluno, se existirem
    const faltasSnap = await get(ref(db, "faltas/" + uid));
    if (faltasSnap.exists()) {
      await remove(ref(db, "faltas/" + uid));
      console.log("Faltas removidas");
    }

    alert("Usuário e todos os dados relacionados removidos com sucesso!");
    
    // 5️⃣ Atualiza lista
    carregarUsuarios();
  } catch (err) {
    console.error(err);
    alert("Erro ao excluir: " + err.message);
  }
};
