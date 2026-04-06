import { auth, db } from "/js/firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import { ref, get, onValue } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-database.js";

const tabelaNotas = document.querySelector("#tabelaNotas tbody");

const GRADES_POR_SERIE = {
    "1º Ano": ["Arte", "Ciências", "Educação Física", "Geografia", "História", "Inglês", "Matemática", "Português", "Música"],
    "2º Ano": ["Arte", "Ciências", "Educação Física", "Geografia", "História", "Inglês", "Matemática", "Português","Música"],
    "3º Ano": ["Arte", "Ciências", "Educação Física", "Geografia", "História", "Inglês", "Matemática", "Português","Música"],
    "4º Ano": ["Arte", "Ciências", "Educação Física", "Geografia", "História", "Inglês", "Matemática", "Português","Música"],
    "5º Ano": ["Arte", "Ciências", "Educação Física", "Geografia", "História", "Inglês", "Matemática", "Português","Música"],
    "6º Ano": ["Arte", "Ciências", "Educação Física", "Espanhol", "Geografia", "História", "Inglês", "Matemática", "Português"],
    "7º Ano": ["Arte", "Ciências", "Educação Física", "Espanhol", "Geografia", "História", "Inglês", "Matemática", "Português"],
    "8º Ano": ["Arte", "Ciências", "Educação Física", "Espanhol", "Geografia", "História", "Inglês", "Matemática", "Português"],
    "9º Ano A": ["Arte", "Ciências", "Educação Física", "Espanhol", "Geografia", "História", "Inglês", "Matemática", "Português"],
    "9º Ano B": ["Arte", "Ciências", "Educação Física", "Espanhol", "Geografia", "História", "Inglês", "Matemática", "Português"]
};

// 1. FUNÇÃO DE ARREDONDAMENTO POR QUARTIS (REGRA: 0.25 BAIXO / 0.76 CIMA)
function arredondarEscola(nota) {
    if (isNaN(nota) || nota === null) return 0;
    
    const inteiro = Math.floor(nota);
    const decimal = parseFloat((nota - inteiro).toFixed(2)); 

    if (decimal <= 0.25) {
        return inteiro; // Ex: 6.25 -> 6.0
    } else if (decimal >= 0.26 && decimal <= 0.75) {
        return inteiro + 0.5; // Ex: 6.26 -> 6.5 | 6.75 -> 6.5
    } else {
        return inteiro + 1; // Ex: 6.76 -> 7.0
    }
}

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "index.html";
        return;
    }

    try {
        const snapUser = await get(ref(db, `users/${user.uid}`));
        const dadosAluno = snapUser.val();

        if (!dadosAluno || !dadosAluno.serie) {
            tabelaNotas.innerHTML = `<tr><td colspan="6">Série não identificada no cadastro.</td></tr>`;
            return;
        }

        const serieDoAluno = dadosAluno.serie;
        
        onValue(ref(db, `grades/${user.uid}`), (snapshot) => {
            const grades = snapshot.val() || {};
            const materiasParaExibir = new Set(GRADES_POR_SERIE[serieDoAluno] || []);
            Object.keys(grades).forEach(mat => materiasParaExibir.add(mat));

            renderTabela(Array.from(materiasParaExibir).sort((a, b) => a.localeCompare(b, 'pt-BR')), grades);
        });

    } catch (e) {
        console.error("Erro ao carregar boletim:", e);
    }
});

function renderTabela(materias, grades) {
    tabelaNotas.innerHTML = "";

    materias.forEach(materia => {
        const dadosMateria = grades[materia] || {};
        let somaNotasFinais = 0, qtdBimestresFechados = 0, somaFaltas = 0;

        const bimestres = [1, 2, 3, 4].map(n => {
            const b = dadosMateria[n] || {};
            let notaExibicao = "-";

            const p1 = b.p1;
            const p2 = b.p2;
            const tr = b.trabalhos;
            const rec = b.recuperacao;

            const temTodasAsNotas = (p1 !== undefined && p1 !== "") && 
                                   (p2 !== undefined && p2 !== "") && 
                                   (tr !== undefined && tr !== "");

            if (temTodasAsNotas || (rec !== undefined && rec !== "")) {
                const valorMedia = Number(b.media || 0);
                // A nota já vem arredondada do banco, apenas formatamos a vírgula
                notaExibicao = valorMedia.toString().replace(".", ",");
                
                somaNotasFinais += valorMedia;
                qtdBimestresFechados++;
            }

            const faltasBim = Number(b.faltas ?? 0);
            somaFaltas += faltasBim;

            return { nota: notaExibicao, falta: faltasBim };
        });

        // Média Final com a nova regra de arredondamento
        const mediaCalculada = qtdBimestresFechados > 0 ? (somaNotasFinais / qtdBimestresFechados) : null;
        const mediaFinalAno = mediaCalculada !== null ? arredondarEscola(mediaCalculada) : "-";

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><strong>${materia}</strong></td>
            ${bimestres.map(b => {
                const notaNum = b.nota !== "-" ? parseFloat(b.nota.replace(",", ".")) : null;
                const corNota = (notaNum !== null && notaNum < 6) ? "red" : "inherit";
                return `
                <td style="text-align: center;">
                    <span style="font-weight: bold; color: ${corNota}">
                        ${b.nota}
                    </span><br>
                    <small style="color: #666;">Faltas: ${b.falta}</small>
                </td>
                `;
            }).join("")}
            <td style="text-align: center;">
                <strong style="color: ${mediaFinalAno !== "-" && mediaFinalAno < 6 ? 'red' : '#32066d'}">
                    ${mediaFinalAno.toString().replace(".", ",")}
                </strong><br>
                <small>Total Faltas: ${somaFaltas}</small>
            </td>
        `;
        tabelaNotas.appendChild(tr);
    });
}

document.getElementById("sairBtn")?.addEventListener("click", async () => {
    if(confirm("Deseja realmente sair?")) {
        await signOut(auth);
        window.location.href = "index.html";
    }
});