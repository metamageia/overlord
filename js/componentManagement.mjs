import { statblockComponents, favoritesMap, saveToLocalStorage, addStatblockComponent, deleteStatblockComponent } from './libraryData.mjs';
import { matchesStringQuery } from './utilityFunctions.mjs';

// Global variables
let currentSortField = "name";
let currentSortDirection = "asc";
let filterName = "";
let filterType = "";

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

// Render Components List
export function renderComponentsList() {
  const container = document.getElementById("componentsListContainer");
  if (!container) return;
  
  container.innerHTML = "";
  
  if (statblockComponents.length === 0) {
    container.innerHTML = "<p>No components available.</p>";
    return;
  }
  
  // Create table with the same styling as other tables
  const table = document.createElement("table");
  table.id = "componentsListTable";
  
  // Create colgroup with column widths
  const colgroup = document.createElement("colgroup");
  const columns = [
    { field: "favorite", width: 30 },
    { field: "name", width: 150, label: "Name" },
    { field: "type", width: 100, label: "Type" },
    { field: "action", width: 70, label: "Action" }
  ];
  
  columns.forEach(col => {
    const colEl = document.createElement("col");
    colEl.style.width = col.width + "px";
    colgroup.appendChild(colEl);
  });
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
  ["Name", "Type", "Action"].forEach((text, index) => {
    const th = document.createElement("th");
    th.textContent = text;
    
    // Make columns sortable (except the Action column)
    if (index < 2) {
      const field = index === 0 ? "name" : "type";
      th.addEventListener("click", () => {
        if (currentSortField === field) {
          toggleSortDirection();
        } else {
          setCurrentSortField(field);
          setCurrentSortDirection("asc");
        }
        renderComponentsList();
      });
    }
    
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  
  // Filter row
  const filterRow = document.createElement("tr");
  
  // Empty cell for favorites column
  const favFilterTd = document.createElement("td");
  filterRow.appendChild(favFilterTd);
  
  // Name filter
  const nameFilterTd = document.createElement("td");
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.value = filterName;
  nameInput.style.width = "100%";
  nameInput.addEventListener("input", function() {
    filterName = this.value;
    renderComponentsList();
  });
  nameFilterTd.appendChild(nameInput);
  filterRow.appendChild(nameFilterTd);
  
  // Type filter
  const typeFilterTd = document.createElement("td");
  const typeInput = document.createElement("input");
  typeInput.type = "text";
  typeInput.value = filterType;
  typeInput.style.width = "100%";
  typeInput.addEventListener("input", function() {
    filterType = this.value;
    renderComponentsList();
  });
  typeFilterTd.appendChild(typeInput);
  filterRow.appendChild(typeFilterTd);
  
  // Clear filters button
  const actionFilterTd = document.createElement("td");
  const clearBtn = document.createElement("button");
  clearBtn.textContent = "Clear";
  clearBtn.className = "clear-filters-btn";
  clearBtn.addEventListener("click", () => {
    filterName = "";
    filterType = "";
    nameInput.value = "";
    typeInput.value = "";
    renderComponentsList();
  });
  actionFilterTd.appendChild(clearBtn);
  filterRow.appendChild(actionFilterTd);
  
  thead.appendChild(filterRow);
  table.appendChild(thead);
  
  // Create tbody and populate with filtered components
  const tbody = document.createElement("tbody");
  
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
        const aName = a.name || "";
        const bName = b.name || "";
        return aName.localeCompare(bName);
      }
      
      // Sort favorites based on direction
      return currentSortDirection === "asc" 
        ? (bFav ? 1 : -1) 
        : (bFav ? -1 : 1);
    } else {
      // Sort by name or type
      const aVal = a[currentSortField] || "";
      const bVal = b[currentSortField] || "";
      return currentSortDirection === "asc" 
        ? aVal.localeCompare(bVal) 
        : bVal.localeCompare(aVal);
    }
  });
  
  if (filtered.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 4;
    td.textContent = "No matching components found.";
    tr.appendChild(td);
    tbody.appendChild(tr);
  } else {
    // Create a row for each component
    filtered.forEach(comp => {
      const tr = document.createElement("tr");
      
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
      
      // Name cell
      const nameTd = document.createElement("td");
      nameTd.textContent = comp.name || "";
      tr.appendChild(nameTd);
      
      // Type cell
      const typeTd = document.createElement("td");
      typeTd.textContent = comp.type || "";
      tr.appendChild(typeTd);
      
      // Action cell with delete button
      const actionTd = document.createElement("td");
      const deleteBtn = document.createElement("button");
      deleteBtn.textContent = "Delete";
      deleteBtn.className = "delete-stat-btn";
      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!confirm(`Delete component "${comp.name}"?`)) return;
        deleteStatblockComponent(comp.id);
        renderComponentsList();
      });
      actionTd.appendChild(deleteBtn);
      tr.appendChild(actionTd);
      
      // Click on row to view/edit component (could be expanded later)
      tr.addEventListener("click", () => {
        // For future implementation: component editor
        console.log("Selected component:", comp);
      });
      
      tbody.appendChild(tr);
    });
  }
  
  table.appendChild(tbody);
  container.appendChild(table);
}