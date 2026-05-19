import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  if (
    request.nextUrl.pathname === "/" &&
    request.nextUrl.searchParams.get("display") === "1"
  ) {
    return NextResponse.redirect(new URL("/display", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/",
};
