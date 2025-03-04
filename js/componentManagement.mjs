import { statblockComponents, favoritesMap, saveToLocalStorage, addStatblockComponent, deleteStatblockComponent } from './libraryData.mjs';
import { matchesStringQuery, parseDeedsStringNew } from './utilityFunctions.mjs';
import { masterYamlData, updateMasterYamlData } from './yamlDataState.mjs';
import { updateUIFromMasterYaml, updateMasterYamlDataFromUI } from './masterYamlData.mjs';

// Global variables
let currentSortField = "name";
let currentSortDirection = "asc";
let filterName = "";
let filterType = "";
let currentFilteredComponents = [];
// Replace single selection with a Set to track multiple selections
let selectedComponentIDs = new Set();

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


// Updated to render previews for multiple components
// Updated to render a combined statblock preview for multiple components
function renderComponentPreview(components) {
  const defaultPreview = document.getElementById("defaultComponentPreview");
  const componentRender = document.getElementById("componentRender");
  
  if (!components || components.length === 0) {
    defaultPreview.style.display = "block";
    componentRender.style.display = "none";
    return;
  }
  
  defaultPreview.style.display = "none";
  componentRender.style.display = "block";
  componentRender.innerHTML = "";
  
  // Group components by type
  const groupedComponents = {
    features: components.filter(c => c.type === "Feature"),
    deeds: components.filter(c => c.type && c.type.includes("Deed")),
    other: components.filter(c => c.type !== "Feature" && (!c.type || !c.type.includes("Deed")))
  };
  
  // Show selection count
  const countDiv = document.createElement("div");
  countDiv.className = "component-selection-info";
  countDiv.textContent = `${components.length} component${components.length > 1 ? 's' : ''} selected`;
  componentRender.appendChild(countDiv);
  
  // Create statblock container
  const statblockContainer = document.createElement("div");
  statblockContainer.className = "statblock-container preview-statblock";
  
  // Add Features section if there are any features
  if (groupedComponents.features.length > 0) {
    const featuresSection = document.createElement("div");
    featuresSection.className = "statblock-section";
    featuresSection.innerHTML = "<h3>Features</h3>";
    
    const featuresContainer = document.createElement("div");
    featuresContainer.className = "features";
    
    groupedComponents.features.forEach(component => {
      const yamlContent = component.yaml;
      const lines = yamlContent.split("\n");
      const title = lines[0];
      const content = lines.slice(1).join("\n");
      
      const featureDiv = document.createElement("div");
      featureDiv.className = "feature";
      featureDiv.innerHTML = `
        <div style="margin-bottom: 10px; font-size: 0.9em;">
          <strong>${title}:</strong> ${content}
        </div>
      `;
      featuresContainer.appendChild(featureDiv);
    });
    
    featuresSection.appendChild(featuresContainer);
    statblockContainer.appendChild(featuresSection);
  }
  
  // Add Deeds section if there are any deeds
  if (groupedComponents.deeds.length > 0) {
    const deedsSection = document.createElement("div");
    deedsSection.className = "statblock-section";
    deedsSection.innerHTML = "<h3>Deeds</h3>";
    
    const deedsContainer = document.createElement("div");
    deedsContainer.className = "deeds";
    
    // Process and render each deed component properly
    groupedComponents.deeds.forEach(component => {
      try {
        // Map component type to deed color
        const typeToColor = {
          "Light Deed": "light",
          "Heavy Deed": "heavy",
          "Mighty Deed": "mighty",
          "Tyrant Deed": "tyrant",
          "Special Deed": "special"
        };
        
        let color = typeToColor[component.type] || component.deedType || "light";
        if (typeof color !== "string") color = "light";
        color = color.toLowerCase();
        
        // Parse deed content
        const parsedDeeds = parseDeedsStringNew(component.yaml);
        
        // Render each parsed deed
        parsedDeeds.forEach(deed => {
          const deedDiv = document.createElement("div");
          deedDiv.className = `deed ${color}`;
          
          // Build HTML similar to statblockRender.mjs
          const cap = color.charAt(0).toUpperCase() + color.slice(1);
          let html = `<div class="deed-header">${cap}</div>`;
          
          if (deed.title) {
            html += `<div class="deed-title-output">${deed.title.trim()}</div><hr class="deed-separator">`;
          }
          
          if (deed.lines && deed.lines.length) {
            deed.lines.forEach(line => {
              if (line.title) {
                html += `<div class="line-indent" style="font-size:0.9em;">`;
                if (line.content) {
                  html += `<strong>${line.title}:</strong> ${line.content}`;
                } else {
                  html += `<strong>${line.title}</strong>`;
                }
                html += `</div>`;
              }
            });
          }
          
          deedDiv.innerHTML = html;
          deedsContainer.appendChild(deedDiv);
        });
      } catch (e) {
        console.error("Error rendering deed:", e);
        // Fallback for rendering in case of error
        const deedDiv = document.createElement("div");
        deedDiv.className = "deed light";
        deedDiv.innerHTML = `
          <div class="deed-header">Error</div>
          <div class="deed-title-output">Error rendering deed</div>
          <hr class="deed-separator">
          <div class="line-indent" style="font-size:0.9em;"><pre>${component.yaml}</pre></div>
        `;
        deedsContainer.appendChild(deedDiv);
      }
    });
    
    deedsSection.appendChild(deedsContainer);
    statblockContainer.appendChild(deedsSection);
  }
  
  // Add other components if any
  if (groupedComponents.other.length > 0) {
    const otherSection = document.createElement("div");
    otherSection.className = "statblock-section";
    otherSection.innerHTML = "<h3>Other Components</h3>";
    
    groupedComponents.other.forEach(component => {
      const componentDiv = document.createElement("div");
      componentDiv.className = "other-component";
      
      const header = document.createElement("h4");
      header.textContent = component.name || component.type || "Component";
      componentDiv.appendChild(header);
      
      const content = document.createElement("div");
      content.className = "other-content";
      content.innerHTML = `<pre style="white-space: pre-wrap; font-family: inherit;">${component.yaml}</pre>`;
      componentDiv.appendChild(content);
      
      otherSection.appendChild(componentDiv);
    });
    
    statblockContainer.appendChild(otherSection);
  }
  
  // Add the statblock to the render area
  componentRender.appendChild(statblockContainer);
  
  // Add Apply Components button
  const applyBtn = document.createElement("button");
  applyBtn.textContent = `Apply ${components.length} Component${components.length > 1 ? 's' : ''}`;
  applyBtn.className = "action-btn apply-component-btn";
  applyBtn.addEventListener("click", () => applyComponentsToStatblock(components));
  
  // Create container for button
  const btnContainer = document.createElement("div");
  btnContainer.className = "component-action-buttons";
  btnContainer.appendChild(applyBtn);
  
  componentRender.appendChild(btnContainer);
}
// Updated to apply multiple components
function applyComponentsToStatblock(components) {
  if (!components || components.length === 0) return;
  
  try {
    // Get current data from UI first
    updateMasterYamlDataFromUI();
    
    // Apply all components
    components.forEach(component => {
      // Apply component based on its type
      if (component.type === "Feature") {
        applyFeatureComponent(component);
      } else if (component.type && component.type.includes("Deed")) {
        applyDeedComponent(component);
      }
    });
    
    // Update UI with new data
    updateUIFromMasterYaml();
    document.dispatchEvent(new CustomEvent('refreshUI'));
    alert(`Applied ${components.length} component${components.length > 1 ? 's' : ''} to the current statblock!`);
  } catch (error) {
    console.error("Error applying components:", error);
    alert("Failed to apply components: " + error.message);
  }
}

// Backward compatibility function
function applyComponentToStatblock(component) {
  applyComponentsToStatblock([component]);
}

// Function to apply a feature component
function applyFeatureComponent(component) {
  const yamlContent = component.yaml || "";
  const lines = yamlContent.split("\n");
  const title = lines[0];
  const content = lines.slice(1).join("\n");
  
  // Initialize features object if it doesn't exist
  if (!masterYamlData.features) {
    masterYamlData.features = {};
  }
  
  // Add the feature
  if (title && content) {
    masterYamlData.features[title] = content;
  }
}

// Function to apply a deed component
function applyDeedComponent(component) {
  // Determine deed type from component.type or component.deedType
  let deedType = (component.deedType || "").toLowerCase();
  
  if (!deedType && component.type) {
    const typeString = component.type.toLowerCase();
    if (typeString.includes("light")) deedType = "light";
    else if (typeString.includes("heavy")) deedType = "heavy";
    else if (typeString.includes("mighty")) deedType = "mighty";
    else if (typeString.includes("tyrant")) deedType = "tyrant";
    else if (typeString.includes("special")) deedType = "special";
  }
  
  if (!deedType) return; // Can't determine deed type
  
  // Map deed type to property name
  const deedPropertyMap = {
    "light": "lightDeeds",
    "heavy": "heavyDeeds",
    "mighty": "mightyDeeds",
    "tyrant": "tyrantDeeds",
    "special": "specialDeeds"
  };
  
  const propertyName = deedPropertyMap[deedType];
  if (!propertyName) return;
  
  // Get existing deeds or initialize empty string
  let existingDeeds = masterYamlData[propertyName] || "";
  
  // Add the deed content
  const deedContent = component.yaml || "";
  if (deedContent) {
    // Add a separator if needed
    if (existingDeeds && !existingDeeds.endsWith("\n")) {
      existingDeeds += "\n";
    }
    
    // Append the deed content
    masterYamlData[propertyName] = existingDeeds + deedContent;
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

// Update rendering function to include checkboxes for selection
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
  
  // Selection column
  const selCol = document.createElement("col");
  selCol.style.width = "30px";
  selCol.id = "col-comp-select";
  colgroup.appendChild(selCol);
  
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
  
  // Selection header (checkbox)
  const selTh = document.createElement("th");
  selTh.textContent = "";
  headerRow.appendChild(selTh);
  
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
  
  // Empty cell for selection column
  const selFilterTd = document.createElement("td");
  filterRow.appendChild(selFilterTd);
  
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
      const aFav = favoritesMap[a.componentID] || false;
      const bFav = favoritesMap[b.componentID] || false;
      
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
  totalElement.innerHTML = `<span id="componentsTotal">Total: ${statblockComponents.length}</span>
                            <span id="componentsSelected">Selected: ${selectedComponentIDs.size}</span>`;
  container.appendChild(totalElement);
  
  // Create tbody and populate with filtered components
  const tbody = document.createElement("tbody");
  
  if (filtered.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = columns.length + 3; // +3 for selection, favorites and action columns
    td.innerHTML = "<p>No matching components found.</p>";
    tr.appendChild(td);
    tbody.appendChild(tr);
  } else {
    // Create a row for each component
    filtered.forEach((comp, index) => {
      const tr = document.createElement("tr");
      tr.id = `component-row-${comp.componentID}`;
      if (selectedComponentIDs.has(comp.componentID)) {
        tr.classList.add("selected");
      }
      tr.setAttribute("data-index", index);
      
      // Selection cell with checkbox
      const selTd = document.createElement("td");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = selectedComponentIDs.has(comp.componentID);
      checkbox.addEventListener("change", (e) => {
        e.stopPropagation();
        if (checkbox.checked) {
          selectedComponentIDs.add(comp.componentID);
        } else {
          selectedComponentIDs.delete(comp.componentID);
        }
        updateComponentsPreview();
        renderComponentsList();
      });
      selTd.appendChild(checkbox);
      tr.appendChild(selTd);
      
      // Favorites cell
      const favTd = document.createElement("td");
      const starSpan = document.createElement("span");
      starSpan.textContent = favoritesMap[comp.componentID] ? "⭐" : "☆";
      starSpan.style.cursor = "pointer";
      starSpan.addEventListener("click", (e) => {
        e.stopPropagation();
        favoritesMap[comp.componentID] = !favoritesMap[comp.componentID];
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
        
        // If component is selected, remove from selection
        if (selectedComponentIDs.has(comp.componentID)) {
          selectedComponentIDs.delete(comp.componentID);
        }
        
        deleteStatblockComponent(comp.componentID);
        updateComponentsPreview();
        renderComponentsList();
      });
      actionTd.appendChild(deleteBtn);
      tr.appendChild(actionTd);
      
      // Click on row to toggle selection
      tr.addEventListener("click", (e) => {
        if (e.target.type !== 'checkbox' && !e.target.closest('button')) {
          checkbox.checked = !checkbox.checked;
          if (checkbox.checked) {
            selectedComponentIDs.add(comp.componentID);
          } else {
            selectedComponentIDs.delete(comp.componentID);
          }
          updateComponentsPreview();
          renderComponentsList();
        }
      });
      
      tbody.appendChild(tr);
    });
  }
  
  table.appendChild(tbody);
  container.appendChild(table);
  
  // MOVED: Add selection actions buttons below the table
  const selectionActions = document.createElement("div");
  selectionActions.className = "selection-actions";
  
  const selectAllBtn = document.createElement("button");
  selectAllBtn.textContent = "Select All";
  selectAllBtn.className = "inline-btn";
  selectAllBtn.addEventListener("click", () => {
    currentFilteredComponents.forEach(comp => {
      selectedComponentIDs.add(comp.componentID);
    });
    updateComponentsPreview();
    renderComponentsList();
  });
  
  const clearSelectionBtn = document.createElement("button");
  clearSelectionBtn.textContent = "Clear Selection";
  clearSelectionBtn.className = "inline-btn";
  clearSelectionBtn.addEventListener("click", () => {
    selectedComponentIDs.clear();
    updateComponentsPreview();
    renderComponentsList();
  });
  
  selectionActions.appendChild(selectAllBtn);
  selectionActions.appendChild(clearSelectionBtn);
  container.appendChild(selectionActions);
  
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
  
  // Update preview for selected components
  updateComponentsPreview();
}

// Helper function to update the preview based on selected components
function updateComponentsPreview() {
  if (selectedComponentIDs.size > 0) {
    const selectedComponents = statblockComponents.filter(c => selectedComponentIDs.has(c.componentID));
    renderComponentPreview(selectedComponents);
  } else {
    renderComponentPreview(null);
  }
}

// Updated keyboard navigation to toggle selection instead of single select
function handleKeyNavigation(e) {
  if (!currentFilteredComponents.length) return;
  
  // Find the first selected component index
  let curIndex = -1;
  if (selectedComponentIDs.size > 0) {
    for (let i = 0; i < currentFilteredComponents.length; i++) {
      if (selectedComponentIDs.has(currentFilteredComponents[i].componentID)) {
        curIndex = i;
        break;
      }
    }
  }
  
  if (curIndex === -1) curIndex = 0;
  
  // Arrow up/down navigation
  if (e.key === "ArrowDown") {
    e.preventDefault();
    curIndex = Math.min(curIndex + 1, currentFilteredComponents.length - 1);
    const comp = currentFilteredComponents[curIndex];
    
    // If holding shift, add to selection, otherwise toggle single selection
    if (e.shiftKey) {
      selectedComponentIDs.add(comp.componentID);
    } else {
      selectedComponentIDs.clear();
      selectedComponentIDs.add(comp.componentID);
    }
    
    updateComponentsPreview();
    renderComponentsList();
    ensureRowVisible("componentsTable", curIndex);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    curIndex = Math.max(curIndex - 1, 0);
    const comp = currentFilteredComponents[curIndex];
    
    // If holding shift, add to selection, otherwise toggle single selection
    if (e.shiftKey) {
      selectedComponentIDs.add(comp.componentID);
    } else {
      selectedComponentIDs.clear();
      selectedComponentIDs.add(comp.componentID);
    }
    
    updateComponentsPreview();
    renderComponentsList();
    ensureRowVisible("componentsTable", curIndex);
  } else if (e.key === "a" && (e.ctrlKey || e.metaKey)) {
    // Ctrl+A / Cmd+A to select all
    e.preventDefault();
    currentFilteredComponents.forEach(comp => {
      selectedComponentIDs.add(comp.componentID);
    });
    updateComponentsPreview();
    renderComponentsList();
  } else if (e.key === "Escape") {
    // Escape to clear selection
    e.preventDefault();
    selectedComponentIDs.clear();
    updateComponentsPreview();
    renderComponentsList();
  }
}

// Helper function to ensure selected row is visible (unchanged)
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