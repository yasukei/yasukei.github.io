## Prepare & exec
### Prepare execution environment
This below may be imcomplete.

```shell
sudo apt install ruby-dev zlib1g-dev nodejs
sudo gem install nokogiri
sudo gem install jekyll bundler
```

### Prepare project environment
Execute below command with Gemfile.
```shell
bundle install
```

### Exec
```shell
bundle exec jekyll serve
```

## Links

* [Jekyll docs](https://jekyllrb.com/docs/home)
* [Jekyll Talk](https://talk.jekyllrb.com/)

* [GitHub Pages docs](https://help.github.com/categories/github-pages-basics/)
* [GitHub Flavored Markdown](https://guides.github.com/features/mastering-markdown/).

## Markdown example

```markdown
Syntax highlighted code block

# Header 1
## Header 2
### Header 3

- Bulleted
- List

1. Numbered
2. List

**Bold** and _Italic_ and `Code` text

[Link](url) and ![Image](src)
```

