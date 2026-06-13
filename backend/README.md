# HeatPath Backend

This is the FastAPI backend for HeatPath, a heat-aware outdoor routing app.

## Setup Instructions

1. **Create and activate a virtual environment:**
   ```bash
   # Create a virtual environment
   python -m venv venv

   # Activate it (Windows)
   venv\Scripts\activate

   # Activate it (macOS/Linux)
   source venv/bin/activate
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure environment variables:**
   Copy the example file to create your local environment:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` to add any actual keys if required.

4. **Run the development server:**
   ```bash
   uvicorn app.main:app --reload
   ```
   The API will be available at `http://localhost:8000`. You can view the interactive documentation at `http://localhost:8000/docs`.

5. **Run tests:**
   ```bash
   pytest
   ```
