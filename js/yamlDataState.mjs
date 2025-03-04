/* ---------------------------------------------
 * DEFINE MASTER YAML VARIABLES
 * ---------------------------------------------
 */
export const masterYamlData = {};
export const DEFAULT_STATS = {
    hp: "HP",
    init: "INIT",
    acc: "ACC",
    grd: "GRD",
    res: "RES",
    roll: "ROLL",
    spd: "SPD"
  };
export const hiddenStats = new Set();  // Tracks which default stats are hidden
  
/* ---------------------------------------------
 * MASTER YAML UPDATE FUNCTIONS
 * ---------------------------------------------
 */
export function updateMasterYamlData(newData) {
    Object.assign(masterYamlData, newData);  // Mutates the object
}
export function resetMasterYamlData() {
    Object.keys(masterYamlData).forEach(key => delete masterYamlData[key]);  // Clears the object content
}
