# TreePT with OpenAI Integration

This project integrates OpenAI capabilities into the TreePT application, allowing AI-generated solutions for GitHub issues.

## Project Structure

- `TreePT/treept-frontend/`: Next.js frontend application
- `openai_service.py`: FastAPI microservice for OpenAI integration
- `requirements.txt`: Python dependencies for the FastAPI service

## Setup Instructions

### 1. Frontend Setup

```bash
# Navigate to the frontend directory
cd TreePT/treept-frontend

# Install dependencies
npm install

# Create .env.local file with FastAPI URL
echo "FASTAPI_URL=http://localhost:8000" > .env.local

# Start the development server
npm run dev
```

### 2. Backend FastAPI Setup

```bash
# Install Python dependencies
pip install -r requirements.txt

# Set up your OpenAI API key
# Edit the .env file and add your API key
echo "OPENAI_API_KEY=your-api-key-here" > .env

# Start the FastAPI server
python openai_service.py
```

## How it Works

1. When a user selects a GitHub issue, the issue details are displayed on the solution page
2. The frontend automatically sends the issue details to the FastAPI microservice
3. The microservice processes the issue using OpenAI's API and generates a solution
4. The solution is returned to the frontend and displayed in the right panel

## Configuration

- `FASTAPI_URL`: URL of the FastAPI microservice (default: http://localhost:8000)
- `OPENAI_API_KEY`: Your OpenAI API key

## Development

### Frontend (Next.js)

The frontend is built with Next.js and uses the following components:

- `src/app/github/issues/solution/page.tsx`: The page component that displays the issue and solution
- `src/app/api/generate_solution/route.js`: API route that forwards the request to the FastAPI service

### Backend (FastAPI)

The backend is a FastAPI service that:

1. Receives issue details from the frontend
2. Formats a prompt for OpenAI
3. Calls the OpenAI API
4. Returns the generated solution to the frontend

## Customization

You can customize the OpenAI prompt and parameters in the `openai_service.py` file to adjust the solution generation. 