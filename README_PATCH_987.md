# AZOBSSTV v987 — Current Mana-Mana Public EPG API Fix

Deep Inspector v5 exposed the current public EPG flow used by Mana-Mana itself:
- API base `https://co3y6iwoio.tenbytecdn.com/api/v1`
- `GET /channels/{slug}`
- `GET /public/epg?channel_id={id}&date=YYYY-MM-DD`
- `GET /public/epg/now?channelType=video`

The current `channel-detail` bundle first resolves the channel slug to an ID and then requests
the daily EPG with `channel_id` + Malaysia date. The current EPG-now code reads
`programme.title`, `programme.startTime` and `programme.endTime`.

v987 makes that public EPG flow the primary AZOBSSTV schedule source. `NOW PLAYING`
uses `/public/epg/now`, while `Today's Schedule` uses `/public/epg`. Synopsis/description
is deliberately discarded so only programme titles are returned.

Fallback order:
1. current Mana-Mana public EPG API
2. rendered DOM headless fallback
3. legacy Revlet fallback
4. HTML/Next.js fallback

No account cookie, subscriber token, stream token, DRM key or private credential is used.
Single official playback iframe remains unchanged, so no additional audio/player instance
is created by this patch.

Version: 1.0.987
