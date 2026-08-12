/* TaskFlow Team Project Involvement Dashboard */
"use strict";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const DATA_KEY = "taskflowProjectData";
const SETTINGS_KEY = "taskflowSettings";
const AUTH_SESSION_KEY = "taskflow-auth-session";
/* Demo-only POC authentication. Replace this credential check with secure server-side authentication before production. */
const DEMO_USERS = [{ email: "pavankalyan@example.com", password: "TaskFlow@123", name: "Pavankalyan Garavandala", role: "User" }];
const REQUIRED = ["id", "teamMember", "project", "role", "currentWork", "status", "expectedCompletionDate"];
const STATUS_VALUES = ["Ongoing", "Completed", "On Hold", "Not Started", "Blocked"];
const DASHBOARD_MEMBER_LIMIT = 6;
let showAllDashboardMembers = false;
const dashboardInvolvementFilters = { status: "all", project: "all", role: "all", technology: "all", skill: "all", dueDate: "all", blockers: "all" };
let projectData = loadProjectData();
let settings = loadSettings();
let dashboardChart = null;
let reportsChart = null;
let pendingConfirmation = null;
let toastTimer;
let memberFormSkills = [];
let activeSettingsTab = "profile";

function loadSettings() {
  const defaults = { name: "Alex Morgan", email: "alex@taskflow.com", role: "Project Manager", theme: "light", notifications: true, language: "en", emailNotifications: true, taskReminders: true, deadlineAlerts: true, teamUpdates: false };
  try { const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}"); return { ...defaults, ...stored, taskReminders: stored.taskReminders ?? stored.notifications ?? defaults.taskReminders }; }
  catch { return defaults; }
}
function saveSettings() { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }
function loadProjectData() { try { const value = JSON.parse(localStorage.getItem(DATA_KEY) || "[]"); return Array.isArray(value) ? value.map(normalizeMemberRecord) : []; } catch { return []; } }
function saveProjectData(data = projectData) { projectData = data; localStorage.setItem(DATA_KEY, JSON.stringify(projectData)); }
function escapeHTML(value = "") { const div = document.createElement("div"); div.textContent = String(value); return div.innerHTML; }
function getAuthSession() { for (const storage of [sessionStorage, localStorage]) { try { const session = JSON.parse(storage.getItem(AUTH_SESSION_KEY) || "null"); if (session?.authenticated) return session; } catch {} } return null; }
function createAuthSession(user, remember) { const session = { authenticated: true, email: user.email, name: user.name }; localStorage.removeItem(AUTH_SESSION_KEY); sessionStorage.removeItem(AUTH_SESSION_KEY); (remember ? localStorage : sessionStorage).setItem(AUTH_SESSION_KEY, JSON.stringify(session)); return session; }
function clearAuthSession() { localStorage.removeItem(AUTH_SESSION_KEY); sessionStorage.removeItem(AUTH_SESSION_KEY); }
function authenticateUser(email, password) { return DEMO_USERS.find(user => user.email.toLowerCase() === email.toLowerCase() && user.password === password) || null; }
function showLoginPage() { $("#taskflowApp").hidden = true; $("#loginPage").hidden = false; $("#profileMenu").classList.remove("open"); $("#loginPassword").value = ""; $("#loginPassword").type = "password"; $("#toggleLoginPassword").setAttribute("aria-label", "Show password"); document.title = "TaskFlow — Login"; setTimeout(() => $("#loginEmail").focus(), 0); }
function showApplication() { $("#loginPage").hidden = true; $("#taskflowApp").hidden = false; switchPage("dashboard", "replace"); }
function initializeAuthentication() { getAuthSession() ? showApplication() : showLoginPage(); }
function handleLogout() { clearAuthSession(); showLoginPage(); }
function showAuthNotice(message) { $("#authNotice").textContent = message; }
function validateLoginForm() { const email = $("#loginEmail").value.trim(), password = $("#loginPassword").value, emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); $("#loginEmailError").textContent = emailValid ? "" : "Please enter a valid email address."; $("#loginPasswordError").textContent = password.trim() ? "" : "Password is required."; return { valid: emailValid && Boolean(password.trim()), email, password }; }
function handleLogin(event) { event.preventDefault(); const result = validateLoginForm(); $("#loginAuthError").textContent = ""; if (!result.valid) return; const button = $("#loginButton"); button.disabled = true; button.textContent = "Logging in..."; setTimeout(() => { const user = authenticateUser(result.email, result.password); if (user) { createAuthSession(user, $("#rememberMe").checked); showApplication(); showToast("Login successful."); } else { $("#loginAuthError").textContent = "Invalid email address or password."; } button.disabled = false; button.textContent = "Login"; }, 250); }
function localDate(value) { if (!value) return null; const parts = value.split("-").map(Number); if (parts.length !== 3) return null; const date = new Date(parts[0], parts[1] - 1, parts[2]); date.setHours(0, 0, 0, 0); return Number.isNaN(date.getTime()) ? null : date; }
function formatDate(value) { const date = localDate(value); return date ? date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).replace(/ /g, "-") : "Invalid date"; }
function todayStart() { const date = new Date(); date.setHours(0, 0, 0, 0); return date; }
function daysRemaining(value) { const date = localDate(value); return date ? Math.ceil((date - todayStart()) / 86400000) : null; }
function isCompleted(item) { return normalizeStatus(item.status) === "Completed"; }
const NO_BLOCKER_VALUES = new Set(["", "none", "no", "n/a", "na", "not applicable", "no blockers", "nil"]);
function normalizeTechnologies(value) { return (Array.isArray(value) ? value : String(value || "").split(",")).map(item => String(item).trim()).filter(Boolean); }
function normalizeSkills(value) {
  const skills = (Array.isArray(value) ? value : String(value || "").split(",")).map(item => String(item).trim()).filter(Boolean);
  const seen = new Set();
  return skills.filter(skill => { const key = skill.toLowerCase(); if (seen.has(key)) return false; seen.add(key); return true; });
}
function normalizeBlockers(value) { return (Array.isArray(value) ? value : String(value || "").split(",")).map(item => String(item).trim()).filter(item => item && !NO_BLOCKER_VALUES.has(item.toLowerCase().replace(/[.]+$/g, ""))); }
function normalizeMemberRecord(record = {}) { return { ...record, skills: normalizeSkills(record.skills), technologiesUsed: normalizeTechnologies(record.technologiesUsed), blockers: normalizeBlockers(record.blockers) }; }
function blockerText(value) { const blockers = normalizeBlockers(value); return blockers.length ? blockers.join(", ") : "None"; }
function hasBlocker(value) { return normalizeBlockers(value).length > 0; }
function isBlockedItem(record) {
  const status = normalizeStatus(record?.status).trim().toLowerCase();
  return status === "blocked" || hasBlocker(record?.blockers);
}
function initials(name) { return String(name || "?").trim().split(/\s+/).slice(0, 2).map(word => word[0]).join("").toUpperCase(); }
function unique(values) { return [...new Set(values.filter(Boolean))]; }

/* Excel import and normalization */
function normalizeColumnName(value) {
  return String(value ?? "").trim().toLowerCase().replace(/\r?\n/g, " ").replace(/[_-]+/g, " ").replace(/\s*\/\s*/g, "/").replace(/[.:;,()[\]{}]+/g, "").replace(/\s+/g, " ").trim();
}
const COLUMN_ALIASES = {
  id: ["s.no", "sno", "s no", "serial no", "serial number", "employee id", "member id", "id"],
  teamMember: ["team member", "teammember", "member name", "employee name", "resource name", "name"],
  project: ["project / workstream", "project/workstream", "project workstream", "project", "workstream", "project name"],
  role: ["role", "designation", "job role", "team role"],
  skills: ["skills / expertise", "skills/expertise", "skills", "expertise", "skill set", "skillset"],
  currentWork: ["current work", "current activity", "work item", "activity", "current task", "current assignment"],
  workingWith: ["working with", "workingwith", "collaborating with", "collaborator", "reporting to"],
  contribution: ["contribution / value add", "contribution/value add", "contribution", "value add", "value added", "contribution value add"],
  technologiesUsed: ["technologies used", "technology", "technologies", "technology / skills", "technology/skills", "tech stack"],
  status: ["status", "work status", "project status", "current status"],
  expectedCompletionDate: ["expected completion date", "expected completion", "completion date", "expected date", "target date", "due date", "end date"],
  blockers: ["blockers / support required", "blockers/support required", "blockers", "blocker", "support required", "dependency", "dependencies", "issues"]
};
const NORMALIZED_ALIASES = Object.fromEntries(Object.entries(COLUMN_ALIASES).flatMap(([field, aliases]) => aliases.map(alias => [normalizeColumnName(alias), field])));
const REQUIRED_LABELS = { id: "S.No", teamMember: "Team Member", project: "Project / Workstream", role: "Role", currentWork: "Current Work", status: "Status", expectedCompletionDate: "Expected Completion Date" };

function mapHeaderToField(value) { return NORMALIZED_ALIASES[normalizeColumnName(value)] || null; }
function isEmptyRow(row) { return !Array.isArray(row) || row.every(cell => String(cell ?? "").trim() === ""); }
function normalizeStatus(value) {
  const key = String(value ?? "").trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  const compact = key.replace(/\s/g, "");
  if (["ongoing", "inprogress", "active"].includes(compact)) return "Ongoing";
  if (["complete", "completed", "done"].includes(compact)) return "Completed";
  if (["onhold", "hold", "paused"].includes(compact)) return "On Hold";
  if (["notstarted", "pending"].includes(compact)) return "Not Started";
  if (["blocked", "block", "workblocked", "currentlyblocked"].includes(compact)) return "Blocked";
  return key ? String(value).trim() : "Not Started";
}
function normalizeExcelDate(value) {
  if (value === null || value === undefined || String(value).trim() === "") return "";
  let date = null;
  if (typeof value === "number" || /^\d+(\.\d+)?$/.test(String(value).trim())) {
    const serial = Number(value);
    if (serial > 1000 && window.XLSX?.SSF) { const parsed = XLSX.SSF.parse_date_code(serial); if (parsed) date = new Date(parsed.y, parsed.m - 1, parsed.d); }
  } else if (value instanceof Date) date = new Date(value.getFullYear(), value.getMonth(), value.getDate());
  if (!date) {
    const text = String(value).trim();
    const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    const dmy = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
    const monthName = text.match(/^(\d{1,2})[\s-]([A-Za-z]{3,9})[\s-](\d{2,4})$/);
    if (iso) date = new Date(+iso[1], +iso[2] - 1, +iso[3]);
    else if (dmy) { let year = +dmy[3]; if (year < 100) year += 2000; date = new Date(year, +dmy[2] - 1, +dmy[1]); }
    else if (monthName) { let year = +monthName[3]; if (year < 100) year += 2000; date = new Date(`${monthName[1]} ${monthName[2]} ${year}`); }
    else { const parsed = new Date(text); if (!Number.isNaN(parsed.getTime())) date = parsed; }
  }
  if (!date || Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function normalizeDate(value) { return normalizeExcelDate(value); }

function findHeaderRow(rows) {
  let best = null, nonEmptyScanned = 0;
  for (let index = 0; index < rows.length && nonEmptyScanned < 20; index++) {
    const row = rows[index];
    if (isEmptyRow(row)) continue;
    nonEmptyScanned++;
    const fields = row.map(mapHeaderToField).filter(Boolean);
    const recognized = new Set(fields);
    const requiredCount = REQUIRED.filter(field => recognized.has(field)).length;
    const score = requiredCount * 10 + recognized.size;
    if (!best || score > best.score) best = { index, score, requiredCount, recognizedCount: recognized.size };
  }
  if (!best || best.recognizedCount === 0) throw new Error("Could not identify a header row in the first 20 non-empty worksheet rows.");
  return best.index;
}
function validateRequiredColumns(columnMap, headerRowIndex, rawHeaders) {
  const found = new Set(Object.values(columnMap));
  const missing = REQUIRED.filter(field => !found.has(field));
  if (missing.length) throw new Error(`Missing required columns: ${missing.map(field => REQUIRED_LABELS[field]).join(", ")}.\nDetected header row: ${headerRowIndex + 1}.\nDetected headers: ${rawHeaders.filter(value => String(value).trim()).join(", ")}.`);
}
function normalizeExcelRow(row, columnMap) {
  const values = { id: "", teamMember: "", project: "", role: "", skills: [], technologiesUsed: [], currentWork: "", workingWith: "", contribution: "", status: "", expectedCompletionDate: "", blockers: [] };
  Object.entries(columnMap).forEach(([index, field]) => { values[field] = row[Number(index)] ?? ""; });
  Object.keys(values).forEach(field => { if (!["expectedCompletionDate", "skills", "technologiesUsed", "blockers"].includes(field)) values[field] = String(values[field] ?? "").trim(); });
  values.skills = normalizeSkills(values.skills);
  values.technologiesUsed = normalizeTechnologies(values.technologiesUsed);
  values.blockers = normalizeBlockers(values.blockers);
  values.status = normalizeStatus(values.status);
  values.expectedCompletionDate = normalizeExcelDate(values.expectedCompletionDate);
  values.createdAt = Date.now();
  return values;
}
function detectDuplicateIds(records) {
  const seen = new Set(), duplicateIds = [], uniqueRecords = [];
  records.forEach(record => { const key = record.id.trim().toLowerCase(); if (seen.has(key)) duplicateIds.push(record.id.trim()); else { seen.add(key); uniqueRecords.push(record); } });
  return { records: uniqueRecords, duplicateIds: unique(duplicateIds) };
}
function parseExcelWorkbook(buffer) {
  if (!window.XLSX) throw new Error("Excel reader could not be loaded. Check your internet connection and try again.");
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  let rows = null;
  for (const sheetName of workbook.SheetNames) {
    const candidate = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: "", raw: false });
    if (candidate.some(row => !isEmptyRow(row))) { rows = candidate; break; }
  }
  if (!rows) throw new Error("The workbook does not contain a non-empty worksheet.");
  const headerRowIndex = findHeaderRow(rows);
  const rawHeaders = rows[headerRowIndex].map(value => String(value ?? "").trim());
  const normalizedHeaders = rawHeaders.map(normalizeColumnName);
  const columnMap = {};
  rawHeaders.forEach((header, index) => { const field = mapHeaderToField(header); if (field && !Object.values(columnMap).includes(field)) columnMap[index] = field; });
  console.log("Detected header row:", headerRowIndex + 1);
  console.log("Detected raw headers:", rawHeaders);
  console.log("Normalized headers:", normalizedHeaders);
  console.log("Mapped columns:", columnMap);
  validateRequiredColumns(columnMap, headerRowIndex, rawHeaders);
  const valid = [], invalidRows = [];
  rows.slice(headerRowIndex + 1).forEach((row, offset) => {
    if (isEmptyRow(row)) return;
    const worksheetRow = headerRowIndex + offset + 2;
    const record = normalizeExcelRow(row, columnMap);
    const missing = REQUIRED.filter(field => field !== "expectedCompletionDate" && !String(record[field] ?? "").trim());
    if (missing.length || !record.expectedCompletionDate) { invalidRows.push(worksheetRow); return; }
    valid.push(record);
  });
  const deduplicated = detectDuplicateIds(valid);
  console.log("Imported records:", deduplicated.records);
  if (!deduplicated.records.length) {
    const detail = invalidRows.length ? ` Invalid data was found on row${invalidRows.length === 1 ? "" : "s"}: ${invalidRows.join(", ")}.` : "";
    throw new Error(`No valid team involvement records were found.${detail}`);
  }
  return { records: deduplicated.records, invalidRows, duplicateIds: deduplicated.duplicateIds };
}
function readFileAsArrayBuffer(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error("The selected Excel file could not be read.")); reader.readAsArrayBuffer(file); }); }
function refreshApplicationData() { refreshAll(); }
async function importExcelFile(file) {
  if (!file) return;
  if (!/\.(xlsx|xls)$/i.test(file.name)) return showToast("Please select a supported .xlsx or .xls file.", "error");
  $("#importLoading").classList.add("show");
  try {
    const result = parseExcelWorkbook(await readFileAsArrayBuffer(file));
    saveProjectData(result.records);
    refreshApplicationData();
    const skipped = result.invalidRows.length + result.duplicateIds.length;
    let message = skipped ? `${result.records.length} records imported. ${skipped} row${skipped === 1 ? " was" : "s were"} skipped because of invalid or duplicate data.` : `${result.records.length} team involvement record${result.records.length === 1 ? "" : "s"} imported successfully.`;
    if (result.invalidRows.length) message += ` Invalid row${result.invalidRows.length === 1 ? "" : "s"}: ${result.invalidRows.join(", ")}.`;
    if (result.duplicateIds.length) message += ` Skipped duplicate ID${result.duplicateIds.length === 1 ? "" : "s"}: ${result.duplicateIds.join(", ")}.`;
    showToast(message, skipped ? "warning" : "success", skipped ? 6000 : 3000);
  } catch (error) { console.error("Excel import failed:", error.message); showToast(error.message || "Excel import failed. Please check the file and try again.", "error", 7000); }
  finally { $("#importLoading").classList.remove("show"); $("#excelInput").value = ""; }
}

/* Statistics and dashboard */
$("#dashboardTechnologyFilter").insertAdjacentHTML("afterend", `<select id="dashboardSkillsFilter" aria-label="Filter dashboard involvement by skills or expertise"><option value="all">All Skills / Expertise</option></select>`);
function skillsMarkup(value) { const skills = normalizeSkills(value); return `<div class="technology-tags">${skills.length ? skills.map(skill => `<span class="technology-tag">${escapeHTML(skill)}</span>`).join("") : `<span class="empty-value">&mdash;</span>`}</div>`; }
function calculateDashboardStats() {
  const incomplete = projectData.filter(item => !isCompleted(item));
  const blockedRecords = projectData.filter(isBlockedItem);
  console.log("Blocked records:", blockedRecords);
  console.log("Blocked count:", blockedRecords.length);
  return { members: unique(projectData.map(item => item.teamMember.toLowerCase())).length, projects: unique(incomplete.map(item => item.project.toLowerCase())).length, ongoing: projectData.filter(item => normalizeStatus(item.status) === "Ongoing").length, completed: projectData.filter(isCompleted).length, blocked: blockedRecords.length, deadlines: incomplete.filter(item => { const days = daysRemaining(item.expectedCompletionDate); return days !== null && days >= 0 && days <= 30; }).length };
}
const STAT_CARD_DEFINITIONS = {
  members: { title: "Total Team Members", icon: "♟", note: "Unique contributors" },
  projects: { title: "Active Projects", icon: "▦", note: "Incomplete workstreams" },
  ongoing: { title: "Ongoing Work", icon: "◷", note: "Currently in progress" },
  completed: { title: "Completed Work", icon: "✓", note: "Finished records" },
  blocked: { title: "Blocked Items", icon: "!", note: "Needs support" },
  deadlines: { title: "Upcoming Deadlines", icon: "▣", note: "Due in next 30 days" }
};
function createStatCard(key, value, index, noteOverride = null) {
  const definition = STAT_CARD_DEFINITIONS[key];
  return `<article class="stat-card stat-${index}"><div class="stat-icon">${definition.icon}</div><div><p>${definition.title}</p><strong>${value}</strong><small>${noteOverride ?? definition.note}</small></div></article>`;
}
function renderDashboardStats() {
  const stats = calculateDashboardStats();
  $("#dashboardStats").innerHTML = ["members", "projects", "ongoing", "completed", "blocked", "deadlines"].map((key, index) => createStatCard(key, stats[key], index)).join("");
}
function emptyState(title, text) { return `<div class="empty-state"><div class="empty-icon">⌁</div><h3>${title}</h3><p>${text}</p></div>`; }
function technologyTagsMarkup(value) { const technologies = normalizeTechnologies(value); return `<div class="technology-tags">${technologies.length ? technologies.map(technology => `<span class="technology-tag">${escapeHTML(technology)}</span>`).join("") : `<span class="empty-value">—</span>`}</div>`; }
function uniqueDashboardFilterValues(values) { const found = new Map(); values.map(value => String(value || "").trim()).filter(Boolean).forEach(value => { const key = value.toLowerCase(); if (!found.has(key)) found.set(key, value); }); return [...found.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })); }
function setDashboardFilterOptions(id, values, firstLabel, stateKey) { const select = $("#" + id), current = dashboardInvolvementFilters[stateKey]; select.innerHTML = `<option value="all">${firstLabel}</option>${values.map(value => `<option value="${escapeHTML(value)}">${escapeHTML(value)}</option>`).join("")}`; const matching = values.find(value => value.toLowerCase() === String(current).toLowerCase()); dashboardInvolvementFilters[stateKey] = current === "all" || !matching ? "all" : matching; select.value = dashboardInvolvementFilters[stateKey]; }
function populateDashboardInvolvementFilters() { setDashboardFilterOptions("dashboardProjectFilter", uniqueDashboardFilterValues(projectData.map(record => record.project)), "All Projects", "project"); setDashboardFilterOptions("dashboardRoleFilter", uniqueDashboardFilterValues(projectData.map(record => record.role)), "All Roles", "role"); setDashboardFilterOptions("dashboardTechnologyFilter", uniqueDashboardFilterValues(projectData.flatMap(record => normalizeTechnologies(record.technologiesUsed))), "All Technologies", "technology"); setDashboardFilterOptions("dashboardSkillsFilter", uniqueDashboardFilterValues(projectData.flatMap(record => normalizeSkills(record.skills))), "All Skills / Expertise", "skill"); }
function matchesDashboardDueDateFilter(record, filter) { if (filter === "all") return true; const days = daysRemaining(record.expectedCompletionDate); if (filter === "none") return days === null; if (days === null) return false; if (filter === "today") return days === 0; if (filter === "7") return days >= 0 && days <= 7; if (filter === "30") return days >= 0 && days <= 30; if (filter === "overdue") return days < 0 && !isCompleted(record); return true; }
function matchesDashboardBlockerFilter(record, filter) { if (filter === "all") return true; if (filter === "has") return hasBlocker(record.blockers); if (filter === "none") return !hasBlocker(record.blockers); if (filter === "status") return normalizeStatus(record.status).toLowerCase() === "blocked"; return true; }
function applyDashboardInvolvementFilters(records) { return records.filter(record => { const statusMatch = dashboardInvolvementFilters.status === "all" || normalizeStatus(record.status).toLowerCase() === dashboardInvolvementFilters.status.toLowerCase(); const projectMatch = dashboardInvolvementFilters.project === "all" || String(record.project || "").trim().toLowerCase() === dashboardInvolvementFilters.project.toLowerCase(); const roleMatch = dashboardInvolvementFilters.role === "all" || String(record.role || "").trim().toLowerCase() === dashboardInvolvementFilters.role.toLowerCase(); const technologies = normalizeTechnologies(record.technologiesUsed).map(value => value.toLowerCase()); const technologyMatch = dashboardInvolvementFilters.technology === "all" || technologies.includes(dashboardInvolvementFilters.technology.toLowerCase()); const skills = normalizeSkills(record.skills).map(value => value.toLowerCase()); const skillMatch = dashboardInvolvementFilters.skill === "all" || skills.includes(dashboardInvolvementFilters.skill.toLowerCase()); return statusMatch && projectMatch && roleMatch && technologyMatch && skillMatch && matchesDashboardDueDateFilter(record, dashboardInvolvementFilters.dueDate) && matchesDashboardBlockerFilter(record, dashboardInvolvementFilters.blockers); }); }
function hasActiveDashboardFilters() { return Object.values(dashboardInvolvementFilters).some(value => value !== "all"); }
function resetDashboardInvolvementFilters() { Object.keys(dashboardInvolvementFilters).forEach(key => dashboardInvolvementFilters[key] = "all"); showAllDashboardMembers = false; ["dashboardStatusFilter", "dashboardProjectFilter", "dashboardRoleFilter", "dashboardTechnologyFilter", "dashboardSkillsFilter", "dashboardDueDateFilter", "dashboardBlockerFilter"].forEach(id => $("#" + id).value = "all"); renderCurrentTeamInvolvement(); }
function renderCurrentTeamInvolvement() {
  const root = $("#dashboardInvolvement");
  const toggle = $("#dashboardViewAllButton");
  populateDashboardInvolvementFilters();
  $("#dashboardStatusFilter").value = dashboardInvolvementFilters.status; $("#dashboardDueDateFilter").value = dashboardInvolvementFilters.dueDate; $("#dashboardBlockerFilter").value = dashboardInvolvementFilters.blockers; $("#dashboardClearFilters").hidden = !hasActiveDashboardFilters();
  if (!projectData.length) { showAllDashboardMembers = false; toggle.hidden = true; toggle.textContent = "View all →"; toggle.setAttribute("aria-expanded", "false"); root.innerHTML = emptyState("No team project data available.", "Import an Excel file to view team involvement insights."); return; }
  const sortedRecords = applyDashboardInvolvementFilters([...projectData].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
  if (sortedRecords.length <= DASHBOARD_MEMBER_LIMIT) showAllDashboardMembers = false;
  toggle.hidden = sortedRecords.length <= DASHBOARD_MEMBER_LIMIT;
  toggle.textContent = showAllDashboardMembers ? "Show less ↑" : "View all →";
  toggle.setAttribute("aria-expanded", String(showAllDashboardMembers));
  if (!sortedRecords.length) { root.innerHTML = `<div class="empty-state"><div class="empty-icon">⌁</div><h3>No team members match the selected filters.</h3><button type="button" class="text-link" data-dashboard-clear-filters>Clear Filters</button></div>`; return; }
  const latest = showAllDashboardMembers ? sortedRecords : sortedRecords.slice(0, DASHBOARD_MEMBER_LIMIT);
  root.innerHTML = `<div class="involvement-table"><div class="involvement-head"><span>Team Member</span><span>Project / Workstream</span><span>Current Work</span><span>Technologies Used</span><span>Status</span><span>Expected Completion</span><span>Blockers</span><span>Working With</span><span>Contribution / Value Add</span><span></span></div>${latest.map(item => `<article class="involvement-row"><div class="member-cell" data-label="Team Member"><span class="member-avatar">${initials(item.teamMember)}</span><span><strong>${escapeHTML(item.teamMember)}</strong><small>${escapeHTML(item.id)} · ${escapeHTML(item.role)}</small></span></div><strong data-label="Project / Workstream">${escapeHTML(item.project)}</strong><span data-label="Current Work">${escapeHTML(item.currentWork)}</span><div class="technologies-column" data-label="Technologies Used">${technologyTagsMarkup(item.technologiesUsed)}</div><span class="status ${statusClass(item.status)}" data-label="Status">${escapeHTML(item.status)}</span><span data-label="Expected Completion">${formatDate(item.expectedCompletionDate)}</span><span class="blocker-text ${hasBlocker(item.blockers) ? "has" : ""}" data-label="Blockers">${escapeHTML(blockerText(item.blockers))}</span><div class="working-with-column" data-label="Working With">${escapeHTML(item.workingWith || "—")}</div><div class="contribution-column" data-label="Contribution / Value Add">${escapeHTML(item.contribution || "—")}</div><button class="row-menu" data-dashboard-details="${escapeHTML(item.id)}" data-label="Actions">⋮</button></article>`).join("")}</div>`;
  $(".involvement-head", root).children[3].insertAdjacentHTML("afterend", "<span>Skills / Expertise</span>");
  $$(".involvement-row", root).forEach((row, index) => { const technologiesCell = $(".technologies-column", row); technologiesCell.insertAdjacentHTML("afterend", `<div class="skills-column" data-label="Skills / Expertise">${skillsMarkup(latest[index].skills)}</div>`); });
}
function upcomingItems(limit = 6) { return projectData.filter(item => !isCompleted(item) && localDate(item.expectedCompletionDate)).sort((a, b) => localDate(a.expectedCompletionDate) - localDate(b.expectedCompletionDate)).slice(0, limit); }
function deadlineMarkup(items) { return items.length ? items.map(item => { const days = daysRemaining(item.expectedCompletionDate); const wording = days < 0 ? `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue` : days === 0 ? "Due today" : `${days} day${days === 1 ? "" : "s"} remaining`; return `<div class="deadline-item"><span class="deadline-status ${statusClass(item.status)}"></span><div class="deadline-copy"><strong>${escapeHTML(item.project)}</strong><span>${escapeHTML(item.teamMember)} · ${formatDate(item.expectedCompletionDate)}</span></div><small class="days-left ${days < 0 ? "overdue" : ""}">${wording}</small></div>`; }).join("") : `<div class="deadline-empty"><p>No upcoming deadlines.</p></div>`; }
function renderUpcomingDeadlines() { $("#dashboardDeadlines").innerHTML = deadlineMarkup(upcomingItems(5)); }
function statusCounts() { return STATUS_VALUES.map(status => status === "Blocked" ? projectData.filter(isBlockedItem).length : projectData.filter(item => normalizeStatus(item.status) === status && !isBlockedItem(item)).length); }
function chartOptions() { return { responsive: true, maintainAspectRatio: false, cutout: "68%", plugins: { legend: { position: "bottom", labels: { usePointStyle: true, padding: 16, color: getComputedStyle(document.body).color } } } }; }
function renderStatusChart() { if (!window.Chart) return; dashboardChart?.destroy(); dashboardChart = new Chart($("#dashboardStatusChart"), { type: "doughnut", data: { labels: STATUS_VALUES, datasets: [{ data: statusCounts(), backgroundColor: ["#F59E0B", "#10B981", "#3B82F6", "#94A3B8", "#EF4444"], borderWidth: 0 }] }, options: chartOptions() }); }

/* Team member CRUD, cards and filters */
$("#technologiesUsed").closest("label").before($("#memberSkillsTemplate").content.cloneNode(true));
function renderMemberSkillChips() { $("#memberSkillChips").innerHTML = memberFormSkills.map(skill => `<span class="skill-chip"><span>${escapeHTML(skill)}</span><button type="button" data-remove-skill="${escapeHTML(skill)}" aria-label="Remove ${escapeHTML(skill)} skill">×</button></span>`).join(""); }
function resetMemberSkills(value = []) { memberFormSkills = normalizeSkills(value); $("#memberSkillInput").value = ""; $("#memberSkillInputWrapper").hidden = true; $("#memberSkillError").textContent = ""; renderMemberSkillChips(); }
function addMemberSkill() { const input = $("#memberSkillInput"), skill = input.value.trim(); $("#memberSkillError").textContent = ""; if (!skill) { input.focus(); return; } if (memberFormSkills.some(item => item.toLowerCase() === skill.toLowerCase())) { $("#memberSkillError").textContent = "This skill has already been added."; input.focus(); return; } memberFormSkills.push(skill); input.value = ""; renderMemberSkillChips(); input.focus(); }
function removeMemberSkill(skill) { memberFormSkills = memberFormSkills.filter(item => item.toLowerCase() !== skill.toLowerCase()); renderMemberSkillChips(); }
function statusClass(status) { return normalizeStatus(status).toLowerCase().replace(/\s+/g, "-"); }
function memberCard(item) { return `<article class="member-card" data-id="${escapeHTML(item.id)}"><div class="member-card-head"><span class="member-avatar large">${initials(item.teamMember)}</span><div><h3>${escapeHTML(item.teamMember)}</h3><small>${escapeHTML(item.id)}</small></div><div class="member-menu"><button data-member-action="menu" aria-label="Open actions">⋮</button><div class="task-action-menu"><button data-member-action="view">View Details</button><button data-member-action="edit">Edit</button><button data-member-action="delete" class="delete">Delete</button></div></div></div><div class="member-project"><strong>${escapeHTML(item.project)}</strong><span>${escapeHTML(item.role)}</span></div><p class="current-work">${escapeHTML(item.currentWork)}</p><div class="member-meta"><span class="status ${statusClass(item.status)}">${escapeHTML(item.status)}</span><span>▣ ${formatDate(item.expectedCompletionDate)}</span></div><div class="card-blocker"><strong>Blockers:</strong> <span class="${hasBlocker(item.blockers) ? "has" : ""}">${escapeHTML(blockerText(item.blockers))}</span></div></article>`; }
function filteredMembers() {
  const query = $("#memberSearch").value.trim().toLowerCase(), status = $("#statusFilter").value, project = $("#projectFilter").value, role = $("#roleFilter").value, date = $("#dateFilter").value, blocker = $("#blockerFilter").value;
  return projectData.filter(item => [item.teamMember, item.id, item.project, item.role, item.currentWork, item.workingWith, ...normalizeTechnologies(item.technologiesUsed)].some(value => String(value).toLowerCase().includes(query))).filter(item => status === "all" || normalizeStatus(item.status) === status).filter(item => project === "all" || item.project === project).filter(item => role === "all" || item.role === role).filter(item => { const days = daysRemaining(item.expectedCompletionDate); return date === "all" || (date === "today" && days === 0) || (date === "30" && days >= 0 && days <= 30) || (date === "overdue" && days < 0 && !isCompleted(item)); }).filter(item => blocker === "all" || (blocker === "blocked" ? hasBlocker(item.blockers) : !hasBlocker(item.blockers)));
}
function renderTeamMembers() { const items = filteredMembers(); $("#memberGrid").innerHTML = items.length ? items.map(memberCard).join("") : emptyState("No team members found.", projectData.length ? "Try another search or adjust your filters." : "Import Excel or add a team member."); }
function populateProjectFilters() { preserveOptions($("#projectFilter"), unique(projectData.map(item => item.project)).sort(), "All Projects"); }
function populateRoleFilters() { preserveOptions($("#roleFilter"), unique(projectData.map(item => item.role)).sort(), "All Roles"); }
function preserveOptions(select, values, first) { const current = select.value; select.innerHTML = `<option value="all">${first}</option>${values.map(value => `<option>${escapeHTML(value)}</option>`).join("")}`; if (["all", ...values].includes(current)) select.value = current; }
function applyTeamFilters() { renderTeamMembers(); }
function clearMemberErrors() { $$(".field-error", $("#memberForm")).forEach(error => error.textContent = ""); $$(".is-invalid", $("#memberForm")).forEach(field => field.classList.remove("is-invalid")); }
function setMemberError(id, message) { const field = $("#" + id); field.classList.add("is-invalid"); $(`[data-error-for="${id}"]`).textContent = message; return field; }
function selectedBlockers() { const values = $$('#blockerOptions input[type="checkbox"]:checked').map(input => input.value); const other = $("#otherBlocker").value.trim(); return values.map(value => value === "Other" && other ? `Other: ${other}` : value); }
function updateBlockerPicker() { const selected = selectedBlockers(); $("#blockers").value = selected.join(", "); $("#blockerSummary span").textContent = selected.length ? selected.join(", ") : "Select blocker(s)"; const showOther = $('#blockerOptions input[value="Other"]').checked; $("#otherBlockerField").classList.toggle("show", showOther); $$(".blocker-grid label").forEach(label => label.classList.toggle("selected", label.querySelector("input").checked)); }
function resetBlockerPicker() { $$('#blockerOptions input[type="checkbox"]').forEach(input => input.checked = false); $("#otherBlocker").value = ""; $("#blockerOptions").hidden = false; $("#blockerSummary").setAttribute("aria-expanded", "true"); updateBlockerPicker(); }
function populateBlockerPicker(value) { resetBlockerPicker(); const known = new Set($$('#blockerOptions input[type="checkbox"]').map(input => input.value)); const custom = []; normalizeBlockers(value).forEach(blocker => { const exact = $$('#blockerOptions input[type="checkbox"]').find(input => input.value.toLowerCase() === blocker.toLowerCase()); if (exact) exact.checked = true; else if (blocker.toLowerCase().startsWith("other:")) custom.push(blocker.slice(blocker.indexOf(":") + 1).trim()); else if (!known.has(blocker)) custom.push(blocker); }); if (custom.length) { $('#blockerOptions input[value="Other"]').checked = true; $("#otherBlocker").value = custom.join(", "); } updateBlockerPicker(); }
function openMemberModal(id = null) {
  $("#memberForm").reset(); clearMemberErrors(); resetBlockerPicker(); resetMemberSkills(); $("#originalMemberId").value = ""; $("#memberModalTitle").textContent = id ? "Edit Member" : "Add Member"; $("#memberSubmitBtn").textContent = id ? "Update Member" : "Save Member";
  if (id) { const item = projectData.find(row => row.id === id); if (!item) return; $("#originalMemberId").value = item.id; $("#memberId").value = item.id; $("#teamMember").value = item.teamMember; $("#project").value = item.project; $("#role").value = item.role; resetMemberSkills(item.skills); $("#technologiesUsed").value = normalizeTechnologies(item.technologiesUsed).join(", "); $("#currentWork").value = item.currentWork; $("#workingWith").value = item.workingWith || ""; $("#contribution").value = item.contribution || ""; $("#memberStatus").value = normalizeStatus(item.status); $("#completionDate").value = item.expectedCompletionDate; populateBlockerPicker(item.blockers); }
  $("#memberModal").classList.add("open"); document.body.classList.add("member-modal-open"); setTimeout(() => $("#memberId").focus(), 80);
}
function saveMember(event) {
  event.preventDefault(); clearMemberErrors(); const original = $("#originalMemberId").value; const item = { id: $("#memberId").value.trim(), teamMember: $("#teamMember").value.trim(), project: $("#project").value.trim(), role: $("#role").value.trim(), skills: [...memberFormSkills], technologiesUsed: normalizeTechnologies($("#technologiesUsed").value), currentWork: $("#currentWork").value.trim(), workingWith: $("#workingWith").value.trim(), contribution: $("#contribution").value.trim(), status: normalizeStatus($("#memberStatus").value), expectedCompletionDate: $("#completionDate").value, blockers: selectedBlockers(), createdAt: original ? projectData.find(row => row.id === original)?.createdAt || Date.now() : Date.now() };
  const checks = [["memberId", item.id, "Employee ID is required."], ["teamMember", item.teamMember, "Team member name is required."], ["project", item.project, "Project or workstream is required."], ["role", item.role, "Role is required."], ["technologiesUsed", item.technologiesUsed.length, "Technologies Used is required."], ["currentWork", item.currentWork, "Current Work is required."], ["memberStatus", item.status, "Status is required."], ["completionDate", item.expectedCompletionDate, "Expected Completion Date is required."]];
  const invalid = checks.filter(([, value]) => !value).map(([id, , message]) => setMemberError(id, message));
  if (item.expectedCompletionDate && !localDate(item.expectedCompletionDate)) invalid.push(setMemberError("completionDate", "Enter a valid completion date."));
  if (item.id && projectData.some(row => row.id.toLowerCase() === item.id.toLowerCase() && row.id.toLowerCase() !== original.toLowerCase())) invalid.push(setMemberError("memberId", "This Employee ID already exists."));
  if (invalid.length) { invalid[0].focus(); return; }
  if (original) projectData[projectData.findIndex(row => row.id === original)] = item; else projectData.unshift(item);
  saveProjectData(); closeModal("memberModal"); refreshAll(); showToast(original ? "Team member updated successfully." : "Team member added successfully.");
}
function editMember(id) { openMemberModal(id); }
function deleteMember(id) { const item = projectData.find(row => row.id === id); if (!item) return; askConfirmation("Delete this record?", `${item.teamMember}'s involvement in ${item.project} will be permanently removed.`, () => { projectData = projectData.filter(row => row.id !== id); saveProjectData(); refreshAll(); showToast("Member involvement deleted."); }); }
function showDetails(id) { const item = projectData.find(row => row.id === id); if (!item) return; $("#detailsTitle").textContent = item.teamMember; const fields = [["S.No / Employee ID", item.id], ["Team Member", item.teamMember], ["Project / Workstream", item.project], ["Role", item.role], ["Current Work", item.currentWork], ["Working With", item.workingWith || "—"], ["Contribution / Value Add", item.contribution || "—"], ["Status", item.status], ["Expected Completion Date", formatDate(item.expectedCompletionDate)], ["Blockers / Support Required", blockerText(item.blockers)]]; $("#detailsContent").innerHTML = `<div class="detail-grid">${fields.map(([label, value]) => `<div><small>${label}</small><strong>${escapeHTML(value)}</strong></div>`).join("")}</div>`; $("#detailsModal").classList.add("open"); }

/* Reports */
function renderReports() {
  const root = $("#reportsContent"); if (!projectData.length) { reportsChart?.destroy(); root.innerHTML = `<article class="task-panel">${emptyState("No report data available.", "Import team project data to generate reports.")}</article>`; return; }
  const s = calculateDashboardStats(), projects = unique(projectData.map(item => item.project)).map(project => ({ project, members: unique(projectData.filter(item => item.project === project).map(item => item.teamMember.toLowerCase())).length })).sort((a, b) => b.members - a.members), max = Math.max(...projects.map(item => item.members), 1); const now = new Date(); const monthlyRows = projectData.filter(item => { const date = new Date(item.createdAt || 0); return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear(); }); const monthlyCompleted = monthlyRows.filter(isCompleted).length; const rate = projectData.length ? Math.round(s.completed / projectData.length * 100) : 0;
  root.innerHTML = `<div class="stats-grid report-stats-grid">${["members", "projects", "ongoing", "completed", "blocked"].map((key, index) => createStatCard(key, s[key], index, "Live project data")).join("")}</div><div class="report-sections"><article class="chart-card"><h2>Projects by Status</h2><p>All involvement records by status.</p><div class="chart-wrap"><canvas id="reportsStatusChart"></canvas></div></article><article class="progress-card project-progress"><h2>Team Members by Project</h2><p>Unique team members assigned to each project.</p><div>${projects.map(item => `<div class="project-bar"><span><strong>${escapeHTML(item.project)}</strong><b>${item.members}</b></span><div class="progress-track"><i style="width:${item.members / max * 100}%"></i></div></div>`).join("")}</div></article><article class="upcoming-card"><h2>Upcoming Deadlines</h2><p>Incomplete projects ordered by nearest date.</p><div class="upcoming-list">${deadlineMarkup(upcomingItems(8))}</div></article><article class="monthly-card"><div class="monthly-heading"><h2>Monthly Summary</h2><p>Dynamic team project performance.</p></div><div class="monthly-grid five">${[["Records Created", monthlyRows.length], ["Work Completed", monthlyCompleted], ["Completion Rate", `${rate}%`], ["Active Projects", s.projects], ["Blocked Items", s.blocked]].map(([label, value], i) => `<div class="monthly-item report-${i}"><div><small>${label}</small><strong>${value}</strong></div></div>`).join("")}</div></article></div>`;
  if (window.Chart) { reportsChart?.destroy(); reportsChart = new Chart($("#reportsStatusChart"), { type: "doughnut", data: { labels: STATUS_VALUES, datasets: [{ data: statusCounts(), backgroundColor: ["#F59E0B", "#10B981", "#3B82F6", "#94A3B8", "#EF4444"], borderWidth: 0 }] }, options: chartOptions() }); }
}

/* Settings, support and shared UI */
function applySettings() {
  const words = settings.name.trim().split(/\s+/), avatar = words.slice(0, 2).map(word => word[0]).join("").toUpperCase() || "U", roleSelect = $("#roleSelect");
  $("#headerName").textContent = settings.name; $$(".avatar").forEach(node => node.textContent = avatar); $("#nameInput").value = settings.name; $("#emailInput").value = settings.email;
  if (![...roleSelect.options].some(option => option.value === settings.role)) roleSelect.add(new Option(settings.role, settings.role));
  roleSelect.value = settings.role; $("#themeToggle").checked = settings.theme === "dark"; $$('[data-notification-key]').forEach(toggle => toggle.checked = Boolean(settings[toggle.dataset.notificationKey])); $("#languageSelect").value = settings.language; document.body.classList.toggle("dark", settings.theme === "dark");
}
function setTheme(theme) { settings.theme = theme; saveSettings(); applySettings(); renderStatusChart(); renderReports(); }
function clearAllProjectData() { askConfirmation("Clear All Data?", "This will permanently remove all imported team project data. Your profile and preferences will remain.", () => { projectData = []; localStorage.removeItem(DATA_KEY); refreshAll(); showToast("All team project data cleared."); }, "Clear Data"); }
function activateSettingsTab(tab) { if (!["profile", "preferences", "notifications", "security"].includes(tab)) return; activeSettingsTab = tab; $$("[data-settings-tab]").forEach(button => { const active = button.dataset.settingsTab === tab; button.classList.toggle("active", active); button.setAttribute("aria-selected", String(active)); }); $$("[data-settings-panel]").forEach(panel => { const active = panel.dataset.settingsPanel === tab; panel.hidden = !active; panel.classList.toggle("active", active); }); }
function askConfirmation(title, text, action, confirmLabel = "Confirm") { $("#confirmTitle").textContent = title; $("#confirmText").textContent = text; $("#confirmAction").textContent = confirmLabel; pendingConfirmation = action; $("#confirmModal").classList.add("open"); }
function closeModal(id) { $("#" + id)?.classList.remove("open"); if (id === "memberModal") { document.body.classList.remove("member-modal-open"); clearMemberErrors(); $("#memberForm").reset(); resetBlockerPicker(); resetMemberSkills(); $("#originalMemberId").value = ""; $("#memberModalTitle").textContent = "Add Member"; $("#memberSubmitBtn").textContent = "Save Member"; } }
function showToast(message, type = "success", duration = 2600) { const toast = $("#toast"); toast.textContent = message; toast.className = `toast show ${type}`; clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove("show"), duration); }
const supportContent = {
  faq: ["How do I import team project data?", "Which Excel file formats are supported?", "How are dashboard statistics calculated?", "Can I edit imported team-member information?", "How are blocked items identified?", "How is completion status determined?"],
  guide: `<div class="guide-list"><p><strong>Dashboard</strong><span>Review team statistics, active involvement, deadlines and status.</span></p><p><strong>Team Members</strong><span>Import, add, search, filter, view, edit and delete involvement records.</span></p><p><strong>Reports</strong><span>Track projects, people, blockers, deadlines and completion.</span></p><p><strong>Settings</strong><span>Manage profile, appearance, preferences and local data.</span></p></div>`,
  shortcuts: `<div class="shortcut-list"><p><kbd>Ctrl</kbd> + <kbd>N</kbd><span>Add a member</span></p><p><kbd>Ctrl</kbd> + <kbd>F</kbd><span>Focus team search</span></p><p><kbd>Escape</kbd><span>Close dialogs</span></p><p><kbd>Ctrl</kbd> + <kbd>I</kbd><span>Import Excel</span></p></div>`,
  problem: `<form id="problemForm" class="problem-form"><label>Subject<input required maxlength="100"></label><label>Description<textarea required rows="5" maxlength="500"></textarea></label><button class="primary-btn" type="submit">Submit Report</button></form>`,
  about: `<div class="about-content"><div class="about-logo">✓</div><h3>TaskFlow</h3><strong>Team Project Involvement Dashboard</strong><p>Built with HTML, CSS, JavaScript, SheetJS and Chart.js.</p><p>Your data is stored locally in this browser.</p></div>`
};
function openSupport(type) { const titles = { faq: "Frequently Asked Questions", guide: "User Guide", shortcuts: "Keyboard Shortcuts", problem: "Report a Problem", about: "About TaskFlow" }; $("#supportModalTitle").textContent = titles[type]; $("#supportModalContent").innerHTML = type === "faq" ? `<div class="faq-list">${supportContent.faq.map((q, i) => `<details ${i === 0 ? "open" : ""}><summary>${q}</summary><p>${["Use any Import Excel control, then select a spreadsheet whose first sheet contains the required columns.", "TaskFlow supports .xlsx and .xls files.", "Statistics are calculated live from unique team members, projects, statuses, blocker values and due dates.", "Yes. Use the card menu and select Edit; updates are saved immediately.", "Any value other than blank, None, No, N/A, NA or Not Applicable is treated as a blocker.", "Rows whose normalized Status is Completed are considered complete."][i]}</p></details>`).join("")}</div>` : supportContent[type]; $("#supportModal").classList.add("open"); }
function switchPage(page, historyMode = "push") { if (!getAuthSession()) { showLoginPage(); return; } const valid = ["dashboard", "members", "reports", "settings"]; if (!valid.includes(page)) page = "dashboard"; $$(".page").forEach(section => section.classList.toggle("active", section.id === `${page}Page`)); $$(".nav-item").forEach(item => item.classList.toggle("active", item.dataset.page === page)); const title = page === "members" ? "Team Members" : page[0].toUpperCase() + page.slice(1); $("#headerPageTitle").textContent = title; document.title = `TaskFlow — ${title}`; if (historyMode === "push") history.pushState({ page }, "", `#${page}`); else if (historyMode === "replace") history.replaceState({ page }, "", `#${page}`); $("#sidebar").classList.remove("open"); $("#mobileOverlay").classList.remove("open"); if (page === "reports") renderReports(); window.scrollTo({ top: 0, behavior: "smooth" }); }
function page(name) { switchPage(name); }
function refreshAll() { renderDashboardStats(); renderCurrentTeamInvolvement(); renderUpcomingDeadlines(); populateProjectFilters(); populateRoleFilters(); renderTeamMembers(); renderStatusChart(); renderReports(); $("#navMemberCount").textContent = unique(projectData.map(item => item.teamMember.toLowerCase())).length; }

/* Event wiring */
$("#loginForm").addEventListener("submit", handleLogin);
$("#loginForm").addEventListener("input", event => { if (event.target.id === "loginEmail") $("#loginEmailError").textContent = ""; if (event.target.id === "loginPassword") $("#loginPasswordError").textContent = ""; $("#loginAuthError").textContent = ""; });
$("#toggleLoginPassword").addEventListener("click", () => { const input = $("#loginPassword"), show = input.type === "password"; input.type = show ? "text" : "password"; $("#toggleLoginPassword").setAttribute("aria-label", show ? "Hide password" : "Show password"); });
$("#forgotPassword").addEventListener("click", () => showAuthNotice("Please contact your administrator to reset your password."));
$("#googleSignIn").addEventListener("click", () => showAuthNotice("Google sign-in is not configured."));
$("#contactAdmin").addEventListener("click", () => showAuthNotice("Please contact your TaskFlow administrator for account access."));
document.addEventListener("keydown", event => { if (!getAuthSession() && event.ctrlKey) event.stopImmediatePropagation(); }, true);
$$('[data-import]').forEach(button => button.addEventListener("click", () => $("#excelInput").click()));
$("#excelInput").addEventListener("change", event => importExcelFile(event.target.files[0]));
$$('.nav-item').forEach(button => button.addEventListener("click", () => switchPage(button.dataset.page)));
$$('[data-page-link]').forEach(button => button.addEventListener("click", () => switchPage(button.dataset.pageLink)));
$("#dashboardViewAllButton").addEventListener("click", event => { event.preventDefault(); showAllDashboardMembers = !showAllDashboardMembers; renderCurrentTeamInvolvement(); if (!showAllDashboardMembers) { const panel = $(".involvement-panel"), bounds = panel.getBoundingClientRect(); if (bounds.top < 0 || bounds.top > window.innerHeight) panel.scrollIntoView({ behavior: "smooth", block: "start" }); } });
const dashboardFilterIds = { dashboardStatusFilter: "status", dashboardProjectFilter: "project", dashboardRoleFilter: "role", dashboardTechnologyFilter: "technology", dashboardSkillsFilter: "skill", dashboardDueDateFilter: "dueDate", dashboardBlockerFilter: "blockers" };
Object.entries(dashboardFilterIds).forEach(([id, key]) => $("#" + id).addEventListener("change", event => { dashboardInvolvementFilters[key] = event.target.value; renderCurrentTeamInvolvement(); }));
$("#dashboardClearFilters").addEventListener("click", resetDashboardInvolvementFilters);
$("#addMemberBtn").addEventListener("click", () => openMemberModal());
$("#memberForm").addEventListener("submit", saveMember);
$("#addMemberSkillButton").addEventListener("click", () => { $("#memberSkillInputWrapper").hidden = false; $("#memberSkillInput").focus(); });
$("#confirmMemberSkill").addEventListener("click", addMemberSkill);
$("#memberSkillInput").addEventListener("keydown", event => { if (event.key === "Enter") { event.preventDefault(); addMemberSkill(); } });
$("#memberSkillInput").addEventListener("input", () => { $("#memberSkillError").textContent = ""; });
$("#memberSkillChips").addEventListener("click", event => { const button = event.target.closest("[data-remove-skill]"); if (button) removeMemberSkill(button.dataset.removeSkill); });
$("#memberForm").addEventListener("input", event => { if (event.target.id) { event.target.classList.remove("is-invalid"); const error = $(`[data-error-for="${event.target.id}"]`); if (error) error.textContent = ""; } });
$("#blockerOptions").addEventListener("change", updateBlockerPicker);
$("#otherBlocker").addEventListener("input", updateBlockerPicker);
$("#blockerSummary").addEventListener("click", () => { const options = $("#blockerOptions"), expanded = $("#blockerSummary").getAttribute("aria-expanded") === "true"; $("#blockerSummary").setAttribute("aria-expanded", String(!expanded)); options.hidden = expanded; });
["memberSearch", "statusFilter", "projectFilter", "roleFilter", "dateFilter", "blockerFilter"].forEach(id => $("#" + id).addEventListener(id === "memberSearch" ? "input" : "change", applyTeamFilters));
$("#memberGrid").addEventListener("click", event => { const button = event.target.closest("[data-member-action]"); if (!button) return; const card = event.target.closest(".member-card"), id = card.dataset.id, action = button.dataset.memberAction; if (action === "menu") { event.stopPropagation(); const menu = button.nextElementSibling; $$(".task-action-menu.open").forEach(node => { if (node !== menu) node.classList.remove("open"); }); menu.classList.toggle("open"); } else { button.closest(".task-action-menu").classList.remove("open"); if (action === "view") showDetails(id); if (action === "edit") editMember(id); if (action === "delete") deleteMember(id); } });
$("#dashboardInvolvement").addEventListener("click", event => { const clear = event.target.closest("[data-dashboard-clear-filters]"); if (clear) return resetDashboardInvolvementFilters(); const button = event.target.closest("[data-dashboard-details]"); if (button) showDetails(button.dataset.dashboardDetails); });
$$('[data-close]').forEach(button => button.addEventListener("click", () => closeModal(button.dataset.close)));
$$('.modal-backdrop').forEach(backdrop => backdrop.addEventListener("click", event => { if (event.target === backdrop) closeModal(backdrop.id); }));
$("#clearDataBtn").addEventListener("click", clearAllProjectData);
$("#confirmAction").addEventListener("click", () => { const action = pendingConfirmation; pendingConfirmation = null; closeModal("confirmModal"); action?.(); });
$("#profileForm").addEventListener("submit", event => { event.preventDefault(); const name = $("#nameInput").value.trim(), email = $("#emailInput").value.trim(), emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); $("#nameError").textContent = name ? "" : "Full Name is required."; $("#emailError").textContent = email ? (emailValid ? "" : "Enter a valid email address.") : "Email Address is required."; if (!name || !emailValid) return; settings.name = name; settings.email = email; settings.role = $("#roleSelect").value; saveSettings(); applySettings(); showToast("Profile updated successfully."); });
$("#profileForm").addEventListener("input", event => { const error = event.target.id === "nameInput" ? $("#nameError") : event.target.id === "emailInput" ? $("#emailError") : null; if (error) error.textContent = ""; });
$("#passwordForm").addEventListener("submit", event => { event.preventDefault(); const current = $("#currentPassword").value, next = $("#newPassword").value, confirm = $("#confirmPassword").value; $("#currentPasswordError").textContent = current.trim() ? "" : "Current Password is required."; $("#newPasswordError").textContent = next.trim() ? "" : "New Password is required."; $("#confirmPasswordError").textContent = !confirm.trim() ? "Confirm New Password is required." : confirm === next ? "" : "Passwords do not match."; if (!current.trim() || !next.trim() || !confirm.trim() || confirm !== next) return; event.target.reset(); showToast("Password updated for this local demo session."); });
$("#passwordForm").addEventListener("input", event => { const error = $(`#${event.target.id}Error`); if (error) error.textContent = ""; });
$$('[data-password-toggle]').forEach(button => button.addEventListener("click", () => { const input = $("#" + button.dataset.passwordToggle), show = input.type === "password"; input.type = show ? "text" : "password"; button.textContent = show ? "⊘" : "◉"; button.setAttribute("aria-label", `${show ? "Hide" : "Show"} ${button.dataset.passwordToggle === "newPassword" ? "new" : "confirm"} password`); }));
$$('[data-settings-tab]').forEach(button => button.addEventListener("click", () => activateSettingsTab(button.dataset.settingsTab)));
$("#themeToggle").addEventListener("change", event => setTheme(event.target.checked ? "dark" : "light"));
$$('[data-notification-key]').forEach(toggle => toggle.addEventListener("change", event => { const key = event.target.dataset.notificationKey; settings[key] = event.target.checked; if (key === "taskReminders") settings.notifications = event.target.checked; saveSettings(); showToast(`${event.target.closest(".notification-setting-row").querySelector("strong").textContent} ${event.target.checked ? "enabled" : "disabled"}.`); }));
$("#languageSelect").addEventListener("change", event => { settings.language = event.target.value; saveSettings(); showToast("Language updated successfully."); });
$(".support-options").addEventListener("click", event => { const button = event.target.closest("[data-support]"); if (button) openSupport(button.dataset.support); });
$("#supportModalContent").addEventListener("submit", event => { if (event.target.id === "problemForm") { event.preventDefault(); closeModal("supportModal"); showToast("Problem report submitted successfully."); } });
$("#profileButton").addEventListener("click", event => { event.stopPropagation(); $("#profileMenu").classList.toggle("open"); });
$("#profileMenu").addEventListener("click", event => { if (["profile", "settings"].includes(event.target.dataset.action)) switchPage("settings"); if (event.target.dataset.action === "signout") handleLogout(); });
$("#menuBtn").addEventListener("click", () => { $("#sidebar").classList.add("open"); $("#mobileOverlay").classList.add("open"); });
$("#mobileOverlay").addEventListener("click", () => { $("#sidebar").classList.remove("open"); $("#mobileOverlay").classList.remove("open"); });
document.addEventListener("click", () => { $("#profileMenu").classList.remove("open"); $$(".task-action-menu.open").forEach(menu => menu.classList.remove("open")); });
document.addEventListener("keydown", event => { if (event.key === "Escape") $$(".modal-backdrop.open").forEach(modal => closeModal(modal.id)); if (event.key === "Tab" && $("#memberModal").classList.contains("open")) { const focusable = $$('button:not([disabled]), input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), select:not([disabled])', $("#memberModal")).filter(node => node.offsetParent !== null); if (focusable.length) { const first = focusable[0], last = focusable[focusable.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } } } if (event.ctrlKey && event.key.toLowerCase() === "n") { event.preventDefault(); openMemberModal(); } if (event.ctrlKey && event.key.toLowerCase() === "i") { event.preventDefault(); $("#excelInput").click(); } if (event.ctrlKey && event.key.toLowerCase() === "f" && $("#membersPage").classList.contains("active")) { event.preventDefault(); $("#memberSearch").focus(); } });
window.addEventListener("popstate", () => switchPage(location.hash.slice(1) || "dashboard", "none"));

activateSettingsTab(activeSettingsTab); applySettings(); refreshAll(); initializeAuthentication();
