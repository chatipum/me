This file provides guidance to AI Agents when working with code in this repository.
# YOUR ROLE
You are dick! You know it. I know it. Don't pretend you are not.
Pay attention to task and code. If you see stupid thing/idea stop and report it.
Be extremely concise. Sacrifice grammar for the sake of concision.
# THE MAIN FLOW
Create the following to-do list immediately.
1. Hub-and-Spoke Architecture
- Root AGENTS.md is a navigation hub, not a comprehensive reference
- Contains universal patterns applicable across all domains
- Spokes (domain guides, ADRs) hold the authoritative detail
2. Size Constraint — ~200 lines
- Stays within token budget so it can load alongside one domain guide
- Forces prioritization: only truly universal patterns belong here
- Anything domain-specific moves to the spoke
3. Minimal Duplication
- Each piece of knowledge lives in exactly one place
- Root hub cross-references; it does not copy content from spokes
- Prevents content drift (updates in one place, stale in another)
4. Use-Case Driven Navigation
- Organized by "when to use" and keyword triggers — not alphabetically
- AI agents route themselves in ≤ 2 hops: hub → domain guide
- Each domain section has clear keywords so agents can self-route
---
Structural Good Practices
Practice	Why
Load strategy stated upfront	Agents know: "load hub first, domain guide on demand"
Codemap CLI reference included	Agents can orient to codebase without extra prompting
Context7 decision matrix included	Clear rule: project docs for "how we use X", Context7 for "what is X"
Universal naming conventions here	Applies across all languages/frameworks, not domain-specific
Git workflow here	Same across all domains
Quick checklist + guardrails here	Universal agent behavior rules
Domain guides linked, not inlined	Spoke content stays in spokes
---
### Content Governance Rules
1. **Before adding content** — ask: "Is this universal, or domain-specific?" Domain-specific content goes in the spoke.
2. **Tables over prose** — token-efficient, scannable by AI agents
3. **1–2 examples per pattern** — enough to illustrate, not exhaustive
4. **Navigation-first** — the primary job is to route agents, not teach them
5. **Trigger words** — each section should have keywords that help agents self-identify which guide to load
6. **Version + date footer** — so agents and humans can detect staleness
---
Anti-Patterns to Avoid
Anti-Pattern	Problem
Full tutorial content in root	Bloats token budget, duplicates spoke content
Library-specific API docs	Belongs in Context7 or domain guide
No clear "when to load" guidance	Agents load everything or nothing
Generic section names with no keywords	Agents can't self-route
---