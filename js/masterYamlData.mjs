import { parseDeedsStringNew } from "./utilityFunctions.mjs";
import { masterYamlData, updateMasterYamlData, resetMasterYamlData, hiddenStats, DEFAULT_STATS } from "./yamlDataState.mjs";
import { updateRenderedStatblock } from "./statblockRender.mjs";

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

