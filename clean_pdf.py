import os
from pypdf import PdfReader, PdfWriter

# --- CONFIGURATION ---
INPUT_FILE = "/home/richm/Documents/AG_Project2/audit-viewer/manuals/nih_design_requirements_rev_2.1_2024.pdf"  # The file you downloaded
OUTPUT_FILE = "/home/richm/Documents/AG_Project2/audit-viewer/manuals/nih_design_requirements_rev_2.1_2024_clean.pdf" # The new file to save
PAGES_TO_REMOVE = 31  # How many pages to cut from the start

def remove_front_matter(input_path, output_path, pages_to_cut):
    # 1. Validation
    if not os.path.exists(input_path):
        print(f"Error: Could not find file '{input_path}'")
        return

    print(f"Processing: {input_path}")
    
    try:
        reader = PdfReader(input_path)
        writer = PdfWriter()
        
        total_pages = len(reader.pages)
        print(f"Total pages detected: {total_pages}")

        # Safety check: Don't cut if the file is too short
        if total_pages <= pages_to_cut:
            print("Error: You are trying to remove more pages than the file contains!")
            return

        # 2. Loop through pages, skipping the first X
        # We start the loop at 'pages_to_cut' and go to the end
        print(f"Removing first {pages_to_cut} pages...")
        for i in range(pages_to_cut, total_pages):
            page = reader.pages[i]
            writer.add_page(page)

        # 3. Save the new file
        with open(output_path, "wb") as f_out:
            writer.write(f_out)
        
        print(f"Success! Saved clean version to: {output_path}")
        print(f"New page count: {len(writer.pages)}")

    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    remove_front_matter(INPUT_FILE, OUTPUT_FILE, PAGES_TO_REMOVE)
