import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";

// =======================
//       Main Action
// =======================
export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return json({ error: "Method not allowed" }, { status: 405 });
	}
	console.log("[Action] Search API called");

	try {
		const { searchQueries, childAnalysis, ImageData } = await request.json();
		if (!searchQueries || !Array.isArray(searchQueries)) {
			console.warn("[Action] No search queries provided");
			return json({ error: "No search queries provided" }, { status: 400 });
		}

		const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
		if (!YOUTUBE_API_KEY) {
			console.error("[Action] YouTube API key not initialized");
			return json({ error: "YouTube API key not configured" }, { status: 500 });
		}

		// --- Step 1: AI-ranked query ---
		const bestQuery = getAIRankedQuery(childAnalysis, searchQueries, ImageData);
		console.log("[Action] AI-selected best query:", bestQuery);

		let videos: any[] = [];
		try {
			videos = await YouTubeService.fetchVideos(bestQuery, YOUTUBE_API_KEY);
			console.log(
				`[Action] Videos fetched for query "${bestQuery}": ${videos.length}`
			);
		} catch (err) {
			console.error("[Action] YouTube fetch failed:", err);
		}

		// --- Step 2: Dynamic fallback ---
		if (videos.length === 0) {
			console.warn("[Action] No videos found, using dynamic fallback");
			videos = await Fallbacks.dynamic(YOUTUBE_API_KEY);
		}

		// --- Step 3: Deduplicate, filter, sort ---
		videos = Utils.deduplicate(videos)
			.filter((v) => v.ageAppropriate && v.educational)
			.sort((a, b) =>
				a.safetyRating === "Child-Safe" && b.safetyRating !== "Child-Safe"
					? -1
					: 1
			);

		return json({
			success: true,
			videos: videos.slice(0, 15),
			totalFound: videos.length,
			selectedQuery: bestQuery,
			queryRanking: childAnalysis?.queryRanking || null,
			searchQueries: [bestQuery],
			note: childAnalysis?.queryRanking
				? `AI selected: "${bestQuery}" (Score: ${
						childAnalysis.queryRanking.rankedQueries?.[0]?.score || "N/A"
				  }) - ${childAnalysis.queryRanking.reason}`
				: `Results focused on: "${bestQuery}"`,
		});
	} catch (err) {
		console.error("[Action] Video search error:", err);
		const fallbackVideos = Fallbacks.static();
		return json({
			success: true,
			videos: fallbackVideos,
			totalFound: fallbackVideos.length,
			selectedQuery: "educational content for kids",
			queryRanking: null,
			searchQueries: [],
			note: "Showing curated recommendations - YouTube API temporarily unavailable",
		});
	}
}

// =======================
//     YouTube Service
// =======================
const YouTubeService = {
	async fetchVideos(query: string, apiKey: string): Promise<any[]> {
        console.log("[youtube service] fech vedios called");
        
		try {
			const url = new URL("https://www.googleapis.com/youtube/v3/search");
			url.searchParams.append("part", "snippet");
			url.searchParams.append("q", query);
			url.searchParams.append("type", "video");
			url.searchParams.append("maxResults", "10");
			url.searchParams.append("key", apiKey);
			// url.searchParams.append("videoEmbeddable", "true");
			// url.searchParams.append("safeSearch", "strict");
			// url.searchParams.append("videoDuration", "short");
			// url.searchParams.append("order", "relevance");
			// url.searchParams.append("regionCode", "US");

			console.log("[YouTube] Fetching query:", query);
			console.log("[YouTube] URL:", url.toString());
			console.log("[YouTube] API key:", apiKey ? "set" : "missing");

			console.log("[YouTubeService] Fetch URL:", url.toString());

			const res = await fetch(url.toString(), {
				headers: {
					"User-Agent": "Mozilla/5.0 (Node.js) EmmoticamApp",
					Accept: "application/json",
				},
			});

			if (!res.ok) throw new Error(`YouTube API error: ${res.statusText}`);
			const data = await res.json();
			return this.processResults(data.items, query);
		} catch (err) {
			console.error("[YouTubeService] Fetch error:", err);
			throw err;
		}
	},

	async processResults(items: any[], query: string): Promise<any[]> {
		const videos: any[] = [];
		for (const item of items) {
			try {
				const snippet = item.snippet;
				const videoId = item.id.videoId;
				if (!Filters.isSafe(snippet) || !Filters.isEducational(snippet))
					continue;

				videos.push({
					title: Utils.clean(snippet.title),
					channel: Utils.clean(snippet.channelTitle),
					description:
						Utils.clean(snippet.description) ||
						`Educational content about ${query}`,
					duration: "Short video",
					url: `https://www.youtube.com/watch?v=${videoId}`,
					thumbnail:
						snippet.thumbnails?.high?.url ||
						Utils.generateThumbnail(snippet.title),
					videoId,
					ageAppropriate: true,
					educational: true,
					safetyRating: "Child-Safe",
					category: Utils.categorize(query),
					searchQuery: query,
				});
			} catch (err) {
				console.error("[YouTubeService] Processing item error:", err);
			}
		}
		return videos;
	},
};

// =======================
//         Filters
// =======================
const Filters = {
	isSafe(snippet: any) {
		const text =
			`${snippet.title} ${snippet.description} ${snippet.channelTitle}`.toLowerCase();
		const unsafeKeywords = [
			"scary",
			"horror",
			"violence",
			"blood",
			"death",
			"kill",
			"weapon",
			"gun",
			"knife",
			"adult",
			"mature",
			"inappropriate",
			"explicit",
			"crude",
			"vulgar",
			"offensive",
			"monster",
			"nightmare",
			"creepy",
			"dark",
			"evil",
			"demon",
			"ghost",
			"zombie",
		];
		const safe = !unsafeKeywords.some((k) => text.includes(k));
		if (!safe) console.log("[Filters] Unsafe content detected:", snippet.title);
		return safe;
	},

	isEducational(snippet: any) {
		const text =
			`${snippet.title} ${snippet.description} ${snippet.channelTitle}`.toLowerCase();
		const keywords = [
			"learn",
			"education",
			"teach",
			"school",
			"abc",
			"number",
			"count",
			"color",
			"shape",
			"song",
			"nursery",
			"kids",
		];
		const trustedChannels = [
			"super simple songs",
			"sesame street",
			"pbs kids",
			"educational",
			"learn",
		];
		const isEdu =
			keywords.some((k) => text.includes(k)) ||
			trustedChannels.some((c) => text.includes(c));
		if (!isEdu)
			console.log("[Filters] Non-educational content:", snippet.title);
		return isEdu;
	},
};

// =======================
//    AI Query Selector
// =======================
function getAIRankedQuery(
	childAnalysis: any,
	searchQueries: string[],
	ImageData: any
): string {
	console.log("[AIQuerySelector] Selecting query");
	return searchQueries?.[0] || Fallbacks.randomQuery();
}

// =======================
//        Fallbacks
// =======================
const Fallbacks = {
	randomQuery(): string {
		const fallbackKeywords = [
			"Alphabet Song",
			"Numbers Counting",
			"Colors Learning",
			"Shapes for Kids",
		];
		const idx = Math.floor(Math.random() * fallbackKeywords.length);
		return fallbackKeywords[idx];
	},

	async dynamic(apiKey: string): Promise<any[]> {
		const query = Fallbacks.randomQuery();
		console.log("[Fallbacks] Dynamic fallback query:", query);
		try {
			const videos = await YouTubeService.fetchVideos(query, apiKey);
			if (videos.length === 0) return Fallbacks.static();
			return Utils.deduplicate(videos);
		} catch {
			return Fallbacks.static();
		}
	},

	static(): any[] {
		const videos = [
			{
				title: "ABC Song",
				channel: "Super Simple Songs",
				description: "Learn ABC",
				duration: "3:15",
				category: "Educational",
				videoId: "abc123",
				url: "https://youtube.com/watch?v=abc123",
			},
			{
				title: "Counting 1-20",
				channel: "Sesame Street",
				description: "Counting video",
				duration: "5:20",
				category: "Educational",
				videoId: "count456",
				url: "https://youtube.com/watch?v=count456",
			},
		];
		return videos.map((v) => ({
			...v,
			ageAppropriate: true,
			educational: true,
			safetyRating: "Child-Safe",
			thumbnail: Utils.generateThumbnail(v.title),
		}));
	},
};

// =======================
//        Utilities
// =======================
const Utils = {
	clean(text: string | null) {
		if (!text) return "";
		return text
			.replace(/\*\*/g, "")
			.replace(/\n/g, " ")
			.replace(/\s+/g, " ")
			.trim();
	},
	deduplicate(videos: any[]) {
		const seen = new Set();
		return videos.filter((v) => (seen.has(v.url) ? false : seen.add(v.url)));
	},
	categorize(query: string) {
		const lower = query.toLowerCase();
		if (/song|music|dance/.test(lower)) return "Music & Movement";
		if (/craft|art|creative/.test(lower)) return "Arts & Crafts";
		if (/learn|educational|abc|number/.test(lower)) return "Educational";
		if (/story|tale|book/.test(lower)) return "Stories & Books";
		if (/science|experiment/.test(lower)) return "Science & Discovery";
		return "General Learning";
	},
	generateThumbnail(title: string) {
		const videoId =
			title
				.toLowerCase()
				.replace(/[^a-z0-9]/g, "")
				.substring(0, 8) + Math.random().toString(36).substring(2, 5);
		return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
	},
};
