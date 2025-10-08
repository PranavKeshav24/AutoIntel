"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { resendOtp, verifyOtp } from "@/lib/api";
import { useSearchParams } from "next/navigation";

export default function VerifyOtpPage() {
  const [otp, setOtp] = React.useState("");
  const [sessionId, setSessionId] = React.useState("");
  const [error, setError] = React.useState("");
  const [ok, setOk] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const params = useSearchParams();

  React.useEffect(() => {
    const sid = params?.get("session_id") || "";
    if (sid) setSessionId(sid);
  }, [params]);

  const onVerify = async () => {
    setLoading(true);
    setError("");
    setOk("");
    try {
      const res = await verifyOtp({ otp, session_id: sessionId });
      setOk(typeof res === "string" ? res : "Verified");
      setTimeout(() => { window.location.href = "/"; }, 800);
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
      <Card className="p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Verify OTP</h1>
        <p className="text-sm text-muted-foreground">Enter the code sent to your email/phone to complete verification.</p>
        {error && <div className="text-destructive text-sm">{error}</div>}
        {ok && <div className="text-green-600 text-sm">{ok}</div>}
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">Session ID</label>
          <Input
            placeholder="Session ID"
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">OTP</label>
          <Input
            placeholder="123456"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button onClick={onVerify} disabled={loading} className="flex-1">
            {loading ? "Verifying..." : "Verify"}
          </Button>
          <Button variant="outline" onClick={onResend} className="flex-1">
            Resend
          </Button>
        </div>
        <div className="text-sm text-muted-foreground text-center">
          <a className="underline" href="/login">Back to login</a>
        </div>
      </Card>
    </div>
  );
}
