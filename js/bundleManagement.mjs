import { statblocks, favoritesMap, uploadedBundles, downloadBlob, statblockComponents } from './libraryData.mjs';
import {generateStatblockID, generateBundleID,} from './idManagement.mjs';
import { matchesNumericQuery, matchesStringQuery } from './utilityFunctions.mjs';
import { currentSortDirection, currentSortField, setCurrentSortDirection, setCurrentSortField, toggleSortDirection } from "./libraryUtilities.mjs";


// Global filters for Create Bundle table
let cbFilterName = "";
let cbFilterLV = "";
let cbFilterRole = "";
let cbFilterTemplate = ""; 
let cbFilterTR = "";
let cbFilterBundle = "";
let cbFilterType = "";

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

// --- Manage Bundles --- //
export function renderUploadedBundles(){
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
      document.dispatchEvent(new CustomEvent('saveLibraryChanges'));      
      document.dispatchEvent(new CustomEvent('refreshUI'));
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
        document.dispatchEvent(new CustomEvent('saveLibraryChanges'));
        document.dispatchEvent(new CustomEvent('refreshUI'));
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
        document.dispatchEvent(new CustomEvent('saveLibraryChanges'));

        // Remove statblocks with matching bundleId from the library
        statblocks = statblocks.filter(sb => sb.bundleId !== bundleId);
        saveToLocalStorage();
        
        // Clear current selection if it was from the deleted bundle
        if(currentDetail && currentDetail.bundleId === bundleId) {
          currentDetail = null;
          selectedStatblockID = null;
          renderDefaultDetail();
        }
        
        document.dispatchEvent(new CustomEvent('refreshUI'));
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
    container.innerHTML = "";
    const table = document.createElement("table");
    table.id = "createBundleTable";
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
      { field: "type",        width: 80 },  // Add Type column
      { field: "template",    width: 100 },
      { field: "tr",          width: 50 },
      { field: "bundle",      width: 100 }
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
    
    // Checkbox header cell
    const checkTh = document.createElement("th");
    const selectAllCb = document.createElement("input");
    selectAllCb.type = "checkbox";
    selectAllCb.id = "selectAllCb";
    selectAllCb.addEventListener("change", function(){
      const checkboxes = document.querySelectorAll("#createBundleTable tbody input[type='checkbox']");
      checkboxes.forEach(cb => cb.checked = this.checked);
    });
    checkTh.appendChild(selectAllCb);
    headerRow.appendChild(checkTh);
    
    const columns = [
      { field: "monsterName", label: "Name" },
      { field: "level",       label: "LV" },
      { field: "role",        label: "Role" },
      { field: "type",        label: "Type" }, // Add Type column
      { field: "template",    label: "Template" },
      { field: "tr",          label: "TR" },
      { field: "bundle",      label: "Bundle" }
    ];
    
    columns.forEach(col => {
      const th = document.createElement("th");
      th.textContent = col.label;
      th.style.cursor = "pointer";
      
      // Add sort indicator if this is the currently sorted column
      if (currentSortField === col.field) {
        th.textContent += currentSortDirection === "asc" ? " ▲" : " ▼";
      }
      
      // Add click handler for sorting
      th.addEventListener("click", () => {
        if (currentSortField === col.field) {
          toggleSortDirection();
        } else {
          setCurrentSortField(col.field);
          setCurrentSortDirection("asc");
        }
        renderCreateBundleList();
      });
      
      headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    
    // Filter row
    const filterRow = document.createElement("tr");
    const checkFilterTd = document.createElement("td");
    filterRow.appendChild(checkFilterTd);
    
    columns.forEach(col => {
      const td = document.createElement("td");
      const input = document.createElement("input");
      input.type = "text";
      input.id = "cbSearch" + col.field.charAt(0).toUpperCase() + col.field.slice(1);
      
      // Set current filter value
      switch(col.field) {
        case "monsterName": input.value = cbFilterName; break;
        case "level": input.value = cbFilterLV; break;
        case "role": input.value = cbFilterRole; break;
        case "type": input.value = cbFilterType; break; // Add Type filter
        case "template": input.value = cbFilterTemplate; break;
        case "tr": input.value = cbFilterTR; break;
        case "bundle": input.value = cbFilterBundle; break;
      }
      
      input.style.width = "100%";
      input.addEventListener("input", function(){
        // Update filter values
        switch(col.field) {
          case "monsterName": cbFilterName = this.value; break;
          case "level": cbFilterLV = this.value; break;
          case "role": cbFilterRole = this.value; break;
          case "type": cbFilterType = this.value; break; // Add Type filter
          case "template": cbFilterTemplate = this.value; break;
          case "tr": cbFilterTR = this.value; break;
          case "bundle": cbFilterBundle = this.value; break;
        }
        renderCreateBundleList();
      });
      td.appendChild(input);
      filterRow.appendChild(td);
    });
    
    // Clear button
    const clearBtn = document.createElement("button");
    clearBtn.textContent = "Clear";
    clearBtn.className = "clear-filters-btn";
    clearBtn.addEventListener("click", () => {
      // Reset filter variables
      cbFilterName = "";
      cbFilterLV = "";
      cbFilterRole = "";
      cbFilterType = ""; // Add Type filter reset
      cbFilterTemplate = "";
      cbFilterTR = "";
      cbFilterBundle = "";
      
      // Reset input values
      columns.forEach(col => {
        const input = document.getElementById("cbSearch" + col.field.charAt(0).toUpperCase() + col.field.slice(1));
        if(input) input.value = "";
      });
      
      renderCreateBundleList();
    });
    
    const clearTd = document.createElement("td");
    clearTd.appendChild(clearBtn);
    filterRow.appendChild(clearTd);
    thead.appendChild(filterRow);
    table.appendChild(thead);
    
    // Combine statblocks and components into one array
    const combinedItems = [
      ...statblocks.map(sb => ({ ...sb, type: "statblock" })),
      ...statblockComponents.map(comp => ({
        statblockID: comp.componentID,
        monsterName: comp.name,
        type: comp.type || "Component",
        // Other fields might be empty for components
        level: "",
        role: "",
        template: "",
        tr: "",
        bundleId: comp.bundleId
      }))
    ];
    
    // Filter the combined items
    let filtered = combinedItems.filter(item => {
      const matchesName = matchesStringQuery(item.monsterName || "", cbFilterName);
      const matchesRole = matchesStringQuery(item.role || "", cbFilterRole);
      const matchesTemplate = matchesStringQuery(item.template || "", cbFilterTemplate);
      const matchesLV = matchesNumericQuery(item.level, cbFilterLV);
      const matchesTR = matchesNumericQuery(item.tr, cbFilterTR);
      const matchesBundle = matchesStringQuery(getBundleName(item.bundleId), cbFilterBundle);
      const matchesType = matchesStringQuery(item.type || "statblock", cbFilterType);
      
      return matchesName && matchesRole && matchesTemplate && matchesLV && matchesTR && matchesBundle && matchesType;
    });
    
    // Filter out inactive bundle items
    filtered = filtered.filter(item => {
      if(item.bundleId === undefined) return true;
      let bun = uploadedBundles.find(x => x.id === item.bundleId);
      return bun && bun.active;
    });
    
    // Sort filtered items - Fix to use imported sort variables
    filtered.sort((a, b) => {
      if(currentSortField === "level" || currentSortField === "tr") {
        const numA = parseInt(String(a?.[currentSortField] || 0));
        const numB = parseInt(String(b?.[currentSortField] || 0));
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
      td.innerHTML = "<p>No matching items found.</p>";
      tr.appendChild(td);
      tbody.appendChild(tr);
    } else {
      filtered.forEach(item => {
        const tr = document.createElement("tr");
        
        // Checkbox cell
        const checkTd = document.createElement("td");
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.dataset.id = item.statblockID;
        checkTd.appendChild(cb);
        tr.appendChild(checkTd);
        
        // Data cells
        columns.forEach(ci => {
          const td = document.createElement("td");
          if (ci.field === "bundle") {
            td.textContent = getBundleName(item.bundleId) || "";
          } else if (ci.field === "type") {
            // Display type field
            td.textContent = item.type || "statblock";
          } else {
            td.textContent = item[ci.field] || "";
          }
          tr.appendChild(td);
        });
        
        // Add click handler to add item to bundle
        tr.addEventListener("click", (e) => {
          // Don't trigger if they clicked the checkbox
          if (e.target.type === "checkbox") return;
          
          // Find the item in the original arrays
          let itemToAdd;
          if (item.type === "statblock") {
            itemToAdd = statblocks.find(sb => sb.statblockID === item.statblockID);
          } else {
            // For components
            itemToAdd = statblockComponents.find(comp => comp.componentID === item.statblockID);
          }
          
          // Add to bundle if not already there
          if (itemToAdd && !bundleList.some(bundleItem => bundleItem.statblockID === itemToAdd.statblockID)) {
            bundleList.push(itemToAdd);
            renderBundleList();
          }
        });
        
        tbody.appendChild(tr);
      });
    }
    
    table.appendChild(tbody);
    container.appendChild(table);
  }
  // Render Bundle Contents List function for the Create Bundle Tab
  export function renderBundleList() {
  const container = document.getElementById("bundleListContainer");
  container.innerHTML = "";
  
  if (bundleList.length === 0) {
    container.innerHTML = "<p>No items added to bundle yet.</p>";
    return;
  }
  
  const table = document.createElement("table");
  table.id = "bundleListTable"; // Fix: Use the original table ID that CSS expects
  
  // Create column group for styling
  const colgroup = document.createElement("colgroup");
  
  // Favorites column (30px)
  const favCol = document.createElement("col");
  favCol.style.width = "30px";
  favCol.id = "bcol-favorite";
  colgroup.appendChild(favCol);
  
  const cols = [
    { field: "monsterName", width: 150 },
    { field: "level", width: 50 },
    { field: "role", width: 100 },
    { field: "type", width: 80 }, // Add Type column
    { field: "template", width: 80 },
    { field: "tr", width: 50 },
    { field: "bundle", width: 120 },
    { field: "action", width: 50 }
  ];
  
  cols.forEach(col => {
    const colEl = document.createElement("col");
    colEl.style.width = col.width + "px";
    colEl.id = "bcol-" + col.field;
    colgroup.appendChild(colEl);
  });
  
  table.appendChild(colgroup);
  
  // Create header
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  
  // Favorites header
  const favTh = document.createElement("th");
  favTh.textContent = "⭐";
  headerRow.appendChild(favTh);
  
  // Add other headers
  ["Name", "LV", "Role", "Type", "Template", "TR", "Bundle", "Action"].forEach(text => {
    const th = document.createElement("th");
    th.textContent = text;
    headerRow.appendChild(th);
  });
  
  thead.appendChild(headerRow);
  table.appendChild(thead);
  
  // Create table body
  const tbody = document.createElement("tbody");
  
  // Add rows for each item in bundle
  bundleList.forEach((sb, index) => {
    const tr = document.createElement("tr");
    
    // Determine if this is a component or a statblock
    const isComponent = sb.componentID !== undefined;
    const itemId = isComponent ? sb.componentID : sb.statblockID;
    
    // Favorite cell
    const tdFav = document.createElement("td");
    const favStar = document.createElement("span");
    favStar.className = "favorite-star " + (favoritesMap[itemId] ? "favorited" : "");
    favStar.innerHTML = favoritesMap[itemId] ? "★" : "☆";
    favStar.addEventListener("click", function() {
      if (favoritesMap[itemId]) {
        delete favoritesMap[itemId];
        this.innerHTML = "☆";
        this.classList.remove("favorited");
      } else {
        favoritesMap[itemId] = true;
        this.innerHTML = "★";
        this.classList.add("favorited");
      }
      saveToLocalStorage("favorites", favoritesMap);
    });
    
    tdFav.appendChild(favStar);
    tr.appendChild(tdFav);
    
    // Name cell
    const tdName = document.createElement("td");
    tdName.textContent = isComponent ? (sb.name || "") : (sb.monsterName || "");
    tr.appendChild(tdName);
    
    // Level cell
    const tdLV = document.createElement("td");
    tdLV.textContent = isComponent ? "" : (sb.level || "");
    tr.appendChild(tdLV);
    
    // Role cell
    const tdRole = document.createElement("td");
    tdRole.textContent = isComponent ? "" : (sb.role || "");
    tr.appendChild(tdRole);
    
    // Type cell
    const tdType = document.createElement("td");
    tdType.textContent = isComponent ? (sb.type || "Component") : "statblock";
    tr.appendChild(tdType);
    
    // Template cell
    const tdTemplate = document.createElement("td");
    tdTemplate.textContent = isComponent ? "" : (sb.template || "");
    tr.appendChild(tdTemplate);
    
    // TR cell
    const tdTR = document.createElement("td");
    tdTR.textContent = isComponent ? "" : (sb.tr || "");
    tr.appendChild(tdTR);
    
    // Bundle cell
    const tdBundle = document.createElement("td");
    tdBundle.textContent = getBundleName(sb.bundleId) || "";
    tr.appendChild(tdBundle);
    
    // Action cell with remove button
    const tdAction = document.createElement("td");
    const removeBtn = document.createElement("button");
    removeBtn.textContent = "✕";
    removeBtn.className = "remove-btn";
    removeBtn.addEventListener("click", function() {
      bundleList.splice(index, 1);
      renderBundleList();
    });
    
    tdAction.appendChild(removeBtn);
    tr.appendChild(tdAction);
    
    tbody.appendChild(tr);
  });
  
  table.appendChild(tbody);
  container.appendChild(table);
  
  // Update count display
  const countDisplay = document.getElementById("bundleItemCount");
  if (countDisplay) {
    countDisplay.textContent = bundleList.length;
  }
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
// Bundle Merge Selection
export function fillManageMergeSelect(){
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

