import os
from langchain_community.document_loaders import PyPDFLoader

SOURCE_DIRECTORY = "/home/richm/Documents/AG_Project2/audit-viewer/manuals"
TARGET_TERMS = ["ISO 7", "ISO 8", "ACH", "Air Changes", "Pressure"]

for filename in os.listdir(SOURCE_DIRECTORY):
    if filename.endswith(".pdf"):
        file_path = os.path.join(SOURCE_DIRECTORY, filename)
        print(f"\nChecking: {filename}...")
        loader = PyPDFLoader(file_path)
        docs = loader.load()
        
        found = False
        for doc in docs:
            for term in TARGET_TERMS:
                if term.lower() in doc.page_content.lower():
                    print(f"  Found '{term}' on page {doc.metadata.get('page', 'unknown')}")
                    found = True
        if not found:
            print("  No target terms found.")
