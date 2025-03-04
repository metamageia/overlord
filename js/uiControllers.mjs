import { updateYamlTextArea, } from "./masterYamlData.mjs";

/* ---------------------------------------------
 * UI Controllers
 * ---------------------------------------------
 */

// Left Sidebar
export function toggleSidebar(){
  const leftSidebar = document.getElementById("sidebar");
  const rightSidebar = document.getElementById("bundlesSidebar");
  if(window.matchMedia("(max-width:480px)").matches){
    if(!rightSidebar.classList.contains("collapsed")){
      rightSidebar.classList.add("collapsed");
    }
  }
  leftSidebar.classList.toggle("collapsed");
}
export function switchSidebarTab(tab){
  ["library", "editor", "yaml"].forEach(t => {
    document.getElementById(t + "Toggle").classList.remove("active");
    document.getElementById(t + "Panel").classList.remove("active");
  });
  document.getElementById(tab + "Toggle").classList.add("active");
  document.getElementById(tab + "Panel").classList.add("active");
  if(tab === "yaml") updateYamlTextArea();
}

// Right Sidebar
export function toggleBundlesSidebar(){
  const leftSidebar = document.getElementById("sidebar");
  const rightSidebar = document.getElementById("bundlesSidebar");
  if(window.matchMedia("(max-width:480px)").matches){
    if(!leftSidebar.classList.contains("collapsed")){
      leftSidebar.classList.add("collapsed");
    }
  }
  rightSidebar.classList.toggle("collapsed");
}
export function switchBundlesTab(tab) {
  // Handle top-level tabs (Bundles, Backup)
  if (tab === "bundles" || tab === "backup") {
    // Hide all top-level panels
    document.querySelectorAll(".bundles-panel").forEach(p => p.classList.remove("active"));
    
    // Remove active class from all top-level tabs
    document.querySelectorAll(".bundles-tabs.top-tabs .bundles-tab").forEach(btn => 
      btn.classList.remove("active"));
    
    // Activate the selected top-level tab
    document.getElementById("bundles" + tab.charAt(0).toUpperCase() + tab.slice(1) + "Tab").classList.add("active");
    
    if (tab === "bundles") {
      // Show the subtabs when Bundles is selected
      document.getElementById("bundlesSubTabs").style.display = "flex";
      
      // If no subtab is active, default to Manage
      if (!document.querySelector("#bundlesSubTabs .bundles-tab.active")) {
        switchBundlesTab("manage");
      } else {
        // Get the currently active subtab and reactivate it
        const activeSubtab = document.querySelector("#bundlesSubTabs .bundles-tab.active").id;
        const subtabName = activeSubtab.replace("bundles", "").replace("Tab", "").toLowerCase();
        document.getElementById("bundles" + subtabName.charAt(0).toUpperCase() + subtabName.slice(1) + "Panel").classList.add("active");
      }
      
      // Show the bundles container panel
      document.getElementById("bundlesBundlesPanel").classList.add("active");
    } else {
      // Hide the subtabs for other top-level tabs
      document.getElementById("bundlesSubTabs").style.display = "none";
      
      // Activate the backup panel
      document.getElementById("bundlesBackupPanel").classList.add("active");
    }
  } else {
    // Handle subtabs (manage, upload, create, merge)
    // Remove active class from all subtabs
    document.querySelectorAll("#bundlesSubTabs .bundles-tab").forEach(btn => 
      btn.classList.remove("active"));
    
    // Activate the selected subtab
    document.getElementById("bundles" + tab.charAt(0).toUpperCase() + tab.slice(1) + "Tab").classList.add("active");
    
    // Hide all subtab panels
    document.querySelectorAll("#bundlesBundlesPanel > .bundles-panel").forEach(p => {
      p.classList.remove("active");
      // Move the panel into the bundles container
      document.getElementById("bundlesBundlesPanel").appendChild(p);
    });
    
    // Activate the selected subtab panel
    document.getElementById("bundles" + tab.charAt(0).toUpperCase() + tab.slice(1) + "Panel").classList.add("active");
  }
}

// --- Initial Sidebar Visibility --- //
export function setInitialSidebarVisibility(){
  const leftSidebar = document.getElementById("sidebar");
  const rightSidebar = document.getElementById("bundlesSidebar");
  // On mobile (max-width 480px), default both sidebars to hidden
  if(window.matchMedia("(max-width:480px)").matches){
    leftSidebar.classList.add("collapsed");
    rightSidebar.classList.add("collapsed");
  } else {
    leftSidebar.classList.remove("collapsed");
    rightSidebar.classList.remove("collapsed");
  }
}
// Add initialization for bundle panels on page load
export function initBundlePanels() {
  // Move all subtab panels into the bundles container panel if they're not already there
  const bundlesContainerPanel = document.getElementById("bundlesBundlesPanel");
  ["manage", "upload", "create", "merge"].forEach(subtab => {
    const panel = document.getElementById("bundles" + subtab.charAt(0).toUpperCase() + subtab.slice(1) + "Panel");
    if (panel && panel.parentElement !== bundlesContainerPanel) {
      bundlesContainerPanel.appendChild(panel);
    }
  });
}

// Sidebar Resizing
export function initResizeHandlers() {
  const leftSidebar = document.getElementById("sidebar");
  const rightSidebar = document.getElementById("bundlesSidebar");
  const content = document.querySelector(".content");
  const leftHandle = document.getElementById("leftResizeHandle");
  const maxContentWidth = 644; // Current max content width in desktop mode

  let isLeftResizing = false;
  let startX = 0;
  let startLeftWidth = 0;

  // Make sure sidebar has proper positioning for the handle
  function setupSidebarContainer() {
    // Ensure sidebar has position relative for absolute positioning of resize handle
    const sidebarStyle = window.getComputedStyle(leftSidebar);
    if (sidebarStyle.position !== 'relative' && sidebarStyle.position !== 'absolute') {
      leftSidebar.style.position = 'relative';
    }
    
    // Ensure sidebar has overflow visible or the handle might be cut off
    if (sidebarStyle.overflow === 'hidden') {
      leftSidebar.style.overflow = 'visible';
    }
  }

  // Left sidebar resize
  leftHandle.addEventListener("mousedown", e => {
    isLeftResizing = true;
    startX = e.clientX;
    startLeftWidth = leftSidebar.offsetWidth;
    leftHandle.classList.add("active");
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
    e.preventDefault(); // Prevent text selection
  });

  // Mouse move handler
  document.addEventListener("mousemove", e => {
    if (!isLeftResizing) return;
    
    // Get available space
    const windowWidth = window.innerWidth;
    
    // Calculate new width
    const newWidth = Math.max(200, Math.min(windowWidth * 0.4, startLeftWidth + (e.clientX - startX)));
    leftSidebar.style.width = `${newWidth}px`;
    
    // On desktop, adjust content width
    if (window.matchMedia("(min-width: 769px)").matches) {
      const rightSidebarWidth = rightSidebar.classList.contains("collapsed") ? 0 : rightSidebar.offsetWidth;
      const availableWidth = windowWidth - newWidth - rightSidebarWidth - 40; // padding/margins
      const contentWidth = Math.min(maxContentWidth, availableWidth);
      content.style.width = `${contentWidth}px`;
      content.style.marginLeft = `${newWidth + 20}px`;
    }
  });

  // Mouse up handler
  document.addEventListener("mouseup", () => {
    if (isLeftResizing) {
      isLeftResizing = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      leftHandle.classList.remove("active");
    }
  });

  // Reset on window resize to prevent layout issues
  window.addEventListener("resize", () => {
    if (window.matchMedia("(max-width: 768px)").matches) {
      leftSidebar.style.width = "";
      content.style.width = "";
      content.style.marginLeft = "";
    }
  });
  
  // Hide the right resize handle
  const rightHandle = document.getElementById("rightResizeHandle");
  if (rightHandle) {
    rightHandle.style.display = "none";
  }
  
  // Initial setup
  setupSidebarContainer();
}

