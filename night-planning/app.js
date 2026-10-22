const defaultSimulatorCount = 14;
const defaultPlanningTextBySimulator = Object.freeze({
  "A220-1": "A220 FFS1 CDG",
  "A220-2": "A220 FFS2 CDG",
  "A220-3": "A220 FFS3 CDG",
  "FTD 220": "A220 FTD1 CDG",
  "A320-6": "A320 FFS6 CDG",
  "A320-7": "A320 FFS7 CDG",
  FTD320: "A320 FTD1 CDG",
  A330: "A330 FFS2 CDG",
  "A350-1": "A350 FFS1 CDG",
  "A350-2": "A350 FFS2 CDG",
  "A350-3": "A350 FFS3 CDG",
  FTD350: "A350 FTD1 CDG",
  "B777-1": "B777 FFS1 CDG",
  "B777-2": "B777 FFS2 CDG",
  "B777-3": "B777 FFS3 CDG",
  "B777-4": "B777 FFS4 CDG",
  FTD777: "B777 FTD1 CDG",
  B787: "B787 FFS1 CDG"
});

function getTodayDateValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createDefaultSimulatorSettings(count = defaultSimulatorCount) {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    name: `SIM ${String(index + 1).padStart(2, "0")}`,
    planningText: "",
    color: ""
  }));
}

function createDefaultAssignment(index = 0) {
  return {
    id: index + 1,
    stopTime: "",
    restartTime: "",
    isPro1: false,
    isPro2: false,
    tasks: [],
    notes: ""
  };
}

function isProMarkerType(type) {
  return type === "pro1" || type === "pro2";
}

function getPlanningProTypeForBox(box, annotation) {
  const dayBoundary = Number(annotation?.timeline?.dayBoundary);
  return Number.isFinite(dayBoundary) && Number(box?.x) >= dayBoundary ? "pro2" : "pro1";
}

function migrateLegacyProBoxes(annotation) {
  if (!annotation?.boxes?.pro) return;
  const legacyBoxes = Array.isArray(annotation.boxes.pro)
    ? annotation.boxes.pro
    : [annotation.boxes.pro];
  legacyBoxes.forEach((box) => {
    const type = getPlanningProTypeForBox(box, annotation);
    if (!annotation.boxes[type]) annotation.boxes[type] = box;
  });
  delete annotation.boxes.pro;
}

function createDefaultAssignments(count = defaultSimulatorCount) {
  return Array.from({ length: count }, (_, index) => createDefaultAssignment(index));
}

function createDefaultShift() {
  return {
    shiftTime: "22:00 - 06:00",
    assignments: createDefaultAssignments(),
    planningCapturePath: "",
    planningAnnotations: [],
    planningDetectedEndBoxes: [],
    planningRecognitionRules: {},
    planningAiBackup: null
  };
}

const defaultState = {
  shiftDate: getTodayDateValue(),
  layoutSplitPercent: 50,
  simulators: createDefaultSimulatorSettings(),
  simulatorColors: [],
  planningProRules: {},
  shifts: {}
};

const storageKey = "night-sim-shift-planner-v1";
const privateActionsStoragePrefix = "night-sim-shift-actions-v1";
const planningCaptureDbName = "organisation-vacation-captures";
const planningCaptureStoreName = "captures";
const planningCaptureReferencePrefix = "idb-planning:";
let state = structuredClone(defaultState);
const isEmbeddedMode = new URLSearchParams(window.location.search).has("embedded");
document.body.classList.toggle("is-embedded", isEmbeddedMode);
let activeView = window.location.hash === "#planning" ? "planning" : "shift";
let activeColorPickerIndex = null;
let activePlanningMarkerType = "name";
let activePlanningSimulatorKey = "";
let planningMarkerDraft = null;
let isPickingScheduleBlocks = false;
let isReadingPickedScheduleBlock = false;
let isResizingLayout = false;
let planningPreviewObjectUrl = "";
let pendingPlanningMarkerEdit = null;
let cloudStateSaveTimer = null;
let cloudStateSaveQueue = Promise.resolve();
let proBadgeLayoutFrame = 0;
let nightPlanningCanEdit = false;
let planningBusyDepth = 0;
let planningBusyTitle = "";
let nightPlanningAccessCache = null;
const nightPlanningAccessRequests = new Map();
const nightPlanningLockRequests = new Map();

function updatePlanningBusy() {
  const overlay = document.getElementById("planningBusyOverlay");
  overlay.hidden = isEmbeddedMode || planningBusyDepth === 0;
  const message = document.getElementById("planningBusyMessage");
  const text = fields.planningStatus.textContent || planningBusyTitle;
  if (message.textContent !== text) message.textContent = text;
  const busy = planningBusyDepth > 0;
  if (fields.appShell.getAttribute("aria-busy") !== String(busy)) fields.appShell.setAttribute("aria-busy", String(busy));
  if (fields.appShell.inert !== busy) fields.appShell.inert = busy;
  scheduleParentToolbarState();
}

async function runPlanningBusy(title, work) {
  planningBusyDepth += 1;
  planningBusyTitle = title;
  fields.planningStatus.textContent = title;
  updatePlanningBusy();
  try { return await work(); }
  finally {
    planningBusyDepth -= 1;
    updatePlanningBusy();
  }
}

function importPlanningCaptureFromSimFlow(dataUrl) {
  return runPlanningBusy("Importation du planning copié...", () => importPlanningCaptureFromSimFlowWork(dataUrl));
}
function pastePlanningFromClipboard() {
  return runPlanningBusy("Lecture du presse-papiers...", pastePlanningFromClipboardWork);
}
function analyzePlanningWithAI() {
  return runPlanningBusy("Analyse du planning avec l’IA...", analyzePlanningWithAIWork);
}
function recalculatePlanningCapture() {
  return runPlanningBusy("Reconnaissance des simulateurs...", recalculatePlanningCaptureWork);
}
function pickPlanningScheduleBlock(event) {
  return runPlanningBusy("Reconnaissance du bloc sélectionné...", () => pickPlanningScheduleBlockWork(event));
}
function savePlanningMarker(...args) {
  return runPlanningBusy("Reconnaissance du repère...", () => savePlanningMarkerWork(...args));
}
let annotationsSaveTimer = null;
let annotationsSaveQueue = Promise.resolve();
const savedAnnotationStates = new Map();

function applyNightPlanningEditAccess() {
  fields.analyzePlanningAiBtn.hidden = window.simflowNightPlanningIsAdmin !== true;
  const setDisabled = (button, disabled) => { if (button.disabled !== disabled) button.disabled = disabled; };
  [fields.pastePlanningCaptureBtn, fields.recalculatePlanningBtn, fields.analyzePlanningAiBtn,
    fields.clearPlanningCaptureBtn, fields.showDetectedEndsBtn].forEach((button) => {
    setDisabled(button, !nightPlanningCanEdit || (button !== fields.pastePlanningCaptureBtn && !getCurrentShift().planningCapturePath));
  });
  document.querySelectorAll('.marker-type-button, .planning-marker-edit, .planning-marker-remove').forEach(button => setDisabled(button, !nightPlanningCanEdit));
  fields.shiftView.querySelectorAll('input, textarea, select, button').forEach(input => setDisabled(input, !nightPlanningCanEdit));
  scheduleParentToolbarState();
}

async function refreshNightPlanningAccess(force = true) {
  const date = state.shiftDate;
  if (typeof window.simflowGetNightPlanningEditAccess !== "function") return;
  let access;
  if (!force && nightPlanningAccessCache?.date === date && Date.now() - nightPlanningAccessCache.updatedAt < 30000) {
    access = nightPlanningAccessCache.access;
  } else {
    let request = nightPlanningAccessRequests.get(date);
    if (!request) {
      request = window.simflowGetNightPlanningEditAccess(date);
      nightPlanningAccessRequests.set(date, request);
    }
    try { access = await request; }
    finally { if (nightPlanningAccessRequests.get(date) === request) nightPlanningAccessRequests.delete(date); }
    if (state.shiftDate === date) nightPlanningAccessCache = { date, access, updatedAt: Date.now() };
  }
  if (state.shiftDate !== date) return;
  renderPlanningAuthors(access);
  const canEdit = access.canEdit === true;
  if (nightPlanningCanEdit !== canEdit) {
    nightPlanningCanEdit = canEdit;
    applyNightPlanningEditAccess();
  }
  return access;
}

async function requirePlanningEdit(claim = false, forceRefresh = false) {
  const date = state.shiftDate;
  try {
    const access = await refreshNightPlanningAccess(forceRefresh);
    if (state.shiftDate !== date) return false;
    if (!nightPlanningCanEdit) throw new Error("Planning verrouillé : seuls l'auteur du pointage, les chefs d'équipe et les admins peuvent le modifier.");
    // Actual saves still verify permissions server-side; nested pointage shares one claim.
    if (claim && !access?.locked) {
      let request = nightPlanningLockRequests.get(date);
      if (!request) {
        request = window.simflowClaimNightPlanningLock(date);
        nightPlanningLockRequests.set(date, request);
      }
      try {
        const result = await request;
        if (nightPlanningAccessCache?.date === date) {
          nightPlanningAccessCache.access = { ...nightPlanningAccessCache.access, locked: true,
            authorDisplayName: nightPlanningAccessCache.access.authorDisplayName || result?.authorDisplayName || "" };
          renderPlanningAuthors(nightPlanningAccessCache.access);
        }
      } finally {
        if (nightPlanningLockRequests.get(date) === request) nightPlanningLockRequests.delete(date);
      }
    }
    if (state.shiftDate !== date) return false;
    return true;
  } catch (error) {
    nightPlanningAccessCache = null;
    fields.planningStatus.textContent = error.message || "Modification du planning refusée.";
    scheduleParentToolbarState();
    return false;
  }
}

function scheduleSharedAnnotationsSave() {
  if (!nightPlanningCanEdit || typeof window.simflowSaveNightPlanningAnnotations !== "function") return;
  window.clearTimeout(annotationsSaveTimer);
  annotationsSaveTimer = window.setTimeout(() => {
    const date = state.shiftDate;
    const shift = getCurrentShift();
    const shared = { simulators: state.simulators, annotations: shift.planningAnnotations,
      schedule: shift.assignments.map(({ stopTime, restartTime, isPro1, isPro2 }) => ({ stopTime, restartTime, isPro1, isPro2 })) };
    const json = JSON.stringify(shared);
    if (savedAnnotationStates.get(date) === json) return;
    annotationsSaveQueue = annotationsSaveQueue.catch(() => {}).then(async () => {
      await window.simflowSaveNightPlanningAnnotations(date, JSON.parse(json));
      savedAnnotationStates.set(date, json);
    }).catch(error => {
      fields.planningStatus.textContent = error.message || "Sauvegarde des repères refusée.";
      void refreshNightPlanningAccess();
    });
  }, 300);
}
const planningCapturePublications = new Map();
const planningCaptureDeletions = new Set();
let planningCapturePublishQueue = Promise.resolve();

async function publishPlanningCapture(shift, shiftDate, reference, source) {
  const revision = shift.planningCaptureRevision || reference;
  if (typeof window.simflowSaveNightPlanningCapture !== "function"
    || planningCaptureDeletions.has(shiftDate) || shift.sharedCaptureReference === revision
    || planningCapturePublications.has(shiftDate)) return;
  planningCapturePublications.set(shiftDate, reference);
  try {
    const response = await fetch(source);
    if (!response.ok) throw new Error("Lecture de la capture impossible.");
    const dataUrl = await blobToDataUrl(await response.blob());
    if (shift.planningCapturePath !== reference || (shift.planningCaptureRevision || reference) !== revision
      || planningCaptureDeletions.has(shiftDate)) return;
    const publication = planningCapturePublishQueue.catch(() => {}).then(() => {
      if (!planningCaptureDeletions.has(shiftDate)) return window.simflowSaveNightPlanningCapture(shiftDate, dataUrl);
    });
    planningCapturePublishQueue = publication;
    await publication;
    if (shift.planningCapturePath === reference && (shift.planningCaptureRevision || reference) === revision
      && !planningCaptureDeletions.has(shiftDate)) {
      shift.sharedCaptureReference = revision;
      saveState();
      if (state.shiftDate === shiftDate) void refreshNightPlanningAccess(true);
    }
  } catch (error) {
    console.warn("Partage du planning iOS impossible", error);
    fields.planningStatus.textContent = "Planning local disponible, mais le partage iOS a échoué. Rouvrez le planning pour réessayer.";
  } finally {
    planningCapturePublications.delete(shiftDate);
    if (state.shiftDate === shiftDate && shift.planningCapturePath
      && (shift.planningCaptureRevision || shift.planningCapturePath) !== revision) void updatePlanningPreview();
  }
}

function getNightPlanningUserId() {
  return String(window.simflowNightPlanningUserId || "local").replace(/[^a-zA-Z0-9_-]/g, "_");
}

function getPrivateActionsStorageKey() {
  return `${privateActionsStoragePrefix}:${getNightPlanningUserId()}`;
}

const fields = {
  appShell: document.querySelector(".app-shell"),
  layoutResizer: document.getElementById("layoutResizer"),
  planningBtn: document.getElementById("planningBtn"),
  settingsBtn: document.getElementById("settingsBtn"),
  backToShiftBtn: document.getElementById("backToShiftBtn"),
  backFromPlanningBtn: document.getElementById("backFromPlanningBtn"),
  shiftView: document.getElementById("shiftView"),
  planningView: document.getElementById("planningView"),
  settingsView: document.getElementById("settingsView"),
  shiftDate: document.getElementById("shiftDate"),
  planningStatus: document.getElementById("planningStatus"),
  planningPreviewImage: document.getElementById("planningPreviewImage"),
  planningImageEditor: document.getElementById("planningImageEditor"),
  planningMagnifierBtn: document.getElementById("planningMagnifierBtn"),
  planningAnnotationOverlay: document.getElementById("planningAnnotationOverlay"),
  planningPrintPage: document.getElementById("planningPrintPage"),
  planningPrintImage: document.getElementById("planningPrintImage"),
  pastePlanningCaptureBtn: document.getElementById("pastePlanningCaptureBtn"),
  recalculatePlanningBtn: document.getElementById("recalculatePlanningBtn"),
  analyzePlanningAiBtn: document.getElementById("analyzePlanningAiBtn"),
  clearPlanningCaptureBtn: document.getElementById("clearPlanningCaptureBtn"),
  showDetectedEndsBtn: document.getElementById("showDetectedEndsBtn"),
  planningValidationDialog: document.getElementById("planningValidationDialog"),
  planningValidationMessage: document.getElementById("planningValidationMessage"),
  planningValidationProblems: document.getElementById("planningValidationProblems"),
  closePlanningValidationBtn: document.getElementById("closePlanningValidationBtn"),
  confirmPlanningValidationBtn: document.getElementById("confirmPlanningValidationBtn"),
  pendingPlanningMarkerDialog: document.getElementById("pendingPlanningMarkerDialog"),
  pendingPlanningMarkerTitle: document.getElementById("pendingPlanningMarkerTitle"),
  pendingPlanningMarkerForm: document.getElementById("pendingPlanningMarkerForm"),
  pendingPlanningSimulator: document.getElementById("pendingPlanningSimulator"),
  pendingPlanningTimeField: document.getElementById("pendingPlanningTimeField"),
  pendingPlanningTime: document.getElementById("pendingPlanningTime"),
  pendingPlanningMarkerError: document.getElementById("pendingPlanningMarkerError"),
  closePendingPlanningMarkerBtn: document.getElementById("closePendingPlanningMarkerBtn"),
  cancelPendingPlanningMarkerBtn: document.getElementById("cancelPendingPlanningMarkerBtn"),
  simulatorGrid: document.getElementById("simulatorGrid"),
  simulatorSettingsList: document.getElementById("simulatorSettingsList"),
  previewDate: document.getElementById("previewDate"),
  previewPlanningAuthors: document.getElementById("previewPlanningAuthors"),
  previewRows: document.getElementById("previewRows"),
  addSimulatorBtn: document.getElementById("addSimulatorBtn"),
  exportSimulatorSettingsBtn: document.getElementById("exportSimulatorSettingsBtn"),
  importSimulatorSettingsBtn: document.getElementById("importSimulatorSettingsBtn"),
  importSimulatorSettingsInput: document.getElementById("importSimulatorSettingsInput"),
  printBtn: document.getElementById("printBtn")
};

let parentToolbarSyncScheduled = false;

function getParentToolbarState() {
  const buttonState = (button) => ({
    disabled: Boolean(button?.disabled) || (!nightPlanningCanEdit && ["pastePlanningCaptureBtn", "recalculatePlanningBtn", "analyzePlanningAiBtn", "clearPlanningCaptureBtn", "showDetectedEndsBtn"].includes(button?.id)),
    hidden: Boolean(button?.hidden),
    label: button?.textContent?.trim() || "",
    pressed: button?.getAttribute("aria-pressed") === "true"
  });
  return {
    activeView,
    busy: planningBusyDepth > 0,
    busyMessage: fields.planningStatus.textContent || planningBusyTitle,
    canEdit: nightPlanningCanEdit,
    status: nightPlanningCanEdit ? fields.planningStatus.textContent.trim() : "Planning en lecture seule : modification réservée à l'auteur du pointage, aux chefs d'équipe et aux admins.",
    activeMarkerType: document.querySelector(".marker-type-button.is-active")?.dataset.markerType || "name",
    buttons: {
      "view-planning": buttonState(fields.planningBtn),
      "view-settings": buttonState(fields.settingsBtn),
      export: buttonState(fields.printBtn),
      back: buttonState(fields.backFromPlanningBtn),
      paste: buttonState(fields.pastePlanningCaptureBtn),
      recalculate: buttonState(fields.recalculatePlanningBtn),
      analyze: buttonState(fields.analyzePlanningAiBtn),
      clear: buttonState(fields.clearPlanningCaptureBtn),
      point: buttonState(fields.showDetectedEndsBtn),
      magnify: buttonState(fields.planningMagnifierBtn)
    }
  };
}

function sendParentToolbarState() {
  if (!isEmbeddedMode || window.parent === window) return;
  window.parent.postMessage({
    source: "organisation-vacation",
    type: "toolbar-state",
    state: getParentToolbarState()
  }, window.location.origin);
}

function scheduleParentToolbarState() {
  if (!isEmbeddedMode || parentToolbarSyncScheduled) return;
  parentToolbarSyncScheduled = true;
  queueMicrotask(() => {
    parentToolbarSyncScheduled = false;
    sendParentToolbarState();
  });
}

function normalizeState(savedState) {
  const parsed = savedState || {};
  const shiftDate = parsed.shiftDate || defaultState.shiftDate;
  const simulators = Array.isArray(parsed.simulators)
    ? parsed.simulators.map((simulator, index) => ({
      id: index + 1,
      name: simulator?.name || `SIM ${String(index + 1).padStart(2, "0")}`,
      planningText: String(
        simulator?.planningText
        || defaultPlanningTextBySimulator[simulator?.name]
        || ""
      ).trim(),
      color: normalizeColor(simulator?.color) || ""
    }))
    : createDefaultSimulatorSettings();
  const simulatorColors = [
    ...(Array.isArray(parsed.simulatorColors) ? parsed.simulatorColors : []),
    ...simulators.map((simulator) => simulator.color)
  ].map(normalizeColor).filter(Boolean);
  const legacyAssignments = Array.isArray(parsed.simulators)
    ? parsed.simulators.map((simulator, index) => ({
      ...createDefaultAssignment(index),
      stopTime: simulator.stopTime || "",
      restartTime: simulator.restartTime || "",
      isPro1: Boolean(simulator.isPro1 || simulator.isPro),
      isPro2: Boolean(simulator.isPro2),
      tasks: Array.isArray(simulator.tasks) ? simulator.tasks : (simulator.notes ? [simulator.notes] : []),
      notes: simulator.notes || ""
    }))
    : createDefaultAssignments();
  const shifts = { ...(parsed.shifts || {}) };

  if (!shifts[shiftDate]) {
    shifts[shiftDate] = {
      shiftTime: parsed.shiftTime || "22:00 - 06:00",
      assignments: legacyAssignments,
      planningCapturePath: parsed.planningCapturePath || "",
      planningAnnotations: Array.isArray(parsed.planningAnnotations) ? parsed.planningAnnotations : [],
      planningDetectedEndBoxes: [],
      planningRecognitionRules: parsed.planningRecognitionRules
        && typeof parsed.planningRecognitionRules === "object"
        ? parsed.planningRecognitionRules
        : {}
    };
  }

  Object.entries(shifts).forEach(([date, shift]) => {
    shift.assignments = Array.from({ length: simulators.length }, (_, index) => {
      const { maintenance, technician, isPro, ...assignment } = shift.assignments?.[index] || {};
      return {
        ...createDefaultAssignment(index),
        ...assignment,
        id: index + 1,
        isPro1: Boolean(assignment.isPro1 || isPro),
        isPro2: Boolean(assignment.isPro2),
        tasks: Array.isArray(assignment.tasks)
          ? assignment.tasks
          : (assignment.notes ? [assignment.notes] : [])
      };
    });
    shift.planningCapturePath = String(
      shift.planningCapturePath || (date === shiftDate ? parsed.planningCapturePath : "") || ""
    );
    shift.planningAnnotations = Array.isArray(shift.planningAnnotations)
      ? shift.planningAnnotations
      : (date === shiftDate && Array.isArray(parsed.planningAnnotations) ? parsed.planningAnnotations : []);
    shift.planningAnnotations.forEach(migrateLegacyProBoxes);
    shift.planningAnnotations.forEach((annotation) => {
      const simulatorIndex = simulators.findIndex((simulator) => getPlanningSimulatorKey(simulator) === annotation.key);
      if (simulatorIndex < 0 || (!annotation.boxes?.pro1 && !annotation.boxes?.pro2)) return;
      shift.assignments[simulatorIndex].isPro1 = Boolean(annotation.boxes.pro1);
      shift.assignments[simulatorIndex].isPro2 = Boolean(annotation.boxes.pro2);
    });
    shift.planningDetectedEndBoxes = Array.isArray(shift.planningDetectedEndBoxes)
      ? shift.planningDetectedEndBoxes
      : [];
    shift.planningRecognitionRules = shift.planningRecognitionRules
      && typeof shift.planningRecognitionRules === "object"
      ? shift.planningRecognitionRules
      : (date === shiftDate && parsed.planningRecognitionRules
        && typeof parsed.planningRecognitionRules === "object"
        ? parsed.planningRecognitionRules
        : {});
    shift.planningAiBackup = shift.planningAiBackup
      && typeof shift.planningAiBackup === "object"
      ? shift.planningAiBackup
      : null;
  });

  return {
    ...structuredClone(defaultState),
    ...parsed,
    shiftDate,
    layoutSplitPercent: Math.max(30, Math.min(70, Number(parsed.layoutSplitPercent) || 50)),
    shifts,
    simulators,
    simulatorColors: [...new Set(simulatorColors)],
    technicians: undefined,
    planningProRules: parsed.planningProRules && typeof parsed.planningProRules === "object"
      ? parsed.planningProRules
      : {},
    planningCapturePath: undefined,
    planningAnnotations: undefined,
    planningRecognitionRules: undefined
  };
}

function openPlanningCaptureDatabase() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error("Le stockage d'images du navigateur n'est pas disponible."));
      return;
    }

    const request = window.indexedDB.open(planningCaptureDbName, 1);
    request.addEventListener("upgradeneeded", () => {
      if (!request.result.objectStoreNames.contains(planningCaptureStoreName)) {
        request.result.createObjectStore(planningCaptureStoreName);
      }
    });
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error || new Error("Stockage d'images inaccessible.")));
  });
}

function getPlanningCaptureStorageKey(shiftDate) {
  return `planning-${shiftDate}`;
}

async function storePlanningCaptureInBrowser(dataUrl, shiftDate) {
  const response = await fetch(dataUrl);
  const imageBlob = await response.blob();
  return storePlanningCaptureBlobInBrowser(imageBlob, shiftDate);
}

async function storePlanningCaptureBlobInBrowser(imageBlob, shiftDate) {
  const storageKey = getPlanningCaptureStorageKey(shiftDate);
  const database = await openPlanningCaptureDatabase();

  await new Promise((resolve, reject) => {
    const transaction = database.transaction(planningCaptureStoreName, "readwrite");
    transaction.objectStore(planningCaptureStoreName).put(imageBlob, storageKey);
    transaction.addEventListener("complete", resolve);
    transaction.addEventListener("error", () => reject(transaction.error || new Error("La capture n'a pas pu être enregistrée.")));
    transaction.addEventListener("abort", () => reject(transaction.error || new Error("L'enregistrement de la capture a été annulé.")));
  });
  database.close();
  return `${planningCaptureReferencePrefix}${storageKey}`;
}

async function deletePlanningCaptureFromBrowser(shiftDate) {
  if (!window.indexedDB) return;
  const database = await openPlanningCaptureDatabase();
  await new Promise((resolve, reject) => {
    const transaction = database.transaction(planningCaptureStoreName, "readwrite");
    transaction.objectStore(planningCaptureStoreName).delete(getPlanningCaptureStorageKey(shiftDate));
    transaction.addEventListener("complete", resolve);
    transaction.addEventListener("error", () => reject(transaction.error || new Error("La capture n'a pas pu être supprimée.")));
    transaction.addEventListener("abort", () => reject(transaction.error || new Error("La suppression de la capture a été annulée.")));
  });
  database.close();
}

async function readPlanningCaptureFromBrowser(reference) {
  const storageKey = String(reference || "").slice(planningCaptureReferencePrefix.length);
  const database = await openPlanningCaptureDatabase();
  const imageBlob = await new Promise((resolve, reject) => {
    const transaction = database.transaction(planningCaptureStoreName, "readonly");
    const request = transaction.objectStore(planningCaptureStoreName).get(storageKey);
    request.addEventListener("success", () => resolve(request.result || null));
    request.addEventListener("error", () => reject(request.error || new Error("La capture enregistrée est inaccessible.")));
  });
  database.close();
  if (!imageBlob) throw new Error("La capture enregistrée est introuvable.");
  return imageBlob;
}

async function resolvePlanningCaptureSource(source) {
  if (!String(source || "").startsWith(planningCaptureReferencePrefix)) return source;
  const imageBlob = await readPlanningCaptureFromBrowser(source);
  return URL.createObjectURL(imageBlob);
}

async function migratePlanningCapturesToIndexedDb() {
  for (const [shiftDate, shift] of Object.entries(state.shifts)) {
    const capturePath = String(shift.planningCapturePath || "");
    if (capturePath.startsWith("data:image/")) {
      shift.planningCapturePath = await storePlanningCaptureInBrowser(capturePath, shiftDate);
    }
  }
}

function loadStateFromBrowser() {
  const saved = localStorage.getItem(storageKey);
  if (!saved) {
    return null;
  }

  try {
    return normalizeState(JSON.parse(saved));
  } catch {
    return null;
  }
}

function mergeBrowserSimulatorSettings(fileState, browserState) {
  if (!browserState) return fileState;
  const browserSimulatorsByName = new Map(
    browserState.simulators.map((simulator) => [simulator.name, simulator])
  );
  fileState.simulators = fileState.simulators.map((simulator, index) => {
    const browserSimulator = browserSimulatorsByName.get(simulator.name)
      || browserState.simulators[index];
    if (!browserSimulator) return simulator;
    return {
      ...simulator,
      planningText: simulator.planningText || browserSimulator.planningText || "",
      color: simulator.color || browserSimulator.color || ""
    };
  });
  fileState.simulatorColors = [...new Set([
    ...fileState.simulatorColors,
    ...browserState.simulatorColors
  ].filter(Boolean))];
  fileState.planningProRules = {
    ...(browserState.planningProRules || {}),
    ...(fileState.planningProRules || {})
  };
  return fileState;
}

function extractPrivateActions(sourceState) {
  return {
    shifts: Object.fromEntries(Object.entries(sourceState?.shifts || {}).map(([date, shift]) => [
      date,
      {
        assignments: (shift?.assignments || []).map((assignment) => ({
          tasks: Array.isArray(assignment?.tasks) ? structuredClone(assignment.tasks) : [],
          notes: String(assignment?.notes || "")
        }))
      }
    ]))
  };
}

function stripPrivateActions(sourceState) {
  const sharedState = structuredClone(sourceState);
  Object.values(sharedState.shifts || {}).forEach((shift) => {
    (shift.assignments || []).forEach((assignment) => {
      assignment.tasks = [];
      assignment.notes = "";
    });
  });
  return sharedState;
}

function applyPrivateActions(targetState, privateActions) {
  Object.entries(privateActions?.shifts || {}).forEach(([date, privateShift]) => {
    const assignments = targetState.shifts?.[date]?.assignments;
    if (!assignments) return;
    (privateShift?.assignments || []).forEach((privateAssignment, index) => {
      if (!assignments[index]) return;
      assignments[index].tasks = Array.isArray(privateAssignment?.tasks)
        ? structuredClone(privateAssignment.tasks)
        : [];
      assignments[index].notes = String(privateAssignment?.notes || "");
    });
  });
}

function applySharedLaunchSheet(launchSheet) {
  if (!Array.isArray(launchSheet?.rows)) return;

  const simulatorKey = (value) => String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleUpperCase("fr-FR")
    .replace(/[^A-Z0-9]/g, "");
  const rowsBySimulator = new Map(launchSheet.rows.map((row) => [
    simulatorKey(row?.name),
    row
  ]));
  const shift = getCurrentShift();

  state.simulators.forEach((simulator, index) => {
    const row = rowsBySimulator.get(simulatorKey(simulator.name)) || launchSheet.rows[index];
    if (!row) return;

    const assignment = shift.assignments[index] || createDefaultAssignment(index);
    const ownTasks = Array.isArray(assignment.tasks) ? assignment.tasks : [];
    const sharedTasks = Array.isArray(row.tasks) ? structuredClone(row.tasks) : [];
    shift.assignments[index] = {
      ...assignment,
      stopTime: assignment.stopTime || String(row.stopTime || ""),
      restartTime: assignment.restartTime || String(row.restartTime || ""),
      isPro1: Boolean(assignment.isPro1 || row.isPro1),
      isPro2: Boolean(assignment.isPro2 || row.isPro2),
      tasks: ownTasks.some((task) => String(task || "").trim()) ? ownTasks : sharedTasks
    };
  });
}

function loadPrivateActionsFromBrowser() {
  const saved = localStorage.getItem(getPrivateActionsStorageKey());
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      // Une ancienne sauvegarde privée invalide sera remplacée au prochain enregistrement.
    }
  }

  const previousUserState = localStorage.getItem(`${storageKey}:${getNightPlanningUserId()}`);
  if (!previousUserState) return null;
  try {
    return extractPrivateActions(normalizeState(JSON.parse(previousUserState)));
  } catch {
    return null;
  }
}

async function loadState() {
  const browserState = loadStateFromBrowser();
  try {
    const response = await fetch("/api/state", { cache: "no-store" });
    if (!response.ok) throw new Error("Sauvegarde locale indisponible");
    state = mergeBrowserSimulatorSettings(normalizeState(await response.json()), browserState);
  } catch {
    state = browserState || (window.__VACATION_INITIAL_STATE__
      ? normalizeState(window.__VACATION_INITIAL_STATE__)
      : structuredClone(defaultState));
  }

  let privateActions = null;
  if (typeof window.simflowLoadOwnNightPlanningActions === "function") {
    try {
      privateActions = await window.simflowLoadOwnNightPlanningActions();
    } catch (error) {
      console.warn("Chargement des actions privées impossible", error);
    }
  }
  privateActions = privateActions || loadPrivateActionsFromBrowser() || extractPrivateActions(state);
  applyPrivateActions(state, privateActions);

  const requestedDate = new URLSearchParams(window.location.search).get("date");
  state.shiftDate = requestedDate || getTodayDateValue();
  getCurrentShift();
  const access = await refreshNightPlanningAccess();
  if (access?.annotationState) {
    const shared = access.annotationState;
    state.simulators = shared.simulators;
    const shift = getCurrentShift();
    shift.planningAnnotations = shared.annotations;
    shift.assignments = state.simulators.map((_, index) => ({ ...createDefaultAssignment(index),
      ...(shift.assignments[index] || {}), ...(shared.schedule?.[index] || {}) }));
    savedAnnotationStates.set(state.shiftDate, JSON.stringify(shared));
  }
  if (typeof window.simflowLoadNightPlanningCapture === "function") {
    try {
      const currentShift = getCurrentShift();
      const capture = await window.simflowLoadNightPlanningCapture(state.shiftDate, {
        knownImageHash: access?.hasCapture && currentShift.planningCapturePath
          ? currentShift.cloudCaptureHash
          : ""
      });
      applySharedLaunchSheet(capture.launchSheet);
      if (capture.imageDataUrl) {
        currentShift.planningCapturePath = await storePlanningCaptureInBrowser(capture.imageDataUrl, state.shiftDate);
        currentShift.planningCaptureRevision = crypto.randomUUID();
        currentShift.sharedCaptureReference = currentShift.planningCaptureRevision;
      } else if (!access?.hasCapture) {
        currentShift.planningCapturePath = "";
        currentShift.cloudCaptureHash = "";
      }
      if (access?.hasCapture) {
        currentShift.cloudCaptureHash = capture.imageHash || access.captureHash || currentShift.cloudCaptureHash;
      }
    } catch (error) {
      console.warn("Chargement de la feuille de lancement partagée impossible", error);
    }
  }
  try {
    await migratePlanningCapturesToIndexedDb();
  } catch {
    // La capture existante reste utilisable si la migration n'est pas disponible.
  }
  saveState();
  render();
}

function scheduleOwnCloudActionsSave() {
  if (!nightPlanningCanEdit) return;
  if (typeof window.simflowSaveOwnNightPlanningActions !== "function") return;
  window.clearTimeout(cloudStateSaveTimer);
  cloudStateSaveTimer = window.setTimeout(() => {
    const shiftDate = state.shiftDate;
    const assignments = extractPrivateActions(state).shifts[shiftDate]?.assignments || [];
    const shift = getCurrentShift();
    const launchSheet = { rows: state.simulators.map((simulator, index) => {
      const assignment = shift.assignments[index] || {};
      return {
        name: simulator.name, color: normalizeColor(simulator.color),
        stopTime: assignment.stopTime || "", restartTime: assignment.restartTime || "",
        isPro1: Boolean(assignment.isPro1), isPro2: Boolean(assignment.isPro2),
        tasks: Array.isArray(assignment.tasks) ? assignment.tasks : []
      };
    }) };
    cloudStateSaveQueue = cloudStateSaveQueue
      .catch(() => {})
      .then(() => window.simflowSaveOwnNightPlanningActions({ shiftDate, assignments, launchSheet }))
      .catch((error) => console.warn("Sauvegarde privée des actions impossible", error));
  }, 250);
}

function saveState() {
  const privateActions = extractPrivateActions(state);
  const sharedState = stripPrivateActions(state);
  try {
    localStorage.setItem(storageKey, JSON.stringify(sharedState));
  } catch (error) {
    if (error?.name !== "QuotaExceededError") throw error;
    const compactState = structuredClone(sharedState);
    Object.values(compactState.shifts || {}).forEach((shift) => {
      if (String(shift.planningCapturePath || "").startsWith("data:image/")) {
        shift.planningCapturePath = "";
      }
    });
    localStorage.setItem(storageKey, JSON.stringify(compactState));
  }
  localStorage.setItem(getPrivateActionsStorageKey(), JSON.stringify(privateActions));

  scheduleOwnCloudActionsSave();
  scheduleSharedAnnotationsSave();
  if (window.location.protocol.startsWith("http")) {
    fetch("/api/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sharedState)
    }).catch(() => {
      localStorage.setItem(storageKey, JSON.stringify(sharedState));
    });
  }
}

function getCurrentShift() {
  if (!state.shifts[state.shiftDate]) {
    state.shifts[state.shiftDate] = createDefaultShift();
  }

  state.shifts[state.shiftDate].planningCapturePath = String(
    state.shifts[state.shiftDate].planningCapturePath || ""
  );
  state.shifts[state.shiftDate].planningAnnotations = Array.isArray(
    state.shifts[state.shiftDate].planningAnnotations
  ) ? state.shifts[state.shiftDate].planningAnnotations : [];
  state.shifts[state.shiftDate].planningRecognitionRules = state.shifts[state.shiftDate].planningRecognitionRules
    && typeof state.shifts[state.shiftDate].planningRecognitionRules === "object"
    ? state.shifts[state.shiftDate].planningRecognitionRules
    : {};
  state.shifts[state.shiftDate].planningAiBackup = state.shifts[state.shiftDate].planningAiBackup
    && typeof state.shifts[state.shiftDate].planningAiBackup === "object"
    ? state.shifts[state.shiftDate].planningAiBackup
    : null;

  state.shifts[state.shiftDate].assignments = Array.from({ length: state.simulators.length }, (_, index) => ({
    ...createDefaultAssignment(index),
    ...(() => {
      const { maintenance, ...assignment } = state.shifts[state.shiftDate].assignments?.[index] || {};
      return assignment;
    })(),
    id: index + 1,
    tasks: Array.isArray(state.shifts[state.shiftDate].assignments?.[index]?.tasks)
      ? state.shifts[state.shiftDate].assignments[index].tasks
      : (state.shifts[state.shiftDate].assignments?.[index]?.notes ? [state.shifts[state.shiftDate].assignments[index].notes] : [])
  }));

  return state.shifts[state.shiftDate];
}

function updateCurrentShift(patch, shouldRenderAll = false) {
  state.shifts[state.shiftDate] = {
    ...getCurrentShift(),
    ...patch
  };
  saveState();
  if (shouldRenderAll) {
    render();
  } else {
    renderPreview();
  }
}

async function updatePlanningPreview() {
  const shift = getCurrentShift();
  planningMagnifier.hidden = true;
  fields.planningMagnifierBtn.disabled = !shift.planningCapturePath;
  fields.recalculatePlanningBtn.disabled = !shift.planningCapturePath;
  fields.analyzePlanningAiBtn.disabled = !shift.planningCapturePath;
  fields.clearPlanningCaptureBtn.disabled = !shift.planningCapturePath;
  fields.showDetectedEndsBtn.disabled = !shift.planningCapturePath;
  if (shift.planningCapturePath) {
    const captureReference = shift.planningCapturePath;
    let imagePath;
    try {
      imagePath = await resolvePlanningCaptureSource(captureReference);
    } catch (error) {
      fields.planningStatus.textContent = error.message || "La capture enregistrée est inaccessible.";
      fields.planningImageEditor.hidden = true;
      fields.planningPrintPage.hidden = true;
      return;
    }
    if (captureReference !== getCurrentShift().planningCapturePath) {
      if (imagePath.startsWith("blob:")) URL.revokeObjectURL(imagePath);
      return;
    }
    if (planningPreviewObjectUrl) URL.revokeObjectURL(planningPreviewObjectUrl);
    planningPreviewObjectUrl = imagePath.startsWith("blob:") ? imagePath : "";
    if (!imagePath.startsWith("data:") && !imagePath.startsWith("blob:")) {
      imagePath = `${imagePath}${imagePath.includes("?") ? "&" : "?"}v=${Date.now()}`;
    }
    fields.planningPreviewImage.src = imagePath;
    fields.planningImageEditor.hidden = false;
    fields.planningPrintImage.src = imagePath;
    fields.planningPrintPage.hidden = false;
    void publishPlanningCapture(shift, state.shiftDate, captureReference, imagePath);
  } else {
    if (planningPreviewObjectUrl) URL.revokeObjectURL(planningPreviewObjectUrl);
    planningPreviewObjectUrl = "";
    fields.planningImageEditor.hidden = true;
    fields.planningPrintPage.hidden = true;
  }
  renderPlanningAnnotationEditor();
}

function getPlanningSimulatorKey(simulator) {
  return compactPlanningText(simulator?.planningText);
}

function getPlanningConfiguredSimulators() {
  return state.simulators.filter((simulator) => getPlanningSimulatorKey(simulator));
}

function clampPlanningBox(box) {
  const x = Math.max(0, Math.min(1, Number(box?.x) || 0));
  const y = Math.max(0, Math.min(1, Number(box?.y) || 0));
  return {
    x,
    y,
    width: Math.max(0, Math.min(1 - x, Number(box?.width) || 0)),
    height: Math.max(0, Math.min(1 - y, Number(box?.height) || 0))
  };
}

function getPlanningAnnotation(simulator, shouldCreate = false) {
  const key = getPlanningSimulatorKey(simulator);
  const shift = getCurrentShift();
  let annotation = shift.planningAnnotations.find((item) => item.key === key);
  if (!annotation && shouldCreate) {
    annotation = {
      key,
      simulatorName: simulator.name,
      planningText: simulator.planningText,
      boxes: {}
    };
    shift.planningAnnotations.push(annotation);
  }
  return annotation;
}

function getPendingPlanningWarningCount(simulator) {
  if (!getPlanningSimulatorKey(simulator)) return 0;
  const annotation = getPlanningAnnotation(simulator);
  return annotation ? getPendingPlanningBoxes(annotation).length : 0;
}

function markerTypeLabel(type) {
  return { name: "Nom", stop: "Arrêt", restart: "Reprise", pro1: "PRO1", pro2: "PRO2" }[type] || type;
}

function placeYellowMarkerLabel(marker, box) {
  const placeOnLeft = box.x + (box.width / 2) > 0.5;
  marker.classList.add("has-contextual-label");
  marker.classList.add(placeOnLeft ? "label-on-left" : "label-on-right");
}

function renderPlanningAnnotationEditor() {
  const simulators = getPlanningConfiguredSimulators();
  const shift = getCurrentShift();
  const hasEditableCapture = Boolean(shift.planningCapturePath && simulators.length > 0);
  fields.planningAnnotationOverlay.replaceChildren();
  if (!hasEditableCapture) {
    scheduleParentToolbarState();
    return;
  }

  if (!simulators.some((simulator) => getPlanningSimulatorKey(simulator) === activePlanningSimulatorKey)) {
    activePlanningSimulatorKey = getPlanningSimulatorKey(simulators[0]);
  }

  shift.planningAnnotations.forEach((annotation) => {
    if (!simulators.some((simulator) => getPlanningSimulatorKey(simulator) === annotation.key)) return;
    ["name", "stop", "restart"].forEach((type) => {
      if (!annotation.boxes?.[type]) return;
      const box = clampPlanningBox(annotation.boxes[type]);
      const marker = document.createElement("div");
      marker.className = "planning-marker";
      marker.dataset.markerType = type;
      marker.style.left = `${box.x * 100}%`;
      marker.style.top = `${box.y * 100}%`;
      marker.style.width = `${box.width * 100}%`;
      marker.style.height = `${box.height * 100}%`;
      const annotationSimulatorIndex = state.simulators.findIndex((simulator) => (
        getPlanningSimulatorKey(simulator) === annotation.key
      ));
      const assignment = getCurrentShift().assignments[annotationSimulatorIndex];
      if (type === "name" && isScheduleIncomplete(
        assignment?.stopTime,
        assignment?.restartTime,
        assignment?.isPro1 || assignment?.isPro2
      )) {
        marker.classList.add("is-incomplete-schedule");
        placeYellowMarkerLabel(marker, box);
      }
      const hasStoredMarkerValue = Object.prototype.hasOwnProperty.call(annotation.values || {}, type);
      const markerValue = type === "name"
        ? ""
        : (hasStoredMarkerValue
          ? annotation.values[type]
          : assignment?.[type === "stop" ? "stopTime" : "restartTime"]);
      const markerValueText = markerValue ? ` · ${escapeText(markerValue)}` : "";
      const markerLabel = type === "name"
        ? escapeText(annotation.simulatorName)
        : (["stop", "restart"].includes(type)
          ? `${escapeText(annotation.simulatorName)}${markerValue ? ` : ${escapeText(markerValue)}` : ""}`
          : `${escapeText(annotation.simulatorName)} · ${markerTypeLabel(type)}${markerValueText}`);
      const editButton = type === "name" ? "" : `
        <button class="planning-marker-edit${markerValue ? "" : " is-empty"}" type="button" title="Modifier le type et l'heure" aria-label="Modifier le bloc ${markerTypeLabel(type).toLowerCase()} de ${escapeText(annotation.simulatorName)}">&#9998;</button>
      `;
      marker.innerHTML = `
        <span class="planning-marker-label">
          <span>${markerLabel}</span>
          ${editButton}
          <button class="planning-marker-remove" type="button" title="Supprimer ce repère" aria-label="Supprimer le repère ${markerTypeLabel(type)} de ${escapeText(annotation.simulatorName)}">×</button>
        </span>
      `;
      marker.querySelectorAll(".planning-marker-edit, .planning-marker-remove").forEach((button) => {
        button.addEventListener("pointerdown", (event) => event.stopPropagation());
      });
      marker.querySelector(".planning-marker-edit")?.addEventListener("click", (event) => {
        event.stopPropagation();
        editPlanningMarkerTime(annotation, type, markerValue);
      });
      marker.querySelector(".planning-marker-remove").addEventListener("click", (event) => {
        event.stopPropagation();
        activePlanningSimulatorKey = annotation.key;
        activePlanningMarkerType = type;
        document.querySelectorAll(".marker-type-button").forEach((button) => {
          button.classList.toggle("is-active", button.dataset.markerType === type);
        });
        delete annotation.boxes[type];
        if (annotation.values) delete annotation.values[type];
        if (shift.planningRecognitionRules[annotation.key]) {
          delete shift.planningRecognitionRules[annotation.key][type];
        }
        saveState();
        renderPlanningAnnotationEditor();
      });
      fields.planningAnnotationOverlay.append(marker);
    });

    ["pro1", "pro2"].forEach((proType) => {
      if (!annotation.boxes?.[proType]) return;
      const box = clampPlanningBox(annotation.boxes[proType]);
      const marker = document.createElement("div");
      marker.className = "planning-marker planning-pro-marker";
      marker.dataset.markerType = proType;
      marker.style.left = `${box.x * 100}%`;
      marker.style.top = `${box.y * 100}%`;
      marker.style.width = `${box.width * 100}%`;
      marker.style.height = `${box.height * 100}%`;
      marker.innerHTML = `
        <span class="planning-marker-label">
          <span class="planning-pro-text">
            <span class="planning-pro-simulator">${escapeText(annotation.simulatorName)}</span>
            <span class="planning-pro-type">${markerTypeLabel(proType)}</span>
          </span>
          <button class="planning-marker-edit" type="button" title="Modifier le type" aria-label="Modifier le bloc ${markerTypeLabel(proType)} de ${escapeText(annotation.simulatorName)}">&#9998;</button>
          <button class="planning-marker-remove" type="button" title="Supprimer ce repère" aria-label="Supprimer le repère ${markerTypeLabel(proType)} de ${escapeText(annotation.simulatorName)}">×</button>
        </span>
      `;
      marker.querySelectorAll(".planning-marker-edit, .planning-marker-remove").forEach((button) => {
        button.addEventListener("pointerdown", (event) => event.stopPropagation());
      });
      marker.querySelector(".planning-marker-edit").addEventListener("click", (event) => {
        event.stopPropagation();
        editPlanningMarkerTime(annotation, proType, "");
      });
      marker.querySelector(".planning-marker-remove").addEventListener("click", (event) => {
        event.stopPropagation();
        activePlanningSimulatorKey = annotation.key;
        activePlanningMarkerType = proType;
        document.querySelectorAll(".marker-type-button").forEach((button) => {
          button.classList.toggle("is-active", button.dataset.markerType === proType);
        });
        delete annotation.boxes[proType];
        if (state.planningProRules[annotation.key]) delete state.planningProRules[annotation.key][proType];
        const simulatorIndex = state.simulators.findIndex((simulator) => (
          getPlanningSimulatorKey(simulator) === annotation.key
        ));
        if (simulatorIndex >= 0) {
          shift.assignments[simulatorIndex] = {
            ...shift.assignments[simulatorIndex],
            [proType === "pro1" ? "isPro1" : "isPro2"]: false
          };
        }
        saveState();
        renderPlanningAnnotationEditor();
        renderSimulators();
        renderPreview();
      });
      fields.planningAnnotationOverlay.append(marker);
    });

    getPendingPlanningBoxes(annotation).forEach((pendingBox, pendingIndex) => {
      const box = clampPlanningBox(pendingBox);
      const marker = document.createElement("div");
      marker.className = "planning-marker planning-pending-marker";
      marker.dataset.markerType = "pending";
      marker.style.left = `${box.x * 100}%`;
      marker.style.top = `${box.y * 100}%`;
      marker.style.width = `${box.width * 100}%`;
      marker.style.height = `${box.height * 100}%`;
      placeYellowMarkerLabel(marker, box);
      marker.innerHTML = `
        <span class="planning-marker-label">
          <span>${escapeText(annotation.simulatorName)}</span>
          <button class="planning-marker-edit" type="button" title="Choisir le type et l'heure" aria-label="Modifier le bloc à vérifier de ${escapeText(annotation.simulatorName)}">&#9998;</button>
          <button class="planning-marker-remove" type="button" title="Supprimer ce repère" aria-label="Supprimer le bloc à vérifier de ${escapeText(annotation.simulatorName)}">×</button>
        </span>
      `;
      marker.querySelectorAll(".planning-marker-edit, .planning-marker-remove").forEach((button) => {
        button.addEventListener("pointerdown", (event) => event.stopPropagation());
      });
      marker.querySelector(".planning-marker-edit").addEventListener("click", (event) => {
        event.stopPropagation();
        resolvePendingPlanningMarker(annotation, pendingIndex);
      });
      marker.querySelector(".planning-marker-remove").addEventListener("click", (event) => {
        event.stopPropagation();
        removePendingPlanningMarker(annotation, pendingIndex);
        saveState();
        renderPlanningAnnotationEditor();
        renderSimulators();
      });
      fields.planningAnnotationOverlay.append(marker);
    });
  });

  fields.planningAnnotationOverlay.classList.toggle("is-picking-schedule-blocks", isPickingScheduleBlocks);
  scheduleParentToolbarState();
}

function editPlanningMarkerTime(annotation, type, currentValue) {
  const box = annotation.boxes?.[type];
  if (!box) return;
  openPlanningMarkerDialog(annotation, {
    sourceType: type,
    box: clampPlanningBox(Array.isArray(box) ? box[0] : box),
    currentValue: currentValue || ""
  });
}

function getPendingPlanningBoxes(annotation) {
  const pending = annotation.boxes?.pending;
  if (!pending) return [];
  return Array.isArray(pending) ? pending : [pending];
}

function addPendingPlanningMarker(annotation, box) {
  annotation.boxes.pending = [
    ...getPendingPlanningBoxes(annotation),
    clampPlanningBox(box)
  ];
}

function movePlanningMarkerToPending(annotation, type, box) {
  delete annotation.boxes[type];
  if (annotation.values) delete annotation.values[type];
  const recognitionRules = getCurrentShift().planningRecognitionRules[annotation.key];
  if (recognitionRules) delete recognitionRules[type];
  addPendingPlanningMarker(annotation, box);
}

function removePendingPlanningMarker(annotation, index) {
  const pending = getPendingPlanningBoxes(annotation).filter((_, itemIndex) => itemIndex !== index);
  if (pending.length > 0) annotation.boxes.pending = pending;
  else delete annotation.boxes.pending;
}

function resolvePendingPlanningMarker(annotation, pendingIndex) {
  const box = getPendingPlanningBoxes(annotation)[pendingIndex];
  if (!box) return;
  openPlanningMarkerDialog(annotation, {
    sourceType: "pending",
    pendingIndex,
    box: clampPlanningBox(box),
    currentValue: ""
  });
}

function openPlanningMarkerDialog(annotation, edit) {
  pendingPlanningMarkerEdit = { annotation, ...edit };
  fields.pendingPlanningSimulator.replaceChildren(...getPlanningConfiguredSimulators().map((simulator) => (
    new Option(simulator.name, getPlanningSimulatorKey(simulator))
  )));
  fields.pendingPlanningSimulator.value = annotation.key;
  const suggestedType = edit.sourceType === "pending"
    ? getPlanningBlockTimeType({ x: edit.box.x + (edit.box.width / 2) }, annotation)
    : edit.sourceType;
  const suggestedRadio = fields.pendingPlanningMarkerForm.querySelector(
    `input[name="pendingMarkerType"][value="${suggestedType}"]`
  );
  if (suggestedRadio) suggestedRadio.checked = true;
  fields.pendingPlanningMarkerTitle.textContent = `${edit.sourceType === "pending" ? "Corriger" : "Modifier"} le bloc de ${annotation.simulatorName}`;
  fields.pendingPlanningTime.value = edit.currentValue || "";
  fields.pendingPlanningMarkerError.textContent = "";
  updatePendingPlanningMarkerDialog();
  fields.pendingPlanningMarkerDialog.classList.add("is-open");
  window.setTimeout(() => {
    if (isProMarkerType(suggestedType)) suggestedRadio?.focus();
    else fields.pendingPlanningTime.focus();
  }, 0);
}

function updatePendingPlanningMarkerDialog() {
  const simulatorName = fields.pendingPlanningSimulator.selectedOptions[0]?.textContent;
  if (pendingPlanningMarkerEdit && simulatorName) {
    fields.pendingPlanningMarkerTitle.textContent = `${pendingPlanningMarkerEdit.sourceType === "pending" ? "Corriger" : "Modifier"} le bloc de ${simulatorName}`;
  }
  const selectedType = fields.pendingPlanningMarkerForm.querySelector(
    'input[name="pendingMarkerType"]:checked'
  )?.value;
  const isPro = isProMarkerType(selectedType);
  fields.pendingPlanningTimeField.hidden = isPro;
  fields.pendingPlanningTime.required = !isPro;
  fields.pendingPlanningMarkerError.textContent = "";
}

function closePendingPlanningMarkerDialog() {
  fields.pendingPlanningMarkerDialog.classList.remove("is-open");
  pendingPlanningMarkerEdit = null;
}

function applyPlanningMarkerEdit(edit, type, value, simulatorKey = edit.annotation.key) {
  const { annotation, sourceType, pendingIndex, box } = edit;
  if (!box) return;
  const shift = getCurrentShift();
  const simulator = getPlanningConfiguredSimulators().find((item) => getPlanningSimulatorKey(item) === simulatorKey);
  if (!simulator) return;
  const targetAnnotation = getPlanningAnnotation(simulator, true);
  const simulatorIndex = state.simulators.findIndex((simulator) => (
    getPlanningSimulatorKey(simulator) === annotation.key
  ));

  if (sourceType === "pending") {
    removePendingPlanningMarker(annotation, pendingIndex);
  } else {
    delete annotation.boxes[sourceType];
    if (annotation.values) delete annotation.values[sourceType];
    if (shift.planningRecognitionRules[annotation.key]) {
      delete shift.planningRecognitionRules[annotation.key][sourceType];
    }
    if (isProMarkerType(sourceType) && state.planningProRules[annotation.key]) {
      delete state.planningProRules[annotation.key][sourceType];
    }
    if (simulatorIndex >= 0) {
      shift.assignments[simulatorIndex] = {
        ...shift.assignments[simulatorIndex],
        ...(sourceType === "stop" ? { stopTime: "" } : {}),
        ...(sourceType === "restart" ? { restartTime: "" } : {}),
        ...(sourceType === "pro1" ? { isPro1: false } : {}),
        ...(sourceType === "pro2" ? { isPro2: false } : {})
      };
    }
  }

  targetAnnotation.boxes[type] = clampPlanningBox(box);
  targetAnnotation.values = targetAnnotation.values || {};
  if (!isProMarkerType(type)) targetAnnotation.values[type] = value;
  learnPlanningMarkerRule(targetAnnotation, type, targetAnnotation.boxes[type]);

  const targetIndex = state.simulators.findIndex((item) => getPlanningSimulatorKey(item) === simulatorKey);
  if (targetIndex >= 0) {
    shift.assignments[targetIndex] = {
      ...shift.assignments[targetIndex],
      ...(type === "stop" ? { stopTime: value } : {}),
      ...(type === "restart" ? { restartTime: value } : {}),
      ...(type === "pro1" ? { isPro1: true } : {}),
      ...(type === "pro2" ? { isPro2: true } : {})
    };
  }

  saveState();
  renderPlanningAnnotationEditor();
  renderSimulators();
  renderPreview();
  fields.planningStatus.textContent = isProMarkerType(type)
    ? `${targetAnnotation.simulatorName} : séance ${markerTypeLabel(type)} mémorisée.`
    : `${targetAnnotation.simulatorName} · ${markerTypeLabel(type)} : ${value}`;
}

async function submitPendingPlanningMarker(event) {
  event.preventDefault();
  if (!await requirePlanningEdit(true)) return;
  if (!pendingPlanningMarkerEdit) return;
  const simulatorKey = fields.pendingPlanningSimulator.value;
  if (!getPlanningConfiguredSimulators().some((simulator) => getPlanningSimulatorKey(simulator) === simulatorKey)) {
    fields.pendingPlanningMarkerError.textContent = "Choisis un simulateur.";
    fields.pendingPlanningSimulator.focus();
    return;
  }
  const type = fields.pendingPlanningMarkerForm.querySelector(
    'input[name="pendingMarkerType"]:checked'
  )?.value;
  if (!type) {
    fields.pendingPlanningMarkerError.textContent = "Choisis Arrêt, Reprise, PRO1 ou PRO2.";
    return;
  }

  const value = isProMarkerType(type)
    ? ""
    : (extractOcrTimesFromText(fields.pendingPlanningTime.value)[0] || "");
  if (!isProMarkerType(type) && !value) {
    fields.pendingPlanningMarkerError.textContent = "Saisis une heure valide au format HH:MM.";
    fields.pendingPlanningTime.focus();
    return;
  }

  const edit = pendingPlanningMarkerEdit;
  closePendingPlanningMarkerDialog();
  applyPlanningMarkerEdit(edit, type, value, simulatorKey);
}

async function savePlanningMarkerWork(box, ocrBox = box, expectedTime = "", recognizedValue) {
  if (!await requirePlanningEdit(true)) return;
  const simulator = getPlanningConfiguredSimulators().find((item) => (
    getPlanningSimulatorKey(item) === activePlanningSimulatorKey
  ));
  if (!simulator) return;
  const markerType = activePlanningMarkerType;
  const annotation = getPlanningAnnotation(simulator, true);
  annotation.simulatorName = simulator.name;
  annotation.planningText = simulator.planningText;
  annotation.boxes[markerType] = clampPlanningBox(box);
  annotation.values = annotation.values || {};
  if (!isProMarkerType(markerType)) annotation.values[markerType] = "";
  learnPlanningMarkerRule(annotation, markerType, annotation.boxes[markerType]);
  saveState();
  renderPlanningAnnotationEditor();

  if (isProMarkerType(markerType)) {
    const simulatorIndex = state.simulators.findIndex((item) => (
      getPlanningSimulatorKey(item) === annotation.key
    ));
    if (simulatorIndex >= 0) {
      const shift = getCurrentShift();
      shift.assignments[simulatorIndex] = {
        ...shift.assignments[simulatorIndex],
        [markerType === "pro1" ? "isPro1" : "isPro2"]: true
      };
    }
    saveState();
    renderSimulators();
    renderPreview();
    fields.planningStatus.textContent = `${simulator.name} : séance ${markerTypeLabel(markerType)} mémorisée.`;
    return;
  }

  if (markerType === "name") return;

  fields.planningStatus.textContent = `Lecture de l'heure ${markerTypeLabel(markerType).toLowerCase()} de ${simulator.name}...`;
  try {
    const value = recognizedValue === undefined
      ? await readPlanningMarkerTime(ocrBox, markerType, expectedTime)
      : recognizedValue;
    if (!value) {
      movePlanningMarkerToPending(annotation, markerType, box);
      saveState();
      renderPlanningAnnotationEditor();
      renderSimulators();
      fields.planningStatus.textContent = `Horaire non reconnu pour ${simulator.name}. Le bloc jaune doit être modifié ou supprimé.`;
      return;
    }

    annotation.values[markerType] = value;
    const simulatorIndex = state.simulators.findIndex((item) => (
      getPlanningSimulatorKey(item) === annotation.key
    ));
    if (simulatorIndex >= 0) {
      const shift = getCurrentShift();
      const assignment = shift.assignments[simulatorIndex];
      shift.assignments[simulatorIndex] = {
        ...assignment,
        [markerType === "stop" ? "stopTime" : "restartTime"]: value
      };
    }
    saveState();
    renderPlanningAnnotationEditor();
    renderSimulators();
    renderPreview();
    fields.planningStatus.textContent = `${simulator.name} · ${markerTypeLabel(markerType)} : ${value}`;
  } catch (error) {
    movePlanningMarkerToPending(annotation, markerType, box);
    saveState();
    renderPlanningAnnotationEditor();
    renderSimulators();
    fields.planningStatus.textContent = `Horaire non reconnu pour ${simulator.name}. Le bloc jaune doit être modifié ou supprimé.`;
  }
}

function learnPlanningMarkerRule(annotation, type, box) {
  if (isProMarkerType(type)) {
    const timeline = annotation.timeline || {};
    const markerCenter = box.x + (box.width / 2);
    const dayWidth = Number(timeline.dayWidth) || 0;
    state.planningProRules[annotation.key] = {
      ...(state.planningProRules[annotation.key] || {}),
      [type]: {
      relativeCenter: dayWidth > 0
        ? (markerCenter - Number(timeline.dayBoundary || 0)) / dayWidth
        : null,
      absoluteCenter: markerCenter,
      relativeWidth: dayWidth > 0 ? box.width / dayWidth : null
      }
    };
    return;
  }
  if (type === "name") return;
  const day = type === "stop" ? 1 : 2;
  const candidates = (annotation.candidates || [])
    .filter((candidate) => candidate.day === day)
    .sort((a, b) => a.start - b.start);
  if (candidates.length === 0) return;

  const markerCenter = box.x + (box.width / 2);
  const selectedIndex = candidates.reduce((bestIndex, candidate, index) => {
    const candidateCenter = (candidate.start + candidate.end) / 2;
    const bestCenter = (candidates[bestIndex].start + candidates[bestIndex].end) / 2;
    return Math.abs(candidateCenter - markerCenter) < Math.abs(bestCenter - markerCenter)
      ? index
      : bestIndex;
  }, 0);
  const learnedRule = type === "stop"
    ? { runFromEnd: candidates.length - 1 - selectedIndex }
    : { runFromStart: selectedIndex };
  const recognitionRules = getCurrentShift().planningRecognitionRules;
  recognitionRules[annotation.key] = {
    ...(recognitionRules[annotation.key] || {}),
    [type]: learnedRule
  };
}

function getPlanningPointerPosition(event) {
  const bounds = fields.planningAnnotationOverlay.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
    y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height))
  };
}

function startPlanningMarkerDraft(event) {
  if (!nightPlanningCanEdit) return;
  if (event.button !== 0 || event.target.closest(".planning-marker-remove")) return;
  if (isPickingScheduleBlocks) {
    event.preventDefault();
    pickPlanningScheduleBlock(event);
    return;
  }
  const start = getPlanningPointerPosition(event);
  const element = document.createElement("div");
  element.className = "planning-marker-draft";
  fields.planningAnnotationOverlay.append(element);
  planningMarkerDraft = { pointerId: event.pointerId, start, current: start, element };
  fields.planningAnnotationOverlay.setPointerCapture(event.pointerId);
  updatePlanningMarkerDraft(event);
}

function findPlanningAnnotationAtY(y) {
  const shift = getCurrentShift();
  const candidates = shift.planningAnnotations.filter((annotation) => annotation.boxes?.name);
  if (candidates.length === 0) {
    return shift.planningAnnotations.find((annotation) => annotation.key === activePlanningSimulatorKey) || null;
  }
  const rows = candidates.map((annotation) => ({
    annotation,
    top: clampPlanningBox(annotation.boxes.name).y
  })).sort((first, second) => first.top - second.top);
  // Unnamed continuation rows belong to the preceding named simulator.
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    if (y >= rows[index].top) return rows[index].annotation;
  }
  return rows[0].annotation;
}

function getFallbackSessionBlock(point, annotation) {
  const nameBox = clampPlanningBox(annotation.boxes?.name || {});
  const height = Math.max(nameBox.height * 3, 0.022);
  const dayWidth = Number(annotation.timeline?.dayWidth) || 0.395;
  const maxWidth = dayWidth / 6;
  const start = point.x - (maxWidth / 2);
  return clampPlanningBox({
    x: start,
    y: Math.max(0, point.y - (height / 2)),
    width: maxWidth,
    height
  });
}

async function detectPlanningSessionBlock(
  point,
  annotation,
  preparedImage = null,
  preparedImageData = null,
  allowFallback = true,
  preciseBounds = false
) {
  const prepared = preparedImage || await preparePlanningImage(getCurrentShift().planningCapturePath);
  const context = prepared.analysisCanvas.getContext("2d", { willReadFrequently: true });
  const imageData = preparedImageData || context.getImageData(0, 0, prepared.width, prepared.height);
  const { data, width, height } = imageData;
  const centerX = Math.round(point.x * width);
  const centerY = Math.round(point.y * height);
  const samples = new Map();

  for (let y = Math.max(0, centerY - 8); y <= Math.min(height - 1, centerY + 8); y += 1) {
    for (let x = Math.max(0, centerX - 8); x <= Math.min(width - 1, centerX + 8); x += 1) {
      const offset = ((y * width) + x) * 4;
      const red = data[offset];
      const green = data[offset + 1];
      const blue = data[offset + 2];
      const luminance = (red + green + blue) / 3;
      const chroma = Math.max(red, green, blue) - Math.min(red, green, blue);
      if (luminance < 105 || luminance > 246) continue;
      if (chroma < 8 && luminance > 225) continue;
      const key = `${red >> 4}-${green >> 4}-${blue >> 4}`;
      const sample = samples.get(key) || { count: 0, red: 0, green: 0, blue: 0 };
      sample.count += 1;
      sample.red += red;
      sample.green += green;
      sample.blue += blue;
      samples.set(key, sample);
    }
  }

  const dominant = [...samples.values()].sort((a, b) => b.count - a.count)[0];
  if (!dominant) return allowFallback ? getFallbackSessionBlock(point, annotation) : null;
  const target = [dominant.red / dominant.count, dominant.green / dominant.count, dominant.blue / dominant.count];
  const dayWidthPixels = (Number(annotation.timeline?.dayWidth) || 0.395) * width;
  const maxBlockWidth = Math.max(24, dayWidthPixels / 6);
  const maxBlockHeight = Math.max(24, height * 0.055);
  const timelineStart = Number(annotation.timeline?.dayBoundary) - Number(annotation.timeline?.dayWidth);
  const minX = Math.max(0, preciseBounds && Number.isFinite(timelineStart)
    ? Math.round(timelineStart * width) : 0, Math.floor(centerX - maxBlockWidth));
  const maxX = Math.min(width - 1, Math.ceil(centerX + maxBlockWidth));
  const minY = Math.max(0, Math.floor(centerY - maxBlockHeight));
  const maxY = Math.min(height - 1, Math.ceil(centerY + maxBlockHeight));
  const roiWidth = maxX - minX + 1;
  const visited = new Uint8Array(roiWidth * (maxY - minY + 1));
  const queue = [];
  const midnightX = Math.round((Number(annotation.timeline?.dayBoundary) || -1) * width);
  const midnightBridgeRange = Math.max(12, Math.round(dayWidthPixels * 0.03));
  const matchesTargetColor = (x, y) => {
    if (x < 0 || x >= width) return false;
    const offset = ((y * width) + x) * 4;
    const red = data[offset] - target[0];
    const green = data[offset + 1] - target[1];
    const blue = data[offset + 2] - target[2];
    return (red * red) + (green * green) + (blue * blue) <= 42 * 42;
  };
  const midnightBridges = new Map();
  const getMidnightBridge = (y) => {
    if (midnightBridges.has(y)) return midnightBridges.get(y);
    let leftTarget = null;
    let rightTarget = null;
    for (let offset = 1; offset <= midnightBridgeRange; offset += 1) {
      if (leftTarget === null && matchesTargetColor(midnightX - offset, y)) {
        leftTarget = midnightX - offset;
      }
      if (rightTarget === null && matchesTargetColor(midnightX + offset, y)) {
        rightTarget = midnightX + offset;
      }
      if (leftTarget !== null && rightTarget !== null) break;
    }
    const bridge = leftTarget !== null && rightTarget !== null
      ? { left: leftTarget, right: rightTarget }
      : null;
    midnightBridges.set(y, bridge);
    return bridge;
  };

  let seed = null;
  for (let radius = 0; radius <= 10 && !seed; radius += 1) {
    for (let y = Math.max(minY, centerY - radius); y <= Math.min(maxY, centerY + radius) && !seed; y += 1) {
      for (let x = Math.max(minX, centerX - radius); x <= Math.min(maxX, centerX + radius); x += 1) {
        if (matchesTargetColor(x, y)) {
          seed = { x, y };
          break;
        }
      }
    }
  }
  if (!seed) return allowFallback ? getFallbackSessionBlock(point, annotation) : null;

  queue.push(seed);
  let queueIndex = 0;
  let left = seed.x;
  let right = seed.x;
  let top = seed.y;
  let bottom = seed.y;
  while (queueIndex < queue.length) {
    const current = queue[queueIndex];
    queueIndex += 1;
    const localIndex = ((current.y - minY) * roiWidth) + current.x - minX;
    if (visited[localIndex]) continue;
    visited[localIndex] = 1;
    if (!matchesTargetColor(current.x, current.y)) continue;
    left = Math.min(left, current.x);
    right = Math.max(right, current.x);
    top = Math.min(top, current.y);
    bottom = Math.max(bottom, current.y);
    if (current.x > minX) queue.push({ x: current.x - 1, y: current.y });
    if (current.x < maxX) queue.push({ x: current.x + 1, y: current.y });
    if (current.y > minY) queue.push({ x: current.x, y: current.y - 1 });
    if (current.y < maxY) queue.push({ x: current.x, y: current.y + 1 });
    if (midnightX >= minX && midnightX <= maxX) {
      const bridge = getMidnightBridge(current.y);
      if (bridge && current.x === bridge.left && bridge.right <= maxX) {
        queue.push({ x: bridge.right, y: current.y });
      } else if (bridge && current.x === bridge.right && bridge.left >= minX) {
        queue.push({ x: bridge.left, y: current.y });
      }
    }
  }

  const midnightIsInsideSearch = midnightX >= minX && midnightX <= maxX;
  const reachesBothSidesOfMidnight = left < midnightX - midnightBridgeRange
    && right > midnightX + midnightBridgeRange;
  const usesMidnightAsEdge = Math.abs(left - midnightX) <= midnightBridgeRange
    || Math.abs(right - midnightX) <= midnightBridgeRange;
  if (midnightIsInsideSearch && usesMidnightAsEdge && !reachesBothSidesOfMidnight) {
    return allowFallback ? getFallbackSessionBlock(point, annotation) : null;
  }

  if (right - left < 12 || bottom - top < 8) {
    return allowFallback ? getFallbackSessionBlock(point, annotation) : null;
  }
  const horizontalPadding = preciseBounds ? 1 : 10;
  const verticalPadding = preciseBounds ? 1 : 6;
  const paddedLeft = Math.max(0, left - horizontalPadding);
  const paddedTop = Math.max(0, top - verticalPadding);
  const paddedRight = Math.min(width - 1, right + horizontalPadding);
  const paddedBottom = Math.min(height - 1, bottom + verticalPadding);
  return normalizePixelBox({
    x: paddedLeft,
    y: paddedTop,
    width: paddedRight - paddedLeft,
    height: paddedBottom - paddedTop
  }, width, height);
}

function getSessionTimeOcrBox(block) {
  return block;
}

function getPlanningBlockTimeType(point, annotation) {
  const dayBoundary = Number(annotation.timeline?.dayBoundary);
  if (!Number.isFinite(dayBoundary)) return "stop";
  return point.x < dayBoundary ? "stop" : "restart";
}

function constrainPlanningBlockDuration(block, point, annotation) {
  const dayWidth = Number(annotation.timeline?.dayWidth);
  if (!Number.isFinite(dayWidth) || dayWidth <= 0) {
    return clampPlanningBox(block);
  }

  let left = block.x;
  let right = block.x + block.width;
  const maximumWidth = dayWidth / 6;
  if (right - left > maximumWidth) {
    left = Math.max(left, Math.min(point.x - (maximumWidth / 2), right - maximumWidth));
    right = left + maximumWidth;
  }
  return clampPlanningBox({
    x: left,
    y: block.y,
    width: Math.max(0.005, right - left),
    height: block.height
  });
}

function getTimeFromPlanningPosition(block, annotation, type) {
  const dayWidth = Number(annotation.timeline?.dayWidth);
  const dayBoundary = Number(annotation.timeline?.dayBoundary);
  if (!Number.isFinite(dayWidth) || dayWidth <= 0 || !Number.isFinite(dayBoundary)) return "";
  const dayStart = type === "stop" ? dayBoundary - dayWidth : dayBoundary;
  const timePosition = type === "stop" ? block.x + block.width : block.x;
  const relativeDayPosition = (timePosition - dayStart) / dayWidth;
  const roundedMinutes = Math.round((relativeDayPosition * 1440) / 5) * 5;
  const normalizedMinutes = ((roundedMinutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(normalizedMinutes / 60)).padStart(2, "0")}:${String(normalizedMinutes % 60).padStart(2, "0")}`;
}

async function pickPlanningScheduleBlockWork(event) {
  if (!await requirePlanningEdit(true)) return;
  if (isReadingPickedScheduleBlock) return;
  const point = getPlanningPointerPosition(event);
  const annotation = findPlanningAnnotationAtY(point.y);
  if (!annotation) {
    fields.planningStatus.textContent = "Impossible d'associer ce clic à un simulateur. Relance la reconnaissance des simulateurs puis recommence.";
    return;
  }

  activePlanningSimulatorKey = annotation.key;

  isReadingPickedScheduleBlock = true;
  fields.showDetectedEndsBtn.disabled = true;
  fields.planningStatus.textContent = `${annotation.simulatorName} : détection du bloc et de son type...`;
  let block = null;
  try {
    block = constrainPlanningBlockDuration(
      await detectPlanningSessionBlock(point, annotation),
      point,
      annotation
    );
    const recognizedItems = await recognizePlanningMarkerBox(block);
    const markerType = planningBlockContainsPro(recognizedItems)
      ? getPlanningProTypeForBox(block, annotation)
      : getPlanningBlockTimeType(point, annotation);
    activePlanningMarkerType = markerType;
    document.querySelectorAll(".marker-type-button").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.markerType === markerType);
    });
    if (isProMarkerType(markerType)) {
      await savePlanningMarker(block);
      return;
    }
    const expectedTime = getTimeFromPlanningPosition(block, annotation, markerType);
    const recognizedValue = selectPlanningBlockTime(recognizedItems, markerType, expectedTime);
    await savePlanningMarker(
      block,
      getSessionTimeOcrBox(block),
      expectedTime,
      recognizedValue
    );
  } catch (error) {
    if (block) {
      addPendingPlanningMarker(annotation, block);
      saveState();
      renderPlanningAnnotationEditor();
      renderSimulators();
      fields.planningStatus.textContent = `Bloc enregistré pour ${annotation.simulatorName}. Utilise le crayon jaune pour choisir Arrêt, Reprise, PRO1 ou PRO2.`;
    } else {
      fields.planningStatus.textContent = error.message || "Le bloc sélectionné n'a pas pu être reconnu.";
    }
  } finally {
    isReadingPickedScheduleBlock = false;
    fields.showDetectedEndsBtn.disabled = false;
  }
}

function updatePlanningMarkerDraft(event) {
  if (!planningMarkerDraft || planningMarkerDraft.pointerId !== event.pointerId) return;
  planningMarkerDraft.current = getPlanningPointerPosition(event);
  const x = Math.min(planningMarkerDraft.start.x, planningMarkerDraft.current.x);
  const y = Math.min(planningMarkerDraft.start.y, planningMarkerDraft.current.y);
  const width = Math.abs(planningMarkerDraft.current.x - planningMarkerDraft.start.x);
  const height = Math.abs(planningMarkerDraft.current.y - planningMarkerDraft.start.y);
  Object.assign(planningMarkerDraft.element.style, {
    left: `${x * 100}%`,
    top: `${y * 100}%`,
    width: `${width * 100}%`,
    height: `${height * 100}%`
  });
}

function finishPlanningMarkerDraft(event) {
  if (!planningMarkerDraft || planningMarkerDraft.pointerId !== event.pointerId) return;
  updatePlanningMarkerDraft(event);
  const x = Math.min(planningMarkerDraft.start.x, planningMarkerDraft.current.x);
  const y = Math.min(planningMarkerDraft.start.y, planningMarkerDraft.current.y);
  const width = Math.abs(planningMarkerDraft.current.x - planningMarkerDraft.start.x);
  const height = Math.abs(planningMarkerDraft.current.y - planningMarkerDraft.start.y);
  planningMarkerDraft.element.remove();
  planningMarkerDraft = null;
  if (width >= 0.005 && height >= 0.005) {
    savePlanningMarker({ x, y, width, height });
  }
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", () => reject(new Error("Lecture de l'image impossible")));
    reader.readAsDataURL(blob);
  });
}

let ocrLibraryPromise = null;

function loadOcrLibrary() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  if (ocrLibraryPromise) return ocrLibraryPromise;

  ocrLibraryPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "./vendor/tesseract/tesseract.min.js";
    script.addEventListener("load", () => resolve(window.Tesseract));
    script.addEventListener("error", () => reject(new Error("Le module de lecture du planning n'a pas pu être chargé.")));
    document.head.appendChild(script);
  });

  return ocrLibraryPromise;
}

function getOcrWorkerOptions(extraOptions = {}) {
  if (window.location.protocol === "file:") {
    return {
      workerPath: "https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/worker.min.js",
      corePath: "https://cdn.jsdelivr.net/npm/tesseract.js-core@7.0.0",
      gzip: true,
      ...extraOptions
    };
  }

  return {
    workerPath: new URL("./vendor/tesseract/worker.min.js", window.location.href).href,
    corePath: new URL("./vendor/tesseract", window.location.href).href.replace(/\/$/, ""),
    langPath: new URL("./vendor/tesseract/lang", window.location.href).href.replace(/\/$/, ""),
    gzip: true,
    ...extraOptions
  };
}

const PLANNING_OCR_LANGUAGE = "eng";

function describeOcrError(error) {
  if (typeof error === "string" && error.trim()) return error.trim();
  if (error?.message) return error.message;
  if (error?.error) return String(error.error);
  try {
    const serialized = JSON.stringify(error);
    if (serialized && serialized !== "{}") return serialized;
  } catch {
    // The fallback below remains more useful than a serialization error.
  }
  return "le moteur OCR s'est interrompu sans fournir de détail";
}

async function createPlanningOcrWorker(Tesseract, extraOptions = {}, refreshCache = false) {
  return Tesseract.createWorker(
    PLANNING_OCR_LANGUAGE,
    1,
    getOcrWorkerOptions({
      ...extraOptions,
      ...(refreshCache ? { cacheMethod: "refresh" } : {})
    })
  );
}

function compactPlanningText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/O/g, "0")
    .replace(/[^A-Z0-9]/g, "");
}

function getSimulatorPlanningAliases(simulator) {
  const simulatorName = typeof simulator === "string" ? simulator : simulator.name;
  const planningText = typeof simulator === "string" ? "" : compactPlanningText(simulator.planningText);
  const compactName = compactPlanningText(simulatorName);
  const numberedSimulator = compactName.match(/^([AB]\d{3})(\d)$/);
  if (numberedSimulator) {
    const [, family, number] = numberedSimulator;
    const numberVariants = {
      1: ["1", "I", "L"],
      2: ["2", "Z"],
      3: ["3"],
      4: ["4", "A"],
      5: ["5", "S"],
      6: ["6", "G", "B"],
      7: ["7", "T"],
      8: ["8", "B"]
    }[number] || [number];
    return [...new Set([
      planningText,
      ...numberVariants.flatMap((variant) => [
        `${family}FFS${variant}`,
        `${family}FF5${variant}`
      ]),
      compactName
    ].filter(Boolean))];
  }

  const ftdSimulator = compactName.match(/^FTD(\d{3})$/);
  if (ftdSimulator) {
    const familyNumber = ftdSimulator[1];
    const family = familyNumber === "777" ? "B777" : `A${familyNumber}`;
    return [...new Set([planningText, compactName, `${family}FTD`].filter(Boolean))];
  }

  return [...new Set([planningText, compactName].filter(Boolean))];
}

function getPlanningTextSimilarity(text, alias) {
  if (!text || !alias) return 0;
  if (text.includes(alias)) return 1;

  const minLength = Math.max(1, alias.length - 2);
  const maxLength = Math.min(text.length, alias.length + 2);
  let bestDistance = alias.length;

  for (let length = minLength; length <= maxLength; length += 1) {
    for (let start = 0; start <= text.length - length; start += 1) {
      const candidate = text.slice(start, start + length);
      const previous = Array.from({ length: candidate.length + 1 }, (_, index) => index);
      for (let aliasIndex = 1; aliasIndex <= alias.length; aliasIndex += 1) {
        const current = [aliasIndex];
        for (let candidateIndex = 1; candidateIndex <= candidate.length; candidateIndex += 1) {
          current[candidateIndex] = Math.min(
            current[candidateIndex - 1] + 1,
            previous[candidateIndex] + 1,
            previous[candidateIndex - 1] + (alias[aliasIndex - 1] === candidate[candidateIndex - 1] ? 0 : 1)
          );
        }
        previous.splice(0, previous.length, ...current);
      }
      bestDistance = Math.min(bestDistance, previous[candidate.length]);
    }
  }

  return 1 - (bestDistance / Math.max(alias.length, 1));
}

function getSimulatorPlanningMatchScore(value, simulator) {
  const text = compactPlanningText(value);
  return getSimulatorPlanningAliases(simulator).reduce((bestScore, alias) => (
    Math.max(bestScore, getPlanningTextSimilarity(text, alias))
  ), 0);
}

function findPlanningDates(ocrText) {
  const dates = new Set();
  const datePattern = /\b([0-3]?\d)\s*[\/|]\s*([01]?\d)\s*[\/|]\s*(20\d{2})\b/g;
  let match = datePattern.exec(ocrText);
  while (match) {
    dates.add(`${match[1].padStart(2, "0")}/${match[2].padStart(2, "0")}/${match[3]}`);
    match = datePattern.exec(ocrText);
  }
  return [...dates];
}

function validatePlanningText(ocrText) {
  const comparableLines = String(ocrText || "").split(/\r?\n/).filter(Boolean);
  const dates = findPlanningDates(ocrText);
  const missingSimulators = state.simulators
    .filter((simulator) => !comparableLines.some((line) => (
      getSimulatorPlanningMatchScore(line, simulator) >= 0.78
    )))
    .map((simulator) => simulator.name);

  return {
    isValid: dates.length >= 2 && missingSimulators.length === 0,
    dates,
    missingSimulators
  };
}

function getOcrLines(blocks) {
  return (blocks || []).flatMap((block) => (
    (block.paragraphs || []).flatMap((paragraph) => paragraph.lines || [])
  ));
}

function getCloudOcrFunction() {
  if (typeof window.simflowRecognizePlanning !== "function") {
    throw new Error("Le service OCR Cloud Vision n'est pas disponible.");
  }
  return window.simflowRecognizePlanning;
}

function cloudWordsToOcrBlocks(words) {
  const normalizedWords = (Array.isArray(words) ? words : []).map((word) => ({
    text: String(word?.text || "").trim(),
    confidence: Number(word?.confidence) || 0,
    bbox: {
      x0: Number(word?.bbox?.x0) || 0,
      y0: Number(word?.bbox?.y0) || 0,
      x1: Number(word?.bbox?.x1) || 0,
      y1: Number(word?.bbox?.y1) || 0
    }
  })).filter((word) => word.text && word.bbox.x1 > word.bbox.x0 && word.bbox.y1 > word.bbox.y0);

  const rows = [];
  normalizedWords
    .sort((first, second) => (
      getBoxCenter(first.bbox).y - getBoxCenter(second.bbox).y
      || first.bbox.x0 - second.bbox.x0
    ))
    .forEach((word) => {
      const centerY = getBoxCenter(word.bbox).y;
      const height = word.bbox.y1 - word.bbox.y0;
      const row = rows.find((candidate) => (
        Math.abs(candidate.centerY - centerY) <= Math.max(candidate.height, height) * 0.65
      ));
      if (row) {
        row.words.push(word);
        row.centerY = row.words.reduce((sum, item) => sum + getBoxCenter(item.bbox).y, 0) / row.words.length;
        row.height = Math.max(row.height, height);
      } else {
        rows.push({ centerY, height, words: [word] });
      }
    });

  const lines = rows.flatMap((row) => {
    const sorted = row.words.sort((first, second) => first.bbox.x0 - second.bbox.x0);
    const segments = [];
    sorted.forEach((word) => {
      const segment = segments.at(-1);
      const wordHeight = word.bbox.y1 - word.bbox.y0;
      const gap = segment ? word.bbox.x0 - segment.at(-1).bbox.x1 : 0;
      if (!segment || gap > Math.max(40, wordHeight * 3.5)) {
        segments.push([word]);
      } else {
        segment.push(word);
      }
    });
    return segments.map((segment) => ({
      text: segment.map((word) => word.text).join(" "),
      confidence: segment.reduce((sum, word) => sum + word.confidence, 0) / segment.length,
      bbox: {
        x0: Math.min(...segment.map((word) => word.bbox.x0)),
        y0: Math.min(...segment.map((word) => word.bbox.y0)),
        x1: Math.max(...segment.map((word) => word.bbox.x1)),
        y1: Math.max(...segment.map((word) => word.bbox.y1))
      },
      words: segment
    }));
  });

  return [{ paragraphs: [{ lines }] }];
}

async function recognizePlanningWithCloud(dataUrl) {
  const recognize = getCloudOcrFunction();
  const result = await recognize(dataUrl);
  return {
    text: String(result?.text || ""),
    words: Array.isArray(result?.words) ? result.words : [],
    blocks: cloudWordsToOcrBlocks(result?.words)
  };
}

function getBoxCenter(box) {
  return {
    x: (box.x0 + box.x1) / 2,
    y: (box.y0 + box.y1) / 2
  };
}

function parseOcrTime(value) {
  const normalized = String(value || "")
    .toUpperCase()
    .replace(/[OQ]/g, "0")
    .replace(/[IL]/g, "1")
    .replace(/[^0-9:]/g, "");
  const match = normalized.match(/^([0-2]?\d):([0-5]\d)$/);
  if (!match) return null;

  const hours = Number(match[1]);
  if (hours > 23) return null;
  return `${String(hours).padStart(2, "0")}:${match[2]}`;
}

function extractOcrTimesFromWord(word) {
  const normalized = String(word.text || "")
    .toUpperCase()
    .replace(/[OQ]/g, "0")
    .replace(/[IL]/g, "1")
    .replace(/[H;.,]/g, ":")
    .replace(/\s+/g, "");
  const times = extractOcrTimesFromText(normalized);
  const box = word.bbox;
  const boxWidth = Math.max(1, box.x1 - box.x0);

  return times.map((time, index) => {
    const relativeCenter = times.length === 1
      ? 0.5
      : (index + 0.5) / times.length;
    return [{
      time,
      x: box.x0 + (boxWidth * relativeCenter),
      y: (box.y0 + box.y1) / 2,
      confidence: Number(word.confidence) || 0
    }];
  }).flat();
}

async function preparePlanningImage(source) {
  const imageSource = await resolvePlanningCaptureSource(source);
  const shouldRevokeSource = String(imageSource || "").startsWith("blob:");
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => {
      const maxPixelScale = Math.sqrt(9000000 / (image.naturalWidth * image.naturalHeight));
      const scale = Math.max(0.25, Math.min(
        2.2,
        4200 / image.naturalWidth,
        maxPixelScale
      ));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.naturalWidth * scale);
      canvas.height = Math.round(image.naturalHeight * scale);
      const context = canvas.getContext("2d");
      context.imageSmoothingEnabled = false;
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const colorDataUrl = canvas.toDataURL("image/png");
      const analysisCanvas = document.createElement("canvas");
      analysisCanvas.width = canvas.width;
      analysisCanvas.height = canvas.height;
      analysisCanvas.getContext("2d").drawImage(canvas, 0, 0);
      resolve({
        dataUrl: colorDataUrl,
        analysisCanvas,
        width: canvas.width,
        height: canvas.height
      });
      if (shouldRevokeSource) URL.revokeObjectURL(imageSource);
    });
    image.addEventListener("error", () => {
      if (shouldRevokeSource) URL.revokeObjectURL(imageSource);
      reject(new Error("La capture ne peut pas être préparée pour la lecture."));
    });
    image.src = imageSource;
  });
}

function findTimelineMarkers(lines, imageWidth, imageHeight) {
  const headerTimes = lines.flatMap((line) => (line.words || []).map((word) => ({
    time: parseOcrTime(word.text),
    box: word.bbox
  }))).filter((word) => (
    word.time === "00:00"
    && getBoxCenter(word.box).y < imageHeight * 0.24
    && getBoxCenter(word.box).x > imageWidth * 0.15
  )).sort((a, b) => getBoxCenter(a.box).x - getBoxCenter(b.box).x);

  if (headerTimes.length >= 2) {
    const timelineStart = getBoxCenter(headerTimes[0].box).x;
    const dayBoundary = getBoxCenter(headerTimes[1].box).x;
    return { timelineStart, dayBoundary, dayWidth: dayBoundary - timelineStart };
  }

  const timelineStart = imageWidth * 0.205;
  const dayWidth = imageWidth * 0.395;
  return { timelineStart, dayBoundary: timelineStart + dayWidth, dayWidth };
}

function locateSimulatorRows(lines, imageWidth) {
  const availableLines = lines.filter((line) => line.bbox?.x1 < imageWidth * 0.35);
  const usedLines = new Set();

  return state.simulators.map((simulator, index) => {
    const candidates = availableLines
      .filter((line) => !usedLines.has(line))
      .map((line) => ({ line, score: getSimulatorPlanningMatchScore(line.text, simulator) }))
      .filter(({ score }) => score >= 0.78)
      .sort((a, b) => b.score - a.score);
    const labelLine = candidates[0]?.line;
    if (labelLine) usedLines.add(labelLine);
    return labelLine ? {
      simulatorIndex: index,
      name: simulator.name,
      centerY: getBoxCenter(labelLine.bbox).y,
      labelBox: labelLine.bbox
    } : null;
  }).filter(Boolean).sort((a, b) => a.centerY - b.centerY);
}

function getProMarkers(lines, top, bottom, timelineStart) {
  return lines.flatMap((line) => (line.words || []).map((word) => ({
    text: compactPlanningText(word.text),
    box: word.bbox,
    ...getBoxCenter(word.bbox)
  }))).filter((word) => (
    word.text === "PR0"
    && word.x > timelineStart
    && word.y >= top
    && word.y < bottom
  ));
}

function findVisualEventRuns(imageData, top, bottom, timelineStart, timelineEnd) {
  const { data, width, height } = imageData;
  const startX = Math.max(0, Math.floor(timelineStart));
  const endX = Math.min(width - 1, Math.ceil(timelineEnd));
  const startY = Math.max(0, Math.floor(top));
  const endY = Math.min(height - 1, Math.ceil(bottom));
  const sampleStep = 2;
  const activeColumns = [];

  for (let x = startX; x <= endX; x += sampleStep) {
    let eventPixels = 0;
    let grayEventPixels = 0;
    let colorEventPixels = 0;
    let sampledPixels = 0;
    for (let y = startY; y <= endY; y += sampleStep) {
      const offset = ((y * width) + x) * 4;
      const red = data[offset];
      const green = data[offset + 1];
      const blue = data[offset + 2];
      const max = Math.max(red, green, blue);
      const min = Math.min(red, green, blue);
      const luminance = (red + green + blue) / 3;
      if (max - min > 18 && luminance < 246) {
        eventPixels += 1;
        colorEventPixels += 1;
      } else if (max - min <= 18 && luminance >= 145 && luminance < 226) {
        eventPixels += 1;
        grayEventPixels += 1;
      }
      sampledPixels += 1;
    }
    activeColumns.push({
      x,
      active: eventPixels >= Math.max(4, Math.round(sampledPixels * 0.12)),
      grayEventPixels,
      colorEventPixels
    });
  }

  const runs = [];
  let runStart = null;
  let runGrayPixels = 0;
  let runColorPixels = 0;
  activeColumns.forEach((column, index) => {
    if (column.active && runStart === null) {
      runStart = column.x;
      runGrayPixels = 0;
      runColorPixels = 0;
    }
    if (column.active) {
      runGrayPixels += column.grayEventPixels;
      runColorPixels += column.colorEventPixels;
    }
    const isLast = index === activeColumns.length - 1;
    if (runStart !== null && (!column.active || isLast)) {
      const runEnd = column.active && isLast ? column.x : column.x - sampleStep;
      if (runEnd - runStart >= 10) {
        runs.push({
          start: runStart,
          end: runEnd,
          isGray: runGrayPixels > runColorPixels * 1.25
        });
      }
      runStart = null;
    }
  });

  return runs;
}

function readPrintedRunTimes(lines, top, bottom, run) {
  const printedTimes = lines.flatMap((line) => (
    (line.words || []).flatMap(extractOcrTimesFromWord)
  )).filter((word) => (
    word.x >= run.start
    && word.x <= run.end
    && word.y >= top
    && word.y < bottom
  )).sort((a, b) => a.x - b.x);

  if (printedTimes.length >= 2) {
    return {
      startTime: printedTimes[0].time,
      endTime: printedTimes[printedTimes.length - 1].time
    };
  }

  if (printedTimes.length === 1) {
    const [printedTime] = printedTimes;
    const isCloserToStart = printedTime.x - run.start <= run.end - printedTime.x;
    return {
      startTime: isCloserToStart ? printedTime.time : "",
      endTime: isCloserToStart ? "" : printedTime.time
    };
  }

  return { startTime: "", endTime: "" };
}

function extractOcrTimesFromText(value) {
  const normalized = String(value || "")
    .toUpperCase()
    .replace(/[OQ]/g, "0")
    .replace(/[IL]/g, "1")
    .replace(/[H;.,]/g, ":");
  const timesWithSeparator = [...normalized.matchAll(/([0-2]?\d)\s*:\s*([0-5]\d)/g)]
    .map((match) => parseOcrTime(`${match[1]}:${match[2]}`))
    .filter(Boolean);
  if (timesWithSeparator.length > 0) return timesWithSeparator;

  return [...normalized.matchAll(/(?:^|\D)([0-2]\d)([0-5]\d)(?=\D|$)/g)]
    .map((match) => parseOcrTime(`${match[1]}:${match[2]}`))
    .filter(Boolean);
}

function getTimeOcrBox(top, bottom, run, side) {
  const runWidth = Math.max(1, run.end - run.start);
  const rowHeight = Math.max(1, bottom - top);
  const sourceWidth = Math.min(runWidth - 2, Math.max(55, runWidth * 0.48));
  const sourceHeight = Math.max(12, rowHeight * 0.52);
  const sourceX = side === "start"
    ? run.start + 2
    : run.end - sourceWidth - 2;
  const sourceY = top + (rowHeight * 0.42);
  return { x: sourceX, y: sourceY, width: sourceWidth, height: sourceHeight };
}

function createFocusedOcrCrop(analysisCanvas, sourceBox, threshold = 135) {
  const { x: sourceX, y: sourceY, width: sourceWidth, height: sourceHeight } = sourceBox;
  const scale = Math.max(3, Math.min(7, 720 / sourceWidth));
  const padding = 32;
  const crop = document.createElement("canvas");
  crop.width = Math.max(1, Math.round(sourceWidth * scale) + (padding * 2));
  crop.height = Math.max(1, Math.round(sourceHeight * scale) + (padding * 2));
  const context = crop.getContext("2d", { willReadFrequently: true });
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, crop.width, crop.height);
  context.imageSmoothingEnabled = false;
  context.drawImage(
    analysisCanvas,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    padding,
    padding,
    Math.round(sourceWidth * scale),
    Math.round(sourceHeight * scale)
  );

  const pixels = context.getImageData(0, 0, crop.width, crop.height);
  for (let index = 0; index < pixels.data.length; index += 4) {
    const luminance = (
      (pixels.data[index] * 0.299)
      + (pixels.data[index + 1] * 0.587)
      + (pixels.data[index + 2] * 0.114)
    );
    const value = threshold === "gray"
      ? Math.max(0, Math.min(255, ((luminance - 128) * 1.8) + 128))
      : (luminance < threshold ? 0 : 255);
    pixels.data[index] = value;
    pixels.data[index + 1] = value;
    pixels.data[index + 2] = value;
    pixels.data[index + 3] = 255;
  }
  context.putImageData(pixels, 0, 0);
  return crop.toDataURL("image/png");
}

function createPaddleOcrCrop(analysisCanvas, sourceBox) {
  const { x, y, width, height } = sourceBox;
  const scale = Math.max(3, Math.min(8, 900 / Math.max(1, width)));
  const padding = 40;
  const crop = document.createElement("canvas");
  crop.width = Math.max(1, Math.round(width * scale) + (padding * 2));
  crop.height = Math.max(1, Math.round(height * scale) + (padding * 2));
  const context = crop.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, crop.width, crop.height);
  context.imageSmoothingEnabled = false;
  context.drawImage(
    analysisCanvas,
    x,
    y,
    width,
    height,
    padding,
    padding,
    Math.round(width * scale),
    Math.round(height * scale)
  );
  return crop;
}

function getPaddleItemTimeCandidates(item) {
  const times = extractOcrTimesFromText(item.text).filter((time) => (
    Number(time.slice(-1)) === 0 || Number(time.slice(-1)) === 5
  ));
  if (times.length === 0) return [];
  const points = Array.isArray(item.poly) ? item.poly : [];
  const xs = points.map((point) => Number(point?.[0])).filter(Number.isFinite);
  const ys = points.map((point) => Number(point?.[1])).filter(Number.isFinite);
  const left = xs.length > 0 ? Math.min(...xs) : 0;
  const right = xs.length > 0 ? Math.max(...xs) : left;
  const bottom = ys.length > 0 ? Math.max(...ys) : 0;
  return times.map((time, index) => ({
    time,
    x: times.length === 1 ? (left + right) / 2 : left + (((index + 0.5) / times.length) * (right - left)),
    y: bottom,
    confidence: Number(item.score) || 0
  }));
}

async function recognizePlanningBlock(preparedImage, sourceBox) {
  const crop = createPaddleOcrCrop(preparedImage.analysisCanvas, sourceBox);
  const result = await recognizePlanningWithCloud(crop.toDataURL("image/png"));
  const recognizedItems = result.words.map((word) => ({
    text: word.text,
    score: word.confidence,
    poly: [
      [word.bbox.x0, word.bbox.y0],
      [word.bbox.x1, word.bbox.y0],
      [word.bbox.x1, word.bbox.y1],
      [word.bbox.x0, word.bbox.y1]
    ]
  }));
  console.info("Cloud Vision bloc sélectionné", recognizedItems.map((item) => ({
    text: item.text,
    score: item.score,
    poly: item.poly
  })));
  return recognizedItems;
}

function planningBlockContainsPro(recognizedItems) {
  const normalizedText = recognizedItems
    .map((item) => item.text || "")
    .join("")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/0/g, "O")
    .replace(/[^A-Z]/g, "");
  return normalizedText.includes("PRO");
}

function selectPlanningBlockTime(recognizedItems, type, expectedTime = "") {
  const candidates = recognizedItems
    .flatMap(getPaddleItemTimeCandidates)
    .sort((a, b) => (
      (type === "stop" ? b.x - a.x : a.x - b.x)
      || (b.y - a.y)
      || (b.confidence - a.confidence)
    ));
  if (candidates.length === 0) {
    const rawText = recognizedItems.map((item) => item.text).filter(Boolean).join(" | ");
    throw new Error(rawText
      ? `Cloud Vision n'a trouvé aucune heure HH:MM. Texte lu : ${rawText}`
      : "Cloud Vision n'a détecté aucun texte dans le bloc sélectionné.");
  }
  const selectedTime = candidates[0].time;
  if (expectedTime && getCircularTimeDifference(selectedTime, expectedTime) > 90) {
    throw new Error(`L'heure ${selectedTime} est incohérente avec la position du bloc.`);
  }
  return selectedTime;
}

async function recognizePlanningMarkerBox(box) {
  const preparedImage = await preparePlanningImage(getCurrentShift().planningCapturePath);
  const sourceBox = {
    x: box.x * preparedImage.width,
    y: box.y * preparedImage.height,
    width: box.width * preparedImage.width,
    height: box.height * preparedImage.height
  };
  fields.planningStatus.textContent = "Lecture du bloc avec Cloud Vision...";
  return recognizePlanningBlock(preparedImage, sourceBox);
}

function timeToMinutes(value) {
  const match = String(value || "").match(/^(\d{2}):(\d{2})$/);
  return match ? (Number(match[1]) * 60) + Number(match[2]) : null;
}

function getCircularTimeDifference(firstTime, secondTime) {
  const first = timeToMinutes(firstTime);
  const second = timeToMinutes(secondTime);
  if (first === null || second === null) return Infinity;
  const difference = Math.abs(first - second);
  return Math.min(difference, 1440 - difference);
}

async function readPlanningMarkerTime(box, type, expectedTime = "") {
  const recognizedItems = await recognizePlanningMarkerBox(box);
  return selectPlanningBlockTime(recognizedItems, type, expectedTime);
}

function normalizePixelBox(box, imageWidth, imageHeight) {
  if (!box) return null;
  const x = box.x ?? box.x0;
  const y = box.y ?? box.y0;
  const width = box.width ?? (box.x1 - box.x0);
  const height = box.height ?? (box.y1 - box.y0);
  return clampPlanningBox({
    x: x / imageWidth,
    y: y / imageHeight,
    width: width / imageWidth,
    height: height / imageHeight
  });
}

async function readTimeWithFocusedOcr(worker, analysisCanvas, top, bottom, run, side) {
  const sourceBox = getTimeOcrBox(top, bottom, run, side);
  for (const threshold of [135, 165, 110]) {
    const cropDataUrl = createFocusedOcrCrop(analysisCanvas, sourceBox, threshold);
    const result = await worker.recognize(cropDataUrl, {}, { text: true });
    const times = extractOcrTimesFromText(result.data.text);
    if (times.length > 0) return side === "start" ? times[0] : times[times.length - 1];
  }
  return "";
}

async function extractPlanningHours(blocks, analysisCanvas, imageWidth, imageHeight, worker) {
  const lines = getOcrLines(blocks);
  const rows = locateSimulatorRows(lines, imageWidth);
  const timeline = findTimelineMarkers(lines, imageWidth, imageHeight);
  const gridStart = timeline.timelineStart - (timeline.dayWidth * 0.026);
  const timelineEnd = gridStart + (timeline.dayWidth * 2);
  const imageData = analysisCanvas.getContext("2d").getImageData(0, 0, imageWidth, imageHeight);
  const rowTopOffset = Math.max(12, imageHeight * 0.012);

  const extracted = rows.map((row, rowIndex) => {
    const top = Math.max(0, row.centerY - rowTopOffset);
    const bottom = rowIndex + 1 < rows.length
      ? rows[rowIndex + 1].centerY - rowTopOffset
      : imageHeight;
    const allProMarkers = getProMarkers(lines, top, bottom, timeline.timelineStart);
    const visualRuns = findVisualEventRuns(imageData, top, bottom, gridStart, timelineEnd);
    const simulator = state.simulators[row.simulatorIndex];
    const simulatorKey = getPlanningSimulatorKey(simulator);
    const learnedProRule = state.planningProRules[simulatorKey];
    const hasLearnedRelativeCenter = learnedProRule?.relativeCenter !== null
      && learnedProRule?.relativeCenter !== undefined
      && Number.isFinite(Number(learnedProRule.relativeCenter));
    const learnedProTargetX = learnedProRule
      ? (hasLearnedRelativeCenter
        ? timeline.dayBoundary + (Number(learnedProRule.relativeCenter) * timeline.dayWidth)
        : Number(learnedProRule.absoluteCenter) * imageWidth)
      : null;
    const learnedProRun = learnedProTargetX !== null && visualRuns.length > 0
      ? visualRuns.reduce((nearest, run) => {
        const distance = Math.abs(((run.start + run.end) / 2) - learnedProTargetX);
        const nearestDistance = Math.abs(((nearest.start + nearest.end) / 2) - learnedProTargetX);
        return distance < nearestDistance ? run : nearest;
      }, visualRuns[0])
      : null;
    const learnedProRunIsClose = learnedProRun && (
      Math.abs(((learnedProRun.start + learnedProRun.end) / 2) - learnedProTargetX)
      <= timeline.dayWidth * 0.35
    );
    const regularRuns = visualRuns.filter((run) => (
      !run.isGray
      && (!learnedProRunIsClose || run !== learnedProRun)
      && !allProMarkers.some((marker) => marker.x >= run.start - 12 && marker.x <= run.end + 12)
    ));
    const recognitionRule = getCurrentShift().planningRecognitionRules[getPlanningSimulatorKey(simulator)] || {};
    const dayOneRuns = regularRuns
      .filter((run) => run.start < timeline.dayBoundary)
      .sort((a, b) => b.end - a.end);
    const dayTwoRuns = regularRuns
      .filter((run) => run.start >= timeline.dayBoundary)
      .sort((a, b) => a.start - b.start);
    const stopRunOffset = Math.max(0, Number(recognitionRule.stop?.runFromEnd) || 0);
    const restartRunOffset = Math.max(0, Number(recognitionRule.restart?.runFromStart) || 0);
    const lastDayOneRun = dayOneRuns[stopRunOffset];
    const firstDayTwoRun = dayTwoRuns[restartRunOffset];
    const maxSessionWidth = timeline.dayWidth / 6;
    const lastDayOneBlock = lastDayOneRun
      ? {
        ...lastDayOneRun,
        start: Math.max(lastDayOneRun.start, lastDayOneRun.end - maxSessionWidth)
      }
      : null;
    const proWindowStart = lastDayOneRun
      ? lastDayOneRun.end
      : timeline.dayBoundary - (timeline.dayWidth * 0.25);
    const proWindowEnd = firstDayTwoRun
      ? firstDayTwoRun.start
      : timeline.dayBoundary + (timeline.dayWidth * 0.5);
    const proMarkers = allProMarkers.filter((marker) => (
      marker.x >= proWindowStart - 8
      && marker.x <= proWindowEnd + 8
    ));
    const proRuns = visualRuns.filter((run) => {
      const isProAppearance = run.isGray || allProMarkers.some((marker) => (
        marker.x >= run.start - 12 && marker.x <= run.end + 12
      )) || (learnedProRunIsClose && run === learnedProRun);
      return isProAppearance
        && run.end >= proWindowStart - 8
        && run.start <= proWindowEnd + 8;
    });
    const proBoxes = proRuns.length > 0
      ? proRuns.map((run) => normalizePixelBox({
        x: run.start,
        y: top,
        width: run.end - run.start,
        height: bottom - top
      }, imageWidth, imageHeight))
      : proMarkers.map((marker) => normalizePixelBox(marker.box, imageWidth, imageHeight));
    const lastDayOneTimes = lastDayOneRun
      ? readPrintedRunTimes(lines, top, bottom, lastDayOneRun)
      : { startTime: "", endTime: "" };
    const firstDayTwoTimes = firstDayTwoRun
      ? readPrintedRunTimes(lines, top, bottom, firstDayTwoRun)
      : { startTime: "", endTime: "" };

    return {
      simulatorIndex: row.simulatorIndex,
      name: row.name,
      stopTime: "",
      restartTime: firstDayTwoTimes.startTime,
      hasPro: proRuns.length > 0 || proMarkers.length > 0,
      visualRuns,
      proMarkers,
      timeline: {
        dayBoundary: timeline.dayBoundary / imageWidth,
        dayWidth: timeline.dayWidth / imageWidth
      },
      recognitionBoxes: {
        name: normalizePixelBox(row.labelBox, imageWidth, imageHeight),
        stop: null,
        restart: firstDayTwoRun
          ? normalizePixelBox(getTimeOcrBox(top, bottom, firstDayTwoRun, "start"), imageWidth, imageHeight)
          : null,
        pro: proBoxes,
        detectedEnds: lastDayOneBlock
          ? [normalizePixelBox({
            x: lastDayOneBlock.start,
            y: top,
            width: lastDayOneBlock.end - lastDayOneBlock.start,
            height: bottom - top
          }, imageWidth, imageHeight)]
          : []
      },
      candidateRuns: regularRuns.map((run) => ({
        day: run.start < timeline.dayBoundary ? 1 : 2,
        start: run.start / imageWidth,
        end: run.end / imageWidth
      })),
      geometry: { top, bottom, lastDayOneRun, firstDayTwoRun }
    };
  });

  const missingTimeCount = extracted.reduce((count, row) => (
    count + (row.restartTime ? 0 : 1)
  ), 0);
  if (missingTimeCount > 0) {
    fields.planningStatus.textContent = "Lecture précise des horaires dans les rectangles...";
    await worker.setParameters({
      tessedit_pageseg_mode: "7",
      tessedit_char_whitelist: "0123456789:",
      preserve_interword_spaces: "1",
      user_defined_dpi: "300"
    });

    for (let index = 0; index < extracted.length; index += 1) {
      const row = extracted[index];
      const geometry = row.geometry;
      if (!row.restartTime && geometry.firstDayTwoRun) {
        row.restartTime = await readTimeWithFocusedOcr(
          worker,
          analysisCanvas,
          geometry.top,
          geometry.bottom,
          geometry.firstDayTwoRun,
          "start"
        );
      }
    }
  }

  extracted.forEach((row) => delete row.geometry);

  return extracted;
}

function extractPlanningSimulatorNames(blocks, imageWidth, imageHeight) {
  const lines = getOcrLines(blocks);
  const rows = locateSimulatorRows(lines, imageWidth);
  const timeline = findTimelineMarkers(lines, imageWidth, imageHeight);
  return rows.map((row) => ({
    simulatorIndex: row.simulatorIndex,
    name: row.name,
    stopTime: "",
    restartTime: "",
    hasPro: false,
    timeline: {
      dayBoundary: timeline.dayBoundary / imageWidth,
      dayWidth: timeline.dayWidth / imageWidth
    },
    recognitionBoxes: {
      name: normalizePixelBox(row.labelBox, imageWidth, imageHeight)
    },
    candidateRuns: []
  }));
}

function clearPlanningScheduleData(shift) {
  shift.planningAnnotations = [];
  shift.planningDetectedEndBoxes = [];
  shift.planningRecognitionRules = {};
  shift.assignments = shift.assignments.map((assignment) => ({
    ...assignment,
    stopTime: "",
    restartTime: "",
    isPro1: false,
    isPro2: false
  }));
}

function showPlanningValidationDialog(problems, message = "La capture n'a pas été ajoutée.") {
  fields.planningValidationMessage.textContent = message;
  fields.planningValidationProblems.replaceChildren(...problems.map((problem) => {
    const item = document.createElement("li");
    item.textContent = problem;
    return item;
  }));

  fields.planningValidationDialog.classList.add("is-open");
}

function closePlanningValidationDialog() {
  fields.planningValidationDialog.classList.remove("is-open");
}

async function validatePlanningCapture(dataUrl, { namesOnly = false } = {}) {
  if (namesOnly) {
    const preparedImage = await preparePlanningImage(dataUrl);
    fields.planningStatus.textContent = "Vérification des deux jours du planning...";
    const cloudResult = await recognizePlanningWithCloud(
      preparedImage.analysisCanvas.toDataURL("image/jpeg", 0.94)
    );
    const dates = findPlanningDates(cloudResult.text);
    if (dates.length < 2) {
      return {
        isValid: false,
        dates,
        missingSimulators: [],
        blocks: cloudResult.blocks,
        extractedHours: [],
        annotations: [],
        analysisCanvas: preparedImage.analysisCanvas,
        dimensions: { width: preparedImage.width, height: preparedImage.height }
      };
    }

    fields.planningStatus.textContent = "Recherche des noms de simulateurs...";
    const extractedHours = extractPlanningSimulatorNames(
      cloudResult.blocks,
      preparedImage.width,
      preparedImage.height
    );
    const annotations = extractedHours.flatMap((item) => {
      const simulator = state.simulators[item.simulatorIndex];
      const key = getPlanningSimulatorKey(simulator);
      if (!key) return [];
      return [{
        key,
        simulatorName: simulator.name,
        planningText: simulator.planningText,
        boxes: item.recognitionBoxes,
        timeline: item.timeline,
        values: {},
        candidates: []
      }];
    });
    return {
      ...validatePlanningText(cloudResult.text),
      blocks: cloudResult.blocks,
      extractedHours,
      annotations,
      analysisCanvas: preparedImage.analysisCanvas,
      dimensions: { width: preparedImage.width, height: preparedImage.height }
    };
  }

  const Tesseract = await loadOcrLibrary();
  const preparedImage = await preparePlanningImage(dataUrl);
  let lastError = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    let worker = null;
    try {
      if (attempt > 0) {
        fields.planningStatus.textContent = "Nouvelle tentative avec le cache OCR réinitialisé...";
      }
      worker = await createPlanningOcrWorker(Tesseract, {
        logger: ({ status, progress }) => {
          if (status === "recognizing text") {
            fields.planningStatus.textContent = `Vérification du planning : ${Math.round(progress * 100)} %`;
          }
        }
      }, attempt > 0);
      await worker.setParameters({
        tessedit_pageseg_mode: "11",
        preserve_interword_spaces: "1",
        user_defined_dpi: "300"
      });
      const result = await worker.recognize(preparedImage.dataUrl, {}, { text: true, blocks: true });
      const extractedHours = namesOnly
        ? extractPlanningSimulatorNames(
          result.data.blocks,
          preparedImage.width,
          preparedImage.height
        )
        : await extractPlanningHours(
          result.data.blocks,
          preparedImage.analysisCanvas,
          preparedImage.width,
          preparedImage.height,
          worker
        );
      const annotations = extractedHours.flatMap((item) => {
        const simulator = state.simulators[item.simulatorIndex];
        const key = getPlanningSimulatorKey(simulator);
        if (!key) return [];
        const boxes = Object.fromEntries(
          Object.entries(item.recognitionBoxes || {}).filter(([, box]) => box)
        );
        return [{
          key,
          simulatorName: simulator.name,
          planningText: simulator.planningText,
          boxes,
          timeline: item.timeline,
          values: {
            ...(item.stopTime ? { stop: item.stopTime } : {}),
            ...(item.restartTime ? { restart: item.restartTime } : {})
          },
          candidates: item.candidateRuns || []
        }];
      });
      return {
        ...validatePlanningText(result.data.text),
        blocks: result.data.blocks,
        extractedHours,
        annotations,
        analysisCanvas: preparedImage.analysisCanvas,
        dimensions: {
          width: preparedImage.width,
          height: preparedImage.height
        }
      };
    } catch (error) {
      lastError = error;
      console.error(`Échec OCR, tentative ${attempt + 1}`, error);
    } finally {
      if (worker) await worker.terminate().catch(() => {});
    }
  }

  throw new Error(`Lecture OCR impossible : ${describeOcrError(lastError)}.`);
}

async function importPlanningCaptureDataUrl(dataUrl) {
  if (!String(dataUrl || "").startsWith("data:image/")) return false;

  let storedCapture = dataUrl;
  if (window.location.protocol.startsWith("http")) {
    try {
      const response = await fetch("/api/upload-planning-capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl, shiftDate: state.shiftDate })
      });
      if (!response.ok) throw new Error("Stockage serveur indisponible");
      const result = await response.json();
      storedCapture = result.imagePath || dataUrl;
    } catch {
      storedCapture = await storePlanningCaptureInBrowser(dataUrl, state.shiftDate);
    }
  } else {
    storedCapture = await storePlanningCaptureInBrowser(dataUrl, state.shiftDate);
  }

  getCurrentShift().planningCapturePath = storedCapture;
  getCurrentShift().planningCaptureRevision = crypto.randomUUID();
  getCurrentShift().sharedCaptureReference = "";
  saveState();
  updatePlanningPreview();
  return true;
}

async function applyPlanningCaptureDataUrl(dataUrl) {
  if (!await requirePlanningEdit()) return false;
  if (!String(dataUrl || "").startsWith("data:image/")) {
    throw new Error("La capture transmise n'est pas une image.");
  }

  fields.planningStatus.textContent = "Vérification des deux jours du planning...";
  const validation = await validatePlanningCapture(dataUrl, { namesOnly: true });

  if (validation.dates.length < 2) {
    const problem = "Le planning ne montre pas deux jours complets avec leurs dates.";
    fields.planningStatus.textContent = "Capture refusée : le planning doit afficher deux jours.";
    showPlanningValidationDialog(
      [problem],
      "Le planning n'a pas été collé et la reconnaissance des simulateurs n'a pas été lancée."
    );
    return false;
  }

  const problems = [];
  if (validation.missingSimulators.length > 0) {
    problems.push(`Simulateurs non visibles : ${validation.missingSimulators.join(", ")}.`);
  }

  const shift = getCurrentShift();
  clearPlanningScheduleData(shift);
  shift.planningAnnotations = validation.annotations;
  await importPlanningCaptureDataUrl(dataUrl);
  renderSimulators();
  renderPreview();
  const recognizedCount = validation.annotations.length;
  const plural = recognizedCount === 1 ? "" : "s";
  fields.planningStatus.textContent = problems.length > 0
    ? `Capture importée : ${recognizedCount} nom${plural} de simulateur reconnu${plural}. Pointez maintenant les blocs horaires, PRO1 et PRO2.`
    : `Capture validée : ${recognizedCount} nom${plural} de simulateur reconnu${plural}. Pointez maintenant les blocs horaires, PRO1 et PRO2.`;

  if (problems.length > 0) {
    showPlanningValidationDialog(
      problems,
      recognizedCount > 0
        ? "La capture a été ajoutée avec les noms de simulateurs reconnus."
        : "La capture a été ajoutée, mais aucun nom de simulateur n'a été reconnu."
    );
  }
  return true;
}

function showPlanningPasteError(error) {
  const permissionDenied = error?.name === "NotAllowedError";
  const message = permissionDenied
    ? "Autorise l'accès au presse-papiers dans Chrome, puis clique sur Coller à nouveau."
    : (error?.message || "La capture n'a pas pu être vérifiée.");
  fields.planningStatus.textContent = message;
  if (!permissionDenied) {
    showPlanningValidationDialog([message], "Impossible de vérifier la capture.");
  }
}

async function importPlanningCaptureFromSimFlowWork(dataUrl) {
  activeView = "planning";
  renderCurrentView();
  fields.pastePlanningCaptureBtn.disabled = true;
  fields.planningStatus.textContent = "Analyse de l'image copiée...";

  try {
    await applyPlanningCaptureDataUrl(dataUrl);
  } catch (error) {
    showPlanningPasteError(error);
  } finally {
    fields.pastePlanningCaptureBtn.disabled = false;
  }
}

window.simflowImportPlanningCaptureDataUrl = importPlanningCaptureFromSimFlow;

async function pastePlanningFromClipboardWork() {
  activeView = "planning";
  renderCurrentView();
  fields.pastePlanningCaptureBtn.disabled = true;
  fields.planningStatus.textContent = "Lecture du presse-papiers...";

  try {
    if (!navigator.clipboard?.read) {
      throw new Error("Le navigateur n'autorise pas la lecture du presse-papiers.");
    }

    const clipboardItems = await navigator.clipboard.read();
    const imageItem = clipboardItems.find((item) => (
      item.types.some((type) => type.startsWith("image/"))
    ));
    const imageType = imageItem?.types.find((type) => type.startsWith("image/"));

    if (!imageItem || !imageType) {
      throw new Error("Le presse-papiers ne contient pas d'image.");
    }

    const imageBlob = await imageItem.getType(imageType);
    const dataUrl = await blobToDataUrl(imageBlob);
    await applyPlanningCaptureDataUrl(dataUrl);
  } catch (error) {
    showPlanningPasteError(error);
  } finally {
    fields.pastePlanningCaptureBtn.disabled = false;
  }
}

function createPlanningAiBackup(shift) {
  return {
    schedule: shift.assignments.map((assignment) => ({
      stopTime: assignment.stopTime || "",
      restartTime: assignment.restartTime || "",
      isPro1: Boolean(assignment.isPro1),
      isPro2: Boolean(assignment.isPro2)
    })),
    planningAnnotations: structuredClone(shift.planningAnnotations),
    planningDetectedEndBoxes: structuredClone(shift.planningDetectedEndBoxes),
    planningRecognitionRules: structuredClone(shift.planningRecognitionRules),
    createdAt: new Date().toISOString()
  };
}

function clearPlanningAiResults(shift) {
  shift.assignments = shift.assignments.map((assignment) => ({
    ...assignment,
    stopTime: "",
    restartTime: "",
    isPro1: false,
    isPro2: false
  }));
  shift.planningAnnotations.forEach((annotation) => {
    annotation.boxes = annotation.boxes || {};
    ["stop", "restart", "pro1", "pro2", "pro", "pending"].forEach((type) => delete annotation.boxes[type]);
    annotation.values = {};
  });
  shift.planningDetectedEndBoxes = [];
  shift.planningRecognitionRules = {};
}

function normalizePlanningAiBox(coordinates) {
  if (!Array.isArray(coordinates) || coordinates.length !== 4) return null;
  const [top, left, bottom, right] = coordinates.map((value) => Number(value) / 1000);
  if (![top, left, bottom, right].every(Number.isFinite) || bottom <= top || right <= left) return null;
  return clampPlanningBox({
    x: left,
    y: top,
    width: right - left,
    height: bottom - top
  });
}

function planningBoxToAiCoordinates(box) {
  const normalized = clampPlanningBox(box);
  return [
    normalized.y * 1000,
    normalized.x * 1000,
    (normalized.y + normalized.height) * 1000,
    (normalized.x + normalized.width) * 1000
  ];
}

function getPlanningAiTimeEdge(block, box, boundary, dayWidth, minutes) {
  const originalEdge = block.type === "stop" ? box.x + box.width : box.x;
  const dayOneEdge = boundary - dayWidth + (minutes / 1440) * dayWidth;
  const dayTwoEdge = dayOneEdge + dayWidth;
  if (block.type === "stop" && minutes < 720) return dayTwoEdge;
  return Math.abs(dayOneEdge - originalEdge) < Math.abs(dayTwoEdge - originalEdge)
    ? dayOneEdge : dayTwoEdge;
}

async function alignPlanningAiBlocks(blocks, preparedImage) {
  const context = preparedImage.analysisCanvas.getContext("2d", { willReadFrequently: true });
  const imageData = context.getImageData(0, 0, preparedImage.width, preparedImage.height);
  const alignedBlocks = [];

  for (const block of blocks) {
    const originalBox = normalizePlanningAiBox(block?.box);
    const simulator = state.simulators.find((item) => (
      compactPlanningText(item.name) === compactPlanningText(block?.simulator)
    ));
    const annotation = simulator ? getPlanningAnnotation(simulator, false) : null;
    if (!originalBox || !annotation) {
      alignedBlocks.push(block);
      continue;
    }

    const nameBox = clampPlanningBox(annotation.boxes?.name || {});
    const originalCenterY = originalBox.y + (originalBox.height / 2);
    const nameCenterY = nameBox.y + (nameBox.height / 2);
    const rowY = nameBox.height > 0 && Math.abs(originalCenterY - nameCenterY) > Math.max(0.018, nameBox.height * 2)
      ? nameCenterY : originalCenterY;
    const originalCenterX = originalBox.x + (originalBox.width / 2);
    const timelineDayWidth = Number(annotation.timeline?.dayWidth);
    const timelineBoundary = Number(annotation.timeline?.dayBoundary);
    const blockMinutes = timeToMinutes(block?.time);
    const hasTimelineTime = ["stop", "restart"].includes(block?.type)
      && Number.isFinite(timelineDayWidth)
      && timelineDayWidth > 0
      && Number.isFinite(timelineBoundary)
      && blockMinutes !== null;
    const expectedEdgeX = hasTimelineTime
      ? getPlanningAiTimeEdge(block, originalBox, timelineBoundary, timelineDayWidth, blockMinutes)
      : null;
    const maximumBlockWidth = Number.isFinite(timelineDayWidth) && timelineDayWidth > 0
      ? timelineDayWidth / 6
      : Math.max(originalBox.width, 0.04);
    const candidateXs = [originalCenterX];
    if (hasTimelineTime) {
      [0.12, 0.28, 0.5, 0.78].forEach((relativePosition) => {
        candidateXs.push(expectedEdgeX + (
          block.type === "stop" ? -1 : 1
        ) * maximumBlockWidth * relativePosition);
      });
    } else {
      [0.2, 0.4, 0.6, 0.8].forEach((relativePosition) => {
        candidateXs.push(originalBox.x + (originalBox.width * relativePosition));
      });
    }

    try {
      const candidates = [];
      for (const candidateX of [...new Set(candidateXs.map((value) => (
        Math.max(0, Math.min(1, Math.round(value * 10000) / 10000))
      )))]) {
        const point = { x: candidateX, y: rowY };
        const detected = await detectPlanningSessionBlock(
          point,
          annotation,
          preparedImage,
          imageData,
          false,
          true
        );
        if (!detected) continue;
        const detectedBox = constrainPlanningBlockDuration(detected, point, annotation);
        const detectedCenterY = detectedBox.y + (detectedBox.height / 2);
        const maximumRowShift = Math.max(0.018, nameBox.height * 2.5);
        if (Math.abs(detectedCenterY - rowY) > maximumRowShift) continue;
        const detectedEdgeX = block.type === "stop"
          ? detectedBox.x + detectedBox.width
          : detectedBox.x;
        const horizontalScore = hasTimelineTime
          ? Math.abs(detectedEdgeX - expectedEdgeX)
          : Math.abs((detectedBox.x + (detectedBox.width / 2)) - originalCenterX);
        candidates.push({
          box: detectedBox,
          score: horizontalScore + Math.abs(detectedCenterY - rowY)
        });
      }

      const bestCandidate = candidates.sort((first, second) => first.score - second.score)[0];
      alignedBlocks.push({
        ...block,
        box: planningBoxToAiCoordinates(bestCandidate?.box || originalBox)
      });
    } catch {
      alignedBlocks.push(block);
    }
  }

  return alignedBlocks;
}

function applyPlanningAiBlocks(shift, blocks) {
  clearPlanningAiResults(shift);
  const results = { applied: 0, pending: 0 };
  const selectedTypes = new Set();

  [...blocks]
    .sort((first, second) => (Number(second.confidence) || 0) - (Number(first.confidence) || 0))
    .forEach((block) => {
      const simulatorIndex = state.simulators.findIndex((simulator) => (
        compactPlanningText(simulator.name) === compactPlanningText(block.simulator)
      ));
      const simulator = state.simulators[simulatorIndex];
      const box = normalizePlanningAiBox(block.box);
      if (!simulator || !box || !["stop", "restart", "pro1", "pro2"].includes(block.type)) return;

      const existingAnnotation = getPlanningAnnotation(simulator, false);
      if (isProMarkerType(block.type) && existingAnnotation?.timeline?.dayBoundary != null
        && Number.isFinite(Number(existingAnnotation.timeline.dayBoundary))) {
        block = { ...block, type: getPlanningProTypeForBox(box, existingAnnotation) };
      }

      const uniqueTypeKey = `${simulatorIndex}:${block.type}`;
      if (selectedTypes.has(uniqueTypeKey)) return;
      selectedTypes.add(uniqueTypeKey);

      const annotation = getPlanningAnnotation(simulator, true);
      annotation.simulatorName = simulator.name;
      annotation.planningText = simulator.planningText;
      annotation.boxes = annotation.boxes || {};
      annotation.values = annotation.values || {};
      const confidence = Number(block.confidence) || 0;
      const time = isProMarkerType(block.type) ? "" : (parseOcrTime(block.time) || "");
      if (confidence < 0.65 || (!isProMarkerType(block.type) && !time)) {
        addPendingPlanningMarker(annotation, box);
        results.pending += 1;
        return;
      }

      if (isProMarkerType(block.type)) {
        annotation.boxes[block.type] = box;
        shift.assignments[simulatorIndex] = {
          ...shift.assignments[simulatorIndex],
          [block.type === "pro1" ? "isPro1" : "isPro2"]: true
        };
      } else {
        annotation.boxes[block.type] = box;
        annotation.values[block.type] = time;
        shift.assignments[simulatorIndex] = {
          ...shift.assignments[simulatorIndex],
          [block.type === "stop" ? "stopTime" : "restartTime"]: time
        };
      }
      results.applied += 1;
    });

  return results;
}

async function analyzePlanningWithAIWork() {
  if (window.simflowNightPlanningIsAdmin !== true) {
    fields.planningStatus.textContent = "Le pointage automatique est réservé à l'admin.";
    return;
  }
  if (!await requirePlanningEdit()) return;
  const shiftDate = state.shiftDate;
  const shift = getCurrentShift();
  if (!shift.planningCapturePath) return;
  if (!window.confirm(
    "L’IA va remplacer les cadres, les horaires et les séances PRO1/PRO2 actuels. Continuer ?"
  )) return;
  if (typeof window.simflowAnalyzeNightPlanningWithAI !== "function") {
    showPlanningValidationDialog(
      ["Le service d’analyse IA n’est pas disponible dans cette version."],
      "Analyse IA impossible."
    );
    return;
  }

  fields.analyzePlanningAiBtn.disabled = true;
  fields.recalculatePlanningBtn.disabled = true;
  fields.pastePlanningCaptureBtn.disabled = true;
  fields.planningStatus.textContent = "Analyse des blocs avec Gemini...";
  try {
    const preparedImage = await preparePlanningImage(shift.planningCapturePath);
    const result = await window.simflowAnalyzeNightPlanningWithAI(
      preparedImage.analysisCanvas.toDataURL("image/jpeg", 0.94),
      getPlanningConfiguredSimulators().map((simulator) => ({
        name: simulator.name,
        planningText: simulator.planningText
      })), shiftDate
    );
    if (state.shiftDate !== shiftDate) {
      throw new Error("La date a changé pendant l’analyse.");
    }
    const blocks = Array.isArray(result?.blocks) ? result.blocks : [];
    if (!blocks.length) {
      throw new Error("L’IA n’a trouvé aucun bloc exploitable.");
    }

    fields.planningStatus.textContent = "Alignement des cadres sur les séances du planning...";
    const alignedBlocks = await alignPlanningAiBlocks(blocks, preparedImage);
    shift.planningAiBackup = createPlanningAiBackup(shift);
    const summary = applyPlanningAiBlocks(shift, alignedBlocks);
    saveState();
    renderPlanningAnnotationEditor();
    renderSimulators();
    renderPreview();
    const quotaMessage = result?.quota?.unlimited
      ? ""
      : ` Il vous reste ${result?.quota?.remaining ?? 0} analyse${result?.quota?.remaining === 1 ? "" : "s"} IA aujourd’hui.`;
    fields.planningStatus.textContent = summary.pending > 0
      ? `Analyse IA terminée : ${summary.applied} blocs appliqués et ${summary.pending} bloc${summary.pending > 1 ? "s" : ""} à vérifier en jaune.${quotaMessage}`
      : `Analyse IA terminée : ${summary.applied} blocs appliqués.${quotaMessage}`;
  } catch (error) {
    const message = error?.message || "L’analyse IA du planning a échoué.";
    fields.planningStatus.textContent = message;
    showPlanningValidationDialog([message], "Analyse IA impossible.");
  } finally {
    fields.pastePlanningCaptureBtn.disabled = false;
    fields.recalculatePlanningBtn.disabled = !getCurrentShift().planningCapturePath;
    fields.analyzePlanningAiBtn.disabled = !getCurrentShift().planningCapturePath;
  }
}

async function clearPlanningCapture() {
  if (!await requirePlanningEdit(false, true)) return;
  const shift = getCurrentShift();
  if (!shift.planningCapturePath) return;
  const confirmed = window.confirm(
    "Effacer le planning collé, tous ses repères et les horaires ou séances PRO1/PRO2 reconnus pour cette date ?"
  );
  if (!confirmed) return;

  if (typeof window.simflowSaveNightPlanningCapture !== "function") {
    fields.planningStatus.textContent = "Vérification serveur indisponible. Suppression annulée.";
    return;
  }
  fields.clearPlanningCaptureBtn.disabled = true;
  const clearingDate = state.shiftDate;
  planningCaptureDeletions.add(clearingDate);
  if (typeof window.simflowSaveNightPlanningCapture === "function") {
    try {
      window.clearTimeout(annotationsSaveTimer);
      await annotationsSaveQueue.catch(() => {});
      await planningCapturePublishQueue.catch(() => {});
      await window.simflowSaveNightPlanningCapture(clearingDate, null);
      shift.sharedCaptureReference = "";
    } catch (error) {
      planningCaptureDeletions.delete(clearingDate);
      fields.clearPlanningCaptureBtn.disabled = false;
      fields.planningStatus.textContent = "Suppression du planning partagé impossible. Réessayez.";
      return;
    }
  }
  try {
    await deletePlanningCaptureFromBrowser(state.shiftDate);
  } catch (error) {
    console.warn("Suppression de la capture locale incomplète", error);
  }

  isPickingScheduleBlocks = false;
  shift.planningCapturePath = "";
  planningCaptureDeletions.delete(clearingDate);
  shift.planningAiBackup = null;
  clearPlanningScheduleData(shift);
  saveState();
  await updatePlanningPreview();
  renderSimulators();
  renderPreview();
  fields.planningStatus.textContent = "Le planning collé a été effacé.";
}

async function recalculatePlanningCaptureWork() {
  if (!await requirePlanningEdit(false, true)) return;
  const shift = getCurrentShift();
  if (!shift.planningCapturePath) return;
  const confirmed = window.confirm(
    "Effacer tous les blocs, les horaires et les séances PRO1/PRO2, puis rechercher uniquement les noms de simulateurs ?"
  );
  if (!confirmed) return;

  const resettingDate = state.shiftDate;
  if (typeof window.simflowSaveNightPlanningAnnotations !== "function") {
    fields.planningStatus.textContent = "Vérification serveur indisponible. Réinitialisation annulée.";
    return;
  }
  const clearedSharedState = {
    simulators: state.simulators,
    annotations: [],
    schedule: shift.assignments.map(() => ({ stopTime: "", restartTime: "", isPro1: false, isPro2: false }))
  };
  try {
    window.clearTimeout(annotationsSaveTimer);
    await annotationsSaveQueue.catch(() => {});
    await window.simflowSaveNightPlanningAnnotations(resettingDate, clearedSharedState);
    savedAnnotationStates.set(resettingDate, JSON.stringify(clearedSharedState));
  } catch (error) {
    nightPlanningAccessCache = null;
    fields.planningStatus.textContent = error.message || "Réinitialisation refusée.";
    void refreshNightPlanningAccess().catch(() => {});
    return;
  }
  if (state.shiftDate !== resettingDate) return;
  clearPlanningScheduleData(shift);
  saveState();
  renderPlanningAnnotationEditor();
  renderSimulators();
  renderPreview();
  fields.pastePlanningCaptureBtn.disabled = true;
  fields.recalculatePlanningBtn.disabled = true;
  fields.planningStatus.textContent = "Recherche des noms de simulateurs à gauche du planning...";

  try {
    const validation = await validatePlanningCapture(
      shift.planningCapturePath,
      { namesOnly: true }
    );
    const problems = [];

    if (validation.dates.length < 2) {
      problems.push("Le planning ne montre pas deux jours complets avec leurs dates.");
    }
    if (validation.missingSimulators.length > 0) {
      problems.push(`Simulateurs non visibles : ${validation.missingSimulators.join(", ")}.`);
    }
    shift.planningAnnotations = validation.annotations;
    saveState();
    updatePlanningPreview();
    renderSimulators();
    renderPreview();

    const recognizedCount = validation.annotations.length;
    const plural = recognizedCount === 1 ? "" : "s";
    fields.planningStatus.textContent = `Recalcul terminé : ${recognizedCount} nom${plural} de simulateur reconnu${plural}. Pointez maintenant les blocs horaires, PRO1 et PRO2.`;

    if (problems.length > 0) {
      showPlanningValidationDialog(
        problems,
        recognizedCount > 0
          ? "Les noms reconnus ont été mis à jour."
          : "Aucun nom de simulateur n'a été reconnu."
      );
    }
  } catch (error) {
    const message = describeOcrError(error) || "La reconnaissance du planning a échoué.";
    fields.planningStatus.textContent = message;
    showPlanningValidationDialog([message], "Impossible de recalculer le planning.");
  } finally {
    fields.pastePlanningCaptureBtn.disabled = false;
    fields.recalculatePlanningBtn.disabled = !getCurrentShift().planningCapturePath;
  }
}

function toggleScheduleBlockPicking() {
  const shift = getCurrentShift();
  if (!shift.planningCapturePath) return;

  isPickingScheduleBlocks = !isPickingScheduleBlocks;
  fields.showDetectedEndsBtn.textContent = isPickingScheduleBlocks
    ? "Terminer le pointage"
    : "Pointage Manuel";
  fields.showDetectedEndsBtn.setAttribute("aria-pressed", String(isPickingScheduleBlocks));
  fields.planningStatus.textContent = isPickingScheduleBlocks
    ? "Clique dans un bloc d'arrêt, de reprise ou PRO. L'app déterminera Arrêt, Reprise, PRO1 ou PRO2 selon sa position par rapport à minuit."
    : "Pointage des blocs horaires terminé.";
  renderPlanningAnnotationEditor();
}

function showPlanningView() {
  activeView = "planning";
  renderCurrentView();
  renderPlanningAnnotationEditor();
  fields.planningStatus.textContent = getCurrentShift().planningCapturePath
    ? ""
    : "Copie une capture du planning, puis clique sur Coller Planning.";
}

function updateSimulator(index, patch) {
  const shift = getCurrentShift();
  shift.assignments[index] = { ...shift.assignments[index], ...patch };
  saveState();
  renderPreview();
}

function updateSimulatorAndRender(index, patch) {
  const shift = getCurrentShift();
  shift.assignments[index] = { ...shift.assignments[index], ...patch };
  saveState();
  renderSimulators();
  renderPreview();
}

function addTask(index) {
  const assignment = getCurrentShift().assignments[index];
  updateSimulatorAndRender(index, {
    tasks: [...(assignment.tasks || []), ""]
  });
}

function updateTask(index, taskIndex, value) {
  const assignment = getCurrentShift().assignments[index];
  const tasks = [...(assignment.tasks || [])];
  tasks[taskIndex] = value;
  updateSimulator(index, { tasks });
}

function updateShortStopState(card, stopInput, restartInput) {
  card.classList.toggle("has-short-stop", isStopDurationShort(stopInput.value, restartInput.value));
}

function markTimeKeyboardEntry(event) {
  if (/^\d$/.test(event.key)) {
    event.currentTarget.dataset.keyboardEntry = "1";
    event.currentTarget.dataset.keyboardDigitCount = String(Number(event.currentTarget.dataset.keyboardDigitCount || 0) + 1);
  }

  if (event.key === "Backspace" || event.key === "Delete") {
    event.currentTarget.dataset.keyboardDigitCount = "0";
    delete event.currentTarget.dataset.keyboardEntry;
    delete event.currentTarget.dataset.lastAutoFocusValue;
  }
}

function resetTimeKeyboardEntry(event) {
  event.currentTarget.dataset.keyboardDigitCount = "0";
  delete event.currentTarget.dataset.keyboardEntry;
  delete event.currentTarget.dataset.lastAutoFocusValue;
}

function hasEnteredCompleteTime(timeInput) {
  return Number(timeInput.dataset.keyboardDigitCount || 0) >= 4;
}

function focusTimeInput(nextInput) {
  if (!nextInput) return;

  window.setTimeout(() => {
    nextInput.focus();
    if (typeof nextInput.select === "function") {
      nextInput.select();
    }
  }, 0);
}

function focusNextTimeAfterCompleteEntry(timeInput, nextInput) {
  if (!/^\d{2}:\d{2}$/.test(timeInput.value)) return;
  if (!hasEnteredCompleteTime(timeInput)) return;
  if (timeInput.dataset.lastAutoFocusValue === timeInput.value) return;

  timeInput.dataset.lastAutoFocusValue = timeInput.value;
  delete timeInput.dataset.keyboardEntry;
  focusTimeInput(nextInput);
}

function handleTimeKeyUp(event, nextInput) {
  if (!/^\d$/.test(event.key)) return;
  focusNextTimeAfterCompleteEntry(event.currentTarget, nextInput);
}

function handleTimeInput(timeInput, nextInput, previousValue) {
  if (!/^\d{2}:\d{2}$/.test(timeInput.value)) return;
  if (/^\d{2}:\d{2}$/.test(previousValue || "")) return;
  if (timeInput.dataset.keyboardEntry !== "1") return;
  if (!hasEnteredCompleteTime(timeInput)) return;
  if (timeInput.dataset.lastAutoFocusValue === timeInput.value) return;

  timeInput.dataset.lastAutoFocusValue = timeInput.value;
  delete timeInput.dataset.keyboardEntry;
  focusTimeInput(nextInput);
}

function removeTask(index, taskIndex) {
  const assignment = getCurrentShift().assignments[index];
  const tasks = [...(assignment.tasks || [])];
  tasks.splice(taskIndex, 1);
  updateSimulatorAndRender(index, { tasks });
}

function updateSimulatorSettings(index, patch) {
  state.simulators[index] = { ...state.simulators[index], ...patch };
  saveState();
  renderSimulators();
  renderPreview();
}

function exportSimulatorSettings() {
  const settings = {
    format: "organisation-vacation-simulator-settings",
    version: 1,
    exportedAt: new Date().toISOString(),
    simulators: state.simulators.map(({ id, name, planningText, color }) => ({
      id,
      name,
      planningText,
      color
    })),
    simulatorColors: [...state.simulatorColors],
    planningProRules: structuredClone(state.planningProRules || {})
  };
  const blob = new Blob([`${JSON.stringify(settings, null, 2)}\n`], {
    type: "application/json"
  });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = "organisation-vacation-parametres.json";
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
}

async function importSimulatorSettings(file) {
  const imported = JSON.parse(await file.text());
  if (
    imported?.format !== "organisation-vacation-simulator-settings"
    || !Array.isArray(imported.simulators)
    || imported.simulators.length === 0
  ) {
    throw new Error("Ce fichier ne contient pas des paramètres simulateurs valides.");
  }

  const previousSimulators = state.simulators;
  const simulators = imported.simulators.map((simulator, index) => ({
    id: index + 1,
    name: String(simulator?.name || `SIM ${String(index + 1).padStart(2, "0")}`).trim(),
    planningText: String(simulator?.planningText || "").trim(),
    color: normalizeColor(simulator?.color) || ""
  }));

  Object.values(state.shifts).forEach((shift) => {
    const previousAssignments = shift.assignments || [];
    shift.assignments = simulators.map((simulator, index) => {
      const previousIndex = previousSimulators.findIndex((previous) => previous.name === simulator.name);
      const previousAssignment = previousAssignments[previousIndex >= 0 ? previousIndex : index];
      return {
        ...createDefaultAssignment(index),
        ...(previousAssignment || {}),
        id: index + 1
      };
    });
  });

  state.simulators = simulators;
  state.simulatorColors = [...new Set([
    ...(Array.isArray(imported.simulatorColors) ? imported.simulatorColors : []),
    ...simulators.map((simulator) => simulator.color)
  ].map(normalizeColor).filter(Boolean))];
  state.planningProRules = imported.planningProRules && typeof imported.planningProRules === "object"
    ? imported.planningProRules
    : {};

  saveState();
  render();
}

function rememberSimulatorColor(color) {
  const normalizedColor = normalizeColor(color);
  if (!normalizedColor) return "";

  state.simulatorColors = [
    normalizedColor,
    ...(state.simulatorColors || []).filter((savedColor) => savedColor !== normalizedColor)
  ].slice(0, 18);

  return normalizedColor;
}

function updateSimulatorColor(index, color) {
  const normalizedColor = rememberSimulatorColor(color);
  if (!normalizedColor) return;

  updateSimulatorSettings(index, { color: normalizedColor });
  renderSimulatorSettings();
  renderColorPopover();
}

function clearSimulatorColor(index) {
  updateSimulatorSettings(index, { color: "" });
  renderSimulatorSettings();
  renderColorPopover();
}

function deleteSimulatorColor(color) {
  const normalizedColor = normalizeColor(color);
  if (!normalizedColor) return;

  state.simulatorColors = (state.simulatorColors || []).filter((savedColor) => savedColor !== normalizedColor);
  state.simulators = state.simulators.map((simulator) => (
    normalizeColor(simulator.color) === normalizedColor
      ? { ...simulator, color: "" }
      : simulator
  ));

  saveState();
  renderSimulators();
  renderSimulatorSettings();
  renderPreview();
  renderColorPopover();
}

function reindexSimulators() {
  state.simulators = state.simulators.map((simulator, index) => ({
    ...simulator,
    id: index + 1
  }));

  Object.values(state.shifts).forEach((shift) => {
    shift.assignments = (shift.assignments || []).map((assignment, index) => ({
      ...assignment,
      id: index + 1
    }));
  });
}

function addSimulator() {
  const nextIndex = state.simulators.length;
  state.simulators.push({
    id: nextIndex + 1,
    name: `SIM ${String(nextIndex + 1).padStart(2, "0")}`,
    planningText: "",
    color: ""
  });

  Object.values(state.shifts).forEach((shift) => {
    shift.assignments = [...(shift.assignments || []), createDefaultAssignment(nextIndex)];
  });

  saveState();
  render();
}

function removeSimulator(index) {
  state.simulators.splice(index, 1);
  Object.values(state.shifts).forEach((shift) => {
    shift.assignments = [...(shift.assignments || [])];
    shift.assignments.splice(index, 1);
  });
  reindexSimulators();
  saveState();
  render();
}

function moveSimulator(index, direction) {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= state.simulators.length) return;

  [state.simulators[index], state.simulators[nextIndex]] = [state.simulators[nextIndex], state.simulators[index]];
  Object.values(state.shifts).forEach((shift) => {
    shift.assignments = [...(shift.assignments || [])];
    [shift.assignments[index], shift.assignments[nextIndex]] = [shift.assignments[nextIndex], shift.assignments[index]];
  });

  reindexSimulators();
  saveState();
  render();
}

function updateShiftDate(dateValue) {
  state.shiftDate = dateValue || defaultState.shiftDate;
  getCurrentShift();
  saveState();
  render();
}

function formatDate(dateValue) {
  if (!dateValue) return "-";
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(new Date(`${dateValue}T12:00:00`));
}

function escapeText(value) {
  const span = document.createElement("span");
  span.textContent = value || "";
  return span.innerHTML.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function normalizeColor(value) {
  const color = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color.toUpperCase() : "";
}

function colorStyle(color) {
  const normalizedColor = normalizeColor(color);
  return normalizedColor ? ` style="--sim-color: ${normalizedColor};"` : "";
}

function renderColorPalette(selectedColor) {
  const colors = (state.simulatorColors || []).map(normalizeColor).filter(Boolean);
  if (colors.length === 0) {
    return `<p class="empty-colors">Aucune couleur favorite</p>`;
  }

  return colors.map((color) => `
    <span class="color-chip">
      <button
        class="color-swatch ${color === selectedColor ? "is-selected" : ""}"
        type="button"
        style="background: ${color};"
        title="${color}"
        aria-label="Utiliser la couleur ${color}"
        data-color="${color}">
      </button>
      <button
        class="color-delete"
        type="button"
        title="Supprimer cette couleur"
        aria-label="Supprimer la couleur ${color}"
        data-color="${color}">×</button>
    </span>
  `).join("");
}

function ensureColorPopover() {
  let popover = document.getElementById("colorPopover");
  if (popover) return popover;

  popover = document.createElement("div");
  popover.id = "colorPopover";
  popover.className = "color-popover";
  popover.hidden = true;
  document.body.append(popover);
  return popover;
}

function closeColorPopover() {
  const popover = ensureColorPopover();
  popover.hidden = true;
  activeColorPickerIndex = null;
}

function renderColorPopover() {
  const popover = ensureColorPopover();
  if (activeColorPickerIndex === null || !state.simulators[activeColorPickerIndex]) {
    popover.hidden = true;
    return;
  }

  const simulator = state.simulators[activeColorPickerIndex];
  const selectedColor = normalizeColor(simulator.color);
  popover.innerHTML = `
    <div class="color-popover-header">
      <strong>${escapeText(simulator.name)}</strong>
      <button class="icon-button close-color-popover" type="button" aria-label="Fermer">×</button>
    </div>
    <label>
      Couleur
      <input class="popover-color-input" type="color" value="${selectedColor || "#2F7A76"}" aria-label="Couleur du simulateur ${escapeText(simulator.name)}">
    </label>
    <button class="ghost-button popover-clear-color" type="button" ${selectedColor ? "" : "disabled"}>Effacer ce simulateur</button>
    <div class="color-popover-section">
      <span>Favorites</span>
      <div class="color-palette" aria-label="Couleurs favorites">
        ${renderColorPalette(selectedColor)}
      </div>
    </div>
  `;

  popover.querySelector(".close-color-popover").addEventListener("click", closeColorPopover);
  popover.querySelector(".popover-color-input").addEventListener("input", (event) => {
    updateSimulatorColor(activeColorPickerIndex, event.target.value);
  });
  popover.querySelector(".popover-clear-color").addEventListener("click", () => clearSimulatorColor(activeColorPickerIndex));
  popover.querySelectorAll(".color-swatch").forEach((button) => {
    button.addEventListener("click", () => updateSimulatorColor(activeColorPickerIndex, button.dataset.color));
  });
  popover.querySelectorAll(".color-delete").forEach((button) => {
    button.addEventListener("click", () => deleteSimulatorColor(button.dataset.color));
  });
}

function openColorPopover(index, anchor) {
  activeColorPickerIndex = index;
  const popover = ensureColorPopover();
  renderColorPopover();

  const rect = anchor.getBoundingClientRect();
  popover.hidden = false;
  const left = Math.min(rect.left, window.innerWidth - 300);
  popover.style.left = `${Math.max(12, left)}px`;
  popover.style.top = `${rect.bottom + 8}px`;
}

function timeToMinutes(timeValue) {
  const match = String(timeValue || "").match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;

  return hours * 60 + minutes;
}

function isStopDurationShort(stopTime, restartTime) {
  const stopMinutes = timeToMinutes(stopTime);
  const restartMinutes = timeToMinutes(restartTime);
  if (stopMinutes === null || restartMinutes === null) return false;

  const duration = (restartMinutes - stopMinutes + 24 * 60) % (24 * 60);
  return duration <= 120;
}

function isScheduleIncomplete(stopTime, restartTime, hasPro) {
  const hasStopTime = Boolean(stopTime);
  const hasRestartTime = Boolean(restartTime);
  return (hasStopTime || hasRestartTime || Boolean(hasPro))
    && (!hasStopTime || !hasRestartTime);
}

function renderTasks(assignment, simulator) {
  const tasks = assignment.tasks || [];
  if (tasks.length === 0) {
    return `<p class="empty-tasks">Aucune tâche ajoutée</p>`;
  }

  return tasks.map((task, taskIndex) => `
    <div class="task-row">
      <input class="task-input" type="text" value="${escapeText(task)}" data-task-index="${taskIndex}" placeholder="Tâche à réaliser" aria-label="Tâche ${taskIndex + 1} pour ${escapeText(simulator.name)}">
      <button class="icon-button remove-task-btn" type="button" data-task-index="${taskIndex}" aria-label="Supprimer la tâche ${taskIndex + 1}">×</button>
    </div>
  `).join("");
}

function renderSimulators() {
  fields.simulatorGrid.innerHTML = "";
  const shift = getCurrentShift();

  state.simulators.forEach((simulator, index) => {
    const assignment = shift.assignments[index];
    const pendingPlanningCount = getPendingPlanningWarningCount(simulator);
    const card = document.createElement("article");
    card.className = "sim-card";
    if (isStopDurationShort(assignment.stopTime, assignment.restartTime)) {
      card.classList.add("has-short-stop");
    }
    card.style.setProperty("--sim-color", normalizeColor(simulator.color) || "transparent");
    card.innerHTML = `
      <div class="sim-title">
        <strong>${normalizeColor(simulator.color) ? `<span class="sim-color-dot" style="background: ${normalizeColor(simulator.color)};"></span>` : ""}${escapeText(simulator.name)}${pendingPlanningCount > 0 ? `<span class="planning-warning-symbol" title="${pendingPlanningCount} bloc${pendingPlanningCount > 1 ? "s" : ""} à vérifier" aria-label="Bloc de planning à vérifier">!</span>` : ""}</strong>
        <div class="pro-toggle-group">
          <label class="pro-toggle ${assignment.isPro1 ? "is-checked" : ""}">
            <input class="pro1-checkbox" type="checkbox" ${assignment.isPro1 ? "checked" : ""} aria-label="Marquer ${escapeText(simulator.name)} en PRO1">
            <span>PRO1</span>
          </label>
          <label class="pro-toggle ${assignment.isPro2 ? "is-checked" : ""}">
            <input class="pro2-checkbox" type="checkbox" ${assignment.isPro2 ? "checked" : ""} aria-label="Marquer ${escapeText(simulator.name)} en PRO2">
            <span>PRO2</span>
          </label>
        </div>
      </div>
      <div class="sim-fields">
        <label>
          Arrêt
          <input class="stop-time" type="time" value="${escapeText(assignment.stopTime)}" aria-label="Heure d'arrêt pour ${escapeText(simulator.name)}">
        </label>
        <label>
          Reprise
          <input class="restart-time" type="time" value="${escapeText(assignment.restartTime)}" aria-label="Heure de reprise pour ${escapeText(simulator.name)}">
        </label>
      </div>
      <div class="task-panel">
        <div class="task-header">
          <span>Tâches</span>
          <button class="icon-button add-task-btn" type="button" aria-label="Ajouter une tâche pour ${escapeText(simulator.name)}">+</button>
        </div>
        <div class="task-list">
          ${renderTasks(assignment, simulator)}
        </div>
      </div>
    `;

    const stopTimeInput = card.querySelector(".stop-time");
    const restartTimeInput = card.querySelector(".restart-time");
    const pro1Checkbox = card.querySelector(".pro1-checkbox");
    const pro2Checkbox = card.querySelector(".pro2-checkbox");

    const getNextStopTimeInput = () => fields.simulatorGrid.querySelectorAll(".stop-time")[index + 1] || null;

    stopTimeInput.dataset.previousValue = stopTimeInput.value;
    restartTimeInput.dataset.previousValue = restartTimeInput.value;
    stopTimeInput.addEventListener("focus", resetTimeKeyboardEntry);
    restartTimeInput.addEventListener("focus", resetTimeKeyboardEntry);
    stopTimeInput.addEventListener("keydown", markTimeKeyboardEntry);
    restartTimeInput.addEventListener("keydown", markTimeKeyboardEntry);
    stopTimeInput.addEventListener("keyup", (event) => handleTimeKeyUp(event, restartTimeInput));
    restartTimeInput.addEventListener("keyup", (event) => handleTimeKeyUp(event, getNextStopTimeInput()));
    stopTimeInput.addEventListener("input", () => {
      const previousStopValue = stopTimeInput.dataset.previousValue || "";
      updateSimulator(index, { stopTime: stopTimeInput.value });
      updateShortStopState(card, stopTimeInput, restartTimeInput);
      handleTimeInput(stopTimeInput, restartTimeInput, previousStopValue);
      stopTimeInput.dataset.previousValue = stopTimeInput.value;
    });
    restartTimeInput.addEventListener("input", () => {
      const previousRestartValue = restartTimeInput.dataset.previousValue || "";
      updateSimulator(index, { restartTime: restartTimeInput.value });
      updateShortStopState(card, stopTimeInput, restartTimeInput);
      handleTimeInput(restartTimeInput, getNextStopTimeInput(), previousRestartValue);
      restartTimeInput.dataset.previousValue = restartTimeInput.value;
    });
    pro1Checkbox.addEventListener("change", () => updateSimulatorAndRender(index, { isPro1: pro1Checkbox.checked }));
    pro2Checkbox.addEventListener("change", () => updateSimulatorAndRender(index, { isPro2: pro2Checkbox.checked }));
    card.querySelector(".add-task-btn").addEventListener("click", () => addTask(index));
    card.querySelectorAll(".task-input").forEach((input) => {
      input.addEventListener("input", () => updateTask(index, Number(input.dataset.taskIndex), input.value));
    });
    card.querySelectorAll(".remove-task-btn").forEach((button) => {
      button.addEventListener("click", () => removeTask(index, Number(button.dataset.taskIndex)));
    });

    fields.simulatorGrid.append(card);
  });
}

function renderSimulatorSettings() {
  fields.simulatorSettingsList.innerHTML = "";

  state.simulators.forEach((simulator, index) => {
    const row = document.createElement("article");
    row.className = "settings-row";
    const selectedColor = normalizeColor(simulator.color);
    row.innerHTML = `
      <div class="order-controls">
        <button class="icon-button move-simulator-up" type="button" title="Monter ce simulateur" aria-label="Monter ce simulateur" ${index === 0 ? "disabled" : ""}>↑</button>
        <button class="icon-button move-simulator-down" type="button" title="Descendre ce simulateur" aria-label="Descendre ce simulateur" ${index === state.simulators.length - 1 ? "disabled" : ""}>↓</button>
      </div>
      <div class="settings-index">${index + 1}</div>
      <label class="settings-name-field">
        Nom dans l'app
        <input class="simulator-name-input" type="text" value="${escapeText(simulator.name)}" aria-label="Nom du simulateur ${simulator.id}">
      </label>
      <label class="settings-planning-field">
        Texte dans le planning
        <input class="simulator-planning-text-input" type="text" value="${escapeText(simulator.planningText || "")}" placeholder="Ex. A220 FFS1 CDG" aria-label="Texte planning du simulateur ${simulator.id}">
      </label>
      <div class="color-settings">
        <button class="color-picker-button" type="button" style="--selected-color: ${selectedColor || "#EEF3F3"};" aria-label="Choisir la couleur du simulateur ${simulator.id}">
          <span class="color-picker-dot"></span>
          <span>${selectedColor || "Couleur"}</span>
        </button>
        <button class="ghost-button clear-simulator-color" type="button" ${selectedColor ? "" : "disabled"}>Effacer</button>
      </div>
      <button class="icon-button remove-simulator" type="button" title="Supprimer ce simulateur" aria-label="Supprimer ce simulateur">×</button>
    `;

    const nameInput = row.querySelector(".simulator-name-input");
    const planningTextInput = row.querySelector(".simulator-planning-text-input");
    const colorButton = row.querySelector(".color-picker-button");
    nameInput.addEventListener("input", () => updateSimulatorSettings(index, { name: nameInput.value }));
    planningTextInput.addEventListener("input", () => updateSimulatorSettings(index, {
      planningText: planningTextInput.value
    }));
    colorButton.addEventListener("click", () => openColorPopover(index, colorButton));
    row.querySelector(".clear-simulator-color").addEventListener("click", () => clearSimulatorColor(index));
    row.querySelector(".move-simulator-up").addEventListener("click", () => moveSimulator(index, -1));
    row.querySelector(".move-simulator-down").addEventListener("click", () => moveSimulator(index, 1));
    row.querySelector(".remove-simulator").addEventListener("click", () => removeSimulator(index));

    fields.simulatorSettingsList.append(row);
  });
}

function placeProBadges() {
  const badgeGroups = Array.from(fields.previewRows.querySelectorAll(".sheet-pro-badges"));
  if (badgeGroups.length === 0) return;

  badgeGroups.forEach((badgeGroup) => {
    const timeCell = badgeGroup.closest("tr")?.querySelector(".sheet-time-cell");
    if (timeCell && badgeGroup.parentElement !== timeCell) timeCell.append(badgeGroup);
    badgeGroup.classList.remove("is-in-task-cell");
    const timeValues = timeCell?.querySelector(".sheet-time-values");
    if (timeValues) badgeGroup.style.top = `${timeValues.offsetTop + timeValues.offsetHeight + 4}px`;
  });

  if (fields.previewRows.getBoundingClientRect().width === 0) return;
  const mustUseTaskCells = badgeGroups.some((badgeGroup) => {
    const rowBounds = badgeGroup.closest("tr")?.getBoundingClientRect();
    const badgeBounds = badgeGroup.getBoundingClientRect();
    return rowBounds && badgeBounds.bottom >= rowBounds.bottom - 2;
  });

  if (!mustUseTaskCells) return;
  badgeGroups.forEach((badgeGroup) => {
    const taskCell = badgeGroup.closest("tr")?.querySelector(".sheet-task-cell");
    if (!taskCell) return;
    taskCell.prepend(badgeGroup);
    badgeGroup.classList.add("is-in-task-cell");
  });
}

function scheduleProBadgePlacement() {
  window.cancelAnimationFrame(proBadgeLayoutFrame);
  proBadgeLayoutFrame = window.requestAnimationFrame(placeProBadges);
}

function shouldPrintBlankVacationSheet() {
  const shift = getCurrentShift();
  const hasInformation = shift.assignments.some((assignment) => (
    String(assignment.stopTime || "").trim()
    || String(assignment.restartTime || "").trim()
    || assignment.isPro1 || assignment.isPro2
    || (assignment.tasks || []).some((task) => String(task || "").trim())
    || String(assignment.notes || "").trim()
  ));
  return !shift.planningCapturePath || !hasInformation;
}

function renderPlanningAuthors(access = nightPlanningAccessCache?.date === state.shiftDate ? nightPlanningAccessCache.access : null) {
  const importer = access?.importerDisplayName || "";
  const author = access?.authorDisplayName || "";
  const text = importer && importer === author
    ? `Import et pointage : ${importer}`
    : [importer ? `Import : ${importer}` : "", author ? `Pointage : ${author}` : ""].filter(Boolean).join(" · ");
  fields.previewPlanningAuthors.textContent = text;
  fields.previewPlanningAuthors.hidden = !text;
}

function renderPreview({ blankSheet = false } = {}) {
  renderPlanningAuthors();
  const shift = getCurrentShift();
  fields.previewDate.textContent = formatDate(state.shiftDate);
  const scheduledRowCount = blankSheet ? state.simulators.length : state.simulators.filter((_, index) => {
    const assignment = shift.assignments[index];
    return Boolean(assignment?.restartTime);
  }).length;
  const unscheduledRowCount = Math.max(state.simulators.length - scheduledRowCount, 0);
  const scheduledHeight = scheduledRowCount > 0
    ? `calc((100% - ${unscheduledRowCount * 24}px) / ${scheduledRowCount})`
    : "24px";
  fields.previewRows.style.setProperty("--scheduled-row-height", scheduledHeight);

  let scheduledIndex = 0;
  fields.previewRows.innerHTML = state.simulators.map((simulator, index) => {
    const assignment = shift.assignments[index];
    const taskText = (assignment.tasks || []).filter(Boolean).map((task) => `• ${escapeText(task)}`).join("<br>");
    const hasActiveSchedule = Boolean(assignment.restartTime);
    const stopTime = assignment.stopTime
      ? `<span>${escapeText(assignment.stopTime)}</span>`
      : (hasActiveSchedule ? "<span>--:--</span>" : "");
    const restartTime = assignment.restartTime ? `<span>${escapeText(assignment.restartTime)}</span>` : "";
    const proBadges = [
      assignment.isPro1 ? "PRO1" : "",
      assignment.isPro2 ? "PRO2" : ""
    ].filter(Boolean);
    const proBadge = proBadges.length > 0
      ? `<span class="sheet-pro-badges">${proBadges.map((label) => `<span class="sheet-pro-badge">${label}</span>`).join("")}</span>`
      : "";
    const timeText = [stopTime, restartTime].filter(Boolean).join("<br>");
    const timeClass = isStopDurationShort(assignment.stopTime, assignment.restartTime) ? "sheet-time-cell is-urgent" : "sheet-time-cell";
    const rowClasses = blankSheet ? ' class="is-blank-vacation"' : hasActiveSchedule
      ? ` class="${scheduledIndex++ % 2 === 0 ? "is-scheduled-light" : "is-scheduled-strong"}"`
      : ` class="is-unscheduled"`;
    const maintCell = hasActiveSchedule || blankSheet
      ? `
        <div class="sheet-maint-stack">
          <label><span class="sheet-checkbox"></span>PREV</label>
          <label><span class="sheet-checkbox"></span>REGL</label>
        </div>
      `
      : "";
    return `
    <tr${rowClasses}${colorStyle(simulator.color)}>
      <td>
        <strong class="sheet-sim-title">${normalizeColor(simulator.color) ? `<span class="sheet-color-dot"></span>` : ""}<span class="sheet-sim-name">${escapeText(simulator.name)}</span></strong>
      </td>
      <td class="${timeClass}"><span class="sheet-time-values">${timeText}</span>${proBadge}</td>
      <td class="sheet-name-cell"></td>
      <td class="sheet-task-cell">${taskText || ""}</td>
      <td class="sheet-maint-cell">${maintCell}</td>
      <td></td>
    </tr>
  `;
  }).join("");
  scheduleProBadgePlacement();
}

function setLayoutSplit(percent, shouldSave = false) {
  const boundedPercent = Math.max(30, Math.min(70, Math.round(percent * 10) / 10));
  state.layoutSplitPercent = boundedPercent;
  fields.appShell.style.setProperty("--workspace-width", `${boundedPercent}%`);
  fields.layoutResizer.setAttribute("aria-valuenow", String(Math.round(boundedPercent)));
  if (shouldSave) saveState();
}

function resizeLayoutFromPointer(event) {
  if (!isResizingLayout) return;
  const bounds = fields.appShell.getBoundingClientRect();
  setLayoutSplit(((event.clientX - bounds.left) / bounds.width) * 100);
}

function finishLayoutResize(event) {
  if (!isResizingLayout) return;
  resizeLayoutFromPointer(event);
  isResizingLayout = false;
  saveState();
}

function render() {
  const shift = getCurrentShift();
  setLayoutSplit(state.layoutSplitPercent);
  renderCurrentView();
  fields.shiftDate.value = state.shiftDate;
  updatePlanningPreview();
  renderSimulators();
  renderSimulatorSettings();
  renderPreview();
}

function renderCurrentView() {
  fields.appShell.classList.toggle("is-planning-view", activeView === "planning");
  fields.shiftView.hidden = activeView !== "shift";
  fields.planningView.hidden = activeView !== "planning";
  fields.settingsView.hidden = activeView !== "settings";
  fields.printBtn.hidden = activeView !== "shift";
  fields.planningBtn.hidden = activeView !== "shift";
  fields.settingsBtn.hidden = activeView !== "shift" || window.simflowNightPlanningIsAdmin !== true;
  applyNightPlanningEditAccess();
  if (activeView === "shift") scheduleProBadgePlacement();
  scheduleParentToolbarState();
}

fields.layoutResizer.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  isResizingLayout = true;
  fields.layoutResizer.setPointerCapture(event.pointerId);
  resizeLayoutFromPointer(event);
});
fields.layoutResizer.addEventListener("pointermove", resizeLayoutFromPointer);
fields.layoutResizer.addEventListener("pointerup", finishLayoutResize);
fields.layoutResizer.addEventListener("pointercancel", finishLayoutResize);
document.addEventListener("pointermove", resizeLayoutFromPointer);
document.addEventListener("pointerup", finishLayoutResize);
document.addEventListener("mousemove", resizeLayoutFromPointer);
document.addEventListener("mouseup", finishLayoutResize);
window.addEventListener("resize", scheduleProBadgePlacement);
fields.layoutResizer.addEventListener("dblclick", () => setLayoutSplit(50, true));
fields.layoutResizer.addEventListener("keydown", (event) => {
  if (!["ArrowLeft", "ArrowRight", "Home"].includes(event.key)) return;
  event.preventDefault();
  if (event.key === "Home") {
    setLayoutSplit(50, true);
    return;
  }
  setLayoutSplit(state.layoutSplitPercent + (event.key === "ArrowLeft" ? -2 : 2), true);
});
fields.shiftDate.addEventListener("input", () => updateShiftDate(fields.shiftDate.value));
fields.addSimulatorBtn.addEventListener("click", addSimulator);
fields.exportSimulatorSettingsBtn.addEventListener("click", exportSimulatorSettings);
fields.importSimulatorSettingsBtn.addEventListener("click", () => {
  fields.importSimulatorSettingsInput.value = "";
  fields.importSimulatorSettingsInput.click();
});
fields.importSimulatorSettingsInput.addEventListener("change", async () => {
  const [file] = fields.importSimulatorSettingsInput.files || [];
  if (!file) return;
  try {
    await importSimulatorSettings(file);
    window.alert("Les paramètres simulateurs ont été importés.");
  } catch (error) {
    window.alert(error.message || "L'import des paramètres a échoué.");
  }
});

async function exportPdf() {
  saveState();
  if (shouldPrintBlankVacationSheet()) {
    window.print();
    return;
  }

  try {
    const response = await fetch(
      `/api/export-pdf?date=${encodeURIComponent(state.shiftDate)}&ts=${Date.now()}`,
      { cache: "no-store" }
    );
    const contentType = response.headers.get("Content-Type") || "";
    if (!response.ok || !contentType.includes("application/pdf")) {
      throw new Error("Export serveur indisponible");
    }

    const pdfBlob = await response.blob();
    const pdfUrl = URL.createObjectURL(pdfBlob);
    window.open(pdfUrl, "_blank");
    window.setTimeout(() => URL.revokeObjectURL(pdfUrl), 60000);
  } catch {
    window.print();
  }
}

fields.printBtn.addEventListener("click", exportPdf);
window.addEventListener("beforeprint", () => {
  renderPreview({ blankSheet: shouldPrintBlankVacationSheet() });
  placeProBadges();
});
window.addEventListener("afterprint", () => renderPreview());
fields.pastePlanningCaptureBtn.addEventListener("click", pastePlanningFromClipboard);
fields.recalculatePlanningBtn.addEventListener("click", recalculatePlanningCapture);
fields.analyzePlanningAiBtn.addEventListener("click", analyzePlanningWithAI);
fields.clearPlanningCaptureBtn.addEventListener("click", clearPlanningCapture);
fields.showDetectedEndsBtn.addEventListener("click", toggleScheduleBlockPicking);
fields.planningBtn.addEventListener("click", showPlanningView);
fields.closePlanningValidationBtn.addEventListener("click", closePlanningValidationDialog);
fields.confirmPlanningValidationBtn.addEventListener("click", closePlanningValidationDialog);
fields.pendingPlanningMarkerForm.addEventListener("submit", submitPendingPlanningMarker);
fields.pendingPlanningSimulator.addEventListener("change", updatePendingPlanningMarkerDialog);
fields.pendingPlanningMarkerForm.querySelectorAll('input[name="pendingMarkerType"]').forEach((radio) => {
  radio.addEventListener("change", updatePendingPlanningMarkerDialog);
});
fields.closePendingPlanningMarkerBtn.addEventListener("click", closePendingPlanningMarkerDialog);
fields.cancelPendingPlanningMarkerBtn.addEventListener("click", closePendingPlanningMarkerDialog);
fields.pendingPlanningMarkerDialog.addEventListener("click", (event) => {
  if (event.target === fields.pendingPlanningMarkerDialog) closePendingPlanningMarkerDialog();
});
fields.planningAnnotationOverlay.addEventListener("pointerdown", startPlanningMarkerDraft);
const authorizedMarkerClicks = new WeakSet();
fields.planningAnnotationOverlay.addEventListener("click", async (event) => {
  const button = event.target.closest(".planning-marker-edit, .planning-marker-remove");
  if (!button || authorizedMarkerClicks.has(button)) { if (button) authorizedMarkerClicks.delete(button); return; }
  event.stopImmediatePropagation();
  event.preventDefault();
  if (await requirePlanningEdit(true)) { authorizedMarkerClicks.add(button); button.click(); }
}, true);
fields.planningAnnotationOverlay.addEventListener("pointermove", updatePlanningMarkerDraft);
fields.planningAnnotationOverlay.addEventListener("pointerup", finishPlanningMarkerDraft);
fields.planningAnnotationOverlay.addEventListener("pointercancel", finishPlanningMarkerDraft);
const planningMagnifier = document.createElement("div");
planningMagnifier.className = "planning-magnifier";
planningMagnifier.setAttribute("aria-hidden", "true");
planningMagnifier.hidden = true;
document.body.append(planningMagnifier);
let planningMagnifierActive = false;
let planningMagnifierContent = null;
let planningMagnifierDirty = true;
new MutationObserver(() => { planningMagnifierDirty = true; }).observe(fields.planningImageEditor, {
  childList: true, subtree: true, attributes: true, characterData: true
});

function setPlanningMagnifier(active) {
  planningMagnifierActive = active;
  planningMagnifierDirty = true;
  fields.planningMagnifierBtn.setAttribute("aria-pressed", String(active));
  fields.planningImageEditor.classList.toggle("is-magnifying", active);
  planningMagnifier.hidden = true;
  scheduleParentToolbarState();
}

fields.planningMagnifierBtn.addEventListener("click", () => {
  if (!fields.planningMagnifierBtn.disabled) setPlanningMagnifier(!planningMagnifierActive);
});
fields.planningImageEditor.addEventListener("pointermove", (event) => {
  if (!planningMagnifierActive) return;
  const image = fields.planningPreviewImage;
  const bounds = fields.planningImageEditor.getBoundingClientRect();
  if (!image.complete || !image.naturalWidth || !bounds.width) return;
  const diameter = 640;
  if (planningMagnifierDirty || !planningMagnifierContent) {
    planningMagnifierContent = fields.planningImageEditor.cloneNode(true);
    planningMagnifierContent.removeAttribute("id");
    planningMagnifierContent.querySelectorAll("[id]").forEach((element) => element.removeAttribute("id"));
    planningMagnifierContent.classList.add("planning-magnifier-content");
    planningMagnifier.replaceChildren(planningMagnifierContent);
    planningMagnifierDirty = false;
  }
  planningMagnifierContent.style.width = `${bounds.width}px`;
  planningMagnifierContent.style.height = `${bounds.height}px`;
  planningMagnifierContent.style.left = `${diameter / 2 - 2 * (event.clientX - bounds.left)}px`;
  planningMagnifierContent.style.top = `${diameter / 2 - 2 * (event.clientY - bounds.top)}px`;
  planningMagnifier.style.left = `${event.clientX - diameter / 2}px`;
  planningMagnifier.style.top = `${event.clientY - diameter / 2}px`;
  planningMagnifier.hidden = false;
}, true);
fields.planningImageEditor.addEventListener("pointerleave", () => { planningMagnifier.hidden = true; });
fields.planningImageEditor.addEventListener("pointerdown", (event) => {
  if (planningMagnifierActive) {
    if (event.button === 0) setPlanningMagnifier(false);
    event.preventDefault();
    event.stopImmediatePropagation();
  }
}, true);
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") setPlanningMagnifier(false);
});
window.addEventListener("blur", () => { planningMagnifier.hidden = true; });
fields.planningPreviewImage.addEventListener("load", async () => {
  renderPlanningAnnotationEditor();
  const shift = getCurrentShift();
  const capture = shift.planningCapturePath;
  const date = state.shiftDate;
  if (!capture || !shift.planningAiBackup || shift.planningAlignmentVersion === 2) return;
  const blocks = shift.planningAnnotations.flatMap((annotation) => (
    ["stop", "restart", "pro1", "pro2"].filter((type) => annotation.boxes?.[type]).map((type) => ({
      simulator: annotation.simulatorName,
      type,
      time: annotation.values?.[type] || "",
      box: planningBoxToAiCoordinates(annotation.boxes[type])
    }))
  ));
  if (!blocks.length) return;
  try {
    const prepared = await preparePlanningImage(capture);
    const aligned = await alignPlanningAiBlocks(blocks, prepared);
    if (state.shiftDate !== date || getCurrentShift() !== shift || shift.planningCapturePath !== capture) return;
    aligned.forEach((block) => {
      const annotation = shift.planningAnnotations.find((item) => item.simulatorName === block.simulator);
      const box = normalizePlanningAiBox(block.box);
      if (annotation && box) annotation.boxes[block.type] = box;
    });
    shift.planningAlignmentVersion = 2;
    saveState();
    renderPlanningAnnotationEditor();
  } catch (error) {
    console.warn("Recalage des cadres du planning impossible", error);
  }
});
fields.settingsBtn.addEventListener("click", () => {
  activeView = "settings";
  renderCurrentView();
});
fields.backFromPlanningBtn.addEventListener("click", () => {
  activeView = "shift";
  renderCurrentView();
});
fields.backToShiftBtn.addEventListener("click", () => {
  activeView = "shift";
  renderCurrentView();
});

window.addEventListener("hashchange", () => {
  if (window.location.hash === "#planning") {
    showPlanningView();
  }
});

if (isEmbeddedMode) {
  const planningSidebar = document.querySelector(".planning-sidebar");
  if (planningSidebar) {
    new MutationObserver(scheduleParentToolbarState).observe(planningSidebar, {
      attributes: true,
      childList: true,
      subtree: true,
      characterData: true,
      attributeFilter: ["class", "disabled", "hidden", "aria-pressed"]
    });
  }
  window.addEventListener("message", (event) => {
    if (event.origin !== window.location.origin || event.source !== window.parent) return;
    if (event.data?.source === "simflow" && event.data?.type === "request-toolbar-state") {
      sendParentToolbarState();
    }
  });
}

if ("serviceWorker" in navigator && !new URLSearchParams(window.location.search).has("embedded")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  });
}

render();
void runPlanningBusy("Chargement du planning...", loadState).catch(error => {
  fields.planningStatus.textContent = error.message || "Chargement du planning impossible.";
});
new MutationObserver(applyNightPlanningEditAccess).observe(fields.shiftView, { childList: true, subtree: true });
new MutationObserver(updatePlanningBusy).observe(fields.planningStatus, { childList: true, characterData: true, subtree: true });
window.addEventListener("focus", () => { void refreshNightPlanningAccess(false).catch(() => {}); });
window.setInterval(() => { if (!document.hidden) void refreshNightPlanningAccess().catch(() => {}); }, 30000);
