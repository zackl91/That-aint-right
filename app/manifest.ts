import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "That AIn't Right",
    short_name: "AIn't Right",
    description: 'Daily game: pick the real photo, not the AI one.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f3eee3',
    theme_color: '#f3eee3',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
  };
}
