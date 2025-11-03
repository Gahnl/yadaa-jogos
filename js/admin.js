import { auth, db } from "./firebase.js";
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import { ref, set } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-database.js";

document.addEventListener("DOMContentLoaded", () => {
  // Campos de professor
  const profName = document.getElementById("profName");
  const profEmail = document.getElementById("profEmail");
  const profSenha = document.getElementById("profSenha");
  const profMateria = document.getElementById("profMateria");
  const btnCreateProf = document.getElementById("btnCreateProf");

  // Campos de aluno
  const alunoName = document.getElementById("alunoName");
  const alunoEmail = document.getElementById("alunoEmail");
  const alunoSenha = document.getElementById("alunoSenha");
  const alunoSerie = document.getElementById("alunoSerie");
  const btnCreateAluno = document.getElementById("btnCreateAluno");

  // =============================
  // 🔹 CADASTRAR PROFESSOR
  // =============================
  btnCreateProf.addEventListener("click", async () => {
    if (!profName.value || !profEmail.value || !profSenha.value || !profMateria.value) {
      alert("Preencha todos os campos do professor!");
      return;
    }

    try {
      const cred = await createUserWithEmailAndPassword(auth, profEmail.value, profSenha.value);
      await set(ref(db, 'users/' + cred.user.uid), {
        name: profName.value,
        email: profEmail.value,
        role: "teacher",
        materia: profMateria.value
      });
      alert("Professor cadastrado com sucesso!");
      profName.value = "";
      profEmail.value = "";
      profSenha.value = "";
      profMateria.value = "";
    } catch (err) {
      alert("Erro: " + err.message);
    }
  });

  // =============================
  // 🔹 CADASTRAR ALUNO
  // =============================
  btnCreateAluno.addEventListener("click", async () => {
    if (!alunoName.value || !alunoEmail.value || !alunoSenha.value || !alunoSerie.value) {
      alert("Preencha todos os campos do aluno!");
      return;
    }

    try {
      const cred = await createUserWithEmailAndPassword(auth, alunoEmail.value, alunoSenha.value);
      await set(ref(db, 'users/' + cred.user.uid), {
        name: alunoName.value,
        email: alunoEmail.value,
        role: "student",
        serie: alunoSerie.value
      });
      alert("Aluno cadastrado com sucesso!");
      alunoName.value = "";
      alunoEmail.value = "";
      alunoSenha.value = "";
      alunoSerie.value = "";
    } catch (err) {
      alert("Erro: " + err.message);
    }
  });

  // =============================
  // 🔹 ACESSAR LISTA DE USUÁRIOS
  // =============================
  const btnVerUsuarios = document.getElementById("btnVerUsuarios");
  if (btnVerUsuarios) {
    btnVerUsuarios.addEventListener("click", () => {
      window.location.href = "usuarios.html";
    });
  }
});
