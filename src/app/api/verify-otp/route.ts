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

    let isValid = false;

    if (provider === "messagecentral") {
      const verificationId = global.otpStore[cleanPhone] as string;
      if (!verificationId) {
        return NextResponse.json(
          { success: false, error: "No pending OTP found for this number" },
          { status: 400 }
        );
      }

      const mcCustomerId = process.env.MC_CUSTOMER_ID;
      const mcPassword = process.env.MC_PASSWORD;
      if (!mcCustomerId || !mcPassword)
        throw new Error("Message Central credentials not set");

      const tokenRes = await fetch(
        `https://cpaas.messagecentral.com/auth/v1/authentication/token?customerId=${mcCustomerId}&key=${mcPassword}&scope=NEW&country=91`,
        { method: "GET", headers: { accept: "*/*" } }
      );
      const tokenData = await tokenRes.json();

      if (!tokenData.token) {
        throw new Error(
          `Token generation failed: ${JSON.stringify(tokenData)}`
        );
      }

      const mcVerifyRes = await fetch(
        `https://cpaas.messagecentral.com/verification/v3/validateOtp?countryCode=91&mobileNumber=${cleanPhone}&verificationId=${verificationId}&customerId=${mcCustomerId}&code=${otp}`,
        {
          method: "GET",
          headers: { authToken: tokenData.token, accept: "*/*" },
        }
      );

      const mcVerifyData = await mcVerifyRes.json();

      if (mcVerifyRes.status === 200 && mcVerifyData.status === 200) {
        isValid = true;
        delete global.otpStore[cleanPhone];
      }
    } else {
      const stored = global.otpStore[cleanPhone] as { otp: string; expiry: number };

      if (Date.now() > stored.expiry) {
        delete global.otpStore[cleanPhone];
        return NextResponse.json(
          { success: false, error: "OTP has expired" },
          { status: 400 }
        );
      }

      if (stored.otp === otp) {
        isValid = true;
        delete global.otpStore[cleanPhone];
      }
    }

    if (isValid) {
      let customToken: string | null = null;
      try {
        const { adminAuth } = await import("@/lib/firebase-admin");
        customToken = await adminAuth.createCustomToken(`+91${cleanPhone}`);
      } catch {
        customToken = null;
      }

      return NextResponse.json({
        success: true,
        message: "OTP verified successfully",
        firebaseToken: customToken,
      });
    } else {
      return NextResponse.json(
        { success: false, error: "Invalid or expired OTP" },
        { status: 400 }
      );
    }
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("[verify-otp] Error:", err.message);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to verify OTP" },
      { status: 500 }
    );
  }
}
