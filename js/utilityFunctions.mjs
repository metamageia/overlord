
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

