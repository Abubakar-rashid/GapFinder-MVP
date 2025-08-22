import os
import re
import unicodedata
from datetime import datetime, timedelta
from supabase import create_client, Client
from typing import Optional, Dict, Any, List

class CompanyAnalysisService:
    def __init__(self):
        """Initialize Supabase client with your credentials"""
        # Replace these with your actual Supabase credentials
        self.supabase_url = "http://31.220.90.246:8000"  # Your Supabase URL from the image
        self.supabase_key = "YOUR_SUPABASE_ANON_KEY"  # You'll need to provide this
        
        # Alternative: Use environment variables for security
        # self.supabase_url = os.getenv("SUPABASE_URL")
        # self.supabase_key = os.getenv("SUPABASE_ANON_KEY")
        
        self.supabase: Client = create_client(self.supabase_url, self.supabase_key)
    
    def normalize_company_name(self, company_name: str) -> str:
        """
        Normalize company name for better matching.
        
        Args:
            company_name (str): Original company name
            
        Returns:
            str: Normalized company name
        """
        if not company_name:
            return ""
        
        # Convert to lowercase
        normalized = company_name.lower()
        
        # Remove accents and diacritics
        normalized = unicodedata.normalize('NFD', normalized)
        normalized = ''.join(char for char in normalized if unicodedata.category(char) != 'Mn')
        
        # Replace multiple spaces with single space
        normalized = re.sub(r'\s+', ' ', normalized)
        
        # Remove leading/trailing whitespace
        normalized = normalized.strip()
        
        return normalized
    
    def create_search_patterns(self, company_name: str) -> List[str]:
        """
        Create multiple search patterns for robust matching.
        
        Args:
            company_name (str): Company name to create patterns for
            
        Returns:
            List[str]: List of search patterns
        """
        patterns = []
        
        # Original name
        patterns.append(company_name)
        
        # Normalized version
        normalized = self.normalize_company_name(company_name)
        patterns.append(normalized)
        
        # Remove common business suffixes/prefixes
        business_terms = [
            r'\b(inc|incorporated|corp|corporation|ltd|limited|llc|co|company|plc|sa|ag|gmbh|bv|nv|srl|spa|sas|ab|as|oy|oyj|kk|kabushiki kaisha|株式会社)\b',
            r'\b(the|a|an)\s+',  # Articles
            r'[.,;:!?(){}[\]"\'-]',  # Punctuation
            r'\s*&\s*',  # Ampersand with spaces
        ]
        
        clean_name = normalized
        for term in business_terms:
            clean_name = re.sub(term, ' ', clean_name, flags=re.IGNORECASE)
        
        # Clean up multiple spaces and trim
        clean_name = re.sub(r'\s+', ' ', clean_name).strip()
        patterns.append(clean_name)
        
        # Remove spaces entirely for very tight matching
        no_spaces = re.sub(r'\s', '', clean_name)
        if no_spaces and no_spaces != clean_name:
            patterns.append(no_spaces)
        
        # Split into words for partial matching
        words = clean_name.split()
        if len(words) > 1:
            # First and last word combination
            patterns.append(f"{words[0]} {words[-1]}")
            # Each significant word (longer than 2 characters)
            for word in words:
                if len(word) > 2:
                    patterns.append(word)
        
        # Remove duplicates while preserving order
        seen = set()
        unique_patterns = []
        for pattern in patterns:
            if pattern and pattern not in seen:
                seen.add(pattern)
                unique_patterns.append(pattern)
        
        return unique_patterns
    
    def search_company_analysis(self, company_name: str) -> Optional[Dict[Any, Any]]:
        """
        Search for company analysis in the database with robust matching.
        
        Args:
            company_name (str): Name of the company to search for
            
        Returns:
            Dict or None: Company analysis data if found and recent, None otherwise
        """
        try:
            # Calculate the date 14 days ago
            fourteen_days_ago = datetime.now() - timedelta(days=14)
            
            # Create multiple search patterns
            search_patterns = self.create_search_patterns(company_name)
            
            print(f"Searching for patterns: {search_patterns}")
            
            all_results = []
            
            # Try different search strategies
            for pattern in search_patterns:
                if not pattern:
                    continue
                
                # Strategy 1: Case-insensitive LIKE search
                try:
                    response = self.supabase.table("analyses").select("*").ilike("company_name", f"%{pattern}%").execute()
                    if response.data:
                        all_results.extend(response.data)
                except Exception as e:
                    print(f"ILIKE search failed for pattern '{pattern}': {str(e)}")
                
                # Strategy 2: Exact match (case-insensitive)
                try:
                    response = self.supabase.table("analyses").select("*").ilike("company_name", pattern).execute()
                    if response.data:
                        all_results.extend(response.data)
                except Exception as e:
                    print(f"Exact match failed for pattern '{pattern}': {str(e)}")
            
            # If no results with ILIKE, try text search (if your database supports it)
            if not all_results:
                try:
                    # PostgreSQL full-text search (if available)
                    normalized_query = self.normalize_company_name(company_name)
                    response = self.supabase.table("analyses").select("*").text_search("company_name", normalized_query).execute()
                    if response.data:
                        all_results.extend(response.data)
                except Exception as e:
                    print(f"Text search failed: {str(e)}")
            
            # Remove duplicates based on ID
            seen_ids = set()
            unique_results = []
            for record in all_results:
                record_id = record.get('id')
                if record_id not in seen_ids:
                    seen_ids.add(record_id)
                    unique_results.append(record)
            
            # Check date validity for each unique result
            for record in unique_results:
                # Check if the record is not older than 14 days
                record_date = None
                if 'updated_at' in record and record['updated_at']:
                    record_date = datetime.fromisoformat(record['updated_at'].replace('Z', '+00:00'))
                elif 'created_at' in record and record['created_at']:
                    record_date = datetime.fromisoformat(record['created_at'].replace('Z', '+00:00'))
                
                if record_date and record_date >= fourteen_days_ago:
                    print(f"Found recent analysis for {company_name}")
                    return record
            
            if unique_results:
                print(f"Analysis found for {company_name} but it's older than 14 days")
            else:
                print(f"No analysis found for {company_name}")
            
            return None
                
        except Exception as e:
            print(f"Error searching for company analysis: {str(e)}")
            return None
    
    def fuzzy_match_score(self, search_term: str, company_name: str) -> float:
        """
        Calculate a simple fuzzy match score between search term and company name.
        
        Args:
            search_term (str): The search term
            company_name (str): Company name from database
            
        Returns:
            float: Match score between 0 and 1
        """
        if not search_term or not company_name:
            return 0.0
        
        search_norm = self.normalize_company_name(search_term)
        company_norm = self.normalize_company_name(company_name)
        
        # Exact match
        if search_norm == company_norm:
            return 1.0
        
        # Substring match
        if search_norm in company_norm or company_norm in search_norm:
            return 0.8
        
        # Word-based matching
        search_words = set(search_norm.split())
        company_words = set(company_norm.split())
        
        if search_words and company_words:
            intersection = search_words.intersection(company_words)
            union = search_words.union(company_words)
            jaccard_score = len(intersection) / len(union) if union else 0
            
            # Boost score if all search words are found
            if search_words.issubset(company_words):
                jaccard_score += 0.3
            
            return min(jaccard_score, 1.0)
        
        return 0.0
    
    def advanced_search_company_analysis(self, company_name: str, min_score: float = 0.6) -> Optional[Dict[Any, Any]]:
        """
        Advanced search with fuzzy matching and scoring.
        
        Args:
            company_name (str): Name of the company to search for
            min_score (float): Minimum match score to consider (0.0 to 1.0)
            
        Returns:
            Dict or None: Best matching company analysis data if found and recent
        """
        try:
            fourteen_days_ago = datetime.now() - timedelta(days=14)
            
            # Get all records from analyses table (you might want to limit this in production)
            response = self.supabase.table("analyses").select("*").execute()
            
            if not response.data:
                print(f"No records found in analyses table")
                return None
            
            best_match = None
            best_score = 0.0
            
            # Score each record
            for record in response.data:
                if 'company_name' not in record or not record['company_name']:
                    continue
                
                score = self.fuzzy_match_score(company_name, record['company_name'])
                
                if score >= min_score and score > best_score:
                    # Check if the record is not older than 14 days
                    record_date = None
                    if 'updated_at' in record and record['updated_at']:
                        record_date = datetime.fromisoformat(record['updated_at'].replace('Z', '+00:00'))
                    elif 'created_at' in record and record['created_at']:
                        record_date = datetime.fromisoformat(record['created_at'].replace('Z', '+00:00'))
                    
                    if record_date and record_date >= fourteen_days_ago:
                        best_match = record
                        best_score = score
                        print(f"Found match: '{record['company_name']}' with score {score:.2f}")
            
            if best_match:
                print(f"Best match for '{company_name}': '{best_match['company_name']}' (score: {best_score:.2f})")
                return best_match
            else:
                print(f"No suitable match found for '{company_name}' with minimum score {min_score}")
                return None
                
        except Exception as e:
            print(f"Error in advanced search: {str(e)}")
            return None
    
    def get_company_analysis(self, company_name: str, use_advanced_search: bool = True) -> Optional[Dict[Any, Any]]:
        """
        Main function that searches for company analysis and calls other function if needed.
        
        Args:
            company_name (str): Name of the company to analyze
            use_advanced_search (bool): Whether to use advanced fuzzy matching
            
        Returns:
            Dict or None: Analysis data or result from new analysis
        """
        # First, try the standard search
        existing_analysis = self.search_company_analysis(company_name)
        
        # If no results and advanced search is enabled, try fuzzy matching
        if not existing_analysis and use_advanced_search:
            print("Standard search failed, trying advanced fuzzy matching...")
            existing_analysis = self.advanced_search_company_analysis(company_name)
        
        if existing_analysis:
            return existing_analysis
        else:
            # Call another function for new analysis (placeholder)
            return self.create_new_analysis(company_name)
    
    def create_new_analysis(self, company_name: str) -> Optional[Dict[Any, Any]]:
        """
        Placeholder function for creating new analysis.
        You can implement your analysis logic here.
        
        Args:
            company_name (str): Name of the company to analyze
            
        Returns:
            Dict or None: New analysis data
        """
        # TODO: Implement your analysis logic here
        print(f"Creating new analysis for {company_name}")
        
        # Placeholder return - replace with your actual implementation
        return {
            "company_name": company_name,
            "status": "new_analysis_needed",
            "message": "Analysis logic to be implemented"
        }

# Alternative enhanced standalone functions

def normalize_company_name_standalone(company_name: str) -> str:
    """Standalone version of company name normalization."""
    if not company_name:
        return ""
    
    normalized = company_name.lower()
    normalized = unicodedata.normalize('NFD', normalized)
    normalized = ''.join(char for char in normalized if unicodedata.category(char) != 'Mn')
    normalized = re.sub(r'\s+', ' ', normalized).strip()
    
    return normalized

def enhanced_search_company_in_db(company_name: str, supabase_client: Client) -> Optional[Dict[Any, Any]]:
    """
    Enhanced standalone function to search for company analysis with robust matching.
    
    Args:
        company_name (str): Company name to search for
        supabase_client (Client): Initialized Supabase client
        
    Returns:
        Dict or None: Company data if found and recent
    """
    try:
        fourteen_days_ago = datetime.now() - timedelta(days=14)
        
        # Create multiple search patterns
        patterns = [
            company_name,  # Original
            normalize_company_name_standalone(company_name),  # Normalized
        ]
        
        # Add pattern without business terms
        normalized = normalize_company_name_standalone(company_name)
        clean_pattern = re.sub(
            r'\b(inc|corp|ltd|llc|co|company|the|a|an)\b|[.,;:!?(){}[\]"\'-]|\s*&\s*',
            ' ', normalized, flags=re.IGNORECASE
        )
        clean_pattern = re.sub(r'\s+', ' ', clean_pattern).strip()
        if clean_pattern:
            patterns.append(clean_pattern)
        
        all_results = []
        
        # Try each pattern
        for pattern in patterns:
            if not pattern:
                continue
                
            try:
                # Case-insensitive partial match
                response = supabase_client.table("analyses").select("*").ilike("company_name", f"%{pattern}%").execute()
                if response.data:
                    all_results.extend(response.data)
                
                # Exact match
                response = supabase_client.table("analyses").select("*").ilike("company_name", pattern).execute()
                if response.data:
                    all_results.extend(response.data)
                    
            except Exception as e:
                print(f"Search failed for pattern '{pattern}': {str(e)}")
        
        # Remove duplicates and check dates
        seen_ids = set()
        for record in all_results:
            record_id = record.get('id')
            if record_id in seen_ids:
                continue
            seen_ids.add(record_id)
            
            record_date = None
            if 'updated_at' in record and record['updated_at']:
                record_date = datetime.fromisoformat(record['updated_at'].replace('Z', '+00:00'))
            elif 'created_at' in record and record['created_at']:
                record_date = datetime.fromisoformat(record['created_at'].replace('Z', '+00:00'))
            
            if record_date and record_date >= fourteen_days_ago:
                return record
        
        return None
        
    except Exception as e:
        print(f"Error: {str(e)}")
        return None

def process_company_request_enhanced(company_name: str) -> Optional[Dict[Any, Any]]:
    """
    Enhanced main processing function for company analysis requests.
    
    Args:
        company_name (str): Company name to process
        
    Returns:
        Dict or None: Analysis results
    """
    # Initialize Supabase client
    supabase_url = "http://31.220.90.246:8000"
    supabase_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlhdCI6MTc1NTQzMjIxNywiZXhwIjoyMDcxMDA4MjE3fQ.Qf2p8BRKtoN2M7e5fdeRHgmkRA8w6bnk_s859SL_uO8"  # Replace with your actual key
    supabase = create_client(supabase_url, supabase_key)
    
    # Search for existing analysis
    existing_data = enhanced_search_company_in_db(company_name, supabase)
    
    if existing_data:
        return existing_data
    else:
        # TODO: Call your analysis function here
        print(f"Need to create new analysis for {company_name}")
        return None

# Example usage and testing
if __name__ == "__main__":
    # Test the normalization function
    test_companies = [
        "Apple Inc.",
        "MICROSOFT CORPORATION",
        "tesla, inc",
        "Alphabet Inc. (Google)",
        "Meta Platforms, Inc.",
        "amazon.com, inc.",
        "NVIDIA Corp",
        "Berkshire Hathaway Inc.",
        "Johnson & Johnson",
        "Procter & Gamble Co.",
        "Coca-Cola Company (The)",
        "AT&T Inc.",
        "Société Générale",
        "ASML Holding N.V.",
    ]
    
    print("Testing company name normalization:")
    service = CompanyAnalysisService()
    for company in test_companies:
        normalized = service.normalize_company_name(company)
        patterns = service.create_search_patterns(company)
        print(f"'{company}' -> '{normalized}'")
        print(f"  Patterns: {patterns[:3]}...")  # Show first 3 patterns
        print()
    
    # Test the actual search (uncomment when you have valid credentials)
    result = service.get_company_analysis("Hubspot")
    print(f"Search result: {result}")