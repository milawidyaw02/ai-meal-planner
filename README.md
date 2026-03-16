# 🥘 MealAI Planner

AI-powered meal planner that turns your fridge ingredients into healthy, balanced meals. Built with Vanilla JS, Tailwind CSS, and the Gemini Pro Vision API.

## ✨ Features
- **Smart Vision Analysis**: Upload a photo of your ingredients and let AI identify them.
- **Nutrition-Driven**: Suggests meals based on your available ingredients, budget, and time constraint.
- **Monthly Planner**: Automatically generates a 30-day healthy meal schedule.
- **Data Persistence**: Saves your generated plans and uploaded photos locally so you never lose them.
- **Clean Interface**: Beautiful, responsive, and intuitive design.

## 🚀 Getting Started

Follow these steps to run the application on your local machine.

### Prerequisites
- [Node.js](https://nodejs.org/) installed on your computer.
- A free API key from [Google AI Studio](https://aistudio.google.com/).

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/mealai-planner.git
   cd mealai-planner
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up your API Key:
   - Make a copy of `config.example.js` and rename it to `config.js`.
   - Open `config.js` and paste your Gemini API Key:
     ```javascript
     export const GEMINI_API_KEY = "YOUR_API_KEY_HERE";
     ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open your browser and visit the local URL provided by Vite (usually `http://localhost:5173`).

## 🛠️ Built With
- HTML5, CSS3, JavaScript (ES Modules)
- [Tailwind CSS](https://tailwindcss.com/)
- [Vite](https://vitejs.dev/)
- [Google Generative AI SDK](https://ai.google.dev/)
- [Lucide Icons](https://lucide.dev/)

## 🔒 Security Note
This project requires an API key. For security reasons, your API key is stored in `config.js`, which is intentionally ignored by Git (via `.gitignore`) to prevent accidental leaks. **Never commit your real API key to a public repository.**
