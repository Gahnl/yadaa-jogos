import { auth, db } from "/js/firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import { ref, get, onValue } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-database.js";

const tabelaNotas = document.querySelector("#tabelaNotas tbody");

// ------------------------------------------------------------------
// 📚 GRADE CURRICULAR FIXA POR SÉRIE
// Importante: O nome da série aqui deve ser IGUAL ao que está no banco.
// ------------------------------------------------------------------
const GRADES_POR_SERIE = {
    "1º Ano": ["Arte", "Ciências", "Educação Física", "Geografia", "História", "Inglês", "Matemática", "Português"],
    "2º Ano": ["Arte", "Ciências", "Educação Física", "Geografia", "História", "Inglês", "Matemática", "Português"],
    "3º Ano": ["Arte", "Ciências", "Educação Física", "Geografia", "História", "Inglês", "Matemática", "Português"],
    "4º Ano": ["Arte", "Ciências", "Educação Física", "Geografia", "História", "Inglês", "Matemática", "Português"],
    "5º Ano": ["Arte", "Ciências", "Educação Física", "Geografia", "História", "Inglês", "Matemática", "Português"],
    "6º Ano": ["Arte", "Ciências", "Educação Física", "Espanhol", "Geografia", "História", "Inglês", "Matemática", "Português"],
    "7º Ano": ["Arte", "Ciências", "Educação Física", "Espanhol", "Geografia", "História", "Inglês", "Matemática", "Português"],
    "8º Ano": ["Arte", "Ciências", "Educação Física", "Espanhol", "Geografia", "História", "Inglês", "Matemática", "Português"],
    "9º Ano": ["Arte", "Ciências", "Educação Física", "Espanhol", "Geografia", "História", "Inglês", "Matemática", "Português", "Música"],
    "Ensino Médio": ["Arte", "Biologia", "Educação Física", "Espanhol", "Física", "Geografia", "História", "Inglês", "Matemática", "Português", "Química", "Sociologia", "Filosofia"]
};

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "index.html";
        return;
    }

    try {
        // 1. Busca os dados fixos do aluno (Série)
        const snapUser = await get(ref(db, `users/${user.uid}`));
        const dadosAluno = snapUser.val();

        if (!dadosAluno || !dadosAluno.serie) {
            tabelaNotas.innerHTML = `<tr><td colspan="6">Série não identificada no cadastro.</td></tr>`;
            return;
        }

        const serieDoAluno = dadosAluno.serie;
        // Pega a lista de matérias da grade ou, se não existir, usa as que já têm nota
        let listaMateriasBase = GRADES_POR_SERIE[serieDoAluno];

        // 2. ESCUTA AS NOTAS EM TEMPO REAL
        // Sempre que qualquer professor mudar algo em 'grades/UID_DO_ALUNO', este bloco executa sozinho
        onValue(ref(db, `grades/${user.uid}`), (snapshot) => {
            const grades = snapshot.val() || {};
            
            // Se a série não foi encontrada no mapa acima, ele mostra o que tiver de nota
            const materiasParaExibir = listaMateriasBase || Object.keys(grades);
            
            renderTabela(materiasParaExibir.sort(), grades);
        });

    } catch (e) {
        console.error("Erro ao carregar boletim:", e);
        tabelaNotas.innerHTML = `<tr><td colspan="6">Erro ao carregar dados.</td></tr>`;
    }
});

function renderTabela(materias, grades) {
    tabelaNotas.innerHTML = "";

    materias.forEach(materia => {
        const dadosMateria = grades[materia] || {};

        // Organiza os 4 bimestres
        const bimestres = {
            1: { nota: dadosMateria["1"]?.media ?? "-", falta: dadosMateria["1"]?.faltas ?? 0 },
            2: { nota: dadosMateria["2"]?.media ?? "-", falta: dadosMateria["2"]?.faltas ?? 0 },
            3: { nota: dadosMateria["3"]?.media ?? "-", falta: dadosMateria["3"]?.faltas ?? 0 },
            4: { nota: dadosMateria["4"]?.media ?? "-", falta: dadosMateria["4"]?.faltas ?? 0 }
        };

        let somaNotas = 0, qtdComNota = 0, somaFaltas = 0;

        [1, 2, 3, 4].forEach(n => {
            const nota = bimestres[n].nota;
            if (nota !== "-") {
                somaNotas += Number(nota);
                qtdComNota++;
            }
            somaFaltas += Number(bimestres[n].falta);
        });

        const mediaFinal = qtdComNota > 0 ? (somaNotas / qtdComNota).toFixed(1) : "-";

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><strong>${materia}</strong></td>
            ${[1, 2, 3, 4].map(n => `
                <td style="text-align: center;">
                    <span style="font-weight: bold; color: ${bimestres[n].nota < 6 && bimestres[n].nota !== '-' ? 'red' : 'inherit'}">
                        ${bimestres[n].nota}
                    </span><br>
                    <small style="color: #666;">Faltas: ${bimestres[n].falta}</small>
                </td>
            `).join("")}
            <td style="text-align: center;">
                <strong>${mediaFinal}</strong><br>
                <small>Total Faltas: ${somaFaltas}</small>
            </td>
        `;
        tabelaNotas.appendChild(tr);
    });
}

// Logout
document.getElementById("sairBtn")?.addEventListener("click", async () => {
    if(confirm("Deseja realmente sair?")) {
        await signOut(auth);
        window.location.href = "index.html";
    }
});