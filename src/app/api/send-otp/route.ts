import { NextResponse } from "next/server";

if (!(global as any).otpStore) {
  (global as any).otpStore = {};
}

export async function POST(request: Request) {
  try {
    const { phone } = await request.json();

    if (!phone) {
      return NextResponse.json(
        { success: false, error: "Phone number is required" },
        { status: 400 }
      );
    }

    const cleanPhone = phone.replace(/\D/g, "").slice(-10);
    const provider = process.env.ACTIVE_SMS_PROVIDER || "mock";

    switch (provider) {
      case "messagecentral": {
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

        const mcSendRes = await fetch(
          `https://cpaas.messagecentral.com/verification/v3/send?countryCode=91&flowType=SMS&mobileNumber=${cleanPhone}`,
          {
            method: "POST",
            headers: {
              authToken: tokenData.token,
              accept: "*/*",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              otpLength: 6,
            }),
          }
        );

        const mcSendData = await mcSendRes.json();

        if (mcSendRes.status !== 200 || !mcSendData.data?.verificationId) {
          throw new Error(`OTP Send Failed: ${JSON.stringify(mcSendData)}`);
        }

        (global as any).otpStore[cleanPhone] =
          mcSendData.data.verificationId;

        return NextResponse.json({
          success: true,
          message: "OTP sent successfully",
          verificationId: mcSendData.data.verificationId,
        });
      }

      case "mock":
      default: {
        (global as any).otpStore[cleanPhone] = {
          otp: "123456",
          expiry: Date.now() + 5 * 60 * 1000,
        };

        return NextResponse.json({
          success: true,
          message: "Mock OTP sent",
        });
      }
    }
  } catch (error: any) {
    console.error("[send-otp Error]:", error.message || error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to send OTP" },
      { status: 500 }
    );
  }
}
