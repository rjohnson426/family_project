# IN family facial recognition local deployment

Date: 2026-10-19. Exported from a local Claude chat in the old workspace folder.

**Rob:** IN family facial recognition, can you deploy and open in local?

**Claude:** "Deploy" here means running it locally. This project is local-only on purpose and has no hosted version. Starting the review UI now.

**Claude:** Server's up. Your saved preference is to open sites in Chrome, so I'll open it there too.

**Claude:** The Family Faces review UI is running at **http://localhost:5050** and is open in a Chrome tab. It loaded fine and shows 362 people and groups, 2,410 unmatched single faces, 426 photos with no people, 98 photos needing review and 897 skipped.

I didn't deploy it anywhere online. The project's notes say it stays local on purpose, so the photos and the database never leave your Mac.

The server keeps running from the `face-review` launch config in this session. It stops if you stop it or close the session.

