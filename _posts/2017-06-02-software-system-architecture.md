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
ViewPoint "1..n" --> "1..n" Concerns : corresponds
Perspective "1..n" --> "1..n" Concerns : correspoinds
View "0..n" --> ViewPoint : obeys
View "0..n" --> "0..n" Perspective : is formed by
ArchitectureDescription --> "1..n" Stakeholder : documents architecture for
ArchitectureDescription *-- "1..n" View : consists of
Architect --> Architecture : designs
Architect --> ArchitectureDefinitionProcess : obeys
Architect --> ArchitectureDescription : creates and owns
Architect --> "1..n" Stakeholder : catches their concerns
Stakeholder --> "1..n" Concerns : has
System --> Architecture : has
System --> "1..n" Stakeholder : satisfies their needs
@enduml

custom_mark1
</details>
