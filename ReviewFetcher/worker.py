import os
import time
import json
import pandas as pd
from supabase import create_client, Client
from dotenv import load_dotenv

# Import the main function from your existing script and give it a clear alias
from PainPoints_Extractor import main as extract_brand_pain_points
from PainPoints_Extractor import get_trustpilot_website as get_url
from PainPoints_Extractor import get_pain_points_from_reviews
from PainPoints_Extractor import get_reviews

# --- Load Environment Variables ---
load_dotenv()

# --- Initialize Supabase Client ---
url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(url, key)

proxy_list = [
    "198.23.239.134:6540:pgnprica:xukeqgumn3be",
    "207.244.217.165:6712:pgnprica:xukeqgumn3be",
    "107.172.163.27:6543:pgnprica:xukeqgumn3be",
    "104.222.161.211:6343:pgnprica:xukeqgumn3be",
    "64.137.96.74:6641:pgnprica:xukeqgumn3be",
    "216.10.27.159:6837:pgnprica:xukeqgumn3be",
    "136.0.207.84:6661:pgnprica:xukeqgumn3be",
    "23.95.150.145:6114:pgnprica:xukeqgumn3be"
]

def store_reviews_in_database(reviews_df, brand_id, company_url):
    """
    Store reviews from DataFrame into the reviews table.
    """
    try:
        print(f"Storing {len(reviews_df)} reviews in database for brand_id: {brand_id}")
        
        # Convert DataFrame to list of dictionaries for database insertion
        reviews_to_insert = []
        for _, row in reviews_df.iterrows():
            review_data = {
                "brand_id": brand_id,
                "reviewer_name": row.get('reviewer_name', 'N/A'),
                "review_text": row.get('review_content', ''),
                "rating": int(row.get('rating', 0)) if pd.notna(row.get('rating')) and str(row.get('rating')).isdigit() else 0,
                "review_url": f"https://www.trustpilot.com/review/{company_url}",
                "created_at": row.get('review_date', 'now()'),
                "updated_at": "now()"
            }
            reviews_to_insert.append(review_data)
        
        # Insert reviews in batches (Supabase has limits)
        batch_size = 100
        for i in range(0, len(reviews_to_insert), batch_size):
            batch = reviews_to_insert[i:i + batch_size]
            result = supabase.table("reviews").insert(batch).execute()
            print(f"Inserted batch {i//batch_size + 1} of {(len(reviews_to_insert) + batch_size - 1)//batch_size}")
        
        print("All reviews stored successfully!")
        return True
        
    except Exception as e:
        print(f"Error storing reviews in database: {e}")
        return False

def convert_reviews_to_dataframe(reviews_data):
    """
    Convert reviews from database format to DataFrame format expected by get_pain_points_from_reviews
    """
    df_data = []
    for review in reviews_data:
        df_data.append({
            'review_content': review.get('review_text', ''),
            'rating': review.get('rating', 0),
            'reviewer_name': review.get('reviewer_name', 'N/A'),
            'review_date': review.get('created_at', ''),
            'review_title': ''  # Not stored in DB, but needed for consistency
        })
    
    return pd.DataFrame(df_data)

def process_jobs():
    """
    Infinitely polls the harvest_jobs table for new jobs to process.
    """
    while True:
        try:
            print("Checking for new harvest jobs...")
            
            # 1. Fetch the oldest queued job
            response = supabase.table("harvest_jobs") \
                .select("*") \
                .eq("status", "queued") \
                .order("created_at", desc=False) \
                .limit(1) \
                .execute()
            
            if not response.data:
                print("No jobs found. Sleeping for 10 seconds.")
                time.sleep(10)
                continue
            
            job = response.data[0]
            job_id = job['id'] # harvest job id 
            brand_id = job['brand_id'] # brand id
            workspace_id = job['workspace_id'] # workspace id 
            analyses_id = job['analyses_id'] # analyses id
            print("Analysis id is :",analyses_id)
            
            print(f"Processing job ID: {job_id} for brand ID: {brand_id}")

            # 2. Mark the job as 'running' to prevent other workers from picking it up
            supabase.table("harvest_jobs").update({
                "status": "running",
                "started_at": "now()"
            }).eq("id", job_id).execute()

            # 3. Get the brand name from the 'brands' table
            brand_response = supabase.table("brands").select("name").eq("id", brand_id).single().execute()
            if not brand_response.data:
                raise Exception(f"Brand with ID {brand_id} not found.")
            
            company_name = brand_response.data['name']
            print(f"Processing company: '{company_name}'")
            
            # 4. Get the Trustpilot URL for this company
            print("Getting Trustpilot URL...")
            company_url = get_url(company_name, proxy_list)
            
            if not company_url:
                raise Exception(f"Could not find Trustpilot URL for company: {company_name}")
            
            print(f"Found Trustpilot URL: {company_url}")
            
            # 5. Check if a brand with this URL already exists in database
            existing_brand_response = supabase.table("brands").select("id").eq("url", company_url).execute()
            
            pain_points = None
            
            if existing_brand_response.data:
                # Brand with this URL exists, check for reviews
                existing_brand_id = existing_brand_response.data[0]["id"]
                print(f"Found existing brand with ID: {existing_brand_id}")
                
                # Check if reviews exist for this brand
                existing_reviews_response = supabase.table("reviews").select("*").eq("brand_id", existing_brand_id).execute()
                
                if existing_reviews_response.data:
                    # Reviews exist, use them to get pain points
                    print(f"Found {len(existing_reviews_response.data)} existing reviews in database")
                    
                    # Convert reviews to DataFrame format
                    reviews_df = convert_reviews_to_dataframe(existing_reviews_response.data)
                    
                    # Get pain points from existing reviews
                    api_key = "AIzaSyAExTmlHjrBBZjcd7TrglC-p-IH4KCOd8g"
                    pain_points = get_pain_points_from_reviews(reviews_df, "review_content", "rating", api_key)
                    
                else:
                    # No reviews exist, scrape them
                    print("No reviews found in database, scraping new reviews...")
                    scraped_url, reviews_df = get_reviews(company_name, company_url, proxy_list)
                    
                    if scraped_url and reviews_df is not None and not reviews_df.empty:
                        # Store reviews in database
                        if store_reviews_in_database(reviews_df, existing_brand_id, company_url):
                            # Get pain points from scraped reviews
                            api_key = "AIzaSyAExTmlHjrBBZjcd7TrglC-p-IH4KCOd8g"
                            pain_points = get_pain_points_from_reviews(reviews_df, "review_content", "rating", api_key)
                        else:
                            raise Exception("Failed to store reviews in database")
                    else:
                        raise Exception("Failed to scrape reviews")
                        
            else:
                # No brand with this URL exists, create new brand and scrape reviews
                print("No existing brand found, creating new brand and scraping reviews...")
                
                # Update the current brand with the URL
                supabase.table("brands").update({"url": company_url}).eq("id", brand_id).execute()
                
                # Scrape reviews
                scraped_url, reviews_df = get_reviews(company_name, company_url, proxy_list)
                
                if scraped_url and reviews_df is not None and not reviews_df.empty:
                    # Store reviews in database
                    if store_reviews_in_database(reviews_df, brand_id, company_url):
                        # Get pain points from scraped reviews
                        api_key = "AIzaSyAExTmlHjrBBZjcd7TrglC-p-IH4KCOd8g"
                        pain_points = get_pain_points_from_reviews(reviews_df, "review_content", "rating", api_key)
                        if "API request timed out." in pain_points:
                            print("Failed to fetch the pain points from API ")
                            pain_points = get_pain_points_from_reviews(reviews_df, "review_content", "rating", api_key)
                    else:
                        raise Exception("Failed to store reviews in database")
                else:
                    raise Exception("Failed to scrape reviews")

            # 6. Update the 'analyses' table with the result
            if pain_points:
                print(f"Analysis successful for '{company_name}'. Updating database.")
                result_data = {
                    "url": company_url,
                    "pain_points": pain_points.strip().split('\n') if isinstance(pain_points, str) else pain_points
                }
                
                # Update or insert analysis
                supabase.table("analyses").upsert({
                    "id":analyses_id,
                    "brand_id": brand_id,
                    "workspace_id": workspace_id,
                    "status": "completed",
                    "result_data": result_data,
                    "completed_at": "now()"
                }).execute()
                
                print(f"Analysis complete. Deleting job ID: {job_id}")
                supabase.table("harvest_jobs").delete().eq("id", job_id).execute()
                
            else:
                raise Exception("Failed to generate pain points")

        except Exception as e:
            print(f"An error occurred: {e}")
            # If a job was being processed, mark it as failed
            if 'job_id' in locals():
                try:
                    # Update job status
                    supabase.table("harvest_jobs").update({
                        "status": "failed",
                        "error": str(e)
                    }).eq("id", job_id).execute()
                    
                    # Update analysis status
                    supabase.table("analyses").upsert({
                        "id":analyses_id,
                        "brand_id": locals().get('brand_id', ''),
                        "workspace_id": locals().get('workspace_id', ''),
                        "status": "failed",
                        "error": str(e),
                        "result_data": {"error": "Analysis Failed", "message": str(e)},
                        "completed_at": "now()"
                    }).execute()
                    
                    # Update workspace members with error message
                    if 'workspace_id' in locals() and 'company_name' in locals():
                        supabase.table("workspace_members").update({
                            "messages": f"Your analysis for {company_name} failed: {str(e)}. Please try again, or contact support if the issue persists."
                        }).eq("workspace_id", workspace_id).execute()
                    
                    # Delete the failed job
                    supabase.table("harvest_jobs").delete().eq("id", job_id).execute()
                    
                except Exception as cleanup_error:
                    print(f"Error during cleanup: {cleanup_error}")
            
            print("Waiting for 30 seconds before retrying...")
            time.sleep(30)


if __name__ == "__main__":
    process_jobs()