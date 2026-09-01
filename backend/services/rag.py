from sentence_transformers import SentenceTransformer
import numpy as np


model = SentenceTransformer("all-MiniLM-L6-v2")


def create_embeddings(chunks):
    texts = [chunk["text"] for chunk in chunks]

    embeddings = model.encode(
        texts,
        convert_to_numpy=True,
        normalize_embeddings=True
    )

    return embeddings


def retrieve_relevant_clauses(
    query,
    chunks,
    embeddings,
    top_k=5
):
    query_embedding = model.encode(
        [query],
        convert_to_numpy=True,
        normalize_embeddings=True
    )[0]

    scores = np.dot(
        embeddings,
        query_embedding
    )

    top_indices = np.argsort(scores)[::-1][:top_k]

    results = []

    for index in top_indices:
        result = chunks[index].copy()
        result["similarity"] = float(scores[index])

        results.append(result)

    return results