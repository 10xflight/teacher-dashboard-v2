import fitz
import sys

doc = fitz.open(sys.argv[1])
text = ''
for page in doc:
    text += page.get_text()
print(text)
