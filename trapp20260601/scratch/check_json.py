import json
import sys

try:
    with open('results.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    print("JSON is valid. Number of items:", len(data))
except json.JSONDecodeError as e:
    print(f"JSONDecodeError: {e}")
    sys.exit(1)
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)
