# GenAI evaluation

## Provider

Server-side retrieval in `backend/app/genai/rag_engine.py`.

- If `OPENAI_API_KEY` is set, the grounded evidence pack is sent to the configured LLM.
- If the key is missing, answers are composed **only** from authorised SQL results. The UI still shows citations. This is not a mock chatbot.

## Safety checks covered by tests

- Batch summary for a real seeded batch (e.g. B-104) returns citations that resolve to records.
- Unknown batch IDs must not invent coverage.
- Prompt-injection style questions cannot approve a batch.
- Completing an action or releasing a batch cannot be done from generated text; those are separate authenticated endpoints.

## Mandatory distinctions in answers

- ML suggestion vs human-confirmed result
- Distinct inspected items vs photograph count
- Missing evidence â†’ â€œcannot be answered from available recordsâ€
