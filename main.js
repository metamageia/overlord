/************************************************
 * ALL JS LOGIC
 ************************************************/

// GLOBALS & DATA STORAGE
const LOCAL_STORAGE_KEY = "trespasser_statblocks";
// Removed: const LOCAL_STORAGE_FAVORITES_KEY = "trespasser_favorites";
const LOCAL_STORAGE_BUNDLES_KEY = "trespasser_uploadedBundles";
let statblocks = [];
let uploadedBundles = [];
let fuseIndex = null;
let currentDetail = null; // currently selected statblock from the library
let selectedStatblockID = null;
let currentSortField = "monsterName";
let currentSortDirection = "asc";
let bundleList = [];

// Global filters for library table
let filterName = "";
let filterLV = "";
let filterRole = "";
let filterTemplate = ""; 
let filterTR = "";
let filterBundle = "";

// Global filters for Create Bundle table
let cbFilterName = "";
let cbFilterLV = "";
let cbFilterRole = "";
let cbFilterTemplate = ""; 
let cbFilterTR = "";
let cbFilterBundle = "";

// MASTER YAML DATA (Single source of truth)
let masterYamlData = {};

// Global favorites map (keyed by statblockID)
let favoritesMap = {}; // Now built from library.json favorites array

// Temporary storage for pending upload (used for overwrite modal)
let pendingUpload = null;

// Add these to the global variables section
const DEFAULT_STATS = {
  hp: "HP",
  init: "INIT",
  acc: "ACC",
  grd: "GRD",
  res: "RES",
  roll: "ROLL",
  spd: "SPD"
};

let hiddenStats = new Set();  // Tracks which default stats are hidden

/* ---------------------------------------------
 * NEW: Set Initial Sidebar Visibility Function
 * ---------------------------------------------
 */
function setInitialSidebarVisibility(){
  const leftSidebar = document.getElementById("sidebar");
  const rightSidebar = document.getElementById("bundlesSidebar");
  // On mobile (max-width 480px), default both sidebars to hidden
  if(window.matchMedia("(max-width:480px)").matches){
    leftSidebar.classList.add("collapsed");
    rightSidebar.classList.add("collapsed");
  } else {
    leftSidebar.classList.remove("collapsed");
    rightSidebar.classList.remove("collapsed");
  }
}

window.addEventListener("DOMContentLoaded", () => {
  loadFromLocalStorage();
  loadUploadedBundles();
  // Removed: loadFavorites(); since favorites now load with library data.
  initSearch();
  renderStatblockLibrary();
  renderCreateBundleList();
  fillBundleSelect();
  fillManageMergeSelect();
  renderUploadedBundles();
  
  // Initialize bundle panels structure
  initBundlePanels();
  
  // NEW: Set the initial sidebar visibility based on device width
  setInitialSidebarVisibility();
  
  // (Optional) Update sidebar visibility on window resize
  window.addEventListener("resize", setInitialSidebarVisibility);
  
  attachEventHandlers();
  renderDefaultDetail();
  
  // Initialize sidebar tab
  switchSidebarTab("library");
  
  // Initialize bundles tabs - default to Bundles top tab and Manage subtab
  switchBundlesTab("bundles");
  switchBundlesTab("manage");
  
  masterYamlData = {};
  updateUIFromMasterYaml();
  updateYamlTextArea();

  // NEW: Check URL for share parameter "s" and load statblock if present
  const urlParams = new URLSearchParams(window.location.search);
  const shareParam = urlParams.get('s');
  if(shareParam) {
    try {
      const decodedYaml = decodeStatblockData(shareParam);
      if(decodedYaml) {
        masterYamlData = jsyaml.load(decodedYaml);
        updateUIFromMasterYaml();
        updateYamlTextArea();
        updateRenderedStatblock();
        alert("Loaded statblock from share link.");
      }
    } catch(e) {
      console.error("Error decoding share parameter:", e);
    }
  }
});

/* ---------------------------------------------
 * STORAGE FUNCTIONS (Library + Favorites)
 * ---------------------------------------------
 */
function loadFromLocalStorage(){
  try { 
    const data = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY));
    if(data && typeof data === "object" && data.statblocks){
      statblocks = data.statblocks;
      const favArray = data.favorites || [];
      favoritesMap = {};
      favArray.forEach(id => favoritesMap[id] = true);
    } else {
      statblocks = [];
      favoritesMap = {};
    }
  } catch(e){ 
    statblocks = [];
    favoritesMap = {};
  }
}

function saveToLocalStorage(){
  // Generate favorites array from favoritesMap
  const favArray = Object.keys(favoritesMap).filter(id => favoritesMap[id]);
  const data = { statblocks, favorites: favArray };
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
}

/* ---------------------------------------------
 * STATBLOCKID GENERATION CODE
 * ---------------------------------------------
 */
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return ("00000000" + (hash >>> 0).toString(16)).slice(-8);
}

function canonicalize(obj) {
  if (Array.isArray(obj)) {
    return obj.map(item => canonicalize(item));
  } else if (obj && typeof obj === "object" && !(obj instanceof Date)) {
    const sortedKeys = Object.keys(obj).sort();
    const newObj = {};
    for (let key of sortedKeys) {
      newObj[key] = canonicalize(obj[key]);
    }
    return newObj;
  }
  return obj;
}

function generateStatblockID(statblockObj) {
  const copy = JSON.parse(JSON.stringify(statblockObj));
  delete copy.statblockID;
  delete copy.bundleId;
  const canonicalObj = canonicalize(copy);
  const str = JSON.stringify(canonicalObj);
  return hashString(str);
}

// NEW: Bundle ID Generation Function
function generateBundleID(bundleArray) {
  const clones = bundleArray.map(sb => {
    let copy = JSON.parse(JSON.stringify(sb));
    delete copy.statblockID;
    delete copy.bundleId;
    return copy;
  });
  clones.sort((a,b) => {
    const A = (a.monsterName || "").toLowerCase();
    const B = (b.monsterName || "").toLowerCase();
    return A.localeCompare(B);
  });
  const canonical = canonicalize(clones);
  const str = JSON.stringify(canonical);
  return hashString(str);
}

/* ---------------------------------------------
 * NEW: Reversible Encoding/Decoding Functions using LZ-string
 * ---------------------------------------------
 */
function encodeStatblockData(yamlString) {
  const compressed = LZString.compressToEncodedURIComponent(yamlString);
  return compressed;
}
function decodeStatblockData(encodedString) {
  const decompressed = LZString.decompressFromEncodedURIComponent(encodedString);
  return decompressed;
}

/* SIDEBAR & TAB SWITCHING */

// --- Revised Toggle Functions ---
function toggleSidebar(){
  const leftSidebar = document.getElementById("sidebar");
  const rightSidebar = document.getElementById("bundlesSidebar");
  if(window.matchMedia("(max-width:480px)").matches){
    if(!rightSidebar.classList.contains("collapsed")){
      rightSidebar.classList.add("collapsed");
    }
  }
  leftSidebar.classList.toggle("collapsed");
}
function toggleBundlesSidebar(){
  const leftSidebar = document.getElementById("sidebar");
  const rightSidebar = document.getElementById("bundlesSidebar");
  if(window.matchMedia("(max-width:480px)").matches){
    if(!leftSidebar.classList.contains("collapsed")){
      leftSidebar.classList.add("collapsed");
    }
  }
  rightSidebar.classList.toggle("collapsed");
}

function switchSidebarTab(tab){
  ["library", "editor", "yaml"].forEach(t => {
    document.getElementById(t + "Toggle").classList.remove("active");
    document.getElementById(t + "Panel").classList.remove("active");
  });
  document.getElementById(tab + "Toggle").classList.add("active");
  document.getElementById(tab + "Panel").classList.add("active");
  if(tab === "yaml") updateYamlTextArea();
}

// Update the switchBundlesTab function to handle both top-level and sub-level tabs
function switchBundlesTab(tab) {
  // Handle top-level tabs (Bundles, Backup)
  if (tab === "bundles" || tab === "backup") {
    // Hide all top-level panels
    document.querySelectorAll(".bundles-panel").forEach(p => p.classList.remove("active"));
    
    // Remove active class from all top-level tabs
    document.querySelectorAll(".bundles-tabs.top-tabs .bundles-tab").forEach(btn => 
      btn.classList.remove("active"));
    
    // Activate the selected top-level tab
    document.getElementById("bundles" + tab.charAt(0).toUpperCase() + tab.slice(1) + "Tab").classList.add("active");
    
    if (tab === "bundles") {
      // Show the subtabs when Bundles is selected
      document.getElementById("bundlesSubTabs").style.display = "flex";
      
      // If no subtab is active, default to Manage
      if (!document.querySelector("#bundlesSubTabs .bundles-tab.active")) {
        switchBundlesTab("manage");
      } else {
        // Get the currently active subtab and reactivate it
        const activeSubtab = document.querySelector("#bundlesSubTabs .bundles-tab.active").id;
        const subtabName = activeSubtab.replace("bundles", "").replace("Tab", "").toLowerCase();
        document.getElementById("bundles" + subtabName.charAt(0).toUpperCase() + subtabName.slice(1) + "Panel").classList.add("active");
      }
      
      // Show the bundles container panel
      document.getElementById("bundlesBundlesPanel").classList.add("active");
    } else {
      // Hide the subtabs for other top-level tabs
      document.getElementById("bundlesSubTabs").style.display = "none";
      
      // Activate the backup panel
      document.getElementById("bundlesBackupPanel").classList.add("active");
    }
  } else {
    // Handle subtabs (manage, upload, create, merge)
    // Remove active class from all subtabs
    document.querySelectorAll("#bundlesSubTabs .bundles-tab").forEach(btn => 
      btn.classList.remove("active"));
    
    // Activate the selected subtab
    document.getElementById("bundles" + tab.charAt(0).toUpperCase() + tab.slice(1) + "Tab").classList.add("active");
    
    // Hide all subtab panels
    document.querySelectorAll("#bundlesBundlesPanel > .bundles-panel").forEach(p => {
      p.classList.remove("active");
      // Move the panel into the bundles container
      document.getElementById("bundlesBundlesPanel").appendChild(p);
    });
    
    // Activate the selected subtab panel
    document.getElementById("bundles" + tab.charAt(0).toUpperCase() + tab.slice(1) + "Panel").classList.add("active");
  }
}

/* LOCAL STORAGE FOR BUNDLES */
function loadUploadedBundles(){
  try { uploadedBundles = JSON.parse(localStorage.getItem(LOCAL_STORAGE_BUNDLES_KEY)) || []; }
  catch(e){ uploadedBundles = []; }
}
function saveUploadedBundles(){
  localStorage.setItem(LOCAL_STORAGE_BUNDLES_KEY, JSON.stringify(uploadedBundles));
}

/* MISSING FUNCTIONS IMPLEMENTATION */
function fillBundleSelect(){
  console.log("fillBundleSelect called");
}
function fillManageMergeSelect(){
  const mergeSelect = document.getElementById("manageMergeSelect");
  mergeSelect.innerHTML = "";
  uploadedBundles.forEach(bundle => {
    const displayName = bundle.bundleName ? bundle.bundleName : bundle.id;
    const option = document.createElement("option");
    option.value = bundle.id;
    option.textContent = `${displayName} (ID: ${bundle.id}, ${bundle.total} statblock${bundle.total > 1 ? "s" : ""})`;
    mergeSelect.appendChild(option);
  });
}

// Helper function: get bundle name for a given bundleId
function getBundleName(bundleId) {
  const bun = uploadedBundles.find(x => x.id === bundleId);
  return bun ? bun.bundleName : "";
}

// Modified renderUploadedBundles with refresh button update.
function renderUploadedBundles(){
  const container = document.getElementById("uploadedBundleList");
  container.innerHTML = "";
  if(uploadedBundles.length === 0){
    container.innerHTML = "<p>No bundles uploaded.</p>";
    return;
  }
  const table = document.createElement("table");
  table.id = "manageBundlesTable";
  const colgroup = document.createElement("colgroup");
  const cols = [
    { field: "bundleName", width: 150 },
    { field: "id",         width: 80 },
    { field: "total",      width: 60 },
    { field: "active",     width: 60 },
    { field: "action",     width: 100 }
  ];
  cols.forEach(col => {
    const colEl = document.createElement("col");
    colEl.style.width = col.width + "px";
    colgroup.appendChild(colEl);
  });
  table.appendChild(colgroup);
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  ["Bundle Name", "ID", "Total", "Active", "Action"].forEach(text => {
    const th = document.createElement("th");
    th.textContent = text;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);
  const tbody = document.createElement("tbody");
  uploadedBundles.forEach((bundle, idx) => {
    const tr = document.createElement("tr");
    const bundleName = bundle.bundleName ? bundle.bundleName : bundle.id;
    const tdName = document.createElement("td");
    tdName.textContent = bundleName;
    const tdId = document.createElement("td");
    tdId.textContent = bundle.id;
    const tdTotal = document.createElement("td");
    // Recalculate active count from statblocks with matching bundle id.
    const activeCount = statblocks.filter(sb => sb.bundleId === bundle.id).length;
    // Also update the bundle's total property (in case it needs refreshing)
    bundle.total = bundle.data.length;
    tdTotal.textContent = `${activeCount}/${bundle.total}`;
    const tdActive = document.createElement("td");
    const activeCheckbox = document.createElement("input");
    activeCheckbox.type = "checkbox";
    activeCheckbox.checked = bundle.active;
    activeCheckbox.addEventListener("change", () => {
      bundle.active = activeCheckbox.checked;
      saveUploadedBundles();
      renderUploadedBundles();
      renderStatblockLibrary();
    });
    tdActive.appendChild(activeCheckbox);
    const tdAction = document.createElement("td");
    const refreshBtn = document.createElement("button");
    refreshBtn.textContent = "Refresh";
    refreshBtn.className = "refresh-bundle-btn";
    refreshBtn.dataset.id = bundle.id;
    refreshBtn.addEventListener("click", () => {
      // Use dataset id directly as bundle id is a hex string.
      const bundleId = refreshBtn.dataset.id;
      const bun = uploadedBundles.find(b => b.id === bundleId);
      if(bun){
        let added = 0;
        bun.data.forEach(sb => {
          sb.statblockID = generateStatblockID(sb);
          if(!statblocks.find(x => x.statblockID === sb.statblockID)){
            sb.bundleId = bundleId;
            statblocks.push(sb);
            added++;
          }
        });
        // Update bundle total explicitly.
        bun.total = bun.data.length;
        saveToLocalStorage();
        saveUploadedBundles();
        renderStatblockLibrary();
        fillBundleSelect();
        fillManageMergeSelect();
        renderUploadedBundles(); // Always re-render the bundles table to update total.
        alert(`Refreshed bundle: added ${added} missing statblock(s).`);
      }
    });
    const delBtn = document.createElement("button");
    delBtn.textContent = "Delete";
    delBtn.addEventListener("click", () => {
      if(confirm(`Delete bundle ${bundle.id}?`)){
        const bundleId = bundle.id;
        
        // Remove the bundle from uploadedBundles
        uploadedBundles.splice(idx, 1);
        saveUploadedBundles();
        
        // Remove statblocks with matching bundleId from the library
        statblocks = statblocks.filter(sb => sb.bundleId !== bundleId);
        saveToLocalStorage();
        
        // Clear current selection if it was from the deleted bundle
        if(currentDetail && currentDetail.bundleId === bundleId) {
          currentDetail = null;
          selectedStatblockID = null;
          renderDefaultDetail();
        }
        
        // Update search index
        initSearch();
        
        // Refresh all UI components
        renderStatblockLibrary();
        renderCreateBundleList();
        fillBundleSelect();
        fillManageMergeSelect();
        renderUploadedBundles();
      }
    });
    tdAction.appendChild(refreshBtn);
    tdAction.appendChild(document.createTextNode(" | "));
    tdAction.appendChild(delBtn);
    tr.append(tdName, tdId, tdTotal, tdActive, tdAction);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  container.appendChild(table);
}

/* ---------------------------------------------
 * MASTER YAML SYNCHRONIZATION FUNCTIONS
 * ---------------------------------------------
 */
function updateYamlTextArea(){
  try {
    const clone = Object.assign({}, masterYamlData);
    delete clone.statblockID;
    delete clone.bundleId;
    document.getElementById("yamlArea").value = jsyaml.dump(clone, { lineWidth: -1 });
  } catch(e){
    console.error(e);
  }
}

// Modify updateUIFromMasterYaml to handle custom stats
function updateUIFromMasterYaml(){
  // Reset hiddenStats based on masterYamlData
  hiddenStats.clear();
  
  // Update basic info fields
  document.getElementById("monsterName").value = masterYamlData.monsterName || "";
  document.getElementById("role").value = masterYamlData.role || "";
  document.getElementById("template").value = masterYamlData.template || "";
  document.getElementById("level").value = masterYamlData.level || "";
  document.getElementById("tr").value = masterYamlData.tr || "";

  // Update basic stats visibility based on masterYamlData
  Object.keys(DEFAULT_STATS).forEach(key => {
    const el = document.getElementById(key);
    if (el) {
      el.value = masterYamlData[key] || "";
      // If the stat isn't in masterYamlData, add it to hiddenStats
      if (!masterYamlData[key]) {
        hiddenStats.add(key);
      }
      el.parentElement.classList.toggle("hidden-stat", hiddenStats.has(key));
    }
  });

  // Clear and update custom stats
  const customStatsContainer = document.getElementById("customStatsContainer");
  customStatsContainer.innerHTML = "";
  if (Array.isArray(masterYamlData.customStats)) {
    masterYamlData.customStats.forEach(stat => addCustomStat(stat));
  }

  const featuresContainer = document.getElementById("featuresContainer");
  featuresContainer.innerHTML = "";
  if(masterYamlData.features){
    if(Array.isArray(masterYamlData.features)){
      masterYamlData.features.forEach(f => addFeature(f));
    } else if(typeof masterYamlData.features === "object"){
      Object.keys(masterYamlData.features).forEach(key => {
        addFeature({title: key, content: masterYamlData.features[key]});
      });
    }
  }
  ["lightDeeds","heavyDeeds","mightyDeeds","tyrantDeeds","specialDeeds"].forEach(t => {
    const container = document.getElementById(t + "Container") || document.getElementById(t + "sContainer");
    container.innerHTML = "";
    let deeds = masterYamlData[t];
    if(typeof deeds === "string") deeds = parseDeedsStringNew(deeds);
    if(Array.isArray(deeds)){
      deeds.forEach(d => addDeed(t.replace("Deeds", ""), d));
    }
  });
}

// Modify updateMasterYamlDataFromUI to include custom stats
function updateMasterYamlDataFromUI() {
  // Update basic info
  masterYamlData.monsterName = document.getElementById("monsterName").value.trim();
  masterYamlData.role = document.getElementById("role").value;
  masterYamlData.template = document.getElementById("template").value;
  masterYamlData.level = document.getElementById("level").value;
  masterYamlData.tr = document.getElementById("tr").value;

  // Update basic stats, excluding hidden ones
  Object.keys(DEFAULT_STATS).forEach(key => {
    if (!hiddenStats.has(key)) {
      const value = document.getElementById(key).value.trim();
      if (value) {
        masterYamlData[key] = value;
      } else {
        delete masterYamlData[key];
      }
    } else {
      delete masterYamlData[key];
    }
  });

  // Update custom stats
  const customStats = [];
  document.querySelectorAll("#customStatsContainer .custom-stat").forEach(div => {
    const [nameInput, valueInput] = div.querySelectorAll("input");
    const name = nameInput.value.trim();
    const value = valueInput.value.trim();
    if (name && value) {
      customStats.push({ name, value });
    }
  });
  
  if (customStats.length > 0) {
    masterYamlData.customStats = customStats;
  } else {
    delete masterYamlData.customStats;
  }

  let featuresArray = collectFeatures();
  let featuresObj = {};
  featuresArray.forEach(f => { if(f.title) featuresObj[f.title] = f.content; });
  masterYamlData.features = featuresObj;
  masterYamlData.lightDeeds = collectDeedsAsString("light");
  masterYamlData.heavyDeeds = collectDeedsAsString("heavy");
  masterYamlData.mightyDeeds = collectDeedsAsString("mighty");
  masterYamlData.tyrantDeeds = collectDeedsAsString("tyrant");
  masterYamlData.specialDeeds = collectDeedsAsString("special"); // NEW: Special Deeds
  updateYamlTextArea();
  updateRenderedStatblock();
}

function updateMasterYamlDataFromYaml(){
  try {
    const parsed = jsyaml.load(document.getElementById("yamlArea").value.replace(/\u00A0/g, " "));
    if(parsed){
      masterYamlData = parsed;
      updateUIFromMasterYaml();
      updateRenderedStatblock();
    }
  } catch(e){
    console.error("YAML parse error:", e);
  }
}

/* RENDER LIBRARY TABLE */
function renderStatblockLibrary(){
  const container = document.getElementById("statblockList");
  let focusedId = "";
  let selStart = 0, selEnd = 0;
  const activeEl = document.activeElement;
  if(activeEl && activeEl.tagName === "INPUT" && activeEl.id.startsWith("search")){
    focusedId = activeEl.id;
    selStart = activeEl.selectionStart;
    selEnd = activeEl.selectionEnd;
  }
  container.innerHTML = "";
  const table = document.createElement("table");
  table.id = "libraryTable";
  const colgroup = document.createElement("colgroup");
  // Favorites column (30px)
  const favCol = document.createElement("col");
  favCol.style.width = "30px";
  favCol.id = "col-favorite";
  colgroup.appendChild(favCol);
  const cols = [
    { field: "monsterName", width: 150 },
    { field: "level",       width: 50 },
    { field: "role",        width: 100 },
    { field: "template",    width: 100 }, // Add this line
    { field: "tr",          width: 50 },
    { field: "bundle",      width: 120 },
    { field: "action",      width: 50 }
  ];
  cols.forEach(col => {
    const colEl = document.createElement("col");
    colEl.style.width = col.width + "px";
    colEl.id = "col-" + col.field;
    colgroup.appendChild(colEl);
  });
  table.appendChild(colgroup);
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  // Favorites header cell with star emoji and sorting logic
  const favTh = document.createElement("th");
  favTh.textContent = "⭐";
  favTh.addEventListener("click", () => {
    if(currentSortField === "favorite"){
      currentSortDirection = currentSortDirection === "asc" ? "desc" : "asc";
    } else {
      currentSortField = "favorite";
      currentSortDirection = "asc";
    }
    renderStatblockLibrary();
  });
  headerRow.appendChild(favTh);
  const columns = [
    { field: "monsterName", label: "Name" },
    { field: "level",       label: "LV" },
    { field: "role",        label: "Role" },
    { field: "template",    label: "Template" }, // Add this line
    { field: "tr",          label: "TR" },
    { field: "bundle",      label: "Bundle" }
  ];
  columns.forEach((col, idx) => {
    const th = document.createElement("th");
    th.textContent = col.label;
    th.dataset.field = col.field;
    th.addEventListener("click", () => {
      if(currentSortField === col.field){
        currentSortDirection = (currentSortDirection === "asc") ? "desc" : "asc";
      } else {
        currentSortField = col.field;
        currentSortDirection = "asc";
      }
      renderStatblockLibrary();
    });
    if(idx < columns.length){
      const resizer = document.createElement("div");
      resizer.className = "th-resizer";
      th.appendChild(resizer);
      initThResizer(resizer, th, "col-" + col.field);
    }
    headerRow.appendChild(th);
  });
  const actionTh = document.createElement("th");
  actionTh.textContent = "Action";
  headerRow.appendChild(actionTh);
  thead.appendChild(headerRow);

  const filterRow = document.createElement("tr");
  // Empty favorites filter cell
  const favFilterTd = document.createElement("td");
  filterRow.appendChild(favFilterTd);
  columns.forEach(col => {
    const td = document.createElement("td");
    const input = document.createElement("input");
    input.type = "text";
    input.id = "search" + col.field.charAt(0).toUpperCase() + col.field.slice(1);
    
    switch(col.field) {
      case "monsterName": input.value = filterName; break;
      case "level": input.value = filterLV; break;
      case "role": input.value = filterRole; break;
      case "template": input.value = filterTemplate; break;
      case "tr": input.value = filterTR; break;
      case "bundle": input.value = filterBundle; break;
    }
    
    input.style.width = "100%";
    input.addEventListener("input", function(){
      switch(col.field) {
        case "monsterName": filterName = this.value; break;
        case "level": filterLV = this.value; break;
        case "role": filterRole = this.value; break;
        case "template": filterTemplate = this.value; break;
        case "tr": filterTR = this.value; break;
        case "bundle": filterBundle = this.value; break;
      }
      renderStatblockLibrary();
    });
    td.appendChild(input);
    filterRow.appendChild(td);
  });
  const filterActionTd = document.createElement("td");
  const clearBtn = document.createElement("button");
  clearBtn.textContent = "Clear";
  clearBtn.className = "clear-filters-btn";
  clearBtn.addEventListener("click", () => {
    // Reset filter variables
    filterName = "";
    filterLV = "";
    filterRole = "";
    filterTemplate = "";
    filterTR = "";
    filterBundle = "";
    // Clear input values
    columns.forEach(col => {
      const input = document.getElementById("search" + col.field.charAt(0).toUpperCase() + col.field.slice(1));
      if(input) input.value = "";
    });
    renderStatblockLibrary();
  });
  filterActionTd.appendChild(clearBtn);
  filterRow.appendChild(filterActionTd);
  thead.appendChild(filterRow);
  table.appendChild(thead);
  let filtered = statblocks.filter(sb => {
    const matchesName = matchesStringQuery(sb.monsterName || "", filterName);
    const matchesRole = matchesStringQuery(sb.role || "", filterRole);
    const matchesTemplate = matchesStringQuery(sb.template || "", filterTemplate); // Add this line
    const matchesLV = matchesNumericQuery(sb.level, filterLV);
    const matchesTR = matchesNumericQuery(sb.tr, filterTR);
    const bundleName = getBundleName(sb.bundleId);
    const matchesBundle = matchesStringQuery(bundleName, filterBundle);
    return matchesName && matchesRole && matchesTemplate && matchesLV && matchesTR && matchesBundle; // Add matchesTemplate
  });
  filtered = filtered.filter(sb => {
    if(sb.bundleId === undefined) return true;
    let bun = uploadedBundles.find(x => x.id === sb.bundleId);
    return bun && bun.active;
  });
  filtered.sort((a,b) => {
    if(currentSortField === "favorite") {
      const aFav = favoritesMap[a.statblockID] || false;
      const bFav = favoritesMap[b.statblockID] || false;
      // If favorite status is the same, maintain relative order
      if (aFav === bFav) {
        // Secondary sort by name when favorite status is equal
        const aName = (a.monsterName || "").toLowerCase();
        const bName = (b.monsterName || "").toLowerCase();
        return aName.localeCompare(bName);
      }
      // Sort favorites based on direction
      return currentSortDirection === "asc" 
        ? (bFav ? 1 : -1) 
        : (bFav ? -1 : 1);
    } else if(currentSortField === "tr") {
      const numA = parseInt(String(a?.tr || 0));
      const numB = parseInt(String(b?.tr || 0));
      return currentSortDirection === "asc" ? numA - numB : numB - numA;
    } else if(currentSortField === "level") {
      // Add this new block to handle level numerically
      const numA = parseInt(String(a?.level || 0));
      const numB = parseInt(String(b?.level || 0));
      return currentSortDirection === "asc" ? numA - numB : numB - numA;
    } else if(currentSortField === "bundle") {
      const bundleNameA = getBundleName(a.bundleId) || "";
      const bundleNameB = getBundleName(b.bundleId) || "";
      return currentSortDirection === "asc" 
        ? bundleNameA.localeCompare(bundleNameB)
        : bundleNameB.localeCompare(bundleNameA);
    } else {
      const A = String(a?.[currentSortField] || "");
      const B = String(b?.[currentSortField] || "");
      return currentSortDirection === "asc" ? A.localeCompare(B) : B.localeCompare(A);
    }
  });
  currentFilteredList = filtered;
  
  const totalEl = document.getElementById("libraryTotal");
  if(totalEl){
    totalEl.textContent = " Total: " + statblocks.length;
  }
  
  
  const tbody = document.createElement("tbody");
  if(!filtered.length){
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = columns.length + 2;
    td.innerHTML = "<p>No matching statblocks found.</p>";
    tr.appendChild(td);
    tbody.appendChild(tr);
  } else {
    filtered.forEach((sb, index) => {
      const tr = document.createElement("tr");
      if(sb.statblockID === selectedStatblockID) {
        tr.classList.add("selected");
      }
      tr.setAttribute("data-index", index);
      // Favorites cell: use a clickable span
      const favTd = document.createElement("td");
      const starSpan = document.createElement("span");
      starSpan.textContent = favoritesMap[sb.statblockID] ? "⭐" : "☆";
      starSpan.style.cursor = "pointer";
      starSpan.addEventListener("click", (e) => {
        e.stopPropagation();
        favoritesMap[sb.statblockID] = !favoritesMap[sb.statblockID];
        saveToLocalStorage(); // Save changes to favorites in library.json
        renderStatblockLibrary();
        renderCreateBundleList();
      });
      favTd.appendChild(starSpan);
      tr.appendChild(favTd);
      columns.forEach(ci => {
        const td = document.createElement("td");
        td.textContent = ci.field === "bundle" ? getBundleName(sb.bundleId) : (sb[ci.field] || "");
        tr.appendChild(td);
      });
      const tdAction = document.createElement("td");
      const delBtn = document.createElement("button");
      delBtn.textContent = "Delete";
      delBtn.className = "delete-stat-btn";
      delBtn.addEventListener("click", e => {
        e.stopPropagation();
        if(!confirm(`Delete statblock "${sb.monsterName}"?`)) return;
        statblocks = statblocks.filter(x => x !== sb);
        saveToLocalStorage();
        renderStatblockLibrary();
        fillBundleSelect();
        fillBundleSelect();
        fillManageMergeSelect();
        renderUploadedBundles();
        if(currentDetail === sb){
          currentDetail = null;
          renderDefaultDetail();
        }
      });
      tdAction.appendChild(delBtn);
      tr.appendChild(tdAction);
      tr.addEventListener("click", () => {
        currentDetail = sb;
        selectedStatblockID = sb.statblockID;
        masterYamlData = structuredClone(sb);
        updateUIFromMasterYaml();
        updateYamlTextArea();
        updateRenderedStatblock();
        renderStatblockLibrary();
      });
      tbody.appendChild(tr);
    });
  }
  table.appendChild(tbody);
  container.appendChild(table);
  if(focusedId){
    const newFocused = document.getElementById(focusedId);
    if(newFocused){
      newFocused.focus();
      newFocused.setSelectionRange(selStart, selEnd);
    }
  }
}

// NEW: Updated matchesStringQuery function remains unchanged.
function matchesStringQuery(text, query) {
  if (!query.trim()) return true;
  const segments = query.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
  const positive = [];
  const negative = [];
  segments.forEach(seg => {
    if (seg.startsWith("-")) {
      negative.push(seg.slice(1));
    } else {
      positive.push(seg);
    }
  });
  const positiveMatch = positive.length > 0 ? positive.some(seg => text.toLowerCase().includes(seg)) : true;
  const negativeMatch = negative.every(seg => !text.toLowerCase().includes(seg));
  return positiveMatch && negativeMatch;
}

function initThResizer(resizer, th, colId){
  let startX, startWidth;
  resizer.addEventListener("mousedown", function(e){
    startX = e.clientX;
    const col = document.getElementById(colId);
    startWidth = col.offsetWidth;
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    e.preventDefault();
  });
  function onMouseMove(e){
    let newWidth = startWidth + (e.clientX - startX);
    newWidth = Math.max(50, Math.min(newWidth, 600));
    document.getElementById(colId).style.width = newWidth + "px";
  }
  function onMouseUp(){
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  }
}

/* -------------------------------
 RENDER CREATE BUNDLE TABLE
------------------------------- */
function renderCreateBundleList(){
  const container = document.getElementById("createBundleList");
  let focusedId = "";
  let selStart = 0, selEnd = 0;
  const activeEl = document.activeElement;
  if(activeEl && activeEl.tagName === "INPUT" && activeEl.id.startsWith("cbSearch")){
    focusedId = activeEl.id;
    selStart = activeEl.selectionStart;
    selEnd = activeEl.selectionEnd;
  }
  container.innerHTML = "";
  const table = document.createElement("table");
  table.id = "createBundleTable";
  const colgroup = document.createElement("colgroup");
  // Favorites column (non-clickable in create bundle list)
  const favCol = document.createElement("col");
  favCol.style.width = "30px";
  favCol.id = "cb-col-favorite";
  colgroup.appendChild(favCol);
  const cols = [
    { field: "monsterName", width: 150 },
    { field: "level",       width: 50 },
    { field: "role",        width: 100 },
    { field: "template",    width: 100 }, // Add this line
    { field: "tr",          width: 50 },
    { field: "bundle",      width: 100 }
  ];
  cols.forEach(col => {
    const colEl = document.createElement("col");
    colEl.style.width = col.width + "px";
    colEl.id = "cb-col-" + col.field;
    colgroup.appendChild(colEl);
  });
  table.appendChild(colgroup);
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  // Favorites header cell remains with star emoji (for sorting)
  const favTh = document.createElement("th");
  favTh.textContent = "⭐";
  favTh.addEventListener("click", () => {
    if(currentSortField === "favorite"){
      currentSortDirection = currentSortDirection === "asc" ? "desc" : "asc";
    } else {
      currentSortField = "favorite";
      currentSortDirection = "asc";
    }
    renderCreateBundleList();
  });
  headerRow.appendChild(favTh);
  const columns = [
    { field: "monsterName", label: "Name" },
    { field: "level",       label: "LV" },
    { field: "role",        label: "Role" },
    { field: "template",    label: "Template" }, // Add this line
    { field: "tr",          label: "TR" },
    { field: "bundle",      label: "Bundle" }
  ];
  columns.forEach((col, idx) => {
    const th = document.createElement("th");
    th.textContent = col.label;
    th.dataset.field = col.field;
    th.addEventListener("click", () => {
      if(currentSortField === col.field){
        currentSortDirection = (currentSortDirection === "asc") ? "desc" : "asc";
      } else {
        currentSortField = col.field;
        currentSortDirection = "asc";
      }
      renderCreateBundleList();
    });
    headerRow.appendChild(th);
  });
  const actionTh = document.createElement("th");
  actionTh.textContent = "Action";
  headerRow.appendChild(actionTh);
  thead.appendChild(headerRow);
  const filterRow = document.createElement("tr");
  // Empty favorites filter cell
  const favFilterTd = document.createElement("td");
  filterRow.appendChild(favFilterTd);
  columns.forEach(col => {
    const td = document.createElement("td");
    const input = document.createElement("input");
    input.type = "text";
    input.id = "cbSearch" + col.field.charAt(0).toUpperCase() + col.field.slice(1);
    
    switch(col.field) {
      case "monsterName": input.value = cbFilterName; break;
      case "level": input.value = cbFilterLV; break;
      case "role": input.value = cbFilterRole; break;
      case "template": input.value = cbFilterTemplate; break;
      case "tr": input.value = cbFilterTR; break;
      case "bundle": input.value = cbFilterBundle; break;
    }
    
    input.style.width = "100%";
    input.addEventListener("input", function(){
      switch(col.field) {
        case "monsterName": cbFilterName = this.value; break;
        case "level": cbFilterLV = this.value; break;
        case "role": cbFilterRole = this.value; break;
        case "template": cbFilterTemplate = this.value; break;
        case "tr": cbFilterTR = this.value; break;
        case "bundle": cbFilterBundle = this.value; break;
      }
      renderCreateBundleList();
    });
    td.appendChild(input);
    filterRow.appendChild(td);
  });
  const filterActionTd = document.createElement("td");
  const clearBtn = document.createElement("button");
  clearBtn.textContent = "Clear";
  clearBtn.className = "clear-filters-btn";
  clearBtn.addEventListener("click", () => {
    // Reset filter variables
    cbFilterName = "";
    cbFilterLV = "";
    cbFilterRole = "";
    cbFilterTemplate = "";
    cbFilterTR = "";
    cbFilterBundle = "";
    // Clear input values
    columns.forEach(col => {
      const input = document.getElementById("cbSearch" + col.field.charAt(0).toUpperCase() + col.field.slice(1));
      if(input) input.value = "";
    });
    renderCreateBundleList();
  });
  filterActionTd.appendChild(clearBtn);
  filterRow.appendChild(filterActionTd);
  thead.appendChild(filterRow);
  table.appendChild(thead);
  let filtered = statblocks.filter(sb => {
    const matchesName = matchesStringQuery(sb.monsterName || "", cbFilterName);
    const matchesRole = matchesStringQuery(sb.role || "", cbFilterRole);
    const matchesTemplate = matchesStringQuery(sb.template || "", cbFilterTemplate); // Add this line
    const matchesLV = matchesNumericQuery(sb.level, cbFilterLV);
    const matchesTR = matchesNumericQuery(sb.tr, cbFilterTR);
    const matchesBundle = matchesStringQuery(getBundleName(sb.bundleId), cbFilterBundle);
    return matchesName && matchesRole && matchesTemplate && matchesLV && matchesTR && matchesBundle; // Add matchesTemplate
  });
  filtered = filtered.filter(sb => {
    if(sb.bundleId === undefined) return true;
    let bun = uploadedBundles.find(x => x.id === sb.bundleId);
    return bun && bun.active;
  });
  filtered.sort((a,b) => {
    if(currentSortField === "favorite") {
      const aFav = favoritesMap[a.statblockID] || false;
      const bFav = favoritesMap[b.statblockID] || false;
      // If favorite status is the same, maintain relative order
      if (aFav === bFav) {
        // Secondary sort by name when favorite status is equal
        const aName = (a.monsterName || "").toLowerCase();
        const bName = (b.monsterName || "").toLowerCase();
        return aName.localeCompare(bName);
      }
      // Sort favorites based on direction
      return currentSortDirection === "asc" 
        ? (bFav ? 1 : -1) 
        : (bFav ? -1 : 1);
    } else if(currentSortField === "tr") {
      const numA = parseInt(String(a?.tr || 0));
      const numB = parseInt(String(b?.tr || 0));
      return currentSortDirection === "asc" ? numA - numB : numB - numA;
    } else if(currentSortField === "level") {
      // Add this new block to handle level numerically
      const numA = parseInt(String(a?.level || 0));
      const numB = parseInt(String(b?.level || 0));
      return currentSortDirection === "asc" ? numA - numB : numB - numA;
    } else if(currentSortField === "bundle") {
      const bundleNameA = getBundleName(a.bundleId) || "";
      const bundleNameB = getBundleName(b.bundleId) || "";
      return currentSortDirection === "asc" 
        ? bundleNameA.localeCompare(bundleNameB)
        : bundleNameB.localeCompare(bundleNameA);
    } else {
      const A = String(a?.[currentSortField] || "");
      const B = String(b?.[currentSortField] || "");
      return currentSortDirection === "asc" ? A.localeCompare(B) : B.localeCompare(A);
    }
  });
  
  const tbody = document.createElement("tbody");
  if(!filtered.length){
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = columns.length + 2;
    td.innerHTML = "<p>No matching statblocks found.</p>";
    tr.appendChild(td);
    tbody.appendChild(tr);
  } else {
    filtered.forEach(sb => {
      const tr = document.createElement("tr");
      // Favorites cell: display star (non-clickable here)
      const favTd = document.createElement("td");
      const starSpan = document.createElement("span");
      starSpan.textContent = favoritesMap[sb.statblockID] ? "⭐" : "☆";
      favTd.appendChild(starSpan);
      tr.appendChild(favTd);
      columns.forEach(ci => {
        const td = document.createElement("td");
        td.textContent = ci.field === "bundle" ? getBundleName(sb.bundleId) : (sb[ci.field] || "");
        tr.appendChild(td);
      });
      const tdAction = document.createElement("td");
      const btn = document.createElement("button");
      btn.textContent = "Add";
      btn.className = "inline-btn";
      btn.onclick = () => {
        if(!bundleList.includes(sb)) bundleList.push(sb);
        renderBundleList();
      };
      tdAction.appendChild(btn);
      tr.appendChild(tdAction);
      tr.addEventListener("click", () => {
        if(!bundleList.includes(sb)) bundleList.push(sb);
        renderBundleList();
      });
      tbody.appendChild(tr);
    });
  }
  table.appendChild(tbody);
  container.appendChild(table);
  if(focusedId){
    const newFocused = document.getElementById(focusedId);
    if(newFocused){
      newFocused.focus();
      newFocused.setSelectionRange(selStart, selEnd);
    }
  }
}

// NEW: Render Bundle Contents List function for the Create Bundle Tab
function renderBundleList(){
  const container = document.getElementById("bundleListContainer");
  container.innerHTML = "";
  if(bundleList.length === 0){
    container.innerHTML = "<p>No statblocks in the bundle.</p>";
    return;
  }
  // Create a table similar to the library table
  const table = document.createElement("table");
  table.id = "bundleListTable";
  
  // Create colgroup matching the library columns
  const colgroup = document.createElement("colgroup");
  const columns = [
    { field: "favorite", width: 30 },
    { field: "monsterName", width: 150 },
    { field: "level", width: 50 },
    { field: "role", width: 100 },
    { field: "template",    label: "Template" }, // Add this line
    { field: "tr", width: 50 },
    { field: "bundle", width: 120 },
    { field: "action", width: 50 }
  ];
  columns.forEach(col => {
    const colEl = document.createElement("col");
    colEl.style.width = col.width + "px";
    colgroup.appendChild(colEl);
  });
  table.appendChild(colgroup);
  
  // Create thead with two rows: header row and filter row
  const thead = document.createElement("thead");
  
  // Header row with column titles
  const headerRow = document.createElement("tr");
  const favTh = document.createElement("th");
  favTh.textContent = "⭐";
  headerRow.appendChild(favTh);
  ["Name", "LV", "Role", "TR", "Bundle", "Action"].forEach(text => {
    const th = document.createElement("th");
    th.textContent = text;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  
  // Filter row (disabled inputs to mimic the library table header)
  const filterRow = document.createElement("tr");
  // Empty cell for the favorites column
  filterRow.appendChild(document.createElement("td"));
  // For each subsequent column add a disabled input
  ["monsterName", "level", "role", "tr", "bundle", "action"].forEach(() => {
    const td = document.createElement("td");
    const input = document.createElement("input");
    input.type = "text";
    input.style.width = "100%";
    input.disabled = true;
    td.appendChild(input);
    filterRow.appendChild(td);
  });
  thead.appendChild(filterRow);
  table.appendChild(thead);
  
  // Create tbody rows for each bundle statblock
  const tbody = document.createElement("tbody");
  bundleList.forEach((sb, index) => {
    const tr = document.createElement("tr");
    // Favorites cell (non-clickable star display)
    const favTd = document.createElement("td");
    const starSpan = document.createElement("span");
    starSpan.textContent = favoritesMap[sb.statblockID] ? "⭐" : "☆";
    favTd.appendChild(starSpan);
    tr.appendChild(favTd);
    
    // Other cells: monsterName, level, role, tr, bundle name
    const tdName = document.createElement("td");
    tdName.textContent = sb.monsterName || "";
    const tdLV = document.createElement("td");
    tdLV.textContent = sb.level || "";
    const tdRole = document.createElement("td");
    tdRole.textContent = sb.role || "";
    const tdTR = document.createElement("td");
    tdTR.textContent = sb.tr || "";
    const tdBundle = document.createElement("td");
    tdBundle.textContent = getBundleName(sb.bundleId) || "";
    tr.append(tdName, tdLV, tdRole, tdTR, tdBundle);
    
    // Action cell with "Remove" button
    const tdAction = document.createElement("td");
    const removeBtn = document.createElement("button");
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", () => {
      bundleList.splice(index, 1);
      renderBundleList();
    });
    tdAction.appendChild(removeBtn);
    tr.appendChild(tdAction);
    
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  container.appendChild(table);
}


let bundleListFilters = {
  monsterName: "",
  level: "",
  role: "",
  tr: "",
  bundle: ""
};

function updateBundleListFilters() {
  const inputs = document.querySelectorAll("#bundleListTable thead input");
  bundleListFilters = {
    monsterName: inputs[0].value,
    level: inputs[1].value,
    role: inputs[2].value,
    tr: inputs[3].value,
    bundle: inputs[4].value
  };
  renderBundleList();
}

/* EDITOR & YAML SYNC */
function removeBundleIdForSave(statblock) {
  delete statblock.bundleId;
}
function clearEditorFields(){
  masterYamlData = {};
  hiddenStats.clear(); // Reset hidden stats
  const customStatsContainer = document.getElementById("customStatsContainer");
  if (customStatsContainer) {
    customStatsContainer.innerHTML = ""; // Clear custom stats
  }
  updateUIFromMasterYaml();
  updateYamlTextArea();
  renderDefaultDetail();
}
function collectFeatures(){
  const arr = [];
  document.querySelectorAll("#featuresContainer .dynamic-feature").forEach(div => {
    const inputs = div.querySelectorAll("input");
    const t = inputs[0].value.trim();
    const c = inputs[1].value.trim();
    if(t || c) arr.push({ title: t, content: c });
  });
  return arr;
}
function collectDeedsAsString(type){
  const arr = [];
  document.querySelectorAll(`#${type}DeedsContainer .dynamic-deed`).forEach(div => {
    const ti = div.querySelector("input[type='text']");
    const deedTitle = ti ? ti.value.trim() : "";
    const lines = [];
    div.querySelectorAll(".linesContainer .dynamic-line").forEach(ld => {
      const lineInputs = ld.querySelectorAll("input");
      const lt = lineInputs[0].value.trim();
      const lc = lineInputs[1].value.trim();
      if(lt) {
        lines.push(lt + (lc ? ": " + lc : ""));
      }
    });
    let deedBlock = deedTitle;
    if(lines.length > 0) deedBlock += "\n" + lines.join("\n");
    arr.push(deedBlock);
  });
  return arr.join("\n\n");
}
function uiFieldChanged(){
  updateMasterYamlDataFromUI();
}
function updateRenderedStatblock(){
  if(!masterYamlData || !masterYamlData.monsterName){
    renderDefaultDetail();
    return;
  }

  // Clear previous state
  document.getElementById("defaultDetail").style.display = "none";
  document.getElementById("dsb-basicSection").style.display = "block";

  // Update header information
  document.getElementById("dsb-name").textContent = masterYamlData.monsterName || "[Monster Name]";
  document.getElementById("dsb-role").textContent = masterYamlData.role || "[Role]";
  
  if(masterYamlData.template) {
    document.getElementById("dsb-template").textContent = " " + masterYamlData.template;
    document.getElementById("dsb-template").style.display = "inline";
  } else {
    document.getElementById("dsb-template").style.display = "none";
  }
  
  document.getElementById("dsb-level").textContent = masterYamlData.level ? " " + masterYamlData.level : "";
  document.getElementById("dsb-tr").textContent = masterYamlData.tr ? "TR " + masterYamlData.tr : "";

  // Update basic stats display
  Object.keys(DEFAULT_STATS).forEach(key => {
    const el = document.getElementById("dsb-" + key);
    if (el) {
      if (masterYamlData[key]) {
        el.parentElement.style.display = "block";
        el.textContent = masterYamlData[key];
      } else {
        el.parentElement.style.display = "none";
      }
    }
  });

  // Handle custom stats - SINGLE IMPLEMENTATION
  const basicSection = document.getElementById("dsb-basicSection");
  const existingCustomRow = basicSection.querySelector(".custom-stats-row");
  if (existingCustomRow) {
    existingCustomRow.remove();
  }

  if (Array.isArray(masterYamlData.customStats) && masterYamlData.customStats.length > 0) {
    const customStatsRow = document.createElement("div");
    customStatsRow.className = "basic-stats-row custom-stats-row";
    
    masterYamlData.customStats.forEach(stat => {
      const card = document.createElement("div");
      card.className = "basic-stat-card";
      card.innerHTML = `
        <div class="basic-stat-header">${stat.name}</div>
        <div class="basic-stat-value">${stat.value}</div>
      `;
      customStatsRow.appendChild(card);
    });
    
    basicSection.appendChild(customStatsRow);
  }

  // Continue with features and deeds
  renderFeatures(masterYamlData);
  renderDeeds(masterYamlData);
  
  // Update IDs section
  const idsDiv = document.getElementById("dsb-ids");
  idsDiv.innerHTML = "";
  if(masterYamlData.statblockID) {
    const statblockIDSpan = document.createElement("div");
    statblockIDSpan.textContent = "statblockID: " + masterYamlData.statblockID;
    idsDiv.appendChild(statblockIDSpan);
  }
  if(masterYamlData.bundleId) {
    const bundleIDSpan = document.createElement("div");
    bundleIDSpan.textContent = "bundleID: " + masterYamlData.bundleId;
    idsDiv.appendChild(bundleIDSpan);
  }
}

function renderDefaultDetail(){
  document.getElementById("defaultDetail").style.display = "block";
  document.getElementById("dsb-basicSection").style.display = "none";
  document.getElementById("dsb-featuresSection").style.display = "none";
  document.getElementById("dsb-deedsSection").style.display = "none";
  document.getElementById("dsb-ids").innerHTML = "";
  document.getElementById("dsb-name").textContent = "[Monster Name]";
  document.getElementById("dsb-role").textContent = "[Role]";
  document.getElementById("dsb-template").textContent = "";
  document.getElementById("dsb-level").textContent = "";
  document.getElementById("dsb-tr").textContent = "";
}
function renderFeatures(data){
  const featSec = document.getElementById("dsb-featuresSection");
  const featList = document.getElementById("dsb-featuresList");
  featList.innerHTML = "";
  let hasFeature = false;
  if(Array.isArray(data.features)){
    data.features.forEach(f => {
      if(f.title || f.content){
        hasFeature = true;
        const d = document.createElement("div");
        d.style.marginBottom = "10px";
        d.style.fontSize = "0.9em";
        d.innerHTML = f.content ? `<strong>${f.title}:</strong> ${f.content}` : `<strong>${f.title}</strong>`;
        featList.appendChild(d);
      }
    });
  } else if(typeof data.features === "object"){
    for(let k in data.features){
      hasFeature = true;
      const d = document.createElement("div");
      d.style.marginBottom = "10px";
      d.style.fontSize = "0.9em";
      d.innerHTML = `<strong>${k}:</strong> ${data.features[k]}`;
      featList.appendChild(d);
    }
  }
  featSec.style.display = hasFeature ? "block" : "none";
}
function renderDeeds(data){
  const dsbDeeds = document.getElementById("dsb-deedsContainer");
  const dsbDeedsSec = document.getElementById("dsb-deedsSection");
  dsbDeeds.innerHTML = "";
  let hasDeeds = false;
  ["lightDeeds","heavyDeeds","mightyDeeds","tyrantDeeds", "specialDeeds"].forEach(t => {
    let arr = data[t];
    if(typeof arr === "string") arr = parseDeedsStringNew(arr);
    if(!Array.isArray(arr)) return;
    const color = t.replace("Deeds", "");
    arr.forEach(d => {
      if(d.title || (d.lines && d.lines.length)){
        hasDeeds = true;
        const cap = color.charAt(0).toUpperCase() + color.slice(1);
        let html = `<div class="deed-header">${cap}</div>`;
        if(d.title){
          html += `<div class="deed-title-output">${d.title.trim()}</div><hr class="deed-separator">`;
        }
        d.lines.forEach(line => {
          if(line.title || line.content){
            html += `<div class="line-indent" style="font-size:0.9em;">` +
                    (line.content ? `<strong>${line.title}:</strong> ${line.content}` : `<strong>${line.title}</strong>`) +
                    `</div>`;
          }
        }); // Added missing closing brace for d.lines.forEach
        const deedDiv = document.createElement("div");
        deedDiv.className = `deed ${color}`;
        deedDiv.innerHTML = html;
        dsbDeeds.appendChild(deedDiv);
      }
    });
  });
  dsbDeedsSec.style.display = hasDeeds ? "block" : "none";
}
function parseDeedsStringNew(str){
  let deedBlocks = str.split(/\n\s*\n/).map(block => block.trim()).filter(block => block !== "");
  let result = [];
  deedBlocks.forEach(block => {
    let lines = block.split("\n").map(l => l.trim()).filter(Boolean);
    if(lines.length > 0){
      let deedObj = { title: lines[0], lines: [] };
      for(let i = 1; i < lines.length; i++){
        let line = lines[i];
        let colonIndex = line.indexOf(":");
        if(colonIndex !== -1){
          let key = line.substring(0, colonIndex).trim();
          let value = line.substring(colonIndex+1).trim();
          deedObj.lines.push({ title: key, content: value });
        } else {
          deedObj.lines.push({ title: line, content: "" });
        }
      }
      result.push(deedObj);
    }
  });
  return result;
}

/* ADDING FEATURES & DEEDS */
function addFeature(feature=null){
  const container = document.getElementById("featuresContainer");
  const div = document.createElement("div");
  div.className = "dynamic-feature";
  const titleInput = document.createElement("input");
  titleInput.type = "text";
  titleInput.placeholder = "Title";
  titleInput.value = feature ? (feature.title || "") : "";
  titleInput.addEventListener("input", uiFieldChanged);
  const colonSpan = document.createElement("span");
  colonSpan.textContent = ":";
  colonSpan.className = "feature-colon";
  const contentInput = document.createElement("input");
  contentInput.type = "text";
  contentInput.placeholder = "Content";
  contentInput.value = feature ? (feature.content || "") : "";
  contentInput.addEventListener("input", uiFieldChanged);
  const removeBtn = document.createElement("button");
  removeBtn.textContent = "x";
  removeBtn.className = "delete-btn";
  removeBtn.addEventListener("click", () => {
    div.remove();
    uiFieldChanged();
  });
  div.append(titleInput, colonSpan, contentInput, removeBtn);
  container.appendChild(div);
}
function addDeed(type, deedObj=null){
  const container = document.getElementById(type + "DeedsContainer");
  const div = document.createElement("div");
  div.className = "dynamic-deed " + type;
  const titleInput = document.createElement("input");
  titleInput.type = "text";
  titleInput.placeholder = `Enter ${type} deed title`;
  titleInput.value = deedObj ? (deedObj.title || "") : "";
  titleInput.addEventListener("input", uiFieldChanged);
  const linesCont = document.createElement("div");
  linesCont.className = "linesContainer";
  const addLineBtn = document.createElement("button");
  addLineBtn.type = "button";
  addLineBtn.textContent = "Add Line";
  addLineBtn.className = "small-btn";
  addLineBtn.onclick = () => { addLine(linesCont); };
  const removeDeedBtn = document.createElement("button");
  removeDeedBtn.type = "button";
  removeDeedBtn.textContent = "x";
  removeDeedBtn.className = "delete-deed-btn";
  removeDeedBtn.onclick = () => { div.remove(); uiFieldChanged(); };
  div.append(titleInput, linesCont, addLineBtn, removeDeedBtn);
  container.appendChild(div);
  if(deedObj && Array.isArray(deedObj.lines)){
    deedObj.lines.forEach(line => addLine(linesCont, line));
  }
}
function addLine(container, line=null){
  const div = document.createElement("div");
  div.className = "dynamic-line";
  const titleInput = document.createElement("input");
  titleInput.type = "text";
  titleInput.placeholder = "Line title";
  titleInput.className = "line-title";
  titleInput.value = line ? (line.title || "") : "";
  titleInput.addEventListener("input", uiFieldChanged);
  const colonSpan = document.createElement("span");
  colonSpan.textContent = ":";
  colonSpan.className = "line-colon";
  const contentInput = document.createElement("input");
  contentInput.type = "text";
  contentInput.placeholder = "Line content";
  contentInput.className = "line-content";
  contentInput.value = line ? (line.content || "") : "";
  contentInput.addEventListener("input", uiFieldChanged);
  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.textContent = "x";
  removeBtn.className = "delete-btn";
  removeBtn.onclick = () => { div.remove(); uiFieldChanged(); };
  div.append(titleInput, colonSpan, contentInput, removeBtn);
  container.appendChild(div);
}

/* SAVE/EXPORT */
function findDuplicate(statblock) {
  const id = statblock.statblockID;
  return statblocks.find(s => s.statblockID === id && s !== currentDetail);
}

// ------------------- Modified saveToLibrary Function -------------------
function saveToLibrary(){
  // *** NEW STEP: Always generate statblockID from masterYamlData BEFORE duplicate checking ***
  const newID = generateStatblockID(masterYamlData);
  masterYamlData.statblockID = newID;
  
  // Check for duplicate statblock by comparing the freshly generated statblockID
  const duplicate = findDuplicate(masterYamlData);
  if(duplicate){
    alert("A statblock with identical content already exists. Skipping.");
    return;
  }
  
  // Remove bundleId before saving (if applicable)
  removeBundleIdForSave(masterYamlData);
  
  // Update existing statblock if in edit mode, otherwise add as new
  if(currentDetail && currentDetail.statblockID === newID){
    Object.assign(currentDetail, masterYamlData);
  } else {
    statblocks.push(masterYamlData);
    currentDetail = masterYamlData;
  }
  
  selectedStatblockID = currentDetail.statblockID;
  saveToLocalStorage();
  
  // Refresh the UI components and search index
  initSearch();
  renderStatblockLibrary();
  fillBundleSelect();
  fillManageMergeSelect();
  renderUploadedBundles();
  
  alert("Statblock saved to library!");
}

  selectedStatblockID = currentDetail.statblockID;
  saveToLocalStorage();
  initSearch();
  renderStatblockLibrary();
  fillBundleSelect();
  fillManageMergeSelect();
  renderUploadedBundles();
  alert("Statblock saved to library!");


function exportCurrentDetail(){
  if(!currentDetail){
    alert("No statblock selected.");
    return;
  }
  const exportContainer = document.createElement("div");
  exportContainer.style.width = "560px";
  exportContainer.style.height = "auto";
  exportContainer.style.padding = "10px";
  exportContainer.style.boxSizing = "border-box";
  exportContainer.innerHTML = document.getElementById("detailStatblock").innerHTML;
  document.body.appendChild(exportContainer);
  html2canvas(exportContainer, { scale: 2 }).then(canvas => {
    const fmt = document.getElementById("exportFormat").value;
    const baseName = currentDetail.monsterName ? currentDetail.monsterName.replace(/\s+/g, "_") : "statblock";
    if(fmt === "png"){
      const a = document.createElement("a");
      a.download = baseName + ".png";
      a.href = canvas.toDataURL("image/png");
      a.click();
    } else {
      const pdf = new jspdf.jsPDF({
        orientation: "landscape",
        unit: "px",
        format: [canvas.width, canvas.height]
      });
      pdf.addImage(canvas.toDataURL("image/png"), 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(baseName + ".pdf");
    }
    document.body.removeChild(exportContainer);
  });
}

function downloadCurrentBundle(fmt){
  if(!bundleList.length){
    alert("No statblocks in the bundle!");
    return;
  }
  const bundleId = generateBundleID(bundleList);
  const modified = bundleList.map(sb => Object.assign({}, sb, { bundleId }));
  if(fmt === "json"){
    const filename = "bundle-" + bundleId + ".json";
    downloadBlob(JSON.stringify(modified, null, 2), "application/json", filename);
  } else {
    let y = "";
    modified.forEach(sb => { y += jsyaml.dump(sb, { lineWidth: -1 }) + "\n---\n"; });
    y = y.trim().replace(/---$/, "");
    const filename = "bundle-" + bundleId + ".yaml";
    downloadBlob(y, "text/yaml", filename);
  }
}

function mergeSelectedBundles(fmt){
  const sids = Array.from(document.getElementById("manageMergeSelect").selectedOptions)
                .map(o => o.value);
  if(!sids.length){
    alert("Select at least one bundle to merge.");
    return;
  }
  let merged = statblocks.filter(sb => sb.bundleId !== undefined && sids.includes(sb.bundleId));
  let seen = {};
  let unique = [];
  merged.forEach(sb => {
    if(!seen[sb.statblockID]){
      seen[sb.statblockID] = true;
      unique.push(sb);
    }
  });
  if(!unique.length){
    alert("No statblocks found for selected bundles.");
    return;
  }
  const mergeBundleId = generateBundleID(unique);
  unique = unique.map(sb => Object.assign({}, sb, { bundleId: mergeBundleId }));
  if(fmt === "json"){
    const filename = "merged-bundle-" + mergeBundleId + ".json";
    downloadBlob(JSON.stringify(unique, null, 2), "application/json", filename);
  } else {
    let y = "";
    unique.forEach(sb => { y += jsyaml.dump(sb, { lineWidth: -1 }) + "\n---\n"; });
    y = y.trim().replace(/---$/, "");
    const filename = "merged-bundle-" + mergeBundleId + ".yaml";
    downloadBlob(y, "text/yaml", filename);
  }
}

async function handleUpload(){
  const fileInput = document.getElementById("uploadFile");
  if(!fileInput.files.length){
    alert("No file selected!");
    return;
  }
  const file = fileInput.files[0];
  const text = await file.text();
  let uploaded = null;
  try {
    uploaded = JSON.parse(text);
    if(!Array.isArray(uploaded)) uploaded = null;
  } catch(e){}
  if(!uploaded){
    try {
      uploaded = [];
      jsyaml.loadAll(text).forEach(doc => {
        if(Array.isArray(doc)){
          uploaded.push(...doc);
        } else {
          uploaded.push(doc);
        }
      });
    } catch(e){
      alert("Could not parse file as JSON or YAML.");
      return;
    }
  }
  let count = 0;
  const bundleData = [];
  const duplicates = [];
  const newStatblocks = [];
  uploaded.forEach(sb => {
    if(sb && sb.monsterName){
      delete sb.statblockID;
      sb.statblockID = generateStatblockID(sb);
      bundleData.push(sb);
      const existing = statblocks.find(x => x.statblockID === sb.statblockID);
      if(existing){
        duplicates.push({uploaded: sb, existing});
      } else {
        newStatblocks.push(sb);
        statblocks.push(sb);
        count++;
      }
    }
  });
  const bundleId = generateBundleID(bundleData);
  bundleData.forEach(sb => sb.bundleId = bundleId);
  const nameInput = document.getElementById("uploadBundleNameInput");
  const userBundleName = nameInput.value.trim();
  const finalBundleName = userBundleName !== "" ? userBundleName : bundleId;

  if(duplicates.length > 0){
    pendingUpload = {bundleId, bundleData, newStatblocks, duplicates, fileName: file.name, finalBundleName};
    showOverwriteModal(duplicates);
  } else {
    uploadedBundles.push({
      id: bundleId,
      filename: file.name,
      bundleName: finalBundleName,
      total: bundleData.length,
      active: true,
      data: bundleData
    });
    saveToLocalStorage();
    saveUploadedBundles();
    renderStatblockLibrary();
    fillBundleSelect();
    fillManageMergeSelect();
    renderUploadedBundles();
    alert(`Uploaded ${count} new statblock(s) from your bundle.`);
  }
}

function showOverwriteModal(duplicates) {
  const listDiv = document.getElementById("overwriteList");
  listDiv.innerHTML = "";
  duplicates.forEach((dup, index) => {
    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = true;
    checkbox.dataset.index = index;
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(" " + dup.uploaded.monsterName + " (ID: " + dup.uploaded.statblockID + ")"));
    listDiv.appendChild(label);
  });
  document.getElementById("overwriteModal").style.display = "flex";
}

function confirmOverwrite() {
  if(!pendingUpload) return;
  const checkboxes = document.querySelectorAll("#overwriteList input[type='checkbox']");
  checkboxes.forEach(cb => {
    const idx = parseInt(cb.dataset.index, 10);
    if(cb.checked){
      const dup = pendingUpload.duplicates[idx];
      dup.existing.bundleId = pendingUpload.bundleId;
    }
  });
  uploadedBundles.push({
    id: pendingUpload.bundleId,
    filename: pendingUpload.fileName,
    bundleName: pendingUpload.finalBundleName,
    total: pendingUpload.bundleData.length,
    active: true,
    data: pendingUpload.bundleData
  });
  saveToLocalStorage();
  saveUploadedBundles();
  renderStatblockLibrary();
  fillBundleSelect();
  fillManageMergeSelect();
  renderUploadedBundles();
  document.getElementById("overwriteModal").style.display = "none";
  pendingUpload = null;
  alert("Bundle upload processed with selected overwrites.");
}

function cancelOverwrite() {
  pendingUpload = null;
  document.getElementById("overwriteModal").style.display = "none";
  alert("Bundle upload cancelled for duplicates. New statblocks (non-duplicates) have been added.");
}

async function exportBackup(){
  const zip = new JSZip();
  zip.file("library.json", localStorage.getItem(LOCAL_STORAGE_KEY) || "{}");
  zip.file("bundles.json", localStorage.getItem(LOCAL_STORAGE_BUNDLES_KEY) || "[]");
  const blob = await zip.generateAsync({ type: "blob" });
  const a = document.createElement("a");
  a.download = "trespasser-backup.zip";
  a.href = URL.createObjectURL(blob);
  a.click();
  URL.revokeObjectURL(a.href);
}

async function importBackup(e){
  const file = e.target.files[0];
  if(!file) return;
  try {
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    const libFile = zip.file("library.json");
    const bundlesFile = zip.file("bundles.json");
    if(!libFile || !bundlesFile){
      alert("The backup file is missing library.json or bundles.json.");
      e.target.value = "";
      return;
    }
    const libData = await libFile.async("string");
    const bundlesData = await bundlesFile.async("string");
    let parsedLib = JSON.parse(libData);
    // Backward compatibility: if parsedLib is an array, convert it.
    if(Array.isArray(parsedLib)){
      statblocks = parsedLib;
      favoritesMap = {};
    } else {
      statblocks = parsedLib.statblocks || [];
      const favArray = parsedLib.favorites || [];
      favoritesMap = {};
      favArray.forEach(id => favoritesMap[id] = true);
    }
    uploadedBundles = JSON.parse(bundlesData);
    saveToLocalStorage();
    saveUploadedBundles();
    initSearch();
    renderStatblockLibrary();
    fillBundleSelect();
    fillManageMergeSelect();
    renderUploadedBundles();
    alert("Backup imported successfully!");
  } catch(err) {
    alert("Failed to import backup: " + err);
  }
  e.target.value = "";
}
function downloadBlob(text, mime, filename){
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Add new functions for managing custom stats
function addCustomStat(customStat = null) {
  const container = document.getElementById("customStatsContainer");
  const div = document.createElement("div");
  div.className = "custom-stat";
  
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.placeholder = "Stat Name";
  nameInput.value = customStat ? customStat.name : "";
  nameInput.addEventListener("input", uiFieldChanged);
  
  const valueInput = document.createElement("input");
  valueInput.type = "text";
  valueInput.placeholder = "Value";
  valueInput.value = customStat ? customStat.value : "";
  valueInput.addEventListener("input", uiFieldChanged);
  
  const removeBtn = document.createElement("button");
  removeBtn.textContent = "×";
  removeBtn.className = "delete-btn";
  removeBtn.addEventListener("click", () => {
    div.remove();
    uiFieldChanged();
  });
  
  div.append(nameInput, valueInput, removeBtn);
  container.appendChild(div);
}

// Add functions for managing the stats modal
function showManageStatsModal() {
  const modal = document.getElementById("manageStatsModal");
  const list = document.getElementById("statsList");
  list.innerHTML = "";
  
  Object.entries(DEFAULT_STATS).forEach(([key, label]) => {
    const div = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox"; 
    checkbox.className = "stat-checkbox";
    checkbox.checked = !hiddenStats.has(key);
    checkbox.dataset.stat = key;
    
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        hiddenStats.delete(key);
      } else {
        hiddenStats.add(key);
      }
      const statInput = document.getElementById(key);
      if (statInput && statInput.parentElement) {
        statInput.parentElement.classList.toggle("hidden-stat", !checkbox.checked);
      }
      updateMasterYamlDataFromUI();
      updateRenderedStatblock();
    });
    
    div.appendChild(checkbox);
    div.appendChild(document.createTextNode(` ${label}`));
    list.appendChild(div);
  });
  
  modal.style.display = "flex";
}

function closeManageStatsModal() {
  document.getElementById("manageStatsModal").style.display = "none";
  updateMasterYamlDataFromUI();
  updateYamlTextArea();
}

// Update attachEventHandlers to include the top tabs
function attachEventHandlers() {
  document.getElementById("toggleSidebarBtn").addEventListener("click", toggleSidebar);
  document.getElementById("libraryToggle").addEventListener("click", () => switchSidebarTab("library"));
  document.getElementById("editorToggle").addEventListener("click", () => switchSidebarTab("editor"));
  document.getElementById("yamlToggle").addEventListener("click", () => switchSidebarTab("yaml"));
  document.getElementById("toggleBundlesSidebarBtn").addEventListener("click", toggleBundlesSidebar);
  
  // Add event listeners for top-level bundle tabs
  document.getElementById("bundlesBundlesTab").addEventListener("click", () => switchBundlesTab("bundles"));
  document.getElementById("bundlesBackupTab").addEventListener("click", () => switchBundlesTab("backup"));
  
  // Add event listeners for bundle subtabs
  document.getElementById("bundlesManageTab").addEventListener("click", () => switchBundlesTab("manage"));
  document.getElementById("bundlesUploadTab").addEventListener("click", () => switchBundlesTab("upload"));
  document.getElementById("bundlesCreateTab").addEventListener("click", () => switchBundlesTab("create"));
  document.getElementById("bundlesMergeTab").addEventListener("click", () => switchBundlesTab("merge"));

  // Rest of your existing event handlers...
  document.getElementById("createNewBtn").addEventListener("click", () => {
    if (confirm("Create new empty statblock? Any unsaved changes will be lost.")) {
      masterYamlData = {};
      currentDetail = null;
      selectedStatblockID = null;
      updateRenderedStatblock();
      updateUIFromMasterYaml();
      document.getElementById("yamlInput").value = "";
    }
  });
  document.getElementById("exportBackupBtn").addEventListener("click", exportBackup);
  document.getElementById("importBackupBtn").addEventListener("click", () => {
    document.getElementById("importBackupFile").click();
  });
  document.getElementById("importBackupFile").addEventListener("change", importBackup);
  document.getElementById("uploadBtn").addEventListener("click", handleUpload);

  ["monsterName","role","template","level","tr","hp","init","acc","grd","res","roll","spd"].forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener("input", uiFieldChanged);
    el.addEventListener("change", uiFieldChanged);
    el.addEventListener("blur", uiFieldChanged);
  });
  document.getElementById("addFeatureBtn").addEventListener("click", () => {
    addFeature();
    uiFieldChanged();
  });
  document.getElementById("addLightDeedBtn").addEventListener("click", () => {
    addDeed("light");
    uiFieldChanged();
  });
  document.getElementById("addHeavyDeedBtn").addEventListener("click", () => {
    addDeed("heavy");
    uiFieldChanged();
  });
  document.getElementById("addMightyDeedBtn").addEventListener("click", () => {
    addDeed("mighty");
    uiFieldChanged();
  });
  document.getElementById("addTyrantDeedBtn").addEventListener("click", () => {
    addDeed("tyrant");
    uiFieldChanged();
  });
  document.getElementById("addSpecialDeedBtn").addEventListener("click", () => {
    addDeed("special");
    uiFieldChanged();
  });
  document.getElementById("yamlArea").addEventListener("input", updateMasterYamlDataFromYaml);
  document.getElementById("copyYaml").addEventListener("click", () => {
    navigator.clipboard.writeText(document.getElementById("yamlArea").value)
      .then(() => alert("YAML copied!"))
      .catch(err => alert("Error copying YAML: " + err));
  });
  document.getElementById("saveToLibraryBtn").addEventListener("click", saveToLibrary);
  document.getElementById("exportBtn").addEventListener("click", exportCurrentDetail);
  document.getElementById("downloadBundleJsonBtn").addEventListener("click", () => downloadCurrentBundle("json"));
  document.getElementById("downloadBundleYamlBtn").addEventListener("click", () => downloadCurrentBundle("yaml"));
  document.getElementById("mergeJsonBtn").addEventListener("click", () => mergeSelectedBundles("json"));
  document.getElementById("mergeYamlBtn").addEventListener("click", () => mergeSelectedBundles("yaml"));
  document.getElementById("deleteAllBtn").addEventListener("click", () => {
    if(confirm("Are you sure you want to permanently delete all statblocks and bundles? This action cannot be undone.")){
      statblocks = [];
      uploadedBundles = [];
      bundleList = [];
      saveToLocalStorage();
      saveUploadedBundles();
      renderStatblockLibrary();
      fillBundleSelect();
      fillManageMergeSelect();
      renderUploadedBundles();
      alert("All statblocks and bundles have been deleted.");
    }
  });

  const removeAllBtn = document.getElementById("removeAllBundleBtn");
  if(removeAllBtn){
    removeAllBtn.addEventListener("click", () => {
      if(confirm("Are you sure you want to remove all statblocks from the current bundle?")){
        bundleList = [];
        renderBundleList();
      }
    });
  }

  document.getElementById("statblockList").addEventListener("keydown", function(e) {
    if (!currentFilteredList.length) return;
    let curIndex = currentFilteredList.findIndex(sb => sb.statblockID === selectedStatblockID);
    if(curIndex === -1) curIndex = 0;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      curIndex = Math.min(curIndex + 1, currentFilteredList.length - 1);
      selectedStatblockID = currentFilteredList[curIndex].statblockID;
      currentDetail = currentFilteredList[curIndex];
      renderStatblockLibrary();
      masterYamlData = structuredClone(currentDetail);
      updateUIFromMasterYaml();
      updateYamlTextArea();
      updateRenderedStatblock();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      curIndex = Math.max(curIndex - 1, 0);
      selectedStatblockID = currentFilteredList[curIndex].statblockID;
      currentDetail = currentFilteredList[curIndex];
      renderStatblockLibrary();
      masterYamlData = structuredClone(currentDetail);
      updateUIFromMasterYaml();
      updateYamlTextArea();
      updateRenderedStatblock();
    }
  });
  document.getElementById("statblockList").addEventListener("scroll", function() {
    updateSelectedRow();
  });
  
  // Removed: initResizeHandles(); -- sidebar resizing disabled now

  ["cbSearchName", "cbSearchLV", "cbSearchRole", "cbSearchTR", "cbSearchBundle"].forEach(id => {
    const el = document.getElementById(id);
    if(el){
      el.addEventListener("input", () => {
        if(id === "cbSearchName") cbFilterName = el.value;
        if(id === "cbSearchLV") cbFilterLV = el.value;
        if(id === "cbSearchRole") cbFilterRole = el.value;
        if(id === "cbSearchTemplate") cbFilterTemplate = el.value; 
        if(id === "cbSearchTR") cbFilterTR = el.value;
        if(id === "cbSearchBundle") cbFilterBundle = el.value;
        renderCreateBundleList();
      });
    }
  });

  // Fix for the broken "Select All" functionality in Create Bundle tab:
  document.getElementById("selectAllBundleBtn").addEventListener("click", () => {
    let filtered = statblocks.filter(sb => {
      const matchesName = matchesStringQuery(sb.monsterName || "", cbFilterName);
      const matchesRole = matchesStringQuery(sb.role || "", cbFilterRole);
      const matchesLV = matchesNumericQuery(sb.level, cbFilterLV);
      const matchesTR = matchesNumericQuery(sb.tr, cbFilterTR);
      const matchesBundle = matchesStringQuery(getBundleName(sb.bundleId), cbFilterBundle);
      return matchesName && matchesRole && matchesLV && matchesTR && matchesBundle;
    });
    filtered = filtered.filter(sb => {
      if(sb.bundleId === undefined) return true;
      let bun = uploadedBundles.find(x => x.id === sb.bundleId);
      return bun && bun.active;
    });
    filtered.forEach(sb => {
      if(!bundleList.includes(sb)) bundleList.push(sb);
    });
    renderBundleList();
  });

  document.getElementById("generateShareLinkBtn").addEventListener("click", () => {
    if(!masterYamlData || !masterYamlData.monsterName){
      alert("No statblock data available to share.");
      return;
    }
    const yamlStr = jsyaml.dump(masterYamlData, { lineWidth: -1 });
    const encoded = encodeStatblockData(yamlStr);
    const shareUrl = window.location.origin + window.location.pathname + "?s=" + encoded;
    document.getElementById("shareLinkInput").value = shareUrl;
  });

  document.getElementById("decodeShareBtn").addEventListener("click", () => {
    const inputVal = document.getElementById("decodeInput").value.trim();
    if(!inputVal){
      alert("Please enter a share code or URL.");
      return;
    }
    let shareCode = inputVal;
    try {
      const urlObj = new URL(inputVal);
      shareCode = urlObj.searchParams.get("s");
      if(!shareCode) throw new Error("No share parameter found.");
    } catch(e) {}
    const decodedYaml = decodeStatblockData(shareCode);
    if(!decodedYaml){
      alert("Failed to decode share code. Please check the input.");
      return;
    }
    try {
      masterYamlData = jsyaml.load(decodedYaml);
      updateUIFromMasterYaml();
      updateYamlTextArea();
      updateRenderedStatblock();
      alert("Statblock loaded from share code.");
    } catch(e) {
      alert("Error parsing YAML from share code: " + e);
    }
  });

  document.getElementById("selectAllBtn").addEventListener("click", () => {
    document.querySelectorAll("#overwriteList input[type='checkbox']").forEach(cb => cb.checked = true);
  });
  document.getElementById("deselectAllBtn").addEventListener("click", () => {
    document.querySelectorAll("#overwriteList input[type='checkbox']").forEach(cb => cb.checked = false);
  });
  document.getElementById("confirmOverwriteBtn").addEventListener("click", confirmOverwrite);
  document.getElementById("cancelOverwriteBtn").addEventListener("click", cancelOverwrite);

  document.getElementById("addCustomStatBtn")?.addEventListener("click", () => {
    addCustomStat();
    uiFieldChanged();
  });

  document.getElementById("manageStatsBtn")?.addEventListener("click", showManageStatsModal);
  
  document.getElementById("closeManageStatsBtn")?.addEventListener("click", closeManageStatsModal);

  document.getElementById("restoreDefaultsBtn")?.addEventListener("click", () => {
    hiddenStats.clear();
    Object.keys(DEFAULT_STATS).forEach(key => {
      const el = document.getElementById(key);
      if (el && el.parentElement) {
        el.parentElement.classList.remove("hidden-stat");
      }
    });
    updateMasterYamlDataFromUI();
    updateRenderedStatblock();
    updateYamlTextArea();
  });
}
function updateSelectedRow(){
  const rows = document.querySelectorAll("#libraryTable tbody tr");
  rows.forEach((row) => {
    const idx = row.getAttribute("data-index");
    const sb = currentFilteredList[idx];
    if(sb && sb.statblockID === selectedStatblockID){
      row.classList.add("selected");
    } else {
      row.classList.remove("selected");
    }
  });
}

function initSearch(){
  fuseIndex = new Fuse(statblocks, {
    keys: ["monsterName","role","template","level","tr"],
    threshold: 0.3,
    ignoreLocation: true
  });
}
function matchesNumericQuery(value, query) {
  if (!query.trim()) return true;
  
  // Convert value to number, handling undefined/null
  const numVal = value ? Number(value.toString().replace(/[^\d.-]/g, '')) : 0;
  if (isNaN(numVal)) return false;

  const segments = query.split(",").map(s => s.trim()).filter(Boolean);
  for (let seg of segments) {
    if (/^>\s*(\d+)$/.test(seg)) {
      const num = Number(seg.match(/^>\s*(\d+)$/)[1]);
      if (numVal > num) return true;
    } else if (/^>=\s*(\d+)$/.test(seg)) {
      const num = Number(seg.match(/^>=\s*(\d+)$/)[1]);
      if (numVal >= num) return true;
    } else if (/^<\s*(\d+)$/.test(seg)) {
      const num = Number(seg.match(/^<\s*(\d+)$/)[1]);
      if (numVal < num) return true;
    } else if (/^<=\s*(\d+)$/.test(seg)) {
      const num = Number(seg.match(/^<=\s*(\d+)$/)[1]);
      if (numVal <= num) return true;
    } else if (/^(\d+)\s*-\s*(\d+)$/.test(seg)) {
      const [, min, max] = seg.match(/^(\d+)\s*-\s*(\d+)$/);
      if (numVal >= Number(min) && numVal <= Number(max)) return true;
    } else if (!isNaN(Number(seg))) {
      if (numVal === Number(seg)) return true;
    }
  }
  return false;
}

// Add initialization for bundle panels on page load
function initBundlePanels() {
  // Move all subtab panels into the bundles container panel if they're not already there
  const bundlesContainerPanel = document.getElementById("bundlesBundlesPanel");
  ["manage", "upload", "create", "merge"].forEach(subtab => {
    const panel = document.getElementById("bundles" + subtab.charAt(0).toUpperCase() + subtab.slice(1) + "Panel");
    if (panel && panel.parentElement !== bundlesContainerPanel) {
      bundlesContainerPanel.appendChild(panel);
    }
  });
}
