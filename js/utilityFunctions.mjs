
/* ---------------------------------------------
 * Text Utilities
 * ---------------------------------------------
 */

// Title:Content Line Parsing on Deeds
export function parseDeedsStringNew(str){
  let deedBlocks = str.split(/\n\s*\n/).map(block => block.trim()).filter(block => block !== "");
  let result = [];
  deedBlocks.forEach(block => {
    let lines = block.split("\n").map(l => l.trim()).filter(Boolean);
    if(lines.length > 0){
      let deedObj = { title: lines[0], lines: [] };
      for(let i = 1; i < lines.length; i++){
        let line = lines[i];
        let colonIndex = line.indexOf(":");
        if(colonIndex !== -1){
          let key = line.substring(0, colonIndex).trim();
          let value = line.substring(colonIndex+1).trim();
          deedObj.lines.push({ title: key, content: value });
        } else {
          deedObj.lines.push({ title: line, content: "" });
        }
      }
      result.push(deedObj);
    }
  });
  return result;
}
// Number Parsing for Library and Bundle Filters
export function matchesNumericQuery(value, query) {
  if (!query.trim()) return true;
  
  // Convert value to number, handling undefined/null
  const numVal = value ? Number(value.toString().replace(/[^\d.-]/g, '')) : 0;
  if (isNaN(numVal)) return false;

  const segments = query.split(",").map(s => s.trim()).filter(Boolean);
  for (let seg of segments) {
    if (/^>\s*(\d+)$/.test(seg)) {
      const num = Number(seg.match(/^>\s*(\d+)$/)[1]);
      if (numVal > num) return true;
    } else if (/^>=\s*(\d+)$/.test(seg)) {
      const num = Number(seg.match(/^>=\s*(\d+)$/)[1]);
      if (numVal >= num) return true;
    } else if (/^<\s*(\d+)$/.test(seg)) {
      const num = Number(seg.match(/^<\s*(\d+)$/)[1]);
      if (numVal < num) return true;
    } else if (/^<=\s*(\d+)$/.test(seg)) {
      const num = Number(seg.match(/^<=\s*(\d+)$/)[1]);
      if (numVal <= num) return true;
    } else if (/^(\d+)\s*-\s*(\d+)$/.test(seg)) {
      const [, min, max] = seg.match(/^(\d+)\s*-\s*(\d+)$/);
      if (numVal >= Number(min) && numVal <= Number(max)) return true;
    } else if (!isNaN(Number(seg))) {
      if (numVal === Number(seg)) return true;
    }
  }
  return false;
}
// Filter String Parsing for Library and Bundle Filters
export function matchesStringQuery(text, query) {
  if (!query.trim()) return true;
  const segments = query.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
  const positive = [];
  const negative = [];
  segments.forEach(seg => {
    if (seg.startsWith("-")) {
      negative.push(seg.slice(1));
    } else {
      positive.push(seg);
    }
  });
  const positiveMatch = positive.length > 0 ? positive.some(seg => text.toLowerCase().includes(seg)) : true;
  const negativeMatch = negative.every(seg => !text.toLowerCase().includes(seg));
  return positiveMatch && negativeMatch;
}

// Convert markdown to sanitized HTML using global `marked` and `DOMPurify` when available.
export function mdToHtml(text) {
  if (!text && text !== 0) return "";
  const str = String(text);
  try {
    if (typeof marked !== 'undefined' && typeof DOMPurify !== 'undefined') {
      const raw = marked.parse(str);
      return DOMPurify.sanitize(raw);
    }
  } catch (e) {
    console.warn("mdToHtml: markdown render failed, falling back to plain text", e);
  }
  // Fallback: escape HTML and convert newlines to <br>
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
}

