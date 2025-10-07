"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { resendOtp, verifyOtp } from "@/lib/api";

export default function VerifyOtpPage() {
  const [otp, setOtp] = React.useState("");
  const [sessionId, setSessionId] = React.useState("");
  const [error, setError] = React.useState("");
  const [ok, setOk] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const onVerify = async () => {
    setLoading(true);
    setError("");
    setOk("");
    try {
      const res = await verifyOtp({ otp, session_id: sessionId });
      setOk(typeof res === "string" ? res : "Verified");
    } catch (e: any) {
      setError(e?.message || "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const onResend = async () => {
    setError("");
    setOk("");
    try {
      await resendOtp(sessionId);
      setOk("OTP resent");
    } catch (e: any) {
      setError(e?.message || "Resend failed");
    }
  };

  return (
    <div className="container mx-auto px-4 py-20 max-w-md">
      <Card className="p-6 space-y-3">
        <h1 className="text-2xl font-semibold">Verify OTP</h1>
        {error && <div className="text-destructive text-sm">{error}</div>}
        {ok && <div className="text-green-600 text-sm">{ok}</div>}
        <Input
          placeholder="Session ID"
          value={sessionId}
          onChange={(e) => setSessionId(e.target.value)}
        />
        <Input
          placeholder="OTP"
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
        />
        <div className="flex gap-2">
          <Button onClick={onVerify} disabled={loading}>
            {loading ? "Verifying..." : "Verify"}
          </Button>
          <Button variant="outline" onClick={onResend}>
            Resend
          </Button>
        </div>
      </Card>
    </div>
  );
}
