import { NextResponse } from "next/server";

if (!(global as any).otpStore) {
  (global as any).otpStore = {};
}

export async function POST(request: Request) {
  try {
    const { phone, otp, verificationId: clientVerificationId } =
      await request.json();

    if (!phone || !otp) {
      return NextResponse.json(
        { success: false, error: "Phone and OTP are required" },
        { status: 400 }
      );
    }

    const cleanPhone = phone.replace(/\D/g, "").slice(-10);
    const provider = process.env.ACTIVE_SMS_PROVIDER || "mock";

    switch (provider) {
      case "messagecentral": {
        const mcCustomerId = process.env.MC_CUSTOMER_ID;
        const mcPassword = process.env.MC_PASSWORD;
        const verificationId =
          clientVerificationId || (global as any).otpStore[cleanPhone];

        if (!verificationId) {
          return NextResponse.json(
            {
              success: false,
              error:
                "No OTP requested for this number, or it expired.",
            },
            { status: 400 }
          );
        }

        const tokenRes = await fetch(
          `https://cpaas.messagecentral.com/auth/v1/authentication/token?customerId=${mcCustomerId}&key=${mcPassword}&scope=NEW&country=91`,
          { method: "GET", headers: { accept: "*/*" } }
        );
        const tokenData = await tokenRes.json();

        const validateUrl = `https://cpaas.messagecentral.com/verification/v3/validateOtp?verificationId=${verificationId}&code=${otp}`;

        const mcValidateRes = await fetch(validateUrl, {
          method: "GET",
          headers: { authToken: tokenData.token, accept: "*/*" },
        });

        const mcValidateData = await mcValidateRes.json();

        delete (global as any).otpStore[cleanPhone];

        if (
          mcValidateData.data?.verificationStatus ===
          "VERIFICATION_COMPLETED"
        ) {
          return NextResponse.json({
            success: true,
            message: "OTP verified successfully",
          });
        }

        return NextResponse.json(
          { success: false, error: "Invalid OTP" },
          { status: 400 }
        );
      }

      case "mock":
      default: {
        const expectedOtp = (global as any).otpStore[cleanPhone]?.otp;
        delete (global as any).otpStore[cleanPhone];

        if (otp === expectedOtp) {
          return NextResponse.json({
            success: true,
            message: "Mock OTP verified",
          });
        }
        return NextResponse.json(
          { success: false, error: "Invalid Mock OTP" },
          { status: 400 }
        );
      }
    }
  } catch (error: any) {
    console.error("[verify-otp Error]:", error.message || error);
    return NextResponse.json(
      { success: false, error: "Server error" },
      { status: 500 }
    );
  }
}
