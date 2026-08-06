import os
import re
import uuid
import json
import logging
import hashlib
import urllib.parse
import requests
from typing import Optional, List, Set, Dict
from openai import OpenAI

logger = logging.getLogger("image_retriever")

# Initialize OpenAI client lazily or safely
openai_client = None
def get_openai_client():
    global openai_client
    if openai_client is None:
        api_key = os.getenv("OPENAI_API_KEY")
        if api_key:
            try:
                openai_client = OpenAI(api_key=api_key)
            except Exception as e:
                logger.warning(f"Could not initialize OpenAI client in image_retriever: {e}")
    return openai_client

# Global in-memory cache for session-based image deduplication: { session_id: set_of_used_urls }
USED_IMAGES_CACHE: Dict[str, Set[str]] = {}

# Preferred educational and trusted stock domains for higher ranking score
PREFEERED_DOMAINS = [
    "pixabay.com", "wikimedia.org", "wikipedia.org", "edu", "gov", "org", "geeksforgeeks.org",
    "docs.python.org", "developer.mozilla.org", "w3schools.com", "baeldung.com",
    "towardsdatascience.com", "medium.com", "github.io", "github.com",
    "tutorialspoint.com", "javatpoint.com", "stackabuse.com", "scikit-learn.org",
    "tensorflow.org", "pytorch.org", "realpython.com", "seaborn.pydata.org", "matplotlib.org"
]

# Subject disambiguation rules
DISAMBIGUATION_MAP = {
    "python": {
        "anchor": "Python",
        "reject_words": ["snake", "reptile", "animal", "zoo", "constrictor", "pythonidae", "terrarium"]
    },
    "seaborn": {
        "anchor": "Seaborn Python",
        "reject_words": ["snake", "animal"]
    },
    "pandas": {
        "anchor": "Pandas Python",
        "reject_words": ["bear", "bamboo", "zoo", "animal"]
    },
    "java": {
        "anchor": "Java code",
        "reject_words": ["coffee", "bean", "espresso", "cup", "island", "indonesia"]
    },
    "neural network": {
        "anchor": "neural network AI",
        "reject_words": ["human", "biology", "brain", "neuron", "medical", "anatomy", "tissue", "biological"]
    },
    "deep learning": {
        "anchor": "deep learning AI",
        "reject_words": ["human", "biology", "brain", "ocean", "underwater", "sea"]
    },
    "bug": {
        "anchor": "software bug code",
        "reject_words": ["insect", "beetle", "fly", "pest", "animal", "caterpillar"]
    },
    "apple": {
        "anchor": "Apple iOS tech",
        "reject_words": ["fruit", "tree", "food", "eating", "recipe", "juice", "orchard"]
    },
    "ruby": {
        "anchor": "Ruby Rails code",
        "reject_words": ["gem", "stone", "jewel", "ring", "diamond", "jewelry"]
    },
    "swift": {
        "anchor": "Swift iOS code",
        "reject_words": ["bird", "taylor", "singer", "concert"]
    },
    "rust": {
        "anchor": "Rust programming code",
        "reject_words": ["iron", "metal", "corrosion", "decay", "rusting"]
    },
    "go": {
        "anchor": "Golang code",
        "reject_words": ["boardgame", "movie"]
    }
}

UNSAFE_KEYWORDS = [
    "porn", "sex", "naked", "nudity", "gore", "blood", "violence", "terror",
    "hate", "racist", "weapon", "gun", "knife", "drug", "casino", "gambling",
    "shutterstock", "gettyimages", "dreamstime", "depositphotos",
    "stock-photo", "meme"
]

def sanitize_search_query(query: str, subject: str = "") -> str:
    """
    Fallback heuristic cleaner: Cleans and restricts search query to 3-5 concise words.
    """
    clean = re.sub(r'(?i)\b(examples|illustration|visualization|overview|showing|diagram of|picture of|image of|concept of|a|an|the|and|or|for|in|with|using)\b', ' ', query)
    clean = re.sub(r'[^\w\s]', ' ', clean)
    words = [w.strip() for w in clean.split() if len(w.strip()) > 1]
    
    short_query = " ".join(words[:4])
    
    combined_context = (query + " " + subject).lower()
    anchor = ""
    for key, rule in DISAMBIGUATION_MAP.items():
        if key in combined_context:
            anchor = rule["anchor"]
            break

    if "diagram" not in short_query.lower() and "plot" not in short_query.lower() and "chart" not in short_query.lower():
        short_query += " diagram"

    if anchor and anchor.lower() not in short_query.lower():
        final_q = f"{short_query} {anchor}"
    else:
        final_q = short_query

    return re.sub(r'\s+', ' ', final_q).strip()

def ai_optimize_search_query(search_query: str, subject: str = "", draft_id: str = "") -> List[str]:
    """
    Option 1 - Step 1: Uses gpt-4o-mini to convert raw search_query into 2-3 hyper-focused
    educational diagram search terms for web search engines.
    """
    client = get_openai_client()
    if not client:
        return [sanitize_search_query(search_query, subject)]

    try:
        sys_msg = (
            "You are an expert educational research assistant specializing in web image retrieval.\n"
            "Given a raw lesson topic/query and course subject, output a JSON array of 2 to 3 concise, "
            "hyper-specific web image search terms tailored to find real-world documentation, "
            "plots, flowcharts, or educational diagrams.\n"
            "Rules:\n"
            "1. Each query must be 3 to 5 words max.\n"
            "2. Focus on terms like 'diagram', 'plot', 'architecture', 'chart', or official docs (e.g. 'seaborn pydata plot').\n"
            "3. Format: {\"queries\": [\"query1\", \"query2\"]}"
        )
        user_msg = f"Subject: {subject}\nRaw Query: {search_query}"
        
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": sys_msg},
                {"role": "user", "content": user_msg}
            ],
            temperature=0.3,
            max_tokens=100
        )

        if draft_id and draft_id != "default":
            try:
                from metering_helper import track_chatbot_cost
                track_chatbot_cost(draft_id, response, "gpt-4o-mini", "image_query_optimization")
            except Exception as ex:
                logger.error(f"Failed to track image query optimization cost: {ex}")
        
        content = response.choices[0].message.content.strip()
        parsed = json.loads(content)
        queries = parsed.get("queries", [])
        if queries and isinstance(queries, list):
            logger.info(f"[AI Query Optimizer] Generated AI queries: {queries}")
            return [q.strip() for q in queries if q and isinstance(q, str)]
    except Exception as e:
        logger.warning(f"[AI Query Optimizer] Fallback to heuristic query due to: {e}")
        
    return [sanitize_search_query(search_query, subject)]

def is_safe_and_relevant(image_item: dict, subject: str = "", language: str = "English") -> bool:
    """
    Validates image metadata for safety, homonym rejection, educational relevance, and language consistency.
    """
    title = (image_item.get("title") or "").lower()
    url = (image_item.get("image") or image_item.get("url") or "").lower()
    source = (image_item.get("source") or "").lower()
    
    text_to_check = f"{title} {url} {source}"
    
    for kw in UNSAFE_KEYWORDS:
        if kw in text_to_check:
            logger.info(f"Filtered out image due to unsafe keyword '{kw}': {url}")
            return False

    combined_subject = (title + " " + subject).lower()
    for key, rule in DISAMBIGUATION_MAP.items():
        if key in combined_subject or key in url:
            for reject_word in rule.get("reject_words", []):
                if reject_word in text_to_check:
                    logger.info(f"Filtered out homonym image matching '{reject_word}': {url} ({title})")
                    return False
            
    if language.lower() == "english":
        non_latin = re.findall(r'[\u4e00-\u9fff\u0400-\u04ff\u0600-\u06ff\u3040-\u30ff]', title)
        if len(non_latin) > 2:
            logger.info(f"Filtered out image due to non-English text in title: '{title}'")
            return False

    return True

def rank_candidate_images(candidates: List[dict]) -> List[dict]:
    """
    Ranks candidate images pooled across search providers based on domain trust, visual type, and quality.
    """
    def score_image(item):
        score = 0
        url = (item.get("image") or item.get("url") or "").lower()
        title = (item.get("title") or "").lower()
        source = (item.get("source") or "").lower()
        
        for pref in PREFEERED_DOMAINS:
            if pref in url or pref in source:
                score += 35
                break
                
        if any(term in title for term in ["diagram", "architecture", "flowchart", "infographic", "structure", "overview", "plot", "chart"]):
            score += 15
            
        if ".png" in url or ".svg" in url:
            score += 10
            
        return score

    return sorted(candidates, key=score_image, reverse=True)

def ai_inspect_and_select_candidate(candidates: List[dict], subject: str = "", search_query: str = "", draft_id: str = "") -> Optional[dict]:
    """
    Option 1 - Step 2: Uses gpt-4o-mini to inspect candidate titles/URLs and select the #1
    most educationally accurate candidate, rejecting homonyms or stock photos.
    """
    if not candidates:
        return None
        
    client = get_openai_client()
    if not client or len(candidates) == 1:
        ranked = rank_candidate_images(candidates)
        return ranked[0] if ranked else None

    try:
        candidate_summary = []
        for idx, item in enumerate(candidates[:6]):
            title = item.get("title", "")
            url = item.get("image") or item.get("url") or ""
            src = item.get("source", "")
            candidate_summary.append(f"[{idx}] Title: '{title}' | Source: {src} | URL: {url}")
            
        summary_str = "\n".join(candidate_summary)
        
        sys_msg = (
            "You are an AI Image Inspection Judge for educational courses.\n"
            "Review the list of candidate web images below for a given lesson topic and subject.\n"
            "Select the single candidate index (0-based) that represents the most accurate, high-quality, "
            "educational diagram, flowchart, code plot, or authentic concept picture.\n"
            "STRICT RULES:\n"
            "1. Reject homonyms (e.g. reject real snakes for Python code, reject biological human brain for AI neural net, reject real animals for Pandas dataframe).\n"
            "2. Prefer official documentation, Wikipedia, or educational domains.\n"
            "3. Format JSON response: {\"selected_index\": 0, \"reason\": \"...\"}"
        )
        user_msg = f"Subject: {subject}\nLesson Topic: {search_query}\n\nCandidates:\n{summary_str}"
        
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": sys_msg},
                {"role": "user", "content": user_msg}
            ],
            temperature=0.2,
            max_tokens=100
        )

        if draft_id and draft_id != "default":
            try:
                from metering_helper import track_chatbot_cost
                track_chatbot_cost(draft_id, response, "gpt-4o-mini", "image_candidate_inspection")
            except Exception as ex:
                logger.error(f"Failed to track image candidate inspection cost: {ex}")
        
        content = response.choices[0].message.content.strip()
        parsed = json.loads(content)
        selected_idx = parsed.get("selected_index")
        
        if selected_idx is not None and isinstance(selected_idx, int) and 0 <= selected_idx < len(candidates[:6]):
            selected_item = candidates[selected_idx]
            logger.info(f"[AI Candidate Inspector] Selected candidate #{selected_idx} ('{selected_item.get('title')}'). Reason: {parsed.get('reason')}")
            return selected_item
    except Exception as e:
        logger.warning(f"[AI Candidate Inspector] Fallback to heuristic ranking due to: {e}")
        
    ranked = rank_candidate_images(candidates)
    return ranked[0] if ranked else None

def search_wikipedia_images(query: str, max_results: int = 6) -> List[dict]:
    """
    Provider 1: Wikipedia PageImages API
    """
    try:
        headers = {'User-Agent': 'AICourseBuilder/1.0 (educational)'}
        url = "https://en.wikipedia.org/w/api.php"
        params = {
            "action": "query",
            "generator": "search",
            "gsrsearch": query,
            "prop": "pageimages",
            "piprop": "original|thumbnail",
            "format": "json"
        }
        res = requests.get(url, params=params, headers=headers, timeout=5).json()
        pages = res.get("query", {}).get("pages", {})
        results = []
        for p in pages.values():
            orig = p.get("original", {})
            img_url = orig.get("source")
            if img_url:
                results.append({
                    "title": p.get("title", ""),
                    "image": img_url,
                    "source": "wikipedia.org"
                })
        return results[:max_results]
    except Exception as e:
        logger.warning(f"Wikipedia image search failed for '{query}': {e}")
        return []

def search_wikimedia_commons_images(query: str, max_results: int = 6) -> List[dict]:
    """
    Provider 2: Wikimedia Commons MediaWiki API
    """
    try:
        headers = {'User-Agent': 'AICourseBuilder/1.0 (educational)'}
        url = "https://commons.wikimedia.org/w/api.php"
        params = {
            "action": "query",
            "generator": "search",
            "gsearch": f"{query} filetype:bitmap|drawing",
            "gsrnamespace": 6,
            "prop": "imageinfo",
            "iiprop": "url|mime|size",
            "format": "json"
        }
        res = requests.get(url, params=params, headers=headers, timeout=5).json()
        pages = res.get("query", {}).get("pages", {})
        results = []
        for page in pages.values():
            ii = page.get("imageinfo", [{}])[0]
            img_url = ii.get("url")
            if img_url:
                results.append({
                    "title": page.get("title", ""),
                    "image": img_url,
                    "source": "wikimedia.org"
                })
        return results[:max_results]
    except Exception as e:
        logger.warning(f"Wikimedia Commons search failed for '{query}': {e}")
        return []

def search_duckduckgo_images(query: str, max_results: int = 6) -> List[dict]:
    """
    Provider 3: DuckDuckGo (ddgs) Search
    """
    try:
        try:
            from ddgs import DDGS
        except ImportError:
            from duckduckgo_search import DDGS

        with DDGS() as ddgs:
            try:
                results = list(ddgs.images(
                    query=query,
                    region="wt-wt",
                    safesearch="on",
                    max_results=max_results
                ))
            except TypeError:
                results = list(ddgs.images(
                    keywords=query,
                    region="wt-wt",
                    safesearch="on",
                    max_results=max_results
                ))
            return results
    except Exception as e:
        logger.warning(f"DuckDuckGo image search fallback skipped for '{query}': {e}")
        return []

def search_pixabay_images(query: str, max_results: int = 6) -> List[dict]:
    """
    Provider 4: Pixabay API
    """
    api_key = os.getenv("PIXABAY_API_KEY")
    if not api_key:
        return []
    try:
        encoded_q = urllib.parse.quote(query)
        url = f"https://pixabay.com/api/?key={api_key}&q={encoded_q}&image_type=all&safesearch=true&per_page={max_results}"
        res = requests.get(url, timeout=5).json()
        hits = res.get("hits", [])
        results = []
        for h in hits:
            img_url = h.get("largeImageURL") or h.get("webformatURL")
            if img_url:
                results.append({
                    "title": h.get("tags", ""),
                    "image": img_url,
                    "source": "pixabay.com"
                })
        return results
    except Exception as e:
        logger.warning(f"Pixabay image search failed for '{query}': {e}")
        return []

def download_and_save_image(image_url: str) -> Optional[str]:
    """
    Downloads candidate image to backend /uploads/course_images/ directory
    and returns relative local URL path.
    """
    try:
        clean_url = image_url.split("?")[0] if "wikimedia.org" in image_url else image_url
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
        }
        resp = requests.get(clean_url, headers=headers, timeout=8, stream=True)
        if resp.status_code != 200:
            logger.warning(f"Failed to download image from {clean_url}: Status {resp.status_code}")
            return None
            
        content_type = resp.headers.get("Content-Type", "").lower()
        if not ("image" in content_type or "octet-stream" in content_type):
            logger.warning(f"Invalid Content-Type '{content_type}' for image {clean_url}")
            return None
            
        ext = ".png"
        if "jpeg" in content_type or "jpg" in content_type:
            ext = ".jpg"
        elif "webp" in content_type:
            ext = ".webp"
        elif "svg" in content_type:
            ext = ".svg"
        elif "gif" in content_type:
            ext = ".gif"
        else:
            for e in [".png", ".jpg", ".jpeg", ".webp", ".svg", ".gif"]:
                if clean_url.lower().endswith(e):
                    ext = e
                    break

        filename = f"edu_img_{uuid.uuid4().hex[:10]}{ext}"
        upload_dir = os.path.join("uploads", "course_images")
        os.makedirs(upload_dir, exist_ok=True)
        
        file_path = os.path.join(upload_dir, filename)
        with open(file_path, "wb") as f:
            for chunk in resp.iter_content(chunk_size=8192):
                f.write(chunk)
                
        local_url = f"/uploads/course_images/{filename}"
        logger.info(f"Successfully saved retrieved image to {local_url}")
        return local_url
    except Exception as e:
        logger.error(f"Error downloading image from {image_url}: {e}")
        return None

def retrieve_and_store_educational_image(
    search_query: str,
    subject: str = "",
    language: str = "English",
    session_id: str = "default"
) -> Optional[str]:
    """
    Main entry point with Option 1 AI Enhancement:
    1. Uses gpt-4o-mini to generate 2-3 precise search terms.
    2. Pools candidates across 4 engines (Wikipedia, Wikimedia Commons, DuckDuckGo, Pixabay).
    3. Uses gpt-4o-mini AI Candidate Inspector to pick the #1 most accurate educational image.
    4. Downloads selected image to /uploads/course_images/ and tracks deduplication.
    """
    if not search_query:
        return None

    if session_id not in USED_IMAGES_CACHE:
        USED_IMAGES_CACHE[session_id] = set()
    used_set = USED_IMAGES_CACHE[session_id]

    # Step 1: AI-Optimized Search Queries (with heuristic fallback)
    optimized_queries = ai_optimize_search_query(search_query, subject, draft_id=session_id)
    logger.info(f"[ImageRetriever] Raw query: '{search_query}' -> AI Queries: {optimized_queries}")

    for q in optimized_queries:
        # Pool candidates across ALL 4 ENGINES
        candidates = []
        candidates.extend(search_wikipedia_images(q, max_results=5))
        candidates.extend(search_wikimedia_commons_images(q, max_results=5))
        candidates.extend(search_duckduckgo_images(q, max_results=5))
        candidates.extend(search_pixabay_images(q, max_results=5))

        if not candidates:
            continue

        safe_candidates = [item for item in candidates if is_safe_and_relevant(item, subject=subject, language=language)]
        if not safe_candidates:
            continue

        # Step 2: AI Candidate Inspector to pick the #1 most educationally accurate image
        selected_candidate = ai_inspect_and_select_candidate(safe_candidates, subject=subject, search_query=search_query, draft_id=session_id)

        # Fallback to list iteration if selected candidate fails or was used
        candidates_to_try = [selected_candidate] + [c for c in rank_candidate_images(safe_candidates) if c != selected_candidate]

        for candidate in candidates_to_try:
            if not candidate:
                continue
            img_url = candidate.get("image") or candidate.get("url") or candidate.get("thumbnail")
            if not img_url:
                continue
                
            url_hash = hashlib.md5(img_url.encode("utf-8")).hexdigest()
            if url_hash in used_set:
                logger.info(f"[ImageRetriever] Skipping already used image URL: {img_url}")
                continue

            local_path = download_and_save_image(img_url)
            if local_path:
                used_set.add(url_hash)
                logger.info(f"[ImageRetriever] Selected image from {candidate.get('source')}: {img_url}")
                return local_path

    logger.warning(f"[ImageRetriever] Could not download any candidate for query: '{search_query}'")
    return None
