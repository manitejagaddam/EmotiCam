import { useRef, useState } from "react";
import type { MetaFunction, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, Link, useAsyncError } from "@remix-run/react";
import { getUserFromRequest } from "~/lib/auth.server";
import { log } from "node:console";

export const meta: MetaFunction = () => {
  return [
    { title: "KidsEmotion - Child-Safe Content Recommendations" },
    { name: "description", content: "Child-focused facial expression analysis and safe content recommendations" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getUserFromRequest(request);
  return json({ user });
}

interface ChildAnalysis {
  ageEstimate: string;
  primaryEmotion: string;
  energyLevel: string;
  developmentalStage: string;
  moodIndicators: string;
}

interface ContentStrategy {
  emotionalNeed: string;
  learningOpportunity: string;
  energyMatch: string;
  attentionSpan: string;
}

interface ParentalGuidance {
  suggestedDuration: string;
  supervisionLevel: string;
  coViewingOpportunities: string;
  discussionPoints: string;
  followUpActivities: string;
}

interface DevelopmentalBenefits {
  emotionalDevelopment: string;
  cognitiveSkills: string;
  socialSkills: string;
  creativeExpression: string;
}

interface AnalysisResult {
  childAnalysis: ChildAnalysis;
  contentStrategy: ContentStrategy;
  youtubeKidsQueries: string[];
  googleSafeQueries: string[];
  parentalGuidance: ParentalGuidance;
  developmentalBenefits: DevelopmentalBenefits;
  safetyAssurance: string[];
}

interface YouTubeVideo {
  title: string;
  channel: string;
  description: string;
  duration: string;
  url: string;
  thumbnail: string;
  ageAppropriate: boolean;
  educational: boolean;
  safetyRating: string;
  category: string;
  searchQuery: string;
}

interface VideoSearchResult {
  success: boolean;
  videos: YouTubeVideo[];
  totalFound: number;
  searchQueries: string[];
  note?: string;
  selectedQuery?: string;
  queryRanking?: {
    bestMatch: string;
    reason: string;
    rankedQueries: Array<{
      query: string;
      score: number;
      reasoning: string;
    }>;
  };
}

export default function Index() {
  const { user } = useLoaderData<typeof loader>();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [videoResults, setVideoResults] = useState<VideoSearchResult | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isSearchingVideos, setIsSearchingVideos] = useState(false);
  const [error, setError] = useState<string>("");
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string>("");
  const [detectionStep, setDetectionStep] = useState<string>("");
  const [sentiment, setSentiment] = useState<string>("");

  // Start webcam
  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: false,
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsWebcamActive(true);
        setError("");
      }
    } catch (err) {
      setError("Error accessing webcam. Please ensure you have granted camera permissions.");
      console.error("Error accessing webcam:", err);
    }
  };

  // Stop webcam
  const stopWebcam = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setIsWebcamActive(false);
      setCapturedPhoto("");
      setDetectionStep("");
      setAnalysis(null);
      setVideoResults(null);
    }
  };

  // Analyze child's expression
  // const analyzeExpression 
  // onClick={() => {
  const analyzeExpression = async () => {
    if (!videoRef.current || !canvasRef.current || isDetecting) return;

    setIsDetecting(true);
    setError("");
    
    try {
      // Step 1: Take photo
      setDetectionStep("📸 Taking photo...");
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const ctx = canvas.getContext("2d");
      
      if (!ctx) return;

      // Set canvas size to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // Draw video frame to canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Convert canvas to base64 and display the captured phot = canvas.toDataURL("image/jpeg", 0.8);
      const imageData = canvas.toDataURL("image/jpeg", 0.8);
      setCapturedPhoto(imageData);
      
      // Add a brief delay to show the photo was captured
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Step 2: Send to AI for analysis
      setDetectionStep("🤖 Analyzing child's expression...");
      
      const response = await fetch("http://127.0.0.1:8000/api/emotion", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ imageData }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log("result : " + result);
      
      
      if (result.error) {
        throw new Error(result.error);
      }

      // Step 3: Show results
      setDetectionStep("✅ Analysis complete!");
      setAnalysis(result.analysis);
      
      // Step 4: Automatically search for YouTube videos
      setTimeout(async () => {
        setDetectionStep("🎥 Finding YouTube videos...");
        await searchYouTubeVideosForAnalysis(result.analysis);
        setDetectionStep("");
      }, 1000);
      
    } catch (err) {
      setError("Error analyzing expression. Please check your OpenAI API key.");
      setDetectionStep("");
      console.error("Error analyzing expression:", err);
    } finally {
      setIsDetecting(false);
    }
  };


  const getSentimentAnalysis = async () =>{

    try {      
      const response = await fetch("http://127.0.0.1:8000/api/get_sentiment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ capturedPhoto }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log("result : " + result);
      
      
      if (result.error) {
        throw new Error(result.error);
      }

      // Step 3: Show results
      setSentiment(result['emotion']);
      console.log(result['emotion']);
      
      
    } catch (err) {
      setError("Error getting expression. Please check your Code Base.");
      setDetectionStep("");
      console.error("Error analyzing expression:", err);
    } finally {
      setIsDetecting(false);
    }
  }

  // Search for YouTube videos based on analysis (direct call with analysis parameter)
  const searchYouTubeVideosForAnalysis = async (analysisData: AnalysisResult) => {
    if (!analysisData || isSearchingVideos) return;
    console.log("Search Youtube Vedios For Analysis is Called");
    

    // console.log("analysis data :  " + analysisData);
    

    setIsSearchingVideos(true);
    setError("");

    try {
      const searchQueries = [...analysisData.youtubeKidsQueries, ...analysisData.googleSafeQueries];
      // console.log("searchQueries : " + searchQueries);
      
      
      const response = await fetch("/api/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          searchQueries,
          childAnalysis: analysisData ,
          ImageData : capturedPhoto
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error);
      }

      setVideoResults(result);

      
      
      
    } catch (err) {
      setError("Error searching for videos. Please try again.");
      console.error("Error searching videos:", err);
    } finally {
      setIsSearchingVideos(false);
    }
  };

  const groupVideosByCategory = (videos: YouTubeVideo[]) => {
    const grouped: Record<string, YouTubeVideo[]> = {};
    videos.forEach(video => {
      const category = video.category || 'General Learning';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(video);
    });
    return grouped;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-300 via-purple-300 to-indigo-400 relative overflow-hidden">
      {/* Floating Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 left-10 w-20 h-20 bg-yellow-300 rounded-full animate-float opacity-60"></div>
        <div className="absolute top-32 right-20 w-16 h-16 bg-pink-300 rounded-full animate-bounce-fun opacity-60"></div>
        <div className="absolute bottom-20 left-1/4 w-24 h-24 bg-green-300 rounded-full animate-bubble opacity-60"></div>
        <div className="absolute top-1/2 right-10 w-12 h-12 bg-blue-300 rounded-full animate-jiggle opacity-60"></div>
        <div className="absolute bottom-32 right-1/3 w-18 h-18 bg-purple-300 rounded-full animate-heart-beat opacity-60"></div>
        
        {/* Animated Stars */}
        <div className="absolute top-20 left-1/3 text-yellow-400 text-2xl animate-spin-slow">⭐</div>
        <div className="absolute bottom-40 left-20 text-pink-400 text-xl animate-wiggle">🌟</div>
        <div className="absolute top-40 right-1/4 text-blue-400 text-3xl animate-pulse">✨</div>
      </div>

      <div className="container mx-auto px-4 py-8 relative z-10">
        {/* Authentication Navigation */}
        <div className="flex justify-end mb-4 animate-slide-down">
          {user ? (
            <div className="flex items-center gap-4">
              <Link
                to="/dashboard"
                className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 rounded-2xl font-fun font-bold text-white transition-all duration-300 transform hover:scale-105 shadow-lg border-2 border-white/50 flex items-center gap-2"
              >
                <span className="text-xl animate-pulse">🏠</span>
                Dashboard
              </Link>
              <div className="text-white font-fun font-bold bg-white/20 px-4 py-2 rounded-2xl backdrop-blur-sm border-2 border-white/30 flex items-center gap-2">
                <span className="text-xl animate-heart-beat">👋</span>
                Hi {user.name}!
              </div>
            </div>
          ) : (
            <div className="flex gap-3">
              <Link
                to="/login"
                className="px-4 py-2 bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 rounded-2xl font-fun font-bold text-white transition-all duration-300 transform hover:scale-105 shadow-lg border-2 border-white/50 flex items-center gap-2"
              >
                <span className="text-xl animate-jiggle">🔑</span>
                Login
              </Link>
              <Link
                to="/signup"
                className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-2xl font-fun font-bold text-white transition-all duration-300 transform hover:scale-105 shadow-lg border-2 border-white/50 flex items-center gap-2"
              >
                <span className="text-xl animate-bounce-fun">🚀</span>
                Sign Up
              </Link>
            </div>
          )}
        </div>

        {/* Header with enhanced child-friendly design */}
        <div className="text-center mb-8 animate-slide-down">
          <div className="bg-white/20 backdrop-blur-md rounded-3xl p-8 border-4 border-white/30 shadow-2xl mx-auto max-w-4xl">
            <h1 className="text-5xl font-fun font-bold mb-4 animate-float">
              <span className="inline-block hover:animate-jiggle transition-all duration-300 hover:scale-110 text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 animate-rainbow">
                KidsEmotion
              </span>{" "}
              <span className="inline-block animate-bounce-fun text-6xl">👶</span>
              <span className="inline-block animate-heart-beat text-6xl">📱</span>
            </h1>
            <div className="flex justify-center items-center gap-4 mb-4">
              <span className="text-4xl animate-wiggle">🌈</span>
              <p className="text-2xl text-white font-semibold animate-fade-in bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-2 rounded-full shadow-lg">
                Fun & Safe Content for Kids!
              </p>
              <span className="text-4xl animate-spin-slow">🎨</span>
            </div>
            <div className="flex justify-center gap-2">
              <span className="text-2xl animate-bounce-fun">🎭</span>
              <span className="text-2xl animate-float">🎪</span>
              <span className="text-2xl animate-wiggle">🎨</span>
              <span className="text-2xl animate-pulse">🌟</span>
              <span className="text-2xl animate-jiggle">🎵</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-8">
          {/* Webcam Controls with rainbow styling */}
          <div className="flex gap-6 animate-slide-up">
            <button
              onClick={startWebcam}
              disabled={isWebcamActive}
              className="group px-8 py-4 bg-gradient-to-r from-green-400 to-blue-500 hover:from-green-500 hover:to-blue-600 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed rounded-2xl font-fun font-bold text-xl transition-all duration-300 transform hover:scale-110 hover:shadow-2xl active:scale-95 shadow-lg border-4 border-white/50"
            >
              <span className="flex items-center gap-3 text-white">
                {isWebcamActive ? (
                  <>
                    <span className="w-3 h-3 bg-green-300 rounded-full animate-pulse shadow-lg"></span>
                    <span className="text-2xl animate-wiggle">📹</span>
                    Camera is ON!
                    <span className="text-2xl animate-heart-beat">💚</span>
                  </>
                ) : (
                  <>
                    <span className="text-3xl group-hover:animate-jiggle">📹</span>
                    Start Camera Fun!
                    <span className="text-3xl group-hover:animate-bounce-fun">🎬</span>
                  </>
                )}
              </span>
            </button>
            <button
              onClick={stopWebcam}
              disabled={!isWebcamActive}
              className="group px-8 py-4 bg-gradient-to-r from-red-400 to-pink-500 hover:from-red-500 hover:to-pink-600 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed rounded-2xl font-fun font-bold text-xl transition-all duration-300 transform hover:scale-110 hover:shadow-2xl active:scale-95 shadow-lg border-4 border-white/50"
            >
              <span className="flex items-center gap-3 text-white">
                <span className="text-3xl group-hover:animate-wiggle">⏹️</span>
                Stop Camera
                <span className="text-3xl group-hover:animate-jiggle">🛑</span>
              </span>
            </button>
          </div>

          {/* Video and Photo Display with playful design */}
          <div className="flex flex-col lg:flex-row gap-8 items-center animate-scale-in">
            {/* Live Video Container */}
            <div className="text-center group">
              <div className="bg-white/20 backdrop-blur-md rounded-3xl p-6 border-4 border-rainbow-blue/50 shadow-2xl">
                <h3 className="text-2xl font-fun font-bold mb-4 group-hover:text-blue-300 transition-colors duration-300 flex items-center justify-center gap-2">
                  <span className="text-3xl animate-wiggle">📹</span>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-purple-500">Live Camera</span>
                  <span className="text-3xl animate-pulse">✨</span>
                </h3>
                <div className="relative transform transition-all duration-500 hover:scale-105">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-80 h-60 bg-gradient-to-br from-blue-200 to-purple-200 rounded-2xl shadow-2xl border-8 border-white/50 transition-all duration-300 hover:border-rainbow-blue/70 hover:shadow-blue-500/30 hover:shadow-2xl"
                  />
                  {!isWebcamActive && (
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-300/80 to-purple-300/80 flex items-center justify-center rounded-2xl backdrop-blur-sm transition-all duration-300">
                      <div className="text-white text-center animate-pulse">
                        <div className="text-6xl animate-bounce-fun mb-4">📹</div>
                        <div className="text-xl font-fun font-bold bg-blue-500/80 px-4 py-2 rounded-full">
                          Click "Start Camera" to begin the fun!
                        </div>
                        <div className="flex justify-center gap-2 mt-4">
                          <span className="text-2xl animate-wiggle">🎬</span>
                          <span className="text-2xl animate-float">🌟</span>
                          <span className="text-2xl animate-jiggle">🎪</span>
                        </div>
                      </div>
                    </div>
                  )}
                  {isWebcamActive && (
                    <div className="absolute top-4 right-4 flex items-center gap-2">
                      <div className="w-4 h-4 bg-red-400 rounded-full animate-pulse shadow-lg border-2 border-white"></div>
                      <span className="text-white font-fun font-bold bg-red-500/80 px-2 py-1 rounded-full text-sm">LIVE</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Captured Photo Container */}
            <div className="text-center group">
              <div className="bg-white/20 backdrop-blur-md rounded-3xl p-6 border-4 border-rainbow-pink/50 shadow-2xl">
                <h3 className="text-2xl font-fun font-bold mb-4 group-hover:text-pink-300 transition-colors duration-300 flex items-center justify-center gap-2">
                  <span className="text-3xl animate-heart-beat">📸</span>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-purple-500">Photo Magic</span>
                  <span className="text-3xl animate-spin-slow">🎨</span>
                </h3>
                <div className="relative w-80 h-60 bg-gradient-to-br from-pink-200 to-purple-200 rounded-2xl shadow-2xl border-8 border-white/50 transform transition-all duration-500 hover:scale-105 hover:border-rainbow-pink/70 hover:shadow-pink-500/30 hover:shadow-2xl">
                  {capturedPhoto ? (
                    <img
                      src={capturedPhoto}
                      alt="Captured moment"
                      className="w-full h-full object-cover rounded-xl animate-fade-in"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-pink-300/80 to-purple-300/80 flex items-center justify-center rounded-xl backdrop-blur-sm">
                      <div className="text-white text-center animate-pulse">
                        <div className="text-6xl animate-float mb-4">📸</div>
                        <div className="text-lg font-fun font-bold bg-pink-500/80 px-4 py-2 rounded-full">
                          Your photo will appear here!
                        </div>
                        <div className="flex justify-center gap-2 mt-4">
                          <span className="text-2xl animate-jiggle">✨</span>
                          <span className="text-2xl animate-wiggle">🌈</span>
                          <span className="text-2xl animate-bounce-fun">📷</span>
                        </div>
                      </div>
                    </div>
                  )}
                  {isDetecting && (
                    <div className="absolute inset-0 bg-gradient-to-br from-yellow-300/90 to-orange-300/90 flex items-center justify-center rounded-xl backdrop-blur-sm animate-fade-in">
                      <div className="text-white text-center">
                        <div className="relative mb-4">
                          <div className="absolute inset-0 bg-gradient-to-r from-rainbow-red via-rainbow-yellow to-rainbow-green rounded-2xl opacity-75 animate-shimmer"></div>
                          <div className="relative bg-black/50 px-6 py-4 rounded-2xl border-4 border-white/50">
                            <div className="text-2xl font-fun font-bold flex items-center gap-3">
                              <span className="text-3xl animate-spin-slow">🔄</span>
                              {detectionStep}
                              <span className="text-3xl animate-heart-beat">💖</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Analysis Button with rainbow styling */}
          {isWebcamActive && (
            <div className="animate-slide-up">
              <button
                // onClick={analyzeExpression}
                onClick={() => {
                  analyzeExpression();
                  getSentimentAnalysis();
                }}
                disabled={isDetecting}
                className="group px-12 py-6 bg-gradient-to-r from-rainbow-red via-rainbow-yellow to-rainbow-green hover:from-rainbow-orange hover:via-rainbow-pink hover:to-rainbow-purple disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed rounded-3xl font-fun font-bold text-2xl transition-all duration-300 shadow-2xl hover:shadow-3xl transform hover:scale-110 active:scale-95 border-4 border-white/50 text-white"
              >
                <span className="flex items-center gap-4">
                  {isDetecting ? (
                    <>
                      <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span className="animate-pulse">{detectionStep}</span>
                      <span className="text-4xl animate-jiggle">✨</span>
                    </>
                  ) : (
                    <>
                      <span className="text-4xl group-hover:animate-jiggle">📸</span>
                      <span className="animate-bounce-fun">Let's Analyze Your Expression!</span>
                      <span className="text-4xl group-hover:animate-heart-beat">🎭</span>
                      <span className="text-4xl group-hover:animate-wiggle">✨</span>
                    </>
                  )}
                </span>
              </button>
            </div>
          )}



          {/* Error Display with playful styling */}
          {error && (
            <div className="bg-gradient-to-r from-red-400/30 to-pink-400/30 border-4 border-red-300 rounded-3xl p-6 max-w-md text-center animate-slide-down backdrop-blur-md shadow-2xl">
              <div className="flex items-center justify-center gap-3 animate-fade-in">
                <span className="text-4xl animate-jiggle">⚠️</span>
                <div className="text-center">
                  <div className="font-fun font-bold text-xl text-red-100 mb-2">Oops! Something went wrong!</div>
                  <p className="text-red-200 font-semibold">{error}</p>
                </div>
                <span className="text-4xl animate-wiggle">😅</span>
              </div>
            </div>
          )}

          {/* YouTube Video Results with colorful design */}
          {videoResults && (
            <div className="w-full max-w-6xl animate-scale-in">
              <div className="bg-gradient-to-br from-white/20 to-purple/20 backdrop-blur-md rounded-3xl p-8 mb-6 border-4 border-white/30 shadow-2xl">
                <h2 className="text-4xl font-fun font-bold mb-6 text-center animate-slide-down">

                  <span className="inline-block animate-jiggle text-5xl">🎥</span>
                  <span className="mx-4 text-transparent bg-clip-text bg-gradient-to-r from-rainbow-red via-rainbow-yellow to-rainbow-blue">
                    {sentiment}
                  </span>
                  <span className="inline-block animate-heart-beat text-5xl">🌟</span>
                  <br />


                  <span className="inline-block animate-jiggle text-5xl">🎥</span>
                  <span className="mx-4 text-transparent bg-clip-text bg-gradient-to-r from-rainbow-red via-rainbow-yellow to-rainbow-blue">
                    Fun Videos for You!
                  </span>
                  <span className="inline-block animate-heart-beat text-5xl">🌟</span>
                </h2>
                
                <div className="text-center mb-6 animate-fade-in">
                  <div className="bg-gradient-to-r from-green-400/30 to-blue-400/30 rounded-2xl p-4 border-4 border-white/30">
                    <p className="text-2xl font-fun font-bold text-white flex items-center justify-center gap-3">
                      <span className="animate-bounce-fun">🎊</span>
                      Found <span className="text-rainbow-yellow font-black text-3xl animate-pulse bg-green-500/50 px-3 py-1 rounded-full">{videoResults.totalFound}</span> awesome videos!
                      <span className="animate-spin-slow">🎪</span>
                    </p>
                  </div>
                  
                  {/* AI Query Selection Info with rainbow styling */}
                  {videoResults.queryRanking && (
                    <div className="mt-6 p-6 bg-gradient-to-r from-purple-400/30 to-blue-400/30 rounded-2xl border-4 border-purple-300/50 animate-slide-up backdrop-blur-sm shadow-xl">
                      <h3 className="text-2xl font-fun font-bold text-purple-100 mb-4 flex items-center justify-center gap-3">
                        <span className="animate-float text-3xl">🤖</span>
                        Smart Video Search!
                        <span className="animate-jiggle text-3xl">✨</span>
                      </h3>
                      <div className="text-left space-y-4">
                        <div className="flex items-center gap-3 animate-fade-in bg-white/20 rounded-2xl p-4 border-2 border-white/30">
                          <span className="text-purple-200 font-fun font-bold text-lg">🎯 Best Match:</span>
                          <span className="text-white font-mono text-lg bg-black/40 px-3 py-2 rounded-xl border-2 border-white/30">
                            "{videoResults.queryRanking.bestMatch}"
                          </span>
                          <span className="text-rainbow-green font-black text-xl bg-green-400/50 px-3 py-2 rounded-full animate-pulse border-2 border-green-300">
                            {videoResults.queryRanking.rankedQueries?.[0]?.score || 'N/A'}% Perfect!
                          </span>
                        </div>
                        <div className="text-purple-100 text-lg animate-fade-in bg-white/10 rounded-xl p-3 border-2 border-white/20">
                          <span className="font-fun font-bold">🧠 Why this is perfect:</span> {videoResults.queryRanking.reason}
                        </div>
                        
                        {/* Top 3 Ranked Queries with playful animations */}
                        {videoResults.queryRanking.rankedQueries && (
                          <div className="mt-4 animate-slide-up">
                            <p className="text-purple-200 font-fun font-bold text-lg mb-3 flex items-center gap-2">
                              <span className="animate-spin-slow">🏆</span>
                              Top Video Searches:
                            </p>
                            <div className="space-y-3">
                              {videoResults.queryRanking.rankedQueries.slice(0, 3).map((rankedQuery, index) => (
                                <div key={index} className="flex items-center gap-3 text-lg animate-fade-in transition-all duration-300 hover:bg-white/20 p-3 rounded-xl border-2 border-white/20 hover:border-white/40" style={{animationDelay: `${index * 150}ms`}}>
                                  <span className="text-rainbow-yellow font-black text-xl">#{index + 1}</span>
                                  <span className="text-white font-mono bg-black/40 px-2 py-1 rounded-lg border border-white/30">
                                    "{rankedQuery.query}"
                                  </span>
                                  <span className="text-rainbow-green font-bold bg-green-400/50 px-2 py-1 rounded-full border border-green-300">
                                    {rankedQuery.score}%
                                  </span>
                                  <span className="text-gray-200 flex-1 font-semibold">- {rankedQuery.reasoning}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Fallback for non-AI selection */}
                  {videoResults.selectedQuery && !videoResults.queryRanking && (
                    <div className="mt-4 p-4 bg-gradient-to-r from-blue-400/30 to-cyan-400/30 rounded-2xl animate-slide-up backdrop-blur-sm border-4 border-blue-300/50">
                      <p className="text-blue-100 text-lg flex items-center justify-center gap-3 font-fun font-bold">
                        <span className="animate-bounce-fun text-2xl">🎯</span>
                        <strong>Selected Search:</strong> 
                        <span className="font-mono bg-black/40 px-3 py-2 rounded-xl border-2 border-white/30">
                          "{videoResults.selectedQuery}"
                        </span>
                      </p>
                    </div>
                  )}
                  
                  {videoResults.note && (
                    <div className="mt-4 p-4 bg-gradient-to-r from-yellow-400/30 to-orange-400/30 rounded-2xl animate-fade-in border-4 border-yellow-300/50">
                      <p className="text-yellow-100 text-lg flex items-center justify-center gap-3 font-fun font-bold">
                        <span className="animate-wiggle text-2xl">⚠️</span> 
                        {videoResults.note}
                        <span className="animate-pulse text-2xl">💡</span>
                      </p>
                    </div>
                  )}
                </div>

                {videoResults.videos.length > 0 ? (
                  <div className="space-y-8 animate-fade-in">
                    {Object.entries(groupVideosByCategory(videoResults.videos)).map(([category, videos], categoryIndex) => (
                      <div key={category} className="bg-gradient-to-br from-white/20 to-purple/10 rounded-3xl p-6 animate-slide-up backdrop-blur-md border-4 border-white/20 shadow-2xl" style={{animationDelay: `${categoryIndex * 200}ms`}}>
                        <h3 className="text-3xl font-fun font-bold mb-6 text-white flex items-center justify-center gap-4">
                          <span className="animate-bounce-fun text-4xl">📚</span>
                          <span className="text-transparent bg-clip-text bg-gradient-to-r from-rainbow-pink to-rainbow-blue">
                            {category}
                          </span>
                          <span className="text-lg text-rainbow-yellow bg-rainbow-purple/30 px-4 py-2 rounded-full font-black border-4 border-yellow-300 animate-pulse">
                            {videos.length} Fun Videos!
                          </span>
                          <span className="animate-wiggle text-4xl">🎪</span>
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {videos.map((video, index) => (
                            <div key={index} className="group bg-gradient-to-br from-white/30 to-purple/20 rounded-2xl p-5 transition-all duration-300 hover:bg-gradient-to-br hover:from-white/40 hover:to-purple/30 hover:scale-105 hover:shadow-2xl animate-scale-in border-4 border-white/30 hover:border-rainbow-blue/60 shadow-xl" style={{animationDelay: `${(categoryIndex * 200) + (index * 100)}ms`}}>
                              <div className="aspect-video bg-gradient-to-br from-gray-600 to-gray-800 rounded-xl mb-4 flex items-center justify-center relative overflow-hidden group-hover:shadow-2xl transition-all duration-300 border-4 border-white/20">
                                {video.thumbnail ? (
                                  <img 
                                    src={video.thumbnail} 
                                    alt={video.title}
                                    className="w-full h-full object-cover rounded-lg transition-transform duration-300 group-hover:scale-110"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).style.display = 'none';
                                      (e.target as HTMLImageElement).nextElementSibling!.style.display = 'flex';
                                    }}
                                  />
                                ) : null}
                                <div className="text-rainbow-blue text-5xl animate-float" style={{display: video.thumbnail ? 'none' : 'flex'}}>
                                  🎥
                                </div>
                                {/* Hover overlay */}
                                <div className="absolute inset-0 bg-gradient-to-br from-rainbow-pink/70 to-rainbow-purple/70 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center rounded-lg">
                                  <div className="text-center text-white">
                                    <div className="text-4xl animate-heart-beat mb-2">▶️</div>
                                    <span className="text-lg font-fun font-bold animate-bounce-fun">Let's Watch!</span>
                                  </div>
                                </div>
                              </div>
                              <h4 className="font-fun font-bold text-lg mb-3 line-clamp-2 group-hover:text-rainbow-blue transition-colors duration-300 text-white">
                                {video.title}
                              </h4>
                              <p className="text-white/80 text-sm mb-3 flex items-center gap-2 font-semibold">
                                <span className="animate-pulse text-lg">📺</span>
                                <span className="bg-white/20 px-2 py-1 rounded-lg">{video.channel}</span>
                              </p>
                              <p className="text-white/70 text-sm mb-4 line-clamp-2 bg-white/10 p-2 rounded-lg">{video.description}</p>
                              <div className="flex justify-between items-center text-sm mb-4">
                                <span className="text-white/80 flex items-center gap-2 bg-blue-400/30 px-3 py-2 rounded-full border-2 border-blue-300">
                                  <span className="animate-pulse text-lg">⏰</span>
                                  <span className="font-semibold">{video.duration}</span>
                                </span>
                                <span className="text-green-100 bg-green-400/50 px-3 py-2 rounded-full font-bold animate-pulse border-2 border-green-300 flex items-center gap-1">
                                  <span className="text-lg">🛡️</span>
                                  {video.safetyRating}
                                </span>
                              </div>
                              <a
                                href={video.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block w-full mt-3 px-4 py-3 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 rounded-2xl text-center text-lg font-fun font-bold transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-xl hover:shadow-2xl border-4 border-white/30 text-white"
                              >
                                <span className="flex items-center justify-center gap-3">
                                  <span className="text-2xl animate-bounce-fun">▶️</span>
                                  Watch Now!
                                  <span className="text-2xl animate-heart-beat">🎉</span>
                                </span>
                              </a>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 animate-fade-in">
                    <div className="bg-gradient-to-br from-gray-400/30 to-gray-600/30 rounded-3xl p-8 border-4 border-gray-300/50">
                      <div className="text-8xl animate-float mb-6">😔</div>
                      <div className="text-3xl font-fun font-bold text-white mb-4">Oops! No videos found</div>
                      <p className="text-xl text-white/80 font-semibold">Let's try again with a different expression!</p>
                      <div className="flex justify-center gap-4 mt-6">
                        <span className="text-3xl animate-wiggle">🔄</span>
                        <span className="text-3xl animate-bounce-fun">🎭</span>
                        <span className="text-3xl animate-pulse">✨</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Analysis Results with enhanced animations */}
          {analysis && (
            <div className="w-full max-w-6xl space-y-6 animate-fade-in">
              {/* Child Analysis */}
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20 shadow-2xl animate-slide-up">
                <h2 className="text-2xl font-bold mb-4 text-center flex items-center justify-center gap-2">
                  <span className="animate-bounce-gentle">👶</span>
                  Child Analysis
                  <span className="animate-pulse">🔍</span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 p-3 bg-blue-500/20 rounded-lg transition-all duration-300 hover:bg-blue-500/30 animate-fade-in">
                      <span className="text-blue-300 font-semibold flex items-center gap-1">
                        <span className="animate-pulse">🎂</span>
                        Age Estimate:
                      </span>
                      <span className="bg-blue-600/30 px-2 py-1 rounded">{analysis.childAnalysis.ageEstimate}</span>
                    </div>
                    <div className="flex items-center gap-2 p-3 bg-purple-500/20 rounded-lg transition-all duration-300 hover:bg-purple-500/30 animate-fade-in" style={{animationDelay: '100ms'}}>
                      <span className="text-blue-300 font-semibold flex items-center gap-1">
                        <span className="animate-bounce-gentle">😊</span>
                        Primary Emotion:
                      </span>
                      <span className="bg-purple-600/30 px-2 py-1 rounded">{analysis.childAnalysis.primaryEmotion}</span>
                    </div>
                    <div className="flex items-center gap-2 p-3 bg-green-500/20 rounded-lg transition-all duration-300 hover:bg-green-500/30 animate-fade-in" style={{animationDelay: '200ms'}}>
                      <span className="text-blue-300 font-semibold flex items-center gap-1">
                        <span className="animate-pulse">⚡</span>
                        Energy Level:
                      </span>
                      <span className="bg-green-600/30 px-2 py-1 rounded">{analysis.childAnalysis.energyLevel}</span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 p-3 bg-yellow-500/20 rounded-lg transition-all duration-300 hover:bg-yellow-500/30 animate-fade-in" style={{animationDelay: '300ms'}}>
                      <span className="text-blue-300 font-semibold flex items-center gap-1">
                        <span className="animate-float">🌱</span>
                        Developmental Stage:
                      </span>
                      <span className="bg-yellow-600/30 px-2 py-1 rounded">{analysis.childAnalysis.developmentalStage}</span>
                    </div>
                    <div className="flex flex-col gap-1 p-3 bg-pink-500/20 rounded-lg transition-all duration-300 hover:bg-pink-500/30 animate-fade-in" style={{animationDelay: '400ms'}}>
                      <span className="text-blue-300 font-semibold flex items-center gap-1">
                        <span className="animate-wiggle">🎭</span>
                        Mood Indicators:
                      </span>
                      <span className="text-sm text-gray-300 bg-pink-600/30 p-2 rounded">{analysis.childAnalysis.moodIndicators}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Content Strategy */}
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20 shadow-2xl animate-slide-up" style={{animationDelay: '200ms'}}>
                <h2 className="text-2xl font-bold mb-4 text-center flex items-center justify-center gap-2">
                  <span className="animate-bounce-gentle">🎯</span>
                  Content Strategy
                  <span className="animate-pulse">💡</span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex flex-col gap-1 p-3 bg-purple-500/20 rounded-lg transition-all duration-300 hover:bg-purple-500/30 animate-fade-in">
                      <span className="text-purple-300 font-semibold flex items-center gap-1">
                        <span className="animate-pulse">💝</span>
                        Emotional Need:
                      </span>
                      <span className="text-sm text-gray-300 bg-purple-600/30 p-2 rounded">{analysis.contentStrategy.emotionalNeed}</span>
                    </div>
                    <div className="flex flex-col gap-1 p-3 bg-blue-500/20 rounded-lg transition-all duration-300 hover:bg-blue-500/30 animate-fade-in" style={{animationDelay: '100ms'}}>
                      <span className="text-purple-300 font-semibold flex items-center gap-1">
                        <span className="animate-float">📚</span>
                        Learning Opportunity:
                      </span>
                      <span className="text-sm text-gray-300 bg-blue-600/30 p-2 rounded">{analysis.contentStrategy.learningOpportunity}</span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex flex-col gap-1 p-3 bg-green-500/20 rounded-lg transition-all duration-300 hover:bg-green-500/30 animate-fade-in" style={{animationDelay: '200ms'}}>
                      <span className="text-purple-300 font-semibold flex items-center gap-1">
                        <span className="animate-bounce-gentle">⚡</span>
                        Energy Match:
                      </span>
                      <span className="text-sm text-gray-300 bg-green-600/30 p-2 rounded">{analysis.contentStrategy.energyMatch}</span>
                    </div>
                    <div className="flex flex-col gap-1 p-3 bg-orange-500/20 rounded-lg transition-all duration-300 hover:bg-orange-500/30 animate-fade-in" style={{animationDelay: '300ms'}}>
                      <span className="text-purple-300 font-semibold flex items-center gap-1">
                        <span className="animate-pulse">⏰</span>
                        Attention Span:
                      </span>
                      <span className="text-sm text-gray-300 bg-orange-600/30 p-2 rounded">{analysis.contentStrategy.attentionSpan}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Search Queries with enhanced styling */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* YouTube Kids Queries */}
                <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20 shadow-2xl animate-slide-up" style={{animationDelay: '400ms'}}>
                  <h3 className="text-xl font-bold mb-4 text-center flex items-center justify-center gap-2">
                    <span className="animate-bounce-gentle">📺</span>
                    YouTube Kids Queries
                    <span className="animate-pulse">🎈</span>
                  </h3>
                  <div className="space-y-2">
                    {analysis.youtubeKidsQueries.map((query, index) => (
                      <div key={index} className="bg-red-500/20 rounded-lg p-3 transition-all duration-300 hover:bg-red-500/30 hover:scale-105 animate-fade-in border border-red-400/30" style={{animationDelay: `${(index + 1) * 100}ms`}}>
                        <span className="text-red-200 font-mono text-sm flex items-center gap-2">
                          <span className="animate-pulse">🔍</span>
                          "{query}"
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Google Safe Search Queries */}
                <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20 shadow-2xl animate-slide-up" style={{animationDelay: '500ms'}}>
                  <h3 className="text-xl font-bold mb-4 text-center flex items-center justify-center gap-2">
                    <span className="animate-float">🔍</span>
                    Google Safe Search
                    <span className="animate-pulse">🛡️</span>
                  </h3>
                  <div className="space-y-2">
                    {analysis.googleSafeQueries.map((query, index) => (
                      <div key={index} className="bg-green-500/20 rounded-lg p-3 transition-all duration-300 hover:bg-green-500/30 hover:scale-105 animate-fade-in border border-green-400/30" style={{animationDelay: `${(index + 1) * 100}ms`}}>
                        <span className="text-green-200 font-mono text-sm flex items-center gap-2">
                          <span className="animate-pulse">✅</span>
                          "{query}"
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Parental Guidance */}
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20 shadow-2xl animate-slide-up" style={{animationDelay: '600ms'}}>
                <h2 className="text-2xl font-bold mb-4 text-center flex items-center justify-center gap-2">
                  <span className="animate-bounce-gentle">👨‍👩‍👧‍👦</span>
                  Parental Guidance
                  <span className="animate-pulse">📋</span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex flex-col gap-1 p-3 bg-yellow-500/20 rounded-lg transition-all duration-300 hover:bg-yellow-500/30 animate-fade-in">
                      <span className="text-yellow-300 font-semibold flex items-center gap-1">
                        <span className="animate-pulse">⏱️</span>
                        Suggested Duration:
                      </span>
                      <span className="text-sm text-gray-300 bg-yellow-600/30 p-2 rounded">{analysis.parentalGuidance.suggestedDuration}</span>
                    </div>
                    <div className="flex flex-col gap-1 p-3 bg-orange-500/20 rounded-lg transition-all duration-300 hover:bg-orange-500/30 animate-fade-in" style={{animationDelay: '100ms'}}>
                      <span className="text-yellow-300 font-semibold flex items-center gap-1">
                        <span className="animate-bounce-gentle">👀</span>
                        Supervision Level:
                      </span>
                      <span className="text-sm text-gray-300 bg-orange-600/30 p-2 rounded">{analysis.parentalGuidance.supervisionLevel}</span>
                    </div>
                    <div className="flex flex-col gap-1 p-3 bg-pink-500/20 rounded-lg transition-all duration-300 hover:bg-pink-500/30 animate-fade-in" style={{animationDelay: '200ms'}}>
                      <span className="text-yellow-300 font-semibold flex items-center gap-1">
                        <span className="animate-float">👥</span>
                        Co-viewing Opportunities:
                      </span>
                      <span className="text-sm text-gray-300 bg-pink-600/30 p-2 rounded">{analysis.parentalGuidance.coViewingOpportunities}</span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex flex-col gap-1 p-3 bg-blue-500/20 rounded-lg transition-all duration-300 hover:bg-blue-500/30 animate-fade-in" style={{animationDelay: '300ms'}}>
                      <span className="text-yellow-300 font-semibold flex items-center gap-1">
                        <span className="animate-wiggle">💬</span>
                        Discussion Points:
                      </span>
                      <span className="text-sm text-gray-300 bg-blue-600/30 p-2 rounded">{analysis.parentalGuidance.discussionPoints}</span>
                    </div>
                    <div className="flex flex-col gap-1 p-3 bg-purple-500/20 rounded-lg transition-all duration-300 hover:bg-purple-500/30 animate-fade-in" style={{animationDelay: '400ms'}}>
                      <span className="text-yellow-300 font-semibold flex items-center gap-1">
                        <span className="animate-pulse">🎯</span>
                        Follow-up Activities:
                      </span>
                      <span className="text-sm text-gray-300 bg-purple-600/30 p-2 rounded">{analysis.parentalGuidance.followUpActivities}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Developmental Benefits */}
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20 shadow-2xl animate-slide-up" style={{animationDelay: '700ms'}}>
                <h2 className="text-2xl font-bold mb-4 text-center flex items-center justify-center gap-2">
                  <span className="animate-float">🧠</span>
                  Developmental Benefits
                  <span className="animate-pulse">🌟</span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex flex-col gap-1 p-3 bg-green-500/20 rounded-lg transition-all duration-300 hover:bg-green-500/30 animate-fade-in">
                      <span className="text-green-300 font-semibold flex items-center gap-1">
                        <span className="animate-bounce-gentle">💝</span>
                        Emotional Development:
                      </span>
                      <span className="text-sm text-gray-300 bg-green-600/30 p-2 rounded">{analysis.developmentalBenefits.emotionalDevelopment}</span>
                    </div>
                    <div className="flex flex-col gap-1 p-3 bg-blue-500/20 rounded-lg transition-all duration-300 hover:bg-blue-500/30 animate-fade-in" style={{animationDelay: '100ms'}}>
                      <span className="text-green-300 font-semibold flex items-center gap-1">
                        <span className="animate-pulse">🧩</span>
                        Cognitive Skills:
                      </span>
                      <span className="text-sm text-gray-300 bg-blue-600/30 p-2 rounded">{analysis.developmentalBenefits.cognitiveSkills}</span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex flex-col gap-1 p-3 bg-purple-500/20 rounded-lg transition-all duration-300 hover:bg-purple-500/30 animate-fade-in" style={{animationDelay: '200ms'}}>
                      <span className="text-green-300 font-semibold flex items-center gap-1">
                        <span className="animate-wiggle">👫</span>
                        Social Skills:
                      </span>
                      <span className="text-sm text-gray-300 bg-purple-600/30 p-2 rounded">{analysis.developmentalBenefits.socialSkills}</span>
                    </div>
                    <div className="flex flex-col gap-1 p-3 bg-pink-500/20 rounded-lg transition-all duration-300 hover:bg-pink-500/30 animate-fade-in" style={{animationDelay: '300ms'}}>
                      <span className="text-green-300 font-semibold flex items-center gap-1">
                        <span className="animate-float">🎨</span>
                        Creative Expression:
                      </span>
                      <span className="text-sm text-gray-300 bg-pink-600/30 p-2 rounded">{analysis.developmentalBenefits.creativeExpression}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Safety Assurance */}
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20 shadow-2xl animate-slide-up" style={{animationDelay: '800ms'}}>
                <h2 className="text-2xl font-bold mb-4 text-center flex items-center justify-center gap-2">
                  <span className="animate-bounce-gentle">🛡️</span>
                  Safety Assurance
                  <span className="animate-pulse">🔒</span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {analysis.safetyAssurance.map((item, index) => (
                    <div key={index} className="flex items-center gap-2 p-3 bg-green-500/20 rounded-lg transition-all duration-300 hover:bg-green-500/30 animate-fade-in border border-green-400/30" style={{animationDelay: `${index * 50}ms`}}>
                      <span className="text-green-400 animate-pulse">✓</span>
                      <span className="text-sm text-gray-300">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Instructions with playful child-friendly design */}
          <div className="bg-gradient-to-br from-white/20 to-purple/20 backdrop-blur-md rounded-3xl p-8 max-w-4xl border-4 border-white/30 shadow-2xl animate-slide-up">
            <h3 className="text-3xl font-fun font-bold mb-6 flex items-center justify-center gap-4 text-white">
              <span className="animate-bounce-fun text-4xl">📱</span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-rainbow-pink to-rainbow-blue">
                How to Play with KidsEmotion!
              </span>
              <span className="animate-heart-beat text-4xl">✨</span>
            </h3>
            <ol className="list-none space-y-4 text-white">
              <li className="transition-all duration-300 hover:text-yellow-300 hover:bg-white/20 p-4 rounded-2xl animate-fade-in flex items-center gap-4 border-2 border-white/20 hover:border-yellow-300/50" style={{animationDelay: '100ms'}}>
                <span className="text-4xl animate-pulse bg-green-400/30 p-3 rounded-full border-4 border-green-300">📹</span>
                <div className="flex-1">
                  <span className="text-xl font-fun font-bold">Step 1:</span>
                  <p className="text-lg font-semibold">Click "Start Camera Fun!" to begin your adventure</p>
                </div>
              </li>
              <li className="transition-all duration-300 hover:text-yellow-300 hover:bg-white/20 p-4 rounded-2xl animate-fade-in flex items-center gap-4 border-2 border-white/20 hover:border-yellow-300/50" style={{animationDelay: '200ms'}}>
                <span className="text-4xl animate-jiggle bg-blue-400/30 p-3 rounded-full border-4 border-blue-300">🔐</span>
                <div className="flex-1">
                  <span className="text-xl font-fun font-bold">Step 2:</span>
                  <p className="text-lg font-semibold">Say "Yes!" when asked for camera permission</p>
                </div>
              </li>
              <li className="transition-all duration-300 hover:text-yellow-300 hover:bg-white/20 p-4 rounded-2xl animate-fade-in flex items-center gap-4 border-2 border-white/20 hover:border-yellow-300/50" style={{animationDelay: '300ms'}}>
                <span className="text-4xl animate-wiggle bg-pink-400/30 p-3 rounded-full border-4 border-pink-300">👶</span>
                <div className="flex-1">
                  <span className="text-xl font-fun font-bold">Step 3:</span>
                  <p className="text-lg font-semibold">Show your beautiful face to the camera!</p>
                </div>
              </li>
              <li className="transition-all duration-300 hover:text-yellow-300 hover:bg-white/20 p-4 rounded-2xl animate-fade-in flex items-center gap-4 border-2 border-white/20 hover:border-yellow-300/50" style={{animationDelay: '400ms'}}>
                <span className="text-4xl animate-heart-beat bg-purple-400/30 p-3 rounded-full border-4 border-purple-300">📸</span>
                <div className="flex-1">
                  <span className="text-xl font-fun font-bold">Step 4:</span>
                  <p className="text-lg font-semibold">Click "Let's Analyze Your Expression!" for magic!</p>
                </div>
              </li>
              <li className="transition-all duration-300 hover:text-yellow-300 hover:bg-white/20 p-4 rounded-2xl animate-fade-in flex items-center gap-4 border-2 border-white/20 hover:border-yellow-300/50" style={{animationDelay: '500ms'}}>
                <span className="text-4xl animate-float bg-yellow-400/30 p-3 rounded-full border-4 border-yellow-300">📊</span>
                <div className="flex-1">
                  <span className="text-xl font-fun font-bold">Step 5:</span>
                  <p className="text-lg font-semibold">See cool analysis about how you're feeling!</p>
                </div>
              </li>
              <li className="transition-all duration-300 hover:text-yellow-300 hover:bg-white/20 p-4 rounded-2xl animate-fade-in flex items-center gap-4 border-2 border-white/20 hover:border-yellow-300/50" style={{animationDelay: '600ms'}}>
                <span className="text-4xl animate-bounce-fun bg-red-400/30 p-3 rounded-full border-4 border-red-300">🎥</span>
                <div className="flex-1">
                  <span className="text-xl font-fun font-bold">Step 6:</span>
                  <p className="text-lg font-semibold">Watch amazing videos picked just for you!</p>
                </div>
              </li>
              <li className="transition-all duration-300 hover:text-yellow-300 hover:bg-white/20 p-4 rounded-2xl animate-fade-in flex items-center gap-4 border-2 border-white/20 hover:border-yellow-300/50" style={{animationDelay: '700ms'}}>
                <span className="text-4xl animate-spin-slow bg-orange-400/30 p-3 rounded-full border-4 border-orange-300">📚</span>
                <div className="flex-1">
                  <span className="text-xl font-fun font-bold">Step 7:</span>
                  <p className="text-lg font-semibold">Explore fun videos by different topics!</p>
                </div>
              </li>
              <li className="transition-all duration-300 hover:text-yellow-300 hover:bg-white/20 p-4 rounded-2xl animate-fade-in flex items-center gap-4 border-2 border-white/20 hover:border-yellow-300/50" style={{animationDelay: '800ms'}}>
                <span className="text-4xl animate-jiggle bg-teal-400/30 p-3 rounded-full border-4 border-teal-300">👨‍👩‍👧‍👦</span>
                <div className="flex-1">
                  <span className="text-xl font-fun font-bold">Step 8:</span>
                  <p className="text-lg font-semibold">Watch videos with your family for extra fun!</p>
                </div>
              </li>
            </ol>
            <div className="mt-8 p-6 bg-gradient-to-r from-yellow-400/30 to-orange-400/30 rounded-2xl animate-fade-in border-4 border-yellow-300/50 shadow-xl" style={{animationDelay: '900ms'}}>
              <p className="text-yellow-100 text-xl flex items-center gap-4 font-fun font-bold text-center">
                <span className="text-4xl animate-wiggle">⚠️</span>
                <span className="flex-1">
                  <strong className="text-2xl">Super Important!</strong><br/>
                  This is a safe place for kids! Always watch videos with a grown-up for the most fun!
                </span>
                <span className="text-4xl animate-heart-beat">💝</span>
              </p>
              <div className="flex justify-center gap-4 mt-4">
                <span className="text-3xl animate-bounce-fun">🛡️</span>
                <span className="text-3xl animate-float">👨‍👩‍👧‍👦</span>
                <span className="text-3xl animate-wiggle">❤️</span>
                <span className="text-3xl animate-pulse">🌟</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden canvas for frame capture */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
