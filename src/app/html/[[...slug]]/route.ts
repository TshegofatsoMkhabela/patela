import { promises as fs } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
};

export async function GET(request: NextRequest, context: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = await context.params;

  // Redirect bare /html to /html/index.html so relative asset paths resolve inside /html/
  if (!slug || slug.length === 0) {
    const url = request.nextUrl.clone();
    url.pathname = "/html/index.html";
    return NextResponse.redirect(url);
  }

  const htmlRoot = path.resolve(process.cwd(), "html");
  const requestedPath = path.resolve(htmlRoot, ...slug);

  // Prevent any directory traversal outside htmlRoot
  if (!requestedPath.startsWith(htmlRoot + path.sep) && requestedPath !== htmlRoot) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  try {
    const stat = await fs.stat(requestedPath);
    const targetFile = stat.isDirectory() ? path.join(requestedPath, "index.html") : requestedPath;
    const content = await fs.readFile(targetFile);
    const ext = path.extname(targetFile).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    return new NextResponse(content, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-cache",
      },
    });
  } catch {
    return new NextResponse("Not Found", { status: 404 });
  }
}
