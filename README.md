# yasukei.github.io

[![Deploy static content to Pages](https://github.com/yasukei/yasukei.github.io/actions/workflows/deploy.yml/badge.svg)](https://github.com/yasukei/yasukei.github.io/actions/workflows/deploy.yml)

Personal notes, interactive tools, and documentation repository.

## Production Site
The production site is deployed and hosted at:
👉 **[https://yasukei.github.io/](https://yasukei.github.io/)**

## Getting Started & How to Build

This website is built using **VitePress**.

### Prerequisites
Make sure you have Node.js installed.

### 1. Install Dependencies
Run the following command in the root directory to install all required dependencies:
```bash
npm ci
```

### 2. Run Locally (Development Server)
To start the local development server with hot-reload:
```bash
npm run dev
```
The local server will start, typically at `http://localhost:5173/`.

### 3. Build for Production
To compile and build the static assets for production deployment:
```bash
npm run build
```
This compiles the site into the `docs/.vitepress/dist` directory.

### 4. Preview Production Build
To preview the compiled production build locally:
```bash
npm run docs:preview
```