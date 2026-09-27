import urllib.request
import urllib.parse
import json
import os
import ssl
from mimetypes import guess_type

# This script demonstrates how to fetch real-world MPLADS data (published as CSVs)
# and push it directly into your local database to test the AI.
# It uses your existing /api/ingest/csv endpoint, keeping the core project untouched.

def upload_to_api(csv_content, filename):
    url = 'http://localhost:3000/api/ingest/csv'
    
    # We use the fallback admin token defined in your route.js
    headers = {
        'x-admin-token': 'test-admin-token'
    }
    
    # Constructing a simple multipart/form-data request manually for the CSV
    boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW'
    headers['Content-Type'] = f'multipart/form-data; boundary={boundary}'
    
    body = (
        f"--{boundary}\r\n"
        f"Content-Disposition: form-data; name=\"file\"; filename=\"{filename}\"\r\n"
        f"Content-Type: text/csv\r\n\r\n"
        f"{csv_content}\r\n"
        f"--{boundary}--\r\n"
    ).encode('utf-8')
    
    try:
        # Bypass SSL verification if testing locally or with problematic open-data certs
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE

        req = urllib.request.Request(url, data=body, headers=headers, method='POST')
        print(f"Uploading {filename} to {url}...")
        
        with urllib.request.urlopen(req, context=ctx) as response:
            status = response.getcode()
            response_body = response.read().decode('utf-8')
            print(f"Status: {status}")
            print(f"Response: {response_body}")
            
    except urllib.error.HTTPError as e:
        print(f"Failed to upload. HTTP Error: {e.code}")
        print(f"Error Body: {e.read().decode('utf-8')}")
    except Exception as e:
        print(f"An error occurred: {e}")

def fetch_and_ingest_official_data(dataset_url, filename):
    print(f"Fetching official dataset from {dataset_url}...")
    try:
        # Example of fetching a CSV from an Open Data portal
        req = urllib.request.Request(dataset_url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response:
            csv_content = response.read().decode('utf-8')
            print(f"Successfully fetched {len(csv_content)} bytes of data.")
            upload_to_api(csv_content, filename)
    except Exception as e:
        print(f"Failed to fetch dataset: {e}")

if __name__ == '__main__':
    print("=== Official MPLADS Data Import Tool ===")
    # NOTE: Replace this URL with the actual CSV link from data.gov.in or Dataful
    # when you have the direct download link for the specific state/year you want to test.
    example_official_csv_url = "https://raw.githubusercontent.com/datasets/gdp/master/data/gdp.csv" # Placeholder
    
    # fetch_and_ingest_official_data(example_official_csv_url, "official_mplads_data.csv")
    
    print("Script is ready. To test the AI with real government data:")
    print("1. Find the CSV download link on an open data portal.")
    print("2. Replace 'example_official_csv_url' in this script with that link.")
    print("3. Run this script while your Next.js server is running.")
