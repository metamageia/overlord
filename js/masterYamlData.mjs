import { parseDeedsStringNew } from "./utilityFunctions.mjs";
import { masterYamlData, updateMasterYamlData, resetMasterYamlData, hiddenStats, DEFAULT_STATS } from "./yamlDataState.mjs";
import { updateRenderedStatblock } from "./statblockRender.mjs";
import { addStatblockComponent } from './libraryData.mjs';
import { generateComponentID } from "./idManagement.mjs";

/* ---------------------------------------------
 * MASTER YAML SYNCHRONIZATION
 * ---------------------------------------------
 */

// Update YAML text area from MasterYAML?
export function updateYamlTextArea(){
    try {
      const clone = Object.assign({}, masterYamlData);
      delete clone.statblockID;
      delete clone.bundleId;
      document.getElementById("yamlArea").value = jsyaml.dump(clone, { lineWidth: -1 });
    } catch(e){
      console.error(e);
    }
}
  // Update MasterYamlData from YAML Text Area
export function updateMasterYamlDataFromYaml(){
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
  
  // Update UIEditor from masterYamlData
export function updateUIFromMasterYaml(){
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
  // Update MasterYamlData from UIEditor Changes
export function updateMasterYamlDataFromUI() {
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
export function uiFieldChanged(){
    updateMasterYamlDataFromUI();
}


/* ---------------------------------------------
 * FEATURES AND DEEDS
 * ---------------------------------------------
 */



// Features & Deeds
function addFeature(featureObj=null){
  const container = document.getElementById("featuresContainer");
  const div = document.createElement("div");
  div.className = "dynamic-feature";
  
  // Create reordering buttons container
  const reorderContainer = document.createElement("div");
  reorderContainer.className = "reorder-buttons";
  
  const upButton = document.createElement("button");
  upButton.innerHTML = "&#9650;"; // Up arrow
  upButton.className = "reorder-btn up-btn";
  upButton.title = "Move up";
  upButton.addEventListener("click", (e) => {
    e.preventDefault();
    const prev = div.previousElementSibling;
    if (prev && prev.classList.contains("dynamic-feature")) {
      container.insertBefore(div, prev);
      uiFieldChanged();
    }
  });
  
  const downButton = document.createElement("button");
  downButton.innerHTML = "&#9660;"; // Down arrow
  downButton.className = "reorder-btn down-btn";
  downButton.title = "Move down";
  downButton.addEventListener("click", (e) => {
    e.preventDefault();
    const next = div.nextElementSibling;
    if (next && next.classList.contains("dynamic-feature")) {
      container.insertBefore(next, div);
      uiFieldChanged();
    }
  });
  
  reorderContainer.appendChild(upButton);
  reorderContainer.appendChild(downButton);
  
  // Create feature content wrapper
  const featureContentWrapper = document.createElement("div");
  featureContentWrapper.className = "feature-content-wrapper";
  
  // Title input
  const titleInput = document.createElement("input");
  titleInput.type = "text";
  titleInput.placeholder = "Enter feature title";
  titleInput.className = "feature-title-input";
  titleInput.value = featureObj ? (featureObj.title || "") : "";
  titleInput.addEventListener("input", uiFieldChanged);
  
  // Feature content
  const contentTextarea = document.createElement("textarea");
  contentTextarea.placeholder = "Enter feature description";
  contentTextarea.className = "feature-content-input";
  contentTextarea.value = featureObj ? (featureObj.content || "") : "";
  contentTextarea.addEventListener("input", uiFieldChanged);
  contentTextarea.rows = 3;
  
  // Remove button
  const removeFeatureBtn = document.createElement("button");
  removeFeatureBtn.type = "button";
  removeFeatureBtn.textContent = "x";
  removeFeatureBtn.className = "delete-feature-btn";
  removeFeatureBtn.onclick = () => { div.remove(); uiFieldChanged(); };
  
  // Add "Save as Component" button
  const saveComponentBtn = document.createElement("button");
  saveComponentBtn.type = "button";
  saveComponentBtn.textContent = "Save as Component";
  saveComponentBtn.className = "small-btn save-component-btn";
  saveComponentBtn.title = "Save this feature as a reusable component";
  saveComponentBtn.onclick = () => { 
    saveFeatureAsComponent(div); 
  };
  
  // Button container
  const buttonContainer = document.createElement("div");
  buttonContainer.className = "feature-button-container";
  buttonContainer.appendChild(saveComponentBtn);
  
  // Assemble the feature element
  featureContentWrapper.appendChild(titleInput);
  featureContentWrapper.appendChild(contentTextarea);
  featureContentWrapper.appendChild(buttonContainer);
  div.appendChild(featureContentWrapper);
  div.appendChild(removeFeatureBtn);
  div.appendChild(reorderContainer);
  container.appendChild(div);
}
function addDeed(type, deedObj=null){
  const container = document.getElementById(type + "DeedsContainer");
  const div = document.createElement("div");
  div.className = "dynamic-deed " + type;
  
  // Create a wrapper for the deed content
  const deedContentWrapper = document.createElement("div");
  deedContentWrapper.className = "deed-content-wrapper";
  
  // Create reordering buttons container
  const reorderContainer = document.createElement("div");
  reorderContainer.className = "reorder-buttons";
  
  const upButton = document.createElement("button");
  upButton.innerHTML = "&#9650;"; // Up arrow
  upButton.className = "reorder-btn up-btn";
  upButton.title = "Move up";
  upButton.addEventListener("click", (e) => {
    e.preventDefault();
    const prev = div.previousElementSibling;
    if (prev && prev.classList.contains("dynamic-deed")) {
      container.insertBefore(div, prev);
      uiFieldChanged();
    }
  });
  
  const downButton = document.createElement("button");
  downButton.innerHTML = "&#9660;"; // Down arrow
  downButton.className = "reorder-btn down-btn";
  downButton.title = "Move down";
  downButton.addEventListener("click", (e) => {
    e.preventDefault();
    const next = div.nextElementSibling;
    if (next && next.classList.contains("dynamic-deed")) {
      container.insertBefore(next, div);
      uiFieldChanged();
    }
  });
  
  reorderContainer.appendChild(upButton);
  reorderContainer.appendChild(downButton);
  
  // Create title row
  const titleRow = document.createElement("div");
  titleRow.className = "deed-title-row";
  
  const titleInput = document.createElement("input");
  titleInput.type = "text";
  titleInput.placeholder = `Enter ${type} deed title`;
  titleInput.className = "deed-title-input";
  titleInput.value = deedObj ? (deedObj.title || "") : "";
  titleInput.addEventListener("input", uiFieldChanged);
  
  titleRow.appendChild(titleInput);
  
  // Create lines container for the deed details
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
  
  // Add "Save as Component" button
  const saveComponentBtn = document.createElement("button");
  saveComponentBtn.type = "button";
  saveComponentBtn.textContent = "Save as Component";
  saveComponentBtn.className = "small-btn save-component-btn";
  saveComponentBtn.title = "Save this deed as a reusable component";
  saveComponentBtn.onclick = () => { 
    saveDeedAsComponent(div, type); 
  };
  
  // Create button container
  const buttonContainer = document.createElement("div");
  buttonContainer.className = "deed-button-container";
  buttonContainer.appendChild(addLineBtn);
  buttonContainer.appendChild(saveComponentBtn);
  
  // Append in proper order for vertical layout
  deedContentWrapper.appendChild(titleRow);
  deedContentWrapper.appendChild(linesCont);
  deedContentWrapper.appendChild(buttonContainer);
  div.appendChild(deedContentWrapper);
  div.appendChild(removeDeedBtn);
  div.appendChild(reorderContainer);
  container.appendChild(div);
  
  if(deedObj && Array.isArray(deedObj.lines)){
    deedObj.lines.forEach(line => addLine(linesCont, line));
  }
}
function addLine(container, line=null){
  const lineDiv = document.createElement("div");
  lineDiv.className = "dynamic-line";
  
  // Create reordering buttons for lines
  const lineReorderContainer = document.createElement("div");
  lineReorderContainer.className = "line-reorder-buttons";
  
  const lineUpButton = document.createElement("button");
  lineUpButton.innerHTML = "&#9650;"; // Up arrow
  lineUpButton.className = "reorder-btn line-up-btn";
  lineUpButton.title = "Move line up";
  lineUpButton.addEventListener("click", (e) => {
    e.preventDefault();
    const prev = lineDiv.previousElementSibling;
    if (prev && prev.classList.contains("dynamic-line")) {
      container.insertBefore(lineDiv, prev);
      uiFieldChanged();
    }
  });
  
  const lineDownButton = document.createElement("button");
  lineDownButton.innerHTML = "&#9660;"; // Down arrow
  lineDownButton.className = "reorder-btn line-down-btn";
  lineDownButton.title = "Move line down";
  lineDownButton.addEventListener("click", (e) => {
    e.preventDefault();
    const next = lineDiv.nextElementSibling;
    if (next && next.classList.contains("dynamic-line")) {
      container.insertBefore(next, lineDiv);
      uiFieldChanged();
    }
  });
  
  lineReorderContainer.appendChild(lineUpButton);
  lineReorderContainer.appendChild(lineDownButton);
  
  // Create content wrapper
  const contentWrapper = document.createElement("div");
  contentWrapper.className = "line-content-wrapper";
  
  const titleInput = document.createElement("input");
  titleInput.type = "text";
  titleInput.className = "line-title";
  titleInput.placeholder = "Line Title";
  titleInput.value = line ? (line.title || "") : "";
  titleInput.addEventListener("input", uiFieldChanged);
  
  const contentInput = document.createElement("input");
  contentInput.type = "text";
  contentInput.className = "line-content";
  contentInput.placeholder = "Content";
  contentInput.value = line ? (line.content || "") : "";
  contentInput.addEventListener("input", uiFieldChanged);
  
  const removeBtn = document.createElement("button");
  removeBtn.textContent = "x";
  removeBtn.className = "delete-btn";
  removeBtn.addEventListener("click", () => {
    lineDiv.remove();
    uiFieldChanged();
  });
  
  // Assemble the components
  contentWrapper.appendChild(titleInput);
  contentWrapper.appendChild(contentInput);
  
  lineDiv.appendChild(lineReorderContainer);
  lineDiv.appendChild(contentWrapper);
  lineDiv.appendChild(removeBtn);
  container.appendChild(lineDiv);
}
function collectFeatures(){
  const features = [];
  document.querySelectorAll("#featuresContainer .dynamic-feature").forEach(div => {
    const titleInput = div.querySelector(".feature-title-input");
    const contentTextarea = div.querySelector(".feature-content-input");
    
    // Make sure both elements exist before trying to access values
    if (titleInput) {
      const title = titleInput.value.trim();
      const content = contentTextarea ? contentTextarea.value.trim() : "";
      
      if(title){
        features.push({title, content});
      }
    }
  });
  return features;
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

/* ---------------------------------------------
 * COMPONENTS
 * ---------------------------------------------
 */

// Function to save a deed as a component
function saveDeedAsComponent(deedElement, deedType) {
  // Get deed title
  const titleInput = deedElement.querySelector(".deed-title-input");
  const deedTitle = titleInput ? titleInput.value.trim() : "Unnamed Deed";
  
  // Build the deed YAML content
  const lines = [];
  deedElement.querySelectorAll(".linesContainer .dynamic-line").forEach(ld => {
    const lineInputs = ld.querySelectorAll("input");
    const lt = lineInputs[0].value.trim();
    const lc = lineInputs[1].value.trim();
    if(lt) {
      lines.push(lt + (lc ? ": " + lc : ""));
    }
  });
  
  let yamlContent = deedTitle;
  if(lines.length > 0) yamlContent += "\n" + lines.join("\n");
  
  // Format the deed type for component
  const typeMap = {
    "light": "Light Deed",
    "heavy": "Heavy Deed",
    "mighty": "Mighty Deed",
    "tyrant": "Tyrant Deed",
    "special": "Special Deed"
  };
  
  // Create the component
  const component = {
    name: deedTitle,
    type: typeMap[deedType] || `${deedType} Deed`,
    deedType: deedType,
    yaml: yamlContent
  };
  
  // ID will be generated by addStatblockComponent using generateComponentID
  if(addStatblockComponent(component)) {
    alert(`Saved "${deedTitle}" as a component!`);
    document.dispatchEvent(new CustomEvent('refreshUI'));
  } else {
    alert("Failed to save component.");
  }
}

function saveFeatureAsComponent(featureElement) {
  // Get feature title
  const titleInput = featureElement.querySelector(".feature-title-input");
  const featureTitle = titleInput ? titleInput.value.trim() : "Unnamed Feature";
  
  // Extract feature content
  const contentTextarea = featureElement.querySelector(".feature-content-input");
  const featureContent = contentTextarea ? contentTextarea.value.trim() : "";
  
  // Build YAML content
  let yamlContent = featureTitle;
  if(featureContent) {
    yamlContent += "\n" + featureContent;
  }
  
  // Create the component
  const component = {
    name: featureTitle,
    type: "Feature",
    yaml: yamlContent
  };
  
  // ID will be generated by addStatblockComponent using generateComponentID
  if(addStatblockComponent(component)) {
    alert(`Saved "${featureTitle}" as a component!`);
    document.dispatchEvent(new CustomEvent('refreshUI'));
  } else {
    alert("Failed to save component.");
  }
}