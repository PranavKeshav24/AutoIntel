"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { loginUser } from "@/lib/api";

export default function LoginPage() {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string>("");
  const [loading, setLoading] = React.useState(false);

  const onSubmit = async () => {
    setLoading(true);
    setError("");
    try {
      await loginUser({ email, password });
      window.location.href = "/";
    } catch (e: any) {
      setError(e?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-20 max-w-md">
      <Card className="p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Login</h1>
        {error && <div className="text-destructive text-sm">{error}</div>}
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">Email</label>
          <Input placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">Password</label>
          <Input placeholder="••••••••" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button onClick={onSubmit} disabled={loading} className="w-full">{loading ? "Logging in..." : "Login"}</Button>
        <div className="text-sm text-muted-foreground text-center">
          Don't have an account? <a className="underline" href="/register">Register</a>
        </div>
      </Card>
    </div>
  );
}


