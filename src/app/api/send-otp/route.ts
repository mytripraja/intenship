import { NextResponse } from "next/server";

declare global {
  var otpStore: Record<string, { otp: string; expiry: number } | string>;
}

global.otpStore = global.otpStore || {};

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(req: Request) {
  try {
    const { phone } = await req.json();
    const cleanPhone = phone.replace("+91", "").replace(/\D/g, "").trim();

    if (cleanPhone.length !== 10) {
      return NextResponse.json(
        { success: false, error: "Invalid phone number" },
        { status: 400 }
      );
    }

    const otp = generateOTP();
    const provider = process.env.ACTIVE_SMS_PROVIDER || "firebase";

    if (provider !== "messagecentral") {
      global.otpStore[cleanPhone] = {
        otp,
        expiry: Date.now() + 5 * 60 * 1000,
      };
    }

    switch (provider) {
      case "fast2sms": {
        const apiKey = process.env.FAST2SMS_API_KEY;
        if (!apiKey) throw new Error("FAST2SMS_API_KEY not set");

        const response = await fetch("https://www.fast2sms.com/dev/bulkV2", {
          method: "POST",
          headers: {
            authorization: apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            route: "otp",
            variables_values: otp,
            numbers: cleanPhone,
          }),
        });

        const data = await response.json();
        if (!data.return) {
          throw new Error(data.message || "Fast2SMS API failed");
        }
        break;
      }

      case "twilio": {
        const sid = process.env.TWILIO_ACCOUNT_SID;
        const token = process.env.TWILIO_AUTH_TOKEN;
        const from = process.env.TWILIO_PHONE_NUMBER;
        if (!sid || !token || !from)
          throw new Error("Twilio credentials not set");

        const basicAuth = Buffer.from(`${sid}:${token}`).toString("base64");
        const body = new URLSearchParams({
          To: `+91${cleanPhone}`,
          From: from,
          Body: `Your verification OTP is: ${otp}`,
        });

        const response = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
          {
            method: "POST",
            headers: {
              Authorization: `Basic ${basicAuth}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body,
          }
        );

        if (!response.ok) {
          const err = await response.text();
          throw new Error(`Twilio API failed: ${err}`);
        }
        break;
      }

      case "msg91": {
        const apiKey = process.env.MSG91_API_KEY;
        const templateId = process.env.MSG91_TEMPLATE_ID;
        if (!apiKey) throw new Error("MSG91_API_KEY not set");

        const response = await fetch("https://api.msg91.com/api/v5/otp", {
          method: "POST",
          headers: {
            authkey: apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            mobile: `91${cleanPhone}`,
            otp: otp,
            template_id: templateId,
          }),
        });

        const data = await response.json();
        if (data.type !== "success") {
          throw new Error(data.message || "MSG91 API failed");
        }
        break;
      }

      case "messagecentral": {
        const mcCustomerId = process.env.MC_CUSTOMER_ID;
        const mcPassword = process.env.MC_PASSWORD;
        if (!mcCustomerId || !mcPassword)
          throw new Error("Message Central credentials not set");

        const mcPasswordBase64 = Buffer.from(mcPassword).toString("base64");

        const tokenRes = await fetch(
          `https://cpaas.messagecentral.com/auth/v1/authentication/token?customerId=${mcCustomerId}&key=${mcPasswordBase64}&scope=NEW&country=91`
        );
        const tokenData = await tokenRes.json();

        if (!tokenData.token)
          throw new Error("Message Central Authentication Failed");

        const mcSendRes = await fetch(
          `https://cpaas.messagecentral.com/verification/v3/send?countryCode=91&flowType=SMS&mobileNumber=${cleanPhone}`,
          {
            method: "POST",
            headers: { authToken: tokenData.token },
          }
        );

        const mcSendData = await mcSendRes.json();
        if (mcSendRes.status !== 200 || !mcSendData.data?.verificationId) {
          throw new Error("Message Central OTP Send Failed");
        }

        global.otpStore[cleanPhone] = mcSendData.data.verificationId;
        break;
      }

      case "firebase":
      default:
        break;
    }

    if (provider === "firebase") {
      return NextResponse.json({
        success: true,
        message: "Use Firebase Phone Auth on client side",
        useFirebase: true,
      });
    }

    return NextResponse.json({
      success: true,
      message: `OTP sent via ${provider.toUpperCase()}`,
      useFirebase: false,
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("[send-otp] Error:", err.message);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to send OTP" },
      { status: 500 }
    );
  }
}
