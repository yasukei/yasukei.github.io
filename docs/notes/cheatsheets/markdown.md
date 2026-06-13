# Markdown

Markdown is a lightweight markup language that uses plain text formatting syntax. It is widely used for README files, documentation, and writing on the web.

---

### 📝 Headings

To create a heading, add one to six `#` symbols before your heading text. The number of `#` you use determines the size and level of the heading.

```markdown
# Heading 1 (Main Title)
## Heading 2 (Major Sections)
### Heading 3 (Sub-sections)
#### Heading 4
##### Heading 5
###### Heading 6

```

---

### 🎨 Text Styling

| Style | Syntax |
| --- | --- |
| **Bold** | `**text**` or `__text__` |
| *Italic* | `*text*` or `_text_` |
| ***Bold & Italic*** | `***text***` |
| ~~Strikethrough~~ | `~~text~~` |

---

### 📑 Lists

#### Unordered (Bulleted) Lists

You can use `*`, `-`, or `+` interchangeably. Indent two spaces to create a nested list item.

```markdown
- Item 1
- Item 2
  - Sub-item 2a
  - Sub-item 2b
- Item 3

```

#### Ordered (Numbered) Lists

Simply start each line with a number followed by a period. The actual numbers you use don't matter; Markdown will sequence them automatically when rendered.

```markdown
1. First item
2. Second item
1. Third item (renders automatically as 3.)

```

#### Task Lists

Great for keeping track of to-do items. Use `[ ]` for unchecked tasks and `[x]` for checked ones.

```markdown
- [x] Write the documentation
- [ ] Review pull requests
- [ ] Deploy to production

```


### 🔗 Links and Images

#### Links

Format the clickable text in brackets `[ ]` and place the URL immediately after in parentheses `( )`.

```markdown
[Visit GitHub](https://github.com)

```

[Visit GitHub](https://github.com)

#### Images

Images follow the exact same format as links, but with an exclamation mark `!` right at the front.

```markdown
![Image Alt Text](https://images.unsplash.com/photo-1618401471353-b98aedd07871?w=400)

```

---

### 💬 Blockquotes and Horizontal Rules

#### Blockquotes

Use the `>` symbol to pull out a block of text—perfect for quotes, callouts, or notes.

```markdown
> "Simplicity is the soul of efficiency." — Austin Freeman

```

> "Simplicity is the soul of efficiency." — Austin Freeman

#### Horizontal Rules

Create a clean divider line by typing three or more hyphens `---` or asterisks `***` on a line by themselves.

```markdown
---

```

---

### 💻 Code Formatting

#### Inline Code

Wrap small snippets or variable names within backticks ```.

```markdown
Use the `console.log()` function to debug your code.

```

Use the `console.log()` function to debug your code.

#### Code Blocks

For multiple lines of code, wrap them in triple backticks `````. You can optionally specify the programming language next to the first set of backticks to enable syntax highlighting.


### 📊 Tables

Use pipes `|` to separate columns and hyphens `-` to create headers. You can add colons `:` to the hyphen line to change text alignment.

```markdown
| Feature | Description | Status |
| :--- | :---: | ---: |
| Left-aligned | Center-aligned | Right-aligned |
| Dark Mode | Built-in UI toggle | Available |
| Custom Sync | Self-hosted options | Beta |

```

| Feature | Description | Status |
| --- | --- | --- |
| Left-aligned | Center-aligned | Right-aligned |
| Dark Mode | Built-in UI toggle | Available |
| Custom Sync | Self-hosted options | Beta |