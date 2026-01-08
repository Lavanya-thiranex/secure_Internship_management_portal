function doGet(e) {
  var action = e.parameter.action;
  
  if (action == 'getAllData') {
    return getAllData();
  }
}

function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var action = data.action;

  if (action == 'saveInterns') {
    return saveInterns(data.interns);
  } else if (action == 'saveDomains') {
    return saveDomains(data.domains);
  } else if (action == 'saveSubmissions') {
    return saveSubmissions(data.submissions);
  } else if (action == 'saveSettings') {
    return saveSettings(data.settings);
  }
}

function getAllData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  var interns = getSheetData(ss, 'Interns');
  var domains = getSheetData(ss, 'Domains');
  var submissions = getSheetData(ss, 'Submissions');
  var settings = getSheetData(ss, 'Settings');

  // Process Domains back into object structure
  var domainObj = {};
  domains.forEach(function(row) {
    try {
      if(row.tasks) {
          domainObj[row.name] = JSON.parse(row.tasks);
      } else if (row.Tasks) { // Handle case variation
          domainObj[row.Name] = JSON.parse(row.Tasks);
      } else {
         // Fallback if column names are strictly 'name' and 'tasks'
         var keys = Object.keys(row);
         // simple heuristic: first col is name, second is tasks
         domainObj[row[keys[0]]] = JSON.parse(row[keys[1]]);
      }
    } catch (e) {
      domainObj[row.name] = [];
    }
  });

  // Process Settings back into object
  var settingsObj = {};
  settings.forEach(function(row) {
    settingsObj[row.key] = row.value;
  });

  return ContentService.createTextOutput(JSON.stringify({
    interns: interns,
    domains: domainObj,
    submissions: submissions,
    settings: settingsObj
  })).setMimeType(ContentService.MimeType.JSON);
}

function saveInterns(newInterns) {
  updateSheet('Interns', newInterns);
  return ContentService.createTextOutput(JSON.stringify({status: 'success'})).setMimeType(ContentService.MimeType.JSON);
}

function saveDomains(domainObj) {
  var rows = [];
  for (var key in domainObj) {
    rows.push({
      name: key,
      tasks: JSON.stringify(domainObj[key])
    });
  }
  updateSheet('Domains', rows);
  return ContentService.createTextOutput(JSON.stringify({status: 'success'})).setMimeType(ContentService.MimeType.JSON);
}

function saveSubmissions(submissions) {
  updateSheet('Submissions', submissions);
  return ContentService.createTextOutput(JSON.stringify({status: 'success'})).setMimeType(ContentService.MimeType.JSON);
}

function saveSettings(settingsObj) {
  var rows = [];
  for (var key in settingsObj) {
    rows.push({
      key: key,
      value: settingsObj[key]
    });
  }
  updateSheet('Settings', rows);
  return ContentService.createTextOutput(JSON.stringify({status: 'success'})).setMimeType(ContentService.MimeType.JSON);
}

// --- Helper Functions ---

function getSheetData(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return []; // Only headers or empty
  
  var headers = data[0];
  var results = [];
  
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      obj[headers[j]] = row[j];
    }
    results.push(obj);
  }
  return results;
}

function updateSheet(sheetName, data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  
  sheet.clearContents(); // Clear old data
  
  if (!data || data.length === 0) return;
  
  // Create a comprehensive list of unique headers from ALL objects in the data array
  var headerMap = {};
  data.forEach(function(obj) {
    Object.keys(obj).forEach(function(key) {
      headerMap[key] = true;
    });
  });
  var headers = Object.keys(headerMap);
  
  // Write Headers
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  // Format Data for rows
  var rows = data.map(function(obj) {
    return headers.map(function(key) {
      return (obj[key] !== undefined && obj[key] !== null) ? obj[key] : "";
    });
  });
  
  // Write Rows
  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
}
