import type { ProfileLogo } from "./profileLogos";

/**
 * Curated profile logos, part 2 of 3: faces, bots, and space (18).
 * Same format as profileLogosA — self-contained ASCII-only 64x64 SVGs.
 */
export const PROFILE_LOGOS_B: ProfileLogo[] = [
  {
    id: "sunny-smile",
    name: "Sunny Smile",
    category: "Faces and Bots",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="pb1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fef08a"/><stop offset="1" stop-color="#facc15"/></linearGradient></defs><rect width="64" height="64" rx="14" fill="url(#pb1)"/><circle cx="32" cy="34" r="17" fill="#fffbeb"/><circle cx="25.5" cy="31" r="2.8" fill="#713f12"/><circle cx="38.5" cy="31" r="2.8" fill="#713f12"/><ellipse cx="20" cy="37" rx="3" ry="2" fill="#fda4af"/><ellipse cx="44" cy="37" rx="3" ry="2" fill="#fda4af"/><path d="M23 39 Q32 48 41 39 Q32 43 23 39 Z" fill="#b45309"/><path d="M25 41 Q32 46.5 39 41" stroke="#fffbeb" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>`,
  },
  {
    id: "bolt-bot",
    name: "Bolt",
    category: "Faces and Bots",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="pb2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#cbd5e1"/><stop offset="1" stop-color="#475569"/></linearGradient></defs><rect width="64" height="64" rx="14" fill="url(#pb2)"/><path d="M32 8 L32 15" stroke="#e2e8f0" stroke-width="2.4" stroke-linecap="round"/><circle cx="32" cy="7" r="2.6" fill="#22d3ee"/><rect x="18" y="17" width="4" height="10" rx="2" fill="#94a3b8"/><rect x="42" y="17" width="4" height="10" rx="2" fill="#94a3b8"/><rect x="16" y="16" width="32" height="26" rx="9" fill="#f1f5f9"/><rect x="16" y="16" width="32" height="26" rx="9" fill="none" stroke="#0f172a" stroke-width="2"/><circle cx="25" cy="29" r="3.4" fill="#0ea5e9"/><circle cx="39" cy="29" r="3.4" fill="#0ea5e9"/><circle cx="25" cy="29" r="1.2" fill="#e0f2fe"/><circle cx="39" cy="29" r="1.2" fill="#e0f2fe"/><path d="M26 36 L38 36" stroke="#0f172a" stroke-width="2.2" stroke-linecap="round"/><rect x="27" y="45" width="10" height="5" rx="2.5" fill="#94a3b8"/></svg>`,
  },
  {
    id: "boo",
    name: "Boo",
    category: "Faces and Bots",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="pb3" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e9d5ff"/><stop offset="1" stop-color="#8b5cf6"/></linearGradient></defs><rect width="64" height="64" rx="14" fill="url(#pb3)"/><path d="M32 12 C22 12 17 21 17 31 L17 48 L23 44 L27 49 L32 44 L37 49 L41 44 L47 48 L47 31 C47 21 42 12 32 12 Z" fill="#fff"/><circle cx="26" cy="30" r="2.8" fill="#4c1d95"/><circle cx="38" cy="30" r="2.8" fill="#4c1d95"/><ellipse cx="32" cy="37" rx="2.6" ry="3.2" fill="#4c1d95"/><ellipse cx="21.5" cy="34" rx="2.2" ry="1.5" fill="#ddd6fe"/><ellipse cx="42.5" cy="34" rx="2.2" ry="1.5" fill="#ddd6fe"/></svg>`,
  },
  {
    id: "zorp",
    name: "Zorp",
    category: "Faces and Bots",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="pb4" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#bbf7d0"/><stop offset="1" stop-color="#4ade80"/></linearGradient></defs><rect width="64" height="64" rx="14" fill="url(#pb4)"/><path d="M25 14 Q23 8 19 7 M39 14 Q41 8 45 7" stroke="#15803d" stroke-width="2.2" fill="none" stroke-linecap="round"/><circle cx="19" cy="7" r="1.8" fill="#15803d"/><circle cx="45" cy="7" r="1.8" fill="#15803d"/><ellipse cx="32" cy="37" rx="14" ry="15" fill="#86efac"/><ellipse cx="24.5" cy="34" rx="4.6" ry="6.4" fill="#052e16" transform="rotate(-18 24.5 34)"/><ellipse cx="39.5" cy="34" rx="4.6" ry="6.4" fill="#052e16" transform="rotate(18 39.5 34)"/><circle cx="26" cy="32" r="1.4" fill="#fff"/><circle cx="38" cy="32" r="1.4" fill="#fff"/><path d="M27 45 Q32 48 37 45" stroke="#052e16" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`,
  },
  {
    id: "shinobi",
    name: "Shinobi",
    category: "Faces and Bots",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="pb5" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e2e8f0"/><stop offset="1" stop-color="#334155"/></linearGradient></defs><rect width="64" height="64" rx="14" fill="url(#pb5)"/><path d="M46 22 L54 18 L52 26 Z" fill="#0f172a"/><ellipse cx="32" cy="37" rx="14" ry="14" fill="#ffedd5"/><rect x="18" y="28" width="28" height="10" rx="5" fill="#0f172a"/><ellipse cx="26" cy="33" rx="3.4" ry="3.8" fill="#fff"/><ellipse cx="38" cy="33" rx="3.4" ry="3.8" fill="#fff"/><circle cx="26.5" cy="33.5" r="1.7" fill="#0f172a"/><circle cx="37.5" cy="33.5" r="1.7" fill="#0f172a"/><rect x="29" y="29.5" width="6" height="7" rx="2" fill="#38bdf8"/><path d="M26 46 Q32 49 38 46" stroke="#7c2d12" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`,
  },
  {
    id: "lovey",
    name: "Lovey",
    category: "Faces and Bots",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="pb6" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fecdd3"/><stop offset="1" stop-color="#fb7185"/></linearGradient></defs><rect width="64" height="64" rx="14" fill="url(#pb6)"/><circle cx="32" cy="34" r="17" fill="#fff1f2"/><path d="M25.5 27 C24 25 21.5 25.5 21.5 28 C21.5 30.5 24 32.5 25.5 34 C27 32.5 29.5 30.5 29.5 28 C29.5 25.5 27 25 25.5 27 Z" fill="#e11d48"/><path d="M38.5 27 C37 25 34.5 25.5 34.5 28 C34.5 30.5 37 32.5 38.5 34 C40 32.5 42.5 30.5 42.5 28 C42.5 25.5 40 25 38.5 27 Z" fill="#e11d48"/><path d="M25 41 Q32 47 39 41" stroke="#881337" stroke-width="2.4" fill="none" stroke-linecap="round"/><ellipse cx="20" cy="36" rx="2.6" ry="1.8" fill="#fda4af"/><ellipse cx="44" cy="36" rx="2.6" ry="1.8" fill="#fda4af"/></svg>`,
  },
  {
    id: "cool",
    name: "Cool",
    category: "Faces and Bots",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="pb7" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#bae6fd"/><stop offset="1" stop-color="#3b82f6"/></linearGradient></defs><rect width="64" height="64" rx="14" fill="url(#pb7)"/><circle cx="32" cy="35" r="16" fill="#eff6ff"/><rect x="19" y="28" width="12" height="9" rx="4" fill="#0f172a"/><rect x="33" y="28" width="12" height="9" rx="4" fill="#0f172a"/><rect x="30" y="31" width="4" height="2.6" fill="#0f172a"/><path d="M22 30.5 L27 30.5" stroke="#38bdf8" stroke-width="1.6" stroke-linecap="round"/><path d="M36 30.5 L41 30.5" stroke="#38bdf8" stroke-width="1.6" stroke-linecap="round"/><path d="M27 44 Q33 46 38 42.5" stroke="#0f172a" stroke-width="2.2" fill="none" stroke-linecap="round"/></svg>`,
  },
  {
    id: "snoozy",
    name: "Snoozy",
    category: "Faces and Bots",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="pb8" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c7d2fe"/><stop offset="1" stop-color="#818cf8"/></linearGradient></defs><rect width="64" height="64" rx="14" fill="url(#pb8)"/><path d="M22 22 L40 10 L36 24 Z" fill="#312e81"/><circle cx="40" cy="10" r="3" fill="#e0e7ff"/><circle cx="32" cy="39" r="15" fill="#eef2ff"/><path d="M23 37 Q25.5 39 28 37 M36 37 Q38.5 39 41 37" stroke="#312e81" stroke-width="2.2" fill="none" stroke-linecap="round"/><ellipse cx="21" cy="41" rx="2.2" ry="1.5" fill="#c7d2fe"/><ellipse cx="43" cy="41" rx="2.2" ry="1.5" fill="#c7d2fe"/><path d="M30 44 Q32 45.5 34 44" stroke="#312e81" stroke-width="1.8" fill="none" stroke-linecap="round"/><path d="M47 36 L51 36 L49 39 L53 39" stroke="#312e81" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M51 27 L54 27 L52.5 29.5 L55.5 29.5" stroke="#312e81" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  },
  {
    id: "party",
    name: "Party",
    category: "Faces and Bots",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="pb9" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fbcfe8"/><stop offset="1" stop-color="#a855f7"/></linearGradient></defs><rect width="64" height="64" rx="14" fill="url(#pb9)"/><circle cx="14" cy="14" r="1.8" fill="#fff"/><circle cx="51" cy="12" r="1.8" fill="#fde047"/><circle cx="55" cy="46" r="1.8" fill="#fff"/><circle cx="10" cy="44" r="1.8" fill="#4ade80"/><path d="M26 20 L36 6 L40 20 Z" fill="#f59e0b"/><circle cx="36" cy="6" r="2.4" fill="#ec4899"/><circle cx="31" cy="15" r="1.4" fill="#fff"/><circle cx="35" cy="12" r="1.4" fill="#4ade80"/><circle cx="32" cy="38" r="14" fill="#fdf4ff"/><circle cx="26.5" cy="36" r="2.6" fill="#701a75"/><circle cx="37.5" cy="36" r="2.6" fill="#701a75"/><path d="M25 42 Q32 48 39 42" stroke="#701a75" stroke-width="2.4" fill="none" stroke-linecap="round"/><ellipse cx="21.5" cy="40" rx="2.4" ry="1.6" fill="#f0abfc"/><ellipse cx="42.5" cy="40" rx="2.4" ry="1.6" fill="#f0abfc"/></svg>`,
  },
  {
    id: "orbit",
    name: "Orbit",
    category: "Space",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="pb10" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ddd6fe"/><stop offset="1" stop-color="#6d28d9"/></linearGradient></defs><rect width="64" height="64" rx="14" fill="url(#pb10)"/><circle cx="12" cy="12" r="1.5" fill="#fff"/><circle cx="52" cy="10" r="1.8" fill="#fff"/><circle cx="54" cy="50" r="1.5" fill="#fff"/><circle cx="32" cy="33" r="12" fill="#f0abfc"/><circle cx="28" cy="30" r="2.6" fill="#d946ef" opacity=".7"/><circle cx="36" cy="37" r="1.8" fill="#d946ef" opacity=".7"/><ellipse cx="32" cy="33" rx="21" ry="7" fill="none" stroke="#fef08a" stroke-width="2.6" transform="rotate(-18 32 33)"/><circle cx="25" cy="31" r="2.2" fill="#4c1d95"/><circle cx="33" cy="31" r="2.2" fill="#4c1d95"/><path d="M27 36 Q30 38.5 34 36.5" stroke="#4c1d95" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>`,
  },
  {
    id: "astro-rocket",
    name: "Astro",
    category: "Space",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="pb11" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#bfdbfe"/><stop offset="1" stop-color="#1d4ed8"/></linearGradient></defs><rect width="64" height="64" rx="14" fill="url(#pb11)"/><circle cx="12" cy="14" r="1.5" fill="#fff"/><circle cx="52" cy="12" r="1.5" fill="#fff"/><path d="M32 8 C38 16 39 26 36 34 L28 34 C25 26 26 16 32 8 Z" fill="#f8fafc"/><circle cx="32" cy="24" r="4.4" fill="#38bdf8"/><circle cx="32" cy="24" r="4.4" fill="none" stroke="#0f172a" stroke-width="1.8"/><path d="M28 30 L23 38 L28 36 Z" fill="#f87171"/><path d="M36 30 L41 38 L36 36 Z" fill="#f87171"/><path d="M29.5 36 L32 44 L34.5 36 Z" fill="#fbbf24"/><path d="M30.5 36 L32 41 L33.5 36 Z" fill="#f97316"/></svg>`,
  },
  {
    id: "nova",
    name: "Nova",
    category: "Space",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="pb12" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e0f2fe"/><stop offset="1" stop-color="#0284c9"/></linearGradient></defs><rect width="64" height="64" rx="14" fill="url(#pb12)"/><circle cx="32" cy="32" r="16" fill="#f8fafc"/><circle cx="32" cy="32" r="16" fill="none" stroke="#0f172a" stroke-width="2"/><rect x="22" y="26" width="20" height="11" rx="5.5" fill="#0f172a"/><circle cx="27.5" cy="31.5" r="1.4" fill="#fff"/><rect x="26" y="42" width="12" height="6" rx="3" fill="#94a3b8"/><circle cx="32" cy="32" r="1.2" fill="#38bdf8"/></svg>`,
  },
  {
    id: "saucer",
    name: "Saucer",
    category: "Space",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="pb13" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#a5b4fc"/><stop offset="1" stop-color="#4c1d95"/></linearGradient></defs><rect width="64" height="64" rx="14" fill="url(#pb13)"/><path d="M24 44 L32 56 L40 44 Z" fill="#fef08a" opacity=".45"/><ellipse cx="32" cy="38" rx="19" ry="8" fill="#c7d2fe"/><ellipse cx="32" cy="35.5" rx="19" ry="8" fill="#e0e7ff"/><circle cx="32" cy="28" r="8" fill="#a5b4fc"/><circle cx="32" cy="28" r="8" fill="none" stroke="#312e81" stroke-width="1.8"/><circle cx="29" cy="26" r="1.6" fill="#fff"/><circle cx="22" cy="36" r="1.8" fill="#fde047"/><circle cx="32" cy="37.5" r="1.8" fill="#4ade80"/><circle cx="42" cy="36" r="1.8" fill="#f472b6"/></svg>`,
  },
  {
    id: "comet",
    name: "Comet",
    category: "Space",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="pb14" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fecdd3"/><stop offset="1" stop-color="#7c3aed"/></linearGradient></defs><rect width="64" height="64" rx="14" fill="url(#pb14)"/><path d="M40 18 L12 34 L14 38 L42 24 Z" fill="#fef08a" opacity=".85"/><path d="M42 26 L18 42 L21 45 L44 30 Z" fill="#fff" opacity=".6"/><circle cx="45" cy="20" r="9" fill="#fef3c7"/><circle cx="42.5" cy="17.5" r="2" fill="#fcd34d"/><circle cx="48" cy="22" r="1.5" fill="#fcd34d"/><circle cx="43" cy="19" r="1.8" fill="#451a03"/><path d="M46 23 Q48 24.5 50 23.5" stroke="#451a03" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>`,
  },
  {
    id: "twinkle",
    name: "Twinkle",
    category: "Space",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="pb15" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fef9c3"/><stop offset="1" stop-color="#f59e0b"/></linearGradient></defs><rect width="64" height="64" rx="14" fill="url(#pb15)"/><path d="M32 10 L36.5 25 L52 25 L39.5 34 L44 49 L32 40 L20 49 L24.5 34 L12 25 L27.5 25 Z" fill="#fffbeb"/><circle cx="28" cy="32" r="2.2" fill="#92400e"/><circle cx="36" cy="32" r="2.2" fill="#92400e"/><path d="M27.5 36.5 Q32 39.5 36.5 36.5" stroke="#92400e" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="51" cy="14" r="1.6" fill="#fff"/><circle cx="12" cy="50" r="1.6" fill="#fff"/></svg>`,
  },
  {
    id: "connie",
    name: "Connie",
    category: "Space",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="pb16" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e0e7ff"/><stop offset="1" stop-color="#4338ca"/></linearGradient></defs><rect width="64" height="64" rx="14" fill="url(#pb16)"/><path d="M16 44 L26 30 L38 34 L48 18" stroke="#e0e7ff" stroke-width="1.8" fill="none" stroke-dasharray="3 2.4" stroke-linecap="round"/><circle cx="16" cy="44" r="3" fill="#fef08a"/><circle cx="26" cy="30" r="2.4" fill="#fff"/><circle cx="38" cy="34" r="3.4" fill="#fef08a"/><circle cx="48" cy="18" r="2.6" fill="#fff"/><circle cx="38" cy="34" r="1.2" fill="#a16207"/><circle cx="52" cy="46" r="1.4" fill="#fff"/></svg>`,
  },
  {
    id: "eclipse",
    name: "Eclipse",
    category: "Space",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="pb17" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fef3c7"/><stop offset="1" stop-color="#b45309"/></linearGradient></defs><rect width="64" height="64" rx="14" fill="url(#pb17)"/><circle cx="32" cy="32" r="15" fill="#fde68a"/><circle cx="32" cy="32" r="15" fill="none" stroke="#f59e0b" stroke-width="2"/><circle cx="32" cy="32" r="10.5" fill="#1c1917"/><circle cx="28.5" cy="30" r="1.8" fill="#fef3c7"/><circle cx="35.5" cy="30" r="1.8" fill="#fef3c7"/><path d="M28.5 35.5 Q32 37.5 35.5 35.5" stroke="#fef3c7" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>`,
  },
  {
    id: "vortex",
    name: "Vortex",
    category: "Space",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="pb18" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fce7f3"/><stop offset="1" stop-color="#be185d"/></linearGradient></defs><rect width="64" height="64" rx="14" fill="url(#pb18)"/><path d="M32 14 C44 14 50 24 48 34 C46 44 38 50 30 48 C23 46 20 39 24 34 C27 30 33 30 35 34 C36.5 37 34 40 31.5 39" stroke="#fff" stroke-width="3.4" fill="none" stroke-linecap="round"/><circle cx="31.5" cy="39" r="2.6" fill="#fff"/><circle cx="12" cy="14" r="1.5" fill="#fff"/><circle cx="52" cy="50" r="1.5" fill="#fff"/></svg>`,
  },
];
