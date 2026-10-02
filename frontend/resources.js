/* =========================================================
   Knowledge Hub content
   ---------------------------------------------------------
   This is the only file you need to edit to add books, PDFs,
   articles and other resources. Cards, filters, counts and
   search are built from this data automatically (see app.js).

   To add a resource, copy one block in `resources` below and
   change the values:

   {
     title: "Resource title",
     description: "One or two sentences about it.",
     category: "history",        // a topic id: finance, business, history,
                                 // literature, personalities or development
     author: "Author or source",
     year: "2024",               // optional; used by "Newest" sort
     type: "Article",            // decides where it appears on the Resources page:
                                 //   Article / Guide / Report -> Educational Articles
                                 //   Book                     -> Knowledge Books
                                 //   Video / Podcast / Audio  -> Video & Podcast Library
                                 //                               (and the Videos & Podcasts page)
     thumbnail: "",              // optional image, e.g. "assets/resources/cover.jpg"
                                 // leave empty for a designed cover
     file: "",                   // PDF in assets/resources/, or a web link
                                 // (e.g. a YouTube link for a video)
     featured: true              // true = shown first, marked "Featured", and
                                 // eligible for the home page and spotlight
   }

   - Local files (e.g. "assets/resources/book.pdf") get both
     "Read more" and "Download" buttons, and also appear under
     Resources > Downloadable Resources.
   - Web links (https://...) get a "Read more" button only.
   - Add `download: false` to hide the Download button.
   - A topic or resource type with nothing in it shows a
     "coming soon" message automatically.
   ========================================================= */
window.SC_KNOWLEDGE = {
  // Topics: these match the Knowledge Hub menu (link: #topic-<id>)
  categories: [
    {
      id: 'finance',
      name: 'Finance & Money Matters',
      description: 'Budgeting, saving, investing and financial awareness for families.',
      icon: 'growth'
    },
    {
      id: 'business',
      name: 'Business & Professional Knowledge',
      description: 'Accounting, audit, tax, advisory and career guidance in simple language.',
      icon: 'briefcase'
    },
    {
      id: 'history',
      name: 'Sindhi History & Heritage',
      description: 'Historical information, places, traditions and cultural heritage.',
      icon: 'landmark'
    },
    {
      id: 'literature',
      name: 'Language & Literature',
      description: 'Sindhi language, poetry, literature and the stories they carry.',
      icon: 'feather'
    },
    {
      id: 'personalities',
      name: 'Sindhi Personalities',
      description: 'Biographies and life stories of inspiring Sindhi personalities.',
      icon: 'person'
    },
    {
      id: 'development',
      name: 'Personal Development',
      description: 'Learning habits, confidence and growth for students and professionals.',
      icon: 'sprout'
    }
  ],

  resources: [
    {
      title: 'Mohenjo-daro',
      description: 'The great Bronze Age city of the Indus Valley Civilisation in Sindh, one of the world\'s earliest planned cities.',
      category: 'history',
      author: 'Wikipedia',
      year: '',
      type: 'Article',
      thumbnail: '',
      file: 'https://en.wikipedia.org/wiki/Mohenjo-daro',
      featured: true
    },
    {
      title: 'Shah Abdul Latif Bhittai',
      description: 'The life and legacy of the beloved Sufi poet whose verses shaped the Sindhi language and identity.',
      category: 'personalities',
      author: 'Wikipedia',
      year: '',
      type: 'Article',
      thumbnail: '',
      file: 'https://en.wikipedia.org/wiki/Shah_Abdul_Latif_Bhittai',
      featured: true
    },
    {
      title: 'Shah Jo Risalo',
      description: 'An introduction to the celebrated collection of Shah Latif\'s poetry and the folk tales it retells.',
      category: 'literature',
      author: 'Wikipedia',
      year: '',
      type: 'Article',
      thumbnail: '',
      file: 'https://en.wikipedia.org/wiki/Shah_Jo_Risalo',
      featured: true
    },
    {
      title: 'History of Sindh',
      description: 'From the Indus Valley to the modern era: an overview of the people and events that shaped Sindh.',
      category: 'history',
      author: 'Wikipedia',
      year: '',
      type: 'Article',
      thumbnail: '',
      file: 'https://en.wikipedia.org/wiki/History_of_Sindh',
      featured: false
    },
    {
      title: 'Sachal Sarmast',
      description: 'The Sufi poet of seven languages, remembered for his fearless verses of love and unity.',
      category: 'personalities',
      author: 'Wikipedia',
      year: '',
      type: 'Article',
      thumbnail: '',
      file: 'https://en.wikipedia.org/wiki/Sachal_Sarmast',
      featured: false
    },
    {
      title: 'Sindhi Language',
      description: 'Where Sindhi comes from, where it is spoken today, and the scripts used to write it.',
      category: 'literature',
      author: 'Wikipedia',
      year: '',
      type: 'Article',
      thumbnail: '',
      file: 'https://en.wikipedia.org/wiki/Sindhi_language',
      featured: false
    },
    {
      title: 'Sindh',
      description: 'Geography, people, cities and economy: a general guide to the land of the Indus.',
      category: 'history',
      author: 'Wikipedia',
      year: '',
      type: 'Article',
      thumbnail: '',
      file: 'https://en.wikipedia.org/wiki/Sindh',
      featured: false
    }
  ]
};
