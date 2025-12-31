import os
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.embeddings import OllamaEmbeddings
from langchain_community.vectorstores import Chroma

# --- CONFIGURATION ---
SOURCE_DIRECTORY = "/home/richm/Documents/AG_Project2/audit-viewer/manuals"  # Put your PDF files here
DB_PATH = "./local_db"          # Where the vector DB will be saved
EMBEDDING_MODEL = "nomic-embed-text" # Must be pulled in Ollama first

def ingest_pdfs():
    # 1. Check if directory exists
    if not os.path.exists(SOURCE_DIRECTORY):
        print(f"Error: Directory '{SOURCE_DIRECTORY}' not found.")
        return

    # 2. Iterate through all PDFs in the directory
    documents = []
    for filename in os.listdir(SOURCE_DIRECTORY):
        if filename.endswith(".pdf"):
            file_path = os.path.join(SOURCE_DIRECTORY, filename)
            print(f"Loading: {filename}...")
            
            # Load the PDF
            loader = PyPDFLoader(file_path)
            docs = loader.load()
            
            # Add metadata (Filename) so we can cite it later
            for doc in docs:
                doc.metadata["source_manual"] = filename
            
            documents.extend(docs)

    if not documents:
        print("No PDFs found to ingest.")
        return

    # 3. Split the text into "Chunks"
    #    Chunk Size 1000: Good for capturing a full regulation clause.
    #    Overlap 200: Vital so context isn't lost if a sentence is cut in half.
    print(f"Splitting {len(documents)} pages into chunks...")
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
        separators=["\n\n", "\n", "(?<=\. )", " ", ""]
    )
    splits = text_splitter.split_documents(documents)
    print(f"Created {len(splits)} chunks.")

    # 4. Create/Update the Vector Database
    print("Embedding data and saving to ChromaDB (this may take a moment)...")
    embeddings = OllamaEmbeddings(model=EMBEDDING_MODEL)
    
    vectorstore = Chroma.from_documents(
        documents=splits, 
        embedding=embeddings, 
        persist_directory=DB_PATH
    )
    
    print(f"Success! Data saved to {DB_PATH}")

if __name__ == "__main__":
    ingest_pdfs()

