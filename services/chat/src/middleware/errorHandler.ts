import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  console.error(err.message);
  if (!res.headersSent) {
    res.status(500).json({ error: 'internal server error' });
  }
}
