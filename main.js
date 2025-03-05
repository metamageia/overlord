import { masterYamlData, updateMasterYamlData, resetMasterYamlData, hiddenStats, DEFAULT_STATS } from "./js/yamlDataState.mjs";
import { updateYamlTextArea, updateMasterYamlDataFromYaml, updateUIFromMasterYaml, updateMasterYamlDataFromUI, uiFieldChanged } from "./js/masterYamlData.mjs";
import { updateRenderedStatblock, renderDefaultDetail } from "./js/statblockRender.mjs";
import { statblocks, uploadedBundles, loadFromLocalStorage, saveToLocalStorage, loadUploadedBundles, saveUploadedBundles, exportBackup, importBackup, clearLocalStorage, initSearch, } from "./js/libraryData.mjs";
import { handleUpload, renderCreateBundleList, renderBundleList, downloadCurrentBundle, mergeSelectedBundles, getBundleName, confirmOverwrite, cancelOverwrite, fillManageMergeSelect, renderUploadedBundles} from './js/bundleManagement.mjs';
import { matchesNumericQuery, matchesStringQuery } from './js/utilityFunctions.mjs';
import { decodeStatblockData, encodeStatblockData,exportCurrentDetail } from "./js/shareStatblocks.mjs";
import { renderStatblockLibrary, updateSelectedRow, currentFilteredList, saveToLibrary, showManageStatsModal, closeManageStatsModal, selectedStatblockID, currentDetail, setCurrentDetail, setSelectedStatblockID } from "./js/libraryBrowser.mjs";
import { toggleSidebar, toggleBundlesSidebar, setInitialSidebarVisibility, initBundlePanels, switchSidebarTab, switchBundlesTab, initResizeHandlers } from "./js/uiControllers.mjs";
import { renderComponentsList } from './js/componentManagement.mjs';

/************************************************
 * Global Variables
 ************************************************/
// PWA Add this to your global variables
let deferredPrompt;

/* ---------------------------------------------
 * Event Listeners
 * ---------------------------------------------
 */

window.addEventListener("DOMContentLoaded", () => {
  loadFromLocalStorage();
  loadUploadedBundles();
  initSearch();
  renderStatblockLibrary();
  renderCreateBundleList();
  fillManageMergeSelect();
  renderUploadedBundles();
  
  // Initialize bundle panels structure
  initBundlePanels();
  
  // NEW: Set the initial sidebar visibility based on device width
  setInitialSidebarVisibility();
  
  // (Optional) Update sidebar visibility on window resize
  window.addEventListener("resize", setInitialSidebarVisibility);
  
  attachEventHandlers();
  renderDefaultDetail();
  
  // Initialize sidebar tab
  switchSidebarTab("library");
  
  // Initialize bundles tabs - default to Bundles top tab and Manage subtab
  switchBundlesTab("bundles");
  switchBundlesTab("manage");
  
  // Initialize resize handlers
  initResizeHandlers();
  
  resetMasterYamlData();
  updateUIFromMasterYaml();
  updateYamlTextArea();

  // NEW: Check URL for share parameter "s" and load statblock if present
  const urlParams = new URLSearchParams(window.location.search);
  const shareParam = urlParams.get('s');
  if(shareParam) {
    try {
      const decodedYaml = decodeStatblockData(shareParam);
      if(decodedYaml) {
        updateMasterYamlData(jsyaml.load(decodedYaml));
        updateUIFromMasterYaml();
        updateYamlTextArea();
        updateRenderedStatblock();
        alert("Loaded statblock from share link.");
      }
    } catch(e) {
      console.error("Error decoding share parameter:", e);
    }
  }

  // Add this to your window.addEventListener("DOMContentLoaded", () => {}) function
  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the default prompt
    e.preventDefault();
    // Store the event for later
    deferredPrompt = e;
    

    
    // Add it after the toggle buttons
    const togglesContainer = document.querySelector('.sidebar-toggles');
    
  });
});

/* ---------------------------------------------
 * Event Handles
 * ---------------------------------------------
 */

// Update attachEventHandlers to include the top tabs
function attachEventHandlers() {
  // Master Event Listeners
  document.addEventListener('refreshUI', () => {
    initSearch();
    renderStatblockLibrary();
    renderCreateBundleList();
    fillManageMergeSelect();
    renderUploadedBundles();
    renderComponentsList(); // Add this line
    updateRenderedStatblock();
  });
  document.addEventListener('saveLibraryChanges', () => {
    saveToLocalStorage();
    saveUploadedBundles();
  });

  // Add event listeners for sidebar toggles
  document.getElementById("toggleSidebarBtn").addEventListener("click", toggleSidebar);
  document.getElementById("libraryToggle").addEventListener("click", () => switchSidebarTab("library"));
  document.getElementById("editorToggle").addEventListener("click", () => switchSidebarTab("editor"));
  document.getElementById("yamlToggle").addEventListener("click", () => switchSidebarTab("yaml"));
  document.getElementById("toggleBundlesSidebarBtn").addEventListener("click", toggleBundlesSidebar);
  
  // Add event listeners for top-level bundle tabs
  document.getElementById("bundlesBundlesTab").addEventListener("click", () => switchBundlesTab("bundles"));
  document.getElementById("bundlesComponentsTab").addEventListener("click", () => {
    switchBundlesTab("components");
  });
  document.getElementById("bundlesBackupTab").addEventListener("click", () => switchBundlesTab("backup"));
  
  // Add event listeners for bundle subtabs
  document.getElementById("bundlesManageTab").addEventListener("click", () => switchBundlesTab("manage"));
  document.getElementById("bundlesUploadTab").addEventListener("click", () => switchBundlesTab("upload"));
  document.getElementById("bundlesCreateTab").addEventListener("click", () => switchBundlesTab("create"));
  document.getElementById("bundlesMergeTab").addEventListener("click", () => switchBundlesTab("merge"));

  document.getElementById("createNewBtn").addEventListener("click", () => {
    if (confirm("Create new empty statblock? Any unsaved changes will be lost.")) {
      resetMasterYamlData();
      setCurrentDetail(null);
      setSelectedStatblockID(null);
      updateRenderedStatblock();
      updateUIFromMasterYaml();
    }
  });
  document.getElementById("exportBackupBtn").addEventListener("click", exportBackup);
  document.getElementById("importBackupBtn").addEventListener("click", () => {
    document.getElementById("importBackupFile").click();
  });
  document.getElementById("importBackupFile").addEventListener("change", importBackup);
  document.getElementById("uploadBtn").addEventListener("click", handleUpload);

  ["monsterName","role","template","level","tr","hp","init","acc","grd","res","roll","spd"].forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener("input", uiFieldChanged);
    el.addEventListener("change", uiFieldChanged);
    el.addEventListener("blur", uiFieldChanged);
  });
  document.getElementById("addFeatureBtn").addEventListener("click", () => {
    addFeature();
    uiFieldChanged();
  });
  document.getElementById("addLightDeedBtn").addEventListener("click", () => {
    addDeed("light");
    uiFieldChanged();
  });
  document.getElementById("addHeavyDeedBtn").addEventListener("click", () => {
    addDeed("heavy");
    uiFieldChanged();
  });
  document.getElementById("addMightyDeedBtn").addEventListener("click", () => {
    addDeed("mighty");
    uiFieldChanged();
  });
  document.getElementById("addTyrantDeedBtn").addEventListener("click", () => {
    addDeed("tyrant");
    uiFieldChanged();
  });
  document.getElementById("addSpecialDeedBtn").addEventListener("click", () => {
    addDeed("special");
    uiFieldChanged();
  });
  document.getElementById("yamlArea").addEventListener("input", updateMasterYamlDataFromYaml);
  document.getElementById("copyYaml").addEventListener("click", () => {
    navigator.clipboard.writeText(document.getElementById("yamlArea").value)
      .then(() => alert("YAML copied!"))
      .catch(err => alert("Error copying YAML: " + err));
  });
  document.getElementById("saveToLibraryBtn").addEventListener("click", saveToLibrary);
  document.getElementById("exportBtn").addEventListener("click", exportCurrentDetail);
  document.getElementById("downloadBundleJsonBtn").addEventListener("click", () => downloadCurrentBundle("json"));
  document.getElementById("downloadBundleYamlBtn").addEventListener("click", () => downloadCurrentBundle("yaml"));
  document.getElementById("mergeJsonBtn").addEventListener("click", () => mergeSelectedBundles("json"));
  document.getElementById("mergeYamlBtn").addEventListener("click", () => mergeSelectedBundles("yaml"));
  document.getElementById("deleteAllBtn").addEventListener("click", () => {
    if(confirm("Are you sure you want to permanently delete all statblocks and bundles? This action cannot be undone.")){
      clearLocalStorage();
      document.dispatchEvent(new CustomEvent('saveLibraryChanges'));
      document.dispatchEvent(new CustomEvent('refreshUI'));
      alert("All statblocks and bundles have been deleted.");
    }
  });

  const removeAllBtn = document.getElementById("removeAllBundleBtn");
  if(removeAllBtn){
    removeAllBtn.addEventListener("click", () => {
      if(confirm("Are you sure you want to remove all statblocks from the current bundle?")){
        bundleList = [];
        renderBundleList();
      }
    });
  }

  document.getElementById("statblockList").addEventListener("keydown", function(e) {
    if (!currentFilteredList.length) return;
    let curIndex = currentFilteredList.findIndex(sb => sb.statblockID === selectedStatblockID);
    if(curIndex === -1) curIndex = 0;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      curIndex = Math.min(curIndex + 1, currentFilteredList.length - 1);
      setSelectedStatblockID(currentFilteredList[curIndex].statblockID);
      setCurrentDetail(currentFilteredList[curIndex]);
      renderStatblockLibrary();
      updateMasterYamlData(structuredClone(currentDetail));
      updateUIFromMasterYaml();
      updateYamlTextArea();
      updateRenderedStatblock();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      curIndex = Math.max(curIndex - 1, 0);
      setSelectedStatblockID(currentFilteredList[curIndex].statblockID);
      setCurrentDetail(currentFilteredList[curIndex]);
      renderStatblockLibrary();
      updateMasterYamlData(structuredClone(currentDetail));
      updateUIFromMasterYaml();
      updateYamlTextArea();
      updateRenderedStatblock();
    }
  });
  document.getElementById("statblockList").addEventListener("scroll", function() {
    updateSelectedRow();
  });
  
  initResizeHandlers();

  ["cbSearchName", "cbSearchLV", "cbSearchRole", "cbSearchType", "cbSearchTemplate", "cbSearchTR", "cbSearchBundle"].forEach(id => {
    const el = document.getElementById(id);
    if(el){
      el.addEventListener("input", () => {
        if(id === "cbSearchName") cbFilterName = el.value;
        if(id === "cbSearchLV") cbFilterLV = el.value;
        if(id === "cbSearchRole") cbFilterRole = el.value;
        if(id === "cbSearchType") cbFilterType = el.value;
        if(id === "cbSearchTemplate") cbFilterTemplate = el.value; 
        if(id === "cbSearchTR") cbFilterTR = el.value;
        if(id === "cbSearchBundle") cbFilterBundle = el.value;
        renderCreateBundleList();
      });
    }
  });

  // Fix for the broken "Select All" functionality in Create Bundle tab:
  document.getElementById("selectAllBundleBtn").addEventListener("click", () => {
    let filtered = statblocks.filter(sb => {
      const matchesName = matchesStringQuery(sb.monsterName || "", cbFilterName);
      const matchesRole = matchesStringQuery(sb.role || "", cbFilterRole);
      const matchesType = matchesStringQuery(sb.type || "statblock", cbFilterType);
      const matchesTemplate = matchesStringQuery(sb.template || "", cbFilterTemplate);
      const matchesLV = matchesNumericQuery(sb.level, cbFilterLV);
      const matchesTR = matchesNumericQuery(sb.tr, cbFilterTR);
      const matchesBundle = matchesStringQuery(getBundleName(sb.bundleId), cbFilterBundle);
      return matchesName && matchesRole && matchesType && matchesTemplate && matchesLV && matchesTR && matchesBundle;
    });
    filtered = filtered.filter(sb => {
      if(sb.bundleId === undefined) return true;
      let bun = uploadedBundles.find(x => x.id === sb.bundleId);
      return bun && bun.active;
    });
    filtered.forEach(sb => {
      if(!bundleList.includes(sb)) bundleList.push(sb);
    });
    renderBundleList();
  });

  document.getElementById("generateShareLinkBtn").addEventListener("click", () => {
    if(!masterYamlData || !masterYamlData.monsterName){
      alert("No statblock data available to share.");
      return;
    }
    const yamlStr = jsyaml.dump(masterYamlData, { lineWidth: -1 });
    const encoded = encodeStatblockData(yamlStr);
    const shareUrl = window.location.origin + window.location.pathname + "?s=" + encoded;
    document.getElementById("shareLinkInput").value = shareUrl;
  });

  document.getElementById("decodeShareBtn").addEventListener("click", () => {
    const inputVal = document.getElementById("decodeInput").value.trim();
    if(!inputVal){
      alert("Please enter a share code or URL.");
      return;
    }
    let shareCode = inputVal;
    try {
      const urlObj = new URL(inputVal);
      shareCode = urlObj.searchParams.get("s");
      if(!shareCode) throw new Error("No share parameter found.");
    } catch(e) {}
    const decodedYaml = decodeStatblockData(shareCode);
    if(!decodedYaml){
      alert("Failed to decode share code. Please check the input.");
      return;
    }
    try {
      updateMasterYamlData(jsyaml.load(decodedYaml));
      updateUIFromMasterYaml();
      updateYamlTextArea();
      updateRenderedStatblock();
      alert("Statblock loaded from share code.");
    } catch(e) {
      alert("Error parsing YAML from share code: " + e);
    }
  });

  document.getElementById("selectAllBtn").addEventListener("click", () => {
    document.querySelectorAll("#overwriteList input[type='checkbox']").forEach(cb => cb.checked = true);
  });
  document.getElementById("deselectAllBtn").addEventListener("click", () => {
    document.querySelectorAll("#overwriteList input[type='checkbox']").forEach(cb => cb.checked = false);
  });
  document.getElementById("confirmOverwriteBtn").addEventListener("click", confirmOverwrite);
  document.getElementById("cancelOverwriteBtn").addEventListener("click", cancelOverwrite);

  document.getElementById("addCustomStatBtn")?.addEventListener("click", () => {
    addCustomStat();
    uiFieldChanged();
  });

  document.getElementById("manageStatsBtn")?.addEventListener("click", showManageStatsModal);
  
  document.getElementById("closeManageStatsBtn")?.addEventListener("click", closeManageStatsModal);

  document.getElementById("restoreDefaultsBtn")?.addEventListener("click", () => {
    hiddenStats.clear();
    Object.keys(DEFAULT_STATS).forEach(key => {
      const el = document.getElementById(key);
      if (el && el.parentElement) {
        el.parentElement.classList.remove("hidden-stat");
      }
    });
    updateMasterYamlDataFromUI();
    updateYamlTextArea();
    updateRenderedStatblock();
  });
}

