/**
 * Vercel Serverless Entry Point
 * Re-exports the Express app as a Vercel serverless function
 */
import app from '../src/api/server.js';

export default app;
