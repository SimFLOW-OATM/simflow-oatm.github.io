import { getApp, getApps, initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";

const firebaseConfig = {
  apiKey: "AIzaSyDgYt_QMvFDcf0ZwG7-MKa8ChLriUVUqcY",
  authDomain: "simflow-51d5f.firebaseapp.com",
  projectId: "simflow-51d5f",
  storageBucket: "simflow-51d5f.firebasestorage.app",
  messagingSenderId: "679924137342",
  appId: "1:679924137342:ios:a9f38cd74eab4120f9472f"
};

function showAccessMessage(title, message) {
  let gate = document.querySelector(".night-planning-access-gate");
  if (!gate) {
    gate = document.createElement("div");
    gate.className = "night-planning-access-gate";
    document.body.append(gate);
  }
  gate.innerHTML = `
    <main class="night-planning-access-message" role="status">
      <h1>${title}</h1>
      <p>${message}</p>
    </main>
  `;
}

function loadClassicScript(source) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = source;
    script.addEventListener("load", resolve, { once: true });
    script.addEventListener("error", reject, { once: true });
    document.body.append(script);
  });
}

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const functions = getFunctions(app, "us-central1");
const recognizeNightPlanning = httpsCallable(functions, "recognizeNightPlanning", {
  timeout: 90000
});
const analyzeNightPlanningWithAI = httpsCallable(functions, "analyzeNightPlanningWithAI", {
  timeout: 120000
});
const loadOwnNightPlanningActions = httpsCallable(functions, "loadOwnNightPlanningActions");
const saveOwnNightPlanningActions = httpsCallable(functions, "saveOwnNightPlanningActions");
const saveNightPlanningCapture = httpsCallable(functions, "saveNightPlanningCapture", { timeout: 120000 });
const getNightPlanningEditAccess = httpsCallable(functions, "getNightPlanningEditAccess");
const claimNightPlanningLock = httpsCallable(functions, "claimNightPlanningLock");
const saveNightPlanningAnnotations = httpsCallable(functions, "saveNightPlanningAnnotations");
const loadNightPlanningCapture = httpsCallable(functions, "loadNightPlanningCapture");

showAccessMessage("Vérification de l’accès", "Connexion à SimFlow en cours...");

const user = await new Promise((resolve) => {
  let unsubscribe = () => {};
  unsubscribe = onAuthStateChanged(auth, (currentUser) => {
    unsubscribe();
    resolve(currentUser);
  }, () => resolve(null));
});

if (!user) {
  showAccessMessage("Accès refusé", "Connecte-toi à SimFlow pour accéder au planning de nuit.");
} else {
  const token = await user.getIdTokenResult().catch(() => null);
  const isAdmin = token?.claims?.simflow === true && token.claims.role === "admin";

  if (token?.claims?.simflow !== true) {
    showAccessMessage("Accès refusé", "Un compte SimFlow est nécessaire pour accéder au planning de nuit.");
  } else {
    document.querySelector(".night-planning-access-gate")?.remove();
    window.simflowNightPlanningUserId = user.uid;
    window.simflowGetNightPlanningEditAccess = async (shiftDate) => (await getNightPlanningEditAccess({ shiftDate })).data;
    window.simflowClaimNightPlanningLock = async (shiftDate) => (await claimNightPlanningLock({ shiftDate })).data;
    window.simflowSaveNightPlanningAnnotations = async (shiftDate, state) => (await saveNightPlanningAnnotations({ shiftDate, state })).data;
    window.simflowLoadNightPlanningCapture = async (shiftDate) => (await loadNightPlanningCapture({ shiftDate })).data;
    window.simflowSaveNightPlanningCapture = async (shiftDate, imageDataUrl) => {
      const result = await saveNightPlanningCapture({ shiftDate, imageDataUrl });
      return result.data;
    };
    window.simflowLoadOwnNightPlanningActions = async () => {
      const result = await loadOwnNightPlanningActions();
      return result.data?.actions || null;
    };
    window.simflowSaveOwnNightPlanningActions = async (actions) => {
      const result = await saveOwnNightPlanningActions(actions);
      return result.data;
    };
    window.simflowRecognizePlanning = async (imageDataUrl) => {
      const result = await recognizeNightPlanning({ imageDataUrl });
      return result.data;
    };
    window.simflowAnalyzeNightPlanningWithAI = async (imageDataUrl, simulators, shiftDate) => {
      const result = await analyzeNightPlanningWithAI({ imageDataUrl, simulators, shiftDate });
      return result.data;
    };
    await loadClassicScript("./data-bootstrap.js?v=20260719-0040");
    window.simflowNightPlanningIsAdmin = isAdmin;
    await loadClassicScript("./app.js?v=20261014-0197");
  }
}
