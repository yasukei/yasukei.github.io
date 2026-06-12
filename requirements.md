# Project Requirements: Personal GitHub.io Website & Repository

## 1. Project Overview
This project involves the creation, deployment, and governance of a personal GitHub Pages (`github.io`) website. The website will serve as a multi-purpose platform containing a technical knowledge wiki, web-based utility tools, and browser games. 

## 2. Technology Stack
* **Framework:** VitePress (Vue 3 + Vite)
* **Architecture:** Static Site Generation (SSG)
* **Hosting:** GitHub Pages
* **Package Management:** npm (Node Package Manager)

## 3. Functional Requirements

### 3.1. Wiki Subsystem
* **Purpose:** Act as a central repository for notes, memos, and deep-dives into web technologies.
* **Features:**
    * Markdown-based content generation.
    * Built-in global search functionality (native to VitePress).
    * Sidebar navigation and document outline generation.

### 3.2. Tools Subsystem
* **Purpose:** Host useful utility applications executed entirely in the client's browser using JavaScript/Vue.
* **Planned Tools:**
    * Markdown Previewer (live rendering of markdown text).
    * Data Converter (e.g., JSON/XML, Base64 formatting).
    * Binary Viewer / Editor.

### 3.3. Games Subsystem
* **Purpose:** Host lightweight browser games for breaks and casual entertainment.
* **Planned Games:**
    * Minesweeper.
    * *Extensible for future additions.*

## 4. Non-Functional & Technical Requirements
* **Static Export:** The site must compile entirely to static assets (HTML, CSS, JS) via `npm run build` to be compatible with GitHub Pages hosting.
* **Third-Party Library Management:**
    * The project supports standard `npm install` for external libraries.
    * **SSR Compatibility:** Because the SSG build process uses Node.js, browser-only APIs (`window`, `document`, `localStorage`) must be safely handled to prevent build errors.
    * **Implementation Rules for Client-Side Libraries:**
        * Wrap components utilizing browser APIs within VitePress's `<ClientOnly>` tags.
        * Alternatively, initialize browser-dependent libraries dynamically within Vue's `onMounted` lifecycle hook.

