import { masterYamlData } from './yamlDataState.mjs';
import { updateUIFromMasterYaml, updateYamlTextArea } from './masterYamlData.mjs';
import { updateRenderedStatblock } from './statblockRender.mjs';
import { parseDeedsStringNew } from './utilityFunctions.mjs';

let cachedTemplates = null;

export async function loadRoleTemplates() {
  if (cachedTemplates) return cachedTemplates;
  try {
    const resp = await fetch('./core-bundles/role-templates.json');
    cachedTemplates = await resp.json();
    return cachedTemplates;
  } catch (e) {
    console.error('Failed to load role templates:', e);
    throw e;
  }
}

export async function findRoleTemplate(role, level) {
  const templates = await loadRoleTemplates();
  if (templates && Array.isArray(templates)) {
    const lv = Number(level);
    return templates.find(t => (t.role === role) && (Number(t.level) === lv));
  }
  return null;
}

// Apply a role template object to masterYamlData using the same logic as component presets
export function applyRoleTemplateObject(templateObj, opts = { overwrite: false }) {
  if (!templateObj) return;

  try {
    const applied = { stats: [], features: [], deeds: [] };
    // Deed types: merge (append) to existing deeds
    ["lightDeeds", "heavyDeeds", "mightyDeeds", "tyrantDeeds", "specialDeeds"].forEach(deedType => {
      if (templateObj[deedType]) {
        if (opts.overwrite) {
          masterYamlData[deedType] = templateObj[deedType];
        } else {
          let existing = masterYamlData[deedType] || "";
          let existingArr = [];
          if (existing && typeof existing === 'string') existingArr = parseDeedsStringNew(existing);
          const newArr = parseDeedsStringNew(templateObj[deedType]);
          const combined = existingArr.concat(newArr);
          masterYamlData[deedType] = combined.map(d => d.trim()).join('\n\n');
        }
        applied.deeds.push(deedType);
      }
    });

    // Features: copy keys that don't already exist
    if (templateObj.features && typeof templateObj.features === 'object') {
      if (!masterYamlData.features) masterYamlData.features = {};
      Object.keys(templateObj.features).forEach(k => {
        if (opts.overwrite || !masterYamlData.features[k]) {
          masterYamlData.features[k] = templateObj.features[k];
          applied.features.push(k);
        }
      });
    }

    // Copy other basic stats only if not already set
    const basicKeys = ['hp','init','acc','grd','res','roll','spd','tr'];
    basicKeys.forEach(k => {
      if (templateObj[k] !== undefined && (opts.overwrite || masterYamlData[k] === undefined || masterYamlData[k] === "")) {
        masterYamlData[k] = templateObj[k];
        applied.stats.push(k);
      }
    });

    // Do not overwrite monsterName, role, level or template to avoid unwanted changes

    // Refresh UI
    updateUIFromMasterYaml();
    updateYamlTextArea();
    updateRenderedStatblock();
    // Inform other UI consumers
    document.dispatchEvent(new CustomEvent('refreshUI'));
    return applied;
  } catch (e) {
    console.error('Error applying role template:', e);
    throw e;
  }
}

export async function applyRoleTemplateFromUI(role, level) {
  // Silent, immediate apply with overwrite
  if (!role || role === "" || level === "" || level === undefined || level === null) return;
  try {
    const tmpl = await findRoleTemplate(role, level);
    if (!tmpl) return;
    const changes = applyRoleTemplateObject(tmpl, { overwrite: true });
    console.log('Applied preset', role, level, changes);
  } catch (e) {
    console.error('Failed to apply preset:', e);
  }
}
