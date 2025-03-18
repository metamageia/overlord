import { updateMasterYamlData } from "./yamlDataState.mjs";
import {updateUIFromMasterYaml, updateYamlTextArea} from "./masterYamlData.mjs";
import { currentSortDirection, currentSortField, setCurrentSortDirection, setCurrentSortField, toggleSortDirection } from "./libraryUtilities.mjs";
import { statblocks, uploadedBundles, favoritesMap, deleteStatblock, saveToLocalStorage } from "./libraryData.mjs";
import { matchesStringQuery, matchesNumericQuery } from "./utilityFunctions.mjs";
import { getBundleName, fillManageMergeSelect, renderUploadedBundles, renderCreateBundleList } from "./bundleManagement.mjs";
import { generateStatblockID, } from "./idManagement.mjs";
import { renderDefaultDetail } from "./statblockRender.mjs";

// Global filters for library table
let filterName = "";
let filterLV = "";
let filterRole = "";
let filterTemplate = ""; 
let filterTR = "";
let filterBundle = "";

export let currentDetail = null; 
export let currentFilteredList = [];
export let selectedStatblockID = null;

// Library Browser Functions
export function setCurrentDetail(value) {
    currentDetail = value;
}
export function setSelectedStatblockID(value) {
    selectedStatblockID = value;
}

/* ---------------------------------------------
 * Render Statblock Library
 * ---------------------------------------------
 */

// Render Library Table
export function renderStatblockLibrary(){
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
        deleteStatblock(sb);
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
        document.dispatchEvent(new CustomEvent('refreshUI'));
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
export function initThResizer(resizer, th, colId){
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
export function updateSelectedRow(){
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
export function showManageStatsModal() {
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
export function closeManageStatsModal() {
  document.getElementById("manageStatsModal").style.display = "none";
  updateMasterYamlDataFromUI();
  updateYamlTextArea();
  updateRenderedStatblock();
}


// Save Statblock to Library //
export function saveToLibrary(){
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