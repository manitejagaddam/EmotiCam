from groq import Groq
import os
from dotenv import load_dotenv
load_dotenv()


def get_client():
    api_key = os.getenv("GROQ_API_KEY")
    # print(api_key)
    client = Groq(api_key=api_key)
    # client = Groq()
    return client
    
