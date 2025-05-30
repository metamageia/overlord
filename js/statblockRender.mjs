import { parseDeedsStringNew } from "./utilityFunctions.mjs";
import { masterYamlData, updateMasterYamlData, resetMasterYamlData, hiddenStats, DEFAULT_STATS } from "./yamlDataState.mjs";

/* ---------------------------------------------
 * Statblock Render
 * ---------------------------------------------
 */

// --- Utilities --- //
// Update Rendered Statblock
export function updateRenderedStatblock() {
  if(!masterYamlData || !masterYamlData.monsterName){
    renderDefaultDetail();
    return;
  }

  // Clear previous state
  document.getElementById("defaultDetail").style.display = "none";
  document.getElementById("dsb-basicSection").style.display = "block";

  // Update header information
  document.getElementById("dsb-name").textContent = masterYamlData.monsterName || "[Monster Name]";
  
  if (masterYamlData.role) {
    document.getElementById("dsb-role").textContent = masterYamlData.role || "[Role]";
    document.getElementById("dsb-role").style.display = "inline";
  } else {
    document.getElementById("dsb-role").style.display = "none";
  }

  const hasTitleExtras = masterYamlData.role || masterYamlData.template || masterYamlData.level;
  document.getElementById("dsb-title-separator").style.display = hasTitleExtras ? "inline" : "none";

  if(masterYamlData.template) {
    document.getElementById("dsb-template").textContent = " " + masterYamlData.template;
    document.getElementById("dsb-template").style.display = "inline";
  } else {
    document.getElementById("dsb-template").style.display = "none";
  }
  
  document.getElementById("dsb-level").textContent = masterYamlData.level ? " " + masterYamlData.level : "";
  document.getElementById("dsb-tr").textContent = masterYamlData.tr ? "TR " + masterYamlData.tr : "";

  // Handle description section
  const descriptionSection = document.getElementById("dsb-description-section");
  const descriptionElement = document.getElementById("dsb-description");
  
  if (masterYamlData.description && masterYamlData.description.trim()) {
    descriptionElement.textContent = masterYamlData.description;
    descriptionSection.style.display = "block";
  } else {
    descriptionSection.style.display = "none";
  }

  // Update basic stats display
  Object.keys(DEFAULT_STATS).forEach(key => {
    const el = document.getElementById("dsb-" + key);
    if (el) {
      if (masterYamlData[key]) {
        el.parentElement.style.display = "block";
        el.textContent = masterYamlData[key];
      } else {
        el.parentElement.style.display = "none";
      }
    }
  });

  // Handle custom stats - SINGLE IMPLEMENTATION
  const basicSection = document.getElementById("dsb-basicSection");
  const existingCustomRow = basicSection.querySelector(".custom-stats-row");
  if (existingCustomRow) {
    existingCustomRow.remove();
  }

  if (Array.isArray(masterYamlData.customStats) && masterYamlData.customStats.length > 0) {
    const customStatsRow = document.createElement("div");
    customStatsRow.className = "basic-stats-row custom-stats-row";
    
    masterYamlData.customStats.forEach(stat => {
      const card = document.createElement("div");
      card.className = "basic-stat-card";
      card.innerHTML = `
        <div class="basic-stat-header">${stat.name}</div>
        <div class="basic-stat-value">${stat.value}</div>
      `;
      customStatsRow.appendChild(card);
    });
    
    basicSection.appendChild(customStatsRow);
  }

  // Continue with features and deeds
  renderFeatures(masterYamlData);
  renderDeeds(masterYamlData);
  
  // Update IDs section
  const idsDiv = document.getElementById("dsb-ids");
  idsDiv.innerHTML = "";
  if(masterYamlData.statblockID) {
    const statblockIDSpan = document.createElement("div");
    statblockIDSpan.textContent = "statblockID: " + masterYamlData.statblockID;
    idsDiv.appendChild(statblockIDSpan);
  }
  if(masterYamlData.bundleId) {
    const bundleIDSpan = document.createElement("div");
    bundleIDSpan.textContent = "bundleID: " + masterYamlData.bundleId;
    idsDiv.appendChild(bundleIDSpan);
  }
}
// Render Stats & Title
export function renderDefaultDetail() {
  document.getElementById("defaultDetail").style.display = "block";
  document.getElementById("dsb-basicSection").style.display = "none";
  document.getElementById("dsb-featuresSection").style.display = "none";
  document.getElementById("dsb-deedsSection").style.display = "none";
  document.getElementById("dsb-description-section").style.display = "none"; 
  document.getElementById("dsb-ids").innerHTML = "";
  document.getElementById("dsb-name").textContent = "[Monster Name]";
  document.getElementById("dsb-title-separator").style.display = "none";
  document.getElementById("dsb-role").textContent = "";
  document.getElementById("dsb-template").textContent = "";
  document.getElementById("dsb-level").textContent = "";
  document.getElementById("dsb-tr").textContent = "";
}
// Render Features
function renderFeatures(data){
  const featSec = document.getElementById("dsb-featuresSection");
  const featList = document.getElementById("dsb-featuresList");
  featList.innerHTML = "";
  let hasFeature = false;
  if(Array.isArray(data.features)){
    data.features.forEach(f => {
      if(f.title || f.content){
        hasFeature = true;
        const d = document.createElement("div");
        d.style.marginBottom = "10px";
        d.style.fontSize = "0.9em";
        d.innerHTML = f.content ? `<strong>${f.title}:</strong> ${f.content}` : `<strong>${f.title}</strong>`;
        featList.appendChild(d);
      }
    });
  } else if(typeof data.features === "object"){
    for(let k in data.features){
      hasFeature = true;
      const d = document.createElement("div");
      d.style.marginBottom = "10px";
      d.style.fontSize = "0.9em";
      d.innerHTML = `<strong>${k}:</strong> ${data.features[k]}`;
      featList.appendChild(d);
    }
  }
  featSec.style.display = hasFeature ? "block" : "none";
}

// Render Deeds
function renderDeeds(data){
  const dsbDeeds = document.getElementById("dsb-deedsContainer");
  const dsbDeedsSec = document.getElementById("dsb-deedsSection");
  dsbDeeds.innerHTML = "";
  let hasDeeds = false;
  ["lightDeeds","heavyDeeds","mightyDeeds","tyrantDeeds", "specialDeeds"].forEach(t => {
    let arr = data[t];
    if(typeof arr === "string") arr = parseDeedsStringNew(arr);
    if(!Array.isArray(arr)) return;
    const color = t.replace("Deeds", "");
    arr.forEach(d => {
      if(d.title || (d.lines && d.lines.length)){
        hasDeeds = true;
        const cap = color.charAt(0).toUpperCase() + color.slice(1);
        let html = `<div class="deed-header">${cap}</div>`;
        if(d.title){
          html += `<div class="deed-title-output">${d.title.trim()}</div><hr class="deed-separator">`;
        }
        d.lines.forEach(line => {
          if(line.title || line.content){
            html += `<div class="line-indent" style="font-size:0.9em;">` +
                    (line.content ? `<strong>${line.title}:</strong> ${line.content}` : `<strong>${line.title}</strong>`) +
                    `</div>`;
          }
        }); // Added missing closing brace for d.lines.forEach
        const deedDiv = document.createElement("div");
        deedDiv.className = `deed ${color}`;
        deedDiv.innerHTML = html;
        dsbDeeds.appendChild(deedDiv);
      }
    });
  });
  dsbDeedsSec.style.display = hasDeeds ? "block" : "none";
}