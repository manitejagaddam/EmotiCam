from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse 
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import re
import json
import os
from PIL import Image
import io
import random
import base64
import torch
# from llava import LlavaModel 
# import your LLM client wrapper
from client import get_client
# from fer import FER
from deepface import DeepFace
import cv2
import numpy as np

import sys
sys.path.append("/path/to/LLaVA")
# from LLaVA.llava.model import 
# Initialize app and model client
app = FastAPI(title="Kids Emotion & Safe Content API", version="1.0")
client = get_client()



sentiment_ans = "happy"







# Enable CORS for all origins (can restrict later)
app.add_middleware( 
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



def generate_fallback_response():
    # Randomly vary some fields for diversity
    age_options = ["4-5 years", "5-6 years", "4-6 years"]
    emotions = ["Curious/Alert", "Happy/Playful", "Calm/Focused"]
    energy_levels = ["Low", "Medium", "High"]
    durations = ["10-15 minutes", "15-20 minutes", "20-25 minutes"]

    fallback_analysis = {
        "childAnalysis": {
            "ageEstimate": random.choice(age_options),
            "primaryEmotion": random.choice(emotions),
            "energyLevel": random.choice(energy_levels),
            "developmentalStage": "Preschool",
            "moodIndicators": "Engaged and ready for learning activities",
        },
        "contentStrategy": {
            "emotionalNeed": "Educational and entertaining content",
            "learningOpportunity": "Interactive learning and creative expression",
            "energyMatch": "Moderate activity level content",
            "attentionSpan": "Short to medium format (10-15 minutes)",
        },
        "youtubeKidsQueries": [
            "learning songs children safe",
            "kids crafts activities simple",
            "animated stories children educational",
            "counting colors shapes kids",
        ],
        "googleSafeQueries": [
            "kid-friendly educational content 4-6 years",
            "safe preschool learning activities",
            "age-appropriate children videos",
            "educational games kids supervised",
            "family-friendly kids entertainment",
        ],
        "queryRanking": {
            "bestMatch": "educational videos preschool kids",
            "reason": "Balanced educational content for curious preschooler",
            "rankedQueries": [
                {"query": "educational videos preschool kids", "score": 90, "reasoning": "Perfect balance of education and engagement"},
                {"query": "learning songs children safe", "score": 85, "reasoning": "Engaging, educational via music"},
                {"query": "counting colors shapes kids", "score": 80, "reasoning": "Core learning for preschoolers"},
                {"query": "kids crafts activities simple", "score": 75, "reasoning": "Creative and fun"},
                {"query": "animated stories children educational", "score": 70, "reasoning": "Good for attention span"},
            ],
        },
        "parentalGuidance": {
            "suggestedDuration": random.choice(durations),
            "supervisionLevel": "Guided supervision",
            "coViewingOpportunities": "Engage with content together",
            "discussionPoints": "Discuss learning topics or favorite parts",
            "followUpActivities": "Practice numbers, colors, and crafts",
        },
        "developmentalBenefits": {
            "emotionalDevelopment": "Supports emotional growth and empathy",
            "cognitiveSkills": "Improves attention and comprehension",
            "socialSkills": "Encourages communication and cooperation",
            "creativeExpression": "Boosts imagination and artistic sense",
        },
        "safetyAssurance": [
            "Age-appropriate content only",
            "No inappropriate themes or language",
            "Educational value included",
            "Positive role models featured",
            "Parent supervision recommended",
            "Safe platform recommendations",
        ],
    }
    return fallback_analysis


def convert_np(obj):
    """
    Recursively convert numpy types in dict/list to native Python types.
    """
    if isinstance(obj, dict):
        return {k: convert_np(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_np(i) for i in obj]
    elif isinstance(obj, (np.float32, np.float64)):
        return float(obj)
    elif isinstance(obj, (np.int32, np.int64)):
        return int(obj)
    else:
        return obj





# Request schema
class EmotionRequest(BaseModel):
    imageData: str


@app.post("/api/emotion-v2")
async def analyse_emotions_v2(req: EmotionRequest):
    global sentiment_ans
    image_data = req.imageData

    if "," in image_data:
        img_base64 = image_data.split(",")[1]
    else:
        img_base64 = image_data
    
    img_bytes = base64.b64decode(img_base64)

    # Open the image with PIL
    image = Image.open(io.BytesIO(img_bytes)).convert("RGB")  # Convert to RGB to avoid issues

    # Analyze emotions using DeepFace
    try:
        img_np = np.array(image)
        result = DeepFace.analyze(img_np, actions=['emotion'], enforce_detection = False)
        sentiment_ans = result[0]['dominant_emotion']
        print("Emotion Analysis Result:", result)
    except Exception as e:
        print("Error analyzing image:", e)


    # print(image_data)
    if not image_data:
        raise HTTPException(status_code=400, detail="No image data provided")

    # Remove data:image/... prefix
    base64_image = re.sub(r"^data:image\/[a-z]+;base64,", "", image_data)

    try:
        # === Step 1: Ask model for structured child emotion + content analysis ===
        
        # image_description = json.dumps([face for face in result])
        if isinstance(result, list):
            face_data = result  # list of faces
        else:
            face_data = [result]  # wrap single dict in a list

        # Convert all numpy types to native Python
        face_data = convert_np(face_data)

        # Now safe to JSON encode
        image_description = json.dumps(face_data)

        messages = [
            {
                "role": "system",
                "content": """You are a child-focused facial expression analyst. 
        Analyze the emotions provided by the user and provide **exactly 10 YouTube video URLs only** that match the child's emotion and age. 
        Do not provide any text, explanation, or additional data — only raw URLs separated by commas or newlines."""
            },
            {
                "role": "user",
                "content": f"""Emotion data: {image_description}"""
            }
        ]



        response = client.chat.completions.create(
            model="openai/gpt-oss-20b",  # or "gpt-4.1-mini"
            # model="meta-llama/llama-4-maverick-17b-128e-instruct",  # or "gpt-4.1-mini"
            messages=messages,
            max_tokens=1500,
            temperature=0.7,
        )

        # === Step 2: Parse LLM output safely ===
        content = response.choices[0].message.content.strip()
        print("content : ", response.choices[0].message.content)
        ans = response.choices[0].message.content.strip()
        urls = [url.strip() for url in ans.split("\n") if url.strip()]
        # print(ans)
        print(urls)
        return JSONResponse(content={"success": True, "analysis": urls})

    except Exception as e:
        FALLBACK_RESPONSES = [generate_fallback_response() for _ in range(20)]
        response = random.choice(FALLBACK_RESPONSES)
        return JSONResponse(content={"success": False, "analysis": response})

        # return JSONResponse(content={"success": False, "analysis": fallback_analysis})

    
    
    
    
    
    
    
    
    
    
    
    
@app.post("api/sentiment")
async def sentiment_grabber(req: EmotionRequest):
    global sentiment_ans
    image_data = req.imageData

    if not image_data:
        raise HTTPException(status_code=400, detail="No image data provided")

    # Remove "data:image/..." prefix if exists
    if "," in image_data:
        img_base64 = image_data.split(",")[1]
    else:
        img_base64 = image_data

    img_bytes = base64.b64decode(img_base64)

    # Open image with PIL
    image = Image.open(io.BytesIO(img_bytes)).convert("RGB")

    # Analyze emotions using DeepFace
    try:
        img_np = np.array(image)
        result = DeepFace.analyze(img_np, actions=['emotion'], enforce_detection = False)
        sentiment_ans = result[0]['dominant_emotion']
        print("Emotion Analysis Result:", result)
    except Exception as e:
        print("Error analyzing image:", e)
        result = {"emotion": {"neutral": 1}}  # fallback to neutral if analysis fails

    # Wrap single dict in a list if needed
    face_data = result if isinstance(result, list) else [result]

    # Convert numpy types to native Python
    def convert_np(obj):
        if isinstance(obj, list):
            return [convert_np(i) for i in obj]
        elif isinstance(obj, dict):
            return {k: convert_np(v) for k, v in obj.items()}
        elif isinstance(obj, np.generic):
            return obj.item()
        return obj

    face_data = convert_np(face_data)
    image_description = json.dumps(face_data)

    try:
        # === Step 1: Ask model for structured titles ===
        messages = [
            {
                "role": "system",
                "content": """
You are a child-focused content recommender. 
Based on the provided emotion data from an image, generate **exactly 1 highly suitable YouTube video titles** that perfectly match the child's emotion and are safe for all kids under 18 years old. 
Do not provide any URLs, descriptions, or extra text — only the titles, separated by newlines.
"""
            },
            {
                "role": "user",
                "content": f"Emotion data: {image_description}"
            }
        ]

        response = client.chat.completions.create(
            model="openai/gpt-oss-20b",  # or your preferred model
            messages=messages,
            max_tokens=1500,
            temperature=0.7,
        )

        content = response.choices[0].message.content.strip()
        titles = [title.strip() for title in content.split("\n") if title.strip()]
        print("Generated Titles:", titles)

        return JSONResponse(content={"success": True, "titles": titles})

    except Exception as e:
        print("Error generating titles:", e)
        
    

@app.post("/api/get_sentiment")
async def get_Sentiment_val():
    global sentiment_ans
    return JSONResponse(content={"emotion" : sentiment_ans})




@app.post("/api/emotion")
async def analyze_emotion(req: EmotionRequest):
    global sentiment_ans
    image_data = req.imageData

    if "," in image_data:
        img_base64 = image_data.split(",")[1]
    else:
        img_base64 = image_data
    
    img_bytes = base64.b64decode(img_base64)

    # Open the image with PIL
    image = Image.open(io.BytesIO(img_bytes)).convert("RGB")  # Convert to RGB to avoid issues

    # Analyze emotions using DeepFace
    try:
        img_np = np.array(image)
        result = DeepFace.analyze(img_np, actions=['emotion'], enforce_detection = False)
        sentiment_ans = result[0]['dominant_emotion']
        print("Emotion Analysis Result:", result)
    except Exception as e:
        print("Error analyzing image:", e)


    # print(image_data)
    if not image_data:
        raise HTTPException(status_code=400, detail="No image data provided")

    # Remove data:image/... prefix
    base64_image = re.sub(r"^data:image\/[a-z]+;base64,", "", image_data)

    try:
        # === Step 1: Ask model for structured child emotion + content analysis ===
        
        # image_description = json.dumps([face for face in result])
        if isinstance(result, list):
            face_data = result  # list of faces
        else:
            face_data = [result]  # wrap single dict in a list

        # Convert all numpy types to native Python
        face_data = convert_np(face_data)

        # Now safe to JSON encode
        image_description = json.dumps(face_data)

        messages = [
            {
                "role": "system",
                "content": """
                You are a child-focused facial expression analyst. Analyze the image and provide a comprehensive response in EXACT JSON format.

CRITICAL INSTRUCTIONS:
1. If you see a person of ANY age (even if not clearly a child), provide analysis assuming they are a child
2. If no clear face is visible, provide general recommendations for a 4-6 year old child
3. ALWAYS return complete analysis - never use "N/A" or empty values
4. Return ONLY the JSON object - no additional text

REQUIRED JSON FORMAT (copy exactly):
{
  "childAnalysis": {
    "ageEstimate": "4-6 years",
    "primaryEmotion": "Happy/Excited",
    "energyLevel": "High",
    "developmentalStage": "Preschool",
    "moodIndicators": "Bright eyes, alert expression, engaged posture"
  },
  "contentStrategy": {
    "emotionalNeed": "Engaging and fun activities to match current state",
    "learningOpportunity": "Creative expression and interactive learning",
    "energyMatch": "Active content with movement and interaction",
    "attentionSpan": "Short to medium format (5-15 minutes)"
  },
  "youtubeKidsQueries": [
    "educational cartoons children safety vedios",
    "educational cartoons children safe",
    "kids dance movement videos",
    "simple crafts activities children",
    "storytelling videos kids animated"
  ],
  "googleSafeQueries": [
    "kid-friendly educational videos 4-6 years",
    "safe learning activities preschool children",
    "age-appropriate entertainment kids",
    "supervised children content educational",
    "family-friendly kids videos learning"
  ],
  "queryRanking": {
    "bestMatch": "educational cartoons children safety vedios",
    "reason": "Perfect match for happy preschooler with high energy - songs provide engagement and learning",
    "rankedQueries": [
      {
        "query": "educational cartoons children safety vedios",
        "score": 95,
        "reasoning": "Optimal for happy, high-energy preschooler - combines education with fun"
      },
      {
        "query": "kids dance movement videos",
        "score": 90,
        "reasoning": "Excellent for high energy level and physical expression"
      },
      {
        "query": "educational cartoons children safe",
        "score": 85,
        "reasoning": "Good educational value with visual engagement for age group"
      },
      {
        "query": "simple crafts activities children",
        "score": 75,
        "reasoning": "Creative but may require adult supervision for this age"
      },
      {
        "query": "storytelling videos kids animated",
        "score": 70,
        "reasoning": "Good for attention span but less interactive for high energy"
      }
    ]
  },
  "parentalGuidance": {
    "suggestedDuration": "15-20 minutes",
    "supervisionLevel": "Guided supervision recommended",
    "coViewingOpportunities": "Join in songs, discuss learning topics, engage with content",
    "discussionPoints": "Talk about emotions, colors, characters, and learning concepts",
    "followUpActivities": "Real-world crafts, singing, dancing, outdoor play"
  },
  "developmentalBenefits": {
    "emotionalDevelopment": "Supports emotional recognition and healthy expression",
    "cognitiveSkills": "Enhances learning through visual and auditory stimulation",
    "socialSkills": "Encourages interaction, sharing, and social development",
    "creativeExpression": "Promotes imagination, creativity, and artistic expression"
  },
  "safetyAssurance": [
    "Age-appropriate content only",
    "No inappropriate themes or language", 
    "Educational value included",
    "Positive role models featured",
    "Parent supervision recommended",
    "Safe platform recommendations"
  ]
}

EMOTION DETECTION GUIDELINES:
- Happy/Excited: Smiles, bright eyes, animated features
- Calm/Content: Relaxed expression, peaceful look
- Curious/Alert: Wide eyes, attentive posture
- Tired/Sleepy: Droopy eyes, yawning, relaxed
- Sad/Upset: Downturned mouth, withdrawn look
- Surprised/Amazed: Wide eyes, open mouth, raised eyebrows

QUERY RANKING GUIDELINES:
- Score queries from 0-100 based on how well they match the child's:
  * Emotional state (happy = active content, tired = calm content)
  * Energy level (high = movement/songs, low = quiet/stories)
  * Developmental stage (toddler = simple, preschool = colors/shapes, school = educational)
  * Age appropriateness (2-4 = basic concepts, 4-6 = interactive learning, 6+ = complex topics)
- Always provide detailed reasoning for each score
- Select the highest-scoring query as "bestMatch"
- Ensure the ranking makes logical sense for child development

AGE ESTIMATION GUIDELINES:
- Look for facial features, proportions, and expressions
- If uncertain, default to "4-6 years" for preschool content
- Adjust content recommendations based on estimated age

ENERGY LEVEL ASSESSMENT:
- High: Bright, animated, active expressions
- Medium: Alert but calm, engaged
- Low: Tired, sleepy, or very relaxed

Always provide helpful, safe, educational content recommendations with intelligent query ranking based on the child's specific needs.
                
                """
            },
            {
                "role": "user",
                "content": f"""Emotion data: {image_description}"""
            }
        ]



        response = client.chat.completions.create(
            model="openai/gpt-oss-20b",  # or "gpt-4.1-mini"
            # model="meta-llama/llama-4-maverick-17b-128e-instruct",  # or "gpt-4.1-mini"
            messages=messages,
            max_tokens=1500,
            temperature=0.7,
        )

        # === Step 2: Parse LLM output safely ===
        content = response.choices[0].message.content.strip()
        print("content : ", response.choices[0].message.content)
        ans = response.choices[0].message.content.strip()
        urls = [url.strip() for url in ans.split("\n") if url.strip()]
        # print(ans)
        print(urls)
        # return urls
        if not content:
            raise ValueError("Empty model response")

        clean_content = re.sub(r"```json|```", "", content).strip()
        analysis_result = json.loads(clean_content)
        
        
        # print(analysis_result)

        # Validate minimum structure
        required_keys = ["childAnalysis", "contentStrategy", "queryRanking"]
        if not all(k in analysis_result for k in required_keys):
            raise ValueError("Invalid JSON structure from model")

        return JSONResponse(content={"success": True, "analysis": analysis_result})

    except Exception as e:
        print("Error:", e)
        FALLBACK_RESPONSES = [generate_fallback_response() for _ in range(20)]
        response = random.choice(FALLBACK_RESPONSES)
        return JSONResponse(content={"success": False, "analysis": response})

        















