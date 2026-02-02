
import asyncio
import os
from backend.services.file_node import FileProcessor

async def test_file_processor():
    processor = FileProcessor()
    
    # Create a dummy text file
    test_file = "test_document.txt"
    with open(test_file, "w") as f:
        f.write("This is a test document for MarkItDown ingestion.\nIt should be converted to markdown.")
    
    print(f"Processing {test_file}...")
    result = processor.process(test_file)
    
    print("\nResult Status:", result["status"])
    print("File Type:", result["file_type"])
    print("Content Snippet:", result["content"][:100])
    
    # Clean up
    os.remove(test_file)

if __name__ == "__main__":
    asyncio.run(test_file_processor())
