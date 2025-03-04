
export let LOCAL_STORAGE_KEY = "trespasser_statblocks";
export let LOCAL_STORAGE_BUNDLES_KEY = "trespasser_uploadedBundles";
export let statblocks = [];
export let uploadedBundles = [];
export let favoritesMap = {};
export let fuseIndex = null;


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
}
export function saveToLocalStorage(){
    // Generate favorites array from favoritesMap
    const favArray = Object.keys(favoritesMap).filter(id => favoritesMap[id]);
    const data = { statblocks, favorites: favArray };
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
}
export function clearLocalStorage(){
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    localStorage.removeItem(LOCAL_STORAGE_BUNDLES_KEY);
    statblocks = [];
    uploadedBundles = [];
    favoritesMap = {};
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
    saveToLocalStorage();
    saveUploadedBundles();
    document.dispatchEvent(new CustomEvent('refreshUI'));
    alert("Backup imported successfully!");
  } catch(err) {
    alert("Failed to import backup: " + err);
  }
  e.target.value = "";
}
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