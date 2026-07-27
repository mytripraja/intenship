"use client";

import { useState, useEffect } from "react";
import { auth } from "@/lib/firebase";
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
} from "firebase/auth";

export default function LoginPage() {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState(1);
  const [message, setMessage] = useState("");
  const [confirmationResult, setConfirmationResult] =
    useState<ConfirmationResult | null>(null);

  useEffect(() => {
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(
        auth,
        "recaptcha-container",
        {
          size: "invisible",
        }
      );
    }
  }, []);

  const requestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");

    try {
      const formattedPhone = phone.startsWith("+") ? phone : `+91${phone}`;
      const appVerifier = window.recaptchaVerifier;

      const result = await signInWithPhoneNumber(
        auth,
        formattedPhone,
        appVerifier
      );
      setConfirmationResult(result);
      setStep(2);
      setMessage("OTP sent successfully!");
    } catch (error: any) {
      console.error(error);
      setMessage(error.message || "Failed to send OTP.");
    }
  };

  const verifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");

    try {
      if (confirmationResult) {
        await confirmationResult.confirm(otp);
        setStep(3);
        setMessage("You have logged in successfully!");
      }
    } catch {
      setMessage("Invalid OTP. Try again.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-sm text-center">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">
          Internship Login
        </h2>

        {step === 1 && (
          <form onSubmit={requestOTP}>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Mobile Number (+919876543210)"
              className="w-full p-3 mb-4 border border-gray-300 rounded text-black"
              required
            />
            <button
              type="submit"
              className="w-full bg-blue-600 text-white font-bold py-3 rounded hover:bg-blue-700 transition"
            >
              Send OTP
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={verifyOTP}>
            <input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="Enter 6-digit OTP"
              className="w-full p-3 mb-4 border border-gray-300 rounded text-black"
              required
            />
            <button
              type="submit"
              className="w-full bg-blue-600 text-white font-bold py-3 rounded hover:bg-blue-700 transition"
            >
              Verify OTP
            </button>
          </form>
        )}

        {step === 3 && (
          <div className="text-green-600 font-bold text-lg mt-4">{message}</div>
        )}

        <div id="recaptcha-container"></div>

        {step !== 3 && message && (
          <p className="mt-4 text-sm font-medium text-red-500">{message}</p>
        )}
      </div>
    </div>
  );
}

declare global {
  interface Window {
    recaptchaVerifier: any;
  }
}
