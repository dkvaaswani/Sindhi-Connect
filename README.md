# Sindhi Connect

A web app for the Sindhi community: language, culture, knowledge and connection.

## Project Structure

```
sindhi-connect/
├── frontend/            # The website (plain HTML, CSS, JavaScript)
│   ├── index.html       # Page content
│   ├── style.css        # Styles (design tokens are documented in DESIGN.md)
│   ├── app.js           # Scroll reveal, mobile menu, forms, Knowledge Hub, chat widget
│   ├── resources.js     # Knowledge Hub content: edit this to add books, PDFs, articles
│   └── assets/          # Logo, photos, icons
├── backend/             # Server-side code (not used yet)
├── data/                # Data files
├── prompts/             # Prompt files for future AI features
├── netlify.toml         # Hosting settings (publishes frontend/)
├── DESIGN.md            # Design system
└── CLAUDE.md            # Project rules
```

## Updating content

- **Knowledge Hub:** add an entry to `frontend/resources.js` (instructions are at the top of the file). Put PDFs and cover images in `frontend/assets/resources/`.
- **Everything else:** edit `frontend/index.html`.

Push to GitHub and the live site updates automatically.

## Education Fund Calculator

`frontend/education-calculator.html` estimates future university costs for up to four children and the monthly saving
needed. Its fee data lives in `data/education/education-costs.json`; after editing it run `python3 tools/edu-calc/build.py`
to regenerate the page data, the Excel workbook and the source register. Full details: `docs/education-calculator/`.

## Hosting

The site is hosted on Netlify, connected to this GitHub repository. `netlify.toml` tells Netlify to publish the `frontend/` folder with no build step.

The Join and Contact forms use **Netlify Forms**. Submissions appear in the Netlify dashboard under *Forms*, and you can turn on email notifications there. The forms only work on the live Netlify site; on a local preview they won't send anything.

## Local preview

Open `frontend/index.html` in a browser, or run any static file server in `frontend/`.
