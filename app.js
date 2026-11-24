(() => {
  const STORAGE_KEY = 'upsjb_note_app_v1';
  const GRADE_KEYS = ['pc1', 'pc2', 'pc3', 'pc4', 'ep', 'ef'];
  const GRADE_LABELS = {
    pc1: 'PC1',
    pc2: 'PC2',
    pc3: 'PC3',
    pc4: 'PC4',
    ep: 'Parcial (EP)',
    ef: 'Examen Final (EF)',
  };

  const DEFAULT_SETTINGS = {
    weights: { pc1: 15, pc2: 15, pc3: 15, pc4: 15, ep: 20, ef: 20 },
    minGrade: 11,
    autoSave: true,
  };

  function createEmptyCourse(id, name) {
    return {
      id,
      name,
      grades: { pc1: '', pc2: '', pc3: '', pc4: '', ep: '', ef: '' },
      generatedKeys: [],
      customWeights: null,
      subgrades: {},
    };
  }

  function getCourseWeights(course) {
    return course && course.customWeights ? course.customWeights : state.settings.weights;
  }

  let state = loadState();
  let activeSubgradeKey = null;
  let toastTimer = null;
  let persistTimer = null;
  let hasPendingPersist = false;
  let lastRenderedStatus = null;

  // DOM References
  const appShell = document.querySelector('.app-shell');
  const headerTitle = document.getElementById('header-title');
  const navCalculate = document.getElementById('nav-calculate');
  const navSettings = document.getElementById('nav-settings');
  const navSummary = document.getElementById('nav-summary');
  const navInfo = document.getElementById('nav-info');

  const views = {
    calculate: document.getElementById('view-calculate'),
    settings: document.getElementById('view-settings'),
    summary: document.getElementById('view-summary'),
  };

  const lblMinGrade = document.getElementById('lbl-min-grade');
  const lblCurrentCourse = document.getElementById('lbl-current-course');
  const btnOpenCourses = document.getElementById('btn-open-courses');
  const btnCourseWeights = document.getElementById('btn-course-weights');

  const gradeInputs = {};
  const gradeBoxes = {};
  const gradeRows = {};
  const weightTags = {};
  const pointsTags = {};
  const subgradeBtns = {};
  GRADE_KEYS.forEach((k) => {
    const input = document.getElementById(`input-${k}`);
    gradeInputs[k] = input;
    gradeBoxes[k] = input.closest('.floating-input-box');
    subgradeBtns[k] = gradeBoxes[k].querySelector('.subgrade-btn');
    gradeRows[k] = input.closest('.grade-row');
    weightTags[k] = document.getElementById(`weight-${k}`);
    pointsTags[k] = document.getElementById(`points-${k}`);
  });

  const btnNew = document.getElementById('btn-new');
  const btnGenerate = document.getElementById('btn-generate');
  const btnSaveCourse = document.getElementById('btn-save-course');

  const resultCard = document.getElementById('result-card');
  const resultTitle = document.getElementById('result-title');
  const resultSubtitle = document.getElementById('result-subtitle');
  const resultIconWrap = document.getElementById('result-icon-wrap');
  const progressFill = document.getElementById('progress-fill');
  const progressMarker = document.getElementById('progress-marker');
  const progressMinLabel = document.getElementById('progress-min-label');
  const resultDetails = document.getElementById('result-details');
  const detailAccumulated = document.getElementById('detail-accumulated');
  const detailMissing = document.getElementById('detail-missing');
  const detailNeededAvg = document.getElementById('detail-needed-avg');

  // Settings DOM
  const setInputs = {};
  GRADE_KEYS.forEach((k) => {
    setInputs[k] = document.getElementById(`set-${k}`);
  });
  const setPm = document.getElementById('set-pm');
  const weightSumBadge = document.getElementById('weight-sum-badge');
  const weightSumValue = document.getElementById('weight-sum-value');
  const toggleAutosave = document.getElementById('toggle-autosave');
  const btnResetDefaults = document.getElementById('btn-reset-defaults');
  const btnSaveSettings = document.getElementById('btn-save-settings');
  const btnExportBackup = document.getElementById('btn-export-backup');
  const btnImportBackup = document.getElementById('btn-import-backup');
  const inputImportBackup = document.getElementById('input-import-backup');

  // Summary DOM
  const summaryGpa = document.getElementById('summary-gpa');
  const summaryPassed = document.getElementById('summary-passed');
  const summaryPending = document.getElementById('summary-pending');
  const summaryFailed = document.getElementById('summary-failed');
  const cycleVerdict = document.getElementById('cycle-verdict');
  const inputNewCourse = document.getElementById('input-new-course');
  const btnAddCourse = document.getElementById('btn-add-course');
  const coursesList = document.getElementById('courses-list');

  // Modals
  const modalSubgrades = document.getElementById('modal-subgrades');
  const subgradesTitle = document.getElementById('subgrades-title');
  const subgradesInputs = document.getElementById('subgrades-inputs');
  const subgradesAvg = document.getElementById('subgrades-avg');
  const btnAddSubgrade = document.getElementById('btn-add-subgrade');
  const btnApplySubgrades = document.getElementById('btn-apply-subgrades');
  const modalSaveCourse = document.getElementById('modal-save-course');
  const inputSaveCourseName = document.getElementById('input-save-course-name');
  const btnConfirmSaveCourse = document.getElementById('btn-confirm-save-course');
  const modalCourseWeights = document.getElementById('modal-course-weights');
  const cwTitle = document.getElementById('cw-title');
  const cwNameGroup = document.getElementById('cw-name-group');
  const cwCourseName = document.getElementById('cw-course-name');
  const cwInputs = {};
  GRADE_KEYS.forEach((k) => {
    cwInputs[k] = document.getElementById(`cw-${k}`);
  });
  const cwSumBadge = document.getElementById('cw-sum-badge');
  const cwSumValue = document.getElementById('cw-sum-value');
  const btnResetCourseWeights = document.getElementById('btn-reset-course-weights');
  const btnSaveCourseWeights = document.getElementById('btn-save-course-weights');
  const modalInfo = document.getElementById('modal-info');
  const ALL_MODALS = [modalSubgrades, modalSaveCourse, modalCourseWeights, modalInfo];
  const toastEl = document.getElementById('toast');

  function openModal(modalEl) {
    ALL_MODALS.forEach((m) => {
      if (m !== modalEl) m.classList.add('hidden');
    });
    modalEl.classList.remove('hidden');
    if (!document.body.classList.contains('modal-open')) {
      // Compensa el ancho de la barra de scroll para que la página no "salte" (0 en celulares)
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.paddingRight = scrollbarWidth > 0 ? `${scrollbarWidth}px` : '';
    }
    document.body.classList.add('modal-open');
    if (appShell) appShell.inert = true;
  }

  function closeModal(modalEl) {
    if (!modalEl) return;
    modalEl.classList.add('hidden');
    const anyOpen = ALL_MODALS.some((m) => !m.classList.contains('hidden'));
    if (!anyOpen) {
      document.body.classList.remove('modal-open');
      document.body.style.paddingRight = '';
      if (appShell) appShell.inert = false;
    }
  }

  // ---------- Storage ----------
  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.settings && Array.isArray(parsed.courses) && parsed.courses.length > 0) {
          return parsed;
        }
      }
    } catch {
      // Ignore storage errors
    }
    return {
      settings: structuredClone(DEFAULT_SETTINGS),
      activeCourseId: 'general',
      courses: [createEmptyCourse('general', 'General')],
    };
  }

  function writeStateNow() {
    clearTimeout(persistTimer);
    persistTimer = null;
    hasPendingPersist = false;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore quota errors
    }
  }

  function persistState(force = false) {
    if (!force && !state.settings.autoSave) return;
    if (force) {
      writeStateNow();
      return;
    }
    hasPendingPersist = true;
    clearTimeout(persistTimer);
    persistTimer = setTimeout(writeStateNow, 250);
  }

  window.addEventListener('beforeunload', () => {
    if (hasPendingPersist) writeStateNow();
  });

  function getActiveCourse() {
    let course = state.courses.find((c) => c.id === state.activeCourseId);
    if (!course) {
      course = state.courses[0];
      state.activeCourseId = course.id;
    }
    return course;
  }

  // ---------- Math & Evaluation ----------
  function parseGrade(val) {
    if (val === '' || val === null || val === undefined) return null;
    const num = Number(val);
    if (Number.isNaN(num)) return null;
    return Math.min(20, Math.max(0, num));
  }

  function round2(n) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  function evaluateCourse(course) {
    const weights = getCourseWeights(course);
    const { minGrade } = state.settings;
    let accumulated = 0;
    let enteredWeight = 0;
    let missingWeight = 0;
    let filledCount = 0;

    GRADE_KEYS.forEach((k) => {
      const w = Number(weights[k]) || 0;
      const g = parseGrade(course.grades[k]);
      if (g !== null) {
        accumulated += g * (w / 100);
        enteredWeight += w;
        filledCount++;
      } else {
        missingWeight += w;
      }
    });

    const totalWeight = enteredWeight + missingWeight;
    const accRounded = round2(accumulated);
    const maxPossible = round2(accumulated + 20 * (missingWeight / 100));
    const missingPoints = Math.max(0, round2(minGrade - accumulated));
    const neededAvg = missingWeight > 0 ? round2((minGrade - accumulated) / (missingWeight / 100)) : null;

    let status = 'neutral';
    if (filledCount === 0) {
      status = 'neutral';
    } else if (missingWeight === 0) {
      status = accRounded >= minGrade ? 'pass' : 'fail';
    } else {
      if (accRounded >= minGrade) {
        status = 'pass';
      } else if (maxPossible < minGrade) {
        status = 'fail';
      } else {
        status = 'pending';
      }
    }

    return {
      accumulated: accRounded,
      enteredWeight,
      missingWeight,
      totalWeight,
      filledCount,
      maxPossible,
      missingPoints,
      neededAvg,
      minGrade,
      status,
      isComplete: missingWeight === 0 && filledCount > 0,
    };
  }

  // ---------- Rendering ----------
  function switchView(name) {
    Object.entries(views).forEach(([k, el]) => {
      el.classList.toggle('active', k === name);
    });

    navCalculate.classList.toggle('active', name === 'calculate');
    navSettings.classList.toggle('active', name === 'settings');
    navSummary.classList.toggle('active', name === 'summary');

    if (name === 'calculate') {
      headerTitle.textContent = 'Calcular';
      renderCalculator();
    } else if (name === 'settings') {
      headerTitle.textContent = 'Ajustes';
      renderSettings();
    } else if (name === 'summary') {
      headerTitle.textContent = 'Mis Cursos';
      renderSummary();
    }
  }

  function renderCalculator() {
    const course = getActiveCourse();
    const weights = getCourseWeights(course);
    const { minGrade } = state.settings;
    const isCustom = Boolean(course.customWeights);

    lblMinGrade.textContent = minGrade.toFixed(2);
    lblCurrentCourse.textContent = course.name;
    btnCourseWeights.classList.toggle('is-custom', isCustom);
    btnCourseWeights.title = isCustom
      ? 'Porcentajes personalizados activos (clic para editar)'
      : 'Editar porcentajes de este curso';
    progressMinLabel.textContent = `Mín: ${minGrade.toFixed(2)}`;
    progressMarker.style.left = `${Math.min(100, (minGrade / 20) * 100)}%`;

    GRADE_KEYS.forEach((k) => {
      const w = Number(weights[k]) || 0;
      weightTags[k].textContent = `${w}%`;
      const input = gradeInputs[k];
      if (gradeRows[k]) gradeRows[k].classList.toggle('weight-zero', w === 0);
      const val = course.grades[k];
      if (document.activeElement !== input) {
        input.value = val;
      }
      styleGradeInput(k, val, course.generatedKeys.includes(k));
      if (subgradeBtns[k]) {
        const savedCount = (course.subgrades && course.subgrades[k] && course.subgrades[k].length) || 0;
        subgradeBtns[k].classList.toggle('has-subgrades', savedCount > 0);
        subgradeBtns[k].title = savedCount > 0
          ? `${savedCount} sub-nota(s) guardada(s) en ${GRADE_LABELS[k]}`
          : `Promediar sub-notas de ${GRADE_LABELS[k]}`;
      }
    });

    renderResult(evaluateCourse(course));
  }

  function formatPoints(pts) {
    return pts.toFixed(2).replace(/0$/, '');
  }

  function updatePointsTag(key, rawVal) {
    const el = pointsTags[key];
    if (!el) return;
    const num = parseGrade(rawVal);
    if (num === null) {
      el.textContent = '(—)';
      el.classList.add('empty');
      return;
    }
    const weights = getCourseWeights(getActiveCourse());
    const w = Number(weights[key]) || 0;
    const pts = num * (w / 100);
    el.textContent = `(${formatPoints(pts)})`;
    el.classList.remove('empty');
  }

  function styleGradeInput(key, rawVal, isGenerated) {
    const input = gradeInputs[key];
    const box = gradeBoxes[key];
    const num = parseGrade(rawVal);

    input.classList.toggle('grade-pass', num !== null && num >= state.settings.minGrade);
    input.classList.toggle('grade-fail', num !== null && num < state.settings.minGrade);
    box.classList.toggle('generated', Boolean(isGenerated && rawVal !== ''));
    updatePointsTag(key, rawVal);
  }

  function getStatusSvg(status) {
    if (status === 'pass') {
      return `
        <svg viewBox="0 0 80 80" fill="none">
          <rect x="6" y="6" width="68" height="68" rx="16" stroke="#10b957" stroke-width="6" />
          <path d="M23 41.5L35 53L57 28" stroke="#10b957" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>`;
    }
    if (status === 'fail') {
      return `
        <svg viewBox="0 0 80 80" fill="none">
          <rect x="6" y="6" width="68" height="68" rx="16" stroke="#e51923" stroke-width="6" />
          <path d="M27 27L53 53M53 27L27 53" stroke="#e51923" stroke-width="6.5" stroke-linecap="round" />
        </svg>`;
    }
    if (status === 'pending') {
      return `
        <svg viewBox="0 0 80 80" fill="none">
          <circle cx="40" cy="40" r="32" stroke="#f59e0b" stroke-width="6" />
          <path d="M40 24V42L52 48" stroke="#f59e0b" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" />
        </svg>`;
    }
    return `
      <svg viewBox="0 0 80 80" fill="none">
        <rect x="10" y="10" width="60" height="60" rx="14" stroke="#9ca3af" stroke-width="4.5" stroke-dasharray="6 6" />
        <path d="M28 40H52M40 28V52" stroke="#9ca3af" stroke-width="4.5" stroke-linecap="round" />
      </svg>`;
  }

  function renderResult(evalData) {
    resultCard.className = `result-card state-${evalData.status}`;
    if (lastRenderedStatus !== evalData.status) {
      resultIconWrap.innerHTML = getStatusSvg(evalData.status);
      lastRenderedStatus = evalData.status;
    }

    const pct = Math.min(100, Math.max(0, (evalData.accumulated / 20) * 100));
    progressFill.style.width = `${pct}%`;

    if (evalData.status === 'neutral') {
      resultTitle.textContent = 'Ingresa tus notas para evaluar';
      resultSubtitle.innerHTML = 'Puedes dejar notas vacías y pulsar <strong>Generar</strong> para saber cuánto te falta.';
      resultDetails.classList.add('hidden');
      return;
    }

    resultDetails.classList.remove('hidden');
    detailAccumulated.textContent = `${evalData.accumulated.toFixed(2)} pts`;
    detailMissing.textContent = `${evalData.missingPoints.toFixed(2)} pts`;

    if (evalData.isComplete) {
      detailNeededAvg.textContent = 'Completo';
      if (evalData.status === 'pass') {
        resultTitle.textContent = `Nota Final: ${evalData.accumulated.toFixed(2)} - ¡Aprobó!`;
        const margin = round2(evalData.accumulated - evalData.minGrade);
        resultSubtitle.textContent =
          margin > 0
            ? `¡Felicidades! Superaste el mínimo por +${margin.toFixed(2)} puntos.`
            : '¡Aprobaste justo en la nota mínima!';
      } else {
        resultTitle.textContent = `Nota Final: ${evalData.accumulated.toFixed(2)} - Desaprobó`;
        resultSubtitle.textContent = `Te faltaron ${evalData.missingPoints.toFixed(2)} puntos para alcanzar ${evalData.minGrade.toFixed(2)}.`;
      }
      return;
    }

    // Partial grades entered
    if (evalData.status === 'pass') {
      detailNeededAvg.textContent = '0.00';
      resultTitle.textContent = `¡Ya aprobaste! (${evalData.accumulated.toFixed(2)} pts)`;
      resultSubtitle.textContent = `Incluso con 0 en el ${evalData.missingWeight}% restante ya aseguras aprobar el curso.`;
    } else if (evalData.status === 'fail') {
      detailNeededAvg.textContent = `${evalData.neededAvg.toFixed(2)} (>20)`;
      resultTitle.textContent = `No alcanza — Máx. posible: ${evalData.maxPossible.toFixed(2)}`;
      resultSubtitle.textContent = `Aunque saques 20 en el ${evalData.missingWeight}% restante, no llegas a ${evalData.minGrade.toFixed(2)}.`;
    } else {
      detailNeededAvg.textContent = `${evalData.neededAvg.toFixed(2)} / 20`;
      resultTitle.textContent = `En curso — Te faltan ${evalData.missingPoints.toFixed(2)} pts`;
      resultSubtitle.textContent = `Necesitas promediar ${evalData.neededAvg.toFixed(2)} en el ${evalData.missingWeight}% restante para aprobar.`;
    }
  }

  // ---------- Actions ----------
  function handleGenerate() {
    const course = getActiveCourse();
    const weights = getCourseWeights(course);
    const { minGrade } = state.settings;

    // Clear previously generated values first so re-clicking Generar recalculates cleanly
    course.generatedKeys.forEach((k) => {
      course.grades[k] = '';
    });
    course.generatedKeys = [];

    const emptyKeys = GRADE_KEYS.filter((k) => parseGrade(course.grades[k]) === null && (Number(weights[k]) || 0) > 0);
    if (emptyKeys.length === 0) {
      showToast('Todas las notas ya están llenas. Borra alguna para generar.');
      renderCalculator();
      return;
    }

    let currentAcc = 0;
    let remainingWeight = 0;
    GRADE_KEYS.forEach((k) => {
      const w = Number(weights[k]) || 0;
      const g = parseGrade(course.grades[k]);
      if (g !== null) {
        currentAcc += g * (w / 100);
      } else {
        remainingWeight += w;
      }
    });

    const neededPoints = minGrade - currentAcc;
    if (neededPoints <= 0) {
      emptyKeys.forEach((k) => {
        course.grades[k] = '0';
        course.generatedKeys.push(k);
      });
      persistState();
      renderCalculator();
      showToast('¡Ya tienes los puntos suficientes para aprobar!');
      return;
    }

    const rawNeeded = neededPoints / (remainingWeight / 100);
    if (rawNeeded > 20) {
      emptyKeys.forEach((k) => {
        course.grades[k] = '20';
        course.generatedKeys.push(k);
      });
      persistState();
      renderCalculator();
      showToast('Ni sacando 20 en las notas restantes alcanzas el mínimo.');
      return;
    }

    // Round up slightly so the weighted sum meets or slightly exceeds minGrade
    const target = Math.min(20, Math.ceil(rawNeeded * 100) / 100);
    emptyKeys.forEach((k) => {
      course.grades[k] = target.toFixed(2);
      course.generatedKeys.push(k);
    });

    persistState();
    renderCalculator();
    showToast(`Necesitas ${target.toFixed(2)} en las evaluaciones vacías para aprobar.`);
  }

  function handleClearCourse() {
    const wasRegistered = state.activeCourseId !== 'general';
    let generalCourse = state.courses.find((c) => c.id === 'general');
    if (!generalCourse) {
      generalCourse = createEmptyCourse('general', 'General');
      state.courses.unshift(generalCourse);
    }

    state.activeCourseId = 'general';
    GRADE_KEYS.forEach((k) => {
      generalCourse.grades[k] = '';
    });
    generalCourse.generatedKeys = [];
    generalCourse.customWeights = null;
    generalCourse.subgrades = {};

    persistState(true);
    renderCalculator();
    showToast(wasRegistered ? 'Cambiado a General para un nuevo cálculo.' : 'Notas limpiadas.');
  }

  function handleSaveCourseClick() {
    const current = getActiveCourse();
    if (current.id !== 'general') {
      persistState(true);
      showToast(`Notas actualizadas en "${current.name}".`);
      return;
    }

    inputSaveCourseName.value = '';
    openModal(modalSaveCourse);
    setTimeout(() => {
      inputSaveCourseName.focus();
    }, 30);
  }

  function confirmSaveCourse() {
    const name = inputSaveCourseName.value.trim();
    if (!name) {
      showToast('Escribe el nombre del curso.');
      inputSaveCourseName.focus();
      return;
    }

    const current = getActiveCourse();
    const gradesCopy = { ...current.grades };
    const generatedCopy = [...current.generatedKeys];
    const customWeightsCopy = current.customWeights ? { ...current.customWeights } : null;
    const subgradesCopy = structuredClone(current.subgrades || {});

    const existing = state.courses.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      existing.name = name;
      existing.grades = gradesCopy;
      existing.generatedKeys = generatedCopy;
      if (customWeightsCopy) existing.customWeights = customWeightsCopy;
      existing.subgrades = subgradesCopy;
      state.activeCourseId = existing.id;
    } else {
      const id = `course_${Date.now()}`;
      state.courses.push({
        id,
        name,
        grades: gradesCopy,
        generatedKeys: generatedCopy,
        customWeights: customWeightsCopy,
        subgrades: subgradesCopy,
      });
      if (current.id === 'general') {
        GRADE_KEYS.forEach((k) => {
          current.grades[k] = '';
        });
        current.generatedKeys = [];
        current.customWeights = null;
        current.subgrades = {};
      }
      state.activeCourseId = id;
    }

    persistState(true);
    closeModal(modalSaveCourse);
    renderCalculator();
    showToast(`Curso "${name}" guardado en Mis Cursos.`);
  }

  // ---------- Settings ----------
  function renderSettings() {
    const { weights, minGrade, autoSave } = state.settings;
    GRADE_KEYS.forEach((k) => {
      setInputs[k].value = weights[k];
    });
    setPm.value = minGrade;
    toggleAutosave.checked = autoSave;
    updateWeightSumIndicator();
  }

  function updateWeightSumIndicator() {
    const sum = GRADE_KEYS.reduce((acc, k) => acc + (Number(setInputs[k].value) || 0), 0);
    weightSumValue.textContent = `${sum}%`;
    weightSumBadge.classList.toggle('valid', sum === 100);
    weightSumBadge.classList.toggle('invalid', sum !== 100);
    return sum;
  }

  function saveSettings() {
    const sum = updateWeightSumIndicator();
    if (sum !== 100) {
      showToast(`Los porcentajes deben sumar 100% (actualmente ${sum}%).`);
      return;
    }

    const pm = Number(setPm.value);
    if (Number.isNaN(pm) || pm < 0 || pm > 20) {
      showToast('El promedio mínimo debe estar entre 0 y 20.');
      return;
    }

    GRADE_KEYS.forEach((k) => {
      state.settings.weights[k] = Number(setInputs[k].value) || 0;
    });
    state.settings.minGrade = round2(pm);
    state.settings.autoSave = toggleAutosave.checked;

    persistState(true);
    showToast('Configuración guardada.');
    switchView('calculate');
  }

  // ---------- Summary / Multi-course ----------
  function renderSummary() {
    let passed = 0;
    let pending = 0;
    let failed = 0;
    let gpaSum = 0;
    let gpaCount = 0;
    let realCoursesCount = 0;

    const fragment = document.createDocumentFragment();

    state.courses.forEach((course) => {
      const isGeneral = course.id === 'general';
      const ev = evaluateCourse(course);

      if (!isGeneral) {
        realCoursesCount++;
        if (ev.status === 'pass') passed++;
        else if (ev.status === 'fail') failed++;
        else pending++;

        if (ev.filledCount > 0) {
          const projected = ev.enteredWeight > 0 ? round2((ev.accumulated / ev.enteredWeight) * 100) : 0;
          gpaSum += ev.isComplete ? ev.accumulated : projected;
          gpaCount++;
        }
      }

      const card = document.createElement('div');
      card.className = `course-card ${course.id === state.activeCourseId ? 'active-course' : ''}`;
      card.dataset.courseId = course.id;

      let pillClass = 'pending';
      let pillText = isGeneral ? 'Borrador' : 'Sin notas';
      let subText = isGeneral ? 'Cálculo rápido · No cuenta en el resumen' : 'Toca para ingresar notas';

      if (ev.status === 'pass') {
        pillClass = 'pass';
        pillText = `${ev.accumulated.toFixed(2)} · Aprobó`;
        if (!isGeneral) {
          subText = ev.isComplete ? 'Curso completado' : `Aprobado (${ev.enteredWeight}% evaluado)`;
        }
      } else if (ev.status === 'fail') {
        pillClass = 'fail';
        pillText = `${ev.accumulated.toFixed(2)} · Riesgo`;
        if (!isGeneral) {
          subText = ev.isComplete ? 'Desaprobado' : `Máximo posible: ${ev.maxPossible.toFixed(2)}`;
        }
      } else if (ev.status === 'pending') {
        pillClass = 'pending';
        pillText = `${ev.accumulated.toFixed(2)} pts`;
        if (!isGeneral) {
          subText = `Necesitas ${ev.neededAvg.toFixed(2)} en el ${ev.missingWeight}% restante`;
        }
      }

      if (!isGeneral && course.customWeights) {
        subText += ' · % propio';
      }

      card.innerHTML = `
        <div class="course-card-info">
          <span class="course-card-name">${escapeHtml(course.name)}</span>
          <span class="course-card-sub">${subText}</span>
        </div>
        <div class="course-card-right">
          <span class="status-pill ${pillClass}">${pillText}</span>
          ${!isGeneral ? `<button type="button" class="btn-delete-course" data-delete="${course.id}" title="Eliminar curso">✕</button>` : ''}
        </div>
      `;

      fragment.appendChild(card);
    });

    coursesList.replaceChildren(fragment);

    const avgGpa = gpaCount > 0 ? gpaSum / gpaCount : 0;
    summaryGpa.textContent = avgGpa.toFixed(2);
    summaryPassed.textContent = passed;
    summaryPending.textContent = pending;
    summaryFailed.textContent = failed;

    if (realCoursesCount === 0) {
      cycleVerdict.textContent = 'Agrega o guarda tus cursos para evaluar si pasarás el ciclo o año.';
    } else if (failed > 0) {
      cycleVerdict.textContent = `Tienes ${failed} curso(s) en riesgo. Revisa cuánto te falta para recuperar.`;
    } else if (passed === realCoursesCount && passed > 0) {
      cycleVerdict.textContent = '¡Excelente! Vas aprobando todos tus cursos registrados.';
    } else if (gpaCount === 0) {
      cycleVerdict.textContent = 'Ingresa notas en tus cursos para evaluar tu avance del ciclo.';
    } else {
      cycleVerdict.textContent = `Vas bien encaminado: ${passed} aprobado(s) y ${pending} en curso sin riesgo.`;
    }
  }

  function addCourse() {
    const name = inputNewCourse.value.trim();
    if (!name) {
      showToast('Escribe el nombre del curso.');
      return;
    }
    const id = `course_${Date.now()}`;
    state.courses.push(createEmptyCourse(id, name));
    state.activeCourseId = id;
    inputNewCourse.value = '';
    persistState(true);
    renderSummary();
    showToast(`Curso "${name}" agregado.`);
  }

  function deleteCourse(id) {
    if (id === 'general' || state.courses.length <= 1) return;
    const index = state.courses.findIndex((c) => c.id === id);
    if (index < 0) return;

    const [removed] = state.courses.splice(index, 1);
    const wasActive = state.activeCourseId === id;
    if (wasActive) {
      const general = state.courses.find((c) => c.id === 'general');
      state.activeCourseId = general ? general.id : state.courses[0].id;
    }
    persistState(true);
    renderSummary();

    showToast(`Curso "${removed.name}" eliminado.`, {
      actionLabel: 'Deshacer',
      duration: 5000,
      onAction: () => {
        if (state.courses.some((c) => c.id === removed.id)) return;
        state.courses.splice(Math.min(index, state.courses.length), 0, removed);
        if (wasActive) state.activeCourseId = removed.id;
        persistState(true);
        if (views.summary.classList.contains('active')) renderSummary();
        else renderCalculator();
        showToast(`Curso "${removed.name}" restaurado.`);
      },
    });
  }

  // ---------- Independent Course Edit (Name & Weights) Modal ----------
  function openCourseWeightsModal() {
    const course = getActiveCourse();
    const weights = getCourseWeights(course);
    const isGeneral = course.id === 'general';

    cwTitle.textContent = isGeneral ? 'Porcentajes de "General"' : 'Editar curso';
    cwNameGroup.classList.toggle('hidden', isGeneral);
    cwCourseName.value = isGeneral ? '' : course.name;

    GRADE_KEYS.forEach((k) => {
      cwInputs[k].value = weights[k];
    });
    updateCourseWeightsSum();
    openModal(modalCourseWeights);
  }

  function updateCourseWeightsSum() {
    const sum = GRADE_KEYS.reduce((acc, k) => acc + (Number(cwInputs[k].value) || 0), 0);
    cwSumValue.textContent = `${sum}%`;
    cwSumBadge.classList.toggle('valid', sum === 100);
    cwSumBadge.classList.toggle('invalid', sum !== 100);
    return sum;
  }

  function saveCourseWeights() {
    const course = getActiveCourse();
    const isGeneral = course.id === 'general';

    if (!isGeneral) {
      const newName = cwCourseName.value.trim();
      if (!newName) {
        showToast('El nombre del curso no puede estar vacío.');
        cwCourseName.focus();
        return;
      }
      course.name = newName;
    }

    const sum = updateCourseWeightsSum();
    if (sum !== 100) {
      showToast(`Los porcentajes deben sumar 100% (actualmente ${sum}%).`);
      return;
    }

    const custom = {};
    let matchesGlobal = true;
    GRADE_KEYS.forEach((k) => {
      const val = Number(cwInputs[k].value) || 0;
      custom[k] = val;
      if (val !== Number(state.settings.weights[k])) {
        matchesGlobal = false;
      }
    });
    course.customWeights = matchesGlobal ? null : custom;

    persistState(true);
    closeModal(modalCourseWeights);
    renderCalculator();
    showToast(`Cambios aplicados a "${course.name}".`);
  }

  function resetCourseWeights() {
    const course = getActiveCourse();
    course.customWeights = null;
    persistState(true);
    closeModal(modalCourseWeights);
    renderCalculator();
    showToast(`"${course.name}" ahora usa los porcentajes globales.`);
  }

  // ---------- Sub-grades Modal ----------
  function openSubgradesModal(pcKey) {
    activeSubgradeKey = pcKey;
    const course = getActiveCourse();
    const saved = (course.subgrades && course.subgrades[pcKey]) || [];

    subgradesTitle.textContent = `Promediar notas de ${GRADE_LABELS[pcKey]}`;
    subgradesInputs.replaceChildren();
    saved.forEach((v) => addSubgradeRow(v));
    while (subgradesInputs.children.length < 3) addSubgradeRow();
    updateSubgradesPreview();
    openModal(modalSubgrades);
  }

  function renumberSubgradeRows() {
    [...subgradesInputs.children].forEach((row, i) => {
      row.querySelector('.subgrade-label').textContent = `Nota ${i + 1}`;
    });
  }

  function addSubgradeRow(value = '') {
    const row = document.createElement('div');
    row.className = 'subgrade-item';
    row.innerHTML = `
      <span class="subgrade-label"></span>
      <input type="number" min="0" max="20" step="0.01" placeholder="0 - 20" inputmode="decimal" />
      <button type="button" class="subgrade-remove" title="Quitar nota" aria-label="Quitar nota">✕</button>
    `;
    row.querySelector('input').value = value;
    subgradesInputs.appendChild(row);
    renumberSubgradeRows();
    return row;
  }

  function updateSubgradesPreview() {
    const vals = [...subgradesInputs.querySelectorAll('input')]
      .map((inp) => parseGrade(inp.value))
      .filter((v) => v !== null);
    const avg = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    subgradesAvg.textContent = avg.toFixed(2);
    return { avg: round2(avg), count: vals.length };
  }

  function applySubgrades() {
    const { avg, count } = updateSubgradesPreview();
    if (count === 0) {
      showToast('Ingresa al menos una nota.');
      return;
    }
    const course = getActiveCourse();
    const values = [...subgradesInputs.querySelectorAll('input')]
      .map((inp) => parseGrade(inp.value))
      .filter((v) => v !== null)
      .map(String);
    course.subgrades = { ...(course.subgrades || {}), [activeSubgradeKey]: values };
    course.grades[activeSubgradeKey] = avg.toFixed(2);
    course.generatedKeys = course.generatedKeys.filter((k) => k !== activeSubgradeKey);
    persistState(true);
    closeModal(modalSubgrades);
    renderCalculator();
    showToast(`${GRADE_LABELS[activeSubgradeKey]} actualizada a ${avg.toFixed(2)}.`);
  }

  // ---------- Backup Export / Import ----------
  function exportBackup() {
    const payload = {
      app: 'upsjb-note',
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: state.settings,
      activeCourseId: state.activeCourseId,
      courses: state.courses,
    };
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const dateStr = new Date().toISOString().slice(0, 10);
    const a = document.createElement('a');
    a.href = url;
    a.download = `upsjb-note-respaldo-${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('Respaldo .json descargado.');
  }

  function normalizeImportedState(parsed) {
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.courses)) {
      return null;
    }

    const baseSettings = structuredClone(DEFAULT_SETTINGS);
    if (parsed.settings && typeof parsed.settings === 'object') {
      if (typeof parsed.settings.minGrade === 'number' && parsed.settings.minGrade >= 0 && parsed.settings.minGrade <= 20) {
        baseSettings.minGrade = round2(parsed.settings.minGrade);
      }
      if (typeof parsed.settings.autoSave === 'boolean') {
        baseSettings.autoSave = parsed.settings.autoSave;
      }
      if (parsed.settings.weights && typeof parsed.settings.weights === 'object') {
        const sum = GRADE_KEYS.reduce((acc, k) => acc + (Number(parsed.settings.weights[k]) || 0), 0);
        if (sum === 100) {
          GRADE_KEYS.forEach((k) => {
            baseSettings.weights[k] = Number(parsed.settings.weights[k]) || 0;
          });
        }
      }
    }

    const courses = [];
    parsed.courses.forEach((c, idx) => {
      if (!c || typeof c !== 'object') return;
      const id = typeof c.id === 'string' && c.id.trim() ? c.id.trim() : `course_${Date.now()}_${idx}`;
      const name = typeof c.name === 'string' && c.name.trim() ? c.name.trim() : `Curso ${idx + 1}`;
      const grades = { pc1: '', pc2: '', pc3: '', pc4: '', ep: '', ef: '' };
      if (c.grades && typeof c.grades === 'object') {
        GRADE_KEYS.forEach((k) => {
          const g = parseGrade(c.grades[k]);
          grades[k] = g !== null ? String(g) : '';
        });
      }
      let customWeights = null;
      if (c.customWeights && typeof c.customWeights === 'object') {
        const cwSum = GRADE_KEYS.reduce((acc, k) => acc + (Number(c.customWeights[k]) || 0), 0);
        if (cwSum === 100) {
          customWeights = {};
          GRADE_KEYS.forEach((k) => {
            customWeights[k] = Number(c.customWeights[k]) || 0;
          });
        }
      }
      const subgrades = {};
      if (c.subgrades && typeof c.subgrades === 'object') {
        ['pc1', 'pc2', 'pc3', 'pc4'].forEach((k) => {
          if (Array.isArray(c.subgrades[k])) {
            subgrades[k] = c.subgrades[k]
              .map((v) => parseGrade(v))
              .filter((v) => v !== null)
              .map(String);
          }
        });
      }
      courses.push({
        id,
        name: id === 'general' ? 'General' : name,
        grades,
        generatedKeys: Array.isArray(c.generatedKeys) ? c.generatedKeys.filter((k) => GRADE_KEYS.includes(k)) : [],
        customWeights,
        subgrades,
      });
    });

    if (!courses.some((c) => c.id === 'general')) {
      courses.unshift(createEmptyCourse('general', 'General'));
    }

    const activeCourseId = courses.some((c) => c.id === parsed.activeCourseId) ? parsed.activeCourseId : courses[0].id;
    return {
      settings: baseSettings,
      activeCourseId,
      courses,
    };
  }

  function handleImportFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const nextState = normalizeImportedState(parsed);
        if (!nextState) {
          showToast('El archivo no es un respaldo válido de UPSJB Note.');
          return;
        }
        const previousState = structuredClone(state);
        state = nextState;
        persistState(true);
        renderSummary();
        renderSettings();
        renderCalculator();
        const realCount = state.courses.filter((c) => c.id !== 'general').length;
        showToast(`Respaldo importado (${realCount} curso(s)).`, {
          actionLabel: 'Deshacer',
          duration: 6000,
          onAction: () => {
            state = previousState;
            persistState(true);
            renderSummary();
            renderSettings();
            renderCalculator();
            showToast('Importación revertida.');
          },
        });
      } catch {
        showToast('No se pudo leer el archivo .json.');
      }
    };
    reader.readAsText(file);
  }

  // ---------- Helpers ----------
  function escapeHtml(str) {
    return str.replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }

  function hideToast() {
    clearTimeout(toastTimer);
    toastEl.classList.add('hidden');
  }

  function showToast(msg, options = {}) {
    const text = document.createElement('span');
    text.textContent = msg;
    toastEl.replaceChildren(text);

    if (options.actionLabel && typeof options.onAction === 'function') {
      const actionBtn = document.createElement('button');
      actionBtn.type = 'button';
      actionBtn.className = 'toast-action';
      actionBtn.textContent = options.actionLabel;
      actionBtn.addEventListener('click', () => {
        hideToast();
        options.onAction();
      });
      toastEl.appendChild(actionBtn);
    }

    toastEl.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, options.duration || 2800);
  }

  // ---------- Event Listeners ----------
  navCalculate.addEventListener('click', () => switchView('calculate'));
  navSettings.addEventListener('click', () =>
    switchView(views.settings.classList.contains('active') ? 'calculate' : 'settings')
  );
  navSummary.addEventListener('click', () =>
    switchView(views.summary.classList.contains('active') ? 'calculate' : 'summary')
  );
  navInfo.addEventListener('click', () => openModal(modalInfo));
  btnOpenCourses.addEventListener('click', () => switchView('summary'));
  btnCourseWeights.addEventListener('click', openCourseWeightsModal);
  GRADE_KEYS.forEach((k) => {
    cwInputs[k].addEventListener('input', updateCourseWeightsSum);
  });
  btnSaveCourseWeights.addEventListener('click', saveCourseWeights);
  btnResetCourseWeights.addEventListener('click', resetCourseWeights);

  GRADE_KEYS.forEach((k) => {
    gradeInputs[k].addEventListener('input', (e) => {
      let val = e.target.value;
      if (val !== '') {
        const num = Number(val);
        if (num > 20) {
          val = '20';
          e.target.value = '20';
        } else if (num < 0) {
          val = '0';
          e.target.value = '0';
        }
      }
      const course = getActiveCourse();
      course.grades[k] = val;
      course.generatedKeys = course.generatedKeys.filter((gk) => gk !== k);
      styleGradeInput(k, val, false);
      persistState();
      renderResult(evaluateCourse(course));
    });
  });

  document.querySelectorAll('.subgrade-btn').forEach((btn) => {
    btn.addEventListener('click', () => openSubgradesModal(btn.dataset.pc));
  });

  btnNew.addEventListener('click', handleClearCourse);
  btnGenerate.addEventListener('click', handleGenerate);
  btnSaveCourse.addEventListener('click', handleSaveCourseClick);
  btnConfirmSaveCourse.addEventListener('click', confirmSaveCourse);
  inputSaveCourseName.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') confirmSaveCourse();
  });

  GRADE_KEYS.forEach((k) => {
    setInputs[k].addEventListener('input', updateWeightSumIndicator);
  });

  btnSaveSettings.addEventListener('click', saveSettings);
  btnResetDefaults.addEventListener('click', () => {
    state.settings = structuredClone(DEFAULT_SETTINGS);
    persistState(true);
    renderSettings();
    showToast('Valores predeterminados UPSJB restaurados.');
  });

  toggleAutosave.addEventListener('change', () => {
    state.settings.autoSave = toggleAutosave.checked;
    persistState(true);
    showToast(toggleAutosave.checked ? 'Guardado automático activado.' : 'Guardado automático desactivado.');
  });

  btnExportBackup.addEventListener('click', exportBackup);
  btnImportBackup.addEventListener('click', () => {
    inputImportBackup.value = '';
    inputImportBackup.click();
  });
  inputImportBackup.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) handleImportFile(file);
  });

  btnAddCourse.addEventListener('click', addCourse);
  inputNewCourse.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addCourse();
  });

  coursesList.addEventListener('click', (e) => {
    const deleteBtn = e.target.closest('.btn-delete-course');
    if (deleteBtn) {
      deleteCourse(deleteBtn.dataset.delete);
      return;
    }
    const card = e.target.closest('.course-card');
    if (card && card.dataset.courseId) {
      state.activeCourseId = card.dataset.courseId;
      persistState(true);
      switchView('calculate');
    }
  });

  btnAddSubgrade.addEventListener('click', () => {
    const row = addSubgradeRow();
    row.querySelector('input').focus();
  });
  subgradesInputs.addEventListener('input', updateSubgradesPreview);
  subgradesInputs.addEventListener('click', (e) => {
    const removeBtn = e.target.closest('.subgrade-remove');
    if (!removeBtn) return;
    const row = removeBtn.closest('.subgrade-item');
    if (subgradesInputs.children.length <= 1) {
      row.querySelector('input').value = '';
    } else {
      row.remove();
      renumberSubgradeRows();
    }
    updateSubgradesPreview();
  });
  btnApplySubgrades.addEventListener('click', applySubgrades);

  document.querySelectorAll('[data-close-modal]').forEach((btn) => {
    btn.addEventListener('click', () => {
      closeModal(document.getElementById(btn.dataset.closeModal));
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const openEl = ALL_MODALS.find((m) => !m.classList.contains('hidden'));
      if (openEl) closeModal(openEl);
    }
  });

  // Initial render
  renderCalculator();

  // PWA: registra el service worker (solo funciona en https:// o localhost, no al abrir el archivo directamente)
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {
        // Si falla, la app sigue funcionando normalmente en el navegador
      });
    });
  }
})();
