# AZOBSS Patch 858 — Sound Effects Admin-only Add Sound

- Baseline: (857)
- `/Sound-Effects/` `+ Add sound` is hidden by default and revealed only after Firebase/local AZOBSS session is verified as admin.
- Recognized admin accounts follow existing site conventions: `zedan91`, `zedan9107`, `zedan91@azobss.local`, `zedan9107@gmail.com`, or stored profile role `admin`.
- JavaScript guards protect Add, Save, Import, Export and Delete custom-sound actions from normal UI use.
- Normal visitors retain Play, Search, Filter, Share, Copy Link and Download.
- Existing 81 built-in sounds and custom catalog data remain unchanged.
