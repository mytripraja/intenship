import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export async function POST(request: NextRequest) {
  try {
    const { phoneNumber, otp } = await request.json();

    if (!phoneNumber || !otp || otp.length !== 6) {
      return NextResponse.json(
        { success: false, message: "Invalid request" },
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

    const url = `https://cpaas.messagecentral.com/api/v1/verify?countryCode=${countryCode}&phoneNumber=${phoneNumber}&otp=${otp}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const data = await response.json();

    if (response.ok && data.status === "SUCCESS") {
      await addDoc(collection(db, "logins"), {
        phoneNumber,
        verifiedAt: serverTimestamp(),
        status: "success",
      });

      return NextResponse.json({ success: true, message: "OTP verified successfully" });
    }

    return NextResponse.json(
      { success: false, message: data.message || "Invalid OTP" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Verify OTP error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
