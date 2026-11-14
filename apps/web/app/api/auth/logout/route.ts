import { NextResponse } from "next/server";

function createLogoutResponse() {
  const response = NextResponse.json({ success: true, message: "Logged out successfully" });

  const cookiesToClear = ["authToken", "token", "userRole", "refreshToken"];
  const paths = ["/", "/admin", "/app", "/dashboard"];

  cookiesToClear.forEach((name) => {
    paths.forEach((path) => {
      response.cookies.set({
        name,
        value: "",
        path,
        maxAge: 0,
        expires: new Date(0),
        sameSite: "lax",
      });
    });
  });

  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");

  return response;
}

export async function POST() {
  return createLogoutResponse();
}

export async function GET() {
  return createLogoutResponse();
}

