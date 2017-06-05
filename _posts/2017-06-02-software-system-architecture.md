---
layout: page
title: Software System Architecture, Working With Stakeholders Using Viewpoints and Perspectives
---

[Book URL](https://books.google.co.jp/books?isbn=4797376724)

![Alt text](https://g.gravizo.com/source/svg/custom_mark1?https://raw.githubusercontent.com/yasukei/yasukei.github.io/master/_posts/2017-06-02-software-system-architecture.md)
<details> 
<summary></summary>
custom_mark1
@startuml
RelationshipBetweenElements "1..n" --> "2..n" ArchitectureElement : relates
Architecture *-- ArchitectureElement : consists of
Architecture "1..n" *-- "1..n" RelationshipBetweenElements : consists of
Architecture --> "0..n" ArchitectureDescription : documentable
ArchitectureDefinitionProcess --> "1..n" Architecture : derives definitions
System --> Architecture : has
System --> Stakeholder : satisfies their needs
@enduml

custom_mark1
</details>
