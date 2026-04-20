// src/data/dummyData.js
// Static fallback data used when Firestore is empty or offline.
// This represents a "Web Development Fundamentals" learning path.

export const DUMMY_SKILLS = [
  {
    id: "skill-web-fundamentals",
    name: "Web Development Fundamentals",
    topics: [
      "topic-html",
      "topic-css",
      "topic-javascript",
      "topic-react",
      "topic-hooks",
    ],
  },
  {
    id: "skill-backend-basics",
    name: "Backend Basics",
    topics: ["topic-node", "topic-express", "topic-mongodb"],
  },
];

export const DUMMY_TOPICS = [
  {
    id: "topic-html",
    title: "HTML Fundamentals",
    description:
      "Learn the building blocks of the web. HTML (HyperText Markup Language) structures web content using elements like headings, paragraphs, links, images, forms, and semantic tags. It's the foundation every web developer starts with.",
    resources: [
      { label: "MDN – HTML Basics", url: "https://developer.mozilla.org/en-US/docs/Learn/Getting_started_with_the_web/HTML_basics" },
      { label: "W3Schools HTML Tutorial", url: "https://www.w3schools.com/html/" },
      { label: "HTML Full Course – freeCodeCamp", url: "https://www.youtube.com/watch?v=kUMe1FH4CHE" },
    ],
    prerequisites: [],
    position: { x: 100, y: 200 },
    skillId: "skill-web-fundamentals",
  },
  {
    id: "topic-css",
    title: "CSS Styling",
    description:
      "CSS (Cascading Style Sheets) controls the visual presentation of web pages. Learn selectors, the box model, Flexbox, Grid, transitions, and responsive design with media queries.",
    resources: [
      { label: "MDN – CSS First Steps", url: "https://developer.mozilla.org/en-US/docs/Learn/CSS/First_steps" },
      { label: "CSS Tricks – Flexbox Guide", url: "https://css-tricks.com/snippets/css/a-guide-to-flexbox/" },
      { label: "Kevin Powell – CSS YouTube Channel", url: "https://www.youtube.com/kepowob" },
    ],
    prerequisites: ["topic-html"],
    position: { x: 350, y: 200 },
    skillId: "skill-web-fundamentals",
  },
  {
    id: "topic-javascript",
    title: "JavaScript Essentials",
    description:
      "JavaScript brings web pages to life. Learn variables, data types, functions, DOM manipulation, events, promises, async/await, and ES6+ features that modern developers use daily.",
    resources: [
      { label: "javascript.info – The Modern JS Tutorial", url: "https://javascript.info/" },
      { label: "MDN – JavaScript Guide", url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide" },
      { label: "JS Full Course – Traversy Media", url: "https://www.youtube.com/watch?v=hdI2bqOjy3c" },
    ],
    prerequisites: ["topic-css"],
    position: { x: 600, y: 200 },
    skillId: "skill-web-fundamentals",
  },
  {
    id: "topic-react",
    title: "React Basics",
    description:
      "React is a JavaScript library for building user interfaces with reusable components. Learn JSX, props, state, event handling, conditional rendering, and the component lifecycle.",
    resources: [
      { label: "React Official Docs", url: "https://react.dev/learn" },
      { label: "Scrimba – Learn React for Free", url: "https://scrimba.com/learn/learnreact" },
      { label: "React Crash Course – Traversy Media", url: "https://www.youtube.com/watch?v=w7ejDZ8SWv8" },
    ],
    prerequisites: ["topic-javascript"],
    position: { x: 850, y: 200 },
    skillId: "skill-web-fundamentals",
  },
  {
    id: "topic-hooks",
    title: "React Hooks",
    description:
      "Hooks let you use state and lifecycle features in functional components. Master useState, useEffect, useContext, useReducer, useMemo, and useCallback to write powerful, clean React apps.",
    resources: [
      { label: "React Docs – Hooks Reference", url: "https://react.dev/reference/react" },
      { label: "useHooks – Real-World Hook Examples", url: "https://usehooks.com/" },
      { label: "React Hooks Explained – Fireship", url: "https://www.youtube.com/watch?v=TNhaISOUy6Q" },
    ],
    prerequisites: ["topic-react"],
    position: { x: 1100, y: 200 },
    skillId: "skill-web-fundamentals",
  },

  // — Backend Basics skill —
  {
    id: "topic-node",
    title: "Node.js Basics",
    description:
      "Node.js lets you run JavaScript on the server. Learn the event loop, the built-in modules (fs, path, http), npm packages, and how to build simple scripts and servers.",
    resources: [
      { label: "Node.js Official Docs", url: "https://nodejs.org/en/docs/" },
      { label: "Node.js Crash Course – Traversy Media", url: "https://www.youtube.com/watch?v=fBNz5xF-Kx4" },
    ],
    prerequisites: ["topic-javascript"],
    position: { x: 600, y: 420 },
    skillId: "skill-backend-basics",
  },
  {
    id: "topic-express",
    title: "Express.js",
    description:
      "Express.js is the most popular Node.js framework. Learn routing, middleware, REST API design, error handling, and how to integrate databases.",
    resources: [
      { label: "Express Official Docs", url: "https://expressjs.com/" },
      { label: "Express Crash Course – Traversy Media", url: "https://www.youtube.com/watch?v=L72fhGm1tfE" },
    ],
    prerequisites: ["topic-node"],
    position: { x: 850, y: 420 },
    skillId: "skill-backend-basics",
  },
  {
    id: "topic-mongodb",
    title: "MongoDB",
    description:
      "MongoDB is a NoSQL document database. Learn collections, documents, CRUD operations, Mongoose ODM, indexing, and how to connect MongoDB to an Express API.",
    resources: [
      { label: "MongoDB Docs", url: "https://www.mongodb.com/docs/" },
      { label: "MongoDB University – Free Courses", url: "https://learn.mongodb.com/" },
    ],
    prerequisites: ["topic-express"],
    position: { x: 1100, y: 420 },
    skillId: "skill-backend-basics",
  },
];

// Build a lookup map for quick access by topic id
export const DUMMY_TOPICS_MAP = DUMMY_TOPICS.reduce((acc, topic) => {
  acc[topic.id] = topic;
  return acc;
}, {});
