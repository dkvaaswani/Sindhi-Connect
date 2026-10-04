# How to update your website (no coding needed)

You can make everyday changes to **sindhiconnect.org** yourself, from any computer, using only the GitHub website.
Every change you save goes live automatically about one minute later.

**Your website files:** https://github.com/dkvaaswani/Sindhi-Connect (sign in with your GitHub account)

---

## How it works, in one minute

- The website is a set of files stored on GitHub, in the **main** branch.
- When a file in **main** changes, Netlify publishes the new version to sindhiconnect.org within about a minute.
- GitHub keeps **every** earlier version, so nothing is ever lost. You can always go back (see [Undo a change](#8-undo-a-change)).

The files you will use:

| What you want to change | File |
|---|---|
| Videos, podcasts, articles, books, PDFs | `frontend/resources.js` |
| Any text on the website pages | `frontend/index.html` |
| Photos, logo, PDFs | the `frontend/assets/` folder |

---

## The basic steps (used in every task below)

1. Open https://github.com/dkvaaswani/Sindhi-Connect.
2. Click the folder **frontend**, then the file you need (for example **resources.js**).
3. Click the **pencil icon** (top right of the file, "Edit this file").
4. Make your change.
5. Click the green **Commit changes...** button (top right).
6. In the box that opens, write a short note such as "Add new podcast", keep **Commit directly to the main branch**
   selected, and click **Commit changes**.
7. Wait about one minute, then open https://sindhiconnect.org and refresh the page (on a phone, close and reopen the tab).

To check that it was published: in Netlify (app.netlify.com) open your site, then **Deploys**. The top line should say
**Published** with your note.

---

## 1. Add a YouTube video or podcast

1. Open `frontend/resources.js` and click the pencil icon.
2. Find the line `resources: [` (use **Ctrl + F**). The first entry below it is your newest video.
3. Click at the end of the line `resources: [`, press **Enter**, and paste this block:

```js
    {
      title: 'Your video title here',
      description: 'One or two sentences about the video.',
      category: 'finance',
      author: 'Sindhi Connect',
      year: '',
      type: 'Video',
      thumbnail: 'https://i.ytimg.com/vi/VIDEO-ID/hqdefault.jpg',
      file: 'https://www.youtube.com/watch?v=VIDEO-ID',
      featured: true
    },
```

4. Change the values (keep the quotes `'...'` and the comma after each line):
   - **title** and **description**: your own words.
   - **VIDEO-ID** (twice): the code after `v=` in the YouTube link. For `https://www.youtube.com/watch?v=R50sSMh83lA&t=68s`
     the ID is `R50sSMh83lA` (stop before any `&`).
   - **category**: one of `finance`, `business`, `history`, `literature`, `personalities`, `development`.
   - **type**: `'Video'` or `'Podcast'`.
   - **featured**: `true` puts it first and on the home page; `false` lists it normally.
5. Commit (steps 5–7 above).

The video then appears automatically on the **Videos & Podcasts** page, in the **Knowledge Hub** under its topic, and
on the home page if featured (the home page shows the first three featured items).

## 2. Add an article or web link

Same as above, with these changes:

```js
    {
      title: 'Article title',
      description: 'One or two sentences about it.',
      category: 'history',
      author: 'Source name (e.g. Wikipedia, Dawn)',
      year: '2026',
      type: 'Article',
      thumbnail: '',
      file: 'https://link-to-the-article',
      featured: false
    },
```

Leave `thumbnail: ''` empty to get a designed cover. Use `type: 'Book'` for a book.

## 3. Add a PDF to download

1. **Upload the PDF:** open the `frontend/assets` folder on GitHub, click **Add file → Upload files**, drag your PDF in,
   and click **Commit changes**. Use a simple file name without spaces, e.g. `family-budget-guide.pdf`.
2. **List it:** add a block to `resources.js` as in step 2, with `type: 'Guide'` and
   `file: 'assets/family-budget-guide.pdf'`.

It gets **Read more** and **Download** buttons and also appears under **Resources → Downloadable Resources**.

## 4. Change text on a page

1. Open `frontend/index.html` and click the pencil icon.
2. Press **Ctrl + F** and type a few words of the sentence you want to change.
3. Change only the words between the tags. For example, in
   `<p class="lead">Interviews with inspiring people...</p>` change only the sentence, not `<p class="lead">` or `</p>`.
4. Commit.

Where things are in `index.html` (search for these names):

| Page | Search for |
|---|---|
| Home (banner, cards) | `id="home"`, `id="explore"` |
| About, My story, Mission | `id="about"`, `id="my-story"`, `id="mission"` |
| Knowledge Hub | `id="knowledge-hub"` |
| Resources | `id="resources"` |
| Videos & Podcasts | `id="videos"` |
| Contact Us | `id="join"` |

Special characters in page text: write `&amp;` for **&**, for example `Videos &amp; Podcasts`.

## 5. Replace a photo or the logo

The easiest way is to upload a new image **with exactly the same file name**, so nothing else needs changing:

| Image | File in `frontend/assets/` | Notes |
|---|---|---|
| Logo in the header | `logo.jpg` | square, JPG |
| Picture shown when the site is shared (WhatsApp, Facebook) | `og-image.jpg` | 1200 × 630 pixels, JPG |
| Your photo on the home page | `dhanesh-kumar.webp` | WEBP format; if you have a JPG, convert it first (e.g. at squoosh.app) |

Open `frontend/assets`, click **Add file → Upload files**, drag in the new image with the same name, and commit. GitHub
replaces the old one (the old version stays in the history).

## 6. Feature something on the home page

In `resources.js`, set `featured: true` on the items you want to show. The home page shows the first three featured
items in the list, so move a block higher up to show it first. The very first featured item is also shown large at
the top of the Knowledge Hub.

## 7. Remove an item

In `resources.js`, delete the whole block from its `{` to its `},` (including the comma), then commit.

## 8. Undo a change

1. Open the file you changed and click **History** (top right of the file).
2. Click the version from before your change, then the **...** menu → **View file**.
3. Click the **copy** icon (Copy raw file).
4. Go back to the current file, click the pencil icon, select everything (**Ctrl + A**), paste (**Ctrl + V**), and commit
   with the note "Undo".

Netlify keeps old versions too: in Netlify open **Deploys**, click an earlier deploy, and choose **Publish deploy** to
switch the live site back instantly while you fix things.

---

## Rules that keep the site working

- In `resources.js`, every value is inside single quotes `'...'` and every line ends with a comma, except the last
  line of a block (`featured: true`). Each block ends with `},`.
- If a title contains an apostrophe, put a backslash before it: `'Shah Latif\'s poetry'`.
- Only edit the files listed in this guide. Leave everything else alone, especially the `edu-calc` folder and the
  `data`, `tools` and `tests` folders (the Education Calculator).
- After committing, check the site. If a list or page looks empty or broken, you probably missed a quote or a comma:
  open the file's **History**, compare with the previous version, or undo (step 8).

## Things that need more than the GitHub website

| Change | What it needs |
|---|---|
| Education Calculator fees, exchange rates, courses | Editing `data/education/education-costs.json`, then rebuilding on a Windows PC (see `docs/education-calculator/MAINTENANCE.md`) |
| New pages, new features, layout or design changes | A web developer, or Claude Code |
| Contact form messages and email alerts | Netlify dashboard → **Forms** |
| Visitor numbers | Cloudflare dashboard → **Observability → Analytics → Web analytics** |
| Domain (sindhiconnect.org) | Hostinger (renewal) and Netlify → **Domain management** |
