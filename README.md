# TreePT

TreePT is an interactive, Next.js project analyzer that provides better insights into your codebase structure and dependencies. It leverages AI to generate comprehensive documentation and visualizations of your Next.js application architecture.

## Features

- Automated dependency graph generation for Next.js projects
- Solution generation with improved project context for repo issues
- Visual representation of relevant files to work on for an issue.
- Integration with OpenAI for enhanced analysis capabilities
- AI-powered chatbot to better interact with the codebase

## Prerequisites

- Python 3.12+
- Node.js (version specified in .nvmrc)
- OpenAI API key, GitHub API Token, Groq API key

## Local Development Setup

1. Set up Python environment:
```bash
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

2. Install Node.js dependencies:
```bash
npm install
```

3. Configure APIs:
- Update the OpenAI, Groq, and GitHub API key in the .env file by filling in the quotes with the respective keys

## Deploying locally

1. Setup the FastAPI Backend:

Change directory to root TreePT, then runL

```bash
python3 openai_service.py
```

2. Run the project:

Change directory to treept-frontend, then run:

```bash
npm run dev
```

Open the project at http://localhost:3000

## Project Structure

- `nextjs_analyzer.py`: Main analyzer script for Next.js projects
- `next_context.py`: Context summary and dependency tree generator
- `openai_service.py`: OpenAI integration and backend server initialization
- `treept-frontend/`: Frontend application for visualization
- `requirements.txt`: Python dependencies
- `package.json`: Node.js dependencies

