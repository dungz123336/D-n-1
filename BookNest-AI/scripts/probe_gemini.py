import os
from dotenv import load_dotenv

load_dotenv()
import google.generativeai as genai

key = os.getenv("GEMINI_API_KEY") or ""
print("key_prefix", key[:10], "len", len(key))
genai.configure(api_key=key)

models = [
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-flash",
    "gemini-1.5-flash-8b",
    "gemini-flash-latest",
    "gemini-pro",
]

for m in models:
    try:
        model = genai.GenerativeModel(m)
        r = model.generate_content("Say hi in one short sentence.")
        print("OK", m, "->", (getattr(r, "text", None) or "")[:100])
        break
    except Exception as e:
        print("FAIL", m, "->", type(e).__name__, str(e)[:220].replace("\n", " "))
