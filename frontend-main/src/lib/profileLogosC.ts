import type { ProfileLogo } from "./profileLogos";

/**
 * Curated profile logos, part 3 of 3: nature, food, and objects (21).
 * Same format as profileLogosA — self-contained ASCII-only 64x64 SVGs.
 */
export const PROFILE_LOGOS_C: ProfileLogo[] = [
  {
    id: "sol",
    name: "Sol",
    category: "Nature",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="pc1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fef9c3"/><stop offset="1" stop-color="#fb923c"/></linearGradient></defs><rect width="64" height="64" rx="14" fill="url(#pc1)"/><path d="M32 8 L32 13 M32 51 L32 56 M8 32 L13 32 M51 32 L56 32 M15 15 L18.5 18.5 M45.5 45.5 L49 49 M49 15 L45.5 18.5 M18.5 45.5 L15 49" stroke="#ea580c" stroke-width="2.6" stroke-linecap="round"/><circle cx="32" cy="32" r="13" fill="#fde047"/><circle cx="27.5" cy="30" r="2.4" fill="#92400e"/><circle cx="36.5" cy="30" r="2.4" fill="#92400e"/><path d="M27 35.5 Q32 39.5 37 35.5" stroke="#92400e" stroke-width="2.2" fill="none" stroke-linecap="round"/><ellipse cx="23.5" cy="34" rx="2" ry="1.4" fill="#fdba74"/><ellipse cx="40.5" cy="34" rx="2" ry="1.4" fill="#fdba74"/></svg>`,
  },
  {
    id: "luna",
    name: "Luna",
    category: "Nature",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="pc2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e0e7ff"/><stop offset="1" stop-color="#312e81"/></linearGradient></defs><rect width="64" height="64" rx="14" fill="url(#pc2)"/><path d="M42 10 C30 10 21 20 21 32 C21 44 30 54 42 54 C36 54 26 45 26 32 C26 19 36 10 42 10 Z" fill="#fef9c3"/><path d="M30 30 Q32 32 34.5 31.5" stroke="#a16207" stroke-width="1.8" fill="none" stroke-linecap="round"/><circle cx="48" cy="14" r="1.8" fill="#fff"/><circle cx="54" cy="30" r="1.4" fill="#fff"/><circle cx="46" cy="48" r="1.6" fill="#fff"/><circle cx="14" cy="48" r="1.4" fill="#fff"/></svg>`,
  },
  {
    id: "puffy",
    name: "Puffy",
    category: "Nature",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="pc3" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e0f2fe"/><stop offset="1" stop-color="#38bdf8"/></linearGradient></defs><rect width="64" height="64" rx="14" fill="url(#pc3)"/><circle cx="24" cy="32" r="9" fill="#fff"/><circle cx="33" cy="27" r="11" fill="#fff"/><circle cx="42" cy="33" r="8" fill="#fff"/><rect x="16" y="32" width="34" height="10" rx="5" fill="#fff"/><circle cx="27" cy="34" r="2.4" fill="#075985"/><circle cx="37" cy="34" r="2.4" fill="#075985"/><path d="M28.5 38.5 Q32 41 35.5 38.5" stroke="#075985" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M24 47 L22 51 M32 47 L30 51 M40 47 L38 51" stroke="#0ea5e9" stroke-width="2.2" stroke-linecap="round"/></svg>`,
  },
  {
    id: "prism",
    name: "Prism",
    category: "Nature",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="pc4" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ede9fe"/><stop offset="1" stop-color="#7c3aed"/></linearGradient></defs><rect width="64" height="64" rx="14" fill="url(#pc4)"/><path d="M12 42 C12 26 22 16 32 16 C42 16 52 26 52 42" stroke="#f87171" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M17 42 C17 29 24.5 21 32 21 C39.5 21 47 29 47 42" stroke="#fbbf24" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M22 42 C22 32 27 26 32 26 C37 26 42 32 42 42" stroke="#4ade80" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="16" cy="46" r="6" fill="#fff"/><circle cx="48" cy="46" r="6" fill="#fff"/><circle cx="14" cy="45" r="1.6" fill="#312e81"/><circle cx="50" cy="45" r="1.6" fill="#312e81"/></svg>`,
  },
  {
    id: "bloom",
    name: "Bloom",
    category: "Nature",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="pc5" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fce7f3"/><stop offset="1" stop-color="#f472b6"/></linearGradient></defs><rect width="64" height="64" rx="14" fill="url(#pc5)"/><ellipse cx="32" cy="18" rx="6" ry="8" fill="#fbcfe8"/><ellipse cx="32" cy="46" rx="6" ry="8" fill="#fbcfe8"/><ellipse cx="18" cy="32" rx="8" ry="6" fill="#fbcfe8"/><ellipse cx="46" cy="32" rx="8" ry="6" fill="#fbcfe8"/><ellipse cx="22" cy="22" rx="6.5" ry="6.5" fill="#f9a8d4" transform="rotate(-20 22 22)"/><ellipse cx="42" cy="42" rx="6.5" ry="6.5" fill="#f9a8d4" transform="rotate(-20 42 42)"/><ellipse cx="42" cy="22" rx="6.5" ry="6.5" fill="#f9a8d4" transform="rotate(20 42 22)"/><ellipse cx="22" cy="42" rx="6.5" ry="6.5" fill="#f9a8d4" transform="rotate(20 22 42)"/><circle cx="32" cy="32" r="8" fill="#fde047"/><circle cx="29" cy="31" r="1.8" fill="#713f12"/><circle cx="35" cy="31" r="1.8" fill="#713f12"/><path d="M29 35 Q32 37 35 35" stroke="#713f12" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>`,
  },
  {
    id: "spike",
    name: "Spike",
    category: "Nature",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="pc6" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d1fae5"/><stop offset="1" stop-color="#059669"/></linearGradient></defs><rect width="64" height="64" rx="14" fill="url(#pc6)"/><rect x="24" y="50" width="16" height="5" rx="2" fill="#b45309"/><rect x="26" y="16" width="12" height="36" rx="6" fill="#10b981"/><rect x="26" y="16" width="12" height="36" rx="6" fill="none" stroke="#065f46" stroke-width="1.8"/><rect x="15" y="28" width="8" height="14" rx="4" fill="#10b981"/><rect x="41" y="32" width="8" height="12" rx="4" fill="#10b981"/><path d="M32 22 L32 46" stroke="#065f46" stroke-width="1.6"/><circle cx="28" cy="33" r="1.8" fill="#052e16"/><circle cx="36" cy="33" r="1.8" fill="#052e16"/><path d="M29 38 Q32 40 35 38" stroke="#052e16" stroke-width="1.6" fill="none" stroke-linecap="round"/><circle cx="38" cy="13" r="2.6" fill="#f9a8d4"/><circle cx="38" cy="13" r="1" fill="#fde047"/></svg>`,
  },
  {
    id: "mellow",
    name: "Mellow",
    category: "Nature",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="pc7" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffedd5"/><stop offset="1" stop-color="#fb923c"/></linearGradient></defs><rect width="64" height="64" rx="14" fill="url(#pc7)"/><path d="M10 32 C10 20 20 12 32 12 C44 12 54 20 54 32 Z" fill="#ef4444"/><circle cx="22" cy="23" r="2.6" fill="#fff"/><circle cx="33" cy="18" r="2" fill="#fff"/><circle cx="43" cy="25" r="3" fill="#fff"/><rect x="26" y="32" width="12" height="18" rx="5" fill="#fff7ed"/><circle cx="29.5" cy="39" r="1.8" fill="#7c2d12"/><circle cx="34.5" cy="39" r="1.8" fill="#7c2d12"/><path d="M29.5 43 Q32 44.5 34.5 43" stroke="#7c2d12" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>`,
  },
  {
    id: "leafy",
    name: "Leafy",
    category: "Nature",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="pc8" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#dcfce7"/><stop offset="1" stop-color="#16a34a"/></linearGradient></defs><rect width="64" height="64" rx="14" fill="url(#pc8)"/><path d="M32 10 C46 18 50 34 40 48 C39 49.5 37 49.5 36 48 C26 36 24 24 30 12 C30.5 10.5 31.5 9.5 32 10 Z" fill="#4ade80"/><path d="M32 12 C30 24 30 36 37 47" stroke="#15803d" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M31 24 L26 22 M31 31 L25 30 M32 38 L27 38" stroke="#15803d" stroke-width="1.6" stroke-linecap="round"/><circle cx="33.5" cy="30" r="1.8" fill="#052e16"/><path d="M32 36 Q34.5 38 37 37" stroke="#052e16" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>`,
  },
  {
    id: "splash",
    name: "Splash",
    category: "Nature",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="pc9" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#cffafe"/><stop offset="1" stop-color="#0284c9"/></linearGradient></defs><rect width="64" height="64" rx="14" fill="url(#pc9)"/><path d="M32 10 C38 20 42 26 42 33 C42 39 37.5 43 32 43 C26.5 43 22 39 22 33 C22 26 26 20 32 10 Z" fill="#38bdf8"/><circle cx="28.5" cy="32" r="2" fill="#082f49"/><circle cx="35.5" cy="32" r="2" fill="#082f49"/><path d="M28.5 36.5 Q32 39 35.5 36.5" stroke="#082f49" stroke-width="1.8" fill="none" stroke-linecap="round"/><path d="M12 48 Q17 44 22 48 Q27 52 32 48 Q37 44 42 48 Q47 52 52 48" stroke="#e0f2fe" stroke-width="2.6" fill="none" stroke-linecap="round"/></svg>`,
  },
  {
    id: "avo",
    name: "Avo",
    category: "Food",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="pc10" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ecfccb"/><stop offset="1" stop-color="#65a30d"/></linearGradient></defs><rect width="64" height="64" rx="14" fill="url(#pc10)"/><ellipse cx="32" cy="34" rx="14" ry="16" fill="#3f6212"/><ellipse cx="32" cy="34" rx="11" ry="13" fill="#d9f99d"/><circle cx="32" cy="40" r="6.5" fill="#92400e"/><circle cx="32" cy="40" r="4.4" fill="#b45309"/><circle cx="28" cy="28" r="2.2" fill="#1a2e05"/><circle cx="36" cy="28" r="2.2" fill="#1a2e05"/><path d="M28.5 32.5 Q32 35 35.5 32.5" stroke="#1a2e05" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>`,
  },
  {
    id: "glaze",
    name: "Glaze",
    category: "Food",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="pc11" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fce7f3"/><stop offset="1" stop-color="#c084fc"/></linearGradient></defs><rect width="64" height="64" rx="14" fill="url(#pc11)"/><circle cx="32" cy="34" r="16" fill="#fbbf24"/><circle cx="32" cy="34" r="16" fill="none" stroke="#b45309" stroke-width="2"/><path d="M32 20 C40 20 46 26 46 33 C44 30 42 31 40 29 C38 33 34 32 32 30 C30 32 26 33 24 29 C22 31 20 30 18 33 C18 26 24 20 32 20 Z" fill="#f9a8d4"/><circle cx="32" cy="34" r="5.5" fill="#fae8ff"/><circle cx="32" cy="34" r="5.5" fill="none" stroke="#b45309" stroke-width="2"/><path d="M24 28 L26 30 M38 27 L40 29 M42 36 L44 36 M22 37 L24 37" stroke="#7c3aed" stroke-width="1.8" stroke-linecap="round"/><circle cx="28" cy="44" r="1.6" fill="#451a03"/><circle cx="36" cy="44" r="1.6" fill="#451a03"/></svg>`,
  },
  {
    id: "brew",
    name: "Brew",
    category: "Food",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="pc12" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffedd5"/><stop offset="1" stop-color="#d97706"/></linearGradient></defs><rect width="64" height="64" rx="14" fill="url(#pc12)"/><path d="M26 14 Q28 18 26 22 M34 14 Q36 18 34 22" stroke="#fff7ed" stroke-width="2.4" fill="none" stroke-linecap="round"/><rect x="18" y="26" width="24" height="20" rx="5" fill="#fff"/><path d="M42 30 C47 30 47 40 41 40" stroke="#fff" stroke-width="3.4" fill="none" stroke-linecap="round"/><rect x="18" y="34" width="24" height="12" rx="5" fill="#b45309"/><circle cx="26" cy="32" r="1.8" fill="#451a03"/><circle cx="34" cy="32" r="1.8" fill="#451a03"/><path d="M27.5 39.5 Q30 41.5 32.5 39.5" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round"/><rect x="24" y="48" width="14" height="3" rx="1.5" fill="#92400e"/></svg>`,
  },
  {
    id: "cuppy",
    name: "Cuppy",
    category: "Food",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="pc13" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fae8ff"/><stop offset="1" stop-color="#e879f9"/></linearGradient></defs><rect width="64" height="64" rx="14" fill="url(#pc13)"/><circle cx="32" cy="12" r="2.8" fill="#dc2626"/><path d="M20 28 C20 20 26 18 32 18 C38 18 44 20 44 28 Z" fill="#fdf4ff"/><circle cx="32" cy="21" r="5" fill="#f0abfc"/><path d="M21 30 L24 48 L40 48 L43 30 Z" fill="#c084fc"/><path d="M27 30 L28.5 48 M32 30 L32 48 M37 30 L35.5 48" stroke="#a855f7" stroke-width="1.8"/><circle cx="28" cy="39" r="1.8" fill="#581c87"/><circle cx="36" cy="39" r="1.8" fill="#581c87"/><path d="M29 43 Q32 45 35 43" stroke="#581c87" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>`,
  },
  {
    id: "melon",
    name: "Melon",
    category: "Food",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="pc14" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#dcfce7"/><stop offset="1" stop-color="#22c55e"/></linearGradient></defs><rect width="64" height="64" rx="14" fill="url(#pc14)"/><path d="M12 24 L52 24 L32 52 Z" fill="#4ade80"/><path d="M16.5 27.5 L47.5 27.5 L32 48.5 Z" fill="#fefce8"/><path d="M20.5 30.5 L43.5 30.5 L32 45.5 Z" fill="#f87171"/><ellipse cx="29" cy="36" rx="1.2" ry="1.8" fill="#450a0a"/><ellipse cx="35" cy="36" rx="1.2" ry="1.8" fill="#450a0a"/><ellipse cx="32" cy="40.5" rx="1.2" ry="1.8" fill="#450a0a"/><circle cx="27" cy="33" r="1.4" fill="#fff"/><circle cx="37" cy="33" r="1.4" fill="#fff"/></svg>`,
  },
  {
    id: "boba",
    name: "Boba",
    category: "Food",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="pc15" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fef3c7"/><stop offset="1" stop-color="#f59e0b"/></linearGradient></defs><rect width="64" height="64" rx="14" fill="url(#pc15)"/><path d="M36 8 L30 24" stroke="#ef4444" stroke-width="3.4" stroke-linecap="round"/><rect x="20" y="24" width="24" height="6" rx="3" fill="#fff"/><path d="M21 30 L24 52 L40 52 L43 30 Z" fill="#fde68a"/><path d="M22.5 36 L41.5 36 L40 52 L24 52 Z" fill="#d97706"/><circle cx="28" cy="48" r="2.2" fill="#451a03"/><circle cx="34" cy="49" r="2.2" fill="#451a03"/><circle cx="39" cy="47.5" r="2.2" fill="#451a03"/><circle cx="28" cy="33" r="1.6" fill="#451a03"/><circle cx="36" cy="33" r="1.6" fill="#451a03"/></svg>`,
  },
  {
    id: "gemmy",
    name: "Gemmy",
    category: "Objects",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="pc16" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e0f2fe"/><stop offset="1" stop-color="#7c3aed"/></linearGradient></defs><rect width="64" height="64" rx="14" fill="url(#pc16)"/><path d="M20 16 L28 16 L32 22 L36 16 L44 16 L50 26 L32 52 L14 26 Z" fill="#67e8f9"/><path d="M20 16 L28 16 L32 22 L36 16 L44 16 L50 26 L14 26 Z" fill="#a5f3fc"/><path d="M14 26 L50 26 L32 52 Z" fill="#22d3ee"/><path d="M32 22 L32 52 M22 26 L28 40 M42 26 L36 40" stroke="#0e7490" stroke-width="1.4"/><circle cx="48" cy="14" r="1.6" fill="#fff"/><circle cx="14" cy="48" r="1.6" fill="#fff"/><circle cx="27" cy="34" r="1.8" fill="#083344"/><circle cx="37" cy="34" r="1.8" fill="#083344"/><path d="M28.5 38.5 Q32 41 35.5 38.5" stroke="#083344" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>`,
  },
  {
    id: "royal",
    name: "Royal",
    category: "Objects",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="pc17" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fef9c3"/><stop offset="1" stop-color="#eab308"/></linearGradient></defs><rect width="64" height="64" rx="14" fill="url(#pc17)"/><circle cx="14" cy="20" r="3" fill="#f472b6"/><circle cx="32" cy="14" r="3" fill="#38bdf8"/><circle cx="50" cy="20" r="3" fill="#4ade80"/><path d="M16 24 L20 40 L44 40 L48 24 L40 30 L32 20 L24 30 Z" fill="#fbbf24"/><path d="M16 24 L20 40 L44 40 L48 24 L40 30 L32 20 L24 30 Z" fill="none" stroke="#92400e" stroke-width="2" stroke-linejoin="round"/><rect x="20" y="42" width="24" height="6" rx="3" fill="#92400e"/><circle cx="27" cy="34" r="1.8" fill="#451a03"/><circle cx="37" cy="34" r="1.8" fill="#451a03"/></svg>`,
  },
  {
    id: "floaty",
    name: "Floaty",
    category: "Objects",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="pc18" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fce7f3"/><stop offset="1" stop-color="#38bdf8"/></linearGradient></defs><rect width="64" height="64" rx="14" fill="url(#pc18)"/><path d="M32 44 Q30 48 33 51 Q36 54 34 58" stroke="#64748b" stroke-width="1.8" fill="none" stroke-linecap="round"/><ellipse cx="32" cy="27" rx="13" ry="15" fill="#f472b6"/><ellipse cx="27" cy="22" rx="4" ry="6" fill="#fbcfe8" opacity=".8"/><path d="M30 42 L34 42 L32 45 Z" fill="#be185d"/><circle cx="27.5" cy="27" r="2.2" fill="#500f28"/><circle cx="36.5" cy="27" r="2.2" fill="#500f28"/><path d="M28.5 32 Q32 34.5 35.5 32" stroke="#500f28" stroke-width="1.8" fill="none" stroke-linecap="round"/><ellipse cx="23.5" cy="31" rx="1.8" ry="1.3" fill="#fce7f3"/></svg>`,
  },
  {
    id: "bright",
    name: "Bright",
    category: "Objects",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="pc19" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fef9c3"/><stop offset="1" stop-color="#fb923c"/></linearGradient></defs><rect width="64" height="64" rx="14" fill="url(#pc19)"/><path d="M32 6 L32 9 M14 14 L16 16 M50 14 L48 16 M10 32 L13 32 M51 32 L54 32" stroke="#ea580c" stroke-width="2.2" stroke-linecap="round"/><circle cx="32" cy="30" r="12" fill="#fde047"/><circle cx="32" cy="30" r="12" fill="none" stroke="#b45309" stroke-width="2"/><circle cx="28" cy="28" r="2.2" fill="#713f12"/><circle cx="36" cy="28" r="2.2" fill="#713f12"/><path d="M28 33 Q32 36 36 33" stroke="#713f12" stroke-width="2" fill="none" stroke-linecap="round"/><rect x="27" y="42" width="10" height="4" rx="2" fill="#94a3b8"/><rect x="28.5" y="47" width="7" height="4" rx="2" fill="#64748b"/></svg>`,
  },
  {
    id: "beats",
    name: "Beats",
    category: "Objects",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="pc20" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ede9fe"/><stop offset="1" stop-color="#6d28d9"/></linearGradient></defs><rect width="64" height="64" rx="14" fill="url(#pc20)"/><path d="M16 38 C16 24 24 16 32 16 C40 16 48 24 48 38" stroke="#1e1b4b" stroke-width="4.5" fill="none" stroke-linecap="round"/><rect x="12" y="34" width="10" height="16" rx="5" fill="#ddd6fe"/><rect x="42" y="34" width="10" height="16" rx="5" fill="#ddd6fe"/><rect x="12" y="34" width="10" height="16" rx="5" fill="none" stroke="#1e1b4b" stroke-width="2"/><rect x="42" y="34" width="10" height="16" rx="5" fill="none" stroke="#1e1b4b" stroke-width="2"/><circle cx="17" cy="42" r="1.6" fill="#7c3aed"/><circle cx="47" cy="42" r="1.6" fill="#7c3aed"/><path d="M50 12 L50 20 M50 12 L54 14 M50 20 L54 18" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="14" cy="12" r="1.6" fill="#fde047"/></svg>`,
  },
  {
    id: "player",
    name: "Player",
    category: "Objects",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="pc21" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e2e8f0"/><stop offset="1" stop-color="#0ea5e9"/></linearGradient></defs><rect width="64" height="64" rx="14" fill="url(#pc21)"/><rect x="12" y="22" width="40" height="22" rx="11" fill="#0f172a"/><path d="M22 30 L22 38 M18 34 L26 34" stroke="#38bdf8" stroke-width="2.6" stroke-linecap="round"/><circle cx="38" cy="31" r="2.4" fill="#f472b6"/><circle cx="43" cy="36" r="2.4" fill="#4ade80"/><circle cx="33" cy="36" r="2.4" fill="#fde047"/><circle cx="38" cy="41" r="2.4" fill="#38bdf8"/></svg>`,
  },
];
