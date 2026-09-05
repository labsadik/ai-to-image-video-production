export const PLATFORM_SPECS = {
  youtube_thumbnail: { width: 1280, height: 720, maxBytes: 2_000_000, mimeTypes: ['image/jpeg', 'image/png', 'image/webp'] },
  instagram_post: { width: 1080, height: 1350, maxBytes: 8_000_000, mimeTypes: ['image/jpeg', 'image/png', 'image/webp'] },
  instagram_story: { width: 1080, height: 1920, maxBytes: 8_000_000, mimeTypes: ['image/jpeg', 'image/png', 'image/webp'] },
  facebook_post: { width: 1200, height: 630, maxBytes: 8_000_000, mimeTypes: ['image/jpeg', 'image/png', 'image/webp'] },
  facebook_cover: { width: 1640, height: 856, maxBytes: 8_000_000, mimeTypes: ['image/jpeg', 'image/png', 'image/webp'] },
  pinterest_pin: { width: 1000, height: 1500, maxBytes: 8_000_000, mimeTypes: ['image/jpeg', 'image/png', 'image/webp'] },
  linkedin_post: { width: 1200, height: 627, maxBytes: 8_000_000, mimeTypes: ['image/jpeg', 'image/png', 'image/webp'] },
  x_post: { width: 1600, height: 900, maxBytes: 8_000_000, mimeTypes: ['image/jpeg', 'image/png', 'image/webp'] },
  ad_creative: { width: 1200, height: 628, maxBytes: 8_000_000, mimeTypes: ['image/jpeg', 'image/png', 'image/webp'] },
  poster: { width: 2048, height: 3072, maxBytes: 12_000_000, mimeTypes: ['image/jpeg', 'image/png', 'image/webp'] },
  website_banner: { width: 1920, height: 600, maxBytes: 8_000_000, mimeTypes: ['image/jpeg', 'image/png', 'image/webp'] },
} as const;

export type PlatformId = keyof typeof PLATFORM_SPECS;
