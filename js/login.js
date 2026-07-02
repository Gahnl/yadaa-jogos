import { auth, db } from "/js/firebase.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-database.js";

document.addEventListener("DOMContentLoaded", () => {
    
    // --- 🔹 LÓGICA DA SPLASH SCREEN ---
    const splash = document.getElementById("splash-screen");
    if (splash) {
        setTimeout(() => {
            splash.classList.add("hidden-splash");
        }, 5000); // 5 segundos
    }

    const form = document.getElementById("loginForm");
    const inputSenha = document.getElementById("senha");
    const togglePassword = document.getElementById("togglePassword");
    const eyeOpen = document.getElementById("eyeOpen");
    const eyeClosed = document.getElementById("eyeClosed");
    const btnEsqueciSenha = document.getElementById("btnEsqueciSenha");

    // 🔹 Lógica do Ícone do Olho (Mostrar/Esconder Senha)
    if (togglePassword) {
        togglePassword.addEventListener("click", () => {
            const isPassword = inputSenha.type === "password";
            inputSenha.type = isPassword ? "text" : "password";
            eyeOpen.style.display = isPassword ? "none" : "block";
            eyeClosed.style.display = isPassword ? "block" : "none";
        });
    }

    // 🔹 Lógica de Login Híbrida
    if (form) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const email = document.getElementById("email").value.trim();
            const senha = inputSenha.value.trim();

            if (!email || !senha) return alert("Preencha todos os campos!");

            try {
                // 1. TENTA LOGIN OFICIAL (Firebase Auth)
                const userCredential = await signInWithEmailAndPassword(auth, email, senha);
                console.log("Login oficial realizado com sucesso.");
                direcionarUsuario(userCredential.user.uid);

            } catch (err) {
                // 2. SE FALHAR (ERRO DE CREDENCIAL), BUSCA NO DATABASE
                console.warn("Login oficial falhou. Verificando senha manual no banco de dados...");

                try {
                    const snapUsers = await get(ref(db, "users"));
                    if (!snapUsers.exists()) throw new Error("Banco de dados vazio.");

                    const usuarios = snapUsers.val();
                    let uidEncontrado = null;
                    let senhaBate = false;

                    // Procura o usuário pelo e-mail dentro do nó 'users'
                    for (let uid in usuarios) {
                        if (usuarios[uid].email === email) {
                            uidEncontrado = uid;
                            // Verifica se a senha digitada é igual à senha salva pelo ADM
                            if (usuarios[uid].senhaProvisoria === senha) {
                                senhaBate = true;
                            }
                            break;
                        }
                    }

                    if (uidEncontrado && senhaBate) {
                        console.log("Login realizado via senha manual do banco.");
                        direcionarUsuario(uidEncontrado);
                    } else {
                        alert("E-mail ou senha incorretos.");
                    }

                } catch (dbErr) {
                    console.error("Erro ao consultar banco:", dbErr);
                    alert("Erro ao fazer login: " + err.message);
                }
            }
        });
    }

    // 🔹 Função para Redirecionamento e Sessão
    async function direcionarUsuario(uid) {
        try {
            const snap = await get(ref(db, "users/" + uid));
            if (!snap.exists()) return alert("Usuário não encontrado no banco de dados!");

            const dados = snap.val();

            // Guardamos os dados no sessionStorage para que as outras páginas 
            // saibam quem está logado, mesmo que o Auth oficial falhe.
            sessionStorage.setItem("usuarioLogado", JSON.stringify({
                uid: uid,
                name: dados.name,
                role: dados.role,
                email: dados.email,
                serie: dados.serie || ""
            }));

            // Redirecionamento por perfil
            if (dados.role === "admin") window.location.href = "admin.html";
            else if (dados.role === "teacher") window.location.href = "professor.html";
            else if (dados.role === "student") window.location.href = "aluno.html";
            else alert("Perfil de usuário inválido.");

        } catch (error) {
            console.error("Erro no direcionamento:", error);
            alert("Erro ao carregar dados do perfil.");
        }
    }

    // 🔹 Esqueci minha senha (Apenas para e-mails REAIS)
    if (btnEsqueciSenha) {
        btnEsqueciSenha.addEventListener("click", (e) => {
            e.preventDefault();
            alert("Para alunos com e-mail do sistema, solicite a nova senha diretamente com a coordenação.");
        });
    }
});