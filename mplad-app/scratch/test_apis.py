import urllib.request
import json
import traceback

def test_endpoint(url):
    print(f"Testing {url}...")
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response:
            status = response.getcode()
            body = response.read().decode('utf-8')
            print(f"  Status: {status}")
            try:
                data = json.loads(body)
                print(f"  Valid JSON returned. Keys: {list(data.keys())[:5] if isinstance(data, dict) else len(data)}")
            except json.JSONDecodeError:
                print(f"  Invalid JSON! Preview: {body[:100]}")
    except urllib.error.HTTPError as e:
        print(f"  HTTP Error: {e.code} - {e.reason}")
        print(f"  Body: {e.read().decode('utf-8')}")
    except Exception as e:
        print(f"  Exception: {e}")

if __name__ == '__main__':
    base_url = "http://localhost:3000"
    endpoints_to_test = [
        "/api/monitor",
        "/api/fraud",
        "/api/investigator",
        "/api/officers",
        "/api/public/works"
    ]
    
    for ep in endpoints_to_test:
        test_endpoint(base_url + ep)
