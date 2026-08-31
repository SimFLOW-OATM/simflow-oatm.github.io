import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithCustomToken, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection,
  deleteField,
  deleteDoc,
  doc,
  getDoc,
  getFirestore,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";

const firebaseConfig = {
  apiKey: "AIzaSyDgYt_QMvFDcf0ZwG7-MKa8ChLriUVUqcY",
  authDomain: "simflow-51d5f.firebaseapp.com",
  projectId: "simflow-51d5f",
  storageBucket: "simflow-51d5f.firebasestorage.app",
  messagingSenderId: "679924137342",
  appId: "1:679924137342:ios:a9f38cd74eab4120f9472f"
};

const generalName = "General";
const generalSimulatorID = "00000000-0000-0000-0000-000000000001";
const WEB_APP_VERSION = "1.87a";
const userGuideURL = "./assets/Guide%20utilisateur%20SimFLOW.pdf";
const deletedLegacySimulatorNames = new Set(["Simu", "Simu 1", "Simu 2", "Simu 3", "Simu 4", "Simu Tes", "Simu test 2", "Simu Test 2"]);
const sessionStorageKey = "simflow.web.currentUser";
const planningStorageKey = "simflow.web.mandatoryPlanningRows";
const planningImportVersionStorageKey = "simflow.web.mandatoryPlanningImportVersion";
const planningFirestoreSyncStorageKey = "simflow.web.regulatoryPlanningLastSyncAt";
const regulatoryPlanningImportVersion = "2026-regulatory-table-v2";
const firestoreSyncSuspendedStorageKey = "simflow.web.firestoreSyncSuspended";
const lastActiveStorageKey = "simflow.web.lastActiveAt";
const lastSuccessfulDataRefreshStorageKey = "simflow.web.lastSuccessfulDataRefreshAt";
const archiveRealtimeRetentionDays = 4;
const activeRealtimeUntil = new Date("2100-01-01T00:00:00.000Z");
const webDeviceStorageKey = "simflow.web.deviceIdentifier";
const sessionDurationMs = 30 * 24 * 60 * 60 * 1000;
const staleDataRefreshThresholdMs = 24 * 60 * 60 * 1000;
const staleDataRefreshWarningThresholdMs = 30 * 60 * 1000;
const wakeAutoDataRefreshThresholdMs = 12 * 60 * 60 * 1000;
const activeLoginSessionWindowMs = 90 * 1000;
const loginPresenceRefreshMs = 2 * 1000;
const firestoreReadStatsFlushMs = 5 * 1000;
const planningFirestoreSyncIntervalMs = 60 * 60 * 1000;
const planningTypes = [
  { value: "fly-out-part-a", label: "Fly Out Part A" },
  { value: "fly-out-part-b", label: "Fly Out Part B" },
  { value: "fly-out-part-c", label: "Fly Out Part C" },
  { value: "fly-out-part-d", label: "Fly Out Part D" },
  { value: "dgac", label: "DGAC" },
  { value: "auto-eval", label: "Auto-Eval" },
  { value: "reunion-technique", label: "Réunion technique" }
];
const defaultPlanningType = planningTypes[0].value;
const planningFreeTechnicianValue = "__free_technician__";
const planningMonthNames = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre"
];
const importedRegulatoryPlanningRows = [
  importedPlanningRow("A350FF3", "fly-out-part-d", "2026-01-05", "14:00", "18:00", "G. Millet", "Frederic Corbalan"),
  importedPlanningRow("B777FF4", "dgac", "2026-01-07", "08:00", "16:00", "JP. Holowczak", "Francois Emaille", "GED: x"),
  importedPlanningRow("A220FF3", "fly-out-part-d", "2026-01-12", "18:00", "22:00", "F. Mansuis", "Magand", "IT CARL: X\nGED: x"),
  importedPlanningRow("B777FF3", "fly-out-part-b", "2026-01-21", "06:00", "10:00", "J. Ferreira", "Francois Emaille", "IT CARL: x\nGED: x"),
  importedPlanningRow("A350FF3", "dgac", "2026-01-22", "08:00", "16:00", "S. Alibhay", ""),
  importedPlanningRow("A350FF2", "fly-out-part-a", "2026-01-27", "18:00", "22:00", "M. Ocipski", "Frederic Corbalan", "IT CARL: x\nGED: x"),
  importedPlanningRow("A330", "fly-out-part-c", "2026-01-30", "10:00", "14:00", "M. Ichalalen", "Hocquet"),
  importedPlanningRow("B777FF4", "fly-out-part-c", "2026-02-01", "17:00", "21:00", "F. Theodose", "Francois Emaille", "IT CARL: Pas sorti\nGED: OK"),
  importedPlanningRow("A320FF7", "fly-out-part-d", "2026-02-02", "06:00", "10:00", "Y. Sene", "Gabriel Akkaoui", "IT CARL: IT076432\nGED: OK"),
  importedPlanningRow("B787", "fly-out-part-c", "2026-02-05", "06:00", "10:00", "V. Esnault", "Guyon + Parrain"),
  importedPlanningRow("A220FF2", "fly-out-part-c", "2026-02-16", "06:00", "10:00", "M. Ocipski", "Plaire", "IT CARL: X\nGED: X"),
  importedPlanningRow("A220FF1", "fly-out-part-d", "2026-02-18", "06:00", "10:00", "S. Bignon", "Plaire"),
  importedPlanningRow("A220FF3", "dgac", "2026-02-19", "", "", "M. Ocipski", "Magand"),
  importedPlanningRow("A350TD", "fly-out-part-a", "2026-02-25", "14:00", "18:00", "M. Gantois", "Valtin"),
  importedPlanningRow("B777FF4", "fly-out-part-d", "2026-03-01", "06:00", "09:30", "O. Sicourmat", "Jeandenand"),
  importedPlanningRow("B777TD", "fly-out-part-d", "2026-03-02", "14:00", "18:00", "S. Lempereur", "Emaille + Jeandenand", "IT CARL: IT076440\nGED: B777_FTD1 FR-2107_FO_PART D_Mars_2026"),
  importedPlanningRow("B777FF2", "fly-out-part-c", "2026-03-03", "10:00", "14:00", "JJ. Marie", "Jeandenand"),
  importedPlanningRow("A220FF1", "auto-eval", "2026-03-04", "", "", "S. Bignon", "Magand"),
  importedPlanningRow("A330", "fly-out-part-d", "2026-03-05", "14:30", "18:30", "V. Esnault", "Leroux"),
  importedPlanningRow("A320FF6", "fly-out-part-c", "2026-03-18", "06:00", "10:00", "M. Ichalalen", "Akkaoui"),
  importedPlanningRow("A320TD", "fly-out-part-c", "2026-03-25", "10:00", "12:00", "S. Bignon", "Akkaoui", "IT CARL: OK\nGED: OK"),
  importedPlanningRow("A320FF7", "dgac", "2026-03-26", "", "", "S. Lempereur", "Fernandes"),
  importedPlanningRow("A220TD", "fly-out-part-d", "2026-03-27", "07:00", "11:00", "M. Gantois", "Plaire"),
  importedPlanningRow("A350FF1", "fly-out-part-c", "2026-04-01", "06:00", "10:00", "R. Aragon", "Valtin", "IT CARL: x\nGED: x"),
  importedPlanningRow("A330", "dgac", "2026-04-02", "", "", "M. Ichalalen", ""),
  importedPlanningRow("B787", "fly-out-part-d", "2026-04-05", "13:10", "17:10", "O. Sicourmat", "Guyon", "IT CARL: X\nGED: X"),
  importedPlanningRow("B777FF2", "fly-out-part-d", "2026-04-06", "16:00", "20:00", "M. Le Roux", "Emaille", "IT CARL: X\nGED: X"),
  importedPlanningRow("B777FF4", "auto-eval", "2026-04-10", "", "", "G. Guinde", "Jeandenand"),
  importedPlanningRow("A350FF3", "fly-out-part-a", "2026-04-19", "16:40", "19:40", "S. Alibhay", "Corbalan"),
  importedPlanningRow("A220FF3", "fly-out-part-a", "2026-05-05", "18:00", "22:00", "D. Solente", "Plaire"),
  importedPlanningRow("A220TD", "auto-eval", "2026-05-05", "06:00", "10:00", "N. Simon", "", "FLY OUT"),
  importedPlanningRow("B787", "dgac", "2026-05-06", "", "", "L. Bicocchi", ""),
  importedPlanningRow("A320FF7", "fly-out-part-a", "2026-05-07", "06:00", "10:00", "C. De Sa", "Fernandes"),
  importedPlanningRow("B777FF3", "fly-out-part-d", "2026-05-08", "06:00", "10:00", "O. Sicourmat", "Jeandenand"),
  importedPlanningRow("B777TD", "fly-out-part-a", "2026-05-10", "14:00", "18:00", "F. Mansuis", "Emaille"),
  importedPlanningRow("A350TD", "fly-out-part-b", "2026-05-12", "12:00", "16:00", "S. Lempereur", "Valtin", "IT CARL: X\nGED: X"),
  importedPlanningRow("A350FF1", "fly-out-part-d", "2026-05-21", "06:00", "10:00", "V. Esnault", "Hocquet"),
  importedPlanningRow("A220FF2", "auto-eval", "2026-05-22", "", "", "P. Luzurier", ""),
  importedPlanningRow("A320TD", "fly-out-part-d", "2026-05-26", "10:00", "14:00", "G. Guinde", "Akkaoui"),
  importedPlanningRow("A220TD", "fly-out-part-a", "2026-06-15", "10:00", "14:00", "M. Gantois", "Magand"),
  importedPlanningRow("A320FF6", "fly-out-part-d", "2026-06-15", "14:00", "18:00", "Dechaume", "Fernandes", "IT CARL: X\nGED: X\nFly Out imprimé"),
  importedPlanningRow("A320TD", "dgac", "2026-06-18", "", "", "Jorge", ""),
  importedPlanningRow("B777FF3", "auto-eval", "2026-06-29", "10:00", "14:00", "JP. Holowczak", "Plaire"),
  importedPlanningRow("A350FF2", "fly-out-part-c", "2026-07-01", "16:00", "20:00", "M. Le Roux", "M. Valtin", "IT CARL: x\nGED: x"),
  importedPlanningRow("A350FF1", "dgac", "2026-07-02", "", "", "G. Guinde", "Valtin", "DGAC récurrent"),
  importedPlanningRow("A350FF3", "fly-out-part-b", "2026-07-05", "16:45", "20:45", "S. Alibhay", "Corbalan"),
  importedPlanningRow("A320FF6", "dgac", "2026-07-09", "", "", "Dechaume", "Akkaoui"),
  importedPlanningRow("A330", "fly-out-part-a", "2026-07-10", "06:00", "10:00", "L. Bicocchi", "Corbalan"),
  importedPlanningRow("A220FF2", "dgac", "2026-07-20", "", "", "", "", "DGAC STD 1.0"),
  importedPlanningRow("A220FF1", "fly-out-part-a", "2026-07-21", "06:00", "10:00", "G. Millet", "Plaire"),
  importedPlanningRow("B777FF1", "fly-out-part-b", "2026-07-23", "06:00", "10:00", "JJ. Marie", "Emaille"),
  importedPlanningRow("A320FF7", "fly-out-part-b", "2026-08-12", "06:00", "10:00", "S. Bignon", "Akkaoui"),
  importedPlanningRow("B777TD", "fly-out-part-b", "2026-08-23", "16:00", "20:00", "O. Sicourmat / G. Guinde", "Emaille", "Equipe 2/1"),
  importedPlanningRow("A220FF3", "fly-out-part-b", "2026-08-26", "06:00", "10:00", "M. Gantois", "Plaire"),
  importedPlanningRow("A220FF2", "fly-out-part-a", "2026-08-28", "18:00", "22:00", "V. Esnault", "Magand"),
  importedPlanningRow("B787", "fly-out-part-a", "2026-08-29", "14:00", "18:00", "M. Ichalalen", "Parrain"),
  importedPlanningRow("B777FF2", "fly-out-part-a", "2026-08-31", "14:00", "18:00", "J. Ferreira", "Jeandenand"),
  importedPlanningRow("B777FF4", "fly-out-part-a", "2026-09-01", "18:00", "22:00", "G. Imbert", "Jeandenand"),
  importedPlanningRow("A350FF2", "fly-out-part-d", "2026-09-01", "06:00", "10:00", "S. Dupire", "Valtin"),
  importedPlanningRow("A220TD", "fly-out-part-b", "2026-09-07", "14:00", "18:00", "JP. Cavaciuti", "Plaire"),
  importedPlanningRow("B777FF3", "fly-out-part-a", "2026-09-11", "06:00", "10:00", "S. Alibhay", "Jeandenand"),
  importedPlanningRow("A320FF6", "fly-out-part-a", "2026-09-16", "14:00", "18:00", "C. De Sa", "Akkaoui"),
  importedPlanningRow("A220FF1", "fly-out-part-b", "2026-09-24", "06:00", "10:00", "", "Plaire"),
  importedPlanningRow("A320TD", "fly-out-part-a", "2026-09-30", "14:00", "18:00", "", "Fernandes"),
  importedPlanningRow("A350FF1", "fly-out-part-a", "2026-10-05", "18:00", "22:00", "R. Aragon", "Corbaland"),
  importedPlanningRow("A330", "fly-out-part-b", "2026-10-05", "06:00", "10:00", "", "Leroux"),
  importedPlanningRow("A350FF2", "dgac", "2026-10-08", "", "", "", ""),
  importedPlanningRow("B777FF1", "fly-out-part-c", "2026-10-11", "12:00", "16:00", "F. Theodose", "Jeandenand"),
  importedPlanningRow("A350FF3", "fly-out-part-c", "2026-11-03", "18:00", "22:00", "S. Lempereur", "Corbaland"),
  importedPlanningRow("A350TD", "dgac", "2026-12-10", "", "", "", "")
];

function importedPlanningRow(simulatorName, type, date, startTime, endTime, participants, tri, notes = "") {
  return {
    id: `import-2026-${simulatorName}-${type}-${date}-${startTime || "day"}`.toLocaleLowerCase("fr").replace(/[^a-z0-9]+/g, "-"),
    simulatorName,
    type,
    dateMode: "date",
    date,
    month: date.slice(0, 7),
    startTime,
    endTime,
    participants,
    tri,
    notes
  };
}

const state = {
  authReady: false,
  currentUser: null,
  selectedDate: startOfDay(new Date()),
  visibleMonth: startOfMonth(new Date()),
  periodStartDate: null,
  periodEndDate: null,
  isSelectingPeriodEnd: false,
  search: "",
  activeView: "notes",
  isFirestoreSyncSuspended: readFirestoreSyncSuspendedPreference(),
  showTagged: false,
  showAcknowledged: false,
  showDeleted: false,
  showOnlyDeleted: false,
  selectedDetail: null,
  selectedCreate: null,
  pendingHandwritingClear: null,
  detailTimelineEvents: [],
  activeAdminTab: "home",
  adminActivitySubTab: "activity",
  adminLoginDate: startOfDay(new Date()),
  adminActivityDate: startOfDay(new Date()),
  codeModalMode: "login",
  isSaving: false,
  notes: [],
  planningRows: loadPlanningRows(),
  activePlanningSort: "",
  isPlanningEditMode: false,
  planningEditor: null,
  showsPlanningHistory: false,
  isPlanningFirestoreLoaded: false,
  isPlanningFirestoreLoading: false,
  planningFirestoreSyncTimer: null,
  planningActivityByRowID: new Map(),
  planningActivityLoadingIDs: new Set(),
  isPlanningHistoryPickerOpen: false,
  selectedPlanningHistoryYears: new Set(),
  fetchedNoteDayKeys: new Set(),
  fetchedNotesByID: new Map(),
  fetchedSearchKeys: new Set(),
  fetchedDeletedNotes: false,
  fetchedAdminConnectionNotes: false,
  isFetchingAdminConnectionNotes: false,
  globalSearchRequestID: 0,
  globalSearchTimer: null,
  handwritingNotes: [],
  dailyTags: [],
  loginEvents: [],
  userStats: [],
  firestoreReadStats: [],
  userSyncStatuses: [],
  activityEvents: [],
  adminMaintenanceAudit: null,
  adminMaintenanceStatus: "",
  isAdminMaintenanceScanning: false,
  isAdminMaintenanceRepairing: false,
  adminMessagesAll: [],
  adminMessagesTargeted: [],
  adminMessageDismissals: new Set(),
  acknowledgedAdminMessageIDs: new Set(),
  activeAdminMessage: null,
  passwordResetRequests: [],
  didShowPasswordResetAdminAlert: false,
  users: [],
  allSimulators: [],
  simulators: [],
  appSettings: {
    requiredIOSAppVersion: ""
  },
  adminLoginDateInteracting: false,
  adminActivityDateInteracting: false,
  unsubscribeNotes: null,
  unsubscribeHandwritingNotes: null,
  unsubscribeDailyTags: null,
  unsubscribeLoginEvents: null,
  loginEventsMode: "",
  unsubscribeUserStats: null,
  unsubscribeFirestoreReadStats: null,
  firestoreReadStatsMode: "",
  unsubscribeUserSyncStatuses: null,
  unsubscribeActivityEvents: null,
  unsubscribeAdminMessagesAll: null,
  unsubscribeAdminMessagesTargeted: null,
  unsubscribeAdminMessageDismissals: null,
  unsubscribePasswordResetRequests: null,
  unsubscribeCurrentUserProfile: null,
  unsubscribeUsers: null,
  unsubscribeSimulators: null,
  unsubscribeAppSettings: null,
  adminUserSearch: "",
  adminActivitySearch: "",
  adminMessageText: "",
  adminMessageSendsToAll: false,
  adminMessageRecipientIDs: new Set(),
  lastLoginEventAt: 0,
  initialDataRefreshVisible: false,
  pendingInitialDataRefreshResources: new Set(),
  lastSuccessfulDataRefreshAt: readStoredDataRefreshDate(),
  isManualDataRefreshRunning: false,
  firestoreReadStatsBuffer: new Map(),
  firestoreReadStatsFlushTimer: null,
  hasFetchedPlanningTechnicians: false,
  isFetchingPlanningTechnicians: false
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app, "us-central1");
const loginWithAccessCode = httpsCallable(functions, "loginWithAccessCode");
const changeOwnAccessCode = httpsCallable(functions, "changeOwnAccessCode");
const requestPasswordReset = httpsCallable(functions, "requestPasswordReset");
const getPlanningTechnicians = httpsCallable(functions, "getPlanningTechnicians");
const getRegulatoryPlanningEvents = httpsCallable(functions, "getRegulatoryPlanningEvents");
const saveRegulatoryPlanningEvent = httpsCallable(functions, "saveRegulatoryPlanningEvent");
const deleteRegulatoryPlanningEvent = httpsCallable(functions, "deleteRegulatoryPlanningEvent");
const getRegulatoryPlanningActivity = httpsCallable(functions, "getRegulatoryPlanningActivity");
const syncRegulatoryPlanningNotesFromMirrorNote = httpsCallable(functions, "syncRegulatoryPlanningNotesFromMirrorNote");
const activityActionTitles = {
  created: "Creation",
  modified: "Modification",
  destinationChanged: "Destination modifiee",
  priorityChanged: "Priorite modifiee",
  assignedDateChanged: "Date modifiee",
  completed: "Solde",
  completionCancelled: "Annulation solde",
  acknowledged: "Pris en compte",
  acknowledgementCancelled: "Annulation prise en compte",
  deleted: "Suppression",
  restored: "Restauration",
  permanentlyDeleted: "Suppression definitive"
};

const elements = {
  sidebarScroll: document.querySelector(".sidebar-scroll"),
  content: document.querySelector(".content"),
  loginPanel: document.querySelector("#loginPanel"),
  brandResetButton: document.querySelector("#brandResetButton"),
  openNotesViewButton: document.querySelector("#openNotesViewButton"),
  openPlanningViewButton: document.querySelector("#openPlanningViewButton"),
  dataRefreshIndicator: document.querySelector("#dataRefreshIndicator"),
  dataRefreshIndicatorText: document.querySelector("#dataRefreshIndicatorText"),
  webVersionBadge: document.querySelector("#webVersionBadge"),
  userPanel: document.querySelector("#userPanel"),
  openLoginButton: document.querySelector("#openLoginButton"),
  codeModal: document.querySelector("#codeModal"),
  codeModalTitle: document.querySelector("#codeModalTitle"),
  codeModalMessage: document.querySelector("#codeModalMessage"),
  loginLoading: document.querySelector("#loginLoading"),
  accessCode: document.querySelector("#accessCode"),
  passwordResetEmail: document.querySelector("#passwordResetEmail"),
  forgotCodeButton: document.querySelector("#forgotCodeButton"),
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
  adminFirestoreSyncButton: document.querySelector("#adminFirestoreSyncButton"),
  userGuideButton: document.querySelector("#userGuideButton"),
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
  planningSidebarNav: document.querySelector("#planningSidebarNav"),
  notesFilterSection: document.querySelector("#notesFilterSection"),
  notesSearchSection: document.querySelector("#notesSearchSection"),
  showTaggedToggle: document.querySelector("#showTaggedToggle"),
  showAcknowledgedToggle: document.querySelector("#showAcknowledgedToggle"),
  showDeletedRow: document.querySelector("#showDeletedRow"),
  showDeletedToggle: document.querySelector("#showDeletedToggle"),
  showOnlyDeletedRow: document.querySelector("#showOnlyDeletedRow"),
  showOnlyDeletedToggle: document.querySelector("#showOnlyDeletedToggle"),
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
  adminMessageOverlay: document.querySelector("#adminMessageOverlay"),
  adminMessageText: document.querySelector("#adminMessageText"),
  adminMessageOkButton: document.querySelector("#adminMessageOkButton"),
  adminMessageDeleteButton: document.querySelector("#adminMessageDeleteButton"),
  initialSyncOverlay: document.querySelector("#initialSyncOverlay"),
  adminOverlay: document.querySelector("#adminOverlay"),
  adminCloseButton: document.querySelector("#adminCloseButton"),
  adminBody: document.querySelector("#adminBody")
};

let pendingCenteredSimulatorBandAnchor = null;

elements.webVersionBadge.textContent = `v${WEB_APP_VERSION}`;
elements.webVersionBadge.title = `Version web ${WEB_APP_VERSION}`;
renderDataRefreshIndicator();
elements.selectedDate.value = isoDate(state.selectedDate);
restoreSavedSession();
if (window.location.protocol === "file:") {
  elements.fileWarning.classList.remove("hidden");
  setStatus("Ouvrir via localhost");
}

onAuthStateChanged(auth, async (user) => {
  if (window.location.protocol === "file:") {
    setStatus("Ouvrir via localhost");
    return;
  }

  if (!user) {
    state.authReady = false;
    state.currentUser = null;
    setStatus("Connexion requise");
    detachAuthenticatedDataSync();
    clearSavedSession();
    render();
    return;
  }

  const token = await user.getIdTokenResult().catch(() => null);
  if (token?.claims?.simflow !== true) {
    state.authReady = false;
    await signOut(auth).catch(() => {});
    return;
  }

  state.authReady = true;
  if (!state.currentUser) {
    state.currentUser = userFromAuthClaims(user.uid, token.claims);
    saveSession(state.currentUser);
  }
  setStatus("Connecté à Firebase");
  if (state.currentUser) {
    startAuthenticatedDataSync();
    render();
  }
});

elements.brandResetButton.addEventListener("click", resetDisplayState);
elements.openNotesViewButton?.addEventListener("click", showNotesView);
elements.openPlanningViewButton.addEventListener("click", () => {
  if (!canCurrentUserAccessPlanning()) {
    state.activeView = "notes";
    render();
    return;
  }

  state.activeView = "planning";
  clearPeriodMode();
  render();
  loadPlanningRowsFromFirestore({ force: true });
  requestAnimationFrame(() => window.scrollTo(0, 0));
});

function showNotesView() {
  state.activeView = "notes";
  state.isPlanningEditMode = false;
  state.planningEditor = null;
  closePlanningDateWheel();
  closePlanningTimeWheel();
  closePlanningTechnicianMenu();
  render();
  requestAnimationFrame(() => window.scrollTo(0, 0));
}
elements.dataRefreshIndicator.addEventListener("click", refreshDataFromIndicator);
elements.openLoginButton.addEventListener("click", () => openCodeModal("login"));
elements.loginButton.addEventListener("click", submitCodeModal);
elements.cancelLoginButton.addEventListener("click", closeCodeModal);
elements.forgotCodeButton.addEventListener("click", () => {
  if (state.codeModalMode === "passwordReset") {
    openCodeModal("login");
  } else {
    openCodeModal("passwordReset");
  }
});
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
elements.passwordResetEmail.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    submitCodeModal();
  } else if (event.key === "Escape") {
    closeCodeModal();
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    handleAppBecameVisible();
  } else {
    saveLastActiveTimestamp();
    flushFirestoreReadStats();
  }
});
window.addEventListener("focus", handleAppBecameVisible);
window.addEventListener("beforeunload", () => {
  saveLastActiveTimestamp();
  flushFirestoreReadStats();
});
window.setInterval(renderDataRefreshIndicator, 60 * 1000);
window.setInterval(refreshAdminConnectionsPresence, loginPresenceRefreshMs);
elements.userSummaryButton.addEventListener("click", () => {
  elements.userMenu.classList.toggle("hidden");
});
document.addEventListener("click", (event) => {
  const technicianOption = event.target.closest("[data-planning-technician-menu] [data-planning-editor-action='pick-technician']");
  if (technicianOption) {
    event.preventDefault();
    pickPlanningTechnician(technicianOption);
    return;
  }

  if (!elements.userPanel.contains(event.target)) {
    elements.userMenu.classList.add("hidden");
  }
  if (!event.target.closest(".planning-date-wheel-popover") && !event.target.closest("[data-planning-date-open]")) {
    closePlanningDateWheel();
  }
  if (!event.target.closest(".planning-time-wheel-popover") && !event.target.closest("[data-planning-time-open]")) {
    closePlanningTimeWheel();
  }
  if (!event.target.closest("[data-planning-technician-combobox]") && !event.target.closest("[data-planning-technician-menu]")) {
    closePlanningTechnicianMenu();
  }
});
document.addEventListener("focusin", (event) => {
  if (!event.target.closest(".planning-date-wheel-popover") && !event.target.closest("[data-planning-date-open]")) {
    closePlanningDateWheel();
  }
  if (!event.target.closest(".planning-time-wheel-popover") && !event.target.closest("[data-planning-time-open]")) {
    closePlanningTimeWheel();
  }
  if (!event.target.closest("[data-planning-technician-combobox]") && !event.target.closest("[data-planning-technician-menu]")) {
    closePlanningTechnicianMenu();
  }
});
elements.logoutButton.addEventListener("click", () => {
  logout();
});
elements.changeCodeButton.addEventListener("click", () => {
  elements.userMenu.classList.add("hidden");
  openChangeCodePanel();
});
elements.userGuideButton.addEventListener("click", () => {
  elements.userMenu.classList.add("hidden");
  window.open(userGuideURL, "_blank", "noopener");
});
elements.cancelChangeCodeButton.addEventListener("click", closeChangeCodePanel);
elements.saveChangeCodeButton.addEventListener("click", changeCurrentUserCode);
elements.adminMessageOkButton.addEventListener("click", acknowledgeActiveAdminMessage);
elements.adminMessageDeleteButton.addEventListener("click", deleteActiveAdminMessage);
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
elements.adminFirestoreSyncButton.addEventListener("click", toggleFirestoreSyncSuspension);
elements.selectedDate.addEventListener("change", () => {
  state.selectedDate = startOfDay(parseDateInput(elements.selectedDate.value));
  state.visibleMonth = startOfMonth(state.selectedDate);
  clearPeriodMode();
  fetchNotesForSelectedDateIfNeeded(state.selectedDate);
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
  elements.showOnlyDeletedToggle,
  document.querySelector('label[for="showTaggedToggle"]'),
  document.querySelector('label[for="showAcknowledgedToggle"]'),
  document.querySelector('label[for="showDeletedToggle"]'),
  document.querySelector('label[for="showOnlyDeletedToggle"]')
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
  if (state.showDeleted) {
    fetchDeletedNotesIfNeeded();
  }
  if (!state.showDeleted) {
    state.showOnlyDeleted = false;
  }
  renderPreservingCenteredSimulatorBand(takePendingCenteredSimulatorBandAnchor());
});
elements.showOnlyDeletedToggle.addEventListener("change", () => {
  state.showOnlyDeleted = elements.showOnlyDeletedToggle.checked;
  if (state.showOnlyDeleted) {
    state.showDeleted = true;
    fetchDeletedNotesIfNeeded();
  }
  renderPreservingCenteredSimulatorBand(takePendingCenteredSimulatorBandAnchor());
});
elements.searchInput.addEventListener("input", () => {
  state.search = elements.searchInput.value.trim();
  scheduleGlobalSearchFetch();
  render();
});
elements.clearSearchButton.addEventListener("click", () => {
  state.search = "";
  elements.searchInput.value = "";
  if (state.globalSearchTimer) {
    window.clearTimeout(state.globalSearchTimer);
    state.globalSearchTimer = null;
  }
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
  if (state.activeView === "planning") {
    openPlanningTimeWheel(event);
    openPlanningDateWheel(event);
    if (handlePlanningEditorClick(event)) {
      return;
    }
    handlePlanningTableClick(event);
    return;
  }

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

elements.noteGroups.addEventListener("input", (event) => {
  if (state.activeView !== "planning") {
    return;
  }

  if (event.target.closest("[data-planning-editor]")) {
    handlePlanningEditorFieldEdit(event);
    return;
  }
  handlePlanningFieldEdit(event);
});

elements.noteGroups.addEventListener("change", (event) => {
  if (state.activeView !== "planning") {
    return;
  }

  if (event.target.matches("[data-planning-history-year]")) {
    handlePlanningHistoryYearChange(event.target);
    return;
  }

  if (event.target.closest("[data-planning-editor]")) {
    handlePlanningEditorFieldEdit(event);
    return;
  }
  handlePlanningFieldEdit(event);
});

elements.noteGroups.addEventListener("focusin", (event) => {
  if (state.activeView !== "planning") {
    return;
  }

  if (event.target.closest("[data-planning-editor]")) {
    preparePlanningEditorTimeInput(event);
    return;
  }
  preparePlanningTimeInput(event);
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
  } else if (action === "resync-note") {
    resyncNoteForOlderDevices(note);
  } else if (action === "delete-note") {
    deleteNoteFromDetail(note);
  } else if (action === "permanent-delete-note") {
    confirmPermanentDeleteFromDetail(note);
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
    restartUserStatsListener();
    renderAdminSettings();
  } else if (action === "open-admin-simulators") {
    state.activeAdminTab = "simulators";
    renderAdminSettings();
  } else if (action === "open-admin-connections") {
    state.activeAdminTab = "connections";
    restartLoginEventsListener(true);
    renderAdminSettings();
  } else if (action === "open-admin-activity") {
    state.activeAdminTab = "activity";
    state.adminActivitySubTab = "activity";
    renderAdminSettings();
  } else if (action === "open-admin-user-sync") {
    state.activeAdminTab = "activity";
    state.adminActivitySubTab = "sync";
    renderAdminSettings({ force: true, resetScroll: true });
  } else if (action === "admin-activity-tab") {
    state.adminActivitySubTab = actionButton.dataset.adminActivityTab || "activity";
    renderAdminSettings({ force: true, resetScroll: true });
  } else if (action === "open-admin-app-version") {
    state.activeAdminTab = "appVersion";
    renderAdminSettings();
  } else if (action === "open-admin-maintenance") {
    state.activeAdminTab = "maintenance";
    renderAdminSettings();
    if (!state.adminMaintenanceAudit && !state.isAdminMaintenanceScanning) {
      scanAdminMaintenance();
    }
  } else if (action === "open-admin-messages") {
    state.activeAdminTab = "messages";
    resetAdminMessageComposer();
    renderAdminSettings();
  } else if (action === "open-admin-password-resets") {
    state.activeAdminTab = "passwordResets";
    renderAdminSettings();
  } else if (action === "open-activity-note") {
    openActivityNote(actionButton.closest(".admin-card"));
  } else if (action === "admin-login-previous-day") {
    state.adminLoginDate = addDays(state.adminLoginDate, -1);
    restartLoginEventsListener(true);
    renderAdminSettings({ force: true });
  } else if (action === "admin-activity-previous-day") {
    state.adminActivityDate = addDays(state.adminActivityDate, -1);
    restartActivityEventsListener(true);
    renderAdminSettings({ force: true });
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
  } else if (action === "save-app-version") {
    saveAdminAppVersion();
  } else if (action === "scan-admin-maintenance") {
    scanAdminMaintenance();
  } else if (action === "repair-admin-syncstate") {
    repairAdminSyncState();
  } else if (action === "send-admin-message") {
    sendAdminMessage();
  } else if (action === "reset-password-request-code") {
    resetPasswordRequestCode(actionButton.closest(".admin-card")?.dataset.resetRequestId);
  } else if (action === "complete-password-reset-request") {
    completePasswordResetRequest(actionButton.closest(".admin-card")?.dataset.resetRequestId);
  }
});
elements.adminOverlay.addEventListener("change", (event) => {
  if (event.target.matches("[data-admin-login-date]")) {
    state.adminLoginDate = startOfDay(parseDateInput(event.target.value));
    state.adminLoginDateInteracting = false;
    restartLoginEventsListener(true);
    renderAdminSettings({ force: true });
  } else if (event.target.matches("[data-admin-activity-date]")) {
    state.adminActivityDate = startOfDay(parseDateInput(event.target.value));
    state.adminActivityDateInteracting = false;
    restartActivityEventsListener(true);
    renderAdminSettings({ force: true });
  } else if (event.target.matches("[data-admin-activity-search]")) {
    state.adminActivitySearch = event.target.value;
    renderAdminSettings({ force: true });
  } else if (event.target.matches("[data-admin-message-all]")) {
    state.adminMessageSendsToAll = event.target.checked;
    elements.adminBody.querySelector("[data-admin-message-recipients]")?.classList.toggle("hidden", state.adminMessageSendsToAll);
  } else if (event.target.matches("[data-admin-message-recipient]")) {
    if (event.target.checked) {
      state.adminMessageRecipientIDs.add(event.target.value);
    } else {
      state.adminMessageRecipientIDs.delete(event.target.value);
    }
  }
});
elements.adminOverlay.addEventListener("input", (event) => {
  if (event.target.matches("[data-admin-message-text]")) {
    state.adminMessageText = event.target.value;
  } else if (event.target.matches("[data-admin-user-search]")) {
    state.adminUserSearch = event.target.value;
    applyAdminUserSearchFilter();
  }
});
elements.adminOverlay.addEventListener("focusin", (event) => {
  if (event.target.matches("[data-admin-login-date]")) {
    state.adminLoginDateInteracting = true;
  } else if (event.target.matches("[data-admin-activity-date]")) {
    state.adminActivityDateInteracting = true;
  }
});
elements.adminOverlay.addEventListener("pointerdown", (event) => {
  if (event.target.matches("[data-admin-login-date]")) {
    state.adminLoginDateInteracting = true;
  } else if (event.target.matches("[data-admin-activity-date]")) {
    state.adminActivityDateInteracting = true;
  }
});
elements.adminOverlay.addEventListener("focusout", (event) => {
  if (event.target.matches("[data-admin-login-date]")) {
    window.setTimeout(() => {
      state.adminLoginDateInteracting = false;
    }, 250);
  } else if (event.target.matches("[data-admin-activity-date]")) {
    window.setTimeout(() => {
      state.adminActivityDateInteracting = false;
    }, 250);
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
  elements.passwordResetEmail.value = "";
  const isPasswordReset = mode === "passwordReset";
  elements.loginHint.textContent = isPasswordReset
    ? "Entre ton adresse mail pour prévenir l'admin."
    : "Entre ton code utilisateur a 6 chiffres.";
  elements.codeModalTitle.textContent = isPasswordReset ? "Code oublié" : "Se connecter";
  elements.codeModalMessage.textContent = isPasswordReset
    ? "Entrer votre adresse mail."
    : "Entrer votre code utilisateur a 6 chiffres.";
  elements.accessCode.classList.toggle("hidden", isPasswordReset);
  elements.passwordResetEmail.classList.toggle("hidden", !isPasswordReset);
  elements.loginButton.textContent = isPasswordReset ? "Envoyer" : "Valider";
  elements.forgotCodeButton.textContent = isPasswordReset ? "Retour connexion" : "Code oublié";

  elements.codeModal.classList.remove("hidden");
  window.setTimeout(() => (isPasswordReset ? elements.passwordResetEmail : elements.accessCode).focus(), 20);
}

function closeCodeModal() {
  elements.codeModal.classList.add("hidden");
  elements.accessCode.value = "";
  elements.passwordResetEmail.value = "";
  elements.accessCode.classList.remove("hidden");
  elements.passwordResetEmail.classList.add("hidden");
  setLoginLoading(false);
}

function submitCodeModal() {
  if (state.codeModalMode === "passwordReset") {
    submitPasswordResetRequest();
  } else {
    login();
  }
}

async function submitPasswordResetRequest() {
  const email = elements.passwordResetEmail.value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    elements.codeModalMessage.textContent = "Adresse mail non valide.";
    return;
  }

  setLoginLoading(true);
  const response = await requestPasswordReset({ email }).catch((error) => {
    elements.codeModalMessage.textContent = error.message || "Demande impossible.";
    return null;
  });
  setLoginLoading(false);
  if (!response?.data?.ok) {
    return;
  }

  closeCodeModal();
  state.codeModalMode = "login";
  setStatus("Demande de réinitialisation envoyée");
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

  if (currentCode.length !== 6 || newCode.length !== 6 || confirmCode.length !== 6 || newCode !== confirmCode) {
    showChangeCodeError("Code non valide.");
    return;
  }

  await changeOwnAccessCode({ currentCode, newCode }).then(() => {
    closeChangeCodePanel();
    setStatus("Code utilisateur modifié");
  }).catch((error) => {
    showChangeCodeError(error.message || "Code non valide.");
  });
}

async function login() {
  const code = elements.accessCode.value.replace(/\D/g, "");
  elements.codeModalMessage.textContent = "Vérification...";

  if (code.length !== 6) {
    elements.codeModalMessage.textContent = "Code non valide.";
    return;
  }

  setLoginLoading(true);
  const response = await loginWithAccessCode({ accessCode: code }).catch((error) => {
    elements.codeModalMessage.textContent = error.message || "Code non valide.";
    return null;
  });
  const token = response?.data?.token;
  const user = response?.data?.user;
  if (!token || !user) {
    if (!elements.codeModalMessage.textContent || elements.codeModalMessage.textContent === "Vérification...") {
      elements.codeModalMessage.textContent = "Code non valide.";
    }
    setLoginLoading(false);
    return;
  }

  state.currentUser = normalizedSessionUser(user);
  saveSession(state.currentUser);
  const signInSucceeded = await signInWithCustomToken(auth, token).then(() => true).catch((error) => {
    elements.codeModalMessage.textContent = error.message || "Connexion impossible.";
    setLoginLoading(false);
    return false;
  });
  if (!signInSucceeded) return;
  state.authReady = true;
  state.lastLoginEventAt = 0;
  startAuthenticatedDataSync();
  elements.loginHint.textContent = "";
  closeCodeModal();
  renderSession();
  render();
  setLoginLoading(false);
}

function setLoginLoading(isLoading) {
  elements.loginLoading?.classList.toggle("hidden", !isLoading);
  elements.codeModal?.classList.toggle("is-loading", isLoading);
  elements.loginButton.disabled = isLoading;
  elements.cancelLoginButton.disabled = isLoading;
  elements.accessCode.disabled = isLoading;
  elements.passwordResetEmail.disabled = isLoading;
  elements.forgotCodeButton.disabled = isLoading;
}

function restoreSavedSession() {
  const savedSession = readSavedSession();
  if (!savedSession) {
    return;
  }

  state.currentUser = savedSession.user;
  state.lastLoginEventAt = 0;
  startAuthenticatedDataSync();
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

function readFirestoreSyncSuspendedPreference() {
  return localStorage.getItem(firestoreSyncSuspendedStorageKey) === "true";
}

function saveFirestoreSyncSuspendedPreference() {
  localStorage.setItem(firestoreSyncSuspendedStorageKey, state.isFirestoreSyncSuspended ? "true" : "false");
}

function shouldSuspendFirestoreSync() {
  return isAdminSession() && state.isFirestoreSyncSuspended;
}

function toggleFirestoreSyncSuspension() {
  if (!isAdminSession()) {
    return;
  }

  state.isFirestoreSyncSuspended = !state.isFirestoreSyncSuspended;
  saveFirestoreSyncSuspendedPreference();
  elements.userMenu.classList.add("hidden");

  if (state.isFirestoreSyncSuspended) {
    detachAuthenticatedDataSync({ keepsInitialDataRefresh: true, keepsData: true });
    setStatus("Synchro Firestore suspendue");
  } else {
    startAuthenticatedDataSync();
    setStatus("Synchro Firestore reprise");
  }

  renderSession();
  renderDataRefreshIndicator();
}

function logout() {
  flushFirestoreReadStats();
  state.currentUser = null;
  state.lastLoginEventAt = 0;
  elements.accessCode.value = "";
  elements.userMenu.classList.add("hidden");
  closeAdminSettings();
  closeChangeCodePanel();
  closeCodeModal();
  clearSavedSession();
  detachAuthenticatedDataSync();
  signOut(auth).catch(() => {});
  render();
}

function getWebDeviceIdentifier() {
  const existingIdentifier = localStorage.getItem(webDeviceStorageKey);
  if (existingIdentifier) {
    return existingIdentifier;
  }

  const identifier = globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `web-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  localStorage.setItem(webDeviceStorageKey, identifier);
  return identifier;
}

function webDeviceName() {
  const platform = navigator.userAgentData?.platform || navigator.platform || "Navigateur web";
  return `${platform} - ${navigator.userAgentData?.brands?.[0]?.brand || navigator.userAgent.split(" ")[0] || "Web"}`;
}

async function recordLoginAppearance() {
  if (!state.authReady || !state.currentUser || shouldSuspendFirestoreSync() || document.visibilityState === "hidden") {
    return;
  }

  const now = Date.now();
  if (now - state.lastLoginEventAt < 1000) {
    return;
  }

  state.lastLoginEventAt = now;
  const createdAt = new Date(now);
  const userIdentifier = state.currentUser.id;
  const userDisplayName = currentDisplayName();
  const deviceIdentifier = getWebDeviceIdentifier();
  const deviceName = webDeviceName();
  const dayIdentifier = isoDate(createdAt);
  const id = firestoreDocumentID([dayIdentifier, userIdentifier, "web", deviceIdentifier].join("_"));
  const payload = {
    id,
    userIdentifier,
    userDisplayName,
    source: "web",
    deviceIdentifier,
    deviceName,
    iCloudIdentifier: userIdentifier,
    iosAppVersion: "",
    dayIdentifier,
    createdAt,
    lastSeenAt: createdAt
  };

  payload.appearanceCount = increment(1);

  const statsID = firestoreDocumentID(userIdentifier);
  const statsPayload = {
    userIdentifier,
    userDisplayName,
    totalWebConnections: increment(1),
    lastWebSeenAt: createdAt,
    lastSeenAt: createdAt,
    updatedAt: createdAt
  };

  await Promise.all([
    setDoc(doc(db, "loginEvents", id), payload, { merge: true }),
    setDoc(doc(db, "userStats", statsID), statsPayload, { merge: true })
  ]).catch((error) => {
    setStatus(error.message);
  });
}

function trackFirestoreRead(collectionName, count, source = "web") {
  const readCount = Number(count) || 0;
  const userIdentifier = stringValue(state.currentUser?.id).trim();
  if (!state.authReady || !userIdentifier || readCount <= 0) {
    return;
  }

  const collectionKey = firestoreFieldKey(collectionName);
  const sourceKey = firestoreFieldKey(source || "web");
  const key = `${sourceKey}|${collectionKey}`;
  state.firestoreReadStatsBuffer.set(key, (state.firestoreReadStatsBuffer.get(key) || 0) + readCount);

  if (!state.firestoreReadStatsFlushTimer) {
    state.firestoreReadStatsFlushTimer = window.setTimeout(() => {
      flushFirestoreReadStats();
    }, firestoreReadStatsFlushMs);
  }
}

function trackFirestoreSnapshotRead(collectionName, snapshot, source = "web") {
  if (!snapshot || snapshot.metadata?.fromCache) {
    return;
  }

  const changeCount = snapshot.docChanges().length;
  trackFirestoreRead(collectionName, changeCount || snapshot.docs.length, source);
}

function trackFirestoreDocumentRead(collectionName, snapshot, source = "web") {
  if (!snapshot || snapshot.metadata?.fromCache || !snapshot.exists()) {
    return;
  }

  trackFirestoreRead(collectionName, 1, source);
}

function firestoreFieldKey(value) {
  return stringValue(value, "unknown").replace(/[.[\]*`/]/g, "_") || "unknown";
}

async function flushFirestoreReadStats() {
  if (state.firestoreReadStatsFlushTimer) {
    window.clearTimeout(state.firestoreReadStatsFlushTimer);
    state.firestoreReadStatsFlushTimer = null;
  }
  if (state.planningFirestoreSyncTimer) {
    window.clearInterval(state.planningFirestoreSyncTimer);
    state.planningFirestoreSyncTimer = null;
  }

  if (shouldSuspendFirestoreSync()) {
    state.firestoreReadStatsBuffer.clear();
    return;
  }

  const userIdentifier = stringValue(state.currentUser?.id).trim();
  if (!state.authReady || !userIdentifier || !state.firestoreReadStatsBuffer.size) {
    state.firestoreReadStatsBuffer.clear();
    return;
  }

  const pendingEntries = [...state.firestoreReadStatsBuffer.entries()];
  state.firestoreReadStatsBuffer.clear();
  const now = new Date();
  const dayIdentifier = isoDate(now);
  const entriesBySource = groupBy(pendingEntries, ([key]) => key.split("|")[0] || "web");

  try {
    await Promise.all([...entriesBySource.entries()].map(([source, entries]) => {
      const id = firestoreDocumentID([dayIdentifier, userIdentifier, source].join("_"));
      const payload = {
        id,
        userIdentifier,
        userDisplayName: currentDisplayName(),
        source,
        dayIdentifier,
        updatedAt: now
      };

      let totalReads = 0;
      entries.forEach(([key, count]) => {
        const collectionName = key.split("|")[1] || "unknown";
        totalReads += count;
        payload[`readsByCollection.${collectionName}`] = increment(count);
      });
      payload.totalReads = increment(totalReads);

      return setDoc(doc(db, "firestoreReadStats", id), payload, { merge: true });
    }));
  } catch (error) {
    pendingEntries.forEach(([key, count]) => {
      state.firestoreReadStatsBuffer.set(key, (state.firestoreReadStatsBuffer.get(key) || 0) + count);
    });
    setStatus(error.message);
  }
}

function startAuthenticatedDataSync() {
  if (!state.authReady || !state.currentUser) {
    return;
  }

  if (shouldSuspendFirestoreSync()) {
    detachAuthenticatedDataSync({ keepsInitialDataRefresh: true, keepsData: true });
    setStatus("Synchro Firestore suspendue");
    render();
    return;
  }

  prepareInitialDataRefreshIfNeeded();
  attachFirebaseListeners();
  restartDailyTagsListener();
  fetchPlanningTechniciansIfNeeded();
  startPlanningFirestoreSyncTimer();
  loadPlanningRowsFromFirestore();
  recordLoginAppearance();
}

function handleAppBecameVisible() {
  if (!state.authReady || !state.currentUser || shouldSuspendFirestoreSync()) {
    return;
  }

  const shouldRefreshAfterWake = shouldShowWakeAutoDataRefresh();
  recordLoginAppearance();
  if (!shouldRefreshAfterWake && !shouldShowStaleDataRefresh()) {
    saveLastActiveTimestamp();
    return;
  }

  beginInitialDataRefresh(waitingForInitialDataRefreshResources());
  detachAuthenticatedDataSync({ keepsInitialDataRefresh: true });
  attachFirebaseListeners();
  restartDailyTagsListener();
  saveLastActiveTimestamp();

  if (shouldRefreshAfterWake) {
    refreshDataAfterWake();
  }
}

function saveLastActiveTimestamp() {
  localStorage.setItem(lastActiveStorageKey, String(Date.now()));
}

function shouldShowStaleDataRefresh() {
  const lastActiveAt = Number(localStorage.getItem(lastActiveStorageKey) || 0);
  return lastActiveAt > 0 && Date.now() - lastActiveAt >= staleDataRefreshThresholdMs;
}

function shouldShowWakeAutoDataRefresh() {
  const lastActiveAt = Number(localStorage.getItem(lastActiveStorageKey) || 0);
  return lastActiveAt > 0 && Date.now() - lastActiveAt >= wakeAutoDataRefreshThresholdMs;
}

function prepareInitialDataRefreshIfNeeded() {
  if (!shouldShowStaleDataRefresh()) {
    return;
  }
  beginInitialDataRefresh(waitingForInitialDataRefreshResources());
}

function waitingForInitialDataRefreshResources() {
  const resources = new Set(["notesActive", "notesArchived", "notesDeleted", "handwritingNotes", "simulators"]);
  if (state.currentUser?.id) {
    resources.add("dailyTags");
  }
  return resources;
}

function beginInitialDataRefresh(resources) {
  if (!resources?.size) {
    return;
  }

  saveLastActiveTimestamp();
  state.pendingInitialDataRefreshResources = new Set(resources);
  state.initialDataRefreshVisible = true;
  updateInitialDataRefreshOverlay();
}

function completeInitialDataRefreshResource(resource) {
  if (!state.initialDataRefreshVisible) {
    return;
  }

  state.pendingInitialDataRefreshResources.delete(resource);
  if (!state.pendingInitialDataRefreshResources.size) {
    finishInitialDataRefresh();
  }
}

function finishInitialDataRefresh() {
  state.pendingInitialDataRefreshResources.clear();
  state.initialDataRefreshVisible = false;
  updateInitialDataRefreshOverlay();
}

function updateInitialDataRefreshOverlay() {
  elements.initialSyncOverlay?.classList.toggle("hidden", !state.initialDataRefreshVisible);
  elements.initialSyncOverlay?.setAttribute("aria-hidden", state.initialDataRefreshVisible ? "false" : "true");
}

function recordSuccessfulDataRefresh(date = new Date()) {
  state.lastSuccessfulDataRefreshAt = date;
  localStorage.setItem(lastSuccessfulDataRefreshStorageKey, date.toISOString());
  renderDataRefreshIndicator();
}

function readStoredDataRefreshDate() {
  const storedValue = localStorage.getItem(lastSuccessfulDataRefreshStorageKey);
  const storedDate = storedValue ? new Date(storedValue) : null;
  return storedDate && !Number.isNaN(storedDate.getTime()) ? storedDate : null;
}

function renderDataRefreshIndicator() {
  if (!elements.dataRefreshIndicator || !elements.dataRefreshIndicatorText) {
    return;
  }

  const isAdmin = isAdminSession();
  if (shouldSuspendFirestoreSync()) {
    elements.dataRefreshIndicator.classList.remove("stale", "syncing", "info-only");
    elements.dataRefreshIndicator.classList.add("suspended");
    elements.dataRefreshIndicator.disabled = true;
    elements.dataRefreshIndicatorText.textContent = "Firestore suspendu";
    elements.dataRefreshIndicator.title = "Synchronisation Firestore suspendue";
    return;
  }

  const isStale = !state.lastSuccessfulDataRefreshAt
    || Date.now() - state.lastSuccessfulDataRefreshAt.getTime() > staleDataRefreshWarningThresholdMs;
  elements.dataRefreshIndicator.classList.remove("suspended");
  elements.dataRefreshIndicator.classList.toggle("info-only", !isAdmin);
  elements.dataRefreshIndicator.classList.toggle("stale", isAdmin && isStale);
  elements.dataRefreshIndicator.classList.toggle("syncing", state.isManualDataRefreshRunning);
  elements.dataRefreshIndicator.disabled = !state.currentUser || state.isManualDataRefreshRunning || !isAdmin;
  elements.dataRefreshIndicator.title = isAdmin
    ? "Synchroniser les données"
    : "Dernière synchronisation connue";
  const prefix = isAdmin ? "MAJ" : "À jour";
  elements.dataRefreshIndicatorText.textContent = `${prefix} ${lastSuccessfulDataRefreshText()} - ${activeCurrentDayNoteCount()} (${activeCurrentDayAverageCreationAgeText()})`;
}

function lastSuccessfulDataRefreshText() {
  return state.lastSuccessfulDataRefreshAt
    ? formatDateTime(state.lastSuccessfulDataRefreshAt)
    : "jamais vérifiée";
}

function activeCurrentDayNoteEntries() {
  if (!state.currentUser) {
    return [];
  }

  const today = startOfDay(new Date());
  const contexts = [generalName, ...visibleSimulatorContexts().map((simulator) => simulator.name)];
  const entries = [];

  for (const context of contexts) {
    contextDisplayNotes(state.notes.filter((note) => canCurrentUserSeeNote(note)), context)
      .filter((note) => isActiveCurrentDayNote(note, context, today))
      .filter((note) => !isOnlyHandwrittenNoteForCurrentUser(note))
      .forEach((note) => entries.push(note));
  }

  return entries;
}

function activeCurrentDayNoteCount() {
  return activeCurrentDayNoteEntries().length;
}

function isOnlyHandwrittenNoteForCurrentUser(note) {
  const hasTypedContent = Boolean(note.title.trim() || note.text.trim());
  if (hasTypedContent) {
    return false;
  }

  return Boolean(visibleHandwritingFor(note));
}

function activeCurrentDayAverageCreationAgeText() {
  const entries = activeCurrentDayNoteEntries();
  if (!entries.length) {
    return "0 j";
  }

  const averageDays = entries
    .map((note) => Math.max(0, (Date.now() - (note.createdAt || new Date()).getTime()) / 86400000))
    .reduce((sum, value) => sum + value, 0) / entries.length;
  const roundedAverageDays = Math.round(averageDays * 10) / 10;

  if (Number.isInteger(roundedAverageDays)) {
    return `${roundedAverageDays} j`;
  }

  return `${roundedAverageDays.toFixed(1).replace(".", ",")} j`;
}

function isActiveCurrentDayNote(note, context, day) {
  const noteDay = startOfDay(note.displayDate);
  return !note.deletedAt
    && canCurrentUserSeeNote(note)
    && noteDay <= day
    && !isCompletedBefore(note, day, context);
}

async function refreshDataFromIndicator() {
  if (!isAdminSession()) {
    return;
  }

  refreshDataFromServer("Synchronisation des données...", "Données synchronisées");
}

function refreshDataAfterWake() {
  refreshDataFromServer("Rattrapage après veille...", "Données synchronisées");
}

async function refreshDataFromServer(startMessage, successMessage) {
  if (!state.currentUser || !state.authReady || state.isManualDataRefreshRunning) {
    return;
  }

  if (shouldSuspendFirestoreSync()) {
    setStatus("Synchro Firestore suspendue");
    renderDataRefreshIndicator();
    return;
  }

  state.isManualDataRefreshRunning = true;
  renderDataRefreshIndicator();
  setStatus(startMessage);

  try {
    await Promise.all([
      fetchRealtimeNotesFromServer(),
      fetchHandwritingNotesFromServer()
    ]);
    recordSuccessfulDataRefresh();
    setStatus(successMessage);
    renderSimulators();
    render();
  } catch (error) {
    setStatus(error.message);
  } finally {
    state.isManualDataRefreshRunning = false;
    renderDataRefreshIndicator();
  }
}

async function fetchRealtimeNotesFromServer() {
  const displayWindow = realtimeDisplayWindow();
  const snapshots = await Promise.all([
    getDocs(query(
      collection(db, "handoverNotes"),
      where("syncState", "==", "active"),
      where("displayDate", "<", displayWindow.end)
    )),
    getDocs(query(
      collection(db, "handoverNotes"),
      where("syncState", "==", "archived"),
      where("realtimeActiveUntil", ">=", displayWindow.start)
    )),
    getDocs(query(
      collection(db, "handoverNotes"),
      where("syncState", "==", "deleted"),
      where("realtimeActiveUntil", ">=", displayWindow.start)
    ))
  ]);

  const fetchedRealtimeNotes = snapshots.flatMap((snapshot) => {
    return snapshot.docs.map((document) => noteFromSnapshot(document.id, document.data()));
  });
  const fetchedRealtimeNoteIDs = new Set(fetchedRealtimeNotes.map((note) => note.id));
  state.fetchedNotesByID = new Map([...state.fetchedNotesByID].filter(([, note]) => {
    return !isNoteCoveredByRealtimeFetch(note, displayWindow) || fetchedRealtimeNoteIDs.has(note.id);
  }));

  const notesByID = new Map(state.notes
    .filter((note) => !isNoteCoveredByRealtimeFetch(note, displayWindow) || fetchedRealtimeNoteIDs.has(note.id))
    .map((note) => [note.id, note]));
  snapshots.forEach((snapshot) => {
    trackFirestoreRead("handoverNotes", snapshot.docs.length);
  });
  fetchedRealtimeNotes.forEach((note) => {
    state.fetchedNotesByID.set(note.id, note);
    notesByID.set(note.id, note);
  });
  state.notes = Array.from(notesByID.values());
}

function isNoteCoveredByRealtimeFetch(note, displayWindow = realtimeDisplayWindow()) {
  if (note.syncState === "active") {
    return note.displayDate < displayWindow.end;
  }

  if (note.syncState === "archived" || note.syncState === "deleted") {
    return note.realtimeActiveUntil && note.realtimeActiveUntil >= displayWindow.start;
  }

  return false;
}

async function fetchHandwritingNotesFromServer() {
  const snapshot = await getDocs(collection(db, "handwritingNotes"));
  trackFirestoreRead("handwritingNotes", snapshot.docs.length);
  state.handwritingNotes = snapshot.docs
    .map((document) => handwritingNoteFromSnapshot(document.id, document.data()))
    .sort((a, b) => (b.updatedAt?.getTime() || 0) - (a.updatedAt?.getTime() || 0));
}

function attachFirebaseListeners() {
  if (shouldSuspendFirestoreSync()) {
    return;
  }

  if (!state.unsubscribeNotes) {
    const activeNotes = new Map();
    const recentArchivedNotes = new Map();
    const recentDeletedNotes = new Map();
    const syncNotes = () => {
      state.notes = Array.from(new Map([
        ...state.fetchedNotesByID,
        ...recentDeletedNotes,
        ...recentArchivedNotes,
        ...activeNotes
      ]).values());
      setStatus("Données synchronisées");
      renderSimulators();
      render();
    };
    const applyNotesSnapshot = (target, snapshot, refreshResource) => {
      trackFirestoreSnapshotRead("handoverNotes", snapshot);
      snapshot.docChanges().forEach((change) => {
        if (change.type === "removed") {
          target.delete(change.doc.id);
          state.fetchedNotesByID.delete(change.doc.id);
        } else {
          target.set(change.doc.id, noteFromSnapshot(change.doc.id, change.doc.data()));
        }
      });
      syncNotes();
      if (!snapshot.metadata.fromCache) {
        recordSuccessfulDataRefresh();
        completeInitialDataRefreshResource(refreshResource);
      }
    };
    const displayWindow = realtimeDisplayWindow();
    const unsubscribeActive = onSnapshot(
      query(
        collection(db, "handoverNotes"),
        where("syncState", "==", "active"),
        where("displayDate", "<", displayWindow.end)
      ),
      (snapshot) => applyNotesSnapshot(activeNotes, snapshot, "notesActive"),
      (error) => setStatus(error.message)
    );
    const unsubscribeRecentArchived = onSnapshot(
      query(
        collection(db, "handoverNotes"),
        where("syncState", "==", "archived"),
        where("realtimeActiveUntil", ">=", displayWindow.start)
      ),
      (snapshot) => applyNotesSnapshot(recentArchivedNotes, snapshot, "notesArchived"),
      (error) => setStatus(error.message)
    );
    const unsubscribeRecentDeleted = onSnapshot(
      query(
        collection(db, "handoverNotes"),
        where("syncState", "==", "deleted"),
        where("realtimeActiveUntil", ">=", displayWindow.start)
      ),
      (snapshot) => applyNotesSnapshot(recentDeletedNotes, snapshot, "notesDeleted"),
      (error) => setStatus(error.message)
    );
    state.unsubscribeNotes = () => {
      unsubscribeActive();
      unsubscribeRecentArchived();
      unsubscribeRecentDeleted();
    };
  }

  if (!state.unsubscribeNoteDeletions) {
    state.unsubscribeNoteDeletions = onSnapshot(collection(db, "handoverNoteDeletions"), (snapshot) => {
      trackFirestoreSnapshotRead("handoverNoteDeletions", snapshot);
      const deletedIDs = snapshot.docChanges()
        .filter((change) => change.type === "added" || change.type === "modified")
        .map((change) => stringValue(change.doc.data().noteID, change.doc.id))
        .filter(Boolean);

      if (!deletedIDs.length) {
        return;
      }

      const deletedIDSet = new Set(deletedIDs);
      state.notes = state.notes.filter((note) => !deletedIDSet.has(note.id));
      deletedIDs.forEach((noteID) => state.fetchedNotesByID.delete(noteID));
      state.handwritingNotes = state.handwritingNotes.filter((note) => !deletedIDSet.has(note.noteID));
      renderSimulators();
      render();
    }, (error) => setStatus(error.message));
  }

  if (!state.unsubscribeHandwritingNotes) {
    state.unsubscribeHandwritingNotes = onSnapshot(collection(db, "handwritingNotes"), (snapshot) => {
      trackFirestoreSnapshotRead("handwritingNotes", snapshot);
      state.handwritingNotes = snapshot.docs
        .map((doc) => handwritingNoteFromSnapshot(doc.id, doc.data()))
        .sort((a, b) => (b.updatedAt?.getTime() || 0) - (a.updatedAt?.getTime() || 0));
      setStatus("Données synchronisées");
      render();
      if (!snapshot.metadata.fromCache) {
        recordSuccessfulDataRefresh();
        completeInitialDataRefreshResource("handwritingNotes");
      }
    }, (error) => setStatus(error.message));
  }

  if (!state.unsubscribeAppSettings) {
    state.unsubscribeAppSettings = onSnapshot(doc(db, "appSettings", "global"), (snapshot) => {
      trackFirestoreDocumentRead("appSettings", snapshot);
      const data = snapshot.data() || {};
      state.appSettings = {
        requiredIOSAppVersion: stringValue(data.requiredIOSAppVersion)
      };
      renderAdminSettings();
    }, (error) => setStatus(error.message));
  }

  if (!isAdminSession() && !state.unsubscribeCurrentUserProfile) {
    const documentID = currentUserDocumentID();
    if (documentID) {
      state.unsubscribeCurrentUserProfile = onSnapshot(doc(db, "users", documentID), (snapshot) => {
        trackFirestoreDocumentRead("users", snapshot);
        if (snapshot.exists()) {
          const user = userFromSnapshot(snapshot.id, snapshot.data());
          state.users = deduplicatedUsers([user, ...state.users]).sort(compareUsersByLastName);
          syncCurrentUserFromUsersList();
          renderSession();
          render();
          fetchPlanningTechniciansIfNeeded();
        }
      }, (error) => setStatus(error.message));
    }
  }

  if (isAdminSession() && !state.unsubscribeUsers) {
    state.unsubscribeUsers = onSnapshot(collection(db, "users"), (snapshot) => {
      trackFirestoreSnapshotRead("users", snapshot);
      state.users = deduplicatedUsers(snapshot.docs
        .map((document) => userFromSnapshot(document.id, document.data())))
        .sort(compareUsersByLastName);
      syncCurrentUserFromUsersList();
      renderAdminSettings();
      render();
    }, (error) => setStatus(error.message));
  }

  if (isAdminSession() && !state.unsubscribePasswordResetRequests) {
    state.unsubscribePasswordResetRequests = onSnapshot(
      query(collection(db, "passwordResetRequests"), where("status", "==", "pending")),
      (snapshot) => {
        trackFirestoreSnapshotRead("passwordResetRequests", snapshot);
        state.passwordResetRequests = snapshot.docs
          .map((document) => passwordResetRequestFromSnapshot(document.id, document.data()))
          .filter(Boolean)
          .sort((a, b) => (b.lastRequestedAt?.getTime() || 0) - (a.lastRequestedAt?.getTime() || 0));
        maybeShowPasswordResetAdminAlert();
        renderAdminSettings();
      },
      (error) => setStatus(error.message)
    );
  }

  restartAdminTabListeners();

  restartAdminMessageListeners();

  if (!state.unsubscribeSimulators) {
    state.unsubscribeSimulators = onSnapshot(collection(db, "simulators"), (snapshot) => {
      trackFirestoreSnapshotRead("simulators", snapshot);
      state.allSimulators = deduplicatedSimulators(snapshot.docs
        .map((doc) => simulatorFromSnapshot(doc.id, doc.data())))
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "fr"));
      state.simulators = state.allSimulators
        .filter((simulator) => !simulator.isHidden && simulator.name !== generalName);
      renderSimulators();
      renderAdminSettings();
      render();
      if (!snapshot.metadata.fromCache) {
        completeInitialDataRefreshResource("simulators");
      }
    }, (error) => setStatus(error.message));
  }
}

function realtimeDisplayWindow() {
  const today = startOfDay(new Date());
  return {
    start: addDays(today, -4),
    end: addDays(today, 1)
  };
}

function startPlanningFirestoreSyncTimer() {
  if (state.planningFirestoreSyncTimer) {
    window.clearInterval(state.planningFirestoreSyncTimer);
  }

  state.planningFirestoreSyncTimer = window.setInterval(() => {
    loadPlanningRowsFromFirestore({ force: true });
  }, planningFirestoreSyncIntervalMs);
}

async function loadPlanningRowsFromFirestore({ force = false, includeHistory = state.showsPlanningHistory } = {}) {
  if (!state.authReady || !state.currentUser || shouldSuspendFirestoreSync() || !canCurrentUserAccessPlanning()) {
    return;
  }

  if (state.isPlanningFirestoreLoading || (state.isPlanningFirestoreLoaded && !force)) {
    return;
  }

  state.isPlanningFirestoreLoading = true;
  try {
    const response = await getRegulatoryPlanningEvents({ includeHistory });
    const events = Array.isArray(response?.data?.events) ? response.data.events : [];
    if (events.length) {
      state.planningRows = events.map(normalizePlanningRow);
      state.isPlanningFirestoreLoaded = true;
      savePlanningRowsLocal();
      if (!state.activePlanningSort) {
        sortPlanningRowsByDate();
      }
      if (state.activeView === "planning") {
        renderPlanningTable();
      }
      return;
    }

    if (!state.isPlanningFirestoreLoaded && canCurrentUserEditPlanning()) {
      normalizedPlanningRows().forEach((row) => {
        savePlanningRows(row, {
          before: null,
          changedFields: Object.keys(planningFirestorePayload(row)),
          action: "imported"
        });
      });
      state.isPlanningFirestoreLoaded = true;
    }
  } catch (error) {
    setStatus(error.message || "Planning Firestore indisponible");
  } finally {
    state.isPlanningFirestoreLoading = false;
  }
}

async function fetchPlanningTechniciansIfNeeded() {
  if (!state.authReady || !state.currentUser || isAdminSession() || shouldSuspendFirestoreSync()) {
    return;
  }

  if (!canCurrentUserAccessPlanning() || state.hasFetchedPlanningTechnicians || state.isFetchingPlanningTechnicians) {
    return;
  }

  state.isFetchingPlanningTechnicians = true;
  try {
    const response = await getPlanningTechnicians();
    const users = Array.isArray(response?.data?.users) ? response.data.users : [];
    state.users = deduplicatedUsers([
      ...state.users,
      ...users.map((user) => normalizedPlanningTechnicianUser(user))
    ]).sort(compareUsersByLastName);
    state.hasFetchedPlanningTechnicians = true;
    if (state.activeView === "planning") {
      renderPlanningTable();
    }
  } catch (error) {
    setStatus(error.message || "Liste techniciens indisponible");
  } finally {
    state.isFetchingPlanningTechnicians = false;
  }
}

function normalizedPlanningTechnicianUser(user) {
  return {
    documentID: stringValue(user?.documentID, user?.id),
    id: stringValue(user?.id, user?.documentID),
    firstName: stringValue(user?.firstName),
    lastName: stringValue(user?.lastName),
    email: "",
    accessCode: "",
    isAccessCodeUserDefined: false,
    role: stringValue(user?.role),
    team: stringValue(user?.team),
    canViewPlanning: false,
    updatedAt: null
  };
}

function isInRealtimeNoteDisplayWindow(date) {
  const day = startOfDay(date);
  const window = realtimeDisplayWindow();
  return day >= window.start && day < window.end;
}

async function fetchNotesForSelectedDateIfNeeded(date) {
  if (!state.currentUser || !state.authReady || shouldSuspendFirestoreSync()) {
    return;
  }

  const day = startOfDay(date);
  if (isInRealtimeNoteDisplayWindow(day)) {
    return;
  }

  const dayKey = isoDate(day);
  if (state.fetchedNoteDayKeys.has(dayKey)) {
    return;
  }

  state.fetchedNoteDayKeys.add(dayKey);
  const start = day;
  const end = addDays(day, 1);

  try {
    const snapshot = await getDocs(query(
      collection(db, "handoverNotes"),
      where("displayDate", ">=", start),
      where("displayDate", "<", end)
    ));
    trackFirestoreRead("handoverNotes", snapshot.docs.length);
    const fetchedNotes = snapshot.docs.map((doc) => noteFromSnapshot(doc.id, doc.data()));
    const notesByID = new Map(state.notes.map((note) => [note.id, note]));
    fetchedNotes.forEach((note) => {
      state.fetchedNotesByID.set(note.id, note);
      notesByID.set(note.id, note);
    });
    state.notes = Array.from(notesByID.values());
    recordSuccessfulDataRefresh();
    setStatus("Données synchronisées");
    renderSimulators();
    render();
  } catch (error) {
    state.fetchedNoteDayKeys.delete(dayKey);
    setStatus(error.message);
  }
}

async function fetchDeletedNotesIfNeeded() {
  if (!state.currentUser || !state.authReady || shouldSuspendFirestoreSync() || !canCurrentUserViewDeletedNotes() || state.fetchedDeletedNotes) {
    return;
  }

  state.fetchedDeletedNotes = true;

  try {
    const snapshot = await getDocs(query(
      collection(db, "handoverNotes"),
      where("syncState", "==", "deleted")
    ));
    trackFirestoreRead("handoverNotes", snapshot.docs.length);
    const fetchedNotes = snapshot.docs.map((doc) => noteFromSnapshot(doc.id, doc.data()));
    const notesByID = new Map(state.notes.map((note) => [note.id, note]));
    fetchedNotes.forEach((note) => {
      state.fetchedNotesByID.set(note.id, note);
      notesByID.set(note.id, note);
    });
    state.notes = Array.from(notesByID.values());
    recordSuccessfulDataRefresh();
    setStatus("Consignes supprimées synchronisées");
    renderSimulators();
    render();
  } catch (error) {
    state.fetchedDeletedNotes = false;
    setStatus(error.message);
  }
}

async function fetchAdminConnectionNotesIfNeeded() {
  if (!state.currentUser || !state.authReady || !isAdminSession() || shouldSuspendFirestoreSync() || state.fetchedAdminConnectionNotes || state.isFetchingAdminConnectionNotes) {
    return;
  }

  state.isFetchingAdminConnectionNotes = true;

  try {
    const snapshot = await getDocs(collection(db, "handoverNotes"));
    trackFirestoreRead("handoverNotes", snapshot.docs.length);
    const fetchedNotes = snapshot.docs.map((doc) => noteFromSnapshot(doc.id, doc.data()));
    const notesByID = new Map(state.notes.map((note) => [note.id, note]));
    fetchedNotes.forEach((note) => {
      state.fetchedNotesByID.set(note.id, note);
      notesByID.set(note.id, note);
    });
    state.notes = Array.from(notesByID.values());
    state.fetchedAdminConnectionNotes = true;
    recordSuccessfulDataRefresh();
    setStatus("Statistiques connexions synchronisées");
    renderSimulators();
    renderAdminSettings();
    render();
  } catch (error) {
    setStatus(error.message);
  } finally {
    state.isFetchingAdminConnectionNotes = false;
  }
}

function scheduleGlobalSearchFetch() {
  if (state.globalSearchTimer) {
    window.clearTimeout(state.globalSearchTimer);
  }
  state.globalSearchTimer = window.setTimeout(() => {
    state.globalSearchTimer = null;
    fetchGlobalSearchNotesIfNeeded(state.search);
  }, 350);
}

async function fetchGlobalSearchNotesIfNeeded(searchText) {
  if (!state.currentUser || !state.authReady || shouldSuspendFirestoreSync()) {
    return;
  }

  const keywords = searchQueryKeywords(searchText);
  if (!keywords.length) {
    return;
  }

  const searchKey = keywords.join("|");
  if (state.fetchedSearchKeys.has(searchKey)) {
    return;
  }

  state.fetchedSearchKeys.add(searchKey);
  const requestID = ++state.globalSearchRequestID;

  try {
    const snapshot = await getDocs(query(
      collection(db, "handoverNotes"),
      where("searchKeywords", "array-contains-any", keywords)
    ));
    trackFirestoreRead("handoverNotes", snapshot.docs.length);
    if (requestID !== state.globalSearchRequestID && state.search !== searchText) {
      return;
    }

    const fetchedNotes = snapshot.docs.map((doc) => noteFromSnapshot(doc.id, doc.data()));
    const notesByID = new Map(state.notes.map((note) => [note.id, note]));
    fetchedNotes.forEach((note) => {
      state.fetchedNotesByID.set(note.id, note);
      notesByID.set(note.id, note);
    });
    state.notes = Array.from(notesByID.values());
    recordSuccessfulDataRefresh();
    setStatus("Recherche synchronisée");
    renderSimulators();
    render();
  } catch (error) {
    state.fetchedSearchKeys.delete(searchKey);
    setStatus(error.message);
  }
}

function restartAdminTabListeners() {
  if (!state.authReady || !isAdminSession() || shouldSuspendFirestoreSync()) {
    return;
  }

  stopInactiveAdminTabListeners();
  startActiveAdminTabListener();
}

function startActiveAdminTabListener() {
  if (state.activeAdminTab === "users") {
    restartUserStatsListener();
  }

  if (state.activeAdminTab === "connections") {
    restartLoginEventsListener();
    restartFirestoreReadStatsListener();
    fetchAdminConnectionNotesIfNeeded();
  }

  if (state.activeAdminTab === "activity") {
    if (state.adminActivitySubTab === "sync") {
      restartUserSyncStatusesListener();
    } else {
      restartActivityEventsListener();
    }
  }
}

function stopInactiveAdminTabListeners() {
  if (state.activeAdminTab !== "connections" && state.unsubscribeLoginEvents) {
    state.unsubscribeLoginEvents();
    state.unsubscribeLoginEvents = null;
    state.loginEventsMode = "";
    state.loginEvents = [];
  }

  if (state.activeAdminTab !== "connections" && state.unsubscribeFirestoreReadStats) {
    state.unsubscribeFirestoreReadStats();
    state.unsubscribeFirestoreReadStats = null;
    state.firestoreReadStatsMode = "";
    state.firestoreReadStats = [];
  }

  if (state.activeAdminTab !== "users" && state.unsubscribeUserStats) {
    state.unsubscribeUserStats();
    state.unsubscribeUserStats = null;
    state.userStats = [];
  }

  if ((state.activeAdminTab !== "activity" || state.adminActivitySubTab !== "activity") && state.unsubscribeActivityEvents) {
    state.unsubscribeActivityEvents();
    state.unsubscribeActivityEvents = null;
    state.activityEvents = [];
  }

  if ((state.activeAdminTab !== "activity" || state.adminActivitySubTab !== "sync") && state.unsubscribeUserSyncStatuses) {
    state.unsubscribeUserSyncStatuses();
    state.unsubscribeUserSyncStatuses = null;
    state.userSyncStatuses = [];
  }
}

function restartLoginEventsListener(force = false) {
  if (!state.authReady || !isAdminSession() || shouldSuspendFirestoreSync()) {
    return;
  }

  if (state.activeAdminTab !== "connections") {
    return;
  }

  const mode = `connections:${isoDate(state.adminLoginDate)}`;
  if (state.unsubscribeLoginEvents && state.loginEventsMode === mode && !force) {
    return;
  }

  if (state.unsubscribeLoginEvents) {
    state.unsubscribeLoginEvents();
    state.unsubscribeLoginEvents = null;
  }

  state.loginEventsMode = mode;
  state.loginEvents = [];
  const loginQuery = query(
    collection(db, "loginEvents"),
    where("createdAt", ">=", startOfDay(state.adminLoginDate)),
    where("createdAt", "<", addDays(startOfDay(state.adminLoginDate), 1)),
    orderBy("createdAt", "desc")
  );
  state.unsubscribeLoginEvents = onSnapshot(
    loginQuery,
    (snapshot) => {
      trackFirestoreSnapshotRead("loginEvents", snapshot);
      state.loginEvents = snapshot.docs
        .map((document) => loginEventFromSnapshot(document.id, document.data()))
        .filter(Boolean);
      renderAdminSettings();
    },
    (error) => setStatus(error.message)
  );
}

function restartFirestoreReadStatsListener(force = false) {
  if (!state.authReady || !isAdminSession() || shouldSuspendFirestoreSync()) {
    return;
  }

  if (state.activeAdminTab !== "connections") {
    return;
  }

  const dayIdentifier = isoDate(state.adminLoginDate);
  const mode = `readStats:${dayIdentifier}`;
  if (state.unsubscribeFirestoreReadStats && state.firestoreReadStatsMode === mode && !force) {
    return;
  }

  if (state.unsubscribeFirestoreReadStats) {
    state.unsubscribeFirestoreReadStats();
    state.unsubscribeFirestoreReadStats = null;
  }

  state.firestoreReadStatsMode = mode;
  state.firestoreReadStats = [];
  state.unsubscribeFirestoreReadStats = onSnapshot(
    query(collection(db, "firestoreReadStats"), where("dayIdentifier", "==", dayIdentifier)),
    (snapshot) => {
      state.firestoreReadStats = snapshot.docs
        .map((document) => firestoreReadStatFromSnapshot(document.id, document.data()))
        .filter(Boolean);
      renderAdminSettings();
    },
    (error) => setStatus(error.message)
  );
}

function restartUserStatsListener(force = false) {
  if (!state.authReady || !isAdminSession() || shouldSuspendFirestoreSync()) {
    return;
  }

  if (state.activeAdminTab !== "users") {
    return;
  }

  if (state.unsubscribeUserStats && !force) {
    return;
  }

  if (state.unsubscribeUserStats) {
    state.unsubscribeUserStats();
    state.unsubscribeUserStats = null;
  }

  state.loginEvents = [];
  state.unsubscribeUserStats = onSnapshot(
    collection(db, "loginEvents"),
    (snapshot) => {
      trackFirestoreSnapshotRead("loginEvents", snapshot);
      state.loginEvents = snapshot.docs
        .map((document) => loginEventFromSnapshot(document.id, document.data()))
        .filter(Boolean);
      renderAdminSettings();
    },
    (error) => setStatus(error.message)
  );
}

function restartActivityEventsListener(force = false) {
  if (!state.authReady || !isAdminSession() || shouldSuspendFirestoreSync()) {
    return;
  }

  if (state.activeAdminTab !== "activity" || state.adminActivitySubTab !== "activity") {
    return;
  }

  if (state.unsubscribeActivityEvents && !force) {
    return;
  }

  if (state.unsubscribeActivityEvents) {
    state.unsubscribeActivityEvents();
    state.unsubscribeActivityEvents = null;
  }

  const start = startOfDay(state.adminActivityDate);
  const end = addDays(start, 1);
  state.activityEvents = [];
  state.unsubscribeActivityEvents = onSnapshot(
    query(
      collection(db, "activityEvents"),
      where("createdAt", ">=", start),
      where("createdAt", "<", end),
      orderBy("createdAt", "desc"),
      limit(500)
    ),
    (snapshot) => {
      trackFirestoreSnapshotRead("activityEvents", snapshot);
      state.activityEvents = snapshot.docs
        .map((document) => activityEventFromSnapshot(document.id, document.data()))
        .filter(Boolean);
      renderAdminSettings();
    },
    (error) => setStatus(error.message)
  );
}

function restartUserSyncStatusesListener(force = false) {
  if (!state.authReady || !isAdminSession() || shouldSuspendFirestoreSync()) {
    return;
  }

  if (state.activeAdminTab !== "activity" || state.adminActivitySubTab !== "sync") {
    return;
  }

  if (state.unsubscribeUserSyncStatuses && !force) {
    return;
  }

  if (state.unsubscribeUserSyncStatuses) {
    state.unsubscribeUserSyncStatuses();
    state.unsubscribeUserSyncStatuses = null;
  }

  state.userSyncStatuses = [];
  state.unsubscribeUserSyncStatuses = onSnapshot(
    collection(db, "userSyncStatus"),
    (snapshot) => {
      trackFirestoreSnapshotRead("userSyncStatus", snapshot);
      state.userSyncStatuses = snapshot.docs
        .map((document) => userSyncStatusFromSnapshot(document.id, document.data()))
        .filter(Boolean);
      renderAdminSettings();
    },
    (error) => setStatus(error.message)
  );
}

function restartAdminMessageListeners() {
  ["unsubscribeAdminMessagesAll", "unsubscribeAdminMessagesTargeted", "unsubscribeAdminMessageDismissals"].forEach((key) => {
    if (state[key]) {
      state[key]();
      state[key] = null;
    }
  });

  state.adminMessagesAll = [];
  state.adminMessagesTargeted = [];
  state.adminMessageDismissals = new Set();
  state.activeAdminMessage = null;
  renderAdminMessageOverlay();

  if (!state.authReady || !state.currentUser || isAdminSession()) {
    return;
  }

  const userIdentifier = stringValue(state.currentUser.id).trim();
  if (!userIdentifier) {
    return;
  }

  state.unsubscribeAdminMessagesAll = onSnapshot(
    query(collection(db, "adminMessages"), where("sendsToAll", "==", true)),
    (snapshot) => {
      trackFirestoreSnapshotRead("adminMessages", snapshot);
      state.adminMessagesAll = snapshot.docs
        .map((document) => adminMessageFromSnapshot(document.id, document.data()))
        .filter(Boolean);
      refreshActiveAdminMessage();
    },
    (error) => setStatus(error.message)
  );

  state.unsubscribeAdminMessagesTargeted = onSnapshot(
    query(collection(db, "adminMessages"), where("recipientUserIDs", "array-contains", userIdentifier)),
    (snapshot) => {
      trackFirestoreSnapshotRead("adminMessages", snapshot);
      state.adminMessagesTargeted = snapshot.docs
        .map((document) => adminMessageFromSnapshot(document.id, document.data()))
        .filter(Boolean);
      refreshActiveAdminMessage();
    },
    (error) => setStatus(error.message)
  );

  state.unsubscribeAdminMessageDismissals = onSnapshot(
    query(collection(db, "adminMessageDismissals"), where("userIdentifier", "==", userIdentifier)),
    (snapshot) => {
      trackFirestoreSnapshotRead("adminMessageDismissals", snapshot);
      state.adminMessageDismissals = new Set(snapshot.docs
        .map((document) => stringValue(document.data().messageID))
        .filter(Boolean));
      refreshActiveAdminMessage();
    },
    (error) => setStatus(error.message)
  );
}

function detachAuthenticatedDataSync({ keepsInitialDataRefresh = false, keepsData = false } = {}) {
  const unsubscribeKeys = [
    "unsubscribeNotes",
    "unsubscribeNoteDeletions",
    "unsubscribeHandwritingNotes",
    "unsubscribeDailyTags",
    "unsubscribeLoginEvents",
    "unsubscribeFirestoreReadStats",
    "unsubscribeUserSyncStatuses",
    "unsubscribeActivityEvents",
    "unsubscribeAdminMessagesAll",
    "unsubscribeAdminMessagesTargeted",
    "unsubscribeAdminMessageDismissals",
    "unsubscribePasswordResetRequests",
    "unsubscribeCurrentUserProfile",
    "unsubscribeUsers",
    "unsubscribeSimulators",
    "unsubscribeAppSettings"
  ];

  unsubscribeKeys.forEach((key) => {
    if (state[key]) {
      state[key]();
      state[key] = null;
    }
  });

  if (!keepsInitialDataRefresh) {
    finishInitialDataRefresh();
  }
  state.firestoreReadStatsBuffer.clear();
  if (state.firestoreReadStatsFlushTimer) {
    window.clearTimeout(state.firestoreReadStatsFlushTimer);
    state.firestoreReadStatsFlushTimer = null;
  }

  if (keepsData) {
    renderAdminMessageOverlay();
    return;
  }

  state.notes = [];
  state.fetchedNoteDayKeys = new Set();
  state.fetchedNotesByID = new Map();
  state.fetchedSearchKeys = new Set();
  state.fetchedDeletedNotes = false;
  state.globalSearchRequestID += 1;
  if (state.globalSearchTimer) {
    window.clearTimeout(state.globalSearchTimer);
    state.globalSearchTimer = null;
  }
  state.handwritingNotes = [];
  state.dailyTags = [];
  state.loginEvents = [];
  state.userStats = [];
  state.firestoreReadStats = [];
  state.firestoreReadStatsMode = "";
  state.userSyncStatuses = [];
  state.activityEvents = [];
  state.adminMessagesAll = [];
  state.adminMessagesTargeted = [];
  state.adminMessageDismissals = new Set();
  state.acknowledgedAdminMessageIDs = new Set();
  state.activeAdminMessage = null;
  state.passwordResetRequests = [];
  state.didShowPasswordResetAdminAlert = false;
  state.hasFetchedPlanningTechnicians = false;
  state.isFetchingPlanningTechnicians = false;
  state.isPlanningFirestoreLoaded = false;
  state.isPlanningFirestoreLoading = false;
  state.planningActivityByRowID = new Map();
  state.planningActivityLoadingIDs = new Set();
  renderAdminMessageOverlay();
  state.users = [];
  state.allSimulators = [];
  state.simulators = [];
  state.appSettings = {
    requiredIOSAppVersion: ""
  };
  state.detailTimelineEvents = [];
  state.selectedDetail = null;
  state.selectedCreate = null;
  state.pendingHandwritingClear = null;
  state.lastLoginEventAt = 0;

  elements.noteGroups.innerHTML = "";
  elements.teamPresenceList.innerHTML = "";
  elements.simulatorShortcutGrid.innerHTML = "";
  if (elements.simulatorList) {
    elements.simulatorList.innerHTML = "";
  }
  elements.detailOverlay.classList.add("hidden");
  elements.detailOverlay.setAttribute("aria-hidden", "true");
}

function restartDailyTagsListener() {
  if (state.unsubscribeDailyTags) {
    state.unsubscribeDailyTags();
    state.unsubscribeDailyTags = null;
  }

  if (shouldSuspendFirestoreSync()) {
    render();
    return;
  }

  state.dailyTags = [];
  if (!state.authReady || !state.currentUser?.id) {
    render();
    return;
  }

  const tagsQuery = query(collection(db, "dailyTags"), where("userIdentifier", "==", state.currentUser.id));
  state.unsubscribeDailyTags = onSnapshot(tagsQuery, (snapshot) => {
    trackFirestoreSnapshotRead("dailyTags", snapshot);
    state.dailyTags = snapshot.docs
      .map((document) => dailyTagFromSnapshot(document.id, document.data()))
      .filter(Boolean);
    render();
    if (!snapshot.metadata.fromCache) {
      completeInitialDataRefreshResource("dailyTags");
    }
  }, (error) => setStatus(error.message));
}

function renderSession() {
  const isLoggedIn = Boolean(state.currentUser);
  updateLoginLockState(!isLoggedIn);
  elements.loginPanel.classList.toggle("hidden", isLoggedIn);
  elements.userPanel.classList.toggle("hidden", !isLoggedIn);
  const isPlanningView = state.activeView === "planning" && isLoggedIn;
  elements.planningSidebarNav?.classList.toggle("hidden", isPlanningView);
  elements.notesFilterSection?.classList.toggle("hidden", isPlanningView);
  elements.notesSearchSection?.classList.toggle("hidden", isPlanningView);
  const canViewDeleted = canCurrentUserViewDeletedNotes();
  elements.showDeletedRow.classList.toggle("hidden", isPlanningView || !canViewDeleted);
  elements.showOnlyDeletedRow.classList.toggle("hidden", isPlanningView || !canViewDeleted || state.currentUser?.role !== "admin");
  if ((!canViewDeleted || state.currentUser?.role !== "admin") && state.showOnlyDeleted) {
    state.showOnlyDeleted = false;
  }
  if (!canViewDeleted && state.showDeleted) {
    state.showDeleted = false;
  }

  if (!state.currentUser) {
    elements.adminSettingsButton.classList.add("hidden");
    elements.adminFirestoreSyncButton.classList.add("hidden");
    elements.changeCodeButton.classList.add("hidden");
    elements.userMenu.classList.add("hidden");
    elements.pageSubtitle.textContent = `${formatLongDate(state.selectedDate)} · Consultation`;
    renderViewNavigation();
    return;
  }

  const displayName = [state.currentUser.firstName, state.currentUser.lastName].filter(Boolean).join(" ");
  elements.userName.textContent = displayName || state.currentUser.id;
  elements.userMeta.innerHTML = userRoleMetaHTML(state.currentUser.role, state.currentUser.team);
  elements.changeCodeButton.classList.toggle("hidden", state.currentUser.role === "admin");
  elements.adminSettingsButton.classList.toggle("hidden", state.currentUser.role !== "admin");
  elements.adminFirestoreSyncButton.classList.toggle("hidden", state.currentUser.role !== "admin");
  elements.adminFirestoreSyncButton.innerHTML = state.isFirestoreSyncSuspended
    ? `<span class="menu-icon" aria-hidden="true">▶</span> Reprendre Firestore`
    : `<span class="menu-icon" aria-hidden="true">⏸</span> Suspendre Firestore`;
  elements.pageSubtitle.textContent = `${formatLongDate(state.selectedDate)} · ${displayName || state.currentUser.id}`;
  renderViewNavigation();
}

function renderViewNavigation() {
  const canAccessPlanning = canCurrentUserAccessPlanning();
  if (!canAccessPlanning && state.activeView === "planning") {
    state.activeView = "notes";
  }
  elements.openNotesViewButton?.classList.toggle("hidden", !canAccessPlanning);
  elements.openNotesViewButton?.classList.toggle("active", state.activeView === "notes");
  elements.openPlanningViewButton?.classList.toggle("hidden", !canAccessPlanning);
  elements.openPlanningViewButton?.classList.toggle("active", state.activeView === "planning");
}

function canCurrentUserAccessPlanning() {
  if (!state.currentUser) {
    return false;
  }

  const currentUserRecord = currentUserRecordFromUsersList();
  if (currentUserRecord) {
    return currentUserRecord.role === "admin" || currentUserRecord.canViewPlanning === true;
  }

  return state.currentUser.role === "admin" || state.currentUser.canViewPlanning === true;
}

function canCurrentUserEditPlanning() {
  if (!state.currentUser) {
    return false;
  }

  const currentUserRecord = currentUserRecordFromUsersList();
  if (currentUserRecord) {
    return currentUserRecord.role === "admin" || currentUserRecord.canEditPlanning === true;
  }

  return state.currentUser.role === "admin" || state.currentUser.canEditPlanning === true;
}

function updateLoginLockState(requiresLogin) {
  document.body.classList.toggle("requires-login", requiresLogin);

  if (elements.content) {
    elements.content.inert = requiresLogin;
    elements.content.setAttribute("aria-hidden", requiresLogin ? "true" : "false");
  }

  Array.from(elements.sidebarScroll?.children || []).forEach((child) => {
    const isLoginPanel = child === elements.loginPanel;
    child.inert = requiresLogin && !isLoginPanel;
    child.setAttribute("aria-hidden", requiresLogin && !isLoginPanel ? "true" : "false");
  });
}

function render() {
  renderSession();
  renderDataRefreshIndicator();
  document.body.classList.toggle("planning-view", state.activeView === "planning" && Boolean(state.currentUser));
  elements.emptyState.textContent = "Aucune consigne à afficher pour cette sélection.";
  const filtersDisabled = Boolean(state.periodStartDate);
  elements.showTaggedToggle.checked = state.showTagged;
  elements.showAcknowledgedToggle.checked = state.showAcknowledged;
  elements.showDeletedToggle.checked = state.showDeleted;
  elements.showOnlyDeletedToggle.checked = state.showOnlyDeleted;
  elements.showTaggedToggle.disabled = filtersDisabled;
  elements.showAcknowledgedToggle.disabled = filtersDisabled;
  elements.showDeletedToggle.disabled = filtersDisabled;
  elements.showOnlyDeletedToggle.disabled = filtersDisabled;
  elements.searchInput.parentElement.classList.toggle("search-active", Boolean(state.search));
  elements.clearSearchButton.classList.toggle("hidden", !state.search);
  renderCalendar();

  if (!state.currentUser) {
    elements.teamPresenceList.innerHTML = "";
    elements.simulatorShortcutGrid.innerHTML = "";
    if (elements.simulatorList) {
      elements.simulatorList.innerHTML = "";
    }
    elements.noteGroups.innerHTML = "";
    elements.emptyState.classList.remove("hidden");
    elements.pageTitle.classList.remove("planning-title");
    elements.pageTitle.textContent = "";
    elements.pageSubtitle.classList.remove("hidden");
    elements.pageSubtitle.textContent = "Connexion requise";
    refreshDetail();
    return;
  }

  renderTeamPresences();
  renderSimulators();

  if (state.activeView === "planning") {
    renderPlanningTable();
    refreshDetail();
    return;
  }

  const groups = groupedNotes();
  elements.noteGroups.innerHTML = groups.map(renderGroup).join("");
  elements.emptyState.classList.toggle("hidden", groups.length > 0);
  elements.pageTitle.classList.remove("planning-title");
  elements.pageTitle.textContent = "";
  elements.pageSubtitle.classList.remove("hidden");
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

function renderPlanningTable() {
  if (!state.activePlanningSort) {
    sortPlanningRowsByDate();
  }
  const rows = visiblePlanningRows();
  const nextPlanningRowID = nextUpcomingPlanningRowID(rows);

  elements.pageTitle.classList.add("planning-title");
  elements.pageTitle.textContent = "Planning réglementaire";
  elements.pageSubtitle.textContent = "";
  elements.pageSubtitle.classList.add("hidden");
  elements.emptyState.classList.add("hidden");
  elements.simulatorShortcutGrid.innerHTML = "";

  elements.noteGroups.innerHTML = `
    <section class="planning-board" aria-label="Planning réglementaire des visites et reunions">
      <div class="planning-sticky-banner">
        <div class="planning-banner-top">
          <h1>Planning réglementaire</h1>
          ${planningEditActionsHTML()}
        </div>
        ${planningHeaderRowHTML()}
      </div>
      <div class="planning-table-wrap">
        <table class="planning-table">
          <colgroup>
            <col class="planning-col-status">
            <col class="planning-col-simu">
            <col class="planning-col-type">
            <col class="planning-col-date">
            <col class="planning-col-time">
            <col class="planning-col-time">
            <col class="planning-col-team">
            <col class="planning-col-technician">
            <col class="planning-col-tri">
            <col class="planning-col-notes">
            <col class="planning-col-actions">
          </colgroup>
          <tbody>
            ${rows.map((row, index) => renderPlanningRowWithActivity(row, nextPlanningRowID, index)).join("")}
          </tbody>
        </table>
      </div>
      ${renderPlanningHistoryPicker()}
      ${renderPlanningEditor()}
    </section>
  `;
}

function planningEditActionsHTML() {
  const canEditPlanning = canCurrentUserEditPlanning();
  const returnButton = `<button class="planning-return-button" type="button" data-planning-action="return-notes">Retour Consignes</button>`;
  const historyButton = `
    <button
      class="planning-history-button${state.showsPlanningHistory ? " active" : ""}"
      type="button"
      data-planning-action="toggle-history"
      aria-pressed="${state.showsPlanningHistory ? "true" : "false"}"
      title="${state.showsPlanningHistory ? "Masquer les événements passés" : "Afficher les événements passés"}"
    >Historique</button>
  `;

  if (!state.isPlanningEditMode) {
    return `
      <div class="planning-edit-actions">
        ${returnButton}
        ${canEditPlanning ? `<button class="planning-edit-button" type="button" data-planning-action="enter-edit">Modifier</button>` : ""}
        ${historyButton}
      </div>
    `;
  }

  return `
    <div class="planning-edit-actions">
      ${returnButton}
      <button class="planning-add-button" type="button" data-planning-action="add-row">+ Ajouter</button>
      <button class="planning-exit-button" type="button" data-planning-action="exit-edit">Quitter Modification</button>
      ${historyButton}
    </div>
  `;
}

function renderPlanningHistoryPicker() {
  if (!state.isPlanningHistoryPickerOpen) {
    return "";
  }

  const years = planningArchiveYears();
  const yearList = years.length
    ? years.map((year) => `
        <label class="planning-history-year-option">
          <input
            type="checkbox"
            data-planning-history-year="${year}"
            ${state.selectedPlanningHistoryYears.has(year) ? "checked" : ""}
          >
          <span>${year}</span>
        </label>
      `).join("")
    : `<p class="planning-history-empty">Aucune archive disponible</p>`;

  return `
    <div class="planning-history-modal-backdrop" data-planning-history-backdrop>
      <div class="planning-history-modal" role="dialog" aria-modal="true" aria-label="Historique planning réglementaire">
        <h2>Historique</h2>
        <div class="planning-history-years">
          ${yearList}
        </div>
        <div class="planning-history-modal-actions">
          <button class="planning-history-cancel-button" type="button" data-planning-action="cancel-history-picker">Annuler</button>
          <button class="planning-history-show-button" type="button" data-planning-action="show-history-picker" ${state.selectedPlanningHistoryYears.size ? "" : "disabled"}>Afficher</button>
        </div>
      </div>
    </div>
  `;
}

function planningHeaderRowHTML() {
  return `
    <div class="planning-header-row" role="row">
      <div class="planning-col-status" role="columnheader"></div>
      <div class="planning-col-simu" role="columnheader">
                <button class="planning-sort-button${state.activePlanningSort === "simulator" ? " active" : ""}" type="button" data-planning-action="sort-simulator" title="Trier par simulateur puis date croissante">Simu</button>
      </div>
      <div class="planning-col-type" role="columnheader">
        <button class="planning-sort-button${state.activePlanningSort === "type" ? " active" : ""}" type="button" data-planning-action="sort-type" title="Trier par type puis date croissante">Type</button>
      </div>
      <div class="planning-col-date" role="columnheader">
                <button class="planning-sort-button${(state.activePlanningSort || "date") === "date" ? " active" : ""}" type="button" data-planning-action="sort-date" title="Trier par date croissante">Date</button>
      </div>
      <div class="planning-col-time" role="columnheader">Début</div>
      <div class="planning-col-time" role="columnheader">Fin</div>
      <div class="planning-col-team" role="columnheader">Eq.</div>
      <div class="planning-col-technician" role="columnheader">
        <button class="planning-sort-button${state.activePlanningSort === "technician" ? " active" : ""}" type="button" data-planning-action="sort-technician" title="Trier par technicien puis date croissante">Technicien</button>
      </div>
      <div class="planning-col-tri" role="columnheader">
        <button class="planning-sort-button${state.activePlanningSort === "tri" ? " active" : ""}" type="button" data-planning-action="sort-tri" title="Trier par TRI puis date croissante">TRI</button>
      </div>
      <div class="planning-col-notes" role="columnheader">Notes</div>
      <div class="planning-col-actions" role="columnheader"></div>
    </div>
  `;
}

function renderPlanningRow(row, nextPlanningRowID = "", rowIndex = 0) {
  const id = escapeAttribute(row.id);
  const simulatorOptions = planningSimulatorOptions(row.simulatorName);
  const isDraftRow = isPlanningDraftRow(row);
  const canOpenPlanningEditor = state.isPlanningEditMode && canCurrentUserEditPlanning();
  const canEditPlanning = false;
  const disablesStartTimeField = !canEditPlanning || row.dateMode === "month";
  const disablesEndTimeField = !canEditPlanning || shouldDisablePlanningEndTime(row);
  const disablesPeriodDetailFields = !canEditPlanning || row.dateMode === "month";
  const disablesEditField = !canEditPlanning;
  const disablesNotesField = state.isPlanningEditMode || !canCurrentUserAccessPlanning();
  const technicianAlertLevel = planningTechnicianAlertLevel(row);
  const highlightsMissingTri = shouldHighlightMissingPlanningTri(row);
  const highlightsMissingStartTime = shouldHighlightMissingPlanningStartTime(row);
  return `
    <tr class="planning-row read-only${rowIndex % 2 ? " planning-row-alternate" : ""}${canOpenPlanningEditor ? " planning-row-selectable" : ""}${isDraftRow ? " planning-draft-row" : ""}" data-planning-row-id="${id}">
      <td class="planning-col-status">${isDraftRow ? "" : planningStatusIconsHTML(row, nextPlanningRowID)}</td>
      <td class="planning-col-simu">
        <select class="${row.simulatorName ? "" : "planning-empty-select"}" data-planning-field="simulatorName" aria-label="Simu" ${disablesEditField ? "disabled" : ""}>
          ${planningPlaceholderOptionHTML("Simu", row.simulatorName)}
          ${simulatorOptions.map((simulator) => planningOptionHTML(simulator.name, simulator.name, row.simulatorName)).join("")}
        </select>
      </td>
      <td class="planning-col-type">
        <select class="${row.type ? "" : "planning-empty-select"}" data-planning-field="type" aria-label="Type" ${disablesEditField ? "disabled" : ""}>
          ${planningPlaceholderOptionHTML("Type", row.type)}
          ${planningTypes.map((type) => planningOptionHTML(type.value, type.label, row.type)).join("")}
        </select>
      </td>
      <td class="planning-col-date">
        <div class="planning-date-control">
          ${planningDateDisplayButtonHTML(row, { enabled: canEditPlanning })}
        </div>
      </td>
      <td class="planning-col-time"><span class="planning-time-display${highlightsMissingStartTime ? " planning-time-alert" : ""}" data-planning-field="startTime">${escapeHtml(row.startTime || "--:--")}</span></td>
      <td class="planning-col-time"><span class="planning-time-display" data-planning-field="endTime">${escapeHtml(row.endTime || "--:--")}</span></td>
      <td class="planning-col-team">${planningTeamHTML(row)}</td>
      <td class="planning-col-technician">
        <select class="${technicianAlertLevel ? `planning-technician-alert ${technicianAlertLevel}` : ""}" data-planning-field="participants" aria-label="Technicien" ${disablesPeriodDetailFields ? "disabled" : ""}>
          ${planningTechnicianSelectOptionsHTML(row)}
        </select>
      </td>
      <td class="planning-col-tri"><input class="${highlightsMissingTri ? "planning-tri-alert" : ""}" data-planning-field="tri" value="${escapeAttribute(row.tri)}" placeholder="TRI" ${disablesPeriodDetailFields ? "disabled" : ""}></td>
      <td class="planning-col-notes">
        <textarea class="planning-notes-cell" data-planning-field="notes" placeholder="Notes" ${disablesNotesField ? "disabled" : ""}>${escapeHtml(row.notes)}</textarea>
      </td>
      <td class="planning-col-actions planning-actions-cell">
        ${isDraftRow
          ? `<button class="planning-icon-button success" type="button" data-planning-action="confirm-new-row" title="Valider la création">✓</button>
             <button class="planning-icon-button danger" type="button" data-planning-action="cancel-new-row" title="Annuler la création">×</button>`
          : `<button class="planning-icon-button planning-history-clock ${row.hasModifications ? "modified" : "clean"}" type="button" data-planning-action="show-activity" title="${row.hasModifications ? "Suivi : modification existante" : "Suivi : aucune modification"}">◷</button>`}
      </td>
    </tr>
  `;
}

function renderPlanningRowWithActivity(row, nextPlanningRowID = "", rowIndex = 0) {
  return `${renderPlanningRow(row, nextPlanningRowID, rowIndex)}${renderPlanningActivityRow(row)}`;
}

function renderPlanningActivityRow(row) {
  if (!state.planningActivityByRowID.has(row.id) && !state.planningActivityLoadingIDs.has(row.id)) {
    return "";
  }

  const activities = state.planningActivityByRowID.get(row.id) || [];
  const content = state.planningActivityLoadingIDs.has(row.id)
    ? "<span>Chargement du suivi...</span>"
    : (activities.length
      ? activities.map(renderPlanningActivityItem).join("")
      : "<span>Aucune action enregistrée.</span>");
  return `
    <tr class="planning-activity-row" data-planning-activity-row-id="${escapeAttribute(row.id)}">
      <td colspan="11">
        <div class="planning-activity-panel">${content}</div>
      </td>
    </tr>
  `;
}

function renderPlanningActivityItem(activity) {
  const details = stringValue(activity.activityDetails).trim();
  return `
    <div class="planning-activity-item">
      <div class="planning-activity-heading">
        <strong>${escapeHtml(planningActivityActionLabel(activity.action))}</strong>
        <span>- ${escapeHtml(activity.userDisplayName || activity.userIdentifier || "Utilisateur")} · ${escapeHtml(formatDateTime(dateValue(activity.createdAt) || new Date()))}</span>
      </div>
      ${details ? `<small class="planning-activity-details">${escapeHtml(details)}</small>` : ""}
    </div>
  `;
}

function renderPlanningEditor() {
  if (!state.planningEditor) {
    return "";
  }

  const row = normalizePlanningRow(state.planningEditor.draft);
  state.planningEditor.draft = row;
  const isCreate = state.planningEditor.mode === "create";
  const simulatorOptions = planningSimulatorOptions(row.simulatorName);
  const disablesPeriodDetailFields = row.dateMode === "month";
  const disablesStartTimeField = row.dateMode === "month";
  const disablesEndTimeField = shouldDisablePlanningEndTime(row);
  const canValidate = canValidatePlanningEditorRow(row);
  const canEditTri = canEditPlanningTri(row);
  return `
    <div class="planning-editor-backdrop" data-planning-editor>
      <section class="planning-editor-panel" aria-label="${isCreate ? "Créer une visite réglementaire" : "Modifier une visite réglementaire"}">
        <div class="planning-editor-title">
          <strong>${isCreate ? "Nouvelle visite réglementaire" : "Modifier la visite réglementaire"}</strong>
          <button type="button" class="planning-icon-button danger" data-planning-editor-action="cancel" title="Annuler">×</button>
        </div>
        <div class="planning-editor-grid">
          <label class="planning-editor-field planning-editor-simu">Simu
            <select class="${row.simulatorName ? "" : "planning-empty-select"}" data-planning-editor-field="simulatorName">
              ${planningPlaceholderOptionHTML("Simu", row.simulatorName)}
              ${simulatorOptions.map((simulator) => planningOptionHTML(simulator.name, simulator.name, row.simulatorName)).join("")}
            </select>
          </label>
          <label class="planning-editor-field planning-editor-type">Type
            <select class="${row.type ? "" : "planning-empty-select"}" data-planning-editor-field="type">
              ${planningPlaceholderOptionHTML("Type", row.type)}
              ${planningTypes.map((type) => planningOptionHTML(type.value, type.label, row.type)).join("")}
            </select>
          </label>
          <label class="planning-editor-field planning-editor-date">Date
            <div class="planning-date-control">
              <select class="${row.dateMode === "month" ? "planning-period-highlight" : ""}" data-planning-editor-field="dateMode" aria-label="Type de date">
                ${planningOptionHTML("date", "Date", row.dateMode)}
                ${planningOptionHTML("month", "Période", row.dateMode)}
              </select>
              ${planningDateDisplayButtonHTML(row, { enabled: true })}
            </div>
          </label>
          <label class="planning-editor-field planning-editor-start">Début
            ${planningTimeDisplayButtonHTML(row.startTime, "startTime", { disabled: disablesStartTimeField })}
          </label>
          <label class="planning-editor-field planning-editor-end">Fin
            ${planningTimeDisplayButtonHTML(row.endTime, "endTime", { disabled: disablesEndTimeField })}
          </label>
          <label class="planning-editor-field planning-editor-team">Eq.
            <div class="planning-editor-team-preview">${planningTeamHTML(row)}</div>
          </label>
          <label class="planning-editor-field planning-editor-technician">Technicien
            <div class="planning-technician-combobox" data-planning-technician-combobox>
              <input class="${planningTechnicianAlertLevel(row) ? `planning-technician-alert ${planningTechnicianAlertLevel(row)}` : ""}" data-planning-editor-field="participants" value="${escapeAttribute(row.participants)}" placeholder="Technicien" ${disablesPeriodDetailFields ? "disabled" : ""}>
              <button type="button" data-planning-editor-action="toggle-technician-list" title="Afficher les techniciens" ${disablesPeriodDetailFields ? "disabled" : ""}>⌄</button>
            </div>
          </label>
          <label class="planning-editor-field planning-editor-tri">TRI
            <input class="${shouldHighlightMissingPlanningTri(row) ? "planning-tri-alert" : ""}" data-planning-editor-field="tri" value="${escapeAttribute(row.tri)}" placeholder="TRI" ${canEditTri ? "" : "disabled"}>
          </label>
          <label class="planning-editor-field planning-editor-notes">Notes
            <textarea data-planning-editor-field="notes" placeholder="Notes">${escapeHtml(row.notes)}</textarea>
          </label>
        </div>
        <div class="planning-editor-actions">
          ${isCreate ? "" : `<button type="button" class="planning-editor-delete" data-planning-editor-action="delete">Supprimer</button>`}
          <button type="button" class="planning-editor-cancel" data-planning-editor-action="cancel">Annuler</button>
          <button type="button" class="planning-editor-validate" data-planning-editor-action="validate" ${canValidate ? "" : "disabled"}>Valider</button>
        </div>
      </section>
    </div>
  `;
}

function planningActivityActionLabel(action) {
  const labels = {
    created: "Création",
    imported: "Import",
    updated: "Modification",
    deleted: "Suppression"
  };
  return labels[action] || action || "Action";
}

function planningActivityValue(value) {
  const text = stringValue(value).trim();
  return text || "-";
}

function planningFieldLabel(field) {
  const labels = {
    simulatorName: "Simu",
    type: "Type",
    dateMode: "Mode date",
    date: "Date",
    month: "Période",
    startTime: "Début",
    endTime: "Fin",
    participants: "Technicien",
    tri: "TRI",
    notes: "Notes"
  };
  return labels[field] || field;
}

function planningOptionHTML(value, label, selectedValue) {
  return `<option value="${escapeAttribute(value)}" ${value === selectedValue ? "selected" : ""}>${escapeHtml(label)}</option>`;
}

function planningPlaceholderOptionHTML(label, selectedValue) {
  return `<option value="" ${selectedValue ? "" : "selected"} disabled hidden>${escapeHtml(label)}</option>`;
}

function planningTechnicianSelectOptionsHTML(row) {
  const selected = stringValue(row.participants).trim();
  const technicians = planningTechnicianOptions(row);
  const hasSelectedTechnician = technicians.some((technician) => technician === selected);
  return `
    ${planningOptionHTML("", "Technicien", selected)}
    ${selected && !hasSelectedTechnician ? planningOptionHTML(selected, selected, selected) : ""}
    ${technicians.map((technician) => planningOptionHTML(technician, technician, selected)).join("")}
    ${planningOptionHTML(planningFreeTechnicianValue, "Saisie libre...", "")}
  `;
}

function planningTechnicianMenuHTML(row) {
  const technicians = planningTechnicianOptions(row);
  if (!technicians.length) {
    return `<div class="planning-technician-menu empty" data-planning-technician-menu>Aucun technicien</div>`;
  }

  return `
    <div class="planning-technician-menu" data-planning-technician-menu>
      ${technicians.map((technician) => `
        <button type="button" data-planning-editor-action="pick-technician" data-planning-technician="${escapeAttribute(technician)}">
          ${escapeHtml(technician)}
        </button>
      `).join("")}
    </div>
  `;
}

function planningDateDisplayButtonHTML(row, { enabled = false } = {}) {
  const isPeriod = row.dateMode === "month";
  const hasValue = isPeriod
    ? /^\d{4}-\d{2}$/.test(row.month || row.date.slice(0, 7))
    : /^\d{4}-\d{2}-\d{2}$/.test(row.date);
  const value = isPeriod
    ? (hasValue ? planningMonthDisplay(row.month || row.date.slice(0, 7)) : "Période")
    : (hasValue ? planningDateDisplay(row.date) : "Date");
  const className = `${isPeriod ? "planning-period-highlight" : ""} ${hasValue ? "" : "planning-empty-select"}`.trim();
  return `
    <button
      class="planning-date-display-button ${className}"
      type="button"
      data-planning-date-open="${isPeriod ? "month" : "date"}"
      aria-label="${isPeriod ? "Période" : "Date"}"
      ${enabled && state.isPlanningEditMode && canCurrentUserEditPlanning() ? "" : "disabled"}
    >
      ${escapeHtml(value)}
    </button>
  `;
}

function planningTimeDisplayButtonHTML(value, field, { disabled = false } = {}) {
  const hasValue = /^\d{2}:\d{2}$/.test(value || "");
  return `
    <button
      class="planning-time-display-button ${hasValue ? "" : "planning-empty-select"}"
      type="button"
      data-planning-time-open="${escapeAttribute(field)}"
      aria-label="${field === "startTime" ? "Heure de début" : "Heure de fin"}"
      ${disabled || !state.isPlanningEditMode || !canCurrentUserEditPlanning() ? "disabled" : ""}
    >
      ${escapeHtml(hasValue ? value : "--:--")}
    </button>
  `;
}

function planningDateDisplay(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return "Date";
  }
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function planningMonthDisplay(value) {
  if (!/^\d{4}-\d{2}$/.test(value)) {
    return "Période";
  }
  const [year, month] = value.split("-");
  return `${planningMonthName(month)} ${year}`;
}

function planningMonthName(value) {
  return planningMonthNames[Number(value) - 1] || value;
}

function planningDateParts(value) {
  const today = new Date();
  const fallback = {
    day: String(today.getDate()).padStart(2, "0"),
    month: String(today.getMonth() + 1).padStart(2, "0"),
    year: String(today.getFullYear())
  };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return fallback;
  }
  const [year, month, day] = value.split("-");
  return { day, month, year };
}

function planningMonthParts(value) {
  const today = new Date();
  if (!/^\d{4}-\d{2}$/.test(value)) {
    return {
      month: String(today.getMonth() + 1).padStart(2, "0"),
      year: String(today.getFullYear())
    };
  }
  const [year, month] = value.split("-");
  return { month, year };
}

function planningYearOptions(selectedYear) {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 9 }, (_, index) => currentYear - 2 + index);
  const parsedSelectedYear = Number(selectedYear);
  if (Number.isInteger(parsedSelectedYear) && !years.includes(parsedSelectedYear)) {
    years.push(parsedSelectedYear);
  }
  return years.sort((a, b) => a - b);
}

function planningDateWheelHTML(value) {
  const parts = planningDateParts(value);
  return `
    <div class="planning-date-wheel" data-planning-date-wheel>
      <select data-planning-date-part="day" aria-label="Jour">
        ${Array.from({ length: 31 }, (_, index) => {
          const day = String(index + 1).padStart(2, "0");
          return planningOptionHTML(day, day, parts.day);
        }).join("")}
      </select>
      <select data-planning-date-part="month" aria-label="Mois">
        ${Array.from({ length: 12 }, (_, index) => {
          const month = String(index + 1).padStart(2, "0");
          return planningOptionHTML(month, planningMonthName(month), parts.month);
        }).join("")}
      </select>
      <select data-planning-date-part="year" aria-label="Année">
        ${planningYearOptions(parts.year).map((year) => planningOptionHTML(String(year), String(year), parts.year)).join("")}
      </select>
    </div>
  `;
}

function planningMonthWheelHTML(value) {
  const parts = planningMonthParts(value);
  return `
    <div class="planning-date-wheel period" data-planning-date-wheel>
      <select data-planning-date-part="month" aria-label="Mois">
        ${Array.from({ length: 12 }, (_, index) => {
          const month = String(index + 1).padStart(2, "0");
          return planningOptionHTML(month, planningMonthName(month), parts.month);
        }).join("")}
      </select>
      <select data-planning-date-part="year" aria-label="Année">
        ${planningYearOptions(parts.year).map((year) => planningOptionHTML(String(year), String(year), parts.year)).join("")}
      </select>
    </div>
  `;
}

function handlePlanningTableClick(event) {
  const action = event.target.closest("[data-planning-action]")?.dataset.planningAction;

  if (action === "return-notes") {
    showNotesView();
    return;
  }

  if (action === "enter-edit") {
    if (!canCurrentUserEditPlanning()) {
      return;
    }
    state.isPlanningEditMode = true;
    renderPlanningTable();
    return;
  }

  if (action === "exit-edit") {
    state.isPlanningEditMode = false;
    state.planningEditor = null;
    state.planningRows = normalizedPlanningRows().filter((row) => !isPlanningDraftRow(row));
    closePlanningDateWheel();
    renderPlanningTable();
    return;
  }

  if (action === "toggle-history") {
    if (state.showsPlanningHistory) {
      state.showsPlanningHistory = false;
      state.selectedPlanningHistoryYears.clear();
      state.isPlanningHistoryPickerOpen = false;
      renderPlanningTable();
      loadPlanningRowsFromFirestore({ force: true, includeHistory: false });
      return;
    }

    state.isPlanningHistoryPickerOpen = true;
    renderPlanningTable();
    loadPlanningRowsFromFirestore({ force: true, includeHistory: true });
    return;
  }

  if (action === "cancel-history-picker") {
    state.isPlanningHistoryPickerOpen = false;
    if (!state.showsPlanningHistory) {
      state.selectedPlanningHistoryYears.clear();
    }
    renderPlanningTable();
    return;
  }

  if (action === "show-history-picker") {
    state.showsPlanningHistory = true;
    state.isPlanningHistoryPickerOpen = false;
    renderPlanningTable();
    return;
  }

  if (action === "add-row") {
    if (!state.isPlanningEditMode || !canCurrentUserEditPlanning()) {
      return;
    }
    openPlanningEditor(createPlanningRow(), { mode: "create" });
    renderPlanningTable();
    return;
  }

  if (action === "sort-date") {
    state.activePlanningSort = "date";
    sortPlanningRowsByDate();
    savePlanningRowsLocal();
    renderPlanningTable();
    return;
  }

  if (action === "sort-simulator") {
    state.activePlanningSort = "simulator";
    sortPlanningRowsBySimulator();
    savePlanningRowsLocal();
    renderPlanningTable();
    return;
  }

  if (action === "sort-type") {
    state.activePlanningSort = "type";
    sortPlanningRowsByAlphabeticField("type");
    savePlanningRowsLocal();
    renderPlanningTable();
    return;
  }

  if (action === "sort-technician") {
    state.activePlanningSort = "technician";
    sortPlanningRowsByAlphabeticField("participants");
    savePlanningRowsLocal();
    renderPlanningTable();
    return;
  }

  if (action === "sort-tri") {
    state.activePlanningSort = "tri";
    sortPlanningRowsByAlphabeticField("tri");
    savePlanningRowsLocal();
    renderPlanningTable();
    return;
  }

  const rowID = event.target.closest("[data-planning-row-id]")?.dataset.planningRowId;
  if (!rowID) {
    return;
  }

  if (action === "show-activity") {
    togglePlanningActivity(rowID);
    return;
  }

  if (action === "edit-row") {
    if (!state.isPlanningEditMode || !canCurrentUserEditPlanning()) {
      return;
    }
    const row = state.planningRows.find((candidate) => candidate.id === rowID);
    if (row) {
      openPlanningEditor(row, { mode: "edit" });
      renderPlanningTable();
    }
    return;
  }

  if (action === "confirm-new-row") {
    if (!state.isPlanningEditMode || !canCurrentUserEditPlanning()) {
      return;
    }
    const row = state.planningRows.find((candidate) => candidate.id === rowID);
    if (!row || !isPlanningDraftRow(row)) {
      return;
    }
    row.isDraft = false;
    savePlanningRows(row, { before: null, changedFields: Object.keys(planningFirestorePayload(row)), action: "created" });
    renderPlanningTable();
    return;
  }

  if (action === "cancel-new-row") {
    if (!state.isPlanningEditMode || !canCurrentUserEditPlanning()) {
      return;
    }
    state.planningRows = state.planningRows.filter((row) => row.id !== rowID);
    renderPlanningTable();
    return;
  }

  if (action === "delete-row") {
    if (!state.isPlanningEditMode || !canCurrentUserEditPlanning()) {
      return;
    }
    const deletedRow = state.planningRows.find((row) => row.id === rowID);
    state.planningRows = state.planningRows.filter((row) => row.id !== rowID);
    if (!state.planningRows.length) {
      state.planningRows.push(createPlanningRow());
    }
    savePlanningRowsLocal();
    if (deletedRow) {
      deletePlanningRowFromFirestore(deletedRow);
    }
    renderPlanningTable();
    return;
  }

  if (!action && state.isPlanningEditMode && canCurrentUserEditPlanning()) {
    const row = state.planningRows.find((candidate) => candidate.id === rowID);
    if (row) {
      openPlanningEditor(row, { mode: "edit" });
      renderPlanningTable();
    }
  }
}

function openPlanningEditor(row, { mode = "edit" } = {}) {
  const draft = normalizePlanningRow(row);
  state.planningEditor = {
    mode,
    original: mode === "edit" ? normalizePlanningRow(row) : null,
    draft
  };
}

function closePlanningEditor() {
  state.planningEditor = null;
  closePlanningDateWheel();
  closePlanningTechnicianMenu();
}

function handlePlanningEditorClick(event) {
  const editorAction = event.target.closest("[data-planning-editor-action]")?.dataset.planningEditorAction;
  if (!editorAction) {
    return Boolean(event.target.closest("[data-planning-editor]"));
  }

  event.preventDefault();
  event.stopPropagation();

  if (editorAction === "toggle-technician-list") {
    togglePlanningTechnicianMenu(event.target.closest("[data-planning-technician-combobox]"));
    return true;
  }

  if (editorAction === "pick-technician") {
    pickPlanningTechnician(event.target.closest("[data-planning-technician]"));
    return true;
  }

  if (editorAction === "cancel") {
    closePlanningEditor();
    renderPlanningTable();
    return true;
  }

  if (editorAction === "validate") {
    validatePlanningEditor();
    return true;
  }

  if (editorAction === "delete") {
    deletePlanningEditorRow();
    return true;
  }

  return true;
}

function togglePlanningTechnicianMenu(combobox) {
  if (!combobox || !state.planningEditor) {
    return;
  }

  const existingMenu = document.querySelector("[data-planning-technician-menu]");
  closePlanningTechnicianMenu();
  if (existingMenu) {
    return;
  }

  const template = document.createElement("template");
  template.innerHTML = planningTechnicianMenuHTML(state.planningEditor.draft).trim();
  const menu = template.content.firstElementChild;
  if (!menu) {
    return;
  }
  const rect = combobox.getBoundingClientRect();
  menu.style.visibility = "hidden";
  menu.style.minWidth = `${Math.round(rect.width)}px`;
  document.body.append(menu);

  const menuRect = menu.getBoundingClientRect();
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - menuRect.width - 8));
  const belowTop = rect.bottom + 5;
  const aboveTop = rect.top - menuRect.height - 5;
  const top = belowTop + menuRect.height > window.innerHeight - 8 && aboveTop >= 8
    ? aboveTop
    : Math.min(belowTop, Math.max(8, window.innerHeight - menuRect.height - 8));
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
  menu.style.visibility = "";
}

function closePlanningTechnicianMenu() {
  document.querySelector("[data-planning-technician-menu]")?.remove();
}

function pickPlanningTechnician(optionButton) {
  const technician = optionButton?.dataset?.planningTechnician || "";
  const editor = state.planningEditor;
  if (!technician || !editor) {
    return;
  }

  editor.draft.participants = technician;
  const input = elements.noteGroups.querySelector("[data-planning-editor-field='participants']");
  if (input) {
    input.value = technician;
    const alertLevel = planningTechnicianAlertLevel(editor.draft);
    input.classList.toggle("planning-technician-alert", Boolean(alertLevel));
    input.classList.toggle("warning", alertLevel === "warning");
    input.classList.toggle("danger", alertLevel === "danger");
    input.focus();
  }
  closePlanningTechnicianMenu();
}

function handlePlanningEditorFieldEdit(event) {
  const field = event.target?.dataset?.planningEditorField || "";
  const editor = state.planningEditor;
  if (!field || !editor || !state.isPlanningEditMode || !canCurrentUserEditPlanning()) {
    return;
  }

  const row = editor.draft;
  row[field] = event.target.type === "checkbox" ? event.target.checked : event.target.value;
  refreshPlanningEmptyFieldState(event.target);

  if (field === "participants" && event.type === "input") {
    return;
  }

  if (field === "notes") {
    if (event.type === "input") {
      return;
    }
    row.notes = normalizePlanningSingleLineText(row.notes);
    event.target.value = row.notes;
    return;
  }

  if (field === "tri" && event.type === "input") {
    return;
  }

  if (field === "dateMode") {
    if (row.dateMode === "month" && /^\d{4}-\d{2}-\d{2}$/.test(row.date)) {
      row.month = row.date.slice(0, 7);
    } else if (row.dateMode === "date" && /^\d{4}-\d{2}$/.test(row.month)) {
      row.date = `${row.month}-01`;
    }
    if (row.dateMode === "month") {
      row.startTime = "";
      row.endTime = "";
    } else if (shouldDisablePlanningEndTime(row)) {
      row.endTime = "";
    }
    renderPlanningTable();
    return;
  }

  if (field === "type" && shouldDisablePlanningEndTime(row)) {
    row.endTime = "";
    renderPlanningTable();
    return;
  }

  if ((field === "startTime" || field === "type") && shouldAutoFillPlanningEndTime(row)) {
    row.endTime = addHoursToTime(row.startTime, 4);
    renderPlanningTable();
    return;
  }

  if (["simulatorName", "type", "date", "month", "startTime", "endTime", "participants", "tri"].includes(field)) {
    renderPlanningTable();
  }
}

function refreshPlanningEmptyFieldState(fieldElement) {
  if (!fieldElement?.matches?.(".planning-empty-select, [data-planning-editor-field='simulatorName'], [data-planning-editor-field='type']")) {
    return;
  }

  fieldElement.classList.toggle("planning-empty-select", !fieldElement.value);
}

function canValidatePlanningEditorRow(row) {
  const normalizedRow = normalizePlanningRow(row);
  const hasDateValue = normalizedRow.dateMode === "month"
    ? /^\d{4}-\d{2}$/.test(normalizedRow.month)
    : /^\d{4}-\d{2}-\d{2}$/.test(normalizedRow.date);
  return Boolean(normalizedRow.simulatorName && normalizedRow.type && hasDateValue);
}

function canEditPlanningTri(row) {
  return canValidatePlanningEditorRow(row);
}

function validatePlanningEditor() {
  const editor = state.planningEditor;
  if (!editor || !canCurrentUserEditPlanning()) {
    return;
  }

  const row = normalizePlanningRow(editor.draft);
  if (!canValidatePlanningEditorRow(row)) {
    return;
  }

  const original = editor.original ? normalizePlanningRow(editor.original) : null;
  const fields = planningEditableFields();
  const changedFields = original
    ? fields.filter((field) => stringValue(original[field]) !== stringValue(row[field]))
    : planningUserActivityFields(row);

  if (editor.mode === "create") {
    state.planningRows.unshift(row);
    savePlanningRows(row, { before: null, changedFields, action: "created" });
  } else {
    const index = state.planningRows.findIndex((candidate) => candidate.id === row.id);
    if (index >= 0) {
      state.planningRows[index] = row;
    }
    if (changedFields.length) {
      savePlanningRows(row, { before: original, changedFields });
    } else {
      savePlanningRowsLocal();
    }
  }

  closePlanningEditor();
  renderPlanningTable();
}

function deletePlanningEditorRow() {
  const editor = state.planningEditor;
  if (!editor || editor.mode === "create" || !canCurrentUserEditPlanning()) {
    return;
  }

  const row = normalizePlanningRow(editor.original || editor.draft);
  state.planningRows = state.planningRows.filter((candidate) => candidate.id !== row.id);
  if (!state.planningRows.length) {
    state.planningRows.push(createPlanningRow());
  }
  savePlanningRowsLocal();
  deletePlanningRowFromFirestore(row);
  closePlanningEditor();
  renderPlanningTable();
}

function planningEditableFields() {
  return ["simulatorName", "type", "dateMode", "date", "month", "startTime", "endTime", "participants", "tri", "notes"];
}

function planningUserActivityFields(row) {
  const normalizedRow = normalizePlanningRow(row);
  return ["simulatorName", "type", "dateMode", normalizedRow.dateMode === "month" ? "month" : "date", "startTime", "endTime", "participants", "tri", "notes"]
    .filter((field) => stringValue(normalizedRow[field]));
}

function handlePlanningFieldEdit(event) {
  const field = event.target?.dataset?.planningField || "";
  const rowElement = event.target?.closest("[data-planning-row-id]");
  const rowID = rowElement?.dataset.planningRowId;
  if (!field || !rowID) {
    return;
  }

  const row = state.planningRows.find((candidate) => candidate.id === rowID);
  if (!row) {
    return;
  }

  const isNotesField = field === "notes";
  if (isNotesField) {
    if (!canCurrentUserAccessPlanning()) {
      return;
    }
  } else if (!state.isPlanningEditMode || !canCurrentUserEditPlanning()) {
    return;
  }

  const before = { ...row };
  let shouldRenderAfterFreeTechnician = false;

  row[field] = event.target.type === "checkbox" ? event.target.checked : event.target.value;
  if (field === "participants" && row.participants === planningFreeTechnicianValue) {
    row.participants = before.participants || "";
    event.target.value = row.participants;
    shouldRenderAfterFreeTechnician = true;
  }
  if (field === "notes") {
    if (event.type === "input") {
      return;
    }
    row.notes = normalizePlanningSingleLineText(row.notes);
    event.target.value = row.notes;
  }

  if (field === "dateMode") {
    if (row.dateMode === "month" && /^\d{4}-\d{2}-\d{2}$/.test(row.date)) {
      row.month = row.date.slice(0, 7);
    } else if (row.dateMode === "date" && /^\d{4}-\d{2}$/.test(row.month)) {
      row.date = `${row.month}-01`;
    }
    if (row.dateMode === "month") {
      row.startTime = "";
      row.endTime = "";
    } else if (shouldDisablePlanningEndTime(row)) {
      row.endTime = "";
    }
    savePlanningRows(row, { before, changedFields: ["dateMode", "date", "month", "startTime", "endTime"] });
    renderPlanningTable();
    return;
  }

  if (field === "type" && shouldDisablePlanningEndTime(row)) {
    row.endTime = "";
    savePlanningRows(row, { before, changedFields: ["type", "endTime"] });
    renderPlanningTable();
    return;
  }

  if ((field === "startTime" || field === "type") && shouldAutoFillPlanningEndTime(row)) {
    row.endTime = addHoursToTime(row.startTime, 4);
    savePlanningRows(row, { before, changedFields: [field, "endTime"] });
    renderPlanningTable();
    return;
  }

  if (field === "date" || field === "month" || field === "startTime") {
    savePlanningRows(row, { before, changedFields: [field] });
    renderPlanningTable();
    return;
  }

  savePlanningRows(row, { before, changedFields: [field] });
  if (shouldRenderAfterFreeTechnician) {
    renderPlanningTable();
    return;
  }
  refreshPlanningRowAlerts(row, rowElement);
  if (field === "endTime") {
    rowElement.querySelector(".planning-col-team").innerHTML = planningTeamHTML(row);
  }
  refreshPlanningStatusIcons();
  updatePlanningSubtitleOnly();
}

function preparePlanningTimeInput(event) {
  if (!state.isPlanningEditMode || !canCurrentUserEditPlanning()) {
    return;
  }

  const input = event.target;
  if (!input?.matches(".planning-time-input") || input.value) {
    return;
  }

  const field = input.dataset.planningField;
  const rowElement = input.closest("[data-planning-row-id]");
  const rowID = rowElement?.dataset.planningRowId;
  const row = state.planningRows.find((candidate) => candidate.id === rowID);
  if (!field || !row || input.disabled) {
    return;
  }

  const before = { ...row };
  row[field] = "12:00";
  input.value = "12:00";

  if (field === "startTime" && shouldAutoFillPlanningEndTime(row)) {
    row.endTime = addHoursToTime(row.startTime, 4);
    const endInput = rowElement.querySelector("[data-planning-field='endTime']");
    if (endInput && !endInput.disabled) {
      endInput.value = row.endTime;
    }
  }

  savePlanningRows(row, { before, changedFields: field === "startTime" && shouldAutoFillPlanningEndTime(row) ? ["startTime", "endTime"] : [field] });
  refreshPlanningRowAlerts(row, rowElement);
  rowElement.querySelector(".planning-col-team").innerHTML = planningTeamHTML(row);
  refreshPlanningStatusIcons();
  updatePlanningSubtitleOnly();
}

function preparePlanningEditorTimeInput(event) {
  const input = event.target;
  const editor = state.planningEditor;
  if (!editor || !input?.matches(".planning-time-input") || input.value || input.disabled) {
    return;
  }

  const field = input.dataset.planningEditorField;
  if (!["startTime", "endTime"].includes(field)) {
    return;
  }

  const row = editor.draft;
  row[field] = "12:00";
  input.value = "12:00";
  if (field === "startTime" && shouldAutoFillPlanningEndTime(row)) {
    row.endTime = addHoursToTime(row.startTime, 4);
    const panel = input.closest("[data-planning-editor]");
    const endInput = panel?.querySelector("[data-planning-editor-field='endTime']");
    const teamPreview = panel?.querySelector(".planning-editor-team-preview");
    if (endInput && !endInput.disabled) {
      endInput.value = row.endTime;
    }
    if (teamPreview) {
      teamPreview.innerHTML = planningTeamHTML(row);
    }
  }
}

function openPlanningTimeWheel(event) {
  if (!state.isPlanningEditMode || !canCurrentUserEditPlanning()) {
    return;
  }

  const trigger = event.target.closest("[data-planning-time-open]");
  if (!trigger) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  closePlanningTimeWheel();
  closePlanningDateWheel();
  const editorElement = trigger.closest("[data-planning-editor]");
  const editor = state.planningEditor;
  if (!editorElement || !editor) {
    return;
  }

  const field = trigger.dataset.planningTimeOpen;
  if (!["startTime", "endTime"].includes(field) || trigger.disabled) {
    return;
  }

  const row = editor.draft;
  if (!/^\d{2}:\d{2}$/.test(row[field])) {
    row[field] = "12:00";
    if (field === "startTime" && shouldAutoFillPlanningEndTime(row)) {
      row.endTime = addHoursToTime(row.startTime, 4);
    }
  }

  const rect = trigger.getBoundingClientRect();
  const popover = document.createElement("div");
  popover.className = "planning-time-wheel-popover";
  popover.style.visibility = "hidden";
  popover.innerHTML = planningTimeWheelHTML(row[field]);

  const updateTimeValue = () => {
    row[field] = planningTimeFromWheel(popover);
    trigger.textContent = row[field];
    trigger.classList.toggle("planning-empty-select", !/^\d{2}:\d{2}$/.test(row[field]));
    if (field === "startTime" && shouldAutoFillPlanningEndTime(row)) {
      row.endTime = addHoursToTime(row.startTime, 4);
      const endButton = editorElement.querySelector("[data-planning-time-open='endTime']");
      if (endButton && !endButton.disabled) {
        endButton.textContent = row.endTime || "--:--";
        endButton.classList.toggle("planning-empty-select", !row.endTime);
      }
    }
    refreshPlanningEditorDerivedFields(editorElement, row);
  };

  updateTimeValue();
  popover.addEventListener("change", updateTimeValue);
  popover.addEventListener("click", (popoverEvent) => popoverEvent.stopPropagation());
  document.body.append(popover);

  const popoverRect = popover.getBoundingClientRect();
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - popoverRect.width - 8));
  const belowTop = rect.bottom + 4;
  const aboveTop = rect.top - popoverRect.height - 4;
  const top = belowTop + popoverRect.height > window.innerHeight - 8 && aboveTop >= 8
    ? aboveTop
    : Math.min(belowTop, Math.max(8, window.innerHeight - popoverRect.height - 8));
  popover.style.left = `${left}px`;
  popover.style.top = `${top}px`;
  popover.style.visibility = "";
  window.requestAnimationFrame(() => popover.querySelector("select")?.focus());
}

function planningTimeWheelHTML(value) {
  const time = /^\d{2}:\d{2}$/.test(value || "") ? value : "12:00";
  const [selectedHour, selectedMinute] = time.split(":");
  const minuteOptions = ["00", "15", "30", "45"];
  const normalizedMinute = minuteOptions.includes(selectedMinute) ? selectedMinute : nearestPlanningQuarterMinute(selectedMinute);
  return `
    <div class="planning-time-wheel" data-planning-time-wheel>
      <select data-planning-time-part="hour" aria-label="Heure">
        ${Array.from({ length: 24 }, (_, hour) => {
          const valueText = String(hour).padStart(2, "0");
          return planningOptionHTML(valueText, valueText, selectedHour);
        }).join("")}
      </select>
      <select data-planning-time-part="minute" aria-label="Minutes">
        ${minuteOptions.map((minute) => planningOptionHTML(minute, minute, normalizedMinute)).join("")}
      </select>
    </div>
  `;
}

function nearestPlanningQuarterMinute(value) {
  const minute = Number(value);
  if (!Number.isFinite(minute)) {
    return "00";
  }
  const rounded = Math.round(minute / 15) * 15;
  return String(rounded >= 60 ? 45 : rounded).padStart(2, "0");
}

function planningTimeFromWheel(wheel) {
  const hour = wheel?.querySelector("[data-planning-time-part='hour']")?.value || "12";
  const minute = wheel?.querySelector("[data-planning-time-part='minute']")?.value || "00";
  return `${hour}:${minute}`;
}

function closePlanningTimeWheel() {
  document.querySelector(".planning-time-wheel-popover")?.remove();
}

function openPlanningDateWheel(event) {
  if (!state.isPlanningEditMode || !canCurrentUserEditPlanning()) {
    return;
  }

  const trigger = event.target.closest("[data-planning-date-open]");
  if (!trigger) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  closePlanningDateWheel();
  closePlanningTimeWheel();
  const editorElement = trigger.closest("[data-planning-editor]");
  const rowElement = trigger.closest("[data-planning-row-id]");
  const rowID = rowElement?.dataset.planningRowId;
  const row = editorElement
    ? state.planningEditor?.draft
    : state.planningRows.find((candidate) => candidate.id === rowID);
  if (!row) {
    return;
  }

  const mode = trigger.dataset.planningDateOpen === "month" ? "month" : "date";
  const rect = trigger.getBoundingClientRect();
  const popover = document.createElement("div");
  popover.className = "planning-date-wheel-popover";
  popover.style.visibility = "hidden";
  popover.innerHTML = mode === "month"
    ? planningMonthWheelHTML(row.month || row.date.slice(0, 7))
    : planningDateWheelHTML(row.date);

  const updateDateValue = () => {
    const before = { ...row };
    if (mode === "month") {
      row.month = planningMonthFromWheel(popover);
      trigger.textContent = planningMonthDisplay(row.month);
      trigger.classList.toggle("planning-empty-select", !/^\d{4}-\d{2}$/.test(row.month));
      if (!editorElement) {
        savePlanningRows(row, { before, changedFields: ["month"] });
      }
    } else {
      row.date = planningDateFromWheel(popover);
      trigger.textContent = planningDateDisplay(row.date);
      trigger.classList.toggle("planning-empty-select", !/^\d{4}-\d{2}-\d{2}$/.test(row.date));
      const teamHTML = planningTeamHTML(row);
      const rowTeamCell = rowElement?.querySelector(".planning-col-team");
      const editorTeamCell = editorElement?.querySelector(".planning-editor-team-preview");
      if (rowTeamCell) {
        rowTeamCell.innerHTML = teamHTML;
      }
      if (editorTeamCell) {
        editorTeamCell.innerHTML = teamHTML;
      }
      if (!editorElement) {
        savePlanningRows(row, { before, changedFields: ["date"] });
      }
    }
    if (rowElement) {
      refreshPlanningRowAlerts(row, rowElement);
      refreshPlanningStatusIcons();
    } else if (editorElement) {
      refreshPlanningEditorDerivedFields(editorElement, row);
    }
  };

  if (editorElement && ((mode === "month" && !/^\d{4}-\d{2}$/.test(row.month)) || (mode === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(row.date)))) {
    updateDateValue();
  }

  popover.addEventListener("change", updateDateValue);
  popover.addEventListener("click", (popoverEvent) => popoverEvent.stopPropagation());
  document.body.append(popover);

  const popoverRect = popover.getBoundingClientRect();
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - popoverRect.width - 8));
  const belowTop = rect.bottom + 4;
  const aboveTop = rect.top - popoverRect.height - 4;
  const top = belowTop + popoverRect.height > window.innerHeight - 8 && aboveTop >= 8
    ? aboveTop
    : Math.min(belowTop, Math.max(8, window.innerHeight - popoverRect.height - 8));
  popover.style.left = `${left}px`;
  popover.style.top = `${top}px`;
  popover.style.visibility = "";
  window.requestAnimationFrame(() => popover.querySelector("select")?.focus());
}

function planningDateFromWheel(wheel) {
  const parts = {
    day: wheel?.querySelector("[data-planning-date-part='day']")?.value || "01",
    month: wheel?.querySelector("[data-planning-date-part='month']")?.value || "01",
    year: wheel?.querySelector("[data-planning-date-part='year']")?.value || String(new Date().getFullYear())
  };
  const year = Number(parts.year);
  const monthIndex = Number(parts.month) - 1;
  const requestedDay = Number(parts.day);
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const day = Math.min(requestedDay, lastDay);
  return `${String(year).padStart(4, "0")}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function planningMonthFromWheel(wheel) {
  const month = wheel?.querySelector("[data-planning-date-part='month']")?.value || "01";
  const year = wheel?.querySelector("[data-planning-date-part='year']")?.value || String(new Date().getFullYear());
  return `${String(year).padStart(4, "0")}-${month}`;
}

function closePlanningDateWheel() {
  document.querySelector(".planning-date-wheel-popover")?.remove();
}

function refreshPlanningEditorDerivedFields(editorElement, row) {
  const teamPreview = editorElement.querySelector(".planning-editor-team-preview");
  if (teamPreview) {
    teamPreview.innerHTML = planningTeamHTML(row);
  }

  const technicianField = editorElement.querySelector("[data-planning-editor-field='participants']");
  if (technicianField && !technicianField.disabled) {
    const alertLevel = planningTechnicianAlertLevel(row);
    technicianField.classList.toggle("planning-technician-alert", Boolean(alertLevel));
    technicianField.classList.toggle("warning", alertLevel === "warning");
    technicianField.classList.toggle("danger", alertLevel === "danger");
  }
  const technicianMenu = editorElement.querySelector("[data-planning-technician-menu]");
  if (technicianMenu) {
    technicianMenu.outerHTML = planningTechnicianMenuHTML(row);
  }

  const triInput = editorElement.querySelector("[data-planning-editor-field='tri']");
  if (triInput) {
    triInput.disabled = !canEditPlanningTri(row);
    triInput.classList.toggle("planning-tri-alert", shouldHighlightMissingPlanningTri(row));
  }

  const validateButton = editorElement.querySelector("[data-planning-editor-action='validate']");
  if (validateButton) {
    validateButton.disabled = !canValidatePlanningEditorRow(row);
  }
}

async function togglePlanningActivity(rowID) {
  if (state.planningActivityByRowID.has(rowID)) {
    state.planningActivityByRowID.delete(rowID);
    renderPlanningTable();
    return;
  }

  if (state.planningActivityLoadingIDs.has(rowID)) {
    return;
  }

  state.planningActivityLoadingIDs.add(rowID);
  renderPlanningTable();
  try {
    const response = await getRegulatoryPlanningActivity({ eventID: rowID, limit: 25 });
    const activities = Array.isArray(response?.data?.activities) ? response.data.activities : [];
    state.planningActivityByRowID.set(rowID, activities);
  } catch (error) {
    setStatus(error.message || "Suivi planning indisponible");
    state.planningActivityByRowID.set(rowID, []);
  } finally {
    state.planningActivityLoadingIDs.delete(rowID);
    renderPlanningTable();
  }
}

function updatePlanningSubtitleOnly() {
  if (state.activeView !== "planning") {
    return;
  }

  const rows = normalizedPlanningRows();
  elements.pageSubtitle.textContent = `${rows.length} element${rows.length > 1 ? "s" : ""}`;
}

function focusPlanningSimulator(rowID) {
  requestAnimationFrame(() => {
    elements.noteGroups
      .querySelector(`[data-planning-row-id="${CSS.escape(rowID)}"] [data-planning-field='simulatorName']`)
      ?.focus();
  });
}

function normalizedPlanningRows() {
  state.planningRows = Array.isArray(state.planningRows) && state.planningRows.length
    ? state.planningRows.map(normalizePlanningRow)
    : [createPlanningRow()];
  return state.planningRows;
}

function visiblePlanningRows() {
  const rows = normalizedPlanningRows();
  if (!state.showsPlanningHistory) {
    return rows.filter((row) => !isPlanningEventPast(row));
  }

  return rows.filter((row) => {
    if (!isPlanningEventPast(row)) {
      return true;
    }

    const year = planningArchiveYear(row);
    return year && state.selectedPlanningHistoryYears.has(year);
  });
}

function planningArchiveYears() {
  return [...new Set(normalizedPlanningRows()
    .filter((row) => isPlanningEventPast(row))
    .map(planningArchiveYear)
    .filter(Boolean))]
    .sort((first, second) => first - second);
}

function planningArchiveYear(row) {
  const sortDate = planningSortDateValue(row);
  const match = /^(\d{4})-\d{2}-\d{2}$/.exec(sortDate);
  return match ? Number(match[1]) : null;
}

function handlePlanningHistoryYearChange(input) {
  const years = planningArchiveYears();
  const checkedYears = [...elements.noteGroups.querySelectorAll("[data-planning-history-year]:checked")]
    .map((checkbox) => Number(checkbox.dataset.planningHistoryYear))
    .filter(Number.isInteger);

  state.selectedPlanningHistoryYears.clear();
  checkedYears.forEach((checkedYear) => {
    years
      .filter((year) => year >= checkedYear)
      .forEach((year) => state.selectedPlanningHistoryYears.add(year));
  });

  renderPlanningTable();
}

function normalizePlanningRow(row) {
  const isDraft = row?.isDraft === true;
  const dateMode = row.dateMode === "month" ? "month" : "date";
  const hasValidDate = /^\d{4}-\d{2}-\d{2}$/.test(row.date);
  return {
    id: stringValue(row.id) || crypto.randomUUID(),
    simulatorName: normalizePlanningSimulatorName(row.simulatorName),
    type: isDraft && !row.type ? "" : normalizePlanningType(row.type),
    dateMode,
    date: hasValidDate ? row.date : "",
    month: /^\d{4}-\d{2}$/.test(row.month) ? row.month : (hasValidDate ? row.date.slice(0, 7) : ""),
    startTime: /^\d{2}:\d{2}$/.test(row.startTime) ? row.startTime : (/^\d{2}:\d{2}$/.test(row.time) ? row.time : ""),
    endTime: /^\d{2}:\d{2}$/.test(row.endTime) ? row.endTime : "",
    participants: stringValue(row.participants),
    tri: stringValue(row.tri),
    notes: normalizePlanningSingleLineText(row.notes),
    mirrorNoteID: stringValue(row.mirrorNoteID),
    hasModifications: row.hasModifications === true,
    isDraft
  };
}

function createPlanningRow({ draft = false } = {}) {
  return {
    id: crypto.randomUUID(),
    simulatorName: "",
    type: "",
    dateMode: "date",
    date: "",
    month: "",
    startTime: "",
    endTime: "",
    participants: "",
    tri: "",
    notes: "",
    mirrorNoteID: "",
    hasModifications: false,
    isDraft: draft
  };
}

function isPlanningDraftRow(row) {
  return row?.isDraft === true;
}

function normalizePlanningSingleLineText(value) {
  return stringValue(value)
    .split(/\r?\n+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .join("; ");
}

function loadPlanningRows() {
  try {
    const raw = localStorage.getItem(planningStorageKey);
    const parsed = JSON.parse(raw || "[]");
    if (!Array.isArray(parsed) || !parsed.length || shouldReplaceLocalPlanningWithImport(parsed)) {
      localStorage.setItem(planningImportVersionStorageKey, regulatoryPlanningImportVersion);
      localStorage.setItem(planningStorageKey, JSON.stringify(importedRegulatoryPlanningRows));
      return importedRegulatoryPlanningRows.map(normalizePlanningRow);
    }
    return parsed.map(normalizePlanningRow);
  } catch {
    localStorage.setItem(planningImportVersionStorageKey, regulatoryPlanningImportVersion);
    return importedRegulatoryPlanningRows.map(normalizePlanningRow);
  }
}

function shouldReplaceLocalPlanningWithImport(rows) {
  if (localStorage.getItem(planningImportVersionStorageKey) === regulatoryPlanningImportVersion) {
    return false;
  }

  const normalizedRows = rows.map(normalizePlanningRow);
  if (normalizedRows.length && normalizedRows.every((row) => row.id.startsWith("import-2026-"))) {
    return true;
  }

  return normalizedRows.length <= 3 && normalizedRows.every((row) => {
    return !row.simulatorName
      || row.simulatorName === defaultPlanningSimulatorName()
      || row.date === isoDate(new Date());
  });
}

function normalizePlanningType(value) {
  if (!stringValue(value).trim()) {
    return "";
  }

  if (planningTypes.some((type) => type.value === value)) {
    return value;
  }

  if (value === "meeting") {
    return "reunion-technique";
  }

  if (normalizeKey(value) === "auto-eval" || normalizeKey(value) === "auto eval") {
    return "auto-eval";
  }

  return defaultPlanningType;
}

function shouldDisablePlanningEndTime(row) {
  return row.dateMode === "month" || ["dgac", "reunion-technique"].includes(row.type);
}

function shouldAutoFillPlanningEndTime(row) {
  return row.dateMode !== "month" && row.startTime && isPlanningFlyOut(row);
}

function isPlanningFlyOut(row) {
  return stringValue(row?.type).startsWith("fly-out-");
}

function addHoursToTime(value, hours) {
  if (!/^\d{2}:\d{2}$/.test(value)) {
    return "";
  }

  const [hour, minute] = value.split(":").map(Number);
  const totalMinutes = (hour * 60 + minute + hours * 60) % (24 * 60);
  const nextHour = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const nextMinute = String(totalMinutes % 60).padStart(2, "0");
  return `${nextHour}:${nextMinute}`;
}

function nextUpcomingPlanningRowID(rows) {
  const now = new Date();
  const upcomingRows = rows
    .map((row) => ({ row, range: planningEventRange(row) }))
    .filter((entry) => entry.range && entry.range.end >= now)
    .sort((first, second) => first.range.start - second.range.start);
  return upcomingRows[0]?.row.id || "";
}

function planningStatusIconsHTML(row, nextPlanningRowID) {
  const isPast = isPlanningEventPast(row);
  const isNext = row.id === nextPlanningRowID;
  const isIncomplete = !isPast && isPlanningRowIncomplete(row);
  if (!isPast && !isNext && !isIncomplete) {
    return "";
  }

  return `
    <div class="planning-status-icons">
      ${isPast ? `<span class="planning-status-icon past" title="Date passée" aria-label="Date passée">✓</span>` : ""}
      ${isNext ? `<span class="planning-status-icon next${isIncomplete ? " incomplete" : ""}" title="${isIncomplete ? "Prochain événement à compléter" : "Prochain événement à venir"}" aria-label="${isIncomplete ? "Prochain événement à compléter" : "Prochain événement à venir"}">➜</span>` : ""}
      ${!isNext && isIncomplete ? `<span class="planning-status-icon incomplete" title="Période, heure de début ou technicien à compléter" aria-label="Période, heure de début ou technicien à compléter">!</span>` : ""}
    </div>
  `;
}

function isPlanningRowIncomplete(row) {
  return row.dateMode === "month"
    || (isPlanningFlyOut(row) && !/^\d{2}:\d{2}$/.test(row.startTime))
    || !stringValue(row.participants).trim();
}

function planningTechnicianAlertLevel(row) {
  if (stringValue(row.participants).trim()) {
    return "";
  }

  if (row.dateMode === "month") {
    return "";
  }

  const range = planningEventRange(row);
  if (!range || range.end < new Date()) {
    return "";
  }

  const oneMonthFromNow = new Date();
  oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);
  return range.start <= oneMonthFromNow ? "danger" : "warning";
}

function shouldHighlightMissingPlanningTri(row) {
  if (stringValue(row.tri).trim()) {
    return false;
  }

  if (row.dateMode === "month") {
    return false;
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(row.date) && !isPlanningEventPast(row);
}

function shouldHighlightMissingPlanningStartTime(row) {
  if (/^\d{2}:\d{2}$/.test(row.startTime) || row.dateMode === "month") {
    return false;
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(row.date) && !isPlanningEventPast(row);
}

function refreshPlanningRowAlerts(row, rowElement) {
  if (!rowElement) {
    return;
  }

  const triInput = rowElement.querySelector("[data-planning-field='tri']");
  triInput?.classList.toggle("planning-tri-alert", shouldHighlightMissingPlanningTri(row));

  const startInput = rowElement.querySelector("[data-planning-field='startTime']");
  startInput?.classList.toggle("planning-time-alert", shouldHighlightMissingPlanningStartTime(row));

  const technicianInput = rowElement.querySelector("[data-planning-field='participants']");
  if (technicianInput) {
    technicianInput.classList.remove("warning", "danger");
    const alertLevel = planningTechnicianAlertLevel(row);
    technicianInput.classList.toggle("planning-technician-alert", Boolean(alertLevel));
    if (alertLevel) {
      technicianInput.classList.add(alertLevel);
    }
  }
}

function sortPlanningRowsByDate() {
  state.planningRows = normalizedPlanningRows().sort(comparePlanningRowsByDate);
}

function sortPlanningRowsBySimulator() {
  state.planningRows = normalizedPlanningRows().sort((first, second) => {
    const draftOrder = Number(isPlanningDraftRow(second)) - Number(isPlanningDraftRow(first));
    const simulatorOrder = planningSimulatorSortValue(first.simulatorName) - planningSimulatorSortValue(second.simulatorName)
      || first.simulatorName.localeCompare(second.simulatorName, "fr", { sensitivity: "base" });
    return draftOrder || simulatorOrder || comparePlanningRowsByDate(first, second);
  });
}

function sortPlanningRowsByAlphabeticField(field) {
  state.planningRows = normalizedPlanningRows().sort((first, second) => {
    const draftOrder = Number(isPlanningDraftRow(second)) - Number(isPlanningDraftRow(first));
    const firstValue = planningAlphabeticSortLabel(first, field);
    const secondValue = planningAlphabeticSortLabel(second, field);
    return draftOrder
      || firstValue.localeCompare(secondValue, "fr", { sensitivity: "base" })
      || comparePlanningRowsByDate(first, second);
  });
}

function planningAlphabeticSortLabel(row, field) {
  if (field === "type") {
    return planningTypes.find((type) => type.value === row.type)?.label || row.type;
  }

  return stringValue(row[field]).trim();
}

function comparePlanningRowsByDate(first, second) {
  return Number(isPlanningDraftRow(second)) - Number(isPlanningDraftRow(first))
    || planningEventSortTime(first) - planningEventSortTime(second)
    || first.simulatorName.localeCompare(second.simulatorName, "fr", { sensitivity: "base" })
    || first.id.localeCompare(second.id);
}

function planningEventSortTime(row) {
  return planningEventRange(row)?.start.getTime() || Number.MAX_SAFE_INTEGER;
}

function planningSimulatorSortValue(name) {
  const normalizedName = normalizeKey(name);
  const simulator = state.allSimulators.find((candidate) => normalizeKey(candidate.name) === normalizedName);
  return simulator ? simulator.sortOrder : Number.MAX_SAFE_INTEGER;
}

function refreshPlanningStatusIcons() {
  if (state.activeView !== "planning") {
    return;
  }

  const rows = visiblePlanningRows();
  const nextPlanningRowID = nextUpcomingPlanningRowID(rows);
  rows.forEach((row) => {
    const cell = elements.noteGroups.querySelector(`[data-planning-row-id="${CSS.escape(row.id)}"] .planning-col-status`);
    if (cell) {
      cell.innerHTML = planningStatusIconsHTML(row, nextPlanningRowID);
    }
  });
}

function isPlanningEventPast(row) {
  const range = planningEventRange(row);
  return Boolean(range && range.end < new Date());
}

function planningEventRange(row) {
  if (row.dateMode === "month") {
    if (!/^\d{4}-\d{2}$/.test(row.month)) {
      return null;
    }

    const [year, month] = row.month.split("-").map(Number);
    return {
      start: new Date(year, month - 1, 1, 0, 0, 0, 0),
      end: new Date(year, month, 0, 23, 59, 59, 999)
    };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date)) {
    return null;
  }

  const day = parseDateInput(row.date);
  const start = /^\d{2}:\d{2}$/.test(row.startTime)
    ? planningDateWithTime(day, row.startTime)
    : dateAt(day, 0, 0);
  let end = /^\d{2}:\d{2}$/.test(row.endTime)
    ? planningDateWithTime(day, row.endTime)
    : new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999);

  if (/^\d{2}:\d{2}$/.test(row.endTime) && end <= start) {
    end = planningDateWithTime(addDays(day, 1), row.endTime);
  }

  return { start, end };
}

function planningDateWithTime(day, value) {
  const [hour, minute] = value.split(":").map(Number);
  return dateAt(day, hour, minute);
}

function planningTeamHTML(row) {
  const slots = planningTeamSlots(row);
  if (!slots.length) {
    return "<span class=\"planning-team-empty\">-</span>";
  }

  return `
    <div class="planning-team-list">
      ${slots.map((slot) => {
        const team = teamInfo(slot.teamID);
        const shift = shiftInfo(slot.shiftID);
        return `
          <span class="planning-team-pill ${escapeAttribute(shift.id)}">
            ${escapeHtml(team.title.replace("Equipe ", ""))}
          </span>
        `;
      }).join("")}
    </div>
  `;
}

function planningTeamSlots(row) {
  if (row.dateMode !== "date" || !/^\d{4}-\d{2}-\d{2}$/.test(row.date) || !/^\d{2}:\d{2}$/.test(row.startTime)) {
    return [];
  }

  const day = parseDateInput(row.date);
  const [hour, minute] = row.startTime.split(":").map(Number);
  const instant = dateAt(day, hour, minute);
  const slots = [
    ...planningTeamSlotsForDay(addDays(day, -1)),
    ...planningTeamSlotsForDay(day),
    ...planningTeamSlotsForDay(addDays(day, 1))
  ];

  if (isPlanningFlyOut(row) && /^\d{2}:\d{2}$/.test(row.endTime)) {
    const [endHour, endMinute] = row.endTime.split(":").map(Number);
    let endInstant = dateAt(day, endHour, endMinute);
    if (endInstant <= instant) {
      endInstant = dateAt(addDays(day, 1), endHour, endMinute);
    }
    return slots.filter((slot) => instant < slot.end && endInstant > slot.start);
  }

  return slots.filter((slot) => instant >= slot.start && instant < slot.end);
}

function planningTechnicianOptions(row) {
  const teamIDs = new Set(planningTeamSlots(row).map((slot) => slot.teamID));
  if (!teamIDs.size) {
    return [];
  }

  return state.users
    .filter((user) => ["technician", "teamLeader"].includes(user.role) && teamIDs.has(user.team))
    .sort(compareUsersByLastName)
    .map(planningTechnicianDisplayName)
    .filter(Boolean)
    .filter((name, index, names) => names.indexOf(name) === index);
}

function planningTechnicianDisplayName(user) {
  const lastName = stringValue(user.lastName).trim();
  const firstName = stringValue(user.firstName).trim();
  if (firstName && lastName) {
    return `${firstName.slice(0, 1).toLocaleUpperCase("fr")}. ${lastName}`;
  }

  return lastName || firstName || currentDisplayNameForUser(user);
}

function planningTeamSlotsForDay(day) {
  const weekend = isWeekendDay(day);
  return teamPresences(day)
    .filter((presence) => !weekend || presence.shift.id !== "evening")
    .map((presence) => {
      const interval = planningShiftInterval(day, presence.shift.id, weekend);
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

function planningShiftInterval(day, shiftID, weekend) {
  if (weekend) {
    if (shiftID === "morning") return { start: dateAt(day, 6, 0), end: dateAt(day, 18, 0) };
    if (shiftID === "night") return { start: dateAt(day, 18, 0), end: dateAt(addDays(day, 1), 6, 0) };
    return null;
  }

  if (shiftID === "morning") return { start: dateAt(day, 6, 0), end: dateAt(day, 14, 0) };
  if (shiftID === "evening") return { start: dateAt(day, 14, 0), end: dateAt(day, 22, 0) };
  if (shiftID === "night") return { start: dateAt(day, 22, 0), end: dateAt(addDays(day, 1), 6, 0) };
  return null;
}

function planningSimulatorOptions(selectedName = "") {
  const excludedKeys = new Set([normalizeKey(generalName), normalizeKey("REX Application")]);
  const options = state.allSimulators
    .filter((simulator) => {
      const key = normalizeKey(simulator.name);
      return key && !excludedKeys.has(key) && !simulator.isHidden;
    })
    .sort((first, second) => first.sortOrder - second.sortOrder || first.name.localeCompare(second.name, "fr", { sensitivity: "base" }));

  const normalizedSelected = normalizeKey(selectedName);
  if (normalizedSelected && !options.some((simulator) => normalizeKey(simulator.name) === normalizedSelected)) {
    return [{ name: selectedName, sortOrder: -1 }, ...options];
  }

  return options;
}

function normalizePlanningSimulatorName(value) {
  const name = stringValue(value).trim();
  const key = normalizeKey(name);
  return key && key !== normalizeKey(generalName) && key !== normalizeKey("REX Application") ? name : "";
}

function defaultPlanningSimulatorName() {
  return "";
}

function savePlanningRowsLocal() {
  try {
    localStorage.setItem(planningStorageKey, JSON.stringify(normalizedPlanningRows().filter((row) => !isPlanningDraftRow(row))));
    localStorage.setItem(planningFirestoreSyncStorageKey, String(Date.now()));
  } catch (error) {
    setStatus(error.message || "Planning non enregistre");
  }
}

function planningMirrorNoteID(rowID) {
  return rowID ? `regulatory-planning-${rowID}` : "";
}

function savePlanningRows(row = null, { before = null, changedFields = [], action = "updated" } = {}) {
  savePlanningRowsLocal();
  if (!row || isPlanningDraftRow(row) || !state.authReady || shouldSuspendFirestoreSync() || !canCurrentUserAccessPlanning()) {
    return;
  }

  const normalizedRow = normalizePlanningRow(row);
  const previousMirrorNoteID = normalizedRow.mirrorNoteID || planningMirrorNoteID(normalizedRow.id);
  saveRegulatoryPlanningEvent({
    event: planningFirestorePayload(normalizedRow),
    previousEvent: before ? planningFirestorePayload(normalizePlanningRow(before)) : null,
    changedFields,
    action
  }).then(async (result) => {
    state.planningActivityByRowID.delete(row.id);
    const nextMirrorNoteID = stringValue(result?.data?.mirrorNoteID);
    row.mirrorNoteID = nextMirrorNoteID;
    const localRow = state.planningRows.find((candidate) => candidate.id === row.id);
    if (localRow) {
      localRow.mirrorNoteID = nextMirrorNoteID;
    }

    if (nextMirrorNoteID) {
      await fetchNoteByID(nextMirrorNoteID);
    }
    if (previousMirrorNoteID && previousMirrorNoteID !== nextMirrorNoteID) {
      state.fetchedNotesByID.delete(previousMirrorNoteID);
      state.notes = state.notes.filter((note) => note.id !== previousMirrorNoteID);
    }

    if (typeof result?.data?.hasModifications === "boolean") {
      row.hasModifications = result.data.hasModifications;
      if (localRow) {
        localRow.hasModifications = result.data.hasModifications;
      }
    }
    savePlanningRowsLocal();
    if (state.activeView === "planning") {
      renderPlanningTable();
    } else if (state.activeView === "notes") {
      render();
    }
    state.isPlanningFirestoreLoaded = true;
    setStatus("Planning enregistre");
  }).catch((error) => {
    setStatus(error.message || "Planning non enregistre dans Firestore");
  });
}

function deletePlanningRowFromFirestore(row) {
  if (!state.authReady || shouldSuspendFirestoreSync() || !canCurrentUserEditPlanning()) {
    return;
  }

  deleteRegulatoryPlanningEvent({ id: row.id })
    .then(() => {
      const mirrorNoteID = normalizePlanningRow(row).mirrorNoteID || planningMirrorNoteID(row.id);
      if (mirrorNoteID) {
        state.fetchedNotesByID.delete(mirrorNoteID);
        state.notes = state.notes.filter((note) => note.id !== mirrorNoteID);
        if (state.activeView === "notes") {
          render();
        }
      }
      setStatus("Ligne planning supprimee");
    })
    .catch((error) => setStatus(error.message || "Suppression planning impossible"));
}

function planningFirestorePayload(row) {
  const normalizedRow = normalizePlanningRow(row);
  return {
    id: normalizedRow.id,
    simulatorName: normalizedRow.simulatorName,
    type: normalizedRow.type,
    dateMode: normalizedRow.dateMode,
    date: normalizedRow.date,
    month: normalizedRow.month,
    startTime: normalizedRow.startTime,
    endTime: normalizedRow.endTime,
    participants: normalizedRow.participants,
    tri: normalizedRow.tri,
    notes: normalizedRow.notes,
    mirrorNoteID: normalizedRow.mirrorNoteID,
    hasModifications: normalizedRow.hasModifications === true,
    sortDate: planningSortDateValue(normalizedRow),
    simulatorKey: normalizeKey(normalizedRow.simulatorName),
    typeKey: normalizeKey(normalizedRow.type),
    technicianKey: normalizeKey(normalizedRow.participants),
    triKey: normalizeKey(normalizedRow.tri)
  };
}

function planningSortDateValue(row) {
  if (row.dateMode === "month" && /^\d{4}-\d{2}$/.test(row.month)) {
    return `${row.month}-01`;
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(row.date) ? row.date : "9999-12-31";
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
  const items = [{ name: generalName, colorHex: "#111827" }, ...visibleSimulatorContexts()];
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
  state.showOnlyDeleted = false;
  state.periodStartDate = start;
  state.periodEndDate = null;
  state.isSelectingPeriodEnd = true;
  state.selectedDate = start;
  state.visibleMonth = startOfMonth(start);
  elements.selectedDate.value = isoDate(start);
  elements.searchInput.value = "";
  fetchNotesForSelectedDateIfNeeded(start);
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
  fetchNotesForSelectedDateIfNeeded(state.periodStartDate);
  fetchNotesForSelectedDateIfNeeded(end);
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
  fetchNotesForSelectedDateIfNeeded(state.selectedDate);
  renderPreservingCenteredSimulatorBand();
}

function resetDisplayState() {
  state.activeView = "notes";
  state.selectedDate = startOfDay(new Date());
  state.visibleMonth = startOfMonth(state.selectedDate);
  state.search = "";
  state.showTagged = false;
  state.showAcknowledged = false;
  state.showDeleted = false;
  state.showOnlyDeleted = false;
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
      fetchNotesForSelectedDateIfNeeded(state.selectedDate);
      renderPreservingCenteredSimulatorBand();
    });
  });
}

function groupedNotes() {
  const matchingNotes = state.notes
    .filter((note) => canCurrentUserSeeNote(note))
    .filter((note) => matchesSearch(note));

  const simulators = [{ name: generalName, colorHex: "#111827", sortOrder: -1 }, ...visibleSimulatorContexts()];
  const groups = [];

  for (const simulator of simulators) {
    const contextNotes = contextDisplayNotes(matchingNotes, simulator.name);
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
    }).sort((first, second) => compareNotesForContext(first, second, simulator.name));

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
  const priorityClass = note.priority ? `priority-${note.priority}` : "priority-info";
  const title = highlight(note.title);
  const newBadge = isNew(note);
  const carryOver = carryOverDayCount(note);
  const modificationTitle = modificationBadgeTitle(note, context, newBadge, carryOver);
  const showsModificationNew = modificationTitle === "NEW";
  const dailyDiffHTML = highlightHTML(dailyModificationDiffHTML(note, showsModificationNew));
  const done = isDoneBadgeVisibleInContext(note, context);
  const priorityColorValue = done ? "#34c759" : priorityColor(note.priority);
  const priorityStyle = note.priority ? ` style="--priority-color:${priorityColorValue};--priority-bg:${priorityBackground(note.priority)}"` : "";
  const acknowledged = !done && isAcknowledgedInContext(note, context) && !hasContentModificationAfterAcknowledgement(note, context);
  const handwriting = visibleHandwritingFor(note);
  const isTagged = isDailyTagged(note.id);
  const ageBadge = newBadge
    ? renderNewAgeBadge(note.id, isTagged, done)
    : carryOver && !state.search
      ? renderAgeBadge(
        note.id,
        carryOver,
        modificationTitle,
        isTagged,
        (note.priority === "urgent" || note.priority === "soon") && !done && carryOver > 7
      )
      : "";
  const badges = [
    note.priority && !done ? `<span class="badge priority priority-${escapeAttribute(note.priority)}">${priorityLabel(note.priority)}</span>` : ""
  ].filter(Boolean).join("");
  const doneStatusBadge = done ? renderStatusBadge("done", "Soldé") : "";
  const acknowledgementStatusBadge = acknowledged ? renderStatusBadge("ack", "Pris en compte") : "";
  const leadingBadges = ageBadge || doneStatusBadge
    ? `<div class="note-leading-badges">${ageBadge}${doneStatusBadge}</div>`
    : "";
  const metadataDate = state.search
    ? firstAssignmentDate(note)
    : isPeriodResultsMode()
      ? periodActivityDate(note, context)
      : null;
  const periodDate = metadataDate
    ? `<div class="period-note-date">${escapeHtml(formatLongDate(metadataDate))}</div>`
    : "";

  return `
    <article
      class="note-card ${priorityClass}${ageBadge ? " has-age-badge" : ""}${done ? " done-card" : ""}${note.deletedAt ? " deleted-card" : ""}${carryOver && !newBadge && !note.priority ? " carryover-card" : ""}"
      ${priorityStyle}
      data-note-id="${escapeAttribute(note.id)}"
      data-context="${escapeAttribute(encodeURIComponent(context))}"
    >
      <div class="badges">${badges}</div>
      ${leadingBadges}
      ${dailyDiffHTML
        ? `<div class="note-text revision-diff${note.title ? " has-title" : ""}">${dailyDiffHTML}</div>`
        : `${note.title ? `<h2 class="note-title">${title}</h2>` : ""}
      ${note.text ? `<div class="note-text rich-text-preview">${richTextPreviewHTML(note)}</div>` : note.title ? "" : "<p class=\"note-text muted\">Note manuscrite</p>"}`}
      ${handwriting ? renderHandwritingCardPreview(handwriting) : ""}
      ${acknowledgementStatusBadge}
      ${periodDate}
    </article>
  `;
}

function noteFromSnapshot(id, data) {
  const displayDate = startOfDay(dateValue(data.displayDate) || dateValue(data.createdAt) || new Date());
  const completions = decodeRecordArray(data.completionHistoryData);
  const completionCancellations = decodeRecordArray(data.completionCancellationHistoryData);
  const revisions = decodeRecordArray(data.revisionHistoryData);
  const reports = decodeRecordArray(data.reportHistoryData);
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
    syncState: stringValue(data.syncState),
    lastRealtimeRelevantAt: dateValue(data.lastRealtimeRelevantAt),
    realtimeActiveUntil: dateValue(data.realtimeActiveUntil),
    deletedAt: dateValue(data.deletedAt),
    deletedBy: stringValue(data.deletedBy),
    deletedByIdentifier: stringValue(data.deletedByIdentifier),
    displayDate,
    firstDisplayDate: startOfDay(dateValue(data.firstDisplayDate) || displayDate),
    isGeneral: Boolean(data.isGeneral),
    simulatorNames: destinationSimulatorNamesFromData(data),
    priority: stringValue(data.priorityRawValue),
    regulatoryPlanningMirror: data.regulatoryPlanningMirror === true,
    regulatoryPlanningEventID: stringValue(data.regulatoryPlanningEventID),
    handwritingData: stringValue(data.handwritingData),
    handwritingPreviewImageData: stringValue(data.handwritingPreviewImageData),
    handwritingClearedAt: dateValue(data.handwritingClearedAt),
    richTextData: stringValue(data.richTextData),
    richTextHTML: sanitizeRichTextHTML(stringValue(data.richTextHTML)),
    handwritingAuthorIdentifier: stringValue(data.handwritingAuthorIdentifier),
    completedContexts: stringValue(data.completedContextsStorage).split("\n").map((name) => name.trim()).filter(Boolean),
    completions,
    completionCancellations,
    revisions,
    reports,
    acknowledgements
  };
}

function openDetail(noteId, context, options = {}) {
  state.selectedCreate = null;
  state.pendingHandwritingClear = null;
  state.selectedDetail = { noteId, context };
  elements.detailOverlay.classList.toggle("over-admin", Boolean(options.overAdmin));
  refreshDetail();
}

function openCreate(context) {
  if (!canCurrentUserWrite()) {
    setStatus("Connexion requise pour créer une consigne");
    return;
  }

  state.selectedDetail = null;
  state.selectedCreate = { context };
  elements.detailOverlay.classList.remove("over-admin");
  renderCreate(context);
}

function closeDetail() {
  const hadPendingHandwritingClear = Boolean(state.pendingHandwritingClear);
  state.selectedDetail = null;
  state.selectedCreate = null;
  state.pendingHandwritingClear = null;
  elements.detailOverlay.classList.add("hidden");
  elements.detailOverlay.classList.remove("over-admin");
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

  const creationRevision = effectiveCreationRevision(note);
  openCreationTextModal(creationTextForNote(note), formatTimelineDate(creationRevision.date || note.createdAt || note.firstDisplayDate || note.displayDate));
}

function creationTextForNote(note) {
  return stringValue(effectiveCreationRevision(note).text).trim()
    || combinedNoteText(note.title, note.text);
}

function effectiveCreationRevision(note) {
  const fallback = note.revisions[0] || {
    date: note.createdAt || note.firstDisplayDate || note.displayDate,
    text: combinedNoteText(note.title, note.text),
    author: note.author,
    authorIdentifier: note.authorIdentifier || note.author
  };
  let creationRevision = fallback;

  for (const revision of note.revisions.slice(1)) {
    if (!shouldHideSameDayAuthorModification(revision, note)) {
      break;
    }

    creationRevision = revision;
  }

  return creationRevision;
}

function foldedInitialAuthorRevisionIds(note) {
  const revisionIds = new Set();

  for (const revision of note.revisions.slice(1)) {
    if (!shouldHideSameDayAuthorModification(revision, note)) {
      break;
    }

    revisionIds.add(revision.id);
  }

  return revisionIds;
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

  elements.detailTitle.textContent = "";
  elements.detailContext.textContent = "Nouvelle consigne";
  elements.detailBody.innerHTML = `
    <section class="detail-section simulator-names-section detail-top-pills-section">
      ${renderSimulatorNamePills(draftNote)}
    </section>

    <section class="detail-section priority-section">
      ${renderSectionTitle("priority", "Priorité")}
      <div class="priority-picker" role="radiogroup" aria-label="Priorité">
        ${renderPriorityOption("", "Info", true, canWrite)}
        ${renderPriorityOption("urgent", "Urgent", false, canWrite)}
        ${renderPriorityOption("whenever", "ASAP", false, canWrite)}
        <select id="detailEditPriority" ${canWrite ? "" : "disabled"} aria-hidden="true" tabindex="-1">
          <option value="" selected>Info</option>
          <option value="urgent">Urgent</option>
          <option value="whenever">ASAP</option>
        </select>
      </div>
    </section>

    <section class="detail-section date-section">
      ${renderSectionTitle("calendar", "Date de la consigne")}
      ${renderDateLine("detailEditDate", state.selectedDate, false)}
    </section>

    <section class="detail-section consigne-section">
      ${renderSectionTitle("text", "Consigne")}
      <div class="consigne-editor create-editor">
        <div class="detail-subsection">
          <h4>Titre</h4>
        </div>
        <input id="detailEditTitle" class="title-input" placeholder="Titre" ${canWrite ? "" : "disabled"}>
        <div class="detail-subsection text-editor-subsection">
          <h4>Consigne</h4>
          ${renderFormatToolbar()}
        </div>
        ${renderRichTextEditor("", "", canWrite)}
      </div>
    </section>

    <section class="detail-section simulator-section">
      ${renderSectionTitle("sliders", "Simulateur(s) concerné(s)", "(Sélection par appui long)")}
      <div class="simulator-pill-grid">
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
  const done = isDoneBadgeVisibleInContext(note, context);
  const acknowledged = !done && isAcknowledgedInContext(note, context) && !hasContentModificationAfterAcknowledgement(note, context);
  const title = note.title.trim() || "Consigne";
  const timeline = timelineEvents(note, context);
  state.detailTimelineEvents = timeline;
  const canWrite = canCurrentUserWrite();
  const canEditDate = canCurrentUserEditDate();
  const canToggleDone = canWrite;
  const canToggleAcknowledgement = canWrite && !done && !note.priority && !isNew(note);
  const canDelete = canCurrentUserDeleteNote(note);
  const canPermanentlyDelete = state.currentUser?.role === "admin" && Boolean(note.deletedAt);
  const handwriting = visibleHandwritingFor(note);

  elements.detailTitle.textContent = "";
  elements.detailContext.textContent = context;
  elements.detailBody.innerHTML = `
    <section class="detail-section simulator-names-section detail-top-pills-section">
      ${renderSimulatorNamePills(note)}
    </section>

    <section class="detail-section action-section">
      ${renderSectionTitle("actions", "Actions")}
      <div class="detail-action-row">
        <button
          class="secondary action-done${done ? " active-done" : ""}"
          data-detail-action="toggle-done"
          data-initial-state="${done ? "true" : "false"}"
          data-draft-state="${done ? "true" : "false"}"
          ${canToggleDone ? "" : "disabled"}
        >${renderIcon("check-circle", "action-icon")}${done ? "Annuler Soldé" : "SOLDER"}</button>
        <button
          class="secondary action-ack${acknowledged ? " active-ack" : ""}"
          data-detail-action="toggle-ack"
          data-initial-state="${acknowledged ? "true" : "false"}"
          data-draft-state="${acknowledged ? "true" : "false"}"
          data-can-toggle="${canToggleAcknowledgement ? "true" : "false"}"
          ${canToggleAcknowledgement ? "" : "disabled"}
        >${renderIcon("badge-check", "action-icon")}${acknowledged ? "Annuler prise en compte" : "Pris en compte"}</button>
        ${canDelete ? `
          <button class="secondary danger action-delete" data-detail-action="delete-note">
            ${renderIcon(note.deletedAt ? "undo" : "trash", "action-icon")}${note.deletedAt ? "Restaurer" : "Supprimer"}
          </button>
        ` : ""}
        ${canPermanentlyDelete ? `
          <button class="secondary danger action-permanent-delete" data-detail-action="permanent-delete-note">
            ${renderIcon("trash-x", "action-icon")}Supprimer définitivement
          </button>
        ` : ""}
      </div>
    </section>
    ${detailActionHint(note, done, canWrite, canToggleAcknowledgement)}

    <section class="detail-section priority-section">
      ${renderSectionTitle("priority", "Priorité")}
      <div class="priority-picker" role="radiogroup" aria-label="Priorité">
        ${renderPriorityOption("", "Info", !note.priority, canWrite)}
        ${renderPriorityOption("urgent", "Urgent", note.priority === "urgent", canWrite)}
        ${renderPriorityOption("whenever", "ASAP", note.priority === "whenever", canWrite)}
        <select id="detailEditPriority" ${canWrite ? "" : "disabled"} aria-hidden="true" tabindex="-1">
          <option value="" ${!note.priority ? "selected" : ""}>Info</option>
          <option value="urgent" ${note.priority === "urgent" ? "selected" : ""}>Urgent</option>
          <option value="whenever" ${note.priority === "whenever" ? "selected" : ""}>ASAP</option>
        </select>
      </div>
    </section>

    <section class="detail-section date-section">
      ${renderSectionTitle("calendar", "Date de la consigne")}
      ${renderDateLine("detailEditDate", note.displayDate, canEditDate)}
    </section>

    <section class="detail-section consigne-section">
      ${renderSectionTitle("text", "Consigne")}
      <div class="consigne-editor">
        <div class="detail-subsection">
          <h4>Titre</h4>
        </div>
        <input id="detailEditTitle" class="title-input" value="${escapeAttribute(note.title)}" placeholder="Titre" ${canWrite ? "" : "disabled"}>
        <div class="detail-subsection text-editor-subsection">
          <h4>Consigne</h4>
          ${renderFormatToolbar()}
        </div>
        ${renderRichTextEditor(note.text, note.richTextHTML, canWrite)}
        ${renderHandwritingSection(note, handwriting)}
      </div>
    </section>

    <section class="detail-section">
      ${renderSectionTitle("clock", "Suivi")}
      <div class="timeline">
        ${timeline.map((event, index) => renderTimelineEvent(event, index)).join("") || "<p class=\"detail-text muted\">Aucun suivi.</p>"}
      </div>
    </section>

    <section class="detail-section simulator-section">
      ${renderSectionTitle("sliders", "Simulateur(s) concerné(s)", "(Sélection par appui long)")}
      <div class="simulator-pill-grid">
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
  button.innerHTML = `${renderIcon("check-circle", "action-icon")}${nextState ? "Annuler Soldé" : "SOLDER"}`;

  const acknowledgementButton = elements.detailBody.querySelector('[data-detail-action="toggle-ack"]');
  if (nextState && acknowledgementButton) {
    acknowledgementButton.dataset.draftState = "false";
    acknowledgementButton.classList.remove("active-ack");
    acknowledgementButton.innerHTML = `${renderIcon("badge-check", "action-icon")}Pris en compte`;
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
  button.innerHTML = `${renderIcon("badge-check", "action-icon")}${nextState ? "Annuler prise en compte" : "Pris en compte"}`;
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
  const pills = [...elements.detailBody.querySelectorAll("[data-simulator-pill]")];
  let longPressTimer = null;

  const clearLongPress = () => {
    if (longPressTimer) {
      window.clearTimeout(longPressTimer);
      longPressTimer = null;
    }
    pills.forEach((pill) => pill.classList.remove("pressing"));
  };

  pills.forEach((pill) => {
    pill.addEventListener("click", (event) => {
      event.preventDefault();
    });

    pill.addEventListener("pointerdown", (event) => {
      if (pill.disabled) return;
      event.preventDefault();
      clearLongPress();
      pill.classList.add("pressing");
      longPressTimer = window.setTimeout(() => {
        toggleSimulatorPill(pill, pills);
        longPressTimer = null;
        pill.classList.remove("pressing");
      }, 520);
    });

    pill.addEventListener("pointerup", clearLongPress);
    pill.addEventListener("pointerleave", clearLongPress);
    pill.addEventListener("pointercancel", clearLongPress);
  });
}

function toggleSimulatorPill(pill, pills) {
  const name = decodeURIComponent(pill.dataset.simulatorName || "");
  const nextSelected = pill.dataset.selected !== "true";

  if (name === generalName) {
    pills.forEach((candidate) => setSimulatorPillSelected(candidate, candidate === pill ? true : false));
    return;
  }

  setSimulatorPillSelected(pill, nextSelected);
  const generalPill = pills.find((candidate) => decodeURIComponent(candidate.dataset.simulatorName || "") === generalName);
  if (nextSelected && generalPill) {
    setSimulatorPillSelected(generalPill, false);
  }
}

function setSimulatorPillSelected(pill, isSelected) {
  pill.dataset.selected = isSelected ? "true" : "false";
  pill.classList.toggle("selected", isSelected);
  pill.setAttribute("aria-pressed", isSelected ? "true" : "false");
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
    yellow: { background: "#ffd51f", foreground: "#111111" },
    blue: { background: "#2f80ed", foreground: "#ffffff" },
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

function renderSectionTitle(icon, title, suffix = "") {
  return `
    <h3 class="detail-section-heading">
      ${renderIcon(icon, "section-icon")}
      <span>${escapeHtml(title)}</span>
      ${suffix ? `<em>${escapeHtml(suffix)}</em>` : ""}
    </h3>
  `;
}

function renderIcon(name, className = "inline-icon") {
  const icons = {
    priority: '<path d="M10.3 3.8 2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0Z"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path>',
    calendar: '<rect x="3" y="4" width="18" height="17" rx="3"></rect><path d="M8 2v4"></path><path d="M16 2v4"></path><path d="M3 9h18"></path><path d="M8 13h2"></path><path d="M14 13h2"></path><path d="M8 17h2"></path>',
    text: '<path d="M4 7h16"></path><path d="M4 12h12"></path><path d="M4 17h9"></path>',
    clock: '<circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path>',
    sliders: '<path d="M4 6h8"></path><path d="M16 6h4"></path><circle cx="14" cy="6" r="2"></circle><path d="M4 12h3"></path><path d="M11 12h9"></path><circle cx="9" cy="12" r="2"></circle><path d="M4 18h11"></path><path d="M19 18h1"></path><circle cx="17" cy="18" r="2"></circle>',
    actions: '<path d="M4 7h16"></path><path d="M4 12h16"></path><path d="M4 17h16"></path><circle cx="8" cy="7" r="2"></circle><circle cx="16" cy="12" r="2"></circle><circle cx="11" cy="17" r="2"></circle>',
    "check-circle": '<circle cx="12" cy="12" r="9"></circle><path d="m8.5 12.5 2.2 2.2 4.8-5.1"></path>',
    "badge-check": '<path d="M9 3.8 12 2l3 1.8 3.4.4.8 3.3L21 10.5 19.2 14l-.8 3.3-3.4.4-3 1.8-3-1.8-3.4-.4L4.8 14 3 10.5l1.8-3 .8-3.3L9 3.8Z"></path><path d="m8.7 11.8 2.1 2.1 4.6-5"></path>',
    trash: '<path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="M6 6l1 15h10l1-15"></path><path d="M10 11v6"></path><path d="M14 11v6"></path>',
    "trash-x": '<path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="M6 6l1 15h10l1-15"></path><path d="m10 11 4 4"></path><path d="m14 11-4 4"></path>',
    undo: '<path d="M9 14 4 9l5-5"></path><path d="M4 9h9a7 7 0 1 1-6.1 10.4"></path>'
  };
  return `
    <svg class="${escapeAttribute(className)}" viewBox="0 0 24 24" aria-hidden="true">
      ${icons[name] || icons.text}
    </svg>
  `;
}

function simulatorNamesText(note) {
  if (note.isGeneral) {
    return generalName;
  }

  return note.simulatorNames?.length ? note.simulatorNames.join(", ") : "Aucun simulateur";
}

function simulatorNamesForPills(note) {
  if (note.isGeneral) {
    return [generalName];
  }

  return note.simulatorNames?.length ? note.simulatorNames : [];
}

function simulatorColorForName(name) {
  if (normalizeKey(name) === normalizeKey(generalName)) {
    return state.allSimulators.find((simulator) => normalizeKey(simulator.name) === normalizeKey(generalName))?.colorHex || "#111827";
  }

  return visibleSimulatorContexts().find((simulator) => normalizeKey(simulator.name) === normalizeKey(name))?.colorHex || "#6b7280";
}

function renderSimulatorNamePills(note) {
  const names = simulatorNamesForPills(note);
  if (!names.length) {
    return `<p class="detail-main-value muted">${escapeHtml(simulatorNamesText(note))}</p>`;
  }

  return `
    <div class="detail-simulator-pill-row">
      ${names.map((name) => `
        <span class="detail-simulator-pill" style="background:${escapeAttribute(simulatorColorForName(name))}">
          ${escapeHtml(name)}
        </span>
      `).join("")}
    </div>
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
  const html = note.richTextHTML ? note.richTextHTML.replace(/\n/g, "<br>") : plainTextToRichHTML(note.text);
  return highlightHTML(html);
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
    { name: generalName, label: "General" },
    ...visibleSimulatorContexts()
      .map((simulator) => ({ name: simulator.name, label: simulator.name }))
  ];

  return simulatorRows.map((simulator) => {
    const checked = simulator.name === generalName
      ? note.isGeneral
      : note.simulatorNames.includes(simulator.name);
    const color = simulatorColorForName(simulator.name);
    return `
      <button
        type="button"
        class="simulator-select-pill${checked ? " selected" : ""}"
        style="--simulator-color:${escapeAttribute(color)}"
        data-simulator-pill
        data-simulator-name="${escapeAttribute(encodeURIComponent(simulator.name))}"
        data-selected="${checked ? "true" : "false"}"
        aria-pressed="${checked ? "true" : "false"}"
        ${editable ? "" : "disabled"}
      >${escapeHtml(simulator.label)}</button>
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

function destinationSimulatorNamesFromData(data) {
  const storageNames = stringValue(data.simulatorNamesStorage)
    .replaceAll("\\n", "\n")
    .split("\n")
    .map((name) => name.trim())
    .filter(Boolean);
  const arrayNames = Array.isArray(data.simulatorNames)
    ? data.simulatorNames.map((name) => stringValue(name).trim()).filter(Boolean)
    : [];

  return uniqueStrings([...storageNames, ...arrayNames]);
}

function visibleSimulatorContexts() {
  const configuredKeys = new Set(state.allSimulators.map((simulator) => normalizeKey(simulator.name)));
  const visibleKeys = new Set();
  const visibleConfiguredSimulators = state.allSimulators
    .filter((simulator) => simulator.name !== generalName && !simulator.isHidden)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "fr"))
    .filter((simulator) => {
      const key = normalizeKey(simulator.name);
      if (!key || visibleKeys.has(key)) {
        return false;
      }

      visibleKeys.add(key);
      return true;
    });

  const missingNamesByKey = new Map();
  for (const note of state.notes.filter((candidate) => canCurrentUserSeeNote(candidate))) {
    for (const rawName of note.simulatorNames || []) {
      const name = stringValue(rawName).trim();
      const key = normalizeKey(name);
      if (
        !name
        || key === normalizeKey(generalName)
        || deletedLegacySimulatorNames.has(name)
        || configuredKeys.has(key)
        || missingNamesByKey.has(key)
      ) {
        continue;
      }

      missingNamesByKey.set(key, name);
    }
  }

  const missingSimulators = [...missingNamesByKey.values()]
    .sort((a, b) => a.localeCompare(b, "fr"))
    .map((name, index) => ({
      id: `referenced-${normalizeKey(name)}`,
      documentID: `referenced-${normalizeKey(name)}`,
      name,
      sortOrder: Number.MAX_SAFE_INTEGER - missingNamesByKey.size + index,
      colorHex: "#6b7280",
      isHidden: false,
      isReferencedOnly: true
    }));

  return [...visibleConfiguredSimulators, ...missingSimulators];
}

function userFromSnapshot(documentID, data) {
  const rawRole = stringValue(data.roleRawValue);
  const rawTeam = stringValue(data.teamRawValue);
  const migratedSupportRole = rawRole || (rawTeam === "support" ? "support" : "");
  return {
    documentID,
    id: stringValue(data.iCloudIdentifier, documentID),
    firstName: stringValue(data.firstName),
    lastName: stringValue(data.lastName),
    email: stringValue(data.email).toLowerCase(),
    accessCode: stringValue(data.accessCode),
    isAccessCodeUserDefined: Boolean(data.isAccessCodeUserDefined),
    role: migratedSupportRole,
    team: rawTeam === "support" ? "" : rawTeam,
    canViewPlanning: data.canViewPlanning === true,
    canEditPlanning: data.canEditPlanning === true,
    updatedAt: dateValue(data.updatedAt)
  };
}

function userFromAuthClaims(uid, claims) {
  return normalizedSessionUser({
    id: stringValue(claims.iCloudIdentifier, uid),
    documentID: stringValue(claims.documentID, uid),
    firstName: stringValue(claims.firstName),
    lastName: stringValue(claims.lastName),
    email: stringValue(claims.email).toLowerCase(),
    role: stringValue(claims.role, "consultation"),
    team: stringValue(claims.team),
    canViewPlanning: claims.canViewPlanning === true,
    canEditPlanning: claims.canEditPlanning === true
  });
}

function normalizedSessionUser(user) {
  return {
    id: stringValue(user?.id),
    documentID: stringValue(user?.documentID, user?.id),
    firstName: stringValue(user?.firstName),
    lastName: stringValue(user?.lastName),
    email: stringValue(user?.email).toLowerCase(),
    role: stringValue(user?.role, "consultation"),
    team: stringValue(user?.team),
    canViewPlanning: user?.canViewPlanning === true,
    canEditPlanning: user?.canEditPlanning === true
  };
}

function syncCurrentUserFromUsersList() {
  if (!state.currentUser) {
    return;
  }

  const matchedUser = currentUserRecordFromUsersList();
  if (!matchedUser) {
    return;
  }

  state.currentUser = normalizedSessionUser({
    ...state.currentUser,
    ...matchedUser
  });
  saveSession(state.currentUser);
}

function currentUserRecordFromUsersList() {
  if (!state.currentUser) {
    return null;
  }

  const currentKeys = [
    state.currentUser.id,
    state.currentUser.documentID,
    state.currentUser.email,
    currentDisplayName()
  ].map(normalizeKey).filter(Boolean);

  return state.users.find((user) => {
    const userKeys = [
      user.id,
      user.documentID,
      user.email,
      currentDisplayNameForUser(user)
    ].map(normalizeKey).filter(Boolean);
    return userKeys.some((key) => currentKeys.includes(key));
  }) || null;
}

function passwordResetRequestFromSnapshot(documentID, data) {
  const email = stringValue(data.email).toLowerCase();
  if (!email) {
    return null;
  }

  return {
    id: stringValue(data.id, documentID),
    email,
    status: stringValue(data.status, "pending"),
    matchedUserID: stringValue(data.matchedUserID),
    matchedUserDocumentID: stringValue(data.matchedUserDocumentID),
    matchedUserDisplayName: stringValue(data.matchedUserDisplayName),
    requestCount: Number(data.requestCount || 1),
    firstRequestedAt: dateValue(data.firstRequestedAt),
    lastRequestedAt: dateValue(data.lastRequestedAt),
    completedAt: dateValue(data.completedAt),
    completedBy: stringValue(data.completedBy),
    generatedCode: stringValue(data.generatedCode),
    updatedAt: dateValue(data.updatedAt)
  };
}

function maybeShowPasswordResetAdminAlert() {
  if (!isAdminSession() || state.didShowPasswordResetAdminAlert || !state.passwordResetRequests.length) {
    return;
  }

  state.didShowPasswordResetAdminAlert = true;
  window.setTimeout(() => {
    window.alert(`${state.passwordResetRequests.length} compte${state.passwordResetRequests.length > 1 ? "s" : ""} à réinitialiser.`);
  }, 100);
}

function loginEventFromSnapshot(documentID, data) {
  const createdAt = dateValue(data.createdAt);
  return {
    id: stringValue(data.id, documentID),
    userIdentifier: stringValue(data.userIdentifier),
    userDisplayName: stringValue(data.userDisplayName),
    source: stringValue(data.source),
    deviceIdentifier: stringValue(data.deviceIdentifier),
    deviceName: stringValue(data.deviceName),
    iCloudIdentifier: stringValue(data.iCloudIdentifier, data.userIdentifier),
    iosAppVersion: stringValue(data.iosAppVersion),
    dayIdentifier: stringValue(data.dayIdentifier, createdAt ? isoDate(createdAt) : ""),
    createdAt,
    lastSeenAt: dateValue(data.lastSeenAt) || createdAt,
    appearanceCount: Math.max(1, Number(data.appearanceCount) || 1)
  };
}

function firestoreReadStatFromSnapshot(documentID, data) {
  const readsByCollection = {};
  Object.entries(data.readsByCollection || {}).forEach(([collectionName, count]) => {
    readsByCollection[collectionName] = numberValue(count);
  });

  return {
    id: stringValue(data.id, documentID),
    userIdentifier: stringValue(data.userIdentifier),
    userDisplayName: stringValue(data.userDisplayName),
    source: stringValue(data.source),
    dayIdentifier: stringValue(data.dayIdentifier),
    totalReads: numberValue(data.totalReads),
    readsByCollection,
    updatedAt: dateValue(data.updatedAt) || null
  };
}

function userSyncStatusFromSnapshot(documentID, data) {
  return {
    id: stringValue(data.id, documentID),
    documentID,
    userIdentifier: stringValue(data.userIdentifier, data.id || documentID),
    displayName: stringValue(data.displayName),
    firstName: stringValue(data.firstName),
    lastName: stringValue(data.lastName),
    role: stringValue(data.role),
    team: stringValue(data.team),
    source: stringValue(data.source),
    appVersion: stringValue(data.appVersion),
    lastSeenAt: dateValue(data.lastSeenAt) || null,
    lastSuccessfulRefreshAt: dateValue(data.lastSuccessfulRefreshAt) || null,
    lastSuccessfulCatchUpAt: dateValue(data.lastSuccessfulCatchUpAt) || null,
    lastCatchUpFrom: dateValue(data.lastCatchUpFrom) || null,
    lastCatchUpChangedNotesCount: data.lastCatchUpChangedNotesCount === undefined
      ? null
      : numberValue(data.lastCatchUpChangedNotesCount),
    lastCatchUpStatus: stringValue(data.lastCatchUpStatus),
    updatedAt: dateValue(data.updatedAt) || null
  };
}

function userStatsFromSnapshot(documentID, data) {
  return {
    id: stringValue(data.id, documentID),
    userIdentifier: stringValue(data.userIdentifier, documentID),
    userDisplayName: stringValue(data.userDisplayName),
    totalWebConnections: Math.max(0, Number(data.totalWebConnections) || 0),
    totalIOSConnections: Math.max(0, Number(data.totalIOSConnections) || 0),
    latestIOSAppVersion: stringValue(data.latestIOSAppVersion),
    lastSeenAt: dateValue(data.lastSeenAt) || dateValue(data.updatedAt) || null,
    updatedAt: dateValue(data.updatedAt) || null
  };
}

function adminMessageFromSnapshot(documentID, data) {
  const text = stringValue(data.text).trim();
  if (!text) {
    return null;
  }

  return {
    id: stringValue(data.id, documentID),
    text,
    recipientUserIDs: Array.isArray(data.recipientUserIDs) ? data.recipientUserIDs.map(stringValue).filter(Boolean) : [],
    recipientDisplayNames: Array.isArray(data.recipientDisplayNames) ? data.recipientDisplayNames.map(stringValue).filter(Boolean) : [],
    sendsToAll: Boolean(data.sendsToAll),
    authorIdentifier: stringValue(data.authorIdentifier),
    createdAt: dateValue(data.createdAt) || new Date()
  };
}

function activityEventFromSnapshot(documentID, data) {
  if (data.hidden === true) {
    return null;
  }

  const action = stringValue(data.action, "modified");
  const noteID = stringValue(data.noteID);
  const planningEventID = stringValue(data.planningEventID);
  if (!noteID && !planningEventID) {
    return null;
  }

  return {
    id: stringValue(data.id, documentID),
    userIdentifier: stringValue(data.userIdentifier),
    userDisplayName: stringValue(data.userDisplayName),
    action,
    actionTitle: stringValue(data.actionTitle, activityActionTitles[action] || action),
    noteID,
    planningEventID,
    noteTitle: stringValue(data.noteTitle),
    activityDetails: stringValue(data.activityDetails),
    simulatorNames: Array.isArray(data.simulatorNames)
      ? data.simulatorNames.map((name) => stringValue(name)).filter(Boolean)
      : [],
    context: stringValue(data.context),
    createdAt: dateValue(data.createdAt) || new Date(0)
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
  elements.adminBody.scrollTop = 0;
  renderAdminSettings({ resetScroll: true, force: true });
}

function closeAdminSettings() {
  state.activeAdminTab = "home";
  stopInactiveAdminTabListeners();
  elements.adminOverlay.classList.add("hidden");
  elements.adminOverlay.setAttribute("aria-hidden", "true");
}

function renderAdminSettings(options = {}) {
  if (elements.adminOverlay.classList.contains("hidden")) {
    return;
  }

  stopInactiveAdminTabListeners();
  startActiveAdminTabListener();

  if (!options.force && isAdminDateInteractionActive()) {
    return;
  }

  const previousTab = elements.adminBody.dataset.activeAdminTab || "";
  const previousScrollTop = elements.adminBody.scrollTop;

  try {
    const title = state.activeAdminTab === "users"
      ? "Droits"
      : state.activeAdminTab === "simulators"
        ? "Simulateurs"
        : state.activeAdminTab === "connections"
          ? "Connexions"
          : state.activeAdminTab === "activity"
            ? (state.adminActivitySubTab === "sync" ? "Synchro utilisateurs" : "Suivi d'activité")
            : state.activeAdminTab === "appVersion"
              ? "Version iPad"
              : state.activeAdminTab === "maintenance"
                ? "Maintenance des données"
                : state.activeAdminTab === "messages"
                  ? "Messages"
                  : state.activeAdminTab === "passwordResets"
                    ? "Mots de passe oubliés"
                  : "Administration";
    elements.adminOverlay.querySelector("#adminTitle").textContent = title;

    if (state.activeAdminTab === "users") {
      elements.adminBody.innerHTML = renderAdminUsers();
    } else if (state.activeAdminTab === "simulators") {
      elements.adminBody.innerHTML = renderAdminSimulators();
    } else if (state.activeAdminTab === "connections") {
      elements.adminBody.innerHTML = renderAdminConnections();
    } else if (state.activeAdminTab === "activity") {
      elements.adminBody.innerHTML = renderAdminActivity();
    } else if (state.activeAdminTab === "appVersion") {
      elements.adminBody.innerHTML = renderAdminAppVersion();
    } else if (state.activeAdminTab === "maintenance") {
      elements.adminBody.innerHTML = renderAdminMaintenance();
    } else if (state.activeAdminTab === "messages") {
      elements.adminBody.innerHTML = renderAdminMessages();
    } else if (state.activeAdminTab === "passwordResets") {
      elements.adminBody.innerHTML = renderAdminPasswordResets();
    } else {
      elements.adminBody.innerHTML = renderAdminHome();
    }

    elements.adminBody.dataset.activeAdminTab = state.activeAdminTab;
    if (options.resetScroll || state.activeAdminTab !== previousTab) {
      elements.adminBody.scrollTop = 0;
    } else {
      elements.adminBody.scrollTop = previousScrollTop;
    }
  } catch (error) {
    console.error("Admin rendering failed", error);
    elements.adminBody.scrollTop = 0;
    elements.adminBody.innerHTML = `
      <article class="admin-card">
        <div class="admin-card-title">
          <strong>Administration indisponible</strong>
        </div>
        <p class="admin-help-text">Le menu admin n'a pas pu se charger. Recharge la page puis ouvre a nouveau l'administration.</p>
      </article>
    `;
  }
}

function refreshAdminConnectionsPresence() {
  if (state.activeAdminTab !== "connections" || elements.adminOverlay.classList.contains("hidden")) {
    return;
  }

  renderAdminSettings();
}

function refreshActiveAdminMessage() {
  if (isAdminSession()) {
    state.activeAdminMessage = null;
    renderAdminMessageOverlay();
    return;
  }

  const visibleMessages = uniqueAdminMessages([...state.adminMessagesAll, ...state.adminMessagesTargeted])
    .filter((message) => !state.adminMessageDismissals.has(message.id))
    .filter((message) => !state.acknowledgedAdminMessageIDs.has(message.id))
    .sort((first, second) => (first.createdAt?.getTime() || 0) - (second.createdAt?.getTime() || 0));

  if (state.activeAdminMessage && visibleMessages.some((message) => message.id === state.activeAdminMessage.id)) {
    renderAdminMessageOverlay();
    return;
  }

  state.activeAdminMessage = visibleMessages[0] || null;
  renderAdminMessageOverlay();
}

function uniqueAdminMessages(messages) {
  const byID = new Map();
  messages.forEach((message) => {
    if (message?.id && !byID.has(message.id)) {
      byID.set(message.id, message);
    }
  });
  return [...byID.values()];
}

function renderAdminMessageOverlay() {
  const message = state.activeAdminMessage;
  elements.adminMessageOverlay.classList.toggle("hidden", !message);
  elements.adminMessageOverlay.setAttribute("aria-hidden", message ? "false" : "true");
  elements.adminMessageText.textContent = message?.text || "";
}

function acknowledgeActiveAdminMessage() {
  const message = state.activeAdminMessage;
  if (!message) {
    return;
  }

  state.acknowledgedAdminMessageIDs.add(message.id);
  state.activeAdminMessage = null;
  refreshActiveAdminMessage();
}

async function deleteActiveAdminMessage() {
  const message = state.activeAdminMessage;
  const userIdentifier = stringValue(state.currentUser?.id).trim();
  if (!message || !userIdentifier) {
    return;
  }

  state.adminMessageDismissals.add(message.id);
  state.activeAdminMessage = null;
  renderAdminMessageOverlay();
  await setDoc(doc(db, "adminMessageDismissals", adminMessageDismissalID(message.id, userIdentifier)), {
    id: adminMessageDismissalID(message.id, userIdentifier),
    messageID: message.id,
    userIdentifier,
    dismissedAt: new Date()
  }, { merge: true }).catch((error) => setStatus(error.message));
  refreshActiveAdminMessage();
}

function adminMessageDismissalID(messageID, userIdentifier) {
  return `${firestoreDocumentID(messageID)}_${firestoreDocumentID(userIdentifier)}`;
}

function isAdminDateInteractionActive() {
  if (state.activeAdminTab === "connections") {
    return state.adminLoginDateInteracting
      || document.activeElement?.matches?.("[data-admin-login-date]");
  }

  if (state.activeAdminTab === "activity") {
    return state.adminActivityDateInteracting
      || document.activeElement?.matches?.("[data-admin-activity-date]");
  }

  return false;
}

function renderAdminHome() {
  const requiredIOSAppVersion = stringValue(state.appSettings?.requiredIOSAppVersion);
  const pendingResetCount = state.passwordResetRequests.length;
  return `
    <div class="admin-menu-list">
      <button class="admin-menu-row" type="button" data-admin-action="open-admin-users">
        <span class="admin-menu-icon">⚿</span>
        <span>
          <strong>Droits et utilisateurs</strong>
          <small>${state.users.length} compte${state.users.length > 1 ? "s" : ""} utilisateur</small>
        </span>
      </button>
      <button class="admin-menu-row" type="button" data-admin-action="open-admin-password-resets">
        <span class="admin-menu-icon">⌁</span>
        <span>
          <strong>Mots de passe oubliés</strong>
          <small>${pendingResetCount ? `${pendingResetCount} demande${pendingResetCount > 1 ? "s" : ""} en attente` : "Aucune demande en attente"}</small>
        </span>
        ${pendingResetCount ? `<span class="admin-menu-badge">${pendingResetCount}</span>` : ""}
      </button>
      <button class="admin-menu-row" type="button" data-admin-action="open-admin-simulators">
        <span class="admin-menu-icon">▦</span>
        <span>
          <strong>Simulateurs</strong>
          <small>Noms, ordre, couleurs et visibilité</small>
        </span>
      </button>
      <button class="admin-menu-row" type="button" data-admin-action="open-admin-connections">
        <span class="admin-menu-icon">▥</span>
        <span>
          <strong>Connexions</strong>
          <small>Ouvertures par jour, iOS et Web</small>
        </span>
      </button>
      <button class="admin-menu-row" type="button" data-admin-action="open-admin-activity">
        <span class="admin-menu-icon">☷</span>
        <span>
          <strong>Suivi d'activité</strong>
          <small>Actions utilisateur et lien direct consigne</small>
        </span>
      </button>
      <button class="admin-menu-row" type="button" data-admin-action="open-admin-user-sync">
        <span class="admin-menu-icon">◷</span>
        <span>
          <strong>Synchro utilisateurs</strong>
          <small>Dernier état connu, classé par prénom</small>
        </span>
      </button>
      <button class="admin-menu-row" type="button" data-admin-action="open-admin-app-version">
        <span class="admin-menu-icon">▣</span>
        <span>
          <strong>Version iPad requise</strong>
          <small>${requiredIOSAppVersion ? `Version attendue ${escapeHtml(requiredIOSAppVersion)}` : "Aucun contrôle activé"}</small>
        </span>
      </button>
      <button class="admin-menu-row" type="button" data-admin-action="open-admin-maintenance">
        <span class="admin-menu-icon">◎</span>
        <span>
          <strong>Maintenance des données</strong>
          <small>Contrôles Firestore et index de synchronisation</small>
        </span>
      </button>
      <button class="admin-menu-row" type="button" data-admin-action="open-admin-messages">
        <span class="admin-menu-icon">✉</span>
        <span>
          <strong>Messages utilisateurs</strong>
          <small>Envoyer une information a un ou plusieurs comptes</small>
        </span>
      </button>
    </div>
  `;
}

function renderAdminMaintenance() {
  const audit = state.adminMaintenanceAudit;
  const anomalies = audit?.anomalies || [];
  const status = state.adminMaintenanceStatus
    || (audit ? (anomalies.length ? `${anomalies.length} anomalie${anomalies.length > 1 ? "s" : ""} détectée${anomalies.length > 1 ? "s" : ""}.` : "Aucune anomalie détectée.") : "Lancer un scan Firestore pour contrôler les index.");

  return `
    <div class="admin-back-row">
      <button class="secondary" type="button" data-admin-action="admin-home">‹ Administration</button>
    </div>
    <div class="admin-section-heading">
      <h3>Maintenance des données</h3>
      <p>Contrôle les champs utilisés pour limiter les lectures Firestore.</p>
    </div>
    <article class="admin-card">
      <div class="admin-card-title">
        <strong>Index de synchronisation</strong>
        <span>${audit ? `${audit.totalCount} consigne${audit.totalCount > 1 ? "s" : ""}` : "Non scanné"}</span>
      </div>
      <p class="admin-help-text">${escapeHtml(status)}</p>
      <div class="admin-actions">
        <button type="button" data-admin-action="scan-admin-maintenance" ${state.isAdminMaintenanceScanning || state.isAdminMaintenanceRepairing ? "disabled" : ""}>
          ${state.isAdminMaintenanceScanning ? "Scan en cours..." : "Scanner Firestore"}
        </button>
        ${anomalies.length ? `
          <button type="button" data-admin-action="repair-admin-syncstate" ${state.isAdminMaintenanceScanning || state.isAdminMaintenanceRepairing ? "disabled" : ""}>
            ${state.isAdminMaintenanceRepairing ? "Correction..." : "Corriger les anomalies"}
          </button>
        ` : ""}
      </div>
    </article>
    ${audit ? renderAdminMaintenanceStats(audit) : ""}
    ${anomalies.length ? renderAdminMaintenanceAnomalies(anomalies) : ""}
  `;
}

function renderAdminMaintenanceStats(audit) {
  return `
    <div class="admin-section-heading">
      <h3>Résultat</h3>
    </div>
    <article class="admin-card">
      <div class="admin-form-grid">
        <label>Consignes totales<input readonly value="${audit.totalCount}"></label>
        <label>Avec syncState<input readonly value="${audit.withSyncStateCount}"></label>
        <label>Sans syncState<input readonly value="${audit.missingSyncStateCount}"></label>
        <label>Actives<input readonly value="${audit.activeCount}"></label>
        <label>Soldées<input readonly value="${audit.archivedCount}"></label>
        <label>Supprimées<input readonly value="${audit.deletedCount}"></label>
        <label>Anomalies<input readonly value="${audit.anomalies.length}"></label>
        ${audit.otherSyncStateCount ? `<label>syncState inconnu<input readonly value="${audit.otherSyncStateCount}"></label>` : ""}
      </div>
    </article>
  `;
}

function renderAdminMaintenanceAnomalies(anomalies) {
  return `
    <div class="admin-section-heading">
      <h3>Consignes concernées</h3>
    </div>
    <div class="admin-list">
      ${anomalies.map((anomaly) => `
        <article class="admin-card">
          <div class="admin-card-title">
            <strong>${escapeHtml(anomaly.title || "(Sans titre)")}</strong>
            <span>${escapeHtml(anomaly.expectedSyncState)}</span>
          </div>
          <p class="admin-help-text">${escapeHtml(anomaly.simulatorText)}</p>
          <div class="admin-activity-meta">
            <span>Actuel : ${escapeHtml(anomaly.currentSyncState || "manquant")}</span>
            <span>Attendu : ${escapeHtml(anomaly.expectedSyncState)}</span>
          </div>
          <p class="admin-help-text">${escapeHtml(anomaly.reason)}</p>
        </article>
      `).join("")}
    </div>
  `;
}

function renderAdminAppVersion() {
  return `
    <div class="admin-back-row">
      <button class="secondary" type="button" data-admin-action="admin-home">‹ Administration</button>
    </div>
    <div class="admin-section-heading">
      <h3>Version iPad requise</h3>
    </div>
    <article class="admin-card">
      <div class="admin-form-grid">
        <label>Version attendue
          <input data-app-version-field value="${escapeAttribute(state.appSettings.requiredIOSAppVersion || "")}" placeholder="Exemple : 1.80" inputmode="decimal">
        </label>
        <label>Version web actuelle
          <input value="${escapeAttribute(WEB_APP_VERSION)}" disabled>
        </label>
      </div>
      <p class="admin-help-text">Si la version installee sur un iPad est differente de cette valeur, une fenetre apparait au lancement de l'app iPad. Laisser vide desactive le controle.</p>
      <div class="admin-actions">
        <button type="button" data-admin-action="save-app-version">Enregistrer</button>
      </div>
    </article>
  `;
}

function renderAdminMessages() {
  const users = state.users.filter((user) => {
    return !isAdminIdentifier(user.id) && !isAdminIdentifier(currentDisplayNameForUser(user));
  });
  const sendsToAll = state.adminMessageSendsToAll;
  return `
    ${renderAdminBackButton()}
    <div class="admin-section-heading">
      <h3>Nouveau message</h3>
      <p>Le bouton OK masque le message pour la session. Supprimer le masque definitivement pour l'utilisateur.</p>
    </div>
    <article class="admin-card admin-message-composer">
      <label>Message
        <textarea data-admin-message-text placeholder="Texte du message">${escapeHtml(state.adminMessageText)}</textarea>
      </label>
      <label class="simulator-toggle-row">
        <span>Envoyer a tous les utilisateurs</span>
        <input type="checkbox" data-admin-message-all ${sendsToAll ? "checked" : ""}>
        <span class="ios-switch" aria-hidden="true"></span>
      </label>
      <div data-admin-message-recipients class="admin-message-recipient-list ${sendsToAll ? "hidden" : ""}">
        ${users.map((user) => `
          <label class="admin-message-recipient">
            <span>
              <strong>${escapeHtml(currentDisplayNameForUser(user))}</strong>
              <small>${escapeHtml(userRoleLabel(user.role, user.team))}</small>
            </span>
            <input type="checkbox" value="${escapeAttribute(user.id)}" data-admin-message-recipient ${state.adminMessageRecipientIDs.has(user.id) ? "checked" : ""}>
            <span class="ios-switch" aria-hidden="true"></span>
          </label>
        `).join("") || "<p class=\"muted\">Aucun utilisateur.</p>"}
      </div>
      <div class="admin-actions">
        <button type="button" data-admin-action="send-admin-message">Envoyer</button>
      </div>
    </article>
  `;
}

function renderAdminPasswordResets() {
  const requests = state.passwordResetRequests;
  return `
    ${renderAdminBackButton()}
    <div class="admin-section-heading">
      <h3>Demandes en attente</h3>
      <p>Réinitialise le code utilisateur, puis communique le nouveau code à la personne.</p>
    </div>
    <div class="admin-list">
      ${requests.map(renderAdminPasswordResetRequest).join("") || "<p class=\"muted\">Aucune demande en attente.</p>"}
    </div>
  `;
}

function renderAdminPasswordResetRequest(request) {
  const matchedUser = matchedPasswordResetUser(request);
  const displayName = matchedUser
    ? currentDisplayNameForUser(matchedUser)
    : request.matchedUserDisplayName || "Compte non relié";
  const userMeta = matchedUser
    ? `${userRoleLabel(matchedUser.role, matchedUser.team)} · ${matchedUser.id}`
    : "Ajoute l'email sur la fiche utilisateur pour relier automatiquement ce compte.";
  return `
    <article class="admin-card" data-reset-request-id="${escapeAttribute(request.id)}">
      <div class="admin-card-title">
        <strong>${escapeHtml(displayName)}</strong>
        <span class="admin-reset-status">En attente</span>
      </div>
      <div class="admin-activity-meta">
        <span>Mail : ${escapeHtml(request.email)}</span>
        <span>${escapeHtml(userMeta)}</span>
        <span>${escapeHtml(formatDateTime(request.lastRequestedAt))}</span>
        ${request.requestCount > 1 ? `<span>${request.requestCount} demandes</span>` : ""}
      </div>
      <div class="admin-actions">
        <button type="button" class="secondary" data-admin-action="complete-password-reset-request">Clôturer</button>
        <button type="button" data-admin-action="reset-password-request-code" ${matchedUser ? "" : "disabled"}>Réinitialiser code</button>
      </div>
    </article>
  `;
}

function matchedPasswordResetUser(request) {
  const documentKey = normalizeKey(request.matchedUserDocumentID);
  const userKey = normalizeKey(request.matchedUserID);
  const emailKey = normalizeKey(request.email);
  return state.users.find((user) => {
    return (documentKey && normalizeKey(user.documentID) === documentKey)
      || (userKey && normalizeKey(user.id) === userKey)
      || (emailKey && normalizeKey(user.email) === emailKey);
  }) || null;
}

function resetAdminMessageComposer() {
  state.adminMessageText = "";
  state.adminMessageSendsToAll = false;
  state.adminMessageRecipientIDs.clear();
}

function renderAdminBackButton() {
  return `
    <div class="admin-back-row">
      <button class="secondary" type="button" data-admin-action="admin-home">‹ Administration</button>
    </div>
  `;
}

function renderAdminUsers() {
  const visibleUsers = adminFilteredUsers();
  return `
    ${renderAdminBackButton()}
    <div class="admin-section-heading">
      <h3>Ajouter un utilisateur</h3>
    </div>
    <div class="admin-card admin-create-user-card">
      <div class="admin-form-grid create-user-grid">
        <label>Prénom<input id="newUserFirstName" autocomplete="off" placeholder="Prénom"></label>
        <label>Nom<input id="newUserLastName" autocomplete="off" placeholder="Nom"></label>
        <label>Email<input id="newUserEmail" type="email" autocomplete="off" placeholder="prenom.nom@example.com"></label>
        <label>Code à 6 chiffres<input id="newUserAccessCode" maxlength="6" inputmode="numeric" autocomplete="off" placeholder="Code"></label>
        <label>Rôle
          <select id="newUserRole">
            <option value="">Consultation</option>
            <option value="technician">Technicien</option>
            <option value="teamLeader">Chef d'équipe</option>
            <option value="support">Support</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <label>Équipe
          <select id="newUserTeam">
            <option value="">Aucune</option>
            <option value="team1">Equipe 1</option>
            <option value="team2">Equipe 2</option>
            <option value="team3">Equipe 3</option>
            <option value="team4">Equipe 4</option>
            <option value="team5">Equipe 5</option>
          </select>
        </label>
        <label class="admin-checkbox-field">
          <span>Planning réglementaire</span>
          <input id="newUserCanViewPlanning" type="checkbox">
        </label>
        <label class="admin-checkbox-field">
          <span>Modifier planning réglementaire</span>
          <input id="newUserCanEditPlanning" type="checkbox">
        </label>
      </div>
      <div class="admin-actions create-user-actions">
        <button type="button" data-admin-action="create-user">Ajouter l'utilisateur</button>
      </div>
    </div>
    <div class="admin-section-heading">
      <h3>Droits des utilisateurs</h3>
      <p>Nom, rôle, équipe et réinitialisation des codes utilisateur.</p>
    </div>
    <div class="admin-card">
      <div class="admin-form-grid">
        <label>Rechercher
          <input data-admin-user-search value="${escapeAttribute(state.adminUserSearch)}" autocomplete="off" placeholder="Nom ou prénom">
        </label>
      </div>
    </div>
    <div class="admin-list">
      ${state.users.map(renderAdminUserCard).join("") || "<p class=\"muted\">Aucun utilisateur.</p>"}
      ${state.users.length ? `<p class="muted" data-admin-user-empty ${visibleUsers.length ? "hidden" : ""}>Aucun utilisateur trouvé.</p>` : ""}
    </div>
  `;
}

function renderAdminUserCard(user) {
  const codeValue = shouldMaskAdminAccessCode(user) ? "••••••" : user.accessCode;
  const codeInputType = shouldMaskAdminAccessCode(user) ? "password" : "text";
  const statsSummary = userStatsSummaryForUser(user);
  const version = statsSummary.latestIOSAppVersion;
  const totalConnections = statsSummary.totalConnections;
  const requiredVersion = stringValue(state.appSettings?.requiredIOSAppVersion).trim();
  const versionOK = Boolean(version) && (!requiredVersion || version === requiredVersion);
  const versionTitle = requiredVersion
    ? `Version demandée : ${requiredVersion}`
    : "Aucune version demandée";
  const isHiddenBySearch = !adminUserMatchesSearch(user);
  const isAdminUser = user.role === "admin";
  const canViewPlanning = isAdminUser || user.canViewPlanning === true;
  const canEditPlanning = isAdminUser || user.canEditPlanning === true;
  return `
    <article
      class="admin-card"
      data-user-id="${escapeAttribute(user.documentID)}"
      data-admin-user-card
      data-admin-user-search="${escapeAttribute(adminUserSearchText(user))}"
      ${isHiddenBySearch ? "hidden" : ""}
    >
      <div class="admin-card-title">
        <strong>${escapeHtml(currentDisplayNameForUser(user))}</strong>
        <span class="admin-user-version ${versionOK ? "is-ok" : "is-ko"}" title="${escapeAttribute(versionTitle)}">
          ${escapeHtml(version || "Non détectée")}
        </span>
        <span class="admin-user-connections" title="Connexions totales Web + iPad">
          ${totalConnections}
        </span>
        <span>${escapeHtml(user.id)}</span>
      </div>
      <div class="admin-form-grid">
        <label>Prénom<input data-field="firstName" value="${escapeAttribute(user.firstName)}"></label>
        <label>Nom<input data-field="lastName" value="${escapeAttribute(user.lastName)}"></label>
        <label>Email<input data-field="email" type="email" value="${escapeAttribute(user.email || "")}"></label>
        <label>Code<input data-field="accessCode" type="${codeInputType}" value="${escapeAttribute(codeValue)}" maxlength="6" inputmode="numeric" autocomplete="off"></label>
        <label>Rôle
          <select data-field="role">
            <option value="" ${!user.role ? "selected" : ""}>Consultation</option>
            <option value="technician" ${user.role === "technician" ? "selected" : ""}>Technicien</option>
            <option value="teamLeader" ${user.role === "teamLeader" ? "selected" : ""}>Chef d'équipe</option>
            <option value="support" ${user.role === "support" ? "selected" : ""}>Support</option>
            <option value="admin" ${user.role === "admin" ? "selected" : ""}>Admin</option>
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
          </select>
        </label>
        <label class="admin-checkbox-field">
          <span>Planning réglementaire</span>
          <input data-field="canViewPlanning" type="checkbox" ${canViewPlanning ? "checked" : ""} ${isAdminUser ? "disabled" : ""}>
        </label>
        <label class="admin-checkbox-field">
          <span>Modifier planning réglementaire</span>
          <input data-field="canEditPlanning" type="checkbox" ${canEditPlanning ? "checked" : ""} ${isAdminUser ? "disabled" : ""}>
        </label>
      </div>
      <div class="admin-actions">
        <button type="button" class="danger-text" data-admin-action="delete-user" ${isLastAdminUser(user) ? "disabled" : ""}>Supprimer le compte</button>
        <button type="button" class="secondary" data-admin-action="reset-user-code">Réinitialiser code</button>
        <button type="button" data-admin-action="save-user">Enregistrer</button>
      </div>
    </article>
  `;
}

function adminFilteredUsers() {
  return state.users.filter(adminUserMatchesSearch);
}

function adminUserMatchesSearch(user) {
  const query = normalizeKey(state.adminUserSearch);
  return !query || normalizeKey(adminUserSearchText(user)).includes(query);
}

function adminUserSearchText(user) {
  return [
    user.firstName,
    user.lastName,
    user.email,
    `${user.firstName} ${user.lastName}`,
    `${user.lastName} ${user.firstName}`
  ].filter(Boolean).join(" ");
}

function applyAdminUserSearchFilter() {
  const query = normalizeKey(state.adminUserSearch);
  let visibleCount = 0;
  elements.adminBody.querySelectorAll("[data-admin-user-card]").forEach((card) => {
    const isVisible = !query || normalizeKey(card.dataset.adminUserSearch).includes(query);
    card.hidden = !isVisible;
    if (isVisible) {
      visibleCount += 1;
    }
  });

  const emptyMessage = elements.adminBody.querySelector("[data-admin-user-empty]");
  if (emptyMessage) {
    emptyMessage.hidden = visibleCount > 0 || !state.users.length;
  }
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

function renderAdminConnections() {
  const rows = loginStatsRows();
  const groups = loginStatsGroups(rows);
  const totalCount = rows.reduce((sum, row) => sum + row.totalCount, 0);
  const totalReads = groups.reduce((sum, group) => sum + group.readCount, 0);
  return `
    ${renderAdminBackButton()}
    <div class="admin-section-heading">
      <h3>Jour</h3>
      <p>Connexions enregistrées par utilisateur.</p>
    </div>
    <div class="admin-card">
      <div class="admin-form-grid admin-login-date-grid">
        <div class="admin-login-date-control">
          <button class="secondary icon-button" type="button" data-admin-action="admin-login-previous-day" title="Jour précédent">‹</button>
          <label>Date<input type="date" data-admin-login-date value="${escapeAttribute(isoDate(state.adminLoginDate))}"></label>
        </div>
        <label>Total<input value="${totalCount} connexion${totalCount > 1 ? "s" : ""}" readonly></label>
        <label>Lectures<input value="${formatCompactNumber(totalReads)} lecture${totalReads > 1 ? "s" : ""}" readonly></label>
      </div>
    </div>
    <div class="admin-section-heading">
      <h3>Utilisateurs</h3>
    </div>
    <div class="admin-list">
      ${groups.map(renderAdminConnectionGroup).join("") || "<p class=\"muted\">Aucun utilisateur.</p>"}
    </div>
  `;
}

function renderAdminConnectionGroup(group) {
  return `
    <article class="admin-card admin-connection-card">
      <div class="admin-card-title">
        <strong>
          ${escapeHtml(group.displayName)}
          ${group.hasCurrentSession ? `<span class="admin-current-pill">En cours</span>` : ""}
        </strong>
        <span class="admin-connection-total">${group.totalCount}</span>
      </div>
      <div class="admin-connection-session ${group.hasCurrentSession ? "is-current" : ""}">
      <div class="admin-connection-metrics">
        <span>▯ ${group.ipadCount} iOS</span>
        ${group.latestIOSAppVersion ? `<span>⇩ iOS v${escapeHtml(group.latestIOSAppVersion)}</span>` : ""}
        <span>◎ ${group.webCount} Web</span>
        <span title="${escapeAttribute(readStatsTitle(group))}">◫ ${formatCompactNumber(group.readCount)} lectures</span>
        <span>□ ${group.createdCount} créées</span>
        <span>⌁ ${group.modifiedCount} modifiées</span>
        <strong>${escapeHtml(formatConnectionTime(group.lastSeenAt))}</strong>
      </div>
      </div>
    </article>
  `;
}

function renderAdminActivity() {
  if (state.adminActivitySubTab === "sync") {
    return renderAdminUserSyncStatuses();
  }

  const events = filteredActivityEvents();
  return `
    ${renderAdminBackButton()}
    ${renderAdminActivitySubTabs()}
    <div class="admin-section-heading">
      <h3>Jour</h3>
      <p>Actions enregistrées sur les consignes et le planning réglementaire.</p>
    </div>
    <div class="admin-card">
      <div class="admin-form-grid admin-activity-date-grid">
        <div class="admin-login-date-control">
          <button class="secondary icon-button" type="button" data-admin-action="admin-activity-previous-day" title="Jour précédent">‹</button>
          <label>Date<input type="date" data-admin-activity-date value="${escapeAttribute(isoDate(state.adminActivityDate))}"></label>
        </div>
        <label>Total<input value="${events.length} action${events.length > 1 ? "s" : ""}" readonly></label>
      </div>
    </div>
    <div class="admin-card admin-activity-filter">
      <label>Rechercher<input data-admin-activity-search value="${escapeAttribute(state.adminActivitySearch)}" placeholder="Utilisateur, action, simulateur, consigne ou planning"></label>
    </div>
    <div class="admin-section-heading">
      <h3>Actions</h3>
    </div>
    <div class="admin-list">
      ${events.map(renderAdminActivityEvent).join("") || "<p class=\"muted\">Aucune action.</p>"}
    </div>
  `;
}

function renderAdminActivitySubTabs() {
  return `
    <div class="admin-subtabs">
      <button
        class="admin-subtab ${state.adminActivitySubTab === "activity" ? "active" : ""}"
        type="button"
        data-admin-action="admin-activity-tab"
        data-admin-activity-tab="activity"
      >Activité</button>
      <button
        class="admin-subtab ${state.adminActivitySubTab === "sync" ? "active" : ""}"
        type="button"
        data-admin-action="admin-activity-tab"
        data-admin-activity-tab="sync"
      >Synchro utilisateurs</button>
    </div>
  `;
}

function renderAdminUserSyncStatuses() {
  const rows = adminUserSyncStatusRows();
  return `
    ${renderAdminBackButton()}
    ${renderAdminActivitySubTabs()}
    <div class="admin-section-heading">
      <h3>Synchro utilisateurs</h3>
      <p>Dernier état connu de synchronisation, classé par prénom.</p>
    </div>
    <div class="admin-card admin-sync-card">
      <div class="admin-sync-table">
        <div class="admin-sync-row admin-sync-header">
          <span>Utilisateur</span>
          <span>Source</span>
          <span>Version</span>
          <span>Ouverture</span>
          <span>Synchro</span>
          <span>Rattrapage</span>
          <span>Notes</span>
          <span>État</span>
        </div>
        ${rows.map(renderAdminUserSyncStatusRow).join("") || "<p class=\"muted\">Aucun utilisateur.</p>"}
      </div>
    </div>
  `;
}

function renderAdminUserSyncStatusRow(row) {
  const level = syncStatusLevel(row);
  const statusLabel = syncStatusLabel(row, level);
  return `
    <div class="admin-sync-row">
      <strong>${escapeHtml(row.displayName)}</strong>
      <span>${escapeHtml(sourceDisplayName(row.status?.source))}</span>
      <span>${escapeHtml(row.status?.appVersion || "-")}</span>
      <span>${escapeHtml(formatSyncDate(row.status?.lastSeenAt))}</span>
      <span>${escapeHtml(formatSyncDate(row.status?.lastSuccessfulRefreshAt))}</span>
      <span>${escapeHtml(formatSyncDate(row.status?.lastSuccessfulCatchUpAt))}</span>
      <span>${row.status?.lastCatchUpChangedNotesCount ?? "-"}</span>
      <span class="admin-sync-pill ${level}">${escapeHtml(statusLabel)}</span>
    </div>
  `;
}

function adminUserSyncStatusRows() {
  const statusesByKey = new Map();
  state.userSyncStatuses.forEach((status) => {
    [status.userIdentifier, status.id, status.documentID, status.displayName]
      .map(normalizeKey)
      .filter(Boolean)
      .forEach((key) => statusesByKey.set(key, status));
  });

  const consumedStatusIDs = new Set();
  const rows = state.users.map((user) => {
    const possibleKeys = [user.id, user.documentID, currentDisplayNameForUser(user)].map(normalizeKey).filter(Boolean);
    const status = possibleKeys.map((key) => statusesByKey.get(key)).find(Boolean) || null;
    if (status) {
      consumedStatusIDs.add(status.id || status.documentID || status.userIdentifier);
    }
    return {
      user,
      status,
      displayName: currentDisplayNameForUser(user),
      firstName: stringValue(user.firstName),
      lastName: stringValue(user.lastName)
    };
  });

  state.userSyncStatuses.forEach((status) => {
    const statusID = status.id || status.documentID || status.userIdentifier;
    if (consumedStatusIDs.has(statusID)) {
      return;
    }
    rows.push({
      user: null,
      status,
      displayName: status.displayName || [status.firstName, status.lastName].filter(Boolean).join(" ") || status.userIdentifier || "Utilisateur",
      firstName: status.firstName,
      lastName: status.lastName
    });
  });

  return rows.sort((first, second) => {
    return stringValue(first.firstName || first.displayName).localeCompare(stringValue(second.firstName || second.displayName), "fr", { sensitivity: "base" })
      || stringValue(first.lastName).localeCompare(stringValue(second.lastName), "fr", { sensitivity: "base" })
      || stringValue(first.displayName).localeCompare(stringValue(second.displayName), "fr", { sensitivity: "base" });
  });
}

function syncStatusLevel(row) {
  const latestSync = latestDate(row.status?.lastSuccessfulCatchUpAt, row.status?.lastSuccessfulRefreshAt);
  if (!latestSync) {
    return "unknown";
  }

  const ageMs = Date.now() - latestSync.getTime();
  if (ageMs <= 24 * 60 * 60 * 1000) {
    return "ok";
  }
  if (ageMs <= 4 * 24 * 60 * 60 * 1000) {
    return "warning";
  }
  return "danger";
}

function syncStatusLabel(row, level) {
  if (level === "unknown") {
    return "Jamais vu";
  }
  if (level === "ok") {
    return "À jour";
  }
  if (level === "warning") {
    return "À surveiller";
  }
  return "En retard";
}

function latestDate(...dates) {
  return dates
    .filter((date) => date instanceof Date && !Number.isNaN(date.getTime()))
    .sort((first, second) => second.getTime() - first.getTime())[0] || null;
}

function formatSyncDate(date) {
  return date ? formatDateTime(date) : "-";
}

function sourceDisplayName(source) {
  const value = normalizeKey(source);
  if (value === "ipad" || value === "ios") {
    return "iOS";
  }
  if (value === "web") {
    return "Web";
  }
  return source || "-";
}

function renderAdminActivityEvent(event) {
  const note = state.notes.find((candidate) => candidate.id === event.noteID);
  const displayName = displayNameForIdentifier(event.userIdentifier) || event.userDisplayName || event.userIdentifier;
  const isPlanningEvent = Boolean(event.planningEventID);
  const noteTitle = event.noteTitle || note?.title || (isPlanningEvent ? "Planning réglementaire" : "Consigne sans titre");
  const activityDetails = stringValue(event.activityDetails).trim();
  const destinationText = event.simulatorNames.length ? event.simulatorNames.join(", ") : activitySimulatorNames(note || event).join(", ");
  const actionContext = stringValue(event.context).trim();
  const simulatorText = actionContext || destinationText;
  const destinationsMeta = actionContext && destinationText && destinationText !== actionContext
    ? `<span>Destinations : ${escapeHtml(destinationText)}</span>`
    : "";
  return `
    <article class="admin-card admin-activity-card" data-note-id="${escapeAttribute(event.noteID)}" data-context="${escapeAttribute(event.context)}">
      <div class="admin-card-title">
        <strong>${escapeHtml(event.actionTitle)}</strong>
        <span>${escapeHtml(formatDateTime(event.createdAt))}</span>
      </div>
      <div class="admin-activity-meta">
        <span>👤 ${escapeHtml(displayName)}</span>
        <span>▦ ${escapeHtml(simulatorText)}</span>
        ${destinationsMeta}
      </div>
      <div class="admin-activity-note-row">
        <span>
          ${escapeHtml(noteTitle)}
          ${activityDetails ? `<small>${escapeHtml(activityDetails)}</small>` : ""}
        </span>
        <button type="button" class="secondary" data-admin-action="open-activity-note" ${event.noteID ? "" : "disabled"}>${isPlanningEvent ? "Planning" : "Ouvrir"}</button>
      </div>
    </article>
  `;
}

function filteredActivityEvents() {
  const queryText = normalizeKey(state.adminActivitySearch);
  if (!queryText) {
    return state.activityEvents;
  }

  return state.activityEvents.filter((event) => {
    const note = state.notes.find((candidate) => candidate.id === event.noteID);
    const displayName = displayNameForIdentifier(event.userIdentifier) || event.userDisplayName || event.userIdentifier;
    const searchable = [
      displayName,
      event.actionTitle,
      event.noteTitle,
      event.activityDetails,
      note?.title || "",
      event.simulatorNames.join(" "),
      event.context
    ].join(" ");
    return normalizeKey(searchable).includes(queryText);
  });
}

async function openActivityNote(card) {
  const noteID = card?.dataset.noteId || "";
  const note = state.notes.find((candidate) => candidate.id === noteID) || await fetchNoteByID(noteID);
  if (!note) {
    setStatus("Consigne introuvable");
    return;
  }

  const context = card?.dataset.context || (note.isGeneral ? generalName : note.simulatorNames[0] || generalName);
  openDetail(note.id, context, { overAdmin: true });
}

async function fetchNoteByID(noteID) {
  if (!noteID || !state.authReady || !state.currentUser || shouldSuspendFirestoreSync()) {
    return null;
  }

  try {
    const snapshot = await getDoc(doc(db, "handoverNotes", noteID));
    trackFirestoreDocumentRead("handoverNotes", snapshot);
    if (!snapshot.exists()) {
      return null;
    }

    const note = noteFromSnapshot(snapshot.id, snapshot.data());
    state.fetchedNotesByID.set(note.id, note);
    state.notes = Array.from(new Map(state.notes.map((candidate) => [candidate.id, candidate])).set(note.id, note).values());
    return note;
  } catch (error) {
    setStatus(error.message);
    return null;
  }
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

function loginStatsRows() {
  const dayIdentifier = isoDate(state.adminLoginDate);
  const eventsForDay = state.loginEvents.filter((event) => {
    return event.dayIdentifier === dayIdentifier && !isAnonymousWebLoginEvent(event);
  });
  const eventsByIdentity = groupBy(eventsForDay, (event) => {
    return [
      normalizeKey(event.iCloudIdentifier || event.userIdentifier),
      normalizeKey(event.deviceIdentifier || event.source)
    ].join("|");
  });
  const createdCounts = createdNoteCountsByUser(dayIdentifier);
  const modifiedCounts = modifiedNoteCountsByUser(dayIdentifier);
  const usersByIdentifier = new Map(state.users
    .map((user) => [normalizeKey(user.id), user]));
  const activeSessionCutoff = Date.now() - activeLoginSessionWindowMs;

  return [...eventsByIdentity.values()].map((events) => {
    const latestEvent = [...events].sort((first, second) => {
      return (second.lastSeenAt?.getTime() || second.createdAt?.getTime() || 0)
        - (first.lastSeenAt?.getTime() || first.createdAt?.getTime() || 0);
    })[0];
    const userIdentifier = stringValue(latestEvent?.iCloudIdentifier || latestEvent?.userIdentifier);
    const userKey = normalizeKey(userIdentifier);
    const fallbackName = stringValue(latestEvent?.userDisplayName).trim();
    const isCurrent = events.some((event) => {
      const lastSeenAt = event.lastSeenAt || event.createdAt;
      return lastSeenAt && lastSeenAt.getTime() >= activeSessionCutoff;
    });
    const matchedUser = usersByIdentifier.get(userKey);

    return {
      userIdentifier,
      displayName: matchedUser ? currentDisplayNameForUser(matchedUser) : fallbackName || userIdentifier,
      events,
      totalCount: events.reduce((sum, event) => sum + (event.appearanceCount || 1), 0),
      lastSeenAt: latestEvent?.lastSeenAt || latestEvent?.createdAt || null,
      ipadCount: events.reduce((sum, event) => sum + (event.source === "ipad" ? event.appearanceCount || 1 : 0), 0),
      webCount: events.reduce((sum, event) => sum + (event.source === "web" ? event.appearanceCount || 1 : 0), 0),
      latestIOSAppVersion: latestIOSAppVersionForEvents(events),
      createdCount: createdCounts.get(userKey) || 0,
      modifiedCount: modifiedCounts.get(userKey) || 0,
      iCloudIdentifiers: uniqueValues(events.map((event) => event.iCloudIdentifier || event.userIdentifier)),
      deviceDescriptions: deviceDescriptionsForEvents(events),
      isCurrent
    };
  })
    .filter((row) => row.totalCount > 0)
    .sort((first, second) => {
      if (first.isCurrent !== second.isCurrent) {
        return first.isCurrent ? -1 : 1;
      }

      if ((first.lastSeenAt?.getTime() || 0) !== (second.lastSeenAt?.getTime() || 0)) {
        return (second.lastSeenAt?.getTime() || 0) - (first.lastSeenAt?.getTime() || 0);
      }

      return first.displayName.localeCompare(second.displayName, "fr", { sensitivity: "base" });
    });
}

function loginStatsGroups(rows) {
  const rowsByUser = groupBy(rows, (row) => normalizeKey(row.userIdentifier));
  const readStats = readStatsByUser(isoDate(state.adminLoginDate));

  const groups = [...rowsByUser.values()].map((groupRows) => {
    const sortedRows = [...groupRows].sort((first, second) => {
      if (first.isCurrent !== second.isCurrent) {
        return first.isCurrent ? -1 : 1;
      }

      if ((first.lastSeenAt?.getTime() || 0) !== (second.lastSeenAt?.getTime() || 0)) {
        return (second.lastSeenAt?.getTime() || 0) - (first.lastSeenAt?.getTime() || 0);
      }

      const firstDevice = first.deviceDescriptions[0] || "";
      const secondDevice = second.deviceDescriptions[0] || "";
      return firstDevice.localeCompare(secondDevice, "fr", { sensitivity: "base" });
    });

    const userIdentifier = sortedRows[0]?.userIdentifier || "";
    const userReadStats = readStats.get(normalizeKey(userIdentifier)) || {
      totalReads: 0,
      webReads: 0,
      ipadReads: 0,
      readsByCollection: {}
    };

    return {
      userIdentifier: sortedRows[0]?.userIdentifier || "",
      displayName: sortedRows[0]?.displayName || "Utilisateur",
      rows: sortedRows,
      totalCount: sortedRows.reduce((sum, row) => sum + row.totalCount, 0),
      lastSeenAt: sortedRows.map((row) => row.lastSeenAt).filter(Boolean).sort((a, b) => b - a)[0] || null,
      ipadCount: sortedRows.reduce((sum, row) => sum + row.ipadCount, 0),
      webCount: sortedRows.reduce((sum, row) => sum + row.webCount, 0),
      latestIOSAppVersion: latestIOSAppVersionForRows(sortedRows),
      createdCount: sortedRows[0]?.createdCount || 0,
      modifiedCount: sortedRows[0]?.modifiedCount || 0,
      hasCurrentSession: sortedRows.some((row) => row.isCurrent),
      readCount: userReadStats.totalReads,
      webReadCount: userReadStats.webReads,
      ipadReadCount: userReadStats.ipadReads,
      readsByCollection: userReadStats.readsByCollection
    };
  });

  const groupedUserKeys = new Set(groups.map((group) => normalizeKey(group.userIdentifier)));
  readStats.forEach((userReadStats, userKey) => {
    if (groupedUserKeys.has(userKey) || !userReadStats.totalReads) {
      return;
    }

    groups.push({
      userIdentifier: userReadStats.userIdentifier,
      displayName: userReadStats.userDisplayName || displayNameForIdentifier(userReadStats.userIdentifier) || userReadStats.userIdentifier || "Utilisateur",
      rows: [],
      totalCount: 0,
      lastSeenAt: userReadStats.updatedAt,
      ipadCount: 0,
      webCount: 0,
      latestIOSAppVersion: "",
      createdCount: 0,
      modifiedCount: 0,
      hasCurrentSession: false,
      readCount: userReadStats.totalReads,
      webReadCount: userReadStats.webReads,
      ipadReadCount: userReadStats.ipadReads,
      readsByCollection: userReadStats.readsByCollection
    });
  });

  return groups
    .sort((first, second) => {
      if (first.hasCurrentSession !== second.hasCurrentSession) {
        return first.hasCurrentSession ? -1 : 1;
      }

      if ((first.lastSeenAt?.getTime() || 0) !== (second.lastSeenAt?.getTime() || 0)) {
        return (second.lastSeenAt?.getTime() || 0) - (first.lastSeenAt?.getTime() || 0);
      }

      return first.displayName.localeCompare(second.displayName, "fr", { sensitivity: "base" });
    });
}

function readStatsByUser(dayIdentifier) {
  const statsByUser = new Map();
  state.firestoreReadStats
    .filter((stat) => stat.dayIdentifier === dayIdentifier)
    .forEach((stat) => {
      const userKey = normalizeKey(stat.userIdentifier);
      if (!userKey) {
        return;
      }

      const current = statsByUser.get(userKey) || {
        userIdentifier: stat.userIdentifier,
        userDisplayName: stat.userDisplayName,
        updatedAt: stat.updatedAt,
        totalReads: 0,
        webReads: 0,
        ipadReads: 0,
        readsByCollection: {}
      };
      current.userDisplayName = current.userDisplayName || stat.userDisplayName;
      if (!current.updatedAt || (stat.updatedAt && stat.updatedAt > current.updatedAt)) {
        current.updatedAt = stat.updatedAt;
      }
      current.totalReads += stat.totalReads;
      if (stat.source === "ipad") {
        current.ipadReads += stat.totalReads;
      } else if (stat.source === "web") {
        current.webReads += stat.totalReads;
      }

      Object.entries(stat.readsByCollection).forEach(([collectionName, count]) => {
        current.readsByCollection[collectionName] = (current.readsByCollection[collectionName] || 0) + count;
      });
      statsByUser.set(userKey, current);
    });

  return statsByUser;
}

function readStatsTitle(group) {
  const sourceParts = [];
  if (group.webReadCount) {
    sourceParts.push(`${formatCompactNumber(group.webReadCount)} Web`);
  }
  if (group.ipadReadCount) {
    sourceParts.push(`${formatCompactNumber(group.ipadReadCount)} iPad`);
  }

  const collectionParts = Object.entries(group.readsByCollection || {})
    .sort((first, second) => second[1] - first[1])
    .slice(0, 5)
    .map(([collectionName, count]) => `${collectionName}: ${formatCompactNumber(count)}`);

  return [...sourceParts, ...collectionParts].join(" • ") || "Aucune lecture enregistrée";
}

function isAnonymousWebLoginEvent(event) {
  return normalizeKey(event.source) === "web"
    && (
      normalizeKey(event.userIdentifier) === "web_anonymous"
      || normalizeKey(event.iCloudIdentifier) === "web_anonymous"
      || normalizeKey(event.userDisplayName) === normalizeKey("Web non connecté")
    );
}

function createdNoteCountsByUser(dayIdentifier) {
  const counts = new Map();
  for (const note of state.notes) {
    if (!note.createdAt || isoDate(note.createdAt) !== dayIdentifier) {
      continue;
    }

    const identifier = normalizeKey(note.authorIdentifier || note.author);
    if (!identifier) {
      continue;
    }

    counts.set(identifier, (counts.get(identifier) || 0) + 1);
  }
  return counts;
}

function modifiedNoteCountsByUser(dayIdentifier) {
  const counts = new Map();
  for (const note of state.notes) {
    const revisions = [...note.revisions]
      .filter((revision) => revision.date)
      .sort((first, second) => first.date - second.date)
      .slice(1);
    for (const revision of revisions) {
      if (isoDate(revision.date) !== dayIdentifier) {
        continue;
      }

      const identifier = normalizeKey(revision.authorIdentifier || revision.author);
      if (!identifier) {
        continue;
      }

      counts.set(identifier, (counts.get(identifier) || 0) + 1);
    }
  }
  return counts;
}

function groupBy(items, keyForItem) {
  const groups = new Map();
  for (const item of items) {
    const key = keyForItem(item);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(item);
  }
  return groups;
}

function deviceDescriptionsForEvents(events) {
  return uniqueValues(events
    .filter((event) => event.deviceIdentifier)
    .map((event) => {
      const name = stringValue(event.deviceName).trim();
      return name ? `${name} (${event.deviceIdentifier})` : event.deviceIdentifier;
    }));
}

function latestIOSAppVersionForEvents(events) {
  const latestIPadEvent = [...events]
    .filter((event) => event.source === "ipad" && stringValue(event.iosAppVersion).trim())
    .sort((first, second) => {
      return (second.lastSeenAt?.getTime() || second.createdAt?.getTime() || 0)
        - (first.lastSeenAt?.getTime() || first.createdAt?.getTime() || 0);
    })[0];
  return stringValue(latestIPadEvent?.iosAppVersion).trim();
}

function userStatsForUser(user) {
  const matchingEvents = matchingLoginEventsForUser(user);
  return [...matchingEvents]
    .sort((first, second) => {
      return (second.lastSeenAt?.getTime() || second.createdAt?.getTime() || 0)
        - (first.lastSeenAt?.getTime() || first.createdAt?.getTime() || 0);
    })[0];
}

function userStatsSummaryForUser(user) {
  const matchingEvents = matchingLoginEventsForUser(user);
  const latestIOSAppVersion = [...matchingEvents]
    .filter((event) => event.source === "ipad" && stringValue(event.iosAppVersion).trim())
    .sort((first, second) => {
      return (second.lastSeenAt?.getTime() || second.createdAt?.getTime() || 0)
        - (first.lastSeenAt?.getTime() || first.createdAt?.getTime() || 0);
    })[0]?.iosAppVersion;

  return {
    latestIOSAppVersion: stringValue(latestIOSAppVersion).trim(),
    totalConnections: matchingEvents.reduce((total, event) => {
      return total + (event.appearanceCount || 0);
    }, 0)
  };
}

function matchingLoginEventsForUser(user) {
  const userKeys = new Set([
    normalizeKey(user.id),
    normalizeKey(user.documentID),
    normalizeKey(user.iCloudIdentifier)
  ].filter(Boolean));

  return state.loginEvents.filter((event) => {
    return [
      normalizeKey(event.iCloudIdentifier),
      normalizeKey(event.userIdentifier)
    ].some((key) => key && userKeys.has(key));
  });
}

function latestIOSAppVersionForRows(rows) {
  const latestRow = [...rows]
    .filter((row) => stringValue(row.latestIOSAppVersion).trim())
    .sort((first, second) => {
      return (second.lastSeenAt?.getTime() || 0) - (first.lastSeenAt?.getTime() || 0);
    })[0];
  return stringValue(latestRow?.latestIOSAppVersion).trim();
}

function uniqueValues(values) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const trimmed = stringValue(value).trim();
    if (!trimmed) {
      continue;
    }

    const key = normalizeKey(trimmed);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

function isAdminIdentifier(identifier) {
  return normalizeKey(identifier) === normalizeKey("ADMIN");
}

async function createAdminUser() {
  if (!isAdminSession()) {
    setStatus("Acces admin requis");
    return;
  }

  const firstName = elements.adminBody.querySelector("#newUserFirstName")?.value.trim() || "";
  const lastName = elements.adminBody.querySelector("#newUserLastName")?.value.trim() || "";
  const email = (elements.adminBody.querySelector("#newUserEmail")?.value.trim() || "").toLowerCase();
  const accessCode = (elements.adminBody.querySelector("#newUserAccessCode")?.value || "")
    .replace(/\D/g, "")
    .slice(0, 6);
  const role = nullableString(elements.adminBody.querySelector("#newUserRole")?.value || "");
  const team = nullableString(elements.adminBody.querySelector("#newUserTeam")?.value || "");
  const canEditPlanning = role === "admin" || Boolean(elements.adminBody.querySelector("#newUserCanEditPlanning")?.checked);
  const canViewPlanning = canEditPlanning || Boolean(elements.adminBody.querySelector("#newUserCanViewPlanning")?.checked);

  if (accessCode.length !== 6) {
    setStatus("Le code utilisateur doit contenir 6 chiffres");
    return;
  }
  if (state.users.some((user) => user.accessCode === accessCode)) {
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
      email,
      accessCode,
      isAccessCodeUserDefined: false,
      roleRawValue: role,
      teamRawValue: team,
      canViewPlanning,
      canEditPlanning,
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
  const nextRole = nullableString(card.querySelector('[data-field="role"]').value);
  if (isLastAdminUser(user) && nextRole !== "admin") {
    setStatus("Impossible de retirer le dernier compte admin");
    return;
  }
  const nextCanEditPlanning = nextRole === "admin"
    || Boolean(card.querySelector('[data-field="canEditPlanning"]')?.checked);
  const nextCanViewPlanning = nextCanEditPlanning
    || Boolean(card.querySelector('[data-field="canViewPlanning"]')?.checked);

  const patch = {
    firstName: card.querySelector('[data-field="firstName"]').value.trim(),
    lastName: card.querySelector('[data-field="lastName"]').value.trim(),
    email: card.querySelector('[data-field="email"]').value.trim().toLowerCase(),
    roleRawValue: nextRole,
    teamRawValue: nullableString(card.querySelector('[data-field="team"]').value),
    canViewPlanning: nextCanViewPlanning,
    canEditPlanning: nextCanEditPlanning,
    updatedAt: new Date()
  };

  if (/^\d{6}$/.test(accessCodeInput) && accessCodeInput !== "••••••") {
    patch.accessCode = accessCodeInput;
    patch.isAccessCodeUserDefined = false;
  }

  await updateDoc(doc(db, "users", documentID), patch);
  state.users = state.users.map((candidate) => candidate.documentID === documentID
    ? userFromSnapshot(documentID, { ...candidate, ...patch })
    : candidate);
  syncCurrentUserFromUsersList();
  renderSession();
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

async function resetPasswordRequestCode(requestID) {
  if (!isAdminSession()) {
    setStatus("Acces admin requis");
    return;
  }

  const request = state.passwordResetRequests.find((candidate) => candidate.id === requestID);
  const user = request ? matchedPasswordResetUser(request) : null;
  if (!request || !user) {
    setStatus("Compte utilisateur introuvable");
    return;
  }

  const code = generateAccessCode();
  const now = new Date();
  await updateDoc(doc(db, "users", user.documentID), {
    accessCode: code,
    isAccessCodeUserDefined: false,
    updatedAt: now
  });
  await updateDoc(doc(db, "passwordResetRequests", request.id), {
    status: "completed",
    completedAt: now,
    completedBy: currentDisplayName(),
    generatedCode: code,
    updatedAt: now
  });
  state.passwordResetRequests = state.passwordResetRequests.filter((candidate) => candidate.id !== request.id);
  renderAdminSettings();
  setStatus(`Code réinitialisé pour ${currentDisplayNameForUser(user)} : ${code}`);
}

async function completePasswordResetRequest(requestID) {
  if (!isAdminSession()) {
    setStatus("Acces admin requis");
    return;
  }

  const request = state.passwordResetRequests.find((candidate) => candidate.id === requestID);
  if (!request) {
    return;
  }

  const now = new Date();
  await updateDoc(doc(db, "passwordResetRequests", request.id), {
    status: "completed",
    completedAt: now,
    completedBy: currentDisplayName(),
    updatedAt: now
  });
  state.passwordResetRequests = state.passwordResetRequests.filter((candidate) => candidate.id !== request.id);
  renderAdminSettings();
  setStatus("Demande clôturée");
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

  if (isLastAdminUser(user)) {
    setStatus("Impossible de supprimer le dernier compte admin");
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

  const previousName = stringValue(simulator?.name).trim();
  if (previousName && normalizeKey(previousName) !== normalizeKey(name)) {
    await renameSimulatorReferences(previousName, name);
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

async function renameSimulatorReferences(previousName, nextName) {
  const previousKey = normalizeKey(previousName);
  const nextKey = normalizeKey(nextName);
  if (!previousKey || !nextKey || previousKey === nextKey) {
    return;
  }

  const renamedContext = (context) => {
    const text = stringValue(context).trim();
    if (normalizeKey(text) === previousKey) {
      return nextName;
    }

    const separatorIndex = text.indexOf("#");
    if (separatorIndex > 0 && normalizeKey(text.slice(0, separatorIndex)) === previousKey) {
      return `${nextName}${text.slice(separatorIndex)}`;
    }

    return context;
  };

  const renamedDestinationStorage = (storage) => {
    return stringValue(storage)
      .split("\n")
      .map((entry) => renamedContext(entry))
      .join("\n");
  };

  const updates = [];
  for (const note of state.notes) {
    const simulatorNames = uniqueStrings((note.simulatorNames || []).map((simulatorName) => {
      return normalizeKey(simulatorName) === previousKey ? nextName : simulatorName;
    }));
    const completedContexts = uniqueStrings((note.completedContexts || []).map(renamedContext));
    const completions = (note.completions || []).map((completion) => ({
      ...completion,
      context: renamedContext(completion.context)
    }));
    const completionCancellations = (note.completionCancellations || []).map((cancellation) => ({
      ...cancellation,
      context: renamedContext(cancellation.context)
    }));
    const acknowledgements = (note.acknowledgements || []).map((acknowledgement) => ({
      ...acknowledgement,
      context: renamedContext(acknowledgement.context)
    }));
    const revisions = (note.revisions || []).map((revision) => ({
      ...revision,
      previousDestinationStorage: revision.previousDestinationStorage
        ? renamedDestinationStorage(revision.previousDestinationStorage)
        : revision.previousDestinationStorage,
      newDestinationStorage: revision.newDestinationStorage
        ? renamedDestinationStorage(revision.newDestinationStorage)
        : revision.newDestinationStorage
    }));

    const hasChanges =
      simulatorNames.join("\n") !== (note.simulatorNames || []).join("\n")
      || completedContexts.join("\n") !== (note.completedContexts || []).join("\n")
      || JSON.stringify(completions) !== JSON.stringify(note.completions || [])
      || JSON.stringify(completionCancellations) !== JSON.stringify(note.completionCancellations || [])
      || JSON.stringify(acknowledgements) !== JSON.stringify(note.acknowledgements || [])
      || JSON.stringify(revisions) !== JSON.stringify(note.revisions || []);

    if (!hasChanges) {
      continue;
    }

    const patch = {
      simulatorNamesStorage: simulatorNames.join("\n"),
      completedContextsStorage: completedContexts.join("\n"),
      completionHistoryData: completions.length ? encodeRecordArray(completions) : deleteField(),
      completionCancellationHistoryData: completionCancellations.length ? encodeRecordArray(completionCancellations) : deleteField(),
      acknowledgementHistoryData: acknowledgements.length ? encodeRecordArray(acknowledgements) : deleteField(),
      revisionHistoryData: revisions.length ? encodeRecordArray(revisions) : deleteField(),
      updatedAt: new Date()
    };
    const indexedPatch = {
      ...patch,
      ...handoverIndexFields(noteWithPatchForIndex(note, patch))
    };
    updates.push(updateDoc(doc(db, "handoverNotes", note.id), indexedPatch));
  }

  await Promise.all(updates);
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

async function saveAdminAppVersion() {
  if (state.currentUser?.role !== "admin") {
    setStatus("Acces admin requis");
    return;
  }

  const requiredIOSAppVersion = elements.adminBody
    .querySelector("[data-app-version-field]")
    ?.value
    .trim() || "";

  await setDoc(doc(db, "appSettings", "global"), {
    id: "global",
    requiredIOSAppVersion,
    updatedAt: new Date()
  }, { merge: true });

  state.appSettings.requiredIOSAppVersion = requiredIOSAppVersion;
  renderAdminSettings();
  setStatus(requiredIOSAppVersion ? "Version iPad requise enregistrée" : "Controle de version iPad désactivé");
}

async function scanAdminMaintenance() {
  if (state.currentUser?.role !== "admin") {
    setStatus("Acces admin requis");
    return;
  }

  state.isAdminMaintenanceScanning = true;
  state.adminMaintenanceStatus = "Lecture Firestore en cours...";
  renderAdminSettings();

  try {
    const snapshot = await getDocs(collection(db, "handoverNotes"));
    trackFirestoreRead("handoverNotes", snapshot.docs.length);
    const documents = snapshot.docs.map((documentSnapshot) => {
      const data = documentSnapshot.data();
      const note = noteFromSnapshot(documentSnapshot.id, data);
      return {
        id: documentSnapshot.id,
        data,
        note,
        expectedFields: handoverIndexFields(note)
      };
    });

    const states = documents.map((documentInfo) => stringValue(documentInfo.data.syncState));
    const anomalies = documents
      .map(syncStateAnomalyFromDocument)
      .filter(Boolean)
      .sort((first, second) => first.title.localeCompare(second.title, "fr", { sensitivity: "base" }));

    state.adminMaintenanceAudit = {
      totalCount: documents.length,
      withSyncStateCount: states.filter(Boolean).length,
      missingSyncStateCount: states.filter((syncState) => !syncState).length,
      activeCount: states.filter((syncState) => syncState === "active").length,
      archivedCount: states.filter((syncState) => syncState === "archived").length,
      deletedCount: states.filter((syncState) => syncState === "deleted").length,
      otherSyncStateCount: states.filter((syncState) => syncState && !["active", "archived", "deleted"].includes(syncState)).length,
      anomalies
    };
    state.adminMaintenanceStatus = anomalies.length
      ? `${anomalies.length} anomalie${anomalies.length > 1 ? "s" : ""} détectée${anomalies.length > 1 ? "s" : ""}.`
      : "Aucune anomalie détectée.";
    setStatus("Scan maintenance terminé");
  } catch (error) {
    console.error("Admin maintenance scan failed", error);
    state.adminMaintenanceStatus = error.message || "Scan impossible.";
    setStatus(state.adminMaintenanceStatus);
  } finally {
    state.isAdminMaintenanceScanning = false;
    renderAdminSettings();
  }
}

function syncStateAnomalyFromDocument(documentInfo) {
  const currentSyncState = stringValue(documentInfo.data.syncState);
  const expectedSyncState = documentInfo.expectedFields.syncState;
  const reasons = [];

  if (currentSyncState !== expectedSyncState) {
    reasons.push("syncState incorrect");
  }

  if (!dateValue(documentInfo.data.lastRealtimeRelevantAt)) {
    reasons.push("lastRealtimeRelevantAt manquant");
  }

  if (!dateValue(documentInfo.data.realtimeActiveUntil)) {
    reasons.push("realtimeActiveUntil manquant");
  }

  if (!reasons.length) {
    return null;
  }

  return {
    id: documentInfo.id,
    title: documentInfo.note.title,
    simulatorText: documentInfo.note.isGeneral ? "General" : documentInfo.note.simulatorNames.join(", "),
    currentSyncState,
    expectedSyncState,
    expectedFields: documentInfo.expectedFields,
    reason: reasons.join(", ")
  };
}

async function repairAdminSyncState() {
  if (state.currentUser?.role !== "admin") {
    setStatus("Acces admin requis");
    return;
  }

  const anomalies = state.adminMaintenanceAudit?.anomalies || [];
  if (!anomalies.length) {
    state.adminMaintenanceStatus = "Aucune anomalie à corriger.";
    renderAdminSettings();
    return;
  }

  state.isAdminMaintenanceRepairing = true;
  state.adminMaintenanceStatus = "Correction Firestore en cours...";
  renderAdminSettings();

  try {
    await Promise.all(anomalies.map((anomaly) => {
      return updateDoc(doc(db, "handoverNotes", anomaly.id), anomaly.expectedFields);
    }));
    state.adminMaintenanceStatus = `${anomalies.length} anomalie${anomalies.length > 1 ? "s" : ""} corrigée${anomalies.length > 1 ? "s" : ""}.`;
    setStatus("Index de synchronisation corrigé");
    await scanAdminMaintenance();
  } catch (error) {
    console.error("Admin maintenance repair failed", error);
    state.adminMaintenanceStatus = error.message || "Correction impossible.";
    setStatus(state.adminMaintenanceStatus);
  } finally {
    state.isAdminMaintenanceRepairing = false;
    renderAdminSettings();
  }
}

async function sendAdminMessage() {
  if (state.currentUser?.role !== "admin") {
    setStatus("Acces admin requis");
    return;
  }

  const text = elements.adminBody.querySelector("[data-admin-message-text]")?.value.trim() || "";
  const sendsToAll = Boolean(elements.adminBody.querySelector("[data-admin-message-all]")?.checked);
  const selectedUserIDs = [...elements.adminBody.querySelectorAll("[data-admin-message-recipient]:checked")]
    .map((input) => input.value)
    .filter(Boolean);

  if (!text) {
    setStatus("Le message est vide");
    return;
  }
  if (!sendsToAll && selectedUserIDs.length === 0) {
    setStatus("Selectionne au moins un destinataire");
    return;
  }

  const recipients = state.users.filter((user) => selectedUserIDs.includes(user.id));
  const id = crypto.randomUUID();

  await setDoc(doc(db, "adminMessages", id), {
    id,
    text,
    sendsToAll,
    recipientUserIDs: sendsToAll ? [] : selectedUserIDs,
    recipientDisplayNames: sendsToAll ? [] : recipients.map(currentDisplayNameForUser),
    authorIdentifier: state.currentUser.id,
    createdAt: new Date()
  });

  resetAdminMessageComposer();
  renderAdminSettings();
  setStatus("Message envoyé");
}

function visibleHandwritingFor(note) {
  if (!state.currentUser) {
    return null;
  }

  const ownNote = state.handwritingNotes.find((entry) => {
    return entry.noteID === note.id && normalizeKey(entry.authorIdentifier) === normalizeKey(state.currentUser.id);
  });

  const handwritingWasClearedAfterOwnNote = note.handwritingClearedAt
    && ownNote?.updatedAt
    && ownNote.updatedAt <= note.handwritingClearedAt;

  if (ownNote?.drawingData && !handwritingWasClearedAfterOwnNote) {
    return {
      source: "utilisateur",
      documentID: ownNote.id,
      data: ownNote.drawingData,
      previewImageData: ownNote.previewImageData
    };
  }

  const currentUserOwnsEmbeddedHandwriting = normalizeKey(note.handwritingAuthorIdentifier || note.authorIdentifier || note.author) === normalizeKey(state.currentUser.id);
  if (!note.handwritingClearedAt && currentUserOwnsEmbeddedHandwriting && note.handwritingData) {
    return { source: "consigne", data: note.handwritingData, previewImageData: note.handwritingPreviewImageData };
  }

  if (note.deletedAt && canCurrentUserViewDeletedNote(note)) {
    const sharedDeletedNote = state.handwritingNotes.find((entry) => {
      const handwritingWasClearedAfterEntry = note.handwritingClearedAt
        && entry.updatedAt
        && entry.updatedAt <= note.handwritingClearedAt;
      return entry.noteID === note.id && entry.drawingData && !handwritingWasClearedAfterEntry;
    });

    if (sharedDeletedNote) {
      return {
        source: "utilisateur",
        documentID: sharedDeletedNote.id,
        data: sharedDeletedNote.drawingData,
        previewImageData: sharedDeletedNote.previewImageData,
        readOnly: normalizeKey(sharedDeletedNote.authorIdentifier) !== normalizeKey(state.currentUser.id)
      };
    }

    if (!note.handwritingClearedAt && note.handwritingData) {
      return {
        source: "consigne",
        data: note.handwritingData,
        previewImageData: note.handwritingPreviewImageData,
        readOnly: !currentUserOwnsEmbeddedHandwriting
      };
    }
  }

  return null;
}

function canCurrentUserSeeNote(note) {
  if (note.title.trim() || note.text.trim()) {
    return true;
  }

  return Boolean(visibleHandwritingFor(note));
}

function renderHandwritingNotice(handwriting) {
  const image = handwriting.previewImageData
    ? `<img class="handwriting-preview" src="data:image/png;base64,${escapeHtml(handwriting.previewImageData)}" alt="Note manuscrite">`
    : "";
  const tools = handwriting.readOnly ? "" : `
        <div class="handwriting-tools" aria-label="Actions note manuscrite">
          <button type="button" class="handwriting-tool-button danger" data-detail-action="clear-handwriting" title="Effacer la note manuscrite" aria-label="Effacer la note manuscrite">
            ${trashIconSVG()}
          </button>
          <button type="button" class="handwriting-tool-button" data-detail-action="ocr-handwriting" title="OCR" aria-label="OCR">
            ${ocrIconSVG()}
          </button>
        </div>
  `;
  return `
    <div class="handwriting-notice">
      <div class="handwriting-layout">
        <div class="handwriting-canvas-slot">
          ${image}
          ${image ? "" : "<p>Cette note n'a pas encore d'aperçu web. Elle sera visible après ouverture/enregistrement depuis l'app iPad mise à jour.</p>"}
        </div>
        ${tools}
      </div>
    </div>
  `;
}

function renderHandwritingSection(note, handwriting) {
  if (state.pendingHandwritingClear?.noteID === note.id) {
    return `
      <div class="detail-subsection handwriting-subsection">
        <h4>Note manuscrite</h4>
        <div class="handwriting-empty pending-clear">${escapeHtml(state.pendingHandwritingClear.message)}</div>
      </div>
    `;
  }

  if (!handwriting) {
    return "";
  }

  return `
    <div class="detail-subsection handwriting-subsection">
      <h4>Note manuscrite</h4>
      ${renderHandwritingNotice(handwriting)}
    </div>
  `;
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
  const completionDate = dateWithTime(state.selectedDate, now);
  const removedCompletions = alreadyDone
    ? activeCompletions(note).filter((completion) => completion.context === context && sameDay(completion.date, state.selectedDate))
    : [];
  const completions = alreadyDone
    ? note.completions
    : [...note.completions, {
        id: crypto.randomUUID(),
        context,
        author: currentDisplayName(),
        authorIdentifier: state.currentUser.id,
        date: completionDate,
        recordedDate: now
      }];
  const completionCancellations = alreadyDone
    ? completionCancellationsAfterRemoval(note, removedCompletions, context, now)
    : note.completionCancellations;
  const completedContexts = alreadyDone
    ? note.completedContexts.filter((entry) => entry !== key)
    : uniqueStrings([...note.completedContexts, key]);

  await updateNote(note.id, {
    completedContextsStorage: completedContexts.join("\n"),
    completionHistoryData: completions.length ? encodeRecordArray(completions) : deleteField(),
    completionCancellationHistoryData: completionCancellations.length ? encodeRecordArray(completionCancellations) : deleteField(),
    updatedAt: now
  });
  await recordActivityEvent(alreadyDone ? "completionCancelled" : "completed", note, context);
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
  await recordActivityEvent(alreadyAcknowledged ? "acknowledgementCancelled" : "acknowledged", note, context);
}

function confirmPermanentDeleteFromDetail(note) {
  if (state.currentUser?.role !== "admin" || !note.deletedAt || state.isSaving) {
    return;
  }

  if (window.confirm("Supprimer définitivement cette consigne ? Cette action est irréversible.")) {
    performNoteDeletion(note, "permanent");
  }
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
      await recordActivityEvent("permanentlyDeleted", note, state.selectedDetail?.context);
    } else if (deletionMode === "restore") {
      setStatus("Restauration...");
      await updateNote(note.id, {
        deletedAt: deleteField(),
        deletedBy: deleteField(),
        deletedByIdentifier: deleteField(),
        updatedAt: new Date()
      });
      await recordActivityEvent("restored", note, state.selectedDetail?.context);
    } else {
      const now = new Date();
      setStatus("Suppression...");
      if (await detachContextDeletionIfNeeded(note, now)) {
        closeDetail();
        render();
        return;
      }

      await updateNote(note.id, {
        deletedAt: now,
        deletedBy: currentDisplayName(),
        deletedByIdentifier: state.currentUser.id,
        updatedAt: now
      });
      await recordActivityEvent("deleted", note, state.selectedDetail?.context);
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

async function detachContextDeletionIfNeeded(note, now) {
  const context = state.selectedDetail?.context || "";
  if (!context
    || context === generalName
    || note.isGeneral
    || note.deletedAt
    || note.simulatorNames.length <= 1
    || !note.simulatorNames.includes(context)) {
    return false;
  }

  const remainingSimulators = note.simulatorNames.filter((name) => name !== context);
  const detachedID = crypto.randomUUID().toUpperCase();
  const detachedCompletions = contextRecords(note.completions, context);
  const detachedCompletionCancellations = contextRecords(note.completionCancellations, context);
  const detachedAcknowledgements = contextRecords(note.acknowledgements, context);
  const remainingCompletions = withoutContextRecords(note.completions, context);
  const remainingCompletionCancellations = withoutContextRecords(note.completionCancellations, context);
  const remainingAcknowledgements = withoutContextRecords(note.acknowledgements, context);

  const detachedPayload = {
    id: detachedID,
    title: note.title,
    text: note.text,
    author: note.author,
    authorIdentifier: note.authorIdentifier,
    createdAt: note.createdAt || now,
    updatedAt: now,
    contentModifiedAt: note.contentModifiedAt || null,
    deletedAt: now,
    deletedBy: currentDisplayName(),
    deletedByIdentifier: state.currentUser.id,
    displayDate: note.displayDate,
    firstDisplayDate: note.firstDisplayDate || note.displayDate,
    isGeneral: false,
    simulatorNamesStorage: context,
    richTextHTML: note.richTextHTML || "",
    richTextData: note.richTextData || "",
    priorityRawValue: note.priority || "",
    handwritingData: note.handwritingData || "",
    handwritingPreviewImageData: note.handwritingPreviewImageData || "",
    handwritingAuthorIdentifier: note.handwritingAuthorIdentifier || "",
    completedContextsStorage: contextCompletionKeys(note.completedContexts, context).join("\n"),
    completionHistoryData: detachedCompletions.length ? encodeRecordArray(detachedCompletions) : "",
    completionCancellationHistoryData: detachedCompletionCancellations.length ? encodeRecordArray(detachedCompletionCancellations) : "",
    acknowledgementHistoryData: detachedAcknowledgements.length ? encodeRecordArray(detachedAcknowledgements) : "",
    revisionHistoryData: note.revisions.length ? encodeRecordArray(note.revisions) : "",
    reportHistoryData: note.reports.length ? encodeRecordArray(note.reports) : "",
    searchKeywords: searchKeywordsForNote(note)
  };
  Object.assign(detachedPayload, handoverIndexFields({
    ...detachedPayload,
    simulatorNames: [context],
    priority: note.priority,
    deletedAt: now,
    contentModifiedAt: note.contentModifiedAt || null,
    completedContexts: contextCompletionKeys(note.completedContexts, context),
    completions: detachedCompletions,
    completionCancellations: detachedCompletionCancellations,
    revisions: note.revisions,
    acknowledgements: detachedAcknowledgements
  }));

  const originalPatch = {
    updatedAt: now,
    simulatorNamesStorage: remainingSimulators.join("\n"),
    completedContextsStorage: note.completedContexts.filter((key) => !isCompletionKeyForContext(key, context)).join("\n"),
    completionHistoryData: remainingCompletions.length ? encodeRecordArray(remainingCompletions) : deleteField(),
    completionCancellationHistoryData: remainingCompletionCancellations.length ? encodeRecordArray(remainingCompletionCancellations) : deleteField(),
    acknowledgementHistoryData: remainingAcknowledgements.length ? encodeRecordArray(remainingAcknowledgements) : deleteField()
  };
  Object.assign(originalPatch, handoverIndexFields(noteWithPatchForIndex(note, originalPatch)));

  await Promise.all([
    updateDoc(doc(db, "handoverNotes", note.id), originalPatch),
    setDoc(doc(db, "handoverNotes", detachedID), detachedPayload)
  ]);
  await recordActivityEvent("deleted", detachedPayload, context);
  setStatus("Consigne supprimée pour ce simulateur");
  return true;
}

async function permanentlyDeleteNote(noteID) {
  const [handwritingSnapshot, dailyTagSnapshot] = await Promise.all([
    getDocs(query(collection(db, "handwritingNotes"), where("noteID", "==", noteID))),
    getDocs(query(collection(db, "dailyTags"), where("noteID", "==", noteID)))
  ]);
  trackFirestoreRead("handwritingNotes", handwritingSnapshot.docs.length);
  trackFirestoreRead("dailyTags", dailyTagSnapshot.docs.length);

  const linkedDocuments = [
    ...handwritingSnapshot.docs,
    ...dailyTagSnapshot.docs
  ];

  await setDoc(doc(db, "handoverNoteDeletions", noteID), {
    noteID,
    deletedAt: new Date(),
    deletedBy: currentDisplayName(),
    deletedByIdentifier: state.currentUser?.id || ""
  }, { merge: true });
  await Promise.all(linkedDocuments.map((document) => deleteDoc(document.ref)));
  await deleteDoc(doc(db, "handoverNotes", noteID));
}

async function deleteHandwritingNotesForNote(noteID, preferredDocumentID = "") {
  const linkedSnapshot = await getDocs(query(collection(db, "handwritingNotes"), where("noteID", "==", noteID)));
  trackFirestoreRead("handwritingNotes", linkedSnapshot.docs.length);
  const documentIDs = new Set(linkedSnapshot.docs.map((document) => document.id));
  if (preferredDocumentID) {
    documentIDs.add(preferredDocumentID);
  }

  await Promise.all(
    [...documentIDs]
      .filter(Boolean)
      .map((documentID) => deleteDoc(doc(db, "handwritingNotes", documentID)))
  );
}

function removeLocalHandwritingNotesForNote(noteID, preferredDocumentID = "") {
  state.handwritingNotes = state.handwritingNotes.filter((handwritingNote) => {
    return handwritingNote.noteID !== noteID && handwritingNote.id !== preferredDocumentID;
  });
  renderSimulators();
  render();
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
    revisionHistoryData: "",
    searchKeywords: searchKeywordsForNote({ title, text })
  };
  Object.assign(payload, handoverIndexFields({
    ...payload,
    simulatorNames: destination.simulatorNames,
    priority,
    deletedAt: null,
    contentModifiedAt: null,
    completedContexts: [],
    completions: [],
    completionCancellations: [],
    revisions: [],
    acknowledgements: []
  }));

  state.isSaving = true;
  setStatus("Enregistrement...");
  try {
    await setDoc(doc(db, "handoverNotes", id), payload);
    await recordActivityEvent("created", payload, destination.isGeneral ? generalName : destination.simulatorNames[0]);
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

function showEditDateConfirmation(note, selectedModificationDate, options = {}) {
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
      ...options,
      skipDateConfirmation: true,
      modificationDate: choice === "today" ? new Date() : selectedModificationDate
    });
  });

  elements.detailBody.appendChild(popover);
}

function showDoneDateConfirmation(note, selectedDoneDate, options = {}) {
  elements.detailBody.querySelector(".date-confirm-popover")?.remove();
  const popover = document.createElement("div");
  popover.className = "date-confirm-popover";
  popover.setAttribute("role", "dialog");
  popover.setAttribute("aria-modal", "true");
  popover.innerHTML = `
    <strong>La clôture n'est pas saisie<br>à la date du jour</strong>
    <p>Voulez-vous solder cette consigne à la date sélectionnée ou à la date du jour ?</p>
    <button type="button" class="date-confirm-choice" data-done-date-confirm="keep">
      Solder à la date du ${escapeHtml(formatLongDate(selectedDoneDate))}
    </button>
    <button type="button" class="date-confirm-choice primary" data-done-date-confirm="today">
      Solder à la date du jour
    </button>
  `;

  popover.addEventListener("click", (event) => {
    const choice = event.target.closest("[data-done-date-confirm]")?.dataset.doneDateConfirm;
    if (!choice) {
      return;
    }

    popover.remove();
    saveDetailEdit(note, {
      ...options,
      doneDate: choice === "today" ? new Date() : selectedDoneDate,
      skipDoneDateConfirmation: true
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
  const selectedDoneDate = options.doneDate
    ? startOfDay(options.doneDate)
    : initialDone
      ? visibleCompletionDayInContext(note, context, selectedModificationDate)
      : selectedModificationDate;
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
  const destinationRevisionDate = textChanged ? new Date(modificationDate.getTime() - 1) : now;
  const priorityRevisionDate = (textChanged || destinationChanged) ? new Date(modificationDate.getTime() - 2) : now;
  const doneChanged = initialDone !== draftDone;
  const acknowledgementChanged = initialAcknowledged !== draftAcknowledged;
  const handwritingClearChanged = state.pendingHandwritingClear?.noteID === note.id;
  const announcesContentModification = textChanged && shouldAnnounceContentModification(note.title, note.text, title, text);

  if (!textChanged && !richTextChanged && !dateChanged && !priorityChanged && !destinationChanged && !doneChanged && !acknowledgementChanged && !handwritingClearChanged) {
    closeDetail();
    return;
  }

  if (!options.skipDoneDateConfirmation && doneChanged && draftDone && !sameDay(selectedDoneDate, new Date())) {
    showDoneDateConfirmation(note, selectedDoneDate, options);
    return;
  }

  if (!options.skipDateConfirmation && announcesContentModification && !sameDay(selectedModificationDate, new Date())) {
    showEditDateConfirmation(note, selectedModificationDate, options);
    return;
  }

  if (announcesContentModification && initialDone) {
    const shouldContinue = window.confirm("Cette modification sera signalée. La consigne perdra son statut Soldé.");
    if (!shouldContinue) {
      return;
    }
  }

  if (priorityChanged) {
    ensureInitialRevision(revisions, note);
    patch.priorityRawValue = priority || deleteField();
    revisions.push({
      id: crypto.randomUUID(),
      author: currentDisplayName(),
      authorIdentifier: state.currentUser.id,
      date: textChanged ? priorityRevisionDate : now,
      text: combinedNoteText(note.title, note.text),
      isVisibleToOthers: false,
      previousPriorityRawValue: note.priority || "",
      newPriorityRawValue: priority || ""
    });
  }

  if (destinationChanged) {
    patch.isGeneral = destination.isGeneral;
    patch.simulatorNamesStorage = destination.simulatorNames.join("\n");
    ensureInitialRevision(revisions, note);
    revisions.push({
      id: crypto.randomUUID(),
      author: currentDisplayName(),
      authorIdentifier: state.currentUser.id,
      date: destinationRevisionDate,
      text: combinedNoteText(note.title, note.text),
      isVisibleToOthers: false,
      previousDestinationStorage: destinationStorage(note.isGeneral, note.simulatorNames),
      newDestinationStorage: destinationStorage(destination.isGeneral, destination.simulatorNames)
    });
  }

  if (textChanged) {
    ensureInitialRevision(revisions, note);
    patch.title = title;
    patch.text = text;
    if (note.regulatoryPlanningMirror) {
      patch.regulatoryPlanningMirrorSource = "note";
    }
    revisions.push({
      id: crypto.randomUUID(),
      author: currentDisplayName(),
      authorIdentifier: state.currentUser.id,
      date: modificationDate,
      text: combinedNoteText(title, text),
      isVisibleToOthers: announcesContentModification
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

  if (doneChanged || (announcesContentModification && initialDone)) {
    const nextDone = announcesContentModification && initialDone ? false : draftDone;
    const completionDate = nextDone
      ? dateWithTime(selectedDoneDate, now)
      : now;
    const doneUpdate = updatedCompletionState(note, context, nextDone, completionDate, selectedDoneDate, now);
    patch.completedContextsStorage = doneUpdate.completedContexts.join("\n");
    patch.completionHistoryData = doneUpdate.completions.length ? encodeRecordArray(doneUpdate.completions) : deleteField();
    patch.completionCancellationHistoryData = doneUpdate.completionCancellations.length ? encodeRecordArray(doneUpdate.completionCancellations) : deleteField();
  }

  if (acknowledgementChanged && !announcesContentModification) {
    const acknowledgementUpdate = updatedAcknowledgementState(note, context, draftAcknowledged, now);
    patch.acknowledgementHistoryData = acknowledgementUpdate.length ? encodeRecordArray(acknowledgementUpdate) : deleteField();
  }

  patch.revisionHistoryData = revisions.length ? encodeRecordArray(revisions) : deleteField();

  if (handwritingClearChanged) {
    patch.handwritingData = deleteField();
    patch.handwritingPreviewImageData = deleteField();
    patch.handwritingAuthorIdentifier = deleteField();
    patch.handwritingClearedAt = now;
  }

  state.isSaving = true;
  refreshDetail();
  try {
    if (shouldDetachContextModification(note, context, textChanged, destinationChanged)) {
      await detachContextModification(note, context, {
        patch,
        title,
        text,
        richTextHTML,
        priority,
        displayDate,
        revisions,
        modificationDate,
        contentModifiedAt: announcesContentModification ? modificationDate : note.contentModifiedAt,
        doneChanged,
        selectedDoneDate,
        initialDone,
        draftDone,
        acknowledgementChanged,
        draftAcknowledged,
        announcesContentModification,
        handwritingClearChanged,
        now
      });
    } else {
      await updateNote(note.id, patch);
      if (textChanged) {
        await syncPlanningNotesFromMirrorNoteIfNeeded(note, text);
      }
      await recordNoteEditActivity(note, context, {
        textChanged,
        richTextChanged,
        dateChanged,
        priorityChanged,
        destinationChanged,
        doneChanged,
        draftDone,
        acknowledgementChanged,
        draftAcknowledged
      });
    }
    if (handwritingClearChanged) {
      await deleteHandwritingNotesForNote(note.id, state.pendingHandwritingClear.documentID);
      removeLocalHandwritingNotesForNote(note.id, state.pendingHandwritingClear.documentID);
    }
    state.pendingHandwritingClear = null;
    closeDetail();
  } finally {
    state.isSaving = false;
    refreshDetail();
  }
}

function shouldDetachContextModification(note, context, textChanged, destinationChanged) {
  return textChanged
    && !destinationChanged
    && context !== generalName
    && !note.isGeneral
    && note.simulatorNames.length > 1
    && note.simulatorNames.includes(context);
}

async function detachContextModification(note, context, draft) {
  const remainingSimulators = note.simulatorNames.filter((name) => name !== context);
  const currentContextCompletions = contextRecords(note.completions, context);
  const currentContextCompletionCancellations = contextRecords(note.completionCancellations, context);
  const currentContextCompletedKeys = contextCompletionKeys(note.completedContexts, context);
  const currentContextAcknowledgements = draft.announcesContentModification
    ? []
    : contextRecords(note.acknowledgements, context);

  let detachedCompletions = currentContextCompletions;
  let detachedCompletionCancellations = currentContextCompletionCancellations;
  let detachedCompletedKeys = currentContextCompletedKeys;
  if (draft.doneChanged || (draft.announcesContentModification && draft.initialDone)) {
    const nextDone = draft.announcesContentModification && draft.initialDone ? false : draft.draftDone;
    const completionDate = draft.doneChanged && nextDone
      ? dateWithTime(draft.selectedDoneDate || state.selectedDate, draft.now)
      : draft.now;
    const doneUpdate = updatedCompletionState(note, context, nextDone, completionDate, draft.selectedDoneDate || state.selectedDate, draft.now);
    detachedCompletions = contextRecords(doneUpdate.completions, context);
    detachedCompletionCancellations = contextRecords(doneUpdate.completionCancellations, context);
    detachedCompletedKeys = contextCompletionKeys(doneUpdate.completedContexts, context);
  }

  let detachedAcknowledgements = currentContextAcknowledgements;
  if (draft.acknowledgementChanged && !draft.announcesContentModification) {
    detachedAcknowledgements = contextRecords(updatedAcknowledgementState(note, context, draft.draftAcknowledged, draft.now), context);
  }

  const detachedID = crypto.randomUUID().toUpperCase();
  const detachedPayload = {
    id: detachedID,
    title: draft.title,
    text: draft.text,
    author: note.author,
    authorIdentifier: note.authorIdentifier,
    createdAt: note.createdAt || draft.now,
    updatedAt: draft.now,
    contentModifiedAt: draft.contentModifiedAt || null,
    deletedAt: note.deletedAt || null,
    deletedBy: note.deletedBy || "",
    deletedByIdentifier: note.deletedByIdentifier || "",
    displayDate: draft.patch.displayDate || note.displayDate,
    firstDisplayDate: draft.patch.firstDisplayDate || note.firstDisplayDate || note.displayDate,
    isGeneral: false,
    simulatorNamesStorage: context,
    richTextHTML: draft.richTextHTML || "",
    richTextData: note.richTextData || "",
    priorityRawValue: draft.priority || "",
    handwritingData: draft.handwritingClearChanged ? "" : note.handwritingData || "",
    handwritingPreviewImageData: draft.handwritingClearChanged ? "" : note.handwritingPreviewImageData || "",
    handwritingAuthorIdentifier: draft.handwritingClearChanged ? "" : note.handwritingAuthorIdentifier || "",
    handwritingClearedAt: draft.handwritingClearChanged ? draft.now : note.handwritingClearedAt || null,
    completedContextsStorage: detachedCompletedKeys.join("\n"),
    completionHistoryData: detachedCompletions.length ? encodeRecordArray(detachedCompletions) : "",
    completionCancellationHistoryData: detachedCompletionCancellations.length ? encodeRecordArray(detachedCompletionCancellations) : "",
    acknowledgementHistoryData: detachedAcknowledgements.length ? encodeRecordArray(detachedAcknowledgements) : "",
    revisionHistoryData: draft.revisions.length ? encodeRecordArray(draft.revisions) : "",
    searchKeywords: searchKeywordsForNote({ title: draft.title, text: draft.text })
  };
  Object.assign(detachedPayload, handoverIndexFields({
    ...detachedPayload,
    simulatorNames: [context],
    priority: draft.priority,
    deletedAt: note.deletedAt || null,
    contentModifiedAt: draft.contentModifiedAt || null,
    completedContexts: detachedCompletedKeys,
    completions: detachedCompletions,
    completionCancellations: detachedCompletionCancellations,
    revisions: draft.revisions,
    acknowledgements: detachedAcknowledgements
  }));

  const originalPatch = {
    updatedAt: draft.now,
    simulatorNamesStorage: remainingSimulators.join("\n"),
    completedContextsStorage: note.completedContexts.filter((key) => !isCompletionKeyForContext(key, context)).join("\n"),
    completionHistoryData: withoutContextRecords(note.completions, context).length
      ? encodeRecordArray(withoutContextRecords(note.completions, context))
      : deleteField(),
    completionCancellationHistoryData: withoutContextRecords(note.completionCancellations, context).length
      ? encodeRecordArray(withoutContextRecords(note.completionCancellations, context))
      : deleteField(),
    acknowledgementHistoryData: withoutContextRecords(note.acknowledgements, context).length
      ? encodeRecordArray(withoutContextRecords(note.acknowledgements, context))
      : deleteField()
  };
  Object.assign(originalPatch, handoverIndexFields(noteWithPatchForIndex(note, originalPatch)));

  setStatus("Enregistrement...");
  await Promise.all([
    updateDoc(doc(db, "handoverNotes", note.id), originalPatch),
    setDoc(doc(db, "handoverNotes", detachedID), detachedPayload)
  ]);
  await recordNoteEditActivity(detachedPayload, context, {
    textChanged: true,
    richTextChanged: Boolean(draft.richTextHTML !== (note.richTextHTML || "")),
    dateChanged: Boolean(draft.patch.displayDate),
    priorityChanged: draft.priority !== note.priority,
    destinationChanged: false,
    doneChanged: draft.doneChanged,
    draftDone: draft.draftDone,
    acknowledgementChanged: draft.acknowledgementChanged,
    draftAcknowledged: draft.draftAcknowledged
  });
  setStatus("Données synchronisées");
}

function contextRecords(records, context) {
  return records.filter((record) => record.context === context);
}

function withoutContextRecords(records, context) {
  return records.filter((record) => record.context !== context);
}

function contextCompletionKeys(keys, context) {
  return keys.filter((key) => isCompletionKeyForContext(key, context));
}

function isCompletionKeyForContext(key, context) {
  return key === context || key.startsWith(`${context}#`);
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
  const restoredText = restoredRevisionText(previousRevision?.text || "", note);
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

  if (latestRevision.previousDestinationStorage || latestRevision.newDestinationStorage) {
    const restoredDestination = destinationNamesFromStorage(latestRevision.previousDestinationStorage);
    const isGeneralDestination = restoredDestination.length === 1 && normalizeKey(restoredDestination[0]) === normalizeKey(generalName);
    patch.isGeneral = isGeneralDestination;
    patch.simulatorNamesStorage = isGeneralDestination ? "" : restoredDestination.join("\n");
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

function restoredRevisionText(revisionText, currentNote) {
  const currentTitle = stringValue(currentNote?.title).trim();
  const fullText = stringValue(revisionText).trim();
  if (!currentTitle) {
    return { title: "", text: fullText };
  }

  return splitRevisionText(fullText);
}

function collectDetailDestination(fallbackContext) {
  const selectedPillNames = [...elements.detailBody.querySelectorAll("[data-simulator-pill][data-selected='true']")]
    .map((pill) => decodeURIComponent(pill.dataset.simulatorName))
    .filter(Boolean);
  const checkedInputNames = [...elements.detailBody.querySelectorAll("[data-simulator-name]:checked")]
    .map((input) => decodeURIComponent(input.dataset.simulatorName))
    .filter(Boolean);
  const checkedNames = selectedPillNames.length ? selectedPillNames : checkedInputNames;
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
  const allowedColors = new Set(["#ffd51f", "#2f80ed", "#ef2f24", "#ffffff", "#111111"]);

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
    if (r <= 95 && g >= 160 && b <= 120) return "#2f80ed";
    if (r >= 210 && g <= 95 && b <= 90) return "#ef2f24";
  }

  if (r >= 245 && g >= 245 && b >= 245) {
    return "#ffffff";
  }
  if (r <= 40 && g <= 40 && b <= 40) {
    return "#111111";
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

  const channels = rgb[1]
    .replace(/\s*\/\s*/g, " ")
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean)
    .slice(0, 3)
    .map(parseCssColorChannel);
  if (channels.length < 3 || channels.slice(0, 3).some((channel) => Number.isNaN(channel))) {
    return null;
  }

  return {
    r: clampColorChannel(channels[0]),
    g: clampColorChannel(channels[1]),
    b: clampColorChannel(channels[2])
  };
}

function parseCssColorChannel(value) {
  const channel = String(value).trim();
  if (channel.endsWith("%")) {
    return Number.parseFloat(channel) * 2.55;
  }

  return Number.parseFloat(channel);
}

function clampColorChannel(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
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

function destinationStorage(isGeneral, simulatorNames) {
  return isGeneral ? generalName : uniqueStrings(simulatorNames || []).join("\n");
}

function destinationNamesFromStorage(storage) {
  const value = stringValue(storage).trim();
  if (!value || normalizeKey(value) === normalizeKey(generalName)) {
    return [generalName];
  }

  const names = value.split("\n").map((name) => name.trim()).filter(Boolean);
  return names.length ? uniqueStrings(names) : [generalName];
}

function destinationLabelFromStorage(storage) {
  return destinationNamesFromStorage(storage).join(", ");
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

function activeCompletions(note) {
  return note.completions.filter((completion) => !isCompletionCancelled(note, completion));
}

function handoverIndexFields(note) {
  const syncState = note.deletedAt
    ? "deleted"
    : activeCompletions(note).length > 0 ? "archived" : "active";
  const relevantDate = lastRealtimeRelevantDate(note);
  const realtimeActiveUntil = syncState === "active"
    ? activeRealtimeUntil
    : addDays(relevantDate, archiveRealtimeRetentionDays);

  return {
    syncState,
    lastRealtimeRelevantAt: relevantDate,
    realtimeActiveUntil
  };
}

function searchKeywordsForNote(note) {
  const normalizedText = normalizeSearchText(`${note.title || ""} ${note.text || ""}`);
  const tokens = normalizedText
    .split(/[^\p{L}\p{N}]+/u)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
  const keywords = new Set();

  for (const token of tokens) {
    keywords.add(token);
    const prefixLimit = Math.min(token.length, 24);
    for (let length = 2; length <= prefixLimit; length += 1) {
      keywords.add(token.slice(0, length));
    }
    if (keywords.size >= 500) {
      break;
    }
  }

  return Array.from(keywords).slice(0, 500);
}

function searchQueryKeywords(searchText) {
  return uniqueStrings(stringValue(searchText)
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean)
    .map((term) => normalizeSearchText(term))
    .filter((term) => term.length >= 2))
    .slice(0, 10);
}

function noteWithPatchForIndex(note, patch) {
  const value = (key, fallback, deletedFallback = null) => {
    if (!Object.prototype.hasOwnProperty.call(patch, key)) {
      return fallback;
    }

    return isDeleteFieldSentinel(patch[key]) ? deletedFallback : patch[key];
  };

  return {
    ...note,
    title: value("title", note.title, ""),
    text: value("text", note.text, ""),
    richTextHTML: value("richTextHTML", note.richTextHTML, ""),
    richTextData: value("richTextData", note.richTextData, ""),
    author: value("author", note.author, ""),
    updatedAt: value("updatedAt", note.updatedAt, null),
    syncState: value("syncState", note.syncState, ""),
    lastRealtimeRelevantAt: value("lastRealtimeRelevantAt", note.lastRealtimeRelevantAt, null),
    realtimeActiveUntil: value("realtimeActiveUntil", note.realtimeActiveUntil, null),
    displayDate: value("displayDate", note.displayDate, note.displayDate),
    firstDisplayDate: value("firstDisplayDate", note.firstDisplayDate, note.firstDisplayDate),
    deletedAt: value("deletedAt", note.deletedAt, null),
    contentModifiedAt: value("contentModifiedAt", note.contentModifiedAt, null),
    priority: value("priorityRawValue", note.priority, ""),
    simulatorNames: Object.prototype.hasOwnProperty.call(patch, "simulatorNamesStorage")
      ? stringValue(value("simulatorNamesStorage", note.simulatorNames.join("\n"), "")).split("\n").map((name) => name.trim()).filter(Boolean)
      : note.simulatorNames,
    completedContexts: Object.prototype.hasOwnProperty.call(patch, "completedContextsStorage")
      ? stringValue(value("completedContextsStorage", note.completedContexts.join("\n"), "")).split("\n").map((name) => name.trim()).filter(Boolean)
      : note.completedContexts,
    completions: Object.prototype.hasOwnProperty.call(patch, "completionHistoryData")
      ? decodeRecordArray(isDeleteFieldSentinel(patch.completionHistoryData) ? "" : patch.completionHistoryData)
      : note.completions,
    completionCancellations: Object.prototype.hasOwnProperty.call(patch, "completionCancellationHistoryData")
      ? decodeRecordArray(isDeleteFieldSentinel(patch.completionCancellationHistoryData) ? "" : patch.completionCancellationHistoryData)
      : note.completionCancellations,
    acknowledgements: Object.prototype.hasOwnProperty.call(patch, "acknowledgementHistoryData")
      ? decodeRecordArray(isDeleteFieldSentinel(patch.acknowledgementHistoryData) ? "" : patch.acknowledgementHistoryData)
      : note.acknowledgements,
    revisions: Object.prototype.hasOwnProperty.call(patch, "revisionHistoryData")
      ? decodeRecordArray(isDeleteFieldSentinel(patch.revisionHistoryData) ? "" : patch.revisionHistoryData)
      : note.revisions,
    handwritingData: value("handwritingData", note.handwritingData, ""),
    handwritingPreviewImageData: value("handwritingPreviewImageData", note.handwritingPreviewImageData, ""),
    handwritingAuthorIdentifier: value("handwritingAuthorIdentifier", note.handwritingAuthorIdentifier, ""),
    handwritingClearedAt: value("handwritingClearedAt", note.handwritingClearedAt, null)
  };
}

function isDeleteFieldSentinel(value) {
  return Boolean(value)
    && typeof value === "object"
    && (
      value._methodName === "deleteField"
      || value.constructor?.name === "DeleteFieldValueImpl"
      || String(value).includes("deleteField")
    );
}

function lastRealtimeRelevantDate(note) {
  const dates = [
    note.displayDate,
    latestContentModificationDate(note),
    note.contentModifiedAt,
    note.deletedAt,
    ...activeCompletions(note).flatMap((completion) => [completion.date, completion.recordedDate]),
    ...note.completionCancellations.map((cancellation) => cancellation.date)
  ].filter((date) => date instanceof Date && !Number.isNaN(date.getTime()));

  return dates.sort((a, b) => b - a)[0] || note.updatedAt || note.createdAt || new Date();
}

function timelineCompletions(note) {
  return note.completions.filter((completion) => {
    return !note.completionCancellations.some((cancellation) => {
      return cancellation.isVisibleInTimeline === false && completionCancellationMatches(cancellation, completion);
    });
  });
}

function isCompletionCancelled(note, completion) {
  return note.completionCancellations.some((cancellation) => {
    return completionCancellationMatches(cancellation, completion);
  });
}

function completionCancellationMatches(cancellation, completion) {
  if (cancellation.completionID && normalizeKey(cancellation.completionID) === normalizeKey(completion.id)) {
    return true;
  }

  if (cancellation.completionID) {
    return false;
  }

  return cancellation.context === completion.context
    && sameDay(cancellation.completionDate, completion.date)
    && normalizeKey(cancellation.completedByIdentifier || cancellation.completedBy) === normalizeKey(completion.authorIdentifier || completion.author);
}

function completionCancellationsAfterRemoval(note, removedCompletions, context, now) {
  const currentKey = normalizeKey(state.currentUser?.id || currentDisplayName());
  const originalCompletion = [...removedCompletions]
    .sort((a, b) => (b.recordedDate || b.date || 0) - (a.recordedDate || a.date || 0))
    [0];

  if (!originalCompletion) {
    return note.completionCancellations;
  }

  const completionKey = normalizeKey(originalCompletion.authorIdentifier || originalCompletion.author);
  const shouldShowInTimeline = Boolean(currentKey && currentKey !== completionKey);

  return [...note.completionCancellations, {
    id: crypto.randomUUID(),
    context,
    author: currentDisplayName(),
    authorIdentifier: state.currentUser.id,
    date: now,
    completionID: originalCompletion.id,
    completedBy: originalCompletion.author,
    completedByIdentifier: originalCompletion.authorIdentifier || "",
    completionDate: originalCompletion.date,
    isVisibleInTimeline: shouldShowInTimeline
  }];
}

function updatedCompletionState(note, context, shouldBeDone, completionDate, completionDay = state.selectedDate, recordedDate = new Date()) {
  const key = completionStorageKey(context, completionDay);
  const hasCompletion = activeCompletions(note).some((completion) => completion.context === context && sameDay(completion.date, completionDay));
  const removedCompletions = shouldBeDone
    ? []
    : activeCompletions(note).filter((completion) => completion.context === context && sameDay(completion.date, completionDay));
  const completions = shouldBeDone && !hasCompletion
    ? [...note.completions, {
        id: crypto.randomUUID(),
        context,
        author: currentDisplayName(),
        authorIdentifier: state.currentUser.id,
        date: completionDate,
        recordedDate
      }]
    : note.completions;
  const completionCancellations = shouldBeDone
    ? note.completionCancellations
    : completionCancellationsAfterRemoval(note, removedCompletions, context, recordedDate);
  const completedContexts = shouldBeDone
    ? uniqueStrings([...note.completedContexts, key])
    : note.completedContexts.filter((entry) => entry !== key);

  return { completions, completionCancellations, completedContexts };
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
  const existingNote = state.notes.find((note) => note.id === noteID);
  const indexedPatch = existingNote
    ? { ...patch, ...handoverIndexFields(noteWithPatchForIndex(existingNote, patch)) }
    : patch;
  if (existingNote && (Object.prototype.hasOwnProperty.call(patch, "title") || Object.prototype.hasOwnProperty.call(patch, "text"))) {
    indexedPatch.searchKeywords = searchKeywordsForNote(noteWithPatchForIndex(existingNote, patch));
  }
  await updateDoc(doc(db, "handoverNotes", noteID), indexedPatch);
  if (existingNote) {
    const updatedNote = noteWithPatchForIndex(existingNote, indexedPatch);
    state.fetchedNotesByID.set(noteID, updatedNote);
    state.notes = Array.from(new Map(state.notes.map((note) => [note.id, note])).set(noteID, updatedNote).values());
    renderSimulators();
    render();
  }
  setStatus("Données synchronisées");
}

async function syncPlanningNotesFromMirrorNoteIfNeeded(note, nextText) {
  if (!note?.regulatoryPlanningMirror || !note.regulatoryPlanningEventID) {
    return;
  }

  const response = await syncRegulatoryPlanningNotesFromMirrorNote({
    noteID: note.id,
    notes: nextText
  });
  const planningEventID = stringValue(response?.data?.planningEventID, note.regulatoryPlanningEventID);
  const notes = stringValue(response?.data?.notes, nextText);
  const row = state.planningRows.find((candidate) => candidate.id === planningEventID);
  if (row) {
    row.notes = notes;
    savePlanningRowsLocal();
    if (state.activeView === "planning") {
      renderPlanningTable();
    }
  }
}

async function resyncNoteForOlderDevices(note) {
  if (state.currentUser?.role !== "admin" || state.isSaving) {
    return;
  }

  state.isSaving = true;
  try {
    await updateNote(note.id, { updatedAt: new Date() });
    setStatus("Consigne republiée pour les iPhone");
  } catch (error) {
    setStatus(`Resynchronisation impossible : ${error.message}`);
  } finally {
    state.isSaving = false;
  }
}

function noteBelongsToContext(note, context) {
  if (context === generalName) {
    return note.isGeneral;
  }

  const contextKey = normalizeKey(context);
  return note.simulatorNames.some((name) => normalizeKey(name) === contextKey);
}

function contextDisplayNotes(notes, context) {
  const notesByID = new Map();
  notes
    .filter((note) => noteBelongsToContext(note, context))
    .forEach((note) => {
      if (!notesByID.has(note.id)) {
        notesByID.set(note.id, note);
      }
    });

  return [...groupBy([...notesByID.values()], (note) => handoverOriginKey(note)).values()]
    .map((group) => group.sort((first, second) => compareOriginSiblingNotes(first, second, context))[0])
    .filter(Boolean);
}

function compareOriginSiblingNotes(first, second, context) {
  const firstIsSpecific = isContextSpecificDetachedNote(first, context);
  const secondIsSpecific = isContextSpecificDetachedNote(second, context);
  if (firstIsSpecific !== secondIsSpecific) {
    return firstIsSpecific ? -1 : 1;
  }

  const firstContextCount = first.isGeneral ? 0 : first.simulatorNames.length;
  const secondContextCount = second.isGeneral ? 0 : second.simulatorNames.length;
  if (firstContextCount !== secondContextCount) {
    return firstContextCount - secondContextCount;
  }

  const firstActivityTime = (latestContentModificationDate(first) || first.updatedAt || new Date(0)).getTime();
  const secondActivityTime = (latestContentModificationDate(second) || second.updatedAt || new Date(0)).getTime();
  if (firstActivityTime !== secondActivityTime) {
    return secondActivityTime - firstActivityTime;
  }

  const firstUpdatedTime = (first.updatedAt || new Date(0)).getTime();
  const secondUpdatedTime = (second.updatedAt || new Date(0)).getTime();
  if (firstUpdatedTime !== secondUpdatedTime) {
    return secondUpdatedTime - firstUpdatedTime;
  }

  return stringValue(first.id).localeCompare(stringValue(second.id), "fr");
}

function isContextSpecificDetachedNote(note, context) {
  if (context === generalName) {
    return note.isGeneral;
  }

  return !note.isGeneral && note.simulatorNames.length === 1 && noteBelongsToContext(note, context);
}

function handoverOriginKey(note) {
  const authorKey = normalizeKey(note.authorIdentifier || note.author);
  const createdAt = note.createdAt || new Date(0);
  const createdAtKey = (createdAt.getTime() / 1000).toFixed(3);
  const firstDisplayDate = note.firstDisplayDate || note.displayDate || createdAt;
  return [authorKey, createdAtKey, isoDate(startOfDay(firstDisplayDate))].join("|");
}

function matchesSelection(note, context, options = {}) {
  if (state.showTagged && options.includeTaggedFilter !== false && !matchesTaggedFilter(note, context)) {
    return false;
  }

  if (state.search) {
    if (state.showOnlyDeleted && state.currentUser?.role === "admin") {
      return Boolean(note.deletedAt) && state.showDeleted && canCurrentUserViewDeletedNote(note);
    }

    return !note.deletedAt || canCurrentUserViewDeletedNote(note);
  }

  if (!options.includeDeleted && !shouldShowDeletedNote(note)) {
    return false;
  }

  if (!options.includeAcknowledged && isAcknowledgedHidden(note, context) && !(state.showTagged && matchesTaggedFilter(note, context))) {
    return false;
  }

  if (state.showOnlyDeleted && state.currentUser?.role === "admin") {
    return Boolean(note.deletedAt) && state.showDeleted && canCurrentUserViewDeletedNote(note);
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
  if (state.showOnlyDeleted && state.currentUser?.role === "admin") {
    return Boolean(note.deletedAt) && state.showDeleted && canCurrentUserViewDeletedNote(note);
  }

  if (!note.deletedAt) {
    return true;
  }

  return state.showDeleted && canCurrentUserViewDeletedNote(note);
}

function matchesPeriodSelection(note, context) {
  if (isEventActiveForCurrentView(noteCreationNewEventDate(note))) {
    return true;
  }

  if (contentModificationDates(note).some((modificationDate) => {
    return isEventActiveForCurrentView(modificationDate);
  })) {
    return true;
  }

  return completionDatesInContext(note, context).some((completionDate) => isDateInPeriod(completionDate));
}

function isAcknowledgedHidden(note, context) {
  return !isPeriodResultsMode()
    && !state.showAcknowledged
    && !isDoneInContext(note, context)
    && isAcknowledgedInContext(note, context)
    && !hasContentModificationAfterAcknowledgement(note, context);
}

function matchesSearch(note) {
  const terms = searchTerms();

  if (terms.length === 0) {
    return true;
  }

  const haystack = normalizeSearchText(`${note.title} ${note.text}`);
  return terms.some((term) => haystack.includes(normalizeSearchText(term)));
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

function compareNotesForContext(a, b, context) {
  if (state.search) {
    return compareSearchNotes(a, b);
  }

  if (isPeriodResultsMode()) {
    return comparePeriodNotes(a, b);
  }

  const priorityRankA = displayPriorityRank(a, context);
  const priorityRankB = displayPriorityRank(b, context);
  if (priorityRankA !== priorityRankB) {
    return priorityRankA - priorityRankB;
  }

  return compareNotes(a, b);
}

function comparePeriodNotes(a, b) {
  const activityDateA = periodSortingActivityDate(a)?.getTime() || 0;
  const activityDateB = periodSortingActivityDate(b)?.getTime() || 0;
  if (activityDateA !== activityDateB) {
    return activityDateB - activityDateA;
  }

  return (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)
    || String(a.id || "").localeCompare(String(b.id || ""), "fr");
}

function compareSearchNotes(a, b) {
  const assignmentDateA = firstAssignmentDate(a)?.getTime() || 0;
  const assignmentDateB = firstAssignmentDate(b)?.getTime() || 0;
  if (assignmentDateA !== assignmentDateB) {
    return assignmentDateB - assignmentDateA;
  }

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

function periodActivityDate(note, context) {
  const range = selectedPeriodRange();
  if (!range) {
    return noteSortingActivityDate(note);
  }

  const modificationDate = [...contentModificationDates(note)]
    .reverse()
    .find((date) => isDateInPeriod(date));
  if (modificationDate) {
    return modificationDate;
  }

  const completionDate = [...completionDatesInContext(note, context)]
    .reverse()
    .find((date) => isDateInPeriod(date));
  if (completionDate) {
    return completionDate;
  }

  const assignmentDate = firstAssignmentDate(note);
  if (assignmentDate && isDateInPeriod(assignmentDate)) {
    return assignmentDate;
  }

  return noteSortingActivityDate(note);
}

function periodSortingActivityDate(note) {
  const range = selectedPeriodRange();
  if (!range) {
    return noteSortingActivityDate(note);
  }

  const periodDates = [
    ...contentModificationDates(note),
    ...activeCompletions(note).map((completion) => completion.date).filter(Boolean),
    firstAssignmentDate(note)
  ].filter((date) => date && isDateInPeriod(date));

  return periodDates.sort((a, b) => b - a)[0] || noteSortingActivityDate(note);
}

function completionDatesInContext(note, context) {
  return activeCompletions(note)
    .filter((completion) => completion.context === context && completion.date)
    .map((completion) => completion.date)
    .sort((a, b) => a - b);
}

function isDailyTagged(noteID) {
  const tagDate = isoDate(state.selectedDate);
  return state.dailyTags.some((tag) => tag.noteID === noteID && tag.tagDate === tagDate);
}

function matchesTaggedFilter(note, context) {
  return isDailyTagged(note.id)
    || Boolean(note.priority)
    || isDoneBadgeVisibleInContext(note, context)
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
  if (activeCompletions(note).some((completion) => completion.context === context && sameDay(completion.date, state.selectedDate))) {
    return true;
  }

  return note.completedContexts.includes(completionStorageKey(context, state.selectedDate));
}

function isDoneBadgeVisibleInContext(note, context) {
  return activeCompletions(note).some((completion) => {
    return completion.context === context && isEventActiveForCurrentView(completion.date);
  }) || note.completedContexts.some((key) => {
    const completionDate = completionStorageKeyDate(key, context);
    return completionDate && isEventActiveForCurrentView(completionDate);
  }) || isDoneInContext(note, context);
}

function visibleCompletionDayInContext(note, context, fallbackDay = state.selectedDate) {
  const selectedDayCompletion = activeCompletions(note).find((completion) => {
    return completion.context === context && sameDay(completion.date, state.selectedDate);
  });
  if (selectedDayCompletion?.date) {
    return startOfDay(selectedDayCompletion.date);
  }

  const visibleCompletion = activeCompletions(note)
    .filter((completion) => completion.context === context && isEventActiveForCurrentView(completion.date))
    .sort((left, right) => (right.date || 0) - (left.date || 0))
    [0];
  if (visibleCompletion?.date) {
    return startOfDay(visibleCompletion.date);
  }

  const visibleCompletionKeyDate = note.completedContexts
    .map((key) => completionStorageKeyDate(key, context))
    .filter((date) => date && isEventActiveForCurrentView(date))
    .sort((left, right) => right - left)
    [0];
  return startOfDay(visibleCompletionKeyDate || fallbackDay);
}

function completionStorageKeyDate(key, context) {
  const prefix = `${context}#`;
  if (!stringValue(key).startsWith(prefix)) {
    return null;
  }

  const [year, month, day] = stringValue(key).slice(prefix.length).split("-").map(Number);
  if (!year || !month || !day) {
    return null;
  }

  return startOfDay(new Date(year, month - 1, day));
}

function isCompletedBefore(note, day, context) {
  return activeCompletions(note).some((completion) => completion.context === context && startOfDay(completion.date) < startOfDay(day));
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
  const foldedRevisionIds = foldedInitialAuthorRevisionIds(note);
  return note.revisions
    .slice(1)
    .filter((revision) => revision.date)
    .filter((revision) => {
      return isPublicContentRevision(revision)
        && !foldedRevisionIds.has(revision.id);
    })
    .map((revision) => revision.date)
    .sort((a, b) => a - b);
}

function dailyModificationDiffHTML(note, showsActiveModificationNew = false) {
  if (isPeriodResultsMode()) {
    return "";
  }

  let revisionPair = latestContentRevisionPairOnDay(note, state.selectedDate);
  if (!revisionPair && showsActiveModificationNew) {
    const modificationDate = latestContentModificationDate(note);
    if (modificationDate) {
      revisionPair = latestContentRevisionPairOnDay(note, modificationDate);
    }
  }

  if (!revisionPair || revisionPair.previousText === revisionPair.revision.text) {
    return "";
  }

  if (revisionPair.hasPublicRevision && !isEventActiveForCurrentView(revisionPair.latestPublicRevision.date)) {
    return "";
  }

  return revisionPair.hasPublicRevision
    ? renderCumulativeDailyTextDiff(revisionPair.revisions, note)
    : escapeHtml(revisionPair.revision.text);
}

function latestContentRevisionPairOnDay(note, day) {
  const foldedRevisionIds = foldedInitialAuthorRevisionIds(note);
  const selectedDay = startOfDay(day);
  const revisions = [];

  for (let index = 1; index < note.revisions.length; index += 1) {
    const revision = note.revisions[index];
    if (!revision.date || !sameDay(revision.date, selectedDay)) {
      continue;
    }

    if (!isContentRevision(revision) || foldedRevisionIds.has(revision.id)) {
      continue;
    }

    const revisionPair = {
      revision,
      previousText: note.revisions[index - 1]?.text || ""
    };

    revisions.push(revisionPair);
  }

  const latestRevision = revisions.at(-1);
  if (!latestRevision) {
    return null;
  }

  return {
    revision: latestRevision.revision,
    previousText: revisions[0].previousText,
    revisions,
    hasPublicRevision: revisions.some((entry) => isPublicContentRevision(entry.revision)),
    latestPublicRevision: revisions.filter((entry) => isPublicContentRevision(entry.revision)).at(-1)?.revision || null
  };
}

function isContentRevision(revision) {
  return !revision.previousDisplayDate
    && !revision.newDisplayDate
    && !revision.previousPriorityRawValue
    && !revision.newPriorityRawValue
    && !revision.previousDestinationStorage
    && !revision.newDestinationStorage;
}

function noteCreationNewEventDate(note) {
  return dateWithTime(note.firstDisplayDate || note.displayDate || note.createdAt, note.createdAt);
}

function firstAssignmentDate(note) {
  return startOfDay(note.firstDisplayDate || note.displayDate || note.createdAt || new Date());
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

function renderAgeBadge(noteID, carryOver, modificationTitle, isTagged, isUrgentOverdue = false) {
  return `
    <span class="age-badge" title="Appui long pour taguer la consigne">
      <span class="age-badge-part age-created${isUrgentOverdue ? " age-created-urgent" : ""}" data-tag-note-id="${escapeAttribute(noteID)}">J+${carryOver}</span>
      ${modificationTitle ? `<span class="age-badge-part age-modified" data-tag-note-id="${escapeAttribute(noteID)}">${modificationTitle}</span>` : ""}
      ${isTagged ? `<span class="age-badge-part age-tagged" data-tag-note-id="${escapeAttribute(noteID)}">⚑</span>` : ""}
    </span>
  `;
}

function renderNewAgeBadge(noteID, isTagged, isDone = false) {
  return `
    <span class="age-badge age-badge-new${isDone ? " age-badge-done" : ""}" title="Appui long pour taguer la consigne">
      <span class="age-badge-part age-new${isDone ? " age-new-done" : ""}" data-tag-note-id="${escapeAttribute(noteID)}">NEW</span>
      ${isTagged ? `<span class="age-badge-part age-tagged" data-tag-note-id="${escapeAttribute(noteID)}">⚑</span>` : ""}
    </span>
  `;
}

function timelineEvents(note, context) {
  const sortedRevisions = timelineRevisionsForCurrentUser(note);
  const creationRevision = effectiveCreationRevision(note);
  const events = [{
    date: creationRevision.date || note.createdAt || note.firstDisplayDate || note.displayDate,
    title: "Creation",
    author: creationRevision.author || note.author,
    authorIdentifier: creationRevision.authorIdentifier || creationRevision.author || note.authorIdentifier || note.author,
    detail: creationAssignmentDetail(note),
    kind: "creation",
    hasDisclosure: true
  }];

  let previousRevisionText = stringValue(creationRevision.text).trim() || creationTextForNote(note);

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

  for (const completion of timelineCompletions(note).filter((record) => record.context === context)) {
    events.push({
      date: completion.recordedDate || completion.date,
      title: "Soldé",
      author: completion.author,
      authorIdentifier: completion.authorIdentifier || completion.author,
      detail: completionAssignmentDetail(completion),
      kind: "completion",
      hasDisclosure: false
    });
  }

  for (const cancellation of note.completionCancellations.filter((record) => record.context === context && record.isVisibleInTimeline !== false)) {
    events.push({
      date: cancellation.date,
      title: "Annulation Soldé",
      author: cancellation.author,
      authorIdentifier: cancellation.authorIdentifier || cancellation.author,
      kind: "completion-cancellation",
      hasDisclosure: false
    });
  }

  for (const acknowledgement of visibleTimelineAcknowledgements(note, context)) {
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

  const datedEvents = events.filter((event) => event.date);
  const creationEvents = datedEvents.filter((event) => event.kind === "creation");
  const timelineEventsAfterCreation = datedEvents
    .filter((event) => event.kind !== "creation")
    .sort((a, b) => a.date - b.date);

  return [
    ...creationEvents,
    ...mergeConsecutiveTimelineRevisions(timelineEventsAfterCreation)
  ];
}

function visibleTimelineAcknowledgements(note, context) {
  const contextAcknowledgements = note.acknowledgements.filter((record) => record.context === context);
  if (state.currentUser?.role === "admin") {
    return contextAcknowledgements;
  }

  const currentUserID = normalizeKey(state.currentUser?.id);
  return contextAcknowledgements.filter((acknowledgement) => {
    return normalizeKey(acknowledgement.scopeID) === currentUserID
      || normalizeKey(acknowledgement.authorIdentifier || acknowledgement.author) === currentUserID;
  });
}

function timelineRevisionsForCurrentUser(note) {
  const foldedRevisionIds = foldedInitialAuthorRevisionIds(note);
  const revisionsAfterCreation = note.revisions
    .slice(1)
    .filter((revision) => revision.date)
    .filter((revision) => !foldedRevisionIds.has(revision.id))
    .sort((a, b) => a.date - b.date);

  return revisionsAfterCreation.filter((revision) => {
    if (!canViewTimelineAuthors() && !isVisibleInStandardTimeline(revision)) {
      return false;
    }

    return true;
  });
}

function isVisibleInStandardTimeline(revision) {
  return isPublicContentRevision(revision)
    || Boolean(revision.previousDisplayDate || revision.newDisplayDate)
    || Boolean(revision.previousPriorityRawValue || revision.newPriorityRawValue)
    || Boolean(revision.previousDestinationStorage || revision.newDestinationStorage);
}

function isPublicContentRevision(revision) {
  return revision.isVisibleToOthers !== false
    && !revision.previousDisplayDate
    && !revision.newDisplayDate
    && !revision.previousPriorityRawValue
    && !revision.newPriorityRawValue
    && !revision.previousDestinationStorage
    && !revision.newDestinationStorage;
}

function shouldHideSameDayAuthorModification(revision, note) {
  if (revision.previousDisplayDate || revision.newDisplayDate || revision.previousPriorityRawValue || revision.newPriorityRawValue || revision.previousDestinationStorage || revision.newDestinationStorage) {
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
  const dotClass = timelineDotClass(event);
  const rowAttributes = isCreation
    ? " data-creation-text"
    : event.hasDisclosure
      ? ` data-timeline-event-index="${index}"`
      : "";
  const chevron = event.hasDisclosure || isCreation ? "<span class=\"timeline-chevron\">›</span>" : "";

  return `
    <button class="timeline-event${event.hasDisclosure || isCreation ? " has-detail" : ""}" type="button"${rowAttributes}>
      <span class="timeline-dot ${escapeAttribute(dotClass)}" aria-hidden="true"></span>
      <strong>${escapeHtml(event.title)}</strong>
      <div class="timeline-meta">
        <span>${escapeHtml(meta)}</span>
        ${chevron}
      </div>
    </button>
  `;
}

function timelineDotClass(event) {
  if (event.kind === "creation") return "creation";
  if (event.kind === "acknowledgement") return "acknowledgement";
  if (event.kind === "completion") return "done";
  if (event.kind === "deletion" || event.kind === "completion-cancellation") return "deletion";
  return "modification";
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

function completionAssignmentDetail(completion) {
  const recordedDate = completion.recordedDate;
  const assignedDate = completion.date;
  if (!recordedDate || !assignedDate || sameDay(recordedDate, assignedDate)) {
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

    if (revision.previousDestinationStorage || revision.newDestinationStorage) {
      revisionBlocks.push(`
        <div class="timeline-change-block">
          <strong>Changement de simulateur</strong>
          <span>${escapeHtml(destinationLabelFromStorage(revision.previousDestinationStorage))} → ${escapeHtml(destinationLabelFromStorage(revision.newDestinationStorage))}</span>
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
      return operation.type === "unchanged" ? token : "";
    })
    .join("");
}

function renderCumulativeDailyTextDiff(revisions, note) {
  if (!revisions.length) {
    return "";
  }

  let annotatedTokens = tokenizeForDiff(revisions[0].previousText)
    .map((token) => ({ token, highlighted: false }));

  for (const { revision } of revisions) {
    annotatedTokens = applyRevisionToAnnotatedTokens(
      annotatedTokens,
      revision.text,
      isPublicContentRevision(revision)
    );
  }

  return renderAnnotatedDiffTokens(annotatedTokens, note);
}

function applyRevisionToAnnotatedTokens(annotatedTokens, newText, highlightsAdditions) {
  const oldTokens = annotatedTokens.map((entry) => entry.token);
  const newTokens = tokenizeForDiff(newText);
  const operations = diffOperations(oldTokens, newTokens);
  const nextTokens = [];
  let oldIndex = 0;
  let carriesHighlightedReplacement = false;

  for (const operation of operations) {
    if (operation.type === "unchanged") {
      nextTokens.push(annotatedTokens[oldIndex] || { token: operation.token, highlighted: false });
      oldIndex += 1;
      carriesHighlightedReplacement = false;
    } else if (operation.type === "removed") {
      carriesHighlightedReplacement = carriesHighlightedReplacement || Boolean(annotatedTokens[oldIndex]?.highlighted);
      oldIndex += 1;
    } else {
      const adjacentToHighlightedToken = Boolean(nextTokens.at(-1)?.highlighted || annotatedTokens[oldIndex]?.highlighted);
      nextTokens.push({
        token: operation.token,
        highlighted: highlightsAdditions || carriesHighlightedReplacement || adjacentToHighlightedToken
      });
    }
  }

  return nextTokens;
}

function renderAnnotatedDiffTokens(tokens, note) {
  const finalText = tokens.map((token) => token.token).join("");
  const manualStyles = manualRichTextStylesByCharacter(note, finalText);
  const output = [];
  let currentText = "";
  let currentHighlighted = false;
  let currentManualStyle = null;
  let characterIndex = 0;

  const flush = () => {
    if (!currentText) {
      return;
    }
    const escaped = escapeHtml(currentText);
    if (currentHighlighted) {
      const hasManualBackground = /\bbackground(?:-color)?\s*:/i.test(currentManualStyle || "");
      const hasManualColor = /\bcolor\s*:/i.test(currentManualStyle || "");
      const highlightStyle = `${hasManualBackground ? "" : "background:#dcfce7;"}${hasManualColor ? "" : "color:#15803d;"}`;
      const combinedStyle = [currentManualStyle, highlightStyle].filter(Boolean).join("; ");
      const styleAttribute = combinedStyle ? ` style="${escapeAttribute(combinedStyle)}"` : "";
      output.push(`<span class="diff-added"${styleAttribute}>${escaped}</span>`);
    } else if (currentManualStyle) {
      output.push(`<span style="${escapeAttribute(currentManualStyle)}">${escaped}</span>`);
    } else {
      output.push(escaped);
    }
    currentText = "";
  };

  for (const token of tokens) {
    for (const character of token.token) {
      const manualStyle = manualStyles[characterIndex] || null;
      const highlighted = character !== "\n" && token.highlighted;

      if (currentText && (
        character === "\n"
        || highlighted !== currentHighlighted
        || manualStyle !== currentManualStyle
      )) {
        flush();
      }

      if (character === "\n") {
        output.push("\n");
        characterIndex += 1;
        currentHighlighted = false;
        currentManualStyle = null;
        continue;
      }

      currentHighlighted = highlighted;
      currentManualStyle = manualStyle;
      currentText += character;
      characterIndex += 1;
    }
  }

  flush();
  return output.join("");
}

function manualRichTextStylesByCharacter(note, expectedText = "") {
  if (!note?.richTextHTML) {
    return [];
  }

  const template = document.createElement("template");
  template.innerHTML = note.richTextHTML;
  const text = [];
  const styles = [];
  const blockTags = new Set(["DIV", "P", "LI"]);

  const appendCharacter = (character, style) => {
    text.push(character === "\u00a0" ? " " : character);
    styles.push(style || null);
  };

  const appendLineBreak = () => {
    if (text.length && text.at(-1) !== "\n") {
      appendCharacter("\n", null);
    }
  };

  const walk = (node, inheritedStyle = "") => {
    if (node.nodeType === Node.TEXT_NODE) {
      for (const character of node.textContent || "") {
        appendCharacter(character, inheritedStyle);
      }
      return;
    }

    if (node.nodeName === "BR") {
      appendLineBreak();
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return;
    }

    if (blockTags.has(node.tagName)) {
      appendLineBreak();
    }

    const backgroundColor = normalizeRichTextColor(node.style?.backgroundColor, true);
    const color = normalizeRichTextColor(node.style?.color, false);
    const styleParts = [inheritedStyle].filter(Boolean);
    if (node.tagName === "B" || node.tagName === "STRONG") {
      styleParts.push("font-weight: 700");
    }
    if (node.tagName === "I" || node.tagName === "EM") {
      styleParts.push("font-style: italic");
    }
    if (node.tagName === "U") {
      styleParts.push("text-decoration-line: underline");
      styleParts.push("text-decoration-thickness: 1.5px");
      styleParts.push("text-underline-offset: 2px");
    }
    if (backgroundColor) {
      styleParts.push(`background-color: ${backgroundColor}`);
    }
    if (color) {
      styleParts.push(`color: ${color}`);
    }
    const nextStyle = styleParts.join("; ");
    node.childNodes.forEach((child) => walk(child, nextStyle));
  };

  template.content.childNodes.forEach((node) => walk(node));
  while (text.length && /\s/u.test(text[0])) {
    text.shift();
    styles.shift();
  }
  while (text.length && /\s/u.test(text.at(-1))) {
    text.pop();
    styles.pop();
  }

  const richText = text.join("");
  const normalizedExpectedText = String(expectedText || note.text || "")
    .replace(/\u00a0/g, " ")
    .trim();
  if (richText === normalizedExpectedText) {
    return styles;
  }

  const start = richText.indexOf(normalizedExpectedText);
  if (start >= 0) {
    return styles.slice(start, start + normalizedExpectedText.length);
  }

  return [];
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
      && sameDay(previous.date, event.date)
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

  if (revision.previousDestinationStorage || revision.newDestinationStorage) {
    return "Changement de simulateur";
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

  if (revision.previousDestinationStorage || revision.newDestinationStorage) {
    return `${destinationLabelFromStorage(revision.previousDestinationStorage)} → ${destinationLabelFromStorage(revision.newDestinationStorage)}`;
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

  return canCurrentUserViewDeletedNotes();
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
  if (priority === "soon") return 0;
  if (priority === "whenever") return 2;
  return 4;
}

function displayPriorityRank(note, context) {
  if (!note.priority) return 4;
  return isDoneBadgeVisibleInContext(note, context) ? 3 : priorityRank(note.priority);
}

function priorityLabel(priority) {
  if (priority === "urgent") return "Urgent";
  if (priority === "soon") return "Urgent";
  if (priority === "whenever") return "ASAP";
  return "";
}

function priorityColor(priority) {
  if (priority === "urgent") return "#ff4b55";
  if (priority === "soon") return "#ff4b55";
  if (priority === "whenever") return "#ff8a24";
  return "#94a3b8";
}

function priorityBackground(priority) {
  if (priority === "urgent") return "rgba(255, 75, 85, 0.24)";
  if (priority === "soon") return "rgba(255, 75, 85, 0.24)";
  if (priority === "whenever") return "rgba(255, 138, 36, 0.10)";
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

  if (!sameDay(selectedDay, today)) {
    return slots;
  }

  const currentSlots = slots.filter((slot) => now >= slot.start && now < slot.end);
  if (currentSlots.length) {
    return currentSlots;
  }

  const previousDay = addDays(selectedDay, -1);
  const previousNightSlots = vacationSlotsForDay(previousDay).filter((slot) => {
    return slot.shiftID === "night" && now >= slot.start && now < slot.end;
  });

  return previousNightSlots.length ? previousNightSlots : slots;
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
  return renderHighlightedText(value, searchTerms());
}

function highlightHTML(html) {
  const terms = searchTerms();
  if (!html || terms.length === 0 || typeof document === "undefined") {
    return html || "";
  }

  const template = document.createElement("template");
  template.innerHTML = html;
  const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT);
  const textNodes = [];

  while (walker.nextNode()) {
    textNodes.push(walker.currentNode);
  }

  for (const textNode of textNodes) {
    const ranges = searchRangesInText(textNode.nodeValue || "", terms);
    if (!ranges.length) {
      continue;
    }

    const fragment = document.createDocumentFragment();
    let cursor = 0;
    for (const range of ranges) {
      if (range.start > cursor) {
        fragment.append(document.createTextNode(textNode.nodeValue.slice(cursor, range.start)));
      }
      const mark = document.createElement("mark");
      mark.textContent = textNode.nodeValue.slice(range.start, range.end);
      fragment.append(mark);
      cursor = range.end;
    }
    if (cursor < textNode.nodeValue.length) {
      fragment.append(document.createTextNode(textNode.nodeValue.slice(cursor)));
    }
    textNode.replaceWith(fragment);
  }

  return template.innerHTML;
}

function renderHighlightedText(value, terms) {
  const textValue = stringValue(value);
  const ranges = searchRangesInText(textValue, terms);

  if (!ranges.length) {
    return escapeHtml(textValue);
  }

  const output = [];
  let cursor = 0;
  for (const range of ranges) {
    output.push(escapeHtml(textValue.slice(cursor, range.start)));
    output.push(`<mark>${escapeHtml(textValue.slice(range.start, range.end))}</mark>`);
    cursor = range.end;
  }
  output.push(escapeHtml(textValue.slice(cursor)));
  return output.join("");
}

function searchTerms() {
  return state.search
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean);
}

function searchRangesInText(text, terms) {
  const normalized = normalizedTextWithMap(text);
  if (!normalized.text || !terms.length) {
    return [];
  }

  const ranges = [];
  for (const term of terms) {
    const normalizedTerm = normalizeSearchText(term);
    if (!normalizedTerm) {
      continue;
    }

    let position = normalized.text.indexOf(normalizedTerm);
    while (position !== -1) {
      const startMap = normalized.map[position];
      const endMap = normalized.map[position + normalizedTerm.length - 1];
      if (startMap && endMap) {
        ranges.push({ start: startMap.start, end: endMap.end });
      }
      position = normalized.text.indexOf(normalizedTerm, position + normalizedTerm.length);
    }
  }

  return mergeTextRanges(ranges);
}

function normalizedTextWithMap(value) {
  const source = stringValue(value);
  let text = "";
  const map = [];
  let index = 0;

  for (const character of source) {
    const start = index;
    const end = start + character.length;
    const normalized = normalizeSearchText(character);
    for (const normalizedCharacter of normalized) {
      text += normalizedCharacter;
      map.push({ start, end });
    }
    index = end;
  }

  return { text, map };
}

function normalizeSearchText(value) {
  return stringValue(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr");
}

function mergeTextRanges(ranges) {
  return ranges
    .filter((range) => range.end > range.start)
    .sort((a, b) => a.start - b.start || b.end - a.end)
    .reduce((merged, range) => {
      const previous = merged.at(-1);
      if (!previous || range.start > previous.end) {
        merged.push({ ...range });
      } else if (range.end > previous.end) {
        previous.end = range.end;
      }
      return merged;
    }, []);
}

function setStatus(message) {
  if (!elements.syncStatus) {
    return;
  }

  elements.syncStatus.title = message ? `Firestore : ${message}` : "Échanges Firestore";
  elements.syncStatus.classList.add("active");
  window.clearTimeout(setStatus.activityTimer);
  setStatus.activityTimer = window.setTimeout(() => {
    elements.syncStatus.classList.remove("active");
  }, 900);
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

function formatCompactNumber(value) {
  const number = Number(value) || 0;
  if (Math.abs(number) < 1000) {
    return String(number);
  }

  return new Intl.NumberFormat("fr-FR", {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(number);
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

async function recordNoteEditActivity(note, context, changes) {
  const actions = [];
  if (changes.textChanged || changes.richTextChanged) {
    actions.push("modified");
  }
  if (changes.destinationChanged) {
    actions.push("destinationChanged");
  }
  if (changes.priorityChanged) {
    actions.push("priorityChanged");
  }
  if (changes.dateChanged) {
    actions.push("assignedDateChanged");
  }
  if (changes.doneChanged) {
    actions.push(changes.draftDone ? "completed" : "completionCancelled");
  }
  if (changes.acknowledgementChanged) {
    actions.push(changes.draftAcknowledged ? "acknowledged" : "acknowledgementCancelled");
  }

  for (const action of actions) {
    await recordActivityEvent(action, note, context);
  }
}

async function recordActivityEvent(action, note, context = "") {
  if (!state.authReady || !state.currentUser?.id || !note?.id) {
    return;
  }

  const id = crypto.randomUUID();
  await setDoc(doc(db, "activityEvents", id), {
    id,
    userIdentifier: state.currentUser.id,
    userDisplayName: currentDisplayName(),
    action,
    actionTitle: activityActionTitles[action] || action,
    noteID: note.id,
    noteTitle: note.title || "",
    simulatorNames: context ? [context] : activitySimulatorNames(note),
    context: context || "",
    createdAt: new Date()
  });
}

function activitySimulatorNames(note) {
  if (note.isGeneral) {
    return [generalName];
  }

  if (Array.isArray(note.simulatorNames)) {
    const names = note.simulatorNames.map((name) => String(name || "").trim()).filter(Boolean);
    return names.length ? names : [generalName];
  }

  const storage = stringValue(note.simulatorNamesStorage);
  const names = storage.split("\n").map((name) => name.trim()).filter(Boolean);
  return names.length ? names : [generalName];
}

function currentDisplayNameForUser(user) {
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.id || "Utilisateur";
}

function compareUsersByLastName(first, second) {
  return stringValue(first.lastName).localeCompare(stringValue(second.lastName), "fr", { sensitivity: "base" })
    || stringValue(first.firstName).localeCompare(stringValue(second.firstName), "fr", { sensitivity: "base" })
    || stringValue(first.id).localeCompare(stringValue(second.id), "fr", { sensitivity: "base" });
}

function displayNameForIdentifier(identifier) {
  const key = normalizeKey(identifier);
  if (!key) {
    return "";
  }

  const matchedUser = state.users.find((user) => {
    return normalizeKey(user.id) === key
      || normalizeKey(user.documentID) === key
      || normalizeKey(currentDisplayNameForUser(user)) === key;
  });
  return matchedUser ? currentDisplayNameForUser(matchedUser) : stringValue(identifier);
}

function shouldMaskAdminAccessCode(user) {
  return user?.role === "admin" || Boolean(user?.isAccessCodeUserDefined) || !stringValue(user?.accessCode).trim();
}

function isAdminSession() {
  return state.currentUser?.role === "admin";
}

function isLastAdminUser(user) {
  if (user?.role !== "admin") {
    return false;
  }

  return state.users.filter((candidate) => candidate.role === "admin").length <= 1;
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
    team5: "Equipe 5"
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
  const minimumSixDigitCode = 10 ** 5;
  const sixDigitCodeRange = 9 * minimumSixDigitCode;
  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const code = String(Math.floor(minimumSixDigitCode + Math.random() * sixDigitCodeRange));
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

function formatConnectionTime(date) {
  if (!date) return "-";
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function formatTimelineDate(date) {
  if (!date) return "";
  const datePart = new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
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
  const roleLabel = role === "teamLeader" ? "Chef d'équipe" : role === "technician" ? "Technicien" : role === "support" ? "Support" : role === "admin" ? "Admin" : "Consultation";
  return [roleLabel, teamInfo(team).title].filter(Boolean).join(" · ");
}

function userRoleMetaHTML(role, team) {
  const roleLabel = role === "teamLeader" ? "Chef d'équipe" : role === "technician" ? "Technicien" : role === "support" ? "Support" : role === "admin" ? "Admin" : "Consultation";
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
