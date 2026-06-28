import urllib.request, json, os, sys
from dotenv import load_dotenv
load_dotenv(".env", override=True)

token = os.environ["BUFFER_ACCESS_TOKEN"]
org_id = "6a3edbf3f958f9474cd547e9"

def gql(query):
    data = json.dumps({"query": query}).encode()
    req = urllib.request.Request(
        "https://api.buffer.com/graphql",
        data=data,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    )
    try:
        resp = urllib.request.urlopen(req)
        return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        return {"_http_error": e.code, "_body": body}

# --- OAuth exchange if code passed as argument ---
if len(sys.argv) == 3 and sys.argv[1] == "exchange":
    code = sys.argv[2]
    client_id   = os.environ.get("BUFFER_CLIENT_ID", "")
    client_secret = os.environ.get("BUFFER_CLIENT_SECRET", "")
    data = urllib.parse.urlencode({
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": "https://localhost",
        "code": code,
        "grant_type": "authorization_code",
    }).encode()
    req = urllib.request.Request("https://api.buffer.com/oauth2/token", data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"})
    try:
        r = urllib.request.urlopen(req)
        print(json.loads(r.read()))
    except urllib.error.HTTPError as e:
        print(e.read().decode())
    sys.exit(0)

# --- Normal: list channels ---
print("=== Channels ===")
r = gql(f'{{ channels(input: {{ organizationId: "{org_id}" }}) {{ id service name serviceId }} }}')
channels = (r.get("data") or {}).get("channels", [])
if channels:
    for c in channels:
        print(f"  id={c['id']}  service={c['service']}  name={c['name']}")
else:
    print(f"  None found. Raw: {r}")

print("\n=== CreatePost mutation fields ===")
r2 = gql('{ __type(name: "CreatePostInput") { inputFields { name type { name kind ofType { name } } } } }')
for f in (r2.get("data") or {}).get("__type", {}).get("inputFields", []):
    t = f["type"]
    tname = t.get("name") or (t.get("ofType") or {}).get("name", "")
    req_marker = " *" if t["kind"] == "NON_NULL" else ""
    print(f"  {f['name']}: {tname}{req_marker}")
