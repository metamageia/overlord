import { masterYamlData, updateMasterYamlData, resetMasterYamlData, hiddenStats, DEFAULT_STATS } from "./js/yamlDataState.mjs";
import { updateYamlTextArea, updateMasterYamlDataFromYaml, updateUIFromMasterYaml, updateMasterYamlDataFromUI, uiFieldChanged } from "./js/masterYamlData.mjs";
import { updateRenderedStatblock, renderDefaultDetail } from "./js/statblockRender.mjs";
import { statblocks, uploadedBundles, favoritesMap, loadFromLocalStorage, saveToLocalStorage, loadUploadedBundles, saveUploadedBundles, exportBackup, importBackup, downloadBlob, clearLocalStorage, initSearch, } from "./js/libraryData.mjs";
import { generateStatblockID, } from "./js/idManagement.mjs";
import { handleUpload, renderCreateBundleList, renderBundleList, downloadCurrentBundle, mergeSelectedBundles, getBundleName, confirmOverwrite, cancelOverwrite, fillManageMergeSelect, renderUploadedBundles} from './js/bundleManagement.mjs';
import { matchesNumericQuery, matchesStringQuery } from './js/utilityFunctions.mjs';
import { currentSortDirection, currentSortField, setCurrentSortDirection, setCurrentSortField, toggleSortDirection } from "./js/libraryUtilities.mjs";
import { decodeStatblockData, encodeStatblockData,exportCurrentDetail } from "./js/shareStatblocks.mjs";

/************************************************
 * Global Variables
 ************************************************/

// GLOBALS & DATA STORAGE
let currentDetail = null; // currently selected statblock from the library
let selectedStatblockID = null;
let currentFilteredList = [];

// Global filters for library table
let filterName = "";
let filterLV = "";
let filterRole = "";
let filterTemplate = ""; 
let filterTR = "";
let filterBundle = "";

// PWA Add this to your global variables
let deferredPrompt;

/* ---------------------------------------------
 * Event Listeners
 * ---------------------------------------------
 */

window.addEventListener("DOMContentLoaded", () => {
  loadFromLocalStorage();
  loadUploadedBundles();
  initSearch();
  renderStatblockLibrary();
  renderCreateBundleList();
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
  
  resetMasterYamlData();
  updateUIFromMasterYaml();
  updateYamlTextArea();

  // NEW: Check URL for share parameter "s" and load statblock if present
  const urlParams = new URLSearchParams(window.location.search);
  const shareParam = urlParams.get('s');
  if(shareParam) {
    try {
      const decodedYaml = decodeStatblockData(shareParam);
      if(decodedYaml) {
        updateMasterYamlData(jsyaml.load(decodedYaml));
        updateUIFromMasterYaml();
        updateYamlTextArea();
        updateRenderedStatblock();
        alert("Loaded statblock from share link.");
      }
    } catch(e) {
      console.error("Error decoding share parameter:", e);
    }
  }

  // Add this to your window.addEventListener("DOMContentLoaded", () => {}) function
  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the default prompt
    e.preventDefault();
    // Store the event for later
    deferredPrompt = e;
    

    
    // Add it after the toggle buttons
    const togglesContainer = document.querySelector('.sidebar-toggles');
    togglesContainer.appendChild(installButton);
    
    // Add click handler
    installButton.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      
      // Show the install prompt
      deferredPrompt.prompt();
      
      // Wait for the user to respond
      const { outcome } = await deferredPrompt.userChoice;
      
      // Reset the deferred prompt
      deferredPrompt = null;
      
      // Hide the button
      installButton.style.display = 'none';
    });
  });
});

/* ---------------------------------------------
 * UI Controllers
 * ---------------------------------------------
 */

// Left Sidebar
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
function switchSidebarTab(tab){
  ["library", "editor", "yaml"].forEach(t => {
    document.getElementById(t + "Toggle").classList.remove("active");
    document.getElementById(t + "Panel").classList.remove("active");
  });
  document.getElementById(tab + "Toggle").classList.add("active");
  document.getElementById(tab + "Panel").classList.add("active");
  if(tab === "yaml") updateYamlTextArea();
}

// Right Sidebar
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

// --- Initial Sidebar Visibility --- //
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


/* ---------------------------------------------
 * Render Statblock Library
 * ---------------------------------------------
 */

// Render Library Table
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
      toggleSortDirection();
    } else {
      setCurrentSortField("favorite");
      setCurrentSortDirection("asc");
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
        toggleSortDirection();
      } else {
        setCurrentSortField(col.field);
        setCurrentSortDirection("asc");
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
        updateMasterYamlData(structuredClone(sb));
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
// Resize Columns in Statblock Library
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
// Row Selection
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




/* ---------------------------------------------
 * UI Editor Functions
 * ---------------------------------------------
 */

// --- New Statblock --- //
function clearEditorFields(){
  resetMasterYamlData();
  hiddenStats.clear(); // Reset hidden stats
  const customStatsContainer = document.getElementById("customStatsContainer");
  if (customStatsContainer) {
    customStatsContainer.innerHTML = ""; // Clear custom stats
  }
  updateUIFromMasterYaml();
  updateYamlTextArea();
  renderDefaultDetail();
}

// --- Stats --- //
// Custom Stats Management //
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
// Close Mange Stats
function closeManageStatsModal() {
  document.getElementById("manageStatsModal").style.display = "none";
  updateMasterYamlDataFromUI();
  updateYamlTextArea();
  updateRenderedStatblock();
}


// Save Statblock to Library //
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
  fillManageMergeSelect();
  renderUploadedBundles();
  
  alert("Statblock saved to library!");
}
// Duplicate Check
function findDuplicate(statblock) {
  const id = statblock.statblockID;
  return statblocks.find(s => s.statblockID === id && s !== currentDetail);
}
function removeBundleIdForSave(statblock) {
  delete statblock.bundleId;
}



/* ---------------------------------------------
 * Event Handles
 * ---------------------------------------------
 */

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

  document.getElementById("createNewBtn").addEventListener("click", () => {
    if (confirm("Create new empty statblock? Any unsaved changes will be lost.")) {
      resetMasterYamlData();
      currentDetail = null;
      selectedStatblockID = null;
      updateRenderedStatblock();
      updateUIFromMasterYaml();
    }
  });
  document.getElementById("exportBackupBtn").addEventListener("click", exportBackup);
  document.getElementById("importBackupBtn").addEventListener("click", () => {
    document.getElementById("importBackupFile").click();
  });
  document.getElementById("importBackupFile").addEventListener("change", importBackup);
  document.addEventListener('refreshUI', () => {
    initSearch();
    renderStatblockLibrary();
    renderCreateBundleList();
    fillManageMergeSelect();
    renderUploadedBundles();
  });
  document.addEventListener('saveLibraryChanges', () => {
    saveToLocalStorage();
    saveUploadedBundles();
  });
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
      clearLocalStorage();
      document.dispatchEvent(new CustomEvent('saveLibraryChanges'));
      document.dispatchEvent(new CustomEvent('refreshUI'));
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
      updateMasterYamlData(structuredClone(currentDetail));
      updateUIFromMasterYaml();
      updateYamlTextArea();
      updateRenderedStatblock();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      curIndex = Math.max(curIndex - 1, 0);
      selectedStatblockID = currentFilteredList[curIndex].statblockID;
      currentDetail = currentFilteredList[curIndex];
      renderStatblockLibrary();
      updateMasterYamlData(structuredClone(currentDetail));
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
      updateMasterYamlData(jsyaml.load(decodedYaml));
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
    updateYamlTextArea();
    updateRenderedStatblock();
  });
}
