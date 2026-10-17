import type { Harmony } from '@shared/colours';

export interface PalettePreset {
  id: string;
  name: string;
  tags: string[];
  harmony: Harmony;
  colours: string[];
}

export const PALETTE_PRESETS: readonly PalettePreset[] = [
  {
    id: 'sunset-drive',
    name: 'Sunset drive',
    tags: ['warm', 'retro', 'synth'],
    harmony: 'analogous',
    colours: ['#2b0f54', '#ab1f65', '#ff4f69', '#ff8a5c', '#fff7a0'],
  },
  {
    id: 'deep-sea',
    name: 'Deep sea',
    tags: ['cool', 'ocean', 'calm'],
    harmony: 'monochromatic',
    colours: ['#03045e', '#0077b6', '#00b4d8', '#90e0ef', '#caf0f8'],
  },
  {
    id: 'forest-floor',
    name: 'Forest floor',
    tags: ['nature', 'earth', 'green'],
    harmony: 'analogous',
    colours: ['#1b4332', '#2d6a4f', '#40916c', '#74c69d', '#d8f3dc'],
  },
  {
    id: 'pixel-dusk',
    name: 'Pixel dusk',
    tags: ['pixel', 'game', 'night'],
    harmony: 'custom',
    colours: ['#0d0221', '#261447', '#ff3864', '#2de2e6', '#f6f740'],
  },
  {
    id: 'desert-heat',
    name: 'Desert heat',
    tags: ['warm', 'sand', 'earth'],
    harmony: 'analogous',
    colours: ['#6a040f', '#d00000', '#e85d04', '#faa307', '#ffba08'],
  },
  {
    id: 'arctic-mint',
    name: 'Arctic mint',
    tags: ['cool', 'pastel', 'clean'],
    harmony: 'analogous',
    colours: ['#e0fbfc', '#c2dfe3', '#9db4c0', '#5c6b73', '#253237'],
  },
  {
    id: 'candy-shop',
    name: 'Candy shop',
    tags: ['pastel', 'playful', 'sweet'],
    harmony: 'custom',
    colours: ['#ffadad', '#ffd6a5', '#fdffb6', '#caffbf', '#9bf6ff'],
  },
  {
    id: 'royal-court',
    name: 'Royal court',
    tags: ['purple', 'gold', 'fantasy'],
    harmony: 'complementary',
    colours: ['#3c096c', '#7b2cbf', '#c77dff', '#ffd60a', '#ffc300'],
  },
  {
    id: 'mono-ink',
    name: 'Mono ink',
    tags: ['grey', 'neutral', 'ui'],
    harmony: 'shades',
    colours: ['#0b0b0b', '#2f2f2f', '#5e5e5e', '#9a9a9a', '#e6e6e6'],
  },
  {
    id: 'coral-reef',
    name: 'Coral reef',
    tags: ['ocean', 'warm', 'tropical'],
    harmony: 'splitComplementary',
    colours: ['#ff6f59', '#ffb400', '#17c3b2', '#227c9d', '#fef9ef'],
  },
  {
    id: 'neon-arcade',
    name: 'Neon arcade',
    tags: ['neon', 'game', 'synth'],
    harmony: 'triad',
    colours: ['#ff00a0', '#00f0ff', '#faff00', '#1a0033', '#4b0082'],
  },
  {
    id: 'autumn-walk',
    name: 'Autumn walk',
    tags: ['warm', 'nature', 'brown'],
    harmony: 'analogous',
    colours: ['#582f0e', '#7f4f24', '#a68a64', '#c2c5aa', '#656d4a'],
  },
  {
    id: 'lavender-field',
    name: 'Lavender field',
    tags: ['purple', 'pastel', 'calm'],
    harmony: 'monochromatic',
    colours: ['#5a189a', '#7b2cbf', '#9d4edd', '#c77dff', '#e0aaff'],
  },
  {
    id: 'terracotta',
    name: 'Terracotta',
    tags: ['warm', 'earth', 'clay'],
    harmony: 'analogous',
    colours: ['#9c2a00', '#c8553d', '#e97f5a', '#f2cc8f', '#f4f1de'],
  },
  {
    id: 'glacier',
    name: 'Glacier',
    tags: ['cool', 'blue', 'ice'],
    harmony: 'shades',
    colours: ['#0a2463', '#3e92cc', '#8ac4ff', '#d6eaff', '#fffaff'],
  },
  {
    id: 'dungeon',
    name: 'Dungeon',
    tags: ['dark', 'game', 'stone'],
    harmony: 'custom',
    colours: ['#121212', '#2b2d42', '#4a4e69', '#9a8c98', '#c9ada7'],
  },
  {
    id: 'spring-meadow',
    name: 'Spring meadow',
    tags: ['green', 'nature', 'fresh'],
    harmony: 'splitComplementary',
    colours: ['#386641', '#6a994e', '#a7c957', '#f2e8cf', '#bc4749'],
  },
  {
    id: 'cyber-grid',
    name: 'Cyber grid',
    tags: ['neon', 'dark', 'tech'],
    harmony: 'complementary',
    colours: ['#03001e', '#7303c0', '#ec38bc', '#fdeff9', '#00e5ff'],
  },
  {
    id: 'ocean-sunrise',
    name: 'Ocean sunrise',
    tags: ['warm', 'cool', 'sky'],
    harmony: 'square',
    colours: ['#f72585', '#7209b7', '#3a0ca3', '#4361ee', '#4cc9f0'],
  },
  {
    id: 'paper-and-ink',
    name: 'Paper and ink',
    tags: ['neutral', 'ui', 'print'],
    harmony: 'custom',
    colours: ['#fefae0', '#dda15e', '#bc6c25', '#606c38', '#283618'],
  },
  {
    id: 'cherry-blossom',
    name: 'Cherry blossom',
    tags: ['pink', 'pastel', 'spring'],
    harmony: 'monochromatic',
    colours: ['#590d22', '#a4133c', '#ff4d6d', '#ff8fa3', '#ffccd5'],
  },
  {
    id: 'volcanic',
    name: 'Volcanic',
    tags: ['dark', 'warm', 'fire'],
    harmony: 'shades',
    colours: ['#0b090a', '#660708', '#a4161a', '#e5383b', '#f5f3f4'],
  },
  {
    id: 'retro-console',
    name: 'Retro console',
    tags: ['pixel', 'game', 'retro'],
    harmony: 'custom',
    colours: ['#0f380f', '#306230', '#8bac0f', '#9bbc0f', '#e0f8d0'],
  },
  {
    id: 'cool-slate',
    name: 'Cool slate',
    tags: ['grey', 'blue', 'ui'],
    harmony: 'shades',
    colours: ['#0f172a', '#1e293b', '#475569', '#94a3b8', '#e2e8f0'],
  },
];

export function searchPresets(
  query: string,
  presets: readonly PalettePreset[] = PALETTE_PRESETS,
): PalettePreset[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...presets];
  return presets.filter(
    (preset) =>
      preset.name.toLowerCase().includes(needle) ||
      preset.tags.some((tag) => tag.includes(needle)) ||
      preset.harmony.toLowerCase().includes(needle),
  );
}
