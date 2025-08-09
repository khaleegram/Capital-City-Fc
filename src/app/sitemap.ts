import { MetadataRoute } from 'next'
 
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://your-domain.com'; // Replace with your actual domain

  // In a real app, you would fetch these from your database
  const players = [{ id: '1' }, { id: '2' }]; 
  const news = [{ id: '1' }, { id: '2' }];

  const playerRoutes = players.map(player => ({
    url: `${baseUrl}/players/${player.id}`,
    lastModified: new Date(),
  }));

  const newsRoutes = news.map(article => ({
    url: `${baseUrl}/news/${article.id}`, // Assuming you have individual news pages
    lastModified: new Date(),
  }));

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
    },
    {
      url: `${baseUrl}/players`,
      lastModified: new Date(),
    },
    {
      url: `${baseUrl}/news`,
      lastModified: new Date(),
    },
    {
      url: `${baseUrl}/videos`,
      lastModified: new Date(),
    },
    ...playerRoutes,
    // ...newsRoutes, // Uncomment if you create individual news article pages
  ]
}
