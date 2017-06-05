---
layout: page
title: Software System Architecture, Working With Stakeholders Using Viewpoints and Perspectives
---

[Book URL](https://books.google.co.jp/books?isbn=4797376724)

![Alt text](https://g.gravizo.com/source/svg/custom_mark12?https://raw.githubusercontent.com/yasukei/yasukei.github.io/master/_posts/2017-06-02-software-system-architecture.md)
<details> 
<summary></summary>
custom_mark12
/**
*Structural Things
*@opt commentname
*@note Notes can
*be extended to
*span multiple lines
*/
class Structural{}

/**
*@opt all
*@note Class
*/
class Counter extends Structural {
        static public int counter;
        public int getCounter();
}

/**
*@opt shape activeclass
*@opt all
*@note Active Class
*/
class RunningCounter extends Counter{}

class ArchitecturalElement{}
class Architecture {
	public ArchitecturalElement elements;
}

class System {
	public Architecture architecture;
}

custom_mark12
</details>

