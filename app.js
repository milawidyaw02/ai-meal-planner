import { GoogleGenerativeAI } from "@google/generative-ai";
import { GEMINI_API_KEY } from "./config.js";

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
const addMealBtn = document.getElementById('addMealBtn');

const emptyState = document.getElementById('emptyState');
const loadingState = document.getElementById('loadingState');
const resultCard = document.getElementById('resultCard');

// State
let currentFile = null;

// On Load: Check Persistence
document.addEventListener('DOMContentLoaded', () => {
    const savedData = localStorage.getItem('mealai_last_results');
    const savedInputs = localStorage.getItem('mealai_inputs');
    const savedImage = localStorage.getItem('mealai_saved_image');
    
    if (savedInputs) {
        const inputs = JSON.parse(savedInputs);
        budgetInput.value = inputs.budget || "";
        timeInput.value = inputs.time || "";
    }

    if (savedImage) {
        imagePreview.src = savedImage;
        imagePreviewContainer.classList.remove('hidden');
        uploadPlaceholder.classList.add('hidden');
    }

    if (savedData) {
        const data = JSON.parse(savedData);
        displayResults(data, true); // true = silent load
        emptyState.classList.add('hidden');
        resultCard.classList.remove('hidden');
        document.getElementById('quickActions').classList.remove('hidden');
    }
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

addMealBtn.addEventListener('click', async () => {
    const budget = budgetInput.value;
    const time = timeInput.value;
    
    if (GEMINI_API_KEY === "") {
        alert('Tolong masukkan API Key kamu di dalam file app.js pada variabel GEMINI_API_KEY ya!');
        return;
    }

    if (!currentFile && !localStorage.getItem('mealai_saved_image')) {
        alert('Tolong upload foto bahan makanan kamu dulu ya!');
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

        // Convert image to Base64 for the SDK (use current file OR saved image)
        let imageData;
        if (currentFile) {
            imageData = await fileToGenerativePart(currentFile);
        } else {
            const savedImage = localStorage.getItem('mealai_saved_image');
            imageData = {
                inlineData: { data: savedImage.split(',')[1], mimeType: "image/jpeg" }
            };
        }

        const prompt = `
            Saya adalah asisten koki cerdas dengan kemampuan analisa visual tingkat lanjut. Di depan saya ada foto bahan-bahan makanan.
            User memiliki budget Rp ${budget} dan waktu ${time} menit.
            
            Tugas kamu:
            1. Analisa bahan apa saja yang ada di foto.
            2. Berikan 5 saran menu masakan yang paling pas dengan bahan tersebut, budget, dan waktu yang ada.
            3. Pertimbangkan nutrisi (Kalori, Protein, Karbohidrat, Lemak).
            4. Berikan alasan kenapa menu ini cocok, sertakan data nutrisi (kalori, protein, dll) di dalam narasi alasan dan checklist tersebut agar user paham manfaat spesifiknya.

            OUTPUT HARUS DALAM FORMAT JSON SEPERTI BERIKUT:
            {
                "ingredients": ["Bahan A", "Bahan B", ...],
                "suggestions": [
                    {
                        "meal": "Nama Masakan 1",
                        "calories": "angka saja",
                        "protein": "angka+g",
                        "carbs": "angka+g",
                        "fat": "angka+g",
                        "reason": "Jelaskan kenapa menu ini cocok dengan menyebutkan keunggulan nutrisinya (misal: 'Menu ini mengandung 32g protein yang tinggi untuk otot...')",
                        "checklist": [
                            "Highlight Nutrisi 1 (misal: Serat tinggi dari sayuran)",
                            "Highlight Nutrisi 2 (misal: Kalori pas untuk budget energi)",
                            "Highlight Budget/Waktu"
                        ]
                    },
                    ... (sampai 5 menu detail)
                ],
                "monthly_plan": [
                    { "day": 1, "meal": "Menu Hari 1", "calories": "angka", "note": "catatan singkat masakan" },
                    ... (sampai 30 hari)
                ]
            }
            Hanya berikan JSON murni, jangan ada teks lain.
        `;

        // Attempt with primary model (Gemini 3)
        try {
            const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
            const result = await model.generateContent([prompt, imageData]);
            const response = await result.response;
            responseText = response.text();
        } catch (fallbackErr) {
            console.warn("Primary model busy, falling back...", fallbackErr);
            document.getElementById('loadingSubtitle').innerText = "Gemini 3 lagi sibuk, pakai model stabil ya...";
            
            const stableModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            const result = await stableModel.generateContent([prompt, imageData]);
            const response = await result.response;
            responseText = response.text();
        }
        
        // Extract JSON if AI wraps it in backticks or adds text
        let cleanJson = responseText;
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) cleanJson = jsonMatch[0];
        
        const data = JSON.parse(cleanJson);

        const resultData = {
            ingredients: data.ingredients,
            suggestions: data.suggestions,
            monthly_plan: data.monthly_plan,
            budget: budget,
            time: time
        };

        // Save to Persistence
        localStorage.setItem('mealai_last_results', JSON.stringify(resultData));
        localStorage.setItem('mealai_inputs', JSON.stringify({ budget, time }));

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
    const main = data.suggestions[0];
    
    document.getElementById('resMealName').innerText = main.meal;
    document.getElementById('resCalories').innerText = main.calories;
    document.getElementById('resProtein').innerText = main.protein;
    document.getElementById('resCarbs').innerText = main.carbs;
    document.getElementById('resFat').innerText = main.fat;
    document.getElementById('resPriceTag').innerText = `Est. Rp ${parseInt(data.budget).toLocaleString()}`;
    document.getElementById('resPlan').innerHTML = `
        <p>${main.reason}</p>
        <p><strong>Kenapa menu ini?</strong></p>
        <ul class="list-disc pl-5 space-y-2">
            ${main.checklist.map(item => `<li>${item}</li>`).join('')}
        </ul>
        <p class="italic text-indigo-600 font-medium pt-2">"Waktu memasak ${data.time} menit sangat ideal untuk hidangan ini."</p>
    `;

    // Render Ingredients
    const ingContainer = document.getElementById('resIngredients');
    ingContainer.innerHTML = data.ingredients.map(ing => `
        <span class="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 text-[10px] font-bold rounded-xl shadow-sm">
            ${ing}
        </span>
    `).join('');

    // Alternate Suggestions
    const otherSuggestions = document.getElementById('otherSuggestions');
    const suggestionsList = document.getElementById('suggestionsList');
    
    if (data.suggestions.length > 1) {
        otherSuggestions.classList.remove('hidden');
        suggestionsList.innerHTML = data.suggestions.slice(1).map(s => `
            <div class="glass p-5 rounded-3xl border border-white hover:border-indigo-100 transition-all group cursor-pointer" 
                    onclick="switchMainMeal('${s.meal.replace(/'/g, "\\'")}')">
                <div class="flex justify-between items-start mb-3">
                    <h5 class="font-black text-slate-900 leading-tight text-xs">${s.meal}</h5>
                    <span class="text-[9px] font-black text-indigo-500 bg-indigo-50 px-2 py-1 rounded-lg shrink-0 ml-2">${s.calories} Kcal</span>
                </div>
                <p class="text-[9px] text-slate-500 line-clamp-2">${s.reason}</p>
            </div>
        `).join('');
    } else {
        otherSuggestions.classList.add('hidden');
    }

    // Render Monthly Schedule
    const monthlySection = document.getElementById('monthlySchedule');
    const calendarContainer = document.getElementById('calendarContainer');
    
    if (data.monthly_plan) {
        monthlySection.classList.remove('hidden');
        calendarContainer.innerHTML = data.monthly_plan.map(d => `
            <div class="day-card glass p-4 rounded-2xl border border-white hover:border-indigo-100 shadow-sm flex flex-col justify-between h-32 cursor-pointer" 
                    onclick="showMealDetail(${d.day})">
                <div>
                    <span class="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Day ${d.day}</span>
                    <h6 class="text-[11px] font-black text-slate-800 leading-tight mt-1 line-clamp-2">${d.meal}</h6>
                </div>
                <div class="mt-2 pt-2 border-t border-slate-50 flex items-center justify-between">
                    <span class="text-[9px] font-bold text-indigo-500">${d.calories} kcal</span>
                    <i data-lucide="chevron-right" size="10" class="text-slate-300"></i>
                </div>
            </div>
        `).join('');
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

    document.getElementById('modalDay').innerText = `Day ${day} Plan`;
    document.getElementById('modalMealName').innerText = dayPlan.meal;
    document.getElementById('modalCalories').innerText = dayPlan.calories;
    document.getElementById('modalDescription').innerText = dayPlan.note || `Menu sehat yang dirancang khusus untuk memenuhi kebutuhan nutrisi kamu di hari ke-${day}.`;
    
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

window.switchMainMeal = (mealName) => {
    const data = window.lastData;
    const selected = data.suggestions.find(s => s.meal === mealName);
    if (!selected) return;

    // Simple swap: Move selected to index 0
    const index = data.suggestions.indexOf(selected);
    data.suggestions.splice(index, 1);
    data.suggestions.unshift(selected);
    
    // Persist the swap
    localStorage.setItem('mealai_last_results', JSON.stringify(data));
    
    displayResults(data);
    window.scrollTo({ top: document.getElementById('resultCard').offsetTop - 100, behavior: 'smooth' });
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
