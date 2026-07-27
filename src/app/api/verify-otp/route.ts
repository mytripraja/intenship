import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { phone, otp, firebaseToken } = await req.json();
    const provider = process.env.ACTIVE_SMS_PROVIDER || "firebase";

    if (provider === "firebase") {
      if (firebaseToken) {
        return NextResponse.json({ success: true, firebaseToken });
      }
      return NextResponse.json(
        { success: false, error: "No Firebase token provided" },
        { status: 400 }
      );
    }

    const cleanPhone = phone.replace("+91", "").replace(/\D/g, "").trim();

    if (!global.otpStore || !global.otpStore[cleanPhone]) {
      return NextResponse.json(
        { success: false, error: "OTP expired or not found" },
        { status: 400 }
      );
    }

    const stored = global.otpStore[cleanPhone];

    if (Date.now() > stored.expiry) {
      delete global.otpStore[cleanPhone];
      return NextResponse.json(
        { success: false, error: "OTP has expired" },
        { status: 400 }
      );
    }

    if (stored.otp !== otp) {
      return NextResponse.json(
        { success: false, error: "Invalid OTP" },
        { status: 400 }
      );
    }

    delete global.otpStore[cleanPhone];

    const uid = `+91${cleanPhone}`;
    let customToken: string | null = null;

    try {
      const { adminAuth } = await import("@/lib/firebase-admin");
      customToken = await adminAuth.createCustomToken(uid);
    } catch {
      customToken = null;
    }

    return NextResponse.json({
      success: true,
      message: "OTP verified successfully",
      firebaseToken: customToken,
    });
  } catch (error: any) {
    console.error(`[verify-otp] Error:`, error.message);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to verify OTP" },
      { status: 500 }
    );
  }
}
