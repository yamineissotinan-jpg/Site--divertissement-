# Et Si? local 47B deployment

The production target for the no-API local brain is Mixtral-8x7B-Instruct-v0.1, 47B total parameters, using the Q3_K_M GGUF quantization.

Runtime requirements:
- Model file: about 20.36 GB
- Reported maximum RAM without GPU offload: about 22.86 GB
- Render target: Pro Ultra + 25 GB persistent disk
- Local context: 2048 tokens
- CPU threads: 8

Health checks:
- `/health` reports whether the model file is downloaded and loaded.
- `/test/memory` checks bounded conversation memory and follow-up handling.
- `/test/ai` checks an optional remote provider; it is not required for the local brain.
- `/test` performs a real generation request.

The model is downloaded to the persistent disk at startup and a `.part` file is used so interrupted downloads can resume when the server restarts.
