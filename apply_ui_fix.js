const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// 1. Wrap the standard UI components in a container
const oldHtmlStart = `<div class="relative mb-2">
                            <i data-lucide="search" class="w-4 h-4 absolute left-3 top-3 text-[#A3A095]"></i>
                            <input type="text" id="model-search-input"`;

const newHtmlStart = `<div id="standard-model-ui">
                        <div class="relative mb-2">
                            <i data-lucide="search" class="w-4 h-4 absolute left-3 top-3 text-[#A3A095]"></i>
                            <input type="text" id="model-search-input"`;

html = html.replace(oldHtmlStart, newHtmlStart);

const oldHtmlEnd = `                        <div id="model-cards-container" class="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                            <!-- Cards populated by JS -->
                        </div>`;

const newHtmlEnd = `                        <div id="model-cards-container" class="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                            <!-- Cards populated by JS -->
                        </div>
                        </div>`;

html = html.replace(oldHtmlEnd, newHtmlEnd);

// 2. Update the settings-model input to support being a text input
const oldSettingsModel = `<input type="hidden" id="settings-model" value="gemini-2.5-flash">`;
const newSettingsModel = `<input type="hidden" id="settings-model" value="gemini-2.5-flash" class="w-full bg-white border border-[#E5E3DB] rounded-xl px-3 py-2.5 text-[13px] text-[#2C2B29] focus:outline-none focus:ring-2 focus:ring-[#D25D38]/20 mt-1" placeholder="Enter custom model ID (e.g. nvidia/llama3)">`;

html = html.replace(oldSettingsModel, newSettingsModel);

// 3. Update renderModelCards logic
const oldRenderLogic = `        // Filter models by platform first
        let modelsToRender = modelDirectory.filter(m => m.platform === currentPlatform);
        
        // If no models for this platform, show all models (for custom/other platforms)
        if (modelsToRender.length === 0) {
            modelsToRender = modelDirectory;
        }`;

const newRenderLogic = `        // Filter models by platform first
        let modelsToRender = modelDirectory.filter(m => m.platform === currentPlatform);
        
        const standardUi = document.getElementById('standard-model-ui');
        const settingsModelInput = document.getElementById('settings-model');
        const hintEl = document.getElementById('model-hint');
        
        // If no models for this platform, hide standard UI and show text bar
        if (modelsToRender.length === 0) {
            if (standardUi) standardUi.style.display = 'none';
            if (settingsModelInput) {
                settingsModelInput.type = 'text';
                settingsModelInput.oninput = () => { if(typeof updateModelSelection === 'function') updateModelSelection(); };
            }
            if (hintEl) hintEl.innerHTML = 'Enter a custom model ID for this platform.';
            return;
        } else {
            if (standardUi) standardUi.style.display = 'block';
            if (settingsModelInput) {
                settingsModelInput.type = 'hidden';
                settingsModelInput.oninput = null;
            }
            if (hintEl) hintEl.innerHTML = 'Common: <span class="font-mono text-[#5B5951]">gemini-2.5-flash</span> &middot; <span class="font-mono text-[#5B5951]">gemini-2.5-pro</span>';
        }`;

html = html.replace(oldRenderLogic, newRenderLogic);

// 4. Update populateModelDropdown logic
const oldPopulateLogic = `        // Get models for the current platform
        const platformModels = modelDirectory.filter(m => m.platform === currentPlatform);
        
        // If no models for platform, show all (for custom/free platforms)
        const modelsToShow = platformModels.length > 0 ? platformModels : modelDirectory;
        
        // Build options
        let html = '<option value="">-- Select Model --</option>';
        
        if (platformModels.length > 0) {`;

const newPopulateLogic = `        // Get models for the current platform
        const platformModels = modelDirectory.filter(m => m.platform === currentPlatform);
        
        if (platformModels.length === 0) {
            // No predefined models for this platform, the dropdown will be hidden by renderModelCards
            return;
        }
        
        // Build options
        let html = '<option value="">-- Select Model --</option>';
        
        if (platformModels.length > 0) {`;

html = html.replace(oldPopulateLogic, newPopulateLogic);

// Check if all replacements succeeded
if (!html.includes('id="standard-model-ui"')) console.error("Failed to inject standard-model-ui start");
if (!html.includes('</div>\n                        <input type="hidden" id="settings-model"')) console.error("Failed to inject standard-model-ui end");
if (!html.includes('class="w-full bg-white border border')) console.error("Failed to update settings-model");
if (!html.includes('if (standardUi) standardUi.style.display = \'none\';')) console.error("Failed to update renderModelCards");

fs.writeFileSync('index.html', html, 'utf8');
console.log('Update complete');
