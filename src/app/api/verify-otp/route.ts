import { NextResponse } from "next/server";

if (!(global as any).otpStore) {
  (global as any).otpStore = {};
}

export async function POST(request: Request) {
  try {
    const { phone, otp } = await request.json();

    if (!phone || !otp) {
      return NextResponse.json(
        { success: false, error: "Phone number and OTP are required" },
        { status: 400 }
      );
    }

    const cleanPhone = phone.replace(/\D/g, "").slice(-10);
    const provider = process.env.ACTIVE_SMS_PROVIDER || "mock";

    const stored = (global as any).otpStore[cleanPhone];
    if (!stored) {
      return NextResponse.json(
        { success: false, error: "OTP expired or not found. Request a new one." },
        { status: 400 }
      );
    }

    let isValid = false;

    if (provider === "messagecentral") {
      const verificationId = stored;
      const mcCustomerId = process.env.MC_CUSTOMER_ID;
      const mcPassword = process.env.MC_PASSWORD;

      if (!mcCustomerId || !mcPassword) {
        throw new Error("Message Central credentials missing in Vercel");
      }

      const tokenRes = await fetch(
        `https://cpaas.messagecentral.com/auth/v1/authentication/token?customerId=${mcCustomerId}&key=${mcPassword}&scope=NEW&country=91`,
        { method: "GET", headers: { accept: "*/*" } }
      );
      const tokenData = await tokenRes.json();

      if (!tokenData.token) {
        throw new Error(`Token failed: ${JSON.stringify(tokenData)}`);
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
        delete (global as any).otpStore[cleanPhone];
      }
    } else {
      if (Date.now() > stored.expiry) {
        delete (global as any).otpStore[cleanPhone];
        return NextResponse.json(
          { success: false, error: "OTP has expired" },
          { status: 400 }
        );
      }

      if (stored.otp === otp) {
        isValid = true;
        delete (global as any).otpStore[cleanPhone];
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
    }

    return NextResponse.json(
      { success: false, error: "Invalid OTP. Please try again." },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("[verify-otp Error]:", error.message || error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to verify OTP" },
      { status: 500 }
    );
  }
}
