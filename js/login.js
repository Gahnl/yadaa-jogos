import { auth, db } from "/js/firebase.js";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-database.js";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");
  const inputSenha = document.getElementById("senha");
  const togglePassword = document.getElementById("togglePassword");
  const eyeOpen = document.getElementById("eyeOpen");
  const eyeClosed = document.getElementById("eyeClosed");
  const btnEsqueciSenha = document.getElementById("btnEsqueciSenha");

  // 🔹 Lógica do Ícone do Olho
  if (togglePassword) {
    togglePassword.addEventListener("click", () => {
      const isPassword = inputSenha.type === "password";
      inputSenha.type = isPassword ? "text" : "password";

      // Alterna a visibilidade dos ícones
      eyeOpen.style.display = isPassword ? "none" : "block";
      eyeClosed.style.display = isPassword ? "block" : "none";
    });
  }

  // 🔹 Lógica de Login
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("email").value.trim();
      const senha = inputSenha.value.trim();

      if (!email || !senha) return alert("Preencha todos os campos!");

      try {
        const userCredential = await signInWithEmailAndPassword(auth, email, senha);
        const snap = await get(ref(db, "users/" + userCredential.user.uid));

        if (!snap.exists()) return alert("Usuário não encontrado!");

        const dados = snap.val();
        if (dados.role === "admin") window.location.href = "admin.html";
        else if (dados.role === "teacher") window.location.href = "professor.html";
        else if (dados.role === "student") window.location.href = "aluno.html";
        else alert("Perfil inválido.");

      } catch (err) {
        alert("Erro ao fazer login: " + err.message);
      }
    });
  }

  // 🔹 Esqueci minha senha
  if (btnEsqueciSenha) {
    btnEsqueciSenha.addEventListener("click", async (e) => {
      e.preventDefault();
      const email = document.getElementById("email").value.trim();
      if (!email) return alert("Digite seu e-mail para redefinir a senha.");
      try {
        await sendPasswordResetEmail(auth, email);
        alert("E-mail de redefinição enviado!");
      } catch (err) {
        alert("Erro: " + err.message);
      }
    });
  }
});