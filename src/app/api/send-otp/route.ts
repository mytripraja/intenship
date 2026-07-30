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
          throw new Error(
            "Message Central credentials (MC_CUSTOMER_ID or MC_PASSWORD) are missing."
          );
        }

        const tokenUrl = `https://cpaas.messagecentral.com/auth/v1/authentication/token?customerId=${mcCustomerId}&key=${mcPassword}&scope=NEW&country=91`;
        const tokenRes = await fetch(tokenUrl, {
          method: "GET",
          headers: { accept: "*/*" },
        });

        const tokenData = await tokenRes.json();

        if (!tokenData.token) {
          throw new Error(
            `Token generation failed: ${JSON.stringify(tokenData)}`
          );
        }

        const mcSendRes = await fetch(
          `https://cpaas.messagecentral.com/verification/v3/send?countryCode=91&flowType=SMS&mobileNumber=${cleanPhone}`,
          {
            method: "POST",
            headers: {
              authToken: tokenData.token,
              accept: "*/*",
            },
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
          message: "OTP sent successfully via Message Central",
        });
      }

      case "fast2sms": {
        const apiKey = process.env.FAST2SMS_API_KEY;
        if (!apiKey) throw new Error("Fast2SMS API key is missing");

        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        const f2sResponse = await fetch(
          "https://www.fast2sms.com/dev/bulkV2",
          {
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
          }
        );

        const f2sData = await f2sResponse.json();
        if (!f2sData.return) throw new Error(f2sData.message);

        (global as any).otpStore[cleanPhone] = {
          otp,
          expiry: Date.now() + 5 * 60 * 1000,
        };

        return NextResponse.json({
          success: true,
          message: "OTP sent via Fast2SMS",
        });
      }

      case "twilio": {
        const sid = process.env.TWILIO_ACCOUNT_SID;
        const token = process.env.TWILIO_AUTH_TOKEN;
        const from = process.env.TWILIO_PHONE_NUMBER;
        if (!sid || !token || !from)
          throw new Error("Twilio credentials not set");

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const basicAuth = Buffer.from(`${sid}:${token}`).toString("base64");
        const body = new URLSearchParams({
          To: `+91${cleanPhone}`,
          From: from,
          Body: `Your verification OTP is: ${otp}`,
        });

        const twilioRes = await fetch(
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

        if (!twilioRes.ok) {
          const err = await twilioRes.text();
          throw new Error(`Twilio API failed: ${err}`);
        }

        (global as any).otpStore[cleanPhone] = {
          otp,
          expiry: Date.now() + 5 * 60 * 1000,
        };

        return NextResponse.json({
          success: true,
          message: "OTP sent via Twilio",
        });
      }

      case "msg91": {
        const apiKey = process.env.MSG91_API_KEY;
        const templateId = process.env.MSG91_TEMPLATE_ID;
        if (!apiKey) throw new Error("MSG91_API_KEY not set");

        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        const msg91Res = await fetch("https://api.msg91.com/api/v5/otp", {
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

        const msg91Data = await msg91Res.json();
        if (msg91Data.type !== "success") {
          throw new Error(msg91Data.message || "MSG91 API failed");
        }

        (global as any).otpStore[cleanPhone] = {
          otp,
          expiry: Date.now() + 5 * 60 * 1000,
        };

        return NextResponse.json({
          success: true,
          message: "OTP sent via MSG91",
        });
      }

      case "firebase":
        return NextResponse.json({
          success: true,
          message: "Use Firebase Phone Auth on client side",
          useFirebase: true,
        });

      case "mock":
      default: {
        console.log(`[MOCK SMS] Simulated sending OTP to ${cleanPhone}`);
        (global as any).otpStore[cleanPhone] = {
          otp: "123456",
          expiry: Date.now() + 5 * 60 * 1000,
        };

        return NextResponse.json({
          success: true,
          message: "OTP sent via Mock service",
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
