
import { getDocs, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { MetadataRoute } from 'next'
 
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

  // Fetch dynamic data from Firestore
  const playersSnapshot = await getDocs(collection(db, 'players'));
  const newsSnapshot = await getDocs(collection(db, 'news'));
  const fixturesSnapshot = await getDocs(collection(db, 'fixtures'));

  const players = playersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  const news = newsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  const fixtures = fixturesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));


  const playerRoutes = players.map(player => ({
    url: `${baseUrl}/players/${player.id}`,
    lastModified: new Date(), // In a real app, you might use an `updatedAt` field
    changeFrequency: 'weekly' as const,
    priority: 0.7
  }));

  const fixtureRoutes = fixtures.map(fixture => ({
    url: `${baseUrl}/fixtures/${fixture.id}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.8
  }));

  // Assuming news articles don't have individual pages yet based on previous conversations
  // If they do, you would create routes for them like this:
  // const newsRoutes = news.map(article => ({
  //   url: `${baseUrl}/news/${article.id}`, 
  //   lastModified: new Date(article.date),
  // }));

  const staticRoutes = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 1
    },
    {
      url: `${baseUrl}/players`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.8
    },
    {
      url: `${baseUrl}/news`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.9
    },
     {
      url: `${baseUrl}/fixtures`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.9
    },
    {
      url: `${baseUrl}/videos`,
      lastModified: new Date(),
       changeFrequency: 'monthly' as const,
      priority: 0.6
    },
    {
      url: `${baseUrl}/scouting`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.5
    },
  ];

  return [
    ...staticRoutes,
    ...playerRoutes,
    ...fixtureRoutes,
  ]
}
