import { statblocks, favoritesMap, uploadedBundles, downloadBlob } from './libraryData.mjs';
import {generateStatblockID, generateBundleID,} from './idManagement.mjs';
import { matchesNumericQuery, matchesStringQuery } from './utilityFunctions.mjs';
import { currentSortDirection, currentSortField } from "./libraryUtilities.mjs";


// Global filters for Create Bundle table
let cbFilterName = "";
let cbFilterLV = "";
let cbFilterRole = "";
let cbFilterTemplate = ""; 
let cbFilterTR = "";
let cbFilterBundle = "";

let bundleList = [];


/* ---------------------------------------------
 * Bundle Management
 * ---------------------------------------------
 */

// Get Bundle Name from ID
export function getBundleName(bundleId) {
    const bun = uploadedBundles.find(x => x.id === bundleId);
    return bun ? bun.bundleName : "";
  }

// --- Upload Bundles --- //
export async function handleUpload(){
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
      document.dispatchEvent(new CustomEvent('saveLibraryChanges'));
      document.dispatchEvent(new CustomEvent('refreshUI'));
      alert(`Uploaded ${count} new statblock(s) from your bundle.`);
    }
  }
  // Overwrite Statblocks on Bundle Upload
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
  // Confirm Overwrite
 export function confirmOverwrite() {
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
    document.dispatchEvent(new CustomEvent('saveLibraryChanges'));
    document.dispatchEvent(new CustomEvent('refreshUI'));
    document.getElementById("overwriteModal").style.display = "none";
    pendingUpload = null;
    alert("Bundle upload processed with selected overwrites.");
  }
  //Cancel Overwrite
  export function cancelOverwrite() {
    pendingUpload = null;
    document.getElementById("overwriteModal").style.display = "none";
    alert("Bundle upload cancelled for duplicates. New statblocks (non-duplicates) have been added.");
  }
  
  // --- Create Bundles --- //
  export function renderCreateBundleList(){
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
  // Render Bundle Contents List function for the Create Bundle Tab
  export function renderBundleList(){
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
  // Create Bundle Filters
  let bundleListFilters = {
    monsterName: "",
    level: "",
    role: "",
    tr: "",
    bundle: ""
  };
  // Update Bundle List Filters
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
  // Export Created Bundle
 export function downloadCurrentBundle(fmt){
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
  
  // --- Merge Bundles --- //
 export function mergeSelectedBundles(fmt){
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

