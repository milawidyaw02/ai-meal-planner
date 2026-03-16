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
            Saya adalah asisten koki cerdas dengan kemampuan analisa visual tingkat lanjut. Di depan saya ada foto bahan-bahan masakan.
            User memiliki budget maksimal Rp ${budget} dan waktu memasak ${time} menit per hidangan.
            
            Tugas kamu:
            1. Analisa bahan apa saja yang ada di foto.
            2. Buatkan Jadwal Makan 30 Hari Spesial Bulan Ramadhan (Menu Sahur dan Menu Berbuka).
            3. Menu harus kreatif, bergizi seimbang, dan sedapat mungkin memanfaatkan bahan yang di foto (dikombinasikan dengan bahan umum lainnya sesuai budget).
            4. Sertakan cara memasak langkah demi langkah (recipe) singkat untuk setiap menu Sahur dan Berbuka.

            OUTPUT HARUS DALAM FORMAT JSON SEPERTI BERIKUT:
            {
                "ingredients": ["Bahan A", "Bahan B", ...],
                "monthly_plan": [
                    { 
                        "day": 1, 
                        "sahur": { 
                            "meal": "Tumis Bayam Telur", 
                            "calories": "300",
                            "recipe": ["Potong bayam", "Tumis bawang", "Masukkan telur dan bayam", "Sajikan"]
                        }, 
                        "berbuka": { 
                            "meal": "Ayam Bakar Madu", 
                            "calories": "450",
                            "recipe": ["Marinasi ayam dengan madu", "Panggang ayam hingga matang", "Sajikan hangat"]
                        }, 
                        "note": "Kombinasi serat saat sahur agar kenyang lebih lama."
                    },
                    ... (lanjutkan sampai 30 hari)
                ]
            }
            Hanya berikan JSON murni, jangan ada teks pembuka/penutup.
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
    // Render Ingredients
    const ingContainer = document.getElementById('resIngredients');
    ingContainer.innerHTML = data.ingredients.map(ing => `
        <span class="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 text-[10px] font-bold rounded-xl shadow-sm">
            ${ing}
        </span>
    `).join('');

    // Render Monthly Schedule
    const monthlySection = document.getElementById('monthlySchedule');
    const calendarContainer = document.getElementById('calendarContainer');
    
    if (data.monthly_plan) {
        monthlySection.classList.remove('hidden');
        calendarContainer.innerHTML = data.monthly_plan.map(d => `
            <div class="day-card glass p-4 rounded-2xl border border-white hover:border-indigo-100 shadow-sm flex flex-col justify-between h-40 cursor-pointer" 
                    onclick="showMealDetail(${d.day})">
                <div class="space-y-2">
                    <span class="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Hari Ke-${d.day}</span>
                    
                    <div class="space-y-1">
                        <div class="flex flex-col">
                            <span class="text-[9px] font-bold text-indigo-500 uppercase tracking-wider"><i data-lucide="moon" size="8" class="inline mr-1"></i>Sahur</span>
                            <h6 class="text-[10px] font-black text-slate-800 leading-tight truncate">${d.sahur.meal}</h6>
                        </div>
                        <div class="flex flex-col pt-1">
                            <span class="text-[9px] font-bold text-amber-600 uppercase tracking-wider"><i data-lucide="sun" size="8" class="inline mr-1"></i>Berbuka</span>
                            <h6 class="text-[10px] font-black text-slate-800 leading-tight truncate">${d.berbuka.meal}</h6>
                        </div>
                    </div>
                </div>
                <div class="mt-2 pt-2 border-t border-slate-50 flex items-center justify-between">
                    <span class="text-[9px] font-bold text-slate-500">${parseInt(d.sahur.calories || 0) + parseInt(d.berbuka.calories || 0)} Total Kcal</span>
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

    document.getElementById('modalDay').innerText = `Rencana Hari Ke-${day}`;
    document.getElementById('modalDescription').innerText = dayPlan.note || `Menu sehat yang dirancang khusus untuk memenuhi kebutuhan nutrisi kamu di puasa hari ke-${day}.`;
    
    // Inject Sahur
    document.getElementById('modalSahurMeal').innerText = dayPlan.sahur.meal;
    document.getElementById('modalSahurCalories').innerText = dayPlan.sahur.calories;
    document.getElementById('modalSahurRecipe').innerHTML = dayPlan.sahur.recipe ? dayPlan.sahur.recipe.map(step => `<li>${step}</li>`).join('') : '<li>Resep tidak tersedia</li>';
    
    // Inject Berbuka
    document.getElementById('modalBerbukaMeal').innerText = dayPlan.berbuka.meal;
    document.getElementById('modalBerbukaCalories').innerText = dayPlan.berbuka.calories;
    document.getElementById('modalBerbukaRecipe').innerHTML = dayPlan.berbuka.recipe ? dayPlan.berbuka.recipe.map(step => `<li>${step}</li>`).join('') : '<li>Resep tidak tersedia</li>';
    
    // Total Calories
    const totalKcal = parseInt(dayPlan.sahur.calories || 0) + parseInt(dayPlan.berbuka.calories || 0);
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
