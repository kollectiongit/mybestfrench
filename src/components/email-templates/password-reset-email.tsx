interface PasswordResetEmailProps {
  firstName: string;
  resetUrl: string;
}

export function PasswordResetEmail({
  firstName,
  resetUrl,
}: PasswordResetEmailProps) {
  return (
    <div
      style={{
        fontFamily: "Arial, sans-serif",
        maxWidth: "600px",
        margin: "0 auto",
        padding: "20px",
      }}
    >
      <div
        style={{
          backgroundColor: "#f8f9fa",
          padding: "30px",
          borderRadius: "10px",
          textAlign: "center",
        }}
      >
        <h1 style={{ color: "#dc2626", marginBottom: "20px" }}>
          Réinitialisation de votre mot de passe 🔐
        </h1>

        <p style={{ fontSize: "18px", color: "#374151", marginBottom: "20px" }}>
          Bonjour <strong>{firstName}</strong>,
        </p>

        <p
          style={{
            fontSize: "16px",
            color: "#6b7280",
            lineHeight: "1.6",
            marginBottom: "25px",
          }}
        >
          Nous avons reçu une demande de réinitialisation de mot de passe pour
          votre compte. Si vous n'avez pas fait cette demande, vous pouvez
          ignorer cet email en toute sécurité.
        </p>

        <div
          style={{
            backgroundColor: "#ffffff",
            padding: "20px",
            borderRadius: "8px",
            marginBottom: "25px",
          }}
        >
          <h3 style={{ color: "#1f2937", marginBottom: "15px" }}>
            Pour réinitialiser votre mot de passe :
          </h3>
          <p style={{ color: "#4b5563", lineHeight: "1.6" }}>
            Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe
            sécurisé.
          </p>
        </div>

        <div style={{ marginTop: "30px" }}>
          <a
            href={resetUrl}
            style={{
              backgroundColor: "#dc2626",
              color: "white",
              padding: "12px 30px",
              textDecoration: "none",
              borderRadius: "6px",
              display: "inline-block",
              fontWeight: "bold",
            }}
          >
            Réinitialiser mon mot de passe
          </a>
        </div>

        <div
          style={{
            backgroundColor: "#fef2f2",
            padding: "15px",
            borderRadius: "6px",
            marginTop: "25px",
          }}
        >
          <p style={{ fontSize: "14px", color: "#dc2626", margin: "0" }}>
            ⚠️ <strong>Important :</strong> Ce lien expire dans 1 heure pour des
            raisons de sécurité.
          </p>
        </div>

        <p style={{ fontSize: "14px", color: "#9ca3af", marginTop: "30px" }}>
          Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre
          navigateur :
        </p>
        <p
          style={{
            fontSize: "12px",
            color: "#6b7280",
            wordBreak: "break-all",
            backgroundColor: "#f3f4f6",
            padding: "10px",
            borderRadius: "4px",
            marginTop: "10px",
          }}
        >
          {resetUrl}
        </p>

        <div
          style={{
            borderTop: "1px solid #e5e7eb",
            marginTop: "30px",
            paddingTop: "20px",
          }}
        >
          <p style={{ fontSize: "12px", color: "#9ca3af" }}>
            Cet email a été envoyé automatiquement. Merci de ne pas y répondre.
          </p>
        </div>
      </div>
    </div>
  );
}
