import urllib.request, json, os
from dotenv import load_dotenv
load_dotenv(".env", override=True)
token = os.environ["BUFFER_ACCESS_TOKEN"]

def gql(q):
    d = json.dumps({"query": q}).encode()
    req = urllib.request.Request("https://api.buffer.com/graphql", data=d,
        headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"})
    return json.loads(urllib.request.urlopen(req).read())

for name in ["PostType", "PostTypeFacebook"]:
    r = gql('{ __type(name: "' + name + '") { enumValues { name } } }')
    t = r["data"]["__type"]
    print(name, ":", [v["name"] for v in t["enumValues"]])
