import { statblockComponents, favoritesMap, saveToLocalStorage, addStatblockComponent, deleteStatblockComponent } from './libraryData.mjs';
import { matchesStringQuery, parseDeedsStringNew } from './utilityFunctions.mjs';

// Global variables
let currentSortField = "name";
let currentSortDirection = "asc";
let filterName = "";
let filterType = "";
let currentFilteredComponents = [];
let selectedComponentID = null;

// Sort direction toggles
function setCurrentSortField(field) {
  currentSortField = field;
}

function setCurrentSortDirection(dir) {
  currentSortDirection = dir;
}

function toggleSortDirection() {
  currentSortDirection = currentSortDirection === "asc" ? "desc" : "asc";
}

// Render the preview for a selected component
function renderComponentPreview(component) {
  const defaultPreview = document.getElementById("defaultComponentPreview");
  const componentRender = document.getElementById("componentRender");
  
  if (!component) {
    defaultPreview.style.display = "block";
    componentRender.style.display = "none";
    return;
  }
  
  defaultPreview.style.display = "none";
  componentRender.style.display = "block";
  componentRender.innerHTML = "";
  
  // Add component ID information
  const idDiv = document.createElement("div");
  idDiv.className = "component-id-info";
  idDiv.textContent = `Component ID: ${component.componentID}`;
  componentRender.appendChild(idDiv);
  
  // Render based on component type
  if (component.type === "Feature") {
    renderFeatureComponent(component, componentRender);
  } else if (component.type && component.type.includes("Deed")) {
    renderDeedComponent(component, componentRender);
  } else {
    renderGenericComponent(component, componentRender);
  }
}

// Render a feature component
function renderFeatureComponent(component, container) {
  const yamlContent = component.yaml;
  const lines = yamlContent.split("\n");
  const title = lines[0];
  const content = lines.slice(1).join("\n");
  
  const featureDiv = document.createElement("div");
  featureDiv.classList.add("feature-preview");
  
  featureDiv.innerHTML = `
    <div class="statblock-section">
      <h3>Feature</h3>
      <div class="feature">
        <div style="margin-bottom: 10px; font-size: 0.9em;">
          <strong>${title}:</strong> ${content}
        </div>
      </div>
    </div>
  `;
  
  container.appendChild(featureDiv);
}

// Render a deed component
function renderDeedComponent(component, container) {
  const yamlContent = component.yaml;
  const lines = yamlContent.split("\n");
  const title = lines[0];
  const content = lines.slice(1);
  
  // Map component type to deed color
  const typeToColor = {
    "Light Deed": "light",
    "Heavy Deed": "heavy",
    "Mighty Deed": "mighty",
    "Tyrant Deed": "tyrant",
    "Special Deed": "special"
  };
  
  const color = typeToColor[component.type] || component.deedType || "light";
  
  // Create deed directly without the deed-compact wrapper
  const deedDiv = document.createElement("div");
  deedDiv.className = `deed ${color}`;
  
  // Build HTML content exactly like in statblockRender.mjs
  const cap = component.type.replace(" Deed", "");
  let html = `<div class="deed-header">${cap}</div>`;
  
  if(title) {
    html += `<div class="deed-title-output">${title.trim()}</div><hr class="deed-separator">`;
  }
  
  content.forEach(line => {
    if(line.trim()) {
      if(line.includes(":")) {
        const [lineTitle, lineContent] = line.split(":", 2);
        html += `<div class="line-indent" style="font-size:0.9em;"><strong>${lineTitle.trim()}:</strong> ${lineContent.trim()}</div>`;
      } else {
        html += `<div class="line-indent" style="font-size:0.9em;"><strong>${line.trim()}</strong></div>`;
      }
    }
  });
  
  deedDiv.innerHTML = html;
  container.appendChild(deedDiv);
}

// Render generic component
function renderGenericComponent(component, container) {
  const genericDiv = document.createElement("div");
  genericDiv.classList.add("generic-preview");
  
  genericDiv.innerHTML = `
    <div class="statblock-section">
      <h3>${component.type || "Component"}</h3>
      <div class="generic-content">
        <pre style="white-space: pre-wrap; font-family: inherit;">${component.yaml}</pre>
      </div>
    </div>
  `;
  
  container.appendChild(genericDiv);
}

// Render Components List
export function renderComponentsList() {
  const container = document.getElementById("componentsListContainer");
  if (!container) return;
  
  let focusedId = "";
  let selStart = 0, selEnd = 0;
  const activeEl = document.activeElement;
  if(activeEl && activeEl.tagName === "INPUT" && activeEl.id.startsWith("compSearch")){
    focusedId = activeEl.id;
    selStart = activeEl.selectionStart;
    selEnd = activeEl.selectionEnd;
  }
  
  container.innerHTML = "";
  
  // Create table with the same styling as library table
  const table = document.createElement("table");
  table.id = "componentsTable";
  
  // Create colgroup with column widths
  const colgroup = document.createElement("colgroup");
  
  // Favorites column
  const favCol = document.createElement("col");
  favCol.style.width = "30px";
  favCol.id = "col-comp-favorite";
  colgroup.appendChild(favCol);
  
  const columns = [
    { field: "name", width: 200, label: "Name" },
    { field: "type", width: 150, label: "Type" }
  ];
  
  columns.forEach(col => {
    const colEl = document.createElement("col");
    colEl.style.width = col.width + "px";
    colEl.id = "col-comp-" + col.field;
    colgroup.appendChild(colEl);
  });
  
  // Action column
  const actionCol = document.createElement("col");
  actionCol.style.width = "70px";
  actionCol.id = "col-comp-action";
  colgroup.appendChild(actionCol);
  
  table.appendChild(colgroup);
  
  // Create thead with header row and filter row
  const thead = document.createElement("thead");
  
  // Header row with sortable columns
  const headerRow = document.createElement("tr");
  
  // Favorites header
  const favTh = document.createElement("th");
  favTh.textContent = "⭐";
  favTh.addEventListener("click", () => {
    if (currentSortField === "favorite") {
      toggleSortDirection();
    } else {
      setCurrentSortField("favorite");
      setCurrentSortDirection("asc");
    }
    renderComponentsList();
  });
  headerRow.appendChild(favTh);
  
  // Other headers
  columns.forEach(col => {
    const th = document.createElement("th");
    th.textContent = col.label;
    th.dataset.field = col.field;
    th.addEventListener("click", () => {
      if (currentSortField === col.field) {
        toggleSortDirection();
      } else {
        setCurrentSortField(col.field);
        setCurrentSortDirection("asc");
      }
      renderComponentsList();
    });
    
    // Add sort indicator
    if (currentSortField === col.field) {
      th.textContent += currentSortDirection === "asc" ? " ▲" : " ▼";
    }
    
    headerRow.appendChild(th);
  });
  
  // Action header
  const actionTh = document.createElement("th");
  actionTh.textContent = "Action";
  headerRow.appendChild(actionTh);
  thead.appendChild(headerRow);
  
  // Filter row
  const filterRow = document.createElement("tr");
  
  // Empty cell for favorites column
  const favFilterTd = document.createElement("td");
  filterRow.appendChild(favFilterTd);
  
  // Filter inputs for each column
  columns.forEach(col => {
    const td = document.createElement("td");
    const input = document.createElement("input");
    input.type = "text";
    input.id = "compSearch" + col.field.charAt(0).toUpperCase() + col.field.slice(1);
    
    // Set current filter values
    if (col.field === "name") input.value = filterName;
    if (col.field === "type") input.value = filterType;
    
    input.style.width = "100%";
    input.addEventListener("input", function() {
      if (col.field === "name") filterName = this.value;
      if (col.field === "type") filterType = this.value;
      renderComponentsList();
    });
    td.appendChild(input);
    filterRow.appendChild(td);
  });
  
  // Filter action column with clear button
  const filterActionTd = document.createElement("td");
  const clearBtn = document.createElement("button");
  clearBtn.textContent = "Clear";
  clearBtn.className = "clear-filters-btn";
  clearBtn.addEventListener("click", () => {
    // Reset filter variables
    filterName = "";
    filterType = "";
    // Clear input values
    columns.forEach(col => {
      const input = document.getElementById("compSearch" + col.field.charAt(0).toUpperCase() + col.field.slice(1));
      if (input) input.value = "";
    });
    renderComponentsList();
  });
  filterActionTd.appendChild(clearBtn);
  filterRow.appendChild(filterActionTd);
  thead.appendChild(filterRow);
  table.appendChild(thead);
  
  // Filter components
  let filtered = statblockComponents.filter(comp => {
    const matchesName = matchesStringQuery(comp.name || "", filterName);
    const matchesType = matchesStringQuery(comp.type || "", filterType);
    return matchesName && matchesType;
  });
  
  // Sort components
  filtered.sort((a, b) => {
    if (currentSortField === "favorite") {
      const aFav = favoritesMap[a.id] || false;
      const bFav = favoritesMap[b.id] || false;
      
      // If favorite status is the same, sort by name
      if (aFav === bFav) {
        const aName = (a.name || "").toLowerCase();
        const bName = (b.name || "").toLowerCase();
        return aName.localeCompare(bName);
      }
      
      // Sort favorites based on direction
      return currentSortDirection === "asc" 
        ? (bFav ? 1 : -1) 
        : (bFav ? -1 : 1);
    } else {
      // Sort by name or type
      const aVal = (a[currentSortField] || "").toLowerCase();
      const bVal = (b[currentSortField] || "").toLowerCase();
      return currentSortDirection === "asc" 
        ? aVal.localeCompare(bVal) 
        : bVal.localeCompare(aVal);
    }
  });
  
  // Update the currentFilteredComponents
  currentFilteredComponents = filtered;
  
  // Display total count
  const totalElement = document.createElement("div");
  totalElement.className = "library-total-line";
  totalElement.innerHTML = `<span id="componentsTotal">Total: ${statblockComponents.length}</span>`;
  container.appendChild(totalElement);
  
  // Create tbody and populate with filtered components
  const tbody = document.createElement("tbody");
  
  if (filtered.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = columns.length + 2;
    td.innerHTML = "<p>No matching components found.</p>";
    tr.appendChild(td);
    tbody.appendChild(tr);
  } else {
    // Create a row for each component
    filtered.forEach((comp, index) => {
      const tr = document.createElement("tr");
      tr.id = `component-row-${comp.componentID}`; // Changed from comp.id
      if (comp.componentID === selectedComponentID) {
        tr.classList.add("selected");
      }
      tr.setAttribute("data-index", index);
      
      // Favorites cell
      const favTd = document.createElement("td");
      const starSpan = document.createElement("span");
      starSpan.textContent = favoritesMap[comp.id] ? "⭐" : "☆";
      starSpan.style.cursor = "pointer";
      starSpan.addEventListener("click", (e) => {
        e.stopPropagation();
        favoritesMap[comp.id] = !favoritesMap[comp.id];
        saveToLocalStorage();
        renderComponentsList();
      });
      favTd.appendChild(starSpan);
      tr.appendChild(favTd);
      
      // Name and Type cells
      columns.forEach(col => {
        const td = document.createElement("td");
        td.textContent = comp[col.field] || "";
        tr.appendChild(td);
      });
      
      // Action cell with delete button
      const actionTd = document.createElement("td");
      const deleteBtn = document.createElement("button");
      deleteBtn.textContent = "Delete";
      deleteBtn.className = "delete-stat-btn";
      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!confirm(`Delete component "${comp.name}"?`)) return;
        deleteStatblockComponent(comp.componentID); // Changed from comp.id
        
        // If the deleted component was selected, clear selection
        if (selectedComponentID === comp.componentID) { // Changed from comp.id
          selectedComponentID = null;
          // Clear the preview
          renderComponentPreview(null);
        }
        
        renderComponentsList();
      });
      actionTd.appendChild(deleteBtn);
      tr.appendChild(actionTd);
      
      // Click on row to select component and render preview
      tr.addEventListener("click", () => {
        selectedComponentID = comp.componentID; // Changed from comp.id
        const selectedComponent = statblockComponents.find(c => c.componentID === comp.componentID);
        renderComponentPreview(selectedComponent);
        renderComponentsList(); // Re-render to update the selection
      });
      
      tbody.appendChild(tr);
    });
  }
  
  table.appendChild(tbody);
  container.appendChild(table);
  
  // Restore focus if needed
  if (focusedId) {
    const newFocused = document.getElementById(focusedId);
    if (newFocused) {
      newFocused.focus();
      newFocused.setSelectionRange(selStart, selEnd);
    }
  }
  
  // Add keyboard navigation event listener
  container.addEventListener("keydown", handleKeyNavigation);
  
  // Render preview for selected component
  if (selectedComponentID) {
    const selectedComponent = statblockComponents.find(c => c.componentID === selectedComponentID);
    renderComponentPreview(selectedComponent);
  } else {
    renderComponentPreview(null);
  }
}

// Handle keyboard navigation
function handleKeyNavigation(e) {
  if (!currentFilteredComponents.length) return;
  
  let curIndex = -1;
  if (selectedComponentID) {
    curIndex = currentFilteredComponents.findIndex(comp => comp.id === selectedComponentID);
  }
  
  if (curIndex === -1) curIndex = 0;
  
  // Arrow up/down navigation
  if (e.key === "ArrowDown") {
    e.preventDefault();
    curIndex = Math.min(curIndex + 1, currentFilteredComponents.length - 1);
    selectedComponentID = currentFilteredComponents[curIndex].id;
    const selectedComponent = statblockComponents.find(c => c.id === selectedComponentID);
    renderComponentPreview(selectedComponent);
    renderComponentsList();
    ensureRowVisible("componentsTable", curIndex);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    curIndex = Math.max(curIndex - 1, 0);
    selectedComponentID = currentFilteredComponents[curIndex].id;
    const selectedComponent = statblockComponents.find(c => c.id === selectedComponentID);
    renderComponentPreview(selectedComponent);
    renderComponentsList();
    ensureRowVisible("componentsTable", curIndex);
  }
}

// Helper function to ensure selected row is visible
function ensureRowVisible(tableId, rowIndex) {
  const table = document.getElementById(tableId);
  if (!table) return;
  
  const tbody = table.querySelector("tbody");
  if (!tbody) return;
  
  const rows = tbody.querySelectorAll("tr");
  if (!rows.length || rowIndex >= rows.length) return;
  
  const selectedRow = rows[rowIndex];
  const container = document.getElementById("componentsListContainer");
  
  if (selectedRow && container) {
    // Calculate if the element is in view
    const containerRect = container.getBoundingClientRect();
    const rowRect = selectedRow.getBoundingClientRect();
    
    if (rowRect.top < containerRect.top) {
      // Scroll up if row is above visible area
      container.scrollTop -= (containerRect.top - rowRect.top);
    } else if (rowRect.bottom > containerRect.bottom) {
      // Scroll down if row is below visible area
      container.scrollTop += (rowRect.bottom - containerRect.bottom);
    }
  }
}