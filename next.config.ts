
require('dotenv').config();
import type {NextConfig} from 'next';

const withPWA = require('next-pwa')({
  dest: 'public',
  importScripts: ["/firebase-messaging-sw.js"],
  disable: process.env.NODE_ENV === 'development',
})

const r2PublicUrl = process.env.R2_PUBLIC_URL;
const r2Hostname = r2PublicUrl ? new URL(r2PublicUrl).hostname : undefined;

const remotePatterns: NextConfig['images']['remotePatterns'] = [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        port: '',
        pathname: '/**',
      },
];

if (r2Hostname) {
  remotePatterns.push({
      protocol: 'https',
      hostname: r2Hostname,
      port: '',
      pathname: '/**',
  });
}


const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '4.5mb',
    },
  },
};

module.exports = withPWA(nextConfig);
