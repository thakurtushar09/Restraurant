import type { Request, Response, NextFunction } from "express";

export function notFound(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
}

export function errorHandler(error: unknown,_req: Request,res: Response,next: NextFunction): void {
  if (res.headersSent) {
    next(error);
    return;
  }

  // Malformed JSON bodies from express.json()
  if (error instanceof SyntaxError && "body" in error) {
    res.status(400).json({
      success: false,
      message: "Request body must be valid JSON",
    });
    return;
  }

  console.error("Unhandled error:", error);

  res.status(500).json({
    success: false,
    message: "Something went wrong",
  });
}
