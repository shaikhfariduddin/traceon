# GenAI Evaluation — Traceon

## 1. Provider and Retrieval

Traceon uses a server-side Retrieval-Augmented Generation (RAG) workflow to provide evidence-based quality insights using the **Google Gemini API**.

- The Gemini API key is configured through a backend environment variable and must never be exposed in the frontend or committed to GitHub.
- The backend retrieves relevant, authorized quality records from PostgreSQL and prepares an evidence-based context for Gemini.
- If Gemini is unavailable or not configured, the system should return a clear fallback response based on authorized database records, if supported by the implementation.
- Responses should include citations or record references that allow users to trace the supporting evidence.

## 2. Evaluation and Safety Checks

GenAI responses should be evaluated against the following cases:

- **Valid batch query:** Summaries use actual batch records and provide verifiable citations.
- **Unknown batch:** The system does not invent batch details or inspection results.
- **Prompt injection:** Instructions attempting to bypass permissions or approve a batch are rejected or safely ignored.
- **Unauthorized data:** Responses do not disclose records the requesting user is not permitted to access.
- **Quality decisions:** Generated text cannot independently confirm defects, complete corrective actions, or release batches. These operations require separate authenticated application workflows.

## 3. Mandatory Response Rules

- **ML prediction vs. human decision:** Clearly distinguish predicted defects from human-confirmed defects.
- **Item count vs. image count:** Do not treat multiple photographs of one item as multiple inspected items.
- **Missing evidence:** State that the question cannot be answered from the available records when supporting data is insufficient.
- **Evidence-based answers:** Do not fabricate batch details, defect counts, review decisions, or corrective-action status.

## 4. Evaluation Objective

The goal is to ensure that Traceon's GenAI component provides useful, traceable quality insights while preserving data privacy, human oversight, and reliable batch decision-making.
