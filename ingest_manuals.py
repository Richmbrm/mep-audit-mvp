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

    # 1b. Clear existing database to prevent duplicates
    if os.path.exists(DB_PATH):
        print(f"Clearing existing database at {DB_PATH}...")
        import shutil
        # We remove the contents but keep the directory, or just remove and recreate
        shutil.rmtree(DB_PATH)
        os.makedirs(DB_PATH)

    # 2. Iterate through all PDFs in the directory
    all_files = os.listdir(SOURCE_DIRECTORY)
    pdf_files = [f for f in all_files if f.endswith(".pdf")]
    
    # Identify files to skip (original files that have a _clean version)
    clean_versions = [f for f in pdf_files if f.endswith("_clean.pdf")]
    originals_with_clean = [f.replace("_clean.pdf", ".pdf") for f in clean_versions]
    
    documents = []
    for filename in pdf_files:
        # Skip if there's a cleaner version available
        if filename in originals_with_clean:
            print(f"Skipping original (clean version found): {filename}")
            continue
            
        file_path = os.path.join(SOURCE_DIRECTORY, filename)
        print(f"Loading: {filename}...")
        
        try:
            # Load the PDF
            loader = PyPDFLoader(file_path)
            docs = loader.load()
            
            # Add metadata (Filename and relative path)
            for doc in docs:
                doc.metadata["source_manual"] = filename
                # Page numbers should be 1-indexed for user readability
                if "page" in doc.metadata:
                    doc.metadata["page"] = int(doc.metadata["page"]) + 1
                else:
                    doc.metadata["page"] = "N/A"
            
            documents.extend(docs)
        except Exception as e:
            print(f"Error loading {filename}: {e}")

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

