# Product Definition

## Purpose

Legalize ChatGPT App is a source-grounded assistant for people who need to understand Spanish legislation. It helps users find relevant laws, inspect concrete articles, understand legal text in plain language, and verify claims against authoritative sources.

The app is not a legally binding tool and does not provide legal advice. It is a research assistant that keeps users close to the source material so they can make fewer mistakes, ask better questions, and know when to consult a qualified professional.

## Problem

General-purpose LLMs often answer questions about Spanish law from memory. That creates three practical risks:

- The answer may rely on outdated law.
- The answer may cite the wrong norm, article, or jurisdiction.
- The answer may sound confident without giving the user a source they can verify.

Spanish legislation changes over time and can differ across national and autonomous-community levels. Users need a tool that makes source verification the default path, not an optional follow-up.

## Intended Users

- People living in Spain who need to understand which rules may apply to their situation.
- Foreign residents, applicants, workers, families, and small business owners trying to navigate Spanish legal requirements.
- Researchers, students, translators, and journalists who need fast source discovery.
- Lawyers and professional advisors who want a quick source-finding assistant, while retaining full responsibility for legal interpretation.
- LLM assistants and ChatGPT workflows that need current legal context instead of relying only on model memory.

## Core Jobs

1. Find relevant legal sources from a natural-language question.
2. Show the exact law, article, source link, jurisdiction, status, and last update date.
3. Explain source excerpts in plain language without hiding the original legal text.
4. Map a user's situation to potentially relevant norms while asking clarifying questions when facts are missing.
5. Surface reform history when a law has changed.
6. Help users prepare better questions for a lawyer, public office, gestor, or other qualified professional.

## Product Principles

- Source first: every substantive legal answer should be traceable to a law, article, date, and source URL.
- Current by design: retrieval should prefer the indexed current text and expose last update dates.
- Jurisdiction-aware: answers should distinguish national legislation from autonomous-community legislation.
- Plain language, not oversimplification: explanations should make text easier to understand without replacing the source.
- Uncertainty is useful: when the app cannot identify the right norm, it should ask clarifying questions or say what is missing.
- No false authority: the app should never imply that it is a lawyer, court, public authority, or legally binding source.
- Read-only by default: the app should not submit forms, file claims, modify records, or perform legal actions for users.

## What The App Should Do

- Search Spanish legislation by topic, phrase, identifier, jurisdiction, status, rank, and date.
- Retrieve a specific law or article by identifier and article number.
- Return short, bounded excerpts with citation metadata.
- Explain what a cited article appears to say in accessible language.
- Identify related laws or articles when the user describes a situation.
- Highlight when several jurisdictions or law types may be relevant.
- Show reform history, affected articles, dates, and source links where available.
- Encourage users to read the source and consult a qualified professional for decisions with legal consequences.

## What The App Should Not Do

- Provide legal advice or guarantee legal outcomes.
- Present generated summaries as substitutes for the official source text.
- Invent citations, article numbers, dates, exceptions, or procedures.
- Hide uncertainty when the corpus does not support an answer.
- Answer jurisdiction-sensitive questions without checking the relevant jurisdiction.
- Make filings, submit applications, send notices, or interact with government systems.
- Store unnecessary personal data about user situations.
- Publish private server access details, credentials, or infrastructure secrets.

## Source-Grounded Answer Pattern

For legal research answers, the app should guide ChatGPT toward this pattern:

1. State the likely relevant source or say that more facts are needed.
2. Provide the exact citation: law title, identifier, article, jurisdiction, status, last update date, and source URL.
3. Quote or summarize only the necessary excerpt.
4. Explain the excerpt in plain language.
5. Separate what the source says from any practical interpretation.
6. Mention uncertainty, missing facts, or jurisdiction limits.
7. Recommend professional verification when the user's decision may have legal consequences.

## Success Criteria

- Users can move from a legal question to a specific source in one or two tool calls.
- Answers cite concrete sources instead of relying on general legal memory.
- Users can see whether a cited law is current, repealed, consolidated, or otherwise status-limited.
- Ambiguous questions lead to clarifying questions rather than confident guesses.
- The app makes source reading easier, not less necessary.
- The open-source repository remains publishable without private deployment details.

## Positioning

Legalize ChatGPT App is a norm-grounded legal research companion for Spanish legislation. It helps people understand and verify the law, but it does not replace lawyers, public authorities, official publications, or professional advice.
