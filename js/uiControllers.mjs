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
  // First hide all panels
  document.querySelectorAll(".bundles-panel").forEach(p => 
    p.classList.remove("active"));
  
  // Remove active class from all top-level and sub-tabs
  document.querySelectorAll(".bundles-tabs .bundles-tab").forEach(btn => 
    btn.classList.remove("active"));
  
  if(tab === "bundles") {
    // Show the bundles container panel
    document.getElementById("bundlesBundlesPanel").classList.add("active");
    
    // Show the subtabs row
    document.getElementById("bundlesSubTabs").style.display = "flex";
    
    // Activate the bundles top-level tab
    document.getElementById("bundlesBundlesTab").classList.add("active");
    
    // Activate the first subtab (manage) by default
    document.getElementById("bundlesManageTab").classList.add("active");
    document.getElementById("bundlesManagePanel").classList.add("active");
    
  } else if(tab === "components") {
    // Hide the subtabs for components tab
    document.getElementById("bundlesSubTabs").style.display = "none";
    
    // Activate the components tab
    document.getElementById("bundlesComponentsTab").classList.add("active");
    
    // Show the components panel
    document.getElementById("bundlesComponentsPanel").classList.add("active");
    
    // Render the components list
    import('./componentManagement.mjs').then(module => {
      module.renderComponentsList();
    });
    
  } else if(tab === "backup") {
    // Hide the subtabs for backup tab
    document.getElementById("bundlesSubTabs").style.display = "none";
    
    // Activate the backup tab
    document.getElementById("bundlesBackupTab").classList.add("active");
    
    // Show the backup panel
    document.getElementById("bundlesBackupPanel").classList.add("active");
    
  } else {
    // We're dealing with a subtab (manage, upload, create, merge)
    
    // Show the bundles container panel and subtabs
    document.getElementById("bundlesBundlesPanel").classList.add("active");
    document.getElementById("bundlesSubTabs").style.display = "flex";
    document.getElementById("bundlesBundlesTab").classList.add("active");
    
    // Activate the clicked subtab
    document.getElementById("bundles" + tab.charAt(0).toUpperCase() + tab.slice(1) + "Tab").classList.add("active");
    
    // Show the selected subtab panel
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
  
  // Make sure components panel is not inside the bundles container panel
  const componentsPanel = document.getElementById("bundlesComponentsPanel");
  if (componentsPanel && componentsPanel.parentElement === bundlesContainerPanel) {
    componentsPanel.parentElement.removeChild(componentsPanel);
    document.getElementById("bundlesSidebar").appendChild(componentsPanel);
  }
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

