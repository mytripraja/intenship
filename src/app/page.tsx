"use client";

import { useState, useEffect, useRef } from "react";
import { auth } from "@/lib/firebase";
import { RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";

export default function LoginPage() {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [step, setStep] = useState(1);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [timer, setTimer] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(
        auth,
        "recaptcha-container",
        { size: "invisible" }
      );
    }
  }, []);

  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => setTimer(timer - 1), 1000);
      return () => clearInterval(interval);
    }
  }, [timer]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 10);
    setPhone(value);
    setError(false);
    setMessage("");
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setError(false);
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);
    const newOtp = [...otp];
    pasted.split("").forEach((char, i) => {
      if (i < 6) newOtp[i] = char;
    });
    setOtp(newOtp);
    otpRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  const requestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const response = await fetch("/api/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to send OTP");
      }

      setStep(2);
      setTimer(60);
    } catch (err: any) {
      console.error(err);
      setMessage(err.message || "Failed to send OTP. Please try again.");
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const verifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const otpString = otp.join("");

      const response = await fetch("/api/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, otp: otpString }),
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Invalid OTP");
      }

      setStep(3);
    } catch (err: any) {
      setMessage(err.message || "Invalid OTP. Please try again.");
      setError(true);
      setOtp(["", "", "", "", "", ""]);
      otpRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const resendOTP = async () => {
    setOtp(["", "", "", "", "", ""]);
    setMessage("");
    setError(false);
    setLoading(true);

    try {
      const response = await fetch("/api/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await response.json();

      if (!data.success) throw new Error(data.error);

      setTimer(60);
    } catch (err: any) {
      setMessage(err.message || "Failed to resend OTP.");
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="bg-animation">
        <div className="bg-orb"></div>
        <div className="bg-orb"></div>
        <div className="bg-orb"></div>
      </div>

      <div className="main-container">
        <div className="card">
          <div className="header">
            <div className="logo-wrapper">
              <div className="logo">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
              </div>
            </div>
            <h1 className="title">Welcome Back</h1>
            <p className="subtitle">
              {step === 1
                ? "Sign in with your phone number"
                : step === 2
                ? "Verify your identity"
                : "You're all set!"}
            </p>
          </div>

          <div className="steps">
            <div className="step">
              <div
                className={`step-dot ${step >= 1 ? "active" : ""} ${
                  step > 1 ? "completed" : ""
                }`}
              />
            </div>
            <div className={`step-line ${step > 1 ? "active" : ""}`} />
            <div className="step">
              <div
                className={`step-dot ${step >= 2 ? "active" : ""} ${
                  step > 2 ? "completed" : ""
                }`}
              />
            </div>
            <div className="step-line" />
            <div className="step">
              <div className={`step-dot ${step >= 3 ? "active" : ""}`} />
            </div>
          </div>

          {step === 1 && (
            <form
              onSubmit={requestOTP}
              style={{ animation: "slideLeft 0.4s ease" }}
            >
              <div className="input-group">
                <label className="input-label">Mobile Number</label>
                <div className="phone-input-wrapper">
                  <div className="country-code">+91</div>
                  <input
                    type="tel"
                    value={phone}
                    onChange={handlePhoneChange}
                    placeholder="Enter your number"
                    className="phone-input"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || phone.length < 10}
                className="btn btn-primary"
              >
                <span className="btn-content">
                  {loading ? (
                    <>
                      <span className="spinner"></span>
                      Sending...
                    </>
                  ) : (
                    <>
                      <svg
                        width="20"
                        height="20"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                        />
                      </svg>
                      Send OTP
                    </>
                  )}
                </span>
              </button>
            </form>
          )}

          {step === 2 && (
            <form
              onSubmit={verifyOTP}
              style={{ animation: "slideRight 0.4s ease" }}
            >
              <div className="input-group">
                <label className="input-label">Verification Code</label>
                <div className="otp-container">
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => {
                        otpRefs.current[index] = el;
                      }}
                      type="tel"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      onPaste={index === 0 ? handleOtpPaste : undefined}
                      className={`otp-box ${digit ? "filled" : ""} ${
                        error ? "error" : ""
                      }`}
                    />
                  ))}
                </div>
                <p className="phone-display">
                  Code sent to{" "}
                  <span className="phone-number">+91 {phone}</span>
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || otp.some((d) => !d)}
                className="btn btn-verify"
              >
                <span className="btn-content">
                  {loading ? (
                    <>
                      <span className="spinner"></span>
                      Verifying...
                    </>
                  ) : (
                    <>
                      <svg
                        width="20"
                        height="20"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      Verify OTP
                    </>
                  )}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setOtp(["", "", "", "", "", ""]);
                  setMessage("");
                  setError(false);
                }}
                className="btn btn-ghost"
              >
                Change Number
              </button>

              <div className="resend-text">
                {timer > 0 ? (
                  <span>
                    Resend OTP in <span className="timer">{timer}s</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={resendOTP}
                    disabled={loading}
                    className="resend-btn"
                  >
                    {loading ? "Sending..." : "Resend OTP"}
                  </button>
                )}
              </div>
            </form>
          )}

          {step === 3 && (
            <div className="success-view">
              <div className="success-icon-wrapper">
                <div className="success-ring"></div>
                <div className="success-ring"></div>
                <div className="success-circle">
                  <svg className="success-check" viewBox="0 0 24 24">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
              <h2 className="success-title">Login Successful!</h2>
              <p className="success-text">
                You have been authenticated successfully.
              </p>
              <p className="phone-display" style={{ marginTop: "16px" }}>
                Welcome to the{" "}
                <span className="phone-number">Internship Portal</span>
              </p>
            </div>
          )}

          {message && step !== 3 && (
            <div className={`message ${error ? "error" : "success"}`}>
              {message}
            </div>
          )}

          <div id="recaptcha-container"></div>
        </div>
      </div>
    </>
  );
}

declare global {
  interface Window {
    recaptchaVerifier: any;
  }
}
