# Phase 04: Tool Guidance And Safety

Back to master plan: [00-master-plan.md](./00-master-plan.md)

## Objective

Make the tool manifest and server instructions clear enough that GPT uses the intended direct safe flow without rediscovering tools or guessing article identifiers.

## Scope

- MCP server instructions.
- Tool descriptions.
- ChatGPT app submission test cases.
- Golden prompts for Russian user questions.
- Safety-block mitigation through concise, canonical tool-call guidance.

## Checklist

> Mark completed items as `[x]`.

- [x] Update `SERVER_INSTRUCTIONS` to state the preferred workflow: search by topic, then retrieve article text using the returned stable identifier and article match.
- [x] Add concise examples to tool descriptions where supported by existing MCP metadata patterns, without adding internal reasoning or noisy prose.
- [x] Keep search queries short and source-oriented in guidance to reduce host safety false positives.
- [x] Update `chatgpt-app-submission.json` with a positive test case for the Russian autónomo question and a stable search-to-article sequence.
- [x] Add a negative or recovery case for an article lookup that receives `unknown_article.suggestions`.
- [x] Ensure all guidance remains public-facing, read-only, and non-advice oriented.
- [x] Commit: `git commit -m "Clarify Spanish law research tool flow guidance"`

## Validation

- [x] Golden prompts demonstrate that the model should call `search_laws` first and `get_article` second.
- [x] MCP tests still report five read-only tools without UI resources.
- [x] Public copy contains no internal prompts, debugging notes, or implementation rationale.

## Dependencies / Risks

- Repository changes cannot fully prevent OpenAI host-level safety false positives. Validation should verify safer intended calls, not claim absolute safety-filter control.
