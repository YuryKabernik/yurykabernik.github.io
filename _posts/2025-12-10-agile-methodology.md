---
title: "Agile Methodology: Embracing Change Through Iterative Development"
date: 2025-12-10 00:00:01 +0200
categories: Project Management
tags: agile methodology scrum kanban iterative-development agile-manifesto sprints
---

![Agile Methodology](/assets/img/title/title-agile-methodology.png)

Over time, the Waterfall model became the primary methodology for the majority of software projects. Focus on steps that secure production flow and do not add actual value to the final product brought more complexity than benefits to developers' lives. Huge volumes of documentation helped to keep the process under control, but eventually slowed it down and made any changes in priorities or initial requirements everyone's problem.

Agile emerged in the early 2000s in response to the fact that about one third of all companies' profits came from new products. This fact pushed organizations to focus on delivering new products as quickly as possible, adapt to changing requirements, and adjust priorities dynamically.

The new methodology of Agile Software Development was built around four core values:

> - **Individuals and interactions** over processes and tools
> - **Working software** over comprehensive documentation
> - **Customer collaboration** over contract negotiation
> - **Responding to change** over following a plan

In comparison with previous methodologies, it does not aim to optimize production flow or lock in initial requirements. Instead, it assumes that the business environment is constantly changing: project priorities and goals can change on the go, new technologies may reshape the market at any time, and organizations must continuously release innovative solutions. This is achieved by allowing industry experts to lead projects, collaborate directly with customers, decide what is necessary to deliver working software, and re-prioritize work to changing requirements. Self-organizing teams have become the mainstream model, where frequent collaboration and overlapping development phases help maximize results in achieving established goals.

Another distinguishing feature of Agile is the repetition of the same waterfall steps within smaller, time-boxed cycles. Instead of implementing the entire project at once, teams focus on delivering a number of prioritized features. They perform the same steps on a smaller scope of work, release a portion of application functionality, and receive feedback much earlier incorporating new demands and ideas, which increases the value of a solution. Splitting the work into smaller pieces allows teams to adjust priorities to address customer needs each time a new development cycle begins. 

## Core Principles

Agile expands on Waterfall and Lean best practices by adapting them to rapidly changing market needs and a cross-functional team model. This expansion results in twelve guiding principles that describe key priorities without prescribing specific practices or rituals for how Agile should be implemented within a team. 

> 1. **Our highest priority is to satisfy the customer through early and continuous delivery of valuable software.**
> 2. **Welcome changing requirements, even late in development. Agile processes harness change for the customer's competitive advantage.**
> 3. **Deliver working software frequently, from a couple of weeks to a couple of months, with a preference to the shorter timescale.**

The main idea here is to replace a monolithic solution with a series of short, iterative cycles. Small, frequent releases of valuable software allow teams to receive customer feedback quickly and continuously. These principles help teams focus on what is most important to the customer at the moment and adapt to competitive business environment in real time. Sprints are planned around these values, and when priorities change, teams adjust in the next sprint. There is no room for long-running development of complex projects. Keep it simple, move fast, and release often.

> 4. **Business people and developers must work together daily throughout the project.**
> 5. **Build projects around motivated individuals. Give them the environment and support they need, and trust them to get the job done.**
> 6. **The most efficient and effective method of conveying information to and within a development team is face-to-face conversation.**
> 7. **The best architectures, requirements, and designs emerge from self-organizing teams.**
> 8. **At regular intervals, the team reflects on how to become more effective, then tunes and adjusts its behavior accordingly.**

Next, it is suggested to bring experts closer together, encourage collaboration across departments beyond the boundaries of individual phases, and foster an environment of mutual support. Knowledge about the current system is continuously shared, and problems are addressed as soon as they emerge. These principles are one of the reasons why teams today work in cross-functional setups alongside stakeholders, software architects, software developers, quality assurance engineers, product owners, and release managers.

> 9. **Working software is the primary measure of progress.**
> 10. **Agile processes promote sustainable development. The sponsors, developers, and users should be able to maintain a constant pace indefinitely.**
> 11. **Continuous attention to technical excellence and good design enhances agility.**
> 12. **Simplicity—the art of maximizing the amount of work not done—is essential.**

Finally, all efforts of the project team are focused on delivering a best-in-class solution to the end customer. Progress is measured by stable software operation and customer satisfaction through the continuous release of valuable features. Keeping the software in good shape ensures there is always room for new features, performance improvements, architectural modernization, and the ability to address technical debt.

## Key Practices

Agile itself does not provide practical recommendations on how to implement it. Teams and organizations are free to interpret and implement these principles in ways that maximize value within their business domains. In practice, these principles are implemented through three major frameworks inspired by the original Agile values.

### Extreme Programming (XP)

Extreme Programming (XP) is designed specifically for software development. Its Agile principles is focused on engineering practices such as pair programming, planning poker, continuous integration and small releases in delivering working software. XP emphasizes technical excellence, frequent releases, and close collaboration with experts in your team:

- **Agile Planning**: Teams are responsible for planning their own work using short descriptions of features written in the customer’s language, called User Stories. Agile teams use these stories to start the planning process, prioritize work, and estimate complexity of converting business requirements in code. Estimating the work helps teams decide how many stories they can handle in each sprint and what should be done first.

- **Continuous Integration**: To ensure that features developed independently work well together, XP teams continuously integrate their code. This helps to confirm that each change works with the product as intended. In the past, development teams often worked on code in isolation for long periods and attempted integration only at the end. Such prolonged separation increases the risk that components will not fit together, leading to more rework and integration issues.

- **Software Refactoring**: As the software development landscape constantly changes, it is assumed that teams must always leave room for improvements like enhancement of software security, solution re-design, minor- and large-scale refactoring, and the adoption of new technologies. An XP team is never truly satisfied when software is considered “finished”; instead, they continuously improve the code through constant refactoring. Rather than trying to complete the software all at once, they refine and enhance it over time.

- **Test-Driven Development (TDD)**: It is assumed that developers write tests before starting development. It helps to design system workflows and interfaces by thinking about how the software should behave before writing the code. The practice follows a three-step Red–Green–Refactor cycle: write a failing test for new functionality (Red), write the simplest code needed to make the test pass (Green), clean up the code while keeping all tests passing to improve maintainability (Refactor). This cycle is repeated continuously, with new tests securing user story requirements and features being built incrementally. Existing tests provide strong regression safety as the system evolves.

### Kanban Framework

First of all, Kanban is a scheduling system that was used in Lean manufacturing to display team progress on a Kanban Board. The idea behind it is knowing the current team's capacity to do work. Kanban emphasizes visualizing work, limiting work in progress, and managing process flow:

- **Kanban Board**: The Kanban board or Scrum task board is actually a way to organize your team to focus on delivering prioritized stories. These stories should flow through the board in a very particular way from backlog passing development and testing right to the Done column. The top of the backlog should have the highest business value so that the development team will work on what is necessary first. Once that work is done the team can pick up the next story from the top.

- **Work in Progress (WIP) Limits**: Agile teams should avoid multitasking and context switching. This is archived by limiting WIP for each column in order to highlight too many stories in work-in-progress/code-review/testing stage. Teams focus on completing the ongoing work before starting new tasks, which improves value flow and reduces cycle time for each individual story.

- **Continuous Flow**: Unlike Scrum's time-boxed sprints, Kanban promotes continuous delivery where work flows through the system as capacity becomes available. In addition, backlog priorities and content are constantly rebalanced when project priorities or market needs change. Such flexibility allows teams to maximize business value and welcome changes in requirements even late in development.

### Scrum Framework

Originally, Scrum is described as an empirical process control framework, meaning it focuses on learning and discovering outcomes during the process rather than planning the entire project upfront. Decisions about goals, priorities, and features are based on observation of market needs and experimentation, rather than detailed upfront planning. Unfortunately, it is often implemented with strict deadlines and long-term planned work lacking flexibility. This approach contradicts its empirical nature, turning Scrum into a prescriptive methodology rather than an adaptive framework.

Compared to earlier agile frameworks, Scrum introduces a more structured approach with clearly defined roles, recurring ceremonies, and formalized processes:

- **Scrum Roles**: To make the development process more predictive and efficient, teams adopt three clearly defined roles that maintain focus on business priorities: the Product Owner represents the business side and grooms the backlog through stakeholder communication, the Scrum Master facilitates Scrum practices and helps the team monitor and improve their workflow, and the Development Team builds the product. These roles can be filled by existing team members or invited specialists. The Scrum Master role may rotate among team members every sprint to involve everyone in process facilitation.

- **Product Backlog**: To remain responsive to changing business needs, teams maintain a prioritized list of features and requirements. The Product Owner manages this backlog and handles stakeholder communication, allowing developers to focus their time and energy on writing software rather than navigating business discussions.

- **Sprint Planning**: The team defines a clear sprint goals, selects backlog items that meet their owna and business expectations, and breaks them into actionable tasks. It also aligns on scope based on capacity, dependencies, and Definition of Done to reduce mid-sprint surprises.

- **Daily Stand-ups**: Short daily meetings (about 15 minutes) where team members synchronize their work, surface blockers, and adjust the sprint plans. The focus is on progress toward the sprint goal and quick coordination, not detailed problem-solving.

- **Sprint Review**: At the end of each sprint, the team demonstrates completed work to stakeholders, validates it against the sprint goals, and gathers feedback. This feedback informs backlog refinement and priority adjustments for upcoming sprints.

- **Sprint Retrospective**: The team reflects on their process, identifies what worked and what did not, and commits to concrete improvements for the next sprint. It reinforces continuous improvement and team ownership of the workflow.

## Strengths and Benefits

Agile's iterative approach offers several key advantages:

- **Flexible Process**: Flexibility gives the development team the ability to respond to customer demands and incorporate new ideas, which increases the value of the solution. Also, all stages of the development process may be executed in parallel, working on the current sprint and preparing the content for the next one at the same time.

- **Value Focused**: Continuously focusing on the user experience allows us to prioritize the most valuable features and eliminate features you discover are not important, which helps control costs. Project resources might be saved by not investing in functionality that does not meet customer needs.

- **Faster Releases**: Enables your team to develop and release iterative solutions to the market rapidly. No need to wait for a complete solution when you can beat your competitors by being the first who delivered the most desirable feature faster.

- **Identify Issues Early**: Testing early and often enables your team to identify issues and resolve those issues before switching your context to the next iteration. The earlier the team will identify issues, the less rework is required in the future.

- **Team Involvement**: Team, involved in business needs and collaborating with business people, may recommend improvements that would bring even greater value unseen from the customer's perspective.

## Challenges and Considerations

While Agile offers many benefits, it also presents several challenges that teams should be aware of:

- **Lack of Predictability**: Inability to predict the overall development costs may result in under-budgeting teams and departments. Also, unexpectedly changing requirements might bring confusion and miscommunication when not properly communicated within teams.

- **Lack of Documentation**: Insufficient documentation complicates maintenance, onboarding, and cross-team knowledge sharing. Documentation should not fade into oblivion; Agile does not exclude documentation—teams must plan and refresh it so artifacts remain accurate and up to date.

- **Waterfall Sprints**: Software development life cycle of each sprint may vary from project to project, but mostly follows the same Waterfall sequential stages: Requirements, Design, Develop, Test, and Deploy. Stages are highly coupled, meaning preceding stages must be completed before the next stage can be started. Insufficient requirements at the beginning of the sprint might result in severe impediments in succeeding sprint goals and delivery schedules.

- **Sprint Race**: Unrealistic sprint goals, inaccurate estimations, or misused practices eventually turn a simple and adaptable methodology into an endless race for deadlines. When the team needs to hurry to fit in committed timelines, it seriously affects their performance, accuracy, and morale, committing people to overtimes and burnouts.

## Conclusion

Agile methodology represents a fundamental shift in software development, prioritizing adaptability, customer collaboration, and iterative delivery over rigid planning and comprehensive documentation. While it requires cultural change and disciplined practice to implement successfully, Agile's focus on delivering value quickly and responding to change makes it particularly well-suited for dynamic environments where requirements evolve. Understanding both its strengths in flexibility and its challenges in predictability is essential for teams considering an Agile adoption.

## Useful Links

- [The Agile Manifesto](https://agilemanifesto.org/): The foundational document of Agile software development.
- [The 12 Principles Behind the Agile Manifesto](https://agilemanifesto.org/principles.html): Detailed principles guiding Agile practices.
- [Scrum Guide](https://scrumguides.org/): Official guide to the Scrum framework, one of the most popular Agile methodologies.
- [Kanban Guide](https://kanbanguides.org/): Resources for understanding and implementing Kanban practices.
- [Project Management Institute - Agile Practice Guide](https://www.pmi.org/pmbok-guide-standards/practice-guides/agile): Professional guide to Agile project management.
