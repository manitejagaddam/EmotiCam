import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const { imageData } = await request.json();
    
    if (!imageData) {
      return json({ error: "No image data provided" }, { status: 400 });
    }

    // Remove the data:image/jpeg;base64, prefix if present
    const base64Image = imageData.replace(/^data:image\/[a-z]+;base64,/, "");

    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: `You are a child-focused facial expression analyst. Analyze the image and provide a comprehensive response in EXACT JSON format.

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
    "bestMatch": "educational cartoons children safe",
    "reason": "Perfect match for happy preschooler with high energy - songs provide engagement and learning",
    "rankedQueries": [
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

Always provide helpful, safe, educational content recommendations with intelligent query ranking based on the child's specific needs.`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Please analyze this image and provide safe content recommendations with intelligent query ranking for this child. Even if the image is unclear, provide your best analysis and recommendations with properly ranked search queries.",
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
              },
            },
          ],
        },
      ],
      max_tokens: 1500,
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content?.trim();
    
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    try {
      // Clean the content to ensure it's valid JSON
      const cleanContent = content.replace(/```json|```/g, '').trim();
      const analysisResult = JSON.parse(cleanContent);
      
      // Validate that we have the required structure
      if (!analysisResult.childAnalysis || !analysisResult.contentStrategy || !analysisResult.queryRanking) {
        throw new Error("Invalid analysis structure");
      }
      
      return json({ success: true, analysis: analysisResult });
    } catch (parseError) {
      console.error("Error parsing OpenAI response:", parseError);
      console.error("Raw content:", content);
      
      // Provide fallback response with query ranking
      const fallbackAnalysis = {
        childAnalysis: {
          ageEstimate: "4-6 years",
          primaryEmotion: "Curious/Alert",
          energyLevel: "Medium",
          developmentalStage: "Preschool",
          moodIndicators: "Engaged and ready for learning activities"
        },
        contentStrategy: {
          emotionalNeed: "Educational and entertaining content",
          learningOpportunity: "Interactive learning and creative expression",
          energyMatch: "Moderate activity level content",
          attentionSpan: "Short to medium format (10-15 minutes)"
        },
        youtubeKidsQueries: [
          "learning songs children safe",
          "kids crafts activities simple",
          "animated stories children educational",
          "counting colors shapes kids"
        ],
        googleSafeQueries: [
          "kid-friendly educational content 4-6 years",
          "safe preschool learning activities",
          "age-appropriate children videos",
          "educational games kids supervised",
          "family-friendly kids entertainment"
        ],
        queryRanking: {
          bestMatch: "educational videos preschool kids",
          reason: "Well-balanced educational content suitable for curious preschooler with medium energy",
          rankedQueries: [
            {
              query: "learning songs children safe",
              score: 85,
              reasoning: "Good for medium energy with educational value through music"
            },
            {
              query: "counting colors shapes kids",
              score: 80,
              reasoning: "Age-appropriate learning fundamentals for preschoolers"
            },
            {
              query: "kids crafts activities simple",
              score: 75,
              reasoning: "Creative but may require supervision for this age group"
            },
            {
              query: "animated stories children educational",
              score: 70,
              reasoning: "Good for attention span but less interactive"
            }
          ]
        },
        parentalGuidance: {
          suggestedDuration: "15-20 minutes",
          supervisionLevel: "Guided supervision",
          coViewingOpportunities: "Engage with learning content together",
          discussionPoints: "Discuss what they learned and enjoyed",
          followUpActivities: "Practice counting, colors, or creative activities"
        },
        developmentalBenefits: {
          emotionalDevelopment: "Supports emotional growth and expression",
          cognitiveSkills: "Enhances learning and cognitive development",
          socialSkills: "Promotes social interaction and communication",
          creativeExpression: "Encourages creativity and imagination"
        },
        safetyAssurance: [
          "Age-appropriate content only",
          "No inappropriate themes or language",
          "Educational value included",
          "Positive role models featured",
          "Parent supervision recommended",
          "Safe platform recommendations"
        ]
      };
      
      return json({ success: true, analysis: fallbackAnalysis });
    }

  } catch (error) {
    console.error("Error analyzing expression:", error);
    return json({ error: "Failed to analyze child's expression" }, { status: 500 });
  }
} 