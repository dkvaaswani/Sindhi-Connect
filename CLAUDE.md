# CLAUDE.md — Sindhi Connect

## Purpose
Sindhi Connect is a web app for the Sindhi community: a place to connect people and share culture, language, and resources.

## Architecture
```
frontend/   Static client: index.html (markup), style.css (styles), app.js (behavior)
backend/    Server-side code (API, data access). Not yet implemented.
data/       Data files used by the app (e.g. seed/sample data).
prompts/    Prompt files for any AI-assisted features.
```
- Frontend talks to backend over HTTP (JSON).
- Keep frontend and backend independent; no shared code across folders.

## Coding Rules
- Keep it simple: plain HTML, CSS, and vanilla JavaScript unless told otherwise.
- Small, focused functions with clear names.
- Match the style of the surrounding code.
- Comment only where the intent is not obvious.
- No new dependencies or frameworks without asking first.

## Security Rules
- Never commit secrets (API keys, passwords, tokens). Use environment variables and a `.env` file that is git-ignored.
- Validate and sanitize all user input on the backend.
- Escape user content before inserting it into the page; avoid `innerHTML` with untrusted data.
- Do not put personal data in URLs or logs.

## Token Saving Rules
- Read only the files needed for the task; read the relevant part of large files.
- Don't re-read files you just wrote or edited.
- Keep responses short: summarize changes, don't paste whole files back.
- Don't explore the repo broadly when the task names specific files.

## Scope Rule
**Only modify files needed for the current task.** Do not refactor, reformat, or touch unrelated files. If another change seems necessary, ask first.
