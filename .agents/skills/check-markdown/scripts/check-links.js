import fs from 'fs';
import path from 'path';

const DOCS_ROOT = path.resolve('docs');

function getFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.vitepress' && file !== '.git') {
        results = results.concat(getFiles(filePath));
      }
    } else if (file.endsWith('.md')) {
      results.push(filePath);
    }
  });
  return results;
}

function checkLinksInFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const dirPath = path.dirname(filePath);
  const relativeFile = path.relative(DOCS_ROOT, filePath);
  
  // Regex to match markdown links: [text](link)
  // Avoid matching images (which start with !) and external URLs
  const linkRegex = /!?\[([^\]]*?)\]\(([^)]+?)\)/g;
  let match;
  const errors = [];

  while ((match = linkRegex.exec(content)) !== null) {
    const text = match[1];
    let link = match[2].trim();

    // Skip external links, mailto, tel, anchors on the same page
    if (
      link.startsWith('http://') ||
      link.startsWith('https://') ||
      link.startsWith('mailto:') ||
      link.startsWith('tel:') ||
      link.startsWith('#')
    ) {
      continue;
    }

    // Strip hash fragments from the link for file checking
    const hashIdx = link.indexOf('#');
    if (hashIdx !== -1) {
      link = link.substring(0, hashIdx);
      if (!link) continue; // It was just an anchor
    }

    // Resolve the target file path
    let targetPath;
    if (link.startsWith('file:///')) {
      // Handle file:/// absolute links sometimes used in artifacts
      targetPath = path.resolve(link.replace('file:///', '/'));
    } else if (link.startsWith('/')) {
      // Root-relative to docs root
      targetPath = path.join(DOCS_ROOT, link);
    } else {
      // Relative to current file's directory
      targetPath = path.resolve(dirPath, link);
    }

    // Check multiple potential extensions or endings:
    // 1. Exactly as is (e.g. targetPath contains .md or .png or is a directory)
    // 2. Replacing .html with .md
    // 3. Appending .md (if no extension is present)
    // 4. Checking if it's a directory containing index.md
    let exists = false;
    const pathsToCheck = [
      targetPath,
      targetPath.replace(/\.html$/, '.md'),
    ];

    if (!path.extname(targetPath)) {
      pathsToCheck.push(`${targetPath}.md`);
      pathsToCheck.push(path.join(targetPath, 'index.md'));
    }

    for (const p of pathsToCheck) {
      if (fs.existsSync(p)) {
        exists = true;
        break;
      }
    }

    if (!exists) {
      errors.push({
        link: match[2],
        text,
        resolvedPaths: pathsToCheck.map(p => path.relative(DOCS_ROOT, p))
      });
    }
  }

  return errors;
}

function main() {
  const files = getFiles(DOCS_ROOT);
  let totalErrors = 0;
  console.log(`Scanning ${files.length} markdown files in ${DOCS_ROOT}...\n`);

  files.forEach((file) => {
    const errors = checkLinksInFile(file);
    if (errors.length > 0) {
      const relFile = path.relative(DOCS_ROOT, file);
      console.error(`❌ Broken link(s) found in: docs/${relFile}`);
      errors.forEach((err) => {
        console.error(`   - Link: "${err.link}" (text: "${err.text}")`);
      });
      console.error();
      totalErrors += errors.length;
    }
  });

  if (totalErrors > 0) {
    console.error(`Total broken links found: ${totalErrors}`);
    process.exit(1);
  } else {
    console.log('✅ All internal links are valid!');
    process.exit(0);
  }
}

main();
