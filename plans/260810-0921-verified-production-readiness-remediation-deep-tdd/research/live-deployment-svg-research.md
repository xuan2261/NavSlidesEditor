---
title: "Live, Deployment, and SVG Remediation Research"
status: completed
created: 2026-08-10
---

# Live, Deployment, and SVG Remediation Research

## Findings

- `live-rooms.js` authenticates only presenter membership. Remote and speaker
  self-assert the controller role using the public room code.
- `socket-handler.js` builds one notes-bearing metadata/HTML payload and emits it
  room-wide. Redacting metadata alone is insufficient because Reveal notes are
  embedded in HTML.
- Room creation already returns a one-time presenter capability and stores only a
  hash. Extend this established pattern rather than introducing identity/auth.
- `server.listen(port)` and Docker `3002:3002` make the no-auth service reachable
  beyond loopback when firewalls permit it. Host/Origin middleware is explicitly
  not authentication.
- SVG upload validates only the presence of an `<svg>` token, then raw static
  serving gives direct navigation the application origin.

## Selected Design

1. Issue independent presenter, remote, and speaker capabilities. Store hashes.
2. Use explicit roles and event predicates. Reject unknown roles.
3. Put privileged capability in the URL fragment; bare legacy links fail closed.
4. Generate notes-free viewer HTML and role-specific metadata.
5. Default Node/Electron to loopback. Docker publishes loopback while the
   container listens on all interfaces. LAN exposure is opt-in and requires auth.
6. Sanitize new SVG bytes with the existing DOMPurify/jsdom dependency and apply
   attachment/sandbox/nosniff serving policy to every SVG, including legacy files.

## Rejected Alternatives

- Room-code-only compatibility grace, because it preserves the vulnerability.
- Full RBAC/auth productization, because it exceeds the declared product model.
- Sanitization-only SVG defense, because legacy files would remain active.
- Changing only Docker publication or only Node bind, because each runtime has a
  distinct exposure boundary.

## Test Strategy

- Unit: token hashing, role joins, event matrix, payload redaction, URL fragments,
  bind host policy, SVG sanitizer and response headers.
- Integration: actual live router/socket joins; actual upload/static middleware.
- Browser: viewer note canaries absent; direct SVG navigation cannot execute;
  passive SVG image still renders.
- Contract: Docker and Electron remain intentionally loopback-safe.

## Unresolved Questions

None.
