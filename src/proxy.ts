import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicSupabaseConfig } from "@/lib/env";

// Pages reachable without a session. Everything else requires login.
const PUBLIC_PATHS = ["/login", "/signup", "/forgot-password", "/reset-password", "/legal"];

// API paths that authenticate themselves by other means (cron secret).
const SELF_AUTHENTICATED_API_PREFIXES = ["/api/cron/"];

export async function proxy(request: NextRequest) {
  const { url, publishableKey } = getPublicSupabaseConfig();

  if (!url || !publishableKey) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        supabaseResponse = NextResponse.next({ request });

        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublicPath = PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  const isApiPath = pathname.startsWith("/api/");
  const isSelfAuthenticatedApi = SELF_AUTHENTICATED_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (!user) {
    // API routes also accept Authorization: Bearer tokens, validated in the route itself.
    const hasBearer = Boolean(request.headers.get("authorization"));

    if (isApiPath && !isSelfAuthenticatedApi && !hasBearer) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    if (!isApiPath && !isPublicPath) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.search = "";
      return NextResponse.redirect(loginUrl);
    }
  }

  if (user && (pathname === "/login" || pathname === "/signup")) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/dashboard";
    dashboardUrl.search = "";
    return NextResponse.redirect(dashboardUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
