import 'dotenv/config';

export const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_dev_7281';
export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "399404080423-b115vb4eo6q69o45il7jfraje56r3tgn.apps.googleusercontent.com";
export const PORT = process.env.PORT || 3000;
export const NODE_ENV = process.env.NODE_ENV || 'development';
export const DATABASE_URL = process.env.DATABASE_URL;
