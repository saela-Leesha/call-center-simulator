import { CertificateGallery } from "@/components/CertificateGallery";

export default function TeacherCertificatesPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold">Certificates</h2>
        <p className="text-sm text-muted">Issue training, completion, and achievement certificates directly to student accounts.</p>
      </div>
      <CertificateGallery teacherMode />
    </div>
  );
}
