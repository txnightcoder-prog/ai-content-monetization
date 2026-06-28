import urllib.request, json, os
from dotenv import load_dotenv
load_dotenv(".env", override=True)
token = os.environ["BUFFER_ACCESS_TOKEN"]

def gql(query):
    data = json.dumps({"query": query}).encode()
    req = urllib.request.Request("https://api.buffer.com/graphql", data=data,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    try:
        r = urllib.request.urlopen(req)
        return json.loads(r.read())
    except urllib.error.HTTPError as e:
        return {"_err": e.code, "_body": e.read().decode()}

# What types does createPost return?
r = gql('{ __type(name: "PostActionPayload") { kind possibleTypes { name } } }')
print("PostActionPayload possible types:", r)

r2 = gql('{ __type(name: "PostActionSuccess") { fields { name type { name kind } } } }')
print("\nPostActionSuccess fields:")
for f in (r2.get("data") or {}).get("__type", {}).get("fields", []):
    print(f"  {f['name']}: {f['type']['name']} ({f['type']['kind']})")

r3 = gql('{ __type(name: "Post") { fields { name type { name kind } } } }')
print("\nPost fields (first 15):")
for f in (r3.get("data") or {}).get("__type", {}).get("fields", [])[:15]:
    print(f"  {f['name']}: {f['type']['name']} ({f['type']['kind']})")
