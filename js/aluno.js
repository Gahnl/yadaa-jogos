import { auth, db } from "/js/firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import { ref, get, onValue } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-database.js";

const tabelaNotas = document.querySelector("#tabelaNotas tbody");

const GRADES_POR_SERIE = {
    "1º Ano": ["Arte", "Ciências", "Educação Física", "Geografia", "História", "Inglês", "Matemática", "Português", "Música"],
    "2º Ano": ["Arte", "Ciências", "Educação Física", "Geografia", "História", "Inglês", "Matemática", "Português", "Música"],
    "3º Ano": ["Arte", "Ciências", "Educação Física", "Geografia", "História", "Inglês", "Matemática", "Português", "Música"],
    "4º Ano": ["Arte", "Ciências", "Educação Física", "Geografia", "História", "Inglês", "Matemática", "Português", "Música"],
    "5º Ano": ["Arte", "Ciências", "Eduação Física", "Geografia", "História", "Inglês", "Matemática", "Português", "Música"],
    "6º Ano": ["Arte", "Ciências", "Educação Física", "Espanhol", "Geografia", "História", "Inglês", "Matemática", "Português"],
    "7º Ano": ["Arte", "Ciências", "Educação Física", "Espanhol", "Geografia", "História", "Inglês", "Matemática", "Português"],
    "8º Ano": ["Arte", "Ciências", "Educação Física", "Espanhol", "Geografia", "História", "Inglês", "Matemática", "Português"],
    "9º Ano A": ["Arte", "Ciências", "Educação Física", "Espanhol", "Geografia", "História", "Inglês", "Matemática", "Português"],
    "9º Ano B": ["Arte", "Ciências", "Educação Física", "Espanhol", "Geografia", "História", "Inglês", "Matemática", "Português"]
};

function arredondarEscola(nota) {
    if (isNaN(nota) || nota === null) return 0;

    const inteiro = Math.floor(nota);
    const decimal = parseFloat((nota - inteiro).toFixed(2));

    if (decimal <= 0.25) return inteiro;
    else if (decimal <= 0.75) return inteiro + 0.5;
    else return inteiro + 1;
}

function normalizarNota(valor) {
    if (valor === undefined || valor === null || valor === "") return null;

    return parseFloat(String(valor).replace(",", "."));
}

// --- 🔹 LOGICA DE INICIALIZAÇÃO HÍBRIDA ---
const usuarioSessao = JSON.parse(sessionStorage.getItem("usuarioLogado"));

if (usuarioSessao) {
    inicializarBoletim(usuarioSessao.uid);
} else {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            inicializarBoletim(user.uid);
        } else {
            window.location.href = "index.html";
        }
    });
}

async function inicializarBoletim(uid) {
    try {
        const snapUser = await get(ref(db, `users/${uid}`));
        const dadosAluno = snapUser.val();

        if (!dadosAluno || !dadosAluno.serie) {
            tabelaNotas.innerHTML = `
                <tr>
                    <td colspan="5">
                        Série não identificada no cadastro.
                    </td>
                </tr>
            `;
            return;
        }

        const serieDoAluno = dadosAluno.serie;

        onValue(ref(db, `grades/${uid}`), (snapshot) => {
            const grades = snapshot.val() || {};

            const materiasParaExibir = new Set(
                GRADES_POR_SERIE[serieDoAluno] || []
            );

            Object.keys(grades).forEach(mat => {
                materiasParaExibir.add(mat);
            });

            renderTabela(
                Array.from(materiasParaExibir).sort((a, b) =>
                    a.localeCompare(b, "pt-BR")
                ),
                grades
            );
        });

    } catch (e) {
        console.error("Erro ao carregar boletim:", e);
    }
}

function renderTabela(materias, grades) {
    tabelaNotas.innerHTML = "";

    materias.forEach(materia => {
        const dadosMateria = grades[materia] || {};
        let somaFaltas = 0;

        const bimestres = [1, 2, 3, 4].map(n => {
            const b = dadosMateria[n] || {};

            // 1. Verifica se os campos de notas existem e estão preenchidos no banco
            const p1Preenchida = b.p1 !== undefined && b.p1 !== null && b.p1 !== "";
            const p2Preenchida = b.p2 !== undefined && b.p2 !== null && b.p2 !== "";
            const trabPreenchido = b.trabalhos !== undefined && b.trabalhos !== null && b.trabalhos !== "";
            const recPreenchida = b.recuperacao !== undefined && b.recuperacao !== null && b.recuperacao !== "";

            let notaExibicao = "-";

            // 2. REGRA DE TRAVA: Só mostra a média se as 3 notas principais existirem OU se tiver recuperação direto
            if ((p1Preenchida && p2Preenchida && trabPreenchido) || (recPreenchida && !p1Preenchida && !p2Preenchida && !trabPreenchido)) {
                
                // Busca média salva
                let valorBruto = b.media !== undefined ? b.media : dadosMateria[`bim${n}`];
                let valorMedia = normalizarNota(valorBruto);

                if (valorMedia !== null && !isNaN(valorMedia)) {
                    const notaArredondada = arredondarEscola(valorMedia);
                    notaExibicao = notaArredondada.toString().replace(".", ",");
                }
            } else {
                // Caso o professor tenha digitado apenas 1 ou 2 notas, mantém em branco para o aluno
                notaExibicao = "-";
            }

            const faltasBim = Number(
                b.faltas ||
                dadosMateria[`faltas${n}`] ||
                0
            );

            somaFaltas += faltasBim;

            return {
                nota: notaExibicao,
                falta: faltasBim
            };
        });

        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>
                <strong>${materia}</strong>
            </td>

            ${bimestres.map(b => {
                const notaNum = b.nota !== "-" ? parseFloat(b.nota.replace(",", ".")) : null;

                const corNota = (notaNum !== null && notaNum < 6) ? "red" : "inherit";

                return `
                    <td style="text-align: center;">
                        <span style="
                            font-weight: bold;
                            color: ${corNota};
                        ">
                            ${b.nota}
                        </span>
                        <br>
                        <small style="color: #666;">
                            Faltas: ${b.falta}
                        </small>
                    </td>
                `;
            }).join("")}
        `;

        tabelaNotas.appendChild(tr);
    });
}