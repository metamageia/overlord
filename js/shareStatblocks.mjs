import {currentDetail} from "./libraryBrowser.mjs";

/* ---------------------------------------------
 Statblock Export and Sharing
 * ---------------------------------------------
 */

 // --- Import / Export Share Code --- //
export function encodeStatblockData(yamlString) {
  const compressed = LZString.compressToEncodedURIComponent(yamlString);
  return compressed;
}
export function decodeStatblockData(encodedString) {
  const decompressed = LZString.decompressFromEncodedURIComponent(encodedString);
  return decompressed;
}

// --- Export Statblock Render --- //
export function exportCurrentDetail(){
  if(!currentDetail){
    alert("No statblock selected.");
    return;
  }
  const exportContainer = document.createElement("div");
  exportContainer.style.width = "560px";
  exportContainer.style.height = "auto";
  exportContainer.style.padding = "10px";
  exportContainer.style.boxSizing = "border-box";
  exportContainer.innerHTML = document.getElementById("detailStatblock").innerHTML;
  document.body.appendChild(exportContainer);
  html2canvas(exportContainer, { scale: 2 }).then(canvas => {
    const fmt = document.getElementById("exportFormat").value;
    const baseName = currentDetail.monsterName ? currentDetail.monsterName.replace(/\s+/g, "_") : "statblock";
    if(fmt === "png"){
      const a = document.createElement("a");
      a.download = baseName + ".png";
      a.href = canvas.toDataURL("image/png");
      a.click();
    } 
    
    // Temporarily disable PDF Export
    /* else {
      const pdf = new jspdf.jsPDF({
        orientation: "landscape",
        unit: "px",
        format: [canvas.width, canvas.height]
      });
      pdf.addImage(canvas.toDataURL("image/png"), 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(baseName + ".pdf");
    } */
   
    document.body.removeChild(exportContainer);
  });
}