import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection,
  deleteField,
  deleteDoc,
  doc,
  getFirestore,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDgYt_QMvFDcf0ZwG7-MKa8ChLriUVUqcY",
  authDomain: "simflow-51d5f.firebaseapp.com",
  projectId: "simflow-51d5f",
  storageBucket: "simflow-51d5f.firebasestorage.app",
  messagingSenderId: "679924137342",
  appId: "1:679924137342:ios:a9f38cd74eab4120f9472f"
};

const adminCode = "254789";
const generalName = "General";
const generalSimulatorID = "00000000-0000-0000-0000-000000000001";
const deletedLegacySimulatorNames = new Set(["Simu 1", "Simu 2", "Simu 3", "Simu 4"]);
const sessionStorageKey = "simflow.web.currentUser";
const sessionDurationMs = 30 * 24 * 60 * 60 * 1000;

const state = {
  authReady: false,
  currentUser: null,
  selectedDate: startOfDay(new Date()),
  visibleMonth: startOfMonth(new Date()),
  periodStartDate: null,
  periodEndDate: null,
  isSelectingPeriodEnd: false,
  search: "",
  showTagged: false,
  showAcknowledged: false,
  showDeleted: false,
  selectedDetail: null,
  selectedCreate: null,
  pendingHandwritingClear: null,
  detailTimelineEvents: [],
  activeAdminTab: "home",
  codeModalMode: "login",
  isSaving: false,
  notes: [],
  handwritingNotes: [],
  dailyTags: [],
  users: [],
  allSimulators: [],
  simulators: [],
  unsubscribeNotes: null,
  unsubscribeHandwritingNotes: null,
  unsubscribeDailyTags: null,
  unsubscribeUsers: null,
  unsubscribeSimulators: null,
  lastLoginEventAt: 0
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const elements = {
  loginPanel: document.querySelector("#loginPanel"),
  brandResetButton: document.querySelector("#brandResetButton"),
  userPanel: document.querySelector("#userPanel"),
  openLoginButton: document.querySelector("#openLoginButton"),
  codeModal: document.querySelector("#codeModal"),
  codeModalTitle: document.querySelector("#codeModalTitle"),
  codeModalMessage: document.querySelector("#codeModalMessage"),
  accessCode: document.querySelector("#accessCode"),
  loginButton: document.querySelector("#loginButton"),
  cancelLoginButton: document.querySelector("#cancelLoginButton"),
  changeCodeOverlay: document.querySelector("#changeCodeOverlay"),
  currentCodeInput: document.querySelector("#currentCodeInput"),
  newCodeInput: document.querySelector("#newCodeInput"),
  confirmCodeInput: document.querySelector("#confirmCodeInput"),
  cancelChangeCodeButton: document.querySelector("#cancelChangeCodeButton"),
  saveChangeCodeButton: document.querySelector("#saveChangeCodeButton"),
  changeCodeError: document.querySelector("#changeCodeError"),
  loginHint: document.querySelector("#loginHint"),
  fileWarning: document.querySelector("#fileWarning"),
  adminSettingsButton: document.querySelector("#adminSettingsButton"),
  logoutButton: document.querySelector("#logoutButton"),
  changeCodeButton: document.querySelector("#changeCodeButton"),
  userSummaryButton: document.querySelector("#userSummaryButton"),
  userMenu: document.querySelector("#userMenu"),
  userName: document.querySelector("#userName"),
  userMeta: document.querySelector("#userMeta"),
  selectedDate: document.querySelector("#selectedDate"),
  calendarMonth: document.querySelector("#calendarMonth"),
  calendarGrid: document.querySelector("#calendarGrid"),
  previousMonthButton: document.querySelector("#previousMonthButton"),
  nextMonthButton: document.querySelector("#nextMonthButton"),
  todayButton: document.querySelector("#todayButton"),
  teamPresenceList: document.querySelector("#teamPresenceList"),
  showTaggedToggle: document.querySelector("#showTaggedToggle"),
  showAcknowledgedToggle: document.querySelector("#showAcknowledgedToggle"),
  showDeletedRow: document.querySelector("#showDeletedRow"),
  showDeletedToggle: document.querySelector("#showDeletedToggle"),
  searchInput: document.querySelector("#searchInput"),
  clearSearchButton: document.querySelector("#clearSearchButton"),
  simulatorShortcutGrid: document.querySelector("#simulatorShortcutGrid"),
  simulatorList: document.querySelector("#simulatorList"),
  pageTitle: document.querySelector("#pageTitle"),
  pageSubtitle: document.querySelector("#pageSubtitle"),
  syncStatus: document.querySelector("#syncStatus"),
  emptyState: document.querySelector("#emptyState"),
  noteGroups: document.querySelector("#noteGroups"),
  detailOverlay: document.querySelector("#detailOverlay"),
  detailCloseButton: document.querySelector("#detailCloseButton"),
  detailTitle: document.querySelector("#detailTitle"),
  detailContext: document.querySelector("#detailContext"),
  detailBody: document.querySelector("#detailBody"),
  creationTextOverlay: document.querySelector("#creationTextOverlay"),
  creationTextCloseButton: document.querySelector("#creationTextCloseButton"),
  creationTextDate: document.querySelector("#creationTextDate"),
  creationTextActions: document.querySelector("#creationTextActions"),
  creationTextContent: document.querySelector("#creationTextContent"),
  adminOverlay: document.querySelector("#adminOverlay"),
  adminCloseButton: document.querySelector("#adminCloseButton"),
  adminBody: document.querySelector("#adminBody")
};

let pendingCenteredSimulatorBandAnchor = null;

elements.selectedDate.value = isoDate(state.selectedDate);
restoreSavedSession();
if (window.location.protocol === "file:") {
  elements.fileWarning.classList.remove("hidden");
  setStatus("Ouvrir via localhost");
}

if (window.location.protocol !== "file:") {
  signInAnonymously(auth).catch((error) => {
    setStatus("Erreur Firebase");
    elements.loginHint.textContent = error.message;
  });
}

onAuthStateChanged(auth, (user) => {
  if (window.location.protocol === "file:") {
    setStatus("Ouvrir via localhost");
    return;
  }

  state.authReady = Boolean(user);
  setStatus(user ? "Connecté à Firebase" : "Hors ligne");
  if (user) {
    attachFirebaseListeners();
    restartDailyTagsListener();
    recordLoginAppearance();
  }
});

elements.brandResetButton.addEventListener("click", resetDisplayState);
elements.openLoginButton.addEventListener("click", () => openCodeModal("login"));
elements.loginButton.addEventListener("click", submitCodeModal);
elements.cancelLoginButton.addEventListener("click", closeCodeModal);
elements.codeModal.addEventListener("click", (event) => {
  if (event.target === elements.codeModal) {
    closeCodeModal();
  }
});
elements.accessCode.addEventListener("input", () => {
  elements.accessCode.value = elements.accessCode.value.replace(/\D/g, "").slice(0, 6);
});
elements.accessCode.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    submitCodeModal();
  } else if (event.key === "Escape") {
    closeCodeModal();
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    recordLoginAppearance();
  }
});
window.addEventListener("focus", recordLoginAppearance);
elements.userSummaryButton.addEventListener("click", () => {
  elements.userMenu.classList.toggle("hidden");
});
document.addEventListener("click", (event) => {
  if (!elements.userPanel.contains(event.target)) {
    elements.userMenu.classList.add("hidden");
  }
});
elements.logoutButton.addEventListener("click", () => {
  elements.accessCode.value = "";
  elements.userMenu.classList.add("hidden");
  openCodeModal("login");
});
elements.changeCodeButton.addEventListener("click", () => {
  elements.userMenu.classList.add("hidden");
  openChangeCodePanel();
});
elements.cancelChangeCodeButton.addEventListener("click", closeChangeCodePanel);
elements.saveChangeCodeButton.addEventListener("click", changeCurrentUserCode);
[elements.currentCodeInput, elements.newCodeInput, elements.confirmCodeInput].forEach((input) => {
  input.addEventListener("input", () => {
    input.value = input.value.replace(/\D/g, "").slice(0, 6);
    clearChangeCodeError();
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      changeCurrentUserCode();
    } else if (event.key === "Escape") {
      closeChangeCodePanel();
    }
  });
});
elements.adminSettingsButton.addEventListener("click", () => {
  elements.userMenu.classList.add("hidden");
  openAdminSettings();
});
elements.selectedDate.addEventListener("change", () => {
  state.selectedDate = startOfDay(parseDateInput(elements.selectedDate.value));
  state.visibleMonth = startOfMonth(state.selectedDate);
  clearPeriodMode();
  renderPreservingCenteredSimulatorBand();
});
elements.previousMonthButton.addEventListener("click", () => {
  state.visibleMonth = addMonths(state.visibleMonth, -1);
  renderCalendar();
});
elements.nextMonthButton.addEventListener("click", () => {
  state.visibleMonth = addMonths(state.visibleMonth, 1);
  renderCalendar();
});
elements.todayButton.addEventListener("click", () => {
  goToToday();
});
[
  elements.showTaggedToggle,
  elements.showAcknowledgedToggle,
  elements.showDeletedToggle,
  document.querySelector('label[for="showTaggedToggle"]'),
  document.querySelector('label[for="showAcknowledgedToggle"]'),
  document.querySelector('label[for="showDeletedToggle"]')
].filter(Boolean).forEach((control) => {
  control.addEventListener("pointerdown", prepareCenteredSimulatorBandAnchor);
  control.addEventListener("keydown", (event) => {
    if (event.key === " " || event.key === "Enter") {
      prepareCenteredSimulatorBandAnchor();
    }
  });
});
elements.showTaggedToggle.addEventListener("change", () => {
  state.showTagged = elements.showTaggedToggle.checked;
  renderPreservingCenteredSimulatorBand(takePendingCenteredSimulatorBandAnchor());
});
elements.showAcknowledgedToggle.addEventListener("change", () => {
  state.showAcknowledged = elements.showAcknowledgedToggle.checked;
  renderPreservingCenteredSimulatorBand(takePendingCenteredSimulatorBandAnchor());
});
elements.showDeletedToggle.addEventListener("change", () => {
  state.showDeleted = elements.showDeletedToggle.checked;
  renderPreservingCenteredSimulatorBand(takePendingCenteredSimulatorBandAnchor());
});
elements.searchInput.addEventListener("input", () => {
  state.search = elements.searchInput.value.trim();
  render();
});
elements.clearSearchButton.addEventListener("click", () => {
  state.search = "";
  elements.searchInput.value = "";
  render();
});
elements.simulatorShortcutGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-scroll-simulator]");
  if (!button) {
    return;
  }

  scrollToSimulator(decodeURIComponent(button.dataset.scrollSimulator));
});
elements.noteGroups.addEventListener("click", (event) => {
  if (event.target.closest("[data-tag-note-id]")) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }

  const addButton = event.target.closest("[data-add-context]");
  if (addButton) {
    event.stopPropagation();
    openCreate(decodeURIComponent(addButton.dataset.addContext));
    return;
  }

  const card = event.target.closest(".note-card");
  if (!card) {
    return;
  }

  openDetail(card.dataset.noteId, decodeURIComponent(card.dataset.context));
});

let noteTagLongPressTimer = null;
const clearNoteTagLongPressTimer = () => {
  if (noteTagLongPressTimer) {
    window.clearTimeout(noteTagLongPressTimer);
    noteTagLongPressTimer = null;
  }
};

elements.noteGroups.addEventListener("pointerdown", (event) => {
  const tagTarget = event.target.closest("[data-tag-note-id]");
  if (!tagTarget) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  const noteID = tagTarget.dataset.tagNoteId;
  noteTagLongPressTimer = window.setTimeout(() => {
    toggleDailyTag(noteID).catch((error) => setStatus(error.message));
    noteTagLongPressTimer = null;
  }, 550);
});
elements.noteGroups.addEventListener("pointerup", clearNoteTagLongPressTimer);
elements.noteGroups.addEventListener("pointerleave", clearNoteTagLongPressTimer);
elements.noteGroups.addEventListener("pointercancel", clearNoteTagLongPressTimer);
elements.detailCloseButton.addEventListener("click", closeDetail);
elements.detailOverlay.addEventListener("click", (event) => {
  if (event.target === elements.detailOverlay) {
    closeDetail();
  }
});
elements.detailOverlay.addEventListener("click", (event) => {
  const creationRow = event.target.closest("[data-creation-text]");
  if (creationRow) {
    openSelectedCreationTextModal();
    return;
  }

  const deletePopover = elements.detailBody.querySelector(".delete-confirm-popover");
  if (deletePopover && !event.target.closest(".delete-confirm-popover") && !event.target.closest("[data-detail-action='delete-note']")) {
    deletePopover.remove();
  }

  const timelineRow = event.target.closest("[data-timeline-event-index]");
  if (timelineRow) {
    openTimelineTextModal(Number(timelineRow.dataset.timelineEventIndex));
    return;
  }

  const action = event.target.closest("[data-detail-action]")?.dataset.detailAction;
  if (!action || (!state.selectedDetail && !state.selectedCreate)) {
    return;
  }

  if (state.selectedCreate) {
    if (action === "save-edit") {
      saveNewNote();
    }
    return;
  }

  const note = state.notes.find((candidate) => candidate.id === state.selectedDetail.noteId);
  if (!note) {
    return;
  }

  if (action === "toggle-done") {
    toggleDraftDoneButton(event.target.closest("[data-detail-action]"));
  } else if (action === "toggle-ack") {
    toggleDraftAcknowledgementButton(event.target.closest("[data-detail-action]"));
  } else if (action === "save-edit") {
    saveDetailEdit(note);
  } else if (action === "delete-note") {
    deleteNoteFromDetail(note);
  } else if (action === "undo-latest-modification") {
    undoLatestModificationFromDetail(note);
  } else if (action === "ocr-handwriting") {
    recognizeVisibleHandwriting(note);
  } else if (action === "clear-handwriting") {
    clearVisibleHandwriting(note);
  }
});
elements.creationTextCloseButton.addEventListener("click", closeCreationTextModal);
elements.creationTextOverlay.addEventListener("click", (event) => {
  if (event.target === elements.creationTextOverlay) {
    closeCreationTextModal();
  }

  const undoButton = event.target.closest("[data-creation-text-action='undo-latest-modification']");
  if (undoButton) {
    const note = state.selectedDetail
      ? state.notes.find((candidate) => candidate.id === state.selectedDetail.noteId)
      : null;
    if (note) {
      undoLatestModificationFromDetail(note);
    }
  }
});
elements.adminCloseButton.addEventListener("click", closeAdminSettings);
elements.adminOverlay.addEventListener("click", (event) => {
  if (event.target === elements.adminOverlay) {
    closeAdminSettings();
  }
});
elements.adminOverlay.addEventListener("click", (event) => {
  const actionButton = event.target.closest("[data-admin-action]");
  const action = actionButton?.dataset.adminAction;
  if (!action) {
    return;
  }

  event.preventDefault();

  if (action === "admin-home") {
    state.activeAdminTab = "home";
    renderAdminSettings();
  } else if (action === "open-admin-users") {
    state.activeAdminTab = "users";
    renderAdminSettings();
  } else if (action === "open-admin-simulators") {
    state.activeAdminTab = "simulators";
    renderAdminSettings();
  } else if (action === "create-user") {
    createAdminUser();
  } else if (action === "save-user") {
    saveAdminUser(actionButton.closest(".admin-card")?.dataset.userId);
  } else if (action === "reset-user-code") {
    resetAdminUserCode(actionButton.closest(".admin-card")?.dataset.userId);
  } else if (action === "delete-user") {
    requestDeleteAdminUser(actionButton.closest(".admin-card")?.dataset.userId, actionButton);
  } else if (action === "save-simulator") {
    saveAdminSimulator(actionButton.closest(".admin-card")?.dataset.simulatorId);
  } else if (action === "new-simulator") {
    createAdminSimulator();
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeDetail();
    closeAdminSettings();
    closeChangeCodePanel();
  }
});

render();

function openCodeModal(mode = "login") {
  state.codeModalMode = mode;
  elements.accessCode.value = "";
  elements.loginHint.textContent = "Entre ton code utilisateur a 6 chiffres.";
  elements.codeModalTitle.textContent = "Code utilisateur";
  elements.codeModalMessage.textContent = "Entrer votre code utilisateur a 6 chiffres.";

  elements.codeModal.classList.remove("hidden");
  window.setTimeout(() => elements.accessCode.focus(), 20);
}

function closeCodeModal() {
  elements.codeModal.classList.add("hidden");
  elements.accessCode.value = "";
}

function submitCodeModal() {
  login();
}

function openChangeCodePanel() {
  elements.currentCodeInput.value = "";
  elements.newCodeInput.value = "";
  elements.confirmCodeInput.value = "";
  clearChangeCodeError();
  elements.changeCodeOverlay.classList.remove("hidden");
  elements.changeCodeOverlay.setAttribute("aria-hidden", "false");
  window.setTimeout(() => elements.currentCodeInput.focus(), 20);
}

function closeChangeCodePanel() {
  elements.changeCodeOverlay.classList.add("hidden");
  elements.changeCodeOverlay.setAttribute("aria-hidden", "true");
}

function showChangeCodeError(message) {
  elements.changeCodeError.textContent = message;
  elements.changeCodeError.classList.remove("hidden");
}

function clearChangeCodeError() {
  elements.changeCodeError.textContent = "";
  elements.changeCodeError.classList.add("hidden");
}

async function changeCurrentUserCode() {
  const currentCode = elements.currentCodeInput.value.replace(/\D/g, "");
  const newCode = elements.newCodeInput.value.replace(/\D/g, "");
  const confirmCode = elements.confirmCodeInput.value.replace(/\D/g, "");

  if (!state.currentUser || state.currentUser.role === "admin") {
    showChangeCodeError("Code non valide.");
    return;
  }

  if (currentCode.length !== 6 || newCode.length !== 6 || confirmCode.length !== 6 || newCode !== confirmCode || newCode === adminCode) {
    showChangeCodeError("Code non valide.");
    return;
  }

  const currentDocumentID = currentUserDocumentID();
  const currentUserRecord = state.users.find((user) => user.documentID === currentDocumentID);
  if (!currentUserRecord || currentUserRecord.accessCode !== currentCode) {
    showChangeCodeError("Code non valide.");
    return;
  }

  const codeAlreadyUsed = state.users.some((user) => {
    return user.documentID !== currentDocumentID && user.accessCode === newCode;
  });

  if (!currentDocumentID || codeAlreadyUsed) {
    showChangeCodeError("Code non valide.");
    return;
  }

  await updateDoc(doc(db, "users", currentDocumentID), {
    accessCode: newCode,
    isAccessCodeUserDefined: true,
    updatedAt: new Date()
  });

  state.currentUser.documentID = currentDocumentID;
  saveSession(state.currentUser);
  closeChangeCodePanel();
  setStatus("Code utilisateur modifié");
}

async function login() {
  const code = elements.accessCode.value.replace(/\D/g, "");
  elements.codeModalMessage.textContent = "Vérification...";

  if (!state.authReady) {
    elements.codeModalMessage.textContent = "Connexion Firebase en cours.";
    return;
  }

  if (code === adminCode) {
    state.currentUser = {
      id: "ADMIN",
      documentID: "ADMIN",
      firstName: "ADMIN",
      lastName: "",
      role: "admin",
      team: ""
    };
    saveSession(state.currentUser);
    state.lastLoginEventAt = 0;
    restartDailyTagsListener();
    recordLoginAppearance();
    elements.loginHint.textContent = "";
    closeCodeModal();
    renderSession();
    render();
    return;
  }

  if (code.length !== 6) {
    elements.codeModalMessage.textContent = "Code non valide.";
    return;
  }

  const userQuery = query(collection(db, "users"), where("accessCode", "==", code));
  const snapshot = await new Promise((resolve, reject) => {
    const unsubscribe = onSnapshot(userQuery, (value) => {
      unsubscribe();
      resolve(value);
    }, reject);
  }).catch((error) => {
    elements.codeModalMessage.textContent = error.message;
    return null;
  });

  if (!snapshot || snapshot.empty) {
    elements.codeModalMessage.textContent = "Code non valide.";
    return;
  }

  const doc = snapshot.docs[0];
  const data = doc.data();
  state.currentUser = {
    id: stringValue(data.iCloudIdentifier, doc.id),
    documentID: doc.id,
    firstName: stringValue(data.firstName),
    lastName: stringValue(data.lastName),
    role: stringValue(data.roleRawValue, "consultation"),
    team: stringValue(data.teamRawValue)
  };
  saveSession(state.currentUser);
  state.lastLoginEventAt = 0;
  restartDailyTagsListener();
  recordLoginAppearance();
  elements.loginHint.textContent = "";
  closeCodeModal();
  renderSession();
  render();
}

function restoreSavedSession() {
  const savedSession = readSavedSession();
  if (!savedSession) {
    return;
  }

  state.currentUser = savedSession.user;
  state.lastLoginEventAt = 0;
  restartDailyTagsListener();
  recordLoginAppearance();
  elements.loginHint.textContent = "Session restaurée sur cette machine.";
}

function saveSession(user) {
  localStorage.setItem(sessionStorageKey, JSON.stringify({
    savedAt: Date.now(),
    user
  }));
}

function readSavedSession() {
  try {
    const raw = localStorage.getItem(sessionStorageKey);
    if (!raw) {
      return null;
    }

    const session = JSON.parse(raw);
    if (!session?.user || Date.now() - Number(session.savedAt || 0) > sessionDurationMs) {
      clearSavedSession();
      return null;
    }

    return session;
  } catch {
    clearSavedSession();
    return null;
  }
}

function clearSavedSession() {
  localStorage.removeItem(sessionStorageKey);
}

async function recordLoginAppearance() {
  if (!state.authReady || state.currentUser?.role === "admin" || document.visibilityState === "hidden") {
    return;
  }

  const now = Date.now();
  if (now - state.lastLoginEventAt < 1000) {
    return;
  }

  state.lastLoginEventAt = now;
  const id = globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${now}-${Math.random().toString(36).slice(2)}`;
  const createdAt = new Date(now);
  const userIdentifier = state.currentUser?.id || "WEB_ANONYMOUS";
  const userDisplayName = state.currentUser ? currentDisplayName() : "Web non connecté";

  await setDoc(doc(db, "loginEvents", id), {
    id,
    userIdentifier,
    userDisplayName,
    source: "web",
    dayIdentifier: isoDate(createdAt),
    createdAt
  }).catch((error) => {
    setStatus(error.message);
  });
}

function attachFirebaseListeners() {
  if (!state.unsubscribeNotes) {
    state.unsubscribeNotes = onSnapshot(collection(db, "handoverNotes"), (snapshot) => {
      state.notes = snapshot.docs.map((doc) => noteFromSnapshot(doc.id, doc.data()));
      setStatus("Données synchronisées");
      render();
    }, (error) => setStatus(error.message));
  }

  if (!state.unsubscribeHandwritingNotes) {
    state.unsubscribeHandwritingNotes = onSnapshot(collection(db, "handwritingNotes"), (snapshot) => {
      state.handwritingNotes = snapshot.docs
        .map((doc) => handwritingNoteFromSnapshot(doc.id, doc.data()))
        .sort((a, b) => (b.updatedAt?.getTime() || 0) - (a.updatedAt?.getTime() || 0));
      setStatus("Données synchronisées");
      render();
    }, (error) => setStatus(error.message));
  }

  if (!state.unsubscribeUsers) {
    state.unsubscribeUsers = onSnapshot(collection(db, "users"), (snapshot) => {
      state.users = deduplicatedUsers(snapshot.docs
        .map((document) => userFromSnapshot(document.id, document.data())))
        .sort((a, b) => currentDisplayNameForUser(a).localeCompare(currentDisplayNameForUser(b), "fr"));
      renderAdminSettings();
    }, (error) => setStatus(error.message));
  }

  if (!state.unsubscribeSimulators) {
    state.unsubscribeSimulators = onSnapshot(collection(db, "simulators"), (snapshot) => {
      state.allSimulators = deduplicatedSimulators(snapshot.docs
        .map((doc) => simulatorFromSnapshot(doc.id, doc.data())))
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "fr"));
      state.simulators = state.allSimulators
        .filter((simulator) => !simulator.isHidden && simulator.name !== generalName);
      renderSimulators();
      renderAdminSettings();
      render();
    }, (error) => setStatus(error.message));
  }
}

function restartDailyTagsListener() {
  if (state.unsubscribeDailyTags) {
    state.unsubscribeDailyTags();
    state.unsubscribeDailyTags = null;
  }

  state.dailyTags = [];
  if (!state.authReady || !state.currentUser?.id) {
    render();
    return;
  }

  const tagsQuery = query(collection(db, "dailyTags"), where("userIdentifier", "==", state.currentUser.id));
  state.unsubscribeDailyTags = onSnapshot(tagsQuery, (snapshot) => {
    state.dailyTags = snapshot.docs
      .map((document) => dailyTagFromSnapshot(document.id, document.data()))
      .filter(Boolean);
    render();
  }, (error) => setStatus(error.message));
}

function renderSession() {
  const isLoggedIn = Boolean(state.currentUser);
  elements.loginPanel.classList.toggle("hidden", isLoggedIn);
  elements.userPanel.classList.toggle("hidden", !isLoggedIn);
  const canViewDeleted = canCurrentUserViewDeletedNotes();
  elements.showDeletedRow.classList.toggle("hidden", !canViewDeleted);
  if (!canViewDeleted && state.showDeleted) {
    state.showDeleted = false;
  }

  if (!state.currentUser) {
    elements.adminSettingsButton.classList.add("hidden");
    elements.changeCodeButton.classList.add("hidden");
    elements.userMenu.classList.add("hidden");
    elements.pageSubtitle.textContent = `${formatLongDate(state.selectedDate)} · Consultation`;
    return;
  }

  const displayName = [state.currentUser.firstName, state.currentUser.lastName].filter(Boolean).join(" ");
  elements.userName.textContent = displayName || state.currentUser.id;
  elements.userMeta.innerHTML = userRoleMetaHTML(state.currentUser.role, state.currentUser.team);
  elements.changeCodeButton.classList.toggle("hidden", state.currentUser.role === "admin");
  elements.adminSettingsButton.classList.toggle("hidden", state.currentUser.role !== "admin");
  elements.pageSubtitle.textContent = `${formatLongDate(state.selectedDate)} · ${displayName || state.currentUser.id}`;
}

function render() {
  renderSession();
  const filtersDisabled = Boolean(state.periodStartDate);
  elements.showTaggedToggle.checked = state.showTagged;
  elements.showAcknowledgedToggle.checked = state.showAcknowledged;
  elements.showDeletedToggle.checked = state.showDeleted;
  elements.showTaggedToggle.disabled = filtersDisabled;
  elements.showAcknowledgedToggle.disabled = filtersDisabled;
  elements.showDeletedToggle.disabled = filtersDisabled;
  elements.searchInput.parentElement.classList.toggle("search-active", Boolean(state.search));
  elements.clearSearchButton.classList.toggle("hidden", !state.search);
  renderCalendar();
  renderTeamPresences();
  renderSimulators();

  const groups = groupedNotes();
  elements.noteGroups.innerHTML = groups.map(renderGroup).join("");
  elements.emptyState.classList.toggle("hidden", groups.length > 0);
  elements.pageTitle.textContent = "";
  if (!state.currentUser) {
    elements.pageSubtitle.textContent = `${pageSubtitleDate()} · Consultation${state.search ? " · Recherche" : ""}`;
  } else {
    elements.pageSubtitle.textContent = `${pageSubtitleDate()}${state.search ? " · Recherche" : ""}`;
  }

  refreshDetail();
}

function prepareCenteredSimulatorBandAnchor() {
  pendingCenteredSimulatorBandAnchor = captureCenteredSimulatorBandAnchor();
}

function takePendingCenteredSimulatorBandAnchor() {
  const anchor = pendingCenteredSimulatorBandAnchor;
  pendingCenteredSimulatorBandAnchor = null;
  return anchor;
}

function renderPreservingCenteredSimulatorBand(preparedAnchor = null) {
  const anchor = preparedAnchor || captureCenteredSimulatorBandAnchor();
  render();
  restoreCenteredSimulatorBandAnchor(anchor);
}

function captureCenteredSimulatorBandAnchor() {
  if (!elements.noteGroups) {
    return null;
  }

  const viewportCenter = window.innerHeight / 2;
  const headers = Array.from(elements.noteGroups.querySelectorAll(".simu-group[data-simulator-name] .simu-header"));
  const orderedHeaders = headers
    .map((header) => {
      const rect = header.getBoundingClientRect();
      const group = header.closest(".simu-group[data-simulator-name]");
      return {
        header,
        group,
        rect,
        distanceFromCenter: Math.abs(rect.top + rect.height / 2 - viewportCenter)
      };
    })
    .filter((candidate) => candidate.group)
    .sort((first, second) => first.distanceFromCenter - second.distanceFromCenter);

  const visibleAnchor = orderedHeaders.find((candidate) => {
    return candidate.rect.bottom >= 0 && candidate.rect.top <= window.innerHeight;
  });
  const anchor = visibleAnchor || orderedHeaders[0];
  if (!anchor?.group) {
    return null;
  }

  return {
    simulatorName: anchor.group.dataset.simulatorName || "",
    offsetFromViewportTop: anchor.rect.top
  };
}

function restoreCenteredSimulatorBandAnchor(anchor) {
  if (!anchor?.simulatorName || !elements.noteGroups) {
    return;
  }

  const restore = () => {
    const group = elements.noteGroups.querySelector(`.simu-group[data-simulator-name="${cssEscape(anchor.simulatorName)}"]`);
    const header = group?.querySelector(".simu-header");
    if (!header) {
      return;
    }

    const currentTop = header.getBoundingClientRect().top;
    const delta = currentTop - anchor.offsetFromViewportTop;
    if (Math.abs(delta) > 1) {
      window.scrollTo({ top: window.scrollY + delta, behavior: "auto" });
    }
  };

  window.requestAnimationFrame(() => {
    restore();
    window.requestAnimationFrame(restore);
  });
  window.setTimeout(restore, 80);
  window.setTimeout(restore, 180);
}

function renderSimulators() {
  const items = [{ name: generalName, colorHex: "#111827" }, ...state.simulators];
  renderSimulatorShortcuts(items);

  if (elements.simulatorList) {
    elements.simulatorList.innerHTML = items.map((simulator) => `
      <div class="simulator-chip">
        <span class="simulator-dot" style="background:${escapeAttribute(simulator.colorHex)}"></span>
        <span>${escapeHtml(simulator.name)}</span>
      </div>
    `).join("");
  }
}

function renderSimulatorShortcuts(items) {
  elements.simulatorShortcutGrid.innerHTML = items.map((simulator) => `
    <button
      type="button"
      class="simulator-shortcut"
      style="--shortcut-color:${escapeAttribute(simulator.colorHex)}"
      data-scroll-simulator="${escapeAttribute(encodeURIComponent(simulator.name))}"
      title="${escapeAttribute(simulator.name)}"
    >
      ${escapeHtml(simulator.name)}
    </button>
  `).join("");
}

function scrollToSimulator(name) {
  const encodedName = encodeURIComponent(name);
  const group = elements.noteGroups.querySelector(`[data-simulator-name="${cssEscape(encodedName)}"]`);
  if (!group) {
    setStatus(`Aucune consigne affichée pour ${name}`);
    return;
  }

  const top = group.getBoundingClientRect().top + window.scrollY - 10;
  document.documentElement.style.scrollBehavior = "auto";
  document.body.style.scrollBehavior = "auto";
  window.scrollTo(0, top);
}

function renderTeamPresences() {
  const presences = teamPresences(state.selectedDate);
  elements.teamPresenceList.innerHTML = presences.length
    ? presences.map((presence) => `
      <div class="team-presence-row">
        <span>${escapeHtml(presence.team.title)}</span>
        <span class="shift-pill ${escapeAttribute(presence.shift.id)}">${escapeHtml(presence.shift.title)}</span>
      </div>
    `).join("")
    : "<p class=\"hint\">Aucune équipe présente.</p>";
}

function beginPeriodSelection(date) {
  const start = startOfDay(date);
  state.search = "";
  state.showTagged = false;
  state.showAcknowledged = false;
  state.showDeleted = false;
  state.periodStartDate = start;
  state.periodEndDate = null;
  state.isSelectingPeriodEnd = true;
  state.selectedDate = start;
  state.visibleMonth = startOfMonth(start);
  elements.selectedDate.value = isoDate(start);
  elements.searchInput.value = "";
  render();
}

function finishPeriodSelection(date) {
  const end = startOfDay(date);
  if (!state.periodStartDate || sameDay(end, state.periodStartDate)) {
    return;
  }

  state.periodEndDate = end;
  state.isSelectingPeriodEnd = false;
  state.selectedDate = end;
  state.visibleMonth = startOfMonth(end);
  elements.selectedDate.value = isoDate(end);
  render();
}

function clearPeriodMode() {
  state.periodStartDate = null;
  state.periodEndDate = null;
  state.isSelectingPeriodEnd = false;
}

function goToToday() {
  state.selectedDate = startOfDay(new Date());
  state.visibleMonth = startOfMonth(state.selectedDate);
  clearPeriodMode();
  elements.selectedDate.value = isoDate(state.selectedDate);
  renderPreservingCenteredSimulatorBand();
}

function resetDisplayState() {
  state.selectedDate = startOfDay(new Date());
  state.visibleMonth = startOfMonth(state.selectedDate);
  state.search = "";
  state.showTagged = false;
  state.showAcknowledged = false;
  state.showDeleted = false;
  clearPeriodMode();

  elements.selectedDate.value = isoDate(state.selectedDate);
  elements.searchInput.value = "";
  elements.userMenu.classList.add("hidden");
  render();
  requestAnimationFrame(() => window.scrollTo(0, 0));
}

function selectedPeriodRange() {
  if (!state.periodStartDate) {
    return null;
  }

  if (!state.periodEndDate) {
    return { start: state.periodStartDate, end: state.periodStartDate };
  }

  return {
    start: state.periodStartDate <= state.periodEndDate ? state.periodStartDate : state.periodEndDate,
    end: state.periodStartDate <= state.periodEndDate ? state.periodEndDate : state.periodStartDate
  };
}

function isPeriodResultsMode() {
  return Boolean(state.periodStartDate && state.periodEndDate && !state.isSelectingPeriodEnd);
}

function isDateInPeriod(date) {
  const range = selectedPeriodRange();
  return Boolean(range && startOfDay(date) >= range.start && startOfDay(date) <= range.end);
}

function periodTitle() {
  const range = selectedPeriodRange();
  if (state.isSelectingPeriodEnd && range) {
    return "Choisir la date de fin";
  }

  if (!isPeriodResultsMode()) {
    return "";
  }

  return `${formatLongDate(range.start)} - ${formatLongDate(range.end)}`;
}

function pageSubtitleDate() {
  if (state.isSelectingPeriodEnd && state.periodStartDate) {
    return `Début : ${formatLongDate(state.periodStartDate)}`;
  }

  return periodTitle() || formatLongDate(state.selectedDate);
}

function renderCalendar() {
  elements.calendarMonth.textContent = new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric"
  }).format(state.visibleMonth);

  const firstDay = startOfMonth(state.visibleMonth);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const gridStart = addDays(firstDay, -startOffset);
  const noteDates = new Set(state.notes
    .filter((note) => shouldShowDeletedNote(note))
    .map((note) => isoDate(note.displayDate)));

  elements.calendarGrid.innerHTML = Array.from({ length: 42 }, (_, index) => {
    const date = addDays(gridStart, index);
    const isCurrentMonth = date.getMonth() === state.visibleMonth.getMonth();
    const isSelected = sameDay(date, state.selectedDate);
    const isToday = sameDay(date, new Date());
    const hasNotes = noteDates.has(isoDate(date));
    const range = selectedPeriodRange();
    const isPeriodStart = range && sameDay(date, range.start);
    const isPeriodEnd = range && sameDay(date, range.end);
    const isInPeriod = range && date >= range.start && date <= range.end;

    return `
      <button
        type="button"
        class="calendar-day${isCurrentMonth ? "" : " muted-day"}${isSelected && !isInPeriod ? " selected" : ""}${isToday ? " today" : ""}${hasNotes ? " has-notes" : ""}${isInPeriod ? " period-day" : ""}${isPeriodStart ? " period-start" : ""}${isPeriodEnd ? " period-end" : ""}${state.isSelectingPeriodEnd && isPeriodStart ? " period-pending" : ""}"
        data-date="${isoDate(date)}"
        aria-label="${formatLongDate(date)}"
      >
        <span>${date.getDate()}</span>
      </button>
    `;
  }).join("");

  elements.calendarGrid.querySelectorAll(".calendar-day").forEach((button) => {
    let longPressTimer = null;
    let didLongPress = false;
    const buttonDate = () => parseDateInput(button.dataset.date);

    button.addEventListener("contextmenu", (event) => {
      event.preventDefault();
    });

    button.addEventListener("pointerdown", () => {
      didLongPress = false;
      longPressTimer = window.setTimeout(() => {
        didLongPress = true;
        beginPeriodSelection(buttonDate());
      }, 550);
    });

    ["pointerup", "pointerleave", "pointercancel"].forEach((eventName) => {
      button.addEventListener(eventName, () => {
        if (longPressTimer) {
          window.clearTimeout(longPressTimer);
          longPressTimer = null;
        }
      });
    });

    button.addEventListener("click", () => {
      if (didLongPress) {
        didLongPress = false;
        return;
      }

      const date = buttonDate();
      if (state.isSelectingPeriodEnd) {
        finishPeriodSelection(date);
        return;
      }

      state.selectedDate = date;
      state.visibleMonth = startOfMonth(date);
      clearPeriodMode();
      elements.selectedDate.value = isoDate(state.selectedDate);
      renderPreservingCenteredSimulatorBand();
    });
  });
}

function groupedNotes() {
  const matchingNotes = state.notes
    .filter((note) => matchesSearch(note))
    .sort(isPeriodResultsMode() ? comparePeriodNotes : compareNotes);

  const simulators = [{ name: generalName, colorHex: "#111827", sortOrder: -1 }, ...state.simulators];
  const groups = [];

  for (const simulator of simulators) {
    const contextNotes = matchingNotes.filter((note) => noteBelongsToContext(note, simulator.name));
    const acknowledgedHiddenCount = state.search || state.showAcknowledged ? 0 : contextNotes.filter((note) => {
      return matchesSelection(note, simulator.name, { includeAcknowledged: true })
        && isAcknowledgedHidden(note, simulator.name);
    }).length;
    const deletedHiddenCount = !canCurrentUserViewDeletedNotes() || state.search || state.showDeleted ? 0 : contextNotes.filter((note) => {
      return note.deletedAt
        && canCurrentUserViewDeletedNote(note)
        && matchesSelection(note, simulator.name, { includeDeleted: true });
    }).length;
    const taggedCount = contextNotes.filter((note) => {
      return matchesTaggedFilter(note, simulator.name)
        && matchesSelection(note, simulator.name, { includeTaggedFilter: false, includeAcknowledged: true });
    }).length;
    const notes = contextNotes.filter((note) => {
      const belongsToContext = noteBelongsToContext(note, simulator.name);
      return belongsToContext && matchesSelection(note, simulator.name);
    });

    const shouldRenderGroup = state.search || isPeriodResultsMode()
      ? notes.length > 0
      : true;

    if (shouldRenderGroup) {
      groups.push({ simulator, notes, acknowledgedHiddenCount, deletedHiddenCount, taggedCount });
    }
  }

  return groups;
}

function renderGroup(group) {
  const countLabel = `${group.notes.length} consigne${group.notes.length > 1 ? "s" : ""}`;
  return `
    <section
      class="simu-group"
      style="--group-color:${escapeAttribute(group.simulator.colorHex)}"
      data-simulator-name="${escapeAttribute(encodeURIComponent(group.simulator.name))}"
    >
      <header class="simu-header">
        <div class="simu-header-title">
          <strong>${escapeHtml(group.simulator.name)}</strong>
          <span>${countLabel}</span>
          ${group.taggedCount ? `<span class="simu-tag-count">${group.taggedCount}</span>` : ""}
          ${group.acknowledgedHiddenCount ? `<span class="simu-ack-count">${group.acknowledgedHiddenCount}</span>` : ""}
          ${group.deletedHiddenCount ? `<span class="simu-deleted-count">${group.deletedHiddenCount}</span>` : ""}
        </div>
        <button
          class="simu-add-button"
          type="button"
          title="Ajouter une consigne"
          data-add-context="${escapeAttribute(encodeURIComponent(group.simulator.name))}"
        >+</button>
      </header>
      ${group.notes.length
        ? group.notes.map((note) => renderNote(note, group.simulator.name)).join("")
        : '<div class="simu-empty-card">Aucune consigne pour cette journée.</div>'}
    </section>
  `;
}

function renderNote(note, context) {
  const priorityClass = note.priority ? `priority-${note.priority}` : "";
  const priorityStyle = note.priority ? ` style="--priority-color:${priorityColor(note.priority)};--priority-bg:${priorityBackground(note.priority)}"` : "";
  const title = highlight(note.title);
  const text = highlight(note.text);
  const newBadge = isNew(note);
  const carryOver = carryOverDayCount(note);
  const modificationTitle = modificationBadgeTitle(note, context, newBadge, carryOver);
  const showsModificationNew = modificationTitle === "NEW";
  const done = isDoneBadgeVisibleInContext(note, context);
  const acknowledged = !done && isAcknowledgedInContext(note, context) && !hasContentModificationAfterAcknowledgement(note, context);
  const handwriting = visibleHandwritingFor(note);
  const isTagged = isDailyTagged(note.id);
  const ageBadge = newBadge
    ? renderNewAgeBadge(note.id, isTagged)
    : carryOver && !state.search
      ? renderAgeBadge(note.id, carryOver, modificationTitle, isTagged)
      : "";
  const badges = [
    note.priority ? `<span class="badge priority">${priorityLabel(note.priority)}</span>` : ""
  ].filter(Boolean).join("");
  const statusBadge = done
    ? renderStatusBadge("done", "Soldé")
    : acknowledged
      ? renderStatusBadge("ack", "Pris en compte")
      : "";
  const periodDate = isPeriodResultsMode()
    ? `<div class="period-note-date">${escapeHtml(formatLongDate(noteSortingActivityDate(note)))}</div>`
    : "";

  return `
    <article
      class="note-card ${priorityClass}${ageBadge ? " has-age-badge" : ""}${done ? " done-card" : ""}${note.deletedAt ? " deleted-card" : ""}${carryOver && !newBadge && !note.priority ? " carryover-card" : ""}"
      ${priorityStyle}
      data-note-id="${escapeAttribute(note.id)}"
      data-context="${escapeAttribute(encodeURIComponent(context))}"
    >
      <div class="badges">${badges}</div>
      ${ageBadge}
      ${note.title ? `<h2 class="note-title">${title}</h2>` : ""}
      ${note.text ? `<div class="note-text rich-text-preview">${richTextPreviewHTML(note)}</div>` : note.title ? "" : "<p class=\"note-text muted\">Note manuscrite</p>"}
      ${handwriting ? renderHandwritingCardPreview(handwriting) : ""}
      ${statusBadge}
      ${periodDate}
    </article>
  `;
}

function noteFromSnapshot(id, data) {
  const displayDate = startOfDay(dateValue(data.displayDate) || dateValue(data.createdAt) || new Date());
  const completions = decodeRecordArray(data.completionHistoryData);
  const revisions = decodeRecordArray(data.revisionHistoryData);
  const acknowledgements = decodeRecordArray(data.acknowledgementHistoryData);
  return {
    id,
    title: stringValue(data.title),
    text: stringValue(data.text),
    author: stringValue(data.author),
    authorIdentifier: stringValue(data.authorIdentifier),
    createdAt: dateValue(data.createdAt),
    updatedAt: dateValue(data.updatedAt),
    contentModifiedAt: dateValue(data.contentModifiedAt),
    deletedAt: dateValue(data.deletedAt),
    deletedBy: stringValue(data.deletedBy),
    deletedByIdentifier: stringValue(data.deletedByIdentifier),
    displayDate,
    firstDisplayDate: startOfDay(dateValue(data.firstDisplayDate) || displayDate),
    isGeneral: Boolean(data.isGeneral),
    simulatorNames: stringValue(data.simulatorNamesStorage).split("\n").map((name) => name.trim()).filter(Boolean),
    priority: stringValue(data.priorityRawValue),
    handwritingData: stringValue(data.handwritingData),
    handwritingPreviewImageData: stringValue(data.handwritingPreviewImageData),
    richTextData: stringValue(data.richTextData),
    richTextHTML: sanitizeRichTextHTML(stringValue(data.richTextHTML)),
    handwritingAuthorIdentifier: stringValue(data.handwritingAuthorIdentifier),
    completedContexts: stringValue(data.completedContextsStorage).split("\n").map((name) => name.trim()).filter(Boolean),
    completions,
    revisions,
    acknowledgements
  };
}

function openDetail(noteId, context) {
  state.selectedCreate = null;
  state.pendingHandwritingClear = null;
  state.selectedDetail = { noteId, context };
  refreshDetail();
}

function openCreate(context) {
  if (!canCurrentUserWrite()) {
    setStatus("Connexion requise pour créer une consigne");
    return;
  }

  state.selectedDetail = null;
  state.selectedCreate = { context };
  renderCreate(context);
}

function closeDetail() {
  const hadPendingHandwritingClear = Boolean(state.pendingHandwritingClear);
  state.selectedDetail = null;
  state.selectedCreate = null;
  state.pendingHandwritingClear = null;
  elements.detailOverlay.classList.add("hidden");
  elements.detailOverlay.setAttribute("aria-hidden", "true");
  closeCreationTextModal();
  if (hadPendingHandwritingClear) {
    setStatus("Suppression manuscrite annulée");
    render();
  }
}

function openCreationTextModal(text, dateLabel) {
  elements.creationTextDate.textContent = dateLabel;
  renderCreationTextActions("");
  elements.creationTextContent.textContent = text || "Aucun texte.";
  elements.creationTextContent.classList.remove("revision-diff");
  elements.creationTextOverlay.classList.remove("hidden");
  elements.creationTextOverlay.setAttribute("aria-hidden", "false");
}

function openRevisionTextModal({ dateLabel, html, canUndo = false }) {
  elements.creationTextDate.textContent = dateLabel;
  renderCreationTextActions(canUndo
    ? `<button
        type="button"
        class="revision-delete-button"
        data-creation-text-action="undo-latest-modification"
        title="Annuler la dernière modification"
        aria-label="Annuler la dernière modification"
        style="display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;min-width:34px;min-height:34px;padding:0;border:0;border-radius:999px;background:#ef4444;color:#fff;line-height:1;box-shadow:none;"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" style="width:17px;height:17px;display:block;fill:currentColor;">
          <path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-1 6h2v10h4V9h2v12H8V9Zm3 0h2v9h-2V9Z"></path>
        </svg>
      </button>`
    : "");
  elements.creationTextContent.innerHTML = html || "Aucun texte.";
  elements.creationTextContent.classList.add("revision-diff");
  elements.creationTextOverlay.classList.remove("hidden");
  elements.creationTextOverlay.setAttribute("aria-hidden", "false");
}

function renderCreationTextActions(html) {
  if (!elements.creationTextActions) {
    const meta = elements.creationTextOverlay.querySelector(".creation-text-meta");
    const metaRow = document.createElement("div");
    metaRow.className = "creation-text-meta-row";
    meta?.before(metaRow);
    if (meta) {
      metaRow.appendChild(meta);
    }

    elements.creationTextActions = document.createElement("div");
    elements.creationTextActions.className = "creation-text-actions";
    elements.creationTextActions.id = "creationTextActions";
    metaRow.appendChild(elements.creationTextActions);
  }

  elements.creationTextActions.innerHTML = html;
}

function openSelectedCreationTextModal() {
  if (!state.selectedDetail) {
    return;
  }

  const note = state.notes.find((candidate) => candidate.id === state.selectedDetail.noteId);
  if (!note) {
    return;
  }

  openCreationTextModal(creationTextForNote(note), formatTimelineDate(note.createdAt || note.firstDisplayDate || note.displayDate));
}

function creationTextForNote(note) {
  return note.revisions.find((revision) => stringValue(revision.text).trim())?.text
    || combinedNoteText(note.title, note.text);
}

function closeCreationTextModal() {
  elements.creationTextOverlay.classList.add("hidden");
  elements.creationTextOverlay.setAttribute("aria-hidden", "true");
  elements.creationTextDate.textContent = "";
  renderCreationTextActions("");
  elements.creationTextContent.textContent = "";
  elements.creationTextContent.classList.remove("revision-diff");
}

function refreshDetail() {
  if (!state.selectedDetail) {
    return;
  }

  const note = state.notes.find((candidate) => candidate.id === state.selectedDetail.noteId);
  if (!note) {
    closeDetail();
    return;
  }

  renderDetail(note, state.selectedDetail.context);
}

function renderCreate(context) {
  const canWrite = canCurrentUserWrite();
  const draftNote = {
    isGeneral: context === generalName,
    simulatorNames: context === generalName ? [] : [context],
    priority: "",
    displayDate: state.selectedDate
  };

  elements.detailTitle.textContent = context;
  elements.detailContext.textContent = "Nouvelle consigne";
  elements.detailBody.innerHTML = `
    <section class="detail-section priority-section">
      <h3>Priorite</h3>
      <div class="priority-picker" role="radiogroup" aria-label="Priorité">
        ${renderPriorityOption("", "Info", true, canWrite)}
        ${renderPriorityOption("urgent", "Urgent", false, canWrite)}
        ${renderPriorityOption("soon", "A traiter rapidement", false, canWrite)}
        ${renderPriorityOption("whenever", "ASAP", false, canWrite)}
        <select id="detailEditPriority" ${canWrite ? "" : "disabled"} aria-hidden="true" tabindex="-1">
          <option value="" selected>Info</option>
          <option value="urgent">Urgent</option>
          <option value="soon">A traiter rapidement</option>
          <option value="whenever">ASAP</option>
        </select>
      </div>
    </section>

    <input id="detailEditDate" type="hidden" value="${isoDate(state.selectedDate)}">

    <section class="detail-section consigne-section">
      <div class="detail-section-title-row">
        <h3>Consigne</h3>
        ${renderFormatToolbar()}
      </div>
      <div class="consigne-editor create-editor">
        <input id="detailEditTitle" class="title-input" placeholder="Titre" ${canWrite ? "" : "disabled"}>
        ${renderRichTextEditor("", "", canWrite)}
      </div>
    </section>

    <section class="detail-section simulator-section">
      <h3>Simulateur(s) concerné(s)</h3>
      <div class="simulator-toggle-list">
        ${renderSimulatorToggles(draftNote, { editable: canWrite })}
      </div>
    </section>
  `;
  bindPriorityPicker(canWrite);
  bindSimulatorToggles();
  bindRichTextToolbar(canWrite);
  elements.detailOverlay.classList.remove("hidden");
  elements.detailOverlay.setAttribute("aria-hidden", "false");
}

function renderDetail(note, context) {
  const done = isDoneInContext(note, context);
  const acknowledged = !done && isAcknowledgedInContext(note, context) && !hasContentModificationAfterAcknowledgement(note, context);
  const title = note.title.trim() || "Consigne";
  const timeline = timelineEvents(note, context);
  state.detailTimelineEvents = timeline;
  const canWrite = canCurrentUserWrite();
  const canEditDate = canCurrentUserEditDate();
  const canToggleDone = canWrite;
  const canToggleAcknowledgement = canWrite && !done && !note.priority && !isNew(note);
  const canDelete = canCurrentUserDeleteNote(note);
  const handwriting = visibleHandwritingFor(note);

  elements.detailTitle.textContent = context;
  elements.detailContext.textContent = context;
  elements.detailBody.innerHTML = `
    <div class="detail-action-row">
      <button
        class="secondary action-done${done ? " active-done" : ""}"
        data-detail-action="toggle-done"
        data-initial-state="${done ? "true" : "false"}"
        data-draft-state="${done ? "true" : "false"}"
        ${canToggleDone ? "" : "disabled"}
      ><span class="action-icon">✓</span>${done ? "Annuler Soldé" : "SOLDER"}</button>
      <button
        class="secondary action-ack${acknowledged ? " active-ack" : ""}"
        data-detail-action="toggle-ack"
        data-initial-state="${acknowledged ? "true" : "false"}"
        data-draft-state="${acknowledged ? "true" : "false"}"
        data-can-toggle="${canToggleAcknowledgement ? "true" : "false"}"
        ${canToggleAcknowledgement ? "" : "disabled"}
      ><span class="action-icon">✧</span>${acknowledged ? "Annuler prise en compte" : "Pris en compte"}</button>
      ${canDelete ? `
        <button class="secondary danger action-delete" data-detail-action="delete-note">
          <span class="action-icon">⌫</span>${note.deletedAt ? "Restaurer" : "Supprimer"}
        </button>
      ` : ""}
    </div>
    ${detailActionHint(note, done, canWrite, canToggleAcknowledgement)}

    <section class="detail-section priority-section">
      <h3>Priorite</h3>
      <div class="priority-picker" role="radiogroup" aria-label="Priorité">
        ${renderPriorityOption("", "Info", !note.priority, canWrite)}
        ${renderPriorityOption("urgent", "Urgent", note.priority === "urgent", canWrite)}
        ${renderPriorityOption("soon", "A traiter rapidement", note.priority === "soon", canWrite)}
        ${renderPriorityOption("whenever", "ASAP", note.priority === "whenever", canWrite)}
        <select id="detailEditPriority" ${canWrite ? "" : "disabled"} aria-hidden="true" tabindex="-1">
          <option value="" ${!note.priority ? "selected" : ""}>Info</option>
          <option value="urgent" ${note.priority === "urgent" ? "selected" : ""}>Urgent</option>
          <option value="soon" ${note.priority === "soon" ? "selected" : ""}>A traiter rapidement</option>
          <option value="whenever" ${note.priority === "whenever" ? "selected" : ""}>ASAP</option>
        </select>
      </div>
    </section>

    <section class="detail-section date-section">
      <h3>Date</h3>
      ${renderDateLine("detailEditDate", note.displayDate, canEditDate)}
    </section>

    <section class="detail-section consigne-section">
      <div class="detail-section-title-row">
        <h3>Consigne</h3>
        ${renderFormatToolbar()}
      </div>
      <div class="consigne-editor">
        <input id="detailEditTitle" class="title-input" value="${escapeAttribute(note.title)}" placeholder="Titre" ${canWrite ? "" : "disabled"}>
        ${renderRichTextEditor(note.text, note.richTextHTML, canWrite)}
        <div class="handwriting-divider"></div>
        <h4>Note Manuscrite</h4>
        ${renderHandwritingSection(note, handwriting)}
      </div>
    </section>

    <section class="detail-section">
      <h3>Suivi</h3>
      <div class="timeline">
        ${timeline.map((event, index) => renderTimelineEvent(event, index)).join("") || "<p class=\"detail-text muted\">Aucun suivi.</p>"}
      </div>
    </section>

    <section class="detail-section simulator-section">
      <h3>Simulateur(s) concerné(s)</h3>
      <div class="simulator-toggle-list">
        ${renderSimulatorToggles(note, { editable: canWrite })}
      </div>
    </section>
  `;
  bindPriorityPicker(canWrite);
  bindDateLine();
  bindSimulatorToggles();
  bindRichTextToolbar(canWrite);
  elements.detailOverlay.classList.remove("hidden");
  elements.detailOverlay.setAttribute("aria-hidden", "false");
}

function toggleDraftDoneButton(button) {
  if (!button || button.disabled) {
    return;
  }

  const nextState = button.dataset.draftState !== "true";
  button.dataset.draftState = nextState ? "true" : "false";
  button.classList.toggle("active-done", nextState);
  button.innerHTML = `<span class="action-icon">✓</span>${nextState ? "Annuler Soldé" : "SOLDER"}`;

  const acknowledgementButton = elements.detailBody.querySelector('[data-detail-action="toggle-ack"]');
  if (nextState && acknowledgementButton) {
    acknowledgementButton.dataset.draftState = "false";
    acknowledgementButton.classList.remove("active-ack");
    acknowledgementButton.innerHTML = '<span class="action-icon">✧</span>Pris en compte';
    acknowledgementButton.disabled = true;
  } else if (acknowledgementButton?.dataset.canToggle === "true") {
    acknowledgementButton.disabled = false;
  }
}

function toggleDraftAcknowledgementButton(button) {
  if (!button || button.disabled) {
    return;
  }

  const nextState = button.dataset.draftState !== "true";
  button.dataset.draftState = nextState ? "true" : "false";
  button.classList.toggle("active-ack", nextState);
  button.innerHTML = `<span class="action-icon">✧</span>${nextState ? "Annuler prise en compte" : "Pris en compte"}`;
}

function bindPriorityPicker(canWrite) {
  elements.detailBody.querySelectorAll("[data-priority-value]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!canWrite) return;
      const select = elements.detailBody.querySelector("#detailEditPriority");
      select.value = button.dataset.priorityValue;
      elements.detailBody.querySelectorAll("[data-priority-value]").forEach((candidate) => {
        candidate.classList.toggle("selected", candidate === button);
      });
    });
  });
}

function bindSimulatorToggles() {
  const toggles = [...elements.detailBody.querySelectorAll("[data-simulator-name]")];
  const generalToggle = toggles.find((input) => decodeURIComponent(input.dataset.simulatorName) === generalName);

  toggles.forEach((input) => {
    input.addEventListener("change", () => {
      const name = decodeURIComponent(input.dataset.simulatorName);
      if (name === generalName && input.checked) {
        toggles.forEach((candidate) => {
          if (candidate !== input) {
            candidate.checked = false;
          }
        });
      } else if (input.checked && generalToggle) {
        generalToggle.checked = false;
      }
    });
  });
}

function bindRichTextToolbar(canWrite) {
  const editor = elements.detailBody.querySelector("#detailEditText");
  const toolbar = elements.detailBody.querySelector(".format-toolbar");
  if (!editor || !toolbar) {
    return;
  }

  toolbar.querySelectorAll("[data-format-command]").forEach((button) => {
    button.disabled = !canWrite;
    button.addEventListener("click", () => {
      if (!canWrite) return;
      editor.focus();
      document.execCommand(button.dataset.formatCommand, false, null);
      normalizeEditorContent(editor);
    });
  });

  const highlightButton = toolbar.querySelector("[data-highlight-menu]");
  const highlightMenu = toolbar.querySelector(".highlight-menu");
  highlightButton.disabled = !canWrite;
  highlightButton.addEventListener("click", (event) => {
    event.stopPropagation();
    if (!canWrite) return;
    highlightMenu.classList.toggle("hidden");
  });

  highlightMenu.querySelectorAll("[data-highlight-color]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      if (!canWrite) return;
      editor.focus();
      applyEditorHighlight(button.dataset.highlightColor);
      highlightMenu.classList.add("hidden");
      normalizeEditorContent(editor);
    });
  });

  document.addEventListener("click", (event) => {
    if (!toolbar.contains(event.target)) {
      highlightMenu.classList.add("hidden");
    }
  }, { once: true });
}

function applyEditorHighlight(color) {
  if (color === "none") {
    document.execCommand("removeFormat", false, null);
    return;
  }

  const colors = {
    yellow: { background: "#ffd51f", foreground: null },
    blue: { background: "#2f80ed", foreground: "#ffffff" },
    green: { background: "#24c63b", foreground: "#ffffff" },
    red: { background: "#ef2f24", foreground: "#ffffff" }
  };
  const selected = colors[color];
  if (!selected) return;

  document.execCommand("backColor", false, selected.background);
  if (selected.foreground) {
    document.execCommand("foreColor", false, selected.foreground);
  }
}

function normalizeEditorContent(editor) {
  editor.querySelectorAll("font").forEach((font) => {
    const span = document.createElement("span");
    if (font.color) {
      span.style.color = font.color;
    }
    if (font.style.backgroundColor) {
      span.style.backgroundColor = font.style.backgroundColor;
    }
    span.innerHTML = font.innerHTML;
    font.replaceWith(span);
  });
}

function bindDateLine() {
  const input = elements.detailBody.querySelector("#detailEditDate");
  const display = elements.detailBody.querySelector(".date-display");
  if (!input || !display) {
    return;
  }

  elements.detailBody.querySelector("[data-date-trigger]")?.addEventListener("click", () => {
    if (typeof input.showPicker === "function") {
      input.showPicker();
    } else {
      input.focus();
      input.click();
    }
  });

  input.addEventListener("change", () => {
    display.textContent = formatLongDate(startOfDay(parseDateInput(input.value)));
  });
}

function renderPriorityOption(value, label, selected, enabled) {
  const className = `priority-option priority-${value || "info"}${selected ? " selected" : ""}`;
  return `
    <button
      type="button"
      class="${className}"
      data-priority-value="${escapeAttribute(value)}"
      ${enabled ? "" : "disabled"}
    >${escapeHtml(label)}</button>
  `;
}

function renderStatusBadge(type, label) {
  return `
    <span class="note-status-pill ${type}">
      <span class="note-status-icon">✓</span>
      <span>${escapeHtml(label)}</span>
    </span>
  `;
}

function renderFormatToolbar() {
  return `
    <div class="format-toolbar" aria-label="Mise en forme">
      <button type="button" data-format-command="bold" title="Gras"><strong>B</strong></button>
      <button type="button" data-format-command="italic" title="Italique"><span class="italic-icon">I</span></button>
      <button type="button" data-format-command="underline" title="Souligner"><span class="underline-icon">U</span></button>
      <button type="button" data-format-command="insertUnorderedList" title="Liste" aria-label="Liste">
        <svg class="toolbar-svg-icon list" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8 7h11M8 12h11M8 17h11"></path>
          <circle cx="5" cy="7" r="1.1"></circle>
          <circle cx="5" cy="12" r="1.1"></circle>
          <circle cx="5" cy="17" r="1.1"></circle>
        </svg>
      </button>
      <button type="button" data-highlight-menu title="Surligner" aria-label="Surligner">
        <svg class="toolbar-svg-icon highlighter" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M14.8 4.4 19.6 9.2 9.2 19.6H4.4v-4.8L14.8 4.4Z"></path>
          <path d="M13 6.2 17.8 11"></path>
          <path d="M4 21h16"></path>
        </svg>
      </button>
      <div class="highlight-menu hidden">
        <button type="button" data-highlight-color="none"><span class="highlight-swatch none"></span>Aucun</button>
        <hr>
        <button type="button" data-highlight-color="yellow"><span class="highlight-swatch yellow"></span>Jaune</button>
        <button type="button" data-highlight-color="blue"><span class="highlight-swatch blue"></span>Bleu</button>
        <button type="button" data-highlight-color="green"><span class="highlight-swatch green"></span>Vert</button>
        <button type="button" data-highlight-color="red"><span class="highlight-swatch red"></span>Rouge</button>
      </div>
    </div>
  `;
}

function renderRichTextEditor(text, richTextHTML, canWrite) {
  const html = richTextHTML || plainTextToRichHTML(text);
  return `
    <div
      id="detailEditText"
      class="rich-text-editor"
      contenteditable="${canWrite ? "true" : "false"}"
      data-placeholder="Saisir la consigne"
      role="textbox"
      aria-multiline="true"
    >${html}</div>
  `;
}

function plainTextToRichHTML(text) {
  return escapeHtml(text)
    .replace(/\n/g, "<br>");
}

function richTextPreviewHTML(note) {
  return note.richTextHTML ? note.richTextHTML.replace(/\n/g, "<br>") : plainTextToRichHTML(note.text);
}

function renderDateLine(inputID, date, editable) {
  return `
    <div class="date-line${editable ? " editable" : " readonly"}">
      <span>Date de la consigne</span>
      ${editable ? `
        <button type="button" class="date-picker-button" data-date-trigger="${escapeAttribute(inputID)}">
          <span class="date-display">${escapeHtml(formatLongDate(date))}</span>
        </button>
        <input id="${escapeAttribute(inputID)}" class="date-native-input" type="date" value="${isoDate(date)}">
      ` : `
        <strong class="date-display">${escapeHtml(formatLongDate(date))}</strong>
        <input id="${escapeAttribute(inputID)}" type="hidden" value="${isoDate(date)}">
      `}
    </div>
  `;
}

function renderSimulatorToggles(note, options = {}) {
  const editable = Boolean(options.editable);
  const simulatorRows = [
    { name: generalName, label: "Consigne generale" },
    ...state.allSimulators
      .filter((simulator) => simulator.name !== generalName && !simulator.isHidden)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "fr"))
      .map((simulator) => ({ name: simulator.name, label: simulator.name }))
  ];

  return simulatorRows.map((simulator) => {
    const checked = simulator.name === generalName
      ? note.isGeneral
      : note.simulatorNames.includes(simulator.name);
    return `
      <label class="simulator-toggle-row">
        <span>${escapeHtml(simulator.label)}</span>
        <input
          type="checkbox"
          data-simulator-name="${escapeAttribute(encodeURIComponent(simulator.name))}"
          ${checked ? "checked" : ""}
          ${editable ? "" : "disabled"}
        >
        <span class="ios-switch" aria-hidden="true"></span>
      </label>
    `;
  }).join("");
}

function simulatorFromSnapshot(id, data) {
  return {
    id: stringValue(data.id, id),
    documentID: id,
    name: stringValue(data.name),
    sortOrder: numberValue(data.sortOrder),
    colorHex: stringValue(data.colorHex, "#0ea5e9"),
    isHidden: Boolean(data.isHidden)
  };
}

function handwritingNoteFromSnapshot(id, data) {
  return {
    id,
    noteID: stringValue(data.noteID),
    authorIdentifier: stringValue(data.authorIdentifier),
    drawingData: stringValue(data.drawingData),
    previewImageData: stringValue(data.previewImageData),
    createdAt: dateValue(data.createdAt),
    updatedAt: dateValue(data.updatedAt)
  };
}

function deduplicatedSimulators(simulators) {
  const filteredSimulators = simulators.filter((simulator) => !deletedLegacySimulatorNames.has(simulator.name));
  const generalSimulators = filteredSimulators.filter((simulator) => simulator.name === generalName);
  const preferredGeneral = generalSimulators.find((simulator) => simulator.id === generalSimulatorID || simulator.documentID === generalSimulatorID)
    || generalSimulators[0];

  return filteredSimulators.filter((simulator) => {
    return simulator.name !== generalName || simulator === preferredGeneral;
  });
}

function userFromSnapshot(documentID, data) {
  return {
    documentID,
    id: stringValue(data.iCloudIdentifier, documentID),
    firstName: stringValue(data.firstName),
    lastName: stringValue(data.lastName),
    accessCode: stringValue(data.accessCode),
    isAccessCodeUserDefined: Boolean(data.isAccessCodeUserDefined),
    role: stringValue(data.roleRawValue),
    team: stringValue(data.teamRawValue),
    updatedAt: dateValue(data.updatedAt)
  };
}

function deduplicatedUsers(users) {
  const sorted = [...users].sort((first, second) => {
    const firstIsCanonical = first.documentID === firestoreDocumentID(first.id);
    const secondIsCanonical = second.documentID === firestoreDocumentID(second.id);
    if (firstIsCanonical !== secondIsCanonical) {
      return firstIsCanonical ? -1 : 1;
    }

    return (second.updatedAt?.getTime() || 0) - (first.updatedAt?.getTime() || 0);
  });

  const seenIdentifiers = new Set();
  const seenAccessCodes = new Set();

  return sorted.filter((user) => {
    const identifier = normalizeKey(user.id);
    const accessCode = stringValue(user.accessCode).trim();
    const duplicatesIdentifier = identifier && seenIdentifiers.has(identifier);
    const duplicatesAccessCode = /^\d{6}$/.test(accessCode) && seenAccessCodes.has(accessCode);

    if (duplicatesIdentifier || duplicatesAccessCode) {
      return false;
    }

    if (identifier) {
      seenIdentifiers.add(identifier);
    }
    if (/^\d{6}$/.test(accessCode)) {
      seenAccessCodes.add(accessCode);
    }
    return true;
  });
}

function openAdminSettings() {
  if (state.currentUser?.role !== "admin") {
    return;
  }

  state.activeAdminTab = "home";
  elements.adminOverlay.classList.remove("hidden");
  elements.adminOverlay.setAttribute("aria-hidden", "false");
  renderAdminSettings();
}

function closeAdminSettings() {
  elements.adminOverlay.classList.add("hidden");
  elements.adminOverlay.setAttribute("aria-hidden", "true");
}

function renderAdminSettings() {
  if (elements.adminOverlay.classList.contains("hidden")) {
    return;
  }

  const title = state.activeAdminTab === "users"
    ? "Droits"
    : state.activeAdminTab === "simulators"
      ? "Simulateurs"
      : "Administration";
  elements.adminOverlay.querySelector("#adminTitle").textContent = title;

  if (state.activeAdminTab === "users") {
    elements.adminBody.innerHTML = renderAdminUsers();
  } else if (state.activeAdminTab === "simulators") {
    elements.adminBody.innerHTML = renderAdminSimulators();
  } else {
    elements.adminBody.innerHTML = renderAdminHome();
  }
}

function renderAdminHome() {
  return `
    <div class="admin-menu-list">
      <button class="admin-menu-row" type="button" data-admin-action="open-admin-users">
        <span class="admin-menu-icon">⚿</span>
        <span>
          <strong>Droits et utilisateurs</strong>
          <small>${state.users.length} compte${state.users.length > 1 ? "s" : ""} utilisateur</small>
        </span>
      </button>
      <button class="admin-menu-row" type="button" data-admin-action="open-admin-simulators">
        <span class="admin-menu-icon">▦</span>
        <span>
          <strong>Simulateurs</strong>
          <small>Noms, ordre, couleurs et visibilité</small>
        </span>
      </button>
    </div>
  `;
}

function renderAdminBackButton() {
  return `
    <div class="admin-back-row">
      <button class="secondary" type="button" data-admin-action="admin-home">‹ Administration</button>
    </div>
  `;
}

function renderAdminUsers() {
  return `
    ${renderAdminBackButton()}
    <div class="admin-section-heading">
      <h3>Ajouter un utilisateur</h3>
    </div>
    <div class="admin-card admin-create-user-card">
      <div class="admin-form-grid create-user-grid">
        <label>Prénom<input id="newUserFirstName" autocomplete="off" placeholder="Prénom"></label>
        <label>Nom<input id="newUserLastName" autocomplete="off" placeholder="Nom"></label>
        <label>Code à 6 chiffres<input id="newUserAccessCode" maxlength="6" inputmode="numeric" autocomplete="off" placeholder="000000"></label>
      </div>
      <div class="admin-actions create-user-actions">
        <button type="button" data-admin-action="create-user">Ajouter l'utilisateur</button>
      </div>
    </div>
    <div class="admin-section-heading">
      <h3>Droits des utilisateurs</h3>
      <p>Nom, rôle, équipe et réinitialisation des codes utilisateur.</p>
    </div>
    <div class="admin-list">
      ${state.users.map(renderAdminUserCard).join("") || "<p class=\"muted\">Aucun utilisateur.</p>"}
    </div>
  `;
}

function renderAdminUserCard(user) {
  const codeValue = shouldMaskAdminAccessCode(user) ? "••••••" : user.accessCode;
  return `
    <article class="admin-card" data-user-id="${escapeAttribute(user.documentID)}">
      <div class="admin-card-title">
        <strong>${escapeHtml(currentDisplayNameForUser(user))}</strong>
        <span>${escapeHtml(user.id)}</span>
      </div>
      <div class="admin-form-grid">
        <label>Prénom<input data-field="firstName" value="${escapeAttribute(user.firstName)}"></label>
        <label>Nom<input data-field="lastName" value="${escapeAttribute(user.lastName)}"></label>
        <label>Code<input data-field="accessCode" value="${escapeAttribute(codeValue)}" maxlength="6" inputmode="numeric" autocomplete="off"></label>
        <label>Rôle
          <select data-field="role">
            <option value="" ${!user.role ? "selected" : ""}>Consultation</option>
            <option value="technician" ${user.role === "technician" ? "selected" : ""}>Technicien</option>
            <option value="teamLeader" ${user.role === "teamLeader" ? "selected" : ""}>Chef d'équipe</option>
          </select>
        </label>
        <label>Équipe
          <select data-field="team">
            <option value="" ${!user.team ? "selected" : ""}>Aucune</option>
            <option value="team1" ${user.team === "team1" ? "selected" : ""}>Equipe 1</option>
            <option value="team2" ${user.team === "team2" ? "selected" : ""}>Equipe 2</option>
            <option value="team3" ${user.team === "team3" ? "selected" : ""}>Equipe 3</option>
            <option value="team4" ${user.team === "team4" ? "selected" : ""}>Equipe 4</option>
            <option value="team5" ${user.team === "team5" ? "selected" : ""}>Equipe 5</option>
            <option value="support" ${user.team === "support" ? "selected" : ""}>Support</option>
          </select>
        </label>
      </div>
      <div class="admin-actions">
        <button type="button" class="danger-text" data-admin-action="delete-user">Supprimer le compte</button>
        <button type="button" class="secondary" data-admin-action="reset-user-code">Réinitialiser code</button>
        <button type="button" data-admin-action="save-user">Enregistrer</button>
      </div>
    </article>
  `;
}

function renderAdminSimulators() {
  return `
    ${renderAdminBackButton()}
    <div class="admin-section-heading">
      <h3>Gestion des simulateurs</h3>
      <p>Nom, ordre, couleur et visibilité dans le récap.</p>
    </div>
    <div class="admin-actions top">
      <button type="button" data-admin-action="new-simulator">Créer un simulateur</button>
    </div>
    <div class="admin-list">
      ${state.allSimulators.filter((simulator) => simulator.name !== generalName).map(renderAdminSimulatorCard).join("") || "<p class=\"muted\">Aucun simulateur.</p>"}
    </div>
  `;
}

function renderAdminSimulatorCard(simulator) {
  return `
    <article class="admin-card" data-simulator-id="${escapeAttribute(simulator.documentID)}">
      <div class="admin-card-title">
        <strong>${escapeHtml(simulator.name)}</strong>
        <span>${simulator.isHidden ? "Masqué" : "Visible"}</span>
      </div>
      <div class="admin-form-grid simulator-grid">
        <label>Nom<input data-field="name" value="${escapeAttribute(simulator.name)}"></label>
        <label>Ordre<input data-field="sortOrder" type="number" value="${simulator.sortOrder}"></label>
        <label>Couleur<input data-field="colorHex" type="color" value="${escapeAttribute(normalizeColor(simulator.colorHex))}"></label>
        <label>Masqué
          <select data-field="isHidden">
            <option value="false" ${!simulator.isHidden ? "selected" : ""}>Non</option>
            <option value="true" ${simulator.isHidden ? "selected" : ""}>Oui</option>
          </select>
        </label>
      </div>
      <div class="admin-actions">
        <button type="button" data-admin-action="save-simulator">Enregistrer</button>
      </div>
    </article>
  `;
}

async function createAdminUser() {
  if (!isAdminSession()) {
    setStatus("Acces admin requis");
    return;
  }

  const firstName = elements.adminBody.querySelector("#newUserFirstName")?.value.trim() || "";
  const lastName = elements.adminBody.querySelector("#newUserLastName")?.value.trim() || "";
  const accessCode = (elements.adminBody.querySelector("#newUserAccessCode")?.value || "")
    .replace(/\D/g, "")
    .slice(0, 6);

  if (accessCode.length !== 6) {
    setStatus("Le code utilisateur doit contenir 6 chiffres");
    return;
  }
  if (accessCode === adminCode || state.users.some((user) => user.accessCode === accessCode)) {
    setStatus("Ce code utilisateur est déjà utilisé");
    return;
  }

  const identifier = crypto.randomUUID().toUpperCase();
  setStatus("Création de l'utilisateur...");

  try {
    await setDoc(doc(db, "users", identifier), {
      id: identifier,
      iCloudIdentifier: identifier,
      firstName,
      lastName,
      accessCode,
      isAccessCodeUserDefined: false,
      roleRawValue: "",
      teamRawValue: "",
      updatedAt: new Date()
    });
    setStatus("Utilisateur ajouté");
  } catch (error) {
    setStatus(`Création impossible : ${error.message}`);
  }
}

async function saveAdminUser(documentID) {
  if (!isAdminSession()) {
    setStatus("Acces admin requis");
    return;
  }

  if (!documentID) {
    return;
  }

  const card = elements.adminBody.querySelector(`[data-user-id="${cssEscape(documentID)}"]`);
  const user = state.users.find((candidate) => candidate.documentID === documentID);
  if (!card || !user) {
    return;
  }

  const accessCodeInput = card.querySelector('[data-field="accessCode"]').value.trim();
  const patch = {
    firstName: card.querySelector('[data-field="firstName"]').value.trim(),
    lastName: card.querySelector('[data-field="lastName"]').value.trim(),
    roleRawValue: nullableString(card.querySelector('[data-field="role"]').value),
    teamRawValue: nullableString(card.querySelector('[data-field="team"]').value),
    updatedAt: new Date()
  };

  if (/^\d{6}$/.test(accessCodeInput) && accessCodeInput !== "••••••") {
    patch.accessCode = accessCodeInput;
    patch.isAccessCodeUserDefined = false;
  }

  await updateDoc(doc(db, "users", documentID), patch);
  setStatus("Utilisateur enregistré");
}

async function resetAdminUserCode(documentID) {
  if (!isAdminSession()) {
    setStatus("Acces admin requis");
    return;
  }

  if (!documentID) {
    return;
  }

  const code = generateAccessCode();
  await updateDoc(doc(db, "users", documentID), {
    accessCode: code,
    isAccessCodeUserDefined: false,
    updatedAt: new Date()
  });
  setStatus(`Code réinitialisé : ${code}`);
}

function requestDeleteAdminUser(documentID, anchorButton) {
  if (!isAdminSession()) {
    setStatus("Acces admin requis");
    return;
  }

  if (!documentID) {
    setStatus("Utilisateur introuvable");
    return;
  }

  const user = state.users.find((candidate) => candidate.documentID === documentID);
  if (!user) {
    setStatus("Utilisateur introuvable");
    return;
  }

  if (state.currentUser.documentID === "ADMIN" && documentID === "ADMIN") {
    setStatus("Impossible de supprimer la session ADMIN");
    return;
  }

  elements.adminBody.querySelector(".delete-confirm-popover")?.remove();
  const popover = document.createElement("div");
  popover.className = "delete-confirm-popover admin-delete-user-popover";
  popover.setAttribute("role", "dialog");
  popover.setAttribute("aria-modal", "true");

  const displayName = currentDisplayNameForUser(user);
  popover.innerHTML = `
    <strong>Supprimer ce compte ?</strong>
    <p>${escapeHtml(displayName)} devra repartir de zéro. Cette action est supprimée de Firebase.</p>
    <button type="button" class="delete-confirm-choice" data-user-delete-confirm="cancel">Annuler</button>
    <button type="button" class="delete-confirm-choice" data-user-delete-confirm="delete">Supprimer le compte</button>
  `;

  popover.addEventListener("click", (event) => {
    const choice = event.target.closest("[data-user-delete-confirm]")?.dataset.userDeleteConfirm;
    if (!choice) {
      return;
    }

    popover.remove();
    if (choice === "delete") {
      performAdminUserDeletion(documentID);
    }
  });

  anchorButton.closest(".admin-actions")?.appendChild(popover);
}

async function performAdminUserDeletion(documentID) {
  if (!isAdminSession() || !documentID) {
    return;
  }

  setStatus("Suppression du compte...");

  try {
    await deleteDoc(doc(db, "users", documentID));
    setStatus("Compte utilisateur supprimé");
  } catch (error) {
    setStatus(`Suppression impossible : ${error.message}`);
  }
}

async function saveAdminSimulator(simulatorID) {
  if (!simulatorID || state.currentUser?.role !== "admin") {
    return;
  }

  const card = elements.adminBody.querySelector(`[data-simulator-id="${cssEscape(simulatorID)}"]`);
  const simulator = state.allSimulators.find((candidate) => candidate.documentID === simulatorID);
  if (!card) {
    return;
  }

  const name = card.querySelector('[data-field="name"]').value.trim();
  if (name.localeCompare(generalName, "fr", { sensitivity: "accent" }) === 0) {
    setStatus("Le nom General est réservé au bandeau général");
    return;
  }

  await updateDoc(doc(db, "simulators", simulatorID), {
    id: simulator?.id || simulatorID,
    name,
    sortOrder: Number(card.querySelector('[data-field="sortOrder"]').value || 0),
    colorHex: card.querySelector('[data-field="colorHex"]').value,
    isHidden: card.querySelector('[data-field="isHidden"]').value === "true",
    updatedAt: new Date()
  });
  setStatus("Simulateur enregistré");
}

async function createAdminSimulator() {
  if (state.currentUser?.role !== "admin") {
    return;
  }

  const id = crypto.randomUUID();
  const nextOrder = Math.max(0, ...state.allSimulators.map((simulator) => simulator.sortOrder)) + 1;
  await setDoc(doc(db, "simulators", id), {
    id,
    name: `Nouveau simu ${nextOrder}`,
    sortOrder: nextOrder,
    colorHex: "#2f80ed",
    isHidden: false,
    updatedAt: new Date()
  });
  setStatus("Simulateur créé");
}

function visibleHandwritingFor(note) {
  if (!state.currentUser) {
    return note.handwritingData || note.handwritingPreviewImageData
      ? { source: "consigne", data: note.handwritingData, previewImageData: note.handwritingPreviewImageData }
      : null;
  }

  const ownNote = state.handwritingNotes.find((entry) => {
    return entry.noteID === note.id && normalizeKey(entry.authorIdentifier) === normalizeKey(state.currentUser.id);
  });

  if (ownNote?.drawingData) {
    return {
      source: "utilisateur",
      documentID: ownNote.id,
      data: ownNote.drawingData,
      previewImageData: ownNote.previewImageData
    };
  }

  if (normalizeKey(note.handwritingAuthorIdentifier || note.authorIdentifier || note.author) === normalizeKey(state.currentUser.id) && note.handwritingData) {
    return { source: "consigne", data: note.handwritingData, previewImageData: note.handwritingPreviewImageData };
  }

  return null;
}

function renderHandwritingNotice(handwriting) {
  const image = handwriting.previewImageData
    ? `<img class="handwriting-preview" src="data:image/png;base64,${escapeHtml(handwriting.previewImageData)}" alt="Note manuscrite">`
    : "";
  return `
    <div class="handwriting-notice">
      <div class="handwriting-tools">
        <div class="handwriting-tool-buttons">
          <button type="button" class="handwriting-tool-button danger" data-detail-action="clear-handwriting" title="Effacer la note manuscrite" aria-label="Effacer la note manuscrite">
            ${trashIconSVG()}
          </button>
          <button type="button" class="handwriting-tool-button" data-detail-action="ocr-handwriting" title="OCR" aria-label="OCR">
            ${ocrIconSVG()}
          </button>
        </div>
      </div>
      ${image}
      ${image ? "" : "<p>Cette note n'a pas encore d'aperçu web. Elle sera visible après ouverture/enregistrement depuis l'app iPad mise à jour.</p>"}
    </div>
  `;
}

function renderHandwritingSection(note, handwriting) {
  if (state.pendingHandwritingClear?.noteID === note.id) {
    return `<div class="handwriting-empty pending-clear">${escapeHtml(state.pendingHandwritingClear.message)}</div>`;
  }

  return handwriting ? renderHandwritingNotice(handwriting) : "<div class=\"handwriting-empty\"></div>";
}

function renderHandwritingCardPreview(handwriting) {
  if (handwriting.previewImageData) {
    return `
      <div class="note-handwriting-preview-wrap">
        <img class="note-handwriting-preview" src="data:image/png;base64,${escapeHtml(handwriting.previewImageData)}" alt="Note manuscrite">
      </div>
    `;
  }

  return `
    <div class="note-handwriting-missing-preview">
      Note manuscrite présente, aperçu web en attente de synchronisation iPad.
    </div>
  `;
}

function trashIconSVG() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 6h18"></path>
      <path d="M8 6V4h8v2"></path>
      <path d="M19 6l-1 14H6L5 6"></path>
      <path d="M10 11v6"></path>
      <path d="M14 11v6"></path>
    </svg>
  `;
}

function ocrIconSVG() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 4H5a1 1 0 0 0-1 1v3"></path>
      <path d="M16 4h3a1 1 0 0 1 1 1v3"></path>
      <path d="M8 20H5a1 1 0 0 1-1-1v-3"></path>
      <path d="M16 20h3a1 1 0 0 0 1-1v-3"></path>
      <path d="M8 12h8"></path>
      <path d="M10 9h4"></path>
      <path d="M10 15h4"></path>
    </svg>
  `;
}

async function clearVisibleHandwriting(note) {
  if (!canCurrentUserWrite() || state.isSaving) {
    return;
  }

  const handwriting = visibleHandwritingFor(note);
  if (!handwriting) {
    setStatus("Aucune note manuscrite à effacer");
    return;
  }

  markHandwritingClearPending(
    note,
    handwriting,
    "Note manuscrite à supprimer. Appuie sur Enregistrer pour valider."
  );
  setStatus("Suppression manuscrite en attente d'enregistrement");
}

async function recognizeVisibleHandwriting(note) {
  if (!canCurrentUserWrite() || state.isSaving) {
    return;
  }

  const handwriting = visibleHandwritingFor(note);
  if (!handwriting?.previewImageData) {
    setStatus("OCR impossible : aperçu manuscrit absent");
    return;
  }

  state.isSaving = true;
  setStatus("OCR en cours...");

  try {
    const text = await recognizePreviewImageText(handwriting.previewImageData);

    if (!text) {
      setStatus("Aucun texte détecté");
      return;
    }

    appendTextToConsigneEditor(text);
    markHandwritingClearPending(
      note,
      handwriting,
      "Note manuscrite transformée en texte. Appuie sur Enregistrer pour valider."
    );
    setStatus("Texte manuscrit inséré");
  } catch (error) {
    setStatus(`OCR impossible : ${error.message}`);
  } finally {
    state.isSaving = false;
  }
}

function markHandwritingClearPending(note, handwriting, message) {
  state.pendingHandwritingClear = {
    noteID: note.id,
    source: handwriting.source,
    documentID: handwriting.documentID || "",
    message
  };

  const notice = elements.detailBody.querySelector(".handwriting-notice");
  if (notice) {
    notice.replaceWith(document.createRange().createContextualFragment(`
      <div class="handwriting-empty pending-clear">${escapeHtml(message)}</div>
    `));
  }
}

async function recognizePreviewImageText(base64Image) {
  if ("TextDetector" in window) {
    const blob = base64ToBlob(base64Image, "image/png");
    const bitmap = await createImageBitmap(blob);
    const detector = new window.TextDetector();
    const detections = await detector.detect(bitmap);
    return formatDetectedText(detections);
  }

  const tesseract = await loadTesseract();
  const result = await tesseract.recognize(`data:image/png;base64,${base64Image}`, "fra+eng");
  return stringValue(result?.data?.text)
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function loadTesseract() {
  if (window.Tesseract) {
    return Promise.resolve(window.Tesseract);
  }

  if (window.__simflowTesseractLoading) {
    return window.__simflowTesseractLoading;
  }

  window.__simflowTesseractLoading = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
    script.async = true;
    script.onload = () => resolve(window.Tesseract);
    script.onerror = () => reject(new Error("chargement OCR impossible"));
    document.head.appendChild(script);
  });

  return window.__simflowTesseractLoading;
}

function base64ToBlob(base64, type) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type });
}

function formatDetectedText(detections) {
  return [...detections]
    .sort((left, right) => {
      const lineDelta = left.boundingBox.y - right.boundingBox.y;
      return Math.abs(lineDelta) > 18 ? lineDelta : left.boundingBox.x - right.boundingBox.x;
    })
    .map((detection) => stringValue(detection.rawValue).trim())
    .filter(Boolean)
    .join("\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function appendTextToConsigneEditor(text) {
  const editor = document.querySelector("#detailEditText");
  if (!editor) {
    return;
  }

  const currentText = editor.innerText.replace(/\u00a0/g, " ").trim();
  const separator = currentText ? "<br>" : "";
  editor.innerHTML = sanitizeRichTextHTML(`${editor.innerHTML}${separator}${escapeHtml(text).replace(/\n/g, "<br>")}`);
  editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
}

function detailActionHint(note, done, canWrite, canToggleAcknowledgement) {
  if (!canWrite) {
    return `<p class="detail-action-hint">Connecte-toi avec ton code utilisateur pour solder ou prendre en compte une consigne.</p>`;
  }

  if (canToggleAcknowledgement) {
    return "";
  }

  if (done) {
    return `<p class="detail-action-hint">Une consigne soldée ne peut pas être prise en compte.</p>`;
  }

  if (note.priority) {
    return `<p class="detail-action-hint">Une consigne avec priorité ne peut pas être prise en compte.</p>`;
  }

  if (isNew(note)) {
    return `<p class="detail-action-hint">Une consigne NEW ne peut pas être prise en compte.</p>`;
  }

  return "";
}

async function toggleDone(note, context) {
  if (!state.currentUser) {
    return;
  }

  const now = new Date();
  const key = completionStorageKey(context, state.selectedDate);
  const alreadyDone = isDoneInContext(note, context);
  const completions = alreadyDone
    ? note.completions.filter((completion) => !(completion.context === context && sameDay(completion.date, state.selectedDate)))
    : [...note.completions, {
        id: crypto.randomUUID(),
        context,
        author: currentDisplayName(),
        authorIdentifier: state.currentUser.id,
        date: now
      }];
  const completedContexts = alreadyDone
    ? note.completedContexts.filter((entry) => entry !== key)
    : uniqueStrings([...note.completedContexts, key]);

  await updateNote(note.id, {
    completedContextsStorage: completedContexts.join("\n"),
    completionHistoryData: completions.length ? encodeRecordArray(completions) : deleteField(),
    updatedAt: now
  });
}

async function toggleAcknowledgement(note, context) {
  if (!state.currentUser) {
    return;
  }

  const scopeType = "user";
  const scopeID = state.currentUser.id;
  const now = new Date();
  const alreadyAcknowledged = note.acknowledgements.some((acknowledgement) => {
    return acknowledgement.context === context
      && acknowledgement.scopeType === scopeType
      && acknowledgement.scopeID === scopeID;
  });
  const acknowledgements = alreadyAcknowledged
    ? note.acknowledgements.filter((acknowledgement) => {
        return !(acknowledgement.context === context
          && acknowledgement.scopeType === scopeType
          && acknowledgement.scopeID === scopeID);
      })
    : [...note.acknowledgements, {
        id: crypto.randomUUID(),
        context,
        scopeType,
        scopeID,
        author: currentDisplayName(),
        authorIdentifier: state.currentUser.id,
        date: now
      }];

  await updateNote(note.id, {
    acknowledgementHistoryData: acknowledgements.length ? encodeRecordArray(acknowledgements) : deleteField(),
    updatedAt: now
  });
}

function deleteNoteFromDetail(note) {
  if (!canCurrentUserDeleteNote(note) || state.isSaving) {
    return;
  }

  elements.detailBody.querySelector(".delete-confirm-popover")?.remove();
  const popover = document.createElement("div");
  popover.className = "delete-confirm-popover";
  popover.setAttribute("role", "dialog");
  popover.setAttribute("aria-modal", "true");
  const isAdmin = state.currentUser?.role === "admin";
  const isDeleted = Boolean(note.deletedAt);
  popover.innerHTML = isDeleted ? `
    <strong>Restaurer cette consigne ?</strong>
    <p>La consigne redeviendra visible dans l'affichage normal.</p>
    <button type="button" class="delete-confirm-choice" data-delete-confirm="restore">
      Restaurer la consigne
    </button>
  ` : `
    <strong>Supprimer cette consigne ?</strong>
    <p>${isAdmin
      ? "La suppression visible laissera la consigne barree pour les chefs d'equipe. La suppression definitive est irreversible."
      : "La consigne sera masquee de l'affichage normal et restera visible barree pour les chefs d'equipe."}</p>
    <button type="button" class="delete-confirm-choice" data-delete-confirm="visible">
      ${isAdmin ? "Visible par les chefs d'equipe" : "Supprimer"}
    </button>
    ${isAdmin ? `
      <button type="button" class="delete-confirm-choice" data-delete-confirm="permanent">
        Supprimer definitivement
      </button>
    ` : ""}
  `;

  popover.addEventListener("click", (event) => {
    const choice = event.target.closest("[data-delete-confirm]")?.dataset.deleteConfirm;
    if (!choice) {
      return;
    }

    popover.remove();
    performNoteDeletion(note, choice);
  });

  elements.detailBody.appendChild(popover);
}

async function performNoteDeletion(note, deletionMode) {
  if (!canCurrentUserDeleteNote(note) || state.isSaving) {
    return;
  }

  const isPermanent = deletionMode === "permanent";
  if (isPermanent && state.currentUser?.role !== "admin") {
    setStatus("Suppression définitive réservée à l'admin");
    return;
  }

  state.isSaving = true;
  refreshDetail();
  try {
    if (isPermanent) {
      setStatus("Suppression définitive...");
      await permanentlyDeleteNote(note.id);
    } else if (deletionMode === "restore") {
      setStatus("Restauration...");
      await updateNote(note.id, {
        deletedAt: deleteField(),
        deletedBy: deleteField(),
        deletedByIdentifier: deleteField(),
        updatedAt: new Date()
      });
    } else {
      const now = new Date();
      setStatus("Suppression...");
      await updateNote(note.id, {
        deletedAt: now,
        deletedBy: currentDisplayName(),
        deletedByIdentifier: state.currentUser.id,
        updatedAt: now
      });
    }
    closeDetail();
    render();
  } catch (error) {
    console.error("Suppression de consigne impossible", error);
    setStatus(`Erreur de suppression : ${error.message}`);
  } finally {
    state.isSaving = false;
    refreshDetail();
  }
}

async function permanentlyDeleteNote(noteID) {
  const [handwritingSnapshot, dailyTagSnapshot] = await Promise.all([
    getDocs(query(collection(db, "handwritingNotes"), where("noteID", "==", noteID))),
    getDocs(query(collection(db, "dailyTags"), where("noteID", "==", noteID)))
  ]);

  const linkedDocuments = [
    ...handwritingSnapshot.docs,
    ...dailyTagSnapshot.docs
  ];

  await Promise.all(linkedDocuments.map((document) => deleteDoc(document.ref)));
  await deleteDoc(doc(db, "handoverNotes", noteID));
}

async function saveNewNote(options = {}) {
  if (!canCurrentUserWrite() || state.isSaving) {
    return;
  }

  const { title, text, richTextHTML } = collectConsigneDraft();
  const dateInput = document.querySelector("#detailEditDate")?.value || isoDate(state.selectedDate);
  const selectedDisplayDate = startOfDay(parseDateInput(dateInput));
  let displayDate = options.displayDate ? startOfDay(options.displayDate) : selectedDisplayDate;
  const priority = document.querySelector("#detailEditPriority")?.value || "";
  const destination = collectDetailDestination(state.selectedCreate?.context || generalName);

  if (!title && !text) {
    setStatus("Saisis un titre ou une consigne.");
    return;
  }

  if (!options.skipDateConfirmation && !sameDay(selectedDisplayDate, new Date())) {
    showCreateDateConfirmation(selectedDisplayDate);
    return;
  }

  const now = new Date();
  const id = crypto.randomUUID().toUpperCase();
  const payload = {
    id,
    title,
    text,
    author: currentDisplayName(),
    authorIdentifier: state.currentUser.id,
    createdAt: now,
    updatedAt: now,
    displayDate,
    firstDisplayDate: displayDate,
    isGeneral: destination.isGeneral,
    simulatorNamesStorage: destination.simulatorNames.join("\n"),
    richTextHTML,
    priorityRawValue: priority,
    completedContextsStorage: "",
    acknowledgementHistoryData: "",
    completionHistoryData: "",
    revisionHistoryData: ""
  };

  state.isSaving = true;
  setStatus("Enregistrement...");
  try {
    await setDoc(doc(db, "handoverNotes", id), payload);
    closeDetail();
    setStatus("Consigne créée");
  } finally {
    state.isSaving = false;
  }
}

function showCreateDateConfirmation(selectedDisplayDate) {
  elements.detailBody.querySelector(".date-confirm-popover")?.remove();
  const popover = document.createElement("div");
  popover.className = "date-confirm-popover";
  popover.setAttribute("role", "dialog");
  popover.setAttribute("aria-modal", "true");
  popover.innerHTML = `
    <strong>La consigne n'est pas saisie<br>à la date du jour</strong>
    <p>Voulez-vous conserver la date selectionnee ou affecter cette consigne a aujourd'hui ?</p>
    <button type="button" class="date-confirm-choice" data-date-confirm="keep">
      Conserver la date du ${escapeHtml(formatLongDate(selectedDisplayDate))}
    </button>
    <button type="button" class="date-confirm-choice primary" data-date-confirm="today">
      Mettre a la date du jour
    </button>
  `;

  popover.addEventListener("click", (event) => {
    const choice = event.target.closest("[data-date-confirm]")?.dataset.dateConfirm;
    if (!choice) {
      return;
    }

    popover.remove();
    saveNewNote({
      skipDateConfirmation: true,
      displayDate: choice === "today" ? new Date() : selectedDisplayDate
    });
  });

  elements.detailBody.appendChild(popover);
}

function showEditDateConfirmation(note, selectedModificationDate) {
  elements.detailBody.querySelector(".date-confirm-popover")?.remove();
  const popover = document.createElement("div");
  popover.className = "date-confirm-popover";
  popover.setAttribute("role", "dialog");
  popover.setAttribute("aria-modal", "true");
  popover.innerHTML = `
    <strong>La consigne n'est pas modifiée<br>à la date du jour</strong>
    <p>Voulez-vous memoriser cette modification a la date selectionnee ou a la date du jour ?</p>
    <button type="button" class="date-confirm-choice" data-date-confirm="keep">
      Conserver la date de modification du ${escapeHtml(formatLongDate(selectedModificationDate))}
    </button>
    <button type="button" class="date-confirm-choice primary" data-date-confirm="today">
      Mettre a la date du jour
    </button>
  `;

  popover.addEventListener("click", (event) => {
    const choice = event.target.closest("[data-date-confirm]")?.dataset.dateConfirm;
    if (!choice) {
      return;
    }

    popover.remove();
    saveDetailEdit(note, {
      skipDateConfirmation: true,
      modificationDate: choice === "today" ? new Date() : selectedModificationDate
    });
  });

  elements.detailBody.appendChild(popover);
}

async function saveDetailEdit(note, options = {}) {
  if (!canCurrentUserWrite() || state.isSaving) {
    return;
  }

  const { title, text, richTextHTML } = collectConsigneDraft();
  const displayDate = startOfDay(parseDateInput(document.querySelector("#detailEditDate").value));
  const selectedModificationDate = startOfDay(state.selectedDate);
  const modificationDay = options.modificationDate ? startOfDay(options.modificationDate) : selectedModificationDate;
  const priority = document.querySelector("#detailEditPriority").value;
  const destination = collectDetailDestination(state.selectedDetail?.context || generalName);
  const context = state.selectedDetail?.context || generalName;
  const doneButton = elements.detailBody.querySelector('[data-detail-action="toggle-done"]');
  const ackButton = elements.detailBody.querySelector('[data-detail-action="toggle-ack"]');
  const initialDone = doneButton?.dataset.initialState === "true";
  const draftDone = doneButton?.dataset.draftState === "true";
  const initialAcknowledged = ackButton?.dataset.initialState === "true";
  const draftAcknowledged = ackButton?.dataset.draftState === "true";
  const now = new Date();
  const modificationDate = dateWithTime(modificationDay, now);
  const revisions = [...note.revisions];
  const patch = { updatedAt: now };
  const textChanged = title !== note.title || text !== note.text;
  const richTextChanged = richTextHTML !== (note.richTextHTML || "");
  const dateChanged = !sameDay(displayDate, note.displayDate);
  const priorityChanged = priority !== note.priority;
  const destinationChanged = destination.isGeneral !== note.isGeneral
    || destination.simulatorNames.join("\n") !== note.simulatorNames.join("\n");
  const doneChanged = initialDone !== draftDone;
  const acknowledgementChanged = initialAcknowledged !== draftAcknowledged;
  const handwritingClearChanged = state.pendingHandwritingClear?.noteID === note.id;
  const announcesContentModification = textChanged && shouldAnnounceContentModification(note.title, note.text, title, text);

  if (!textChanged && !richTextChanged && !dateChanged && !priorityChanged && !destinationChanged && !doneChanged && !acknowledgementChanged && !handwritingClearChanged) {
    closeDetail();
    return;
  }

  if (!options.skipDateConfirmation && announcesContentModification && !sameDay(selectedModificationDate, new Date())) {
    showEditDateConfirmation(note, selectedModificationDate);
    return;
  }

  if (announcesContentModification && (initialDone || draftDone)) {
    const shouldContinue = window.confirm("Cette modification sera signalée. La consigne perdra son statut Soldé.");
    if (!shouldContinue) {
      return;
    }
  }

  if (textChanged) {
    ensureInitialRevision(revisions, note);
    patch.title = title;
    patch.text = text;
    revisions.push({
      id: crypto.randomUUID(),
      author: currentDisplayName(),
      authorIdentifier: state.currentUser.id,
      date: modificationDate,
      text: combinedNoteText(title, text),
      isVisibleToOthers: announcesContentModification,
      previousPriorityRawValue: priorityChanged ? note.priority || "" : undefined,
      newPriorityRawValue: priorityChanged ? priority || "" : undefined
    });
    if (announcesContentModification) {
      patch.contentModifiedAt = modificationDate;
      patch.acknowledgementHistoryData = deleteField();
    }
  }

  if (richTextChanged || textChanged) {
    patch.richTextHTML = richTextHTML || deleteField();
    patch.richTextData = deleteField();
  }

  if (dateChanged) {
    patch.displayDate = displayDate;
    patch.firstDisplayDate = displayDate;
    patch.reportDate = deleteField();
    if (sameDay(displayDate, originalAssignedDateBeforeDateChanges(note))) {
      clearDateChangeHistory(revisions);
    } else {
      revisions.push({
        id: crypto.randomUUID(),
        author: currentDisplayName(),
        authorIdentifier: state.currentUser.id,
        date: now,
        text: combinedNoteText(title, text),
        previousDisplayDate: note.displayDate,
        newDisplayDate: displayDate
      });
    }
  }

  if (priorityChanged && !textChanged) {
    ensureInitialRevision(revisions, note);
    patch.priorityRawValue = priority || deleteField();
    revisions.push({
      id: crypto.randomUUID(),
      author: currentDisplayName(),
      authorIdentifier: state.currentUser.id,
      date: now,
      text: combinedNoteText(title, text),
      isVisibleToOthers: false,
      previousPriorityRawValue: note.priority || "",
      newPriorityRawValue: priority || ""
    });
  } else if (priorityChanged) {
    patch.priorityRawValue = priority || deleteField();
  }

  if (destinationChanged) {
    patch.isGeneral = destination.isGeneral;
    patch.simulatorNamesStorage = destination.simulatorNames.join("\n");
  }

  if (doneChanged || (announcesContentModification && (initialDone || draftDone))) {
    const nextDone = announcesContentModification ? false : draftDone;
    const doneUpdate = updatedCompletionState(note, context, nextDone, now);
    patch.completedContextsStorage = doneUpdate.completedContexts.join("\n");
    patch.completionHistoryData = doneUpdate.completions.length ? encodeRecordArray(doneUpdate.completions) : deleteField();
  }

  if (acknowledgementChanged && !announcesContentModification) {
    const acknowledgementUpdate = updatedAcknowledgementState(note, context, draftAcknowledged, now);
    patch.acknowledgementHistoryData = acknowledgementUpdate.length ? encodeRecordArray(acknowledgementUpdate) : deleteField();
  }

  patch.revisionHistoryData = revisions.length ? encodeRecordArray(revisions) : deleteField();

  if (handwritingClearChanged && state.pendingHandwritingClear.source !== "utilisateur") {
    patch.handwritingData = deleteField();
    patch.handwritingPreviewImageData = deleteField();
    patch.handwritingAuthorIdentifier = deleteField();
  }

  state.isSaving = true;
  refreshDetail();
  try {
    await updateNote(note.id, patch);
    if (handwritingClearChanged && state.pendingHandwritingClear.source === "utilisateur" && state.pendingHandwritingClear.documentID) {
      await deleteDoc(doc(db, "handwritingNotes", state.pendingHandwritingClear.documentID));
    }
    state.pendingHandwritingClear = null;
    closeDetail();
  } finally {
    state.isSaving = false;
    refreshDetail();
  }
}

async function undoLatestModificationFromDetail(note) {
  if (!canUndoLatestModification(note) || state.isSaving) {
    return;
  }

  const latestRevision = latestUndoableModification(note);
  const revisionIndex = latestRevision
    ? note.revisions.findIndex((revision) => revision.id === latestRevision.id)
    : -1;
  if (revisionIndex <= 0) {
    return;
  }

  const shouldUndo = window.confirm("Annuler la dernière modification ? La consigne reviendra à son état avant cette modification.");
  if (!shouldUndo) {
    return;
  }

  const previousRevision = note.revisions[revisionIndex - 1];
  const restoredText = splitRevisionText(previousRevision?.text || "");
  const revisions = [...note.revisions];
  revisions.splice(revisionIndex, 1);
  const restoredNote = { ...note, revisions };
  const latestModificationDate = latestContentModificationDate(restoredNote);

  const patch = {
    title: restoredText.title,
    text: restoredText.text,
    richTextHTML: restoredText.text ? plainTextToRichHTML(restoredText.text) : deleteField(),
    richTextData: deleteField(),
    revisionHistoryData: revisions.length ? encodeRecordArray(revisions) : deleteField(),
    contentModifiedAt: latestModificationDate || deleteField(),
    updatedAt: new Date()
  };

  if (latestRevision.previousDisplayDate || latestRevision.newDisplayDate) {
    const restoredDisplayDate = startOfDay(latestRevision.previousDisplayDate || note.displayDate);
    patch.displayDate = restoredDisplayDate;
    patch.firstDisplayDate = restoredDisplayDate;
    patch.reportDate = deleteField();
  }

  if (latestRevision.previousPriorityRawValue || latestRevision.newPriorityRawValue) {
    patch.priorityRawValue = latestRevision.previousPriorityRawValue || deleteField();
  }

  state.isSaving = true;
  refreshDetail();
  try {
    await updateNote(note.id, patch);
    setStatus("Modification annulée");
  } finally {
    state.isSaving = false;
    refreshDetail();
  }
}

function latestUndoableModification(note) {
  const latestRevision = note.revisions.at(-1);
  if (!latestRevision || !isVisibleInStandardTimeline(latestRevision)) {
    return null;
  }

  return latestRevision;
}

function canUndoLatestModification(note) {
  const latestRevision = latestUndoableModification(note);
  if (!latestRevision || !state.currentUser) {
    return false;
  }

  return canViewTimelineAuthors()
    || revisionMatchesCurrentUser(latestRevision);
}

function revisionMatchesCurrentUser(revision) {
  const revisionAuthorKey = normalizeRevisionAuthor(revision);
  const currentUserRecord = state.users.find((user) => {
    return normalizeKey(user.id) === normalizeKey(state.currentUser?.id)
      || normalizeKey(user.documentID) === normalizeKey(state.currentUser?.documentID);
  });
  const currentKeys = [
    state.currentUser?.id,
    state.currentUser?.documentID,
    currentDisplayName(),
    currentUserRecord ? currentDisplayNameForUser(currentUserRecord) : ""
  ].map(normalizeKey).filter(Boolean);

  return currentKeys.includes(revisionAuthorKey);
}

function splitRevisionText(revisionText) {
  const lines = stringValue(revisionText).split("\n");
  return {
    title: stringValue(lines.shift()).trim(),
    text: lines.join("\n").trim()
  };
}

function collectDetailDestination(fallbackContext) {
  const checkedNames = [...elements.detailBody.querySelectorAll("[data-simulator-name]:checked")]
    .map((input) => decodeURIComponent(input.dataset.simulatorName))
    .filter(Boolean);
  let isGeneral = checkedNames.includes(generalName);
  let simulatorNames = checkedNames.filter((name) => name !== generalName);

  if (!isGeneral && simulatorNames.length === 0) {
    if (fallbackContext === generalName) {
      isGeneral = true;
    } else {
      simulatorNames = [fallbackContext];
    }
  }

  if (isGeneral) {
    simulatorNames = [];
  }

  return {
    isGeneral,
    simulatorNames: uniqueStrings(simulatorNames)
  };
}

function combinedNoteText(title, text) {
  return [title.trim(), text.trim()].filter(Boolean).join("\n");
}

function collectConsigneDraft() {
  const title = document.querySelector("#detailEditTitle")?.value.trim() || "";
  const editor = document.querySelector("#detailEditText");
  const text = editor ? editor.innerText.replace(/\u00a0/g, " ").trim() : "";
  const richTextHTML = editor && text ? sanitizeRichTextHTML(editor.innerHTML) : "";
  return { title, text, richTextHTML };
}

function sanitizeRichTextHTML(html) {
  if (!html) {
    return "";
  }

  const template = document.createElement("template");
  template.innerHTML = html;
  const allowedTags = new Set(["B", "STRONG", "I", "EM", "U", "UL", "OL", "LI", "BR", "DIV", "P", "SPAN"]);
  const allowedColors = new Set(["#ffd51f", "#2f80ed", "#24c63b", "#ef2f24", "#ffffff"]);

  function cleanNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      return document.createTextNode(node.textContent || "");
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return document.createTextNode("");
    }

    const tagName = allowedTags.has(node.tagName) ? node.tagName.toLowerCase() : "span";
    const cleaned = document.createElement(tagName);
    const backgroundColor = normalizeRichTextColor(node.style?.backgroundColor, true);
    const color = normalizeRichTextColor(node.style?.color, false);

    if (backgroundColor && allowedColors.has(backgroundColor)) {
      cleaned.style.backgroundColor = backgroundColor;
    }
    if (color && allowedColors.has(color)) {
      cleaned.style.color = color;
    }

    node.childNodes.forEach((child) => {
      const cleanedChild = cleanNode(child);
      if (cleanedChild.textContent || cleanedChild.childNodes.length || cleanedChild.nodeName === "BR") {
        cleaned.appendChild(cleanedChild);
      }
    });

    return cleaned;
  }

  const fragment = document.createDocumentFragment();
  template.content.childNodes.forEach((node) => fragment.appendChild(cleanNode(node)));
  const container = document.createElement("div");
  container.appendChild(fragment);
  return container.innerHTML.trim();
}

function normalizeRichTextColor(value, isBackground) {
  if (!value) {
    return "";
  }

  const parsed = parseCssColor(value);
  if (!parsed) {
    return "";
  }

  const { r, g, b } = parsed;
  if (isBackground) {
    if (r >= 235 && g >= 175 && b <= 90) return "#ffd51f";
    if (r <= 95 && g >= 95 && g <= 165 && b >= 190) return "#2f80ed";
    if (r <= 95 && g >= 160 && b <= 120) return "#24c63b";
    if (r >= 210 && g <= 95 && b <= 90) return "#ef2f24";
  }

  if (r >= 245 && g >= 245 && b >= 245) {
    return "#ffffff";
  }

  return "";
}

function parseCssColor(value) {
  const color = String(value).trim().toLowerCase();
  const hex = color.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const raw = hex[1].length === 3
      ? hex[1].split("").map((char) => char + char).join("")
      : hex[1];
    return {
      r: parseInt(raw.slice(0, 2), 16),
      g: parseInt(raw.slice(2, 4), 16),
      b: parseInt(raw.slice(4, 6), 16)
    };
  }

  const rgb = color.match(/^rgba?\(([^)]+)\)$/);
  if (!rgb) {
    return null;
  }

  const channels = rgb[1].split(",").map((part) => Number.parseFloat(part.trim()));
  if (channels.length < 3 || channels.slice(0, 3).some((channel) => Number.isNaN(channel))) {
    return null;
  }

  return {
    r: Math.max(0, Math.min(255, Math.round(channels[0]))),
    g: Math.max(0, Math.min(255, Math.round(channels[1]))),
    b: Math.max(0, Math.min(255, Math.round(channels[2])))
  };
}

function ensureInitialRevision(revisions, note) {
  if (revisions.length > 0) {
    return;
  }

  revisions.push({
    id: crypto.randomUUID(),
    author: note.author,
    authorIdentifier: note.authorIdentifier || note.author,
    date: note.createdAt || note.firstDisplayDate || note.displayDate,
    text: combinedNoteText(note.title, note.text)
  });
}

function shouldAnnounceContentModification(oldTitle, oldText, newTitle, newText) {
  const oldWords = normalizedWords(combinedNoteText(oldTitle, oldText));
  const newWords = normalizedWords(combinedNoteText(newTitle, newText));
  if (oldWords.join("\u0000") === newWords.join("\u0000")) {
    return false;
  }

  return wordEditSummary(oldWords, newWords).hasNetWholeWordInsertionOrDeletion;
}

function normalizedWords(text) {
  return [...text.matchAll(/\p{L}[\p{L}\p{N}'’-]*|\p{N}+/gu)]
    .map((match) => match[0].normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("fr"));
}

function wordEditSummary(oldWords, newWords) {
  const lcs = Array.from({ length: oldWords.length + 1 }, () => Array(newWords.length + 1).fill(0));
  for (let oldIndex = oldWords.length - 1; oldIndex >= 0; oldIndex -= 1) {
    for (let newIndex = newWords.length - 1; newIndex >= 0; newIndex -= 1) {
      lcs[oldIndex][newIndex] = oldWords[oldIndex] === newWords[newIndex]
        ? lcs[oldIndex + 1][newIndex + 1] + 1
        : Math.max(lcs[oldIndex + 1][newIndex], lcs[oldIndex][newIndex + 1]);
    }
  }

  let oldIndex = 0;
  let newIndex = 0;
  let insertedWords = 0;
  let deletedWords = 0;
  while (oldIndex < oldWords.length || newIndex < newWords.length) {
    if (oldIndex < oldWords.length && newIndex < newWords.length && oldWords[oldIndex] === newWords[newIndex]) {
      oldIndex += 1;
      newIndex += 1;
    } else if (newIndex < newWords.length && (oldIndex === oldWords.length || lcs[oldIndex][newIndex + 1] >= lcs[oldIndex + 1][newIndex])) {
      insertedWords += 1;
      newIndex += 1;
    } else if (oldIndex < oldWords.length) {
      deletedWords += 1;
      oldIndex += 1;
    }
  }

  return {
    insertedWords,
    deletedWords,
    hasNetWholeWordInsertionOrDeletion: insertedWords !== deletedWords
  };
}

function originalAssignedDateBeforeDateChanges(note) {
  const dateChangeRevisions = note.revisions
    .filter((revision) => revision.previousDisplayDate || revision.newDisplayDate)
    .sort((a, b) => a.date - b.date);
  return startOfDay(dateChangeRevisions[0]?.previousDisplayDate || note.firstDisplayDate || note.displayDate);
}

function clearDateChangeHistory(revisions) {
  revisions.forEach((revision) => {
    delete revision.previousDisplayDate;
    delete revision.newDisplayDate;
  });
}

function updatedCompletionState(note, context, shouldBeDone, now) {
  const key = completionStorageKey(context, state.selectedDate);
  const hasCompletion = note.completions.some((completion) => completion.context === context && sameDay(completion.date, state.selectedDate));
  const completions = shouldBeDone && !hasCompletion
    ? [...note.completions, {
        id: crypto.randomUUID(),
        context,
        author: currentDisplayName(),
        authorIdentifier: state.currentUser.id,
        date: now
      }]
    : note.completions.filter((completion) => !(completion.context === context && sameDay(completion.date, state.selectedDate)));
  const completedContexts = shouldBeDone
    ? uniqueStrings([...note.completedContexts, key])
    : note.completedContexts.filter((entry) => entry !== key);

  return { completions, completedContexts };
}

function updatedAcknowledgementState(note, context, shouldBeAcknowledged, now) {
  const scopeType = "user";
  const scopeID = state.currentUser.id;
  const withoutCurrent = note.acknowledgements.filter((acknowledgement) => {
    return !(acknowledgement.context === context
      && acknowledgement.scopeType === scopeType
      && acknowledgement.scopeID === scopeID);
  });

  if (!shouldBeAcknowledged) {
    return withoutCurrent;
  }

  return [...withoutCurrent, {
    id: crypto.randomUUID(),
    context,
    scopeType,
    scopeID,
    author: currentDisplayName(),
    authorIdentifier: state.currentUser.id,
    date: now
  }];
}

async function updateNote(noteID, patch) {
  setStatus("Enregistrement...");
  await updateDoc(doc(db, "handoverNotes", noteID), patch);
  setStatus("Données synchronisées");
}

function noteBelongsToContext(note, context) {
  if (context === generalName) {
    return note.isGeneral;
  }

  return note.simulatorNames.includes(context);
}

function matchesSelection(note, context, options = {}) {
  if (state.showTagged && options.includeTaggedFilter !== false && !matchesTaggedFilter(note, context)) {
    return false;
  }

  if (state.search) {
    return !note.deletedAt || canCurrentUserViewDeletedNote(note);
  }

  if (!options.includeDeleted && !shouldShowDeletedNote(note)) {
    return false;
  }

  if (!options.includeAcknowledged && isAcknowledgedHidden(note, context) && !(state.showTagged && matchesTaggedFilter(note, context))) {
    return false;
  }

  if (isPeriodResultsMode()) {
    return matchesPeriodSelection(note, context);
  }

  if (sameDay(note.displayDate, state.selectedDate)) {
    return true;
  }

  const noteDay = startOfDay(note.displayDate);
  const selectedDay = startOfDay(state.selectedDate);
  const today = startOfDay(new Date());
  return noteDay < selectedDay
    && selectedDay <= today
    && (!isCompletedBefore(note, selectedDay, context) || isDoneBadgeVisibleInContext(note, context));
}

function shouldShowDeletedNote(note) {
  if (!note.deletedAt) {
    return true;
  }

  return state.showDeleted && canCurrentUserViewDeletedNote(note);
}

function matchesPeriodSelection(note, context) {
  if (isEventActiveForCurrentView(noteCreationNewEventDate(note))) {
    return true;
  }

  return contentModificationDates(note).some((modificationDate) => {
    return isEventActiveForCurrentView(modificationDate);
  });
}

function isAcknowledgedHidden(note, context) {
  return !isPeriodResultsMode()
    && !state.showAcknowledged
    && !isDoneInContext(note, context)
    && isAcknowledgedInContext(note, context)
    && !hasContentModificationAfterAcknowledgement(note, context);
}

function matchesSearch(note) {
  const terms = state.search
    .toLocaleLowerCase("fr")
    .split(/\s+/)
    .filter(Boolean);

  if (terms.length === 0) {
    return true;
  }

  const haystack = `${note.title} ${note.text}`.toLocaleLowerCase("fr");
  return terms.some((term) => haystack.includes(term));
}

function compareNotes(a, b) {
  const priorityRankA = priorityRank(a.priority);
  const priorityRankB = priorityRank(b.priority);
  if (priorityRankA !== priorityRankB) {
    return priorityRankA - priorityRankB;
  }

  const newRankA = newSortRank(a);
  const newRankB = newSortRank(b);
  if (newRankA !== newRankB) {
    return newRankA - newRankB;
  }

  const activityDateA = noteSortingActivityDate(a)?.getTime() || 0;
  const activityDateB = noteSortingActivityDate(b)?.getTime() || 0;
  if (activityDateA !== activityDateB) {
    return activityDateB - activityDateA;
  }

  return (b.displayDate?.getTime() || 0) - (a.displayDate?.getTime() || 0)
    || (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0);
}

function comparePeriodNotes(a, b) {
  const activityDateA = noteSortingActivityDate(a)?.getTime() || 0;
  const activityDateB = noteSortingActivityDate(b)?.getTime() || 0;
  if (activityDateA !== activityDateB) {
    return activityDateB - activityDateA;
  }

  return (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)
    || String(a.id || "").localeCompare(String(b.id || ""), "fr");
}

function noteSortingActivityDate(note) {
  return latestContentModificationDate(note) || note.displayDate || note.createdAt || null;
}

function isDailyTagged(noteID) {
  const tagDate = isoDate(state.selectedDate);
  return state.dailyTags.some((tag) => tag.noteID === noteID && tag.tagDate === tagDate);
}

function matchesTaggedFilter(note, context) {
  return isDailyTagged(note.id)
    || isNew(note)
    || isModificationNewBadgeVisible(note, context);
}

function isModificationNewBadgeVisible(note, context) {
  const modificationDate = latestContentModificationDate(note);
  if (!modificationDate) {
    return false;
  }

  const acknowledgementDate = acknowledgementDateInContext(note, context);
  if (acknowledgementDate && acknowledgementDate >= modificationDate) {
    return false;
  }

  return isEventActiveForCurrentView(modificationDate);
}

async function toggleDailyTag(noteID) {
  if (!noteID || !state.currentUser?.id) {
    return;
  }

  const userIdentifier = state.currentUser.id;
  const tagDates = dailyTagDatesForCurrentToggle();
  if (isDailyTagged(noteID)) {
    await Promise.all(tagDates.map((tagDate) => {
      return deleteDoc(doc(db, "dailyTags", dailyTagDocumentID(noteID, userIdentifier, tagDate)));
    }));
  } else {
    await Promise.all(tagDates.map((tagDate) => {
      const documentID = dailyTagDocumentID(noteID, userIdentifier, tagDate);
      return setDoc(doc(db, "dailyTags", documentID), {
        id: documentID,
        noteID,
        userIdentifier,
        tagDate,
        updatedAt: new Date()
      }, { merge: true });
    }));
  }
}

function dailyTagDatesForCurrentToggle() {
  const selectedDay = startOfDay(state.selectedDate);
  const dates = [isoDate(selectedDay)];
  if (shouldExtendNightTagToNextDay(selectedDay)) {
    dates.push(isoDate(addDays(selectedDay, 1)));
  }
  return dates;
}

function shouldExtendNightTagToNextDay(day) {
  const teamID = state.currentUser?.team;
  if (!teamID || !sameDay(day, new Date())) {
    return false;
  }

  return teamPresences(day).some((presence) => {
    return presence.team.id === teamID && presence.shift.id === "night";
  });
}

function dailyTagDocumentID(noteID, userIdentifier, tagDate) {
  return `${firestoreDocumentID(userIdentifier)}_${tagDate}_${noteID}`;
}

function dailyTagFromSnapshot(id, data) {
  const noteID = stringValue(data.noteID);
  const userIdentifier = stringValue(data.userIdentifier);
  const tagDate = stringValue(data.tagDate);
  if (!noteID || !userIdentifier || !tagDate) {
    return null;
  }

  return {
    id: stringValue(data.id, id),
    noteID,
    userIdentifier,
    tagDate,
    updatedAt: dateValue(data.updatedAt)
  };
}

function firestoreDocumentID(value) {
  const cleaned = stringValue(value).replaceAll("/", "_");
  return cleaned || crypto.randomUUID();
}

function newSortRank(note) {
  if (isEventActiveForCurrentView(noteCreationNewEventDate(note))) {
    return 0;
  }

  const modificationDate = latestContentModificationDate(note);
  if (modificationDate && isEventActiveForCurrentView(modificationDate)) {
    return 1;
  }

  return 2;
}

function isDoneInContext(note, context) {
  if (note.completions.some((completion) => completion.context === context && sameDay(completion.date, state.selectedDate))) {
    return true;
  }

  return note.completedContexts.includes(completionStorageKey(context, state.selectedDate));
}

function isDoneBadgeVisibleInContext(note, context) {
  return note.completions.some((completion) => {
    return completion.context === context && isEventActiveForCurrentView(completion.date);
  }) || isDoneInContext(note, context);
}

function isCompletedBefore(note, day, context) {
  return note.completions.some((completion) => completion.context === context && startOfDay(completion.date) < startOfDay(day));
}

function isAcknowledgedInContext(note, context) {
  if (!state.currentUser) {
    return false;
  }

  return note.acknowledgements.some((acknowledgement) => {
    return acknowledgement.context === context
      && acknowledgement.scopeType === "user"
      && acknowledgement.scopeID === state.currentUser.id;
  });
}

function acknowledgementDateInContext(note, context) {
  const dates = note.acknowledgements
    .filter((acknowledgement) => {
      return state.currentUser
        && acknowledgement.context === context
        && acknowledgement.scopeType === "user"
        && acknowledgement.scopeID === state.currentUser.id;
    })
    .map((acknowledgement) => acknowledgement.date)
    .filter(Boolean)
    .sort((a, b) => b - a);
  return dates[0] || null;
}

function hasContentModificationAfterAcknowledgement(note, context) {
  const modificationDate = latestContentModificationDate(note);
  if (!modificationDate) {
    return false;
  }

  const acknowledgementDate = acknowledgementDateInContext(note, context);
  if (!acknowledgementDate) {
    return isAcknowledgedInContext(note, context);
  }

  return acknowledgementDate < modificationDate;
}

function latestContentModificationDate(note) {
  return contentModificationDates(note).at(-1) || null;
}

function contentModificationDates(note) {
  return note.revisions
    .slice(1)
    .filter((revision) => revision.date)
    .filter((revision) => {
      return isPublicContentRevision(revision)
        && !shouldHideSameDayAuthorModification(revision, note);
    })
    .map((revision) => revision.date)
    .sort((a, b) => a - b);
}

function noteCreationNewEventDate(note) {
  return dateWithTime(note.firstDisplayDate || note.displayDate || note.createdAt, note.createdAt);
}

function dateWithTime(dayDate, timeDate) {
  if (!dayDate || !timeDate) {
    return dayDate || timeDate || null;
  }

  return new Date(
    dayDate.getFullYear(),
    dayDate.getMonth(),
    dayDate.getDate(),
    timeDate.getHours(),
    timeDate.getMinutes(),
    timeDate.getSeconds(),
    timeDate.getMilliseconds()
  );
}

function sameTimestamp(a, b) {
  return Boolean(a && b) && Math.abs(a.getTime() - b.getTime()) < 1000;
}

function carryOverDayCount(note) {
  const noteDay = startOfDay(note.displayDate);
  const range = selectedPeriodRange();
  const selectedDay = isPeriodResultsMode() && range ? range.end : startOfDay(state.selectedDate);
  if (noteDay >= selectedDay) {
    return null;
  }

  const firstPositionDay = startOfDay(note.firstDisplayDate || note.displayDate);
  return Math.max(daysBetween(firstPositionDay, selectedDay), 1);
}

function modificationBadgeTitle(note, context, newBadge, carryOver) {
  if (newBadge || !carryOver) {
    return null;
  }

  const modificationDate = latestContentModificationDate(note);
  if (!modificationDate) {
    return null;
  }

  const acknowledgementDate = acknowledgementDateInContext(note, context);
  if (acknowledgementDate && acknowledgementDate >= modificationDate) {
    return null;
  }

  const range = selectedPeriodRange();
  const selectedDay = isPeriodResultsMode() && range ? range.end : startOfDay(state.selectedDate);
  if (isEventActiveForCurrentView(modificationDate)) {
    return "NEW";
  }

  const modificationDay = startOfDay(modificationDate);
  if (modificationDay >= selectedDay) {
    return null;
  }

  return `+${Math.max(daysBetween(modificationDay, selectedDay), 1)}`;
}

function renderAgeBadge(noteID, carryOver, modificationTitle, isTagged) {
  return `
    <span class="age-badge" title="Appui long pour taguer la consigne">
      <span class="age-badge-part age-created" data-tag-note-id="${escapeAttribute(noteID)}">J+${carryOver}</span>
      ${modificationTitle ? `<span class="age-badge-part age-modified" data-tag-note-id="${escapeAttribute(noteID)}">${modificationTitle}</span>` : ""}
      ${isTagged ? `<span class="age-badge-part age-tagged" data-tag-note-id="${escapeAttribute(noteID)}">⚑</span>` : ""}
    </span>
  `;
}

function renderNewAgeBadge(noteID, isTagged) {
  return `
    <span class="age-badge age-badge-new" title="Appui long pour taguer la consigne">
      <span class="age-badge-part age-new" data-tag-note-id="${escapeAttribute(noteID)}">NEW</span>
      ${isTagged ? `<span class="age-badge-part age-tagged" data-tag-note-id="${escapeAttribute(noteID)}">⚑</span>` : ""}
    </span>
  `;
}

function timelineEvents(note, context) {
  const sortedRevisions = timelineRevisionsForCurrentUser(note);
  const events = [{
    date: note.createdAt || note.firstDisplayDate || note.displayDate,
    title: "Creation",
    author: note.author,
    authorIdentifier: note.authorIdentifier || note.author,
    detail: creationAssignmentDetail(note),
    kind: "creation",
    hasDisclosure: true
  }];

  let previousRevisionText = creationTextForNote(note);

  for (const revision of sortedRevisions) {
    if (!revision.date) {
      continue;
    }

    events.push({
      date: revision.date,
      title: revisionTitle(revision),
      author: revision.author,
      authorIdentifier: revision.authorIdentifier || revision.author,
      revisions: [revision],
      previousText: previousRevisionText,
      kind: "revision",
      hasDisclosure: true
    });
    previousRevisionText = revision.text;
  }

  for (const completion of note.completions.filter((record) => record.context === context)) {
    events.push({
      date: completion.date,
      title: "Cloture",
      author: completion.author,
      authorIdentifier: completion.authorIdentifier || completion.author,
      context,
      kind: "completion",
      hasDisclosure: false
    });
  }

  for (const acknowledgement of note.acknowledgements.filter((record) => record.context === context)) {
    events.push({
      date: acknowledgement.date,
      title: "Pris en compte",
      author: acknowledgement.author,
      authorIdentifier: acknowledgement.authorIdentifier || acknowledgement.author,
      context,
      kind: "acknowledgement",
      hasDisclosure: false
    });
  }

  if (note.deletedAt) {
    events.push({
      date: note.deletedAt,
      title: "Suppression",
      author: note.deletedBy,
      authorIdentifier: note.deletedByIdentifier || note.deletedBy,
      detail: "",
      kind: "deletion",
      hasDisclosure: false
    });
  }

  return mergeConsecutiveTimelineRevisions(events
    .filter((event) => event.date)
    .sort((a, b) => a.date - b.date));
}

function timelineRevisionsForCurrentUser(note) {
  const revisionsAfterCreation = note.revisions
    .slice(1)
    .filter((revision) => revision.date)
    .sort((a, b) => a.date - b.date);

  return revisionsAfterCreation.filter((revision) => {
    if (!canViewTimelineAuthors() && !isVisibleInStandardTimeline(revision)) {
      return false;
    }

    return !shouldHideSameDayAuthorModification(revision, note);
  });
}

function isVisibleInStandardTimeline(revision) {
  return isPublicContentRevision(revision)
    || Boolean(revision.previousDisplayDate || revision.newDisplayDate)
    || Boolean(revision.previousPriorityRawValue || revision.newPriorityRawValue);
}

function isPublicContentRevision(revision) {
  return revision.isVisibleToOthers !== false
    && !revision.previousDisplayDate
    && !revision.newDisplayDate
    && !revision.previousPriorityRawValue
    && !revision.newPriorityRawValue;
}

function shouldHideSameDayAuthorModification(revision, note) {
  if (revision.previousDisplayDate || revision.newDisplayDate || revision.previousPriorityRawValue || revision.newPriorityRawValue) {
    return false;
  }

  if (!sameDay(revision.date, note.createdAt)) {
    return false;
  }

  return normalizeRevisionAuthor(revision) === normalizeKey(note.authorIdentifier || note.author);
}

function normalizeRevisionAuthor(revision) {
  return normalizeKey(revision.authorIdentifier || revision.author);
}

function renderTimelineEvent(event, index) {
  const meta = timelineMeta(event);
  const isCreation = event.kind === "creation";
  const rowAttributes = isCreation
    ? " data-creation-text"
    : event.hasDisclosure
      ? ` data-timeline-event-index="${index}"`
      : "";
  const chevron = event.hasDisclosure || isCreation ? "<span class=\"timeline-chevron\">›</span>" : "";

  return `
    <button class="timeline-event${event.hasDisclosure || isCreation ? " has-detail" : ""}" type="button"${rowAttributes}>
      <strong>${escapeHtml(event.title)}</strong>
      <div class="timeline-meta">
        <span>${escapeHtml(meta)}</span>
        ${chevron}
      </div>
    </button>
  `;
}

function timelineMeta(event) {
  const parts = [];
  if (event.context) {
    parts.push(event.context);
  }
  if (event.author) {
    parts.push(event.author);
  }
  parts.push(formatTimelineDate(event.date));
  if (event.detail) {
    parts.push(event.detail);
  }
  return parts.join(" · ");
}

function creationAssignmentDetail(note) {
  const createdAt = note.createdAt;
  const assignedDate = note.firstDisplayDate || note.displayDate;
  if (!createdAt || !assignedDate || sameDay(createdAt, assignedDate)) {
    return "";
  }

  return `Affectée au ${formatShortDate(assignedDate)}`;
}

function openTimelineTextModal(index) {
  const event = state.detailTimelineEvents[index];
  if (!event || event.kind !== "revision") {
    return;
  }

  const note = state.selectedDetail
    ? state.notes.find((candidate) => candidate.id === state.selectedDetail.noteId)
    : null;
  openRevisionTextModal({
    dateLabel: timelineModalDateLabel(event),
    html: revisionTimelineDetailHTML(event.revisions || [], event.previousText),
    canUndo: Boolean(note && canUndoTimelineEvent(note, event))
  });
}

function canUndoTimelineEvent(note, event) {
  const latestRevision = latestUndoableModification(note);
  return Boolean(
    latestRevision
    && canUndoLatestModification(note)
    && (event.revisions || []).some((revision) => revision.id === latestRevision.id)
  );
}

function timelineModalDateLabel(event) {
  const revisions = event.revisions || [];
  if (revisions.length > 1 && revisions[0]?.date && revisions.at(-1)?.date) {
    return `${formatTimelineDate(revisions[0].date)} → ${formatTimelineDate(revisions.at(-1).date)}`;
  }

  return formatTimelineDate(event.date);
}

function revisionTimelineDetailHTML(revisions, initialPreviousText) {
  const blocks = [];
  let previousText = initialPreviousText;

  for (const revision of revisions) {
    const revisionBlocks = [];

    if (revisions.length > 1) {
      revisionBlocks.push(`<div class="revision-date-label">${escapeHtml(formatTimelineDate(revision.date))}</div>`);
    }

    if (revision.previousDisplayDate || revision.newDisplayDate) {
      revisionBlocks.push(`
        <div class="timeline-change-block">
          <strong>Changement de date</strong>
          <span>${escapeHtml(formatShortDate(revision.previousDisplayDate))} → ${escapeHtml(formatShortDate(revision.newDisplayDate))}</span>
        </div>
      `);
    }

    if (revision.previousPriorityRawValue || revision.newPriorityRawValue) {
      revisionBlocks.push(`
        <div class="timeline-change-block">
          <strong>Changement de priorité</strong>
          <span>${escapeHtml(priorityLabel(revision.previousPriorityRawValue) || "Info")} → ${escapeHtml(priorityLabel(revision.newPriorityRawValue) || "Info")}</span>
        </div>
      `);
    }

    const text = stringValue(revision.text).trim();
    if (previousText && previousText !== revision.text) {
      revisionBlocks.push(`<div>${renderTextDiff(previousText, revision.text)}</div>`);
    } else if (text) {
      revisionBlocks.push(`<div>${escapeHtml(text)}</div>`);
    }

    if (revisionBlocks.length) {
      blocks.push(`<div class="revision-entry">${revisionBlocks.join("")}</div>`);
    }

    previousText = revision.text;
  }

  return blocks.join("");
}

function renderTextDiff(oldText, newText) {
  return diffOperations(tokenizeForDiff(oldText), tokenizeForDiff(newText))
    .map((operation) => {
      const token = escapeHtml(operation.token);
      if (operation.type === "added") {
        return `<span class="diff-added">${token}</span>`;
      }
      if (operation.type === "removed") {
        return `<span class="diff-removed">${token}</span>`;
      }
      return token;
    })
    .join("");
}

function tokenizeForDiff(text) {
  const tokens = [];
  let current = "";
  let currentIsWhitespace = null;

  for (const character of String(text || "")) {
    const isWhitespace = /\s/u.test(character);
    if (current && currentIsWhitespace !== isWhitespace) {
      tokens.push(current);
      current = character;
    } else {
      current += character;
    }
    currentIsWhitespace = isWhitespace;
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
}

function diffOperations(oldTokens, newTokens) {
  const oldCount = oldTokens.length;
  const newCount = newTokens.length;
  const table = Array.from({ length: oldCount + 1 }, () => Array(newCount + 1).fill(0));

  for (let oldIndex = oldCount - 1; oldIndex >= 0; oldIndex -= 1) {
    for (let newIndex = newCount - 1; newIndex >= 0; newIndex -= 1) {
      table[oldIndex][newIndex] = oldTokens[oldIndex] === newTokens[newIndex]
        ? table[oldIndex + 1][newIndex + 1] + 1
        : Math.max(table[oldIndex + 1][newIndex], table[oldIndex][newIndex + 1]);
    }
  }

  const operations = [];
  let oldIndex = 0;
  let newIndex = 0;

  while (oldIndex < oldCount || newIndex < newCount) {
    if (oldIndex < oldCount && newIndex < newCount && oldTokens[oldIndex] === newTokens[newIndex]) {
      operations.push({ type: "unchanged", token: oldTokens[oldIndex] });
      oldIndex += 1;
      newIndex += 1;
    } else if (newIndex < newCount && (oldIndex === oldCount || table[oldIndex][newIndex + 1] >= table[oldIndex + 1][newIndex])) {
      operations.push({ type: "added", token: newTokens[newIndex] });
      newIndex += 1;
    } else if (oldIndex < oldCount) {
      operations.push({ type: "removed", token: oldTokens[oldIndex] });
      oldIndex += 1;
    }
  }

  return operations;
}

function mergeConsecutiveTimelineRevisions(events) {
  return events.reduce((merged, event) => {
    const previous = merged[merged.length - 1];
    if (previous
      && previous.kind === "revision"
      && event.kind === "revision"
      && normalizeEventAuthor(previous) === normalizeEventAuthor(event)
      && previous.title === event.title) {
      previous.date = event.date;
      previous.revisions = [...(previous.revisions || []), ...(event.revisions || [])];
      return merged;
    }

    merged.push({ ...event });
    return merged;
  }, []);
}

function normalizeEventAuthor(event) {
  return normalizeKey(event.authorIdentifier || event.author);
}

function revisionTitle(revision) {
  if (revision.previousDisplayDate || revision.newDisplayDate) {
    return "Changement de date";
  }

  if (revision.previousPriorityRawValue || revision.newPriorityRawValue) {
    return "Changement de priorité";
  }

  return isPublicContentRevision(revision) ? "Modification" : "Modification non signalee";
}

function revisionDetail(revision) {
  if (revision.previousDisplayDate || revision.newDisplayDate) {
    return `${formatShortDate(revision.previousDisplayDate)} → ${formatShortDate(revision.newDisplayDate)}`;
  }

  if (revision.previousPriorityRawValue || revision.newPriorityRawValue) {
    return `${priorityLabel(revision.previousPriorityRawValue) || "Info"} → ${priorityLabel(revision.newPriorityRawValue) || "Info"}`;
  }

  return stringValue(revision.text).trim();
}

function canViewTimelineAuthors() {
  return isAdminSession() || state.currentUser?.role === "teamLeader";
}

function canCurrentUserViewDeletedNotes() {
  return isAdminSession() || state.currentUser?.role === "teamLeader";
}

function canCurrentUserViewDeletedNote(note) {
  if (!note.deletedAt) {
    return true;
  }

  if (!canCurrentUserViewDeletedNotes()) {
    return false;
  }

  if (state.currentUser?.role === "admin") {
    return true;
  }

  if (state.currentUser?.role === "teamLeader" && wasDeletedByOriginalAuthorTodayUnmodified(note)) {
    return false;
  }

  return true;
}

function wasDeletedByOriginalAuthorTodayUnmodified(note) {
  if (!note.deletedAt || !note.createdAt || !sameDay(note.createdAt, note.deletedAt)) {
    return false;
  }

  const originalAuthorKey = normalizeKey(note.authorIdentifier || note.author);
  if (!originalAuthorKey || normalizeKey(note.deletedByIdentifier || note.deletedBy) !== originalAuthorKey) {
    return false;
  }

  return note.revisions.slice(1).every((revision) => {
    return normalizeRevisionAuthor(revision) === originalAuthorKey;
  });
}

function canCurrentUserDeleteNote(note) {
  if (state.currentUser?.role === "admin" || state.currentUser?.role === "teamLeader") {
    return true;
  }

  return canCurrentAuthorDeleteOwnTodayUnmodified(note);
}

function canCurrentAuthorDeleteOwnTodayUnmodified(note) {
  if (!state.currentUser || state.currentUser.role !== "technician") {
    return false;
  }

  if (!isCurrentAuthor(note) || !note.createdAt || !sameDay(note.createdAt, new Date())) {
    return false;
  }

  const currentKey = normalizeKey(state.currentUser.id);
  return note.revisions.slice(1).every((revision) => {
    return normalizeRevisionAuthor(revision) === currentKey;
  });
}

function isCurrentAuthor(note) {
  return normalizeKey(note.authorIdentifier || note.author) === normalizeKey(state.currentUser?.id);
}

function canCurrentUserWrite() {
  return Boolean(state.currentUser?.role) && state.currentUser.role !== "consultation";
}

function canCurrentUserEditDate() {
  return state.currentUser?.role === "admin" || state.currentUser?.role === "teamLeader";
}

function priorityRank(priority) {
  if (priority === "urgent") return 0;
  if (priority === "soon") return 1;
  if (priority === "whenever") return 2;
  return 3;
}

function priorityLabel(priority) {
  if (priority === "urgent") return "Urgent";
  if (priority === "soon") return "A traiter rapidement";
  if (priority === "whenever") return "ASAP";
  return "";
}

function priorityColor(priority) {
  if (priority === "urgent") return "#ff4b55";
  if (priority === "soon") return "#ff8a24";
  if (priority === "whenever") return "#35c759";
  return "#94a3b8";
}

function priorityBackground(priority) {
  if (priority === "urgent") return "rgba(255, 75, 85, 0.12)";
  if (priority === "soon") return "rgba(255, 138, 36, 0.16)";
  if (priority === "whenever") return "rgba(53, 199, 89, 0.13)";
  return "rgba(148, 163, 184, 0.18)";
}

function isNew(note) {
  return isEventActiveForCurrentView(noteCreationNewEventDate(note));
}

function isEventActiveForCurrentView(eventDate) {
  if (!eventDate) {
    return false;
  }

  const range = selectedPeriodRange();
  if (!isPeriodResultsMode() || !range) {
    return isEventNewForViewer(eventDate, state.selectedDate);
  }

  let day = range.start;
  while (day <= range.end) {
    if (isEventNewForViewer(eventDate, day)) {
      return true;
    }
    day = addDays(day, 1);
  }

  return false;
}

function isEventNewForViewer(eventDate, selectedDate) {
  if (!eventDate || !selectedDate) {
    return false;
  }

  const sourceSlot = vacationSlotContaining(eventDate);
  if (!sourceSlot) {
    return sameDay(eventDate, selectedDate);
  }

  const selectedSlots = visibleVacationSlotsForDay(selectedDate);
  if (!selectedSlots.length) {
    return sameDay(eventDate, selectedDate);
  }

  return selectedSlots.some((selectedSlot) => {
    return newVacationSlotsFrom(sourceSlot).some((slot) => sameVacationSlot(slot, selectedSlot));
  });
}

function newVacationSlotsFrom(sourceSlot) {
  const slotCount = isWeekendDay(sourceSlot.day) ? 2 : 3;
  const slots = vacationSlotsAround(sourceSlot.day, 4);
  const sourceIndex = slots.findIndex((slot) => sameVacationSlot(slot, sourceSlot));
  if (sourceIndex < 0) {
    return [sourceSlot];
  }

  return slots.slice(sourceIndex, sourceIndex + slotCount);
}

function vacationSlotContaining(date) {
  const day = startOfDay(date);
  const slots = [
    ...vacationSlotsForDay(addDays(day, -1)),
    ...vacationSlotsForDay(day),
    ...vacationSlotsForDay(addDays(day, 1))
  ];
  return slots.find((slot) => date >= slot.start && date < slot.end) || null;
}

function vacationSlotsAround(day, daysAfter) {
  const start = addDays(day, -1);
  const slots = [];
  for (let offset = 0; offset <= daysAfter + 1; offset += 1) {
    slots.push(...vacationSlotsForDay(addDays(start, offset)));
  }

  return slots.sort((a, b) => a.start - b.start);
}

function vacationSlotsForDay(day) {
  const weekend = isWeekendDay(day);
  return teamPresences(day)
    .filter((presence) => !weekend || presence.shift.id !== "evening")
    .map((presence) => {
      const interval = vacationInterval(day, presence.shift.id, weekend);
      return interval ? {
        day: startOfDay(day),
        teamID: presence.team.id,
        shiftID: presence.shift.id,
        start: interval.start,
        end: interval.end
      } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.start - b.start || a.teamID.localeCompare(b.teamID, "fr"));
}

function visibleVacationSlotsForDay(day) {
  const selectedDay = startOfDay(day);
  const slots = vacationSlotsForDay(selectedDay);
  const now = new Date();
  const today = startOfDay(now);
  const morningSwitch = dateAt(selectedDay, 6, 0);

  if (!sameDay(selectedDay, today) || now >= morningSwitch) {
    return slots;
  }

  const previousDay = addDays(selectedDay, -1);
  const previousNightSlots = vacationSlotsForDay(previousDay).filter((slot) => {
    return slot.shiftID === "night" && now >= slot.start && now < slot.end;
  });

  return [...previousNightSlots, ...slots];
}

function vacationInterval(day, shiftID, weekend) {
  if (weekend) {
    if (shiftID === "morning") return { start: dateAt(day, 6, 20), end: dateAt(day, 18, 20) };
    if (shiftID === "night") return { start: dateAt(day, 18, 20), end: dateAt(addDays(day, 1), 6, 20) };
    return null;
  }

  if (shiftID === "morning") return { start: dateAt(day, 6, 20), end: dateAt(day, 14, 25) };
  if (shiftID === "evening") return { start: dateAt(day, 14, 0), end: dateAt(day, 22, 30) };
  if (shiftID === "night") return { start: dateAt(day, 22, 0), end: dateAt(addDays(day, 1), 6, 30) };
  return null;
}

function dateAt(day, hour, minute) {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute, 0, 0);
}

function isWeekendDay(day) {
  const weekday = day.getDay();
  return weekday === 0 || weekday === 6;
}

function sameVacationSlot(a, b) {
  return Boolean(a && b)
    && a.shiftID === b.shiftID
    && sameDay(a.day, b.day);
}

function highlight(value) {
  const escaped = escapeHtml(value);
  const terms = state.search
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean)
    .map(escapeRegExp);

  if (terms.length === 0) {
    return escaped;
  }

  return escaped.replace(new RegExp(`(${terms.join("|")})`, "gi"), "<mark>$1</mark>");
}

function setStatus(message) {
  elements.syncStatus.textContent = message;
}

function dateValue(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === "number") return swiftReferenceDate(value);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function decodeRecordArray(value) {
  const raw = stringValue(value);
  if (!raw) {
    return [];
  }

  try {
    const json = decodeBase64UTF8(raw);
    const records = JSON.parse(json);
    return Array.isArray(records) ? records.map(normalizeRecordDates) : [];
  } catch {
    try {
      const records = JSON.parse(atob(raw));
      return Array.isArray(records) ? records.map(normalizeRecordDates) : [];
    } catch {
      return [];
    }
  }
}

function decodeBase64UTF8(value) {
  const binary = atob(value);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
}

function encodeRecordArray(records) {
  const json = JSON.stringify(records.map(encodeRecordDates));
  return btoa(unescape(encodeURIComponent(json)));
}

function encodeRecordDates(record) {
  const encoded = { ...record };
  for (const [key, value] of Object.entries(encoded)) {
    if (value instanceof Date) {
      encoded[key] = secondsSinceSwiftReferenceDate(value);
    }
  }
  return encoded;
}

function normalizeRecordDates(record) {
  const normalized = { ...record };
  for (const [key, value] of Object.entries(normalized)) {
    if (key.toLowerCase().includes("date")) {
      normalized[key] = dateValue(value);
    }
  }
  return normalized;
}

function stringValue(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function numberValue(value, fallback = 0) {
  return typeof value === "number" ? value : fallback;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function swiftReferenceDate(seconds) {
  return new Date(Date.UTC(2001, 0, 1) + seconds * 1000);
}

function secondsSinceSwiftReferenceDate(date) {
  return (date.getTime() - Date.UTC(2001, 0, 1)) / 1000;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return startOfDay(next);
}

function addMonths(date, months) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function parseDateInput(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function sameDay(a, b) {
  return Boolean(a && b) && isoDate(a) === isoDate(b);
}

function daysBetween(start, end) {
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return Math.round((startOfDay(end) - startOfDay(start)) / millisecondsPerDay);
}

function completionStorageKey(context, day) {
  return `${context}#${day.getFullYear()}-${day.getMonth() + 1}-${day.getDate()}`;
}

function uniqueStrings(values) {
  return [...new Set(values.filter(Boolean))];
}

function currentDisplayName() {
  if (!state.currentUser) {
    return "";
  }

  return [state.currentUser.firstName, state.currentUser.lastName].filter(Boolean).join(" ") || state.currentUser.id;
}

function currentDisplayNameForUser(user) {
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.id || "Utilisateur";
}

function shouldMaskAdminAccessCode(user) {
  return Boolean(user.isAccessCodeUserDefined) || !stringValue(user.accessCode).trim();
}

function isAdminSession() {
  return state.currentUser?.role === "admin" || state.currentUser?.documentID === "ADMIN" || state.currentUser?.id === "ADMIN";
}

function currentUserDocumentID() {
  if (!state.currentUser) {
    return "";
  }

  if (state.currentUser.documentID && state.currentUser.documentID !== "ADMIN") {
    return state.currentUser.documentID;
  }

  const normalizedID = normalizeKey(state.currentUser.id);
  const matchedUser = state.users.find((user) => normalizeKey(user.id) === normalizedID);
  return matchedUser?.documentID || "";
}

function teamPresences(date) {
  const cycle = [
    ...repeatShift("morning", 4),
    ...repeatShift(null, 3),
    ...repeatShift("night", 4),
    ...repeatShift(null, 3),
    ...repeatShift("evening", 2),
    ...repeatShift(null, 2),
    ...repeatShift("night", 3),
    ...repeatShift(null, 4),
    ...repeatShift("morning", 3),
    ...repeatShift(null, 2),
    ...repeatShift("evening", 3),
    ...repeatShift(null, 2)
  ];
  const starts = [
    { team: "team1", start: "2026-05-25" },
    { team: "team2", start: "2026-05-18" },
    { team: "team3", start: "2026-05-11" },
    { team: "team4", start: "2026-05-04" },
    { team: "team5", start: "2026-06-01" }
  ];

  return starts
    .map((entry) => {
      const offset = daysBetween(parseDateInput(entry.start), date);
      const shiftID = cycle[positiveModulo(offset, cycle.length)];
      return shiftID ? { team: teamInfo(entry.team), shift: shiftInfo(shiftID) } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.shift.rank - b.shift.rank || a.team.title.localeCompare(b.team.title, "fr"));
}

function repeatShift(shift, count) {
  return Array.from({ length: count }, () => shift);
}

function positiveModulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function teamInfo(team) {
  const labels = {
    team1: "Equipe 1",
    team2: "Equipe 2",
    team3: "Equipe 3",
    team4: "Equipe 4",
    team5: "Equipe 5",
    support: "Support"
  };
  return { id: team, title: labels[team] || team || "" };
}

function shiftInfo(shift) {
  const shifts = {
    morning: { id: "morning", title: "Matin", rank: 0 },
    evening: { id: "evening", title: "Soir", rank: 1 },
    night: { id: "night", title: "Nuit", rank: 2 }
  };
  return shifts[shift];
}

function nullableString(value) {
  return value ? value : "";
}

function normalizeColor(value) {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#2f80ed";
}

function generateAccessCode() {
  const existingCodes = new Set(state.users.map((user) => user.accessCode).filter(Boolean));
  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    if (!existingCodes.has(code)) {
      return code;
    }
  }
  return String(Date.now()).slice(-6);
}

function cssEscape(value) {
  if (window.CSS?.escape) {
    return CSS.escape(value);
  }

  return String(value).replaceAll('"', '\\"');
}

function normalizeKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLocaleLowerCase("fr");
}

function isoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatLongDate(date) {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(date);
}

function formatShortDate(date) {
  if (!date) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
}

function formatDateTime(date) {
  if (!date) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function formatTimelineDate(date) {
  if (!date) return "";
  const datePart = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(date);
  const timePart = new Intl.DateTimeFormat("fr-FR", {
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
  return `${datePart} à ${timePart}`;
}

function userRoleLabel(role, team) {
  const roleLabel = role === "teamLeader" ? "Chef d'équipe" : role === "technician" ? "Technicien" : role === "admin" ? "Admin" : "Consultation";
  return [roleLabel, teamInfo(team).title].filter(Boolean).join(" · ");
}

function userRoleMetaHTML(role, team) {
  const roleLabel = role === "teamLeader" ? "Chef d'équipe" : role === "technician" ? "Technicien" : role === "admin" ? "Admin" : "Consultation";
  const teamLabel = teamInfo(team).title;
  return [roleLabel, teamLabel]
    .filter(Boolean)
    .map((label) => `<span>${escapeHtml(label)}</span>`)
    .join("");
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
