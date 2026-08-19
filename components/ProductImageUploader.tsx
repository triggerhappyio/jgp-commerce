"use client";

import { useState, useRef } from "react";
import { attachProductImage } from "@/lib/actions/products";

export default function ProductImageUploader({ productId }: { productId: string }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("productId", productId);

      const res = await fetch("/api/admin/upload-image", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed.");

      await attachProductImage(productId, data.url);
    } catch (err: any) {
      setError(err.message || "Upload failed.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={uploading}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUpload(file);
        }}
        style={{ fontSize: 13 }}
      />
      {uploading && <p style={{ fontSize: 12, color: "var(--steel)" }}>Uploading…</p>}
      {error && <p style={{ fontSize: 12, color: "#b3261e" }}>{error}</p>}
    </div>
  );
}
