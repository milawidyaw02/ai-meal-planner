import { GoogleGenerativeAI } from "@google/generative-ai";
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
// Init Lucide
lucide.createIcons();

// Elements
const fileUpload = document.getElementById('fileUpload');
const dropZone = document.getElementById('dropZone');
const imagePreview = document.getElementById('imagePreview');
const imagePreviewContainer = document.getElementById('imagePreviewContainer');
const uploadPlaceholder = document.getElementById('uploadPlaceholder');
const budgetInput = document.getElementById('budget');
const timeInput = document.getElementById('timeProcess');
const manualsInput = document.getElementById('manualIngredients');
const addMealBtn = document.getElementById('addMealBtn');

const emptyState = document.getElementById('emptyState');
const loadingState = document.getElementById('loadingState');
const resultCard = document.getElementById('resultCard');

// State
let currentFile = null;
let activeIngTab = 'photo'; // 'photo' or 'manual'

// On Load: Check Persistence
document.addEventListener('DOMContentLoaded', () => {
    const savedData = localStorage.getItem('mealai_last_results');
    const savedInputs = localStorage.getItem('mealai_inputs');
    const savedImage = localStorage.getItem('mealai_saved_image');
    
    if (savedInputs) {
        const inputs = JSON.parse(savedInputs);
        if (inputs.budget) {
            budgetInput.value = new Intl.NumberFormat('id-ID').format(inputs.budget);
        }
        timeInput.value = inputs.time || "";
        if (manualsInput) manualsInput.value = inputs.manuals || "";
        
        if (inputs.mode) {
            const modeRadio = document.querySelector(`input[name="planMode"][value="${inputs.mode}"]`);
            if (modeRadio) modeRadio.checked = true;
        }

        if (inputs.duration) {
            const durationRadio = document.querySelector(`input[name="planDuration"][value="${inputs.duration}"]`);
            if (durationRadio) durationRadio.checked = true;
        }

        if (inputs.activeTab) {
            switchInputTab(inputs.activeTab, true); // silent switch
        }
    }

    if (savedImage) {
        imagePreview.src = savedImage;
        imagePreviewContainer.classList.remove('hidden');
        uploadPlaceholder.classList.add('hidden');
    }

    // Budget Formatting (Thousand Separator)
    budgetInput.addEventListener('input', (e) => {
        let value = e.target.value.replace(/\D/g, "");
        if (value) {
            e.target.value = new Intl.NumberFormat('id-ID').format(value);
        }
    });

    if (savedData) {
        const data = JSON.parse(savedData);
        displayResults(data, true); // true = silent load
        emptyState.classList.add('hidden');
        resultCard.classList.remove('hidden');
        document.getElementById('quickActions').classList.remove('hidden');
    }

    // Toggle Duration Selector based on Mode
    const modeRadios = document.querySelectorAll('input[name="planMode"]');
    const durationSelector = document.getElementById('durationSelector');
    
    const updateDurationVisibility = () => {
        const mode = document.querySelector('input[name="planMode"]:checked').value;
        if (mode === 'regular') {
            durationSelector.classList.remove('hidden');
        } else {
            durationSelector.classList.add('hidden');
        }
    };

    modeRadios.forEach(r => r.addEventListener('change', updateDurationVisibility));
    updateDurationVisibility(); // Initial check
});

// Logic
dropZone.addEventListener('click', () => fileUpload.click());

fileUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    handleFileSelection(file);
});

function handleFileSelection(file) {
    if (file) {
        currentFile = file;
        const reader = new FileReader();
        reader.onload = (re) => {
            const base64 = re.target.result;
            imagePreview.src = base64;
            imagePreviewContainer.classList.remove('hidden');
            uploadPlaceholder.classList.add('hidden');
            // Save image to persistence
            localStorage.setItem('mealai_saved_image', base64);
        };
        reader.readAsDataURL(file);
    }
}

window.resetUpload = (e) => {
    e.stopPropagation();
    fileUpload.value = '';
    currentFile = null;
    localStorage.removeItem('mealai_saved_image');
    imagePreviewContainer.classList.add('hidden');
    uploadPlaceholder.classList.remove('hidden');
};

window.switchInputTab = (tab, isSilent = false) => {
    activeIngTab = tab;
    const photoSection = document.getElementById('photoInputSection');
    const manualSection = document.getElementById('manualInputSection');
    const btnPhoto = document.getElementById('tabBtnPhoto');
    const btnManual = document.getElementById('tabBtnManual');

    if (tab === 'photo') {
        photoSection.classList.remove('hidden');
        manualSection.classList.add('hidden');
        btnPhoto.className = "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all duration-300 bg-white shadow-md text-indigo-600 font-bold text-xs uppercase tracking-widest";
        btnManual.className = "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all duration-300 text-slate-400 font-bold text-xs uppercase tracking-widest hover:text-slate-600";
    } else {
        photoSection.classList.add('hidden');
        manualSection.classList.remove('hidden');
        btnManual.className = "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all duration-300 bg-white shadow-md text-indigo-600 font-bold text-xs uppercase tracking-widest";
        btnPhoto.className = "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all duration-300 text-slate-400 font-bold text-xs uppercase tracking-widest hover:text-slate-600";
    }

    if (!isSilent) {
        // Update persistence
        const savedInputs = JSON.parse(localStorage.getItem('mealai_inputs') || '{}');
        savedInputs.activeTab = tab;
        localStorage.setItem('mealai_inputs', JSON.stringify(savedInputs));
    }
    
    lucide.createIcons();
};

addMealBtn.addEventListener('click', async () => {
    const budgetFormatted = budgetInput.value;
    const budget = budgetFormatted.replace(/\./g, ""); // Strip dots for backend logic
    const time = timeInput.value;
    const manuals = manualsInput.value;
    const planMode = document.querySelector('input[name="planMode"]:checked').value;
    const planDuration = planMode === 'regular' ? document.querySelector('input[name="planDuration"]:checked').value : "30";
    
    if (GEMINI_API_KEY === "") {
        alert('Tolong masukkan API Key kamu di dalam file app.js pada variabel GEMINI_API_KEY ya!');
        return;
    }

    if (activeIngTab === 'photo' && !currentFile && !localStorage.getItem('mealai_saved_image')) {
        alert('Tolong upload foto bahan makanan kamu dulu ya!');
        return;
    }

    if (activeIngTab === 'manual' && !manuals.trim()) {
        alert('Tolong ketik bahan makanan kamu dulu ya!');
        return;
    }

    if (!budget || !time) {
        alert('Tolong masukkan budget dan waktu memasak ya!');
        return;
    }

    // UI Transitions
    emptyState.classList.add('hidden');
    resultCard.classList.add('hidden');
    loadingState.classList.remove('hidden');
    document.getElementById('loadingSubtitle').innerText = "Our AI is crafting your recipe";
    addMealBtn.disabled = true;
    addMealBtn.classList.add('opacity-50', 'cursor-not-allowed');

    try {
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        let responseText = "";

        // Convert image to Base64 for the SDK only if in photo mode
        let imageData = null;
        if (activeIngTab === 'photo') {
            if (currentFile) {
                imageData = await fileToGenerativePart(currentFile);
            } else {
                const savedImage = localStorage.getItem('mealai_saved_image');
                if (savedImage) {
                    imageData = {
                        inlineData: { data: savedImage.split(',')[1], mimeType: "image/jpeg" }
                    };
                }
            }
        }

        let prompt = "";
        if (planMode === 'ramadhan') {
            prompt = `
                Saya adalah asisten koki cerdas. Analisa bahan masakan dari ${activeIngTab === 'photo' ? 'foto yang saya lampirkan' : 'daftar teks berikut: "' + manuals + '"'}.
                Budget maksimal Rp ${budget} dan waktu ${time} menit per hidangan.
                Buatkan Jadwal Makan 30 Hari Spesial Bulan Ramadhan (Menu Sahur dan Menu Berbuka).
                
                OUTPUT JSON:
                {
                    "ingredients": ["Bahan A", ...],
                    "mode": "ramadhan",
                    "monthly_plan": [
                        { 
                            "day": 1, 
                            "meals": [
                                { "type": "Sahur", "meal": "...", "calories": "...", "recipe": ["..."] },
                                { "type": "Berbuka", "meal": "...", "calories": "...", "recipe": ["..."] }
                            ],
                            "note": "..."
                        }
                    ]
                }
            `;
        } else {
            prompt = `
                Saya adalah asisten koki cerdas. Analisa bahan masakan dari ${activeIngTab === 'photo' ? 'foto yang saya lampirkan' : 'daftar teks berikut: "' + manuals + '"'}.
                Budget maksimal Rp ${budget} dan waktu ${time} menit per hidangan.
                Buatkan Jadwal Makan ${planDuration} Hari (Sarapan, Makan Siang, Makan Malam).
                ${planDuration === "1" ? "Berikan saran menu untuk 1 hari saja." : "Berikan saran menu lengkap untuk 30 hari."}
                
                OUTPUT JSON:
                {
                    "ingredients": ["Bahan A", ...],
                    "mode": "regular",
                    "duration": ${planDuration},
                    "monthly_plan": [
                        { 
                            "day": 1, 
                            "meals": [
                                { "type": "Sarapan", "meal": "...", "calories": "...", "recipe": ["..."] },
                                { "type": "Makan Siang", "meal": "...", "calories": "...", "recipe": ["..."] },
                                { "type": "Makan Malam", "meal": "...", "calories": "...", "recipe": ["..."] }
                            ],
                            "note": "..."
                        }
                    ]
                }
            `;
        }
        prompt += " Hanya berikan JSON murni tanpa markdown atau teks lainnya.";

        // Attempt with primary model (Gemini 3)
        const chatContent = [prompt];
        if (imageData) chatContent.push(imageData);

        try {
            // Using gemini-1.5-flash with explicit v1 API for maximum stability
            const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" }, { apiVersion: "v1" });
            const result = await model.generateContent(chatContent);
            const response = await result.response;
            responseText = response.text();
        } catch (err) {
            console.error("AI Generation Error:", err);
            loadingState.classList.add('hidden');
            addMealBtn.disabled = false;
            addMealBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            alert('Waduh, ada masalah pas hubungin AI: ' + err.message);
            return;
        }
        
        // Extract JSON if AI wraps it in backticks or adds text
        let cleanJson = responseText;
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) cleanJson = jsonMatch[0];
        
        const data = JSON.parse(cleanJson);

        const resultData = {
            ingredients: data.ingredients,
            monthly_plan: data.monthly_plan,
            mode: data.mode || planMode,
            duration: data.duration || planDuration,
            budget: budget,
            time: time,
            manuals: manuals
        };

        // Save to Persistence
        localStorage.setItem('mealai_last_results', JSON.stringify(resultData));
        localStorage.setItem('mealai_inputs', JSON.stringify({ budget, time, manuals, mode: planMode, duration: planDuration, activeTab: activeIngTab }));

        displayResults(resultData);

        loadingState.classList.add('hidden');
        resultCard.classList.remove('hidden');
        document.getElementById('quickActions').classList.remove('hidden');
    } catch (error) {
        console.error(error);
        alert('Waduh, ada masalah pas hubungin AI: ' + error.message);
        loadingState.classList.add('hidden');
        emptyState.classList.remove('hidden');
    } finally {
        addMealBtn.disabled = false;
        addMealBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        lucide.createIcons();
    }
});

async function fileToGenerativePart(file) {
    const base64EncodedDataPromise = new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(file);
    });
    return {
        inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
    };
}

function displayResults(data, isSilent = false) {
    // Render Ingredients
    const ingContainer = document.getElementById('resIngredients');
    const ingredients = data.ingredients || [];
    ingContainer.innerHTML = ingredients.map(ing => `
        <span class="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 text-[10px] font-bold rounded-xl shadow-sm">
            ${ing}
        </span>
    `).join('');

    // Render Monthly Schedule
    const monthlySection = document.getElementById('monthlySchedule');
    const calendarContainer = document.getElementById('calendarContainer');
    
    if (data.monthly_plan && Array.isArray(data.monthly_plan)) {
        monthlySection.classList.remove('hidden');
        
        // Update Title based on mode
        const titleEl = document.querySelector('#monthlySchedule h4');
        const subTitleEl = document.querySelector('#monthlySchedule p');
        if (data.mode === 'ramadhan') {
            titleEl.innerText = "Jadwal Sahur & Berbuka";
            subTitleEl.innerText = "Spesial 30 Hari Ramadhan";
        } else {
            titleEl.innerText = data.duration === "1" ? "Jadwal Makan Hari Ini" : "Jadwal Makan Harian";
            subTitleEl.innerText = data.duration === "1" ? "Rencana Nutrisi 1 Hari" : "Rencana 30 Hari Sehat & Hemat";
        }

        // Adjust calendar grid for 1 day
        if (data.duration === "1") {
            calendarContainer.className = "flex justify-center py-8";
        } else {
            calendarContainer.className = "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4";
        }

        calendarContainer.innerHTML = data.monthly_plan.map(d => {
            const meals = d.meals || [];
            const totalCals = meals.reduce((sum, m) => sum + parseInt(m.calories || 0), 0);
            const cardClass = data.duration === "1" ? "w-full max-w-sm" : "";
            
            return `
                <div class="day-card glass p-4 rounded-2xl border border-white hover:border-indigo-100 shadow-sm flex flex-col justify-between min-h-[11rem] h-auto cursor-pointer ${cardClass}" 
                        onclick="showMealDetail(${d.day})">
                    <div class="space-y-2">
                        <span class="text-[10px] font-black text-slate-400 uppercase tracking-tighter">${data.duration === "1" ? "Menu Hari Ini" : "Hari Ke-" + d.day}</span>
                        
                        <div class="space-y-1">
                            ${meals.map((m, idx) => `
                                <div class="flex flex-col ${idx > 0 ? 'pt-1' : ''}">
                                    <span class="text-[8px] font-bold ${idx === 0 ? 'text-indigo-500' : idx === 1 ? 'text-amber-600' : 'text-emerald-600'} uppercase tracking-wider">
                                        ${m.type}
                                    </span>
                                    <h6 class="text-[9px] font-black text-slate-800 leading-tight break-words px-0.5">${m.meal}</h6>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    <div class="mt-2 pt-2 border-t border-slate-50 flex items-center justify-between">
                        <span class="text-[9px] font-bold text-slate-500">${totalCals} Total Kcal</span>
                        <i data-lucide="chevron-right" size="10" class="text-slate-300"></i>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Save all suggestions to state for switching
    window.lastData = data;

    if (!isSilent) {
        window.scrollTo({ top: document.getElementById('resultCard').offsetTop - 100, behavior: 'smooth' });
    }

    lucide.createIcons();
}

window.scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
};

window.clearAllData = () => {
    if (confirm('Kamu yakin ingin menghapus semua data rencana makan ini?')) {
        localStorage.removeItem('mealai_last_results');
        localStorage.removeItem('mealai_inputs');
        localStorage.removeItem('mealai_saved_image');
        location.reload();
    }
};

window.showMealDetail = (day) => {
    const data = window.lastData;
    const dayPlan = data.monthly_plan.find(d => d.day === day);
    if (!dayPlan) return;

    document.getElementById('modalDay').innerText = `Rencana Hari Ke-${day}`;
    document.getElementById('modalDescription').innerText = dayPlan.note || `Menu sehat yang dirancang khusus untuk memenuhi kebutuhan nutrisi kamu pada hari ke-${day}.`;
    
    const container = document.getElementById('modalMealsContainer');
    const meals = dayPlan.meals || [];
    container.innerHTML = meals.map((m, idx) => {
        const colors = [
            { bg: 'bg-indigo-50/50', border: 'border-indigo-100/50', hover: 'hover:border-indigo-300', text: 'text-indigo-600', accent: 'text-indigo-700', marker: 'marker:text-indigo-400', icon: 'moon', iconColor: 'text-indigo-400' },
            { bg: 'bg-amber-50/50', border: 'border-amber-100/50', hover: 'hover:border-amber-300', text: 'text-amber-600', accent: 'text-amber-700', marker: 'marker:text-amber-400', icon: 'sun', iconColor: 'text-amber-500' },
            { bg: 'bg-emerald-50/50', border: 'border-emerald-100/50', hover: 'hover:border-emerald-300', text: 'text-emerald-600', accent: 'text-emerald-700', marker: 'marker:text-emerald-400', icon: 'utensils', iconColor: 'text-emerald-400' }
        ];
        const color = colors[idx % colors.length];
        
        return `
            <div class="${color.bg} p-5 rounded-2xl border ${color.border} relative overflow-hidden group ${color.hover} transition-colors">
                <div class="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <i data-lucide="${m.type.toLowerCase().includes('sahur') ? 'moon' : m.type.toLowerCase().includes('berbuka') ? 'sun' : color.icon}" class="${color.iconColor}" size="24"></i>
                </div>
                <p class="text-[10px] font-black ${color.text} uppercase tracking-widest mb-1 relative z-10">Menu ${m.type}</p>
                <h4 class="text-sm font-bold text-slate-800 leading-tight mb-3 relative z-10 min-h-[40px] break-words">${m.meal}</h4>
                <div class="inline-block bg-white px-3 py-1.5 rounded-lg border ${color.border} shadow-sm relative z-10 mb-4">
                    <p class="text-xs font-black ${color.accent} flex items-center gap-1">
                        <span>${m.calories}</span> Kcal
                    </p>
                </div>
                
                <div class="pt-4 border-t ${color.border} relative z-10">
                    <h5 class="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1 mb-2">
                        <i data-lucide="book-open" size="12"></i> Resep Singkat
                    </h5>
                    <div class="max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                        <ul class="text-[11px] text-slate-600 space-y-2 list-decimal list-outside pl-4 font-medium ${color.marker}">
                            ${m.recipe ? m.recipe.map(step => `<li>${step}</li>`).join('') : '<li>Resep tidak tersedia</li>'}
                        </ul>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // Total Calories
    const totalKcal = meals.reduce((sum, m) => sum + parseInt(m.calories || 0), 0);
    document.getElementById('modalTotalCalories').innerText = `${totalKcal} Total Kcal / Hari`;
    
    const modal = document.getElementById('mealModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    
    lucide.createIcons();
};

window.closeMealModal = () => {
    const modal = document.getElementById('mealModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
};

// Drag & Drop effects
['dragenter', 'dragover'].forEach(name => {
    dropZone.addEventListener(name, (e) => {
        e.preventDefault();
        dropZone.classList.add('bg-indigo-50', 'border-indigo-600');
    });
});

['dragleave', 'drop'].forEach(name => {
    dropZone.addEventListener(name, (e) => {
        e.preventDefault();
        dropZone.classList.remove('bg-indigo-50', 'border-indigo-600');
    });
});

dropZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const file = dt.files[0];
    fileUpload.files = dt.files;
    handleFileSelection(file);
});
