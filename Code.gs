// HUMAND · Guía de Eventos — Apps Script v2.0
// Soporta: leads, checklist, PINes, asignación BDR, métricas admin

const SHEET_LEADS     = 'leads';
const SHEET_CHECKLIST = 'checklist';
const SHEET_USERS     = 'usuarios';
const SHEET_ASSIGN    = 'asignaciones';

// ── Init: crear hojas si no existen ──────────────────────────────
function initSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let leads = ss.getSheetByName(SHEET_LEADS);
  if (!leads) {
    leads = ss.insertSheet(SHEET_LEADS);
    leads.appendRow(['id','evento_key','evento_nombre','nombre','empresa','cargo','email','tel','tamano','interes','next_step','nota','registrado_por','fecha_registro','timestamp']);
    leads.getRange(1,1,1,15).setFontWeight('bold').setBackground('#2B2D8B').setFontColor('#fff');
    leads.setFrozenRows(1);
  }

  let checklist = ss.getSheetByName(SHEET_CHECKLIST);
  if (!checklist) {
    checklist = ss.insertSheet(SHEET_CHECKLIST);
    checklist.appendRow(['evento_key','evento_nombre','item_id','item_label','checked','usuario','timestamp']);
    checklist.getRange(1,1,1,7).setFontWeight('bold').setBackground('#2B2D8B').setFontColor('#fff');
    checklist.setFrozenRows(1);
  }

  let users = ss.getSheetByName(SHEET_USERS);
  if (!users) {
    users = ss.insertSheet(SHEET_USERS);
    users.appendRow(['pin','nombre','rol','activo']);
    users.getRange(1,1,1,4).setFontWeight('bold').setBackground('#2B2D8B').setFontColor('#fff');
    users.setFrozenRows(1);
    // PINes iniciales — CAMBIAR después del primer deploy
    users.appendRow(['ADMIN2026','Admin Eventos','admin',true]);
    users.appendRow(['ALIANZAS26','Admin Alianzas','admin',true]);
  }

  let assign = ss.getSheetByName(SHEET_ASSIGN);
  if (!assign) {
    assign = ss.insertSheet(SHEET_ASSIGN);
    assign.appendRow(['evento_key','evento_nombre','bdr_nombre','bdr_pin','activo','fecha_asignacion']);
    assign.getRange(1,1,1,6).setFontWeight('bold').setBackground('#2B2D8B').setFontColor('#fff');
    assign.setFrozenRows(1);
  }

  return { leads, checklist, users, assign };
}

// ── CORS ──────────────────────────────────────────────────────────
function cors(output) {
  return output.setMimeType(ContentService.MimeType.JSON);
}

// ── GET ───────────────────────────────────────────────────────────
function doGet(e) {
  try {
    initSheets();
    const a = e.parameter.action;
    const ek = e.parameter.evento_key;
    const pin = e.parameter.pin;

    if (a === 'ping')         return cors(ContentService.createTextOutput(JSON.stringify({ok:true})));
    if (a === 'login')        return cors(ContentService.createTextOutput(JSON.stringify(doLogin(pin))));
    if (a === 'getLeads')     return cors(ContentService.createTextOutput(JSON.stringify(getLeads(ek))));
    if (a === 'getChecklist') return cors(ContentService.createTextOutput(JSON.stringify(getChecklist(ek))));
    if (a === 'getAssignments') return cors(ContentService.createTextOutput(JSON.stringify(getAssignments(pin))));
    if (a === 'adminData')    return cors(ContentService.createTextOutput(JSON.stringify(getAdminData())));
    if (a === 'getUsers')     return cors(ContentService.createTextOutput(JSON.stringify(getUsers())));

    return cors(ContentService.createTextOutput(JSON.stringify({error:'Acción no reconocida'})));
  } catch(err) {
    return cors(ContentService.createTextOutput(JSON.stringify({error:err.message})));
  }
}

// ── POST ──────────────────────────────────────────────────────────
function doPost(e) {
  try {
    initSheets();
    const data = JSON.parse(e.postData.contents);
    const a = data.action;

    if (a === 'saveLead')          return cors(ContentService.createTextOutput(JSON.stringify(saveLead(data))));
    if (a === 'deleteLead')        return cors(ContentService.createTextOutput(JSON.stringify(deleteLead(data.id))));
    if (a === 'saveChecklistItem') return cors(ContentService.createTextOutput(JSON.stringify(saveChecklistItem(data))));
    if (a === 'resetChecklist')    return cors(ContentService.createTextOutput(JSON.stringify(resetChecklist(data.evento_key))));
    if (a === 'saveAssignment')    return cors(ContentService.createTextOutput(JSON.stringify(saveAssignment(data))));
    if (a === 'deleteAssignment')  return cors(ContentService.createTextOutput(JSON.stringify(deleteAssignment(data))));
    if (a === 'saveUser')          return cors(ContentService.createTextOutput(JSON.stringify(saveUser(data))));
    if (a === 'deleteUser')        return cors(ContentService.createTextOutput(JSON.stringify(deleteUser(data.pin))));

    return cors(ContentService.createTextOutput(JSON.stringify({error:'Acción no reconocida'})));
  } catch(err) {
    return cors(ContentService.createTextOutput(JSON.stringify({error:err.message})));
  }
}

// ── AUTH ──────────────────────────────────────────────────────────
function doLogin(pin) {
  if (!pin) return {ok:false, error:'PIN requerido'};
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_USERS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  for (let i=1; i<data.length; i++) {
    const row = data[i];
    const rowPin = row[0] ? row[0].toString().trim() : '';
    if (rowPin === pin.toString().trim() && row[3] !== false && row[3] !== 'FALSE') {
      return {ok:true, nombre:row[1], rol:row[2], pin:row[0]};
    }
  }
  return {ok:false, error:'PIN incorrecto o usuario inactivo'};
}

// ── ASIGNACIONES ──────────────────────────────────────────────────
function getAssignments(pin) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_ASSIGN);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const rows = data.slice(1).filter(r => r[0] && r[4] !== false && r[4] !== 'FALSE');
  if (pin) {
    const filtered = rows.filter(r => r[3] && r[3].toString().trim() === pin.toString().trim());
    return {ok:true, assignments: filtered.map(r => rowToObj(headers,r))};
  }
  return {ok:true, assignments: rows.map(r => rowToObj(headers,r))};
}

function saveAssignment(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_ASSIGN);
  const rows = sheet.getDataRange().getValues();
  // Check if already exists
  for (let i=1; i<rows.length; i++) {
    if (rows[i][0] === data.evento_key && rows[i][3] === data.bdr_pin) {
      sheet.getRange(i+1,5).setValue(true);
      return {ok:true, action:'updated'};
    }
  }
  sheet.appendRow([
    data.evento_key||'', data.evento_nombre||'',
    data.bdr_nombre||'', data.bdr_pin||'',
    true, new Date().toISOString()
  ]);
  return {ok:true, action:'created'};
}

function deleteAssignment(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_ASSIGN);
  const rows = sheet.getDataRange().getValues();
  for (let i=rows.length-1; i>=1; i--) {
    if (rows[i][0] === data.evento_key && rows[i][3] === data.bdr_pin) {
      sheet.deleteRow(i+1);
      return {ok:true};
    }
  }
  return {ok:false, error:'Asignación no encontrada'};
}

// ── USUARIOS ──────────────────────────────────────────────────────
function getUsers() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_USERS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const users = data.slice(1).filter(r=>r[0]).map(r => rowToObj(headers,r));
  return {ok:true, users};
}

function saveUser(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_USERS);
  const rows = sheet.getDataRange().getValues();
  for (let i=1; i<rows.length; i++) {
    if (rows[i][0] && rows[i][0].toString().trim() === data.pin.toString().trim()) {
      sheet.getRange(i+1,1,1,4).setValues([[data.pin, data.nombre, data.rol, data.activo !== false]]);
      return {ok:true, action:'updated'};
    }
  }
  sheet.appendRow([data.pin, data.nombre, data.rol||'bdr', data.activo !== false]);
  return {ok:true, action:'created'};
}

function deleteUser(pin) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_USERS);
  const data = sheet.getDataRange().getValues();
  for (let i=data.length-1; i>=1; i--) {
    if (data[i][0] && data[i][0].toString().trim() === pin.toString().trim()) {
      sheet.deleteRow(i+1);
      return {ok:true};
    }
  }
  return {ok:false, error:'Usuario no encontrado'};
}

// ── LEADS ─────────────────────────────────────────────────────────
function getLeads(eventoKey) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_LEADS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const leads = data.slice(1)
    .filter(r => (!eventoKey || r[1] === eventoKey) && r[0])
    .map(r => rowToObj(headers,r));
  return {ok:true, leads};
}

function saveLead(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_LEADS);
  const id = data.id || Date.now().toString();
  const now = new Date();
  sheet.appendRow([id, data.evento_key||'', data.evento_nombre||'', data.nombre||'',
    data.empresa||'', data.cargo||'', data.email||'', data.tel||'',
    data.tamano||'', data.interes||'', data.next_step||'', data.nota||'',
    data.registrado_por||'',
    data.fecha_registro||Utilities.formatDate(now,'America/Bogota','dd/MM/yyyy'),
    now.toISOString()]);
  return {ok:true, id};
}

function deleteLead(id) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_LEADS);
  const data = sheet.getDataRange().getValues();
  for (let i=1; i<data.length; i++) {
    if (data[i][0] && data[i][0].toString() === id.toString()) {
      sheet.deleteRow(i+1);
      return {ok:true};
    }
  }
  return {ok:false, error:'Lead no encontrado'};
}

// ── CHECKLIST ─────────────────────────────────────────────────────
function getChecklist(eventoKey) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_CHECKLIST);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const items = data.slice(1)
    .filter(r => (!eventoKey || r[0] === eventoKey) && r[0])
    .map(r => rowToObj(headers,r));
  return {ok:true, items};
}

function saveChecklistItem(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_CHECKLIST);
  const rows = sheet.getDataRange().getValues();
  const now = new Date();
  for (let i=1; i<rows.length; i++) {
    if (rows[i][0] === data.evento_key && rows[i][2] === data.item_id) {
      sheet.getRange(i+1,5).setValue(data.checked);
      sheet.getRange(i+1,6).setValue(data.usuario||'');
      sheet.getRange(i+1,7).setValue(now.toISOString());
      return {ok:true, action:'updated'};
    }
  }
  sheet.appendRow([data.evento_key||'', data.evento_nombre||'', data.item_id||'',
    data.item_label||'', data.checked, data.usuario||'', now.toISOString()]);
  return {ok:true, action:'created'};
}

function resetChecklist(eventoKey) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_CHECKLIST);
  const data = sheet.getDataRange().getValues();
  const toDelete = [];
  for (let i=1; i<data.length; i++) if (data[i][0]===eventoKey) toDelete.push(i+1);
  for (let i=toDelete.length-1; i>=0; i--) sheet.deleteRow(toDelete[i]);
  return {ok:true, deleted:toDelete.length};
}

// ── ADMIN DATA ────────────────────────────────────────────────────
function getAdminData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const leadsData = ss.getSheetByName(SHEET_LEADS).getDataRange().getValues();
  const checkData = ss.getSheetByName(SHEET_CHECKLIST).getDataRange().getValues();
  const assignData = ss.getSheetByName(SHEET_ASSIGN).getDataRange().getValues();

  // Leads por evento
  const leadsByEvent = {};
  const leadsHeaders = leadsData[0];
  leadsData.slice(1).filter(r=>r[0]).forEach(r => {
    const key = r[1];
    if (!leadsByEvent[key]) leadsByEvent[key] = [];
    leadsByEvent[key].push(rowToObj(l