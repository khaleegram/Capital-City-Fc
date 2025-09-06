
import { getDocs, collection, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { MetadataRoute } from 'next'
 
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

  // Fetch dynamic data from Firestore
  const playersSnapshot = await getDocs(collection(db, 'players'));
  const newsSnapshot = await getDocs(collection(db, 'news'));
  const fixturesSnapshot = await getDocs(collection(db, 'fixtures'));
  const videosSnapshot = await getDocs(collection(db, 'videos'));

  const players = playersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as { updatedAt?: Timestamp } }));
  const news = newsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as { date: string } }));
  const fixtures = fixturesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as { date: Timestamp } }));
  const videos = videosSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as { uploadDate: Timestamp } }));

  const playerRoutes = players.map(player => ({
    url: `${baseUrl}/players/${player.id}`,
    lastModified: player.updatedAt?.toDate() || new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.7
  }));

  const newsRoutes = news.map(article => ({
    url: `${baseUrl}/news/${article.id}`,
    lastModified: new Date(article.date),
    changeFrequency: 'daily' as const,
    priority: 0.8
  }));

  const fixtureRoutes = fixtures.map(fixture => ({
    url: `${baseUrl}/fixtures/${fixture.id}`,
    lastModified: fixture.date.toDate(),
    changeFrequency: 'daily' as const,
    priority: 0.9
  }));
  
  const videoRoutes = videos.map(video => ({
    url: `${baseUrl}/videos/${video.id}`,
    lastModified: video.uploadDate.toDate(),
    changeFrequency: 'monthly' as const,
    priority: 0.6
  }));

  const staticRoutes = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 1 },
    { url: `${baseUrl}/players`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.8 },
    { url: `${baseUrl}/news`, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 0.9 },
    { url: `${baseUrl}/fixtures`, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 0.9 },
    { url: `${baseUrl}/videos`, lastModified: new Date(), changeFrequency: 'monthly' as const, priority: 0.7 },
    { url: `${baseUrl}/club`, lastModified: new Date(), changeFrequency: 'monthly' as const, priority: 0.5 },
  ];

  return [
    ...staticRoutes,
    ...playerRoutes,
    //...newsRoutes, // Uncomment if you create individual news article pages
    ...fixtureRoutes,
    ...videoRoutes,
  ];
}
