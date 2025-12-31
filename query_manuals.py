import sys
import os
import json
from langchain_community.vectorstores import Chroma
from langchain_ollama import OllamaEmbeddings

# --- CONFIGURATION ---
DB_PATH = "./local_db"
EMBEDDING_MODEL = "nomic-embed-text"

def query_vector_db(query_text):
    if not os.path.exists(DB_PATH):
        return {"error": "Vector database not found. Please run ingest_manuals.py first."}

    try:
        # Initialize Embeddings
        embeddings = OllamaEmbeddings(model=EMBEDDING_MODEL)
        
        # Load the Vector Store
        vectorstore = Chroma(
            persist_directory=DB_PATH, 
            embedding_function=embeddings
        )

        # Perform Similarity Search
        # k=3: Get the top 3 most relevant snippets
        results = vectorstore.similarity_search(query_text, k=3)

        response = []
        for doc in results:
            response.append({
                "content": doc.page_content,
                "source": doc.metadata.get("source_manual", "Unknown Source"),
                "page": doc.metadata.get("page", "N/A")
            })

        return {"results": response}

    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No query provided"}))
        sys.exit(1)

    query = sys.argv[1]
    result = query_vector_db(query)
    print(json.dumps(result))
