import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { phoneNumber } = await request.json();

    if (!phoneNumber || phoneNumber.length < 10) {
      return NextResponse.json(
        { success: false, message: "Invalid phone number" },
        { status: 400 }
      );
    }

    const apiKey = process.env.MESSAGE_CENTRAL_API_KEY;
    const countryCode = process.env.MESSAGE_CENTRAL_COUNTRY_CODE || "91";

    if (!apiKey) {
      return NextResponse.json(
        { success: false, message: "API key not configured" },
        { status: 500 }
      );
    }

    const url = "https://cpaas.messagecentral.com/api/v1/send";

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        countryCode,
        phoneNumber,
        flowType: "OTP",
        otpLength: 6,
        otPtemplate: "", // Add your template ID if required
      }),
    });

    const data = await response.json();

    if (response.ok && data.status === "SUCCESS") {
      return NextResponse.json({ success: true, message: "OTP sent successfully" });
    }

    return NextResponse.json(
      { success: false, message: data.message || "Failed to send OTP" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Send OTP error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
