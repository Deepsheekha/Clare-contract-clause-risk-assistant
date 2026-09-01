import re


def create_chunks(pages):
    chunks = []

    for page in pages:
        text = page["text"]
        page_number = page["page"]

        # Fix PDF extraction artifacts like:
        # 1
        # 0.
        # 1 Cap on Northstar Liability.
        #
        # into:
        # 10.1 Cap on Northstar Liability.
        text = re.sub(
            r'(?m)^\s*(\d+)\s*\n\s*(\d+)\.\s*\n\s*(\d+)\s+',
            r'\1\2.\3 ',
            text
        )

        # Find clause starts:
        # 1. DEFINITIONS
        # 1.1 "Services"
        # 10.1 Cap on Northstar Liability
        pattern = re.compile(
            r'(?m)^\s*(\d+(?:\.\d+)?)\s+(.+)$'
        )

        matches = list(pattern.finditer(text))

        for i, match in enumerate(matches):

            section = match.group(1)
            title = match.group(2).strip()

            start = match.start()

            if i + 1 < len(matches):
                end = matches[i + 1].start()
            else:
                end = len(text)

            clause_text = text[start:end].strip()

            chunks.append({
                "section": section,
                "title": title,
                "page": page_number,
                "text": clause_text
            })

    return chunks