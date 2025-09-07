interface WelcomeEmailProps {
  firstName: string;
  email: string;
}

export function WelcomeEmail({ firstName, email }: WelcomeEmailProps) {
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
        <h1 style={{ color: "#2563eb", marginBottom: "20px" }}>
          Bienvenue sur notre plateforme ! 🎉
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
          Nous sommes ravis de vous accueillir ! Votre compte a été créé avec
          succès avec l&apos;adresse email : <strong>{email}</strong>
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
            Prochaines étapes :
          </h3>
          <ul
            style={{ textAlign: "left", color: "#4b5563", lineHeight: "1.8" }}
          >
            <li>Explorez votre tableau de bord</li>
            <li>Complétez votre profil</li>
            <li>Découvrez toutes nos fonctionnalités</li>
          </ul>
        </div>

        <div style={{ marginTop: "30px" }}>
          <a
            href="https://yourdomain.com/dashboard"
            style={{
              backgroundColor: "#2563eb",
              color: "white",
              padding: "12px 30px",
              textDecoration: "none",
              borderRadius: "6px",
              display: "inline-block",
              fontWeight: "bold",
            }}
          >
            Accéder à mon tableau de bord
          </a>
        </div>

        <p style={{ fontSize: "14px", color: "#9ca3af", marginTop: "30px" }}>
          Si vous avez des questions, n&apos;hésitez pas à nous contacter.
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
