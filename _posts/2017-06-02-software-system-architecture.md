---
layout: page
title: Software System Architecture, Working With Stakeholders Using Viewpoints and Perspectives
---

[URL](https://books.google.co.jp/books?isbn=4797376724)

![Alt text](https://g.gravizo.com/svg?
  digraph G {
    aize ="4,4";
    main [shape=box];
    main -> parse [weight=8];
    parse -> execute;
    main -> init [style=dotted];
    main -> cleanup;
    execute -> { make_string; printf}
    init -> make_string;
    edge [color=red];
    main -> printf [style=bold,label="100 times"];
    make_string [label="make a string"];
    node [shape=box,style=filled,color=".7 .3 1.0"];
    execute -> compare;
  }
)

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
custom_mark12
</details>

