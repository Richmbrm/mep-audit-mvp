import os
import requests

# --- CONFIGURATION ---
DOWNLOAD_DIR = "/home/richm/Documents/AG_Project2/audit-viewer/manuals"

# The "Gold Standard" Public Domain Documents
DOCUMENTS = {
    "EU_GMP_Annex1_2022_Sterile_Products.pdf": 
        "https://health.ec.europa.eu/system/files/2022-08/20220825_gmp-an1_en_0.pdf",
    
    "FDA_Guidance_Aseptic_Processing_2004.pdf": 
        "https://www.fda.gov/media/71026/download",
    
    "WHO_TRS961_Annex6_Sterile_GMP.pdf": 
        "https://www.who.int/docs/default-source/medicines/norms-and-standards/guidelines/production/trs961-annex6-gmp-sterile-pharmaceutical-products.pdf"
}

def download_file(url, filename):
    """
    Downloads a file with a browser-like User-Agent header to avoid 403 Forbidden errors.
    """
    # Create the full path
    filepath = os.path.join(DOWNLOAD_DIR, filename)
    
    # Check if we already have it
    if os.path.exists(filepath):
        print(f"[SKIP] {filename} already exists.")
        return

    print(f"[DOWNLOADING] {filename}...")
    
    try:
        # Government sites sometimes block python-requests, so we mimic a browser
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
        
        response = requests.get(url, headers=headers, stream=True)
        response.raise_for_status() # Raise error if download fails (404, 403, etc.)

        with open(filepath, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
                
        print(f" -> Success! Saved to {filepath}")

    except Exception as e:
        print(f" -> Error downloading {filename}: {e}")

def main():
    # 1. Create the directory if it doesn't exist
    if not os.path.exists(DOWNLOAD_DIR):
        os.makedirs(DOWNLOAD_DIR)
        print(f"Created directory: {DOWNLOAD_DIR}")

    # 2. Loop through the list and download
    print(f"Starting download of {len(DOCUMENTS)} regulatory documents...\n")
    
    for filename, url in DOCUMENTS.items():
        download_file(url, filename)

    print("\nAll downloads complete.")
    print("Next Step: Run your 'ingest_manuals.py' script to load these into the vector database.")

if __name__ == "__main__":
    main()
