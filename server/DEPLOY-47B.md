## Required production configuration

This branch is intentionally not a Render Free deployment. The local Mixtral 8x7B Q3_K_M model is about 20.36 GB and its published no-GPU maximum RAM requirement is about 22.86 GB. A 32 GB runtime is the practical minimum target, with persistent storage large enough for the model. Render Free is therefore not a valid runtime for this configuration.

Before production traffic:

1. Render service must use the configured paid 32 GB plan and persistent 25 GB disk.
2. Deploy this branch or merge it into the branch connected to the Render service.
3. Wait for the model download to finish; it is stored on `/var/data/etsi-ai` and resumable through the `.part` file.
4. Verify `/health` reports `downloaded: true` and later `loaded: true`.
5. Verify `/test/memory` returns `ok: true`.
6. Verify `/test` returns a real model response and `provider: "model"`/local path rather than the old narrative fallback.
7. Send multiple `/generate` requests and a changed-topic request to confirm context isolation.
