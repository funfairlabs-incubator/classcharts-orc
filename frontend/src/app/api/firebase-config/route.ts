import { NextResponse } from 'next/server';

// Exposes the Firebase web config (all public values) for use by the service worker.
// These env vars are NEXT_PUBLIC_ so they're already in the client bundle anyway;
// this route just gives the service worker a way to fetch them without hard-coding.
export async function GET() {
  return NextResponse.json({
    apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  });
}
