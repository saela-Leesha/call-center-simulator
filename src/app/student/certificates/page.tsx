import { CertificateGallery } from "@/components/CertificateGallery";

export default function StudentCertificatesPage() {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.16em] text-muted">Transcript</p>
        <h2 className="text-2xl font-semibold">Certificates</h2>
        <p className="text-sm text-muted">
          View and download training, completion, and achievement certificates issued to your account.
        </p>
      </div>
      <CertificateGallery />
    </div>
  );
}
