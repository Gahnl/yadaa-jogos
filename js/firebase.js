import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-database.js";

// Adicionado o export aqui para o admin.js poder ler as chaves
export const firebaseConfig = {
  apiKey: "AIzaSyCdLIRF811LJ7-BEnXxeht6sXvEtTiYn2U",
  authDomain: "sistema-colegio-saber.firebaseapp.com",
  databaseURL: "https://sistema-colegio-saber-default-rtdb.firebaseio.com",
  projectId: "sistema-colegio-saber",
  storageBucket: "sistema-colegio-saber.firebasestorage.app",
  messagingSenderId: "905380056037",
  appId: "1:905380056037:web:39b6b31f0e5dabb412bd0c"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);