import urllib.request, json, os
from dotenv import load_dotenv
load_dotenv(".env", override=True)

token = os.environ["BUFFER_ACCESS_TOKEN"]

# Test Facebook channel
channel_id = "6a3f042c5ab6d2f10677b34a"
video_url   = "https://json2video-cdn1.s3.amazonaws.com/clients/INbZ7yeqDD/renders/2026-06-26-11425.mp4"

mutation = """
mutation CreatePost($input: CreatePostInput!) {
  createPost(input: $input) {
    ... on PostActionSuccess {
      post { id status dueAt }
    }
    ... on NotFoundError      { message }
    ... on UnauthorizedError  { message }
    ... on InvalidInputError  { message }
    ... on LimitReachedError  { message }
    ... on UnexpectedError    { message }
  }
}
"""
variables = {
    "input": {
        "channelId": channel_id,          # instagram channel
        "text": "Test post from AI pipeline #AItools #productivity",
        "schedulingType": "automatic",
        "dueAt": "2026-06-27T08:00:00.000Z",
        "mode": "customScheduled",
        "assets": [{"video": {"url": video_url}}],
        "metadata": {
            "facebook": {
                "type": "reel",
            }
        },
    }
}

payload = json.dumps({"query": mutation, "variables": variables}).encode()
req = urllib.request.Request(
    "https://api.buffer.com/graphql",
    data=payload,
    headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
)
try:
    resp = urllib.request.urlopen(req)
    r = json.loads(resp.read())
    if "errors" in r:
        print("GraphQL errors:")
        for e in r["errors"]:
            print(f"  {e['message']}")
    else:
        result = r["data"]["createPost"]
        if result.get("post"):
            post = result["post"]
            print(f"SUCCESS! Post ID: {post['id']}  Status: {post['status']}  DueAt: {post['dueAt']}")
        else:
            print(f"API error: {result.get('message', result)}")
except urllib.error.HTTPError as e:
    print(f"HTTP {e.code}: {e.read().decode()}")
