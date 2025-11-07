/* School Data Manager - Single Page App (vanilla JS, localStorage) */

const APP_VERSION = '1.0.0';
const STORAGE_KEY = 'school-data-manager';

function generateId(prefix) {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now()}_${rand}`;
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

const StorageService = {
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      console.error('Failed to load storage', e);
      return null;
    }
  },
  save(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    UI.flashSaved();
  },
  clear() {
    localStorage.removeItem(STORAGE_KEY);
  },
  exportJSON() {
    const data = StorageService.load() ?? AppState.initial();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `school-data-backup-${new Date().toISOString().slice(0,10)}.json`);
  },
};

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const AppState = {
  initial() {
    return {
      version: APP_VERSION,
      students: [],
      teachers: [],
      classes: [],
      enrollments: [],
      theme: 'dark',
    };
  },
  state: null,
  init() {
    const existing = StorageService.load();
    AppState.state = existing ?? AppState.initial();
    if (!existing) StorageService.save(AppState.state);
    UI.setTheme(AppState.state.theme);
    UI.renderAll();
  },
  setTheme(theme) {
    AppState.state.theme = theme;
    StorageService.save(AppState.state);
    UI.setTheme(theme);
  },
};

const Data = {
  add(entity, item) {
    const collection = AppState.state[entity];
    collection.push(item);
    StorageService.save(AppState.state);
  },
  update(entity, id, update) {
    const collection = AppState.state[entity];
    const idx = collection.findIndex(r => r.id === id);
    if (idx >= 0) {
      collection[idx] = { ...collection[idx], ...update };
      StorageService.save(AppState.state);
    }
  },
  remove(entity, id) {
    const collection = AppState.state[entity];
    const next = collection.filter(r => r.id !== id);
    AppState.state[entity] = next;
    if (entity === 'teachers') {
      AppState.state.classes = AppState.state.classes.map(c => c.teacherId === id ? { ...c, teacherId: '' } : c);
    }
    if (entity === 'students') {
      AppState.state.enrollments = AppState.state.enrollments.filter(e => e.studentId !== id);
    }
    if (entity === 'classes') {
      AppState.state.enrollments = AppState.state.enrollments.filter(e => e.classId !== id);
    }
    StorageService.save(AppState.state);
  },
};

const UI = {
  currentView: 'students',
  searchTerm: '',
  sortKey: null,
  setTheme(theme) {
    const isLight = theme === 'light';
    document.documentElement.classList.toggle('light', isLight);
    const toggle = document.getElementById('toggle-theme');
    if (toggle) toggle.checked = isLight;
  },
  flashSaved() {
    const el = document.getElementById('save-indicator');
    el.textContent = 'Saved';
    el.style.opacity = '1';
    clearTimeout(UI._saveTimer);
    UI._saveTimer = setTimeout(() => {
      el.style.opacity = '0.7';
    }, 1200);
  },
  renderAll() {
    UI.renderToolbar();
    UI.renderTabs();
    UI.renderView('students');
    UI.renderView('teachers');
    UI.renderView('classes');
    UI.renderView('enrollments');
    UI.renderReports();
  },
  renderToolbar() {
    const sort = document.getElementById('sort-select');
    const options = UI.getSortOptions(UI.currentView);
    sort.innerHTML = options.map(o => `<option value="${o.key}">${o.label}</option>`).join('');
  },
  getSortOptions(view) {
    if (view === 'students') return [
      { key: 'lastName', label: 'Last name' },
      { key: 'grade', label: 'Grade' },
      { key: 'dob', label: 'DOB' },
    ];
    if (view === 'teachers') return [
      { key: 'lastName', label: 'Last name' },
      { key: 'department', label: 'Department' },
    ];
    if (view === 'classes') return [
      { key: 'name', label: 'Class name' },
      { key: 'code', label: 'Code' },
    ];
    if (view === 'enrollments') return [
      { key: 'status', label: 'Status' },
    ];
    return [{ key: 'name', label: 'Name' }];
  },
  switchView(view) {
    UI.currentView = view;
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === view));
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.dataset.view === view));
    UI.renderToolbar();
    UI.renderView(view);
  },
  renderView(view) {
    if (view === 'students') return UI.renderStudents();
    if (view === 'teachers') return UI.renderTeachers();
    if (view === 'classes') return UI.renderClasses();
    if (view === 'enrollments') return UI.renderEnrollments();
    if (view === 'reports') return UI.renderReports();
    if (view === 'settings') return;
  },
  renderStudents() {
    const tableEl = document.getElementById('students-table');
    const byTerm = filterByTerm(AppState.state.students, UI.searchTerm, ['firstName','lastName','email','grade']);
    const sorted = sortBy(byTerm, UI.sortKey ?? 'lastName');
    const rows = sorted.map(s => `
      <tr>
        <td>${escapeHtml(s.firstName)} ${escapeHtml(s.lastName)}</td>
        <td>${escapeHtml(s.grade)}</td>
        <td>${escapeHtml(s.email ?? '')}</td>
        <td>${escapeHtml(s.dob ?? '')}</td>
        <td class="table-row-actions">
          <button class="btn" data-action="edit" data-id="${s.id}" data-entity="students">Edit</button>
          <button class="btn danger" data-action="delete" data-id="${s.id}" data-entity="students">Delete</button>
        </td>
      </tr>
    `).join('');
    tableEl.innerHTML = `
      <table class="table">
        <thead>
          <tr><th>Name</th><th>Grade</th><th>Email</th><th>DOB</th><th></th></tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="5">No students</td></tr>'}</tbody>
      </table>
    `;
  },
  renderTeachers() {
    const tableEl = document.getElementById('teachers-table');
    const byTerm = filterByTerm(AppState.state.teachers, UI.searchTerm, ['firstName','lastName','email','department']);
    const sorted = sortBy(byTerm, UI.sortKey ?? 'lastName');
    const rows = sorted.map(t => `
      <tr>
        <td>${escapeHtml(t.firstName)} ${escapeHtml(t.lastName)}</td>
        <td>${escapeHtml(t.department ?? '')}</td>
        <td>${escapeHtml(t.email ?? '')}</td>
        <td class="table-row-actions">
          <button class="btn" data-action="edit" data-id="${t.id}" data-entity="teachers">Edit</button>
          <button class="btn danger" data-action="delete" data-id="${t.id}" data-entity="teachers">Delete</button>
        </td>
      </tr>
    `).join('');
    tableEl.innerHTML = `
      <table class="table">
        <thead>
          <tr><th>Name</th><th>Department</th><th>Email</th><th></th></tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="4">No teachers</td></tr>'}</tbody>
      </table>
    `;
  },
  renderClasses() {
    const tableEl = document.getElementById('classes-table');
    const byTerm = filterByTerm(AppState.state.classes, UI.searchTerm, ['name','code','schedule']);
    const sorted = sortBy(byTerm, UI.sortKey ?? 'name');
    const teacherName = id => AppState.state.teachers.find(t => t.id === id);
    const rows = sorted.map(c => {
      const t = teacherName(c.teacherId);
      const tName = t ? `${t.firstName} ${t.lastName}` : '';
      return `
      <tr>
        <td>${escapeHtml(c.name)}</td>
        <td>${escapeHtml(c.code)}</td>
        <td>${escapeHtml(tName)}</td>
        <td>${escapeHtml(c.schedule ?? '')}</td>
        <td class="table-row-actions">
          <button class="btn" data-action="edit" data-id="${c.id}" data-entity="classes">Edit</button>
          <button class="btn danger" data-action="delete" data-id="${c.id}" data-entity="classes">Delete</button>
        </td>
      </tr>`;
    }).join('');
    tableEl.innerHTML = `
      <table class="table">
        <thead>
          <tr><th>Name</th><th>Code</th><th>Teacher</th><th>Schedule</th><th></th></tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="5">No classes</td></tr>'}</tbody>
      </table>
    `;
  },
  renderEnrollments() {
    const tableEl = document.getElementById('enrollments-table');
    const enriched = AppState.state.enrollments.map(e => ({
      ...e,
      student: AppState.state.students.find(s => s.id === e.studentId),
      klass: AppState.state.classes.find(c => c.id === e.classId),
    })).filter(x => x.student && x.klass);
    const byTerm = filterByTerm(enriched, UI.searchTerm, [
      x => `${x.student.firstName} ${x.student.lastName}`,
      x => x.klass.name, x => x.klass.code, 'status'
    ]);
    const sorted = sortBy(byTerm, UI.sortKey ?? 'status');
    const rows = sorted.map(e => `
      <tr>
        <td>${escapeHtml(e.student.firstName)} ${escapeHtml(e.student.lastName)}</td>
        <td>${escapeHtml(e.klass.name)} (${escapeHtml(e.klass.code)})</td>
        <td>${escapeHtml(e.status)}</td>
        <td class="table-row-actions">
          <button class="btn" data-action="edit" data-id="${e.id}" data-entity="enrollments">Edit</button>
          <button class="btn danger" data-action="delete" data-id="${e.id}" data-entity="enrollments">Delete</button>
        </td>
      </tr>
    `).join('');
    tableEl.innerHTML = `
      <table class="table">
        <thead>
          <tr><th>Student</th><th>Class</th><th>Status</th><th></th></tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="4">No enrollments</td></tr>'}</tbody>
      </table>
    `;
  },
  renderReports() {
    UI.renderReportOutput('enrollmentByClass');
  },
  renderReportOutput(kind) {
    const out = document.getElementById('report-output');
    if (kind === 'enrollmentByClass') {
      const groups = groupBy(AppState.state.enrollments, e => e.classId);
      const rows = Object.entries(groups).map(([classId, enrs]) => {
        const klass = AppState.state.classes.find(c => c.id === classId);
        if (!klass) return '';
        const count = enrs.filter(e => e.status === 'enrolled').length;
        return `<tr><td>${escapeHtml(klass.name)}</td><td>${escapeHtml(klass.code)}</td><td>${count}</td></tr>`;
      }).join('');
      out.innerHTML = `
        <table class="table">
          <thead><tr><th>Class</th><th>Code</th><th>Enrolled</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="3">No data</td></tr>'}</tbody>
        </table>`;
    }
    if (kind === 'studentsByGrade') {
      const groups = groupBy(AppState.state.students, s => s.grade ?? 'Unknown');
      const rows = Object.entries(groups).sort((a,b) => a[0].localeCompare(b[0])).map(([grade, list]) => (
        `<tr><td>${escapeHtml(grade)}</td><td>${list.length}</td></tr>`
      )).join('');
      out.innerHTML = `
        <table class="table">
          <thead><tr><th>Grade</th><th>Students</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="2">No data</td></tr>'}</tbody>
        </table>`;
    }
    if (kind === 'teacherLoad') {
      const groups = groupBy(AppState.state.classes, c => c.teacherId || 'Unassigned');
      const rows = Object.entries(groups).map(([teacherId, classes]) => {
        const t = AppState.state.teachers.find(x => x.id === teacherId);
        const name = t ? `${t.firstName} ${t.lastName}` : 'Unassigned';
        return `<tr><td>${escapeHtml(name)}</td><td>${classes.length}</td></tr>`;
      }).join('');
      out.innerHTML = `
        <table class="table">
          <thead><tr><th>Teacher</th><th>Classes</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="2">No data</td></tr>'}</tbody>
        </table>`;
    }
  },
  showForm(entity, id=null) {
    const formHost = document.getElementById(`${entity}-form`);
    const tmplId = entity === 'students' ? 'tmpl-form-student'
      : entity === 'teachers' ? 'tmpl-form-teacher'
      : entity === 'classes' ? 'tmpl-form-class'
      : 'tmpl-form-enrollment';
    const tmpl = document.getElementById(tmplId);
    formHost.innerHTML = '';
    formHost.append(tmpl.content.cloneNode(true));
    formHost.classList.remove('hidden');

    const form = formHost.querySelector('form');
    const title = formHost.querySelector('#form-title');
    const isEdit = Boolean(id);
    title.textContent = `${isEdit ? 'Edit' : 'Add'} ${entity.slice(0,-1)}`;

    if (entity === 'classes') UI.populateTeacherSelect(form.querySelector('#class-teacher'));
    if (entity === 'enrollments') {
      UI.populateStudentSelect(form.querySelector('#enroll-student'));
      UI.populateClassSelect(form.querySelector('#enroll-class'));
    }

    let existing = null;
    if (isEdit) {
      const col = AppState.state[entity];
      existing = col.find(x => x.id === id);
      for (const [name, value] of Object.entries(existing)) {
        const input = form.querySelector(`[name="${name}"]`);
        if (input) input.value = value;
      }
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const data = Object.fromEntries(formData.entries());

      if (entity === 'students') {
        const item = isEdit ? existing : { id: generateId('stu') };
        const next = {
          ...item,
          firstName: (data.firstName||'').trim(),
          lastName: (data.lastName||'').trim(),
          grade: data.grade || '',
          dob: data.dob || '',
          email: (data.email||'').trim(),
        };
        isEdit ? Data.update('students', item.id, next) : Data.add('students', next);
        UI.renderStudents();
      }
      if (entity === 'teachers') {
        const item = isEdit ? existing : { id: generateId('tch') };
        const next = {
          ...item,
          firstName: (data.firstName||'').trim(),
          lastName: (data.lastName||'').trim(),
          email: (data.email||'').trim(),
          department: (data.department||'').trim(),
        };
        isEdit ? Data.update('teachers', item.id, next) : Data.add('teachers', next);
        UI.renderTeachers();
      }
      if (entity === 'classes') {
        const item = isEdit ? existing : { id: generateId('cls') };
        const next = {
          ...item,
          name: (data.name||'').trim(),
          code: (data.code||'').trim(),
          teacherId: data.teacherId || '',
          schedule: (data.schedule||'').trim(),
        };
        isEdit ? Data.update('classes', item.id, next) : Data.add('classes', next);
        UI.renderClasses();
      }
      if (entity === 'enrollments') {
        const item = isEdit ? existing : { id: generateId('enr') };
        const next = {
          ...item,
          studentId: data.studentId,
          classId: data.classId,
          status: data.status || 'enrolled',
        };
        isEdit ? Data.update('enrollments', item.id, next) : Data.add('enrollments', next);
        UI.renderEnrollments();
      }
      formHost.classList.add('hidden');
      formHost.innerHTML = '';
    });

    formHost.querySelector('[data-action="cancel"]').addEventListener('click', () => {
      formHost.classList.add('hidden');
      formHost.innerHTML = '';
    });
  },
  populateTeacherSelect(select) {
    select.innerHTML = '<option value="">?</option>' + AppState.state.teachers
      .map(t => `<option value="${t.id}">${escapeHtml(t.firstName)} ${escapeHtml(t.lastName)}</option>`)?.join('');
  },
  populateStudentSelect(select) {
    select.innerHTML = AppState.state.students
      .map(s => `<option value="${s.id}">${escapeHtml(s.firstName)} ${escapeHtml(s.lastName)}</option>`)?.join('');
  },
  populateClassSelect(select) {
    select.innerHTML = AppState.state.classes
      .map(c => `<option value="${c.id}">${escapeHtml(c.name)} (${escapeHtml(c.code)})</option>`)?.join('');
  },
};

function groupBy(list, keyFn) {
  return list.reduce((acc, item) => {
    const key = typeof keyFn === 'function' ? keyFn(item) : item[keyFn];
    acc[key] ||= []; acc[key].push(item); return acc;
  }, {});
}

function sortBy(list, key) {
  const getter = typeof key === 'function' ? key : (x) => x[key] ?? '';
  return deepClone(list).sort((a,b) => String(getter(a)).localeCompare(String(getter(b))));
}

function filterByTerm(list, term, fields) {
  if (!term) return list;
  const lower = term.toLowerCase();
  const getter = (item, f) => typeof f === 'function' ? f(item) : item[f] ?? '';
  return list.filter(item => fields.some(f => String(getter(item, f)).toLowerCase().includes(lower)));
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"] /g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',' ': ' ' }[c]));
}

function toCSV(rows, headers) {
  const esc = (v) => {
    const s = String(v ?? '');
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g,'""') + '"';
    return s;
  };
  const head = headers.map(h => esc(h.label)).join(',');
  const body = rows.map(r => headers.map(h => esc(r[h.key])).join(',')).join('\n');
  return head + '\n' + body;
}

function downloadCSV(rows, headers, name) {
  const csv = toCSV(rows, headers);
  downloadBlob(new Blob([csv], { type: 'text/csv' }), `${name}-${new Date().toISOString().slice(0,10)}.csv`);
}

function attachGlobalHandlers() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => UI.switchView(tab.dataset.tab));
  });

  document.getElementById('btn-add').addEventListener('click', () => {
    const view = UI.currentView;
    if (view === 'reports' || view === 'settings') return;
    const entity = view;
    UI.showForm(entity, null);
  });

  document.getElementById('sort-select').addEventListener('change', (e) => {
    UI.sortKey = e.target.value;
    UI.renderView(UI.currentView);
  });

  document.getElementById('search-input').addEventListener('input', (e) => {
    UI.searchTerm = e.target.value;
    UI.renderView(UI.currentView);
  });

  document.getElementById('btn-export').addEventListener('click', () => {
    const data = deepClone(AppState.state);
    downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), 'school-data-export.json');
  });

  document.getElementById('file-import').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      if (file.name.endsWith('.json')) {
        const data = JSON.parse(text);
        validateAndLoadData(data);
      } else if (file.name.endsWith('.csv')) {
        // naive CSV import: students or teachers or classes by header detection
        const lower = text.toLowerCase();
        if (lower.includes('grade') && lower.includes('firstname')) {
          const rows = parseCSV(text);
          for (const row of rows) {
            Data.add('students', { id: generateId('stu'), ...row });
          }
        } else if (lower.includes('department')) {
          const rows = parseCSV(text);
          for (const row of rows) {
            Data.add('teachers', { id: generateId('tch'), ...row });
          }
        } else if (lower.includes('code') && lower.includes('name')) {
          const rows = parseCSV(text);
          for (const row of rows) {
            Data.add('classes', { id: generateId('cls'), ...row });
          }
        }
      }
      UI.renderAll();
    } catch (err) {
      alert('Import failed: ' + err.message);
    } finally {
      e.target.value = '';
    }
  });

  document.getElementById('btn-sample').addEventListener('click', () => {
    seedSampleData();
    UI.renderAll();
  });

  document.getElementById('btn-clear').addEventListener('click', () => {
    if (confirm('Clear all data? This cannot be undone.')) {
      AppState.state = AppState.initial();
      StorageService.save(AppState.state);
      UI.renderAll();
    }
  });

  document.getElementById('report-select').addEventListener('change', (e) => {
    UI.renderReportOutput(e.target.value);
  });
  document.getElementById('btn-run-report').addEventListener('click', () => {
    const kind = document.getElementById('report-select').value;
    UI.renderReportOutput(kind);
  });
  document.getElementById('btn-print-report').addEventListener('click', () => window.print());

  document.getElementById('toggle-theme').addEventListener('change', (e) => {
    AppState.setTheme(e.target.checked ? 'light' : 'dark');
  });

  document.getElementById('btn-backup').addEventListener('click', () => StorageService.exportJSON());
  document.getElementById('file-restore').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      validateAndLoadData(data);
      UI.renderAll();
    } catch (err) {
      alert('Restore failed: ' + err.message);
    } finally {
      e.target.value = '';
    }
  });

  document.getElementById('content').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const action = btn.dataset.action;
    if (!action) return;
    const id = btn.dataset.id;
    const entity = btn.dataset.entity;
    if (action === 'edit') UI.showForm(entity, id);
    if (action === 'delete') {
      if (confirm('Delete this record?')) {
        Data.remove(entity, id);
        UI.renderView(UI.currentView);
      }
    }
  });
}

function validateAndLoadData(data) {
  if (!data || typeof data !== 'object') throw new Error('Invalid data');
  const next = AppState.initial();
  for (const key of ['students','teachers','classes','enrollments','theme']) {
    if (key in data) next[key] = deepClone(data[key]);
  }
  AppState.state = next;
  StorageService.save(AppState.state);
}

function parseCSV(csvText) {
  const lines = csvText.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const cells = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i+1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        cells.push(current); current = '';
      } else current += ch;
    }
    cells.push(current);
    const obj = {};
    headers.forEach((h, idx) => obj[camel(h)] = cells[idx]?.trim() ?? '');
    return obj;
  });
}

function camel(s) { return s.replace(/^[^a-zA-Z]+|[^a-zA-Z0-9]+/g, ' ').trim().replace(/ (.)/g, (_,c) => c.toUpperCase()).replace(/^(.)/, (_,c) => c.toLowerCase()); }

function seedSampleData() {
  AppState.state = AppState.initial();
  const teachers = [
    { id: generateId('tch'), firstName: 'Alice', lastName: 'Nguyen', email: 'alice.nguyen@example.edu', department: 'Math' },
    { id: generateId('tch'), firstName: 'Ben', lastName: 'Lopez', email: 'ben.lopez@example.edu', department: 'Science' },
    { id: generateId('tch'), firstName: 'Carmen', lastName: 'Osei', email: 'carmen.osei@example.edu', department: 'History' },
  ];
  const students = Array.from({ length: 12 }).map((_,i) => ({
    id: generateId('stu'),
    firstName: ['Liam','Olivia','Noah','Emma','Amelia','Ava','Sophia','Isabella','Mia','Ethan','Lucas','Evelyn'][i],
    lastName: ['Johnson','Smith','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez','Hernandez','Lopez'][i],
    grade: String(1 + (i % 6)),
    dob: `201${i%10}-0${(i%9)+1}-15`,
    email: ''
  }));
  const classes = [
    { id: generateId('cls'), name: 'Algebra I', code: 'MATH101', teacherId: teachers[0].id, schedule: 'Mon/Wed/Fri 9:00-9:50' },
    { id: generateId('cls'), name: 'Biology', code: 'SCI201', teacherId: teachers[1].id, schedule: 'Tue/Thu 10:00-11:15' },
    { id: generateId('cls'), name: 'World History', code: 'HIS110', teacherId: teachers[2].id, schedule: 'Mon/Wed 13:00-14:15' },
  ];
  const enrollments = [];
  for (const s of students) {
    const cls = classes[Math.floor(Math.random() * classes.length)];
    enrollments.push({ id: generateId('enr'), studentId: s.id, classId: cls.id, status: 'enrolled' });
  }
  AppState.state.teachers = teachers;
  AppState.state.students = students;
  AppState.state.classes = classes;
  AppState.state.enrollments = enrollments;
  StorageService.save(AppState.state);
}

window.addEventListener('DOMContentLoaded', () => {
  attachGlobalHandlers();
  AppState.init();
});
