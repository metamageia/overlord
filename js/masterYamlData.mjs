export const masterYamlData = {}; // Mutable object

export function updateMasterYamlData(newData) {
    Object.assign(masterYamlData, newData);  // Mutates the object
}

export function resetMasterYamlData() {
    Object.keys(masterYamlData).forEach(key => delete masterYamlData[key]);  // Clears the object content
}