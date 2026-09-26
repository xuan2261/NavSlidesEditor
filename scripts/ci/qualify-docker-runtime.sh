#!/usr/bin/env bash
set -euo pipefail

wait_for_server() {
  for attempt in $(seq 1 60); do
    if curl --fail --silent --show-error http://127.0.0.1:3002/ > /dev/null; then
      return 0
    fi
    sleep 1
  done
  return 1
}

wait_for_server
docker exec navslides-editor-ci node scripts/verify-runtime-closure.js --require-client-dist \
  | tee docker-runtime-closure.json
curl --fail --silent --show-error \
  http://127.0.0.1:3002/vendor/socket.io/socket.io.min.js \
  --output /tmp/socket.io.min.js
test -s /tmp/socket.io.min.js
curl --fail --silent --show-error http://127.0.0.1:3002/api/presentations \
  --output /tmp/presentations.json
jq -e 'type == "array"' /tmp/presentations.json > /dev/null

source_pptx=server/data/test-corpus/background-image-notes-footer.pptx
admission=$(curl --fail --silent --show-error \
  --form "file=@${source_pptx};type=application/vnd.openxmlformats-officedocument.presentationml.presentation" \
  http://127.0.0.1:3002/api/pptx/import)
job_id=$(jq -er '.jobId' <<<"$admission")
capability=$(jq -er '.capability' <<<"$admission")

presentation_id=''
for attempt in $(seq 1 120); do
  job=$(curl --fail --silent --show-error \
    --header "X-Pptx-Job-Capability: ${capability}" \
    "http://127.0.0.1:3002/api/pptx/jobs/${job_id}")
  status=$(jq -r '.status' <<<"$job")
  if [[ "$status" == 'done' ]]; then
    presentation_id=$(jq -er '.result.presentationId' <<<"$job")
    break
  fi
  if [[ "$status" == 'failed' || "$status" == 'cancelled' ]]; then
    jq . <<<"$job"
    exit 1
  fi
  sleep 1
done
test -n "$presentation_id"

source_sha=$(sha256sum "$source_pptx" | cut -d' ' -f1)
curl --fail --silent --show-error --dump-header /tmp/pptx-original.headers \
  "http://127.0.0.1:3002/api/presentations/${presentation_id}/pptx-original" \
  --output /tmp/pptx-original.pptx
cmp "$source_pptx" /tmp/pptx-original.pptx
tr -d '\r' < /tmp/pptx-original.headers \
  | grep -Fqi "x-pptx-original-sha256: ${source_sha}"

docker restart navslides-editor-ci
wait_for_server
curl --fail --silent --show-error \
  "http://127.0.0.1:3002/api/presentations/${presentation_id}" \
  --output /tmp/presentation-after-restart.json
jq -e --arg id "$presentation_id" '.id == $id' \
  /tmp/presentation-after-restart.json > /dev/null
curl --fail --silent --show-error \
  "http://127.0.0.1:3002/api/presentations/${presentation_id}/pptx-original" \
  --output /tmp/pptx-original-after-restart.pptx
cmp "$source_pptx" /tmp/pptx-original-after-restart.pptx
docker image inspect navslides-editor:ci > docker-image-inspect.json
