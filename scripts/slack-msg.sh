#!/bin/bash

SLACK_CHANNEL_ID="C0948FPCD8W" # some slack channel id
COMMIT_SHA_SHORT=$(echo "$ORIGINAL_COMMIT_SHA" | cut -c1-7)

if [ "$JOB_STATUS" == "success" ]; then
  STATUS_COLOR="good"
  STATUS_TEXT=":green: *build passed*"
else 
  STATUS_COLOR="danger"
  STATUS_TEXT=":pay_respects: *Build Failed*"
fi

MESSAGE_TITLE=$(echo "$MESSAGE" | head -n 1)
TITLE_LINK="https://github.com/${GITHUB_REPOSITORY}/commit/${ORIGINAL_COMMIT_SHA}"

# Determine target branch correctly for PRs and pushes
if [ -n "$GITHUB_BASE_REF" ]; then
  TARGET_BRANCH_NAME=$GITHUB_BASE_REF
else
  TARGET_BRANCH_NAME=$GITHUB_REF_NAME
fi

# Start with the mandatory fields (no leading comma on the first one)
FIELDS_JSON="
    { \"title\": \"Status\", \"value\": \"\`${JOB_STATUS}\`\", \"short\": true },
    { \"title\": \"Commit\", \"value\": \"<https://github.com/${GITHUB_REPOSITORY}/commit/${ORIGINAL_COMMIT_SHA}|${COMMIT_SHA_SHORT}>\", \"short\": true },
    { \"title\": \"Target Branch\", \"value\": \"\`${TARGET_BRANCH_NAME}\`\", \"short\": true }
"

if [ -n "$GITHUB_HEAD_REF" ]; then
  FIELDS_JSON="${FIELDS_JSON},
    { \"title\": \"Source Branch\", \"value\": \"\`${GITHUB_HEAD_REF}\`\", \"short\": true }"
fi

if [ -n "$PR_URL" ]; then
  TITLE_LINK=$PR_URL # Override the title link to point to the PR
  FIELDS_JSON="${FIELDS_JSON},
    { \"title\": \"Pull Request\", \"value\": \"<${PR_URL}|View PR>\", \"short\": false }"
fi

if [ -n "$RUN_URL" ]; then
  FIELDS_JSON="${FIELDS_JSON},
    { \"title\": \"Workflow Logs\", \"value\": \"<${RUN_URL}|View Run Details>\", \"short\": false }"
fi

if [ -n "$COMMIT_MESSAGE" ]; then
  FIELDS_JSON="${FIELDS_JSON},
    { \"title\": \"Commit Message\", \"value\": \"${COMMIT_MESSAGE}\", \"short\": false }"
fi

if [ "$JOB_STATUS" == "success" ] && [ -n "$ECR_IMAGE_URI" ]; then
  FIELDS_JSON="${FIELDS_JSON},
    { \"title\": \"Image URI\", \"value\": \"\`${ECR_IMAGE_URI}\`\", \"short\": false }"
fi

read -r -d '' JSON_PAYLOAD <<EOF
{
    "channel": "${SLACK_CHANNEL_ID}",
    "username": "${USERNAME}",
    "icon_emoji": "${ICON_EMOJI}",
    "attachments": [
        {
            "color": "${STATUS_COLOR}",
            "fallback": "CI/CD update for ${GITHUB_REPOSITORY}/${GITHUB_REF_NAME} completed.",
            "pretext": "${STATUS_TEXT}",
            "author_name": "${GITHUB_ACTOR}",
            "author_link": "https://github.com/${GITHUB_ACTOR}",
            "title": "${MESSAGE_TITLE}",
            "title_link": "${TITLE_LINK}",
            "fields": [
                ${FIELDS_JSON}
            ],
            "footer": "CI/CD notifications",
            "footer_icon": "https://cdn.betterttv.net/emote/61642387b63cc97ee6d5c5c4/2x.webp",
            "ts": $(date +%s)
        }
    ]
}
EOF

curl -X POST \
-H "Authorization: Bearer ${SLACK_BOT_TOKEN}" \
-H 'Content-type: application/json; charset=utf-8' \
-d "${JSON_PAYLOAD}" \
https://slack.com/api/chat.postMessage