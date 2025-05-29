const refreshBtn = document.createElement("button");
refreshBtn.textContent = "Refresh";
refreshBtn.className = "refresh-bundle-btn";
refreshBtn.dataset.id = bundle.id;
refreshBtn.addEventListener("click", () => {
  // Use dataset id directly as bundle id is a hex string.
  const bundleId = refreshBtn.dataset.id;
  const bun = uploadedBundles.find(b => b.id === bundleId);
  if(bun){
    let added = 0;
    bun.data.forEach(sb => {
      sb.statblockID = generateStatblockID(sb);
      if(!statblocks.find(x => x.statblockID === sb.statblockID)){
        sb.bundleId = bundleId;
        statblocks.push(sb);
        added++;
      }
    });
    // Update bundle total explicitly.
    bun.total = bun.data.length;
    saveToLocalStorage();
    saveUploadedBundles();
    renderStatblockLibrary();
    fillBundleSelect();
    fillManageMergeSelect();
    renderUploadedBundles(); // Always re-render the bundles table to update total.
    alert(`Refreshed bundle: added ${added} missing statblock(s).`);
  }
});