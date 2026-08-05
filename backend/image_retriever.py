import os
import re
import uuid
import logging
import hashlib
import urllib.parse
import requests
from typing import Optional, List, Set, Dict

logger = logging.getLogger("image_retriever")

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
    Cleans and restricts search query to 3-5 concise words so web engines return top matches.
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
    Ranks candidate images pooled across all 4 search providers based on domain trust, visual type, and quality.
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
    Main entry point: Pools candidates across 4 engines (Wikipedia, Wikimedia Commons, DuckDuckGo, Pixabay),
    ranks all candidates by educational authority and clarity, and downloads the top #1 unused image.
    """
    if not search_query:
        return None

    if session_id not in USED_IMAGES_CACHE:
        USED_IMAGES_CACHE[session_id] = set()
    used_set = USED_IMAGES_CACHE[session_id]

    final_query = sanitize_search_query(search_query, subject)
    fallback_query = " ".join(final_query.split()[:3]) + " diagram"

    logger.info(f"[ImageRetriever] Search query: '{search_query}' -> Sanitized: '{final_query}'")

    queries_to_try = [final_query]
    if fallback_query != final_query:
        queries_to_try.append(fallback_query)

    for q in queries_to_try:
        # Pool candidates across ALL 4 ENGINES
        candidates = []
        candidates.extend(search_wikipedia_images(q, max_results=6))
        candidates.extend(search_wikimedia_commons_images(q, max_results=6))
        candidates.extend(search_duckduckgo_images(q, max_results=6))
        candidates.extend(search_pixabay_images(q, max_results=6))

        if not candidates:
            continue

        safe_candidates = [item for item in candidates if is_safe_and_relevant(item, subject=subject, language=language)]
        if not safe_candidates:
            continue

        # Rank all candidate images from all 4 providers together to pick the absolute best one
        ranked_candidates = rank_candidate_images(safe_candidates)

        for candidate in ranked_candidates:
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
                logger.info(f"[ImageRetriever] #1 Ranked Image selected from {candidate.get('source')}: {img_url}")
                return local_path

    logger.warning(f"[ImageRetriever] Could not download any candidate for query: '{search_query}'")
    return None
