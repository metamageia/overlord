import { statblocks, favoritesMap, uploadedBundles, downloadBlob, statblockComponents, addStatblockComponent, saveToLocalStorage } from './libraryData.mjs';
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

// Global variable to store pending upload information
let pendingUpload = null;

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
// Update the renderUploadedBundles function to handle the new bundle format
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
    
    // Calculate total from statblocks and components with matching bundle ID
    const statblockCount = statblocks.filter(sb => sb.bundleId === bundle.id).length;
    const componentCount = statblockComponents.filter(comp => comp.bundleId === bundle.id).length;
    const totalCount = statblockCount + componentCount;
    
    // Set total property based on calculated counts
    bundle.total = totalCount;
    
    tdTotal.textContent = `${totalCount}`;
    
    const tdActive = document.createElement("td");
    const activeCheckbox = document.createElement("input");
    activeCheckbox.type = "checkbox";
    activeCheckbox.checked = bundle.active;
    activeCheckbox.addEventListener("change", () => {
      bundle.active = activeCheckbox.checked;
      saveToLocalStorage("bundles", uploadedBundles);      
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
        // Since we no longer have bundle.data, this button is now just for refreshing the UI
        document.dispatchEvent(new CustomEvent('saveLibraryChanges'));
        document.dispatchEvent(new CustomEvent('refreshUI'));
        alert(`Refreshed bundle display.`);
      }
    });
    const delBtn = document.createElement("button");
    delBtn.textContent = "Delete";
    delBtn.addEventListener("click", () => {
      if(confirm(`Delete bundle ${bundle.id}?`)){
        const bundleId = bundle.id;
        
        // Remove the bundle from uploadedBundles
        uploadedBundles.splice(idx, 1);
        saveToLocalStorage("bundles", uploadedBundles);

        // Remove statblocks with matching bundleId from the library
        const newStatblocks = statblocks.filter(sb => sb.bundleId !== bundleId);
        if (newStatblocks.length !== statblocks.length) {
          statblocks = newStatblocks;
          saveToLocalStorage("statblocks", statblocks);
        }
        
        // Remove components with matching bundleId from the library
        const newComponents = statblockComponents.filter(comp => comp.bundleId !== bundleId);
        if (newComponents.length !== statblockComponents.length) {
          statblockComponents.length = 0; // Clear the array
          newComponents.forEach(comp => statblockComponents.push(comp)); // Add filtered items back
          saveToLocalStorage("components", statblockComponents);
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
export async function handleUpload() {
  const fileInput = document.getElementById("uploadFile");
  if(!fileInput.files.length){
    alert("Please select a file to upload");
    return;
  }

  const file = fileInput.files[0];
  const text = await file.text();
  let uploaded = null;
  
  try {
    // Check if it's JSON format
    if (file.name.toLowerCase().endsWith('.json')) {
      uploaded = JSON.parse(text);
    } else {
      // Handle YAML format
      const documents = text.split(/^---$/m).filter(doc => doc.trim());
      
      uploaded = {
        statblocks: [],
        components: []
      };
      
      // Process each YAML document
      documents.forEach(doc => {
        const trimmedDoc = doc.trim();
        if (!trimmedDoc) return;
        
        try {
          const parsed = jsyaml.load(trimmedDoc);
          if (parsed && parsed.documentType === "component") {
            // This is a component
            const component = {
              componentID: parsed.componentID,
              name: parsed.name,
              type: parsed.type,
              yaml: parsed.yaml,
              bundleId: parsed.bundleId
            };
            uploaded.components.push(component);
          } else if (parsed) {
            // Assume it's a statblock if not explicitly a component
            uploaded.statblocks.push(parsed);
          }
        } catch (e) {
          console.error("Error parsing YAML document:", e);
        }
      });
    }
  } catch(e) {
    console.error("Error processing uploaded file:", e);
    alert(`Error processing file: ${e.message}`);
    return;
  }
  
  if(!uploaded){
    alert("Could not parse the uploaded file");
    return;
  }
  
  // Process statblocks
  let statblockCount = 0;
  let componentCount = 0;
  let bundleId = null;
  
  // Get bundle ID
  if (uploaded.statblocks && uploaded.statblocks.length) {
    bundleId = uploaded.statblocks[0].bundleId;
  } else if (uploaded.components && uploaded.components.length) {
    bundleId = uploaded.components[0].bundleId;
  }
  
  if (!bundleId) {
    bundleId = generateBundleID();
  }

  // Check for duplicate statblocks with proper structure
  const duplicates = [];
  
  // Check statblock duplicates
  if (uploaded.statblocks && uploaded.statblocks.length) {
    uploaded.statblocks.forEach(uploadedSb => {
      const existingSb = statblocks.find(sb => sb.statblockID === uploadedSb.statblockID);
      if (existingSb) {
        duplicates.push({
          uploaded: uploadedSb,
          existing: existingSb,
          type: 'statblock'
        });
      }
    });
  }
  
  // Check component duplicates
  if (uploaded.components && uploaded.components.length) {
    uploaded.components.forEach(uploadedComp => {
      const existingComp = statblockComponents.find(comp => comp.componentID === uploadedComp.componentID);
      if (existingComp) {
        duplicates.push({
          uploaded: {
            // Create a structure that matches what the modal expects
            monsterName: uploadedComp.name,
            statblockID: uploadedComp.componentID
          },
          existing: existingComp,
          type: 'component'
        });
      }
    });
  }
  
  if (duplicates.length > 0) {
    // Store the pending upload information
    pendingUpload = {
      bundleId: bundleId,
      duplicates: duplicates,
      uploaded: uploaded,
      fileName: file.name,
      finalBundleName: file.name.replace(/\.(json|yaml)$/i, "")
    };
    
    // Show the overwrite modal
    showOverwriteModal(duplicates);
    return;
  }
  
  // No duplicates, proceed with adding all items
  
  // Add statblocks
  if (uploaded.statblocks && uploaded.statblocks.length) {
    uploaded.statblocks.forEach(sb => {
      sb.bundleId = bundleId; // Ensure bundleId is set
      statblocks.push(sb);
      statblockCount++;
    });
  }
  
  // Add components
  if (uploaded.components && uploaded.components.length) {
    uploaded.components.forEach(comp => {
      comp.bundleId = bundleId; // Ensure bundleId is set
      addStatblockComponent(comp);
      componentCount++;
    });
  }
  
  // Create bundle entry
  const bundleName = file.name.replace(/\.(json|yaml)$/i, "");
  uploadedBundles.push({
    id: bundleId,
    bundleName: bundleName,
    active: true
  });
  
  // Save changes
  saveToLocalStorage("statblocks", statblocks);
  saveToLocalStorage("components", statblockComponents);
  saveToLocalStorage("bundles", uploadedBundles);
  
  // Display success message
  let message = "";
  if(statblockCount > 0) {
    message += `Added ${statblockCount} statblock${statblockCount !== 1 ? 's' : ''} to library. `;
  }
  if(componentCount > 0) {
    message += `Added ${componentCount} component${componentCount !== 1 ? 's' : ''} to library.`;
  }
  
  alert(message);
  
  // Reset file input
  fileInput.value = "";
  
  // Refresh UI
  renderUploadedBundles();
  document.dispatchEvent(new CustomEvent('refreshUI'));
}

// Existing modal functions remain unchanged
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

export function confirmOverwrite() {
  if (!pendingUpload) return;
  
  const checkboxes = document.querySelectorAll("#overwriteList input[type='checkbox']");
  const uploaded = pendingUpload.uploaded;
  const bundleId = pendingUpload.bundleId;
  
  let statblockCount = 0;
  let componentCount = 0;
  
  // Process the selected items to overwrite
  checkboxes.forEach(cb => {
    if (cb.checked) {
      const idx = parseInt(cb.dataset.index, 10);
      const dup = pendingUpload.duplicates[idx];
      
      if (dup.type === 'component') {
        // Handle component overwrite
        const compId = dup.existing.componentID;
        const compIdx = statblockComponents.findIndex(c => c.componentID === compId);
        
        if (compIdx !== -1) {
          // Remove existing component
          statblockComponents.splice(compIdx, 1);
        }
        
        // Find the uploaded component
        const uploadedComp = uploaded.components.find(c => c.componentID === dup.uploaded.statblockID);
        if (uploadedComp) {
          uploadedComp.bundleId = bundleId;
          statblockComponents.push(uploadedComp);
          componentCount++;
        }
      } else {
        // Handle statblock overwrite
        const sbId = dup.existing.statblockID;
        const sbIdx = statblocks.findIndex(s => s.statblockID === sbId);
        
        if (sbIdx !== -1) {
          // Remove existing statblock
          statblocks.splice(sbIdx, 1);
        }
        
        // Find the uploaded statblock
        const uploadedSb = uploaded.statblocks.find(s => s.statblockID === dup.uploaded.statblockID);
        if (uploadedSb) {
          uploadedSb.bundleId = bundleId;
          statblocks.push(uploadedSb);
          statblockCount++;
        }
      }
    }
  });
  
  // Add non-duplicate items
  
  // Add non-duplicate statblocks
  if (uploaded.statblocks) {
    uploaded.statblocks.forEach(sb => {
      if (!pendingUpload.duplicates.some(dup => dup.type !== 'component' && dup.uploaded.statblockID === sb.statblockID)) {
        sb.bundleId = bundleId;
        statblocks.push(sb);
        statblockCount++;
      }
    });
  }
  
  // Add non-duplicate components
  if (uploaded.components) {
    uploaded.components.forEach(comp => {
      if (!pendingUpload.duplicates.some(dup => dup.type === 'component' && dup.uploaded.statblockID === comp.componentID)) {
        comp.bundleId = bundleId;
        statblockComponents.push(comp);
        componentCount++;
      }
    });
  }
  
  // Create bundle entry
  uploadedBundles.push({
    id: bundleId,
    bundleName: pendingUpload.finalBundleName,
    active: true
  });
  
  // Save changes
  saveToLocalStorage("statblocks", statblocks);
  saveToLocalStorage("components", statblockComponents);
  saveToLocalStorage("bundles", uploadedBundles);
  
  document.getElementById("overwriteModal").style.display = "none";
  
  // Display success message
  let message = "";
  if(statblockCount > 0) {
    message += `Added ${statblockCount} statblock${statblockCount !== 1 ? 's' : ''} to library. `;
  }
  if(componentCount > 0) {
    message += `Added ${componentCount} component${componentCount !== 1 ? 's' : ''} to library.`;
  }
  
  alert(message);
  
  // Reset pending upload
  pendingUpload = null;
  
  // Refresh UI
  renderUploadedBundles();
  document.dispatchEvent(new CustomEvent('refreshUI'));
}

export function cancelOverwrite() {
  if (!pendingUpload) return;
  const uploaded = pendingUpload.uploaded;
  const bundleId = pendingUpload.bundleId;
  
  let statblockCount = 0;
  let componentCount = 0;
  
  // Only add non-duplicate statblocks
  if (uploaded.statblocks) {
    uploaded.statblocks.forEach(sb => {
      if (!pendingUpload.duplicates.some(dup => dup.type !== 'component' && dup.uploaded.statblockID === sb.statblockID)) {
        sb.bundleId = bundleId;
        statblocks.push(sb);
        statblockCount++;
      }
    });
  }
  
  // Only add non-duplicate components
  if (uploaded.components) {
    uploaded.components.forEach(comp => {
      if (!pendingUpload.duplicates.some(dup => dup.type === 'component' && dup.uploaded.statblockID === comp.componentID)) {
        comp.bundleId = bundleId;
        statblockComponents.push(comp);
        componentCount++;
      }
    });
  }
  
  // Create bundle entry if any items were added
  if (statblockCount > 0 || componentCount > 0) {
    uploadedBundles.push({
      id: bundleId,
      bundleName: pendingUpload.finalBundleName,
      active: true
    });
    
    // Save changes
    saveToLocalStorage("statblocks", statblocks);
    saveToLocalStorage("components", statblockComponents);
    saveToLocalStorage("bundles", uploadedBundles);
  }
  
  document.getElementById("overwriteModal").style.display = "none";
  
  // Display success message for non-duplicates
  let message = "";
  if(statblockCount > 0) {
    message += `Added ${statblockCount} non-duplicate statblock${statblockCount !== 1 ? 's' : ''} to library. `;
  }
  if(componentCount > 0) {
    message += `Added ${componentCount} non-duplicate component${componentCount !== 1 ? 's' : ''} to library.`;
  }
  if (statblockCount === 0 && componentCount === 0) {
    message = "No items added. All were duplicates.";
  }
  
  alert(message);
  
  // Reset pending upload
  pendingUpload = null;
  
  // Refresh UI
  renderUploadedBundles();
  document.dispatchEvent(new CustomEvent('refreshUI'));
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
    alert("No items in the bundle!");
    return;
  }
  
  // Generate a bundle ID
  const bundleId = generateBundleID(bundleList);
  
  // Separate components and statblocks
  const statblockItems = [];
  const componentItems = [];
  
  // Sort items into their respective arrays
  bundleList.forEach(item => {
    if (item.componentID !== undefined) {
      // This is a component - make a clean copy with required fields
      const componentCopy = {
        componentID: item.componentID,
        name: item.name,
        type: item.type || "Component",
        yaml: item.yaml,
        bundleId: bundleId
      };
      componentItems.push(componentCopy);
    } else {
      // This is a regular statblock - copy and add bundle ID
      const statblockCopy = Object.assign({}, item, { bundleId });
      statblockItems.push(statblockCopy);
    }
  });
  
  if(fmt === "json"){
    // For JSON format, create an object with separate arrays
    const bundleData = {
      bundleId: bundleId,
      statblocks: statblockItems,
      components: componentItems
    };
    
    const filename = "bundle-" + bundleId + ".json";
    downloadBlob(JSON.stringify(bundleData, null, 2), "application/json", filename);
  } else {
    // For YAML format
    let yamlContent = "";
    
    // Add statblocks with special comment to identify them
    if (statblockItems.length > 0) {
      yamlContent += "# BEGIN STATBLOCKS\n";
      statblockItems.forEach(sb => { 
        yamlContent += "---\n";
        yamlContent += "documentType: statblock\n"; // Add an identifier field
        yamlContent += jsyaml.dump(sb, { lineWidth: -1 }); 
      });
    }
    
    // Add components with special comment to identify them
    if (componentItems.length > 0) {
      yamlContent += "---\n# BEGIN COMPONENTS\n";
      componentItems.forEach(component => {
        yamlContent += "---\n";
        yamlContent += "documentType: component\n"; // Add an identifier field
        yamlContent += "componentID: " + component.componentID + "\n";
        yamlContent += "name: " + component.name + "\n";
        yamlContent += "type: " + component.type + "\n";
        yamlContent += "bundleId: " + component.bundleId + "\n";
        yamlContent += "yaml: |\n";
        
        // Indent the YAML content to preserve it as a literal block
        const indentedYaml = component.yaml.split('\n').map(line => "  " + line).join('\n');
        yamlContent += indentedYaml + "\n";
      });
    }
    
    // Clean up the YAML string
    yamlContent = yamlContent.trim();
    
    const filename = "bundle-" + bundleId + ".yaml";
    downloadBlob(yamlContent, "text/yaml", filename);
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

