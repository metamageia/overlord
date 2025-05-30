/* ---------------------------------------------
 * STATBLOCKID GENERATION CODE
 * ---------------------------------------------
 */
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return ("00000000" + (hash >>> 0).toString(16)).slice(-8);
}
function canonicalize(obj) {
  if (Array.isArray(obj)) {
    return obj.map(item => canonicalize(item));
  } else if (obj && typeof obj === "object" && !(obj instanceof Date)) {
    const sortedKeys = Object.keys(obj).sort();
    const newObj = {};
    for (let key of sortedKeys) {
      newObj[key] = canonicalize(obj[key]);
    }
    return newObj;
  }
  return obj;
}

export function generateStatblockID(statblockObj) {
  const copy = JSON.parse(JSON.stringify(statblockObj));
  delete copy.statblockID;
  delete copy.bundleId;
  const canonicalObj = canonicalize(copy);
  const str = JSON.stringify(canonicalObj);
  return hashString(str);
}
export function generateBundleID(bundleArray) {
  const clones = bundleArray.map(sb => {
    let copy = JSON.parse(JSON.stringify(sb));
    delete copy.statblockID;
    delete copy.bundleId;
    return copy;
  });
  clones.sort((a,b) => {
    const A = (a.monsterName || "").toLowerCase();
    const B = (b.monsterName || "").toLowerCase();
    return A.localeCompare(B);
  });
  const canonical = canonicalize(clones);
  const str = JSON.stringify(canonical);
  return hashString(str);
}

export function generateComponentID(componentObj) {
  const copy = JSON.parse(JSON.stringify(componentObj));
  delete copy.componentID; // Remove any existing componentID
  const canonicalObj = canonicalize(copy);
  const str = JSON.stringify(canonicalObj);
  return "comp-" + hashString(str);
}