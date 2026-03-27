# AI Course Builder (POC)

A complete Proof of Concept for an **AI Course Builder** built with a React frontend and a FastAPI backend. This platform acts as a lightweight Learning Management System (LMS) capable of utilizing OpenAI's LLMs or local vector embeddings (RAG) to dynamically generate rich, deeply structured courses.

## Features
- **Dynamic Curriculum Generation**: AI instantly builds structured Modules and Chapters based on your target audience and objectives.
- **RAG & Internal Documents**: Upload a PDF or DOCX to build course knowledge directly from your localized, domain-specific sources via ChromaDB.
- **Mixed Content Editor**: Flexibly mix AI-generated text content, code snippets, or manually upload/embed existing videos (MP4, YouTube) and Document files.
- **Smart Course Viewer**: Interactive LMS frontend featuring chapter tracking, progress bars, and seamlessly embedded video players.
- **Global Assessment**: Generates a unified, 10-question final exam spanning all course modules, followed by a dynamically unlocking completion survey.

## Tech Stack
- **Backend**: Python, FastAPI, LangChain, ChromaDB, OpenAI `gpt-4o-mini`.
- **Frontend**: React (Vite), Tailwind CSS, Axios, Lucide React.
- **Architecture**: REST API with robust JSON schema validation via Pydantic.

---

## Getting Started

### Prerequisites
- Node.js (v18+)
- Python (v3.10+) 
- An active OpenAI API Key

### 1. Backend Setup

1. Open a terminal and navigate to the `backend` directory:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment (recommended):
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Configure the environment variables:
   - Copy `.env.example` to a new file named `.env`.
   - Add your OpenAI API key: `OPENAI_API_KEY=your_key_here`
5. Start the FastAPI development server:
   ```bash
   fastapi dev main.py
   ```
   *The API will start locally on port `8000`.*

### 2. Frontend Setup

1. Open a new terminal and navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```
2. Install npm dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   *The React app will usually start on `http://localhost:5173/`.*

### 3. Usage
Simply open the local frontend URL in your browser, click **Create New Course**, and follow the 5-step interactive wizard. You can seamlessly bounce between generating AI content or uploading your own media elements in Step 4. All generated configurations are saved cleanly into a local storage structure (`courses.json`).
