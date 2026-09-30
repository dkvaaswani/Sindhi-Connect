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
     category: "history",        // one of the category ids below
     author: "Author or source",
     year: "2024",               // optional; used by "Newest" sort
     type: "PDF",                // PDF, Book, Article, Report, Video...
     thumbnail: "",              // optional image, e.g. "assets/resources/cover.jpg"
                                 // leave empty for a designed cover
     file: "",                   // PDF in assets/resources/, or a web link
     featured: true              // true = shown first and marked "Featured"
   }

   - Local files (e.g. "assets/resources/book.pdf") get both
     "Read now" and "Download" buttons.
   - Web links (https://...) get a "Read now" button only.
   - Add `download: false` to hide the Download button.
   - A category with no resources shows "More knowledge is
     coming soon." automatically.
   ========================================================= */
window.SC_KNOWLEDGE = {
  categories: [
    {
      id: 'books',
      name: 'Knowledge Books',
      description: 'Books, PDFs and useful reading material.',
      icon: 'book'
    },
    {
      id: 'history',
      name: 'Sindhi History & Heritage',
      description: 'Historical information, personalities, places and cultural heritage.',
      icon: 'landmark'
    },
    {
      id: 'personalities',
      name: 'Sindhi Personalities',
      description: 'Biographies and stories of notable Sindhi personalities.',
      icon: 'person'
    },
    {
      id: 'culture',
      name: 'Culture & Literature',
      description: 'Sindhi literature, poetry, traditions, language and cultural resources.',
      icon: 'feather'
    },
    {
      id: 'finance',
      name: 'Finance & Awareness',
      description: 'Simple financial education: saving, investment and personal finance.',
      icon: 'growth'
    },
    {
      id: 'general',
      name: 'General Knowledge',
      description: 'Useful articles, guides, reports and informative resources.',
      icon: 'globe'
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
      category: 'culture',
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
      category: 'culture',
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
      category: 'general',
      author: 'Wikipedia',
      year: '',
      type: 'Article',
      thumbnail: '',
      file: 'https://en.wikipedia.org/wiki/Sindh',
      featured: false
    }
  ]
};
