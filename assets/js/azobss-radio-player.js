/* AZOBSS Radio Player - compact floating radio widget
   Patch 372: Remove confirmed unavailable stations from the mini-player list.
*/
(function(){
  'use strict';
  if (window.__AZOBSS_RADIO_PLAYER_LOADED__) return;
  window.__AZOBSS_RADIO_PLAYER_LOADED__ = true;

  const STATIONS = [
    {
        "id": "era",
        "name": "ERA",
        "label": "⭐ ERA",
        "group": "Top Radio-Online.My",
        "country": "MY",
        "query": "Era FM",
        "aliases": [
            "ERA FM",
            "ERA Malaysia",
            "Era FM Malaysia",
            "Muzik Hit Terkini"
        ],
        "web": "https://radio-online.my/era"
    },
    {
        "id": "sinar",
        "name": "SINAR FM",
        "label": "⭐ SINAR FM",
        "group": "Top Radio-Online.My",
        "country": "MY",
        "query": "Sinar FM",
        "aliases": [
            "SINAR",
            "Radio Sinar FM",
            "Sinar Malaysia"
        ],
        "web": "https://radio-online.my/sinar-fm"
    },
    {
        "id": "raaga",
        "name": "THR Raaga",
        "label": "THR Raaga",
        "group": "Tamil / Indian",
        "country": "MY",
        "query": "THR Raaga",
        "aliases": [
            "RAAGA",
            "Raaga FM",
            "THR Raaga Malaysia"
        ],
        "web": "https://radio-online.my/thr-raaga"
    },
    {
        "id": "suria",
        "name": "Suria",
        "label": "⭐ Suria",
        "group": "Top Radio-Online.My",
        "country": "MY",
        "query": "Suria FM",
        "aliases": [
            "Suria Malaysia",
            "Suria FM"
        ],
        "web": "https://radio-online.my/suria"
    },
    {
        "id": "radioklasik",
        "name": "Radio Klasik",
        "label": "⭐ Radio Klasik",
        "group": "Top Radio-Online.My",
        "country": "MY",
        "query": "Radio Klasik",
        "aliases": [
            "Klasik Nasional",
            "Klasik FM",
            "RTM Klasik"
        ],
        "web": "https://radio-online.my/radio-klasik"
    },
    {
        "id": "sarawakfm",
        "name": "Sarawak FM",
        "label": "⭐ Sarawak FM",
        "group": "Top Radio-Online.My",
        "country": "MY",
        "query": "Sarawak FM",
        "aliases": [
            "RTM Sarawak FM",
            "Radio Sarawak"
        ],
        "web": "https://radio-online.my/sarawak-fm"
    },
    {
        "id": "gegar",
        "name": "THR Gegar",
        "label": "⭐ THR Gegar",
        "group": "Top Radio-Online.My",
        "country": "MY",
        "query": "THR Gegar",
        "aliases": [
            "GEGAR",
            "Gegar FM",
            "THR Gegar FM"
        ],
        "web": "https://radio-online.my/thr-gegar"
    },
    {
        "id": "astro_vani",
        "name": "Astro Vani",
        "label": "Astro Vani",
        "group": "Tamil / Indian",
        "country": "MY",
        "query": "Astro Vani",
        "aliases": [
            "Vani FM",
            "Vani Radio"
        ],
        "web": "https://radio-online.my/astro-vani"
    },
    {
        "id": "myfm",
        "name": "MY FM",
        "label": "MY FM",
        "group": "Chinese",
        "country": "MY",
        "query": "MY FM",
        "aliases": [
            "MyFM",
            "MY Malaysia"
        ],
        "web": "https://radio-online.my/my-fm"
    },
    {
        "id": "melody",
        "name": "Melody FM",
        "label": "Melody FM",
        "group": "Chinese",
        "country": "MY",
        "query": "Melody FM",
        "aliases": [
            "MELODY",
            "Melody Malaysia"
        ],
        "web": "https://radio-online.my/melody-fm"
    },
    {
        "id": "hotfm",
        "name": "Hot FM",
        "label": "⭐ Hot FM",
        "group": "Top Radio-Online.My",
        "country": "MY",
        "query": "Hot FM",
        "aliases": [
            "Hot FM Malaysia",
            "Dengar Hot FM",
            "HotFM"
        ],
        "web": "https://radio-online.my/hot-fm"
    },
    {
        "id": "minnalfm",
        "name": "Minnal FM",
        "label": "Minnal FM",
        "group": "Tamil / Indian",
        "country": "MY",
        "query": "Minnal FM",
        "aliases": [
            "RTM Minnal",
            "Radio Minnal"
        ],
        "web": "https://radio-online.my/minnal-fm"
    },
    {
        "id": "waifm",
        "name": "Wai FM",
        "label": "⭐ Wai FM",
        "group": "Top Radio-Online.My",
        "country": "MY",
        "query": "Wai FM",
        "aliases": [
            "RTM Wai FM",
            "Wai Iban",
            "Wai Bidayuh"
        ],
        "web": "https://radio-online.my/wai-fm"
    },
    {
        "id": "fm988",
        "name": "988 FM",
        "label": "988 FM",
        "group": "Chinese",
        "country": "MY",
        "query": "988 FM",
        "aliases": [
            "Radio 988",
            "988 Malaysia"
        ],
        "web": "https://radio-online.my/988-fm"
    },
    {
        "id": "bestfm",
        "name": "Best FM",
        "label": "⭐ Best FM",
        "group": "Top Radio-Online.My",
        "country": "MY",
        "query": "Best FM",
        "aliases": [
            "Best 104",
            "Best Radio"
        ],
        "web": "https://radio-online.my/best-fm"
    },
    {
        "id": "lite",
        "name": "Lite",
        "label": "⭐ Lite",
        "group": "Top Radio-Online.My",
        "country": "MY",
        "query": "Lite FM",
        "aliases": [
            "LITE",
            "Lite Malaysia"
        ],
        "web": "https://radio-online.my/lite"
    },
    {
        "id": "zayan",
        "name": "Zayan",
        "label": "⭐ Zayan",
        "group": "Top Radio-Online.My",
        "country": "MY",
        "query": "Zayan FM",
        "aliases": [
            "ZAYAN",
            "Zayan Malaysia"
        ],
        "web": "https://radio-online.my/zayan-fm"
    },
    {
        "id": "nasionalfm",
        "name": "Nasional FM",
        "label": "Nasional FM",
        "group": "Top Radio-Online.My",
        "country": "MY",
        "query": "Nasional FM",
        "aliases": [
            "RTM Nasional",
            "Radio Nasional"
        ],
        "web": "https://radio-online.my/nasional-fm"
    },
    {
        "id": "osai",
        "name": "Osai",
        "label": "Osai",
        "group": "Tamil / Indian",
        "country": "MY",
        "query": "Osai",
        "aliases": [
            "Osai FM",
            "Astro Osai"
        ],
        "web": "https://radio-online.my/osai"
    },
    {
        "id": "kool101",
        "name": "Kool 101",
        "label": "Kool 101",
        "group": "Top Radio-Online.My",
        "country": "MY",
        "query": "Kool 101",
        "aliases": [
            "Kool FM",
            "Kool Malaysia"
        ],
        "web": "https://radio-online.my/kool-101"
    },
    {
        "id": "aifm",
        "name": "Ai FM",
        "label": "Ai FM",
        "group": "Chinese",
        "country": "MY",
        "query": "Ai FM",
        "aliases": [
            "Radio Ai FM",
            "RTM Ai"
        ],
        "web": "https://radio-online.my/ai-fm"
    },
    {
        "id": "mix",
        "name": "Mix FM",
        "label": "Mix FM",
        "group": "Top Radio-Online.My",
        "country": "MY",
        "query": "Mix FM",
        "aliases": [
            "MIX",
            "Mix Malaysia"
        ],
        "web": "https://radio-online.my/mix-fm"
    },
    {
        "id": "kelantanfm",
        "name": "Kelantan FM",
        "label": "Kelantan FM",
        "group": "Top Radio-Online.My",
        "country": "MY",
        "query": "Kelantan FM",
        "aliases": [
            "RTM Kelantan"
        ],
        "web": "https://radio-online.my/kelantan-fm"
    },
    {
        "id": "hitz",
        "name": "Hitz",
        "label": "Hitz",
        "group": "Top Radio-Online.My",
        "country": "MY",
        "query": "Hitz FM",
        "aliases": [
            "HITZ",
            "Hitz Malaysia"
        ],
        "web": "https://radio-online.my/hitz"
    },
    {
        "id": "sabahfm",
        "name": "Sabah FM",
        "label": "Sabah FM",
        "group": "Top Radio-Online.My",
        "country": "MY",
        "query": "Sabah FM",
        "aliases": [
            "RTM Sabah FM",
            "Radio Sabah"
        ],
        "web": "https://radio-online.my/sabah-fm"
    },
    {
        "id": "oli968",
        "name": "Oli 96.8",
        "label": "Oli 96.8",
        "group": "Nearby / Online",
        "country": "SG",
        "query": "Oli 96.8",
        "aliases": [
            "Oli 968",
            "Oli FM"
        ],
        "web": "https://radio-online.my/oli-968"
    },
    {
        "id": "flyfm",
        "name": "Fly FM",
        "label": "Fly FM",
        "group": "Top Radio-Online.My",
        "country": "MY",
        "query": "Fly FM",
        "aliases": [
            "Fly Malaysia"
        ],
        "web": "https://radio-online.my/fly-fm"
    },
    {
        "id": "johorfm",
        "name": "Johor FM",
        "label": "Johor FM",
        "group": "RTM Negeri",
        "country": "MY",
        "query": "Johor FM",
        "aliases": [
            "RTM Johor"
        ],
        "web": "https://radio-online.my/johor-fm"
    },
    {
        "id": "klfm",
        "name": "KL FM",
        "label": "KL FM",
        "group": "RTM Negeri",
        "country": "MY",
        "query": "KL FM",
        "aliases": [
            "RTM KL FM",
            "Kuala Lumpur FM"
        ],
        "web": "https://radio-online.my/kl-fm"
    },
    {
        "id": "kedahfm",
        "name": "Kedah FM",
        "label": "Kedah FM",
        "group": "RTM Negeri",
        "country": "MY",
        "query": "Kedah FM",
        "aliases": [
            "RTM Kedah"
        ],
        "web": "https://radio-online.my/kedah-fm"
    },
    {
        "id": "perakfm",
        "name": "Perak FM",
        "label": "Perak FM",
        "group": "RTM Negeri",
        "country": "MY",
        "query": "Perak FM",
        "aliases": [
            "RTM Perak"
        ],
        "web": "https://radio-online.my/perak-fm"
    },
    {
        "id": "tawaufm",
        "name": "Tawau FM",
        "label": "Tawau FM",
        "group": "Sabah / Sarawak",
        "country": "MY",
        "query": "Tawau FM",
        "aliases": [
            "RTM Tawau"
        ],
        "web": "https://radio-online.my/tawau-fm"
    },
    {
        "id": "sabahvfm",
        "name": "Sabah VFM",
        "label": "Sabah VFM",
        "group": "Sabah / Sarawak",
        "country": "MY",
        "query": "Sabah VFM",
        "aliases": [
            "RTM Sabah VFM",
            "Sabah V FM"
        ],
        "web": "https://radio-online.my/sabah-vfm"
    },
    {
        "id": "molekfm",
        "name": "Molek FM",
        "label": "Molek FM",
        "group": "News / Local",
        "country": "MY",
        "query": "Molek FM",
        "aliases": [
            "Molek Radio"
        ],
        "web": "https://radio-online.my/molek-fm"
    },
    {
        "id": "manisfm",
        "name": "Manis FM",
        "label": "Manis FM",
        "group": "News / Local",
        "country": "MY",
        "query": "Manis FM",
        "aliases": [
            "Manis Radio"
        ],
        "web": "https://radio-online.my/manis-fm"
    },
    {
        "id": "traxx",
        "name": "TraXX",
        "label": "TraXX",
        "group": "English",
        "country": "MY",
        "query": "TraXX FM",
        "aliases": [
            "Traxx",
            "RTM Traxx"
        ],
        "web": "https://radio-online.my/traxx"
    },
    {
        "id": "eightfm",
        "name": "Eight FM",
        "label": "Eight FM",
        "group": "News / Local",
        "country": "MY",
        "query": "Eight FM",
        "aliases": [
            "8FM",
            "Eight Radio",
            "8 FM Malaysia"
        ],
        "web": "https://radio-online.my/eight-fm"
    },
    {
        "id": "catsfm",
        "name": "Cats FM",
        "label": "Cats FM",
        "group": "News / Local",
        "country": "MY",
        "query": "Cats FM",
        "aliases": [
            "Cats Radio",
            "Cats FM Malaysia"
        ],
        "web": "https://radio-online.my/cats-fm"
    },
    {
        "id": "era_sabah",
        "name": "Era FM Sabah",
        "label": "Era FM Sabah",
        "group": "Sabah / Sarawak",
        "country": "MY",
        "query": "Era Sabah",
        "aliases": [
            "ERA Sabah",
            "Era FM Sabah"
        ],
        "web": "https://radio-online.my/era-fm-sabah"
    },
    {
        "id": "era_sarawak",
        "name": "Era FM Sarawak",
        "label": "Era FM Sarawak",
        "group": "Sabah / Sarawak",
        "country": "MY",
        "query": "Era Sarawak",
        "aliases": [
            "ERA Sarawak",
            "Era FM Sarawak"
        ],
        "web": "https://radio-online.my/era-fm-sarawak"
    },
    {
        "id": "selangorfm",
        "name": "Selangor FM",
        "label": "Selangor FM",
        "group": "RTM Negeri",
        "country": "MY",
        "query": "Selangor FM",
        "aliases": [
            "RTM Selangor"
        ],
        "web": "https://radio-online.my/selangor-fm"
    },
    {
        "id": "pahangfm",
        "name": "Pahang FM",
        "label": "Pahang FM",
        "group": "RTM Negeri",
        "country": "MY",
        "query": "Pahang FM",
        "aliases": [
            "RTM Pahang"
        ],
        "web": "https://radio-online.my/pahang-fm"
    },
    {
        "id": "negerifm",
        "name": "Negeri FM",
        "label": "Negeri FM",
        "group": "RTM Negeri",
        "country": "MY",
        "query": "Negeri FM",
        "aliases": [
            "Negeri Sembilan FM",
            "RTM Negeri"
        ],
        "web": "https://radio-online.my/negeri-fm"
    },
    {
        "id": "goxuan",
        "name": "GoXuan",
        "label": "GoXuan",
        "group": "Chinese",
        "country": "MY",
        "query": "GoXuan",
        "aliases": [
            "GOXUAN",
            "Go Xuan",
            "GoXuan FM"
        ],
        "web": "https://radio-online.my/goxuan"
    },
    {
        "id": "terengganufm",
        "name": "Terengganu FM",
        "label": "Terengganu FM",
        "group": "RTM Negeri",
        "country": "MY",
        "query": "Terengganu FM",
        "aliases": [
            "RTM Terengganu"
        ],
        "web": "https://radio-online.my/terengganu-fm"
    },
    {
        "id": "mutiarafm",
        "name": "Mutiara FM",
        "label": "Mutiara FM",
        "group": "RTM Negeri",
        "country": "MY",
        "query": "Mutiara FM",
        "aliases": [
            "RTM Mutiara",
            "Penang Mutiara FM"
        ],
        "web": "https://radio-online.my/mutiara-fm"
    },
    {
        "id": "melakafm",
        "name": "Melaka FM",
        "label": "Melaka FM",
        "group": "RTM Negeri",
        "country": "MY",
        "query": "Melaka FM",
        "aliases": [
            "RTM Melaka"
        ],
        "web": "https://radio-online.my/melaka-fm"
    },
    {
        "id": "perlisfm",
        "name": "Perlis FM",
        "label": "Perlis FM",
        "group": "RTM Negeri",
        "country": "MY",
        "query": "Perlis FM",
        "aliases": [
            "RTM Perlis"
        ],
        "web": "https://radio-online.my/perlis-fm"
    },
    {
        "id": "kristalfm",
        "name": "Kristal FM",
        "label": "Kristal FM",
        "group": "More from Radio-Online.My",
        "country": "MY",
        "query": "Kristal FM",
        "aliases": [
            "Kristal Radio"
        ],
        "web": "https://radio-online.my/kristal-fm"
    },
    {
        "id": "kupikupifm",
        "name": "Kupi-Kupi FM Sabah",
        "label": "Kupi-Kupi FM Sabah",
        "group": "More from Radio-Online.My",
        "country": "MY",
        "query": "Kupi-Kupi FM Sabah",
        "aliases": [
            "Kupi Kupi FM",
            "Kupi-Kupi FM"
        ],
        "web": "https://radio-online.my/kupi-kupi-fm-sabah"
    },
    {
        "id": "alam_seni",
        "name": "Alam Seni",
        "label": "Alam Seni",
        "group": "More from Radio-Online.My",
        "country": "MY",
        "query": "Alam Seni",
        "aliases": [
            "Alam Seni FM"
        ],
        "web": "https://radio-online.my/alam-seni"
    },
    {
        "id": "india_beat",
        "name": "India Beat",
        "label": "India Beat",
        "group": "More from Radio-Online.My",
        "country": "MY",
        "query": "India Beat",
        "aliases": [
            "Astro India Beat"
        ],
        "web": "https://radio-online.my/india-beat"
    },
    {
        "id": "redfm",
        "name": "Red FM",
        "label": "Red FM",
        "group": "More from Radio-Online.My",
        "country": "MY",
        "query": "Red FM",
        "aliases": [
            "Red FM Malaysia"
        ],
        "web": "https://radio-online.my/red-fm"
    },
    {
        "id": "sandakanfm",
        "name": "Sandakan FM",
        "label": "Sandakan FM",
        "group": "Sabah / Sarawak",
        "country": "MY",
        "query": "Sandakan FM",
        "aliases": [
            "RTM Sandakan"
        ],
        "web": "https://radio-online.my/sandakan-fm"
    },
    {
        "id": "radio_lagenda",
        "name": "Radio Lagenda",
        "label": "Radio Lagenda",
        "group": "More from Radio-Online.My",
        "country": "MY",
        "query": "Radio Lagenda",
        "aliases": [
            "Lagenda Radio"
        ],
        "web": "https://radio-online.my/radio-lagenda"
    },
    {
        "id": "ila",
        "name": "ILA",
        "label": "ILA",
        "group": "More from Radio-Online.My",
        "country": "MY",
        "query": "ILA",
        "aliases": [
            "ILA FM"
        ],
        "web": "https://radio-online.my/ila"
    },
    {
        "id": "asyikfm",
        "name": "Asyik FM",
        "label": "Asyik FM",
        "group": "RTM Negeri",
        "country": "MY",
        "query": "Asyik FM",
        "aliases": [
            "RTM Asyik"
        ],
        "web": "https://radio-online.my/asyik-fm"
    },
    {
        "id": "labuanfm",
        "name": "Labuan FM",
        "label": "Labuan FM",
        "group": "Sabah / Sarawak",
        "country": "MY",
        "query": "Labuan FM",
        "aliases": [
            "RTM Labuan"
        ],
        "web": "https://radio-online.my/labuan-fm"
    },
    {
        "id": "kenyalang",
        "name": "Kenyalang",
        "label": "Kenyalang",
        "group": "Sabah / Sarawak",
        "country": "MY",
        "query": "Kenyalang",
        "aliases": [
            "Kenyalang FM",
            "Astro Kenyalang"
        ],
        "web": "https://radio-online.my/kenyalang"
    },
    {
        "id": "gemersik",
        "name": "Gemersik",
        "label": "Gemersik",
        "group": "More from Radio-Online.My",
        "country": "MY",
        "query": "Gemersik",
        "aliases": [
            "Gemersik FM"
        ],
        "web": "https://radio-online.my/gemersik"
    },
    {
        "id": "gegar_muzik",
        "name": "Gegar Muzik FM",
        "label": "Gegar Muzik FM",
        "group": "Astro / Theme Channels",
        "country": "MY",
        "query": "Gegar Muzik FM",
        "aliases": [
            "Gegar Muzik"
        ],
        "web": "https://radio-online.my/gegar-muzik-fm"
    },
    {
        "id": "bayufm",
        "name": "Bayu FM",
        "label": "Bayu FM",
        "group": "Sabah / Sarawak",
        "country": "MY",
        "query": "Bayu FM",
        "aliases": [
            "Astro Bayu"
        ],
        "web": "https://radio-online.my/bayu-fm"
    },
    {
        "id": "myfriendsfm",
        "name": "MyFriends FM",
        "label": "MyFriends FM",
        "group": "More from Radio-Online.My",
        "country": "MY",
        "query": "MyFriends FM",
        "aliases": [
            "My Friends FM"
        ],
        "web": "https://radio-online.my/myfriends-fm"
    },
    {
        "id": "impian",
        "name": "Impian",
        "label": "Impian",
        "group": "More from Radio-Online.My",
        "country": "MY",
        "query": "Impian",
        "aliases": [
            "Impian FM"
        ],
        "web": "https://radio-online.my/impian"
    },
    {
        "id": "pelangifm",
        "name": "Pelangi FM",
        "label": "Pelangi FM",
        "group": "More from Radio-Online.My",
        "country": "MY",
        "query": "Pelangi FM",
        "aliases": [
            "Pelangi Radio"
        ],
        "web": "https://radio-online.my/pelangi-fm"
    },
    {
        "id": "teafm",
        "name": "Tea FM",
        "label": "Tea FM",
        "group": "More from Radio-Online.My",
        "country": "MY",
        "query": "Tea FM",
        "aliases": [
            "TEA FM"
        ],
        "web": "https://radio-online.my/tea-fm"
    },
    {
        "id": "langkawifm",
        "name": "Langkawi FM",
        "label": "Langkawi FM",
        "group": "RTM Negeri",
        "country": "MY",
        "query": "Langkawi FM",
        "aliases": [
            "RTM Langkawi"
        ],
        "web": "https://radio-online.my/langkawi-fm"
    },
    {
        "id": "iras",
        "name": "Iras",
        "label": "Iras",
        "group": "More from Radio-Online.My",
        "country": "MY",
        "query": "Iras",
        "aliases": [
            "Iras FM"
        ],
        "web": "https://radio-online.my/iras"
    },
    {
        "id": "sinar_rock_kapak",
        "name": "Sinar Rock Kapak",
        "label": "Sinar Rock Kapak",
        "group": "Astro / Theme Channels",
        "country": "MY",
        "query": "Sinar Rock Kapak",
        "aliases": [
            "Sinar Rock",
            "Rock Kapak"
        ],
        "web": "https://radio-online.my/sinar-rock-kapak"
    },
    {
        "id": "sinar_jiwang",
        "name": "Sinar Jiwang",
        "label": "Sinar Jiwang",
        "group": "Astro / Theme Channels",
        "country": "MY",
        "query": "Sinar Jiwang",
        "aliases": [
            "Sinar FM Jiwang"
        ],
        "web": "https://radio-online.my/sinar-jiwang"
    },
    {
        "id": "sinar_imusik",
        "name": "Sinar I-Musik",
        "label": "Sinar I-Musik",
        "group": "Astro / Theme Channels",
        "country": "MY",
        "query": "Sinar I-Musik",
        "aliases": [
            "Sinar Imusik",
            "Sinar iMusik"
        ],
        "web": "https://radio-online.my/sinar-i-musik"
    },
    {
        "id": "sinar_pop_yeh_yeh",
        "name": "Sinar Pop Yeh Yeh",
        "label": "Sinar Pop Yeh Yeh",
        "group": "Astro / Theme Channels",
        "country": "MY",
        "query": "Sinar Pop Yeh Yeh",
        "aliases": [
            "Sinar Pop Yeh-Yeh"
        ],
        "web": "https://radio-online.my/sinar-pop-yeh-yeh"
    },
    {
        "id": "zayan_nasheed",
        "name": "Zayan Nasyeed",
        "label": "Zayan Nasyeed",
        "group": "Astro / Theme Channels",
        "country": "MY",
        "query": "Zayan Nasyeed",
        "aliases": [
            "Zayan Nasyid",
            "Zayan Nasheed"
        ],
        "web": "https://radio-online.my/zayan-nasyeed"
    },
    {
        "id": "zayan_surah",
        "name": "Zayan Surah",
        "label": "Zayan Surah",
        "group": "Astro / Theme Channels",
        "country": "MY",
        "query": "Zayan Surah",
        "aliases": [
            "Zayan Quran",
            "Zayan Al Quran"
        ],
        "web": "https://radio-online.my/zayan-surah"
    },
    {
        "id": "zayan_almusika",
        "name": "Zayan Almusika",
        "label": "Zayan Almusika",
        "group": "Astro / Theme Channels",
        "country": "MY",
        "query": "Zayan Almusika",
        "aliases": [
            "Zayan Al Musika"
        ],
        "web": "https://radio-online.my/zayan-almusika"
    },
    {
        "id": "hitz_sabah",
        "name": "Hitz FM Sabah",
        "label": "Hitz FM Sabah",
        "group": "Sabah / Sarawak",
        "country": "MY",
        "query": "Hitz FM Sabah",
        "aliases": [
            "HITZ Sabah"
        ],
        "web": "https://radio-online.my/hitz-fm-sabah"
    },
    {
        "id": "hitz_sarawak",
        "name": "Hitz FM Sarawak",
        "label": "Hitz FM Sarawak",
        "group": "Sabah / Sarawak",
        "country": "MY",
        "query": "Hitz FM Sarawak",
        "aliases": [
            "HITZ Sarawak"
        ],
        "web": "https://radio-online.my/hitz-fm-sarawak"
    },
    {
        "id": "hitz_kpop",
        "name": "Hitz KPOP",
        "label": "Hitz KPOP",
        "group": "Astro / Theme Channels",
        "country": "MY",
        "query": "Hitz KPOP",
        "aliases": [
            "HITZ K-POP",
            "Hitz K Pop"
        ],
        "web": "https://radio-online.my/hitz-kpop"
    },
    {
        "id": "hitz_stage",
        "name": "Hitz Stage",
        "label": "Hitz Stage",
        "group": "Astro / Theme Channels",
        "country": "MY",
        "query": "Hitz Stage",
        "aliases": [
            "HITZ Stage"
        ],
        "web": "https://radio-online.my/hitz-stage"
    },
    {
        "id": "hitz_dance",
        "name": "Hitz Dance",
        "label": "Hitz Dance",
        "group": "Astro / Theme Channels",
        "country": "MY",
        "query": "Hitz Dance",
        "aliases": [
            "HITZ Dance"
        ],
        "web": "https://radio-online.my/hitz-dance"
    },
    {
        "id": "hitz_throwback",
        "name": "Hitz Throwback",
        "label": "Hitz Throwback",
        "group": "Astro / Theme Channels",
        "country": "MY",
        "query": "Hitz Throwback",
        "aliases": [
            "HITZ Throwback"
        ],
        "web": "https://radio-online.my/hitz-throwback"
    },
    {
        "id": "hitz_chillest",
        "name": "Hitz Chillest",
        "label": "Hitz Chillest",
        "group": "Astro / Theme Channels",
        "country": "MY",
        "query": "Hitz Chillest",
        "aliases": [
            "HITZ Chillest"
        ],
        "web": "https://radio-online.my/hitz-chillest"
    },
    {
        "id": "hitz_top40",
        "name": "Hitz Top40",
        "label": "Hitz Top40",
        "group": "Astro / Theme Channels",
        "country": "MY",
        "query": "Hitz Top40",
        "aliases": [
            "HITZ Top 40"
        ],
        "web": "https://radio-online.my/hitz-top40"
    },
    {
        "id": "hitz_urban",
        "name": "Hitz Urban",
        "label": "Hitz Urban",
        "group": "Astro / Theme Channels",
        "country": "MY",
        "query": "Hitz Urban",
        "aliases": [
            "HITZ Urban"
        ],
        "web": "https://radio-online.my/hitz-urban"
    },
    {
        "id": "hitz_local",
        "name": "Hitz Local",
        "label": "Hitz Local",
        "group": "Astro / Theme Channels",
        "country": "MY",
        "query": "Hitz Local",
        "aliases": [
            "HITZ Local"
        ],
        "web": "https://radio-online.my/hitz-local"
    },
    {
        "id": "melody_chi_90",
        "name": "Melody Chi Classic 90",
        "label": "Melody Chi Classic 90",
        "group": "Astro / Theme Channels",
        "country": "MY",
        "query": "Melody Chi Classic 90",
        "aliases": [
            "Melody Classic 90",
            "Melody 90s"
        ],
        "web": "https://radio-online.my/melody-chi-classic-90"
    },
    {
        "id": "melody_chi_80",
        "name": "Melody Chi Classic 80",
        "label": "Melody Chi Classic 80",
        "group": "Astro / Theme Channels",
        "country": "MY",
        "query": "Melody Chi Classic 80",
        "aliases": [
            "Melody Classic 80",
            "Melody 80s"
        ],
        "web": "https://radio-online.my/melody-chi-classic-80"
    },
    {
        "id": "melody_chi_ost",
        "name": "Melody Chi Classic OST",
        "label": "Melody Chi Classic OST",
        "group": "Astro / Theme Channels",
        "country": "MY",
        "query": "Melody Chi Classic OST",
        "aliases": [
            "Melody OST"
        ],
        "web": "https://radio-online.my/melody-chi-classic-ost"
    },
    {
        "id": "raaga_evergreen_80",
        "name": "Raaga Evergreen 80s",
        "label": "Raaga Evergreen 80s",
        "group": "Astro / Theme Channels",
        "country": "MY",
        "query": "Raaga Evergreen 80",
        "aliases": [
            "Raaga Evergreen 80s",
            "Raaga Evergreen 80's"
        ],
        "web": "https://radio-online.my/raaga-evergreen-80s"
    },
    {
        "id": "raaga_90s",
        "name": "Raaga 90s Hits",
        "label": "Raaga 90s Hits",
        "group": "Astro / Theme Channels",
        "country": "MY",
        "query": "Raaga 90s Hits",
        "aliases": [
            "Raaga 90's Hits",
            "Raaga 90s"
        ],
        "web": "https://radio-online.my/raaga-90s-hits"
    },
    {
        "id": "raaga_puthu",
        "name": "Raaga Puthu Varavu",
        "label": "Raaga Puthu Varavu",
        "group": "Astro / Theme Channels",
        "country": "MY",
        "query": "Raaga Puthu Varavu",
        "aliases": [
            "Raaga Puthu"
        ],
        "web": "https://radio-online.my/raaga-puthu-varavu"
    },
    {
        "id": "opusfm",
        "name": "Opus FM",
        "label": "Opus FM",
        "group": "Astro / Theme Channels",
        "country": "MY",
        "query": "Opus FM",
        "aliases": [
            "Astro Opus"
        ],
        "web": "https://radio-online.my/opus-fm"
    },
    {
        "id": "amboifm",
        "name": "Amboi FM",
        "label": "Amboi FM",
        "group": "More from Radio-Online.My",
        "country": "MY",
        "query": "Amboi FM",
        "aliases": [
            "Amboi Radio"
        ],
        "web": "https://radio-online.my/amboi-fm"
    },
    {
        "id": "bfm",
        "name": "BFM 89.9",
        "label": "BFM 89.9",
        "group": "News / Local",
        "country": "MY",
        "query": "BFM 89.9",
        "aliases": [
            "BFM Radio",
            "BFM Malaysia"
        ],
        "web": "https://radio-online.my/bfm-899"
    },
    {
        "id": "cityplus",
        "name": "CITYPlus",
        "label": "CITYPlus",
        "group": "Chinese",
        "country": "MY",
        "query": "CITYPlus",
        "aliases": [
            "CityPlus FM",
            "City Plus FM"
        ],
        "web": "https://radio-online.my/cityplus"
    },
    {
        "id": "rakita",
        "name": "Rakita",
        "label": "Rakita",
        "group": "News / Local",
        "country": "MY",
        "query": "Rakita",
        "aliases": [
            "Rakita Radio"
        ],
        "web": "https://radio-online.my/rakita"
    },
    {
        "id": "custom",
        "name": "Custom URL",
        "label": "Custom URL",
        "group": "Custom",
        "country": "",
        "query": "",
        "aliases": [],
        "web": ""
    }
];
  const API_BASES = [
    'https://de1.api.radio-browser.info/json/stations/search',
    'https://nl1.api.radio-browser.info/json/stations/search',
    'https://at1.api.radio-browser.info/json/stations/search'
  ];

  const STORE_KEY = 'azobss_radio_player_v1';
  const CACHE_PREFIX = 'azobss_radio_stream_cache_';
  const CACHE_TTL = 24 * 60 * 60 * 1000;
  const BROKEN_KEY = 'azobss_radio_unavailable_station_v2';
  // v1033: once a station is confirmed unavailable, remove it from the visible
  // mini-player catalogue for 7 days. This avoids repeatedly showing channels
  // that resolve to no stream or whose complete failover set cannot play.
  // The expiry still lets a station return automatically if its stream comes back.
  const BROKEN_TTL = 7 * 24 * 60 * 60 * 1000;

  function esc(s){
    return String(s == null ? '' : s).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  }
  function readBrokenMap(){
    try{
      const raw = JSON.parse(localStorage.getItem(BROKEN_KEY) || '{}') || {};
      const now = Date.now();
      let changed = false;
      Object.keys(raw).forEach(k => { if(!raw[k] || now - Number(raw[k] || 0) > BROKEN_TTL){ delete raw[k]; changed = true; } });
      if(changed) localStorage.setItem(BROKEN_KEY, JSON.stringify(raw));
      return raw;
    }catch(e){ return {}; }
  }
  function isStationBroken(id){ return !!readBrokenMap()[id]; }
  function markStationBroken(id){
    if(!id || id === 'custom') return;
    try{ const raw = readBrokenMap(); raw[id] = Date.now(); localStorage.setItem(BROKEN_KEY, JSON.stringify(raw)); }catch(e){}
  }
  function clearStationBroken(id){
    if(!id) return;
    try{ const raw = readBrokenMap(); if(raw[id]){ delete raw[id]; localStorage.setItem(BROKEN_KEY, JSON.stringify(raw)); } }catch(e){}
  }
  function refreshBrokenStationUi(){ try{ window.dispatchEvent(new CustomEvent('azobss-radio-broken-list-changed')); }catch(e){} }
  function renderStationOptions(selected, keyword){
    const q = String(keyword || '').trim().toLowerCase();
    const rows = STATIONS.filter(st => {
      if(st.id !== 'custom' && isStationBroken(st.id)) return false;
      if(!q) return true;
      return [st.name, st.label, st.group, st.query, st.id, ...(Array.isArray(st.aliases) ? st.aliases : [])].join(' ').toLowerCase().includes(q);
    });
    const groups = [];
    rows.forEach(st => {
      const g = st.group || 'Other';
      let bucket = groups.find(x => x.group === g);
      if(!bucket){ bucket = {group:g, items:[]}; groups.push(bucket); }
      bucket.items.push(st);
    });
    const groupOrder = [
      'Top Radio-Online.My',
      'English',
      'RTM Negeri',
      'Sabah / Sarawak',
      'News / Local',
      'Chinese',
      'Tamil / Indian',
      'Astro / Theme Channels',
      'More from Radio-Online.My',
      'Nearby / Online',
      'Custom'
    ];
    groups.sort((a,b) => {
      const ia = groupOrder.indexOf(a.group);
      const ib = groupOrder.indexOf(b.group);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
    if(!groups.length){
      return '<option value="custom">No matching channel - Custom URL</option>';
    }
    return groups.map(g => `<optgroup label="${esc(g.group)}">${g.items.map(st => `<option value="${esc(st.id)}" ${st.id===selected?'selected':''}>${esc(st.label)}</option>`).join('')}</optgroup>`).join('');
  }
  function readStore(){ try { return JSON.parse(localStorage.getItem(STORE_KEY)||'{}') || {}; } catch(e){ return {}; } }
  function writeStore(v){ try { localStorage.setItem(STORE_KEY, JSON.stringify(v||{})); } catch(e){} }
  function patchStore(fn){
    const s = readStore();
    const next = fn ? (fn(s) || s) : s;
    writeStore(next);
    return next;
  }
  function isInternalAzobssLink(a){
    try{
      if(!a || !a.href) return false;
      const u = new URL(a.href, location.href);
      if(u.origin !== location.origin) return false;
      if(a.target && a.target !== '_self') return false;
      if(a.hasAttribute('download')) return false;
      return true;
    }catch(e){ return false; }
  }
  function readCache(id){
    try{
      const raw = JSON.parse(localStorage.getItem(CACHE_PREFIX + id) || 'null');
      if(!raw || !raw.url || !raw.t || Date.now() - raw.t > CACHE_TTL) return '';
      return raw.url;
    }catch(e){ return ''; }
  }
  function writeCache(id,url){ try { localStorage.setItem(CACHE_PREFIX + id, JSON.stringify({url, t: Date.now()})); } catch(e){} }

  function injectCss(){
    if(document.getElementById('azobss-radio-player-css')) return;
    const css = `
      .az-radio-player{z-index:10050;font-family:Arial,sans-serif;color:#e5e7eb;display:inline-flex;flex-direction:column;align-items:flex-end;width:auto;max-width:calc(100vw - 16px);flex:0 0 auto;}
      .az-radio-player.az-radio-navbar{position:relative;right:auto;bottom:auto;margin:0 4px 0 0;vertical-align:middle;min-width:28px;max-width:28px;width:28px;align-items:center;}
      .az-radio-player.az-radio-floating{position:fixed;right:8px;bottom:86px;}
      .az-radio-player > .az-radio-pill{align-self:flex-end;}
      .az-radio-player > .az-radio-panel{align-self:flex-end;}
      .az-radio-player *{box-sizing:border-box;}
      .az-radio-pill{border:1px solid #475569;background:#111827;color:#facc15;border-radius:50%;width:30px;height:30px;min-width:30px;min-height:30px;padding:0;display:inline-flex;align-items:center;justify-content:center;gap:0;font-weight:900;font-size:0;letter-spacing:0;box-shadow:0 1px 2px rgba(0,0,0,.35);cursor:pointer;overflow:hidden;position:relative;}
      .az-radio-pill .az-radio-icon{width:18px;height:18px;display:block;color:currentColor;pointer-events:none;}
      .az-radio-pill::after{content:'';position:absolute;right:2px;bottom:2px;width:4px;height:4px;border-radius:50%;background:#64748b;box-shadow:0 0 0 1px #111827;}
      .az-radio-player.is-playing .az-radio-pill::after{background:#22c55e;}
      .az-radio-pill:hover{border-color:#facc15;background:#172033;box-shadow:0 2px 5px rgba(0,0,0,.38);}
      .az-radio-player.is-open .az-radio-pill{opacity:0;visibility:hidden;pointer-events:none;min-height:0!important;height:0!important;max-height:0!important;margin:0!important;padding:0!important;border:0!important;overflow:hidden!important;transform:translateY(4px) scale(.96);box-shadow:none!important;}
      .az-radio-player.is-open .az-radio-panel{margin-top:0;}
      .az-radio-dot{display:none;}
      .az-radio-panel{width:min(330px,calc(100vw - 24px));margin-top:9px;border:1px solid rgba(148,163,184,.22);background:rgba(2,6,23,.97);backdrop-filter:blur(14px);border-radius:18px;padding:12px;box-shadow:0 20px 46px rgba(0,0,0,.5);opacity:0;visibility:hidden;pointer-events:none;max-height:0;overflow:hidden;transform:translateY(6px);transition:opacity .16s ease,transform .16s ease,visibility .16s ease,max-height .16s ease,padding .16s ease,margin .16s ease;}
      .az-radio-player.az-radio-navbar .az-radio-panel{position:absolute;top:calc(100% + 10px);right:0;margin-top:0;}
      .az-radio-player.az-radio-navbar.is-open{min-width:28px;max-width:28px;width:28px;}
      .az-radio-player.az-radio-navbar .az-radio-pill{width:28px;height:28px;min-width:28px;min-height:28px;padding:0;font-size:0;border-radius:50%;}
      .az-radio-player.is-open .az-radio-panel{opacity:1;visibility:visible;pointer-events:auto;max-height:520px;overflow:visible;transform:translateY(0);}
      .az-radio-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:9px;}
      .az-radio-title{font-size:14px;font-weight:1000;color:#fff;line-height:1.15;}
      .az-radio-sub{font-size:10.5px;color:#94a3b8;font-weight:800;margin-top:2px;}
      .az-radio-x{min-width:82px;height:28px;border:1px solid rgba(148,163,184,.28);border-radius:10px;background:#0f172a;color:#e5e7eb;font-weight:900;cursor:pointer;padding:0 9px;font-size:11.5px;line-height:1;display:inline-flex;align-items:center;justify-content:center;gap:4px;}
      .az-radio-row{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;margin:8px 0;}.az-radio-row-no-search{margin-top:4px;}
      .az-radio-search{width:100%;border:1px solid rgba(34,197,94,.22);border-radius:12px;background:#020617;color:#f8fafc;min-height:32px;padding:0 10px;font-size:12px;font-weight:800;outline:none;margin:6px 0 7px;}
      .az-radio-search::placeholder{color:#64748b;}
      .az-radio-select,.az-radio-custom{width:100%;border:1px solid rgba(148,163,184,.25);border-radius:12px;background:#020617;color:#f8fafc;min-height:36px;padding:0 10px;font-size:13px;font-weight:800;outline:none;}
      .az-radio-select optgroup{background:#020617;color:#93c5fd;font-weight:1000;}
      .az-radio-select option{background:#020617;color:#f8fafc;font-weight:800;}
      .az-radio-random{width:38px;height:36px;border:1px solid rgba(34,197,94,.42);border-radius:12px;background:linear-gradient(135deg,#052e16,#075985);color:#ecfeff;font-size:15px;font-weight:1000;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:inset 0 0 0 1px rgba(255,255,255,.05);}
      .az-radio-random:hover{border-color:#22c55e;filter:brightness(1.08);transform:translateY(-1px);}
      .az-radio-random:disabled{opacity:.55;cursor:not-allowed;transform:none;}
      .az-radio-count{display:block;margin-top:5px;text-align:center;color:#94a3b8;font-size:10.5px;font-weight:900;}
      .az-radio-custom{display:none;margin-top:8px;}
      .az-radio-player.is-custom .az-radio-custom{display:block;}
      .az-radio-btns{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:8px;}
      .az-radio-btn{border:1px solid rgba(34,197,94,.36);background:#052e16;color:#bbf7d0;border-radius:12px;min-height:36px;padding:0 9px;font-size:12px;font-weight:1000;cursor:pointer;}
      .az-radio-btn.stop{border-color:rgba(248,113,113,.35);background:#450a0a;color:#fecaca;}
      .az-radio-btn:disabled{opacity:.55;cursor:not-allowed;}
      .az-radio-vol{display:flex;align-items:center;gap:8px;margin-top:9px;padding:8px 9px;border-radius:13px;background:rgba(15,23,42,.78);border:1px solid rgba(148,163,184,.14);}
      .az-radio-vol span{font-size:12px;font-weight:900;color:#cbd5e1;white-space:nowrap;}
      .az-radio-vol input{width:100%;accent-color:#22c55e;}
      .az-radio-status{min-height:28px;margin-top:9px;border-radius:12px;padding:7px 9px;background:rgba(15,23,42,.82);color:#cbd5e1;font-size:11px;font-weight:800;line-height:1.22;border:1px solid rgba(148,163,184,.14);max-width:100%;box-sizing:border-box;white-space:normal;overflow-wrap:anywhere;word-break:break-word;hyphens:auto;overflow:hidden;text-align:left;}
      .az-radio-status.ok{color:#bbf7d0;border-color:rgba(34,197,94,.22);}
      .az-radio-status.err{color:#fecaca;border-color:rgba(248,113,113,.22);}
      .az-radio-note{margin-top:7px;color:#94a3b8;font-size:10px;line-height:1.22;text-align:center;max-width:100%;box-sizing:border-box;overflow-wrap:anywhere;}
      @media(max-width:720px){.az-radio-player.az-radio-floating{right:6px;bottom:76px;max-width:calc(100vw - 12px)}.az-radio-player.az-radio-navbar{margin-right:3px;min-width:26px;max-width:26px;width:26px}.az-radio-pill{width:28px;height:28px;min-width:28px;min-height:28px;padding:0;font-size:0;border-radius:50%}.az-radio-pill .az-radio-icon{width:17px;height:17px}.az-radio-player.az-radio-navbar .az-radio-pill{width:26px;height:26px;min-width:26px;min-height:26px;padding:0;font-size:0;border-radius:50%}.az-radio-player.az-radio-navbar .az-radio-panel{position:fixed;top:54px;right:8px;width:min(330px,calc(100vw - 16px));}.az-radio-panel{border-radius:16px;padding:10px}.az-radio-btns{grid-template-columns:1fr 1fr}}
    `;
    const style=document.createElement('style');
    style.id='azobss-radio-player-css';
    style.textContent=css;
    document.head.appendChild(style);
  }

  function build(){
    if(document.getElementById('azobssRadioPlayer')) return;
    injectCss();
    const store=readStore();
    const selected=store.station || 'sinar';
    const volume=Number(store.volume ?? 0.7);
    const el=document.createElement('div');
    el.id='azobssRadioPlayer';
    el.className='az-radio-player';
    el.dataset.azRadioControl='1';
    el.innerHTML=`
      <button type="button" class="az-radio-pill" id="azRadioToggle" data-az-radio-control="1" aria-expanded="false" aria-controls="azRadioPanel" aria-label="Open AZOBSS Radio" title="AZOBSS Radio"><span class="az-radio-dot"></span><svg class="az-radio-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16.247 7.761a6 6 0 0 1 0 8.478"/><path d="M19.075 4.933a10 10 0 0 1 0 14.134"/><path d="M4.925 19.067a10 10 0 0 1 0-14.134"/><path d="M7.753 16.239a6 6 0 0 1 0-8.478"/><circle cx="12" cy="12" r="2"/></svg></button>
      <div class="az-radio-panel" id="azRadioPanel" role="dialog" aria-label="AZOBSS Radio Player">
        <div class="az-radio-head">
          <div><div class="az-radio-title">AZOBSS Radio</div><div class="az-radio-sub">Mini online radio player</div></div>
          <button type="button" class="az-radio-x" id="azRadioClose" aria-label="Minimize radio panel" title="Minimize radio panel">− Minimize</button>
        </div>
        <input class="az-radio-search" id="azRadioSearch" type="search" autocomplete="off" placeholder="Search channel... ERA, Hot FM, IKIM">
        <div class="az-radio-row az-radio-row-no-search">
          <select class="az-radio-select" id="azRadioStation" aria-label="Select radio station">${renderStationOptions(selected)}</select>
          <button type="button" class="az-radio-random" id="azRadioRandom" title="Random channel" aria-label="Random channel">🔀</button>
        </div>
        <span class="az-radio-count" id="azRadioCount">${Math.max(0, STATIONS.length - 1)} Radio-Online.My channels + Custom URL</span>
        <input class="az-radio-custom" id="azRadioCustom" type="url" placeholder="Paste direct stream URL (.mp3/.aac/.m3u8)" value="${esc(store.customUrl||'')}">
        <div class="az-radio-btns">
          <button type="button" class="az-radio-btn play" id="azRadioPlay">▶ Play</button>
          <button type="button" class="az-radio-btn stop" id="azRadioStop">■ Stop</button>
        </div>
        <div class="az-radio-vol"><span>Volume</span><input id="azRadioVolume" type="range" min="0" max="1" step="0.05" value="${Math.min(1,Math.max(0,volume))}"></div>
        <div class="az-radio-status" id="azRadioStatus">Pilih stesen dan tekan Play.</div>
        <div class="az-radio-note">Pilih stesen dan radio akan terus cuba main. Jika browser block autoplay, tekan Play sekali.</div>
        <audio id="azRadioAudio" preload="none" crossorigin="anonymous"></audio>
      </div>`;
    const tools = document.getElementById('marketUserTools') || document.querySelector('.market-user-tools');
    const authActions = document.getElementById('siteAuthActions') || document.querySelector('.site-auth-actions');
    const marketRow = (tools && tools.parentElement) || (authActions && authActions.parentElement) || document.querySelector('.market-main-row');
    if(marketRow && (tools || authActions)){
      // Keep radio outside #marketUserTools because that container is hidden for guests.
      // Mount before Register/Login on guest view, and before the username tools after login.
      el.classList.add('az-radio-navbar');
      marketRow.insertBefore(el, authActions || tools);
    }else{
      el.classList.add('az-radio-floating');
      document.body.appendChild(el);
    }
    wire(el);
  }

  function getStation(id){ return STATIONS.find(s=>s.id===id) || STATIONS[0]; }
  async function fetchWithTimeout(url, ms){
    const ctrl = new AbortController();
    const timer = setTimeout(()=>ctrl.abort(), ms || 6500);
    try { return await fetch(url, {signal:ctrl.signal, cache:'no-store'}); }
    finally { clearTimeout(timer); }
  }
  function stationSearchTerms(station){
    const terms = [station.query, station.name, station.label, ...(Array.isArray(station.aliases) ? station.aliases : [])]
      .map(v => String(v || '').replace(/^⭐\s*/, '').trim())
      .filter(Boolean);
    return [...new Set(terms)];
  }
  function stationScore(row, station){
    const stream = String(row?.url_resolved || row?.url || '').trim();
    if(!stream) return -999;
    let score = 0;
    if(/^https:\/\//i.test(stream)) score += 6;
    if(/^http:\/\//i.test(stream)) score -= 2;
    if(row?.lastcheckok === 1 || row?.lastcheckok === true) score += 8;
    if(String(row?.countrycode || '').toUpperCase() === 'MY') score += 5;
    if(String(row?.codec || '').match(/mp3|aac|ogg|opus/i)) score += 3;
    score += Math.min(6, Number(row?.clickcount || 0) / 5000);
    const name = String(row?.name || '').toLowerCase();
    for(const term of stationSearchTerms(station)){
      const t = term.toLowerCase();
      if(t && name === t) score += 8;
      else if(t && name.includes(t)) score += 4;
    }
    return score;
  }
  function pickCandidates(rows, station, limit){
    const seen = new Set();
    const list = (Array.isArray(rows)?rows:[])
      .filter(r => r && (r.url_resolved || r.url))
      .map(r => ({...r, stream:String(r.url_resolved || r.url || '').trim()}))
      .filter(r => /^https?:\/\//i.test(r.stream))
      .filter(r => String(r.countrycode || '').toUpperCase() === 'MY' || !r.countrycode)
      .sort((a,b)=>stationScore(b, station)-stationScore(a, station))
      .filter(r => {
        const key = r.stream.replace(/\/$/, '');
        if(seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    return list.slice(0, Math.max(1, Number(limit)||8)).map(r => r.stream);
  }
  function clearCache(id){ try{ localStorage.removeItem(CACHE_PREFIX + id); }catch(e){} }
  function directStreamCandidates(station){
    return [...new Set((Array.isArray(station.streams) ? station.streams : [])
      .map(url => String(url || '').trim())
      .filter(url => /^https?:\/\//i.test(url)))];
  }
  async function queryRadioBrowserCandidates(station, term){
    const variants = [
      {countrycode: station.country || 'MY', name: term, hidebroken:'true', order:'clickcount', reverse:'true', limit:'24'},
      {country: 'Malaysia', name: term, hidebroken:'true', order:'clickcount', reverse:'true', limit:'24'},
      {name: term, hidebroken:'true', order:'clickcount', reverse:'true', limit:'24'}
    ];
    const found = [];
    const seen = new Set();
    let lastErr = '';
    for(const paramsObj of variants){
      const params = new URLSearchParams(paramsObj);
      let mirrorWorked = false;
      for(const base of API_BASES){
        try{
          const res = await fetchWithTimeout(base + '?' + params.toString(), 6500);
          if(!res.ok){ lastErr = 'HTTP '+res.status; continue; }
          const rows = await res.json();
          mirrorWorked = true;
          for(const url of pickCandidates(rows, station, 8)){
            const key = url.replace(/\/$/, '');
            if(seen.has(key)) continue;
            seen.add(key); found.push(url);
          }
          break; // mirrors contain the same directory; use the next mirror only if this one fails.
        }catch(e){ lastErr = e?.message || String(e); }
      }
      if(found.length >= 8) break;
      if(!mirrorWorked && lastErr) station.__lastLookupError = lastErr;
    }
    return found;
  }

  async function resolveStreamCandidates(station, status, force){
    if(station.id === 'custom'){
      const url = String(document.getElementById('azRadioCustom')?.value || '').trim();
      if(!url) throw new Error('Sila paste direct stream URL dahulu.');
      return [url];
    }
    const out = [];
    const seen = new Set();
    const add = url => {
      const clean = String(url || '').trim();
      if(!/^https?:\/\//i.test(clean)) return;
      const key = clean.replace(/\/$/, '');
      if(seen.has(key)) return;
      seen.add(key); out.push(clean);
    };
    if(!force) add(readCache(station.id));
    directStreamCandidates(station).forEach(add);
    if(status) status.textContent = 'Mencari stream radio...';
    const terms = stationSearchTerms(station).slice(0, 5);
    for(const term of terms){
      const rows = await queryRadioBrowserCandidates(station, term);
      rows.forEach(add);
      if(out.length >= 5) break;
    }
    if(out.length){ clearStationBroken(station.id); return out.slice(0, 5); }
    markStationBroken(station.id);
    refreshBrokenStationUi();
    throw new Error('Stream stesen ini tidak ditemui. Channel telah dibuang daripada senarai. Pilih channel lain.');
  }

  async function resolveStream(station, status){
    const rows = await resolveStreamCandidates(station, status, false);
    return rows[0] || '';
  }

  function wire(root){
    const toggle=root.querySelector('#azRadioToggle');
    const close=root.querySelector('#azRadioClose');
    const search=root.querySelector('#azRadioSearch');
    const select=root.querySelector('#azRadioStation');
    const count=root.querySelector('#azRadioCount');
    const custom=root.querySelector('#azRadioCustom');
    const play=root.querySelector('#azRadioPlay');
    const random=root.querySelector('#azRadioRandom');
    const stop=root.querySelector('#azRadioStop');
    const vol=root.querySelector('#azRadioVolume');
    const audio=root.querySelector('#azRadioAudio');
    const status=root.querySelector('#azRadioStatus');

    function setStatus(text, cls){
      const raw = String(text || '');
      let clean = raw.replace(/\s+/g, ' ').trim();
      // Keep the card neat: never allow technical fetch/error text to overflow the radio panel.
      if(clean.length > 105) clean = clean.slice(0, 102).trim() + '...';
      status.textContent = clean;
      status.title = raw.length > clean.length ? raw : '';
      status.className='az-radio-status '+(cls||'');
    }
    function updateStationOptions(){
      const current = select.value || readStore().station || 'sinar';
      const activeTotal = STATIONS.filter(st => st.id !== 'custom' && !isStationBroken(st.id)).length;
      select.innerHTML = renderStationOptions(current, search ? search.value : '');
      if([...select.options].some(o => o.value === current)) select.value = current;
      else if(select.options.length) select.value = select.options[0].value;
      const visible = Math.max(0, [...select.options].filter(o => o.value !== 'custom').length);
      const q = String(search ? search.value : '').trim();
      if(count) count.textContent = q ? `Showing ${visible} / ${activeTotal} channels + Custom URL` : `${activeTotal} Radio-Online.My channels + Custom URL`;
      syncCustom();
    }
    function getRandomStationId(){
      const opts = [...select.options].map(o => o.value).filter(v => v && v !== 'custom');
      const pool = (opts.length ? opts : STATIONS.filter(st => st.id !== 'custom' && !isStationBroken(st.id)).map(st => st.id));
      if(!pool.length) return 'sinar';
      let pick = pool[Math.floor(Math.random() * pool.length)];
      if(pool.length > 1 && pick === select.value){
        const alt = pool.filter(v => v !== select.value);
        pick = alt[Math.floor(Math.random() * alt.length)] || pick;
      }
      return pick;
    }
    async function startCandidate(url, station, index, total){
      return await new Promise(async (resolve, reject)=>{
        let done=false;
        const finish=(ok,err)=>{
          if(done) return; done=true;
          clearTimeout(timer);
          audio.removeEventListener('playing', onPlaying);
          audio.removeEventListener('error', onError);
          audio.removeEventListener('abort', onAbort);
          ok ? resolve(true) : reject(err || new Error('Stream tidak memberi audio.'));
        };
        const onPlaying=()=>finish(true);
        const onError=()=>finish(false,new Error('Stream gagal dimainkan.'));
        const onAbort=()=>finish(false,new Error('Stream dibatalkan.'));
        const timer=setTimeout(()=>finish(false,new Error('Stream terlalu lambat / tiada audio.')), 6000);
        audio.addEventListener('playing', onPlaying);
        audio.addEventListener('error', onError);
        audio.addEventListener('abort', onAbort);
        try{
          setStatus((total>1 ? `Cuba sumber ${index+1}/${total}: ` : 'Loading ') + station.label + '...', '');
          if(audio.src !== url){ audio.pause(); audio.src=url; audio.load(); }
          audio.volume=Number(vol.value)||0.7;
          const result=audio.play();
          if(result && typeof result.catch==='function') result.catch(err=>finish(false,err));
        }catch(e){ finish(false,e); }
      });
    }
    async function playCurrentStation(opts){
      const options=opts && typeof opts==='object' ? opts : {};
      const station=getStation(select.value);
      if(station.id==='custom' && !String(custom.value||'').trim()){
        syncCustom(); setStatus('Paste Custom URL dan tekan Play.', 'err'); return false;
      }
      try{
        save();
        play.disabled=true;
        if(random) random.disabled=true;
        const candidates=await resolveStreamCandidates(station, status, !!options.forceLookup);
        let lastErr=null;
        for(let i=0;i<candidates.length;i++){
          const url=candidates[i];
          try{
            await startCandidate(url, station, i, candidates.length);
            writeCache(station.id,url);
            clearStationBroken(station.id);
            root.classList.add('is-playing');
            markPlaying(url);
            setStatus('Playing: ' + station.label, 'ok');
            return true;
          }catch(e){
            lastErr=e;
            if(String(e?.name||'')==='NotAllowedError'){
              writeCache(station.id,url);
              setStatus('Stream sudah sedia. Tekan ▶ Play sekali untuk benarkan audio.', 'err');
              return false;
            }
            if(i===0 && readCache(station.id)===url) clearCache(station.id);
          }
        }
        clearCache(station.id);
        markStationBroken(station.id);
        refreshBrokenStationUi();
        throw lastErr || new Error('Semua sumber stream gagal. Channel telah dibuang daripada senarai.');
      }catch(e){
        root.classList.remove('is-playing');
        setStatus(e?.message || 'Radio gagal dimainkan.', 'err');
        return false;
      }finally{
        play.disabled=false;
        if(random) random.disabled=false;
      }
    }
    function save(extra){
      const s=readStore();
      s.station=select.value;
      s.customUrl=custom.value;
      s.volume=Number(vol.value)||0.7;
      if(extra && typeof extra === 'object') Object.assign(s, extra);
      writeStore(s);
      return s;
    }
    function markPlaying(url){
      save({
        playing:true,
        streamUrl:url || audio.currentSrc || audio.src || '',
        stationName:(getStation(select.value).label || getStation(select.value).name || select.value),
        updatedAt:Date.now()
      });
    }
    function markStopped(){ save({playing:false, streamUrl:'', updatedAt:Date.now()}); }
    function syncCustom(){ root.classList.toggle('is-custom', select.value==='custom'); save(); }
    function setOpen(v){
      root.classList.toggle('is-open', !!v);
      toggle.setAttribute('aria-expanded', v?'true':'false');
      // Do not pause/reload audio when the radio panel is minimized/opened.
      // Only Stop button should stop playback.
      if(!audio.paused && audio.src){ root.classList.add('is-playing'); }
    }

    audio.volume = Math.min(1, Math.max(0, Number(vol.value)||0.7));
    toggle.addEventListener('click', ()=>setOpen(!root.classList.contains('is-open')));
    close.addEventListener('click', ()=>setOpen(false));
    document.addEventListener('pointerdown', (ev)=>{
      if(!root.classList.contains('is-open')) return;
      const target = ev.target;
      if(target && root.contains(target)) return;
      setOpen(false);
    }, true);
    select.addEventListener('change', async ()=>{
      syncCustom();
      try{ audio.pause(); audio.removeAttribute('src'); audio.load(); }catch(e){}
      root.classList.remove('is-playing');
      markStopped();
      if(select.value==='custom'){
        setStatus('Paste Custom URL dan tekan Play.');
        return;
      }
      // A station selection is already a user action, so immediately resolve
      // and start it instead of forcing a second click on Play.
      await playCurrentStation();
    });
    if(search) search.addEventListener('input', ()=>{ updateStationOptions(); });
    window.addEventListener('azobss-radio-broken-list-changed', ()=>{ updateStationOptions(); });
    custom.addEventListener('change', save);
    custom.addEventListener('input', save);
    vol.addEventListener('input', ()=>{ audio.volume=Number(vol.value)||0; save(); });

    play.addEventListener('click', playCurrentStation);
    if(random) random.addEventListener('click', async ()=>{
      const wasPlaying = audio && !audio.paused && (audio.currentSrc || audio.src);
      const nextId = getRandomStationId();
      select.value = nextId;
      syncCustom();
      const st = getStation(nextId);
      setStatus('Random: ' + (st.label || st.name) + (wasPlaying ? ' — switching...' : ' dipilih. Tekan Play.'), wasPlaying ? '' : 'ok');
      if(wasPlaying) await playCurrentStation();
    });
    stop.addEventListener('click', ()=>{ try{ audio.pause(); audio.removeAttribute('src'); audio.load(); }catch(e){} root.classList.remove('is-playing'); markStopped(); setStatus('Radio dihentikan.',''); });
    audio.addEventListener('playing', ()=>{ root.classList.add('is-playing'); markPlaying(audio.currentSrc || audio.src || ''); });
    audio.addEventListener('pause', ()=>{ root.classList.remove('is-playing'); if(!document.hidden) { /* Stop button handles persistent stopped state. */ } });
    audio.addEventListener('error', ()=>{ root.classList.remove('is-playing'); setStatus('Stream gagal. Pilih stesen lain atau paste Custom URL.', 'err'); });

    // Save playing state before normal AZOBSS page navigation. A full page reload
    // cannot keep the same <audio> element alive, so the next page restores it.
    document.addEventListener('click', (ev)=>{
      const a = ev.target && ev.target.closest ? ev.target.closest('a[href]') : null;
      if(!a || !isInternalAzobssLink(a)) return;
      if(audio && !audio.paused && (audio.currentSrc || audio.src)) markPlaying(audio.currentSrc || audio.src || '');
    }, true);
    window.addEventListener('pagehide', ()=>{
      if(audio && !audio.paused && (audio.currentSrc || audio.src)) markPlaying(audio.currentSrc || audio.src || '');
    });
    window.addEventListener('beforeunload', ()=>{
      if(audio && !audio.paused && (audio.currentSrc || audio.src)) markPlaying(audio.currentSrc || audio.src || '');
    });

    async function restoreIfNeeded(){
      const s = readStore();
      if(!s || !s.playing) return;
      if(Date.now() - Number(s.updatedAt || 0) > 6 * 60 * 60 * 1000) return;
      try{
        if(s.station && [...select.options].some(o => o.value === s.station)) select.value = s.station;
        if(s.customUrl) custom.value = s.customUrl;
        if(s.volume != null){ vol.value = Math.min(1, Math.max(0, Number(s.volume)||0.7)); audio.volume=Number(vol.value)||0.7; }
        syncCustom();
        const station=getStation(select.value);
        const url=s.streamUrl || await resolveStream(station, status);
        if(url && audio.src !== url) audio.src=url;
        setStatus('Menyambung radio semula...', '');
        await audio.play();
        root.classList.add('is-playing');
        markPlaying(url);
        setStatus('Playing: ' + (station.label || s.stationName || 'Radio'), 'ok');
      }catch(e){
        root.classList.remove('is-playing');
        setStatus('Radio sedia untuk sambung. Tekan Play sekali.', 'err');
      }
    }
    updateStationOptions();
    setTimeout(restoreIfNeeded, 350);
  }

  function init(){
    if(!document.body) return setTimeout(init, 50);
    build();
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true}); else init();
})();
