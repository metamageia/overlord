export let LOCAL_STORAGE_KEY = "trespasser_statblocks";
export let LOCAL_STORAGE_COMPONENTS_KEY = "trespasser_statblockComponents"; // New key for components
export let LOCAL_STORAGE_BUNDLES_KEY = "trespasser_uploadedBundles";
export let statblocks = [];
export let uploadedBundles = [];
export let favoritesMap = {};
export let statblockComponents = []; // New array to store YAML snippets
export let fuseIndex = null;
import { generateComponentID } from "./idManagement.mjs"; 

/* ---------------------------------------------
 * STORAGE FUNCTIONS (Library + Favorites)
 * ---------------------------------------------
 */
export function loadFromLocalStorage(){
    try { 
      const data = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY));
      if(data && typeof data === "object" && data.statblocks){
        statblocks = data.statblocks;
        const favArray = data.favorites || [];
        favoritesMap = {};
        favArray.forEach(id => favoritesMap[id] = true);
      } else {
        statblocks = [];
        favoritesMap = {};
      }
    } catch(e){ 
      statblocks = [];
      favoritesMap = {};
    }

    // Load statblock components
    try {
      const componentsData = JSON.parse(localStorage.getItem(LOCAL_STORAGE_COMPONENTS_KEY));
      statblockComponents = Array.isArray(componentsData) ? componentsData : [];
    } catch(e) {
      statblockComponents = [];
    }

}
export function saveToLocalStorage(key, data) {
  // If no key is provided, save everything
  if (!key) {
    // Generate favorites array from favoritesMap
    const favArray = Object.keys(favoritesMap).filter(id => favoritesMap[id]);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ statblocks, favorites: favArray }));
    localStorage.setItem(LOCAL_STORAGE_COMPONENTS_KEY, JSON.stringify(statblockComponents));
    localStorage.setItem(LOCAL_STORAGE_BUNDLES_KEY, JSON.stringify(uploadedBundles));
    return;
  }
  
  switch(key) {
    case "statblocks":
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ 
        statblocks: data || statblocks, 
        favorites: Object.keys(favoritesMap).filter(id => favoritesMap[id]) 
      }));
      break;
    case "components":
      localStorage.setItem(LOCAL_STORAGE_COMPONENTS_KEY, JSON.stringify(data || statblockComponents));
      break;
    case "bundles":
      localStorage.setItem(LOCAL_STORAGE_BUNDLES_KEY, JSON.stringify(data || uploadedBundles));
      break;
    case "favorites":
      const favArray = Object.keys(data).filter(id => data[id]);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ statblocks, favorites: favArray }));
      break;
  }
}
export function clearLocalStorage(){
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    localStorage.removeItem(LOCAL_STORAGE_BUNDLES_KEY);
    localStorage.removeItem(LOCAL_STORAGE_COMPONENTS_KEY); // Clear components too
    statblocks = [];
    uploadedBundles = [];
    favoritesMap = {};
    statblockComponents = []; // Reset components array
  

}
// Remove Statblocks
export function deleteStatblock(statblockToDelete) {
  const index = statblocks.indexOf(statblockToDelete);
  if (index > -1) {
    statblocks.splice(index, 1);
    return true;
  }
  return false;
}

/* ---------------------------------------------
 * Bundle Data Management
 * ---------------------------------------------
 */

// Bundle Save & Load
export function loadUploadedBundles(){
 try { uploadedBundles = JSON.parse(localStorage.getItem(LOCAL_STORAGE_BUNDLES_KEY)) || []; }
 catch(e){ uploadedBundles = []; }
}
export function saveUploadedBundles(){
  localStorage.setItem(LOCAL_STORAGE_BUNDLES_KEY, JSON.stringify(uploadedBundles));
}

/* ---------------------------------------------
 * Library Backup
 * ---------------------------------------------
 */

// Export
export async function exportBackup(){
  const zip = new JSZip();
  zip.file("library.json", localStorage.getItem(LOCAL_STORAGE_KEY) || "{}");
  zip.file("bundles.json", localStorage.getItem(LOCAL_STORAGE_BUNDLES_KEY) || "[]");
  zip.file("components.json", localStorage.getItem(LOCAL_STORAGE_COMPONENTS_KEY) || "[]"); // Add components to backup
  const blob = await zip.generateAsync({ type: "blob" });
  const a = document.createElement("a");
  a.download = "trespasser-backup.zip";
  a.href = URL.createObjectURL(blob);
  a.click();
  URL.revokeObjectURL(a.href);
}
//Import
export async function importBackup(e){
  const file = e.target.files[0];
  if(!file) return;
  try {
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    const libFile = zip.file("library.json");
    const bundlesFile = zip.file("bundles.json");
    const componentsFile = zip.file("components.json");
    if(!libFile || !bundlesFile){
      alert("The backup file is missing library.json or bundles.json.");
      e.target.value = "";
      return;
    }
    const libData = await libFile.async("string");
    const bundlesData = await bundlesFile.async("string");
    let parsedLib = JSON.parse(libData);
    // Backward compatibility: if parsedLib is an array, convert it.
    if(Array.isArray(parsedLib)){
      statblocks = parsedLib;
      favoritesMap = {};
    } else {
      statblocks = parsedLib.statblocks || [];
      const favArray = parsedLib.favorites || [];
      favoritesMap = {};
      favArray.forEach(id => favoritesMap[id] = true);
    }
    uploadedBundles = JSON.parse(bundlesData);
    
    // Always clear existing components when importing a backup
    statblockComponents = [];
    
    // Import components if they exist in the backup
    if (componentsFile) {
      const componentsData = await componentsFile.async("string");
      try {
        const parsedComponents = JSON.parse(componentsData);
        // Convert old format if needed
        if (Array.isArray(parsedComponents)) {
          statblockComponents = parsedComponents.map(comp => {
            // Ensure all components have componentID using the generator
            if (!comp.componentID) {
              comp.componentID = generateComponentID(comp);
            }
            return comp;
          });
        }
      } catch (err) {
        console.error("Failed to parse components data:", err);
      }
    }

    saveToLocalStorage();
    saveUploadedBundles();
    document.dispatchEvent(new CustomEvent('refreshUI'));
    alert("Backup imported successfully!");
  } catch(err) {
    alert("Failed to import backup: " + err);
  }
  e.target.value = "";
}


/* ---------------------------------------------
 * Statblock Components Management
 * ---------------------------------------------
 */

// Add a new statblock component
export function addStatblockComponent(component) {
  if (!component || typeof component !== 'object') return false;
  
  // Ensure component has required fields
  if (!component.name || !component.yaml || typeof component.yaml !== 'string') {
    return false;
  }
  
  // Generate unique ID if not present
  if (!component.componentID) {
    component.componentID = generateComponentID(component);
  }
  
  // Check for duplicate components
  const duplicate = statblockComponents.find(c => c.componentID === component.componentID);
  if (duplicate) {
    alert(`A component with identical content already exists: "${duplicate.name}"`);
    return false;
  }
  
  // Add to components array
  statblockComponents.push(component);
  saveToLocalStorage();
  return true;
}

// Delete a statblock component by ID
export function deleteStatblockComponent(id) {
  const initialLength = statblockComponents.length;
  statblockComponents = statblockComponents.filter(c => c.componentID !== id);
  
  if (statblockComponents.length !== initialLength) {
    saveToLocalStorage();
    return true;
  }
  return false;
}

// Update an existing statblock component
export function updateStatblockComponent(id, updates) {
  const component = statblockComponents.find(c => c.componentID === id);
  if (!component) return false;
  
  Object.assign(component, updates);
  
  // If content was updated, regenerate the ID
  if (updates.name || updates.yaml || updates.type) {
    component.componentID = generateComponentID(component);
  }
  
  saveToLocalStorage();
  return true;
}

// Get all statblock components
export function getAllStatblockComponents() {
  return [...statblockComponents]; // Return a copy
}

/// --- Backup Naming --- //

// Backup Name / Location
export function downloadBlob(text, mime, filename){
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/// --- Utilities --- //
export function initSearch(){
  fuseIndex = new Fuse(statblocks, {
    keys: ["monsterName","role","template","level","tr"],
    threshold: 0.3,
    ignoreLocation: true
  });
}