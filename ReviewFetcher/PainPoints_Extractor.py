import requests
from bs4 import BeautifulSoup
import pandas as pd
import re
import time
import random
from concurrent.futures import ThreadPoolExecutor, as_completed
from tqdm import tqdm
import requests
from bs4 import BeautifulSoup
import pandas as pd
import time
import random
from concurrent.futures import ThreadPoolExecutor, as_completed
from tqdm import tqdm # For the progress bar
import json
import time
import random
import zipfile
from urllib.parse import urlparse, parse_qs
import os
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException
import requests


# --- Part 1: Functions to find the total number of pages ---
# Normalize both strings for comparison
def normalize_for_matching(text):
    # Remove spaces, hyphens, underscores, and convert to lowercase
    return re.sub(r'[\s\-_]+', '', text.lower())

def calculate_match_percentage(company_name, url):
    # Split company name into words and normalize
    company_words = [normalize_for_matching(word) for word in company_name.split() if len(word) > 2]  # Skip very short words
    normalized_url = normalize_for_matching(url)
    
    if not company_words:
        return 0
    
    matched_words = 0
    for word in company_words:
        if word in normalized_url:
            matched_words += 1
    
    return (matched_words / len(company_words)) * 100



def check_page_exists(url, proxy_list, headers, retries=2):
    for _ in range(retries):
        try:
            proxy_string = random.choice(proxy_list)
            ip, port, user, pwd = proxy_string.split(':')
            proxy_url = f"http://{user}:{pwd}@{ip}:{port}"
            proxies = {'http': proxy_url, 'https': proxy_url}
            
            response = requests.head(url, headers=headers, proxies=proxies, timeout=15, allow_redirects=True)
            
            if response.status_code == 200:
                return True
        except requests.RequestException:
            continue
    return False


def get_total_pages_binary_search(base_url, proxy_list, max_search_range=2000):
    """
    Finds the total number of review pages using a binary search approach.
    """
    print("Finding the last page using binary search...")
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"}
    
    low = 1
    high = max_search_range
    last_known_good_page = 0

    # Binary search to find the last valid page number
    while low <= high:
        mid = (low + high) // 2
        if mid == 0: break # Safety break
        
        url_to_check = f"{base_url}?languages=all&page={mid}"
        print(f"Checking {url_to_check}")
        print(f"Checking if page {mid} exists...")

        if check_page_exists(url_to_check, proxy_list, headers):
            # This page exists, so the last page is at least 'mid'.
            # Store it and search in the upper half.
            last_known_good_page = mid
            low = mid + 1
        else:
            # This page doesn't exist (404).
            # The last page must be in the lower half.
            high = mid - 1
        
        time.sleep(random.uniform(1, 3))

    if last_known_good_page > 0:
        print(f" Last page found: {last_known_good_page}")
        return last_known_good_page
    else:
        print(" Could not find any review pages.")
        return None


# --- Part 2: Function to scrape a single page (Unchanged) ---

def scrape_page(url, proxy_list):
    """
    Scrapes a single page of reviews and returns a list of dictionaries.
    """
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"}
    page_reviews = []
    
    proxy_string = random.choice(proxy_list)
    ip, port, user, pwd = proxy_string.split(':')
    proxy_url = f"http://{user}:{pwd}@{ip}:{port}"
    proxies = {'http': proxy_url, 'https': proxy_url}
    
    try:
        response = requests.get(url, headers=headers, proxies=proxies, timeout=20)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')
        
        review_cards = soup.find_all('article', class_='styles_reviewCard__Qwhpy')

        for card in review_cards:
            reviewer_name = card.find('span', {'data-consumer-name-typography': 'true'}).get_text(strip=True) if card.find('span', {'data-consumer-name-typography': 'true'}) else "N/A"
            review_title = card.find('h2', {'data-service-review-title-typography': 'true'}).get_text(strip=True) if card.find('h2', {'data-service-review-title-typography': 'true'}) else "N/A"
            review_content_tag = card.find('p', {'data-service-review-text-typography': 'true'})
            review_content = review_content_tag.get_text(strip=True) if review_content_tag else ""
            rating_div = card.find('div', {'data-service-review-rating': True})
            rating = rating_div['data-service-review-rating'] if rating_div else "N/A"
            date_tag = card.find('time')
            review_date = date_tag['datetime'] if date_tag else "N/A"
            
            page_reviews.append({'reviewer_name': reviewer_name, 'review_title': review_title, 'review_content': review_content, 'rating': rating, 'review_date': review_date})
            
        return page_reviews
        
    except requests.RequestException:
        return None

# --- Part 3: Main execution block ---
import re

def clean_company_name(company_name: str) -> str:
    """
    Cleans the company name by removing dots and special characters, keeping only alphanumeric characters and spaces.
    
    Args:
        company_name: The original company name string
        
    Returns:
        Cleaned company name with special characters removed
    """
    # Remove dots and other special characters, keep only alphanumeric and spaces
    cleaned = re.sub(r'[^\w\s]', ' ', company_name)
    # Replace multiple spaces with single space and strip
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    return cleaned

def get_trustpilot_website(company_name: str, proxies: list, headless: bool = True, max_retries: int = 3) -> str | None:
    """
    Scrape Trustpilot for a company's website URL with retry functionality.
    
    Args:
        company_name: The name of the company to search for
        proxies: List of proxy strings in format 'ip:port:user:pass'
        headless: Whether to run browser in headless mode
        max_retries: Maximum number of retry attempts (default: 3)
    
    Returns:
        Website URL if found and validated, None otherwise
    """
    
    # Clean the company name by removing dots and special characters
    original_company_name = company_name
    cleaned_company_name = clean_company_name(company_name)
    print(f"Original company name: '{original_company_name}'")
    print(f"Cleaned company name: '{cleaned_company_name}'")
    
    for attempt in range(max_retries):
        print(f"\n--- Attempt {attempt + 1} of {max_retries} ---")
        
        # --- Proxy Configuration ---
        proxy_choice = random.choice(proxies)
        try:
            ip, port, user, password = proxy_choice.split(':')
        except ValueError:
            print(f"Error: Proxy string '{proxy_choice}' is not in the correct format 'ip:port:user:pass'")
            if attempt == max_retries - 1:  # Last attempt
                return None
            continue

        manifest_json = """
        {
            "version": "1.0.0",
            "manifest_version": 2,
            "name": "Chrome Proxy",
            "permissions": [
                "proxy",
                "tabs",
                "unlimitedStorage",
                "storage",
                "<all_urls>",
                "webRequest",
                "webRequestBlocking"
            ],
            "background": {
                "scripts": ["background.js"]
            }
        }
        """

        background_js = f"""
        var config = {{
                mode: "fixed_servers",
                rules: {{
                  singleProxy: {{
                    scheme: "http",
                    host: "{ip}",
                    port: parseInt({port})
                  }},
                  bypassList: ["localhost"]
                }}
              }};

        chrome.proxy.settings.set({{value: config, scope: "regular"}}, function() {{}});

        function callbackFn(details) {{
            return {{
                authCredentials: {{
                    username: "{user}",
                    password: "{password}"
                }}
            }};
        }}

        chrome.webRequest.onAuthRequired.addListener(
                    callbackFn,
                    {{urls: ["<all_urls>"]}},
                    ['blocking']
        );
        """
        
        plugin_file = f'proxy_auth_plugin_{attempt}.zip'
        
        try:
            with zipfile.ZipFile(plugin_file, 'w') as zp:
                zp.writestr("manifest.json", manifest_json)
                zp.writestr("background.js", background_js)

            # --- Selenium Options for Headless Mode ---
            options = webdriver.ChromeOptions()
            if headless:
                options.add_argument("--headless")
                print("")
            options.add_extension(plugin_file)
            options.add_argument('--no-sandbox')
            options.add_argument('--disable-dev-shm-usage')
            # Add arguments to make headless browser appear more human
            options.add_argument("--window-size=1920,1080")
            options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36")
            options.add_argument("--disable-blink-features=AutomationControlled")

            driver = webdriver.Chrome(options=options)
            website_url = None

            try:
                print(f"Using proxy: {ip}:{port}")
                # 1. Go to Trustpilot's homepage.
                driver.get("https://www.trustpilot.com/")

                # NEW: Handle cookie consent banner which might block elements in headless mode
                try:
                    cookie_wait = WebDriverWait(driver, 5)
                    cookie_button = cookie_wait.until(
                        EC.element_to_be_clickable((By.ID, "onetrust-accept-btn-handler"))
                    )
                    cookie_button.click()

                except TimeoutException:
                    print("Cookie banner not found or not clickable")

                # Wait for the search input field to be present.
                wait = WebDriverWait(driver, 20) # Increased wait time for proxy
                search_input = wait.until(
                    EC.presence_of_element_located((By.NAME, "query"))
                )

                # 2. Type the CLEANED company name and press Enter.
                search_input.send_keys(cleaned_company_name)
                search_input.send_keys(Keys.RETURN)
                time.sleep(1.5)  
                
                # 3. Wait for the search results to load and find the website URL element.
                first_result_url_element = wait.until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, "p[class*='styles_websiteUrlDisplayed']"))
                )

                # 4. Extract the text from the element.
                scraped_url = first_result_url_element.text
                
                # 5. Validate if the CLEANED company name is in the scraped URL.
                match_percentage = calculate_match_percentage(cleaned_company_name, scraped_url)

                if match_percentage >= 50:
                    website_url = scraped_url
                    print(f"Successfully found and validated website for {original_company_name}: {website_url} (Match: {match_percentage:.1f}%)")
                    return website_url  # Success - return immediately
                else:
                    print(f"Validation Failed: Found URL '{scraped_url}' has only {match_percentage:.1f}% match with company name '{cleaned_company_name}' (threshold: 50%).")

            except TimeoutException:
                print(f"Could not find the company '{cleaned_company_name}' or the website URL element on the page.")
            except Exception as e:
                print(f"An unexpected error occurred: {e}")
            finally:
                # Close the browser window
                try:
                    driver.quit()
                except:
                    pass
                
        except Exception as e:
            print(f"Failed to create browser or proxy setup: {e}")
            
        finally:
            # Clean up the extension file
            if os.path.exists(plugin_file):
                try:
                    os.remove(plugin_file)
                except:
                    pass
        
        # If this wasn't the last attempt, wait before retrying
        if attempt < max_retries - 1:
            wait_time = (attempt + 1) * 2  # Progressive wait: 2s, 4s, 6s...
            print(f"Attempt {attempt + 1} failed. Waiting {wait_time} seconds before retry...")
            time.sleep(wait_time)
    
    print(f"All {max_retries} attempts failed. Unable to fetch website URL for '{original_company_name}'.")
    return None



def get_reviews(company_to_search, url ,proxy_list):
    
    # url = None
    # i = 3
    # while i > 0:
    #     url = get_trustpilot_website(company_to_search, proxy_list)
    #     if url:
    #         print(f"\nThe scraped website URL is: {url}")
    #         break
    #     else:
    #         print(f"\nFailed to retrieve a valid website URL for {company_to_search}. Retrying...") 
    #         i-= 1
    # if not url:
    #     return None, None
        

    target_url = f"https://www.trustpilot.com/review/{url}"
    print(target_url)

    total_pages = get_total_pages_binary_search(target_url, proxy_list)
    
    if total_pages:
        urls_to_scrape = [f"{target_url}?languages=all&page={i}" for i in range(1, total_pages + 1)]
        all_reviews_list = []
        
        with ThreadPoolExecutor(max_workers=len(proxy_list)) as executor:
            future_to_url = {executor.submit(scrape_page, url, proxy_list): url for url in urls_to_scrape}
            
            for future in tqdm(as_completed(future_to_url), total=len(urls_to_scrape), desc="Scraping Reviews"):
                try:
                    result = future.result()
                    if result:
                        all_reviews_list.extend(result)
                except Exception as exc:
                    print(f'{future_to_url[future]} generated an exception: {exc}')

        reviews_df = pd.DataFrame(all_reviews_list)
        
        if not reviews_df.empty:
            print(f"\nSuccessfully scraped a total of {len(reviews_df)} reviews.")
            return url, reviews_df


        else:
            print("\nScraping finished, but no reviews were collected.")
            return None
        
def extract_pain_points(result):
    try:
        # Case 1: Expected format
        return result['candidates'][0]['content']['parts'][0]['text'].strip()
    except KeyError:
        pass

    try:
        # Case 2: Newer format (direct output inside candidates)
        return result['candidates'][0]['output'][0]['content'][0]['text'].strip()
    except (KeyError, IndexError):
        pass

    # Debug fallback → show full response so you know what structure to handle
    return f"Unexpected response format:\n{json.dumps(result, indent=2)}"
            
def get_pain_points_from_reviews(df: pd.DataFrame, review_column: str, rating_column: str, api_key: str) -> str:
    """
    Extract pain points from 90 randomly selected reviews (30 each from 1, 2, and 3-star ratings).
    """
    if review_column not in df.columns:
        return f"Error: Column '{review_column}' not found in DataFrame."
    if rating_column not in df.columns:
        return f"Error: Column '{rating_column}' not found in DataFrame."
    if df[review_column].isnull().all():
        return "Error: The review column is empty."
    
    # Convert rating to numeric and filter for 1, 2, 3 star reviews
    df_clean = df.dropna(subset=[review_column, rating_column]).copy()
    df_clean[rating_column] = pd.to_numeric(df_clean[rating_column], errors='coerce')
    df_clean = df_clean[df_clean[rating_column].isin([1, 2, 3])]
    
    if df_clean.empty:
        return "Error: No reviews found with 1, 2, or 3-star ratings."
    
    selected_reviews = []
    
    # Select 30 random reviews from each rating (1, 2, 3)
    for rating in [1, 2, 3]:
        rating_reviews = df_clean[df_clean[rating_column] == rating]
        
        if rating_reviews.empty:
            print(f"Warning: No {rating}-star reviews found.")
            continue
        
        # Select up to 30 reviews (or all if less than 30 available)
        sample_size = min(30, len(rating_reviews))
        sampled = rating_reviews.sample(n=sample_size, random_state=42)
        selected_reviews.append(sampled)
        print(f"Selected {sample_size} reviews from {rating}-star ratings ({len(rating_reviews)} available)")
    
    if not selected_reviews:
        return "Error: No reviews could be selected from 1, 2, or 3-star ratings."
    
    # Combine all selected reviews
    final_df = pd.concat(selected_reviews, ignore_index=True)
    reviews_list = final_df[review_column].astype(str).tolist()
    
    print(f"\nTotal reviews selected for analysis: {len(reviews_list)}")
    print(f"Distribution: {final_df[rating_column].value_counts().sort_index().to_dict()}")
    
    # Truncate very long reviews to manage token usage
    truncated_reviews = []
    for review in reviews_list:
        # Limit each review to ~300 characters to prevent token overflow
        truncated_review = review[:300] + "..." if len(review) > 300 else review
        truncated_reviews.append(truncated_review)
    
    # Combine all reviews for analysis
    reviews_text = "\n- ".join(truncated_reviews)
    
    prompt = f"""
Analyze the following {len(truncated_reviews)} customer reviews (from 1, 2, and 3-star ratings) and identify the top 5 most common pain points or complaints.

Return only a numbered list (1-5) with clear, detailed pain points. Do not use bold formatting or asterisks or quotation marks.

give 2 review examples for each of the pain point so each point doesnt look arrow in sky

if you get review other than english translate it in english and then give it in example





Reviews:
- {reviews_text}

Pain Points:
"""
    
    api_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key={api_key}"
    headers = {"Content-Type": "application/json"}
    
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 200000,
            "topP": 0.8,
            "topK": 40
        }
    }
    
    try:
        print("Analyzing selected reviews for pain points...")
        response = requests.post(api_url, headers=headers, data=json.dumps(payload), timeout=120)
        response.raise_for_status()
        result = response.json()
        
        # Check if response was truncated due to token limits
        finish_reason = result.get("candidates", [{}])[0].get("finishReason", "")
        if finish_reason == "MAX_TOKENS":
            print("Warning: Response was truncated due to token limits. Consider reducing review length or count.")
        
        text = (
            result.get("candidates", [{}])[0]
            .get("content", {})
            .get("parts", [{}])[0]
            .get("text", "")
        )
        
        if text:
            return text.strip()
        else:
            print("No text returned from API")
            print("Full response:", json.dumps(result, indent=2))
            return "No pain points extracted."
            
    except requests.exceptions.Timeout:
        return "Error: API request timed out."
    except requests.exceptions.RequestException as e:
        return f"Error: API request failed - {e}"
    except Exception as e:
        return f"Error: Unexpected error occurred - {e}"

def main(company_to_search, url , proxy_list):
   
    url, reviews = get_reviews(company_to_search, url ,proxy_list)
    if not url:
        return None, None 
    
    api_key = "AIzaSyAExTmlHjrBBZjcd7TrglC-p-IH4KCOd8g"
    # Note: Make sure your reviews DataFrame has a 'rating' column
    pain_points = get_pain_points_from_reviews(reviews, "review_content", "rating", api_key)
    return url, pain_points


