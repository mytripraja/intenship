"use client";

import { useState, useEffect } from "react";

type Step = "phone" | "otp" | "success";

export default function Home() {
  const [step, setStep] = useState<Step>("phone");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [timer, setTimer] = useState(0);

  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => setTimer(timer - 1), 1000);
      return () => clearInterval(interval);
    }
  }, [timer]);

  const sendOTP = async () => {
    if (!phoneNumber || phoneNumber.length < 10) {
      setError("Please enter a valid 10-digit mobile number");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber }),
      });

      const data = await response.json();

      if (data.success) {
        setStep("otp");
        setTimer(60);
      } else {
        setError(data.message || "Failed to send OTP");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const verifyOTP = async () => {
    if (!otp || otp.length !== 6) {
      setError("Please enter a valid 6-digit OTP");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber, otp }),
      });

      const data = await response.json();

      if (data.success) {
        setStep("success");
      } else {
        setError(data.message || "Invalid OTP");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const resendOTP = () => {
    setOtp("");
    setError("");
    sendOTP();
  };

  return (
    <div className="login-container">
      {step === "phone" && (
        <>
          <h1>Login</h1>
          <p className="subtitle">Enter your mobile number to receive OTP</p>

          <div className="form-group">
            <label>Mobile Number</label>
            <div className="phone-input">
              <input
                type="text"
                className="country-code"
                value="+91"
                readOnly
              />
              <input
                type="tel"
                className="phone-number"
                placeholder="Enter 10-digit number"
                value={phoneNumber}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, "").slice(0, 10);
                  setPhoneNumber(value);
                  setError("");
                }}
                maxLength={10}
              />
            </div>
          </div>

          <button
            className="send-otp-btn"
            onClick={sendOTP}
            disabled={loading || phoneNumber.length < 10}
          >
            {loading ? "Sending OTP..." : "Send OTP"}
          </button>

          {error && <p className="error-message">{error}</p>}
        </>
      )}

      {step === "otp" && (
        <>
          <h1>Verify OTP</h1>
          <p className="subtitle">
            OTP sent to +91 {phoneNumber}
          </p>

          <div className="form-group">
            <label>Enter 6-digit OTP</label>
            <input
              type="tel"
              className="otp-input"
              placeholder="------"
              value={otp}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, "").slice(0, 6);
                setOtp(value);
                setError("");
              }}
              maxLength={6}
            />
          </div>

          <button
            className="verify-btn"
            onClick={verifyOTP}
            disabled={loading || otp.length < 6}
          >
            {loading ? "Verifying..." : "Verify OTP"}
          </button>

          {timer > 0 ? (
            <p className="timer">Resend OTP in {timer}s</p>
          ) : (
            <button className="resend-btn" onClick={resendOTP}>
              Resend OTP
            </button>
          )}

          <button
            className="back-btn"
            onClick={() => {
              setStep("phone");
              setOtp("");
              setError("");
            }}
          >
            Change Number
          </button>

          {error && <p className="error-message">{error}</p>}
        </>
      )}

      {step === "success" && (
        <div className="success-message">
          <div className="success-icon">&#10003;</div>
          <h2>Login Successful!</h2>
          <p>Welcome! You have logged in successfully.</p>
        </div>
      )}
    </div>
  );
}
