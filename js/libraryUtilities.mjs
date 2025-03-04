export let currentSortField = "monsterName";
export let currentSortDirection = "asc";

export function setCurrentSortField(field) {
    currentSortField = field;
}
  
export function setCurrentSortDirection(direction) {
    currentSortDirection = direction;
}

export function toggleSortDirection() {
    currentSortDirection = (currentSortDirection === "asc") ? "desc" : "asc";
    return currentSortDirection; // Optionally return the new direction
  }